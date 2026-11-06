/// <reference types="node" />
import { createHash } from 'node:crypto';
import { appendFileSync, existsSync, mkdirSync, readFileSync } from 'node:fs';
import { dirname } from 'node:path';
import type { DecisionDef, FeedInput } from '../../../types';
import { computeConfidence } from '../../recommender';
import { isSummaryOrWeaker, reliabilityForQuality, RELIABILITY } from '../catalog';
import {
  SENTINEL_CORRECT_ACTION,
  SENTINEL_GROUND_TRUTH,
  buildDecisionDef,
  sensorEvidenceIsSummaryOnly,
} from '../adapter';
import { nextForensicSeq } from '../forensic';
import { BidAdapterError, type AdapterOptions } from '../types';
import { checkClaims, formatFindingLine } from './check';
import { extractLoadBearingClaims } from './extract';
import {
  PREGATE_THRESHOLDS,
  S3_COMPLEMENT_NOTE,
  type PregateForensicEntry,
  type PregateInput,
  type PregatePackage,
  type PregateReport,
} from './types';

export function hashPackage(pkg: PregatePackage): string {
  const canonical = JSON.stringify({
    pursuitId: pkg.pursuitId,
    title: pkg.title,
    submitted: pkg.submitted,
    sections: pkg.sections.map((s) => ({ id: s.id, heading: s.heading, lines: [...s.lines] })),
  });
  return createHash('sha256').update(canonical).digest('hex');
}

function assertNoSentinelLeak(payload: unknown): void {
  const blob = JSON.stringify(payload);
  if (blob.includes(SENTINEL_GROUND_TRUTH)) {
    throw new BidAdapterError('sentinel groundTruth leaked into adapter output');
  }
  if (/"correctAction"/.test(blob) || /"groundTruth"/.test(blob)) {
    throw new BidAdapterError('DecisionDef sentinel fields leaked into adapter output');
  }
}

function recordIsSummaryOnly(input: PregateInput): boolean {
  if (input.record) {
    const def = buildDecisionDef(input.record);
    return sensorEvidenceIsSummaryOnly(def.inputs);
  }
  if (input.recordEvidenceQuality) {
    return isSummaryOrWeaker(reliabilityForQuality(input.recordEvidenceQuality));
  }
  return false;
}

function snapshotPackage(pkg: PregatePackage): PregatePackage {
  return {
    pursuitId: pkg.pursuitId,
    title: pkg.title,
    submitted: pkg.submitted,
    sections: pkg.sections.map((s) => ({
      id: s.id,
      heading: s.heading,
      lines: [...s.lines],
    })),
  };
}

function diskBytes(path: string | undefined): Buffer | null {
  if (!path) return null;
  return readFileSync(path);
}

function appendPregateForensic(path: string | undefined, entry: PregateForensicEntry): void {
  if (!path) return;
  const dir = dirname(path);
  if (dir && dir !== '.' && !existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
  appendFileSync(path, `${JSON.stringify(entry)}\n`, 'utf8');
}

/**
 * Internal DecisionDef for computeConfidence. Public for tests.
 * Sentinel fields are set for the engine type and MUST NOT appear on
 * PregateReport / forensic output.
 */
export function buildPregateDecisionDef(
  input: PregateInput,
  verifiedInputs: FeedInput[],
  contradictionLines: string[],
  linkDegraded: boolean,
): DecisionDef {
  return {
    id: `pregate:${input.package.pursuitId}`,
    title: input.package.title,
    recommendation:
      'Package integrity score — decision support for the S6 gate, never an auto-decision. Complements S3 multi-model review; does not clear an S3 BLOCKER.',
    reasoning: verifiedInputs.map((i) => `${i.claim} (${i.source})`),
    inputs: verifiedInputs,
    contradictions: contradictionLines,
    linkDegraded,
    correctAction: SENTINEL_CORRECT_ACTION,
    groundTruth: SENTINEL_GROUND_TRUTH,
    onAccept: [],
    onOverride: [],
    overrideReasons: [],
  };
}

/**
 * Phase 2 pre-gate contradiction pass (CHR-2283).
 *
 * Read-only: never edits the package. Verified claims become supporting
 * FeedInputs; mismatches and unbound claims become engine contradictions
 * (−4 each). computeConfidence is called unchanged.
 */
export function runPregatePass(raw: PregateInput, options: AdapterOptions = {}): PregateReport {
  if (raw === null || typeof raw !== 'object') {
    throw new BidAdapterError('pregate input must be an object');
  }
  if (!raw.package || typeof raw.package.pursuitId !== 'string' || raw.package.pursuitId.trim() === '') {
    throw new BidAdapterError('package.pursuitId is required');
  }
  if (typeof raw.package.title !== 'string' || raw.package.title.trim() === '') {
    throw new BidAdapterError('package.title is required');
  }
  if (!Array.isArray(raw.package.sections)) {
    throw new BidAdapterError('package.sections must be an array');
  }
  if (!Array.isArray(raw.canon)) {
    throw new BidAdapterError('canon must be an array');
  }

  const diskBefore = diskBytes(raw.packagePath);
  const pkg = snapshotPackage(raw.package);
  const packageHash = hashPackage(pkg);

  const extracted = extractLoadBearingClaims(pkg, raw.canon);
  const checks = checkClaims(extracted, raw.canon);
  const findings = checks.filter((c) => c.finding !== null).map((c) => c.finding!);
  const verifiedChecks = checks.filter((c) => c.status === 'verified');
  const contradictionLines = findings.map(formatFindingLine);
  const linkDegraded = recordIsSummaryOnly(raw);

  const verifiedInputs: FeedInput[] = verifiedChecks.map((c) => {
    const fact = c.canon !== null && c.canon.entry === 'fact' ? c.canon : null;
    if (fact === null) {
      throw new BidAdapterError(`verified claim ${c.extracted.id} has no canon fact`);
    }
    return {
      id: c.extracted.id,
      source: fact.sourceHandle,
      feedClass: fact.feedClass ?? 'blueforce',
      claim: c.extracted.context.trim(),
      ageMin: 0,
      reliability: RELIABILITY.recordCard,
      supports: true,
      integrity: 'ok',
    };
  });

  const def = buildPregateDecisionDef(raw, verifiedInputs, contradictionLines, linkDegraded);
  const scored = computeConfidence(def);

  const modelVersion = options.modelVersion ?? 'unknown';
  const seq = nextForensicSeq(options.forensicPath);
  const s3Blockers = [...(raw.s3Blockers ?? [])];

  const report: PregateReport = {
    pursuitId: pkg.pursuitId,
    title: pkg.title,
    value: scored.value,
    kind: 'package-integrity',
    drivers: scored.drivers,
    findings,
    verified: verifiedChecks.map((c) => c.extracted),
    extracted,
    checks,
    verifiedCount: verifiedChecks.length,
    contradictionCount: findings.filter((f) => f.kind === 'contradiction').length,
    unboundCount: findings.filter((f) => f.kind === 'unbound').length,
    linkDegraded,
    packageHash,
    packageHashAfter: hashPackage(pkg),
    readOnly: true,
    packageEdited: false,
    complementsS3: true,
    clearsS3Blocker: false,
    s3Blockers,
    s3Note: S3_COMPLEMENT_NOTE,
    thresholds: PREGATE_THRESHOLDS,
    inputs: verifiedInputs,
    contradictions: contradictionLines,
    forensic: {
      seq,
      path: options.forensicPath ?? null,
      modelVersion,
    },
  };

  if (report.packageHash !== report.packageHashAfter) {
    throw new BidAdapterError('pregate pass mutated the in-memory package');
  }
  const diskAfter = diskBytes(raw.packagePath);
  if (diskBefore && diskAfter && !diskBefore.equals(diskAfter)) {
    throw new BidAdapterError('pregate pass mutated the on-disk package');
  }

  assertNoSentinelLeak(report);

  const forensicEntry: PregateForensicEntry = {
    phase: 2,
    kind: 'pregate',
    seq,
    ts: new Date().toISOString(),
    pursuitId: report.pursuitId,
    title: report.title,
    value: report.value,
    drivers: report.drivers,
    findings: report.findings,
    verifiedCount: report.verifiedCount,
    contradictionCount: report.contradictionCount,
    unboundCount: report.unboundCount,
    linkDegraded: report.linkDegraded,
    clearsS3Blocker: false,
    s3Blockers: report.s3Blockers,
    packageHash: report.packageHash,
    thresholds: report.thresholds,
    modelVersion,
    inputs: report.inputs,
    contradictions: report.contradictions,
  };
  assertNoSentinelLeak(forensicEntry);
  appendPregateForensic(options.forensicPath, forensicEntry);

  return report;
}

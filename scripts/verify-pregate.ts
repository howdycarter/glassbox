/* Glass-Box — Phase 2 pre-gate contradiction pass (CHR-2283).
   Run: npm run verify:pregate
   Also chained from npm run verify after the engine baseline and Phase 1. */

import { mkdtempSync, readFileSync, rmSync, writeFileSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { computeConfidence, CONTRADICTION_PENALTY } from '../src/lib/recommender';
import {
  FINDING_PENALTY,
  S3_COMPLEMENT_NOTE,
  SENTINEL_GROUND_TRUTH,
  UNBOUND_RECORD_VALUE,
  buildPregateDecisionDef,
  extractLoadBearingClaims,
  hashPackage,
  parsePackageFromMarkdown,
  runPregatePass,
} from '../src/lib/bid';
import {
  KIND_SWEEP_CANON,
  KIND_SWEEP_PACKAGE,
  QUALIFIER_CANON,
  QUALIFIER_PACKAGE,
  SUMMARY_ONLY_INPUT,
  WORKED_EXAMPLE_CANON,
  WORKED_EXAMPLE_INPUT,
  WORKED_EXAMPLE_MARKDOWN,
  WORKED_EXAMPLE_PACKAGE,
  WORKED_EXAMPLE_S3_BLOCKERS,
} from '../src/lib/bid/pregate';
import type { PregateFinding, PregateForensicEntry } from '../src/lib/bid/pregate';

let passed = 0;
let failed = 0;
function check(name: string, cond: boolean, detail = ''): void {
  if (cond) {
    passed++;
    console.log(`  PASS  ${name}`);
  } else {
    failed++;
    console.log(`  FAIL  ${name}${detail ? ` — ${detail}` : ''}`);
  }
}

function leakBlob(value: unknown): string {
  return JSON.stringify(value);
}

function hasSentinelLeak(value: unknown): boolean {
  const blob = leakBlob(value);
  return (
    blob.includes(SENTINEL_GROUND_TRUTH) ||
    /"correctAction"/.test(blob) ||
    /"groundTruth"/.test(blob)
  );
}

console.log('P1. deterministic extraction of load-bearing kinds (spec §8 / CHR-2283)');
const kinds = extractLoadBearingClaims(KIND_SWEEP_PACKAGE, KIND_SWEEP_CANON);
const kindSet = new Set(kinds.map((c) => c.kind));
check('extracts percentages', kindSet.has('percentage') && kinds.some((c) => c.value.includes('15%')));
check('extracts dates', kindSet.has('date') && kinds.some((c) => /january 15, 2027/i.test(c.value)));
check('extracts named people', kindSet.has('person') && kinds.some((c) => c.value.includes('Chris Carter')));
check('extracts named orgs', kindSet.has('org') && kinds.some((c) => /newton & carter llc/i.test(c.value)));
check('extracts identifiers (CAGE)', kindSet.has('identifier') && kinds.some((c) => c.identifierType === 'cage' && c.value === '9ABC1'));
check('extracts certifications', kindSet.has('certification') && kinds.some((c) => /no certifications/i.test(c.value)));
check('extracts each claim with section + 1-indexed line', kinds.every((c) => c.location.section.length > 0 && c.location.line >= 1));

const moneyKinds = extractLoadBearingClaims(WORKED_EXAMPLE_PACKAGE, WORKED_EXAMPLE_CANON);
check('extracts money figures', moneyKinds.some((c) => c.kind === 'money' || c.kind === 'coverage'));
check('extracts addresses', moneyKinds.some((c) => c.kind === 'address'));
check('extracts coverage amounts', moneyKinds.some((c) => c.kind === 'coverage' && /25k/i.test(c.value)));
check(
  'qualifier span consumes the promised $1M so it is not a standalone money claim',
  !moneyKinds.some((c) => c.kind === 'money' && /\$1\s*m/i.test(c.raw) && c.location.sectionId === 'insurance'),
);

console.log('P2. worked example — known contradictions, unbound claims, integrity 88');
const example = runPregatePass(WORKED_EXAMPLE_INPUT, { modelVersion: 'test-pregate' });
check(
  'worked example integrity value 88, kind package-integrity',
  example.value === 88 && example.kind === 'package-integrity',
  `got ${example.value} ${example.kind}`,
);
check(
  'worked example: 5 verified, 1 contradiction, 2 unbound',
  example.verifiedCount === 5 && example.contradictionCount === 1 && example.unboundCount === 2,
  `verified=${example.verifiedCount} contra=${example.contradictionCount} unbound=${example.unboundCount} extracted=${example.extracted.length}`,
);

const rateFinding = example.findings.find((f) => f.kind === 'contradiction');
function findingShape(f: PregateFinding | undefined): boolean {
  if (!f) return false;
  return (
    typeof f.claim === 'string' &&
    f.claim.length > 0 &&
    typeof f.location.section === 'string' &&
    typeof f.location.line === 'number' &&
    typeof f.recordValue === 'string' &&
    typeof f.sourceHandle === 'string' &&
    f.penalty === FINDING_PENALTY &&
    f.penalty === -CONTRADICTION_PENALTY
  );
}
check(
  'contradiction finding shape: claim, location (section/line), record value, source handle, penalty −4',
  findingShape(rateFinding),
  JSON.stringify(rateFinding),
);
check(
  'rate contradiction: $125/hr in Attachment C vs record $115/hr on the rate-card handle',
  rateFinding !== undefined &&
    rateFinding.location.section === 'Attachment C rate table' &&
    rateFinding.location.line === 1 &&
    rateFinding.recordValue === '$115/hr' &&
    rateFinding.sourceHandle.includes('rate-card-proposal.md') &&
    /125/.test(rateFinding.claim) &&
    rateFinding.penalty === -4,
  JSON.stringify(rateFinding),
);

const unbound = example.findings.filter((f) => f.kind === 'unbound');
check(
  'unbound claims are reported, not silently passed (2 résumé figures)',
  unbound.length === 2 && unbound.every((f) => f.recordValue === UNBOUND_RECORD_VALUE && f.penalty === -4),
  JSON.stringify(unbound),
);
check(
  'unbound $20B names the inventory handle, not a silent pass',
  unbound.some(
    (f) =>
      /20B/i.test(f.claim) &&
      f.sourceHandle.includes('Capability_Inventory.md') &&
      f.location.section === 'Attachment R résumé',
  ),
  JSON.stringify(unbound),
);
check(
  'unbound Upwork $200K names the deploy-restriction handle',
  unbound.some((f) => /Upwork/i.test(f.claim) && f.sourceHandle.includes('Deploy-restrictions')),
  JSON.stringify(unbound),
);

check(
  'cyber $25K with matching bind-promised qualifier is verified, not a contradiction',
  example.verified.some((c) => c.kind === 'coverage' && /25k/i.test(c.value)) &&
    example.checks.some((c) => c.status === 'verified' && c.qualifierApplied && c.extracted.kind === 'coverage'),
);
check(
  'drivers: base +50, five supporting +10, contradiction penalty −12',
  example.drivers[0].delta === 50 &&
    example.drivers.filter((d) => d.delta === 10).length === 5 &&
    example.drivers.some((d) => d.label.includes('Contradiction penalty') && d.delta === -12),
  JSON.stringify(example.drivers.map((d) => ({ d: d.delta, l: d.label }))),
);
check(
  'integrity equals computeConfidence(buildPregateDecisionDef) — engine called unchanged',
  computeConfidence(
    buildPregateDecisionDef(
      WORKED_EXAMPLE_INPUT,
      example.inputs,
      example.contradictions,
      example.linkDegraded,
    ),
  ).value === example.value,
);
check('worked example is not link-degraded', example.linkDegraded === false);
check(
  'a clean Phase 2 score does not clear an S3 BLOCKER',
  example.clearsS3Blocker === false &&
    example.complementsS3 === true &&
    example.s3Note === S3_COMPLEMENT_NOTE &&
    example.s3Blockers.join('|') === WORKED_EXAMPLE_S3_BLOCKERS.join('|') &&
    example.value === 88,
);
check('report is read-only (packageEdited false, hashes match)', example.readOnly === true && example.packageEdited === false && example.packageHash === example.packageHashAfter);
check('in-memory package hash is stable across a second pass', hashPackage(WORKED_EXAMPLE_PACKAGE) === example.packageHash);
check('adapter output does not surface correctAction or groundTruth', !hasSentinelLeak(example));
check(
  'internal DecisionDef carries sentinel groundTruth (type requirement)',
  buildPregateDecisionDef(WORKED_EXAMPLE_INPUT, example.inputs, example.contradictions, false).groundTruth ===
    SENTINEL_GROUND_TRUTH,
);

console.log('P3. unbound-without-canon, qualifier rule, summary-only cap 60, read-only disk');
const orphan = runPregatePass({
  package: {
    pursuitId: 'CHR-2283-ORPHAN',
    title: 'TEST unbound-without-canon',
    submitted: true,
    sections: [{ id: 'body', heading: 'Body', lines: ['Unsourced metric $99,000'] }],
  },
  canon: [],
});
check(
  'a claim with no record source is unbound (not silently passed)',
  orphan.unboundCount === 1 &&
    orphan.contradictionCount === 0 &&
    orphan.verifiedCount === 0 &&
    orphan.findings[0].kind === 'unbound' &&
    orphan.findings[0].recordValue === UNBOUND_RECORD_VALUE &&
    orphan.findings[0].penalty === -4 &&
    orphan.value === 50 - 4,
  `got unbound=${orphan.unboundCount} value=${orphan.value} findings=${JSON.stringify(orphan.findings)}`,
);

const qualified = runPregatePass({
  package: QUALIFIER_PACKAGE,
  canon: QUALIFIER_CANON,
  recordEvidenceQuality: 'record-card',
});
check(
  'qualifier rule: disclosed uncertainty is verified, not a contradiction, despite $200 vs $150',
  qualified.verifiedCount === 1 &&
    qualified.contradictionCount === 0 &&
    qualified.unboundCount === 0 &&
    qualified.checks[0].qualifierApplied === true &&
    qualified.value === 60,
  `got v=${qualified.verifiedCount} c=${qualified.contradictionCount} u=${qualified.unboundCount} value=${qualified.value} q=${qualified.checks[0]?.qualifierApplied} status=${qualified.checks[0]?.status}`,
);

const summary = runPregatePass(SUMMARY_ONLY_INPUT, { modelVersion: 'test-pregate' });
check(
  'summary-only record triggers the Phase 1 degraded rule (cap 60)',
  summary.linkDegraded === true &&
    summary.value === 60 &&
    summary.drivers.some((d) => d.label.includes('Degraded link')) &&
    summary.drivers.some((d) => d.label.includes('Degraded cap')),
  `got value=${summary.value} degraded=${summary.linkDegraded} drivers=${JSON.stringify(summary.drivers)}`,
);
const summaryByQuality = runPregatePass({
  ...WORKED_EXAMPLE_INPUT,
  record: undefined,
  recordEvidenceQuality: 'reported-summary',
});
check(
  'recordEvidenceQuality reported-summary also fires the cap 60',
  summaryByQuality.linkDegraded === true && summaryByQuality.value === 60,
  `got ${summaryByQuality.value} ${summaryByQuality.linkDegraded}`,
);

const dir = mkdtempSync(join(tmpdir(), 'glassbox-pregate-'));
const pkgPath = join(dir, 'submitted-package.md');
const forensicPath = join(dir, 'pregate-forensic.jsonl');
try {
  writeFileSync(pkgPath, WORKED_EXAMPLE_MARKDOWN, 'utf8');
  const beforeStat = statSync(pkgPath);
  const beforeBytes = readFileSync(pkgPath);
  const parsed = parsePackageFromMarkdown('CHR-2283-FIXTURE', WORKED_EXAMPLE_PACKAGE.title, beforeBytes.toString('utf8'));
  const fromDisk = runPregatePass(
    {
      package: parsed,
      canon: WORKED_EXAMPLE_CANON,
      recordEvidenceQuality: 'record-card',
      packagePath: pkgPath,
      s3Blockers: [...WORKED_EXAMPLE_S3_BLOCKERS],
    },
    { forensicPath, modelVersion: 'test-pregate' },
  );
  const afterBytes = readFileSync(pkgPath);
  const afterStat = statSync(pkgPath);
  check('on-disk package bytes are unchanged (read-only)', beforeBytes.equals(afterBytes));
  check('on-disk package mtime is unchanged (pass never writes)', beforeStat.mtimeMs === afterStat.mtimeMs);
  check('disk-backed pass reproduces the worked-example integrity 88', fromDisk.value === 88 && fromDisk.contradictionCount === 1 && fromDisk.unboundCount === 2);

  const second = runPregatePass(WORKED_EXAMPLE_INPUT, { forensicPath, modelVersion: 'test-pregate' });
  const lines = readFileSync(forensicPath, 'utf8')
    .trim()
    .split('\n')
    .map((line) => JSON.parse(line) as PregateForensicEntry);
  check(
    'pregate forensic JSONL is append-only with monotonic seq 1 then 2',
    fromDisk.forensic.seq === 1 && second.forensic.seq === 2 && lines[0].seq === 1 && lines[1].seq === 2 && lines[0].phase === 2,
  );
  check(
    'forensic entry records integrity, findings, packageHash, and does-not-clear-S3',
    lines[0].value === 88 &&
      lines[0].findings.length === 3 &&
      lines[0].clearsS3Blocker === false &&
      typeof lines[0].packageHash === 'string' &&
      lines[0].packageHash.length === 64 &&
      lines[0].thresholds.degradedCap === 60 &&
      lines[0].thresholds.contradictionPenalty === 4,
  );
  check('forensic JSONL has no sentinel leak', !hasSentinelLeak(lines));
} finally {
  rmSync(dir, { recursive: true, force: true });
}

console.log('P4. no package-edit API; malformed input fails closed');
check(
  'runPregatePass return type has no package-mutation field besides packageEdited: false',
  example.packageEdited === false && !('fixes' in example) && !('patchedPackage' in example),
);
let threw = false;
try {
  runPregatePass({
    package: { pursuitId: '', title: 'x', submitted: true, sections: [] },
    canon: [],
  });
} catch {
  threw = true;
}
check('malformed package (empty pursuitId) fails closed', threw);

const frozenLines = WORKED_EXAMPLE_PACKAGE.sections[0].lines;
const beforeLine = frozenLines[0];
runPregatePass(WORKED_EXAMPLE_INPUT);
check(
  'pass does not mutate caller package lines',
  WORKED_EXAMPLE_PACKAGE.sections[0].lines[0] === beforeLine &&
    WORKED_EXAMPLE_PACKAGE.sections[0].lines === frozenLines,
);

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);

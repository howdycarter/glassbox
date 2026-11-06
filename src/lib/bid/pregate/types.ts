import type { ConfidenceDriver } from '../../recommender';
import type { FeedClass, FeedInput } from '../../../types';
import type { EvidenceQuality } from '../catalog';
import type { ForensicRef, PursuitRecord } from '../types';

/**
 * Load-bearing claim kinds (CHR-2283 / spec §8 as recorded on the
 * issue — the integration spec file is not in this repo).
 */
export const CLAIM_KINDS = [
  'money',
  'percentage',
  'date',
  'identifier',
  'person',
  'org',
  'certification',
  'address',
  'coverage',
] as const;

export type ClaimKind = (typeof CLAIM_KINDS)[number];

export type IdentifierType = 'uei' | 'cage' | 'ein' | 'duns' | 'phone' | 'email' | 'solicitation';

export type FindingKind = 'contradiction' | 'unbound';

export type ClaimStatus = 'verified' | 'contradiction' | 'unbound';

export const FINDING_PENALTY = -4 as const;

export const UNBOUND_RECORD_VALUE = '— no record source (unbound claim)';

export const S3_COMPLEMENT_NOTE =
  'Phase 2 complements S3 multi-model review; a clean Phase 2 score does not clear an S3 BLOCKER.';

export const PREGATE_THRESHOLDS = {
  contradictionPenalty: 4,
  degradedPenalty: 16,
  degradedCap: 60,
  clampMin: 5,
  clampMax: 97,
  verifiedReliability: 0.8,
  description:
    'Phase 2 package integrity: verified claims are supporting record-card inputs; each contradiction or unbound claim is −4; summary-only record sets linkDegraded (cap 60) exactly as Phase 1',
} as const;

export interface PregateSection {
  id: string;
  heading: string;
  lines: readonly string[];
}

/**
 * Already-submitted proposal package. The pass is read-only: it never
 * writes this structure or any `packagePath` on disk. Fixes route
 * through the parent (CHR-2278) to the drafting lane.
 */
export interface PregatePackage {
  pursuitId: string;
  title: string;
  submitted: boolean;
  sections: readonly PregateSection[];
}

export interface CanonFact {
  entry: 'fact';
  key: string;
  kind: ClaimKind;
  value: string;
  sourceHandle: string;
  aliases?: readonly string[];
  /** Record's own uncertainty disclosure. Matching draft qualifier → verified, not a contradiction. */
  qualifier?: string;
  feedClass?: FeedClass;
}

/**
 * Standing exclusion: the figure is known to have no canon source
 * (deploy restriction, site-only stat). Reported as unbound with this
 * handle — never silently passed.
 */
export interface CanonExclusion {
  entry: 'exclusion';
  key: string;
  kind: ClaimKind;
  aliases: readonly string[];
  sourceHandle: string;
  reason: string;
}

export type CanonEntry = CanonFact | CanonExclusion;

export interface DraftLocation {
  section: string;
  sectionId: string;
  line: number;
}

export interface ExtractedClaim {
  id: string;
  kind: ClaimKind;
  raw: string;
  value: string;
  normalized: string;
  location: DraftLocation;
  context: string;
  qualifier?: string;
  keyHint?: string;
  identifierType?: IdentifierType;
}

/**
 * One mismatch/unbound row in the spec-format contradiction report.
 * Penalty is always −4 (engine CONTRADICTION_PENALTY).
 */
export interface PregateFinding {
  kind: FindingKind;
  claim: string;
  location: DraftLocation;
  recordValue: string;
  sourceHandle: string;
  penalty: typeof FINDING_PENALTY;
}

export interface ClaimCheck {
  status: ClaimStatus;
  extracted: ExtractedClaim;
  canon: CanonEntry | null;
  qualifierApplied: boolean;
  finding: PregateFinding | null;
}

export interface PregateInput {
  package: PregatePackage;
  canon: readonly CanonEntry[];
  /**
   * When present, the degraded-evidence rule is the Phase 1 check:
   * summary-only SENSOR feeds on this record set linkDegraded.
   */
  record?: PursuitRecord;
  /** Used when `record` is omitted. Summary/title-only → cap 60. */
  recordEvidenceQuality?: EvidenceQuality;
  /** Echoed on the report. A clean Phase 2 score never clears these. */
  s3Blockers?: readonly string[];
  /**
   * Optional on-disk package. The pass may READ it to confirm bytes
   * are unchanged; it never writes.
   */
  packagePath?: string;
}

export interface PregateReport {
  pursuitId: string;
  title: string;
  /** Package integrity score from computeConfidence (clamped [5, 97]). */
  value: number;
  kind: 'package-integrity';
  drivers: ConfidenceDriver[];
  findings: PregateFinding[];
  verified: ExtractedClaim[];
  extracted: ExtractedClaim[];
  checks: ClaimCheck[];
  verifiedCount: number;
  contradictionCount: number;
  unboundCount: number;
  linkDegraded: boolean;
  packageHash: string;
  packageHashAfter: string;
  readOnly: true;
  packageEdited: false;
  complementsS3: true;
  clearsS3Blocker: false;
  s3Blockers: string[];
  s3Note: typeof S3_COMPLEMENT_NOTE;
  thresholds: typeof PREGATE_THRESHOLDS;
  inputs: FeedInput[];
  contradictions: string[];
  forensic: ForensicRef;
}

export interface PregateForensicEntry {
  phase: 2;
  kind: 'pregate';
  seq: number;
  ts: string;
  pursuitId: string;
  title: string;
  value: number;
  drivers: ConfidenceDriver[];
  findings: PregateFinding[];
  verifiedCount: number;
  contradictionCount: number;
  unboundCount: number;
  linkDegraded: boolean;
  clearsS3Blocker: false;
  s3Blockers: string[];
  packageHash: string;
  thresholds: typeof PREGATE_THRESHOLDS;
  modelVersion: string;
  inputs: FeedInput[];
  contradictions: string[];
}

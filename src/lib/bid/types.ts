import type { ConfidenceDriver } from '../recommender';
import type { FeedClass, Integrity } from '../../types';
import type { EvidenceQuality, FeedId } from './catalog';
import { V1_THRESHOLDS } from './catalog';

/**
 * One evidence row on a pursuit record. WF-42 / CHR-2285 shape.
 * `source` MUST be a source handle (file path+section, Linear
 * issue/comment ID, or SAM notice ID) — the adapter rejects a feed
 * without a handle (CHR-2280 AC 2).
 */
export interface PursuitEvidence {
  id: string;
  feed: FeedId;
  source: string;
  feedClass?: FeedClass;
  claim: string;
  /** Calendar age in DAYS. Written onto FeedInput.ageMin (see adapter). */
  ageDays: number;
  reliability?: number;
  evidenceQuality?: EvidenceQuality;
  supports: boolean;
  integrity?: Integrity;
}

export interface PursuitException {
  feed: FeedId;
  gap: string;
  resolution: string;
}

export interface HardGate {
  failed: boolean;
  reason: string | null;
  sourceHandle: string | null;
}

/**
 * Pursuit record consumed by the adapter. Extra fields are ignored.
 * Evidence may omit catalog feeds; omissions are recorded, never filled.
 */
export interface PursuitRecord {
  pursuitId: string;
  title: string;
  evidence: PursuitEvidence[];
  contradictions?: string[];
  exceptions?: PursuitException[];
  omitted?: OmittedFeed[];
  hardGate?: HardGate;
}

export interface OmittedFeed {
  feed: FeedId;
  reason: string;
}

export type DispositionClass = 'BID' | 'PURSUE-WITH-EXCEPTIONS' | 'NO-BID';

export interface DispositionThresholds {
  bid: typeof V1_THRESHOLDS.bid;
  pursueFloor: typeof V1_THRESHOLDS.pursueFloor;
  pursueCeiling: typeof V1_THRESHOLDS.pursueCeiling;
  noBidBelow: typeof V1_THRESHOLDS.noBidBelow;
  hardGateOverridesScore: typeof V1_THRESHOLDS.hardGateOverridesScore;
  description: typeof V1_THRESHOLDS.description;
}

export interface DispositionInputSnapshot {
  id: string;
  feed: FeedId;
  source: string;
  feedClass: FeedClass;
  claim: string;
  reliability: number;
  ageDays: number;
  supports: boolean;
  integrity: Integrity;
}

/**
 * Adapter output. DecisionDef scenario fields (correctAction /
 * groundTruth) are sentinel-only on the internal DecisionDef and MUST
 * NOT appear here (spec 3.2 / CHR-2280 AC 7).
 */
export interface Disposition {
  pursuitId: string;
  title: string;
  value: number;
  class: DispositionClass;
  drivers: ConfidenceDriver[];
  contradictions: string[];
  exceptions: PursuitException[];
  omitted: OmittedFeed[];
  linkDegraded: boolean;
  hardGateFailed: boolean;
  hardGate: HardGate;
  thresholds: DispositionThresholds;
  inputs: DispositionInputSnapshot[];
  forensic: ForensicRef;
}

export interface ForensicRef {
  seq: number;
  path: string | null;
  modelVersion: string;
}

export interface ForensicEntry {
  seq: number;
  ts: string;
  pursuitId: string;
  title: string;
  value: number;
  class: DispositionClass;
  drivers: ConfidenceDriver[];
  contradictions: string[];
  exceptions: PursuitException[];
  omitted: OmittedFeed[];
  linkDegraded: boolean;
  hardGate: HardGate;
  thresholds: DispositionThresholds;
  modelVersion: string;
  inputs: DispositionInputSnapshot[];
}

export interface AdapterOptions {
  /** Append-only JSONL path. When omitted, the entry is returned in-memory only. */
  forensicPath?: string;
  modelVersion?: string;
}

export class BidAdapterError extends Error {
  readonly code = 'UNKNOWN' as const;
  constructor(message: string) {
    super(message);
    this.name = 'BidAdapterError';
  }
}

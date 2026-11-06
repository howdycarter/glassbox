export {
  BID_THRESHOLD,
  FEED_CATALOG,
  FEED_CLASS_BY_ID,
  FEED_IDS,
  PURSUE_CEILING,
  PURSUE_FLOOR,
  RELIABILITY,
  V1_THRESHOLDS,
  isFeedId,
  qualityForReliability,
  reliabilityForQuality,
  type EvidenceQuality,
  type FeedId,
} from './catalog';

export {
  BidAdapterError,
  type AdapterOptions,
  type Disposition,
  type DispositionClass,
  type DispositionInputSnapshot,
  type ForensicEntry,
  type ForensicRef,
  type HardGate,
  type OmittedFeed,
  type PursuitEvidence,
  type PursuitException,
  type PursuitRecord,
} from './types';

export { isSourceHandle, validatePursuitRecord } from './validate';

export {
  SENTINEL_CORRECT_ACTION,
  SENTINEL_GROUND_TRUTH,
  buildDecisionDef,
  classifyDisposition,
  scorePursuit,
  sensorEvidenceIsSummaryOnly,
} from './adapter';

export { appendForensicEntry, nextForensicSeq } from './forensic';

export { handleDispositionRequest, parseRequestBody, type DispositionHttpResult } from './handler';

export {
  CLAIM_KINDS,
  FINDING_PENALTY,
  PREGATE_THRESHOLDS,
  S3_COMPLEMENT_NOTE,
  UNBOUND_RECORD_VALUE,
  buildPregateDecisionDef,
  checkClaims,
  extractLoadBearingClaims,
  formatFindingLine,
  hashPackage,
  parsePackageFromMarkdown,
  runPregatePass,
  type CanonEntry,
  type ClaimCheck,
  type ExtractedClaim,
  type PregateFinding,
  type PregateInput,
  type PregatePackage,
  type PregateReport,
} from './pregate';

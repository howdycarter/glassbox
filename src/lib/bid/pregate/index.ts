export {
  CLAIM_KINDS,
  FINDING_PENALTY,
  PREGATE_THRESHOLDS,
  S3_COMPLEMENT_NOTE,
  UNBOUND_RECORD_VALUE,
  type CanonEntry,
  type CanonExclusion,
  type CanonFact,
  type ClaimCheck,
  type ClaimKind,
  type ClaimStatus,
  type DraftLocation,
  type ExtractedClaim,
  type FindingKind,
  type IdentifierType,
  type PregateFinding,
  type PregateForensicEntry,
  type PregateInput,
  type PregatePackage,
  type PregateReport,
  type PregateSection,
} from './types';

export {
  collapseWs,
  kindsCompatible,
  normalizeClaim,
  normalizeDate,
  normalizeIdentifier,
  normalizeMoney,
  normalizePercent,
  normalizeQualifier,
  parseMoneyAmount,
  qualifiersCompatible,
  valuesEqual,
} from './normalize';

export { extractLoadBearingClaims, parsePackageFromMarkdown, parsePackageText } from './extract';

export { checkClaims, formatFindingLine, validateCanon } from './check';

export { buildPregateDecisionDef, hashPackage, runPregatePass } from './pass';

export {
  KIND_SWEEP_CANON,
  KIND_SWEEP_PACKAGE,
  QUALIFIER_CANON,
  QUALIFIER_PACKAGE,
  SUMMARY_ONLY_INPUT,
  SUMMARY_ONLY_RECORD,
  WORKED_EXAMPLE_CANON,
  WORKED_EXAMPLE_INPUT,
  WORKED_EXAMPLE_MARKDOWN,
  WORKED_EXAMPLE_PACKAGE,
  WORKED_EXAMPLE_S3_BLOCKERS,
} from './fixtures';

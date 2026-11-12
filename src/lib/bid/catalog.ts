import type { FeedClass } from '../../types';

/* ------------------------------------------------------------------ */
/* Bid-disposition catalog (Phase 1 adapter). Spec §4 as recorded in  */
/* CHR-2280 / CHR-2278 — v1 calibration constants.                    */
/*                                                                    */
/* The engine (recommender.ts) is called UNCHANGED. This file only    */
/* names the bid-side mapping onto that engine.                       */
/* ------------------------------------------------------------------ */

/**
 * Spec 4.5 / CHR-2278: classification thresholds recorded on every
 * forensic entry as the v1 calibration constants used.
 *
 *   BID                      score >= 65 and no exceptions
 *   PURSUE-WITH-EXCEPTIONS   score 45–64, or score >= 65 with exceptions
 *   NO-BID                   score < 45
 *   hard gate                unmet + unwaivable/unfixable disqualifier
 *                            → NO-BID regardless of score
 */
export const BID_THRESHOLD = 65;
export const PURSUE_FLOOR = 45;
export const PURSUE_CEILING = 64;

export const V1_THRESHOLDS = {
  bid: BID_THRESHOLD,
  pursueFloor: PURSUE_FLOOR,
  pursueCeiling: PURSUE_CEILING,
  noBidBelow: PURSUE_FLOOR,
  hardGateOverridesScore: true,
  description:
    'BID >=65 with no exceptions; PURSUE-WITH-EXCEPTIONS 45-64 or >=65 with exceptions; NO-BID <45; unmet unwaivable/unfixable disqualifier -> NO-BID regardless of score',
} as const;

/**
 * Spec 4.3 — reliability by evidence quality.
 * firsthand primary 0.9–1.0; record card 0.8; reported/summary 0.5; title-only 0.3.
 */
export const RELIABILITY = {
  firsthandMin: 0.9,
  firsthandMax: 1.0,
  recordCard: 0.8,
  reported: 0.5,
  titleOnly: 0.3,
} as const;

export type EvidenceQuality =
  | 'firsthand-primary'
  | 'record-card'
  | 'reported-summary'
  | 'title-only';

/**
 * Spec 4.2 — nine evidence feeds; each one FeedInput when present.
 * Spec 4.1 — feed-class mapping:
 *   sensor    = solicitation evidence
 *   sigint    = market signals
 *   blueforce = firm-internal records
 *   link      = channel/posture state
 *
 * A missing catalog feed is omitted and recorded — never fabricated
 * (CHR-2282 / spec §7 step 2).
 */
export const FEED_IDS = [
  'requirement-clarity',
  'deadline-realism',
  'field-density',
  'price-posture',
  'buyer-signals',
  'capability-match',
  'past-performance',
  'insurance-posture',
  'channel-viability',
] as const;

export type FeedId = (typeof FEED_IDS)[number];

export interface FeedCatalogEntry {
  id: FeedId;
  feedClass: FeedClass;
  /** Spec 4.1 class role, for operators reading a disposition. */
  role: string;
}

export const FEED_CATALOG: readonly FeedCatalogEntry[] = [
  { id: 'requirement-clarity', feedClass: 'sensor', role: 'solicitation evidence' },
  { id: 'deadline-realism', feedClass: 'sensor', role: 'solicitation evidence' },
  { id: 'field-density', feedClass: 'sigint', role: 'market signals' },
  { id: 'price-posture', feedClass: 'sigint', role: 'market signals' },
  { id: 'buyer-signals', feedClass: 'sigint', role: 'market signals' },
  { id: 'capability-match', feedClass: 'blueforce', role: 'firm-internal records' },
  { id: 'past-performance', feedClass: 'blueforce', role: 'firm-internal records' },
  { id: 'insurance-posture', feedClass: 'link', role: 'channel/posture state' },
  { id: 'channel-viability', feedClass: 'link', role: 'channel/posture state' },
] as const;

export const FEED_CLASS_BY_ID: Record<FeedId, FeedClass> = {
  'requirement-clarity': 'sensor',
  'deadline-realism': 'sensor',
  'field-density': 'sigint',
  'price-posture': 'sigint',
  'buyer-signals': 'sigint',
  'capability-match': 'blueforce',
  'past-performance': 'blueforce',
  'insurance-posture': 'link',
  'channel-viability': 'link',
};

export function isFeedId(value: string): value is FeedId {
  return (FEED_IDS as readonly string[]).includes(value);
}

export function reliabilityForQuality(quality: EvidenceQuality): number {
  switch (quality) {
    case 'firsthand-primary':
      return 0.95;
    case 'record-card':
      return RELIABILITY.recordCard;
    case 'reported-summary':
      return RELIABILITY.reported;
    case 'title-only':
      return RELIABILITY.titleOnly;
    default: {
      const exhaustive: never = quality;
      throw new Error(`unhandled evidence quality: ${String(exhaustive)}`);
    }
  }
}

export function qualityForReliability(reliability: number): EvidenceQuality | null {
  if (reliability >= RELIABILITY.firsthandMin && reliability <= RELIABILITY.firsthandMax) {
    return 'firsthand-primary';
  }
  if (Math.abs(reliability - RELIABILITY.recordCard) < 1e-9) return 'record-card';
  if (Math.abs(reliability - RELIABILITY.reported) < 1e-9) return 'reported-summary';
  if (Math.abs(reliability - RELIABILITY.titleOnly) < 1e-9) return 'title-only';
  return null;
}

/** Sensor/solicitation evidence at reported/summary or title-only. Spec 4.3. */
export function isSummaryOrWeaker(reliability: number): boolean {
  const quality = qualityForReliability(reliability);
  return quality === 'reported-summary' || quality === 'title-only';
}

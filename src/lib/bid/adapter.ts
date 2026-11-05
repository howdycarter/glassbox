import type { DecisionDef, FeedInput } from '../../types';
import { computeConfidence, type ConfidenceResult } from '../recommender';
import {
  BID_THRESHOLD,
  FEED_IDS,
  PURSUE_FLOOR,
  V1_THRESHOLDS,
  isSummaryOrWeaker,
  type FeedId,
} from './catalog';
import {
  BidAdapterError,
  type AdapterOptions,
  type Disposition,
  type DispositionClass,
  type DispositionInputSnapshot,
  type HardGate,
  type OmittedFeed,
  type PursuitException,
  type PursuitRecord,
} from './types';
import { resolvedFeedClass, resolvedReliability, validatePursuitRecord } from './validate';
import { appendForensicEntry, nextForensicSeq } from './forensic';

/**
 * Spec 3.2 / CHR-2280 AC 7 — DecisionDef.correctAction and
 * DecisionDef.groundTruth are required by the engine type but are
 * scenario-vignette sentinels. They are set on the INTERNAL DecisionDef
 * so computeConfidence can be called unchanged, and MUST never appear
 * on any adapter output (disposition, forensic entry, HTTP body).
 */
export const SENTINEL_CORRECT_ACTION = 'accept' as const;
export const SENTINEL_GROUND_TRUTH = 'BID_ADAPTER_SENTINEL_groundTruth_DO_NOT_SURFACE';

const DEFAULT_OMIT_REASON =
  'no evidence assembled this run — omitted, never fabricated (spec §7 step 2)';

/**
 * Spec 4.4 — Age is fed in DAYS onto the engine freshness curve.
 *
 * computeConfidence reads FeedInput.ageMin. That field is named in
 * scenario-minutes because the C2 vignette clock is minutes; the
 * freshness buckets themselves are unit-agnostic:
 *
 *   ageMin <= 2  → 1.0
 *   ageMin <= 5  → 0.8
 *   ageMin <= 9  → 0.55
 *   else         → 0.3
 *
 * The bid adapter writes calendar DAYS into ageMin so a 3-day-old
 * record card is freshness 0.8, a 10-day-old feed is 0.3, etc.
 * claimedAgeMin is unused: it is never set, so believed age === actual
 * age (no spoofed-freshness path on the bid adapter).
 */
function ageDaysToEngineAgeMin(ageDays: number): number {
  return ageDays;
}

/**
 * Spec 4 / degraded-evidence rule: summary-only (or title-only)
 * solicitation evidence sets DecisionDef.linkDegraded = true, which
 * applies the engine's DEGRADED_PENALTY (16) and DEGRADED_CAP (60).
 *
 * "Summary-only evidence base" is evaluated on SENSOR feeds
 * (solicitation evidence). Firm-internal / market / posture feeds at
 * record-card quality do not keep the link healthy if the notice
 * itself was only read as a draft/summary. If every present sensor
 * feed is reported/summary (0.5) or title-only (0.3), the link is
 * degraded. Omitted sensors (no solicitation row at all) are not a
 * summary base — they are omissions.
 */
export function sensorEvidenceIsSummaryOnly(inputs: FeedInput[]): boolean {
  const sensors = inputs.filter((i) => i.feedClass === 'sensor');
  if (sensors.length === 0) return false;
  return sensors.every((s) => isSummaryOrWeaker(s.reliability));
}

function defaultHardGate(): HardGate {
  return { failed: false, reason: null, sourceHandle: null };
}

function omittedFeeds(present: Iterable<FeedId>, provided?: OmittedFeed[]): OmittedFeed[] {
  const have = new Set(present);
  const fromRecord = new Map((provided ?? []).map((o) => [o.feed, o]));
  const out: OmittedFeed[] = [];
  for (const id of FEED_IDS) {
    if (have.has(id)) continue;
    out.push(fromRecord.get(id) ?? { feed: id, reason: DEFAULT_OMIT_REASON });
  }
  return out;
}

function toSnapshot(item: {
  id: string;
  feed: FeedId;
  source: string;
  feedClass: FeedInput['feedClass'];
  claim: string;
  reliability: number;
  ageDays: number;
  supports: boolean;
  integrity: FeedInput['integrity'];
}): DispositionInputSnapshot {
  return {
    id: item.id,
    feed: item.feed,
    source: item.source,
    feedClass: item.feedClass,
    claim: item.claim,
    reliability: item.reliability,
    ageDays: item.ageDays,
    supports: item.supports,
    integrity: item.integrity,
  };
}

/** Build the engine DecisionDef. Public for adapter tests; not an output. */
export function buildDecisionDef(record: PursuitRecord): DecisionDef {
  const inputs: FeedInput[] = record.evidence.map((item) => {
    const reliability = resolvedReliability(item);
    const feedClass = resolvedFeedClass(item);
    const input: FeedInput = {
      id: item.id,
      source: item.source,
      feedClass,
      claim: item.claim,
      ageMin: ageDaysToEngineAgeMin(item.ageDays),
      reliability,
      supports: item.supports,
      integrity: item.integrity ?? 'ok',
    };
    // claimedAgeMin deliberately omitted (spec 4.4).
    return input;
  });

  const reasoning = record.evidence.map((item) => `${item.feed}: ${item.claim} (${item.source})`);

  const def: DecisionDef = {
    id: `bid:${record.pursuitId}`,
    title: record.title,
    recommendation:
      'Scored pursuit disposition — decision support for Chris\'s bid/no-bid ruling, never an auto-decision.',
    reasoning,
    inputs,
    contradictions: record.contradictions ?? [],
    linkDegraded: sensorEvidenceIsSummaryOnly(inputs),
    correctAction: SENTINEL_CORRECT_ACTION,
    groundTruth: SENTINEL_GROUND_TRUTH,
    onAccept: [],
    onOverride: [],
    overrideReasons: [],
  };
  return def;
}

export function classifyDisposition(
  value: number,
  exceptions: readonly PursuitException[],
  hardGateFailed: boolean,
): DispositionClass {
  if (hardGateFailed) return 'NO-BID';
  if (value < PURSUE_FLOOR) return 'NO-BID';
  if (value >= BID_THRESHOLD && exceptions.length === 0) return 'BID';
  return 'PURSUE-WITH-EXCEPTIONS';
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

export function scorePursuit(raw: unknown, options: AdapterOptions = {}): Disposition {
  const record = validatePursuitRecord(raw);
  const def = buildDecisionDef(record);
  const scored: ConfidenceResult = computeConfidence(def);
  const hardGate = record.hardGate ?? defaultHardGate();
  const exceptions = record.exceptions ?? [];
  const klass = classifyDisposition(scored.value, exceptions, hardGate.failed);
  const snapshots = record.evidence.map((item) =>
    toSnapshot({
      id: item.id,
      feed: item.feed,
      source: item.source,
      feedClass: resolvedFeedClass(item),
      claim: item.claim,
      reliability: resolvedReliability(item),
      ageDays: item.ageDays,
      supports: item.supports,
      integrity: item.integrity ?? 'ok',
    }),
  );
  const omitted = omittedFeeds(
    record.evidence.map((e) => e.feed),
    record.omitted,
  );
  const modelVersion = options.modelVersion ?? 'unknown';
  const seq = nextForensicSeq(options.forensicPath);
  const disposition: Disposition = {
    pursuitId: record.pursuitId,
    title: record.title,
    value: scored.value,
    class: klass,
    drivers: scored.drivers,
    contradictions: record.contradictions ?? [],
    exceptions,
    omitted,
    linkDegraded: def.linkDegraded === true,
    hardGateFailed: hardGate.failed,
    hardGate,
    thresholds: {
      bid: V1_THRESHOLDS.bid,
      pursueFloor: V1_THRESHOLDS.pursueFloor,
      pursueCeiling: V1_THRESHOLDS.pursueCeiling,
      noBidBelow: V1_THRESHOLDS.noBidBelow,
      hardGateOverridesScore: V1_THRESHOLDS.hardGateOverridesScore,
      description: V1_THRESHOLDS.description,
    },
    inputs: snapshots,
    forensic: {
      seq,
      path: options.forensicPath ?? null,
      modelVersion,
    },
  };
  assertNoSentinelLeak(disposition);
  appendForensicEntry(options.forensicPath, {
    seq,
    ts: new Date().toISOString(),
    pursuitId: disposition.pursuitId,
    title: disposition.title,
    value: disposition.value,
    class: disposition.class,
    drivers: disposition.drivers,
    contradictions: disposition.contradictions,
    exceptions: disposition.exceptions,
    omitted: disposition.omitted,
    linkDegraded: disposition.linkDegraded,
    hardGate: disposition.hardGate,
    thresholds: disposition.thresholds,
    modelVersion,
    inputs: disposition.inputs,
  });
  assertNoSentinelLeak(disposition.forensic);
  return disposition;
}

import type {
  FactorKey,
  FactorWeights,
  FeedClass,
  FeedWeights,
  PriorityWeights,
  TrackState,
} from '../types';

/* ------------------------------------------------------------------ */
/* Prioritization Assistant (v2): visible, operator-re-weightable      */
/* scoring. Two surfaces, one principle — the arithmetic is shown:     */
/*                                                                     */
/* 1. Feed weights scale each class of evidence in the recommender's  */
/*    confidence model (see recommender.ts). At the defaults (all     */
/*    ×1.00) the model is exactly the v1 model.                        */
/*                                                                     */
/* 2. Track attention scores rank the visible tracks by four factors  */
/*    the operator can re-weight: threat, proximity, uncertainty,     */
/*    staleness. Each factor's raw value is a deterministic function   */
/*    of track state — no randomness, no hidden state.                 */
/* ------------------------------------------------------------------ */

export const WEIGHT_MIN = 0;
export const WEIGHT_MAX = 2;
export const WEIGHT_STEP = 0.25;

export const DEFAULT_FEED_WEIGHTS: FeedWeights = {
  sensor: 1,
  sigint: 1,
  blueforce: 1,
  link: 1,
};

export const DEFAULT_FACTOR_WEIGHTS: FactorWeights = {
  threat: 1,
  proximity: 1,
  uncertainty: 1,
  staleness: 1,
};

export const DEFAULT_WEIGHTS: PriorityWeights = {
  feeds: { ...DEFAULT_FEED_WEIGHTS },
  factors: { ...DEFAULT_FACTOR_WEIGHTS },
};

export const FEED_LABELS: Record<FeedClass, string> = {
  sensor: 'Sensor feeds (EO/IR, radar)',
  sigint: 'SIGINT',
  blueforce: 'Blue-force reports (relay, voice)',
  link: 'Link / system monitors',
};

export const FACTOR_LABELS: Record<FactorKey, string> = {
  threat: 'Threat',
  proximity: 'Proximity to forces at risk',
  uncertainty: 'Identification uncertainty',
  staleness: 'Data staleness',
};

export function fmtWeight(w: number): string {
  return `×${w.toFixed(2)}`;
}

function weightsEqual(a: PriorityWeights, b: PriorityWeights): boolean {
  return (
    (Object.keys(a.feeds) as FeedClass[]).every((k) => a.feeds[k] === b.feeds[k]) &&
    (Object.keys(a.factors) as FactorKey[]).every((k) => a.factors[k] === b.factors[k])
  );
}
export { weightsEqual };

/** Human-readable list of what changed between two weight sets — used for
    the forensic log entry when the operator commits a re-weighting. */
export function describeWeightChanges(prev: PriorityWeights, next: PriorityWeights): string[] {
  const changes: string[] = [];
  for (const k of Object.keys(next.feeds) as FeedClass[]) {
    if (prev.feeds[k] !== next.feeds[k]) {
      changes.push(`feed ${FEED_LABELS[k]} ${fmtWeight(prev.feeds[k])} → ${fmtWeight(next.feeds[k])}`);
    }
  }
  for (const k of Object.keys(next.factors) as FactorKey[]) {
    if (prev.factors[k] !== next.factors[k]) {
      changes.push(
        `track factor ${FACTOR_LABELS[k]} ${fmtWeight(prev.factors[k])} → ${fmtWeight(next.factors[k])}`,
      );
    }
  }
  return changes;
}

/* ------------------------- track scoring ------------------------- */

/** Diagonal of the 100×70 situation grid — the proximity normalizer. */
const GRID_DIAGONAL = Math.hypot(100, 70);

function threatRaw(t: TrackState): number {
  if (t.affiliation === 'friendly') return 0;
  if (t.affiliation === 'unknown') return 50;
  // hostile
  return t.kind.toLowerCase().includes('air-defense') ? 100 : 85;
}

function proximityRaw(t: TrackState, all: TrackState[]): number {
  // For a non-friendly track: distance to the nearest friendly it threatens.
  // For a friendly track: distance to the nearest non-friendly threatening it.
  const counterparts = all.filter((o) =>
    t.affiliation === 'friendly' ? o.affiliation !== 'friendly' : o.affiliation === 'friendly',
  );
  if (counterparts.length === 0) return 0;
  let best = Infinity;
  for (const o of counterparts) {
    best = Math.min(best, Math.hypot(t.x - o.x, t.y - o.y));
  }
  return Math.max(0, Math.min(100, Math.round(100 * (1 - best / GRID_DIAGONAL))));
}

function uncertaintyRaw(t: TrackState): number {
  if (t.affiliation === 'unknown') return t.stale ? 100 : 90;
  if (t.affiliation === 'hostile') return 25;
  return 5;
}

function stalenessRaw(t: TrackState): number {
  return t.stale ? 100 : 0;
}

export interface FactorScore {
  key: FactorKey;
  label: string;
  raw: number;
  weight: number;
}

export interface TrackScore {
  trackId: string;
  label: string;
  affiliation: TrackState['affiliation'];
  total: number;
  factors: FactorScore[];
}

/** Rank the visible tracks by weighted attention score, highest first.
    Deterministic: ties break on track label. */
export function scoreTracks(
  tracks: Record<string, TrackState>,
  weights: FactorWeights,
): TrackScore[] {
  const all = Object.values(tracks).filter((t) => t.visible);
  const weightSum =
    weights.threat + weights.proximity + weights.uncertainty + weights.staleness;

  const scored = all.map((t) => {
    const raws: Record<FactorKey, number> = {
      threat: threatRaw(t),
      proximity: proximityRaw(t, all),
      uncertainty: uncertaintyRaw(t),
      staleness: stalenessRaw(t),
    };
    const factors: FactorScore[] = (Object.keys(raws) as FactorKey[]).map((key) => ({
      key,
      label: FACTOR_LABELS[key],
      raw: raws[key],
      weight: weights[key],
    }));
    const total =
      weightSum === 0
        ? 0
        : Math.round(
            factors.reduce((acc, f) => acc + f.raw * f.weight, 0) / weightSum,
          );
    return {
      trackId: t.id,
      label: t.label,
      affiliation: t.affiliation,
      total,
      factors,
    };
  });

  return scored.sort((a, b) => b.total - a.total || a.label.localeCompare(b.label));
}

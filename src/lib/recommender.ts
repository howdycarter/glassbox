import type { DecisionDef, FeedWeights } from '../types';
import { DEFAULT_FEED_WEIGHTS, fmtWeight } from './prioritization';

/* ------------------------------------------------------------------ */
/* The recommender: transparent, deterministic rules over scenario     */
/* state. No LLM, no randomness, no hidden state — the arithmetic is   */
/* part of the exhibit, and the UI shows every driver.                 */
/*                                                                     */
/*   confidence = BASE                                                 */
/*     + Σ input contributions (supporting +, opposing −)               */
/*     + standing-rule weight, when a rule is invoked                  */
/*     − contradiction penalty, per surfaced conflict                  */
/*     − degraded-link penalty, capped while the link is degraded    */
/*                                                                     */
/* An input's contribution = reliability × freshness × WEIGHT, where   */
/* freshness decays with the age the fusion rules *believed*           */
/* (claimedAgeMin when present). The provenance strip always displays  */
/* the actual age — in DP-3 that gap between believed and actual age   */
/* is exactly what a vigilant operator is meant to catch.              */
/* ------------------------------------------------------------------ */

export const BASE = 50;
export const WEIGHT = 12;
export const CONTRADICTION_PENALTY = 4;
export const DEGRADED_PENALTY = 16;
export const DEGRADED_CAP = 60;

export function freshness(ageMin: number): number {
  if (ageMin <= 2) return 1;
  if (ageMin <= 5) return 0.8;
  if (ageMin <= 9) return 0.55;
  return 0.3;
}

export interface ConfidenceDriver {
  label: string;
  delta: number;
}

export interface ConfidenceResult {
  value: number;
  drivers: ConfidenceDriver[];
}

/**
 * Score a decision's confidence. The optional feed weights are the
 * Prioritization Assistant's (v2): each input's contribution is scaled by
 * the operator's weight for that input's feed class. Standing-rule weight,
 * contradiction penalties, and the degraded-link discount are NOT scaled —
 * they are properties of the rules, not of the evidence. At the default
 * weights (all ×1.00) this is exactly the v1 model.
 */
export function computeConfidence(
  d: DecisionDef,
  feedWeights: FeedWeights = DEFAULT_FEED_WEIGHTS,
): ConfidenceResult {
  const drivers: ConfidenceDriver[] = [{ label: 'Base rate (no inputs)', delta: BASE }];
  let total = BASE;

  for (const input of d.inputs) {
    const believedAge = input.claimedAgeMin ?? input.ageMin;
    const w = feedWeights[input.feedClass];
    const contribution = Math.round(input.reliability * freshness(believedAge) * WEIGHT * w);
    const signed = input.supports ? contribution : -contribution;
    total += signed;
    drivers.push({
      label: `${input.supports ? 'Supports' : 'Opposes'} — ${input.source} (reliability ${input.reliability.toFixed(2)}, believed age ${believedAge} min${w !== 1 ? `, feed weight ${fmtWeight(w)}` : ''})`,
      delta: signed,
    });
  }

  if (d.ruleApplied) {
    total += d.ruleApplied.weight;
    drivers.push({ label: `Rule — ${d.ruleApplied.label}`, delta: d.ruleApplied.weight });
  }

  const conflicts = d.contradictions?.length ?? 0;
  if (conflicts > 0) {
    const penalty = -CONTRADICTION_PENALTY * conflicts;
    total += penalty;
    drivers.push({ label: `Contradiction penalty — ${conflicts} surfaced conflict${conflicts > 1 ? 's' : ''}`, delta: penalty });
  }

  if (d.linkDegraded) {
    total -= DEGRADED_PENALTY;
    drivers.push({ label: 'Degraded link — inputs stale, confidence discounted', delta: -DEGRADED_PENALTY });
    if (total > DEGRADED_CAP) {
      drivers.push({ label: `Degraded cap — confidence held at or below ${DEGRADED_CAP}`, delta: DEGRADED_CAP - total });
      total = DEGRADED_CAP;
    }
  }

  const value = Math.max(5, Math.min(97, total));
  return { value, drivers };
}

/** Shares of decisions in the scenario where accepting the recommendation
    was the correct action — the system's actual reliability for this run. */
export function systemReliability(decisions: DecisionDef[]): number {
  if (decisions.length === 0) return 0;
  const acceptCorrect = decisions.filter((d) => d.correctAction === 'accept').length;
  return Math.round((acceptCorrect / decisions.length) * 100);
}

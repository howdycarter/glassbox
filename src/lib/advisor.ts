import type {
  AdvisorExchange,
  AdvisorMode,
  AdvisorOutput,
  AdvisorSource,
  DecisionDef,
  ScenarioDef,
} from '../types';
import { ADVISOR_CACHE } from '../data/advisor-cache';

/* Model Advisor service — the additive second voice.
 *
 * THE RULE (integration plan): the deterministic core stays the
 * scored reference. The Advisor never replaces, overrides, re-scores,
 * or silently edits the core's recommendation, confidence, or debrief.
 * This module only *produces* Advisor output; scoring lives in the
 * engine/debrief and reads the core exactly as before.
 *
 * Sources, after the failure ladder:
 * - Live: a Meta Model API response. Requires VITE_META_MODEL_API_KEY
 *   (created by the entrant at dev.meta.ai; never committed, never in
 *   this repo). The live call shape is verified in the build-window
 *   spike — until then, and on ANY live failure (no key, quota,
 *   network), the ladder degrades to the authored cache, disclosed.
 * - Cached: src/data/advisor-cache.ts — hand-authored outputs, labeled
 *   as cached everywhere they render. Never present one as live.
 * - Deterministic mode: no Advisor at all — the v4 core-only baseline.
 */

/** Model the Advisor targets (Meta Model API). Config-level fact: the
    primary is Muse Spark; Muse Wonder is the documented alternate —
    one config switch, same output contract. */
export const ADVISOR_MODEL = 'Muse Spark (Meta Model API)';

export const ADVISOR_MODE_LABEL: Record<AdvisorMode, string> = {
  live: 'Live Model',
  cached: 'Cached',
  deterministic: 'Deterministic',
};

/** Is a live API key present in this build's environment? */
export function liveKeyConfigured(): boolean {
  const key = import.meta.env?.VITE_META_MODEL_API_KEY as string | undefined;
  return typeof key === 'string' && key.trim().length > 0;
}

/**
 * Resolve the effective source for a mode. Deterministic → null (the
 * Advisor is silent). Every other mode serves the cache in THIS build:
 * the verified live call lands in the build-window spike, and until a
 * real API response exists, no output may be labeled 'live' — serving
 * the cache under a live label is exactly the failure the honesty
 * rules exist to prevent. When the spike wires the real call, this
 * function returns 'live' for Live mode with a key configured, and
 * the ladder keeps degrading to 'cached' on any live failure.
 */
export function effectiveSource(mode: AdvisorMode): AdvisorSource | null {
  if (mode === 'deterministic') return null;
  return 'cached';
}

/** Cache key for a decision point. */
export function advisorKey(scenarioId: string, decisionId: string): string {
  return `${scenarioId}:${decisionId}`;
}

/**
 * The exact prompt the live integration sends for a decision point —
 * built from scenario state. Built and forensically logged in every
 * mode that shows the Advisor, so the cached demo exercises the same
 * contract the live call will use.
 */
export function buildAdvisorPrompt(scenario: ScenarioDef, decision: DecisionDef): string {
  const inputs = decision.inputs
    .map(
      (i) =>
        `- [${i.id}] ${i.source} (${i.feedClass}): "${i.claim}" — actual age ${i.ageMin} min` +
        `${i.claimedAgeMin !== undefined && i.claimedAgeMin !== i.ageMin ? ` (header claims ${i.claimedAgeMin} min)` : ''}` +
        `, reliability ${i.reliability.toFixed(2)}, ${i.supports ? 'supports' : 'opposes'} the recommendation, integrity ${i.integrity}`,
    )
    .join('\n');
  const contradictions =
    decision.contradictions && decision.contradictions.length > 0
      ? `\nSurfaced contradictions:\n${decision.contradictions.map((c) => `- ${c}`).join('\n')}`
      : '';
  return [
    `You are the Model Advisor in Glass-Box, a trust-measurement system for human-AI teams. A deterministic recommender has issued the recommendation below. Give a second, independent read. You are advisory only: you never change the recommendation of record.`,
    `Scenario: ${scenario.title} — ${scenario.subtitle}`,
    `Decision ${decision.id}: ${decision.title}`,
    `Core recommendation: ${decision.recommendation}`,
    decision.alternateCoa ? `Alternate COA on the table: ${decision.alternateCoa}` : '',
    `Key inputs:\n${inputs}${contradictions}`,
    decision.ruleApplied
      ? `Standing rule applied by the core: ${decision.ruleApplied.label} (weight ${decision.ruleApplied.weight}).`
      : '',
    `Respond with exactly: a verdict (concur / lean-alternate / disagree), a one-line headline, reasoning bullets, a confidence read, and provenance citations by input id.`,
  ]
    .filter((line) => line !== '')
    .join('\n');
}

/** Serialize an Advisor output the way the forensic log stores a raw response. */
export function serializeAdvisorResponse(output: AdvisorOutput, source: AdvisorSource): string {
  const header =
    source === 'cached'
      ? '[CACHED ADVISOR OUTPUT — authored fallback, not a live model response]'
      : '[LIVE MODEL RESPONSE]';
  return [
    header,
    `Verdict: ${output.verdict} — ${output.headline}`,
    ...output.reasoning.map((r) => `• ${r}`),
    `Confidence read: ${output.confidenceRead}`,
    `Provenance citations: ${output.citations.join(', ')}`,
    `Agrees with core: ${output.agreesWithCore ? 'yes' : 'no'}`,
  ].join('\n');
}

/**
 * The Advisor exchange for a decision point under a mode, or null when
 * the Advisor is silent (Deterministic) or no output exists. Cached
 * coverage is complete for both shipped vignettes (10 of 10); a miss
 * returns null rather than a fabricated output.
 */
export function getAdvisorExchange(
  mode: AdvisorMode,
  scenario: ScenarioDef,
  decision: DecisionDef,
): AdvisorExchange | null {
  const source = effectiveSource(mode);
  if (!source) return null;
  const key = advisorKey(scenario.id, decision.id);
  const output = ADVISOR_CACHE[key];
  if (!output) return null;
  return { key, scenarioId: scenario.id, decisionId: decision.id, source, model: ADVISOR_MODEL, output };
}

/** Advisor agreement rate over resolved records (debrief's second score). */
export function advisorAgreement(records: { advisorAgrees: boolean | null }[]): {
  agreed: number;
  total: number;
  rate: number | null;
} {
  const scored = records.filter((r) => r.advisorAgrees !== null);
  const agreed = scored.filter((r) => r.advisorAgrees).length;
  return {
    agreed,
    total: scored.length,
    rate: scored.length > 0 ? Math.round((agreed / scored.length) * 100) : null,
  };
}

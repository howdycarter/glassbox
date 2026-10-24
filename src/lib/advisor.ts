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
 *   this repo). The live client lives in src/lib/advisor-live.ts,
 *   implemented against the documented API shape (assumptions flagged
 *   UNVERIFIED there) — the build-window spike verifies it against the
 *   real API with the entrant's key. On ANY live failure (no key,
 *   quota, network, unparsable response), the ladder degrades to the
 *   authored cache, disclosed.
 * - Cached: src/data/advisor-cache.ts — hand-authored outputs, labeled
 *   as cached everywhere they render. Never present one as live.
 * - Deterministic mode: no Advisor at all — the v4 core-only baseline.
 */

/** Model the Advisor targets (Meta Model API). Config-level fact: the
    primary is Muse Spark; Muse Wonder is the documented alternate —
    one config switch, same output contract. ADVISOR_MODEL is the
    display name rendered in the UI and the forensic log; ADVISOR_MODEL_ID
    is the identifier sent in the live request body.
    UNVERIFIED: the exact API model-id string is secondary-sourced
    (event/docs material, Oct 2026) and is confirmed at the Day-1 spike —
    it is a one-line config change if the portal disagrees. */
export const ADVISOR_MODEL = 'Muse Spark (Meta Model API)';
export const ADVISOR_MODEL_ID = 'muse-spark';

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
 * Resolve the effective source for a mode on the SYNCHRONOUS path (the
 * engine consumes this at decision-issue time, so in-flight UI state
 * never waits on the network). Deterministic → null (the Advisor is
 * silent). Every other mode serves the cache here: until a real,
 * keyed API response exists, no output may be labeled 'live' — serving
 * the cache under a live label is exactly the failure the honesty
 * rules exist to prevent. The asynchronous ladder — live attempt
 * first, cache on any failure — is resolveAdvisorExchange in
 * src/lib/advisor-live.ts; the Day-1 spike swaps the engine's
 * decision-issue call site to it once the API shape is verified.
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
    /* The response contract — the exact labeled format the live parser
       in src/lib/advisor-live.ts consumes. The cached demo logs this
       same prompt, so the contract the spike exercises is the contract
       already on the record. */
    [
      'Respond in exactly this labeled format, with no preamble:',
      'Verdict: <concur | lean-alternate | disagree>',
      'Headline: <one line>',
      'Reasoning:',
      '- <one bullet per line>',
      'Confidence read: <one line>',
      'Citations: <comma-separated input ids from the list above>',
      'Agrees with core: <yes | no>',
    ].join('\n'),
  ]
    .filter((line) => line !== '')
    .join('\n');
}

/** Serialize an Advisor output the way the forensic log stores a raw
    response — in the same labeled contract buildAdvisorPrompt requests
    from the live model, so cached and live raw responses read alike. */
export function serializeAdvisorResponse(output: AdvisorOutput, source: AdvisorSource): string {
  const header =
    source === 'cached'
      ? '[CACHED ADVISOR OUTPUT — authored fallback, not a live model response]'
      : '[LIVE MODEL RESPONSE]';
  return [
    header,
    `Verdict: ${output.verdict}`,
    `Headline: ${output.headline}`,
    'Reasoning:',
    ...output.reasoning.map((r) => `- ${r}`),
    `Confidence read: ${output.confidenceRead}`,
    `Citations: ${output.citations.join(', ')}`,
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

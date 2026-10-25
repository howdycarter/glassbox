/* Day-1 spike smoke check — ONE real keyed call through the live
 * ladder (resolveAdvisorExchange) to verify the documented Meta
 * Model API shape (assumptions A1–A4, src/lib/advisor-live.ts)
 * before the demo depends on it. This is the only script in the
 * repo that touches the real network, and only when a key is
 * present in the environment.
 *
 * Usage (the key comes from the environment — never a repo file):
 *   META_MODEL_API_KEY=<key> npm run smoke:live
 *
 * Optional probes for when the portal disagrees with the documented
 * shape — alternate shapes with zero code edits:
 *   META_MODEL_API_BASE_URL=https://…   A1: alternate base URL
 *   META_MODEL_ID=…                     A4: alternate model id
 *   META_SMOKE_DECISION=DP1             decision point to ask about
 *
 * Exit codes:
 *   0  a live reply was received AND parsed — the ladder labels the
 *      exchange source 'live'; live mode is verified.
 *   1  the call failed or the reply did not parse — the ladder
 *      degrades to the disclosed cache; the printed stage names
 *      the assumption to fix next.
 *   2  not runnable (no key in the environment, unknown decision).
 * The key is never printed.
 */
import { ADVISOR_MODEL_ID } from '../src/lib/advisor';
import {
  META_MODEL_API_BASE_URL,
  resolveAdvisorExchange,
} from '../src/lib/advisor-live';
import { DECISIONS } from '../src/data/scenario';
import { DEFAULT_SCENARIO } from '../src/data/scenarios';

const env = (name: string): string | undefined => {
  const v = process.env[name]?.trim();
  return v && v.length > 0 ? v : undefined;
};

const baseUrl = env('META_MODEL_API_BASE_URL') ?? META_MODEL_API_BASE_URL;
const modelId = env('META_MODEL_ID') ?? ADVISOR_MODEL_ID;
const decisionKey = env('META_SMOKE_DECISION') ?? 'DP1';
const decision = DECISIONS[decisionKey];

console.log('Glass-Box live smoke check (Day-1 spike)');
console.log(`  endpoint : ${baseUrl}/chat/completions`);
console.log(`  model    : ${modelId}`);
console.log(`  decision : ${decisionKey}${decision ? ` — ${decision.title}` : ''}`);

if (!decision) {
  console.log(`  result   : NOT RUN — unknown decision "${decisionKey}".`);
  console.log(`             Available: ${Object.keys(DECISIONS).join(', ')}`);
  process.exit(2);
}

const apiKey = env('META_MODEL_API_KEY');
if (!apiKey) {
  console.log('  result   : NOT RUN — META_MODEL_API_KEY is not set.');
  console.log('             Create the key at dev.meta.ai, then run:');
  console.log('             META_MODEL_API_KEY=<key> npm run smoke:live');
  console.log('             (The app itself reads the key from .env.local —');
  console.log('             see .env.example. This script never reads files.)');
  process.exit(2);
}
console.log(`  key      : present (${apiKey.length} chars, never printed)`);

const res = await resolveAdvisorExchange('live', DEFAULT_SCENARIO, decision, {
  apiKey,
  baseUrl,
  modelId,
});

if (res && res.exchange.source === 'live') {
  console.log('  result   : LIVE VERIFIED — reply received and parsed.');
  console.log(`  reported : model "${res.exchange.model}"`);
  console.log(`  latency  : ${res.latencyMs} ms`);
  console.log(`  verdict  : ${res.exchange.output.verdict}`);
  console.log(`  headline : ${res.exchange.output.headline}`);
  console.log('  → The ladder labels this exchange source=live. GO for');
  console.log('    live mode (engine call-site swap is the remaining step).');
  process.exit(0);
}

const stage = (res?.liveError ?? 'unknown').split(':')[0];
const hints: Record<string, string> = {
  http: 'HTTP error — 404/405: check A1 (base URL) / A2 (path). 401/403: check A3 (auth) or key validity/permissions. 400: check A2 (body shape) / A4 (model id). 429: quota — the $150 credit or key limits.',
  parse:
    'Reply received but outside the Advisor output contract — check A2 (response shape / extraction path), or the model ignored the labeled format; retry once before changing code.',
  network: 'No response at all — check A1 (host) and this machine\u2019s connectivity.',
  timeout: 'No response within 20 s — wrong host (A1) or a very slow endpoint; retry once.',
};
console.log(`  result   : DEGRADED to disclosed cache (ladder working as designed)`);
console.log(`  failure  : ${res?.liveError ?? 'no resolution returned'}`);
console.log(`  next     : ${hints[stage] ?? 'Re-run once; if it persists, work the runbook checklist top to bottom.'}`);
console.log('  → NOT a live verification. The demo still runs honestly on');
console.log('    disclosed cached mode; see the Day-1 runbook decision point.');
process.exit(1);

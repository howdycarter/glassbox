import type {
  AdvisorExchange,
  AdvisorMode,
  AdvisorOutput,
  AdvisorVerdict,
  DecisionDef,
  ScenarioDef,
} from '../types';
import {
  ADVISOR_MODEL,
  ADVISOR_MODEL_ID,
  advisorKey,
  buildAdvisorPrompt,
  getAdvisorExchange,
  serializeAdvisorResponse,
} from './advisor';

/* Model Advisor — LIVE Meta Model API client + the asynchronous
 * failure ladder.
 *
 * STATUS: implemented against the documented API shape; NOT yet
 * verified against the real API. No keyed call has been made from
 * this codebase. The Day-1 spike (build window, once the entrant's
 * key exists) verifies each assumption below against the real
 * endpoint and corrects them in this one file if the portal disagrees.
 *
 * UNVERIFIED ASSUMPTIONS (secondary-sourced, Oct 2026 event/docs
 * material — each is isolated to a single constant or function):
 *  A1. Base URL: https://api.meta.ai/v1 — see META_MODEL_API_BASE_URL.
 *  A2. Endpoint shape: OpenAI-compatible POST /chat/completions with
 *      { model, messages: [{ role, content }] } and the reply text at
 *      choices[0].message.content — see buildLiveRequest /
 *      extractResponseText.
 *  A3. Auth: `Authorization: Bearer <key>` — see buildLiveRequest.
 *  A4. Model id string: 'muse-spark' — ADVISOR_MODEL_ID in advisor.ts.
 *
 * THE LADDER (resolveAdvisorExchange):
 *   deterministic → null (Advisor silent; the v4 baseline)
 *   cached        → the authored cache (getAdvisorExchange)
 *   live          → no key configured → cache, disclosed
 *                   key + call succeeds + response parses → 'live'
 *                   key + ANY failure (HTTP, network, timeout,
 *                   malformed/unparsable response) → cache, disclosed,
 *                   with the failure carried on the result as liveError
 *                   so the forensic log can record the degradation.
 *
 * HONESTY RULES (unchanged, enforced here):
 * - An exchange is labeled source 'live' ONLY when a real keyed API
 *   response was received and parsed in this call. Nothing in this
 *   file can manufacture a 'live' label from cached content.
 * - Cached fallbacks keep source 'cached' end to end; the panel's
 *   "LIVE REQUESTED — SERVING CACHED" disclosure is driven by that
 *   label, exactly as before.
 *
 * INTEGRATION POINT (the spike's one remaining step): the engine
 * currently consumes the synchronous getAdvisorExchange at
 * decision-issue time (src/lib/engine.ts) so UI state never waits on
 * the network. Once the API shape is verified, swap that call site to
 * resolveAdvisorExchange and record resolution.rawResponse /
 * resolution.latencyMs in the model log entry, plus resolution.liveError
 * as an action-log line when a live attempt degrades.
 */

/** A1 — UNVERIFIED base URL for the Meta Model API. */
export const META_MODEL_API_BASE_URL = 'https://api.meta.ai/v1';

/** Default per-call timeout; a slow model must degrade, not hang the demo. */
export const LIVE_CALL_TIMEOUT_MS = 20_000;

/** The HTTP request the client sends, before transport. Tests capture
    this exact object to lock the documented shape (A1–A4). */
export interface LiveRequest {
  url: string;
  method: 'POST';
  headers: Record<string, string>;
  body: {
    model: string;
    messages: { role: 'user'; content: string }[];
    temperature: number;
  };
}

/** Minimal transport response — the seam mocked transports implement. */
export interface LiveResponse {
  status: number;
  /** Parsed JSON body (the transport parses; the client validates). */
  json: unknown;
}

/**
 * Transport seam: given the built request and an abort signal, perform
 * the HTTP call. The default transport uses fetch; verification injects
 * mocked transports so the ladder is exercised with zero network.
 */
export type AdvisorTransport = (req: LiveRequest, signal: AbortSignal) => Promise<LiveResponse>;

const fetchTransport: AdvisorTransport = async (req, signal) => {
  const res = await fetch(req.url, {
    method: req.method,
    headers: req.headers,
    body: JSON.stringify(req.body),
    signal,
  });
  let json: unknown = null;
  try {
    json = await res.json();
  } catch {
    json = null; // non-JSON body → extraction fails → ladder degrades
  }
  return { status: res.status, json };
};

/** The entrant's key from the build environment, if configured.
    Never committed, never logged; see .env.example. */
export function liveApiKey(): string | null {
  const key = import.meta.env?.VITE_META_MODEL_API_KEY as string | undefined;
  return typeof key === 'string' && key.trim().length > 0 ? key.trim() : null;
}

/** Build the request for a decision point (A1–A4 live here). */
export function buildLiveRequest(prompt: string, apiKey: string): LiveRequest {
  return {
    url: `${META_MODEL_API_BASE_URL}/chat/completions`,
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: {
      model: ADVISOR_MODEL_ID,
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.2,
    },
  };
}

/** A2 — pull the reply text out of the response JSON. Accepts a plain
    string content or an array of text parts; anything else → null. */
export function extractResponseText(json: unknown): string | null {
  if (typeof json !== 'object' || json === null) return null;
  const choices = (json as { choices?: unknown }).choices;
  if (!Array.isArray(choices) || choices.length === 0) return null;
  const message = (choices[0] as { message?: unknown }).message;
  if (typeof message !== 'object' || message === null) return null;
  const content = (message as { content?: unknown }).content;
  if (typeof content === 'string') return content;
  if (Array.isArray(content)) {
    const parts = content
      .map((p) =>
        typeof p === 'object' && p !== null && (p as { type?: unknown }).type === 'text'
          ? (p as { text?: unknown }).text
          : null,
      )
      .filter((t): t is string => typeof t === 'string');
    return parts.length > 0 ? parts.join('\n') : null;
  }
  return null;
}

/** The model string the API reports for itself, when present (A2). */
export function extractResponseModel(json: unknown): string | null {
  if (typeof json !== 'object' || json === null) return null;
  const model = (json as { model?: unknown }).model;
  return typeof model === 'string' && model.length > 0 ? model : null;
}

const VERDICTS: AdvisorVerdict[] = ['concur', 'lean-alternate', 'disagree'];

/**
 * Parse a live reply in the labeled contract buildAdvisorPrompt
 * requests. Strict where it matters, tolerant where it's free:
 * - a recognizable Verdict line is REQUIRED (no verdict → null);
 * - citations are filtered to ids that exist on the decision — a
 *   cited input the operator cannot see is a provenance break, and
 *   if none survive, the response is rejected (null);
 * - agreesWithCore comes from the explicit line when present, else
 *   is derived from the verdict (concur → true, otherwise false).
 * Returns null on any structural failure; the ladder degrades.
 */
export function parseAdvisorResponse(text: string, decision: DecisionDef): AdvisorOutput | null {
  const lines = text.split('\n').map((l) => l.trim());
  let verdict: AdvisorVerdict | null = null;
  let headline = '';
  let confidenceRead = '';
  let agrees: boolean | null = null;
  const reasoning: string[] = [];
  let citations: string[] = [];
  let inReasoning = false;

  for (const line of lines) {
    const lower = line.toLowerCase();
    if (lower.startsWith('verdict:')) {
      const raw = lower
        .slice('verdict:'.length)
        .trim()
        .replace(/\s+/g, '-');
      verdict = VERDICTS.find((v) => raw.startsWith(v)) ?? null;
      inReasoning = false;
    } else if (lower.startsWith('headline:')) {
      headline = line.slice('headline:'.length).trim();
      inReasoning = false;
    } else if (lower.startsWith('reasoning:')) {
      inReasoning = true;
    } else if (lower.startsWith('confidence read:')) {
      confidenceRead = line.slice('confidence read:'.length).trim();
      inReasoning = false;
    } else if (lower.startsWith('citations:') || lower.startsWith('provenance citations:')) {
      citations = line
        .slice(line.indexOf(':') + 1)
        .split(',')
        .map((c) => c.trim())
        .filter((c) => c.length > 0);
      inReasoning = false;
    } else if (lower.startsWith('agrees with core:')) {
      const raw = lower.slice('agrees with core:'.length).trim();
      agrees = raw.startsWith('yes') ? true : raw.startsWith('no') ? false : null;
      inReasoning = false;
    } else if (inReasoning && /^[-•*]\s+/.test(line)) {
      reasoning.push(line.replace(/^[-•*]\s+/, ''));
    }
  }

  if (!verdict) return null;
  const validIds = new Set(decision.inputs.map((i) => i.id));
  citations = citations.filter((c) => validIds.has(c));
  if (citations.length === 0) return null;
  if (!headline) {
    headline =
      lines.find((l) => l.length > 0 && !l.toLowerCase().startsWith('verdict:')) ?? '';
  }
  if (!headline || reasoning.length === 0) return null;
  return {
    verdict,
    headline,
    reasoning,
    confidenceRead: confidenceRead || 'Not stated by the model.',
    citations,
    agreesWithCore: agrees ?? verdict === 'concur',
  };
}

/** A live attempt failed; the ladder degrades with the reason attached. */
export class LiveAdvisorError extends Error {
  readonly stage: 'http' | 'network' | 'timeout' | 'parse';
  constructor(message: string, stage: 'http' | 'network' | 'timeout' | 'parse') {
    super(message);
    this.name = 'LiveAdvisorError';
    this.stage = stage;
  }
}

export interface LiveSuccess {
  output: AdvisorOutput;
  /** Raw reply text exactly as received — what the forensic log stores. */
  rawText: string;
  /** Model string reported by the API, when present (A2). */
  responseModel: string | null;
  latencyMs: number;
}

/**
 * One live Advisor call for a decision point. Throws LiveAdvisorError
 * on every failure stage; callers (the ladder) decide the fallback.
 */
export async function fetchLiveAdvisorOutput(opts: {
  scenario: ScenarioDef;
  decision: DecisionDef;
  apiKey: string;
  transport?: AdvisorTransport;
  timeoutMs?: number;
}): Promise<LiveSuccess> {
  const transport = opts.transport ?? fetchTransport;
  const timeoutMs = opts.timeoutMs ?? LIVE_CALL_TIMEOUT_MS;
  const prompt = buildAdvisorPrompt(opts.scenario, opts.decision);
  const req = buildLiveRequest(prompt, opts.apiKey);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const started = Date.now();
  let res: LiveResponse;
  try {
    res = await transport(req, controller.signal);
  } catch (err) {
    throw new LiveAdvisorError(
      controller.signal.aborted
        ? `live call timed out after ${timeoutMs} ms`
        : `live call failed: ${err instanceof Error ? err.message : String(err)}`,
      controller.signal.aborted ? 'timeout' : 'network',
    );
  } finally {
    clearTimeout(timer);
  }
  const latencyMs = Date.now() - started;
  if (res.status < 200 || res.status >= 300) {
    throw new LiveAdvisorError(`live call returned HTTP ${res.status}`, 'http');
  }
  const text = extractResponseText(res.json);
  const output = text ? parseAdvisorResponse(text, opts.decision) : null;
  if (!text || !output) {
    throw new LiveAdvisorError('live response did not match the Advisor output contract', 'parse');
  }
  return { output, rawText: text, responseModel: extractResponseModel(res.json), latencyMs };
}

/** The ladder's product: everything the engine/forensic log needs. */
export interface AdvisorResolution {
  exchange: AdvisorExchange;
  /** Raw response for the model log (serialized + labeled for cache;
      the verbatim reply text for live). */
  rawResponse: string;
  /** Measured latency for a live exchange; null for cached. */
  latencyMs: number | null;
  /** Set when Live was requested but the ladder degraded to cache —
      the degradation is recorded, never silent. */
  liveError: string | null;
}

function cachedResolution(
  scenario: ScenarioDef,
  decision: DecisionDef,
  liveError: string | null,
): AdvisorResolution | null {
  const exchange = getAdvisorExchange('cached', scenario, decision);
  if (!exchange) return null;
  return {
    exchange,
    rawResponse: serializeAdvisorResponse(exchange.output, 'cached'),
    latencyMs: null,
    liveError,
  };
}

/**
 * The asynchronous failure ladder. Deterministic → null. Cached → the
 * cache. Live → a real keyed call when a key is available (opts.apiKey
 * overrides the environment, which is how verification injects one);
 * any failure degrades to the disclosed cache with liveError set.
 */
export async function resolveAdvisorExchange(
  mode: AdvisorMode,
  scenario: ScenarioDef,
  decision: DecisionDef,
  opts: { apiKey?: string | null; transport?: AdvisorTransport; timeoutMs?: number } = {},
): Promise<AdvisorResolution | null> {
  if (mode === 'deterministic') return null;
  if (mode === 'cached') return cachedResolution(scenario, decision, null);

  const apiKey = opts.apiKey !== undefined ? opts.apiKey : liveApiKey();
  if (!apiKey) {
    return cachedResolution(scenario, decision, 'no Meta Model API key configured');
  }
  try {
    const live = await fetchLiveAdvisorOutput({
      scenario,
      decision,
      apiKey,
      transport: opts.transport,
      timeoutMs: opts.timeoutMs,
    });
    const exchange: AdvisorExchange = {
      key: advisorKey(scenario.id, decision.id),
      scenarioId: scenario.id,
      decisionId: decision.id,
      source: 'live',
      model: live.responseModel ?? ADVISOR_MODEL,
      output: live.output,
    };
    return { exchange, rawResponse: live.rawText, latencyMs: live.latencyMs, liveError: null };
  } catch (err) {
    const reason =
      err instanceof LiveAdvisorError
        ? `${err.stage}: ${err.message}`
        : `network: ${err instanceof Error ? err.message : String(err)}`;
    return cachedResolution(scenario, decision, reason);
  }
}

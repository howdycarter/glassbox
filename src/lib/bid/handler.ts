import { BidAdapterError, type AdapterOptions, type Disposition } from './types';
import { scorePursuit } from './adapter';

/**
 * Pure HTTP handler contract for POST /disposition.
 * Dragon hosting (CHR-2281 / scripts/bid-server.ts) binds this; this
 * module does not listen, send, or touch credentials.
 *
 * Malformed bodies fail closed as HTTP 400 `{ error: "UNKNOWN" }` —
 * never a partial or stale disposition.
 */
export interface DispositionHttpResult {
  status: number;
  body: { error: 'UNKNOWN' } | Disposition;
}

export function parseRequestBody(raw: unknown): unknown {
  if (typeof raw === 'string') {
    try {
      return JSON.parse(raw) as unknown;
    } catch {
      throw new BidAdapterError('body is not JSON');
    }
  }
  return raw;
}

export function handleDispositionRequest(
  rawBody: unknown,
  options: AdapterOptions = {},
): DispositionHttpResult {
  try {
    const body = parseRequestBody(rawBody);
    const disposition = scorePursuit(body, options);
    return { status: 200, body: disposition };
  } catch (err) {
    if (err instanceof BidAdapterError) {
      return { status: 400, body: { error: 'UNKNOWN' } };
    }
    return { status: 400, body: { error: 'UNKNOWN' } };
  }
}

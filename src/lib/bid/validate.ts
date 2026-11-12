import type { FeedClass } from '../../types';
import {
  FEED_CLASS_BY_ID,
  isFeedId,
  qualityForReliability,
  reliabilityForQuality,
  type FeedId,
} from './catalog';
import { BidAdapterError, type PursuitEvidence, type PursuitRecord } from './types';

/**
 * Spec 4.2 — a source handle is one of:
 *   - file path + section (path/extension and § / # / "section")
 *   - Linear issue or comment ID (CHR-nnnn or a UUID)
 *   - SAM notice ID (letter-digit token, length ≥ 6)
 *
 * A feed whose `source` is empty or a bare label (no handle) is rejected.
 */
export function isSourceHandle(source: string): boolean {
  const s = source.trim();
  if (s.length === 0) return false;
  if (/CHR-\d+/i.test(s)) return true;
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s)) {
    return true;
  }
  const looksLikeFile = /(?:\.md|\.ts|\.tsx|\.json|\.txt|\.pdf|\/)/i.test(s);
  const hasSection = /[§#]|section\s+\d+/i.test(s);
  if (looksLikeFile && hasSection) return true;
  // SAM notice / solicitation id: compact alphanumeric with at least one digit.
  if (/^[A-Z0-9][A-Z0-9._-]{5,}$/i.test(s) && /\d/.test(s) && !/\s/.test(s)) {
    return true;
  }
  return false;
}

export function resolvedReliability(item: PursuitEvidence): number {
  if (item.reliability !== undefined && item.evidenceQuality !== undefined) {
    const mapped = reliabilityForQuality(item.evidenceQuality);
    const quality = qualityForReliability(item.reliability);
    if (quality !== item.evidenceQuality) {
      throw new BidAdapterError(
        `feed ${item.id}: reliability ${item.reliability} does not match evidenceQuality ${item.evidenceQuality} (canonical ${mapped})`,
      );
    }
    return item.reliability;
  }
  if (item.reliability !== undefined) {
    if (qualityForReliability(item.reliability) === null) {
      throw new BidAdapterError(
        `feed ${item.id}: reliability ${item.reliability} is not a spec 4.3 band (firsthand 0.9-1.0, record card 0.8, reported/summary 0.5, title-only 0.3)`,
      );
    }
    return item.reliability;
  }
  if (item.evidenceQuality !== undefined) {
    return reliabilityForQuality(item.evidenceQuality);
  }
  throw new BidAdapterError(`feed ${item.id}: reliability or evidenceQuality is required`);
}

export function resolvedFeedClass(item: PursuitEvidence): FeedClass {
  if (!isFeedId(item.feed)) {
    throw new BidAdapterError(`feed ${item.id}: unknown feed id "${String(item.feed)}"`);
  }
  const catalogClass = FEED_CLASS_BY_ID[item.feed];
  if (item.feedClass !== undefined && item.feedClass !== catalogClass) {
    throw new BidAdapterError(
      `feed ${item.id}: feedClass ${item.feedClass} does not match catalog ${catalogClass} for ${item.feed}`,
    );
  }
  return catalogClass;
}

function assertFeedId(value: string): FeedId {
  if (!isFeedId(value)) {
    throw new BidAdapterError(`unknown feed id "${value}"`);
  }
  return value;
}

/**
 * Structural validation of a pursuit record. Throws BidAdapterError
 * (code UNKNOWN) on any malformed input — the HTTP handler maps that
 * to `{ error: "UNKNOWN" }`.
 */
export function validatePursuitRecord(record: unknown): PursuitRecord {
  if (record === null || typeof record !== 'object' || Array.isArray(record)) {
    throw new BidAdapterError('pursuit record must be an object');
  }
  const raw = record as Record<string, unknown>;
  if (typeof raw.pursuitId !== 'string' || raw.pursuitId.trim() === '') {
    throw new BidAdapterError('pursuitId is required');
  }
  if (typeof raw.title !== 'string' || raw.title.trim() === '') {
    throw new BidAdapterError('title is required');
  }
  if (!Array.isArray(raw.evidence)) {
    throw new BidAdapterError('evidence must be an array');
  }

  const seenFeeds = new Set<string>();
  const seenIds = new Set<string>();
  const evidence: PursuitEvidence[] = raw.evidence.map((row, index) => {
    if (row === null || typeof row !== 'object' || Array.isArray(row)) {
      throw new BidAdapterError(`evidence[${index}] must be an object`);
    }
    const item = row as Record<string, unknown>;
    if (typeof item.id !== 'string' || item.id.trim() === '') {
      throw new BidAdapterError(`evidence[${index}].id is required`);
    }
    if (seenIds.has(item.id)) {
      throw new BidAdapterError(`duplicate evidence id "${item.id}"`);
    }
    seenIds.add(item.id);
    if (typeof item.feed !== 'string') {
      throw new BidAdapterError(`evidence[${index}].feed is required`);
    }
    const feed = assertFeedId(item.feed);
    if (seenFeeds.has(feed)) {
      throw new BidAdapterError(`duplicate catalog feed "${feed}"`);
    }
    seenFeeds.add(feed);
    if (typeof item.source !== 'string' || !isSourceHandle(item.source)) {
      throw new BidAdapterError(
        `evidence[${index}] (${feed}) has no source handle (need file path+section, Linear issue/comment ID, or SAM notice ID)`,
      );
    }
    if (typeof item.claim !== 'string' || item.claim.trim() === '') {
      throw new BidAdapterError(`evidence[${index}].claim is required`);
    }
    if (typeof item.ageDays !== 'number' || !Number.isFinite(item.ageDays) || item.ageDays < 0) {
      throw new BidAdapterError(`evidence[${index}].ageDays must be a non-negative number of days`);
    }
    if (typeof item.supports !== 'boolean') {
      throw new BidAdapterError(`evidence[${index}].supports must be boolean`);
    }
    const parsed: PursuitEvidence = {
      id: item.id,
      feed,
      source: item.source.trim(),
      claim: item.claim,
      ageDays: item.ageDays,
      supports: item.supports,
    };
    if (item.feedClass !== undefined) {
      if (
        item.feedClass !== 'sensor' &&
        item.feedClass !== 'sigint' &&
        item.feedClass !== 'blueforce' &&
        item.feedClass !== 'link'
      ) {
        throw new BidAdapterError(`evidence[${index}].feedClass is not a FeedClass`);
      }
      parsed.feedClass = item.feedClass;
    }
    if (item.reliability !== undefined) {
      if (typeof item.reliability !== 'number' || !Number.isFinite(item.reliability)) {
        throw new BidAdapterError(`evidence[${index}].reliability must be a number`);
      }
      parsed.reliability = item.reliability;
    }
    if (item.evidenceQuality !== undefined) {
      if (
        item.evidenceQuality !== 'firsthand-primary' &&
        item.evidenceQuality !== 'record-card' &&
        item.evidenceQuality !== 'reported-summary' &&
        item.evidenceQuality !== 'title-only'
      ) {
        throw new BidAdapterError(`evidence[${index}].evidenceQuality is not a spec 4.3 quality`);
      }
      parsed.evidenceQuality = item.evidenceQuality;
    }
    if (item.integrity !== undefined) {
      if (item.integrity !== 'ok' && item.integrity !== 'stale' && item.integrity !== 'anomaly') {
        throw new BidAdapterError(`evidence[${index}].integrity is invalid`);
      }
      parsed.integrity = item.integrity;
    }
    // Force reliability resolution now so a bad band fails closed.
    resolvedReliability(parsed);
    resolvedFeedClass(parsed);
    return parsed;
  });

  const contradictions: string[] = [];
  if (raw.contradictions !== undefined) {
    if (!Array.isArray(raw.contradictions)) {
      throw new BidAdapterError('contradictions must be an array of strings');
    }
    for (const [i, c] of raw.contradictions.entries()) {
      if (typeof c !== 'string' || c.trim() === '') {
        throw new BidAdapterError(`contradictions[${i}] must be a nonempty string`);
      }
      contradictions.push(c);
    }
  }

  const exceptions: PursuitRecord['exceptions'] = [];
  if (raw.exceptions !== undefined) {
    if (!Array.isArray(raw.exceptions)) {
      throw new BidAdapterError('exceptions must be an array');
    }
    for (const [i, row] of raw.exceptions.entries()) {
      if (row === null || typeof row !== 'object' || Array.isArray(row)) {
        throw new BidAdapterError(`exceptions[${i}] must be an object`);
      }
      const ex = row as Record<string, unknown>;
      if (typeof ex.feed !== 'string' || !isFeedId(ex.feed)) {
        throw new BidAdapterError(`exceptions[${i}].feed is not a catalog feed`);
      }
      if (typeof ex.gap !== 'string' || ex.gap.trim() === '') {
        throw new BidAdapterError(`exceptions[${i}].gap is required`);
      }
      if (typeof ex.resolution !== 'string' || ex.resolution.trim() === '') {
        throw new BidAdapterError(`exceptions[${i}].resolution is required`);
      }
      exceptions.push({ feed: ex.feed, gap: ex.gap, resolution: ex.resolution });
    }
  }

  let hardGate: PursuitRecord['hardGate'];
  if (raw.hardGate !== undefined) {
    if (raw.hardGate === null || typeof raw.hardGate !== 'object' || Array.isArray(raw.hardGate)) {
      throw new BidAdapterError('hardGate must be an object');
    }
    const hg = raw.hardGate as Record<string, unknown>;
    if (typeof hg.failed !== 'boolean') {
      throw new BidAdapterError('hardGate.failed must be boolean');
    }
    const reason = hg.reason === null || hg.reason === undefined ? null : hg.reason;
    const sourceHandle =
      hg.sourceHandle === null || hg.sourceHandle === undefined ? null : hg.sourceHandle;
    if (reason !== null && typeof reason !== 'string') {
      throw new BidAdapterError('hardGate.reason must be a string or null');
    }
    if (sourceHandle !== null && typeof sourceHandle !== 'string') {
      throw new BidAdapterError('hardGate.sourceHandle must be a string or null');
    }
    if (hg.failed && (reason === null || reason.trim() === '')) {
      throw new BidAdapterError('hardGate.reason is required when failed is true');
    }
    if (hg.failed && (sourceHandle === null || !isSourceHandle(sourceHandle))) {
      throw new BidAdapterError('hardGate.sourceHandle must be a source handle when failed is true');
    }
    hardGate = {
      failed: hg.failed,
      reason,
      sourceHandle,
    };
  }

  return {
    pursuitId: raw.pursuitId.trim(),
    title: raw.title.trim(),
    evidence,
    contradictions,
    exceptions,
    hardGate,
  };
}

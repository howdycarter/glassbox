import type { PursuitRecord } from './types';

/**
 * Synthetic pursuit record from Linear CHR-2285 (WF-42 proof, labeled
 * TEST). Used as the worked-example fixture: engine score 72,
 * class PURSUE-WITH-EXCEPTIONS (exception on insurance-posture).
 */
export const CHR_2285_TEST_RECORD: PursuitRecord = {
  pursuitId: 'CHR-2285',
  title: 'TEST synthetic pursuit record for WF-42 proof (CHR-2282) - not a real pursuit',
  evidence: [
    {
      id: 'f1',
      feed: 'deadline-realism',
      source: 'CHR-2282 §WF-42-proof-record',
      feedClass: 'sensor',
      claim: 'TEST synthetic: deadline 14 days out, read from this issue description',
      ageDays: 0,
      reliability: 0.95,
      supports: true,
      integrity: 'ok',
    },
    {
      id: 'f2',
      feed: 'requirement-clarity',
      source: 'CHR-2282 §WF-42-proof-record',
      feedClass: 'sensor',
      claim: 'TEST synthetic: requirements and submission route unambiguous',
      ageDays: 0,
      reliability: 0.9,
      supports: true,
      integrity: 'ok',
    },
    {
      id: 'f3',
      feed: 'capability-match',
      source: 'glassbox-proposal-integration-spec-2026-11-05.md §4.2',
      feedClass: 'blueforce',
      claim: 'TEST synthetic: firm capability inventory covers the scoped work',
      ageDays: 1,
      reliability: 0.8,
      supports: true,
      integrity: 'ok',
    },
    {
      id: 'f4',
      feed: 'insurance-posture',
      source: 'CHR-2282 §WF-42-proof-record',
      feedClass: 'link',
      claim: 'TEST synthetic: solicitation requires cyber $2M; firm record shows $25K - posture opposes',
      ageDays: 0,
      reliability: 0.9,
      supports: false,
      integrity: 'ok',
    },
    {
      id: 'f5',
      feed: 'field-density',
      source: 'CHR-2282 §WF-42-proof-record',
      feedClass: 'sigint',
      claim: 'TEST synthetic: small competitive field reported',
      ageDays: 3,
      reliability: 0.5,
      supports: true,
      integrity: 'ok',
    },
  ],
  contradictions: [
    'TEST synthetic contradiction: requirement states cyber $2M (CHR-2282 §WF-42-proof-record) vs firm record $25K (glassbox-proposal-integration-spec-2026-11-05.md §4.4 example)',
  ],
  exceptions: [
    {
      feed: 'insurance-posture',
      gap: 'TEST synthetic gap: cyber coverage below the synthetic requirement',
      resolution: 'TEST synthetic: broker bind lands inside the window',
    },
  ],
  hardGate: {
    failed: false,
    reason: null,
    sourceHandle: null,
  },
};

function handle(feed: string): string {
  return `~/workspace/goals/newton-carter-llc-formation/files/pursuit/TEST-RECORD.md §${feed}`;
}

/** Minimal valid evidence row; tests override fields. */
export function evidence(
  feed: PursuitRecord['evidence'][number]['feed'],
  overrides: Partial<PursuitRecord['evidence'][number]> = {},
): PursuitRecord['evidence'][number] {
  return {
    id: overrides.id ?? feed,
    feed,
    source: overrides.source ?? handle(feed),
    claim: overrides.claim ?? `TEST claim for ${feed}`,
    ageDays: overrides.ageDays ?? 0,
    reliability: overrides.reliability ?? 0.8,
    supports: overrides.supports ?? true,
    integrity: overrides.integrity ?? 'ok',
    ...('feedClass' in overrides ? { feedClass: overrides.feedClass } : {}),
    ...('evidenceQuality' in overrides ? { evidenceQuality: overrides.evidenceQuality } : {}),
  };
}

export function record(
  evidenceRows: PursuitRecord['evidence'],
  extra: Partial<PursuitRecord> = {},
): PursuitRecord {
  return {
    pursuitId: extra.pursuitId ?? 'TEST-PURSUIT',
    title: extra.title ?? 'TEST pursuit',
    evidence: evidenceRows,
    contradictions: extra.contradictions ?? [],
    exceptions: extra.exceptions ?? [],
    hardGate: extra.hardGate ?? { failed: false, reason: null, sourceHandle: null },
    omitted: extra.omitted,
  };
}

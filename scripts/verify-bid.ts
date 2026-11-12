/* Glass-Box — bid-disposition adapter harness (Phase 1, CHR-2280).
   Run: npm run verify:bid
   Also chained from npm run verify after the engine baseline. */

import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { computeConfidence } from '../src/lib/recommender';
import {
  FEED_CATALOG,
  FEED_CLASS_BY_ID,
  FEED_IDS,
  RELIABILITY,
  SENTINEL_GROUND_TRUTH,
  V1_THRESHOLDS,
  buildDecisionDef,
  handleDispositionRequest,
  isSourceHandle,
  qualityForReliability,
  scorePursuit,
} from '../src/lib/bid';
import { CHR_2285_TEST_RECORD, evidence, record } from '../src/lib/bid/fixtures';
import type { FeedId } from '../src/lib/bid';
import type { ForensicEntry } from '../src/lib/bid';

let passed = 0;
let failed = 0;
function check(name: string, cond: boolean, detail = ''): void {
  if (cond) {
    passed++;
    console.log(`  PASS  ${name}`);
  } else {
    failed++;
    console.log(`  FAIL  ${name}${detail ? ` — ${detail}` : ''}`);
  }
}

function leakBlob(value: unknown): string {
  return JSON.stringify(value);
}

function hasSentinelLeak(value: unknown): boolean {
  const blob = leakBlob(value);
  return (
    blob.includes(SENTINEL_GROUND_TRUTH) ||
    /"correctAction"/.test(blob) ||
    /"groundTruth"/.test(blob)
  );
}

console.log('N. bid adapter — catalog, provenance, reliability, age (spec 4.1–4.4)');
check('catalog has exactly nine evidence feeds', FEED_IDS.length === 9, `got ${FEED_IDS.length}`);
check(
  'feed-class mapping: sensor=solicitation, sigint=market, blueforce=firm-internal, link=channel/posture',
  FEED_CLASS_BY_ID['requirement-clarity'] === 'sensor' &&
    FEED_CLASS_BY_ID['deadline-realism'] === 'sensor' &&
    FEED_CLASS_BY_ID['field-density'] === 'sigint' &&
    FEED_CLASS_BY_ID['price-posture'] === 'sigint' &&
    FEED_CLASS_BY_ID['buyer-signals'] === 'sigint' &&
    FEED_CLASS_BY_ID['capability-match'] === 'blueforce' &&
    FEED_CLASS_BY_ID['past-performance'] === 'blueforce' &&
    FEED_CLASS_BY_ID['insurance-posture'] === 'link' &&
    FEED_CLASS_BY_ID['channel-viability'] === 'link',
);
for (const entry of FEED_CATALOG) {
  const d = scorePursuit(
    record([evidence(entry.id, { reliability: 0.8, supports: true })]),
  );
  check(
    `catalog feed ${entry.id} is one FeedInput of class ${entry.feedClass}`,
    d.inputs.length === 1 && d.inputs[0].feed === entry.id && d.inputs[0].feedClass === entry.feedClass,
  );
}

check('firsthand primary 0.9 is accepted', qualityForReliability(0.9) === 'firsthand-primary');
check('firsthand primary 1.0 is accepted', qualityForReliability(1.0) === 'firsthand-primary');
check('record card 0.8 is accepted', qualityForReliability(RELIABILITY.recordCard) === 'record-card');
check('reported/summary 0.5 is accepted', qualityForReliability(0.5) === 'reported-summary');
check('title-only 0.3 is accepted', qualityForReliability(0.3) === 'title-only');
check('reliability 0.7 (not a spec 4.3 band) is rejected', handleDispositionRequest(record([evidence('capability-match', { reliability: 0.7 })])).status === 400);

check('file path+section is a source handle', isSourceHandle('glassbox-proposal-integration-spec-2026-11-05.md §4.2'));
check('Linear issue ID is a source handle', isSourceHandle('CHR-2282'));
check('Linear issue + section is a source handle', isSourceHandle('CHR-2282 §WF-42-proof-record'));
check('SAM notice ID is a source handle', isSourceHandle('N0018927RL0010'));
check('bare label is not a source handle', !isSourceHandle('Capability Inventory'));
check(
  'adapter rejects a feed without a handle',
  handleDispositionRequest(
    record([evidence('capability-match', { source: 'Capability Inventory' })]),
  ).status === 400,
);

const aged = scorePursuit(record([evidence('field-density', { reliability: 0.5, ageDays: 3, supports: true })]));
check(
  'age fed in DAYS onto the freshness curve (3 days → freshness 0.8 → contribution +5)',
  aged.value === 55 && aged.drivers.some((d) => d.delta === 5 && d.label.includes('believed age 3 min')),
  `got value=${aged.value} drivers=${JSON.stringify(aged.drivers)}`,
);
const defAged = buildDecisionDef(record([evidence('field-density', { reliability: 0.5, ageDays: 3 })]));
check(
  'claimedAgeMin unused (never set on adapter FeedInputs)',
  defAged.inputs.every((i) => !('claimedAgeMin' in i) && i.ageMin === 3),
);

console.log('N2. contradictions, degraded evidence, classification (spec 4.5)');
const conflict = scorePursuit(
  record(
    [
      evidence('capability-match', { reliability: 0.8, supports: true }),
      evidence('past-performance', { reliability: 0.8, supports: true }),
    ],
    {
      contradictions: [
        'Phone: draft lists 512-549-9274 (~/workspace/goals/x.md §1) vs firm line (512) 553-2217 (CHR-2272-manifest.md #14)',
      ],
    },
  ),
);
check(
  'one contradiction applies engine penalty −4',
  conflict.drivers.some((d) => d.label.includes('Contradiction penalty') && d.delta === -4) &&
    conflict.value === 50 + 10 + 10 - 4,
  `got value=${conflict.value}`,
);
check(
  'contradiction string names both values and both handles',
  conflict.contradictions[0].includes('512-549-9274') &&
    conflict.contradictions[0].includes('553-2217') &&
    conflict.contradictions[0].includes('~/workspace/goals/x.md §1') &&
    conflict.contradictions[0].includes('CHR-2272-manifest.md #14'),
);

const summaryOnly = scorePursuit(
  record([
    evidence('requirement-clarity', { reliability: 0.5, supports: true }),
    evidence('deadline-realism', { reliability: 0.5, supports: true }),
    evidence('capability-match', { reliability: 0.8, supports: true }),
    evidence('past-performance', { reliability: 0.8, supports: true }),
    evidence('insurance-posture', { reliability: 0.8, supports: true }),
  ]),
);
check(
  'summary-only solicitation evidence sets linkDegraded and holds at the degraded cap 60',
  summaryOnly.linkDegraded === true &&
    summaryOnly.value === 60 &&
    summaryOnly.drivers.some((d) => d.label.includes('Degraded link')) &&
    summaryOnly.drivers.some((d) => d.label.includes('Degraded cap')),
  `got value=${summaryOnly.value} degraded=${summaryOnly.linkDegraded}`,
);
const firsthandSensor = scorePursuit(
  record([
    evidence('requirement-clarity', { reliability: 0.9, supports: true }),
    evidence('capability-match', { reliability: 0.8, supports: true }),
  ]),
);
check(
  'record-card/firsthand solicitation evidence does not fire the degraded rule',
  firsthandSensor.linkDegraded === false && firsthandSensor.value === 50 + 11 + 10,
  `got value=${firsthandSensor.value} degraded=${firsthandSensor.linkDegraded}`,
);

const noBid44 = scorePursuit(record([evidence('insurance-posture', { reliability: 0.5, supports: false })]));
check('threshold 44 → NO-BID', noBid44.value === 44 && noBid44.class === 'NO-BID', `got ${noBid44.value} ${noBid44.class}`);

const pursue45 = scorePursuit(
  record([
    evidence('insurance-posture', { reliability: 0.9, supports: false }),
    evidence('capability-match', { reliability: 0.5, supports: true }),
  ]),
);
check(
  'threshold 45 → PURSUE-WITH-EXCEPTIONS',
  pursue45.value === 45 && pursue45.class === 'PURSUE-WITH-EXCEPTIONS',
  `got ${pursue45.value} ${pursue45.class}`,
);

const pursue64 = scorePursuit(
  record([
    evidence('capability-match', { reliability: 0.8, supports: true }),
    evidence('past-performance', { reliability: 0.3, supports: true }),
  ]),
);
check(
  'threshold 64 → PURSUE-WITH-EXCEPTIONS',
  pursue64.value === 64 && pursue64.class === 'PURSUE-WITH-EXCEPTIONS',
  `got ${pursue64.value} ${pursue64.class}`,
);

const bid65 = scorePursuit(
  record([
    evidence('capability-match', { reliability: 0.9, supports: true }),
    evidence('past-performance', { reliability: 0.3, supports: true }),
  ]),
);
check('threshold 65 with no exceptions → BID', bid65.value === 65 && bid65.class === 'BID', `got ${bid65.value} ${bid65.class}`);

const pursue65ex = scorePursuit(
  record(
    [
      evidence('capability-match', { reliability: 0.9, supports: true }),
      evidence('past-performance', { reliability: 0.3, supports: true }),
    ],
    {
      exceptions: [
        {
          feed: 'insurance-posture',
          gap: 'coverage short',
          resolution: 'broker bind',
        },
      ],
    },
  ),
);
check(
  'threshold 65 with exceptions → PURSUE-WITH-EXCEPTIONS',
  pursue65ex.value === 65 && pursue65ex.class === 'PURSUE-WITH-EXCEPTIONS',
  `got ${pursue65ex.value} ${pursue65ex.class}`,
);

const gated = scorePursuit(
  record(
    [
      evidence('capability-match', { reliability: 0.9, supports: true }),
      evidence('past-performance', { reliability: 0.3, supports: true }),
    ],
    {
      hardGate: {
        failed: true,
        reason: 'unmet unwaivable facility-clearance disqualifier',
        sourceHandle: 'CHR-2280 §hard-gate',
      },
    },
  ),
);
check(
  'hard gate (unmet + unwaivable disqualifier) → NO-BID regardless of score',
  gated.value === 65 && gated.class === 'NO-BID' && gated.hardGateFailed === true,
  `got ${gated.value} ${gated.class}`,
);

console.log('N3. forensic entry, sentinel, HTTP handler, worked example');
const dir = mkdtempSync(join(tmpdir(), 'glassbox-bid-'));
const forensicPath = join(dir, 'bid-forensic.jsonl');
try {
  const first = scorePursuit(CHR_2285_TEST_RECORD, { forensicPath, modelVersion: 'test-adapter' });
  const second = scorePursuit(record([evidence('capability-match')]), { forensicPath, modelVersion: 'test-adapter' });
  const lines = readFileSync(forensicPath, 'utf8')
    .trim()
    .split('\n')
    .map((line) => JSON.parse(line) as ForensicEntry);
  check('forensic JSONL is append-only with monotonic seq 1 then 2', first.forensic.seq === 1 && second.forensic.seq === 2 && lines[0].seq === 1 && lines[1].seq === 2);
  check(
    'every forensic entry records v1 thresholds (65 / 45–64 / hard gate)',
    lines.every(
      (e) =>
        e.thresholds.bid === 65 &&
        e.thresholds.pursueFloor === 45 &&
        e.thresholds.pursueCeiling === 64 &&
        e.thresholds.hardGateOverridesScore === true &&
        e.thresholds.description === V1_THRESHOLDS.description,
    ),
  );
  check('disposition forensic ref carries path + seq + modelVersion', first.forensic.path === forensicPath && first.forensic.modelVersion === 'test-adapter');
} finally {
  rmSync(dir, { recursive: true, force: true });
}

const example = scorePursuit(CHR_2285_TEST_RECORD, { modelVersion: 'test-adapter' });
check(
  'worked example CHR-2285: value 72, class PURSUE-WITH-EXCEPTIONS',
  example.value === 72 && example.class === 'PURSUE-WITH-EXCEPTIONS',
  `got ${example.value} ${example.class}`,
);
check(
  'worked example drivers match the engine (base 50, ± contributions, contradiction −4)',
  example.drivers[0].delta === 50 &&
    example.drivers.some((d) => d.delta === 11) &&
    example.drivers.some((d) => d.delta === 10) &&
    example.drivers.some((d) => d.delta === -11) &&
    example.drivers.some((d) => d.delta === 5) &&
    example.drivers.some((d) => d.delta === -4),
  JSON.stringify(example.drivers.map((d) => d.delta)),
);
check(
  'scorePursuit value equals computeConfidence(buildDecisionDef) — engine called unchanged',
  computeConfidence(buildDecisionDef(CHR_2285_TEST_RECORD)).value === example.value,
);
check(
  'omitted catalog feeds are recorded, never fabricated',
  example.omitted.map((o) => o.feed).sort().join(',') ===
    (['buyer-signals', 'channel-viability', 'past-performance', 'price-posture'] as FeedId[]).join(','),
  `got ${example.omitted.map((o) => o.feed).join(',')}`,
);
check('internal DecisionDef carries sentinel groundTruth (type requirement)', buildDecisionDef(CHR_2285_TEST_RECORD).groundTruth === SENTINEL_GROUND_TRUTH);
check('adapter output does not surface correctAction or groundTruth', !hasSentinelLeak(example));
check('forensic-shaped snapshot does not surface sentinel fields', !hasSentinelLeak({ forensic: example.forensic, thresholds: example.thresholds, drivers: example.drivers }));

const okHttp = handleDispositionRequest(CHR_2285_TEST_RECORD, { modelVersion: 'test-adapter' });
check('HTTP handler: valid record → 200 with class and value', okHttp.status === 200 && okHttp.body !== null && 'value' in okHttp.body && okHttp.body.value === 72 && okHttp.body.class === 'PURSUE-WITH-EXCEPTIONS');
check('HTTP handler: valid body has no sentinel leak', !hasSentinelLeak(okHttp.body));
const badHttp = handleDispositionRequest({ nope: true });
check(
  'HTTP handler: malformed body → 400 { error: "UNKNOWN" }',
  badHttp.status === 400 && 'error' in badHttp.body && badHttp.body.error === 'UNKNOWN',
);
const junkHttp = handleDispositionRequest('not-json');
check('HTTP handler: non-JSON string → 400 UNKNOWN', junkHttp.status === 400 && 'error' in junkHttp.body && junkHttp.body.error === 'UNKNOWN');
const missingHandleHttp = handleDispositionRequest(
  record([evidence('capability-match', { source: 'a title with no handle' })]),
);
check('HTTP handler: feed without handle → 400 UNKNOWN', missingHandleHttp.status === 400);

const allNine = scorePursuit(
  record(FEED_IDS.map((id) => evidence(id, { reliability: 0.8, supports: true }))),
);
check(
  'all nine catalog feeds present → nine FeedInputs, zero omissions',
  allNine.inputs.length === 9 && allNine.omitted.length === 0,
  `inputs=${allNine.inputs.length} omitted=${allNine.omitted.length}`,
);
check(
  'every adapter input source is a source handle',
  example.inputs.every((i) => isSourceHandle(i.source)) && allNine.inputs.every((i) => isSourceHandle(i.source)),
);

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);

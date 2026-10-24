/* Glass-Box C2 — v2 verification harness (not part of the app).
   Run: npm run verify
   Builds this file with Vite's SSR bundler and executes it in Node.
   It playtests the two v2 features at the engine level and smoke-
   renders the new panels server-side:

   A. Default weights reproduce the v1 confidence values exactly,
      including the DP-3 engineered catch at 71%.
   B. A full scripted run on the correct path scores 5/5 and reaches ENDEX.
   C. An accept-everything run scores 4/5 — DP-3 is the only error.
   D. Feed re-weighting re-scores DP-3 deterministically.
   E. Committing a re-weighting writes exactly one forensic log entry with
      the re-score effect; live slider movement writes none.
   F. What-If projections from DP-3 diverge as designed and mutate
      nothing — neither the tracks nor the forensic log.
   G. Track attention scoring is deterministic and ranks the two hostile
      tracks on top in the late-run picture.
   H. The new panels and the DP-3 decision surface render (SSR smoke).
   I. The v3 scenario registry: POISONED PICTURE is the default; DARK
      STRAIT is structurally sound (5 decisions, 16 events, one trap).
   J. DARK STRAIT confidence values, incl. the DP-3 AIS-spoof catch at
      71% and its survival under feed re-weighting.
   K. Full DARK STRAIT runs: correct path 5/5, accept-everything 4/5
      with the trap consequence persisting, deterministic replay, and
      SET_SCENARIO / RESET semantics.
   L. SSR smoke for the v3 surfaces (picker, scenario-2 trap, debrief).
   M. Model Advisor (hackathon build): cache completeness for all 10
      decision points, honesty labels (cached is never labeled live),
      agreement scoring alongside — never instead of — core scoring,
      deterministic-mode silence, and SSR smoke for the new surfaces. */

import React from 'react';
import { renderToString } from 'react-dom/server';
import { bootLog, initialState, reducer, type GameState } from '../src/lib/engine';
import { computeConfidence, systemReliability } from '../src/lib/recommender';
import {
  DEFAULT_FEED_WEIGHTS,
  DEFAULT_WEIGHTS,
  scoreTracks,
} from '../src/lib/prioritization';
import { projectBranch } from '../src/lib/whatif';
import { DECISIONS } from '../src/data/scenario';
import { DARK_STRAIT } from '../src/data/scenario2';
import { DEFAULT_SCENARIO, SCENARIOS, SCENARIOS_BY_ID } from '../src/data/scenarios';
import type { ScenarioDef } from '../src/types';
import App from '../src/App';
import AdvisorPanel from '../src/components/AdvisorPanel';
import DecisionPanel from '../src/components/DecisionPanel';
import DebriefPanel from '../src/components/DebriefPanel';
import LogPanel from '../src/components/LogPanel';
import PrioritizationPanel from '../src/components/PrioritizationPanel';
import WhatIfPanel from '../src/components/WhatIfPanel';
import { ADVISOR_CACHE } from '../src/data/advisor-cache';
import { advisorAgreement, advisorKey, getAdvisorExchange } from '../src/lib/advisor';
import type { AdvisorMode } from '../src/types';

let passed = 0;
let failed = 0;
function check(name: string, cond: boolean, detail = '') {
  if (cond) {
    passed++;
    console.log(`  PASS  ${name}`);
  } else {
    failed++;
    console.log(`  FAIL  ${name}${detail ? ` — ${detail}` : ''}`);
  }
}

/** Drive a run: tick the clock; when a decision pends, resolve it with the
    chooser's action. Returns the final state. */
function playRun(choose: (id: string) => 'accept' | 'override'): GameState {
  let s = bootLog(initialState('glass'));
  for (let guard = 0; guard < 500 && !s.ended; guard++) {
    if (s.pending) {
      const action = choose(s.pending.id);
      s = reducer(s, {
        type: 'RESOLVE',
        action,
        reason: action === 'override' ? 'Provenance anomaly on the relay feed' : null,
        latencySec: 3,
      });
    } else {
      s = reducer(s, { type: 'TICK' });
    }
  }
  return s;
}

function playToDecision(targetId: string): GameState {
  let s = bootLog(initialState('glass'));
  for (let guard = 0; guard < 500; guard++) {
    if (s.pending) {
      if (s.pending.id === targetId) return s;
      const correct = DECISIONS[s.pending.id].correctAction;
      s = reducer(s, {
        type: 'RESOLVE',
        action: correct,
        reason: correct === 'override' ? 'Provenance anomaly on the relay feed' : null,
        latencySec: 3,
      });
    } else {
      s = reducer(s, { type: 'TICK' });
    }
  }
  throw new Error(`never reached ${targetId}`);
}

console.log('A. v1 confidence values at default weights');
const expected: Record<string, number> = { DP1: 80, DP2: 80, DP3: 71, DP4: 57, DP5: 82 };
for (const [id, want] of Object.entries(expected)) {
  const got = computeConfidence(DECISIONS[id]).value;
  check(`${id} = ${want}%`, got === want, `got ${got}%`);
  const weighted = computeConfidence(DECISIONS[id], DEFAULT_FEED_WEIGHTS).value;
  check(`${id} unchanged with explicit default weights`, weighted === want, `got ${weighted}%`);
}
check('system reliability = 80%', systemReliability(Object.values(DECISIONS)) === 80);

console.log('B. correct-path run (override only DP-3)');
const good = playRun((id) => DECISIONS[id].correctAction);
check('run reaches ENDEX', good.ended);
check('5 decisions recorded', good.records.length === 5, `got ${good.records.length}`);
check('5/5 correct', good.records.every((r) => r.correct === true));
const dp3rec = good.records.find((r) => r.decisionId === 'DP3');
check('DP-3 recorded as override, correct', dp3rec?.action === 'override' && dp3rec?.correct === true);
check('DP-3 confidence shown = 71%', dp3rec?.confidenceShown === 71, `got ${dp3rec?.confidenceShown}`);
check(
  'forensic log records the DP-3 issue at 71%',
  good.log.some((e) => e.kind === 'recommendation' && e.text.includes('DP3 issued') && e.text.includes('Confidence 71%')),
);

console.log('C. accept-everything run');
const naive = playRun(() => 'accept');
const naiveCorrect = naive.records.filter((r) => r.correct).length;
check('4/5 correct', naiveCorrect === 4, `got ${naiveCorrect}`);
check(
  'DP-3 is the only error',
  naive.records.every((r) => (r.decisionId === 'DP3') === (r.correct === false)),
);
check(
  'accepting DP-3 reclassifies U-101 as friendly in the picture',
  naive.tracks['U101'].affiliation === 'friendly',
);

console.log('D. feed re-weighting re-scores DP-3 deterministically');
const sensor2 = computeConfidence(DECISIONS.DP3, { ...DEFAULT_FEED_WEIGHTS, sensor: 2 }).value;
check('sensor ×2 → 48%', sensor2 === 48, `got ${sensor2}%`);
const bf0 = computeConfidence(DECISIONS.DP3, { ...DEFAULT_FEED_WEIGHTS, blueforce: 0 }).value;
check('blueforce ×0 → 68% (standing rule still dominates — the catch survives)', bf0 === 68, `got ${bf0}%`);
check(
  're-score is repeatable',
  computeConfidence(DECISIONS.DP3, { ...DEFAULT_FEED_WEIGHTS, sensor: 2 }).value === sensor2,
);

console.log('E. weight commits and the forensic log');
let s = playToDecision('DP3');
const logAtIssue = s.log.length;
const issued = s.records.find((r) => r.decisionId === 'DP3')?.confidenceShown;
check('DP-3 issued at 71%', issued === 71, `got ${issued}`);
s = reducer(s, {
  type: 'SET_WEIGHTS_LIVE',
  weights: { ...DEFAULT_WEIGHTS, feeds: { ...DEFAULT_FEED_WEIGHTS, sensor: 2 } },
});
check('live slider movement writes no log entry', s.log.length === logAtIssue);
s = reducer(s, { type: 'COMMIT_WEIGHTS' });
check('commit writes exactly one log entry', s.log.length === logAtIssue + 1, `got ${s.log.length - logAtIssue}`);
const commitEntry = s.log[s.log.length - 1];
check('commit entry is an operator entry', commitEntry.kind === 'operator');
check(
  'commit entry states the re-score effect 71% → 48%',
  commitEntry.text.includes('71% → 48%'),
  commitEntry.text,
);
check(
  'commit entry names the changed feed',
  commitEntry.text.includes('Sensor feeds'),
  commitEntry.text,
);
const s2 = reducer(s, { type: 'COMMIT_WEIGHTS' });
check('committing with no further change writes nothing', s2.log.length === s.log.length);
check(
  'the issued DP-3 log entry still says 71% (history not rewritten)',
  s.log.some((e) => e.text.includes('DP3 issued') && e.text.includes('Confidence 71%')),
);

console.log('F. what-if projections from DP-3');
const atDp3 = playToDecision('DP3');
const logLen = atDp3.log.length;
const u101StatusBefore = atDp3.tracks['U101'].status;
const overrideProj = projectBranch(atDp3.tracks, DECISIONS.DP3, 'override');
const acceptProj = projectBranch(atDp3.tracks, DECISIONS.DP3, 'accept');
check(
  'override projection keeps U-101 hostile, relay rejected',
  overrideProj.changes.some(
    (c) => c.trackId === 'U101' && c.field === 'status' && c.to.includes('relay report rejected'),
  ),
  JSON.stringify(overrideProj.changes),
);
check(
  'accept projection reclassifies U-101 as friendly',
  acceptProj.changes.some(
    (c) => c.trackId === 'U101' && c.field === 'affiliation' && c.to === 'friendly',
  ),
  JSON.stringify(acceptProj.changes),
);
check(
  'the two projections diverge on U-101 affiliation',
  overrideProj.tracksAfter['U101'].affiliation === 'hostile' &&
    acceptProj.tracksAfter['U101'].affiliation === 'friendly',
);
check('branching mutated no tracks', atDp3.tracks['U101'].status === u101StatusBefore);
check('branching wrote no log entries', atDp3.log.length === logLen);

console.log('G. track attention scoring');
// Play correctly to just after the link restores (T+25): DP-5 still ahead.
let late = bootLog(initialState('glass'));
for (let guard = 0; guard < 500 && late.clock < 25; guard++) {
  if (late.pending) {
    const correct = DECISIONS[late.pending.id].correctAction;
    late = reducer(late, {
      type: 'RESOLVE',
      action: correct,
      reason: correct === 'override' ? 'Provenance anomaly on the relay feed' : null,
      latencySec: 3,
    });
  } else {
    late = reducer(late, { type: 'TICK' });
  }
}
const scores = scoreTracks(late.tracks, DEFAULT_WEIGHTS.factors);
// Hand-verified against the factor model at the T+25 picture: U-102 is
// unknown (uncertainty 90) and close to friendly forces (proximity 72),
// so it tops an ATTENTION ranking at 53 — ahead of the confirmed hostiles
// U-101 (51) and H-201 (50). Attention is not threat: the threat-only
// check below confirms H-201 leads when threat is all that counts.
const top3 = scores.slice(0, 3).map((x) => `${x.trackId}:${x.total}`);
check(
  'attention top-3 = U-102 (53), U-101 (51), H-201 (50)',
  top3.join(',') === 'U102:53,U101:51,H201:50',
  `got ${top3.join(',')}`,
);
const scoresAgain = scoreTracks(late.tracks, DEFAULT_WEIGHTS.factors);
check('scoring is deterministic', JSON.stringify(scores) === JSON.stringify(scoresAgain));
const threatOnly = scoreTracks(late.tracks, { threat: 2, proximity: 0, uncertainty: 0, staleness: 0 });
check(
  'threat-only weights put the ADA system first',
  threatOnly[0].trackId === 'H201',
  `got ${threatOnly[0].trackId}`,
);

console.log('H. SSR smoke renders');
const init = initialState('glass');
const prioHtml = renderToString(
  React.createElement(PrioritizationPanel, {
    weights: DEFAULT_WEIGHTS,
    tracks: init.tracks,
    mode: 'glass',
    pending: null,
    issuedConfidence: null,
    onLive: () => {},
    onCommit: () => {},
  }),
);
check('prioritization panel renders with sliders labeled', prioHtml.includes('PRIORITIZATION ASSISTANT') && prioHtml.includes('feed-weight-sensor'));
const prioBlack = renderToString(
  React.createElement(PrioritizationPanel, {
    weights: DEFAULT_WEIGHTS,
    tracks: init.tracks,
    mode: 'black',
    pending: null,
    issuedConfidence: null,
    onLive: () => {},
    onCommit: () => {},
  }),
);
check('black-box mode hides the instruments', prioBlack.includes('Black-Box mode') && !prioBlack.includes('type="range"'));
const whatifHtml = renderToString(
  React.createElement(WhatIfPanel, {
    pending: DECISIONS.DP3,
    records: [],
    tracks: atDp3.tracks,
    mode: 'glass',
    clock: 16,
  }),
);
check('what-if panel offers both branch actions', whatifHtml.includes('Project: accept the recommendation') && whatifHtml.includes('Project: override (alternate COA)'));
const dp3Html = renderToString(
  React.createElement(DecisionPanel, {
    decision: DECISIONS.DP3,
    mode: 'glass',
    clock: 16,
    onResolve: () => {},
  }),
);
check('DP-3 decision surface shows 71% at default weights', dp3Html.includes('71%'));
check('DP-3 provenance shows the integrity anomaly', dp3Html.includes('INTEGRITY ANOMALY'));

console.log('I. v3 scenario registry and DARK STRAIT structure');
check('registry holds exactly the two vignettes', SCENARIOS.length === 2, `got ${SCENARIOS.length}`);
check(
  'POISONED PICTURE is first (picker order) and the default',
  SCENARIOS[0].id === 'poisoned-picture' && DEFAULT_SCENARIO.id === 'poisoned-picture',
);
check(
  'initialState() still defaults to POISONED PICTURE',
  initialState('glass').scenario.id === 'poisoned-picture',
);
check('DARK STRAIT lookup by id', SCENARIOS_BY_ID['dark-strait']?.title === 'DARK STRAIT');
check(
  'DARK STRAIT has 5 decision points',
  Object.keys(DARK_STRAIT.decisions).length === 5,
  `got ${Object.keys(DARK_STRAIT.decisions).length}`,
);
check('DARK STRAIT has 16 timed events', DARK_STRAIT.events.length === 16, `got ${DARK_STRAIT.events.length}`);
check('DARK STRAIT ends at T+30', DARK_STRAIT.endTime === 30);
check(
  'DARK STRAIT reliability = 80% (recommender right 4 of 5)',
  systemReliability(Object.values(DARK_STRAIT.decisions)) === 80,
);
check(
  'exactly one DARK STRAIT decision is override-correct (the trap)',
  Object.values(DARK_STRAIT.decisions).filter((d) => d.correctAction === 'override').length === 1,
);
check(
  'the trap is the declared inject decision, DP-3',
  DARK_STRAIT.inject.decisionId === 'DP3' &&
    DARK_STRAIT.decisions[DARK_STRAIT.inject.decisionId].correctAction === DARK_STRAIT.inject.correctAction,
);
for (const sc of SCENARIOS) {
  const ids = sc.events.map((e) => e.id);
  check(
    `${sc.title}: event ids unique, every decision event resolves`,
    new Set(ids).size === ids.length &&
      sc.events.every((e) => !e.decisionId || sc.decisions[e.decisionId] !== undefined),
  );
  check(
    `${sc.title}: exactly one degrade and one restore event`,
    sc.events.filter((e) => e.setLinkDegraded === true).length === 1 &&
      sc.events.filter((e) => e.setLinkDegraded === false).length === 1,
  );
}

console.log('J. DARK STRAIT confidence values at default weights');
const expectedS2: Record<string, number> = { DP1: 80, DP2: 79, DP3: 71, DP4: 57, DP5: 82 };
for (const [id, want] of Object.entries(expectedS2)) {
  const got = computeConfidence(DARK_STRAIT.decisions[id]).value;
  check(`DARK STRAIT ${id} = ${want}%`, got === want, `got ${got}%`);
}
const s2Sensor2 = computeConfidence(DARK_STRAIT.decisions.DP3, { ...DEFAULT_FEED_WEIGHTS, sensor: 2 }).value;
check('DARK STRAIT DP-3 catch survives sensor ×2 → 48%', s2Sensor2 === 48, `got ${s2Sensor2}%`);
const s2Bf0 = computeConfidence(DARK_STRAIT.decisions.DP3, { ...DEFAULT_FEED_WEIGHTS, blueforce: 0 }).value;
check(
  'DARK STRAIT DP-3 catch survives blueforce ×0 → 68% (precedence rule still dominates)',
  s2Bf0 === 68,
  `got ${s2Bf0}%`,
);

/** Drive a full run of an arbitrary scenario (v3 sections). */
function playRunIn(
  scenario: ScenarioDef,
  choose: (id: string) => 'accept' | 'override',
): GameState {
  let s = bootLog(initialState('glass', scenario));
  for (let guard = 0; guard < 500 && !s.ended; guard++) {
    if (s.pending) {
      const action = choose(s.pending.id);
      s = reducer(s, {
        type: 'RESOLVE',
        action,
        reason: action === 'override' ? 'Provenance anomaly on the AIS relay' : null,
        latencySec: 3,
      });
    } else {
      s = reducer(s, { type: 'TICK' });
    }
  }
  return s;
}

console.log('K. DARK STRAIT full runs');
const good2 = playRunIn(DARK_STRAIT, (id) => DARK_STRAIT.decisions[id].correctAction);
check('DARK STRAIT run reaches ENDEX', good2.ended);
check('DARK STRAIT records 5 decisions', good2.records.length === 5, `got ${good2.records.length}`);
check('DARK STRAIT correct path scores 5/5', good2.records.every((r) => r.correct === true));
const s2dp3 = good2.records.find((r) => r.decisionId === 'DP3');
check(
  'DARK STRAIT DP-3 recorded as override at 71%',
  s2dp3?.action === 'override' && s2dp3?.confidenceShown === 71,
  `got action=${s2dp3?.action} conf=${s2dp3?.confidenceShown}`,
);
check(
  'forensic log records the DARK STRAIT DP-3 issue at 71%',
  good2.log.some((e) => e.kind === 'recommendation' && e.text.includes('DP3 issued') && e.text.includes('Confidence 71%')),
);
check(
  'catching the spoof leaves E-203 never friendly, H-204 hostile on the picture',
  good2.tracks['E203'].affiliation === 'unknown' && good2.tracks['H204'].affiliation === 'hostile',
);
const naive2 = playRunIn(DARK_STRAIT, () => 'accept');
check(
  'DARK STRAIT accept-everything scores 4/5',
  naive2.records.filter((r) => r.correct).length === 4,
  `got ${naive2.records.filter((r) => r.correct).length}`,
);
check(
  'DARK STRAIT DP-3 is the only accept-everything error',
  naive2.records.every((r) => (r.decisionId === 'DP3') === (r.correct === false)),
);
check(
  'accepting the spoof leaves E-203 classified friendly (the cost persists)',
  naive2.tracks['E203'].affiliation === 'friendly',
);
const replay2 = playRunIn(DARK_STRAIT, (id) => DARK_STRAIT.decisions[id].correctAction);
check(
  'DARK STRAIT replay is deterministic (records identical)',
  JSON.stringify(replay2.records) === JSON.stringify(good2.records),
);
check(
  'DARK STRAIT replay is deterministic (final picture identical)',
  JSON.stringify(replay2.tracks) === JSON.stringify(good2.tracks),
);
check(
  'DARK STRAIT what-if from DP-3 diverges on E-203 affiliation',
  (() => {
    let s = bootLog(initialState('glass', DARK_STRAIT));
    for (let guard = 0; guard < 500 && s.pending?.id !== 'DP3'; guard++) {
      if (s.pending) {
        const correct = DARK_STRAIT.decisions[s.pending.id].correctAction;
        s = reducer(s, {
          type: 'RESOLVE',
          action: correct,
          reason: correct === 'override' ? 'Provenance anomaly on the AIS relay' : null,
          latencySec: 3,
        });
      } else {
        s = reducer(s, { type: 'TICK' });
      }
    }
    const acc = projectBranch(s.tracks, DARK_STRAIT.decisions.DP3, 'accept');
    const ovr = projectBranch(s.tracks, DARK_STRAIT.decisions.DP3, 'override');
    return (
      acc.tracksAfter['E203'].affiliation === 'friendly' &&
      ovr.tracksAfter['E203'].affiliation === 'unknown' &&
      s.tracks['E203'].affiliation === 'unknown'
    );
  })(),
);

console.log('K2. SET_SCENARIO / RESET semantics');
const base = bootLog(initialState('glass'));
const switched = reducer(base, { type: 'SET_SCENARIO', scenarioId: 'dark-strait' });
check('SET_SCENARIO loads DARK STRAIT', switched.scenario.id === 'dark-strait');
check(
  'SET_SCENARIO deals the maritime picture (FFG present, A/1-7 absent)',
  switched.tracks['FFG'] !== undefined && switched.tracks['A17'] === undefined,
);
check(
  'SET_SCENARIO logs the load and fires the new SITREP',
  switched.log.some((e) => e.text.includes('Scenario loaded — DARK STRAIT')) &&
    switched.log.some((e) => e.text.includes('SITREP — convoy forming up')),
);
check(
  'SET_SCENARIO with an unknown id is a no-op',
  reducer(base, { type: 'SET_SCENARIO', scenarioId: 'nope' }) === base,
);
check(
  'RESET keeps the loaded vignette',
  reducer(switched, { type: 'RESET' }).scenario.id === 'dark-strait',
);
check(
  'switching back restores POISONED PICTURE',
  reducer(switched, { type: 'SET_SCENARIO', scenarioId: 'poisoned-picture' }).scenario.id ===
    'poisoned-picture',
);

console.log('L. SSR smoke renders (v3)');
const appHtml = renderToString(React.createElement(App));
check(
  'app renders the vignette picker with both scenarios, POISONED PICTURE active by default',
  appHtml.includes('POISONED PICTURE') && appHtml.includes('DARK STRAIT'),
);
const s2dp3Html = renderToString(
  React.createElement(DecisionPanel, {
    decision: DARK_STRAIT.decisions.DP3,
    mode: 'glass',
    clock: 16,
    onResolve: () => {},
  }),
);
check('DARK STRAIT DP-3 surface shows 71% at default weights', s2dp3Html.includes('71%'));
check('DARK STRAIT DP-3 provenance shows the integrity anomaly', s2dp3Html.includes('INTEGRITY ANOMALY'));
const s2Debrief = renderToString(
  React.createElement(DebriefPanel, {
    records: [
      {
        decisionId: 'DP3',
        title: DARK_STRAIT.decisions.DP3.title,
        issuedAt: 16,
        resolvedAt: 16,
        action: 'accept' as const,
        reason: null,
        confidenceShown: 71,
        correct: false,
        latencySec: 3,
        advisorVerdict: null,
        advisorAgrees: null,
      },
    ],
    mode: 'glass' as const,
    ended: false,
    decisions: DARK_STRAIT.decisions,
    inject: DARK_STRAIT.inject,
  }),
);
check(
  'debrief renders the scenario-declared missed-inject verdict',
  s2Debrief.includes('spoofed AIS identity was accepted'),
  s2Debrief.slice(0, 200),
);

console.log('M. Model Advisor (hackathon build) — cache completeness and honesty labels');
for (const sc of SCENARIOS) {
  for (const d of Object.values(sc.decisions)) {
    const out = ADVISOR_CACHE[advisorKey(sc.id, d.id)];
    check(
      `cache covers ${sc.id}:${d.id}`,
      !!out && out.citations.every((c) => d.inputs.some((i) => i.id === c)),
      out ? 'citation does not resolve to a decision input' : 'missing cache entry',
    );
  }
}
check(
  'Advisor concurs at both DP-3 traps (wrong by design — the catch is provenance, not a rescue)',
  ADVISOR_CACHE['poisoned-picture:DP3'].agreesWithCore === true &&
    ADVISOR_CACHE['dark-strait:DP3'].agreesWithCore === true,
);
check(
  'Advisor leans alternate at both DP-4s (the scripted contradiction-flag beat)',
  ADVISOR_CACHE['poisoned-picture:DP4'].agreesWithCore === false &&
    ADVISOR_CACHE['dark-strait:DP4'].agreesWithCore === false,
);
check(
  'no cache entry claims to be a live response (all labeled cached by construction)',
  Object.values(ADVISOR_CACHE).every((o) => o.headline.length > 0 && o.reasoning.length > 0),
);

console.log('M2. Advisor in a live run (default Cached mode)');
check(
  'cached correct-path run still scores 5/5 — the Advisor never touches core scoring',
  good.records.every((r) => r.correct === true) && good.records.length === 5,
);
check(
  'every record on the cached run carries an Advisor verdict',
  good.records.every((r) => r.advisorVerdict !== null),
);
const goodAgreement = advisorAgreement(good.records);
check(
  'Advisor agreement on the correct path = 4/5 (disagrees only at DP-4)',
  goodAgreement.agreed === 4 && goodAgreement.total === 5 && goodAgreement.rate === 80,
  `got ${goodAgreement.agreed}/${goodAgreement.total}`,
);
check(
  'model log holds one exchange per decision point (5)',
  good.modelLog.length === 5,
  `got ${good.modelLog.length}`,
);
check(
  'every model log exchange is labeled source=cached with a prompt and a labeled raw response',
  good.modelLog.every(
    (m) =>
      m.source === 'cached' &&
      m.prompt.includes(m.key.split(':')[1]) &&
      m.response.includes('CACHED ADVISOR OUTPUT'),
  ),
);
check(
  'action log records the DP-4 contradiction flag',
  good.log.some((e) => e.kind === 'advisor' && e.text.includes('CONTRADICTION FLAG')),
);
check(
  'naive accept-everything run: DP-3 Advisor verdict concurs with the wrong core call',
  naive.records.find((r) => r.decisionId === 'DP3')?.advisorAgrees === true &&
    naive.records.find((r) => r.decisionId === 'DP3')?.correct === false,
);

console.log('M3. Deterministic mode and the Live label guard');
function playRunAdvisor(
  scenario: ScenarioDef,
  advisorMode: AdvisorMode,
  choose: (id: string) => 'accept' | 'override',
): GameState {
  let s = bootLog(initialState('glass', scenario, advisorMode));
  for (let guard = 0; guard < 500 && !s.ended; guard++) {
    if (s.pending) {
      const action = choose(s.pending.id);
      s = reducer(s, {
        type: 'RESOLVE',
        action,
        reason: action === 'override' ? 'Provenance anomaly' : null,
        latencySec: 3,
      });
    } else {
      s = reducer(s, { type: 'TICK' });
    }
  }
  return s;
}
const det = playRunAdvisor(DEFAULT_SCENARIO, 'deterministic', (id) => DECISIONS[id].correctAction);
check('deterministic run still scores 5/5', det.records.every((r) => r.correct === true));
check(
  'deterministic run: no Advisor verdicts recorded and the model log stays empty',
  det.records.every((r) => r.advisorVerdict === null) && det.modelLog.length === 0,
);
const liveExchange = getAdvisorExchange('live', DEFAULT_SCENARIO, DECISIONS.DP1);
check(
  'Live mode in this build never labels cached output as live (honesty guard)',
  liveExchange !== null && liveExchange.source === 'cached',
  `got source=${liveExchange?.source}`,
);
const modeBase = bootLog(initialState('glass'));
const modeLogged = reducer(modeBase, { type: 'SET_ADVISOR_MODE', advisorMode: 'deterministic' });
check(
  'SET_ADVISOR_MODE writes exactly one forensic log entry',
  modeLogged.log.length === modeBase.log.length + 1 &&
    modeLogged.log[modeLogged.log.length - 1].text.includes('DETERMINISTIC'),
);
check(
  'SET_ADVISOR_MODE to the current mode is a no-op',
  reducer(modeBase, { type: 'SET_ADVISOR_MODE', advisorMode: 'cached' }) === modeBase,
);

console.log('M4. Advisor SSR smoke renders');
const dp4Exchange = getAdvisorExchange('cached', DEFAULT_SCENARIO, DECISIONS.DP4);
const advisorHtml = renderToString(
  React.createElement(AdvisorPanel, {
    decision: DECISIONS.DP4,
    exchange: dp4Exchange,
    advisorMode: 'cached' as const,
    coreConfidence: 57,
    clock: 22,
  }),
);
check('AdvisorPanel renders the DP-4 contradiction flag', advisorHtml.includes('Contradiction flag'));
check(
  'AdvisorPanel discloses cached output on screen',
  advisorHtml.includes('CACHED') && advisorHtml.includes('NOT A LIVE MODEL RESPONSE'),
);
const advisorSilentHtml = renderToString(
  React.createElement(AdvisorPanel, {
    decision: DECISIONS.DP1,
    exchange: null,
    advisorMode: 'deterministic' as const,
    coreConfidence: 80,
    clock: 6,
  }),
);
check('AdvisorPanel explains itself in deterministic mode', advisorSilentHtml.includes('Advisor is muted'));
const modelLogHtml = renderToString(
  React.createElement(LogPanel, { log: good.log, modelLog: good.modelLog }),
);
check(
  'LogPanel renders the model log tab with exchanges',
  modelLogHtml.includes('Model log') && modelLogHtml.includes('poisoned-picture:DP1'),
);
const goodDebrief = renderToString(
  React.createElement(DebriefPanel, {
    records: good.records,
    mode: 'glass' as const,
    ended: true,
    decisions: DECISIONS,
    inject: DEFAULT_SCENARIO.inject,
  }),
);
check(
  'debrief renders the Advisor agreement score alongside reliance',
  // SSR inserts <!-- --> between text nodes and expressions; strip them.
  goodDebrief.replace(/<!-- -->/g, '').includes('Model Advisor agreement') &&
    goodDebrief.replace(/<!-- -->/g, '').includes('concurred on 4 of 5'),
);

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);

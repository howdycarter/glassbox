import type {
  AdvisorMode,
  DecisionDef,
  DecisionRecord,
  LogEntry,
  Mode,
  ModelLogEntry,
  PriorityWeights,
  ScenarioDef,
  TrackEffect,
  TrackState,
} from '../types';
import { DEFAULT_SCENARIO, SCENARIOS_BY_ID } from '../data/scenarios';
import { computeConfidence } from './recommender';
import { DEFAULT_WEIGHTS, describeWeightChanges, weightsEqual } from './prioritization';
import { buildAdvisorPrompt, getAdvisorExchange, serializeAdvisorResponse } from './advisor';

/* Scenario engine: a deterministic reducer. Events fire off the scenario
   clock; decision events pause the clock until the operator acts. Every
   event, recommendation (with its input snapshot), and operator action is
   appended to the forensic log. The engine is scenario-agnostic (v3):
   the loaded vignette travels in state and supplies the events,
   decisions, clock length, and link-degradation points. */

export interface GameState {
  clock: number;
  playing: boolean;
  ended: boolean;
  mode: Mode;
  /** The loaded vignette (v3). Defaults to POISONED PICTURE. */
  scenario: ScenarioDef;
  tracks: Record<string, TrackState>;
  fired: string[];
  pending: DecisionDef | null;
  records: DecisionRecord[];
  log: LogEntry[];
  logSeq: number;
  linkDegraded: boolean;
  /** Prioritization Assistant weights, live (v2). Operator console state:
      they persist across Reset, like the display mode. */
  weights: PriorityWeights;
  /** The weight set last committed to the forensic log. A committed
      re-weighting is a deliberate operator act and is logged with its
      effect on any pending recommendation; live slider movement is not. */
  committedWeights: PriorityWeights;
  /** Model Advisor mode (hackathon build): Live / Cached / Deterministic.
      Operator console state like the display mode — persists across
      Reset and vignette switches. Default: Cached (the demo-safe rung
      of the failure ladder; the full demo runs from it with no key). */
  advisorMode: AdvisorMode;
  /** Forensic model log: one entry per Advisor exchange — full prompt
      and raw response, labeled by source. Run state; cleared on Reset. */
  modelLog: ModelLogEntry[];
  modelLogSeq: number;
}

export function initialState(
  mode: Mode = 'glass',
  scenario: ScenarioDef = DEFAULT_SCENARIO,
  advisorMode: AdvisorMode = 'cached',
): GameState {
  const tracks: Record<string, TrackState> = {};
  for (const t of scenario.initialTracks) {
    tracks[t.id] = { ...t, stale: false, visible: true };
  }
  return {
    clock: 0,
    playing: false,
    ended: false,
    mode,
    scenario,
    tracks,
    fired: [],
    pending: null,
    records: [],
    log: [],
    logSeq: 0,
    linkDegraded: false,
    weights: structuredClone(DEFAULT_WEIGHTS),
    committedWeights: structuredClone(DEFAULT_WEIGHTS),
    advisorMode,
    modelLog: [],
    modelLogSeq: 0,
  };
}

function pushLog(state: GameState, kind: LogEntry['kind'], t: number, text: string): GameState {
  const entry: LogEntry = { seq: state.logSeq, t, kind, text };
  return { ...state, log: [...state.log, entry], logSeq: state.logSeq + 1 };
}

/** Apply track effects to a state — exported for the What-If projector,
    which simulates COAs on a snapshot without touching the live run. */
export function applyEffects(state: GameState, effects: TrackEffect[] | undefined): GameState {
  if (!effects || effects.length === 0) return state;
  const tracks = { ...state.tracks };
  for (const eff of effects) {
    if (eff.add) {
      tracks[eff.trackId] = { ...eff.add, stale: false, visible: true };
    } else if (eff.set && tracks[eff.trackId]) {
      tracks[eff.trackId] = { ...tracks[eff.trackId], ...eff.set };
    }
  }
  return { ...state, tracks };
}

function fmtClock(t: number): string {
  return `T+${String(t).padStart(2, '0')}`;
}
export { fmtClock };

export type Action =
  | { type: 'PLAY' }
  | { type: 'PAUSE' }
  | { type: 'TICK' }
  | { type: 'RESET' }
  | { type: 'SET_SCENARIO'; scenarioId: string }
  | { type: 'SET_MODE'; mode: Mode }
  | { type: 'SET_ADVISOR_MODE'; advisorMode: AdvisorMode }
  | { type: 'SET_WEIGHTS_LIVE'; weights: PriorityWeights }
  | { type: 'COMMIT_WEIGHTS' }
  | { type: 'RESOLVE'; action: 'accept' | 'override'; reason: string | null; latencySec: number };

export function reducer(state: GameState, action: Action): GameState {
  switch (action.type) {
    case 'SET_MODE':
      return { ...state, mode: action.mode };

    case 'SET_ADVISOR_MODE': {
      if (action.advisorMode === state.advisorMode) return state;
      // Console state (like the display mode): switching the Advisor
      // mode mid-run affects decision points issued from now on;
      // exchanges already logged stand as issued.
      return pushLog(
        { ...state, advisorMode: action.advisorMode },
        'system',
        state.clock,
        `Model Advisor mode set to ${action.advisorMode.toUpperCase()}.` +
          (action.advisorMode === 'deterministic'
            ? ' The Advisor is silent; the deterministic core runs alone (v4 baseline).'
            : ' The deterministic core remains the recommendation of record.'),
      );
    }

    case 'SET_WEIGHTS_LIVE':
      // Slider movement: state updates so every surface responds at once,
      // but nothing is written to the forensic log until the operator
      // commits the re-weighting (COMMIT_WEIGHTS).
      return { ...state, weights: action.weights };

    case 'COMMIT_WEIGHTS': {
      if (weightsEqual(state.committedWeights, state.weights)) return state;
      const changes = describeWeightChanges(state.committedWeights, state.weights);
      let s: GameState = { ...state, committedWeights: state.weights };
      let text = `Operator re-weighted the Prioritization Assistant — ${changes.join('; ')}.`;
      if (s.pending) {
        const issued = s.records.find((r) => r.decisionId === s.pending!.id)?.confidenceShown;
        const rescored = computeConfidence(s.pending, s.weights.feeds).value;
        if (issued !== undefined && issued !== rescored) {
          text += ` Pending ${s.pending.id} re-scored ${issued}% → ${rescored}% under the new weights; the issued confidence in the log stands.`;
        } else {
          text += ` Pending ${s.pending.id} confidence unchanged at ${rescored}%.`;
        }
      }
      s = pushLog(s, 'operator', s.clock, text);
      return s;
    }

    case 'PLAY':
      if (state.pending || state.ended) return state;
      return { ...state, playing: true };

    case 'PAUSE':
      return { ...state, playing: false };

    case 'SET_SCENARIO': {
      const scenario = SCENARIOS_BY_ID[action.scenarioId];
      if (!scenario || scenario.id === state.scenario.id) return state;
      // Loading a vignette starts a fresh run of it. Weights are operator
      // console state and carry over, as on Reset; the log says which
      // vignette was loaded so the new run's record is unambiguous.
      const fresh = initialState(state.mode, scenario, state.advisorMode);
      const withWeights: GameState = {
        ...fresh,
        weights: state.weights,
        committedWeights: state.weights,
      };
      const logged = pushLog(
        withWeights,
        'system',
        0,
        `Scenario loaded — ${scenario.title}. All data synthetic; ground truth fixed for this vignette.`,
      );
      return bootLog(logged);
    }

    case 'RESET': {
      const fresh = initialState(state.mode, state.scenario, state.advisorMode);
      // Weights are operator console state and persist across a reset,
      // like the display mode; the reset log entry says so when they are
      // not at defaults, so the new run's record stays honest.
      const withWeights: GameState = {
        ...fresh,
        weights: state.weights,
        committedWeights: state.weights,
      };
      const nonDefault = !weightsEqual(state.weights, DEFAULT_WEIGHTS);
      return pushLog(
        withWeights,
        'system',
        0,
        nonDefault
          ? 'Scenario reset. All data synthetic; ground truth unchanged. Prioritization weights carried over from the previous run (see the Prioritization Assistant).'
          : 'Scenario reset. All data synthetic; ground truth unchanged.',
      );
    }

    case 'TICK': {
      if (state.pending || state.ended) return state;
      const next = state.clock + 1;
      if (next > state.scenario.endTime) return { ...state, playing: false, ended: true };
      let s: GameState = { ...state, clock: next };

      for (const ev of state.scenario.events.filter((e) => e.t === next && !s.fired.includes(e.id))) {
        s = { ...s, fired: [...s.fired, ev.id] };
        s = applyEffects(s, ev.effects);

        if (ev.setLinkDegraded !== undefined) {
          s = { ...s, linkDegraded: ev.setLinkDegraded };
        }

        const logKind: LogEntry['kind'] =
          ev.kind === 'inject' ? 'inject' : ev.kind === 'comms' ? 'comms' : 'event';
        s = pushLog(s, logKind, ev.t, `${ev.headline} — ${ev.detail}`);

        if (ev.kind === 'decision' && ev.decisionId) {
          const def = state.scenario.decisions[ev.decisionId];
          const conf = computeConfidence(def, s.weights.feeds);
          s = { ...s, pending: def, playing: false };
          s = {
            ...s,
            records: [
              ...s.records,
              {
                decisionId: def.id,
                title: def.title,
                issuedAt: ev.t,
                resolvedAt: null,
                action: null,
                reason: null,
                confidenceShown: conf.value,
                correct: null,
                latencySec: null,
                advisorVerdict: null,
                advisorAgrees: null,
              },
            ],
          };
          const snapshot = def.inputs
            .map((i) => `${i.source} [actual age ${i.ageMin} min, reliability ${i.reliability.toFixed(2)}, ${i.supports ? 'supports' : 'opposes'}]`)
            .join('; ');
          s = pushLog(
            s,
            'recommendation',
            ev.t,
            `${def.id} issued — "${def.recommendation}" Confidence ${conf.value}%. Input snapshot: ${snapshot}.`,
          );

          // Model Advisor — additive second voice, in parallel. The
          // exchange is recorded on the decision record (for the
          // debrief's second score) and in the forensic model log
          // (full prompt + raw response). The core record above is
          // untouched by anything the Advisor says.
          const exchange = getAdvisorExchange(s.advisorMode, state.scenario, def);
          if (exchange) {
            s = {
              ...s,
              records: s.records.map((r) =>
                r.decisionId === def.id
                  ? {
                      ...r,
                      advisorVerdict: exchange.output.verdict,
                      advisorAgrees: exchange.output.agreesWithCore,
                    }
                  : r,
              ),
              modelLog: [
                ...s.modelLog,
                {
                  seq: s.modelLogSeq,
                  t: ev.t,
                  key: exchange.key,
                  source: exchange.source,
                  model: exchange.model,
                  prompt: buildAdvisorPrompt(state.scenario, def),
                  response: serializeAdvisorResponse(exchange.output, exchange.source),
                  latencyMs: null,
                },
              ],
              modelLogSeq: s.modelLogSeq + 1,
            };
            s = pushLog(
              s,
              'advisor',
              ev.t,
              `Model Advisor (${exchange.source}) on ${def.id}: ${exchange.output.verdict.toUpperCase()} — ${exchange.output.headline}` +
                (exchange.output.agreesWithCore
                  ? ' Concurs with the core recommendation.'
                  : ' CONTRADICTION FLAG: the Advisor disagrees with the core recommendation — both positions stand for the operator.'),
            );
          }
        }

        if (ev.kind === 'endex') {
          s = { ...s, ended: true, playing: false };
          s = pushLog(s, 'system', ev.t, 'ENDEX — debrief available. Ground truth revealed.');
        }
      }
      return s;
    }

    case 'RESOLVE': {
      const def = state.pending;
      if (!def) return state;
      const effects = action.action === 'accept' ? def.onAccept : def.onOverride;
      let s = applyEffects(state, effects);
      const correct = action.action === def.correctAction;
      s = {
        ...s,
        pending: null,
        records: s.records.map((r) =>
          r.decisionId === def.id
            ? {
                ...r,
                resolvedAt: s.clock,
                action: action.action,
                reason: action.reason,
                correct,
                latencySec: action.latencySec,
              }
            : r,
        ),
      };
      s = pushLog(
        s,
        'operator',
        s.clock,
        action.action === 'accept'
          ? `Operator ACCEPTED ${def.id} (${def.title}) after ${action.latencySec}s deliberation. Recommendation executed as issued.`
          : `Operator OVERRODE ${def.id} (${def.title}) after ${action.latencySec}s deliberation. Reason: ${action.reason ?? 'not stated'}.`,
      );
      return s;
    }

    default:
      return state;
  }
}

/** Fire the scenario's T+0 SITREP once, at mount/reset display time. */
export function bootLog(state: GameState): GameState {
  const sitrep = state.scenario.events.find((e) => e.t === 0);
  if (!sitrep || state.fired.includes(sitrep.id)) return state;
  const s = { ...state, fired: [...state.fired, sitrep.id] };
  return pushLog(s, 'event', 0, `${sitrep.headline} — ${sitrep.detail}`);
}

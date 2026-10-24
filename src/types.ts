/* Glass-Box C2 — shared types.
   All scenario content is synthetic and local. See SPEC.md. */

export type Affiliation = 'friendly' | 'hostile' | 'unknown';
export type Mode = 'glass' | 'black';
export type Integrity = 'ok' | 'stale' | 'anomaly';

/** A map track as defined in the scenario data. */
export interface TrackDef {
  id: string;
  label: string;
  short: string;
  affiliation: Affiliation;
  kind: string;
  x: number; // 0..100 grid
  y: number; // 0..70 grid
}

/** Runtime track state (scenario definition + live mutations). */
export interface TrackState extends TrackDef {
  status: string;
  stale: boolean;
  visible: boolean;
}

/**
 * Feed class of an input — the Prioritization Assistant's unit of
 * re-weighting. The operator weights classes of evidence, not individual
 * messages, so a single spoofed feed cannot be quietly amplified.
 */
export type FeedClass = 'sensor' | 'sigint' | 'blueforce' | 'link';

/** One key input behind a recommendation — one row of the provenance strip. */
export interface FeedInput {
  id: string;
  source: string;
  /** Which class of evidence this input belongs to (v2: re-weightable). */
  feedClass: FeedClass;
  claim: string;
  /** Actual age of the data at decision time, scenario-minutes. What provenance shows. */
  ageMin: number;
  /**
   * Age the fusion rules believed, when different. The spoofed relay claims
   * freshness it does not have; the recommender used the claimed value, the
   * provenance strip shows the real one. That gap is the catch.
   */
  claimedAgeMin?: number;
  reliability: number; // 0..1 source reliability prior
  supports: boolean; // supports the recommendation as issued?
  integrity: Integrity;
}

/** A mutation to the situation picture, applied when an event fires
    or when a decision resolves a particular way. */
export interface TrackEffect {
  trackId: string;
  add?: TrackDef & { status: string };
  set?: Partial<Pick<TrackState, 'affiliation' | 'x' | 'y' | 'status' | 'stale'>>;
}

export interface DecisionDef {
  id: string;
  title: string;
  /** The primary recommendation, as the system issues it. */
  recommendation: string;
  /** Alternate course of action (COA Workbench: never one opaque answer). */
  alternateCoa?: string;
  /** Reasoning bullets — glass-box mode only. */
  reasoning: string[];
  inputs: FeedInput[];
  /** Human-readable conflict descriptions — glass-box mode only. */
  contradictions?: string[];
  /** True when the decision is issued over the degraded link. */
  linkDegraded?: boolean;
  /** Standing rule invoked by the recommender (e.g. fratricide-avoidance precedence). */
  ruleApplied?: { label: string; weight: number };
  /** Ground truth: the action a correct operator takes. */
  correctAction: 'accept' | 'override';
  /** Ground truth explanation, revealed only in the debrief. */
  groundTruth: string;
  onAccept: TrackEffect[];
  onOverride: TrackEffect[];
  overrideReasons: string[];
}

export type EventKind = 'info' | 'track' | 'inject' | 'comms' | 'decision' | 'endex';

export interface ScenarioEvent {
  t: number; // scenario minute at which the event fires
  id: string;
  kind: EventKind;
  headline: string;
  detail: string;
  effects?: TrackEffect[];
  decisionId?: string;
  /**
   * When set, firing this event drives the engine's degraded-link state
   * (v3: scenario data declares it; the engine no longer hardcodes which
   * event ids degrade or restore the link).
   */
  setLinkDegraded?: boolean;
}

/** The debrief's bad-inject verdict, declared per vignette (v3) so the
    debrief panel renders any scenario's trap without hardcoded copy. */
export interface InjectReport {
  /** The decision point that carries the deliberate bad inject. */
  decisionId: string;
  /** The correct operator action on that decision. */
  correctAction: 'accept' | 'override';
  pendingText: string;
  caughtText: string;
  missedText: string;
}

/**
 * One playable vignette, bundled (v3). The engine, recommender, and
 * panels are scenario-agnostic; everything scenario-specific lives in
 * a ScenarioDef. POISONED PICTURE is the default and is unchanged.
 */
export interface ScenarioDef {
  id: string;
  title: string;
  subtitle: string;
  endTime: number; // scenario minute of ENDEX
  initialTracks: (TrackDef & { status: string })[];
  decisions: Record<string, DecisionDef>;
  events: ScenarioEvent[];
  inject: InjectReport;
  /** Situation-map annotation labels (schematic flavor per vignette). */
  mapLabels: { boundary: string; approach: string };
}

export interface LogEntry {
  seq: number;
  t: number;
  kind: 'event' | 'inject' | 'comms' | 'recommendation' | 'operator' | 'system' | 'advisor';
  text: string;
}

/** Operator-set weights for the Prioritization Assistant (v2).
    All weights default to 1.0, which reproduces the v1 model exactly. */
export interface FeedWeights {
  sensor: number;
  sigint: number;
  blueforce: number;
  link: number;
}

export type FactorKey = 'threat' | 'proximity' | 'uncertainty' | 'staleness';

export interface FactorWeights {
  threat: number;
  proximity: number;
  uncertainty: number;
  staleness: number;
}

export interface PriorityWeights {
  feeds: FeedWeights;
  factors: FactorWeights;
}

/* ---- Model Advisor (hackathon build) ----
   A second, additive voice beside the deterministic core. The core's
   recommendation is always the recommendation of record; the Advisor
   never re-scores, overrides, or edits it. See SPEC.md / README. */

export type AdvisorMode = 'live' | 'cached' | 'deterministic';

/**
 * Where an Advisor output actually came from, after the failure ladder:
 * 'live' = a real Meta Model API response; 'cached' = the authored cache
 * in src/data/advisor-cache.ts, disclosed on screen as cached.
 * 'deterministic' mode has no Advisor output at all (null source).
 */
export type AdvisorSource = 'live' | 'cached';

export type AdvisorVerdict = 'concur' | 'lean-alternate' | 'disagree';

export interface AdvisorOutput {
  verdict: AdvisorVerdict;
  /** The bold verdict line, e.g. "Concur — designate HOSTILE." */
  headline: string;
  /** Reasoning bullets, in the shape DecisionPanel renders. */
  reasoning: string[];
  /** The Advisor's own read of how much its verdict should be trusted. */
  confidenceRead: string;
  /** Decision input ids this output rests on (provenance citations). */
  citations: string[];
  /** True when the verdict concurs with the core recommendation. */
  agreesWithCore: boolean;
}

/** One Advisor output as issued at a decision point (forensic record). */
export interface AdvisorExchange {
  /** `${scenarioId}:${decisionId}` */
  key: string;
  scenarioId: string;
  decisionId: string;
  source: AdvisorSource;
  /** Model of record for live output; target model for cached output. */
  model: string;
  output: AdvisorOutput;
}

/** Forensic model log entry: the full prompt + raw response, per exchange. */
export interface ModelLogEntry {
  seq: number;
  /** Scenario clock minute at issue. */
  t: number;
  key: string;
  source: AdvisorSource;
  model: string;
  /** The exact prompt the live integration sends (built from scenario state). */
  prompt: string;
  /** Raw response text: the serialized Advisor output, labeled by source. */
  response: string;
  /** Live-call latency when measured; null for cached output. */
  latencyMs: number | null;
}

export interface DecisionRecord {
  decisionId: string;
  title: string;
  issuedAt: number;
  resolvedAt: number | null;
  action: 'accept' | 'override' | null;
  reason: string | null;
  confidenceShown: number;
  correct: boolean | null;
  /** Real seconds the operator spent with the recommendation open. */
  latencySec: number | null;
  /** Model Advisor verdict at this decision point, when the Advisor was
      active (null in Deterministic mode). Reported in the debrief
      ALONGSIDE — never instead of — the core's reliance scoring. */
  advisorVerdict: AdvisorVerdict | null;
  /** Whether the Advisor concurred with the core recommendation. */
  advisorAgrees: boolean | null;
}

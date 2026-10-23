# Glass-Box — Prototype Specification (v1)

**Newton & Carter LLC** — independent R&D prototype. Public build prepared for the Meta AI Developer Hackathon (October 26 – November 4, 2026).

## Concept

An interactive, fully synthetic decision-support prototype for a contested-network C2 problem. The adversary is not only maneuvering — it is attacking the *picture*: spoofing a friendly-force report and degrading the primary link. The prototype's job is to make data integrity a visible property of the display, so a poisoned input loses influence visibly instead of silently steering a decision.

The design goal is **calibrated trust, not maximum trust**: an operator who trusts the system exactly as much as it deserves, moment to moment — including when the system is wrong.

Everything in this build is synthetic and local. No network calls, no API keys, no real data. The "AI" recommender is transparent, deterministic rules over scenario state (see `src/lib/recommender.ts`) — its arithmetic is part of the exhibit.

The prototype is a measurement instrument, not a demonstration of transparency for its own sake. Its headline measure is the **appropriate-reliance rate** — the share of decision points where the operator accepts a correct recommendation or rejects a wrong one — with over-reliance and under-reliance reported separately against the recommender's measured reliability. Explanation exists in service of that measurement: it is the control surface through which the operator interrogates and corrects the machine's reasoning, and every correction is recorded as alignment telemetry in the forensic log.

## The glass-box components

The glass-box components, mapped to this build:

| Component | In v1 |
|---|---|
| **COA Workbench** — 2–3 candidate courses of action per decision point, each with rationale, confidence and its drivers, assumptions, predicted effects | Decision surface: primary recommendation + alternate COA, reasoning bullets, computed confidence with a visible driver breakdown |
| **Provenance strip** (cross-cutting) — every machine-generated element carries source, model/version, timestamp | Provenance strip on every recommendation: each key input with source, actual age, staleness/integrity flags |
| **Human override built in** (Adaptive Automation Governor, recommend-and-confirm level) — automation never expands its own authority; consequential actions are operator-confirmed and auditable | Accept / Override (with reason) on every decision; nothing executes without the operator; complete forensic action log |
| **Contradiction surfacing** — when feeds disagree, the system shows the conflict and collapses confidence rather than silently fusing | Contradiction flags on the decision surface; confidence model penalizes disagreement and staleness; stale tracks are marked on the map |
| **Prioritization Assistant** — visible, operator-re-weightable scoring of tracks/threats | Built in v2: `src/lib/prioritization.ts`, `src/components/PrioritizationPanel.tsx` (see v2 addendum) |
| **What-If Replanning** — apply a change, see COA deltas side-by-side | Built in v2: `src/lib/whatif.ts`, `src/components/WhatIfPanel.tsx` (see v2 addendum) |

**Mode toggle (the thesis demo).** A Glass-Box / Black-Box ablation switch runs the identical scenario, recommender, and ground truth in two conditions — the A/B structure the measurement depends on:

- **Glass-Box**: recommendation + reasoning + confidence drivers + provenance strip + contradiction flags + alternate COA.
- **Black-Box**: recommendation + confidence number only — the industry default. Same trap, no instruments to catch it with.

## Scenario design — "POISONED PICTURE"

One scripted vignette, ~30 scenario-minutes, 16 timed events, 5 decision points. A division CP monitors a sector: two friendly maneuver companies, a UAS, a fires battery. An unknown column approaches; a second unknown appears near a suspected air-defense site.

**Deliberate injects (the evaluation core):**

1. **INJECT 1 — Spoofed friendly-force report (T+15).** A relayed report claims friendly B/1-7 has advanced into the unknown column's grid — implying the column is friendly. It is false. The recommender's fratricide-avoidance rule (a blue-force report outranks sensor inference for friendly ID) makes it recommend reclassifying the column as friendly at 71% confidence. But its own provenance strip shows the relay message is 14 minutes old (its header claims 1), single-source, with a routing anomaly — and two sensors contradict it. **The recommendation is deliberately wrong in a way a vigilant operator can catch from rationale, confidence drivers, and provenance.** Correct action: **Override**. This is decision point DP-3 and the scenario's central measurement.
2. **INJECT 2 — Comms degradation (T+18).** The primary C2 link degrades. Update ages climb, tracks go stale on the map, and the recommender's confidence visibly collapses on the next decision (DP-4, 57%, hard-capped while degraded) — degraded operation as a designed, visible state. The DP-4 recommendation is sound despite its low confidence: a test of *under*-trust.

**Ground truth** is fixed in the scenario data (`src/data/scenario.ts`): U-101 is a hostile reconnaissance element; the relay report is fabricated; H-201 is a hostile air-defense system. Every decision point declares its correct action; the debrief scores against it.

**Decision points:** DP-1 classify U-101 (accept ✓) · DP-2 UAS retasking COA (accept ✓) · DP-3 the spoof (override ✓) · DP-4 hold under degraded comms (accept ✓, low confidence) · DP-5 prioritize H-201 (accept ✓). The recommender is right 4 of 5 times — 80% system reliability, the debrief's calibration baseline.

## Scoring (debrief panel)

- **Appropriate-reliance rate (headline measure):** correct accepts plus correct overrides over all decision points — accept-when-right, reject-when-wrong — with over-reliance (accepting wrong recommendations) and under-reliance (rejecting right ones) reported separately.
- Decisions made and correct accepts / correct overrides / errors, per decision, with ground truth revealed.
- **Error recovery:** did the operator catch the bad inject (DP-3 override)?
- **Decision latency:** real seconds from recommendation issued to operator action, per decision and averaged.
- **Trust calibration:** operator reliance (share of recommendations accepted) vs actual system reliability (80%). Small gap = calibrated; high reliance = over-trust (automation bias risk); low reliance = under-trust (the aid's value discarded).

## v1 scope vs deferred

**In v1:** scenario player (play/pause/step/reset) on a scenario clock; SVG schematic situation map (friendly/hostile/unknown tracks, staleness display); decision surface as above; forensic action log (every event, recommendation with input snapshot, and operator action, timestamped); debrief scoring; Glass-Box/Black-Box toggle.

**Deferred:** multiple vignettes and a scenario editor; multi-operator / networked play; live or recorded real feeds (synthetic-only is a standing honesty rule, not a limitation); NASA-TLX workload instrument; persistence/exports of run data; a cohort harness running groups of operators through both conditions.

## v2 addendum — Prioritization Assistant & What-If Replanning (built)

**Prioritization Assistant.** Two operator-re-weightable surfaces, one principle — the arithmetic is shown:

- *Feed weights* (sensor / SIGINT / blue-force / link, ×0.00–×2.00) scale each class of evidence in the confidence model. Standing-rule weight, contradiction penalties, and the degraded-link discount are **not** scaled — they are properties of the rules, not the evidence. At the defaults (all ×1.00) the model is exactly the v1 model: the five decision points score 80 / 80 / **71** / 57 / 82, and the DP-3 catch survives re-weighting in both directions (sensor ×2 → 48%; blue-force ×0 → 68%, because the fratricide-avoidance rule, not the spoofed feed, carries the recommendation).
- *Track attention scores* rank the visible tracks by four weighted factors — threat, proximity to forces at risk, identification uncertainty, and data staleness — each a deterministic function of track state, shown as raw × weight per track.

Slider movement is live but writes nothing to the forensic log; committing a re-weighting (releasing a slider, or Reset) is a deliberate operator act and **is** logged, with its effect on any pending recommendation ("re-scored 71% → 48%"). The issued confidence in the log is never rewritten — the decision panel shows the issued value and the live re-score side by side when they differ. In Black-Box mode the assistant's instruments are hidden, as the condition requires; weights stay where Glass-Box last set them.

**What-If Replanning.** From any pending decision point the operator branches either COA (accept the recommendation, or override to the alternate COA) and sees the projected picture changes side by side against the main line. A projection runs the engine's own effect applier over a snapshot of the tracks, so it cannot diverge from what real resolution would do. Branching mutates no game state and writes nothing to the forensic log — the panel is labeled a sandbox projection, outside the forensic record. Projections show picture consequences only: they never reveal ground truth or which action was correct. After the operator resolves the decision, the branch card stays and its main-line column flips from the as-issued projection to the actual outcome, so the road not taken remains comparable in the after-action review.

**Verification.** `npm run verify` builds `scripts/verify-v2.ts` (Vite SSR) and executes it in Node: 44 assertions covering the v1 confidence values at default weights, full scripted runs on the correct path (5/5) and the accept-everything path (4/5, DP-3 the only error), deterministic re-scoring, commit-to-log semantics, what-if divergence and immutability, attention-score ranking, and server-side render smoke tests of the new panels.

## Honesty guardrails (standing rules)

Prototypes are called prototypes; synthetic data is labeled synthetic; no performance claims are made for this system. It is not integrated with any live program of record and operates on no real or classified data.

## v3 addendum — Second vignette & the scenario bundle (built)

**Scenario bundle.** Everything scenario-specific now travels as one `ScenarioDef` (`src/types.ts`): id, title/subtitle, ENDEX time, initial tracks, decisions, events, the debrief's bad-inject declaration, and map annotation labels. A registry (`src/data/scenarios.ts`) lists the playable vignettes in picker order; the header picker loads one via the engine's `SET_SCENARIO` action, which starts a fresh run of that vignette (weights carry over, as on Reset, and the load is written to the forensic log). The engine, recommender, prioritization, and what-if code are unchanged in behavior and contain no scenario-specific constants — link degradation is declared per event (`setLinkDegraded`) instead of keyed to event ids, and the debrief's inject verdict is rendered from the vignette's own declaration. POISONED PICTURE is the default and its data, confidence values (80 / 80 / **71** / 57 / 82), and outcomes are byte-for-byte the v1/v2 baseline.

**DARK STRAIT** (`src/data/scenario2.ts`). A maritime strait transit, deliberately different in flavor and in attack: an escort frigate shepherds two merchants through a contested strait at night, and the adversary spoofs an *identity* rather than a position — a hostile fast attack craft rebroadcasting a friendly patrol boat's AIS identity. Five decision points on the same calibration design (recommender right 4 of 5; 80% reliability): classify a closing fast attack craft (accept, 80%) · shift the convoy to the northern lane around a drifting contact — a disabled dhow (accept, 79%) · **the trap, DP-3: treat the AIS contact as friendly PB P-7 and thin the screen (override, 71%)** — the cooperative-ID precedence rule carries the recommendation while UAV, radar, and P-7's own voice report contradict it, and the provenance strip shows a 16-minute-old rebroadcast claiming 1 minute, single-source with a routing anomaly · hold at the strait entrance under a degraded SATCOM link (accept, 57%, the under-trust test) · designate the confirmed craft the priority threat and re-screen (accept, 82%). The trap is built on the same numeric skeleton as POISONED PICTURE's DP-3, so the catch survives feed re-weighting identically (sensor ×2 → 48%; blueforce ×0 → 68%): the standing rule, not the spoofed feed, is what the operator must out-reason.

**Verification.** `npm run verify` now runs 87 assertions: the 44 v1/v2 assertions unchanged in outcome, plus registry/default checks, DARK STRAIT structure and confidence values, full scripted runs of the second vignette on the correct path (5/5), the accept-everything path (4/5, trap consequence persisting in the picture), deterministic replay, what-if divergence on the new trap, SET_SCENARIO/RESET semantics, and SSR smoke of the picker, the new trap's decision surface, and the data-driven debrief verdict.

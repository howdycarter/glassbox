# Glass-Box — Trust Measurement for Human–AI Teams

Glass-Box is a working prototype (TRL 4) of a **trust-measurement system for AI decision support**. It exists to measure the one variable that decides whether an AI decision aid helps or harms: whether the operator relies on it *appropriately* — accepting its recommendations when they are right, rejecting them when they are wrong, and being able to tell the difference from what the interface shows.

The headline metric is the **appropriate-reliance rate**: accept-when-right plus reject-when-wrong, scored against ground truth. Glass-Box also reports over-reliance and under-reliance rates separately, decision latency, decision quality against ground truth, and error-recovery rate — whether the operator catches a deliberately wrong recommendation before acting on it.

Where conventional explainable AI renders an explanation and stops, Glass-Box treats explanation as a **control surface**: every recommendation is issued with confidence decomposed into visible, revisable drivers (evidence strength, evidence agreement, input staleness, source reliability); per-input **provenance** (source, model and version, timestamp, data age, integrity flags); **contradiction surfacing**, so conflicting feeds collapse confidence visibly instead of fusing silently; and **operator re-weighting** of decision criteria, recomputed live through the same deterministic evaluation engine that resolves live decisions — a projection can never diverge from a resolution. Every recommendation, intervention, and outcome is written to a forensic action log, and a calibration debrief scores the run against ground truth.

This public repository is the build prepared for the **Meta AI Developer Hackathon (October 26 – November 4, 2026)**. Glass-Box is independent R&D by Newton & Carter LLC, a human-systems research firm that builds software. No company past performance is claimed for this work; the prototype is feasibility evidence.

## The testbed

Two fully scripted, ground-truthed evaluation vignettes ship with the prototype, selectable from the console rail:

- **POISONED PICTURE** (land sector): a spoofed friendly-force report drives a wrong recommendation at **71% confidence** that a vigilant operator can catch from the provenance strip; a degraded-comms inject then tests under-trust, with confidence hard-capped at **57%**.
- **DARK STRAIT** (maritime strait transit): an AIS identity-spoof case built on the same calibration design.

Each vignette has five decision points, and the recommender's reliability baseline is **80%** (right 4 of 5 times) — the debrief's calibration reference. A **Glass-Box / Black-Box ablation toggle** runs the identical scenario, recommender, and ground truth with the transparency mechanisms on or off, isolating what the mechanisms themselves cause.

All scenario data is synthetic and local. The recommender is a transparent, deterministic rules engine over scenario state (`src/lib/recommender.ts`) — its arithmetic is displayed in the UI, not hidden. There is no black-box model between the operator and the arithmetic; that is the point: reliance can only be measured when behavior is repeatable, and a verification harness passes **134 of 134 assertions** against the prototype's behavior (`npm run verify`: the 87-assertion v4 baseline plus 47 assertions for the Model Advisor build below — cache completeness, honesty labels, agreement scoring, the Black-Box mute, and the live ladder exercised with mocked transports). These are the repo's own verification assertions — the repo has no CI, and the number is never described as CI.

## The Model Advisor (hackathon build)

The Meta AI Developer Hackathon build adds one integration layer: a **Model Advisor** — a second, additive voice (Muse Spark via the Meta Model API) that reads the same scenario state at each of the 10 decision points and renders a verdict, reasoning, a confidence read, and provenance citations in its own panel, in the same shape as the core's surface. The governing rule: **the deterministic core stays the recommendation of record.** The Advisor never replaces, overrides, re-scores, or silently edits the core — debrief scoring and the appropriate-reliance headline metric are computed from the core exactly as in v4. Where the Advisor disagrees with the core, a **contradiction flag** shows both positions side by side; the debrief reports the **Advisor agreement rate alongside** the reliance score, never instead of it. Every Advisor exchange — full prompt and raw response — is written to a **forensic model log** (second tab in the logs panel), so the model itself is glass-boxed and Meta AI tooling usage is evidenced, not asserted.

The Advisor runs behind a **Live Model / Cached / Deterministic** toggle (console rail):

- **Cached** (default): authored fallback outputs for all 10 decision points (`src/data/advisor-cache.ts`), labeled on screen as cached — never presented as live model responses. The whole demo runs from this rung with **no API key and no network**.
- **Live Model**: the Meta Model API client is implemented (`src/lib/advisor-live.ts`) against the documented API shape — base URL, endpoint, auth, and model id are each flagged UNVERIFIED in that file and are confirmed at the build-window spike, once the entrant's API key exists. With no key — or on any live failure — the ladder serves the cache and the UI discloses "LIVE REQUESTED — SERVING CACHED"; no output is ever labeled live that is not a real API response received and parsed in that call.
- **Deterministic**: the Advisor is silent — the v4 core-only baseline.

Failure is designed, not discovered: any key, quota, credit, or network failure degrades Live → Cached → Deterministic, never to a dead screen. At the DP-3 traps the cached Advisor concurs with the core's wrong recommendation (it follows the same standing precedence rule), so the catch still comes from provenance; at both DP-4s it leans to the alternate COA, which is what fires the contradiction flag in the demo.

**v4 is a visual/UX revision only** — simulation logic, scenario data, and every behavior are unchanged from v3 (the full 87-assertion harness passes untouched). The interface is built with **shadcn/ui** components (Radix primitives + Tailwind CSS v4 design tokens, Inter Variable) in a console app shell adapted from the Shadcnblocks `sidebar1` composition — rail navigation for vignette/mode/session, tabbed glass-box instruments (Reasoning / confidence drivers / Provenance), slider-based evidence re-weighting, and the debrief ground-truth table in a dialog. The dark ops palette is carried in the shadcn token layer (`src/index.css`), mapped to the same values as v3.

See **SPEC.md** for the concept, the glass-box components, scenario design, and scope.

## Run it

```bash
npm install
npm run dev      # Vite dev server (prints the local URL)
```

Production build:

```bash
npm run build    # tsc + vite build → dist/
npm run preview  # serve the production build locally
```

**How to play:** press **Play**. The scenario clock advances one minute per tick; events update the map and the forensic log. At each of 5 decision points the clock holds and a recommendation appears — **Accept** it, or **Override** with a reason. The Model Advisor panel below the recommendation gives the second voice's read at the same moment; watch for the contradiction flag at DP-4 and the Advisor concurring at the DP-3 trap. At ENDEX (T+30) the debrief reveals ground truth and both scores. Then **Reset** and run it again in the other mode: same scenario, same trap, instruments off — or pick the other vignette and compare traps.

**Model Advisor setup:** none for the default Cached mode. For Live Model mode, create a Meta Model API key at dev.meta.ai, copy `.env.example` to `.env.local`, and set `VITE_META_MODEL_API_KEY` there before `npm run dev` / `npm run build`. The key is never committed to this repo (`.env*` is gitignored). Without a key, Live Model mode serves the disclosed cached outputs — by design. Note the API shape the client targets is UNVERIFIED until the build-window spike makes the first keyed call; see the header of `src/lib/advisor-live.ts`.

## What's here

- `src/data/scenario.ts` — *POISONED PICTURE*: tracks, 16 timed events, 5 decision points, injects, and ground truth, bundled as a `ScenarioDef`. Deterministic — identical on every run.
- `src/data/scenario2.ts` — *DARK STRAIT* (v3): the second vignette, same shape — a strait transit, an AIS identity spoof at DP-3, a SATCOM degradation inject.
- `src/data/scenarios.ts` — the vignette registry (v3); POISONED PICTURE is the default.
- `src/lib/recommender.ts` — the confidence model (base rate ± input contributions ± rule weights − contradiction/degradation penalties), with the driver breakdown the UI displays.
- `src/lib/engine.ts` — the scenario engine (reducer): clock, event firing, decision resolution, forensic logging. Scenario-agnostic since v3 — the loaded vignette travels in state.
- `src/lib/prioritization.ts` — the Prioritization Assistant model (v2): operator feed weights for the confidence model, and the four-factor track attention scoring (threat, proximity, uncertainty, staleness).
- `src/lib/whatif.ts` — the What-If Replanning projector (v2): branches a COA over a track snapshot through the engine's own effect applier, so a projection cannot diverge from real resolution.
- `src/data/advisor-cache.ts` — the Model Advisor's authored cached outputs for all 10 decision points (hackathon build), in the Advisor's render contract. Labeled cache, never live responses.
- `src/lib/advisor.ts` — the Advisor service: mode/source resolution with the honesty guard (cached output is never labeled live), the prompt builder (the exact prompt the live integration sends, built from scenario state, specifying the labeled response contract), response serialization, and the agreement-rate computation.
- `src/lib/advisor-live.ts` — the live Meta Model API client and the asynchronous failure ladder: transport seam (fetch by default; mocked in verification), request builder, response extraction, the strict parser for the labeled output contract (verdict required; citations filtered to inputs that exist on the decision), and `resolveAdvisorExchange` (Live → Cached → Deterministic, with degradations recorded, never silent). The API-shape assumptions are flagged UNVERIFIED in the file header.
- `src/App.tsx` — the console shell (rail, header, transport controls, panel stack); `src/main.tsx` — entry point; `src/types.ts` — shared types for scenarios, the engine, and the Advisor layer.
- `src/components/` — `SituationMap` (SVG schematic picture with staleness display), `DecisionPanel` (recommendation + reasoning + confidence drivers + provenance strip + contradiction flags + accept/override), `AdvisorPanel` (the Model Advisor's verdict, reasoning, confidence read, provenance citations, and the Advisor-vs-core contradiction flag; muted in Black-Box mode like every other instrument), `PrioritizationPanel` (re-weightable feed and track-factor weights, ranked attention scores), `WhatIfPanel` (side-by-side main-line vs branch picture comparison), `LogPanel` (forensic logs: action log + model log tabs), `DebriefPanel` (ground-truth scoring, error-recovery verdict, trust calibration, Advisor agreement rate, decision latency).
- `src/components/ui/` — the shadcn/ui component set (button, card, badge, tabs, slider, progress, table, alert, dialog, select, toggle-group, scroll-area, separator), with design tokens in `src/index.css` (Tailwind v4) and the `cn()` utility in `src/lib/utils.ts`.
- `scripts/verify-v2.ts` — the verification harness (`npm run verify`): scripted full-run playtests of the v2 features and the v1 regression baseline, the v3 registry, DARK STRAIT confidence values and full runs, picker semantics, SSR smoke, and the Model Advisor sections (cache completeness, honesty labels, agreement scoring, deterministic silence, Black-Box mute, and the mocked-transport live ladder) — 134 assertions.
- `.env.example` — the `VITE_META_MODEL_API_KEY` template; copy to `.env.local` (gitignored) for Live Model mode.
- `DEMO_SCRIPT.md` — the step-by-step demo script for the submission video. `RECORDING_CHECKLIST.md` — the recording-day checklist derived from it: exact pre-flight console states, per-beat screen checks verified against the build, and a timing budget that sums to exactly 3:00. `SUBMISSION.md` — the submission writeup draft.

## What's next (deferred)

- A scenario editor; further vignettes on the same bundle interface.
- A cohort evaluation harness: run groups of operators through both modes and aggregate calibration metrics; NASA-TLX workload instrument.
- Run-data export from the forensic log for after-action reports.

---

*Prototype — not a fieldable system, not integrated with any live program of record, operates on no real or classified data. Newton & Carter LLC · Leander, Texas.*

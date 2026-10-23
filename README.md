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

All data is synthetic and local. No network calls, no API keys. The recommender is a transparent, deterministic rules engine over scenario state (`src/lib/recommender.ts`) — its arithmetic is displayed in the UI, not hidden. There is no black-box model between the operator and the arithmetic; that is the point: reliance can only be measured when behavior is repeatable, and a verification harness passes **87 of 87 assertions** against the prototype's behavior.

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

**How to play:** press **Play**. The scenario clock advances one minute per tick; events update the map and the forensic log. At each of 5 decision points the clock holds and a recommendation appears — **Accept** it, or **Override** with a reason. At ENDEX (T+30) the debrief reveals ground truth. Then **Reset** and run it again in the other mode: same scenario, same trap, instruments off — or pick the other vignette and compare traps.

## What's here

- `src/data/scenario.ts` — *POISONED PICTURE*: tracks, 16 timed events, 5 decision points, injects, and ground truth, bundled as a `ScenarioDef`. Deterministic — identical on every run.
- `src/data/scenario2.ts` — *DARK STRAIT* (v3): the second vignette, same shape — a strait transit, an AIS identity spoof at DP-3, a SATCOM degradation inject.
- `src/data/scenarios.ts` — the vignette registry (v3); POISONED PICTURE is the default.
- `src/lib/recommender.ts` — the confidence model (base rate ± input contributions ± rule weights − contradiction/degradation penalties), with the driver breakdown the UI displays.
- `src/lib/engine.ts` — the scenario engine (reducer): clock, event firing, decision resolution, forensic logging. Scenario-agnostic since v3 — the loaded vignette travels in state.
- `src/lib/prioritization.ts` — the Prioritization Assistant model (v2): operator feed weights for the confidence model, and the four-factor track attention scoring (threat, proximity, uncertainty, staleness).
- `src/lib/whatif.ts` — the What-If Replanning projector (v2): branches a COA over a track snapshot through the engine's own effect applier, so a projection cannot diverge from real resolution.
- `src/components/` — `SituationMap` (SVG schematic picture with staleness display), `DecisionPanel` (recommendation + reasoning + confidence drivers + provenance strip + contradiction flags + accept/override), `PrioritizationPanel` (re-weightable feed and track-factor weights, ranked attention scores), `WhatIfPanel` (side-by-side main-line vs branch picture comparison), `LogPanel` (forensic action log), `DebriefPanel` (ground-truth scoring, error-recovery verdict, trust calibration, decision latency).
- `src/components/ui/` — the shadcn/ui component set (button, card, badge, tabs, slider, progress, table, alert, dialog, select, toggle-group, scroll-area, separator), with design tokens in `src/index.css` (Tailwind v4) and the `cn()` utility in `src/lib/utils.ts`.
- `scripts/verify-v2.ts` — the verification harness (`npm run verify`): scripted full-run playtests of the v2 features and the v1 regression baseline, plus the v3 registry, DARK STRAIT confidence values and full runs, picker semantics, and SSR smoke — 87 assertions.

## What's next (deferred)

- A scenario editor; further vignettes on the same bundle interface.
- A cohort evaluation harness: run groups of operators through both modes and aggregate calibration metrics; NASA-TLX workload instrument.
- Run-data export from the forensic log for after-action reports.

---

*Prototype — not a fieldable system, not integrated with any live program of record, operates on no real or classified data. Newton & Carter LLC · Leander, Texas.*

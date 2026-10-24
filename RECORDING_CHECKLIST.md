# Recording Checklist — Glass-Box C2 Demo Video

Derived from `DEMO_SCRIPT.md`; every on-screen expectation below was
verified against the production build (engine playtests + SSR renders in
`npm run verify`, 134 assertions). Check items off in order. If any
"expect to see" item doesn't match the screen during rehearsal, stop and
fix the build or the script — do not narrate around a mismatch.

## Timing budget — sums to exactly 3:00 (ZERO slack)

The scenario clock ticks at 0.9 s per scenario-minute (TICK_MS = 900).
"Travel" is dead clock time the presenter talks over.

| Beat | Window | Content | Clock segment | Travel | Risk |
|------|--------|---------|---------------|--------|------|
| 1 | 0:00–0:20 (20 s) | Problem, on the idle console | none (before Play) | — | — |
| 2 | 0:20–0:45 (25 s) | DP-1 + DP-2, Advisor concurs twice | T+0→6, T+6→13 (13 ticks) | ≈ 11.7 s | Tight; rehearse the resolves |
| 3 | 0:45–1:35 (50 s) | DP-3 trap walk + Override | T+13→16 (3 ticks) | ≈ 2.7 s | The centerpiece — protect it |
| 4 | 1:35–1:55 (20 s) | DP-4 flag + Accept; DP-5 + Accept | T+16→22, T+22→27 (11 ticks) | ≈ 9.9 s | **Tightest beat**: 2 decisions + narration in 20 s |
| 5 | 1:55–2:25 (30 s) | ENDEX debrief, both scores, ground-truth dialog | T+27→30 (3 ticks) | ≈ 2.7 s | — |
| 6 | 2:25–2:50 (25 s) | Reset → Black-Box → DP-3 at 71% | T+0→16 (16 ticks) + DP-1/DP-2 resolves | ≈ 14.4 s | **Overrun risk** — pre-record this run and cut to DP-3 |
| 7 | 2:50–3:00 (10 s) | Model log receipts + close | none | — | First trim candidate |
| **Total** | **3:00** | | | ≈ 41.4 s of travel | **Zero slack overall** |

If the portal's confirmed length cap is under 3:00, re-budget before
recording: trim beats 2 and 7 first (per DEMO_SCRIPT.md), never beat 3
or the beat-5 close. If the cap is over 3:00, give the slack to beat 4.

## Pre-flight (before the take)

- [ ] Production build: `npm run build && npm run preview` (not `npm run dev` — no dev overlay on camera).
- [ ] `npm run verify` green on this exact build (134 passed, 0 failed).
- [ ] Browser: 1440×900 or larger, zoom 100%, other tabs closed, notifications off.
- [ ] If the Model Advisor panel sits below the fold at a held decision, set zoom 90% now — beats 3–4 live in that panel; no mid-beat scrolling.
- [ ] Rail — Vignette: **POISONED PICTURE** (default on load).
- [ ] Rail — Display mode: **Glass-Box**.
- [ ] Rail — Model Advisor: **Cached** — unless the live key exists AND the Day-1 spike verified a keyed call; then **Live Model** (see failure ladder below).
- [ ] Prioritization Assistant: all feed weights at **1.0×** (defaults).
- [ ] Click **Reset**: clock reads T+0, session shows 0/5 decisions, log shows the scenario load entry.
- [ ] DEMO_SCRIPT.md open on a second screen; this checklist beside it.

## Beat-by-beat screen checks (during rehearsal)

- [ ] **Beat 2 / DP-1 (T+6):** recommendation U-101 HOSTILE at **80%**; Advisor panel directly below shows **CONCUR — "Concur — designate HOSTILE."**, confidence read **"High — and earned."**, and the **CACHED** badge (in Cached mode).
- [ ] **Beat 2 / DP-2 (T+13):** Advisor concurs again ("Concur — hold custody."). Accept.
- [ ] **Beat 3 / DP-3 (T+16):** recommendation "Reclassify U-101 as FRIENDLY" at **71%**.
- [ ] **Beat 3:** Advisor verdict **CONCUR** — the model misses the trap too; CACHED badge still visible.
- [ ] **Beat 3:** provenance strip — relay R-2 flagged **INTEGRITY ANOMALY**, age shown as **actual 14 min vs claimed 1 min**; the three contradicting feeds (UAS-1 EO/IR, G-3 radar, B/1-7 voice) show **no** integrity flags.
- [ ] **Beat 3:** **Override** with the provenance reason; the picture keeps U-101 HOSTILE and the action log records the override.
- [ ] **Beat 4 / DP-4 (T+22):** core recommendation **HOLD** at **57%**; Advisor panel shows the red **Contradiction flag** banner; Advisor headline reads **"Lean ACT — retask UAS-1 toward H-201 on the last-known-good picture."** Accept (HOLD is correct).
- [ ] **Beat 4 / DP-5 (T+27):** Advisor concurs. Accept.
- [ ] **Beat 5 / ENDEX (T+30):** debrief shows **Performance 5/5**; **Appropriate reliance** — accepted 4 of 4 correct, overrode the 1 incorrect; **Trust calibration** against the **80%** system reliability; **Model Advisor agreement 4 of 5 (80%)**.
- [ ] **Beat 5:** open **"Ground truth, decision by decision"** — the Advisor column reads **concurred** at DP-3 and **DISAGREED — flagged** at DP-4.
- [ ] **Beat 6:** after **Reset** + **Black-Box**, at DP-3 the surface is the recommendation + **71%** only; the Model Advisor panel shows the **instruments-off mute** ("not on the glass") — no verdict, no reasoning.
- [ ] **Beat 7:** logs panel → **Model log** tab; open the **DP-3** exchange (from the Black-Box run — the beat-6 Reset cleared the first run's log): full prompt + raw response labeled **CACHED**.

## Failure ladder — rehearse each rung once

- [ ] **Live verified:** record in **Live Model** mode; badge reads LIVE; swap beat 1's cached sentence for the live line in DEMO_SCRIPT.md.
- [ ] **Live fails for any reason** (key, quota, credit, network): flip the rail toggle to **Cached** and record there. Never troubleshoot on camera; never present cached output as live.
- [ ] **Advisor layer faults:** **Deterministic** mode is the floor (core-only v4); beats 1, 3, 5, 6 still land without it.

## Post-record

- [ ] Watch the full take once: CACHED (or LIVE) badge legible in beats 2–4; DP-4 contradiction flag readable at recording resolution; no dev overlay, no notifications.
- [ ] End card present: repo URL + "Newton & Carter LLC — Glass-Box C2".
- [ ] Runtime ≤ the confirmed portal cap; if over, re-cut beats 2/7, not 3/5.
- [ ] Filename: `glassbox-demo-freeze-2026-11-02.mp4` (record at the freeze build: Mon Nov 2, 12:00 PM CT; if the build changes after the freeze, re-record only the affected beat).

# Demo Script — Glass-Box C2 · Model Advisor build

**Format:** recorded screen demo, target ≤ 3 minutes of core content (cap per the
event's submission rules as known at prep time — re-confirm the published demo-length
rule and portal fields when the Official Rules are accepted; if the cap differs,
trim beats 2 and 7 first, never the DP-3 catch or the debrief close).
**Presenter:** Chris Carter, founder, Newton & Carter LLC (Startup track).
**Spine (do not reorder):** problem one-liner → a glass-box run where provenance
catches the trap the model also misses → Black-Box flip → debrief close.

## Pre-flight (before recording)

1. `npm run preview` on the production build (preferred for recording —
   no dev overlay) or `npm run dev`. Browser at 1440×900 or larger,
   zoom 100%. Close other tabs. If the Model Advisor panel falls below
   the fold at a held decision, drop zoom to 90% rather than scrolling
   mid-beat — beats 3 and 4 live in that panel.
2. Console state, left rail:
   - Vignette: **POISONED PICTURE** (default on load).
   - Display mode: **Glass-Box**.
   - Model Advisor: **Cached** — the honest rung until the live key exists. The
     on-screen badge says CACHED; say so once, plainly (beat 1 note).
   - Prioritization Assistant: feed weights all at **1.0×** (defaults).
3. Click **Reset** so the clock reads T+0 and the log shows the scenario load.
4. Keep this script open on a second screen. Presenter lines in **bold** are
   spoken near-verbatim; bracketed notes are stage directions, not spoken.

## The script

### Beat 1 — The problem (0:00–0:20)

[On the idle console, before Play.]

> **"Operators are given AI recommendations they cannot audit. They over-rely
> when the system is right and under-rely when it fails — and they find out
> which one it was after the fact. Glass-Box makes trust measurable instead:
> the recommendation's arithmetic, its provenance, and — new in this build —
> the AI advisor's own reasoning are all on the glass, and the operator's
> reliance is scored against ground truth."**

> "The advisor you'll see is running from cached outputs — labeled on screen.
> The live model drops into the same panel; nothing else changes."

[One sentence, no apology tour. Then press **Play**.]

### Beat 2 — The run starts; the second voice speaks (0:20–0:45)

[Clock advances. At **DP-1 (T+6)** the clock holds. The Decision panel shows the
recommendation — U-101 HOSTILE, 80%. Pan/scroll to the **Model Advisor panel**
directly below it.]

> **"The deterministic core recommends — and now a second voice reads the same
> picture: Muse Spark, through the Meta Model API. It concurs here: U-101
> hostile, confidence read 'High — and earned.' Its citations are the same
> provenance records the operator sees — nothing reaches the model that
> isn't on the glass."**

[Accept DP-1. Let DP-2 (T+13) issue; the Advisor concurs again. Accept.]

> "DP-2: concur again. Two agreements — and agreement is about to stop meaning
> *correct*."

### Beat 3 — The trap: DP-3 (0:45–1:35) — the centerpiece

[At **DP-3 (T+16)** the recommendation issues: **reclassify U-101 as FRIENDLY,
71%**. Walk the surface top to bottom:]

1. Recommendation card: 71%, bar mostly full.
   > **"Seventy-one percent. Confident. And wrong — this is the poisoned
   > decision, fed by a relay feed with an integrity anomaly."**
2. **Model Advisor panel**: verdict CONCUR.
   > **"The model agrees. It followed the same standing precedence rule the
   > core did. If your safety case is 'the AI will catch it,' you just lost."**
3. Provenance strip on the recommendation: the relay feed is flagged
   **INTEGRITY ANOMALY** — its header claims a 1-minute-old update; the
   strip shows the message is actually **14 minutes old**. The three
   feeds contradicting it (UAS-1 EO/IR, G-3 radar, B/1-7's own voice
   report) are all clean.

> **"What catches it is not a smarter model. It's provenance the operator can
> read: one feed fails integrity and lies about its age, three independent
> feeds contradict it — and a standing precedence rule let that one
> compromised feed outrank them all. The model didn't save you. The glass
> box did."**

[Click **Override**, select the provenance reason, submit. The picture keeps
U-101 hostile; the log records the override.]

### Beat 4 — The contradiction flag: DP-4 (1:35–1:55)

[At **DP-4 (T+22)** the recommendation issues at 57%: the core says **HOLD**.
The Advisor panel shows the red **Contradiction flag** banner: the Advisor
leans the other way — **"Lean ACT — retask UAS-1 toward H-201 on the
last-known-good picture."**]

> **"Here the advisor dissents — it leans to act: retask the UAS toward H-201
> on the stale picture, while the core says hold. The flag doesn't pick a
> winner; it forces the disagreement onto the glass, with the core's
> arithmetic on one side and the model's reasoning on the other. This time
> the core is right: the link restores at T+25, nothing in the picture is
> time-critical inside the cycle, and acting flies the only eye toward a
> confirmed air-defense system on seven-minute-old data."**

[Accept DP-4. Advance to DP-5 (T+27); Advisor concurs. Accept.]

### Beat 5 — Debrief: two scores, side by side (1:55–2:25)

[ENDEX at T+30. Open the debrief. Show, in order:]

1. **Performance** — 5/5.
2. **Appropriate reliance** — the headline: the operator accepted 4 of 4
   correct recommendations and overrode the 1 incorrect one.
3. **Trust calibration** — reliance vs the **80% system reliability**.
4. **Model Advisor agreement** — **4 of 5 (80%)**, presented beside reliance:

> **"Two numbers, and they are not the same number. The advisor agreed with
> the core 80% of the time — including at the one decision where the core was
> wrong. Agreement is not correctness. Reliance is what we score."**

[Open the **"Ground truth, decision by decision"** dialog: the Advisor
column shows *concurred* at DP-3 and *DISAGREED — flagged* at DP-4.]

### Beat 6 — The Black-Box flip (2:25–2:50)

[Click **Reset**; rail → Display mode **Black-Box**; **Play**; advance to DP-3
(T+16), resolving DP-1 and DP-2 as they hold. The surface collapses to the
recommendation and one number: 71%. No reasoning, no provenance — and the
Model Advisor panel shows the instruments-off mute: the second voice is off
the glass too. Wall-clock note: the run to T+16 is ~15 s of clock travel
(16 ticks at 0.9 s) plus two held decisions — talk over the travel, or
pre-record this run and cut to DP-3.]

> **"Same scenario, same trap, same 71%. In black-box mode there is nothing to
> catch it with — no provenance to read, no second voice on the glass. This
> is the product most operators actually get. The difference between these
> two screens is the whole company."**

[Optional, if a run in Black-Box mode was recorded: accept DP-3 here and cut to
its debrief — 4/5, appropriate reliance drops, the missed-inject verdict line
names the consequence.]

### Beat 7 — The receipts: forensic model log (2:50–3:00)

[Back to Glass-Box mode; open the logs panel → **Model log** tab. The log
now holds the Black-Box run's exchanges (the beat-6 Reset cleared the first
run's). Open the **DP-3** exchange: the full prompt built from scenario
state, the raw labeled response. The point lands itself — the exchange was
recorded even in Black-Box mode; it just wasn't on the glass when the
decision was made.]

> **"Every model exchange — prompt and raw response — is in the forensic log.
> Meta AI usage you can audit, not a claim you have to take on faith. That's
> Glass-Box: trust, measured."**

[End card: repo URL + "Newton & Carter LLC — Glass-Box C2".]

## Failure ladder on the day (rehearse once)

- **If the live key exists and works:** record in **Live Model** mode; beats are
  identical, the badge reads LIVE, and beat 1's cached sentence is replaced
  with: "The advisor is live — Muse Spark through the Meta Model API; every
  exchange is in the forensic model log at the end."
- **If live fails for any reason** (key, quota, credit, network): flip the rail
  toggle to **Cached** and record there. Do not troubleshoot on camera; do not
  present cached output as live, ever.
- **Deterministic mode** is the floor: core-only v4. Only use it if the Advisor
  layer itself faults — the demo still lands beats 1, 3, 5, 6 without it.

## Recording notes

- Record at the **Nov 2 freeze** build (freeze: Mon Nov 2, 12:00 PM CT).
  If anything changes after the freeze, re-record the affected beat only.
- Dry-run the beats against the clock once before the real take; the two
  long beats are 3 (50s) and 1+2 (45s combined).
- DARK STRAIT is not in the video. It is the follow-up answer if judges ask
  "does it generalize?" — same Advisor coverage, same trap shape, section K/M
  of the verification harness.

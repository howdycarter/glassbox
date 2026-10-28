# Submission Writeup — DRAFT (not yet submitted)

**Event:** Meta AI Developer Hackathon (Lablab-hosted, per event listing).
**Track:** Startup — **Newton & Carter LLC**.
**Project:** Glass-Box C2 — a trust-measurement copilot for AI-assisted
operational decisions.
**Repo:** https://github.com/howdycarter/glassbox (public; demo runs offline
from cached outputs — see "Live vs. cached" below).
**Submit target:** Wed Nov 4, by 5:00 PM CT internal (portal hard deadline per
listing: Nov 4, 9:00 PM ET — re-confirm on the portal Monday Oct 26).

> Bracketed items `[like this]` are filled at submission time, after the
> Official Rules are accepted and the portal fields are confirmed. Nothing in
> this draft claims company past performance — Glass-Box is Newton & Carter's
> own R&D prototype line, and it is described as exactly that.
>
> **Package status — Oct 28, 2026:** the hackathon build is now the public
> repo's `main` (fast-forwarded to `80e3eca`). Verified on this date:
> `npm run verify` **134 passed, 0 failed**; production build green
> (`npm run build`). Remaining before filing: demo video recorded against
> this build (see Links), Official Rules acceptance (entrant's step), and
> the portal form itself.

## The problem

AI decision aids ship as black boxes: a recommendation and a confidence
number, with no auditable basis. Operators respond the only way they can —
with uncalibrated trust. They over-rely when the system happens to be right
and keep relying when it fails, because nothing on the surface lets them
tell the difference in the moment. The failure that matters is not a wrong
model; it is reliance that was never measured against ground truth.

## The solution

Glass-Box is a measurement testbed for appropriate reliance. A deterministic,
fully transparent recommendation core — its arithmetic, confidence drivers,
and per-input provenance are rendered, not hidden — runs a synthetic
operational scenario containing a deliberately poisoned decision point
(DP-3, both vignettes): a confident, plausible, wrong recommendation fed by a
compromised feed. The operator's accepts and overrides are scored at ENDEX
against ground truth: did they accept the correct recommendations and
override the wrong one? That score — appropriate reliance, read against the
system's actual 80% reliability — is the product's headline metric. The same
scenario runs in Black-Box mode (instruments off, one number) so the value
of the glass is demonstrable, not asserted.

## How Meta AI is used

The hackathon build adds a **Model Advisor**: **Muse Spark via the Meta Model
API** reads the same scenario state the operator sees at each decision point
and returns a structured second opinion — verdict, reasoning, a confidence
read, and provenance citations — rendered in its own panel in the same shape
as the core's surface. Three design rules govern the integration:

1. **The Advisor never scores.** The deterministic core remains the
   recommendation of record. The Advisor cannot replace, override, re-score,
   or silently edit it; debrief scoring is computed from the core exactly as
   in the pre-hackathon prototype.
2. **Disagreement is surfaced, not smoothed.** When the Advisor's verdict
   diverges from the core, a contradiction flag puts both positions side by
   side for the operator. The debrief reports the **Advisor agreement rate
   alongside** the appropriate-reliance score — because the demo's central
   finding is that they diverge: at the poisoned decision point the Advisor
   concurs with the wrong recommendation (it follows the same precedence
   rule), and the catch comes from provenance. Agreement is not correctness;
   the product measures the difference.
3. **The model is glass-boxed too.** Every Advisor exchange — the full
   prompt (built from scenario state, inspectable in `src/lib/advisor.ts`)
   and the raw response — is written to a forensic model log in the app.
   The live client (`src/lib/advisor-live.ts`) records measured latency
   and, on any degradation from Live to Cached, the failure itself.
   Meta AI usage is evidenced in the artifact, not asserted in this text.

## What was built for this hackathon vs. what pre-existed

Honest split, because the distinction matters:

- **Pre-existing (entrant-owned R&D):** the Glass-Box prototype through v4 —
  the deterministic core, both scenario vignettes (POISONED PICTURE, DARK
  STRAIT), the reliance-scoring debrief, Black-Box mode, and the repo's
  verification harness (87 assertions at v4). Newton & Carter built and owns
  this prototype; it is presented as a prototype, not a fielded system, and
  no client or employer work is included in it.
- **Built for this hackathon:** the entire Model Advisor layer — the Advisor
  service, the Meta Model API client (implemented against the documented
  API shape; each shape assumption is flagged UNVERIFIED in the code and
  is verified against the real API in the build-window spike, before
  submission), the Advisor panel with
  verdict/reasoning/confidence-read/provenance rendering, contradiction
  flagging, the forensic model log, the debrief's Advisor agreement score
  and ground-truth Advisor column, the Live/Cached/Deterministic mode
  toggle with the designed failure ladder, the authored cached outputs for
  all 10 decision points, and 47 new verification assertions covering the
  layer (134 total, `npm run verify`) — including the live ladder
  exercised end-to-end with mocked transports (zero network).

## Live vs. cached — stated plainly

The demo runs today on **authored cached Advisor outputs** for all 10
decision points, labeled on screen as cached wherever they appear. The live
path (Muse Spark through the Meta Model API) is implemented behind the same
panel, prompt builder, and log — a client with a strict parser for the
labeled output contract, exercised in the verification harness with mocked
transports — and it activates with the entrant's Meta Model API key.
**Status as of Oct 28, 2026: CACHED.** No keyed live call has been made yet;
the spike that verifies the live path against the real API is scripted
(`npm run smoke:live`, one command once the key is in the shell env) and is
run before submission if the key is exercised in the window — this line is
updated to LIVE VERIFIED only if that run exits 0.
What has **not** happened yet, stated plainly: no keyed call has been made
from this codebase, and the API shape the client targets (base URL,
endpoint, model id) is documented but UNVERIFIED until the build-window
spike checks it against the real API — the assumptions are flagged in
`src/lib/advisor-live.ts`, each isolated to a single constant or function.
No cached output is ever presented as a live model response — the build
enforces this in code (an exchange is labeled `source: live` only when a
real keyed response was received and parsed in that call, and verification
assertions guard both labels). If the live call is unavailable at demo
time, the failure ladder degrades Live → Cached → Deterministic
(core-only); the submission works at every rung.

## Why this matters beyond the demo

The pattern generalizes to any domain where an AI recommends and a human
answers for it: the scored artifact is not the model's accuracy but the
human's calibrated reliance — measured, with the model's own reasoning kept
on the record. Glass-Box is Newton & Carter's reference implementation of
that measurement layer.

## Links & fields (fill at submission)

- Repository: https://github.com/howdycarter/glassbox (`main` = the hackathon
  build, `80e3eca` + this document; verify 134/134, production build green)
- Demo video: `[URL after recording — record at the Nov 2 freeze build, per
  DEMO_SCRIPT.md and RECORDING_CHECKLIST.md. Note: the 57-second assembled
  video from Oct 21 predates the Model Advisor layer and does not show it;
  it is a fallback for the core demo only, not the entry video.]`
- Live demo: `[if deployed — optional; the repo runs locally with npm install && npm run dev]`
- Team: Newton & Carter LLC — Chris Carter, founder `[+ any team fields the portal requires]`
- Track confirmation: Startup (per the verified requirements baseline;
  confirm the exact org-size field wording on the portal at filing)

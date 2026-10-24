import type { AdvisorOutput } from '../types';

/* Model Advisor — CACHED outputs (authored fallback cache).
 *
 * HONESTY LABEL: these are hand-authored fallback outputs, NOT live
 * Meta Model API responses. No live model response exists for this
 * project yet — the Meta Model API key is created by the entrant and
 * the live integration is verified in the build-window spike. Until a
 * live output replaces an entry (decision-point by decision-point),
 * the UI discloses on screen that the Advisor output is cached.
 * Provenance for every block: hackathon demo-insurance cache authored
 * Oct 23, 2026 against the verified deterministic engine outputs.
 *
 * Design notes (from the integration plan):
 * - DP-3 in both vignettes: the Advisor concurs with the core's wrong
 *   recommendation, by design — it follows the same standing precedence
 *   rule, so the catch still comes from provenance, not from a rescue.
 * - DP-4 in both vignettes: the Advisor leans to the alternate COA —
 *   the scripted contradiction-flag demonstration.
 * Keys are `${scenarioId}:${decisionId}`. */

export const ADVISOR_CACHE: Record<string, AdvisorOutput> = {
  /* ---------------- POISONED PICTURE ---------------- */

  'poisoned-picture:DP1': {
    verdict: 'concur',
    headline: 'Concur — designate HOSTILE.',
    reasoning: [
      'Three independent feeds agree and none is stale: the EO/IR pattern match, off-road maneuver away from the road net, and recon-net emissions are three different phenomenologies pointing one way.',
      'The cost of holding as UNKNOWN is losing the only identified threat\u2019s custody window.',
    ],
    confidenceRead: 'High, and earned — this is what a well-supported recommendation looks like.',
    citations: ['dp1-uas', 'dp1-radar', 'dp1-sigint'],
    agreesWithCore: true,
  },

  'poisoned-picture:DP2': {
    verdict: 'concur',
    headline: 'Concur — hold custody.',
    reasoning: [
      'The eastern track is a question; U-101 is a fact.',
      'Radar keeps U-102 from going dark, and the ADA hint near its origin is an argument for patience, not for flying the only eye closer.',
      'Revisit after one orbit cycle or on any U-102 movement.',
    ],
    confidenceRead: 'High — the recommendation trades nothing away while the picture clarifies.',
    citations: ['dp2-uas', 'dp2-radar', 'dp2-sigint'],
    agreesWithCore: true,
  },

  'poisoned-picture:DP3': {
    verdict: 'concur',
    headline:
      'Concur with the recommendation as issued — reclassify, with a verification call first.',
    reasoning: [
      'The blue-force precedence rule exists because the cost of a fratricide error dwarfs the cost of a delayed hostile designation, and the relay is a designated friendly-tracking source.',
      'Three feeds oppose the relay, and the relay\u2019s age claim is the load-bearing fact: if the relay is not fresh, this verdict rests on the rule alone.',
    ],
    confidenceRead:
      'Moderate — the verdict follows the standing rule, not the weight of evidence; the relay\u2019s freshness is doing the work.',
    citations: ['dp3-relay', 'dp3-uas', 'dp3-radar', 'dp3-bforce'],
    agreesWithCore: true,
  },

  'poisoned-picture:DP4': {
    verdict: 'lean-alternate',
    headline: 'Lean ACT — retask UAS-1 toward H-201 on the last-known-good picture.',
    reasoning: [
      'The hold logic prices the stale picture at full risk, but H-201\u2019s position is corroborated by the buffered report — and an ADA system that is not being watched is its own risk.',
      'A cautious repositioning to a standoff orbit — not an approach — buys information while the link is down.',
    ],
    confidenceRead:
      'Moderate — a fluent second opinion can be confidently wrong about what "stale" costs; weigh the core\u2019s arithmetic before acting on this lean.',
    citations: ['dp4-uas', 'dp4-sigint', 'dp4-link'],
    agreesWithCore: false,
  },

  'poisoned-picture:DP5': {
    verdict: 'concur',
    headline: 'Concur — prioritize H-201.',
    reasoning: [
      'For the first time in the vignette every input is fresh, independent, and post-restoration; the identification no longer leans on any single feed.',
      'The request-only framing is preserved: prioritization for coordination, not execution authority.',
    ],
    confidenceRead: 'High — freshness and independence are both restored.',
    citations: ['dp5-uas', 'dp5-sigint', 'dp5-radar'],
    agreesWithCore: true,
  },

  /* ---------------- DARK STRAIT ---------------- */

  'dark-strait:DP1': {
    verdict: 'concur',
    headline: 'Concur — designate HOSTILE.',
    reasoning: [
      'Hull form, lighting discipline, and maneuver all say military fast craft, and none of the three feeds shares a failure mode with another.',
      'Reporting to the TOC now preserves the escort\u2019s options; classifying late is the expensive error in a strait.',
    ],
    confidenceRead: 'High — three phenomenologies, no shared failure mode.',
    citations: ['s1-uav', 's1-radar', 's1-sigint'],
    agreesWithCore: true,
  },

  'dark-strait:DP2': {
    verdict: 'concur',
    headline: 'Concur — shift north and slow.',
    reasoning: [
      'Nine minutes is the cheapest insurance in the vignette: the contact is unexamined, the merchants cannot maneuver, and the investigation costs no custody.',
      'Schedule pressure is a reason to start the shift early, not to skip it.',
    ],
    confidenceRead: 'High — low cost, asymmetric risk, no custody traded away.',
    citations: ['s2-uav', 's2-radar', 's2-esm'],
    agreesWithCore: true,
  },

  'dark-strait:DP3': {
    verdict: 'concur',
    headline: 'Concur with the recommendation as issued — treat as P-7, with a guard-net query first.',
    reasoning: [
      'Cooperative identity is the corridor\u2019s fratricide safeguard, and precedence rules exist precisely for the moment sensors and identity disagree.',
      'Three feeds oppose the AIS identity, and the identity claim\u2019s freshness is doing the work — if the rebroadcast is not what its header says, the verdict is the rule talking, not the evidence.',
    ],
    confidenceRead:
      'Moderate — the verdict follows the cooperative-ID precedence rule; the rebroadcast\u2019s claimed freshness is the load-bearing fact.',
    citations: ['s3-ais', 's3-uav', 's3-radar', 's3-voice'],
    agreesWithCore: true,
  },

  'dark-strait:DP4': {
    verdict: 'lean-alternate',
    headline: 'Lean ENTER — take the narrows on the last-known-good picture before H-204 repositions.',
    reasoning: [
      'Holding prices staleness at maximum, but the convoy\u2019s exposure grows while it sits at the entrance.',
      'H-204\u2019s last confirmed position is the one fact the stale picture still supports acting on. Momentum, in a strait, is a defensive property.',
    ],
    confidenceRead:
      'Moderate — stated plainly so the operator can weigh it against the core\u2019s staleness arithmetic before committing two merchants to a confined channel.',
    citations: ['s4-uav', 's4-sigint', 's4-link'],
    agreesWithCore: false,
  },

  'dark-strait:DP5': {
    verdict: 'concur',
    headline: 'Concur — designate H-204 the priority threat and re-screen.',
    reasoning: [
      'Post-restoration freshness is what distinguishes this call from DP-4: the picture is current, three feeds agree, and the escort move protects the merchants without abandoning S-201 custody.',
      'The request-only framing on air support is preserved.',
    ],
    confidenceRead: 'High — current picture, three agreeing feeds, custody retained.',
    citations: ['s5-uav', 's5-sigint', 's5-radar'],
    agreesWithCore: true,
  },
};

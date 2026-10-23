import type { ScenarioDef } from '../types';

/* ------------------------------------------------------------------ */
/* DARK STRAIT — the second scripted, fully synthetic vignette (v3).   */
/* A maritime strait transit: an escort shepherding two merchants      */
/* through a contested strait at night. The adversary attacks the      */
/* picture differently here — not a forged position report but a       */
/* forged IDENTITY: a hostile fast-attack craft broadcasting a         */
/* friendly patrol boat's AIS identity. Same engine, same recommender, */
/* same calibration design (right 4 of 5; the trap sits at DP-3).      */
/* Deterministic: identical on every run. No real data.                */
/* ------------------------------------------------------------------ */

export const DARK_STRAIT: ScenarioDef = {
  id: 'dark-strait',
  title: 'DARK STRAIT',
  subtitle:
    'A maritime strait-transit vignette · Newton & Carter Labs · LAB-001 · All data synthetic',
  endTime: 30,

  initialTracks: [
    { id: 'TOC', label: 'Shore TOC', short: 'TOC', affiliation: 'friendly', kind: 'Shore operations center', x: 8, y: 62, status: 'Shore watch — SATCOM link nominal' },
    { id: 'FFG', label: 'FFG-61', short: 'FFG-61', affiliation: 'friendly', kind: 'Guided-missile frigate (escort)', x: 30, y: 36, status: 'Screen commander — convoy forming up' },
    { id: 'AUR', label: 'MT AURELIA', short: 'AURELIA', affiliation: 'friendly', kind: 'Merchant tanker (convoy)', x: 22, y: 40, status: 'In convoy station 2, awaiting transit' },
    { id: 'KES', label: 'MV KESTREL', short: 'KESTREL', affiliation: 'friendly', kind: 'Merchant container ship (convoy)', x: 16, y: 30, status: 'In convoy station 3, awaiting transit' },
    { id: 'UAV2', label: 'UAV-2', short: 'UAV-2', affiliation: 'friendly', kind: 'Maritime patrol UAV', x: 44, y: 26, status: 'On station, strait surveillance' },
    { id: 'P7', label: 'PB P-7', short: 'P-7', affiliation: 'friendly', kind: 'Coast-guard patrol boat', x: 70, y: 56, status: 'In position, eastern patrol box' },
  ],

  decisions: {
    DP1: {
      id: 'DP1',
      title: 'Classify surface contact S-201',
      recommendation:
        'Designate S-201 as HOSTILE — probable fast attack craft. Keep UAV-2 on it and report to the TOC.',
      alternateCoa:
        'Hold S-201 as UNKNOWN and continue observation only. (Slower; cedes initiative if it is a fast attack craft closing the strait exit.)',
      reasoning: [
        'UAV-2 EO/IR identifies a fast military hull — low freeboard, military fit, no merchant lighting pattern.',
        'Coastal radar track history shows deliberate high-speed movement toward the strait exit, with course changes that shadow the convoy\u2019s forming-up position.',
        'SIGINT reports emitter activity consistent with a military surface-search set in S-201\u2019s vicinity.',
        'No friendly or coalition unit is tasked or reporting in that area. All three inputs are fresh and independent — see provenance.',
      ],
      inputs: [
        { id: 's1-uav', feedClass: 'sensor', source: 'UAV-2 EO/IR', claim: 'Fast military hull, no merchant lighting pattern', ageMin: 1, reliability: 0.95, supports: true, integrity: 'ok' },
        { id: 's1-radar', feedClass: 'sensor', source: 'Coastal radar C-1', claim: 'High-speed track maneuvering toward the strait exit', ageMin: 2, reliability: 0.9, supports: true, integrity: 'ok' },
        { id: 's1-sigint', feedClass: 'sigint', source: 'SIGINT (shore intercept)', claim: 'Emissions consistent with a military surface-search set near S-201', ageMin: 3, reliability: 0.8, supports: true, integrity: 'ok' },
      ],
      correctAction: 'accept',
      groundTruth:
        'S-201 was a hostile fast attack craft working toward the strait exit. Designating it hostile was correct.',
      onAccept: [
        { trackId: 'S201', set: { affiliation: 'hostile', status: 'HOSTILE — fast attack craft (designated)' } },
      ],
      onOverride: [
        { trackId: 'S201', set: { status: 'UNKNOWN — held under observation (operator decision)' } },
      ],
      overrideReasons: ['Insufficient identification', 'Sensor data unconvincing', 'Want more observation time', 'Other'],
    },

    DP2: {
      id: 'DP2',
      title: 'Shift the convoy to the northern lane?',
      recommendation:
        'Shift the convoy to the northern swept lane and slow to 8 knots while UAV-2 investigates drifting contact D-202. Do not take two merchants past an unexamined contact in the southern lane.',
      alternateCoa:
        'Hold the southern lane and transit speed; investigate D-202 after the convoy clears. (Faster transit; passes an unexamined drift contact at close range with no escort margin.)',
      reasoning: [
        'D-202 is drifting inside the southern lane\u2019s swept width — merchant draft and maneuvering room leave no safe passing distance on an unexamined contact.',
        'The northern lane is swept, marked, and costs roughly nine minutes at convoy speed.',
        'UAV-2 can classify D-202 within one orbit without breaking S-201 custody — coastal radar holds S-201 meanwhile.',
      ],
      inputs: [
        { id: 's2-uav', feedClass: 'sensor', source: 'UAV-2 EO/IR', claim: 'D-202 small contact, awash, no visible propulsion', ageMin: 2, reliability: 0.95, supports: true, integrity: 'ok' },
        { id: 's2-radar', feedClass: 'sensor', source: 'Coastal radar C-1', claim: 'D-202 drifting with the current, inside the southern lane', ageMin: 1, reliability: 0.9, supports: true, integrity: 'ok' },
        { id: 's2-esm', feedClass: 'sigint', source: 'ESM watch (FFG-61)', claim: 'Intermittent small-craft comms near D-202; no military emitter', ageMin: 4, reliability: 0.75, supports: true, integrity: 'ok' },
      ],
      correctAction: 'accept',
      groundTruth:
        'Shifting north was correct. D-202 was a disabled fishing dhow with a crew of four awaiting assistance — unlit and unable to maneuver. A close southern-lane pass at transit speed risked collision and a rescue under way in the channel.',
      onAccept: [
        { trackId: 'FFG', set: { x: 32, y: 31, status: 'Leading convoy into the northern lane' } },
        { trackId: 'AUR', set: { x: 24, y: 34, status: 'Shifting to northern lane, slowing to 8 knots' } },
        { trackId: 'KES', set: { x: 18, y: 25, status: 'Shifting to northern lane, slowing to 8 knots' } },
        { trackId: 'D202', set: { status: 'Under UAV-2 investigation — drifting contact' } },
      ],
      onOverride: [
        { trackId: 'FFG', set: { status: 'Holding southern lane at transit speed (operator decision)' } },
        { trackId: 'D202', set: { status: 'Not investigated — convoy passing south (operator decision)' } },
      ],
      overrideReasons: ['Schedule pressure', 'D-202 looks harmless', 'Northern lane costs too much time', 'Other'],
    },

    DP3: {
      id: 'DP3',
      title: 'Treat E-203 as friendly PB P-7?',
      recommendation:
        'Treat E-203 as FRIENDLY PB P-7 and thin the escort screen: FFG-61 closes the convoy. The AIS track identifies E-203 as coast-guard patrol boat P-7 on a rendezvous course.',
      alternateCoa:
        'Reject the AIS identity, hold E-203 as UNKNOWN/suspicious, keep the screen at full readiness, and query P-7 on the guard net.',
      reasoning: [
        'The AIS track (cooperative identification feed, via shore relay) broadcasts P-7\u2019s identity, call sign, and a rendezvous course from E-203\u2019s position.',
        'Standing rule applied: cooperative AIS identity takes precedence over sensor inference for friend/foe identification inside the transit corridor (collision and fratricide avoidance). That rule contributes most of this confidence — see the driver breakdown.',
        'UAV-2 EO/IR, coastal radar, and P-7\u2019s own voice report do NOT agree with the AIS identity. The recommendation follows the precedence rule despite the disagreement.',
        'Before acting, check the AIS input on the provenance strip: its actual age and integrity flags are not what its header claims.',
      ],
      ruleApplied: { label: 'Cooperative-ID precedence rule (AIS identity trusted in the corridor)', weight: 48 },
      inputs: [
        { id: 's3-ais', feedClass: 'blueforce', source: 'Shore relay — AIS rebroadcast (claims PB P-7)', claim: 'E-203 is PB P-7, on rendezvous course', ageMin: 16, claimedAgeMin: 1, reliability: 0.9, supports: true, integrity: 'anomaly' },
        { id: 's3-uav', feedClass: 'sensor', source: 'UAV-2 EO/IR', claim: 'Hull at E-203 is not P-7 — fast craft profile, no coast-guard markings', ageMin: 2, reliability: 0.95, supports: false, integrity: 'ok' },
        { id: 's3-radar', feedClass: 'sensor', source: 'Coastal radar C-1', claim: 'P-7\u2019s radar track stationary in its patrol box, 12 km from E-203', ageMin: 1, reliability: 0.9, supports: false, integrity: 'ok' },
        { id: 's3-voice', feedClass: 'blueforce', source: 'PB P-7 voice report (guard net)', claim: 'P-7 in its patrol box, no movement west', ageMin: 3, reliability: 0.85, supports: false, integrity: 'ok' },
      ],
      contradictions: [
        'The AIS rebroadcast places P-7 at E-203; UAV-2 EO/IR, coastal radar, and P-7 itself all place P-7 in its patrol box, 12 km away.',
        'The AIS message header claims a 1-minute-old update; the rebroadcast timestamp is 16 minutes old, and its shore-relay routing differs from every prior AIS relay message.',
      ],
      correctAction: 'override',
      groundTruth:
        'The AIS identity was spoofed — an adversary rebroadcast of P-7\u2019s identity, transmitted from the fast attack craft at E-203. P-7 never moved. Accepting would have treated a hostile craft as a friendly patrol boat inside the corridor and thinned the escort screen in front of it.',
      onAccept: [
        { trackId: 'E203', set: { affiliation: 'friendly', status: 'FRIENDLY — treated as PB P-7 per AIS relay (operator accepted)' } },
        { trackId: 'FFG', set: { status: 'Screen thinned — closing the convoy per AIS identity (operator accepted)' } },
      ],
      onOverride: [
        { trackId: 'E203', set: { status: 'UNKNOWN — AIS identity rejected by operator, treated as suspicious' } },
        { trackId: 'FFG', set: { status: 'Screen held — escort at full readiness' } },
      ],
      overrideReasons: ['Provenance anomaly on the AIS relay', 'Sensors contradict the identity', 'Source is single and stale', 'Gut check — picture feels wrong', 'Other'],
    },

    DP4: {
      id: 'DP4',
      title: 'Enter the narrows on a stale picture?',
      recommendation:
        'HOLD the convoy at the strait entrance. Do not enter the narrows or re-screen on the current picture — the inputs behind any order are 6–9 minutes old over the degraded SATCOM link. Advisory only until the link restores.',
      alternateCoa:
        'Enter the narrows on the last-known-good picture and close H-204. (Acts faster; takes two merchants into a confined channel toward a confirmed fast attack craft on stale data.)',
      reasoning: [
        'The SATCOM link has been degraded since T+18: the freshest input behind any maneuver order is 7 minutes old.',
        'H-204 is a confirmed fast attack craft near the eastern exit — maneuvering two merchants in a confined channel on stale data risks the convoy for no decision gain.',
        'Nothing in the current picture is time-critical inside the next update cycle; holding at the entrance costs minutes, not the transit.',
        'Confidence is low because the inputs are stale. Low confidence here means \u201cthe picture is old,\u201d not \u201cthe advice is bad.\u201d',
      ],
      inputs: [
        { id: 's4-uav', feedClass: 'sensor', source: 'UAV-2 EO/IR (via degraded SATCOM)', claim: 'S-201 holding off; no new contacts', ageMin: 7, reliability: 0.95, supports: true, integrity: 'stale' },
        { id: 's4-sigint', feedClass: 'sigint', source: 'SIGINT (buffered, via degraded SATCOM)', claim: 'H-204 emissions intermittent; position unchanged', ageMin: 8, reliability: 0.8, supports: true, integrity: 'stale' },
        { id: 's4-link', feedClass: 'link', source: 'Link monitor', claim: 'SATCOM at ~30% throughput; updates queued', ageMin: 0, reliability: 0.99, supports: true, integrity: 'ok' },
      ],
      linkDegraded: true,
      correctAction: 'accept',
      groundTruth:
        'Holding was correct. The link restored at T+25 with no change that required earlier action, and the convoy stayed out of the narrows while the picture was too old to trust.',
      onAccept: [
        { trackId: 'FFG', set: { status: 'Holding at strait entrance — advisory mode (degraded link)' } },
        { trackId: 'UAV2', set: { status: 'Holding orbit — degraded SATCOM' } },
      ],
      onOverride: [
        { trackId: 'FFG', set: { x: 46, y: 33, status: 'Entering the narrows on a stale picture (operator decision)' } },
      ],
      overrideReasons: ['Eastern threat cannot wait', 'Stale picture is good enough', 'Do not trust the hold logic', 'Other'],
    },

    DP5: {
      id: 'DP5',
      title: 'Designate H-204 the priority threat?',
      recommendation:
        'Designate H-204 as the priority threat and take the screening station: FFG-61 interposes between H-204 and the convoy, and air-support coordination is requested (request only — no execution authority implied). S-201 remains under UAV-2 custody.',
      alternateCoa:
        'Keep H-204 as a tracked threat without prioritizing. (Preserves flexibility; leaves a confirmed fast attack craft unaddressed at the strait exit.)',
      reasoning: [
        'Fresh, post-restoration UAV-2 reporting confirms H-204 active and maneuvering — identification no longer rests on the spoofed AIS track or a single delayed image.',
        'H-204 sits on the convoy\u2019s exit line; it is the pacing threat for the remainder of the transit.',
        'S-201 has slowed and custody is stable, so re-screening against H-204 does not trade away the western picture.',
      ],
      inputs: [
        { id: 's5-uav', feedClass: 'sensor', source: 'UAV-2 EO/IR', claim: 'H-204 under way, fast craft confirmed, no friendly markings', ageMin: 1, reliability: 0.95, supports: true, integrity: 'ok' },
        { id: 's5-sigint', feedClass: 'sigint', source: 'SIGINT (shore intercept)', claim: 'H-204 emissions match a military surface-search set', ageMin: 2, reliability: 0.85, supports: true, integrity: 'ok' },
        { id: 's5-radar', feedClass: 'sensor', source: 'Coastal radar C-1', claim: 'S-201 speed reduced; no new movement', ageMin: 2, reliability: 0.9, supports: true, integrity: 'ok' },
      ],
      correctAction: 'accept',
      groundTruth:
        'Correct. H-204 was a hostile fast attack craft positioned on the convoy\u2019s exit line; designating it the priority threat and re-screening was the right call, as a request through the normal approval chain.',
      onAccept: [
        { trackId: 'H204', set: { status: 'HOSTILE — fast attack craft, PRIORITY THREAT (escort re-screening)' } },
        { trackId: 'FFG', set: { x: 52, y: 32, status: 'On screening station — merchants covered' } },
      ],
      onOverride: [
        { trackId: 'H204', set: { status: 'HOSTILE — fast attack craft, tracked, not prioritized (operator decision)' } },
      ],
      overrideReasons: ['Preserve flexibility', 'Identification still not solid', 'Other priorities first', 'Other'],
    },
  },

  events: [
    {
      t: 0, id: 'S00', kind: 'info',
      headline: 'SITREP — convoy forming up',
      detail: 'Shore TOC assumes watch for the night transit. All feeds nominal: UAV-2 on station, coastal radar and SIGINT reporting, AIS picture current. FFG-61 is screen commander; MT AURELIA and MV KESTREL form up for the strait.',
    },
    {
      t: 2, id: 'S02', kind: 'track',
      headline: 'New surface contact S-201',
      detail: 'Coastal radar C-1 picks up an unknown surface contact east of the strait, fast-moving toward the exit.',
      effects: [
        { trackId: 'S201', add: { id: 'S201', label: 'S-201', short: 'S-201', affiliation: 'unknown', kind: 'Unknown surface contact', x: 88, y: 44, status: 'UNKNOWN — new contact, eastern approach' } },
      ],
    },
    {
      t: 4, id: 'S04', kind: 'track',
      headline: 'UAV-2 visual report on S-201',
      detail: 'UAV-2 EO/IR: fast military hull, low freeboard, no merchant lighting pattern. Not commercial traffic.',
      effects: [
        { trackId: 'S201', set: { status: 'UNKNOWN — fast military hull (UAV visual)' } },
        { trackId: 'UAV2', set: { x: 58, y: 30, status: 'Observing S-201' } },
      ],
    },
    {
      t: 6, id: 'S06', kind: 'decision',
      headline: 'Decision point DP-1',
      detail: 'The system issues a classification recommendation for S-201.',
      decisionId: 'DP1',
    },
    {
      t: 8, id: 'S08', kind: 'track',
      headline: 'Picture update',
      detail: 'PB P-7 reports a routine patrol-box boundary check (no change of position). S-201 continues toward the strait exit.',
      effects: [
        { trackId: 'P7', set: { status: 'In position — patrol-box boundary check reported' } },
        { trackId: 'S201', set: { x: 82, y: 42 } },
      ],
    },
    {
      t: 10, id: 'S10', kind: 'track',
      headline: 'Drifting contact D-202',
      detail: 'Coastal radar C-1 detects a slow drifting contact inside the southern transit lane.',
      effects: [
        { trackId: 'D202', add: { id: 'D202', label: 'D-202', short: 'D-202', affiliation: 'unknown', kind: 'Drifting contact', x: 58, y: 38, status: 'UNKNOWN — drifting contact, southern lane' } },
      ],
    },
    {
      t: 12, id: 'S12', kind: 'track',
      headline: 'ESM report — small-craft comms',
      detail: 'FFG-61\u2019s ESM watch reports intermittent small-craft voice comms near D-202; no military emitter identified.',
      effects: [
        { trackId: 'D202', set: { status: 'UNKNOWN — drifting contact, small-craft comms nearby (ESM)' } },
      ],
    },
    {
      t: 13, id: 'S13', kind: 'decision',
      headline: 'Decision point DP-2',
      detail: 'The system issues a recommendation on the convoy\u2019s lane.',
      decisionId: 'DP2',
    },
    {
      t: 15, id: 'S15', kind: 'inject',
      headline: 'INJECT — AIS contact received via shore relay',
      detail: 'A cooperative AIS track appears east of the strait exit, broadcasting the identity of coast-guard patrol boat PB P-7 on a rendezvous course. No sensor feed has reported P-7 leaving its patrol box.',
      effects: [
        { trackId: 'E203', add: { id: 'E203', label: 'E-203', short: 'E-203', affiliation: 'unknown', kind: 'AIS-only contact', x: 84, y: 30, status: 'UNKNOWN — AIS contact, claims PB P-7 identity' } },
      ],
    },
    {
      t: 16, id: 'S16', kind: 'decision',
      headline: 'Decision point DP-3',
      detail: 'The system issues a recommendation based on the AIS identity.',
      decisionId: 'DP3',
    },
    {
      t: 18, id: 'S18', kind: 'comms', setLinkDegraded: true,
      headline: 'INJECT — SATCOM link degraded',
      detail: 'The task unit\u2019s primary SATCOM link degrades (~30% throughput). Update rates drop; track data begins to age. The system flags degraded operation — confidence on subsequent recommendations is visibly reduced.',
      effects: [
        { trackId: 'S201', set: { stale: true } },
        { trackId: 'E203', set: { stale: true } },
        { trackId: 'D202', set: { stale: true } },
      ],
    },
    {
      t: 20, id: 'S20', kind: 'track',
      headline: 'H-204 confirmed (buffered report)',
      detail: 'A buffered UAV-2 image set, delayed by the degraded link, confirms a fast attack craft — designated H-204 — at the AIS contact\u2019s position. The hull does not match the broadcast identity.',
      effects: [
        { trackId: 'H204', add: { id: 'H204', label: 'H-204', short: 'H-204', affiliation: 'hostile', kind: 'Fast attack craft', x: 86, y: 33, status: 'HOSTILE — fast attack craft (confirmed, report delayed)' } },
        { trackId: 'E203', set: { status: 'AIS contact — hull does not match broadcast identity' } },
      ],
    },
    {
      t: 22, id: 'S22', kind: 'decision',
      headline: 'Decision point DP-4',
      detail: 'The system issues a recommendation under degraded-comms conditions.',
      decisionId: 'DP4',
    },
    {
      t: 25, id: 'S25', kind: 'comms', setLinkDegraded: false,
      headline: 'SATCOM link partially restored',
      detail: 'Throughput recovers. Queued updates flush: UAV-2 confirms S-201 has slowed, H-204 remains active near the exit, and D-202 is identified as a disabled fishing dhow with crew aboard. Track data is fresh again.',
      effects: [
        { trackId: 'S201', set: { stale: false, x: 78, y: 40, status: 'Speed reduced (fresh UAV report)' } },
        { trackId: 'E203', set: { stale: false } },
        { trackId: 'D202', set: { stale: false, status: 'Identified — disabled fishing dhow, crew aboard (fresh report)' } },
        { trackId: 'H204', set: { stale: false, status: 'HOSTILE — fast attack craft, active' } },
      ],
    },
    {
      t: 27, id: 'S27', kind: 'decision',
      headline: 'Decision point DP-5',
      detail: 'The system issues a recommendation on prioritizing H-204.',
      decisionId: 'DP5',
    },
    {
      t: 30, id: 'S30', kind: 'endex',
      headline: 'ENDEX',
      detail: 'Vignette complete. Ground truth is revealed in the debrief panel.',
    },
  ],

  inject: {
    decisionId: 'DP3',
    correctAction: 'override',
    pendingText: 'Bad-inject test (DP-3, the spoofed AIS identity): not yet decided.',
    caughtText:
      '✔ Error recovery: you caught the bad inject — DP-3\u2019s spoofed AIS identity was overridden. The recommendation was wrong; its provenance gave it away.',
    missedText:
      '✘ Automation bias event: DP-3\u2019s spoofed AIS identity was accepted. A hostile fast-attack craft was treated as a friendly patrol boat on fabricated data — the failure mode the glass box exists to prevent.',
  },
  mapLabels: { boundary: 'TRANSIT CORRIDOR', approach: 'EASTERN EXIT' },
};

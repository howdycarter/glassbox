import type { DecisionDef, ScenarioDef, ScenarioEvent, TrackDef } from '../types';

/* ------------------------------------------------------------------ */
/* POISONED PICTURE — one scripted, fully synthetic C2 vignette.       */
/* Deterministic: the same events, injects, recommendations, and       */
/* ground truth on every run. No randomness, no network, no real data. */
/* ------------------------------------------------------------------ */

export const SCENARIO_TITLE = 'POISONED PICTURE';
export const SCENARIO_SUBTITLE =
  'A contested-network vignette · Newton & Carter Labs · LAB-001 · All data synthetic';
export const END_TIME = 30;

export const INITIAL_TRACKS: (TrackDef & { status: string })[] = [
  { id: 'CP', label: 'Division CP', short: 'CP', affiliation: 'friendly', kind: 'Command post', x: 6, y: 34, status: 'Main CP — primary link nominal' },
  { id: 'A17', label: 'A/1-7 CAV', short: 'A/1-7', affiliation: 'friendly', kind: 'Maneuver company', x: 18, y: 44, status: 'In position, screening west' },
  { id: 'B17', label: 'B/1-7 CAV', short: 'B/1-7', affiliation: 'friendly', kind: 'Maneuver company', x: 34, y: 54, status: 'In position, sector center-south' },
  { id: 'F27', label: 'F/2-7 FA', short: 'F/2-7', affiliation: 'friendly', kind: 'Fires battery', x: 10, y: 60, status: 'In position' },
  { id: 'UAS1', label: 'UAS-1', short: 'UAS-1', affiliation: 'friendly', kind: 'Unmanned aircraft (Shadow)', x: 46, y: 28, status: 'On station, sector surveillance' },
];

export const DECISIONS: Record<string, DecisionDef> = {
  DP1: {
    id: 'DP1',
    title: 'Classify track U-101',
    recommendation:
      'Designate U-101 as HOSTILE — probable reconnaissance element. Maintain UAS-1 custody and report to higher.',
    alternateCoa:
      'Hold U-101 as UNKNOWN and continue observation only. (Slower; cedes initiative if it is hostile recon.)',
    reasoning: [
      'UAS-1 EO/IR identifies a wheeled military column — vehicle pattern and spacing match a reconnaissance element, not civilian traffic.',
      'Ground radar track history shows deliberate movement toward the sector boundary, with two course changes away from the road network.',
      'SIGINT reports emitter activity consistent with a military reconnaissance net in U-101\u2019s vicinity.',
      'No friendly unit is tasked or reporting in that grid. All three inputs are fresh and independent — see provenance.',
    ],
    inputs: [
      { id: 'dp1-uas', feedClass: 'sensor', source: 'UAS-1 EO/IR', claim: 'Wheeled military column, recon-pattern spacing', ageMin: 1, reliability: 0.95, supports: true, integrity: 'ok' },
      { id: 'dp1-radar', feedClass: 'sensor', source: 'Ground radar G-3', claim: 'Track maneuvering off-road toward sector boundary', ageMin: 2, reliability: 0.9, supports: true, integrity: 'ok' },
      { id: 'dp1-sigint', feedClass: 'sigint', source: 'SIGINT (team 2)', claim: 'Emissions consistent with a recon net near U-101', ageMin: 3, reliability: 0.8, supports: true, integrity: 'ok' },
    ],
    correctAction: 'accept',
    groundTruth:
      'U-101 was a hostile reconnaissance element probing the sector boundary. Designating it hostile was correct.',
    onAccept: [
      { trackId: 'U101', set: { affiliation: 'hostile', status: 'HOSTILE — recon element (designated)' } },
    ],
    onOverride: [
      { trackId: 'U101', set: { status: 'UNKNOWN — held under observation (operator decision)' } },
    ],
    overrideReasons: ['Insufficient identification', 'Sensor data unconvincing', 'Want more observation time', 'Other'],
  },

  DP2: {
    id: 'DP2',
    title: 'Retask UAS-1 to the eastern track?',
    recommendation:
      'Keep UAS-1 on U-101 custody; do NOT retask to U-102 yet. U-102 is a single radar track with SIGINT support but no visual ID, and U-101 is a confirmed hostile element in motion.',
    alternateCoa:
      'Retask UAS-1 to investigate U-102 now. (Gains identification of the eastern track; loses custody of a moving hostile element.)',
    reasoning: [
      'U-101 is confirmed hostile and moving — losing custody risks losing the one identified threat in the sector.',
      'U-102 remains covered by ground radar; its identification can wait one orbit cycle without going dark.',
      'SIGINT already associates U-102\u2019s area with air-defense emissions — sending the UAS closer before that picture clarifies risks the asset.',
    ],
    inputs: [
      { id: 'dp2-uas', feedClass: 'sensor', source: 'UAS-1 EO/IR', claim: 'U-101 still in custody, moving toward boundary', ageMin: 1, reliability: 0.95, supports: true, integrity: 'ok' },
      { id: 'dp2-radar', feedClass: 'sensor', source: 'Ground radar G-3', claim: 'U-102 slow/stationary, single track, held on radar', ageMin: 2, reliability: 0.9, supports: true, integrity: 'ok' },
      { id: 'dp2-sigint', feedClass: 'sigint', source: 'SIGINT (team 2)', claim: 'ADA-type emissions near U-102\u2019s origin', ageMin: 5, reliability: 0.8, supports: true, integrity: 'ok' },
    ],
    correctAction: 'accept',
    groundTruth:
      'Keeping custody was correct. U-102 was the support element for H-201, an air-defense system — the threat the SIGINT hint pointed at. Flying the UAS to it early would have risked the asset.',
    onAccept: [
      { trackId: 'UAS1', set: { status: 'Maintaining custody of U-101' } },
      { trackId: 'U102', set: { status: 'UNKNOWN — under radar observation' } },
    ],
    onOverride: [
      { trackId: 'UAS1', set: { x: 68, y: 36, status: 'Retasked to U-102 (operator decision)' } },
      { trackId: 'U101', set: { stale: true, status: 'HOSTILE — custody lost, last known position' } },
    ],
    overrideReasons: ['Eastern track is the bigger risk', 'U-101 can be re-acquired', 'Disagree with the prioritization', 'Other'],
  },

  DP3: {
    id: 'DP3',
    title: 'Reclassify U-101 as friendly?',
    recommendation:
      'Reclassify U-101 as FRIENDLY (probable B/1-7 advance element) and stand down UAS-1 custody. Blue-force relay R-2 places B/1-7 in U-101\u2019s grid.',
    alternateCoa:
      'Reject the relay report, maintain U-101 as HOSTILE, and query B/1-7 on the primary net to confirm its position.',
    reasoning: [
      'Relay report R-2 (blue-force tracker feed) places B/1-7 in U-101\u2019s grid square.',
      'Standing rule applied: a blue-force tracking report takes precedence over sensor inference for friendly identification (fratricide avoidance). That rule contributes most of this confidence — see the driver breakdown.',
      'UAS-1, G-3 radar, and B/1-7\u2019s own voice report do NOT agree with the relay report. The recommendation follows the precedence rule despite the disagreement.',
      'Before acting, check the relay input on the provenance strip: its actual age and integrity flags are not what its header claims.',
    ],
    ruleApplied: { label: 'Blue-force precedence rule (fratricide avoidance)', weight: 48 },
    inputs: [
      { id: 'dp3-relay', feedClass: 'blueforce', source: 'Relay R-2 — partner blue-force feed', claim: 'B/1-7 advance element is in U-101\u2019s grid', ageMin: 14, claimedAgeMin: 1, reliability: 0.9, supports: true, integrity: 'anomaly' },
      { id: 'dp3-uas', feedClass: 'sensor', source: 'UAS-1 EO/IR', claim: 'Column is not B/1-7 — vehicle pattern differs, B/1-7 markings absent', ageMin: 2, reliability: 0.95, supports: false, integrity: 'ok' },
      { id: 'dp3-radar', feedClass: 'sensor', source: 'Ground radar G-3', claim: 'B/1-7 stationary at its reported position, 9 km from U-101', ageMin: 1, reliability: 0.9, supports: false, integrity: 'ok' },
      { id: 'dp3-bforce', feedClass: 'blueforce', source: 'B/1-7 voice report (primary net)', claim: 'B/1-7 in position, no movement north', ageMin: 3, reliability: 0.85, supports: false, integrity: 'ok' },
    ],
    contradictions: [
      'Relay R-2 places B/1-7 in U-101\u2019s grid; UAS-1 EO/IR, G-3 radar, and B/1-7 itself all place B/1-7 at its original position, 9 km away.',
      'Relay R-2\u2019s header claims a 1-minute-old update; its message timestamp is 14 minutes old, and its routing path differs from every prior R-2 message.',
    ],
    correctAction: 'override',
    groundTruth:
      'The relay report was fabricated — an adversary spoof injected into the partner feed. B/1-7 never moved; U-101 was hostile. Accepting would have reclassified a hostile reconnaissance element as friendly and dropped UAS custody of it.',
    onAccept: [
      { trackId: 'U101', set: { affiliation: 'friendly', status: 'FRIENDLY — reclassified per relay R-2 (operator accepted)' } },
      { trackId: 'UAS1', set: { status: 'Custody stood down per relay R-2' } },
    ],
    onOverride: [
      { trackId: 'U101', set: { status: 'HOSTILE — relay report rejected by operator' } },
      { trackId: 'UAS1', set: { status: 'Maintaining custody of U-101' } },
    ],
    overrideReasons: ['Provenance anomaly on the relay feed', 'Sensors contradict the report', 'Source is single and stale', 'Gut check — picture feels wrong', 'Other'],
  },

  DP4: {
    id: 'DP4',
    title: 'Act on a stale picture?',
    recommendation:
      'HOLD current dispositions. Do not retask UAS-1 or maneuver on the current picture — the inputs behind any order are 6–9 minutes old over the degraded link. Advisory only until the link restores.',
    alternateCoa:
      'Retask UAS-1 toward H-201 on the last-known-good picture. (Acts faster; flies toward a confirmed air-defense system on stale data.)',
    reasoning: [
      'Primary link has been degraded since T+18: the freshest input behind any retasking order is 7 minutes old.',
      'H-201 is a confirmed air-defense system — maneuvering the UAS on stale data risks the asset for no decision gain.',
      'Nothing in the current picture is time-critical inside the next update cycle; holding costs nothing measurable.',
      'Confidence is low because the inputs are stale. Low confidence here means \u201cthe picture is old,\u201d not \u201cthe advice is bad.\u201d',
    ],
    inputs: [
      { id: 'dp4-uas', feedClass: 'sensor', source: 'UAS-1 EO/IR (via degraded link)', claim: 'U-101 column slowed; no new tracks', ageMin: 7, reliability: 0.95, supports: true, integrity: 'stale' },
      { id: 'dp4-sigint', feedClass: 'sigint', source: 'SIGINT (buffered, via degraded link)', claim: 'H-201 emissions intermittent; position unchanged', ageMin: 8, reliability: 0.8, supports: true, integrity: 'stale' },
      { id: 'dp4-link', feedClass: 'link', source: 'Link monitor', claim: 'Primary link at ~30% throughput; updates queued', ageMin: 0, reliability: 0.99, supports: true, integrity: 'ok' },
    ],
    linkDegraded: true,
    correctAction: 'accept',
    groundTruth:
      'Holding was correct. The link restored at T+25 with no change that required earlier action, and the UAS stayed out of H-201\u2019s engagement envelope.',
    onAccept: [
      { trackId: 'UAS1', set: { status: 'Holding orbit — advisory mode (degraded link)' } },
    ],
    onOverride: [
      { trackId: 'UAS1', set: { x: 74, y: 34, status: 'Retasked toward H-201 on a stale picture (operator decision)' } },
    ],
    overrideReasons: ['Eastern threat cannot wait', 'Stale picture is good enough', 'Do not trust the hold logic', 'Other'],
  },

  DP5: {
    id: 'DP5',
    title: 'Prioritize H-201 for fires coordination?',
    recommendation:
      'Designate H-201 as the priority target and pass it to F/2-7 for fires coordination (request only — no execution authority implied). U-101 remains under UAS-1 custody.',
    alternateCoa:
      'Keep H-201 as a tracked threat without prioritizing. (Preserves fires capacity; leaves an active ADA system unaddressed.)',
    reasoning: [
      'Fresh, post-restoration UAS-1 reporting confirms H-201 active and emitting — identification no longer rests on SIGINT alone.',
      'H-201 covers the eastern approach U-102 was supporting; it is the pacing threat for any further maneuver.',
      'U-101\u2019s column has halted and custody is stable, so prioritizing H-201 does not trade away the northern picture.',
    ],
    inputs: [
      { id: 'dp5-uas', feedClass: 'sensor', source: 'UAS-1 EO/IR', claim: 'H-201 radar active; vehicle confirmed as ADA system', ageMin: 1, reliability: 0.95, supports: true, integrity: 'ok' },
      { id: 'dp5-sigint', feedClass: 'sigint', source: 'SIGINT (team 2)', claim: 'H-201 emissions match an ADA acquisition radar', ageMin: 2, reliability: 0.85, supports: true, integrity: 'ok' },
      { id: 'dp5-radar', feedClass: 'sensor', source: 'Ground radar G-3', claim: 'U-101 column halted; no new movement', ageMin: 2, reliability: 0.9, supports: true, integrity: 'ok' },
    ],
    correctAction: 'accept',
    groundTruth:
      'Correct. H-201 was an active air-defense system covering the eastern approach; prioritizing it for fires coordination was the right call, as a request through the normal approval chain.',
    onAccept: [
      { trackId: 'H201', set: { status: 'HOSTILE — ADA, PRIORITY TARGET (passed to F/2-7)' } },
    ],
    onOverride: [
      { trackId: 'H201', set: { status: 'HOSTILE — ADA, tracked, not prioritized (operator decision)' } },
    ],
    overrideReasons: ['Preserve fires capacity', 'Identification still not solid', 'Other priorities first', 'Other'],
  },
};

export const EVENTS: ScenarioEvent[] = [
  {
    t: 0, id: 'E00', kind: 'info',
    headline: 'SITREP — sector quiet',
    detail: 'Division CP assumes watch. All feeds nominal: UAS-1 on station, G-3 radar and SIGINT reporting, blue-force picture current.',
  },
  {
    t: 2, id: 'E02', kind: 'track',
    headline: 'New unknown track U-101',
    detail: 'Ground radar G-3 picks up an unknown track entering the sector from the northeast, moving off-road.',
    effects: [
      { trackId: 'U101', add: { id: 'U101', label: 'U-101', short: 'U-101', affiliation: 'unknown', kind: 'Unknown track', x: 76, y: 16, status: 'UNKNOWN — new track, NE approach' } },
    ],
  },
  {
    t: 4, id: 'E04', kind: 'track',
    headline: 'UAS-1 visual report on U-101',
    detail: 'UAS-1 EO/IR: wheeled column, military vehicle pattern, recon-style spacing. Not civilian traffic.',
    effects: [
      { trackId: 'U101', set: { status: 'UNKNOWN — wheeled military column (UAS visual)' } },
      { trackId: 'UAS1', set: { x: 58, y: 24, status: 'Observing U-101' } },
    ],
  },
  {
    t: 6, id: 'E06', kind: 'decision',
    headline: 'Decision point DP-1',
    detail: 'The system issues a classification recommendation for U-101.',
    decisionId: 'DP1',
  },
  {
    t: 8, id: 'E08', kind: 'track',
    headline: 'Picture update',
    detail: 'B/1-7 reports a routine local security adjustment (no change of position). U-101 continues toward the sector boundary.',
    effects: [
      { trackId: 'B17', set: { status: 'In position — local security adjustment reported' } },
      { trackId: 'U101', set: { x: 68, y: 21 } },
    ],
  },
  {
    t: 10, id: 'E10', kind: 'track',
    headline: 'New unknown track U-102',
    detail: 'Ground radar G-3 detects a second unknown track in the east, slow-moving near a tree line.',
    effects: [
      { trackId: 'U102', add: { id: 'U102', label: 'U-102', short: 'U-102', affiliation: 'unknown', kind: 'Unknown track', x: 84, y: 46, status: 'UNKNOWN — new track, eastern sector' } },
    ],
  },
  {
    t: 12, id: 'E12', kind: 'track',
    headline: 'SIGINT report — ADA-type emissions',
    detail: 'SIGINT team 2 reports emissions consistent with an air-defense radar originating near U-102\u2019s area.',
    effects: [
      { trackId: 'U102', set: { status: 'UNKNOWN — possible ADA support element (SIGINT)' } },
    ],
  },
  {
    t: 13, id: 'E13', kind: 'decision',
    headline: 'Decision point DP-2',
    detail: 'The system issues a recommendation on retasking UAS-1.',
    decisionId: 'DP2',
  },
  {
    t: 15, id: 'E15', kind: 'inject',
    headline: 'INJECT — relay report R-2 received',
    detail: 'A blue-force report arrives via partner relay R-2: it claims B/1-7 has advanced north into the grid square occupied by U-101. Sensor feeds have not reported any such movement.',
  },
  {
    t: 16, id: 'E16', kind: 'decision',
    headline: 'Decision point DP-3',
    detail: 'The system issues a recommendation based on the relay report.',
    decisionId: 'DP3',
  },
  {
    t: 18, id: 'E18', kind: 'comms', setLinkDegraded: true,
    headline: 'INJECT — primary C2 link degraded',
    detail: 'Primary link throughput collapses (~30%). Update rates drop; track data begins to age. The system flags degraded operation — confidence on subsequent recommendations is visibly reduced.',
    effects: [
      { trackId: 'U101', set: { stale: true } },
      { trackId: 'U102', set: { stale: true } },
    ],
  },
  {
    t: 20, id: 'E20', kind: 'track',
    headline: 'H-201 confirmed (buffered report)',
    detail: 'A buffered SIGINT/UAS report, delayed by the degraded link, confirms an air-defense system — designated H-201 — near U-102\u2019s position.',
    effects: [
      { trackId: 'H201', add: { id: 'H201', label: 'H-201', short: 'H-201', affiliation: 'hostile', kind: 'Air-defense system', x: 86, y: 38, status: 'HOSTILE — ADA system (confirmed, report delayed)' } },
      { trackId: 'U102', set: { status: 'UNKNOWN — probable ADA support element' } },
    ],
  },
  {
    t: 22, id: 'E22', kind: 'decision',
    headline: 'Decision point DP-4',
    detail: 'The system issues a recommendation under degraded-comms conditions.',
    decisionId: 'DP4',
  },
  {
    t: 25, id: 'E25', kind: 'comms', setLinkDegraded: false,
    headline: 'Primary link partially restored',
    detail: 'Throughput recovers. Queued updates flush: UAS-1 confirms U-101\u2019s column has halted; H-201 remains active. Track data is fresh again.',
    effects: [
      { trackId: 'U101', set: { stale: false, x: 64, y: 23, status: 'Column halted (fresh UAS report)' } },
      { trackId: 'U102', set: { stale: false } },
      { trackId: 'H201', set: { stale: false, status: 'HOSTILE — ADA system, active' } },
    ],
  },
  {
    t: 27, id: 'E27', kind: 'decision',
    headline: 'Decision point DP-5',
    detail: 'The system issues a recommendation on prioritizing H-201.',
    decisionId: 'DP5',
  },
  {
    t: 30, id: 'E30', kind: 'endex',
    headline: 'ENDEX',
    detail: 'Vignette complete. Ground truth is revealed in the debrief panel.',
  },
];

/* The v1 vignette as a bundled ScenarioDef (v3). The top-level exports
   above remain as aliases — the engine now consumes the bundle, and the
   v1/v2 verification sections address the aliases exactly as before. */
export const POISONED_PICTURE: ScenarioDef = {
  id: 'poisoned-picture',
  title: SCENARIO_TITLE,
  subtitle: SCENARIO_SUBTITLE,
  endTime: END_TIME,
  initialTracks: INITIAL_TRACKS,
  decisions: DECISIONS,
  events: EVENTS,
  inject: {
    decisionId: 'DP3',
    correctAction: 'override',
    pendingText: 'Bad-inject test (DP-3, the spoofed relay report): not yet decided.',
    caughtText:
      '✔ Error recovery: you caught the bad inject — DP-3\u2019s spoofed relay report was overridden. The recommendation was wrong; its provenance gave it away.',
    missedText:
      '✘ Automation bias event: DP-3\u2019s spoofed relay report was accepted. A hostile element was reclassified as friendly on fabricated data — the failure mode the glass box exists to prevent.',
  },
  mapLabels: { boundary: 'SECTOR BOUNDARY', approach: 'NE APPROACH' },
};

import type { DecisionDef, TrackState } from '../types';
import { applyEffects, type GameState } from './engine';
import { DEFAULT_WEIGHTS } from './prioritization';
import { DEFAULT_SCENARIO } from '../data/scenarios';

/* ------------------------------------------------------------------ */
/* What-If Replanning (v2): branch a course of action from a decision  */
/* point and project its effect on the situation picture — WITHOUT     */
/* touching the live run. A projection runs the engine's own effect    */
/* applier over a snapshot of the tracks, so a what-if can never       */
/* diverge from what real resolution would do to the picture.          */
/*                                                                     */
/* Branching writes nothing to the forensic log and mutates no game    */
/* state; the panel that consumes this is labeled a sandbox for        */
/* exactly that reason. A projection shows picture consequences only — */
/* it never reveals ground truth or the correct action.                */
/* ------------------------------------------------------------------ */

export type BranchAction = 'accept' | 'override';

export interface TrackChange {
  trackId: string;
  label: string;
  field: 'appears' | 'affiliation' | 'status' | 'position' | 'staleness';
  from: string;
  to: string;
}

export interface BranchProjection {
  action: BranchAction;
  /** The picture if this COA were executed from the branch snapshot. */
  tracksAfter: Record<string, TrackState>;
  changes: TrackChange[];
}

function describeTrack(t: TrackState): string {
  return `${t.affiliation} — ${t.status}`;
}

/** Diff two track pictures into human-readable changes. */
export function diffTracks(
  before: Record<string, TrackState>,
  after: Record<string, TrackState>,
): TrackChange[] {
  const changes: TrackChange[] = [];
  const ids = new Set([...Object.keys(before), ...Object.keys(after)]);
  for (const id of ids) {
    const b = before[id];
    const a = after[id];
    if (!a) continue;
    if (!b) {
      changes.push({ trackId: id, label: a.label, field: 'appears', from: 'not on picture', to: describeTrack(a) });
      continue;
    }
    if (a.affiliation !== b.affiliation) {
      changes.push({ trackId: id, label: a.label, field: 'affiliation', from: b.affiliation, to: a.affiliation });
    }
    if (a.status !== b.status) {
      changes.push({ trackId: id, label: a.label, field: 'status', from: b.status, to: a.status });
    }
    if (a.x !== b.x || a.y !== b.y) {
      changes.push({
        trackId: id,
        label: a.label,
        field: 'position',
        from: `grid ${b.x},${b.y}`,
        to: `grid ${a.x},${a.y}`,
      });
    }
    if (a.stale !== b.stale) {
      changes.push({
        trackId: id,
        label: a.label,
        field: 'staleness',
        from: b.stale ? 'stale' : 'fresh',
        to: a.stale ? 'stale' : 'fresh',
      });
    }
  }
  return changes.sort((x, y) => x.trackId.localeCompare(y.trackId) || x.field.localeCompare(y.field));
}

/** Project one COA from a track snapshot. Pure: the inputs are not mutated. */
export function projectBranch(
  snapshot: Record<string, TrackState>,
  def: DecisionDef,
  action: BranchAction,
): BranchProjection {
  const shell: GameState = {
    clock: 0,
    playing: false,
    ended: false,
    mode: 'glass',
    // applyEffects reads only the shell's tracks; the scenario reference
    // is never consulted by a projection.
    scenario: DEFAULT_SCENARIO,
    tracks: snapshot,
    fired: [],
    pending: null,
    records: [],
    log: [],
    logSeq: 0,
    linkDegraded: false,
    weights: structuredClone(DEFAULT_WEIGHTS),
    committedWeights: structuredClone(DEFAULT_WEIGHTS),
    // The Advisor never speaks inside a projection either — a What-If
    // branch is a picture simulation, not a decision point.
    advisorMode: 'deterministic',
    modelLog: [],
    modelLogSeq: 0,
  };
  const effects = action === 'accept' ? def.onAccept : def.onOverride;
  const after = applyEffects(shell, effects).tracks;
  return { action, tracksAfter: after, changes: diffTracks(snapshot, after) };
}

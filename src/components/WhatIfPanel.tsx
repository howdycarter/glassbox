import { GitBranch, Trash2 } from 'lucide-react';
import { useEffect, useState } from 'react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { PanelShell, SectionLabel } from './Panel';
import { diffTracks, projectBranch, type BranchAction, type TrackChange } from '../lib/whatif';
import { fmtClock } from '../lib/engine';
import type { DecisionDef, DecisionRecord, Mode, TrackState } from '../types';

/* What-If Replanning (v2): branch a course of action from the pending
   decision point and compare its projected effect on the picture against
   the main line, side by side.

   A branch is a projection over a snapshot of the tracks, run through the
   engine's own effect applier — it cannot diverge from what real
   resolution would do to the picture. Both columns' projections are
   computed at branch time and frozen; branching writes NOTHING to the
   forensic log and mutates no game state. This panel is a sandbox and
   says so. A projection shows picture consequences only — never ground
   truth, never which action was correct.

   When the operator resolves the decision, the branch card stays: its
   main-line column flips from the as-issued projection to the actual
   outcome, so the road not taken remains comparable after the fact. */

interface Branch {
  decisionId: string;
  title: string;
  /** The branched (what-if) course of action. */
  action: BranchAction;
  branchedAtClock: number;
  recommendation: string;
  alternateCoa?: string;
  /** Picture at branch time (pre-resolution). */
  snapshot: Record<string, TrackState>;
  /** Frozen projection of the what-if COA from the snapshot. */
  branchChanges: TrackChange[];
  /** Frozen projection of the as-issued (accept) path from the snapshot. */
  mainProjectionChanges: TrackChange[];
  /** Picture captured on the first render after the operator resolved. */
  actualTracks: Record<string, TrackState> | null;
  actualAction: BranchAction | null;
}

function ChangeList({ changes, emptyText }: { changes: TrackChange[]; emptyText: string }) {
  if (changes.length === 0)
    return <p className="text-[13px] text-muted-foreground">{emptyText}</p>;
  return (
    <ul className="list-disc space-y-1 pl-5 text-[13px]">
      {changes.map((c, i) => (
        <li key={i}>
          <strong>{c.label}</strong> · {c.field}: {c.from} → {c.to}
        </li>
      ))}
    </ul>
  );
}

export default function WhatIfPanel({
  pending,
  records,
  tracks,
  mode,
  clock,
}: {
  pending: DecisionDef | null;
  records: DecisionRecord[];
  tracks: Record<string, TrackState>;
  mode: Mode;
  clock: number;
}) {
  const [branches, setBranches] = useState<Branch[]>([]);

  // Capture the actual outcome for any branch whose decision just resolved.
  // The first render after RESOLVE carries the post-resolution tracks
  // (effects apply in the same dispatch, before any further clock tick).
  useEffect(() => {
    setBranches((prev) =>
      prev.map((b) => {
        if (b.actualTracks !== null) return b;
        const rec = records.find((r) => r.decisionId === b.decisionId);
        if (!rec || rec.action === null) return b;
        return { ...b, actualTracks: tracks, actualAction: rec.action };
      }),
    );
  }, [records, tracks]);

  if (mode === 'black') {
    return (
      <PanelShell
        title="WHAT-IF REPLANNING"
        sub="sandbox projection · not part of the forensic record"
      >
        <p className="rounded-lg border border-dashed p-3 text-sm text-muted-foreground">
          Black-Box mode: what-if replanning is a glass-box instrument and is hidden in this
          condition. Switch to Glass-Box to branch a course of action from a decision point.
        </p>
      </PanelShell>
    );
  }

  const branch = (action: BranchAction) => {
    if (!pending) return;
    const snapshot = tracks;
    const entry: Branch = {
      decisionId: pending.id,
      title: pending.title,
      action,
      branchedAtClock: clock,
      recommendation: pending.recommendation,
      alternateCoa: pending.alternateCoa,
      snapshot,
      branchChanges: projectBranch(snapshot, pending, action).changes,
      mainProjectionChanges: projectBranch(snapshot, pending, 'accept').changes,
      actualTracks: null,
      actualAction: null,
    };
    setBranches((prev) => [...prev.filter((b) => b.decisionId !== pending.id), entry]);
  };

  const clear = (decisionId: string) =>
    setBranches((prev) => prev.filter((b) => b.decisionId !== decisionId));

  return (
    <PanelShell
      title="WHAT-IF REPLANNING"
      sub="sandbox projection · not part of the forensic record"
    >
      {pending ? (
        <div>
          <p className="text-[13px] text-muted-foreground">
            Branch a what-if from{' '}
            <strong className="text-foreground">
              {pending.id} — {pending.title}
            </strong>{' '}
            (clock held at {fmtClock(clock)}). The projection runs the scenario's own resolution
            effects over a snapshot; the live run and its log are untouched.
          </p>
          <div className="mt-2.5 flex flex-wrap gap-2.5">
            <Button variant="outline" onClick={() => branch('accept')}>
              <GitBranch /> Project: accept the recommendation
            </Button>
            <Button variant="outline" onClick={() => branch('override')}>
              <GitBranch /> Project: override (alternate COA)
            </Button>
          </div>
        </div>
      ) : (
        <p className="text-[13px] text-muted-foreground">
          No decision is pending. When a recommendation is issued, branch its alternate course of
          action here and compare the projected pictures side by side.
        </p>
      )}

      {branches.map((b) => {
        const resolved = b.actualTracks !== null;
        const mainChanges = resolved
          ? diffTracks(b.snapshot, b.actualTracks!)
          : b.mainProjectionChanges;
        const tookBranch = resolved && b.actualAction === b.action;
        return (
          <Card key={b.decisionId} className="mt-3.5 gap-0 rounded-lg bg-secondary/40 py-0 shadow-none">
            <CardHeader className="flex flex-row flex-wrap items-baseline gap-x-3 space-y-0 px-4 py-3">
              <strong className="text-sm">
                {b.decisionId} — {b.title}
              </strong>
              <span className="text-xs text-muted-foreground">
                branched {fmtClock(b.branchedAtClock)} ·{' '}
                {resolved
                  ? tookBranch
                    ? 'the operator took the branched COA — the columns show projection vs actual'
                    : 'resolved on the main line — the what-if column is the road not taken'
                  : 'decision still pending — both columns are projections'}
              </span>
              <Button
                variant="ghost"
                size="sm"
                className="ml-auto"
                onClick={() => clear(b.decisionId)}
              >
                <Trash2 /> Clear branch
              </Button>
            </CardHeader>
            <CardContent className="px-4 pb-4">
              <div className="grid gap-3.5 lg:grid-cols-2">
                <div className="rounded-md border bg-card p-3">
                  <SectionLabel className="mb-1.5">
                    Main line — {resolved ? `actual (operator ${b.actualAction})` : 'as issued (accept)'}
                  </SectionLabel>
                  <p className="text-[13px]">{b.recommendation}</p>
                  <SectionLabel className="mt-3 mb-1.5">Picture changes</SectionLabel>
                  <ChangeList
                    changes={mainChanges}
                    emptyText="No track changes — the picture is unchanged by this path."
                  />
                </div>
                <div className="rounded-md border border-primary/40 bg-card p-3">
                  <SectionLabel className="mb-1.5">
                    What-if branch — {b.action === 'accept' ? 'accept' : 'override (alternate COA)'}
                  </SectionLabel>
                  <p className="text-[13px]">
                    {b.action === 'accept'
                      ? b.recommendation
                      : (b.alternateCoa ?? 'Override the recommendation.')}
                  </p>
                  <SectionLabel className="mt-3 mb-1.5">Projected picture changes</SectionLabel>
                  <ChangeList
                    changes={b.branchChanges}
                    emptyText="No track changes — the picture is unchanged by this path."
                  />
                </div>
              </div>
              <p className="mt-3 font-mono text-[11.5px] text-muted-foreground">
                Projection only: consequences for the situation picture, computed from the branch
                snapshot. What happens downstream still depends on the operator's later decisions —
                and this sandbox never reveals which action was correct.
              </p>
            </CardContent>
          </Card>
        );
      })}
    </PanelShell>
  );
}

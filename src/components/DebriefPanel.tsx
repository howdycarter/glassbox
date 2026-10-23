import { Crosshair } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Progress } from '@/components/ui/progress';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { PanelShell, SectionLabel } from './Panel';
import { systemReliability } from '../lib/recommender';
import { cn } from '@/lib/utils';
import type { DecisionDef, DecisionRecord, InjectReport, Mode } from '../types';

/* Debrief: decisions scored against hidden scenario ground truth.
   The headline measure is trust calibration — operator reliance vs the
   system's actual reliability (80% in both current vignettes: the
   recommender is right on 4 of 5 decision points, deliberately wrong
   on the bad-inject decision, which the scenario declares). */

function StatCard({ value, label }: { value: string; label: string }) {
  return (
    <Card className="gap-0 rounded-lg bg-secondary/40 px-3.5 py-3 shadow-none">
      <span className="font-mono text-[22px] leading-none font-bold tabular-nums">{value}</span>
      <span className="mt-1.5 text-xs leading-snug text-muted-foreground">{label}</span>
    </Card>
  );
}

export default function DebriefPanel({
  records,
  mode,
  ended,
  decisions,
  inject,
}: {
  records: DecisionRecord[];
  mode: Mode;
  ended: boolean;
  /** The loaded vignette's decisions (ground truth source, v3). */
  decisions: Record<string, DecisionDef>;
  /** The loaded vignette's bad-inject declaration (v3). */
  inject: InjectReport;
}) {
  const resolved = records.filter((r) => r.action !== null);
  const totalDecisions = Object.keys(decisions).length;
  const correctCount = resolved.filter((r) => r.correct).length;
  const acceptedCount = resolved.filter((r) => r.action === 'accept').length;
  const correctAccepts = resolved.filter((r) => r.action === 'accept' && r.correct).length;
  const correctOverrides = resolved.filter((r) => r.action === 'override' && r.correct).length;
  const errors = resolved.filter((r) => r.correct === false).length;

  const trap = records.find((r) => r.decisionId === inject.decisionId);
  const caughtInject = trap?.action === inject.correctAction;

  const latencies = resolved.map((r) => r.latencySec ?? 0);
  const avgLatency =
    latencies.length > 0 ? (latencies.reduce((a, b) => a + b, 0) / latencies.length).toFixed(1) : '—';

  const reliability = systemReliability(Object.values(decisions));
  const reliance = resolved.length > 0 ? Math.round((acceptedCount / resolved.length) * 100) : 0;
  const gap = Math.abs(reliance - reliability);
  const calibrationVerdict =
    resolved.length === 0
      ? 'No decisions yet.'
      : gap <= 15
        ? 'Well calibrated — reliance tracks what the system actually deserved.'
        : reliance > reliability
          ? 'Over-trust — reliance exceeded the system\u2019s actual reliability. That is the automation-bias failure mode this vignette is built to expose.'
          : 'Under-trust — the operator discounted the system below its actual reliability, carrying load the aid could have carried.';

  if (!ended && resolved.length === 0) return null;

  const verdictState = trap?.action ? (caughtInject ? 'caught' : 'missed') : 'pending';

  return (
    <PanelShell
      title="DEBRIEF — SCORED AGAINST GROUND TRUTH"
      sub={`${ended ? 'vignette complete' : 'in progress'} · run in ${mode === 'glass' ? 'Glass-Box' : 'Black-Box'} mode`}
    >
      <div className="grid grid-cols-2 gap-2.5 xl:grid-cols-4">
        <StatCard
          value={`${resolved.length}/${totalDecisions}`}
          label="decisions made"
        />
        <StatCard
          value={String(correctCount)}
          label={`correct (${correctAccepts} accepts · ${correctOverrides} overrides)`}
        />
        <StatCard value={String(errors)} label="errors vs ground truth" />
        <StatCard
          value={`${avgLatency}s`}
          label="avg decision latency (real time with recommendation open)"
        />
      </div>

      <div
        className={cn(
          'mt-3 rounded-lg border px-3.5 py-2.5 text-sm',
          verdictState === 'caught' && 'border-emerald-400/50 bg-emerald-400/5',
          verdictState === 'missed' && 'border-red-400/50 bg-red-400/5',
          verdictState === 'pending' && 'border-border',
        )}
      >
        {trap?.action === null || trap?.action === undefined
          ? inject.pendingText
          : caughtInject
            ? inject.caughtText
            : inject.missedText}
      </div>

      <div className="mt-4">
        <SectionLabel className="mb-2.5">Trust calibration</SectionLabel>
        <div className="grid grid-cols-[190px_1fr_48px] items-center gap-2.5 text-[13px]">
          <span>Operator reliance (accepted)</span>
          <Progress
            value={reliance}
            className="h-2.5"
            indicatorClassName="bg-blue-400"
            aria-label={`Operator reliance ${reliance} percent`}
          />
          <strong className="text-right font-mono tabular-nums">{reliance}%</strong>
          <span>Actual system reliability</span>
          <Progress
            value={reliability}
            className="h-2.5"
            aria-label={`Actual system reliability ${reliability} percent`}
          />
          <strong className="text-right font-mono tabular-nums">{reliability}%</strong>
        </div>
        <p className="mt-2 text-sm text-muted-foreground">
          Calibration gap: {gap} points. {calibrationVerdict}
        </p>
        {mode === 'black' && (
          <p className="mt-1.5 text-sm text-muted-foreground">
            This run was in Black-Box mode — no reasoning, provenance, or contradiction flags.
            Reset and run it in Glass-Box mode: same scenario, same trap, instruments on.
          </p>
        )}
      </div>

      {ended && (
        <div className="mt-4">
          <Dialog>
            <DialogTrigger asChild>
              <Button variant="outline">
                <Crosshair /> Ground truth, decision by decision
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-3xl">
              <DialogHeader>
                <DialogTitle>Ground truth, decision by decision</DialogTitle>
                <DialogDescription>
                  Every decision in this run, scored against the scenario's hidden ground truth.
                </DialogDescription>
              </DialogHeader>
              <Card className="gap-0 rounded-lg py-0 shadow-none">
                <CardContent className="p-0">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="font-mono text-[11px] tracking-wider uppercase">
                          Decision
                        </TableHead>
                        <TableHead className="font-mono text-[11px] tracking-wider uppercase">
                          Confidence shown
                        </TableHead>
                        <TableHead className="font-mono text-[11px] tracking-wider uppercase">
                          Your action
                        </TableHead>
                        <TableHead className="font-mono text-[11px] tracking-wider uppercase">
                          Result
                        </TableHead>
                        <TableHead className="font-mono text-[11px] tracking-wider uppercase">
                          Ground truth
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {records.map((r) => (
                        <TableRow key={r.decisionId} className="text-[13px]">
                          <TableCell className="whitespace-normal">
                            {r.decisionId} — {r.title}
                          </TableCell>
                          <TableCell className="font-mono tabular-nums">
                            {r.confidenceShown}%
                          </TableCell>
                          <TableCell className="whitespace-normal">
                            {r.action ?? '—'}
                            {r.reason ? ` (${r.reason})` : ''}
                          </TableCell>
                          <TableCell>
                            {r.correct === null ? (
                              '—'
                            ) : r.correct ? (
                              <span className="text-emerald-400">✔ correct</span>
                            ) : (
                              <span className="text-red-400">✘ error</span>
                            )}
                          </TableCell>
                          <TableCell className="whitespace-normal">
                            {decisions[r.decisionId].groundTruth}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </DialogContent>
          </Dialog>
        </div>
      )}
    </PanelShell>
  );
}

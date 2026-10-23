import { AlertTriangle, Check, ShieldAlert, X } from 'lucide-react';
import { useRef, useState } from 'react';

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { PanelShell, SectionLabel } from './Panel';
import { computeConfidence } from '../lib/recommender';
import { fmtClock } from '../lib/engine';
import { DEFAULT_FEED_WEIGHTS } from '../lib/prioritization';
import { cn } from '@/lib/utils';
import type { DecisionDef, FeedWeights, Mode } from '../types';

/* The decision surface. In glass-box mode the operator gets the full
   instrument panel: reasoning, confidence with its driver breakdown,
   the provenance strip for every key input, contradiction flags, and an
   alternate COA. In black-box mode — the industry default — only the
   recommendation and a bare confidence number. Same trap either way. */

function ageLabel(ageMin: number): string {
  if (ageMin <= 2) return 'fresh';
  if (ageMin <= 5) return 'aging';
  if (ageMin <= 9) return 'stale';
  return 'STALE';
}

export default function DecisionPanel({
  decision,
  mode,
  clock,
  feedWeights = DEFAULT_FEED_WEIGHTS,
  issuedConfidence = null,
  onResolve,
}: {
  decision: DecisionDef | null;
  mode: Mode;
  clock: number;
  /** Prioritization Assistant feed weights (v2) — confidence responds live. */
  feedWeights?: FeedWeights;
  /** Confidence as issued (recorded in the forensic log), when a decision
      is pending. If the operator re-weights mid-decision, the live score
      moves and the difference is shown, never silently rewritten. */
  issuedConfidence?: number | null;
  onResolve: (action: 'accept' | 'override', reason: string | null, latencySec: number) => void;
}) {
  const [showReasons, setShowReasons] = useState(false);
  const [reason, setReason] = useState<string>(decision?.overrideReasons[0] ?? 'Other');
  // The panel mounts when a recommendation is issued (App keys it by
  // decision id), so mount time is issue time — latency is real seconds
  // the operator spent with the recommendation open.
  const mountedAt = useRef<number>(Date.now());
  const resolve = (action: 'accept' | 'override', r: string | null) =>
    onResolve(action, r, Math.max(0, Math.round((Date.now() - mountedAt.current) / 1000)));

  if (!decision) {
    return (
      <PanelShell
        title="DECISION SURFACE"
        sub="recommend-and-confirm · human in command"
        className="border-dashed"
      >
        <p className="text-sm text-muted-foreground">
          No pending recommendation. The scenario clock is running (or paused) — when the system
          issues a recommendation, it will appear here with its reasoning, confidence, and
          provenance{mode === 'black' ? ' — hidden in Black-Box mode' : ''}. Nothing executes
          without your decision.
        </p>
      </PanelShell>
    );
  }

  const conf = computeConfidence(decision, feedWeights);
  const glass = mode === 'glass';
  const rescored = issuedConfidence !== null && issuedConfidence !== conf.value;
  const hasContradictions = !!decision.contradictions && decision.contradictions.length > 0;

  return (
    <PanelShell
      title={
        <>
          RECOMMENDATION — {decision.id} · {decision.title}
        </>
      }
      sub={`issued ${fmtClock(clock)} · clock held`}
      className="border-primary/50"
      contentClassName="p-4"
    >
      <p className="text-[17px] leading-snug font-semibold">{decision.recommendation}</p>

      <div className="mt-4 flex items-center gap-3">
        <Progress
          value={conf.value}
          aria-label={`Confidence ${conf.value} percent`}
          className="h-2.5 flex-1"
        />
        <span className="font-mono text-[22px] leading-none font-bold tabular-nums">
          {`${conf.value}%`}
        </span>
        <span className="text-xs text-muted-foreground">
          system confidence{decision.linkDegraded ? ' — degraded (stale inputs)' : ''}
        </span>
      </div>

      {rescored && (
        <Alert className="mt-3 border-amber-400/50 bg-amber-400/5 text-amber-200">
          <AlertTriangle />
          <AlertTitle className="text-amber-400">Re-scored under current weights</AlertTitle>
          <AlertDescription className="text-amber-200/80">
            Issued at {issuedConfidence}% under the weights then in force. The Prioritization
            Assistant's current weights re-score this recommendation at {conf.value}% — the issued
            value in the forensic log stands.
          </AlertDescription>
        </Alert>
      )}

      {glass && (
        <Tabs defaultValue="reasoning" className="mt-4">
          <TabsList>
            <TabsTrigger value="reasoning">Reasoning</TabsTrigger>
            <TabsTrigger value="drivers">{`Why ${conf.value}%`}</TabsTrigger>
            <TabsTrigger value="provenance">
              Provenance
              {decision.inputs.some((i) => i.integrity !== 'ok') && (
                <Badge
                  variant="destructive"
                  className="ml-1 font-mono text-[9px] font-bold tracking-wider"
                >
                  FLAGS
                </Badge>
              )}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="reasoning" forceMount className="pt-2 data-[state=inactive]:hidden">
            <ul className="list-disc space-y-1.5 pl-5 text-sm">
              {decision.reasoning.map((r, i) => (
                <li key={i}>{r}</li>
              ))}
            </ul>
            {decision.alternateCoa && (
              <div className="mt-4">
                <SectionLabel className="mb-1.5">Alternate course of action</SectionLabel>
                <p className="text-sm text-muted-foreground">{decision.alternateCoa}</p>
              </div>
            )}
          </TabsContent>

          <TabsContent value="drivers" forceMount className="pt-2 data-[state=inactive]:hidden">
            <p className="mb-2 text-sm font-medium">
              Confidence drivers — the arithmetic, shown
            </p>
            <ul className="space-y-1.5">
              {conf.drivers.map((d, i) => (
                <li key={i} className="flex items-baseline gap-3 text-sm">
                  <span
                    className={cn(
                      'inline-block min-w-10 font-mono font-bold tabular-nums',
                      d.delta >= 0 ? 'text-emerald-400' : 'text-red-400',
                    )}
                  >
                    {d.delta >= 0 ? `+${d.delta}` : d.delta}
                  </span>
                  <span>{d.label}</span>
                </li>
              ))}
            </ul>
          </TabsContent>

          <TabsContent value="provenance" forceMount className="pt-2 data-[state=inactive]:hidden">
            <SectionLabel className="mb-2">
              Provenance — every key input, accounted for
            </SectionLabel>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="font-mono text-[11px] tracking-wider uppercase">
                    Source
                  </TableHead>
                  <TableHead className="font-mono text-[11px] tracking-wider uppercase">
                    Claim
                  </TableHead>
                  <TableHead className="font-mono text-[11px] tracking-wider uppercase">
                    Age
                  </TableHead>
                  <TableHead className="font-mono text-[11px] tracking-wider uppercase">
                    Reliability
                  </TableHead>
                  <TableHead className="font-mono text-[11px] tracking-wider uppercase">
                    Bearing
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {decision.inputs.map((i) => (
                  <TableRow
                    key={i.id}
                    className={cn(
                      'text-[13px]',
                      i.integrity === 'anomaly' && 'bg-red-500/10 hover:bg-red-500/10',
                      i.integrity === 'stale' && 'bg-amber-400/10 hover:bg-amber-400/10',
                    )}
                  >
                    <TableCell className="whitespace-normal">{i.source}</TableCell>
                    <TableCell className="whitespace-normal">{i.claim}</TableCell>
                    <TableCell className="whitespace-normal">
                      {i.ageMin} min · {ageLabel(i.ageMin)}
                      {i.claimedAgeMin !== undefined && i.claimedAgeMin !== i.ageMin && (
                        <span className="text-amber-400"> (header claims {i.claimedAgeMin} min)</span>
                      )}
                      {i.integrity === 'anomaly' && (
                        <span className="font-bold text-red-400"> · INTEGRITY ANOMALY</span>
                      )}
                      {i.integrity === 'stale' && (
                        <span className="font-bold text-amber-400"> · STALE</span>
                      )}
                    </TableCell>
                    <TableCell className="font-mono tabular-nums">
                      {i.reliability.toFixed(2)}
                    </TableCell>
                    <TableCell>
                      {i.supports ? (
                        <span className="text-emerald-400">supports</span>
                      ) : (
                        <span className="font-semibold text-red-400">OPPOSES</span>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <p className="mt-2.5 font-mono text-[11.5px] text-muted-foreground">
              Provenance strip · recommender: transparent rules v1.0 · scenario engine:
              deterministic synthetic data · nothing on this display is unaccountable.
            </p>
          </TabsContent>
        </Tabs>
      )}

      {glass && hasContradictions && (
        <Alert className="mt-4 border-amber-400/60 bg-amber-400/5">
          <ShieldAlert className="text-amber-400" />
          <AlertTitle className="text-amber-400">Contradiction — inputs conflict</AlertTitle>
          <AlertDescription>
            <ul className="list-disc space-y-1 pl-4 text-foreground/90">
              {decision.contradictions!.map((c, i) => (
                <li key={i}>{c}</li>
              ))}
            </ul>
          </AlertDescription>
        </Alert>
      )}

      {!glass && (
        <p className="mt-4 rounded-lg border border-dashed p-3 text-sm text-muted-foreground">
          Black-Box mode: reasoning, confidence drivers, provenance, contradiction flags, and the
          alternate COA are hidden — you get the answer and a number, like most fielded decision
          aids. The forensic log still records everything.
        </p>
      )}

      <div className="mt-5 flex flex-wrap items-start gap-3">
        <Button size="lg" onClick={() => resolve('accept', null)}>
          <Check /> Accept recommendation
        </Button>
        <div className="flex flex-wrap items-center gap-2.5">
          <Button
            size="lg"
            variant="outline"
            className="border-amber-400/60 text-amber-400 hover:bg-amber-400/10 hover:text-amber-300"
            onClick={() => (showReasons ? resolve('override', reason) : setShowReasons(true))}
          >
            <X /> {showReasons ? 'Confirm override' : 'Override'}
          </Button>
          {showReasons && (
            <label className="flex items-center gap-2 text-[13px] text-muted-foreground">
              Reason
              <Select value={reason} onValueChange={setReason}>
                <SelectTrigger className="w-56">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {decision.overrideReasons.map((r) => (
                    <SelectItem key={r} value={r}>
                      {r}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </label>
          )}
        </div>
      </div>
      <p className="mt-3.5 text-xs text-muted-foreground">
        Automation level: recommend-and-confirm. The system never expands its own authority; every
        action above is logged with its rationale.
      </p>
    </PanelShell>
  );
}

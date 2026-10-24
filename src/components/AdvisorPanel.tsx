import { Bot, GitCompareArrows, ShieldAlert } from 'lucide-react';

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { PanelShell, SectionLabel } from './Panel';
import { fmtClock } from '../lib/engine';
import { cn } from '@/lib/utils';
import type { AdvisorExchange, AdvisorMode, DecisionDef } from '../types';

/* The Model Advisor panel — a second, additive voice beside the
   deterministic core. It renders in the same shape as the decision
   surface (verdict, reasoning, confidence read, provenance citations)
   but it is NOT the recommendation of record: the core above is.
   Where the two disagree, the contradiction flag shows both
   positions side by side and the operator decides.
   Cached output is disclosed as cached, on screen, every time. */

const VERDICT_LABEL = {
  concur: 'CONCUR',
  'lean-alternate': 'LEAN — ALTERNATE COA',
  disagree: 'DISAGREE',
} as const;

export default function AdvisorPanel({
  decision,
  exchange,
  advisorMode,
  coreConfidence,
  clock,
}: {
  decision: DecisionDef | null;
  exchange: AdvisorExchange | null;
  advisorMode: AdvisorMode;
  coreConfidence: number | null;
  clock: number;
}) {
  if (advisorMode === 'deterministic') {
    return (
      <PanelShell title="MODEL ADVISOR" sub="deterministic mode · advisor silent" className="border-dashed">
        <p className="flex items-start gap-2 text-sm text-muted-foreground">
          <Bot className="mt-0.5 size-4 shrink-0" />
          Deterministic mode: the Model Advisor is muted and the deterministic core runs alone —
          the v4 baseline. Switch the Advisor to Cached or Live Model in the console rail to hear
          the second voice at each decision point.
        </p>
      </PanelShell>
    );
  }

  if (!decision || !exchange) {
    return (
      <PanelShell title="MODEL ADVISOR" sub="second voice · advisory only" className="border-dashed">
        <p className="flex items-start gap-2 text-sm text-muted-foreground">
          <Bot className="mt-0.5 size-4 shrink-0" />
          The Model Advisor speaks at each decision point, in parallel with the core — a second
          read on the same inputs, never a replacement for the recommendation of record.
        </p>
      </PanelShell>
    );
  }

  const { output } = exchange;
  const citationInputs = output.citations
    .map((id) => decision.inputs.find((i) => i.id === id))
    .filter((i) => i !== undefined);
  const disagrees = !output.agreesWithCore;

  return (
    <PanelShell
      title={
        <>
          MODEL ADVISOR — {decision.id}
        </>
      }
      sub={`${exchange.model} · ${exchange.source === 'cached' ? 'CACHED output' : 'LIVE response'} · issued ${fmtClock(clock)}`}
      className={cn(disagrees && 'border-red-400/50')}
      contentClassName="p-4"
    >
      <div className="flex flex-wrap items-center gap-2">
        <Badge
          variant={disagrees ? 'destructive' : 'secondary'}
          className="font-mono text-[10px] font-bold tracking-wider"
        >
          {VERDICT_LABEL[output.verdict]}
        </Badge>
        {exchange.source === 'cached' && (
          <Badge variant="outline" className="font-mono text-[10px] font-bold tracking-wider">
            CACHED — AUTHORED FALLBACK, NOT A LIVE MODEL RESPONSE
          </Badge>
        )}
        {advisorMode === 'live' && exchange.source === 'cached' && (
          <Badge
            variant="outline"
            className="border-amber-400/60 font-mono text-[10px] font-bold tracking-wider text-amber-400"
          >
            LIVE REQUESTED — SERVING CACHED
          </Badge>
        )}
      </div>

      <p className="mt-3 text-[15px] leading-snug font-semibold">{output.headline}</p>

      <ul className="mt-3 list-disc space-y-1.5 pl-5 text-sm">
        {output.reasoning.map((r, i) => (
          <li key={i}>{r}</li>
        ))}
      </ul>

      <div className="mt-4">
        <SectionLabel className="mb-1.5">Advisor confidence read</SectionLabel>
        <p className="text-sm text-muted-foreground">{output.confidenceRead}</p>
      </div>

      <div className="mt-4">
        <SectionLabel className="mb-1.5">Provenance citations</SectionLabel>
        <ul className="space-y-1 text-[13px]">
          {citationInputs.map((i) => (
            <li key={i.id} className="flex flex-wrap items-baseline gap-x-2">
              <span className="font-mono text-xs text-muted-foreground">{i.id}</span>
              <span>{i.source}</span>
              {i.integrity === 'anomaly' && (
                <span className="font-bold text-red-400">INTEGRITY ANOMALY</span>
              )}
              {i.integrity === 'stale' && <span className="font-bold text-amber-400">STALE</span>}
            </li>
          ))}
        </ul>
        <p className="mt-2.5 font-mono text-[11.5px] text-muted-foreground">
          Advisor provenance · model: {exchange.model} · source: {exchange.source} · this output
          advises; the deterministic core above remains the recommendation of record.
        </p>
      </div>

      {disagrees && (
        <Alert className="mt-4 border-red-400/60 bg-red-400/5">
          <ShieldAlert className="text-red-400" />
          <AlertTitle className="flex items-center gap-2 text-red-400">
            <GitCompareArrows className="size-4" /> Contradiction flag — Advisor ≠ core
          </AlertTitle>
          <AlertDescription>
            <div className="mt-1 grid gap-3 sm:grid-cols-2">
              <div>
                <div className="font-mono text-[10px] font-bold tracking-wider text-muted-foreground uppercase">
                  Core (recommendation of record{coreConfidence !== null ? `, ${coreConfidence}%` : ''})
                </div>
                <p className="mt-1 text-foreground/90">{decision.recommendation}</p>
              </div>
              <div>
                <div className="font-mono text-[10px] font-bold tracking-wider text-muted-foreground uppercase">
                  Model Advisor ({VERDICT_LABEL[output.verdict]})
                </div>
                <p className="mt-1 text-foreground/90">{output.headline}</p>
              </div>
            </div>
            <p className="mt-2 text-foreground/80">
              Disagreement is a signal, not a failure: both driver sets are on the table and the
              operator decides. The debrief records the Advisor's agreement rate alongside — never
              instead of — the core's appropriate-reliance rate.
            </p>
          </AlertDescription>
        </Alert>
      )}
    </PanelShell>
  );
}

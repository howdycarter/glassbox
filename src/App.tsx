import { Eye, EyeOff, Pause, Play, RotateCcw, StepForward } from 'lucide-react';
import { useEffect, useReducer } from 'react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import DebriefPanel from './components/DebriefPanel';
import DecisionPanel from './components/DecisionPanel';
import LogPanel from './components/LogPanel';
import PrioritizationPanel from './components/PrioritizationPanel';
import SituationMap from './components/SituationMap';
import WhatIfPanel from './components/WhatIfPanel';
import { SCENARIOS } from './data/scenarios';
import { bootLog, fmtClock, initialState, reducer } from './lib/engine';
import { cn } from '@/lib/utils';
import './App.css';

/* Glass-Box C2 — LAB-001 prototype.
   Play the scenario clock; when a recommendation is issued the clock holds
   and the operator decides. The mode toggle switches the decision surface
   between the glass-box workbench and a black-box baseline — identical
   scenario, recommender, and ground truth underneath. The vignette picker
   (v3) loads a different scripted scenario into the same engine; switching
   starts a fresh run of the chosen vignette.

   Layout (v4): a console app shell adapted from the Shadcnblocks sidebar1
   composition — brand header, grouped rail navigation (vignette, display
   mode), session footer — with the instrument stack in the inset. */

const TICK_MS = 900; // 1 scenario-minute per tick

function RailGroupLabel({ children }: { children: string }) {
  return (
    <div className="px-2 pt-5 pb-1.5 font-mono text-[10px] font-semibold tracking-[0.18em] text-muted-foreground/70 uppercase first:pt-0">
      {children}
    </div>
  );
}

export default function App() {
  const [state, dispatch] = useReducer(reducer, undefined, () => bootLog(initialState('glass')));

  useEffect(() => {
    if (!state.playing) return;
    const id = window.setInterval(() => dispatch({ type: 'TICK' }), TICK_MS);
    return () => window.clearInterval(id);
  }, [state.playing]);

  const decided = state.records.filter((r) => r.action !== null).length;
  const scenario = state.scenario;
  const decisionCount = Object.keys(scenario.decisions).length;
  const issuedConfidence = state.pending
    ? (state.records.find((r) => r.decisionId === state.pending!.id)?.confidenceShown ?? null)
    : null;

  return (
    <div className="flex min-h-screen w-full bg-background text-foreground">
      {/* ------- console rail (sidebar1 composition, adapted) ------- */}
      <aside className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col border-r bg-sidebar text-sidebar-foreground md:flex">
        <div className="flex items-center gap-3 px-4 pt-5 pb-4">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-md bg-primary text-sm font-extrabold tracking-tight text-primary-foreground">
            N&amp;C
          </div>
          <div className="min-w-0">
            <div className="truncate text-sm leading-tight font-bold tracking-wide">
              GLASS-BOX C2
            </div>
            <div className="truncate text-xs text-muted-foreground">Newton &amp; Carter Labs</div>
          </div>
        </div>
        <Separator />
        <nav className="flex-1 overflow-y-auto px-3 py-4" aria-label="Console">
          <RailGroupLabel>Vignette</RailGroupLabel>
          <div className="flex flex-col gap-1" role="group" aria-label="Vignette">
            {SCENARIOS.map((s) => (
              <button
                key={s.id}
                onClick={() => dispatch({ type: 'SET_SCENARIO', scenarioId: s.id })}
                title="Load this vignette (starts a fresh run)"
                className={cn(
                  'rounded-md px-2.5 py-2 text-left transition-colors',
                  'hover:bg-sidebar-accent hover:text-sidebar-accent-foreground',
                  'focus-visible:ring-2 focus-visible:ring-sidebar-ring focus-visible:outline-none',
                  scenario.id === s.id
                    ? 'bg-sidebar-accent font-semibold text-sidebar-accent-foreground'
                    : 'text-muted-foreground',
                )}
              >
                <span className="block text-[13px] leading-tight tracking-wide">{s.title}</span>
                <span className="mt-0.5 block text-[11px] leading-snug font-normal opacity-70">
                  {s.subtitle}
                </span>
              </button>
            ))}
          </div>

          <RailGroupLabel>Display mode</RailGroupLabel>
          <ToggleGroup
            type="single"
            value={state.mode}
            onValueChange={(v) => {
              if (v === 'glass' || v === 'black') dispatch({ type: 'SET_MODE', mode: v });
            }}
            variant="outline"
            aria-label="Display mode"
            className="grid w-full grid-cols-2"
          >
            <ToggleGroupItem value="glass" className="gap-1.5 text-xs">
              <Eye className="size-3.5" /> Glass-Box
            </ToggleGroupItem>
            <ToggleGroupItem value="black" className="gap-1.5 text-xs">
              <EyeOff className="size-3.5" /> Black-Box
            </ToggleGroupItem>
          </ToggleGroup>
          <p className="px-2 pt-2 text-[11px] leading-snug text-muted-foreground">
            {state.mode === 'glass'
              ? 'Instruments on: reasoning, provenance, and contradiction flags are shown.'
              : 'Instruments off: the answer and a number — the industry default.'}
          </p>

          <RailGroupLabel>Session</RailGroupLabel>
          <dl className="space-y-1.5 px-2 font-mono text-[11px]">
            <div className="flex justify-between">
              <dt className="text-muted-foreground">CLOCK</dt>
              <dd className="font-semibold">
                {fmtClock(state.clock)} / T+{scenario.endTime}
              </dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted-foreground">DECISIONS</dt>
              <dd className="font-semibold">
                {decided} / {decisionCount}
              </dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted-foreground">MODE</dt>
              <dd className="font-semibold">{state.mode === 'glass' ? 'GLASS-BOX' : 'BLACK-BOX'}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted-foreground">LINK</dt>
              <dd className={cn('font-semibold', state.linkDegraded && 'text-amber-400')}>
                {state.linkDegraded ? 'DEGRADED' : 'NOMINAL'}
              </dd>
            </div>
          </dl>
        </nav>
        <Separator />
        <div className="px-4 py-3 text-[11px] leading-snug text-muted-foreground">
          LAB-001 · Glass-Box Decision Support
          <br />
          Prototype — synthetic data only
        </div>
      </aside>

      {/* ------- inset ------- */}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-40 border-b bg-background/85 backdrop-blur">
          <div className="mx-auto flex w-full max-w-[1440px] flex-wrap items-center gap-x-4 gap-y-3 px-4 py-3 lg:px-6">
            {/* compact brand + pickers (below the rail breakpoint) */}
            <div className="flex items-center gap-3 md:hidden">
              <div className="flex size-9 items-center justify-center rounded-md bg-primary text-xs font-extrabold text-primary-foreground">
                N&amp;C
              </div>
              <div className="text-sm font-bold tracking-wide">GLASS-BOX C2</div>
            </div>
            <div className="flex flex-wrap items-center gap-2 md:hidden">
              <div className="flex overflow-hidden rounded-md border" role="group" aria-label="Vignette">
                {SCENARIOS.map((s) => (
                  <button
                    key={s.id}
                    onClick={() => dispatch({ type: 'SET_SCENARIO', scenarioId: s.id })}
                    className={cn(
                      'px-2.5 py-1.5 text-xs font-semibold',
                      scenario.id === s.id
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-secondary text-muted-foreground',
                    )}
                  >
                    {s.title}
                  </button>
                ))}
              </div>
              <div className="flex overflow-hidden rounded-md border" role="group" aria-label="Display mode">
                {(['glass', 'black'] as const).map((m) => (
                  <button
                    key={m}
                    onClick={() => dispatch({ type: 'SET_MODE', mode: m })}
                    className={cn(
                      'px-2.5 py-1.5 text-xs font-semibold',
                      state.mode === m
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-secondary text-muted-foreground',
                    )}
                  >
                    {m === 'glass' ? 'Glass-Box' : 'Black-Box'}
                  </button>
                ))}
              </div>
            </div>

            <div className="hidden min-w-0 md:block">
              <h1 className="truncate text-base font-bold tracking-wide">
                GLASS-BOX C2 <span className="text-primary">— {scenario.title}</span>
              </h1>
              <p className="truncate text-xs text-muted-foreground">{scenario.subtitle}</p>
            </div>

            <div className="ml-auto flex flex-wrap items-center gap-x-4 gap-y-2">
              <div className="flex items-baseline gap-2 font-mono">
                <span className="text-[10px] tracking-[0.18em] text-muted-foreground uppercase">
                  Scenario clock
                </span>
                <span className="text-xl font-bold tabular-nums">
                  {fmtClock(state.clock)}{' '}
                  <span className="text-xs font-medium text-muted-foreground">
                    / T+{scenario.endTime}
                  </span>
                </span>
                {state.linkDegraded && (
                  <Badge
                    variant="outline"
                    className="border-amber-400/60 font-mono text-[10px] font-bold tracking-wider text-amber-400"
                  >
                    LINK DEGRADED — confidence discounted
                  </Badge>
                )}
                {state.ended && (
                  <Badge className="font-mono text-[10px] font-bold tracking-wider">ENDEX</Badge>
                )}
              </div>
              <div className="flex items-center gap-2">
                {!state.playing ? (
                  <Button
                    onClick={() => dispatch({ type: 'PLAY' })}
                    disabled={!!state.pending || state.ended}
                  >
                    <Play /> Play
                  </Button>
                ) : (
                  <Button variant="secondary" onClick={() => dispatch({ type: 'PAUSE' })}>
                    <Pause /> Pause
                  </Button>
                )}
                <Button
                  variant="outline"
                  onClick={() => dispatch({ type: 'TICK' })}
                  disabled={!!state.pending || state.ended}
                >
                  <StepForward /> Step +1 min
                </Button>
                <Button variant="outline" onClick={() => dispatch({ type: 'RESET' })}>
                  <RotateCcw /> Reset
                </Button>
              </div>
            </div>
          </div>
          <div
            className={cn(
              'border-t px-4 py-1.5 text-xs lg:px-6',
              state.pending
                ? 'bg-primary/10 font-medium text-foreground'
                : 'text-muted-foreground',
            )}
          >
            <div className="mx-auto w-full max-w-[1440px]">
              {state.pending
                ? `Decision pending — ${state.pending.id}. The clock is held until you act.`
                : state.ended
                  ? 'Vignette complete. Review the debrief, then reset to run it again — try the other mode.'
                  : `${decided} decision${decided === 1 ? '' : 's'} made · ${decisionCount} decision points in this vignette`}
            </div>
          </div>
        </header>

        <main className="mx-auto flex w-full max-w-[1440px] flex-col gap-4 px-4 py-4 lg:px-6 lg:py-5">
          <div className="grid items-start gap-4 xl:grid-cols-[minmax(360px,5fr)_minmax(420px,6fr)]">
            <SituationMap
              tracks={state.tracks}
              linkDegraded={state.linkDegraded}
              labels={scenario.mapLabels}
            />
            <DecisionPanel
              key={state.pending ? state.pending.id : 'idle'}
              decision={state.pending}
              mode={state.mode}
              clock={state.clock}
              feedWeights={state.weights.feeds}
              issuedConfidence={issuedConfidence}
              onResolve={(action, reason, latencySec) =>
                dispatch({ type: 'RESOLVE', action, reason, latencySec })
              }
            />
          </div>

          <PrioritizationPanel
            weights={state.weights}
            tracks={state.tracks}
            mode={state.mode}
            pending={state.pending}
            issuedConfidence={issuedConfidence}
            onLive={(weights) => dispatch({ type: 'SET_WEIGHTS_LIVE', weights })}
            onCommit={() => dispatch({ type: 'COMMIT_WEIGHTS' })}
          />
          <WhatIfPanel
            pending={state.pending}
            records={state.records}
            tracks={state.tracks}
            mode={state.mode}
            clock={state.clock}
          />

          <DebriefPanel
            records={state.records}
            mode={state.mode}
            ended={state.ended}
            decisions={scenario.decisions}
            inject={scenario.inject}
          />
          <LogPanel log={state.log} />

          <footer className="px-4 pt-1 pb-2 text-center text-xs text-muted-foreground">
            Newton &amp; Carter Labs · LAB-001 Glass-Box Decision Support · Prototype — all data
            synthetic, generated locally; no network calls, no real or classified information. The
            recommender is transparent rules over scenario state; its arithmetic is shown, not
            hidden.
          </footer>
        </main>
      </div>
    </div>
  );
}

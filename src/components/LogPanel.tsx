import { useEffect, useRef } from 'react';

import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { PanelShell } from './Panel';
import { fmtClock } from '../lib/engine';
import { cn } from '@/lib/utils';
import type { LogEntry, ModelLogEntry } from '../types';

/* Forensic logs, two tabs.
   Action log: every event, inject, recommendation (with its input
   snapshot), Advisor exchange, and operator action — timestamped
   against the scenario clock. If a feed was compromised, this log
   shows exactly which decisions it touched.
   Model log (hackathon build): the glass box turned on the model
   itself — full prompt and raw response for every Advisor exchange,
   labeled by source (live vs cached), so Meta AI tooling usage is
   evidenced, not asserted. */

const KIND_LABEL: Record<LogEntry['kind'], string> = {
  event: 'EVENT',
  inject: 'INJECT',
  comms: 'COMMS',
  recommendation: 'RECOMMENDATION',
  operator: 'OPERATOR',
  system: 'SYSTEM',
  advisor: 'ADVISOR',
};

export default function LogPanel({
  log,
  modelLog = [],
}: {
  log: LogEntry[];
  modelLog?: ModelLogEntry[];
}) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const modelWrapRef = useRef<HTMLDivElement>(null);

  // Keep the newest entry in view: scroll the Radix viewport, as the old
  // overflow container did.
  useEffect(() => {
    const vp = wrapRef.current?.querySelector<HTMLElement>('[data-slot="scroll-area-viewport"]');
    if (vp) vp.scrollTop = vp.scrollHeight;
  }, [log.length]);

  useEffect(() => {
    const vp = modelWrapRef.current?.querySelector<HTMLElement>(
      '[data-slot="scroll-area-viewport"]',
    );
    if (vp) vp.scrollTop = vp.scrollHeight;
  }, [modelLog.length]);

  return (
    <PanelShell
      title="FORENSIC LOGS"
      sub={`${log.length} action entries · ${modelLog.length} model exchanges · append-only`}
      contentClassName="p-0"
    >
      <Tabs defaultValue="actions">
        <div className="border-b px-3 pt-2.5">
          <TabsList>
            <TabsTrigger value="actions">Action log</TabsTrigger>
            <TabsTrigger value="model">
              Model log
              {modelLog.length > 0 && (
                <Badge variant="secondary" className="ml-1 font-mono text-[9px] font-bold">
                  {modelLog.length}
                </Badge>
              )}
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="actions" forceMount className="mt-0 data-[state=inactive]:hidden">
          <div ref={wrapRef}>
            <ScrollArea className="h-[300px]">
              <div className="space-y-0.5 p-3">
                {log.map((e) => (
                  <div
                    key={e.seq}
                    className={cn(
                      'flex items-baseline gap-2.5 rounded px-1.5 py-1 text-xs',
                      e.kind === 'recommendation' && 'bg-secondary',
                    )}
                  >
                    <span className="min-w-10 shrink-0 font-mono text-muted-foreground tabular-nums">
                      {fmtClock(e.t)}
                    </span>
                    <span className={cn('log-kind w-28 shrink-0', e.kind)}>{KIND_LABEL[e.kind]}</span>
                    <span className="leading-snug">{e.text}</span>
                  </div>
                ))}
                {log.length === 0 && (
                  <p className="text-sm text-muted-foreground">
                    Log is empty — start the scenario clock.
                  </p>
                )}
              </div>
            </ScrollArea>
          </div>
        </TabsContent>

        <TabsContent value="model" forceMount className="mt-0 data-[state=inactive]:hidden">
          <div ref={modelWrapRef}>
            <ScrollArea className="h-[300px]">
              <div className="space-y-4 p-3">
                {modelLog.map((m) => (
                  <div key={m.seq} className="rounded-lg border p-3">
                    <div className="flex flex-wrap items-center gap-2 text-xs">
                      <span className="font-mono text-muted-foreground tabular-nums">
                        {fmtClock(m.t)}
                      </span>
                      <span className="font-mono font-bold">{m.key}</span>
                      <Badge
                        variant={m.source === 'live' ? 'secondary' : 'outline'}
                        className="font-mono text-[9px] font-bold tracking-wider"
                      >
                        {m.source.toUpperCase()}
                      </Badge>
                      <span className="text-muted-foreground">{m.model}</span>
                      <span className="text-muted-foreground">
                        {m.latencyMs !== null ? `latency ${m.latencyMs} ms` : 'latency n/a (cached)'}
                      </span>
                    </div>
                    <div className="mt-2.5">
                      <div className="font-mono text-[10px] font-bold tracking-wider text-muted-foreground uppercase">
                        Prompt (as sent / as would be sent)
                      </div>
                      <pre className="mt-1 font-mono text-[11.5px] leading-relaxed whitespace-pre-wrap text-foreground/85">
                        {m.prompt}
                      </pre>
                    </div>
                    <div className="mt-2.5">
                      <div className="font-mono text-[10px] font-bold tracking-wider text-muted-foreground uppercase">
                        Raw response
                      </div>
                      <pre className="mt-1 font-mono text-[11.5px] leading-relaxed whitespace-pre-wrap text-foreground/85">
                        {m.response}
                      </pre>
                    </div>
                  </div>
                ))}
                {modelLog.length === 0 && (
                  <p className="text-sm text-muted-foreground">
                    No Advisor exchanges yet. The Advisor speaks at each decision point (Cached or
                    Live Model mode); in Deterministic mode this log stays empty — the core runs
                    alone.
                  </p>
                )}
              </div>
            </ScrollArea>
          </div>
        </TabsContent>
      </Tabs>
    </PanelShell>
  );
}

import { useEffect, useRef } from 'react';

import { ScrollArea } from '@/components/ui/scroll-area';
import { PanelShell } from './Panel';
import { fmtClock } from '../lib/engine';
import { cn } from '@/lib/utils';
import type { LogEntry } from '../types';

/* Forensic action log: every event, inject, recommendation (with its
   input snapshot), and operator action — timestamped against the scenario
   clock. If a feed was compromised, this log shows exactly which
   decisions it touched. */

const KIND_LABEL: Record<LogEntry['kind'], string> = {
  event: 'EVENT',
  inject: 'INJECT',
  comms: 'COMMS',
  recommendation: 'RECOMMENDATION',
  operator: 'OPERATOR',
  system: 'SYSTEM',
};

export default function LogPanel({ log }: { log: LogEntry[] }) {
  const wrapRef = useRef<HTMLDivElement>(null);

  // Keep the newest entry in view: scroll the Radix viewport, as the old
  // overflow container did.
  useEffect(() => {
    const vp = wrapRef.current?.querySelector<HTMLElement>('[data-slot="scroll-area-viewport"]');
    if (vp) vp.scrollTop = vp.scrollHeight;
  }, [log.length]);

  return (
    <PanelShell
      title="FORENSIC ACTION LOG"
      sub={`${log.length} entries · append-only`}
      contentClassName="p-0"
    >
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
    </PanelShell>
  );
}

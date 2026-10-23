import type { ReactNode } from 'react';

import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { cn } from '@/lib/utils';

/* Shared console panel shell: every instrument on the console is a flat
   shadcn Card with a mono micro-label header strip — one visual grammar
   for map, decision surface, log, and debrief. */

export function PanelShell({
  title,
  sub,
  action,
  children,
  className,
  contentClassName,
}: {
  title: ReactNode;
  sub?: ReactNode;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
  contentClassName?: string;
}) {
  return (
    <Card className={cn('gap-0 rounded-lg py-0 shadow-none', className)}>
      <CardHeader className="flex flex-row items-center justify-between gap-3 space-y-0 border-b px-4 py-2.5">
        <div className="font-mono text-[11px] font-semibold tracking-[0.14em] text-muted-foreground uppercase">
          {title}
        </div>
        {sub !== undefined && <div className="text-xs text-muted-foreground">{sub}</div>}
        {action}
      </CardHeader>
      <CardContent className={cn('p-4', contentClassName)}>{children}</CardContent>
    </Card>
  );
}

/** Small-caps section label used inside panels. */
export function SectionLabel({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <h4
      className={cn(
        'text-[11px] font-semibold tracking-[0.14em] text-muted-foreground uppercase',
        className,
      )}
    >
      {children}
    </h4>
  );
}

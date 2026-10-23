import { Badge } from '@/components/ui/badge';
import { PanelShell } from './Panel';
import { cn } from '@/lib/utils';
import type { TrackState } from '../types';

/* Schematic situation view: an SVG grid map. Simplified NATO-style
   symbology — friendly = rectangle, hostile = diamond, unknown = circle —
   with affiliation colors and a staleness treatment (dashed, desaturated,
   STALE tag) so old data looks old. */

const W = 100;
const H = 70;

function colors(affiliation: TrackState['affiliation']): { fill: string; stroke: string } {
  switch (affiliation) {
    case 'friendly':
      return { fill: '#1d4ed8', stroke: '#93c5fd' };
    case 'hostile':
      return { fill: '#b91c1c', stroke: '#fca5a5' };
    default:
      return { fill: '#a16207', stroke: '#fde68a' };
  }
}

function Symbol({ track }: { track: TrackState }) {
  const { fill, stroke } = colors(track.affiliation);
  const opacity = track.stale ? 0.45 : 1;
  const dash = track.stale ? '2.5 1.8' : undefined;
  const common = {
    fill,
    stroke,
    strokeWidth: 0.7,
    strokeDasharray: dash,
    opacity,
  };
  if (track.affiliation === 'hostile') {
    return <rect x={-3.4} y={-3.4} width={6.8} height={6.8} transform="rotate(45)" {...common} />;
  }
  if (track.affiliation === 'unknown') {
    return <circle r={3.5} {...common} />;
  }
  return <rect x={-4.2} y={-2.8} width={8.4} height={5.6} {...common} />;
}

const AFF_BADGE: Record<TrackState['affiliation'], string> = {
  friendly: 'border-blue-400/40 text-blue-400',
  hostile: 'border-red-400/40 text-red-400',
  unknown: 'border-yellow-400/40 text-yellow-400',
};

export default function SituationMap({
  tracks,
  linkDegraded,
  labels = { boundary: 'SECTOR BOUNDARY', approach: 'NE APPROACH' },
}: {
  tracks: Record<string, TrackState>;
  linkDegraded: boolean;
  /** Map annotation flavor, supplied by the loaded vignette (v3). */
  labels?: { boundary: string; approach: string };
}) {
  const visible = Object.values(tracks).filter((t) => t.visible);
  const gridLines: number[] = [];
  for (let x = 0; x <= W; x += 10) gridLines.push(x);
  const gridRows: number[] = [];
  for (let y = 0; y <= H; y += 10) gridRows.push(y);

  return (
    <PanelShell
      title="SITUATION — SECTOR PICTURE (SCHEMATIC)"
      action={
        linkDegraded ? (
          <Badge
            variant="outline"
            className="border-amber-400/60 font-mono text-[10px] font-bold tracking-wider text-amber-400"
          >
            LINK DEGRADED
          </Badge>
        ) : undefined
      }
      contentClassName="p-3"
    >
      <div className="overflow-hidden rounded-md border bg-[#12151b]">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="map-svg"
          role="img"
          aria-label="Schematic situation map"
        >
          <rect x={0} y={0} width={W} height={H} className="map-bg" />
          {gridLines.map((x) => (
            <line key={`v${x}`} x1={x} y1={0} x2={x} y2={H} className="map-grid" />
          ))}
          {gridRows.map((y) => (
            <line key={`h${y}`} x1={0} y1={y} x2={W} y2={y} className="map-grid" />
          ))}
          {/* sector boundary */}
          <rect x={3} y={3} width={W - 6} height={H - 6} className="map-boundary" />
          <text x={W - 4} y={H - 4.5} className="map-annot" textAnchor="end">
            {labels.boundary}
          </text>
          <text x={W - 4} y={8} className="map-annot" textAnchor="end">
            {labels.approach}
          </text>
          {visible.map((t) => (
            <g key={t.id} transform={`translate(${t.x} ${t.y})`}>
              <Symbol track={t} />
              <text y={-5.4} className="map-label" textAnchor="middle">
                {t.short}
              </text>
              {t.stale && (
                <text y={8} className="map-stale" textAnchor="middle">
                  STALE
                </text>
              )}
            </g>
          ))}
        </svg>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
        <span>
          <i className="mr-1.5 inline-block size-2.5 rounded-[2px] bg-blue-500 align-[-1px]" />{' '}
          Friendly
        </span>
        <span>
          <i className="mr-1.5 inline-block size-2.5 rounded-[2px] bg-red-500 align-[-1px]" />{' '}
          Hostile
        </span>
        <span>
          <i className="mr-1.5 inline-block size-2.5 rounded-[2px] bg-yellow-500 align-[-1px]" />{' '}
          Unknown
        </span>
        <span className="ml-auto italic">
          Dashed / dimmed = stale data (age beyond update cycle)
        </span>
      </div>
      <ul className="mt-3 space-y-1 border-t pt-3">
        {visible.map((t) => (
          <li key={t.id} className="flex flex-wrap items-baseline gap-x-2.5 text-[13px]">
            <strong className="font-semibold">{t.label}</strong>
            <Badge
              variant="outline"
              className={cn(
                'font-mono text-[10px] font-bold tracking-wider',
                AFF_BADGE[t.affiliation],
              )}
            >
              {t.affiliation.toUpperCase()}
            </Badge>
            <span className="text-muted-foreground">
              {t.status}
              {t.stale ? ' · STALE' : ''}
            </span>
          </li>
        ))}
      </ul>
    </PanelShell>
  );
}

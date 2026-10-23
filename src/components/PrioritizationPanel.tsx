import { RotateCcw } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Slider } from '@/components/ui/slider';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { PanelShell, SectionLabel } from './Panel';
import { computeConfidence } from '../lib/recommender';
import {
  FACTOR_LABELS,
  FEED_LABELS,
  WEIGHT_MAX,
  WEIGHT_MIN,
  WEIGHT_STEP,
  fmtWeight,
  scoreTracks,
  weightsEqual,
  DEFAULT_WEIGHTS,
} from '../lib/prioritization';
import { cn } from '@/lib/utils';
import type {
  DecisionDef,
  FactorKey,
  FeedClass,
  Mode,
  PriorityWeights,
  TrackState,
} from '../types';

/* Prioritization Assistant (v2) — SPEC.md's "visible, operator-re-weightable
   scoring of tracks/threats."

   Two weight sets, both shown with their arithmetic:
   - Feed weights scale classes of evidence in the recommender's confidence
     model. A pending recommendation re-scores live as the sliders move.
   - Track factor weights rank the visible tracks by attention score.

   Slider movement is live but writes nothing to the forensic log; releasing
   a slider (or pressing Reset) commits the re-weighting, and the engine
   logs it with its effect on any pending recommendation. In Black-Box mode
   the instruments are hidden — that is the condition being demonstrated —
   and the weights stay where Glass-Box last set them. */

function WeightSlider({
  id,
  label,
  value,
  onLive,
  onCommit,
}: {
  id: string;
  label: string;
  value: number;
  onLive: (v: number) => void;
  onCommit: () => void;
}) {
  return (
    <div className="grid grid-cols-[minmax(150px,1fr)_minmax(110px,160px)_52px] items-center gap-2.5">
      <label htmlFor={id} className="text-[13px]">
        {label}
      </label>
      <Slider
        id={id}
        min={WEIGHT_MIN}
        max={WEIGHT_MAX}
        step={WEIGHT_STEP}
        value={[value]}
        onValueChange={([v]) => onLive(v)}
        onValueCommit={() => onCommit()}
      />
      <span className="text-right font-mono text-[13px] tabular-nums">{fmtWeight(value)}</span>
    </div>
  );
}

const AFFIL_TEXT: Record<string, string> = {
  friendly: 'text-blue-400',
  hostile: 'text-red-400',
  unknown: 'text-yellow-400',
};

export default function PrioritizationPanel({
  weights,
  tracks,
  mode,
  pending,
  issuedConfidence,
  onLive,
  onCommit,
}: {
  weights: PriorityWeights;
  tracks: Record<string, TrackState>;
  mode: Mode;
  pending: DecisionDef | null;
  issuedConfidence: number | null;
  onLive: (w: PriorityWeights) => void;
  onCommit: () => void;
}) {
  if (mode === 'black') {
    return (
      <PanelShell
        title="PRIORITIZATION ASSISTANT"
        sub="operator-re-weightable scoring"
      >
        <p className="rounded-lg border border-dashed p-3 text-sm text-muted-foreground">
          Black-Box mode: the Prioritization Assistant's instruments are hidden, like every other
          instrument. Weights stay at the values last set in Glass-Box mode (defaults ×1.00 unless
          changed there), and every committed change is in the forensic log.
        </p>
      </PanelShell>
    );
  }

  const scores = scoreTracks(tracks, weights.factors);
  const pendingConf = pending ? computeConfidence(pending, weights.feeds).value : null;
  const atDefaults = weightsEqual(weights, DEFAULT_WEIGHTS);

  const setFeed = (key: FeedClass, v: number) =>
    onLive({ ...weights, feeds: { ...weights.feeds, [key]: v } });
  const setFactor = (key: FactorKey, v: number) =>
    onLive({ ...weights, factors: { ...weights.factors, [key]: v } });

  return (
    <PanelShell
      title="PRIORITIZATION ASSISTANT"
      sub="visible scoring · operator-re-weightable · changes are logged"
    >
      <div className="grid gap-x-7 gap-y-6 lg:grid-cols-2">
        <div className="space-y-2.5">
          <SectionLabel>Feed weights — what the evidence is worth</SectionLabel>
          <p className="text-[13px] text-muted-foreground">
            Scales each class of evidence in the confidence model. Standing rules, contradiction
            penalties, and the degraded-link discount are not scaled — they belong to the rules,
            not the evidence.
          </p>
          {(Object.keys(FEED_LABELS) as FeedClass[]).map((key) => (
            <WeightSlider
              key={key}
              id={`feed-weight-${key}`}
              label={FEED_LABELS[key]}
              value={weights.feeds[key]}
              onLive={(v) => setFeed(key, v)}
              onCommit={onCommit}
            />
          ))}
          {pending && pendingConf !== null && (
            <p className="text-[13px] text-muted-foreground" role="status">
              Pending {pending.id} now scores <strong className="text-foreground">{pendingConf}%</strong>
              {issuedConfidence !== null && issuedConfidence !== pendingConf
                ? ` (issued at ${issuedConfidence}%)`
                : ''}{' '}
              under the current feed weights.
            </p>
          )}
        </div>

        <div className="space-y-2.5">
          <SectionLabel>Track attention — ranked by weighted factors</SectionLabel>
          {(Object.keys(FACTOR_LABELS) as FactorKey[]).map((key) => (
            <WeightSlider
              key={key}
              id={`factor-weight-${key}`}
              label={FACTOR_LABELS[key]}
              value={weights.factors[key]}
              onLive={(v) => setFactor(key, v)}
              onCommit={onCommit}
            />
          ))}
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <Button
          variant="outline"
          size="sm"
          disabled={atDefaults}
          onClick={() => {
            onLive(structuredClone(DEFAULT_WEIGHTS));
            onCommit();
          }}
        >
          <RotateCcw /> Reset all weights to defaults (×1.00)
        </Button>
        {atDefaults && (
          <span className="text-[13px] text-muted-foreground">
            At defaults the model is exactly the v1 model.
          </span>
        )}
      </div>

      {scores.length === 0 ? (
        <p className="mt-4 text-sm text-muted-foreground">
          No tracks on the picture yet — start the scenario clock.
        </p>
      ) : (
        <div className="mt-4">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="font-mono text-[11px] tracking-wider uppercase">
                  Track
                </TableHead>
                <TableHead className="font-mono text-[11px] tracking-wider uppercase">
                  Attention
                </TableHead>
                <TableHead className="font-mono text-[11px] tracking-wider uppercase">
                  Factor breakdown (raw × weight)
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {scores.map((s) => (
                <TableRow key={s.trackId} className="text-[13px]">
                  <TableCell className="whitespace-normal">
                    {s.label}{' '}
                    <span
                      className={cn(
                        'font-mono text-[11px] tracking-wider uppercase',
                        AFFIL_TEXT[s.affiliation],
                      )}
                    >
                      {s.affiliation}
                    </span>
                  </TableCell>
                  <TableCell>
                    <span className="mr-2.5 font-mono font-bold tabular-nums">{s.total}</span>
                    <Progress
                      value={s.total}
                      className="inline-block h-2 w-24 align-middle"
                      aria-label={`Attention score ${s.total}`}
                    />
                  </TableCell>
                  <TableCell className="whitespace-normal text-xs text-muted-foreground">
                    {s.factors.map((f) => (
                      <span key={f.key} className="mr-2.5 inline-block whitespace-nowrap">
                        {f.label} {f.raw} × {f.weight.toFixed(2)}
                      </span>
                    ))}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
      <p className="mt-2.5 font-mono text-[11.5px] text-muted-foreground">
        Attention score = weighted mean of the four factor raws (0–100 each), computed from live
        track state. Same inputs, same weights, same ranking — every time.
      </p>
    </PanelShell>
  );
}

import type { ScenarioDef } from '../types';
import { POISONED_PICTURE } from './scenario';
import { DARK_STRAIT } from './scenario2';

/* Scenario registry (v3): every playable vignette, in picker order.
   POISONED PICTURE is the default — the v1/v2 baseline — and runs
   exactly as it did before the registry existed. */
export const SCENARIOS: ScenarioDef[] = [POISONED_PICTURE, DARK_STRAIT];

export const SCENARIOS_BY_ID: Record<string, ScenarioDef> = Object.fromEntries(
  SCENARIOS.map((s) => [s.id, s]),
);

export const DEFAULT_SCENARIO: ScenarioDef = POISONED_PICTURE;

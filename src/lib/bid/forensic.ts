/// <reference types="node" />
import { appendFileSync, existsSync, mkdirSync, readFileSync } from 'node:fs';
import { dirname } from 'node:path';
import type { ForensicEntry } from './types';

/**
 * Append-only JSONL forensic log (spec §5). The Linear comment is never
 * the only copy of a disposition (CHR-2278). Thresholds travel on every
 * line as the v1 calibration constants used.
 *
 * node:fs is referenced explicitly because tsconfig.app.json sets
 * `"types": ["vite/client"]`, which suppresses automatic @types/node
 * inclusion (Lane A / CHR-2278 follow-up). No tsconfig edit.
 */

export function nextForensicSeq(path: string | undefined): number {
  if (!path) return 1;
  if (!existsSync(path)) return 1;
  const text = readFileSync(path, 'utf8');
  const lines = text.split('\n').filter((line) => line.trim().length > 0);
  return lines.length + 1;
}

export function appendForensicEntry(path: string | undefined, entry: ForensicEntry): void {
  if (!path) return;
  const dir = dirname(path);
  if (dir && dir !== '.' && !existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
  appendFileSync(path, `${JSON.stringify(entry)}\n`, 'utf8');
}

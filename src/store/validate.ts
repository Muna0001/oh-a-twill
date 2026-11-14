/** Clamps and validators shared by the stores and the legacy import. Pure. */
import { DEFAULTS, LIMITS } from '@/engine/types';
import type { PatternSetup, PicWeave, Side } from '@/engine/types';

export const NAME_MAX = 80;

const HEX = /^#[0-9a-fA-F]{6}$/;

export function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function toInt(v: unknown): number | null {
  const n = typeof v === 'string' && v.trim() !== '' ? Number(v) : v;
  return typeof n === 'number' && Number.isFinite(n) ? Math.round(n) : null;
}

function clampInt(v: unknown, min: number, max: number, fallback: number): number {
  const n = toInt(v);
  return n === null ? fallback : Math.min(max, Math.max(min, n));
}

/** 4–120. */
export function clampWarps(v: unknown, fallback: number = DEFAULTS.warps): number {
  return clampInt(v, LIMITS.warps.min, LIMITS.warps.max, fallback);
}

/** Picture colors, 2–8. */
export function clampK(v: unknown, fallback: number = DEFAULTS.k): number {
  return clampInt(v, LIMITS.colors.min, LIMITS.colors.max, fallback);
}

/** Picture rows: 0 (auto) or 4–400. Anything at or below 0 means auto. */
export function clampRows(v: unknown, fallback = 0): number {
  const n = toInt(v);
  if (n === null) return fallback;
  if (n <= 0) return 0;
  return Math.min(LIMITS.rows.max, Math.max(LIMITS.rows.min, n));
}

/** Current row: a whole number, never below 1, never above `maxRow` when given. */
export function clampRow(v: unknown, maxRow?: number, fallback = 1): number {
  const n = toInt(v);
  let row = Math.max(1, n === null ? fallback : n);
  const max = toInt(maxRow);
  if (max !== null) row = Math.min(row, Math.max(1, max));
  return row;
}

/** Which tile row is row 1: a whole number, 0 or more. The engine wraps it to the tile. */
export function cleanStart(v: unknown, fallback = 0): number {
  const n = toInt(v);
  return n === null || n < 0 ? fallback : n;
}

export function cleanSize(v: unknown, fallback = 0): number {
  const n = toInt(v);
  return n === null || n < 0 ? fallback : n;
}

export function cleanSide(v: unknown, fallback: Side = DEFAULTS.setup.side): Side {
  return v === 'left' || v === 'right' ? v : fallback;
}

export function cleanBool(v: unknown, fallback: boolean): boolean {
  return typeof v === 'boolean' ? v : fallback;
}

export function cleanWeave(v: unknown, fallback: PicWeave = DEFAULTS.weave): PicWeave {
  return v === 'twill22' || v === 'plain' ? v : fallback;
}

export function cleanColors(
  v: unknown,
  fallback: readonly [string, string] = DEFAULTS.colors,
): [string, string] {
  if (Array.isArray(v) && v.length >= 2 && typeof v[0] === 'string' && typeof v[1] === 'string' && HEX.test(v[0]) && HEX.test(v[1])) {
    return [v[0], v[1]];
  }
  return [fallback[0], fallback[1]];
}

export function cleanSetup(v: unknown, fallback: PatternSetup = DEFAULTS.setup): PatternSetup {
  const s = isRecord(v) ? v : {};
  return {
    start: cleanStart(s.start, fallback.start),
    mirror: cleanBool(s.mirror, fallback.mirror),
    side: cleanSide(s.side, fallback.side),
  };
}

/** Trimmed and capped; falls back when empty or not a string. */
export function cleanName(v: unknown, fallback: string): string {
  if (typeof v !== 'string') return fallback;
  const name = v.trim().slice(0, NAME_MAX);
  return name === '' ? fallback : name;
}

export function cleanStringList(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  const out: string[] = [];
  for (const item of v) {
    if (typeof item === 'string' && item !== '' && !out.includes(item)) out.push(item);
  }
  return out;
}

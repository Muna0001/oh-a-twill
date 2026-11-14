/**
 * Pattern engine: tile maths, rows, runs and stats.
 * Ported from reference/web/index.html ("Pattern engine" and renderRow / renderMath).
 * Pure functions: the state the web app kept in globals is passed in.
 * See PLAN.md section 6, items 1–10, before changing anything here.
 */
import { lcm, mod } from '../math';
import type { ColorKey, PatternSetup, PatternStats, RowInfo, Run, Structure, Tile } from '../types';

const A: ColorKey = 0;
const B: ColorKey = 1;

/** Row 1 first; '#' = weft on top. */
export const fromStrings = (rows: string[]): Tile => rows.map((s) => [...s].map((c) => c === '#'));

/**
 * Tile from a threading and a treadling: over when mod(t - u, 4) < 2.
 * These twills slant the opposite way to TWILL. That is intended.
 */
export const threaded = (threading: number[], treadling: number[]): Tile =>
  treadling.map((u) => threading.map((t) => mod(t - u, 4) < 2));

export const PLAIN: Tile = fromStrings(['#.', '.#']);
/** 2/2 twill. This row order is fixed: never reorder it. */
export const TWILL: Tile = fromStrings(['##..', '#..#', '..##', '.##.']);

/** The tile as woven: every row reversed when mirror is on. */
export const tileOf = (s: Structure, setup: PatternSetup): Tile =>
  setup.mirror ? s.tile.map((r) => [...r].reverse()) : s.tile;

const tileRow = (s: Structure, setup: PatternSetup, r: number): boolean[] => {
  const t = tileOf(s, setup);
  return t[mod(setup.start + r - 1, t.length)];
};

/** Is the weft over warp `w` (0-based) in row `r` (1-based)? */
export const overAt = (s: Structure, setup: PatternSetup, w: number, r: number): boolean => {
  const row = tileRow(s, setup, r);
  return row[mod(w, row.length)];
};

/** Colour of warp `w` (0-based). */
export const warpKey = (s: Structure, w: number): ColorKey => (s.warp ? s.warp[mod(w, s.warp.length)] : B);

/** Colour of the weft in row `r` (1-based). The phase moves with `start`. */
export const weftKey = (s: Structure, setup: PatternSetup, r: number): ColorKey =>
  s.weft ? s.weft[mod(setup.start + r - 1, s.weft.length)] : A;

/** Colour showing on the front at warp `w` (0-based), row `r` (1-based). */
export const cellKey = (s: Structure, setup: PatternSetup, w: number, r: number): ColorKey =>
  overAt(s, setup, w, r) ? weftKey(s, setup, r) : warpKey(s, w);

/** Rows before the pattern repeats. */
export const period = (s: Structure): number => lcm(s.tile.length, s.weft ? s.weft.length : 1);

/** Warps before the pattern repeats. */
export const repWidth = (s: Structure): number => lcm(s.tile[0].length, s.warp ? s.warp.length : 1);

/** Is row `r` (1-based) woven left to right? */
export const goesRight = (setup: PatternSetup, r: number): boolean => (setup.side === 'left') === (r % 2 === 1);

/** Runs of over / under in travel order. `from` / `to` are 1-based warp numbers. */
export function runs(states: boolean[], ltr: boolean): Run[] {
  const idx = [...states.keys()];
  if (!ltr) idx.reverse();
  const out: Run[] = [];
  for (const i of idx) {
    const o = states[i];
    const last = out[out.length - 1];
    if (last && last.over === o) {
      last.n++;
      last.to = i + 1;
    } else out.push({ over: o, n: 1, from: i + 1, to: i + 1 });
  }
  return out;
}

/** Run-length encode any array. */
export function rle<T>(arr: readonly T[]): { v: T; n: number }[] {
  const o: { v: T; n: number }[] = [];
  for (const v of arr) {
    const l = o[o.length - 1];
    if (l && l.v === v) l.n++;
    else o.push({ v, n: 1 });
  }
  return o;
}

const word = (over: boolean, n: number): string => (over ? 'Over ' : 'Under ') + n;

/** "Over 2, under 2" for tile row `k` (0-based), or "Row k+1" when the tile is wider than 6. */
export function tileRowName(s: Structure, setup: PatternSetup, k: number): string {
  const row = tileOf(s, setup)[k];
  if (row.length > 6) return `Row ${k + 1}`;
  return runs(row, true)
    .map((x, j) => (j ? word(x.over, x.n).toLowerCase() : word(x.over, x.n)))
    .join(', ');
}

const rowStates = (s: Structure, setup: PatternSetup, warps: number, r: number): boolean[] => {
  const row = tileRow(s, setup, r);
  return Array.from({ length: warps }, (_, w) => row[mod(w, row.length)]);
};

/** Everything the guide needs to show row `r` (1-based). */
export function rowInfo(s: Structure, setup: PatternSetup, warps: number, r: number): RowInfo {
  const states = rowStates(s, setup, warps, r);
  const ltr = goesRight(setup, r);
  let edgeWarp: number | null = null;
  if (r > 1) {
    // The entry edge. If it is in the same state as in the row below, the weft will not catch it.
    const e = ltr ? 0 : warps - 1;
    if (overAt(s, setup, e, r - 1) === states[e]) edgeWarp = e + 1;
  }
  return {
    row: r,
    states,
    ltr,
    runs: runs(states, ltr),
    weftKey: weftKey(s, setup, r),
    repeatRow: ((r - 1) % period(s)) + 1,
    edgeWarp,
  };
}

/** The numbers behind "The math". */
export function stats(s: Structure, setup: PatternSetup, warps: number): PatternStats {
  const R = repWidth(s);
  const P = period(s);
  const remainder = warps % R;
  let overs = 0;
  let total = 0;
  let longestOver = 0;
  let longestUnder = 0;
  for (let r = 1; r <= P; r++) {
    const st = rowStates(s, setup, warps, r);
    total += st.length;
    for (const x of runs(st, true)) {
      if (x.over) {
        overs += x.n;
        longestOver = Math.max(longestOver, x.n);
      } else longestUnder = Math.max(longestUnder, x.n);
    }
  }
  const near: number[] = [];
  // The reference only shows these when the repeat does not fit, so they stay empty when it does.
  if (remainder !== 0) {
    for (let d = 1; d <= R && near.length < 2; d++) {
      if ((warps - d) % R === 0 && warps - d > 0) near.push(warps - d);
      if ((warps + d) % R === 0) near.push(warps + d);
    }
  }
  return {
    tileWidth: s.tile[0].length,
    repWidth: R,
    period: P,
    fullRepeats: Math.floor(warps / R),
    remainder,
    nearestCleanWarps: near.sort((a, b) => a - b),
    weftPct: Math.round((overs / total) * 100),
    longestOver,
    longestUnder,
  };
}

/** The cloth seen from the back: every cell inverted, same colour orders. */
export function back(s: Structure): Structure {
  const out: Structure = { tile: s.tile.map((r) => r.map((c) => !c)) };
  if (s.warp) out.warp = [...s.warp];
  if (s.weft) out.weft = [...s.weft];
  return out;
}

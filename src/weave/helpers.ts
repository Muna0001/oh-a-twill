/** Pure helpers behind the weave components. No React here, so they are cheap to test. */
import { mod, period, tileRowName, warpKey, weftKey, type PatternSetup, type PatternStats, type Structure } from '@/engine';

import { weaveCopy } from './copy';

export type ColorRun = {
  /** First column of the run (0-based). */
  x: number;
  /** Number of columns. */
  n: number;
  color: string;
};

/** Run-length encode one grid row: neighbouring columns of the same colour become one run. */
export function mergeRuns(cols: number, colorAtRow: (x: number) => string): ColorRun[] {
  const out: ColorRun[] = [];
  let last: ColorRun | undefined;
  for (let x = 0; x < cols; x++) {
    const color = colorAtRow(x);
    if (last && last.color === color) last.n++;
    else {
      last = { x, n: 1, color };
      out.push(last);
    }
  }
  return out;
}

/** The yarn colour of every warp, left to right. */
export function warpColorsFor(stitch: Structure, warps: number, colors: readonly [string, string]): string[] {
  return Array.from({ length: warps }, (_, w) => colors[warpKey(stitch, w)]);
}

/** Label of the `j`-th row (0-based) of the repeat that starts at row `cycleStart`. */
function repeatRowLabel(stitch: Structure, setup: PatternSetup, cycleStart: number, j: number): string {
  const k = mod(setup.start + cycleStart + j - 1, stitch.tile.length);
  const name = tileRowName(stitch, setup, k);
  return stitch.weft ? name + weaveCopy.inColor(weaveCopy.colorName(weftKey(stitch, setup, cycleStart + j))) : name;
}

/** Labels for every row of one repeat, starting from row 1 (no length limit). */
export function repeatRowLabels(stitch: Structure, setup: PatternSetup): string[] {
  return Array.from({ length: period(stitch) }, (_, j) => repeatRowLabel(stitch, setup, 1, j));
}

/**
 * The repeat chips for the repeat that row `row` (1-based) sits in, as the reference builds them:
 * "Over 2, under 2", with " in Color A" added for colour-and-weave stitches.
 * Null when the period is 1 or more than 12 (no chips are shown then).
 */
export function repeatLabels(stitch: Structure, setup: PatternSetup, row: number): string[] | null {
  const P = period(stitch);
  if (P <= 1 || P > 12) return null;
  const repRow = ((row - 1) % P) + 1;
  const cycleStart = row - repRow + 1;
  return Array.from({ length: P }, (_, j) => repeatRowLabel(stitch, setup, cycleStart, j));
}

/** Which warp numbers (1-based) are written under a strip: all up to 32 warps, else 1, every 5th and the last. */
export function warpNumberLabels(count: number): number[] {
  const out: number[] = [];
  const showAll = count <= 32;
  for (let n = 1; n <= count; n++) if (showAll || n === 1 || n % 5 === 0 || n === count) out.push(n);
  return out;
}

export type MathPart = { text: string; bold?: boolean };
export type MathItem = { title: string; parts: MathPart[] };

/** All of an item's text in one string. */
export const mathText = (item: MathItem): string => item.parts.map((p) => p.text).join('');

/**
 * "The math", in the reference's words. `colorWarpLength` is the length of the stitch's warp
 * colour order; it is only read when the colour repeat makes the pattern wider than the tile.
 */
export function mathItems(stats: PatternStats, warps: number, colorWarpLength?: number): MathItem[] {
  const m = weaveCopy.math;
  const { tileWidth: Wt, repWidth: R, period: P, fullRepeats: full, remainder: rem, weftPct: pct, longestOver, longestUnder } = stats;
  const near = [...stats.nearestCleanWarps].sort((a, b) => a - b);

  const width: MathPart[] =
    R === Wt
      ? [{ text: m.warpsBold(R), bold: true }, { text: m.perRepeat }]
      : [{ text: m.widthMixedBefore(Wt, colorWarpLength ?? R) }, { text: m.warpsBold(R), bold: true }, { text: m.widthMixedAfter }];

  const across: MathPart[] =
    rem === 0
      ? [{ text: m.division(warps, R) }, { text: m.fullRepeats(full), bold: true }, { text: m.fitsAfter }]
      : [
          { text: m.division(warps, R) },
          { text: m.leftOver(full, rem), bold: true },
          { text: m.leftOverAfter + (near.length ? m.nearest(near) : '') },
        ];

  const side: MathPart[] =
    pct === 50
      ? [{ text: m.balancedBold, bold: true }, { text: m.balancedAfter }]
      : pct > 50
        ? [{ text: m.weftMoreBold, bold: true }, { text: m.weftMoreAfter(pct) }]
        : [{ text: m.warpMoreBold, bold: true }, { text: m.warpMoreAfter(pct) }];

  const warn = Math.max(longestOver, longestUnder) >= 4;
  return [
    { title: m.widthTitle, parts: width },
    { title: m.acrossTitle(warps), parts: across },
    { title: m.rowsTitle, parts: [{ text: m.rowsBold(P), bold: true }, { text: m.rowsAfter(P) }] },
    { title: m.sideTitle, parts: side },
    {
      title: m.floatTitle,
      parts: [
        { text: m.floatBefore },
        { text: m.floatOverBold(longestOver), bold: true },
        { text: m.floatMiddle },
        { text: String(longestUnder), bold: true },
        { text: m.floatAfter + (warn ? m.floatWarning : '') },
      ],
    },
  ];
}

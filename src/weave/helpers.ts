/** Pure helpers behind the weave components. No React here, so they are cheap to test. */
import { mod, period, tileRowName, warpKey, weftKey, type ColorKey, type PatternSetup, type PatternStats, type Run, type Structure } from '@/engine';

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

/** The steps of a row as one sentence for screen readers: "Row 2, right to left: over 1, under 2, …". */
export function stepsSentence(runs: readonly Run[], row: number, ltr: boolean): string {
  return weaveCopy.stepsSentence(
    row,
    ltr,
    runs.map((x) => weaveCopy.word(x.over, x.n).toLowerCase()),
  );
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

/** One piece of the colour-order wording: plain text, or a colour name (drawn with its swatch). */
export type ColorOrderPart = { text: string } | { color: ColorKey };

type Segment = { kind: 'solid' | 'alternate'; start: number; n: number };

/**
 * Splits a colour order into maximal segments, left to right: a run of one colour, or a strict
 * alternation (each thread differs from the one before). A run of 2 or more of one colour always
 * starts a solid segment; otherwise an alternation runs as long as the colours keep switching.
 */
export function colorOrderSegments(order: readonly ColorKey[]): Segment[] {
  const out: Segment[] = [];
  let i = 0;
  while (i < order.length) {
    let j = i + 1;
    if (j < order.length && order[j] === order[i]) {
      while (j < order.length && order[j] === order[i]) j++;
      out.push({ kind: 'solid', start: i, n: j - i });
    } else if (j < order.length) {
      while (j < order.length && order[j] !== order[j - 1]) j++;
      out.push({ kind: 'alternate', start: i, n: j - i });
    } else {
      out.push({ kind: 'solid', start: i, n: 1 });
    }
    i = j;
  }
  return out;
}

/**
 * The colour order as grouped wording, in parts so a screen can put a swatch beside each colour
 * name: "4 Color A, then 4 Color B"; "6 threads alternating Color A and Color B, starting with A,
 * then …"; a repeat that is one alternation is "Alternate Color A and Color B". Warps say
 * "threads", wefts say "rows".
 */
export function colorOrderParts(order: readonly ColorKey[], kind: 'warp' | 'weft' = 'warp'): ColorOrderPart[] {
  const c = weaveCopy.colorOrder;
  const segments = colorOrderSegments(order);
  const parts: ColorOrderPart[] = [];
  const other = (k: ColorKey): ColorKey => (k === 0 ? 1 : 0);
  if (segments.length === 1 && segments[0].kind === 'alternate') {
    const first = order[0];
    return [{ text: c.alternate }, { color: first }, { text: c.and }, { color: other(first) }];
  }
  segments.forEach((seg, i) => {
    if (i > 0) parts.push({ text: c.then });
    const first = order[seg.start];
    if (seg.kind === 'solid') {
      parts.push({ text: `${seg.n} ` }, { color: first });
    } else {
      parts.push(
        { text: `${seg.n} ${c.unit(kind, seg.n)}${c.alternating}` },
        { color: first },
        { text: c.and },
        { color: other(first) },
        { text: c.startingWith(first) },
      );
    }
  });
  return parts;
}

/** `colorOrderParts` as one plain sentence (no full stop), e.g. "4 Color A, then 4 Color B". */
export function describeColorOrder(order: readonly ColorKey[], kind: 'warp' | 'weft' = 'warp'): string {
  return colorOrderParts(order, kind)
    .map((p) => ('text' in p ? p.text : weaveCopy.colorName(p.color)))
    .join('');
}

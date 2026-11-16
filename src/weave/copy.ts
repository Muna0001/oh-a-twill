/** User-facing strings for the weave components. Wording is the reference web app's, verbatim. */
import type { ColorKey } from '@/engine';

const plural = (n: number): string => (n > 1 ? 's' : '');

export const weaveCopy = {
  colorName: (k: ColorKey): string => (k === 0 ? 'Color A' : 'Color B'),
  weft: (name: string): string => `Weft: ${name}`,
  inColor: (name: string): string => ` in ${name}`,

  leftToRight: 'Left to right',
  rightToLeft: 'Right to left',

  /** "Over 2" / "Under 1". */
  word: (over: boolean, n: number): string => (over ? 'Over ' : 'Under ') + n,
  /** "warps 21–20", or "warp 24" for a single warp. */
  warpRange: (from: number, to: number): string => (from === to ? `warp ${from}` : `warps ${from}–${to}`),
  sectionDetail: (range: string, start: string): string => `${range}, start ${start}`,

  stepsLabel: (row: number): string => `Steps for row ${row}, in the order you weave them`,
  stepsSentence: (row: number, ltr: boolean, steps: string[]): string =>
    `Row ${row}, ${ltr ? 'left to right' : 'right to left'}: ${steps.join(', ')}`,
  sectionsLabel: (row: number): string => `Color sections for row ${row}, left to right`,
  sectionsLabelNoRow: 'Color sections, left to right',
  repeatLabel: 'The repeat',

  edgeTip: (warp: number): string =>
    `Edge check: this row starts the same way the last row ended, so warp ${warp} won’t get caught. Wrap the weft once around warp ${warp} before you start.`,

  jumpToRow: (row: number): string => `Jump to row ${row}`,
  drawdownLabel: 'Drawdown',
  previewLabel: 'Woven preview',
  rowValue: (row: number): string => `Row ${row}`,
  stripLabel: 'Row picture',
  tilePreviewLabel: 'Woven preview',

  math: {
    widthTitle: 'Pattern width',
    warpsBold: (n: number): string => `${n} warps`,
    perRepeat: ' per repeat.',
    widthMixedBefore: (tileWidth: number, colorWidth: number): string =>
      `The weave repeats every ${tileWidth} warps and the colors every ${colorWidth}, so the full pattern is `,
    widthMixedAfter: ' wide.',

    acrossTitle: (warps: number): string => `Across your ${warps} warps`,
    division: (warps: number, rep: number): string => `${warps} ÷ ${rep} = `,
    fullRepeats: (full: number): string => `${full} full repeat${plural(full)}`,
    fitsAfter: ', nothing left over. Both edges finish cleanly.',
    leftOver: (full: number, rem: number): string =>
      `${full} full repeat${full === 1 ? '' : 's'} with ${rem} warp${plural(rem)} left over`,
    leftOverAfter: '. The pattern carries on into those, so the two edges won’t match.',
    nearest: (near: number[]): string => ` For even repeats you’d want ${near.join(' or ')} warps.`,

    rowsTitle: 'Rows before it repeats',
    rowsBold: (period: number): string => `${period} row${plural(period)}`,
    rowsAfter: (period: number): string => `. Row ${period + 1} is the same as row 1.`,

    sideTitle: 'Which side shows more',
    balancedBold: 'Balanced.',
    balancedAfter: ' Weft is on top half the time, so warp and weft show equally.',
    weftMoreBold: 'Weft shows more',
    weftMoreAfter: (pct: number): string => ` on the side facing you, about ${pct}%. The back will be mostly warp.`,
    warpMoreBold: 'Warp shows more',
    warpMoreAfter: (pct: number): string => ` on the side facing you. Weft is on top about ${pct}% of the time.`,

    floatTitle: 'Longest float',
    floatBefore: 'Weft skips up to ',
    floatOverBold: (n: number): string => `${n} warp${plural(n)}`,
    floatMiddle: ' on top and ',
    floatAfter: ' underneath.',
    floatWarning: ' Floats of 4 or more can snag; fine for a wall hanging, risky for something worn.',
  },

  repeatRowNumber: (n: number): string => `${n}.`,

  colorOrder: {
    /** Unit for a run of the colour order. */
    unit: (kind: 'warp' | 'weft', n: number): string => (kind === 'warp' ? (n === 1 ? 'thread' : 'threads') : n === 1 ? 'row' : 'rows'),
    then: ', then ',
    alternating: ' alternating ',
    and: ' and ',
    startingWith: (k: ColorKey): string => `, starting with ${k === 0 ? 'A' : 'B'}`,
    alternate: 'Alternate ',
    repeatWarp: 'Repeat across the warp.',
    repeatWeft: 'Repeat up the cloth.',
  },
} as const;

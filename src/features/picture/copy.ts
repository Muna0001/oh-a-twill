/**
 * User-facing strings for the picture guide. Wording is the reference web app's
 * (reference/web/index.html: `renderWarp`, `renderPic`, `renderPicRow`, `renderBar`), verbatim.
 */
import type { PicWeave } from '@/engine';

const plural = (n: number): string => (n > 1 ? 's' : '');

export const pictureCopy = {
  /* Warp threads */
  warpTitle: 'Warp threads',
  warpFit: (warps: number): string => `Your picture will be ${warps} squares wide`,
  warpLabel: 'Number of warp threads',
  fewerWarps: 'Fewer warps',
  moreWarps: 'More warps',

  /* Picture panel */
  pictureTitle: 'Picture',
  useAnother: 'Use another',
  addTitle: 'Add a picture',
  addHint: 'Bold shapes on a plain background work best, like a single flower. Your picture stays on this device.',
  choose: 'Choose a picture',
  camera: 'Take a photo',
  dropHere: 'Drop a picture here',
  thumbLabel: 'Your picture',
  size: (W: number, H: number, colors: number): string => `${W} warps by ${H} rows, ${colors} yarn colors`,
  squares: (n: number): string => `${n} squares`,
  paletteLabel: 'Yarn colors',
  how: (weave: PicWeave): string =>
    weave === 'plain'
      ? 'Pictures weave as tapestry: plain weave packed down so the weft hides the warp. Weave each color back and forth in its own section.'
      : 'Pictures weave as twill tapestry: 2/2 twill packed down so the weft hides the warp. Weave each color back and forth in its own section, keeping the twill going row by row.',
  updating: 'Updating…',

  /* Settings */
  weave: 'Weave',
  weaveTwill: '2/2 twill',
  weavePlain: 'Plain weave',
  colors: 'Colors',
  fewerColors: 'Fewer colors',
  moreColors: 'More colors',
  rows: 'Rows',
  fewerRows: 'Fewer rows',
  moreRows: 'More rows',
  matchShape: 'Match the picture’s shape',
  cleanup: 'Cleanup',
  tidy: 'Remove single-square specks',

  /* Row card */
  row: (r: number): string => `Row ${r}`,
  of: (H: number): string => `of ${H}`,
  sections: (n: number): string => `${n} section${plural(n)}`,
  same: 'Same colors as the last row.',
  weaveEach: 'Weave each section across and back with its color.',
  restart: 'Back to row 1',
  finished: 'Finished',
  finishedSub: (H: number): string => `All ${H} rows are woven. Nice work.`,

  /* Woven preview */
  previewTitle: 'Woven preview',
  previewHint: 'Each square is one warp by one row. Row 1 is at the bottom. Tap a row to jump to it.',

  /* Bottom bar */
  back: 'Back',
  previousRow: 'Previous row',
  rowDone: 'Row done',

  /* Fallback (new: the reference has a single picture and no project list) */
  missingTitle: 'Project not found',
  missingMessage: 'It may have been deleted. Your other weavings are in Projects.',
  missingAction: 'Go to projects',
} as const;

/** User-facing strings for the pattern guide. Wording is the reference web app's where it exists. */
export const guideCopy = {
  row: (n: number): string => `Row ${n}`,
  /** "Row 2 of the 4-row repeat. " (shown only when the repeat is longer than one row). */
  repeatLine: (k: number, period: number): string => `Row ${k} of the ${period}-row repeat. `,

  /** "Start: over 1 at warp 24": the first step of the row, in travel order. */
  start: (step: string, warp: number): string => `Start: ${step} at warp ${warp}`,
  /** "Weft color: Color A. Change". */
  weftButton: (name: string): string => `Weft color: ${name}. Change`,

  drawdownTitle: 'Drawdown',
  drawdownHint: 'How the cloth will look. Row 1 is at the bottom, like on the loom. Tap a row to jump to it.',
  mathTitle: 'The math',

  back: 'Back',
  previousRow: 'Previous row',
  rowDone: 'Row done',
  backToRow1: 'Back to row 1',

  setup: 'Project settings',
  setupHint: 'Change warps, start row, colors and edge',

  restartTitle: 'Go back to row 1?',
  restartMessage: (row: number): string => `You’re on row ${row}. Your place in the pattern will go back to row 1.`,
  restartConfirm: 'Back to row 1',
  cancel: 'Cancel',

  notFoundTitle: 'Project not found',
  notFoundMessage: 'It may have been deleted. Your other weavings are in Projects.',
  unknownStitchTitle: 'Stitch not found',
  unknownStitchMessage: 'This project uses a stitch this version of the app doesn’t know.',
  toProjects: 'Go to projects',
} as const;

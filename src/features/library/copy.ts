/** User-facing strings for the stitch library and stitch detail screens. */
export const libraryCopy = {
  title: 'Stitches',

  // Category filter
  categoriesLabel: 'Show stitches',
  all: 'All',
  favorites: 'Favorites',

  // Search
  searchPlaceholder: 'Search stitches',
  searchLabel: 'Search stitches by name',
  noMatchTitle: 'No stitches match',
  noMatchMessage: (query: string) => `Nothing is called “${query}”. Try another name, or show all stitches.`,
  noMatchInCategory: 'Nothing in this group yet.',
  noFavoritesTitle: 'No favorites yet',
  noFavoritesMessage: 'Tap the heart on a stitch’s page to keep it here.',
  showAll: 'Show all stitches',

  // Cards
  cardLabel: (name: string, desc: string) => `${name}. ${desc}`,
  difficulty: (n: number) => `Difficulty ${n} of 3`,
  favorite: 'Favorite',

  // Continue
  continueLabel: 'Continue',
  rowAndWarps: (row: number, warps: number) => `Row ${row} · ${warps} warps`,
  pictureRowAndWarps: (row: number, warps: number) => `Picture · row ${row} · ${warps} warps`,
  continueButton: 'Continue weaving',
  continueA11y: (name: string) => `Continue weaving ${name}`,

  // Quick start
  quickStartLabel: 'Quick start',
  quickStartLine: (warps: number) => `2/2 twill on ${warps} warps`,
  quickStartHint: 'Ready to weave, one row at a time.',
  quickStartButton: 'Start weaving',
  quickStartName: '2/2 twill',

  // Legacy import (PLAN 3.7)
  legacyTitle: 'Bring over your weaving from the old helper',
  legacyHint: 'Your pattern, colors and row come with it, and your picture if you had one. The old helper keeps its copy.',
  legacyAccept: 'Bring it over',
  legacyDecline: 'Not now',

  // Detail
  addFavorite: 'Add to favorites',
  removeFavorite: 'Remove from favorites',
  faceLabel: 'Which side to show',
  front: 'Front',
  back: 'Back',
  frontA11y: 'Front of the cloth',
  backA11y: 'Back of the cloth',
  previewLabel: (name: string, face: 'front' | 'back') => `Woven preview of ${name}, ${face === 'front' ? 'front' : 'back'}`,
  alsoCalled: (aliases: string[]) => `Also called ${aliases.join(', ')}`,
  goodFor: 'Good for',
  colorOrderTitle: 'Color order',
  warpOrder: (order: string) => `Wind the warp in this order, then repeat: ${order}.`,
  weftOrder: (order: string) => `Weave the weft in this order, then repeat: ${order}.`,
  repeatTitle: 'The repeat',
  mathTitle: 'The math',
  warpThreads: 'Warp threads',
  warpInput: 'Number of warp threads',
  fewerWarps: 'Fewer warps',
  moreWarps: 'More warps',
  fit: (warps: number, rep: number) =>
    warps % rep === 0
      ? `${warps / rep} repeats of ${rep}, clean edges`
      : `${Math.floor(warps / rep)} repeats of ${rep}, plus ${warps % rep} extra`,
  tipsTitle: 'Tips',
  startWeaving: 'Start weaving',
  notFoundTitle: 'Stitch not found',
  notFoundMessage: 'This stitch isn’t in the library. It may have been renamed.',
  backToLibrary: 'Back to stitches',
} as const;

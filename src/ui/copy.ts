/** User-facing strings owned by the design system. */
export const uiCopy = {
  back: 'Back',
  close: 'Close',
  done: 'Done',
  clearSearch: 'Clear search',
  search: 'Search',
  decrease: 'Decrease',
  increase: 'Increase',
  colorSheetTitle: 'Pick a color',
  colorPresets: 'Yarn colors',
  hexLabel: 'Hex color',
  hexPlaceholder: '#2E4C8F',
  hexApply: 'Use color',
  hexError: 'Enter a hex color like #2E4C8F.',
  changeColor: (label: string, value: string) => `${label}, ${value}. Change color`,
  tabs: { stitches: 'Stitches', projects: 'Projects', settings: 'Settings' },
} as const;

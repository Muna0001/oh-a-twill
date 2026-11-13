/**
 * Shared contracts. Frozen after WP0: do not change without the orchestrator.
 * See PLAN.md section 5.
 */

/** [row][warp]. true = weft goes OVER the warp (weft shows on the front). Row 1 is index 0. */
export type Tile = boolean[][];
/** 0 = Color A (default weft), 1 = Color B (default warp). */
export type ColorKey = 0 | 1;
export type Side = 'left' | 'right';

export interface Structure {
  tile: Tile;
  /** Colour order across the warps; absent = all Color B. */
  warp?: ColorKey[];
  /** Colour order up the rows; absent = all Color A. */
  weft?: ColorKey[];
}

export interface PatternSetup {
  /** Which tile row is row 1. */
  start: number;
  /** Reverse every tile row. */
  mirror: boolean;
  /** Edge where row 1 starts; rows alternate direction. */
  side: Side;
}

/** A run of over or under. `from`/`to` are 1-based warp numbers, in travel order. */
export interface Run {
  over: boolean;
  n: number;
  from: number;
  to: number;
}

export interface RowInfo {
  /** 1-based. */
  row: number;
  /** Per warp, left to right. true = weft over. */
  states: boolean[];
  /** true = this row is woven left to right. */
  ltr: boolean;
  /** In travel order. */
  runs: Run[];
  weftKey: ColorKey;
  /** 1..period */
  repeatRow: number;
  /** Warp (1-based) to wrap the weft around first, or null when the edge catches. */
  edgeWarp: number | null;
}

export interface PatternStats {
  tileWidth: number;
  repWidth: number;
  period: number;
  fullRepeats: number;
  remainder: number;
  /** Ascending, at most 2. Empty when the repeat already fits. */
  nearestCleanWarps: number[];
  /** Rounded % of cells where weft is on top, over one period. */
  weftPct: number;
  longestOver: number;
  longestUnder: number;
}

export type StitchCategory = 'basics' | 'twills' | 'pointed' | 'color';

export interface Stitch extends Structure {
  id: string;
  name: string;
  aliases: string[];
  category: StitchCategory;
  difficulty: 1 | 2 | 3;
  desc: string;
  goodFor: string;
  tips: string[];
}

export interface PaletteColor {
  rgb: [number, number, number];
  hex: string;
  name: string;
  count: number;
}

/** grid[y * W + x] is a palette index. y = 0 is the TOP row of the picture. */
export interface PictureGrid {
  W: number;
  H: number;
  grid: Uint8Array;
  palette: PaletteColor[];
}

export type PicWeave = 'twill22' | 'plain';

/** A run of one colour in a picture row. `from`/`to` are 1-based warps, left to right. */
export interface Section {
  color: number;
  n: number;
  from: number;
  to: number;
  /** How the section starts: over or under... */
  startOver: boolean;
  /** ...for this many warps. */
  startN: number;
}

export interface PicRowInfo {
  /** 1-based, row 1 is the bottom of the picture. */
  row: number;
  /** Palette index per warp, left to right. */
  cells: number[];
  over: boolean[];
  sections: Section[];
  sameAsPrevious: boolean;
}

/* ---------- Limits and defaults ---------- */

export const LIMITS = {
  warps: { min: 4, max: 120 },
  colors: { min: 2, max: 8 },
  rows: { min: 4, max: 400 },
} as const;

export const DEFAULTS = {
  warps: 24,
  stitchId: 'twill22',
  setup: { start: 0, mirror: false, side: 'left' } as PatternSetup,
  colors: ['#2E4C8F', '#E4DCC8'] as [string, string],
  k: 4,
  tidy: true,
  weave: 'twill22' as PicWeave,
} as const;

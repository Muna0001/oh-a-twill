/** Store contracts. Frozen after WP0. See PLAN.md section 5. */
import type { PatternSetup, PicWeave, Side } from '@/engine/types';

interface ProjectBase {
  id: string;
  name: string;
  warps: number;
  createdAt: number;
  updatedAt: number;
  /** Current row, 1-based. For pictures, H + 1 means finished. */
  row: number;
}

export interface PatternProject extends ProjectBase {
  kind: 'pattern';
  stitchId: string;
  setup: PatternSetup;
  colors: [string, string];
}

export interface PictureProject extends ProjectBase {
  kind: 'picture';
  imageUri: string | null;
  imageW: number;
  imageH: number;
  /** 0 = auto from the picture's shape. */
  rows: number;
  k: number;
  tidy: boolean;
  weave: PicWeave;
}

export type Project = PatternProject | PictureProject;

export interface Settings {
  defaultWarps: number;
  defaultSide: Side;
  defaultColors: [string, string];
  haptics: boolean;
  keepAwake: boolean;
  theme: 'system' | 'light' | 'dark';
  favourites: string[];
}

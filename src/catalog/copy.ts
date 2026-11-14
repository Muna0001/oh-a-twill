/** User-facing strings owned by the catalog. Stitch copy itself lives in stitches.ts. */
import type { ColorKey, StitchCategory } from '../engine/types';

export const CATEGORY_LABELS: Record<StitchCategory, string> = {
  basics: 'Basics',
  twills: 'Twills',
  pointed: 'Pointed twills',
  color: 'Color and weave',
};

export const COLOR_NAMES: Record<ColorKey, string> = { 0: 'Color A', 1: 'Color B' };

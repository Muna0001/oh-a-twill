/**
 * The old web app's saved state ("weaving-helper-v3"), normalised.
 * Pure: the platform layer reads localStorage and hands the parsed value here.
 * See reference/web/index.html (DEFAULTS and S).
 */
import { DEFAULTS } from '@/engine/types';
import type { PatternSetup, PicWeave } from '@/engine/types';

import { clampK, clampRow, clampRows, clampWarps, cleanColors, cleanSetup, cleanWeave, isRecord } from './validate';

export const LEGACY_KEY = 'weaving-helper-v3';

/** The old web app's default yarn colours (indigo on natural), also this app's defaults before settings v2. */
export const LEGACY_DEFAULT_COLORS = ['#2E4C8F', '#E4DCC8'] as const;

/** Every pattern id the old web app could have saved. */
export const LEGACY_STITCH_IDS = [
  'plain',
  'basket',
  'twill22',
  'twill21',
  'chevron',
  'arrowL',
  'arrowR',
  'herring',
  'diamond',
  'hounds',
  'logcabin',
] as const;

export interface LegacyData {
  /** Shared by the pattern and the picture in the old app. */
  warps: number;
  pattern: {
    stitchId: string;
    setup: PatternSetup;
    colors: [string, string];
    row: number;
  };
  picture: null | {
    /** Image data URL (the old app stored a downscaled JPEG). */
    src: string;
    /** 0 = auto. */
    rows: number;
    k: number;
    tidy: boolean;
    weave: PicWeave;
    row: number;
  };
  /** The tab that was open. 'pic' only when a picture is present. */
  mode: 'pat' | 'pic';
}

/** Returns null when `raw` is not a saved-state object. Missing or bad fields get the old app's defaults. */
export function normalizeLegacy(raw: unknown): LegacyData | null {
  if (!isRecord(raw)) return null;
  const stitchId = (LEGACY_STITCH_IDS as readonly unknown[]).includes(raw.pat) ? (raw.pat as string) : DEFAULTS.stitchId;
  const pic = isRecord(raw.pic) ? raw.pic : null;
  const picture: LegacyData['picture'] =
    pic && typeof pic.src === 'string' && /^data:image\//i.test(pic.src)
      ? {
          src: pic.src,
          rows: clampRows(pic.rows),
          k: clampK(pic.k),
          tidy: pic.tidy !== false,
          weave: cleanWeave(pic.weave),
          row: clampRow(pic.row),
        }
      : null;
  return {
    warps: clampWarps(raw.warps),
    pattern: {
      stitchId,
      setup: cleanSetup({ start: raw.start, mirror: raw.mirror, side: raw.side }),
      colors: cleanColors(raw.colors, LEGACY_DEFAULT_COLORS),
      row: clampRow(raw.row),
    },
    picture,
    mode: raw.mode === 'pic' && picture ? 'pic' : 'pat',
  };
}

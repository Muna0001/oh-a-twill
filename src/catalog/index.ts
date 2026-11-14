/**
 * Stitch catalog: the stitches the app ships with, and lookups over them.
 * See PLAN.md section 7.
 */
import { rle } from '../engine/pattern/pattern';
import type { ColorKey, Stitch, StitchCategory } from '../engine/types';
import { CATEGORY_LABELS, COLOR_NAMES } from './copy';
import { STITCHES } from './stitches';

export { STITCHES };

/** Categories in the order the library shows them. */
export const CATEGORIES: { id: StitchCategory; label: string }[] = (
  ['basics', 'twills', 'pointed', 'color'] as const
).map((id) => ({ id, label: CATEGORY_LABELS[id] }));

export const getStitch = (id: string): Stitch | undefined => STITCHES.find((s) => s.id === id);

export interface ListStitchesOptions {
  category?: StitchCategory | 'all';
  /** Matches name and aliases, ignoring case. */
  query?: string;
  /** When given, only these ids. */
  favourites?: string[];
}

/** Stitches in catalog order, narrowed by every option that is given. */
export function listStitches({ category, query, favourites }: ListStitchesOptions = {}): Stitch[] {
  const q = query?.trim().toLowerCase() ?? '';
  return STITCHES.filter((s) => {
    if (category && category !== 'all' && s.category !== category) return false;
    if (favourites && !favourites.includes(s.id)) return false;
    if (q && ![s.name, ...s.aliases].some((n) => n.toLowerCase().includes(q))) return false;
    return true;
  });
}

const orderText = (keys: ColorKey[] | undefined): string | null =>
  keys
    ? rle(keys)
        .map((x) => `${x.n} ${COLOR_NAMES[x.v]}`)
        .join(', ')
    : null;

/** "4 Color A, 4 Color B": the order to wind the warp in, or null when the warp is one color. */
export const warpOrderText = (stitch: Stitch): string | null => orderText(stitch.warp);

/** The same for the weft, row 1 first, or null when the weft is one color. */
export const weftOrderText = (stitch: Stitch): string | null => orderText(stitch.weft);

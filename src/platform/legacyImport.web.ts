/**
 * Web: read what the old single-file helper saved in localStorage (PLAN.md 3.7).
 * Read-only. The old key is never written or removed.
 */
import { LEGACY_KEY, normalizeLegacy } from '@/store';
import type { LegacyData } from '@/store';

export type { LegacyData };

export function readLegacy(): LegacyData | null {
  try {
    if (typeof localStorage === 'undefined') return null;
    const text = localStorage.getItem(LEGACY_KEY);
    if (!text) return null;
    return normalizeLegacy(JSON.parse(text));
  } catch {
    return null;
  }
}

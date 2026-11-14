import { router } from 'expo-router';

import { autoRows, repWidth, type Structure } from '@/engine';
import type { PictureProject } from '@/store';

import { copy } from './copy';

export type Route = Parameters<typeof router.replace>[0];

/** "6 repeats of 4, clean edges" / "5 repeats of 4, plus 2 extra". The width includes colour repeats. */
export function fitHint(stitch: Structure, warps: number): string {
  const R = repWidth(stitch);
  return warps % R === 0 ? copy.setup.fitClean(warps / R, R) : copy.setup.fitExtra(Math.floor(warps / R), R, warps % R);
}

/** Picture height in rows, or null when the project has no picture yet. */
export function pictureHeight(p: PictureProject): number | null {
  if (!p.imageUri) return null;
  if (p.rows > 0) return p.rows;
  if (p.imageW > 0 && p.imageH > 0) return autoRows(p.warps, p.imageW, p.imageH);
  return null;
}

/** Short local date: "Nov 14", with the year when it is not this year. */
export function shortDate(ms: number, now: number = Date.now()): string {
  const d = new Date(ms);
  const sameYear = d.getFullYear() === new Date(now).getFullYear();
  try {
    return d.toLocaleDateString(undefined, sameYear ? { month: 'short', day: 'numeric' } : { month: 'short', day: 'numeric', year: 'numeric' });
  } catch {
    return d.toDateString();
  }
}

/** `router.back()`, or `fallback` when there is no history (a deep link on web). */
export function backOr(fallback: Route): void {
  if (router.canGoBack()) router.back();
  else router.replace(fallback);
}

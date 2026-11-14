import { useEffect, useState } from 'react';

import { buildPicture, type BuiltPicture } from '@/media';
import { useProjects, type PictureProject } from '@/store';

/** Settings changes are gathered for this long before the grid is rebuilt. */
export const REBUILD_DELAY_MS = 150;

export type PictureGridStatus = 'idle' | 'building' | 'ready' | 'error';

export type PictureGridState = {
  /** The newest grid for this picture. While a rebuild runs it is the previous one. */
  pic: BuiltPicture | null;
  status: PictureGridStatus;
  /** What the last build threw (pass it to `messageFor`), or null. */
  error: unknown;
};

type Done = { key: string; imageUri: string; pic: BuiltPicture | null; error: unknown };

/** Everything that changes the grid. The weave is not here: it only changes how rows are woven. */
function buildKey(p: PictureProject): string {
  return [p.id, p.imageUri,p.imageW, p.imageH, p.warps, p.rows, p.k, p.tidy ? 1 : 0].join('|');
}

/**
 * Builds the picture grid for a picture project, debounced, ignoring stale results.
 * Changing the picture, warps, rows, colors or cleanup rebuilds; changing the weave does not.
 * When a new grid arrives the project's row is clamped to H + 1.
 */
export function usePictureGrid(project: PictureProject | null | undefined): PictureGridState {
  const [done, setDone] = useState<Done | null>(null);

  const id = project?.id ?? null;
  const imageUri = project?.imageUri ?? null;
  const imageW = project?.imageW ?? 0;
  const imageH = project?.imageH ?? 0;
  const warps = project?.warps ?? 0;
  const rows = project?.rows ?? 0;
  const k = project?.k ?? 0;
  const tidy = project?.tidy ?? false;
  const key = project && imageUri ? buildKey(project) : null;

  useEffect(() => {
    if (!id || !imageUri || key === null) return;
    let stale = false;
    const timer = setTimeout(() => {
      buildPicture({ imageUri, imageW, imageH, warps, rows, k, tidy }).then(
        (pic) => {
          if (stale) return;
          setDone({ key, imageUri, pic, error: null });
          useProjects.getState().clampPictureRow(id, pic.H);
        },
        (error: unknown) => {
          if (stale) return;
          setDone({ key, imageUri, pic: null, error: error ?? new Error('build failed') });
        },
      );
    }, REBUILD_DELAY_MS);
    return () => {
      stale = true;
      clearTimeout(timer);
    };
  }, [id, key, imageUri, imageW, imageH, warps, rows, k, tidy]);

  if (!imageUri || key === null) return { pic: null, status: 'idle', error: null };
  // A grid from a different picture is never shown, not even while the new one builds.
  const samePicture = done !== null && done.imageUri === imageUri;
  const pic = samePicture ? done.pic : null;
  if (samePicture && done.key === key) {
    return done.error !== null ? { pic: null, status: 'error', error: done.error } : { pic, status: 'ready', error: null };
  }
  return { pic, status: 'building', error: null };
}

import { PictureError } from './errors';

export const copy = {
  /** Reference wording (reference/web/index.html, `refreshPic` / `handleFile`). */
  unreadable: 'That picture couldn’t be read. Try a JPG or PNG.',
  notImage: 'That file isn’t a picture. Try a JPG or PNG.',
  /** New for phones: the reference has no camera permission. */
  permission: 'Camera access is turned off. Allow it in Settings, or choose a picture from your photo library.',
} as const;

/** The message to show for anything thrown by this module. */
export function messageFor(error: unknown): string {
  if (error instanceof PictureError) {
    if (error.code === 'not-image') return copy.notImage;
    if (error.code === 'permission') return copy.permission;
  }
  return copy.unreadable;
}

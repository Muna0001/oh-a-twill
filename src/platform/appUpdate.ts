/** Shared by `pwa.web.ts`, `pwa.native.ts` and the notice: when the "Updated" notice is due. */

/** localStorage key holding the service worker version the page last ran under. */
export const SW_VERSION_KEY = 'oh-a-twill:sw-version';

/** How long the "Updated" notice stays before it hides itself. */
export const UPDATE_NOTICE_MS = 8000;

/**
 * True when the app now runs a different build from the one it last ran. The first run
 * (nothing stored) and an unknown current version never show the notice.
 */
export function updateNoticeDue(stored: string | null, current: string | null): boolean {
  return !!stored && !!current && stored !== current;
}

export type AppUpdate = {
  /** The app was updated since it last ran; show the "Updated" notice. */
  updated: boolean;
  dismiss: () => void;
};

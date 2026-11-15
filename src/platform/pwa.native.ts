/** iOS and Android: no service worker; store updates are not announced in the app. */
import type { AppUpdate } from './appUpdate';

const none: AppUpdate = { updated: false, dismiss: () => {} };

export function useAppUpdate(): AppUpdate {
  return none;
}

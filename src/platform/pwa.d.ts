/**
 * What `./pwa` exports. Metro picks `pwa.web.ts` (service worker for the installed web app)
 * or `pwa.native.ts` (nothing to do on phones; also what Jest resolves); TypeScript reads this file.
 */
import type { AppUpdate } from './appUpdate';

/**
 * Registers the service worker (production web builds only) and reports, once per new
 * version, that the app was updated. Call it once, near the root.
 */
export declare function useAppUpdate(): AppUpdate;

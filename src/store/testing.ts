/** Helpers for tests. Not used by the app. */
import { whenHydrated } from './hydration';
import { configureProjectFiles, INITIAL_PROJECTS, useProjects } from './projects';
import { INITIAL_SETTINGS, useSettings } from './settings';

/**
 * Test-only: put both stores back to their initial state and clear the file hooks.
 * Waits for any rehydration in flight first, so it cannot land after the reset.
 */
export async function resetStoresForTests(): Promise<void> {
  await whenHydrated();
  configureProjectFiles(null);
  useProjects.setState({ ...INITIAL_PROJECTS, projects: {}, order: [] });
  useSettings.setState({ ...INITIAL_SETTINGS, defaultColors: [...INITIAL_SETTINGS.defaultColors], favourites: [] });
}

/** Read both stores from storage again (tests that pre-seed storage, or simulate a restart). */
export async function rehydrateStores(): Promise<void> {
  await Promise.all([useSettings.persist.rehydrate(), useProjects.persist.rehydrate()]);
  await whenHydrated();
}

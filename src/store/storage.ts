/**
 * AsyncStorage wrapped so that no storage failure can reach the app:
 * a failed read looks like an empty store, a failed write is dropped,
 * and the stores carry on in memory.
 */
import type { AsyncStorageStatic } from '@react-native-async-storage/async-storage';
import { createJSONStorage } from 'zustand/middleware';
import type { StateStorage } from 'zustand/middleware';

export const PROJECTS_KEY = 'oh-a-twill/v1/projects';
export const SETTINGS_KEY = 'oh-a-twill/v1/settings';

let backend: AsyncStorageStatic | null | undefined;

/**
 * Loaded on first use, inside a try: where the native module is missing (a Jest
 * test that does not mock it, for one) importing the package throws, and the
 * stores must still load and run in memory.
 */
function storage(): AsyncStorageStatic {
  if (backend === undefined) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const mod = require('@react-native-async-storage/async-storage');
      backend = (mod?.default ?? mod) as AsyncStorageStatic;
    } catch {
      backend = null;
    }
  }
  if (!backend) throw new Error('AsyncStorage is unavailable');
  return backend;
}

export const safeStorage: StateStorage<Promise<void>> = {
  getItem: async (name) => {
    try {
      return await storage().getItem(name);
    } catch {
      return null;
    }
  },
  setItem: async (name, value) => {
    try {
      await storage().setItem(name, value);
    } catch {
      // Keep working in memory.
    }
  },
  removeItem: async (name) => {
    try {
      await storage().removeItem(name);
    } catch {
      // Keep working in memory.
    }
  },
};

export function jsonStorage<S>() {
  return createJSONStorage<S>(() => safeStorage);
}

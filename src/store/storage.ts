/**
 * AsyncStorage wrapped so that no storage failure can reach the app:
 * a failed read looks like an empty store, a failed write is dropped,
 * and the stores carry on in memory.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createJSONStorage } from 'zustand/middleware';
import type { StateStorage } from 'zustand/middleware';

export const PROJECTS_KEY = 'oh-a-twill/v1/projects';
export const SETTINGS_KEY = 'oh-a-twill/v1/settings';

export const safeStorage: StateStorage<Promise<void>> = {
  getItem: async (name) => {
    try {
      return await AsyncStorage.getItem(name);
    } catch {
      return null;
    }
  },
  setItem: async (name, value) => {
    try {
      await AsyncStorage.setItem(name, value);
    } catch {
      // Keep working in memory.
    }
  },
  removeItem: async (name) => {
    try {
      await AsyncStorage.removeItem(name);
    } catch {
      // Keep working in memory.
    }
  },
};

export function jsonStorage<S>() {
  return createJSONStorage<S>(() => safeStorage);
}

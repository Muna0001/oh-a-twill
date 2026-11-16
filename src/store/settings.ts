import { create } from 'zustand';
import { persist } from 'zustand/middleware';

import { DEFAULTS } from '@/engine/types';

import { setStoreHydrated } from './hydration';
import { isLegacyDefaultColors } from './legacy';
import { jsonStorage, SETTINGS_KEY } from './storage';
import type { Settings } from './types';
import { cleanBool, cleanColors, cleanSide, cleanStringList, clampWarps, isRecord } from './validate';

export const SETTINGS_VERSION = 2;

export const DEFAULT_SETTINGS: Settings = {
  defaultWarps: DEFAULTS.warps,
  defaultSide: DEFAULTS.setup.side,
  defaultColors: [DEFAULTS.colors[0], DEFAULTS.colors[1]],
  haptics: true,
  keepAwake: true,
  theme: 'system',
  favourites: [],
};

/** What is written to storage. */
export interface SettingsData extends Settings {
  /** True once the "bring over your weaving" offer has been accepted or dismissed. */
  legacyImportHandled: boolean;
}

export interface SettingsState extends SettingsData {
  /** Merge a patch. Every field is clamped or validated; bad values keep the current one. */
  set: (patch: Partial<Settings>) => void;
  toggleFavourite: (stitchId: string) => void;
  isFavourite: (stitchId: string) => boolean;
  setLegacyImportHandled: (handled?: boolean) => void;
}

function cleanTheme(v: unknown, fallback: Settings['theme']): Settings['theme'] {
  return v === 'system' || v === 'light' || v === 'dark' ? v : fallback;
}

/** Validate the fields present in `raw`, falling back to `base` for the rest. */
export function sanitizeSettings(raw: unknown, base: SettingsData): SettingsData {
  const r = isRecord(raw) ? raw : {};
  return {
    defaultWarps: clampWarps(r.defaultWarps, base.defaultWarps),
    defaultSide: cleanSide(r.defaultSide, base.defaultSide),
    defaultColors: cleanColors(r.defaultColors, base.defaultColors),
    haptics: cleanBool(r.haptics, base.haptics),
    keepAwake: cleanBool(r.keepAwake, base.keepAwake),
    theme: cleanTheme(r.theme, base.theme),
    favourites: r.favourites !== undefined ? cleanStringList(r.favourites) : base.favourites,
    legacyImportHandled: cleanBool(r.legacyImportHandled, base.legacyImportHandled),
  };
}

/**
 * Reshape older saved settings into the current shape. Validation happens in `merge`.
 * v0 (pre-release builds) spelled `favourites` as `favorites`.
 * v1 → v2: the default yarn colours changed; a stored pair that is exactly the old default
 * (any letter case) becomes the new default. Any other choice is the person's and stays.
 */
export function migrateSettings(persisted: unknown, version: number): SettingsData {
  const state: Record<string, unknown> = isRecord(persisted) ? { ...persisted } : {};
  if (version < 1) {
    if (!('favourites' in state) && 'favorites' in state) state.favourites = state.favorites;
    delete state.favorites;
  }
  if (version < 2) {
    if (isLegacyDefaultColors(state.defaultColors)) {
      state.defaultColors = [DEFAULTS.colors[0], DEFAULTS.colors[1]];
    }
  }
  return state as unknown as SettingsData;
}

function data(s: SettingsData): SettingsData {
  return {
    defaultWarps: s.defaultWarps,
    defaultSide: s.defaultSide,
    defaultColors: s.defaultColors,
    haptics: s.haptics,
    keepAwake: s.keepAwake,
    theme: s.theme,
    favourites: s.favourites,
    legacyImportHandled: s.legacyImportHandled,
  };
}

export const INITIAL_SETTINGS: SettingsData = { ...DEFAULT_SETTINGS, legacyImportHandled: false };

export const useSettings = create<SettingsState>()(
  persist(
    (set, get) => ({
      ...INITIAL_SETTINGS,
      set: (patch) => set((s) => sanitizeSettings(patch, data(s))),
      toggleFavourite: (stitchId) => {
        if (typeof stitchId !== 'string' || stitchId === '') return;
        set((s) => ({
          favourites: s.favourites.includes(stitchId)
            ? s.favourites.filter((id) => id !== stitchId)
            : [...s.favourites, stitchId],
        }));
      },
      isFavourite: (stitchId) => get().favourites.includes(stitchId),
      setLegacyImportHandled: (handled = true) => set({ legacyImportHandled: handled }),
    }),
    {
      name: SETTINGS_KEY,
      version: SETTINGS_VERSION,
      storage: jsonStorage<SettingsData>(),
      partialize: (s) => data(s),
      migrate: migrateSettings,
      merge: (persisted, current) =>
        persisted === undefined ? current : { ...current, ...sanitizeSettings(persisted, INITIAL_SETTINGS) },
      onRehydrateStorage: () => {
        setStoreHydrated('settings', false);
        return () => setStoreHydrated('settings', true);
      },
    },
  ),
);

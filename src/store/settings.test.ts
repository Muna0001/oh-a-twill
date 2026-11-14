import AsyncStorage from '@react-native-async-storage/async-storage';
import { act, renderHook } from '@testing-library/react-native';

import {
  DEFAULT_SETTINGS,
  isHydrated,
  rehydrateStores,
  resetStoresForTests,
  SETTINGS_KEY,
  useHydrated,
  useSettings,
} from './index';

jest.mock('@react-native-async-storage/async-storage', () =>
  jest.requireActual('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

const S = () => useSettings.getState();
const flush = () => new Promise((r) => setTimeout(r, 0));

beforeEach(async () => {
  await resetStoresForTests();
  await flush();
  await AsyncStorage.clear();
  jest.clearAllMocks();
});

describe('useSettings', () => {
  it('starts with the defaults', () => {
    expect(S()).toMatchObject({
      defaultWarps: 24,
      defaultSide: 'left',
      defaultColors: ['#2E4C8F', '#E4DCC8'],
      haptics: true,
      keepAwake: true,
      theme: 'system',
      favourites: [],
      legacyImportHandled: false,
    });
    expect(S()).toMatchObject(DEFAULT_SETTINGS);
  });

  it('set merges a patch', () => {
    S().set({ defaultWarps: 36, theme: 'dark', haptics: false });
    expect(S()).toMatchObject({ defaultWarps: 36, theme: 'dark', haptics: false, keepAwake: true, defaultSide: 'left' });
    S().set({ defaultSide: 'right', keepAwake: false, defaultColors: ['#000000', '#FFFFFF'], favourites: ['plain', 'plain', 'hounds'] });
    expect(S()).toMatchObject({
      defaultSide: 'right',
      keepAwake: false,
      defaultColors: ['#000000', '#FFFFFF'],
      favourites: ['plain', 'hounds'],
      defaultWarps: 36,
    });
  });

  it('set clamps and ignores bad values', () => {
    S().set({ defaultWarps: 2 });
    expect(S().defaultWarps).toBe(4);
    S().set({ defaultWarps: 1000 });
    expect(S().defaultWarps).toBe(120);
    S().set({
      defaultWarps: NaN,
      theme: 'pink' as never,
      defaultSide: 'top' as never,
      defaultColors: ['red', 'blue'],
      haptics: 'yes' as never,
    });
    expect(S()).toMatchObject({
      defaultWarps: 120,
      theme: 'system',
      defaultSide: 'left',
      defaultColors: ['#2E4C8F', '#E4DCC8'],
      haptics: true,
    });
    expect(typeof S().set).toBe('function');
  });

  it('toggles favourites', () => {
    expect(S().isFavourite('twill22')).toBe(false);
    S().toggleFavourite('twill22');
    S().toggleFavourite('plain');
    expect(S().favourites).toEqual(['twill22', 'plain']);
    expect(S().isFavourite('twill22')).toBe(true);
    S().toggleFavourite('twill22');
    expect(S().favourites).toEqual(['plain']);
    expect(S().isFavourite('twill22')).toBe(false);
  });

  it('remembers that the legacy import was handled', () => {
    S().setLegacyImportHandled();
    expect(S().legacyImportHandled).toBe(true);
    S().setLegacyImportHandled(false);
    expect(S().legacyImportHandled).toBe(false);
  });
});

describe('persistence', () => {
  it('writes under the settings key and survives a restart', async () => {
    S().set({ defaultWarps: 40, theme: 'light' });
    S().toggleFavourite('chevron');
    S().setLegacyImportHandled();
    await flush();
    const stored = (await AsyncStorage.getItem(SETTINGS_KEY))!;
    const saved = JSON.parse(stored);
    expect(saved.version).toBe(1);
    expect(saved.state).toEqual({
      defaultWarps: 40,
      defaultSide: 'left',
      defaultColors: ['#2E4C8F', '#E4DCC8'],
      haptics: true,
      keepAwake: true,
      theme: 'light',
      favourites: ['chevron'],
      legacyImportHandled: true,
    });

    await resetStoresForTests();
    await flush();
    expect(S().defaultWarps).toBe(24);
    await AsyncStorage.setItem(SETTINGS_KEY, stored);
    await rehydrateStores();
    expect(S()).toMatchObject(saved.state);
    S().toggleFavourite('plain');
    expect(S().favourites).toEqual(['chevron', 'plain']);
  });

  it('cleans up damaged saved settings', async () => {
    await AsyncStorage.setItem(
      SETTINGS_KEY,
      JSON.stringify({ version: 1, state: { defaultWarps: 9999, theme: 7, favourites: 'plain', keepAwake: false, extra: 1 } }),
    );
    await rehydrateStores();
    expect(S()).toMatchObject({ defaultWarps: 120, theme: 'system', favourites: [], keepAwake: false, haptics: true });
    expect('extra' in S()).toBe(false);
  });

  it('migrates v0, which spelled favourites differently', async () => {
    await AsyncStorage.setItem(
      SETTINGS_KEY,
      JSON.stringify({ version: 0, state: { defaultWarps: 30, favorites: ['diamond'] } }),
    );
    await rehydrateStores();
    expect(S()).toMatchObject({ defaultWarps: 30, favourites: ['diamond'], legacyImportHandled: false, theme: 'system' });
    await flush();
    const saved = JSON.parse((await AsyncStorage.getItem(SETTINGS_KEY))!);
    expect(saved.version).toBe(1);
    expect(saved.state.favourites).toEqual(['diamond']);
    expect('favorites' in saved.state).toBe(false);
  });

  it('keeps working in memory when storage throws', async () => {
    const realSet = (AsyncStorage.setItem as jest.Mock).getMockImplementation()!;
    const realGet = (AsyncStorage.getItem as jest.Mock).getMockImplementation()!;
    (AsyncStorage.setItem as jest.Mock).mockRejectedValue(new Error('quota'));
    (AsyncStorage.getItem as jest.Mock).mockImplementation(() => {
      throw new Error('denied');
    });
    try {
      await rehydrateStores();
      expect(isHydrated()).toBe(true);
      S().set({ defaultWarps: 48 });
      S().toggleFavourite('plain');
      await flush();
      expect(S()).toMatchObject({ defaultWarps: 48, favourites: ['plain'] });
    } finally {
      (AsyncStorage.setItem as jest.Mock).mockImplementation(realSet);
      (AsyncStorage.getItem as jest.Mock).mockImplementation(realGet);
    }
  });
});

describe('useHydrated', () => {
  it('is false while the stores are reading and true afterwards', async () => {
    const { result } = await renderHook(() => useHydrated());
    expect(result.current).toBe(true);
    let done!: Promise<void>;
    await act(async () => {
      done = rehydrateStores();
    });
    await act(async () => {
      await done;
    });
    expect(result.current).toBe(true);
  });

  it('goes false as soon as a rehydration starts', async () => {
    const seen: boolean[] = [];
    const pending = rehydrateStores();
    seen.push(isHydrated());
    await pending;
    seen.push(isHydrated());
    expect(seen).toEqual([false, true]);
  });

  it('becomes true even when the saved state cannot be read', async () => {
    await AsyncStorage.setItem(SETTINGS_KEY, 'not json');
    await rehydrateStores();
    expect(isHydrated()).toBe(true);
    expect(S().defaultWarps).toBe(24);
  });
});

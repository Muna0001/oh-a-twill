/** Tracks whether the persisted stores have finished reading from storage. */
import { useSyncExternalStore } from 'react';

export type StoreName = 'projects' | 'settings';

const done: Record<StoreName, boolean> = { projects: false, settings: false };
const listeners = new Set<() => void>();

export function setStoreHydrated(name: StoreName, value: boolean): void {
  if (done[name] === value) return;
  done[name] = value;
  listeners.forEach((fn) => fn());
}

/** True once both stores have rehydrated (or failed to, and carried on in memory). */
export function isHydrated(): boolean {
  return done.projects && done.settings;
}

function subscribe(fn: () => void): () => void {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

/** Screens wait for this before reading projects or settings. */
export function useHydrated(): boolean {
  return useSyncExternalStore(subscribe, isHydrated, () => false);
}

/** Resolves once both stores have rehydrated. */
export function whenHydrated(): Promise<void> {
  if (isHydrated()) return Promise.resolve();
  return new Promise((resolve) => {
    const off = subscribe(() => {
      if (!isHydrated()) return;
      off();
      resolve();
    });
  });
}

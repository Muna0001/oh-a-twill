/** Web: Wake Lock API, arrow keys, `window.confirm`. Haptics are a no-op. */
import { useEffect } from 'react';

import { rowKeyFor } from './keys';
import type { DeviceApi } from './types';

export const tapHaptic: DeviceApi['tapHaptic'] = () => {};

type WakeLockLike = { released?: boolean; release: () => Promise<void> };
type WakeLockApi = { request: (type: 'screen') => Promise<WakeLockLike> };

function wakeLockApi(): WakeLockApi | null {
  try {
    const nav = typeof navigator === 'undefined' ? undefined : (navigator as { wakeLock?: WakeLockApi });
    return nav?.wakeLock && typeof nav.wakeLock.request === 'function' ? nav.wakeLock : null;
  } catch {
    return null;
  }
}

const doc = (): Document | null => (typeof document === 'undefined' ? null : document);

function release(lock: WakeLockLike | null) {
  if (!lock) return;
  try {
    lock.release().catch(() => {});
  } catch {
    // Already released.
  }
}

/**
 * Holds a screen wake lock while enabled. The browser drops the lock when the tab is hidden,
 * so it is asked for again when the page becomes visible.
 */
export const useKeepAwake: DeviceApi['useKeepAwake'] = (enabled) => {
  useEffect(() => {
    const api = wakeLockApi();
    const d = doc();
    if (!enabled || !api) return;
    let active = true;
    let lock: WakeLockLike | null = null;
    let pending = false;

    const acquire = async () => {
      if (!active || pending || (lock && !lock.released)) return;
      if (d && d.visibilityState && d.visibilityState !== 'visible') return;
      pending = true;
      try {
        const next = await api.request('screen');
        if (active) lock = next;
        else release(next);
      } catch {
        // Refused (no user gesture yet, battery saver, unsupported): try again on the next visit.
      } finally {
        pending = false;
      }
    };
    const onVisibility = () => {
      if (!d || d.visibilityState === 'visible') void acquire();
    };

    void acquire();
    try {
      d?.addEventListener('visibilitychange', onVisibility);
    } catch {
      // No events: keep whatever lock we got.
    }
    return () => {
      active = false;
      try {
        d?.removeEventListener('visibilitychange', onVisibility);
      } catch {
        // Nothing to remove.
      }
      release(lock);
      lock = null;
    };
  }, [enabled]);
};

export const useRowKeys: DeviceApi['useRowKeys'] = (onPrev, onNext, enabled = true) => {
  useEffect(() => {
    const d = doc();
    if (!enabled || !d) return;
    const onKey = (e: Event) => {
      const which = rowKeyFor(e as KeyboardEvent);
      if (!which) return;
      e.preventDefault();
      if (which === 'prev') onPrev();
      else onNext();
    };
    d.addEventListener('keydown', onKey);
    return () => d.removeEventListener('keydown', onKey);
  }, [onPrev, onNext, enabled]);
};

export const confirmAsync: DeviceApi['confirmAsync'] = async ({ title, message }) => {
  try {
    if (typeof window === 'undefined' || typeof window.confirm !== 'function') return true;
    return window.confirm(message ? `${title}\n\n${message}` : title);
  } catch {
    return false;
  }
};

export const scrollIntoView: DeviceApi['scrollIntoView'] = (target) => {
  try {
    const el = target as { scrollIntoView?: (options?: ScrollIntoViewOptions) => void } | null;
    el?.scrollIntoView?.({ block: 'nearest', behavior: 'smooth' });
  } catch {
    // Not an element: nothing to scroll.
  }
};

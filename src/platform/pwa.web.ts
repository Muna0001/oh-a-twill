/**
 * Web: register the service worker built by `scripts/export-web.mjs` (production exports only,
 * never under `expo start`), and say "Updated" once when a new version has taken over.
 *
 * A new version installs in the background and takes over on the next launch (the worker does
 * not skip waiting). The page asks the controlling worker for its version and compares it with
 * the one it last ran under; a difference means the app was updated.
 */
import { useCallback, useEffect, useState } from 'react';

import { SW_VERSION_KEY, updateNoticeDue, UPDATE_NOTICE_MS, type AppUpdate } from './appUpdate';

/** The export's base path ('' at the root, '/oh-a-twill' on GitHub Pages), inlined by Expo. */
const BASE_URL = (process.env.EXPO_BASE_URL ?? '').replace(/\/+$/, '');

function readStored(): string | null {
  try {
    return globalThis.localStorage?.getItem(SW_VERSION_KEY) ?? null;
  } catch {
    return null;
  }
}

function writeStored(version: string) {
  try {
    globalThis.localStorage?.setItem(SW_VERSION_KEY, version);
  } catch {
    // Storage blocked: the notice just will not show.
  }
}

/** Ask the worker that controls this page for its version. */
function askVersion(container: ServiceWorkerContainer): Promise<string | null> {
  const worker = container.controller;
  if (!worker || typeof MessageChannel === 'undefined') return Promise.resolve(null);
  return new Promise((resolve) => {
    const channel = new MessageChannel();
    const timer = setTimeout(() => resolve(null), 3000);
    channel.port1.onmessage = (event) => {
      clearTimeout(timer);
      resolve(typeof event.data === 'string' ? event.data : null);
    };
    worker.postMessage('version', [channel.port2]);
  });
}

export function useAppUpdate(): AppUpdate {
  const [updated, setUpdated] = useState(false);
  const dismiss = useCallback(() => setUpdated(false), []);

  useEffect(() => {
    if (__DEV__) return;
    const container = typeof navigator === 'undefined' ? undefined : navigator.serviceWorker;
    if (!container) return;
    let live = true;

    const check = async () => {
      const current = await askVersion(container);
      if (!live || !current) return;
      if (updateNoticeDue(readStored(), current)) setUpdated(true);
      writeStored(current);
    };

    container.addEventListener('controllerchange', check);
    container.register(`${BASE_URL}/sw.js`, { scope: `${BASE_URL}/` }).catch(() => {
      // Unsupported or blocked (private mode, file://): the app still works online.
    });
    check();
    return () => {
      live = false;
      container.removeEventListener('controllerchange', check);
    };
  }, []);

  useEffect(() => {
    if (!updated) return;
    const id = setTimeout(() => setUpdated(false), UPDATE_NOTICE_MS);
    return () => clearTimeout(id);
  }, [updated]);

  return { updated, dismiss };
}

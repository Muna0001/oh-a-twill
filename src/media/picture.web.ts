/**
 * Picture import for the web. Follows `handleFile` and `processPic` in
 * reference/web/index.html: paint on white, store a JPEG, then sample by
 * drawing onto a canvas 4x the grid size and averaging 4 x 4 blocks.
 *
 * Differences from the reference, both from PLAN.md: the stored picture is up
 * to 1024 px on the long side (the reference kept 320), and it lives in
 * IndexedDB as a blob (`uri` = `idb:<id>`) instead of a data URL in localStorage.
 */
import { boxAverage } from '@/engine/picture';

import { guarded, isImageType, PictureError } from './errors';
import {
  createBuilder,
  createSampler,
  fitWithin,
  JPEG_QUALITY,
  MAX_STORED_SIDE,
  newPictureId,
  parseImageDataUrl,
  SAMPLE_FACTOR,
} from './shared';
import type { MediaApi, PickedPicture, PickSource } from './types';

const SCHEME = 'idb:';
const DB_NAME = 'oh-a-twill';
const STORE = 'pictures';

/* ---------- Storage: IndexedDB, or memory when it is unavailable ---------- */

const memory = new Map<string, Blob>();
let dbPromise: Promise<IDBDatabase | null> | null = null;
let askedToPersist = false;

function openDb(): Promise<IDBDatabase | null> {
  dbPromise ??= new Promise<IDBDatabase | null>((resolve) => {
    try {
      if (typeof indexedDB === 'undefined' || !indexedDB) return resolve(null);
      const request = indexedDB.open(DB_NAME, 1);
      request.onupgradeneeded = () => {
        if (!request.result.objectStoreNames.contains(STORE)) request.result.createObjectStore(STORE);
      };
      request.onsuccess = () => {
        const db = request.result;
        // Another tab upgrading or deleting the database: let go and reopen on the next call.
        db.onversionchange = () => {
          db.close();
          dbPromise = null;
        };
        resolve(db);
      };
      request.onerror = () => resolve(null);
      request.onblocked = () => resolve(null);
    } catch {
      // Private browsing in some browsers, or storage turned off.
      resolve(null);
    }
  });
  return dbPromise;
}

function run<T>(db: IDBDatabase, mode: IDBTransactionMode, work: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const tx = db.transaction(STORE, mode);
    const request = work(tx.objectStore(STORE));
    tx.oncomplete = () => resolve(request.result);
    tx.onerror = () => reject(tx.error ?? request.error);
    tx.onabort = () => reject(tx.error ?? request.error);
  });
}

/** Asks the browser, once, not to evict our storage. Never fails. */
function askToPersist(): void {
  if (askedToPersist) return;
  askedToPersist = true;
  try {
    navigator.storage
      ?.persist?.()
      ?.catch(() => {});
  } catch {
    // Not supported; pictures are still stored, just not protected from eviction.
  }
}

async function putBlob(id: string, blob: Blob): Promise<void> {
  const db = await openDb();
  if (db) {
    try {
      await run(db, 'readwrite', (store) => store.put(blob, id));
      askToPersist();
      return;
    } catch {
      // Quota or a broken database: keep the picture for this session at least.
    }
  }
  memory.set(id, blob);
}

async function getBlob(id: string): Promise<Blob | null> {
  const held = memory.get(id);
  if (held) return held;
  const db = await openDb();
  if (!db) return null;
  const value: unknown = await run(db, 'readonly', (store) => store.get(id));
  return value instanceof Blob ? value : null;
}

async function removeBlob(id: string): Promise<void> {
  memory.delete(id);
  const db = await openDb();
  if (db) await run(db, 'readwrite', (store) => store.delete(id));
}

function idOf(uri: string): string | null {
  return uri.startsWith(SCHEME) ? uri.slice(SCHEME.length) : null;
}

/** The stored blob for `idb:` URIs. Other URIs (data:, blob:, same-origin paths) are fetched. */
async function blobFor(uri: string): Promise<Blob> {
  const id = idOf(uri);
  if (id !== null) {
    const blob = await getBlob(id);
    if (!blob) throw new PictureError('unreadable');
    return blob;
  }
  if (uri.startsWith('data:')) {
    const { mime, bytes } = parseImageDataUrl(uri);
    return new Blob([bytes], { type: mime });
  }
  const response = await fetch(uri);
  if (!response.ok) throw new PictureError('unreadable');
  return response.blob();
}

/* ---------- Decoding and drawing ---------- */

interface Decoded {
  source: CanvasImageSource;
  width: number;
  height: number;
  close(): void;
}

/** An `<img>`, as the reference uses. Browsers apply the EXIF orientation to it by default. */
function decodeWithImage(blob: Blob): Promise<Decoded> {
  return new Promise<Decoded>((resolve, reject) => {
    const url = URL.createObjectURL(blob);
    const img = new Image();
    img.onload = () => {
      const width = img.naturalWidth || img.width;
      const height = img.naturalHeight || img.height;
      if (!width || !height) {
        URL.revokeObjectURL(url);
        reject(new PictureError('unreadable'));
        return;
      }
      resolve({ source: img, width, height, close: () => URL.revokeObjectURL(url) });
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new PictureError('unreadable'));
    };
    img.src = url;
  });
}

async function decodeWithBitmap(blob: Blob): Promise<Decoded> {
  const bitmap = await createImageBitmap(blob, { imageOrientation: 'from-image' });
  return { source: bitmap, width: bitmap.width, height: bitmap.height, close: () => bitmap.close() };
}

/** `prefer` picks which decoder to try first; the other is the fallback. */
async function decode(blob: Blob, prefer: 'bitmap' | 'image'): Promise<Decoded> {
  const hasBitmap = typeof createImageBitmap === 'function';
  const order = prefer === 'bitmap' && hasBitmap ? [decodeWithBitmap, decodeWithImage] : hasBitmap ? [decodeWithImage, decodeWithBitmap] : [decodeWithImage];
  let lastError: unknown;
  for (const attempt of order) {
    try {
      return await attempt(blob);
    } catch (error) {
      lastError = error;
    }
  }
  throw new PictureError('unreadable', lastError);
}

function makeCanvas(width: number, height: number): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  return canvas;
}

function canvasToJpeg(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new PictureError('unreadable'))), 'image/jpeg', JPEG_QUALITY);
  });
}

/* ---------- Import ---------- */

async function importPictureFile(file: Blob): Promise<PickedPicture> {
  return guarded(async () => {
    if (!file || !isImageType(file.type)) throw new PictureError('not-image');
    const decoded = await decode(file, 'bitmap');
    let stored: Blob;
    let width: number;
    let height: number;
    try {
      const fit = fitWithin(decoded.width, decoded.height, MAX_STORED_SIDE);
      width = fit.width;
      height = fit.height;
      if (fit.scale === 1 && file.type.toLowerCase() === 'image/jpeg') {
        // Already a small JPEG (the old web app's saved picture, say): keep the
        // bytes rather than compressing a second time.
        stored = file.slice(0, file.size, 'image/jpeg');
      } else {
        const canvas = makeCanvas(width, height);
        const ctx = canvas.getContext('2d');
        if (!ctx) throw new PictureError('unreadable');
        ctx.fillStyle = '#fff';
        ctx.fillRect(0, 0, width, height);
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(decoded.source, 0, 0, width, height);
        stored = await canvasToJpeg(canvas);
      }
    } finally {
      decoded.close();
    }
    const id = newPictureId();
    await putBlob(id, stored);
    return { uri: SCHEME + id, width, height };
  });
}

async function importPictureDataUrl(dataUrl: string): Promise<PickedPicture> {
  return guarded(async () => {
    const { mime, bytes } = parseImageDataUrl(dataUrl);
    return importPictureFile(new Blob([bytes], { type: mime }));
  });
}

/** How long after the window regains focus to decide that the file dialog was cancelled. */
const FOCUS_CANCEL_MS = 2000;

/**
 * Opens the browser's file dialog. `source` is ignored: on a phone browser the
 * dialog already offers the camera. Must be called from a click or key handler.
 */
function pickPicture(_source: PickSource): Promise<PickedPicture | null> {
  return new Promise<PickedPicture | null>((resolve, reject) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.hidden = true;
    input.style.display = 'none';
    input.tabIndex = -1;
    input.setAttribute('aria-hidden', 'true');
    input.setAttribute('data-testid', 'picture-file-input');

    let settled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const finish = () => {
      settled = true;
      if (timer !== undefined) clearTimeout(timer);
      window.removeEventListener('focus', onFocus);
      input.remove();
    };
    const cancel = () => {
      if (settled) return;
      finish();
      resolve(null);
    };
    // Older browsers do not fire `cancel` on file inputs. There the only sign
    // is the window getting focus back with no file chosen.
    const onFocus = () => {
      if (timer !== undefined) clearTimeout(timer);
      timer = setTimeout(() => {
        if (!input.files || input.files.length === 0) cancel();
      }, FOCUS_CANCEL_MS);
    };

    input.addEventListener('change', () => {
      if (settled) return;
      const file = input.files?.[0];
      finish();
      if (!file) resolve(null);
      else importPictureFile(file).then(resolve, reject);
    });
    input.addEventListener('cancel', cancel);
    window.addEventListener('focus', onFocus);

    document.body.appendChild(input);
    input.click();
  });
}

/* ---------- Sampling ---------- */

/** The first half of `processPic`: draw at 4x on white, read the pixels, average 4 x 4 blocks. */
async function readSamples(uri: string, W: number, H: number): Promise<Float32Array> {
  const decoded = await decode(await blobFor(uri), 'image');
  try {
    const cw = W * SAMPLE_FACTOR;
    const ch = H * SAMPLE_FACTOR;
    const canvas = makeCanvas(cw, ch);
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) throw new PictureError('unreadable');
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, cw, ch);
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(decoded.source, 0, 0, cw, ch);
    return boxAverage(ctx.getImageData(0, 0, cw, ch).data, cw, ch, SAMPLE_FACTOR);
  } finally {
    decoded.close();
  }
}

const sampler = createSampler(readSamples);
const samplePicture = sampler.samplePicture;
const buildPicture = createBuilder(samplePicture);

/* ---------- Thumbnails and deletion ---------- */

const objectUrls = new Map<string, Promise<string>>();

/** An object URL for a stored picture, made once per picture and revoked by `deletePicture`. */
function thumbnailSource(uri: string): Promise<string> {
  const id = idOf(uri);
  if (id === null) return Promise.resolve(uri);
  let pending = objectUrls.get(id);
  if (!pending) {
    pending = guarded(async () => URL.createObjectURL(await blobFor(uri)));
    objectUrls.set(id, pending);
    pending.catch(() => objectUrls.delete(id));
  }
  return pending;
}

async function deletePicture(uri: string): Promise<void> {
  sampler.forget(uri);
  const id = idOf(uri);
  if (id === null) return;
  const pending = objectUrls.get(id);
  objectUrls.delete(id);
  pending?.then((url) => URL.revokeObjectURL(url)).catch(() => {});
  try {
    await removeBlob(id);
  } catch {
    // Nothing useful to tell the user: the project is going away anyway.
  }
}

export { buildPicture, deletePicture, importPictureDataUrl, importPictureFile, pickPicture, samplePicture, thumbnailSource };

// Compile-time check that this file implements the whole interface.
({ buildPicture, deletePicture, importPictureDataUrl, importPictureFile, pickPicture, samplePicture, thumbnailSource }) satisfies MediaApi;

import { autoRows, quantize } from '@/engine/picture';
import { LIMITS } from '@/engine/types';

import { guarded, PictureError } from './errors';
import type { BuildPictureParams, BuiltPicture } from './types';

/** The reference samples the picture at 4x the grid and averages 4 x 4 blocks. */
export const SAMPLE_FACTOR = 4;
/** Stored pictures are at most this many pixels on the long side. */
export const MAX_STORED_SIDE = 1024;
export const JPEG_QUALITY = 0.9;
export const SAMPLE_CACHE_SIZE = 4;

/** A small least-recently-used cache. */
export class LruCache<V> {
  private readonly map = new Map<string, V>();

  constructor(private readonly limit: number) {}

  get(key: string): V | undefined {
    const value = this.map.get(key);
    if (value === undefined) return undefined;
    this.map.delete(key);
    this.map.set(key, value);
    return value;
  }

  set(key: string, value: V): void {
    this.map.delete(key);
    this.map.set(key, value);
    while (this.map.size > this.limit) {
      const oldest = this.map.keys().next();
      if (oldest.done) break;
      this.map.delete(oldest.value);
    }
  }

  delete(key: string): void {
    this.map.delete(key);
  }

  deleteWhere(match: (key: string) => boolean): void {
    for (const key of [...this.map.keys()]) if (match(key)) this.map.delete(key);
  }

  clear(): void {
    this.map.clear();
  }

  get size(): number {
    return this.map.size;
  }
}

function sampleKey(uri: string, W: number, H: number): string {
  return `${W}x${H}|${uri}`;
}

/**
 * Wraps a platform sampler with the (uri, W, H) cache, so changing k or tidy
 * does not read the image again. Concurrent calls share one read. Failures
 * are not cached and come out as PictureError.
 */
export function createSampler(read: (uri: string, W: number, H: number) => Promise<Float32Array>) {
  const cache = new LruCache<Promise<Float32Array>>(SAMPLE_CACHE_SIZE);

  function samplePicture(uri: string, W: number, H: number): Promise<Float32Array> {
    const key = sampleKey(uri, W, H);
    const hit = cache.get(key);
    if (hit) return hit;
    const pending = guarded(async () => {
      if (!uri || !Number.isInteger(W) || !Number.isInteger(H) || W < 1 || H < 1) throw new PictureError('unreadable');
      const px = await read(uri, W, H);
      if (px.length !== W * H * 3) throw new PictureError('unreadable');
      return px;
    });
    cache.set(key, pending);
    pending.catch(() => {
      if (cache.get(key) === pending) cache.delete(key);
    });
    return pending;
  }

  function forget(uri: string): void {
    cache.deleteWhere((key) => key.endsWith(`|${uri}`));
  }

  return { samplePicture, forget, clear: () => cache.clear() };
}

/** Lets the UI paint (a spinner, say) before a long synchronous step. */
export function nextMacrotask(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}

/** Grid height: the chosen row count, or the picture's shape when `rows` is 0. */
export function resolveRows(p: Pick<BuildPictureParams, 'imageW' | 'imageH' | 'warps' | 'rows'>): { H: number; autoH: number } {
  const { min, max } = LIMITS.rows;
  const autoH = clamp(autoRows(p.warps, p.imageW, p.imageH), min, max);
  const H = p.rows ? clamp(Math.round(p.rows), min, max) : autoH;
  return { H, autoH };
}

/** samplePicture, then quantize: the same steps as `processPic` in the reference. */
export function createBuilder(samplePicture: (uri: string, W: number, H: number) => Promise<Float32Array>) {
  return function buildPicture(p: BuildPictureParams): Promise<BuiltPicture> {
    return guarded(async () => {
      const W = Math.round(p.warps);
      if (!p.imageUri || !(W >= 1) || !(p.imageW > 0) || !(p.imageH > 0)) throw new PictureError('unreadable');
      const { H, autoH } = resolveRows({ ...p, warps: W });
      const px = await samplePicture(p.imageUri, W, H);
      await nextMacrotask();
      return { ...quantize(px, W, H, p.k, p.tidy), autoH };
    });
  };
}

/** Longest side scaled down to `max`; never scaled up. Mirrors the reference's rounding. */
export function fitWithin(width: number, height: number, max: number): { width: number; height: number; scale: number } {
  const scale = Math.min(1, max / Math.max(width, height));
  return { width: Math.max(1, Math.round(width * scale)), height: Math.max(1, Math.round(height * scale)), scale };
}

let idCounter = 0;

/** A new id for a stored picture: sortable by time, safe in file names and URIs. */
export function newPictureId(now: number = Date.now(), random: () => number = Math.random): string {
  idCounter = (idCounter + 1) % 1296;
  const rand = Math.floor(random() * 36 ** 6)
    .toString(36)
    .padStart(6, '0');
  return `p${now.toString(36)}${idCounter.toString(36).padStart(2, '0')}${rand}`;
}

export interface ParsedDataUrl {
  mime: string;
  bytes: Uint8Array<ArrayBuffer>;
}

const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
let b64Lookup: Int16Array | null = null;

/** Base64 to bytes without relying on `atob` or `Buffer`. Throws on invalid input. */
export function base64ToBytes(base64: string): Uint8Array<ArrayBuffer> {
  if (!b64Lookup) {
    b64Lookup = new Int16Array(128).fill(-1);
    for (let i = 0; i < B64.length; i++) b64Lookup[B64.charCodeAt(i)] = i;
    b64Lookup['-'.charCodeAt(0)] = 62;
    b64Lookup['_'.charCodeAt(0)] = 63;
  }
  const s = base64.replace(/[\s=]+/g, '');
  if (s.length % 4 === 1) throw new Error('Invalid base64 length');
  const out = new Uint8Array(Math.floor((s.length * 3) / 4));
  let o = 0;
  let acc = 0;
  let bits = 0;
  for (let i = 0; i < s.length; i++) {
    const code = s.charCodeAt(i);
    const v = code < 128 ? b64Lookup[code] : -1;
    if (v < 0) throw new Error('Invalid base64 character');
    acc = (acc << 6) | v;
    bits += 6;
    if (bits >= 8) {
      bits -= 8;
      out[o++] = (acc >> bits) & 0xff;
    }
  }
  return out;
}

/** Splits a base64 `data:` URL. Throws 'not-image' for other types, 'unreadable' when malformed. */
export function parseImageDataUrl(dataUrl: string): ParsedDataUrl {
  const m = /^data:([^;,]*)((?:;[^;,]*)*),/i.exec(dataUrl);
  if (!m) throw new PictureError('unreadable');
  const mime = m[1].trim().toLowerCase();
  if (!mime.startsWith('image/')) throw new PictureError('not-image');
  if (!/;base64$/i.test(m[2])) throw new PictureError('unreadable');
  try {
    return { mime, bytes: base64ToBytes(dataUrl.slice(m[0].length)) };
  } catch (error) {
    throw new PictureError('unreadable', error);
  }
}

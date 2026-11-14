/**
 * In-memory stand-ins for expo-file-system, expo-image-manipulator and
 * expo-image-picker, for Jest. Only what `picture.native.ts` uses.
 * The "manipulator" really decodes and re-encodes PNGs (nearest-neighbour
 * resize), so the pipeline can be run end to end on a real picture.
 */
import { encode } from 'fast-png';

import { decodePngToRgba, type RgbaImage } from './png';

export const files = new Map<string, Uint8Array>();
let counter = 0;

function join(parts: (string | { uri: string })[]): string {
  return parts
    .map((p) => (typeof p === 'string' ? p : p.uri))
    .map((p, i) => (i === 0 ? p.replace(/\/+$/, '') : p.replace(/^\/+|\/+$/g, '')))
    .join('/');
}

class MockFile {
  uri: string;
  constructor(...parts: (string | { uri: string })[]) {
    this.uri = join(parts);
  }
  get exists(): boolean {
    return files.has(this.uri);
  }
  create(): void {
    files.set(this.uri, new Uint8Array(0));
  }
  async write(content: Uint8Array): Promise<void> {
    files.set(this.uri, content);
  }
  async move(destination: { uri: string }): Promise<void> {
    const bytes = files.get(this.uri);
    if (!bytes) throw new Error(`move: no file at ${this.uri}`);
    files.delete(this.uri);
    files.set(destination.uri, bytes);
    this.uri = destination.uri;
  }
  delete(): void {
    if (!files.delete(this.uri)) throw new Error(`delete: no file at ${this.uri}`);
  }
}

const dirs = new Set<string>();

class MockDirectory {
  uri: string;
  constructor(...parts: (string | { uri: string })[]) {
    this.uri = join(parts);
  }
  get exists(): boolean {
    return dirs.has(this.uri);
  }
  create = jest.fn(() => {
    dirs.add(this.uri);
  });
}

export const fileSystemMock = {
  File: MockFile,
  Directory: MockDirectory,
  Paths: { document: new MockDirectory('file:///docs'), cache: new MockDirectory('file:///cache') },
};

/* ---------- Image manipulator ---------- */

function resizeNearest(src: RgbaImage, width: number, height: number): RgbaImage {
  const data = new Uint8Array(width * height * 4);
  for (let y = 0; y < height; y++) {
    const sy = Math.min(src.height - 1, Math.floor(((y + 0.5) * src.height) / height));
    for (let x = 0; x < width; x++) {
      const sx = Math.min(src.width - 1, Math.floor(((x + 0.5) * src.width) / width));
      data.set(src.data.subarray((sy * src.width + sx) * 4, (sy * src.width + sx) * 4 + 4), (y * width + x) * 4);
    }
  }
  return { width, height, data };
}

function toBase64(bytes: Uint8Array): string {
  return Buffer.from(bytes).toString('base64');
}

export interface MockImageRef {
  width: number;
  height: number;
  saveAsync: jest.Mock;
  release: jest.Mock;
}

export interface MockContext {
  resize: jest.Mock;
  renderAsync: jest.Mock;
  release: jest.Mock;
}

/** Every context and image made since the last reset, in order. */
export const contexts: MockContext[] = [];
export const images: MockImageRef[] = [];

/** Set to make the next `saveAsync` return this instead of a real PNG. */
export const overrides: { base64?: string } = {};

export const imageManipulatorMock = {
  SaveFormat: { JPEG: 'jpeg', PNG: 'png', WEBP: 'webp' },
  ImageManipulator: {
    manipulate: jest.fn((uri: string, options?: { maxWidth?: number; maxHeight?: number }) => {
      let size: { width?: number | null; height?: number | null } | null = null;
      const context: MockContext = {
        resize: jest.fn((s: { width?: number | null; height?: number | null }) => {
          size = s;
          return context;
        }),
        release: jest.fn(),
        renderAsync: jest.fn(async () => {
          const bytes = files.get(uri);
          if (!bytes) throw new Error(`manipulate: no file at ${uri}`);
          let image = decodePngToRgba(bytes); // throws for anything that is not a picture
          const bound = Math.min(
            1,
            options?.maxWidth ? options.maxWidth / image.width : 1,
            options?.maxHeight ? options.maxHeight / image.height : 1,
          );
          if (bound < 1) image = resizeNearest(image, Math.round(image.width * bound), Math.round(image.height * bound));
          if (size?.width && size.height) image = resizeNearest(image, size.width, size.height);
          const rendered = image;
          const ref: MockImageRef = {
            width: rendered.width,
            height: rendered.height,
            release: jest.fn(),
            saveAsync: jest.fn(async (save?: { format?: string; base64?: boolean }) => {
              const png = encode({ width: rendered.width, height: rendered.height, data: rendered.data, channels: 4, depth: 8 });
              const out = `file:///cache/manipulated-${++counter}.${save?.format === 'png' ? 'png' : 'jpg'}`;
              files.set(out, png);
              const base64 = save?.base64 ? (overrides.base64 ?? toBase64(png)) : undefined;
              return { uri: out, width: rendered.width, height: rendered.height, base64 };
            }),
          };
          images.push(ref);
          return ref;
        }),
      };
      contexts.push(context);
      return context;
    }),
  },
};

/* ---------- Image picker ---------- */

export const imagePickerMock = {
  requestCameraPermissionsAsync: jest.fn(),
  launchCameraAsync: jest.fn(),
  launchImageLibraryAsync: jest.fn(),
};

/** A solid-colour RGBA PNG. */
export function solidPng(width: number, height: number, rgba: [number, number, number, number]): Uint8Array {
  const data = new Uint8Array(width * height * 4);
  for (let i = 0; i < width * height; i++) data.set(rgba, i * 4);
  return encode({ width, height, data, channels: 4, depth: 8 });
}

export function resetExpoMocks(): void {
  files.clear();
  dirs.clear();
  contexts.length = 0;
  images.length = 0;
  delete overrides.base64;
  imageManipulatorMock.ImageManipulator.manipulate.mockClear();
  imagePickerMock.requestCameraPermissionsAsync.mockReset().mockResolvedValue({ granted: true, status: 'granted', canAskAgain: true });
  imagePickerMock.launchCameraAsync.mockReset().mockResolvedValue({ canceled: true, assets: null });
  imagePickerMock.launchImageLibraryAsync.mockReset().mockResolvedValue({ canceled: true, assets: null });
}

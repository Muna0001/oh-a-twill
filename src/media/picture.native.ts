/**
 * Picture import for iOS and Android (also what Jest resolves `./picture` to).
 *
 * Pictures are stored in `<documents>/pictures/`. The `uri` handed to callers
 * is `doc:<file name>`, not the absolute path: iOS moves the app's container
 * when the app is updated, so a saved `file://` path would stop working.
 * `thumbnailSource` turns it into the current `file://` URI.
 */
import { Directory, File, Paths } from 'expo-file-system';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';

import { boxAverage } from '@/engine/picture';

import { guarded, isImageType, PictureError } from './errors';
import { decodePngToRgba } from './png';
import {
  base64ToBytes,
  createBuilder,
  createSampler,
  JPEG_QUALITY,
  MAX_STORED_SIDE,
  newPictureId,
  nextMacrotask,
  parseImageDataUrl,
  SAMPLE_FACTOR,
} from './shared';
import type { MediaApi, PickedPicture, PickSource } from './types';

const SCHEME = 'doc:';
const FOLDER = 'pictures';

function picturesDir(): Directory {
  const dir = new Directory(Paths.document, FOLDER);
  if (!dir.exists) dir.create({ intermediates: true, idempotent: true });
  return dir;
}

/** The file behind a stored picture uri. Absolute `file://` URIs are accepted too. */
function fileFor(uri: string): File {
  if (uri.startsWith(SCHEME)) {
    const name = uri.slice(SCHEME.length);
    if (!/^[\w.-]+$/.test(name)) throw new PictureError('unreadable');
    return new File(Paths.document, FOLDER, name);
  }
  return new File(uri);
}

/** Formats that can carry transparency are kept as PNG so it can be flattened onto white when sampling. */
function mayHaveAlpha(mime: string | null | undefined, name: string | null | undefined): boolean {
  const m = (mime ?? '').toLowerCase();
  if (m) return m === 'image/png' || m === 'image/gif' || m === 'image/webp';
  return /\.(png|gif|webp)$/i.test(name ?? '');
}

function release(...objects: ({ release(): void } | null | undefined)[]): void {
  for (const o of objects) {
    try {
      o?.release();
    } catch {
      // Already released, or not a native object (tests).
    }
  }
}

function removeQuietly(uri: string | null | undefined): void {
  if (!uri) return;
  try {
    const file = new File(uri);
    if (file.exists) file.delete();
  } catch {
    // A leftover cache file is harmless; the OS clears the cache directory.
  }
}

/**
 * Bakes in the EXIF orientation, shrinks to at most 1024 px on the long side
 * (both happen while loading, see `ImageLoadOptions`) and saves the result in
 * the documents directory.
 */
async function storePicture(sourceUri: string, keepAlpha: boolean): Promise<PickedPicture> {
  const context = ImageManipulator.manipulate(sourceUri, { maxWidth: MAX_STORED_SIDE, maxHeight: MAX_STORED_SIDE });
  let image: Awaited<ReturnType<typeof context.renderAsync>> | null = null;
  try {
    image = await context.renderAsync();
    const saved = await image.saveAsync(keepAlpha ? { format: SaveFormat.PNG } : { format: SaveFormat.JPEG, compress: JPEG_QUALITY });
    const name = `${newPictureId()}.${keepAlpha ? 'png' : 'jpg'}`;
    const target = new File(picturesDir(), name);
    try {
      await new File(saved.uri).move(target);
    } catch (error) {
      removeQuietly(saved.uri);
      throw error;
    }
    return { uri: SCHEME + name, width: saved.width, height: saved.height };
  } finally {
    release(image, context);
  }
}

async function pickPicture(source: PickSource): Promise<PickedPicture | null> {
  return guarded(async () => {
    const options: ImagePicker.ImagePickerOptions = { mediaTypes: ['images'], allowsEditing: false, quality: 1, exif: false };
    let result: ImagePicker.ImagePickerResult;
    if (source === 'camera') {
      const permission = await ImagePicker.requestCameraPermissionsAsync();
      if (!permission.granted) throw new PictureError('permission');
      result = await ImagePicker.launchCameraAsync(options);
    } else {
      // The system photo pickers (PHPicker, Android photo picker) need no permission.
      result = await ImagePicker.launchImageLibraryAsync(options);
    }
    if (result.canceled || !result.assets || result.assets.length === 0) return null;
    const asset = result.assets[0];
    if ((asset.type && asset.type !== 'image') || (asset.mimeType && !isImageType(asset.mimeType))) {
      throw new PictureError('not-image');
    }
    return storePicture(asset.uri, mayHaveAlpha(asset.mimeType, asset.fileName ?? asset.uri));
  });
}

async function importPictureFile(_file: Blob): Promise<PickedPicture> {
  // Drag and drop is a web feature; on phones pictures come from pickPicture.
  throw new PictureError('unreadable');
}

async function importPictureDataUrl(dataUrl: string): Promise<PickedPicture> {
  return guarded(async () => {
    const { mime, bytes } = parseImageDataUrl(dataUrl);
    const ext = mime === 'image/png' ? 'png' : mime === 'image/jpeg' ? 'jpg' : 'img';
    const temp = new File(Paths.cache, `import-${newPictureId()}.${ext}`);
    try {
      temp.create({ overwrite: true });
      await temp.write(bytes);
      return await storePicture(temp.uri, mayHaveAlpha(mime, null));
    } finally {
      removeQuietly(temp.uri);
    }
  });
}

/** Resizes to exactly W*4 x H*4, exports a PNG, decodes it in JS, then averages 4 x 4 blocks. */
async function readSamples(uri: string, W: number, H: number): Promise<Float32Array> {
  const width = W * SAMPLE_FACTOR;
  const height = H * SAMPLE_FACTOR;
  const context = ImageManipulator.manipulate(fileFor(uri).uri);
  let image: Awaited<ReturnType<typeof context.renderAsync>> | null = null;
  let base64: string | undefined;
  try {
    image = await context.resize({ width, height }).renderAsync();
    const saved = await image.saveAsync({ format: SaveFormat.PNG, base64: true });
    base64 = saved.base64;
    removeQuietly(saved.uri);
  } finally {
    release(image, context);
  }
  if (!base64) throw new PictureError('unreadable');
  await nextMacrotask();
  const png = decodePngToRgba(base64ToBytes(base64));
  if (png.width !== width || png.height !== height) throw new PictureError('unreadable');
  return boxAverage(png.data, width, height, SAMPLE_FACTOR);
}

const sampler = createSampler(readSamples);
const samplePicture = sampler.samplePicture;
const buildPicture = createBuilder(samplePicture);

async function thumbnailSource(uri: string): Promise<string> {
  return guarded(async () => fileFor(uri).uri);
}

async function deletePicture(uri: string): Promise<void> {
  sampler.forget(uri);
  try {
    const file = fileFor(uri);
    if (file.exists) file.delete();
  } catch {
    // Nothing useful to tell the user: the project is going away anyway.
  }
}

/** For tests. */
export function resetMediaForTests(): void {
  sampler.clear();
}

export { buildPicture, deletePicture, importPictureDataUrl, importPictureFile, pickPicture, samplePicture, thumbnailSource };

// Compile-time check that this file implements the whole interface.
({ buildPicture, deletePicture, importPictureDataUrl, importPictureFile, pickPicture, samplePicture, thumbnailSource }) satisfies MediaApi;

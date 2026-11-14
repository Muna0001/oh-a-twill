import { readFileSync } from 'fs';
import { join } from 'path';

import { autoRows } from '@/engine/picture';

import { copy, messageFor } from './copy';
import { PictureError } from './errors';
import * as media from './index';
import { resetMediaForTests } from './picture.native';
import { contexts, files, imageManipulatorMock, imagePickerMock, images, overrides, resetExpoMocks, solidPng } from './testExpoMocks';
import { PNGS } from './testPngs';

jest.mock('expo-file-system', () => jest.requireActual('./testExpoMocks').fileSystemMock);
jest.mock('expo-image-manipulator', () => jest.requireActual('./testExpoMocks').imageManipulatorMock);
jest.mock('expo-image-picker', () => jest.requireActual('./testExpoMocks').imagePickerMock);

const manipulate = imageManipulatorMock.ImageManipulator.manipulate;
const FLOWER = new Uint8Array(readFileSync(join(__dirname, '../../assets/samples/flower.png')));

function offer(uri: string, bytes: Uint8Array, asset: Record<string, unknown> = {}) {
  files.set(uri, bytes);
  const result = { canceled: false, assets: [{ uri, width: 1, height: 1, type: 'image', ...asset }] };
  imagePickerMock.launchImageLibraryAsync.mockResolvedValue(result);
  imagePickerMock.launchCameraAsync.mockResolvedValue(result);
}

async function pickFlower() {
  offer('file:///photos/flower.png', FLOWER, { mimeType: 'image/png' });
  const picked = await media.pickPicture('library');
  if (!picked) throw new Error('expected a picture');
  manipulate.mockClear();
  contexts.length = 0;
  images.length = 0;
  return picked;
}

async function codeOf(promise: Promise<unknown>): Promise<string> {
  try {
    await promise;
  } catch (error) {
    if (error instanceof PictureError) return error.code;
    throw error;
  }
  throw new Error('expected a rejection');
}

beforeEach(() => {
  resetExpoMocks();
  resetMediaForTests();
});

describe('pickPicture (native)', () => {
  it('picks from the library without asking for any permission', async () => {
    offer('file:///photos/wide.jpg', solidPng(2000, 1000, [10, 20, 30, 255]), { mimeType: 'image/jpeg' });
    const picked = await media.pickPicture('library');

    expect(imagePickerMock.requestCameraPermissionsAsync).not.toHaveBeenCalled();
    expect(imagePickerMock.launchCameraAsync).not.toHaveBeenCalled();
    expect(imagePickerMock.launchImageLibraryAsync).toHaveBeenCalledWith(expect.objectContaining({ mediaTypes: ['images'], allowsEditing: false }));
    // Orientation and the 1024 px limit are applied while loading.
    expect(manipulate).toHaveBeenCalledTimes(1);
    expect(manipulate).toHaveBeenCalledWith('file:///photos/wide.jpg', { maxWidth: 1024, maxHeight: 1024 });
    expect(contexts[0].resize).not.toHaveBeenCalled();
    expect(images[0].saveAsync).toHaveBeenCalledWith({ format: 'jpeg', compress: 0.9 });

    expect(picked).toEqual({ uri: expect.stringMatching(/^doc:p[0-9a-z]+\.jpg$/), width: 1024, height: 512 });
    const stored = `file:///docs/pictures/${picked!.uri.slice(4)}`;
    expect(files.has(stored)).toBe(true);
    expect([...files.keys()].filter((k) => k.startsWith('file:///cache/'))).toEqual([]);
    await expect(media.thumbnailSource(picked!.uri)).resolves.toBe(stored);
    // Native objects are released.
    expect(images[0].release).toHaveBeenCalled();
    expect(contexts[0].release).toHaveBeenCalled();
  });

  it('does not enlarge a small picture, and keeps a PNG as a PNG so transparency survives', async () => {
    offer('file:///photos/flower.png', FLOWER, { mimeType: 'image/png' });
    const picked = await media.pickPicture('library');
    expect(picked).toEqual({ uri: expect.stringMatching(/^doc:p[0-9a-z]+\.png$/), width: 240, height: 300 });
    expect(images[0].saveAsync).toHaveBeenCalledWith({ format: 'png' });
  });

  it('resolves null when the picker is cancelled', async () => {
    await expect(media.pickPicture('library')).resolves.toBeNull();
    await expect(media.pickPicture('camera')).resolves.toBeNull();
    expect(manipulate).not.toHaveBeenCalled();
  });

  it('asks for the camera permission only for the camera', async () => {
    offer('file:///photos/shot.jpg', solidPng(8, 8, [1, 2, 3, 255]));
    const picked = await media.pickPicture('camera');
    expect(imagePickerMock.requestCameraPermissionsAsync).toHaveBeenCalledTimes(1);
    expect(imagePickerMock.launchCameraAsync).toHaveBeenCalledTimes(1);
    expect(imagePickerMock.launchImageLibraryAsync).not.toHaveBeenCalled();
    expect(picked).toMatchObject({ width: 8, height: 8 });
  });

  it('maps a camera denial to "permission" and does not open the camera', async () => {
    imagePickerMock.requestCameraPermissionsAsync.mockResolvedValue({ granted: false, status: 'denied', canAskAgain: false });
    const error = await media.pickPicture('camera').catch((e) => e);
    expect(error).toBeInstanceOf(media.PictureError);
    expect(error.code).toBe('permission');
    expect(messageFor(error)).toBe(copy.permission);
    expect(imagePickerMock.launchCameraAsync).not.toHaveBeenCalled();
  });

  it('maps failures to "unreadable" and non-images to "not-image"', async () => {
    imagePickerMock.launchImageLibraryAsync.mockRejectedValue(new Error('boom'));
    expect(await codeOf(media.pickPicture('library'))).toBe('unreadable');

    offer('file:///photos/clip.mov', new Uint8Array([1, 2, 3]), { type: 'video' });
    expect(await codeOf(media.pickPicture('library'))).toBe('not-image');

    offer('file:///photos/notes.pdf', new Uint8Array([1, 2, 3]), { type: null, mimeType: 'application/pdf' });
    expect(await codeOf(media.pickPicture('library'))).toBe('not-image');

    // An image the OS cannot decode.
    offer('file:///photos/broken.jpg', new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]));
    const error = await media.pickPicture('library').catch((e) => e);
    expect(error.code).toBe('unreadable');
    expect(messageFor(error)).toBe('That picture couldn’t be read. Try a JPG or PNG.');
    expect([...files.keys()].filter((k) => k.startsWith('file:///docs/'))).toEqual([]);
  });
});

describe('samplePicture (native)', () => {
  it('resizes to exactly W*4 x H*4, exports a PNG as base64 and averages it', async () => {
    const picked = await pickFlower();
    const px = await media.samplePicture(picked.uri, 24, 31);

    expect(manipulate).toHaveBeenCalledTimes(1);
    expect(manipulate.mock.calls[0]).toEqual([`file:///docs/pictures/${picked.uri.slice(4)}`]);
    expect(contexts[0].resize).toHaveBeenCalledWith({ width: 96, height: 124 });
    expect(images[0].saveAsync).toHaveBeenCalledWith({ format: 'png', base64: true });
    expect(px).toBeInstanceOf(Float32Array);
    expect(px.length).toBe(24 * 31 * 3);
    // Top-left square is the cream background.
    expect(Array.from(px.slice(0, 3))).toEqual([244, 236, 216]);
    // The temporary PNG is removed again.
    expect([...files.keys()].filter((k) => k.startsWith('file:///cache/'))).toEqual([]);
  });

  it('flattens transparent pixels onto white', async () => {
    offer('file:///photos/clear.png', solidPng(16, 16, [200, 0, 0, 0]), { mimeType: 'image/png' });
    const picked = await media.pickPicture('library');
    const px = await media.samplePicture(picked!.uri, 4, 4);
    expect(Array.from(px)).toEqual(new Array(48).fill(255));
  });

  it('reads once for a repeated (uri, W, H) and again when H changes', async () => {
    const picked = await pickFlower();
    const a = await media.samplePicture(picked.uri, 24, 30);
    const b = await media.samplePicture(picked.uri, 24, 30);
    expect(b).toBe(a);
    expect(manipulate).toHaveBeenCalledTimes(1);

    await media.samplePicture(picked.uri, 24, 31);
    expect(manipulate).toHaveBeenCalledTimes(2);
    await media.samplePicture(picked.uri, 25, 31);
    expect(manipulate).toHaveBeenCalledTimes(3);
    await media.samplePicture(picked.uri, 24, 30);
    expect(manipulate).toHaveBeenCalledTimes(3);
  });

  it('shares one read between concurrent calls', async () => {
    const picked = await pickFlower();
    const [a, b] = await Promise.all([media.samplePicture(picked.uri, 12, 15), media.samplePicture(picked.uri, 12, 15)]);
    expect(a).toBe(b);
    expect(manipulate).toHaveBeenCalledTimes(1);
  });

  it('keeps about four entries, dropping the least recently used', async () => {
    const picked = await pickFlower();
    for (const H of [10, 11, 12, 13]) await media.samplePicture(picked.uri, 8, H);
    await media.samplePicture(picked.uri, 8, 10); // refresh 10: 11 is now the oldest
    await media.samplePicture(picked.uri, 8, 14); // evicts 11
    expect(manipulate).toHaveBeenCalledTimes(5);
    await media.samplePicture(picked.uri, 8, 10);
    expect(manipulate).toHaveBeenCalledTimes(5);
    await media.samplePicture(picked.uri, 8, 11);
    expect(manipulate).toHaveBeenCalledTimes(6);
  });

  it('does not cache failures', async () => {
    const picked = await pickFlower();
    overrides.base64 = 'AAAA';
    expect(await codeOf(media.samplePicture(picked.uri, 6, 6))).toBe('unreadable');
    delete overrides.base64;
    await expect(media.samplePicture(picked.uri, 6, 6)).resolves.toHaveLength(108);
    expect(manipulate).toHaveBeenCalledTimes(2);
  });

  it('rejects when the exported PNG has the wrong size, a missing file or a bad size', async () => {
    const picked = await pickFlower();
    overrides.base64 = PNGS.rgba8;
    expect(await codeOf(media.samplePicture(picked.uri, 6, 6))).toBe('unreadable');
    expect(await codeOf(media.samplePicture('doc:missing.jpg', 6, 6))).toBe('unreadable');
    expect(await codeOf(media.samplePicture('doc:../../etc/passwd', 6, 6))).toBe('unreadable');
    expect(await codeOf(media.samplePicture(picked.uri, 0, 6))).toBe('unreadable');
  });
});

describe('buildPicture (native)', () => {
  const base = { imageW: 240, imageH: 300, warps: 24, rows: 0, k: 5, tidy: true };

  it('uses the picture’s shape when rows is 0', async () => {
    const picked = await pickFlower();
    const pic = await media.buildPicture({ ...base, imageUri: picked.uri });
    expect(autoRows(24, 240, 300)).toBe(30);
    expect(pic.W).toBe(24);
    expect(pic.H).toBe(30);
    expect(pic.autoH).toBe(30);
    expect(pic.grid.length).toBe(24 * 30);
    expect(contexts[0].resize).toHaveBeenCalledWith({ width: 96, height: 120 });
    // Cream background, red petals, green leaves and stem, yellow centre.
    expect(pic.palette.length).toBe(5);
    expect(pic.palette.reduce((sum, c) => sum + c.count, 0)).toBe(24 * 30);
    expect(pic.palette[0].count).toBeGreaterThan(24 * 30 * 0.5);
    expect(pic.grid[0]).toBe(0);
    const [r, g, b] = pic.palette[0].rgb;
    expect(Math.abs(r - 244) + Math.abs(g - 236) + Math.abs(b - 216)).toBeLessThan(12);
    const petal = pic.palette[pic.grid[4 * 24 + 12]].rgb; // top petal
    expect(petal[0]).toBeGreaterThan(180);
    expect(petal[1]).toBeLessThan(110);
  });

  it('uses explicit rows, clamped to 4..400, and still reports autoH', async () => {
    const picked = await pickFlower();
    const pic = await media.buildPicture({ ...base, imageUri: picked.uri, rows: 12 });
    expect([pic.H, pic.autoH, pic.grid.length]).toEqual([12, 30, 24 * 12]);
    expect(contexts[0].resize).toHaveBeenCalledWith({ width: 96, height: 48 });

    const tall = await media.buildPicture({ ...base, imageUri: picked.uri, warps: 4, rows: 1000, k: 2 });
    expect(tall.H).toBe(400);
    const short = await media.buildPicture({ ...base, imageUri: picked.uri, rows: 2 });
    expect(short.H).toBe(4);
    // A very wide picture never goes below 4 rows.
    const wide = await media.buildPicture({ ...base, imageUri: picked.uri, imageW: 3000, imageH: 100 });
    expect([wide.H, wide.autoH]).toEqual([4, 4]);
  });

  it('does not read the picture again when only k or tidy change', async () => {
    const picked = await pickFlower();
    const a = await media.buildPicture({ ...base, imageUri: picked.uri });
    const b = await media.buildPicture({ ...base, imageUri: picked.uri, k: 3 });
    const c = await media.buildPicture({ ...base, imageUri: picked.uri, k: 3, tidy: false });
    expect(manipulate).toHaveBeenCalledTimes(1);
    expect(a.palette.length).toBe(5);
    expect(b.palette.length).toBe(3);
    expect(c.palette.length).toBe(3);
    await media.buildPicture({ ...base, imageUri: picked.uri, rows: 31 });
    expect(manipulate).toHaveBeenCalledTimes(2);
  });

  it('gives the same grid for the same input', async () => {
    const picked = await pickFlower();
    const a = await media.buildPicture({ ...base, imageUri: picked.uri });
    resetMediaForTests();
    const b = await media.buildPicture({ ...base, imageUri: picked.uri });
    expect(Array.from(b.grid)).toEqual(Array.from(a.grid));
    expect(b.palette).toEqual(a.palette);
  });

  it('rejects with "unreadable" for a missing picture or impossible sizes', async () => {
    expect(await codeOf(media.buildPicture({ ...base, imageUri: 'doc:gone.jpg' }))).toBe('unreadable');
    expect(await codeOf(media.buildPicture({ ...base, imageUri: '' }))).toBe('unreadable');
    expect(await codeOf(media.buildPicture({ ...base, imageUri: 'doc:gone.jpg', imageW: 0 }))).toBe('unreadable');
  });
});

describe('deletePicture, importPictureDataUrl, importPictureFile (native)', () => {
  it('deletes the file and forgets its samples', async () => {
    const picked = await pickFlower();
    await media.samplePicture(picked.uri, 8, 10);
    await media.deletePicture(picked.uri);
    expect([...files.keys()].filter((k) => k.startsWith('file:///docs/'))).toEqual([]);
    expect(await codeOf(media.samplePicture(picked.uri, 8, 10))).toBe('unreadable');
    // Deleting twice, or something that was never stored, is fine.
    await expect(media.deletePicture(picked.uri)).resolves.toBeUndefined();
    await expect(media.deletePicture('doc:../nope')).resolves.toBeUndefined();
  });

  it('imports a data URL through the same pipeline and cleans up', async () => {
    const picked = await media.importPictureDataUrl(`data:image/png;base64,${PNGS.rgba8}`);
    expect(picked).toEqual({ uri: expect.stringMatching(/^doc:p[0-9a-z]+\.png$/), width: 2, height: 2 });
    expect(manipulate).toHaveBeenCalledWith(expect.stringMatching(/^file:\/\/\/cache\/import-.*\.png$/), { maxWidth: 1024, maxHeight: 1024 });
    expect([...files.keys()]).toEqual([`file:///docs/pictures/${picked.uri.slice(4)}`]);
    const px = await media.samplePicture(picked.uri, 2, 2);
    expect(Array.from(px.slice(0, 3))).toEqual([255, 0, 0]);
    expect(Array.from(px.slice(6, 9))).toEqual([255, 255, 255]); // transparent blue
  });

  it('maps data URL problems', async () => {
    expect(await codeOf(media.importPictureDataUrl('data:text/plain;base64,aGVsbG8='))).toBe('not-image');
    expect(await codeOf(media.importPictureDataUrl('not a data url'))).toBe('unreadable');
    expect(await codeOf(media.importPictureDataUrl('data:image/png;base64,aGVsbG8='))).toBe('unreadable');
    expect(files.size).toBe(0);
  });

  it('importPictureFile is web only', async () => {
    expect(await codeOf(media.importPictureFile({ type: 'image/png' } as Blob))).toBe('unreadable');
  });
});

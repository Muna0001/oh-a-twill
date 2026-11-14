// Jest resolves './legacyImport' to the native file; the linter resolves it to the web one.
/* eslint-disable import/no-duplicates */
import { readLegacy as readLegacyNative } from './legacyImport';
import { readLegacy } from './legacyImport.web';
/* eslint-enable import/no-duplicates */

jest.mock('@react-native-async-storage/async-storage', () =>
  jest.requireActual('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

const KEY = 'weaving-helper-v3';
const SRC = 'data:image/jpeg;base64,/9j/4AAQSkZJRg==';

type Stub = { getItem: jest.Mock; setItem: jest.Mock; removeItem: jest.Mock; clear: jest.Mock };
const g = globalThis as unknown as { localStorage?: Stub };
const original = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');

function stub(data: Record<string, string>): Stub {
  const s: Stub = {
    getItem: jest.fn((k: string) => (k in data ? data[k] : null)),
    setItem: jest.fn(),
    removeItem: jest.fn(),
    clear: jest.fn(),
  };
  Object.defineProperty(globalThis, 'localStorage', { value: s, configurable: true, writable: true });
  return s;
}
const save = (value: unknown) => stub({ [KEY]: JSON.stringify(value) });

afterEach(() => {
  if (original) Object.defineProperty(globalThis, 'localStorage', original);
  else delete g.localStorage;
});

describe('readLegacy (web)', () => {
  it('reads a full saved state', () => {
    const s = save({
      warps: 32,
      mode: 'pic',
      pat: 'herring',
      start: 2,
      mirror: true,
      side: 'right',
      colors: ['#112233', '#AABBCC'],
      row: 17,
      pic: { src: SRC, rows: 40, k: 6, tidy: false, row: 9, weave: 'plain' },
    });
    expect(readLegacy()).toEqual({
      warps: 32,
      pattern: { stitchId: 'herring', setup: { start: 2, mirror: true, side: 'right' }, colors: ['#112233', '#AABBCC'], row: 17 },
      picture: { src: SRC, rows: 40, k: 6, tidy: false, weave: 'plain', row: 9 },
      mode: 'pic',
    });
    expect(s.getItem).toHaveBeenCalledWith(KEY);
    expect(s.setItem).not.toHaveBeenCalled();
    expect(s.removeItem).not.toHaveBeenCalled();
    expect(s.clear).not.toHaveBeenCalled();
  });

  it('fills in the old defaults for a partial state', () => {
    save({ warps: 30, row: 5 });
    expect(readLegacy()).toEqual({
      warps: 30,
      pattern: { stitchId: 'twill22', setup: { start: 0, mirror: false, side: 'left' }, colors: ['#2E4C8F', '#E4DCC8'], row: 5 },
      picture: null,
      mode: 'pat',
    });
    save({});
    expect(readLegacy()).toMatchObject({ warps: 24, pattern: { stitchId: 'twill22', row: 1 }, picture: null, mode: 'pat' });
  });

  it('accepts every old stitch id and falls back for unknown ones', () => {
    for (const id of ['plain', 'basket', 'twill22', 'twill21', 'chevron', 'arrowL', 'arrowR', 'herring', 'diamond', 'hounds', 'logcabin']) {
      save({ pat: id });
      expect(readLegacy()!.pattern.stitchId).toBe(id);
    }
    for (const id of ['satin', '', 7, null, 'toString']) {
      save({ pat: id });
      expect(readLegacy()!.pattern.stitchId).toBe('twill22');
    }
  });

  it('clamps and validates every field', () => {
    save({
      warps: 5000,
      mode: 'pic',
      start: -1,
      mirror: 'yes',
      side: 'middle',
      colors: ['blue', '#E4DCC8'],
      row: 0,
      pic: { src: SRC, rows: 2, k: 50, tidy: 'no', row: -8, weave: 'satin' },
    });
    expect(readLegacy()).toEqual({
      warps: 120,
      pattern: { stitchId: 'twill22', setup: { start: 0, mirror: false, side: 'left' }, colors: ['#2E4C8F', '#E4DCC8'], row: 1 },
      picture: { src: SRC, rows: 4, k: 8, tidy: true, weave: 'twill22', row: 1 },
      mode: 'pic',
    });
    save({ warps: '1', pic: { src: SRC, rows: 9999, k: 0 } });
    expect(readLegacy()).toMatchObject({ warps: 4, picture: { rows: 400, k: 2, tidy: true, row: 1 } });
  });

  it('has no picture unless the source is an image data URL', () => {
    for (const src of [null, '', 'https://example.com/a.jpg', 'javascript:alert(1)', 42]) {
      save({ mode: 'pic', pic: { src, rows: 20, k: 5 } });
      const data = readLegacy()!;
      expect(data.picture).toBeNull();
      expect(data.mode).toBe('pat');
    }
    save({ mode: 'pat', pic: { src: SRC } });
    expect(readLegacy()).toMatchObject({ mode: 'pat', picture: { src: SRC, rows: 0, k: 4 } });
  });

  it('returns null for corrupt data', () => {
    for (const text of ['{oops', 'null', '"hello"', '42', '[1,2]', 'true']) {
      stub({ [KEY]: text });
      expect(readLegacy()).toBeNull();
    }
  });

  it('returns null when there is nothing saved', () => {
    stub({});
    expect(readLegacy()).toBeNull();
    stub({ 'twill-helper-v2': JSON.stringify({ warps: 20, row: 3 }) });
    expect(readLegacy()).toBeNull();
  });

  it('returns null when localStorage is missing or throws', () => {
    delete g.localStorage;
    Object.defineProperty(globalThis, 'localStorage', { value: undefined, configurable: true, writable: true });
    expect(readLegacy()).toBeNull();
    const s = stub({});
    s.getItem.mockImplementation(() => {
      throw new Error('SecurityError');
    });
    expect(readLegacy()).toBeNull();
    Object.defineProperty(globalThis, 'localStorage', {
      configurable: true,
      get() {
        throw new Error('SecurityError');
      },
    });
    expect(readLegacy()).toBeNull();
  });
});

describe('readLegacy (native)', () => {
  it('is a no-op', () => {
    save({ warps: 30 });
    expect(readLegacyNative()).toBeNull();
  });
});

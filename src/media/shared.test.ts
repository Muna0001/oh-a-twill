import { copy, messageFor } from './copy';
import { guarded, isImageType, PictureError, toPictureError } from './errors';
import {
  base64ToBytes,
  createBuilder,
  createSampler,
  fitWithin,
  LruCache,
  newPictureId,
  nextMacrotask,
  parseImageDataUrl,
  resolveRows,
} from './shared';

describe('PictureError and messages', () => {
  it('is a real Error subclass with a code', () => {
    const error = new PictureError('not-image');
    expect(error).toBeInstanceOf(Error);
    expect(error).toBeInstanceOf(PictureError);
    expect(error.code).toBe('not-image');
    expect(error.name).toBe('PictureError');
  });

  it('uses the reference wording', () => {
    expect(messageFor(new PictureError('unreadable'))).toBe('That picture couldn’t be read. Try a JPG or PNG.');
    expect(messageFor(new PictureError('not-image'))).toBe('That file isn’t a picture. Try a JPG or PNG.');
    expect(messageFor(new PictureError('permission'))).toBe(copy.permission);
    expect(messageFor(new Error('anything'))).toBe(copy.unreadable);
    expect(messageFor(undefined)).toBe(copy.unreadable);
  });

  it('maps unknown failures to "unreadable" and keeps PictureErrors', async () => {
    const cause = new TypeError('x');
    expect(toPictureError(cause).code).toBe('unreadable');
    expect(toPictureError(cause).cause).toBe(cause);
    const own = new PictureError('permission');
    expect(toPictureError(own)).toBe(own);
    await expect(guarded(async () => 7)).resolves.toBe(7);
    await expect(
      guarded(async () => {
        throw new Error('no');
      }),
    ).rejects.toMatchObject({ code: 'unreadable' });
    await expect(
      guarded(async () => {
        throw own;
      }),
    ).rejects.toBe(own);
  });

  it('recognises image types the way the reference does', () => {
    expect(isImageType('image/jpeg')).toBe(true);
    expect(isImageType('IMAGE/PNG')).toBe(true);
    expect(isImageType('application/pdf')).toBe(false);
    expect(isImageType('')).toBe(false);
    expect(isImageType(undefined)).toBe(false);
  });
});

describe('LruCache', () => {
  it('evicts the least recently used entry', () => {
    const cache = new LruCache<number>(2);
    cache.set('a', 1);
    cache.set('b', 2);
    expect(cache.get('a')).toBe(1);
    cache.set('c', 3);
    expect(cache.get('b')).toBeUndefined();
    expect(cache.get('a')).toBe(1);
    expect(cache.get('c')).toBe(3);
    expect(cache.size).toBe(2);
    cache.deleteWhere((k) => k === 'a');
    expect(cache.size).toBe(1);
    cache.clear();
    expect(cache.size).toBe(0);
  });
});

describe('createSampler', () => {
  const px = (W: number, H: number) => new Float32Array(W * H * 3);

  it('caches per (uri, W, H) and forgets per uri', async () => {
    const read = jest.fn(async (_uri: string, W: number, H: number) => px(W, H));
    const sampler = createSampler(read);
    await sampler.samplePicture('idb:a', 4, 5);
    await sampler.samplePicture('idb:a', 4, 5);
    await sampler.samplePicture('idb:b', 4, 5);
    expect(read).toHaveBeenCalledTimes(2);
    sampler.forget('idb:a');
    await sampler.samplePicture('idb:b', 4, 5);
    expect(read).toHaveBeenCalledTimes(2);
    await sampler.samplePicture('idb:a', 4, 5);
    expect(read).toHaveBeenCalledTimes(3);
  });

  it('maps reader failures and wrong-sized output to "unreadable"', async () => {
    const sampler = createSampler(async () => {
      throw new Error('decode failed');
    });
    await expect(sampler.samplePicture('idb:a', 4, 5)).rejects.toMatchObject({ code: 'unreadable' });
    const short = createSampler(async () => new Float32Array(3));
    await expect(short.samplePicture('idb:a', 4, 5)).rejects.toMatchObject({ code: 'unreadable' });
  });
});

describe('createBuilder', () => {
  it('waits a macrotask between sampling and quantizing', async () => {
    jest.useFakeTimers();
    try {
      const build = createBuilder(async (_uri, W, H) => new Float32Array(W * H * 3).fill(200));
      let done = false;
      const pending = build({ imageUri: 'idb:a', imageW: 10, imageH: 10, warps: 4, rows: 0, k: 2, tidy: false }).then((pic) => {
        done = true;
        return pic;
      });
      for (let i = 0; i < 20; i++) await Promise.resolve();
      expect(done).toBe(false); // sampled, but waiting for the timer
      jest.runOnlyPendingTimers();
      const pic = await pending;
      expect([pic.W, pic.H, pic.autoH]).toEqual([4, 4, 4]);
    } finally {
      jest.useRealTimers();
    }
  });

  it('nextMacrotask resolves', async () => {
    await expect(nextMacrotask()).resolves.toBeUndefined();
  });
});

describe('resolveRows', () => {
  it('follows the reference: rows || max(4, round(W * h / w))', () => {
    expect(resolveRows({ warps: 24, imageW: 320, imageH: 240, rows: 0 })).toEqual({ H: 18, autoH: 18 });
    expect(resolveRows({ warps: 24, imageW: 320, imageH: 240, rows: 40 })).toEqual({ H: 40, autoH: 18 });
    expect(resolveRows({ warps: 24, imageW: 1000, imageH: 10, rows: 0 })).toEqual({ H: 4, autoH: 4 });
  });

  it('clamps to the row limits', () => {
    expect(resolveRows({ warps: 120, imageW: 10, imageH: 1000, rows: 0 })).toEqual({ H: 400, autoH: 400 });
    expect(resolveRows({ warps: 24, imageW: 100, imageH: 100, rows: 999 }).H).toBe(400);
    expect(resolveRows({ warps: 24, imageW: 100, imageH: 100, rows: 1 }).H).toBe(4);
  });
});

describe('fitWithin', () => {
  it('scales the long side down to the limit and never up', () => {
    expect(fitWithin(4000, 3000, 1024)).toMatchObject({ width: 1024, height: 768 });
    expect(fitWithin(3000, 4000, 1024)).toMatchObject({ width: 768, height: 1024 });
    expect(fitWithin(240, 300, 1024)).toEqual({ width: 240, height: 300, scale: 1 });
    expect(fitWithin(5000, 2, 1024)).toMatchObject({ width: 1024, height: 1 });
  });
});

describe('newPictureId', () => {
  it('is unique and safe in file names and URIs', () => {
    const ids = new Set<string>();
    for (let i = 0; i < 500; i++) ids.add(newPictureId(1700000000000, () => 0.5));
    expect(ids.size).toBe(500);
    for (const id of ids) expect(id).toMatch(/^p[0-9a-z]{10,}$/);
    expect(newPictureId()).not.toBe(newPictureId());
  });
});

describe('base64 and data URLs', () => {
  it('decodes base64 like Buffer does', () => {
    for (const text of ['', 'a', 'ab', 'abc', 'abcd', 'hello world!?', 'ÿ\u0000\u0080']) {
      const b64 = Buffer.from(text, 'latin1').toString('base64');
      expect(Array.from(base64ToBytes(b64))).toEqual(Array.from(Buffer.from(text, 'latin1')));
    }
    const all = Uint8Array.from({ length: 256 }, (_, i) => i);
    expect(Array.from(base64ToBytes(Buffer.from(all).toString('base64')))).toEqual(Array.from(all));
    expect(Array.from(base64ToBytes('aGVs\nbG8='))).toEqual([104, 101, 108, 108, 111]);
    expect(() => base64ToBytes('a*b=')).toThrow();
    expect(() => base64ToBytes('abcde')).toThrow();
  });

  it('parses image data URLs and rejects the rest', () => {
    const parsed = parseImageDataUrl('data:image/jpeg;base64,/9j/4A==');
    expect(parsed.mime).toBe('image/jpeg');
    expect(Array.from(parsed.bytes)).toEqual([0xff, 0xd8, 0xff, 0xe0]);
    expect(parseImageDataUrl('data:IMAGE/PNG;charset=x;base64,AAEC').mime).toBe('image/png');
    const code = (url: string) => {
      try {
        parseImageDataUrl(url);
      } catch (error) {
        return (error as PictureError).code;
      }
      return 'ok';
    };
    expect(code('data:text/html;base64,AAAA')).toBe('not-image');
    expect(code('data:image/svg+xml,<svg/>')).toBe('unreadable');
    expect(code('https://example.com/a.png')).toBe('unreadable');
    expect(code('data:image/png;base64,!!!!')).toBe('unreadable');
  });
});

import AsyncStorage from '@react-native-async-storage/async-storage';

import {
  configureProjectFiles,
  PROJECTS_KEY,
  rehydrateStores,
  resetStoresForTests,
  useProjects,
  useSettings,
} from './index';
import type { PatternProject, PictureProject } from './index';

jest.mock('@react-native-async-storage/async-storage', () =>
  jest.requireActual('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

const P = () => useProjects.getState();
const pattern = (id: string) => P().projects[id] as PatternProject;
const picture = (id: string) => P().projects[id] as PictureProject;
const flush = () => new Promise((r) => setTimeout(r, 0));

beforeEach(async () => {
  jest.useRealTimers();
  await resetStoresForTests();
  await flush();
  await AsyncStorage.clear();
  jest.clearAllMocks();
});

describe('createPattern', () => {
  it('uses the settings defaults', () => {
    const id = P().createPattern({ stitchId: 'twill22', name: '2/2 twill' });
    expect(pattern(id)).toMatchObject({
      id,
      kind: 'pattern',
      name: '2/2 twill',
      stitchId: 'twill22',
      warps: 24,
      row: 1,
      setup: { start: 0, mirror: false, side: 'left' },
      colors: ['#2E4C8F', '#E4DCC8'],
    });
    expect(pattern(id).createdAt).toBe(pattern(id).updatedAt);
    expect(P().order).toEqual([id]);
  });

  it('stamps createdAt and updatedAt with one instant even when the clock moves on', () => {
    // Under a busy full-suite run the millisecond can tick between building and storing.
    let t = 5000;
    const spy = jest.spyOn(Date, 'now').mockImplementation(() => (t += 1));
    try {
      const ids = [P().createPattern({ stitchId: 'plain', name: 'A' }), P().createPicture()];
      ids.push(P().duplicate(ids[0])!);
      for (const id of ids) expect(P().projects[id].updatedAt).toBe(P().projects[id].createdAt);
    } finally {
      spy.mockRestore();
    }
  });

  it('follows changed settings', () => {
    useSettings.getState().set({ defaultWarps: 40, defaultSide: 'right', defaultColors: ['#111111', '#EEEEEE'] });
    const id = P().createPattern({ stitchId: 'plain', name: 'Plain weave' });
    expect(pattern(id).warps).toBe(40);
    expect(pattern(id).setup.side).toBe('right');
    expect(pattern(id).colors).toEqual(['#111111', '#EEEEEE']);
  });

  it('takes and clamps explicit values', () => {
    const id = P().createPattern({
      stitchId: 'chevron',
      name: '  Scarf  ',
      warps: 500,
      setup: { start: 2, mirror: true },
      colors: ['#000000', '#ffffff'],
      row: 12,
    });
    expect(pattern(id)).toMatchObject({
      name: 'Scarf',
      warps: 120,
      row: 12,
      setup: { start: 2, mirror: true, side: 'left' },
      colors: ['#000000', '#ffffff'],
    });
    const low = P().createPattern({ stitchId: 'plain', name: '', warps: 1, colors: ['red', 'blue'] as [string, string] });
    expect(pattern(low).warps).toBe(4);
    expect(pattern(low).name).toBe('Pattern');
    expect(pattern(low).colors).toEqual(['#2E4C8F', '#E4DCC8']);
  });

  it('gives every project its own id', () => {
    const ids = new Set(Array.from({ length: 50 }, () => P().createPattern({ stitchId: 'plain', name: 'x' })));
    expect(ids.size).toBe(50);
  });
});

describe('createPicture', () => {
  it('uses defaults', () => {
    const id = P().createPicture();
    expect(picture(id)).toMatchObject({
      kind: 'picture',
      name: 'Picture 1',
      warps: 24,
      row: 1,
      imageUri: null,
      imageW: 0,
      imageH: 0,
      rows: 0,
      k: 4,
      tidy: true,
      weave: 'twill22',
    });
  });

  it('names with the lowest unused number', () => {
    const a = P().createPicture();
    const b = P().createPicture();
    const c = P().createPicture();
    expect([a, b, c].map((id) => picture(id).name)).toEqual(['Picture 1', 'Picture 2', 'Picture 3']);
    P().remove(b);
    expect(picture(P().createPicture()).name).toBe('Picture 2');
    expect(picture(P().createPicture()).name).toBe('Picture 4');
    P().rename(a, 'Cat');
    expect(picture(P().createPicture()).name).toBe('Picture 1');
  });

  it('takes and clamps explicit values', () => {
    const id = P().createPicture({
      warps: 2,
      imageUri: 'file:///a.jpg',
      imageW: 320,
      imageH: 200,
      rows: 1000,
      k: 99,
      tidy: false,
      weave: 'plain',
      row: 7,
      name: 'Sunset',
    });
    expect(picture(id)).toMatchObject({
      name: 'Sunset',
      warps: 4,
      imageUri: 'file:///a.jpg',
      imageW: 320,
      imageH: 200,
      rows: 400,
      k: 8,
      tidy: false,
      weave: 'plain',
      row: 7,
    });
  });
});

describe('updatePattern', () => {
  let id: string;
  beforeEach(() => {
    id = P().createPattern({ stitchId: 'twill22', name: '2/2 twill', setup: { start: 2 } });
    P().setRow(id, 9);
  });

  it('changing the stitch resets start to 0 and row to 1', () => {
    P().updatePattern(id, { stitchId: 'chevron', name: 'Chevron' });
    expect(pattern(id)).toMatchObject({ stitchId: 'chevron', name: 'Chevron', row: 1 });
    expect(pattern(id).setup.start).toBe(0);
  });

  it('setting the same stitch again resets nothing', () => {
    P().updatePattern(id, { stitchId: 'twill22' });
    expect(pattern(id).row).toBe(9);
    expect(pattern(id).setup.start).toBe(2);
  });

  it('changing start resets row to 1', () => {
    P().updatePattern(id, { setup: { start: 3 } });
    expect(pattern(id).setup.start).toBe(3);
    expect(pattern(id).row).toBe(1);
  });

  it('setting the same start keeps the row', () => {
    P().updatePattern(id, { setup: { start: 2 } });
    expect(pattern(id).row).toBe(9);
  });

  it('mirror, side, colors, warps and name do not reset the row', () => {
    P().updatePattern(id, { setup: { mirror: true } });
    P().updatePattern(id, { setup: { side: 'right' } });
    P().updatePattern(id, { colors: ['#123456', '#abcdef'] });
    P().updatePattern(id, { warps: 30 });
    P().updatePattern(id, { name: 'Renamed' });
    expect(pattern(id)).toMatchObject({
      row: 9,
      warps: 30,
      name: 'Renamed',
      colors: ['#123456', '#abcdef'],
      setup: { start: 2, mirror: true, side: 'right' },
    });
  });

  it('clamps warps and ignores bad values', () => {
    P().updatePattern(id, { warps: 3 });
    expect(pattern(id).warps).toBe(4);
    P().updatePattern(id, { warps: 121 });
    expect(pattern(id).warps).toBe(120);
    P().updatePattern(id, { warps: NaN, colors: ['nope', '#fff'] as [string, string], setup: { start: -4 } });
    expect(pattern(id).warps).toBe(120);
    expect(pattern(id).colors).toEqual(['#2E4C8F', '#E4DCC8']);
    expect(pattern(id).setup.start).toBe(2);
    expect(pattern(id).row).toBe(9);
  });

  it('does nothing for a picture project or an unknown id', () => {
    const pic = P().createPicture();
    const before = P().projects;
    P().updatePattern(pic, { warps: 50 });
    P().updatePattern('nope', { warps: 50 });
    expect(P().projects).toBe(before);
  });
});

describe('updatePicture', () => {
  let id: string;
  beforeEach(() => {
    id = P().createPicture({ imageUri: 'file:///a.jpg', imageW: 100, imageH: 50, rows: 20 });
    P().setRow(id, 6);
  });

  it('a new picture resets rows to auto and row to 1', () => {
    P().updatePicture(id, { imageUri: 'file:///b.jpg', imageW: 10, imageH: 30 });
    expect(picture(id)).toMatchObject({ imageUri: 'file:///b.jpg', imageW: 10, imageH: 30, rows: 0, row: 1 });
  });

  it('other fields keep the row', () => {
    P().updatePicture(id, { rows: 30, k: 6, tidy: false, weave: 'plain', warps: 40, imageUri: 'file:///a.jpg' });
    expect(picture(id)).toMatchObject({ rows: 30, k: 6, tidy: false, weave: 'plain', warps: 40, row: 6 });
  });

  it('clamps k, rows and warps', () => {
    P().updatePicture(id, { k: 1, rows: 2, warps: 0 });
    expect(picture(id)).toMatchObject({ k: 2, rows: 4, warps: 4 });
    P().updatePicture(id, { k: 9, rows: 401, warps: 200 });
    expect(picture(id)).toMatchObject({ k: 8, rows: 400, warps: 120 });
    P().updatePicture(id, { rows: 0 });
    expect(picture(id).rows).toBe(0);
    P().updatePicture(id, { rows: -5 });
    expect(picture(id).rows).toBe(0);
  });

  it('does nothing for a pattern project', () => {
    const pat = P().createPattern({ stitchId: 'plain', name: 'Plain weave' });
    const before = P().projects;
    P().updatePicture(pat, { k: 6 });
    expect(P().projects).toBe(before);
  });
});

describe('rename, duplicate, remove', () => {
  it('renames, ignoring empty names', () => {
    const id = P().createPicture();
    P().rename(id, '  Blanket ');
    expect(P().projects[id].name).toBe('Blanket');
    P().rename(id, '   ');
    expect(P().projects[id].name).toBe('Blanket');
  });

  it('duplicates a pattern with a new id and " copy"', () => {
    const id = P().createPattern({ stitchId: 'diamond', name: 'Diamond', warps: 36, setup: { mirror: true } });
    P().setRow(id, 5);
    const copyId = P().duplicate(id)!;
    expect(copyId).not.toBe(id);
    const { id: _a, name: _b, createdAt: _c, updatedAt: _d, ...rest } = pattern(id);
    expect(pattern(copyId)).toMatchObject(rest);
    expect(pattern(copyId).name).toBe('Diamond copy');
    expect(pattern(copyId).setup).not.toBe(pattern(id).setup);
    expect(P().order).toEqual([copyId, id]);
    expect(P().duplicate('nope')).toBeNull();
  });

  it('removes a project and forgets it as last opened', () => {
    const a = P().createPicture();
    const b = P().createPicture();
    P().open(a);
    P().remove(a);
    expect(P().projects[a]).toBeUndefined();
    expect(P().order).toEqual([b]);
    expect(P().lastOpenedId).toBeNull();
    P().open(b);
    P().remove('nope');
    expect(P().lastOpenedId).toBe(b);
  });
});

describe('picture files', () => {
  const deleteFile = jest.fn();
  beforeEach(() => {
    deleteFile.mockReset();
    configureProjectFiles({ deleteFile });
  });

  it('deletes the file with the project', () => {
    const id = P().createPicture({ imageUri: 'file:///a.jpg' });
    P().remove(id);
    expect(deleteFile).toHaveBeenCalledTimes(1);
    expect(deleteFile).toHaveBeenCalledWith('file:///a.jpg');
  });

  it('keeps a file that a duplicate still uses', () => {
    const id = P().createPicture({ imageUri: 'file:///a.jpg' });
    const dupe = P().duplicate(id)!;
    expect(picture(dupe).imageUri).toBe('file:///a.jpg');
    expect(picture(dupe).name).toBe('Picture 1 copy');
    P().remove(id);
    expect(deleteFile).not.toHaveBeenCalled();
    P().remove(dupe);
    expect(deleteFile).toHaveBeenCalledWith('file:///a.jpg');
  });

  it('deletes the old file when the picture is replaced, unless shared', () => {
    const id = P().createPicture({ imageUri: 'file:///a.jpg' });
    const dupe = P().duplicate(id)!;
    P().updatePicture(id, { imageUri: 'file:///b.jpg' });
    expect(deleteFile).not.toHaveBeenCalled();
    P().updatePicture(dupe, { imageUri: 'file:///c.jpg' });
    expect(deleteFile).toHaveBeenCalledWith('file:///a.jpg');
    P().updatePicture(id, { imageUri: null });
    expect(deleteFile).toHaveBeenCalledWith('file:///b.jpg');
    expect(deleteFile).toHaveBeenCalledTimes(2);
  });

  it('does not delete when the uri is unchanged, or for patterns and empty pictures', () => {
    const id = P().createPicture({ imageUri: 'file:///a.jpg' });
    P().updatePicture(id, { imageUri: 'file:///a.jpg', k: 5 });
    P().updatePicture(id, { k: 6 });
    P().remove(P().createPicture());
    P().remove(P().createPattern({ stitchId: 'plain', name: 'Plain weave' }));
    expect(deleteFile).not.toHaveBeenCalled();
  });

  it('survives a deleteFile that throws or rejects', async () => {
    deleteFile.mockImplementationOnce(() => {
      throw new Error('gone');
    });
    const a = P().createPicture({ imageUri: 'file:///a.jpg' });
    expect(() => P().remove(a)).not.toThrow();
    deleteFile.mockRejectedValueOnce(new Error('gone'));
    const b = P().createPicture({ imageUri: 'file:///b.jpg' });
    P().remove(b);
    await flush();
    expect(P().order).toEqual([]);
  });

  it('works with no file hooks configured', () => {
    configureProjectFiles(null);
    const id = P().createPicture({ imageUri: 'file:///a.jpg' });
    expect(() => P().remove(id)).not.toThrow();
  });
});

describe('rows', () => {
  it('setRow clamps to 1 and to maxRow', () => {
    const id = P().createPattern({ stitchId: 'plain', name: 'Plain weave' });
    P().setRow(id, 37);
    expect(P().projects[id].row).toBe(37);
    P().setRow(id, 0);
    expect(P().projects[id].row).toBe(1);
    P().setRow(id, -3);
    expect(P().projects[id].row).toBe(1);
    P().setRow(id, 50, 21);
    expect(P().projects[id].row).toBe(21);
    P().setRow(id, 4.6);
    expect(P().projects[id].row).toBe(5);
    P().setRow(id, NaN);
    expect(P().projects[id].row).toBe(5);
  });

  it('nextRow and prevRow step, never below 1, never above maxRow', () => {
    const id = P().createPicture();
    P().prevRow(id);
    expect(P().projects[id].row).toBe(1);
    P().nextRow(id);
    P().nextRow(id);
    expect(P().projects[id].row).toBe(3);
    P().nextRow(id, 3);
    expect(P().projects[id].row).toBe(3);
    P().nextRow(id, 4);
    P().nextRow(id, 4);
    expect(P().projects[id].row).toBe(4);
    P().prevRow(id);
    expect(P().projects[id].row).toBe(3);
  });

  it('clampPictureRow pulls the row back to H + 1', () => {
    const id = P().createPicture({ row: 30 });
    P().clampPictureRow(id, 40);
    expect(P().projects[id].row).toBe(30);
    P().clampPictureRow(id, 20);
    expect(P().projects[id].row).toBe(21);
    const pat = P().createPattern({ stitchId: 'plain', name: 'Plain weave', row: 30 });
    P().clampPictureRow(pat, 5);
    expect(P().projects[pat].row).toBe(30);
  });

  it('a row action that changes nothing leaves the state alone', () => {
    const a = P().createPicture();
    const b = P().createPicture();
    const before = P().projects;
    P().prevRow(a);
    P().setRow(a, 1);
    P().clampPictureRow(a, 10);
    P().nextRow(a, 1);
    expect(P().projects).toBe(before);
    expect(P().order).toEqual([b, a]);
  });
});

describe('ordering and updatedAt', () => {
  it('every mutating action bumps updatedAt and moves the project to the front', () => {
    jest.useFakeTimers({ now: 1000 });
    const a = P().createPattern({ stitchId: 'plain', name: 'A' });
    const b = P().createPicture();
    const c = P().createPattern({ stitchId: 'plain', name: 'C' });
    expect(P().order).toEqual([c, b, a]);

    const actions: [string, () => void][] = [
      [a, () => P().updatePattern(a, { warps: 30 })],
      [b, () => P().updatePicture(b, { k: 5 })],
      [a, () => P().rename(a, 'A2')],
      [b, () => P().setRow(b, 4)],
      [a, () => P().nextRow(a)],
      [b, () => P().prevRow(b)],
      [c, () => P().open(c)],
      [b, () => P().clampPictureRow(b, 1)],
    ];
    for (const [id, act] of actions) {
      jest.advanceTimersByTime(10);
      act();
      expect(P().order[0]).toBe(id);
      expect(P().projects[id].updatedAt).toBe(Date.now());
      expect(P().projects[id].createdAt).toBe(1000);
      expect([...P().order].sort()).toEqual([a, b, c].sort());
    }
  });

  it('open sets lastOpenedId', () => {
    const a = P().createPicture();
    P().createPicture();
    P().open(a);
    expect(P().lastOpenedId).toBe(a);
    expect(P().order[0]).toBe(a);
    P().open('nope');
    expect(P().lastOpenedId).toBe(a);
  });
});

describe('persistence', () => {
  it('writes to storage under the projects key', async () => {
    const id = P().createPattern({ stitchId: 'plain', name: 'Plain weave' });
    await flush();
    const saved = JSON.parse((await AsyncStorage.getItem(PROJECTS_KEY))!);
    expect(saved.version).toBe(1);
    expect(saved.state.order).toEqual([id]);
    expect(saved.state.projects[id].name).toBe('Plain weave');
    expect(Object.keys(saved.state).sort()).toEqual(['lastOpenedId', 'order', 'projects']);
  });

  it('survives a restart', async () => {
    const a = P().createPattern({ stitchId: 'herring', name: 'Herringbone', warps: 32 });
    const b = P().createPicture({ imageUri: 'file:///a.jpg', rows: 12 });
    P().setRow(a, 14);
    P().open(a);
    const before = { projects: P().projects, order: P().order, lastOpenedId: P().lastOpenedId };
    await flush();
    const stored = await AsyncStorage.getItem(PROJECTS_KEY);

    await resetStoresForTests();
    await flush();
    expect(P().order).toEqual([]);
    await AsyncStorage.setItem(PROJECTS_KEY, stored!);
    await rehydrateStores();

    expect({ projects: P().projects, order: P().order, lastOpenedId: P().lastOpenedId }).toEqual(before);
    expect(P().order).toEqual([a, b]);
    P().nextRow(a);
    expect(P().projects[a].row).toBe(15);
  });

  it('cleans up damaged saved state', async () => {
    await AsyncStorage.setItem(
      PROJECTS_KEY,
      JSON.stringify({
        version: 1,
        state: {
          projects: {
            a: { id: 'a', kind: 'pattern', name: 'A', warps: 999, row: -2, stitchId: 'plain', setup: { start: 1, side: 'up' }, colors: ['x'], createdAt: 5, updatedAt: 9 },
            b: { id: 'b', kind: 'picture', name: '', warps: 20, row: 3, imageUri: 7, rows: 2, k: 40, weave: 'satin', createdAt: 5, updatedAt: 20 },
            c: { id: 'c', kind: 'mystery' },
            d: 'not a project',
          },
          order: ['zzz', 'a', 'a'],
          lastOpenedId: 'c',
        },
      }),
    );
    await rehydrateStores();
    expect(P().order).toEqual(['a', 'b']);
    expect(P().lastOpenedId).toBeNull();
    expect(P().projects.a).toMatchObject({ warps: 120, row: 1, setup: { start: 1, mirror: false, side: 'left' }, colors: ['#2E4C8F', '#E4DCC8'] });
    expect(P().projects.b).toMatchObject({ name: 'Picture 1', imageUri: null, imageW: 0, rows: 4, k: 8, tidy: true, weave: 'twill22' });
  });

  it('migrates v0, where projects were an array with no order', async () => {
    await AsyncStorage.setItem(
      PROJECTS_KEY,
      JSON.stringify({
        version: 0,
        state: {
          projects: [
            { id: 'old', kind: 'pattern', name: 'Old', warps: 24, row: 3, stitchId: 'twill22', setup: { start: 0, mirror: false, side: 'left' }, colors: ['#2E4C8F', '#E4DCC8'], createdAt: 1, updatedAt: 10 },
            { id: 'new', kind: 'picture', name: 'Picture 1', warps: 24, row: 1, imageUri: null, imageW: 0, imageH: 0, rows: 0, k: 4, tidy: true, weave: 'twill22', createdAt: 2, updatedAt: 20 },
          ],
          lastOpenedId: 'old',
        },
      }),
    );
    await rehydrateStores();
    expect(P().order).toEqual(['new', 'old']);
    expect(P().projects.old).toMatchObject({ name: 'Old', row: 3 });
    expect(P().lastOpenedId).toBe('old');
    await flush();
    const saved = JSON.parse((await AsyncStorage.getItem(PROJECTS_KEY))!);
    expect(saved.version).toBe(1);
    expect(Array.isArray(saved.state.projects)).toBe(false);
    expect(saved.state.order).toEqual(['new', 'old']);
  });

  it('starts empty when the saved state is not JSON', async () => {
    P().createPicture();
    await flush();
    await AsyncStorage.setItem(PROJECTS_KEY, '{oops');
    await rehydrateStores();
    const id = P().createPicture();
    expect(P().projects[id]).toBeDefined();
  });

  it('keeps working in memory when storage throws', async () => {
    const boom = () => {
      throw new Error('storage is broken');
    };
    const realSet = (AsyncStorage.setItem as jest.Mock).getMockImplementation()!;
    const realGet = (AsyncStorage.getItem as jest.Mock).getMockImplementation()!;
    (AsyncStorage.setItem as jest.Mock).mockImplementation(boom);
    (AsyncStorage.getItem as jest.Mock).mockImplementation(boom);
    try {
      await rehydrateStores();
      const id = P().createPattern({ stitchId: 'plain', name: 'Plain weave' });
      P().nextRow(id);
      P().updatePattern(id, { warps: 28 });
      await flush();
      expect(P().projects[id]).toMatchObject({ row: 2, warps: 28 });

      (AsyncStorage.setItem as jest.Mock).mockRejectedValue(new Error('quota'));
      (AsyncStorage.getItem as jest.Mock).mockRejectedValue(new Error('denied'));
      await rehydrateStores();
      P().nextRow(id);
      await flush();
      expect(P().projects[id].row).toBe(3);
    } finally {
      (AsyncStorage.setItem as jest.Mock).mockImplementation(realSet);
      (AsyncStorage.getItem as jest.Mock).mockImplementation(realGet);
    }
  });
});

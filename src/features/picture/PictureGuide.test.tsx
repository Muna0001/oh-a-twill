import { act, fireEvent, render, screen } from '@testing-library/react-native';

import type { PaletteColor } from '@/engine';
import type { BuildPictureParams, BuiltPicture } from '@/media';
import { resetStoresForTests, useProjects, useSettings, type PictureProject } from '@/store';

import { pictureCopy } from './copy';
import { PictureGuide } from './PictureGuide';
import { REBUILD_DELAY_MS } from './usePictureGrid';

jest.mock('expo-router', () => ({
  router: { back: jest.fn(), replace: jest.fn(), push: jest.fn(), canGoBack: jest.fn(() => false) },
  useIsFocused: () => true,
}));

jest.mock('@/media', () => {
  const { copy, messageFor } = jest.requireActual('@/media/copy');
  const { PictureError } = jest.requireActual('@/media/errors');
  return {
    copy,
    messageFor,
    PictureError,
    buildPicture: jest.fn(),
    pickPicture: jest.fn(),
    importPictureFile: jest.fn(),
    thumbnailSource: jest.fn((uri: string) => Promise.resolve(`thumb:${uri}`)),
  };
});

// The haptic and the ← / → handlers, to check that only the Row done tap plays the haptic.
const mockHaptic = jest.fn();
const mockKeys: { next?: () => void } = {};
jest.mock('@/platform', () => ({
  ...jest.requireActual('@/platform'),
  tapHaptic: () => mockHaptic(),
  useRowKeys: (_prev: () => void, next: () => void) => {
    mockKeys.next = next;
  },
}));

// eslint-disable-next-line @typescript-eslint/no-require-imports
const media = require('@/media') as {
  buildPicture: jest.Mock<Promise<BuiltPicture>, [BuildPictureParams]>;
  pickPicture: jest.Mock;
  PictureError: new (code: string) => Error;
};
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { router } = require('expo-router') as { router: { replace: jest.Mock } };

const palette: PaletteColor[] = [
  { rgb: [255, 255, 255], hex: '#ffffff', name: 'White', count: 10 },
  { rgb: [0, 0, 128], hex: '#000080', name: 'Dark blue', count: 6 },
];

/**
 * 4 warps wide, H rows. Top row first: plain white rows, then 0111, then 1110 at the bottom.
 * Row 1 (the bottom) has Dark blue on warps 1–3 and White on warp 4.
 */
function fixture(H: number): BuiltPicture {
  const rows: number[][] = [];
  for (let y = 0; y < H - 2; y++) rows.push([0, 0, 0, 0]);
  rows.push([0, 1, 1, 1], [1, 1, 1, 0]);
  return { W: 4, H, grid: Uint8Array.from(rows.flat()), palette, autoH: 4 };
}

const hidden = { includeHiddenElements: true };

function project(id: string): PictureProject {
  return useProjects.getState().projects[id] as PictureProject;
}

function seed(extra: Partial<PictureProject> = {}): string {
  return useProjects.getState().createPicture({ name: 'Flower', imageUri: 'pic://1', imageW: 240, imageH: 300, ...extra });
}

/** Let the debounce run out and the build promise settle. */
async function settle() {
  await act(async () => {
    jest.advanceTimersByTime(REBUILD_DELAY_MS + 10);
  });
  await act(async () => {
    await Promise.resolve();
  });
}

beforeEach(async () => {
  jest.useFakeTimers();
  await resetStoresForTests();
  media.buildPicture.mockReset();
  media.buildPicture.mockImplementation((p) => Promise.resolve(fixture(p.rows || 4)));
  media.pickPicture.mockReset();
  router.replace.mockClear();
});

afterEach(() => {
  jest.useRealTimers();
});

describe('PictureGuide', () => {
  it('shows the add card with a disabled bar when there is no picture', async () => {
    const id = useProjects.getState().createPicture({ name: 'Empty' });
    await render(<PictureGuide projectId={id} />);
    await settle();
    expect(screen.getByText(pictureCopy.addTitle)).toBeTruthy();
    expect(screen.getByText(pictureCopy.addHint)).toBeTruthy();
    expect(screen.getByText(pictureCopy.warpFit(24))).toBeTruthy();
    expect(screen.getByTestId('picture-prev')).toBeDisabled();
    expect(screen.getByTestId('picture-next')).toBeDisabled();
    expect(screen.queryByText('Row 1')).toBeNull();
    expect(media.buildPicture).not.toHaveBeenCalled();
    expect(useProjects.getState().lastOpenedId).toBe(id);
  });

  it('stores the picked picture on the project and builds it', async () => {
    media.pickPicture.mockResolvedValue({ uri: 'pic://new', width: 240, height: 300 });
    const id = useProjects.getState().createPicture({ name: 'New' });
    await render(<PictureGuide projectId={id} />);
    await fireEvent.press(screen.getByText(pictureCopy.choose));
    expect(media.pickPicture).toHaveBeenCalledWith('library');
    expect(project(id)).toMatchObject({ imageUri: 'pic://new', imageW: 240, imageH: 300, rows: 0, row: 1 });
    await settle();
    expect(media.buildPicture).toHaveBeenCalledTimes(1);
    expect(media.buildPicture).toHaveBeenLastCalledWith({ imageUri: 'pic://new', imageW: 240, imageH: 300, warps: 24, rows: 0, k: 4, tidy: true });
    expect(screen.getByText(pictureCopy.size(4, 4, 2))).toBeTruthy();
    expect(screen.getByText('10 squares')).toBeTruthy();
    expect(screen.getByTestId('picture-next')).not.toBeDisabled();
  });

  it('shows the sections of row 1 (the bottom row) and notices a repeated row', async () => {
    const id = seed();
    await render(<PictureGuide projectId={id} />);
    await settle();
    expect(screen.getByTestId('picture-row-card')).toHaveTextContent(/^Row 1of 4/);
    expect(screen.getByTestId('picture-bar')).toHaveTextContent(/Row 1/);
    expect(screen.getByText('2 sections')).toBeTruthy();
    expect(screen.getByTestId('picture-row-sub')).toHaveTextContent(pictureCopy.weaveEach);
    const chips = screen.getAllByTestId('picture-sections-section');
    expect(chips).toHaveLength(2);
    expect(chips[0]).toHaveTextContent('Dark bluewarps 1–3, start over 2');
    expect(chips[1]).toHaveTextContent('Whitewarp 4, start under 1');
    expect(screen.queryByText(pictureCopy.restart)).toBeNull();

    // Row 4 (the top) is the same as row 3.
    await act(async () => useProjects.getState().setRow(id, 4));
    expect(screen.getByText('1 section')).toBeTruthy();
    expect(screen.getByTestId('picture-row-sub')).toHaveTextContent(pictureCopy.same);
    expect(screen.getByText(pictureCopy.restart)).toBeTruthy();
    await fireEvent.press(screen.getByText(pictureCopy.restart));
    expect(project(id).row).toBe(1);
  });

  it('rebuilds for colors, rows, cleanup and warps, but not for the weave', async () => {
    const id = seed();
    await render(<PictureGuide projectId={id} />);
    await settle();
    expect(media.buildPicture).toHaveBeenCalledTimes(1);

    await fireEvent.press(screen.getByLabelText(pictureCopy.moreColors));
    expect(screen.getByText(pictureCopy.updating)).toBeTruthy();
    // The previous grid stays up while the new one builds.
    expect(screen.getByTestId('picture-row-card')).toHaveTextContent(/^Row 1of 4/);
    await settle();
    expect(media.buildPicture).toHaveBeenCalledTimes(2);
    expect(media.buildPicture).toHaveBeenLastCalledWith(expect.objectContaining({ k: 5 }));
    expect(screen.queryByText(pictureCopy.updating)).toBeNull();

    await fireEvent.press(screen.getByLabelText(pictureCopy.weavePlain));
    expect(project(id).weave).toBe('plain');
    expect(screen.getByText(pictureCopy.how('plain'))).toBeTruthy();
    await settle();
    expect(media.buildPicture).toHaveBeenCalledTimes(2);

    await fireEvent.press(screen.getByLabelText(pictureCopy.tidy));
    await settle();
    expect(media.buildPicture).toHaveBeenCalledTimes(3);
    expect(media.buildPicture).toHaveBeenLastCalledWith(expect.objectContaining({ tidy: false }));

    await fireEvent.press(screen.getByLabelText(pictureCopy.moreRows));
    await settle();
    expect(media.buildPicture).toHaveBeenCalledTimes(4);
    expect(media.buildPicture).toHaveBeenLastCalledWith(expect.objectContaining({ rows: 5 }));

    await fireEvent.press(screen.getByLabelText(pictureCopy.moreWarps));
    await settle();
    expect(media.buildPicture).toHaveBeenCalledTimes(5);
    expect(media.buildPicture).toHaveBeenLastCalledWith(expect.objectContaining({ warps: 25 }));
  });

  it('debounces quick changes into one build', async () => {
    const id = seed();
    await render(<PictureGuide projectId={id} />);
    await settle();
    await fireEvent.press(screen.getByLabelText(pictureCopy.moreColors));
    await fireEvent.press(screen.getByLabelText(pictureCopy.moreColors));
    await fireEvent.press(screen.getByLabelText(pictureCopy.moreColors));
    await settle();
    expect(media.buildPicture).toHaveBeenCalledTimes(2);
    expect(media.buildPicture).toHaveBeenLastCalledWith(expect.objectContaining({ k: 7 }));
  });

  it('stops at H + 1 and shows Finished', async () => {
    const id = seed();
    await render(<PictureGuide projectId={id} />);
    await settle();
    expect(screen.getByTestId('picture-prev')).toBeDisabled();
    for (let i = 0; i < 4; i++) await fireEvent.press(screen.getByTestId('picture-next'));
    expect(project(id).row).toBe(5);
    expect(screen.getAllByText(pictureCopy.finished).length).toBeGreaterThan(0);
    expect(screen.getByText(pictureCopy.finishedSub(4))).toBeTruthy();
    expect(screen.getByTestId('picture-next')).toBeDisabled();
    expect(screen.getByTestId('picture-prev')).not.toBeDisabled();
    await fireEvent.press(screen.getByTestId('picture-next'));
    expect(project(id).row).toBe(5);
    await fireEvent.press(screen.getByTestId('picture-prev'));
    expect(project(id).row).toBe(4);
  });

  it('plays the haptic on the Row done tap only, and only when the setting is on', async () => {
    mockHaptic.mockClear();
    const id = seed();
    await render(<PictureGuide projectId={id} />);
    await settle();
    await fireEvent.press(screen.getByTestId('picture-next'));
    expect(project(id).row).toBe(2);
    expect(mockHaptic).toHaveBeenCalledTimes(1);
    // Arrow keys move the row without a haptic.
    await act(async () => mockKeys.next!());
    expect(project(id).row).toBe(3);
    expect(mockHaptic).toHaveBeenCalledTimes(1);
    await act(async () => useSettings.getState().set({ haptics: false }));
    await fireEvent.press(screen.getByTestId('picture-next'));
    expect(project(id).row).toBe(4);
    expect(mockHaptic).toHaveBeenCalledTimes(1);
  });

  it('clamps the row when the picture gets shorter', async () => {
    const id = seed({ rows: 8, row: 8 });
    await render(<PictureGuide projectId={id} />);
    await settle();
    expect(project(id).row).toBe(8);
    await act(async () => useProjects.getState().updatePicture(id, { rows: 5 }));
    await settle();
    expect(project(id).row).toBe(6);
    expect(screen.getByText(pictureCopy.finishedSub(5))).toBeTruthy();
  });

  it('jumps to a row from the woven preview', async () => {
    const id = seed();
    await render(<PictureGuide projectId={id} />);
    await settle();
    const cell = screen.getByTestId('picture-preview-mark', hidden).props.style.height as number;
    await fireEvent.press(screen.getByTestId('picture-preview-press', hidden), { nativeEvent: { locationY: cell / 2 } });
    expect(project(id).row).toBe(4);
  });

  it('shows the reference error when the picture cannot be read', async () => {
    media.buildPicture.mockImplementation(() => Promise.reject(new Error('boom')));
    const id = seed();
    await render(<PictureGuide projectId={id} />);
    await settle();
    expect(screen.getByText('That picture couldn’t be read. Try a JPG or PNG.')).toBeTruthy();
    expect(screen.getByText(pictureCopy.addTitle)).toBeTruthy();
    expect(screen.getByTestId('picture-next')).toBeDisabled();
  });

  it('shows the reference error when the file is not a picture', async () => {
    media.pickPicture.mockRejectedValue(new media.PictureError('not-image'));
    const id = useProjects.getState().createPicture({ name: 'New' });
    await render(<PictureGuide projectId={id} />);
    await fireEvent.press(screen.getByText(pictureCopy.choose));
    expect(screen.getByText('That file isn’t a picture. Try a JPG or PNG.')).toBeTruthy();
    expect(project(id).imageUri).toBeNull();
  });

  it('“Match the picture’s shape” goes back to auto rows', async () => {
    const id = seed({ rows: 6 });
    await render(<PictureGuide projectId={id} />);
    await settle();
    expect(screen.getByText(pictureCopy.size(4, 6, 2))).toBeTruthy();
    await fireEvent.press(screen.getByText(pictureCopy.matchShape));
    expect(project(id).rows).toBe(0);
    await settle();
    expect(screen.getByText(pictureCopy.size(4, 4, 2))).toBeTruthy();
    expect(screen.queryByText(pictureCopy.matchShape)).toBeNull();
  });

  it('renders the fallback for a missing or non-picture project', async () => {
    await render(<PictureGuide projectId="nope" />);
    expect(screen.getByText(pictureCopy.missingTitle)).toBeTruthy();
    await fireEvent.press(screen.getByText(pictureCopy.missingAction));
    expect(router.replace).toHaveBeenCalledWith('/projects');

    const patternId = useProjects.getState().createPattern({ stitchId: 'twill22', name: '2/2 twill' });
    await render(<PictureGuide projectId={patternId} />);
    expect(screen.getByText(pictureCopy.missingTitle)).toBeTruthy();
  });
});

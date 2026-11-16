import { act, fireEvent, render, screen, within } from '@testing-library/react-native';

import { DEFAULTS } from '@/engine';
import type { LegacyData } from '@/platform/legacyImport';
import { resetStoresForTests, useProjects, useSettings } from '@/store';

import { LibraryScreen, StitchDetailScreen } from './index';

jest.mock('expo-router', () => ({
  router: { push: jest.fn(), replace: jest.fn(), back: jest.fn(), canGoBack: jest.fn(() => true) },
}));

jest.mock('@/platform/legacyImport', () => ({ readLegacy: jest.fn(() => null) }));

jest.mock('@/media', () => ({
  importPictureDataUrl: jest.fn(async () => ({ uri: 'idb://pic-1', width: 240, height: 300 })),
}));

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { router } = require('expo-router') as { router: { push: jest.Mock; replace: jest.Mock } };
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { readLegacy } = require('@/platform/legacyImport') as { readLegacy: jest.Mock };
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { importPictureDataUrl } = require('@/media') as { importPictureDataUrl: jest.Mock };

const cardIds = () => screen.queryAllByTestId(/^stitch-card-/).map((el) => String(el.props.testID).replace('stitch-card-', ''));

const legacy: LegacyData = {
  warps: 32,
  pattern: { stitchId: 'herring', setup: { start: 2, mirror: true, side: 'right' }, colors: ['#112233', '#AABBCC'], row: 17 },
  picture: { src: 'data:image/jpeg;base64,/9j/4AAQ', rows: 40, k: 6, tidy: false, weave: 'plain', row: 9 },
  mode: 'pat',
};

beforeEach(async () => {
  await resetStoresForTests();
  jest.clearAllMocks();
  readLegacy.mockReturnValue(null);
});

describe('LibraryScreen', () => {
  it('shows the title and every stitch', async () => {
    await render(<LibraryScreen />);
    expect(screen.getByText('Stitches')).toBeTruthy();
    expect(cardIds()).toContain('twill22');
    expect(cardIds()).toContain('hounds');
    expect(cardIds().length).toBeGreaterThan(10);
  });

  it('narrows the grid by category', async () => {
    await render(<LibraryScreen />);
    await fireEvent.press(screen.getByTestId('filter-color'));
    const ids = cardIds();
    expect(ids).toContain('hounds');
    expect(ids).toContain('logcabin');
    expect(ids).not.toContain('twill22');
    expect(ids).not.toContain('plain');
    await fireEvent.press(screen.getByTestId('filter-basics'));
    expect(cardIds()).toContain('plain');
    expect(cardIds()).not.toContain('hounds');
  });

  it('narrows the grid by name and alias, with an empty state', async () => {
    await render(<LibraryScreen />);
    await fireEvent.changeText(screen.getByTestId('library-search'), 'dogtooth');
    expect(cardIds()).toEqual(['hounds']);
    await fireEvent.changeText(screen.getByTestId('library-search'), 'satin');
    expect(cardIds()).toEqual([]);
    expect(screen.getByText('No stitches match')).toBeTruthy();
    await fireEvent.press(screen.getByText('Show all stitches'));
    expect(cardIds().length).toBeGreaterThan(10);
  });

  it('shows only favourites under Favorites', async () => {
    await render(<LibraryScreen />);
    await fireEvent.press(screen.getByTestId('filter-favorites'));
    expect(cardIds()).toEqual([]);
    expect(screen.getByText('No favorites yet')).toBeTruthy();
    await act(async () => {
      useSettings.getState().toggleFavourite('hounds');
      useSettings.getState().toggleFavourite('basket');
    });
    expect(await screen.findByTestId('stitch-card-hounds')).toBeTruthy();
    expect(cardIds().sort()).toEqual(['basket', 'hounds']);
    expect(within(screen.getByTestId('stitch-card-hounds')).getByLabelText('Favorite')).toBeTruthy();
  });

  it('labels each card and opens the stitch', async () => {
    await render(<LibraryScreen />);
    const card = screen.getByTestId('stitch-card-twill22');
    expect(card.props.accessibilityLabel).toBe('2/2 twill. Over 2, under 2, shifting one warp each row to make a diagonal.');
    // The overview has no difficulty dots.
    expect(within(card).queryByLabelText(/Difficulty/)).toBeNull();
    await fireEvent.press(card);
    expect(router.push).toHaveBeenCalledWith('/stitch/twill22');
  });

  it('offers Quick start with no projects and creates a 2/2 twill on 24 warps', async () => {
    await render(<LibraryScreen />);
    expect(screen.getByText('2/2 twill on 24 warps')).toBeTruthy();
    expect(screen.queryByTestId('continue-card')).toBeNull();
    await fireEvent.press(within(screen.getByTestId('quick-start-card')).getByText('Start weaving'));
    const { projects, lastOpenedId, order } = useProjects.getState();
    expect(order).toHaveLength(1);
    const p = projects[order[0]];
    expect(p).toMatchObject({ kind: 'pattern', stitchId: 'twill22', name: '2/2 twill', warps: 24, row: 1, colors: [...DEFAULTS.colors] });
    expect(lastOpenedId).toBe(p.id);
    expect(router.push).toHaveBeenCalledWith(`/project/${p.id}`);
  });

  it('uses Settings defaults for Quick start', async () => {
    useSettings.getState().set({ defaultWarps: 30, defaultSide: 'right' });
    await render(<LibraryScreen />);
    expect(screen.getByText('2/2 twill on 30 warps')).toBeTruthy();
    await fireEvent.press(within(screen.getByTestId('quick-start-card')).getByText('Start weaving'));
    const { projects, order } = useProjects.getState();
    expect(projects[order[0]]).toMatchObject({ warps: 30, setup: { side: 'right', start: 0, mirror: false } });
  });

  it('shows Continue for the last opened project', async () => {
    const { createPattern, setRow, open } = useProjects.getState();
    const id = createPattern({ stitchId: 'herring', name: 'Herringbone scarf', warps: 28 });
    setRow(id, 37);
    open(id);
    await render(<LibraryScreen />);
    const card = screen.getByTestId('continue-card');
    expect(within(card).getByText('Herringbone scarf')).toBeTruthy();
    expect(within(card).getByText('Row 37 · 28 warps')).toBeTruthy();
    expect(screen.queryByTestId('quick-start-card')).toBeNull();
    await fireEvent.press(within(card).getByLabelText('Continue weaving Herringbone scarf'));
    expect(router.push).toHaveBeenCalledWith(`/project/${id}`);
  });

  it('shows neither card when projects exist but none was opened', async () => {
    useProjects.getState().createPattern({ stitchId: 'plain', name: 'Plain' });
    await render(<LibraryScreen />);
    expect(screen.queryByTestId('continue-card')).toBeNull();
    expect(screen.queryByTestId('quick-start-card')).toBeNull();
  });
});

describe('legacy import offer', () => {
  it('does not show without old data', async () => {
    await render(<LibraryScreen />);
    expect(screen.queryByText('Bring over your weaving from the old helper')).toBeNull();
  });

  it('is not shown again after Not now', async () => {
    readLegacy.mockReturnValue(legacy);
    const { unmount } = await render(<LibraryScreen />);
    expect(screen.getByText('Bring over your weaving from the old helper')).toBeTruthy();
    await fireEvent.press(screen.getByText('Not now'));
    expect(screen.queryByTestId('legacy-offer')).toBeNull();
    expect(useSettings.getState().legacyImportHandled).toBe(true);
    expect(useProjects.getState().order).toHaveLength(0);
    await unmount();
    await render(<LibraryScreen />);
    expect(screen.queryByTestId('legacy-offer')).toBeNull();
  });

  it('holds Quick start back until the offer is answered', async () => {
    readLegacy.mockReturnValue(legacy);
    await render(<LibraryScreen />);
    expect(screen.getByTestId('legacy-offer')).toBeTruthy();
    expect(screen.queryByTestId('quick-start-card')).toBeNull();
    await fireEvent.press(screen.getByText('Not now'));
    expect(screen.getByTestId('quick-start-card')).toBeTruthy();
  });

  it('brings over the pattern and the picture', async () => {
    readLegacy.mockReturnValue(legacy);
    await render(<LibraryScreen />);
    await fireEvent.press(screen.getByText('Bring it over'));
    expect(await screen.findByTestId('continue-card')).toBeTruthy();
    expect(screen.queryByTestId('legacy-offer')).toBeNull();
    expect(useSettings.getState().legacyImportHandled).toBe(true);
    expect(importPictureDataUrl).toHaveBeenCalledWith(legacy.picture!.src);
    const all = Object.values(useProjects.getState().projects);
    expect(all).toHaveLength(2);
    const pattern = all.find((p) => p.kind === 'pattern');
    const picture = all.find((p) => p.kind === 'picture');
    expect(pattern).toMatchObject({ name: 'Herringbone', stitchId: 'herring', warps: 32, row: 17, setup: { start: 2, mirror: true, side: 'right' }, colors: ['#112233', '#AABBCC'] });
    expect(picture).toMatchObject({ imageUri: 'idb://pic-1', imageW: 240, imageH: 300, rows: 40, k: 6, tidy: false, weave: 'plain', row: 9, warps: 32 });
    expect(useProjects.getState().lastOpenedId).toBe(pattern!.id);
  });

  it('still brings the pattern over when the picture fails', async () => {
    readLegacy.mockReturnValue({ ...legacy, picture: legacy.picture, mode: 'pic' });
    importPictureDataUrl.mockRejectedValueOnce(new Error('decode'));
    await render(<LibraryScreen />);
    await fireEvent.press(screen.getByText('Bring it over'));
    expect(await screen.findByTestId('continue-card')).toBeTruthy();
    const all = Object.values(useProjects.getState().projects);
    expect(all.map((p) => p.kind)).toEqual(['pattern']);
    expect(useSettings.getState().legacyImportHandled).toBe(true);
  });
});

describe('StitchDetailScreen', () => {
  it('shows the stitch with its repeat, math and tips', async () => {
    await render(<StitchDetailScreen id="twill22" />);
    expect(screen.getByText('2/2 twill')).toBeTruthy();
    expect(screen.getByText('Also called Two-two twill, Even twill')).toBeTruthy();
    expect(screen.getByText('The repeat')).toBeTruthy();
    expect(screen.getByLabelText('1. Over 2, under 2')).toBeTruthy();
    expect(screen.getByText('The math')).toBeTruthy();
    expect(screen.getByText('Tips')).toBeTruthy();
    expect(screen.getByLabelText('Difficulty: Beginner, 1 of 3')).toBeTruthy();
    expect(screen.getByText('Beginner')).toBeTruthy();
    expect(screen.queryByTestId('color-order')).toBeNull();
  });

  it('shows the warp winding order for houndstooth', async () => {
    await render(<StitchDetailScreen id="hounds" />);
    expect(screen.getByText('Two colors')).toBeTruthy();
    expect(screen.getByText('This pattern uses Color A and Color B in both the warp and the weft.')).toBeTruthy();
    expect(screen.getByText('Wind the warp')).toBeTruthy();
    expect(screen.getByText('Weave the weft')).toBeTruthy();
    expect(screen.getByLabelText('4 Color A, then 4 Color B. Repeat across the warp.')).toBeTruthy();
    expect(screen.getByLabelText('4 Color A, then 4 Color B. Repeat up the cloth.')).toBeTruthy();
    expect(screen.getByLabelText('Difficulty: Intermediate, 2 of 3')).toBeTruthy();
  });

  it('groups log cabin’s color order and labels its difficulty', async () => {
    await render(<StitchDetailScreen id="logcabin" />);
    expect(
      screen.getByLabelText(
        '6 rows alternating Color A and Color B, starting with A, then 6 rows alternating Color B and Color A, starting with B. Repeat up the cloth.',
      ),
    ).toBeTruthy();
    expect(screen.getByLabelText('Difficulty: Advanced, 3 of 3')).toBeTruthy();
  });

  it('says only the weft uses both colors for weft stripes', async () => {
    await render(<StitchDetailScreen id="weftstripes" />);
    expect(screen.getByText('Colors')).toBeTruthy();
    expect(screen.getByText('This pattern uses Color A and Color B in the weft. The warp is all Color B.')).toBeTruthy();
    expect(screen.queryByTestId('color-order-warp')).toBeNull();
    expect(screen.getByLabelText('2 Color A, then 2 Color B. Repeat up the cloth.')).toBeTruthy();
  });

  it('starts weaving with the stitch id', async () => {
    await render(<StitchDetailScreen id="hounds" />);
    await fireEvent.press(screen.getByTestId('start-weaving'));
    expect(router.push).toHaveBeenCalledWith('/project/new?stitch=hounds');
  });

  it('toggles the favourite in the settings store', async () => {
    await render(<StitchDetailScreen id="hounds" />);
    await fireEvent.press(screen.getByLabelText('Add to favorites'));
    expect(useSettings.getState().favourites).toEqual(['hounds']);
    expect(screen.getByLabelText('Remove from favorites')).toBeTruthy();
    await fireEvent.press(screen.getByLabelText('Remove from favorites'));
    expect(useSettings.getState().favourites).toEqual([]);
  });

  it('starts the math at the default warp count and follows the stepper', async () => {
    useSettings.getState().set({ defaultWarps: 26 });
    await render(<StitchDetailScreen id="twill22" />);
    expect(screen.getByTestId('warp-fit')).toHaveTextContent('6 repeats of 4, plus 2 extra');
    expect(screen.getByText('Across your 26 warps')).toBeTruthy();
    await fireEvent.press(screen.getByLabelText('Fewer warps'));
    await fireEvent.press(screen.getByLabelText('Fewer warps'));
    expect(screen.getByTestId('warp-fit')).toHaveTextContent('6 repeats of 4, clean edges');
    expect(screen.getByText('Across your 24 warps')).toBeTruthy();
  });

  it('switches the preview between front and back', async () => {
    await render(<StitchDetailScreen id="twill21" />);
    expect(screen.getByLabelText(/front$/)).toBeTruthy();
    await fireEvent.press(screen.getByRole('radio', { name: 'Back of the cloth' }));
    expect(screen.getByLabelText(/, back$/)).toBeTruthy();
  });

  it('shows not found for an unknown id', async () => {
    await render(<StitchDetailScreen id="satin" />);
    expect(screen.getByText('Stitch not found')).toBeTruthy();
    await fireEvent.press(screen.getByText('Back to stitches'));
    expect(router.replace).toHaveBeenCalledWith('/');
  });
});

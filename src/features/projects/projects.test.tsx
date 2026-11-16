import { fireEvent, render, screen } from '@testing-library/react-native';
import { router } from 'expo-router';

import { getStitch } from '@/catalog';
import { tileRowName } from '@/engine';
import { resetStoresForTests, useProjects, useSettings } from '@/store';

import { fitHint } from './helpers';
import { ProjectScreen } from './ProjectScreen';
import { ProjectSetupScreen } from './ProjectSetupScreen';
import { ProjectsScreen } from './ProjectsScreen';
import { SettingsScreen } from './SettingsScreen';

jest.mock('expo-router', () => ({
  router: { push: jest.fn(), replace: jest.fn(), back: jest.fn(), navigate: jest.fn(), canGoBack: jest.fn(() => false) },
}));

jest.mock('@/features/guide', () => {
  const { Text } = jest.requireActual('react-native');
  return { PatternGuide: ({ projectId }: { projectId: string }) => <Text>{`pattern guide ${projectId}`}</Text> };
});

jest.mock('@/features/picture', () => {
  const { Text } = jest.requireActual('react-native');
  return { PictureGuide: ({ projectId }: { projectId: string }) => <Text>{`picture guide ${projectId}`}</Text> };
});

jest.mock('@/media', () => ({ thumbnailSource: jest.fn(() => Promise.resolve('blob:thumb')) }));

const mockedRouter = router as jest.Mocked<typeof router>;
const twill = getStitch('twill22')!;
const hounds = getStitch('hounds')!;

const project = (id: string) => useProjects.getState().projects[id];

beforeEach(async () => {
  await resetStoresForTests();
  jest.clearAllMocks();
});

describe('fit hint', () => {
  it('uses the reference wording, with colour repeats in the width', () => {
    expect(fitHint(twill, 24)).toBe('6 repeats of 4, clean edges');
    expect(fitHint(twill, 26)).toBe('6 repeats of 4, plus 2 extra');
    expect(fitHint(hounds, 24)).toBe('3 repeats of 8, clean edges');
  });

  it('follows the warp stepper on the setup screen', async () => {
    await render(<ProjectSetupScreen stitchId="twill22" />);
    expect(screen.getByText('6 repeats of 4, clean edges')).toBeTruthy();
    await fireEvent.press(screen.getByLabelText('More warps'));
    await fireEvent.press(screen.getByLabelText('More warps'));
    expect(screen.getByText('6 repeats of 4, plus 2 extra')).toBeTruthy();
  });

  it('shows houndstooth’s 8-warp repeat and its warp order', async () => {
    await render(<ProjectSetupScreen stitchId="hounds" />);
    expect(screen.getByText('3 repeats of 8, clean edges')).toBeTruthy();
    expect(screen.getByText('Wind the warp')).toBeTruthy();
    expect(screen.getByLabelText('4 Color A, then 4 Color B. Repeat across the warp.')).toBeTruthy();
    expect(screen.getByLabelText('4 Color A, then 4 Color B. Repeat up the cloth.')).toBeTruthy();
  });

  it('shows log cabin’s warp order grouped, not as a list of runs', async () => {
    await render(<ProjectSetupScreen stitchId="logcabin" />);
    expect(
      screen.getByLabelText(
        '6 threads alternating Color A and Color B, starting with A, then 6 threads alternating Color B and Color A, starting with B. Repeat across the warp.',
      ),
    ).toBeTruthy();
  });

  it('shows no color order for a one-color stitch', async () => {
    await render(<ProjectSetupScreen stitchId="twill22" />);
    expect(screen.queryByTestId('setup-warp-order')).toBeNull();
    expect(screen.queryByTestId('setup-weft-order')).toBeNull();
  });
});

describe('ProjectSetupScreen, new project', () => {
  it('names the Start on buttons with tileRowName', async () => {
    await render(<ProjectSetupScreen stitchId="twill22" />);
    const setup = { start: 0, mirror: false, side: 'left' as const };
    for (let k = 0; k < twill.tile.length; k++) {
      expect(screen.getByRole('radio', { name: tileRowName(twill, setup, k) })).toBeTruthy();
    }
    expect(screen.getByRole('radio', { name: 'Over 2, under 2' }).props.accessibilityState.checked).toBe(true);
  });

  it('creates nothing until Start weaving, then creates the project with the chosen values', async () => {
    await render(<ProjectSetupScreen stitchId="twill22" />);
    await fireEvent.press(screen.getByLabelText('More warps'));
    await fireEvent.press(screen.getByLabelText('More warps'));
    await fireEvent.press(screen.getByRole('radio', { name: 'Under 2, over 2' }));
    await fireEvent.press(screen.getByLabelText('Mirrored'));
    await fireEvent.press(screen.getByLabelText('Right edge'));
    await fireEvent.press(screen.getByLabelText(/^Color A, /));
    await fireEvent.press(screen.getByLabelText('Rust'));
    await fireEvent.changeText(screen.getByLabelText('Name'), 'Scarf');
    expect(useProjects.getState().order).toHaveLength(0);

    await fireEvent.press(screen.getByRole('button', { name: 'Start weaving' }));
    const [id] = useProjects.getState().order;
    const p = project(id);
    expect(p).toMatchObject({
      kind: 'pattern',
      stitchId: 'twill22',
      name: 'Scarf',
      warps: 26,
      row: 1,
      setup: { start: 2, mirror: true, side: 'right' },
    });
    expect(p.kind === 'pattern' && p.colors[0].toLowerCase()).toBe('#c4622d');
    expect(useProjects.getState().lastOpenedId).toBe(id);
    expect(mockedRouter.replace).toHaveBeenCalledWith(`/project/${id}`);
  });

  it('defaults the name to the stitch name and uses the settings defaults', async () => {
    useSettings.getState().set({ defaultWarps: 32, defaultSide: 'right' });
    await render(<ProjectSetupScreen stitchId="hounds" />);
    await fireEvent.press(screen.getByRole('button', { name: 'Start weaving' }));
    const p = project(useProjects.getState().order[0]);
    expect(p).toMatchObject({ name: 'Houndstooth', warps: 32, setup: { start: 0, mirror: false, side: 'right' } });
  });

  it('shows a not-found state for an unknown stitch', async () => {
    await render(<ProjectSetupScreen stitchId="nope" />);
    expect(screen.getAllByText('Stitch not found').length).toBeGreaterThan(0);
  });
});

describe('ProjectSetupScreen, existing project', () => {
  it('saves changes as they are made: start resets the row, mirror does not', async () => {
    const id = useProjects.getState().createPattern({ stitchId: 'twill22', name: 'Twill' });
    useProjects.getState().setRow(id, 10);
    await render(<ProjectSetupScreen projectId={id} />);
    expect(screen.getByText('You’re on row 10. Changing this goes back to row 1.')).toBeTruthy();

    await fireEvent.press(screen.getByLabelText('Mirrored'));
    expect(project(id)).toMatchObject({ row: 10, setup: { mirror: true } });
    await fireEvent.press(screen.getByLabelText('Right edge'));
    await fireEvent.press(screen.getByLabelText('More warps'));
    expect(project(id)).toMatchObject({ row: 10, warps: 25, setup: { side: 'right' } });

    // Mirrored, tile row 1 (#..#) reads the same either way.
    await fireEvent.press(screen.getByRole('radio', { name: 'Over 1, under 2, over 1' }));
    expect(project(id)).toMatchObject({ row: 1, setup: { start: 1 } });
  });

  it('Done goes back, falling back to the guide', async () => {
    const id = useProjects.getState().createPattern({ stitchId: 'twill22', name: 'Twill' });
    await render(<ProjectSetupScreen projectId={id} />);
    await fireEvent.press(screen.getByRole('button', { name: 'Done' }));
    expect(mockedRouter.replace).toHaveBeenCalledWith(`/project/${id}`);

    mockedRouter.canGoBack.mockReturnValue(true);
    await fireEvent.press(screen.getByRole('button', { name: 'Done' }));
    expect(mockedRouter.back).toHaveBeenCalled();
  });

  it('points picture projects to the picture screen', async () => {
    const id = useProjects.getState().createPicture();
    await render(<ProjectSetupScreen projectId={id} />);
    expect(screen.getByText('Picture settings are on the picture screen.')).toBeTruthy();
  });
});

describe('ProjectScreen', () => {
  it('dispatches by kind', async () => {
    const pat = useProjects.getState().createPattern({ stitchId: 'twill22', name: 'Twill' });
    const pic = useProjects.getState().createPicture();
    await render(<ProjectScreen id={pat} />);
    expect(screen.getByText(`pattern guide ${pat}`)).toBeTruthy();
    await render(<ProjectScreen id={pic} />);
    expect(screen.getByText(`picture guide ${pic}`)).toBeTruthy();
  });

  it('shows not-found with a way to the projects list', async () => {
    await render(<ProjectScreen id="missing" />);
    expect(screen.getByText('Project not found')).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Go to projects' }));
    expect(mockedRouter.replace).toHaveBeenCalledWith('/projects');
  });
});

describe('ProjectsScreen', () => {
  it('shows the empty state', async () => {
    await render(<ProjectsScreen />);
    expect(screen.getByText('No projects yet')).toBeTruthy();
  });

  it('lists projects in store order with their status', async () => {
    const a = useProjects.getState().createPattern({ stitchId: 'twill22', name: 'Twill', warps: 24 });
    useProjects.getState().setRow(a, 37);
    useProjects.getState().createPicture({ name: 'Flower' });
    await render(<ProjectsScreen />);
    const names = screen.getAllByText(/^(Twill|Flower)$/).map((n) => n.props.children);
    expect(names).toEqual(['Flower', 'Twill']);
    expect(screen.getByText('Row 37 · 24 warps')).toBeTruthy();
    expect(screen.getByText('No picture yet')).toBeTruthy();

    await fireEvent.press(screen.getByRole('button', { name: /^Twill, / }));
    expect(mockedRouter.push).toHaveBeenCalledWith(`/project/${a}`);
    expect(useProjects.getState().order[0]).toBe(a);
  });

  it('creates a picture project with the default warps and opens it', async () => {
    useSettings.getState().set({ defaultWarps: 30 });
    await render(<ProjectsScreen />);
    await fireEvent.press(screen.getByRole('button', { name: 'New from picture' }));
    const id = useProjects.getState().order[0];
    expect(project(id)).toMatchObject({ kind: 'picture', warps: 30 });
    expect(useProjects.getState().lastOpenedId).toBe(id);
    expect(mockedRouter.push).toHaveBeenCalledWith(`/project/${id}`);
  });

  it('"New from a stitch" goes to the library', async () => {
    await render(<ProjectsScreen />);
    await fireEvent.press(screen.getByRole('button', { name: 'New from a stitch' }));
    expect(mockedRouter.navigate).toHaveBeenCalledWith('/');
  });

  it('renames, duplicates and deletes from the more sheet', async () => {
    const id = useProjects.getState().createPattern({ stitchId: 'twill22', name: 'Twill' });
    await render(<ProjectsScreen />);

    await fireEvent.press(screen.getByLabelText('More for Twill'));
    await fireEvent.changeText(screen.getByLabelText('Name'), 'Blue scarf');
    await fireEvent.press(screen.getByRole('button', { name: 'Rename' }));
    expect(project(id).name).toBe('Blue scarf');
    expect(screen.getByText('Blue scarf')).toBeTruthy();

    await fireEvent.press(screen.getByLabelText('More for Blue scarf'));
    await fireEvent.press(screen.getByRole('button', { name: 'Duplicate' }));
    expect(useProjects.getState().order).toHaveLength(2);
    expect(screen.getByText('Blue scarf copy')).toBeTruthy();

    await fireEvent.press(screen.getByLabelText('More for Blue scarf'));
    await fireEvent.press(screen.getByRole('button', { name: 'Delete' }));
    expect(screen.getByText('Delete “Blue scarf”? This can’t be undone.')).toBeTruthy();
    expect(project(id)).toBeDefined();
    await fireEvent.press(screen.getByRole('button', { name: 'Delete “Blue scarf”' }));
    expect(project(id)).toBeUndefined();
    expect(useProjects.getState().order).toHaveLength(1);
    expect(screen.queryByText('Blue scarf')).toBeNull();
  });

  it('cancelling the delete keeps the project', async () => {
    const id = useProjects.getState().createPattern({ stitchId: 'twill22', name: 'Twill' });
    await render(<ProjectsScreen />);
    await fireEvent.press(screen.getByLabelText('More for Twill'));
    await fireEvent.press(screen.getByRole('button', { name: 'Delete' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Cancel' }));
    expect(project(id)).toBeDefined();
    expect(screen.getByRole('button', { name: 'Duplicate' })).toBeTruthy();
  });
});

describe('SettingsScreen', () => {
  it('writes every change to the settings store, clamped', async () => {
    await render(<SettingsScreen />);
    await fireEvent.press(screen.getByLabelText('More warps'));
    expect(useSettings.getState().defaultWarps).toBe(25);

    const field = screen.getByLabelText('Default number of warp threads');
    await fireEvent.changeText(field, '200');
    await fireEvent(field, 'blur');
    expect(useSettings.getState().defaultWarps).toBe(120);
    await fireEvent.changeText(field, '1');
    await fireEvent(field, 'blur');
    expect(useSettings.getState().defaultWarps).toBe(4);

    await fireEvent.press(screen.getByLabelText('Right edge'));
    expect(useSettings.getState().defaultSide).toBe('right');

    await fireEvent.press(screen.getByLabelText('Vibrate when a row is done'));
    expect(useSettings.getState().haptics).toBe(false);
    await fireEvent.press(screen.getByLabelText('Keep the screen awake while weaving'));
    expect(useSettings.getState().keepAwake).toBe(false);

    await fireEvent.press(screen.getByLabelText('Dark'));
    expect(useSettings.getState().theme).toBe('dark');

    await fireEvent.press(screen.getByLabelText(/^Color B, /));
    await fireEvent.press(screen.getByLabelText('Moss'));
    expect(useSettings.getState().defaultColors[1].toLowerCase()).toBe('#6b7a3a');
  });

  it('shows the privacy promise', async () => {
    await render(<SettingsScreen />);
    expect(screen.getByText('Everything stays on this device. Your pictures are never uploaded, and nothing is tracked.')).toBeTruthy();
    expect(screen.getByText('Your projects are saved on this device only.')).toBeTruthy();
    expect(screen.getByText(/^Version /)).toBeTruthy();
  });
});

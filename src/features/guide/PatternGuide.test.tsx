import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { Alert, Dimensions } from 'react-native';

import { rowInfo } from '@/engine';
import { stepsSentence } from '@/weave';
import { getStitch } from '@/catalog';
import { resetStoresForTests, useProjects, useSettings } from '@/store';

import { PatternGuide } from './PatternGuide';

const mockRouter = { push: jest.fn(), replace: jest.fn(), back: jest.fn(), canGoBack: jest.fn(() => true) };
jest.mock('expo-router', () => ({
  get router() {
    return mockRouter;
  },
  useRouter: () => mockRouter,
  useIsFocused: () => true,
}));

const mockImpact = jest.fn(() => Promise.resolve());
jest.mock('expo-haptics', () => ({
  impactAsync: (...args: unknown[]) => mockImpact(...(args as [])),
  ImpactFeedbackStyle: { Light: 'light', Medium: 'medium', Heavy: 'heavy' },
}));
jest.mock('expo-keep-awake', () => ({
  activateKeepAwakeAsync: jest.fn(() => Promise.resolve()),
  deactivateKeepAwake: jest.fn(() => Promise.resolve()),
}));

const hidden = { includeHiddenElements: true };

function create(stitchId = 'twill22', opts: { warps?: number; row?: number; side?: 'left' | 'right' } = {}): string {
  const id = useProjects.getState().createPattern({
    stitchId,
    name: getStitch(stitchId)?.name ?? stitchId,
    warps: opts.warps ?? 24,
    setup: { side: opts.side ?? 'left' },
    row: opts.row,
  });
  return id;
}
const rowOf = (id: string) => useProjects.getState().projects[id]!.row;

beforeEach(async () => {
  await resetStoresForTests();
  jest.clearAllMocks();
});
afterEach(() => jest.restoreAllMocks());

describe('PatternGuide', () => {
  it('shows row 1 with Back disabled, and Row done / Back move the stored row', async () => {
    const id = create();
    await render(<PatternGuide projectId={id} />);
    expect(screen.getByTestId('guide-row')).toHaveTextContent('Row 1');
    expect(screen.getAllByText('2/2 twill').length).toBeGreaterThan(0);
    expect(screen.getByLabelText('Previous row')).toBeDisabled();
    expect(screen.queryByTestId('guide-restart')).toBeNull();

    await fireEvent.press(screen.getByText('Row done'));
    expect(rowOf(id)).toBe(2);
    expect(screen.getByTestId('guide-row')).toHaveTextContent('Row 2');
    expect(screen.getByLabelText('Previous row')).not.toBeDisabled();

    await fireEvent.press(screen.getByText('Row done'));
    expect(rowOf(id)).toBe(3);
    await fireEvent.press(screen.getByLabelText('Previous row'));
    expect(rowOf(id)).toBe(2);
  });

  it('marks the project as opened', async () => {
    const other = create('plain');
    const id = create();
    useProjects.setState({ lastOpenedId: other });
    await render(<PatternGuide projectId={id} />);
    expect(useProjects.getState().lastOpenedId).toBe(id);
  });

  it('reads row 2 of 2/2 twill at 24 warps right to left, starting with Over 1 at warp 24', async () => {
    const id = create('twill22', { warps: 24, side: 'left', row: 2 });
    await render(<PatternGuide projectId={id} />);
    expect(screen.getByTestId('guide-direction')).toHaveTextContent('Right to left');
    expect(screen.queryByTestId('guide-steps-step')).toBeNull();
    expect(screen.getByTestId('guide-start', hidden)).toHaveTextContent('Start: over 1 at warp 24');
    expect(screen.getByTestId('guide-repeat-line')).toHaveTextContent('Row 2 of the 4-row repeat.');
    expect(screen.getByTestId('guide-weft')).toHaveTextContent('Weft: Color A');
    expect(screen.getByLabelText('Weft color: Color A. Change')).toBeTruthy();
    expect(screen.getByTestId('guide-repeat')).toBeTruthy();
  });

  it('gives screen readers the whole row as one sentence', async () => {
    const id = create('twill22', { row: 2 });
    await render(<PatternGuide projectId={id} />);
    const info = rowInfo(getStitch('twill22')!, { start: 0, mirror: false, side: 'left' }, 24, 2);
    const sentence = stepsSentence(info.runs, 2, info.ltr);
    expect(sentence).toMatch(/^Row 2, right to left: over 1, under 2, over 2, /);
    expect(screen.getByTestId('guide-steps').props.accessibilityLabel).toBe(sentence);
  });

  it('changes the yarn of this row’s weft (Color B on houndstooth row 5) without moving the row', async () => {
    const stitch = getStitch('hounds')!;
    expect(rowInfo(stitch, { start: 0, mirror: false, side: 'left' }, 24, 5).weftKey).toBe(1);
    const id = create('hounds', { row: 5 });
    const before = useProjects.getState().projects[id]!;
    if (before.kind !== 'pattern') throw new Error('expected a pattern project');
    await render(<PatternGuide projectId={id} />);
    expect(screen.getByTestId('guide-weft')).toHaveTextContent('Weft: Color B');
    await fireEvent.press(screen.getByLabelText('Weft color: Color B. Change'));
    await fireEvent.press(screen.getByLabelText('Rust'));
    const after = useProjects.getState().projects[id]!;
    if (after.kind !== 'pattern') throw new Error('expected a pattern project');
    expect(after.colors).toEqual([before.colors[0], '#c4622d']);
    expect(after.row).toBe(5);
  });

  it('shows the edge tip where the engine says so, and not for 2/2 twill at 24 warps', async () => {
    // Basket weave at 24 warps starting on the left: row 2 starts the way row 1 ended at warp 24.
    const stitch = getStitch('basket')!;
    expect(rowInfo(stitch, { start: 0, mirror: false, side: 'left' }, 24, 2).edgeWarp).toBe(24);
    const basket = create('basket', { row: 2 });
    await render(<PatternGuide projectId={basket} />);
    expect(screen.getByTestId('guide-edge-tip')).toHaveTextContent(/warp 24 won’t get caught/);
    await screen.unmount();

    const twill = create('twill22', { warps: 24, side: 'left' });
    await render(<PatternGuide projectId={twill} />);
    for (let r = 1; r <= 8; r++) {
      expect(screen.getByTestId('guide-row')).toHaveTextContent(`Row ${r}`);
      expect(screen.queryByTestId('guide-edge-tip')).toBeNull();
      await fireEvent.press(screen.getByText('Row done'));
    }
  });

  it('jumps to a row tapped in the drawdown', async () => {
    const id = create();
    await render(<PatternGuide projectId={id} />);
    const pitch = (screen.getByTestId('guide-drawdown-current', hidden).props.style.height as number) - 4 + 2;
    // Row 1: the window is rows 1–16, top to bottom 16 … 1, so the third row from the top is 14.
    await fireEvent.press(screen.getByTestId('guide-drawdown'), { nativeEvent: { locationY: 2.5 * pitch } });
    expect(rowOf(id)).toBe(14);
    expect(screen.getByTestId('guide-row')).toHaveTextContent('Row 14');
  });

  it('goes back to row 1 at once up to row 10', async () => {
    const alert = jest.spyOn(Alert, 'alert');
    const id = create('twill22', { row: 10 });
    await render(<PatternGuide projectId={id} />);
    await fireEvent.press(screen.getByText('Back to row 1'));
    expect(alert).not.toHaveBeenCalled();
    expect(rowOf(id)).toBe(1);
    expect(screen.queryByText('Back to row 1')).toBeNull();
  });

  it('asks before going back to row 1 above row 10', async () => {
    let answer: 'cancel' | 'ok' = 'cancel';
    const alert = jest.spyOn(Alert, 'alert').mockImplementation((_title, _message, buttons) => {
      const button = buttons!.find((b) => (answer === 'cancel' ? b.style === 'cancel' : b.style !== 'cancel'));
      button!.onPress!();
    });
    const id = create('twill22', { row: 37 });
    await render(<PatternGuide projectId={id} />);

    await fireEvent.press(screen.getByText('Back to row 1'));
    expect(alert).toHaveBeenCalledTimes(1);
    expect(alert.mock.calls[0][0]).toBe('Go back to row 1?');
    expect(rowOf(id)).toBe(37);

    answer = 'ok';
    await fireEvent.press(screen.getByText('Back to row 1'));
    expect(alert).toHaveBeenCalledTimes(2);
    expect(rowOf(id)).toBe(1);
  });

  it('taps the haptic on Row done only when the setting is on', async () => {
    const id = create();
    useSettings.getState().set({ haptics: false });
    await render(<PatternGuide projectId={id} />);
    await fireEvent.press(screen.getByText('Row done'));
    expect(rowOf(id)).toBe(2);
    expect(mockImpact).not.toHaveBeenCalled();

    await act(async () => useSettings.getState().set({ haptics: true }));
    await fireEvent.press(screen.getByText('Row done'));
    expect(mockImpact).toHaveBeenCalledTimes(1);
    expect(mockImpact).toHaveBeenCalledWith('light');
  });

  it('keeps the screen awake only when the setting is on', async () => {
    const { activateKeepAwakeAsync, deactivateKeepAwake } = jest.requireMock('expo-keep-awake');
    useSettings.getState().set({ keepAwake: false });
    const id = create();
    await render(<PatternGuide projectId={id} />);
    expect(activateKeepAwakeAsync).not.toHaveBeenCalled();
    await screen.unmount();

    useSettings.getState().set({ keepAwake: true });
    await render(<PatternGuide projectId={id} />);
    expect(activateKeepAwakeAsync).toHaveBeenCalledTimes(1);
    await screen.unmount();
    expect(deactivateKeepAwake).toHaveBeenCalledWith(activateKeepAwakeAsync.mock.calls[0][0]);
  });

  it('opens the setup sheet from the header and goes back to the projects list', async () => {
    const id = create();
    await render(<PatternGuide projectId={id} />);
    expect(screen.getByTestId('guide-setup')).toHaveTextContent('Project settings');
    await fireEvent.press(screen.getByLabelText('Project settings'));
    expect(mockRouter.push).toHaveBeenCalledWith(`/project/${id}/setup`);

    mockRouter.canGoBack.mockReturnValueOnce(false);
    await fireEvent.press(screen.getByLabelText('Back'));
    expect(mockRouter.replace).toHaveBeenCalledWith('/projects');
  });

  it('shows only the settings icon on a very narrow screen', async () => {
    const original = Dimensions.get('window');
    Dimensions.set({ window: { ...original, width: 320 } });
    try {
      const id = create();
      await render(<PatternGuide projectId={id} />);
      expect(screen.getByTestId('guide-setup')).not.toHaveTextContent('Project settings');
      expect(screen.getByLabelText('Project settings')).toBeTruthy();
    } finally {
      Dimensions.set({ window: original });
    }
  });

  it('goes back to row 1 after the start row is changed in setup', async () => {
    const id = create('twill22', { row: 5 });
    await render(<PatternGuide projectId={id} />);
    expect(screen.getByTestId('guide-row')).toHaveTextContent('Row 5');
    await act(async () => useProjects.getState().updatePattern(id, { setup: { start: 2 } }));
    expect(screen.getByTestId('guide-row')).toHaveTextContent('Row 1');
  });

  it('shows the math when opened', async () => {
    const id = create();
    await render(<PatternGuide projectId={id} />);
    expect(screen.queryByText('Pattern width')).toBeNull();
    await fireEvent.press(screen.getByLabelText('The math'));
    expect(screen.getByText('Pattern width')).toBeTruthy();
  });

  it('renders a fallback for a missing project, a picture project and an unknown stitch', async () => {
    await render(<PatternGuide projectId="nope" />);
    expect(screen.getByText('Project not found')).toBeTruthy();
    await screen.unmount();

    const pic = useProjects.getState().createPicture();
    await render(<PatternGuide projectId={pic} />);
    expect(screen.getByText('Project not found')).toBeTruthy();
    await screen.unmount();

    const odd = create('no-such-stitch');
    await render(<PatternGuide projectId={odd} />);
    expect(screen.getByText('Stitch not found')).toBeTruthy();
    await fireEvent.press(screen.getByText('Go to projects'));
    expect(mockRouter.replace).toHaveBeenCalledWith('/projects');
  });
});

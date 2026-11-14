import { render, screen } from '@testing-library/react-native';

import { ThemeProvider } from '@/ui';

import { updateNoticeDue } from './appUpdate';
import { useAppUpdate as nativeUseAppUpdate } from './pwa.native';
import { UpdateNotice } from './UpdateNotice';

describe('updateNoticeDue', () => {
  it('stays quiet on the first run', () => {
    expect(updateNoticeDue(null, 'abc')).toBe(false);
  });
  it('stays quiet when the version is unchanged or unknown', () => {
    expect(updateNoticeDue('abc', 'abc')).toBe(false);
    expect(updateNoticeDue('abc', null)).toBe(false);
  });
  it('is due after a new version took over', () => {
    expect(updateNoticeDue('abc', 'def')).toBe(true);
  });
});

describe('UpdateNotice on phones', () => {
  it('never reports an update', () => {
    const update = nativeUseAppUpdate();
    expect(update.updated).toBe(false);
    expect(() => update.dismiss()).not.toThrow();
  });
  it('renders nothing', async () => {
    await render(
      <ThemeProvider initialPreference="light">
        <UpdateNotice />
      </ThemeProvider>,
    );
    expect(screen.queryByTestId('update-notice')).toBeNull();
  });
});

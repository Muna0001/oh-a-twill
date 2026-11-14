import { fireEvent, render, screen } from '@testing-library/react-native';

import { ThemeProvider } from '@/ui';

import { platformCopy } from './copy';
import { UpdateNotice } from './UpdateNotice';

const mockDismiss = jest.fn();
jest.mock('./pwa', () => ({ useAppUpdate: () => ({ updated: true, dismiss: mockDismiss }) }));

it('shows "Updated" and dismisses on press', async () => {
  await render(
    <ThemeProvider initialPreference="light">
      <UpdateNotice />
    </ThemeProvider>,
  );
  expect(screen.getByText(platformCopy.updated)).toBeTruthy();
  await fireEvent.press(screen.getByTestId('update-notice'));
  expect(mockDismiss).toHaveBeenCalledTimes(1);
});

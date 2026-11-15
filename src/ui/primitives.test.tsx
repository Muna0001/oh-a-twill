import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { useState } from 'react';

import { Button } from './Button';
import { ColorField } from './ColorField';
import { Checkbox, Segmented, Stepper } from './controls';
import { ThemeProvider, useTheme, useThemePreference } from './theme';
import { Text } from './Text';

function StepperHarness({ onChange, start = 24, min = 4, max = 120 }: { onChange: (n: number) => void; start?: number; min?: number; max?: number }) {
  const [value, setValue] = useState(start);
  return (
    <Stepper
      value={value}
      min={min}
      max={max}
      onChange={(n) => {
        onChange(n);
        setValue(n);
      }}
      accessibilityLabel="Number of warp threads"
      decrementLabel="Fewer warps"
      incrementLabel="More warps"
    />
  );
}

describe('Stepper', () => {
  it('steps with the plus and minus buttons', async () => {
    const onChange = jest.fn();
    await render(<StepperHarness onChange={onChange} />);
    await fireEvent.press(screen.getByLabelText('More warps'));
    expect(onChange).toHaveBeenLastCalledWith(25);
    await fireEvent.press(screen.getByLabelText('Fewer warps'));
    await fireEvent.press(screen.getByLabelText('Fewer warps'));
    expect(onChange).toHaveBeenLastCalledWith(23);
    expect(screen.getByLabelText('Number of warp threads').props.value).toBe('23');
  });

  it('does not go past min or max', async () => {
    const onChange = jest.fn();
    await render(<StepperHarness onChange={onChange} start={5} min={4} max={6} />);
    await fireEvent.press(screen.getByLabelText('Fewer warps'));
    expect(onChange).toHaveBeenLastCalledWith(4);
    await fireEvent.press(screen.getByLabelText('Fewer warps'));
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(screen.getByLabelText('Fewer warps')).toBeDisabled();
    await fireEvent.press(screen.getByLabelText('More warps'));
    await fireEvent.press(screen.getByLabelText('More warps'));
    await fireEvent.press(screen.getByLabelText('More warps'));
    expect(onChange).toHaveBeenLastCalledWith(6);
    expect(onChange).toHaveBeenCalledTimes(3);
    expect(screen.getByLabelText('More warps')).toBeDisabled();
  });

  it('commits a typed number on blur', async () => {
    const onChange = jest.fn();
    await render(<StepperHarness onChange={onChange} />);
    const input = screen.getByLabelText('Number of warp threads');
    await fireEvent.changeText(input, '36');
    expect(onChange).not.toHaveBeenCalled();
    await fireEvent(input, 'blur');
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith(36);
    expect(screen.getByLabelText('Number of warp threads').props.value).toBe('36');
  });

  it('clamps typed numbers to min and max', async () => {
    const onChange = jest.fn();
    await render(<StepperHarness onChange={onChange} />);
    const input = screen.getByLabelText('Number of warp threads');
    await fireEvent.changeText(input, '999');
    await fireEvent(input, 'submitEditing');
    expect(onChange).toHaveBeenLastCalledWith(120);
    await fireEvent.changeText(input, '1');
    await fireEvent(input, 'blur');
    expect(onChange).toHaveBeenLastCalledWith(4);
    expect(screen.getByLabelText('Number of warp threads').props.value).toBe('4');
  });

  it('ignores junk and empty input', async () => {
    const onChange = jest.fn();
    await render(<StepperHarness onChange={onChange} />);
    const input = screen.getByLabelText('Number of warp threads');
    await fireEvent.changeText(input, 'abc');
    await fireEvent(input, 'blur');
    await fireEvent.changeText(input, '');
    await fireEvent(input, 'blur');
    await fireEvent.changeText(input, '3x0.5');
    expect(screen.getByLabelText('Number of warp threads').props.value).toBe('305');
    await fireEvent.changeText(input, '24');
    await fireEvent(input, 'blur');
    expect(onChange).not.toHaveBeenCalled();
    expect(screen.getByLabelText('Number of warp threads').props.value).toBe('24');
  });

  it('repeats while held and stops on release', async () => {
    jest.useFakeTimers();
    try {
      const onChange = jest.fn();
      await render(<StepperHarness onChange={onChange} />);
      const plus = screen.getByLabelText('More warps');
      await fireEvent(plus, 'longPress');
      expect(onChange).toHaveBeenLastCalledWith(25);
      await act(async () => {
        jest.advanceTimersByTime(250);
      });
      expect(onChange).toHaveBeenLastCalledWith(28);
      await fireEvent(plus, 'pressOut');
      await act(async () => {
        jest.advanceTimersByTime(500);
      });
      expect(onChange).toHaveBeenLastCalledWith(28);
    } finally {
      jest.useRealTimers();
    }
  });
});

describe('Segmented', () => {
  const options = [
    { value: 'left', label: 'Left' },
    { value: 'right', label: 'Right' },
  ] as const;

  it('calls onChange with the pressed value and marks the selection', async () => {
    const onChange = jest.fn();
    await render(<Segmented accessibilityLabel="Start edge" options={options} value="left" onChange={onChange} />);
    expect(screen.getByRole('radio', { name: 'Left' })).toBeChecked();
    expect(screen.getByRole('radio', { name: 'Right' })).not.toBeChecked();
    await fireEvent.press(screen.getByRole('radio', { name: 'Right' }));
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith('right');
  });

  it('does not fire for the option already selected', async () => {
    const onChange = jest.fn();
    await render(<Segmented accessibilityLabel="Start edge" options={options} value="left" onChange={onChange} />);
    await fireEvent.press(screen.getByRole('radio', { name: 'Left' }));
    expect(onChange).not.toHaveBeenCalled();
  });
});

describe('Button', () => {
  it('fires onPress', async () => {
    const onPress = jest.fn();
    await render(<Button label="Row done" onPress={onPress} />);
    await fireEvent.press(screen.getByRole('button', { name: 'Row done' }));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('does not fire when disabled', async () => {
    const onPress = jest.fn();
    await render(<Button label="Back" onPress={onPress} disabled />);
    const button = screen.getByRole('button', { name: 'Back' });
    expect(button).toBeDisabled();
    await fireEvent.press(button);
    expect(onPress).not.toHaveBeenCalled();
  });

  it('labels an icon-only button', async () => {
    await render(<Button icon="trash" accessibilityLabel="Delete" />);
    expect(screen.getByRole('button', { name: 'Delete' })).toBeTruthy();
  });
});

describe('Checkbox', () => {
  it('toggles', async () => {
    const onChange = jest.fn();
    const view = await render(<Checkbox checked={false} onChange={onChange} label="Mirror" />);
    expect(screen.getByRole('checkbox', { name: 'Mirror' })).not.toBeChecked();
    await fireEvent.press(screen.getByRole('checkbox', { name: 'Mirror' }));
    expect(onChange).toHaveBeenLastCalledWith(true);
    await view.rerender(<Checkbox checked onChange={onChange} label="Mirror" />);
    expect(screen.getByRole('checkbox', { name: 'Mirror' })).toBeChecked();
    await fireEvent.press(screen.getByRole('checkbox', { name: 'Mirror' }));
    expect(onChange).toHaveBeenLastCalledWith(false);
  });
});

describe('ColorField', () => {
  const open = async (onChange: jest.Mock) => {
    await render(<ColorField label="Weft" value="#2E4C8F" onChange={onChange} />);
    await fireEvent.press(screen.getByRole('button', { name: /Weft/ }));
  };

  it('accepts a valid hex', async () => {
    const onChange = jest.fn();
    await open(onChange);
    await fireEvent.changeText(screen.getByLabelText('Hex color'), '#C0392B');
    await fireEvent.press(screen.getByRole('button', { name: 'Use color' }));
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith('#c0392b');
    expect(screen.queryByLabelText('Hex color')).toBeNull();
  });

  it('rejects an invalid hex and says why', async () => {
    const onChange = jest.fn();
    await open(onChange);
    await fireEvent.changeText(screen.getByLabelText('Hex color'), '#12XZ');
    await fireEvent.press(screen.getByRole('button', { name: 'Use color' }));
    expect(onChange).not.toHaveBeenCalled();
    expect(screen.getByText('Enter a hex color like #2E4C8F.')).toBeTruthy();
    expect(screen.getByLabelText('Hex color')).toBeTruthy();
  });

  it('picks a preset', async () => {
    const onChange = jest.fn();
    await open(onChange);
    await fireEvent.press(screen.getByRole('button', { name: 'Mustard' }));
    expect(onChange).toHaveBeenCalledWith('#d9a521');
  });
});

describe('theme preference', () => {
  function Probe() {
    const theme = useTheme();
    const [preference, setPreference] = useThemePreference();
    return (
      <>
        <Text>{`${preference}:${theme.scheme}:${theme.colors.bg}`}</Text>
        <Button label="Go dark" onPress={() => setPreference('dark')} />
      </>
    );
  }

  it('can be forced from outside', async () => {
    await render(
      <ThemeProvider initialPreference="light">
        <Probe />
      </ThemeProvider>,
    );
    expect(screen.getByText('light:light:#FFF3E7')).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Go dark' }));
    expect(screen.getByText('dark:dark:#17130F')).toBeTruthy();
  });
});

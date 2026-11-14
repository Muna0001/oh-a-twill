import { act, renderHook } from '@testing-library/react-native';
import { Alert } from 'react-native';

import * as native from './device.native';
import * as web from './device.web';

const mockImpact = jest.fn(() => Promise.resolve());
jest.mock('expo-haptics', () => ({
  impactAsync: (...args: unknown[]) => mockImpact(...(args as [])),
  ImpactFeedbackStyle: { Light: 'light' },
}));
jest.mock('expo-keep-awake', () => ({
  activateKeepAwakeAsync: jest.fn(() => Promise.resolve()),
  deactivateKeepAwake: jest.fn(() => Promise.resolve()),
}));
const keepAwake = jest.requireMock('expo-keep-awake') as { activateKeepAwakeAsync: jest.Mock; deactivateKeepAwake: jest.Mock };

type Global = { document?: unknown; navigator?: unknown; window?: unknown };
const g = globalThis as unknown as Global;
const saved: Record<keyof Global, PropertyDescriptor | undefined> = {
  document: Object.getOwnPropertyDescriptor(globalThis, 'document'),
  navigator: Object.getOwnPropertyDescriptor(globalThis, 'navigator'),
  window: Object.getOwnPropertyDescriptor(globalThis, 'window'),
};
function setGlobal(name: keyof Global, value: unknown) {
  Object.defineProperty(globalThis, name, { value, configurable: true, writable: true });
}

/** A document that is an EventTarget with a settable visibilityState. */
function fakeDocument() {
  const d = new EventTarget() as EventTarget & { visibilityState: string };
  d.visibilityState = 'visible';
  setGlobal('document', d);
  return d;
}
function key(d: EventTarget, k: string, extra: Record<string, unknown> = {}) {
  const e = Object.assign(new Event('keydown', { cancelable: true }), { key: k, ...extra });
  d.dispatchEvent(e);
  return e;
}
const flush = () => act(async () => {});

beforeEach(() => jest.clearAllMocks());
afterEach(() => {
  for (const name of Object.keys(saved) as (keyof Global)[]) {
    const d = saved[name];
    if (d) Object.defineProperty(globalThis, name, d);
    else delete g[name];
  }
  jest.restoreAllMocks();
});

describe('native', () => {
  it('taps a light impact and never throws', () => {
    native.tapHaptic();
    expect(mockImpact).toHaveBeenCalledWith('light');
    mockImpact.mockImplementationOnce(() => {
      throw new Error('no engine');
    });
    expect(() => native.tapHaptic()).not.toThrow();
    mockImpact.mockImplementationOnce(() => Promise.reject(new Error('no engine')));
    expect(() => native.tapHaptic()).not.toThrow();
  });

  it('keeps awake while enabled, with its own tag', async () => {
    const hook = await renderHook(({ on }: { on: boolean }) => native.useKeepAwake(on), { initialProps: { on: false } });
    expect(keepAwake.activateKeepAwakeAsync).not.toHaveBeenCalled();
    await hook.rerender({ on: true });
    expect(keepAwake.activateKeepAwakeAsync).toHaveBeenCalledTimes(1);
    const tag = keepAwake.activateKeepAwakeAsync.mock.calls[0][0];
    expect(tag).toEqual(expect.any(String));
    await hook.unmount();
    expect(keepAwake.deactivateKeepAwake).toHaveBeenCalledWith(tag);
  });

  it('resolves the confirm question from the alert buttons', async () => {
    jest.spyOn(Alert, 'alert').mockImplementation((_t, _m, buttons) => buttons![1].onPress!());
    await expect(native.confirmAsync({ title: 'Sure?', confirmLabel: 'Yes', cancelLabel: 'No' })).resolves.toBe(true);
    jest.spyOn(Alert, 'alert').mockImplementation((_t, _m, buttons) => buttons![0].onPress!());
    await expect(native.confirmAsync({ title: 'Sure?', confirmLabel: 'Yes', cancelLabel: 'No' })).resolves.toBe(false);
  });

  it('scrolls the given scroll view to the top of the target, and ignores anything else', () => {
    const inner = {};
    const scrollTo = jest.fn();
    const scrollView = { scrollTo, getInnerViewRef: () => inner };
    const measureLayout = jest.fn((relativeTo: unknown, onSuccess: (x: number, y: number) => void) => onSuccess(0, 120));
    native.scrollIntoView({ measureLayout }, scrollView);
    expect(measureLayout.mock.calls[0][0]).toBe(inner);
    expect(scrollTo).toHaveBeenCalledWith({ y: 104, animated: true });
    measureLayout.mockImplementationOnce((_r, onSuccess) => onSuccess(0, 4));
    native.scrollIntoView({ measureLayout }, scrollView);
    expect(scrollTo).toHaveBeenLastCalledWith({ y: 0, animated: true });
    expect(() => native.scrollIntoView({ measureLayout })).not.toThrow();
    expect(() => native.scrollIntoView(null, scrollView)).not.toThrow();
    expect(() => native.scrollIntoView({}, {})).not.toThrow();
    expect(scrollTo).toHaveBeenCalledTimes(2);
  });
});

describe('web', () => {
  it('has a haptic that does nothing', () => {
    expect(() => web.tapHaptic()).not.toThrow();
  });

  it('calls Back and Row done for the arrow keys, not while typing, and stops on unmount', async () => {
    const d = fakeDocument();
    const prev = jest.fn();
    const next = jest.fn();
    const hook = await renderHook(() => web.useRowKeys(prev, next));
    expect(key(d, 'ArrowRight').defaultPrevented).toBe(true);
    key(d, 'ArrowLeft');
    key(d, 'ArrowRight', { shiftKey: true });
    // Typed in an input: the target is the input, not the document.
    const input = Object.assign(new EventTarget(), { tagName: 'INPUT' });
    const typed = Object.assign(new Event('keydown'), { key: 'ArrowRight' });
    Object.defineProperty(typed, 'target', { value: input });
    d.dispatchEvent(typed);
    expect(next).toHaveBeenCalledTimes(1);
    expect(prev).toHaveBeenCalledTimes(1);
    await hook.unmount();
    key(d, 'ArrowRight');
    expect(next).toHaveBeenCalledTimes(1);
  });

  it('does not listen when disabled', async () => {
    const d = fakeDocument();
    const next = jest.fn();
    await renderHook(() => web.useRowKeys(jest.fn(), next, false));
    key(d, 'ArrowRight');
    expect(next).not.toHaveBeenCalled();
  });

  it('holds a wake lock, asks again when the page is shown, and releases it on unmount', async () => {
    const d = fakeDocument();
    const locks: { released: boolean; release: jest.Mock }[] = [];
    const request = jest.fn(async () => {
      const lock = { released: false, release: jest.fn(async () => void (lock.released = true)) };
      locks.push(lock);
      return lock;
    });
    setGlobal('navigator', { wakeLock: { request } });

    const hook = await renderHook(() => web.useKeepAwake(true));
    await flush();
    expect(request).toHaveBeenCalledWith('screen');
    expect(request).toHaveBeenCalledTimes(1);

    // The browser drops the lock when the tab is hidden.
    locks[0].released = true;
    d.visibilityState = 'hidden';
    d.dispatchEvent(new Event('visibilitychange'));
    await flush();
    expect(request).toHaveBeenCalledTimes(1);
    d.visibilityState = 'visible';
    d.dispatchEvent(new Event('visibilitychange'));
    await flush();
    expect(request).toHaveBeenCalledTimes(2);

    await hook.unmount();
    expect(locks[1].release).toHaveBeenCalled();
    d.dispatchEvent(new Event('visibilitychange'));
    await flush();
    expect(request).toHaveBeenCalledTimes(2);
  });

  it('does nothing without the Wake Lock API, when disabled, or when the request fails', async () => {
    fakeDocument();
    setGlobal('navigator', {});
    const a = await renderHook(() => web.useKeepAwake(true));
    await a.unmount();

    const request = jest.fn(async () => {
      throw new Error('NotAllowedError');
    });
    setGlobal('navigator', { wakeLock: { request } });
    const b = await renderHook(() => web.useKeepAwake(false));
    expect(request).not.toHaveBeenCalled();
    await b.unmount();
    const c = await renderHook(() => web.useKeepAwake(true));
    await flush();
    expect(request).toHaveBeenCalledTimes(1);
    await expect(c.unmount()).resolves.toBeUndefined();
  });

  it('asks with window.confirm', async () => {
    const confirm = jest.fn(() => false);
    setGlobal('window', { confirm });
    await expect(web.confirmAsync({ title: 'Go back to row 1?', message: 'Sure?', confirmLabel: 'Yes', cancelLabel: 'No' })).resolves.toBe(false);
    expect(confirm).toHaveBeenCalledWith('Go back to row 1?\n\nSure?');
  });

  it('scrolls an element into view and ignores anything else', () => {
    const scrollIntoView = jest.fn();
    web.scrollIntoView({ scrollIntoView });
    expect(scrollIntoView).toHaveBeenCalledWith({ block: 'nearest', behavior: 'smooth' });
    expect(() => web.scrollIntoView(null)).not.toThrow();
    expect(() => web.scrollIntoView({})).not.toThrow();
  });
});

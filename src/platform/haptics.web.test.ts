import { act, renderHook } from '@testing-library/react-native';

import { attachHapticTrigger, attachHapticTriggerIfSupported, hapticMode, tapHapticWeb } from './haptics.web';
import { useHapticTrigger } from './device.web';

const IPHONE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 26_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.5 Mobile/15E148 Safari/604.1';
const IPAD_AS_MAC = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.5 Safari/605.1.15';
const ANDROID = 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Mobile Safari/537.36';
const DESKTOP = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36';

const media = (coarse: boolean) => jest.fn((q: string) => ({ matches: q === '(pointer: coarse)' && coarse }));
const iphone = { userAgent: IPHONE, platform: 'iPhone', maxTouchPoints: 5 };

/** Just enough DOM for the overlay: elements keep their attributes, styles, children and listeners. */
type El = {
  tagName: string;
  style: Record<string, string> & { setProperty: (k: string, v: string) => void };
  attrs: Record<string, string>;
  children: El[];
  parent: El | null;
  listeners: Record<string, ((e: { stopPropagation: () => void }) => void)[]>;
  type?: string;
  tabIndex?: number;
  setAttribute: (k: string, v: string) => void;
  appendChild: (c: El) => El;
  remove: () => void;
  querySelector: (sel: string) => El | null;
  addEventListener: (type: string, fn: (e: { stopPropagation: () => void }) => void) => void;
};

function fakeDom(position = 'static') {
  const make = (tagName: string): El => {
    const style = {} as El['style'];
    Object.defineProperty(style, 'setProperty', { value: (k: string, v: string) => void (style[k] = v), enumerable: false });
    const el: El = {
      tagName: tagName.toUpperCase(),
      style,
      attrs: {},
      children: [],
      parent: null,
      listeners: {},
      setAttribute: (k, v) => void (el.attrs[k] = v),
      appendChild: (c) => {
        c.parent = el;
        el.children.push(c);
        return c;
      },
      remove: () => {
        if (el.parent) el.parent.children = el.parent.children.filter((c) => c !== el);
        el.parent = null;
      },
      // Only the selector the overlay uses: a direct child with data-haptic-trigger.
      querySelector: (sel) => (sel === ':scope > [data-haptic-trigger]' ? (el.children.find((c) => 'data-haptic-trigger' in c.attrs) ?? null) : null),
      addEventListener: (type, fn) => void (el.listeners[type] = [...(el.listeners[type] ?? []), fn]),
    };
    return el;
  };
  const doc = {
    createElement: jest.fn((t: string) => make(t)),
    defaultView: { getComputedStyle: () => ({ position }) },
  };
  const button = make('div');
  return { doc: doc as unknown as Document, button, asNode: button as unknown as HTMLElement, rawDoc: doc };
}

describe('hapticMode', () => {
  it('vibrates where the Vibration API exists on a touch screen (Android)', () => {
    expect(hapticMode({ vibrate: () => true, userAgent: ANDROID }, media(true))).toBe('vibrate');
  });
  it('uses the switch on iPhone and on iPadOS (which reports a Mac with touch)', () => {
    expect(hapticMode(iphone, media(true))).toBe('switch');
    expect(hapticMode({ userAgent: IPAD_AS_MAC, platform: 'MacIntel', maxTouchPoints: 5 }, media(true))).toBe('switch');
  });
  it('does nothing on desktops, even with a Vibration API, or a Mac without touch', () => {
    expect(hapticMode({ vibrate: () => true, userAgent: DESKTOP }, media(false))).toBe('none');
    expect(hapticMode({ userAgent: IPAD_AS_MAC, platform: 'MacIntel', maxTouchPoints: 0 }, media(false))).toBe('none');
    expect(hapticMode({ userAgent: DESKTOP }, media(true))).toBe('none');
  });
  it('does nothing when the APIs are missing', () => {
    expect(hapticMode(undefined, media(true))).toBe('none');
    expect(hapticMode({ userAgent: IPHONE }, undefined)).toBe('none');
  });
});

describe('tapHapticWeb', () => {
  it('Android: vibrates for 10 ms', () => {
    const vibrate = jest.fn(() => true);
    tapHapticWeb({ vibrate, userAgent: ANDROID }, media(true));
    expect(vibrate).toHaveBeenCalledWith(10);
  });

  it('iOS and desktop: does nothing (iOS plays the haptic from the overlay instead)', () => {
    const vibrate = jest.fn();
    expect(() => tapHapticWeb(iphone, media(true))).not.toThrow();
    tapHapticWeb({ vibrate, userAgent: DESKTOP }, media(false));
    expect(vibrate).not.toHaveBeenCalled();
  });

  it('never throws when the APIs are missing or fail', () => {
    const boom = () => {
      throw new Error('nope');
    };
    expect(() => tapHapticWeb(undefined, undefined)).not.toThrow();
    expect(() => tapHapticWeb({ vibrate: boom, userAgent: ANDROID }, media(true))).not.toThrow();
    expect(() => tapHapticWeb({ userAgent: ANDROID }, boom as never)).not.toThrow();
  });
});

describe('attachHapticTrigger', () => {
  it('lays a hidden, transparent switch label over the button and removes it again', () => {
    const { doc, button, asNode } = fakeDom();
    const detach = attachHapticTrigger(asNode, doc);
    expect(button.children).toHaveLength(1);
    const label = button.children[0];
    expect(label.tagName).toBe('LABEL');
    expect(label.attrs['aria-hidden']).toBe('true');
    expect(label.attrs['data-haptic-trigger']).toBe('');
    expect(label.style).toMatchObject({ position: 'absolute', inset: 'calc(-1 * 0px) calc(-1 * 0px) calc(-1 * 0px) calc(-1 * 0px)', touchAction: 'manipulation', '-webkit-tap-highlight-color': 'transparent' });
    const input = label.children[0];
    expect(input.type).toBe('checkbox');
    expect(input.attrs.switch).toBe('');
    expect(input.tabIndex).toBe(-1);
    expect(input.style).toMatchObject({ position: 'absolute', width: '1px', height: '1px', visibility: 'hidden' });
    // The switch's own click is stopped so the button does not see a second press.
    const stopPropagation = jest.fn();
    input.listeners.click.forEach((fn) => fn({ stopPropagation }));
    expect(stopPropagation).toHaveBeenCalled();
    // A static button becomes the positioning box, and goes back on removal.
    expect(button.style.position).toBe('relative');

    detach();
    expect(button.children).toHaveLength(0);
    expect(button.style.position).toBe('');
  });

  it('covers the button’s border', () => {
    const { doc, button, asNode, rawDoc } = fakeDom();
    rawDoc.defaultView.getComputedStyle = () => ({ position: 'relative', borderTopWidth: '1px', borderRightWidth: '2px', borderBottomWidth: '1px', borderLeftWidth: '2px' }) as never;
    attachHapticTrigger(asNode, doc);
    expect(button.children[0].style.inset).toBe('calc(-1 * 1px) calc(-1 * 2px) calc(-1 * 1px) calc(-1 * 2px)');
  });

  it('leaves an already positioned button alone', () => {
    const { doc, button, asNode } = fakeDom('relative');
    const detach = attachHapticTrigger(asNode, doc);
    expect(button.style.position).toBeUndefined();
    detach();
    expect(button.style.position).toBeUndefined();
  });

  it('is idempotent: a second attach adds nothing and its detach removes nothing', () => {
    const { doc, button, asNode, rawDoc } = fakeDom();
    const first = attachHapticTrigger(asNode, doc);
    const second = attachHapticTrigger(asNode, doc);
    expect(button.children).toHaveLength(1);
    expect(rawDoc.createElement).toHaveBeenCalledTimes(2); // one label, one input
    second();
    expect(button.children).toHaveLength(1);
    first();
    expect(button.children).toHaveLength(0);
  });
});

describe('attachHapticTriggerIfSupported', () => {
  it('attaches on iOS only', () => {
    const ios = fakeDom();
    expect(attachHapticTriggerIfSupported(ios.button, iphone, media(true), ios.doc)).toEqual(expect.any(Function));
    expect(ios.button.children).toHaveLength(1);

    for (const [nav, coarse] of [
      [{ vibrate: () => true, userAgent: ANDROID }, true],
      [{ userAgent: DESKTOP }, false],
      [{ userAgent: IPAD_AS_MAC, platform: 'MacIntel', maxTouchPoints: 0 }, false],
    ] as const) {
      const other = fakeDom();
      expect(attachHapticTriggerIfSupported(other.button, nav, media(coarse), other.doc)).toBeNull();
      expect(other.button.children).toHaveLength(0);
    }
  });

  it('never throws when the DOM is missing or fails', () => {
    const { doc, button } = fakeDom();
    expect(attachHapticTriggerIfSupported(null, iphone, media(true), doc)).toBeNull();
    expect(attachHapticTriggerIfSupported({}, iphone, media(true), doc)).toBeNull();
    expect(attachHapticTriggerIfSupported(button, iphone, media(true), undefined)).toBeNull();
    const broken = { ...doc, createElement: () => { throw new Error('nope'); } } as unknown as Document;
    expect(attachHapticTriggerIfSupported(button, iphone, media(true), broken)).toBeNull();
    expect(button.children).toHaveLength(0);
  });
});

describe('useHapticTrigger (web)', () => {
  type G = { navigator?: unknown; window?: unknown; document?: unknown };
  const g = globalThis as unknown as G;
  const saved = {
    navigator: Object.getOwnPropertyDescriptor(globalThis, 'navigator'),
    window: Object.getOwnPropertyDescriptor(globalThis, 'window'),
    document: Object.getOwnPropertyDescriptor(globalThis, 'document'),
  };
  const set = (name: keyof G, value: unknown) => Object.defineProperty(globalThis, name, { value, configurable: true, writable: true });
  afterEach(() => {
    for (const name of Object.keys(saved) as (keyof G)[]) {
      const d = saved[name];
      if (d) Object.defineProperty(globalThis, name, d);
      else delete g[name];
    }
  });

  function iosGlobals(dom: ReturnType<typeof fakeDom>) {
    set('navigator', iphone);
    set('window', { matchMedia: media(true) });
    set('document', dom.doc);
  }

  it('attaches while enabled, removes when turned off or unmounted', async () => {
    const dom = fakeDom();
    iosGlobals(dom);
    const ref = { current: dom.button as unknown };
    const hook = await renderHook(({ on }: { on: boolean }) => useHapticTrigger(ref, on), { initialProps: { on: true } });
    expect(dom.button.children).toHaveLength(1);
    await hook.rerender({ on: true });
    expect(dom.button.children).toHaveLength(1);
    await hook.rerender({ on: false });
    expect(dom.button.children).toHaveLength(0);
    await hook.rerender({ on: true });
    expect(dom.button.children).toHaveLength(1);
    await hook.unmount();
    expect(dom.button.children).toHaveLength(0);
  });

  it('does nothing when disabled from the start, or off iOS', async () => {
    const dom = fakeDom();
    iosGlobals(dom);
    const ref = { current: dom.button as unknown };
    const off = await renderHook(() => useHapticTrigger(ref, false));
    expect(dom.button.children).toHaveLength(0);
    await off.unmount();

    set('navigator', { userAgent: DESKTOP });
    set('window', { matchMedia: media(false) });
    const desktop = await renderHook(() => useHapticTrigger(ref, true));
    expect(dom.button.children).toHaveLength(0);
    await desktop.unmount();
  });

  it('follows the button to a new node', async () => {
    const a = fakeDom();
    const b = fakeDom();
    iosGlobals(a);
    const ref = { current: a.button as unknown };
    const hook = await renderHook(() => useHapticTrigger(ref, true));
    expect(a.button.children).toHaveLength(1);
    ref.current = b.button;
    await act(async () => hook.rerender({}));
    expect(a.button.children).toHaveLength(0);
    expect(b.button.children).toHaveLength(1);
    await hook.unmount();
    expect(b.button.children).toHaveLength(0);
  });
});

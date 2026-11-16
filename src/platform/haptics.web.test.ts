import { clickSwitch, hapticMode, tapHapticWeb } from './haptics.web';

const IPHONE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Mobile/15E148 Safari/604.1';
const IPAD_AS_MAC = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Safari/605.1.15';
const ANDROID = 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Mobile Safari/537.36';
const DESKTOP = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36';

const media = (coarse: boolean) => jest.fn((q: string) => ({ matches: q === '(pointer: coarse)' && coarse }));

/** Just enough DOM for clickSwitch: elements record what is done to them, and clicking the label focuses its input. */
function fakeDocument() {
  type El = {
    tagName: string;
    style: Record<string, string>;
    attrs: Record<string, string>;
    children: El[];
    parent: El | null;
    type?: string;
    tabIndex?: number;
    setAttribute: (k: string, v: string) => void;
    appendChild: (c: El) => El;
    remove: () => void;
    click: jest.Mock;
    focus: jest.Mock;
  };
  const doc = { activeElement: null as El | null, body: null as unknown as El, created: [] as El[] };
  const make = (tagName: string): El => {
    const el: El = {
      tagName: tagName.toUpperCase(),
      style: {},
      attrs: {},
      children: [],
      parent: null,
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
      // A real label click toggles its control and may move focus to it.
      click: jest.fn(() => {
        if (el.children[0]) doc.activeElement = el.children[0];
      }),
      focus: jest.fn(() => void (doc.activeElement = el)),
    };
    return el;
  };
  doc.body = make('body');
  const api = { ...doc, createElement: (t: string) => { const e = make(t); doc.created.push(e); return e; } };
  Object.defineProperty(api, 'activeElement', { get: () => doc.activeElement });
  return { api: api as unknown as Document, doc, make };
}

describe('hapticMode', () => {
  it('vibrates where the Vibration API exists on a touch screen (Android)', () => {
    expect(hapticMode({ vibrate: () => true, userAgent: ANDROID }, media(true))).toBe('vibrate');
  });
  it('uses the switch on iPhone and on iPadOS (which reports a Mac with touch)', () => {
    expect(hapticMode({ userAgent: IPHONE, platform: 'iPhone', maxTouchPoints: 5 }, media(true))).toBe('switch');
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
    const { api, doc } = fakeDocument();
    tapHapticWeb({ vibrate, userAgent: ANDROID }, media(true), api);
    expect(vibrate).toHaveBeenCalledWith(10);
    expect(doc.created).toHaveLength(0);
  });

  it('iOS: clicks a hidden switch label, removes it and gives focus back', () => {
    const { api, doc, make } = fakeDocument();
    const button = make('div');
    button.focus();
    button.focus.mockClear();
    tapHapticWeb({ userAgent: IPHONE, maxTouchPoints: 5 }, media(true), api);

    const [label, input] = doc.created;
    expect(label.tagName).toBe('LABEL');
    expect(label.attrs['aria-hidden']).toBe('true');
    expect(label.style.display).toBe('none');
    expect(input.type).toBe('checkbox');
    expect(input.attrs.switch).toBe('');
    expect(input.tabIndex).toBe(-1);
    expect(input.parent).toBe(label);
    expect(label.click).toHaveBeenCalledTimes(1);
    // Removed again, and focus is back on the button that was tapped.
    expect(doc.body.children).toHaveLength(0);
    expect(button.focus).toHaveBeenCalledWith({ preventScroll: true });
    expect(doc.activeElement).toBe(button);
  });

  it('desktop: does nothing', () => {
    const vibrate = jest.fn();
    const { api, doc } = fakeDocument();
    tapHapticWeb({ vibrate, userAgent: DESKTOP }, media(false), api);
    tapHapticWeb({ userAgent: IPAD_AS_MAC, platform: 'MacIntel', maxTouchPoints: 0 }, media(false), api);
    expect(vibrate).not.toHaveBeenCalled();
    expect(doc.created).toHaveLength(0);
  });

  it('never throws when DOM APIs are missing or fail', () => {
    expect(() => tapHapticWeb(undefined, undefined, undefined)).not.toThrow();
    expect(() => tapHapticWeb({ userAgent: IPHONE }, media(true), undefined)).not.toThrow();
    expect(() => tapHapticWeb({ userAgent: IPHONE }, media(true), {} as Document)).not.toThrow();
    const boom = () => {
      throw new Error('nope');
    };
    expect(() => tapHapticWeb({ vibrate: boom, userAgent: ANDROID }, media(true))).not.toThrow();
    expect(() => tapHapticWeb({ userAgent: ANDROID }, boom as never)).not.toThrow();
    const { api } = fakeDocument();
    (api as unknown as { createElement: () => never }).createElement = boom as never;
    expect(() => tapHapticWeb({ userAgent: IPHONE }, media(true), api)).not.toThrow();
  });

  it('still removes the switch when the click throws', () => {
    const { api, doc } = fakeDocument();
    const original = api.createElement;
    (api as unknown as { createElement: (t: string) => unknown }).createElement = (t: string) => {
      const el = original(t) as unknown as { click: jest.Mock };
      if (t === 'label') el.click.mockImplementation(() => { throw new Error('blocked'); });
      return el;
    };
    expect(() => clickSwitch(api)).toThrow('blocked');
    expect(doc.body.children).toHaveLength(0);
  });
});

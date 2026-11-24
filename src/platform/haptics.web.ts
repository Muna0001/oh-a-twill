/**
 * Web haptics for Row done. Browsers have no common haptics API:
 * - Android Chrome (and other browsers with the Vibration API) gets a 10 ms vibration from
 *   `tapHapticWeb()`, called inside the tap's handler.
 * - iOS / iPadOS Safari has no Vibration API, but since iOS 18 toggling an
 *   `<input type="checkbox" switch>` plays the system haptic. Since iOS 26.5 only a real
 *   (trusted) tap does it, not a script's `click()`. So the button gets a transparent `<label>`
 *   laid over it, holding a hidden switch: the person's own tap lands on the label, toggles the
 *   switch, and still bubbles to the button, which handles the press as usual. The same
 *   technique as the ios-haptics library (MIT), written here. See `attachHapticTrigger`.
 * - Anything without a coarse pointer (desktops, laptops) gets nothing.
 * Nothing here throws.
 */

export type HapticMode = 'vibrate' | 'switch' | 'none';

type NavigatorLike = { vibrate?: unknown; userAgent?: string; platform?: string; maxTouchPoints?: number };
type MatchMedia = (query: string) => { matches: boolean };

const TRIGGER_ATTR = 'data-haptic-trigger';

const defaultNavigator = (): NavigatorLike | undefined => (typeof navigator === 'undefined' ? undefined : navigator);
const defaultMatchMedia = (): MatchMedia | undefined =>
  typeof window === 'undefined' || typeof window.matchMedia !== 'function' ? undefined : window.matchMedia.bind(window);

/** Which haptic this browser can play: 'vibrate' (Android), 'switch' (iOS / iPadOS) or 'none'. */
export function hapticMode(nav: NavigatorLike | undefined, matchMedia: MatchMedia | undefined): HapticMode {
  if (!nav || typeof matchMedia !== 'function' || !matchMedia('(pointer: coarse)').matches) return 'none';
  if (typeof nav.vibrate === 'function') return 'vibrate';
  const ua = nav.userAgent ?? '';
  // iPadOS reports itself as a Mac; it is the one "Mac" with a touch screen.
  const apple = /iPhone|iPad|iPod/.test(ua) || (nav.platform === 'MacIntel' && (nav.maxTouchPoints ?? 0) > 1);
  return apple && /AppleWebKit/.test(ua) ? 'switch' : 'none';
}

/** Android and other Vibration API browsers: a 10 ms buzz. Does nothing on iOS (the overlay does it) or desktops. */
export function tapHapticWeb(nav: NavigatorLike | undefined = defaultNavigator(), matchMedia: MatchMedia | undefined = defaultMatchMedia()): void {
  try {
    if (hapticMode(nav, matchMedia) === 'vibrate') (nav!.vibrate as (ms: number) => boolean).call(nav, 10);
  } catch {
    // No haptics here; Row done carries on.
  }
}

/**
 * Lay a transparent label holding a hidden switch over `el` (the button's DOM node), so a real
 * tap on the button toggles the switch. Idempotent: a second call finds the first label and
 * leaves it alone. Returns the function that removes it (and undoes the `position` it set).
 */
export function attachHapticTrigger(el: HTMLElement, doc: Document): () => void {
  // Already there (another caller owns it and will remove it).
  if (el.querySelector(`:scope > [${TRIGGER_ATTR}]`)) return () => {};

  const label = doc.createElement('label');
  label.setAttribute(TRIGGER_ATTR, '');
  label.setAttribute('aria-hidden', 'true');
  Object.assign(label.style, { position: 'absolute', margin: '0', padding: '0', borderRadius: 'inherit', touchAction: 'manipulation', cursor: 'inherit' });
  label.style.setProperty('-webkit-tap-highlight-color', 'transparent');

  const input = doc.createElement('input');
  input.type = 'checkbox';
  input.setAttribute('switch', '');
  input.tabIndex = -1;
  input.setAttribute('aria-hidden', 'true');
  Object.assign(input.style, { position: 'absolute', width: '1px', height: '1px', margin: '0', visibility: 'hidden' });
  // The switch's own click (sent by the label) must not reach the button as a second press.
  input.addEventListener('click', (e) => e.stopPropagation());
  label.appendChild(input);

  let positioned = false;
  const computed = doc.defaultView?.getComputedStyle(el);
  if (computed?.position === 'static') {
    el.style.position = 'relative';
    positioned = true;
  }
  // Cover the border too, so a tap on the button's edge also lands on the label.
  const edge = (w: string | undefined) => `calc(-1 * ${w || '0px'})`;
  label.style.inset = [computed?.borderTopWidth, computed?.borderRightWidth, computed?.borderBottomWidth, computed?.borderLeftWidth].map(edge).join(' ');
  el.appendChild(label);
  return () => {
    label.remove();
    if (positioned) el.style.position = '';
  };
}

/** `attachHapticTrigger` when this browser uses the switch (iOS / iPadOS), else nothing. Never throws. */
export function attachHapticTriggerIfSupported(
  el: unknown,
  nav: NavigatorLike | undefined = defaultNavigator(),
  matchMedia: MatchMedia | undefined = defaultMatchMedia(),
  doc: Document | undefined = typeof document === 'undefined' ? undefined : document,
): (() => void) | null {
  try {
    const node = el as HTMLElement | null;
    if (!node || !doc || typeof node.appendChild !== 'function' || typeof node.querySelector !== 'function') return null;
    if (hapticMode(nav, matchMedia) !== 'switch') return null;
    const detach = attachHapticTrigger(node, doc);
    return () => {
      try {
        detach();
      } catch {
        // Already gone with the button.
      }
    };
  } catch {
    return null;
  }
}

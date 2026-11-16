/**
 * Web haptics for Row done. Browsers have no common haptics API:
 * - Android Chrome (and other browsers with the Vibration API) gets a 10 ms vibration.
 * - iOS / iPadOS Safari has no Vibration API, but since iOS 18 toggling an
 *   `<input type="checkbox" switch>` plays the system haptic. A hidden label around such a
 *   switch is created, clicked and removed (the same trick as the ios-haptics library).
 * - Anything without a coarse pointer (desktops, laptops) gets nothing.
 * Must be called synchronously inside the tap's event handler. Never throws.
 */

export type HapticMode = 'vibrate' | 'switch' | 'none';

type NavigatorLike = { vibrate?: unknown; userAgent?: string; platform?: string; maxTouchPoints?: number };
type MatchMedia = (query: string) => { matches: boolean };

/** Which haptic this browser can play. */
export function hapticMode(nav: NavigatorLike | undefined, matchMedia: MatchMedia | undefined): HapticMode {
  if (!nav || typeof matchMedia !== 'function' || !matchMedia('(pointer: coarse)').matches) return 'none';
  if (typeof nav.vibrate === 'function') return 'vibrate';
  const ua = nav.userAgent ?? '';
  // iPadOS reports itself as a Mac; it is the one "Mac" with a touch screen.
  const apple = /iPhone|iPad|iPod/.test(ua) || (nav.platform === 'MacIntel' && (nav.maxTouchPoints ?? 0) > 1);
  return apple && /AppleWebKit/.test(ua) ? 'switch' : 'none';
}

/** Click a throwaway switch. `display: none` keeps it out of layout, view and the accessibility tree. */
export function clickSwitch(doc: Document): void {
  const before = doc.activeElement as HTMLElement | null;
  const label = doc.createElement('label');
  label.setAttribute('aria-hidden', 'true');
  label.style.display = 'none';
  const input = doc.createElement('input');
  input.type = 'checkbox';
  input.setAttribute('switch', '');
  input.tabIndex = -1;
  label.appendChild(input);
  doc.body.appendChild(label);
  try {
    label.click();
  } finally {
    label.remove();
    if (before && doc.activeElement !== before) before.focus?.({ preventScroll: true });
  }
}

export function tapHapticWeb(
  nav: NavigatorLike | undefined = typeof navigator === 'undefined' ? undefined : navigator,
  matchMedia: MatchMedia | undefined = typeof window === 'undefined' ? undefined : window.matchMedia?.bind(window),
  doc: Document | undefined = typeof document === 'undefined' ? undefined : document,
): void {
  try {
    const mode = hapticMode(nav, matchMedia);
    if (mode === 'vibrate') (nav!.vibrate as (ms: number) => boolean).call(nav, 10);
    else if (mode === 'switch' && doc?.body) clickSwitch(doc);
  } catch {
    // No haptics here; Row done carries on.
  }
}

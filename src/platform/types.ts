/** What `./device` exports on every platform. See `device.web.ts` and `device.native.ts`. */

export interface ConfirmOptions {
  title: string;
  message?: string;
  /** Label of the button that confirms. */
  confirmLabel: string;
  cancelLabel: string;
  /** Draw the confirm button as destructive where the platform has such a style. */
  destructive?: boolean;
}

export interface DeviceApi {
  /**
   * A light tap: an impact on phones; on the mobile web a short vibration (Android) or the
   * switch-control haptic (iOS 18+). Call it synchronously from the tap's handler. Never throws.
   */
  tapHaptic: () => void;
  /** Keep the screen on while the calling component is mounted and `enabled` is true. Never throws. */
  useKeepAwake: (enabled: boolean) => void;
  /** ← calls `onPrev`, → calls `onNext` (web only; not while typing). Default enabled. */
  useRowKeys: (onPrev: () => void, onNext: () => void, enabled?: boolean) => void;
  /** Ask a yes/no question. Resolves true when the person confirms. */
  confirmAsync: (options: ConfirmOptions) => Promise<boolean>;
  /**
   * Bring `target` (a view's `ref.current`) into view. On the web the browser scrolls the
   * nearest scrolling ancestor. On phones pass the `ScrollView` that holds it (`Screen`'s
   * `scrollRef`); without one this does nothing. Instant when the person prefers reduced
   * motion. Never throws.
   */
  scrollIntoView: (target: unknown, scrollView?: unknown) => void;
}

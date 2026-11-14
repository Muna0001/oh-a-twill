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
  /** A light tap: an impact on phones, nothing on the web. Never throws. */
  tapHaptic: () => void;
  /** Keep the screen on while the calling component is mounted and `enabled` is true. Never throws. */
  useKeepAwake: (enabled: boolean) => void;
  /** ← calls `onPrev`, → calls `onNext` (web only; not while typing). Default enabled. */
  useRowKeys: (onPrev: () => void, onNext: () => void, enabled?: boolean) => void;
  /** Ask a yes/no question. Resolves true when the person confirms. */
  confirmAsync: (options: ConfirmOptions) => Promise<boolean>;
  /**
   * Scroll the page so the element behind `ref.current` is in view (web). On phones the
   * scroll view is owned by `Screen` and is not reachable from here, so this does nothing.
   */
  scrollIntoView: (target: unknown) => void;
}

export type PictureErrorCode = 'not-image' | 'unreadable' | 'permission';

export class PictureError extends Error {
  readonly code: PictureErrorCode;

  constructor(code: PictureErrorCode, cause?: unknown) {
    super(`Picture error: ${code}`);
    this.name = 'PictureError';
    this.code = code;
    if (cause !== undefined) this.cause = cause;
    // Keep `instanceof` working when classes are compiled down to functions.
    Object.setPrototypeOf(this, PictureError.prototype);
  }
}

/** Anything that is not already a PictureError becomes 'unreadable'. */
export function toPictureError(error: unknown): PictureError {
  return error instanceof PictureError ? error : new PictureError('unreadable', error);
}

/** True for 'image/jpeg', 'image/png', ... The reference checks `file.type.startsWith('image/')`. */
export function isImageType(type: string | null | undefined): boolean {
  return typeof type === 'string' && type.toLowerCase().startsWith('image/');
}

/** Runs `fn`, mapping every failure to a PictureError. */
export async function guarded<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (error) {
    throw toPictureError(error);
  }
}

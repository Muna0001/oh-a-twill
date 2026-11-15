/**
 * Platform differences for the guide (PLAN.md 3.7, WP9) and the old web app import (WP4).
 * Each module has a `.web.ts` and a native file; Metro picks the right one.
 */
export { confirmAsync, scrollIntoView, tapHaptic, useKeepAwake, useRowKeys } from './device';
export { isTypingTarget, rowKeyFor, type RowKey, type RowKeyEvent } from './keys';
export type { ConfirmOptions, DeviceApi } from './types';
export { readLegacy, type LegacyData } from './legacyImport';
export { useAppUpdate } from './pwa';
export { UpdateNotice } from './UpdateNotice';
export { updateNoticeDue, type AppUpdate } from './appUpdate';

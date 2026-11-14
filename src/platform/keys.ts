/**
 * Which row key (if any) a keyboard event means in the guide (PLAN.md 3.7): ← is Back and
 * → is Row done, but not while typing in a field or with a modifier held. Pure, so it can be
 * tested without a browser.
 */

export type RowKey = 'prev' | 'next';

/** The parts of a DOM `KeyboardEvent` the filter reads. */
export interface RowKeyEvent {
  key: string;
  altKey?: boolean;
  ctrlKey?: boolean;
  metaKey?: boolean;
  shiftKey?: boolean;
  defaultPrevented?: boolean;
  target?: unknown;
}

type ElementLike = {
  tagName?: unknown;
  isContentEditable?: unknown;
  closest?: (selector: string) => unknown;
};

const TYPING_TAGS = new Set(['INPUT', 'TEXTAREA', 'SELECT']);
const TYPING_SELECTOR = 'input, textarea, select, [contenteditable]:not([contenteditable="false"])';

/** True when the event target is somewhere the person types: a field, or editable content. */
export function isTypingTarget(target: unknown): boolean {
  if (!target || typeof target !== 'object') return false;
  const el = target as ElementLike;
  if (typeof el.tagName === 'string' && TYPING_TAGS.has(el.tagName.toUpperCase())) return true;
  if (el.isContentEditable === true) return true;
  if (typeof el.closest === 'function') {
    try {
      return !!el.closest(TYPING_SELECTOR);
    } catch {
      return false;
    }
  }
  return false;
}

/** 'prev' for ArrowLeft, 'next' for ArrowRight, otherwise null. */
export function rowKeyFor(e: RowKeyEvent): RowKey | null {
  if (e.defaultPrevented) return null;
  if (e.altKey || e.ctrlKey || e.metaKey || e.shiftKey) return null;
  if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return null;
  if (isTypingTarget(e.target)) return null;
  return e.key === 'ArrowLeft' ? 'prev' : 'next';
}

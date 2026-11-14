import { isTypingTarget, rowKeyFor } from './keys';

const el = (tagName: string, extra: Record<string, unknown> = {}) => ({ tagName, closest: () => null, ...extra });

describe('rowKeyFor', () => {
  it('maps the arrow keys to Back and Row done', () => {
    expect(rowKeyFor({ key: 'ArrowLeft', target: el('BODY') })).toBe('prev');
    expect(rowKeyFor({ key: 'ArrowRight', target: el('DIV') })).toBe('next');
    expect(rowKeyFor({ key: 'ArrowRight' })).toBe('next');
  });

  it('ignores other keys', () => {
    for (const key of ['ArrowUp', 'ArrowDown', 'Enter', ' ', 'a', 'Tab']) expect(rowKeyFor({ key, target: el('BODY') })).toBeNull();
  });

  it('ignores keys typed in an input, a textarea, a select or editable content', () => {
    expect(rowKeyFor({ key: 'ArrowRight', target: el('INPUT') })).toBeNull();
    expect(rowKeyFor({ key: 'ArrowLeft', target: el('input') })).toBeNull();
    expect(rowKeyFor({ key: 'ArrowLeft', target: el('TEXTAREA') })).toBeNull();
    expect(rowKeyFor({ key: 'ArrowLeft', target: el('SELECT') })).toBeNull();
    expect(rowKeyFor({ key: 'ArrowRight', target: el('DIV', { isContentEditable: true }) })).toBeNull();
    // A span inside an editable region.
    const inside = el('SPAN', { closest: (sel: string) => (sel.includes('contenteditable') ? {} : null) });
    expect(rowKeyFor({ key: 'ArrowRight', target: inside })).toBeNull();
  });

  it('ignores keys with a modifier held, or already handled', () => {
    const target = el('BODY');
    for (const mod of ['altKey', 'ctrlKey', 'metaKey', 'shiftKey']) expect(rowKeyFor({ key: 'ArrowRight', target, [mod]: true })).toBeNull();
    expect(rowKeyFor({ key: 'ArrowLeft', target, defaultPrevented: true })).toBeNull();
  });

  it('treats odd targets as not typing', () => {
    expect(isTypingTarget(null)).toBe(false);
    expect(isTypingTarget('INPUT')).toBe(false);
    expect(isTypingTarget({ closest: () => { throw new Error('bad selector'); } })).toBe(false);
  });
});

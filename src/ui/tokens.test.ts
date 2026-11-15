import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { color, radius, shadow, spacing, text, typography } from './tokens';

const root = join(__dirname, '..', '..');

describe('tokens.ts', () => {
  it('is up to date with design/tokens.json and design/variables.css (run `npm run tokens`)', () => {
    const fresh = execFileSync(process.execPath, [join(root, 'scripts/build-tokens.mjs'), '--stdout'], { cwd: root, encoding: 'utf8' });
    expect(readFileSync(join(root, 'src/ui/tokens.ts'), 'utf8')).toBe(fresh);
  });

  it('carries the named values the app relies on', () => {
    expect(color.canvas).toBe('#fff3e7');
    expect(text.heading).toEqual({ fontSize: 46, lineHeight: 1.1, letterSpacing: -1.38 });
    expect(typography['2xl'].fontSize).toBe(24);
    expect(radius.xl).toBe(14);
    expect(radius.pills).toBe(9999);
    expect(spacing[24]).toBe(24);
    expect(Object.keys(shadow)).toEqual(['xl', 'sm', 'md', 'md-2', 'subtle', 'md-3']);
  });
});

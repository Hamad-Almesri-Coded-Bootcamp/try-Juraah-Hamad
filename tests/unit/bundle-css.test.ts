import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

// The ported components reproduce bundle.css exactly; the repository copy must stay byte-identical to the
// design system's reference so a later owner correction is a copy, never a merge.
describe('components/ui/styles/bundle.css', () => {
  it('is byte-identical to docs/design-system/bundle.css', () => {
    expect(readFileSync('components/ui/styles/bundle.css')).toEqual(readFileSync('docs/design-system/bundle.css'));
  });
  it('carries no hex colour and no px font-size or radius of its own', () => {
    const css = readFileSync('components/ui/styles/bundle.css', 'utf8');
    expect(css).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
    expect(css).not.toMatch(/font-size\s*:\s*\d+px/);
    expect(css).not.toMatch(/border-radius\s*:\s*\d+px/);
  });
});

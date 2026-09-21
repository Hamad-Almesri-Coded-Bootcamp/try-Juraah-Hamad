import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

const css = readFileSync('styles/tokens.css', 'utf8');
const tokens = JSON.parse(readFileSync('docs/design-system/tokens.json', 'utf8'));

describe('compiled tokens.css', () => {
  it('carries every colour token at its exact value', () => {
    for (const t of tokens.color.tokens) expect(css).toContain(`--${t.name}: ${t.value};`);
  });
  it('defines --font-sans with IBM Plex Sans Arabic first', () => {
    expect(css).toMatch(/--font-sans: "IBM Plex Sans Arabic", "IBM Plex Sans", system-ui, sans-serif;/);
  });
  it('encodes the type scale: body 17px, nothing below 13px', () => {
    expect(css).toContain('--type-body-size: 17px;');
    const sizes = [...css.matchAll(/--type-[a-z-]+-size: (\d+)px;/g)].map((m) => Number(m[1]));
    expect(Math.min(...sizes)).toBeGreaterThanOrEqual(13);
  });
  it('states the structural constants the brand book requires', () => {
    expect(css).toContain('--hit-area: 44px;');
    expect(css).toContain('--hit-area-primary: 48px;');
    expect(css).toContain('--content-max: 880px;');
  });
});

/**
 * ACCEPTANCE (WP4a brief): "zero imports from `lib/data` (assert in a unit test: the module graph
 * of `features/landing` and `app/[locale]/page.tsx` contains no `lib/data`)". Stricter than the
 * repository-wide guard 3 (`scripts/guards/seam.ts`), which only forbids a *mock* import outside
 * `lib/data` — L1 must not import the public data-access layer either, since SCREENS.md's L1 row
 * states "Data functions: none". A local, self-contained file scan (no dependency on
 * `scripts/guards`, which this bundle does not own) over every `.ts`/`.tsx` source file this
 * bundle owns.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

function collectFiles(dir: string, out: string[] = []): string[] {
  let entries: string[] = [];
  try {
    entries = readdirSync(dir);
  } catch {
    return out;
  }
  for (const entry of entries) {
    const path = join(dir, entry);
    const stat = statSync(path);
    if (stat.isDirectory()) collectFiles(path, out);
    else if (/\.(ts|tsx)$/.test(entry)) out.push(path);
  }
  return out;
}

const LIB_DATA_IMPORT = /from\s+['"](@\/)?lib\/data(\/|['"])/;

describe('E-50 · L1 seam: no lib/data import anywhere in its module graph', () => {
  const files = [...collectFiles('features/landing'), 'app/[locale]/page.tsx'];

  it('scanned at least the expected files (guards the guard: a typo here must not silently pass)', () => {
    expect(files.length).toBeGreaterThanOrEqual(15);
    expect(files).toContain('app/[locale]/page.tsx');
  });

  for (const file of files) {
    it(`${file} imports no lib/data`, () => {
      const src = readFileSync(file, 'utf8');
      expect(LIB_DATA_IMPORT.test(src)).toBe(false);
    });
  }

  it('no file under features/landing or the L1 route contains a fetch call', () => {
    for (const file of files) {
      const src = readFileSync(file, 'utf8');
      expect(/\bfetch\s*\(/.test(src)).toBe(false);
    }
  });
});

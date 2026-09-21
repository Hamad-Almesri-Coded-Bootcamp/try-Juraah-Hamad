import { defineConfig } from 'eslint/config';
import nextVitals from 'eslint-config-next/core-web-vitals';
import nextTs from 'eslint-config-next/typescript';
import react from 'eslint-plugin-react';

export default defineConfig([
  {
    ignores: [
      '.next/**',
      'node_modules/**',
      'out/**',
      'coverage/**',
      'playwright-report/**',
      'test-results/**',
      'styles/tokens.css',
      'public/sw.js',
      'next-env.d.ts',
    ],
  },
  ...nextVitals,
  ...nextTs,
  {
    // Guard 7, part one: no literal user-facing string in JSX children. Every string on a screen
    // comes from the copy catalogue under i18n/copy. Props are left to scripts/guards/no-literal-copy.ts,
    // which knows which props carry copy (label, title, placeholder, …) and which do not (className).
    // The dev-only components gallery is exempt.
    files: ['app/**/*.tsx', 'components/**/*.tsx', 'features/**/*.tsx'],
    // Component unit tests render literal fixtures on purpose and never ship.
    ignores: ['app/(dev)/**', '**/*.test.tsx'],
    plugins: { react },
    rules: {
      'react/jsx-no-literals': [
        'error',
        { noStrings: true, ignoreProps: true, noAttributeStrings: false, allowedStrings: ['·', '—', '/', ':', '(', ')', '%'] },
      ],
    },
  },
]);

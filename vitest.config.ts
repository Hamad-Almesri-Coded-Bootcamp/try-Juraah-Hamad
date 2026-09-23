import { configDefaults, defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'node:path';

const here = import.meta.dirname;

export default defineConfig({
  plugins: [react()],
  resolve: { alias: { '@': path.resolve(here, '.') } },
  test: {
    environment: 'jsdom',
    include: ['tests/unit/**/*.test.{ts,tsx}', 'lib/**/*.test.{ts,tsx}', 'components/**/*.test.{ts,tsx}', 'i18n/**/*.test.{ts,tsx}'],
    // The real-database suite is its own project (vitest.integration.config.ts, P2-WP1).
    exclude: [...configDefaults.exclude, 'tests/integration/**'],
    setupFiles: ['tests/setup.ts'],
    globals: false,
  },
});

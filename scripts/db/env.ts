/**
 * Loads .env.local (gitignored) into process.env for the tsx scripts and the integration harness —
 * Next loads it for `next dev/start`, nothing loads it for a plain `tsx`/vitest run. Node 22's
 * built-in loader, no dependency; variables already set in the environment win. Never prints a value.
 */
import { existsSync } from 'node:fs';

export function loadLocalEnv(file = '.env.local'): boolean {
  if (!existsSync(file)) return false;
  const before = { ...process.env };
  process.loadEnvFile(file);
  for (const [k, v] of Object.entries(before)) process.env[k] = v; // pre-set values win
  return true;
}

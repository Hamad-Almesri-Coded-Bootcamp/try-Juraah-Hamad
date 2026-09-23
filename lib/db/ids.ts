/**
 * Opaque ids for rows the application creates at runtime (CR-041, BACKEND-NOTES §2: counters
 * collide after a removal and leak record counts). `<prefix>_<ULID>` — 26 Crockford base32
 * characters: 48 bits of time, 80 bits of randomness. No dependency.
 *
 * The time half reads REFERENCE_NOW, never the wall clock (D-021, guard 6): with the frozen clock
 * every id shares one time prefix, so ids are unique (80 random bits) but not time-sortable —
 * nothing orders by id; ordering is `seq` / `created_at`. Seed rows keep their seed ids.
 */
import { REFERENCE_NOW } from '@/lib/config';

const CROCKFORD = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';

function encodeTime(ms: number): string {
  let out = '';
  let t = ms;
  for (let i = 0; i < 10; i++) {
    out = (CROCKFORD[t % 32] ?? '0') + out;
    t = Math.floor(t / 32);
  }
  return out;
}

function encodeRandom(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  let out = '';
  for (let i = 0; i < 16; i++) out += CROCKFORD[(bytes[i] ?? 0) % 32] ?? '0';
  return out;
}

export function ulid(): string {
  return encodeTime(Date.parse(REFERENCE_NOW)) + encodeRandom();
}

/** e.g. newId('rx') → 'rx_01K5…'. The prefix is the entity's short name, never a counter. */
export function newId(prefix: string): string {
  if (!/^[a-z]{1,8}$/.test(prefix)) throw new Error(`newId: bad prefix '${prefix}'`);
  return `${prefix}_${ulid()}`;
}

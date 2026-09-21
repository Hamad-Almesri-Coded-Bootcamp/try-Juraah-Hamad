/**
 * Dev-only fault and fixture switching (D-002, owner's condition 2): a cookie read ONLY here —
 * nothing else in the product branches on it, and it is inert in production. WP4's screens read
 * this to drive the loading / error / offline states G7 requires without a real backend; WP1
 * itself does not wire per-function delays (no unit test in docs/briefs/WP1.md's Verification 8
 * requires one) — that wiring is left to the work packages that build the screens, noted in
 * docs/backend-notes/wp1.md §7.
 */
import { cookies } from 'next/headers';

export const DEV_COOKIE = 'jurah.dev';

export interface DevFaultState {
  loading?: boolean;
  error?: boolean;
  offline?: boolean;
  fixture?: string;
}

/** Returns null outside a request context (tests, scripts) or in production — never throws. */
export async function getDevFaultState(): Promise<DevFaultState | null> {
  if (process.env.NODE_ENV === 'production') return null;
  try {
    const store = await cookies();
    const raw = store.get(DEV_COOKIE)?.value;
    if (!raw) return null;
    return JSON.parse(decodeURIComponent(raw)) as DevFaultState;
  } catch {
    return null;
  }
}

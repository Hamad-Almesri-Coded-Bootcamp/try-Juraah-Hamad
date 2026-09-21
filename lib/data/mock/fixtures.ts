/**
 * Named fixture overlays for the dev-only fault/fixture switch (D-002; `faults.ts` reads the
 * cookie, this module names the overlays it may select). Registered, not wired into every
 * function — WP4 opts individual screens in as they are built (docs/backend-notes/wp1.md §7).
 */

/** Fixture names a `fixture` value on the dev cookie may select. */
export const FIXTURE_NAMES = ['default', 'onboarding-incomplete', 'empty-day', 'empty-medicines'] as const;
export type FixtureName = (typeof FIXTURE_NAMES)[number];

export function isFixtureName(value: string | undefined): value is FixtureName {
  return !!value && (FIXTURE_NAMES as readonly string[]).includes(value);
}

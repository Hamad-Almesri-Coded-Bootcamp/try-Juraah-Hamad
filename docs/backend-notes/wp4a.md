# WP4a — Landing (L1): notes

L1 has no data surface (SCREENS.md: "Data functions: none") and makes no data-layer call, so this
fragment carries only the two sections the brief calls for — §6 and §7. Sections 1–5 (the
data-access surface, the mock's shortcuts, absences-that-must-become-refusals, field dependencies,
verbatim shapes) do not apply to this screen and are left to the bundles that own a data surface.

## §6. Deferred to Phase 2 by design

- **The hero mockup is a placeholder image, not the real Today screen (CR-019).** `docs/DECISIONS.md`
  resolved this at Gate 0: bundle (a) ships `public/landing/today-preview.svg` — a generic,
  abstract schematic at the final aspect ratio (skeleton bars only: no drug name, no dose amount,
  no patient data) — with the full description carried in the alt text
  (`i18n/copy/landing.ts` → `heroMockupAlt`), never in the image itself. **Bundle (c)'s gate swaps
  the file for a real exported B1 screenshot** (tracking-off, حمد, `REFERENCE_NOW`), at the same
  path (`public/landing/today-preview.svg`) and the same `width`/`height` attributes in
  `features/landing/Hero.tsx`, so no other file needs to change when the swap happens. Until then,
  G11's "every screenshot shown is a screen that exists" is satisfied by the schematic carrying no
  claim of being a real capture — it is captioned and alt-texted as a preview, not asserted to be a
  screenshot.
- **No real bot, no real push, no real Civil ID service** — L1 never mentions any of the three; the
  academic-transparency section (9) discloses the simulated identity flow in plain language instead,
  per G11's own invariant.

## §7. Things this work found out the hard way

1. **The approved boards repeat one `variant="primary"` Button at three scroll positions** (the
   persistent header, the hero, and the closing section) — not three competing primary actions.
   `components/ui/README/Button.md`'s "don't put two primary buttons on one screen" is about
   competing decisions on one screen, not the same action re-offered at the top and bottom of one
   long scroll; built to the boards as the more specific, approved reference. Flagged here in case
   a reviewer reads the generic rule literally against this screen.
2. **`AppBar` does not fit L1's header.** `AppBar.md` allows exactly one trailing action, and the
   boards draw two side by side (the language switch and the persistent sign-in button). L1 is the
   one screen with its own approved layout markup (SCREENS.md), so `features/landing/Header.tsx`
   is a plain header built from tokens rather than a forced, rule-breaking use of `AppBar`.
3. **Tailwind's default breakpoint scale is gone in this repo** (`styles/theme.css` resets
   `--breakpoint-*: initial` and defines only `tablet` (834px) and `desktop` (1440px)) — `md:`/`lg:`
   prefixes silently compile to nothing. Every responsive class in `features/landing/**` uses
   `tablet:`, matching the convention already established in `features/shell/AppShell.tsx` and
   `ClinicNav.tsx`.
4. **The "who it's for" section's two buttons (section 7) always go to `/signin`**, regardless of
   `resolveLandingCta`'s signed-in state — they frame the two audiences the product serves, not the
   one repeated primary action. Only the header, hero and closing buttons read the continue-variant
   copy for a signed-in viewer.
5. **The signed-in destination for a `pending_invitation_only` session is `/invitation`, not a
   shell home** — `features/shell/tabs.ts`'s `homePathFor` only covers the four roles, so
   `features/landing/cta.ts`'s `resolveLandingCta` checks `session.pendingInvitationOnly` first,
   before falling back to `homePathFor(session.role, locale)`.
6. **That branch is unreachable through a real browser navigation to L1.** `proxy.ts`'s blanket
   rule — `if (session?.pendingInvitationOnly && rest !== '/invitation') return redirectTo
   ('/invitation')` — fires for every path including the landing page itself (`rest === '/'`), so a
   pending-invitation-only session is redirected away from `/{locale}` before this route ever
   renders (`tests/e2e/roles.spec.ts`'s ناصر walk already checks `/` among the routes that
   redirect). `resolveLandingCta`'s handling of this case is therefore defensive-only, exercised by
   `tests/unit/landing/cta.test.ts`, not by `tests/e2e/landing.spec.ts` — an e2e test that tried to
   assert it through `page.goto('/ar')` would actually be observing `/ar/invitation`, not L1.

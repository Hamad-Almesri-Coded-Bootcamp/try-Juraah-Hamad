# P2-WP2 — Auth, sessions and role resolution · task brief

Read `docs/briefs/P2-common.md` first. One subagent (Opus). Depends on Gate 1. **Blocks WP3, WP5, WP6, WP7's session-bound tests** (they can start, but their integration tests need your signed-cookie helper).

## OBJECTIVE

Replace the unsigned JSON cookie with the signed cookie + `sessions` table of D-018, implement the five session functions over Postgres, make `proxy.ts` verify the signature at the edge, resolve roles server-side exactly as `docs/ROLES.md` states (a caregiver counts only when `active`; a pending-only session reaches F0's data and nothing else), persist the last chosen role per account, and make `signIn`'s two `no_claims` cases indistinguishable in shape and timing.

## FILES YOU OWN

- `lib/session/verify.ts` (new) — Web-Crypto-only (no Node `crypto`, so `proxy.ts` can import it at the edge): `signSession(payload, secret) → cookieValue`, `verifySession(cookieValue, secret) → payload | null` (HMAC-SHA256 over `base64url(JSON)`; constant-time compare; `exp` checked). Payload = `{ session: Session, sid: string, exp: number }`.
- `lib/session/cookie.ts` — now reads/writes the **signed** cookie through `verify.ts`; keeps the script-session fallback for `print-shapes.ts`; the cookie name stays `SESSION_COOKIE` from `lib/config.ts`. `httpOnly`, `sameSite: 'lax'`, `path: '/'`, `secure` in production.
- `lib/session/pg/index.ts` — real bodies for `signIn`, `getSession`, `getRoleOptions`, `chooseRole`, `signOut` per `docs/API-SURFACE.md` §A "Session module". `getSession` = verify cookie → `select` the `sessions` row (`revoked_at is null and expires_at > jurah_now()`) → return the `Session` **shape unchanged**. `signIn` never trusts anything but the Civil ID string: test-list membership from `civil_id_test_list`, claims from the one query, outcome per ROLES.md steps 3–4; a `sessions` row + cookie only for `single_role`/`multiple_roles`/`pending_invitation_only`; `signed_in` audit row for `single_role` as the mock; **the two `no_claims` paths run the identical statements** (query the account row whether or not one exists; no early return). `multiple_roles` default = `accounts.last_chosen_role` when it is still one of the options, else the first. `chooseRole` re-derives the options server-side and refuses an option the caller does not hold (returns the current session unchanged — the mock's shape). `signOut` revokes the row, clears the cookie, writes `signed_out`.
- `lib/session/resolve.ts` — keep the pure algorithm; if the pg path needs a store-shaped input, build an adapter in `pg/`, do not fork the algorithm.
- `proxy.ts` — replace `readSession` with `verifySession` from `lib/session/verify.ts` (secret from `process.env.JURAH_SESSION_SECRET` — **the one exception to "no `process.env` outside config"**, because `proxy.ts` runs at the edge and must not import the server config module; say so in a comment). **Every redirect rule stays exactly as it is** (D-006, the pending-only blanket rule, the clinic special cases). Behaviour with a missing or invalid signature = no session.
- `tests/e2e/helpers/session.ts` — `sessionCookieFor` now mints a **signed** cookie (reads `JURAH_SESSION_SECRET` from the environment Playwright runs in) **and** inserts the matching `sessions` row when `JURAH_DATABASE_URL` is set (so the data layer's revocation check passes); unchanged `TEST_SESSIONS` ids. Keep the export names — every e2e spec imports them.
- `playwright.config.ts` — `webServer.command` pins `JURAH_DATA_BACKEND` explicitly (`postgres` when `JURAH_DATABASE_URL` is set, else `mock`) and forwards `JURAH_SESSION_SECRET`.
- `tests/integration/enforcement/auth.test.ts` (new) — rows **E-13 (session half), E-16, E-17, E-18, E-19, E-20 (read-time half), E-21, E-22, E-24, E-25, E-26, E-27, E-36, E-37**, each test titled by id. Also the twelve-ID resolution table from `docs/ROLES.md` against Postgres, and the 200-sample timing comparison for E-27 (paste medians and p95).
- `tests/unit/session/verify.test.ts` (new) — sign/verify round trip, tampered payload refused, expired refused, wrong secret refused.
- `docs/backend-notes/p2-wp2.md` (new) — your fragment.

## FILES YOU MUST NOT TOUCH

The frozen set; `lib/data/**` except adding your session helpers' imports where `pg/` already expects them; `lib/db/**` (request changes); `supabase/migrations/0001`–`0006` (never edit; **you own the new `supabase/migrations/0007_sessions_and_signin.sql`** — D-026 — for the `SECURITY DEFINER` sign-in resolver over `accounts`/`civil_id_test_list` and the real `sessions` policies; apply it through both paths and record it in `supabase/README.md`); `scripts/**` except `print-shapes.ts`'s `setScriptSession` call site if the signature changes; `tests/e2e/*.spec.ts` (they must pass unchanged — that is the point).

## ACCEPTANCE — Gate 2

Paste: `npm run test -- tests/unit/session` · `npm run test:integration -- tests/integration/enforcement/auth.test.ts` (or the loud NOT-A-PASS line plus the same proofs by hand through MCP) · the E-25 hand-crafted-cookie attempt against `/ar/clinic/audit` (curl output) · the E-26 replay · the E-27 distributions · `npm run verify` exit 0 in mock · the e2e suites `roles.spec.ts`, `identity.spec.ts`, `shells.spec.ts` green against **postgres** when the URL exists, otherwise against mock with the new signed cookie · the frozen-set diff empty.

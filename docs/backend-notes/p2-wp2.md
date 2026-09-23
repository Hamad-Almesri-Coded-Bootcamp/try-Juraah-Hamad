# P2-WP2: auth, sessions and role resolution, notes

Written by the WP2 implementer (brief: `docs/briefs/P2-WP2.md`), 2026-09-22. `JURAH_DATABASE_URL` is
still empty in `.env.local`, so the Postgres half was proved by hand through the Supabase MCP
connector (project `frvubflbpujwuhsxweue`). The integration file fails loudly with NOT A PASS
until the URL exists.

## 1. What exists now

- **`lib/session/verify.ts`** is new and uses Web Crypto only. It holds `signSession`,
  `verifySession`, `canonicalSession`, `sessionExpiry`, `newSessionId` and `SESSION_TTL_MS`.
  - The cookie value is `base64url(JSON{session, sid, exp}).base64url(HMAC-SHA256)`. The key is the
    UTF-8 bytes of `JURAH_SESSION_SECRET`.
  - The MAC is checked with `crypto.subtle.verify` before the payload is parsed. The payload is then
    shape-checked strictly: known keys only, a known role, and either a role or pending-only.
  - `exp` is epoch milliseconds on the **frozen clock** (D-021) and is compared with
    `Date.parse(REFERENCE_NOW)` unless a test passes a clock. Bad input never throws; it returns `null`.
- **`lib/session/cookie.ts`** reads and writes the signed cookie through `verify.ts`. The cookie is
  `httpOnly`, `sameSite: 'lax'`, `path: '/'`, and `secure` when `SESSION_COOKIE_SECURE` is set
  (production).
  - On the postgres backend, reading also requires the live `sessions` row (`isSessionLive`). So
    `lib/data/pg/_shared.ts`'s `sessionOf()`, which every pg read goes through, refuses a revoked
    cookie. `_shared.ts` itself was **not** edited.
  - Other packages get `readSessionClaims()` (session + sid) and `claimsFromCookieValue()`.
  - Script context keeps the old `setScriptSession`, a trusted raw session for `print-shapes.ts`.
    It adds a signed-cookie jar (`setScriptCookie`/`getScriptCookie`), which is verified exactly as a
    request cookie is.
- **`lib/session/pg/index.ts`** has real bodies for the five functions, plus these helpers for
  other packages:
  - `insertSessionRow(tx, session)`: for WP5's `acceptInvitation`. Run it under the same person's
    current session.
  - `revokeSessionRow(tx, sid)` and `issueSession(session)`.
  - `isSessionLive`.
  - `openSessionRows` (used by the e2e helper).
  - `signInAt(civilId, nowIso)`: the explicit-clock form (D-021).
  - `claimsStore` (the adapter) and `SESSION_SQL`.
- **`lib/session/resolve.ts` is unchanged.** The pg path builds a store-shaped adapter from the
  claims (`claimsStore`) and calls the same `resolveCivilId` / `roleOptionsFor`, so the algorithm is
  not forked.
- **`supabase/migrations/0007_sessions_and_signin.sql`** (D-026) adds:
  - `signin_claims(civil_id, at)`: one `SECURITY DEFINER` statement covering the test list, the
    patient, the first active caregiver row with the linked patient's first name, the clinic roles,
    `last_chosen_role` and the unexpired pending invitations. It never returns a Civil ID.
  - `session_row_ok(...)`: a boolean definer used as the sessions insert `WITH CHECK`.
  - The three real `sessions` policies.
  - It was applied through `apply_migration`. The stored text's md5 equals the file's
    (`0eda5d27c30ac2d0d72588cfc69bbd32`). Re-executing the recorded text left the policy and
    function fingerprints identical and the history at 8 rows. It is recorded in `supabase/README.md`.
- **`proxy.ts`** is now `async` and uses `verifySession`. It reads `process.env.JURAH_SESSION_SECRET`
  directly: this is the one exception, and it is commented. Every redirect rule is byte-for-byte what
  it was, and a unit test walks them. It has no database, so a signed but revoked cookie passes the
  proxy. The shell layout's `requireRole` → `getSession()` refuses it (the two-place pattern).
- **`lib/config.ts`**: `sessionSecret()` is a function, read at call time, because the tsx scripts
  and the harness load `.env.local` after the first import. `SESSION_COOKIE_SECURE` is also here.
  Both were added with WP6's server-only pattern; the module's shape is otherwise unchanged.
- **`tests/e2e/helpers/session.ts`** signs synchronously with `node:crypto`. It produces the same
  bytes as Web Crypto, and a unit test proves `verify.ts` accepts every `TEST_SESSIONS` cookie.
  - With `JURAH_DATABASE_URL` set, **every call gets its own fresh `sessions` row**. Rows are opened
    in batches of 10 per persona by a child process (`node --import tsx -e …`) that runs
    `lib/session/pg`'s `openSessionRows`, so the product insert path and the `session_row_ok` policy
    decide.
  - This way, the `signOut` in `identity.spec`/`roles.spec` never revokes a row that another
    parallel test holds. The helper never holds a connection (guard 8). The export names are
    unchanged.
- **`playwright.config.ts`** calls `loadLocalEnv()`. `webServer.command` pins
  `JURAH_DATA_BACKEND=<postgres|mock>`, chosen by whether a URL is configured. `env` forwards
  `JURAH_SESSION_SECRET` and the backend.

## 2. Divergences

These use the same columns as `docs/BACKEND-DIVERGENCES.md`. The ids are provisional
(`D-WP2-n`), for the lead to renumber when merging.

| # | Function / place | Mock | Backend | Why | Could a screen notice? |
|---|---|---|---|---|---|
| D-WP2-1 | `chooseRole(option)` for an option the caller does not hold | Writes a cookie for **any** option and returns it (a client can pick `admin`) | Re-derives the options server-side. A foreign option returns the **current session unchanged** and writes nothing (E-36). The new session is built from the server's option, never from the body. | BACKEND-NOTES §2, E-36 | No. A1b, X0 and RoleSwitch only offer the caller's own options. |
| D-WP2-2 | `chooseRole` with no verified session | Writes a cookie for the option | Echoes `sessionForOption(option)` with **no cookie and no row**. The frozen signature returns a `Session`, so this is the shape that does not throw (a throw would reach `error.tsx`). The next navigation finds no session and `proxy.ts` sends it to sign-in. | D-022 | No. Unreachable from a screen, since every caller is signed in. |
| D-WP2-3 | `chooseRole` success | Overwrites the cookie | Revokes the old `sessions` row, inserts a new row (new sid), writes `accounts.last_chosen_role`, then re-signs | D-018 (rotation on privilege change), BACKEND-NOTES §2 | No |
| D-WP2-4 | Session expiry | None | `exp` and `expires_at` are `REFERENCE_NOW + 12 h`, compared on the frozen clock (D-021). During the demo a session therefore never expires by time; only sign-out or revocation ends it. Moving to real time is the same one-value change as the rest of D-021. | D-021 | No |
| D-WP2-5 | Script context (`setScriptSession`) on the postgres backend | n/a | A raw script session has no sid and is **trusted without a row check**. It can only happen outside a Next request (where `cookies()` throws), so no browser can reach it. `print-shapes.ts --backend=postgres` depends on it. A signed cookie in script context *is* row-checked. | Gate 3's round trip under seeded actors | No |
| D-WP2-6 | `getRoleOptions` for a Civil ID outside the test list | Returns its options (the mock never checks the list here) | `[]` (`signin_claims` returns only `{inList:false}`) | The claims function answers nothing for an unlisted ID | No. Every account-holding ID is on the list by construction. |
| D-WP2-7 | Writing a session in a request with `JURAH_SESSION_SECRET` unset | Unsigned JSON | `signSession` throws loudly (a configuration error, never an unsigned cookie). `proxy.ts` verifies nothing, so every gated route behaves as signed out (fail closed). | D-018 | Only in a misconfigured deployment. |
| D-WP2-8 | A sessions row whose subject later loses the role (caregiver revoked) | n/a | The row stays live until someone revokes it. WP5's `revokeCaregiver`/`selfUnlink` must revoke them, and 0007's policies let the linked patient do it. Data access is refused regardless, because `can_read_patient` reads `status='active'`. | Defence in depth | No |
| D-WP2-9 | Redirect status | `proxy.ts` `NextResponse.redirect` → **307** | Unchanged: 307 | ENFORCEMENT.md says "302" in E-22/E-25/E-26/E-28. The proxy was never 302, and "every redirect rule stays exactly as it is". | No. The lead should read "302" as "the proxy's redirect". |

## 3. Change requests

**CR-WP2-1: two frozen e2e specs mint an UNSIGNED session cookie inline, and D-018 refuses it by
design.**
- **What the documents say.** The brief says "`tests/e2e/*.spec.ts` must pass unchanged". But
  `identity.spec.ts:25` (`addPendingInvitationOnly`, used by the test at `:86`) and `roles.spec.ts:55`
  (used at `:117`) build ناصر's pending-only cookie themselves as
  `encodeURIComponent(JSON.stringify({ subjectId, pendingInvitationOnly: true }))`. WP3 chose not to
  extend the helper.
- **Why it is a problem.** That is exactly E-25's hand-crafted cookie. Accepting it would undo D-018,
  so these 2 tests × 3 projects = 6 fail deterministically (`/ar/gate` → `/ar/signin`, never
  `/ar/invitation`).
- **Proposal.** Replace the `value:` line in each of those two local helpers with
  `pendingInvitationCookieFor(subjectId, base).value`. That helper is now exported from
  `tests/e2e/helpers/session.ts`: signed, with a real `sessions` row when the database is
  configured. It is a one-line change in each spec. Proved in an isolated copy with exactly that
  edit: **6 passed**.
- **Cost.** Two lines in two spec files that are outside WP2's write scope. It needs the lead's or
  the owner's go-ahead.
- **If we don't.** Those 6 tests stay red on both backends forever, or someone "fixes" them by
  accepting unsigned cookies.

Nothing else touches a shape or a screen. There is one documentation request for the lead: ENFORCEMENT.md's
"302" should read "307" (D-WP2-9). Two notes for WP5, which are not change requests:
(a) `acceptInvitation` should call `insertSessionRow(tx, newCaregiverSession)` inside its own
transaction under ناصر's pending session, after the status update. `session_row_ok` then sees the
row `active`, and the insert is admitted.
(b) `declineInvitation` / `revokeCaregiver` / `selfUnlink` revoke rows with
`update sessions set revoked_at = jurah_now() where subject_id = $1 and revoked_at is null`. The
0007 policies admit the patient for its own caregivers' rows and the caregiver for its own rows.

## 4. Things found out the hard way

- **Every e2e spec calls `sessionCookieFor(...)` synchronously**, inline in `addCookies([...])`.
  Web Crypto is async, so the helper signs with `node:crypto` (same HMAC bytes) and opens the
  sessions rows in a synchronous child process. A deterministic sid per persona plus a
  `globalSetup` would have been simpler, but one `signOut` test would then revoke the row every
  parallel test of that persona uses.
- **`update accounts set last_chosen_role = …` with no `WHERE` works for `jurah_app`** even though
  it has no SELECT on `accounts`. RLS `accounts_update_own` limits it to the caller's own row (MCP
  proof: 1 row, `acc-03` only). A `WHERE civil_id = …` would need a column SELECT that WP1
  deliberately withheld.
- **A policy cannot call `civil_id_for_session()`**, because its EXECUTE is revoked from the app
  roles (WP1 §3.16). `session_row_ok()` wraps it in a definer that returns only a boolean.
- **The shared checkout is not a stable e2e environment while other packages run.** Parallel
  `next build` runs and a long-lived `next dev` on :3100 write the same `.next`. This caused
  `ENOTEMPTY .next/build`, `SyntaxError … JSON at position N` on arbitrary pages, and 500s. Also,
  when Playwright's reused server is slow, it starts a **second** `next dev`, which fails with
  EADDRINUSE but still writes `.next`.
  - The e2e evidence below therefore comes from an isolated copy (rsync of the tree, `node_modules`
    cloned with `cp -c`, port 3210, a fresh `.next`, and Playwright owning the one server).
    Turbopack refuses a `node_modules` **symlink** that points outside the project root, which is
    why the clone is used.
  - **At WPfinal, run the e2e suites with nothing else building.**
- **This machine's load average reached ~150–490 while the other packages ran.** Cold `next dev`
  compiles took 8–12 s per route, so the 17-route role walks and the sign-in → gate → shell hops
  exceed the specs' fixed 5 s / 10 s / 30 s timeouts. Every failure in the e2e runs was a timeout or
  an URL still mid-redirect. None was a server error or a wrong destination, except the six
  CR-WP2-1 instances. Each test passes when the machine is quiet (a serial rerun at load ~44:
  6/6). A clean single-run count needs an idle machine.
  **Control:** the unmodified baseline (`git archive 8cd7794`, its own copy on :3220, the same three
  suites) failed **107 of 177** at load ~320–357. The failures were the same kinds of timeouts, on
  the same tests, including ناصر's. This branch had 155 passed / 20 failed at load ~43, and
  79 passed / 96 failed at ~290–350.
- **Next 16.3.5 dev writes `.next/dev/prerender-manifest.json` non-atomically** when it receives
  concurrent requests. It was found holding two overlapping JSON documents (1490 bytes, with a
  second tail after position 1453), and every page then 500s with `Unexpected non-whitespace
  character after JSON` until `.next` is removed. Always delete `.next` before an e2e run.
- **An MCP `execute_sql` DO block can return a multi-line proof** as the text of a final
  `raise exception`, which also rolls everything back. PL/pgSQL `RAISE` rejects `%%` in the
  format string.

## 4b. Notes for WPfinal

- **Two round trips per read on postgres.** `readSessionCookie()` runs one `withSession`
  transaction for the liveness check before the seam function's own. That is fine for the demo, and
  merging the two would need a `lib/db` change.
- **`SESSION_COOKIE_SECURE` is `NODE_ENV === 'production'`.** Under `next start` over plain http on
  a host other than localhost, the browser drops the `Secure` cookie. Chrome exempts `localhost`.
- **E-27's pasted distributions are server-side `signin_claims` timings, in µs.** The brief's
  200 × full `signIn` round-trip comparison is in `auth.test.ts` and needs the URL.

## 5. Proofs

These are in the WP2 report. The integration suite (`tests/integration/enforcement/auth.test.ts`, 19
tests titled by row id) proves the same things against the real database once the URL exists.

## 6. What still needs `JURAH_DATABASE_URL`

- `npm run test:integration -- tests/integration/enforcement/auth.test.ts`, run for real. This
  includes the client-side E-27 timing (200 × 2 full `signIn` round trips) and the E-26 seam test
  through WP3a's `getDosesForDay`.
- The E-26 replay by curl against a postgres `next dev`. Expected: the proxy passes it, and the
  layout's `requireRole` sends it to `/ar/signin`.
- The three e2e suites on the postgres backend (the helper's row path).
- `print-shapes --backend=postgres` for the five session lines.

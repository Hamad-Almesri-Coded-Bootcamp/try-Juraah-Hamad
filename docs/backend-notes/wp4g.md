# WP4 bundle g — Calendar, activity, settings, help, notifications (E1–E5)

Backend/Phase-2 handoff notes, per `docs/Phase 2 — Backend Handoff.md` §3. Written as this bundle
was built, not at the end.

## §2 — Mock shortcuts this bundle depended on (Phase 2 must not carry over)

- **The simulated push grant.** `requestPushPermission` never asks a real browser — it flips the
  mock's own `PushSubscription` row to `{ status: 'active', permission: 'granted' }` unconditionally
  (`lib/data/index.ts`). `PUSH_IS_SIMULATED` (`lib/config.ts`) marks this; E5 shows no copy claiming
  a real browser permission dialog occurred.
- **The mock chat confirms `pending → connected` after a fixed ~50ms `setTimeout`**
  (`startMessagingLink`, `lib/data/index.ts`), never a real Telegram bot. `NotificationsScreen`
  (`features/ambient/NotificationsScreen.tsx`) polls (`router.refresh()` on a client timer) while
  `messaging.status === 'pending'` rather than sleeping a fixed guess, so it works unchanged once
  Phase 2 replaces the 50ms mock delay with a real webhook-driven confirmation of arbitrary length.
- **The webcal token shortcut.** `enableCalendarSync` computes `icsUrl`/`token` inline in
  `lib/data/index.ts` (`webcal://jurah.app/calendar/${patientId}.ics`, `mock-token-cal-${patientId}`)
  instead of a server-issued opaque token. E1 (`features/ambient/CalendarSync.tsx`) renders whatever
  `CalendarSubscription.icsUrl` the data layer returns, verbatim — it never constructs the URL
  itself, so Phase 2 changing the token/URL scheme needs no screen change.
- **`getPushCapability` is hardcoded** `{ supported: true, iosNeedsInstall: false }` for every
  subject (`lib/data/index.ts`'s own comment: "Real detection is client-side... Phase 2/WP4"). No
  patient in the seed ever carries `iosNeedsInstall: true` (only عبدالله's **caregiver** row is
  `unsupported`, exercised by F4, not this bundle's route). See the fixture note in §7 below for how
  this bundle demonstrated the iOS-install state anyway, without touching `lib/data/**`.

## §3 — What the real backend must enforce (already true in the mock; state it here so Phase 2 does not regress it)

- `updateSettings` must keep refusing `adherenceCheckInEnabled: true` unless the subject's
  `MessagingLink.status === 'connected'` — proven today by
  `lib/data/mock/settings.ts`'s `applySettingsPatch` (silently drops the key rather than throwing;
  G10 — a refusal is never shown as an error) and re-proven end to end by this bundle's own tests:
  `tests/unit/ambient/SettingsScreen.test.tsx` ("adherence toggle with no connected chat... writing
  nothing (call-log + store assertion)") calls the real `getSettings`/`updateSettings` seam against a
  freshly `reset()` store and asserts the row is byte-for-byte unchanged after the attempt, and
  `tests/e2e/ambient.spec.ts`'s "حمد — tracking off with no connected chat" test does the same
  through the browser (re-visits `/settings` after the click and re-reads `aria-checked="false"`).
- **The one-time messaging link token must be single-use and expire server-side.** The mock never
  enforces single-use or expiry itself (a `pending` row just sits there, e.g. فاطمة's `ml-05`,
  forever, until a `startMessagingLink` call replaces it) — Phase 2 must add both. Nothing in this
  bundle's UI ever reads or displays `MessagingLink.linkToken` (`tests/e2e/ambient.spec.ts`'s round
  trip asserts the token string never appears in `page.content()`/`innerHTML()` at any step,
  including immediately after the mock generates one).
- **`sendTestNotification` carries no `actions`.** `lib/data/index.ts`'s implementation is a no-op
  (`void s; void subject;` — "simulated — no payload is ever sent, nothing to record (G12)"); this
  bundle's own G12 test scans this screen's rendered markup for a literal `"actions":` key and
  fails if one ever appears. Phase 2's real push payload must keep this shape.

## §4 — Fields blank without a further decision (owner) — none new from this bundle

E1–E5 render fully from the published contract as it stands: no field this bundle needed is
missing. (`E5`'s "reminder" alert-type row and the six alert-type labels are UI-only vocabulary, not
contract fields — no data function returns a list of enabled alert types, so the row set is fixed in
`i18n/copy/ambient.ts` from G12's own six-item list, not derived from any `Settings` field.)

## §7 — Anything awkward

1. **The E3 control census, above all.** CR-011's "exactly" list is enforced two ways: a component
   test (`tests/unit/ambient/SettingsScreen.test.tsx`, "renders exactly three Toggle switches, one
   two-option frequency ChoiceGroup, one phone TextField — no `<select>`, no extra language
   control") and an e2e test scoped to `#main-content` (`tests/e2e/ambient.spec.ts`, "exactly the
   permitted controls"). Both assert `[role="switch"]` count === 3, `input[type="radio"]` count ===
   2, and `select` count === 0 — the last one is CR-011's own point (the `Settings` board's channel
   `Select` is omitted by design).

2. **`PushSubscription.permission: 'granted'` with `status: 'revoked'` is a fifth combination the
   contract's four `permission` values don't name on their own.** `disablePush` only flips `status`,
   never `permission` (`lib/data/index.ts`) — so after a patient disables notifications in this
   product, the browser's own permission grant is still `'granted'` underneath. This bundle folds
   that combination into the SAME "one enable action" branch `default` uses (never re-labelled as a
   fifth UI state), since re-enabling here needs no fresh browser prompt — recorded in
   `features/ambient/NotificationsScreen.tsx`'s own doc comment. Not a `docs/DECISIONS.md`-worthy
   change (no contract/seed value changed), just a rendering choice worth the owner's awareness.

3. **No seeded patient's CURRENT chat state ever resolves to `expired`.** فاطمة carries two
   `MessagingLink` rows (`ml-02`, `status: 'expired'`; `ml-05`, `status: 'pending'`, her retry) and
   `getMessagingLink` returns the most-recently-created row per subject — so her live, readable state
   is `pending`, not `expired` (matching `docs/Seed Dataset.md` line 163's own framing: "one `pending`
   row... belonging to فاطمة's retry"). The `expired` branch is real and correct
   (`features/ambient/NotificationsScreen.tsx`) but unreachable from any single patient's read-only
   state today; it is exercised with constructed props in
   `tests/unit/ambient/NotificationsScreen.test.tsx`, matching `tests/unit/safety/SafetyList.test.tsx`'s
   own precedent (CR-014) for an unreachable-from-one-patient combination.

4. **The iOS-install state (`getPushCapability().iosNeedsInstall`) has no seeded patient at all** —
   only عبدالله's caregiver row is `unsupported`, and `getPushCapability` itself is hardcoded
   `{ supported: true, iosNeedsInstall: false }` for every subject in the mock (§2 above). Nothing in
   the published API can produce this combination for a signed-in **patient** today. This bundle
   demonstrates it with a dev-only page-level render override — `?view=ios` on
   `/[locale]/app/more/notifications` — gated identically to the existing `?view=loading/error/offline`
   convention (`process.env.NODE_ENV === 'production' ? undefined : view`, exactly matching
   `app/[locale]/app/page.tsx`'s own pattern per this bundle's brief). It changes no `lib/**` file and
   is inert in production; see `app/[locale]/app/more/notifications/page.tsx`'s own doc comment. If
   the owner would rather this state be reachable through the seed/contract instead (e.g. a seeded
   patient whose `PushSubscription.permission` is `unsupported` with `iosNeedsInstall: true`), that is
   a one-row seed addition — flagging it here rather than inventing one myself.

5. **The chat round trip's `pending` render is not reliably observable in a live browser.** The
   mock confirms `pending → connected` only ~50ms after `startMessagingLink` (§2) — often faster than
   the click's own `router.refresh()` round trip, so `tests/e2e/ambient.spec.ts`'s one-shot round
   trip test accepts either the `pending` or `connected` render immediately after the click, then
   waits for the real settle. The `pending` render itself is fully covered, without any race, by
   فاطمة's own real `pending` state (item 3 above) and by
   `tests/unit/ambient/NotificationsScreen.test.tsx`'s manual `pending` rerender.

6. **E1's `webcal://` link is the one place a token-bearing URL is shown on screen** — the spec's own
   bounded exception to rule 7/G9 (`CopyField` renders `CalendarSubscription.icsUrl` exactly as the
   data layer returns it; the separate `CalendarSubscription.token` field is never independently
   printed anywhere).

7. **E3's calendar-sync Toggle, turning it OFF, only flips `Settings.calendarSyncEnabled` — it never
   deletes the `CalendarSubscription` row** (no `disableCalendarSync`/delete function is published).
   Turning it back ON calls `enableCalendarSync` again, which is idempotent (returns the existing
   subscription if one exists) rather than minting a second one. This means E1, visited directly,
   still shows the same webcal link regardless of E3's toggle state — a deliberate reading, since the
   external calendar app's own subscription is not something this product can revoke from its side;
   flagging it in case the owner intended calendar sync to be revocable end-to-end.

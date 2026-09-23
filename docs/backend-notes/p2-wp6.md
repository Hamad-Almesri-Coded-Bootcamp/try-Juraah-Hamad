# P2-WP6 — Channels: messaging link, web push, ICS feed, expiry job · notes

Written by the WP6 implementer (brief `docs/briefs/P2-WP6.md`), 2026-09-22. `JURAH_DATABASE_URL`,
`JURAH_BOT_TOKEN` and `JURAH_VAPID_PRIVATE_KEY` are still empty, so every database statement below
was proved by hand through the Supabase MCP connector (each mutating probe inside a `do` block
that ends in `raise exception`, so it rolled back and carried its evidence). The integration file
fails loudly, by design.

## 1. What exists now

| File | What it does |
|---|---|
| `lib/data/pg/channels.ts` | The seven seam functions (`requestPushPermission`, `disablePush`, `sendTestNotification`, `startMessagingLink`, `disconnectMessaging`, `sendTestMessage`, `enableCalendarSync`), the route helpers (`connectMessagingLinkByToken`, `calendarFeedForToken`, `attachPushEndpointForSession`, `revokePushEndpointForSession`, `runInvitationExpiryJob`, `activeCaregiverRecipients`), and `PG_QUERIES_CHANNELS`, the exact SQL text the hand proofs ran. |
| `lib/data/refusals/channels.ts` | `requestPushPermissionRefusal`, `startMessagingLinkRefusal`, `enableCalendarSyncRefusal`: the mock's inline literals, byte for byte. `mock-impl.ts` now imports them (three lines plus one import line). The names are prefixed by function because the `export *` barrels would otherwise collide with WP3d's `messagingLinkRefusal`. |
| `lib/data/shapes/channels.ts` | `toChannelPushSubscription`, `toChannelMessagingLink` (`linkToken` only while `pending`, `chatId` never), `toChannelCalendarSubscription`, `toFeedDose`. |
| `lib/calendar/ics.ts` | Builds RFC 5545 output. It is pure, and `dtstampIso` is passed in. |
| `lib/push/send.ts` | Holds the whitelist payload builder (`{title, body, url}` and nothing else) and sends through VAPID with `web-push@3.6.7` (pinned). |
| `lib/push/subscription.ts` | Validates a browser PushSubscription JSON. It lives outside the route file because a route file may export only HTTP methods. |
| `lib/messaging/telegram.ts` | Derives the webhook secret, parses `/start <token>`, and calls `sendMessage` through the Bot API. |
| `app/api/calendar/[token]/route.ts` | `GET` only. |
| `app/api/messaging/telegram/webhook/[secret]/route.ts` | `POST` only. |
| `app/api/push/subscription/route.ts` | `POST` and `DELETE`. |
| `app/api/jobs/expire-invitations/route.ts` | `POST`. It calls WP4b's `lib/engine/expiry.ts` `expireInvitations()`, which existed by the time the route was built. |
| `lib/config.ts` | Adds five server-only values: `BOT_TOKEN`, `VAPID_PRIVATE_KEY`, `AGENT_TOKEN`, `JOB_TOKEN` and `APP_ORIGIN` (`JURAH_APP_ORIGIN`, default `http://localhost:3000`). `BOT_IS_SIMULATED = !process.env.JURAH_BOT_TOKEN` and `PUSH_IS_SIMULATED = !process.env.JURAH_VAPID_PRIVATE_KEY`. The shape is otherwise unchanged. `.env.example` gains `JURAH_APP_ORIGIN=`. |
| `next.config.ts` | Sets `Allow: GET` on `/api/calendar/:token` (see §4). |
| Tests | `tests/unit/calendar/ics.test.ts` (9), `tests/unit/push/payload.test.ts` (6), `tests/unit/api/channel-routes.test.ts` (18), `tests/integration/enforcement/channels.test.ts` (E-06, E-07, E-08, E-38, E-43, E-44, E-45, E-46, E-47). |
| Dependencies | `web-push@3.6.7` (dependency), `@types/web-push@3.6.4` and `ical.js@2.2.1` (dev dependencies), all exact. |

## Divergences

| # | Function / place | Mock | Backend | Why | Could a screen notice? |
|---|---|---|---|---|---|
| W6-1 | `requestPushPermission` for a session that is not the subject's own | Returns `existing ?? literal`, so any caller gets another subject's `PushSubscription` row from the global store | Always returns the literal, because RLS lets a refused caller read no row | D-014 spirit: a refusal reads nothing | No. Screens call it only for their own subject |
| W6-2 | `enableCalendarSync` for a session that is not the patient's own | Returns `existing ?? {patientId, icsUrl:'', token:''}`, so any caller calling `enableCalendarSync('pt-03')` receives سارة's feed token | Always returns the empty literal | The feed token is the patient's only credential for the feed | No. E1 calls it for the session's own patient |
| W6-3 | `startMessagingLink` | Leaves older `pending` rows and their tokens alive | Moves the subject's older `pending` rows to `expired` with the token cleared, so one live token exists per subject | Otherwise an old token could connect a row the screen no longer shows (only the latest row wins) | No. `getMessagingLink` shows the latest row either way |
| W6-4 | `startMessagingLink` token and id | `mock-token-live-<n>`, `ml-live-<n>` | 32 random bytes as base64url (43 characters, within Telegram's `start` alphabet), and `ml_<ULID>` | BACKEND-NOTES §2, CR-048 | The round trip differs in `id` and `linkToken`. CR-041's opaque rule extends to the token, as D-15 did for the calendar token |
| W6-5 | `disablePush`, `DELETE /api/push/subscription` | Flips `status` only | Also nulls `endpoint`, `p256dh`, `auth` and stamps `endpoint_updated_at`. The row is kept, because `getPushState` reads its permission | API-SURFACE: "the endpoint is deleted server-side" | No |
| W6-6 | `disconnectMessaging` | Clears `chatId` and `linkToken` | Clears `chat_id`, `link_token` **and** `token_expires_at` | There is no live token to time out | No |
| W6-7 | `messaging_connected` for a caregiver subject (webhook) | The mock body writes scope `system` with no `patientId`. The **seed's** ml-04 row is scope `patient` with `pt-01` | Follows the mock body | The brief says "as the mock does". The seed and the body disagree (see CR-D) | Yes, E2: a caregiver's connection does not appear in the patient's activity log, exactly as in the mock at runtime |
| W6-8 | `sendTestNotification`, `sendTestMessage` | No-ops | Real sends when configured (a VAPID key and an https `APP_ORIGIN`; a bot token), to the subject's own live target only. The target (endpoint or chat id) is read **by id under `withAgent`** after `withSession` has proved that row is the caller's own and live. `jurah_app` has no column grant on either value | 0005's column grants (rule 7). See CR-B | No |
| W6-9 | Webhook while no bot token is set | n/a | 404 with an empty body on **every** path | With an empty token the path secret would be `sha256('')`, a public constant | No |
| W6-10 | ICS feed | n/a (the mock had no feed) | Tracked doses carry `X-JURAH-DOSE-STATUS`, a machine property clients do not display. Untracked doses carry nothing (rule 3, keyed off `tracked`). There is no `DURATION`/`DTEND`, so no duration is invented. The `ETag` is a sha256 of the exact bytes, **not** API-SURFACE's "max `seq`", because a status write does not change `seq` and would leave the ETag stale | Correctness of 304 | No screen reads the feed |
| W6-11 | The four routes under `JURAH_DATA_BACKEND=mock` | n/a | The ICS feed, push subscription and job answer 503. The webhook acknowledges with the neutral 200 and writes nothing | The mock has no feed, subscription or job store, and never fabricates one | No. No screen calls a route |
| W6-12 | `POST /api/push/subscription` with no live row (`requestPushPermission` never ran, or the row is revoked) | n/a | 422 `{"error":"no_live_subscription"}` | API-SURFACE lists only 401/403/422, and the brief says use exactly those | No |
| W6-13 | `/api/calendar/:token` headers | n/a | `Allow: GET` on every response, including OPTIONS, which Next would otherwise answer `GET, HEAD, OPTIONS` | Next's automatic 405 carries **no** Allow header | No |
| W6-14 | Expiry job at `nowIso = 2026-10-03T00:00+03:00` | n/a | Flips **cg-03 only**. cg-08 expires `2026-10-04T09:30+03:00` and stays `pending` | Seed value. The WP4b brief's "cg-03 and cg-08 flip" at 2026-10-03 is wrong | No |

## Change requests

- **CR-A (lead, blocks `npm run verify`).** Guard 8 rule (c) has no allowlist entry for
  `lib/engine/**`. WP4b's 12 `sql.unsafe(` calls there fail the guard, and guard 4 had failed on
  WP4b's own negative fixture `tests/unit/engine/boundaries.test.ts:29`, which was green at the
  last run. No violation names a WP6 file.
- **CR-B (migration; needs an owner of `0009+`).** Add two `SECURITY DEFINER` functions,
  `own_push_target()` and `own_chat_target()`, returning the session subject's own live
  endpoint or chat id. Then `sendTest*` would not need `jurah_agent` for the target read (W6-8).
- **CR-C (frontend, later).** D-13 still applies: the frozen frontend never calls
  `POST /api/push/subscription`, so no real browser endpoint is ever attached and no real push
  arrives. The route is complete and tested.
- **CR-D (owner).** The seed's ml-04 `messaging_connected` row (scope `patient`, `pt-01`, actor
  cg-01) disagrees with the mock body's runtime shape (scope `system`, no patient). Pick one.
- **CR-E (copy deck).** No catalogue entry exists for a test notification or test message, and
  `i18n/**` is frozen, so both reuse existing entries. The push uses `shell.appName` +
  `ambient.e5GrantedNoticeBody`. The chat uses `shell.appName · ambient.e5ChatSectionTitle`. The
  webhook sends no chat reply at all, because there is no copy for one and a reply would reveal
  whether a token was valid.
- **CR-F (owner; a shape change).** `lib/config.ts` is imported by client components, so the
  client bundle contains the **names** `process.env.JURAH_BOT_TOKEN` and
  `JURAH_VAPID_PRIVATE_KEY`, which read as `undefined` in a browser. Next inlines only
  `NEXT_PUBLIC_*`, so no value can ship, and guard 9 scanned `.next/static/**` and passed. A
  `lib/config.server.ts` split would remove even the names.
- **For WP7.** E-07's HTTP half (`/api/agent/alert-recipients`) and E-06's `/api/agent/alerts`
  template are WP7's. Call `activeCaregiverRecipients()` and route every payload through
  `lib/push/send.ts`'s `sendPush` (the whitelist).

## Found out the hard way

- `link_caregiver_must_be_active` is a SECURITY INVOKER trigger. It reads `caregivers` under the
  **caller's** RLS, whose caregiver branch compares `civil_id` with the session's `civilId`. A
  forged caregiver session without `civilId` is therefore refused even for an active row. A
  caregiver starting a link for *another* caregiver's subject hits this trigger (P0001) before
  RLS's WITH CHECK (42501). Both are mapped to the `ml-default` refusal.
- The `system` actor cannot INSERT into `messaging_links`, because the insert policy is
  subject-self only. The webhook only ever UPDATEs, which the policy admits.
- `md5(string_agg(m::text …))` over `messaging_links` fails as `jurah_app` (no column grant on
  `chat_id`). Digests must run as the owner.
- Next's automatic 405 for an unexported method has no `Allow` header (RFC 9110 requires one).
- The shared `next dev` on :3100 (another package's) served 500s after a concurrent write left
  `.next/dev/prerender-manifest.json` with a trailing fragment. I repaired it by truncating the
  file to its valid JSON prefix, and it was intermittently re-corrupted while several packages
  compiled. A second `next dev` in the same directory is refused ("Another next dev server is
  already running").
- WP2's signed cookie is live on that server: an unsigned mock cookie is now **no session**, so
  `POST /api/push/subscription` answers 401 to it. The 403 and 422 paths are proved in the unit
  route tests.
- Route files may export only HTTP methods. The body validator moved to `lib/push/subscription.ts`.
- Guard 4 bans the literal `actions:` in tests too. The poisoned payloads are built with `JSON.parse`.
- Guard P counts every `[TO BE SUPPLIED]`, comments included, so none appears in WP6's comments.

## Owed

- **The real calendar client.** The feed was **not** opened in macOS Calendar. `next dev` runs on
  the mock backend (no `JURAH_DATABASE_URL`), so the feed answers 503 and a `webcal://`
  subscription has nothing to fetch. Importing the seed-built `.ics` file instead would add 360
  events to the owner's personal calendar, which is not mine to do. Once the URL lands:
  `open "webcal://localhost:3000/api/calendar/mock-token-cal-pt-03.ics"`.
- `npm run test:integration -- tests/integration/enforcement/channels.test.ts` against the database.
- A real bot end to end (`/start <token>` from Telegram) once `JURAH_BOT_TOKEN` exists. Guard 9's
  value check for `JURAH_BOT_TOKEN`/`JURAH_VAPID_PRIVATE_KEY` has no input until they are set.
- A real push delivery (needs CR-C and a VAPID keypair).

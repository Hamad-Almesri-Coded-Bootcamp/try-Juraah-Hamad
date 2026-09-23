# P2-WP6 — Channels: messaging link, web push, ICS feed · task brief

Read `docs/briefs/P2-common.md` first. One subagent (Opus). Depends on Gate 1 (and WP2's cookie for the push route). Owns the nine notification seam functions' **write** half and three route handler families. G10 and G12 are yours to prove.

## FUNCTIONS AND ROUTES YOU IMPLEMENT

Seam (`lib/data/pg/channels.ts`, `lib/data/refusals/channels.ts`, `lib/data/shapes/channels.ts` — your three seam files): `requestPushPermission` · `disablePush` · `sendTestNotification` · `startMessagingLink` · `disconnectMessaging` · `sendTestMessage` · `enableCalendarSync` — per `docs/API-SURFACE.md` §A "Notifications" and "Calendar". Reads (`getPushState`, `getMessagingLink`, `getCalendarSubscription`, `getPushCapability`) are WP3's.

Routes (`app/api/messaging/telegram/webhook/[secret]/route.ts`, `app/api/calendar/[token]/route.ts` serving `<token>.ics`, `app/api/push/subscription/route.ts`, `app/api/jobs/expire-invitations/route.ts`) — per `docs/API-SURFACE.md` §B, with the exact refusal statuses listed there. Read `node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/route.md` before writing a handler. Only export the methods the table allows; the ICS route exports `GET` only (Next answers 405 for the rest — prove it).

Libraries: `lib/push/send.ts` (new; VAPID via the `web-push` package or a minimal RFC 8291/8292 implementation — pick `web-push`, pin it; the payload builder **strips `actions` and any `data.actions`** and a unit test proves it); `lib/messaging/telegram.ts` (new; `sendMessage` through the Bot API with `JURAH_BOT_TOKEN` from `lib/config.ts` — **add `BOT_TOKEN`, `VAPID_PRIVATE_KEY`, `AGENT_TOKEN`, `JOB_TOKEN`, `APP_ORIGIN` to `lib/config.ts` as server-only values read from `process.env`, never `NEXT_PUBLIC_`; the module's shape otherwise unchanged; `BOT_IS_SIMULATED` becomes `!process.env.JURAH_BOT_TOKEN` and `PUSH_IS_SIMULATED` becomes `!process.env.JURAH_VAPID_PRIVATE_KEY` so the flags finally mean something — BACKEND-NOTES §2**); `lib/calendar/ics.ts` (new; RFC 5545 output: `VCALENDAR`/`VEVENT` per dose with `UID` = dose id, `DTSTART` in `Asia/Kuwait`, `SUMMARY` = drug name + dose, no status word for an untracked dose (rule 3), `PRODID`, `METHOD:PUBLISH`, CRLF line endings, 75-octet folding).

Tests: `tests/unit/push/payload.test.ts`, `tests/unit/calendar/ics.test.ts` (validate with a strict parser — `ical.js` dev dependency is acceptable — plus the exact rule-3 assertion), `tests/integration/enforcement/channels.test.ts` (**E-06, E-07, E-08, E-38, E-43, E-44, E-45, E-46, E-47**), route tests with `next`'s request/response objects, `docs/backend-notes/p2-wp6.md`.

## SPECIFICS THAT MATTER

- `startMessagingLink`: refuse (mock's `ml-default` shape) unless `S.self`; a caregiver subject must be `active` (`link_caregiver_must_be_active` raises — map it); token = 32 random bytes base64url, `token_expires_at = jurah_now() + 15 min`, row `pending`. **No auto-connect** — divergence D-12 already records that E5 will show `pending` until a real bot confirms. When `BOT_IS_SIMULATED`, still mint the row; nothing is sent.
- Webhook: path secret = `sha256(JURAH_BOT_TOKEN)` hex prefix; wrong secret → 404 with an empty body; a valid update whose text is `/start <token>` → `withSystem`: find `pending` row by token, unexpired; set `connected`, `chat_id`, `connected_at`, clear `link_token`; `append('messaging_connected')` with the mock's message and actor (`patient`/`caregiver` **as the mock does** — check §5); anything else → 200 with a neutral reply body and **no write**. A caregiver row whose caregiver is no longer `active` → no write.
- `disconnectMessaging`: exactly the mock's statement list, including `tracking_disabled` with actor `system` when the flag flips; **no `doses` statement** (E-47 diffs the table).
- `requestPushPermission`/`disablePush`: the row flip as the mock, `push_enabled`/`push_disabled` for a patient subject only; `DELETE /api/push/subscription` also nulls the endpoint columns.
- `sendTestNotification`: only when `PUSH_IS_SIMULATED` is false and an endpoint exists; payload `{title, body, url}`; the safety-critical content is the screen the URL opens, never the payload (put the rule in a comment and a test).
- `enableCalendarSync`: idempotent; seed keeps سارة's token; `ics_url = webcal://<APP_ORIGIN host>/api/calendar/<token>.ics`; sets `settings.calendar_sync_enabled`. Divergence D-15 is already recorded.
- Expiry job: `withSystem`; selects with `invitationsToExpire` from `lib/schedule/expiry.ts` (WP4) or the equivalent SQL, one `caregiver_invite_expired` row per flip (mock message: `انتهت صلاحية دعوة مقدّم رعاية`), a `job_runs` row; **touches no `doses` row** (E-03 diffs the table).

## ACCEPTANCE — Gate 6

Paste: unit tests · integration/enforcement rows by id (or MCP hand proofs) · the ICS feed fetched with `curl` and validated, **and opened in a real calendar client** (macOS Calendar via `open webcal://…` against `next dev` — describe what you saw; if you cannot, say so, it stays owed) · `curl -X PUT` on the feed → 405 with `Allow: GET` · a webhook `/start` with a used token → no write (row counts) · secret-scan guard green · `npm run verify` exit 0 in mock · frozen-set diff empty.

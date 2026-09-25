/**
 * Rule 7 (no technical identifier reaches a screen) — the stronger token scan for AP-16 row 4, over
 * the pages that POST /api/messaging/telegram/open renders: E5, A2's Telegram offer (step 2) and F4.
 * No Playwright import, so a plain vitest unit test can load it as well as the e2e specs.
 *
 * The scan the specs carried before this only matched mock-format tokens (`mock-token-…`), which
 * would miss a real 43-character token sitting in the RSC payload once the backend is Postgres in
 * production. This one also flags the serialised field names `linkToken` and `chatId` as whole
 * words: a MessagingLink carries both only on the server, and `linkForScreen`
 * (lib/messaging/link.ts) drops them before a view reaches a client component — so either name
 * appearing in a document means a raw link (or its chat id) reached the page, whatever the token's
 * own shape is.
 *
 * If this ever goes red on a real page, that is a rule-7 finding to report, never a reason to narrow
 * the pattern.
 *
 * Runtime proof: J1 (AP-14) — Mohammad links Telegram from E5 on production; the lead reads the 303
 * in the browser's network panel and scans the E5 page source for these same patterns.
 */

const MOCK_TOKEN = /mock-token-[\w-]*/g;
const START_LINK = /(?:https?:\/\/)?t\.me\/[A-Za-z0-9_]+\?start=\S*|tg:\/\/[^\s"'<>]*start=[^\s"'<>]*/gi;
const FIELD_LINK_TOKEN = /\blinkToken\b/g;
const FIELD_CHAT_ID = /\bchatId\b/g;

/**
 * Every hit of a link token, a Telegram start link, or the raw field names `linkToken` / `chatId`,
 * each named so a failing assertion says exactly what leaked. An empty array is the only pass.
 */
export function linkTokenLeaks(html: string): string[] {
  const hits: string[] = [];
  for (const m of html.matchAll(MOCK_TOKEN)) hits.push(`mock token: ${m[0]}`);
  for (const m of html.matchAll(START_LINK)) hits.push(`telegram start link: ${m[0]}`);
  hits.push(...Array.from(html.matchAll(FIELD_LINK_TOKEN), () => 'field "linkToken"'));
  hits.push(...Array.from(html.matchAll(FIELD_CHAT_ID), () => 'field "chatId"'));
  return hits;
}

// @vitest-environment node
/**
 * AP-16 row 4 — the stronger token scan (tests/e2e/helpers/link-token.ts). Green on a clean,
 * RSC-shaped copy of what linkForScreen (lib/messaging/link.ts) actually serialises, on the
 * @jurah_bot placeholder, and on a bare, start-less t.me link. Red on each of four broken copies
 * made from the clean one by exactly ONE change: a mock token, a real-shaped token behind an
 * escaped "linkToken" key with no mock marker, a t.me start link, and an escaped "chatId" key.
 * Never weaken the pattern to make a real page pass — a page that goes red here is a rule-7
 * finding, reported as one.
 */
import { describe, expect, it } from 'vitest';
import { linkTokenLeaks } from '../../e2e/helpers/link-token';

// 43 characters, base64url — the shape a real link token actually has, and deliberately not
// starting with "eyJ" (guard 9 also scans this file, and a JWT-shaped triple is a different rule).
const REAL_SHAPED_TOKEN = 'b1U6pd2PLPkC-RzTwkes5B_C7_k37CQS-XrfkoBsLr4';

/** Exactly the fields linkForScreen keeps (lib/messaging/link.ts): id, subjectType, subjectId,
 * channel, status, and connectedAt when present. Never linkToken, never chatId. */
const BASE_VIEW = {
  id: 'ml-05',
  subjectType: 'patient',
  subjectId: 'pt-03',
  channel: 'telegram',
  status: 'connected',
  connectedAt: '2026-09-20T10:00:00+03:00',
} as const;

/** An RSC-shaped page: the view JSON pushed as an escaped string literal (self.__next_f.push), plus
 * the bot placeholder and a bare t.me link — exactly as E5's real page carries them today. */
function pageWith(view: Record<string, unknown>, extraHtml = ''): string {
  const inner = JSON.stringify(view);
  return (
    `<script>self.__next_f.push([1,${JSON.stringify(inner)}])</script>` +
    `<div class="jr-menu-row">Telegram chat · @jurah_bot</div>` +
    `<a href="https://t.me/jurah_bot">Open Telegram</a>${extraHtml}`
  );
}

const CLEAN = pageWith(BASE_VIEW);

describe('linkTokenLeaks — green', () => {
  it('a clean linkForScreen-shaped payload, the @jurah_bot placeholder, and a bare start-less t.me link', () => {
    expect(linkTokenLeaks(CLEAN)).toEqual([]);
  });
});

describe('linkTokenLeaks — red, each one change from the clean copy', () => {
  it('a mock-format token put back', () => {
    const broken = pageWith(BASE_VIEW, ' mock-token-ml-05');
    expect(linkTokenLeaks(broken)).toEqual(['mock token: mock-token-ml-05']);
  });

  it('a real-shaped 43-character token behind an escaped "linkToken" key, no mock marker', () => {
    const broken = pageWith({ ...BASE_VIEW, linkToken: REAL_SHAPED_TOKEN });
    expect(linkTokenLeaks(broken)).toEqual(['field "linkToken"']);
  });

  it('a t.me/…?start= link', () => {
    const broken = pageWith(BASE_VIEW, ' https://t.me/jurah_bot?start=abc123');
    expect(linkTokenLeaks(broken)).toEqual(['telegram start link: https://t.me/jurah_bot?start=abc123']);
  });

  it('an escaped "chatId" key', () => {
    const broken = pageWith({ ...BASE_VIEW, chatId: '558812345' });
    expect(linkTokenLeaks(broken)).toEqual(['field "chatId"']);
  });
});

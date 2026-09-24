/**
 * Runtime proof for CR-071 (owner, 2026-09-24): each locale shows only its own language, and no em
 * dash reaches a screen. `tests/unit/i18n/localize.test.ts` proves the localisation tables cover the
 * seed; this observes the rendered screens, where a string can still slip past the tables (a label
 * built in a component, a separator, a data field someone forgot to localise).
 *
 * Every route of the inventory, in both locales, at the phone width (the widest set of visible text
 * is the same at every width). Read-only: pages are opened, never submitted.
 *
 * Allowed on purpose, and nothing else:
 * - the language switch, which names the other language in its own script (العربية / English);
 * - the owner's loud placeholder `[TO BE SUPPLIED]` (owed values are never filled with a plausible fake);
 * - a handle a person must type exactly (`@jurah_bot`) and the programme's acronym on the landing footer.
 */
import { test, expect, type BrowserContext } from '@playwright/test';
import { pendingInvitationCookieFor, sessionCookieFor, TEST_SESSIONS } from './helpers/session';

type Who = 'none' | 'pending' | keyof typeof TEST_SESSIONS;

const ROUTES: [string, Who][] = [
  ['', 'none'],
  ['/signin', 'none'],
  ['/clinic', 'none'],
  ['/this-does-not-exist', 'none'],
  ['/invitation', 'pending'],
  ['/app', 'hamad'],
  ['/app', 'sara_patient'],
  ['/app', 'fatima'],
  ['/app?day=2026-09-26', 'hamad'],
  ['/app/medicines', 'hamad'],
  ['/app/medicines', 'fatima'],
  ['/app/medicines/rx-001', 'hamad'],
  ['/app/medicines/rx-004', 'hamad'],
  ['/app/medicines/rx-006', 'fatima'],
  ['/app/medicines/add', 'hamad'],
  ['/app/safety', 'hamad'],
  ['/app/safety/ia-001', 'hamad'],
  ['/app/safety/ia-002', 'sara_patient'],
  ['/app/safety/check', 'hamad'],
  ['/app/more', 'hamad'],
  ['/app/more/profile', 'hamad'],
  ['/app/more/refill', 'hamad'],
  ['/app/more/calendar', 'hamad'],
  ['/app/more/activity', 'hamad'],
  ['/app/more/settings', 'hamad'],
  ['/app/more/help', 'hamad'],
  ['/app/more/notifications', 'hamad'],
  ['/app/more/caregivers', 'hamad'],
  ['/care', 'abdullah'],
  ['/care/medicines', 'abdullah'],
  ['/care/medicines/rx-001', 'abdullah'],
  ['/care/alerts/ia-001', 'abdullah'],
  ['/care/more', 'abdullah'],
  ['/care/more/activity', 'abdullah'],
  ['/care/more/profile', 'abdullah'],
  ['/care/more/help', 'abdullah'],
  ['/clinic/review', 'khalid_reviewer'],
  ['/clinic/review/ia-001', 'khalid_reviewer'],
  ['/clinic/review/fields', 'khalid_reviewer'],
  ['/clinic/review/fields/rx-006', 'khalid_reviewer'],
  ['/clinic/audit', 'dana'],
];

const ARABIC = /[؀-ۿ]/;
const LATIN = /[A-Za-z]/;
const EM_DASH = /[—–]/;
const ALLOWED_LATIN_IN_AR = [/\bEnglish\b/g, /\[TO BE SUPPLIED\]/g, /@jurah_bot/g, /\bSACGC AI for Coding\b/g, /\bSACGC\b/g];
const ALLOWED_ARABIC_IN_EN = [/العربية/g];

async function signIn(context: BrowserContext, baseURL: string | undefined, who: Who) {
  const base = new URL(baseURL ?? 'http://localhost:3100');
  if (who === 'pending') await context.addCookies([pendingInvitationCookieFor('cg-03', base)]);
  else if (who !== 'none') await context.addCookies([sessionCookieFor(who, base)]);
}

/** Every visible text node on the page, one string per node, skipping hidden and screen-reader-only text. */
async function visibleTexts(page: import('@playwright/test').Page): Promise<string[]> {
  return page.evaluate(() => {
    const out: string[] = [];
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    let node: Node | null;
    while ((node = walker.nextNode())) {
      const text = (node.textContent ?? '').replace(/\s+/g, ' ').trim();
      if (!text) continue;
      const el = node.parentElement;
      if (!el || el.closest('script, style, noscript, [aria-hidden="true"], .wsf-sr, .sr-only, nextjs-portal')) continue;
      const cs = getComputedStyle(el);
      if (cs.display === 'none' || cs.visibility === 'hidden') continue;
      const r = el.getBoundingClientRect();
      if (r.width === 0 && r.height === 0) continue;
      out.push(text);
    }
    return out;
  });
}

function strip(text: string, allowed: RegExp[]): string {
  return allowed.reduce((t, re) => t.replace(re, ''), text);
}

test.describe('CR-071: one language per locale, no em dash', () => {
  test.skip(({ viewport }) => (viewport?.width ?? 0) > 400, 'text is the same at every width; checked once at 390');

  for (const [path, who] of ROUTES) {
    test(`${who} ${path || '/'}`, async ({ page, context, baseURL }) => {
      await signIn(context, baseURL, who);
      for (const locale of ['ar', 'en'] as const) {
        await page.goto(`/${locale}${path}`, { waitUntil: 'networkidle' });
        const texts = await visibleTexts(page);
        expect(texts.length, `${locale} ${path}: the page rendered text`).toBeGreaterThan(0);
        const wrongScript = texts.filter((t) =>
          locale === 'ar' ? LATIN.test(strip(t, ALLOWED_LATIN_IN_AR)) : ARABIC.test(strip(t, ALLOWED_ARABIC_IN_EN)),
        );
        expect(wrongScript, `${locale} ${path}: text in the other script`).toEqual([]);
        const dashes = texts.filter((t) => EM_DASH.test(t));
        expect(dashes, `${locale} ${path}: em or en dashes`).toEqual([]);
      }
    });
  }
});

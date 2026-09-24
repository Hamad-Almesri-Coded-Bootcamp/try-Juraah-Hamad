'use client';

/**
 * CR-067 — the web-app assistant, on EVERY page (mounted once in app/[locale]/layout.tsx): a
 * launcher button and a `Sheet` (bottom sheet below 834px, centred modal above) holding the
 * conversation. The Sheet brings its own fixed full-viewport layer (portalled to <body>), so it
 * sits above the TabBar the same on the landing page as inside a shell (audit C2).
 *
 * What a person may be told is decided on the SERVER (`askAssistant`, `voiceTurns`, both under the
 * verified session): a signed-in patient
 * gets personal answers from the agents track; everyone else gets app help from the copy catalogue.
 *
 * READ-ONLY by construction (CLAUDE.md rule 1): the only calls are two server actions that write
 * nothing. "I took it" / "I forgot" are answered by sending that dose's buttons to the patient's own
 * Telegram chat — the tap there records it. No design-system component draws a chat, so the
 * conversation is plain text rows in the design system's own surfaces; the launcher uses the
 * existing `inbox` glyph (no chat glyph among the 26). Every string is from i18n/copy/assistant.ts.
 *
 * An answer about a screen OPENS that screen behind the conversation (the server picks it from the
 * agent's intent: lib/assistant/core.ts pageForIntent), then asks "is this what you were looking
 * for?" — No offers the other topics. When the agent is not sure ('unclear'), the panel moves
 * nowhere and asks back with the same tappable topics instead of guessing. Every chip only SENDS a
 * question; none records anything.
 *
 * CR-069, amended by CR-102 — the screen follows the voice. For a signed-in patient the launcher
 * polls `voiceTurns` every few seconds, also in a background tab; each turn the patient has with
 * Alexa moves the page to the screen it is about, and does nothing else: it never opens, closes or
 * writes into the panel, and shows no popup in its place. A panel the patient opened stays exactly
 * as it was, with the new page behind it. A turn with no screen (Alexa did not understand, or the
 * conversation ended) moves nothing.
 */
import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { Sheet } from '@/components/ui/Sheet';
import { AsWritten } from '@/components/ui/AsWritten';
import { Button } from '@/components/ui/Button';
import { TextField } from '@/components/ui/TextField';
import { askAssistant, voiceTurns } from '@/lib/assistant';
import { PAGE_PATH, type AssistantAudience, type AssistantPage, type VoiceTurn } from '@/lib/assistant/core';
import { copy, t } from '@/i18n';
import { localizeText } from '@/i18n/localize';
import { directionFor } from '@/i18n/locale';
import { ASSISTANT_OPEN_EVENT } from './AssistantButton';
import type { Locale } from '@/i18n/locale';

type CopyKey = keyof typeof copy.assistant;
/**
 * `ask`: the chips under this line — only the LAST line's are live. `lang`: the language an agent's
 * reply is in (CR-071): Alexa answers in the Echo's language, which need not be the page's, so a
 * reply in the other language is declared (`lang` + `dir`), never shown unmarked.
 */
type Line = { from: 'you' | 'assistant'; text: string; note?: string; ask?: 'confirm' | 'clarify'; lang?: Locale };

const SUGGESTIONS: Record<AssistantAudience, readonly (keyof typeof copy.assistant)[]> = {
  patient: ['suggestNext', 'suggestAmount', 'suggestToday', 'suggestSafety'],
  guest: ['guestSuggestWhat', 'guestSuggestSignIn', 'guestSuggestTelegram'],
};

/** The topics offered when the panel asks back (unsure, or "No, not this"). */
const CLARIFY: Record<AssistantAudience, readonly CopyKey[]> = {
  patient: ['suggestNext', 'suggestToday', 'suggestSafety', 'suggestTelegram', 'suggestRefill'],
  guest: ['guestSuggestWhat', 'guestSuggestSignIn', 'guestSuggestTelegram'],
};

const VOICE_POLL_MS = 2500;

const MOVED: Record<AssistantPage, CopyKey> = {
  today: 'movedToday', activity: 'movedActivity', safety: 'movedSafety', notifications: 'movedNotifications',
  refill: 'movedRefill', help: 'movedHelp', signin: 'movedSignin',
};

export function AssistantLauncher({ locale }: { locale: Locale }) {
  const [open, setOpen] = useState(false);
  const [lines, setLines] = useState<Line[]>([]);
  const [draft, setDraft] = useState('');
  // Explicit, not a transition: it must stay true for the whole round trip (typing bubble, Send spinner).
  const [pending, setPending] = useState(false);
  const endRef = useRef<HTMLLIElement>(null);
  const router = useRouter();
  const pathname = usePathname();
  const c = copy.assistant;
  // STABLE on purpose: Sheet re-runs its focus trap whenever onClose changes identity, and it moves
  // focus to its first control (the close button). A new arrow per render sent every keystroke there.
  const close = useCallback(() => setOpen(false), []);

  // The app bar's assistant pill opens this same panel (AssistantButton).
  useEffect(() => {
    const openPanel = () => setOpen(true);
    window.addEventListener(ASSISTANT_OPEN_EVENT, openPanel);
    return () => window.removeEventListener(ASSISTANT_OPEN_EVENT, openPanel);
  }, []);

  // Who the panel talks to, from the shell on screen: only a signed-in patient can render the patient
  // shell (/[locale]/app, gated by its layout), so there it is the patient; anywhere else a guest.
  // No Server Action on page load: Next runs a page's Server Actions one at a time, and a background
  // one held up the page's own (sign-in, F0's open) until it answered (CR-071). This only picks the
  // intro and suggestions; what may be said is still decided on the server, under the session.
  // The launcher lives in the root layout, which a sign-in, sign-out or role switch does not remount:
  // when the audience changes, the conversation so far belonged to someone else, so it is cleared.
  const audience: AssistantAudience = pathname.split('/')[2] === 'app' ? 'patient' : 'guest';
  const [shownFor, setShownFor] = useState(audience);
  if (shownFor !== audience) {
    setShownFor(audience);
    setLines([]);
    setDraft('');
    setOpen(false);
  }

  // A page marked `data-no-assistant` (first-run setup, the invitation, the clinic) shows no assistant:
  // arriving on one closes the panel, and the voice below does not reopen it there.
  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      if (document.querySelector('[data-no-assistant]')) setOpen(false);
    });
    return () => cancelAnimationFrame(frame);
  }, [pathname]);

  // CR-069 / CR-102: follow the patient's Alexa turns by moving the page. The first answer is only the
  // starting point.
  const pathRef = useRef(pathname);
  useEffect(() => { pathRef.current = pathname; }, [pathname]);
  const lastSeq = useRef<number | null>(null);
  useEffect(() => {
    if (audience !== 'patient') return;
    lastSeq.current = null; // a new patient session starts from its own latest turn, never replays one
    let live = true;
    let timer: ReturnType<typeof setTimeout> | undefined;
    // CR-102: the page move only. Nothing here touches the panel (open, lines, chips): a closed panel
    // stays closed, an open one keeps what it shows. The move is the router's own navigation, so the
    // new page's focus and screen-reader announcement are exactly what any page change gets.
    const follow = (turns: VoiceTurn[]) => {
      // The turns are already counted (lastSeq moved on), so they are dropped here, not replayed later.
      if (document.querySelector('[data-no-assistant]')) return;
      let page: AssistantPage | null = null;
      for (const turn of turns) page = turn.page ?? page;
      const target = page ? `/${locale}${PAGE_PATH[page]}` : null;
      if (target && pathRef.current !== target) router.push(target);
    };
    // Also in a background tab (the browser slows its timers there): the page has already moved
    // when the patient looks at it — they talk to the Echo, not to this window.
    // Right after the patient taps or types, the next poll is skipped: their own action (a form, a
    // button's Server Action) then never waits behind one. A flag, not a clock (rule 9).
    let touched = false;
    const onInput = () => { touched = true; };
    document.addEventListener('pointerdown', onInput, true);
    document.addEventListener('keydown', onInput, true);
    const tick = async () => {
      if (touched) {
        touched = false;
      } else {
        const r = await voiceTurns(lastSeq.current).catch(() => null);
        if (!live) return;
        // Nothing can arrive here (the mock backend, or no longer a patient): stop asking.
        if (r && !r.live) return;
        if (r) {
          const first = lastSeq.current === null;
          lastSeq.current = r.latest;
          if (!first && r.turns.length > 0) follow(r.turns);
        }
      }
      if (live) timer = setTimeout(() => void tick(), VOICE_POLL_MS);
    };
    void tick();
    return () => {
      live = false;
      if (timer) clearTimeout(timer);
      document.removeEventListener('pointerdown', onInput, true);
      document.removeEventListener('keydown', onInput, true);
    };
  }, [audience, locale, router]);

  const scrollToEnd = () => requestAnimationFrame(() => endRef.current?.scrollIntoView?.({ block: 'end' }));

  function send(text: string) {
    const message = text.trim();
    if (!message || pending) return;
    setDraft('');
    setLines((prev) => [...prev, { from: 'you', text: message }]);
    scrollToEnd();
    setPending(true);
    void (async () => {
      try {
        const r = await askAssistant(message, locale).catch(() => ({ ok: false as const, reason: 'unavailable' as const }));
        const next: Line[] = [];
        if (!r.ok) next.push({ from: 'assistant', text: t(r.reason === 'invalid' ? c.invalid : c.unavailable, locale) });
        else if ('guestTopic' in r) next.push({ from: 'assistant', text: t(c[r.guestTopic], locale) });
        // Not sure: ask back with choices, move nowhere.
        else if (r.intent === 'unclear') next.push({ from: 'assistant', text: t(c.clarifyAsk, locale), ask: 'clarify' });
        else next.push({ from: 'assistant', text: localizeText(r.reply, locale), lang: locale, ...(r.telegramPrompted ? { note: t(c.telegramPrompted, locale) } : {}) });
        const page = r.ok ? r.page : null;
        const target = page ? `/${locale}${PAGE_PATH[page]}` : null;
        if (page && target && pathname !== target) {
          router.push(target);
          next.push({ from: 'assistant', text: t(c[MOVED[page]], locale), ask: 'confirm' });
        }
        setLines((prev) => [...prev, ...next]);
      } finally {
        setPending(false);
        scrollToEnd();
      }
    })();
  }

  /** Yes / No under "is this what you were looking for?" — answered here, nothing is sent. */
  function answerConfirm(yes: boolean) {
    setLines((prev) => [
      ...prev,
      { from: 'you', text: t(yes ? c.confirmYes : c.confirmNo, locale) },
      yes ? { from: 'assistant', text: t(c.confirmThanks, locale) } : { from: 'assistant', text: t(c.confirmOther, locale), ask: 'clarify' },
    ]);
    scrollToEnd();
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    send(draft);
  }

  const who = audience;
  const lastAsk = !pending ? lines[lines.length - 1]?.ask : undefined;

  return (
    <>
      <div className="fixed bottom-launcher end-4 z-10 tablet:bottom-6" data-testid="assistant-launcher">
        {/* secondary, never primary: every screen already has its own one primary action (UX §2) */}
        <Button variant="secondary" icon="inbox" onClick={() => setOpen(true)} lang={locale} aria-haspopup="dialog">
          {t(c.launcherLabel, locale)}
        </Button>
      </div>
      {open && (
          <Sheet
            open={open}
            onClose={close}
            closeLabel={t(c.closeLabel, locale)}
            title={t(c.title, locale)}
            footer={
              <form onSubmit={onSubmit} className="flex w-full items-end gap-2" data-testid="assistant-form">
                <TextField
                  className="flex-1"
                  label={t(c.inputLabel, locale)}
                  placeholder={t(c.inputPlaceholder, locale)}
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  lang={locale}
                  dir={locale === 'ar' ? 'rtl' : 'ltr'}
                  autoComplete="off"
                />
                <Button type="submit" variant="primary" loading={pending} disabled={pending || draft.trim().length === 0} lang={locale}>
                  {t(c.send, locale)}
                </Button>
              </form>
            }
          >
            <div className="flex flex-col gap-3" data-testid="assistant-panel" data-audience={audience}>
              <ul className="flex max-h-chat flex-col gap-2 overflow-y-auto" aria-live="polite" data-testid="assistant-lines">
                <li className="rounded-lg bg-surface-card p-3 type-body">{t(who === 'patient' ? c.intro : c.guestIntro, locale)}</li>
                {lines.map((line, i) => {
                  const lineLang = line.lang ?? locale;
                  // The page's own words inside a line declared in the other language keep the page's.
                  const own = lineLang !== locale ? { lang: locale, dir: directionFor(locale) } : {};
                  return (
                    <li
                      key={i}
                      className={['rounded-lg p-3 type-body whitespace-pre-line', line.from === 'you' ? 'bg-navy-tint text-navy self-end' : 'bg-surface-card'].join(' ')}
                      data-from={line.from}
                      {...(lineLang !== locale ? { lang: lineLang, dir: directionFor(lineLang) } : {})}
                    >
                      <span className="sr-only" {...own}>{t(line.from === 'you' ? c.youLabel : c.assistantLabel, locale)}: </span>
                      <AsWritten text={line.text} locale={lineLang} />
                      {line.note && <span className="mt-1 block type-caption text-ink-muted" {...own}>{line.note}</span>}
                    </li>
                  );
                })}
                {pending && (
                  <li className="rounded-lg bg-surface-card p-3 type-body text-ink-muted" data-testid="assistant-thinking">
                    {t(c.thinking, locale)}
                  </li>
                )}
                <li ref={endRef} aria-hidden="true" />
              </ul>
              {lastAsk === 'confirm' && (
                <div className="flex flex-wrap gap-2" role="group" aria-label={t(c.confirmLabel, locale)} data-testid="assistant-confirm">
                  <Button variant="secondary" onClick={() => answerConfirm(true)} lang={locale}>{t(c.confirmYes, locale)}</Button>
                  <Button variant="secondary" onClick={() => answerConfirm(false)} lang={locale}>{t(c.confirmNo, locale)}</Button>
                </div>
              )}
              {lastAsk === 'clarify' && (
                <div className="flex flex-wrap gap-2" role="group" aria-label={t(c.clarifyLabel, locale)} data-testid="assistant-clarify">
                  {CLARIFY[who].map((key) => (
                    <Button key={key} variant="secondary" onClick={() => send(t(c[key], locale))} lang={locale}>
                      {t(c[key], locale)}
                    </Button>
                  ))}
                </div>
              )}
              {lines.length === 0 && (
                <div className="flex flex-wrap gap-2" role="group" aria-label={t(c.suggestionsLabel, locale)}>
                  {SUGGESTIONS[audience].map((key) => (
                    <Button key={key} variant="secondary" onClick={() => send(t(c[key], locale))} disabled={pending} lang={locale}>
                      {t(c[key], locale)}
                    </Button>
                  ))}
                </div>
              )}
              <p className="type-caption text-ink-muted">{t(c.safetyLine, locale)}</p>
            </div>
          </Sheet>
      )}
    </>
  );
}

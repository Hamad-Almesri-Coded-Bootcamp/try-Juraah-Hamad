'use client';

/**
 * AP-09 (CR-083, CR-086): the one way a screen links Telegram, shared by E5 (NotificationsScreen),
 * A2's Telegram offer (SetupFlow) and F4 (CaregiverProfile).
 *
 * `TelegramLinkForm` is the design system's Button inside a plain form that POSTs `locale` and
 * `from` to TELEGRAM_OPEN_PATH. The route handler mints the person's own link under their session
 * and answers 303 to t.me/<bot>?start=<token>, so the token is only ever in that Location header:
 * this component never calls the seam, never sees a token and holds nothing to leak (rule 7).
 *   - A real bot: the form opens in a new tab (a form submitted from the tap itself is never a
 *     blocked pop-up), so this page stays where it is and waits for the confirmation.
 *   - Simulated (no bot token on the server): the form posts in place, the route mints the link
 *     and sends the person straight back here, where the screen says the chat is a demo.
 *
 * `useLinkConfirmation` is the pending state's clock: while a link waits for Start it re-reads the
 * page every few seconds for five minutes (the token itself lives fifteen), re-reads at once when
 * the person comes back to this tab from Telegram, and backs the "I pressed Start" button, which
 * checks again on demand and restarts the five minutes. Not connected is a normal state (rule 2):
 * nothing here ever renders as an error.
 */
import { useEffect, useRef, useState, useTransition, type FormEvent, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { Button, type ButtonProps } from '@/components/ui/Button';
import { TELEGRAM_OPEN_PATH, type LinkFrom } from '@/lib/messaging/link';
import type { Locale } from '@/i18n/locale';

/** How often the pending state re-reads the page, and for how many reads (five minutes). */
export const LINK_POLL_MS = 3000;
export const LINK_POLL_TRIES = 100;
/** A second tap within this window opens nothing: two tabs would mint two tokens, the first one dead. */
const RESUBMIT_GUARD_MS = 3000;

export interface TelegramLinkFormProps extends Omit<ButtonProps, 'type' | 'onClick' | 'loading' | 'lang' | 'children'> {
  from: LinkFrom;
  locale: Locale;
  /** The server's BOT_IS_SIMULATED, passed down by the page. */
  simulated: boolean;
  /** Fires as the form goes (a real bot: the new tab is opening; this page stays). */
  onOpen?: () => void;
  children: ReactNode;
}

export function TelegramLinkForm({ from, locale, simulated, onOpen, children, ...button }: TelegramLinkFormProps) {
  const [sending, setSending] = useState(false);
  const recent = useRef(false);

  // Back/forward cache: returning to this page must not leave the button spinning.
  useEffect(() => {
    const reset = (event: PageTransitionEvent) => {
      if (event.persisted) setSending(false);
    };
    window.addEventListener('pageshow', reset);
    return () => window.removeEventListener('pageshow', reset);
  }, []);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    if (recent.current) {
      event.preventDefault();
      return;
    }
    recent.current = true;
    setTimeout(() => {
      recent.current = false;
    }, RESUBMIT_GUARD_MS);
    // Simulated: this page is being replaced by the route's answer, so it says it is working.
    if (simulated) setSending(true);
    onOpen?.();
  }

  return (
    <form method="post" action={TELEGRAM_OPEN_PATH} target={simulated ? undefined : '_blank'} onSubmit={handleSubmit} data-telegram-link={from}>
      <input type="hidden" name="locale" value={locale} />
      <input type="hidden" name="from" value={from} />
      <Button {...button} type="submit" lang={locale} loading={sending}>
        {children}
      </Button>
    </form>
  );
}

export function useLinkConfirmation(awaiting: boolean) {
  const router = useRouter();
  const [tries, setTries] = useState(0);
  const [checked, setChecked] = useState(false);
  const [checking, startCheck] = useTransition();

  useEffect(() => {
    if (!awaiting || tries >= LINK_POLL_TRIES) return;
    const id = setTimeout(() => {
      setTries((n) => n + 1);
      router.refresh();
    }, LINK_POLL_MS);
    return () => clearTimeout(id);
  }, [awaiting, tries, router]);

  // Coming back from Telegram: read at once, and give the confirmation a fresh five minutes.
  useEffect(() => {
    if (!awaiting) return;
    const onVisible = () => {
      if (document.visibilityState !== 'visible') return;
      setTries(0);
      router.refresh();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, [awaiting, router]);

  /** "I pressed Start": read now; if the link is still waiting afterwards, `checked` says so. */
  function checkNow() {
    setChecked(false);
    setTries(0);
    startCheck(() => {
      router.refresh();
      setChecked(true);
    });
  }

  /** A fresh link was just asked for: forget the last check and restart the five minutes. */
  function restart() {
    setChecked(false);
    setTries(0);
  }

  return { checking, checked: awaiting && checked && !checking, stopped: awaiting && tries >= LINK_POLL_TRIES, checkNow, restart };
}

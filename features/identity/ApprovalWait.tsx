'use client';

import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { Brand } from '@/components/ui/Brand';
import { Button } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';
import { ProgressRing } from '@/components/ui/ProgressRing';
import { copy, t } from '@/i18n';
import { formatNumber } from '@/i18n/format';
import type { Locale } from '@/i18n/locale';

export interface ApprovalWaitProps {
  /** Seconds the approval window starts with (the progressbar's max). */
  seconds: number;
  /** Controlled by the caller, exactly as the design system's Countdown: 'running' starts the tick;
   * the caller moves to 'completed' on its own outcome, or to 'lapsed' after `onLapse`. */
  state: 'running' | 'completed' | 'lapsed';
  onLapse?: () => void;
  onRetry?: () => void;
  onCancel?: () => void;
  locale: Locale;
  /** The bar's actions on the sky (the assistant and the language switch). */
  actions?: ReactNode;
  className?: string;
}

/**
 * A1's waiting-for-approval state in the Daylight look (CR-071, V2SignInWait): the whole screen is
 * the navy sky, with a calm ring counting the seconds down, the one heading, a plain line saying the
 * approval is simulated, and a way out that is always there (navigation.md: nobody faces a screen
 * counting at them with no exit). When the window lapses: a retry and the same way out, and a line
 * saying it is not the person's fault.
 *
 * The timing is the design system's Countdown logic, unchanged: one `setInterval`, one decrement per
 * tick, no clock read anywhere in this file (rule 9, guard 6), and a polite announcement every ten
 * seconds rather than every tick (UX §11). The ring is `ProgressRing` (a Daylight primitive); the
 * number in it follows the reader's digits, while `aria-valuenow` stays the plain number ARIA needs.
 */
export function ApprovalWait({ seconds, state, onLapse, onRetry, onCancel, locale, actions, className }: ApprovalWaitProps) {
  const [remaining, setRemaining] = useState(seconds);
  const [announcement, setAnnouncement] = useState('');
  const onLapseRef = useRef(onLapse);
  const headingId = useId();

  useEffect(() => {
    onLapseRef.current = onLapse;
  }, [onLapse]);

  // A fresh run resets the counter during render (React's "adjusting state when a prop changes").
  const runKey = `${state}:${seconds}`;
  const [lastRunKey, setLastRunKey] = useState(runKey);
  if (runKey !== lastRunKey) {
    setLastRunKey(runKey);
    if (state === 'running') setRemaining(seconds);
  }

  useEffect(() => {
    if (state !== 'running') return undefined;
    const id = setInterval(() => {
      setRemaining((prev) => {
        const next = prev <= 1 ? 0 : prev - 1;
        if (next % 10 === 0) {
          setAnnouncement(
            next > 0 ? `${formatNumber(next, locale)} ${t(copy.vocabulary.secondsLeft, locale)}` : t(copy.vocabulary.countdownLapsed, locale),
          );
        }
        if (prev <= 1) {
          clearInterval(id);
          onLapseRef.current?.();
        }
        return next;
      });
    }, 1000);
    return () => clearInterval(id);
  }, [state, locale]);

  const effective = state === 'running' && remaining <= 0 ? 'lapsed' : state;
  const pct = seconds > 0 ? Math.round((remaining / seconds) * 100) : 0;
  const heading =
    effective === 'running'
      ? t(copy.identity.countdownLabel, locale)
      : effective === 'completed'
        ? t(copy.vocabulary.countdownDone, locale)
        : t(copy.vocabulary.countdownLapsed, locale);
  const body =
    effective === 'running' ? t(copy.identity.approvalBody, locale) : effective === 'lapsed' ? t(copy.identity.approvalLapsedBody, locale) : null;

  return (
    <section
      className={['jr-sky gap-5', className].filter(Boolean).join(' ')}
      data-testid="approval-wait"
      aria-labelledby={headingId}
    >
      <div className="jr-sky__top">
        <Brand name={t(copy.shell.appName, locale)} className="jr-display flex-1 text-h2 font-bold" />
        {actions}
      </div>

      <div className="flex flex-1 flex-col items-center justify-center gap-5 py-5 text-center">
        {effective === 'running' ? (
          <div role="progressbar" aria-labelledby={headingId} aria-valuemin={0} aria-valuemax={seconds} aria-valuenow={remaining}>
            <ProgressRing value={pct} size={208} stroke={10} tone="sky">
              <span className="type-display jr-num text-on-fill" aria-hidden="true">
                {formatNumber(remaining, locale)}
              </span>
              <span className="jr-sky__eyebrow type-body-small" aria-hidden="true">
                {t(copy.vocabulary.secondsLeft, locale)}
              </span>
            </ProgressRing>
          </div>
        ) : (
          <ProgressRing value={effective === 'completed' ? 100 : 0} size={208} stroke={10} tone="sky">
            <Icon name={effective === 'completed' ? 'check' : 'clock'} className="size-6 text-on-fill" />
          </ProgressRing>
        )}
        <div className="flex max-w-content flex-col items-center gap-2">
          <h1 id={headingId} className="jr-display m-0 text-h1 text-on-fill">
            {heading}
          </h1>
          {body && <p className="jr-sky__eyebrow type-body m-0">{body}</p>}
        </div>
        {effective === 'running' && (
          <span className="wsf-sr" aria-live="polite" role="status">
            {announcement}
          </span>
        )}
      </div>

      {effective !== 'completed' && (
        <div className="mx-auto flex w-full max-w-content flex-col gap-2 tablet:flex-row tablet:justify-center [&>*]:w-full tablet:[&>*]:w-auto">
          {effective === 'lapsed' && onRetry && (
            <Button variant="primary" size="lg" icon="refresh" lang={locale} onClick={onRetry}>
              {t(copy.vocabulary.retry, locale)}
            </Button>
          )}
          {onCancel && (
            <Button variant="secondary" size="lg" lang={locale} onClick={onCancel}>
              {t(copy.identity.cancelLabel, locale)}
            </Button>
          )}
        </div>
      )}
    </section>
  );
}

'use client';

import { useEffect, useId, useRef, useState } from 'react';
import { Icon } from './Icon';
import { copy, t, type Locale } from '@/i18n';
import './styles/Countdown.css';

export interface CountdownProps {
  /** Total seconds the countdown was started with (the determinate progressbar's max). */
  seconds: number;
  /** Controlled by the caller. 'running' starts the internal tick; the caller flips to 'lapsed' or
   * 'completed' in response to onLapse or its own outcome. */
  state: 'running' | 'completed' | 'lapsed';
  /** Fires once, the moment the internal counter reaches zero while running. */
  onLapse?: () => void;
  onRetry?: () => void;
  /** Always rendered while running (navigation.md: nobody faces a screen counting at them with no
   * exit) — and offered again at lapsed, matching SignInStates.dc.html. */
  onCancel?: () => void;
  /** Visible heading above the ring, e.g. "Open the Hawiati app and approve". */
  label: React.ReactNode;
  retryLabel?: string;
  /** No 'cancel' key exists in i18n/copy/vocabulary.ts; falls back to `vocabulary.back`, the closest
   * existing word for leaving the flow — reported as a gap in docs/backend-notes/wp2c.md. */
  cancelLabel?: string;
  lang?: Locale;
  className?: string;
}

/**
 * The "open the Hawiati app and approve" countdown. Ticks a seconds counter with `setInterval` and
 * never reads a wall clock — no Date-dot-now, no performance-dot-now, no bare `new` Date — call
 * anywhere in this file (guard 6, G3): the remaining time is pure component state, decremented once
 * per interval tick.
 */
export function Countdown({
  seconds,
  state,
  onLapse,
  onRetry,
  onCancel,
  label,
  retryLabel,
  cancelLabel,
  lang = 'en',
  className,
}: CountdownProps) {
  const [remaining, setRemaining] = useState(seconds);
  const [announcement, setAnnouncement] = useState('');
  const onLapseRef = useRef(onLapse);
  const headingId = useId();

  useEffect(() => {
    onLapseRef.current = onLapse;
  }, [onLapse]);

  // Resets the counter the moment a fresh run starts — synchronously during render (React's own
  // "adjusting state when a prop changes" pattern), never inside an effect body, so this never
  // triggers react-hooks/set-state-in-effect and never costs an extra frame of stale display.
  const runKey = `${state}:${seconds}`;
  const [lastRunKey, setLastRunKey] = useState(runKey);
  if (runKey !== lastRunKey) {
    setLastRunKey(runKey);
    if (state === 'running') setRemaining(seconds);
  }

  // The only place this component ever changes the number on screen: one interval, one decrement,
  // never a clock read. Cleared as soon as it reaches zero, and again on unmount / state change.
  // The announcement (every ten seconds, politely — not every tick, which would be unusable noise
  // for a screen reader, UX §11) is set from inside this same timer callback, not the effect body
  // itself, for the same set-state-in-effect reason as the reset above.
  useEffect(() => {
    if (state !== 'running') return undefined;
    const id = setInterval(() => {
      setRemaining((prev) => {
        const next = prev <= 1 ? 0 : prev - 1;
        if (next % 10 === 0) {
          setAnnouncement(next > 0 ? `${next} ${t(copy.vocabulary.secondsLeft, lang)}` : t(copy.vocabulary.countdownLapsed, lang));
        }
        if (prev <= 1) {
          clearInterval(id);
          onLapseRef.current?.();
        }
        return next;
      });
    }, 1000);
    return () => clearInterval(id);
  }, [state, lang]);

  // Reflects zero immediately even for the one render before the caller's `state` prop catches up
  // with the onLapse callback it just received.
  const effectiveState = state === 'running' && remaining <= 0 ? 'lapsed' : state;
  const pct = seconds > 0 ? Math.round((remaining / seconds) * 100) : 0;
  const classes = ['wsf-countdown', `wsf-countdown--${effectiveState}`, className].filter(Boolean).join(' ');

  return (
    <section className={classes}>
      {effectiveState === 'running' && (
        <>
          <p id={headingId} className="wsf-countdown__label type-body-strong">
            {label}
          </p>
          <div
            className="wsf-countdown__ring"
            style={{ '--wsf-cd-pct': pct } as React.CSSProperties}
            role="progressbar"
            aria-labelledby={headingId}
            aria-valuemin={0}
            aria-valuemax={seconds}
            aria-valuenow={remaining}
          >
            <span className="wsf-countdown__value type-h1" aria-hidden="true">
              {remaining}
            </span>
          </div>
          <span className="wsf-sr" aria-live="polite" role="status">
            {announcement}
          </span>
          {onCancel && (
            <button type="button" className="wsf-btn wsf-btn--quiet wsf-focus" onClick={onCancel}>
              {cancelLabel ?? t(copy.vocabulary.back, lang)}
            </button>
          )}
        </>
      )}
      {effectiveState === 'completed' && (
        <>
          <Icon name="check" className="wsf-countdown__icon" />
          <p className="wsf-countdown__label type-body-strong">{t(copy.vocabulary.countdownDone, lang)}</p>
        </>
      )}
      {effectiveState === 'lapsed' && (
        <>
          <p className="wsf-countdown__label type-body-strong">{t(copy.vocabulary.countdownLapsed, lang)}</p>
          <div className="wsf-countdown__actions">
            {onRetry && (
              <button type="button" className="wsf-btn wsf-btn--primary wsf-focus" onClick={onRetry}>
                <Icon name="refresh" />
                {retryLabel ?? t(copy.vocabulary.retry, lang)}
              </button>
            )}
            {onCancel && (
              <button type="button" className="wsf-btn wsf-btn--quiet wsf-focus" onClick={onCancel}>
                {cancelLabel ?? t(copy.vocabulary.back, lang)}
              </button>
            )}
          </div>
        </>
      )}
    </section>
  );
}

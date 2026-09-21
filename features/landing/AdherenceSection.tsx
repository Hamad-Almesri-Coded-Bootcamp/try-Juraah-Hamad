import { copy, t } from '@/i18n';
import type { Locale } from '@/i18n/locale';

/**
 * Section (6) — adherence follow-up, marked optional, stating everything above works without it
 * (G11 item 6 / G10). The badge is plain layout markup (L1's approved exception), not a misuse of
 * `StatusPill` — that component's four words are dose-status vocabulary only (G9), never a generic
 * label.
 */
export function AdherenceSection({ locale }: { locale: Locale }) {
  return (
    <section className="flex flex-col gap-2 p-3 tablet:p-5">
      <span className="inline-flex w-fit items-center rounded-full border border-border bg-surface-card px-2 py-1 text-caption text-ink-muted">
        {t(copy.landing.adherenceBadge, locale)}
      </span>
      <h2 className="text-h2 text-navy">{t(copy.landing.adherenceHeading, locale)}</h2>
      <p className="text-body text-ink-muted">{t(copy.landing.adherenceBody, locale)}</p>
    </section>
  );
}

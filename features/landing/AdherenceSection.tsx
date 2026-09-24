import { copy, t } from '@/i18n';
import type { Locale } from '@/i18n/locale';

/**
 * Section (6): the daily follow-up, marked optional, saying everything above works without it and
 * that it stays off until the person turns it on (G11 item 6, G10, rule 2). A navy-tint information
 * panel (the one tint the system allows for information). The badge is plain layout markup, not a
 * `StatusPill`: that component's words are dose-status vocabulary only.
 */
export function AdherenceSection({ locale }: { locale: Locale }) {
  return (
    <section aria-labelledby="follow-up-title" className="flex flex-col items-start gap-2 rounded-lg bg-navy-tint p-4">
      <span className="type-label inline-flex items-center rounded-full bg-surface-card px-3 py-1 text-navy">
        {t(copy.landing.adherenceBadge, locale)}
      </span>
      <h2 id="follow-up-title" className="type-h2 m-0 text-navy">
        {t(copy.landing.adherenceHeading, locale)}
      </h2>
      <p className="type-body m-0 text-ink-muted">{t(copy.landing.adherenceBody, locale)}</p>
    </section>
  );
}

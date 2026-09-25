import { copy, t } from '@/i18n';
import type { Locale } from '@/i18n/locale';
import { PROSE } from './layout';

/**
 * Section (9): transparency, in the footer (G11 item 9, and G11's own invariant: the simulation
 * disclosed on the page itself, in ordinary type, in both languages): the Hawiati sign-in is
 * simulated (CR-107 dropped the prototype and made-up-data wording).
 */
export function TransparencySection({ locale }: { locale: Locale }) {
  return (
    <section aria-labelledby="about-title" className="flex flex-col gap-2">
      <h2 id="about-title" className="type-h2 m-0 text-navy">
        {t(copy.landing.transparencyHeading, locale)}
      </h2>
      <p className={`type-body m-0 text-ink-muted ${PROSE}`}>{t(copy.landing.transparencyBody, locale)}</p>
    </section>
  );
}

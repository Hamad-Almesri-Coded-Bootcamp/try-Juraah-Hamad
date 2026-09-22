import { copy, t } from '@/i18n';
import type { Locale } from '@/i18n/locale';
import { PROSE, SECTION_GUTTER } from './layout';

/**
 * Section (9) — academic transparency: capstone prototype, simulated identity flow, synthetic
 * data (G11 item 9 / G11's own invariant: "the simulation disclosed on the page itself in ordinary
 * type in both languages"). `navy-tint` is the tinted panel the design system allows on a routine
 * screen (Card.md: "the only tinted background allowed... belongs to a selected row or an
 * information panel"), used here as an information panel, not a card.
 */
export function TransparencySection({ locale }: { locale: Locale }) {
  return (
    <section className={`flex flex-col gap-2 border-y border-border bg-navy-tint ${SECTION_GUTTER}`}>
      <h2 className="text-h2 text-navy">{t(copy.landing.transparencyHeading, locale)}</h2>
      <p className={`text-body text-navy ${PROSE}`}>{t(copy.landing.transparencyBody, locale)}</p>
    </section>
  );
}

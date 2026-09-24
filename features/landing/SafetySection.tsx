import { Icon, type IconName } from '@/components/ui/Icon';
import { copy, t, type CopyEntry } from '@/i18n';
import type { Locale } from '@/i18n/locale';
import { SECTION_HEADING } from './layout';

/**
 * Section (8): safety and privacy, as a navy band (V2Landing): the app never records a dose by
 * itself (rule 1), a serious finding stops at a human reviewer, screening rests on published drug
 * data (G11 item 8). Plain statements, not an alert: the danger colour stays out of this section
 * (UX Principles §8, L1's bounded exception). From 834px the band is a Daylight sky panel.
 */
const ITEMS: ReadonlyArray<readonly [IconName, CopyEntry, CopyEntry]> = [
  ['check', copy.landing.safety1Title, copy.landing.safety1Body],
  ['review', copy.landing.safety2Title, copy.landing.safety2Body],
  ['info', copy.landing.safety3Title, copy.landing.safety3Body],
];

export function SafetySection({ locale }: { locale: Locale }) {
  return (
    <section aria-labelledby="safety-title" className="jr-sky gap-5 py-6 tablet:gap-6 tablet:py-6">
      <h2 id="safety-title" className={`${SECTION_HEADING} text-on-fill`}>
        {t(copy.landing.safetyHeading, locale)}
      </h2>
      <ul className="m-0 grid list-none gap-5 p-0 @[1000px]:grid-cols-3 @[1000px]:gap-6">
        {ITEMS.map(([icon, title, body]) => (
          <li key={title.en} className="flex flex-col gap-2">
            <span className="inline-flex size-hit-lg items-center justify-center rounded-full bg-navy-soft text-on-fill" aria-hidden="true">
              <Icon name={icon} />
            </span>
            <h3 className="type-h2 m-0 text-on-fill">{t(title, locale)}</h3>
            <p className="jr-sky__eyebrow type-body m-0">{t(body, locale)}</p>
          </li>
        ))}
      </ul>
    </section>
  );
}

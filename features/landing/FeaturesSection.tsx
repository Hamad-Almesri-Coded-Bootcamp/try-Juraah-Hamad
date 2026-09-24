import { Icon, type IconName } from '@/components/ui/Icon';
import { copy, t, type CopyEntry } from '@/i18n';
import type { Locale } from '@/i18n/locale';
import { AdherenceSection } from './AdherenceSection';
import { SECTION_HEADING, SECTION_INNER, SECTION_OUTER } from './layout';

/**
 * Sections (5) and (6), side by side once the page is wide (V2Landing). Section (5): what you get,
 * six features each naming one that exists in the inventory (G11 item 5): the unified record (B2),
 * the day schedule (B1), interaction screening (C1/C2), refill requests (D1), the photo drug check
 * (C3), calendar sync (E1). A clean list with an icon each, one column at phone and two from 700px,
 * divided by hairlines, never a wall of cards (CR-069(f)). Section (6), the optional follow-up, sits
 * under the heading on a wide page and after the list on a phone.
 */
const FEATURES: ReadonlyArray<readonly [IconName, CopyEntry, CopyEntry]> = [
  ['capsule', copy.landing.feature1Title, copy.landing.feature1Body],
  ['clock', copy.landing.feature2Title, copy.landing.feature2Body],
  ['shield', copy.landing.feature3Title, copy.landing.feature3Body],
  ['refresh', copy.landing.feature4Title, copy.landing.feature4Body],
  ['camera', copy.landing.feature5Title, copy.landing.feature5Body],
  ['calendar', copy.landing.feature6Title, copy.landing.feature6Body],
];

export function FeaturesSection({ locale }: { locale: Locale }) {
  return (
    <div className={SECTION_OUTER}>
      <div
        className={`${SECTION_INNER} @[1000px]:grid @[1000px]:grid-cols-[minmax(0,2fr)_minmax(0,3fr)] @[1000px]:grid-rows-[auto_1fr] @[1000px]:gap-x-6 @[1000px]:gap-y-5`}
      >
        <h2 id="features-title" className={`${SECTION_HEADING} @[1000px]:col-start-1 @[1000px]:row-start-1`}>
          {t(copy.landing.featuresHeading, locale)}
        </h2>
        <ul
          aria-labelledby="features-title"
          className="m-0 grid list-none gap-x-5 p-0 @[700px]:grid-cols-2 @[1000px]:col-start-2 @[1000px]:row-span-2 @[1000px]:row-start-1"
        >
          {FEATURES.map(([icon, title, body]) => (
            <li key={title.en} className="flex items-start gap-3 border-t border-border py-4">
              <span className="inline-flex size-hit-lg shrink-0 items-center justify-center rounded-md bg-navy-tint text-navy" aria-hidden="true">
                <Icon name={icon} />
              </span>
              <div className="flex flex-col gap-1">
                <h3 className="type-h2 m-0 text-navy">{t(title, locale)}</h3>
                <p className="type-body m-0 text-ink-muted">{t(body, locale)}</p>
              </div>
            </li>
          ))}
        </ul>
        <div className="@[1000px]:col-start-1 @[1000px]:row-start-2 @[1000px]:self-start">
          <AdherenceSection locale={locale} />
        </div>
      </div>
    </div>
  );
}

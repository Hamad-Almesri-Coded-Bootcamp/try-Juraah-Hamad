import { copy, t } from '@/i18n';
import { formatNumber } from '@/i18n/format';
import type { Locale } from '@/i18n/locale';
import { SECTION_HEADING, SECTION_INNER, SECTION_OUTER } from './layout';

/**
 * Section (4): how it works, in three numbered steps (G11 item 4). Carries the `how-it-works` anchor
 * the hero's secondary action jumps to. The number sits in its own navy disc, in the reader's digits;
 * the steps stack at phone width and stand side by side once the page is wide. No cards: the number
 * and the words are the whole of each step.
 */
export function SolutionSection({ locale }: { locale: Locale }) {
  const steps = [
    [copy.landing.solutionStep1Title, copy.landing.solutionStep1Body],
    [copy.landing.solutionStep2Title, copy.landing.solutionStep2Body],
    [copy.landing.solutionStep3Title, copy.landing.solutionStep3Body],
  ] as const;
  return (
    <section id="how-it-works" aria-labelledby="how-title" className={`${SECTION_OUTER} scroll-mt-3`}>
      <div className={SECTION_INNER}>
        <h2 id="how-title" className={SECTION_HEADING}>
          {t(copy.landing.solutionHeading, locale)}
        </h2>
        <ol className="m-0 grid list-none gap-5 p-0 @[1000px]:grid-cols-3 @[1000px]:gap-6">
          {steps.map(([title, body], i) => (
            <li key={title.en} className="flex gap-3 @[1000px]:flex-col">
              <span
                className="jr-num inline-flex size-hit-lg shrink-0 items-center justify-center rounded-full bg-navy text-h2 text-on-fill"
                aria-hidden="true"
              >
                {formatNumber(i + 1, locale)}
              </span>
              <div className="flex flex-col gap-1">
                <h3 className="type-h2 m-0 text-navy">{t(title, locale)}</h3>
                <p className="type-body m-0 text-ink-muted">{t(body, locale)}</p>
              </div>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

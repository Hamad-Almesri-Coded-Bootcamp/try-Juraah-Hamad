import { DayDial, type DialDose } from '@/components/ui/DayDial';
import { interpolate } from '@/features/shell/interpolate';
import { copy, t } from '@/i18n';
import { formatNumber, formatStrength, formatTime } from '@/i18n/format';
import { localizeDrugName } from '@/i18n/localize';
import type { Locale } from '@/i18n/locale';

/**
 * The hero's picture (CR-071): the real `DayDial` the Today screen draws, as an illustration of the
 * product, in place of the old screenshot (which showed the Arabic screen on the English page).
 *
 * G11 ("every screenshot shown is a screen that exists"): the dial shows a day the build really
 * renders, حمد's on REFERENCE_NOW (docs/Seed Dataset.md): rx-002 Brufen at 08:00, 14:00 and 20:00,
 * rx-003 Glucophage at 08:00 and 20:00, rx-001 Marevan at 18:00, the hand at 09:15, and the next
 * dose Brufen 400 mg at 14:00. Tracking is off in that state, so every dot is plain (rule 3). These
 * are copied facts, not a data read: L1 makes no data-layer call (its seam test), and no clock is
 * read here (rule 9), because an illustration does not move with the time.
 */
const DOSE_TIMES = ['08:00', '14:00', '18:00', '20:00'] as const;
const NOW = '09:15';
const NEXT = { time: '14:00', brand: 'Brufen', strength: 400, unit: 'mg' } as const;

function minutesOf(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number);
  return (h ?? 0) * 60 + (m ?? 0);
}

const DOSES: DialDose[] = DOSE_TIMES.map((time) => ({ minutes: minutesOf(time), tone: 'plain' }));

export function HeroDial({ locale }: { locale: Locale }) {
  const hourLabels = [formatNumber(24, locale), formatNumber(6, locale), formatNumber(12, locale), formatNumber(18, locale)] as const;
  const drug = localizeDrugName(NEXT.brand, locale);
  const strength = formatStrength(NEXT.strength, NEXT.unit, locale);
  const description = interpolate(t(copy.landing.heroDialDescriptionTemplate, locale), {
    times: new Intl.ListFormat(locale, { type: 'conjunction' }).format(DOSE_TIMES.map((time) => formatTime(time, locale))),
    drug: `${drug} ${strength}`,
    next: formatTime(NEXT.time, locale),
  });
  const centre = (
    <>
      <span className="jr-dial__kicker">{t(copy.daylight.nextDose, locale)}</span>
      <span className="jr-dial__time">{formatTime(NEXT.time, locale)}</span>
      <span className="jr-dial__name">{drug}</span>
      <span className="jr-dial__sub">{strength}</span>
    </>
  );
  return (
    <figure className="m-0 flex flex-col items-center gap-3">
      {/* One picture for assistive technology, described in words; the two sizes are the same dial. */}
      <div role="img" aria-label={description}>
        <DayDial doses={DOSES} nowMinutes={minutesOf(NOW)} hourLabels={hourLabels} size={296} className="@[1000px]:hidden">
          {centre}
        </DayDial>
        <DayDial doses={DOSES} nowMinutes={minutesOf(NOW)} hourLabels={hourLabels} size={400} className="hidden @[1000px]:block">
          {centre}
        </DayDial>
      </div>
      <figcaption className="jr-sky__eyebrow type-body-small">{t(copy.landing.heroDialCaption, locale)}</figcaption>
    </figure>
  );
}

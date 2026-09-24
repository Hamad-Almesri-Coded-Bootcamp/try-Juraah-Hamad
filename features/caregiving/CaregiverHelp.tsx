/**
 * F5 — caregiver help (docs/wireframes/CaregiverHelp.dc.html). Static copy only, written for the
 * relative (SCREENS.md): what they can and cannot see, what to do on a danger alert, tracking-off,
 * and how to be re-invited. No data function — none is listed for F5 in docs/SCREENS.md. Daylight
 * (CR-071): one grouped card, one question per row, each with its glyph in a soft disc.
 */
import { Icon, type IconName } from '@/components/ui/Icon';
import { copy, t } from '@/i18n';
import type { Locale } from '@/i18n/locale';

const TOPICS: { icon: IconName; title: keyof typeof copy.caregiving; body: keyof typeof copy.caregiving }[] = [
  { icon: 'check', title: 'f5CanSeeTitle', body: 'f5CanSeeBody' },
  { icon: 'close', title: 'f5CannotTitle', body: 'f5CannotBody' },
  { icon: 'shield', title: 'f5DangerTitle', body: 'f5DangerBody' },
  { icon: 'info', title: 'f5TrackingOffTitle', body: 'f5TrackingOffBody' },
  { icon: 'users', title: 'f5AccessEndedTitle', body: 'f5AccessEndedBody' },
];

export function CaregiverHelp({ locale }: { locale: Locale }) {
  return (
    <div className="mx-auto flex w-full max-w-content flex-col gap-5 p-3 tablet:p-5">
      <div className="jr-group flex flex-col divide-y divide-border">
        {TOPICS.map(({ icon, title, body }) => (
          <section key={title} className="flex items-start gap-3 p-3">
            <span className="flex flex-none rounded-full bg-navy-tint p-2 text-navy">
              <Icon name={icon} small />
            </span>
            <div className="flex min-w-0 flex-col gap-1">
              <h2 className="type-body-strong">{t(copy.caregiving[title], locale)}</h2>
              <p className="type-body text-ink-muted">{t(copy.caregiving[body], locale)}</p>
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}

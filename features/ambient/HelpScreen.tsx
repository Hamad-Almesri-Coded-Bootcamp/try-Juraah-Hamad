/**
 * E4 — help & support (patient) (`docs/wireframes/Help.dc.html`), Daylight (CR-071): the questions
 * in one grouped card, each question in bold with its answer under it and a hairline between them,
 * so the list scans at a glance. Static copy from the catalogue, per SCREENS.md's topic list. No data
 * function (`none (copy catalogue only)`), no clinical advice.
 */
import { copy, t } from '@/i18n';
import type { CopyEntry } from '@/i18n/copy/shell';
import type { Locale } from '@/i18n/locale';

const QUESTIONS: [CopyEntry, CopyEntry][] = [
  [copy.ambient.e4HowItWorksTitle, copy.ambient.e4HowItWorksBody],
  [copy.ambient.e4CheckInsTitle, copy.ambient.e4CheckInsBody],
  [copy.ambient.e4DoseWrongTitle, copy.ambient.e4DoseWrongBody],
  [copy.ambient.e4SafetyAlertTitle, copy.ambient.e4SafetyAlertBody],
  [copy.ambient.e4ContactClinicTitle, copy.ambient.e4ContactClinicBody],
];

export function HelpScreen({ locale }: { locale: Locale }) {
  return (
    <div className="flex flex-col gap-4" data-testid="help-screen">
      <div className="jr-group flex flex-col">
        {QUESTIONS.map(([question, answer], i) => (
          <section key={i} className={`flex flex-col gap-1 px-4 py-4 ${i > 0 ? 'border-t border-border' : ''}`}>
            <h2 className="jr-display m-0 type-body-strong text-navy">{t(question, locale)}</h2>
            <p className="m-0 type-body text-ink-muted">{t(answer, locale)}</p>
          </section>
        ))}
      </div>
      <p className="m-0 px-1 type-caption text-ink-muted">{t(copy.ambient.e4NoAdviceNote, locale)}</p>
    </div>
  );
}

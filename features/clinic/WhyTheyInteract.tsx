/**
 * G2s — "Why they interact" (CR-113, the owner's approved mockup of 2026-09-26). Replaces the Source
 * card on the reviewer screen when the data layer found why-data for the alert's pair; with none,
 * ReviewerDecision keeps today's Source card. Everything shown comes from `view.why` (the data
 * layer) and the copy catalogue; this component fetches nothing and decides nothing clinical.
 *
 * - The summary is an AI draft written only from DDInter's text, so it carries the draft tag and the
 *   note until the alert is reviewed; the reviewer's decision is what records that it was checked.
 * - DDInter's own words sit one tap away, verbatim, marked lang="en" dir="ltr" in both languages.
 *   With no draft for the pair they are the explanation, so they start open.
 * - Red stays for the finding at the top of the screen: this section uses navy, and green only for
 *   "checked".
 */
import { Icon } from '@/components/ui/Icon';
import { Tag } from '@/components/ui/Tag';
import { Disclosure } from '@/components/ui/Disclosure';
import { DetailRow } from '@/components/ui/DetailRow';
import { copy, t } from '@/i18n';
import { interpolate } from '@/features/shell/interpolate';
import { formatDate } from '@/i18n/format';
import { localizeDrugName } from '@/i18n/localize';
import type { Locale } from '@/i18n/locale';
import type { InteractionAlert } from '@/types/contracts';
import type { AlertWhy } from '@/types/views';

const LEVEL = {
  Major: copy.clinic.whyLevelMajor,
  Moderate: copy.clinic.whyLevelModerate,
  Minor: copy.clinic.whyLevelMinor,
} as const;

export function WhyTheyInteract({
  why,
  alert,
  locale,
  headingId,
}: {
  why: AlertWhy;
  alert: InteractionAlert;
  locale: Locale;
  headingId: string;
}) {
  const reviewed = alert.reviewStatus === 'reviewed';
  const summary = why.summary ? why.summary[locale] : null;
  const checkedLabel = alert.reviewedAt
    ? interpolate(t(copy.clinic.whyCheckedTemplate, locale), { date: formatDate(alert.reviewedAt.slice(0, 10), locale) })
    : t(copy.clinic.whyCheckedLabel, locale);

  return (
    <section aria-labelledby={headingId} className="flex flex-col gap-2">
      <h2 id={headingId} className="jr-group-title">
        {t(copy.clinic.whyHeading, locale)}
      </h2>
      <div className="jr-group">
        <div className="flex flex-col gap-3 p-4">
          <div className="flex flex-wrap gap-2">
            {reviewed ? (
              <Tag tone="success" icon="check">
                {checkedLabel}
              </Tag>
            ) : null}
            {reviewed && summary ? <Tag tone="neutral">{t(copy.clinic.whyAiSummaryTag, locale)}</Tag> : null}
            {!reviewed && summary ? (
              <Tag tone="info" icon="review">
                {t(copy.clinic.whyDraftLabel, locale)}
              </Tag>
            ) : null}
            <Tag tone="neutral">{interpolate(t(copy.clinic.whyLevelTemplate, locale), { level: t(LEVEL[why.level], locale) })}</Tag>
          </div>
          {summary ? (
            <p className="type-body">{summary}</p>
          ) : (
            <p className="type-body text-ink-muted">{t(copy.clinic.whyNoSummary, locale)}</p>
          )}
          <Disclosure summary={t(copy.clinic.whySourceToggle, locale)} defaultOpen={!summary}>
            <h3 className="type-caption text-ink-muted">{t(copy.clinic.whyMechanismLabel, locale)}</h3>
            <p className="type-body-small" lang="en" dir="ltr">
              {why.mechanism}
            </p>
            <h3 className="type-caption text-ink-muted">{t(copy.clinic.whyManagementLabel, locale)}</h3>
            <p className="type-body-small" lang="en" dir="ltr">
              {why.management}
            </p>
          </Disclosure>
        </div>
        <div className="border-t border-border px-4">
          <DetailRow
            label={t(copy.clinic.whyRecordLabel, locale)}
            value={why.labels.map((name) => localizeDrugName(name, locale)).join(' × ')}
            lang={locale}
          />
          <DetailRow
            label={t(copy.clinic.whySourceLabel, locale)}
            lang={locale}
            value={
              <span className="flex flex-col gap-1">
                {why.citation ? (
                  <span className="type-body-small text-ink-muted" lang="en" dir="ltr">
                    {why.citation}
                  </span>
                ) : null}
                <span className="type-caption text-ink-muted">{t(copy.clinic.whyLicence, locale)}</span>
                <a className="type-body-small font-semibold underline" href={why.url} target="_blank" rel="noopener noreferrer">
                  {t(copy.clinic.whyOpenRecord, locale)}
                  <span className="wsf-sr"> {t(copy.clinic.whyOpensInNewTab, locale)}</span>
                </a>
              </span>
            }
          />
        </div>
      </div>
      {summary && !reviewed ? (
        <p className="flex items-start gap-2 px-1 text-ink-muted">
          <Icon name="info" small />
          <span className="type-body-small">{t(copy.clinic.whyAiNote, locale)}</span>
        </p>
      ) : null}
    </section>
  );
}

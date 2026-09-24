import { AlertRow } from '@/components/ui/AlertRow';
import { EmptyState } from '@/components/ui/EmptyState';
import { Icon } from '@/components/ui/Icon';
import { MenuRow } from '@/components/ui/MenuRow';
import { copy, t } from '@/i18n';
import { formatNumber, pluralCategory, type PluralCopy } from '@/i18n/format';
import type { Locale } from '@/i18n/locale';
import type { InteractionAlert as InteractionAlertRecord } from '@/types/contracts';

const SEVERITY_RANK: Record<InteractionAlertRecord['severity'], number> = { danger: 0, warning: 1, info: 2 };

/**
 * C1's own ordering guarantee (docs/SCREENS.md C1 row: "most severe, most recent first"). `getAlerts`
 * already returns this order (lib/data/index.ts's own `SEVERITY_RANK`), but the screen re-asserts it
 * defensively rather than trusting an upstream contract it has no way to verify at render time —
 * exported so the ordering itself is unit-testable with constructed props alone, per this bundle's
 * ACCEPTANCE line: "severity ordering on C1 (test)" (docs/briefs/WP4e.md).
 */
export function sortAlerts(alerts: readonly InteractionAlertRecord[]): InteractionAlertRecord[] {
  return [...alerts].sort(
    (a, b) => SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity] || b.createdAt.localeCompare(a.createdAt),
  );
}

/**
 * A finding that still needs the reader: one a reviewer has not decided yet, or a danger finding the
 * reviewer confirmed (the same "still stands" rule Today uses to point to it, CR-069(g)). Everything
 * else (a reviewed warning or info, a cleared finding, an automatic all-clear) is a past result.
 */
export function needsAttention(alert: Pick<InteractionAlertRecord, 'severity' | 'reviewStatus' | 'reviewerDecision'>): boolean {
  if (alert.reviewStatus === 'pending_medical_review') return true;
  return alert.reviewStatus === 'reviewed' && alert.severity === 'danger' && alert.reviewerDecision !== 'cleared';
}

const CHECKED_COUNT: PluralCopy = {
  zero: copy.safety.c1CheckedCountZero,
  one: copy.safety.c1CheckedCountOne,
  two: copy.safety.c1CheckedCountTwo,
  few: copy.safety.c1CheckedCountFew,
  many: copy.safety.c1CheckedCountMany,
  other: copy.safety.c1CheckedCountOther,
};
const ATTENTION_COUNT: PluralCopy = {
  one: copy.safety.c1AttentionCountOne,
  two: copy.safety.c1AttentionCountTwo,
  few: copy.safety.c1AttentionCountFew,
  many: copy.safety.c1AttentionCountMany,
  other: copy.safety.c1AttentionCountOther,
};

/** The words under a number, agreeing with it (an Arabic count takes one of six forms). */
function countWords(n: number, locale: Locale, forms: PluralCopy): string {
  return t(forms[pluralCategory(n, locale, forms)] ?? forms.other, locale);
}

export interface SafetySummary {
  /** Active prescriptions, every sector, all screened together. */
  checkedCount: number;
  /** True when the active prescriptions come from both the public and the private sector. */
  mixedSectors: boolean;
}

export interface SafetyListProps {
  /** The patient's own alerts — from `getAlerts`. `reviewed` and `auto_cleared` history is included
   * and shown under "past results". */
  alerts: InteractionAlertRecord[];
  /** Keyed by `InteractionAlert.id`: the interacting drugs' generic names as stored, in
   * `involvedPrescriptionIds` order (AlertRow localises them). A missing key renders the row with no
   * drug names rather than throwing. */
  drugNamesByAlertId: Record<string, string[] | undefined>;
  locale: Locale;
  /** Builds the href for a row's only affordance — opening C2. Nothing here can act on the finding. */
  hrefBuilder: (alert: InteractionAlertRecord) => string;
  /** C1's entry to C3 (the photo drug check), shown whether the list is empty or not. Absent (the
   * caregiver's read-only reuse) → no entry. */
  checkHref?: string;
  /** The navy card's facts. Absent → no summary card. */
  summary?: SafetySummary;
  className?: string;
}

/**
 * C1 — the Safety tab, Daylight (CR-071, board V2Safety). It leads with its answer: a navy card that
 * says what was checked (every active medicine, public and private, together) and how many findings
 * need the reader, with counts from the data. Then the findings that need attention (danger first,
 * most recent first), the photo drug check as an action tile, and the past results (reviewed,
 * checked automatically) below. No alerts at all → a reassuring EmptyState, never an alarm.
 * Presentational and props-driven — no fetch, no mock import — and read-only: every row only opens
 * C2 (G1).
 */
export function SafetyList({ alerts, drugNamesByAlertId, locale, hrefBuilder, checkHref, summary, className }: SafetyListProps) {
  const sorted = sortAlerts(alerts);
  const attention = sorted.filter(needsAttention);
  const past = sorted.filter((a) => !needsAttention(a));

  const row = (alert: InteractionAlertRecord) => (
    <AlertRow
      key={alert.id}
      severity={alert.severity}
      drugs={drugNamesByAlertId[alert.id] ?? []}
      reviewStatus={alert.reviewStatus}
      href={hrefBuilder(alert)}
      lang={locale}
    />
  );

  const checkTile = checkHref ? (
    <div className="jr-group">
      <MenuRow
        icon="camera"
        label={t(copy.safety.c1CheckDrugAction, locale)}
        description={t(copy.safety.c1CheckDrugDescription, locale)}
        href={checkHref}
      />
    </div>
  ) : null;

  if (sorted.length === 0) {
    return (
      <div className={['flex flex-col gap-5', className].filter(Boolean).join(' ')}>
        <EmptyState icon="shield" title={t(copy.safety.c1EmptyTitle, locale)} description={t(copy.safety.c1EmptyDescription, locale)} />
        {checkTile}
      </div>
    );
  }

  return (
    <div className={['flex flex-col gap-5', className].filter(Boolean).join(' ')} data-testid="safety-list">
      {summary && (
        <section className="flex flex-col gap-4 rounded-lg bg-navy p-4 text-on-fill shadow-sm" aria-labelledby="safety-summary-title" data-testid="safety-summary">
          <div className="flex items-center gap-3">
            <span className="flex size-hit-lg flex-none items-center justify-center rounded-full bg-(--glass)" aria-hidden="true">
              <Icon name="shield" />
            </span>
            <span className="flex min-w-0 flex-col">
              <h2 id="safety-summary-title" className="jr-display m-0 type-h2 text-on-fill">
                {t(copy.safety.c1SummaryTitle, locale)}
              </h2>
              <span className="type-body-small text-(--on-sky-muted)">
                {t(summary.mixedSectors ? copy.safety.c1SummaryMixedSectors : copy.safety.c1SummaryOneRecord, locale)}
              </span>
            </span>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <p className="m-0 flex flex-col rounded-md bg-(--glass) p-3" data-testid="safety-checked-count">
              <span className="jr-num type-h1 text-on-fill">{formatNumber(summary.checkedCount, locale)}</span>
              <span className="type-body-small text-(--on-sky-muted)">{countWords(summary.checkedCount, locale, CHECKED_COUNT)}</span>
            </p>
            {attention.length > 0 ? (
              <p className="m-0 flex flex-col rounded-md bg-(--glass) p-3" data-testid="safety-attention-count">
                <span className="jr-num type-h1 text-on-fill">{formatNumber(attention.length, locale)}</span>
                <span className="type-body-small text-(--on-sky-muted)">{countWords(attention.length, locale, ATTENTION_COUNT)}</span>
              </p>
            ) : (
              <p className="m-0 flex flex-col justify-center gap-2 rounded-md bg-(--glass) p-3" data-testid="safety-attention-count">
                <span className="flex size-5 items-center justify-center rounded-full bg-on-fill text-navy" aria-hidden="true">
                  <Icon name="check" small />
                </span>
                <span className="type-body-small text-on-fill">{t(copy.safety.c1AttentionNone, locale)}</span>
              </p>
            )}
          </div>
        </section>
      )}

      {attention.length > 0 && (
        <section className="flex flex-col gap-3" data-testid="safety-attention">
          <h2 className="jr-group-title">{t(copy.safety.c1AttentionHeading, locale)}</h2>
          {attention.map(row)}
        </section>
      )}

      {checkTile}

      {past.length > 0 && (
        <section className="flex flex-col gap-3" data-testid="safety-past">
          <h2 className="jr-group-title">{t(copy.safety.c1PastHeading, locale)}</h2>
          {past.map(row)}
        </section>
      )}
    </div>
  );
}

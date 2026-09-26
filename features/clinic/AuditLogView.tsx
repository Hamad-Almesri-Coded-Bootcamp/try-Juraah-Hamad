'use client';

/**
 * X1 — the system audit log (`/clinic/audit`). Filter state lives in the URL (`?actor=&type=&period=`),
 * read by the SERVER page via its own `searchParams` prop (D-008 — no bare `useSearchParams`; this
 * component only ever reads the current values it is handed as props, and writes new ones with
 * `router.push`, never `useSearchParams()` itself). `getAuditLog` does the actual filtering
 * server-side; this component renders whatever it returns.
 *
 * The demo's proof moment (CLAUDE.md rule 1, the OBJECTIVE line): filtering the type select to
 * `dose_status_recorded` shows exactly سارة's five rows, every one `agent` or `system` — called out
 * in its own `InlineNotice`, computed here only as `events.every(...)` over what the server already
 * returned (never a second, independent read).
 *
 * CR-010, the one G9 exception: the literal `AuditEvent.actor.role` string renders beside its human
 * label (`ActivityRow`'s `code` prop) — on this screen only, and in English only: CR-071 puts no
 * Latin script on an Arabic screen (the lead's ruling, 2026-09-24; the tension is in the report).
 *
 * The proof notice stays true whatever the filters show: the "all from the assistant or the system"
 * sentence appears only when no actor filter narrows the rows and every row really is `agent` or
 * `system`; otherwise it says what the rows show instead.
 *
 * Daylight (CR-071): at phone width the log is grouped by day (the day as a heading, its rows in one
 * card); from `@[900px]` it is a table in one card, with a row per day heading the rows under it.
 * Stored messages and masked names are shown in the reader's language (`i18n/localize.ts`).
 *
 * CR-038 (lead, wave-2 gate — consumed here): `getAuditLog` now returns `AuditLogRow`
 * (`AuditEvent & { patientMaskedName?: string }`), the masked name computed server-side the same way
 * F1's own masked-name step is (CR-010's owner answer: the patient reference on X1 is the masked
 * name, never a full name, never a Civil ID). A row's `patientMaskedName` is absent exactly when it
 * carries no `patientId` at all (a system-scoped event) — that case still falls back to the honest
 * "not recorded" marker rather than a blank cell.
 *
 * Width (AuditLog1440.dc.html): the three filters sit in one row from tablet width; the log is the
 * `ActivityRow` list until the content column is wide enough for the table (`@[900px]` on this
 * component's own container — so a 1280 laptop gets the table too, not only 1440), whose
 * `table-layout: fixed` and column widths keep a timestamp or an enum-shaped word from forcing a
 * column wider than its track (ActivityRow.css).
 */
import { useRouter } from 'next/navigation';
import type { ReactNode } from 'react';
import { Select, type SelectOption } from '@/components/ui/Select';
import { ActivityRow } from '@/components/ui/ActivityRow';
import { InlineNotice } from '@/components/ui/InlineNotice';
import { EmptyState } from '@/components/ui/EmptyState';
import { copy, t } from '@/i18n';
import { interpolate } from '@/features/shell/interpolate';
import { formatDate, formatNumber, formatTime } from '@/i18n/format';
import { localizePersonName, localizeText } from '@/i18n/localize';
import { AsWritten } from '@/components/ui/AsWritten';
import { actorLabel, eventTypeLabel, groupByDay, proofNoticeKind, type AuditPeriod } from './format';
import type { Locale } from '@/i18n/locale';
import type { AuditEvent } from '@/types/contracts';
import type { AuditLogRow } from '@/types/views';

const ACTOR_ROLES: AuditEvent['actor']['role'][] = ['patient', 'caregiver', 'reviewer', 'admin', 'agent', 'system'];

const EVENT_TYPES: AuditEvent['type'][] = [
  'prescription_added',
  'prescription_discontinued',
  'prescription_field_confirmed',
  'prescription_returned_to_clinic',
  'alert_raised',
  'alert_reviewed',
  'dose_status_recorded',
  'schedule_recomputed',
  'refill_requested',
  'refill_status_changed',
  'caregiver_invited',
  'caregiver_invite_accepted',
  'caregiver_invite_declined',
  'caregiver_invite_expired',
  'caregiver_invite_cancelled',
  'caregiver_revoked',
  'caregiver_self_unlinked',
  'messaging_connected',
  'messaging_disconnected',
  'push_enabled',
  'push_disabled',
  'tracking_enabled',
  'tracking_disabled',
  'signed_in',
  'signed_out',
];

export interface AuditFilters {
  actor?: string;
  type?: string;
  period: AuditPeriod;
}

export function AuditLogView({
  events,
  locale,
  filters,
  basePath,
  header,
}: {
  events: AuditLogRow[];
  locale: Locale;
  filters: AuditFilters;
  basePath: string;
  /** CR-115: the dashboard card, rendered above the filters inside this view's own padding. */
  header?: ReactNode;
}) {
  const router = useRouter();

  function navigate(next: AuditFilters) {
    const params = new URLSearchParams();
    if (next.actor) params.set('actor', next.actor);
    if (next.type) params.set('type', next.type);
    if (next.period !== 'all') params.set('period', next.period);
    const qs = params.toString();
    router.push(qs ? `${basePath}?${qs}` : basePath);
  }

  const actorOptions: SelectOption[] = [
    { value: '', label: t(copy.clinic.x1FilterAllActors, locale) },
    ...ACTOR_ROLES.map((role) => ({ value: role, label: actorLabel(role, locale) })),
  ];
  const typeOptions: SelectOption[] = [
    { value: '', label: t(copy.clinic.x1FilterAllTypes, locale) },
    ...EVENT_TYPES.map((type) => ({ value: type, label: eventTypeLabel(type, locale) })),
  ];
  const periodOptions: SelectOption[] = [
    { value: 'all', label: t(copy.clinic.x1FilterAllTime, locale) },
    { value: 'last7', label: t(copy.clinic.x1FilterLast7Days, locale) },
    { value: 'last30', label: t(copy.clinic.x1FilterLast30Days, locale) },
  ];

  const doseStatusFiltered = filters.type === 'dose_status_recorded';
  const count = formatNumber(events.length, locale);
  const proofBody = {
    filtered: () => t(copy.clinic.x1ProofNoticeFilteredBody, locale),
    none: () => t(copy.clinic.x1ProofNoticeNoneBody, locale),
    all: () => interpolate(t(copy.clinic.x1ProofNoticeBodyTemplate, locale), { count }),
    mixed: () => interpolate(t(copy.clinic.x1ProofNoticeMixedBodyTemplate, locale), { count }),
  }[proofNoticeKind(events, Boolean(filters.actor))]();

  // CR-038: the masked name the data layer computed, in the reader's language (the mask keeps its
  // shape), or the honest empty mark for a row with a patientId but no name; never a Civil ID.
  function patientRef(row: AuditLogRow) {
    if (row.patientMaskedName) return localizePersonName(row.patientMaskedName, locale);
    return row.patientId ? t(copy.vocabulary.empty, locale) : undefined;
  }

  function rowProps(e: AuditLogRow) {
    return {
      title: eventTypeLabel(e.type, locale),
      // The table's time cell is `dir="ltr"` (ActivityRow); the inner span keeps an Arabic time at
      // the reading edge of its column instead of drifting to the far side.
      timeLabel: <span dir={locale === 'ar' ? 'rtl' : 'ltr'} className="block">{formatTime(e.createdAt.slice(11, 16), locale)}</span>,
      // A name someone typed stays as written, declared in its language (AsWritten, CR-071).
      description: <AsWritten text={localizeText(e.message, locale)} locale={locale} />,
      actor: { label: actorLabel(e.actor.role, locale), kind: e.actor.role },
      // CR-010's literal role string, English only (CR-071).
      code: locale === 'en' ? e.actor.role : undefined,
      patientRef: patientRef(e),
    };
  }

  const days = groupByDay(events);

  return (
    <div className="@container flex flex-col gap-5 px-3 pb-5 pt-2 tablet:px-5">
      {header}
      <div className="jr-group grid grid-cols-2 gap-3 p-4 @[720px]:grid-cols-3">
        <Select
          label={t(copy.clinic.x1FilterTypeLabel, locale)}
          value={filters.type ?? ''}
          options={typeOptions}
          lang={locale}
          className="col-span-2 @[720px]:col-span-1"
          onChange={(e) => navigate({ ...filters, type: e.target.value || undefined })}
        />
        <Select label={t(copy.clinic.x1FilterActorLabel, locale)} value={filters.actor ?? ''} options={actorOptions} lang={locale} onChange={(e) => navigate({ ...filters, actor: e.target.value || undefined })} />
        <Select
          label={t(copy.clinic.x1FilterPeriodLabel, locale)}
          value={filters.period}
          options={periodOptions}
          lang={locale}
          onChange={(e) => navigate({ ...filters, period: e.target.value as AuditPeriod })}
        />
      </div>

      {doseStatusFiltered && (
        <div data-testid="proof-moment-notice">
          <InlineNotice tone="info" title={t(copy.clinic.x1ProofNoticeTitle, locale)}>
            {proofBody}
          </InlineNotice>
        </div>
      )}

      {events.length === 0 ? (
        <EmptyState icon="inbox" title={t(copy.clinic.x1EmptyTitle, locale)} description={t(copy.clinic.x1EmptyBody, locale)} />
      ) : (
        <>
          <p className="jr-num type-body-small px-1 text-ink-muted">{interpolate(t(copy.clinic.x1CountTemplate, locale), { count })}</p>

          <div className="flex flex-col gap-5 @[900px]:hidden">
            {days.map((group) => (
              <section key={group.day} className="flex flex-col gap-2">
                <h2 className="jr-group-title">{formatDate(group.day, locale)}</h2>
                <div className="jr-group">
                  {group.rows.map((e) => (
                    <ActivityRow key={e.id} {...rowProps(e)} />
                  ))}
                </div>
              </section>
            ))}
          </div>

          <div className="jr-group hidden px-3 pb-2 @[900px]:block">
            <table className="w-full table-fixed border-collapse">
              <colgroup>
                <col className="w-[10%]" />
                <col className="w-[20%]" />
                <col className="w-[22%]" />
                <col className="w-[17%]" />
                <col className="w-[31%]" />
              </colgroup>
              <ActivityRow.Table
                columns={{
                  time: t(copy.clinic.x1ColumnTime, locale),
                  event: t(copy.clinic.x1ColumnEvent, locale),
                  actor: t(copy.clinic.x1ColumnActor, locale),
                  patient: t(copy.clinic.x1ColumnPatient, locale),
                  description: t(copy.clinic.x1ColumnDescription, locale),
                }}
              />
              {days.map((group) => (
                <tbody key={group.day}>
                  <tr>
                    <th scope="rowgroup" colSpan={5} className="jr-display type-body-strong px-2 pb-2 pt-4 text-start text-navy">
                      {formatDate(group.day, locale)}
                    </th>
                  </tr>
                  {group.rows.map((e) => (
                    <ActivityRow key={e.id} layout="table" {...rowProps(e)} />
                  ))}
                </tbody>
              ))}
            </table>
          </div>
        </>
      )}

      <p className="type-body-small px-1 text-ink-muted">{t(copy.clinic.x1ScopeNote, locale)}</p>
    </div>
  );
}

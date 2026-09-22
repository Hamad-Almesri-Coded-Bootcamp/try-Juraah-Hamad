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
 * label (`ActivityRow`'s `code` prop) — on this screen only.
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
import { Select, type SelectOption } from '@/components/ui/Select';
import { ActivityRow } from '@/components/ui/ActivityRow';
import { InlineNotice } from '@/components/ui/InlineNotice';
import { EmptyState } from '@/components/ui/EmptyState';
import { copy, t } from '@/i18n';
import { interpolate } from '@/features/shell/interpolate';
import { formatNumber } from '@/i18n/format';
import { actorLabel, auditTimestamp, eventTypeLabel, type AuditPeriod } from './format';
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
}: {
  events: AuditLogRow[];
  locale: Locale;
  filters: AuditFilters;
  basePath: string;
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
  const allAgentOrSystem = events.every((e) => e.actor.role === 'agent' || e.actor.role === 'system');

  // CR-038: the masked name the data layer computed, or the honest empty mark for a system-scoped
  // row that carries no patientId at all — never a blank cell, never a Civil ID.
  function patientRef(row: AuditLogRow) {
    if (row.patientMaskedName) return row.patientMaskedName;
    return row.patientId ? t(copy.vocabulary.empty, locale) : undefined;
  }

  return (
    <div className="@container flex flex-col gap-4 p-3 tablet:p-5">
      <div className="grid grid-cols-1 gap-3 tablet:grid-cols-3">
        <Select label={t(copy.clinic.x1FilterTypeLabel, locale)} value={filters.type ?? ''} options={typeOptions} lang={locale} onChange={(e) => navigate({ ...filters, type: e.target.value || undefined })} />
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
            {interpolate(t(copy.clinic.x1ProofNoticeBodyTemplate, locale), { count: formatNumber(events.length, locale) })}
            {!allAgentOrSystem && ` — ${t(copy.clinic.x1EmptyBody, locale)}`}
          </InlineNotice>
        </div>
      )}

      {events.length === 0 ? (
        <EmptyState icon="inbox" title={t(copy.clinic.x1EmptyTitle, locale)} description={t(copy.clinic.x1EmptyBody, locale)} />
      ) : (
        <>
          <div className="flex flex-col gap-2 @[900px]:hidden">
            {events.map((e) => (
              <ActivityRow
                key={e.id}
                title={eventTypeLabel(e.type, locale)}
                timeLabel={auditTimestamp(e.createdAt, locale)}
                description={e.message}
                actor={{ label: actorLabel(e.actor.role, locale), kind: e.actor.role }}
                code={e.actor.role}
                patientRef={patientRef(e)}
              />
            ))}
          </div>
          <div className="hidden @[900px]:block">
            <table className="w-full table-fixed border-collapse">
              <colgroup>
                <col className="w-[17%]" />
                <col className="w-[16%]" />
                <col className="w-[21%]" />
                <col className="w-[15%]" />
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
              <tbody>
                {events.map((e) => (
                  <ActivityRow
                    key={e.id}
                    layout="table"
                    title={eventTypeLabel(e.type, locale)}
                    timeLabel={auditTimestamp(e.createdAt, locale)}
                    description={e.message}
                    actor={{ label: actorLabel(e.actor.role, locale), kind: e.actor.role }}
                    code={e.actor.role}
                    patientRef={patientRef(e)}
                  />
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      <span className="type-caption">{t(copy.clinic.x1ScopeNote, locale)}</span>
    </div>
  );
}

/* Hallmark · scope: app (inside the locked design system, docs/design-system) · CR-115
 * pattern: profile row + stat strip in one grouped card · tone: utilitarian, clinical
 * enrichment: none · states: static read-only (no interactive element) */

/**
 * CR-115 — the clinic dashboard card, at the top of the review queues (G1s/G3s) and the audit log
 * (X1). One grouped card: the clinician's initials (no photo: the seed has none), their own name in
 * full (a person's own name is never masked), their clinic roles in words (rule 7, never the role
 * string), then a strip of counts the page hands in. Every count is real data the page already
 * read; this component derives nothing and reads no clock.
 *
 * `profile` is null when `getClinicianProfile` refuses (the Postgres helper of migration 0015 not
 * applied yet, or a session it does not serve): the card then shows the active role alone, never a
 * made-up name. Server-compatible: no hooks, no state, nothing clickable.
 *
 * Two components the design system lacks, composed here rather than added to `components/ui/` and
 * reported in DECISIONS.md CR-115: the person avatar (`jr-mono jr-avatar`, the standard 48px tile,
 * so the name keeps its width on a phone) and the
 * statistic tile (`jr-group` strip, `type-h2` + `jr-num`, `type-caption`).
 */
import { copy, t } from '@/i18n';
import { formatNumber } from '@/i18n/format';
import { localizePersonName, personInitials } from '@/i18n/localize';
import type { Locale } from '@/i18n/locale';
import type { ClinicianProfile } from '@/types/views';

export interface ClinicianStat {
  /** Stable key for React and for tests. */
  id: string;
  label: string;
  value: number;
}

export function ClinicianCard({
  profile,
  activeRole,
  stats,
  note,
  locale,
}: {
  profile: ClinicianProfile | null;
  /** The role this shell runs as, shown when no profile came back. */
  activeRole: 'reviewer' | 'admin';
  stats: ClinicianStat[];
  /** A caption under the strip, when the counts need their scope said. */
  note?: string;
  locale: Locale;
}) {
  const name = profile ? localizePersonName(profile.name, locale) : '';
  const roles = profile && profile.roles.length > 0 ? profile.roles : [activeRole];
  const rolesLabel = roles
    .map((r) => t(r === 'admin' ? copy.shell.clinicRoleAdmin : copy.shell.clinicRoleReviewer, locale))
    .join(' · ');
  const initials = name ? personInitials(name) : '';

  return (
    <section aria-label={t(copy.clinic.dashProfileLabel, locale)} className="@container jr-group" data-testid="clinician-card">
      <div className="flex items-center gap-3 p-4">
        {initials ? (
          <span className="jr-mono jr-avatar" aria-hidden="true" dir="auto">
            {initials}
          </span>
        ) : null}
        <div className="flex min-w-0 flex-col gap-1">
          {name ? <p className="type-h2 [overflow-wrap:break-word] text-navy">{name}</p> : null}
          <p className={name ? 'type-body-small text-ink-muted' : 'type-h2 text-navy'}>{rolesLabel}</p>
        </div>
      </div>
      {stats.length > 0 ? (
        <dl
          aria-label={t(copy.clinic.dashStatsLabel, locale)}
          // Two columns on a phone (an odd last tile spans both), one row from 560px of card width.
          className={[
            'grid grid-cols-2 gap-px border-t border-border bg-border [&>:last-child:nth-child(odd)]:col-span-2 @[560px]:[&>:last-child:nth-child(odd)]:col-span-1',
            stats.length === 3 ? '@[560px]:grid-cols-3' : '@[560px]:grid-cols-4',
          ].join(' ')}
        >
          {stats.map((stat) => (
            // Label first in the reading order, the number drawn on top (flex-col-reverse).
            <div key={stat.id} data-stat={stat.id} className="flex min-w-0 flex-col-reverse justify-end gap-1 bg-surface-card px-4 py-3">
              <dt className="type-caption text-ink-muted">{stat.label}</dt>
              <dd className="jr-num type-h2 text-navy">{formatNumber(stat.value, locale)}</dd>
            </div>
          ))}
        </dl>
      ) : null}
      {note ? <p className="type-caption border-t border-border px-4 py-2 text-ink-muted">{note}</p> : null}
    </section>
  );
}

import type * as React from 'react';
import Link from 'next/link';
import { Icon, type IconName } from './Icon';
import type { AuditEvent } from '@/types/contracts';

export type ActorKind = AuditEvent['actor']['role'];

const ICON_BY_ACTOR_KIND: Record<ActorKind, IconName> = {
  patient: 'users',
  caregiver: 'users',
  reviewer: 'review',
  admin: 'settings',
  agent: 'refresh',
  system: 'settings',
};

export interface ActivityRowActor {
  /** The human word from the vocabulary — never the literal role string. */
  label: string;
  /** Picks the glyph only; never rendered as text itself. */
  kind: ActorKind;
}

export interface ActivityRowProps {
  title: React.ReactNode;
  /** Already-formatted timestamp. */
  timeLabel: React.ReactNode;
  description?: React.ReactNode;
  /** A link to the thing this event happened to. The only affordance this row ever offers. */
  href?: string;
  actor?: ActivityRowActor;
  /**
   * The literal AuditEvent.actor.role string, shown beside the human label. X1 (the admin audit
   * log) is the one surface allowed to display it (CR-010); every other screen passes nothing here.
   */
  code?: string;
  /** A masked name — never a component of its own, per lib/format/maskedName (CR-021). */
  patientRef?: React.ReactNode;
  /** 'table' renders a <tr> for the audit log at 1440 — pair with ActivityRow.Table for the header. */
  layout?: 'list' | 'table';
  className?: string;
}

/**
 * One logged event, serving both the patient's activity feed and the admin audit log (Build Prompts
 * prompt 1). Read-only by contract: it names what happened, when, and — via `href` — where to look,
 * and offers nothing else.
 */
export function ActivityRow({ title, timeLabel, description, href, actor, code, patientRef, layout = 'list', className }: ActivityRowProps) {
  const actorNode = actor ? (
    <>
      {actor.label}
      {code ? <span className="jr-activity-row__code"> ({code})</span> : null}
    </>
  ) : null;

  if (layout === 'table') {
    const classes = ['jr-activity-row--table', className].filter(Boolean).join(' ');
    return (
      <tr className={classes}>
        <td className="jr-activity-row__cell type-body-small">
          <bdi>{timeLabel}</bdi>
        </td>
        <td className="jr-activity-row__cell type-body-small">{href ? <Link href={href}>{title}</Link> : title}</td>
        <td className="jr-activity-row__cell type-body-small">
          {actor ? (
            <span className="jr-activity-row__actor">
              <Icon name={ICON_BY_ACTOR_KIND[actor.kind]} small />
              {actorNode}
            </span>
          ) : null}
        </td>
        <td className="jr-activity-row__cell type-body-small">{patientRef}</td>
        <td className="jr-activity-row__cell jr-activity-row__cell--muted type-body-small">{description}</td>
      </tr>
    );
  }

  const classes = ['jr-activity-row', className].filter(Boolean).join(' ');
  const content = (
    <>
      {actor ? <Icon name={ICON_BY_ACTOR_KIND[actor.kind]} className="jr-activity-row__icon" /> : null}
      <span className="jr-activity-row__body">
        <span className="jr-activity-row__title type-body">{title}</span>
        {description ? <span className="jr-activity-row__desc type-body-small">{description}</span> : null}
        {actor || patientRef ? (
          <span className="jr-activity-row__meta type-caption">
            {actorNode}
            {actor && patientRef ? <span> · </span> : null}
            {patientRef}
          </span>
        ) : null}
        <span className="jr-activity-row__time type-caption">{timeLabel}</span>
      </span>
    </>
  );

  if (href) {
    return (
      <Link href={href} className={`${classes} wsf-focus`}>
        {content}
      </Link>
    );
  }
  return <div className={classes}>{content}</div>;
}

export interface ActivityRowTableColumns {
  time: React.ReactNode;
  event: React.ReactNode;
  actor: React.ReactNode;
  patient: React.ReactNode;
  description: React.ReactNode;
}

/** The header row for ActivityRow's `layout="table"` — a `<thead>` sized to sit above it. */
ActivityRow.Table = function ActivityRowTable({ columns, className }: { columns: ActivityRowTableColumns; className?: string }) {
  const classes = ['jr-activity-row-table', className].filter(Boolean).join(' ');
  return (
    <thead className={classes}>
      <tr>
        <th className="jr-activity-row__head type-label" scope="col">
          {columns.time}
        </th>
        <th className="jr-activity-row__head type-label" scope="col">
          {columns.event}
        </th>
        <th className="jr-activity-row__head type-label" scope="col">
          {columns.actor}
        </th>
        <th className="jr-activity-row__head type-label" scope="col">
          {columns.patient}
        </th>
        <th className="jr-activity-row__head type-label" scope="col">
          {columns.description}
        </th>
      </tr>
    </thead>
  );
};

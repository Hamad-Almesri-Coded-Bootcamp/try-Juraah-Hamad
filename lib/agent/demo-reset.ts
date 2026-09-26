/**
 * CR-109 — the owner's demo reset, the pure half. Which of pt-03's doses go back to the un-recorded
 * state, and which evening dose moves to the demo time. Never asserts a recorded word for a dose and
 * never touches the database or the clock; lib/data/pg/demo-reset.ts runs this plan in two
 * transactions (the grant split, D-025: un-record as the agent, move as the system actor).
 *
 * Guard 4: the un-recorded word lives in the one constant below, compared with `!==`/`===` only —
 * never written as an object literal, and this file's SQL twin writes it only in a `set` clause,
 * never as an alias-qualified equality (a plain regex scan cannot tell SQL `=` from a JS assignment).
 */
import { addDays, dateOf, toKuwaitIso } from '@/lib/schedule/dates';

/** pt-03 only, and only the rx-009 21:00 dose moves — a named constant, never a request field. */
export const DEMO_RESET = {
  patientId: 'pt-03',
  evening: { prescriptionId: 'rx-009', from: '21:00', to: '19:30' },
} as const;

/** The one word every dose in scope is compared against. */
const UNRECORDED = 'upcoming';

/** A Kuwait-offset instant, exactly as iso_kw() prints it: YYYY-MM-DDTHH:mm:ss+03:00. */
const KUWAIT_ISO = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\+03:00$/;

export interface DemoDose {
  id: string;
  prescriptionId: string;
  patientId: string;
  scheduledAt: string;
  status: string;
}

export interface DemoMove { id: string; from: string; to: string; fromAt: string; toAt: string }
export interface DemoUnrecord { id: string; kuwaitTime: string; was: string }
export interface DemoResetPlan { moved: DemoMove[]; reset: DemoUnrecord[] }

export interface DemoResetResult {
  patientId: string;
  dates: string[];
  moved: Array<{ id: string; from: string; to: string }>;
  reset: DemoUnrecord[];
}

/** Today and tomorrow on the Kuwait calendar. The caller passes kuwaitToday() (rule 9) — this function reads no clock itself. */
export function demoResetDates(today: string): [string, string] {
  return [today, addDays(today, 1)];
}

/**
 * Pure planning over a snapshot of doses: which go back to un-recorded, which evening dose moves.
 * A row whose scheduledAt is not a real Kuwait instant is left out (fail closed) — never guessed.
 * Called twice by lib/data/pg/demo-reset.ts, against two different snapshots (see its header):
 * `reset` from the state before any write, `moved` from the state after the un-record has committed
 * — which is how a dose recorded at 21:00 can be freed and moved by the same press.
 */
export function planDemoReset(doses: readonly DemoDose[], dates: readonly string[]): DemoResetPlan {
  const inScope = doses.filter(
    (d) => d.patientId === DEMO_RESET.patientId && KUWAIT_ISO.test(d.scheduledAt) && dates.includes(dateOf(d.scheduledAt)),
  );

  const reset: DemoUnrecord[] = inScope
    .filter((d) => d.status !== UNRECORDED)
    .map((d) => ({ id: d.id, kuwaitTime: d.scheduledAt.slice(11, 16), was: d.status }));

  const { prescriptionId, from, to } = DEMO_RESET.evening;
  const moved: DemoMove[] = inScope
    .filter((d) => d.prescriptionId === prescriptionId && d.status === UNRECORDED && d.scheduledAt === toKuwaitIso(dateOf(d.scheduledAt), from))
    .map((d) => ({ id: d.id, from, to, fromAt: d.scheduledAt, toAt: toKuwaitIso(dateOf(d.scheduledAt), to) }));

  return { moved, reset };
}

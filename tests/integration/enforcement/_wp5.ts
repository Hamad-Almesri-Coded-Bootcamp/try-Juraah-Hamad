/**
 * P2-WP5 — helpers shared by the write-path enforcement files (settings · identity · invitation ·
 * role · client) and tests/integration/roundtrip/writes.test.ts. Not a test file.
 *
 * The seam functions run straight from lib/data/pg/writes.ts in script context: `as(session, fn)`
 * sets the TRUSTED raw script session (lib/session/cookie.ts setScriptSession) that print-shapes
 * uses, so every call goes through the real withSession() → jurah_app + RLS + the guard triggers.
 * `owner(query)` reads the database as the owner (no RLS) — the "row unchanged" half of each proof.
 * `reseed()` restores the seeded state: seam writes COMMIT, and audit_events is append-only.
 */
import { getSql, databaseUrl } from '@/lib/db/client';
import { setScriptSession } from '@/lib/session/cookie';
import { runSeed } from '../../../scripts/db/seed';
import type { Session } from '@/types/views';

export const HAMAD: Session = { subjectId: 'pt-01', role: 'patient' };
export const FATIMA: Session = { subjectId: 'pt-02', role: 'patient' };
export const SARA: Session = { subjectId: 'pt-03', role: 'patient' };
export const BADR: Session = { subjectId: 'pt-04', role: 'patient' };
export const ABDULLAH: Session = { subjectId: 'cg-01', role: 'caregiver', linkedPatientId: 'pt-01' };
export const SARA_CG: Session = { subjectId: 'cg-02', role: 'caregiver', linkedPatientId: 'pt-01' };
export const NASER_PENDING: Session = { subjectId: 'cg-03', pendingInvitationOnly: true };
export const NASER_ACTIVE: Session = { subjectId: 'cg-03', role: 'caregiver', linkedPatientId: 'pt-01' };
export const KHALID: Session = { subjectId: 'acc-10', role: 'reviewer' };
export const DANA: Session = { subjectId: 'acc-11', role: 'admin' };
export const NOW = '2026-09-21T09:15:00+03:00';

export async function as<T>(s: Session | null, fn: () => Promise<T>): Promise<T> {
  setScriptSession(s);
  return fn();
}

export async function asJson(s: Session | null, fn: () => Promise<unknown>): Promise<string> {
  const v = await as(s, fn);
  return v === undefined ? 'undefined' : JSON.stringify(v);
}

/** First column of the first row, read as the owner (RLS does not bind it). */
export async function owner<T = unknown>(query: string): Promise<T> {
  const [row] = await getSql().unsafe(query);
  return (row ? Object.values(row)[0] : undefined) as T;
}

export const count = (query: string) => owner<number>(`select count(*)::int from (${query}) q`);

/** A fingerprint of every table a write could touch — "before = after" for a refused call. */
export function fingerprint(): Promise<string> {
  return owner<string>(`select md5(string_agg(t, '|' order by t)) from (
    select 'c:' || row(c.*)::text t from caregivers c union all select 's:' || row(s.*)::text from settings s
    union all select 'r:' || row(r.*)::text from refill_requests r union all select 'p:' || row(p.*)::text from patients p
    union all select 'rx:' || row(x.*)::text from prescriptions x union all select 'a:' || row(a.*)::text from interaction_alerts a
    union all select 'e:' || id from audit_events union all select 'd:' || id || status::text from doses
    union all select 'ss:' || id || coalesce(revoked_at::text, '') from sessions) q`);
}

export async function reseed(): Promise<void> {
  if (databaseUrl()) await runSeed(getSql());
}

/** Every audit message written since the seed (the live rows), for the \d{12} scan. */
export const liveMessages = () => getSql()`select message from audit_events where id !~ '^ae-[0-9]{3}$' order by seq`;

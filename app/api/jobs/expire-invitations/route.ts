/**
 * POST /api/jobs/expire-invitations — the invitation-expiry job (API-SURFACE §B, P2-WP6).
 *
 * Auth: `Authorization: Bearer <JURAH_JOB_TOKEN>`, compared in constant time. An unset token
 * refuses every caller (401) — the job is never open. Runs as the system actor at the frozen
 * clock (REFERENCE_NOW, D-021): every `pending` row whose `expires_at` has passed becomes
 * `expired`, one `caregiver_invite_expired` audit row each, one `job_runs` row per run. The read
 * paths already treat a stale `pending` as expired, so this is the second enforcement, never the
 * only one. It touches the caregivers table only — there is no dose job of any kind (E-03).
 *
 * The work itself is WP4b's lib/engine/expiry.ts (called through lib/data/pg/channels.ts).
 *
 *   401 no/bad token · 200 `{ expired: <count> }` · 503 under the mock backend (no job store).
 */
import { timingSafeEqual } from 'node:crypto';
import { JOB_TOKEN, kuwaitNow } from '@/lib/config';
import { selectedBackend } from '@/lib/db/client';
import { runInvitationExpiryJob } from '@/lib/data/pg/channels';

function bearerMatches(header: string | null, expected: string): boolean {
  if (!expected || !header) return false;
  const m = /^Bearer (.+)$/.exec(header);
  if (!m?.[1]) return false;
  const a = Buffer.from(m[1], 'utf8');
  const b = Buffer.from(expected, 'utf8');
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function POST(request: Request): Promise<Response> {
  if (!bearerMatches(request.headers.get('authorization'), JOB_TOKEN)) return Response.json({ error: 'unauthorized' }, { status: 401 });
  if (selectedBackend() !== 'postgres') return Response.json({ error: 'unavailable' }, { status: 503 });
  const expired = await runInvitationExpiryJob(kuwaitNow());
  if (!expired) return Response.json({ error: 'invalid_clock' }, { status: 500 });
  return Response.json({ expired: expired.length });
}

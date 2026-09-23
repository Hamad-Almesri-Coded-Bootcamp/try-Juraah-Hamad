/**
 * GET /api/calendar/{token}.ics — the patient's dose calendar (API-SURFACE §B, P2-WP6).
 *
 * The token in the path is the only credential (calendar_subscriptions.token, the patient's own
 * secret, issued by enableCalendarSync). The feed is rebuilt from the database on every read, so
 * "regenerated when doses change" holds by construction; the ETag is a hash of the exact bytes.
 *
 * GET is the ONLY exported method: the feed accepts no write-back, so Next answers 405 (with an
 * Allow header) to PUT, POST, PATCH and DELETE before any code here runs (E-46).
 *
 * The mock backend has no calendar feed (the seam's mock never served one): with
 * JURAH_DATA_BACKEND=mock this answers 503, never a fabricated feed.
 */
import { createHash } from 'node:crypto';
import type { NextRequest } from 'next/server';
import { REFERENCE_NOW } from '@/lib/config';
import { selectedBackend } from '@/lib/db/client';
import { calendarFeedForToken } from '@/lib/data/pg/channels';
import { buildIcs } from '@/lib/calendar/ics';

export async function GET(request: NextRequest, { params }: { params: Promise<{ token: string }> }): Promise<Response> {
  const { token: segment } = await params;
  if (!segment.endsWith('.ics')) return new Response(null, { status: 404 });
  if (selectedBackend() !== 'postgres') return new Response(null, { status: 503 });
  const doses = await calendarFeedForToken(segment.slice(0, -'.ics'.length));
  if (!doses) return new Response(null, { status: 404 });

  const body = buildIcs(doses, REFERENCE_NOW);
  const etag = `"${createHash('sha256').update(body, 'utf8').digest('hex').slice(0, 32)}"`;
  const headers = {
    'content-type': 'text/calendar; charset=utf-8',
    'cache-control': 'private, no-cache',
    etag,
  };
  if (request.headers.get('if-none-match') === etag) return new Response(null, { status: 304, headers });
  return new Response(body, { status: 200, headers });
}

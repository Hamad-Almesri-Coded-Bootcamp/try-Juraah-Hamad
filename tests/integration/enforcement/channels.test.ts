/**
 * P2-WP6 enforcement — the ENFORCEMENT.md `push` and `channel` rows plus E-38: E-06, E-07, E-08,
 * E-38, E-43, E-44, E-45, E-46, E-47. Each test is titled by its row id and carries the DB-level
 * proof AND the unchanged seam shape (D-022). Where part of a row belongs to another package's
 * route (E-06's /api/agent/alerts, E-07's /api/agent/alert-recipients — WP7) the test says so and
 * asserts the half this package owns; nothing is skipped.
 *
 * Mutating tests commit (the seam functions run their own transactions); the harness re-seeds
 * per file (setup.ts), and every test here restores what it changed or reads only its own rows.
 * Without JURAH_DATABASE_URL every test FAILS loudly (NOT A PASS) — never skipped.
 * E-08 calls eleven reads owned by WP3a–d by name: until each is implemented it fails loudly on
 * notImplemented(), never passes. The seam calls rely on lib/session/cookie's setScriptSession
 * surviving WP2's signed-cookie rewrite (typecheck proves the export, not its behaviour).
 */
import { describe, expect, it } from 'vitest';
import { getSql } from '@/lib/db/client';
import { setScriptSession } from '@/lib/session/cookie';
import * as pg from '@/lib/data/pg';
import {
  activeCaregiverRecipients,
  connectMessagingLinkByToken,
  disconnectMessaging,
  sendTestNotification,
  startMessagingLink,
} from '@/lib/data/pg/channels';
import { startMessagingLinkRefusal } from '@/lib/data/refusals/channels';
import { buildPushPayload } from '@/lib/push/send';
import { run as secretGuard } from '../../../scripts/guards/no-secrets';
import { app, rejects, S } from '../helpers';
import type { Session } from '@/types/views';

const sess = (s: Record<string, unknown>): Session => {
  const { civilId: _c, ...rest } = s;
  void _c;
  return rest as unknown as Session;
};
const HAMAD = sess(S.hamad);
const FATIMA = sess(S.fatima);
const SARA = sess(S.sara);
const ABDULLAH = sess(S.abdullah);

async function dosesDigest(): Promise<string> {
  const [r] = await getSql()`select count(*)::int as n, md5(string_agg(d::text, ',' order by d.id)) as h from doses d`;
  return `${r?.n}:${r?.h}`;
}
async function count(table: string, where = 'true'): Promise<number> {
  const [r] = await getSql().unsafe(`select count(*)::int as n from ${table} where ${where}`);
  return Number(r?.n);
}

describe('push — G12', () => {
  it('E-06 — no push payload carries an action', async () => {
    // Unit half (also tests/unit/push/payload.test.ts): the one builder strips actions/data.actions.
    const p = buildPushPayload(JSON.parse('{"title":"t","body":"b","url":"/ar/app","actions":[{"action":"take"}],"data":{"actions":[1]}}'));
    expect(Object.keys(p ?? {})).toEqual(['title', 'body', 'url']);
    // Seam half: sendTestNotification as سارة (active/granted, no browser subscription attached —
    // D-13) sends nothing, returns undefined, and changes no row.
    setScriptSession(SARA);
    const before = await count('push_subscriptions', "endpoint is not null");
    expect(await sendTestNotification({ subjectType: 'patient', subjectId: 'pt-03' })).toBeUndefined();
    expect(await count('push_subscriptions', "endpoint is not null")).toBe(before);
    // Route half — POST /api/agent/alerts' notification template — is WP7's (app/api/agent/**).
  });

  it('E-07 — nothing is sent to a caregiver whose invitation is not active', async () => {
    // The recipient query this package provides for WP7's alert-recipients route.
    expect(await activeCaregiverRecipients('pt-01')).toEqual(['cg-01', 'cg-02']);
    const [row] = await getSql()`select array_agg(id order by seq) as ids from caregivers where linked_patient_id = 'pt-01' and status <> 'active'`;
    expect(row?.ids).toEqual(['cg-03', 'cg-04', 'cg-05', 'cg-06', 'cg-07']);
    // The HTTP half (GET /api/agent/alert-recipients?patientId=pt-01) is WP7's route.
  });

  it('E-08 — a denied or revoked subscription blocks no feature', async () => {
    const [p] = await getSql()`select permission::text as permission from push_subscriptions where subject_id = 'pt-02'`;
    expect(p?.permission).toBe('denied');
    const reads = async () => {
      setScriptSession(FATIMA);
      return JSON.stringify([
        await pg.getPatient('pt-02'), await pg.getSettings('pt-02'), await pg.getPrescriptions('pt-02'),
        await pg.getDosesForDay('pt-02', '2026-09-21'), await pg.getAlerts('pt-02'), await pg.getRefillOverview('pt-02'),
        await pg.getRefillRequests('pt-02'), await pg.getActivity('pt-02'), await pg.getCaregivers('pt-02'),
        await pg.getMessagingLink({ subjectType: 'patient', subjectId: 'pt-02' }), await pg.getPushCapability(),
      ]);
    };
    const denied = await reads();
    await getSql()`update push_subscriptions set permission = 'granted', status = 'active' where subject_id = 'pt-02'`;
    try {
      expect(await reads()).toBe(denied);
    } finally {
      await getSql()`update push_subscriptions set permission = 'denied' where subject_id = 'pt-02'`;
    }
  });
});

describe('channels — the messaging link, the feed, the secrets', () => {
  it('E-38 — no client supplies a chatId', async () => {
    // The seam signature has no such field; an extra property is ignored and never stored.
    setScriptSession(ABDULLAH);
    const link = await startMessagingLink({ subjectType: 'caregiver', subjectId: 'cg-01', chatId: 'client-chat' } as never);
    expect(link.status).toBe('pending');
    expect(Object.keys(link)).toEqual(['id', 'subjectType', 'subjectId', 'channel', 'status', 'linkToken']);
    const [row] = await getSql()`select chat_id from messaging_links where id = ${link.id}`;
    expect(row?.chat_id).toBeNull();
    // Only the webhook path (role system) may set it.
    await rejects(app(S.abdullah), `update messaging_links set chat_id = 'x' where id = 'ml-04'`, 'link_chat_id_server_only');
  });

  it('E-43 — the link token is single-use, expiring, and binds one subject', async () => {
    setScriptSession(HAMAD);
    const link = await startMessagingLink({ subjectType: 'patient', subjectId: 'pt-01' });
    expect(link.status).toBe('pending');
    expect(link.linkToken).toMatch(/^[A-Za-z0-9_-]{43}$/);
    const others = async () => (await getSql()`select md5(string_agg(m::text, ',' order by m.id)) as h from messaging_links m where m.id <> ${link.id}`)[0]?.h;
    const othersBefore = await others();
    const audit0 = await count('audit_events', "type = 'messaging_connected'");
    expect(await connectMessagingLinkByToken(link.linkToken!, '111')).toBe(true);
    expect(await count('audit_events', "type = 'messaging_connected'")).toBe(audit0 + 1);
    const [connected] = await getSql()`select status::text as status, link_token from messaging_links where id = ${link.id}`;
    expect(connected).toEqual({ status: 'connected', link_token: null });
    expect(await others()).toBe(othersBefore); // the row it connects is the row that minted it
    // used a second time (even from another chat) → no write
    expect(await connectMessagingLinkByToken(link.linkToken!, '222')).toBe(false);
    expect(await count('audit_events', "type = 'messaging_connected'")).toBe(audit0 + 1);
    // expired → no write
    setScriptSession(FATIMA);
    const late = await startMessagingLink({ subjectType: 'patient', subjectId: 'pt-02' });
    await getSql()`update messaging_links set token_expires_at = timestamptz '2026-09-21T09:00:00+03:00' where id = ${late.id}`;
    expect(await connectMessagingLinkByToken(late.linkToken!, '333')).toBe(false);
    expect((await getSql()`select status::text as s from messaging_links where id = ${late.id}`)[0]?.s).toBe('pending');
    // an unknown token → no write
    expect(await connectMessagingLinkByToken('no-such-token', '444')).toBe(false);
    expect(await count('audit_events', "type = 'messaging_connected'")).toBe(audit0 + 1);
  });

  it('E-44 — a caregiver’s link cannot be created unless active', async () => {
    await rejects(app(S.naserPending), `insert into messaging_links (id, subject_type, subject_id, status) values ('lx', 'caregiver', 'cg-03', 'not_connected')`, 'link_caregiver_must_be_active');
    const before = await count('messaging_links');
    const forged = sess(S.naserForgedCaregiver);
    setScriptSession(forged);
    const out = await startMessagingLink({ subjectType: 'caregiver', subjectId: 'cg-03' });
    expect(JSON.stringify(out)).toBe(JSON.stringify(startMessagingLinkRefusal({ subjectType: 'caregiver', subjectId: 'cg-03' })));
    expect(await count('messaging_links')).toBe(before);
  });

  it('E-45 — the bot token and VAPID private key are server-side secrets', () => {
    const r = secretGuard();
    expect(r.violations).toEqual([]);
    expect(r.notes?.join('\n')).toMatch(/\.env\.local present/);
  });

  it('E-46 — the ICS feed accepts no write-back', async () => {
    // Next answers 405 (Allow: GET) for any method the route file does not export — proved by curl
    // against `next dev` in docs/backend-notes/p2-wp6.md. The half a test can see: GET alone exists.
    const mod = await import('@/app/api/calendar/[token]/route');
    expect(Object.keys(mod)).toEqual(['GET']);
  });

  it('E-47 — disconnect touches no Dose', async () => {
    const before = await dosesDigest();
    const audit0 = await count('audit_events', "patient_id = 'pt-03'");
    setScriptSession(SARA);
    expect(await disconnectMessaging({ subjectType: 'patient', subjectId: 'pt-03' })).toBeUndefined();
    expect(await dosesDigest()).toBe(before);
    const [link] = await getSql()`select status::text as status, link_token from messaging_links where id = 'ml-03'`;
    expect(link).toEqual({ status: 'not_connected', link_token: null });
    const [st] = await getSql()`select adherence_check_in_enabled as on from settings where patient_id = 'pt-03'`;
    expect(st?.on).toBe(false);
    const rows = await getSql()`select type::text as type, actor_role::text as actor from audit_events where patient_id = 'pt-03' order by seq desc limit 2`;
    expect(rows.map((r) => `${r.type}/${r.actor}`)).toEqual(['messaging_disconnected/patient', 'tracking_disabled/system']);
    expect(await count('audit_events', "patient_id = 'pt-03'")).toBe(audit0 + 2);
  });
});

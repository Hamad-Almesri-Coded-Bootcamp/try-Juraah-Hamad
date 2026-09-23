'use server';
/**
 * The MOCK session implementation (D-020): the Phase 1 body of lib/session/index.ts, moved here
 * verbatim by P2-WP1 — lib/session/index.ts is now a dispatcher on JURAH_DATA_BACKEND.
 *
 * The session module ('use server'), wrapping `resolve.ts` with the cookie (docs/briefs/WP1.md
 * §2/§5). This is the ONLY place a `Session` is read from or written to the mock cookie.
 *
 * Mock shortcut (docs/backend-notes/wp1.md §2): for a `multiple_roles` outcome, `signIn` also
 * writes a session for the FIRST role option as the immediate default, so `getSession` and
 * `getRoleOptions` are well-defined the instant A1b renders — the UI still receives every option
 * in the outcome itself and `chooseRole` overwrites the default when the user picks the other one.
 * ROLES.md's "remembers the last choice as the default" is not persisted across sign-outs in this
 * memory-only mock; Phase 2 must persist the last choice per Account.
 */
import { REFERENCE_NOW } from '@/lib/config';
import { getStore } from '@/lib/data/mock/store';
import { civilIdForSession } from '@/lib/data/mock/accounts';
import { resolveCivilId, roleOptionsFor, sessionForOption } from './resolve';
import { readSessionCookie, writeSessionCookie, clearSessionCookie } from './cookie';
import { append } from '@/lib/data/mock/audit';
import type { SessionApi } from './api';
import type { RoleOption, Session } from '@/types/views';

function patientIdForSession(session: Session): string | undefined {
  if (session.role === 'patient') return session.subjectId;
  if (session.role === 'caregiver') return session.linkedPatientId;
  return undefined;
}

export const signIn: SessionApi['signIn'] = async (civilId) => {
  const store = getStore();
  const outcome = resolveCivilId(civilId, store, REFERENCE_NOW);

  if (outcome.kind === 'single_role') {
    await writeSessionCookie(outcome.session);
    append(store, {
      scope: patientIdForSession(outcome.session) ? 'patient' : 'system',
      patientId: patientIdForSession(outcome.session),
      actor: { role: outcome.session.role ?? 'system', id: outcome.session.subjectId },
      type: 'signed_in', message: 'دخول عن طريق هويّاتي', createdAt: REFERENCE_NOW,
      relatedId: outcome.session.subjectId,
    });
  } else if (outcome.kind === 'multiple_roles') {
    const first = outcome.options[0];
    if (first) await writeSessionCookie(sessionForOption(first));
  } else if (outcome.kind === 'pending_invitation_only') {
    await writeSessionCookie({ subjectId: outcome.invitationId, pendingInvitationOnly: true });
  }

  return outcome;
};

export const getSession: SessionApi['getSession'] = async () => readSessionCookie();

export const getRoleOptions: SessionApi['getRoleOptions'] = async () => {
  const session = await readSessionCookie();
  if (!session) return [];
  const civilId = civilIdForSession(getStore(), session);
  if (!civilId) return [];
  return roleOptionsFor(getStore(), civilId);
};

export const chooseRole: SessionApi['chooseRole'] = async (option: RoleOption) => {
  const session = sessionForOption(option);
  await writeSessionCookie(session);
  return session;
};

export const signOut: SessionApi['signOut'] = async () => {
  const session = await readSessionCookie();
  if (session) {
    const store = getStore();
    const patientId = patientIdForSession(session);
    append(store, {
      scope: patientId ? 'patient' : 'system', patientId,
      actor: { role: session.role ?? 'system', id: session.subjectId },
      type: 'signed_out', message: 'خروج', createdAt: REFERENCE_NOW, relatedId: session.subjectId,
    });
  }
  await clearSessionCookie();
};

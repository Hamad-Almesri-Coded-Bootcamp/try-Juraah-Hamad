/**
 * Test-only session cookies for the role walks (verification 11 and 12). The MOCK session is a plain
 * JSON cookie (D-005): `{ subjectId, role, linkedPatientId?, pendingInvitationOnly? }`, URI-encoded,
 * httpOnly, SameSite=Lax, path "/". It never carries a Civil ID. WP1's session module reads exactly this
 * shape; Phase 2 replaces it with a server-issued session and this helper goes with it.
 * Subject ids follow the seed's cast order (D-005): pt-01 حمد · pt-02 فاطمة · pt-03 سارة · pt-04 بدر;
 * caregivers cg-01..cg-08 in the seed table's order.
 */
import { SESSION_COOKIE } from '../../../lib/config';

export type TestSession = {
  subjectId: string;
  role: 'patient' | 'caregiver' | 'reviewer' | 'admin';
  linkedPatientId?: string;
  pendingInvitationOnly?: true;
};

export const TEST_SESSIONS = {
  hamad: { subjectId: 'pt-01', role: 'patient' },
  fatima: { subjectId: 'pt-02', role: 'patient' },
  sara_patient: { subjectId: 'pt-03', role: 'patient' },
  sara_caregiver: { subjectId: 'cg-02', role: 'caregiver', linkedPatientId: 'pt-01' },
  badr: { subjectId: 'pt-04', role: 'patient' },
  abdullah: { subjectId: 'cg-01', role: 'caregiver', linkedPatientId: 'pt-01' },
  khalid_reviewer: { subjectId: 'acc-10', role: 'reviewer' },
  khalid_admin: { subjectId: 'acc-10', role: 'admin' },
  dana: { subjectId: 'acc-11', role: 'admin' },
} as const satisfies Record<string, TestSession>;

export function sessionCookieFor(who: keyof typeof TEST_SESSIONS, base: URL) {
  return {
    name: SESSION_COOKIE,
    value: encodeURIComponent(JSON.stringify(TEST_SESSIONS[who])),
    domain: base.hostname,
    path: '/',
    httpOnly: true,
    sameSite: 'Lax' as const,
  };
}

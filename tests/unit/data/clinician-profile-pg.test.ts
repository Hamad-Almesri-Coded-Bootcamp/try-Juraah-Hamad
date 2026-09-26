// @vitest-environment node
/**
 * CR-115 — the Postgres getClinicianProfile's one fallback, without a database: until migration
 * 0015 is applied, "function clinician_profile() does not exist" (SQLSTATE 42883) reads as the
 * refusal (null) so the dashboard card renders without a name; any other error, a 42883 raised for
 * some other function included, still throws.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';

const withSession = vi.fn();
vi.mock('@/lib/db/withSession', () => ({ withSession: (...a: unknown[]) => withSession(...a) }));
vi.mock('@/lib/data/pg/_shared', () => ({ sessionOf: async () => ({ subjectId: 'acc-10', role: 'reviewer' }) }));

const { getClinicianProfile } = await import('@/lib/data/pg/reads-clinic');

afterEach(() => withSession.mockReset());

const pgError = (code: string, message: string) => Object.assign(new Error(message), { code });

describe('pg getClinicianProfile — the missing-migration fallback', () => {
  it('the helper not applied yet → null', async () => {
    withSession.mockRejectedValue(pgError('42883', 'function clinician_profile() does not exist'));
    await expect(getClinicianProfile()).resolves.toBeNull();
  });

  it('a 42883 for another function still throws', async () => {
    withSession.mockRejectedValue(pgError('42883', 'function jurah_session_is(text) does not exist'));
    await expect(getClinicianProfile()).rejects.toThrow(/jurah_session_is/);
  });

  it('any other database error still throws', async () => {
    withSession.mockRejectedValue(pgError('57P01', 'terminating connection'));
    await expect(getClinicianProfile()).rejects.toThrow(/terminating/);
  });

  it('the helper applied → its jsonb projected; null from the helper → null', async () => {
    withSession.mockImplementation(async (_s: unknown, fn: (sql: unknown) => unknown) =>
      fn({ unsafe: async () => [{ profile: { name: 'x', roles: ['admin'], decisions: { confirmed: 0, cleared: 0, fieldsConfirmed: 0, fieldsReturned: 0 } } }] }),
    );
    await expect(getClinicianProfile()).resolves.toEqual({ name: 'x', roles: ['admin'], decisions: { confirmed: 0, cleared: 0, fieldsConfirmed: 0, fieldsReturned: 0 } });
    withSession.mockImplementation(async (_s: unknown, fn: (sql: unknown) => unknown) => fn({ unsafe: async () => [{ profile: null }] }));
    await expect(getClinicianProfile()).resolves.toBeNull();
  });
});

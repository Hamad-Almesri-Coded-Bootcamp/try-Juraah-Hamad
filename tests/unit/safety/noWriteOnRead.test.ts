/**
 * C2's non-negotiable invariant (docs/briefs/WP4e.md ACCEPTANCE / G1): opening `ia-001` never
 * transitions its state. Called against the PUBLIC seam (`@/lib/data`'s exported `getAlert`, the
 * same function the page calls — not just the internal mock helper), mirroring
 * `tests/unit/caregiving/acceptMovesToActive.test.ts`'s own pattern of proving a read-only claim
 * against the real data-access layer rather than the mock's private helpers.
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { getAlert } from '@/lib/data';
import { getStore, reset } from '@/lib/data/mock/store';
import { setScriptSession } from '@/lib/session/cookie';

beforeEach(() => reset());
afterEach(() => setScriptSession(null));

describe('getAlert(ia-001) — a read, twice, changes nothing', () => {
  it('returns an identical alert both times, still pending_medical_review', async () => {
    setScriptSession({ subjectId: 'pt-01', role: 'patient' });

    const first = await getAlert('ia-001');
    const second = await getAlert('ia-001');

    expect(first?.reviewStatus).toBe('pending_medical_review');
    expect(second).toEqual(first);
  });

  it('the store row itself is untouched by the read', async () => {
    setScriptSession({ subjectId: 'pt-01', role: 'patient' });
    const before = JSON.stringify(getStore().alerts.find((a) => a.id === 'ia-001'));

    await getAlert('ia-001');
    await getAlert('ia-001');

    const after = JSON.stringify(getStore().alerts.find((a) => a.id === 'ia-001'));
    expect(after).toBe(before);
  });

  it('no audit event of a review type is written by a patient session reading its own alert', async () => {
    setScriptSession({ subjectId: 'pt-01', role: 'patient' });
    const auditCountBefore = getStore().auditEvents.length;

    await getAlert('ia-001');

    const store = getStore();
    expect(store.auditEvents.length).toBe(auditCountBefore);
    expect(store.auditEvents.some((e) => e.type === 'alert_reviewed' && e.relatedId === 'ia-001')).toBe(false);
    // G1, restated for this route: no AuditEvent anywhere carries a patient actor for an alert write
    // (docs/Seed Dataset.md's own proof-moment claim), and this read added none.
    expect(store.auditEvents.some((e) => e.actor.role === 'patient' && e.type.startsWith('alert_'))).toBe(false);
  });
});

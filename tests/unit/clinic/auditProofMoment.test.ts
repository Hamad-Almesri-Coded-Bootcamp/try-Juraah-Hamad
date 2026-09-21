/**
 * X1's demo-critical proof moment (CLAUDE.md rule 1; the OBJECTIVE line of docs/briefs/WP4i.md),
 * proved directly against the PUBLIC seam (`@/lib/data`'s exported `getAuditLog`) rather than only
 * through the UI: filtered to `dose_status_recorded`, the log shows exactly سارة's five rows, and
 * every one of them is `agent` or `system` — never `patient`, `caregiver`, `reviewer` or `admin`,
 * because no interface path can write a dose status at all (docs/Seed Dataset.md: "no dose anywhere
 * in this dataset has `source: 'ui'`").
 */
import { beforeEach, describe, expect, it } from 'vitest';
import { getAuditLog } from '@/lib/data';
import { reset } from '@/lib/data/mock/store';
import { setScriptSession } from '@/lib/session/cookie';

beforeEach(() => {
  reset();
  setScriptSession({ subjectId: 'acc-11', role: 'admin' }); // م. دانة, admin-only
});

describe('getAuditLog filtered to dose_status_recorded — the proof moment', () => {
  it('returns exactly 5 rows, every one سارة’s, every actor agent or system', async () => {
    const rows = await getAuditLog({ type: 'dose_status_recorded' });
    expect(rows).toHaveLength(5);
    for (const row of rows) {
      expect(row.patientId).toBe('pt-03');
      expect(['agent', 'system']).toContain(row.actor.role);
      expect(row.actor.role).not.toBe('patient');
      expect(row.actor.role).not.toBe('caregiver');
      expect(row.actor.role).not.toBe('reviewer');
      expect(row.actor.role).not.toBe('admin');
    }
  });

  it('the full, unfiltered log DOES contain non-agent/non-system actors (so the filter is doing real work)', async () => {
    const all = await getAuditLog({});
    expect(all.some((e) => e.actor.role === 'patient' || e.actor.role === 'caregiver' || e.actor.role === 'reviewer')).toBe(true);
  });

  it('an admin session reads no clinical record: getAuditLog is metadata only (no medication list, alert text or dose detail keys)', async () => {
    const rows = await getAuditLog({ type: 'dose_status_recorded' });
    for (const row of rows) {
      // CR-038 (lead, wave-2 gate): rows may additionally carry the patient's MASKED name —
      // CR-010's owner answer for X1's patient reference; a name is not clinical data. Nothing
      // else may appear: no medication list, alert text, dose detail or Civil ID.
      const keys = Object.keys(row).sort();
      const base = ['actor', 'createdAt', 'id', 'patientId', 'relatedId', 'scope', 'type', 'message'];
      expect(keys).toEqual([...base, ...('patientMaskedName' in row ? ['patientMaskedName'] : [])].sort());
      if (row.patientMaskedName) expect(row.patientMaskedName).toMatch(/\*{3}/);
    }
  });

  it('a reviewer or patient session reads nothing from getAuditLog (admin-only)', async () => {
    setScriptSession({ subjectId: 'acc-10', role: 'reviewer' });
    expect(await getAuditLog({})).toEqual([]);
    setScriptSession({ subjectId: 'pt-01', role: 'patient' });
    expect(await getAuditLog({})).toEqual([]);
  });
});

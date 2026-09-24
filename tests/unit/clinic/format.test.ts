/**
 * The clinic's own formatting and form-reading rules (features/clinic/format.ts), asserted rather
 * than assumed (owner standard): the waiting time agrees with its number in Arabic, a reviewer typing
 * on an Arabic keyboard is read correctly, every data line reads in one language with no dash, and
 * X1's proof notice can only claim what the rows show.
 */
import { describe, expect, it } from 'vitest';
import { copy } from '@/i18n';
import { hasArabic, hasLatin } from '@/i18n/localize';
import { buildPrescriptions } from '@/lib/data/mock/seed';
import {
  groupByDay,
  normaliseTypedDigits,
  parseFieldDraft,
  prescriptionLine,
  proofNoticeKind,
  rxHeadline,
  waitedLabel,
  type FieldDraft,
} from '@/features/clinic/format';

const EM_DASH = /[—–]/;
const rx = new Map(buildPrescriptions().map((p) => [p.id, p] as const));

describe('waitedLabel: the plural form each number takes', () => {
  it('Arabic agrees with its number (no "منذ ٢ يوم")', () => {
    expect(waitedLabel(0, 'ar')).toBe(copy.clinic.g1sWaitedJustNow.ar);
    expect(waitedLabel(1, 'ar')).toBe('منذ دقيقة واحدة');
    expect(waitedLabel(2, 'ar')).toBe('منذ دقيقتين');
    expect(waitedLabel(5, 'ar')).toBe('منذ ٥ دقائق');
    expect(waitedLabel(11, 'ar')).toBe('منذ ١١ دقيقة');
    expect(waitedLabel(60, 'ar')).toBe('منذ ساعة واحدة');
    expect(waitedLabel(120, 'ar')).toBe('منذ ساعتين');
    expect(waitedLabel(180, 'ar')).toBe('منذ ٣ ساعات');
    expect(waitedLabel(60 * 24, 'ar')).toBe('منذ يوم واحد');
    // ia-001 has waited about 46 hours at REFERENCE_NOW: two days, in the dual.
    expect(waitedLabel(46 * 60, 'ar')).toBe('منذ يومين');
    expect(waitedLabel(3 * 24 * 60, 'ar')).toBe('منذ ٣ أيام');
    expect(waitedLabel(11 * 24 * 60, 'ar')).toBe('منذ ١١ يومًا');
    expect(waitedLabel(100 * 24 * 60, 'ar')).toBe('منذ ١٠٠ يوم');
  });

  it('English uses one and other', () => {
    expect(waitedLabel(1, 'en')).toBe('waiting 1 minute');
    expect(waitedLabel(5, 'en')).toBe('waiting 5 minutes');
    expect(waitedLabel(60, 'en')).toBe('waiting 1 hour');
    expect(waitedLabel(46 * 60, 'en')).toBe('waiting 2 days');
  });

  it('never an em dash, never the other script', () => {
    for (const minutes of [0, 1, 2, 7, 30, 59, 60, 90, 600, 1440, 2760, 20000, 200000]) {
      expect(EM_DASH.test(waitedLabel(minutes, 'ar'))).toBe(false);
      expect(hasLatin(waitedLabel(minutes, 'ar'))).toBe(false);
      expect(hasArabic(waitedLabel(minutes, 'en'))).toBe(false);
    }
  });
});

describe('prescription lines: brand first, one language, joined with a middle dot', () => {
  it('rxHeadline names the box first, in its own unit', () => {
    expect(rxHeadline(rx.get('rx-001')!, 'en')).toBe('Marevan 5 mg');
    expect(rxHeadline(rx.get('rx-001')!, 'ar')).toBe('ماريفان ٥ ملغم');
    expect(rxHeadline(rx.get('rx-008')!, 'en')).toBe('Eltroxin 50 mcg'); // never converted to mg
  });

  it('prescriptionLine carries no dash and no second script', () => {
    for (const p of rx.values()) {
      const ar = prescriptionLine(p, 'ar');
      const en = prescriptionLine(p, 'en');
      expect(EM_DASH.test(ar) || EM_DASH.test(en), p.id).toBe(false);
      expect(hasLatin(ar), `${p.id}: ${ar}`).toBe(false);
      expect(hasArabic(en), `${p.id}: ${en}`).toBe(false);
      expect(en).toContain(' · ');
    }
  });
});

describe('G3s: what a reviewer types is normalised before it is read', () => {
  const empty: FieldDraft = { brandName: '', strengthMg: '', frequencyPerDay: '', startDate: '', doseTimes: '' };

  it('Arabic-Indic digits and the Arabic comma become the stored form', () => {
    expect(normaliseTypedDigits('٠٨:٠٠، ٢٠:٠٠')).toBe('08:00, 20:00');
    expect(normaliseTypedDigits('۱۲:۳۰')).toBe('12:30');
    expect(normaliseTypedDigits('٢٫٥')).toBe('2.5');
    expect(normaliseTypedDigits('08:00, 20:00')).toBe('08:00, 20:00');
  });

  it('the helper line’s own example parses into two times (it used to split on "," only)', () => {
    const parsed = parseFieldDraft({ ...empty, doseTimes: '٠٨:٠٠، ٢٠:٠٠' });
    expect(parsed.errors).toEqual({});
    expect(parsed.values.doseTimes).toEqual(['08:00', '20:00']);
  });

  it('numbers and dates typed in Arabic digits are numbers and dates', () => {
    const parsed = parseFieldDraft({ ...empty, strengthMg: '٢٥٠', frequencyPerDay: '٢', startDate: '٢٠٢٦-٠٩-١٧' });
    expect(parsed.errors).toEqual({});
    expect(parsed.values).toEqual({ strengthMg: 250, frequencyPerDay: 2, startDate: '2026-09-17' });
  });

  it('a time without a leading zero is stored as HH:mm', () => {
    expect(parseFieldDraft({ ...empty, doseTimes: '8:00,20:00' }).values.doseTimes).toEqual(['08:00', '20:00']);
  });

  it('an empty field stays absent, and a value that cannot be read is reported, never stored', () => {
    expect(parseFieldDraft(empty)).toEqual({ values: {}, errors: {} });
    const bad = parseFieldDraft({ brandName: 'Cipro', strengthMg: 'abc', frequencyPerDay: '1.5', startDate: '17/09/2026', doseTimes: '8, 25:00' });
    expect(bad.errors).toEqual({ strengthMg: 'number', frequencyPerDay: 'number', startDate: 'date', doseTimes: 'times' });
    expect(bad.values).toEqual({ brandName: 'Cipro' });
  });
});

describe('X1', () => {
  const agent = { actor: { role: 'agent' as const, id: 'a' } };
  const system = { actor: { role: 'system' as const, id: 's' } };
  const patient = { actor: { role: 'patient' as const, id: 'p' } };

  it('the proof notice claims "all from the assistant or the system" only when that is what the rows show', () => {
    expect(proofNoticeKind([agent, system, agent], false)).toBe('all');
    expect(proofNoticeKind([agent, patient], false)).toBe('mixed');
    expect(proofNoticeKind([], false)).toBe('none');
    // An actor filter narrows the rows, so no claim about who recorded every dose status is made.
    expect(proofNoticeKind([agent], true)).toBe('filtered');
    expect(proofNoticeKind([], true)).toBe('filtered');
  });

  it('groups rows by their own stored day, newest first as they arrive', () => {
    const rows = [
      { id: '1', createdAt: '2026-09-21T09:15:00+03:00' },
      { id: '2', createdAt: '2026-09-21T06:02:00+03:00' },
      { id: '3', createdAt: '2026-09-20T22:40:00+03:00' },
    ];
    expect(groupByDay(rows).map((g) => [g.day, g.rows.map((r) => r.id)])).toEqual([
      ['2026-09-21', ['1', '2']],
      ['2026-09-20', ['3']],
    ]);
  });
});

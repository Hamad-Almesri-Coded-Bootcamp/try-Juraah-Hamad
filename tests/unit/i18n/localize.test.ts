/**
 * CR-071 (owner, 2026-09-24): each locale shows only its own language, and no em dash reaches a
 * screen. The seed is the data the demo shows, so every value in it that can reach a screen is
 * localised here and checked in both directions, not assumed.
 */
import { describe, expect, it } from 'vitest';
import {
  hasArabic,
  hasLatin,
  localizeDrugName,
  localizeFacility,
  localizeFirstName,
  localizePersonName,
  localizeRelationship,
  localizeText,
} from '@/i18n/localize';
import {
  buildAccounts,
  buildAlerts,
  buildAuditEvents,
  buildCaregivers,
  buildPrescriptions,
} from '@/lib/data/mock/seed';

const EM_DASH = /[—–]/;
const prescriptions = buildPrescriptions();
const events = buildAuditEvents();
const alerts = buildAlerts();

describe('drug names', () => {
  const names = [...new Set(prescriptions.flatMap((p) => [p.drug.genericName, p.drug.brandName].filter(Boolean) as string[]))];

  it('every seed drug name reads in Arabic script in Arabic', () => {
    for (const name of names) expect(hasLatin(localizeDrugName(name, 'ar')), name).toBe(false);
  });
  it('every seed drug name stays as written in English', () => {
    for (const name of names) {
      if (name === '(unreadable)') continue;
      expect(localizeDrugName(name, 'en')).toBe(name);
    }
  });
  it('the unreadable placeholder is words in both languages, never the literal', () => {
    expect(localizeDrugName('(unreadable)', 'ar')).toBe('اسم غير واضح');
    expect(localizeDrugName('(unreadable)', 'en')).toBe('Name not readable');
  });
  it('a name the dictionary does not know is shown as stored', () => {
    expect(localizeDrugName('Zyntrafex', 'ar')).toBe('Zyntrafex');
  });
});

describe('facilities, relationships and people', () => {
  it('every seed facility reads in English in English, unchanged in Arabic', () => {
    for (const rx of prescriptions) {
      const name = rx.source.facilityName;
      if (!name) continue;
      expect(hasArabic(localizeFacility(name, 'en')), name).toBe(false);
      expect(localizeFacility(name, 'ar')).toBe(name);
    }
  });
  it('every relationship a patient typed reads in English', () => {
    for (const cg of buildCaregivers()) {
      expect(hasArabic(localizeRelationship(cg.relationship, 'en')), cg.relationship).toBe(false);
    }
  });
  it('every seed account name reads in English', () => {
    for (const account of buildAccounts()) {
      expect(hasArabic(localizePersonName(account.name, 'en')), account.name).toBe(false);
    }
  });
  it('a masked name keeps its shape: each middle name is one initial and exactly three asterisks', () => {
    expect(localizePersonName('ناصر ح*** المطيري', 'en')).toBe('Nasser H*** Al-Mutairi');
    expect(localizePersonName('عبدالله م*** ع*** المطيري', 'en')).toBe('Abdullah M*** A*** Al-Mutairi');
    for (const word of localizePersonName('منى خ*** المطيري', 'en').split(' ')) {
      if (word.includes('*')) expect(word).toMatch(/^[A-Z]\*{3}$/);
    }
  });
  it('titles and first names', () => {
    expect(localizePersonName('د. خالد عبدالرحمن الرشيد', 'en')).toBe('Dr. Khaled Abdulrahman Al-Rasheed');
    expect(localizeFirstName('د. خالد عبدالرحمن الرشيد', 'en')).toBe('Khaled');
    expect(localizeFirstName('حمد سالم المطيري', 'ar')).toBe('حمد');
  });
});

describe('free text and activity messages', () => {
  const texts = [
    ...events.map((e) => e.message),
    ...alerts.map((a) => a.description).filter(Boolean),
    ...alerts.map((a) => a.reviewerNote).filter(Boolean),
    ...prescriptions.map((p) => p.discontinuedReason).filter(Boolean),
    ...prescriptions.map((p) => p.fieldReviewNote).filter(Boolean),
  ] as string[];

  it('covers the seed (the list is not empty)', () => {
    expect(texts.length).toBeGreaterThan(40);
  });
  it('every seed message and note reads with no Arabic script in English', () => {
    for (const text of texts) expect(hasArabic(localizeText(text, 'en')), text).toBe(false);
  });
  it('every seed message and note reads with no Latin script in Arabic', () => {
    for (const text of texts) expect(hasLatin(localizeText(text, 'ar')), text).toBe(false);
  });
  it('no em dash survives in either language', () => {
    for (const text of texts) {
      expect(EM_DASH.test(localizeText(text, 'en')), text).toBe(false);
      expect(EM_DASH.test(localizeText(text, 'ar')), text).toBe(false);
    }
  });
  it('the identity app and Telegram are spelled as the owner asked', () => {
    expect(localizeText('دخول عن طريق هويّاتي', 'ar')).toBe('تسجيل الدخول عبر هويتي');
    expect(localizeText('تم ربط تيليقرام', 'ar')).toBe('تم ربط تيليجرام');
  });
  it('the app’s own runtime templates are covered too', () => {
    expect(localizeText('طلب تعبئة Metformin', 'en')).toBe('Refill requested: Metformin');
    expect(localizeText('مراجعة تنبيه — تأكيد', 'en')).toBe('Alert reviewed: risk confirmed');
    expect(localizeText('حمد ألغى ربط نفسه', 'en')).toBe('Hamad stopped following your record');
    expect(localizeText('أُوقفت وصفة Warfarin', 'ar')).toBe('أُوقفت وصفة وارفارين');
  });
});

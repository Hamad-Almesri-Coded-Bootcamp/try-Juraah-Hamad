/**
 * One language per locale (CR-071, owner 2026-09-24): in Arabic nothing appears in Latin script, in
 * English nothing appears in Arabic script. The copy catalogue already holds both languages; this
 * module localises the DATA a screen shows, which the contract carries in one language only:
 *
 *   - drug names arrive in Latin (the seed, the photo intake) → Arabic dictionary for `ar`;
 *   - facility names, relationships and people's names arrive in Arabic → English for `en`;
 *   - free text (alert descriptions, reviewer notes, reasons) and `AuditEvent.message` arrive in
 *     Arabic → an exact-string table plus the app's own message templates for `en`; for `ar` the
 *     embedded Latin drug names become Arabic and old spellings are normalised (هويتي, تيليجرام).
 *
 * Display only: no seed value, contract field or database row changes. Anything the tables do not
 * know is shown as stored (a new drug read from a photo, free text an agent wrote at runtime);
 * Phase 2 should store both languages (docs/BACKEND-NOTES.md). The owner corrects the
 * transliterations listed in docs/DECISIONS.md CR-071. No em dash is ever produced.
 */
import type { Locale } from './locale';
import { vocabulary } from './copy/vocabulary';

const ARABIC = /[؀-ۿ]/;
const LATIN = /[A-Za-z]/;

export function hasArabic(text: string): boolean {
  return ARABIC.test(text);
}
export function hasLatin(text: string): boolean {
  return LATIN.test(text);
}

// ---------------------------------------------------------------------------------------------
// Drug names (Latin → Arabic)

const DRUG_AR: Readonly<Record<string, string>> = {
  // the seed's drugs
  warfarin: 'وارفارين',
  marevan: 'ماريفان',
  ibuprofen: 'إيبوبروفين',
  brufen: 'بروفين',
  metformin: 'ميتفورمين',
  glucophage: 'جلوكوفاج',
  atorvastatin: 'أتورفاستاتين',
  lipitor: 'ليبيتور',
  prednisolone: 'بريدنيزولون',
  ciprofloxacin: 'سيبروفلوكساسين',
  levothyroxine: 'ليفوثيروكسين',
  eltroxin: 'إلتروكسين',
  'calcium carbonate + vitamin d3': 'كربونات الكالسيوم مع فيتامين د٣',
  'calcium carbonate + d3': 'كربونات الكالسيوم مع فيتامين د٣',
  'calcium + d3': 'الكالسيوم مع فيتامين د٣',
  calcium: 'الكالسيوم',
  // common medicines in Kuwait, so a prescription read from a photo usually reads in Arabic too
  paracetamol: 'باراسيتامول',
  panadol: 'بنادول',
  aspirin: 'أسبرين',
  amoxicillin: 'أموكسيسيلين',
  augmentin: 'أوغمنتين',
  omeprazole: 'أوميبرازول',
  esomeprazole: 'إيسوميبرازول',
  nexium: 'نيكسيوم',
  pantoprazole: 'بانتوبرازول',
  amlodipine: 'أملوديبين',
  norvasc: 'نورفاسك',
  lisinopril: 'ليسينوبريل',
  losartan: 'لوسارتان',
  bisoprolol: 'بيسوبرولول',
  furosemide: 'فوروسيميد',
  clopidogrel: 'كلوبيدوغريل',
  plavix: 'بلافيكس',
  simvastatin: 'سيمفاستاتين',
  rosuvastatin: 'روزوفاستاتين',
  crestor: 'كريستور',
  insulin: 'إنسولين',
  gliclazide: 'غليكلازيد',
  sitagliptin: 'سيتاغليبتين',
  januvia: 'جانوفيا',
  diclofenac: 'ديكلوفيناك',
  voltaren: 'فولتارين',
  salbutamol: 'سالبوتامول',
  ventolin: 'فنتولين',
  cetirizine: 'سيتيريزين',
  allopurinol: 'ألوبيورينول',
  'vitamin d3': 'فيتامين د٣',
  'vitamin d': 'فيتامين د',
};

const UNREADABLE = '(unreadable)';
const UNREADABLE_TEXT = { ar: 'اسم غير واضح', en: 'Name not readable' } as const;

/** A drug name in the reader's language. Unknown names are shown as stored. */
export function localizeDrugName(name: string | undefined | null, locale: Locale): string {
  if (!name) return name ?? '';
  const trimmed = name.trim();
  if (trimmed === UNREADABLE) return UNREADABLE_TEXT[locale];
  if (locale === 'en') return trimmed;
  const exact = DRUG_AR[trimmed.toLowerCase()];
  if (exact) return exact;
  // "A + B" combinations whose parts are both known.
  const parts = trimmed.split(/\s*\+\s*/);
  if (parts.length > 1) {
    const mapped = parts.map((p) => DRUG_AR[p.toLowerCase()]);
    if (mapped.every(Boolean)) return mapped.join(' مع ');
  }
  return trimmed;
}

/** Every Latin run in an Arabic sentence that names a known drug, in Arabic. */
function arabiseDrugNames(text: string): string {
  return text.replace(/[A-Za-z][A-Za-z0-9]*(?:\s*\+\s*[A-Za-z0-9]+|\s+[A-Za-z][A-Za-z0-9]*)*/g, (run) => {
    const whole = localizeDrugName(run, 'ar');
    if (whole !== run) return whole;
    // "Levothyroxine و Calcium" arrives as two runs already; a longer run falls back word by word.
    return run
      .split(/\s+/)
      .map((w) => localizeDrugName(w, 'ar'))
      .join(' ');
  });
}

// ---------------------------------------------------------------------------------------------
// Facilities, relationships and people (Arabic → English)

const FACILITY_EN: Readonly<Record<string, string>> = {
  'مستشفى الفروانية': 'Farwaniya Hospital',
  'عيادة النخبة الطبية': 'Al-Nukhba Medical Clinic',
  'مستشفى العدان': 'Adan Hospital',
  'مركز الصباح للأمراض الروماتيزمية': 'Al-Sabah Rheumatology Center',
  'عيادة الياسمين': 'Al-Yasmin Clinic',
};

export function localizeFacility(name: string | undefined | null, locale: Locale): string {
  if (!name) return name ?? '';
  const trimmed = name.trim();
  return locale === 'en' ? (FACILITY_EN[trimmed] ?? trimmed) : trimmed;
}

const RELATIONSHIP_EN: Readonly<Record<string, string>> = {
  ابني: 'my son',
  ابنتي: 'my daughter',
  'زوجة ابني': 'my son’s wife',
  قريب: 'a relative',
  قريبتي: 'a relative',
  'ابنة أختي': 'my niece',
  'ابنة أخي': 'my niece',
  حفيدي: 'my grandson',
  حفيدتي: 'my granddaughter',
  زوجي: 'my husband',
  زوجتي: 'my wife',
  أخي: 'my brother',
  أختي: 'my sister',
};

/** The relationship the patient typed, in the reader's language. */
export function localizeRelationship(value: string | undefined | null, locale: Locale): string {
  if (!value) return value ?? '';
  const trimmed = value.trim();
  return locale === 'en' ? (RELATIONSHIP_EN[trimmed] ?? trimmed) : trimmed;
}

const NAME_EN: Readonly<Record<string, string>> = {
  حمد: 'Hamad',
  سالم: 'Salem',
  المطيري: 'Al-Mutairi',
  فاطمة: 'Fatima',
  العجمي: 'Al-Ajmi',
  سارة: 'Sara',
  يوسف: 'Yousef',
  عبدالله: 'Abdullah',
  محمد: 'Mohammed',
  عبدالعزيز: 'Abdulaziz',
  ناصر: 'Nasser',
  منى: 'Mona',
  خالد: 'Khaled',
  طلال: 'Talal',
  دلال: 'Dalal',
  عبدالرحمن: 'Abdulrahman',
  بدر: 'Badr',
  فهد: 'Fahad',
  العنزي: 'Al-Enezi',
  الرشيد: 'Al-Rasheed',
  دانة: 'Dana',
  السالم: 'Al-Salem',
  هيثم: 'Haitham',
  المسري: 'Al-Mesri',
  أحمد: 'Ahmed',
  علي: 'Ali',
  عمر: 'Omar',
  مريم: 'Maryam',
  نورة: 'Noura',
  عائشة: 'Aisha',
  سعد: 'Saad',
  سعود: 'Saud',
  حسن: 'Hassan',
  حسين: 'Hussein',
  إبراهيم: 'Ibrahim',
  العتيبي: 'Al-Otaibi',
  الهاجري: 'Al-Hajri',
  الشمري: 'Al-Shammari',
  الكندري: 'Al-Kandari',
  العازمي: 'Al-Azmi',
  الرشيدي: 'Al-Rashidi',
};

const TITLE_EN: Readonly<Record<string, string>> = { 'د.': 'Dr.', 'م.': 'Eng.' };

/** One Latin letter per Arabic letter, for a masked initial ("ح***" → "H***"). */
const INITIAL_EN: Readonly<Record<string, string>> = {
  ا: 'A', أ: 'A', إ: 'I', آ: 'A', ب: 'B', ت: 'T', ث: 'T', ج: 'J', ح: 'H', خ: 'K', د: 'D', ذ: 'D',
  ر: 'R', ز: 'Z', س: 'S', ش: 'S', ص: 'S', ض: 'D', ط: 'T', ظ: 'Z', ع: 'A', غ: 'G', ف: 'F', ق: 'Q',
  ك: 'K', ل: 'L', م: 'M', ن: 'N', ه: 'H', و: 'W', ي: 'Y', ى: 'Y', ة: 'H',
};

/**
 * A person's name in the reader's language. The masking rule survives transliteration: a masked
 * middle name stays its initial plus exactly three asterisks (`ناصر ح*** المطيري` → `Nasser H***
 * Al-Mutairi`). A word the table does not know is kept as written.
 */
export function localizePersonName(name: string | undefined | null, locale: Locale): string {
  if (!name) return name ?? '';
  const trimmed = name.trim();
  if (locale === 'ar' || !hasArabic(trimmed)) return trimmed;
  return trimmed
    .split(/\s+/)
    .map((word) => {
      if (TITLE_EN[word]) return TITLE_EN[word];
      const masked = /^(.)\*{3}$/u.exec(word);
      if (masked) return `${INITIAL_EN[masked[1]!] ?? masked[1]}***`;
      return NAME_EN[word] ?? word;
    })
    .join(' ');
}

/** The first word of a name, localised (greetings, "X's medicines"). */
export function localizeFirstName(name: string | undefined | null, locale: Locale): string {
  const full = localizePersonName(name, locale);
  return full.split(/\s+/).find((w) => !TITLE_EN[w] && !/^(Dr\.|Eng\.)$/.test(w)) ?? full;
}

// ---------------------------------------------------------------------------------------------
// Free text and activity messages

const TEXT_EN: Readonly<Record<string, string>> = {
  'أخذ الوارفارين مع الإيبوبروفين يرفع خطر النزيف.': 'Taking warfarin with ibuprofen raises the risk of bleeding.',
  'الكالسيوم قد يقلل امتصاص اللِفوثيروكسين إذا أُخذا معًا.':
    'Calcium can lower how much levothyroxine your body absorbs if you take them together.',
  'تُؤخذ اللِفوثيروكسين على معدة فارغة وتُفصل عن الكالسيوم بأربع ساعات على الأقل':
    'Take levothyroxine on an empty stomach, at least four hours apart from calcium.',
  'الطبيب أوقف الدواء بسبب آلام العضلات': 'The doctor stopped this medicine because of muscle pain.',
  'الجرعة المكتوبة تتعارض مع المدة، يرجى مراجعة العيادة':
    'The written dose doesn’t match the duration. Please check with the clinic.',
  'تم فحص بريدنيزولون مع باقي أدويتك، ولم يوجد تعارض.':
    'Prednisolone was checked against your other medicines. No interaction was found.',
};

const DOSE_WORD: Readonly<Record<string, keyof typeof vocabulary>> = {
  فائتة: 'missed',
  'في وقتها': 'taken_on_time',
  متأخرة: 'taken_late',
};
const REFILL_STATUS: Readonly<Record<string, { ar: string; en: string }>> = {
  'تمت الموافقة': { ar: 'تمت الموافقة', en: 'approved' },
  مرفوض: { ar: 'مرفوض', en: 'denied' },
  'قيد الموافقة': { ar: 'قيد الموافقة', en: 'pending approval' },
};
const DECISION: Readonly<Record<string, { ar: string; en: string }>> = {
  تأكيد: { ar: 'تأكيد الخطر', en: 'risk confirmed' },
  إخلاء: { ar: 'إخلاء التنبيه', en: 'alert cleared' },
};
const PHARMACY: Readonly<Record<string, { ar: string; en: string }>> = {
  حكومية: { ar: 'الصيدلية الحكومية', en: 'the public pharmacy' },
  خاصة: { ar: 'صيدلية القطاع الخاص', en: 'the private pharmacy' },
};

type Rule = {
  re: RegExp;
  en: (m: RegExpExecArray) => string;
  ar?: (m: RegExpExecArray) => string;
};

const drugEn = (s: string) => localizeDrugName(s, 'en');
const drugAr = (s: string) => localizeDrugName(s, 'ar');
const nameEn = (s: string) => localizePersonName(s, 'en');
const splitAnd = (s: string) => s.split(/\s+و\s+/);
const joinEn = (list: string[]) => (list.length > 1 ? `${list.slice(0, -1).join(', ')} and ${list[list.length - 1]}` : list[0] ?? '');

/** The message templates the app itself writes (lib/agent/messages.ts, the data layers, the seed). */
const RULES: readonly Rule[] = [
  { re: /^أُضيفت وصفة غير مقروءة$/, en: () => 'Prescription added: name not readable' },
  { re: /^أُضيفت وصفة (.+)$/, en: (m) => `Prescription added: ${drugEn(m[1]!)}`, ar: (m) => `أُضيفت وصفة ${drugAr(m[1]!)}` },
  { re: /^أُوقفت وصفة (.+)$/, en: (m) => `${drugEn(m[1]!)} prescription stopped`, ar: (m) => `أُوقفت وصفة ${drugAr(m[1]!)}` },
  { re: /^أُعيدت وصفة (.+) للعيادة$/, en: (m) => `${drugEn(m[1]!)} prescription sent back to the clinic`, ar: (m) => `أُعيدت وصفة ${drugAr(m[1]!)} إلى العيادة` },
  { re: /^تأكيد بيانات وصفة (.+)$/, en: (m) => `${drugEn(m[1]!)} prescription details confirmed`, ar: (m) => `تأكيد بيانات وصفة ${drugAr(m[1]!)}` },
  { re: /^إعادة حساب جدول (.+) بعد جرعة فائتة$/, en: (m) => `${drugEn(m[1]!)} schedule updated after a missed dose`, ar: (m) => `تحديث جدول ${drugAr(m[1]!)} بعد جرعة فائتة` },
  {
    re: /^تسجيل حالة جرعة\s*[—-]\s*(فائتة|في وقتها|متأخرة):\s*(.+)$/,
    en: (m) => `${drugEn(m[2]!)} dose recorded: ${vocabulary[DOSE_WORD[m[1]!]!].en.toLowerCase()}`,
    ar: (m) => `تسجيل حالة جرعة ${drugAr(m[2]!)}: ${vocabulary[DOSE_WORD[m[1]!]!].ar}`,
  },
  {
    re: /^تنبيه تعارض خطير:\s*(.+)$/,
    en: (m) => `Serious interaction found: ${joinEn(splitAnd(m[1]!).map(drugEn))}`,
    ar: (m) => `تنبيه تعارض خطير: ${splitAnd(m[1]!).map(drugAr).join(' و ')}`,
  },
  {
    re: /^تنبيه تعارض:\s*(.+)$/,
    en: (m) => `Interaction found: ${joinEn(splitAnd(m[1]!).map(drugEn))}`,
    ar: (m) => `تنبيه تعارض: ${splitAnd(m[1]!).map(drugAr).join(' و ')}`,
  },
  {
    re: /^مراجعة تنبيه:\s*(.+?)\s*[—-]\s*(تأكيد|إخلاء)$/,
    en: (m) => `Alert reviewed: ${joinEn(splitAnd(m[1]!).map(drugEn))}, ${DECISION[m[2]!]!.en}`,
    ar: (m) => `مراجعة تنبيه ${splitAnd(m[1]!).map(drugAr).join(' و ')}: ${DECISION[m[2]!]!.ar}`,
  },
  {
    re: /^مراجعة تنبيه\s*[—-]\s*(تأكيد|إخلاء)$/,
    en: (m) => `Alert reviewed: ${DECISION[m[1]!]!.en}`,
    ar: (m) => `مراجعة تنبيه: ${DECISION[m[1]!]!.ar}`,
  },
  {
    re: /^طلب تعبئة (.+?)(?:\s*[—-]\s*يُوجَّه لصيدلية (حكومية|خاصة))?$/,
    en: (m) => `Refill requested: ${drugEn(m[1]!)}${m[2] ? `, routed to ${PHARMACY[m[2]]!.en}` : ''}`,
    ar: (m) => `طلب تجديد ${drugAr(m[1]!)}${m[2] ? `، يُوجَّه إلى ${PHARMACY[m[2]]!.ar}` : ''}`,
  },
  {
    re: /^تغيّرت حالة طلب تعبئة (.+) إلى:\s*(.+)$/,
    en: (m) => `Refill request for ${drugEn(m[1]!)}: ${REFILL_STATUS[m[2]!]?.en ?? m[2]}`,
    ar: (m) => `تغيّرت حالة طلب تجديد ${drugAr(m[1]!)} إلى: ${REFILL_STATUS[m[2]!]?.ar ?? m[2]}`,
  },
  { re: /^دعوة مقدّم رعاية أُرسلت$/, en: () => 'Caregiver invitation sent' },
  { re: /^دعوة مقدّم رعاية إلى (.+)$/, en: (m) => `Caregiver invitation sent to ${nameEn(m[1]!)}` },
  { re: /^(.+) (?:قبل|قبلت) الدعوة$/, en: (m) => `${nameEn(m[1]!)} accepted the invitation` },
  { re: /^(.+) (?:رفض|رفضت) الدعوة$/, en: (m) => `${nameEn(m[1]!)} declined the invitation` },
  { re: /^(.+) (?:ألغى|ألغت) ربط (?:نفسه|نفسها)$/, en: (m) => `${nameEn(m[1]!)} stopped following your record`, ar: (m) => `ألغى ${m[1]} ارتباطه بملفك` },
  { re: /^أُلغيت دعوة (.+)$/, en: (m) => `Invitation to ${nameEn(m[1]!)} cancelled` },
  { re: /^سُحبت صلاحية (.+)$/, en: (m) => `${nameEn(m[1]!)}’s access was withdrawn` },
  { re: /^انتهت صلاحية دعوة مقدّم رعاية$/, en: () => 'A caregiver invitation expired' },
  { re: /^تم ربط (?:تيليقرام|تيليجرام)$/, en: () => 'Telegram connected', ar: () => 'تم ربط تيليجرام' },
  { re: /^تم فصل (?:تيليقرام|تيليجرام)$/, en: () => 'Telegram disconnected', ar: () => 'تم فصل تيليجرام' },
  {
    re: /^أُوقفت متابعة الجرعات\s*[—-]\s*انتهت صلاحية رابط (?:تيليقرام|تيليجرام)$/,
    en: () => 'Dose tracking stopped because the Telegram link expired',
    ar: () => 'أُوقفت متابعة الجرعات لانتهاء صلاحية رابط تيليجرام',
  },
  { re: /^أُوقفت متابعة الجرعات$/, en: () => 'Dose tracking stopped' },
  { re: /^تفعيل متابعة الجرعات$/, en: () => 'Dose tracking turned on' },
  { re: /^إيقاف متابعة الجرعات$/, en: () => 'Dose tracking turned off' },
  { re: /^تفعيل إشعارات المتصفح$/, en: () => 'Browser notifications turned on' },
  { re: /^إيقاف إشعارات المتصفح$/, en: () => 'Browser notifications turned off' },
  { re: /^دخول عن طريق (?:هويّاتي|هوياتي|هويتي)$/, en: () => 'Signed in with Hawiati', ar: () => 'تسجيل الدخول عبر هويتي' },
  { re: /^خروج$/, en: () => 'Signed out', ar: () => 'تسجيل الخروج' },
];

/** Old spellings and dashes in stored Arabic text, as the owner wants them read (CR-071). */
function normaliseArabic(text: string): string {
  return text
    .replace(/هويّاتي|هوياتي/g, 'هويتي')
    .replace(/تيليقرام/g, 'تيليجرام')
    .replace(/\s+[—–]\s+/g, '، ')
    .replace(/[—–]/g, '،');
}
function normaliseEnglish(text: string): string {
  return text.replace(/\s+[—–]\s+/g, ', ').replace(/[—–]/g, ', ');
}

/**
 * Stored free text or an activity message, in the reader's language. Unknown English is left as
 * stored; unknown Arabic keeps its words with the drug names and spellings normalised.
 */
export function localizeText(text: string | undefined | null, locale: Locale): string {
  if (!text) return text ?? '';
  const trimmed = text.trim();
  if (locale === 'en') {
    const exact = TEXT_EN[trimmed];
    if (exact) return exact;
    for (const rule of RULES) {
      const m = rule.re.exec(trimmed);
      if (m) return normaliseEnglish(rule.en(m));
    }
    return normaliseEnglish(trimmed);
  }
  for (const rule of RULES) {
    const m = rule.re.exec(trimmed);
    if (m && rule.ar) return normaliseArabic(rule.ar(m));
    if (m) break;
  }
  return normaliseArabic(arabiseDrugNames(trimmed));
}

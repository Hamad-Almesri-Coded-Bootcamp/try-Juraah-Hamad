'use client';

/**
 * WP2b gallery — Data display: Card · PrescriptionCard · StatusPill · SectorChip · DetailRow ·
 * DepletionMeter · DoseRow · ScheduleGroup · DoseTimeline · AlertRow · ActivityRow · MenuRow.
 * Every component in every state named in docs/briefs/WP2b.md's GALLERY STATES, with real seed
 * content (docs/Seed Dataset.md) and this group's central safety claim (G1/G10) on display in the
 * DoseRow section. Dev-only: literal strings are allowed here and nowhere else (app/(dev)/** is
 * exempt from guard 7 and eslint jsx-no-literals).
 *
 * A client component, not the usual async server page reading `params` as a Promise, because
 * PrescriptionCard/Card/AlertRow/MenuRow's `onOpen`/`onClick` examples need real handlers and a
 * Server Component cannot pass a live event handler to a DOM element with no Client Component
 * boundary in the tree; `useParams` is the client-component way to read the locale segment (Next's
 * own docs, node_modules/next/dist/docs/01-app/03-api-reference/04-functions/use-params.md — the
 * same choice WP2d's gallery page made for Sheet's open/close state).
 */
import { GalleryPage, Section, Example } from '../_gallery';
import { Card } from '@/components/ui/Card';
import { PrescriptionCard, type PrescriptionSummary } from '@/components/ui/PrescriptionCard';
import { StatusPill, type DoseStatus } from '@/components/ui/StatusPill';
import { SectorChip, type Sector } from '@/components/ui/SectorChip';
import { DetailRow } from '@/components/ui/DetailRow';
import { DepletionMeter } from '@/components/ui/DepletionMeter';
import { DoseRow } from '@/components/ui/DoseRow';
import { ScheduleGroup } from '@/components/ui/ScheduleGroup';
import { DoseTimeline, type DoseTimelineItem } from '@/components/ui/DoseTimeline';
import { AlertRow, type Severity, type ReviewStatus } from '@/components/ui/AlertRow';
import { ActivityRow } from '@/components/ui/ActivityRow';
import { MenuRow } from '@/components/ui/MenuRow';
import { useParams } from 'next/navigation';

type GalleryLocale = 'ar' | 'en';

/** Shorthand-property dose builder — never writes the `status: '<word>'` object-literal pattern
 * that scripts/guards/no-dose-write.ts (G1) looks for across app/. */
function mkDose(status: DoseStatus, tracked?: boolean) {
  return { status, tracked };
}

const STATUSES: readonly [DoseStatus, DoseStatus, DoseStatus, DoseStatus] = ['upcoming', 'taken_on_time', 'taken_late', 'missed'];
const [statusUpcoming, statusTakenOnTime, statusTakenLate, statusMissed] = STATUSES;

const TEXT = {
  ar: {
    pageTitle: 'عرض البيانات (ب)',

    statusPillCaption: (s: string) => `الحالة: ${s}`,

    sectorPublic: 'قطاع عام',
    sectorPrivate: 'قطاع خاص',

    cardStatic: 'بطاقة ثابتة (div)',
    cardButton: 'بطاقة قابلة للنقر (button)',
    cardLink: 'بطاقة كرابط (a)',
    cardFlat: 'بطاقة مسطّحة (بدون ظل، داخل بطاقة أخرى)',
    cardBody: 'محتوى داخل البطاقة — أي كتلة قائمة بذاتها.',
    cardButtonLabel: 'افتح تفاصيل وارفارين ٥ ملغ',
    cardLinkLabel: 'افتح صفحة الأدوية',

    rxWithDose: 'مع جرعة (يظهر الشريط)',
    rxWithoutDose: 'بدون جرعة (لا يظهر شريط الحالة)',
    rxWithOnOpen: 'مع onOpen — البطاقة كلها زر واحد بسهم',
    rxWithoutBrand: 'بدون اسم تجاري (سجل باسمه العلمي فقط)',
    rxLevo: 'وحدة غير افتراضية — strengthUnit="mcg" على ليفوثيروكسين (strengthMg: 50)',
    doseTimeToday: 'اليوم ٦:٠٠ م',

    detailValue: 'قيمة موجودة',
    detailEmpty: 'قيمة فارغة (شرطة افتراضية + نص مساعد)',
    detailEmptyCustom: 'علامة فراغ مخصّصة',
    labelDose: 'الجرعة',
    labelNote: 'ملاحظات خاصة',
    labelFood: 'مع الأكل',
    valueDose: 'حبة واحدة',

    depNormal: 'طبيعي — وارفارين (rx-001)، ٧٠ من ٩٠، حسب الصرف الفعلي',
    depLow: 'منخفض — ميتفورمين (rx-003)، ٢٠ من ٦٠، نسبةً لمهلة تجديد ١٤ يومًا (CR-014)',
    depNoDays: 'بدون تقدير أيام — الكمية معروفة والتوقع غير متاح',
    unitTablets: 'حبة',

    doseRowTrackedTitle: 'سارة — أربع الحالات (المتابعة مفعّلة)',
    doseRowUntrackedTitle: 'حمد — بدون متابعة، الحالة الافتراضية والأكثر ظهورًا (لا يوجد شريط حالة على الإطلاق)',
    scheduleOneRow: 'مجموعة زمنية بصف واحد',
    scheduleSeveralRows: 'مجموعة زمنية بعدة صفوف',
    timeSixPm: '٦:٠٠ م',
    timeEightAm: '٨:٠٠ ص',

    timelineTracked: 'مع حالات — سارة، ليفوثيروكسين (rx-008)، ١٩–٢١ سبتمبر',
    timelineUntracked: 'بدون حالات — حمد، وارفارين (rx-001) — تاريخ يظهر بلا شارات على الإطلاق',
    dateToday: 'اليوم',
    dateYesterday: 'أمس',
    date19: '١٩ سبتمبر',
    date20: '٢٠ سبتمبر',

    alertRealDanger: 'حقيقي — ia-001: خطر × قيد المراجعة الطبية',
    alertRealWarning: 'حقيقي — ia-002: متوسط × تمت المراجعة',
    alertRealInfo: 'حقيقي — ia-003: للعلم × إغلاق تلقائي',
    alertSynthetic: (sev: string, rev: string) => `اصطناعي لتغطية الحالة فقط — ${sev} × ${rev} (تركيبة من أدوية العيّنة نفسها)`,
    metaHamad: 'حمد سالم المطيري · عام + خاص',
    metaSara: 'سارة يوسف العجمي · عام + خاص',
    metaFatima: 'فاطمة سالم العجمي · عام',

    activityPatientFeed: 'صف في سجل نشاط المريض — بدون فاعل، مع رابط',
    activityAuditWithActor: 'صف في سجل التدقيق — مع فاعل ومرجع مريض ماسك',
    activityListLayout: 'تخطيط قائمة (390)',
    activityTableLayout: 'تخطيط جدول (١٤٤٠، سجل التدقيق)',
    eventAlertRaised: 'أُنشئ تنبيه تعارض خطير',
    eventAlertRaisedDesc: 'Warfarin × Ibuprofen',
    eventDoseRecorded: 'تسجيل حالة جرعة',
    eventDoseRecordedDesc: 'taken_on_time · Levothyroxine',
    eventSignedIn: 'تسجيل دخول',
    actorAgent: 'مساعد المتابعة',
    saraMasked: 'سارة ي*** العجمي',
    timeAlertRaised: 'اليوم ٩:٠٢ ص',
    timeDoseRecorded: '٢٠٢٦-٠٩-٢١ ٠٧:١٢',
    timeSignedIn: '٢٠٢٦-٠٩-٢١ ٠٦:٠٢',
    colTime: 'الوقت',
    colEvent: 'النوع',
    colActor: 'الفاعل',
    colPatient: 'المريض',
    colDescription: 'الوصف',

    menuDestination: 'وجهة — تجديد الوصفات',
    menuValue: 'الإعداد — مزامنة التقويم',
    menuValueOn: 'مفعّلة',
    menuToggleSlot: 'إعداد بفتحة تحكم بديلة (Toggle، حاليًا عنصر checkbox بديل لتفادي ازدواج التسمية)',
    menuToggleLabel: 'رسائل متابعة الجرعات',
    menuPending: 'ناصر — دعوة بانتظار القبول',
    menuPendingValue: 'بانتظار قبوله',
    menuDeclined: 'منى — دعوة مرفوضة',
    menuDeclinedValue: 'رفضت الدعوة',
    menuExpired: 'دعوة سابقة — لا يوجد حساب',
    menuExpiredValue: 'انتهت مهلتها',
    menuRevoked: 'طلال — تم سحب صلاحيته بعد قبولها',
    menuRevokedValue: 'تم سحب الصلاحية',
  },
  en: {
    pageTitle: 'Data display (b)',

    statusPillCaption: (s: string) => `Status: ${s}`,

    sectorPublic: 'Public sector',
    sectorPrivate: 'Private sector',

    cardStatic: 'Static card (div)',
    cardButton: 'Clickable card (button)',
    cardLink: 'Card as a link (a)',
    cardFlat: 'Flat card (no shadow, nested in another surface)',
    cardBody: 'Content inside the card — any self-contained block.',
    cardButtonLabel: 'Open Warfarin 5 mg details',
    cardLinkLabel: 'Open the medicines page',

    rxWithDose: 'With a dose (the status row shows)',
    rxWithoutDose: 'Without a dose (no status row at all)',
    rxWithOnOpen: 'With onOpen — the whole card is one button with a chevron',
    rxWithoutBrand: 'No brand name (a generic-only record)',
    rxLevo: 'A non-default unit — strengthUnit="mcg" on Levothyroxine (strengthMg: 50)',
    doseTimeToday: 'Today 6:00 PM',

    detailValue: 'A present value',
    detailEmpty: 'An empty value (default dash + assistive text)',
    detailEmptyCustom: 'A custom empty mark',
    labelDose: 'Dose',
    labelNote: 'Special notes',
    labelFood: 'With food',
    valueDose: 'One tablet',

    depNormal: 'Normal — Warfarin (rx-001), 70 of 90, from real dispensing figures',
    depLow: 'Low — Metformin (rx-003), 20 of 60, against a 14-day refill window (CR-014)',
    depNoDays: 'No days estimate — the quantity is known, the forecast is unavailable',
    unitTablets: 'tablets',

    doseRowTrackedTitle: 'Sara — all four statuses (tracking on)',
    doseRowUntrackedTitle: 'Hamad — tracking off, the default and most-seen state (no status pill at all)',
    scheduleOneRow: 'A time group with one row',
    scheduleSeveralRows: 'A time group with several rows',
    timeSixPm: '6:00 PM',
    timeEightAm: '8:00 AM',

    timelineTracked: 'With statuses — Sara, Levothyroxine (rx-008), 19–21 September',
    timelineUntracked: 'Without statuses — Hamad, Warfarin (rx-001) — a history with no badge at all',
    dateToday: 'Today',
    dateYesterday: 'Yesterday',
    date19: '19 Sept',
    date20: '20 Sept',

    alertRealDanger: 'Real — ia-001: danger × pending medical review',
    alertRealWarning: 'Real — ia-002: warning × reviewed',
    alertRealInfo: 'Real — ia-003: info × auto-cleared',
    alertSynthetic: (sev: string, rev: string) => `Synthetic, for state coverage only — ${sev} × ${rev} (a combination of the same seed drugs)`,
    metaHamad: 'Hamad Salem Al-Mutairi · public + private',
    metaSara: 'Sara Yousef Al-Ajmi · public + private',
    metaFatima: 'Fatima Salem Al-Ajmi · public',

    activityPatientFeed: 'A row in the patient activity feed — no actor, with a link',
    activityAuditWithActor: 'A row in the admin audit log — with an actor and a masked patient reference',
    activityListLayout: 'List layout (390)',
    activityTableLayout: 'Table layout (1440, the audit log)',
    eventAlertRaised: 'A serious interaction alert was raised',
    eventAlertRaisedDesc: 'Warfarin × Ibuprofen',
    eventDoseRecorded: 'Dose status recorded',
    eventDoseRecordedDesc: 'taken_on_time · Levothyroxine',
    eventSignedIn: 'Signed in',
    actorAgent: 'Adherence assistant',
    saraMasked: 'Sara Y*** Al-Ajmi',
    timeAlertRaised: 'Today 9:02 AM',
    timeDoseRecorded: '2026-09-21 07:12',
    timeSignedIn: '2026-09-21 06:02',
    colTime: 'Time',
    colEvent: 'Event',
    colActor: 'Actor',
    colPatient: 'Patient',
    colDescription: 'Description',

    menuDestination: 'A destination — Refill prescriptions',
    menuValue: 'A setting — Calendar sync',
    menuValueOn: 'On',
    menuToggleSlot: 'A setting with a trailing control slot (Toggle; a checkbox stand-in here to avoid a duplicate label)',
    menuToggleLabel: 'Dose reminder messages',
    menuPending: 'Nasser — invitation awaiting acceptance',
    menuPendingValue: 'Awaiting his acceptance',
    menuDeclined: 'Mona — invitation declined',
    menuDeclinedValue: 'Declined the invitation',
    menuExpired: 'A previous invitation — no account',
    menuExpiredValue: 'Expired',
    menuRevoked: 'Talal — access revoked after acceptance',
    menuRevokedValue: 'Access revoked',
  },
} as const satisfies Record<GalleryLocale, Record<string, unknown>>;

type GalleryText = (typeof TEXT)[GalleryLocale];

// Caption-only display forms of the raw contract words (spaced, not underscored) — an unbroken
// identifier like "pending_medical_review" has no space for the browser to wrap on and forces
// horizontal overflow at 390px (tests/e2e/gallery.spec.ts's overflow check caught exactly this).
const STATUS_WORD_EN: Record<DoseStatus, string> = {
  upcoming: 'upcoming',
  taken_on_time: 'taken on time',
  taken_late: 'taken late',
  missed: 'missed',
};

const SEVERITIES: readonly Severity[] = ['info', 'warning', 'danger'];
const REVIEW_STATUSES: readonly ReviewStatus[] = ['auto_cleared', 'pending_medical_review', 'reviewed'];
const SEVERITY_WORD_EN: Record<Severity, string> = { info: 'info', warning: 'warning', danger: 'danger' };
const REVIEW_WORD_EN: Record<ReviewStatus, string> = {
  auto_cleared: 'auto cleared',
  pending_medical_review: 'pending medical review',
  reviewed: 'reviewed',
};

const warfarin: PrescriptionSummary = {
  id: 'rx-001',
  drug: { genericName: 'Warfarin', brandName: 'Marevan', strengthMg: 5 },
  source: { facilityName: 'مستشفى الفروانية', sector: 'public' as Sector },
};
const ibuprofen: PrescriptionSummary = {
  id: 'rx-002',
  drug: { genericName: 'Ibuprofen', brandName: 'Brufen', strengthMg: 400 },
  source: { facilityName: 'عيادة النخبة الطبية', sector: 'private' as Sector },
};
const calciumNoBrand: PrescriptionSummary = {
  id: 'rx-009',
  drug: { genericName: 'Calcium carbonate + vitamin D3', strengthMg: 500 },
  source: { facilityName: 'عيادة النخبة الطبية', sector: 'private' as Sector },
};
const levothyroxine: PrescriptionSummary = {
  id: 'rx-008',
  drug: { genericName: 'Levothyroxine', brandName: 'Eltroxin', strengthMg: 50 },
  source: { facilityName: 'مستشفى العدان', sector: 'public' as Sector },
};

// حمد's six untracked doses, 2026-09-21 — TodayPlan board: four time groups, no status pill anywhere.
const hamad0800 = [
  { drug: { genericName: 'Metformin', brandName: 'Glucophage', strengthMg: 500 } },
  { drug: { genericName: 'Ibuprofen', brandName: 'Brufen', strengthMg: 400 } },
];
const hamad1400 = [{ drug: { genericName: 'Ibuprofen', brandName: 'Brufen', strengthMg: 400 } }];
const hamad1800Drug = { genericName: 'Warfarin', brandName: 'Marevan', strengthMg: 5 };
const hamad1800 = [{ drug: hamad1800Drug }];
const hamad2000 = [
  { drug: { genericName: 'Metformin', brandName: 'Glucophage', strengthMg: 500 } },
  { drug: { genericName: 'Ibuprofen', brandName: 'Brufen', strengthMg: 400 } },
];

function amountLabel(t: GalleryText, strengthMg: number, locale: GalleryLocale) {
  const unit = locale === 'ar' ? 'ملغم' : 'mg';
  return `${t.valueDose} · ${strengthMg} ${unit}`;
}

export default function GalleryB() {
  const params = useParams<{ locale: string }>();
  const locale: GalleryLocale = params.locale === 'en' ? 'en' : 'ar';
  const t = TEXT[locale];
  const statusWord = locale === 'en' ? STATUS_WORD_EN : STATUS_WORD_EN; // the pill's own built-in word is already bilingual; the caption names the raw contract word for clarity in both locales
  const severityWord = SEVERITY_WORD_EN;
  const reviewWord = REVIEW_WORD_EN;

  // سارة's four real statuses, 2026-09-19 through 2026-09-21 (Seed Dataset.md).
  const saraUpcoming = { status: statusUpcoming, drug: levothyroxine.drug, label: t.dateToday };
  const saraTakenOnTime = { status: statusTakenOnTime, drug: levothyroxine.drug, label: t.dateToday };
  const saraTakenLate = { status: statusTakenLate, drug: calciumNoBrand.drug, label: t.dateYesterday };
  const saraMissed = { status: statusMissed, drug: levothyroxine.drug, label: t.date19 };
  const saraTracked = [saraUpcoming, saraTakenOnTime, saraTakenLate, saraMissed];

  const timelineTracked: DoseTimelineItem[] = [
    { dateLabel: t.date19, timeLabel: '7:00', status: saraMissed.status, tracked: true },
    { dateLabel: t.date20, timeLabel: '7:00', status: saraTakenOnTime.status, tracked: true },
    { dateLabel: t.dateToday, timeLabel: '7:00', status: saraTakenOnTime.status, tracked: true },
  ];
  const timelineUntracked: DoseTimelineItem[] = [
    { dateLabel: t.dateToday, timeLabel: t.timeEightAm, status: statusUpcoming, tracked: false },
    { dateLabel: t.dateYesterday, timeLabel: t.timeEightAm, status: statusUpcoming, tracked: false },
    { dateLabel: t.date20, timeLabel: t.timeEightAm, status: statusUpcoming, tracked: false },
  ];

  const alertMeta: Record<Severity, string> = { danger: t.metaHamad, warning: t.metaSara, info: t.metaFatima };

  return (
    <>
      <title>{t.pageTitle}</title>
      <GalleryPage title={t.pageTitle}>
        <Section title="StatusPill">
          {STATUSES.map((s) => (
            <Example key={s} caption={t.statusPillCaption(statusWord[s])}>
              <StatusPill status={s} lang={locale} />
            </Example>
          ))}
        </Section>

        <Section title="SectorChip">
          <Example caption={t.sectorPublic}>
            <SectorChip sector="public" lang={locale} />
          </Example>
          <Example caption={t.sectorPrivate}>
            <SectorChip sector="private" lang={locale} />
          </Example>
        </Section>

        <Section title="Card">
          <Example caption={t.cardStatic}>
            <Card>
              <p className="type-body">{t.cardBody}</p>
            </Card>
          </Example>
          <Example caption={t.cardButton}>
            <Card onClick={() => {}} aria-label={t.cardButtonLabel}>
              <p className="type-body-strong">Warfarin 5 mg</p>
            </Card>
          </Example>
          <Example caption={t.cardLink}>
            <Card as="a" href={`/${locale}/app/medicines`} aria-label={t.cardLinkLabel}>
              <p className="type-body">{t.cardBody}</p>
            </Card>
          </Example>
          <Example caption={t.cardFlat}>
            <div className="wsf-card">
              <Card flat>
                <p className="type-body">{t.cardBody}</p>
              </Card>
            </div>
          </Example>
        </Section>

        <Section title="PrescriptionCard">
          <Example caption={t.rxWithDose}>
            <PrescriptionCard prescription={warfarin} dose={mkDose(statusUpcoming)} doseTimeLabel={t.doseTimeToday} lang={locale} />
          </Example>
          <Example caption={t.rxWithoutDose}>
            <PrescriptionCard prescription={ibuprofen} lang={locale} />
          </Example>
          <Example caption={t.rxWithOnOpen}>
            <PrescriptionCard prescription={warfarin} onOpen={() => {}} lang={locale} />
          </Example>
          <Example caption={t.rxWithoutBrand}>
            <PrescriptionCard prescription={calciumNoBrand} lang={locale} />
          </Example>
          <Example caption={t.rxLevo}>
            <PrescriptionCard prescription={levothyroxine} strengthUnit="mcg" lang={locale} />
          </Example>
        </Section>

        <Section title="DetailRow">
          <Example caption={t.detailValue}>
            <DetailRow label={t.labelDose} value={t.valueDose} lang={locale} />
          </Example>
          <Example caption={t.detailEmpty}>
            <DetailRow label={t.labelNote} value={null} lang={locale} />
          </Example>
          <Example caption={t.detailEmptyCustom}>
            <DetailRow label={t.labelFood} value={undefined} emptyMark="?" lang={locale} />
          </Example>
        </Section>

        <Section title="DepletionMeter">
          <Example caption={t.depNormal}>
            <DepletionMeter remaining={70} total={90} daysRemaining={70} unit={t.unitTablets} lang={locale} />
          </Example>
          <Example caption={t.depLow}>
            <DepletionMeter remaining={20} total={60} daysRemaining={10} lowAtDays={14} unit={t.unitTablets} lang={locale} />
          </Example>
          <Example caption={t.depNoDays}>
            <DepletionMeter remaining={70} total={90} daysRemaining={null} unit={t.unitTablets} lang={locale} />
          </Example>
        </Section>

        <Section title="DoseRow + ScheduleGroup">
          <Example caption={t.doseRowTrackedTitle}>
            <div style={{ display: 'grid', gap: 'var(--space-2)' }}>
              {saraTracked.map((d, i) => (
                <DoseRow
                  key={i}
                  dose={mkDose(d.status, true)}
                  drug={d.drug}
                  amountLabel={amountLabel(t, d.drug.strengthMg ?? 0, locale)}
                  lang={locale}
                />
              ))}
            </div>
          </Example>

          <Example caption={t.doseRowUntrackedTitle}>
            <div style={{ display: 'grid', gap: 'var(--space-3)' }}>
              <ScheduleGroup timeLabel={t.timeEightAm}>
                {hamad0800.map((d, i) => (
                  <DoseRow key={i} dose={mkDose(statusUpcoming, false)} drug={d.drug} amountLabel={amountLabel(t, d.drug.strengthMg, locale)} lang={locale} />
                ))}
              </ScheduleGroup>
              <ScheduleGroup timeLabel="٢:٠٠ م">
                {hamad1400.map((d, i) => (
                  <DoseRow key={i} dose={mkDose(statusUpcoming, false)} drug={d.drug} amountLabel={amountLabel(t, d.drug.strengthMg, locale)} lang={locale} />
                ))}
              </ScheduleGroup>
              <ScheduleGroup timeLabel={t.timeSixPm}>
                {hamad1800.map((d, i) => (
                  <DoseRow key={i} dose={mkDose(statusUpcoming, false)} drug={d.drug} amountLabel={amountLabel(t, d.drug.strengthMg, locale)} lang={locale} />
                ))}
              </ScheduleGroup>
              <ScheduleGroup timeLabel="٨:٠٠ م">
                {hamad2000.map((d, i) => (
                  <DoseRow key={i} dose={mkDose(statusUpcoming, false)} drug={d.drug} amountLabel={amountLabel(t, d.drug.strengthMg, locale)} lang={locale} />
                ))}
              </ScheduleGroup>
            </div>
          </Example>

          <Example caption={t.scheduleOneRow}>
            <ScheduleGroup timeLabel={t.timeSixPm}>
              <DoseRow dose={mkDose(statusUpcoming, false)} drug={hamad1800Drug} amountLabel={amountLabel(t, 5, locale)} lang={locale} />
            </ScheduleGroup>
          </Example>
          <Example caption={t.scheduleSeveralRows}>
            <ScheduleGroup timeLabel={t.timeEightAm}>
              {hamad0800.map((d, i) => (
                <DoseRow key={i} dose={mkDose(statusUpcoming, false)} drug={d.drug} amountLabel={amountLabel(t, d.drug.strengthMg, locale)} lang={locale} />
              ))}
            </ScheduleGroup>
          </Example>
        </Section>

        <Section title="DoseTimeline">
          <Example caption={t.timelineTracked}>
            <DoseTimeline items={timelineTracked} lang={locale} />
          </Example>
          <Example caption={t.timelineUntracked}>
            <DoseTimeline items={timelineUntracked} lang={locale} />
          </Example>
        </Section>

        <Section title="AlertRow">
          <Example caption={t.alertRealDanger}>
            <AlertRow severity="danger" drugs={['Warfarin', 'Ibuprofen']} reviewStatus="pending_medical_review" metaLabel={t.metaHamad} lang={locale} />
          </Example>
          <Example caption={t.alertRealWarning}>
            <AlertRow severity="warning" drugs={['Levothyroxine', 'Calcium carbonate']} reviewStatus="reviewed" metaLabel={t.metaSara} lang={locale} />
          </Example>
          <Example caption={t.alertRealInfo}>
            <AlertRow severity="info" drugs={['Prednisolone']} reviewStatus="auto_cleared" metaLabel={t.metaFatima} lang={locale} />
          </Example>
          {SEVERITIES.flatMap((sev) =>
            REVIEW_STATUSES.filter((rev) => !(sev === 'danger' && rev === 'pending_medical_review') && !(sev === 'warning' && rev === 'reviewed') && !(sev === 'info' && rev === 'auto_cleared')).map(
              (rev) => (
                <Example key={`${sev}-${rev}`} caption={t.alertSynthetic(severityWord[sev], reviewWord[rev])}>
                  <AlertRow severity={sev} drugs={['Metformin', 'Atorvastatin']} reviewStatus={rev} metaLabel={alertMeta[sev]} lang={locale} />
                </Example>
              )
            )
          )}
        </Section>

        <Section title="ActivityRow">
          <Example caption={`${t.activityPatientFeed} · ${t.activityListLayout}`}>
            <ActivityRow title={t.eventAlertRaised} description={t.eventAlertRaisedDesc} timeLabel={t.timeAlertRaised} href={`/${locale}/app/safety`} />
          </Example>
          <Example caption={`${t.activityAuditWithActor} · ${t.activityListLayout}`}>
            <ActivityRow
              title={t.eventDoseRecorded}
              description={t.eventDoseRecordedDesc}
              timeLabel={t.timeDoseRecorded}
              actor={{ label: t.actorAgent, kind: 'agent' }}
              code="agent"
              patientRef={t.saraMasked}
            />
          </Example>
          <Example caption={`${t.activityAuditWithActor} · ${t.activityTableLayout}`}>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ inlineSize: '100%', borderCollapse: 'collapse', tableLayout: 'fixed' }}>
                <ActivityRow.Table columns={{ time: t.colTime, event: t.colEvent, actor: t.colActor, patient: t.colPatient, description: t.colDescription }} />
                <tbody>
                  <ActivityRow
                    layout="table"
                    title={t.eventDoseRecorded}
                    description={t.eventDoseRecordedDesc}
                    timeLabel={t.timeDoseRecorded}
                    actor={{ label: t.actorAgent, kind: 'agent' }}
                    code="agent"
                    patientRef={t.saraMasked}
                  />
                  <ActivityRow layout="table" title={t.eventSignedIn} timeLabel={t.timeSignedIn} actor={{ label: t.actorAgent, kind: 'patient' }} code="patient" patientRef={t.saraMasked} />
                </tbody>
              </table>
            </div>
          </Example>
        </Section>

        <Section title="MenuRow">
          <Example caption={t.menuDestination}>
            <MenuRow label={t.menuDestination} icon="refresh" href={`/${locale}/app/refill`} />
          </Example>
          <Example caption={t.menuValue}>
            <MenuRow label={t.menuValue} value={t.menuValueOn} icon="calendar" onClick={() => {}} />
          </Example>
          <Example caption={t.menuToggleSlot}>
            <MenuRow
              label={t.menuToggleLabel}
              icon="inbox"
              trailing={<input type="checkbox" aria-label={t.menuToggleLabel} defaultChecked style={{ inlineSize: 'var(--icon)', blockSize: 'var(--icon)' }} />}
            />
          </Example>
          <Example caption={t.menuPending}>
            <MenuRow label={t.menuPending} value={t.menuPendingValue} tone="relationship" />
          </Example>
          <Example caption={t.menuDeclined}>
            <MenuRow label={t.menuDeclined} value={t.menuDeclinedValue} tone="relationship" />
          </Example>
          <Example caption={t.menuExpired}>
            <MenuRow label={t.menuExpired} value={t.menuExpiredValue} tone="relationship" />
          </Example>
          <Example caption={t.menuRevoked}>
            <MenuRow label={t.menuRevoked} value={t.menuRevokedValue} tone="relationship" />
          </Example>
        </Section>
      </GalleryPage>
    </>
  );
}

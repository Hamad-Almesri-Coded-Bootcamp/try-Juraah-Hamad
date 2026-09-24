/**
 * Copy catalogue, day group (WP4 bundle c — B1 "Today" and B2 "My Medicines"). Owned by its bundle
 * from wave 1 on; the lead created the stub and registered it in i18n/index.ts so parallel bundles
 * never touch a shared file (D-003). Every key is `placeholder: true` until the owner's bilingual
 * copy deck replaces it. Dose-status words themselves live in `./vocabulary.ts` and are reused, never
 * redefined here (CLAUDE.md: "dose-status words come from i18n/copy/vocabulary.ts").
 */
import type { CopyEntry } from './shell';

export const day = {
  // B1 — day navigation
  previousDay: { ar: 'اليوم السابق', en: 'Previous day', placeholder: true },
  nextDay: { ar: 'اليوم التالي', en: 'Next day', placeholder: true },
  returnToToday: { ar: 'العودة إلى اليوم', en: 'Return to today', placeholder: true },

  // B1 — the date/count caption under the date heading (board: "اليوم · ٦ جرعات")
  doseCountTodayTemplate: { ar: 'جرعات اليوم: {count}', en: 'Doses today: {count}', placeholder: true },
  doseCountTemplate: { ar: 'عدد الجرعات: {count}', en: 'Doses: {count}', placeholder: true },

  // B1 — tracking-off notice (G10/rule 3): gain-framed per UX Principles §13, never a warning
  trackingOffNotice: {
    ar: 'فعّل متابعة الجرعات لترى حالة كل جرعة هنا.',
    en: 'Turn on dose tracking to see each dose’s status here.',
    placeholder: true,
  },
  turnTrackingOn: { ar: 'فعّلها', en: 'Turn it on', placeholder: true },

  // B1 — empty day (a day with no scheduled dose at all — فاطمة's alternate-day cadence on 21 Sept)
  emptyDayTitle: { ar: 'لا توجد جرعات مجدولة في هذا اليوم', en: 'No doses scheduled for this day', placeholder: true },
  emptyDayDescription: {
    ar: 'بعض الأدوية تُؤخذ كل يومين، لذلك تخلو بعض الأيام من الجرعات.',
    en: 'Some medicines are taken every other day, so not every day has a dose.',
    placeholder: true,
  },

  // B1 — a patient with no active prescription at all yet (بدر)
  emptyNoPrescriptionsTitle: { ar: 'لا توجد لديك وصفات نشطة بعد', en: 'No active prescriptions yet', placeholder: true },
  emptyNoPrescriptionsDescription: {
    ar: 'عندما يكتب لك الطبيب وصفة، ستظهر مواعيد جرعاتها هنا.',
    en: 'When your doctor gives you a prescription, its dose times will show up here.',
    placeholder: true,
  },

  // B1 — dose amount (dosePerAdministration is 1 throughout the seed; the plural forms stay for
  // defensive correctness even though the seed never exercises them). One variant per Arabic plural
  // category, chosen by i18n/format.ts's formatCount — "٢ حبات" and "١١ حبات" are ungrammatical.
  // Also B3/F3's "Dose" row value (audit M9 — never a bare number).
  doseAmountOne: { ar: 'حبة واحدة', en: 'One tablet', placeholder: true },
  doseAmountTwo: { ar: 'حبتان', en: '{count} tablets', placeholder: true },
  doseAmountFewTemplate: { ar: '{count} حبات', en: '{count} tablets', placeholder: true },
  doseAmountManyTemplate: { ar: '{count} حبة', en: '{count} tablets', placeholder: true },

  // B2 — section headings (board: "الوصفات النشطة" / "أدوية سابقة")
  activeMedicinesTitle: { ar: 'الوصفات النشطة', en: 'Active prescriptions', placeholder: true },
  pastMedicinesTitle: { ar: 'أدوية سابقة', en: 'Past medicines', placeholder: true },
  pastMedicinesNote: {
    ar: 'الأدوية السابقة للاطلاع فقط، ولا يمكن طلب تجديدها.',
    en: 'Past medicines are here to look back on. They can’t be refilled.',
    placeholder: true,
  },
  discontinuedOnTemplate: { ar: 'أُوقف في {date}', en: 'Stopped on {date}', placeholder: true },
  discontinuedReasonTemplate: { ar: 'السبب: {reason}', en: 'Reason: {reason}', placeholder: true },
  completedLabel: { ar: 'مكتملة', en: 'Completed', placeholder: true },

  // B2 — empty state (board: States.dc.html's "ما فيه أدوية نشطة")
  emptyMedicinesTitle: { ar: 'لا توجد أدوية نشطة', en: 'No active medicines', placeholder: true },
  emptyMedicinesDescription: {
    ar: 'عندما يكتب الطبيب وصفة، ستظهر هنا مع مواعيد جرعاتها.',
    en: 'When a doctor writes a prescription, it will show up here with its dose times.',
    placeholder: true,
  },
  addPrescriptionAction: { ar: 'أضف وصفة بالصورة', en: 'Add a prescription by photo', placeholder: true },

  // B2 — a card's next/most-recent dose time (board: "اليوم ٨:٠٠ ص") — B2 never leaves "today"
  todayAtTemplate: { ar: 'اليوم {time}', en: 'Today {time}', placeholder: true },

  // B2/F2 — the lead alert always opens its own detail (audit C6: with a single alert it was a dead
  // end). C2 is "push from B2"; F2's opens the caregiver's read-only alert route.
  openAlertAction: { ar: 'افتح التنبيه', en: 'Open the alert', placeholder: true },

  // B2 — multiple alerts: lead with the most severe, link the rest (never a second danger fill)
  seeAllAlerts: { ar: 'عرض كل تنبيهات السلامة', en: 'See all safety alerts', placeholder: true },

  // B2 (Daylight) — the quiet line on a card whose medicine is part of a danger finding that still
  // stands (pending, or confirmed by the reviewer). Never on a cleared or lower-severity finding.
  partOfSeriousInteraction: { ar: 'ضمن تعارض خطير', en: 'Part of a serious interaction', placeholder: true },

  // B2 — InteractionAlert's required `title` (severityLabel is the smaller badge above it, already
  // built into the component from vocabulary.ts; this is the fuller sentence beside it — board:
  // "تعارض خطير بين دوائين")
  alertTitleDanger: { ar: 'تعارض خطير بين دواءين', en: 'Serious interaction between two medicines', placeholder: true },
  alertTitleWarning: { ar: 'تعارض يستحق الانتباه', en: 'An interaction worth noting', placeholder: true },
  alertTitleInfo: { ar: 'نتيجة فحص الدواء', en: 'Medicine check result', placeholder: true },
} satisfies Record<string, CopyEntry>;

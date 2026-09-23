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
  returnToToday: { ar: 'ارجع لليوم', en: 'Return to today', placeholder: true },

  // B1 — the date/count caption under the date heading (board: "اليوم · ٦ جرعات")
  doseCountTodayTemplate: { ar: 'اليوم · {count} جرعات', en: 'Today · {count} doses', placeholder: true },
  doseCountTemplate: { ar: '{count} جرعات', en: '{count} doses', placeholder: true },

  // B1 — tracking-off notice (G10/rule 3): gain-framed per UX Principles §13, never a warning
  trackingOffNotice: {
    ar: 'ما نتابع التزامك بالجرعات حاليًا. شغّل المتابعة عشان تشوف حالة كل جرعة هنا.',
    en: 'We are not tracking your doses right now. Turn tracking on to see each dose’s status here.',
    placeholder: true,
  },
  turnTrackingOn: { ar: 'شغّلها', en: 'Turn it on', placeholder: true },

  // B1 — empty day (a day with no scheduled dose at all — فاطمة's alternate-day cadence on 21 Sept)
  emptyDayTitle: { ar: 'ما فيه جرعات مجدولة هذا اليوم', en: 'No doses scheduled for this day', placeholder: true },
  emptyDayDescription: {
    ar: 'بعض الأدوية تُؤخذ يوم بعد يوم، فمو كل يوم له جرعة.',
    en: 'Some medicines are taken every other day, so not every day has a dose.',
    placeholder: true,
  },

  // B1 — a patient with no active prescription at all yet (بدر)
  emptyNoPrescriptionsTitle: { ar: 'ما عندك وصفات نشطة بعد', en: 'No active prescriptions yet', placeholder: true },
  emptyNoPrescriptionsDescription: {
    ar: 'أول ما يصرف لك الطبيب وصفة، بيظهر جدول جرعاتها هنا.',
    en: 'As soon as a doctor issues you a prescription, its dose schedule will appear here.',
    placeholder: true,
  },

  // B1 — dose amount (dosePerAdministration is 1 throughout the seed; the plural forms stay for
  // defensive correctness even though the seed never exercises them). One variant per Arabic plural
  // category, chosen by i18n/format.ts's formatCount — "٢ حبات" and "١١ حبات" are ungrammatical.
  // Also B3/F3's "Dose" row value (audit M9 — never a bare number).
  doseAmountOne: { ar: 'حبة واحدة', en: 'One tablet', placeholder: true },
  doseAmountTwo: { ar: 'حبتين', en: '{count} tablets', placeholder: true },
  doseAmountFewTemplate: { ar: '{count} حبات', en: '{count} tablets', placeholder: true },
  doseAmountManyTemplate: { ar: '{count} حبة', en: '{count} tablets', placeholder: true },

  // B2 — section headings (board: "الوصفات النشطة" / "أدوية سابقة")
  activeMedicinesTitle: { ar: 'الوصفات النشطة', en: 'Active prescriptions', placeholder: true },
  pastMedicinesTitle: { ar: 'أدوية سابقة', en: 'Past medicines', placeholder: true },
  pastMedicinesNote: {
    ar: 'الأدوية السابقة للعرض فقط — ما فيها طلب تجديد.',
    en: 'Past medicines are for reference only — no refill action.',
    placeholder: true,
  },
  discontinuedOnTemplate: { ar: 'أُوقف في {date}', en: 'Stopped on {date}', placeholder: true },
  discontinuedReasonTemplate: { ar: 'السبب: {reason}', en: 'Reason: {reason}', placeholder: true },
  completedLabel: { ar: 'مكتملة', en: 'Completed', placeholder: true },

  // B2 — empty state (board: States.dc.html's "ما فيه أدوية نشطة")
  emptyMedicinesTitle: { ar: 'ما فيه أدوية نشطة', en: 'No active medicines', placeholder: true },
  emptyMedicinesDescription: {
    ar: 'أول ما يصرف لك الطبيب وصفة، تظهر هنا مع جدول جرعاتها.',
    en: 'As soon as a doctor issues you a prescription, it will appear here with its dose schedule.',
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

  // B2 — InteractionAlert's required `title` (severityLabel is the smaller badge above it, already
  // built into the component from vocabulary.ts; this is the fuller sentence beside it — board:
  // "تعارض خطير بين دوائين")
  alertTitleDanger: { ar: 'تعارض خطير بين دوائين', en: 'Serious interaction between two drugs', placeholder: true },
  alertTitleWarning: { ar: 'تفاعل يستدعي الانتباه', en: 'An interaction worth noting', placeholder: true },
  alertTitleInfo: { ar: 'نتيجة فحص الدواء', en: 'Drug screening result', placeholder: true },
} satisfies Record<string, CopyEntry>;

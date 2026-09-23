/**
 * Copy catalogue, prescription group (WP4 bundle d — B3 prescription detail, B4 add/scan). Owned by
 * its bundle from its wave on; the lead created the stub and registered it in i18n/index.ts so
 * parallel bundles never touch a shared file (D-003). Every key is `placeholder: true` until the
 * owner's bilingual copy deck replaces it. Dose-status words, sector words and the shared "empty" /
 * "loading" / "retry" / "back" vocabulary live in `./vocabulary.ts` and `./shell.ts` and are reused
 * here, never redefined (CLAUDE.md: fixed vocabulary, everywhere).
 */
import type { CopyEntry } from './shell';

export const prescription = {
  // B3/B4 — shared field labels (every Prescription contract field, rendered via DetailRow on both
  // screens: B3 shows the saved record, B4's review step shows the still-unsaved draft)
  rxGenericLabel: { ar: 'الاسم العلمي', en: 'Generic name', placeholder: true },
  rxBrandLabel: { ar: 'الاسم التجاري', en: 'Brand name', placeholder: true },
  rxStrengthLabel: { ar: 'التركيز', en: 'Strength', placeholder: true },
  rxDoseLabel: { ar: 'الجرعة', en: 'Dose', placeholder: true },
  rxFrequencyLabel: { ar: 'عدد المرات يوميًا', en: 'Times per day', placeholder: true },
  rxPatternLabel: { ar: 'نمط الجرعات', en: 'Dosing pattern', placeholder: true },
  rxPatternDaily: { ar: 'يوميًا', en: 'Daily', placeholder: true },
  rxPatternAlternate: { ar: 'يوم بعد يوم', en: 'Every other day', placeholder: true },
  rxPatternOther: { ar: 'نمط آخر', en: 'Other pattern', placeholder: true },
  rxDoseTimesLabel: { ar: 'أوقات الجرعة', en: 'Dose times', placeholder: true },
  rxStartDateLabel: { ar: 'تبدأ من', en: 'Starts on', placeholder: true },
  rxDurationLabel: { ar: 'المدة', en: 'Duration', placeholder: true },
  // One variant per plural category (i18n/format.ts formatCount, audit M7): "٧ يومًا" was wrong for
  // rx-002/rx-007's seven days. The en text of two/few/many is never selected by English rules.
  rxDurationDaysOne: { ar: 'يوم واحد', en: '{count} day', placeholder: true },
  rxDurationDaysTwo: { ar: 'يومين', en: '{count} days', placeholder: true },
  rxDurationDaysFew: { ar: '{count} أيام', en: '{count} days', placeholder: true },
  rxDurationDaysMany: { ar: '{count} يومًا', en: '{count} days', placeholder: true },
  rxDurationDaysOther: { ar: '{count} يوم', en: '{count} days', placeholder: true },
  rxTimingLabel: { ar: 'مع الأكل', en: 'Relative to food', placeholder: true },
  rxRouteLabel: { ar: 'طريقة الاستخدام', en: 'Route of administration', placeholder: true },
  rxIndicationLabel: { ar: 'دواعي الاستخدام', en: 'Indication', placeholder: true },
  rxNotesLabel: { ar: 'ملاحظات', en: 'Special notes', placeholder: true },
  rxPrescriberLabel: { ar: 'الطبيب المعالج', en: 'Prescribing doctor', placeholder: true },
  rxPrescribedAtLabel: { ar: 'تاريخ الوصفة', en: 'Prescribed on', placeholder: true },
  rxStatusLabel: { ar: 'حالة الوصفة', en: 'Prescription status', placeholder: true },
  rxStatusActive: { ar: 'فعّالة', en: 'Active', placeholder: true },
  rxStatusCompleted: { ar: 'مكتملة', en: 'Completed', placeholder: true },
  rxStatusDiscontinued: { ar: 'موقوفة', en: 'Discontinued', placeholder: true },
  rxDiscontinuedReasonLabel: { ar: 'سبب الإيقاف', en: 'Reason stopped', placeholder: true },
  rxDiscontinuedAtLabel: { ar: 'تاريخ الإيقاف', en: 'Stopped on', placeholder: true },
  rxNeedsReviewNote: {
    ar: 'بعض بيانات هذي الوصفة تنتظر تأكيد المراجع الطبي.',
    en: 'Some fields on this prescription are waiting on a medical reviewer to confirm them.',
    placeholder: true,
  },

  // B3 — dispensing section
  rxDispensingTitle: { ar: 'الصرف', en: 'Dispensing', placeholder: true },
  rxUnitsPerPackageLabel: { ar: 'عدد الوحدات بالعبوة', en: 'Units per package', placeholder: true },
  rxTotalDispensedLabel: { ar: 'الكمية المصروفة', en: 'Quantity dispensed', placeholder: true },
  rxDispenseDateLabel: { ar: 'تاريخ الصرف', en: 'Dispensed on', placeholder: true },
  rxBrandDispensedLabel: { ar: 'الاسم التجاري المصروف', en: 'Brand actually dispensed', placeholder: true },

  // Strength units moved to vocabulary.ts (unitMg…unitIU) — ONE word per unit on every screen,
  // read through i18n/format.ts's formatStrength (audit M7). rx-008 still renders "50 mcg", never
  // converted (guard U).

  // B3 — dose history
  doseHistoryTitle: { ar: 'سجل الجرعات', en: 'Dose history', placeholder: true },
  doseHistoryTrackingOffNote: {
    ar: 'ما نتابع التزامك بالجرعات حاليًا، فسجل الجرعات يعرض الأوقات المخططة فقط بدون حالة.',
    en: 'We are not tracking your doses right now, so this history shows only the planned times, without a status.',
    placeholder: true,
  },
  doseHistoryEmpty: { ar: 'ما فيه جرعات مسجّلة بعد لهذي الوصفة.', en: 'No doses recorded yet for this prescription.', placeholder: true },
  // B3/F3 — the dose history is windowed to 7 days either side of today with a "show all" disclosure
  // (audit M8: 90 flat rows, future dates under "Dose history"). The planned part gets its own plain
  // heading. Deliberately NOT the status word `upcoming` ("قادمة", vocabulary.ts) — a section heading
  // that reads like a pill word next to real pills (a tracked patient) would blur the fixed vocabulary.
  doseHistoryPlannedTitle: { ar: 'الجرعات المخططة', en: 'Planned doses', placeholder: true },
  doseHistoryShowAllPastTemplate: { ar: 'اعرض كل الجرعات السابقة ({count})', en: 'Show all {count} past doses', placeholder: true },
  doseHistoryShowAllPlannedTemplate: { ar: 'اعرض كل الجرعات المخططة ({count})', en: 'Show all {count} planned doses', placeholder: true },
  doseHistoryShowFewer: { ar: 'اعرض أقل', en: 'Show fewer', placeholder: true },

  // B3 — refill link (D1 is bundle f's screen; this bundle only links to it)
  refillButtonLabel: { ar: 'اطلب تجديد الوصفة', en: 'Request a refill', placeholder: true },

  // B3 — record not found / not yours (G7 empty state for a detail route)
  b3EmptyTitle: { ar: 'ما لقينا هذي الوصفة', en: 'We could not find this prescription', placeholder: true },
  b3EmptyDescription: {
    ar: 'يمكن الرابط قديم أو الوصفة ما عادت متاحة لك.',
    en: 'The link may be old, or this prescription is no longer available to you.',
    placeholder: true,
  },
  b3EmptyAction: { ar: 'رجوع لأدويتي', en: 'Back to My Medicines', placeholder: true },

  // B4 — capture
  b4PhotoLabel: { ar: 'صورة الوصفة', en: 'Prescription photo', placeholder: true },
  b4PrescriberFieldsNote: {
    ar: 'الحقول اللي يملكها الطبيب ما تُكتب باليد من هنا — تُقرأ من صورة الوصفة أو تُراجَع من العيادة.',
    en: 'Fields the prescriber owns are never typed by hand here — they are read from the photo or reviewed by the clinic.',
    placeholder: true,
  },

  // B4 — analysing (visible text, not just the skeleton's screen-reader label — UX Principles §5:
  // "say what is happening and roughly how long")
  b4AnalysingTitle: { ar: 'جاري فحص الوصفة…', en: 'Analysing your prescription…', placeholder: true },
  b4AnalysingBody: { ar: 'يستغرق هذا عادة أقل من نصف دقيقة.', en: 'This usually takes less than half a minute.', placeholder: true },

  // B4 — review-and-confirm
  b4ReviewHeading: { ar: 'راجع قبل الحفظ', en: 'Review before saving', placeholder: true },
  b4NeedsReviewNoticeTitle: { ar: 'بعض الحقول تحتاج تأكيد', en: 'Some fields need confirmation', placeholder: true },
  b4NeedsReviewNoticeBody: {
    ar: 'قرأنا الوصفة، بس بعض الحقول ما كانت واضحة بالصورة. ما نعتبرها مؤكدة قبل ما تأكدها.',
    en: 'We read the prescription, but a few fields were not clear in the photo. We do not treat it as confirmed until you confirm it.',
    placeholder: true,
  },
  // One phrase for an uncertain field, used as both the visible mark and the screen-reader label
  // (audit m7: a separate short "Unclear" mark made every field read "unclear" twice).
  unclearFieldLabel: { ar: 'غير واضح بالصورة', en: 'Unclear in the photo', placeholder: true },
  b4ConfirmButton: { ar: 'تأكيد وحفظ', en: 'Confirm and save', placeholder: true },

  // B4 — could-not-read (explicit failure, never a fabricated record)
  b4UnreadableTitle: { ar: 'ما قدرنا نقرأ هذي الصورة', en: 'We could not read this photo', placeholder: true },
  b4UnreadableDescription: {
    ar: 'جرّب صورة أوضح للوصفة، بإضاءة جيدة وبدون أي جزء مقصوص من الاسم أو الجرعة.',
    en: 'Try a clearer photo of the prescription, in good light, with none of the name or dose cut off.',
    placeholder: true,
  },
  b4RetryLabel: { ar: 'حاول بصورة ثانية', en: 'Try another photo', placeholder: true },
  b4BackToMedicinesLabel: { ar: 'رجوع لأدويتي', en: 'Back to My Medicines', placeholder: true },
} satisfies Record<string, CopyEntry>;

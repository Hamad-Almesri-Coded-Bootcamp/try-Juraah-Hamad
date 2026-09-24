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
  rxFrequencyLabel: { ar: 'عدد المرات يوميًا', en: 'Times a day', placeholder: true },
  rxPatternLabel: { ar: 'نمط الجرعات', en: 'How often', placeholder: true },
  rxPatternDaily: { ar: 'يوميًا', en: 'Daily', placeholder: true },
  rxPatternAlternate: { ar: 'كل يومين', en: 'Every other day', placeholder: true },
  rxPatternOther: { ar: 'نمط آخر', en: 'Other pattern', placeholder: true },
  rxDoseTimesLabel: { ar: 'أوقات الجرعة', en: 'Dose times', placeholder: true },
  rxStartDateLabel: { ar: 'تبدأ من', en: 'Starts on', placeholder: true },
  rxDurationLabel: { ar: 'المدة', en: 'Duration', placeholder: true },
  // One variant per plural category (i18n/format.ts formatCount, audit M7): "٧ يومًا" was wrong for
  // rx-002/rx-007's seven days. The en text of two/few/many is never selected by English rules.
  rxDurationDaysOne: { ar: 'يوم واحد', en: '{count} day', placeholder: true },
  rxDurationDaysTwo: { ar: 'يومان', en: '{count} days', placeholder: true },
  rxDurationDaysFew: { ar: '{count} أيام', en: '{count} days', placeholder: true },
  rxDurationDaysMany: { ar: '{count} يومًا', en: '{count} days', placeholder: true },
  rxDurationDaysOther: { ar: '{count} يوم', en: '{count} days', placeholder: true },
  rxTimingLabel: { ar: 'توقيته مع الأكل', en: 'Timing with food', placeholder: true },
  rxRouteLabel: { ar: 'طريقة الاستخدام', en: 'How to take it', placeholder: true },
  rxIndicationLabel: { ar: 'دواعي الاستخدام', en: 'What it’s for', placeholder: true },
  rxNotesLabel: { ar: 'ملاحظات', en: 'Notes', placeholder: true },
  rxPrescriberLabel: { ar: 'الطبيب المعالج', en: 'Prescribed by', placeholder: true },
  rxPrescribedAtLabel: { ar: 'تاريخ الوصفة', en: 'Prescribed on', placeholder: true },
  rxStatusLabel: { ar: 'حالة الوصفة', en: 'Prescription status', placeholder: true },
  rxStatusActive: { ar: 'نشطة', en: 'Active', placeholder: true },
  rxStatusCompleted: { ar: 'مكتملة', en: 'Completed', placeholder: true },
  rxStatusDiscontinued: { ar: 'موقوفة', en: 'Discontinued', placeholder: true },
  rxDiscontinuedReasonLabel: { ar: 'سبب الإيقاف', en: 'Why it was stopped', placeholder: true },
  rxDiscontinuedAtLabel: { ar: 'تاريخ الإيقاف', en: 'Stopped on', placeholder: true },
  rxNeedsReviewNote: {
    ar: 'بعض بيانات هذه الوصفة بانتظار تأكيد مختص طبي.',
    en: 'A medical reviewer still needs to confirm some details on this prescription.',
    placeholder: true,
  },
  // AP-10 / CR-089 — "being checked" (D12): a new, unflagged prescription whose interaction screening
  // has not answered yet (features/prescription/screening-state.ts). B2's card line and B3's notice.
  // Information, never an alert: nothing has been found, and nothing is asked of the patient.
  rxBeingCheckedLine: { ar: 'قيد الفحص مع أدويتك الأخرى', en: 'Being checked against your other medicines', placeholder: true },
  rxBeingCheckedTitle: {
    ar: 'نفحص هذا الدواء مع أدويتك الأخرى',
    en: 'We are checking this medicine against your other medicines',
    placeholder: true,
  },
  rxBeingCheckedBody: {
    ar: 'يستغرق ذلك عادةً بضع دقائق. إن وجدنا ما يستدعي انتباهك فستجده في قسم السلامة.',
    en: 'This usually takes a few minutes. If we find anything that needs your attention, you will see it under Safety.',
    placeholder: true,
  },

  // B3 (Daylight) — the three facts under the header, the details card and its one line naming every
  // field that holds no value (each field is still named, none dropped: "every contract field").
  b3TakingTitle: { ar: 'المقدار والمواعيد', en: 'How much and when', placeholder: true },
  b3EachTime: { ar: 'في كل مرة', en: 'each time', placeholder: true },
  b3FromDateTemplate: { ar: 'ابتداءً من {date}', en: 'from {date}', placeholder: true },
  b3SupplyTitle: { ar: 'الكمية المتبقية', en: 'Supply left', placeholder: true },
  b3DetailsTitle: { ar: 'كل التفاصيل', en: 'All details', placeholder: true },
  b3NotRecordedTemplate: { ar: 'لم يُسجَّل لهذه الوصفة: {fields}.', en: 'Not recorded for this prescription: {fields}.', placeholder: true },
  // B4's review step: the same line, for a field the photo did not carry at all (an unclear one is
  // marked in its own row instead).
  b4NotInPhotoTemplate: { ar: 'غير موجود في الصورة: {fields}.', en: 'Not in the photo: {fields}.', placeholder: true },
  b4CaptureTitle: { ar: 'صوّر الوصفة', en: 'Take a photo of the prescription', placeholder: true },

  // B3 — dispensing section
  rxDispensingTitle: { ar: 'من الصيدلية', en: 'From the pharmacy', placeholder: true },
  rxUnitsPerPackageLabel: { ar: 'عدد الوحدات في العبوة', en: 'Units per pack', placeholder: true },
  rxTotalDispensedLabel: { ar: 'الكمية المصروفة', en: 'Amount dispensed', placeholder: true },
  rxDispenseDateLabel: { ar: 'تاريخ الصرف', en: 'Dispensed on', placeholder: true },
  rxBrandDispensedLabel: { ar: 'الاسم التجاري المصروف', en: 'Brand dispensed', placeholder: true },

  // Strength units moved to vocabulary.ts (unitMg…unitIU) — ONE word per unit on every screen,
  // read through i18n/format.ts's formatStrength (audit M7). rx-008 still renders "50 mcg", never
  // converted (guard U).

  // B3 — dose history
  doseHistoryTitle: { ar: 'سجل الجرعات', en: 'Dose history', placeholder: true },
  doseHistoryTrackingOffNote: {
    ar: 'عند تفعيل متابعة الجرعات، ستظهر هنا حالة كل جرعة. أما الآن فيعرض السجل الأوقات المخططة.',
    en: 'With dose tracking on, each dose here would show its status. For now, you see the planned times.',
    placeholder: true,
  },
  doseHistoryEmpty: { ar: 'لا توجد جرعات سابقة لهذه الوصفة بعد.', en: 'No past doses for this prescription yet.', placeholder: true },
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
  b3EmptyTitle: { ar: 'لم نجد هذه الوصفة', en: 'We couldn’t find this prescription', placeholder: true },
  b3EmptyDescription: {
    ar: 'ربما يكون الرابط قديمًا، أو لم تعد هذه الوصفة متاحة لك.',
    en: 'The link may be old, or this prescription isn’t available to you anymore.',
    placeholder: true,
  },
  b3EmptyAction: { ar: 'العودة إلى أدويتي', en: 'Back to My Medicines', placeholder: true },

  // B4 — capture
  b4PhotoLabel: { ar: 'صورة الوصفة', en: 'Prescription photo', placeholder: true },
  b4PrescriberFieldsNote: {
    ar: 'نقرأ بيانات الوصفة من الصورة نيابةً عنك. وإذا لم يتضح شيء منها، يراجعه مختص طبي.',
    en: 'We read the prescription’s details from the photo for you. If anything is unclear, a medical reviewer checks it.',
    placeholder: true,
  },

  // B4 — analysing (visible text, not just the skeleton's screen-reader label — UX Principles §5:
  // "say what is happening and roughly how long")
  b4AnalysingTitle: { ar: 'جارٍ قراءة الوصفة…', en: 'Reading your prescription…', placeholder: true },
  b4AnalysingBody: { ar: 'يستغرق هذا عادةً أقل من نصف دقيقة.', en: 'This usually takes less than half a minute.', placeholder: true },

  // B4 — review-and-confirm
  b4ReviewHeading: { ar: 'راجع قبل الحفظ', en: 'Review before saving', placeholder: true },
  b4NeedsReviewNoticeTitle: { ar: 'بعض البيانات تحتاج إلى مراجعة', en: 'Some details need checking', placeholder: true },
  b4NeedsReviewNoticeBody: {
    ar: 'قرأنا الوصفة، لكن بعض البيانات لم تكن واضحة في الصورة. بعد أن تحفظها، سيراجع مختص طبي هذه البيانات.',
    en: 'We read the prescription, but some details weren’t clear in the photo. Once you save it, a medical reviewer will check them.',
    placeholder: true,
  },
  // One phrase for an uncertain field, used as both the visible mark and the screen-reader label
  // (audit m7: a separate short "Unclear" mark made every field read "unclear" twice).
  unclearFieldLabel: { ar: 'غير واضح في الصورة', en: 'Unclear in the photo', placeholder: true },
  b4ConfirmButton: { ar: 'تأكيد وحفظ', en: 'Confirm and save', placeholder: true },

  // B4 — could-not-read (explicit failure, never a fabricated record)
  b4UnreadableTitle: { ar: 'لم نتمكن من قراءة هذه الصورة', en: 'We couldn’t read this photo', placeholder: true },
  b4UnreadableDescription: {
    ar: 'جرّب صورة أخرى للوصفة في إضاءة جيدة، يظهر فيها اسم الدواء والجرعة كاملين.',
    en: 'Try another photo of the prescription in good light, with the medicine name and dose fully in view.',
    placeholder: true,
  },
  b4RetryLabel: { ar: 'جرّب صورة أخرى', en: 'Try another photo', placeholder: true },
  b4BackToMedicinesLabel: { ar: 'العودة إلى أدويتي', en: 'Back to My Medicines', placeholder: true },
} satisfies Record<string, CopyEntry>;

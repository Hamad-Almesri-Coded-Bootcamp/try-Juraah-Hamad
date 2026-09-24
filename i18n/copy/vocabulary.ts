/**
 * The shared vocabulary (G9): the fixed words every component and screen uses for a dose status, a
 * sector, a severity and a review state — plus the design system's own fallback strings, kept under
 * the SAME keys as design/ds-fallback-strings.json so the ported components read them here.
 * Created by the lead so WP2 can start; WP1 owns it from here and appends `actor_*` and `event_*`
 * labels. Every entry is `placeholder: true` until the owner's bilingual deck replaces it.
 */
import type { Copy } from './shell';

export const vocabulary = {
  upcoming: { ar: 'قادمة', en: 'Upcoming', placeholder: true },
  taken_on_time: { ar: 'أُخذت في موعدها', en: 'Taken on time', placeholder: true },
  taken_late: { ar: 'أُخذت متأخرة', en: 'Taken late', placeholder: true },
  missed: { ar: 'فائتة', en: 'Missed', placeholder: true },
  public: { ar: 'قطاع عام', en: 'Public sector', placeholder: true },
  private: { ar: 'قطاع خاص', en: 'Private sector', placeholder: true },
  severityDanger: { ar: 'تعارض خطير', en: 'Serious interaction', placeholder: true },
  severityWarning: { ar: 'استشر طبيبك', en: 'Check with your doctor', placeholder: true },
  severityInfo: { ar: 'للعلم', en: 'For your information', placeholder: true },
  pending_medical_review: {
    ar: 'ما زال مختص طبي يراجع هذا التنبيه، والنتيجة ليست نهائية بعد.',
    en: 'A medical reviewer is still checking this. It isn’t a final answer yet.',
    placeholder: true,
  },
  reviewed: { ar: 'راجعه مختص طبي.', en: 'Checked by a medical reviewer.', placeholder: true },
  auto_cleared: { ar: 'فُحص تلقائيًا، ولا يوجد تعارض.', en: 'Checked automatically. No interaction found.', placeholder: true },
  loading: { ar: 'جارٍ التحميل', en: 'Loading', placeholder: true },
  required: { ar: 'مطلوب', en: 'required', placeholder: true },
  empty: { ar: 'غير مسجّل', en: 'Not recorded', placeholder: true },
  openDetail: { ar: 'اعرض التفاصيل', en: 'Open details', placeholder: true },
  on: { ar: 'مفعّل', en: 'On', placeholder: true },
  off: { ar: 'متوقف', en: 'Off', placeholder: true },
  close: { ar: 'إغلاق', en: 'Close', placeholder: true },
  retry: { ar: 'حاول مرة أخرى', en: 'Try again', placeholder: true },
  back: { ar: 'رجوع', en: 'Back', placeholder: true },
  daysLeft: { ar: 'أيام متبقية من الكمية', en: 'days of supply left', placeholder: true },
  // DepletionMeter's caption, one variant per plural category (audit M7: "70 أيام" is ungrammatical —
  // an Arabic count agrees with its noun). Chosen by i18n/format.ts's formatDaysLeft via
  // Intl.PluralRules; `daysLeft` above stays only because it mirrors design/ds-fallback-strings.json.
  // The en text of the two/few/many variants is never selected by English rules (one/other only).
  daysLeftZero: { ar: 'يتبقى أقل من يوم من الكمية', en: 'Less than a day of supply left', placeholder: true },
  daysLeftOne: { ar: 'يتبقى يوم واحد من الكمية', en: '{count} day of supply left', placeholder: true },
  daysLeftTwo: { ar: 'يتبقى يومان من الكمية', en: '{count} days of supply left', placeholder: true },
  daysLeftFew: { ar: 'يتبقى {count} أيام من الكمية', en: '{count} days of supply left', placeholder: true },
  daysLeftMany: { ar: 'يتبقى {count} يومًا من الكمية', en: '{count} days of supply left', placeholder: true },
  daysLeftOther: { ar: 'يتبقى {count} يوم من الكمية', en: '{count} days of supply left', placeholder: true },
  lowSupply: { ar: 'الكمية أوشكت على النفاد', en: 'Running low', placeholder: true },
  dismiss: { ar: 'إخفاء', en: 'Dismiss', placeholder: true },
  copy: { ar: 'نسخ', en: 'Copy', placeholder: true },
  copied: { ar: 'تم النسخ', en: 'Copied', placeholder: true },
  remove: { ar: 'إزالة', en: 'Remove', placeholder: true },
  takePhoto: { ar: 'التقط صورة للوصفة', en: 'Take a photo', placeholder: true },
  choosePhoto: { ar: 'اختر صورة', en: 'Choose a photo', placeholder: true },
  analysing: { ar: 'جارٍ الفحص…', en: 'Checking…', placeholder: true },
  secondsLeft: { ar: 'ثانية متبقية', en: 'seconds left', placeholder: true },
  countdownDone: { ar: 'تمت الموافقة', en: 'Approved', placeholder: true },
  countdownLapsed: { ar: 'انتهى الوقت', en: 'Time ran out', placeholder: true },
  stepOf: { ar: 'الخطوة', en: 'Step', placeholder: true },
  of: { ar: 'من', en: 'of', placeholder: true },
  asOf: { ar: 'آخر تحديث', en: 'As of', placeholder: true },
  simulatedRole: { ar: 'دور تجريبي', en: 'Simulated role', placeholder: true },
  viewingRecordOf: { ar: 'أنت تطّلع على ملف', en: 'Viewing the record of', placeholder: true },

  // Strength units — ONE word per unit for every screen (audit M7; UX Principles §3: no Latin
  // abbreviation in Arabic). Read only through i18n/format.ts's formatStrength. The Arabic spellings
  // are the ones prescription.ts and caregiving.ts already carried; the clinic's `ملغ` is the outlier.
  unitMg: { ar: 'ملغم', en: 'mg', placeholder: true },
  unitMcg: { ar: 'ميكروغرام', en: 'mcg', placeholder: true },
  unitG: { ar: 'غرام', en: 'g', placeholder: true },
  unitMl: { ar: 'مل', en: 'ml', placeholder: true },
  unitIU: { ar: 'وحدة دولية', en: 'IU', placeholder: true },

  // Actor labels (6) — human labels for AuditEvent.actor.role. X1 is the one surface that may also
  // show the literal role string beside the label (CR-010); every other screen shows the label only.
  actor_patient: { ar: 'المريض', en: 'Patient', placeholder: true },
  actor_caregiver: { ar: 'مقدّم الرعاية', en: 'Caregiver', placeholder: true },
  actor_reviewer: { ar: 'المراجع الطبي', en: 'Medical reviewer', placeholder: true },
  actor_admin: { ar: 'مسؤول النظام', en: 'System admin', placeholder: true },
  actor_agent: { ar: 'مساعد المتابعة', en: 'Adherence assistant', placeholder: true },
  actor_system: { ar: 'النظام', en: 'System', placeholder: true },

  // Event-type labels (25) — human labels for AuditEvent.type, for X1 and the patient activity feed
  // (E2). X1 may also show the literal type string beside the label (CR-010).
  event_prescription_added: { ar: 'إضافة وصفة', en: 'Prescription added', placeholder: true },
  event_prescription_discontinued: { ar: 'إيقاف وصفة', en: 'Prescription discontinued', placeholder: true },
  event_prescription_field_confirmed: { ar: 'تأكيد بيانات وصفة', en: 'Prescription details confirmed', placeholder: true },
  event_prescription_returned_to_clinic: { ar: 'إعادة وصفة للعيادة', en: 'Prescription returned to clinic', placeholder: true },
  event_alert_raised: { ar: 'تنبيه سلامة جديد', en: 'Safety alert raised', placeholder: true },
  event_alert_reviewed: { ar: 'مراجعة تنبيه سلامة', en: 'Safety alert reviewed', placeholder: true },
  event_dose_status_recorded: { ar: 'تسجيل حالة جرعة', en: 'Dose status recorded', placeholder: true },
  event_schedule_recomputed: { ar: 'تحديث الجدول', en: 'Schedule updated', placeholder: true },
  event_refill_requested: { ar: 'طلب تجديد', en: 'Refill requested', placeholder: true },
  event_refill_status_changed: { ar: 'تغيّر حالة طلب التجديد', en: 'Refill status changed', placeholder: true },
  event_caregiver_invited: { ar: 'دعوة مقدّم رعاية', en: 'Caregiver invited', placeholder: true },
  event_caregiver_invite_accepted: { ar: 'قبول دعوة مقدّم رعاية', en: 'Caregiver invitation accepted', placeholder: true },
  event_caregiver_invite_declined: { ar: 'رفض دعوة مقدّم رعاية', en: 'Caregiver invitation declined', placeholder: true },
  event_caregiver_invite_expired: { ar: 'انتهاء صلاحية دعوة', en: 'Caregiver invitation expired', placeholder: true },
  event_caregiver_invite_cancelled: { ar: 'إلغاء دعوة مقدّم رعاية', en: 'Caregiver invitation cancelled', placeholder: true },
  event_caregiver_revoked: { ar: 'سحب صلاحية مقدّم رعاية', en: 'Caregiver access revoked', placeholder: true },
  event_caregiver_self_unlinked: { ar: 'ألغى مقدّم الرعاية ارتباطه', en: 'Caregiver unlinked themselves', placeholder: true },
  event_messaging_connected: { ar: 'ربط تيليجرام', en: 'Telegram connected', placeholder: true },
  event_messaging_disconnected: { ar: 'فصل تيليجرام', en: 'Telegram disconnected', placeholder: true },
  event_push_enabled: { ar: 'تفعيل إشعارات المتصفح', en: 'Browser notifications turned on', placeholder: true },
  event_push_disabled: { ar: 'إيقاف إشعارات المتصفح', en: 'Browser notifications turned off', placeholder: true },
  event_tracking_enabled: { ar: 'تفعيل متابعة الجرعات', en: 'Dose tracking turned on', placeholder: true },
  event_tracking_disabled: { ar: 'إيقاف متابعة الجرعات', en: 'Dose tracking turned off', placeholder: true },
  event_signed_in: { ar: 'تسجيل دخول', en: 'Signed in', placeholder: true },
  event_signed_out: { ar: 'تسجيل خروج', en: 'Signed out', placeholder: true },
} as const satisfies Copy<string>;

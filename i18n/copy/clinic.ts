/**
 * Copy catalogue, clinic group (WP4 bundle i — X0, G1s, G2s, G3s, X1). Every key is `placeholder:
 * true` until the owner's bilingual deck lands (D-003). Dose-status, sector, severity and
 * review-state words are NEVER redefined here — they come from `vocabulary.ts` (reused via
 * `copy.vocabulary.*`), and the actor/event human labels X1 needs are already there too
 * (`actor_*`, `event_*`, added by WP1 for exactly this screen). A handful of X0's states reuse
 * `copy.identity.*` verbatim (the sign-in field, the countdown, and — word for word — the
 * `no_claims` refusal, so X0's refusal text is byte-identical to A1's, per rule 6).
 */
import type { CopyEntry } from './shell';

export const clinic = {
  // A plain list separator — not "copy" so much as punctuation, but guard 7 (no Arabic literal in ui
  // code) still wants it sourced from the catalogue rather than typed inline in a `.join(...)`.
  listSeparator: { ar: '، ', en: ', ' },
  g3sFieldStartDatePlaceholder: { ar: 'YYYY-MM-DD', en: 'YYYY-MM-DD', placeholder: true },
  // -----------------------------------------------------------------------------------------
  // X0 — clinic entry (`/clinic`) and role chooser (`/clinic/choose`)
  // -----------------------------------------------------------------------------------------
  x0Kicker: { ar: 'دور محاكى · نسخة أكاديمية', en: 'Simulated role — academic build', placeholder: true },
  x0Title: { ar: 'دخول العيادة', en: 'Clinic entry', placeholder: true },
  x0Body: {
    ar: 'هذا المدخل غير معلن في الصفحة الرئيسية ولا داخل تطبيق المريض — وهذا تنظيم مو حماية. الحماية فحص الدور على السيرفر، مثل أي مسار ثاني.',
    en: 'This entry is not advertised on the landing page or inside the patient app — that is filing, not protection. Protection is the server-side role check, exactly like every other route.',
    placeholder: true,
  },
  x0TryAnotherNumber: { ar: 'جرّب رقمًا آخر', en: 'Try another number', placeholder: true },
  x0ChooserTitle: { ar: 'اختر دورك', en: 'Choose your role', placeholder: true },
  x0ChooserBody: {
    ar: 'رقمك المدني مربوط بدورين هنا. تقدر تبدّل بينهما بعدين بدون تسجيل خروج.',
    en: 'Your Civil ID is linked to two roles here. You can switch between them later without signing out.',
    placeholder: true,
  },
  x0ChooserReviewerTitle: { ar: 'المراجعة الطبية', en: 'Medical review', placeholder: true },
  x0ChooserReviewerBody: {
    ar: 'قائمة التعارضات الخطيرة، وقائمة الوصفات اللي تنتظر تأكيد حقول.',
    en: 'The queue of serious interactions, and the queue of prescriptions waiting on field confirmation.',
    placeholder: true,
  },
  x0ChooserReviewerButton: { ar: 'افتح قوائم المراجعة', en: 'Open the review queues', placeholder: true },
  x0ChooserAdminTitle: { ar: 'إدارة النظام', en: 'System administration', placeholder: true },
  x0ChooserAdminBody: {
    ar: 'سجل التدقيق فقط — ولا سجل إكلينيكي ولا إجراء طبي.',
    en: 'The audit log only — no clinical record, no clinical action.',
    placeholder: true,
  },
  x0ChooserAdminButton: { ar: 'افتح سجل التدقيق', en: 'Open the audit log', placeholder: true },

  // -----------------------------------------------------------------------------------------
  // G1s / G3s shared shell — the segmented switch between the two reviewer queues
  // -----------------------------------------------------------------------------------------
  reviewerQueuesTitle: { ar: 'قوائم المراجعة', en: 'Review queues', placeholder: true },
  queueSwitchLabel: { ar: 'التبديل بين قوائم المراجعة', en: 'Switch between review queues', placeholder: true },
  findingsOptionTemplate: { ar: 'تعارضات ({count})', en: 'Findings ({count})', placeholder: true },
  fieldsOptionTemplate: { ar: 'تأكيد حقول ({count})', en: 'Field confirmation ({count})', placeholder: true },

  // -----------------------------------------------------------------------------------------
  // G1s — reviewer queue, interaction findings
  // -----------------------------------------------------------------------------------------
  g1sCountTemplate: { ar: '{count} تنبيه ينتظر قرارًا', en: '{count} finding waiting on a decision', placeholder: true },
  g1sEmptyTitle: { ar: 'ما فيه تنبيهات تنتظر', en: 'No findings waiting', placeholder: true },
  g1sEmptyBody: { ar: 'قائمة المراجعة فارغة الحين.', en: 'The review queue is empty right now.', placeholder: true },
  // CR-036: waiting time, precomputed by getReviewQueue (`waitedMinutes`) and only formatted here.
  g1sWaitedTemplate: { ar: 'منذ {value} {unit}', en: 'waiting {value} {unit}', placeholder: true },
  g1sWaitedJustNow: { ar: 'منذ قليل', en: 'just now', placeholder: true },
  g1sUnitMinutes: { ar: 'دقيقة', en: 'minutes', placeholder: true },
  g1sUnitHours: { ar: 'ساعة', en: 'hours', placeholder: true },
  g1sUnitDays: { ar: 'يوم', en: 'days', placeholder: true },

  // -----------------------------------------------------------------------------------------
  // G2s — reviewer decision
  // -----------------------------------------------------------------------------------------
  g2sTitle: { ar: 'قرار المراجعة', en: 'Reviewer decision', placeholder: true },
  g2sSourceHeading: { ar: 'المصدر المرجعي', en: 'Source citation', placeholder: true },
  g2sInvolvedHeading: { ar: 'الوصفتان المعنيّتان', en: 'Involved prescriptions', placeholder: true },
  g2sContextHeading: { ar: 'سياق المريض — قراءة فقط', en: 'Patient context — read only', placeholder: true },
  g2sActiveListHeading: { ar: 'قائمة الأدوية الفعالة', en: 'Active medicines', placeholder: true },
  g2sRecentDosesHeading: { ar: 'آخر الجرعات', en: 'Recent doses', placeholder: true },
  g2sNoRecentDoses: { ar: 'ولا جرعة مسجّلة بعد.', en: 'No doses recorded yet.', placeholder: true },
  g2sNoTrackingNote: {
    ar: 'هذا المريض ما فعّل متابعة الجرعات — الجدول خطة بدون حالات.',
    en: "This patient has not turned on adherence tracking — the schedule is a plan, with no statuses.",
    placeholder: true,
  },
  g2sNoTrackingSubnote: {
    ar: 'ولا جرعة هنا تتحوّل إلى «فائتة» بسبب عدم الرد.',
    en: 'No dose here is ever turned into "missed" for going unanswered.',
    placeholder: true,
  },
  g2sDecisionHeading: { ar: 'القرار', en: 'Decision', placeholder: true },
  g2sNoteLabel: { ar: 'ملاحظة (اختياري)', en: 'Note (optional)', placeholder: true },
  g2sNotePlaceholder: { ar: 'بلغة بسيطة، شنو يسوي المريض الآن', en: 'In plain words, what the patient should do now', placeholder: true },
  g2sConfirmButton: { ar: 'تأكيد الخطر', en: 'Confirm the risk', placeholder: true },
  g2sClearButton: { ar: 'إخلاء التنبيه', en: 'Clear the alert', placeholder: true },
  g2sReviewOnlyNote: {
    ar: 'المراجع يغيّر حالة المراجعة فقط — ما يعدّل حقلًا في الوصفة ولا حالة جرعة.',
    en: 'The reviewer changes only the review state — never a prescription field, never a dose status.',
    placeholder: true,
  },
  g2sConfirmSheetTitle: { ar: 'تأكيد الخطر', en: 'Confirm the risk', placeholder: true },
  g2sConfirmSheetBody: {
    ar: 'بعد التأكيد ينتقل التنبيه إلى «تمت المراجعة»، ويصل إشعار للمريض ومقدّم رعايته.',
    en: 'Once confirmed, the alert moves to "reviewed" and the patient and their caregiver are notified.',
    placeholder: true,
  },
  g2sClearSheetTitle: { ar: 'إخلاء التنبيه', en: 'Clear the alert', placeholder: true },
  g2sClearSheetBody: {
    ar: 'بعد الإخلاء ينتقل التنبيه إلى «تمت المراجعة»، ويصل إشعار للمريض ومقدّم رعايته.',
    en: 'Once cleared, the alert moves to "reviewed" and the patient and their caregiver are notified.',
    placeholder: true,
  },
  g2sSheetConfirmLabel: { ar: 'تأكيد', en: 'Confirm', placeholder: true },

  // -----------------------------------------------------------------------------------------
  // G3s — reviewer queue, field confirmation (list + detail)
  // -----------------------------------------------------------------------------------------
  g3sEmptyTitle: { ar: 'ما فيه وصفات تنتظر تأكيد', en: 'No prescriptions waiting on confirmation', placeholder: true },
  g3sEmptyBody: { ar: 'قائمة تأكيد الحقول فارغة الحين.', en: 'The field-confirmation queue is empty right now.', placeholder: true },
  g3sUncertainFieldsTemplate: { ar: 'الحقول غير الواضحة: {fields}', en: 'Uncertain fields: {fields}', placeholder: true },
  g3sOpenButton: { ar: 'افتح الصورة وأكّد القيم', en: 'Open the image and confirm the values', placeholder: true },
  // CR-037: the queue view now also carries already-returned rows (`fieldReviewStatus: 'returned'`).
  g3sReturnedHeading: { ar: 'وصفات أُرجعت للعيادة', en: 'Returned to the issuing clinic', placeholder: true },
  g3sReturnedRowStatus: { ar: 'أُرجعت للعيادة', en: 'Returned to clinic', placeholder: true },
  g3sFieldStrength: { ar: 'التركيز', en: 'Strength', placeholder: true },
  g3sFieldFrequency: { ar: 'عدد مرات الجرعة يوميًا', en: 'Doses per day', placeholder: true },
  g3sFieldStartDate: { ar: 'تاريخ البدء', en: 'Start date', placeholder: true },
  g3sFieldDoseTimes: { ar: 'أوقات الجرعة', en: 'Dose times', placeholder: true },
  g3sFieldBrand: { ar: 'الاسم التجاري', en: 'Brand name', placeholder: true },
  g3sDetailTitle: { ar: 'تأكيد بيانات الوصفة', en: 'Confirm prescription fields', placeholder: true },
  g3sSourceImageHeading: { ar: 'الصورة الأصلية', en: 'Original image', placeholder: true },
  g3sSourceImageAlt: { ar: 'صورة الوصفة كما وصلت — بخط اليد', en: 'The prescription image as received — handwritten', placeholder: true },
  g3sFieldsHeading: { ar: 'القيم — للتأكيد أو التصحيح', en: 'Values — to confirm or correct', placeholder: true },
  g3sDoseTimesHelper: {
    ar: 'أوقات مفصولة بفاصلة، مثل ٠٨:٠٠، ٢٠:٠٠',
    en: 'Times separated by a comma, e.g. 08:00, 20:00',
    placeholder: true,
  },
  g3sConfirmNoteLabel: { ar: 'ملاحظة (اختياري)', en: 'Note (optional)', placeholder: true },
  g3sConfirmButton: { ar: 'تأكيد القيم', en: 'Confirm the values', placeholder: true },
  g3sReturnButton: { ar: 'إرجاع للعيادة', en: 'Return to the issuing clinic', placeholder: true },
  g3sOutOfScheduleTitle: { ar: 'خارج الجدول ومحرك الفحص', en: 'Out of the schedule and the screening engine', placeholder: true },
  g3sOutOfScheduleBody: {
    ar: 'الوصفة المعلّمة ما تولّد ولا جرعة وما تدخل فحص التعارضات لين تتأكد حقولها هنا.',
    en: 'A flagged prescription generates no dose and enters no interaction screening until its fields are confirmed here.',
    placeholder: true,
  },
  g3sNoOtherEditPathNote: {
    ar: 'تصحيح الحقول يصير فقط من هذا المسار المسجّل — ما فيه أي طريق ثاني يعدّل حقلًا إكلينيكيًا بعد إنشاء الوصفة.',
    en: 'A field is corrected only through this audited path — there is no other route to edit a clinical field once a prescription exists.',
    placeholder: true,
  },
  g3sReturnReasonLabel: { ar: 'سبب الإرجاع', en: 'Reason for return', placeholder: true },
  g3sReturnReasonPlaceholder: { ar: 'ليش ترجع الوصفة للعيادة؟', en: 'Why is this going back to the clinic?', placeholder: true },
  g3sReturnReasonRequiredError: { ar: 'اكتب السبب قبل الإرجاع', en: 'Write a reason before returning it', placeholder: true },
  g3sConfirmSheetTitle: { ar: 'تأكيد القيم', en: 'Confirm the values', placeholder: true },
  g3sConfirmSheetBody: {
    ar: 'بعد التأكيد تدخل الوصفة الجدول وفحص التعارضات بالقيم المكتوبة أعلاه.',
    en: 'Once confirmed, the prescription enters the schedule and interaction screening with the values above.',
    placeholder: true,
  },
  g3sReturnSheetTitle: { ar: 'إرجاع للعيادة', en: 'Return to the clinic', placeholder: true },
  g3sReturnSheetBody: {
    ar: 'تبقى الوصفة خارج الجدول وخارج الفحص، والسبب يوصل للعيادة المُصدرة.',
    en: 'The prescription stays out of the schedule and out of screening, and the reason reaches the issuing clinic.',
    placeholder: true,
  },
  g3sSheetReturnLabel: { ar: 'إرجاع', en: 'Return it', placeholder: true },
  g3sSheetDismiss: { ar: 'تراجع', en: 'Back out', placeholder: true },

  // -----------------------------------------------------------------------------------------
  // X1 — system audit log
  // -----------------------------------------------------------------------------------------
  x1Title: { ar: 'سجل التدقيق', en: 'Audit log', placeholder: true },
  x1FilterActorLabel: { ar: 'الفاعل', en: 'Actor', placeholder: true },
  x1FilterTypeLabel: { ar: 'نوع الحدث', en: 'Event type', placeholder: true },
  x1FilterPeriodLabel: { ar: 'الفترة', en: 'Period', placeholder: true },
  x1FilterAllActors: { ar: 'كل الفاعلين', en: 'All actors', placeholder: true },
  x1FilterAllTypes: { ar: 'كل الأنواع', en: 'All types', placeholder: true },
  x1FilterAllTime: { ar: 'كل الفترة', en: 'All time', placeholder: true },
  x1FilterLast7Days: { ar: 'آخر ٧ أيام', en: 'Last 7 days', placeholder: true },
  x1FilterLast30Days: { ar: 'آخر ٣٠ يومًا', en: 'Last 30 days', placeholder: true },
  x1ProofNoticeTitle: { ar: 'لحظة الإثبات', en: 'The proof moment', placeholder: true },
  x1ProofNoticeBodyTemplate: {
    ar: '{count} نتيجة مفلترة على «تسجيل حالة جرعة» — كلها فاعلها مساعد المتابعة أو النظام، ولا واحدة من الواجهة.',
    en: '{count} result filtered to "dose status recorded" — every one from the adherence assistant or the system, none from the interface.',
    placeholder: true,
  },
  x1ScopeNote: {
    ar: 'السجل يعرض الحدث والفاعل والوقت ومرجع المريض فقط — بدون قوائم أدوية أو نص تنبيه أو تفاصيل جرعة، وهو سجل لا يُعدَّل ولا تُحذف منه أي فقرة.',
    en: 'The log shows what happened, the actor, when, and a patient reference only — no medication list, alert text or dose detail, and nothing here is ever edited or deleted.',
    placeholder: true,
  },
  x1EmptyTitle: { ar: 'ما فيه نتائج مطابقة', en: 'No matching results', placeholder: true },
  x1EmptyBody: { ar: 'جرّب تغيير الفلاتر.', en: 'Try changing the filters.', placeholder: true },
  x1ColumnTime: { ar: 'الوقت', en: 'Time', placeholder: true },
  x1ColumnEvent: { ar: 'الحدث', en: 'Event', placeholder: true },
  x1ColumnActor: { ar: 'الفاعل', en: 'Actor', placeholder: true },
  x1ColumnPatient: { ar: 'المريض', en: 'Patient', placeholder: true },
  x1ColumnDescription: { ar: 'الوصف', en: 'Description', placeholder: true },
} satisfies Record<string, CopyEntry>;

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
  g3sFieldStartDatePlaceholder: { ar: 'سنة-شهر-يوم', en: 'YYYY-MM-DD', placeholder: true },
  // -----------------------------------------------------------------------------------------
  // X0 — clinic entry (`/clinic`) and role chooser (`/clinic/choose`)
  // -----------------------------------------------------------------------------------------
  x0Kicker: { ar: 'دور محاكاة', en: 'Simulated role', placeholder: true },
  x0Title: { ar: 'دخول العيادة', en: 'Clinic sign-in', placeholder: true },
  x0Subtitle: { ar: 'للمراجعة الطبية وإدارة النظام', en: 'For medical review and system administration', placeholder: true },
  x0Body: {
    ar: 'لا يوجد رابط لهذه الصفحة في الصفحة الرئيسية ولا في تطبيق المريض، وهذا للتنظيم فقط، وليس للحماية. ما يحميها هو تحقق الخادم من دورك، كما في كل الصفحات الأخرى.',
    en: 'This page isn’t linked from the home page or the patient app. That’s only to keep things tidy, not to protect it. What protects it is the server checking your role, as on every other page.',
    placeholder: true,
  },
  // The clinic's error state: the shared body sends the reader back to Today, a patient screen.
  clinicErrorBody: {
    ar: 'لم نتمكّن من إتمام ذلك. حاول مرة أخرى بعد قليل.',
    en: 'We couldn’t finish that. Please try again in a moment.',
    placeholder: true,
  },
  x0TryAnotherNumber: { ar: 'جرّب رقمًا آخر', en: 'Try another number', placeholder: true },
  x0ChooserTitle: { ar: 'اختر دورك', en: 'Choose your role', placeholder: true },
  x0ChooserBody: {
    ar: 'رقمك المدني مرتبط بدورين هنا. يمكنك التبديل بينهما لاحقًا دون تسجيل الخروج.',
    en: 'Your Civil ID is linked to two roles here. You can switch between them later without signing out.',
    placeholder: true,
  },
  x0ChooserReviewerTitle: { ar: 'المراجعة الطبية', en: 'Medical review', placeholder: true },
  x0ChooserReviewerBody: {
    ar: 'التعارضات الخطيرة التي تنتظر قرارًا، والوصفات التي تحتاج بياناتها إلى تأكيد.',
    en: 'Serious interactions waiting for a decision, and prescriptions whose details need confirming.',
    placeholder: true,
  },
  x0ChooserReviewerButton: { ar: 'افتح قوائم المراجعة', en: 'Open the review queues', placeholder: true },
  x0ChooserAdminTitle: { ar: 'إدارة النظام', en: 'System administration', placeholder: true },
  x0ChooserAdminBody: {
    ar: 'سجل التدقيق فقط، دون أي سجل طبي أو إجراء طبي.',
    en: 'Only the audit log. No medical records and no medical actions.',
    placeholder: true,
  },
  x0ChooserAdminButton: { ar: 'افتح سجل التدقيق', en: 'Open the audit log', placeholder: true },

  // -----------------------------------------------------------------------------------------
  // G1s / G3s shared shell — the segmented switch between the two reviewer queues
  // -----------------------------------------------------------------------------------------
  reviewerQueuesTitle: { ar: 'قوائم المراجعة', en: 'Review queues', placeholder: true },
  queueSwitchLabel: { ar: 'اختر القائمة', en: 'Choose a queue', placeholder: true },
  findingsOptionTemplate: { ar: 'تعارضات ({count})', en: 'Interactions ({count})', placeholder: true },
  fieldsOptionTemplate: { ar: 'تأكيد حقول ({count})', en: 'Details to confirm ({count})', placeholder: true },

  // -----------------------------------------------------------------------------------------
  // G1s — reviewer queue, interaction findings
  // -----------------------------------------------------------------------------------------
  g1sCountTemplate: { ar: 'بانتظار قرار: {count}', en: 'Waiting for a decision: {count}', placeholder: true },
  g1sEmptyTitle: { ar: 'لا توجد تعارضات بانتظار المراجعة', en: 'No interactions waiting for review', placeholder: true },
  g1sEmptyBody: {
    ar: 'ستظهر هنا التعارضات الجديدة التي تحتاج إلى مراجعة طبية.',
    en: 'New interactions that need a medical review will appear here.',
    placeholder: true,
  },
  // CR-036: waiting time, precomputed by getReviewQueue (`waitedMinutes`) and only formatted here.
  // One form per plural category (formatCount): an Arabic count agrees with its noun, so "منذ ٢ يوم"
  // is wrong and "منذ يومين" is right.
  g1sWaitedJustNow: { ar: 'منذ قليل', en: 'just now', placeholder: true },
  g1sWaitedMinutesOne: { ar: 'منذ دقيقة واحدة', en: 'waiting {count} minute', placeholder: true },
  g1sWaitedMinutesTwo: { ar: 'منذ دقيقتين', en: 'waiting {count} minutes', placeholder: true },
  g1sWaitedMinutesFew: { ar: 'منذ {count} دقائق', en: 'waiting {count} minutes', placeholder: true },
  g1sWaitedMinutesMany: { ar: 'منذ {count} دقيقة', en: 'waiting {count} minutes', placeholder: true },
  g1sWaitedMinutesOther: { ar: 'منذ {count} دقيقة', en: 'waiting {count} minutes', placeholder: true },
  g1sWaitedHoursOne: { ar: 'منذ ساعة واحدة', en: 'waiting {count} hour', placeholder: true },
  g1sWaitedHoursTwo: { ar: 'منذ ساعتين', en: 'waiting {count} hours', placeholder: true },
  g1sWaitedHoursFew: { ar: 'منذ {count} ساعات', en: 'waiting {count} hours', placeholder: true },
  g1sWaitedHoursMany: { ar: 'منذ {count} ساعة', en: 'waiting {count} hours', placeholder: true },
  g1sWaitedHoursOther: { ar: 'منذ {count} ساعة', en: 'waiting {count} hours', placeholder: true },
  g1sWaitedDaysOne: { ar: 'منذ يوم واحد', en: 'waiting {count} day', placeholder: true },
  g1sWaitedDaysTwo: { ar: 'منذ يومين', en: 'waiting {count} days', placeholder: true },
  g1sWaitedDaysFew: { ar: 'منذ {count} أيام', en: 'waiting {count} days', placeholder: true },
  g1sWaitedDaysMany: { ar: 'منذ {count} يومًا', en: 'waiting {count} days', placeholder: true },
  g1sWaitedDaysOther: { ar: 'منذ {count} يوم', en: 'waiting {count} days', placeholder: true },

  // -----------------------------------------------------------------------------------------
  // G2s — reviewer decision
  // -----------------------------------------------------------------------------------------
  g2sTitle: { ar: 'قرار المراجعة', en: 'Reviewer decision', placeholder: true },
  g2sSourceHeading: { ar: 'المصدر المرجعي', en: 'Source', placeholder: true },
  g2sInvolvedHeading: { ar: 'الوصفات المعنيّة', en: 'Prescriptions involved', placeholder: true },
  // The bridge between the two prescriptions (V2Clinic): said once, only when the sectors differ.
  g2sCrossSectorNote: {
    ar: 'وصفة من القطاع العام وأخرى من القطاع الخاص.',
    en: 'One prescription from the public sector, one from the private sector.',
    placeholder: true,
  },
  g2sBridgeConnector: { ar: 'تتعارض مع', en: 'interacts with', placeholder: true },
  g2sFindingPatientTemplate: { ar: 'المريض: {name}', en: 'Patient: {name}', placeholder: true },
  g2sFindingRaisedTemplate: { ar: 'رُصد في {date}، الساعة {time}', en: 'Found on {date} at {time}', placeholder: true },
  // The band's review line, for the reviewer (the patient-facing sentence speaks about a reviewer).
  g2sPendingReviewLabel: {
    ar: 'بانتظار قرارك. يرى المريض الآن أن مختصًا طبيًا ما زال يراجع هذا التنبيه.',
    en: 'Waiting for your decision. The patient currently sees that a medical reviewer is still checking this alert.',
    placeholder: true,
  },
  g2sContextHeading: { ar: 'سياق المريض (للاطلاع فقط)', en: 'Patient context (read-only)', placeholder: true },
  g2sActiveListHeading: { ar: 'الأدوية الحالية', en: 'Current medicines', placeholder: true },
  g2sRecentDosesHeading: { ar: 'آخر الجرعات', en: 'Recent doses', placeholder: true },
  g2sNoRecentDoses: { ar: 'لم تُسجَّل أي جرعة بعد.', en: 'No doses recorded yet.', placeholder: true },
  g2sNoTrackingNote: {
    ar: 'متابعة الجرعات متوقفة لدى هذا المريض، لذلك جدوله خطة فقط، ولا يبيّن ما إذا كانت الجرعات قد أُخذت.',
    en: 'Dose tracking is off for this patient, so their schedule is a plan only. It doesn’t show whether doses were taken.',
    placeholder: true,
  },
  // CR-115: the decision is framed as the doctor's answer to the AI's finding, and the note is the
  // doctor's required justification (the owner's answer; G2s's "optional" no longer holds).
  g2sDecisionHeading: { ar: 'هل توافق على ما رصده ذكاء جرعة؟', en: 'Do you agree with Juraa AI’s finding?', placeholder: true },
  g2sDecisionIntro: {
    ar: 'اقرأ ما رصده ذكاء جرعة أعلاه، واكتب مبرّرك، ثم اختر.',
    en: 'Read Juraa AI’s finding above, write your justification, then choose.',
    placeholder: true,
  },
  g2sNoteLabel: { ar: 'مبرّر قرارك', en: 'Your justification', placeholder: true },
  g2sNoteHelper: { ar: 'يراه المريض مع قرارك.', en: 'The patient sees this with your decision.', placeholder: true },
  g2sNoteRequiredError: {
    ar: 'اكتب مبرّرًا قبل أن تختار، فالمريض يراه مع قرارك.',
    en: 'Write a justification before you choose. The patient sees it with your decision.',
    placeholder: true,
  },
  g2sSheetJustificationLabel: { ar: 'مبرّرك', en: 'Your justification', placeholder: true },
  g2sNotePlaceholder: {
    ar: 'بكلمات بسيطة: ماذا ينبغي أن يفعل المريض الآن؟',
    en: 'In plain words: what should the patient do now?',
    placeholder: true,
  },
  g2sConfirmButton: { ar: 'أوافق: الخطر قائم', en: 'Agree: it’s a risk', placeholder: true },
  g2sClearButton: { ar: 'لا أوافق: لا خطر', en: 'Disagree: no risk', placeholder: true },
  g2sReviewOnlyNote: {
    ar: 'قرارك يغيّر مراجعة هذا التنبيه فقط، ولا يغيّر أي وصفة أو جرعة.',
    en: 'Your decision changes only this alert’s review, never a prescription or a dose.',
    placeholder: true,
  },
  g2sConfirmSheetTitle: { ar: 'تأكيد الخطر', en: 'Confirm the risk', placeholder: true },
  g2sConfirmSheetBody: {
    ar: 'سيرى المريض ومقدّم رعايته أن مختصًا طبيًا أكّد هذا الخطر. لا يمكن تغيير القرار بعد ذلك.',
    en: 'The patient and their caregiver will see that a medical reviewer confirmed this risk. You can’t change the decision afterwards.',
    placeholder: true,
  },
  g2sClearSheetTitle: { ar: 'استبعاد الخطر', en: 'Clear the risk', placeholder: true },
  g2sClearSheetBody: {
    ar: 'سيرى المريض ومقدّم رعايته أن مختصًا طبيًا استبعد هذا الخطر. لا يمكن تغيير القرار بعد ذلك.',
    en: 'The patient and their caregiver will see that a medical reviewer cleared this risk. You can’t change the decision afterwards.',
    placeholder: true,
  },
  g2sSheetConfirmLabel: { ar: 'تأكيد', en: 'Confirm', placeholder: true },

  // -----------------------------------------------------------------------------------------
  // CR-115 — the AI marker (G1s, G2s; the AI is named Juraa AI, the owner's answer) and the clinic dashboard card (G1s/G3s, X1)
  // -----------------------------------------------------------------------------------------
  aiRaisedTag: { ar: 'رصده ذكاء جرعة', en: 'Raised by Juraa AI', placeholder: true },
  aiRaisedShort: { ar: 'رصده ذكاء جرعة', en: 'Raised by Juraa AI', placeholder: true },
  g2sAiFindingNote: {
    ar: 'رصد ذكاء جرعة هذا التعارض، ولا يُعدّ نهائيًا حتى تقرّر أنت.',
    en: 'Juraa AI flagged this interaction. It isn’t final until you decide.',
    placeholder: true,
  },
  dashProfileLabel: { ar: 'ملفك', en: 'Your profile', placeholder: true },
  dashStatsLabel: { ar: 'نظرة سريعة', en: 'At a glance', placeholder: true },
  dashStatFindingsWaiting: { ar: 'تعارضات بانتظار قرار', en: 'Interactions waiting', placeholder: true },
  dashStatSerious: { ar: 'منها خطيرة', en: 'Serious among them', placeholder: true },
  dashStatMyDecisions: { ar: 'قراراتك المسجّلة', en: 'Your recorded decisions', placeholder: true },
  dashStatEvents: { ar: 'أحداث في السجل', en: 'Events in the log', placeholder: true },
  dashStatDoctorDecisions: { ar: 'قرارات الأطباء', en: 'Doctor decisions', placeholder: true },
  // {actor} is X1's own actor word (vocabulary.actor_agent), so the tile names what it counts.
  dashStatByActorTemplate: { ar: 'أحداث من {actor}', en: 'Events by {actor}', placeholder: true },
  dashAdminScopeNote: {
    ar: 'تشمل هذه الأرقام السجل كله، مهما كانت التصفية أدناه.',
    en: 'These counts cover the whole log, whatever the filters below show.',
    placeholder: true,
  },

  // -----------------------------------------------------------------------------------------
  // G3s — reviewer queue, field confirmation (list + detail)
  // -----------------------------------------------------------------------------------------
  g3sEmptyTitle: { ar: 'لا توجد وصفات بانتظار التأكيد', en: 'No prescriptions waiting to be confirmed', placeholder: true },
  g3sEmptyBody: {
    ar: 'ستظهر هنا الوصفات التي تعذّرت قراءة بعض بياناتها بوضوح.',
    en: 'Prescriptions with details that couldn’t be read clearly will appear here.',
    placeholder: true,
  },
  g3sUncertainFieldsTemplate: { ar: 'لم تُقرأ بوضوح: {fields}', en: 'Not read clearly: {fields}', placeholder: true },
  g3sPendingHeading: { ar: 'بانتظار التأكيد', en: 'Waiting to be confirmed', placeholder: true },
  // CR-037: the queue view now also carries already-returned rows (`fieldReviewStatus: 'returned'`).
  g3sReturnedHeading: { ar: 'وصفات أُرجعت للعيادة', en: 'Returned to the issuing clinic', placeholder: true },
  g3sReturnedRowStatus: { ar: 'أُرجعت للعيادة', en: 'Returned to the clinic', placeholder: true },
  g3sFieldStrength: { ar: 'التركيز', en: 'Strength', placeholder: true },
  g3sFieldFrequency: { ar: 'عدد الجرعات يوميًا', en: 'Doses per day', placeholder: true },
  g3sFieldStartDate: { ar: 'تاريخ البدء', en: 'Start date', placeholder: true },
  g3sFieldDoseTimes: { ar: 'أوقات الجرعة', en: 'Dose times', placeholder: true },
  g3sFieldBrand: { ar: 'الاسم التجاري', en: 'Brand name', placeholder: true },
  g3sDetailTitle: { ar: 'تأكيد بيانات الوصفة', en: 'Confirm the prescription details', placeholder: true },
  g3sReturnedTitle: { ar: 'وصفة أُرجعت إلى العيادة', en: 'Sent back to the clinic', placeholder: true },
  g3sSourceImageHeading: { ar: 'الصورة الأصلية', en: 'Original image', placeholder: true },
  g3sSourceImageAlt: { ar: 'صورة الوصفة كما وصلت، مكتوبة بخط اليد', en: 'The prescription image as it arrived, handwritten', placeholder: true },
  g3sFieldsHeading: { ar: 'أكّد القيم أو صحّحها', en: 'Confirm or correct the values', placeholder: true },
  g3sDoseTimesHelper: {
    ar: 'افصل بين الأوقات بفاصلة، مثل: ٠٨:٠٠، ٢٠:٠٠',
    en: 'Separate the times with a comma, for example 08:00, 20:00',
    placeholder: true,
  },
  g3sConfirmNoteLabel: { ar: 'ملاحظة (اختياري)', en: 'Note (optional)', placeholder: true },
  g3sNotReadHint: { ar: 'لم تُقرأ بوضوح في الصورة', en: 'Not read clearly in the image', placeholder: true },
  g3sNumberInvalidError: { ar: 'اكتب رقمًا فقط', en: 'Write a number only', placeholder: true },
  g3sStartDateInvalidError: { ar: 'اكتب التاريخ بهذا الشكل: سنة-شهر-يوم', en: 'Write the date as YYYY-MM-DD', placeholder: true },
  g3sDoseTimesInvalidError: {
    ar: 'اكتب كل وقت بالساعة والدقيقة، مثل ٠٨:٠٠',
    en: 'Write each time as hours and minutes, for example 08:00',
    placeholder: true,
  },
  g3sReturnHeading: { ar: 'أو أرجعها إلى العيادة', en: 'Or send it back to the clinic', placeholder: true },
  g3sConfirmButton: { ar: 'تأكيد القيم', en: 'Confirm the values', placeholder: true },
  g3sReturnButton: { ar: 'إرجاع للعيادة', en: 'Return to the issuing clinic', placeholder: true },
  g3sOutOfScheduleTitle: { ar: 'معلّقة حتى التأكيد', en: 'On hold until confirmed', placeholder: true },
  g3sOutOfScheduleBody: {
    ar: 'إلى أن تُؤكَّد بياناتها هنا، لا تضيف هذه الوصفة أي جرعة إلى الجدول، ولا تدخل فحص التعارضات.',
    en: 'Until its details are confirmed here, this prescription adds no doses to the schedule and isn’t checked for interactions.',
    placeholder: true,
  },
  // The returned view has its own sentence: "until confirmed" is wrong for a prescription that went back.
  g3sReturnedBody: {
    ar: 'أُرجعت هذه الوصفة إلى العيادة التي أصدرتها، فلا تضيف أي جرعة إلى الجدول، ولا تدخل فحص التعارضات.',
    en: 'This prescription was sent back to the clinic that issued it, so it adds no doses to the schedule and isn’t checked for interactions.',
    placeholder: true,
  },
  g3sReturnedOnLabel: { ar: 'تاريخ الإرجاع', en: 'Returned on', placeholder: true },
  g3sNoOtherEditPathNote: {
    ar: 'هذا هو المكان الوحيد لتصحيح بيانات الوصفة، وكل تصحيح يُحفظ في سجل التدقيق.',
    en: 'This is the only place a prescription’s details can be corrected, and every correction is saved in the audit log.',
    placeholder: true,
  },
  g3sReturnReasonLabel: { ar: 'سبب الإرجاع', en: 'Reason for return', placeholder: true },
  g3sReturnReasonPlaceholder: { ar: 'لماذا تُعاد الوصفة إلى العيادة؟', en: 'Why is this going back to the clinic?', placeholder: true },
  g3sReturnReasonRequiredError: { ar: 'اكتب السبب قبل الإرجاع', en: 'Write a reason before you return it', placeholder: true },
  g3sConfirmSheetTitle: { ar: 'تأكيد القيم', en: 'Confirm the values', placeholder: true },
  g3sConfirmSheetBody: {
    ar: 'ستدخل الوصفة جدول المريض وفحص التعارضات بالقيم المكتوبة أعلاه. لا يمكن تعديل هذه القيم بعد ذلك.',
    en: 'The prescription will join the patient’s schedule and the interaction checks with the values above. You can’t edit these values afterwards.',
    placeholder: true,
  },
  g3sReturnSheetTitle: { ar: 'إرجاع للعيادة', en: 'Return to the clinic', placeholder: true },
  g3sReturnSheetBody: {
    ar: 'ستبقى الوصفة خارج الجدول وخارج فحص التعارضات، ويصل سببك إلى العيادة التي أصدرتها. لا يمكن التراجع عن ذلك.',
    en: 'The prescription will stay out of the schedule and the interaction checks, and your reason goes to the clinic that issued it. You can’t undo this.',
    placeholder: true,
  },
  g3sSheetReturnLabel: { ar: 'إرجاع', en: 'Return it', placeholder: true },
  g3sSheetDismiss: { ar: 'إلغاء', en: 'Cancel', placeholder: true },

  // -----------------------------------------------------------------------------------------
  // X1 — system audit log
  // -----------------------------------------------------------------------------------------
  x1Title: { ar: 'سجل التدقيق', en: 'Audit log', placeholder: true },
  x1FilterActorLabel: { ar: 'المنفّذ', en: 'Done by', placeholder: true },
  x1FilterTypeLabel: { ar: 'نوع الحدث', en: 'Event type', placeholder: true },
  x1FilterPeriodLabel: { ar: 'الفترة', en: 'Period', placeholder: true },
  x1FilterAllActors: { ar: 'الجميع', en: 'Everyone', placeholder: true },
  x1FilterAllTypes: { ar: 'كل الأحداث', en: 'All events', placeholder: true },
  x1FilterAllTime: { ar: 'كل الأوقات', en: 'All time', placeholder: true },
  x1FilterLast7Days: { ar: 'آخر ٧ أيام', en: 'Last 7 days', placeholder: true },
  x1FilterLast30Days: { ar: 'آخر ٣٠ يومًا', en: 'Last 30 days', placeholder: true },
  x1ProofNoticeTitle: { ar: 'من سجّل حالات هذه الجرعات', en: 'Who recorded these dose statuses', placeholder: true },
  x1ProofNoticeBodyTemplate: {
    ar: 'نتائج «تسجيل حالة جرعة»: {count}. جاءت كلها من ذكاء جرعة أو النظام، ولم يأتِ أي منها من شاشات التطبيق.',
    en: 'Results for “Dose status recorded”: {count}. All of them came from Juraa AI or the system, and none from a screen in the app.',
    placeholder: true,
  },
  // The proof notice must stay true whatever the filters show (CLAUDE.md rule 1).
  x1ProofNoticeMixedBodyTemplate: {
    ar: 'نتائج «تسجيل حالة جرعة»: {count}. بعضها لم يأتِ من ذكاء جرعة أو النظام، فانظر المنفّذ في كل سطر.',
    en: 'Results for “Dose status recorded”: {count}. Some of them didn’t come from Juraa AI or the system. See who did each one below.',
    placeholder: true,
  },
  x1ProofNoticeFilteredBody: {
    ar: 'هذه النتائج مصفّاة حسب المنفّذ. اختر «الجميع» في خانة المنفّذ لترى من سجّل كل حالات الجرعات.',
    en: 'These results are filtered by who did them. Choose “Everyone” under “Done by” to see who recorded every dose status.',
    placeholder: true,
  },
  x1ProofNoticeNoneBody: {
    ar: 'لم تُسجَّل أي حالة جرعة في هذه الفترة.',
    en: 'No dose status was recorded in this period.',
    placeholder: true,
  },
  x1CountTemplate: { ar: 'النتائج: {count}', en: 'Results: {count}', placeholder: true },
  x1ScopeNote: {
    ar: 'يعرض هذا السجل ما حدث، ومن قام به، ومتى، والمريض المعني فقط، ولا يعرض الأدوية أو نصوص التنبيهات أو تفاصيل الجرعات. والسجل لا يُعدَّل، ولا يُحذف منه شيء.',
    en: 'This log shows only what happened, who did it, when, and which patient it concerns. It never shows medicines, alert text or dose details. Nothing in it can be edited or deleted.',
    placeholder: true,
  },
  x1EmptyTitle: { ar: 'لا توجد نتائج مطابقة', en: 'Nothing matches these filters', placeholder: true },
  x1EmptyBody: { ar: 'جرّب تغيير خيارات التصفية.', en: 'Try changing the filters.', placeholder: true },
  x1ColumnTime: { ar: 'الوقت', en: 'Time', placeholder: true },
  x1ColumnEvent: { ar: 'الحدث', en: 'Event', placeholder: true },
  x1ColumnActor: { ar: 'المنفّذ', en: 'Done by', placeholder: true },
  x1ColumnPatient: { ar: 'المريض', en: 'Patient', placeholder: true },
  x1ColumnDescription: { ar: 'الوصف', en: 'Description', placeholder: true },

  // G2s "Why they interact" (CR-113, the owner's approved mockup of 2026-09-26). The level words are
  // DDInter's own grading (Major / Moderate / Minor), not the product's severity vocabulary.
  whyHeading: { ar: 'سبب التعارض', en: 'Why they interact', placeholder: true },
  whyDraftLabel: { ar: 'مسودة بالذكاء الاصطناعي · راجِعها مع المصدر', en: 'AI draft · check it against the source', placeholder: true },
  whyCheckedTemplate: { ar: 'راجعه الطبيب المختص · {date}', en: 'Checked by the reviewing doctor · {date}', placeholder: true },
  whyCheckedLabel: { ar: 'راجعه الطبيب المختص', en: 'Checked by the reviewing doctor', placeholder: true },
  whyLevelTemplate: { ar: 'مستوى DDInter: {level}', en: 'DDInter level: {level}', placeholder: true },
  whyLevelMajor: { ar: 'شديد', en: 'Major', placeholder: true },
  whyLevelModerate: { ar: 'متوسط', en: 'Moderate', placeholder: true },
  whyLevelMinor: { ar: 'طفيف', en: 'Minor', placeholder: true },
  whyNoSummary: {
    ar: 'لا يوجد ملخص بالذكاء الاصطناعي لهذا الزوج بعد. نص DDInter الأصلي أدناه.',
    en: 'No AI summary for this pair yet. DDInter’s own text is below.',
    placeholder: true,
  },
  whySourceToggle: { ar: 'نص DDInter الأصلي', en: 'DDInter’s own text', placeholder: true },
  whyMechanismLabel: { ar: 'التعارض', en: 'Interaction', placeholder: true },
  whyManagementLabel: { ar: 'التعامل معه', en: 'Management', placeholder: true },
  whyRecordLabel: { ar: 'السجل', en: 'Record', placeholder: true },
  whySourceLabel: { ar: 'المصدر', en: 'Source', placeholder: true },
  whyOpenRecord: { ar: 'فتح سجل DDInter', en: 'Open the DDInter record', placeholder: true },
  whyOpensInNewTab: { ar: '(يفتح في نافذة جديدة)', en: '(opens in a new tab)', placeholder: true },
  whyLicence: { ar: 'نص من DDInter 2.0، برخصة CC BY-NC-SA 4.0', en: 'Text from DDInter 2.0, licensed CC BY-NC-SA 4.0', placeholder: true },
  whyAiSummaryTag: { ar: 'ملخص بالذكاء الاصطناعي لنص DDInter', en: 'AI summary of DDInter’s text', placeholder: true },
  whyAiNote: {
    ar: 'كتبه الذكاء الاصطناعي من نص DDInter فقط. قرارك أدناه يسجّل أنك راجعته.',
    en: 'Written by AI from DDInter’s text only. Your decision below records that you checked it.',
    placeholder: true,
  },
} satisfies Record<string, CopyEntry>;

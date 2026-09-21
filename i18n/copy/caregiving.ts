/**
 * Copy catalogue, caregiving group (WP4 bundle h): F0 consent, F1 caregiver management, F2 caregiver
 * home, F3 caregiver detail access, F4 caregiver profile & notifications, F5 caregiver help. Owned by
 * this bundle from wave 1 on (D-003). Every key is `placeholder: true` until the owner's bilingual
 * copy deck lands (docs/Seed Dataset.md, "Still to be written by the project owner"). A `{token}`
 * key is a template filled by `features/shell/interpolate.ts` with a DATA value (a first name, a
 * relationship, a date) — never with another catalogue string.
 */
import type { CopyEntry } from './shell';

export const caregiving = {
  // ---------------------------------------------------------------------------------------------
  // F0 — caregiver invitation consent (/[locale]/invitation)
  // ---------------------------------------------------------------------------------------------
  f0Kicker: { ar: 'طلب ربط · قرارك أنت', en: 'Linking request — your decision', placeholder: true },
  f0PendingTitleTemplate: { ar: '{name} يطلب ربطك بملفه الدوائي', en: '{name} is asking to be linked to their medical record', placeholder: true },
  f0RelationshipTemplate: { ar: 'يقول إنك {relationship}.', en: 'Says you are their {relationship}.', placeholder: true },
  f0CanSeeTitle: { ar: 'لو قبلت، راح تشوف:', en: 'If you accept, you will see:', placeholder: true },
  f0CanSee1: { ar: 'قائمة الأدوية', en: 'The medication list', placeholder: true },
  f0CanSee2: { ar: 'الجدول اليومي للجرعات', en: 'The daily dose schedule', placeholder: true },
  f0CanSee3: { ar: 'تنبيهات السلامة والتعارضات', en: 'Safety alerts and interactions', placeholder: true },
  f0CanSee4: { ar: 'سجل الأحداث', en: 'The activity log', placeholder: true },
  f0CannotTitle: { ar: 'وما راح تقدر:', en: 'And you will never be able to:', placeholder: true },
  f0Cannot1: { ar: 'تسجيل جرعة نيابةً عن المريض', en: 'Record a dose on the patient’s behalf', placeholder: true },
  f0Cannot2: { ar: 'تعديل وصفة أو جرعة', en: 'Change a prescription or a dose', placeholder: true },
  f0Cannot3: { ar: 'تغيير أي إعداد في الحساب', en: 'Change any setting in the account', placeholder: true },
  f0Cannot4: { ar: 'التصرف نيابةً عن المريض بأي شكل', en: 'Act for the patient in any way', placeholder: true },
  f0WillBeToldTitle: { ar: 'راح يعرف المريض لو قبلت', en: 'The patient will know if you accept', placeholder: true },
  f0WillBeToldBody: {
    ar: 'يوصله إشعار داخل التطبيق باسمك، ويقدر يسحب الصلاحية في أي وقت.',
    en: 'They get an in-app notice with your name, and can withdraw your access at any time.',
    placeholder: true,
  },
  f0Accept: { ar: 'قبول', en: 'Accept', placeholder: true },
  f0Decline: { ar: 'رفض', en: 'Decline', placeholder: true },
  f0EqualNote: {
    ar: 'القبول والرفض بنفس الحجم والوزن، وتقدر تفصل نفسك في أي وقت بعدين.',
    en: 'Accepting and declining are the same size and weight, and you can unlink yourself at any time later.',
    placeholder: true,
  },
  f0AcceptedTitle: { ar: 'تم الربط', en: 'You’re linked', placeholder: true },
  f0AcceptedBodyTemplate: {
    ar: 'صار عندك وصول للقراءة على ملف {name}. تم إبلاغه.',
    en: 'You now have read-only access to {name}’s record. They have been told.',
    placeholder: true,
  },
  f0AcceptedOpenTemplate: { ar: 'افتح ملف {name}', en: 'Open {name}’s record', placeholder: true },
  f0AcceptedFootnote: { ar: 'بعدها فقط تنفتح البيانات.', en: 'The data only opens after this.', placeholder: true },
  f0DeclinedTitle: { ar: 'تم رفض الطلب', en: 'The request was declined', placeholder: true },
  f0DeclinedBody: {
    ar: 'ما تم منحك أي وصول، وما انكشف لك أي شيء عن الملف. إذا كان الطلب بالغلط، ما تحتاج تسوي شيء.',
    en: 'No access was granted, and nothing about the record was revealed to you. If this was a mistake, there is nothing you need to do.',
    placeholder: true,
  },
  f0DeclinedFootnote: { ar: 'ما فيه ضغط لإعادة النظر، وما انكشف شيء.', en: 'No pressure to reconsider, and nothing was revealed.', placeholder: true },
  f0BackHome: { ar: 'رجوع للصفحة الرئيسية', en: 'Back to the home page', placeholder: true },
  f0UnavailableTitle: { ar: 'هذا الطلب ما عاد متاح', en: 'This request is no longer available', placeholder: true },
  f0UnavailableBody: { ar: 'انتهت مهلته، أو ألغاه المريض.', en: 'It expired, or the patient cancelled it.', placeholder: true },
  f0UnavailableRetry: {
    ar: 'إذا لسه تبي المتابعة، اطلب من المريض يرسل دعوة جديدة.',
    en: 'If you still want to follow their care, ask the patient to send a new invitation.',
    placeholder: true,
  },
  f0UnavailableFootnote: { ar: 'تقول الحقيقة، وما تعرض أي إجراء.', en: 'It tells the truth, and offers no action.', placeholder: true },

  // ---------------------------------------------------------------------------------------------
  // F1 — caregiver management, patient side (/[locale]/app/more/caregivers)
  // ---------------------------------------------------------------------------------------------
  f1Title: { ar: 'مقدّمو الرعاية', en: 'Caregivers', placeholder: true },
  f1InviteButton: { ar: 'دعوة مقدّم رعاية', en: 'Invite a caregiver', placeholder: true },
  f1EmptyTitle: { ar: 'ما فيه مقدّمو رعاية بعد', en: 'No caregivers yet', placeholder: true },
  f1EmptyBody: {
    ar: 'ادعُ فردًا من العائلة يتابع أدويتك — يشوف فقط، وما يقدر يغيّر شيء.',
    en: 'Invite a family member to follow your medications — they can only view, never change anything.',
    placeholder: true,
  },
  f1StatusActiveTemplate: { ar: 'نشِط · قبِل {date}', en: 'Active · accepted {date}', placeholder: true },
  f1StatusPendingTemplate: { ar: 'بانتظار القبول · تنتهي {date}', en: 'Awaiting acceptance · expires {date}', placeholder: true },
  f1StatusDeclined: { ar: 'رفض الدعوة', en: 'Declined the invitation', placeholder: true },
  f1StatusExpired: { ar: 'انتهت مهلة الدعوة', en: 'Invitation expired', placeholder: true },
  f1StatusRevokedAccepted: { ar: 'انتهى وصوله', en: 'Access ended', placeholder: true },
  f1StatusRevokedCancelled: { ar: 'أُلغيت الدعوة', en: 'Invitation cancelled', placeholder: true },
  f1ReadOnlyNote: { ar: 'قراءة فقط', en: 'Read-only', placeholder: true },
  f1CancelAction: { ar: 'إلغاء الدعوة', en: 'Cancel invitation', placeholder: true },
  f1RevokeAction: { ar: 'سحب الصلاحية', en: 'Revoke access', placeholder: true },
  f1NeutralNote: {
    ar: 'حالات «بانتظار القبول» و«مرفوضة» و«منتهية» كلها محايدة — قرار الشخص أو مرور الوقت مو خطأ يُصلَّح.',
    en: 'Awaiting, declined and expired are all neutral states — a person’s choice or time passing is not a fault to fix.',
    placeholder: true,
  },
  f1CancelSheetTitleTemplate: { ar: 'إلغاء دعوة {name}؟', en: 'Cancel the invitation to {name}?', placeholder: true },
  f1CancelSheetBody: {
    ar: 'ما راح يقدر يقبلها بعد الإلغاء. تقدر ترسل دعوة جديدة لاحقًا.',
    en: 'They will no longer be able to accept it. You can send a new invitation later.',
    placeholder: true,
  },
  f1RevokeSheetTitleTemplate: { ar: 'سحب صلاحية {name}؟', en: 'Revoke {name}’s access?', placeholder: true },
  f1RevokeSheetBody: {
    ar: 'ما راح يقدر يشوف أدويتك بعدها. تقدر تدعوه مرة ثانية لاحقًا.',
    en: 'They will no longer be able to see your medications. You can invite them again later.',
    placeholder: true,
  },
  f1SheetDismiss: { ar: 'تراجع', en: 'Never mind', placeholder: true },
  f1InviteStep1Title: { ar: 'دعوة مقدّم رعاية', en: 'Invite a caregiver', placeholder: true },
  f1CivilIdLabel: { ar: 'الرقم المدني', en: 'Civil ID', placeholder: true },
  f1CivilIdHelper: { ar: 'مرة واحدة فقط — ما نطلبه مرتين', en: 'Just once — we never ask for it twice', placeholder: true },
  f1CivilIdError: { ar: 'أدخل رقمًا مدنيًا من ١٢ رقمًا', en: 'Enter a 12-digit Civil ID', placeholder: true },
  f1NameKnownLabel: { ar: 'الاسم اللي تعرفه فيه', en: 'The name you know them by', placeholder: true },
  f1RelationshipLabel: { ar: 'صلة القرابة', en: 'Relationship', placeholder: true },
  f1ContinueButton: { ar: 'متابعة', en: 'Continue', placeholder: true },
  f1NoExtraFieldsNote: { ar: 'ولا حقل هاتف، ولا رمز، ولا إعادة كتابة.', en: 'No phone field, no code, no retyping.', placeholder: true },
  f1ConfirmQuestion: { ar: 'هذا هو الشخص؟', en: 'Is this them?', placeholder: true },
  f1MaskedHelper: {
    ar: 'الأسماء الوسطى مخفية دائمًا بثلاث نجوم — مو بطول الاسم الحقيقي.',
    en: 'Middle names are always hidden as three asterisks — never the real length.',
    placeholder: true,
  },
  f1ConfirmYes: { ar: 'نعم، هذا هو', en: 'Yes, that’s them', placeholder: true },
  f1ConfirmNo: { ar: 'لا، أصحّح الرقم', en: 'No, let me correct the number', placeholder: true },
  f1ConfirmationAidNote: {
    ar: 'هذي خطوة تأكيد — مو تصريح. حتى لو ضغطت «نعم»، ما تنفتح بياناتك إلا إذا قبل هو الدعوة بنفسه.',
    en: 'This is a confirmation step, never an authorization. Even after “yes”, nothing opens unless they accept the invitation themselves.',
    placeholder: true,
  },
  f1CreatedTitle: { ar: 'تم إنشاء الدعوة', en: 'The invitation was created', placeholder: true },
  f1CreatedNoticeTitle: { ar: 'أرسلنا الدعوة', en: 'We sent the invitation', placeholder: true },
  f1CreatedNoticeBody: {
    ar: 'ما نقدر نقول إذا هذا الرقم مسجّل في جرعة أو لا.',
    en: 'We cannot say whether this number has a Jur’ah account.',
    placeholder: true,
  },
  f1CreatedSubnote: {
    ar: 'نفس الرسالة بالضبط تظهر سواء كان للرقم حساب أو لا — عشان التطبيق ما يصير أداة للاستعلام عن أصحاب الأرقام المدنية.',
    en: 'This exact message appears whether or not the number has an account — so the app can never be used to look up who holds a Civil ID.',
    placeholder: true,
  },
  f1CreatedDone: { ar: 'تمام', en: 'Done', placeholder: true },
  f1AwaitingAcceptanceNote: { ar: 'بانتظار القبول.', en: 'Awaiting acceptance.', placeholder: true },
  f1CloseSheetLabel: { ar: 'إغلاق', en: 'Close', placeholder: true },

  // ---------------------------------------------------------------------------------------------
  // F2 — caregiver home (/[locale]/care, /[locale]/care/medicines)
  // ---------------------------------------------------------------------------------------------
  f2TodayTitle: { ar: 'اليوم', en: 'Today', placeholder: true },
  f2MedicinesTitleTemplate: { ar: 'أدوية {name}', en: '{name}’s medicines', placeholder: true },
  f2PlannedDosesTemplate: { ar: '{count} جرعات مخططة', en: '{count} planned doses', placeholder: true },
  f2TrackingOffNoticeTitleTemplate: { ar: '{name} ما فعّل متابعة الجرعات', en: '{name} has not turned on dose tracking', placeholder: true },
  f2TrackingOffNoticeBodyTemplate: {
    ar: 'الجدول خطة، مو سجل — تشوف نفس اللي يشوفه {name} بالضبط، ولا أكثر.',
    en: 'The schedule is a plan, not a log — you see exactly what {name} sees, never more.',
    placeholder: true,
  },
  f2NoWriteControlsNote: {
    ar: 'ما فيه أي زر يغيّر بيانات المريض من هذي الشاشة.',
    en: 'No control on this screen changes the patient’s data.',
    placeholder: true,
  },
  f2EmptyDayTitle: { ar: 'ما فيه جرعات اليوم', en: 'No doses today', placeholder: true },
  f2EmptyDayBody: { ar: 'الجدول فاضي لهذا اليوم — جرّب يوم ثاني.', en: 'The schedule is empty for this day — try another day.', placeholder: true },
  f2DayPrevLabel: { ar: 'اليوم السابق', en: 'Previous day', placeholder: true },
  f2DayNextLabel: { ar: 'اليوم التالي', en: 'Next day', placeholder: true },
  f2DayTodayLabel: { ar: 'الرجوع لليوم', en: 'Back to today', placeholder: true },
  f2ActiveMedicinesTitle: { ar: 'الوصفات النشطة', en: 'Active prescriptions' , placeholder: true },
  f2NoActiveMedicines: { ar: 'ما فيه وصفات نشطة حاليًا.', en: 'No active prescriptions right now.', placeholder: true },
  f2PastMedicinesTitle: { ar: 'أدوية سابقة', en: 'Past medicines', placeholder: true },
  f2DiscontinuedTemplate: { ar: 'أُوقفت {date}', en: 'Stopped {date}', placeholder: true },

  // ---------------------------------------------------------------------------------------------
  // F3 — caregiver detail access
  // ---------------------------------------------------------------------------------------------
  f3RxGenericLabel: { ar: 'الاسم العلمي', en: 'Generic name', placeholder: true },
  f3RxBrandLabel: { ar: 'الاسم التجاري', en: 'Brand name', placeholder: true },
  f3RxStrengthLabel: { ar: 'التركيز', en: 'Strength', placeholder: true },
  f3RxFacilityLabel: { ar: 'الجهة المصدرة', en: 'Issuing facility', placeholder: true },
  f3RxDoseLabel: { ar: 'الجرعة الواحدة', en: 'Dose per administration', placeholder: true },
  f3RxFrequencyLabel: { ar: 'عدد المرات باليوم', en: 'Times per day', placeholder: true },
  // Parity fix (bundle d's B3 gate review): every contract field, doseTimes included — B3 renders
  // it, F3 must too (SCREENS.md: "identical minus actions").
  f3RxDoseTimesLabel: { ar: 'مواعيد الجرعات', en: 'Dose times', placeholder: true },
  f3RxDurationLabel: { ar: 'مدة العلاج (أيام)', en: 'Duration (days)', placeholder: true },
  f3RxStartDateLabel: { ar: 'تاريخ البدء', en: 'Start date', placeholder: true },
  f3RxPatternLabel: { ar: 'نمط الجرعات', en: 'Dosing pattern', placeholder: true },
  f3RxPatternDaily: { ar: 'يوميًا', en: 'Daily', placeholder: true },
  f3RxPatternAlternate: { ar: 'يوم بعد يوم', en: 'Alternate day', placeholder: true },
  f3RxPatternOther: { ar: 'نمط آخر', en: 'Other', placeholder: true },
  f3RxTimingLabel: { ar: 'بالنسبة للأكل', en: 'Relative to food', placeholder: true },
  f3RxRouteLabel: { ar: 'طريقة الاستخدام', en: 'Route of administration', placeholder: true },
  f3RxNotesLabel: { ar: 'ملاحظات خاصة', en: 'Special notes', placeholder: true },
  f3RxIndicationLabel: { ar: 'دواعي الاستخدام', en: 'Indication', placeholder: true },
  f3RxPrescriberLabel: { ar: 'الطبيب المعالج', en: 'Prescriber', placeholder: true },
  f3RxPrescribedAtLabel: { ar: 'تاريخ الوصفة', en: 'Prescribed on', placeholder: true },
  f3RxDispensingTitle: { ar: 'بيانات الصرف', en: 'Dispensing', placeholder: true },
  f3RxUnitsPerPackageLabel: { ar: 'عدد الوحدات بالعلبة', en: 'Units per package', placeholder: true },
  f3RxTotalDispensedLabel: { ar: 'الكمية المصروفة', en: 'Total quantity dispensed', placeholder: true },
  f3RxDispenseDateLabel: { ar: 'تاريخ الصرف', en: 'Dispense date', placeholder: true },
  f3RxBrandDispensedLabel: { ar: 'الاسم التجاري المصروف', en: 'Brand actually dispensed', placeholder: true },
  f3RxNeedsReviewNote: {
    ar: 'بعض بيانات هذي الوصفة بانتظار تأكيد الصيدلي.',
    en: 'Some of this prescription’s fields await pharmacist confirmation.',
    placeholder: true,
  },
  f3RxStatusLabel: { ar: 'الحالة', en: 'Status', placeholder: true },
  f3RxStatusActive: { ar: 'نشِطة', en: 'Active', placeholder: true },
  f3RxStatusCompleted: { ar: 'مكتملة', en: 'Completed', placeholder: true },
  f3RxStatusDiscontinued: { ar: 'أُوقفت', en: 'Discontinued', placeholder: true },
  f3RxDiscontinuedReasonLabel: { ar: 'سبب الإيقاف', en: 'Reason stopped', placeholder: true },
  f3RxDiscontinuedAtLabel: { ar: 'تاريخ الإيقاف', en: 'Date stopped', placeholder: true },
  f3DoseHistoryTitle: { ar: 'سجل الجرعات', en: 'Dose history', placeholder: true },
  f3DoseHistoryTrackingOffNote: {
    ar: 'المريض ما فعّل متابعة الجرعات، فهذا سجل مواعيد بدون حالات.',
    en: 'The patient has not turned on dose tracking, so this is a list of times with no statuses.',
    placeholder: true,
  },
  f3ReadOnlyRxNote: { ar: 'قراءة فقط — ما فيه أي إجراء من هذي الشاشة.', en: 'Read-only — no action is available from this screen.', placeholder: true },
  f3AlertTitle: { ar: 'تفاصيل التعارض', en: 'Interaction detail', placeholder: true },
  f3AlertRiskLabel: { ar: 'شنو الخطر', en: 'What the risk is', placeholder: true },
  f3AlertActionLabel: { ar: 'شنو تسوي الحين', en: 'What to do right now', placeholder: true },
  f3AlertActionBody: {
    ar: 'لا تغيّرون ولا توقفون أي دواء بأنفسكم. تواصلوا مع العيادة أو الصيدلية اللي صرفت الدواء.',
    en: 'Do not change or stop any medication yourselves. Contact the clinic or pharmacy that dispensed it.',
    placeholder: true,
  },
  f3AlertWhoLabel: { ar: 'مين يتابعها', en: 'Who is checking it', placeholder: true },
  f3AlertWhoBody: {
    ar: 'يراجعها الآن صيدلي أو طبيب، وتتحدّث الشاشة تلقائيًا لما يوصلون لقرار.',
    en: 'A pharmacist or doctor is reviewing it now, and this screen updates once they reach a decision.',
    placeholder: true,
  },
  // Parity fix (bundle e's C2 gate review): the reviewed-state decision block — same fixed human
  // label bundle e's features/safety/AlertDetail.tsx uses for "who" (never a resolved name or a
  // Civil ID/Account id, CR-028/CR-031 — no published function resolves reviewedBy to a display name).
  f3AlertReviewHeading: { ar: 'قرار المراجع', en: 'The reviewer’s decision', placeholder: true },
  f3AlertDecisionLabel: { ar: 'القرار', en: 'Decision', placeholder: true },
  f3AlertDecisionConfirmed: { ar: 'الخطر مؤكد', en: 'Risk confirmed', placeholder: true },
  f3AlertDecisionCleared: { ar: 'تم استبعاد الخطر', en: 'Risk cleared', placeholder: true },
  f3AlertReviewerLabel: { ar: 'من راجعها', en: 'Reviewed by', placeholder: true },
  f3AlertReviewerValue: { ar: 'مراجع طبي', en: 'A medical reviewer', placeholder: true },
  f3AlertDateLabel: { ar: 'التاريخ', en: 'Date', placeholder: true },
  f3AlertNoteLabel: { ar: 'الملاحظة', en: 'Note', placeholder: true },
  f3AlertSourceLabel: { ar: 'المصدر الطبي المطابق', en: 'The matching medical source', placeholder: true },
  // Never the raw TO_BE_SUPPLIED marker (a technical placeholder reaching a reader) — an explicit,
  // honest line instead, wording matched by hand to bundle e's own c2SourceUnverified (safety.ts).
  f3AlertSourceUnverified: {
    ar: 'ما توفر مصدر طبي مؤكد لهذا التنبيه بعد — القيمة معلّقة من قاعدة بيانات الأدوية.',
    en: 'No verified medical source is available for this finding yet — pending from the drug database.',
    placeholder: true,
  },
  f3AlertInvolvedHeading: { ar: 'الوصفات المعنية', en: 'Involved prescriptions', placeholder: true },
  f3ReadOnlyAlertNote: {
    ar: 'ما تقدر تتصرف من هنا — ما فيه تأكيد ولا إخفاء ولا أي إجراء.',
    en: 'Nothing can be actioned from here — no confirming, no clearing, no action of any kind.',
    placeholder: true,
  },
  f3ActivityEmptyTitle: { ar: 'ما فيه أحداث مسجّلة', en: 'No events recorded yet', placeholder: true },
  f3ActivityEmptyBody: {
    ar: 'أي تغيير يصير في ملف المريض راح يظهر هنا.',
    en: 'Any change to the patient’s record will appear here.',
    placeholder: true,
  },

  // ---------------------------------------------------------------------------------------------
  // F4 — caregiver profile & notifications (/[locale]/care/more/profile)
  // ---------------------------------------------------------------------------------------------
  f4LinkedSinceTemplate: { ar: 'مربوط بملف {name} منذ {date} · قراءة فقط', en: 'Linked to {name}’s record since {date} · read-only', placeholder: true },
  // CR-001 strict rule / CR-026 pattern: no Civil ID, masked or whole, anywhere — and (a data-layer
  // gap this bundle reports rather than invents around, docs/backend-notes/wp4h.md §7: no published
  // function returns a caregiver's own display name) this line stands in for a name row.
  f4IdentityVerifiedLine: { ar: 'تم التحقق من هويتك عبر محاكاة هويّاتي', en: 'Your identity was verified through the simulated Hawiati flow', placeholder: true },
  f4NotificationsTitle: { ar: 'إشعاراتي', en: 'My notifications', placeholder: true },
  f4BrowserNotifRow: { ar: 'إشعارات المتصفح', en: 'Browser notifications', placeholder: true },
  f4ChatRow: { ar: 'محادثة تيليقرام', en: 'Telegram chat', placeholder: true },
  f4PushDefault: { ar: 'لم تُطلب بعد', en: 'Not asked yet', placeholder: true },
  f4PushGranted: { ar: 'مفعّلة', en: 'On', placeholder: true },
  f4PushDenied: { ar: 'مرفوضة', en: 'Blocked', placeholder: true },
  f4PushUnsupported: { ar: 'غير مدعومة على هذا الجهاز', en: 'Not supported on this device', placeholder: true },
  f4PushEnableAction: { ar: 'تفعيل إشعارات المتصفح', en: 'Turn on browser notifications', placeholder: true },
  f4PushDisableAction: { ar: 'إيقاف إشعارات المتصفح', en: 'Turn off browser notifications', placeholder: true },
  f4PushTestAction: { ar: 'إرسال إشعار تجريبي', en: 'Send a test notification', placeholder: true },
  f4ChatNotConnected: { ar: 'غير مربوطة', en: 'Not connected', placeholder: true },
  f4ChatPending: { ar: 'بانتظار الربط…', en: 'Connecting…', placeholder: true },
  f4ChatConnectedAlertsOnly: { ar: 'مربوطة · تنبيهات فقط', en: 'Connected · alerts only', placeholder: true },
  f4ChatExpired: { ar: 'انتهت صلاحية الربط', en: 'The link expired', placeholder: true },
  f4ChatConnectAction: { ar: 'ربط تيليقرام', en: 'Connect Telegram', placeholder: true },
  f4ChatDisconnectAction: { ar: 'فصل تيليقرام', en: 'Disconnect Telegram', placeholder: true },
  f4ChatTestAction: { ar: 'إرسال رسالة تجريبية', en: 'Send a test message', placeholder: true },
  f4AlertsOnlyNote: {
    ar: 'ما توصلك أسئلة عن الجرعات — أسئلة المتابعة تروح للمريض نفسه فقط، وما تقدر تسجّل جرعة نيابةً عنه.',
    en: 'You never receive check-in questions — those go to the patient alone, and you cannot record a dose on their behalf.',
    placeholder: true,
  },
  f4AccessTitle: { ar: 'صلاحيتي', en: 'My access', placeholder: true },
  f4LinkedPatientLabel: { ar: 'المريض المربوط', en: 'The linked patient', placeholder: true },
  f4UnlinkAction: { ar: 'افصل نفسي عن هذا الملف', en: 'Unlink myself from this record', placeholder: true },
  f4UnlinkSheetTitle: { ar: 'تفصل نفسك عن هذا الملف؟', en: 'Unlink yourself from this record?', placeholder: true },
  f4UnlinkSheetBody: {
    ar: 'ما راح تقدر تشوف بيانات المريض بعدها. يقدر يدعوك مرة ثانية لاحقًا.',
    en: 'You will no longer be able to see the patient’s data. They can invite you again later.',
    placeholder: true,
  },
  f4UnlinkConfirm: { ar: 'افصل نفسي', en: 'Unlink myself', placeholder: true },
  f4NoSettingsNote: {
    ar: 'ما عندك صفحة «إعدادات» — تفضيلاتك هي قنواتك فقط، وما تغيّره هنا ما يمس إعدادات المريض ولا جدوله ولا حالات جرعاته.',
    en: 'You have no Settings page — your only preferences are your own channels, and nothing you change here touches the patient’s settings, schedule or dose statuses.',
    placeholder: true,
  },
  f4DisconnectSheetTitle: { ar: 'تفصل تيليقرام؟', en: 'Disconnect Telegram?', placeholder: true },
  f4DisconnectSheetBody: {
    ar: 'بتوقف تنبيهاتك عبر تيليقرام. تقدر تربطه مرة ثانية في أي وقت.',
    en: 'Your Telegram alerts will stop. You can reconnect at any time.',
    placeholder: true,
  },

  // ---------------------------------------------------------------------------------------------
  // F5 — caregiver help (/[locale]/care/more/help), static copy
  // ---------------------------------------------------------------------------------------------
  f5CanSeeTitle: { ar: 'شنو تشوف بالضبط', en: 'Exactly what you see', placeholder: true },
  f5CanSeeBody: {
    ar: 'أدوية المريض، جدول جرعاته، تنبيهات السلامة، وسجل الأحداث — ولا أكثر من اللي يشوفه هو.',
    en: 'The patient’s medicines, their dose schedule, safety alerts, and the activity log — never more than they see themselves.',
    placeholder: true,
  },
  f5CannotTitle: { ar: 'شنو ما تقدر تسويه', en: 'What you cannot do', placeholder: true },
  f5CannotBody: {
    ar: 'ما تسجّل جرعة نيابةً عنه، ما تعدّل وصفة، وما تغيّر أي إعداد. الأزرار مو معطّلة — هي غائبة أصلاً، لأن هذي حقيقة صلاحيتك.',
    en: 'You cannot record a dose on their behalf, change a prescription, or change any setting. The controls are not disabled — they are simply absent, because that is the truth of your access.',
    placeholder: true,
  },
  f5DangerTitle: { ar: 'طلع تنبيه خطر — شنو تسوي؟', en: 'A danger alert appears — what do you do?', placeholder: true },
  f5DangerBody: {
    ar: 'افتح التنبيه واقرأه، وتواصل مع العيادة أو الصيدلية اللي صرفت الدواء. لا توقف ولا تغيّر دواء بنفسك — التنبيه أصلاً عند طبيب يراجعه.',
    en: 'Open the alert and read it, then contact the clinic or pharmacy that dispensed the medication. Do not stop or change any medication yourself — a doctor is already reviewing it.',
    placeholder: true,
  },
  f5TrackingOffTitle: { ar: 'لو المريض مطفّي المتابعة', en: 'If the patient has tracking off', placeholder: true },
  f5TrackingOffBody: {
    ar: 'راح تشوف جدوله بدون حالات جرعات، لأن ما فيه سجل التزام أصلاً. هذا وضع طبيعي، مو نقص في التطبيق.',
    en: 'You will see their schedule with no dose statuses, because there is no adherence record to show. This is a normal state, not a gap in the app.',
    placeholder: true,
  },
  f5AccessEndedTitle: { ar: 'انتهى وصولك؟', en: 'Has your access ended?', placeholder: true },
  f5AccessEndedBody: {
    ar: 'المريض يقدر يسحب صلاحيتك في أي وقت، وتقدر تفصل نفسك أيضًا. للرجوع، يرسل لك دعوة جديدة وتقبلها.',
    en: 'The patient can revoke your access at any time, and you can unlink yourself too. To come back, they send you a new invitation and you accept it.',
    placeholder: true,
  },

  // ---------------------------------------------------------------------------------------------
  // Shared — strength units (dose amount formatting, F2/F3)
  // ---------------------------------------------------------------------------------------------
  unitMg: { ar: 'ملغم', en: 'mg', placeholder: true },
  unitMcg: { ar: 'ميكروغرام', en: 'mcg', placeholder: true },
  unitG: { ar: 'غرام', en: 'g', placeholder: true },
  unitMl: { ar: 'مل', en: 'ml', placeholder: true },
  unitIU: { ar: 'وحدة دولية', en: 'IU', placeholder: true },
} satisfies Record<string, CopyEntry>;

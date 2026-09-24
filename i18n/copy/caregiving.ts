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
  f0Kicker: { ar: 'القرار لك', en: 'It’s your choice', placeholder: true },
  f0PendingTitleTemplate: { ar: 'دعوة من {name} للاطلاع على ملف الأدوية', en: '{name} has invited you to see their medication record', placeholder: true },
  // Audit M4: `relationship` is the PATIENT's own first-person word ('ابني' = "my son", as the seed
  // stores it), so it is quoted as theirs — never asserted in the reader's voice ("يقول إنك ابني").
  f0RelationshipTemplate: { ar: 'صلة القرابة في الدعوة: «{relationship}».', en: 'Described you as “{relationship}”.', placeholder: true },
  f0CanSeeTitle: { ar: 'إذا قبلت، سترى:', en: 'If you accept, you’ll see:', placeholder: true },
  f0CanSee1: { ar: 'قائمة الأدوية', en: 'Their medicine list', placeholder: true },
  f0CanSee2: { ar: 'الجدول اليومي للجرعات', en: 'Their daily dose schedule', placeholder: true },
  f0CanSee3: { ar: 'تنبيهات السلامة والتعارضات بين الأدوية', en: 'Safety alerts and drug interactions', placeholder: true },
  f0CanSee4: { ar: 'سجل الأحداث', en: 'The activity log', placeholder: true },
  // Audit M5: the old 'وما راح تقدر:' can be read as "and what you'll be able to" — the one list
  // consent hinges on must be unmistakably negative.
  f0CannotTitle: { ar: 'لن تستطيع أبدًا:', en: 'You will never be able to:', placeholder: true },
  f0Cannot1: { ar: 'تسجيل جرعة نيابةً عن المريض', en: 'Record a dose on the patient’s behalf', placeholder: true },
  f0Cannot2: { ar: 'تعديل وصفة أو جرعة', en: 'Change a prescription or a dose', placeholder: true },
  f0Cannot3: { ar: 'تغيير أي إعداد في الحساب', en: 'Change any of their settings', placeholder: true },
  f0Cannot4: { ar: 'التصرف نيابةً عن المريض بأي شكل', en: 'Act for the patient in any way', placeholder: true },
  f0WillBeToldTitle: { ar: 'سيعرف المريض إذا قبلت', en: 'The patient will know if you accept', placeholder: true },
  f0WillBeToldBody: {
    ar: 'سيصل إلى المريض إشعار في التطبيق يحمل اسمك، ويمكنه سحب صلاحيتك في أي وقت.',
    en: 'They’ll get a notice in the app with your name, and they can remove your access at any time.',
    placeholder: true,
  },
  f0Accept: { ar: 'قبول', en: 'Accept', placeholder: true },
  f0Decline: { ar: 'رفض', en: 'Decline', placeholder: true },
  f0EqualNote: {
    ar: 'كلا الخيارين مقبول. وإذا قبلت، يمكنك فصل نفسك عن الملف في أي وقت.',
    en: 'Either choice is fine. If you accept, you can unlink yourself at any time.',
    placeholder: true,
  },
  f0AcceptedTitle: { ar: 'تم الربط', en: 'You’re linked', placeholder: true },
  f0AcceptedBodyTemplate: {
    ar: 'أصبح ملف {name} متاحًا لك للاطلاع فقط، وتم إبلاغ {name} بذلك.',
    en: 'You can now see {name}’s record. It’s read-only, and we’ve let them know.',
    placeholder: true,
  },
  f0AcceptedOpenTemplate: { ar: 'افتح ملف {name}', en: 'Open {name}’s record', placeholder: true },
  f0AcceptedFootnote: { ar: 'لم يُعرض عليك شيء من الملف قبل قبولك.', en: 'Nothing from the record was shown to you before you accepted.', placeholder: true },
  f0DeclinedTitle: { ar: 'تم رفض الدعوة', en: 'You declined the invitation', placeholder: true },
  f0DeclinedBody: {
    ar: 'لم تُمنح أي صلاحية، ولم يُعرض عليك أي شيء من الملف. وإذا وصلتك هذه الدعوة عن طريق الخطأ، فلا يلزمك فعل أي شيء.',
    en: 'You haven’t been given any access, and nothing from the record was shown to you. If this invitation reached you by mistake, there’s nothing you need to do.',
    placeholder: true,
  },
  f0DeclinedFootnote: { ar: 'الرفض خيار مقبول دائمًا.', en: 'Saying no is always okay.', placeholder: true },
  f0BackHome: { ar: 'الرجوع إلى الصفحة الرئيسية', en: 'Back to the home page', placeholder: true },
  f0UnavailableTitle: { ar: 'هذه الدعوة لم تعد متاحة', en: 'This invitation is no longer available', placeholder: true },
  f0UnavailableBody: { ar: 'انتهت مهلتها، أو ألغاها المريض.', en: 'It expired, or the patient cancelled it.', placeholder: true },
  f0UnavailableRetry: {
    ar: 'إذا كنت لا تزال تريد المتابعة، فاطلب من المريض إرسال دعوة جديدة إليك.',
    en: 'If you’d still like to follow their care, ask the patient to send you a new invitation.',
    placeholder: true,
  },
  f0UnavailableFootnote: { ar: 'لا يلزمك فعل أي شيء هنا.', en: 'You don’t need to do anything here.', placeholder: true },

  // ---------------------------------------------------------------------------------------------
  // F1 — caregiver management, patient side (/[locale]/app/more/caregivers)
  // ---------------------------------------------------------------------------------------------
  f1Title: { ar: 'مقدّمو الرعاية', en: 'Caregivers', placeholder: true },
  f1InviteButton: { ar: 'دعوة مقدّم رعاية', en: 'Invite a caregiver', placeholder: true },
  f1EmptyTitle: { ar: 'لا يوجد مقدّمو رعاية بعد', en: 'No caregivers yet', placeholder: true },
  f1EmptyBody: {
    ar: 'ادعُ أحد أفراد عائلتك لمتابعة أدويتك. المتابعة للاطلاع فقط، ولا يمكن من خلالها تغيير أي شيء.',
    en: 'Invite someone in your family to follow your medicines. They can only look, and can’t change anything.',
    placeholder: true,
  },
  f1StatusActiveTemplate: { ar: 'الربط نشِط منذ {date}', en: 'Active since {date}', placeholder: true },
  f1StatusPendingTemplate: { ar: 'بانتظار الرد · تنتهي في {date}', en: 'Waiting for a reply · expires {date}', placeholder: true },
  f1StatusDeclined: { ar: 'تم رفض الدعوة', en: 'Invitation declined', placeholder: true },
  f1StatusExpired: { ar: 'انتهت مهلة الدعوة', en: 'Invitation expired', placeholder: true },
  f1StatusRevokedAccepted: { ar: 'انتهى الربط', en: 'Access ended', placeholder: true },
  f1StatusRevokedCancelled: { ar: 'أُلغيت الدعوة', en: 'Invitation cancelled', placeholder: true },
  f1ReadOnlyNote: { ar: 'للاطلاع فقط', en: 'Read-only', placeholder: true },
  f1CancelAction: { ar: 'إلغاء الدعوة', en: 'Cancel invitation', placeholder: true },
  f1RevokeAction: { ar: 'سحب الصلاحية', en: 'Remove access', placeholder: true },
  f1NeutralNote: {
    ar: 'من الطبيعي أن تبقى الدعوة بانتظار الرد، أو أن تُرفض، أو أن تنتهي مهلتها، ولا يعني ذلك وجود أي خطأ.',
    en: 'It’s normal for an invitation to wait for a reply, be declined or expire. It doesn’t mean anything is wrong.',
    placeholder: true,
  },
  f1CancelSheetTitleTemplate: { ar: 'إلغاء دعوة {name}؟', en: 'Cancel the invitation to {name}?', placeholder: true },
  f1CancelSheetBody: {
    ar: 'بعد الإلغاء، لا يمكن قبول هذه الدعوة. ويمكنك إرسال دعوة جديدة لاحقًا.',
    en: 'Once it’s cancelled, it can’t be accepted. You can send a new invitation later.',
    placeholder: true,
  },
  f1RevokeSheetTitleTemplate: { ar: 'سحب صلاحية {name}؟', en: 'Remove {name}’s access?', placeholder: true },
  f1RevokeSheetBody: {
    ar: 'لن تظهر أدويتك لهذا الشخص بعد ذلك. ويمكنك إرسال دعوة جديدة لاحقًا.',
    en: 'They won’t be able to see your medicines any more. You can invite them again later.',
    placeholder: true,
  },
  f1SheetDismiss: { ar: 'تراجع', en: 'Never mind', placeholder: true },
  f1InviteStep1Title: { ar: 'دعوة مقدّم رعاية', en: 'Invite a caregiver', placeholder: true },
  f1CivilIdLabel: { ar: 'الرقم المدني', en: 'Civil ID', placeholder: true },
  f1CivilIdHelper: { ar: 'يكفي أن تكتبه مرة واحدة.', en: 'You only need to enter it once.', placeholder: true },
  f1CivilIdError: { ar: 'أدخل رقمًا مدنيًا من ١٢ رقمًا', en: 'Enter a 12-digit Civil ID', placeholder: true },
  // The invite form checks on Continue, never disabled-until-filled: one message per empty field,
  // each saying what to do next (UX §5/§6, the sign-in form's own pattern).
  f1CivilIdRequiredError: { ar: 'اكتب الرقم المدني للشخص الذي تدعوه.', en: 'Enter the Civil ID of the person you’re inviting.', placeholder: true },
  f1NameRequiredError: { ar: 'اكتب اسم الشخص كما تعرفه.', en: 'Enter their name as you know it.', placeholder: true },
  f1RelationshipRequiredError: { ar: 'اكتب صلة القرابة، مثل: ابني أو ابنتي.', en: 'Enter how they’re related to you, for example: my son.', placeholder: true },
  f1NameKnownLabel: { ar: 'الاسم كما تعرفه', en: 'The name you know them by', placeholder: true },
  f1RelationshipLabel: { ar: 'صلة القرابة', en: 'Relationship', placeholder: true },
  f1ContinueButton: { ar: 'متابعة', en: 'Continue', placeholder: true },
  f1NoExtraFieldsNote: { ar: 'هذا كل ما نحتاجه، دون رقم هاتف أو رمز تحقق.', en: 'That’s all we need. No phone number, no code.', placeholder: true },
  f1ConfirmQuestion: { ar: 'هذا هو الشخص؟', en: 'Is this the right person?', placeholder: true },
  f1MaskedHelper: {
    ar: 'للخصوصية، نُظهر الحرف الأول فقط من كل اسم أوسط، وعدد النجوم لا يدل على طول الاسم.',
    en: 'For privacy, we only show the first letter of each middle name. The stars don’t show how long the name is.',
    placeholder: true,
  },
  f1ConfirmYes: { ar: 'نعم، هذا هو', en: 'Yes, that’s them', placeholder: true },
  f1ConfirmNo: { ar: 'لا، أصحّح الرقم', en: 'No, let me fix the number', placeholder: true },
  f1ConfirmationAidNote: {
    ar: 'هذه الخطوة للتأكد من الشخص فقط. حتى بعد «نعم»، لا يُعرض شيء من بياناتك إلا إذا قبل الشخص الدعوة بنفسه.',
    en: 'This step only checks that you have the right person. Even after “Yes”, nothing of yours is shared unless they accept the invitation themselves.',
    placeholder: true,
  },
  f1CreatedTitle: { ar: 'تم إنشاء الدعوة', en: 'Invitation created', placeholder: true },
  f1CreatedNoticeTitle: { ar: 'أرسلنا الدعوة', en: 'We’ve sent the invitation', placeholder: true },
  f1CreatedNoticeBody: {
    ar: 'لا يمكننا إخبارك هل لهذا الرقم حساب في «جرعة» أم لا.',
    en: 'We can’t tell you whether this number has a Jur’ah account.',
    placeholder: true,
  },
  f1CreatedSubnote: {
    ar: 'تظهر هذه الرسالة نفسها سواء كان للرقم حساب أم لا، حتى لا يُستخدم التطبيق لمعرفة أصحاب الأرقام المدنية.',
    en: 'You’ll see this same message whether or not the number has an account, so no one can use the app to look up who owns a Civil ID.',
    placeholder: true,
  },
  f1CreatedDone: { ar: 'تم', en: 'Done', placeholder: true },
  f1AwaitingAcceptanceNote: { ar: 'بانتظار الرد.', en: 'Waiting for a reply.', placeholder: true },
  f1CloseSheetLabel: { ar: 'إغلاق', en: 'Close', placeholder: true },

  // ---------------------------------------------------------------------------------------------
  // F2 — caregiver home (/[locale]/care, /[locale]/care/medicines)
  // ---------------------------------------------------------------------------------------------
  f2TodayTitle: { ar: 'اليوم', en: 'Today', placeholder: true },
  // The line above the caregiver's Today title; {name} is the patient's first name. Says whose plan
  // this is on any day of the week strip (the shared caregiverDayOf says "today" in Arabic).
  f2DayOfTemplate: { ar: 'جدول {name}', en: '{name}’s schedule', placeholder: true },
  f2MedicinesTitleTemplate: { ar: 'أدوية {name}', en: '{name}’s medicines', placeholder: true },
  f2PlannedDosesTemplate: { ar: 'الجرعات المخططة: {count}', en: 'Planned doses: {count}', placeholder: true },
  f2TrackingOffNoticeTitleTemplate: { ar: 'متابعة الجرعات غير مفعّلة لدى {name}', en: 'Dose tracking is off for {name}', placeholder: true },
  f2TrackingOffNoticeBodyTemplate: {
    ar: 'هذا الجدول خطة، وليس سجلًا للجرعات المأخوذة. ما تراه هنا هو ما يظهر في حساب {name} تمامًا، لا أكثر.',
    en: 'This schedule is a plan, not a record of doses taken. You see exactly what {name} sees, nothing more.',
    placeholder: true,
  },
  f2NoWriteControlsNote: {
    ar: 'يمكنك الاطلاع على هذه الصفحة، لكن لا يمكنك تغيير أي شيء فيها.',
    en: 'You can view this page, but you can’t change anything on it.',
    placeholder: true,
  },
  f2EmptyDayTitle: { ar: 'لا توجد جرعات في هذا اليوم', en: 'No doses on this day', placeholder: true },
  f2EmptyDayBody: { ar: 'الجدول فارغ في هذا اليوم. جرّب يومًا آخر.', en: 'Nothing is planned for this day. Try another day.', placeholder: true },
  f2DayPrevLabel: { ar: 'اليوم السابق', en: 'Previous day', placeholder: true },
  f2DayNextLabel: { ar: 'اليوم التالي', en: 'Next day', placeholder: true },
  f2DayTodayLabel: { ar: 'العودة إلى اليوم', en: 'Back to today', placeholder: true },
  f2ActiveMedicinesTitle: { ar: 'الوصفات النشطة', en: 'Active prescriptions' , placeholder: true },
  f2NoActiveMedicines: { ar: 'لا توجد وصفات نشطة حاليًا.', en: 'No active prescriptions right now.', placeholder: true },
  f2PastMedicinesTitle: { ar: 'أدوية سابقة', en: 'Past medicines', placeholder: true },
  f2DiscontinuedTemplate: { ar: 'أُوقفت في {date}', en: 'Stopped on {date}', placeholder: true },

  // ---------------------------------------------------------------------------------------------
  // F3 — caregiver detail access
  // ---------------------------------------------------------------------------------------------
  f3RxGenericLabel: { ar: 'الاسم العلمي', en: 'Generic name', placeholder: true },
  f3RxBrandLabel: { ar: 'الاسم التجاري', en: 'Brand name', placeholder: true },
  f3RxStrengthLabel: { ar: 'التركيز', en: 'Strength', placeholder: true },
  f3RxFacilityLabel: { ar: 'الجهة المصدرة', en: 'Issued by', placeholder: true },
  f3RxDoseLabel: { ar: 'مقدار الجرعة', en: 'Amount per dose', placeholder: true },
  f3RxFrequencyLabel: { ar: 'عدد المرات في اليوم', en: 'Times per day', placeholder: true },
  // Parity fix (bundle d's B3 gate review): every contract field, doseTimes included — B3 renders
  // it, F3 must too (SCREENS.md: "identical minus actions").
  f3RxDoseTimesLabel: { ar: 'مواعيد الجرعات', en: 'Dose times', placeholder: true },
  f3RxDurationLabel: { ar: 'مدة العلاج (بالأيام)', en: 'Treatment length (days)', placeholder: true },
  f3RxStartDateLabel: { ar: 'تاريخ البدء', en: 'Start date', placeholder: true },
  f3RxPatternLabel: { ar: 'نمط الجرعات', en: 'Dosing pattern', placeholder: true },
  f3RxPatternDaily: { ar: 'يوميًا', en: 'Daily', placeholder: true },
  f3RxPatternAlternate: { ar: 'يوم بعد يوم', en: 'Every other day', placeholder: true },
  f3RxPatternOther: { ar: 'نمط آخر', en: 'Other pattern', placeholder: true },
  f3RxTimingLabel: { ar: 'قبل الطعام أو بعده', en: 'Before or after food', placeholder: true },
  f3RxRouteLabel: { ar: 'طريقة الاستخدام', en: 'How to take it', placeholder: true },
  f3RxNotesLabel: { ar: 'ملاحظات خاصة', en: 'Special notes', placeholder: true },
  f3RxIndicationLabel: { ar: 'دواعي الاستخدام', en: 'What it’s for', placeholder: true },
  f3RxPrescriberLabel: { ar: 'الطبيب المعالج', en: 'Prescribed by', placeholder: true },
  f3RxPrescribedAtLabel: { ar: 'تاريخ الوصفة', en: 'Prescribed on', placeholder: true },
  f3RxDispensingTitle: { ar: 'بيانات الصرف', en: 'From the pharmacy', placeholder: true },
  f3RxUnitsPerPackageLabel: { ar: 'عدد الوحدات في العلبة', en: 'Units in each pack', placeholder: true },
  f3RxTotalDispensedLabel: { ar: 'الكمية المصروفة', en: 'Amount dispensed', placeholder: true },
  f3RxDispenseDateLabel: { ar: 'تاريخ الصرف', en: 'Dispensed on', placeholder: true },
  f3RxBrandDispensedLabel: { ar: 'الاسم التجاري المصروف', en: 'Brand dispensed', placeholder: true },
  f3RxNeedsReviewNote: {
    ar: 'بعض بيانات هذه الوصفة بانتظار تأكيد الصيدلي.',
    en: 'A pharmacist still needs to confirm some details of this prescription.',
    placeholder: true,
  },
  f3RxStatusLabel: { ar: 'الحالة', en: 'Status', placeholder: true },
  f3RxStatusActive: { ar: 'نشِطة', en: 'Active', placeholder: true },
  f3RxStatusCompleted: { ar: 'مكتملة', en: 'Completed', placeholder: true },
  f3RxStatusDiscontinued: { ar: 'أُوقفت', en: 'Discontinued', placeholder: true },
  f3RxDiscontinuedReasonLabel: { ar: 'سبب الإيقاف', en: 'Why it was stopped', placeholder: true },
  f3RxDiscontinuedAtLabel: { ar: 'تاريخ الإيقاف', en: 'Stopped on', placeholder: true },
  f3DoseHistoryTitle: { ar: 'سجل الجرعات', en: 'Dose history', placeholder: true },
  f3DoseHistoryTrackingOffNote: {
    ar: 'متابعة الجرعات غير مفعّلة لدى المريض، لذلك تظهر هنا المواعيد فقط، دون بيان هل أُخذت كل جرعة.',
    en: 'Dose tracking is off for the patient, so this shows only the times, not whether each dose was taken.',
    placeholder: true,
  },
  // The way back from a prescription this caregiver cannot open (B3's empty state, in this shell).
  f3EmptyBackAction: { ar: 'العودة إلى الأدوية', en: 'Back to Medicines', placeholder: true },
  f3ReadOnlyRxNote: { ar: 'للاطلاع فقط. لا يمكن تغيير أي شيء من هذه الصفحة.', en: 'Read-only. Nothing can be changed from this page.', placeholder: true },
  f3AlertTitle: { ar: 'تفاصيل التعارض', en: 'Interaction details', placeholder: true },
  f3AlertRiskLabel: { ar: 'ما الخطر؟', en: 'What’s the risk?', placeholder: true },
  f3AlertActionLabel: { ar: 'ماذا تفعل الآن؟', en: 'What should you do now?', placeholder: true },
  f3AlertActionBody: {
    ar: 'لا تغيّر أي دواء ولا توقفه بنفسك. تواصل مع العيادة أو الصيدلية التي صرفت الدواء.',
    en: 'Don’t change or stop any medicine on your own. Contact the clinic or pharmacy that dispensed it.',
    placeholder: true,
  },
  f3AlertWhoLabel: { ar: 'من يراجعه؟', en: 'Who’s checking it?', placeholder: true },
  f3AlertWhoBody: {
    ar: 'يراجعه الآن صيدلي أو طبيب، وستتحدّث هذه الصفحة تلقائيًا عند صدور القرار.',
    en: 'A pharmacist or doctor is checking it now. This page will update by itself once they decide.',
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
  f3AlertSourceLabel: { ar: 'المصدر الطبي', en: 'Medical source', placeholder: true },
  // Never the raw TO_BE_SUPPLIED marker (a technical placeholder reaching a reader) — an explicit,
  // honest line instead, wording matched by hand to bundle e's own c2SourceUnverified (safety.ts).
  f3AlertSourceUnverified: {
    ar: 'لا يتوفر بعد مصدر طبي مؤكد لهذا التنبيه. ما زلنا ننتظره من قاعدة بيانات الأدوية.',
    en: 'There’s no confirmed medical source for this alert yet. We’re still waiting for it from the drug database.',
    placeholder: true,
  },
  f3AlertInvolvedHeading: { ar: 'الوصفات المعنية', en: 'Involved prescriptions', placeholder: true },
  f3ReadOnlyAlertNote: {
    ar: 'للاطلاع فقط. لا يمكنك تأكيد هذا التنبيه أو إخفاؤه أو اتخاذ أي إجراء عليه.',
    en: 'Read-only. You can’t confirm, dismiss or act on this alert.',
    placeholder: true,
  },
  f3ActivityEmptyTitle: { ar: 'لا توجد أحداث بعد', en: 'No activity yet', placeholder: true },
  f3ActivityEmptyBody: {
    ar: 'سيظهر هنا أي تغيير في ملف المريض.',
    en: 'Any change to the patient’s record will show up here.',
    placeholder: true,
  },

  // ---------------------------------------------------------------------------------------------
  // F4 — caregiver profile & notifications (/[locale]/care/more/profile)
  // ---------------------------------------------------------------------------------------------
  f4LinkedSinceTemplate: { ar: 'مرتبط بملف {name} منذ {date} · للاطلاع فقط', en: 'Linked to {name}’s record since {date} · read-only', placeholder: true },
  // CR-001 strict rule / CR-026 pattern: no Civil ID, masked or whole, anywhere — and (a data-layer
  // gap this bundle reports rather than invents around, docs/backend-notes/wp4h.md §7: no published
  // function returns a caregiver's own display name) this line stands in for a name row.
  f4IdentityVerifiedLine: { ar: 'تم التحقق من هويتك عبر تطبيق «هويتي» (محاكاة)', en: 'Your identity was verified with Hawiati (simulated)', placeholder: true },
  f4NotificationsTitle: { ar: 'إشعاراتي', en: 'My notifications', placeholder: true },
  f4BrowserNotifRow: { ar: 'إشعارات المتصفح', en: 'Browser notifications', placeholder: true },
  f4ChatRow: { ar: 'محادثة تيليجرام', en: 'Telegram chat', placeholder: true },
  f4PushDefault: { ar: 'لم تُفعَّل بعد', en: 'Not turned on yet', placeholder: true },
  f4PushGranted: { ar: 'مفعّلة', en: 'On', placeholder: true },
  f4PushDenied: { ar: 'محظورة في المتصفح', en: 'Blocked in the browser', placeholder: true },
  f4PushUnsupported: { ar: 'غير متاحة على هذا الجهاز', en: 'Not available on this device', placeholder: true },
  f4PushEnableAction: { ar: 'تفعيل إشعارات المتصفح', en: 'Turn on browser notifications', placeholder: true },
  f4PushDisableAction: { ar: 'إيقاف إشعارات المتصفح', en: 'Turn off browser notifications', placeholder: true },
  f4PushTestAction: { ar: 'إرسال إشعار تجريبي', en: 'Send a test notification', placeholder: true },
  f4ChatNotConnected: { ar: 'غير مرتبطة', en: 'Not connected', placeholder: true },
  f4ChatPending: { ar: 'بانتظار الربط…', en: 'Connecting…', placeholder: true },
  f4ChatConnectedAlertsOnly: { ar: 'مرتبطة · للتنبيهات فقط', en: 'Connected · alerts only', placeholder: true },
  f4ChatExpired: { ar: 'انتهت مهلة الربط', en: 'The connection link expired', placeholder: true },
  f4ChatConnectAction: { ar: 'ربط تيليجرام', en: 'Connect Telegram', placeholder: true },
  f4ChatDisconnectAction: { ar: 'فصل تيليجرام', en: 'Disconnect Telegram', placeholder: true },
  f4ChatTestAction: { ar: 'إرسال رسالة تجريبية', en: 'Send a test message', placeholder: true },
  f4AlertsOnlyNote: {
    ar: 'تصلك التنبيهات فقط. أسئلة الجرعات تُرسل إلى المريض وحده، ولا يمكنك تسجيل أي جرعة.',
    en: 'You’ll only get alerts. Questions about doses go to the patient alone, and you can’t record a dose for them.',
    placeholder: true,
  },
  f4AccessTitle: { ar: 'صلاحيتي', en: 'My access', placeholder: true },
  f4LinkedPatientLabel: { ar: 'المريض المرتبط بك', en: 'The patient you’re linked to', placeholder: true },
  f4UnlinkAction: { ar: 'افصل نفسي عن هذا الملف', en: 'Unlink myself from this record', placeholder: true },
  f4UnlinkSheetTitle: { ar: 'هل تريد فصل نفسك عن هذا الملف؟', en: 'Unlink yourself from this record?', placeholder: true },
  f4UnlinkSheetBody: {
    ar: 'لن تتمكن بعد ذلك من الاطلاع على بيانات المريض. ويمكن للمريض دعوتك مرة أخرى لاحقًا.',
    en: 'You won’t be able to see the patient’s information after this. They can invite you again later.',
    placeholder: true,
  },
  f4UnlinkConfirm: { ar: 'افصل نفسي', en: 'Unlink myself', placeholder: true },
  f4NoSettingsNote: {
    ar: 'هنا تضبط إشعاراتك أنت فقط. لا يؤثر أي شيء تغيّره هنا في إعدادات المريض أو جدوله أو سجل جرعاته.',
    en: 'This is only for your own notifications. Nothing you change here affects the patient’s settings, schedule or dose history.',
    placeholder: true,
  },
  f4DisconnectSheetTitle: { ar: 'هل تريد فصل تيليجرام؟', en: 'Disconnect Telegram?', placeholder: true },
  f4DisconnectSheetBody: {
    ar: 'ستتوقف تنبيهاتك عبر تيليجرام. ويمكنك ربطه مرة أخرى في أي وقت.',
    en: 'Your Telegram alerts will stop. You can connect it again at any time.',
    placeholder: true,
  },

  // ---------------------------------------------------------------------------------------------
  // F5 — caregiver help (/[locale]/care/more/help), static copy
  // ---------------------------------------------------------------------------------------------
  f5CanSeeTitle: { ar: 'ما الذي تراه بالضبط؟', en: 'What exactly can you see?', placeholder: true },
  f5CanSeeBody: {
    ar: 'أدوية المريض، وجدول الجرعات، وتنبيهات السلامة، وسجل الأحداث. ولا شيء أكثر مما يظهر للمريض نفسه.',
    en: 'The patient’s medicines, their dose schedule, safety alerts and the activity log. Never more than the patient sees.',
    placeholder: true,
  },
  f5CannotTitle: { ar: 'ما الذي لا يمكنك فعله؟', en: 'What can’t you do?', placeholder: true },
  f5CannotBody: {
    ar: 'لا يمكنك تسجيل جرعة نيابةً عن المريض، ولا تعديل وصفة، ولا تغيير أي إعداد. لذلك لن تجد أزرارًا لهذه الأمور.',
    en: 'You can’t record a dose for the patient, change a prescription or change any setting. That’s why you won’t find buttons for these.',
    placeholder: true,
  },
  f5DangerTitle: { ar: 'إذا ظهر تنبيه بتعارض خطير', en: 'If a serious interaction alert appears', placeholder: true },
  f5DangerBody: {
    ar: 'افتح التنبيه واقرأه، ثم تواصل مع العيادة أو الصيدلية التي صرفت الدواء. لا توقف أي دواء ولا تغيّره بنفسك، فالتنبيه لدى مختص طبي يراجعه بالفعل.',
    en: 'Open the alert and read it, then contact the clinic or pharmacy that dispensed the medicine. Don’t stop or change any medicine yourself. A medical reviewer is already checking the alert.',
    placeholder: true,
  },
  f5TrackingOffTitle: { ar: 'إذا كانت متابعة الجرعات متوقفة لدى المريض', en: 'If the patient has dose tracking off', placeholder: true },
  f5TrackingOffBody: {
    ar: 'سترى جدول الجرعات، لكن دون بيان هل أُخذت كل جرعة، لأنه لا يُسجَّل أي شيء. وهذا وضع طبيعي، وليس خللًا في التطبيق.',
    en: 'You’ll see the dose schedule, but not whether each dose was taken, because nothing is being recorded. That’s normal, not a problem with the app.',
    placeholder: true,
  },
  f5AccessEndedTitle: { ar: 'هل انتهى وصولك؟', en: 'Has your access ended?', placeholder: true },
  f5AccessEndedBody: {
    ar: 'يمكن للمريض سحب صلاحيتك في أي وقت، ويمكنك أنت أيضًا فصل نفسك عن الملف. وللعودة، اطلب من المريض إرسال دعوة جديدة إليك، ثم اقبلها.',
    en: 'The patient can remove your access at any time, and you can unlink yourself too. To come back, ask them to send you a new invitation, then accept it.',
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

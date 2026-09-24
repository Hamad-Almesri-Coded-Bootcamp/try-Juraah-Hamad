/**
 * Copy catalogue, ambient group (WP4 bundle g — E1 calendar sync, E2 activity, E3 settings, E4
 * help, E5 notifications & messaging). Owned by this bundle from wave 3 on. Every key is
 * `placeholder: true` until the owner's bilingual deck lands (guard P counts these, never fails).
 *
 * Reused elsewhere rather than duplicated here: `copy.vocabulary` (status/actor/event words, on/off,
 * copy/copied, retry, back, asOf) and `copy.identity` (the phone editor's own labels — `PhoneEditor`
 * is imported as-is for E3's optional contact phone, per the brief's "import only" instruction).
 */
import type { CopyEntry } from './shell';

export const ambient = {
  // ---------------------------------------------------------------------------------------------
  // More (the patient shell's menu, Daylight CR-071): the three group headings and the state line
  // under a row, each read from the data the row opens. The row labels stay in shell.ts.
  // ---------------------------------------------------------------------------------------------
  moreGroupMedicines: { ar: 'أدويتك', en: 'Your medicines', placeholder: true },
  moreGroupPeople: { ar: 'الأشخاص والتنبيهات', en: 'People and alerts', placeholder: true },
  moreGroupAccount: { ar: 'حسابك', en: 'Your account', placeholder: true },
  moreRefillPendingOne: { ar: 'طلب واحد بانتظار الموافقة', en: '{count} request waiting for approval', placeholder: true },
  moreRefillPendingTwo: { ar: 'طلبان بانتظار الموافقة', en: '{count} requests waiting for approval', placeholder: true },
  moreRefillPendingFew: { ar: '{count} طلبات بانتظار الموافقة', en: '{count} requests waiting for approval', placeholder: true },
  moreRefillPendingMany: { ar: '{count} طلبًا بانتظار الموافقة', en: '{count} requests waiting for approval', placeholder: true },
  moreRefillPendingOther: { ar: '{count} طلب بانتظار الموافقة', en: '{count} requests waiting for approval', placeholder: true },
  moreCalendarOn: { ar: 'مفعّلة', en: 'On', placeholder: true },
  moreCalendarOff: { ar: 'متوقفة', en: 'Off', placeholder: true },
  moreFollowingOne: { ar: 'شخص واحد يتابع ملفك', en: '{count} person following your record', placeholder: true },
  moreFollowingTwo: { ar: 'شخصان يتابعان ملفك', en: '{count} people following your record', placeholder: true },
  moreFollowingFew: { ar: '{count} أشخاص يتابعون ملفك', en: '{count} people following your record', placeholder: true },
  moreFollowingMany: { ar: '{count} شخصًا يتابعون ملفك', en: '{count} people following your record', placeholder: true },
  moreFollowingOther: { ar: '{count} شخص يتابعون ملفك', en: '{count} people following your record', placeholder: true },
  moreInvitesWaitingOne: { ar: 'دعوة واحدة بانتظار الرد', en: '{count} invitation waiting', placeholder: true },
  moreInvitesWaitingTwo: { ar: 'دعوتان بانتظار الرد', en: '{count} invitations waiting', placeholder: true },
  moreInvitesWaitingFew: { ar: '{count} دعوات بانتظار الرد', en: '{count} invitations waiting', placeholder: true },
  moreInvitesWaitingMany: { ar: '{count} دعوةً بانتظار الرد', en: '{count} invitations waiting', placeholder: true },
  moreInvitesWaitingOther: { ar: '{count} دعوة بانتظار الرد', en: '{count} invitations waiting', placeholder: true },
  moreChatConnected: { ar: 'تيليجرام مربوط', en: 'Telegram connected', placeholder: true },
  moreChatPending: { ar: 'بانتظار تأكيد الربط', en: 'Waiting to connect', placeholder: true },
  moreChatNotConnected: { ar: 'تيليجرام غير مربوط', en: 'Telegram not connected', placeholder: true },

  // ---------------------------------------------------------------------------------------------
  // E1 — Calendar sync
  // ---------------------------------------------------------------------------------------------
  e1SubscribeBody: {
    ar: 'بخطوة واحدة يظهر جدول جرعاتك في تقويمك، ويتحدّث تلقائيًا مع كل تغيير.',
    en: 'One step, and your dose schedule shows up in your calendar. It updates by itself whenever something changes.',
    placeholder: true,
  },
  e1SubscribeAction: { ar: 'احصل على رابط التقويم', en: 'Get a calendar link', placeholder: true },
  e1CopyFieldLabel: { ar: 'رابط التقويم', en: 'Calendar link', placeholder: true },
  e1HowToAddTitle: { ar: 'كيف تضيفه', en: 'How to add it', placeholder: true },
  e1Step1: { ar: 'انسخ الرابط أعلاه.', en: 'Copy the link above.', placeholder: true },
  e1Step2: {
    ar: 'افتح تقويم جوجل أو تقويم آبل، واختر إضافة تقويم من رابط.',
    en: 'Open Google Calendar or Apple Calendar, and choose to add a calendar from a link.',
    placeholder: true,
  },
  e1Step3: { ar: 'الصق الرابط واحفظ.', en: 'Paste the link and save.', placeholder: true },
  e1OneDirectionalTitle: { ar: 'التحديثات تنتقل من التطبيق إلى تقويمك فقط', en: 'Updates only go from Jur’ah to your calendar', placeholder: true },
  e1OneDirectionalBody: {
    ar: 'التعديلات التي تجريها في تقويمك لا تسجّل أي جرعة.',
    en: 'Changes you make in your calendar don’t record a dose.',
    placeholder: true,
  },

  // ---------------------------------------------------------------------------------------------
  // E2 — Activity feed
  // ---------------------------------------------------------------------------------------------
  e2EmptyTitle: { ar: 'لم يُسجَّل شيء بعد', en: 'Nothing recorded yet', placeholder: true },
  e2EmptyBody: {
    ar: 'ستظهر هنا كل إضافة أو تنبيه أو تغيير فور حدوثه.',
    en: 'Every addition, alert and change will show up here as it happens.',
    placeholder: true,
  },
  e2ReadOnlyNote: { ar: 'كل ما هنا محفوظ كما حدث تمامًا.', en: 'Everything here is kept exactly as it happened.', placeholder: true },

  // ---------------------------------------------------------------------------------------------
  // E3 — Settings
  // ---------------------------------------------------------------------------------------------
  e3TrackingLabel: { ar: 'رسائل متابعة الجرعات', en: 'Dose check-in messages', placeholder: true },
  e3TrackingDescription: {
    ar: 'تصلك رسالة في المحادثة تسألك عن جرعاتك، وتردّ عليها هناك.',
    en: 'A message in your chat asks about your doses, and you reply there.',
    placeholder: true,
  },
  e3TrackingNoChatNotice: {
    ar: 'اربط المحادثة لتصلك رسائل المتابعة.',
    en: 'Connect the chat to get check-in messages.',
    placeholder: true,
  },
  e3TrackingNoChatAction: { ar: 'إعداد المحادثة', en: 'Set up the chat', placeholder: true },
  e3FrequencyLabel: { ar: 'كم مرة نسألك؟', en: 'How often should we ask?', placeholder: true },
  // Under the frequency choice while check-ins are off: a quiet fact, never a prompt or a warning.
  e3FrequencyOffNote: {
    ar: 'يسري هذا الاختيار عندما تُفعَّل رسائل المتابعة.',
    en: 'This applies once check-in messages are on.',
    placeholder: true,
  },
  e3FrequencyDaily: { ar: 'كل يوم', en: 'Every day', placeholder: true },
  e3FrequencyAltDay: { ar: 'مرة كل يومين', en: 'Every other day', placeholder: true },
  e3RefillAlertsLabel: { ar: 'تنبيهات تجديد الوصفة', en: 'Refill alerts', placeholder: true },
  e3RefillAlertsDescription: {
    ar: 'ننبّهك عندما يقترب أحد أدويتك من النفاد.',
    en: 'We’ll let you know when a medicine is running low.',
    placeholder: true,
  },
  e3CalendarSyncLabel: { ar: 'مزامنة التقويم', en: 'Calendar sync', placeholder: true },
  e3CalendarSyncDescription: {
    ar: 'يضيف جدول جرعاتك إلى تقويمك.',
    en: 'Adds your dose schedule to your calendar.',
    placeholder: true,
  },
  // E3 — the group headings (Daylight, CR-071)
  e3GroupCheckIns: { ar: 'متابعة الجرعات', en: 'Dose check-ins', placeholder: true },
  e3GroupAlerts: { ar: 'التنبيهات والتقويم', en: 'Alerts and calendar', placeholder: true },
  e3GroupContact: { ar: 'التواصل', en: 'Contact', placeholder: true },
  e3EngineNote: {
    ar: 'تبقى قائمة أدويتك وفحص التعارضات وجدول جرعاتك تعمل دائمًا، مهما اخترت هنا.',
    en: 'Your medicine list, interaction checks and dose schedule always stay on, whatever you choose here.',
    placeholder: true,
  },
  e3TurnOffSheetTitle: { ar: 'إيقاف متابعة الجرعات؟', en: 'Turn off dose tracking?', placeholder: true },
  e3TurnOffConsequence1: { ar: 'تتوقف رسائل المتابعة.', en: 'Check-in messages stop.', placeholder: true },
  e3TurnOffConsequence2: { ar: 'ستظهر الجرعات الجديدة من دون حالة.', en: 'New doses won’t show a status.', placeholder: true },
  e3TurnOffConsequence3: { ar: 'يبقى سجلّ جرعاتك حتى الآن محفوظًا.', en: 'Your dose history so far is kept.', placeholder: true },
  e3TurnOffConfirm: { ar: 'إيقاف المتابعة', en: 'Turn tracking off', placeholder: true },
  e3TurnOffCancel: { ar: 'إبقاء المتابعة', en: 'Keep tracking on', placeholder: true },
  e3SheetCloseLabel: { ar: 'إغلاق', en: 'Close', placeholder: true },

  // ---------------------------------------------------------------------------------------------
  // E4 — Help & support (patient)
  // ---------------------------------------------------------------------------------------------
  e4HowItWorksTitle: { ar: 'ماذا يفعل تطبيق جرعة؟', en: 'What does Jur’ah do?', placeholder: true },
  e4HowItWorksBody: {
    ar: 'يجمع وصفاتك من كل مستشفى وعيادة في سجل واحد، ويبني منها جدول جرعاتك اليومي، ويفحص كل دواء جديد مقابل كل ما في ملفك.',
    en: 'It brings your prescriptions from every hospital and clinic into one record, builds your daily dose schedule from them, and checks each new medicine against everything in your file.',
    placeholder: true,
  },
  e4CheckInsTitle: { ar: 'متابعة الجرعات اختيارية', en: 'Check-ins are optional', placeholder: true },
  e4CheckInsBody: {
    ar: 'إذا فعّلتها، نسألك عن جرعاتك في المحادثة وتجيب هناك. التطبيق نفسه لا يسجّل أي جرعة.',
    en: 'If you turn them on, we’ll ask about your doses in your chat, and you answer there. The app itself never records a dose.',
    placeholder: true,
  },
  e4DoseWrongTitle: { ar: 'هل تبدو تعليمات الجرعة خاطئة؟', en: 'Does a dose instruction look wrong?', placeholder: true },
  e4DoseWrongBody: {
    ar: 'لا تغيّرها بنفسك. تواصل مع العيادة أو الصيدلية التي صرفت الدواء، وستجد رقمها في تفاصيل الوصفة.',
    en: 'Don’t change it yourself. Contact the clinic or pharmacy that dispensed it. You’ll find their number in the prescription details.',
    placeholder: true,
  },
  e4SafetyAlertTitle: { ar: 'هل ظهر لك تنبيه سلامة؟', en: 'Got a safety alert?', placeholder: true },
  e4SafetyAlertBody: {
    ar: 'افتحه واقرأه. يراجع طبيب أو صيدلي كل تنبيه خطير قبل أن تصبح نتيجته نهائية، وتُبيّن لك الشاشة أين وصلت المراجعة. لا تغيّر أي دواء ولا توقفه من تلقاء نفسك.',
    en: 'Open it and read it. A doctor or pharmacist checks every serious alert before the result is final, and the screen tells you where it stands. Never change or stop a medicine on your own.',
    placeholder: true,
  },
  e4ContactClinicTitle: { ar: 'هل تريد التواصل مع العيادة أو الصيدلية؟', en: 'Need to reach the clinic or pharmacy?', placeholder: true },
  e4ContactClinicBody: {
    ar: 'تجد في تفاصيل كل وصفة الجهة التي صرفت الدواء وطريقة التواصل معها.',
    en: 'Each prescription’s details show who issued the medicine and how to reach them.',
    placeholder: true,
  },
  e4NoAdviceNote: { ar: 'لا يقدّم هذا التطبيق استشارة طبية.', en: 'This app doesn’t give medical advice.', placeholder: true },

  // ---------------------------------------------------------------------------------------------
  // E5 — Notifications & messaging
  // ---------------------------------------------------------------------------------------------
  e5BrowserSectionTitle: { ar: 'إشعارات المتصفح', en: 'Browser notifications', placeholder: true },
  e5BrowserSummary: {
    ar: 'نرسل التنبيهات المهمة فقط: تعارض خطير، وقرار المراجع الطبي، ودواء أوشك على النفاد، ووصفة جديدة، ودعوة مقدّم رعاية.',
    en: 'We only send alerts that matter: a serious interaction, a medical reviewer’s decision, a medicine running low, a new prescription and a caregiver invitation.',
    placeholder: true,
  },
  e5DefaultBody: {
    ar: 'عند الضغط على الزر، سيسألك متصفحك إن كنت تسمح بالإشعارات.',
    en: 'When you tap the button, your browser will ask if it can show you notifications.',
    placeholder: true,
  },
  e5EnableAction: { ar: 'فعّل الإشعارات', en: 'Turn on notifications', placeholder: true },
  e5GrantedNoticeTitle: { ar: 'الإشعارات مفعّلة', en: 'Notifications are on', placeholder: true },
  e5GrantedNoticeBody: {
    ar: 'الضغط على الإشعار يفتح الشاشة المناسبة فقط، ولا يسجّل أي جرعة.',
    en: 'Tapping a notification only opens the right screen. It never records a dose.',
    placeholder: true,
  },
  e5AlertDanger: { ar: 'تعارض خطير', en: 'Serious interaction', placeholder: true },
  e5AlertReviewer: { ar: 'قرار المراجع الطبي', en: 'Medical reviewer’s decision', placeholder: true },
  e5AlertRefill: { ar: 'دواء أوشك على النفاد', en: 'Medicine running low', placeholder: true },
  e5AlertNewRx: { ar: 'وصفة جديدة', en: 'New prescription', placeholder: true },
  e5AlertInvite: { ar: 'دعوة مقدّم رعاية', en: 'Caregiver invitation', placeholder: true },
  e5AlertReminder: { ar: 'تذكير بالجرعة', en: 'Dose reminder', placeholder: true },
  e5AlertReminderNote: { ar: 'أقل إلحاحًا', en: 'less urgent', placeholder: true },
  e5SendTestAction: { ar: 'أرسل إشعارًا تجريبيًا', en: 'Send a test notification', placeholder: true },
  // What the screen says once a test was sent (it used to reuse the clipboard's "Copied").
  e5TestNotificationSent: { ar: 'أُرسل الإشعار التجريبي.', en: 'Test notification sent.', placeholder: true },
  e5TestMessageSent: { ar: 'أُرسلت الرسالة التجريبية.', en: 'Test message sent.', placeholder: true },
  e5AlertsListTitle: { ar: 'ما يصلك', en: 'What you’ll get', placeholder: true },
  e5DisableAction: { ar: 'أوقف الإشعارات', en: 'Turn off notifications', placeholder: true },
  e5DeniedNoticeTitle: { ar: 'الإشعارات متوقفة في متصفحك', en: 'Notifications are off in your browser', placeholder: true },
  e5DeniedNoticeBody: {
    ar: 'لا بأس، ولن نسألك مرة أخرى.',
    en: 'That’s fine, and we won’t ask again.',
    placeholder: true,
  },
  e5DeniedHowToTitle: { ar: 'كيف تعيد تفعيلها', en: 'How to turn them back on', placeholder: true },
  e5DeniedHowToBody: {
    ar: 'في متصفحك، اضغط على رمز القفل بجانب عنوان الموقع، ثم «الإشعارات»، ثم «السماح».',
    en: 'In your browser, tap the lock next to the web address, then Notifications, then Allow.',
    placeholder: true,
  },
  e5DeniedFooterNote: {
    ar: 'ستجد كل تنبيهاتك داخل التطبيق دائمًا.',
    en: 'You’ll always find every alert inside the app.',
    placeholder: true,
  },
  e5UnsupportedNoticeTitle: { ar: 'هذا المتصفح لا يدعم الإشعارات', en: 'This browser doesn’t support notifications', placeholder: true },
  e5UnsupportedNoticeBody: {
    ar: 'ستجد كل تنبيهاتك داخل التطبيق. وإن أردت الإشعارات، جرّب متصفحًا آخر أو اربط المحادثة.',
    en: 'You’ll still find every alert inside the app. If you’d like notifications, try another browser or connect the chat.',
    placeholder: true,
  },
  e5IosNoticeTitle: { ar: 'على آيفون وآيباد، أضف التطبيق أولًا', en: 'On iPhone and iPad, add Jur’ah first', placeholder: true },
  e5IosNoticeBody: {
    ar: 'لا تصل الإشعارات إلا بعد إضافة تطبيق جرعة إلى الشاشة الرئيسية، ويتطلب ذلك إصدار النظام ١٦٫٤ أو أحدث.',
    en: 'Notifications only arrive once Jur’ah is on your Home Screen. This needs iOS 16.4 or later.',
    placeholder: true,
  },
  e5IosStepsTitle: { ar: 'أضف تطبيق جرعة إلى الشاشة الرئيسية', en: 'Add Jur’ah to your Home Screen', placeholder: true },
  e5IosStep1: { ar: 'اضغط زر المشاركة في سفاري', en: 'Tap the Share button in Safari', placeholder: true },
  e5IosStep2: { ar: 'اختر «إضافة إلى الشاشة الرئيسية»', en: 'Choose “Add to Home Screen”', placeholder: true },
  e5IosStep3: { ar: 'افتح تطبيق جرعة من الأيقونة الجديدة', en: 'Open Jur’ah from the new icon', placeholder: true },
  e5IosStep4: { ar: 'عُد إلى هذه الشاشة وفعّل الإشعارات', en: 'Come back here and turn notifications on', placeholder: true },
  e5IosChatInsteadAction: { ar: 'اربط المحادثة بدلًا من ذلك', en: 'Connect the chat instead', placeholder: true },

  e5ChatSectionTitle: { ar: 'محادثة تيليجرام', en: 'Telegram chat', placeholder: true },
  e5ChatSummary: {
    ar: 'تصلك رسائل المتابعة في محادثة تيليجرام، وتردّ عليها هناك.',
    en: 'Check-in messages come to your Telegram chat, and you answer them there.',
    placeholder: true,
  },
  e5ChatNotConnectedBody: {
    ar: 'يمكنك ربط المحادثة لتصلك رسائل المتابعة فيها.',
    en: 'You can connect the chat to get your check-ins there.',
    placeholder: true,
  },
  e5OpenChatAction: { ar: 'افتح تيليجرام', en: 'Open Telegram', placeholder: true },
  e5ChatStepsBody: {
    ar: 'اضغط «افتح تيليجرام»، ثم اضغط «ابدأ» في المحادثة. بهذه الخطوة يرتبط حسابك، ونتمكن من مراسلتك.',
    en: 'Tap Open Telegram, then press Start in the chat. That links your account, so we can message you.',
    placeholder: true,
  },
  e5ChatWaitingTitle: { ar: 'بانتظار التأكيد', en: 'Waiting for confirmation', placeholder: true },
  e5ChatWaitingBody: {
    ar: 'افتح المحادثة في تيليجرام واضغط «ابدأ». ستتحدّث هذه الصفحة تلقائيًا بعد الربط.',
    en: 'Open the chat in Telegram and press Start. This page will update by itself once you’re connected.',
    placeholder: true,
  },
  e5ChatConnectedSinceTemplate: { ar: 'مربوطة منذ {date}', en: 'Connected since {date}', placeholder: true },
  e5SendTestMessageAction: { ar: 'أرسل رسالة تجريبية', en: 'Send a test message', placeholder: true },
  e5DisconnectAction: { ar: 'فصل الربط', en: 'Disconnect', placeholder: true },
  e5DisconnectSheetTitle: { ar: 'فصل ربط المحادثة؟', en: 'Disconnect the chat?', placeholder: true },
  e5DisconnectConsequence1: { ar: 'تتوقف رسائل المتابعة.', en: 'Check-in messages stop.', placeholder: true },
  e5DisconnectConsequence2: {
    ar: 'تتوقف متابعة الجرعات أيضًا، لأنها تعمل عبر المحادثة.',
    en: 'Dose tracking turns off too, since it works through the chat.',
    placeholder: true,
  },
  e5DisconnectConsequence3: { ar: 'يبقى سجلّ جرعاتك حتى الآن محفوظًا.', en: 'Your dose history so far is kept.', placeholder: true },
  e5DisconnectConfirm: { ar: 'فصل الربط', en: 'Disconnect', placeholder: true },
  e5DisconnectCancel: { ar: 'إبقاء الربط', en: 'Stay connected', placeholder: true },
  e5ChatExpiredTitle: { ar: 'انتهت صلاحية هذا الرابط', en: 'This link has expired', placeholder: true },
  e5ChatExpiredBody: { ar: 'يمكنك ربط المحادثة من جديد.', en: 'You can start again to connect the chat.', placeholder: true },
  e5BotHandleTemplate: { ar: 'على تيليجرام: {handle}', en: 'On Telegram: {handle}', placeholder: true },
  e5SimulatedNote: {
    ar: 'هذه نسخة تجريبية، والمحادثة غير مفعّلة بعد.',
    en: 'This is a demo, so the chat isn’t live yet.',
    placeholder: true,
  },
} satisfies Record<string, CopyEntry>;

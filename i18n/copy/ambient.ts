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
  // E1 — Calendar sync
  // ---------------------------------------------------------------------------------------------
  e1SubscribeBody: {
    ar: 'اشترك مرة واحدة، وجدول جرعاتك يظهر في تقويمك ويتحدث تلقائيًا مع كل تغيير.',
    en: 'Subscribe once, and your dose schedule appears in your calendar app — updating on its own with every change.',
    placeholder: true,
  },
  e1SubscribeAction: { ar: 'إنشاء رابط الاشتراك', en: 'Create subscription link', placeholder: true },
  e1CopyFieldLabel: { ar: 'رابط التقويم', en: 'Calendar link', placeholder: true },
  e1HowToAddTitle: { ar: 'كيف تضيفه', en: 'How to add it', placeholder: true },
  e1Step1: { ar: 'انسخ الرابط فوق.', en: 'Copy the link above.', placeholder: true },
  e1Step2: {
    ar: 'افتح تقويم جوجل أو آبل ← إضافة تقويم بالرابط.',
    en: 'Open Google Calendar or Apple Calendar → add a calendar by URL.',
    placeholder: true,
  },
  e1Step3: { ar: 'الصق الرابط واحفظ.', en: 'Paste the link and save.', placeholder: true },
  e1OneDirectionalTitle: { ar: 'المزامنة باتجاه واحد', en: 'Sync is one-directional', placeholder: true },
  e1OneDirectionalBody: {
    ar: 'أي تعديل تسويه داخل تقويمك ما يُقرأ كتسجيل جرعة.',
    en: 'Anything you change inside your own calendar app is never read as a dose record.',
    placeholder: true,
  },

  // ---------------------------------------------------------------------------------------------
  // E2 — Activity feed
  // ---------------------------------------------------------------------------------------------
  e2EmptyTitle: { ar: 'ما فيه شي مسجّل بعد', en: 'Nothing recorded yet', placeholder: true },
  e2EmptyBody: {
    ar: 'كل إضافة أو تنبيه أو تغيير يظهر هنا أول ما يصير.',
    en: 'Every addition, alert and change appears here as it happens.',
    placeholder: true,
  },
  e2ReadOnlyNote: { ar: 'السجل للعرض فقط.', en: 'This log is view-only.', placeholder: true },

  // ---------------------------------------------------------------------------------------------
  // E3 — Settings
  // ---------------------------------------------------------------------------------------------
  e3TrackingLabel: { ar: 'رسائل متابعة الجرعات', en: 'Daily check-in messages', placeholder: true },
  e3TrackingDescription: {
    ar: 'رسالة يومية على محادثتك المربوطة تسأل عن جرعاتك.',
    en: 'A daily message on your connected chat asks about your doses.',
    placeholder: true,
  },
  e3TrackingNoChatNotice: {
    ar: 'تحتاج محادثة مربوطة عشان تستخدم رسائل المتابعة.',
    en: 'A connected chat is what turns daily check-ins on.',
    placeholder: true,
  },
  e3TrackingNoChatAction: { ar: 'إعداد الإشعارات والمراسلة', en: 'Set up notifications & messaging', placeholder: true },
  e3FrequencyLabel: { ar: 'كل قد إيش', en: 'Check-in frequency', placeholder: true },
  e3FrequencyDaily: { ar: 'كل يوم', en: 'Every day', placeholder: true },
  e3FrequencyAltDay: { ar: 'يوم بعد يوم', en: 'Every other day', placeholder: true },
  e3RefillAlertsLabel: { ar: 'تنبيهات قرب نهاية الكمية', en: 'Refill alerts', placeholder: true },
  e3RefillAlertsDescription: {
    ar: 'تنبيه لما تقارب كمية دوائك تخلص.',
    en: 'A heads-up when one of your supplies is running low.',
    placeholder: true,
  },
  e3CalendarSyncLabel: { ar: 'مزامنة التقويم', en: 'Calendar sync', placeholder: true },
  e3CalendarSyncDescription: {
    ar: 'يضيف جدول جرعاتك لتقويمك الخاص.',
    en: 'Adds your dose schedule to your own calendar app.',
    placeholder: true,
  },
  e3EngineNote: {
    ar: 'لوحة الأدوية وفحص التعارضات ومحرك الجدول تشتغل دائمًا — ما لها مفتاح إيقاف هنا ولا في أي مكان.',
    en: 'Your medicine list, interaction screening and the schedule engine always run — there is no switch for them, here or anywhere.',
    placeholder: true,
  },
  e3TurnOffSheetTitle: { ar: 'إيقاف متابعة الجرعات؟', en: 'Turn off adherence tracking?', placeholder: true },
  e3TurnOffConsequence1: { ar: 'تتوقف رسائل المتابعة اليومية.', en: 'Daily check-in messages stop.', placeholder: true },
  e3TurnOffConsequence2: { ar: 'الجرعات الجديدة تصير بدون حالة.', en: 'New doses stop carrying a status.', placeholder: true },
  e3TurnOffConsequence3: { ar: 'سجلّك المسجّل يبقى محفوظًا.', en: 'Your recorded history is kept.', placeholder: true },
  e3TurnOffConfirm: { ar: 'إيقاف المتابعة', en: 'Turn tracking off', placeholder: true },
  e3TurnOffCancel: { ar: 'إبقاء المتابعة', en: 'Keep tracking on', placeholder: true },
  e3SheetCloseLabel: { ar: 'إغلاق', en: 'Close', placeholder: true },

  // ---------------------------------------------------------------------------------------------
  // E4 — Help & support (patient)
  // ---------------------------------------------------------------------------------------------
  e4HowItWorksTitle: { ar: 'شنو تسوي جرعة؟', en: 'What does Jur’ah do?', placeholder: true },
  e4HowItWorksBody: {
    ar: 'تجمع وصفاتك من كل مستشفى وعيادة في سجل واحد، تبني منها جدول جرعاتك اليومي، وتفحص كل دواء جديد على ملفك كامل.',
    en: 'It gathers your prescriptions from every hospital and clinic into one record, builds your daily dose schedule from them, and screens every new medicine against your whole file.',
    placeholder: true,
  },
  e4CheckInsTitle: { ar: 'متابعة الجرعات اختيارية', en: 'Check-ins are optional', placeholder: true },
  e4CheckInsBody: {
    ar: 'لو فعّلتها، يوصلك سؤال يومي على المحادثة وترد عليه هناك — ما فيه مكان داخل التطبيق تعلّم فيه جرعة كمأخوذة، وهذا مقصود.',
    en: 'If you turn it on, a daily question reaches you on the chat and you answer it there — there is no place inside the app to mark a dose as taken, and that is deliberate.',
    placeholder: true,
  },
  e4DoseWrongTitle: { ar: 'تعليمات الجرعة تبيّن غلط؟', en: 'A dose instruction looks wrong?', placeholder: true },
  e4DoseWrongBody: {
    ar: 'لا تعدّلها بنفسك. تواصل مع العيادة أو الصيدلية اللي صرفت الدواء — أرقامهم في تفاصيل الوصفة.',
    en: 'Do not change it yourself. Contact the clinic or pharmacy that dispensed it — their number is on the prescription detail.',
    placeholder: true,
  },
  e4SafetyAlertTitle: { ar: 'طلع لك تنبيه سلامة؟', en: 'A safety alert appears?', placeholder: true },
  e4SafetyAlertBody: {
    ar: 'افتحه واقرأه. التنبيه الخطير يمر على طبيب أو صيدلي قبل ما يوصلك كنتيجة نهائية، والشاشة تقول لك وين وصل. ما تغيّر ولا توقف دواء من نفسك.',
    en: 'Open it and read it. A serious finding passes a doctor or pharmacist before it is final, and the screen says where it stands. Never change or stop a medicine on your own.',
    placeholder: true,
  },
  e4ContactClinicTitle: { ar: 'تبي تتواصل مع العيادة أو الصيدلية؟', en: 'Contacting the issuing clinic or pharmacy', placeholder: true },
  e4ContactClinicBody: {
    ar: 'رقم العيادة أو المستشفى اللي صرفت كل دواء موجود في تفاصيل الوصفة.',
    en: 'The facility that issued each medicine, and how to reach it, is on that prescription’s own detail screen.',
    placeholder: true,
  },
  e4NoAdviceNote: { ar: 'هذا التطبيق ما يعطي استشارة طبية.', en: 'This app gives no medical advice.', placeholder: true },

  // ---------------------------------------------------------------------------------------------
  // E5 — Notifications & messaging
  // ---------------------------------------------------------------------------------------------
  e5BrowserSectionTitle: { ar: 'إشعارات المتصفح', en: 'Browser notifications', placeholder: true },
  e5BrowserSummary: {
    ar: 'تنبيهات فقط: تعارض خطير، قرار مراجع، تحذير نفاد، وصفة جديدة، ودعوة مقدّم رعاية.',
    en: 'Alerts only: a serious interaction, a reviewer decision, a low-supply warning, a new prescription, and a caregiver invitation.',
    placeholder: true,
  },
  e5DefaultBody: {
    ar: 'المتصفح راح يسألك إذنًا. نشرح قبل ما نطلب.',
    en: 'Your browser will ask you for permission. We explain before we ask.',
    placeholder: true,
  },
  e5EnableAction: { ar: 'فعّل الإشعارات', en: 'Enable notifications', placeholder: true },
  e5GrantedNoticeTitle: { ar: 'الإشعارات مفعّلة', en: 'Notifications are on', placeholder: true },
  e5GrantedNoticeBody: {
    ar: 'الإشعار يفتح الشاشة — وما يسجّل جرعة أبدًا.',
    en: 'A notification opens the screen — it never records a dose.',
    placeholder: true,
  },
  e5AlertDanger: { ar: 'تعارض خطير', en: 'Serious interaction', placeholder: true },
  e5AlertReviewer: { ar: 'قرار المراجع', en: 'Reviewer decision', placeholder: true },
  e5AlertRefill: { ar: 'تحذير نفاد الدواء', en: 'Low-supply warning', placeholder: true },
  e5AlertNewRx: { ar: 'وصفة جديدة', en: 'New prescription', placeholder: true },
  e5AlertInvite: { ar: 'دعوة مقدّم رعاية', en: 'Caregiver invitation', placeholder: true },
  e5AlertReminder: { ar: 'تذكير الجرعة', en: 'Dose reminder', placeholder: true },
  e5AlertReminderNote: { ar: 'أقل إلحاحًا', en: 'lower urgency', placeholder: true },
  e5SendTestAction: { ar: 'أرسل إشعارًا تجريبيًا', en: 'Send a test notification', placeholder: true },
  e5DisableAction: { ar: 'إيقاف الإشعارات', en: 'Turn off notifications', placeholder: true },
  e5DeniedNoticeTitle: { ar: 'متصفحك مانع الإشعارات', en: 'Your browser is blocking notifications', placeholder: true },
  e5DeniedNoticeBody: {
    ar: 'حالة محيّدة: لا لون تحذير، لا نقطة حمراء، ولا تكرار للطلب.',
    en: 'A neutral state — no warning colour, no red dot, and we never ask again on our own.',
    placeholder: true,
  },
  e5DeniedHowToTitle: { ar: 'كيف ترجّعها', en: 'How to turn it back on', placeholder: true },
  e5DeniedHowToBody: {
    ar: 'من إعدادات الموقع في متصفحك: اضغط على القفل بجانب العنوان ← الإشعارات ← السماح.',
    en: 'From your browser’s site settings: tap the lock beside the address bar → Notifications → Allow.',
    placeholder: true,
  },
  e5DeniedFooterNote: {
    ar: 'كل التنبيهات موجودة داخل التطبيق — ما فيه شي يوصل بالإشعار فقط.',
    en: 'Every alert still lives inside the app — nothing is ever delivered only by a notification.',
    placeholder: true,
  },
  e5UnsupportedNoticeTitle: { ar: 'هذا المتصفح ما يستقبل إشعارات', en: 'This browser cannot receive notifications', placeholder: true },
  e5UnsupportedNoticeBody: {
    ar: 'كل تنبيهاتك تبقى داخل التطبيق. جرّب متصفح آخر أو اربط المحادثة بدلًا منها.',
    en: 'Every alert of yours still lives inside the app. Try another browser, or connect the chat instead.',
    placeholder: true,
  },
  e5IosNoticeTitle: { ar: 'على iOS لازم تثبيت أول', en: 'On iOS, install first', placeholder: true },
  e5IosNoticeBody: {
    ar: 'إشعارات الويب ما توصل في Safari إلا بعد إضافة جرعة للشاشة الرئيسية (iOS 16.4+).',
    en: 'Web notifications only reach Safari after Jur’ah is added to the Home Screen (iOS 16.4+).',
    placeholder: true,
  },
  e5IosStepsTitle: { ar: 'أضف جرعة للشاشة الرئيسية', en: 'Add Jur’ah to the Home Screen', placeholder: true },
  e5IosStep1: { ar: 'اضغط زر المشاركة في Safari', en: 'Tap the Share button in Safari', placeholder: true },
  e5IosStep2: { ar: 'اختر «إضافة إلى الشاشة الرئيسية»', en: 'Choose “Add to Home Screen”', placeholder: true },
  e5IosStep3: { ar: 'افتح جرعة من الأيقونة الجديدة', en: 'Open Jur’ah from the new icon', placeholder: true },
  e5IosStep4: { ar: 'رجع لهذي الشاشة وفعّل الإشعارات', en: 'Come back here and turn notifications on', placeholder: true },
  e5IosChatInsteadAction: { ar: 'اربط المحادثة بدلًا منها', en: 'Connect the chat instead', placeholder: true },

  e5ChatSectionTitle: { ar: 'ربط المحادثة', en: 'Chat', placeholder: true },
  e5ChatSummary: {
    ar: 'بعد الإشعارات، المحادثة هي المكان اللي تجاوب فيه على رسائل المتابعة اليومية.',
    en: 'Beyond notifications, the chat is where your daily check-ins are asked and answered.',
    placeholder: true,
  },
  e5ChatNotConnectedBody: {
    ar: 'اربط المحادثة عشان توصلك رسائل المتابعة والتجربة.',
    en: 'Connect the chat to receive daily check-ins and test messages there.',
    placeholder: true,
  },
  e5OpenChatAction: { ar: 'افتح تيليقرام', en: 'Open Telegram', placeholder: true },
  e5ChatStepsBody: {
    ar: 'البوت يقدر يراسلك بس بعد ما تفتحه وتضغط Start. هذي الخطوة هي اللي تربط حسابك.',
    en: 'The bot can only message you once you open it and press Start — this is the step that links your account.',
    placeholder: true,
  },
  e5ChatWaitingTitle: { ar: 'بانتظار التأكيد', en: 'Waiting for confirmation', placeholder: true },
  e5ChatWaitingBody: {
    ar: 'افتح البوت واضغط Start — هذي الصفحة تتحدّث تلقائيًا بمجرد ما يتم الربط.',
    en: 'Open the bot and press Start — this page updates on its own once it is linked.',
    placeholder: true,
  },
  e5ChatConnectedSinceTemplate: { ar: 'مربوط · {date}', en: 'Connected · {date}', placeholder: true },
  e5SendTestMessageAction: { ar: 'أرسل رسالة تجربة', en: 'Send a test message', placeholder: true },
  e5DisconnectAction: { ar: 'فصل الربط', en: 'Disconnect', placeholder: true },
  e5DisconnectSheetTitle: { ar: 'فصل ربط المحادثة؟', en: 'Disconnect the chat?', placeholder: true },
  e5DisconnectConsequence1: { ar: 'تتوقف رسائل المتابعة اليومية.', en: 'Daily check-in messages stop.', placeholder: true },
  e5DisconnectConsequence2: {
    ar: 'متابعة الجرعات تنطفي هي الثانية، لأنها تحتاج محادثة مربوطة.',
    en: 'Adherence tracking turns off too, since it needs a connected chat.',
    placeholder: true,
  },
  e5DisconnectConsequence3: { ar: 'سجلّ جرعاتك يبقى محفوظًا.', en: 'Your recorded dose history is kept.', placeholder: true },
  e5DisconnectConfirm: { ar: 'فصل الربط', en: 'Disconnect', placeholder: true },
  e5DisconnectCancel: { ar: 'إبقاء الربط', en: 'Keep connected', placeholder: true },
  e5ChatExpiredTitle: { ar: 'انتهت صلاحية هذا الرابط', en: 'This link expired', placeholder: true },
  e5ChatExpiredBody: { ar: 'ابدأ الربط من جديد.', en: 'Start again to connect the chat.', placeholder: true },
  e5BotHandleTemplate: { ar: 'البوت: {handle}', en: 'Bot: {handle}', placeholder: true },
  e5SimulatedNote: {
    ar: 'محاكاة في المرحلة الأولى — ما فيه بوت حقيقي بعد.',
    en: 'Simulated for Phase 1 — no real bot yet.',
    placeholder: true,
  },
} satisfies Record<string, CopyEntry>;

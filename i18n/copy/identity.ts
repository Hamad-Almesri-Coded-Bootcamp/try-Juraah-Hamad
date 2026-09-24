/**
 * Copy catalogue, identity group (WP4b): A1 sign-in, A1b role chooser, A2 first-run setup, A3
 * profile. Every key is `placeholder: true` until the owner's bilingual deck lands (D-003). Arabic
 * strings start from the wireframe boards' text (`Login`, `SignInStates`, `RoleChooser`, `Setup`)
 * where it does not break §13's neutral framing; English is drafted for this build.
 *
 * CR-001/CR-026 (RESOLVED, strict rule): A3 never prints a Civil ID, masked or whole. Its identity
 * line instead states the (simulated) Hawiati verification — `identityLineValue` below.
 */
import type { CopyEntry } from './shell';

export const identity = {
  // ---------------------------------------------------------------------------------------------
  // A1 — sign-in / identity verification (mock)
  // ---------------------------------------------------------------------------------------------
  signInKicker: {
    ar: 'هذا الدخول محاكاة، وليس ربطًا حقيقيًا بنظام الهوية الوطنية',
    en: 'This sign-in is a simulation, not connected to the real national ID service',
    placeholder: true,
  },
  // The tagline under the wordmark on the sign-in sky.
  signInTitle: { ar: 'أدويتك كلها في مكان واحد', en: 'All your medicines in one place', placeholder: true },
  signInBody: {
    ar: 'أدخل رقمك المدني للدخول، ثم وافق على الطلب في تطبيق هويتي.',
    en: 'Enter your Civil ID to sign in, then approve the request in the Hawiati app.',
    placeholder: true,
  },
  civilIdLabel: { ar: 'الرقم المدني', en: 'Civil ID', placeholder: true },
  civilIdHelper: { ar: 'هذه النسخة تقبل الأرقام التجريبية فقط', en: 'This version only accepts demo numbers', placeholder: true },
  continueLabel: { ar: 'متابعة', en: 'Continue', placeholder: true },
  backToLanding: { ar: 'العودة إلى الصفحة الرئيسية', en: 'Back to the home page', placeholder: true },
  invalidIdError: {
    ar: 'هذا الرقم غير موجود في القائمة التجريبية لهذه النسخة',
    en: 'This number isn’t on the demo list for this version',
    placeholder: true,
  },
  // Audit M14: validated on submit, never disabled-until-valid — each says what to do next (UX §5/§6).
  civilIdRequiredError: { ar: 'اكتب رقمك المدني', en: 'Enter your Civil ID', placeholder: true },
  civilIdLengthError: { ar: 'يتكوّن الرقم المدني من ١٢ رقمًا', en: 'A Civil ID has 12 digits', placeholder: true },
  invalidIdHint: {
    ar: 'راجع الأرقام وحاول مرة أخرى.',
    en: 'Check the digits and try again.',
    placeholder: true,
  },
  // The three small steps under Continue (CR-071, V2SignIn): how the simulated sign-in goes.
  signInStepsLabel: { ar: 'كيف يتم الدخول', en: 'How signing in works', placeholder: true },
  signInStep1: { ar: 'تكتب رقمك المدني', en: 'You enter your Civil ID', placeholder: true },
  signInStep2: { ar: 'توافق في تطبيق هويتي', en: 'You approve in Hawiati', placeholder: true },
  signInStep3: { ar: 'يُفتح ملفك', en: 'Your record opens', placeholder: true },
  countdownLabel: { ar: 'افتح تطبيق هويتي ووافق على الطلب', en: 'Open the Hawiati app and approve the request', placeholder: true },
  cancelLabel: { ar: 'إلغاء', en: 'Cancel', placeholder: true },
  // The waiting-for-approval state (CR-071, V2SignInWait). Says plainly that the approval is simulated.
  approvalBody: {
    ar: 'هذه خطوة محاكاة. في الخدمة الحقيقية يصلك طلب موافقة على تطبيق هويتي في هاتفك، أما هنا فتتم الموافقة تلقائيًا بعد لحظات.',
    en: 'This step is simulated. In the real service, an approval request would reach the Hawiati app on your phone. Here it’s approved for you in a moment.',
    placeholder: true,
  },
  approvalLapsedBody: {
    ar: 'لم تصل الموافقة في الوقت المحدد، وهذا ليس خطأ منك. يمكنك المحاولة مرة أخرى بالرقم نفسه.',
    en: 'The approval didn’t arrive in time. That’s not your fault. You can try again with the same number.',
    placeholder: true,
  },
  // The `no_claims` message — IDENTICAL whether the Civil ID has an account or not (rule 6 / G9).
  noClaimsTitle: { ar: 'لا يوجد ما يمكن فتحه بهذا الرقم حاليًا', en: 'There’s nothing to open with this number right now', placeholder: true },
  noClaimsBody: {
    ar: 'لم تخطئ في شيء، ورقمك صحيح. كل ما في الأمر أنه لم تُمنح لك صلاحية الدخول بعد.',
    en: 'You haven’t done anything wrong, and your number is fine. You just haven’t been given access yet.',
    placeholder: true,
  },
  noClaimsCardTitle: { ar: 'لم يربطك أحد بملفه بعد', en: 'Nobody has linked you to their record yet', placeholder: true },
  noClaimsCardBody: {
    ar: 'إذا كنت تعتني بأحد، فاطلب منه أن يدعوك من «المزيد» ثم «مقدّمو الرعاية».',
    en: 'If you look after someone, ask them to invite you from More, then Caregivers.',
    placeholder: true,
  },

  // ---------------------------------------------------------------------------------------------
  // A1b — role chooser
  // ---------------------------------------------------------------------------------------------
  roleChooserTitle: { ar: 'أي ملف تريد أن تفتح؟', en: 'Which record would you like to open?', placeholder: true },
  roleChooserBody: {
    ar: 'رقمك المدني مرتبط بملفين، ويمكنك الانتقال بينهما في أي وقت دون تسجيل الخروج.',
    en: 'Your Civil ID is linked to two records. You can switch between them anytime without signing out.',
    placeholder: true,
  },
  roleChooserOwnTitle: { ar: 'أدويتي', en: 'My medicines', placeholder: true },
  roleChooserOwnButton: { ar: 'افتح ملفي', en: 'Open my record', placeholder: true },
  // A line under "My medicines", so the two choices carry the same weight (UX §2).
  roleChooserOwnBody: { ar: 'أدويتك وجدولك وتنبيهات السلامة الخاصة بك', en: 'Your own medicines, schedule and safety alerts', placeholder: true },
  roleChooserCaregiverTitleTemplate: { ar: 'أدوية {name}', en: '{name}’s medicines', placeholder: true },
  // Audit M4: the patient's own first-person label ('ابنتي' = "my daughter"), quoted as theirs.
  roleChooserRelationshipTemplate: { ar: 'صلة القرابة في الدعوة: «{relationship}»', en: 'Invited you as “{relationship}”', placeholder: true },
  roleChooserCaregiverButtonTemplate: { ar: 'افتح ملف {name}', en: 'Open {name}’s record', placeholder: true },
  roleChooserRememberNote: {
    ar: 'سنحفظ اختيارك للمرة القادمة.',
    en: 'We’ll remember your choice for next time.',
    placeholder: true,
  },

  // ---------------------------------------------------------------------------------------------
  // A2 — first-run setup (four steps)
  // ---------------------------------------------------------------------------------------------
  setupProgressLabel: { ar: 'خطوات الإعداد', en: 'Setup steps', placeholder: true },
  setupStepLanguage: { ar: 'اللغة', en: 'Language', placeholder: true },
  setupStepNotifications: { ar: 'التذكير', en: 'Reminders', placeholder: true },
  setupStepInvite: { ar: 'مقدّم الرعاية', en: 'Caregiver', placeholder: true },
  setupStepClosing: { ar: 'الجاهزية', en: 'Ready', placeholder: true },

  languageStepTitle: { ar: 'أي لغة تفضّل؟', en: 'Which language would you like to use?', placeholder: true },
  languageStepBody: {
    ar: 'يمكنك تغييرها في أي وقت من أعلى الشاشة.',
    en: 'You can change it anytime from the top of the screen.',
    placeholder: true,
  },
  languageFieldLabel: { ar: 'اللغة', en: 'Language', placeholder: true },
  languageOptionAr: { ar: 'العربية', en: 'العربية', placeholder: true },
  languageOptionEn: { ar: 'English', en: 'English', placeholder: true },

  notificationsStepTitle: { ar: 'كيف تفضّل أن نذكّرك؟', en: 'How would you like us to remind you?', placeholder: true },
  notificationsStepBody: {
    ar: 'اختر ما يناسبك. تعمل جرعة بالكامل أيًّا كان اختيارك.',
    en: 'Pick what suits you. Jur’ah works fully whichever you choose.',
    placeholder: true,
  },
  browserOfferTitle: { ar: 'إشعارات المتصفح', en: 'Browser notifications', placeholder: true },
  browserOfferBody: {
    ar: 'تنبيهات فقط، دون تطبيق إضافي. الضغط على التنبيه يفتح الشاشة المعنية ولا يسجّل أي جرعة.',
    en: 'Alerts only, no extra app needed. Tapping one opens the right screen and never records a dose.',
    placeholder: true,
  },
  browserOfferButton: { ar: 'فعّل إشعارات المتصفح', en: 'Turn on browser notifications', placeholder: true },
  telegramOfferTitle: { ar: 'محادثة تيليجرام', en: 'Telegram chat', placeholder: true },
  telegramOfferBody: {
    ar: 'يصلك سؤال يومي قصير عن جرعاتك، وتجيب عنه في المحادثة. وهذه هي الطريقة الوحيدة لتسجيل الجرعات التي تأخذها.',
    en: 'You get a short daily question about your doses and answer it in the chat. This is the only way to record the doses you take.',
    placeholder: true,
  },
  telegramOfferButton: { ar: 'اربط تيليجرام', en: 'Connect Telegram', placeholder: true },
  laterOfferTitle: { ar: 'لاحقًا', en: 'Later', placeholder: true },
  laterOfferBody: {
    ar: 'تابع دون تذكير في الوقت الحالي. يعمل جدولك وفحص التعارضات كالمعتاد.',
    en: 'Carry on without reminders for now. Your schedule and interaction checks work as usual.',
    placeholder: true,
  },
  laterOfferButton: { ar: 'لاحقًا', en: 'Later', placeholder: true },
  equalWeightNote: {
    ar: 'يمكنك تغيير اختيارك في أي وقت من «المزيد» ثم «الإشعارات والرسائل».',
    en: 'You can change this anytime from More, then Notifications and messages.',
    placeholder: true,
  },

  inviteStepTitle: { ar: 'هل تريد دعوة مقدّم رعاية؟', en: 'Would you like to invite a caregiver?', placeholder: true },
  inviteStepBody: {
    ar: 'الأمر يعود إليك. يمكنك دعوة أحد الآن، أو لاحقًا من «المزيد» ثم «مقدّمو الرعاية».',
    en: 'It’s up to you. You can invite someone now, or later from More, then Caregivers.',
    placeholder: true,
  },
  // Wired at the wave-1 gate (lead): the step mounts bundle h's InviteSheet from
  // `@/features/caregiving` — the same two-step flow F1 uses, never a second implementation.
  inviteOpenLabel: { ar: 'دعوة مقدّم رعاية', en: 'Invite a caregiver', placeholder: true },
  // What a caregiver gets, so the choice is an informed one (rule 8: never more than the patient sees).
  inviteWhatTheySee: {
    ar: 'يرى ما تراه أنت من أدويتك وجدولك وتنبيهات السلامة، ولا شيء أكثر.',
    en: 'They see what you see of your medicines, schedule and safety alerts, and nothing more.',
    placeholder: true,
  },
  inviteWhatTheyCannot: {
    ar: 'لا يستطيع تسجيل جرعة ولا تعديل وصفة، ويمكنك إيقاف وصوله متى شئت.',
    en: 'They can’t record a dose or change a prescription, and you can stop their access whenever you like.',
    placeholder: true,
  },
  skipInviteLabel: { ar: 'ليس الآن', en: 'Skip for now', placeholder: true },

  closingStepTitle: { ar: 'كل شيء جاهز', en: 'You’re all set', placeholder: true },
  closingStepBody: {
    ar: 'جدولك جاهز، وفحص التعارضات يعمل من الآن. يمكنك تغيير أي من اختياراتك متى شئت.',
    en: 'Your schedule is ready, and interaction checks are already running. You can change any of your choices whenever you like.',
    placeholder: true,
  },
  finishSetupLabel: { ar: 'ابدأ استخدام جرعة', en: 'Start using Jur’ah', placeholder: true },

  // ---------------------------------------------------------------------------------------------
  // A3 — profile / account (patient)
  // ---------------------------------------------------------------------------------------------
  profileRoleLabel: { ar: 'مريض', en: 'Patient', placeholder: true },
  // CR-001/CR-026: no Civil ID row. The identity line names the (simulated) verification instead.
  identityLineLabel: { ar: 'الهوية', en: 'Identity', placeholder: true },
  identityLineValue: {
    ar: 'تم الدخول عبر هويتي (محاكاة)',
    en: 'Signed in with Hawiati (simulated)',
    placeholder: true,
  },
  phoneLabel: { ar: 'رقم التواصل', en: 'Contact phone', placeholder: true },
  phonePlaceholder: { ar: 'اختياري', en: 'Optional', placeholder: true },
  phoneSaveLabel: { ar: 'حفظ', en: 'Save', placeholder: true },
  languageLabel: { ar: 'اللغة', en: 'Language', placeholder: true },
  languageAr: { ar: 'العربية', en: 'Arabic', placeholder: true },
  languageEn: { ar: 'الإنجليزية', en: 'English', placeholder: true },
  browserNotifLabel: { ar: 'إشعارات المتصفح', en: 'Browser notifications', placeholder: true },
  pushOn: { ar: 'مفعّلة', en: 'On', placeholder: true },
  pushOff: { ar: 'متوقفة', en: 'Off', placeholder: true },
  pushBlocked: { ar: 'محظورة من المتصفح', en: 'Blocked by the browser', placeholder: true },
  chatLabel: { ar: 'محادثة تيليجرام', en: 'Telegram chat', placeholder: true },
  chatConnected: { ar: 'مربوطة', en: 'Connected', placeholder: true },
  chatNotConnected: { ar: 'غير مربوطة', en: 'Not connected', placeholder: true },
  caregiverCountLabel: { ar: 'مقدّمو الرعاية', en: 'Caregivers', placeholder: true },
  caregiverCountTemplate: { ar: 'عدد المرتبطين: {count}', en: '{count} linked', placeholder: true },
} satisfies Record<string, CopyEntry>;

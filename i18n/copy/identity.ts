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
    ar: 'محاكاة لتدفق الهوية الوطنية · ليس ربطًا حقيقيًا',
    en: 'A simulation of the national identity flow — not a real connection',
    placeholder: true,
  },
  signInTitle: { ar: 'أدويتك في مكان واحد', en: 'All your medicines in one place', placeholder: true },
  signInBody: {
    ar: 'أدخل الرقم المدني للدخول. بعدها يوصلك طلب موافقة على تطبيق هويّاتي.',
    en: 'Enter your Civil ID to sign in. You will then get an approval request in the Hawiati app.',
    placeholder: true,
  },
  civilIdLabel: { ar: 'الرقم المدني', en: 'Civil ID', placeholder: true },
  civilIdHelper: { ar: 'أرقام تجريبية فقط في هذه النسخة', en: 'Demo numbers only in this version', placeholder: true },
  continueLabel: { ar: 'متابعة', en: 'Continue', placeholder: true },
  backToLanding: { ar: 'رجوع للصفحة الرئيسية', en: 'Back to the home page', placeholder: true },
  invalidIdError: {
    ar: 'هذا الرقم غير موجود في القائمة التجريبية لهذه النسخة',
    en: 'This number is not in the demo list for this version',
    placeholder: true,
  },
  invalidIdHint: {
    ar: 'المكتوب ما يُمحى — صحّح رقمًا واحدًا وتابع.',
    en: 'What you typed stays — correct one digit and continue.',
    placeholder: true,
  },
  countdownLabel: { ar: 'افتح تطبيق هويّاتي ووافق', en: 'Open the Hawiati app and approve', placeholder: true },
  cancelLabel: { ar: 'إلغاء', en: 'Cancel', placeholder: true },
  // The `no_claims` message — IDENTICAL whether the Civil ID has an account or not (rule 6 / G9).
  noClaimsTitle: { ar: 'ما فيه ملف مربوط بهذا الرقم', en: 'No record is linked to this number', placeholder: true },
  noClaimsBody: {
    ar: 'ما نقدر نقول إذا الرقم مسجّل عندنا أو لا — الرسالة نفسها في الحالتين.',
    en: 'We cannot say whether this number is registered with us or not — the message is the same either way.',
    placeholder: true,
  },
  noClaimsCardTitle: { ar: 'ما حد ربطك بملفه', en: 'Nobody has linked you to their record', placeholder: true },
  noClaimsCardBody: {
    ar: 'إذا كنت تعتني بأحد، اطلب منه يدعوك من التطبيق — «المزيد ← مقدّمو الرعاية».',
    en: 'If you care for someone, ask them to invite you from the app — “More → Caregivers”.',
    placeholder: true,
  },

  // ---------------------------------------------------------------------------------------------
  // A1b — role chooser
  // ---------------------------------------------------------------------------------------------
  roleChooserTitle: { ar: 'تبي تفتح أي ملف؟', en: 'Which record do you want to open?', placeholder: true },
  roleChooserBody: {
    ar: 'رقمك المدني مربوط بملفين. تقدر تبدّل بينهما بعدين بدون تسجيل خروج.',
    en: 'Your Civil ID is linked to two records. You can switch between them later without signing out.',
    placeholder: true,
  },
  roleChooserOwnTitle: { ar: 'أدويتي', en: 'My medicines', placeholder: true },
  roleChooserOwnButton: { ar: 'افتح ملفي', en: 'Open my record', placeholder: true },
  roleChooserCaregiverTitleTemplate: { ar: 'أدوية {name}', en: '{name}’s medicines', placeholder: true },
  roleChooserCaregiverButtonTemplate: { ar: 'افتح ملف {name}', en: 'Open {name}’s record', placeholder: true },
  roleChooserRememberNote: {
    ar: 'آخر اختيار يصير الافتراضي في المرة القادمة.',
    en: 'Your last choice becomes the default next time.',
    placeholder: true,
  },

  // ---------------------------------------------------------------------------------------------
  // A2 — first-run setup (four steps)
  // ---------------------------------------------------------------------------------------------
  setupProgressLabel: { ar: 'خطوات الإعداد الأول', en: 'First-run setup progress', placeholder: true },
  setupStepLanguage: { ar: 'اللغة', en: 'Language', placeholder: true },
  setupStepNotifications: { ar: 'التذكير', en: 'Reminders', placeholder: true },
  setupStepInvite: { ar: 'مقدّم الرعاية', en: 'Caregiver', placeholder: true },
  setupStepClosing: { ar: 'الجاهزية', en: 'Ready', placeholder: true },

  languageStepTitle: { ar: 'أي لغة تحب تستخدم؟', en: 'Which language would you like to use?', placeholder: true },
  languageStepBody: {
    ar: 'تقدر تغيّرها بعدين من شريط التطبيق في أي وقت.',
    en: 'You can change it later from the app bar at any time.',
    placeholder: true,
  },
  languageFieldLabel: { ar: 'اللغة', en: 'Language', placeholder: true },
  languageOptionAr: { ar: 'العربية', en: 'العربية', placeholder: true },
  languageOptionEn: { ar: 'English', en: 'English', placeholder: true },

  notificationsStepTitle: { ar: 'كيف تحب نذكّرك؟', en: 'How would you like us to remind you?', placeholder: true },
  notificationsStepBody: {
    ar: 'كل شي ثاني في جرعة يشتغل بدون هذي الخطوة. تقدر تغيّرها في أي وقت من الإعدادات.',
    en: 'Everything else in Jur’ah works without this step. You can change it anytime from settings.',
    placeholder: true,
  },
  browserOfferTitle: { ar: 'إشعارات المتصفح', en: 'Browser notifications', placeholder: true },
  browserOfferBody: {
    ar: 'تنبيهات فقط، وبدون تطبيق ثاني. تفتح لك الشاشة — ما تسجّل جرعة.',
    en: 'Alerts only, no extra app needed. It opens the screen — it never records a dose.',
    placeholder: true,
  },
  browserOfferButton: { ar: 'فعّل إشعارات المتصفح', en: 'Turn on browser notifications', placeholder: true },
  telegramOfferTitle: { ar: 'محادثة تيليقرام', en: 'Telegram chat', placeholder: true },
  telegramOfferBody: {
    ar: 'تضيف سؤالًا يوميًا عن جرعاتك، وترد عليه بالمحادثة. هذي الطريقة الوحيدة اللي تسجّل التزامك.',
    en: 'Adds a daily question about your doses, answered in the chat. This is the only way that records your adherence.',
    placeholder: true,
  },
  telegramOfferButton: { ar: 'اربط تيليقرام', en: 'Connect Telegram', placeholder: true },
  laterOfferTitle: { ar: 'بعدين', en: 'Later', placeholder: true },
  laterOfferBody: {
    ar: 'تكمل بدون تذكير. جدولك وفحص التعارضات يشتغلون عادي.',
    en: 'Continue without reminders. Your schedule and interaction screening keep working normally.',
    placeholder: true,
  },
  laterOfferButton: { ar: 'بعدين', en: 'Later', placeholder: true },
  equalWeightNote: {
    ar: '«بعدين» خيار عادي بنفس الحجم والوزن — مو رابط صغير.',
    en: '“Later” is an ordinary choice, the same size and weight — not a small link.',
    placeholder: true,
  },

  inviteStepTitle: { ar: 'ودّك تدعو مقدّم رعاية؟', en: 'Want to invite a caregiver?', placeholder: true },
  inviteStepBody: {
    ar: 'اختياري تمامًا. تقدر تسويها الحين أو بعدين من «المزيد ← مقدّمو الرعاية».',
    en: 'Completely optional. You can do this now or later from “More → Caregivers”.',
    placeholder: true,
  },
  // Wired at the wave-1 gate (lead): the step mounts bundle h's InviteSheet from
  // `@/features/caregiving` — the same two-step flow F1 uses, never a second implementation.
  inviteOpenLabel: { ar: 'دعوة مقدّم رعاية', en: 'Invite a caregiver', placeholder: true },
  skipInviteLabel: { ar: 'تخطي الآن', en: 'Skip for now', placeholder: true },

  closingStepTitle: { ar: 'جاهز!', en: 'All set!', placeholder: true },
  closingStepBody: {
    ar: 'جدولك جاهز، وفحص التعارضات شغّال من الحين. تقدر تغيّر أي شي من الإعدادات وقت ما تحب.',
    en: 'Your schedule is ready, and interaction screening is already running. You can change anything from settings whenever you like.',
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
    ar: 'تم الدخول عبر هويّاتي (محاكاة)',
    en: 'Signed in via Hawiati (simulated)',
    placeholder: true,
  },
  phoneLabel: { ar: 'رقم التواصل', en: 'Contact phone', placeholder: true },
  phonePlaceholder: { ar: 'اختياري', en: 'Optional', placeholder: true },
  phoneSaveLabel: { ar: 'حفظ', en: 'Save', placeholder: true },
  languageLabel: { ar: 'اللغة', en: 'Language', placeholder: true },
  languageAr: { ar: 'العربية', en: 'العربية', placeholder: true },
  languageEn: { ar: 'English', en: 'English', placeholder: true },
  browserNotifLabel: { ar: 'إشعارات المتصفح', en: 'Browser notifications', placeholder: true },
  pushOn: { ar: 'مفعّلة', en: 'On', placeholder: true },
  pushOff: { ar: 'متوقفة', en: 'Off', placeholder: true },
  pushBlocked: { ar: 'محظورة من المتصفح', en: 'Blocked by the browser', placeholder: true },
  chatLabel: { ar: 'محادثة تيليقرام', en: 'Telegram chat', placeholder: true },
  chatConnected: { ar: 'مربوطة', en: 'Connected', placeholder: true },
  chatNotConnected: { ar: 'غير مربوطة', en: 'Not connected', placeholder: true },
  caregiverCountLabel: { ar: 'مقدّمو الرعاية', en: 'Caregivers', placeholder: true },
  caregiverCountTemplate: { ar: '{count} مربوط', en: '{count} linked', placeholder: true },
} satisfies Record<string, CopyEntry>;

/**
 * Copy catalogue, landing group (WP4a). Owned by bundle (a); the lead created the stub and
 * registered it in i18n/index.ts so parallel bundles never touch a shared file (D-003).
 *
 * Every entry here is `placeholder: true` — the owner's bilingual copy deck (Acceptance Criteria
 * and Test Plan.md, "Still Required From the Project Owner") has not replaced L1's wording yet.
 * The Arabic text mirrors the approved boards (`docs/wireframes/Landing.dc.html`,
 * `Landing1440.dc.html`) verbatim where the board carries real copy; the English is this bundle's
 * own draft translation, not yet reviewed. No statistic, testimonial, award or third-party mark is
 * introduced anywhere in this file (G11).
 */
import type { CopyEntry } from './shell';

export const landing = {
  // Repeated call to action (sections 1 · 2 · 10) — one action, shown at three scroll positions of
  // one long page, per the approved boards. `ctaContinue` is the signed-in variant (WHAT TO BUILD).
  ctaSignIn: { ar: 'الدخول عن طريق هويّاتي', en: 'Sign in with Hawiati', placeholder: true },
  ctaContinue: { ar: 'المتابعة إلى حسابك', en: 'Continue to your account', placeholder: true },

  // (2) Hero
  heroHeadline: {
    ar: 'أدويتك كلها في مكان واحد — ومفحوصة',
    en: 'All your medicines, in one place — and checked',
    placeholder: true,
  },
  heroSupportingLine: {
    ar: 'وصفاتك من المستشفى الحكومي والعيادة الخاصة في سجل واحد، مع جدول جرعات يومي وفحص تعارضات مستمر على ملفك كامل.',
    en: 'Your prescriptions from public hospitals and private clinics, in one record, with a daily dose schedule and continuous interaction screening across your whole file.',
    placeholder: true,
  },
  heroSeeHowItWorks: { ar: 'شوف كيف تشتغل', en: 'See how it works', placeholder: true },
  heroMockupCaption: {
    ar: 'صورة من شاشة «اليوم» داخل التطبيق',
    en: 'A preview of the “Today” screen inside the app',
    placeholder: true,
  },
  heroMockupAlt: {
    ar: 'رسم تخطيطي لشاشة اليوم: جرعات الأدوية مجمّعة حسب وقت اليوم، كل صف يعرض اسم الدواء ومقدار الجرعة، ونجمة الحالة تظهر فقط عندما تكون متابعة الجرعات مفعّلة. صورة توضيحية عامة، بدون بيانات مريض حقيقية.',
    en: 'Schematic preview of the Today screen: medication doses grouped by time of day, each row showing a drug name and dose amount, with a status pill appearing only when dose tracking is on. A generic illustration — no real patient data.',
    placeholder: true,
  },

  // (3) The problem, in two parts
  problemHeading: { ar: 'وين تنكسر السالفة اليوم', en: 'Where things break down today', placeholder: true },
  problemInstructionsTitle: {
    ar: 'تعليمات تضيع بعد العيادة',
    en: 'Instructions get lost after the clinic visit',
    placeholder: true,
  },
  problemInstructionsBody: {
    ar: 'المريض يطلع وهو مو متأكد: الجرعة، عدد المرات، المدة، ولا «يوم بعد يوم» تعني شنو بالضبط.',
    en: 'A patient leaves unsure of the dose, how many times a day, for how long, or what “every other day” actually means.',
    placeholder: true,
  },
  problemRecordsTitle: { ar: 'سجلات مفرّقة', en: 'Fragmented records', placeholder: true },
  problemRecordsBody: {
    ar: 'كل مستشفى وعيادة على نظامه، فأحد ما يشوف قائمة أدويتك كاملة — ولا حتى الطبيب اللي يكتب لك الوصفة الجديدة.',
    en: 'Every hospital and clinic runs its own system, so no one sees your full medicine list — not even the doctor writing your next prescription.',
    placeholder: true,
  },

  // (4) The solution, in three steps
  solutionHeading: { ar: 'كيف تشتغل — ثلاث خطوات', en: 'How it works — three steps', placeholder: true },
  solutionStep1Title: { ar: '١ · تدخل بهويّاتي', en: '1 · Sign in with Hawiati', placeholder: true },
  solutionStep1Body: {
    ar: 'رقم مدني واحد، وموافقة من تطبيق الهوية.',
    en: 'One Civil ID, and an approval from the identity app.',
    placeholder: true,
  },
  solutionStep2Title: { ar: '٢ · تضيف وصفاتك', en: '2 · Add your prescriptions', placeholder: true },
  solutionStep2Body: {
    ar: 'صورة للوصفة، والنظام يقراها ويبني الجدول.',
    en: 'A photo of the prescription — the system reads it and builds your schedule.',
    placeholder: true,
  },
  solutionStep3Title: { ar: '٣ · يفحصها لك', en: '3 · It screens them for you', placeholder: true },
  solutionStep3Body: {
    ar: 'كل دواء جديد يُقاس على ملفك كامل، وأي خطر يوقف عند مراجع بشري.',
    en: 'Every new medicine is checked against your whole file, and any danger stops at a human reviewer.',
    placeholder: true,
  },

  // (5) Six feature cards
  featuresHeading: { ar: 'شنو تحصل داخل جرعة', en: 'What you get inside Jur’ah', placeholder: true },
  feature1Title: { ar: 'سجل دوائي موحّد', en: 'One unified medicine record', placeholder: true },
  feature1Body: { ar: 'حكومي وخاص في مكان واحد.', en: 'Public and private prescriptions, in one place.', placeholder: true },
  feature2Title: { ar: 'جدول يومك', en: 'Your day’s schedule', placeholder: true },
  feature2Body: { ar: 'جرعات مرتبة بالوقت، قراءة فقط.', en: 'Doses ordered by time, read-only.', placeholder: true },
  feature3Title: { ar: 'فحص تعارضات', en: 'Interaction screening', placeholder: true },
  feature3Body: {
    ar: 'على الملف كامل، مع المصدر الطبي مكتوب.',
    en: 'Across your whole file, with the medical source stated.',
    placeholder: true,
  },
  feature4Title: { ar: 'تجديد الوصفات', en: 'Refill requests', placeholder: true },
  feature4Body: { ar: 'يُوجّه لصيدلية القطاع نفسه.', en: 'Routed to a pharmacy in the same sector.', placeholder: true },
  feature5Title: { ar: 'فحص دواء بالصورة', en: 'Photo drug check', placeholder: true },
  feature5Body: { ar: 'مفيد بالسفر تحديدًا.', en: 'Especially useful while travelling.', placeholder: true },
  feature6Title: { ar: 'مزامنة التقويم', en: 'Calendar sync', placeholder: true },
  feature6Body: {
    ar: 'جدولك يظهر في تقويمك، باتجاه واحد.',
    en: 'Your schedule appears in your own calendar, one direction only.',
    placeholder: true,
  },

  // (6) Adherence follow-up — marked optional, G10
  adherenceBadge: { ar: 'اختياري', en: 'Optional', placeholder: true },
  adherenceHeading: { ar: 'متابعة الجرعات اليومية', en: 'Daily dose follow-up', placeholder: true },
  adherenceBody: {
    ar: 'لو حبيت، يوصلك سؤال يومي على المحادثة وترد عليه هناك. كل اللي فوق يشتغل بدونها — وهي مطفّية افتراضيًا.',
    en: 'If you want it, a daily question reaches you on chat and you answer it there. Everything above works without it — and it is off by default.',
    placeholder: true,
  },

  // (7) Who it's for
  audienceHeading: { ar: 'لمين هذا التطبيق', en: 'Who this is for', placeholder: true },
  audiencePatientTitle: { ar: 'للمريض', en: 'For the patient', placeholder: true },
  audiencePatientBody: {
    ar: 'تدخل برقمك المدني، وتشوف أدويتك وجدولك وتنبيهات السلامة.',
    en: 'You sign in with your Civil ID, and see your medicines, your schedule and your safety alerts.',
    placeholder: true,
  },
  audiencePatientCta: { ar: 'دخول المريض', en: 'Patient sign-in', placeholder: true },
  audienceCaregiverTitle: { ar: 'لمن يعتني بمريض', en: 'For a family caregiver', placeholder: true },
  audienceCaregiverBody: {
    ar: 'تدخل برقمك المدني بعد ما يدعوك المريض وتقبل الدعوة. قراءة فقط، وما تقدر تسجّل جرعة ولا تعدّل وصفة.',
    en: 'You sign in with the same Civil ID after the patient invites you and you accept. Read-only — you cannot record a dose or change a prescription.',
    placeholder: true,
  },
  audienceCaregiverCta: { ar: 'دخول مقدّم الرعاية', en: 'Caregiver sign-in', placeholder: true },
  // Names the reviewer path without linking it (pass criteria: the clinic route is never linked or named).
  audienceReviewerNote: {
    ar: 'المراجعون الطبيون يستخدمون عنوانًا منفصلًا.',
    en: 'Clinical reviewers use a separate address.',
    placeholder: true,
  },

  // (8) Safety and privacy
  safetyHeading: { ar: 'السلامة والخصوصية', en: 'Safety and privacy', placeholder: true },
  safety1Title: { ar: 'التطبيق لا يسجّل جرعة من نفسه', en: 'The app never records a dose by itself', placeholder: true },
  safety1Body: {
    ar: 'ولا زر ولا إشعار يقدر يعلّم جرعة كمأخوذة. التسجيل يصير بمسار واحد متحقق فقط.',
    en: 'No button and no notification can mark a dose as taken. Recording happens through one verified path only.',
    placeholder: true,
  },
  safety2Title: { ar: 'الخطر يوقف عند إنسان', en: 'A danger finding stops at a human', placeholder: true },
  safety2Body: {
    ar: 'أي تعارض خطير يمر على طبيب أو صيدلي قبل ما يوصلك كنتيجة نهائية.',
    en: 'A serious interaction goes through a doctor or pharmacist before it reaches you as a final result.',
    placeholder: true,
  },
  safety3Title: { ar: 'الفحص من بيانات منشورة', en: 'Screening is grounded in published data', placeholder: true },
  safety3Body: {
    ar: 'كل نتيجة معها السجل الدوائي اللي طُوبقت عليه.',
    en: 'Every finding carries the published drug record it was checked against.',
    placeholder: true,
  },

  // (9) Academic transparency
  transparencyHeading: { ar: 'شفافية أكاديمية', en: 'Academic transparency', placeholder: true },
  transparencyBody: {
    ar: 'هذا نموذج أولي لمشروع تخرج. تدفق الهوية محاكى وليس ربطًا حقيقيًا بهويّاتي، والبيانات المعروضة تجريبية وليست لأشخاص حقيقيين.',
    en: 'This is a graduation-project prototype. The identity flow is simulated, not a real Hawiati integration, and the data shown is synthetic — not real people.',
    placeholder: true,
  },

  // (10) Closing call to action and footer
  closingHeading: { ar: 'جاهز تبدأ؟', en: 'Ready to start?', placeholder: true },
  footerLine: {
    ar: 'جرعة · مشروع تخرج — SACGC AI for Coding · الكويت',
    en: 'Jur’ah · a graduation project — SACGC AI for Coding · Kuwait',
    placeholder: true,
  },
} as const satisfies Record<string, CopyEntry>;

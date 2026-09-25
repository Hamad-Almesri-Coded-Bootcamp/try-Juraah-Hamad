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
  ctaSignIn: { ar: 'الدخول عن طريق هويتي', en: 'Sign in with Hawiati', placeholder: true },
  ctaContinue: { ar: 'المتابعة إلى حسابك', en: 'Continue to your account', placeholder: true },
  // The header's short label for the same action (V2Landing). The button's accessible name stays the
  // full `ctaSignIn` / `ctaContinue`, which begins with these words (WCAG 2.5.3, label in name).
  ctaSignInShort: { ar: 'الدخول', en: 'Sign in', placeholder: true },
  ctaContinueShort: { ar: 'المتابعة', en: 'Continue', placeholder: true },

  // (2) Hero
  heroHeadline: {
    ar: 'أدويتك كلها في مكان واحد، ومفحوصة معًا',
    en: 'All your medicines in one place, and checked together',
    placeholder: true,
  },
  heroSupportingLine: {
    ar: 'وصفاتك من المستشفيات الحكومية والعيادات الخاصة في سجل واحد، مع جدول يومي لجرعاتك وفحص للتعارضات بين أدويتك كلها.',
    en: 'Your prescriptions from public hospitals and private clinics, together in one record, with a daily dose schedule and interaction checks across all your medicines.',
    placeholder: true,
  },
  heroSeeHowItWorks: { ar: 'اعرف كيف يعمل التطبيق', en: 'See how it works', placeholder: true },
  // The hero picture: the real day dial, drawn with حمد's seed day at REFERENCE_NOW (CR-071).
  heroDialCaption: {
    ar: 'مثال ليوم من الجرعات',
    en: 'An example day of doses',
    placeholder: true,
  },
  // {times}: the day's dose times; {drug}: the next dose; {next}: its time.
  heroDialDescriptionTemplate: {
    ar: 'مثال ليوم فيه جرعات في الساعة {times}. الجرعة القادمة {drug} في الساعة {next}.',
    en: 'An example day with doses at {times}. The next dose is {drug} at {next}.',
    placeholder: true,
  },

  // (3) The problem, in two parts
  problemHeading: { ar: 'أين تتعثر الأمور اليوم', en: 'Where things go wrong today', placeholder: true },
  problemInstructionsTitle: {
    ar: 'تعليمات تضيع بعد العيادة',
    en: 'Instructions get lost after the clinic visit',
    placeholder: true,
  },
  problemInstructionsBody: {
    ar: 'يغادر المريض العيادة وهو غير متأكد من الجرعة أو عدد المرات أو المدة، أو من معنى «يومًا بعد يوم» بالضبط.',
    en: 'A patient leaves unsure of the dose, how often to take it, for how long, or what “every other day” really means.',
    placeholder: true,
  },
  problemRecordsTitle: { ar: 'سجلات متفرّقة', en: 'Scattered records', placeholder: true },
  problemRecordsBody: {
    ar: 'لكل مستشفى وعيادة نظامه الخاص، فلا أحد يرى قائمة أدويتك كاملة، ولا حتى الطبيب الذي يكتب وصفتك التالية.',
    en: 'Every hospital and clinic has its own system, so nobody sees your full list of medicines. Not even the doctor writing your next prescription.',
    placeholder: true,
  },

  // The bridge: rx-001 and rx-002, one patient's two prescriptions from two systems (the reason
  // Jur'ah exists; ia-001 is the finding they produce). Drawn without the danger colour: it is an
  // illustration, not a finding (L1 bounded exception).
  problemBridgeLabel: {
    ar: 'وصفتان لمريض واحد من نظامين لا يرى أحدهما الآخر',
    en: 'Two prescriptions for one patient, from two systems that never see each other',
    placeholder: true,
  },
  // The two facilities of the bridge, as the seed names them (rx-001, rx-002); English as in CR-071.
  problemBridgePublicFacility: { ar: 'مستشفى الفروانية', en: 'Farwaniya Hospital', placeholder: true },
  problemBridgePrivateFacility: { ar: 'عيادة النخبة الطبية', en: 'Al-Nukhba Medical Clinic', placeholder: true },
  problemBridgeAnswer: {
    ar: 'في جرعة تجتمع الوصفتان في سجل واحد وتُفحصان معًا، وأي تعارض خطير يراجعه مختص قبل أن يصلك.',
    en: 'In Jur’ah both sit in one record and are checked together, and a medical reviewer looks at any serious interaction before it reaches you.',
    placeholder: true,
  },

  // (4) The solution, in three steps
  solutionHeading: { ar: 'كيف يعمل التطبيق', en: 'How it works', placeholder: true },
  // The step number is drawn in its own disc, in the reader's digits (formatNumber).
  solutionStep1Title: { ar: 'ادخل عبر هويتي', en: 'Sign in with Hawiati', placeholder: true },
  solutionStep1Body: {
    ar: 'رقمك المدني، ثم الموافقة من تطبيق هويتي.',
    en: 'Your Civil ID, then an approval in the Hawiati app.',
    placeholder: true,
  },
  solutionStep2Title: { ar: 'أضف وصفاتك', en: 'Add your prescriptions', placeholder: true },
  solutionStep2Body: {
    ar: 'التقط صورة للوصفة، فيقرؤها التطبيق ويبني جدولك.',
    en: 'Take a photo of the prescription. The app reads it and builds your schedule.',
    placeholder: true,
  },
  solutionStep3Title: { ar: 'يفحصها لك', en: 'It checks them for you', placeholder: true },
  solutionStep3Body: {
    ar: 'يُفحص كل دواء جديد مع كل ما تتناوله من أدوية، ويراجع مختص طبي أي تعارض خطير قبل أن تصبح النتيجة نهائية.',
    en: 'Every new medicine is checked against everything you already take, and a medical reviewer looks at any serious interaction before the result is final.',
    placeholder: true,
  },

  // (5) Six features, a two-column list with icons (CR-069(f): no card wall)
  featuresHeading: { ar: 'ماذا تجد في جرعة', en: 'What you get with Jur’ah', placeholder: true },
  feature1Title: { ar: 'سجل واحد لكل أدويتك', en: 'One record for all your medicines', placeholder: true },
  feature1Body: { ar: 'وصفات القطاع العام والقطاع الخاص معًا.', en: 'Public and private sector prescriptions, side by side.', placeholder: true },
  feature2Title: { ar: 'جدول يومك', en: 'Your daily schedule', placeholder: true },
  feature2Body: { ar: 'جرعاتك مرتبة حسب الوقت، كخطة واضحة ليومك.', en: 'Your doses in time order, as a clear plan for the day.', placeholder: true },
  feature3Title: { ar: 'فحص التعارضات', en: 'Interaction checks', placeholder: true },
  feature3Body: {
    ar: 'بين أدويتك كلها، مع ذكر المصدر الطبي.',
    en: 'Across all your medicines, with the medical source named.',
    placeholder: true,
  },
  feature4Title: { ar: 'تجديد الوصفات', en: 'Prescription refills', placeholder: true },
  feature4Body: { ar: 'يُرسَل طلبك إلى صيدلية من قطاع الوصفة نفسه.', en: 'Your request goes to a pharmacy in the same sector as the prescription.', placeholder: true },
  feature5Title: { ar: 'فحص دواء بالصورة', en: 'Check a medicine by photo', placeholder: true },
  feature5Body: { ar: 'مفيد خاصةً عند السفر.', en: 'Especially handy when you travel.', placeholder: true },
  feature6Title: { ar: 'مزامنة التقويم', en: 'Calendar sync', placeholder: true },
  feature6Body: {
    ar: 'يظهر جدولك في تقويمك الخاص، ولا يستطيع التقويم تغيير أي شيء في التطبيق.',
    en: 'Your schedule shows up in your own calendar, and the calendar can’t change anything in the app.',
    placeholder: true,
  },

  // (6) Adherence follow-up — marked optional, G10
  adherenceBadge: { ar: 'اختياري', en: 'Optional', placeholder: true },
  adherenceHeading: { ar: 'متابعة الجرعات اليومية', en: 'Daily dose check-ins', placeholder: true },
  adherenceBody: {
    ar: 'إن أردت، يصلك سؤال يومي قصير في محادثة، وتجيب عنه هناك لتتابع الجرعات التي تأخذها. تبقى هذه المتابعة متوقفة حتى تفعّلها، ويعمل كل ما سبق دونها.',
    en: 'If you’d like, you can get a short daily question in a chat and answer it there, to keep track of the doses you take. It stays off until you turn it on, and everything above works without it.',
    placeholder: true,
  },

  // (7) Who it's for
  audienceHeading: { ar: 'لمن هذا التطبيق', en: 'Who it’s for', placeholder: true },
  audiencePatientTitle: { ar: 'للمريض', en: 'For patients', placeholder: true },
  audiencePatientBody: {
    ar: 'ادخل برقمك المدني، واطّلع على أدويتك وجدولك وتنبيهات السلامة.',
    en: 'Sign in with your Civil ID to see your medicines, your schedule and your safety alerts.',
    placeholder: true,
  },
  audiencePatientCta: { ar: 'دخول المريض', en: 'Patient sign-in', placeholder: true },
  audienceCaregiverTitle: { ar: 'لمقدّم الرعاية من العائلة', en: 'For family caregivers', placeholder: true },
  audienceCaregiverBody: {
    ar: 'بعد أن يدعوك المريض وتقبل الدعوة، ادخل برقمك المدني. يمكنك الاطلاع على أدويته، لكن لا يمكنك تسجيل جرعة أو تعديل وصفة.',
    en: 'Once the patient invites you and you accept, sign in with your own Civil ID. You can see their medicines, but you can’t record a dose or change a prescription.',
    placeholder: true,
  },
  audienceCaregiverCta: { ar: 'دخول مقدّم الرعاية', en: 'Caregiver sign-in', placeholder: true },
  // Names the reviewer path without linking it (pass criteria: the clinic route is never linked or named).
  audienceReviewerNote: {
    ar: 'يدخل المراجعون الطبيون من عنوان منفصل.',
    en: 'Medical reviewers sign in at a separate address.',
    placeholder: true,
  },

  // (8) Safety and privacy
  safetyHeading: { ar: 'السلامة والخصوصية', en: 'Safety and privacy', placeholder: true },
  safety1Title: { ar: 'لا يسجّل التطبيق أي جرعة من تلقاء نفسه', en: 'The app never records a dose on its own', placeholder: true },
  safety1Body: {
    ar: 'لا يوجد زر ولا إشعار يمكنه تعليم جرعة بأنها أُخذت. تُسجَّل الجرعة فقط حين تجيب أنت عن السؤال اليومي في محادثتك.',
    en: 'No button or notification can mark a dose as taken. A dose is recorded only when you answer the daily question in your chat.',
    placeholder: true,
  },
  safety2Title: { ar: 'كل تعارض خطير يراجعه إنسان', en: 'A person reviews every serious interaction', placeholder: true },
  safety2Body: {
    ar: 'يمرّ أي تعارض خطير على طبيب أو صيدلي قبل أن يصلك كنتيجة نهائية.',
    en: 'A doctor or pharmacist looks at any serious interaction before it reaches you as a final answer.',
    placeholder: true,
  },
  safety3Title: { ar: 'الفحص مبني على بيانات دوائية منشورة', en: 'Checks are based on published drug data', placeholder: true },
  safety3Body: {
    ar: 'مع كل نتيجة يظهر المرجع الدوائي المنشور الذي استندت إليه.',
    en: 'Every finding shows the published drug reference it’s based on.',
    placeholder: true,
  },

  // (9) Transparency: the simulated sign-in, disclosed on the page itself (G11; CR-107)
  transparencyHeading: { ar: 'عن تسجيل الدخول', en: 'About signing in', placeholder: true },
  transparencyBody: {
    ar: 'تسجيل الدخول عبر هويتي محاكاة، وليس ربطًا حقيقيًا بنظام الهوية الوطنية.',
    en: 'Signing in with Hawiati is simulated. It isn’t a real connection to the national ID service.',
    placeholder: true,
  },

  // (10) Closing call to action and footer
  closingHeading: { ar: 'هل أنت مستعد للبدء؟', en: 'Ready to start?', placeholder: true },
  footerLine: {
    // The programme's name stays as written: the one Latin run CR-071 allows in Arabic here
    // (tests/e2e/language-purity.spec.ts).
    ar: 'جرعة · SACGC AI for Coding · الكويت',
    en: 'Jur’ah · SACGC AI for Coding · Kuwait',
    placeholder: true,
  },
} as const satisfies Record<string, CopyEntry>;

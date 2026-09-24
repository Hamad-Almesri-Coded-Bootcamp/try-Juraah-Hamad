/**
 * Copy catalogue, assistant group (CR-067) — the web-app assistant's chrome. The assistant's
 * ANSWERS are data from the agents track (agents/lib/webchat.js), shown as received, the way the
 * Activity screen shows an audit message; everything the app itself says lives here.
 * `placeholder: true`: the owner's bilingual deck has not reviewed these yet.
 */
import type { CopyEntry } from './shell';

export const assistant = {
  launcherLabel: { ar: 'المساعد', en: 'Assistant', placeholder: true },
  title: { ar: 'مساعد جرعة', en: 'Jur’ah assistant', placeholder: true },
  closeLabel: { ar: 'إغلاق المساعد', en: 'Close the assistant', placeholder: true },
  intro: {
    ar: 'مرحبًا! يمكنني الإجابة عن أسئلتك حول جرعاتك وتنبيهات السلامة في ملفك. لا أسجّل الجرعات، ولا أقدّم استشارة طبية.',
    en: 'Hi! I can answer questions about your doses and the safety alerts in your file. I don’t record doses or give medical advice.',
    placeholder: true,
  },
  inputLabel: { ar: 'رسالتك', en: 'Your message', placeholder: true },
  inputPlaceholder: { ar: 'اكتب سؤالك…', en: 'Type your question…', placeholder: true },
  send: { ar: 'إرسال', en: 'Send', placeholder: true },
  suggestionsLabel: { ar: 'أسئلة مقترحة', en: 'Suggested questions', placeholder: true },
  suggestNext: { ar: 'متى الجرعة القادمة؟', en: 'What is my next dose?', placeholder: true },
  suggestAmount: { ar: 'كم آخذ؟', en: 'How much do I take?', placeholder: true },
  suggestToday: { ar: 'ماذا في جدول أدويتي اليوم؟', en: 'What are my medicines today?', placeholder: true },
  suggestSafety: { ar: 'هل يوجد تعارض بين أدويتي؟', en: 'Do my medicines interact?', placeholder: true },
  youLabel: { ar: 'أنت', en: 'You', placeholder: true },
  assistantLabel: { ar: 'المساعد', en: 'Assistant', placeholder: true },
  telegramPrompted: {
    ar: 'أرسلنا الأزرار إلى محادثتك في تيليجرام.',
    en: 'We’ve sent the buttons to your Telegram chat.',
    placeholder: true,
  },
  unavailable: {
    ar: 'المساعد غير متاح الآن. جدولك في صفحة «اليوم» محدّث دائمًا.',
    en: 'The assistant isn’t available right now. Your schedule on the Today page is always up to date.',
    placeholder: true,
  },
  invalid: { ar: 'اكتب سؤالك في ٥٠٠ حرف أو أقل.', en: 'Please keep your question to 500 characters or fewer.', placeholder: true },
  thinking: { ar: 'المساعد يكتب…', en: 'The assistant is typing…', placeholder: true },

  // Moving to the screen an answer is about, then checking it was the right one (CR-067).
  movedToday: { ar: 'فتحتُ لك صفحة «اليوم». هل هذا ما تبحث عنه؟', en: 'I’ve opened the Today page for you. Is this what you were looking for?', placeholder: true },
  movedActivity: { ar: 'فتحتُ لك صفحة «سجل الأحداث». هل هذا ما تبحث عنه؟', en: 'I’ve opened the Activity page for you. Is this what you were looking for?', placeholder: true },
  movedSafety: { ar: 'فتحتُ لك صفحة «السلامة». هل هذا ما تبحث عنه؟', en: 'I’ve opened the Safety page for you. Is this what you were looking for?', placeholder: true },
  movedNotifications: { ar: 'فتحتُ لك صفحة «الإشعارات والرسائل». هل هذا ما تبحث عنه؟', en: 'I’ve opened the Notifications and messages page for you. Is this what you were looking for?', placeholder: true },
  movedRefill: { ar: 'فتحتُ لك صفحة «تجديد الوصفات». هل هذا ما تبحث عنه؟', en: 'I’ve opened the Refills page for you. Is this what you were looking for?', placeholder: true },
  movedHelp: { ar: 'فتحتُ لك صفحة «المساعدة». هل هذا ما تبحث عنه؟', en: 'I’ve opened the Help page for you. Is this what you were looking for?', placeholder: true },
  movedSignin: { ar: 'فتحتُ لك صفحة «تسجيل الدخول». هل هذا ما تبحث عنه؟', en: 'I’ve opened the Sign in page for you. Is this what you were looking for?', placeholder: true },
  confirmLabel: { ar: 'هل هذا ما تبحث عنه؟', en: 'Is this what you were looking for?', placeholder: true },
  confirmYes: { ar: 'نعم', en: 'Yes', placeholder: true },
  confirmNo: { ar: 'لا، ليس هذا', en: 'No, not this', placeholder: true },
  confirmThanks: { ar: 'ممتاز 👍 اسألني عن أي شيء آخر.', en: 'Great 👍 Ask me anything else.', placeholder: true },
  confirmOther: { ar: 'عذرًا! ماذا تقصد بالضبط؟', en: 'Sorry about that! Which of these did you mean?', placeholder: true },

  // Asking back when the assistant is not sure, instead of guessing.
  clarifyAsk: { ar: 'لم أفهم قصدك تمامًا 🙏 هل تقصد واحدًا من هذه؟', en: 'I’m not sure what you mean 🙏 Did you mean one of these?', placeholder: true },
  clarifyLabel: { ar: 'اختر ما تقصده', en: 'Pick what you mean', placeholder: true },
  suggestTelegram: { ar: 'كيف أربط تيليجرام؟', en: 'How do I connect Telegram?', placeholder: true },
  suggestRefill: { ar: 'كيف أطلب تجديد الوصفة؟', en: 'How do I ask for a refill?', placeholder: true },

  // CR-069 — the screen follows the voice (a turn the patient had with Alexa on the Echo).
  // The four voice chips (suggestNext, suggestAmount, suggestToday, suggestForgot) are tapped AND said.
  // A tap goes to the web assistant, whose fast path (agents/lib/webchat.js quickIntent) knows each one.
  // Said to the Echo, the English four, «كم آخذ» and «نسيت الدواء» are exact samples of
  // agents/alexa/interaction-model.*.json; the Arabic next-dose and today chips are Fusha close to them
  // (the model's own Fusha samples open with «ما», which quickIntent reads as a negation). CR-071.
  suggestForgot: { ar: 'نسيت الدواء', en: 'I forgot my medicine', placeholder: true },
  voiceAskedLaunch: { ar: 'افتح مساعد جرعة', en: 'Open medicine helper', placeholder: true },
  voiceAskedRecord: { ar: 'سجّل جرعاتي', en: 'Record my doses', placeholder: true },
  voiceSaid: { ar: '🎙️ قلتها لأليكسا', en: '🎙️ You said it to Alexa', placeholder: true },
  voiceAnswered: { ar: '🎙️ رد أليكسا', en: '🎙️ Alexa’s answer', placeholder: true },
  clarifyVoiceAsk: {
    ar: 'لم تفهم أليكسا ما قلت. قل لها إحدى هذه العبارات، أو اضغطها هنا:',
    en: 'Alexa didn’t catch that. Say one of these to her, or tap it here:',
    placeholder: true,
  },
  voiceEnded: { ar: 'انتهت المحادثة مع أليكسا.', en: 'The conversation with Alexa has ended.', placeholder: true },

  // Visitors who are not a signed-in patient (landing, sign-in, caregiver, clinic): app help only.
  guestIntro: {
    ar: 'مرحبًا! يمكنني أن أعرّفك بتطبيق جرعة وطريقة استخدامه. لتسأل عن جرعاتك، سجّل الدخول كمريض.',
    en: 'Hi! I can tell you what Jur’ah is and how to use it. To ask about your own doses, sign in as a patient.',
    placeholder: true,
  },
  guestSuggestWhat: { ar: 'ما هو تطبيق جرعة؟', en: 'What is Jur’ah?', placeholder: true },
  guestSuggestSignIn: { ar: 'كيف أسجّل الدخول؟', en: 'How do I sign in?', placeholder: true },
  guestSuggestTelegram: { ar: 'كيف أربط تيليجرام؟', en: 'How do I connect Telegram?', placeholder: true },
  guestGeneral: {
    ar: 'يجمع تطبيق جرعة كل وصفاتك من أي مستشفى أو عيادة في مكان واحد، ويفحص التعارضات بينها، ويمكنه أن يذكّرك بجرعاتك. لتسأل عن جرعاتك، سجّل الدخول كمريض.',
    en: 'Jur’ah keeps all your prescriptions from any hospital or clinic in one place, checks whether they interact, and can remind you about your doses. To ask about your own doses, sign in as a patient.',
    placeholder: true,
  },
  guestSignIn: {
    ar: 'اضغط زر الدخول، وأدخل رقمك المدني، ثم وافق على الطلب في تطبيق هويتي.',
    en: 'Tap the sign-in button, enter your Civil ID, then approve the request in the Hawiati app.',
    placeholder: true,
  },
  guestTelegram: {
    ar: 'بعد تسجيل الدخول، افتح «المزيد» ثم «الإشعارات والرسائل»، واضغط «افتح تيليجرام». اضغط «ابدأ» في المحادثة، وبعدها نستطيع مراسلتك بشأن جرعاتك.',
    en: 'After you sign in, open More, then Notifications and messages, and tap Open Telegram. Press Start in the chat, and we’ll be able to message you about your doses.',
    placeholder: true,
  },
  guestRefill: {
    ar: 'بعد تسجيل الدخول، افتح «المزيد» ثم «تجديد الوصفات»، واختر الدواء. يصل طلبك إلى الجهة التي صرفت الوصفة.',
    en: 'After you sign in, open More, then Refills, and pick the medicine. Your request goes to the place that dispensed it.',
    placeholder: true,
  },

  safetyLine: {
    ar: 'مشروع طلابي، وكل البيانات هنا تجريبية. لا يقدّم تطبيق جرعة استشارة طبية، فاتّبع دائمًا تعليمات طبيبك والصيدلي.',
    en: 'A student project. Everything here is sample data. Jur’ah doesn’t give medical advice, so always follow your doctor and pharmacist.',
    placeholder: true,
  },
} satisfies Record<string, CopyEntry>;

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
    ar: 'هلا! أقدر أجاوبك عن جرعاتك وتنبيهات السلامة في ملفك. ما أسجّل جرعات ولا أقدّم استشارة طبية.',
    en: 'Hi! I can answer about your doses and the safety alerts in your file. I don’t record doses or give medical advice.',
    placeholder: true,
  },
  inputLabel: { ar: 'رسالتك', en: 'Your message', placeholder: true },
  inputPlaceholder: { ar: 'اكتب سؤالك…', en: 'Type your question…', placeholder: true },
  send: { ar: 'إرسال', en: 'Send', placeholder: true },
  suggestionsLabel: { ar: 'أسئلة مقترحة', en: 'Suggested questions', placeholder: true },
  suggestNext: { ar: 'شنو جرعتي الجاية؟', en: 'What is my next dose?', placeholder: true },
  suggestAmount: { ar: 'كم آخذ؟', en: 'How much do I take?', placeholder: true },
  suggestToday: { ar: 'شنو أدويتي اليوم؟', en: 'What are my medicines today?', placeholder: true },
  suggestSafety: { ar: 'فيه تعارض بين أدويتي؟', en: 'Do my medicines interact?', placeholder: true },
  youLabel: { ar: 'أنت', en: 'You', placeholder: true },
  assistantLabel: { ar: 'المساعد', en: 'Assistant', placeholder: true },
  telegramPrompted: {
    ar: 'أرسلنا الأزرار لمحادثتك في تيليقرام.',
    en: 'We sent the buttons to your Telegram chat.',
    placeholder: true,
  },
  unavailable: {
    ar: 'المساعد مو متاح الحين. جدولك في «اليوم» دائماً محدّث.',
    en: 'The assistant is not available right now. Your schedule under Today is always up to date.',
    placeholder: true,
  },
  invalid: { ar: 'اكتب سؤالك بـ٥٠٠ حرف أو أقل.', en: 'Write your question in 500 characters or fewer.', placeholder: true },
  thinking: { ar: 'المساعد يكتب…', en: 'The assistant is typing…', placeholder: true },

  // Visitors who are not a signed-in patient (landing, sign-in, caregiver, clinic): app help only.
  guestIntro: {
    ar: 'هلا! أقدر أعرّفك على جرعة وكيف تستخدمه. للإجابات عن جرعاتك، سجّل دخولك كمريض.',
    en: 'Hi! I can tell you what Jur’ah is and how to use it. For answers about your own doses, sign in as a patient.',
    placeholder: true,
  },
  guestSuggestWhat: { ar: 'شنو هو جرعة؟', en: 'What is Jur’ah?', placeholder: true },
  guestSuggestSignIn: { ar: 'كيف أسجّل دخول؟', en: 'How do I sign in?', placeholder: true },
  guestSuggestTelegram: { ar: 'كيف أربط تيليقرام؟', en: 'How do I link Telegram?', placeholder: true },
  guestGeneral: {
    ar: 'جرعة يجمع كل وصفاتك من أي مستشفى أو عيادة في ملف واحد، ويفحص التعارضات بينها، ويذكّرك بجرعاتك. للإجابات عن جرعاتك سجّل دخولك كمريض.',
    en: 'Jur’ah brings all your prescriptions, from any hospital or clinic, into one file, checks them against each other, and reminds you of your doses. For answers about your own doses, sign in as a patient.',
    placeholder: true,
  },
  guestSignIn: {
    ar: 'اضغط «دخول» وأدخل رقمك المدني، ثم وافق على الطلب في تطبيق هويّاتي.',
    en: 'Press Sign in and enter your Civil ID, then approve the request in the Hawiati app.',
    placeholder: true,
  },
  guestTelegram: {
    ar: 'بعد تسجيل الدخول: «المزيد ← الإشعارات والمراسلة ← افتح تيليقرام»، ثم اضغط Start في البوت. توصلك رسالة كل صباح بجرعاتك.',
    en: 'After signing in: More → Notifications & messaging → Open Telegram, then press Start in the bot. You get your doses every morning.',
    placeholder: true,
  },
  guestRefill: {
    ar: 'بعد تسجيل الدخول: «المزيد ← تجديد الوصفات»، واختر الدواء. الطلب يروح للجهة اللي صرفت الوصفة.',
    en: 'After signing in: More → Refills, then pick the medicine. The request goes to the place that dispensed it.',
    placeholder: true,
  },

  safetyLine: {
    ar: 'نموذج طلابي. جميع البيانات هنا بيانات تجريبية. «جرعة» لا تقدّم استشارة طبية — اتبع دائماً تعليمات طبيبك والصيدلاني.',
    en: 'Student prototype. All data here is sample data. Jur’ah does not give medical advice — always follow your doctor and your pharmacist.',
    placeholder: true,
  },
} satisfies Record<string, CopyEntry>;

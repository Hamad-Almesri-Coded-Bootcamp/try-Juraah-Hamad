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
  notPatient: { ar: 'المساعد متاح للمريض فقط.', en: 'The assistant is for the patient only.', placeholder: true },
  safetyLine: {
    ar: 'نموذج طلابي. جميع البيانات هنا بيانات تجريبية. «جرعة» لا تقدّم استشارة طبية — اتبع دائماً تعليمات طبيبك والصيدلاني.',
    en: 'Student prototype. All data here is sample data. Jur’ah does not give medical advice — always follow your doctor and your pharmacist.',
    placeholder: true,
  },
} satisfies Record<string, CopyEntry>;

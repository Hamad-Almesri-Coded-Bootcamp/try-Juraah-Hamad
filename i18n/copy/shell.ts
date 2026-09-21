/**
 * Copy catalogue, shell group (WP0/WP3). Every user-facing string lives in a file under i18n/copy;
 * nothing in app/, components/ or features/ may hold a literal (guard 7 + eslint jsx-no-literals).
 * `placeholder: true` marks copy the owner's bilingual deck has not yet replaced.
 */
export type CopyEntry = { readonly ar: string; readonly en: string; readonly placeholder?: true };
export type Copy<K extends string> = Readonly<Record<K, CopyEntry>>;

export const shell = {
  appName: { ar: 'جرعة', en: 'Jur’ah' },
  appDescription: {
    ar: 'أدويتك كلها في مكان واحد — ومفحوصة',
    en: 'All your medicines in one place, and checked',
    placeholder: true,
  },
  languageSwitch: { ar: 'English', en: 'العربية' },
  languageSwitchLabel: { ar: 'تغيير اللغة إلى الإنجليزية', en: 'Switch language to Arabic', placeholder: true },
  skipToContent: { ar: 'انتقل إلى المحتوى', en: 'Skip to content', placeholder: true },
  scaffoldNotice: {
    ar: 'هيكل المشروع فقط — الشاشات تُبنى في حزم العمل التالية.',
    en: 'Project scaffold only — the screens are built in the following work packages.',
    placeholder: true,
  },
  notFoundTitle: { ar: 'ما لقينا هذي الصفحة', en: 'We could not find this page', placeholder: true },
  notFoundBody: { ar: 'يمكن الرابط قديم أو فيه خطأ مطبعي.', en: 'The link may be old or mistyped.', placeholder: true },
  errorTitle: { ar: 'صار خطأ عندنا', en: 'Something went wrong on our side', placeholder: true },
  errorBody: {
    ar: 'ما قدرنا نكمّل العملية. جرّب مرة ثانية — وإذا تكرر، ارجع لليوم وكمّل عادي.',
    en: 'We could not finish that. Try again — and if it happens again, go back to Today and carry on.',
    placeholder: true,
  },
  retry: { ar: 'إعادة المحاولة', en: 'Try again', placeholder: true },
  backHome: { ar: 'رجوع للصفحة الرئيسية', en: 'Back to the home page', placeholder: true },
  offlineTitle: { ar: 'بدون اتصال حاليًا', en: 'You are offline', placeholder: true },
  offlineBody: {
    ar: 'نعرض آخر نسخة محفوظة. حدّث الصفحة لما يرجع الاتصال.',
    en: 'Showing the last saved copy. Refresh when you are back online.',
    placeholder: true,
  },
  refresh: { ar: 'تحديث', en: 'Refresh', placeholder: true },
} satisfies Copy<string>;

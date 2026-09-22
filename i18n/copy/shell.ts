/**
 * Copy catalogue, shell group (WP0/WP3). Every user-facing string lives in a file under i18n/copy;
 * nothing in app/, components/ or features/ may hold a literal (guard 7 + eslint jsx-no-literals).
 * `placeholder: true` marks copy the owner's bilingual deck has not yet replaced.
 *
 * WP3 owns this file from Gate 2 on: the shell chrome's tab labels, More/ClinicNav item labels,
 * banner sentences, the system pages' copy, the role-switch copy and every placeholder screen's
 * title. A key with a `{name}` token is a template — see features/shell/interpolate.ts — filled with
 * a DATA value (a patient's first name, a relationship), never with another copy-catalogue string.
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

  // H1 — not found
  notFoundTitle: { ar: 'ما لقينا هذي الصفحة', en: 'We could not find this page', placeholder: true },
  notFoundBody: { ar: 'يمكن الرابط قديم أو فيه خطأ مطبعي.', en: 'The link may be old or mistyped.', placeholder: true },
  backHome: { ar: 'رجوع للصفحة الرئيسية', en: 'Back to the home page', placeholder: true },
  backToToday: { ar: 'رجوع لليوم', en: 'Back to Today', placeholder: true },
  backToQueue: { ar: 'رجوع للقائمة', en: 'Back to the queue', placeholder: true },

  // H2 — application error
  errorTitle: { ar: 'صار خطأ عندنا', en: 'Something went wrong on our side', placeholder: true },
  errorBody: {
    ar: 'ما قدرنا نكمّل العملية. جرّب مرة ثانية — وإذا تكرر، ارجع لليوم وكمّل عادي.',
    en: 'We could not finish that. Try again — and if it happens again, go back to Today and carry on.',
    placeholder: true,
  },
  retry: { ar: 'إعادة المحاولة', en: 'Try again', placeholder: true },

  // H3 — offline / failed refresh
  offlineTitle: { ar: 'بدون اتصال حاليًا', en: 'You are offline', placeholder: true },
  offlineBody: {
    ar: 'نعرض آخر نسخة محفوظة. حدّث الصفحة لما يرجع الاتصال.',
    en: 'Showing the last saved copy. Refresh when you are back online.',
    placeholder: true,
  },
  lastKnownTitle: { ar: 'تعرض آخر نسخة محفوظة', en: 'Showing the last known copy', placeholder: true },
  lastKnownEmptyTitle: { ar: 'ما فيه نسخة محفوظة بعد', en: 'Nothing saved yet to show', placeholder: true },
  lastKnownEmptyBody: {
    ar: 'ما زرت هذي الصفحة قبل الآن بدون اتصال. حدّث لما يرجع الاتصال.',
    en: 'This page has not loaded before without a connection. Refresh once you are back online.',
    placeholder: true,
  },
  refresh: { ar: 'تحديث', en: 'Refresh', placeholder: true },

  // The TabBar/side-rail landmark's accessible name, every shell (G8)
  mainNavigationLabel: { ar: 'التنقل الرئيسي', en: 'Main navigation', placeholder: true },
  // The side rail's wordmark from 834px up (boards Today834 · MedicinesDesktop: «جرعة»; ReviewerDesktop ·
  // AuditLog1440: «جرعة · العيادة»). The patient and caregiver rails use `appName` itself.
  clinicWordmark: { ar: 'جرعة · العيادة', en: 'Jur’ah · Clinic', placeholder: true },

  // Sign-out (A3, F4, the clinic rail — CR-020)
  signOut: { ar: 'تسجيل الخروج', en: 'Sign out', placeholder: true },

  // G8 tab labels — patient shell (4)
  tabToday: { ar: 'اليوم', en: 'Today', placeholder: true },
  tabMedicines: { ar: 'أدويتي', en: 'My Medicines', placeholder: true },
  tabSafety: { ar: 'السلامة', en: 'Safety', placeholder: true },
  tabMore: { ar: 'المزيد', en: 'More', placeholder: true },

  // G8 tab labels — caregiver shell (3, its own wording — navigation.md)
  careTabToday: { ar: 'اليوم', en: 'Today', placeholder: true },
  careTabMedicines: { ar: 'الأدوية', en: 'Medicines', placeholder: true },
  careTabMore: { ar: 'المزيد', en: 'More', placeholder: true },

  // G8 tab labels — clinic shell (2)
  tabReview: { ar: 'مراجعة', en: 'Review', placeholder: true },
  tabAudit: { ar: 'تدقيق', en: 'Audit', placeholder: true },

  // Patient More menu (G8 order)
  moreRefill: { ar: 'تجديد الوصفات', en: 'Refill', placeholder: true },
  moreCalendar: { ar: 'مزامنة التقويم', en: 'Calendar sync', placeholder: true },
  moreNotifications: { ar: 'الإشعارات والمراسلة', en: 'Notifications & messaging', placeholder: true },
  moreCaregivers: { ar: 'مقدّمو الرعاية', en: 'Caregivers', placeholder: true },
  moreActivity: { ar: 'سجل الأحداث', en: 'Activity', placeholder: true },
  moreSettings: { ar: 'الإعدادات', en: 'Settings', placeholder: true },
  moreProfile: { ar: 'الحساب', en: 'Profile', placeholder: true },
  moreHelp: { ar: 'المساعدة', en: 'Help', placeholder: true },

  // Caregiver More menu
  moreProfileNotifications: { ar: 'الملف الشخصي والإشعارات', en: 'Profile & notifications', placeholder: true },

  // The quiet pending-invitation notice (B1 / More — F0's second entry point)
  pendingInvitationNoticeTemplate: {
    ar: '{name} يطلب متابعة سجلك الطبي',
    en: '{name} is asking to follow your medical record',
    placeholder: true,
  },
  pendingInvitationNoticeValue: { ar: 'مراجعة الطلب', en: 'Review the request', placeholder: true },

  // In-shell role switch (never signOut — ROLES.md, A1b)
  roleSwitchPrefix: { ar: 'التبديل إلى', en: 'Switch to' },
  roleSwitchPatientLabel: { ar: 'أدويتي', en: 'my medicines', placeholder: true },
  roleSwitchCaregiverLabelTemplate: { ar: 'أدوية {name}', en: '{name}’s medicines', placeholder: true },
  roleSwitchReviewerLabel: { ar: 'المراجعة الطبية', en: 'medical review', placeholder: true },
  roleSwitchAdminLabel: { ar: 'تدقيق النظام', en: 'system audit', placeholder: true },

  // Caregiver banner (ContextBanner variant="caregiver", every caregiver screen)
  caregiverBannerReadOnly: { ar: 'عرض فقط', en: 'Read-only', placeholder: true },

  // Clinic — simulated-role labelling (ContextBanner variant="simulated")
  clinicRoleReviewer: { ar: 'مراجعة طبية', en: 'Medical review', placeholder: true },
  clinicRoleAdmin: { ar: 'تدقيق النظام', en: 'System admin', placeholder: true },

  // Placeholder screens (RoutePlaceholder — replaced by each bundle as it lands)
  placeholderNotice: {
    ar: 'شاشة مبدئية — تُبنى في حزمة عمل لاحقة. المسار يعمل وهذي الشاشة قابلة للاختبار.',
    en: 'Placeholder screen — a later work package builds the real content. The route works and this screen is testable.',
    placeholder: true,
  },
} as const satisfies Copy<string>;

/** One title per screen code, for RoutePlaceholder — docs/SCREENS.md's inventory, minus the shell
 * chrome it does not count (the More menus, built for real by WP3 instead of placeholders). */
export const screenTitles = {
  A1: { ar: 'تسجيل الدخول', en: 'Sign in', placeholder: true },
  A1b: { ar: 'اختيار الدور', en: 'Choose a role', placeholder: true },
  A2: { ar: 'الإعداد الأول', en: 'First-run setup', placeholder: true },
  A3: { ar: 'الحساب', en: 'Profile', placeholder: true },
  B1: { ar: 'اليوم', en: 'Today', placeholder: true },
  B2: { ar: 'أدويتي', en: 'My Medicines', placeholder: true },
  B3: { ar: 'تفاصيل الوصفة', en: 'Prescription detail', placeholder: true },
  B4: { ar: 'إضافة وصفة', en: 'Add / scan prescription', placeholder: true },
  C1: { ar: 'السلامة', en: 'Safety', placeholder: true },
  C2: { ar: 'تفاصيل تنبيه التعارض', en: 'Interaction alert detail', placeholder: true },
  C3: { ar: 'فحص دواء بالصورة', en: 'Travel / photo drug check', placeholder: true },
  D1: { ar: 'تجديد الوصفات', en: 'Refill request', placeholder: true },
  E1: { ar: 'مزامنة التقويم', en: 'Calendar sync', placeholder: true },
  E2: { ar: 'سجل الأحداث', en: 'Activity feed', placeholder: true },
  E3: { ar: 'الإعدادات', en: 'Settings', placeholder: true },
  E4: { ar: 'المساعدة والدعم', en: 'Help & support', placeholder: true },
  E5: { ar: 'الإشعارات والمراسلة', en: 'Notifications & messaging', placeholder: true },
  F0: { ar: 'دعوة مقدّم رعاية', en: 'Caregiver invitation', placeholder: true },
  F1: { ar: 'مقدّمو الرعاية', en: 'Caregiver management', placeholder: true },
  F2: { ar: 'شاشة مقدّم الرعاية', en: 'Caregiver home', placeholder: true },
  F3: { ar: 'تفاصيل للقراءة فقط', en: 'Caregiver detail access', placeholder: true },
  F4: { ar: 'الملف الشخصي والإشعارات', en: 'Caregiver profile & notifications', placeholder: true },
  F5: { ar: 'مساعدة مقدّم الرعاية', en: 'Caregiver help', placeholder: true },
  G1s: { ar: 'قائمة التعارضات', en: 'Reviewer queue — interaction findings', placeholder: true },
  G2s: { ar: 'قرار المراجع', en: 'Reviewer decision', placeholder: true },
  G3s: { ar: 'تأكيد حقول الوصفات', en: 'Field-confirmation queue', placeholder: true },
  X0: { ar: 'دخول العيادة', en: 'Clinic entry & role chooser', placeholder: true },
  X1: { ar: 'سجل التدقيق', en: 'System audit log', placeholder: true },
} as const satisfies Copy<string>;

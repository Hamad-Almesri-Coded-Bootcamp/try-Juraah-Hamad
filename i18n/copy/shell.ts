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
    ar: 'أدويتك كلها في مكان واحد، ومفحوصة',
    en: 'All your medicines in one place, and checked',
    placeholder: true,
  },
  languageSwitch: { ar: 'English', en: 'العربية' },
  languageSwitchLabel: { ar: 'تغيير اللغة إلى الإنجليزية', en: 'Switch language to Arabic', placeholder: true },
  skipToContent: { ar: 'انتقل إلى المحتوى', en: 'Skip to content', placeholder: true },
  scaffoldNotice: {
    ar: 'هيكل المشروع فقط. تُبنى الشاشات في حزم العمل القادمة.',
    en: 'Project scaffold only. The screens come in the next work packages.',
    placeholder: true,
  },

  // H1 — not found
  notFoundTitle: { ar: 'لم نجد هذه الصفحة', en: 'We couldn’t find this page', placeholder: true },
  notFoundBody: { ar: 'ربما يكون الرابط قديمًا أو فيه خطأ في الكتابة.', en: 'The link may be old or mistyped.', placeholder: true },
  backHome: { ar: 'العودة إلى الصفحة الرئيسية', en: 'Back to the home page', placeholder: true },
  backToToday: { ar: 'العودة إلى اليوم', en: 'Back to Today', placeholder: true },
  backToQueue: { ar: 'العودة إلى القائمة', en: 'Back to the queue', placeholder: true },

  // H2 — application error
  errorTitle: { ar: 'حدث خطأ من جهتنا', en: 'Something went wrong on our side', placeholder: true },
  errorBody: {
    ar: 'لم نتمكن من إتمام العملية. حاول مرة أخرى، وإذا تكرر الخطأ فعُد إلى صفحة اليوم وتابع كالمعتاد.',
    en: 'We couldn’t finish that. Please try again. If it keeps happening, go back to Today and carry on.',
    placeholder: true,
  },
  retry: { ar: 'إعادة المحاولة', en: 'Try again', placeholder: true },

  // H3 — offline / failed refresh
  offlineTitle: { ar: 'لا يوجد اتصال حاليًا', en: 'You’re offline', placeholder: true },
  offlineBody: {
    ar: 'نعرض لك آخر نسخة محفوظة. حدّث الصفحة عند عودة الاتصال.',
    en: 'Here’s the last saved copy. Refresh when you’re back online.',
    placeholder: true,
  },
  lastKnownTitle: { ar: 'هذه آخر نسخة محفوظة', en: 'This is the last saved copy', placeholder: true },
  lastKnownEmptyTitle: { ar: 'لا توجد نسخة محفوظة بعد', en: 'Nothing saved to show yet', placeholder: true },
  lastKnownEmptyBody: {
    ar: 'لم تُفتح هذه الصفحة من قبل دون اتصال. حدّثها عند عودة الاتصال.',
    en: 'This page hasn’t been opened offline before. Refresh once you’re back online.',
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
  moreRefill: { ar: 'تجديد الوصفات', en: 'Refills', placeholder: true },
  moreCalendar: { ar: 'مزامنة التقويم', en: 'Calendar sync', placeholder: true },
  moreNotifications: { ar: 'الإشعارات والرسائل', en: 'Notifications and messages', placeholder: true },
  moreCaregivers: { ar: 'مقدّمو الرعاية', en: 'Caregivers', placeholder: true },
  moreActivity: { ar: 'سجل الأحداث', en: 'Activity', placeholder: true },
  moreSettings: { ar: 'الإعدادات', en: 'Settings', placeholder: true },
  moreProfile: { ar: 'الحساب', en: 'Profile', placeholder: true },
  moreHelp: { ar: 'المساعدة', en: 'Help', placeholder: true },

  // Caregiver More menu
  moreProfileNotifications: { ar: 'الحساب والإشعارات', en: 'Profile and notifications', placeholder: true },

  // The quiet pending-invitation notice (B1 / More — F0's second entry point)
  pendingInvitationNoticeTemplate: {
    ar: 'لديك دعوة من {name} لتكون مقدّم رعاية',
    en: '{name} has invited you to be their caregiver',
    placeholder: true,
  },
  pendingInvitationNoticeValue: { ar: 'مراجعة الدعوة', en: 'Review the invitation', placeholder: true },

  // In-shell role switch (never signOut — ROLES.md, A1b)
  roleSwitchPrefix: { ar: 'الانتقال إلى', en: 'Switch to' },
  roleSwitchPatientLabel: { ar: 'أدويتي', en: 'my medicines', placeholder: true },
  roleSwitchCaregiverLabelTemplate: { ar: 'أدوية {name}', en: '{name}’s medicines', placeholder: true },
  roleSwitchReviewerLabel: { ar: 'المراجعة الطبية', en: 'medical review', placeholder: true },
  roleSwitchAdminLabel: { ar: 'تدقيق النظام', en: 'system audit', placeholder: true },

  // Caregiver banner (ContextBanner variant="caregiver", every caregiver screen)
  caregiverBannerReadOnly: { ar: 'للاطلاع فقط', en: 'Read-only', placeholder: true },

  // Clinic — simulated-role labelling (ContextBanner variant="simulated")
  clinicRoleReviewer: { ar: 'المراجعة الطبية', en: 'Medical review', placeholder: true },
  clinicRoleAdmin: { ar: 'إدارة النظام', en: 'System admin', placeholder: true },

  // Placeholder screens (RoutePlaceholder — replaced by each bundle as it lands)
  placeholderNotice: {
    ar: 'شاشة مبدئية. ستُبنى في حزمة عمل لاحقة، والمسار يعمل ويمكن اختباره.',
    en: 'Placeholder screen. A later work package builds it; the route works and can be tested.',
    placeholder: true,
  },
} as const satisfies Copy<string>;

/** One title per screen code, for RoutePlaceholder — docs/SCREENS.md's inventory, minus the shell
 * chrome it does not count (the More menus, built for real by WP3 instead of placeholders). */
export const screenTitles = {
  A1: { ar: 'تسجيل الدخول', en: 'Sign in', placeholder: true },
  A1b: { ar: 'اختر الملف', en: 'Choose a record', placeholder: true },
  A2: { ar: 'الإعداد الأول', en: 'Getting started', placeholder: true },
  A3: { ar: 'الحساب', en: 'Profile', placeholder: true },
  B1: { ar: 'اليوم', en: 'Today', placeholder: true },
  B2: { ar: 'أدويتي', en: 'My Medicines', placeholder: true },
  B3: { ar: 'تفاصيل الوصفة', en: 'Prescription', placeholder: true },
  B4: { ar: 'إضافة وصفة', en: 'Add a prescription', placeholder: true },
  C1: { ar: 'السلامة', en: 'Safety', placeholder: true },
  C2: { ar: 'تفاصيل التنبيه', en: 'Alert details', placeholder: true },
  C3: { ar: 'فحص دواء بالصورة', en: 'Check a medicine', placeholder: true },
  D1: { ar: 'تجديد الوصفات', en: 'Refills', placeholder: true },
  E1: { ar: 'مزامنة التقويم', en: 'Calendar sync', placeholder: true },
  E2: { ar: 'سجل الأحداث', en: 'Activity', placeholder: true },
  E3: { ar: 'الإعدادات', en: 'Settings', placeholder: true },
  E4: { ar: 'المساعدة', en: 'Help', placeholder: true },
  E5: { ar: 'الإشعارات والرسائل', en: 'Notifications and messages', placeholder: true },
  F0: { ar: 'دعوة مقدّم رعاية', en: 'Caregiver invitation', placeholder: true },
  F1: { ar: 'مقدّمو الرعاية', en: 'Caregivers', placeholder: true },
  F2: { ar: 'الرئيسية', en: 'Home', placeholder: true },
  F3: { ar: 'للاطلاع فقط', en: 'Details', placeholder: true },
  F4: { ar: 'الحساب والإشعارات', en: 'Profile and notifications', placeholder: true },
  F5: { ar: 'المساعدة', en: 'Help', placeholder: true },
  G1s: { ar: 'تعارضات للمراجعة', en: 'Interactions to review', placeholder: true },
  G2s: { ar: 'قرار المراجع', en: 'Reviewer decision', placeholder: true },
  G3s: { ar: 'بيانات وصفات للتأكيد', en: 'Prescription details to confirm', placeholder: true },
  X0: { ar: 'دخول العيادة', en: 'Clinic sign-in', placeholder: true },
  X1: { ar: 'سجل التدقيق', en: 'Audit log', placeholder: true },
} as const satisfies Copy<string>;

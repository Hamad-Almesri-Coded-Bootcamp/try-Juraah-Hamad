/**
 * Copy catalogue, supply group (WP4 bundle f — C3 "Travel / photo drug check", D1 "Refill
 * request"). Owned by its bundle from its wave on; the lead created the stub and registered it in
 * i18n/index.ts so parallel bundles never touch a shared file (D-003). Every key is `placeholder:
 * true` until the owner's bilingual copy deck replaces it. The dose-status/sector/review-state
 * vocabulary and the "retry"/"back"/"close" words all live in `./vocabulary.ts` and are reused,
 * never redefined here (CLAUDE.md rule 9 / G9).
 */
import type { CopyEntry } from './shell';

export const supply = {
  // ---------------------------------------------------------------------------------------------
  // C3 — Travel / photo drug check (`/[locale]/app/safety/check`)
  // ---------------------------------------------------------------------------------------------
  c3PhotoLabel: { ar: 'صورة العلبة', en: 'Photo of the packet', placeholder: true },

  // Analysing — UX Principles §5: say what is happening and roughly how long.
  c3AnalysingTitle: { ar: 'نتحقق من الدواء', en: 'Checking this medication', placeholder: true },
  c3AnalysingBody: {
    ar: 'نقارنه بملفك الدوائي الكامل. يستغرق هذا عادة أقل من ٣٠ ثانية.',
    en: 'We are checking it against your full medication profile. This usually takes less than 30 seconds.',
    placeholder: true,
  },

  c3ResultHeading: { ar: 'النتيجة', en: 'Result', placeholder: true },
  c3DrugLabel: { ar: 'الدواء', en: 'Medication', placeholder: true },
  // The screen adds no screening logic of its own (docs/briefs/WP4f.md) — this line only states
  // that a check happened against the patient's own profile, never a fabricated count of drugs.
  c3ScreenedAgainstNote: {
    ar: 'فُحص مقابل ملفك الدوائي النشط بالكامل.',
    en: 'Screened against your whole active medication profile.',
    placeholder: true,
  },

  c3NoInteractionTitle: { ar: 'ما فيه تعارض', en: 'No interaction found', placeholder: true },
  c3NoInteractionBody: {
    ar: 'هذا الدواء ما يتعارض مع أدويتك الحالية.',
    en: 'This medication does not interact with your current medications.',
    placeholder: true,
  },

  // An interaction hands off to C2's own route for the finding itself (never re-implemented here) —
  // this is only the summary line and the button into it.
  c3InteractionDescription: {
    ar: 'قد يتعارض هذا الدواء مع دواء آخر في ملفك. افتح تفاصيل التعارض قبل أي قرار.',
    en: 'This medication may interact with another one in your profile. Open the interaction details before deciding anything.',
    placeholder: true,
  },
  c3OpenInteractionButton: { ar: 'افتح تفاصيل التعارض', en: 'Open interaction details', placeholder: true },
  c3CheckAnotherButton: { ar: 'صورة ثانية', en: 'Check another photo', placeholder: true },

  // Could-not-identify — an explicit, honest state (ErrorState tone), never a guessed drug, and
  // nothing here creates any record (docs/Acceptance Criteria and Test Plan.md, C3 row).
  c3CouldNotIdentifyTitle: { ar: 'ما قدرنا نتعرف على هذا الدواء', en: 'We could not identify this medication', placeholder: true },
  c3CouldNotIdentifyBody: {
    ar: 'جرّب صورة أوضح تُظهر اسم الدواء بوضوح. ما تم تسجيل أو حفظ أي شيء.',
    en: 'Try a clearer photo that shows the drug name plainly. Nothing has been recorded or saved.',
    placeholder: true,
  },
  c3CouldNotIdentifyRetryLabel: { ar: 'حاول بصورة ثانية', en: 'Try another photo', placeholder: true },

  // ---------------------------------------------------------------------------------------------
  // D1 — Refill request (`/[locale]/app/more/refill`, also pushed from B3 with `?rx=`)
  // ---------------------------------------------------------------------------------------------
  d1EmptyTitle: { ar: 'ما فيه وصفات نشطة للتجديد', en: 'No active prescriptions to refill', placeholder: true },
  d1EmptyBody: {
    ar: 'طلبات التجديد تظهر هنا بمجرد ما يصير عندك وصفة نشطة.',
    en: 'Refill requests appear here once you have an active prescription.',
    placeholder: true,
  },

  d1RequestButtonLabel: { ar: 'طلب تجديد', en: 'Request a refill', placeholder: true },

  // The two routing destinations, in the catalogue's own words (never the raw contract value).
  d1DestinationPublic: { ar: 'الصيدلية الحكومية', en: 'the public pharmacy', placeholder: true },
  d1DestinationPrivate: { ar: 'صيدلية القطاع الخاص', en: 'the private pharmacy', placeholder: true },

  // The confirm Sheet — Sheet.md's "Do": restate the drug and the pharmacy before the confirming
  // button, so the sector routing is visible before it is committed.
  d1ConfirmSheetTitle: { ar: 'تأكيد طلب التجديد', en: 'Confirm the refill request', placeholder: true },
  d1ConfirmDrugLabel: { ar: 'الدواء', en: 'Medication', placeholder: true },
  d1ConfirmDestinationLabel: { ar: 'يُوجّه إلى', en: 'Routes to', placeholder: true },
  d1ConfirmSendButton: { ar: 'إرسال الطلب', en: 'Send the request', placeholder: true },
  d1ConfirmCancelButton: { ar: 'إلغاء', en: 'Cancel', placeholder: true },

  // After requesting (or already requested from seed) — an InlineNotice, never a status pill, naming
  // the routing destination (docs/SCREENS.md D1 row).
  d1AlreadyRequestedTitle: { ar: 'تم طلب التجديد', en: 'Refill requested', placeholder: true },
  d1AlreadyRequestedBodyTemplate: { ar: 'يُوجّه هذا الطلب إلى {destination}.', en: 'This request routes to {destination}.', placeholder: true },

  // My requests — RefillRequest rows via MenuRow.
  d1MyRequestsHeading: { ar: 'طلباتي', en: 'My requests', placeholder: true },
  d1RequestsEmpty: { ar: 'ما فيه طلبات تجديد بعد.', en: 'No refill requests yet.', placeholder: true },
  d1RequestedOnTemplate: { ar: 'طُلب {date} · يُوجّه إلى {destination}', en: 'Requested {date} · routed to {destination}', placeholder: true },
  d1StatusRequested: { ar: 'قيد الموافقة', en: 'Pending approval', placeholder: true },
  d1StatusApproved: { ar: 'تمت الموافقة', en: 'Approved', placeholder: true },
  d1StatusDenied: { ar: 'مرفوض', en: 'Denied', placeholder: true },
  // A request whose prescription no longer appears among the active ones (defensive — never
  // "undefined", never a raw prescription id, per G9).
  d1UnknownPrescriptionLabel: { ar: 'وصفة سابقة', en: 'An earlier prescription', placeholder: true },
} satisfies Record<string, CopyEntry>;

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
  c3TakePhoto: { ar: 'التقط صورة للعلبة', en: 'Take a photo of the packet', placeholder: true },
  c3CaptureTitle: { ar: 'صوّر علبة الدواء', en: 'Take a photo of the packet', placeholder: true },
  c3CaptureBody: {
    ar: 'نقرأ اسم الدواء من الصورة ونقارنه بكل أدويتك الحالية قبل أن تتناوله.',
    en: 'We read the medicine’s name from the photo and compare it with all your current medicines before you take it.',
    placeholder: true,
  },

  // Analysing — UX Principles §5: say what is happening and roughly how long.
  c3AnalysingTitle: { ar: 'نتحقق من الدواء', en: 'Checking this medicine', placeholder: true },
  c3AnalysingBody: {
    ar: 'نقارنه بكل أدويتك الحالية. يستغرق هذا عادةً أقل من ٣٠ ثانية.',
    en: 'We’re comparing it with all your current medicines. This usually takes less than 30 seconds.',
    placeholder: true,
  },

  c3ResultHeading: { ar: 'النتيجة', en: 'Result', placeholder: true },
  c3DrugLabel: { ar: 'الدواء', en: 'Medicine', placeholder: true },
  // The screen adds no screening logic of its own (docs/briefs/WP4f.md) — this line only states
  // that a check happened against the patient's own profile, never a fabricated count of drugs.
  c3ScreenedAgainstNote: {
    ar: 'قارنّاه بكل أدويتك الحالية.',
    en: 'We compared it with all your current medicines.',
    placeholder: true,
  },

  c3NoInteractionTitle: { ar: 'لم نجد تعارضًا', en: 'No interaction found', placeholder: true },
  c3NoInteractionBody: {
    ar: 'لم يُظهر الفحص أي تعارض بين هذا الدواء وأدويتك الحالية.',
    en: 'This check found no interaction between this medicine and your current ones.',
    placeholder: true,
  },

  // An interaction hands off to C2's own route for the finding itself (never re-implemented here) —
  // this is only the summary line and the button into it.
  c3InteractionDescription: {
    ar: 'قد يتعارض هذا الدواء مع دواء تتناوله حاليًا. اطّلع على تفاصيل التعارض قبل أن تقرر أي شيء.',
    en: 'This medicine may interact with one you already take. Open the details before you decide anything.',
    placeholder: true,
  },
  c3OpenInteractionButton: { ar: 'افتح تفاصيل التعارض', en: 'Open interaction details', placeholder: true },
  // CR-066: an interaction the Travel Check agent found but raised no alert for (a warning-level
  // finding, or a drug already in the profile) — there are no details to open, so the line says what
  // to do instead. Never shown by the stub, which always links an alert.
  c3InteractionNoDetailsDescription: {
    ar: 'قد يتعارض هذا الدواء مع دواء تتناوله حاليًا. اسأل الصيدلي أو الطبيب قبل استخدامه.',
    en: 'This medicine may interact with one you already take. Ask your pharmacist or doctor before you take it.',
    placeholder: true,
  },
  c3CheckAnotherButton: { ar: 'افحص صورة أخرى', en: 'Check another photo', placeholder: true },

  // Could-not-identify — an explicit, honest state (ErrorState tone), never a guessed drug, and
  // nothing here creates any record (docs/Acceptance Criteria and Test Plan.md, C3 row).
  c3CouldNotIdentifyTitle: { ar: 'لم نتمكن من التعرف على هذا الدواء', en: 'We couldn’t identify this medicine', placeholder: true },
  c3CouldNotIdentifyBody: {
    ar: 'جرّب صورة أخرى يظهر فيها اسم الدواء بوضوح. لم نسجّل أو نحفظ أي شيء.',
    en: 'Try another photo that shows the medicine’s name clearly. Nothing was recorded or saved.',
    placeholder: true,
  },
  c3CouldNotIdentifyRetryLabel: { ar: 'جرّب صورة أخرى', en: 'Try another photo', placeholder: true },

  // Cannot-verify (CR-078) — the medicine was recognised, but Travel Check could not screen it
  // against the whole profile right now. Never implies the medicine is safe, and nothing here
  // creates any record.
  c3CannotVerifyTitle: { ar: 'لا نستطيع التحقق من هذا الدواء', en: 'We cannot verify this medicine', placeholder: true },
  c3CannotVerifyBody: {
    ar: 'تعرّفنا على الدواء، لكننا لا نستطيع الآن فحصه مع جميع أدويتك. هذا لا يعني أنه آمن. اسأل الصيدلي قبل أن تتناوله. لم نسجّل أو نحفظ أي شيء.',
    en: 'We recognised the medicine, but we cannot check it against all the medicines you take right now. This does not mean it is safe. Ask your pharmacist before you take it. Nothing was recorded or saved.',
    placeholder: true,
  },

  // Not a medicine — the photo was read, but it is not a medicine packet, box or strip at all (the
  // agent's own classification, never inferred here). An explicit, honest state like
  // could_not_identify (ErrorState tone): unlike cannot_verify, a retry with a different photo is
  // exactly the fix, so it reuses could_not_identify's own retry label rather than a new one.
  // NOTE (app copy is Fusha, not the dialect: docs/AGENTS-POLISH-PLAN.md:212, decision D7) — written
  // in the same register as every other string in this file, not the Kuwaiti dialect the task brief
  // suggested; see the session notes.
  c3NotAMedicineTitle: { ar: 'لم نجد دواءً في هذه الصورة', en: 'This doesn’t look like a medicine', placeholder: true },
  c3NotAMedicineBody: {
    ar: 'صوّر علبة الدواء أو الشريط بحيث يظهر اسمه بوضوح أمام الكاميرا.',
    en: 'Take a photo of the medicine box or strip, with its name facing the camera.',
    placeholder: true,
  },

  // ---------------------------------------------------------------------------------------------
  // D1 — Refill request (`/[locale]/app/more/refill`, also pushed from B3 with `?rx=`)
  // ---------------------------------------------------------------------------------------------
  d1EmptyTitle: { ar: 'لا توجد وصفات نشطة لتجديدها', en: 'No active prescriptions to refill', placeholder: true },
  d1EmptyBody: {
    ar: 'عندما تكون لديك وصفة نشطة، يمكنك طلب تجديدها من هنا.',
    en: 'Once you have an active prescription, you can request a refill here.',
    placeholder: true,
  },

  d1RequestButtonLabel: { ar: 'طلب تجديد', en: 'Request a refill', placeholder: true },

  // The supply ring (D1's cards and B3's supply card): the days left in the middle, the count beside.
  // The unit under the number agrees with it (Arabic has six forms); the en text of two/few/many is
  // never selected by English rules.
  supplyDaysUnitOne: { ar: 'يوم', en: 'day', placeholder: true },
  supplyDaysUnitTwo: { ar: 'يومان', en: 'days', placeholder: true },
  supplyDaysUnitFew: { ar: 'أيام', en: 'days', placeholder: true },
  supplyDaysUnitMany: { ar: 'يومًا', en: 'days', placeholder: true },
  supplyDaysUnitOther: { ar: 'يوم', en: 'days', placeholder: true },
  supplyCountTemplate: { ar: 'بقي {remaining} من {total}', en: '{remaining} of {total} left', placeholder: true },
  supplyRingLabelTemplate: { ar: 'الكمية المتبقية: {remaining} من {total}', en: 'Supply left: {remaining} of {total}', placeholder: true },
  supplyDispensedOnTemplate: { ar: 'صُرفت في {date}', en: 'Dispensed on {date}', placeholder: true },
  // No dispensing record: say so, never an invented estimate (DepletionMeter.md, B3, D1).
  supplyNoEstimate: {
    ar: 'لم تسجّل الصيدلية صرف هذا الدواء بعد، لذلك لا يوجد تقدير للكمية المتبقية.',
    en: 'The pharmacy hasn’t recorded dispensing this medicine yet, so there’s no estimate of what’s left.',
    placeholder: true,
  },

  // The two routing destinations, in the catalogue's own words (never the raw contract value).
  d1DestinationPublic: { ar: 'الصيدلية الحكومية', en: 'the public pharmacy', placeholder: true },
  d1DestinationPrivate: { ar: 'صيدلية القطاع الخاص', en: 'the private pharmacy', placeholder: true },

  // The confirm Sheet — Sheet.md's "Do": restate the drug and the pharmacy before the confirming
  // button, so the sector routing is visible before it is committed.
  d1ConfirmSheetTitle: { ar: 'تأكيد طلب التجديد', en: 'Confirm the refill request', placeholder: true },
  d1ConfirmDrugLabel: { ar: 'الدواء', en: 'Medicine', placeholder: true },
  d1ConfirmDestinationLabel: { ar: 'يُوجّه إلى', en: 'Goes to', placeholder: true },
  d1ConfirmSendButton: { ar: 'إرسال الطلب', en: 'Send the request', placeholder: true },
  d1ConfirmCancelButton: { ar: 'إلغاء', en: 'Cancel', placeholder: true },

  // After requesting (or already requested from seed) — an InlineNotice, never a status pill, naming
  // the routing destination (docs/SCREENS.md D1 row).
  d1AlreadyRequestedTitle: { ar: 'تم طلب التجديد', en: 'Refill requested', placeholder: true },
  d1AlreadyRequestedBodyTemplate: { ar: 'يُوجّه هذا الطلب إلى {destination}.', en: 'This request goes to {destination}.', placeholder: true },

  // My requests — RefillRequest rows via MenuRow.
  d1MyRequestsHeading: { ar: 'طلباتي', en: 'My requests', placeholder: true },
  d1RequestsEmpty: { ar: 'لا توجد طلبات تجديد بعد.', en: 'No refill requests yet.', placeholder: true },
  d1RequestedOnTemplate: { ar: 'طُلب في {date} · يُوجّه إلى {destination}', en: 'Requested {date} · goes to {destination}', placeholder: true },
  d1StatusRequested: { ar: 'قيد الموافقة', en: 'Pending approval', placeholder: true },
  d1StatusApproved: { ar: 'تمت الموافقة', en: 'Approved', placeholder: true },
  d1StatusDenied: { ar: 'مرفوض', en: 'Declined', placeholder: true },
  // A request whose prescription no longer appears among the active ones (defensive — never
  // "undefined", never a raw prescription id, per G9).
  d1UnknownPrescriptionLabel: { ar: 'وصفة سابقة', en: 'An earlier prescription', placeholder: true },
} satisfies Record<string, CopyEntry>;

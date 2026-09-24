/**
 * Copy catalogue, safety group (WP4 bundle e — C1 "Safety alerts list", C2 "Interaction alert
 * detail"). Owned by its bundle from its wave on; the lead created the stub and registered it in
 * i18n/index.ts so parallel bundles never touch a shared file (D-003). Every key is `placeholder:
 * true` until the owner's bilingual copy deck replaces it. The four dose-status words, the two
 * sector words and the three review-state words all live in `./vocabulary.ts` and are reused, never
 * redefined here (CLAUDE.md rule 9 / G9) — that file already carries `severityDanger/Warning/Info`,
 * `pending_medical_review`, `reviewed`, `auto_cleared` and `actor_reviewer`, which this bundle reuses
 * for InteractionAlert's built-in copy and for C2's "who" line (see AlertDetail.tsx's doc comment on
 * why "who" is the reviewer's role label, not a resolved name).
 */
import type { CopyEntry } from './shell';

export const safety = {
  // C1 — empty state (board: States.dc.html's reassuring-not-alarming pattern, applied to Safety)
  c1EmptyTitle: { ar: 'لا توجد تنبيهات سلامة حاليًا', en: 'No safety alerts right now', placeholder: true },
  c1EmptyDescription: {
    ar: 'فحصنا أدويتك، وإذا ظهر ما يستحق الانتباه فستجده هنا فورًا.',
    en: 'We’ve checked your medicines. If anything comes up, you’ll see it here right away.',
    placeholder: true,
  },

  // C1 — entry to C3 (Travel / photo drug check), present whether the list is empty or not
  c1CheckDrugAction: { ar: 'فحص دواء بالصورة', en: 'Check a medicine by photo', placeholder: true },

  // C1 — AppBar back label from the pushed alert detail (C2) back to the list
  c1BackLabel: { ar: 'العودة إلى السلامة', en: 'Back to Safety', placeholder: true },

  // C1 — Daylight (CR-071): the navy summary card that leads the screen. It says what was checked
  // (every active medicine, public and private together) and how many findings need the reader.
  c1SummaryTitle: { ar: 'فحصنا أدويتك كلها معًا', en: 'We checked all your medicines together', placeholder: true },
  c1SummaryMixedSectors: {
    ar: 'من القطاعين العام والخاص، في ملف واحد.',
    en: 'From the public and private sectors, in one record.',
    placeholder: true,
  },
  c1SummaryOneRecord: { ar: 'كلها في ملف واحد.', en: 'All in one record.', placeholder: true },
  // The tile under a number: the label agrees with the count (Arabic has six forms).
  c1CheckedCountZero: { ar: 'أدوية مفحوصة', en: 'medicines checked', placeholder: true },
  c1CheckedCountOne: { ar: 'دواء مفحوص', en: 'medicine checked', placeholder: true },
  c1CheckedCountTwo: { ar: 'دواءان مفحوصان', en: 'medicines checked', placeholder: true },
  c1CheckedCountFew: { ar: 'أدوية مفحوصة', en: 'medicines checked', placeholder: true },
  c1CheckedCountMany: { ar: 'دواءً مفحوصًا', en: 'medicines checked', placeholder: true },
  c1CheckedCountOther: { ar: 'دواء مفحوص', en: 'medicines checked', placeholder: true },
  c1AttentionCountOne: { ar: 'تنبيه يحتاج انتباهك', en: 'needs your attention', placeholder: true },
  c1AttentionCountTwo: { ar: 'تنبيهان يحتاجان انتباهك', en: 'need your attention', placeholder: true },
  c1AttentionCountFew: { ar: 'تنبيهات تحتاج انتباهك', en: 'need your attention', placeholder: true },
  c1AttentionCountMany: { ar: 'تنبيهًا يحتاج انتباهك', en: 'need your attention', placeholder: true },
  c1AttentionCountOther: { ar: 'تنبيه يحتاج انتباهك', en: 'need your attention', placeholder: true },
  c1AttentionNone: { ar: 'لا شيء يحتاج انتباهك', en: 'Nothing needs your attention', placeholder: true },
  // C1 — the two lists
  c1AttentionHeading: { ar: 'يحتاج انتباهك', en: 'Needs your attention', placeholder: true },
  c1PastHeading: { ar: 'نتائج سابقة', en: 'Past results', placeholder: true },
  // C1 — the photo check tile's line under its label
  c1CheckDrugDescription: {
    ar: 'صوّر علبة الدواء، ونفحصه مقابل كل ما في ملفك. يفيدك ذلك خاصةً في السفر.',
    en: 'Take a photo of the box and we’ll check it against everything on your record. Handy when you travel.',
    placeholder: true,
  },

  // C2 — "what to do right now", the danger-severity three-part shape's second part (UX Principles
  // §8), shown only while pending_medical_review holds. Real approved wording, from the reviewed
  // wireframe `AlertDanger.dc.html:50` — not invented here.
  // Since audit M11 heading + body form the alert's own review line, "heading: body"
  // (features/safety/guidance.ts), so what-to-do comes before who-is-checking — on C2 and on B2/F2's card.
  c2WhatToDoHeading: { ar: 'ماذا تفعل الآن', en: 'What to do right now', placeholder: true },
  c2WhatToDoPendingBody: {
    ar: 'لا توقف أي دواء ولا تغيّره من تلقاء نفسك. يراجع طبيب أو صيدلي حالتك، وستظهر لك النتيجة هنا.',
    en: 'Do not stop or change any medicine on your own. A doctor or pharmacist is checking this, and you’ll see the result here.',
    placeholder: true,
  },
  // C2 — the involved prescriptions section (n may be one, as ia-003's own lone drug shows — never
  // assume exactly two, unlike the board's "الوصفتان")
  c2InvolvedHeading: { ar: 'الوصفات المعنية', en: 'Prescriptions involved', placeholder: true },
  // C2 — Daylight (CR-071, V2Alert): the line under the two prescriptions side by side. The mixed line
  // is used only when exactly two prescriptions from different sectors are involved.
  // The same three lines as a caregiver reads them, about someone else's record (F2, F3; CR-071).
  c2WhatToDoPendingBodyCaregiver: {
    ar: 'لا ينبغي إيقاف أي دواء أو تغييره دون استشارة. يراجع طبيب أو صيدلي هذا التنبيه، وستظهر النتيجة هنا.',
    en: 'No medicine should be stopped or changed without advice. A doctor or pharmacist is checking this, and the result will appear here.',
    placeholder: true,
  },
  c2BridgeMixedPairCaregiver: {
    ar: 'وصفة من القطاع العام وأخرى من القطاع الخاص، فُحصتا معًا في ملف المريض.',
    en: 'One prescription from the public sector and one from the private sector, checked together on the patient’s record.',
    placeholder: true,
  },
  c2BridgeTogetherCaregiver: {
    ar: 'فُحصت هذه الوصفات معًا في ملف المريض.',
    en: 'These prescriptions were checked together on the patient’s record.',
    placeholder: true,
  },
  c2BridgeMixedPair: {
    ar: 'وصفة من القطاع العام وأخرى من القطاع الخاص، فُحصتا معًا في ملفك.',
    en: 'One prescription from the public sector and one from the private sector, checked together on your record.',
    placeholder: true,
  },
  c2BridgeTogether: {
    ar: 'فُحصت هذه الوصفات معًا في ملفك.',
    en: 'These prescriptions were checked together on your record.',
    placeholder: true,
  },
  // C2 — the numbered steps (UX §8: the risk, what to do right now, who is checking, in that order)
  c2StepsLabel: { ar: 'ما يجب أن تعرفه', en: 'What you need to know', placeholder: true },
  c2StepRiskHeading: { ar: 'الخطر', en: 'The risk', placeholder: true },
  // Step one's heading for an info finding, which names no risk.
  c2StepFindingHeading: { ar: 'ما وجدناه', en: 'What we found', placeholder: true },
  c2StepWhoPendingHeading: { ar: 'من يتحقق منه', en: 'Who is checking it', placeholder: true },
  c2StepWhoDoneHeading: { ar: 'من تحقق منه', en: 'Who checked it', placeholder: true },

  // C2 — the reviewed state's decision block (board: AlertReviewed.dc.html:49-55)
  c2ReviewHeading: { ar: 'قرار المراجع الطبي', en: 'The medical reviewer’s decision', placeholder: true },
  c2DecisionLabel: { ar: 'القرار', en: 'Decision', placeholder: true },
  c2DecisionConfirmed: { ar: 'الخطر مؤكد', en: 'Risk confirmed', placeholder: true },
  c2DecisionCleared: { ar: 'تم استبعاد الخطر', en: 'Risk ruled out', placeholder: true },
  // "Who" — CR-028: reviewedBy crosses the seam as an Account id (never a Civil ID), and no
  // published data function resolves it to a display name (reported in docs/backend-notes/wp4e.md
  // §7 as a WP1 follow-up, matching CR-031's precedent). The honest, safe rendering is a fixed
  // role label — never the raw id and never an invented name.
  c2ReviewerLabel: { ar: 'من راجعه', en: 'Reviewed by', placeholder: true },
  c2ReviewerValue: { ar: 'مختص طبي', en: 'A medical reviewer', placeholder: true },
  c2DateLabel: { ar: 'التاريخ', en: 'Date', placeholder: true },
  c2NoteLabel: { ar: 'الملاحظة', en: 'Note', placeholder: true },

  // C2 — the source citation section (board: AlertDanger.dc.html:54-58 / AlertReviewed same anatomy)
  c2SourceHeading: { ar: 'المصدر', en: 'Source', placeholder: true },
  // The explicit, honest line for an empty/TO_BE_SUPPLIED citation — never a fabricated or
  // plausible-looking one (CLAUDE.md, docs/Seed Dataset.md's own "leave it unwritten" rule).
  c2SourceUnverified: {
    ar: 'لا يتوفر مصدر طبي موثّق لهذا التنبيه حتى الآن.',
    en: 'No verified medical source is available for this alert yet.',
    placeholder: true,
  },

  // AP-10 / F3 — the hold: the description of the `warning` / `pending_medical_review` alert the
  // backend raises on a prescription whose screening request n8n did not accept
  // (lib/data/pg/screening.ts). Stored once, in the patient's language; `{drug}` is the
  // prescription's generic name as written. It reaches the reviewer's queue and the Safety list.
  screeningHeldTemplate: {
    ar: 'لم نتمكن من إكمال فحص {drug} مع أدويتك الأخرى، لذلك سيراجعه مختص طبي قبل الاعتماد عليه.',
    en: 'We could not finish checking {drug} against your other medicines, so a medical reviewer will look at it before it is relied on.',
    placeholder: true,
  },
} satisfies Record<string, CopyEntry>;

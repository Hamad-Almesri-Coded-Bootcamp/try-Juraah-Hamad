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
  c1EmptyTitle: { ar: 'ما فيه تنبيهات سلامة حاليًا', en: 'No safety alerts right now', placeholder: true },
  c1EmptyDescription: {
    ar: 'أدويتك مفحوصة، وإذا طلعت أي ملاحظة تظهر هنا فورًا.',
    en: 'Your medicines have been screened, and anything worth noting will appear here right away.',
    placeholder: true,
  },

  // C1 — entry to C3 (Travel / photo drug check), present whether the list is empty or not
  c1CheckDrugAction: { ar: 'فحص دواء بالصورة', en: 'Check a drug by photo', placeholder: true },

  // C1 — AppBar back label from the pushed alert detail (C2) back to the list
  c1BackLabel: { ar: 'رجوع للسلامة', en: 'Back to Safety', placeholder: true },

  // C2 — "what to do right now", the danger-severity three-part shape's second part (UX Principles
  // §8), shown only while pending_medical_review holds. Real approved wording, from the reviewed
  // wireframe `AlertDanger.dc.html:50` — not invented here.
  // Since audit M11 heading + body form the alert's own review line, "heading: body"
  // (features/safety/guidance.ts), so what-to-do comes before who-is-checking — on C2 and on B2/F2's card.
  c2WhatToDoHeading: { ar: 'شنو تسوي الآن', en: 'What to do right now', placeholder: true },
  c2WhatToDoPendingBody: {
    ar: 'لا توقف ولا تغيّر أي دواء من نفسك. فيه طبيب أو صيدلي يراجع الحالة، وتوصلك النتيجة هنا.',
    en: 'Do not stop or change any medication yourself. A doctor or pharmacist is reviewing this, and the result will appear here.',
    placeholder: true,
  },
  // The caption explaining the deliberate absence of an OK/dismiss control (board: AlertDanger.dc.html:58) —
  // read-only per G1: reading this screen changes nothing, and no control here could close the finding.
  c2NoActionNote: {
    ar: 'ما فيه زر «تم» أو «فهمت» هنا، بشكل مقصود: هذا التنبيه ما يُغلق إلا بقرار مراجع طبي.',
    en: 'There is no “done” or “understood” button here, on purpose: only a medical reviewer’s decision closes this finding.',
    placeholder: true,
  },

  // C2 — the involved prescriptions section (n may be one, as ia-003's own lone drug shows — never
  // assume exactly two, unlike the board's "الوصفتان")
  c2InvolvedHeading: { ar: 'الوصفات المعنية', en: 'Involved prescriptions', placeholder: true },

  // C2 — the reviewed state's decision block (board: AlertReviewed.dc.html:49-55)
  c2ReviewHeading: { ar: 'قرار المراجع', en: 'The reviewer’s decision', placeholder: true },
  c2DecisionLabel: { ar: 'القرار', en: 'Decision', placeholder: true },
  c2DecisionConfirmed: { ar: 'الخطر مؤكد', en: 'Risk confirmed', placeholder: true },
  c2DecisionCleared: { ar: 'تم استبعاد الخطر', en: 'Risk cleared', placeholder: true },
  // "Who" — CR-028: reviewedBy crosses the seam as an Account id (never a Civil ID), and no
  // published data function resolves it to a display name (reported in docs/backend-notes/wp4e.md
  // §7 as a WP1 follow-up, matching CR-031's precedent). The honest, safe rendering is a fixed
  // role label — never the raw id and never an invented name.
  c2ReviewerLabel: { ar: 'من راجعها', en: 'Reviewed by', placeholder: true },
  c2ReviewerValue: { ar: 'مراجع طبي', en: 'A medical reviewer', placeholder: true },
  c2DateLabel: { ar: 'التاريخ', en: 'Date', placeholder: true },
  c2NoteLabel: { ar: 'الملاحظة', en: 'Note', placeholder: true },

  // C2 — the source citation section (board: AlertDanger.dc.html:54-58 / AlertReviewed same anatomy)
  c2SourceHeading: { ar: 'المصدر', en: 'Source', placeholder: true },
  // The explicit, honest line for an empty/TO_BE_SUPPLIED citation — never a fabricated or
  // plausible-looking one (CLAUDE.md, docs/Seed Dataset.md's own "leave it unwritten" rule).
  c2SourceUnverified: {
    ar: 'ما توفر مصدر طبي مؤكد لهذا التنبيه بعد — القيمة معلّقة من قاعدة بيانات الأدوية.',
    en: 'No verified medical source is available for this finding yet — pending from the drug database.',
    placeholder: true,
  },
} satisfies Record<string, CopyEntry>;

# Wireframes — the approved layout for every screen

48 artboards covering the whole Phase 1 inventory: **thirty screens plus three system pages**.
This is the layout that was reviewed and approved. Build to it.

## How to read these files

Each `.dc.html` file is one artboard. **Read them; do not try to run them.** They were authored
in a Claude Design canvas and depend on that canvas's runtime, so opening one in a browser shows
nothing useful. What they give you is exact and machine-readable:

- **Which component, in which order.** `<x-import component-from-global-scope="Wasfa.Button" …>`
  means the design system's `Button` with those props. The component's API is in
  `../design-system/index.d.ts` and its rules in `../design-system/components/<Name>.md`.
- **The real copy**, in Arabic, as it should appear.
- **The layout** — flex direction, gaps, padding — all in token variables (`var(--space-3)`).
- **The data**, which comes from `../Seed Dataset.md`. The `renderVals()` block at the bottom of
  each file carries the shared cast (drugs, facilities, statuses); it is the same block in every
  board, so a value appearing there does not mean that board displays it.

A board whose file is one wide frame holding several labelled panels is a **state set** — one
screen in several states, side by side, with a caption under each panel saying what the state is
there to prove.

## The board index

`canvas.json` holds the layout, the row titles and three notes worth reading — one is the
approval note, one is about G1/G10 on the Today screen, one is about the consent gate.

| Board file | What it shows | Size |
|---|---|---|
| `Landing.dc.html` | L1 · الصفحة الرئيسية (جوال) | 390×2560 |
| `Landing1440.dc.html` | L1 · الصفحة الرئيسية ١٤٤٠ | 1440×1180 |
| `SignInStates.dc.html` | A1 · حالات الدخول الأربع | 1660×640 |
| `Login.dc.html` | A1 · التحقق من الهوية | 390×844 |
| `Setup.dc.html` | A2 · الإعداد الأول — العرض | 390×844 |
| `RoleChooser.dc.html` | A1b · اختيار الدور | 390×844 |
| `SessionGate.dc.html` | A0 · بوابة الجلسة | 390×844 |
| `Profile.dc.html` | A3 · الحساب | 390×844 |
| `TodayPlan.dc.html` | B1 · اليوم — بدون متابعة (الافتراضي) | 390×844 |
| `Main.dc.html` | B1 · اليوم — مع المتابعة | 390×844 |
| `TodayMissed.dc.html` | B1 · اليوم — جرعة فائتة | 390×844 |
| `TodayLTR.dc.html` | B1 · Today — English / LTR | 390×844 |
| `Today834.dc.html` | B1 · اليوم — تابلت ٨٣٤ | 834×1020 |
| `Medicines.dc.html` | B2 · أدويتي + تنبيه خطر | 390×844 |
| `MedicinesPast.dc.html` | B2 · أدويتي — السابقة | 390×844 |
| `Prescription.dc.html` | B3 · تفاصيل الوصفة | 390×844 |
| `AddPrescription.dc.html` | B4 · إضافة وصفة | 390×844 |
| `MedicinesDesktop.dc.html` | B2 · ديسكتوب ١٢٨٠ | 1280×860 |
| `Safety.dc.html` | C1 · السلامة | 390×844 |
| `AlertDanger.dc.html` | C2 · تعارض — قيد المراجعة | 390×844 |
| `AlertReviewed.dc.html` | C2 · تعارض — تمت المراجعة | 390×844 |
| `DrugCheck.dc.html` | C3 · فحص دواء بالصورة | 390×844 |
| `Refill.dc.html` | D1 · تجديد الوصفات | 390×844 |
| `More.dc.html` | المزيد — قائمة الشِل | 390×844 |
| `Calendar.dc.html` | E1 · مزامنة التقويم | 390×844 |
| `Activity.dc.html` | E2 · سجل الأحداث | 390×844 |
| `Settings.dc.html` | E3 · الإعدادات | 390×844 |
| `Help.dc.html` | E4 · المساعدة | 390×844 |
| `Messaging.dc.html` | E5 · ربط المحادثة | 390×844 |
| `NotifyStates.dc.html` | E5 · إشعارات المتصفح — الحالات الأربع | 1660×660 |
| `InviteConsent.dc.html` | F0 · شاشة الموافقة ★ | 390×844 |
| `InviteStates.dc.html` | F0 · قبول · رفض · منتهية | 1240×620 |
| `Caregivers.dc.html` | F1 · مقدّمو الرعاية (كل الحالات) | 390×844 |
| `InviteMasked.dc.html` | F1 · الدعوة بخطوتين + الاسم الماسك | 1240×660 |
| `CaregiverHome.dc.html` | F2 · شاشة مقدّم الرعاية | 390×844 |
| `CaregiverPlan.dc.html` | F2 · والمريض مطفّي المتابعة | 390×844 |
| `CaregiverDetail.dc.html` | F3 · وصول التفاصيل | 390×844 |
| `CaregiverProfile.dc.html` | F4 · ملفه وإشعاراته | 390×844 |
| `CaregiverHelp.dc.html` | F5 · مساعدته | 390×844 |
| `ClinicEntry.dc.html` | X0 · دخول العيادة | 390×844 |
| `ReviewerQueue.dc.html` | G1s · قائمة التعارضات | 390×844 |
| `FieldQueue.dc.html` | G3s · تأكيد حقول الوصفات | 390×844 |
| `ReviewerDecision.dc.html` | G2s · قرار المراجع | 390×844 |
| `ReviewerDesktop.dc.html` | G2s · قرار المراجع + سياق المريض ١٢٨٠ | 1280×880 |
| `AuditLog.dc.html` | X1 · سجل التدقيق | 390×844 |
| `AuditLog1440.dc.html` | X1 · سجل التدقيق ١٤٤٠ ★ | 1440×900 |
| `States.dc.html` | فاضي · تحميل · خطأ | 1240×844 |
| `SystemPages.dc.html` | H1 · H2 · H3 | 1280×600 |

## The four boards that carry the most weight

- **`TodayPlan.dc.html`** — Today with adherence tracking **off**. This is the default for a new
  patient and the most-seen screen in the product. No status pills anywhere, including on the
  08:00 doses that are already in the past at the frozen reference time.
- **`InviteConsent.dc.html`** — the caregiver consent gate. Nothing of the patient's record is
  visible before acceptance, and accept/decline are two buttons of equal size and weight.
- **`AuditLog1440.dc.html`** — the demo's proof moment: the log filtered to dose-status writes,
  every actor `adherence_agent` or `system`, none from the interface.
- **`NotifyStates.dc.html`** — all four browser-notification permission states, including the
  honest iOS "add to Home Screen first" path.

## Sizes

Every screen has a board at **390**. Wider boards exist only where the layout actually changes —
Today at 834, My Medicines at 1280, the reviewer decision at 1280, the audit log at 1440, the
landing page at 1440. Everything else follows the breakpoint rules in
`../design-system/navigation.md`: tab bar on phone, side rail from 834, persistent side
navigation and a ~880px content cap on desktop.

One board is English/LTR (`TodayLTR.dc.html`) to show the mirroring: chevrons flip, capsules and
clocks and numerals do not.

## If a board and the spec disagree

`../Acceptance Criteria and Test Plan.md` wins, and the board is wrong. They were reconciled
deliberately, so expect agreement — but raise it in `docs/DECISIONS.md` if you find one.

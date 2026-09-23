# Jur'ah (جرعة) — repository instructions

An AI-powered medication-safety platform for patients in Kuwait. University capstone project.
**Phase 1 is the frontend only.** Do not build a backend, a database, a real bot or real web push.

## Read before you write code

The binding documents live in `/docs`. In this order:

1. `docs/Project Brief.md` — the product and why it is shaped this way.
2. `docs/Acceptance Criteria and Test Plan.md` — **the binding specification.** It owns the screen
   count, the role model, the route structure and the Data Contracts. Every "Pass criteria" and
   "Non-negotiable invariant" in it is a hard requirement.
3. `docs/UX Principles.md` — **binding.** A screen that meets its functional criteria but breaks a
   rule here is not finished. Run its twelve-point checklist against every screen.
4. `docs/Seed Dataset.md` — the canonical data. **Never invent seed values.**
5. `docs/Design System Foundations.md` — tokens, the twenty built components, the eleven pending.
6. `docs/Master Prompt — Phase 1.md` — how this build is planned, delegated and verified.
7. `docs/Phase 2 — Backend Handoff.md` — **section 3 only** during Phase 1: it specifies
   `docs/BACKEND-NOTES.md`, which you write *as you go*, not at the end.

8. `docs/wireframes/` — **the approved layout for every screen.** 48 artboards, one per screen
   (plus state sets). Read its `README.md` first: the files are layout references, not runnable
   pages, and each one names the exact component and props to use. Build to these.
9. `docs/design-system/` — the design system, offline: the brand book, `navigation.md` (how the
   screens connect), `tokens.json` (every value with its usage note), `index.d.ts` (every
   component's props) and `components/<Name>.md` (per-component rules). You never need to open
   the published artifact to port a component.

`docs/Build Prompts.md` (design-system and design prompts) and `docs/AI Agents Acceptance
Criteria.md` (the other track) are context, not your work.

## The nine rules that are never negotiable

1. **Nothing in the interface may record a dose status.** No button, checkbox, swipe, long-press,
   context menu **or notification action** may create or change `Dose.status`. Adherence is
   recorded only in the patient's chat with the Adherence Agent — another track's code. This is
   the product's core safety claim, and the audit log exists to prove it.
2. **The chat and browser notifications are optional and off by default.** Not connected is a
   normal state, never an error, never a warning, never a blocked screen.
3. **With tracking off, doses carry no status pill** — and the pill's absence keys off
   `Dose.tracked`, **never** off the status word. In the seed data every untracked dose also reads
   `upcoming`, so a component that switches on the word looks right and is wrong.
4. **No dose is ever marked `missed` for going unanswered.** Silence is not evidence. No UI path,
   no job, no cron.
5. **A pending caregiver invitation grants zero read access, and signing in is never acceptance.**
   Only the explicit action on the consent screen (F0) moves an invitation to `active`.
6. **Never reveal whether a Civil ID has an account.** A name shown for confirmation is masked —
   first and family name in full, each middle name as its initial plus **exactly three asterisks**,
   whatever the real length. No Civil ID is ever printed back to a reader.
7. **No technical identifier reaches a screen** — no chat id, link token, push endpoint or role
   string.
8. **In the caregiver shell, write controls are absent, not disabled**, and a caregiver never sees
   more than the patient sees.
9. **`kuwaitNow()` / `kuwaitToday()` from the config module drive every time comparison.** Never
   `Date.now()` outside the config module. In production they are the real Kuwait clock (CR-064);
   in tests, local runs and previews they return `REFERENCE_NOW` from `docs/Seed Dataset.md`.

## Architecture constraints

- Next.js App Router + TypeScript + Tailwind. Locale as a route segment; `dir` set on `<html>`.
- Routes: `/[locale]` landing · `/[locale]/signin` · `/[locale]/invitation` consent ·
  `/[locale]/app/...` patient · `/[locale]/care/...` caregiver · `/[locale]/clinic/...` clinic.
  The clinic route is unadvertised **and** role-gated; the unlisted URL is filing, not security.
- **One typed async data-access layer is the seam.** No component imports mock data; no component
  contains a `fetch`. Phase 2 replaces the implementation behind that layer without touching a
  screen, so its function signatures and return shapes are a published interface.
- **One config module** holds the API base URL, the auth token, the bot handle (`@jurah_bot`, a
  placeholder — no bot exists), the push public-key placeholder and `REFERENCE_NOW`.
- Design-system components are **ported** into `components/ui/<Name>.tsx` as typed React
  components against the compiled `tokens.css`, following `docs/design-system/` — the props in
  `index.d.ts`, the rules in `components/<Name>.md`, the styles in `bundle.css`, the values in
  `tokens.json`. Never load the artifact's `bundle.js`, and never restyle a shared component
  inside a screen.
- No hard-coded hex colour, px font size or px radius in `components/` or `app/`. No CSS `left` or
  `right` — logical properties only.
- No user-facing string outside the copy catalogue.

## Working agreement

- **Completeness is the owner's highest priority.** The spec's inventory is **thirty screens plus
  three system pages**. Count it against the per-group tally at the head of the inventory; that
  number was wrong for three document revisions because nobody did.
- **Never silently change** a data contract, an invariant, a screen's scope, the role model, a seed
  value or a UX rule. Log the proposal in `docs/DECISIONS.md` — what the document says, why it is a
  problem, what you propose, what it costs, what breaks if we don't — and continue as written until
  the owner answers.
- **A component the design system lacks is reported, never invented inline.**
- **Never self-certify.** Paste the command and its output.
- Do not commit or push unless asked.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

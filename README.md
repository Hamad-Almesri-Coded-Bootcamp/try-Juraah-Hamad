# جرعة · Jur'ah

An AI-powered medication management and safety platform for patients in Kuwait — and for the
family members who look after them and the clinicians who review safety findings.

Capstone project, SACGC AI for Coding. Kuwait (public + private healthcare mix).

**The problem it exists for:** a patient leaves a public hospital with one prescription and a
private clinic with another. Neither system can see the other's. Nobody catches the interaction.
Jur'ah puts both in one record, builds the day's schedule from them, screens the whole profile
continuously, and stops every danger finding at a human reviewer.

---

## Where things stand

| | |
|---|---|
| **Documents** | complete — `/docs`, nine binding files, all on spec v7.3 |
| **Design system** | 20 of 31 components built, tokens and navigation current |
| **Wireframes** | complete — 48 artboards, every screen in the inventory |
| **Seed data** | written — one canonical cast, frozen clock |
| **Phase 1 (frontend)** | not started — this repository |
| **Phase 2 (backend)** | planned, not started — `docs/Phase 2 — Backend Handoff.md` |
| **AI agents** | separate track — `docs/AI Agents Acceptance Criteria.md` |

**Scope:** thirty screens plus three system pages, across four surfaces (public landing page,
patient shell, caregiver shell, unadvertised clinic shell) and four roles (patient, caregiver,
medical reviewer, system admin).

---

## Start here

1. Read **`CLAUDE.md`** — the nine non-negotiable rules and the architecture constraints. Every
   Claude Code session in this repository picks it up automatically.
2. Read `/docs` in the order that file lists.
3. Paste **`docs/Master Prompt — Phase 1.md`** to begin. It stops at **Gate 0** with a plan,
   `docs/SCREENS.md` and `docs/ROLES.md` for review before any code is written.

## The documents

| File | What it is |
|---|---|
| `docs/Project Brief.md` | The product, the three audiences, the safety principles, the decisions and why. |
| `docs/Acceptance Criteria and Test Plan.md` | **Binding.** Screen inventory, role model, routes, Data Contracts, invariants G1–G12, both phases' criteria. |
| `docs/UX Principles.md` | **Binding.** Fifteen interface principles and the twelve-point per-screen checklist. |
| `docs/Seed Dataset.md` | The canonical cast: nine people, nine prescriptions, the frozen `REFERENCE_NOW`, and what each record proves. |
| `docs/Design System Foundations.md` | Tokens, components built and pending, identity display, the wireframe canvas's coverage. |
| `docs/Master Prompt — Phase 1.md` | The prompt that runs Phase 1: lead plans, Sonnet subagents implement, review gates. |
| `docs/Phase 2 — Backend Handoff.md` | The seam model, the `BACKEND-NOTES.md` contract, and the single Phase 2 prompt. |
| `docs/Build Prompts.md` | The design-system component prompt and the screen-design prompt. |
| `docs/AI Agents Acceptance Criteria.md` | The other track's test plan. Context only for this repository. |

Files Phase 1 will add: `docs/PLAN.md`, `docs/SCREENS.md`, `docs/ROLES.md`, `docs/DECISIONS.md`
and `docs/BACKEND-NOTES.md`.

Reference folders: `docs/wireframes/` (48 boards) and `docs/design-system/` (tokens, component
props and per-component rules).

## The visual references

**They are in this repository — you do not need anything outside it:**

| Folder | What it is |
|---|---|
| `docs/wireframes/` | 48 artboards covering every screen, with a README on how to read them. The approved layout. |
| `docs/design-system/` | The brand book, `navigation.md`, `tokens.json`, `index.d.ts`, `bundle.css` and 20 per-component guides. Enough to port every component offline. |

The same material is also live as private Claude artifacts on the owner's account, which is where
it gets edited and where the boards can be seen rendered:

- **Jur'ah — جرعة** (design system): tokens, 20 components with previews and guidelines,
  `navigation.md` with the full entry/exit table.
  `https://claude.ai/artifact/CjZzirza9E9CUPcchGoKtH`
- **Jur'ah Wireframes** (48 artboards): every screen at 390, wider boards where the layout
  changes, one English/LTR board, multi-panel boards for the state sets.
  `https://claude.ai/artifact/8fp4Hv9Q8LZuJvSEf1esMB`
- **Jur'ah Journey Map** (13 flowcharts): the whole user journey, all four roles.
  `https://claude.ai/artifact/Hfgo9Vz4DueYYx3Apj1LxF`

## Still owed by the project owner

1. The real `sourceCitation` for the Warfarin × Ibuprofen finding — the screens show it verbatim
   to a clinician, so it must be genuine.
2. The bilingual copy deck.
3. The demo script.
4. The real Telegram bot handle when one exists (`@jurah_bot` is a placeholder).
5. Two Phase 2 decisions: Supabase or plain Postgres, and route handlers or a separate service.

## The demo's closing move

Open the admin audit log, filter it to dose-status writes, and show that every one came from
`adherence_agent` or `system` — and **none from the interface**. That turns the core safety claim
from a sentence into displayed evidence.

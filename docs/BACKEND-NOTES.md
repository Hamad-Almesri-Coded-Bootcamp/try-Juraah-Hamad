# Jur'ah (جرعة) — BACKEND-NOTES (the Phase 1 → Phase 2 handover)

**Specified by** `Phase 2 — Backend Handoff.md` §3. **Written during Phase 1, not after:** every work package appends its fragment under `docs/backend-notes/<package>.md` and the lead merges it here at each gate. Phase 1 is not finished while any of the seven sections is incomplete. `scripts/notes-check.ts` checks the headings and, once `lib/data/api.ts` exists, that §1 and §5 carry a row for every data function.

## 1. The data-access surface

*One table: name · arguments and their types · return type · which screens call it · one line on what it is for. Filled by WP1 from `docs/SCREENS.md`'s appendix (5 session functions, 50 data functions).*

## 2. Where the mock cheated

*One row each: what the mock does now · what the backend must do instead · what breaks if it is missed.*

| Mock behaviour | Backend must | If missed |
|---|---|---|
| `REFERENCE_NOW` is a constant in `lib/config.ts`; the mock session, the schedule and every "is this past" decision read it (WP0) | decide before WP4 of Phase 2 whether the demo keeps a seeded clock offset or generates relative to the real clock (`Phase 2 — Backend Handoff.md` §6.2) | the seed's dose tables stop matching the screens on demo day |
| The session is an httpOnly cookie written by the mock `signIn` after a client-side countdown (WP0/WP1) | issue a real session server-side after the identity provider approves; never trust a client-supplied role | a client could mint a role |
| The service worker (`public/sw.js`) caches the shell and has a push handler but no subscription exists and no key is real (WP0) | VAPID keypair, subscription endpoint stored server-side, payloads with no `actions` | notifications never arrive, or worse, arrive with a clinical action |

## 3. Rules that are currently absences, and must become refusals

*For each: the invariant · how Phase 1 satisfies it · what the backend must reject · the exact call that proves the rejection.*

| Invariant | Phase 1 satisfies it by | Backend must reject | Proving call |
|---|---|---|---|
| G1 — no Dose.status write from any user session | there is no data function that writes a dose status (guard 4 scans `lib/data/api.ts` for one) and no control renders one | any write to `Dose.status` from a patient, caregiver, reviewer or admin session | attempt a dose-status write with each role's session; expect refusal |
| G12 — no notification carries a clinical action | `public/sw.js` sets no `actions` on any notification (guard 4 checks the file) | a push payload carrying an action | send a payload with `actions`; expect it stripped or refused |

## 4. Fields a screen depends on

*Which contract fields have a screen that renders nothing sensible without them (→ NOT NULL), and which are genuinely optional. Filled by WP1 from `docs/SCREENS.md`.*

## 5. The shapes, verbatim

*For each data function, one real example of what the mock returned — printed by `scripts/print-shapes.ts` (WP1), never retyped.*

## 6. Deferred to Phase 2 by design

*Each with the file and line where the placeholder sits.*

| Deferred | Where the placeholder sits |
|---|---|
| Real web push subscription and VAPID keys | `lib/config.ts` `PUSH_PUBLIC_KEY`, `PUSH_IS_SIMULATED`; `public/sw.js` push handler |
| The real messaging bot | `lib/config.ts` `BOT_HANDLE` (placeholder `@jurah_bot`), `REAL_BOT_HANDLE` (`[TO BE SUPPLIED]`), `BOT_IS_SIMULATED` |
| Real API transport | `lib/config.ts` `API_BASE_URL`, `AUTH_TOKEN` — read by nothing in Phase 1 |
| Real identity provider (Hawiati) | `lib/config.ts` `HAWIATI_COUNTDOWN_SECONDS`; the countdown on A1/X0 (WP4 b, i) |

## 7. Things Phase 1 found out the hard way

*An honest list: what was awkward, what was asked, what a screen needed that the contract did not have.*

- Guard 4 (G1) is a static approximation: it forbids dose-status literals in object construction outside the seed and the generator, assignments to `.status` with a dose word, `actions` on notifications, and data-function names that suggest recording a dose. It cannot prove the absence of a write path the way a server refusal can — which is exactly why §3 exists. **Runtime proof beside it (owner, Gate 0b):** `tests/e2e/g1-today-tracking-off.spec.ts` signs in as حمد and asserts the B1 dose list contains zero `<button>`, zero `<input>`, zero `onClick` handlers, zero `role="button"` and zero status pills. It is red until B1 exists (WP4 bundle c); it is never skipped.
- `strengthMg` is a misnomer the contract keeps for compatibility: it holds the number in `strengthUnit`'s unit. Guard U (`scripts/guards/no-unit-conversion.ts`) forbids any arithmetic on it; Phase 2 must store and return it unconverted and never add a conversion in the API layer.
- `tokens.json` does not carry `--font-sans`, the eight type styles as CSS, or the structural constants (44px hit area, 3px ring, 880px cap) the brand book states in prose; `scripts/build-tokens.ts` emits them so `bundle.css`'s port has every variable it reads.

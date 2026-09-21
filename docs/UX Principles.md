# Jur'ah (جرعة) — UX & Accessibility Principles (binding)

**Status:** binding for every screen, every shell, every phase and every track that touches the interface. This file is not advice. A screen that meets its functional acceptance criteria but breaks a rule here is not finished.

**Who this product is for.** The primary user is an elderly patient in Kuwait managing several medications, often while unwell, often on a phone they did not choose themselves, sometimes with reduced vision, reduced fine motor control, and no tolerance for a confusing interface. The second user is a family caregiver — usually a son or daughter — checking on that patient, often in a hurry, often from somewhere else. The third is a clinician reviewing a safety finding, who needs context and speed. The fourth is whoever reads the audit log.

**The one sentence that governs the whole design:** a first-time user, with no instructions and no help, must be able to look at any screen and say what it is for and what to do next. If they cannot, the screen is wrong — however correct its data.

---

## 1. Never lost

- **One home per shell.** The patient's home is the day's schedule; the caregiver's is the patient's day; the clinician's is their queue. Every journey returns home in one action.
- **Persistent, visible navigation.** A bottom tab bar on phone, side navigation from tablet up: four destinations in the patient shell (Today · My Medicines · Safety · More), three in the caregiver shell (Today · Medicines · More), two in the clinic shell (Review · Audit). No hamburger, no hidden drawer, no gesture-only navigation. The active destination is marked by icon **and** label **and** colour — never colour alone.
- **Maximum depth of two** for anything a patient needs.
- **Always say where you are.** Every screen carries a title in the app bar, and every non-home screen a visible back affordance that returns to a predictable place — never a dead end, never out of the app.
- **Always say what day it is.** The schedule shows the selected date prominently, and a single obvious control returns to today.
- **Always say whose data this is.** A caregiver session carries a persistent banner naming the patient, on every screen.
- **No dead ends.** Every empty, error and not-found state offers at least one action that leads somewhere useful.

## 2. One thing per screen

- One primary action per screen, styled as the only primary button on it. Everything else is secondary or quiet.
- The primary action is reachable without scrolling at 390px wherever it fits; when it cannot, it is pinned.
- Do not stack two decisions on one screen. Split them into steps and show progress.
- A form asks for the fewest fields that make it work, and nothing optional during a flow the user must complete.
- **A choice between two legitimate paths is drawn as two equal options**, not one button and one grey link. This applies to the role chooser, the setup offers, every "later", and accept/decline on a consent screen.

## 3. Plain language

- Everyday Arabic, in the register the Adherence Agent speaks — not formal MSA, not clinical prose. English copy is plain too.
- No medical jargon, no Latin abbreviations (no "PRN", "BID", "q.d."), no English words transliterated into Arabic where an Arabic word exists.
- **Fixed vocabulary, everywhere.** Four words for dose status, two for sector, three for review state. The same concept never appears under two different words.
- Doses read as a human would say them: the drug, the amount with its unit, the time. Never a bare number.
- Dates are written out, and both digit styles render correctly in Arabic layouts.
- Nothing important is phrased as a negation or a double negative.
- **No technical identity is ever shown.** A user is told "your notifications are on" or "your Telegram is connected" — never a chat id, a link token, a push endpoint or a role string.
- **No other person's identity is shown in full.** Where a name must be confirmed, it is masked — first and family names in full, middle names as initials, and **always three asterisks** rather than the real length: `عبدالله م*** ع*** المطيري`. And nothing anywhere reveals whether a Civil ID has an account: the same wording is used either way.
- **A failure that is not the user's fault says so.** A Civil ID with no invitation is told that nobody has linked them yet and what to do about it — never that the number is wrong.

## 4. Made for imperfect hands and eyes

- Body text is 17px and never smaller than 14px anywhere. The design system's type scale encodes this.
- The layout survives OS text scaling to **200%** without clipping, overlapping or losing a primary action.
- Minimum touch target 44×44px; 48×48 for primary actions; at least 8px of clear space between adjacent targets.
- **Every action has a visible control.** No swipe-to-act, no long-press-only menu, no drag-and-drop, no hover-only affordance, no gesture the user must discover.
- Line length stays readable — roughly 70 characters maximum.
- Contrast: 4.5:1 for body text, 3:1 for large text, control outlines and focus rings.
- Colour is never the only carrier of meaning. Success is teal, kept off the red–green axis.

## 5. Always responsive, never silent

- Visible feedback within 100ms of every tap.
- Loading uses a skeleton shaped like the content that is coming — never a spinner on an empty page, never a blank screen.
- Long operations (photo analysis, a submitted request, a link confirming, a permission prompt) say what is happening and roughly how long.
- Nothing appears or disappears without explanation. If the schedule changed because a dose was reported missed, the screen says so.
- No timeout takes the user's place away. The timed things — the Hawiati approval, the link confirmation — explain themselves, resolve or expire visibly, and can be retried.
- Motion is brief (≤200ms on navigation), respects `prefers-reduced-motion`, never autoplays.

## 6. Mistakes are the design's fault, not the user's

- An error says, in one plain sentence: what happened and what to do now, and it offers the action.
- Never a raw error code, a stack trace, a bare "something went wrong", or wording that blames the user.
- Validation is specific, sits next to the field, and never clears what was typed.
- **A mistake with consequences for someone else gets a confirmation step, not a warning label.** Typing another person's Civil ID is the clearest case: the app shows a masked name and asks "is this them?" before anything is created, and the other person still has to accept.
- Consequential and irreversible actions — revoking a caregiver, unlinking yourself, disconnecting a channel, submitting a refill, a reviewer's decision, returning a prescription to a clinic — confirm first and name the consequence. Ordinary navigation never asks for confirmation.
- Offline or a failed refresh shows the last known data with a clear "as of" line, never an empty screen.

## 7. Empty states teach

Every empty state says why it is empty and what will fill it, and offers the one action that applies. A patient with no channel connected is told what that means for them and how to change it — not left with a feature that quietly does nothing.

## 8. Safety copy has a fixed shape

Any danger-severity finding, wherever it appears — in the app, in a caregiver's view, in a notification body — answers three things in this order:

1. **What the risk is**, in plain words — not "interaction detected".
2. **What to do right now** — and if the answer is "don't change anything yet", it says that explicitly.
3. **Who is checking it** — that a doctor or pharmacist is reviewing, while `pending_medical_review` holds.

A pending finding never reads as resolved, and a resolved one never hides who resolved it.

The reverse also holds: the app never manufactures alarm. Warnings and info findings are visibly lower weight than danger, `danger` never exceeds 5–10% of a screen's area, and a preference, permission, invitation or connection notice is information — never an alert.

## 9. The app never asks the user to do the system's job

- The patient is never asked to confirm a dose in the app. Adherence is recorded only through the Adherence Agent's conversation, for those who opted in. Screens display dose status; they never offer to change it.
- **This holds hardest where tracking is off**, which is exactly where a "log it here" control feels most reasonable, and still forbidden. What the screen offers instead is the honest thing: a way to turn tracking on.
- The patient is never asked to reconcile two conflicting instructions themselves — that is the reviewer gate's job.
- Nobody is asked for data the system already has, or to type an identifier the system should obtain for itself.

## 10. The caregiver sees the truth, and only the truth

- A persistent banner names whose data is open, on every screen of a caregiver session. A caregiver must never mistake the patient's information for their own.
- **Access is consent-gated, not address-gated.** Being invited shows nothing; only accepting opens the door (see §15).
- **Write controls are absent, not disabled.** A greyed-out button tells a caregiver the app is broken; an absent one tells them the truth about their access.
- **A caregiver never sees more than the patient sees.** If the patient has tracking off, the caregiver sees the same plan and the same explanation — not a fuller picture.
- **And never less than they need.** A caregiver who can see that something is wrong must be able to open it: the prescription detail, the alert detail and the activity feed are all reachable read-only. A view that shows alarm without detail is worse than no view.
- Their own settings — notifications, unlinking themselves, signing out — are theirs, and changing them never touches the patient's.

## 11. Accessible to assistive technology

- Every interactive element has an accessible name matching its visible label.
- Keyboard focus is always visible and follows the reading order of the current direction.
- Dynamic changes — a countdown, an analysing state, a link confirming, a permission result, a saved confirmation — are announced politely.
- `lang` and `dir` are set correctly, and mixed Arabic/Latin content (drug names) is marked so it is read correctly.
- Nothing carries meaning only through an icon with no label, a colour, a placeholder or a tooltip.

## 12. Bidirectional by construction

- Arabic RTL and English LTR are equal first-class layouts, built with CSS logical properties only.
- Directional things mirror (back chevrons, progress). Real-world things never mirror: capsules, syringes, clocks, checkmarks, numerals.
- Switching language switches direction and copy together, from a control in the app bar reachable on every screen.
- Arabic is never uppercased and never letter-spaced as if it were Latin.

## 13. An optional feature that is off looks like a choice, not a fault

Adherence tracking, the chat connection, browser notifications and the calendar feed are all opt-in, and **off is the state most people will be in**.

- **Off is drawn neutrally.** No warning colour, no alert icon, no red dot, no badge. The `danger` token belongs to drug safety and never to a preference, a permission or an invitation.
- **Off is never a blocked screen.** Someone who declined everything reaches every other part of the app with no interstitial and no repeated prompt.
- **Say what is missing once, where it matters, in one line** — on the schedule, with a way to turn it on. Not on every screen, not on every visit, never as a modal.
- **Describe the gain, not the deficiency.** "Turn on daily check-ins to follow your doses" — not "your tracking is incomplete".
- **Declining is first-class in the flow that offers it**, the same size and weight as accepting.
- **Turning something off states the consequence and keeps the history.**
- **A feature that is off shows nothing rather than something false.** An untracked dose carries no status pill — it does not show as `upcoming` forever, and it never becomes `missed` because nobody answered.

## 14. Notifications alert; they never collect

- **Nothing is ever delivered only by a notification.** Every alert also lives in the app — the Safety tab, the schedule, the activity feed — so a blocked permission, an unlinked chat or a missed notification can never be the reason someone fails to learn about a danger-severity finding.
- **No notification carries a clinical action.** No "Taken ✓" button, no quick action, no reply affordance. Tapping a notification opens the screen that holds the full story. A notification action that records a dose is the core safety rule broken through a side door.
- **Promise only what can be delivered.** The permission prompt is explained before it is triggered, all four states are designed — not asked, granted, denied, unsupported — and on iOS Safari without an installed app the screen gives the install steps rather than claiming notifications will arrive.
- **Denied is neutral and never nagged.** Explained once, with plain instructions for re-enabling in site settings, and the app carries on.
- **A notification body is plain and complete enough to act on** — what happened, about which medication — and never contains a technical identifier. Safety-critical detail sits on the screen it points to.
- **Reminders are quiet by default.** Dose reminders are the lowest-urgency notification in the product and must never look or sound like a safety alert.

## 15. A consent screen tells the whole truth before it asks

This governs the caregiver invitation, and anything like it added later.

- **Nothing is revealed before consent.** The person deciding sees who is asking (a first name and the claimed relationship) and nothing else — no medication, no schedule, no alert, no full name, no Civil ID, no phone.
- **Say what they will be able to see, in plain words, as a list they can read in one breath** — and in the same breath **what they will never be able to do**: record a dose, change a prescription, change a setting, act for the patient.
- **Say who else finds out.** That the patient will be told they accepted.
- **Accept and decline carry equal weight.** Declining is a legitimate answer drawn as such, never a grey link, and never worded as a mistake.
- **Signing in is never consent.** Arriving at the screen grants nothing; only the explicit action does.
- **Declining is final and silent.** It reveals nothing further and offers no pressure to reconsider.
- **A decision made once is not asked again.** An expired or cancelled invitation says so plainly and offers no action.

---

## Checklist to run against every screen before calling it done

1. Can a first-time user name what this screen is for, without help?
2. Is there exactly one primary action, and is it obvious?
3. Can the user get home, and back, from here?
4. Does it hold at 390px, at 200% text scale, and in RTL?
5. Are all four states present — content, loading, empty, error?
6. Does every status carry a word or icon, not just a colour?
7. Is every target at least 44×44 with space around it, and is every action a visible control?
8. Does every error say what to do next, without blaming the user?
9. Is there any control here — including a notification action — that would change a dose status? (There must not be.)
10. Does the copy use the fixed vocabulary, in plain language, in both languages, with **no technical identifier and no other person's full name or account existence** exposed?
11. Does this screen still read correctly for someone with adherence tracking off and notifications off — complete, neutral, and never faulty?
12. If this screen belongs to the caregiver or clinic shell, or asks for consent: does it show exactly what that role may see — **nothing at all before consent** — with write controls absent rather than disabled, whose-data context always named, and accept/decline of equal weight?

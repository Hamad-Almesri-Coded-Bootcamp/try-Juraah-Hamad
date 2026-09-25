# agents/ — the AI agents track, wired to the Phase 2 backend

5 n8n workflows in `workflows/`, generated from tested source, that talk to this repository's
backend **only** through `/api/agent/**` (agent bearer) and receive Telegram replies **only**
through the app's webhook relay (CR-063). No database credential, no service key and no Telegram
Trigger in n8n.

| Workflow | Trigger | Model | Backend reads | Writes or sends |
|---|---|---|---|---|
| `agent-telegram-inbound` | `POST jurah/telegram-inbound`, from the app's relay (CR-063) | Gemini: classifies a reply, reads a prescription, asks what a photo is (AP-11) | the doses of the day and of the previous day, the active prescriptions, the alert recipients | the dose status, the recompute, prescriptions (the backend itself screens an unflagged save, AP-04/AP-10 — this workflow no longer calls the screening webhook); calls n8n `jurah/travel-check` |
| `agent-checkin-daily` | 08:00 Asia/Kuwait, and `POST jurah/checkin-now` | none | check-in eligibility, the doses of the day | nothing to the backend; sends Telegram |
| `agent-alexa` | `POST jurah/alexa` | Gemini, English free talk only | the doses of the day, who is eligible | one voice turn; a dose status (CR-108: «نسيت دواي», and a confirmed record request), plus its recompute for a miss |
| `agent-webchat` | `POST jurah/webchat`, from the app's assistant (CR-067) | Gemini picks one of the 10 `WEBCHAT_INTENTS` | the doses of the day, who is eligible | nothing to the backend; sends one dose's buttons to the patient's own Telegram |
| `agent-error` | the n8n Error Trigger (AP-18) | none | nothing | one Telegram message to the team chat, whose id Mohammad still owes |

The three further workflows in `agents/knowledge/workflows/` — `agent-extraction`,
`agent-interaction-screening-ddinter`, `agent-travel-check` — are the drug-knowledge agents,
described below and in `agents/knowledge/README.md`.

```
Telegram ──▶ app /api/messaging/telegram/webhook/{secret}   (the bot's ONE webhook)
               │  /start <token> → links the chat (unchanged)
               │  anything else → after(): relayReply → only a patient or an ACTIVE caregiver
               ▼
n8n agent-telegram-inbound  (x-jurah-secret)
   text  → GET  /api/agent/patients/{id}/doses?date=      (CR-062, tracked doses only)
         → Gemini classifies the words (intent, confidence, quote) — nothing else
         → decide (deterministic, agents/lib/adherence.js)
         → POST /api/agent/doses/{id}/status               (taken_on_time | taken_late | missed)
         → POST /api/agent/schedule/recompute              (after a recorded miss; or a discontinuation)
         → Telegram reply chosen from fixed text by what the backend ACTUALLY answered
   caregiver (any kind: text, tap, photo, document) → GET /api/agent/alert-recipients (AP-05's re-check,
         TC-AD-16) → confirmed active: a fixed reply; not confirmed: nothing sent, one log item.
         No dose read, no model, nothing written, nothing stored
   photo/document (patient) → the Orchestrator (AP-11, agents/lib/orchestrator.js): one narrow vision
         question - prescription | medicine_package | other | unsure, confidence floor 0.7
       prescription      → Gemini vision reads it → validate (agents/lib/extraction.js)
                          → POST /api/agent/prescriptions (needsReview + uncertainFields when unsure)
                          → the backend itself screens it (or holds it) before the 201 answers, and
                            says so in the body (AP-10/AP-04); an unflagged save whose outcome is
                            neither 'screened' nor 'held' -> Stop and Error, a human must look
       medicine_package  → n8n agent-travel-check (jurah/travel-check) → one fixed reply by verdict
       other             → a fixed explanation; unsure → two buttons (a prescription / a medicine box),
                           the choice remembered for 24 h, keyed by the patient's id and the message id
n8n agent-checkin-daily  08:00 Kuwait (+ POST /webhook/jurah/checkin-now for the demo)
         → GET /api/agent/check-in-eligibility → doses of the day → one message per open dose,
           three buttons each: d:<doseId>:taken_on_time | taken_late | missed
```

## Drug-knowledge agents (agents/knowledge/)

Interaction Screening on DDInter, Travel Check and app-side Extraction live in `agents/knowledge/`
(its own `npm run verify`, README and workflows). `agent-interaction-screening-ddinter` is the only
workflow on `jurah/screen-prescription` (AP-04/CR-074 retired the legacy screening that used to
share it, `workflows/agent-interaction-screening.json`). Its only caller today is the backend's own
`requestScreening` (`lib/agent-webhooks/core.ts` `screeningPayload`), after a save, an agent's save,
a reviewer's confirmation or a refill (AP-10) - no n8n workflow calls it directly any more.

## Commands

```bash
cd agents
npm run verify                                  # unit tests + build + generated-workflow checks
JURAH_API_BASE=https://tryjuraaah.vercel.app/api/agent npm run build   # what the committed workflows are built with
npm run drift                                   # committed workflows vs. the live n8n instance (docs/backend-notes/ap-01.md)
node eval/run.js                                # the data-based pass criteria the tests stub out (eval/README.md)
```

From the repo root, `npm run verify` also runs `tests/unit/agent/agents-contract.test.ts`, which
feeds every body the agents build through the backend's own validators.

## Going live — in this order

Nothing below may be typed by an assistant: every value is a secret the owner pastes.

1. **Hamad deploys** `main` and sets, server-side:
   `JURAH_AGENT_TOKEN`, `JURAH_AGENT_INBOUND_SECRET`,
   `JURAH_AGENT_INBOUND_URL=https://mohammad-aljry.app.n8n.cloud/webhook/jurah/telegram-inbound`,
   `JURAH_AGENT_CHAT_URL=https://mohammad-aljry.app.n8n.cloud/webhook/jurah/webchat` (`lib/config.ts`
   `AGENT_CHAT_URL`), and `JURAH_BOT_TOKEN` (the same bot n8n sends with).
2. **Mohammad, in n8n → Credentials**, creates four:
   - *Header Auth* "Jur'ah agent bearer": name `Authorization`, value `Bearer <JURAH_AGENT_TOKEN>`
   - *Header Auth* "Jur'ah inbound secret": name `x-jurah-secret`, value `<JURAH_AGENT_INBOUND_SECRET>`
   - the existing *Telegram* bot credential, and the existing *Google Gemini (PaLM) API* credential.
3. **Deactivate the old `agent-adherence-inbound`** (`WVwsQLwVFgeC2VHV`). Its Telegram Trigger
   holds the bot's only webhook; while it is active the app never sees a reply.
4. Rebuild with `JURAH_API_BASE`, import the files, bind the credentials:
   every `backend:` node → agent bearer; the webhooks → inbound secret; `Telegram:` nodes → bot;
   `Gemini` nodes and `Gemini: read the prescription` → Gemini. **AP-11 (the Orchestrator, `agent-telegram-inbound`
   only):** `Gemini: what is this photo?` → the SAME *Google Gemini (PaLM) API* credential as
   `Gemini: read the prescription` (no new credential); `n8n: travel check` → the SAME *Jur'ah
   inbound secret* the webhooks use (agent-travel-check, `agents/knowledge`, must already be
   imported and activated on `jurah/travel-check` - AP-11 does not import it). The old
   `n8n: screen the new prescription` node is gone (AP-04): nothing else to bind.
5. Activate each imported workflow with `POST /rest/workflows/<id>/activate {versionId}` (a
   `PATCH {active:true}` returns 200 and does nothing), and read the URLs back: `/webhook/`, never
   `/webhook-test/`.
6. **Hamad registers the app as the bot's webhook**: `setWebhook` to
   `https://<app>/api/messaging/telegram/webhook/<first 40 hex of sha256(JURAH_BOT_TOKEN)>`.

**AP-11 warning for any live export.** `agent-telegram-inbound` now holds a `$getWorkflowStaticData`
store keyed by patient id and message id, holding a Telegram **file id** per pending "which is it?"
choice (never a caption, never a chat id - rule 6/7, one-shot, 24 hours, capped at ~100). n8n's own
workflow export includes this static data. Before sharing, committing or attaching any export of
this workflow taken after it has run live, strip its `staticData` (or the `pinData`/static-data
block the export tool names) the same way `agents/scripts/drift.js` already masks the Alexa skill id
and device links - a file id is a low-value secret, but it is not this repository's to publish.

## What is proven, and what is not

Proven here: the decision layers (`agents/test`, 192 tests), every generated Code node compiles and
runs the spec's scenarios (`scripts/check.js`, `scripts/check-error-workflow.js`), and every request
body passes the backend's validators (`tests/unit/agent/agents-contract.test.ts` and
`tests/unit/agent/knowledge-contract.test.ts`, 40 tests). The backend's two new reads and the relay
were run against the real seeded database by hand (docs/DECISIONS.md CR-062, CR-063).

**Not yet proven**: anything end to end.
- Production runs the backend (D-040).
- On 2026-09-24, `agent-alexa`, `agent-checkin-daily`, `agent-interaction-screening`,
  `agent-telegram-inbound` and `agent-webchat` were active on the demo instance, and the three
  knowledge workflows were not (AP-01's read-only drift report, `docs/backend-notes/ap-01.md`).
- No end-to-end run is recorded (`docs/VERIFICATION.md` "Agents, live", AP-14).
- No accuracy threshold is measured ("Agents, accuracy", AP-15).

Extraction's ≥90% accuracy target needs the ≥10 ground-truth samples; none exist.

## Voice — Alexa / Echo Dot (demo)

`agent-alexa` answers an Alexa custom skill in **Arabic (ar-SA, Gulf)** and **English (en-US)**:
«شنو جرعتي الجاية؟» · «كم آخذ؟» · «شنو أدويتي اليوم؟» · «نسيت دواي». Alexa's own NLU picks the intent
from `agents/alexa/interaction-model.*.json`; `agents/lib/voice.js` builds every word from
`GET /api/agent/patients/{id}/doses`. In English, free talk (`FreeTalkIntent`, CR-070) sends the
sentence to Gemini, which only names the intent and, for a record request, the doses the patient
meant; `agents/lib/voice-actions.js` does the rest.

**Voice records a dose through the adherence agent's own route** (CR-108, the owner, 2026-09-25,
superseding CR-073/CR-101). «نسيت دواي» names the most recent of today's tracked doses whose time
has passed and is still open, and the workflow's plan node (`agents/scripts/build.js`) records it
missed - the status write first, and its recompute only after that write answers 200, run after
Alexa has already answered so the recompute never sits inside her 8-second budget. Alexa then says
"I recorded it as missed and sent it to your Telegram" («سجّلتها إنها فاتتك وأرسلتها لك في
تيليقرام»), and the patient's own Telegram chat gets "From your Alexa: I recorded ‹drug› ‹HH:MM› as
‹word› ✖. Not right? Tap the right one 👇" with three **correction** buttons (`c:<doseId>:<word>`,
which - unlike the plain `d:` buttons - may overwrite an already-recorded status with a *different*
word only; CR-081/D9, the audit trigger records every change). Any OTHER passed, still-open dose
keeps today's plain buttons. A write that does not answer 200 (a refusal, a timeout, a thrown error)
is never spoken or sent as recorded - fail closed: Alexa says she could not record it, and sends
today's plain buttons instead. No dose has passed yet: today's reply, unchanged. No Telegram linked:
the dose is still recorded, and Alexa says the chat is not linked (no message is sent).

A record request ("mark it taken", "I took my Eltroxin", "I took the first two and missed the
third") is read back - "I will record: ‹dose(s)›. Shall I? Say yes, or no." - and needs a "yes"
(`AMAZON.YesIntent`, the pending list carried in Alexa's session attributes); "no" records nothing.
"Yes" re-checks the SAME list against FRESH doses (a dose recorded, no longer due, or a tampered
prescriptionId since the read-back is skipped, never written) before writing anything, exactly the
Telegram path's own two calls. A request naming no dose ("mark it taken") is read back as the one
dose due now (open, and due - a miss only from its own time on, anything else up to an hour early);
more than one candidate is refused as ambiguous, never guessed. If the model gave nothing usable at
all (an outage), the AP-02 button fallback stands: the due doses' buttons go to Telegram instead of
a read-back. The Arabic skill has no free talk, so its model carries a slotless `RecordDoseIntent`
(«سجل الجرعة», «خذيت دواي», «خذيت الأولى والثانية وفاتتني الثالثة»): no model runs for it, and it is
read back as "the one dose due now, taken" - a mixed report must be corrected with «لا» (CR-108
added the ar-SA `AMAZON.YesIntent`, below). After a confirmed write, Alexa says "Done. I recorded:
‹dose(s)›. I sent it to your Telegram." and the same kind of correction notice goes to the chat.

The two write nodes are named `backend: record the status` and `backend: recompute`, never retried
(a retry could write twice) and `onError: continueRegularOutput` (a timeout or network error arrives
as an item with no `statusCode` at all - read as not recorded, never a stopped execution that leaves
Alexa unanswered). `scripts/check.js`'s `assertVoiceCalls` asserts the workflow makes exactly these
five calls (the three AP-02 reads and these two writes), that neither write node names a literal
`/doses/` or `/schedule/` URL (only the resolved `$json.url` expression does), that both fail closed
and that the graph feeding each write is exactly one path - computed from the workflow's own
connections, never assumed from a node's name - and shows that assertion going red on copies edited
to break any of it (a third write node, a literal URL, a mis-wired feed, `onError`/`retryOnFail`
dropped, ...).

**The screen follows the voice, page only** (CR-069, amended by CR-102). After Alexa has already
replied, `agent-alexa` POSTs `{topic, language, reply}` to
`/api/agent/patients/{id}/voice-turns`. The signed-in patient's own open app polls every 2.5 s
(`features/assistant/AssistantLauncher.tsx` `VOICE_POLL_MS`) and moves the page only: `next_dose`,
`dose_amount` and `today` go to Today; `forgot` and `record` go to Activity; `launch`, `unclear` and
`bye` go nowhere (`lib/assistant/core.ts` `PAGE_FOR_VOICE`). The assistant panel never opens by
itself, and no words Alexa spoke appear anywhere in the app.

## What to say

Both languages share one invocation name family: **"medicine helper"** (en-US) and **«مساعد جرعة»**
(ar-SA), from `agents/alexa/interaction-model.*.json`.

**Opening the skill** with no question yet ("Alexa, ask medicine helper", or «مساعد جرعة» in Arabic)
is answered with the greeting alone, "Hi, Jur'ah AI. How can I help?" / «هلا، معك جرعة AI. شلون أقدر أساعدك؟»
(CR-106). The session stays open for the question with the same reprompt, and "help" (or a question
Alexa did not understand) still lists the four questions.

**English (`interaction-model.en-US.json`).** `NextDoseIntent`, `DoseAmountIntent`,
`TodayDosesIntent` and `ForgotDoseIntent` each carry their own sample list, plus `FreeTalkIntent`:
one `AMAZON.SearchQuery` slot behind 24 carrier words — mark, record, log, set, update, check,
change, note, I, I want, I need, can you, could you, please, tell me, what, when, how, is, did, my,
the, show me, for — with `fallbackIntentSensitivity` set to LOW. `quickFreeTalk`
(`agents/lib/voice-actions.js`) answers a plain next-dose, how-much or today question with no model
call, and "what are my medicines today" and its variants (`TODAY_ASKED`) always get today's list
without one. A plain "I forgot my dose"/"I forgot my medicine" sentence is answered in code too
(`FORGOT_ASKED`) - straight to `ForgotDoseIntent`, so the model's ~5 s never sits in front of a
forgot turn's one write. A sentence naming what the patient did ("I took my Eltroxin", "the 7 am one
I took late") is read back by name and needs a "yes"; a sentence naming no dose ("mark it taken") is
read back as the one dose due now; either way "no" records nothing, and the list is re-checked
against fresh doses before anything is written. If the model gives no usable answer at all (an
outage, a timeout, an intent outside the list), the AP-02 button fallback stands: the buttons go to
Telegram instead of a read-back.

**Arabic (`interaction-model.ar-SA.json`) has no free talk.** `NextDoseIntent` (24 samples),
`DoseAmountIntent` (17 samples), `TodayDosesIntent` (19 samples) and `ForgotDoseIntent` (17 samples)
each carry a plain sample list, and `RecordDoseIntent`'s 15 samples («سجل الجرعة», «خذيت دواي»,
«خذيت الأولى والثانية وفاتتني الثالثة» and twelve more) map straight to a record request that names
no dose: no model call, read back as "the one dose due now, taken", confirmed with «إي» / «أيوه»
(CR-108's `AMAZON.YesIntent`) or cancelled with «لا». A mixed report («خذيت الأولى والثانية وفاتتني
الثالثة») is still read back this same way, so the patient must correct it with «لا» if it is wrong
- the samples stay on the intent on purpose (removing them risks the sentence falling to
`ForgotDoseIntent` instead and recording a miss with no confirmation at all).
AP-17 added two Fusha-register samples to the ar-SA model (CR-071 item viii): «متى الجرعة القادمة»
(`NextDoseIntent`) and «ماذا في جدول أدويتي اليوم» (`TodayDosesIntent`). Alexa otherwise keeps the
Kuwaiti register in both languages (CR-079/D7 — the app's own Fusha rule covers what the app
displays, not Telegram or Alexa).

Setup (the Amazon account the Echo is registered to):
1. developer.amazon.com → Alexa → Create Skill → Custom, "Provision your own", primary language
   **Arabic (SA)**; then Language settings → add **English (US)**.
2. Build → JSON Editor → paste `interaction-model.ar-SA.json` (and the en-US one in English) → Build.
   Paste and build again whenever a model file changes (AP-02 added the ar-SA `RecordDoseIntent`;
   AP-17 later added its two Fusha samples; CR-108 added the ar-SA `AMAZON.YesIntent` - "What to
   say" above).
3. Endpoint → HTTPS → `https://mohammad-aljry.app.n8n.cloud/webhook/jurah/alexa`, certificate
   option "a sub-domain of a domain that has a wildcard certificate" — the host serves
   `*.app.n8n.cloud` (Google Trust Services), checked 2026-09-23.
4. Test tab → **Development**. Copy the skill id (`amzn1.ask.skill…`).
5. The skill id and the device's Alexa `userId` → `pt-03` are set inside the live n8n node
   `alexa request (deterministic)` — the repository ships both empty, so it fails closed.
   **Live-only config:** every rebuilt `agent-alexa.json` still ships `const ALEXA_SKILL_ID = '';`
   and `const ALEXA_LINKS = {};` (asserted by `scripts/check.js`). Publishing it wipes the live
   values, so whoever publishes re-enters both in that node before activating, then runs the drift
   check (`npm run drift`, which masks the two lines and never prints them).

Known demo limits: Alexa's request **signature** is not verified (the skill id, a 150-second
timestamp window and the userId link are); certification would need it. There is no OAuth account
linking — one device is linked by hand. The signature gap and the two build options for closing it
are CR-104 (`docs/DECISIONS.md`) and `docs/backend-notes/ap-18.md`. CR-108 (2026-09-25) makes this
gap guard a WRITE path, not only a read: a caller who knows the skill id and a linked device's
`userId` can record a miss for that patient (never another patient's - the session's own pending
list only ever resolves against that patient's own open, due doses). An Echo also cannot tell who is
speaking, so anyone in the room can say "I forgot my medicine" with no confirmation at all; the
Telegram correction notice and its buttons are the only check. Both are accepted, disclosed demo
limits (docs/DECISIONS.md CR-108), not bugs.

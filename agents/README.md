# agents/ — the AI agents track, wired to the Phase 2 backend

Three n8n workflows, generated from tested source, that talk to this repository's backend **only**
through `/api/agent/**` (agent bearer) and receive Telegram replies **only** through the app's
webhook relay (CR-063). No database credential, no service key and no Telegram Trigger in n8n.

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
```

From the repo root, `npm run verify` also runs `tests/unit/agent/agents-contract.test.ts`, which
feeds every body the agents build through the backend's own validators.

## Going live — in this order

Nothing below may be typed by an assistant: every value is a secret the owner pastes.

1. **Hamad deploys** the `ai-agents` branch (or `Backend` once merged) and sets, server-side:
   `JURAH_AGENT_TOKEN`, `JURAH_AGENT_INBOUND_SECRET`,
   `JURAH_AGENT_INBOUND_URL=https://mohammad-aljry.app.n8n.cloud/webhook/jurah/telegram-inbound`,
   and `JURAH_BOT_TOKEN` (the same bot n8n sends with).
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
5. Activate all three with `POST /rest/workflows/<id>/activate {versionId}` (a `PATCH {active:true}`
   returns 200 and does nothing), and read the URLs back: `/webhook/`, never `/webhook-test/`.
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

Proven here: the decision layers (`agents/test`, 36 tests), every generated Code node compiles and
runs the spec's scenarios (`scripts/check.js`), and every request body passes the backend's
validators (the contract test). The backend's two new reads and the relay were run against the
real seeded database by hand (docs/DECISIONS.md CR-062, CR-063).

**Not yet proven**: anything end to end — the backend is not deployed, so no n8n node has called it.
The Telegram inline-keyboard and file-download node parameters follow n8n 1.x's schema but have
not been imported yet; check them on import. Extraction's ≥90% accuracy target needs the ≥10
ground-truth samples; none exist.

## Voice — Alexa / Echo Dot (demo, read-only)

`agent-alexa` answers an Alexa custom skill in **Arabic (ar-SA, Gulf)** and **English (en-US)**:
«شنو جرعتي الجاية؟» · «كم آخذ؟» · «شنو أدويتي اليوم؟» · «نسيت دواي». Alexa's own NLU picks the intent
from `agents/alexa/interaction-model.*.json`; `agents/lib/voice.js` builds every word from
`GET /api/agent/patients/{id}/doses`. In English, free talk (`FreeTalkIntent`, CR-070) sends the
sentence to Gemini, which only names the intent and, for a record request, the doses the patient
meant; `agents/lib/voice-actions.js` does the rest.

**Voice never records a dose** (CR-073, which reverses the recording in the agents entry CR-070;
CLAUDE.md rule 1, TC-AD-14/15). An Echo cannot tell the patient from anyone else in the room, and a
dose status comes only from the patient's own chat. «نسيت دواي» says which dose passed and what is
next, then sends that dose's three buttons to the patient's **Telegram**. A record request ("mark it
taken", "I took the first two and missed the third") is answered "I can't record by voice; I've sent
the buttons to your Telegram" («ما أقدر أسجّل بالصوت، أرسلت لك الأزرار في تيليقرام»), and the buttons
of the doses the patient meant (open and due; every open due dose if none was named) go to the
patient's own chat. The Arabic skill has no free talk, so its model carries a slotless
`RecordDoseIntent` («سجل الجرعة», «خذيت دواي», «خذيت الأولى والثانية وفاتتني الثالثة»): it names no
dose and runs no model, and it gets the same fixed line and the buttons of every open dose that is
due. A tap on one of those buttons in Telegram records it through the adherence path. There is no recording
switch and no write node: `scripts/check.js` asserts the workflow makes exactly two GETs (the doses
of the day, who is eligible) and the one CR-069 voice-turn POST, and no call whose URL contains
`/doses/` or `/schedule/`, and shows that assertion going red on copies edited to break it.

Setup (the Amazon account the Echo is registered to):
1. developer.amazon.com → Alexa → Create Skill → Custom, "Provision your own", primary language
   **Arabic (SA)**; then Language settings → add **English (US)**.
2. Build → JSON Editor → paste `interaction-model.ar-SA.json` (and the en-US one in English) → Build.
   Paste and build again whenever a model file changes (AP-02 added the ar-SA `RecordDoseIntent`).
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
are CR-104 (`docs/DECISIONS.md`) and `docs/backend-notes/ap-18.md`.

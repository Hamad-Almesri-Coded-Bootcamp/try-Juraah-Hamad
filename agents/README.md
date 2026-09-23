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
   photo → Gemini vision reads it → validate (agents/lib/extraction.js)
         → POST /api/agent/prescriptions (needsReview + uncertainFields when unsure)
         → n8n agent-interaction-screening, when saved and unflagged
n8n agent-checkin-daily  08:00 Kuwait (+ POST /webhook/jurah/checkin-now for the demo)
         → GET /api/agent/check-in-eligibility → doses of the day → one message per open dose,
           three buttons each: d:<doseId>:taken_on_time | taken_late | missed
n8n agent-interaction-screening  (x-jurah-secret)  { patientId, newPrescriptionId }
         → GET /api/agent/patients/{id}/prescriptions → screen (agents/lib/screening.js, no model)
         → POST /api/agent/alerts, always pending_medical_review
```

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
4. Rebuild with `JURAH_API_BASE`, import the three files, bind the credentials:
   every `backend:` node → agent bearer; the three webhooks and `n8n: screen the new
   prescription` → inbound secret; `Telegram:` nodes → bot; `Gemini` nodes and
   `Gemini: read the prescription` → Gemini.
5. Activate all three with `POST /rest/workflows/<id>/activate {versionId}` (a `PATCH {active:true}`
   returns 200 and does nothing), and read the URLs back: `/webhook/`, never `/webhook-test/`.
6. **Hamad registers the app as the bot's webhook**: `setWebhook` to
   `https://<app>/api/messaging/telegram/webhook/<first 40 hex of sha256(JURAH_BOT_TOKEN)>`.

## What is proven, and what is not

Proven here: the decision layers (`agents/test`, 36 tests), every generated Code node compiles and
runs the spec's scenarios (`scripts/check.js`), and every request body passes the backend's
validators (the contract test). The backend's two new reads and the relay were run against the
real seeded database by hand (docs/DECISIONS.md CR-062, CR-063).

**Not yet proven**: anything end to end — the backend is not deployed, so no n8n node has called it.
The Telegram inline-keyboard and file-download node parameters follow n8n 1.x's schema but have
not been imported yet; check them on import. The screening reference set holds only the two pairs
the seed already asserts, with citations `[TO BE SUPPLIED]`, and every unmatched profile goes to
the reviewer rather than being cleared — a real drug database needs the human-supplied pairs the
spec asks for. Extraction's ≥90% accuracy target needs the ≥10 ground-truth samples; none exist.

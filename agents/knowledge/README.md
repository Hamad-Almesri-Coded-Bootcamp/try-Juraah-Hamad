# agents/knowledge — Interaction Screening, Travel Check, Extraction

Waddah's drug-knowledge agents, rebuilt to run against this repository's backend. They reach it **only**
through `/api/agent/**` with the agent bearer token. There is no database credential, no fixture data
and no sub-workflow to re-select by hand after import.

```
Interaction Screening   POST  <n8n>/webhook/jurah/screen-prescription      (x-jurah-secret)
  { patientId, newPrescriptionId, language }      <- agent-telegram-inbound already sends exactly this
  <- 200 on receipt (onReceived, exactly like the workflow it replaces)
  -> GET  /api/agent/patients/{id}/prescriptions   (CR-062: active only, each with needsReview)
  -> deterministic screen (src/screening.js) on DDInter, no model
  -> POST /api/agent/alerts, once per alert        (validated first; backend answers 201 { alert })
  -> any failure, refused or withheld alert -> Stop and Error: the execution FAILS, so it shows in n8n

Travel Check            POST  <n8n>/webhook/jurah/travel-check             (x-jurah-secret)
  { patientId, imageBase64, mimeType, language }
  -> GET  /api/agent/patients/{id}/prescriptions   (the profile comes from the backend, never the caller)
  -> Gemini reads ONLY the name printed on the box ("UNREADABLE" if it cannot)
  -> deterministic check (src/travel-check.js)
  -> POST /api/agent/alerts only for a DANGER finding (pending_medical_review)
  <- { ok, mustEscalate, verdict, message, appOutcome }   appOutcome is the app's DrugCheckOutcome
  -> a danger alert the backend refused -> Stop and Error after the answer

Extraction              POST  <n8n>/webhook/jurah/extract-prescription     (x-jurah-secret)
  { patientId, imageBase64, mimeType, language, save, source? }
  -> Gemini reads the prescription into a fixed JSON schema (temperature 0)
  -> deterministic validation (src/extraction.js): unreadable critical fields are left unset + flagged
  -> save:true -> POST /api/agent/prescriptions -> if saved AND unflagged -> the screening webhook
  <- { ok, mustEscalate, appOutcome, needsReview, uncertainFields, body, saved, screening }
  -> saved + unflagged but never handed to screening -> Stop and Error after the answer
```

## What changed from the original files, and why

| Original | Now | Why |
|---|---|---|
| `data-access` returned invented patients (`pat-001`, Simvastatin…) | Deleted. Every read is `GET /api/agent/patients/{id}/prescriptions` | The spec says to test against `docs/Seed Dataset.md`, never your own patients |
| Screening returned alerts to the caller and wrote nothing | Each alert is `POST /api/agent/alerts`, and the backend's answer is reported | Otherwise no alert ever reaches the app, the caregiver or the reviewer |
| Alerts carried an `id` and no `sourceCitation` | No `id` (the backend assigns it). `sourceCitation` = the DDInter paper + both DDInter drug ids + level + retrieval date | The backend refuses both with a 422. The citation was already in `_evidence` and was being thrown away |
| `"Calcium carbonate + vitamin D3"` was one lookup key | Split into ingredients, plus exact same-molecule synonyms (vitamin D3 = cholecalciferol, paracetamol = acetaminophen) | On the real seed, سارة's Levothyroxine × Calcium carbonate (Moderate, in your index) was **missed** |
| A drug missing from the index was only noted in the run log; `alerts: []` looked clean | One `info` "cannot verify" alert, sent to the reviewer (long lists are capped in the text; the full list is in `sourceCitation`) | TC-IX-03: never a silent "no interaction" |
| `needsReview` prescriptions were screened | Excluded, listed in `excluded` (also `fieldReviewStatus` pending/returned), and when nothing else is found the alert goes to the reviewer and says N prescriptions were left out | TC-IX-06: the exclusion is visible, not silent |
| A withheld danger alert marked the run "failed" only inside its JSON | ANY alert withheld by validation, or refused by the backend, fails the n8n execution (Stop and Error) | A withheld "cannot verify" leaves the record reading clean just like a withheld danger alert |
| Whole profile screened on every run | Only pairs that include the NEW prescription. Whole-profile mode is a dry run | A re-run would duplicate the seed's `ia-001` in the database |
| DDInter "Unknown" was dropped from the output | One ungraded `info` alert to the reviewer | "Nothing found" must never be claimed for a pair the source lists |
| `warning` → `auto_cleared` | `danger` and `warning` → `pending_medical_review`; a Minor row → `info` `auto_cleared` | The seed's warning `ia-002` went through the reviewer; its `ia-003` info was auto-cleared |
| English only | Arabic (default) and English, by the patient's `language` | The product is Arabic-first; the seed's alert descriptions are Arabic |
| Travel check trusted `prescriptions` from the request body | Reads the profile from the backend | The caller must not decide what the patient takes |
| Travel check said `no_interaction_found` when a drug wasn't covered | New verdict `cannot_verify`, answered to the app as its own `cannot_verify` outcome (CR-078, AP-11b) - also for an ungraded pair, a profile the backend could not read (`profile_unavailable`), an unverified SFDA brand (`brand_not_verified`, AP-07's pending rows), or while any prescription awaits review; `needs_confirmation` and `could_not_identify` still map to the app's `could_not_identify` | "Not in our data" is not "no interaction", and reads differently from "we could not read the box" |
| A pair with no row was "no interaction" whenever both drugs were in the index | Only when one of the two drugs is in an ATC category whose DDInter file was loaded (`meta.categoryFilesLoaded`, `drugs[k].atcCategories` from the WHO ATC/DDD index). Otherwise screening raises one `info` "cannot verify" alert for the reviewer, and travel check answers `cannot_verify` (AP-06) | A DDInter category file lists the interactions of the drugs in that category. With A, B and H loaded, Ibuprofen (M) × Ciprofloxacin (J) can never be in the index, so its absence proves nothing |
| Travel check brand map loaded every row | Only `verified: true` rows. A generic box also resolves by the index's own ingredient name, exactly | Your own `pendingVerification` rule |
| "PANADOL" resolved to plain acetaminophen; "Plus"/"Forte" were stripped as form words | A bare family name with line extensions in the map asks which one (`needs_confirmation`); "Plus"/"Forte" stay part of the name; the vision prompt asks for the full product name | A Cold & Flu box read as "Panadol" would drop two ingredients from screening |
| A truncated Gemini answer was used as-is | Anything but `finishReason: STOP` is unreadable | A cut-off name is a different name |
| Extraction produced a `PrescriptionDraft`, a type the project doesn't have | Produces the exact `POST /api/agent/prescriptions` body. An unsure field is left unset + `needsReview:true`, which the backend keeps out of the schedule and screening until a reviewer confirms it | The project's version of "a draft a human must accept" |
| Extraction ignored `startDate`, `doseTimes`, `strengthUnit`, facility and sector | All read. `strengthUnit` is never assumed (rx-008 is 50 **mcg**). No start date or clock time is ever invented | They are critical or required fields. A missing unit is the 1000× levothyroxine error |
| A missing confidence counted as confident | Every value needs a numeric confidence ≥ 0.8 (the schema requires one per field); missing, a string or NaN = not sure | G7 fails closed; same threshold as Mohammad's extraction |
| A non-prescription image became a draft | Explicit failure `not_a_prescription` → `appOutcome: { kind: 'unreadable' }` | TC-EX-04 |
| Webhooks had no authentication | Header Auth (`x-jurah-secret`) on every webhook | The same secret the backend's relay and the other workflows use |
| `gemini-2.0-flash` via the LangChain node | The HTTP call and model (`gemini-3-flash-preview`) that `agents/scripts/build.js` uses | One model, one credential, one call shape across the track |
| Code nodes called `drug-knowledge` as a sub-workflow | The source is inlined into each Code node at build time | Removes the "select the workflow after import" step, which was easy to get wrong |

What stayed the same: exact-match lookup (no fuzzy accept, no vector search), the brand map's verified-only rule, the model never choosing severity or review state, fixed templates for every word, and validation before anything is sent. `data/brand-map.json` holds exactly the data in your uploaded `drug-knowledge` workflow, plus the AP-07 rows (the JSON content compared equal before AP-07; only the formatting differed). `data/interaction-index.json` started as that workflow's 19-pair slice and is now rebuilt by `scripts/build-demo-index.js` from DDInter's own files (F2, AP-06): every earlier pair kept, none changed level, 62 pairs.

## Commands

```bash
cd agents/knowledge
JURAH_API_BASE=https://tryjuraaah.vercel.app/api/agent npm run verify   # 109 unit tests + build + generated-workflow checks
npm run coverage      # each seed drug covered or not, its ATC categories, and each seed pair checkable or "cannot verify"
node scripts/build-demo-index.js --dry-run   # rebuild the index from data/build/ddinter_downloads_code_*.csv (git-ignored)
```

`npm run build` refuses to run without `JURAH_API_BASE`, so it can never write workflows that point nowhere.

From the repo root, `npx vitest run tests/unit/agent/knowledge-contract.test.ts` feeds every body these agents build, for every seed patient, through the backend's own validators. It also fails if `test/seed-prescriptions.json` drifts from `lib/data/mock/seed.ts`.

## Going live, in order

Every value below is a secret. An assistant must never type any of them; the owner pastes them.

1. The backend needs `JURAH_AGENT_TOKEN` and `JURAH_AGENT_INBOUND_SECRET` set in Vercel (DECISIONS D-040 still lists them as owed). These agents use the CR-062 read route, which is on `main` (PR #2, 2026-09-23).
2. In n8n, reuse the credentials `agents/README.md` already creates: *Jur'ah agent bearer* (Header Auth, `Authorization: Bearer …`), *Jur'ah inbound secret* (Header Auth, `x-jurah-secret`) and the *Google Gemini (PaLM) API* credential.
3. **Deactivate `agent-interaction-screening`** (Mohammad's). The new screening uses the same path, and n8n refuses to activate two workflows on one path.
4. Import the three files from `agents/knowledge/workflows/`, then bind credentials:
   - every **Webhook** node → *inbound secret*;
   - every `backend:` node → *agent bearer*;
   - `n8n: screen the new prescription` (in extraction) → *inbound secret*;
   - both `Gemini:` nodes → *Gemini*.
5. Activate all three with `POST /rest/workflows/<id>/activate {versionId}`. Check that the URLs read `/webhook/`, never `/webhook-test/`.
6. Smoke test (with the inbound secret header):

   ```
   POST /webhook/jurah/screen-prescription { "patientId": "pt-03" }
   ```

   That is a dry run, so nothing is written. It answers 200 at once. Open that execution's `summary (deterministic)` node: expect `screened: true` and one alert, the Moderate Levothyroxine × Calcium carbonate warning (vitamin D3 is Cholecalciferol, in DDInter file A, with no row for Levothyroxine).
7. In n8n settings, set an **error workflow** for these three (for example a message to the team). Every escalation fails the execution, and that is how it reaches a person.
8. **Connect the website (CR-066).** In Vercel → Settings → Environment Variables, set (not secrets — they reuse `JURAH_AGENT_INBOUND_SECRET`):
   - `JURAH_AGENT_TRAVEL_CHECK_URL` = `https://<n8n>/webhook/jurah/travel-check`
   - `JURAH_AGENT_EXTRACTION_URL` = `https://<n8n>/webhook/jurah/extract-prescription`
   - `JURAH_AGENT_SCREENING_URL` = `https://<n8n>/webhook/jurah/screen-prescription`

   then redeploy. Safety → "Check a drug by photo" now asks the travel-check agent, Medicines → Add asks the extraction agent, and every saved, unflagged prescription is screened. Leave any one empty to keep that screen's stub.

## Honest limits: what is not done, and why

- **The index is a demo slice built from three DDInter category files.** `scripts/build-demo-index.js` builds it from DDInter 2.0's own files for ATC categories A, B and H (`data/build/`, git-ignored; the owner allowed only these three). All nine seed ingredients are covered, and Warfarin × Ibuprofen is the DDInter Major row. A pair whose two drugs are both outside A, B and H cannot be in these files, so screening says "cannot verify" for it and sends it to the reviewer: in the seed that is Ibuprofen × Atorvastatin (rx-004 is discontinued, so it is not screened today). Loading another category file needs the owner's yes. `npm run coverage` lists every seed pair. No row was written by hand.
- **The seed's brand names, checked against the SFDA register (AP-07).** BRUFEN and GLUCOPHAGE were verified from the SFDA register on 2026-09-24 (`verified: true` in `data/brand-map.json`), approved by the owner (Mohammad) on 2026-09-25. MAREVAN and LIPITOR were not in the SFDA list on 2026-09-24 (`pendingVerification`, `verified: false`), stay unverified, and Travel Check refuses them.
- **A prescription confirmed by the reviewer is not re-screened automatically.** Screening runs for a NEW prescription. A flagged one is skipped until confirmed, but nothing calls screening when the reviewer confirms it. The backend's field-confirmation path should call `jurah/screen-prescription` with that prescription's id (CR-065).
- **One reading of TC-IX-02, decided (CR-077, D5: keep, a deliberate reading).** A clean result sends one `info` `auto_cleared` alert instead of no alert at all, worded exactly as `ALERT_TEXT.nothingFound` in `src/text.js`: "*drugLabel* was screened against your other medicines and no interaction is recorded in our drug-interaction database. This is not a guarantee of safety; ask your pharmacist if you are unsure." (Arabic: "تم فحص *drugLabel* مع باقي أدويتك، ولم نجد تعارضاً مسجّلاً في قاعدة بيانات التداخلات الدوائية. هذا ليس ضماناً للسلامة؛ إذا كان عندك سؤال فاسأل الصيدلي."). AP-10's "being checked" state (CR-089) reads this same marker: a prescription stops reading as being checked once an alert naming it exists, and this is the alert that closes a clean screen.
- **Repeats.** Each new prescription re-lists the old uncovered drugs in its cannot-verify alert, because those pairs really are unverifiable. Rebuilding the index removes most of it.
- **The app calls these agents only once three URLs are set (CR-066, built).** `lib/agent-webhooks` calls travel check from the drug-photo screen and extraction (`save:false`) from the add-prescription screen. Screening no longer needs a fourth call from here: once `JURAH_AGENT_SCREENING_URL` is set, `screenOrHold` (`lib/data/pg/screening.ts`) follows a patient's own save, an agent's save, a reviewer's confirmation and a refill request alike (CR-090). Each URL unset → that screen keeps its CR-049 stub. See step 8 of *Going live*.
- **Not run end to end.** None of these three workflows was active on the demo instance on 2026-09-24 (AP-01's read-only drift report, `docs/backend-notes/ap-01.md`), and no end-to-end run is recorded (`docs/VERIFICATION.md` "Agents, live", AP-14). The logic is proven by unit tests, by executing every generated Code node on the seed scenarios, and by the backend's own validators. On import, check the HTTP-node, Gemini-credential and Stop and Error parameters; they follow n8n 1.x node shapes (the HTTP/IF/Webhook ones exactly as `agents/workflows/`).
- **Extraction and Mohammad's Telegram extraction overlap, decided (D3/CR-075).** One core, `src/extraction.js`, is the extraction logic for both; `agent-telegram-inbound` inlines it rather than keeping a second implementation (AP-03, CR-098). His workflow still handles Telegram photos and this one still handles app uploads, but there is now one set of rules between them, not two.
- **Accuracy targets need real samples.** ≥90% field accuracy (extraction) and ≥80% identification (travel) are `NOT MEASURED` (AP-15) until the sets named in `agents/eval/datasets/README.md` exist (AP-08's harness, `agents/eval`); this file claims no score for either one before that.

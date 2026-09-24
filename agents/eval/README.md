# agents/eval: the evaluation harness (AP-08)

Every agents test stubs the model, so none of the spec's data-based pass criteria is measured by a
test. This harness measures them, on the human-supplied sets in `datasets/`
(`datasets/README.md` says who supplies each one and the minimum).

```
cd agents
node eval/run.js                       # every set; exit 0 only if every set is measured and passes
node eval/run.js --set adherence       # one set (repeat --set, or a comma list)
node eval/run.js --datasets <dir>      # the same <set>.json files from another folder
node eval/run.js --out results.json    # also write the results as JSON, for docs/VERIFICATION.md
node eval/run.js --smoke <file>        # a plumbing check on a file outside the repository
node eval/run.js --smoke-example       # the same, on the spec's first example reply (see below)
```

The sets that call the model (extraction, adherence, travel) read `GEMINI_API_KEY` from the shell,
send it in a request header, and never print it. The screening sets call no model.

## What "NOT MEASURED" means

A set is measured only when its data file exists, matches its schema, holds no owed-value marker
and has at least the spec's minimum. Anything else prints `NOT MEASURED: ...` and the run exits 1:

- `NOT MEASURED: <set> has <n> of <min> items` (the committed sets are empty, so today every set
  prints this);
- a missing or invalid data file, a missing image, an item that still holds the owed-value marker,
  a set that still carries its `owed` line;
- a missing `GEMINI_API_KEY`;
- **any** failed model call or workflow step. A failed call is never scored as `unclear` or as
  "not a prescription": that would count an outage as a right answer.

A smoke run (`--smoke`) scores its items the same way and prints `SMOKE OK` or `SMOKE FAILED`, but
it is **never a measurement**: it proves the plumbing, not a threshold. A smoke file inside the
repository is refused, so a smoke item can never be mistaken for a dataset item.

## Exactly what the workflow does

The harness does not re-implement an agent. It runs the committed workflow's **own Code nodes**
(read from `agents/workflows/*.json` and `agents/knowledge/workflows/*.json`) and replaces only
the model call and the backend reads.

| Set | Workflow and nodes | Scored on | Threshold |
|---|---|---|---|
| `extraction` | `agent-extraction` (D3, the one extraction core): `input (deterministic)` builds the vision request (`PROMPT`, `RESPONSE_SCHEMA`), the node's URL is called, `validate (deterministic)` turns the reading into the body it would save | the twelve core fields of that body (`facilityName`, `sector`, `genericName`, `brandName`, `strength`, `strengthUnit`, `dosePerAdministration`, `frequencyPerDay`, `doseTimes`, `dosingPattern`, `durationDays`, `startDate`); a field left unset counts as right only when the ground truth is `null` | 90% of fields, 10 prescriptions |
| `adherence` | `agent-telegram-inbound`, `Gemini: classify the reply`: the node's own prompt and schema (`agents/lib/adherence.js` `CLASSIFY_PROMPT` / `CLASSIFY_SCHEMA`, checked equal to the node's), its models in fallback order with each model node's temperature and retries, then `trustClassification` (G11) | the intent after G11 | 90%, 20 replies |
| `screening-interacting` | `agent-interaction-screening-ddinter` (D2): `input` and `screen (deterministic)`, the pair as two active prescriptions of one patient | recall: a graded interaction alert with a non-empty `sourceCitation` | 100%, 3 pairs |
| `screening-non-interacting` | the same nodes | no interaction or duplicate alert (a "cannot verify" is counted and named separately: it is not a clearance) | none in the spec: reported, 3 pairs |
| `travel` | `agent-travel-check`: `input (deterministic)` builds the vision request (`BRAND_PROMPT`), the node's URL is called, `check (deterministic)` resolves the name through the SFDA brand map | the resolved ingredients equal the expected ones | 80%, 5 photos |
| `routing` | `agent-telegram-inbound` (AP-11, the Orchestrator): `route (deterministic)` decides directly for text/tap/start; a photo or a document also runs `orchestrator: ask what the photo is` (`PHOTO_PROMPT`/`PHOTO_SCHEMA`, `agents/lib/orchestrator.js`), the node's URL is called, `orchestrator: decide (deterministic)` turns the reading into `prescription` \| `medicine_package` \| `other` \| `unsure` | the route, mapped to the set's own labels (`adherence`, `extraction`, `travel_check`, `link`, `clarify`, `caregiver_reply`, `other_reply`); an `inactive_caregiver` item is never run at all - the app's own relay (`lib/agent/inbound.ts`) decides it, recorded as `detail.decidedBy: 'relay'`; a `trackingOn: false` item is routed honestly (the relay carries no tracking state) and scores as failing until a tracking-off reply exists | 95%, 15 inputs |

Names are compared without case and extra spaces; every other field exactly. Percentages are cut,
never rounded, to one decimal, and pass or fail is decided on whole counts: 179 of 199 is 89.9%
and fails 90%.

**One difference from n8n, said beside every number.** For a Basic LLM Chain node (adherence),
n8n sends the prompt and the schema through LangChain, which puts its own format instructions for
the schema in the user turn. The harness sends the same prompt as the system instruction and the
same schema as Gemini's `responseSchema`. The words and the schema are identical; the wrapper is
not. The vision sets (extraction, travel) send the workflow's own request body unchanged.

## The real-model smoke check

The unit tests prove the harness green with an injected model. The real transport is proven by
one command in a shell that holds the key (Git Bash; the key is typed, not echoed, and unset
afterwards):

```
cd agents && read -rsp 'Gemini key: ' GEMINI_API_KEY && echo && export GEMINI_API_KEY && node eval/run.js --smoke-example; unset GEMINI_API_KEY
```

It writes the first reply of the spec's language table («خذيته», `taken_on_time`) to a new
temporary folder, sends it through the adherence contract to the real model, prints
`SMOKE OK adherence: 1 of 1 ...` and removes the folder. It costs one or two Gemini calls.

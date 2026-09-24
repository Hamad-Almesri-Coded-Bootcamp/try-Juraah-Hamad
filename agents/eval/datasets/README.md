# Evaluation sets: who supplies what

The spec forbids inventing these (`docs/AI Agents Acceptance Criteria.md`, "Notes for the
Implementing Agent"; `docs/AGENTS-POLISH-PLAN.md` section 9). Every data file here is **empty** and
carries an `owed` line with the owed-value marker, so the gate count finds it. `node eval/run.js`
prints `NOT MEASURED: <set> has <n> of <min> items` and exits 1 for every set below its minimum.

| Set | Data file | Schema | Minimum | Who supplies it | Scored as (threshold) |
|---|---|---|---|---|---|
| Prescription extraction | `extraction.json` | `extraction.schema.json` | 10 synthetic prescriptions, typed and handwritten, Arabic and English (at least one of each) | Hamad and Mohammad | field-level accuracy on the twelve core fields, at least 90% |
| Adherence replies | `adherence.json` | `adherence.schema.json` | 20 Kuwaiti-dialect replies, each verified by a native speaker | Mohammad and Hamad | intent accuracy, at least 90% |
| Interacting pairs | `screening-interacting.json` | `screening-interacting.schema.json` | 3 pairs, each with its verified citation | Waddah, checked by a pharmacist if possible | recall, 100% |
| Non-interacting pairs | `screening-non-interacting.json` | `screening-non-interacting.schema.json` | 3 verified pairs | Waddah | reported only; the spec sets no threshold |
| Foreign packaging photos | `travel.json` | `travel.schema.json` | 5 photos of real foreign medicine packaging, brand and ingredient printed | anyone on the team | identification, at least 80% |
| Routing inputs | `routing.json` | `routing.schema.json` | 15 inputs, at least 3 box-or-prescription confusions and 1 caregiver message | Mohammad | correct route, at least 95% |

The thresholds and minimums come from one constant, `agents/eval/thresholds.js`, and a test fails
if any of them stops matching the spec. Never lower one to make a run pass.

## How to add a set

1. Put the files an item needs (images, PDFs) next to the data file, for example
   `extraction/rx-01.jpg`, and name them in the item's `file`, relative to the data file.
2. Add the items to `items`. Each schema file says, field by field, what goes in. Every item needs
   the name of the person who supplied or verified it (`suppliedBy` / `verifiedBy`).
3. Delete the `owed` line once the set holds its minimum. The runner refuses to measure a set that
   still carries it, so the gate count stays true.
4. Run `cd agents && node eval/run.js --set <set>` and read the output (see `../README.md`).

## Rules for the data

- **Prescriptions are synthetic.** Never a real patient's prescription, name, Civil ID or phone
  number. `synthetic: true` is required on every extraction item.
- **`expected` is what a careful person reads on the page**, and `null` for anything that is not
  written or cannot be read: the correct outcome for such a field is to leave it unset. A strength
  goes with its unit (both, or both `null` when the unit is not written: the agent never assumes
  one). Dose times only when the prescription writes them, and then as many as `frequencyPerDay`.
  A page that is not a prescription has `isPrescription: false` and every other field `null`.
- **Adherence replies** are written the way a patient types them in Kuwaiti Arabic. `expected` is
  one of the six intents of the spec: `taken_on_time`, `taken_late`, `missed`, `ran_out`,
  `discontinued_by_doctor`, `unclear`. `verifiedBy` names the native speaker who checked it.
- **Drug pairs** use generic names as a prescription records them (`Warfarin`, `Ibuprofen`). The
  citation of an interacting pair is the verified source text, never a placeholder. The real
  citation for Warfarin and Ibuprofen is still owed to the seed (`docs/Seed Dataset.md`, ia-001);
  until Hamad approves one, that pair cannot be an item.
- **Travel photos** are real packaging, photographed by the team. `expected.ingredients` lists the
  active ingredients printed on the box, in any order.
- **Routing inputs** say who sent them (`from`), what arrived (`kind`, plus `text` or `file`), and
  the route they must take (`expected`; the schema defines each route). Mark the medicine box versus
  prescription confusions with `boxOrPrescription: true`.
- No item may hold the owed-value marker: an item that still needs a value is not an item yet.

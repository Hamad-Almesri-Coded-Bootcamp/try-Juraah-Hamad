'use strict';

/**
 * Jur'ah - the Interaction Screening Agent's deterministic layer.
 *
 * The one rule that shapes this file: NO interaction is asserted that is not a row of
 * REFERENCE_PAIRS, and NO combination is ever cleared because it is missing from them. The table
 * is small and its citations are owed (docs/Seed Dataset.md: "an invented one is worse than a
 * missing one"), so:
 *   - a matched pair            -> an alert with the pair's severity, `pending_medical_review`;
 *   - no pair matched           -> ONE `info` alert, `pending_medical_review`, that says the limited
 *                                  reference set found nothing - a reviewer clears it, never us;
 *   - an ingredient we cannot   -> ONE `info` alert, `pending_medical_review`, "cannot verify"
 *     resolve                      (TC-IX-03/04) - never a silent "no interaction";
 *   - a prescription still flagged `needsReview` is excluded, and the exclusion is returned so the
 *     caller shows it (TC-IX-06). A flagged NEW prescription is not screened at all yet.
 * Screening is per NEW prescription (the extraction write path, or a manual run naming one): only
 * pairs that include it are checked, so a re-run never re-raises an alert on an old pair.
 *
 * The model is not in this file and is not asked about interactions at all.
 */

const OWED_CITATION = '[TO BE SUPPLIED]';

/**
 * The reference set. Every row is one the product ALREADY asserts in its seed (docs/Seed
 * Dataset.md, alerts ia-001 and ia-002), with the same severity and wording. Adding a row needs a
 * verified pair with its real citation (AI Agents Acceptance Criteria.md section 4, "Requires
 * human-supplied input") - until then `citation` is the owner's loud placeholder, never invented.
 */
const REFERENCE_PAIRS = [
  {
    a: 'warfarin', b: 'ibuprofen', severity: 'danger', citation: OWED_CITATION,
    ar: 'أخذ الوارفارين مع الإيبوبروفين يرفع خطر النزيف.',
    en: 'Taking warfarin with ibuprofen raises the risk of bleeding.',
  },
  {
    a: 'levothyroxine', b: 'calcium carbonate', severity: 'warning', citation: OWED_CITATION,
    ar: 'الكالسيوم قد يقلل امتصاص اللِفوثيروكسين إذا أُخذا معًا.',
    en: 'Calcium can reduce levothyroxine absorption when the two are taken together.',
  },
];

/** Every ingredient the reference set knows by name - the only ones we can say anything about. */
const KNOWN = new Set(REFERENCE_PAIRS.flatMap((p) => [p.a, p.b]).concat(['vitamin d3']));

/** "Calcium carbonate + vitamin D3" -> ['calcium carbonate', 'vitamin d3']. Lower-case, trimmed. */
function ingredientsOf(genericName) {
  return String(genericName || '')
    .toLowerCase()
    .split(/\s*(?:\+|\/|,|&|\band\b|\bwith\b)\s*/)
    .map((s) => s.replace(/[()]/g, '').trim())
    .filter(Boolean);
}

function pairFor(x, y) {
  return REFERENCE_PAIRS.find((p) => (p.a === x && p.b === y) || (p.a === y && p.b === x)) || null;
}

/**
 * Screen one NEW prescription against the rest of the patient's active profile.
 *   prescriptions   GET /api/agent/patients/{id}/prescriptions -> .prescriptions (active only)
 * Returns { screened, excluded, alerts: [POST /api/agent/alerts bodies], reason }.
 */
function screenNewPrescription({ patientId, newPrescriptionId, prescriptions, language }) {
  const l = language === 'en' ? 'en' : 'ar';
  const all = prescriptions || [];
  const target = all.find((p) => p && p.id === newPrescriptionId);
  if (!target) return { screened: false, excluded: [], alerts: [], reason: 'the new prescription is not an active prescription of this patient' };
  const excluded = all.filter((p) => p.needsReview).map((p) => ({ id: p.id, reason: 'needs_review' }));
  if (target.needsReview) {
    return { screened: false, excluded, alerts: [], reason: 'the new prescription is still flagged for field review; it is screened once a reviewer confirms it' };
  }
  const others = all.filter((p) => p.id !== target.id && !p.needsReview);
  const name = (p) => (p.drug && p.drug.genericName) || '';
  const mine = ingredientsOf(name(target));
  const alerts = [];
  const body = (ids, severity, description, sourceCitation) => ({
    patientId, involvedPrescriptionIds: ids, severity, description, sourceCitation, reviewStatus: 'pending_medical_review',
  });

  const unknown = mine.filter((i) => !KNOWN.has(i));
  if (mine.length === 0 || unknown.length > 0) {
    const label = name(target) || (target.drug && target.drug.brandName) || '?';
    alerts.push(body([target.id], 'info', l === 'en'
      ? 'We could not verify ' + label + ' against our reference set. A medical reviewer will check it.'
      : 'تعذّر علينا التحقق من ' + label + ' في قائمتنا المرجعية. سيراجعه مختص طبي.', OWED_CITATION));
  }

  let matched = 0;
  for (const other of others) {
    const theirs = ingredientsOf(name(other));
    for (const x of mine) {
      for (const y of theirs) {
        const pair = pairFor(x, y);
        if (!pair) continue;
        matched += 1;
        alerts.push(body([target.id, other.id], pair.severity, pair[l], pair.citation));
      }
    }
  }

  if (matched === 0 && unknown.length === 0 && mine.length > 0) {
    alerts.push(body([target.id], 'info', l === 'en'
      ? 'No interaction with your other medicines was found in our limited reference set. This is not a clearance - a medical reviewer will confirm it.'
      : 'لم نجد تعارضاً مع باقي أدويتك في قائمتنا المرجعية المحدودة. هذا ليس تأكيداً بالسلامة، وسيراجعه مختص طبي.', OWED_CITATION));
  }
  return { screened: true, excluded, alerts, reason: null };
}

module.exports = { screenNewPrescription, ingredientsOf, REFERENCE_PAIRS, OWED_CITATION };

'use strict';

/* ---------------------------------------------------------------------------
 * text.js - every word a patient, caregiver or reviewer reads, and every
 * sourceCitation. Fixed templates only: code fills in drug names and ids that
 * came from the patient's own record or the retrieved index row. No model
 * writes any of it, so no model can change what a finding says.
 *
 * Arabic first (the product's default language; Settings.language 'ar'),
 * English second. A drug name stays as the record spells it (Latin), exactly
 * as the seed's own audit messages do ("Warfarin و Ibuprofen").
 * ------------------------------------------------------------------------- */

const LANGS = ['ar', 'en'];
const lang = (l) => (l === 'en' ? 'en' : 'ar');

const joinAr = (xs) => xs.join(' و ');
const joinEn = (xs) => (xs.length <= 2 ? xs.join(' and ') : xs.slice(0, -1).join(', ') + ' and ' + xs[xs.length - 1]);
const joinList = (l, xs) => (lang(l) === 'en' ? joinEn(xs) : joinAr(xs));

/** At most `max` names in a sentence, each at most 40 characters; the rest as "and N more".
 *  The full list always goes in sourceCitation. */
const MAX_NAMES = 5;
const MAX_NAME_CHARS = 40;
const shortName = (x) => (String(x).length > MAX_NAME_CHARS ? String(x).slice(0, MAX_NAME_CHARS - 1) + '\u2026' : String(x));
function capped(l, xs, max) {
  const m = max || MAX_NAMES;
  const names = xs.map(shortName);
  if (names.length <= m) return joinList(l, names);
  const rest = names.length - m;
  return lang(l) === 'en' ? names.slice(0, m).join(', ') + ' and ' + rest + ' more' : names.slice(0, m).join('\u060c ') + ' و' + rest + ' غيرها';
}
/** The longest capped list (5 names down to 1) whose sentence fits the description limit. */
function fitting(l, xs, sentence, limit) {
  for (let m = MAX_NAMES; m >= 1; m--) {
    const t = sentence(capped(l, xs, m));
    if (t.length <= (limit || 400)) return t;
  }
  return sentence(capped(l, xs, 1));
}
/** "1 of your prescriptions is" / "2 ... are"; Arabic singular, dual, plural. */
function awaitingCount(l, n) {
  if (lang(l) === 'en') return n === 1 ? '1 of your prescriptions is still awaiting review' : n + ' of your prescriptions are still awaiting review';
  if (n === 1) return 'وصفة واحدة من وصفاتك ما زالت بانتظار المراجعة';
  if (n === 2) return 'وصفتان من وصفاتك ما زالتا بانتظار المراجعة';
  return n + ' من وصفاتك ما زالت بانتظار المراجعة';
}
/** A prescription with no readable name, in the reader's language. */
const unnamed = (l) => (lang(l) === 'en' ? '(unnamed prescription)' : '(وصفة بلا اسم)');

const SEVERITY_WORD = {
  ar: { danger: 'تعارضاً شديداً', warning: 'تعارضاً متوسطاً', info: 'تعارضاً بسيطاً' },
  en: { danger: 'a major interaction', warning: 'a moderate interaction', info: 'a minor interaction' }
};

/** Alert descriptions (stored; shown on C2, the caregiver alert view and the reviewer screen). */
const ALERT_TEXT = {
  interaction(l, severity, a, b) {
    return lang(l) === 'en'
      ? 'The drug-interaction database records ' + SEVERITY_WORD.en[severity] + ' between ' + a + ' and ' + b +
        '. Do not stop either medicine on your own - check with your doctor or pharmacist first.'
      : 'تسجّل قاعدة بيانات التداخلات الدوائية ' + SEVERITY_WORD.ar[severity] + ' بين ' + a + ' و ' + b +
        '. لا توقف أيّاً منهما من تلقاء نفسك، وراجع طبيبك أو الصيدلي أولاً.';
  },
  duplicate(l, ingredient) {
    return lang(l) === 'en'
      ? 'Two of your prescriptions contain the same active ingredient (' + ingredient +
        '). Taking both could mean a double dose. Check with your doctor or pharmacist before taking them together.'
      : 'وصفتان من وصفاتك فيهما المادة الفعالة نفسها (' + ingredient +
        '). أخذهما معاً قد يعني جرعة مضاعفة. راجع طبيبك أو الصيدلي قبل أخذهما معاً.';
  },
  ungraded(l, pairLabels) {
    const shown = pairLabels.slice(0, 3);
    const more = pairLabels.length - shown.length;
    return lang(l) === 'en'
      ? 'The drug-interaction database lists an interaction between ' + shown.join('; ') + (more > 0 ? ' (and ' + more + ' more)' : '') +
        ' without a severity grade. This will be shown to a medical reviewer.'
      : 'تذكر قاعدة بيانات التداخلات الدوائية تداخلاً بين ' + shown.join('؛ ') + (more > 0 ? ' (و' + more + ' غيرها)' : '') +
        ' من غير تحديد درجة شدته. سيُعرض ذلك على مختص طبي للمراجعة.';
  },
  cannotVerify(l, drugLabels) {
    return fitting(l, drugLabels, (names) => (lang(l) === 'en'
      ? 'We could not find ' + names + ' in our drug-interaction database, so we cannot check for interactions with your other medicines. This will be shown to a medical reviewer.'
      : 'لم نجد ' + names + ' في قاعدة بيانات التداخلات الدوائية لدينا، فلا نستطيع التحقق من وجود تعارض مع أدويتك الأخرى. سيُعرض ذلك على مختص طبي للمراجعة.'));
  },
  /** Both drugs are in the database, but the category file that would list the pair was not loaded. */
  pairNotCheckable(l, pairLabels) {
    return fitting(l, pairLabels, (names) => (lang(l) === 'en'
      ? 'We could not check for an interaction when taking ' + names + ': the part of our drug-interaction database that records interactions for these medicines is not available to us yet. This will be shown to a medical reviewer.'
      : 'لم نستطع التحقق من وجود تعارض عند أخذ ' + names + '، لأن الجزء الذي يسجّل تداخلات هذه الأدوية في قاعدة بيانات التداخلات الدوائية ليس متوفراً لدينا بعد. سيُعرض ذلك على مختص طبي للمراجعة.'));
  },
  nothingFound(l, drugLabel) {
    return lang(l) === 'en'
      ? drugLabel + ' was screened against your other medicines and no interaction is recorded in our drug-interaction database. This is not a guarantee of safety; ask your pharmacist if you are unsure.'
      : 'تم فحص ' + drugLabel + ' مع باقي أدويتك، ولم نجد تعارضاً مسجّلاً في قاعدة بيانات التداخلات الدوائية. هذا ليس ضماناً للسلامة؛ إذا كان عندك سؤال فاسأل الصيدلي.';
  },
  nothingFoundButUnconfirmed(l, drugLabel, unconfirmedCount) {
    return lang(l) === 'en'
      ? drugLabel + ' was screened against your confirmed medicines and no interaction is recorded in our drug-interaction database, but ' +
        awaitingCount(l, unconfirmedCount) + ' and was not included. This will be shown to a medical reviewer.'
      : 'تم فحص ' + drugLabel + ' مع أدويتك المؤكدة ولم نجد تعارضاً مسجّلاً في قاعدة بيانات التداخلات الدوائية، لكن ' +
        awaitingCount(l, unconfirmedCount) + ' ولم تُفحص معه. سيُعرض ذلك على مختص طبي للمراجعة.';
  },
  notScreenedAwaitingReview(l, drugLabel, unconfirmedCount) {
    return lang(l) === 'en'
      ? drugLabel + ' could not be screened against your other medicines yet: ' + awaitingCount(l, unconfirmedCount) + '. This will be shown to a medical reviewer.'
      : 'لم يُفحص ' + drugLabel + ' مع باقي أدويتك بعد، لأن ' + awaitingCount(l, unconfirmedCount) + '. سيُعرض ذلك على مختص طبي للمراجعة.';
  },
  travelDanger(l, candidate, ingredients, b) {
    return lang(l) === 'en'
      ? 'You photographed ' + candidate + ' (' + ingredients + '). The drug-interaction database records a major interaction between it and ' + b +
        '. Do not take it before speaking to a doctor or pharmacist.'
      : 'صوّرت دواء ' + candidate + ' (' + ingredients + '). تسجّل قاعدة بيانات التداخلات الدوائية تعارضاً شديداً بينه وبين ' + b +
        '. لا تأخذه قبل أن تستشير طبيباً أو صيدلياً.';
  }
};

/** Travel-check answers (returned to the caller for the drug-check screen or a chat reply; not stored). */
const TRAVEL_TEXT = {
  could_not_identify(l) {
    return lang(l) === 'en'
      ? 'I could not read a medicine name I can match from that photo. Try a clearer picture of the front of the box, or ask a pharmacist before taking it.'
      : 'ما قدرت أقرأ اسم دواء أقدر أطابقه من الصورة. جرّب صورة أوضح لواجهة العلبة، أو اسأل الصيدلي قبل ما تاخذه.';
  },
  needs_confirmation(l, candidates) {
    const names = candidates.map((c) => '"' + c + '"');
    return lang(l) === 'en'
      ? 'I am not sure which medicine this is: ' + (names.length === 1 ? 'is it ' + names[0] : 'is it ' + names.slice(0, -1).join(', ') + ' or ' + names[names.length - 1]) +
        '? Please send a clearer photo of the full name on the box to be sure.'
      : 'ما أنا متأكد أي دواء هذا: هل هو ' + (names.length === 1 ? names[0] : names.slice(0, -1).join('، ') + ' أو ' + names[names.length - 1]) +
        '؟ أرسل صورة أوضح للاسم الكامل على العلبة عشان نتأكد.';
  },
  cannot_verify(l, candidate, missing) {
    return lang(l) === 'en'
      ? 'I identified ' + candidate + ', but our drug-interaction database does not include ' + capped(l, missing) + ', so I cannot check for interactions with your medicines. Please ask a pharmacist before taking it.'
      : 'تعرّفت على ' + candidate + '، لكن ما عندنا ' + capped(l, missing) + ' في قاعدة بيانات التداخلات الدوائية، فما أقدر أتحقق من التعارض مع أدويتك. اسأل الصيدلي قبل ما تاخذه.';
  },
  pair_not_checkable(l, candidate, others) {
    return lang(l) === 'en'
      ? 'I identified ' + candidate + ', but the part of our drug-interaction database that would cover it with ' + capped(l, others) + ' is not available to us yet, so I cannot check for an interaction. Please ask a pharmacist before taking it.'
      : 'تعرّفت على ' + candidate + '، لكن الجزء الذي يغطيه مع ' + capped(l, others) + ' في قاعدة بيانات التداخلات الدوائية غير متوفر عندنا بعد، فما أقدر أتحقق من التعارض. اسأل الصيدلي قبل ما تاخذه.';
  },
  unconfirmed_profile(l, candidate, count) {
    return lang(l) === 'en'
      ? 'I identified ' + candidate + ', but ' + awaitingCount(l, count) + ', so I cannot check it against your full list of medicines. Please ask a pharmacist before taking it.'
      : 'تعرّفت على ' + candidate + '، لكن ' + awaitingCount(l, count) + '، فما أقدر أتحقق منه مع كل أدويتك. اسأل الصيدلي قبل ما تاخذه.';
  },
  line_extensions(l, candidates) {
    const names = candidates.map((c) => '"' + c + '"').join(lang(l) === 'en' ? ', ' : '\u060c ');
    return lang(l) === 'en'
      ? 'This name is used for several products with different ingredients (' + names + '). If a variant word such as "Extra" or "Night" is printed on the box, send a photo that shows it; otherwise please ask a pharmacist before taking it.'
      : 'هذا الاسم يُستخدم لأكثر من دواء بمكونات مختلفة (' + names + '). إذا كانت على العلبة كلمة إضافية مثل "Extra" أو "Night" أرسل صورة تبيّنها، وإلا اسأل الصيدلي قبل ما تاخذه.';
  },
  ungraded(l, candidate) {
    return lang(l) === 'en'
      ? 'Our drug-interaction database lists an interaction between ' + candidate + ' and one of your medicines, without a severity grade, so I cannot tell you how serious it is. Please ask a pharmacist before taking it.'
      : 'قاعدة بيانات التداخلات الدوائية تذكر تداخلاً بين ' + candidate + ' وأحد أدويتك من غير تحديد درجة شدته، فما أقدر أقول لك مدى خطورته. اسأل الصيدلي قبل ما تاخذه.';
  },
  no_interaction_found(l, candidate) {
    return lang(l) === 'en'
      ? 'We found no interaction between ' + candidate + ' and your current medicines in our drug-interaction database. That is not a clearance - the database does not cover every medicine and does not know your allergies or conditions. If you are unsure, ask a pharmacist.'
      : 'ما لقينا تعارضاً بين ' + candidate + ' وأدويتك الحالية في قاعدة بيانات التداخلات الدوائية. هذا ليس تأكيداً بالسلامة: القاعدة لا تغطي كل الأدوية ولا تعرف حساسيتك أو حالتك الصحية. إذا عندك شك اسأل الصيدلي.';
  },
  interaction_found(l, candidate, others, danger) {
    return lang(l) === 'en'
      ? (danger ? 'Do not take this before speaking to a doctor or pharmacist. ' : 'Please check with a pharmacist before taking this. ') +
        'Our drug-interaction database records an interaction between ' + candidate + ' and ' + joinEn(others) + '.'
      : (danger ? 'لا تاخذ هذا الدواء قبل ما تستشير طبيباً أو صيدلياً. ' : 'اسأل الصيدلي قبل ما تاخذ هذا الدواء. ') +
        'قاعدة بيانات التداخلات الدوائية تسجّل تعارضاً بين ' + candidate + ' و ' + joinAr(others) + '.';
  },
  already_taking(l, ingredient, facility) {
    return lang(l) === 'en'
      ? 'You are already taking ' + ingredient + (facility ? ' on your prescription from ' + facility : '') + '. Taking this as well could mean a double dose. Check with a pharmacist before taking it.'
      : 'أنت تاخذ ' + ingredient + ' أصلاً' + (facility ? ' من وصفة ' + facility : '') + '. أخذ هذا الدواء معه قد يعني جرعة مضاعفة. اسأل الصيدلي قبل ما تاخذه.';
  }
};

// ------------------------------------------------------------- citations
const srcOf = (meta) => (meta && meta.source) || {};

/** A grounded DDInter record: the paper, the two DDInter drug ids, the level, the retrieval. */
function pairCitation(meta, drugA, drugB, level) {
  const s = srcOf(meta);
  return (s.citation ? s.citation + ' ' : '') +
    'Interaction record: ' + drugA.label + ' (' + drugA.ddinterId + ') x ' + drugB.label + ' (' + drugB.ddinterId + '), level "' + level + '". ' +
    'Source: ' + (s.name || 'unknown source') + (s.url ? ', ' + s.url : '') + (s.retrievedAt ? ', retrieved ' + s.retrievedAt : '') + '.';
}

function ungradedCitation(meta, rows) {
  const s = srcOf(meta);
  return (s.citation ? s.citation + ' ' : '') + 'Records with no severity grade (level "Unknown"): ' +
    rows.map((r) => r.drugA.label + ' (' + r.drugA.ddinterId + ') x ' + r.drugB.label + ' (' + r.drugB.ddinterId + ')').join('; ') +
    '. Source: ' + (s.name || 'unknown source') + (s.retrievedAt ? ', retrieved ' + s.retrievedAt : '') + '.';
}

function indexLabel(meta) {
  const s = srcOf(meta);
  return (s.name || 'screening index') + ' index' + (meta && meta.builtAt ? ' built ' + meta.builtAt : '') +
    (meta && typeof meta.drugsInScope === 'number' ? ' (' + meta.drugsInScope + ' drugs in scope)' : '');
}

function notCoveredCitation(meta, labels) {
  return 'Not covered by the ' + indexLabel(meta) + ': ' + labels.join(', ') + '. No interaction could be looked up for these; nothing is cleared.';
}

/**
 * pairs: [{ drugA, drugB }] - the two index entries of each pair ({ label, ddinterId, atcCategories? }).
 * Says which category files were loaded and why the missing record proves nothing.
 */
function notCheckableCitation(meta, pairs) {
  const loaded = meta && Array.isArray(meta.categoryFilesLoaded) && meta.categoryFilesLoaded.length ? meta.categoryFilesLoaded.join(', ') : 'none recorded';
  const drug = (d) => d.label + ' (' + d.ddinterId + ', ATC ' + (Array.isArray(d.atcCategories) && d.atcCategories.length ? d.atcCategories.join('/') : 'unknown') + ')';
  return 'Not checkable in the ' + indexLabel(meta) + ', built from DDInter category files ' + loaded + ': ' +
    pairs.map((p) => drug(p.drugA) + ' x ' + drug(p.drugB)).join('; ') +
    '. A category file lists the interactions of the drugs in that ATC category, and neither drug of these pairs is in a loaded one, so a missing record proves nothing; nothing is cleared.';
}

function nothingFoundCitation(meta, pairLabels) {
  const shown = pairLabels.slice(0, 12);
  return indexLabel(meta) + ': no interaction record for ' + shown.join('; ') +
    (pairLabels.length > shown.length ? ' (and ' + (pairLabels.length - shown.length) + ' more pairs)' : '') + '.';
}

/** Names the two prescriptions by their facilities, never by a technical id (CLAUDE.md rule 7). */
function duplicateCitation(label, facilities) {
  return 'Patient record, not a drug-database finding: ' + label + ' is an active ingredient of two active prescriptions' +
    (facilities.filter(Boolean).length ? ' (' + facilities.map((f) => f || 'facility not recorded').join('; ') + ')' : '') + '.';
}

module.exports = {
  LANGS, lang, joinList, capped, fitting, awaitingCount, unnamed, ALERT_TEXT, TRAVEL_TEXT,
  pairCitation, ungradedCitation, notCoveredCitation, notCheckableCitation, nothingFoundCitation, duplicateCitation
};

'use strict';

/**
 * Jur'ah - the voice channel (Alexa / Echo) deterministic layer. DEMO SCOPE, READ-ONLY.
 *
 * Alexa's own NLU picks the intent from a fixed list (agents/alexa/interaction-model.ar-SA.json);
 * no LLM runs on this path at all. Every sentence spoken here is built from the backend's data -
 * GET /api/agent/patients/{id}/doses?date= - so no time, name or amount is ever invented.
 *
 * The one rule: VOICE NEVER RECORDS A DOSE (CR-073; agents/lib/voice-actions.js answers a request
 * to record the same way). An Echo sits in a room; it cannot tell the patient from a caregiver or a child (TC-AD-14), and dose status comes only from the patient's own chat
 * (CLAUDE.md rule 1). "I forgot my medicine" is therefore answered by (a) saying which dose it was
 * and what comes next, and (b) sending the patient that dose's three buttons in THEIR Telegram
 * chat - one tap there records it through the adherence path. Jur'ah gives no medical advice, so
 * the missed-dose answer points to the pharmacist and never says "take it now" or "skip it".
 */

const HOUR_MS_V = 3600 * 1000;
const OPEN_V = ['upcoming'][0];
const VOICE_INTENTS = ['TodayDosesIntent', 'NextDoseIntent', 'DoseAmountIntent', 'ForgotDoseIntent'];

const UNIT_AR = { mg: 'مليغرام', mcg: 'مايكروغرام', g: 'غرام', ml: 'مل', IU: 'وحدة دولية' };
const UNIT_EN = { mg: 'milligrams', mcg: 'micrograms', g: 'grams', ml: 'millilitres', IU: 'international units' };

/** Kuwait wall-clock parts of an ISO time (UTC+3, no DST). */
function kwParts(iso) {
  const k = new Date(new Date(iso).getTime() + 3 * HOUR_MS_V);
  return { h: k.getUTCHours(), m: k.getUTCMinutes() };
}

/** "الساعة 7 الصبح" / "7 in the morning" - spoken, never a bare 07:00. */
function spokenTime(iso, language) {
  const { h, m } = kwParts(iso);
  const h12 = h % 12 === 0 ? 12 : h % 12;
  if (language === 'en') {
    const part = h < 12 ? 'in the morning' : h < 17 ? 'in the afternoon' : 'in the evening';
    return h12 + (m ? ':' + String(m).padStart(2, '0') : '') + ' ' + part;
  }
  const part = h >= 4 && h < 12 ? 'الصبح' : h >= 12 && h < 15 ? 'الظهر' : h >= 15 && h < 18 ? 'العصر' : h >= 18 && h < 20 ? 'المغرب' : 'بالليل';
  return 'الساعة ' + h12 + (m ? ' و' + m + ' دقيقة' : '') + ' ' + part;
}

function medName(d) { return d.brandName || d.genericName || ''; }

/** The amount AS PRESCRIBED: "1، تركيز 50 مايكروغرام". Never converted, never advised. */
function spokenAmount(d, language) {
  const unit = d.strengthUnit || 'mg';
  const strength = d.strengthMg != null ? d.strengthMg + ' ' + (language === 'en' ? UNIT_EN[unit] || unit : UNIT_AR[unit] || unit) : null;
  const count = d.dosePerAdministration != null ? d.dosePerAdministration : null;
  if (language === 'en') return [count != null ? count + ' dose' + (count === 1 ? '' : 's') : null, strength ? 'strength ' + strength : null].filter(Boolean).join(', ');
  return [count != null ? 'الكمية ' + count : null, strength ? 'تركيز ' + strength : null].filter(Boolean).join('، ');
}

const byTime = (a, b) => new Date(a.scheduledAt) - new Date(b.scheduledAt);

// CR-106 (the owner, 2026-09-25): opening the skill is answered with the greeting alone; "help" still lists the questions.
const SAY = {
  ar: {
    launch: 'هلا، معك جرعة AI. شلون أقدر أساعدك؟',
    help: 'تقدر تسألني: شنو جرعتي الجاية؟ كم آخذ؟ شنو أدويتي اليوم؟ أو قول: نسيت دواي.',
    reprompt: 'شنو تبي تعرف عن أدويتك؟',
    bye: 'مع السلامة، الله يعافيك.',
    notLinked: 'هذا الجهاز مو مربوط بحساب في جرعة بعد.',
    failed: 'ما قدرت أوصل لجدولك الحين. حاول بعد شوي، أو شوف التطبيق.',
    none: 'ما عندك جرعات مسجّلة في جدولك اليوم.',
    noneLeft: 'ما باقي لك جرعات اليوم. ',
    taken: 'أخذتها', late: 'أخذتها متأخر', missedRec: 'فاتتك', open: 'باقية',
    forgotNone: 'ما لقيت جرعة فاتت وقتها ولسه مو مسجّلة. ',
    forgotTail: ' ما سجّلت شي بالصوت. أرسلت لك الأزرار في تيليقرام، أكّد منها بنفسك. وإذا عندك سؤال عن الجرعة الفايتة، اسأل الصيدلاني.',
    forgotNoChat: ' ما سجّلت شي بالصوت، وتيليقرام مو مربوط عندك، فسجّلها من محادثتك لما تربطها. وإذا عندك سؤال عن الجرعة الفايتة، اسأل الصيدلاني.',
    askMore: ' تبي شي ثاني؟',
  },
  en: {
    launch: 'Hi, Jur\'ah AI. How can I help?',
    help: 'Ask me: what is my next dose, how much do I take, what are my medicines today - or say: I forgot my medicine.',
    reprompt: 'What would you like to know about your medicines?',
    bye: 'Goodbye, take care.',
    notLinked: 'This device is not linked to a Jur\'ah account yet.',
    failed: 'I could not reach your schedule right now. Please try again shortly, or check the app.',
    none: 'There are no doses on your schedule today.',
    noneLeft: 'You have no doses left today. ',
    taken: 'taken', late: 'taken late', missedRec: 'missed', open: 'still open',
    forgotNone: 'I could not find a dose whose time has passed that is still unrecorded. ',
    forgotTail: ' Nothing was recorded by voice. I sent the buttons to your Telegram chat - please confirm there yourself. If you have a question about the missed dose, ask your pharmacist.',
    forgotNoChat: ' Nothing was recorded by voice, and your Telegram is not linked, so record it from your chat once it is. If you have a question about the missed dose, ask your pharmacist.',
    askMore: ' Anything else?',
  },
};

/** Alexa request -> what to do. Pure: the caller supplies `nowIso` and the link table. */
function parseAlexaRequest({ body, nowIso, skillId, links }) {
  const b = body && typeof body === 'object' ? body : {};
  const req = b.request || {};
  const appId = (b.session && b.session.application && b.session.application.applicationId) ||
    (b.context && b.context.System && b.context.System.application && b.context.System.application.applicationId) || null;
  const userId = (b.session && b.session.user && b.session.user.userId) ||
    (b.context && b.context.System && b.context.System.user && b.context.System.user.userId) || null;
  const language = String(req.locale || '').startsWith('en') ? 'en' : 'ar';
  // Replay guard: Alexa's own rule is a timestamp within 150 seconds.
  const fresh = Number.isFinite(Date.parse(req.timestamp)) && Math.abs(Date.parse(nowIso) - Date.parse(req.timestamp)) <= 150 * 1000;
  if (!skillId || appId !== skillId || !fresh) return { ok: false, kind: 'refused', language, userId, reason: !skillId ? 'no skill id configured' : appId !== skillId ? 'wrong skill id' : 'stale request' };
  const patientId = (links && userId && links[userId]) || null;
  const kind = req.type === 'LaunchRequest' ? 'launch'
    : req.type === 'SessionEndedRequest' ? 'ended'
    : req.type === 'IntentRequest' ? (req.intent && req.intent.name) || 'AMAZON.FallbackIntent'
    : 'unknown';
  if (!patientId) return { ok: false, kind: 'not_linked', language, userId, reason: 'this Alexa user is not linked to a patient' };
  // CR-070: the free sentence (FreeTalkIntent's one AMAZON.SearchQuery slot), raw here, read in voice-actions.js.
  const slot = req.intent && req.intent.slots && req.intent.slots.utterance;
  const utterance = slot && typeof slot.value === 'string' ? slot.value.trim().slice(0, 300) : '';
  return { ok: true, kind, language, userId, patientId, utterance, needsDoses: VOICE_INTENTS.includes(kind) };
}

/**
 * What Alexa says. `doses` are the patient's TRACKED doses of today (null if the backend failed).
 * Returns { speech, endSession, promptDoses } - promptDoses are the doses whose buttons go to the
 * patient's Telegram chat (ForgotDoseIntent only). Nothing here writes anything.
 */
function voiceReply({ kind, language, doses, nowIso, hasChat }) {
  const S = SAY[language === 'en' ? 'en' : 'ar'];
  const t = Date.parse(nowIso);
  const out = (speech, endSession = false, promptDoses = []) => ({ speech, endSession, promptDoses });
  if (kind === 'launch') return out(S.launch);
  if (kind === 'AMAZON.HelpIntent' || kind === 'AMAZON.FallbackIntent' || kind === 'unknown') return out(S.help);
  if (kind === 'AMAZON.StopIntent' || kind === 'AMAZON.CancelIntent' || kind === 'AMAZON.NoIntent' || kind === 'ended') return out(S.bye, true);
  if (!VOICE_INTENTS.includes(kind)) return out(S.help);
  if (!Array.isArray(doses)) return out(S.failed, true);
  const all = doses.slice().sort(byTime);
  if (all.length === 0) return out(S.none + S.askMore);
  const open = all.filter((d) => d.status === OPEN_V);
  const next = open.find((d) => Date.parse(d.scheduledAt) > t) || null;

  if (kind === 'TodayDosesIntent') {
    const word = (d) => d.status === OPEN_V ? S.open : d.status === 'taken_on_time' ? S.taken : d.status === 'taken_late' ? S.late : S.missedRec;
    const comma = language === 'en' ? ', ' : '، ';
    const lines = all.map((d) => spokenTime(d.scheduledAt, language) + ' ' + medName(d) + comma + word(d));
    const head = language === 'en' ? 'Today you have ' + all.length + ' doses: ' : 'عندك اليوم ' + all.length + ' جرعات: ';
    return out(head + lines.join('. ') + '.' + S.askMore);
  }
  if (kind === 'NextDoseIntent') {
    if (!next) return out(S.noneLeft + S.askMore);
    const say = language === 'en'
      ? 'Your next dose is ' + medName(next) + ' at ' + spokenTime(next.scheduledAt, language) + '. ' + spokenAmount(next, language) + '.'
      : 'جرعتك الجاية ' + medName(next) + ' ' + spokenTime(next.scheduledAt, language) + '. ' + spokenAmount(next, language) + '.';
    return out(say + S.askMore);
  }
  if (kind === 'DoseAmountIntent') {
    // The dose due now (up to an hour early) or else the next one - read as prescribed.
    const due = open.filter((d) => Date.parse(d.scheduledAt) <= t + HOUR_MS_V).sort(byTime).pop() || next;
    if (!due) return out(S.noneLeft + S.askMore);
    const say = language === 'en'
      ? 'As prescribed, ' + medName(due) + ' at ' + spokenTime(due.scheduledAt, language) + ': ' + spokenAmount(due, language) + '.'
      : 'حسب وصفتك، ' + medName(due) + ' ' + spokenTime(due.scheduledAt, language) + ': ' + spokenAmount(due, language) + '.';
    return out(say + S.askMore);
  }
  // ForgotDoseIntent - which dose(s) passed unrecorded; buttons to the patient's own chat.
  const passed = open.filter((d) => Date.parse(d.scheduledAt) <= t);
  const nextLine = next ? (language === 'en' ? ' Your next dose is ' + medName(next) + ' at ' + spokenTime(next.scheduledAt, language) + '.'
                                             : ' جرعتك الجاية ' + medName(next) + ' ' + spokenTime(next.scheduledAt, language) + '.') : '';
  if (passed.length === 0) return out(S.forgotNone + nextLine.trim() + S.askMore);
  const last = passed[passed.length - 1];
  const which = language === 'en'
    ? 'The dose that passed is ' + medName(last) + ' at ' + spokenTime(last.scheduledAt, language) + '.'
    : 'الجرعة اللي فات وقتها ' + medName(last) + ' ' + spokenTime(last.scheduledAt, language) + '.';
  return out(which + nextLine + (hasChat ? S.forgotTail : S.forgotNoChat), true, hasChat ? passed : []);
}

/** The Alexa response envelope. */
function alexaResponse({ speech, endSession, language }) {
  const r = { version: '1.0', response: { outputSpeech: { type: 'PlainText', text: speech }, shouldEndSession: !!endSession } };
  if (!endSession) r.response.reprompt = { outputSpeech: { type: 'PlainText', text: SAY[language === 'en' ? 'en' : 'ar'].reprompt } };
  return r;
}

/**
 * CR-069 - the screen follows the voice. Which topic a voice turn is about, for the patient's open
 * web app (POST /api/agent/patients/{id}/voice-turns after Alexa has answered): the app maps the
 * topic to a screen and shows the turn in its assistant panel. null = nothing to show (a closed
 * session). Deterministic, from Alexa's own intent; the words are the reply Alexa already spoke.
 */
const SCREEN_TOPIC = {
  launch: 'launch', NextDoseIntent: 'next_dose', DoseAmountIntent: 'dose_amount', TodayDosesIntent: 'today',
  ForgotDoseIntent: 'forgot', record: 'record', 'AMAZON.HelpIntent': 'unclear', 'AMAZON.FallbackIntent': 'unclear', unknown: 'unclear',
  'AMAZON.StopIntent': 'bye', 'AMAZON.CancelIntent': 'bye', 'AMAZON.NoIntent': 'bye', 'AMAZON.NavigateHomeIntent': 'bye',
};
function screenTopic(kind) {
  return Object.prototype.hasOwnProperty.call(SCREEN_TOPIC, kind) ? SCREEN_TOPIC[kind] : kind === 'ended' ? null : 'unclear';
}

module.exports = { parseAlexaRequest, voiceReply, alexaResponse, spokenTime, spokenAmount, screenTopic, VOICE_INTENTS };

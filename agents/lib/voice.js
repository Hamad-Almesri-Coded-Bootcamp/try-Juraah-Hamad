'use strict';

/**
 * Jur'ah - the voice channel (Alexa / Echo) deterministic layer.
 *
 * Alexa's own NLU picks the intent from a fixed list (agents/alexa/interaction-model.ar-SA.json);
 * no LLM runs on this path at all. Every sentence spoken here is built from the backend's data -
 * GET /api/agent/patients/{id}/doses?date= - so no time, name or amount is ever invented.
 *
 * CR-108 (the owner, 2026-09-25): voice records a dose again, through the agent route the Telegram
 * buttons use. «نسيت دواي» names the most recent of today's tracked doses whose time has passed and
 * is still open (forgotTarget, below). The workflow's plan node (agents/scripts/build.js) records
 * exactly that dose as missed - the status write first, the recompute only after that write answers
 * 200 - then tells the patient's own Telegram chat, with correction buttons (agents/lib/adherence.js
 * buildVoiceNotice). voiceReply only words the outcome it is handed (`forgot`); it writes nothing
 * itself. Jur'ah gives no medical advice, so the missed-dose answer points to the pharmacist.
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

/**
 * CR-108 - the dose «نسيت دواي» records: the most recent of today's TRACKED doses whose time has
 * passed and that is still open ('upcoming'). null when none has passed, or `doses` is not an
 * array (the backend could not be read). This is the SAME dose voiceReply names in its "the dose
 * that passed is ..." line, so the workflow's plan node and the spoken answer never disagree.
 */
function forgotTarget({ doses, nowIso }) {
  if (!Array.isArray(doses)) return null;
  const t = Date.parse(nowIso);
  const passed = doses.filter((d) => d && d.status === OPEN_V && Date.parse(d.scheduledAt) <= t).sort(byTime);
  return passed.length ? passed[passed.length - 1] : null;
}

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
    forgotRecorded: ' سجّلتها إنها فاتتك وأرسلتها لك في تيليقرام. وإذا عندك سؤال عن الجرعة الفايتة، اسأل الصيدلاني.',
    forgotRecordedNoChat: ' سجّلتها إنها فاتتك. تيليقرام مو مربوط عندك، فما أرسلت لك رسالة. وإذا عندك سؤال عن الجرعة الفايتة، اسأل الصيدلاني.',
    forgotFailed: ' ما قدرت أسجّلها الحين، فأرسلت لك الأزرار في تيليقرام. سجّلها من هناك. وإذا عندك سؤال عن الجرعة الفايتة، اسأل الصيدلاني.',
    forgotFailedNoChat: ' ما قدرت أسجّلها الحين، وتيليقرام مو مربوط عندك، فسجّلها من محادثتك لما تربطها. وإذا عندك سؤال عن الجرعة الفايتة، اسأل الصيدلاني.',
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
    forgotRecorded: ' I recorded it as missed and sent it to your Telegram. If you have a question about the missed dose, ask your pharmacist.',
    forgotRecordedNoChat: ' I recorded it as missed. Your Telegram is not linked, so I sent no message. If you have a question about the missed dose, ask your pharmacist.',
    forgotFailed: ' I could not record it just now, so I sent the buttons to your Telegram chat. Please record it there. If you have a question about the missed dose, ask your pharmacist.',
    forgotFailedNoChat: ' I could not record it just now, and your Telegram is not linked, so record it from your chat once it is. If you have a question about the missed dose, ask your pharmacist.',
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
  // CR-070/CR-108: the free sentence and the list a "yes" confirms - both raw here, cleaned in voice-actions.js.
  const slot = req.intent && req.intent.slots && req.intent.slots.utterance;
  const utterance = slot && typeof slot.value === 'string' ? slot.value.trim().slice(0, 300) : '';
  const pending = b.session && b.session.attributes && Array.isArray(b.session.attributes.pending) ? b.session.attributes.pending.slice(0, 10) : [];
  return { ok: true, kind, language, userId, patientId, utterance, pending,
    needsDoses: VOICE_INTENTS.includes(kind) || (kind === 'AMAZON.YesIntent' && pending.length > 0) };
}

/**
 * What Alexa says. `doses` are the patient's TRACKED doses of today (null if the backend failed).
 * Returns { speech, endSession, promptDoses } - promptDoses are the doses whose buttons go to the
 * patient's Telegram chat. `forgot` is ForgotDoseIntent's write outcome (CR-108): 'recorded' when
 * the status call answered 200, anything else (undefined, a refusal, a timeout) means NOT recorded
 * - fail closed, never guessed as success. Nothing here writes anything itself.
 */
function voiceReply({ kind, language, doses, nowIso, hasChat, forgot }) {
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
  // ForgotDoseIntent - the most recent passed, still-open dose is what the workflow's plan node
  // RECORDS as missed (forgotTarget, same dose). `forgot` says whether that write actually landed.
  const passed = open.filter((d) => Date.parse(d.scheduledAt) <= t);
  const nextLine = next ? (language === 'en' ? ' Your next dose is ' + medName(next) + ' at ' + spokenTime(next.scheduledAt, language) + '.'
                                             : ' جرعتك الجاية ' + medName(next) + ' ' + spokenTime(next.scheduledAt, language) + '.') : '';
  if (passed.length === 0) return out(S.forgotNone + nextLine.trim() + S.askMore);
  const last = forgotTarget({ doses: all, nowIso });
  const which = language === 'en'
    ? 'The dose that passed is ' + medName(last) + ' at ' + spokenTime(last.scheduledAt, language) + '.'
    : 'الجرعة اللي فات وقتها ' + medName(last) + ' ' + spokenTime(last.scheduledAt, language) + '.';
  if (forgot === 'recorded') {
    return out(which + nextLine + (hasChat ? S.forgotRecorded : S.forgotRecordedNoChat), true, hasChat ? passed.filter((d) => d.id !== last.id) : []);
  }
  return out(which + nextLine + (hasChat ? S.forgotFailed : S.forgotFailedNoChat), true, hasChat ? passed : []);
}

/**
 * The Alexa response envelope. `sessionAttributes` (CR-108's record turn 1 -> turn 2 pending list)
 * is written only while the session stays open. `reprompt` overrides the default reprompt text
 * (the record turn's "Shall I? Say yes, or no."); omitted, the default per-language reprompt is used.
 */
function alexaResponse({ speech, endSession, language, sessionAttributes, reprompt }) {
  const r = { version: '1.0', response: { outputSpeech: { type: 'PlainText', text: speech }, shouldEndSession: !!endSession } };
  if (sessionAttributes && !endSession) r.sessionAttributes = sessionAttributes;
  if (!endSession) r.response.reprompt = { outputSpeech: { type: 'PlainText', text: reprompt || SAY[language === 'en' ? 'en' : 'ar'].reprompt } };
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

module.exports = { parseAlexaRequest, voiceReply, alexaResponse, spokenTime, spokenAmount, screenTopic, forgotTarget, VOICE_INTENTS };

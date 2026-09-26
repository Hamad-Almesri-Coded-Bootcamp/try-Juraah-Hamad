'use strict';

/**
 * CR-109 (the owner, 2026-09-26). This is the demo-reset page's answer and the deterministic
 * layer, fail closed. Only an HTTP 200 whose body has exactly the contract's shape reads as done.
 * It never echoes the backend's body, only the status code. Every value it prints is
 * pattern-checked first, so the backend cannot put markup on the page.
 *
 * The page never shows patientId, the patient's name or body text.
 */

const DEMO_RESET_PATIENT = 'pt-03';
const EVENING_FROM = '21:00';
const EVENING_TO = '19:30';
// Dose words by reference, never as a `status: '<word>'` literal (guard 4 / G1 scans agents/**/*.js).
const RECORDED_WORDS = ['taken_on_time', 'taken_late', 'missed'];
const MAX_ROWS = 50;
const DOSE_ID = /^[A-Za-z0-9_-]{1,64}$/;
const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/;
const YMD = /^\d{4}-\d{2}-\d{2}$/;
const BODY_KEYS = ['dates', 'moved', 'patientId', 'reset'];
// Keys are the words themselves, never a `status:` literal.
const WAS = {
  taken_on_time: { en: 'taken on time', ar: 'أُخذت في وقتها' },
  taken_late: { en: 'taken late', ar: 'أُخذت متأخرة' },
  missed: { en: 'missed', ar: 'فاتت' },
};

// ------------------------------------------------------------------------------ small helpers
function isPlain(v) {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}
function sameKeys(o, keys) {
  const actual = Object.keys(o).sort();
  const expected = keys.slice().sort();
  return actual.length === expected.length && actual.every((k, i) => k === expected[i]);
}
function validYmd(s) {
  if (typeof s !== 'string' || !YMD.test(s)) return false;
  const t = Date.parse(s + 'T00:00:00Z');
  if (!Number.isFinite(t)) return false;
  return new Date(t).toISOString().slice(0, 10) === s;
}
function nextDay(s) {
  return new Date(Date.parse(s + 'T00:00:00Z') + 86400000).toISOString().slice(0, 10);
}
function isMove(m) {
  return isPlain(m) && sameKeys(m, ['from', 'id', 'to']) &&
    typeof m.id === 'string' && DOSE_ID.test(m.id) &&
    m.from === EVENING_FROM && m.to === EVENING_TO;
}
function isReset(x) {
  return isPlain(x) && sameKeys(x, ['id', 'kuwaitTime', 'was']) &&
    typeof x.id === 'string' && DOSE_ID.test(x.id) &&
    typeof x.kuwaitTime === 'string' && HHMM.test(x.kuwaitTime) &&
    RECORDED_WORDS.includes(x.was);
}
/** n8n's text response mode can hand the body back as a JSON string rather than a parsed object. */
function bodyOf(r) {
  if (typeof r.body === 'string') {
    try { return JSON.parse(r.body); } catch (e) { return null; }
  }
  return r.body;
}

/**
 * Reads the backend's answer to POST /demo/reset. Returns {ok:true, statusCode:200, dates, moved,
 * reset} only when the body is EXACTLY the agreed contract shape, for pt-03, with well-formed rows;
 * otherwise {ok:false, statusCode, reason}. Fail closed: any shape the contract does not name is a
 * refusal, never a guess.
 */
function readReset(response) {
  const r = response || {};
  const statusCode = Number.isInteger(r.statusCode) ? r.statusCode : null;
  if (statusCode !== 200) return { ok: false, statusCode, reason: statusCode === null ? 'no_answer' : 'http_' + statusCode };
  const body = bodyOf(r);
  if (!isPlain(body) || !sameKeys(body, BODY_KEYS)) return { ok: false, statusCode, reason: 'not_the_contract' };
  if (body.patientId !== DEMO_RESET_PATIENT) return { ok: false, statusCode, reason: 'other_patient' };
  const dates = body.dates;
  if (!Array.isArray(dates) || dates.length !== 2 || !validYmd(dates[0]) || !validYmd(dates[1]) || nextDay(dates[0]) !== dates[1]) {
    return { ok: false, statusCode, reason: 'bad_dates' };
  }
  const moved = body.moved;
  if (!Array.isArray(moved) || moved.length > MAX_ROWS || !moved.every(isMove)) return { ok: false, statusCode, reason: 'bad_moved' };
  const reset = body.reset;
  if (!Array.isArray(reset) || reset.length > MAX_ROWS || !reset.every(isReset)) return { ok: false, statusCode, reason: 'bad_reset' };
  const movedIds = moved.map((m) => m.id);
  const resetIds = reset.map((x) => x.id);
  if (new Set(movedIds).size !== movedIds.length || new Set(resetIds).size !== resetIds.length) {
    return { ok: false, statusCode, reason: 'duplicate_id' };
  }
  return { ok: true, statusCode: 200, dates: dates.slice(), moved: moved.map((m) => ({ ...m })), reset: reset.map((x) => ({ ...x })) };
}

/**
 * The page's whole answer: done/not-done, why, and the bilingual text to show - built only from
 * values readReset already pattern-checked. Never echoes the backend's own body text.
 */
function resetAnswer(response) {
  const r = readReset(response);
  if (r.ok) {
    const n = r.reset.length;
    const evening = r.reset.some((x) => x.kuwaitTime === EVENING_FROM);
    const nothingChanged = r.moved.length === 0 && r.reset.length === 0;
    const en = [];
    en.push('Done: ' + n + ' dose' + (n === 1 ? '' : 's') + ' back to unrecorded' + (r.moved.length ? '; evening dose at 19:30' : ''));
    en.push('Dates (Kuwait): ' + r.dates[0] + ', ' + r.dates[1]);
    for (const m of r.moved) en.push('Moved ' + m.id + ': 21:00 to 19:30');
    for (const x of r.reset) en.push('Back to unrecorded: ' + x.id + ' (' + x.kuwaitTime + ', was ' + WAS[x.was].en + ')');
    if (nothingChanged) en.push('Nothing needed changing.');
    if (evening) en.push('A dose went back to unrecorded at 21:00 - press the button once more to move it to 19:30.');
    const ar = [];
    ar.push('تم: عدد الجرعات التي رجعت إلى غير مسجّلة: ' + n + (r.moved.length ? '، وجرعة المساء صارت الساعة 19:30' : ''));
    ar.push('التواريخ (بتوقيت الكويت): ' + r.dates[0] + '، ' + r.dates[1]);
    for (const m of r.moved) ar.push('نُقلت ' + m.id + ': من 21:00 إلى 19:30');
    for (const x of r.reset) ar.push('رجعت إلى غير مسجّلة: ' + x.id + ' (' + x.kuwaitTime + '، كانت: ' + WAS[x.was].ar + ')');
    if (nothingChanged) ar.push('لا شيء احتاج تغييراً.');
    if (evening) ar.push('رجعت جرعة إلى غير مسجّلة عند الساعة 21:00 - اضغط الزر مرة ثانية لنقلها إلى 19:30.');
    return {
      done: true, reason: null, statusCode: r.statusCode, movedCount: r.moved.length, resetCount: r.reset.length,
      title: 'Done / تم', message: [...en, '', ...ar].join('\n'),
    };
  }
  const w = r.statusCode === null ? 'The backend gave no answer (a timeout or a network error).'
    : r.statusCode === 200 ? 'The backend answered HTTP 200, but not in the agreed shape.'
    : 'The backend answered HTTP ' + r.statusCode + '.';
  const wa = r.statusCode === null ? 'لم يصل رد من الخادم (انتهت المهلة أو خطأ في الشبكة).'
    : r.statusCode === 200 ? 'ردّ الخادم HTTP 200 لكن ليس بالشكل المتفق عليه.'
    : 'ردّ الخادم HTTP ' + r.statusCode + '.';
  const en = 'The demo doses were NOT reset. ' + w + ' Nothing is confirmed: open this execution in n8n (Executions tab) and check it before the demo.';
  const ar = 'لم تتم إعادة ضبط جرعات العرض. ' + wa + ' لا شيء مؤكد: افتح هذا التنفيذ في n8n (تبويب Executions) وراجعه قبل العرض.';
  return {
    done: false, reason: r.reason, statusCode: r.statusCode, movedCount: 0, resetCount: 0,
    title: 'Did not reset / لم تتم إعادة الضبط', message: [en, '', ar].join('\n'),
  };
}

module.exports = { readReset, resetAnswer, DEMO_RESET_PATIENT, EVENING_FROM, EVENING_TO, RECORDED_WORDS, MAX_ROWS };

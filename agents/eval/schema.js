'use strict';

/**
 * A small JSON Schema validator for the dataset schemas in agents/eval/datasets (draft 2020-12
 * keywords, the subset those files use). The agents package has no dependencies, and a schema
 * keyword this file does not understand is an error, never silently ignored: a check that skips
 * part of its input would pass on data it never looked at.
 */

const ANNOTATIONS = new Set(['$schema', '$id', '$comment', 'title', 'description', 'examples']);
const KEYWORDS = new Set(['type', 'const', 'enum', 'properties', 'required', 'additionalProperties', 'items',
  'minItems', 'maxItems', 'uniqueItems', 'minLength', 'maxLength', 'pattern', 'minimum', 'maximum', 'exclusiveMinimum']);

function typeOf(v) {
  if (v === null) return 'null';
  if (Array.isArray(v)) return 'array';
  if (typeof v === 'number') return Number.isInteger(v) ? 'integer' : 'number';
  return typeof v;
}

const isType = (v, t) => typeOf(v) === t || (t === 'number' && typeOf(v) === 'integer');
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

/** Every problem with `value` against `schema`, as "path: message" strings. Empty = valid. */
function validate(schema, value, at = '$', errors = []) {
  if (!schema || typeof schema !== 'object') throw new Error('not a schema at ' + at);
  for (const k of Object.keys(schema)) {
    if (!ANNOTATIONS.has(k) && !KEYWORDS.has(k)) throw new Error('agents/eval/schema.js does not support the keyword "' + k + '" (at ' + at + ')');
  }
  if (schema.type !== undefined) {
    const types = [].concat(schema.type);
    if (!types.some((t) => isType(value, t))) {
      errors.push(at + ': must be ' + types.join(' or ') + ', is ' + typeOf(value));
      return errors;
    }
  }
  if ('const' in schema && !same(value, schema.const)) errors.push(at + ': must be ' + JSON.stringify(schema.const));
  if (schema.enum && !schema.enum.some((e) => same(e, value))) errors.push(at + ': must be one of ' + schema.enum.map((e) => JSON.stringify(e)).join(', '));

  if (typeof value === 'string') {
    const n = [...value].length;
    if (schema.minLength !== undefined && n < schema.minLength) errors.push(at + ': shorter than ' + schema.minLength);
    if (schema.maxLength !== undefined && n > schema.maxLength) errors.push(at + ': longer than ' + schema.maxLength);
    if (schema.pattern !== undefined && !new RegExp(schema.pattern, 'u').test(value)) errors.push(at + ': does not match ' + schema.pattern);
  }
  if (typeof value === 'number') {
    if (schema.minimum !== undefined && value < schema.minimum) errors.push(at + ': below ' + schema.minimum);
    if (schema.maximum !== undefined && value > schema.maximum) errors.push(at + ': above ' + schema.maximum);
    if (schema.exclusiveMinimum !== undefined && !(value > schema.exclusiveMinimum)) errors.push(at + ': must be above ' + schema.exclusiveMinimum);
  }
  if (Array.isArray(value)) {
    if (schema.minItems !== undefined && value.length < schema.minItems) errors.push(at + ': fewer than ' + schema.minItems + ' entries');
    if (schema.maxItems !== undefined && value.length > schema.maxItems) errors.push(at + ': more than ' + schema.maxItems + ' entries');
    if (schema.uniqueItems && new Set(value.map((v) => JSON.stringify(v))).size !== value.length) errors.push(at + ': entries repeat');
    if (schema.items) value.forEach((v, i) => validate(schema.items, v, at + '[' + i + ']', errors));
  }
  if (typeOf(value) === 'object') {
    for (const k of schema.required || []) if (!(k in value)) errors.push(at + ': missing "' + k + '"');
    const props = schema.properties || {};
    for (const [k, v] of Object.entries(value)) {
      if (props[k]) validate(props[k], v, at + '.' + k, errors);
      else if (schema.additionalProperties === false) errors.push(at + ': unknown field "' + k + '"');
    }
  }
  return errors;
}

module.exports = { validate, typeOf };

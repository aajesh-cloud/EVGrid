/**
 * Schema-driven payload validation.
 *
 * Nothing is hard-coded about column types: the rules come from
 * INFORMATION_SCHEMA (see `schemaCache.js`), so a column added to
 * `backend/db/schema.sql` is validated automatically.
 *
 * Unknown keys are rejected rather than silently dropped so that a typo in a
 * frontend payload surfaces as a clear 400 instead of a mysterious no-op.
 */

import { ApiError } from './ApiError.js';
import { getTableSchema } from './schemaCache.js';

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^\d{2}:\d{2}(:\d{2})?$/;
const DATETIME_RE = /^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}(:\d{2})?/;

const isPlainObject = (value) =>
  value !== null && typeof value === 'object' && !Array.isArray(value) && !(value instanceof Date);

function fail(field, message, details) {
  throw ApiError.badRequest(`Invalid value for "${field}": ${message}`, {
    field,
    ...(details || {}),
  });
}

function coerceValue(meta, value, field) {
  if (value === null) {
    if (!meta.nullable) fail(field, 'null is not allowed for this column.', { nullable: false });
    return null;
  }

  if (meta.isBoolean) {
    if (typeof value === 'boolean') return value ? 1 : 0;
    if (value === 1 || value === 0) return value;
    const text = String(value).toLowerCase();
    if (['1', 'true', 'yes', 'on'].includes(text)) return 1;
    if (['0', 'false', 'no', 'off'].includes(text)) return 0;
    fail(field, 'expected a boolean.', { expected: 'boolean' });
  }

  if (meta.isNumeric) {
    const number = typeof value === 'number' ? value : Number(value);
    if (!Number.isFinite(number)) fail(field, 'expected a number.', { expected: 'number' });
    if (meta.dataType === 'int' || meta.dataType === 'tinyint' || meta.dataType === 'smallint' || meta.dataType === 'mediumint' || meta.dataType === 'bigint') {
      return Math.trunc(number);
    }
    return number;
  }

  if (meta.isDate) {
    const text = String(value);
    if (meta.dataType === 'date' && !DATE_RE.test(text)) {
      fail(field, 'expected a date in YYYY-MM-DD format.', { expected: 'YYYY-MM-DD' });
    }
    if (meta.dataType === 'time' && !TIME_RE.test(text)) {
      fail(field, 'expected a time in HH:MM format.', { expected: 'HH:MM' });
    }
    if (['datetime', 'timestamp'].includes(meta.dataType) && !DATETIME_RE.test(text)) {
      fail(field, 'expected a datetime.', { expected: 'YYYY-MM-DD HH:MM:SS' });
    }
    return text;
  }

  if (meta.isJson) {
    if (Array.isArray(value) || isPlainObject(value)) return value;
    if (typeof value === 'string') {
      const trimmed = value.trim();
      if (!trimmed) return null;
      try {
        return JSON.parse(trimmed);
      } catch {
        fail(field, 'expected valid JSON.', { expected: 'JSON' });
      }
    }
    fail(field, 'expected an object or array.', { expected: 'JSON' });
  }

  if (meta.enumValues) {
    const text = String(value);
    if (!meta.enumValues.includes(text)) {
      fail(field, `expected one of: ${meta.enumValues.join(', ')}.`, { allowed: meta.enumValues });
    }
    return text;
  }

  const text = typeof value === 'string' ? value : String(value);
  if (meta.maxLength && text.length > meta.maxLength) {
    fail(field, `must be ${meta.maxLength} characters or fewer (received ${text.length}).`, {
      maxLength: meta.maxLength,
    });
  }
  return text;
}

/**
 * Validate and coerce a payload for insert/update.
 *
 * @param {string} table
 * @param {object} payload
 * @param {object} [options]
 * @param {string[]} [options.required]   columns that must be present and non-empty (create)
 * @param {string[]} [options.immutable]  columns the client may never write
 * @returns {Promise<{ values: object, skipped: string[] }>}
 */
export async function validatePayload(table, payload, { required = [], immutable = [] } = {}) {
  if (!isPlainObject(payload)) {
    throw ApiError.badRequest('Request body must be a JSON object.');
  }

  const schema = await getTableSchema(table);
  const blocked = new Set(['id', 'created_date', ...immutable]);
  const values = {};
  const skipped = [];
  const unknown = [];

  for (const [field, rawValue] of Object.entries(payload)) {
    if (blocked.has(field)) {
      skipped.push(field);
      continue;
    }
    const meta = schema.byName.get(field);
    if (!meta) {
      unknown.push(field);
      continue;
    }
    if (rawValue === undefined) continue;
    values[field] = coerceValue(meta, rawValue, field);
  }

  if (unknown.length) {
    throw ApiError.badRequest(
      `Unknown field${unknown.length > 1 ? 's' : ''} for "${table}": ${unknown.join(', ')}.`,
      { table, unknown, allowed: schema.columns.filter((c) => !blocked.has(c)) }
    );
  }

  const missing = required.filter((field) => {
    const value = values[field];
    return value === undefined || value === null || value === '';
  });
  if (missing.length) {
    throw ApiError.badRequest(
      `Missing required field${missing.length > 1 ? 's' : ''}: ${missing.join(', ')}.`,
      { missing }
    );
  }

  return { values, skipped };
}

/** Validate a plain string body field (used by the auth endpoints). */
export function requireString(value, field, { min = 1, max = 255 } = {}) {
  if (typeof value !== 'string') fail(field, 'expected a string.', { expected: 'string' });
  const text = value.trim();
  if (text.length < min) fail(field, `must be at least ${min} characters.`);
  if (text.length > max) fail(field, `must be at most ${max} characters.`);
  return text;
}

export function requireEmail(value) {
  const text = requireString(value, 'email', { min: 3, max: 191 }).toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(text)) fail('email', 'expected a valid email address.');
  return text;
}

export function requirePassword(value, field = 'password') {
  const text = requireString(value, field, { min: 6, max: 128 });
  return text;
}

export function requireOneOf(value, field, allowed) {
  const text = requireString(value, field, { max: 96 });
  if (!allowed.includes(text)) fail(field, `expected one of: ${allowed.join(', ')}.`, { allowed });
  return text;
}

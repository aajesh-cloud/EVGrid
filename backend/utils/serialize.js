/**
 * Row serialisation for the frontend.
 *
 * MySQL types do not map cleanly onto what the React pages expect:
 *   - TINYINT(1) arrives as 0/1 but the UI uses real booleans in `Switch`es
 *   - TIME arrives as "09:00:00" while the booking UI shows "09:00"
 *   - nullable JSON arrays arrive as null instead of `[]`
 *   - the bookings page reads `created_by_id`, the column is `user_id`
 *
 * Everything is applied from the live schema, so only real columns are touched.
 */

import { getTableSchema } from './schemaCache.js';

const HIDDEN_ALWAYS = new Set();

function normaliseTime(value) {
  const text = String(value);
  const match = /^(\d{1,2}):(\d{2})(?::\d{2})?/.exec(text);
  return match ? `${match[1].padStart(2, '0')}:${match[2]}` : text;
}

export async function serialiseRow(table, row, resource = {}) {
  if (!row) return null;
  const schema = await getTableSchema(table);
  const hidden = new Set([...HIDDEN_ALWAYS, ...(resource.hidden || [])]);
  const jsonArrays = new Set(resource.jsonArrayColumns || []);
  const out = {};

  for (const [key, rawValue] of Object.entries(row)) {
    if (hidden.has(key)) continue;
    const meta = schema.byName.get(key);
    let value = rawValue;

    if (meta?.isBoolean && (value === 0 || value === 1)) {
      value = value === 1;
    } else if (meta?.dataType === 'time' && typeof value === 'string') {
      value = normaliseTime(value);
    } else if (jsonArrays.has(key) && value === null) {
      value = [];
    }

    out[key] = value;
  }

  for (const column of jsonArrays) {
    if (!(column in out)) out[column] = [];
  }

  return resource.decorate ? resource.decorate(out) : out;
}

export async function serialiseRows(table, rows, resource = {}) {
  if (!Array.isArray(rows)) return [];
  const schema = await getTableSchema(table);
  const hidden = new Set([...HIDDEN_ALWAYS, ...(resource.hidden || [])]);
  const jsonArrays = new Set(resource.jsonArrayColumns || []);

  return rows.map((row) => {
    const out = {};
    for (const [key, rawValue] of Object.entries(row)) {
      if (hidden.has(key)) continue;
      const meta = schema.byName.get(key);
      let value = rawValue;
      if (meta?.isBoolean && (value === 0 || value === 1)) {
        value = value === 1;
      } else if (meta?.dataType === 'time' && typeof value === 'string') {
        value = normaliseTime(value);
      } else if (jsonArrays.has(key) && value === null) {
        value = [];
      }
      out[key] = value;
    }
    for (const column of jsonArrays) {
      if (!(column in out)) out[column] = [];
    }
    return resource.decorate ? resource.decorate(out) : out;
  });
}

/**
 * Serialise a user record. `role` is the legacy column the UI still reads in a
 * couple of places (`Payments` refund button, `getRoles()`); keep it aligned
 * with `app_role` so an admin is always recognised as one.
 */
export function serialiseUser(row) {
  if (!row) return null;
  const out = { ...row };
  delete out.password_hash;
  delete out.otp_code;
  delete out.otp_expires_at;
  delete out.reset_token_hash;
  delete out.reset_expires_at;

  for (const key of ['notifications_enabled', 'auto_charge_reminders', 'email_verified']) {
    if (out[key] === 0 || out[key] === 1) out[key] = out[key] === 1;
  }

  out.role = out.app_role === 'admin' ? 'admin' : out.role || 'user';
  return out;
}

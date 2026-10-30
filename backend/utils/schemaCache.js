/**
 * Live MySQL schema introspection.
 *
 * Column names, data types, enum values and nullability are read from
 * INFORMATION_SCHEMA instead of being duplicated by hand. That keeps the API
 * honest: filters, sorts, writes and validation all use the real schema, and a
 * schema change (e.g. adding a column) is picked up without touching code.
 *
 * The result is cached in memory per table for the lifetime of the process.
 */

import { query } from '../config/db.js';
import { ApiError } from './ApiError.js';

const cache = new Map();

function parseEnumValues(columnType) {
  const match = /^enum\((.*)\)$/i.exec(String(columnType || ''));
  if (!match) return null;
  const values = [];
  let current = '';
  let inQuote = false;
  for (let i = 0; i < match[1].length; i += 1) {
    const char = match[1][i];
    if (inQuote) {
      if (char === "'") {
        if (match[1][i + 1] === "'") {
          current += "'";
          i += 1;
        } else {
          inQuote = false;
          values.push(current);
          current = '';
        }
      } else {
        current += char;
      }
    } else if (char === "'") {
      inQuote = true;
    }
  }
  return values;
}

/**
 * @returns {Promise<{ columns: string[], byName: Map<string, object> }>}
 */
export async function getTableSchema(table) {
  if (cache.has(table)) return cache.get(table);

  const rows = await query(
    `SELECT COLUMN_NAME, DATA_TYPE, COLUMN_TYPE, IS_NULLABLE,
            CHARACTER_MAXIMUM_LENGTH, COLUMN_DEFAULT, EXTRA
       FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?
      ORDER BY ORDINAL_POSITION`,
    [table]
  );

  if (!rows.length) {
    throw ApiError.serviceUnavailable(
      `Table "${table}" does not exist in the connected database. Run "npm run db:setup" (or import backend/db/schema.sql) first.`,
      { table }
    );
  }

  const byName = new Map();
  for (const row of rows) {
    const dataType = String(row.DATA_TYPE || '').toLowerCase();
    byName.set(row.COLUMN_NAME, {
      name: row.COLUMN_NAME,
      dataType,
      columnType: String(row.COLUMN_TYPE || ''),
      nullable: row.IS_NULLABLE === 'YES',
      maxLength: row.CHARACTER_MAXIMUM_LENGTH ?? null,
      defaultValue: row.COLUMN_DEFAULT,
      autoIncrement: String(row.EXTRA || '').includes('auto_increment'),
      enumValues: parseEnumValues(row.COLUMN_TYPE),
      isBoolean: dataType === 'tinyint' && String(row.COLUMN_TYPE).startsWith('tinyint(1)'),
      isNumeric: ['int', 'tinyint', 'smallint', 'mediumint', 'bigint', 'decimal', 'float', 'double'].includes(dataType),
      isDate: ['date', 'time', 'datetime', 'timestamp'].includes(dataType),
      isJson: dataType === 'json',
    });
  }

  const schema = { columns: [...byName.keys()], byName };
  cache.set(table, schema);
  return schema;
}

/** Invalidate the cache (used after a schema migration while the server runs). */
export function clearSchemaCache() {
  cache.clear();
}

/** Resolve a set of requested column names, rejecting anything not in the table. */
export async function assertColumns(table, names, { label = 'field' } = {}) {
  const schema = await getTableSchema(table);
  const unknown = names.filter((name) => !schema.byName.has(name));
  if (unknown.length) {
    throw ApiError.badRequest(
      `Unknown ${label}${unknown.length > 1 ? 's' : ''} for "${table}": ${unknown.join(', ')}.`,
      { table, unknown, allowed: schema.columns }
    );
  }
  return schema;
}

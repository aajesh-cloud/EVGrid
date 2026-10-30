/**
 * Query-string → SQL translation.
 *
 * Supported protocol (see docs/BACKEND-ENDPOINTS.md section 1):
 *   ?status=paid
 *   ?status[$in]=paid,pending
 *   ?max_power_kw[$gte]=50
 *   ?sort=-created_date&limit=20&skip=40
 *   ?search=volt          (free text over the resource's searchable columns)
 *
 * Every value becomes a bound parameter. Identifiers are checked against the
 * real table columns and wrapped in backticks, so neither filters nor sorts can
 * inject SQL.
 */

import { env } from '../config/env.js';
import { ApiError } from './ApiError.js';
import { getTableSchema } from './schemaCache.js';
import { ownerScopeColumn } from './access.js';

export const RESERVED_QUERY_KEYS = new Set([
  'sort',
  'limit',
  'skip',
  'sum',
  'groupBy',
  'search',
  'page',
]);

const SUPPORTED_OPERATORS = new Set([
  '$eq',
  '$ne',
  '$gt',
  '$gte',
  '$lt',
  '$lte',
  '$in',
  '$nin',
  '$like',
  '$exists',
]);

const IDENTIFIER_RE = /^[A-Za-z_][A-Za-z0-9_]*$/;
const BRACKET_RE = /^([A-Za-z0-9_]+)\[([^\]]+)\]$/;

function quote(identifier) {
  if (!IDENTIFIER_RE.test(String(identifier))) {
    throw ApiError.badRequest(`Invalid identifier "${identifier}".`);
  }
  return `\`${identifier}\``;
}

function normaliseOperator(rawOperator) {
  const op = String(rawOperator || '').startsWith('$') ? String(rawOperator) : `$${rawOperator}`;
  if (!SUPPORTED_OPERATORS.has(op)) {
    throw ApiError.badRequest(
      `Unsupported filter operator "${rawOperator}". Supported: ${[...SUPPORTED_OPERATORS].join(', ')}.`,
      { supported: [...SUPPORTED_OPERATORS] }
    );
  }
  return op;
}

/**
 * Turn the raw query object into `field -> [{ op, value }]`.
 * Handles both the extended parser (`{ status: { $in: 'a,b' } }`) and the
 * simple parser (`{ 'status[$in]': 'a,b' }`) so the server behaves the same
 * regardless of the Express query-parser setting.
 */
function normaliseFilters(query) {
  const filters = new Map();
  const push = (field, op, value) => {
    if (!field || value === undefined || value === null) return;
    if (!filters.has(field)) filters.set(field, []);
    filters.get(field).push({ op: normaliseOperator(op), value });
  };

  for (const [rawKey, rawValue] of Object.entries(query || {})) {
    if (RESERVED_QUERY_KEYS.has(rawKey)) continue;
    if (rawValue === undefined || rawValue === null) continue;

    const bracketed = BRACKET_RE.exec(rawKey);
    if (bracketed) {
      push(bracketed[1], bracketed[2], rawValue);
      continue;
    }

    if (Array.isArray(rawValue)) {
      push(rawKey, '$in', rawValue);
      continue;
    }

    if (typeof rawValue === 'object' && !(rawValue instanceof Date)) {
      for (const [op, operand] of Object.entries(rawValue)) push(rawKey, op, operand);
      continue;
    }

    push(rawKey, '$eq', rawValue);
  }

  return filters;
}

function filterValue(meta, value) {
  if (meta.isBoolean) {
    if (typeof value === 'boolean') return value ? 1 : 0;
    const text = String(value).toLowerCase();
    if (['1', 'true', 'yes', 'on'].includes(text)) return 1;
    if (['0', 'false', 'no', 'off'].includes(text)) return 0;
    return value;
  }
  if (meta.isNumeric) {
    const number = Number(value);
    return Number.isFinite(number) ? number : value;
  }
  return String(value);
}

function toList(value) {
  const raw = Array.isArray(value) ? value : String(value).split(',');
  return raw.map((item) => String(item).trim()).filter((item) => item !== '');
}

/** Build a single `{ sql, params }` fragment, or `null` when it should be ignored. */
function buildCondition(schema, resource, field, op, value) {
  const meta = schema.byName.get(field);
  if (!meta) {
    throw ApiError.badRequest(`Cannot filter by unknown column "${field}".`, {
      field,
      allowed: schema.columns,
    });
  }

  const column = quote(field);
  const isJsonArray = (resource.jsonArrayColumns || []).includes(field);

  if (op === '$exists') {
    const truthy = !['0', 'false', 'no', 'off', ''].includes(String(value).toLowerCase());
    return { sql: `${column} IS ${truthy ? 'NOT ' : ''}NULL`, params: [] };
  }

  if (op === '$in' || op === '$nin') {
    const list = toList(value);
    if (!list.length) return null;
    if (isJsonArray) {
      const contains = list.map(() => `JSON_CONTAINS(${column}, JSON_QUOTE(?))`).join(' OR ');
      const sql = `(${contains})`;
      const params = list.map((item) => String(item));
      return { sql: op === '$in' ? sql : `NOT ${sql}`, params };
    }
    const holes = list.map(() => '?').join(', ');
    const params = list.map((item) => filterValue(meta, item));
    return { sql: `${column} ${op === '$in' ? 'IN' : 'NOT IN'} (${holes})`, params };
  }

  if (op === '$like') {
    const term = `%${String(value)}%`;
    if (isJsonArray) {
      return { sql: `JSON_SEARCH(${column}, 'one', ?) IS NOT NULL`, params: [String(value)] };
    }
    return { sql: `${column} LIKE ?`, params: [term] };
  }

  // Scalar comparison operators.
  if (isJsonArray) {
    const contains = `JSON_CONTAINS(${column}, JSON_QUOTE(?))`;
    const params = [String(value)];
    if (op === '$eq') return { sql: contains, params };
    if (op === '$ne') return { sql: `NOT ${contains}`, params };
    throw ApiError.badRequest(`Operator "${op}" is not supported for the list column "${field}".`);
  }

  if (meta.isJson) {
    // Non-array JSON columns (audit_logs.details) are only compared as text.
    if (op === '$eq') return { sql: `CAST(${column} AS CHAR) = ?`, params: [String(value)] };
    if (op === '$ne') return { sql: `CAST(${column} AS CHAR) <> ?`, params: [String(value)] };
    throw ApiError.badRequest(`Operator "${op}" is not supported for the JSON column "${field}".`);
  }

  const operatorSql = { $eq: '=', $ne: '<>', $gt: '>', $gte: '>=', $lt: '<', $lte: '<=' }[op];
  if (!operatorSql) throw ApiError.badRequest(`Unsupported operator "${op}".`);

  if ((op === '$eq' || op === '$ne') && value === '') return null;

  return { sql: `${column} ${operatorSql} ?`, params: [filterValue(meta, value)] };
}

/**
 * @returns {Promise<{ whereSql: string, params: Array }>}
 */
export async function buildWhere(table, query, resource, user) {
  const schema = await getTableSchema(table);
  const clauses = [];
  const params = [];

  for (const [field, conditions] of normaliseFilters(query)) {
    for (const { op, value } of conditions) {
      const built = buildCondition(schema, resource, field, op, value);
      if (!built) continue;
      clauses.push(built.sql);
      params.push(...built.params);
    }
  }

  const term = typeof query?.search === 'string' ? query.search.trim() : '';
  if (term) {
    const searchable = (resource.searchable || []).filter((column) => schema.byName.has(column));
    if (searchable.length) {
      const pieces = searchable.map((column) => `${quote(column)} LIKE ?`);
      clauses.push(`(${pieces.join(' OR ')})`);
      searchable.forEach(() => params.push(`%${term}%`));
    }
  }

  const scopeColumn = ownerScopeColumn(resource, user);
  if (scopeColumn) {
    if (!user?.id) throw ApiError.unauthorized();
    clauses.push(`${quote(scopeColumn)} = ?`);
    params.push(user.id);
  }

  return {
    whereSql: clauses.length ? `WHERE ${clauses.join(' AND ')}` : '',
    params,
  };
}

export async function buildOrderBy(table, sortParam, resource) {
  const schema = await getTableSchema(table);
  const fallback = resource.defaultSort || '-created_date';
  const raw = sortParam ? String(sortParam) : fallback;
  const parts = [];

  for (const token of raw.split(',')) {
    const trimmed = token.trim();
    if (!trimmed) continue;
    const descending = trimmed.startsWith('-');
    const field = descending ? trimmed.slice(1) : trimmed.replace(/^\+/, '');
    if (!field) continue;
    if (!schema.byName.has(field)) {
      throw ApiError.badRequest(`Cannot sort by unknown column "${field}".`, {
        field,
        allowed: schema.columns,
      });
    }
    parts.push(`${quote(field)} ${descending ? 'DESC' : 'ASC'}`);
  }

  if (!parts.length) parts.push(`${quote('created_date')} DESC`);
  return `ORDER BY ${parts.join(', ')}`;
}

export function buildPagination(query) {
  const limitRaw = Number(query?.limit);
  const skipRaw = Number(query?.skip);
  const limit =
    Number.isFinite(limitRaw) && limitRaw > 0
      ? Math.min(Math.trunc(limitRaw), env.maxLimit)
      : env.defaultLimit;
  const skip = Number.isFinite(skipRaw) && skipRaw > 0 ? Math.trunc(skipRaw) : 0;
  return { limit, skip };
}

/** Build the SELECT list for /aggregate. */
export async function buildAggregateSelect(table, query) {
  const schema = await getTableSchema(table);
  const selects = [];
  const groupByColumns = [];

  const sums = String(query?.sum || '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);

  for (const column of sums) {
    const meta = schema.byName.get(column);
    if (!meta) {
      throw ApiError.badRequest(`Cannot aggregate unknown column "${column}".`, { column });
    }
    if (!meta.isNumeric) {
      throw ApiError.badRequest(`Column "${column}" is not numeric and cannot be summed.`, { column });
    }
    selects.push(`SUM(${quote(column)}) AS ${quote(`sum_${column}`)}`);
  }

  const groups = String(query?.groupBy || '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);

  for (const column of groups) {
    if (!schema.byName.has(column)) {
      throw ApiError.badRequest(`Cannot group by unknown column "${column}".`, { column });
    }
    groupByColumns.push(quote(column));
    selects.push(`${quote(column)} AS ${quote(column)}`);
  }

  selects.push('COUNT(*) AS `count`');

  return {
    selectSql: selects.join(', '),
    groupSql: groupByColumns.length ? `GROUP BY ${groupByColumns.join(', ')}` : '',
  };
}

export { quote };

/**
 * Generic CRUD controller.
 *
 * One set of handlers serves every resource listed in `utils/registry.js`.
 * The handlers never build SQL from raw user input: table and column names come
 * from the registry + live schema, and every value is a bound parameter.
 *
 * Routes implemented (see docs/BACKEND-ENDPOINTS.md §4.1):
 *   GET    /<path>            -> { items, total }
 *   GET    /<path>/count      -> { count }
 *   GET    /<path>/aggregate  -> { rows }
 *   GET    /<path>/:id        -> object
 *   POST   /<path>            -> created object
 *   PATCH  /<path>/:id        -> updated object
 *   DELETE /<path>/:id        -> 204
 *   PATCH  /<path>/bulk       -> { items: [...] }
 *   POST   /<path>/bulk       -> { items: [...] }
 */

import { query, queryOne, txQuery, txQueryOne, withTransaction } from '../config/db.js';
import { ApiError } from '../utils/ApiError.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { isStaff, ownerScopeColumn } from '../utils/access.js';
import { newId } from '../utils/ids.js';
import {
  buildAggregateSelect,
  buildOrderBy,
  buildPagination,
  buildWhere,
  quote,
} from '../utils/queryBuilder.js';
import { serialiseRow, serialiseRows } from '../utils/serialize.js';
import { validatePayload } from '../utils/validate.js';

/* ------------------------------------------------------------------ */
/* Helpers                                                            */
/* ------------------------------------------------------------------ */

/** mysql2 prepared statements cannot serialise plain objects/arrays. */
function toSqlValue(value) {
  if (value === undefined) return null;
  if (value !== null && typeof value === 'object' && !(value instanceof Date)) {
    return JSON.stringify(value);
  }
  return value;
}

/** ` AND \`owner\` = ?` when the caller may only touch their own rows. */
function scopeFragment(resource, user) {
  const column = ownerScopeColumn(resource, user);
  if (!column) return null;
  if (!user?.id) throw ApiError.unauthorized();
  return { sql: ` AND ${quote(column)} = ?`, params: [user.id] };
}

async function findRowWith(one, resource, id, user) {
  const scope = scopeFragment(resource, user);
  const sql = `SELECT * FROM ${quote(resource.table)} WHERE ${quote('id')} = ?${scope ? scope.sql : ''} LIMIT 1`;
  return one(sql, scope ? [id, ...scope.params] : [id]);
}

const findRow = (resource, id, user) => findRowWith(queryOne, resource, id, user);
const selectById = (one, table, id) =>
  one(`SELECT * FROM ${quote(table)} WHERE ${quote('id')} = ? LIMIT 1`, [id]);

function notFound(resource, id) {
  return ApiError.notFound(`No ${resource.table} record with id "${id}".`);
}

/**
 * Personal resources (vehicles, notifications, favourites) and any resource
 * created by a non-staff caller always belong to the caller. Staff may
 * explicitly set the owner when a resource allows it.
 */
function applyOwnerOnCreate(resource, values, user) {
  if (!resource.ownerColumn) return;
  const mustOwn = resource.forceOwnerOnCreate || resource.scope === 'always' || !isStaff(user);
  if (mustOwn || !values[resource.ownerColumn]) {
    values[resource.ownerColumn] = user.id;
  }
}

async function insertRecord(run, table, values, id) {
  const columns = Object.keys(values);
  const names = [quote('id'), ...columns.map(quote)].join(', ');
  const placeholders = ['?', ...columns.map(() => '?')].join(', ');
  await run(`INSERT INTO ${quote(table)} (${names}) VALUES (${placeholders})`, [
    id,
    ...columns.map((column) => toSqlValue(values[column])),
  ]);
}

async function updateRecord(run, table, id, values) {
  const columns = Object.keys(values);
  if (!columns.length) return;
  const assignments = columns.map((column) => `${quote(column)} = ?`).join(', ');
  await run(`UPDATE ${quote(table)} SET ${assignments} WHERE ${quote('id')} = ?`, [
    ...columns.map((column) => toSqlValue(values[column])),
    id,
  ]);
}

function readItems(body) {
  const items = body?.items;
  if (!Array.isArray(items) || !items.length) {
    throw ApiError.badRequest('Request body must be { items: [ ... ] } with at least one entry.', {
      field: 'items',
    });
  }
  return items;
}

/* ------------------------------------------------------------------ */
/* Handlers                                                           */
/* ------------------------------------------------------------------ */

export const list = asyncHandler(async (req, res) => {
  const { resource, user } = req;
  const { whereSql, params } = await buildWhere(resource.table, req.query, resource, user);
  const orderSql = await buildOrderBy(resource.table, req.query.sort, resource);
  const { limit, skip } = buildPagination(req.query);

  const rows = await query(
    `SELECT * FROM ${quote(resource.table)} ${whereSql} ${orderSql} LIMIT ${limit} OFFSET ${skip}`,
    params
  );
  const totalRow = await queryOne(
    `SELECT COUNT(*) AS total FROM ${quote(resource.table)} ${whereSql}`,
    params
  );

  res.json({
    items: await serialiseRows(resource.table, rows, resource),
    total: Number(totalRow?.total || 0),
  });
});

export const count = asyncHandler(async (req, res) => {
  const { resource, user } = req;
  const { whereSql, params } = await buildWhere(resource.table, req.query, resource, user);
  const row = await queryOne(
    `SELECT COUNT(*) AS count FROM ${quote(resource.table)} ${whereSql}`,
    params
  );
  res.json({ count: Number(row?.count || 0) });
});

export const aggregate = asyncHandler(async (req, res) => {
  const { resource, user } = req;
  const { whereSql, params } = await buildWhere(resource.table, req.query, resource, user);
  const { selectSql, groupSql } = await buildAggregateSelect(resource.table, req.query);
  const rows = await query(
    `SELECT ${selectSql} FROM ${quote(resource.table)} ${whereSql} ${groupSql}`,
    params
  );
  res.json({ rows: Array.isArray(rows) ? rows : [] });
});

export const getOne = asyncHandler(async (req, res) => {
  const row = await findRow(req.resource, req.params.id, req.user);
  if (!row) throw notFound(req.resource, req.params.id);
  res.json(await serialiseRow(req.resource.table, row, req.resource));
});

export const create = asyncHandler(async (req, res) => {
  const { resource, user } = req;
  const { values } = await validatePayload(resource.table, req.body, {
    required: resource.requiredOnCreate,
    immutable: resource.immutable,
  });
  applyOwnerOnCreate(resource, values, user);

  const id = newId();
  await insertRecord(query, resource.table, values, id);

  const row = (await findRow(resource, id, user)) ?? (await selectById(queryOne, resource.table, id));
  res.status(201).json(await serialiseRow(resource.table, row, resource));
});

export const update = asyncHandler(async (req, res) => {
  const { resource, user } = req;
  const existing = await findRow(resource, req.params.id, user);
  if (!existing) throw notFound(resource, req.params.id);

  const { values } = await validatePayload(resource.table, req.body, {
    immutable: resource.immutable,
  });
  await updateRecord(query, resource.table, req.params.id, values);

  const row = await selectById(queryOne, resource.table, req.params.id);
  res.json(await serialiseRow(resource.table, row, resource));
});

export const remove = asyncHandler(async (req, res) => {
  const { resource, user } = req;
  const existing = await findRow(resource, req.params.id, user);
  if (!existing) throw notFound(resource, req.params.id);

  await query(`DELETE FROM ${quote(resource.table)} WHERE ${quote('id')} = ?`, [req.params.id]);
  res.status(204).end();
});

export const bulkUpdate = asyncHandler(async (req, res) => {
  const { resource, user } = req;
  const items = readItems(req.body);

  const updated = await withTransaction(async (connection) => {
    const run = (sql, params) => txQuery(connection, sql, params);
    const one = (sql, params) => txQueryOne(connection, sql, params);
    const results = [];

    for (const item of items) {
      const { id, ...patch } = item || {};
      if (!id) throw ApiError.badRequest('Every bulk item must include an "id".', { field: 'id' });
      const existing = await findRowWith(one, resource, id, user);
      if (!existing) throw notFound(resource, id);

      const { values } = await validatePayload(resource.table, patch, {
        immutable: resource.immutable,
      });
      await updateRecord(run, resource.table, id, values);
      results.push(await selectById(one, resource.table, id));
    }

    return results;
  });

  res.json({ items: await serialiseRows(resource.table, updated, resource) });
});

export const bulkCreate = asyncHandler(async (req, res) => {
  const { resource, user } = req;
  const items = readItems(req.body);

  const created = await withTransaction(async (connection) => {
    const run = (sql, params) => txQuery(connection, sql, params);
    const one = (sql, params) => txQueryOne(connection, sql, params);
    const results = [];

    for (const item of items) {
      const { values } = await validatePayload(resource.table, item, {
        required: resource.requiredOnCreate,
        immutable: resource.immutable,
      });
      applyOwnerOnCreate(resource, values, user);

      const id = newId();
      await insertRecord(run, resource.table, values, id);
      results.push(await selectById(one, resource.table, id));
    }

    return results;
  });

  res.status(201).json({ items: await serialiseRows(resource.table, created, resource) });
});

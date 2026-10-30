/**
 * MySQL connection pool (mysql2/promise).
 *
 * Every SQL statement in the application goes through `query`/`withTransaction`
 * so that it is always executed as a parameterised statement — user input is
 * never concatenated into SQL text.
 */

import mysql from 'mysql2/promise';
import { dbConfig } from './env.js';

export const pool = mysql.createPool(dbConfig);

/**
 * Run a single parameterised statement.
 * @param {string} sql   SQL text with `?` placeholders
 * @param {Array}  params
 * @returns {Promise<Array|object>} rows for SELECT, result metadata otherwise
 */
export async function query(sql, params = []) {
  const [rows] = await pool.execute(sql, params);
  return rows;
}

/** Convenience wrapper returning only the first row (or null). */
export async function queryOne(sql, params = []) {
  const rows = await query(sql, params);
  return Array.isArray(rows) ? rows[0] ?? null : rows;
}

/**
 * Run `fn(connection)` inside a transaction. Rolls back on any throw.
 * Use for multi-table operations (booking creation, session lifecycle,
 * payment settlement).
 */
export async function withTransaction(fn) {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const result = await fn(connection);
    await connection.commit();
    return result;
  } catch (error) {
    try {
      await connection.rollback();
    } catch {
      /* the connection may already be dead — the original error matters more */
    }
    throw error;
  } finally {
    connection.release();
  }
}

/** Parameterised statement bound to a transaction connection. */
export async function txQuery(connection, sql, params = []) {
  const [rows] = await connection.execute(sql, params);
  return rows;
}

export async function txQueryOne(connection, sql, params = []) {
  const rows = await txQuery(connection, sql, params);
  return Array.isArray(rows) ? rows[0] ?? null : rows;
}

/** Health probe used by GET /api/health. */
export async function checkDatabase() {
  const rows = await query('SELECT 1 AS ok');
  return rows?.[0]?.ok === 1;
}

export async function closePool() {
  await pool.end();
}

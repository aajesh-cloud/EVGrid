/**
 * `npm run db:setup`
 *
 * Creates the configured database (if absent) and applies `db/schema.sql`.
 * The script is idempotent — every statement uses CREATE TABLE IF NOT EXISTS —
 * and it inserts no rows.
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import mysql from 'mysql2/promise';
import { BACKEND_ROOT, dbConfig } from '../config/env.js';

const IDENTIFIER_RE = /^[A-Za-z_][A-Za-z0-9_]*$/;

async function main() {
  const { database } = dbConfig;
  if (!IDENTIFIER_RE.test(String(database))) {
    throw new Error(`DB_NAME "${database}" is not a valid MySQL identifier.`);
  }

  const schemaPath = path.join(BACKEND_ROOT, 'db', 'schema.sql');
  const sql = await fs.readFile(schemaPath, 'utf8');

  const connection = await mysql.createConnection({
    host: dbConfig.host,
    port: dbConfig.port,
    user: dbConfig.user,
    password: dbConfig.password,
    multipleStatements: true,
    connectTimeout: dbConfig.connectTimeout,
    ...(dbConfig.ssl ? { ssl: dbConfig.ssl } : {}),
  });

  try {
    console.info(`[evgrid] Connected to MySQL at ${dbConfig.host}:${dbConfig.port} as ${dbConfig.user}.`);

    // Hosted MySQL (Aiven, Clever Cloud, PlanetScale, Railway, TiDB Cloud …)
    // normally creates the database for you and does not grant CREATE DATABASE.
    // Fall back to applying the schema to the database that already exists.
    try {
      await connection.query(
        `CREATE DATABASE IF NOT EXISTS \`${database}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`
      );
    } catch (error) {
      const denied = ['ER_DBACCESS_DENIED_ERROR', 'ER_ACCESS_DENIED_ERROR'].includes(error.code);
      if (!denied) throw error;
      console.info(
        `[evgrid] No permission to CREATE DATABASE — applying the schema to the existing "${database}" database.`
      );
    }

    await connection.query(`USE \`${database}\``);
    await connection.query(sql);

    const [tables] = await connection.query(
      `SELECT TABLE_NAME AS name FROM information_schema.TABLES WHERE TABLE_SCHEMA = ? ORDER BY TABLE_NAME`,
      [database]
    );
    if (!tables.length) {
      throw new Error(`The database "${database}" has no tables — check DB_NAME and your MySQL permissions.`);
    }
    console.info(`[evgrid] Schema applied to "${database}". ${tables.length} tables present:`);
    console.info(`         ${tables.map((t) => t.name).join(', ')}`);
    console.info('[evgrid] No rows were inserted — run "npm run seed" for sample stations,');
    console.info('[evgrid] or register an account in the app to create your own data.');
  } finally {
    await connection.end();
  }
}

main().catch((error) => {
  console.error('[evgrid] db:setup failed:', error.message);
  if (error.code === 'ER_ACCESS_DENIED_ERROR') {
    console.error('[evgrid] Check DB_USER / DB_PASSWORD in backend/.env.');
  } else if (error.code === 'ECONNREFUSED') {
    console.error('[evgrid] Check that MySQL is running and DB_HOST / DB_PORT are correct.');
  } else if (error.code === 'ER_BAD_DB_ERROR') {
    console.error('[evgrid] The database does not exist and this user cannot create it. Create it in your provider dashboard, then re-run.');
  } else if (/certificate|TLS|SSL/i.test(error.message)) {
    console.error('[evgrid] TLS negotiation failed — try DB_SSL=require (or DB_SSL=verify with DB_SSL_CA).');
  }
  process.exit(1);
});

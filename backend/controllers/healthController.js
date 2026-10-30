/**
 * GET /api/health — used by the Settings page connection test.
 *
 * Verifies the MySQL pool with a real round-trip, not just that Express is up.
 */

import { checkDatabase } from '../config/db.js';
import { env } from '../config/env.js';

export async function health(req, res) {
  const startedAt = process.hrtime.bigint();
  try {
    await checkDatabase();
  } catch (error) {
    res.status(503).json({
      status: 'error',
      db: 'disconnected',
      message: env.isProduction
        ? 'The database is not reachable.'
        : `The database is not reachable: ${error.message}`,
      environment: env.nodeEnv,
      uptime: Math.round(process.uptime()),
    });
    return;
  }

  const latencyMs = Number(process.hrtime.bigint() - startedAt) / 1e6;
  res.json({
    status: 'ok',
    db: 'connected',
    latency_ms: Math.round(latencyMs * 100) / 100,
    environment: env.nodeEnv,
    uptime: Math.round(process.uptime()),
    timestamp: new Date().toISOString(),
  });
}

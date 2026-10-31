/**
 * EVGrid API server — Express + MySQL.
 *
 *   npm run server          start the API (http://localhost:5000/api)
 *   npm run server:dev      same, with Node's watch mode
 *   npm run db:setup        create the database + tables from backend/db/schema.sql
 *
 * Database credentials are read from backend/.env and never leave this process.
 */

import express from 'express';
import cors from 'cors';
import { env, normaliseOrigin } from './config/env.js';
import { checkDatabase, closePool } from './config/db.js';
import apiRoutes from './routes/index.js';
import { notFound } from './middleware/notFound.js';
import { errorHandler } from './middleware/errorHandler.js';
import { isMailConfigured, verifyMailer } from './utils/mailer.js';

const app = express();

app.disable('x-powered-by');
app.set('trust proxy', true);

/* ------------------------------------------------------------------ */
/* CORS — only the configured front-end origins may call the API      */
/* ------------------------------------------------------------------ */

function isAllowedOrigin(origin) {
  if (!origin) return true; // same-origin, curl, server-to-server
  const requested = normaliseOrigin(origin);
  if (env.corsOrigins.includes(requested)) return true;
  if (!env.isProduction && /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(requested)) return true;
  // Logged so a blocked request is visible in the host's logs instead of
  // surfacing only as a vague "Cannot reach the EVGrid API" in the browser.
  console.warn(
    `[evgrid] CORS blocked ${requested} — allowed: ${env.corsOrigins.join(', ') || '(none)'}`
  );
  return false;
}

app.use(
  cors({
    origin(origin, callback) {
      if (isAllowedOrigin(origin)) {
        callback(null, true);
        return;
      }
      callback(null, false);
    },
    methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Accept'],
    exposedHeaders: ['Content-Length'],
    maxAge: 600,
  })
);

/* ------------------------------------------------------------------ */
/* Body parsing + request logging                                     */
/* ------------------------------------------------------------------ */

app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));

if (!env.isProduction) {
  app.use((req, res, next) => {
    const startedAt = Date.now();
    res.on('finish', () => {
      console.info(`[evgrid] ${req.method} ${req.originalUrl} → ${res.statusCode} (${Date.now() - startedAt}ms)`);
    });
    next();
  });
}

/* ------------------------------------------------------------------ */
/* Routes                                                             */
/* ------------------------------------------------------------------ */

app.get('/', (req, res) => {
  res.json({
    name: 'EVGrid API',
    api: env.apiPrefix,
    health: `${env.apiPrefix}/health`,
    docs: 'docs/BACKEND-ENDPOINTS.md',
  });
});

app.use(env.apiPrefix, apiRoutes);

app.use(notFound);
app.use(errorHandler);

/* ------------------------------------------------------------------ */
/* Start                                                              */
/* ------------------------------------------------------------------ */

const server = app.listen(env.port, () => {
  console.info(`[evgrid] API listening on http://localhost:${env.port}${env.apiPrefix}`);
  console.info(`[evgrid] environment: ${env.nodeEnv} · CORS origins: ${env.corsOrigins.join(', ')}`);

  checkDatabase()
    .then(() => console.info('[evgrid] MySQL connection pool is ready.'))
    .catch((error) => {
      console.error(
        `[evgrid] MySQL is not reachable yet: ${error.message}\n` +
          '[evgrid] The API is running, but data endpoints will fail until the database is configured.\n' +
          '[evgrid] Set DB_* in backend/.env, then run "npm run db:setup".'
      );
    });

  // Validates the Gmail credentials once, so a bad app password is reported at
  // start-up instead of on the first registration. Never fatal: the API stays up.
  if (isMailConfigured()) {
    verifyMailer()
      .then(() => console.info(`[evgrid] SMTP ready — verification email is sent from ${env.smtp.from}.`))
      .catch((error) => {
        console.error(
          `[evgrid] SMTP login failed: ${error.message}\n` +
            '[evgrid] Check SMTP_USER and SMTP_PASSWORD in backend/.env. Gmail requires a 16-character ' +
            'App Password (Account → Security → 2-Step Verification → App passwords).'
        );
      });
  } else if (env.isProduction) {
    console.error(
      '[evgrid] SMTP is not configured — registration and resend will fail with 503 until ' +
        'SMTP_USER / SMTP_PASSWORD are set in backend/.env.'
    );
  } else {
    console.warn(
      '[evgrid] SMTP is not configured — verification codes will be printed to this console ' +
        '(development only). Set SMTP_USER / SMTP_PASSWORD in backend/.env to send real email.'
    );
  }
});

function shutdown(signal) {
  console.info(`[evgrid] ${signal} received — shutting down.`);
  server.close(async () => {
    try {
      await closePool();
    } catch (error) {
      console.error('[evgrid] Error closing the MySQL pool:', error.message);
    }
    process.exit(0);
  });
  // Do not hang forever if a connection refuses to close.
  setTimeout(() => process.exit(1), 10000).unref();
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

export default app;

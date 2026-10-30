/**
 * Environment configuration for the EVGrid backend.
 *
 * Loads `backend/.env` (never committed) and exposes a frozen config object.
 * Database credentials live only here — they are never sent to the frontend.
 */

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';

const here = path.dirname(fileURLToPath(import.meta.url));
export const BACKEND_ROOT = path.resolve(here, '..');

// `quiet: true` keeps dotenv from printing the config banner on every start.
dotenv.config({ path: path.join(BACKEND_ROOT, '.env'), quiet: true });

const num = (value, fallback) => {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
};

const bool = (value, fallback = false) => {
  if (value === undefined || value === '') return fallback;
  return ['1', 'true', 'yes', 'on'].includes(String(value).toLowerCase());
};

const nodeEnv = process.env.NODE_ENV || 'development';

/**
 * JWT secret. A missing secret is a hard configuration mistake in production;
 * in development we fall back to an ephemeral secret so the server still boots
 * (tokens simply stop working after a restart).
 */
let jwtSecret = process.env.JWT_SECRET || '';
if (!jwtSecret) {
  jwtSecret = crypto.randomBytes(32).toString('hex');
  if (nodeEnv === 'production') {
    throw new Error('JWT_SECRET must be set when NODE_ENV=production.');
  }
  console.warn(
    '[evgrid] JWT_SECRET is not set — using an ephemeral development secret. ' +
      'Tokens will be invalidated on every restart. Add JWT_SECRET to backend/.env.'
  );
}

/**
 * Gmail SMTP. The app password is stripped of whitespace because Google
 * displays it in four space-separated groups ('abcd efgh ijkl mnop'), and
 * pasting it verbatim is the most common cause of a 535 login failure.
 *
 * Credentials live only in backend/.env and are passed to Nodemailer inside
 * this process; nothing here is ever serialised into an API response.
 */
const smtpPort = num(process.env.SMTP_PORT, 465);
const smtpUser = (process.env.SMTP_USER || '').trim();
const smtpPassword = (process.env.SMTP_PASSWORD || '').replace(/\s+/g, '');

export const smtpConfig = Object.freeze({
  host: (process.env.SMTP_HOST || 'smtp.gmail.com').trim(),
  port: smtpPort,
  // 465 = implicit TLS (Gmail's default), 587 = STARTTLS.
  secure: bool(process.env.SMTP_SECURE, smtpPort === 465),
  user: smtpUser,
  password: smtpPassword,
  fromName: (process.env.MAIL_FROM_NAME || 'EVGrid').trim(),
  from: (process.env.MAIL_FROM || smtpUser).trim(),
  connectionTimeoutMs: num(process.env.SMTP_CONNECTION_TIMEOUT, 10000),
  socketTimeoutMs: num(process.env.SMTP_SOCKET_TIMEOUT, 20000),
  // Delivery needs both halves of the credential pair.
  configured: Boolean(smtpUser && smtpPassword),
});

export const env = Object.freeze({
  nodeEnv,
  isProduction: nodeEnv === 'production',
  port: num(process.env.PORT, 5000),
  apiPrefix: process.env.API_PREFIX || '/api',
  corsOrigins: (process.env.CORS_ORIGINS || 'http://localhost:5173')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean),
  jwtSecret,
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '12h',
  otpLength: num(process.env.OTP_LENGTH, 6),
  otpTtlMinutes: num(process.env.OTP_TTL_MINUTES, 10),
  resetTtlMinutes: num(process.env.RESET_TOKEN_TTL_MINUTES, 60),
  bcryptRounds: num(process.env.BCRYPT_ROUNDS, 10),
  // Resend limits for verification codes (enforced per email address).
  otpResendCooldownSeconds: num(process.env.OTP_RESEND_COOLDOWN_SECONDS, 60),
  otpResendWindowMinutes: num(process.env.OTP_RESEND_WINDOW_MINUTES, 15),
  otpMaxSendsPerWindow: num(process.env.OTP_MAX_SENDS_PER_WINDOW, 5),
  defaultLimit: num(process.env.DB_DEFAULT_LIMIT, 250),
  maxLimit: num(process.env.DB_MAX_LIMIT, 1000),
  smtp: smtpConfig,
});

/**
 * Optional TLS for hosted MySQL (Aiven, Clever Cloud, PlanetScale, Railway,
 * TiDB Cloud …). A local MySQL server normally does not need it.
 *
 *   DB_SSL=require   encrypt the connection, do not verify the certificate
 *   DB_SSL=verify    encrypt and verify it (uses DB_SSL_CA when supplied)
 *   unset / disable  plain connection
 *
 * `DB_SSL_CA` accepts either the PEM text itself or a path to a .pem file.
 */
function resolveSslCa() {
  const raw = (process.env.DB_SSL_CA || '').trim();
  if (!raw) return undefined;
  if (raw.includes('BEGIN CERTIFICATE')) return raw.replace(/\\n/g, '\n');
  try {
    return fs.readFileSync(raw, 'utf8');
  } catch (error) {
    throw new Error(
      `DB_SSL_CA is set to "${raw}" but that file could not be read: ${error.message}`
    );
  }
}

function resolveSsl() {
  const mode = (process.env.DB_SSL || '').trim().toLowerCase();
  if (!mode || ['disable', 'disabled', 'false', 'off', 'no', '0'].includes(mode)) return undefined;
  const ca = resolveSslCa();
  return {
    rejectUnauthorized: mode === 'verify',
    ...(ca ? { ca } : {}),
  };
}

const sslConfig = resolveSsl();

export const dbConfig = Object.freeze({
  host: process.env.DB_HOST || '127.0.0.1',
  port: num(process.env.DB_PORT, 3306),
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'evgrid',
  ...(sslConfig ? { ssl: sslConfig } : {}),
  waitForConnections: true,
  connectionLimit: num(process.env.DB_POOL_LIMIT, 10),
  queueLimit: 0,
  charset: 'utf8mb4_unicode_ci',
  // DECIMAL columns (`price_per_kwh`, `amount`, `cost`, …) are returned as
  // numbers so charts and `Number()` calls in the UI do not have to parse
  // strings like "18.00".
  decimalNumbers: true,
  // DATE columns are returned as "YYYY-MM-DD" strings. Without this, mysql2
  // inflates them into Date objects and the UTC shift can move the day
  // backwards for +05:30 style timezones, which would show the wrong date.
  dateStrings: ['DATE'],
  timezone: 'local',
  namedPlaceholders: false,
  multipleStatements: false,
  connectTimeout: num(process.env.DB_CONNECT_TIMEOUT, 10000),
});

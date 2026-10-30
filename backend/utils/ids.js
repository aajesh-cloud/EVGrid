/**
 * Identifier / secret generation helpers.
 */

import crypto from 'node:crypto';

/** CHAR(36) primary key. The frontend treats ids as opaque strings. */
export function newId() {
  return crypto.randomUUID();
}

/** Numeric one-time password, returned as a zero-padded string. */
export function newOtp(length = 6) {
  const max = 10 ** length;
  const value = crypto.randomInt(0, max);
  return String(value).padStart(length, '0');
}

/** Opaque token for the password-reset link. */
export function newResetToken() {
  return crypto.randomBytes(32).toString('hex');
}

/** Password-reset links are stored hashed, never in clear text. */
export function hashToken(token) {
  return crypto.createHash('sha256').update(String(token)).digest('hex');
}

function compactDate(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}${month}${day}`;
}

/** Human-readable, effectively unique invoice number: INV-YYYYMMDD-XXXXXX. */
export function newInvoiceNumber() {
  const suffix = crypto.randomBytes(3).toString('hex').toUpperCase();
  return `INV-${compactDate()}-${suffix}`;
}

/** Reference recorded against a settled mock payment. */
export function newTransactionRef() {
  return `MOCK-${crypto.randomBytes(6).toString('hex').toUpperCase()}`;
}

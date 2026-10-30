/**
 * Authentication: registration with email OTP, login, profile, password reset.
 *
 * Passwords are hashed with bcrypt; OTPs and password-reset tokens are stored
 * hashed with an expiry. No credential or hash is ever sent to the client.
 *
 * Verification codes are delivered over Gmail SMTP (see `utils/mailer.js`).
 * A missing or failing mail server is a hard error in production. In
 * development the code is additionally logged to the console and returned in
 * the response so the flow stays usable without a mailbox; production
 * responses never contain it.
 */

import { env } from '../config/env.js';
import { query, queryOne } from '../config/db.js';
import { ApiError } from '../utils/ApiError.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { isMailConfigured, sendOtpEmail } from '../utils/mailer.js';
import { hashSecret, verifySecret } from '../utils/password.js';
import { hashToken, newId, newOtp, newResetToken } from '../utils/ids.js';
import { serialiseUser } from '../utils/serialize.js';
import { consume } from '../utils/throttle.js';
import { signAccessToken } from '../utils/tokens.js';
import { requireEmail, requirePassword, requireString, validatePayload } from '../utils/validate.js';

/** Columns a client may never set through the profile endpoint. */
const PROFILE_IMMUTABLE = [
  'email',
  'password_hash',
  'email_verified',
  'otp_code',
  'otp_expires_at',
  'reset_token_hash',
  'reset_expires_at',
  'last_login_at',
  'app_role',
  'role',
];

const EXPIRY_SQL = (minutes) => `DATE_ADD(NOW(), INTERVAL ${Number(minutes)} MINUTE)`;

function logOtp(email, otp, purpose) {
  console.info(`[evgrid] ${purpose} code for ${email}: ${otp} (valid ${env.otpTtlMinutes} min)`);
}

/** In non-production the OTP is returned so the flow is testable without SMTP. */
function exposeOtp(otp) {
  return env.isProduction ? {} : { otp };
}

async function issueOtp(userId, otp) {
  const hash = await hashSecret(otp);
  await query(
    `UPDATE \`users\` SET \`otp_code\` = ?, \`otp_expires_at\` = ${EXPIRY_SQL(env.otpTtlMinutes)}
      WHERE \`id\` = ?`,
    [hash, userId]
  );
}

/**
 * Resend limits: a short cooldown between two requests plus a cap per window,
 * tracked per email address. Applied before any database lookup on
 * `/auth/resend-otp` so a throttled address behaves identically whether or not
 * an account exists for it.
 */
function guardOtpRequest(email) {
  const verdict = consume(`otp:${email.toLowerCase()}`, {
    windowMs: env.otpResendWindowMinutes * 60_000,
    max: env.otpMaxSendsPerWindow,
    minIntervalMs: env.otpResendCooldownSeconds * 1000,
  });

  if (verdict.allowed) return;

  const message =
    verdict.reason === 'cooldown'
      ? `Please wait ${verdict.retryAfterSeconds} seconds before requesting another code.`
      : `Too many verification codes were requested for this address. Try again in ${Math.ceil(verdict.retryAfterSeconds / 60)} minutes.`;

  throw new ApiError(429, message, {
    code: 'otp_rate_limited',
    details: { reason: verdict.reason, retry_after_seconds: verdict.retryAfterSeconds },
  });
}

/**
 * Delivers a verification code by email.
 *
 * Resolves `true` when Gmail accepted the message. Outside production a missing
 * mail server (or a delivery failure) is logged and reported as `false` so the
 * OTP flow still works — the code is then read from the console/response. In
 * production both cases raise a descriptive error instead.
 */
async function deliverOtp(email, otp, fullName) {
  if (!isMailConfigured()) {
    if (env.isProduction) {
      throw new ApiError(503, 'Email delivery is not configured on this server.', {
        code: 'email_not_configured',
        details: { hint: 'Set SMTP_USER and SMTP_PASSWORD in backend/.env.' },
      });
    }
    logOtp(email, otp, 'Verification');
    return false;
  }

  try {
    const { messageId } = await sendOtpEmail(email, {
      otp,
      ttlMinutes: env.otpTtlMinutes,
      fullName,
    });
    console.info(`[evgrid] Verification email sent to ${email} (${messageId}).`);
    return true;
  } catch (error) {
    console.error(`[evgrid] Could not email ${email}: ${error.message}`);

    if (env.isProduction) {
      throw new ApiError(502, 'We could not send the verification email. Please try again shortly.', {
        code: 'email_delivery_failed',
        details: { driverCode: error.code || null, responseCode: error.responseCode || null },
      });
    }

    console.warn('[evgrid] Falling back to the console for development.');
    logOtp(email, otp, 'Verification');
    return false;
  }
}

/* ------------------------------------------------------------------ */
/* Registration + OTP                                                 */
/* ------------------------------------------------------------------ */

export const register = asyncHandler(async (req, res) => {
  const email = requireEmail(req.body?.email);
  const password = requirePassword(req.body?.password);
  const fullName =
    req.body?.full_name === undefined || req.body?.full_name === null
      ? null
      : requireString(req.body.full_name, 'full_name', { min: 1, max: 191 });

  const existing = await queryOne('SELECT * FROM `users` WHERE `email` = ? LIMIT 1', [email]);
  if (existing?.email_verified) {
    throw ApiError.conflict('An account with this email already exists. Please sign in instead.');
  }

  // Never send more than the configured number of codes to one address.
  guardOtpRequest(email);

  const passwordHash = await hashSecret(password);
  const otp = newOtp(env.otpLength);

  if (existing) {
    // Re-registration before verification: refresh the pending account.
    await query(
      `UPDATE \`users\` SET \`password_hash\` = ?, \`full_name\` = COALESCE(?, \`full_name\`)
        WHERE \`id\` = ?`,
      [passwordHash, fullName, existing.id]
    );
    await issueOtp(existing.id, otp);
  } else {
    await query(
      `INSERT INTO \`users\` (\`id\`, \`email\`, \`password_hash\`, \`full_name\`, \`app_role\`, \`role\`, \`email_verified\`)
       VALUES (?, ?, ?, ?, 'ev_user', 'user', 0)`,
      [newId(), email, passwordHash, fullName]
    );
    const created = await queryOne('SELECT \`id\` FROM \`users\` WHERE \`email\` = ? LIMIT 1', [email]);
    await issueOtp(created.id, otp);
  }

  const delivered = await deliverOtp(email, otp, fullName);

  res.status(201).json({
    message: delivered
      ? `A verification code was sent to ${email}.`
      : 'Email delivery is unavailable, so the verification code was printed to the server console.',
    expires_in_minutes: env.otpTtlMinutes,
    email_sent: delivered,
    ...exposeOtp(otp),
  });
});

export const verifyOtp = asyncHandler(async (req, res) => {
  const email = requireEmail(req.body?.email);
  const otp = requireString(req.body?.otp, 'otp', { min: env.otpLength, max: env.otpLength });

  const user = await queryOne('SELECT * FROM `users` WHERE `email` = ? LIMIT 1', [email]);
  if (!user) throw ApiError.badRequest('No pending registration was found for this email.');

  if (!user.otp_code) {
    throw ApiError.badRequest('There is no active verification code. Request a new one.');
  }
  const expiresAt = user.otp_expires_at ? new Date(user.otp_expires_at) : null;
  if (!expiresAt || expiresAt.getTime() < Date.now()) {
    throw new ApiError(400, 'This verification code has expired. Request a new one.', {
      code: 'otp_expired',
    });
  }
  const matches = await verifySecret(otp, user.otp_code);
  if (!matches) throw ApiError.badRequest('That verification code is not correct.');

  await query(
    `UPDATE \`users\`
        SET \`email_verified\` = 1, \`otp_code\` = NULL, \`otp_expires_at\` = NULL, \`last_login_at\` = NOW()
      WHERE \`id\` = ?`,
    [user.id]
  );

  const fresh = await queryOne('SELECT * FROM `users` WHERE `id` = ? LIMIT 1', [user.id]);
  res.json({
    access_token: signAccessToken(fresh),
    token_type: 'Bearer',
    expires_in: env.jwtExpiresIn,
    user: serialiseUser(fresh),
  });
});

export const resendOtp = asyncHandler(async (req, res) => {
  const email = requireEmail(req.body?.email);

  // Throttled before the lookup: the same 429 is returned for known and
  // unknown addresses, so the limiter cannot be used to probe for accounts.
  guardOtpRequest(email);

  const user = await queryOne('SELECT * FROM `users` WHERE `email` = ? LIMIT 1', [email]);

  // Do not reveal whether the address exists.
  const message = `If ${email} has a pending registration, a new code has been sent.`;
  if (!user || user.email_verified) {
    res.json({ message, expires_in_minutes: env.otpTtlMinutes });
    return;
  }

  const otp = newOtp(env.otpLength);
  await issueOtp(user.id, otp);
  const delivered = await deliverOtp(email, otp, user.full_name);

  res.json({
    message,
    expires_in_minutes: env.otpTtlMinutes,
    email_sent: delivered,
    ...exposeOtp(otp),
  });
});

/* ------------------------------------------------------------------ */
/* Session                                                            */
/* ------------------------------------------------------------------ */

export const login = asyncHandler(async (req, res) => {
  const email = requireEmail(req.body?.email);
  const password = requirePassword(req.body?.password);

  const user = await queryOne('SELECT * FROM `users` WHERE `email` = ? LIMIT 1', [email]);
  const genericFailure = ApiError.unauthorized('The email or password is incorrect.');

  if (!user || !user.password_hash) throw genericFailure;
  const matches = await verifySecret(password, user.password_hash);
  if (!matches) throw genericFailure;

  if (!user.email_verified) {
    throw new ApiError(403, 'Your email address is not verified yet. Enter the code we emailed you.', {
      code: 'email_not_verified',
      details: { email },
    });
  }

  await query('UPDATE `users` SET `last_login_at` = NOW() WHERE `id` = ?', [user.id]);
  const fresh = await queryOne('SELECT * FROM `users` WHERE `id` = ? LIMIT 1', [user.id]);

  res.json({
    access_token: signAccessToken(fresh),
    token_type: 'Bearer',
    expires_in: env.jwtExpiresIn,
    user: serialiseUser(fresh),
  });
});

export const me = asyncHandler(async (req, res) => {
  res.json(serialiseUser(req.user));
});

export const updateMe = asyncHandler(async (req, res) => {
  const { values } = await validatePayload('users', req.body, { immutable: PROFILE_IMMUTABLE });

  if (Object.keys(values).length) {
    const assignments = Object.keys(values)
      .map((column) => `\`${column}\` = ?`)
      .join(', ');
    await query(`UPDATE \`users\` SET ${assignments} WHERE \`id\` = ?`, [
      ...Object.values(values).map((value) =>
        value !== null && typeof value === 'object' ? JSON.stringify(value) : value
      ),
      req.user.id,
    ]);
  }

  const fresh = await queryOne('SELECT * FROM `users` WHERE `id` = ? LIMIT 1', [req.user.id]);
  res.json(serialiseUser(fresh));
});

export const logout = asyncHandler(async (req, res) => {
  // Stateless JWTs: the client discards the token. Nothing to invalidate here.
  res.status(204).end();
});

/* ------------------------------------------------------------------ */
/* Password reset                                                     */
/* ------------------------------------------------------------------ */

export const forgotPassword = asyncHandler(async (req, res) => {
  const email = requireEmail(req.body?.email);
  const user = await queryOne('SELECT * FROM `users` WHERE `email` = ? LIMIT 1', [email]);

  const message = `If an account exists for ${email}, a password reset link has been sent.`;
  if (!user) {
    res.json({ message });
    return;
  }

  const token = newResetToken();
  await query(
    `UPDATE \`users\`
        SET \`reset_token_hash\` = ?, \`reset_expires_at\` = ${EXPIRY_SQL(env.resetTtlMinutes)}
      WHERE \`id\` = ?`,
    [hashToken(token), user.id]
  );

  if (!env.isProduction) {
    console.info(
      `[evgrid] Password reset token for ${email}: ${token} (valid ${env.resetTtlMinutes} min)`
    );
  }

  res.json({
    message,
    expires_in_minutes: env.resetTtlMinutes,
    ...(env.isProduction ? {} : { reset_token: token }),
  });
});

export const resetPassword = asyncHandler(async (req, res) => {
  const token = requireString(req.body?.token, 'token', { min: 16, max: 256 });
  const password = requirePassword(req.body?.password);

  const user = await queryOne(
    `SELECT * FROM \`users\`
      WHERE \`reset_token_hash\` = ? AND \`reset_expires_at\` IS NOT NULL AND \`reset_expires_at\` > NOW()
      LIMIT 1`,
    [hashToken(token)]
  );
  if (!user) {
    throw ApiError.badRequest('This password reset link is invalid or has expired.');
  }

  const passwordHash = await hashSecret(password);
  await query(
    `UPDATE \`users\`
        SET \`password_hash\` = ?, \`reset_token_hash\` = NULL, \`reset_expires_at\` = NULL,
            \`otp_code\` = NULL, \`otp_expires_at\` = NULL
      WHERE \`id\` = ?`,
    [passwordHash, user.id]
  );

  res.json({ message: 'Your password has been updated. You can sign in now.' });
});

/* ------------------------------------------------------------------ */
/* OAuth (not configured)                                             */
/* ------------------------------------------------------------------ */

export const oauthRedirect = asyncHandler(async (req, res) => {
  throw ApiError.notImplemented(
    `Social sign-in with "${req.params.provider}" is not configured on this server. ` +
      'Sign in with your email and password instead.'
  );
});

/**
 * Admin-only user management helpers that do not fit the generic CRUD surface.
 */

import { query, queryOne } from '../config/db.js';
import { env } from '../config/env.js';
import { ApiError } from '../utils/ApiError.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { APP_ROLES } from '../utils/access.js';
import { newId } from '../utils/ids.js';
import { serialiseUser } from '../utils/serialize.js';
import { requireEmail, requireOneOf } from '../utils/validate.js';

const LEGACY_ROLE = (appRole) => (appRole === 'admin' ? 'admin' : 'user');

/**
 * POST /users/invite — `{ email, app_role }`.
 *
 * Creates a pending (unverified, password-less) account carrying the requested
 * role. There is no SMTP driver configured, so the invitation is written to the
 * server log instead of being emailed.
 */
export const invite = asyncHandler(async (req, res) => {
  const email = requireEmail(req.body?.email);
  const appRole = requireOneOf(req.body?.app_role || 'ev_user', 'app_role', APP_ROLES);

  const existing = await queryOne('SELECT * FROM `users` WHERE `email` = ? LIMIT 1', [email]);
  if (existing?.email_verified) {
    throw ApiError.conflict(`${email} already has a verified EVGrid account.`);
  }

  let user;
  if (existing) {
    await query('UPDATE `users` SET `app_role` = ?, `role` = ? WHERE `id` = ?', [
      appRole,
      LEGACY_ROLE(appRole),
      existing.id,
    ]);
    user = await queryOne('SELECT * FROM `users` WHERE `id` = ? LIMIT 1', [existing.id]);
  } else {
    const id = newId();
    await query(
      `INSERT INTO \`users\` (\`id\`, \`email\`, \`app_role\`, \`role\`, \`email_verified\`)
       VALUES (?, ?, ?, ?, 0)`,
      [id, email, appRole, LEGACY_ROLE(appRole)]
    );
    user = await queryOne('SELECT * FROM `users` WHERE `id` = ? LIMIT 1', [id]);
  }

  if (!env.isProduction) {
    console.info(
      `[evgrid] Invitation (no SMTP configured) — ${email} invited as "${appRole}" by ${req.user.email}.`
    );
  }

  res.status(201).json({
    message: `An invitation for ${email} was created with the "${appRole}" role.`,
    user: serialiseUser(user),
  });
});

/**
 * Authentication / authorisation middleware.
 *
 * `authenticate` verifies the `Authorization: Bearer <JWT>` header, loads the
 * current user row and attaches it to `req.user`. `requireRole` then restricts
 * a route to a set of app roles (see `utils/access.js`).
 */

import { queryOne } from '../config/db.js';
import { ApiError } from '../utils/ApiError.js';
import { verifyAccessToken } from '../utils/tokens.js';
import { hasRole } from '../utils/access.js';

function readBearerToken(req) {
  const header = req.headers.authorization || req.headers.Authorization || '';
  const [scheme, token] = String(header).split(' ');
  if (!token || String(scheme).toLowerCase() !== 'bearer') return null;
  return token.trim() || null;
}

/** Hard requirement: a valid token and an existing user. */
export async function authenticate(req, res, next) {
  try {
    const token = readBearerToken(req);
    if (!token) throw ApiError.unauthorized();

    const payload = verifyAccessToken(token);
    const user = await queryOne('SELECT * FROM `users` WHERE `id` = ? LIMIT 1', [payload.sub]);
    if (!user) throw ApiError.unauthorized('Your account no longer exists. Please sign in again.');

    req.user = user;
    req.auth = payload;
    next();
  } catch (error) {
    next(error);
  }
}

/** Restrict a route to the given app roles. Must run after `authenticate`. */
export function requireRole(allowed) {
  const roles = Array.isArray(allowed) ? allowed : [allowed];
  return (req, res, next) => {
    if (!req.user) return next(ApiError.unauthorized());
    if (!roles.length) return next();
    if (!hasRole(req.user, roles)) {
      return next(
        ApiError.forbidden(`This action requires one of the following roles: ${roles.join(', ')}.`)
      );
    }
    next();
  };
}

/** Attach the resource definition (from the registry) to the request. */
export function attachResource(resource) {
  return (req, res, next) => {
    req.resource = resource;
    next();
  };
}

/** JWT issuing / verification. */

import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import { ApiError } from './ApiError.js';

const ISSUER = 'evgrid-api';

export function signAccessToken(user) {
  return jwt.sign(
    {
      sub: user.id,
      email: user.email,
      app_role: user.app_role || 'ev_user',
      role: user.app_role === 'admin' ? 'admin' : user.role || 'user',
    },
    env.jwtSecret,
    { expiresIn: env.jwtExpiresIn, issuer: ISSUER }
  );
}

export function verifyAccessToken(token) {
  try {
    return jwt.verify(token, env.jwtSecret, { issuer: ISSUER });
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      throw new ApiError(401, 'Your session has expired. Please sign in again.', {
        code: 'token_expired',
      });
    }
    throw ApiError.unauthorized('Invalid authentication token.');
  }
}

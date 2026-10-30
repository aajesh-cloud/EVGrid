/**
 * bcrypt wrappers.
 *
 * `bcryptjs` is used instead of the native `bcrypt` binding so `npm install`
 * never needs a C++ toolchain. Both helpers return promises.
 */

import bcrypt from 'bcryptjs';
import { env } from '../config/env.js';

function call(bcryptFn, ...args) {
  return new Promise((resolve, reject) => {
    bcryptFn(...args, (error, result) => (error ? reject(error) : resolve(result)));
  });
}

/** Hash a plain-text password or one-time code. */
export function hashSecret(plain) {
  return call(bcrypt.hash, String(plain), env.bcryptRounds);
}

/** Constant-time comparison of a plain-text secret against a stored hash. */
export function verifySecret(plain, hash) {
  if (!hash) return Promise.resolve(false);
  return call(bcrypt.compare, String(plain), String(hash));
}

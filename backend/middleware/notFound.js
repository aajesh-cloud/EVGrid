/** Anything that reached this point matched no route. */
import { ApiError } from '../utils/ApiError.js';

export function notFound(req, res, next) {
  next(ApiError.notFound(`No API route matches ${req.method} ${req.originalUrl}.`));
}

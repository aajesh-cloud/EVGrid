/**
 * Central error handler.
 *
 * Every failure is normalised into the shape the frontend client expects:
 *   { message, code, details }
 *
 * mysql2 driver errors are mapped onto sensible HTTP statuses so a duplicate
 * email surfaces as 409 instead of a generic 500.
 */

import { ApiError } from '../utils/ApiError.js';
import { env } from '../config/env.js';

const MYSQL_ERRORS = {
  ER_DUP_ENTRY: {
    status: 409,
    code: 'conflict',
    message: 'A record with these details already exists.',
  },
  ER_NO_REFERENCED_ROW_2: {
    status: 400,
    code: 'validation_error',
    message: 'A referenced record (for example a station or user) does not exist.',
  },
  ER_ROW_IS_REFERENCED_2: {
    status: 409,
    code: 'conflict',
    message: 'This record is still referenced by other records and cannot be deleted.',
  },
  ER_NO_SUCH_TABLE: {
    status: 503,
    code: 'service_unavailable',
    message: 'A required table is missing. Run "npm run db:setup" to create the schema.',
  },
  ER_BAD_FIELD_ERROR: {
    status: 500,
    code: 'internal_error',
    message: 'The database rejected a column reference.',
  },
  ER_DATA_TOO_LONG: {
    status: 400,
    code: 'validation_error',
    message: 'A value is too long for its column.',
  },
  ER_TRUNCATED_WRONG_VALUE: {
    status: 400,
    code: 'validation_error',
    message: 'A value has the wrong type for its column.',
  },
  ER_WRONG_VALUE_COUNT_ON_ROW: {
    status: 500,
    code: 'internal_error',
    message: 'A query supplied the wrong number of values.',
  },
  ER_ACCESS_DENIED_ERROR: {
    status: 503,
    code: 'service_unavailable',
    message: 'The database rejected the configured credentials.',
  },
  ECONNREFUSED: {
    status: 503,
    code: 'service_unavailable',
    message: 'Cannot reach the MySQL server. Is it running and are the credentials correct?',
  },
  ETIMEDOUT: {
    status: 503,
    code: 'service_unavailable',
    message: 'The MySQL server did not respond in time.',
  },
  ER_BAD_DB_ERROR: {
    status: 503,
    code: 'service_unavailable',
    message: 'The configured database does not exist. Run "npm run db:setup" first.',
  },
};

function fromMySql(error) {
  const mapping = MYSQL_ERRORS[error.code];
  if (!mapping) return null;
  const details = { driverCode: error.code, sqlMessage: error.sqlMessage || undefined };
  return new ApiError(mapping.status, mapping.message, { code: mapping.code, details });
}

function fromBodyParser(error) {
  if (error.type === 'entity.parse.failed') {
    return new ApiError(400, 'The request body is not valid JSON.', { code: 'validation_error' });
  }
  if (error.type === 'entity.too.large') {
    return new ApiError(413, 'The request body is too large.', { code: 'payload_too_large' });
  }
  return null;
}

// eslint-disable-next-line no-unused-vars -- Express identifies error handlers by arity
export function errorHandler(error, req, res, next) {
  let apiError = error instanceof ApiError ? error : fromBodyParser(error) || fromMySql(error);

  if (!apiError) {
    apiError = new ApiError(500, env.isProduction ? 'Internal server error.' : error.message, {
      code: 'internal_error',
    });
  }

  if (!env.isProduction && apiError.status >= 500) {
    console.error(`[evgrid] ${req.method} ${req.originalUrl} →`, error);
  } else if (!env.isProduction) {
    console.warn(`[evgrid] ${req.method} ${req.originalUrl} → ${apiError.status} ${apiError.message}`);
  }

  res.status(apiError.status).json({
    message: apiError.message,
    code: apiError.code,
    ...(apiError.details ? { details: apiError.details } : {}),
  });
}

/**
 * Application error type.
 *
 * The frontend client reads `{ message, code, details }` from any non-2xx
 * response, so every error that reaches the error middleware is normalised
 * into that shape.
 */

export class ApiError extends Error {
  constructor(status, message, { code = 'api_error', details = null } = {}) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.details = details;
  }

  static badRequest(message = 'Invalid request.', details = null) {
    return new ApiError(400, message, { code: 'validation_error', details });
  }

  static unauthorized(message = 'Authentication required.') {
    return new ApiError(401, message, { code: 'unauthorized' });
  }

  static forbidden(message = 'You do not have permission to perform this action.') {
    return new ApiError(403, message, { code: 'forbidden' });
  }

  static notFound(message = 'Resource not found.') {
    return new ApiError(404, message, { code: 'not_found' });
  }

  static conflict(message = 'The request conflicts with the current state.', details = null) {
    return new ApiError(409, message, { code: 'conflict', details });
  }

  static notImplemented(message = 'This endpoint is not implemented yet.') {
    return new ApiError(501, message, { code: 'not_implemented' });
  }

  static serviceUnavailable(message = 'Service unavailable.', details = null) {
    return new ApiError(503, message, { code: 'service_unavailable', details });
  }
}

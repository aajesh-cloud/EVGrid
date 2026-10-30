/**
 * EVGrid API client.
 *
 * Single place that knows how to talk to the backend (Node.js + Express + MySQL).
 * Nothing in the React tree should call `fetch` directly — always go through the
 * resource services exported from `src/api/index.js`.
 *
 * Configuration:
 *   VITE_API_BASE_URL   Base URL of the API, e.g. http://localhost:5000/api
 *
 * Expected backend contract
 *   List endpoints   -> { items: [...], total: number }   (a bare array is also accepted)
 *   Single resource  -> the object itself
 *   Errors           -> non-2xx with { message, code?, details? }
 */

export const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api').replace(/\/+$/, '');

const TOKEN_STORAGE_KEY = 'evgrid.access_token';

/* ------------------------------------------------------------------ */
/* Access token storage                                                */
/* ------------------------------------------------------------------ */

export function getAccessToken() {
  try {
    return window.localStorage.getItem(TOKEN_STORAGE_KEY);
  } catch {
    return null;
  }
}

export function setAccessToken(token) {
  try {
    if (token) window.localStorage.setItem(TOKEN_STORAGE_KEY, token);
    else window.localStorage.removeItem(TOKEN_STORAGE_KEY);
  } catch {
    /* storage unavailable (private mode) — requests will simply be anonymous */
  }
}

export function clearAccessToken() {
  setAccessToken(null);
}

/* ------------------------------------------------------------------ */
/* Errors                                                             */
/* ------------------------------------------------------------------ */

export class ApiError extends Error {
  constructor(message, { status = 0, code = 'api_error', details = null, isNetworkError = false } = {}) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.details = details;
    this.isNetworkError = isNetworkError;
  }
}

/** Human readable message for any thrown value, safe to render in the UI. */
export function getApiErrorMessage(error) {
  if (!error) return 'Something went wrong.';
  if (error instanceof ApiError) {
    if (error.isNetworkError) {
      return `Cannot reach the EVGrid API at ${API_BASE_URL}. Make sure the backend server is running.`;
    }
    if (error.status === 401) return 'Your session has expired. Please sign in again.';
    if (error.status === 403) return 'You do not have permission to view this data.';
    return error.message;
  }
  if (error.name === 'AbortError') return 'Request cancelled.';
  return error.message || 'Unexpected error.';
}

/* ------------------------------------------------------------------ */
/* Query serialisation                                                */
/* ------------------------------------------------------------------ */

function serialiseValue(value) {
  if (Array.isArray(value)) return value.join(',');
  if (value instanceof Date) return value.toISOString();
  return String(value);
}

/**
 * Flatten a filter object into query params.
 *   { status: 'paid' }               -> status=paid
 *   { status: { $in: ['a', 'b'] } }  -> status[$in]=a,b
 *   { sort: '-created_date', limit } -> sort=-created_date&limit=20
 */
export function buildQuery({ filter, sort, limit, skip, ...rest } = {}) {
  const params = new URLSearchParams();

  Object.entries(rest).forEach(([key, value]) => {
    if (value === undefined || value === null || value === '') return;
    params.set(key, serialiseValue(value));
  });

  if (sort) params.set('sort', sort);
  if (limit !== undefined && limit !== null) params.set('limit', String(limit));
  if (skip !== undefined && skip !== null && skip !== 0) params.set('skip', String(skip));

  Object.entries(filter || {}).forEach(([key, value]) => {
    if (value === undefined || value === null) return;
    const isOperatorObject =
      typeof value === 'object' && !Array.isArray(value) && !(value instanceof Date);
    if (!isOperatorObject) {
      params.set(key, serialiseValue(value));
      return;
    }
    Object.entries(value).forEach(([operator, operand]) => {
      if (operand === undefined || operand === null) return;
      params.set(`${key}[${operator}]`, serialiseValue(operand));
    });
  });

  return params;
}

/* ------------------------------------------------------------------ */
/* Request                                                            */
/* ------------------------------------------------------------------ */

/**
 * Perform an API request.
 * @returns {Promise<any>} parsed JSON body (or null for 204)
 */
export async function request(path, { method = 'GET', body, query, signal, headers } = {}) {
  const normalisedPath = path.startsWith('/') ? path : `/${path}`;
  const url = new URL(`${API_BASE_URL}${normalisedPath}`);

  if (query) {
    const params = query instanceof URLSearchParams ? query : buildQuery(query);
    params.forEach((value, key) => url.searchParams.set(key, value));
  }

  const token = getAccessToken();
  let response;

  try {
    response = await fetch(url.toString(), {
      method,
      signal,
      headers: {
        Accept: 'application/json',
        ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...headers,
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch (error) {
    if (error?.name === 'AbortError') throw error;
    throw new ApiError(`Request to ${normalisedPath} failed.`, {
      isNetworkError: true,
      code: 'network_error',
      details: error,
    });
  }

  if (response.status === 204) return null;

  const raw = await response.text();
  let payload = null;
  if (raw) {
    try {
      payload = JSON.parse(raw);
    } catch {
      payload = raw;
    }
  }

  if (!response.ok) {
    if (response.status === 401) clearAccessToken();
    const message =
      (payload && typeof payload === 'object' && (payload.message || payload.error)) ||
      `Request failed with status ${response.status}`;
    throw new ApiError(message, {
      status: response.status,
      code: (payload && typeof payload === 'object' && payload.code) || `http_${response.status}`,
      details: (payload && typeof payload === 'object' && payload.details) || payload,
    });
  }

  return payload;
}

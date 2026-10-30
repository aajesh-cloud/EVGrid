/**
 * EVGrid API service layer.
 *
 * Import the resource you need instead of calling `fetch` from components:
 *
 *   import { stationsApi } from '@/api';
 *   const { items } = await stationsApi.filter({ city: 'Pune' }, { sort: '-rating', limit: 20 });
 *
 * All calls hit the Express + MySQL backend configured through
 * `VITE_API_BASE_URL`. See `docs/BACKEND-ENDPOINTS.md` for the full contract.
 */

import { API_BASE_URL, ApiError, clearAccessToken, getApiErrorMessage, request, setAccessToken } from './client';
import { createResource, normalizePage } from './resources';

/* ------------------------------------------------------------------ */
/* Resources                                                          */
/* ------------------------------------------------------------------ */

export const usersApi = Object.assign(createResource('/users'), {
  /** POST /users/invite — sends an invitation email with the given app role. */
  invite(email, appRole) {
    return request('/users/invite', { method: 'POST', body: { email, app_role: appRole } });
  },
});
export const operatorsApi = createResource('/operators');
export const stationsApi = createResource('/charging-stations');
export const chargingPointsApi = createResource('/charging-points');
export const bookingsApi = createResource('/bookings');
export const sessionsApi = createResource('/charging-sessions');
export const paymentsApi = createResource('/payments');
export const vehiclesApi = createResource('/vehicles');
export const notificationsApi = createResource('/notifications');
export const maintenanceApi = createResource('/maintenance-records');
export const techniciansApi = createResource('/technicians');
export const tariffsApi = createResource('/tariffs');
export const reviewsApi = createResource('/reviews');
export const favoritesApi = createResource('/favorites');
export const auditLogsApi = createResource('/audit-logs');

/* ------------------------------------------------------------------ */
/* Authentication                                                     */
/* ------------------------------------------------------------------ */

export const authApi = {
  /** POST /auth/login -> { access_token, user } */
  async login({ email, password }) {
    const payload = await request('/auth/login', { method: 'POST', body: { email, password } });
    if (payload?.access_token) setAccessToken(payload.access_token);
    return payload?.user ?? payload;
  },

  /** GET /auth/me */
  me() {
    return request('/auth/me');
  },

  /** POST /auth/register -> starts the email OTP flow */
  register({ email, password, fullName }) {
    return request('/auth/register', {
      method: 'POST',
      body: { email, password, full_name: fullName },
    });
  },

  /** POST /auth/verify-otp -> { access_token, user } */
  async verifyOtp({ email, otpCode }) {
    const payload = await request('/auth/verify-otp', {
      method: 'POST',
      body: { email, otp: otpCode },
    });
    const token = payload?.access_token ?? payload?.accessToken;
    if (token) setAccessToken(token);
    return payload?.user ?? payload;
  },

  /** POST /auth/resend-otp */
  resendOtp(email) {
    return request('/auth/resend-otp', { method: 'POST', body: { email } });
  },

  /** Redirects the browser to the provider consent screen (POST /auth/oauth/:provider on the server). */
  loginWithProvider(provider, returnTo = '/') {
    const url = new URL(`${API_BASE_URL}/auth/oauth/${provider}`);
    if (returnTo) url.searchParams.set('returnTo', returnTo);
    window.location.href = url.toString();
  },

  /** POST /auth/forgot-password */
  requestPasswordReset(email) {
    return request('/auth/forgot-password', { method: 'POST', body: { email } });
  },

  /** POST /auth/reset-password */
  resetPassword({ resetToken, newPassword }) {
    return request('/auth/reset-password', {
      method: 'POST',
      body: { token: resetToken, password: newPassword },
    });
  },

  /** PATCH /auth/me */
  updateMe(patch) {
    return request('/auth/me', { method: 'PATCH', body: patch });
  },

  /** Clears the stored token. Session invalidation happens server-side on POST /auth/logout. */
  logout() {
    clearAccessToken();
  },
};

/* ------------------------------------------------------------------ */
/* Server-side operations (multi-table transactions)                  */
/* ------------------------------------------------------------------ */

export const functionsApi = {
  /** Validates availability and creates a booking + notification in one transaction. */
  createBooking(payload) {
    return request('/functions/create-booking', { method: 'POST', body: payload });
  },

  /** action: 'start' | 'stop' — drives the charging session lifecycle. */
  chargingSession(payload) {
    return request('/functions/charging-session', { method: 'POST', body: payload });
  },

  /** Simulated gateway settlement: { payment_id, method } or { payment_id, action: 'refund' }. */
  processPayment(payload) {
    return request('/functions/process-payment', { method: 'POST', body: payload });
  },
};

/* ------------------------------------------------------------------ */
/* System                                                             */
/* ------------------------------------------------------------------ */

export const systemApi = {
  /** GET /health -> { status: 'ok', ... } — used by the Settings page connection test. */
  health() {
    return request('/health');
  },
};

/* ------------------------------------------------------------------ */
/* Re-exports for convenience                                         */
/* ------------------------------------------------------------------ */

export { API_BASE_URL, ApiError, createResource, getApiErrorMessage, normalizePage, request };
export { getAccessToken, setAccessToken, clearAccessToken } from './client';

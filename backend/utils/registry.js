/**
 * Resource registry — the single place that describes every REST resource the
 * frontend consumes (`src/api/index.js`).
 *
 * Per resource:
 *   path              API path (matches the frontend service)
 *   table             MySQL table name (from backend/db/schema.sql)
 *   hidden            columns never returned to a client
 *   immutable         columns a client may never write
 *   searchable        columns used by the `?search=` free-text parameter
 *   jsonArrayColumns  JSON columns holding arrays (needs JSON_CONTAINS)
 *   ownerColumn/scope controls record ownership filtering (see utils/access.js)
 *   readRoles/writeRoles  which app roles may read / write
 *   requiredOnCreate  columns that must be supplied on POST
 */

const ALL_ROLES = ['ev_user', 'operator', 'technician', 'admin'];
const STAFF = ['operator', 'technician', 'admin'];

export const RESOURCES = {
  users: {
    path: '/users',
    table: 'users',
    hidden: ['password_hash', 'otp_code', 'otp_expires_at', 'reset_token_hash', 'reset_expires_at'],
    immutable: ['email', 'password_hash', 'otp_code', 'otp_expires_at', 'reset_token_hash', 'reset_expires_at'],
    searchable: ['full_name', 'email', 'city', 'phone'],
    readRoles: ['admin'],
    writeRoles: ['admin'],
    requiredOnCreate: ['email'],
    decorate: (row) => ({ ...row, role: row.app_role === 'admin' ? 'admin' : row.role || 'user' }),
  },

  operators: {
    path: '/operators',
    table: 'operators',
    searchable: ['org_name', 'contact_name', 'email', 'city'],
    readRoles: ALL_ROLES,
    writeRoles: ['admin'],
    requiredOnCreate: ['org_name', 'email'],
    defaultSort: 'org_name',
  },

  'charging-stations': {
    path: '/charging-stations',
    table: 'charging_stations',
    searchable: ['name', 'city', 'state', 'address', 'operator_name'],
    jsonArrayColumns: ['connector_types', 'amenities'],
    readRoles: ALL_ROLES,
    writeRoles: ['operator', 'admin'],
    requiredOnCreate: ['name', 'city'],
    defaultSort: '-rating',
  },

  'charging-points': {
    path: '/charging-points',
    table: 'charging_points',
    searchable: ['code', 'serial_number'],
    readRoles: ALL_ROLES,
    writeRoles: ['operator', 'admin'],
    requiredOnCreate: ['station_id', 'code'],
    defaultSort: 'code',
  },

  bookings: {
    path: '/bookings',
    table: 'bookings',
    searchable: ['station_name', 'point_code', 'user_name', 'vehicle_label'],
    ownerColumn: 'user_id',
    scope: 'ev_user',
    readRoles: ALL_ROLES,
    writeRoles: ALL_ROLES,
    requiredOnCreate: ['station_id', 'point_id', 'booking_date', 'start_time', 'end_time'],
    // The Bookings page reads `created_by_id` when it notifies the driver.
    decorate: (row) => ({ ...row, created_by_id: row.user_id ?? null }),
  },

  'charging-sessions': {
    path: '/charging-sessions',
    table: 'charging_sessions',
    searchable: ['station_name', 'point_code', 'vehicle_label'],
    ownerColumn: 'user_id',
    scope: 'ev_user',
    readRoles: ALL_ROLES,
    writeRoles: ['operator', 'admin'],
    defaultSort: '-start_time',
  },

  payments: {
    path: '/payments',
    table: 'payments',
    searchable: ['invoice_number', 'station_name', 'transaction_ref'],
    ownerColumn: 'user_id',
    scope: 'ev_user',
    readRoles: ALL_ROLES,
    writeRoles: ['operator', 'admin'],
    requiredOnCreate: ['user_id', 'amount'],
    defaultSort: '-created_date',
  },

  vehicles: {
    path: '/vehicles',
    table: 'vehicles',
    searchable: ['nickname', 'make', 'model', 'registration_number'],
    ownerColumn: 'user_id',
    scope: 'always',
    readRoles: ALL_ROLES,
    writeRoles: ALL_ROLES,
    requiredOnCreate: ['make', 'model', 'registration_number'],
  },

  notifications: {
    path: '/notifications',
    table: 'notifications',
    searchable: ['title', 'message'],
    ownerColumn: 'user_id',
    scope: 'always',
    readRoles: ALL_ROLES,
    writeRoles: ALL_ROLES,
    requiredOnCreate: ['title'],
  },

  'maintenance-records': {
    path: '/maintenance-records',
    table: 'maintenance_records',
    searchable: ['title', 'description', 'station_name', 'point_code', 'assigned_to', 'assigned_email'],
    readRoles: ALL_ROLES,
    writeRoles: STAFF,
    requiredOnCreate: ['station_id', 'title'],
    defaultSort: '-reported_date',
  },

  technicians: {
    path: '/technicians',
    table: 'technicians',
    searchable: ['name', 'email', 'city', 'specialization'],
    readRoles: STAFF,
    writeRoles: ['admin', 'operator'],
    requiredOnCreate: ['name', 'email'],
    defaultSort: 'name',
  },

  tariffs: {
    path: '/tariffs',
    table: 'tariffs',
    searchable: ['name', 'station_name'],
    readRoles: ALL_ROLES,
    writeRoles: ['operator', 'admin'],
    requiredOnCreate: ['station_id', 'name', 'price_per_kwh'],
    defaultSort: '-valid_from',
  },

  reviews: {
    path: '/reviews',
    table: 'reviews',
    searchable: ['user_name', 'comment', 'station_name'],
    readRoles: ALL_ROLES,
    writeRoles: ALL_ROLES,
    requiredOnCreate: ['station_id', 'rating'],
    forceOwnerOnCreate: true,
  },

  favorites: {
    path: '/favorites',
    table: 'favorites',
    searchable: ['station_name', 'city'],
    ownerColumn: 'user_id',
    scope: 'always',
    readRoles: ALL_ROLES,
    writeRoles: ALL_ROLES,
    requiredOnCreate: ['station_id'],
  },

  'audit-logs': {
    path: '/audit-logs',
    table: 'audit_logs',
    searchable: ['action', 'actor_name', 'actor_email', 'entity_type'],
    readRoles: ['admin'],
    writeRoles: ['admin'],
    requiredOnCreate: ['action'],
  },
};

export const RESOURCE_KEYS = Object.keys(RESOURCES);

export function getResource(key) {
  return RESOURCES[key] || null;
}

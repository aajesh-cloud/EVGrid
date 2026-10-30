/**
 * Role helpers and record-ownership scoping.
 *
 * The frontend has four app roles (`ev_user`, `operator`, `technician`,
 * `admin`) plus a legacy `role` column where `admin` also grants access.
 */

export const APP_ROLES = ['ev_user', 'operator', 'technician', 'admin'];
export const STAFF_ROLES = ['operator', 'technician', 'admin'];

export function userRoles(user) {
  if (!user) return [];
  const appRole = user.app_role || 'ev_user';
  const roles = [];
  if (appRole === 'admin' || user.role === 'admin') roles.push('admin');
  if (appRole === 'operator') roles.push('operator');
  if (appRole === 'technician') roles.push('technician');
  if (!roles.length || appRole === 'ev_user') roles.push('ev_user');
  return [...new Set(roles)];
}

export function hasRole(user, allowed) {
  if (!allowed || !allowed.length) return false;
  const owned = userRoles(user);
  return allowed.some((role) => owned.includes(role));
}

export function isStaff(user) {
  return hasRole(user, STAFF_ROLES);
}

/**
 * Which column (if any) limits this request to the caller's own records.
 *
 * @param {{ ownerColumn?: string, scope?: 'never'|'ev_user'|'always' }} resource
 * @param {object} user
 * @returns {string|null}
 */
export function ownerScopeColumn(resource, user) {
  if (!resource.ownerColumn || resource.scope === 'never') return null;
  if (resource.scope === 'always') return resource.ownerColumn;
  // 'ev_user' — staff can see the whole network, drivers only their own rows.
  return isStaff(user) ? null : resource.ownerColumn;
}

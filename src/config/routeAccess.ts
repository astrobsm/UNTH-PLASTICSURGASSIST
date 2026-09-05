/**
 * Who may reach which route — the single source for both the router and the
 * sidebar.
 *
 * The sidebar used to list every destination to everyone, with ProtectedRoute
 * doing the real gating at the route. A house officer therefore saw Admin, HO
 * Tracking and Training Admin in their navigation, clicked one, and was
 * bounced back to the dashboard with no explanation. The access rule was
 * correct; the menu was advertising doors that were locked.
 *
 * Both sides read this table, so a route cannot be listed in the menu for a
 * role the router will turn away.
 */

/** Roles as this database stores them (`users.role`). */
export const ROLES = {
  admin: 'admin',
  superAdmin: 'super_admin',
  consultant: 'consultant',
  seniorRegistrar: 'senior_registrar',
  juniorRegistrar: 'junior_registrar',
  registrar: 'registrar',
  houseOfficer: 'house_officer',
  medicalOfficer: 'medical_officer',
  nursing: 'nursing',
  lab: 'lab',
  pharmacy: 'pharmacy',
  student: 'student',
} as const;

/** Everyone who supervises training and may see another person's score. */
export const SUPERVISOR_ROLES = [
  ROLES.admin, ROLES.superAdmin, ROLES.consultant, ROLES.seniorRegistrar,
];

/** Doctors on a rotation. */
export const TRAINEE_ROLES = [
  ROLES.seniorRegistrar, ROLES.juniorRegistrar, ROLES.registrar, ROLES.houseOfficer,
];

/**
 * Restricted routes and the roles allowed through.
 *
 * A path absent from this map is open to any signed-in user — that is the
 * default for the clinical screens, and this map holds only the exceptions.
 */
export const ROUTE_ROLES: Record<string, readonly string[]> = {
  '/admin': [ROLES.admin, ROLES.superAdmin],
  '/training-admin': SUPERVISOR_ROLES,
  '/ho-tracking': SUPERVISOR_ROLES,
  '/audit-logs': SUPERVISOR_ROLES,
  '/topic-management': [ROLES.admin, ROLES.superAdmin, ROLES.consultant],
  // senior_registrar is in both lists; dedupe so the array reads honestly.
  '/bulk-admit': [...new Set([...SUPERVISOR_ROLES, ...TRAINEE_ROLES])],
};

/**
 * May this role open this path?
 *
 * Unrestricted paths return true for any role. An absent role returns false —
 * a signed-out user has no business in a restricted screen.
 */
export function canAccess(path: string, role: string | null | undefined): boolean {
  const allowed = ROUTE_ROLES[path];
  if (!allowed) return true;
  if (!role) return false;
  return allowed.includes(role);
}

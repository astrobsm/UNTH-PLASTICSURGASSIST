// ============================================================================
// Staff role registry.
//
// Roles used to be hardcoded in a dozen places (dropdowns, pool queries, TS
// unions), so adding a grade the unit actually employs — a medical officer, a
// clinical fellow, a visiting registrar — meant a code change. This table makes
// the role LIST data while keeping the four ROSTERING GRADES fixed:
//
//   role   = what a person is called      (extensible: any number of these)
//   grade  = which slot they fill on the   (fixed: consultant / senior_registrar
//            call roster and care team      / registrar / house_officer)
//
// Every role maps to at most one grade via `rosters_as`. A new role with
// rosters_as = 'registrar' automatically joins the registrar pool for call-duty
// generation and patient assignment — no code change. A role with a NULL
// rosters_as (admin, records officer) is simply never rostered.
// ============================================================================
import { query } from './db.js';

/** The rostering grades. These are structural — they map to DB columns. */
export const GRADES = ['consultant', 'senior_registrar', 'registrar', 'house_officer'];

// Seeded on first use. `builtin` roles cannot be renamed away or deleted, since
// existing rows, tokens and role checks throughout the app depend on their keys.
const BUILTIN_ROLES = [
  { key: 'consultant', label: 'Consultant', rosters_as: 'consultant', sort_order: 10 },
  { key: 'senior_registrar', label: 'Senior Registrar', rosters_as: 'senior_registrar', sort_order: 20 },
  { key: 'junior_registrar', label: 'Registrar', rosters_as: 'registrar', sort_order: 30 },
  { key: 'registrar', label: 'Registrar (alt)', rosters_as: 'registrar', sort_order: 31 },
  { key: 'house_officer', label: 'House Officer', rosters_as: 'house_officer', sort_order: 40 },
  { key: 'admin', label: 'Administrator', rosters_as: null, sort_order: 50 },
  { key: 'super_admin', label: 'Super Administrator', rosters_as: null, sort_order: 51 },
  { key: 'student', label: 'Student', rosters_as: null, sort_order: 60 },
];

let tableReady = false;

export async function ensureRolesTable() {
  if (tableReady) return;
  await query(`
    CREATE TABLE IF NOT EXISTS staff_roles (
      id SERIAL PRIMARY KEY,
      role_key VARCHAR(60) NOT NULL UNIQUE,
      label VARCHAR(120) NOT NULL,
      rosters_as VARCHAR(40),
      is_builtin BOOLEAN DEFAULT FALSE,
      is_active BOOLEAN DEFAULT TRUE,
      sort_order INTEGER DEFAULT 100,
      description TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);
  // Seed/repair the built-ins. Label is only set on insert so an admin can
  // rename "Registrar" to local usage without it being reverted on next boot.
  for (const r of BUILTIN_ROLES) {
    await query(
      `INSERT INTO staff_roles (role_key, label, rosters_as, is_builtin, is_active, sort_order)
       VALUES ($1, $2, $3, TRUE, TRUE, $4)
       ON CONFLICT (role_key) DO UPDATE SET is_builtin = TRUE`,
      [r.key, r.label, r.rosters_as, r.sort_order]
    );
  }
  // Adopt any role already present on a user but missing from the registry, so
  // the list always reflects reality rather than silently hiding people.
  await query(
    `INSERT INTO staff_roles (role_key, label, rosters_as, is_builtin, is_active, sort_order)
     SELECT DISTINCT u.role, u.role, NULL, FALSE, TRUE, 200
       FROM users u
      WHERE u.role IS NOT NULL AND u.role <> ''
        AND NOT EXISTS (SELECT 1 FROM staff_roles s WHERE s.role_key = u.role)
     ON CONFLICT (role_key) DO NOTHING`
  );
  tableReady = true;
}

export async function listRoles({ includeInactive = true } = {}) {
  await ensureRolesTable();
  const r = await query(
    `SELECT s.id, s.role_key, s.label, s.rosters_as, s.is_builtin, s.is_active,
            s.sort_order, s.description,
            (SELECT COUNT(*) FROM users u
              WHERE u.role = s.role_key AND (u.app_id = 'psa' OR u.app_id IS NULL)) AS user_count,
            (SELECT COUNT(*) FROM users u
              WHERE u.role = s.role_key AND u.is_active = TRUE AND u.is_approved = TRUE
                AND (u.app_id = 'psa' OR u.app_id IS NULL)) AS active_user_count
       FROM staff_roles s
      ${includeInactive ? '' : 'WHERE s.is_active = TRUE'}
      ORDER BY s.sort_order, s.label`
  );
  return r.rows.map(x => ({
    ...x,
    user_count: Number(x.user_count),
    active_user_count: Number(x.active_user_count),
  }));
}

// Small per-instance cache: the pool queries below run on hot paths (roster
// generation, every auto-admit) and the role list changes very rarely.
let cache = null;
let cacheAt = 0;
const CACHE_MS = 30_000;

/** grade -> [role_key, ...] for every ACTIVE role mapped to that grade. */
export async function gradeRoleMap() {
  if (cache && Date.now() - cacheAt < CACHE_MS) return cache;
  await ensureRolesTable();
  const map = {};
  for (const g of GRADES) map[g] = [];
  try {
    const r = await query(
      `SELECT role_key, rosters_as FROM staff_roles
        WHERE is_active = TRUE AND rosters_as IS NOT NULL`
    );
    for (const row of r.rows) {
      if (map[row.rosters_as]) map[row.rosters_as].push(row.role_key);
    }
  } catch (e) {
    console.warn('gradeRoleMap failed, using built-in mapping:', e.message);
  }
  // Never return an empty pool for a grade — fall back to the built-in keys so a
  // registry problem can't silently stop the roster being generated.
  for (const g of GRADES) {
    if (map[g].length === 0) {
      map[g] = BUILTIN_ROLES.filter(b => b.rosters_as === g).map(b => b.key);
    }
  }
  cache = map;
  cacheAt = Date.now();
  return map;
}

/** The user.role values that fill a given rostering grade. */
export async function rolesForGrade(grade) {
  const map = await gradeRoleMap();
  return map[grade] || [];
}

/** Drop the cache after a write so the next read sees the change immediately. */
export function invalidateRoleCache() {
  cache = null;
  cacheAt = 0;
}

export default { GRADES, ensureRolesTable, listRoles, gradeRoleMap, rolesForGrade, invalidateRoleCache };

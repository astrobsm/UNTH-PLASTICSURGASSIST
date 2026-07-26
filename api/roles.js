// Staff role registry API — lets an admin add a role the unit actually employs,
// relabel an existing one, or retire one, without a code change.
//
//   GET    /api/roles                 -> { roles: [...], grades: [...] }
//   POST   /api/roles                 -> create   { key, label, rosters_as?, description? }
//   PUT    /api/roles                 -> update   { id|key, label?, rosters_as?, is_active?, sort_order?, description? }
//   DELETE /api/roles?key=&reassign_to= -> delete, or retire when the role is in use
//
// Reads are open to any authenticated user (dropdowns need the list); writes are
// admin-only. Built-in keys can be relabelled and re-graded but never deleted or
// renamed — user rows, tokens and role checks across the app depend on the key.
import { query } from './_lib/db.js';
import { cors, authenticateRequest } from './_lib/auth.js';
import { GRADES, ensureRolesTable, listRoles, invalidateRoleCache } from './_lib/roles.js';

const WRITE_ROLES = ['admin', 'super_admin'];
const KEY_RE = /^[a-z][a-z0-9_]{1,58}[a-z0-9]$/;

export default async function handler(req, res) {
  if (cors(req, res)) return;

  const auth = authenticateRequest(req);
  if (!auth.authenticated) return res.status(auth.status || 401).json({ error: auth.error });

  const isAdmin = WRITE_ROLES.includes(auth.user.role);
  const url = new URL(req.url, `http://${req.headers.host}`);

  try {
    await ensureRolesTable();
    switch (req.method) {
      case 'GET':
        return res.status(200).json({ roles: await listRoles(), grades: GRADES });
      case 'POST':
        if (!isAdmin) return res.status(403).json({ error: 'Only administrators can add roles' });
        return await createRole(req.body, res);
      case 'PUT':
      case 'PATCH':
        if (!isAdmin) return res.status(403).json({ error: 'Only administrators can change roles' });
        return await updateRole(req.body, res);
      case 'DELETE':
        if (!isAdmin) return res.status(403).json({ error: 'Only administrators can remove roles' });
        return await deleteRole(url.searchParams, res);
      default:
        return res.status(405).json({ error: 'Method not allowed' });
    }
  } catch (e) {
    console.error('roles API error:', e);
    return res.status(500).json({ error: 'Internal server error', message: e.message });
  }
}

const parseBody = (b) => (typeof b === 'string' ? JSON.parse(b || '{}') : (b || {}));

function validateGrade(rostersAs) {
  if (rostersAs === undefined || rostersAs === null || rostersAs === '') return { ok: true, value: null };
  if (!GRADES.includes(rostersAs)) {
    return { ok: false, error: `rosters_as must be null or one of: ${GRADES.join(', ')}` };
  }
  return { ok: true, value: rostersAs };
}

async function createRole(body, res) {
  const b = parseBody(body);
  const key = String(b.key || b.role_key || '').trim().toLowerCase().replace(/[\s-]+/g, '_');
  const label = String(b.label || '').trim();

  if (!key || !label) return res.status(400).json({ error: 'key and label are required' });
  if (!KEY_RE.test(key)) {
    return res.status(400).json({
      error: 'Key must be lower-case letters, numbers and underscores (e.g. medical_officer)',
    });
  }
  const grade = validateGrade(b.rosters_as);
  if (!grade.ok) return res.status(400).json({ error: grade.error });

  const existing = await query(`SELECT role_key FROM staff_roles WHERE role_key = $1`, [key]);
  if (existing.rows.length) return res.status(409).json({ error: `Role "${key}" already exists` });

  const r = await query(
    `INSERT INTO staff_roles (role_key, label, rosters_as, is_builtin, is_active, sort_order, description)
     VALUES ($1, $2, $3, FALSE, TRUE, $4, $5) RETURNING *`,
    [key, label, grade.value, Number.isFinite(+b.sort_order) ? +b.sort_order : 100, b.description || null]
  );
  invalidateRoleCache();
  return res.status(201).json({ role: r.rows[0], roles: await listRoles() });
}

async function updateRole(body, res) {
  const b = parseBody(body);
  const key = String(b.key || b.role_key || '').trim();
  if (!key && !b.id) return res.status(400).json({ error: 'id or key is required' });

  const found = await query(
    b.id ? `SELECT * FROM staff_roles WHERE id = $1` : `SELECT * FROM staff_roles WHERE role_key = $1`,
    [b.id || key]
  );
  if (found.rows.length === 0) return res.status(404).json({ error: 'Role not found' });
  const role = found.rows[0];

  const sets = [], vals = [];
  const put = (col, v) => { vals.push(v); sets.push(`${col} = $${vals.length}`); };

  if (b.label !== undefined) {
    const label = String(b.label).trim();
    if (!label) return res.status(400).json({ error: 'label cannot be empty' });
    put('label', label);
  }
  if (b.rosters_as !== undefined) {
    const grade = validateGrade(b.rosters_as);
    if (!grade.ok) return res.status(400).json({ error: grade.error });
    put('rosters_as', grade.value);
  }
  if (b.description !== undefined) put('description', b.description || null);
  if (b.sort_order !== undefined && Number.isFinite(+b.sort_order)) put('sort_order', +b.sort_order);
  if (b.is_active !== undefined) {
    const active = !!b.is_active;
    // Retiring a role that people still hold would hide them from every staff
    // list — including the rosters they are on. Move them first.
    if (!active) {
      const inUse = await query(
        `SELECT COUNT(*) AS n FROM users
          WHERE role = $1 AND is_active = TRUE AND (app_id = 'psa' OR app_id IS NULL)`,
        [role.role_key]
      );
      if (Number(inUse.rows[0].n) > 0) {
        return res.status(409).json({
          error: `${inUse.rows[0].n} active staff member(s) still hold "${role.label}". Change their role first, then retire this one.`,
          activeUsers: Number(inUse.rows[0].n),
        });
      }
    }
    put('is_active', active);
  }

  if (sets.length === 0) return res.status(400).json({ error: 'No changes provided' });
  vals.push(role.id);
  const r = await query(
    `UPDATE staff_roles SET ${sets.join(', ')}, updated_at = CURRENT_TIMESTAMP
      WHERE id = $${vals.length} RETURNING *`,
    vals
  );
  invalidateRoleCache();
  return res.status(200).json({ role: r.rows[0], roles: await listRoles() });
}

async function deleteRole(params, res) {
  const key = params.get('key');
  if (!key) return res.status(400).json({ error: 'key is required' });

  const found = await query(`SELECT * FROM staff_roles WHERE role_key = $1`, [key]);
  if (found.rows.length === 0) return res.status(404).json({ error: 'Role not found' });
  const role = found.rows[0];

  if (role.is_builtin) {
    return res.status(400).json({
      error: `"${role.label}" is a built-in role and cannot be deleted. You can relabel it, or retire it once no staff hold it.`,
    });
  }

  const holders = await query(
    `SELECT COUNT(*) AS n FROM users WHERE role = $1 AND (app_id = 'psa' OR app_id IS NULL)`,
    [role.role_key]
  );
  const n = Number(holders.rows[0].n);
  if (n > 0) {
    // Optional one-step migration so an admin isn't stuck: move holders to
    // another existing role, then delete.
    const reassignTo = params.get('reassign_to');
    if (!reassignTo) {
      return res.status(409).json({
        error: `${n} staff member(s) hold "${role.label}". Pass reassign_to=<role_key> to move them, or change their roles first.`,
        userCount: n,
      });
    }
    const target = await query(`SELECT role_key FROM staff_roles WHERE role_key = $1 AND is_active = TRUE`, [reassignTo]);
    if (target.rows.length === 0) return res.status(400).json({ error: `reassign_to role "${reassignTo}" not found or inactive` });
    await query(
      `UPDATE users SET role = $1, updated_at = CURRENT_TIMESTAMP
        WHERE role = $2 AND (app_id = 'psa' OR app_id IS NULL)`,
      [reassignTo, role.role_key]
    );
  }

  await query(`DELETE FROM staff_roles WHERE id = $1`, [role.id]);
  invalidateRoleCache();
  return res.status(200).json({ success: true, movedUsers: n, roles: await listRoles() });
}

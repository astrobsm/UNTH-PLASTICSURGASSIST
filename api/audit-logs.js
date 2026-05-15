import { query } from './_lib/db.js';
import { cors, authenticateRequest } from './_lib/auth.js';

export default async function handler(req, res) {
  // Handle CORS
  if (cors(req, res)) return;

  // Authenticate
  const auth = authenticateRequest(req);
  if (!auth.authenticated) {
    return res.status(401).json({ error: auth.error });
  }

  const user = auth.user;

  try {
    switch (req.method) {
      case 'GET':
        return await getAuditLogs(req, res, user);
      case 'POST':
        return await createAuditLog(req, res, user);
      default:
        res.setHeader('Allow', 'GET, POST, OPTIONS');
        return res.status(405).json({ error: 'Method not allowed' });
    }
  } catch (error) {
    console.error('Audit logs API error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

// GET /api/audit-logs?limit=50&patient_id=xxx
async function getAuditLogs(req, res, user) {
  // Admin, consultant and senior registrar can view audit logs.
  if (!['admin', 'super_admin', 'consultant', 'senior_registrar'].includes(user.role)) {
    return res.status(403).json({ error: 'Access denied' });
  }

  // Ensure audit_logs table exists
  try {
    await query(`
      CREATE TABLE IF NOT EXISTS audit_logs (
        id SERIAL PRIMARY KEY,
        user_id VARCHAR(100),
        user_name VARCHAR(255),
        user_role VARCHAR(100),
        action VARCHAR(50) NOT NULL,
        resource_type VARCHAR(100) NOT NULL,
        resource_id VARCHAR(255) NOT NULL,
        resource_identifier VARCHAR(255),
        details TEXT,
        ip_address VARCHAR(100),
        timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        latitude DECIMAL(10,7),
        longitude DECIMAL(10,7),
        accuracy_meters INTEGER,
        geofence_name VARCHAR(255),
        is_inside_geofence BOOLEAN,
        address TEXT
      )
    `);
    // Idempotent ALTERs for older databases
    await query(`ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS latitude DECIMAL(10,7)`);
    await query(`ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS longitude DECIMAL(10,7)`);
    await query(`ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS accuracy_meters INTEGER`);
    await query(`ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS geofence_name VARCHAR(255)`);
    await query(`ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS is_inside_geofence BOOLEAN`);
    await query(`ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS address TEXT`);
  } catch (e) {
    // Table may already exist
  }

  const { limit = 50, patient_id, resource_type, user_id } = req.query;

  let sql = `SELECT * FROM audit_logs`;
  const params = [];
  const conditions = [];

  if (patient_id) {
    conditions.push(`resource_id = $${params.length + 1}`);
    params.push(patient_id);
  }

  if (resource_type) {
    conditions.push(`resource_type = $${params.length + 1}`);
    params.push(resource_type);
  }

  if (user_id) {
    conditions.push(`user_id = $${params.length + 1}`);
    params.push(user_id);
  }

  if (conditions.length > 0) {
    sql += ` WHERE ${conditions.join(' AND ')}`;
  }

  sql += ` ORDER BY timestamp DESC LIMIT $${params.length + 1}`;
  params.push(parseInt(limit));

  const result = await query(sql, params);
  return res.status(200).json({ data: result.rows });
}

// POST /api/audit-logs
async function createAuditLog(req, res, user) {
  const {
    user_id,
    user_name,
    user_role,
    action,
    resource_type,
    resource_id,
    resource_identifier,
    details,
    ip_address,
    timestamp,
    latitude,
    longitude,
    accuracy_meters,
    geofence_name,
    is_inside_geofence,
    address
  } = req.body;

  // Validate required fields
  if (!action || !resource_type || !resource_id) {
    return res.status(400).json({ error: 'Missing required fields: action, resource_type, resource_id' });
  }

  // Idempotent geo column upgrades (cheap, safe even if already added)
  try {
    await query(`ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS latitude DECIMAL(10,7)`);
    await query(`ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS longitude DECIMAL(10,7)`);
    await query(`ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS accuracy_meters INTEGER`);
    await query(`ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS geofence_name VARCHAR(255)`);
    await query(`ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS is_inside_geofence BOOLEAN`);
    await query(`ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS address TEXT`);
  } catch { /* columns may already exist */ }

  const detailsStr = typeof details === 'string'
    ? details
    : (details ? JSON.stringify(details) : null);

  const result = await query(
    `INSERT INTO audit_logs (
       user_id, user_name, user_role, action, resource_type, resource_id,
       resource_identifier, details, ip_address, timestamp,
       latitude, longitude, accuracy_meters, geofence_name, is_inside_geofence, address
     )
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
     RETURNING *`,
    [
      user_id || user.id?.toString(),
      user_name || user.name,
      user_role || user.role,
      action,
      resource_type,
      resource_id,
      resource_identifier || null,
      detailsStr,
      ip_address || req.headers['x-forwarded-for'] || req.headers['x-real-ip'] || 'unknown',
      timestamp || new Date().toISOString(),
      latitude ?? null,
      longitude ?? null,
      accuracy_meters ?? null,
      geofence_name || null,
      typeof is_inside_geofence === 'boolean' ? is_inside_geofence : null,
      address || null
    ]
  );

  return res.status(201).json({ data: result.rows[0] });
}

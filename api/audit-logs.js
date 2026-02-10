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
  // Only admin, super_admin, and consultant can view all audit logs
  if (!['admin', 'super_admin', 'consultant'].includes(user.role)) {
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
        timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
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
    timestamp
  } = req.body;

  // Validate required fields
  if (!action || !resource_type || !resource_id) {
    return res.status(400).json({ error: 'Missing required fields: action, resource_type, resource_id' });
  }

  const result = await query(
    `INSERT INTO audit_logs (user_id, user_name, user_role, action, resource_type, resource_id, resource_identifier, details, ip_address, timestamp)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
     RETURNING *`,
    [
      user_id || user.id?.toString(),
      user_name || user.name,
      user_role || user.role,
      action,
      resource_type,
      resource_id,
      resource_identifier || null,
      details || null,
      ip_address || req.headers['x-forwarded-for'] || req.headers['x-real-ip'] || 'unknown',
      timestamp || new Date().toISOString()
    ]
  );

  return res.status(201).json({ data: result.rows[0] });
}

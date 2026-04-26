// Lab Orders API endpoint for Vercel serverless
import { query } from './_lib/db.js';
import { cors, authenticateRequest } from './_lib/auth.js';
import { idempotent, rememberResponse } from './_lib/idempotency.js';

export default async function handler(req, res) {
  if (cors(req, res)) return;

  const auth = authenticateRequest(req);
  if (!auth.authenticated) {
    return res.status(401).json({ error: auth.error });
  }

  const { method } = req;
  const url = new URL(req.url, `http://${req.headers.host}`);
  const pathParts = url.pathname.replace('/api/lab-orders', '').split('/').filter(Boolean);
  const orderId = pathParts[0];

  try {
    switch (method) {
      case 'GET':
        if (orderId) {
          return await getLabOrder(orderId, res);
        }
        return await getAllLabOrders(url.searchParams, res);
      case 'POST':
        if (await idempotent(req, res, auth.user)) return;
        return await createLabOrder(req.body, auth.user, req, res);
      case 'PUT':
      case 'PATCH':
        if (!orderId) {
          return res.status(400).json({ error: 'Order ID required' });
        }
        return await updateLabOrder(orderId, req.body, res);
      case 'DELETE':
        if (!orderId) {
          return res.status(400).json({ error: 'Order ID required' });
        }
        return await deleteLabOrder(orderId, res);
      default:
        res.status(405).json({ error: 'Method not allowed' });
    }
  } catch (error) {
    console.error('Lab Orders API error:', error);
    res.status(500).json({ error: 'Internal server error', message: error.message });
  }
}

async function getAllLabOrders(searchParams, res) {
  const patientId = searchParams.get('patientId');
  const status = searchParams.get('status');

  // SECURITY: patientId is REQUIRED to prevent cross-patient data leakage
  if (!patientId) {
    return res.status(400).json({ error: 'patientId is required' });
  }

  let queryStr = `
    SELECT lo.*, p.first_name, p.last_name, p.hospital_number,
           u.full_name AS ordered_by_name, u.username AS ordered_by_username
    FROM lab_orders lo
    LEFT JOIN patients p ON lo.patient_id = p.id
    LEFT JOIN users u ON lo.ordered_by::text = u.id::text
    WHERE lo.patient_id = $1
  `;
  const params = [patientId];
  let paramCount = 2;

  if (status) {
    queryStr += ` AND lo.status = $${paramCount}`;
    params.push(status);
    paramCount++;
  }

  queryStr += ` ORDER BY lo.ordered_at DESC`;

  const result = await query(queryStr, params);

  res.status(200).json({ labOrders: result.rows });
}

async function getLabOrder(id, res) {
  const result = await query(
    `SELECT lo.*, p.first_name, p.last_name, p.hospital_number
     FROM lab_orders lo
     LEFT JOIN patients p ON lo.patient_id = p.id
     WHERE lo.id = $1`,
    [id]
  );

  if (result.rows.length === 0) {
    return res.status(404).json({ error: 'Lab order not found' });
  }

  const row = result.rows[0];
  if (row.ordered_by) {
    try {
      const userResult = await query('SELECT username, full_name FROM users WHERE id = $1', [row.ordered_by]);
      if (userResult.rows.length > 0) {
        row.ordered_by_name = userResult.rows[0].full_name || userResult.rows[0].username;
        row.ordered_by_username = userResult.rows[0].username;
      }
    } catch { /* user lookup failed */ }
  }

  res.status(200).json({ labOrder: row });
}

async function createLabOrder(data, user, req, res) {
  // Accept both camelCase and snake_case field names
  const patientId = data.patientId || data.patient_id;
  const testType = data.testType || data.test_type || (data.tests && data.tests[0]?.category) || 'general';
  const testsJoined = data.tests && Array.isArray(data.tests) && data.tests.length > 0 ? data.tests.map(t => t.test_name).join(', ') : null;
  const testName = data.testName || data.test_name || testsJoined || data.clinical_indication;
  const priority = data.priority || data.urgency || 'routine';
  const clinicalNotes = data.clinicalNotes || data.clinical_notes || data.clinical_indication || '';
  const status = data.status || 'pending';

  if (!patientId) {
    return res.status(400).json({ error: 'Patient ID is required' });
  }

  if (!testName && !testType) {
    return res.status(400).json({ error: 'Test type or test name is required' });
  }

  const result = await query(
    `INSERT INTO lab_orders (
      patient_id, test_type, test_name, priority,
      clinical_notes, status, ordered_by
    ) VALUES ($1, $2, $3, $4, $5, $6, $7)
    RETURNING *`,
    [patientId, testType, testName, priority, clinicalNotes, status, user.id]
  );

  const responseBody = { labOrder: result.rows[0] };
  await rememberResponse(req, user, 201, responseBody);
  res.status(201).json(responseBody);
}

async function updateLabOrder(id, data, res) {
  const fields = [];
  const values = [];
  let paramCount = 1;

  const fieldMap = {
    testType: 'test_type',
    testName: 'test_name',
    priority: 'priority',
    clinicalNotes: 'clinical_notes',
    status: 'status',
    results: 'results',
    completedAt: 'completed_at'
  };

  for (const [key, dbField] of Object.entries(fieldMap)) {
    if (data[key] !== undefined) {
      fields.push(`${dbField} = $${paramCount}`);
      values.push(key === 'results' ? JSON.stringify(data[key]) : data[key]);
      paramCount++;
    }
  }

  if (fields.length === 0) {
    return res.status(400).json({ error: 'No fields to update' });
  }

  fields.push(`updated_at = NOW()`);
  values.push(id);

  const result = await query(
    `UPDATE lab_orders SET ${fields.join(', ')} WHERE id = $${paramCount} RETURNING *`,
    values
  );

  if (result.rows.length === 0) {
    return res.status(404).json({ error: 'Lab order not found' });
  }

  res.status(200).json({ labOrder: result.rows[0] });
}

async function deleteLabOrder(id, res) {
  const result = await query('DELETE FROM lab_orders WHERE id = $1 RETURNING id', [id]);

  if (result.rows.length === 0) {
    return res.status(404).json({ error: 'Lab order not found' });
  }

  res.status(200).json({ message: 'Lab order deleted successfully' });
}

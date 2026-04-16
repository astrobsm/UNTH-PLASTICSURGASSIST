// Investigation Uploads API endpoint for Vercel serverless
import { query } from './_lib/db.js';
import { cors, authenticateRequest } from './_lib/auth.js';

export default async function handler(req, res) {
  if (cors(req, res)) return;

  const auth = authenticateRequest(req);
  if (!auth.authenticated) {
    return res.status(401).json({ error: auth.error });
  }

  const { method } = req;
  const url = new URL(req.url, `http://${req.headers.host}`);
  const pathParts = url.pathname.replace('/api/investigation-uploads', '').split('/').filter(Boolean);
  const uploadId = pathParts[0];

  try {
    await ensureTable();

    switch (method) {
      case 'GET':
        if (uploadId) {
          return await getUpload(uploadId, res);
        }
        return await getAllUploads(url.searchParams, res);
      case 'POST':
        return await createUpload(req.body, auth.user, res);
      case 'DELETE':
        if (!uploadId) {
          return res.status(400).json({ error: 'Upload ID required' });
        }
        return await deleteUpload(uploadId, res);
      default:
        res.status(405).json({ error: 'Method not allowed' });
    }
  } catch (error) {
    console.error('Investigation Uploads API error:', error);
    res.status(500).json({ error: 'Internal server error', message: error.message });
  }
}

let tableEnsured = false;

async function ensureTable() {
  if (tableEnsured) return;
  await query(`
    CREATE TABLE IF NOT EXISTS investigation_uploads (
      id SERIAL PRIMARY KEY,
      patient_id INTEGER,
      hospital_number VARCHAR(100),
      upload_type VARCHAR(20) NOT NULL,
      file_name VARCHAR(500),
      file_data TEXT,
      ocr_text TEXT,
      test_name VARCHAR(255),
      results JSONB,
      ocr_extracted BOOLEAN DEFAULT FALSE,
      status VARCHAR(50) DEFAULT 'pending',
      uploaded_by VARCHAR(255),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
    CREATE INDEX IF NOT EXISTS idx_investigation_uploads_patient ON investigation_uploads(patient_id);
  `);
  tableEnsured = true;
}

async function getAllUploads(searchParams, res) {
  const patientId = searchParams.get('patientId');

  // SECURITY: patientId is REQUIRED to prevent cross-patient data leakage
  if (!patientId) {
    return res.status(400).json({ error: 'patientId is required' });
  }

  let queryStr = `SELECT id, patient_id, hospital_number, upload_type, file_name, 
    ocr_text, test_name, results, ocr_extracted, status, uploaded_by, created_at 
    FROM investigation_uploads WHERE patient_id = $1`;
  const params = [parseInt(patientId, 10)];
  let paramCount = 2;

  queryStr += ` ORDER BY created_at DESC LIMIT 200`;

  const result = await query(queryStr, params);
  res.status(200).json({ uploads: result.rows });
}

async function getUpload(id, res) {
  const result = await query('SELECT * FROM investigation_uploads WHERE id = $1', [parseInt(id, 10)]);
  if (result.rows.length === 0) {
    return res.status(404).json({ error: 'Upload not found' });
  }
  res.status(200).json({ upload: result.rows[0] });
}

async function createUpload(body, user, res) {
  const {
    patient_id, hospital_number, upload_type, file_name, file_data,
    ocr_text, test_name, results, ocr_extracted, status
  } = body;

  if (!upload_type) {
    return res.status(400).json({ error: 'upload_type is required (form or result)' });
  }

  const result = await query(
    `INSERT INTO investigation_uploads 
     (patient_id, hospital_number, upload_type, file_name, file_data, ocr_text,
      test_name, results, ocr_extracted, status, uploaded_by)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
     RETURNING id, patient_id, hospital_number, upload_type, file_name, 
       ocr_text, test_name, results, ocr_extracted, status, uploaded_by, created_at`,
    [
      patient_id ? parseInt(patient_id, 10) : null,
      hospital_number || null,
      upload_type,
      file_name || null,
      file_data || null,
      ocr_text || null,
      test_name || null,
      results ? JSON.stringify(results) : null,
      ocr_extracted || false,
      status || 'pending',
      user.full_name || 'Unknown'
    ]
  );

  console.log(`✅ Investigation upload created for patient ${patient_id}`);
  res.status(201).json({ upload: result.rows[0] });
}

async function deleteUpload(id, res) {
  const result = await query(
    'DELETE FROM investigation_uploads WHERE id = $1 RETURNING id',
    [parseInt(id, 10)]
  );
  if (result.rows.length === 0) {
    return res.status(404).json({ error: 'Upload not found' });
  }
  res.status(200).json({ message: 'Upload deleted' });
}

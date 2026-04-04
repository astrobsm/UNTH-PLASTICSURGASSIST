// Process incoming consults: auto-register patients, auto-admit, auto-assign to HOs, notify
import { query } from '../_lib/db.js';
import { cors, authenticateRequest } from '../_lib/auth.js';
import webpush from 'web-push';

const EXTERNAL_BASE = 'https://ps-consult-unth.vercel.app/api';
const DOCTOR_CODE = process.env.PS_CONSULT_CODE || 'BLACKVELVET';

const vapidPublicKey = 'BEl62iUYgUivxIkv69yViEuiBIa-Ib9-SkvMeAtA3LhPVhJveYTGq-eAqD1Qj2HhVBNvRfGLr1JiOF0j-T_Hxxw';
const vapidPrivateKey = process.env.VAPID_PRIVATE_KEY || 'your-private-key-here';

try {
  webpush.setVapidDetails('mailto:admin@plasticsurgeryassistant.com', vapidPublicKey, vapidPrivateKey);
} catch (_) { /* ignore if keys not ready */ }

// ── External auth ──────────────────────────────────────────────
let cachedToken = null;
let tokenExpiry = 0;

async function getExternalToken() {
  if (cachedToken && Date.now() < tokenExpiry - 60000) return cachedToken;
  const response = await fetch(`${EXTERNAL_BASE}/auth/code-login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ code: DOCTOR_CODE }),
  });
  if (!response.ok) throw new Error(`External auth failed: ${response.status}`);
  const data = await response.json();
  cachedToken = data.access_token;
  tokenExpiry = Date.now() + 30 * 60 * 1000;
  try {
    const payload = JSON.parse(atob(cachedToken.split('.')[1]));
    if (payload.exp) tokenExpiry = payload.exp * 1000;
  } catch (_) {}
  return cachedToken;
}

// ── Ensure tables ──────────────────────────────────────────────
async function ensureTables() {
  await query(`
    CREATE TABLE IF NOT EXISTS consult_processing (
      id SERIAL PRIMARY KEY,
      consult_id VARCHAR(100) UNIQUE NOT NULL,
      hospital_number VARCHAR(100),
      patient_id INTEGER,
      admission_id INTEGER,
      assigned_ho_id VARCHAR(50),
      assigned_ho_name VARCHAR(255),
      status VARCHAR(50) DEFAULT 'pending_review',
      reviewed_at TIMESTAMP,
      reviewed_by VARCHAR(255),
      last_notification_at TIMESTAMP,
      notification_count INTEGER DEFAULT 0,
      consult_data JSONB,
      merged_consult_ids JSONB DEFAULT '[]',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);
  await query(`
    CREATE TABLE IF NOT EXISTS push_subscriptions (
      id SERIAL PRIMARY KEY,
      user_id TEXT NOT NULL,
      endpoint TEXT NOT NULL,
      keys JSONB NOT NULL,
      is_active BOOLEAN DEFAULT TRUE,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(user_id, endpoint)
    )
  `);
}

// ── Main handler ───────────────────────────────────────────────
export default async function handler(req, res) {
  if (cors(req, res)) return;

  const auth = authenticateRequest(req);
  if (!auth.authenticated) {
    return res.status(401).json({ error: auth.error });
  }

  try {
    await ensureTables();

    if (req.method === 'POST') {
      return await processIncomingConsults(auth.user, res);
    }
    if (req.method === 'GET') {
      return await getProcessingStatus(req, res);
    }
    if (req.method === 'PATCH') {
      return await markReviewed(req.body, auth.user, res);
    }
    return res.status(405).json({ error: 'Method not allowed' });
  } catch (error) {
    console.error('Process incoming consults error:', error);
    return res.status(500).json({ error: 'Internal server error', message: error.message });
  }
}

// ── Process all incoming consults ──────────────────────────────
async function processIncomingConsults(currentUser, res) {
  const results = { processed: 0, merged: 0, skipped: 0, errors: [], details: [] };

  // 1. Fetch all consults (paginated) from external system
  let allConsults = [];
  try {
    const externalToken = await getExternalToken();
    let page = 1;
    let hasMore = true;
    while (hasMore) {
      const response = await fetch(
        `${EXTERNAL_BASE}/consults/?page=${page}&per_page=50`,
        { headers: { 'Authorization': `Bearer ${externalToken}`, 'Content-Type': 'application/json' } }
      );
      if (!response.ok) break;
      const data = await response.json();
      allConsults = allConsults.concat(data.consults || []);
      hasMore = data.consults?.length === 50;
      page++;
    }
  } catch (err) {
    return res.status(502).json({ error: 'Failed to fetch consults from external system', message: err.message });
  }

  // 2. Get all active House Officers for round-robin assignment
  const hoResult = await query(
    `SELECT id, full_name FROM users 
     WHERE role IN ('house_officer') AND is_approved = true AND is_active = true 
       AND (app_id = 'psa' OR app_id IS NULL)
     ORDER BY id`
  );
  const houseOfficers = hoResult.rows;

  // Get current assignment counts for load balancing
  const assignCountResult = await query(
    `SELECT assigned_ho_id, COUNT(*) as cnt FROM consult_processing 
     WHERE assigned_ho_id IS NOT NULL AND status != 'reviewed'
     GROUP BY assigned_ho_id`
  );
  const hoLoadMap = {};
  for (const ho of houseOfficers) {
    hoLoadMap[ho.id] = 0;
  }
  for (const row of assignCountResult.rows) {
    if (hoLoadMap[row.assigned_ho_id] !== undefined) {
      hoLoadMap[row.assigned_ho_id] = parseInt(row.cnt);
    }
  }

  // 3. Process each consult
  const newConsultsForNotification = [];

  for (const consult of allConsults) {
    const consultId = consult.consult_id || `ext-${consult.id}`;
    const hospitalNumber = consult.hospital_number?.trim();

    try {
      // Check if already processed
      const existing = await query(
        'SELECT id, hospital_number, merged_consult_ids, consult_data FROM consult_processing WHERE consult_id = $1',
        [consultId]
      );

      if (existing.rows.length > 0) {
        results.skipped++;
        continue;
      }

      // Check if another consult with same hospital_number exists → MERGE
      let mergedInto = null;
      if (hospitalNumber) {
        const samePatient = await query(
          `SELECT id, consult_id, merged_consult_ids, patient_id, admission_id, assigned_ho_id, assigned_ho_name, consult_data
           FROM consult_processing WHERE hospital_number = $1 ORDER BY created_at ASC LIMIT 1`,
          [hospitalNumber]
        );
        if (samePatient.rows.length > 0) {
          mergedInto = samePatient.rows[0];
        }
      }

      if (mergedInto) {
        // MERGE: Add this consult ID to the existing record's merged list
        const existingMerged = Array.isArray(mergedInto.merged_consult_ids) 
          ? mergedInto.merged_consult_ids : [];
        existingMerged.push(consultId);

        // Merge consult data (keep latest diagnosis info)
        const mergedData = typeof mergedInto.consult_data === 'string'
          ? JSON.parse(mergedInto.consult_data) : (mergedInto.consult_data || {});
        if (!mergedData.merged_consults) mergedData.merged_consults = [];
        mergedData.merged_consults.push({
          consult_id: consultId,
          primary_diagnosis: consult.primary_diagnosis,
          indication: consult.indication,
          urgency: consult.urgency,
          inviting_unit: consult.inviting_unit,
          created_at: consult.created_at,
        });

        await query(
          `UPDATE consult_processing 
           SET merged_consult_ids = $1, consult_data = $2, updated_at = NOW()
           WHERE id = $3`,
          [JSON.stringify(existingMerged), JSON.stringify(mergedData), mergedInto.id]
        );

        // Also insert a tracking row so we don't re-process
        await query(
          `INSERT INTO consult_processing (consult_id, hospital_number, patient_id, admission_id, 
           assigned_ho_id, assigned_ho_name, status, consult_data)
           VALUES ($1, $2, $3, $4, $5, $6, 'merged', $7)
           ON CONFLICT (consult_id) DO NOTHING`,
          [consultId, hospitalNumber, mergedInto.patient_id, mergedInto.admission_id,
           mergedInto.assigned_ho_id, mergedInto.assigned_ho_name,
           JSON.stringify({ merged_into: mergedInto.consult_id, ...consult })]
        );

        results.merged++;
        results.details.push({ consultId, action: 'merged', mergedInto: mergedInto.consult_id });
        continue;
      }

      // ── NEW consult: Register patient, admit, assign ──

      // A) Register or find patient
      let patientId = null;
      if (hospitalNumber) {
        const patientResult = await query(
          'SELECT id FROM patients WHERE hospital_number = $1', [hospitalNumber]
        );
        if (patientResult.rows.length > 0) {
          patientId = patientResult.rows[0].id;
          // Update patient info if needed
          await query(
            `UPDATE patients SET 
              ward = COALESCE($1, ward), bed_number = COALESCE($2, bed_number),
              primary_diagnosis = COALESCE($3, primary_diagnosis),
              updated_at = NOW()
            WHERE id = $4`,
            [consult.ward, consult.bed_number, consult.primary_diagnosis, patientId]
          );
        } else {
          // Create new patient
          const nameParts = (consult.patient_name || '').trim().split(/\s+/);
          const firstName = nameParts[0] || 'Unknown';
          const lastName = nameParts.slice(1).join(' ') || 'Unknown';
          const gender = consult.sex?.toLowerCase() === 'male' ? 'Male'
            : consult.sex?.toLowerCase() === 'female' ? 'Female' : consult.sex;

          const insertResult = await query(
            `INSERT INTO patients (hospital_number, first_name, last_name, gender, phone, ward, bed_number, primary_diagnosis)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
             ON CONFLICT (hospital_number) DO UPDATE SET 
               ward = EXCLUDED.ward, bed_number = EXCLUDED.bed_number,
               primary_diagnosis = EXCLUDED.primary_diagnosis, updated_at = NOW()
             RETURNING id`,
            [hospitalNumber, firstName, lastName, gender, consult.phone_number,
             consult.ward, consult.bed_number, consult.primary_diagnosis]
          );
          patientId = insertResult.rows[0].id;
        }
      }

      // B) Create admission (if patient exists and no active admission)
      let admissionId = null;
      if (patientId) {
        const activeAdmission = await query(
          `SELECT id FROM admissions WHERE patient_id = $1 AND status = 'active'`,
          [patientId]
        );
        if (activeAdmission.rows.length > 0) {
          admissionId = activeAdmission.rows[0].id;
        } else {
          const admResult = await query(
            `INSERT INTO admissions (
              patient_id, admission_date, ward, bed_number, status,
              patient_name, hospital_number, age, gender,
              route_of_admission, referring_specialty, referring_doctor,
              reasons_for_admission, provisional_diagnosis, created_by
            ) VALUES ($1, $2, $3, $4, 'active', $5, $6, $7, $8, 'referral', $9, $10, $11, $12, $13)
            RETURNING id`,
            [
              patientId,
              consult.date_of_admission || new Date().toISOString(),
              consult.ward, consult.bed_number,
              consult.patient_name, hospitalNumber,
              consult.age, consult.sex,
              consult.inviting_unit, consult.requesting_doctor,
              consult.indication || consult.primary_diagnosis,
              consult.primary_diagnosis,
              'system-auto'
            ]
          );
          admissionId = admResult.rows[0].id;
        }
      }

      // C) Auto-assign to least-loaded House Officer
      let assignedHo = null;
      if (houseOfficers.length > 0) {
        // Pick the HO with least pending assignments
        let minLoad = Infinity;
        for (const ho of houseOfficers) {
          const load = hoLoadMap[ho.id] || 0;
          if (load < minLoad) {
            minLoad = load;
            assignedHo = ho;
          }
        }
        // Update load map
        if (assignedHo) {
          hoLoadMap[assignedHo.id] = (hoLoadMap[assignedHo.id] || 0) + 1;
        }

        // Also update patient_assignments table
        if (patientId && assignedHo) {
          await query(
            `INSERT INTO patient_assignments (patient_id, hospital_number, house_officer_id, assigned_at, is_active)
             VALUES ($1, $2, $3, NOW(), true)
             ON CONFLICT (patient_id) DO UPDATE SET 
               house_officer_id = COALESCE(patient_assignments.house_officer_id, EXCLUDED.house_officer_id),
               updated_at = NOW()`,
            [String(patientId), hospitalNumber, String(assignedHo.id)]
          );
        }
      }

      // D) Insert processing record
      await query(
        `INSERT INTO consult_processing (
          consult_id, hospital_number, patient_id, admission_id,
          assigned_ho_id, assigned_ho_name, status, consult_data
        ) VALUES ($1, $2, $3, $4, $5, $6, 'pending_review', $7)
        ON CONFLICT (consult_id) DO NOTHING`,
        [
          consultId, hospitalNumber, patientId, admissionId,
          assignedHo?.id || null, assignedHo?.full_name || null,
          JSON.stringify(consult)
        ]
      );

      results.processed++;
      newConsultsForNotification.push({
        consultId, patientName: consult.patient_name, hospitalNumber,
        urgency: consult.urgency, diagnosis: consult.primary_diagnosis,
        assignedHo: assignedHo?.full_name, ward: consult.ward
      });
      results.details.push({
        consultId, action: 'processed', patientId, admissionId,
        assignedTo: assignedHo?.full_name || 'unassigned'
      });

    } catch (err) {
      console.error(`Error processing consult ${consultId}:`, err);
      results.errors.push({ consultId, error: err.message });
    }
  }

  // 4. Send push notifications for new consults
  if (newConsultsForNotification.length > 0) {
    await sendConsultNotifications(newConsultsForNotification);
  }

  return res.status(200).json({
    message: `Processed ${results.processed} new consults, merged ${results.merged}, skipped ${results.skipped} existing`,
    ...results,
    totalConsults: allConsults.length,
    houseOfficers: houseOfficers.map(h => h.full_name),
  });
}

// ── Send push notifications to all users ───────────────────────
async function sendConsultNotifications(newConsults) {
  try {
    const subsResult = await query('SELECT * FROM push_subscriptions WHERE is_active = true');
    const subscriptions = subsResult.rows;
    if (subscriptions.length === 0) return;

    for (const consult of newConsults) {
      const urgencyEmoji = consult.urgency === 'emergency' ? '🚨' : consult.urgency === 'urgent' ? '⚠️' : '📋';
      const payload = JSON.stringify({
        title: `${urgencyEmoji} New Consult: ${consult.patientName}`,
        body: `${consult.diagnosis}\nWard: ${consult.ward} | Assigned to: ${consult.assignedHo || 'Unassigned'}\nHospital No: ${consult.hospitalNumber}`,
        data: {
          type: 'new_consult',
          consultId: consult.consultId,
          hospitalNumber: consult.hospitalNumber,
          urgency: consult.urgency,
          url: '/consults'
        },
        icon: '/icons/icon-192x192.png',
        badge: '/icons/badge-72x72.png',
        vibrate: [200, 100, 200, 100, 200],
        requireInteraction: true,
        tag: `consult-${consult.consultId}`,
      });

      for (const sub of subscriptions) {
        try {
          const pushSub = {
            endpoint: sub.endpoint,
            keys: typeof sub.keys === 'string' ? JSON.parse(sub.keys) : sub.keys
          };
          await webpush.sendNotification(pushSub, payload);
        } catch (err) {
          if (err.statusCode === 410) {
            await query('UPDATE push_subscriptions SET is_active = false WHERE id = $1', [sub.id]);
          }
        }
      }
    }
  } catch (err) {
    console.error('Failed to send consult notifications:', err);
  }
}

// ── Send reminder notifications for unreviewed consults ────────
async function sendReminderNotifications() {
  try {
    // Get all pending_review consults older than 1 hour that haven't been notified in the last 2 hours
    const pending = await query(
      `SELECT cp.*, 
        (cp.consult_data->>'patient_name') as patient_name,
        (cp.consult_data->>'urgency') as urgency,
        (cp.consult_data->>'primary_diagnosis') as diagnosis,
        (cp.consult_data->>'ward') as ward
       FROM consult_processing cp
       WHERE cp.status = 'pending_review'
         AND cp.created_at < NOW() - INTERVAL '1 hour'
         AND (cp.last_notification_at IS NULL OR cp.last_notification_at < NOW() - INTERVAL '2 hours')`
    );

    if (pending.rows.length === 0) return;

    const subsResult = await query('SELECT * FROM push_subscriptions WHERE is_active = true');
    const subscriptions = subsResult.rows;
    if (subscriptions.length === 0) return;

    for (const row of pending.rows) {
      const payload = JSON.stringify({
        title: `⏰ Pending Review: ${row.patient_name || 'Patient'}`,
        body: `Consult ${row.consult_id} still awaiting HO review.\nAssigned to: ${row.assigned_ho_name || 'Unassigned'}\nDiagnosis: ${row.diagnosis || 'N/A'}`,
        data: {
          type: 'consult_reminder',
          consultId: row.consult_id,
          url: '/consults'
        },
        icon: '/icons/icon-192x192.png',
        badge: '/icons/badge-72x72.png',
        vibrate: [200, 100, 200],
        requireInteraction: true,
        tag: `consult-reminder-${row.consult_id}`,
      });

      for (const sub of subscriptions) {
        try {
          const pushSub = {
            endpoint: sub.endpoint,
            keys: typeof sub.keys === 'string' ? JSON.parse(sub.keys) : sub.keys
          };
          await webpush.sendNotification(pushSub, payload);
        } catch (err) {
          if (err.statusCode === 410) {
            await query('UPDATE push_subscriptions SET is_active = false WHERE id = $1', [sub.id]);
          }
        }
      }

      // Update notification tracking
      await query(
        `UPDATE consult_processing SET last_notification_at = NOW(), notification_count = notification_count + 1 WHERE id = $1`,
        [row.id]
      );
    }
  } catch (err) {
    console.error('Failed to send reminder notifications:', err);
  }
}

// ── GET: Retrieve processing status ────────────────────────────
async function getProcessingStatus(req, res) {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const hospitalNumber = url.searchParams.get('hospital_number');
  const consultId = url.searchParams.get('consult_id');
  const statusFilter = url.searchParams.get('status');

  let queryStr = `SELECT * FROM consult_processing WHERE 1=1`;
  const params = [];
  let n = 1;

  if (hospitalNumber) { queryStr += ` AND hospital_number = $${n}`; params.push(hospitalNumber); n++; }
  if (consultId) { queryStr += ` AND consult_id = $${n}`; params.push(consultId); n++; }
  if (statusFilter) { queryStr += ` AND status = $${n}`; params.push(statusFilter); n++; }

  queryStr += ' ORDER BY created_at DESC';

  const result = await query(queryStr, params);

  // Also send reminders for unreviewed while we're at it
  sendReminderNotifications().catch(() => {});

  return res.status(200).json({ records: result.rows });
}

// ── PATCH: Mark consult as reviewed by HO ──────────────────────
async function markReviewed(data, user, res) {
  const { consult_id, notes } = data;
  if (!consult_id) {
    return res.status(400).json({ error: 'consult_id required' });
  }

  const result = await query(
    `UPDATE consult_processing 
     SET status = 'reviewed', reviewed_at = NOW(), reviewed_by = $1, updated_at = NOW()
     WHERE consult_id = $2 AND status != 'merged'
     RETURNING *`,
    [user.full_name || user.username || String(user.id), consult_id]
  );

  if (result.rows.length === 0) {
    return res.status(404).json({ error: 'Consult not found or already reviewed' });
  }

  // Also mark merged consults
  const merged = result.rows[0].merged_consult_ids;
  if (Array.isArray(merged) && merged.length > 0) {
    for (const mid of merged) {
      await query(
        `UPDATE consult_processing SET status = 'reviewed', reviewed_at = NOW(), reviewed_by = $1 WHERE consult_id = $2`,
        [user.full_name || user.username || String(user.id), mid]
      );
    }
  }

  // Send notification that consult was reviewed
  try {
    const subsResult = await query('SELECT * FROM push_subscriptions WHERE is_active = true');
    const patientName = result.rows[0].consult_data?.patient_name || 'Patient';
    const payload = JSON.stringify({
      title: `✅ Consult Reviewed: ${patientName}`,
      body: `${result.rows[0].consult_id} reviewed by ${user.full_name || user.username}`,
      data: { type: 'consult_reviewed', consultId: consult_id, url: '/consults' },
      icon: '/icons/icon-192x192.png',
      tag: `consult-reviewed-${consult_id}`,
    });
    for (const sub of subsResult.rows) {
      try {
        const pushSub = {
          endpoint: sub.endpoint,
          keys: typeof sub.keys === 'string' ? JSON.parse(sub.keys) : sub.keys
        };
        await webpush.sendNotification(pushSub, payload);
      } catch (_) {}
    }
  } catch (_) {}

  return res.status(200).json({ message: 'Consult marked as reviewed', record: result.rows[0] });
}

// Sync API endpoint for offline data synchronization
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
  const action = url.pathname.replace('/api/sync', '').split('/').filter(Boolean)[0];

  try {
    switch (method) {
      case 'POST':
        if (action === 'push') {
          return await handlePush(req.body, auth.user, res);
        }
        if (action === 'pull') {
          return await handlePull(req.body, auth.user, res);
        }
        return await handleFullSync(req.body, auth.user, res);
      case 'GET':
        return await getSyncStatus(auth.user, res);
      default:
        res.status(405).json({ error: 'Method not allowed' });
    }
  } catch (error) {
    console.error('Sync API error:', error);
    res.status(500).json({ error: 'Internal server error', message: error.message });
  }
}

async function getSyncStatus(user, res) {
  const result = await query(
    `SELECT COUNT(*) as pending, MAX(created_at) as last_sync
     FROM sync_queue WHERE user_id = $1 AND status = 'pending'`,
    [user.id]
  );

  res.status(200).json({
    pendingChanges: parseInt(result.rows[0].pending),
    lastSync: result.rows[0].last_sync,
    serverTime: new Date().toISOString()
  });
}

async function handlePush(data, user, res) {
  const { changes } = data;
  
  if (!changes || !Array.isArray(changes)) {
    return res.status(400).json({ error: 'Changes array is required' });
  }

  const results = [];
  
  for (const change of changes) {
    const { entityType, entityId, action, payload } = change;
    
    try {
      // Queue the change for processing
      await query(
        `INSERT INTO sync_queue (user_id, entity_type, entity_id, action, data, status)
         VALUES ($1, $2, $3, $4, $5, 'pending')`,
        [user.id, entityType, entityId, action, JSON.stringify(payload)]
      );
      
      results.push({ entityId, status: 'queued' });
    } catch (error) {
      results.push({ entityId, status: 'error', message: error.message });
    }
  }

  res.status(200).json({ 
    success: true, 
    processed: results.length,
    results 
  });
}

async function handlePull(data, user, res) {
  const { since, entities } = data;
  const sinceDate = since ? new Date(since) : new Date(0);
  
  const updates = {};
  
  // Define entities to sync
  const entityConfigs = {
    patients: { table: 'patients', userField: null },
    surgeries: { table: 'surgeries', userField: null },
    treatmentPlans: { table: 'treatment_plans', userField: null },
    admissions: { table: 'admissions', userField: null },
    labOrders: { table: 'lab_orders', userField: null },
    prescriptions: { table: 'prescriptions', userField: null },
    woundCare: { table: 'wound_care_records', userField: null }
  };

  for (const [entityName, config] of Object.entries(entityConfigs)) {
    if (!entities || entities.includes(entityName)) {
      try {
        const result = await query(
          `SELECT * FROM ${config.table} WHERE updated_at > $1 ORDER BY updated_at DESC LIMIT 1000`,
          [sinceDate]
        );
        updates[entityName] = result.rows;
      } catch (error) {
        console.error(`Error pulling ${entityName}:`, error);
        updates[entityName] = [];
      }
    }
  }

  res.status(200).json({
    success: true,
    serverTime: new Date().toISOString(),
    updates
  });
}

async function handleFullSync(data, user, res) {
  // Full sync: push then pull
  const pushResult = data.changes ? await processChanges(data.changes, user) : { processed: 0 };
  
  const pullResult = await query(`
    SELECT 
      (SELECT json_agg(row_to_json(p)) FROM patients p) as patients,
      (SELECT json_agg(row_to_json(s)) FROM surgeries s) as surgeries,
      (SELECT json_agg(row_to_json(tp)) FROM treatment_plans tp) as treatment_plans,
      (SELECT json_agg(row_to_json(a)) FROM admissions a) as admissions
  `);

  res.status(200).json({
    success: true,
    serverTime: new Date().toISOString(),
    pushed: pushResult.processed,
    data: pullResult.rows[0]
  });
}

async function processChanges(changes, user) {
  let processed = 0;
  for (const change of changes) {
    try {
      await query(
        `INSERT INTO sync_queue (user_id, entity_type, entity_id, action, data, status)
         VALUES ($1, $2, $3, $4, $5, 'processed')`,
        [user.id, change.entityType, change.entityId, change.action, JSON.stringify(change.payload)]
      );
      processed++;
    } catch (error) {
      console.error('Error processing change:', error);
    }
  }
  return { processed };
}

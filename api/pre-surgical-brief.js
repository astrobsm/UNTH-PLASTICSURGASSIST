/**
 * What the pre-surgical brief decided, and who has to do it.
 *
 * The conference module could already assemble a patient's data and present it.
 * What it could not do was record the outcome: the plan agreed in the room went
 * into a single free-text `conference_decision` field, and the jobs that came
 * out of it went nowhere at all. A brief whose decisions are not tracked is a
 * meeting, not a handover.
 *
 * TWO TABLES
 * `pre_surgical_briefs` holds one row per patient per brief — the pre-op,
 * intra-op, contingency and post-op plans, and the clearance decision.
 * `pre_surgical_brief_tasks` holds the work, each item assigned to a named
 * person with a phase, a due time and a status.
 *
 * ROUTES (vercel.json sends /api/pre-surgical-brief/* here)
 *   GET   /pre-surgical-brief/:patientId            brief + its tasks
 *   POST  /pre-surgical-brief/:patientId            create or update the plans
 *   POST  /pre-surgical-brief/:patientId/approve    record the clearance decision
 *   POST  /pre-surgical-brief/:patientId/tasks      assign a task
 *   PATCH /pre-surgical-brief/:patientId/tasks/:id  move a task's status
 *
 * CLEARANCE IS NOT A CHECKBOX ANYONE MAY TICK. Only a consultant or an admin
 * may clear a patient for surgery, and the decision is stamped with who made it
 * and when. Everything else about the brief is editable by the team.
 */

import { query } from './_lib/db.js';
import { cors, authenticateRequest } from './_lib/auth.js';
import { notifyUsers } from './_lib/notify.js';

const PHASES = ['preop', 'intraop', 'postop'];
const STATUSES = ['pending', 'in_progress', 'done', 'cancelled'];
const MAY_CLEAR = ['consultant', 'admin'];

let ready = false;

async function ensureTables() {
  if (ready) return;
  await query(`
    CREATE TABLE IF NOT EXISTS pre_surgical_briefs (
      id                  SERIAL PRIMARY KEY,
      patient_id          INTEGER NOT NULL,
      surgery_id          INTEGER,
      preop_plan          TEXT,
      intraop_plan        TEXT,
      contingency_plan    TEXT,
      postop_plan         TEXT,
      additional_comments TEXT,
      cleared_for_surgery BOOLEAN,
      approved_by         INTEGER,
      approved_at         TIMESTAMPTZ,
      created_by          INTEGER,
      created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS pre_surgical_brief_tasks (
      id           SERIAL PRIMARY KEY,
      brief_id     INTEGER NOT NULL,
      patient_id   INTEGER,
      phase        VARCHAR(20) NOT NULL DEFAULT 'postop',
      description  TEXT NOT NULL,
      assigned_to  INTEGER,
      due_at       TIMESTAMPTZ,
      status       VARCHAR(20) NOT NULL DEFAULT 'pending',
      completed_at TIMESTAMPTZ,
      completed_by INTEGER,
      created_by   INTEGER,
      created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE INDEX IF NOT EXISTS idx_psb_patient ON pre_surgical_briefs(patient_id);
    CREATE INDEX IF NOT EXISTS idx_psbt_brief ON pre_surgical_brief_tasks(brief_id);
    CREATE INDEX IF NOT EXISTS idx_psbt_assignee ON pre_surgical_brief_tasks(assigned_to, status);
  `);
  ready = true;
}

function toTask(r) {
  return {
    id: r.id,
    brief_id: r.brief_id,
    patient_id: r.patient_id,
    phase: r.phase,
    description: r.description,
    assigned_to: r.assigned_to,
    assigned_to_name: r.assigned_to_name || null,
    due_at: r.due_at,
    status: r.status,
    completed_at: r.completed_at,
    completed_by_name: r.completed_by_name || null,
    created_at: r.created_at,
  };
}

function toBrief(r) {
  if (!r) return null;
  return {
    id: r.id,
    patient_id: r.patient_id,
    surgery_id: r.surgery_id,
    preop_plan: r.preop_plan,
    intraop_plan: r.intraop_plan,
    contingency_plan: r.contingency_plan,
    postop_plan: r.postop_plan,
    additional_comments: r.additional_comments,
    cleared_for_surgery: r.cleared_for_surgery,
    approved_by: r.approved_by,
    approved_by_name: r.approved_by_name || null,
    approved_at: r.approved_at,
    created_at: r.created_at,
    updated_at: r.updated_at,
  };
}

/** The current brief for a patient, or null. One brief per patient — the latest. */
async function currentBrief(patientId) {
  const r = await query(
    `SELECT b.*, (SELECT full_name FROM users WHERE id = b.approved_by) AS approved_by_name
       FROM pre_surgical_briefs b
      WHERE b.patient_id = $1
      ORDER BY b.updated_at DESC, b.id DESC
      LIMIT 1`,
    [patientId]
  );
  return r.rows[0] || null;
}

async function tasksFor(briefId) {
  const r = await query(
    `SELECT t.*,
            (SELECT full_name FROM users WHERE id = t.assigned_to)  AS assigned_to_name,
            (SELECT full_name FROM users WHERE id = t.completed_by) AS completed_by_name
       FROM pre_surgical_brief_tasks t
      WHERE t.brief_id = $1
      ORDER BY
        CASE t.phase WHEN 'preop' THEN 1 WHEN 'intraop' THEN 2 ELSE 3 END,
        t.due_at NULLS LAST, t.id`,
    [briefId]
  );
  return r.rows.map(toTask);
}

async function getBrief(patientId, res) {
  const row = await currentBrief(patientId);
  if (!row) return res.status(200).json({ brief: null, tasks: [] });
  return res.status(200).json({ brief: toBrief(row), tasks: await tasksFor(row.id) });
}

async function saveBrief(patientId, body, user, res) {
  const existing = await currentBrief(patientId);

  // Only the plan fields present in the body are written, so two people editing
  // different sections do not blank each other's work.
  const fields = ['preop_plan', 'intraop_plan', 'contingency_plan', 'postop_plan', 'additional_comments'];
  const provided = fields.filter(f => body?.[f] !== undefined);

  if (!existing) {
    const cols = ['patient_id', 'surgery_id', 'created_by', ...provided];
    const vals = [patientId, body?.surgery_id ?? null, user.id, ...provided.map(f => body[f])];
    const holes = vals.map((_, i) => `$${i + 1}`).join(', ');
    const r = await query(
      `INSERT INTO pre_surgical_briefs (${cols.join(', ')}) VALUES (${holes}) RETURNING *`,
      vals
    );
    return res.status(201).json({ brief: toBrief(r.rows[0]), tasks: [] });
  }

  if (!provided.length) {
    return res.status(200).json({ brief: toBrief(existing), tasks: await tasksFor(existing.id) });
  }

  const sets = provided.map((f, i) => `${f} = $${i + 2}`);
  const r = await query(
    `UPDATE pre_surgical_briefs
        SET ${sets.join(', ')}, updated_at = NOW()
      WHERE id = $1
      RETURNING *`,
    [existing.id, ...provided.map(f => body[f])]
  );
  return res.status(200).json({ brief: toBrief(r.rows[0]), tasks: await tasksFor(existing.id) });
}

async function approveBrief(patientId, body, user, res) {
  if (!MAY_CLEAR.includes(user.role)) {
    return res.status(403).json({ error: 'Only a consultant or administrator may record a clearance decision' });
  }
  if (typeof body?.cleared_for_surgery !== 'boolean') {
    return res.status(400).json({ error: 'cleared_for_surgery must be true or false' });
  }

  const existing = await currentBrief(patientId);
  if (!existing) return res.status(404).json({ error: 'No brief to approve — record the plan first' });

  const r = await query(
    `UPDATE pre_surgical_briefs
        SET cleared_for_surgery = $2, approved_by = $3, approved_at = NOW(), updated_at = NOW()
      WHERE id = $1
      RETURNING *`,
    [existing.id, body.cleared_for_surgery, user.id]
  );

  // Everyone holding a job on this brief needs to know the decision — a patient
  // not cleared is a theatre list that has to change.
  const assignees = await query(
    `SELECT DISTINCT assigned_to FROM pre_surgical_brief_tasks
      WHERE brief_id = $1 AND assigned_to IS NOT NULL`,
    [existing.id]
  );
  await notifyUsers(assignees.rows.map(a => a.assigned_to), {
    title: body.cleared_for_surgery ? 'Patient cleared for surgery' : 'Patient NOT cleared for surgery',
    body: `Decision recorded by ${user.fullName || user.full_name || 'a consultant'}.`,
    url: '/pre-surgical-conference',
    tag: `brief-approval-${existing.id}`,
  });

  const withName = await currentBrief(patientId);
  return res.status(200).json({ brief: toBrief(withName || r.rows[0]), tasks: await tasksFor(existing.id) });
}

async function createTask(patientId, body, user, res) {
  const description = String(body?.description || '').trim();
  if (!description) return res.status(400).json({ error: 'description is required' });

  const phase = PHASES.includes(body?.phase) ? body.phase : 'postop';

  let brief = await currentBrief(patientId);
  if (!brief) {
    // A task can be raised before the plans are written up; the brief row is
    // created so the work has somewhere to hang rather than being refused.
    const created = await query(
      `INSERT INTO pre_surgical_briefs (patient_id, created_by) VALUES ($1, $2) RETURNING *`,
      [patientId, user.id]
    );
    brief = created.rows[0];
  }

  const assignedTo = body?.assigned_to != null ? Number(body.assigned_to) : null;

  const r = await query(
    `INSERT INTO pre_surgical_brief_tasks
       (brief_id, patient_id, phase, description, assigned_to, due_at, created_by)
     VALUES ($1,$2,$3,$4,$5,$6,$7)
     RETURNING *`,
    [brief.id, patientId, phase, description, assignedTo, body?.due_at || null, user.id]
  );

  if (assignedTo) {
    await notifyUsers([assignedTo], {
      title: 'New task from the pre-surgical brief',
      body: description.slice(0, 120),
      url: '/pre-surgical-conference',
      tag: `brief-task-${r.rows[0].id}`,
    });
  }

  const [withNames] = await tasksFor(brief.id).then(all => all.filter(t => t.id === r.rows[0].id));
  return res.status(201).json({ task: withNames || toTask(r.rows[0]) });
}

async function updateTask(patientId, taskId, body, user, res) {
  const existing = await query(
    `SELECT t.* FROM pre_surgical_brief_tasks t WHERE t.id = $1 AND t.patient_id = $2`,
    [Number(taskId), patientId]
  );
  const task = existing.rows[0];
  if (!task) return res.status(404).json({ error: 'No such task for this patient' });

  const sets = [];
  const args = [task.id];

  if (body?.status !== undefined) {
    if (!STATUSES.includes(body.status)) {
      return res.status(400).json({ error: `status must be one of ${STATUSES.join(', ')}` });
    }
    args.push(body.status);
    sets.push(`status = $${args.length}`);

    // Completion is stamped by the server from the token, so "who finished it"
    // cannot be asserted by the caller.
    if (body.status === 'done') {
      args.push(user.id);
      sets.push(`completed_by = $${args.length}`, 'completed_at = NOW()');
    } else {
      sets.push('completed_by = NULL', 'completed_at = NULL');
    }
  }

  for (const [field, value] of [
    ['description', body?.description],
    ['phase', PHASES.includes(body?.phase) ? body.phase : undefined],
    ['due_at', body?.due_at],
  ]) {
    if (value !== undefined) {
      args.push(value);
      sets.push(`${field} = $${args.length}`);
    }
  }

  let notifyNewAssignee = null;
  if (body?.assigned_to !== undefined) {
    const next = body.assigned_to == null ? null : Number(body.assigned_to);
    args.push(next);
    sets.push(`assigned_to = $${args.length}`);
    if (next && next !== task.assigned_to) notifyNewAssignee = next;
  }

  if (!sets.length) return res.status(400).json({ error: 'No fields to update' });

  await query(
    `UPDATE pre_surgical_brief_tasks SET ${sets.join(', ')}, updated_at = NOW() WHERE id = $1`,
    args
  );

  if (notifyNewAssignee) {
    await notifyUsers([notifyNewAssignee], {
      title: 'A pre-surgical brief task was assigned to you',
      body: String(body?.description || task.description).slice(0, 120),
      url: '/pre-surgical-conference',
      tag: `brief-task-${task.id}`,
    });
  }

  const all = await tasksFor(task.brief_id);
  return res.status(200).json({ task: all.find(t => t.id === task.id) || null, tasks: all });
}

export default async function handler(req, res) {
  if (cors(req, res)) return;

  const auth = authenticateRequest(req);
  if (!auth.authenticated) return res.status(auth.status || 401).json({ error: auth.error });

  try {
    await ensureTables();

    const url = new URL(req.url, `http://${req.headers.host}`);
    const parts = url.pathname.replace(/^\/api\/pre-surgical-brief/, '').split('/').filter(Boolean);

    const patientId = Number(parts[0]);
    if (!Number.isFinite(patientId)) {
      return res.status(400).json({ error: 'A numeric patient id is required' });
    }

    const sub = parts[1];

    if (!sub) {
      if (req.method === 'GET') return await getBrief(patientId, res);
      if (req.method === 'POST') return await saveBrief(patientId, req.body, auth.user, res);
      return res.status(405).json({ error: 'Method not allowed' });
    }

    if (sub === 'approve' && req.method === 'POST') {
      return await approveBrief(patientId, req.body, auth.user, res);
    }

    if (sub === 'tasks') {
      if (!parts[2] && req.method === 'POST') {
        return await createTask(patientId, req.body, auth.user, res);
      }
      if (parts[2] && (req.method === 'PATCH' || req.method === 'PUT')) {
        return await updateTask(patientId, parts[2], req.body, auth.user, res);
      }
      return res.status(405).json({ error: 'Method not allowed' });
    }

    return res.status(404).json({ error: 'No such brief route' });
  } catch (error) {
    console.error('Pre-surgical brief API error:', error);
    return res.status(500).json({ error: 'Internal server error', message: error.message });
  }
}

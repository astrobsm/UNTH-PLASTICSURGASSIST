// ============================================================================
// The register for a conference.
//
// Presence on the signalling channel says who is in the room this second; this
// says who was there on the night, which is what a training record needs.
//
// Joining is recorded by the participant's own client, leaving too. A client
// that closes without saying so leaves an open row, which is why `seconds_present`
// accumulates on each update rather than being computed from joined_at alone —
// a dropped connection then costs the time since the last heartbeat, not the
// whole meeting.
// ============================================================================

import { query } from './_lib/db.js';
import { cors, authenticateRequest } from './_lib/auth.js';

const SUPERVISOR_ROLES = ['admin', 'super_admin', 'consultant', 'senior_registrar'];

export default async function handler(req, res) {
  if (cors(req, res)) return;

  const auth = authenticateRequest(req, { allowStudents: true });
  if (!auth.authenticated) {
    return res.status(auth.status || 401).json({ error: 'Unauthorized', message: auth.error });
  }

  try {
    await ensureTables();
    if (req.method === 'POST') return await handlePost(req, res, auth.user);
    if (req.method === 'GET') return await handleGet(req, res, auth.user);
    res.setHeader('Allow', ['GET', 'POST']);
    return res.status(405).json({ error: 'Method not allowed' });
  } catch (error) {
    console.error('conference-attendance error:', error);
    return res.status(500).json({ error: 'Internal server error', message: error.message });
  }
}

/**
 * Creates the tables on first use.
 *
 * Migrations here are applied by hand against a hosted database, so an endpoint
 * that depends on new tables cannot assume they arrived before the deploy did.
 */
let ready = false;
async function ensureTables() {
  if (ready) return;
  const statements = [
    `CREATE TABLE IF NOT EXISTS conference_meetings (
       id SERIAL PRIMARY KEY,
       room_id VARCHAR(64) UNIQUE NOT NULL,
       topic TEXT,
       meeting_type VARCHAR(30) NOT NULL DEFAULT 'general',
       host_user_id INTEGER,
       started_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
       ended_at TIMESTAMPTZ,
       created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP)`,
    `CREATE TABLE IF NOT EXISTS conference_attendance (
       id SERIAL PRIMARY KEY,
       meeting_id INTEGER NOT NULL REFERENCES conference_meetings(id) ON DELETE CASCADE,
       user_id INTEGER,
       display_name VARCHAR(255),
       role VARCHAR(50),
       joined_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
       left_at TIMESTAMPTZ,
       seconds_present INTEGER DEFAULT 0,
       UNIQUE (meeting_id, user_id))`,
    `CREATE TABLE IF NOT EXISTS conference_cases (
       id SERIAL PRIMARY KEY,
       meeting_id INTEGER NOT NULL REFERENCES conference_meetings(id) ON DELETE CASCADE,
       patient_id VARCHAR(255) NOT NULL,
       patient_name VARCHAR(255),
       presented_by INTEGER,
       presented_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
       ended_at TIMESTAMPTZ)`,
    `CREATE INDEX IF NOT EXISTS idx_conf_attendance_meet ON conference_attendance(meeting_id)`,
  ];
  for (const sql of statements) {
    try { await query(sql); } catch (e) { console.warn('ensureTables:', e.message); }
  }
  ready = true;
}

/** Finds or opens the meeting for a room. */
async function meetingFor(roomId, { topic, type, hostId } = {}) {
  const existing = await query('SELECT id FROM conference_meetings WHERE room_id = $1', [roomId]);
  if (existing.rows[0]) return existing.rows[0].id;

  const created = await query(
    `INSERT INTO conference_meetings (room_id, topic, meeting_type, host_user_id)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (room_id) DO UPDATE SET topic = COALESCE(conference_meetings.topic, EXCLUDED.topic)
     RETURNING id`,
    [roomId, topic || null, type || (roomId.startsWith('psc-') ? 'pre_surgical' : 'general'), hostId ?? null],
  );
  return created.rows[0].id;
}

async function handlePost(req, res, user) {
  const { action, roomId, topic, type, patientId, patientName, seconds } = req.body || {};
  if (!roomId) return res.status(400).json({ error: 'roomId is required' });

  switch (action) {
    case 'join': {
      const meetingId = await meetingFor(roomId, { topic, type, hostId: user.id });
      await query(
        `INSERT INTO conference_attendance (meeting_id, user_id, display_name, role)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (meeting_id, user_id)
         DO UPDATE SET left_at = NULL, display_name = EXCLUDED.display_name
         RETURNING id`,
        [meetingId, user.id, user.full_name || user.name || user.username || null, user.role || null],
      );
      return res.status(200).json({ meetingId, recorded: true });
    }

    case 'heartbeat': {
      // Adds the seconds since the last beat. A client that dies mid-meeting
      // loses only the final interval.
      const meetingId = await meetingFor(roomId);
      await query(
        `UPDATE conference_attendance
         SET seconds_present = COALESCE(seconds_present, 0) + $1
         WHERE meeting_id = $2 AND user_id = $3`,
        [Math.max(0, Math.min(Number(seconds) || 0, 600)), meetingId, user.id],
      );
      return res.status(200).json({ ok: true });
    }

    case 'leave': {
      const meetingId = await meetingFor(roomId);
      await query(
        `UPDATE conference_attendance
         SET left_at = CURRENT_TIMESTAMP,
             seconds_present = COALESCE(seconds_present, 0) + $1
         WHERE meeting_id = $2 AND user_id = $3`,
        [Math.max(0, Math.min(Number(seconds) || 0, 600)), meetingId, user.id],
      );
      return res.status(200).json({ ok: true });
    }

    case 'present-case': {
      const meetingId = await meetingFor(roomId);
      // Close whatever was on screen before opening the next case.
      await query(
        `UPDATE conference_cases SET ended_at = CURRENT_TIMESTAMP
         WHERE meeting_id = $1 AND ended_at IS NULL`,
        [meetingId],
      );
      if (patientId) {
        await query(
          `INSERT INTO conference_cases (meeting_id, patient_id, patient_name, presented_by)
           VALUES ($1, $2, $3, $4)`,
          [meetingId, String(patientId), patientName || null, user.id],
        );
      }
      return res.status(200).json({ ok: true });
    }

    case 'end': {
      if (!SUPERVISOR_ROLES.includes(user.role)) {
        return res.status(403).json({ error: 'Only a supervisor can close a meeting' });
      }
      const meetingId = await meetingFor(roomId);
      await query(
        `UPDATE conference_meetings SET ended_at = CURRENT_TIMESTAMP WHERE id = $1 AND ended_at IS NULL`,
        [meetingId],
      );
      await query(
        `UPDATE conference_attendance SET left_at = CURRENT_TIMESTAMP
         WHERE meeting_id = $1 AND left_at IS NULL`,
        [meetingId],
      );
      return res.status(200).json({ ok: true });
    }

    default:
      return res.status(400).json({ error: 'Unknown action' });
  }
}

async function handleGet(req, res, user) {
  const { roomId, limit } = req.query;

  // One meeting's register.
  if (roomId) {
    const meeting = (await query(
      'SELECT * FROM conference_meetings WHERE room_id = $1', [roomId])).rows[0];
    if (!meeting) return res.status(404).json({ error: 'No such meeting' });

    const attendees = (await query(
      `SELECT a.*, u.full_name, u.role AS user_role
       FROM conference_attendance a
       LEFT JOIN users u ON u.id = a.user_id
       WHERE a.meeting_id = $1 ORDER BY a.joined_at`, [meeting.id])).rows;

    const cases = (await query(
      `SELECT c.*, u.full_name AS presenter
       FROM conference_cases c
       LEFT JOIN users u ON u.id = c.presented_by
       WHERE c.meeting_id = $1 ORDER BY c.presented_at`, [meeting.id])).rows;

    return res.status(200).json({ meeting, attendees, cases });
  }

  // The recent register, for supervisors; a trainee sees their own record.
  const isSupervisor = SUPERVISOR_ROLES.includes(user.role);
  const meetings = (await query(
    `SELECT m.*,
            (SELECT COUNT(*) FROM conference_attendance a WHERE a.meeting_id = m.id)::int AS attendee_count,
            (SELECT COUNT(*) FROM conference_cases c WHERE c.meeting_id = m.id)::int AS case_count
     FROM conference_meetings m
     WHERE $1 OR EXISTS (
       SELECT 1 FROM conference_attendance a WHERE a.meeting_id = m.id AND a.user_id = $2)
     ORDER BY m.started_at DESC
     LIMIT $3`,
    [isSupervisor, user.id, Math.min(Number(limit) || 25, 100)],
  )).rows;

  return res.status(200).json({ meetings });
}

-- ============================================================================
-- 012: conference meetings and who attended them
--
-- Attendance at the Tuesday pre-surgical conference is a training requirement,
-- so it has to survive the meeting. Presence on the signalling channel says who
-- is in the room right now; these tables say who was there on the night.
--
-- Safe to re-run.
-- ============================================================================

CREATE TABLE IF NOT EXISTS conference_meetings (
  id           SERIAL PRIMARY KEY,
  room_id      VARCHAR(64) UNIQUE NOT NULL,
  topic        TEXT,
  -- 'pre_surgical' for the Tuesday conference, 'general' for an ad-hoc call.
  meeting_type VARCHAR(30) NOT NULL DEFAULT 'general',
  host_user_id INTEGER REFERENCES users(id),
  started_at   TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  ended_at     TIMESTAMPTZ,
  created_at   TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS conference_attendance (
  id               SERIAL PRIMARY KEY,
  meeting_id       INTEGER NOT NULL REFERENCES conference_meetings(id) ON DELETE CASCADE,
  user_id          INTEGER REFERENCES users(id),
  -- Kept alongside user_id so the register still reads correctly if an account
  -- is later renamed or deactivated.
  display_name     VARCHAR(255),
  role             VARCHAR(50),
  joined_at        TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  left_at          TIMESTAMPTZ,
  -- Accumulated across rejoins: somebody whose connection drops twice has one
  -- row, not three, and their total time is still right.
  seconds_present  INTEGER DEFAULT 0,
  UNIQUE (meeting_id, user_id)
);

-- Which cases were actually presented, and for how long. The register of a
-- conference is not only who came but what was discussed.
CREATE TABLE IF NOT EXISTS conference_cases (
  id           SERIAL PRIMARY KEY,
  meeting_id   INTEGER NOT NULL REFERENCES conference_meetings(id) ON DELETE CASCADE,
  patient_id   VARCHAR(255) NOT NULL,
  patient_name VARCHAR(255),
  presented_by INTEGER REFERENCES users(id),
  presented_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  ended_at     TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_conf_meetings_type    ON conference_meetings(meeting_type, started_at DESC);
CREATE INDEX IF NOT EXISTS idx_conf_attendance_user  ON conference_attendance(user_id, joined_at DESC);
CREATE INDEX IF NOT EXISTS idx_conf_attendance_meet  ON conference_attendance(meeting_id);
CREATE INDEX IF NOT EXISTS idx_conf_cases_meeting    ON conference_cases(meeting_id, presented_at);

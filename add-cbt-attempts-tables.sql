-- Create cbt_attempts table for persistent CBT record storage
CREATE TABLE IF NOT EXISTS cbt_attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  test_id UUID,
  user_id TEXT NOT NULL,
  level VARCHAR(50) NOT NULL DEFAULT 'house_officer',
  test_number BIGINT NOT NULL DEFAULT 0,
  start_time TIMESTAMPTZ,
  end_time TIMESTAMPTZ,
  answers JSONB DEFAULT '{}',
  score NUMERIC DEFAULT 0,
  total_marks NUMERIC DEFAULT 100,
  percentage NUMERIC DEFAULT 0,
  passed BOOLEAN DEFAULT false,
  completed BOOLEAN DEFAULT false,
  tab_switch_count INTEGER DEFAULT 0,
  suspicious_activity BOOLEAN DEFAULT false,
  flagged_for_review JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, level, test_number)
);

-- Index for fast lookup by user
CREATE INDEX IF NOT EXISTS idx_cbt_attempts_user_id ON cbt_attempts(user_id);
CREATE INDEX IF NOT EXISTS idx_cbt_attempts_level ON cbt_attempts(level);
CREATE INDEX IF NOT EXISTS idx_cbt_attempts_completed ON cbt_attempts(completed);

-- activity_logs table (used by cbt.js logActivity)
CREATE TABLE IF NOT EXISTS activity_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  activity_type VARCHAR(100),
  description TEXT,
  points INTEGER DEFAULT 0,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_activity_logs_user_id ON activity_logs(user_id);

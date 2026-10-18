// ============================================================================
// Detox tables: the columns the app writes.
//
// detox_monitoring_records and detox_follow_ups were created (init-db.js)
// with different column names from those the app and the substance API use,
// so the withdrawal score, scale type, item scores and escalation flag were
// silently dropped by /sync/push (which keeps only real columns), and the
// API's own inserts failed outright. The missing columns are added here,
// before anything reads the column list. Idempotent; never throws.
// ============================================================================

import { query } from './db.js';

export const DETOX_TABLES = new Set(['detox_monitoring_records', 'detox_follow_ups']);

let done = false;
export async function ensureDetoxColumns() {
  if (done) return;
  const stmts = [
    `ALTER TABLE detox_monitoring_records ADD COLUMN IF NOT EXISTS withdrawal_scale_score NUMERIC`,
    `ALTER TABLE detox_monitoring_records ADD COLUMN IF NOT EXISTS withdrawal_scale_type VARCHAR(20)`,
    `ALTER TABLE detox_monitoring_records ADD COLUMN IF NOT EXISTS withdrawal_scale_items JSONB`,
    `ALTER TABLE detox_monitoring_records ADD COLUMN IF NOT EXISTS withdrawal_severity TEXT`,
    `ALTER TABLE detox_monitoring_records ADD COLUMN IF NOT EXISTS symptom_checklist JSONB DEFAULT '[]'`,
    `ALTER TABLE detox_monitoring_records ADD COLUMN IF NOT EXISTS medications_given JSONB DEFAULT '[]'`,
    `ALTER TABLE detox_monitoring_records ADD COLUMN IF NOT EXISTS escalation_triggered BOOLEAN DEFAULT FALSE`,
    `ALTER TABLE detox_monitoring_records ADD COLUMN IF NOT EXISTS escalation_reason TEXT`,
    `ALTER TABLE detox_monitoring_records ADD COLUMN IF NOT EXISTS monitored_by VARCHAR(255)`,
    `ALTER TABLE detox_monitoring_records ADD COLUMN IF NOT EXISTS monitored_at TIMESTAMP`,
    `ALTER TABLE detox_monitoring_records ADD COLUMN IF NOT EXISTS recorded_at TIMESTAMP`,
    `ALTER TABLE detox_follow_ups ADD COLUMN IF NOT EXISTS scheduled_date TIMESTAMP`,
    `ALTER TABLE detox_follow_ups ADD COLUMN IF NOT EXISTS actual_date TIMESTAMP`,
    `ALTER TABLE detox_follow_ups ADD COLUMN IF NOT EXISTS status VARCHAR(30) DEFAULT 'scheduled'`,
    `ALTER TABLE detox_follow_ups ADD COLUMN IF NOT EXISTS notes TEXT`,
    `ALTER TABLE detox_follow_ups ADD COLUMN IF NOT EXISTS relapse_since_last_visit BOOLEAN DEFAULT FALSE`,
    `ALTER TABLE detox_follow_ups ADD COLUMN IF NOT EXISTS current_substance_use TEXT`,
    `ALTER TABLE detox_follow_ups ADD COLUMN IF NOT EXISTS mental_health_status TEXT`,
  ];
  for (const s of stmts) {
    try { await query(s); } catch (e) { console.warn('ensureDetoxColumns:', e.message); }
  }
  done = true;
}

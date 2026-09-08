/**
 * Signing students out of a posting, in a batch.
 *
 * A whole group finishes at once, and doing that one student at a time is how
 * some of them get missed.
 *
 * Signing out is not deactivating. Deactivation closes an account, and is also
 * what happens to somebody who left or was registered by mistake. Signing out
 * says the posting was completed, and records the score, the date and who
 * decided — which is what a student asking for evidence needs, and what
 * `is_active = false` cannot supply.
 */

import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(__dirname, '../..');
const read = (p: string) => fs.readFileSync(path.join(ROOT, p), 'utf8');

const api = read('api/students.js');
const ui = read('src/components/training/StudentManagementPanels.tsx');
const migration = read('database/migrations/013_student_signout.sql');

describe('the record', () => {
  it('keeps sign-out apart from deactivation', () => {
    for (const col of ['signed_out_at', 'signed_out_by', 'sign_out_score', 'sign_out_outcome']) {
      expect(migration, col).toContain(col);
    }
  });

  it('stores the score rather than recomputing it later', () => {
    // Activity keeps accruing; a figure produced next term is not the one the
    // decision was made on.
    expect(api).toContain('sign_out_score = $2');
    expect(migration).toContain('kept because the underlying activity');
  });

  it('records a pass and an override as different things', () => {
    expect(api).toContain("const outcome = eligible ? 'completed' : 'override';");
    // The comment wraps, so assert on the column and a contiguous fragment.
    expect(migration).toContain('sign_out_outcome');
    expect(migration).toContain('Never collapsed into one');
  });

  it('scores with the shared engine, not its own arithmetic', () => {
    expect(api).toContain("await import('./_lib/traineeScoring.js')");
    expect(api).toContain('gatherStudentCounts');
  });
});

describe('the endpoint', () => {
  it('takes many students at once', () => {
    expect(api).toContain('body?.studentIds');
    expect(api).toContain("action === 'sign-out'");
  });

  it('is closed to students themselves', () => {
    // It sits in the admin block, below the student one.
    const adminBlock = api.slice(api.indexOf('// ── Admin endpoints ──'));
    expect(adminBlock).toContain("action === 'sign-out'");
  });

  it('refuses an empty selection rather than doing nothing quietly', () => {
    expect(api).toContain('Select at least one student to sign out');
  });

  it('leaves an already signed-out student alone', () => {
    // Re-dating would overwrite a decision that has already been made.
    expect(api).toContain("reason: 'already signed out'");
  });

  it('takes the administrator from the token, not the request', () => {
    expect(api).toContain('signOutStudents(auth.user, req.body, res)');
    expect(api).toContain('[adminUser.id ?? null,');
  });

  it('stops housekeeping from reviving someone who was signed out', () => {
    // listStudents auto-approves and auto-assigns patients on every load.
    expect(api).toContain('AND signed_out_at IS NULL');
    expect(api).toContain('AND s.signed_out_at IS NULL');
  });
});

describe('the roster', () => {
  it('offers a checkbox per student and one for all of them', () => {
    expect(ui).toContain('Select all students still on posting');
    expect(ui).toContain('aria-label={`Select ${s.full_name}`}');
  });

  it('cannot select someone already signed out', () => {
    expect(ui).toContain('disabled={Boolean(s.signed_out_at)}');
    expect(ui).toContain('const selectableIds = students.filter(s => !s.signed_out_at)');
  });

  it('shows the select-all as partial when only some are chosen', () => {
    expect(ui).toContain('el.indeterminate =');
  });

  it('shows the action only once something is selected', () => {
    // A permanently armed destructive control invites an accidental click.
    expect(ui).toContain('{selectedIds.length > 0 && (');
  });

  it('names the students before it acts', () => {
    expect(ui).toContain('This ends their posting and closes their account');
    expect(ui).toContain('const summary = names.slice(0, 8)');
  });

  it('treats cancel and an empty note differently', () => {
    expect(ui).toContain('if (notes === null) return;');
  });

  it('says afterwards how many went through on an override', () => {
    expect(ui).toContain('by override, having not met the requirements');
  });

  it('distinguishes signed out from inactive in the status column', () => {
    expect(ui).toContain("s.sign_out_outcome === 'override' ? 'Signed out (override)' : 'Signed out'");
  });
});

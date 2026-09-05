/**
 * Joining the unit, and how a rotation ends.
 *
 * A shared link lets students, house officers, registrars, senior registrars
 * and consultants create their own profile and set their own rotation length.
 * The rotation then closes one of three ways — automatically on the score,
 * extended by an administrator, or overridden with a reason — and every one of
 * those has to leave a record saying which.
 */

import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(__dirname, '../..');
const read = (p: string) => fs.readFileSync(path.join(ROOT, p), 'utf8');

const join = read('api/auth/join.js');
const lifecycle = read('api/_lib/rotationLifecycle.js');
const page = read('src/pages/JoinPage.tsx');
const app = read('src/App.tsx');

describe('the joining link', () => {
  it('is reachable signed out, and previewable by an admin who is signed in', () => {
    // Two separate <Routes> trees, not a duplicate: one for a visitor with no
    // account, one so an administrator can open the link they are sharing.
    const signedOut = app.slice(app.indexOf('if (!user) {'), app.indexOf('if (!isApproved'));
    expect(signedOut).toContain('path="/join"');

    const publicPages = app.slice(app.indexOf('{/* Public student pages'));
    expect(publicPages).toContain('path="/join"');
  });

  it('offers every role the unit takes', () => {
    for (const role of ['student', 'house_officer', 'junior_registrar',
      'registrar', 'senior_registrar', 'consultant']) {
      expect(join, role).toContain(`${role}:`);
    }
  });

  it('rotates everyone except the consultant', () => {
    const consultant = join.slice(join.indexOf('consultant:'), join.indexOf('consultant:') + 120);
    expect(consultant).toContain('rotates: false');
    for (const role of ['student', 'house_officer', 'registrar', 'senior_registrar']) {
      const line = join.slice(join.indexOf(`${role}:`), join.indexOf(`${role}:`) + 120);
      expect(line, role).toContain('rotates: true');
    }
  });

  it('does not let somebody approve themselves', () => {
    // The link enrols; an administrator still admits.
    expect(join).toContain('is_approved');
    expect(join).toMatch(/FALSE, TRUE/);
    expect(join).toContain('approved: false');
  });

  it('refuses a rotation length that is absurd or missing', () => {
    expect(join).toContain('days < 7 || days > 366 * 3');
  });

  it('sets training_level from the role rather than the default', () => {
    // Every existing account carries the 'house_officer' default, which is why
    // a senior registrar was being shown the house officer curriculum.
    expect(join).toContain("values.training_level = role");
  });

  it('asks the server which roles to show instead of hard-coding them', () => {
    expect(page).toContain("apiClient.get('/auth/join')");
  });

  it('offers to install the app', () => {
    expect(page).toContain('beforeinstallprompt');
    expect(page).toContain('appinstalled');
    // iOS never fires the event, so it needs telling.
    expect(page).toContain('Add to Home Screen');
  });
});

describe('how a rotation ends', () => {
  it('signs out automatically when the score clears the threshold', () => {
    expect(lifecycle).toContain("mode: 'automatic'");
    expect(lifecycle).toContain('scored.eligibility.eligible');
  });

  it('waits for a person when it does not', () => {
    expect(lifecycle).toContain("status = 'pending_signout'");
  });

  it('demands a reason for an extension', () => {
    expect(lifecycle).toContain('A reason is required to extend a rotation');
  });

  it('demands a reason for an override', () => {
    expect(lifecycle).toContain('A reason is required to override the score and sign out');
  });

  it('records an override as an override, not as a pass', () => {
    expect(lifecycle).toContain('Signed out by override despite score');
  });

  it('never reopens a rotation that is already closed', () => {
    // Every write is guarded on the rotation still being open.
    expect(lifecycle).toContain('status = ANY($5)');
    expect(lifecycle).toContain("const OPEN_STATUSES = ['active', 'extended', 'pending_signout'];");
  });
});

describe('the lifecycle has one implementation', () => {
  const adminTraining = read('api/admin-training.js');
  const rotations = read('api/rotations.js');

  it('both endpoints call the shared module', () => {
    for (const [name, src] of [['admin-training', adminTraining], ['rotations', rotations]] as const) {
      expect(src, name).toContain("from './_lib/rotationLifecycle.js'");
      expect(src, name).toContain('extendRotation(');
      expect(src, name).toContain('signOutRotation(');
    }
  });

  it('neither still writes the extension SQL itself', () => {
    for (const [name, src] of [['admin-training', adminTraining], ['rotations', rotations]] as const) {
      expect(src, name).not.toContain('extension_count = extension_count + 1');
      expect(src, name).not.toContain("SET status = 'signed_out'");
    }
  });

  it('agrees on who may extend or sign out', () => {
    expect(rotations).toContain('ROTATION_ADMIN_ROLES.includes(userRole)');
    // The old check was consultant-or-admin, which shut out senior registrars
    // that Training Admin already allowed.
    expect(rotations).not.toContain("userRole !== 'consultant' && userRole !== 'admin'");
  });
});

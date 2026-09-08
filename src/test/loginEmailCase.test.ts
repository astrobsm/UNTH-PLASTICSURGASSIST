/**
 * An address is the same address however it is typed.
 *
 * The profile link stores an email lowercased. Every login matched it exactly
 * as given. So a student who registered as "Name@Gmail.com" and signed in with
 * the same string was told their password was wrong — and a whole posting of
 * them was locked out of accounts that existed, were approved, and had the
 * right password.
 *
 * The same fault sat unexercised on the staff logins, which stored what they
 * were given and would have failed the moment anything normalised an address.
 */

import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(__dirname, '../..');
const read = (p: string) => fs.readFileSync(path.join(ROOT, p), 'utf8');

const LOOKUPS: Array<[string, string]> = [
  ['api/students.js', 'student login'],
  ['api/auth/login.js', 'staff login'],
  ['api/auth/index.js', 'staff login (combined route)'],
  ['api/auth/join.js', 'profile creation'],
  ['api/auth/register.js', 'staff registration'],
];

describe('every email lookup is case-insensitive', () => {
  it.each(LOOKUPS)('%s (%s) never matches an email exactly', (file) => {
    const src = read(file);
    // `WHERE email = $n` is the shape that locked people out.
    expect(src, file).not.toMatch(/WHERE\s+email\s*=\s*\$\d/i);
    expect(src, file).not.toMatch(/WHERE\s+LOWER\(email\)\s*=\s*\$\d/i); // caller-dependent
  });

  it('the student login matches on LOWER(email)', () => {
    const src = read('api/students.js');
    expect(src).toMatch(/FROM students WHERE LOWER\(email\) = LOWER\(\$1\)/);
  });

  it('the staff logins match on LOWER(email)', () => {
    for (const file of ['api/auth/login.js', 'api/auth/index.js']) {
      expect(read(file), file).toContain('WHERE LOWER(email) = LOWER($1)');
    }
  });

  it('a duplicate cannot be created by changing the case', () => {
    // Otherwise "A@x.com" and "a@x.com" become two accounts competing for one
    // login, which is the same outage wearing a different hat.
    for (const [file] of LOOKUPS) {
      const src = read(file);
      // Only the lookups that are about an email; this file has plenty that
      // are not, and they are none of this test's business.
      const checks = (src.match(/SELECT id FROM (?:students|users) WHERE [^`'"]*/g) || [])
        .filter((c) => /email/i.test(c));
      for (const c of checks) {
        expect(c, `${file}: ${c}`).toMatch(/LOWER\(email\)\s*=\s*LOWER\(/);
      }
    }
  });
});

describe('a student is told the truth about signing in', () => {
  const api = read('api/auth/join.js');
  const page = read('src/pages/JoinPage.tsx');

  it('is not told to wait for an approval that never comes', () => {
    // loginStudent approves on first use, so the wait was fictional — but only
    // for students. Staff genuinely do wait, so that message must survive, and
    // this checks the student branch rather than the whole file.
    const studentBranch = api.slice(api.indexOf('async function createStudent'), api.indexOf('async function createStaff'));
    expect(studentBranch).not.toContain('An administrator will approve it');
    expect(studentBranch).toContain('You can sign in now');
  });

  it('still makes staff wait, because they really do', () => {
    const staffBranch = api.slice(api.indexOf('async function createStaff'));
    expect(staffBranch).toContain('An administrator will approve it');
  });

  it('is sent to the student login, not the staff one', () => {
    // Their account lives in `students`; the staff form looks in `users` and
    // would tell them their password was wrong.
    expect(page).toContain("done.kind === 'student' ? '/student-login' : '/login'");
    expect(page).toContain("role === 'student' ? '/student-login' : '/login'");
  });

  it('still tells staff that approval is required, because it is', () => {
    expect(page).toContain('An administrator approves it before you can sign in.');
  });
});

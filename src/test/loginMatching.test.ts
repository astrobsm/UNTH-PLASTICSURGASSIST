// @vitest-environment node
/**
 * Staff sign-in: a correct password is accepted even when
 *   - several user rows share the email (the reset was applied to another row),
 *   - it was copied with invisible characters (WhatsApp / SMS),
 * and the "must change password" flag reaches the app.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import bcrypt from 'bcryptjs';

const rows: any[] = [];
const updates: any[] = [];
vi.mock('../../api/_lib/db.js', () => ({
  query: vi.fn(async (sql: string, params: any[]) => {
    if (/^\s*SELECT/i.test(sql)) return { rows };
    updates.push({ sql, params });
    return { rows: [] };
  }),
}));
vi.mock('../../api/_lib/auth.js', () => ({ cors: () => false, signToken: () => 'token' }));

import handler from '../../api/auth/index.js';
import loginRoute from '../../api/auth/login.js';
import { normaliseSecret, verifyPassword } from '../../api/_lib/passwordCheck.js';

function call(h: any, body: any) {
  return new Promise<{ status: number; body: any }>(resolve => {
    const res: any = { statusCode: 200, status(c: number) { this.statusCode = c; return this; }, json(b: any) { resolve({ status: this.statusCode, body: b }); return this; } };
    h({ method: 'POST', body }, res);
  });
}

const hash = (p: string) => bcrypt.hashSync(p, 4);

beforeEach(() => { rows.length = 0; updates.length = 0; });

describe('password comparison', () => {
  it('strips only invisible characters and outer whitespace', () => {
    expect(normaliseSecret('​Abc%12  \n')).toBe('Abc%12');
    expect(normaliseSecret('a b')).toBe('a b');
  });
  it('accepts a pasted password with a trailing space, rejects a different one', async () => {
    const h = hash('yZ%PuU%bbh51');
    expect((await verifyPassword('yZ%PuU%bbh51 ', h)).ok).toBe(true);
    expect((await verifyPassword('​yZ%PuU%bbh51', h)).ok).toBe(true);
    expect((await verifyPassword('yZ%PuU%bbh5', h)).ok).toBe(false);
    expect((await verifyPassword('yz%puu%bbh51', h)).ok).toBe(false); // case still matters
  });
});

describe('staff sign-in', () => {
  it('finds the matching account when two rows share an email', async () => {
    rows.push(
      { id: 1, email: 'chiom@unth.edu.ng', password_value: hash('old-password'), role: 'house_officer', is_active: true, is_approved: true, must_change_password: false },
      { id: 2, email: 'Chiom@unth.edu.ng ', password_value: hash('Temp%Pass9'), role: 'house_officer', is_active: true, is_approved: true, must_change_password: true },
    );
    const r = await call(handler, { username: ' Chiom@unth.edu.ng', password: 'Temp%Pass9' });
    expect(r.status).toBe(200);
    expect(r.body.user.id).toBe(2);
    expect(r.body.user.mustChangePassword).toBe(true);
  });

  it('still refuses a wrong password', async () => {
    rows.push({ id: 1, email: 'a@b.c', password_value: hash('right'), role: 'registrar', is_active: true, is_approved: true });
    expect((await call(handler, { username: 'a@b.c', password: 'wrong' })).status).toBe(401);
  });

  it('reports a disabled account only when the password is right', async () => {
    rows.push({ id: 1, email: 'a@b.c', password_value: hash('right'), role: 'registrar', is_active: false, is_approved: true });
    expect((await call(handler, { username: 'a@b.c', password: 'wrong' })).status).toBe(401);
    expect((await call(handler, { username: 'a@b.c', password: 'right' })).status).toBe(403);
  });

  it('/api/auth/login is the same handler', async () => {
    rows.push({ id: 3, email: 'p@b.c', password_value: hash('pw'), role: 'registrar', is_active: true, is_approved: true });
    expect(loginRoute).toBe(handler);
    expect((await call(loginRoute, { username: 'p@b.c', password: 'pw' })).status).toBe(200);
  });

  it('records the sign-in', async () => {
    rows.push({ id: 4, email: 'q@b.c', password_value: hash('pw'), role: 'registrar', is_active: true, is_approved: true });
    await call(handler, { email: 'q@b.c', password: 'pw' });
    expect(updates.some(u => /last_login = NOW\(\)/.test(u.sql))).toBe(true);
  });
});

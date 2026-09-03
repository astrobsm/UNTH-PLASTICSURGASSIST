// @vitest-environment node
/**
 * The brief-outcome handler, exercised directly.
 *
 * This is what turns a briefing into a handover: the agreed plans, the
 * clearance decision, and the jobs that came out of the room. It is new server
 * code that has never run against a database, and two of its rules are the sort
 * that must not quietly stop working — only a consultant may clear a patient
 * for surgery, and who completed a task is taken from the token rather than
 * from whatever the caller claims.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * A JSON value crossing the handler boundary.
 *
 * Loose in one declared place rather than scattered: these tests drive an
 * untyped JS handler with a fake req/res and assert a different body shape in
 * every case.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Json = any;

const query = vi.fn();
const authenticateRequest = vi.fn();
const notifyUsers = vi.fn();

vi.mock('../../api/_lib/db.js', () => ({ query: (...a: Json[]) => query(...a) }));
vi.mock('../../api/_lib/auth.js', () => ({
  cors: () => false,
  authenticateRequest: (...a: Json[]) => authenticateRequest(...a),
}));
vi.mock('../../api/_lib/notify.js', () => ({
  notifyUsers: (...a: Json[]) => notifyUsers(...a),
  default: { notifyUsers: (...a: Json[]) => notifyUsers(...a) },
}));

import handler from '../../api/pre-surgical-brief.js';

const REGISTRAR = { id: 7, role: 'registrar', fullName: 'Dr Okafor' };
const CONSULTANT = { id: 3, role: 'consultant', fullName: 'Mr Eze' };

function call(method: string, url: string, body?: Json) {
  const res: Json = { statusCode: 0, body: undefined };
  res.status = (c: number) => { res.statusCode = c; return res; };
  res.json = (b: Json) => { res.body = b; return res; };
  res.setHeader = () => res;
  return handler({ method, url, headers: { host: 'x.test' }, body }, res).then(() => res);
}

/** Answer by matching the SQL, so ensureTables() running once does not shift a queue. */
function respond(...pairs: [RegExp, Json[]][]) {
  query.mockReset();
  query.mockImplementation((sql: string) => {
    for (const [pattern, rows] of pairs) {
      if (pattern.test(String(sql))) return Promise.resolve({ rows });
    }
    return Promise.resolve({ rows: [] });
  });
}

const SELECT_BRIEF = /FROM pre_surgical_briefs b/i;
const UPDATE_BRIEF = /UPDATE pre_surgical_briefs/i;
const INSERT_BRIEF = /INSERT INTO pre_surgical_briefs/i;
const INSERT_TASK = /INSERT INTO pre_surgical_brief_tasks/i;
const UPDATE_TASK = /UPDATE pre_surgical_brief_tasks/i;
const SELECT_TASK = /SELECT t\.\* FROM pre_surgical_brief_tasks/i;

const EXISTING_BRIEF = { id: 11, patient_id: 42, preop_plan: 'Group and save' };

beforeEach(() => {
  vi.clearAllMocks();
  authenticateRequest.mockReturnValue({ authenticated: true, user: REGISTRAR });
  notifyUsers.mockResolvedValue({ sent: 0, failed: 0 });
  respond();
});

describe('access', () => {
  it('refuses an unauthenticated request', async () => {
    authenticateRequest.mockReturnValue({ authenticated: false, error: 'No token provided' });
    expect((await call('GET', '/api/pre-surgical-brief/42')).statusCode).toBe(401);
  });

  it('refuses a non-numeric patient id', async () => {
    expect((await call('GET', '/api/pre-surgical-brief/not-a-patient')).statusCode).toBe(400);
  });

  it('returns empty rather than erroring when no brief exists yet', async () => {
    respond();
    const res = await call('GET', '/api/pre-surgical-brief/42');
    expect(res.body).toEqual({ brief: null, tasks: [] });
  });
});

describe('clearance for surgery', () => {
  it('refuses a registrar', async () => {
    // The whole point of the decision is that a consultant owns it.
    respond([SELECT_BRIEF, [EXISTING_BRIEF]]);
    const res = await call('POST', '/api/pre-surgical-brief/42/approve', { cleared_for_surgery: true });
    expect(res.statusCode).toBe(403);
  });

  it('accepts a consultant and stamps who decided', async () => {
    authenticateRequest.mockReturnValue({ authenticated: true, user: CONSULTANT });
    respond([SELECT_BRIEF, [EXISTING_BRIEF]], [UPDATE_BRIEF, [{ ...EXISTING_BRIEF, cleared_for_surgery: true }]]);

    const res = await call('POST', '/api/pre-surgical-brief/42/approve', { cleared_for_surgery: true });

    expect(res.statusCode).toBe(200);
    const update = query.mock.calls.find(c => UPDATE_BRIEF.test(String(c[0])));
    expect(update[1]).toContain(CONSULTANT.id);
  });

  it('requires an explicit true or false', async () => {
    // "Not yet decided" and "decided against" are different clinical states;
    // a missing value must not collapse into one of them.
    authenticateRequest.mockReturnValue({ authenticated: true, user: CONSULTANT });
    respond([SELECT_BRIEF, [EXISTING_BRIEF]]);
    expect((await call('POST', '/api/pre-surgical-brief/42/approve', {})).statusCode).toBe(400);
    expect((await call('POST', '/api/pre-surgical-brief/42/approve', { cleared_for_surgery: 'yes' })).statusCode).toBe(400);
  });

  it('tells everyone holding a task about the decision', async () => {
    authenticateRequest.mockReturnValue({ authenticated: true, user: CONSULTANT });
    respond(
      [SELECT_BRIEF, [EXISTING_BRIEF]],
      [UPDATE_BRIEF, [EXISTING_BRIEF]],
      [/SELECT DISTINCT assigned_to/i, [{ assigned_to: 7 }, { assigned_to: 9 }]],
    );

    await call('POST', '/api/pre-surgical-brief/42/approve', { cleared_for_surgery: false });

    expect(notifyUsers).toHaveBeenCalled();
    const [ids, notification] = notifyUsers.mock.calls[0];
    expect(ids).toEqual([7, 9]);
    expect(notification.title).toMatch(/NOT cleared/i);
  });
});

describe('recording the plans', () => {
  it('writes only the sections that were sent', async () => {
    // Two people edit different halves of the brief during the meeting; a full
    // overwrite would blank whatever the other one just typed.
    respond([SELECT_BRIEF, [EXISTING_BRIEF]], [UPDATE_BRIEF, [EXISTING_BRIEF]]);

    await call('POST', '/api/pre-surgical-brief/42', { postop_plan: 'HDU overnight' });

    const update = query.mock.calls.find(c => UPDATE_BRIEF.test(String(c[0])));
    expect(update[0]).toMatch(/postop_plan =/);
    expect(update[0]).not.toMatch(/preop_plan =/);
  });

  it('creates the brief on first save', async () => {
    respond([INSERT_BRIEF, [{ id: 12, patient_id: 42 }]]);
    const res = await call('POST', '/api/pre-surgical-brief/42', { preop_plan: 'Fast from midnight' });
    expect(res.statusCode).toBe(201);
  });
});

describe('tasks', () => {
  it('stamps completion from the token, not the body', async () => {
    respond(
      [SELECT_TASK, [{ id: 5, brief_id: 11, patient_id: 42, description: 'Book HDU', assigned_to: 9 }]],
      [UPDATE_TASK, []],
    );

    await call('PATCH', '/api/pre-surgical-brief/42/tasks/5', { status: 'done', completed_by: 999 });

    const update = query.mock.calls.find(c => UPDATE_TASK.test(String(c[0])));
    expect(update[0]).toMatch(/completed_by = \$/);
    expect(update[1]).toContain(REGISTRAR.id);
    expect(update[1]).not.toContain(999);
  });

  it('clears the completion stamp when a task is reopened', async () => {
    respond(
      [SELECT_TASK, [{ id: 5, brief_id: 11, patient_id: 42, description: 'Book HDU' }]],
      [UPDATE_TASK, []],
    );

    await call('PATCH', '/api/pre-surgical-brief/42/tasks/5', { status: 'in_progress' });

    const update = query.mock.calls.find(c => UPDATE_TASK.test(String(c[0])));
    expect(update[0]).toMatch(/completed_by = NULL/);
    expect(update[0]).toMatch(/completed_at = NULL/);
  });

  it('refuses a status it does not recognise', async () => {
    respond([SELECT_TASK, [{ id: 5, brief_id: 11, patient_id: 42 }]]);
    const res = await call('PATCH', '/api/pre-surgical-brief/42/tasks/5', { status: 'nearly' });
    expect(res.statusCode).toBe(400);
  });

  it('will not touch a task belonging to another patient', async () => {
    respond();
    const res = await call('PATCH', '/api/pre-surgical-brief/99/tasks/5', { status: 'done' });
    expect(res.statusCode).toBe(404);
  });

  it('requires a description', async () => {
    expect((await call('POST', '/api/pre-surgical-brief/42/tasks', { description: '  ' })).statusCode).toBe(400);
  });

  it('tells the assignee they have been given work', async () => {
    respond([SELECT_BRIEF, [EXISTING_BRIEF]], [INSERT_TASK, [{ id: 21, brief_id: 11 }]]);

    await call('POST', '/api/pre-surgical-brief/42/tasks', {
      description: 'Confirm crossmatch', phase: 'preop', assigned_to: 9,
    });

    expect(notifyUsers).toHaveBeenCalledWith([9], expect.objectContaining({
      body: expect.stringContaining('Confirm crossmatch'),
    }));
  });

  it('opens a brief so a task raised early has somewhere to live', async () => {
    // The jobs often precede the write-up; refusing them would lose them.
    respond([INSERT_BRIEF, [{ id: 13, patient_id: 42 }]], [INSERT_TASK, [{ id: 22, brief_id: 13 }]]);

    const res = await call('POST', '/api/pre-surgical-brief/42/tasks', { description: 'Chase histology' });

    expect(res.statusCode).toBe(201);
    expect(query.mock.calls.some(c => INSERT_BRIEF.test(String(c[0])))).toBe(true);
  });

  it('falls back to a known phase rather than storing a bad one', async () => {
    respond([SELECT_BRIEF, [EXISTING_BRIEF]], [INSERT_TASK, [{ id: 23, brief_id: 11 }]]);

    await call('POST', '/api/pre-surgical-brief/42/tasks', { description: 'X', phase: 'whenever' });

    const insert = query.mock.calls.find(c => INSERT_TASK.test(String(c[0])));
    expect(insert[1]).toContain('postop');
  });
});

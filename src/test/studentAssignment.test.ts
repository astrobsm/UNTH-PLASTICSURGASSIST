// @vitest-environment node
/**
 * Allocating a newly admitted patient to a student group.
 *
 * Patients used to reach students only when an administrator pressed "Assign
 * Patients to Groups", which re-runs a round-robin over every active admission.
 * Between presses, a patient admitted on Monday was invisible to the students
 * on that ward all week — and a clinical posting is time-boxed.
 *
 * Assigning one patient at a time cannot copy the bulk round-robin, which is
 * only even because it starts from nothing. It has to look at what each group
 * already carries, or the first group collects every new admission.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

/** Loose in one declared place: this drives an untyped JS helper. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Json = any;

const query = vi.fn();
vi.mock('../../api/_lib/db.js', () => ({ query: (...a: Json[]) => query(...a) }));

import { assignPatientToStudentGroup } from '../../api/_lib/studentAssignment.js';

// Both student queries select FROM students WHERE is_approved, so this one is
// pinned to its aggregate — otherwise it also swallows the members query and
// the group appears to have one student in it.
const STAFFED = /COUNT\(\*\)::int AS students/i;
const EXISTING = /SELECT group_number FROM student_group_patients/i;
const LOADS = /SELECT group_number, COUNT\(\*\)::int AS patients/i;
const INSERT_GROUP = /INSERT INTO student_group_patients/i;
const MEMBERS = /SELECT id FROM students/i;
const LINK = /INSERT INTO student_patient_assignments/i;

function respond(...pairs: [RegExp, Json[]][]) {
  query.mockReset();
  query.mockImplementation((sql: string) => {
    for (const [pattern, rows] of pairs) {
      if (pattern.test(String(sql))) return Promise.resolve({ rows });
    }
    return Promise.resolve({ rows: [] });
  });
}

const PATIENT = { patientId: 412, hospitalNumber: 'PT-1', patientName: 'A. Patient' };

beforeEach(() => {
  vi.clearAllMocks();
  respond();
});

describe('choosing a group', () => {
  it('gives the patient to the group carrying the fewest', async () => {
    respond(
      [STAFFED, [{ group_number: 1, students: 5 }, { group_number: 2, students: 5 }, { group_number: 3, students: 4 }]],
      [LOADS, [{ group_number: 1, patients: 9 }, { group_number: 2, patients: 2 }, { group_number: 3, patients: 6 }]],
      [MEMBERS, [{ id: 21 }, { id: 22 }]],
    );

    const r = await assignPatientToStudentGroup(PATIENT);

    expect(r.assigned).toBe(true);
    expect(r.group).toBe(2);
  });

  it('counts a group with no patients yet as the emptiest', async () => {
    // A group absent from the load query has nothing, and must not be read as
    // undefined and skipped.
    respond(
      [STAFFED, [{ group_number: 1, students: 5 }, { group_number: 4, students: 5 }]],
      [LOADS, [{ group_number: 1, patients: 3 }]],
      [MEMBERS, [{ id: 30 }]],
    );

    expect((await assignPatientToStudentGroup(PATIENT)).group).toBe(4);
  });

  it('breaks a tie on the lowest group number, so the behaviour is stable', async () => {
    respond(
      [STAFFED, [{ group_number: 3, students: 5 }, { group_number: 1, students: 5 }]],
      [LOADS, [{ group_number: 1, patients: 4 }, { group_number: 3, patients: 4 }]],
      [MEMBERS, [{ id: 40 }]],
    );

    expect((await assignPatientToStudentGroup(PATIENT)).group).toBe(1);
  });

  it('ignores a group with no students in it', async () => {
    // A patient allocated to an empty group is allocated to nobody, while
    // looking allocated on the admin page.
    respond(
      [STAFFED, [{ group_number: 5, students: 3 }]],   // only group 5 is staffed
      [LOADS, [{ group_number: 5, patients: 99 }]],    // and it is the busiest
      [MEMBERS, [{ id: 50 }]],
    );

    expect((await assignPatientToStudentGroup(PATIENT)).group).toBe(5);
  });

  it('does nothing when no group has students', async () => {
    respond([STAFFED, []]);
    const r = await assignPatientToStudentGroup(PATIENT);
    expect(r.assigned).toBe(false);
    expect(r.reason).toMatch(/no staffed/i);
  });
});

describe('not assigning twice', () => {
  it('leaves a patient who already has a group where they are', async () => {
    // Re-admission is common. Moving the patient would take them off the
    // student who has been following them.
    respond(
      [STAFFED, [{ group_number: 1, students: 5 }]],
      [EXISTING, [{ group_number: 3 }]],
    );

    const r = await assignPatientToStudentGroup(PATIENT);

    expect(r.assigned).toBe(false);
    expect(r.group).toBe(3);
    expect(query.mock.calls.some(c => INSERT_GROUP.test(String(c[0])))).toBe(false);
  });

  it('upserts rather than duplicating if the row is somehow already there', async () => {
    respond(
      [STAFFED, [{ group_number: 1, students: 2 }]],
      [MEMBERS, [{ id: 60 }]],
    );

    await assignPatientToStudentGroup(PATIENT);

    const insert = query.mock.calls.find(c => INSERT_GROUP.test(String(c[0])));
    expect(insert[0]).toMatch(/ON CONFLICT \(group_number, patient_id\) DO UPDATE/i);
  });
});

describe('reaching the students themselves', () => {
  it('links the patient to every student in the group', async () => {
    // The group row alone does not put the patient on a student's own list.
    respond(
      [STAFFED, [{ group_number: 2, students: 3 }]],
      [MEMBERS, [{ id: 71 }, { id: 72 }, { id: 73 }]],
    );

    const r = await assignPatientToStudentGroup(PATIENT);

    const links = query.mock.calls.filter(c => LINK.test(String(c[0])));
    expect(links).toHaveLength(3);
    expect(links.map(c => c[1][0])).toEqual([71, 72, 73]);
    expect(r.students).toBe(3);
  });

  it('keeps the group allocation when a student link fails', async () => {
    // Losing both because one link failed would be worse than losing one.
    respond([STAFFED, [{ group_number: 1, students: 1 }]], [MEMBERS, [{ id: 80 }]]);
    query.mockImplementation((sql: string) => {
      if (LINK.test(String(sql))) return Promise.reject(new Error('constraint'));
      if (STAFFED.test(String(sql))) return Promise.resolve({ rows: [{ group_number: 1, students: 1 }] });
      if (MEMBERS.test(String(sql))) return Promise.resolve({ rows: [{ id: 80 }] });
      return Promise.resolve({ rows: [] });
    });

    const r = await assignPatientToStudentGroup(PATIENT);
    expect(r.assigned).toBe(true);
  });
});

describe('never getting in the way of an admission', () => {
  it('reports failure instead of throwing when the database errors', async () => {
    // This runs inside the admission handler. Throwing here would fail an
    // admission over a teaching allocation.
    query.mockReset();
    query.mockRejectedValue(new Error('connection lost'));

    const r = await assignPatientToStudentGroup(PATIENT);

    expect(r.assigned).toBe(false);
    expect(r.reason).toMatch(/connection lost/);
  });

  it('refuses a call with no patient id rather than writing a null row', async () => {
    for (const bad of [{}, { patientId: null }, { patientId: '' }]) {
      const r = await assignPatientToStudentGroup(bad as Json);
      expect(r.assigned).toBe(false);
    }
    expect(query).not.toHaveBeenCalled();
  });
});

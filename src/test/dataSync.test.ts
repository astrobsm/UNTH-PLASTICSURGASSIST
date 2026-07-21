import { describe, it, expect, beforeEach } from 'vitest';
import { dataSyncService } from '../services/dataSyncService';

/**
 * Regression tests for the sync merge layer.
 *
 * These pin the two failure modes that could corrupt patient data:
 *  - matching a server row against an unrelated local row because Dexie's
 *    autoincrement ids and Postgres' serial ids overlap
 *  - advancing the incremental cursor past records that were never stored
 */

/** Minimal stand-in for a Dexie table: only what findLocalItem touches. */
function fakeTable(rows: any[]) {
  return {
    rows,
    async get(id: any) {
      return rows.find(r => r.id === id) ?? undefined;
    },
    filter(predicate: (item: any) => boolean) {
      const matched = rows.filter(predicate);
      return { async first() { return matched[0] ?? undefined; } };
    },
  };
}

// findLocalItem is private; exercising it directly is the point of these tests.
const findLocalItem = (table: any, serverItem: any) =>
  (dataSyncService as any).findLocalItem(table, serverItem);

describe('dataSyncService.findLocalItem', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('does NOT match a local-only record that happens to share the server id', async () => {
    // The core corruption case. Local Dexie ids and Postgres serial ids both
    // start at 1, so local patient #3 (created offline, never synced) collides
    // with server patient #3 — a different person entirely.
    const table = fakeTable([
      { id: 3, hospital_number: 'UNTH/999', first_name: 'Local', synced: false },
    ]);

    const match = await findLocalItem(table, {
      id: 3,
      hospital_number: 'UNTH/111',
      first_name: 'Server',
    });

    expect(match).toBeNull();
  });

  it('does match a previously-synced record on the primary key', async () => {
    const table = fakeTable([
      { id: 3, hospital_number: 'UNTH/111', first_name: 'Server', synced: true },
    ]);

    const match = await findLocalItem(table, { id: 3, hospital_number: 'UNTH/111' });

    expect(match).not.toBeNull();
    expect(match.first_name).toBe('Server');
  });

  it('prefers an explicit serverId match over a coincidental primary-key match', async () => {
    const table = fakeTable([
      // Would be found first by a naive table.get(7)
      { id: 7, hospital_number: 'UNTH/AAA', synced: false },
      // The genuine counterpart of server row 7
      { id: 42, serverId: 7, hospital_number: 'UNTH/BBB', synced: true },
    ]);

    const match = await findLocalItem(table, { id: 7, hospital_number: 'UNTH/BBB' });

    expect(match).not.toBeNull();
    expect(match.id).toBe(42);
    expect(match.serverId).toBe(7);
  });

  it('reunites an offline-created record with its server copy via hospital_number', async () => {
    const table = fakeTable([
      { id: 1, hospital_number: 'UNTH/555', first_name: 'Created offline', synced: false },
    ]);

    // Server assigned a different id to the same patient.
    const match = await findLocalItem(table, { id: 900, hospital_number: 'UNTH/555' });

    expect(match).not.toBeNull();
    expect(match.id).toBe(1);
  });

  it('returns null when the table holds nothing comparable', async () => {
    expect(await findLocalItem(fakeTable([]), { id: 5, hospital_number: 'X' })).toBeNull();
  });
});

describe('dataSyncService.fetchFromServer', () => {
  it('propagates failures instead of reporting them as an empty delta', async () => {
    // Returning [] on failure was indistinguishable from "nothing new since the
    // cursor", so the caller marked the entity synced and advanced lastPullTime
    // past records it had never received. Once a later pull persisted that
    // cursor, the gap was permanent.
    await expect(
      (dataSyncService as any).fetchFromServer('/sync/unreachable-under-test')
    ).rejects.toBeInstanceOf(Error);
  });
});

/** Batch 6: shopping-list status, procedure required fields. */
import 'fake-indexeddb/auto';
import { describe, it, expect, vi } from 'vitest';
vi.mock('../../api/_lib/db.js', () => ({ query: vi.fn(async () => ({ rows: [] })) }));
import { processShoppingListStatus } from '../../api/pre-surgical-conference.js';
import { missingProcedureFields } from '../services/procedureRecords';

describe('shopping list status', () => {
  it('a "pending" status is not procured (operator precedence)', () => {
    const r = processShoppingListStatus([{ items: [{ name: 'Mesh', status: 'pending' }, { name: 'Suture', status: 'procured' }, { name: 'Drain', procured: true }] }]);
    expect(r.procured_items).toBe(2);
    expect(r.pending_items).toBe(1);
    expect(r.is_complete).toBe(false);
  });
  it('the same item on two saved lists counts once', () => {
    const list = { items: JSON.stringify([{ name: 'Mesh', category: 'Implants', quantity: 1 }]) };
    const r = processShoppingListStatus([list, list, { items: [{ name: 'mesh ', category: 'implants', status: 'procured', quantity: 2 }] }]);
    expect(r.total_items).toBe(1);
    expect(r.items[0]).toMatchObject({ status: 'procured', quantity: 2 });
    expect(r.is_complete).toBe(true);
  });
  it('malformed JSON does not throw', () => {
    expect(processShoppingListStatus([{ items: '{oops' }]).total_items).toBe(0);
  });
});

describe('procedure required fields', () => {
  it('lists what is missing', () => {
    expect(missingProcedureFields({ procedure_name: 'SSG', patient_id: '', scheduled_date: '2026-10-20' }))
      .toEqual(['patient', 'surgeon', 'anaesthesia type', 'urgency']);
    expect(missingProcedureFields({ patient_id: 1, procedure_name: 'SSG', scheduled_date: 'x', surgeon: 'A', anesthesia_type: 'GA', urgency: 'elective' })).toEqual([]);
  });
});

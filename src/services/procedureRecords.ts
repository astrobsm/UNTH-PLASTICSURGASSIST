/**
 * Writing to a procedure the Procedures page lists.
 *
 * The page lists two kinds of row: today's surgery bookings and the procedure
 * records saved on this device. Every action (findings, reschedule, cancel,
 * post-op plan) used to call db.procedures.update(row.id) — for a booking row
 * that id is a booking id, so the action changed nothing, or changed an
 * unrelated procedure record that happened to share the number. And the sync
 * carried only the action's own sub-record, never the procedure, so the
 * server row (which requires procedure_date) was never written.
 *
 * Now a booking row gets its own linked procedure record on first action, the
 * update is applied to the right record, and the whole record is queued with
 * a stable sync_key and procedure_date.
 */
import { db } from '../db/database';
import { syncService } from '../db/syncService';

export type ProcedureRow = Record<string, any> & { id?: string | number; _source?: 'booking' | 'procedure' };

const dateOnly = (v: unknown): string | undefined => {
  if (!v) return undefined;
  const d = v instanceof Date ? v : new Date(String(v));
  return Number.isNaN(d.getTime()) ? undefined : d.toISOString().slice(0, 10);
};

/** The local procedures key for a listed row, creating the linked record for a booking. */
export async function resolveProcedureRecord(row: ProcedureRow): Promise<number | string> {
  if (row._source !== 'booking') {
    if (row.id === undefined || row.id === null) throw new Error('This procedure has no record to update.');
    return row.id;
  }
  const bookingId = String(row.id);
  const existing = await db.procedures.filter((p: any) => String(p.booking_id ?? '') === bookingId).first();
  if (existing) return (existing as any).id;
  const scheduled = dateOnly(row.scheduled_date || row.date) || dateOnly(new Date())!;
  const record = {
    booking_id: bookingId,
    sync_key: `proc-booking-${bookingId}`,
    patient_id: row.patient_id,
    patient_name: row.patient_name || '',
    hospital_number: row.hospital_number || '',
    procedure_name: row.procedure_name || row.procedure || 'Procedure',
    procedure_type: row.procedure_type || '',
    scheduled_date: scheduled,
    procedure_date: scheduled,
    surgeon: row.primary_surgeon || row.surgeon || '',
    status: row.status || 'scheduled',
    created_at: new Date(),
  };
  return (await db.procedures.add(record as any)) as number;
}

/** Applies a change to the row's procedure record and queues the whole record for the server. */
export async function applyProcedureUpdate(row: ProcedureRow, patch: Record<string, unknown>): Promise<void> {
  const key = await resolveProcedureRecord(row);
  await db.procedures.update(key as any, { ...patch, updated_at: new Date() } as any);
  const full: any = await db.procedures.get(key as any);
  if (!full) return;
  const syncKey = full.sync_key || `proc-${key}-${new Date(full.created_at || Date.now()).getTime()}`;
  if (!full.sync_key) await db.procedures.update(key as any, { sync_key: syncKey } as any);
  await syncService.queueAction('update', 'procedures', key as number, {
    ...full,
    sync_key: syncKey,
    procedure_date: full.procedure_date || dateOnly(full.scheduled_date) || dateOnly(full.created_at),
  });
}

/** Required fields for a new procedure, so an incomplete record is not saved. */
export function missingProcedureFields(f: Record<string, unknown>): string[] {
  const need: [string, string][] = [
    ['patient_id', 'patient'], ['procedure_name', 'procedure name'], ['scheduled_date', 'scheduled date'],
    ['surgeon', 'surgeon'], ['anesthesia_type', 'anaesthesia type'], ['urgency', 'urgency'],
  ];
  return need.filter(([k]) => f[k] === undefined || f[k] === null || String(f[k]).trim() === '').map(([, l]) => l);
}

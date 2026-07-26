import { apiClient } from './apiClient';

/**
 * Duty reminders. The message is composed on the SERVER so the preview in the
 * app and the message a run queues are byte-identical. Sending is manual: the
 * server never transmits anything, it prepares WhatsApp links for a person to
 * send.
 */

export type ReminderKind = 'weekly' | 'daily';

export interface ReminderPatient {
  hospitalNumber: string;
  name: string;
  location: string;
  diagnosis: string;
  careStart?: string | null;
  careSource?: 'consult' | 'admission' | null;
  roles: string[];
}

export interface ReminderPreview {
  staff: { id: string; full_name: string; role: string; grade: string; phone?: string | null };
  patientCount: number;
  patients: ReminderPatient[];
  message: string;
  whatsappLink: string | null;
}

export interface QueuedReminder {
  id: number;
  reminder_date: string;
  kind: ReminderKind;
  user_id: string;
  user_name: string;
  user_role: string;
  phone?: string | null;
  patient_count: number;
  message: string;
  status: 'pending' | 'sent' | 'failed';
  provider?: string | null;
  error_message?: string | null;
  whatsapp_link?: string | null;
  sent_at?: string | null;
}

export interface ReminderStatus {
  /** Always 'manual' — nothing is sent without someone pressing send. */
  delivery: 'manual';
  unitDate: string;
  unitWeekday: number;
}

class DutyReminderService {
  /** One person's reminder, exactly as a scheduled run would compose it. */
  async preview(userId: string, kind: ReminderKind = 'weekly'): Promise<ReminderPreview> {
    const qs = new URLSearchParams({ action: 'preview', user_id: String(userId), kind });
    return await apiClient.get(`/duty-reminders?${qs.toString()}`, { freshRead: true } as any);
  }

  /** Delivery mode and the unit's current date/weekday. */
  async status(): Promise<ReminderStatus> {
    return await apiClient.get('/duty-reminders?action=status', { freshRead: true } as any);
  }

  async queue(date?: string, kind?: ReminderKind): Promise<{ date: string; reminders: QueuedReminder[] }> {
    const qs = new URLSearchParams({ action: 'queue' });
    if (date) qs.set('date', date);
    if (kind) qs.set('kind', kind);
    return await apiClient.get(`/duty-reminders?${qs.toString()}`, { freshRead: true } as any);
  }

  /** Build and queue this run's reminders. Sends nothing. */
  async run(kind: ReminderKind): Promise<any> {
    return await apiClient.post('/duty-reminders?action=run', { kind });
  }

  /** Record that a queued reminder was sent by hand. */
  async markSent(id: number): Promise<QueuedReminder> {
    const data: any = await apiClient.post('/duty-reminders?action=mark-sent', { id });
    return data.reminder as QueuedReminder;
  }
}

export const dutyReminderService = new DutyReminderService();

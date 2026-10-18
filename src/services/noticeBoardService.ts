import { db } from '../db/database';
import { v4 as uuidv4 } from 'uuid';
import { apiClient } from './apiClient';

export interface NoticePost {
  id?: string;
  title: string;
  category: 'weekly_activities' | 'ward_rounds' | 'clinics' | 'meetings' | 'announcements' | 'general';
  content: string;
  posted_by: string;
  posted_by_name: string;
  posted_by_role: string;
  is_pinned: boolean;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  /** When the notice comes down by itself (the server stops returning it). */
  expires_at?: string | null;
  /** True once the server has it; unsent notices are retried on the next load. */
  synced?: boolean;
}

const isRefusal = (e: any) => e?.status === 403 || e?.status === 401 || /\b40[13]\b|not permitted|forbidden/i.test(e?.message || '');
const isExpired = (n: NoticePost) => !!n.expires_at && new Date(n.expires_at).getTime() <= Date.now();

export const NOTICE_CATEGORIES = [
  { value: 'weekly_activities', label: 'Weekly Activities', color: 'bg-blue-100 text-blue-800' },
  { value: 'ward_rounds', label: 'Ward Rounds', color: 'bg-green-100 text-green-800' },
  { value: 'clinics', label: 'Clinics', color: 'bg-purple-100 text-purple-800' },
  { value: 'meetings', label: 'Meetings', color: 'bg-yellow-100 text-yellow-800' },
  { value: 'announcements', label: 'Special Announcements', color: 'bg-red-100 text-red-800' },
  { value: 'general', label: 'General', color: 'bg-gray-100 text-gray-800' },
] as const;

class NoticeBoardService {
  // Pull notices from server, merge with local, return all
  async getAllNotices(): Promise<NoticePost[]> {
    try {
      // Try to fetch from server first
      await this.pullFromServer();
    } catch (e) {
      console.warn('Notice board server pull failed (offline?):', e);
    }

    try {
      const notices = await db.notice_board.toArray();
      return notices
        .filter((n: NoticePost) => n.is_active !== false && !isExpired(n))
        .sort((a: NoticePost, b: NoticePost) => {
          if (a.is_pinned && !b.is_pinned) return -1;
          if (!a.is_pinned && b.is_pinned) return 1;
          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
        });
    } catch (error) {
      console.error('Error fetching notices:', error);
      return [];
    }
  }

  async getNoticesByCategory(category: string): Promise<NoticePost[]> {
    try {
      const all = await this.getAllNotices();
      if (category === 'all') return all;
      return all.filter(n => n.category === category);
    } catch (error) {
      console.error('Error fetching notices by category:', error);
      return [];
    }
  }

  /**
   * Posts a notice. The server decides who may post; a refusal is reported to
   * the caller instead of leaving a notice on this device that nobody else
   * would ever see. Offline, the notice is kept and sent on the next load.
   */
  async createNotice(notice: Omit<NoticePost, 'id' | 'created_at' | 'updated_at'>): Promise<NoticePost> {
    const newNotice: NoticePost = {
      ...notice,
      id: uuidv4(),
      is_active: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      synced: false,
    };

    try {
      await this.pushToServer(newNotice);
      newNotice.synced = true;
    } catch (e) {
      if (isRefusal(e)) throw new Error((e as any)?.message || 'You are not permitted to post on the notice board.');
      console.warn('Notice saved on this device; it will be posted when the connection returns:', e);
    }
    await db.notice_board.add(newNotice);

    return newNotice;
  }

  async updateNotice(id: string, updates: Partial<NoticePost>): Promise<void> {
    const updatedFields = {
      ...updates,
      updated_at: new Date().toISOString(),
    };
    const before = await db.notice_board.get(id);
    if (!before) return;
    const after = { ...before, ...updatedFields } as NoticePost;
    try {
      await this.pushToServer(after);
      after.synced = true;
    } catch (e) {
      if (isRefusal(e)) throw new Error((e as any)?.message || 'You are not permitted to edit this notice.');
      after.synced = false;
    }
    await db.notice_board.put(after);
  }

  async deleteNotice(id: string): Promise<void> {
    try {
      await this.deleteFromServer(id);
    } catch (e) {
      if (isRefusal(e)) throw new Error((e as any)?.message || 'You are not permitted to remove this notice.');
      console.warn('Notice removed here; the server will be updated when the connection returns:', e);
    }
    await db.notice_board.update(id, {
      is_active: false,
      updated_at: new Date().toISOString(),
    });
  }

  async togglePin(id: string): Promise<void> {
    const notice = await db.notice_board.get(id);
    if (notice) {
      await db.notice_board.update(id, {
        is_pinned: !notice.is_pinned,
        updated_at: new Date().toISOString(),
      });

      const updated = await db.notice_board.get(id);
      if (updated) {
        try { await this.pushToServer(updated); }
        catch (e) {
          // Put it back: a pin only this device can see is not a pin.
          await db.notice_board.update(id, { is_pinned: notice.is_pinned });
          if (isRefusal(e)) throw new Error((e as any)?.message || 'You are not permitted to pin notices.');
          throw e;
        }
      }
    }
  }

  // Server sync methods
  private async pullFromServer(): Promise<void> {
    const data = await apiClient.get('/notice-board');
    const serverNotices: NoticePost[] = data.notices || [];

    // Merge: server notices win by updated_at timestamp
    const onServer = new Set<string>();
    for (const serverNotice of serverNotices) {
      if (serverNotice.id) onServer.add(serverNotice.id);
      const local = await db.notice_board.get(serverNotice.id);
      if (!local || new Date(serverNotice.updated_at) > new Date(local.updated_at)) {
        await db.notice_board.put({ ...serverNotice, synced: true });
      }
    }

    // The server returns only live notices. One it once had but no longer
    // returns was removed or has expired, and comes down here too; one never
    // sent (posted offline) is sent now.
    const locals = await db.notice_board.toArray();
    for (const n of locals as NoticePost[]) {
      if (!n.id || n.is_active === false || onServer.has(n.id)) continue;
      if (n.synced === false) {
        try { await this.pushToServer(n); await db.notice_board.update(n.id, { synced: true }); }
        catch (e) { if (isRefusal(e)) await db.notice_board.update(n.id, { is_active: false }); }
      } else {
        await db.notice_board.update(n.id, { is_active: false });
      }
    }
  }

  private async pushToServer(notice: NoticePost): Promise<void> {
    await apiClient.post('/notice-board', notice);
  }

  private async deleteFromServer(id: string): Promise<void> {
    await apiClient.delete(`/notice-board?id=${encodeURIComponent(id)}`);
  }
}

export const noticeBoardService = new NoticeBoardService();

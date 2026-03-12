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
}

export const NOTICE_CATEGORIES = [
  { value: 'weekly_activities', label: 'Weekly Activities', color: 'bg-blue-100 text-blue-800' },
  { value: 'ward_rounds', label: 'Ward Rounds', color: 'bg-green-100 text-green-800' },
  { value: 'clinics', label: 'Clinics', color: 'bg-purple-100 text-purple-800' },
  { value: 'meetings', label: 'Meetings', color: 'bg-yellow-100 text-yellow-800' },
  { value: 'announcements', label: 'Special Announcements', color: 'bg-red-100 text-red-800' },
  { value: 'general', label: 'General', color: 'bg-gray-100 text-gray-800' },
] as const;

const getApiBaseUrl = () => {
  return import.meta.env.PROD ? '/api' : 'http://localhost:3001/api';
};

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
        .filter((n: NoticePost) => n.is_active !== false)
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

  async createNotice(notice: Omit<NoticePost, 'id' | 'created_at' | 'updated_at'>): Promise<NoticePost> {
    const newNotice: NoticePost = {
      ...notice,
      id: uuidv4(),
      is_active: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    await db.notice_board.add(newNotice);

    // Push to server in background
    this.pushToServer(newNotice).catch(e =>
      console.warn('Failed to push notice to server (will retry on next load):', e)
    );

    return newNotice;
  }

  async updateNotice(id: string, updates: Partial<NoticePost>): Promise<void> {
    const updatedFields = {
      ...updates,
      updated_at: new Date().toISOString(),
    };
    await db.notice_board.update(id, updatedFields);

    // Push update to server
    const notice = await db.notice_board.get(id);
    if (notice) {
      this.pushToServer(notice).catch(e =>
        console.warn('Failed to push notice update to server:', e)
      );
    }
  }

  async deleteNotice(id: string): Promise<void> {
    await db.notice_board.update(id, {
      is_active: false,
      updated_at: new Date().toISOString(),
    });

    // Push delete to server
    this.deleteFromServer(id).catch(e =>
      console.warn('Failed to delete notice from server:', e)
    );
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
        this.pushToServer(updated).catch(e =>
          console.warn('Failed to push pin toggle to server:', e)
        );
      }
    }
  }

  // Server sync methods
  private async pullFromServer(): Promise<void> {
    const token = apiClient.getToken();
    if (!token) return;

    const baseUrl = getApiBaseUrl();
    const response = await fetch(`${baseUrl}/notice-board`, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/json',
      },
    });

    if (!response.ok) return;

    const data = await response.json();
    const serverNotices: NoticePost[] = data.notices || [];

    // Merge: server notices win by updated_at timestamp
    for (const serverNotice of serverNotices) {
      const local = await db.notice_board.get(serverNotice.id);
      if (!local || new Date(serverNotice.updated_at) > new Date(local.updated_at)) {
        await db.notice_board.put(serverNotice);
      }
    }
  }

  private async pushToServer(notice: NoticePost): Promise<void> {
    const token = apiClient.getToken();
    if (!token) return;

    const baseUrl = getApiBaseUrl();
    await fetch(`${baseUrl}/notice-board`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/json',
      },
      body: JSON.stringify(notice),
    });
  }

  private async deleteFromServer(id: string): Promise<void> {
    const token = apiClient.getToken();
    if (!token) return;

    const baseUrl = getApiBaseUrl();
    await fetch(`${baseUrl}/notice-board?id=${encodeURIComponent(id)}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/json',
      },
    });
  }
}

export const noticeBoardService = new NoticeBoardService();

import { db } from '../db/database';
import { v4 as uuidv4 } from 'uuid';

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

class NoticeBoardService {
  async getAllNotices(): Promise<NoticePost[]> {
    try {
      const notices = await db.notice_board.toArray();
      return notices
        .filter((n: NoticePost) => n.is_active !== false)
        .sort((a: NoticePost, b: NoticePost) => {
          // Pinned first, then by date
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
    return newNotice;
  }

  async updateNotice(id: string, updates: Partial<NoticePost>): Promise<void> {
    await db.notice_board.update(id, {
      ...updates,
      updated_at: new Date().toISOString(),
    });
  }

  async deleteNotice(id: string): Promise<void> {
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
    }
  }
}

export const noticeBoardService = new NoticeBoardService();

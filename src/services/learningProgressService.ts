/**
 * Reports what a learner is reading, while they are reading it.
 *
 * The CME viewer used to keep reading entirely in React state and tell the
 * server only that an article had been finished. A supervisor could see a
 * completion flag and nothing about who was working through what today, and a
 * learner who closed the tab three sections in left no trace at all.
 *
 * A session opens when the article opens, heartbeats every 20 seconds while it
 * stays open, and closes on unmount — with a `sendBeacon` fallback so a closed
 * tab still lands. Time is accumulated server-side from what each sitting
 * reports, so a heartbeat that arrives twice does not count twice.
 */

import { apiClient } from './apiClient';

const HEARTBEAT_MS = 20_000;

export interface ArticleProgress {
  article_id: string;
  reading_completed: boolean;
  reading_progress_percent: number;
  time_spent_seconds: number;
  assessment_completed: boolean;
  assessment_score: number | null;
  is_fully_completed: boolean;
  cme_credits_earned: number;
}

export interface ProgressSummary {
  articles_started: number;
  articles_read: number;
  articles_completed: number;
  assessments_done: number;
  assessment_average: number;
  seconds_spent: number;
  credits: number;
}

export interface AssessmentResult {
  score: number;
  correct: number;
  total: number;
  attempt: number;
  readingCompleted: boolean;
  counted: boolean;
  message: string | null;
  marked: { id: string; given: string; isCorrect: boolean }[];
}

/** What the viewer reports about the sitting so far. */
export interface SittingState {
  secondsThisSession: number;
  sectionsViewed: string[];
  sectionsRead: number;
  totalSections: number;
}

/**
 * One open article. Create with `openArticle`, feed it the sitting state, and
 * `close()` when the viewer unmounts.
 */
export class ReadingSession {
  private sessionId: number | null = null;
  private timer: ReturnType<typeof setInterval> | null = null;
  private latest: SittingState = {
    secondsThisSession: 0, sectionsViewed: [], sectionsRead: 0, totalSections: 0,
  };
  private closed = false;

  private constructor(readonly articleId: string) {}

  static async open(articleId: string): Promise<ReadingSession> {
    const session = new ReadingSession(articleId);
    try {
      const r = await apiClient.post(`/learning-progress?action=open`, {
        articleId,
        device: {
          ua: navigator.userAgent,
          width: window.innerWidth,
          height: window.innerHeight,
        },
      });
      session.sessionId = r?.sessionId ?? null;
    } catch (e) {
      // Reading offline is still reading; the close will carry the totals when
      // connectivity returns, and the viewer must not break either way.
      console.warn('Could not open a reading session:', e);
    }
    session.start();
    return session;
  }

  /** Called by the viewer whenever its reading state changes. */
  report(state: SittingState) {
    this.latest = state;
  }

  private start() {
    this.timer = setInterval(() => { void this.beat(); }, HEARTBEAT_MS);
    window.addEventListener('pagehide', this.onPageHide);
    document.addEventListener('visibilitychange', this.onVisibility);
  }

  private onVisibility = () => {
    // A backgrounded tab is not being read, so flush what we have and let the
    // next heartbeat resume when it comes back.
    if (document.visibilityState === 'hidden') void this.beat();
  };

  /**
   * A closing tab cannot wait for fetch, so the last update goes out through
   * sendBeacon, which the browser delivers after the page is gone.
   */
  private onPageHide = () => {
    if (this.closed) return;
    try {
      const token = localStorage.getItem('auth_token');
      const payload = JSON.stringify({
        articleId: this.articleId, sessionId: this.sessionId, token, ...this.latest,
      });
      navigator.sendBeacon?.(
        `/api/learning-progress?action=close&beacon=1`,
        new Blob([payload], { type: 'application/json' }),
      );
    } catch { /* nothing more can be done from a closing page */ }
  };

  private async beat() {
    if (this.closed) return;
    try {
      await apiClient.post(`/learning-progress?action=heartbeat`, {
        articleId: this.articleId,
        sessionId: this.sessionId,
        secondsThisSession: this.latest.secondsThisSession,
        sectionsViewed: this.latest.sectionsViewed,
        progressPercent: this.latest.totalSections > 0
          ? (this.latest.sectionsRead / this.latest.totalSections) * 100
          : 0,
      });
    } catch { /* a missed heartbeat is recovered by the next one, or by close */ }
  }

  async close(): Promise<ArticleProgress | null> {
    if (this.closed) return null;
    this.closed = true;
    if (this.timer) clearInterval(this.timer);
    window.removeEventListener('pagehide', this.onPageHide);
    document.removeEventListener('visibilitychange', this.onVisibility);
    try {
      const r = await apiClient.post(`/learning-progress?action=close`, {
        articleId: this.articleId,
        sessionId: this.sessionId,
        ...this.latest,
      });
      return r?.progress ?? null;
    } catch (e) {
      console.warn('Could not close the reading session:', e);
      return null;
    }
  }
}

export const learningProgressService = {
  openArticle: (articleId: string) => ReadingSession.open(articleId),

  /** Everything this learner has read, with the totals the tracker shows. */
  async mine(): Promise<{ progress: ArticleProgress[]; summary: ProgressSummary }> {
    return apiClient.get('/learning-progress');
  },

  async forArticle(articleId: string): Promise<ArticleProgress | null> {
    const r = await apiClient.get(`/learning-progress?action=article&articleId=${encodeURIComponent(articleId)}`);
    return r?.progress ?? null;
  },

  /**
   * Marks a self-assessment. Answers are letters keyed by question id; the
   * server marks them against its own key, so the client never decides a score.
   */
  async submitAssessment(articleId: string, answers: Record<string, string>): Promise<AssessmentResult> {
    return apiClient.post('/learning-progress?action=assessment', { articleId, answers });
  },

  /** Who is reading what right now. Supervisors only; the API enforces it. */
  async live(minutes = 30) {
    return apiClient.get(`/learning-progress?action=live&minutes=${minutes}`);
  },

  /** One learner's progress, for a supervisor. */
  async forLearner(learnerId: number | string, kind: 'user' | 'student' = 'user') {
    return apiClient.get(`/learning-progress?learner=${learnerId}&kind=${kind}`);
  },
};

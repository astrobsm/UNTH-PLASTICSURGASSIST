/**
 * Real-time reading tracking.
 *
 * Reading used to live entirely in the viewer's React state and reach the
 * server as a single "completed" flag, so a learner who read three sections and
 * closed the tab left no trace, and a supervisor could see who had finished an
 * article but nothing about who was working through one today.
 *
 * These cover the rules that must not quietly stop working.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(__dirname, '../..');
const read = (p: string) => fs.readFileSync(path.join(ROOT, p), 'utf8');

vi.mock('../services/apiClient', () => ({
  apiClient: { get: vi.fn(), post: vi.fn() },
}));

import { apiClient } from '../services/apiClient';
import { learningProgressService, ReadingSession } from '../services/learningProgressService';

const ARTICLE = 'a1100001-0000-0000-0000-000000000001';

beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers();
  (apiClient.post as never as ReturnType<typeof vi.fn>).mockResolvedValue({ sessionId: 7 });
  (apiClient.get as never as ReturnType<typeof vi.fn>).mockResolvedValue({ progress: null });
});
afterEach(() => { vi.useRealTimers(); });

describe('ReadingSession', () => {
  it('opens a session against the article', async () => {
    await ReadingSession.open(ARTICLE);
    expect(apiClient.post).toHaveBeenCalledWith(
      '/learning-progress?action=open',
      expect.objectContaining({ articleId: ARTICLE }),
    );
  });

  it('survives a server that refuses the open', async () => {
    (apiClient.post as never as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error('offline'));
    // Reading offline is still reading; the viewer must not break.
    const s = await ReadingSession.open(ARTICLE);
    expect(s).toBeInstanceOf(ReadingSession);
  });

  it('heartbeats while the article stays open', async () => {
    const s = await ReadingSession.open(ARTICLE);
    s.report({ secondsThisSession: 45, sectionsViewed: [], sectionsRead: 2, totalSections: 4 });
    (apiClient.post as never as ReturnType<typeof vi.fn>).mockClear();

    await vi.advanceTimersByTimeAsync(20_000);

    expect(apiClient.post).toHaveBeenCalledWith(
      '/learning-progress?action=heartbeat',
      expect.objectContaining({ articleId: ARTICLE, secondsThisSession: 45, progressPercent: 50 }),
    );
  });

  it('reports the seconds for this sitting, not a running total it invented', async () => {
    const s = await ReadingSession.open(ARTICLE);
    s.report({ secondsThisSession: 10, sectionsViewed: [], sectionsRead: 1, totalSections: 4 });
    await vi.advanceTimersByTimeAsync(20_000);
    s.report({ secondsThisSession: 30, sectionsViewed: [], sectionsRead: 2, totalSections: 4 });
    await vi.advanceTimersByTimeAsync(20_000);

    const calls = (apiClient.post as never as ReturnType<typeof vi.fn>).mock.calls
      .filter((c) => String(c[0]).includes('heartbeat'));
    expect(calls[calls.length - 1][1].secondsThisSession).toBe(30);
  });

  it('closes once, and stops beating afterwards', async () => {
    const s = await ReadingSession.open(ARTICLE);
    s.report({ secondsThisSession: 90, sectionsViewed: [], sectionsRead: 4, totalSections: 4 });
    await s.close();
    (apiClient.post as never as ReturnType<typeof vi.fn>).mockClear();

    await vi.advanceTimersByTimeAsync(60_000);
    expect(apiClient.post).not.toHaveBeenCalled();

    // A second close is a no-op rather than a second row.
    expect(await s.close()).toBeNull();
  });

  it('sends the section counts the server needs to decide "read"', async () => {
    const s = await ReadingSession.open(ARTICLE);
    s.report({ secondsThisSession: 200, sectionsViewed: [], sectionsRead: 4, totalSections: 4 });
    (apiClient.post as never as ReturnType<typeof vi.fn>).mockClear();
    await s.close();
    expect(apiClient.post).toHaveBeenCalledWith(
      '/learning-progress?action=close',
      expect.objectContaining({ sectionsRead: 4, totalSections: 4 }),
    );
  });
});

describe('assessment submission', () => {
  it('sends letters, and never a score', async () => {
    await learningProgressService.submitAssessment(ARTICLE, { 'q-1': 'B', 'q-2': 'D' });
    const posted = (apiClient.post as never as ReturnType<typeof vi.fn>).mock.calls;
    const [, body] = posted[posted.length - 1];
    expect(body).toEqual({ articleId: ARTICLE, answers: { 'q-1': 'B', 'q-2': 'D' } });
    expect(JSON.stringify(body)).not.toMatch(/score|correct/i);
  });
});

describe('the server owns the marking', () => {
  const api = read('api/learning-progress.js');

  it('marks against its own key rather than trusting the client', () => {
    expect(api).toContain('SELECT id, correct_option FROM article_self_assessments');
    // The request body supplies answers only.
    expect(api).not.toMatch(/body\.(score|correct)\b/);
  });

  it('accumulates time from the sessions, not from a client total', () => {
    expect(api).toContain('SELECT SUM(duration_seconds) FROM learner_study_sessions');
  });

  it('scopes every read and write by the identity in the token', () => {
    expect(api).toContain('const learnerId = auth.user.id;');
    expect(api).toMatch(/learner_kind = \$1 AND learner_id = \$2/);
  });

  it('only counts an assessment once the article has been read', () => {
    expect(api).toContain('is_fully_completed = ($6 AND reading_completed)');
  });

  it('restricts the live view to supervisors', () => {
    expect(api).toContain("if (!SUPERVISOR_ROLES.includes(role)) {");
  });

  it('lets a closing tab authenticate by beacon, for closing only', () => {
    expect(api).toContain("req.query.beacon === '1'");
    expect(api).toContain("beacon requests may only close a session");
  });
});

describe('the viewer only tracks database articles', () => {
  const viewer = read('src/components/training/CMEArticleViewer.tsx');

  it('does nothing without an articleId', () => {
    // Locally-defined modules have no cme_articles row to attach progress to.
    expect(viewer).toContain('if (!articleId) return;');
  });

  it('closes the session when it unmounts', () => {
    expect(viewer).toContain('if (open) void open.close();');
  });
});

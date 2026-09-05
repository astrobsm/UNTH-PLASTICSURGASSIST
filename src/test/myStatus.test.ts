/**
 * A learner's standing, on arrival.
 *
 * A trainee had to open Medical Training and read a participation tracker to
 * find out they were short of sign-out; a student could not see a score at all.
 * Both now get it on their dashboard as they log in.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(__dirname, '../..');
const read = (p: string) => fs.readFileSync(path.join(ROOT, p), 'utf8');

vi.mock('../services/apiClient', () => ({ apiClient: { get: vi.fn(), post: vi.fn() } }));
import { apiClient } from '../services/apiClient';
import { myStatusService } from '../services/myStatusService';

beforeEach(() => vi.clearAllMocks());

describe('myStatusService', () => {
  it('asks for a fresh read, because a stale score misleads', async () => {
    (apiClient.get as never as ReturnType<typeof vi.fn>).mockResolvedValue({ overall: 42 });
    await myStatusService.mine();
    expect(apiClient.get).toHaveBeenCalledWith('/my-status', { freshRead: true });
  });
});

describe('the status endpoint', () => {
  const api = read('api/my-status.js');

  it('serves trainees and students from one route', () => {
    expect(api).toContain('allowStudents: true');
    expect(api).toContain('gatherTraineeCounts');
    expect(api).toContain('gatherStudentCounts');
  });

  it('scores both with the shared engine rather than its own arithmetic', () => {
    expect(api).toContain("from './_lib/traineeScoring.js'");
    expect(api).toContain('scoreTrainee(');
    // No weights of its own.
    expect(api).not.toMatch(/\*\s*0\.\d+\s*\)\s*\+\s*\(/);
  });

  it('reads the identity from the token, never the request', () => {
    expect(api).toContain('const id = auth.user.id;');
    expect(api).not.toMatch(/req\.query\.(userId|learner)\b/);
  });

  it('closes a rotation that has run its course when the learner opens the app', () => {
    // Signing out should not wait for somebody to open an admin screen.
    expect(api).toContain('evaluateDueRotations({ userId })');
  });

  it('takes the level from the rotation, not from users.training_level', () => {
    // Every account carries the 'house_officer' default in that column.
    expect(api).toContain('rotation?.level || role');
  });

  it('reports what each component contributed, and where marks remain', () => {
    expect(api).toContain('contribution:');
    expect(api).toContain('available:');
    expect(api).toContain('focusOn');
  });
});

describe('the banner', () => {
  const banner = read('src/components/training/MyStatusBanner.tsx');

  it('renders nothing rather than an error when the server is unreachable', () => {
    // A dashboard that cannot reach the server is still a usable dashboard.
    expect(banner).toContain('if (failed || !status) return null;');
  });

  it('shows the threshold alongside the score', () => {
    expect(banner).toContain('passThreshold');
  });

  it('says what is still outstanding', () => {
    expect(banner).toContain('status.notMet');
  });
});

describe('the dashboards show it', () => {
  it('a trainee sees it, a consultant does not', () => {
    const dash = read('src/pages/Dashboard.tsx');
    expect(dash).toContain('<MyStatusBanner />');
    expect(dash).toContain('isScoredRole');
    // Consultants and admins supervise; they have no score of their own.
    const guard = dash.slice(dash.indexOf('const isScoredRole'), dash.indexOf('const isScoredRole') + 260);
    expect(guard).not.toContain('consultant');
    expect(guard).toContain('house_officer');
  });

  it('a student sees it', () => {
    expect(read('src/pages/StudentDashboard.tsx')).toContain('<MyStatusBanner />');
  });
});

/**
 * The signed-in learner's own standing.
 *
 * One call, one shape, for a doctor on rotation and a clinical student alike —
 * the server counts them from different tables but scores them with the same
 * engine, so the dashboards can render either without knowing which they have.
 */

import { apiClient } from './apiClient';

export interface StatusContribution {
  key: string;
  /** The component's own score, 0-100. */
  score: number;
  /** Its weight in the overall, 0-1. */
  weight: number;
  /** What it actually contributed to the overall. */
  contribution: number;
  /** What it could contribute at full marks. */
  available: number;
}

export interface StatusRotation {
  id: number;
  status: string;
  startDate: string | null;
  expectedEndDate: string | null;
  actualEndDate: string | null;
  extensionCount: number;
  finalScore: number | null;
  signOutComments: string | null;
  daysRemaining: number | null;
  totalDays: number | null;
  elapsedDays: number | null;
  progressPercent: number | null;
  overdue: boolean;
}

export interface MyStatus {
  kind: 'trainee' | 'student';
  level: string;
  name: string | null;
  overall: number;
  passThreshold: number;
  minSectionScore: number;
  eligible: boolean;
  met: string[];
  notMet: string[];
  counts: Record<string, number>;
  requirements: Record<string, number>;
  components: Record<string, number>;
  contributions: StatusContribution[];
  /** The component leaving the most marks unclaimed. */
  focusOn: string | null;
  rotation: StatusRotation | null;

  // Trainees
  role?: string;
  /** True when opening the app is what closed the rotation. */
  justSignedOut?: boolean;
  awaitingDecision?: boolean;

  // Students
  groupNumber?: number | null;
  approved?: boolean;
  patientsAssigned?: number;
  clerkings?: number;
  treatmentPlans?: number;
}

export const myStatusService = {
  /**
   * Fetches the learner's standing.
   *
   * `freshRead` because a stale score is worse than a slow one: this is the
   * number somebody checks to decide whether they can sign out.
   */
  mine(): Promise<MyStatus> {
    return apiClient.get('/my-status', { freshRead: true });
  },
};

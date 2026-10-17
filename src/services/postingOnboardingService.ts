/** Client for /api/posting-onboarding. Never queued offline (see apiClient). */
import { apiClient } from './apiClient';
import type { Grade, Requirements } from '../data/postingRules';

export interface CatchUp {
  articles: { required: number; done: number };
  cbt: { required: number; done: number };
  due: string;
  daysLate: number;
  complete: boolean;
}

export interface OnboardingStatus {
  applicable: boolean;
  required: boolean;
  grade?: Grade;
  level?: string;
  units?: Array<{ key: string; name: string }>;
  defaults?: { start: string; end: string };
  requirements?: Requirements;
  cmeAvailable?: number | null;
  signOut?: { passThreshold: number; minSectionScore: number };
  record?: { unit_name: string; posting_start: string; posting_end: string; unit_note?: string | null } | null;
  catchUp?: CatchUp | null;
  today?: string;
}

export const postingOnboardingService = {
  status: () => apiClient.get<OnboardingStatus>('/posting-onboarding', { freshRead: true }),
  submit: (payload: { posting_start: string; posting_end: string; unit_key: string; accepted: true; rules_version: string }) =>
    apiClient.post<OnboardingStatus & { unitNote?: string | null }>('/posting-onboarding?action=submit', payload),
};

const doneKey = (userId: string | number) => `posting_onboarded_${userId}`;
export const onboardingCache = {
  isDone: (userId: string | number) => { try { return localStorage.getItem(doneKey(userId)) === 'true'; } catch { return false; } },
  markDone: (userId: string | number) => { try { localStorage.setItem(doneKey(userId), 'true'); } catch { /* ignore */ } },
  clear: (userId: string | number) => { try { localStorage.removeItem(doneKey(userId)); } catch { /* ignore */ } },
};

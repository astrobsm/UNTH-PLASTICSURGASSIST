/**
 * The material this learner is supposed to work through.
 *
 * Everything here comes from the CHAMBER import — 8,963 questions and 257 CME
 * articles, each scoped to a rotation category — served through one route that
 * works out the learner's level and turns it into a reading list. A student on
 * Surgery 2 and a house officer draw from the same library against different
 * curricula, which is the point: the training is separated by what the level
 * requires, not by keeping two copies of the content.
 */

import { apiClient } from './apiClient';
import type { CMETopic } from './medicalTrainingService';

export interface SurgeryLevelOption {
  value: string;
  label: string;
  description?: string;
  weeks?: number;
}

export interface LearningArticle {
  id: string;
  title: string;
  subtitle?: string | null;
  abstract?: string | null;
  estimated_reading_minutes?: number | null;
  cme_credits?: number | null;
  difficulty?: string | null;
  category: string;
  topic?: string | null;
  question_count: number;
  reading_completed?: boolean | null;
  assessment_completed?: boolean | null;
  assessment_score?: number | null;
  is_fully_completed?: boolean | null;
  reading_progress_percent?: number | null;
  last_accessed_at?: string | null;
}

export interface LearningCatalogue {
  levelKnown: boolean;
  /** Present only when the learner has no level set. */
  needsLevel?: boolean;
  message?: string;
  options?: SurgeryLevelOption[];
  level?: string;
  categories?: { id: string; name: string; code: string; level: string }[];
  requirements?: Record<string, number>;
  totals?: { articles: number; questions: number; selfAssessments: number };
  articles?: LearningArticle[];
}

export interface TestQuestion {
  id: string;
  question: string;
  topic?: string | null;
  difficulty?: string | null;
  /** E is absent on the four-option article sets. */
  options: { A: string; B: string; C: string; D: string; E?: string | null };
}

/** An imported article, in the shape the CME viewer already renders. */
export interface FullArticle {
  article: CMETopic;
  meta: {
    categoryId: string;
    category: string;
    topic?: string | null;
    authors?: string | null;
    cmeCredits?: number | null;
    estimatedReadingMinutes?: number | null;
    difficulty?: string | null;
  };
  progress: {
    reading_completed?: boolean;
    assessment_completed?: boolean;
    assessment_score?: number | null;
    is_fully_completed?: boolean;
    reading_progress_percent?: number | null;
  } | null;
}

/** One marked question, as it comes back after a paper is submitted. */
export interface MarkedQuestion {
  id: string;
  question: string;
  topic?: string | null;
  options: { A: string; B: string; C: string; D: string; E?: string | null };
  given: string | null;
  correctOption: string;
  isCorrect: boolean;
  explanation: string;
}

export interface TestResult {
  attemptId: string;
  submittedAt: string;
  score: number;
  correct: number;
  total: number;
  passed: boolean;
  passMark: number;
  level: string;
  marked: MarkedQuestion[];
}

export const learningContentService = {
  /** The reading list for whoever is signed in. */
  catalogue(): Promise<LearningCatalogue> {
    return apiClient.get('/learning-content');
  },

  /**
   * A fresh set of questions at this learner's level.
   *
   * Randomised server-side and returned without the answers — marking happens
   * on submission, so reading the network traffic tells a candidate nothing.
   */
  questions(limit = 25, topicId?: string): Promise<{ questions: TestQuestion[]; total: number }> {
    const qs = new URLSearchParams({ action: 'questions', limit: String(limit) });
    if (topicId) qs.set('topicId', topicId);
    return apiClient.get(`/learning-content?${qs.toString()}`);
  },

  /** One article in full — its sections, references and self-assessment. */
  article(id: string): Promise<FullArticle> {
    return apiClient.get(`/learning-content?action=article&id=${encodeURIComponent(id)}`);
  },

  /**
   * Submits a paper for marking.
   *
   * The answers go up as { questionId: 'A' }; the key stays on the server, so
   * the result — including which option was right and why — is the first the
   * client sees of it.
   */
  submitTest(payload: {
    answers: Record<string, string>;
    startedAt?: string;
    durationSeconds?: number;
  }): Promise<TestResult> {
    return apiClient.post('/learning-content?action=submit-test', payload);
  },

  /** Records the posting a student is on, which opens their rotation too. */
  setSurgeryLevel(level: string): Promise<{ surgeryLevel: string; changed: boolean }> {
    return apiClient.put('/students/surgery-level', { surgeryLevel: level });
  },

  /** The student's group, its patients, its topic and how far it has got. */
  myGroup(): Promise<any> {
    return apiClient.get('/students/my-group');
  },
};

export default learningContentService;

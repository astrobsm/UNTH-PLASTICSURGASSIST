/**
 * Structured clinical clerking — shared types.
 *
 * Everything the clerking forms show (complaints, questions, answers,
 * examination findings, differentials) is DATA in src/clinical/clerking/*.
 * The forms, the narrative generator and the rule-based suggestion engine all
 * read the same data, so a question added here appears everywhere at once.
 *
 * Absent / not assessed / unknown are different things and are kept apart:
 * an unanswered question is simply absent from `answers` and is reported as
 * "not documented"; "None", "No" and "Unknown" are real answers the clinician
 * chose.
 */

export type FieldType = 'select' | 'multiselect' | 'text' | 'number' | 'textarea';

export interface Question {
  id: string;
  label: string;
  type: FieldType;
  options?: string[];
  unit?: string;
  placeholder?: string;
  /** Show only when another question in the same scope has one of these answers. */
  showIf?: { q: string; in: string[] };
  /** Answers that are red flags (highlighted, surfaced in the summary). */
  redFlags?: string[];
  hint?: string;
}

export interface QuestionModule {
  id: string;
  title: string;
  questions: Question[];
}

export interface Complaint {
  id: string;
  label: string;
  system: string;
  synonyms?: string[];
  /** Question modules beyond the general symptom analysis. */
  modules: string[];
  /** Focused examination sections relevant to this complaint. */
  exams: string[];
  /** Differential diagnosis rule ids to consider. */
  differentials?: string[];
}

/** A selected presenting complaint with its answers. */
export interface ComplaintEntry {
  uid: string;
  complaintId: string;      // catalogue id, or 'other'
  label: string;            // display text (free text for 'other')
  duration?: { value: number | null; unit: string };
  answers: Record<string, string | string[] | number>;
}

export type FindingStatus = 'present' | 'absent' | 'not_assessed' | 'unable';

export interface ExamSection {
  id: string;
  title: string;
  questions: Question[];
}

export interface DifferentialRule {
  id: string;
  label: string;
  icd10?: string;
  /** Can't-miss diagnosis: shown with a warning whenever considered. */
  dangerous?: boolean;
  /** Feature → weight; key is "<scope>.<questionId>" with matching answers. */
  supports: Array<{ key: string; any: string[]; weight: number; reason: string }>;
  against?: Array<{ key: string; any: string[]; weight: number; reason: string }>;
  investigations: string[];
  management: string[];
}

export interface Medication { name: string; dose?: string; route?: string; frequency?: string; indication?: string; adherence?: string }
export interface Allergy { substance: string; reaction?: string; severity?: string; certainty?: string }

export interface ClerkingData {
  version: 1;
  source: { informant: string; reliability: string };
  complaints: ComplaintEntry[];
  history: Record<string, any>;          // pmh, psh, family, social, gyn, ros …
  medications: Medication[];
  medicationStatus?: 'documented' | 'none' | 'unknown';
  allergyStatus?: 'not_asked' | 'nkda' | 'has_allergies' | 'unable';
  allergies: Allergy[];
  exam: Record<string, Record<string, string | string[] | number>>;   // section id → answers
  vitals: Record<string, number | string>;
  impression?: string;
}

/** A suggestion awaiting the clinician's decision. */
export interface Suggestion {
  id: string;
  kind: 'differential' | 'investigation' | 'treatment';
  text: string;
  reasons: string[];
  against?: string[];
  source: 'rules' | 'ai';
  dangerous?: boolean;
  priority?: 'urgent' | 'routine';
  decision: 'pending' | 'accepted' | 'rejected';
  edited?: string;
}

export interface FollowUpProblemReview {
  problemId: string;
  label: string;
  status: 'improved' | 'unchanged' | 'worse' | 'resolved' | 'not_reviewed';
  note?: string;
}
export interface FollowUpPlanReview {
  itemId: string;
  text: string;
  status: 'done' | 'in_progress' | 'not_done' | 'stopped' | 'not_reviewed';
  note?: string;
}

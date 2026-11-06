/**
 * Clinical review templates — wound care review, pre-operative review,
 * post-operative review and follow-up — for every plastic surgery procedure.
 *
 * A template is DATA, composed from shared sections (the same structure for
 * every procedure, so notes read the same across the unit) and a
 * procedure-specific module (its own questions, consent risks, work-up,
 * monitoring, red flags and outcome measures). The form, the live scores, the
 * red-flag check, the completeness check, the standard orders and the
 * narrative all read the same template, so a question added here appears
 * everywhere at once.
 *
 * As in the clerking, an unanswered question is "not documented" — never
 * assumed normal — and "No" / "None" are real answers the clinician chose.
 */
import type { Question, Suggestion } from '../clerking/types';

export type ReviewKind = 'wound_review' | 'preop_review' | 'postop_review' | 'procedure_follow_up';

export const REVIEW_KINDS: { kind: ReviewKind; label: string; short: string; description: string }[] = [
  { kind: 'wound_review', label: 'Wound care review', short: 'Wound review', description: 'Structured wound assessment (TIME / IWII), dressing plan and healing trajectory.' },
  { kind: 'preop_review', label: 'Pre-operative review', short: 'Pre-op review', description: 'Indication, fitness and optimisation, VTE risk, work-up, consent and day-of-surgery readiness.' },
  { kind: 'postop_review', label: 'Post-operative review', short: 'Post-op review', description: 'Early post-operative check: observations, analgesia, drains, wound and procedure-specific monitoring.' },
  { kind: 'procedure_follow_up', label: 'Post-operative follow-up', short: 'Follow-up', description: 'Clinic follow-up after surgery: healing, complications, function, histology and the next step.' },
];

/** A question in a template. `required` items count towards completeness. */
export type TemplateQuestion = Question & { required?: boolean };

export interface TemplateSection {
  id: string;
  title: string;
  subtitle?: string;
  questions: TemplateQuestion[];
}

export type Answers = Record<string, Record<string, any>>;   // section id → question id → answer

export interface ScoreResult { value: number | string; band: string; tone: 'ok' | 'warn' | 'danger' | 'info'; detail?: string }
export interface ScoreDef {
  id: string;
  label: string;
  /** null when not enough has been answered to compute it. */
  compute: (a: Answers) => ScoreResult | null;
  reference?: string;
}

export interface FlagRule {
  /** A short, specific statement of the problem, e.g. "Flap congested — return to theatre". */
  text: string;
  severity: 'urgent' | 'warning';
  when: (a: Answers) => boolean;
}

/** Domains of the integrated treatment plan, in the order the plan is printed. */
export const PLAN_DOMAINS = [
  'Surgical / wound management',
  'Infection control and antimicrobials',
  'Investigations',
  'Comorbidity and metabolic optimisation',
  'Nutrition',
  'VTE prophylaxis',
  'Analgesia and comfort',
  'Psychological and social care',
  'Rehabilitation and function',
  'Counselling, education and consent',
  'Follow-up and safety-netting',
] as const;
export type PlanDomain = typeof PLAN_DOMAINS[number];

/** A rule that proposes a plan line when its condition holds. */
export interface PlanRule {
  domain: PlanDomain;
  text: string | ((a: Answers) => string);
  kind?: 'investigation' | 'treatment';
  priority?: 'urgent' | 'routine';
  /** Why — shown beside the line and printed in the note. */
  why?: string;
  when?: (a: Answers) => boolean;
}

/** A plan line in the saved encounter: proposed by a rule or added by hand, editable, and kept only when included. */
export interface PlanLine {
  id: string;
  domain: PlanDomain;
  text: string;
  kind: 'investigation' | 'treatment';
  priority?: 'urgent' | 'routine';
  why?: string;
  source: 'template' | 'clinician';
  include: boolean;
  /** The clinician changed the wording — keep it even if the answers change. */
  edited?: boolean;
}

export interface ClinicalTemplate {
  id: string;                 // e.g. 'preop_review:stsg'
  kind: ReviewKind;
  procedureId: string | null; // null for the general wound review
  title: string;
  subtitle: string;
  sections: TemplateSection[];
  scores: ScoreDef[];
  flags: FlagRule[];
  plan: PlanRule[];
  /** Guideline basis, shown with the template and printed in the note. */
  references: string[];
}

export interface TemplateData {
  version: 1;
  templateId: string;
  kind: ReviewKind;
  procedureId: string | null;
  procedureLabel?: string;
  answers: Answers;
  /** Free-text impression and additional notes, in the clinician's words. */
  impression?: string;
  notes?: string;
  /** The integrated treatment plan as reviewed by the clinician. */
  plan: PlanLine[];
  /** Linked encounter (e.g. the pre-op a post-op review follows). */
  linkedEncounterId?: number | null;
}

export type { Suggestion };

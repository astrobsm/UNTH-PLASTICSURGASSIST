// Types for _lib/traineeScoring.js, so the frontend can import the same
// scoring constants the API scores with instead of keeping its own copy.
//
// The .js file is the source of truth. If you add a component there, add it
// here too — nothing else in the app is allowed to define weights.

export interface ScoreWeights {
  cme: number;
  cbt: number;
  selfAssessment: number;
  clinical: number;
  duties: number;
  attendance: number;
}

export interface LevelRequirements {
  cmeArticles: number;
  cbtTests: number;
  selfAssessments: number;
  patients: number;
  duties: number;
  loginDays: number;
}

export interface ScoreComponents {
  cme: number;
  cbt: number;
  selfAssessment: number;
  clinical: number;
  duties: number;
  attendance: number;
}

export interface LearnerCounts {
  cmeArticles?: number;
  cbtTests?: number;
  cbtAverage?: number;
  selfAssessments?: number;
  selfAssessmentAverage?: number;
  patients?: number;
  duties?: number;
  loginDays?: number;
  [key: string]: number | undefined;
}

export interface Eligibility {
  eligible: boolean;
  met: string[];
  notMet: string[];
}

export interface ScoreResult {
  level: string;
  isStudent: boolean;
  counts: LearnerCounts;
  components: ScoreComponents;
  overall: number;
  eligibility: Eligibility;
  requirements: LevelRequirements;
  weights: ScoreWeights;
  passThreshold: number;
  minSectionScore: number;
}

export declare const SCORE_WEIGHTS: ScoreWeights;
export declare const PASS_THRESHOLD: number;
export declare const MIN_SECTION_SCORE: number;
export declare const STUDENT_LEVELS: string[];
export declare const TRAINEE_LEVELS: string[];

export declare function normalizeLevel(level: string | null | undefined): string;
export declare function isStudentLevel(level: string | null | undefined): boolean;
export declare function getRequirements(level: string | null | undefined): LevelRequirements;
export declare function allRequirements(): Record<string, LevelRequirements>;
export declare function computeOverall(components: Partial<ScoreComponents>): number;
export declare function pctOf(count: number, required: number): number;
export declare function componentsFrom(counts: LearnerCounts, level: string): ScoreComponents;
export declare function computeEligibility(
  counts: LearnerCounts,
  components: ScoreComponents,
  reqs: LevelRequirements,
  overall: number,
): Eligibility;
export declare function scoreTrainee(input: { level: string; counts: LearnerCounts }): ScoreResult;

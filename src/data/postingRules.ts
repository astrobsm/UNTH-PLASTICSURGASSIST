/**
 * Expectations and the rules for signing out of the unit, shown at posting
 * onboarding and accepted by every house officer and resident.
 *
 * The numbers (pass mark, required CME, CBT, …) are NOT written here — they
 * come from the server's scoring engine (api/_lib/traineeScoring.js) so the
 * rules shown are the rules applied. Change the wording here and bump
 * RULES_VERSION; the accepted version is stored with each onboarding.
 */
export const RULES_VERSION = '2026-10-17';

export type Grade = 'house_officer' | 'registrar' | 'senior_registrar';

export interface Requirements {
  cmeArticles: number; cbtTests: number; selfAssessments: number; patients: number; duties: number; loginDays: number;
}

export const GRADE_LABEL: Record<Grade, string> = {
  house_officer: 'House Officer',
  registrar: 'Registrar',
  senior_registrar: 'Senior Registrar',
};

/** Residents' expectations (house officers see the full HO responsibilities guide). */
export const RESIDENT_EXPECTATIONS: Record<Exclude<Grade, 'house_officer'>, Array<{ title: string; items: string[] }>> = {
  registrar: [
    { title: 'Patient care', items: [
      'Review every patient of your unit daily and document the review in the app the same day.',
      'See emergency consults within 1 hour and routine consults within 24 hours; document the consult and plan.',
      'Supervise and check the house officers’ clerkings, morning-round notes and prescriptions.',
      'Obtain and document informed consent; complete pre-operative checklists before theatre.',
    ] },
    { title: 'Theatre, clinics and call', items: [
      'Attend your unit’s theatre, clinic and ward-round days as set in the unit timetable.',
      'Write operation notes and post-operative orders before leaving theatre.',
      'Take call according to the unit call pattern; hand over every sick or new patient at the end of call.',
    ] },
    { title: 'Learning and teaching', items: [
      'Read the CME articles assigned to your level and complete their self-assessments.',
      'Sit the weekly CBT for your level.',
      'Present at unit academic meetings and take part in audit when assigned.',
    ] },
  ],
  senior_registrar: [
    { title: 'Unit leadership', items: [
      'Run the unit in the consultant’s absence and escalate to the consultant early for any deteriorating patient.',
      'Plan theatre lists with the consultant; make sure every listed patient is optimised and consented.',
      'Review and sign (or countersign) clerkings and plans submitted by house officers and registrars.',
    ] },
    { title: 'Patient care', items: [
      'Lead ward rounds on registrar/senior-registrar round days; document decisions in the app.',
      'Take senior call per the unit pattern and be available to the on-call juniors.',
      'Lead complex wound, flap and burn decisions with the consultant; document the rationale.',
    ] },
    { title: 'Teaching, audit and learning', items: [
      'Teach and supervise juniors; review their performance dashboards fortnightly.',
      'Read the CME articles assigned to your level, complete the self-assessments and sit the CBTs.',
      'Lead at least one audit or quality-improvement project during the posting.',
    ] },
  ],
};

export interface SignOutRule { id: string; text: string; mustTick?: boolean }

/** The rules for signing out of the unit, with the live numbers filled in. */
export function signOutRules(opts: {
  grade: Grade; req: Requirements; passThreshold: number; minSectionScore: number; cmeAvailable: number | null; late: boolean;
}): SignOutRule[] {
  const { grade, req, passThreshold, minSectionScore, cmeAvailable, late } = opts;
  const rules: SignOutRule[] = [
    { id: 'score', mustTick: true, text: `You can be signed out of the unit only when your overall training score is at least ${passThreshold}% and no graded section is below ${minSectionScore}%. Reaching your end date alone does not sign you out.` },
    { id: 'cme', mustTick: true, text: `Read ALL the CME articles assigned to your role${cmeAvailable ? ` (${cmeAvailable} currently available)` : ''} and complete each article’s self-assessment. At least ${req.cmeArticles} fully completed articles are counted towards sign-out.` },
    { id: 'cbt', mustTick: true, text: `Complete the CBT tests for your level — ${req.cbtTests} test${req.cbtTests === 1 ? '' : 's'} during the posting (pass mark 75%). Missed weekly CBTs must be made up.` },
    { id: 'clinical', text: `Clinical activity counted for sign-out: ${req.patients} patients documented, ${req.duties} completed duties, ${req.selfAssessments} self-assessments and ${req.loginDays} days of active use of the app.` },
  ];
  if (grade === 'house_officer') {
    rules.push({ id: 'rounds', mustTick: true, text: 'Do the 07:00–09:00 house officers’ round every day and document it in the app and in the folders. It counts for 15% of your score.' });
  }
  if (late) {
    rules.push({ id: 'catchup', mustTick: true, text: 'You are registering after your posting started: complete the catch-up reading and missed CBTs shown below by the deadline. Catch-up counts towards your score like any other reading.' });
  }
  rules.push(
    { id: 'handover', mustTick: true, text: 'Before leaving the unit: hand over every patient, complete all pending documentation, discharge summaries and outstanding plan items, and return anything issued to you.' },
    { id: 'absence', text: 'Record any leave or absence in the app and get it approved; unapproved absence reduces your attendance score.' },
    { id: 'extension', text: 'If the criteria are not met by your end date, your rotation becomes “pending sign-out” and may be extended by your consultant or senior registrar, with the reason recorded.' },
    { id: 'approval', text: 'Sign-out is confirmed by your consultant or senior registrar in the app. Your unit and posting dates are recorded as you enter them now.' },
  );
  return rules;
}

/** Mirror of the server's catch-up calculation, for the live preview. */
export function previewCatchUp(start: string, end: string, today: string, req: Requirements) {
  const day = (s: string) => Date.parse(`${s}T00:00:00Z`) / 86400000;
  const total = Math.max(day(end) - day(start), 1);
  const late = Math.max(0, Math.min(day(today) - day(start), total));
  if (!Number.isFinite(late) || late < 1) return null;
  return {
    daysLate: Math.round(late),
    articles: Math.max(1, Math.ceil((req.cmeArticles * late) / total)),
    cbt: Math.floor((req.cbtTests * late) / total),
    dueInDays: Math.min(14, Math.max(7, Math.round(late))),
  };
}

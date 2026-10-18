/**
 * The status message sent to a trainee (WhatsApp / warning).
 *
 * The old message compared a trainee's totals with the targets for the WHOLE
 * rotation and called anything under 50% "below expectations" — so somebody
 * two days into a posting was told to "improve urgently". Targets are now
 * paced: what should be done by today, given the day of the rotation. In the
 * first week nobody is judged; they are told where they stand and what is
 * expected.
 */

export interface StatusInput {
  full_name: string;
  metrics: { overallScore: number; cbtTestsCompleted: number; patientEntries: number; dutiesCompleted: number };
  requirements: { cbtTests: number; patientEntries: number; duties: number };
  rotation?: { start_date?: string | null; expected_end_date?: string | null } | null;
}

const DAY = 86_400_000;
const GRACE_DAYS = 7;

export function rotationPace(rotation: StatusInput['rotation'], now = new Date()) {
  const start = rotation?.start_date ? new Date(rotation.start_date) : null;
  const end = rotation?.expected_end_date ? new Date(rotation.expected_end_date) : null;
  if (!start || Number.isNaN(start.getTime())) return null;
  const totalDays = end && !Number.isNaN(end.getTime()) ? Math.max(1, Math.round((end.getTime() - start.getTime()) / DAY)) : 90;
  const day = Math.min(totalDays, Math.max(1, Math.floor((now.getTime() - start.getTime()) / DAY) + 1));
  return { day, totalDays, fraction: day / totalDays };
}

/** Expected by today for a whole-rotation target. */
export const dueByNow = (target: number, fraction: number) => Math.max(0, Math.round(target * fraction));

export function buildTraineeStatusMessage(t: StatusInput, now = new Date()): string {
  const m = t.metrics, r = t.requirements;
  const pace = rotationPace(t.rotation, now);
  const line = (label: string, done: number, target: number) =>
    pace ? `- ${label}: ${done} (about ${dueByNow(target, pace.fraction)} expected by now; ${target} by the end)`
         : `- ${label}: ${done} of ${target} for the rotation`;

  const head = `Hi ${t.full_name}, this is an update from the Plastic Surgery Training Program.`;
  const when = pace ? `\nYou are on day ${pace.day} of ${pace.totalDays} of your rotation.` : '';
  const body = [
    line('CBT tests', m.cbtTestsCompleted, r.cbtTests),
    line('Patients documented', m.patientEntries, r.patientEntries),
    line('Duties completed', m.dutiesCompleted, r.duties),
  ].join('\n');

  let close: string;
  if (pace && pace.day <= GRACE_DAYS) {
    close = 'You are still settling into the posting — use these figures as your guide for the weeks ahead. Log your ward work, CBT and duties in the app as you do them so they are counted.';
  } else {
    const behind = [
      [m.cbtTestsCompleted, r.cbtTests], [m.patientEntries, r.patientEntries], [m.dutiesCompleted, r.duties],
    ].filter(([done, target]) => done < dueByNow(target, pace ? pace.fraction : 1)).length;
    close = behind === 0
      ? 'You are on track — keep it up.'
      : behind === 1
        ? 'One area is behind where it should be by now. Please focus on it this week.'
        : 'Several areas are behind where they should be by now. Please prioritise them and speak to your supervisor if anything is stopping you.';
  }
  return `${head}${when}\n\nYour progress:\n${body}\n\n${close}`;
}

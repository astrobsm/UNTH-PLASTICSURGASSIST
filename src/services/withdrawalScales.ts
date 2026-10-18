/**
 * Validated withdrawal scales, scored item by item.
 *
 *   CIWA-Ar — Clinical Institute Withdrawal Assessment for Alcohol, revised
 *             (Sullivan et al., Br J Addict 1989). 10 items, max 67.
 *   COWS    — Clinical Opiate Withdrawal Scale (Wesson & Ling, J Psychoactive
 *             Drugs 2003). 11 items, max 48.
 *   CIWA-B  — benzodiazepine scale (Busto et al. 1989), 20 items scored 0-4
 *             (max 80); entered as a total here.
 *
 * The monitoring form used to accept any number in a free box with no
 * interpretation and a manual "escalate" tick. Each item now has its anchored
 * options, the total and severity band are computed, and escalation is
 * proposed automatically from the score and the vital signs.
 */

export type ScaleType = 'CIWA-Ar' | 'COWS' | 'CIWA-B';

export interface ScaleItem {
  id: string;
  label: string;
  /** Allowed scores with their anchor text; unanchored intermediate scores have no text. */
  options: Array<{ score: number; text?: string }>;
}

const range07 = (anchors: Record<number, string>) =>
  Array.from({ length: 8 }, (_, s) => ({ score: s, text: anchors[s] }));

export const CIWA_AR_ITEMS: ScaleItem[] = [
  { id: 'nausea', label: 'Nausea and vomiting', options: range07({ 0: 'No nausea, no vomiting', 1: 'Mild nausea, no vomiting', 4: 'Intermittent nausea with dry heaves', 7: 'Constant nausea, frequent dry heaves and vomiting' }) },
  { id: 'tremor', label: 'Tremor (arms extended, fingers spread)', options: range07({ 0: 'No tremor', 1: 'Not visible, but can be felt fingertip to fingertip', 4: 'Moderate, with arms extended', 7: 'Severe, even with arms not extended' }) },
  { id: 'sweats', label: 'Paroxysmal sweats', options: range07({ 0: 'No sweat visible', 1: 'Barely perceptible sweating, palms moist', 4: 'Beads of sweat obvious on forehead', 7: 'Drenching sweats' }) },
  { id: 'anxiety', label: 'Anxiety', options: range07({ 0: 'No anxiety, at ease', 1: 'Mildly anxious', 4: 'Moderately anxious, or guarded, so anxiety is inferred', 7: 'Equivalent to acute panic states' }) },
  { id: 'agitation', label: 'Agitation', options: range07({ 0: 'Normal activity', 1: 'Somewhat more than normal activity', 4: 'Moderately fidgety and restless', 7: 'Paces back and forth, or constantly thrashes about' }) },
  { id: 'tactile', label: 'Tactile disturbances (itching, pins and needles, burning, numbness, bugs crawling)', options: range07({ 0: 'None', 1: 'Very mild', 2: 'Mild', 3: 'Moderate', 4: 'Moderately severe hallucinations', 5: 'Severe hallucinations', 6: 'Extremely severe hallucinations', 7: 'Continuous hallucinations' }) },
  { id: 'auditory', label: 'Auditory disturbances (harsh sounds, frightening, hearing things)', options: range07({ 0: 'Not present', 1: 'Very mild harshness or ability to frighten', 2: 'Mild', 3: 'Moderate', 4: 'Moderately severe hallucinations', 5: 'Severe hallucinations', 6: 'Extremely severe hallucinations', 7: 'Continuous hallucinations' }) },
  { id: 'visual', label: 'Visual disturbances (light too bright, colour different, seeing things)', options: range07({ 0: 'Not present', 1: 'Very mild sensitivity', 2: 'Mild', 3: 'Moderate', 4: 'Moderately severe hallucinations', 5: 'Severe hallucinations', 6: 'Extremely severe hallucinations', 7: 'Continuous hallucinations' }) },
  { id: 'headache', label: 'Headache, fullness in head', options: range07({ 0: 'Not present', 1: 'Very mild', 2: 'Mild', 3: 'Moderate', 4: 'Moderately severe', 5: 'Severe', 6: 'Very severe', 7: 'Extremely severe' }) },
  { id: 'orientation', label: 'Orientation and clouding of sensorium', options: [
    { score: 0, text: 'Oriented and can do serial additions' },
    { score: 1, text: 'Cannot do serial additions or is uncertain about date' },
    { score: 2, text: 'Disoriented for date by no more than 2 calendar days' },
    { score: 3, text: 'Disoriented for date by more than 2 calendar days' },
    { score: 4, text: 'Disoriented for place and/or person' },
  ] },
];

export const COWS_ITEMS: ScaleItem[] = [
  { id: 'pulse', label: 'Resting pulse rate (after sitting/lying 1 min)', options: [
    { score: 0, text: '80 or below' }, { score: 1, text: '81–100' }, { score: 2, text: '101–120' }, { score: 4, text: 'Greater than 120' }] },
  { id: 'sweating', label: 'Sweating (past ½ h, not due to room temperature or activity)', options: [
    { score: 0, text: 'No report of chills or flushing' }, { score: 1, text: 'Subjective report of chills or flushing' },
    { score: 2, text: 'Flushed or observable moistness on face' }, { score: 3, text: 'Beads of sweat on brow or face' }, { score: 4, text: 'Sweat streaming off face' }] },
  { id: 'restlessness', label: 'Restlessness (observed during assessment)', options: [
    { score: 0, text: 'Able to sit still' }, { score: 1, text: 'Reports difficulty sitting still, but is able to do so' },
    { score: 3, text: 'Frequent shifting or extraneous movements of legs/arms' }, { score: 5, text: 'Unable to sit still for more than a few seconds' }] },
  { id: 'pupils', label: 'Pupil size', options: [
    { score: 0, text: 'Pupils pinned or normal size for room light' }, { score: 1, text: 'Pupils possibly larger than normal for room light' },
    { score: 2, text: 'Pupils moderately dilated' }, { score: 5, text: 'Pupils so dilated that only the rim of the iris is visible' }] },
  { id: 'aches', label: 'Bone or joint aches (if previously present, only the opiate-withdrawal component)', options: [
    { score: 0, text: 'Not present' }, { score: 1, text: 'Mild diffuse discomfort' },
    { score: 2, text: 'Severe diffuse aching of joints/muscles' }, { score: 4, text: 'Rubbing joints or muscles and unable to sit still because of discomfort' }] },
  { id: 'rhinorrhoea', label: 'Runny nose or tearing (not due to cold symptoms or allergies)', options: [
    { score: 0, text: 'Not present' }, { score: 1, text: 'Nasal stuffiness or unusually moist eyes' },
    { score: 2, text: 'Nose running or tearing' }, { score: 4, text: 'Nose constantly running or tears streaming down cheeks' }] },
  { id: 'gi', label: 'GI upset (over last ½ h)', options: [
    { score: 0, text: 'No GI symptoms' }, { score: 1, text: 'Stomach cramps' }, { score: 2, text: 'Nausea or loose stool' },
    { score: 3, text: 'Vomiting or diarrhoea' }, { score: 5, text: 'Multiple episodes of diarrhoea or vomiting' }] },
  { id: 'tremor', label: 'Tremor (observation of outstretched hands)', options: [
    { score: 0, text: 'No tremor' }, { score: 1, text: 'Tremor can be felt, but not observed' },
    { score: 2, text: 'Slight tremor observable' }, { score: 4, text: 'Gross tremor or muscle twitching' }] },
  { id: 'yawning', label: 'Yawning (observed during assessment)', options: [
    { score: 0, text: 'No yawning' }, { score: 1, text: 'Yawning once or twice during assessment' },
    { score: 2, text: 'Yawning three or more times during assessment' }, { score: 4, text: 'Yawning several times/minute' }] },
  { id: 'anxiety', label: 'Anxiety or irritability', options: [
    { score: 0, text: 'None' }, { score: 1, text: 'Reports increasing irritability or anxiousness' },
    { score: 2, text: 'Obviously irritable or anxious' }, { score: 4, text: 'So irritable or anxious that participation in the assessment is difficult' }] },
  { id: 'gooseflesh', label: 'Gooseflesh skin', options: [
    { score: 0, text: 'Skin is smooth' }, { score: 3, text: 'Piloerection of skin can be felt or hairs standing up on arms' }, { score: 5, text: 'Prominent piloerection' }] },
];

export const SCALE_MAX: Record<ScaleType, number> = { 'CIWA-Ar': 67, COWS: 48, 'CIWA-B': 80 };
export const itemsFor = (t: ScaleType): ScaleItem[] | null => (t === 'CIWA-Ar' ? CIWA_AR_ITEMS : t === 'COWS' ? COWS_ITEMS : null);

/** COWS pulse item from a measured heart rate. */
export function cowsPulseScore(hr: number | null | undefined): number | null {
  if (hr == null || !Number.isFinite(hr) || hr <= 0) return null;
  if (hr <= 80) return 0;
  if (hr <= 100) return 1;
  if (hr <= 120) return 2;
  return 4;
}

export interface ScaleResult {
  total: number | null;
  complete: boolean;
  band: string;
  severity: 'none' | 'mild' | 'moderate' | 'severe';
  escalate: boolean;
  advice: string;
}

/** Severity band and whether to escalate, from the scale total. */
export function interpretScale(type: ScaleType, total: number | null, complete = true): ScaleResult {
  if (total == null || !Number.isFinite(total)) {
    return { total: null, complete: false, band: 'Not scored', severity: 'none', escalate: false, advice: 'Score every item.' };
  }
  const t = Math.max(0, Math.min(SCALE_MAX[type], total));
  if (type === 'CIWA-Ar') {
    // Sullivan 1989: <10 minimal; 10–15 moderate; >15 severe (risk of seizures / DTs).
    if (t < 10) return { total: t, complete, band: 'Absent / minimal withdrawal (<10)', severity: 'mild', escalate: false, advice: 'Supportive care; reassess every 4–8 h; usually no medication needed.' };
    if (t <= 15) return { total: t, complete, band: 'Moderate withdrawal (10–15)', severity: 'moderate', escalate: false, advice: 'Symptom-triggered benzodiazepine per protocol; reassess hourly until < 10.' };
    if (t <= 20) return { total: t, complete, band: 'Severe withdrawal (16–20)', severity: 'severe', escalate: true, advice: 'Benzodiazepine per protocol now; thiamine before glucose; senior review; reassess hourly.' };
    return { total: t, complete, band: 'Very severe withdrawal (>20)', severity: 'severe', escalate: true, advice: 'High risk of seizures / delirium tremens — urgent senior / critical-care review.' };
  }
  if (type === 'COWS') {
    // Wesson & Ling 2003: 5–12 mild, 13–24 moderate, 25–36 moderately severe, >36 severe.
    if (t < 5) return { total: t, complete, band: 'No active withdrawal (<5)', severity: 'none', escalate: false, advice: 'Reassess per protocol.' };
    if (t <= 12) return { total: t, complete, band: 'Mild withdrawal (5–12)', severity: 'mild', escalate: false, advice: 'Symptomatic treatment; opioid agonist induction may begin per protocol.' };
    if (t <= 24) return { total: t, complete, band: 'Moderate withdrawal (13–24)', severity: 'moderate', escalate: false, advice: 'Treat per protocol (e.g. buprenorphine / methadone, adjuncts); reassess in 1 h.' };
    if (t <= 36) return { total: t, complete, band: 'Moderately severe withdrawal (25–36)', severity: 'severe', escalate: true, advice: 'Senior review; treat now; monitor fluids and electrolytes.' };
    return { total: t, complete, band: 'Severe withdrawal (>36)', severity: 'severe', escalate: true, advice: 'Severe withdrawal — urgent senior review.' };
  }
  // CIWA-B (Busto 1989): 1–20 mild, 21–40 moderate, 41–60 severe, 61–80 very severe.
  if (t <= 20) return { total: t, complete, band: 'Mild (≤20)', severity: 'mild', escalate: false, advice: 'Continue taper; reassess.' };
  if (t <= 40) return { total: t, complete, band: 'Moderate (21–40)', severity: 'moderate', escalate: false, advice: 'Review taper rate.' };
  if (t <= 60) return { total: t, complete, band: 'Severe (41–60)', severity: 'severe', escalate: true, advice: 'Slow the taper; senior review; seizure precautions.' };
  return { total: t, complete, band: 'Very severe (61–80)', severity: 'severe', escalate: true, advice: 'Urgent senior review; seizure precautions.' };
}

/** Total of an item-scored scale; incomplete when any item is unscored. */
export function scoreItems(type: ScaleType, answers: Record<string, number | undefined>): ScaleResult {
  const items = itemsFor(type);
  if (!items) return interpretScale(type, null, false);
  const scored = items.map(i => answers[i.id]).filter((v): v is number => typeof v === 'number');
  const complete = scored.length === items.length;
  const total = scored.length ? scored.reduce((a, b) => a + b, 0) : null;
  return interpretScale(type, total, complete);
}

export interface VitalsForEscalation { heartRate?: number; systolic?: number; temperature?: number; respiratoryRate?: number; oxygenSaturation?: number }

/** Vital-sign red flags in withdrawal (any one proposes escalation). */
export function vitalRedFlags(v: VitalsForEscalation): string[] {
  const out: string[] = [];
  if (v.heartRate != null && v.heartRate > 120) out.push(`HR ${v.heartRate}`);
  if (v.systolic != null && v.systolic >= 180) out.push(`SBP ${v.systolic}`);
  if (v.temperature != null && v.temperature >= 38.5) out.push(`Temp ${v.temperature} °C`);
  if (v.respiratoryRate != null && (v.respiratoryRate >= 25 || v.respiratoryRate <= 8)) out.push(`RR ${v.respiratoryRate}`);
  if (v.oxygenSaturation != null && v.oxygenSaturation < 92) out.push(`SpO₂ ${v.oxygenSaturation}%`);
  return out;
}

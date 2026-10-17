/**
 * Clerking engine: turns a structured clerking into
 *   - rule-based suggestions (differentials, investigations, treatment),
 *   - red flags and risk factors,
 *   - a completeness check, and
 *   - a deterministic narrative clerking note.
 *
 * No numbers are presented as probabilities. Missing data is reported as
 * "not documented", never assumed normal.
 */
import type { ClerkingData, ComplaintEntry, DifferentialRule, Question, Suggestion } from './types';
import { MODULES } from './modules';
import { COMPLAINT_BY_ID } from './complaints';
import { COMORBIDITIES, FAMILY_QUESTIONS, GYN_QUESTIONS, PSH_QUESTIONS, ROS, SOCIAL_QUESTIONS } from './history';
import { EXAM_SECTIONS, VITALS, VITALS_CONTEXT } from './examination';
import { DIFFERENTIALS } from './differentials';

export interface PatientContext { ageYears?: number | null; sex?: string | null }

type Answer = string | string[] | number | undefined | null;

const isAnswered = (v: Answer) =>
  v !== undefined && v !== null && v !== '' && !(Array.isArray(v) && v.length === 0);

const asList = (v: Answer): string[] =>
  !isAnswered(v) ? [] : Array.isArray(v) ? v.map(String) : [String(v)];

/** Questions to show for a complaint: general analysis + its modules (deduplicated). */
export function questionsForComplaint(entry: Pick<ComplaintEntry, 'complaintId'>): Array<{ title: string; questions: Question[] }> {
  const complaint = COMPLAINT_BY_ID[entry.complaintId];
  const ids = ['general', ...(complaint?.modules || [])];
  return [...new Set(ids)].map(id => MODULES[id]).filter(Boolean).map(m => ({ title: m.title, questions: m.questions }));
}

/** Examination sections relevant to the chosen complaints (general first). */
export function examSectionsFor(data: Pick<ClerkingData, 'complaints'>): string[] {
  const focused = data.complaints.flatMap(c => COMPLAINT_BY_ID[c.complaintId]?.exams || []);
  return [...new Set(['general', 'general_extra', 'cvs', 'resp', 'abdo', 'neuro', ...focused])].filter(id => EXAM_SECTIONS[id]);
}

export function isVisible(q: Question, answers: Record<string, any>): boolean {
  if (!q.showIf) return true;
  return asList(answers[q.showIf.q]).some(a => q.showIf!.in.includes(a));
}

export function showGynaecology(ctx: PatientContext): boolean {
  const sex = (ctx.sex || '').toLowerCase();
  if (!sex.startsWith('f')) return false;
  if (ctx.ageYears == null) return true;
  return ctx.ageYears >= 10 && ctx.ageYears <= 55;
}

const num = (v: any): number | null => {
  const n = typeof v === 'number' ? v : parseFloat(String(v ?? ''));
  return Number.isFinite(n) ? n : null;
};

/** Flags derived from vitals and demographics (used by the rules). */
export function derivedFlags(data: ClerkingData, ctx: PatientContext): Record<string, boolean> {
  const v = data.vitals || {};
  const t = num(v.temperature), p = num(v.pulse), sbp = num(v.bp_systolic), dbp = num(v.bp_diastolic), rr = num(v.respiratory_rate), sp = num(v.spo2), g = num(v.glucose);
  const sex = (ctx.sex || '').toLowerCase();
  const consciousness = String(v.consciousness || '');
  const gcs = String(data.exam?.general?.consciousness || '');
  return {
    fever: t != null && t >= 38,
    tachycardia: p != null && p > 100,
    hypotension: sbp != null && sbp < 90,
    tachypnoea: rr != null && rr >= 22,
    hypoxia: sp != null && sp < 94,
    hyperglycaemia: g != null && g >= 11.1,
    very_high_glucose: g != null && g >= 14,
    hypoglycaemia: g != null && g < 4,
    bradycardia: p != null && p < 50,
    severe_hypertension: (sbp != null && sbp >= 180) || (dbp != null && dbp >= 120),
    altered_mentation: (!!consciousness && consciousness !== 'Alert') || ['Confused', 'Drowsy', 'Responds to pain only', 'Unresponsive'].includes(gcs),
    female_reproductive: showGynaecology(ctx) && !!ctx.sex,
    age_over_40: ctx.ageYears != null && ctx.ageYears > 40,
    age_under_16: ctx.ageYears != null && ctx.ageYears < 16,
    age_under_40: ctx.ageYears != null && ctx.ageYears < 40,
    age_over_50: ctx.ageYears != null && ctx.ageYears > 50,
    age_over_60: ctx.ageYears != null && ctx.ageYears > 60,
    male: sex.startsWith('m'),
    female: sex.startsWith('f'),
  };
}

/** Value(s) recorded for a rule key. */
export function valuesForKey(key: string, data: ClerkingData, flags: Record<string, boolean>): string[] {
  const [scope, ...rest] = key.split('.');
  const h = data.history || {};
  switch (scope) {
    case 'c': return data.complaints.flatMap(c => asList(c.answers?.[rest[0]] as Answer));
    case 'exam': return asList(data.exam?.[rest[0]]?.[rest[1]] as Answer);
    case 'pmh': return asList(h.pmh?.[rest[0]]?.status);
    case 'social': return asList(h.social?.[rest[0]]);
    case 'gyn': return asList(h.gyn?.[rest[0]]);
    case 'psh': return asList(h.psh?.[rest[0]]);
    case 'd': return flags[rest[0]] ? ['yes'] : [];
    case 'complaint': return data.complaints.some(c => c.complaintId === rest[0]) ? ['yes'] : [];
    case 'ros': return asList(h.ros?.[rest.join('.')]);
    case 'hx': return asList(h[rest[0]]);
    default: return [];
  }
}

function matches(values: string[], any: string[]): boolean {
  return any.some(want => {
    const m = /^([<>])(\d+(?:\.\d+)?)$/.exec(want);
    if (m) {
      const limit = parseFloat(m[2]);
      return values.some(v => { const n = num(v); return n != null && (m[1] === '>' ? n > limit : n < limit); });
    }
    return values.includes(want);
  });
}

export interface RankedDifferential {
  rule: DifferentialRule;
  score: number;
  reasons: string[];
  against: string[];
  /** Features that would support the diagnosis but are not documented yet. */
  undocumented: string[];
  forComplaints: string[];
}

/**
 * Score the differential rules. Candidates are the diagnoses linked to the
 * chosen complaints (listed even before any supporting finding is documented,
 * so the clinician sees what to confirm or exclude), plus any other rule with
 * strong documented support (score ≥ 4).
 */
export function rankDifferentials(data: ClerkingData, ctx: PatientContext): RankedDifferential[] {
  const flags = derivedFlags(data, ctx);
  const linked = new Map<string, string[]>();
  for (const c of data.complaints) {
    for (const id of COMPLAINT_BY_ID[c.complaintId]?.differentials || []) {
      linked.set(id, [...(linked.get(id) || []), c.label]);
    }
  }
  const out: RankedDifferential[] = [];
  for (const rule of Object.values(DIFFERENTIALS)) {
    let score = 0;
    const reasons: string[] = [], against: string[] = [], undocumented: string[] = [];
    for (const s of rule.supports) {
      const vals = valuesForKey(s.key, data, flags);
      if (matches(vals, s.any)) { score += s.weight; if (!reasons.includes(s.reason)) reasons.push(s.reason); }
      else if (vals.length === 0 && !/^(d|complaint)\./.test(s.key) && !undocumented.includes(s.reason)) undocumented.push(s.reason);
    }
    for (const a of rule.against || []) {
      if (matches(valuesForKey(a.key, data, flags), a.any)) { score -= a.weight; against.push(a.reason); }
    }
    const forComplaints = linked.get(rule.id) || [];
    const include = forComplaints.length > 0 || score >= 4;
    if (include) out.push({ rule, score, reasons, against, undocumented, forComplaints });
  }
  return out.sort((a, b) => b.score - a.score || Number(!!b.rule.dangerous) - Number(!!a.rule.dangerous));
}

/** Rule-based suggestions in the shape the review UI uses. */
export function ruleSuggestions(data: ClerkingData, ctx: PatientContext, maxDifferentials = 8): Suggestion[] {
  const ranked = rankDifferentials(data, ctx).slice(0, maxDifferentials);
  const out: Suggestion[] = [];
  const seen = new Set<string>();
  for (const d of ranked) {
    const forWhat = d.forComplaints.join(', ') || 'this presentation';
    const reasons = d.reasons.length ? [...d.reasons]
      : [d.rule.dangerous ? `Can't-miss diagnosis for ${forWhat} — no supporting features documented yet` : `Consider for ${forWhat} — no supporting features documented yet`];
    if (d.reasons.length === 0 && d.undocumented.length) reasons.push(`To support or exclude, document: ${d.undocumented.slice(0, 4).join('; ')}`);
    out.push({
      id: `rules:dx:${d.rule.id}`, kind: 'differential', text: d.rule.label + (d.rule.icd10 ? ` (${d.rule.icd10})` : ''),
      reasons, against: d.against, source: 'rules', dangerous: d.rule.dangerous,
      priority: d.rule.dangerous && d.score >= 4 ? 'urgent' : 'routine', decision: 'pending',
    });
    if (d.score <= 0) continue; // don't propose work-up for an unsupported diagnosis
    for (const inv of d.rule.investigations) {
      const id = `rules:inv:${inv.toLowerCase()}`;
      if (seen.has(id)) continue; seen.add(id);
      out.push({ id, kind: 'investigation', text: inv, reasons: [`For ${d.rule.label}`], source: 'rules', decision: 'pending', priority: d.rule.dangerous ? 'urgent' : 'routine' });
    }
    for (const m of d.rule.management) {
      const id = `rules:tx:${m.toLowerCase()}`;
      if (seen.has(id)) continue; seen.add(id);
      out.push({ id, kind: 'treatment', text: m, reasons: [`For ${d.rule.label}`], source: 'rules', decision: 'pending', priority: d.rule.dangerous ? 'urgent' : 'routine' });
    }
  }
  return out;
}

/** Merge freshly generated suggestions with earlier decisions (decisions win). */
export function mergeSuggestions(previous: Suggestion[], fresh: Suggestion[]): Suggestion[] {
  const prevById = new Map(previous.map(s => [s.id, s]));
  const merged = fresh.map(s => {
    const p = prevById.get(s.id);
    return p && p.decision !== 'pending' ? { ...s, decision: p.decision, edited: p.edited } : s;
  });
  const freshIds = new Set(fresh.map(s => s.id));
  // keep anything the clinician already decided on, plus manual entries
  for (const p of previous) if (!freshIds.has(p.id) && (p.decision !== 'pending' || p.id.startsWith('manual:'))) merged.push(p);
  return merged;
}

// ── Red flags, risk factors, completeness ───────────────────────────────────

export interface Flag { text: string; where: string }

export function redFlags(data: ClerkingData, ctx: PatientContext): Flag[] {
  const flags: Flag[] = [];
  const check = (qs: Question[], answers: Record<string, any> | undefined, where: string) => {
    for (const q of qs) {
      if (!q.redFlags || !answers) continue;
      const hit = asList(answers[q.id]).filter(a => q.redFlags!.includes(a));
      if (hit.length) flags.push({ text: `${q.label}: ${hit.join(', ')}`, where });
    }
  };
  for (const c of data.complaints) for (const m of questionsForComplaint(c)) check(m.questions, c.answers, c.label);
  for (const [sid, answers] of Object.entries(data.exam || {})) if (EXAM_SECTIONS[sid]) check(EXAM_SECTIONS[sid].questions, answers, EXAM_SECTIONS[sid].title);
  check(VITALS_CONTEXT, data.vitals as any, 'Vitals');
  if (showGynaecology(ctx)) check(GYN_QUESTIONS, data.history?.gyn, 'Gynaecological history');
  const d = derivedFlags(data, ctx);
  if (d.hypotension) flags.push({ text: `Systolic BP ${data.vitals.bp_systolic} mmHg`, where: 'Vitals' });
  if (d.hypoxia) flags.push({ text: `SpO₂ ${data.vitals.spo2} %`, where: 'Vitals' });
  if (num(data.vitals.pulse) != null && num(data.vitals.pulse)! > 130) flags.push({ text: `Pulse ${data.vitals.pulse}/min`, where: 'Vitals' });
  if (num(data.vitals.respiratory_rate) != null && num(data.vitals.respiratory_rate)! >= 25) flags.push({ text: `Respiratory rate ${data.vitals.respiratory_rate}/min`, where: 'Vitals' });
  if (num(data.vitals.temperature) != null && (num(data.vitals.temperature)! >= 39 || num(data.vitals.temperature)! < 35)) flags.push({ text: `Temperature ${data.vitals.temperature} °C`, where: 'Vitals' });
  if (data.allergies.some(a => a.severity === 'Severe / life-threatening')) flags.push({ text: 'Severe drug allergy recorded', where: 'Allergies' });
  return flags;
}

export function riskFactors(data: ClerkingData): string[] {
  const h = data.history || {};
  const out: string[] = [];
  for (const c of COMORBIDITIES) {
    if (h.pmh?.[c.id]?.status === 'Yes') {
      const control = h.pmh[c.id].control ? ` (${String(h.pmh[c.id].control).toLowerCase()} control)` : '';
      out.push(`${c.label}${control}${c.riskFactor ? ` — ${c.riskFactor}` : ''}`);
    }
  }
  const s = h.social || {};
  if (['Current smoker', 'Ex-smoker'].includes(s.smoking)) out.push(`${s.smoking} — impaired healing, flap / graft risk`);
  if (s.alcohol === 'Heavy') out.push('Heavy alcohol use — withdrawal, nutrition, bleeding risk');
  if (['Bed-bound', 'Wheelchair'].includes(s.mobility)) out.push(`${s.mobility} — pressure injury and VTE risk`);
  if (s.diet === 'Poor intake') out.push('Poor nutritional intake — impaired healing');
  if (h.gyn?.contraception === 'Combined pill (oestrogen — VTE risk)') out.push('Oestrogen contraception — VTE risk');
  if (h.gyn?.pregnancy_possible === 'Pregnancy confirmed') out.push('Pregnancy — drug, imaging and VTE considerations');
  const bmi = bmiOf(data);
  if (bmi != null && bmi >= 30 && h.pmh?.obesity?.status !== 'Yes') out.push(`BMI ${bmi.toFixed(1)} — wound complications, VTE`);
  for (const m of data.medications) {
    const t = `${m.name} ${m.indication || ''}`.toLowerCase();
    if (/warfarin|rivaroxaban|apixaban|heparin|enoxaparin|clopidogrel|aspirin/.test(t)) out.push(`${m.name} — bleeding risk; plan peri-operative management`);
    if (/prednis|dexameth|hydrocort|steroid/.test(t)) out.push(`${m.name} — impaired healing; steroid cover may be needed`);
  }
  return [...new Set(out)];
}

export function bmiOf(data: ClerkingData): number | null {
  const w = num(data.vitals?.weight), h = num(data.vitals?.height);
  return w && h ? w / ((h / 100) ** 2) : null;
}

export interface CompletenessItem { section: string; missing: string; essential: boolean }

/** What is still undocumented — essentials block "submit", others are prompts. */
export function completeness(data: ClerkingData, ctx: PatientContext): CompletenessItem[] {
  const out: CompletenessItem[] = [];
  if (data.complaints.length === 0) out.push({ section: 'Presenting complaints', missing: 'At least one presenting complaint', essential: true });
  for (const c of data.complaints) {
    if (!c.duration?.value) out.push({ section: c.label, missing: 'Duration', essential: true });
    const unanswered = questionsForComplaint(c).flatMap(m => m.questions).filter(q => isVisible(q, c.answers) && !isAnswered(c.answers[q.id] as Answer));
    if (unanswered.length) out.push({ section: c.label, missing: `${unanswered.length} question(s) not answered`, essential: false });
  }
  if (!data.allergyStatus || data.allergyStatus === 'not_asked') out.push({ section: 'Allergies', missing: 'Allergy status (state NKDA explicitly if none)', essential: true });
  if (!data.medicationStatus) out.push({ section: 'Drug history', missing: 'Medication status', essential: true });
  const pmh = data.history?.pmh || {};
  const notAsked = COMORBIDITIES.filter(c => !pmh[c.id]?.status);
  if (notAsked.length) out.push({ section: 'Past medical history', missing: `${notAsked.length} comorbidities not asked`, essential: notAsked.some(c => ['diabetes', 'hypertension', 'sickle_cell', 'hiv'].includes(c.id)) });
  if (showGynaecology(ctx) && !data.history?.gyn?.pregnancy_possible) out.push({ section: 'Gynaecological history', missing: 'Pregnancy status', essential: true });
  for (const v of ['temperature', 'pulse', 'bp_systolic', 'respiratory_rate', 'spo2']) {
    if (!isAnswered(data.vitals?.[v] as Answer)) out.push({ section: 'Vitals', missing: VITALS.find(x => x.id === v)!.label, essential: true });
  }
  for (const sid of examSectionsFor(data)) {
    const answered = Object.values(data.exam?.[sid] || {}).filter(v => isAnswered(v as Answer)).length;
    if (answered === 0) out.push({ section: 'Examination', missing: `${EXAM_SECTIONS[sid].title} not documented`, essential: sid === 'general' || !['general_extra', 'cvs', 'resp', 'abdo', 'neuro'].includes(sid) });
  }
  return out;
}

// ── Narrative ──────────────────────────────────────────────────────────────

const ND = 'not documented';

function answeredLines(qs: Question[], answers: Record<string, any> | undefined): string[] {
  if (!answers) return [];
  return qs.filter(q => isVisible(q, answers) && isAnswered(answers[q.id])).map(q => {
    const v = answers[q.id];
    return `${q.label}: ${Array.isArray(v) ? v.join(', ') : v}${q.unit ? ` ${q.unit}` : ''}`;
  });
}

export function durationText(c: ComplaintEntry): string {
  return c.duration?.value ? `${c.duration.value} ${c.duration.unit}` : `duration ${ND}`;
}

export interface NarrativeInput {
  patientLabel?: string;
  ctx: PatientContext;
  data: ClerkingData;
  suggestions?: Suggestion[];
  author?: string;
}

/** Plain-text clerking note. Every section appears; empty ones say "not documented". */
export function generateNarrative({ patientLabel, ctx, data, suggestions = [], author }: NarrativeInput): string {
  const L: string[] = [];
  const h = data.history || {};
  const sec = (title: string) => { L.push(''); L.push(title.toUpperCase()); };

  L.push(`INITIAL PATIENT ENCOUNTER — STRUCTURED CLERKING`);
  if (patientLabel) L.push(patientLabel);
  L.push(`Age: ${ctx.ageYears ?? ND} · Sex: ${ctx.sex || ND}`);
  L.push(`Informant: ${data.source?.informant || ND} · Reliability: ${data.source?.reliability || ND}`);

  sec('Presenting complaints');
  if (!data.complaints.length) L.push(ND);
  data.complaints.forEach((c, i) => L.push(`${i + 1}. ${c.label} — ${durationText(c)}`));

  sec('History of presenting complaints');
  if (!data.complaints.length) L.push(ND);
  for (const c of data.complaints) {
    L.push(`${c.label} (${durationText(c)}):`);
    const lines = questionsForComplaint(c).flatMap(m => answeredLines(m.questions, c.answers));
    if (c.answers?.free_text) lines.push(`In the patient's words: ${c.answers.free_text}`);
    L.push(...(lines.length ? lines.map(l => `  • ${l}`) : [`  • details ${ND}`]));
  }

  sec('Review of systems');
  const ros = h.ros || {};
  const present = Object.entries(ros).filter(([, v]) => v === 'present').map(([k]) => k);
  const absent = Object.entries(ros).filter(([, v]) => v === 'absent').map(([k]) => k);
  const asked = present.length + absent.length;
  const total = ROS.reduce((n, s) => n + s.symptoms.length, 0);
  L.push(asked ? `Positive: ${present.join(', ') || 'none'}. Negative: ${absent.join(', ') || 'none'}. ${total - asked} not asked.` : ND);

  sec('Past medical history');
  const pmh = h.pmh || {};
  const yes = COMORBIDITIES.filter(c => pmh[c.id]?.status === 'Yes');
  const no = COMORBIDITIES.filter(c => pmh[c.id]?.status === 'No');
  const unk = COMORBIDITIES.filter(c => pmh[c.id]?.status === 'Unknown');
  const notAsked = COMORBIDITIES.length - yes.length - no.length - unk.length;
  for (const c of yes) {
    const details = answeredLines(c.details || [], pmh[c.id]).join('; ');
    L.push(`• ${c.label}${details ? ` — ${details}` : ''}`);
  }
  if (no.length) L.push(`Denies: ${no.map(c => c.label).join(', ')}.`);
  if (unk.length) L.push(`Unknown: ${unk.map(c => c.label).join(', ')}.`);
  if (notAsked) L.push(`${notAsked} conditions not asked.`);
  if (pmh.other) L.push(`Other: ${pmh.other}`);

  sec('Past surgical history');
  const psh = answeredLines(PSH_QUESTIONS, h.psh);
  L.push(...(psh.length ? psh : [ND]));

  sec('Drug history');
  if (data.medicationStatus === 'none') L.push('No regular medications.');
  else if (data.medicationStatus === 'unknown' || !data.medicationStatus) L.push(data.medicationStatus === 'unknown' ? 'Medications unknown — to be confirmed.' : ND);
  for (const m of data.medications) L.push(`• ${[m.name, m.dose, m.route, m.frequency].filter(Boolean).join(' ')}${m.indication ? ` — for ${m.indication}` : ''}${m.adherence ? ` (${m.adherence})` : ''}`);
  if (h.drug_high_risk?.length) L.push(`High-risk medicines: ${h.drug_high_risk.join(', ')}`);

  sec('Allergies');
  if (data.allergyStatus === 'nkda') L.push('No known drug allergies (asked).');
  else if (data.allergyStatus === 'unable') L.push('Unable to obtain allergy history — treat as unknown.');
  else if (data.allergyStatus === 'has_allergies') data.allergies.forEach(a => L.push(`• ${a.substance.trim() || 'substance not named'}${a.reaction ? ` — ${a.reaction}` : ''}${a.severity ? `, ${a.severity}` : ''}${a.certainty ? ` (${a.certainty})` : ''}`));
  else L.push(`${ND} — ALLERGY STATUS NOT ASKED`);

  if (showGynaecology(ctx)) {
    sec('Gynaecological / obstetric history');
    const g = answeredLines(GYN_QUESTIONS, h.gyn);
    L.push(...(g.length ? g : [ND]));
  }

  sec('Family history');
  const f = answeredLines(FAMILY_QUESTIONS, h.family);
  L.push(...(f.length ? f : [ND]));

  sec('Social history');
  const s = answeredLines(SOCIAL_QUESTIONS, h.social);
  L.push(...(s.length ? s : [ND]));

  sec('Examination');
  const vitals = VITALS.filter(v => isAnswered(data.vitals?.[v.id] as Answer)).map(v => `${v.label} ${data.vitals[v.id]}${v.unit ? ` ${v.unit}` : ''}`);
  const vctx = answeredLines(VITALS_CONTEXT, data.vitals as any);
  L.push(`Vitals: ${vitals.length ? [...vitals, ...vctx].join(', ') : ND}`);
  const bmi = bmiOf(data);
  if (bmi) L.push(`BMI: ${bmi.toFixed(1)} kg/m²`);
  for (const sid of examSectionsFor(data)) {
    const lines = answeredLines(EXAM_SECTIONS[sid].questions, data.exam?.[sid]);
    if (data.exam?.[sid]?.other_findings) lines.push(`Other: ${data.exam[sid].other_findings}`);
    L.push(`${EXAM_SECTIONS[sid].title}: ${lines.length ? lines.join('; ') : ND}`);
  }

  const flags = redFlags(data, ctx);
  if (flags.length) { sec('Red flags'); flags.forEach(fl => L.push(`⚠ ${fl.text} (${fl.where})`)); }
  const risks = riskFactors(data);
  if (risks.length) { sec('Risk factors / comorbidities'); risks.forEach(r => L.push(`• ${r}`)); }

  if (data.impression) { sec('Clinical impression'); L.push(data.impression); }

  const accepted = (k: Suggestion['kind']) => suggestions.filter(x => x.kind === k && x.decision === 'accepted');
  sec('Differential diagnoses (clinician-accepted)');
  const dx = accepted('differential');
  L.push(...(dx.length ? dx.map((d, i) => `${i + 1}. ${d.edited || d.text}${d.reasons.length ? ` — ${d.reasons.join('; ')}` : ''}`) : ['None accepted yet']));
  sec('Investigations (clinician-accepted)');
  const inv = accepted('investigation');
  L.push(...(inv.length ? inv.map(x => `• ${x.edited || x.text}`) : ['None accepted yet']));
  sec('Management plan (clinician-accepted)');
  const tx = accepted('treatment');
  L.push(...(tx.length ? tx.map(x => `• ${x.edited || x.text}`) : ['None accepted yet']));

  if (author) { L.push(''); L.push(`Clerked by: ${author}`); }
  return L.join('\n');
}

// ── Follow-up ──────────────────────────────────────────────────────────────

export interface FollowUpData {
  version: 1;
  problems: Array<{ problemId: string; label: string; status: string; note?: string }>;
  plan: Array<{ itemId: string; text: string; kind?: string; status: string; note?: string }>;
  newComplaints: ComplaintEntry[];
  vitals: Record<string, number | string>;
  exam: Record<string, Record<string, any>>;
  symptoms?: string;
  impression?: string;
}

export function generateFollowUpNarrative(fu: FollowUpData, author?: string): string {
  const L: string[] = ['FOLLOW-UP ENCOUNTER'];
  L.push('', 'PROBLEM REVIEW');
  if (!fu.problems.length) L.push('No tracked problems.');
  for (const p of fu.problems) L.push(`• ${p.label}: ${p.status === 'not_reviewed' ? 'NOT REVIEWED' : p.status.replace('_', ' ')}${p.note ? ` — ${p.note}` : ''}`);
  L.push('', 'PLAN ITEMS');
  if (!fu.plan.length) L.push('No outstanding plan items.');
  for (const i of fu.plan) L.push(`• ${i.text}: ${i.status === 'not_reviewed' ? 'NOT REVIEWED' : i.status.replace('_', ' ')}${i.note ? ` — ${i.note}` : ''}`);
  L.push('', 'NEW COMPLAINTS');
  if (!fu.newComplaints.length) L.push('None reported.');
  for (const c of fu.newComplaints) {
    L.push(`• ${c.label} — ${durationText(c)}`);
    for (const m of questionsForComplaint(c)) for (const l of answeredLines(m.questions, c.answers)) L.push(`    ${l}`);
  }
  if (fu.symptoms) L.push('', 'INTERVAL HISTORY', fu.symptoms);
  const vitals = VITALS.filter(v => isAnswered(fu.vitals?.[v.id] as Answer)).map(v => `${v.label} ${fu.vitals[v.id]}${v.unit ? ` ${v.unit}` : ''}`);
  L.push('', `VITALS: ${vitals.length ? vitals.join(', ') : ND}`);
  for (const [sid, ans] of Object.entries(fu.exam || {})) {
    if (!EXAM_SECTIONS[sid]) continue;
    const lines = answeredLines(EXAM_SECTIONS[sid].questions, ans);
    if (ans?.other_findings) lines.push(`Other: ${ans.other_findings}`);
    if (lines.length) L.push(`${EXAM_SECTIONS[sid].title}: ${lines.join('; ')}`);
  }
  if (fu.impression) L.push('', 'IMPRESSION / PLAN', fu.impression);
  if (author) L.push('', `Reviewed by: ${author}`);
  return L.join('\n');
}

export function emptyClerking(): ClerkingData {
  return {
    version: 1, source: { informant: '', reliability: '' }, complaints: [], history: { pmh: {}, psh: {}, family: {}, social: {}, gyn: {}, ros: {} },
    medications: [], allergies: [], exam: {}, vitals: {},
  };
}

export function emptyFollowUp(): FollowUpData {
  return { version: 1, problems: [], plan: [], newComplaints: [], vitals: {}, exam: {} };
}

/** Compact, de-identified payload for the AI suggestion request. */
export function aiPayload(data: ClerkingData, ctx: PatientContext) {
  const strip = (o: Record<string, any> = {}) => Object.fromEntries(Object.entries(o).filter(([, v]) => isAnswered(v)));
  return {
    age: ctx.ageYears ?? null,
    sex: ctx.sex || null,
    complaints: data.complaints.map(c => ({ complaint: c.label, duration: c.duration?.value ? `${c.duration.value} ${c.duration.unit}` : null, answers: strip(c.answers as any) })),
    comorbidities: Object.fromEntries(Object.entries(data.history?.pmh || {}).filter(([, v]: any) => v?.status).map(([k, v]: any) => [k, v.status])),
    social: strip(data.history?.social),
    gyn: showGynaecology(ctx) ? strip(data.history?.gyn) : undefined,
    medications: data.medications.map(m => m.name),
    allergyStatus: data.allergyStatus || 'not_asked',
    allergies: data.allergies.map(a => a.substance.trim()).filter(Boolean),
    vitals: strip(data.vitals as any),
    exam: Object.fromEntries(Object.entries(data.exam || {}).map(([k, v]) => [k, strip(v as any)]).filter(([, v]) => Object.keys(v as any).length)),
    redFlags: redFlags(data, ctx).map(f => f.text),
  };
}

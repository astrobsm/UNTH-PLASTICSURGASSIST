import { describe, it, expect } from 'vitest';
import { COMPLAINTS, COMPLAINT_BY_ID, searchComplaints, normaliseTerm } from '../clinical/clerking/complaints';
import { MODULES } from '../clinical/clerking/modules';
import { EXAM_SECTIONS } from '../clinical/clerking/examination';
import { COMORBIDITIES, SOCIAL_QUESTIONS, GYN_QUESTIONS, PSH_QUESTIONS, ROS, HIGH_RISK_DRUG_CLASSES } from '../clinical/clerking/history';
import { DIFFERENTIALS } from '../clinical/clerking/differentials';
import {
  completeness, emptyClerking, generateNarrative, mergeSuggestions, rankDifferentials, redFlags, riskFactors, ruleSuggestions, showGynaecology,
} from '../clinical/clerking/engine';
import type { ClerkingData, Question } from '../clinical/clerking/types';

const DERIVED = ['fever', 'tachycardia', 'hypotension', 'tachypnoea', 'hypoxia', 'hyperglycaemia', 'very_high_glucose', 'hypoglycaemia', 'bradycardia',
  'severe_hypertension', 'altered_mentation', 'female_reproductive', 'age_over_40', 'age_under_16', 'age_under_40', 'age_over_50', 'age_over_60', 'male', 'female'];

function questionForKey(key: string): Question | 'derived' | undefined {
  const [scope, a, b] = key.split('.');
  if (scope === 'd') return DERIVED.includes(a) ? 'derived' : undefined;
  if (scope === 'c') return Object.values(MODULES).flatMap(m => m.questions).find(q => q.id === a);
  if (scope === 'exam') return EXAM_SECTIONS[a]?.questions.find(q => q.id === b);
  if (scope === 'pmh') return COMORBIDITIES.some(c => c.id === a) ? { id: a, label: a, type: 'select', options: ['Yes', 'No', 'Unknown'] } : undefined;
  if (scope === 'social') return SOCIAL_QUESTIONS.find(q => q.id === a);
  if (scope === 'gyn') return GYN_QUESTIONS.find(q => q.id === a);
  if (scope === 'psh') return PSH_QUESTIONS.find(q => q.id === a);
  if (scope === 'complaint') return COMPLAINT_BY_ID[a] ? { id: a, label: a, type: 'select', options: ['yes'] } : undefined;
  if (scope === 'ros') return ROS.some(r => r.symptoms.includes(a)) ? { id: a, label: a, type: 'select', options: ['present', 'absent'] } : undefined;
  if (scope === 'hx' && a === 'drug_high_risk') return { id: a, label: a, type: 'multiselect', options: [...HIGH_RISK_DRUG_CLASSES, 'None of these'] };
  return undefined;
}

describe('clerking knowledge base integrity', () => {
  it('every rule key and answer exists in the forms', () => {
    const problems: string[] = [];
    for (const rule of Object.values(DIFFERENTIALS)) {
      for (const s of [...rule.supports, ...(rule.against || [])]) {
        const q = questionForKey(s.key);
        if (!q) { problems.push(`${rule.id}: unknown key ${s.key}`); continue; }
        if (q === 'derived') continue;
        if (q.type === 'number') { if (!s.any.every(v => /^[<>]\d/.test(v))) problems.push(`${rule.id}: ${s.key} numeric needs >N/<N`); continue; }
        for (const v of s.any) if (!q.options?.includes(v)) problems.push(`${rule.id}: ${s.key} has no option "${v}"`);
      }
    }
    expect(problems).toEqual([]);
  });

  it('every linked differential has a rule, and rules have reasons and a plan', () => {
    const missing = [...new Set(COMPLAINTS.flatMap(c => c.differentials || []))].filter(id => !DIFFERENTIALS[id]);
    expect(missing).toEqual([]);
    for (const r of Object.values(DIFFERENTIALS)) {
      expect(r.supports.length, r.id).toBeGreaterThan(0);
      expect(r.supports.every(x => x.reason && x.weight > 0), r.id).toBe(true);
      expect(r.investigations.length + r.management.length, r.id).toBeGreaterThan(0);
    }
  });

  it('complaints reference real modules and exam sections, and ids are unique', () => {
    const bad: string[] = [];
    for (const c of COMPLAINTS) {
      for (const m of c.modules) if (!MODULES[m]) bad.push(`${c.id}: module ${m}`);
      for (const e of c.exams) if (!EXAM_SECTIONS[e]) bad.push(`${c.id}: exam ${e}`);
    }
    expect(bad).toEqual([]);
    expect(new Set(COMPLAINTS.map(c => c.id)).size).toBe(COMPLAINTS.length);
  });

  it('showIf references a question in the same module', () => {
    for (const m of Object.values(MODULES)) for (const q of m.questions) {
      if (q.showIf) expect(m.questions.some(x => x.id === q.showIf!.q)).toBe(true);
    }
  });
});

describe('complaint search', () => {
  it('finds by label prefix, synonym and typo', () => {
    expect(searchComplaints('burn')[0].complaint.id).toBe('burn');
    expect(searchComplaints('bed sore').map(r => r.complaint.id)).toContain('pressure_sore');
    expect(searchComplaints('keloid').length).toBeGreaterThan(0);
    expect(searchComplaints('ulser').map(r => r.complaint.id).some(id => /ulcer/.test(id))).toBe(true);
  });
  it('normalises punctuation and case', () => {
    expect(normaliseTerm('  Bed-Sore!! ')).toBe('bed sore');
  });
});

function ulcerCase(): ClerkingData {
  const d = emptyClerking();
  d.complaints = [{ uid: '1', complaintId: 'chronic_ulcer', label: COMPLAINT_BY_ID.chronic_ulcer.label, duration: { value: 12, unit: 'years' },
    answers: { wound_on_scar: 'Yes', wound_start: 'On a scar / old burn scar', wound_heaped_edge: 'Yes' } }];
  d.exam = { local_wound: { wound_edge: 'Everted', wound_floor: 'Fungating / cauliflower' } };
  return d;
}

describe('rule-based differentials', () => {
  it("ranks Marjolin's ulcer first for an everted ulcer on an old burn scar, with reasons", () => {
    const ranked = rankDifferentials(ulcerCase(), { ageYears: 50, sex: 'Male' });
    expect(ranked[0].rule.id).toBe('marjolin_ulcer');
    expect(ranked[0].reasons).toContain('Arising in a long-standing scar or wound');
  });
  it('lists linked can\'t-miss diagnoses even without support, but proposes no work-up for them', () => {
    const d = emptyClerking();
    d.complaints = [{ uid: '1', complaintId: 'foot_ulcer', label: 'Foot ulcer', duration: { value: 2, unit: 'weeks' }, answers: {} }];
    const s = ruleSuggestions(d, {});
    const nf = s.find(x => x.id === 'rules:dx:necrotising_fasciitis');
    expect(nf?.dangerous).toBe(true);
    expect(s.some(x => x.kind === 'investigation' && x.reasons.includes('For Necrotising soft-tissue infection (necrotising fasciitis)'))).toBe(false);
  });
  it('vital-sign derived flags drive sepsis', () => {
    const d = ulcerCase();
    d.vitals = { temperature: 39.2, pulse: 128, bp_systolic: 82, respiratory_rate: 26 };
    expect(rankDifferentials(d, {}).some(r => r.rule.id === 'sepsis')).toBe(true);
    expect(redFlags(d, {}).some(f => /Systolic BP/.test(f.text))).toBe(true);
  });
  it('keeps clinician decisions when suggestions are regenerated', () => {
    const first = ruleSuggestions(ulcerCase(), {});
    first[0].decision = 'accepted';
    first[0].edited = 'Marjolin ulcer — biopsy urgently';
    const merged = mergeSuggestions(first, ruleSuggestions(ulcerCase(), {}));
    expect(merged.find(s => s.id === first[0].id)?.decision).toBe('accepted');
    expect(merged.find(s => s.id === first[0].id)?.edited).toBe('Marjolin ulcer — biopsy urgently');
  });
});

describe('missing data is never normal', () => {
  it('narrative says "not documented" and flags unasked allergies', () => {
    const text = generateNarrative({ ctx: {}, data: emptyClerking() });
    expect(text).toMatch(/ALLERGY STATUS NOT ASKED/);
    expect(text).toMatch(/Past surgical history\n?.*not documented/i);
    expect(text).not.toMatch(/\bnormal\b/i);
  });
  it('completeness requires allergy status, vitals and duration', () => {
    const d = emptyClerking();
    d.complaints = [{ uid: '1', complaintId: 'burn', label: 'Burn injury', answers: {} }];
    const ess = completeness(d, {}).filter(i => i.essential).map(i => i.missing);
    expect(ess).toContain('Duration');
    expect(ess.some(m => /Allergy status/.test(m))).toBe(true);
    expect(ess).toContain('Temperature');
  });
  it('gynaecology applies to women 10–55 only', () => {
    expect(showGynaecology({ sex: 'Female', ageYears: 30 })).toBe(true);
    expect(showGynaecology({ sex: 'female', ageYears: 70 })).toBe(false);
    expect(showGynaecology({ sex: 'Male', ageYears: 30 })).toBe(false);
  });
  it('derives risk factors from comorbidities, social history and drugs', () => {
    const d = emptyClerking();
    d.history.pmh = { diabetes: { status: 'Yes', control: 'Poor' } };
    d.history.social = { smoking: 'Current smoker' };
    d.medications = [{ name: 'Warfarin' }];
    const r = riskFactors(d).join('\n');
    expect(r).toMatch(/Diabetes mellitus \(poor control\)/);
    expect(r).toMatch(/Current smoker/);
    expect(r).toMatch(/Warfarin — bleeding risk/);
  });
});

describe('general medical rules', () => {
  it('crushing chest pain with sweating ranks ACS first and flags it', () => {
    const d = emptyClerking();
    d.complaints = [{ uid: '1', complaintId: 'chest_pain', label: 'Chest pain', duration: { value: 2, unit: 'hours' },
      answers: { pain_character: 'Tight / pressing / crushing', pain_radiation: 'To the arm', cvs_sweating: 'Yes' } }];
    const ranked = rankDifferentials(d, { ageYears: 58, sex: 'Male' });
    expect(ranked[0].rule.id).toBe('acs');
    expect(ranked[0].rule.dangerous).toBe(true);
    expect(ranked.find(r => r.rule.id === 'musculoskeletal_chest')!.against.length).toBeGreaterThan(0);
  });
  it('review of systems answers feed the rules', () => {
    const d = emptyClerking();
    d.complaints = [{ uid: '1', complaintId: 'night_sweats', label: 'Night sweats', duration: { value: 2, unit: 'months' }, answers: {} }];
    d.history.ros = { 'Night sweats': 'present', 'Weight loss': 'present' };
    d.history.pmh = { hiv: { status: 'Yes' } };
    const ids = rankDifferentials(d, {}).filter(r => r.score > 0).map(r => r.rule.id);
    expect(ids).toContain('tb');
    expect(ids).toContain('lymphoma');
  });
  it('a high-riding testis with sudden pain is torsion before epididymo-orchitis', () => {
    const d = emptyClerking();
    d.complaints = [{ uid: '1', complaintId: 'scrotal_swelling', label: 'Scrotal swelling', duration: { value: 3, unit: 'hours' }, answers: { onset: 'Sudden (seconds–minutes)' } }];
    d.exam = { genital: { gen_testes: 'High-riding / horizontal lie' } };
    expect(rankDifferentials(d, { ageYears: 15, sex: 'Male' })[0].rule.id).toBe('testicular_torsion');
  });
  it('hypoglycaemia is derived from the glucose reading', () => {
    const d = emptyClerking();
    d.complaints = [{ uid: '1', complaintId: 'confusion', label: 'Confusion', duration: { value: 1, unit: 'hours' }, answers: {} }];
    d.vitals = { glucose: 2.4 };
    expect(rankDifferentials(d, {})[0].rule.id).toBe('hypoglycaemia');
  });
});

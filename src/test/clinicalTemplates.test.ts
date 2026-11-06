import { describe, expect, it } from 'vitest';
import { buildPlan, buildTemplate, completeness, computeScores, emptyTemplateData, planSuggestions, templateFlags, templateNarrative, templateSummary } from '../clinical/templates/engine';
import { PROCEDURES } from '../clinical/templates/procedures';
import { REVIEW_KINDS, PLAN_DOMAINS } from '../clinical/templates/types';
import { buildTemplatePdf } from '../clinical/templates/pdf';
import { mustOf } from '../clinical/templates/holistic';
import { capriniOf, news2Of } from '../clinical/templates/common';
import { ENCOUNTER_TYPES } from '../../api/_lib/clinicalEncounters.js';

const kinds = REVIEW_KINDS.map(k => k.kind).filter(k => k !== 'wound_review');

describe('clinical review templates', () => {
  it('every procedure × review kind builds, with unique ids and the holistic sections', () => {
    for (const p of PROCEDURES) for (const k of kinds) {
      const t = buildTemplate(k, p.id);
      const ids = t.sections.map(s => s.id);
      expect(new Set(ids).size, `${t.id} section ids`).toBe(ids.length);
      for (const s of t.sections) {
        const qids = s.questions.map(q => q.id);
        expect(new Set(qids).size, `${t.id}/${s.id} question ids`).toBe(qids.length);
        for (const q of s.questions) {
          if (q.type === 'select' || q.type === 'multiselect') expect(q.options?.length, `${t.id}/${q.id}`).toBeGreaterThan(1);
          for (const rf of q.redFlags || []) expect(q.options, `${t.id}/${q.id} red flag "${rf}"`).toContain(rf);
          if (q.showIf) expect(qids, `${t.id}/${q.id} showIf`).toContain(q.showIf.q);
        }
      }
      for (const must of ['nutrition', 'healing', 'psych', 'counselling']) expect(ids, `${t.id}`).toContain(must);
      expect(ids).toContain(k === 'preop_review' ? 'consent' : 'care_consent');
      // Rules never throw on an empty form.
      const d = emptyTemplateData(t);
      expect(() => templateFlags(t, {})).not.toThrow();
      expect(() => computeScores(t, {})).not.toThrow();
      expect(() => buildPlan(t, {}, [])).not.toThrow();
      expect(() => templateNarrative(t, { ...d, plan: buildPlan(t, {}, []) }, { patientLabel: 'X', author: 'Y' })).not.toThrow();
      expect(t.references.length).toBeGreaterThan(2);
    }
  });

  it('the wound care review builds and stages infection', () => {
    const t = buildTemplate('wound_review', null);
    const a = { infection: { systemic: ['Fever > 38 °C'] }, measure: { length: 4, width: 3 }, bed: { exudate_amt: 'Moderate', granulation: 60, slough: 40, necrosis: 0 } };
    const scores = computeScores(t, a);
    expect(scores.find(s => s.id === 'iwii')?.result.value).toBe('Systemic');
    expect(scores.find(s => s.id === 'push')).toBeTruthy();
    expect(templateFlags(t, a).some(f => f.severity === 'urgent' && /sepsis/i.test(f.text))).toBe(true);
    const plan = buildPlan(t, a, []);
    expect(plan.some(l => l.kind === 'investigation' && /blood cultures/i.test(l.text))).toBe(true);
    expect(plan.some(l => /Debride/.test(l.text))).toBe(true);
  });

  it('computes MUST, Caprini and NEWS2 correctly', () => {
    expect(mustOf({ nutrition: { weight: 45, height: 165, wt_loss: '> 10%', acute: 'No' } })).toBe(4); // BMI 16.5 → 2, loss → 2
    expect(capriniOf({ vte: { caprini: ['Age 61–74', 'Major surgery > 45 min', 'Malignancy (present or previous)'] } })).toBe(6);
    expect(news2Of({ obs: { rr: 24, spo2: 93, o2: 'No', sbp: 100, hr: 115, temp: 38.5, avpu: 'Alert' } })?.total).toBe(2 + 2 + 2 + 2 + 1);
  });

  it('the plan integrates nutrition, healing factors and psychology, and keeps clinician edits', () => {
    const t = buildTemplate('preop_review', 'free_flap');
    const a: any = {
      nutrition: { weight: 45, height: 165, wt_loss: '> 10%', acute: 'No' },
      healing: { factors: ['Smoking / nicotine', 'Diabetes mellitus', 'HIV'] },
      psych: { phq_1: '2 — more than half the days', phq_2: '2 — more than half the days', support: 'Limited' },
      vte: { caprini: ['Age 61–74', 'Major surgery > 45 min', 'Malignancy (present or previous)'] },
    };
    const plan = buildPlan(t, a, []);
    const domains = new Set(plan.map(l => l.domain));
    for (const d of ['Nutrition', 'Comorbidity and metabolic optimisation', 'Psychological and social care', 'VTE prophylaxis', 'Analgesia and comfort'] as const) expect(domains.has(d), d).toBe(true);
    expect(plan.some(l => /Smoking cessation/.test(l.text))).toBe(true);
    expect(plan.some(l => /LMWH/.test(l.text))).toBe(true);
    // Sorted in domain order.
    const order = plan.map(l => PLAN_DOMAINS.indexOf(l.domain));
    expect([...order].sort((x, y) => x - y)).toEqual(order);

    // Edit a line, exclude another, add one — then change the answers.
    const edited = plan.map((l, i) => (i === 0 ? { ...l, text: 'My wording', edited: true } : i === 1 ? { ...l, include: false } : l));
    edited.push({ id: 'c1', domain: 'Investigations', text: 'Echo', kind: 'investigation', source: 'clinician', include: true });
    const again = buildPlan(t, { ...a, psych: {} }, edited);
    expect(again.find(l => l.id === plan[0].id)?.text).toBe('My wording');
    expect(again.find(l => l.id === plan[1].id)?.include).toBe(false);
    expect(again.some(l => l.id === 'c1')).toBe(true);
    expect(again.some(l => /PHQ-9/.test(l.text))).toBe(false);

    const data = { ...emptyTemplateData(t), answers: a, plan: again };
    const sugg = planSuggestions(data, t.title);
    expect(sugg.every(s => s.decision === 'accepted')).toBe(true);
    expect(sugg.some(s => s.text === 'Echo')).toBe(true);
    const summary = templateSummary(t, data);
    expect(summary.healing_factors).toContain('HIV');
  });

  it('flap compromise raises an urgent alert in the post-op review', () => {
    const t = buildTemplate('postop_review', 'free_flap');
    expect(templateFlags(t, { monitor: { colour: 'Dusky / blue' } }).some(f => f.severity === 'urgent')).toBe(true);
    expect(buildPlan(t, { monitor: { colour: 'Dusky / blue' } }, []).some(l => /re-exploration/i.test(l.text) && l.priority === 'urgent')).toBe(true);
  });

  it('completeness counts only visible required questions', () => {
    const t = buildTemplate('preop_review', 'stsg');
    const c = completeness(t, {});
    expect(c.total).toBeGreaterThan(10);
    expect(c.done).toBe(0);
  });

  it('builds a PDF', () => {
    const t = buildTemplate('preop_review', 'melanoma');
    const a = { indication: { diagnosis: 'Acral melanoma, right heel' }, procedure: { breslow: '> 4.0 mm', nodes: 'Palpable nodes' } };
    const doc = buildTemplatePdf(t, { ...emptyTemplateData(t), answers: a, plan: buildPlan(t, a, []) }, { patientName: 'Test Patient', hospitalNumber: 'PT-1', author: 'Dr A' });
    expect(doc.getNumberOfPages()).toBeGreaterThan(0);
  });

  it('the server accepts the new encounter types', () => {
    for (const k of REVIEW_KINDS) expect(ENCOUNTER_TYPES).toContain(k.kind);
  });
});

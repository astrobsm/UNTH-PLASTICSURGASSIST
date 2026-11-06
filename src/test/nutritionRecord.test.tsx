/**
 * Patient nutrition record helpers and the profile panel: measurements flow
 * into the assessment, the result is saved with its traceable working, the
 * overview shows due reassessment and alerts, plans are built from targets.
 */
import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { assessNutrition, buildInputs, intakePctSeries, nitrogenSeries, patientStatus, plannerOptionsFrom, assessmentSummary } from '../clinical/nutrition';

const meas = [
  { id: 1, kind: 'weight', value: 50, unit: 'kg', method: 'measured', measured_at: '2026-10-01T08:00:00Z', source: 'nutrition' as const },
  { id: 2, kind: 'height', value: 170, unit: 'cm', method: null, measured_at: '2026-10-01T08:00:00Z', source: 'nutrition' as const },
  { id: 3, kind: 'muac', value: 24, unit: 'cm', measured_at: '2026-10-01T08:00:00Z', source: 'nutrition' as const },
  { id: 4, kind: 'muac', value: 22.5, unit: 'cm', measured_at: '2026-10-20T08:00:00Z', source: 'nutrition' as const },
  { id: 5, kind: 'uun', value: 12, unit: 'g/day', measured_at: '2026-10-20T08:00:00Z', source: 'nutrition' as const },
];
const ctx = { ageYears: 45, sex: 'Male', allergies: 'Groundnut; NKDA' };

describe('record helpers', () => {
  it('buildInputs merges measurements, answers and patient allergies', () => {
    const i = buildInputs(meas as any, { goal: 'gain' }, ctx);
    expect(i.weightKg).toBe(50);
    expect(i.muacCm).toBe(22.5);
    expect(i.sex).toBe('male');
    expect(i.dietary?.allergies).toEqual(['Groundnut']);
    expect(i.goal).toBe('gain');
  });
  it('intake % and nitrogen balance series', () => {
    const intake = [{ intake_date: '2026-10-20', meal: 'lunch', kcal: 600, protein_g: 40, target_kcal: 2000 }, { intake_date: '2026-10-20', meal: 'dinner', kcal: 400, protein_g: 35, target_kcal: 2000 }];
    expect(intakePctSeries(intake, null)).toEqual([{ date: '2026-10-20', value: 50 }]);
    expect(nitrogenSeries(meas as any, intake)).toEqual([{ date: '2026-10-20', value: -4 }]); // 75/6.25 − (12 + 4)
  });
  it('patient status: no assessment → due; MUAC fall → alert; stale coefficients → recalculate', () => {
    const s0 = patientStatus({ measurements: meas as any, intake: [], assessments: [] }, ctx, new Date('2026-10-21'));
    expect(s0.due).toMatch(/No nutrition assessment/);
    expect(s0.alerts.some(a => a.id === 'muac_drop')).toBe(true);
    const result = assessNutrition(buildInputs(meas as any, {}, ctx), undefined, new Date('2026-10-20'));
    const row = { id: 1, status: 'approved', created_at: '2026-10-01T00:00:00Z', inputs: { answers: {} }, result, summary: assessmentSummary(result), config_version: '0.9.0' };
    const s1 = patientStatus({ measurements: meas as any, intake: [], assessments: [row] }, ctx, new Date('2026-10-21'));
    expect(s1.due).toMatch(/coefficients 0.9.0/);
  });
  it('planner options carry targets, carb cap, sodium cap and the refeeding schedule', () => {
    const r = assessNutrition({ ageYears: 40, sex: 'female', heightCm: 160, weightKg: 38, weightLossPct3to6m: 18, daysLittleOrNoIntake: 12, diabetes: true, heartFailure: true, goal: 'gain' });
    const o = plannerOptionsFrom(r, 'p1')!;
    expect(o.targets.kcal).toBe(r.targets.kcal);
    expect(o.targets.carbMaxG).toBeGreaterThan(0);
    expect(o.targets.sodiumMaxMg).toBe(2000);
    expect(o.dailyKcal?.[0]).toBe(r.refeeding.schedule[0].kcal);
    expect(o.dailyKcal).toHaveLength(7);
    expect(plannerOptionsFrom(assessNutrition({ ageYears: 16, sex: 'male', heightCm: 170, weightKg: 60 }), 'x')).toBeNull();
  });
});

const saveAssessment = vi.fn(async (x: any) => ({ ...x, id: 7, version: 1, status: 'draft', created_at: new Date().toISOString() }));
vi.mock('../services/nutritionService', () => ({
  nutritionService: {
    patient: vi.fn(async () => ({ measurements: meas, assessments: [], meal_plans: [], intake: [], can_approve: false, can_draft: true, can_admin_foods: false })),
    saveAssessment: (x: any) => saveAssessment(x),
    submit: vi.fn(async (_k: string, id: number) => ({ id, version: 2, status: 'pending_review', created_at: new Date().toISOString() })),
    approve: vi.fn(), addMeasurement: vi.fn(), catalog: vi.fn(), savePlan: vi.fn(), saveIntake: vi.fn(),
  },
}));
vi.mock('react-hot-toast', () => ({ default: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn() }) }));
vi.mock('react-chartjs-2', () => ({ Line: () => null }));

import { PatientNutritionPanel } from '../components/nutrition/PatientNutritionPanel';

describe('PatientNutritionPanel', () => {
  it('overview asks for an assessment; the form uses measurements and saves the traceable result', async () => {
    render(<PatientNutritionPanel patientId="1" ctx={ctx} />);
    await waitFor(() => expect(screen.getAllByText(/No nutrition assessment yet/).length).toBeGreaterThan(0));
    expect(screen.getAllByText(/MUAC down/).length).toBeGreaterThan(0);
    fireEvent.click(screen.getByText('Assessment'));
    expect(screen.getByText('17.3')).toBeTruthy(); // BMI 50 / 1.7²
    fireEvent.click(screen.getByText('Submit for approval'));
    await waitFor(() => expect(saveAssessment).toHaveBeenCalled());
    const body = saveAssessment.mock.calls[0][0];
    expect(body.config_version).toBe('1.0.0');
    expect(body.result.bmi.value).toBe(17.3);
    expect(body.summary.must).toBe(2);
    expect(body.inputs.context.sex).toBe('Male');
  });
});

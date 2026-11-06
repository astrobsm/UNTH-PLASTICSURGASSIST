/**
 * Nutrition assessment. Measurements and labs come from the patient's record
 * (Measurements tab, vitals chart, lab orders); this form adds the clinical
 * picture, intake history, SGA, goal and diet, recalculates live and saves the
 * inputs together with the full traceable result.
 */
import { useEffect, useMemo, useState } from 'react';
import { Save, Send, ShieldCheck } from 'lucide-react';
import toast from 'react-hot-toast';
import { assessNutrition, NUTRITION_CONFIG, assessmentSummary, buildInputs, diffAssessments, type NutritionAssessment, type PatientContext } from '../../clinical/nutrition';
import type { NutritionInputs } from '../../clinical/nutrition/types';
import type { StoredMeasurement } from '../../clinical/nutrition/fromRecord';
import { nutritionService, type NutritionAssessmentRecord } from '../../services/nutritionService';
import { AssessmentResultView } from './AssessmentResultView';
import { Check, clean, Num, Section, Sel, StatusBadge, Txt } from './fields';

const draftKey = (pid: string) => `nutrition-assessment-draft:${pid}`;
const list = (s?: string) => (s || '').split(/[,;]+/).map(x => x.trim()).filter(Boolean);

export function NutritionAssessmentForm({ patientId, ctx, measurements, previous, canApprove, canDraft, onSaved }: {
  patientId: string; ctx: PatientContext; measurements: StoredMeasurement[]; previous: NutritionAssessmentRecord | null;
  canApprove: boolean; canDraft: boolean; onSaved: () => void;
}) {
  const [a, setA] = useState<Partial<NutritionInputs>>(() => {
    try { const d = localStorage.getItem(draftKey(patientId)); if (d) return JSON.parse(d); } catch { /* blocked storage */ }
    return previous?.inputs?.answers ?? {};
  });
  const [rec, setRec] = useState<NutritionAssessmentRecord | null>(previous && ['draft', 'pending_review'].includes(previous.status) ? previous : null);
  const [busy, setBusy] = useState(false);
  useEffect(() => { try { localStorage.setItem(draftKey(patientId), JSON.stringify(a)); } catch { /* blocked storage */ } }, [a, patientId]);

  const set = <K extends keyof NutritionInputs>(k: K, v: NutritionInputs[K]) => setA(p => ({ ...p, [k]: v }));
  const setDiet = (k: keyof NonNullable<NutritionInputs['dietary']>, v: any) => setA(p => ({ ...p, dietary: { ...(p.dietary || {}), [k]: v } }));
  const setSga = (k: keyof NonNullable<NutritionInputs['sga']>, v: any) => setA(p => ({ ...p, sga: { ...(p.sga || {}), [k]: v } }));

  const inputs = useMemo(() => buildInputs(measurements, a, ctx), [measurements, a, ctx]);
  const result = useMemo(() => assessNutrition(inputs), [inputs]);
  const changes = useMemo(() => (previous?.result?.targets ? diffAssessments(previous.result as NutritionAssessment, result) : []), [previous, result]);

  const save = async (then?: 'submit' | 'approve') => {
    setBusy(true);
    try {
      let r = await nutritionService.saveAssessment({
        id: rec?.id, version: rec?.version, patient_id: patientId, config_version: NUTRITION_CONFIG.version,
        inputs: { answers: a, context: ctx }, result, summary: assessmentSummary(result),
      });
      if (then === 'submit') r = await nutritionService.submit('assessment', r.id, r.version);
      if (then === 'approve') r = await nutritionService.approve('assessment', r.id, r.version);
      setRec(r.status === 'approved' ? null : r);
      try { localStorage.removeItem(draftKey(patientId)); } catch { /* blocked storage */ }
      toast.success(then === 'approve' ? 'Assessment approved' : then === 'submit' ? 'Submitted for approval' : 'Draft saved');
      onSaved();
    } catch (e) { toast.error(clean(e)); } finally { setBusy(false); }
  };

  const yes = (v: any) => !!v;
  return (
    <div className="space-y-3">
      {rec && <p className="text-sm">Editing <StatusBadge status={rec.status} /> assessment from {new Date(rec.created_at).toLocaleString()}</p>}
      <Section title="Scope" hint="Children, pregnancy, lactation, dialysis and parenteral nutrition are outside this tool and need specialist input.">
        <Check label="Pregnant" value={a.pregnant} onChange={v => set('pregnant', v)} />
        <Check label="Lactating" value={a.lactating} onChange={v => set('lactating', v)} />
        <Check label="Dialysis-dependent" value={a.dialysis} onChange={v => set('dialysis', v)} />
        <Check label="On parenteral nutrition" value={a.parenteral} onChange={v => set('parenteral', v)} />
        <Sel label="Reference population (equations)" value={a.population} options={[['black', 'Black African (default)'], ['white', 'White']]} onChange={v => set('population', v)} />
      </Section>

      <Section title="Clinical state">
        <Check label="ICU / HDU" value={a.icu} onChange={v => set('icu', v)} />
        <Check label="Ventilated" value={a.ventilated} onChange={v => set('ventilated', v)} />
        {a.ventilated && <Num label="Minute ventilation" unit="L/min" value={a.minuteVentilationL} onChange={v => set('minuteVentilationL', v)} />}
        <Num label="Maximum temperature (24 h)" unit="°C" value={a.tMaxC} onChange={v => set('tMaxC', v)} />
        <Check label="Sepsis / SIRS" value={a.sepsis} onChange={v => set('sepsis', v)} />
        <Check label="Diabetes" value={a.diabetes} onChange={v => set('diabetes', v)} />
        <Check label="CKD (not on dialysis)" value={a.ckd} onChange={v => set('ckd', v)} />
        <Check label="Liver disease" value={a.liverDisease} onChange={v => set('liverDisease', v)} />
        <Check label="Heart failure" value={a.heartFailure} onChange={v => set('heartFailure', v)} />
        <Check label="GI dysfunction (vomiting, diarrhoea, ileus, fistula)" value={a.giDysfunction} onChange={v => set('giDysfunction', v)} />
        <Check label="Malabsorption" value={a.malabsorption} onChange={v => set('malabsorption', v)} />
        <Sel label="Mobility" value={a.mobility} options={[['bedbound', 'Bed-bound'], ['chair', 'Chair / limited'], ['ambulatory', 'Ambulatory']]} onChange={v => set('mobility', v)} />
        <Sel label="Metabolic stress" value={a.stress} options={[['none', 'None'], ['minor_surgery', 'Minor surgery'], ['major_surgery', 'Major surgery'], ['infection', 'Infection'], ['sepsis', 'Sepsis'], ['multiple_trauma', 'Multiple trauma'], ['burns', 'Burns']]} onChange={v => set('stress', v)} />
        <Num label="Burn" unit="% TBSA" value={a.tbsaPct} onChange={v => set('tbsaPct', v)} />
        <Num label="Days since injury / surgery / ICU admission" unit="days" value={a.daysSinceInjury} onChange={v => set('daysSinceInjury', v)} />
        <Num label="Open wound area" unit="cm²" value={a.woundAreaCm2} onChange={v => set('woundAreaCm2', v)} />
        <Sel label="Wound exudate" value={a.exudate} options={[['none', 'None'], ['low', 'Low'], ['moderate', 'Moderate'], ['high', 'High']]} onChange={v => set('exudate', v)} />
        <Sel label="NRS-2002 disease severity" value={a.nrsSeverity === undefined ? undefined : String(a.nrsSeverity) as any}
          options={[['0', '0 — normal requirement'], ['1', '1 — chronic disease, hip fracture, oncology'], ['2', '2 — major abdominal surgery, stroke, severe pneumonia'], ['3', '3 — head injury, BMT, ICU (APACHE > 10)']]}
          onChange={v => set('nrsSeverity', v === undefined ? undefined : (Number(v) as any))} />
        {a.icu && <>
          <Num label="APACHE II" value={a.apache2} onChange={v => set('apache2', v)} />
          <Num label="SOFA" value={a.sofa} onChange={v => set('sofa', v)} />
          <Num label="Comorbidities" unit="count" value={a.comorbidityCount} onChange={v => set('comorbidityCount', v)} />
          <Num label="Days from hospital to ICU admission" unit="days" value={a.daysHospitalToIcu} onChange={v => set('daysHospitalToIcu', v)} />
          <Num label="IL-6 (if available)" unit="pg/mL" value={a.il6} onChange={v => set('il6', v)} />
        </>}
      </Section>

      <Section title="Weight and body composition" hint="Weights, heights, MUAC, calf, grip and labs are taken from the Measurements tab, the vitals chart and lab orders.">
        <Sel label="Weight today" value={a.weightMethod === 'unavailable' ? 'unavailable' : undefined} options={[['unavailable', 'Cannot be weighed — estimate']]} onChange={v => set('weightMethod', v as any)} />
        <Num label="Unplanned weight loss in 3–6 months (if no weight history)" unit="%" value={a.weightLossPct3to6m} onChange={v => set('weightLossPct3to6m', v)} />
        <Sel label="Oedema" value={a.oedema} options={[['none', 'None'], ['mild', 'Mild'], ['moderate', 'Moderate'], ['severe', 'Severe']]} onChange={v => set('oedema', v)} />
        <Sel label="Ascites" value={a.ascites} options={[['none', 'None'], ['mild', 'Mild'], ['moderate', 'Moderate'], ['severe', 'Severe']]} onChange={v => set('ascites', v)} />
        <Sel label="Muscle mass (clinical / US)" value={a.muscleMass} options={[['normal', 'Normal'], ['mild_moderate', 'Mild–moderate deficit'], ['severe', 'Severe deficit']]} onChange={v => set('muscleMass', v)} />
        <label className="text-sm col-span-2"><span className="text-gray-600">Amputations</span>
          <div className="flex flex-wrap gap-2 mt-1">{(['hand', 'forearm_and_hand', 'whole_arm', 'foot', 'below_knee', 'whole_leg'] as const).map(s => (
            <label key={s} className="flex items-center gap-1 text-xs"><input type="checkbox" checked={!!a.amputations?.includes(s)}
              onChange={e => set('amputations', e.target.checked ? [...(a.amputations || []), s] : (a.amputations || []).filter(x => x !== s))} />{s.replace(/_/g, ' ')}</label>))}</div></label>
      </Section>

      <Section title="Intake and refeeding">
        <Num label="Current intake" unit="% of needs" value={a.intakePctOfNeeds} onChange={v => set('intakePctOfNeeds', v)} />
        <Num label="Days of little or no intake" unit="days" value={a.daysLittleOrNoIntake} onChange={v => set('daysLittleOrNoIntake', v)} />
        <Check label="Acutely ill with no intake for > 5 days (MUST)" value={a.acutelyIllNoIntake5d} onChange={v => set('acutelyIllNoIntake5d', v)} />
        {yes(a.tbsaPct) && <Num label="Energy intake previous 24 h (Toronto)" unit="kcal" value={a.previousDayKcal} onChange={v => set('previousDayKcal', v)} />}
        <Check label="Alcohol misuse" value={a.alcoholMisuse} onChange={v => set('alcoholMisuse', v)} />
        <Check label="Insulin, chemotherapy, antacids or diuretics" value={a.refeedingDrugs} onChange={v => set('refeedingDrugs', v)} />
      </Section>

      <Section title="Subjective Global Assessment" hint="Your global rating stands; the engine suggests one from the components.">
        <Sel label="Weight change (6 months)" value={a.sga?.weightChange} options={[['none', 'None / regained'], ['loss_lt5', 'Loss < 5%'], ['loss_5_10', 'Loss 5–10%'], ['loss_gt10', 'Loss > 10%']]} onChange={v => setSga('weightChange', v)} />
        <Sel label="Dietary intake" value={a.sga?.intake} options={[['normal', 'Normal'], ['suboptimal', 'Suboptimal'], ['starvation', 'Starvation / liquids only']]} onChange={v => setSga('intake', v)} />
        <Sel label="GI symptoms" value={a.sga?.giSymptoms} options={[['none', 'None'], ['intermittent', 'Intermittent'], ['daily_gt2wk', 'Daily > 2 weeks']]} onChange={v => setSga('giSymptoms', v)} />
        <Sel label="Functional capacity" value={a.sga?.function} options={[['full', 'Full'], ['reduced', 'Reduced'], ['bedridden', 'Bedridden']]} onChange={v => setSga('function', v)} />
        <Sel label="Subcutaneous fat loss" value={a.sga?.fatLoss} options={[['none', 'None'], ['mild', 'Mild'], ['moderate', 'Moderate'], ['severe', 'Severe']]} onChange={v => setSga('fatLoss', v)} />
        <Sel label="Muscle wasting" value={a.sga?.muscleWasting} options={[['none', 'None'], ['mild', 'Mild'], ['moderate', 'Moderate'], ['severe', 'Severe']]} onChange={v => setSga('muscleWasting', v)} />
        <Sel label="Oedema (SGA)" value={a.sga?.oedema} options={[['none', 'None'], ['mild', 'Mild'], ['moderate', 'Moderate'], ['severe', 'Severe']]} onChange={v => setSga('oedema', v)} />
        <Sel label="Clinician SGA rating" value={a.sga?.rating} options={[['A', 'A — well nourished'], ['B', 'B — moderately malnourished'], ['C', 'C — severely malnourished']]} onChange={v => setSga('rating', v)} />
      </Section>

      <Section title="Goal">
        <Sel label="Weight goal" value={a.goal} options={[['maintain', 'Maintain / meet needs'], ['gain', 'Controlled gain'], ['lose', 'Controlled loss']]} onChange={v => set('goal', v)} />
        {a.goal && a.goal !== 'maintain' && <Num label="Target rate" unit="kg/week" value={a.targetRateKgWk} onChange={v => set('targetRateKgWk', v)} />}
        {a.goal === 'lose' && <Txt label="Override: below kcal floor (reason)" value={a.override?.belowFloor} onChange={v => set('override', { ...(a.override || {}), belowFloor: v || undefined })} />}
        {a.goal === 'lose' && <Txt label="Override: loss while catabolic (reason)" value={a.override?.lossWhileCatabolic} onChange={v => set('override', { ...(a.override || {}), lossWhileCatabolic: v || undefined })} />}
      </Section>

      <Section title="Diet">
        <Sel label="Texture" value={a.dietary?.texture} options={[['normal', 'Normal'], ['soft', 'Soft & bite-sized'], ['minced_moist', 'Minced & moist'], ['pureed', 'Puréed'], ['liquid', 'Liquid']]} onChange={v => setDiet('texture', v)} />
        <Sel label="Feeding route" value={a.dietary?.route} options={[['oral', 'Oral'], ['oral_ons', 'Oral + supplements'], ['enteral', 'Enteral tube']]} onChange={v => setDiet('route', v)} />
        <Sel label="Household food budget" value={a.dietary?.budget} options={[['low', 'Low'], ['medium', 'Medium'], ['high', 'High']]} onChange={v => setDiet('budget', v)} />
        <Sel label="Meals prepared by" value={a.dietary?.mealsBy} options={[['hospital', 'Hospital kitchen'], ['family', 'Family']]} onChange={v => setDiet('mealsBy', v)} />
        <Txt label="Allergies / intolerances (comma-separated)" value={(a.dietary?.allergies ?? inputs.dietary?.allergies ?? []).join(', ')} onChange={v => setDiet('allergies', list(v))} />
        <Txt label="Religious / cultural restrictions" placeholder="e.g. vegetarian, no beef" value={(a.dietary?.religious || []).join(', ')} onChange={v => setDiet('religious', list(v))} />
        <Txt label="Food preferences" value={(a.dietary?.preferences || []).join(', ')} onChange={v => setDiet('preferences', list(v))} />
      </Section>

      <div className="border-t pt-3">
        <h3 className="font-medium mb-2">Result</h3>
        <AssessmentResultView a={result} selectedEnergy={a.energyMethod} onSelectEnergy={id => set('energyMethod', id)} />
      </div>
      {!!changes.length && (
        <div className="bg-blue-50 border border-blue-200 rounded p-2 text-sm">
          <div className="font-medium text-blue-900">What changed since the last assessment</div>
          <ul className="list-disc pl-5 text-blue-900">{changes.map(c => <li key={c.what}>{c.what}: {c.from} → {c.to}{c.why.length ? ` (${c.why.join(', ')})` : ''}</li>)}</ul>
        </div>
      )}
      {canDraft && (
        <div className="flex flex-wrap gap-2 justify-end sticky bottom-0 bg-white py-2 border-t">
          <button disabled={busy} onClick={() => save()} className="px-3 py-1.5 border rounded text-sm flex items-center gap-1"><Save className="w-4 h-4" />Save draft</button>
          {!canApprove && <button disabled={busy} onClick={() => save('submit')} className="px-3 py-1.5 rounded bg-amber-600 text-white text-sm flex items-center gap-1"><Send className="w-4 h-4" />Submit for approval</button>}
          {canApprove && <button disabled={busy} onClick={() => save('approve')} className="px-3 py-1.5 rounded bg-emerald-600 text-white text-sm flex items-center gap-1"><ShieldCheck className="w-4 h-4" />Approve</button>}
        </div>
      )}
    </div>
  );
}

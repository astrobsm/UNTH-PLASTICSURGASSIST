// Coerce a model's critical-care review into the specification's schema:
// every key present, enums clamped, strings bounded, arrays capped. Anything
// malformed becomes an empty value rather than reaching the clinician as
// garbage. The disclaimer is always the specification's text.
export const CC_DISCLAIMER = 'Decision support only. A qualified clinician must verify all calculations, doses and orders before acting.';

const str = (v, max = 2000) => (v == null ? '' : String(typeof v === 'object' ? JSON.stringify(v) : v).slice(0, max));
const num = (v) => { const n = typeof v === 'number' ? v : parseFloat(String(v ?? '').replace(/[^0-9.+-]/g, '')); return Number.isFinite(n) ? n : null; };
const bool = (v) => (typeof v === 'boolean' ? v : v === 'true' ? true : v === 'false' ? false : null);
const arr = (v, max = 60) => (Array.isArray(v) ? v.slice(0, max) : []);
const strs = (v, max = 60, len = 600) => arr(v, max).map(x => str(x, len)).filter(Boolean);
const oneOf = (v, allowed, fallback) => { const s = String(v ?? '').toLowerCase().trim(); return allowed.includes(s) ? s : fallback; };
const obj = (v) => (v && typeof v === 'object' && !Array.isArray(v) ? v : {});
const resultVal = (v) => (typeof v === 'number' && Number.isFinite(v) ? v : v == null ? null : str(v, 400));

export function normaliseCriticalReview(raw) {
  const r = obj(raw);
  const dq = obj(r.data_quality), rf = obj(r.renal_function), ab = obj(r.acid_base), p = obj(r.plan), fl = obj(p.fluids), conf = obj(r.confidence);
  return {
    critical_alerts: arr(r.critical_alerts, 30).map(a => ({ finding: str(a?.finding, 400), severity: oneOf(a?.severity, ['critical', 'high'], 'high'), action: str(a?.action, 1000), timeframe: str(a?.timeframe, 100) })).filter(a => a.finding),
    data_quality: { missing_essential: strs(dq.missing_essential), implausible_values: strs(dq.implausible_values), assumptions: strs(dq.assumptions) },
    clinical_summary: str(r.clinical_summary, 4000),
    calculations: arr(r.calculations, 80).map(c => ({
      name: str(c?.name, 200), inputs: obj(c?.inputs), formula: str(c?.formula, 600), result: resultVal(c?.result), unit: str(c?.unit, 60),
      interpretation: str(c?.interpretation, 1000), app_value_agrees: bool(c?.app_value_agrees), caveats: str(c?.caveats, 600),
    })).filter(c => c.name),
    renal_function: {
      creatinine_umol_l: num(rf.creatinine_umol_l), egfr_ckd_epi_2021: num(rf.egfr_ckd_epi_2021), crcl_cockcroft_gault: num(rf.crcl_cockcroft_gault),
      weight_used: oneOf(rf.weight_used, ['actual', 'ideal', 'adjusted'], ''), ckd_stage: str(rf.ckd_stage, 200), aki_stage: str(rf.aki_stage, 300),
      steady_state: bool(rf.steady_state), dosing_band: str(rf.dosing_band, 100), interpretation: str(rf.interpretation, 1500), dialysis_indications: strs(rf.dialysis_indications, 10),
    },
    acid_base: {
      primary_disorder: str(ab.primary_disorder, 300), compensation: str(ab.compensation, 300), anion_gap: num(ab.anion_gap), corrected_anion_gap: num(ab.corrected_anion_gap),
      delta_ratio: num(ab.delta_ratio), osmolar_gap: num(ab.osmolar_gap), interpretation: str(ab.interpretation, 1500),
    },
    organ_systems: arr(r.organ_systems, 15).map(o => ({ system: str(o?.system, 100), status: oneOf(o?.status, ['stable', 'at risk', 'failing'], 'at risk'), findings: strs(o?.findings, 20, 300) })).filter(o => o.system),
    scores: arr(r.scores, 20).map(s => ({ name: str(s?.name, 80), value: str(s?.value, 80), complete: bool(s?.complete) ?? false, missing: strs(s?.missing, 20, 100), interpretation: str(s?.interpretation, 600) })).filter(s => s.name),
    medication_review: arr(r.medication_review, 60).map(m => ({
      drug: str(m?.drug, 200), class: str(m?.class, 200), mechanism: str(m?.mechanism, 600), indication_ok: bool(m?.indication_ok), dose_assessment: str(m?.dose_assessment, 1000),
      renal_adjustment: str(m?.renal_adjustment, 800), hepatic_adjustment: str(m?.hepatic_adjustment, 800), adverse_effects_in_this_patient: strs(m?.adverse_effects_in_this_patient, 20, 400),
      duration_assessment: str(m?.duration_assessment, 600),
      interactions: arr(m?.interactions, 30).map(i => ({ with: str(i?.with, 200), severity: oneOf(i?.severity, ['contraindicated', 'major', 'moderate', 'minor'], 'moderate'), mechanism: str(i?.mechanism, 500), management: str(i?.management, 500) })).filter(i => i.with),
      tdm: str(m?.tdm, 400), recommendation: oneOf(m?.recommendation, ['continue', 'adjust', 'hold', 'stop', 'substitute'], 'continue'), details: str(m?.details, 1500),
    })).filter(m => m.drug),
    missing_indicated_therapy: arr(r.missing_indicated_therapy, 20).map(x => ({ therapy: str(x?.therapy, 200), reason: str(x?.reason, 600) })).filter(x => x.therapy),
    differential_diagnosis: arr(r.differential_diagnosis, 15).map((d, i) => ({
      rank: num(d?.rank) ?? i + 1, diagnosis: str(d?.diagnosis, 300), likelihood: oneOf(d?.likelihood, ['high', 'moderate', 'low'], 'moderate'), cant_miss: bool(d?.cant_miss) ?? false,
      supporting: strs(d?.supporting, 20, 300), against: strs(d?.against, 20, 300), next_test: str(d?.next_test, 400),
    })).filter(d => d.diagnosis),
    plan: {
      immediate: strs(p.immediate, 30, 1000),
      investigations: arr(p.investigations, 40).map(x => ({ test: str(x?.test, 200), priority: oneOf(x?.priority, ['urgent', 'today', 'routine'], 'today'), rationale: str(x?.rationale, 600) })).filter(x => x.test),
      medications: arr(p.medications, 40).map(x => ({
        action: oneOf(x?.action, ['start', 'stop', 'adjust', 'hold'], 'adjust'), drug: str(x?.drug, 200), dose: str(x?.dose, 300), route: str(x?.route, 60), frequency: str(x?.frequency, 100),
        duration: str(x?.duration, 100), calculation: str(x?.calculation, 800), rationale: str(x?.rationale, 800),
      })).filter(x => x.drug),
      electrolyte_corrections: arr(p.electrolyte_corrections, 20).map(x => ({
        abnormality: str(x?.abnormality, 200), current_value: str(x?.current_value, 100), severity: str(x?.severity, 60), target: str(x?.target, 300), calculation: str(x?.calculation, 1200),
        prescription: str(x?.prescription, 1500), rate_ml_per_h: num(x?.rate_ml_per_h), duration_h: num(x?.duration_h), max_safe_rate: str(x?.max_safe_rate, 500), recheck: str(x?.recheck, 400), stop_when: str(x?.stop_when, 400),
      })).filter(x => x.abnormality),
      fluids: { assessment: str(fl.assessment, 1000), prescription: str(fl.prescription, 1200), rate_ml_per_h: num(fl.rate_ml_per_h), reassess: str(fl.reassess, 400) },
      monitoring: arr(p.monitoring, 30).map(x => ({ parameter: str(x?.parameter, 200), frequency: str(x?.frequency, 200), target: str(x?.target, 300) })).filter(x => x.parameter),
      escalation: strs(p.escalation, 20, 600),
      resource_limited_alternatives: strs(p.resource_limited_alternatives, 20, 600),
    },
    confidence: { overall: oneOf(conf.overall, ['high', 'moderate', 'low'], 'low'), limitations: strs(conf.limitations, 20, 400) },
    disclaimer: CC_DISCLAIMER,
  };
}

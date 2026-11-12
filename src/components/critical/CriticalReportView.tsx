/** Renders a critical-care review report (rule-based or AI) — every section of the specification. */
import { AlertOctagon, AlertTriangle } from 'lucide-react';
import type { CcReport } from '../../clinical/critical/types';

const tone = (s: string) => (s === 'failing' || s === 'critical' || s === 'contraindicated' || s === 'urgent' ? 'text-red-700' : s === 'at risk' || s === 'high' || s === 'major' || s === 'today' ? 'text-amber-700' : 'text-gray-700');
const H = ({ children }: { children: React.ReactNode }) => <h4 className="font-semibold text-gray-900 mt-4 mb-1 text-sm uppercase tracking-wide">{children}</h4>;
const List = ({ xs }: { xs: string[] }) => (xs.length ? <ul className="list-disc pl-5 text-sm space-y-0.5">{xs.map((x, i) => <li key={i}>{x}</li>)}</ul> : <p className="text-sm text-gray-400">None</p>);
const fmt = (v: unknown) => (v == null || v === '' ? '—' : typeof v === 'object' ? JSON.stringify(v) : String(v));

export function CriticalReportView({ r }: { r: CcReport }) {
  return (
    <div className="text-sm">
      {r.critical_alerts.length > 0 && (
        <div className="bg-red-50 border border-red-300 rounded-lg p-3 space-y-1.5">
          <div className="font-semibold text-red-800 flex items-center gap-1"><AlertOctagon className="w-4 h-4" />Critical alerts</div>
          {r.critical_alerts.map((a, i) => (
            <div key={i}><b className={a.severity === 'critical' ? 'text-red-800' : 'text-amber-800'}>{a.finding}</b> — {a.action} <span className="text-xs text-gray-600">({a.timeframe})</span></div>
          ))}
        </div>
      )}
      <p className="mt-3 leading-relaxed">{r.clinical_summary}</p>
      {(r.data_quality.missing_essential.length > 0 || r.data_quality.implausible_values.length > 0) && (
        <div className="mt-2 bg-amber-50 border border-amber-200 rounded p-2 text-xs space-y-1">
          {r.data_quality.implausible_values.map((x, i) => <div key={`i${i}`} className="text-red-700 flex gap-1"><AlertTriangle className="w-3.5 h-3.5 shrink-0" />{x}</div>)}
          {r.data_quality.missing_essential.map((x, i) => <div key={`m${i}`}>Missing: {x}</div>)}
          {r.data_quality.assumptions.map((x, i) => <div key={`a${i}`} className="text-gray-600">Assumption: {x}</div>)}
        </div>
      )}

      <H>Renal function</H>
      <p>Creatinine {fmt(r.renal_function.creatinine_umol_l)} µmol/L · eGFR {fmt(r.renal_function.egfr_ckd_epi_2021)} · CrCl {fmt(r.renal_function.crcl_cockcroft_gault)} mL/min ({r.renal_function.weight_used || '—'} weight) · {r.renal_function.ckd_stage || '—'} · {r.renal_function.aki_stage || '—'} · dosing band {r.renal_function.dosing_band || '—'}</p>
      <p className="text-gray-600">{r.renal_function.interpretation}</p>
      {r.renal_function.dialysis_indications.length > 0 && <div className="text-red-700"><b>Dialysis indications:</b> {r.renal_function.dialysis_indications.join('; ')}</div>}

      <H>Acid–base</H>
      <p>{r.acid_base.primary_disorder || '—'} · compensation {r.acid_base.compensation || '—'} · AG {fmt(r.acid_base.anion_gap)} (corrected {fmt(r.acid_base.corrected_anion_gap)}) · delta ratio {fmt(r.acid_base.delta_ratio)} · osmolar gap {fmt(r.acid_base.osmolar_gap)}</p>
      <p className="text-gray-600">{r.acid_base.interpretation}</p>

      <H>Calculations</H>
      <div className="overflow-x-auto">
        <table className="min-w-full text-xs border">
          <thead className="bg-gray-50"><tr><th className="p-1 text-left">Name</th><th className="p-1 text-left">Inputs</th><th className="p-1 text-left">Formula</th><th className="p-1 text-left">Result</th><th className="p-1 text-left">Interpretation</th></tr></thead>
          <tbody className="divide-y">{r.calculations.map((c, i) => (
            <tr key={i} className="align-top">
              <td className="p-1 font-medium">{c.name}{c.app_value_agrees === false && <span className="block text-red-700">differs from app value</span>}</td>
              <td className="p-1 text-gray-600">{Object.entries(c.inputs || {}).map(([k, v]) => `${k}=${fmt(v)}`).join(', ')}</td>
              <td className="p-1 text-gray-600">{c.formula}</td>
              <td className="p-1 whitespace-pre-wrap">{fmt(c.result)} {c.unit}</td>
              <td className="p-1">{c.interpretation}{c.caveats ? <span className="block text-amber-700">{c.caveats}</span> : null}</td>
            </tr>))}</tbody>
        </table>
      </div>

      <H>Organ systems</H>
      <div className="grid sm:grid-cols-2 gap-1">{r.organ_systems.map((o, i) => <div key={i}><b className={tone(o.status)}>{o.system}: {o.status}</b> <span className="text-gray-600">{o.findings.join(', ')}</span></div>)}</div>

      <H>Scores</H>
      <div className="grid sm:grid-cols-2 gap-1">{r.scores.map((s, i) => <div key={i}><b>{s.name}</b> {s.value || '—'}{!s.complete && <span className="text-amber-700"> (incomplete{s.missing.length ? `: missing ${s.missing.join(', ')}` : ''})</span>} <span className="text-gray-600">{s.interpretation}</span></div>)}</div>

      <H>Medication review</H>
      {r.medication_review.length === 0 ? <p className="text-gray-400">No medications</p> : r.medication_review.map((m, i) => (
        <div key={i} className="border rounded p-2 mb-2">
          <div className="flex flex-wrap justify-between gap-2"><b>{m.drug}</b><span className={`uppercase text-xs font-semibold ${m.recommendation === 'continue' ? 'text-emerald-700' : 'text-red-700'}`}>{m.recommendation}</span></div>
          <div className="text-xs text-gray-600">{m.class} — {m.mechanism}</div>
          {m.adverse_effects_in_this_patient.length > 0 && <div className="text-xs text-red-700">In this patient: {m.adverse_effects_in_this_patient.join('; ')}</div>}
          {m.interactions.map((x, j) => <div key={j} className={`text-xs ${tone(x.severity)}`}>{x.severity.toUpperCase()} with {x.with}: {x.mechanism} — {x.management}</div>)}
          <div className="text-xs">Dose: {m.dose_assessment}</div>
          <div className="text-xs">Renal: {m.renal_adjustment}</div>
          {m.hepatic_adjustment && <div className="text-xs">Hepatic: {m.hepatic_adjustment}</div>}
          {m.duration_assessment && <div className="text-xs">Duration: {m.duration_assessment}</div>}
          {m.tdm && <div className="text-xs">TDM: {m.tdm}</div>}
          {m.details && <div className="text-xs text-gray-600">{m.details}</div>}
        </div>
      ))}
      {r.missing_indicated_therapy.length > 0 && <><H>Missing indicated therapy</H><List xs={r.missing_indicated_therapy.map(x => `${x.therapy} — ${x.reason}`)} /></>}

      <H>Differential diagnosis</H>
      {r.differential_diagnosis.map(d => (
        <div key={d.rank} className="mb-1"><b>{d.rank}. {d.diagnosis}</b> <span className={tone(d.likelihood === 'high' ? 'high' : '')}>({d.likelihood}{d.cant_miss ? ", can't miss" : ''})</span>
          <span className="text-gray-600"> For: {d.supporting.join(', ') || '—'}{d.against.length ? `; against: ${d.against.join(', ')}` : ''}. Next test: {d.next_test}</span></div>
      ))}

      <H>Plan</H>
      <div className="font-medium">Immediate</div><List xs={r.plan.immediate} />
      <div className="font-medium mt-2">Investigations</div>
      <List xs={r.plan.investigations.map(x => `[${x.priority}] ${x.test} — ${x.rationale}`)} />
      <div className="font-medium mt-2">Medication changes</div>
      <List xs={r.plan.medications.map(x => `${x.action.toUpperCase()} ${x.drug}${x.dose ? ` ${x.dose}` : ''}${x.route ? ` ${x.route}` : ''}${x.frequency ? ` ${x.frequency}` : ''} — ${x.rationale}${x.calculation ? ` (${x.calculation})` : ''}`)} />
      <div className="font-medium mt-2">Electrolyte corrections</div>
      {r.plan.electrolyte_corrections.length === 0 ? <p className="text-gray-400">None</p> : r.plan.electrolyte_corrections.map((c, i) => (
        <div key={i} className="border rounded p-2 mb-2 text-xs space-y-0.5">
          <div className="font-semibold text-sm">{c.abnormality} — {c.current_value} ({c.severity})</div>
          <div><b>Target:</b> {c.target}</div>{c.calculation && <div><b>Calculation:</b> {c.calculation}</div>}
          <div><b>Prescription:</b> {c.prescription}</div>
          {c.rate_ml_per_h != null && <div><b>Rate:</b> {c.rate_ml_per_h} mL/h{c.duration_h ? ` for ${c.duration_h} h` : ''}</div>}
          <div className="text-red-700"><b>Maximum safe rate / limits:</b> {c.max_safe_rate}</div>
          <div><b>Recheck:</b> {c.recheck}</div><div><b>Stop when:</b> {c.stop_when}</div>
        </div>
      ))}
      <div className="font-medium mt-2">Fluids</div>
      <p>{r.plan.fluids.assessment}</p><p><b>{r.plan.fluids.prescription}</b>{r.plan.fluids.rate_ml_per_h != null ? ` · ${r.plan.fluids.rate_ml_per_h} mL/h` : ''}</p><p className="text-gray-600">Reassess: {r.plan.fluids.reassess}</p>
      <div className="font-medium mt-2">Monitoring</div>
      <List xs={r.plan.monitoring.map(m => `${m.parameter}: ${m.frequency} — target ${m.target}`)} />
      <div className="font-medium mt-2">Escalation</div><List xs={r.plan.escalation} />
      <div className="font-medium mt-2">Resource-limited alternatives</div><List xs={r.plan.resource_limited_alternatives} />

      <H>Confidence</H>
      <p><b>{r.confidence.overall}</b> — {r.confidence.limitations.join('; ')}</p>
      <p className="mt-3 text-xs text-gray-600 border-t pt-2">{r.disclaimer}</p>
    </div>
  );
}

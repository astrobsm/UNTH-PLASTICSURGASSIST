/**
 * Scar monitoring, inside the keloid care plan.
 *
 * This is the join between the two halves of keloid work. The plan already
 * records what was done — the triamcinolone series, the surgery, the silicone,
 * the radiotherapy. This records what happened as a result, measured from
 * photographs and examinations, and puts the two on the same time axis so the
 * question "did the treatment work" has an answer rather than an impression.
 *
 * Nothing here duplicates the plan. Treatments come from keloid_injections.
 */

import { useState, useEffect, useCallback } from 'react';
import {
  Activity, Loader2, Plus, AlertTriangle, ChevronRight, ArrowLeft, Camera,
  CheckCircle2, Info, Lock, Bell, Check, Scan,
} from 'lucide-react';
import {
  scarService, SCAR_TYPES,
  type ScarCase, type ScarCaseDetail, type ScarType,
} from '../../services/scarService';
import { createWound } from '../../services/woundMonitorService';
import { TaxonomySelect } from '../wound/TaxonomySelect';
import { ANATOMICAL_SITES } from '../../data/woundTaxonomy';
import { ScarTrendChart } from './ScarTrendChart';
import { ScarAssessmentForm } from './ScarAssessmentForm';
import { KeloidStatusPanel } from './KeloidStatusPanel';

const VERDICT: Record<string, { cls: string; label: string }> = {
  consistent_progression: { cls: 'bg-red-50 border-red-200 text-red-900', label: 'Possible progression' },
  consistent_response: { cls: 'bg-green-50 border-green-200 text-green-900', label: 'Treatment response' },
  discordant: { cls: 'bg-amber-50 border-amber-200 text-amber-900', label: 'Discordance' },
  fluctuating: { cls: 'bg-amber-50 border-amber-200 text-amber-900', label: 'Fluctuating' },
  stable: { cls: 'bg-blue-50 border-blue-200 text-blue-900', label: 'Stable' },
  insufficient: { cls: 'bg-gray-50 border-gray-200 text-gray-700', label: 'Not enough data yet' },
};

interface Props {
  patientId: number | string;
  /** When present the scars are scoped to this keloid care plan. */
  planId?: number | null;
  hospitalNumber?: string;
  className?: string;
}

export function ScarMonitoringPanel({ patientId, planId, hospitalNumber, className = '' }: Props) {
  const [scars, setScars] = useState<ScarCase[]>([]);
  const [openId, setOpenId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [creating, setCreating] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const r = await scarService.list(planId ? { planId } : { patientId });
      setScars(r.scars);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load scar records.');
    } finally {
      setLoading(false);
    }
  }, [patientId, planId]);

  useEffect(() => { void load(); }, [load]);

  if (openId) {
    return <ScarDetail id={openId} onBack={() => { setOpenId(null); void load(); }} />;
  }

  return (
    <div className={`space-y-4 ${className}`}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="font-semibold text-gray-900 flex items-center gap-2">
            <Activity className="w-5 h-5 text-purple-600" /> Scar monitoring
          </h3>
          <p className="text-xs text-gray-500 mt-0.5">
            Measured from calibrated photographs, examination and the patient's own report —
            on the same timeline as the treatments in this plan
          </p>
        </div>
        <button
          onClick={() => setCreating(true)}
          className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-purple-600 text-white text-sm font-medium hover:bg-purple-700"
        >
          <Plus className="w-4 h-4" /> Add a scar
        </button>
      </div>

      {loading ? (
        <div className="flex items-center gap-2 text-sm text-gray-500 py-6">
          <Loader2 className="w-4 h-4 animate-spin" /> Loading…
        </div>
      ) : error ? (
        <div className="flex items-start gap-2 p-3 rounded-xl bg-red-50 border border-red-200 text-sm text-red-800">
          <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" /> {error}
        </div>
      ) : scars.length === 0 ? (
        <div className="bg-gray-50 border rounded-xl p-8 text-center">
          <Scan className="w-8 h-8 mx-auto text-gray-300 mb-2" />
          <p className="text-sm text-gray-600">No scar is being monitored yet.</p>
          <p className="text-xs text-gray-400 mt-1 max-w-md mx-auto">
            Add each keloid separately — they are followed on independent trajectories, and
            combining them into one measurement would hide the one that is growing.
          </p>
        </div>
      ) : (
        <ul className="space-y-2">
          {scars.map((s) => (
            <li key={s.id}>
              <button
                onClick={() => setOpenId(s.id)}
                className="w-full text-left bg-white border rounded-xl p-3.5 hover:border-purple-400 transition-colors flex items-center gap-3"
              >
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-gray-900 truncate">
                    {s.label || s.anatomical_site || 'Scar'}
                  </p>
                  <p className="text-xs text-gray-500 mt-0.5 truncate">
                    {s.scar_type ? s.scar_type.replace(/_/g, ' ') : 'type not set'}
                    {s.anatomical_site ? ` · ${s.anatomical_site}` : ''}
                    {` · ${s.assessment_count ?? 0} assessment${s.assessment_count === 1 ? '' : 's'}`}
                    {s.last_assessed_at
                      ? ` · last ${new Date(s.last_assessed_at).toLocaleDateString()}`
                      : ' · never assessed'}
                  </p>
                </div>
                {!!s.open_alerts && s.open_alerts > 0 && (
                  <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-red-100 text-red-700 text-xs font-medium shrink-0">
                    <Bell className="w-3 h-3" /> {s.open_alerts}
                  </span>
                )}
                <ChevronRight className="w-4 h-4 text-gray-300 shrink-0" />
              </button>
            </li>
          ))}
        </ul>
      )}

      {creating && (
        <NewScar
          patientId={patientId}
          planId={planId ?? null}
          hospitalNumber={hospitalNumber}
          onClose={() => setCreating(false)}
          onCreated={(id) => { setCreating(false); void load(); setOpenId(id); }}
        />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------

function ScarDetail({ id, onBack }: { id: number; onBack: () => void }) {
  const [data, setData] = useState<ScarCaseDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [assessing, setAssessing] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setData(await scarService.case(id));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load this scar.');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { void load(); }, [load]);

  const startVisit = async () => {
    if (busy) return;
    setBusy(true);
    setError('');
    try {
      const r = await scarService.openAssessment({ scarId: id, measurementMethod: 'clinician_traced' });
      setAssessing(r.assessment.id);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not open an assessment.');
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return <div className="flex items-center gap-2 text-sm text-gray-500 py-8">
      <Loader2 className="w-4 h-4 animate-spin" /> Loading…
    </div>;
  }
  if (!data) return <p className="text-sm text-red-700">{error || 'Not found.'}</p>;

  const v = VERDICT[data.multimodal.verdict] ?? VERDICT.insufficient;
  const openAlerts = data.alerts.filter((a) => !a.acknowledged_at);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <button onClick={onBack} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500" aria-label="Back">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="min-w-0 flex-1">
          <h3 className="font-semibold text-gray-900 truncate">
            {data.scar.label || data.scar.anatomical_site || 'Scar'}
          </h3>
          <p className="text-xs text-gray-500 truncate">
            {data.scar.scar_type?.replace(/_/g, ' ')}
            {data.scar.anatomical_site ? ` · ${data.scar.anatomical_site}` : ''}
            {` · ${data.visits.length} assessment${data.visits.length === 1 ? '' : 's'}`}
          </p>
        </div>
        <button
          onClick={() => void startVisit()}
          disabled={busy}
          className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-purple-600 text-white text-sm font-medium hover:bg-purple-700 disabled:opacity-60"
        >
          <Plus className="w-4 h-4" /> New assessment
        </button>
      </div>

      {error && <p className="text-sm text-red-700">{error}</p>}

      {openAlerts.length > 0 && (
        <ul className="space-y-1.5">
          {openAlerts.map((a) => (
            <li key={a.id} className="flex items-start gap-2 p-3 rounded-xl bg-red-50 border border-red-200 text-sm text-red-900">
              <Bell className="w-4 h-4 mt-0.5 shrink-0" />
              <span className="flex-1">{a.message}</span>
              <button
                onClick={async () => { await scarService.acknowledgeAlert(a.id); void load(); }}
                className="shrink-0 flex items-center gap-1 px-2 py-0.5 rounded border text-xs"
              >
                <Check className="w-3 h-3" /> Acknowledge
              </button>
            </li>
          ))}
        </ul>
      )}

      {/* The keloid questions, first: growing, active, responding, recurrent.
          Not "area reduction", not "healing velocity", not a closure date —
          a keloid has none of those. */}
      {data.keloid && <KeloidStatusPanel keloid={data.keloid} />}

      {/* §35/§36 — what the modalities say together. */}
      <div className={`rounded-xl border p-3.5 ${v.cls}`}>
        <p className="text-sm font-semibold">{v.label}</p>
        <p className="text-sm leading-6 mt-0.5">{data.multimodal.summary}</p>
      </div>

      {/* §70 — a series that mixes methods is not a clean series. */}
      {data.methodConsistency.warning && (
        <p className="flex items-start gap-2 text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-xl p-2.5">
          <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0" /> {data.methodConsistency.warning}
        </p>
      )}

      {/* §54 — one chart per domain, treatments overlaid. */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        {data.domains.filter((d) => d.series.length > 0).map((d) => (
          <ScarTrendChart key={d.domain} domain={d} treatments={data.treatments} />
        ))}
      </div>

      {/* The validated scales, each on its own. */}
      {data.scales.length > 0 && (
        <div className="border rounded-xl overflow-hidden">
          <h4 className="px-4 py-2.5 bg-gray-50 border-b text-sm font-semibold text-gray-800">
            Validated scales
          </h4>
          <ul className="divide-y">
            {data.scales.map((s) => (
              <li key={s.scale} className="px-4 py-2.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
                <span className="font-medium text-gray-800 flex-1 min-w-0 truncate">{s.name}</span>
                <span className="tabular-nums text-gray-900">
                  {s.latest ?? '—'}{s.max ? <span className="text-gray-400">/{s.max}</span> : null}
                </span>
                {s.fromBaseline && (
                  <span className={`text-xs font-medium ${
                    s.fromBaseline.direction === 'improved' ? 'text-green-700'
                      : s.fromBaseline.direction === 'worsened' ? 'text-red-700' : 'text-gray-500'
                  }`}>
                    {s.fromBaseline.direction} {s.fromBaseline.delta > 0 ? '+' : ''}{s.fromBaseline.delta}
                    {' '}({s.fromBaseline.proportionOfRange}% of range)
                  </span>
                )}
                {s.incompleteCount > 0 && (
                  <span className="text-[11px] text-amber-700">
                    {s.incompleteCount} incomplete, not totalled
                  </span>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* §42 — prediction, or plainly why not. */}
      <div className="rounded-xl border bg-gray-50 p-3.5">
        <p className="text-sm font-semibold text-gray-800 mb-0.5">Prediction</p>
        {data.eligibility.eligible ? (
          <p className="text-sm text-gray-600">
            Enough reliable follow-up exists for a trajectory projection. Predictions are
            generated from the measured series and are labelled experimental until validated.
          </p>
        ) : (
          <p className="text-sm text-gray-600">{data.eligibility.message}</p>
        )}
      </div>

      {/* §23 — 3D, and why there is none. */}
      {!data.threeD.available && (
        <p className="flex items-start gap-2 text-xs text-gray-500 bg-white border rounded-xl p-2.5">
          <Info className="w-3.5 h-3.5 mt-0.5 shrink-0" />
          <span><strong className="text-gray-700">3D elevation and volume: not reliably measurable.</strong>{' '}
          {data.threeD.reason}</span>
        </p>
      )}

      {/* The visits. */}
      <div className="border rounded-xl overflow-hidden">
        <h4 className="px-4 py-2.5 bg-gray-50 border-b text-sm font-semibold text-gray-800">
          Assessments
        </h4>
        {data.visits.length === 0 ? (
          <p className="p-4 text-sm text-gray-500">
            None yet. Photograph the scar from the wound monitor, then open an assessment here
            to add the scales, the examination and the patient's report.
          </p>
        ) : (
          <ul className="divide-y">
            {[...data.visits].reverse().map((visit) => (
              <li key={visit.id} className="px-4 py-3">
                <div className="flex flex-wrap items-center gap-2 text-sm">
                  <span className="font-medium text-gray-800">
                    Day {visit.day ?? '—'}
                    {visit.is_baseline && <span className="ml-1.5 text-[11px] text-purple-700">baseline</span>}
                  </span>
                  <span className="text-gray-500 text-xs">
                    {new Date(visit.assessed_at).toLocaleDateString()}
                  </span>
                  {visit.area_cm2 != null && (
                    <span className="tabular-nums text-gray-700">{Number(visit.area_cm2).toFixed(1)} cm²</span>
                  )}
                  {visit.finalized_at ? (
                    <span className="flex items-center gap-1 text-[11px] text-gray-500">
                      <Lock className="w-3 h-3" /> finalized
                    </span>
                  ) : (
                    <button
                      onClick={() => setAssessing(assessing === visit.id ? null : visit.id)}
                      className="ml-auto text-xs font-medium text-purple-700 underline hover:no-underline"
                    >
                      {assessing === visit.id ? 'Close' : 'Complete this assessment'}
                    </button>
                  )}
                  {!visit.finalized_at && assessing !== visit.id && (
                    <button
                      onClick={async () => { await scarService.finalize(visit.id); void load(); }}
                      className="flex items-center gap-1 text-xs text-gray-600 border rounded px-2 py-0.5"
                    >
                      <CheckCircle2 className="w-3 h-3" /> Finalize
                    </button>
                  )}
                </div>

                {assessing === visit.id && (
                  <div className="mt-3">
                    <ScarAssessmentForm assessmentId={visit.id} onSaved={() => void load()} />
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------

function NewScar({ patientId, planId, hospitalNumber, onClose, onCreated }: {
  patientId: number | string; planId: number | null; hospitalNumber?: string;
  onClose: () => void; onCreated: (id: number) => void;
}) {
  const [label, setLabel] = useState('');
  const [site, setSite] = useState('');
  const [type, setType] = useState<ScarType>('keloid');
  const [onset, setOnset] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const submit = async () => {
    if (busy) return;
    if (!site.trim()) { setError('An anatomical site is needed — it identifies the scar on a photograph.'); return; }
    setBusy(true);
    setError('');
    try {
      // The scar becomes a wound first, which is what gives it photography,
      // calibration and tracing without any of it being rebuilt here.
      const wound = await createWound({
        patient_id: patientId,
        hospital_number: hospitalNumber,
        label: label.trim() || `${type} — ${site}`,
        wound_type: type === 'keloid' ? 'Keloid / scar' : 'Keloid / scar',
        anatomical_location: site.trim(),
        status: 'active',
      });
      const woundId = globalThis.Number(wound.id ?? wound.serverId);
      if (!globalThis.Number.isFinite(woundId)) throw new Error('Could not create the underlying wound record.');

      const r = await scarService.create({
        patientId, woundId, keloidPlanId: planId,
        label: label.trim() || undefined,
        anatomicalSite: site.trim(),
        scarType: type,
        onsetDate: onset || undefined,
      });
      onCreated(r.scar.id);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not add the scar.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-start justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl w-full max-w-md my-8 p-5 space-y-4">
        <h3 className="font-semibold text-gray-900 flex items-center gap-2">
          <Scan className="w-5 h-5 text-purple-600" /> Add a scar to monitor
        </h3>

        <label className="block">
          <span className="text-xs font-medium text-gray-600">Label</span>
          <input
            value={label} onChange={(e) => setLabel(e.target.value)}
            placeholder="e.g. Right earlobe keloid"
            className="mt-1 w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-purple-500 focus:outline-none"
          />
        </label>

        <div>
          <span className="text-xs font-medium text-gray-600">Anatomical site</span>
          <TaxonomySelect
            groups={ANATOMICAL_SITES}
            value={site}
            onChange={setSite}
            placeholder="Select the site…"
            otherPlaceholder="Describe the site"
            className="mt-1"
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <label className="block">
            <span className="text-xs font-medium text-gray-600">Scar type</span>
            <select
              value={type} onChange={(e) => setType(e.target.value as ScarType)}
              className="mt-1 w-full px-3 py-2 border rounded-lg text-sm bg-white focus:ring-2 focus:ring-purple-500 focus:outline-none"
            >
              {SCAR_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
          </label>
          <label className="block">
            <span className="text-xs font-medium text-gray-600">Onset</span>
            <input
              type="date" value={onset} onChange={(e) => setOnset(e.target.value)}
              className="mt-1 w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-purple-500 focus:outline-none"
            />
          </label>
        </div>

        <p className="flex items-start gap-1.5 text-[11px] text-gray-500">
          <Camera className="w-3.5 h-3.5 mt-0.5 shrink-0" />
          The scar is created as a wound record, so it is photographed, calibrated and traced
          through the existing wound tools — nothing separate to learn.
        </p>

        {error && <p className="text-sm text-red-700">{error}</p>}

        <div className="flex gap-2">
          <button onClick={onClose} className="flex-1 py-2.5 rounded-xl border font-medium text-gray-700">
            Cancel
          </button>
          <button
            onClick={() => void submit()} disabled={busy}
            className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-purple-600 text-white font-semibold disabled:opacity-60"
          >
            {busy && <Loader2 className="w-4 h-4 animate-spin" />} Add
          </button>
        </div>
      </div>
    </div>
  );
}

export default ScarMonitoringPanel;

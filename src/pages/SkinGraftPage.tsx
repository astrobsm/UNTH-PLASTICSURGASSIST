/**
 * Photographic skin graft monitoring.
 *
 * Two views behind one route: the unit's active episodes, and one episode in
 * full. Both are built on the wound pipeline — a graft site IS a wound — so
 * the photographs, calibration, segmentation and overlays come from there and
 * this page is concerned with what they mean for a graft.
 */

import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Layers, Loader2, AlertTriangle, ArrowLeft, Calculator, Bell, Check,
  RefreshCw, Info, ChevronRight, Plus,
} from 'lucide-react';
import {
  skinGraftService, type GraftEpisode, type GraftSite, type GraftAlert,
  type GraftPlan, type GeneralMeasure,
} from '../services/skinGraftService';
import { GraftSitePanel } from '../components/graft/GraftSitePanel';
import { GraftProgressChart } from '../components/graft/GraftProgressChart';
import { HealingRecommendations } from '../components/graft/HealingRecommendations';
import { GraftCaptureFlow } from '../components/graft/GraftCaptureFlow';
import { NewGraftEpisode } from '../components/graft/NewGraftEpisode';
import {
  PatientQuickPicker, displayName, type PickedPatient,
} from '../components/patients/PatientQuickPicker';

export function SkinGraftPage() {
  const { episodeId } = useParams<{ episodeId?: string }>();
  return episodeId ? <EpisodeView id={episodeId} /> : <UnitDashboard />;
}

// ---------------------------------------------------------------------------
// §43 — the unit's active grafts, worst first
// ---------------------------------------------------------------------------

function UnitDashboard() {
  const navigate = useNavigate();
  const [episodes, setEpisodes] = useState<GraftEpisode[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  // An episode belongs to a patient, and this dashboard is the unit's rather
  // than any one patient's, so one has to be chosen. Chosen from the register
  // by name or hospital number — a typed id is a number nobody knows and the
  // wrong one creates an episode on the wrong patient with no way to notice.
  const [picking, setPicking] = useState(false);
  const [newFor, setNewFor] = useState<PickedPatient | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      setEpisodes((await skinGraftService.dashboard()).episodes);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load the graft dashboard.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-gradient-to-r from-teal-600 to-teal-700 text-white">
        <div className="max-w-5xl mx-auto px-4 py-7">
          <div className="flex items-center gap-3">
            <Layers className="w-9 h-9" />
            <div>
              <h1 className="text-xl sm:text-2xl font-bold">Skin Graft Monitoring</h1>
              <p className="text-teal-100 text-sm">
                Graft take and donor healing, measured from standardized photographs
              </p>
            </div>
            <div className="ml-auto flex items-center gap-2">
              <button
                onClick={() => setPicking(true)}
                className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-white text-teal-700 text-sm font-semibold hover:bg-teal-50"
              >
                <Plus className="w-4 h-4" /> New episode
              </button>
              <button
                onClick={() => void load()}
                className="p-2 rounded-lg bg-white/10 hover:bg-white/20"
                aria-label="Reload"
              >
                <RefreshCw className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-6">
        {loading ? (
          <div className="flex items-center gap-2 text-gray-500">
            <Loader2 className="w-5 h-5 animate-spin" /> Loading active graft episodes…
          </div>
        ) : error ? (
          <div className="bg-white border rounded-xl p-5 text-sm text-red-700 flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" /> {error}
          </div>
        ) : episodes.length === 0 ? (
          <div className="bg-white border rounded-2xl p-10 text-center">
            <Layers className="w-9 h-9 mx-auto text-gray-300 mb-3" />
            <p className="text-gray-700 font-medium">No active graft episodes.</p>
            <p className="text-sm text-gray-500 mt-1">
              An episode is created from a patient's record once a graft has been performed.
            </p>
          </div>
        ) : (
          <ul className="space-y-2.5">
            {episodes.map((e) => (
              <li key={e.id}>
                <button
                  onClick={() => navigate(`/skin-grafts/${e.id}`)}
                  className="w-full text-left bg-white border rounded-2xl p-4 hover:border-teal-400 transition-colors flex items-center gap-3"
                >
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-gray-900 truncate">
                      {e.patient_name || `Patient ${e.patient_id}`}
                      {e.hospital_number && (
                        <span className="font-normal text-gray-400"> · {e.hospital_number}</span>
                      )}
                    </p>
                    <p className="text-xs text-gray-500 mt-0.5 truncate">
                      {e.episode_label || 'Skin graft'}
                      {e.graft_type ? ` · ${e.graft_type.replace(/_/g, ' ')}` : ''}
                      {e.mesh_ratio ? ` · mesh ${e.mesh_ratio}` : ''}
                      {e.operation_date ? ` · ${new Date(e.operation_date).toLocaleDateString()}` : ''}
                      {` · ${e.site_count ?? 0} site${e.site_count === 1 ? '' : 's'}`}
                    </p>
                  </div>
                  {!!e.open_alerts && e.open_alerts > 0 && (
                    <span className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-red-100 text-red-700 text-xs font-medium shrink-0">
                      <Bell className="w-3 h-3" /> {e.open_alerts}
                    </span>
                  )}
                  <ChevronRight className="w-4 h-4 text-gray-300 shrink-0" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </main>

      {picking && (
        <PatientQuickPicker
          title="Whose graft episode?"
          onClose={() => setPicking(false)}
          onPick={(p) => { setPicking(false); setNewFor(p); }}
        />
      )}

      {newFor && (
        <NewGraftEpisode
          patientId={newFor.id}
          patientName={displayName(newFor)}
          hospitalNumber={newFor.hospital_number}
          onClose={() => setNewFor(null)}
          onCreated={(id) => { setNewFor(null); navigate(`/skin-grafts/${id}`); }}
        />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// One episode
// ---------------------------------------------------------------------------

function EpisodeView({ id }: { id: string }) {
  const navigate = useNavigate();
  const [episode, setEpisode] = useState<GraftEpisode | null>(null);
  const [sites, setSites] = useState<GraftSite[]>([]);
  const [alerts, setAlerts] = useState<GraftAlert[]>([]);
  const [generalMeasures, setGeneralMeasures] = useState<GeneralMeasure[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [capturing, setCapturing] = useState<GraftSite | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const r = await skinGraftService.episode(id);
      setEpisode(r.episode);
      setSites(r.sites);
      setAlerts(r.alerts);
      setGeneralMeasures(r.generalMeasures ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load this graft episode.');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { void load(); }, [load]);

  const lockBaseline = async (site: GraftSite, point: { assessmentId: number }) => {
    if (busy) return;
    const ok = window.confirm(
      'Lock this photograph as the baseline?\n\n'
      + 'Graft take and re-epithelialization are measured against the baseline area. '
      + 'Once locked it is not recomputed from later photographs, so a site that '
      + 'breaks down cannot appear to be intact.',
    );
    if (!ok) return;
    setBusy(true);
    try {
      await skinGraftService.lockBaseline({ siteId: site.id, assessmentId: point.assessmentId });
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not lock the baseline.');
    } finally {
      setBusy(false);
    }
  };

  const acknowledge = async (alertId: number) => {
    try {
      await skinGraftService.acknowledgeAlert(alertId);
      setAlerts((a) => a.map((x) => (x.id === alertId ? { ...x, acknowledged_at: new Date().toISOString() } : x)));
    } catch { /* the alert stays open, which is the safe failure */ }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Loader2 className="w-7 h-7 animate-spin text-teal-600" />
      </div>
    );
  }

  const open = alerts.filter((a) => !a.acknowledged_at);
  const recipients = sites.filter((s) => s.site_role === 'recipient');
  const donors = sites.filter((s) => s.site_role === 'donor');

  return (
    <div className="min-h-screen bg-gray-50 pb-12">
      <header className="bg-white border-b sticky top-0 z-20">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center gap-3">
          <button
            onClick={() => navigate('/skin-grafts')}
            className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500"
            aria-label="Back to the graft dashboard"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="min-w-0 flex-1">
            <h1 className="font-semibold text-gray-900 truncate">
              {episode?.episode_label || 'Skin graft episode'}
            </h1>
            <p className="text-xs text-gray-500 truncate">
              {episode?.graft_type ? episode.graft_type.replace(/_/g, ' ') : 'Graft'}
              {episode?.graft_thickness_mm ? ` · ${episode.graft_thickness_mm} mm` : ''}
              {episode?.mesh_ratio ? ` · mesh ${episode.mesh_ratio}` : ''}
              {episode?.operation_date ? ` · operated ${new Date(episode.operation_date).toLocaleDateString()}` : ''}
            </p>
          </div>
          <button onClick={() => void load()} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400" aria-label="Reload">
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-5 space-y-5">
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-sm text-red-800 flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" /> {error}
          </div>
        )}

        {/* §42 — what needs looking at, before anything else on the page. */}
        {open.length > 0 && (
          <section className="bg-white border border-red-200 rounded-2xl overflow-hidden">
            <h2 className="px-5 py-3 bg-red-50 border-b border-red-200 font-semibold text-red-900 text-sm flex items-center gap-2">
              <Bell className="w-4 h-4" /> {open.length} alert{open.length === 1 ? '' : 's'}
            </h2>
            <ul className="divide-y">
              {open.map((a) => (
                <li key={a.id} className="px-5 py-3 flex items-start gap-3">
                  <span className={`mt-1 w-2 h-2 rounded-full shrink-0 ${
                    a.severity === 'urgent' ? 'bg-red-500'
                      : a.severity === 'warning' ? 'bg-amber-500' : 'bg-blue-400'
                  }`} />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm text-gray-800 leading-6">{a.message}</p>
                    <p className="text-[11px] text-gray-400 mt-0.5">
                      {new Date(a.created_at).toLocaleString()}
                    </p>
                  </div>
                  <button
                    onClick={() => void acknowledge(a.id)}
                    className="shrink-0 flex items-center gap-1 px-2.5 py-1 rounded-lg border text-xs font-medium text-gray-600 hover:bg-gray-50"
                  >
                    <Check className="w-3 h-3" /> Acknowledge
                  </button>
                </li>
              ))}
            </ul>
          </section>
        )}

        {/* The whole episode on one time axis, before the per-site detail —
            a patient with a graft and its donor site is one healing story. */}
        {sites.length > 0 && <GraftProgressChart sites={sites} />}

        {[...recipients, ...donors].map((s) => (
          <div key={s.id} className="space-y-3">
            <GraftSitePanel site={s} onLockBaseline={lockBaseline} onCapture={setCapturing} />
            {(s.recommendations?.length ?? 0) > 0 && (
              <HealingRecommendations
                recommendations={s.recommendations}
                siteLabel={s.site_label || (s.site_role === 'donor' ? 'Donor site' : 'Recipient site')}
              />
            )}
          </div>
        ))}

        {/* Standing measures once, at the end, rather than repeated per site. */}
        {generalMeasures.length > 0 && sites.length > 0 && (
          <HealingRecommendations recommendations={[]} generalMeasures={generalMeasures} />
        )}

        {sites.length === 0 && (
          <div className="bg-white border rounded-2xl p-8 text-center text-sm text-gray-500">
            No recipient or donor sites have been added to this episode yet.
          </div>
        )}

        <GraftPlanner defaultMeshRatio={episode?.mesh_ratio || '1:1'} />

        {/* §53 — what this module is, stated where the numbers are read. */}
        <p className="text-xs text-gray-400 leading-5 px-1">
          <Info className="w-3.5 h-3.5 inline mr-1 -mt-0.5" />
          Areas and percentages are measured from calibrated photographs by the on-device
          wound pipeline. Trends and projections are arithmetic on those measurements, not
          validated predictive models. Nothing here diagnoses infection or graft failure, or
          replaces clinical examination.
        </p>
      </main>

      {capturing && episode && (
        <GraftCaptureFlow
          site={capturing}
          patientId={episode.patient_id}
          onClose={() => setCapturing(null)}
          onSaved={() => { void load(); }}
        />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// §11 — graft planning from a measured defect
// ---------------------------------------------------------------------------

function GraftPlanner({ defaultMeshRatio }: { defaultMeshRatio: string }) {
  const [defect, setDefect] = useState('');
  const [margin, setMargin] = useState('5');
  const [mesh, setMesh] = useState(defaultMeshRatio);
  const [plan, setPlan] = useState<GraftPlan | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const run = async () => {
    setBusy(true);
    setError('');
    setPlan(null);
    try {
      const r = await skinGraftService.plan({
        defectAreaCm2: Number(defect),
        coverageMarginPct: Number(margin),
        meshRatio: mesh,
      });
      setPlan(r.plan);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not calculate a plan.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="bg-white border rounded-2xl overflow-hidden">
      <h2 className="px-5 py-3 border-b bg-gray-50 font-semibold text-gray-800 text-sm flex items-center gap-2">
        <Calculator className="w-4 h-4 text-gray-400" /> Graft planning
      </h2>
      <div className="p-5 space-y-3">
        <p className="text-xs text-gray-500">
          Takes the defect area measured from the pre-operative photograph and works out how
          much skin to harvest. A planning estimate, not a surgical prescription.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <label className="block">
            <span className="text-xs font-medium text-gray-600">Defect area (cm²)</span>
            <input
              type="number" min="0" step="0.1" value={defect}
              onChange={(e) => setDefect(e.target.value)}
              className="mt-1 w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-teal-500 focus:outline-none"
              placeholder="42.7"
            />
          </label>
          <label className="block">
            <span className="text-xs font-medium text-gray-600">Coverage margin (%)</span>
            <input
              type="number" min="0" step="1" value={margin}
              onChange={(e) => setMargin(e.target.value)}
              className="mt-1 w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-teal-500 focus:outline-none"
            />
          </label>
          <label className="block">
            <span className="text-xs font-medium text-gray-600">Mesh ratio</span>
            <select
              value={mesh} onChange={(e) => setMesh(e.target.value)}
              className="mt-1 w-full px-3 py-2 border rounded-lg text-sm bg-white focus:ring-2 focus:ring-teal-500 focus:outline-none"
            >
              {['1:1', '1:1.5', '1:2', '1:3', '1:4', '1:6'].map((r) => (
                <option key={r} value={r}>{r}</option>
              ))}
            </select>
          </label>
        </div>

        <button
          onClick={() => void run()}
          disabled={busy || !(Number(defect) > 0)}
          className="px-4 py-2 rounded-lg bg-teal-600 text-white text-sm font-medium hover:bg-teal-700 disabled:opacity-50"
        >
          {busy ? 'Calculating…' : 'Calculate'}
        </button>

        {error && <p className="text-sm text-red-700">{error}</p>}

        {plan && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-1">
            <PlanCell label="Recipient defect" value={`${plan.defectAreaCm2} cm²`} />
            <PlanCell label="Planned coverage" value={`${plan.plannedCoverageCm2} cm²`} />
            <PlanCell label="Mesh ratio" value={plan.meshRatio} />
            <PlanCell label="Harvest (estimate)" value={`${plan.plannedHarvestCm2} cm²`} emphasis />
          </div>
        )}
      </div>
    </section>
  );
}

function PlanCell({ label, value, emphasis }: { label: string; value: string; emphasis?: boolean }) {
  return (
    <div className={`rounded-xl border p-3 ${emphasis ? 'bg-teal-50 border-teal-200' : 'bg-gray-50'}`}>
      <p className="text-[11px] text-gray-500 leading-tight">{label}</p>
      <p className={`font-bold tabular-nums ${emphasis ? 'text-lg text-teal-800' : 'text-base text-gray-900'}`}>
        {value}
      </p>
    </div>
  );
}

export default SkinGraftPage;

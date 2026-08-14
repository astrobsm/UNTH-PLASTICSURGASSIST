/**
 * WoundProgress Monitor — longitudinal wound tracking & healing analytics.
 *
 * This is a CONSOLIDATING module, not a re-implementation. It adds the one thing
 * the existing wound suite lacked — a first-class wound identity followed over
 * time — and reuses everything already built:
 *   - aiWoundMeasurement (on-device CV + GPT-4o Vision) for photo measurement
 *   - WoundHealingMap for the serial spatial overlay
 *   - WoundProgressChart + aiWoundMeasurement.generateProgressReport for trends
 *   - the shared apiClient + sync layer for offline-first cross-device storage
 *
 * Views:
 *   dashboard  → aggregate across all monitored wounds, worsening surfaced first
 *   patient    → a patient's wounds; register a new wound
 *   wound      → three-panel detail: map | timeline+capture | analytics
 */

import React, { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Activity, AlertTriangle, ArrowLeft, Camera, ChevronRight, LineChart, Plus,
  RefreshCw, Ruler, Search, TrendingDown, TrendingUp, Minus, Loader2, X, Upload,
} from 'lucide-react';
import { apiClient } from '../services/apiClient';
import { aiWoundMeasurement, type WoundProgressEntry } from '../services/aiWoundMeasurement';
import type { ImageQualityReport } from '../services/woundImageQuality';

/**
 * Stamped onto every assessment this page writes.
 *
 * Bump it whenever the measurement or preprocessing logic changes, so a
 * historical result stays attributable to the code that produced it rather than
 * being silently reinterpreted by whatever the pipeline does later.
 */
const PIPELINE_VERSION = '2026.08-cv1';
import {
  listWounds, getWoundTimeline, getMonitorDashboard, createWound, addAssessment,
  computeHealingAnalytics, healingAlerts, HEALING_STATUS_META,
  type Wound, type WoundAssessment, type HealingStatus,
} from '../services/woundMonitorService';

const WoundHealingMap = lazy(() => import('../components/WoundHealingMap'));
const WoundCalibrationPicker = lazy(() => import('../components/WoundCalibrationPicker'));
const WoundProgressChart = lazy(() => import('../components/WoundProgressChart'));

const WOUND_TYPES = [
  'Burn', 'Pressure Injury', 'Venous Ulcer', 'Diabetic Foot Ulcer', 'Surgical Wound',
  'Traumatic Wound', 'Skin Graft Donor Site', 'Flap', 'Necrotizing Fasciitis', "Fournier's Gangrene",
];
const BODY_SIDES = ['Left', 'Right', 'Midline', 'Bilateral'];

type View =
  | { kind: 'dashboard' }
  | { kind: 'patient'; patient: any }
  | { kind: 'wound'; patient: any; wound: Wound };

// ── assessment → chart entry (reuse existing viz) ───────────────────────────
function toProgressEntries(assessments: WoundAssessment[]): WoundProgressEntry[] {
  return assessments
    .filter(a => a.assessed_at)
    .slice()
    .sort((a, b) => new Date(a.assessed_at!).getTime() - new Date(b.assessed_at!).getTime())
    .map(a => ({
      date: a.assessed_at!,
      length: Number(a.length_cm) || 0,
      width: Number(a.width_cm) || 0,
      area: Number(a.area_cm2) || 0,
      perimeter: Number(a.perimeter_cm) || undefined,
      granulation_percentage: Number(a.granulation_pct) || undefined,
      healing_phase: a.healing_stage,
      contourCm: Array.isArray(a.contour_cm) && a.contour_cm.length ? a.contour_cm : undefined,
      tissue: (a.granulation_pct != null || a.slough_pct != null) ? {
        granulation: Number(a.granulation_pct) || 0,
        slough: Number(a.slough_pct) || 0,
        necrotic: Number(a.necrotic_pct) || 0,
        epithelial: Number(a.epithelial_pct) || 0,
      } : undefined,
    }));
}

const fmtArea = (v: number | null | undefined) =>
  v == null || !Number.isFinite(v) ? '—' : `${Number(v).toFixed(1)} cm²`;

// ════════════════════════════════════════════════════════════════════════════

const WoundProgressMonitorPage: React.FC = () => {
  const [view, setView] = useState<View>({ kind: 'dashboard' });

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto p-4 md:p-6">
        <header className="mb-6">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-gradient-to-br from-teal-500 to-emerald-600 text-white shadow-sm">
              <Activity className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-bold text-gray-900">WoundProgress Monitor</h1>
              <p className="text-sm text-gray-500">AI wound assessment & longitudinal healing analytics</p>
            </div>
          </div>
        </header>

        {view.kind === 'dashboard' && (
          <DashboardView
            onOpenWound={(patient, wound) => setView({ kind: 'wound', patient, wound })}
            onPickPatient={patient => setView({ kind: 'patient', patient })}
          />
        )}
        {view.kind === 'patient' && (
          <PatientView
            patient={view.patient}
            onBack={() => setView({ kind: 'dashboard' })}
            onOpenWound={wound => setView({ kind: 'wound', patient: view.patient, wound })}
          />
        )}
        {view.kind === 'wound' && (
          <WoundDetailView
            patient={view.patient}
            wound={view.wound}
            onBack={() => setView({ kind: 'patient', patient: view.patient })}
          />
        )}
      </div>
    </div>
  );
};

// ── Dashboard ───────────────────────────────────────────────────────────────

const DashboardView: React.FC<{
  onOpenWound: (patient: any, wound: Wound) => void;
  onPickPatient: (patient: any) => void;
}> = ({ onOpenWound, onPickPatient }) => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [data, setData] = useState<Awaited<ReturnType<typeof getMonitorDashboard>> | null>(null);
  const [showPicker, setShowPicker] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      setData(await getMonitorDashboard());
    } catch (e: any) {
      setError(e?.message || 'Could not load the monitor dashboard.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const stats = [
    { label: 'Active wounds', value: data?.totalActive ?? 0, tone: 'text-gray-900', Icon: Ruler },
    { label: 'Improving', value: data?.improving ?? 0, tone: 'text-green-600', Icon: TrendingDown },
    { label: 'Stalled', value: data?.stagnant ?? 0, tone: 'text-amber-600', Icon: Minus },
    { label: 'Worsening', value: data?.worsening ?? 0, tone: 'text-red-600', Icon: TrendingUp },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-lg font-semibold text-gray-800">Monitored wounds</h2>
        <div className="flex items-center gap-2">
          <button onClick={load} className="p-2 rounded-lg hover:bg-gray-100 text-gray-500" title="Refresh">
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
          <button
            onClick={() => setShowPicker(true)}
            className="flex items-center gap-2 px-3 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-lg text-sm font-medium transition-colors"
          >
            <Plus className="w-4 h-4" /> New wound
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {stats.map(({ label, value, tone, Icon }) => (
          <div key={label} className="bg-white rounded-xl border p-4">
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-500">{label}</span>
              <Icon className={`w-4 h-4 ${tone}`} />
            </div>
            <div className={`text-2xl font-bold mt-1 tabular-nums ${tone}`}>{value}</div>
          </div>
        ))}
      </div>

      {data?.avgVelocityCm2PerWeek != null && (
        <div className="bg-white rounded-xl border p-4 text-sm text-gray-600">
          Mean healing velocity across active wounds:{' '}
          <strong className={data.avgVelocityCm2PerWeek < 0 ? 'text-green-600' : 'text-red-600'}>
            {data.avgVelocityCm2PerWeek < 0 ? '' : '+'}{data.avgVelocityCm2PerWeek.toFixed(2)} cm²/week
          </strong>{' '}
          {data.avgVelocityCm2PerWeek < 0 ? '(shrinking — healing)' : '(growing — review)'}
        </div>
      )}

      {loading ? (
        <div className="space-y-2">{[0, 1, 2].map(i => <div key={i} className="h-16 rounded-xl bg-gray-100 animate-pulse" />)}</div>
      ) : error ? (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl p-4 text-sm flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 flex-shrink-0" /> {error}
          <button onClick={load} className="ml-auto underline">Retry</button>
        </div>
      ) : !data?.wounds.length ? (
        <div className="bg-white rounded-xl border p-10 text-center text-gray-500">
          <Ruler className="w-10 h-10 mx-auto mb-3 text-gray-300" />
          No wounds are currently being monitored. Register a wound to begin tracking healing.
        </div>
      ) : (
        <ul className="space-y-2">
          {data.wounds.map(w => (
            <WoundRow
              key={String(w.id)}
              wound={w}
              onClick={() => onOpenWound(
                { id: w.patient_id, first_name: (w as any).first_name, last_name: (w as any).last_name, hospital_number: (w as any).patient_hospital_number || w.hospital_number },
                w,
              )}
            />
          ))}
        </ul>
      )}

      {showPicker && (
        <PatientPickerModal
          onClose={() => setShowPicker(false)}
          onPick={patient => { setShowPicker(false); onPickPatient(patient); }}
        />
      )}
    </div>
  );
};

const StatusBadge: React.FC<{ status?: HealingStatus }> = ({ status }) => {
  const meta = HEALING_STATUS_META[status || 'insufficient_data'];
  return (
    <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium border ${meta.color}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${meta.dot}`} /> {meta.label}
    </span>
  );
};

const WoundRow: React.FC<{ wound: Wound & any; onClick: () => void }> = ({ wound, onClick }) => {
  const name = [wound.first_name, wound.last_name].filter(Boolean).join(' ') || 'Patient';
  return (
    <li>
      <button
        onClick={onClick}
        className="w-full flex items-center gap-4 bg-white rounded-xl border p-4 hover:border-teal-300 hover:shadow-sm transition text-left"
      >
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-medium text-gray-900 truncate">{wound.label || wound.wound_type || 'Wound'}</span>
            <StatusBadge status={wound.healing_status} />
          </div>
          <div className="text-xs text-gray-500 mt-0.5 truncate">
            {name}{wound.patient_hospital_number ? ` • ${wound.patient_hospital_number}` : ''}
            {wound.anatomical_location ? ` • ${wound.anatomical_location}` : ''}
          </div>
        </div>
        <div className="text-right shrink-0">
          <div className="text-sm font-semibold text-gray-900 tabular-nums">{fmtArea(wound.latest_area_cm2)}</div>
          <div className="text-xs text-gray-400 tabular-nums">
            {wound.healing_velocity_cm2_per_week != null
              ? `${Number(wound.healing_velocity_cm2_per_week) < 0 ? '' : '+'}${Number(wound.healing_velocity_cm2_per_week).toFixed(2)}/wk`
              : `${wound.assessment_count || 0} assessment${(wound.assessment_count || 0) === 1 ? '' : 's'}`}
          </div>
        </div>
        <ChevronRight className="w-4 h-4 text-gray-300 shrink-0" />
      </button>
    </li>
  );
};

// ── Patient view ────────────────────────────────────────────────────────────

const PatientView: React.FC<{
  patient: any;
  onBack: () => void;
  onOpenWound: (wound: Wound) => void;
}> = ({ patient, onBack, onOpenWound }) => {
  const [wounds, setWounds] = useState<Wound[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setWounds(await listWounds(patient.id));
    setLoading(false);
  }, [patient.id]);

  useEffect(() => { load(); }, [load]);

  const name = [patient.first_name, patient.last_name].filter(Boolean).join(' ') || 'Patient';

  return (
    <div className="space-y-4">
      <button onClick={onBack} className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700">
        <ArrowLeft className="w-4 h-4" /> Monitor dashboard
      </button>
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">{name}</h2>
          {patient.hospital_number && <p className="text-sm text-gray-500">{patient.hospital_number}</p>}
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="flex items-center gap-2 px-3 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-lg text-sm font-medium"
        >
          <Plus className="w-4 h-4" /> Register wound
        </button>
      </div>

      {loading ? (
        <div className="h-24 rounded-xl bg-gray-100 animate-pulse" />
      ) : !wounds.length ? (
        <div className="bg-white rounded-xl border p-8 text-center text-gray-500">
          No wounds recorded for this patient yet.
        </div>
      ) : (
        <ul className="space-y-2">
          {wounds.map(w => <WoundRow key={String(w.id)} wound={w} onClick={() => onOpenWound(w)} />)}
        </ul>
      )}

      {showForm && (
        <NewWoundModal
          patient={patient}
          onClose={() => setShowForm(false)}
          onCreated={w => { setShowForm(false); load(); onOpenWound(w); }}
        />
      )}
    </div>
  );
};

// ── Wound detail: three panels + trend ──────────────────────────────────────

const WoundDetailView: React.FC<{ patient: any; wound: Wound; onBack: () => void }> = ({ patient, wound, onBack }) => {
  const [assessments, setAssessments] = useState<WoundAssessment[]>([]);
  const [loading, setLoading] = useState(true);
  const [capturing, setCapturing] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setAssessments(await getWoundTimeline(wound.id!));
    setLoading(false);
  }, [wound.id]);

  useEffect(() => { load(); }, [load]);

  const entries = useMemo(() => toProgressEntries(assessments), [assessments]);
  const analytics = useMemo(() => computeHealingAnalytics(assessments), [assessments]);
  const report = useMemo(
    () => (entries.length >= 2 ? aiWoundMeasurement.generateProgressReport(entries) : null),
    [entries],
  );
  const alerts = healingAlerts(analytics);
  const latest = assessments.find(a => a.assessed_at) || assessments[0];

  return (
    <div className="space-y-4">
      <button onClick={onBack} className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700">
        <ArrowLeft className="w-4 h-4" /> {[patient.first_name, patient.last_name].filter(Boolean).join(' ') || 'Patient'}
      </button>

      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <h2 className="text-lg font-semibold text-gray-900">{wound.label || wound.wound_type || 'Wound'}</h2>
            <StatusBadge status={analytics.status} />
          </div>
          <p className="text-sm text-gray-500">
            {[wound.wound_type, wound.anatomical_location, wound.body_side].filter(Boolean).join(' • ')}
          </p>
        </div>
        <button
          onClick={() => setCapturing(true)}
          className="flex items-center gap-2 px-3 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-lg text-sm font-medium"
        >
          <Camera className="w-4 h-4" /> New assessment
        </button>
      </div>

      {alerts.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 space-y-1">
          {alerts.map((a, i) => (
            <div key={i} className="flex items-start gap-2 text-sm text-amber-800">
              <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" /> <span>{a}</span>
            </div>
          ))}
        </div>
      )}

      {/* Three panels */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Left: serial healing map */}
        <div className="bg-white rounded-xl border p-4">
          <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
            <Ruler className="w-4 h-4 text-teal-600" /> Serial healing map
          </h3>
          {loading ? (
            <div className="h-64 bg-gray-50 rounded animate-pulse" />
          ) : entries.length ? (
            <Suspense fallback={<div className="h-64 bg-gray-50 rounded animate-pulse" />}>
              <WoundHealingMap measurements={entries} height={280} />
            </Suspense>
          ) : (
            <div className="h-64 flex items-center justify-center text-sm text-gray-400 text-center px-4">
              Capture the first assessment to start the healing map.
            </div>
          )}
        </div>

        {/* Center: analytics */}
        <div className="bg-white rounded-xl border p-4 space-y-3">
          <h3 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
            <LineChart className="w-4 h-4 text-teal-600" /> Healing analytics
          </h3>
          <div className="grid grid-cols-2 gap-3">
            <Metric label="Current area" value={fmtArea(latest?.area_cm2)} />
            <Metric label="Baseline" value={fmtArea(entries[0]?.area)} />
            <Metric
              label="Area reduction"
              value={`${analytics.percentAreaReduction >= 0 ? '' : '+'}${analytics.percentAreaReduction.toFixed(0)}%`}
              tone={analytics.percentAreaReduction > 0 ? 'text-green-600' : analytics.percentAreaReduction < 0 ? 'text-red-600' : undefined}
            />
            <Metric
              label="Velocity"
              value={`${analytics.velocityCm2PerWeek < 0 ? '' : '+'}${analytics.velocityCm2PerWeek.toFixed(2)} cm²/wk`}
              tone={analytics.velocityCm2PerWeek < 0 ? 'text-green-600' : analytics.velocityCm2PerWeek > 0 ? 'text-red-600' : undefined}
            />
            <Metric
              label="Projected closure"
              value={analytics.projectedDaysToClosure != null ? `${analytics.projectedDaysToClosure} days` : '—'}
            />
            <Metric label="Assessments" value={String(analytics.assessmentCount)} />
          </div>
          {latest && (latest.granulation_pct != null || latest.slough_pct != null) && (
            <TissueBar latest={latest} />
          )}
        </div>

        {/* Right: latest description */}
        <div className="bg-white rounded-xl border p-4">
          <h3 className="text-sm font-semibold text-gray-700 mb-3">Latest clinical description</h3>
          {latest?.clinical_description ? (
            <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">{latest.clinical_description}</p>
          ) : (
            <p className="text-sm text-gray-400">No description recorded on the latest assessment.</p>
          )}
          {latest?.assessed_at && (
            <p className="text-xs text-gray-400 mt-3">Assessed {new Date(latest.assessed_at).toLocaleString()}</p>
          )}
        </div>
      </div>

      {/* Trend chart */}
      {report && (
        <Suspense fallback={<div className="h-72 bg-white rounded-xl border animate-pulse" />}>
          <WoundProgressChart measurements={entries} report={report} />
        </Suspense>
      )}

      {/* Timeline */}
      <div className="bg-white rounded-xl border p-4">
        <h3 className="text-sm font-semibold text-gray-700 mb-3">Assessment history</h3>
        {loading ? (
          <div className="h-20 bg-gray-50 rounded animate-pulse" />
        ) : !assessments.length ? (
          <p className="text-sm text-gray-400">No assessments yet.</p>
        ) : (
          <ul className="divide-y">
            {assessments.map(a => (
              <li key={String(a.id)} className="py-2.5 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-sm font-medium text-gray-800 tabular-nums">{fmtArea(a.area_cm2)}</div>
                  <div className="text-xs text-gray-400">
                    {a.assessed_at ? new Date(a.assessed_at).toLocaleString() : '—'}
                    {a.scale_reliable === false && ' • uncalibrated'}
                  </div>
                </div>
                {a.length_cm != null && a.width_cm != null && (
                  <div className="text-xs text-gray-500 tabular-nums shrink-0">
                    {Number(a.length_cm).toFixed(1)} × {Number(a.width_cm).toFixed(1)} cm
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>

      {capturing && (
        <CaptureAssessmentModal
          wound={wound}
          onClose={() => setCapturing(false)}
          onSaved={() => { setCapturing(false); load(); }}
        />
      )}
    </div>
  );
};

const Metric: React.FC<{ label: string; value: string; tone?: string }> = ({ label, value, tone }) => (
  <div>
    <div className="text-xs text-gray-500">{label}</div>
    <div className={`text-base font-semibold tabular-nums ${tone || 'text-gray-900'}`}>{value}</div>
  </div>
);

const TissueBar: React.FC<{ latest: WoundAssessment }> = ({ latest }) => {
  const seg = [
    { pct: Number(latest.granulation_pct) || 0, color: 'bg-red-400', label: 'Granulation' },
    { pct: Number(latest.slough_pct) || 0, color: 'bg-yellow-400', label: 'Slough' },
    { pct: Number(latest.necrotic_pct) || 0, color: 'bg-gray-800', label: 'Necrotic' },
    { pct: Number(latest.epithelial_pct) || 0, color: 'bg-pink-300', label: 'Epithelial' },
  ].filter(s => s.pct > 0);
  const total = seg.reduce((s, x) => s + x.pct, 0) || 1;
  return (
    <div>
      <div className="text-xs text-gray-500 mb-1">Wound bed composition</div>
      <div className="flex h-3 rounded-full overflow-hidden bg-gray-100">
        {seg.map((s, i) => <div key={i} className={s.color} style={{ width: `${(s.pct / total) * 100}%` }} title={`${s.label} ${s.pct}%`} />)}
      </div>
      <div className="flex flex-wrap gap-x-3 gap-y-1 mt-1.5">
        {seg.map((s, i) => (
          <span key={i} className="inline-flex items-center gap-1 text-[11px] text-gray-500">
            <span className={`w-2 h-2 rounded-full ${s.color}`} /> {s.label} {Math.round(s.pct)}%
          </span>
        ))}
      </div>
    </div>
  );
};

// ── Patient picker ──────────────────────────────────────────────────────────

const PatientPickerModal: React.FC<{ onClose: () => void; onPick: (p: any) => void }> = ({ onClose, onPick }) => {
  const [q, setQ] = useState('');
  const [all, setAll] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const res: any = await apiClient.getPatients();
        setAll(Array.isArray(res) ? res : res?.patients || []);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term) return all.slice(0, 30);
    return all.filter(p =>
      [p.first_name, p.last_name, p.hospital_number].filter(Boolean).join(' ').toLowerCase().includes(term)
    ).slice(0, 30);
  }, [q, all]);

  return (
    <Modal title="Select patient" onClose={onClose}>
      <div className="relative mb-3">
        <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
        <input
          autoFocus value={q} onChange={e => setQ(e.target.value)}
          placeholder="Search name or hospital number…"
          className="w-full pl-9 pr-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-teal-500 focus:border-teal-500 outline-none"
        />
      </div>
      {loading ? (
        <div className="h-40 bg-gray-50 rounded animate-pulse" />
      ) : (
        <ul className="max-h-72 overflow-y-auto divide-y">
          {filtered.map(p => (
            <li key={String(p.id)}>
              <button onClick={() => onPick(p)} className="w-full text-left px-2 py-2.5 hover:bg-gray-50 rounded flex items-center justify-between">
                <span className="text-sm text-gray-800">{[p.first_name, p.last_name].filter(Boolean).join(' ') || 'Patient'}</span>
                <span className="text-xs text-gray-400">{p.hospital_number}</span>
              </button>
            </li>
          ))}
          {!filtered.length && <li className="py-6 text-center text-sm text-gray-400">No patients found.</li>}
        </ul>
      )}
    </Modal>
  );
};

// ── New wound ───────────────────────────────────────────────────────────────

const NewWoundModal: React.FC<{ patient: any; onClose: () => void; onCreated: (w: Wound) => void }> = ({ patient, onClose, onCreated }) => {
  const [form, setForm] = useState<Partial<Wound>>({
    wound_type: WOUND_TYPES[0], body_side: 'Left', date_first_seen: new Date().toISOString().slice(0, 10),
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const set = (patch: Partial<Wound>) => setForm(f => ({ ...f, ...patch }));

  const submit = async () => {
    if (saving) return;
    if (!form.anatomical_location?.trim()) { setError('Anatomical location is required.'); return; }
    setSaving(true);
    setError('');
    try {
      const res: any = await createWound({
        patient_id: patient.id,
        hospital_number: patient.hospital_number,
        label: form.label || `${form.anatomical_location} ${form.wound_type}`.trim(),
        wound_type: form.wound_type,
        anatomical_location: form.anatomical_location,
        body_side: form.body_side,
        etiology: form.etiology,
        stage: form.stage,
        date_first_seen: form.date_first_seen,
        date_of_injury: form.date_of_injury,
        cause: form.cause,
      });
      onCreated(res?.wound || res);
    } catch (e: any) {
      setError(e?.message || 'Could not create the wound.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal title="Register wound" onClose={onClose}>
      <div className="space-y-3">
        <Field label="Wound type">
          <select value={form.wound_type} onChange={e => set({ wound_type: e.target.value })} className="w-full border rounded-lg px-3 py-2 text-sm">
            {WOUND_TYPES.map(t => <option key={t}>{t}</option>)}
          </select>
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Anatomical location *">
            <input value={form.anatomical_location || ''} onChange={e => set({ anatomical_location: e.target.value })} placeholder="e.g. Left heel" className="w-full border rounded-lg px-3 py-2 text-sm" />
          </Field>
          <Field label="Body side">
            <select value={form.body_side} onChange={e => set({ body_side: e.target.value })} className="w-full border rounded-lg px-3 py-2 text-sm">
              {BODY_SIDES.map(s => <option key={s}>{s}</option>)}
            </select>
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Date first seen"><input type="date" value={form.date_first_seen || ''} onChange={e => set({ date_first_seen: e.target.value })} className="w-full border rounded-lg px-3 py-2 text-sm" /></Field>
          <Field label="Date of injury"><input type="date" value={form.date_of_injury || ''} onChange={e => set({ date_of_injury: e.target.value })} className="w-full border rounded-lg px-3 py-2 text-sm" /></Field>
        </div>
        <Field label="Etiology / cause">
          <input value={form.cause || ''} onChange={e => set({ cause: e.target.value })} placeholder="e.g. Prolonged pressure, immobility" className="w-full border rounded-lg px-3 py-2 text-sm" />
        </Field>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <div className="flex gap-2 pt-1">
          <button onClick={onClose} className="flex-1 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg text-sm font-medium">Cancel</button>
          <button onClick={submit} disabled={saving} className="flex-1 py-2 bg-teal-600 hover:bg-teal-700 disabled:opacity-50 text-white rounded-lg text-sm font-medium flex items-center justify-center gap-2">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : null} Register
          </button>
        </div>
      </div>
    </Modal>
  );
};

// ── Capture assessment (reuses aiWoundMeasurement) ──────────────────────────

const CaptureAssessmentModal: React.FC<{ wound: Wound; onClose: () => void; onSaved: () => void }> = ({ wound, onClose, onSaved }) => {
  const [mode, setMode] = useState<'photo' | 'manual'>('photo');
  const [analyzing, setAnalyzing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);
  const galleryRef = useRef<HTMLInputElement>(null);
  // The last photo analysed, kept so the scale can be set manually and the
  // measurement recomputed without asking for the picture again.
  const [pending, setPending] = useState<{ url: string; imageData: ImageData; w: number; h: number } | null>(null);
  const [showCalibration, setShowCalibration] = useState(false);
  // Editable measurement fields (auto-filled by AI, clinician confirms).
  const [m, setM] = useState<Partial<WoundAssessment>>({});
  const [scaleReliable, setScaleReliable] = useState(false);
  const [calibType, setCalibType] = useState('reference-card');
  // Recorded with the assessment so a measurement can be read against the
  // quality of the photograph that produced it.
  const [quality, setQuality] = useState<ImageQualityReport | null>(null);
  const [warnings, setWarnings] = useState<string[]>([]);

  /**
   * Re-run the measurement with a scale the clinician set by hand. This is the
   * accurate path when a coin or card was used, since the automatic detector
   * cannot recognise either.
   */
  const applyManualScale = async (pixelsPerCm: number, referenceLabel: string) => {
    if (!pending) return;
    setShowCalibration(false);
    setAnalyzing(true);
    setError('');
    try {
      await aiWoundMeasurement.initialize();
      const calibration = aiWoundMeasurement.createManualCalibration(pixelsPerCm, 1);
      const result = await aiWoundMeasurement.measureWound(pending.imageData, calibration);
      setScaleReliable(true);
      setCalibType(`manual:${referenceLabel}`);
      setM(prev => ({
        ...prev,
        length_cm: round(result.length),
        width_cm: round(result.width),
        area_cm2: round(result.area),
        perimeter_cm: round(result.perimeter),
        ai_confidence: result.confidence,
        contour_cm: result.contourCm,
      }));
    } catch (e: any) {
      setError(e?.message || 'Could not apply the scale');
    } finally {
      setAnalyzing(false);
    }
  };

  const analyzePhoto = async (file: File) => {
    setAnalyzing(true);
    setError('');
    try {
      const bitmap = await createImageBitmap(file);
      const canvas = document.createElement('canvas');
      canvas.width = bitmap.width; canvas.height = bitmap.height;
      const ctx = canvas.getContext('2d')!;
      ctx.drawImage(bitmap, 0, 0);
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);

      // Keep the image: if auto-detection cannot find a marker, the clinician
      // sets the scale by hand against it rather than re-taking the photo.
      setPending({ url: URL.createObjectURL(file), imageData, w: canvas.width, h: canvas.height });

      await aiWoundMeasurement.initialize();
      // Auto-detection only recognises green printed markers, grid paper and
      // ruler tick marks — NOT coins or cards. When it fails, measureFromScale
      // below takes over with an exact, user-supplied scale.
      const result = await aiWoundMeasurement.measureWound(imageData);

      // Quality travels with whatever is saved, so a number can always be read
      // against the photograph it came from.
      setQuality(result.imageQuality);
      setWarnings(result.warnings);

      // The pipeline now refuses unusable photographs and images with no
      // plausible wound, returning zeros. Those zeros must not reach the form —
      // a 0 cm² assessment saved on a healing chart reads as a closed wound.
      if (result.noWoundDetected) {
        setError(result.warnings.join(' ') || 'No measurable wound found in this photograph.');
        setMode('manual');
        return;
      }

      setScaleReliable(Boolean(result.scaleReliable));
      setCalibType(result.calibrationMethod || 'reference-card');
      setM({
        length_cm: round(result.length),
        width_cm: round(result.width),
        area_cm2: round(result.area),
        perimeter_cm: round(result.perimeter),
        // Tissue percentages are deliberately not prefilled from the analysis.
        // The colour classifier behind them is unvalidated, so they are the
        // clinician's to enter. See TISSUE_MODEL_VALIDATED.
        ai_confidence: result.confidence,
        contour_cm: result.contourCm,
      });
    } catch (e: any) {
      setError(e?.message || 'Could not analyse the image. Try manual entry.');
      setMode('manual');
    } finally {
      setAnalyzing(false);
    }
  };

  const save = async () => {
    if (saving) return;
    const area = Number(m.area_cm2);
    // Zero is finite, so the old check let a refused measurement through as a
    // 0 cm² assessment — which on a healing chart reads as a closed wound.
    if (!Number.isFinite(area) || area <= 0) {
      setError('A wound area greater than zero is required. If the photograph could not be measured, enter the dimensions manually.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      // Tissue percentages here are typed by the clinician, so they are recorded
      // as such. Nothing in this app may write 'model' until a validated model
      // exists — see TISSUE_MODEL_VALIDATED.
      const enteredTissue = [m.granulation_pct, m.slough_pct, m.necrotic_pct, m.epithelial_pct]
        .some(v => numOrNull(v) != null);

      await addAssessment({
        wound_id: wound.id!,
        patient_id: wound.patient_id,
        length_cm: numOrNull(m.length_cm),
        width_cm: numOrNull(m.width_cm),
        area_cm2: area,
        perimeter_cm: numOrNull(m.perimeter_cm),
        granulation_pct: numOrNull(m.granulation_pct),
        slough_pct: numOrNull(m.slough_pct),
        necrotic_pct: numOrNull(m.necrotic_pct),
        epithelial_pct: numOrNull(m.epithelial_pct),
        tissue_source: enteredTissue ? 'clinician' : 'none',
        clinical_description: m.clinical_description,
        ai_confidence: Number(m.ai_confidence) || 0,
        calibration_type: calibType,
        scale_reliable: scaleReliable,
        contour_cm: m.contour_cm,
        // The automated contour is kept apart from any correction, so a later
        // edit cannot destroy what the pipeline actually produced.
        ai_contour_cm: m.contour_cm,
        image_quality_score: quality?.score,
        image_quality_flags: quality?.flags,
        model_name: 'on-device-cv',
        model_version: PIPELINE_VERSION,
        preprocessing_version: PIPELINE_VERSION,
        assessed_at: new Date().toISOString(),
      });
      onSaved();
    } catch (e: any) {
      setError(e?.message || 'Could not save the assessment.');
    } finally {
      setSaving(false);
    }
  };

  const setField = (k: keyof WoundAssessment, v: string) => setM(prev => ({ ...prev, [k]: v === '' ? undefined : Number(v) }));

  return (
    <Modal title="New assessment" onClose={onClose} wide>
      <div className="flex gap-2 mb-4">
        {(['photo', 'manual'] as const).map(t => (
          <button key={t} onClick={() => setMode(t)} className={`px-3 py-1.5 rounded-lg text-sm font-medium ${mode === t ? 'bg-teal-600 text-white' : 'bg-gray-100 text-gray-600'}`}>
            {t === 'photo' ? 'AI photo measurement' : 'Manual entry'}
          </button>
        ))}
      </div>

      {mode === 'photo' && (
        <div className="mb-4">
          {/* Two separate inputs. A single input with capture="environment"
              forces the camera on mobile, so there was no way to pick an
              existing photo from the device. */}
          <input ref={fileRef} type="file" accept="image/*" capture="environment" className="hidden"
            onChange={e => { const f = e.target.files?.[0]; if (f) analyzePhoto(f); e.target.value = ''; }} />
          <input ref={galleryRef} type="file" accept="image/*" className="hidden"
            onChange={e => { const f = e.target.files?.[0]; if (f) analyzePhoto(f); e.target.value = ''; }} />

          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => fileRef.current?.click()} disabled={analyzing}
              className="py-6 border-2 border-dashed border-teal-300 rounded-xl text-teal-700 hover:bg-teal-50 flex flex-col items-center gap-2 disabled:opacity-60"
            >
              {analyzing ? <Loader2 className="w-6 h-6 animate-spin" /> : <Camera className="w-6 h-6" />}
              <span className="text-sm font-medium">{analyzing ? 'Analysing…' : 'Take photo'}</span>
              <span className="text-xs text-gray-500">Use the camera</span>
            </button>
            <button
              onClick={() => galleryRef.current?.click()} disabled={analyzing}
              className="py-6 border-2 border-dashed border-teal-300 rounded-xl text-teal-700 hover:bg-teal-50 flex flex-col items-center gap-2 disabled:opacity-60"
            >
              <Upload className="w-6 h-6" />
              <span className="text-sm font-medium">Upload from device</span>
              <span className="text-xs text-gray-500">Choose an existing photo</span>
            </button>
          </div>

          <p className="text-xs text-gray-500 mt-2">
            Place a marker of known size <span className="font-medium">flat beside the wound, on the same
            surface</span>, and shoot square to it. The unit's printed green marker is detected
            automatically; a bank or ID card, coin or ruler works with <span className="font-medium">Set
            scale from marker</span> below.
          </p>
          <div className="flex flex-wrap items-center gap-3 mt-1">
            <button
              type="button"
              onClick={async () => {
                const { downloadMarkerSheet } = await import('../services/woundMarkerPdfService');
                downloadMarkerSheet();
              }}
              className="text-xs text-white bg-teal-600 hover:bg-teal-700 rounded px-2 py-1 inline-flex items-center gap-1"
            >
              <Ruler className="w-3 h-3" /> Download marker sheet (PDF)
            </button>
            <a
              href="/wound-calibration-marker.html"
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-teal-700 underline inline-flex items-center gap-1"
            >
              Step-by-step guide
            </a>
          </div>

          {/* Photograph quality. Shown whether or not a measurement resulted, so
              a clinician whose image was refused sees why, and one whose image
              merely had glare knows the number is softer than it looks. */}
          {!analyzing && warnings.length > 0 && (
            <div className="mt-2 rounded-lg border border-amber-300 bg-amber-50 p-2">
              <p className="text-xs font-medium text-amber-900 mb-1">Photograph quality</p>
              <ul className="list-disc pl-4 text-xs text-amber-900 space-y-0.5">
                {warnings.map((wmsg, i) => <li key={i}>{wmsg}</li>)}
              </ul>
              {quality && (
                <p className="text-[11px] text-amber-800 mt-1">
                  Quality score {quality.score.toFixed(2)} · sharpness {quality.metrics.sharpness} ·
                  mean brightness {quality.metrics.meanLuma}
                </p>
              )}
            </div>
          )}

          {!analyzing && m.area_cm2 != null && (
            <div className={`mt-2 rounded-lg border p-2 ${scaleReliable ? 'bg-green-50 border-green-200' : 'bg-amber-50 border-amber-300'}`}>
              <p className={`text-xs ${scaleReliable ? 'text-green-800' : 'text-amber-900'}`}>
                {scaleReliable
                  ? `Calibrated measurement (${calibType.startsWith('manual:') ? calibType.slice(7) : calibType}).`
                  : 'No marker detected automatically. Automatic detection only recognises green printed markers, grid paper and ruler tick marks — not coins or cards. Set the scale by hand for an accurate size.'}
              </p>
              {pending && (
                <button
                  onClick={() => setShowCalibration(true)}
                  className="mt-2 px-3 py-1.5 rounded-md text-xs font-medium bg-primary-600 text-white hover:bg-primary-700 inline-flex items-center gap-1"
                >
                  <Ruler className="w-3.5 h-3.5" /> {scaleReliable ? 'Adjust scale' : 'Set scale from marker'}
                </button>
              )}
            </div>
          )}

          {showCalibration && pending && (
            <Suspense fallback={null}>
              <WoundCalibrationPicker
                imageUrl={pending.url}
                naturalWidth={pending.w}
                naturalHeight={pending.h}
                onCancel={() => setShowCalibration(false)}
                onCalibrated={({ pixelsPerCm, referenceLabel }) => applyManualScale(pixelsPerCm, referenceLabel)}
              />
            </Suspense>
          )}
        </div>
      )}

      {/* Editable measurements (shared by both modes) */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
        <NumField label="Length (cm)" value={m.length_cm} onChange={v => setField('length_cm', v)} />
        <NumField label="Width (cm)" value={m.width_cm} onChange={v => setField('width_cm', v)} />
        <NumField label="Area (cm²) *" value={m.area_cm2} onChange={v => setField('area_cm2', v)} />
        <NumField label="Perimeter (cm)" value={m.perimeter_cm} onChange={v => setField('perimeter_cm', v)} />
        <NumField label="Granulation %" value={m.granulation_pct} onChange={v => setField('granulation_pct', v)} />
        <NumField label="Slough %" value={m.slough_pct} onChange={v => setField('slough_pct', v)} />
        <NumField label="Necrotic %" value={m.necrotic_pct} onChange={v => setField('necrotic_pct', v)} />
        <NumField label="Epithelial %" value={m.epithelial_pct} onChange={v => setField('epithelial_pct', v)} />
      </div>

      <Field label="Clinical description (optional)">
        <textarea
          value={m.clinical_description || ''} onChange={e => setM(prev => ({ ...prev, clinical_description: e.target.value }))}
          rows={2} className="w-full border rounded-lg px-3 py-2 text-sm" placeholder="Wound bed, edges, exudate, periwound skin…"
        />
      </Field>

      {error && <p className="text-sm text-red-600 mt-2">{error}</p>}
      <div className="flex gap-2 pt-3">
        <button onClick={onClose} className="flex-1 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg text-sm font-medium">Cancel</button>
        <button onClick={save} disabled={saving} className="flex-1 py-2 bg-teal-600 hover:bg-teal-700 disabled:opacity-50 text-white rounded-lg text-sm font-medium flex items-center justify-center gap-2">
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : null} Save assessment
        </button>
      </div>
    </Modal>
  );
};

// ── Small shared primitives ─────────────────────────────────────────────────

const Field: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
  <label className="block">
    <span className="text-xs font-medium text-gray-600 mb-1 block">{label}</span>
    {children}
  </label>
);

const NumField: React.FC<{ label: string; value: any; onChange: (v: string) => void }> = ({ label, value, onChange }) => (
  <Field label={label}>
    <input type="number" step="0.1" value={value ?? ''} onChange={e => onChange(e.target.value)} className="w-full border rounded-lg px-2 py-1.5 text-sm tabular-nums" />
  </Field>
);

const Modal: React.FC<{ title: string; onClose: () => void; children: React.ReactNode; wide?: boolean }> = ({ title, onClose, children, wide }) => (
  <div className="fixed inset-0 bg-black/50 z-50 flex items-start sm:items-center justify-center p-4 overflow-y-auto" role="dialog" aria-modal="true">
    <div className={`bg-white rounded-2xl w-full ${wide ? 'max-w-2xl' : 'max-w-lg'} shadow-2xl my-4 sm:my-8 max-h-[calc(100vh-2rem)] flex flex-col`}>
      <div className="flex items-center justify-between p-4 border-b">
        <h3 className="font-semibold text-gray-900">{title}</h3>
        <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400"><X className="w-4 h-4" /></button>
      </div>
      <div className="p-4 overflow-y-auto">{children}</div>
    </div>
  </div>
);

function round(v: number): number { return Math.round(v * 10) / 10; }
function numOrNull(v: any): number | null { const n = Number(v); return Number.isFinite(n) ? n : null; }

export default WoundProgressMonitorPage;

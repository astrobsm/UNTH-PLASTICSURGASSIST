/**
 * The unit's keloids and scars, worst first.
 *
 * Deliberately not the WoundProgress Monitor. That page asks how much smaller
 * a wound is, how fast it is closing and when it will be shut; a keloid
 * answers none of those, and being shown a healing map it will never complete
 * is worse than being shown nothing.
 *
 * This asks the keloid questions instead — is it growing, is it still active,
 * did it respond, is this recurrence — and orders the list by what needs
 * attention rather than by date.
 */

import { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  Sparkles, Loader2, AlertTriangle, RefreshCw, ChevronRight, Bell,
  TrendingUp, TrendingDown, Minus, Plus, ArrowLeft,
} from 'lucide-react';
import { apiClient } from '../services/apiClient';
import { ScarMonitoringPanel } from '../components/scar/ScarMonitoringPanel';
import {
  PatientQuickPicker, displayName, type PickedPatient,
} from '../components/patients/PatientQuickPicker';

interface DashboardScar {
  id: number;
  label?: string | null;
  anatomical_site?: string | null;
  scar_type?: string | null;
  patient_id: number;
  patient_name?: string | null;
  hospital_number?: string | null;
  open_alerts: number;
  assessment_count: number;
  last_assessed_at?: string | null;
  growth: { ok: boolean; direction?: string; perMonthCm2?: number; currentAreaCm2?: number };
  activity: { status: string };
  status: { status: string; label: string; summary: string };
}

const STATUS_CHIP: Record<string, string> = {
  possible_recurrence: 'bg-red-100 text-red-800',
  progressive: 'bg-red-100 text-red-800',
  stable_active: 'bg-amber-100 text-amber-800',
  stable: 'bg-blue-100 text-blue-800',
  insufficient: 'bg-gray-100 text-gray-600',
  regressing: 'bg-green-100 text-green-800',
  quiescent: 'bg-green-100 text-green-800',
};

export function ScarKeloidMonitorPage() {
  const [params, setParams] = useSearchParams();
  const patientId = params.get('patient');

  const [scars, setScars] = useState<DashboardScar[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [picking, setPicking] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const r = await apiClient.get('/scars/dashboard') as { scars: DashboardScar[] };
      setScars(r.scars);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load the keloid monitor.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { if (!patientId) void load(); }, [load, patientId]);

  // A patient selected from the list, or picked to start a new lesion: the
  // per-patient panel is the same one the care plan embeds.
  if (patientId) {
    return (
      <div className="min-h-screen bg-gray-50">
        <header className="bg-white border-b sticky top-0 z-20">
          <div className="max-w-5xl mx-auto px-4 py-3 flex items-center gap-3">
            <button
              onClick={() => setParams({})}
              className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500"
              aria-label="Back to the keloid monitor"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <h1 className="font-semibold text-gray-900">Scar &amp; keloid monitoring</h1>
          </div>
        </header>
        <main className="max-w-5xl mx-auto px-4 py-5">
          <ScarMonitoringPanel patientId={patientId} />
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-gradient-to-r from-purple-600 to-purple-700 text-white">
        <div className="max-w-5xl mx-auto px-4 py-7">
          <div className="flex items-center gap-3">
            <Sparkles className="w-9 h-9" />
            <div className="min-w-0">
              <h1 className="text-xl sm:text-2xl font-bold">Scar &amp; Keloid Monitor</h1>
              <p className="text-purple-100 text-sm">
                Growth, activity, treatment response and recurrence — not wound healing
              </p>
            </div>
            <div className="ml-auto flex items-center gap-2">
              <button
                onClick={() => setPicking(true)}
                className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-white text-purple-700 text-sm font-semibold hover:bg-purple-50"
              >
                <Plus className="w-4 h-4" /> Add a lesion
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
            <Loader2 className="w-5 h-5 animate-spin" /> Loading the unit's lesions…
          </div>
        ) : error ? (
          <div className="bg-white border rounded-xl p-5 text-sm text-red-700 flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" /> {error}
          </div>
        ) : scars.length === 0 ? (
          <div className="bg-white border rounded-2xl p-10 text-center">
            <Sparkles className="w-9 h-9 mx-auto text-gray-300 mb-3" />
            <p className="text-gray-700 font-medium">No keloid or scar is being followed.</p>
            <p className="text-sm text-gray-500 mt-1 max-w-md mx-auto">
              Keloids are followed here rather than in the wound monitor: they do not
              epithelialize and do not close, so area reduction and a projected closure date
              would mean nothing for them.
            </p>
          </div>
        ) : (
          <ul className="space-y-2.5">
            {scars.map((s) => {
              const Icon = s.growth.direction === 'growing' ? TrendingUp
                : s.growth.direction === 'regressing' ? TrendingDown : Minus;
              return (
                <li key={s.id}>
                  <button
                    onClick={() => setParams({ patient: String(s.patient_id) })}
                    className="w-full text-left bg-white border rounded-2xl p-4 hover:border-purple-400 transition-colors flex items-center gap-3"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-gray-900 truncate">
                        {s.patient_name || `Patient ${s.patient_id}`}
                        {s.hospital_number && (
                          <span className="font-normal text-gray-400"> · {s.hospital_number}</span>
                        )}
                      </p>
                      <p className="text-xs text-gray-500 mt-0.5 truncate">
                        {s.label || s.anatomical_site || 'Lesion'}
                        {s.scar_type ? ` · ${s.scar_type.replace(/_/g, ' ')}` : ''}
                        {` · ${s.assessment_count} assessment${s.assessment_count === 1 ? '' : 's'}`}
                        {s.last_assessed_at
                          ? ` · last ${new Date(s.last_assessed_at).toLocaleDateString()}`
                          : ' · never assessed'}
                      </p>
                      {s.growth.ok && (
                        <p className="text-xs text-gray-600 mt-1 flex items-center gap-1">
                          <Icon className="w-3.5 h-3.5" />
                          {s.growth.perMonthCm2! > 0 ? '+' : ''}{s.growth.perMonthCm2} cm²/month
                          {s.growth.currentAreaCm2 != null && ` · now ${s.growth.currentAreaCm2} cm²`}
                        </p>
                      )}
                    </div>

                    {s.open_alerts > 0 && (
                      <span className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-red-100 text-red-700 text-xs font-medium shrink-0">
                        <Bell className="w-3 h-3" /> {s.open_alerts}
                      </span>
                    )}
                    <span className={`px-2.5 py-1 rounded-full text-xs font-medium shrink-0 ${
                      STATUS_CHIP[s.status.status] ?? STATUS_CHIP.insufficient
                    }`}>
                      {s.status.label}
                    </span>
                    <ChevronRight className="w-4 h-4 text-gray-300 shrink-0" />
                  </button>
                </li>
              );
            })}
          </ul>
        )}

        <p className="text-xs text-gray-400 leading-5 mt-5 px-1">
          Ordered by what needs attention: possible recurrence, then progression, then lesions
          that are stable but still active. A keloid that is active — red, itchy, firm — is the
          one that responds to intralesional treatment, which is why activity is shown beside
          growth rather than behind it.
        </p>
      </main>

      {picking && (
        <PatientQuickPicker
          title="Whose keloid or scar?"
          onClose={() => setPicking(false)}
          onPick={(p: PickedPatient) => {
            setPicking(false);
            void displayName(p);
            setParams({ patient: String(p.id) });
          }}
        />
      )}
    </div>
  );
}

export default ScarKeloidMonitorPage;

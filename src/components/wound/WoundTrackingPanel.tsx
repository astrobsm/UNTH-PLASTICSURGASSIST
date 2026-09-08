/**
 * The link between a wound module and the progress monitor.
 *
 * The unit assesses wounds in seven places — wound care, burns, keloids,
 * pressure sores, sickle cell ulcers, SJS and lymphoedema — and serial
 * measurement lived in none of them. It sat in its own module, reachable only
 * from the sidebar, against a patient chosen again from scratch. So a burn
 * reviewed weekly for two months produced a folder of notes and no curve, and
 * whether it was healing was a matter of recollection.
 *
 * This puts the same tracking inside each of those modules: the wounds already
 * being followed for this patient, their trend, and one control to start
 * following a new one. The measurement, the photographs and the analytics are
 * the progress monitor's — nothing is reimplemented here, because two
 * implementations of "is this wound healing" is how they come to disagree.
 */

import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import {
  Activity, Plus, Loader2, ChevronRight, TrendingUp, TrendingDown, Minus,
} from 'lucide-react';
import { listWounds, createWound, HEALING_STATUS_META, type Wound } from '../../services/woundMonitorService';

interface Props {
  patientId: number | string | null | undefined;
  hospitalNumber?: string;
  /**
   * Pre-fills the wound type when a module only ever deals with one kind — a
   * burn module has no business offering "pressure sore".
   */
  defaultWoundType?: string;
  /** Suggested label, e.g. "Left leg burn". */
  defaultLabel?: string;
  className?: string;
}

export function WoundTrackingPanel({
  patientId, hospitalNumber, defaultWoundType, defaultLabel, className = '',
}: Props) {
  const [wounds, setWounds] = useState<Wound[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    if (patientId == null) { setLoading(false); return; }
    setLoading(true);
    try {
      setWounds(await listWounds(patientId));
      setError('');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load the tracked wounds.');
    } finally {
      setLoading(false);
    }
  }, [patientId]);

  useEffect(() => { void load(); }, [load]);

  const startTracking = useCallback(async () => {
    if (patientId == null) return;
    setCreating(true);
    setError('');
    try {
      await createWound({
        patient_id: patientId,
        hospital_number: hospitalNumber,
        label: defaultLabel || defaultWoundType || 'Wound',
        wound_type: defaultWoundType,
        date_first_seen: new Date().toISOString().slice(0, 10),
        status: 'active',
      });
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not start tracking this wound.');
    } finally {
      setCreating(false);
    }
  }, [patientId, hospitalNumber, defaultLabel, defaultWoundType, load]);

  // Nothing to attach tracking to yet.
  if (patientId == null) return null;

  return (
    <section className={`bg-white rounded-xl border p-4 ${className}`}>
      <div className="flex items-center justify-between gap-3 mb-3">
        <h3 className="text-sm font-semibold text-gray-800 flex items-center gap-2">
          <Activity className="w-4 h-4 text-teal-600" />
          Wound progress
        </h3>
        <Link
          to="/wound-monitor"
          className="text-xs font-medium text-teal-700 hover:text-teal-900 flex items-center gap-1"
        >
          Open the monitor <ChevronRight className="w-3.5 h-3.5" />
        </Link>
      </div>

      {loading ? (
        <div className="flex items-center gap-2 text-sm text-gray-500 py-3">
          <Loader2 className="w-4 h-4 animate-spin" /> Loading…
        </div>
      ) : wounds.length ? (
        <ul className="space-y-1.5">
          {wounds.map((w) => <WoundRow key={String(w.id)} wound={w} />)}
        </ul>
      ) : (
        <p className="text-sm text-gray-500 py-2">
          No wound is being measured for this patient yet. Tracking one records its
          area over time, with the photograph behind every number.
        </p>
      )}

      {error && <p className="text-xs text-red-600 mt-2">{error}</p>}

      <button
        onClick={startTracking}
        disabled={creating}
        className="mt-3 w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg border border-teal-300 text-teal-700 text-sm font-medium hover:bg-teal-50 disabled:opacity-60"
      >
        {creating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
        {creating ? 'Starting…' : `Track a new ${defaultWoundType?.toLowerCase() || 'wound'}`}
      </button>
    </section>
  );
}

function WoundRow({ wound }: { wound: Wound }) {
  const meta = wound.healing_status ? HEALING_STATUS_META[wound.healing_status] : null;
  const latest = wound.latest_area_cm2;
  const baseline = wound.baseline_area_cm2;

  // Direction of travel, which is the question the module is being asked.
  let Trend = Minus;
  let trendTone = 'text-gray-400';
  if (latest != null && baseline != null && baseline > 0) {
    const change = (latest - baseline) / baseline;
    if (change < -0.05) { Trend = TrendingDown; trendTone = 'text-green-600'; }
    else if (change > 0.05) { Trend = TrendingUp; trendTone = 'text-red-600'; }
  }

  return (
    <li>
      <Link
        to="/wound-monitor"
        className="flex items-center justify-between gap-3 px-2 py-2 rounded-lg hover:bg-gray-50"
      >
        <span className="min-w-0">
          <span className="block text-sm text-gray-800 truncate">
            {wound.label || wound.wound_type || 'Wound'}
          </span>
          <span className="block text-[11px] text-gray-400 truncate">
            {[wound.anatomical_location, wound.body_side].filter(Boolean).join(' · ') || 'No site recorded'}
          </span>
        </span>
        <span className="flex items-center gap-2 shrink-0">
          {latest != null && (
            <span className="text-xs font-medium text-gray-700 tabular-nums">
              {Number(latest).toFixed(1)} cm²
            </span>
          )}
          <Trend className={`w-3.5 h-3.5 ${trendTone}`} />
          {meta && (
            <span className={`w-2 h-2 rounded-full ${meta.dot}`} title={meta.label} />
          )}
        </span>
      </Link>
    </li>
  );
}

export default WoundTrackingPanel;

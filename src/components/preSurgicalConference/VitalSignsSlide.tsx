import { Activity, AlertTriangle, Calendar, User } from 'lucide-react';
import { ConferenceVitalSigns } from '../../services/preSurgicalConferenceService';

/**
 * The patient's most recent observations, as read to the room.
 *
 * TWO RULES THIS SLIDE ENFORCES
 *
 * 1. A value nobody recorded reads "Not documented", never a blank or a zero.
 *    This slide is projected and decided on; an absent blood pressure that
 *    renders as empty space is read by a tired room as "nothing remarkable".
 *
 * 2. Out-of-range values are flagged, but the flag is a prompt to look, not a
 *    diagnosis. The thresholds below are the ordinary adult observation-chart
 *    trigger points — they say "say this one out loud", nothing more, and the
 *    reading itself is always shown beside the flag.
 *
 * Staleness is on the face of the slide for the same reason: a set of
 * observations from four days ago is not a pre-operative assessment, and the
 * date is the only thing that tells the room which it is looking at.
 */

interface Props {
  vitalSigns: ConferenceVitalSigns | null;
}

/** Ordinary adult trigger points. Deliberately wide — this prompts a look. */
const RANGES = {
  temperature: { low: 36.0, high: 37.5, unit: '°C', label: 'Temperature' },
  pulse: { low: 60, high: 100, unit: 'bpm', label: 'Pulse' },
  bp_systolic: { low: 90, high: 140, unit: 'mmHg', label: 'Systolic BP' },
  bp_diastolic: { low: 60, high: 90, unit: 'mmHg', label: 'Diastolic BP' },
  respiratory_rate: { low: 12, high: 20, unit: '/min', label: 'Respiratory rate' },
  spo2: { low: 95, high: 100, unit: '%', label: 'SpO₂' },
} as const;

type RangedKey = keyof typeof RANGES;

function isOutOfRange(key: RangedKey, value: number | null): boolean {
  if (value == null) return false;
  const r = RANGES[key];
  return value < r.low || value > r.high;
}

/** How long ago these observations were taken, in words. */
function ageOf(dateIso: string | null): { text: string; stale: boolean } | null {
  if (!dateIso) return null;
  const then = new Date(dateIso).getTime();
  if (!Number.isFinite(then)) return null;

  const hours = (Date.now() - then) / 36e5;
  if (hours < 1) return { text: 'within the last hour', stale: false };
  if (hours < 24) return { text: `${Math.round(hours)} hour${Math.round(hours) === 1 ? '' : 's'} ago`, stale: hours > 12 };
  const days = Math.round(hours / 24);
  return { text: `${days} day${days === 1 ? '' : 's'} ago`, stale: true };
}

function Reading({
  label, value, unit, flagged,
}: { label: string; value: number | null; unit: string; flagged: boolean }) {
  const documented = value != null;

  return (
    <div
      className={`rounded-xl p-5 border-2 ${
        !documented
          ? 'bg-gray-800/40 border-gray-700'
          : flagged
            ? 'bg-amber-950/40 border-amber-500'
            : 'bg-gray-800/70 border-gray-600'
      }`}
    >
      <div className="text-sm text-gray-400 mb-1 flex items-center gap-1.5">
        {label}
        {flagged && <AlertTriangle className="w-3.5 h-3.5 text-amber-400" aria-label="outside usual range" />}
      </div>
      {documented ? (
        <div className={`text-3xl font-bold tabular-nums ${flagged ? 'text-amber-300' : 'text-white'}`}>
          {value}
          <span className="text-base font-normal text-gray-400 ml-1">{unit}</span>
        </div>
      ) : (
        <div className="text-xl font-semibold text-gray-500 italic">Not documented</div>
      )}
    </div>
  );
}

export default function VitalSignsSlide({ vitalSigns }: Props) {
  if (!vitalSigns) {
    return (
      <div className="flex flex-col items-center justify-center h-full">
        <Activity className="h-24 w-24 text-gray-500 mb-4" />
        <h2 className="text-lg sm:text-2xl font-bold text-gray-400">No Observations Recorded</h2>
        <p className="text-gray-500 mt-2">
          No vital signs have been documented for this patient
        </p>
        <p className="text-amber-400 mt-4 text-sm max-w-md text-center">
          A patient going to theatre without a recorded set of observations is
          itself a finding worth raising in the brief.
        </p>
      </div>
    );
  }

  const v = vitalSigns;
  const age = ageOf(v.date);

  const bpFlagged =
    isOutOfRange('bp_systolic', v.bp_systolic) || isOutOfRange('bp_diastolic', v.bp_diastolic);
  const bpDocumented = v.bp_systolic != null && v.bp_diastolic != null;

  const flaggedCount = (['temperature', 'pulse', 'respiratory_rate', 'spo2'] as RangedKey[])
    .filter(k => isOutOfRange(k, v[k] as number | null)).length + (bpFlagged ? 1 : 0);

  return (
    <div className="max-w-6xl mx-auto space-y-8">
      <div className="text-center mb-8">
        <div className="w-20 h-20 bg-rose-600 rounded-full flex items-center justify-center mx-auto mb-4">
          <Activity className="w-10 h-10 text-white" />
        </div>
        <h2 className="text-2xl sm:text-3xl font-bold">Current Vital Signs</h2>

        <div className="flex flex-wrap items-center justify-center gap-4 mt-3 text-sm">
          {age && (
            <span className={`flex items-center gap-1.5 ${age.stale ? 'text-amber-400' : 'text-gray-400'}`}>
              <Calendar className="w-4 h-4" />
              Recorded {age.text}
              {age.stale && ' — confirm before theatre'}
            </span>
          )}
          {v.recorded_by && (
            <span className="flex items-center gap-1.5 text-gray-400">
              <User className="w-4 h-4" />
              {v.recorded_by}
            </span>
          )}
        </div>

        {flaggedCount > 0 && (
          <p className="mt-3 inline-flex items-center gap-2 text-amber-300 bg-amber-950/40 border border-amber-600 rounded-full px-4 py-1.5 text-sm">
            <AlertTriangle className="w-4 h-4" />
            {flaggedCount} reading{flaggedCount === 1 ? '' : 's'} outside the usual range — read aloud
          </p>
        )}
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        <Reading
          label={RANGES.temperature.label}
          value={v.temperature}
          unit={RANGES.temperature.unit}
          flagged={isOutOfRange('temperature', v.temperature)}
        />
        <Reading
          label={RANGES.pulse.label}
          value={v.pulse}
          unit={RANGES.pulse.unit}
          flagged={isOutOfRange('pulse', v.pulse)}
        />

        {/* Blood pressure is one clinical reading, so it is shown as one tile
            rather than two unrelated numbers. */}
        <div
          className={`rounded-xl p-5 border-2 ${
            !bpDocumented
              ? 'bg-gray-800/40 border-gray-700'
              : bpFlagged
                ? 'bg-amber-950/40 border-amber-500'
                : 'bg-gray-800/70 border-gray-600'
          }`}
        >
          <div className="text-sm text-gray-400 mb-1 flex items-center gap-1.5">
            Blood pressure
            {bpFlagged && <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />}
          </div>
          {bpDocumented ? (
            <div className={`text-3xl font-bold tabular-nums ${bpFlagged ? 'text-amber-300' : 'text-white'}`}>
              {v.bp_systolic}/{v.bp_diastolic}
              <span className="text-base font-normal text-gray-400 ml-1">mmHg</span>
            </div>
          ) : (
            <div className="text-xl font-semibold text-gray-500 italic">Not documented</div>
          )}
        </div>

        <Reading
          label={RANGES.respiratory_rate.label}
          value={v.respiratory_rate}
          unit={RANGES.respiratory_rate.unit}
          flagged={isOutOfRange('respiratory_rate', v.respiratory_rate)}
        />
        <Reading
          label={RANGES.spo2.label}
          value={v.spo2}
          unit={RANGES.spo2.unit}
          flagged={isOutOfRange('spo2', v.spo2)}
        />
        {/* Weight carries no range: it is here because dosing and positioning
            depend on it, not because it can be abnormal. */}
        <Reading label="Weight" value={v.weight} unit="kg" flagged={false} />
      </div>
    </div>
  );
}

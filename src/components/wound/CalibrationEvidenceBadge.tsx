/**
 * Whether this measurement is calibrated, and the proof either way.
 *
 * A wound area in square centimetres is only a measurement if something of
 * known physical size was in the frame. Without that there is no way to turn
 * pixels into centimetres, and a number produced anyway is invented — which is
 * exactly what used to happen here: the pipeline assumed every photograph was
 * twenty centimetres across and reported the result to two decimal places.
 *
 * So this does not show a tick and the word "calibrated". It shows what was
 * found, what size it was taken to be, and how many pixels it spanned — the
 * arithmetic behind the scale, in the open. A clinician can hold that against
 * the photograph: if it claims a 10 cm bar spanned 412 pixels, either the bar
 * in the picture is that long or the scale is wrong, and they can tell which.
 */

import { Ruler, ShieldCheck, ShieldAlert, AlertTriangle, Hand } from 'lucide-react';
import type { CalibrationEvidence } from '../../services/aiWoundMeasurement';

interface Props {
  calibrated: boolean;
  /** True when the scale is trustworthy for absolute centimetres. */
  reliable: boolean;
  evidence?: CalibrationEvidence;
  /** 0–1 confidence in the scale detection alone. */
  confidence?: number;
  onSetScale?: () => void;
  className?: string;
}

export function CalibrationEvidenceBadge({
  calibrated, reliable, evidence, confidence, onSetScale, className = '',
}: Props) {
  // Three states, and they are genuinely different things:
  //   none      no reference at all — there is no measurement in centimetres
  //   weak      something was found but it is not trustworthy
  //   good      a reference was found or set, and the scale holds up
  const state = !calibrated ? 'none' : reliable ? 'good' : 'weak';

  const tone = {
    none: 'bg-red-50 border-red-200 text-red-900',
    weak: 'bg-amber-50 border-amber-300 text-amber-900',
    good: 'bg-green-50 border-green-200 text-green-900',
  }[state];

  const Icon = { none: ShieldAlert, weak: AlertTriangle, good: ShieldCheck }[state];
  const iconTone = {
    none: 'text-red-600', weak: 'text-amber-600', good: 'text-green-600',
  }[state];

  return (
    <div className={`rounded-lg border p-2.5 ${tone} ${className}`}>
      <div className="flex items-start gap-2">
        <Icon className={`w-4 h-4 mt-0.5 shrink-0 ${iconTone}`} />
        <div className="min-w-0 flex-1">
          {state === 'none' && (
            <>
              <p className="text-xs font-semibold">Not calibrated — no measurement in centimetres.</p>
              <p className="text-xs mt-0.5">
                Nothing of known size was found in this photograph, so pixels cannot be
                converted to centimetres. Set the scale against a ruler or the printed
                marker, or enter the dimensions by hand.
              </p>
            </>
          )}

          {state !== 'none' && evidence && (
            <>
              <p className="text-xs font-semibold flex flex-wrap items-center gap-1.5">
                {state === 'good' ? 'Calibrated' : 'Calibrated, but weakly'} against {evidence.reference}
                {evidence.confirmedByPerson && (
                  <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-white/70 text-[10px] font-medium">
                    <Hand className="w-2.5 h-2.5" /> set by hand
                  </span>
                )}
              </p>

              {/* The arithmetic, so the claim is checkable rather than trusted. */}
              <dl className="mt-1.5 grid grid-cols-3 gap-x-3 gap-y-0.5 text-[11px]">
                <div>
                  <dt className="opacity-70">Known size</dt>
                  <dd className="font-medium tabular-nums">{evidence.knownSizeCm} cm</dd>
                </div>
                <div>
                  <dt className="opacity-70">Spanned</dt>
                  <dd className="font-medium tabular-nums">{evidence.measuredPixels} px</dd>
                </div>
                <div>
                  <dt className="opacity-70">Scale</dt>
                  <dd className="font-medium tabular-nums">
                    {evidence.pixelsPerCm.toFixed(1)} px/cm
                  </dd>
                </div>
              </dl>

              {evidence.locationPx && (
                <p className="text-[11px] mt-1 opacity-80">
                  Found {describeLocation(evidence.locationPx)} of the photograph.
                </p>
              )}

              {state === 'weak' && (
                <p className="text-xs mt-1.5">
                  The reference was detected but not clearly
                  {typeof confidence === 'number' ? ` (${Math.round(confidence * 100)}% confidence)` : ''}.
                  Treat the centimetres as approximate, or set the scale by hand.
                </p>
              )}
            </>
          )}

          {/* A scale with no evidence behind it is not something to display as
              proven, however confident the detector was. */}
          {state !== 'none' && !evidence && (
            <p className="text-xs">
              A scale was applied, but this measurement carries no record of what it
              was calibrated against. Set the scale by hand to be sure of the size.
            </p>
          )}

          {onSetScale && (
            <button
              onClick={onSetScale}
              className="mt-2 inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium bg-white/80 hover:bg-white border border-current/20"
            >
              <Ruler className="w-3 h-3" />
              {state === 'none' ? 'Set the scale' : 'Set the scale by hand'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * Where in the frame something sat, in words rather than co-ordinates.
 *
 * Takes fractions of the frame, which is what the detector records — coarse on
 * purpose, because the point is to help someone find it by eye.
 */
function describeLocation(box: { x: number; y: number; width: number; height: number }): string {
  const cx = box.x + box.width / 2;
  const cy = box.y + box.height / 2;
  const across = cx < 0.34 ? 'left' : cx > 0.66 ? 'right' : 'centre';
  const down = cy < 0.34 ? 'top' : cy > 0.66 ? 'bottom' : 'middle';
  if (across === 'centre' && down === 'middle') return 'in the middle';
  if (across === 'centre') return `at the ${down}`;
  if (down === 'middle') return `on the ${across}`;
  return `at the ${down} ${across}`;
}

export default CalibrationEvidenceBadge;

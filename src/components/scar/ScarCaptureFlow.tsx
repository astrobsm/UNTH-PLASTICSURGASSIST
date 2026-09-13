/**
 * A scar assessment, from photograph to measurement.
 *
 * This was the missing half. "New assessment" created an empty row and showed
 * the scales form — there was no photography, no calibration, no area and no
 * height, so every lesion sat at "Not enough data" however many assessments
 * were opened.
 *
 * The flow is two calibrated views, and the second is optional:
 *
 *   TOP-DOWN   photograph → quality gate → crop → calibrate → trace
 *              gives area, perimeter and the tissue composition
 *
 *   LATERAL    photograph → crop → calibrate → trace skin line and profile
 *              gives height, and with the area, volume
 *
 * Both reuse the same camera, the same quality gate and the same tracer as the
 * wound and graft modules. The only thing specific to a scar is what the two
 * views are combined into.
 */

import { useState, useRef, useCallback } from 'react';
import {
  Camera, X, Loader2, CheckCircle2, AlertTriangle, Upload, Save, Ruler,
  Pencil, Mountain, Info, ShieldAlert,
} from 'lucide-react';
import { aiWoundMeasurement } from '../../services/aiWoundMeasurement';
import { assessImageQuality, type ImageQualityReport } from '../../services/woundImageQuality';
import { putLocalImage } from '../../services/woundImageStore';
import { addAssessment } from '../../services/woundMonitorService';
import { RegionTracer, type TraceResult, type ElevationResult } from '../wound/RegionTracer';
import { scarService, type ScarCase } from '../../services/scarService';

const PIPELINE_VERSION = '2026.08-cv1';

type Step =
  | 'capture-top' | 'analysing' | 'trace-top'
  | 'review' | 'capture-side' | 'trace-side' | 'saving';

interface Props {
  scar: ScarCase;
  onClose: () => void;
  onSaved: () => void;
}

export function ScarCaptureFlow({ scar, onClose, onSaved }: Props) {
  const [step, setStep] = useState<Step>('capture-top');
  const [error, setError] = useState('');
  const [quality, setQuality] = useState<ImageQualityReport | null>(null);

  const [topUrl, setTopUrl] = useState('');
  const [topPxPerCm, setTopPxPerCm] = useState<number | null>(null);
  const [trace, setTrace] = useState<TraceResult | null>(null);

  const [sideUrl, setSideUrl] = useState('');
  const [sidePxPerCm, setSidePxPerCm] = useState<number | null>(null);
  const [elevation, setElevation] = useState<ElevationResult | null>(null);
  const [elevationResult, setElevationResult] = useState<{
    profile: { maxElevationCm: number; meanElevationCm: number };
    volume: { ok: boolean; volumeCm3?: number; rangeCm3?: [number, number]; uncertaintyNote?: string };
    quality: { grade: string; reason: string };
  } | null>(null);

  const topRef = useRef<string | null>(null);
  const sideRef = useRef<string | null>(null);
  const which = useRef<'top' | 'side'>('top');

  /**
   * Gate, store, and try to find the marker.
   *
   * Auto-detection is only ever a convenience here: it recognises the printed
   * green markers, grid paper and ruler ticks. When it fails the tracer's own
   * calibration takes over — drag along the marker, give its length — which is
   * why a failure is not reported as an error.
   */
  const ingest = useCallback(async (blob: Blob, w: number, h: number, data: ImageData) => {
    setStep('analysing');
    setError('');
    try {
      const q = assessImageQuality(data.data, w, h);
      setQuality(q);
      if (!q.usable) {
        setError(
          'Photograph unsuitable for measurement. '
          + q.findings.filter((f) => f.severity === 'blocking').map((f) => f.message).join(' ')
          + ' Please recapture.',
        );
        setStep(which.current === 'top' ? 'capture-top' : 'capture-side');
        return;
      }

      const url = URL.createObjectURL(blob);
      try {
        const ref = await putLocalImage({
          blob, kind: 'original', width: w, height: h,
          woundId: Number(scar.wound_id), patientId: Number(scar.patient_id),
        });
        if (which.current === 'top') topRef.current = ref; else sideRef.current = ref;
      } catch (e) {
        console.warn('[scar] could not store the photograph locally:', e);
      }

      let ppc: number | null = null;
      try {
        await aiWoundMeasurement.initialize();
        const cal = await aiWoundMeasurement.detectCalibration(data);
        // Only a found green marker is applied automatically. type 'none'
        // means nothing of known size was seen, and requiresConfirmation
        // means a texture-based detector *guessed* — on a face with no marker
        // the ruler detector reported 30 px/cm, which would have made every
        // area wrong by an unknown factor while looking precise.
        //
        // A suggestion is discarded here rather than shown: the clinician
        // calibrates against their own marker in the tracer, which is a
        // measurement rather than a guess.
        if (cal && cal.type !== 'none' && !cal.requiresConfirmation
            && cal.knownSizeCm > 0 && cal.pixelSize > 0) {
          ppc = cal.pixelSize / cal.knownSizeCm;
        }
      } catch { /* the tracer's manual calibration covers this */ }

      if (which.current === 'top') {
        setTopUrl(url);
        setTopPxPerCm(ppc);
        setStep('trace-top');
      } else {
        setSideUrl(url);
        setSidePxPerCm(ppc);
        setStep('trace-side');
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not process the photograph.');
      setStep(which.current === 'top' ? 'capture-top' : 'capture-side');
    }
  }, [scar.wound_id, scar.patient_id]);

  const fromFile = useCallback(async (file: File) => {
    const bmp = await createImageBitmap(file);
    const canvas = document.createElement('canvas');
    canvas.width = bmp.width;
    canvas.height = bmp.height;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return;
    ctx.drawImage(bmp, 0, 0);
    await ingest(file, canvas.width, canvas.height, ctx.getImageData(0, 0, canvas.width, canvas.height));
  }, [ingest]);

  /** Saves the assessment, then the graft-specific and 3D parts of it. */
  const save = async () => {
    if (!trace) return;
    setStep('saving');
    setError('');
    try {
      const saved = await addAssessment({
        wound_id: Number(scar.wound_id),
        patient_id: Number(scar.patient_id),
        image_url: topRef.current ? `/wound-images?ref=${topRef.current}` : undefined,
        area_cm2: trace.totalAreaCm2,
        // No wound-bed composition. A keloid has no granulation, slough,
        // eschar or epithelialising edge — writing zeros for them would put
        // four measurements in the record that nobody made and that mean
        // nothing for this lesion.
        tissue_source: 'none',
        calibration_type: trace.calibrationSource === 'traced' ? 'manual:marker' : 'auto:marker',
        scale_reliable: true,
        contour_cm: trace.totalRegions as never,
        image_quality_score: quality?.score,
        image_quality_flags: quality?.flags as never,
        model_name: 'on-device-cv',
        model_version: PIPELINE_VERSION,
        preprocessing_version: PIPELINE_VERSION,
        assessed_at: new Date().toISOString(),
      } as never);

      const woundAssessmentId = Number((saved as { id?: number }).id);

      const { assessment } = await scarService.openAssessment({
        scarId: scar.id,
        woundAssessmentId: Number.isFinite(woundAssessmentId) ? woundAssessmentId : undefined,
        measurementMethod: 'clinician_traced',
        qualityFlag: (quality?.score ?? 0) >= 0.75 ? 'high' : 'acceptable',
      });

      // The third dimension, when a lateral view was traced.
      if (elevation) {
        await scarService.putElevation({
          assessmentId: assessment.id,
          profilePx: elevation.profilePx,
          baselinePx: elevation.baselinePx,
          pixelsPerCm: elevation.pixelsPerCm,
          areaCm2: trace.totalAreaCm2,
        }).catch((e) => console.warn('[scar] elevation not stored:', e));
      }

      onSaved();
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save the assessment.');
      setStep('review');
    }
  };

  // ---- tracers, full screen ------------------------------------------------

  if (step === 'trace-top') {
    return (
      <RegionTracer
        imageUrl={topUrl}
        detectedPixelsPerCm={topPxPerCm}
        siteRole="donor"
        purpose="lesion"
        onCancel={() => setStep('capture-top')}
        onConfirm={(r) => { setTrace(r); setStep('review'); }}
      />
    );
  }

  if (step === 'trace-side') {
    return (
      <RegionTracer
        imageUrl={sideUrl}
        detectedPixelsPerCm={sidePxPerCm}
        siteRole="donor"
        purpose="elevation"
        onCancel={() => setStep('review')}
        onConfirmElevation={async (r) => {
          setElevation(r);
          setStep('review');
          // Measured server-side so the same arithmetic serves every caller.
          try {
            const res = await scarService.previewElevation({
              profilePx: r.profilePx, baselinePx: r.baselinePx,
              pixelsPerCm: r.pixelsPerCm, areaCm2: trace?.totalAreaCm2,
            });
            setElevationResult(res);
          } catch { /* the numbers appear once the assessment is saved */ }
        }}
      />
    );
  }

  // ---- the dialog ---------------------------------------------------------

  const capturing = step === 'capture-top' || step === 'capture-side';

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-start sm:items-center justify-center p-0 sm:p-4 overflow-y-auto">
      <div className="bg-white w-full sm:max-w-lg sm:rounded-2xl min-h-screen sm:min-h-0">
        <header className="flex items-center gap-3 px-4 py-3 border-b">
          <Camera className="w-5 h-5 text-purple-600 shrink-0" />
          <div className="min-w-0 flex-1">
            <h2 className="font-semibold text-gray-900 truncate">
              {scar.label || 'Scar'} — new assessment
            </h2>
            <p className="text-xs text-gray-500">
              {step === 'capture-side'
                ? 'Lateral view, for height and volume'
                : 'Top-down view, for area — include the calibration marker'}
            </p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100" aria-label="Close">
            <X className="w-5 h-5 text-gray-400" />
          </button>
        </header>

        <div className="p-4 space-y-4">
          {step === 'analysing' && (
            <div className="flex flex-col items-center gap-2 py-10 text-gray-500">
              <Loader2 className="w-7 h-7 animate-spin" />
              <p className="text-sm">Checking quality and looking for the marker…</p>
            </div>
          )}

          {capturing && (
            <>
              <div className="rounded-xl border-2 border-dashed p-6 text-center">
                <Camera className="w-8 h-8 mx-auto text-gray-300 mb-2" />
                <p className="text-sm text-gray-700 font-medium">
                  {step === 'capture-side'
                    ? 'Photograph the lesion from the side'
                    : 'Photograph the lesion from directly above'}
                </p>
                <p className="text-xs text-gray-500 mt-1 max-w-sm mx-auto">
                  {step === 'capture-side'
                    ? 'The profile against the skin is what gives height. Keep the marker in the '
                      + 'same plane as the lesion.'
                    : 'Lay the calibration marker flat beside the lesion, in the same plane. '
                      + 'You can crop to the lesion in the next step.'}
                </p>
                <label className="mt-4 inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-purple-600 text-white text-sm font-semibold cursor-pointer hover:bg-purple-700">
                  <Upload className="w-4 h-4" /> Take or choose a photograph
                  <input
                    type="file" accept="image/*" capture="environment" className="sr-only"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      which.current = step === 'capture-side' ? 'side' : 'top';
                      if (f) void fromFile(f);
                      e.target.value = '';
                    }}
                  />
                </label>
              </div>

              {step === 'capture-side' && (
                <button
                  onClick={() => setStep('review')}
                  className="w-full py-2 text-sm text-gray-600 underline hover:no-underline"
                >
                  Skip the lateral view — record area only
                </button>
              )}
            </>
          )}

          {step === 'review' && trace && (
            <>
              <div className="grid grid-cols-2 gap-2.5">
                <Cell label="Area" value={`${trace.totalAreaCm2.toFixed(1)} cm²`} emphasis />
                <Cell label="Scale"
                      value={`${trace.pixelsPerCm.toFixed(1)} px/cm`}
                      hint={trace.calibrationSource} />
                <Cell label="Image quality"
                      value={`${Math.round((quality?.score ?? 0) * 100)}%`}
                      ok={(quality?.score ?? 0) >= 0.6} />
                <Cell label="Height"
                      value={elevationResult
                        ? `${(elevationResult.profile.maxElevationCm * 10).toFixed(1)} mm`
                        : elevation ? 'measuring…' : '—'}
                      hint={elevation ? undefined : 'lateral view not taken'} />
              </div>

              {elevationResult?.volume?.ok && (
                <div className="rounded-xl border border-purple-200 bg-purple-50 p-3">
                  <p className="text-sm font-semibold text-purple-900">
                    Volume ≈ {elevationResult.volume.volumeCm3} cm³
                  </p>
                  <p className="text-xs text-purple-800 mt-0.5">
                    {elevationResult.volume.uncertaintyNote}
                  </p>
                  <p className="text-[11px] text-purple-700 mt-1">
                    Profile quality: {elevationResult.quality.grade} — {elevationResult.quality.reason}
                  </p>
                </div>
              )}

              {!elevation && (
                <button
                  onClick={() => { which.current = 'side'; setStep('capture-side'); }}
                  className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl border-2 border-dashed border-purple-300 text-purple-700 text-sm font-medium hover:bg-purple-50"
                >
                  <Mountain className="w-4 h-4" />
                  Add a lateral view for height and volume
                </button>
              )}

              <p className="flex items-start gap-1.5 text-[11px] text-gray-500">
                <Info className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                Scales, examination and the patient's own report are recorded after saving —
                they are what the photograph cannot supply.
              </p>
            </>
          )}

          {error && (
            <div role="alert" className="flex items-start gap-2 p-3 rounded-xl bg-red-50 border border-red-200 text-sm text-red-800">
              <ShieldAlert className="w-4 h-4 mt-0.5 shrink-0" /> {error}
            </div>
          )}

          {step === 'review' && trace && (
            <div className="flex gap-2">
              <button
                onClick={() => setStep('trace-top')}
                className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl border font-medium text-gray-700"
              >
                <Pencil className="w-4 h-4" /> Edit tracing
              </button>
              <button
                onClick={() => void save()}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-purple-600 text-white font-semibold hover:bg-purple-700"
              >
                <Save className="w-4 h-4" /> Save assessment
              </button>
            </div>
          )}

          {step === 'saving' && (
            <div className="flex items-center justify-center gap-2 py-6 text-gray-500">
              <Loader2 className="w-5 h-5 animate-spin" /> Saving…
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Cell({ label, value, ok, hint, emphasis }: {
  label: string; value: string; ok?: boolean; hint?: string; emphasis?: boolean;
}) {
  return (
    <div className={`rounded-xl border p-2.5 ${emphasis ? 'bg-purple-50 border-purple-200' : 'bg-gray-50'}`}>
      <p className="text-[11px] text-gray-500 leading-tight">{label}</p>
      <p className={`font-bold tabular-nums ${emphasis ? 'text-xl text-purple-800' : 'text-base text-gray-900'}`}>
        {value}
        {ok === true && <CheckCircle2 className="w-3.5 h-3.5 inline ml-1 -mt-0.5 text-green-600" />}
        {ok === false && <AlertTriangle className="w-3.5 h-3.5 inline ml-1 -mt-0.5 text-amber-500" />}
      </p>
      {hint && <p className="text-[10px] text-gray-400 truncate">{hint}</p>}
    </div>
  );
}

export default ScarCaptureFlow;

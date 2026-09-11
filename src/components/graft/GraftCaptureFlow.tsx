/**
 * Guided photographic capture for a graft site (§33, §34, §57 steps 4–14).
 *
 * TWO WAYS TO GET AN IMAGE, ON PURPOSE
 *
 * The live camera gives what §33 asks for: an alignment guide, a quality meter
 * that moves as the phone moves, and a shutter that will not fire on a
 * photograph the pipeline would refuse. That needs getUserMedia, which needs a
 * secure context and a browser the ward's device management has not locked
 * down.
 *
 * Where it is unavailable the native camera is used instead, through the same
 * `<input capture>` the rest of the app uses. That is not a downgrade for the
 * measurement — the native camera focuses and stabilises better than a video
 * frame — only for the guidance, so the same quality gate runs on the captured
 * frame and sends the clinician back if it fails. Neither path can save a
 * photograph the gate rejects.
 *
 * WHAT HAPPENS AFTER THE SHUTTER
 *
 *   quality gate → calibration → segmentation → overlay → review → save
 *
 * all of it the existing wound pipeline, unchanged. The only graft-specific
 * step is the last: once the assessment is saved, /skin-grafts/analyse turns
 * its area into take, trend, prediction and alerts.
 */

import { useState, useRef, useEffect, useCallback } from 'react';
import {
  Camera, X, Loader2, CheckCircle2, AlertTriangle, RefreshCw, Ruler,
  Upload, Save, ShieldAlert, Info, Pencil,
} from 'lucide-react';
import { aiWoundMeasurement } from '../../services/aiWoundMeasurement';
import { assessImageQuality, type ImageQualityReport } from '../../services/woundImageQuality';
import { renderContourOverlay } from '../../services/woundOverlayRenderer';
import { putLocalImage } from '../../services/woundImageStore';
import { addAssessment } from '../../services/woundMonitorService';
import { skinGraftService, type GraftSite } from '../../services/skinGraftService';
import { RegionTracer, type TraceResult } from '../wound/RegionTracer';
import { LAYER_META } from '../../services/tracedRegions';

const PIPELINE_VERSION = '2026.08-cv1';

/** How often the live preview is re-scored. Cheap enough at a quarter second. */
const LIVE_SAMPLE_MS = 250;
/** The live meter downsamples; scoring a full frame every tick is wasteful. */
const LIVE_SAMPLE_WIDTH = 320;

interface Props {
  site: GraftSite;
  patientId: number | string;
  onClose: () => void;
  onSaved: () => void;
}

type Stage = 'capture' | 'analysing' | 'review' | 'tracing' | 'saving';

export function GraftCaptureFlow({ site, patientId, onClose, onSaved }: Props) {
  const [stage, setStage] = useState<Stage>('capture');
  const [error, setError] = useState('');

  // Live preview
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [liveReady, setLiveReady] = useState(false);
  const [liveUnavailable, setLiveUnavailable] = useState<string>('');
  const [liveQuality, setLiveQuality] = useState<ImageQualityReport | null>(null);

  // Captured result
  const [previewUrl, setPreviewUrl] = useState<string>('');
  const [overlayUrl, setOverlayUrl] = useState<string>('');
  const [quality, setQuality] = useState<ImageQualityReport | null>(null);
  const [measurement, setMeasurement] = useState<{
    areaCm2: number; perimeterCm: number; lengthCm: number; widthCm: number;
    calibrated: boolean; scaleReliable: boolean; calibrationType: string;
    pixelsPerCm: number; confidence: number; contourCm: unknown;
  } | null>(null);
  const imageRefRef = useRef<string | null>(null);
  // What the clinician traced, when they did. It supersedes the automated
  // proportion because both of its outlines come from this one photograph.
  const [trace, setTrace] = useState<TraceResult | null>(null);
  const overlayRefRef = useRef<string | null>(null);

  const isDonor = site.site_role === 'donor';

  // ---- the live camera ----------------------------------------------------

  const stopCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setLiveReady(false);
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!navigator.mediaDevices?.getUserMedia) {
        setLiveUnavailable('This browser does not offer a live camera.');
        return;
      }
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: 'environment' }, width: { ideal: 1920 }, height: { ideal: 1080 } },
          audio: false,
        });
        if (cancelled) { stream.getTracks().forEach((t) => t.stop()); return; }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play().catch(() => {});
        }
        setLiveReady(true);
      } catch (e) {
        // Denied, unavailable, or an insecure context. The native camera still
        // works, so this is a note rather than a failure.
        setLiveUnavailable(
          e instanceof Error && e.name === 'NotAllowedError'
            ? 'Camera permission was declined.'
            : 'A live camera is not available on this device.',
        );
      }
    })();
    return () => { cancelled = true; stopCamera(); };
  }, [stopCamera]);

  // The live quality meter. Scored on a downsampled frame so it can run four
  // times a second without heating the phone.
  useEffect(() => {
    if (!liveReady || stage !== 'capture') return;
    const scratch = document.createElement('canvas');
    const id = window.setInterval(() => {
      const v = videoRef.current;
      if (!v || !v.videoWidth) return;
      const w = LIVE_SAMPLE_WIDTH;
      const h = Math.max(1, Math.round((v.videoHeight / v.videoWidth) * w));
      scratch.width = w; scratch.height = h;
      const ctx = scratch.getContext('2d', { willReadFrequently: true });
      if (!ctx) return;
      ctx.drawImage(v, 0, 0, w, h);
      try {
        setLiveQuality(assessImageQuality(ctx.getImageData(0, 0, w, h).data, w, h));
      } catch { /* a dropped sample is replaced by the next one */ }
    }, LIVE_SAMPLE_MS);
    return () => window.clearInterval(id);
  }, [liveReady, stage]);

  // ---- capture and analyse -------------------------------------------------

  const analyse = useCallback(async (blob: Blob, width: number, height: number, imageData: ImageData) => {
    setStage('analysing');
    setError('');
    try {
      // §5/§34 — the gate, before anything is measured. A blocked photograph
      // never reaches the segmenter, so no number is produced from it.
      const q = assessImageQuality(imageData.data, width, height);
      setQuality(q);
      if (!q.usable) {
        setError(
          'Photograph unsuitable for automated quantitative assessment. '
          + q.findings.filter((f) => f.severity === 'blocking').map((f) => f.message).join(' ')
          + ' Please recapture using the standardized photographic protocol.',
        );
        setStage('capture');
        return;
      }

      // Keep the original before anything touches it — local first, so a ward
      // with no signal still records the photograph.
      try {
        imageRefRef.current = await putLocalImage({
          blob, kind: 'original', width, height,
          woundId: Number(site.wound_id), patientId: Number(patientId),
        });
      } catch (e) {
        console.warn('[graft] could not store the photograph locally:', e);
      }

      await aiWoundMeasurement.initialize();
      const result = await aiWoundMeasurement.measureWound(imageData);

      if (result.noWoundDetected) {
        setError(
          result.warnings.join(' ')
          || `No measurable ${isDonor ? 'open donor area' : 'open graft area'} was found. `
             + 'If the site has fully closed, record that clinically rather than as a measurement.',
        );
        setStage('capture');
        return;
      }

      // §8/§12 — the traced margin burned onto the photograph it came from, so
      // the measurement can be checked against its own evidence.
      try {
        const overlay = await renderContourOverlay(imageData, {
          contour: result.contourPoints,
          pixelsPerCm: result.measurements.calibrationFactor,
          areaCm2: result.area,
          lengthCm: result.length,
          widthCm: result.width,
          calibrated: Boolean(result.calibrated),
          capturedAt: new Date(),
        });
        if (overlay) {
          setOverlayUrl(URL.createObjectURL(overlay));
          overlayRefRef.current = await putLocalImage({
            blob: overlay, kind: 'overlay', width, height,
            woundId: Number(site.wound_id), patientId: Number(patientId),
          });
        }
      } catch (e) {
        console.warn('[graft] could not render the margin overlay:', e);
      }

      setMeasurement({
        areaCm2: result.area,
        perimeterCm: result.perimeter,
        lengthCm: result.length,
        widthCm: result.width,
        calibrated: Boolean(result.calibrated),
        scaleReliable: Boolean(result.scaleReliable),
        calibrationType: result.calibrationMethod || 'none',
        pixelsPerCm: result.measurements.calibrationFactor,
        confidence: result.confidence,
        contourCm: result.contourCm,
      });
      stopCamera();
      setStage('review');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not analyse the photograph.');
      setStage('capture');
    }
  }, [site.wound_id, patientId, isDonor, stopCamera]);

  const shoot = useCallback(async () => {
    const v = videoRef.current;
    if (!v || !v.videoWidth) return;
    const canvas = document.createElement('canvas');
    canvas.width = v.videoWidth;
    canvas.height = v.videoHeight;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return;
    ctx.drawImage(v, 0, 0);
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const blob: Blob = await new Promise((resolve) =>
      canvas.toBlob((b) => resolve(b as Blob), 'image/jpeg', 0.92));
    setPreviewUrl(URL.createObjectURL(blob));
    await analyse(blob, canvas.width, canvas.height, imageData);
  }, [analyse]);

  const fromFile = useCallback(async (file: File) => {
    const bitmap = await createImageBitmap(file);
    const canvas = document.createElement('canvas');
    canvas.width = bitmap.width;
    canvas.height = bitmap.height;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return;
    ctx.drawImage(bitmap, 0, 0);
    setPreviewUrl(URL.createObjectURL(file));
    await analyse(file, canvas.width, canvas.height, ctx.getImageData(0, 0, canvas.width, canvas.height));
  }, [analyse]);

  // ---- save ---------------------------------------------------------------

  const save = async () => {
    if (!measurement || stage === 'saving') return;
    setStage('saving');
    setError('');
    try {
      const saved = await addAssessment({
        wound_id: Number(site.wound_id),
        patient_id: Number(patientId),
        image_url: imageRefRef.current ? `/wound-images?ref=${imageRefRef.current}` : undefined,
        overlay_url: overlayRefRef.current ? `/wound-images?ref=${overlayRefRef.current}` : undefined,
        area_cm2: measurement.areaCm2,
        perimeter_cm: measurement.perimeterCm,
        length_cm: measurement.lengthCm,
        width_cm: measurement.widthCm,
        // Tissue percentages, where the clinician traced them. These columns
        // have existed since the wound module shipped and nothing has ever
        // been allowed to fill them: the colour classifier behind the obvious
        // candidate is unvalidated (TISSUE_MODEL_VALIDATED). A tracing is a
        // clinician's own division of the surface, measured against the
        // calibration marker, so it is recorded as such.
        granulation_pct: trace?.composition.granulation,
        slough_pct: trace?.composition.slough,
        necrotic_pct: trace?.composition.necrotic,
        epithelial_pct: trace?.composition.epithelial,
        tissue_source: trace ? 'clinician' : 'none',
        ai_confidence: measurement.confidence,
        calibration_type: measurement.calibrationType,
        scale_reliable: measurement.scaleReliable,
        contour_cm: measurement.contourCm as never,
        ai_contour_cm: measurement.contourCm as never,
        image_quality_score: quality?.score,
        image_quality_flags: quality?.flags as never,
        model_name: 'on-device-cv',
        model_version: PIPELINE_VERSION,
        preprocessing_version: PIPELINE_VERSION,
        assessed_at: new Date().toISOString(),
      } as never);

      const assessmentId = Number((saved as { id?: number }).id);
      if (Number.isFinite(assessmentId)) {
        // The graft-specific half: take, trend, prediction, alerts.
        await skinGraftService.analyse({
          siteId: site.id,
          assessmentId,
          pixelsPerCm: trace?.pixelsPerCm ?? measurement.pixelsPerCm,
          tracedTotalAreaCm2: trace?.totalAreaCm2,
          tracedRawAreaCm2: trace?.rawAreaCm2,
          tracedHealedPct: trace?.healedPct,
        }).catch((e) => {
          // The assessment is saved either way; only the derived numbers are
          // missing, and re-running the analysis later recovers them.
          console.warn('[graft] assessment saved but analysis failed:', e);
        });
      }

      onSaved();
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save the assessment.');
      setStage('review');
    }
  };

  // ---- render -------------------------------------------------------------

  const meter = liveQuality ?? quality;
  const pct = meter ? Math.round(meter.score * 100) : 0;
  const canShoot = liveReady && !!liveQuality?.usable;

  return (
    <div className="fixed inset-0 z-50 bg-black/70 flex items-start sm:items-center justify-center p-0 sm:p-4 overflow-y-auto">
      <div className="bg-white w-full sm:max-w-2xl sm:rounded-2xl overflow-hidden min-h-screen sm:min-h-0">
        <header className="flex items-center gap-3 px-4 py-3 border-b">
          <Camera className="w-5 h-5 text-teal-600 shrink-0" />
          <div className="min-w-0 flex-1">
            <h2 className="font-semibold text-gray-900 truncate">
              Photograph {site.site_label || (isDonor ? 'donor site' : 'recipient site')}
            </h2>
            <p className="text-xs text-gray-500">
              {isDonor ? 'Donor' : 'Recipient'} · place the calibration marker in the plane of the wound
            </p>
          </div>
          <button onClick={() => { stopCamera(); onClose(); }} className="p-1.5 rounded-lg hover:bg-gray-100" aria-label="Close">
            <X className="w-5 h-5 text-gray-400" />
          </button>
        </header>

        {/* ---- capture ---- */}
        {(stage === 'capture' || stage === 'analysing') && (
          <div className="p-4 space-y-3">
            <div className="relative bg-black rounded-xl overflow-hidden aspect-[4/3]">
              {liveReady ? (
                <>
                  <video
                    ref={videoRef} playsInline muted
                    className="w-full h-full object-cover"
                  />
                  {/* §33 alignment guide — wound inside the frame, marker in
                      the lower band and in the same plane. */}
                  <div className="absolute inset-0 pointer-events-none">
                    <div className="absolute inset-[12%] border-2 border-white/70 rounded-lg" />
                    <div className="absolute left-[12%] right-[12%] bottom-[14%] h-[10%] border-2 border-dashed border-green-400/80 rounded flex items-center justify-center">
                      <span className="text-[10px] text-green-200 bg-black/50 px-1.5 py-0.5 rounded">
                        calibration marker here
                      </span>
                    </div>
                  </div>
                </>
              ) : (
                <div className="w-full h-full flex flex-col items-center justify-center text-center px-6">
                  <Camera className="w-9 h-9 text-white/30 mb-2" />
                  <p className="text-white/70 text-sm">{liveUnavailable || 'Starting the camera…'}</p>
                  <p className="text-white/40 text-xs mt-1">
                    Use the button below to take the photograph with the device camera instead.
                  </p>
                </div>
              )}

              {stage === 'analysing' && (
                <div className="absolute inset-0 bg-black/60 flex flex-col items-center justify-center gap-2">
                  <Loader2 className="w-7 h-7 text-white animate-spin" />
                  <p className="text-white text-sm">Checking quality, calibrating, tracing the margin…</p>
                </div>
              )}
            </div>

            {/* §33 the readout, live where there is a live camera. */}
            {liveReady && (
              <div className="space-y-1.5">
                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-500 w-24 shrink-0">Image quality</span>
                  <div className="flex-1 h-2 rounded-full bg-gray-200 overflow-hidden">
                    <div
                      className={`h-full transition-all ${
                        pct >= 70 ? 'bg-green-500' : pct >= 45 ? 'bg-amber-500' : 'bg-red-500'
                      }`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <span className="text-xs font-medium tabular-nums w-10 text-right">{pct}%</span>
                </div>

                <ul className="text-xs space-y-0.5">
                  {liveQuality?.usable ? (
                    <li className="flex items-center gap-1.5 text-green-700">
                      <CheckCircle2 className="w-3.5 h-3.5" /> Good enough to measure
                    </li>
                  ) : (
                    (liveQuality?.findings ?? []).slice(0, 3).map((f) => (
                      <li key={f.flag} className={`flex items-start gap-1.5 ${
                        f.severity === 'blocking' ? 'text-red-700' : 'text-amber-700'
                      }`}>
                        <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0" /> {f.message}
                      </li>
                    ))
                  )}
                </ul>
              </div>
            )}

            {error && (
              <div role="alert" className="flex items-start gap-2 p-3 rounded-xl bg-red-50 border border-red-200 text-sm text-red-800">
                <ShieldAlert className="w-4 h-4 mt-0.5 shrink-0" /> <span>{error}</span>
              </div>
            )}

            <div className="flex flex-wrap gap-2">
              {liveReady && (
                <button
                  onClick={() => void shoot()}
                  disabled={!canShoot || stage === 'analysing'}
                  className="flex-1 min-w-[10rem] flex items-center justify-center gap-2 py-3 rounded-xl bg-teal-600 text-white font-semibold hover:bg-teal-700 disabled:opacity-50"
                  title={canShoot ? undefined : 'The photograph would be refused by the quality gate'}
                >
                  <Camera className="w-4 h-4" /> Capture
                </button>
              )}
              <label className={`${liveReady ? '' : 'flex-1'} flex items-center justify-center gap-2 px-4 py-3 rounded-xl border font-medium text-gray-700 hover:bg-gray-50 cursor-pointer`}>
                <Upload className="w-4 h-4" />
                {liveReady ? 'Use device camera' : 'Take or choose a photograph'}
                <input
                  type="file" accept="image/*" capture="environment" className="sr-only"
                  onChange={(e) => { const f = e.target.files?.[0]; if (f) void fromFile(f); e.target.value = ''; }}
                />
              </label>
            </div>

            {liveReady && !canShoot && (
              <p className="text-xs text-gray-500">
                The shutter is disabled while the photograph would fail the quality gate.
                Improve the lighting or hold steadier — or use the device camera, which
                focuses better than the preview.
              </p>
            )}
          </div>
        )}

        {/* ---- review (§37, §59) ---- */}
        {stage === 'tracing' && measurement && (
          <RegionTracer
            imageUrl={previewUrl}
            detectedPixelsPerCm={measurement.scaleReliable ? measurement.pixelsPerCm : null}
            siteRole={isDonor ? 'donor' : 'recipient'}
            onCancel={() => setStage('review')}
            onConfirm={(r) => { setTrace(r); setStage('review'); }}
          />
        )}

        {(stage === 'review' || stage === 'saving') && measurement && (
          <div className="p-4 space-y-4">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
              <Cell label="Image quality" value={`${Math.round((quality?.score ?? 0) * 100)}%`}
                    ok={(quality?.score ?? 0) >= 0.6} />
              <Cell label="Calibration"
                    value={measurement.scaleReliable ? 'Valid' : 'Unreliable'}
                    ok={measurement.scaleReliable}
                    hint={measurement.calibrationType} />
              <Cell label={isDonor ? 'Open donor area' : 'Open graft area'}
                    value={`${measurement.areaCm2.toFixed(1)} cm²`} />
              <Cell label="Perimeter" value={`${measurement.perimeterCm.toFixed(1)} cm`} />
            </div>

            {/* The clinician's own division of the site, which is the figure
                the record leads with when it exists. */}
            {trace ? (
              <div className="rounded-xl border border-teal-200 bg-teal-50 p-3.5">
                <div className="flex items-center justify-between gap-3 mb-2">
                  <p className="text-sm font-semibold text-teal-900">
                    {isDonor ? 'Re-epithelialization' : 'Graft take'}, traced
                  </p>
                  <button
                    onClick={() => setStage('tracing')}
                    className="text-xs font-medium text-teal-700 underline hover:no-underline"
                  >
                    Edit tracing
                  </button>
                </div>
                <div className="grid grid-cols-3 gap-2.5">
                  <Cell label="Whole site" value={`${trace.totalAreaCm2.toFixed(1)} cm²`} />
                  <Cell label={isDonor ? 'Still open' : 'Open / non-viable'}
                        value={`${trace.rawAreaCm2.toFixed(1)} cm²`} />
                  <Cell label={isDonor ? 'Epithelialized' : 'Taken'}
                        value={`${trace.healedPct.toFixed(1)}%`} />
                </div>

                {/* The surface broken down, since a wound is rarely one thing. */}
                {trace.measurement.layers.some((l) => l.regions > 0) && (
                  <ul className="mt-2.5 space-y-1">
                    {trace.measurement.layers.filter((l) => l.regions > 0).map((l) => (
                      <li key={l.key} className="flex items-center gap-2 text-xs text-teal-900">
                        <span className="w-2.5 h-2.5 rounded-sm shrink-0"
                              style={{ background: LAYER_META[l.key].colour }} />
                        <span className="flex-1 truncate">
                          {isDonor ? LAYER_META[l.key].label : LAYER_META[l.key].recipientLabel}
                          {l.regions > 1 ? ` (${l.regions} patches)` : ''}
                        </span>
                        <span className="tabular-nums">{l.areaCm2.toFixed(1)} cm²</span>
                        <span className="tabular-nums font-semibold w-12 text-right">
                          {l.pct.toFixed(1)}%
                        </span>
                      </li>
                    ))}
                    {trace.measurement.unclassifiedPct > 0.5 && (
                      <li className="flex items-center gap-2 text-xs text-amber-800">
                        <span className="w-2.5 h-2.5 rounded-sm shrink-0 bg-amber-300" />
                        <span className="flex-1">Unclassified</span>
                        <span className="tabular-nums">
                          {trace.measurement.unclassifiedAreaCm2.toFixed(1)} cm²
                        </span>
                        <span className="tabular-nums font-semibold w-12 text-right">
                          {trace.measurement.unclassifiedPct.toFixed(1)}%
                        </span>
                      </li>
                    )}
                  </ul>
                )}
                <p className="text-[11px] text-teal-800 mt-2">
                  Measured from your two outlines against the calibration marker
                  ({trace.pixelsPerCm.toFixed(1)} px/cm, {trace.calibrationSource}). Recorded as a
                  clinician assessment, not a model output.
                </p>
              </div>
            ) : (
              <button
                onClick={() => setStage('tracing')}
                className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl border-2 border-dashed border-teal-300 text-teal-700 text-sm font-medium hover:bg-teal-50"
              >
                <Pencil className="w-4 h-4" />
                Trace the site and its patches to measure {isDonor ? 're-epithelialization' : 'graft take'}
              </button>
            )}

            {!measurement.scaleReliable && (
              <div className="flex items-start gap-2 p-3 rounded-xl bg-amber-50 border border-amber-200 text-sm text-amber-900">
                <Ruler className="w-4 h-4 mt-0.5 shrink-0" />
                <span>
                  No calibration marker was resolved, so this area is not in reliable real-world
                  units. It will be saved and shown, but it will not be used for longitudinal
                  comparison. Recapture with the marker in the plane of the wound if the trend matters.
                </span>
              </div>
            )}

            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
                {overlayUrl ? 'The margin the pipeline traced' : 'Captured photograph'}
              </p>
              <img
                src={overlayUrl || previewUrl}
                alt="Captured graft site with the traced wound margin"
                className="w-full rounded-xl border bg-gray-50 max-h-80 object-contain"
              />
            </div>

            <p className="text-xs text-gray-500 leading-5">
              <Info className="w-3.5 h-3.5 inline mr-1 -mt-0.5" />
              Check the traced margin against the photograph before saving. If it is wrong, recapture —
              a corrected outline can also be drawn from the wound monitor. Take and trend are
              calculated from this area once it is saved.
            </p>

            {error && (
              <div role="alert" className="flex items-start gap-2 p-3 rounded-xl bg-red-50 border border-red-200 text-sm text-red-800">
                <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" /> <span>{error}</span>
              </div>
            )}

            <div className="flex gap-2">
              <button
                onClick={() => { setStage('capture'); setMeasurement(null); setError(''); }}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl border font-medium text-gray-700 hover:bg-gray-50"
              >
                <RefreshCw className="w-4 h-4" /> Recapture
              </button>
              <button
                onClick={() => void save()}
                disabled={stage === 'saving'}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-teal-600 text-white font-semibold hover:bg-teal-700 disabled:opacity-60"
              >
                {stage === 'saving' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                {stage === 'saving' ? 'Saving…' : 'Accept and save'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function Cell({ label, value, ok, hint }: { label: string; value: string; ok?: boolean; hint?: string }) {
  return (
    <div className="rounded-xl border bg-gray-50 p-2.5">
      <p className="text-[11px] text-gray-500 leading-tight">{label}</p>
      <p className="text-base font-bold text-gray-900 tabular-nums">
        {value}
        {ok === true && <CheckCircle2 className="w-3.5 h-3.5 inline ml-1 -mt-0.5 text-green-600" />}
        {ok === false && <AlertTriangle className="w-3.5 h-3.5 inline ml-1 -mt-0.5 text-amber-500" />}
      </p>
      {hint && <p className="text-[10px] text-gray-400 truncate">{hint}</p>}
    </div>
  );
}

export default GraftCaptureFlow;

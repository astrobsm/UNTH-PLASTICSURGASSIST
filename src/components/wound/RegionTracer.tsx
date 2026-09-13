/**
 * Trace the site, trace what is on it, and let the app measure everything.
 *
 * A wound surface is not raw-or-healed. Inside one outline there is usually
 * granulating tissue here, a plaque of slough there, islands of new epithelium
 * between them. Each is traced on its own layer, patch by patch, in as many
 * steps as it takes — nothing is totalled until the clinician confirms.
 *
 * The clinician marks *where* the boundaries are, which is a judgement that
 * needs the patient in front of you. Everything numeric follows from the
 * calibration marker: nobody types a length, an area or a percentage.
 *
 * Shared between the wound and graft modules on purpose. A donor site, a
 * grafted bed and an ordinary wound are the same problem, and two tracers
 * would be two definitions of an area.
 *
 * Coordinates are stored in image pixels, never screen pixels, so zooming and
 * panning cannot change a measurement and an outline drawn on a phone reopens
 * correctly on a desktop.
 */

import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import {
  Ruler, Undo2, Trash2, Check, X, Loader2, AlertTriangle, Hand,
  Maximize2, Info, Pencil, Layers as LayersIcon, Crop, RotateCcw,
} from 'lucide-react';
import {
  measureLayeredTrace, validateLayeredTrace, calibrationFromLine, simplify,
  polygonAreaPx, pxAreaToCm2, TISSUE_LAYERS, LAYER_META,
  type TracedRegion, type Point, type TissueLayerKey, type LayerRegions,
  type LayeredMeasurement,
} from '../../services/tracedRegions';

type Mode = 'calibrate' | 'pan' | 'crop' | 'baseline' | 'profile' | 'total' | TissueLayerKey;

const TOTAL_COLOUR = '#0ea5e9';
const BASELINE_COLOUR = '#f97316';
const PROFILE_COLOUR = '#a855f7';
const CAL_COLOUR = '#3b82f6';

/**
 * A traced elevation profile, from a lateral view.
 *
 * Returned in the original photograph's pixel frame, with the scale that was
 * in force. keloidElevation turns it into height in centimetres by measuring
 * perpendicular to the baseline, so the camera angle does not matter.
 */
export interface ElevationResult {
  baselinePx: [Point, Point];
  profilePx: Point[];
  pixelsPerCm: number;
  calibrationSource: 'detected' | 'traced';
}

export interface TraceResult {
  totalRegions: TracedRegion[];
  layers: LayerRegions;
  pixelsPerCm: number;
  calibrationSource: 'detected' | 'traced';
  measurement: LayeredMeasurement;
  /** Convenience mirrors of the figures the caller stores. */
  totalAreaCm2: number;
  rawAreaCm2: number;
  healedAreaCm2: number;
  healedPct: number;
  /** Percentages of the whole site, by tissue type. */
  composition: Record<TissueLayerKey, number>;
}

interface Props {
  imageUrl: string;
  detectedPixelsPerCm?: number | null;
  siteRole: 'donor' | 'recipient';
  markerCm?: number;
  /**
   * What is being traced.
   *
   * 'area'      an open wound bed: its outline and the tissue layers on it.
   * 'lesion'    a scar or keloid: its margin, and nothing else. A keloid has
   *             no granulation, no slough, no eschar and no epithelialising
   *             edge — it is not an open wound, and offering those layers
   *             invites a clinician to record tissue that is not there.
   * 'elevation' the lateral view: skin baseline and profile, for height.
   *
   * All three share the crop, the calibration and the pan/zoom, because those
   * are the same problem whatever is being traced.
   */
  purpose?: 'area' | 'lesion' | 'elevation';
  onCancel: () => void;
  onConfirm?: (result: TraceResult) => void;
  onConfirmElevation?: (result: ElevationResult) => void;
}

export function RegionTracer({
  imageUrl, detectedPixelsPerCm, siteRole, markerCm = 5,
  purpose = 'area', onCancel, onConfirm, onConfirmElevation,
}: Props) {
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);

  const [loaded, setLoaded] = useState(false);
  const [mode, setMode] = useState<Mode>(
    detectedPixelsPerCm ? (purpose === 'elevation' ? 'baseline' : 'total') : 'calibrate');
  const isLesion = purpose === 'lesion';
  const [totalRegions, setTotalRegions] = useState<TracedRegion[]>([]);
  const [layers, setLayers] = useState<LayerRegions>({});
  const [draft, setDraft] = useState<Point[]>([]);
  const [calLine, setCalLine] = useState<[Point, Point] | null>(null);
  const [tracedPxPerCm, setTracedPxPerCm] = useState<number | null>(null);
  const [knownCm, setKnownCm] = useState(String(markerCm));
  const [showPatches, setShowPatches] = useState(false);

  /**
   * The crop, when the clinician has zoomed the working image onto the lesion.
   *
   * An earlobe keloid photographed with the whole head in frame occupies a few
   * hundred pixels; tracing its margin and reading its height from that is
   * guesswork. Cropping to it puts every available pixel on the lesion.
   *
   * The crop is a pure pixel extraction with NO resampling, which is what makes
   * it safe: pixels-per-centimetre is unchanged by cutting a window out of an
   * image, so the calibration carries over exactly. Scaling the crop up would
   * break that silently, which is why it is not done.
   *
   * Coordinates are traced in the cropped frame and mapped back by the offset
   * on confirm, so what is stored is always in the original photograph's frame.
   */
  const [crop, setCrop] = useState<{ x: number; y: number; w: number; h: number } | null>(null);
  const [cropDraft, setCropDraft] = useState<{ a: Point; b: Point } | null>(null);

  // Elevation tracing: the line of the surrounding skin, and the lesion's
  // outline above it. Height is measured perpendicular to the first.
  const [baseline, setBaseline] = useState<[Point, Point] | null>(null);
  const [profile, setProfile] = useState<Point[]>([]);
  const originalRef = useRef<HTMLImageElement | null>(null);

  const view = useRef({ scale: 1, ox: 0, oy: 0 });
  const [, bump] = useState(0);
  const redraw = useCallback(() => bump((n) => n + 1), []);

  const pointers = useRef<Map<number, Point>>(new Map());
  const pinch = useRef<{ dist: number; scale: number; mid: Point } | null>(null);
  const drawing = useRef(false);

  const pixelsPerCm = tracedPxPerCm ?? detectedPixelsPerCm ?? null;
  const calibrationSource: 'detected' | 'traced' = tracedPxPerCm ? 'traced' : 'detected';
  const isRecipient = siteRole === 'recipient';
  const labelFor = (k: TissueLayerKey) =>
    isRecipient ? LAYER_META[k].recipientLabel : LAYER_META[k].label;

  // ---- image ---------------------------------------------------------------

  const fit = useCallback(() => {
    const img = imgRef.current;
    const wrap = wrapRef.current;
    if (!img || !wrap) return;
    const s = Math.min(wrap.clientWidth / img.width, wrap.clientHeight / img.height);
    view.current = {
      scale: s,
      ox: (wrap.clientWidth - img.width * s) / 2,
      oy: (wrap.clientHeight - img.height * s) / 2,
    };
    redraw();
  }, [redraw]);

  useEffect(() => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      imgRef.current = img;
      // Kept so a crop can be undone without re-fetching the photograph.
      if (!originalRef.current) originalRef.current = img;
      setLoaded(true);
      fit();
    };
    img.src = imageUrl;
  }, [imageUrl, fit]);

  useEffect(() => {
    const onResize = () => fit();
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [fit]);

  const toImage = useCallback((clientX: number, clientY: number): Point => {
    const r = canvasRef.current!.getBoundingClientRect();
    const { scale, ox, oy } = view.current;
    return { x: (clientX - r.left - ox) / scale, y: (clientY - r.top - oy) / scale };
  }, []);

  // ---- painting ------------------------------------------------------------

  useEffect(() => {
    const canvas = canvasRef.current;
    const img = imgRef.current;
    const wrap = wrapRef.current;
    if (!canvas || !img || !wrap) return;

    const dpr = window.devicePixelRatio || 1;
    canvas.width = wrap.clientWidth * dpr;
    canvas.height = wrap.clientHeight * dpr;
    canvas.style.width = `${wrap.clientWidth}px`;
    canvas.style.height = `${wrap.clientHeight}px`;

    const ctx = canvas.getContext('2d')!;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, wrap.clientWidth, wrap.clientHeight);

    const { scale, ox, oy } = view.current;
    ctx.save();
    ctx.translate(ox, oy);
    ctx.scale(scale, scale);
    ctx.drawImage(img, 0, 0);

    const lw = 2 / scale;
    const paint = (pts: Point[], colour: string, fill: boolean, closed: boolean) => {
      if (pts.length < 2) return;
      ctx.beginPath();
      ctx.moveTo(pts[0].x, pts[0].y);
      for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
      if (closed) ctx.closePath();
      if (fill && closed) { ctx.fillStyle = `${colour}40`; ctx.fill(); }
      // A dark under-stroke so the outline reads on pale skin and on slough
      // alike — the same reason the measurement overlay does it.
      ctx.lineWidth = lw * 2;
      ctx.strokeStyle = 'rgba(0,0,0,0.55)';
      ctx.stroke();
      ctx.lineWidth = lw;
      ctx.strokeStyle = colour;
      ctx.stroke();
    };

    for (const r of totalRegions) paint(r.points, TOTAL_COLOUR, false, true);
    for (const meta of TISSUE_LAYERS) {
      for (const r of layers[meta.key] || []) paint(r.points, meta.colour, true, true);
    }
    if (baseline) {
      paint([baseline[0], baseline[1]], BASELINE_COLOUR, false, false);
      for (const pt of baseline) {
        ctx.beginPath();
        ctx.arc(pt.x, pt.y, lw * 3, 0, Math.PI * 2);
        ctx.fillStyle = BASELINE_COLOUR;
        ctx.fill();
      }
    }
    if (profile.length > 1) paint(profile, PROFILE_COLOUR, false, false);

    if (draft.length > 1) {
      const colour = mode === 'total' ? TOTAL_COLOUR
        : mode === 'profile' ? PROFILE_COLOUR
        : (LAYER_META as Record<string, { colour: string }>)[mode]?.colour ?? TOTAL_COLOUR;
      paint(draft, colour, false, false);
    }
    if (cropDraft) {
      const x0 = Math.min(cropDraft.a.x, cropDraft.b.x);
      const y0 = Math.min(cropDraft.a.y, cropDraft.b.y);
      const w = Math.abs(cropDraft.b.x - cropDraft.a.x);
      const h = Math.abs(cropDraft.b.y - cropDraft.a.y);
      // Dim everything outside the rectangle, so what will be kept is obvious.
      ctx.save();
      ctx.fillStyle = 'rgba(0,0,0,0.45)';
      ctx.beginPath();
      ctx.rect(0, 0, img.width, img.height);
      ctx.rect(x0, y0, w, h);
      ctx.fill('evenodd');
      ctx.restore();
      ctx.lineWidth = lw;
      ctx.strokeStyle = '#f59e0b';
      ctx.setLineDash([6 / scale, 4 / scale]);
      ctx.strokeRect(x0, y0, w, h);
      ctx.setLineDash([]);
    }
    if (calLine) {
      paint([calLine[0], calLine[1]], CAL_COLOUR, false, false);
      for (const p of calLine) {
        ctx.beginPath();
        ctx.arc(p.x, p.y, lw * 3, 0, Math.PI * 2);
        ctx.fillStyle = CAL_COLOUR;
        ctx.fill();
      }
    }
    ctx.restore();
  });

  // ---- pointers ------------------------------------------------------------

  const onPointerDown = (e: React.PointerEvent) => {
    (e.target as Element).setPointerCapture?.(e.pointerId);
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });

    if (pointers.current.size === 2) {
      // Two fingers always zoom and pan, whatever the mode — a clinician
      // cannot trace a fine margin without getting close to it.
      drawing.current = false;
      setDraft([]);
      const [a, b] = [...pointers.current.values()];
      pinch.current = {
        dist: Math.hypot(a.x - b.x, a.y - b.y),
        scale: view.current.scale,
        mid: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 },
      };
      return;
    }
    if (mode === 'pan') return;

    const p = toImage(e.clientX, e.clientY);
    drawing.current = true;
    if (mode === 'calibrate') { setCalLine([p, p]); return; }
    if (mode === 'crop') { setCropDraft({ a: p, b: p }); return; }
    if (mode === 'baseline') { setBaseline([p, p]); return; }
    setDraft([p]);
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (!pointers.current.has(e.pointerId)) return;
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });

    if (pointers.current.size === 2 && pinch.current) {
      const [a, b] = [...pointers.current.values()];
      const dist = Math.hypot(a.x - b.x, a.y - b.y);
      const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
      const next = Math.max(0.05, Math.min(20, pinch.current.scale * (dist / pinch.current.dist)));
      const r = canvasRef.current!.getBoundingClientRect();
      const before = {
        x: (pinch.current.mid.x - r.left - view.current.ox) / view.current.scale,
        y: (pinch.current.mid.y - r.top - view.current.oy) / view.current.scale,
      };
      view.current.scale = next;
      view.current.ox = mid.x - r.left - before.x * next;
      view.current.oy = mid.y - r.top - before.y * next;
      redraw();
      return;
    }

    if (mode === 'pan' && pointers.current.size === 1 && e.buttons !== 0) {
      view.current.ox += e.movementX;
      view.current.oy += e.movementY;
      redraw();
      return;
    }

    if (!drawing.current) return;
    const p = toImage(e.clientX, e.clientY);
    if (mode === 'calibrate') { setCalLine((l) => (l ? [l[0], p] : [p, p])); return; }
    if (mode === 'crop') { setCropDraft((c) => (c ? { a: c.a, b: p } : { a: p, b: p })); return; }
    if (mode === 'baseline') { setBaseline((l) => (l ? [l[0], p] : [p, p])); return; }
    setDraft((d) => {
      const last = d[d.length - 1];
      if (last && Math.hypot(p.x - last.x, p.y - last.y) < 2 / view.current.scale) return d;
      return [...d, p];
    });
  };

  const onPointerUp = (e: React.PointerEvent) => {
    pointers.current.delete(e.pointerId);
    if (pointers.current.size < 2) pinch.current = null;
    if (!drawing.current) return;
    drawing.current = false;
    if (mode === 'calibrate' || mode === 'crop' || mode === 'baseline') return;

    const pts = simplify(draft, 2 / view.current.scale);
    setDraft([]);

    // The profile is an open line along the top of the lesion, not a closed
    // outline: it is a cross-section, and closing it would add a floor that
    // was never traced.
    if (mode === 'profile') {
      if (pts.length >= 2) setProfile(pts);
      return;
    }

    if (pts.length < 3) return;   // a tap, not an outline

    const region: TracedRegion = { id: `${mode}-${Date.now()}`, points: pts };
    if (mode === 'total') setTotalRegions((r) => [...r, region]);
    else setLayers((l) => ({ ...l, [mode]: [...(l[mode as TissueLayerKey] || []), region] }));
  };

  const onWheel = (e: React.WheelEvent) => {
    const r = canvasRef.current!.getBoundingClientRect();
    const before = toImage(e.clientX, e.clientY);
    const next = Math.max(0.05, Math.min(20, view.current.scale * (e.deltaY < 0 ? 1.12 : 1 / 1.12)));
    view.current.scale = next;
    view.current.ox = e.clientX - r.left - before.x * next;
    view.current.oy = e.clientY - r.top - before.y * next;
    redraw();
  };

  // ---- derived -------------------------------------------------------------

  /**
   * Cuts the working image down to the dragged rectangle.
   *
   * drawImage with matching source and destination sizes copies pixels
   * one-for-one; no interpolation happens, so the scale is untouched.
   */
  const applyCrop = useCallback(() => {
    const img = imgRef.current;
    if (!img || !cropDraft) return;

    const x0 = Math.max(0, Math.min(cropDraft.a.x, cropDraft.b.x));
    const y0 = Math.max(0, Math.min(cropDraft.a.y, cropDraft.b.y));
    const x1 = Math.min(img.width, Math.max(cropDraft.a.x, cropDraft.b.x));
    const y1 = Math.min(img.height, Math.max(cropDraft.a.y, cropDraft.b.y));
    const w = Math.round(x1 - x0);
    const h = Math.round(y1 - y0);
    // A tiny crop is a mis-drag, and cropping to it would lose the lesion.
    if (w < 32 || h < 32) { setCropDraft(null); return; }

    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.drawImage(img, Math.round(x0), Math.round(y0), w, h, 0, 0, w, h);

    const next = new Image();
    next.onload = () => {
      imgRef.current = next;
      // Offsets accumulate, so cropping twice still maps back correctly.
      setCrop((c) => ({ x: (c?.x ?? 0) + Math.round(x0), y: (c?.y ?? 0) + Math.round(y0), w, h }));
      setCropDraft(null);
      setMode('total');
      fit();
    };
    next.src = canvas.toDataURL('image/png');
  }, [cropDraft, fit]);

  const undoCrop = useCallback(() => {
    if (!originalRef.current) return;
    imgRef.current = originalRef.current;
    setCrop(null);
    setCropDraft(null);
    // Outlines were traced in the cropped frame; keeping them would place them
    // wrongly on the full photograph.
    setTotalRegions([]);
    setLayers({});
    fit();
  }, [fit]);

  const applyCalibration = () => {
    if (!calLine) return;
    const s = calibrationFromLine(calLine[0], calLine[1], Number(knownCm));
    if (s) { setTracedPxPerCm(s); setMode('total'); }
  };

  const measurement = useMemo(
    () => (pixelsPerCm ? measureLayeredTrace(totalRegions, layers, pixelsPerCm) : null),
    [totalRegions, layers, pixelsPerCm],
  );

  /**
   * A lesion needs only its margin.
   *
   * The layered validator insists on at least one tissue patch, which is right
   * for a wound bed and wrong for a keloid — there are no patches to mark, and
   * demanding one would block the measurement entirely.
   */
  const validation = useMemo(() => {
    if (!isLesion) return validateLayeredTrace(totalRegions, layers, pixelsPerCm);
    const problems: string[] = [];
    if (!pixelsPerCm || pixelsPerCm <= 0) {
      problems.push('No scale: calibrate against the marker before tracing.');
    }
    if (!totalRegions.filter((r) => r.points.length >= 3).length) {
      problems.push('Trace the outline of the lesion.');
    }
    return { ok: problems.length === 0, problems };
  }, [isLesion, totalRegions, layers, pixelsPerCm]);

  const removeRegion = (layerKey: 'total' | TissueLayerKey, id: string) => {
    if (layerKey === 'total') setTotalRegions((r) => r.filter((x) => x.id !== id));
    else setLayers((l) => ({ ...l, [layerKey]: (l[layerKey] || []).filter((x) => x.id !== id) }));
  };

  const undo = () => {
    if (mode !== 'total' && mode !== 'pan' && mode !== 'calibrate') {
      const cur = layers[mode as TissueLayerKey] || [];
      if (cur.length) { setLayers((l) => ({ ...l, [mode]: cur.slice(0, -1) })); return; }
    }
    // Fall back to the most recently added patch anywhere.
    for (const meta of [...TISSUE_LAYERS].reverse()) {
      const cur = layers[meta.key] || [];
      if (cur.length) { setLayers((l) => ({ ...l, [meta.key]: cur.slice(0, -1) })); return; }
    }
    if (totalRegions.length) setTotalRegions((r) => r.slice(0, -1));
  };

  const healedLabel = isRecipient ? 'Graft take' : 'Re-epithelialization';
  const patchCount = TISSUE_LAYERS.reduce((n, m) => n + (layers[m.key]?.length ?? 0), 0);

  return (
    <div className="fixed inset-0 z-50 bg-gray-900 flex flex-col">
      <header className="flex items-center gap-3 px-4 py-2.5 bg-gray-800 text-white shrink-0">
        <Pencil className="w-5 h-5 text-teal-400 shrink-0" />
        <div className="min-w-0 flex-1">
          <h2 className="font-semibold text-sm truncate">
            {purpose === 'elevation' ? 'Trace the profile'
              : isLesion ? 'Trace the lesion' : 'Trace the surface'}
          </h2>
          <p className="text-[11px] text-gray-400 truncate">
            {purpose === 'elevation'
              ? 'Skin line first, then the profile of the lesion above it'
              : isLesion
                ? 'Outline the margin of the keloid or scar'
                : `Outline the whole ${isRecipient ? 'graft' : 'donor site'}, then mark each patch on it`}
          </p>
        </div>
        <button onClick={onCancel} className="p-1.5 rounded hover:bg-white/10" aria-label="Cancel">
          <X className="w-5 h-5" />
        </button>
      </header>

      <div ref={wrapRef} className="relative flex-1 min-h-0 bg-black">
        {!loaded && (
          <div className="absolute inset-0 flex items-center justify-center">
            <Loader2 className="w-7 h-7 animate-spin text-white/40" />
          </div>
        )}
        <canvas
          ref={canvasRef}
          className="touch-none select-none"
          style={{ cursor: mode === 'pan' ? 'grab' : 'crosshair' }}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          onWheel={onWheel}
        />

        {/* The running total, over the image, so the number moves as they trace. */}
        {isLesion && measurement && totalRegions.length > 0 && (
          <div className="absolute top-2 left-2 rounded-lg bg-black/75 text-white px-3 py-2 text-xs pointer-events-none">
            <p>Lesion area <strong className="tabular-nums">{measurement.totalAreaCm2.toFixed(2)} cm²</strong></p>
            <p className="text-gray-300">{totalRegions.length} outline{totalRegions.length === 1 ? '' : 's'}</p>
          </div>
        )}
        {purpose === 'area' && measurement && measurement.basis !== 'none' && (
          <div className="absolute top-2 left-2 rounded-lg bg-black/75 text-white px-3 py-2 text-xs space-y-0.5 pointer-events-none">
            <p>Site <strong className="tabular-nums">{measurement.totalAreaCm2.toFixed(1)} cm²</strong></p>
            <p>Open <strong className="tabular-nums">{measurement.openAreaCm2.toFixed(1)} cm²</strong></p>
            <p className="text-teal-300">
              {healedLabel} <strong className="tabular-nums">{measurement.healedPct.toFixed(1)}%</strong>
            </p>
            {measurement.unclassifiedPct > 0.5 && (
              <p className="text-amber-300">
                Unclassified <strong className="tabular-nums">{measurement.unclassifiedPct.toFixed(1)}%</strong>
              </p>
            )}
          </div>
        )}

        {mode === 'calibrate' && (
          <div className="absolute bottom-2 left-2 right-2 rounded-lg bg-blue-600/90 text-white px-3 py-2 text-xs">
            Drag a line along the full length of the calibration marker, then confirm its length.
          </div>
        )}
      </div>

      <div className="bg-gray-800 text-white px-3 py-3 space-y-3 shrink-0 max-h-[52vh] overflow-y-auto">
        {/* Scale first: nothing can be measured without it. */}
        <div className="flex flex-wrap items-center gap-2">
          <span className="flex items-center gap-1.5 text-xs shrink-0">
            <Ruler className={`w-4 h-4 ${pixelsPerCm ? 'text-green-400' : 'text-amber-400'}`} />
            {pixelsPerCm
              ? <>Scale <strong className="tabular-nums">{pixelsPerCm.toFixed(1)}</strong> px/cm
                  <span className="text-gray-400"> ({calibrationSource})</span></>
              : <span className="text-amber-300">No scale yet</span>}
          </span>
          {mode === 'calibrate' ? (
            <div className="flex items-center gap-2 ml-auto">
              <input
                type="number" step="0.1" min="0.1" value={knownCm}
                onChange={(e) => setKnownCm(e.target.value)}
                aria-label="Marker length in centimetres"
                className="w-20 px-2 py-1 rounded bg-gray-700 text-white text-sm"
              />
              <span className="text-xs text-gray-400">cm</span>
              <button
                onClick={applyCalibration}
                disabled={!calLine || !(Number(knownCm) > 0)}
                className="px-3 py-1.5 rounded-lg bg-blue-600 text-sm font-medium disabled:opacity-40"
              >
                Set scale
              </button>
            </div>
          ) : (
            <button onClick={() => setMode('calibrate')} className="ml-auto text-xs underline text-gray-300 hover:text-white">
              {pixelsPerCm ? 'Re-set the scale by hand' : 'Set the scale by hand'}
            </button>
          )}
        </div>

        {/* Cropping to the lesion. Said plainly, because a clinician has every
            reason to distrust an app that changes their photograph. */}
        {(mode === 'crop' || crop) && (
          <div className="flex flex-wrap items-center gap-2 rounded-lg bg-gray-700/60 p-2.5">
            <Crop className="w-4 h-4 text-amber-400 shrink-0" />
            <span className="text-[11px] text-gray-300 flex-1 min-w-0">
              {crop
                ? `Cropped to ${crop.w}x${crop.h} px. The scale is unchanged — cropping cuts pixels out, it does not resize them.`
                : 'Drag a box around the lesion. Cropping keeps every pixel at its original size, so the calibration still holds.'}
            </span>
            {mode === 'crop' && cropDraft && (
              <button
                onClick={applyCrop}
                className="px-3 py-1.5 rounded-lg bg-amber-500 text-gray-900 text-sm font-semibold shrink-0"
              >
                Crop to this
              </button>
            )}
            {crop && (
              <button
                onClick={undoCrop}
                className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-gray-600 text-xs shrink-0"
              >
                <RotateCcw className="w-3.5 h-3.5" /> Whole photo
              </button>
            )}
          </div>
        )}

        {/* The site outline, then the tissue layers. */}
        <div className="grid grid-cols-4 gap-1.5">
          <LayerButton
            active={mode === 'total'} onClick={() => setMode('total')}
            colour={TOTAL_COLOUR}
            label={isLesion ? 'Lesion margin' : 'Whole site'}
            count={totalRegions.length} outlineOnly
          />
          <button
            onClick={() => setMode('pan')}
            className={`flex flex-col items-center gap-0.5 py-2 rounded-lg text-[11px] ${
              mode === 'pan' ? 'bg-white text-gray-900 font-semibold' : 'bg-gray-700'
            }`}
          >
            <Hand className="w-4 h-4" /> Move
          </button>
          <button
            onClick={() => setMode('crop')}
            className={`flex flex-col items-center gap-0.5 py-2 rounded-lg text-[11px] ${
              mode === 'crop' ? 'bg-white text-gray-900 font-semibold' : 'bg-gray-700'
            }`}
          >
            <Crop className="w-4 h-4" /> Crop
          </button>
          <button onClick={fit} className="flex flex-col items-center gap-0.5 py-2 rounded-lg bg-gray-700 text-[11px]">
            <Maximize2 className="w-4 h-4" /> Fit
          </button>
        </div>

        {isLesion ? null : purpose === 'elevation' ? (
          <div className="grid grid-cols-2 gap-1.5">
            <LayerButton
              active={mode === 'baseline'} onClick={() => setMode('baseline')}
              colour={BASELINE_COLOUR} label="Skin line" count={baseline ? 1 : 0} outlineOnly
            />
            <LayerButton
              active={mode === 'profile'} onClick={() => setMode('profile')}
              colour={PROFILE_COLOUR} label="Lesion profile" count={profile.length ? 1 : 0} outlineOnly
            />
          </div>
        ) : (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
          {TISSUE_LAYERS.map((meta) => (
            <LayerButton
              key={meta.key}
              active={mode === meta.key}
              onClick={() => setMode(meta.key)}
              colour={meta.colour}
              label={labelFor(meta.key)}
              count={layers[meta.key]?.length ?? 0}
            />
          ))}
        </div>
        )}

        {/* Composition, once anything has been marked. */}
        {purpose === 'area' && measurement && measurement.basis !== 'none' && (
          <div className="rounded-lg bg-gray-700/60 p-2.5 space-y-1">
            <p className="text-[11px] font-semibold text-gray-300 uppercase tracking-wide">
              Surface composition
            </p>
            {measurement.layers.filter((l) => l.regions > 0).map((l) => (
              <div key={l.key} className="flex items-center gap-2 text-[11px]">
                <span className="w-3 h-3 rounded-sm shrink-0" style={{ background: LAYER_META[l.key].colour }} />
                <span className="flex-1 truncate">{labelFor(l.key)}</span>
                <span className="tabular-nums text-gray-300">{l.areaCm2.toFixed(1)} cm²</span>
                <span className="tabular-nums font-semibold w-12 text-right">{l.pct.toFixed(1)}%</span>
              </div>
            ))}
            <p className="text-[11px] text-gray-400 pt-1 border-t border-gray-600">
              {measurement.basis === 'inferred-from-open'
                && 'Everything inside the outline that is not marked open is counted as healed.'}
              {measurement.basis === 'inferred-from-healed'
                && 'Everything inside the outline that is not marked healed is counted as open.'}
              {measurement.basis === 'traced-both'
                && 'Both sides traced, so nothing is inferred; any remainder is left unclassified.'}
            </p>
          </div>
        )}

        {/* Every patch, so one can be removed without undoing the rest. */}
        {purpose === 'area' && patchCount > 0 && (
          <div>
            <button
              onClick={() => setShowPatches((v) => !v)}
              className="flex items-center gap-1.5 text-[11px] text-gray-300 hover:text-white"
              aria-expanded={showPatches}
            >
              <LayersIcon className="w-3.5 h-3.5" />
              {showPatches ? 'Hide' : 'Show'} the {patchCount} patch{patchCount === 1 ? '' : 'es'}
            </button>
            {showPatches && (
              <ul className="mt-1.5 space-y-1 max-h-32 overflow-y-auto">
                {TISSUE_LAYERS.flatMap((meta) =>
                  (layers[meta.key] || []).map((r, i) => (
                    <li key={r.id} className="flex items-center gap-2 text-[11px] bg-gray-700/50 rounded px-2 py-1">
                      <span className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ background: meta.colour }} />
                      <span className="flex-1 truncate">{labelFor(meta.key)} #{i + 1}</span>
                      <span className="tabular-nums text-gray-300">
                        {pixelsPerCm
                          ? `${pxAreaToCm2(polygonAreaPx(r.points), pixelsPerCm).toFixed(1)} cm²`
                          : '—'}
                      </span>
                      <button
                        onClick={() => removeRegion(meta.key, r.id)}
                        className="p-0.5 rounded hover:bg-white/10 shrink-0"
                        aria-label={`Remove ${labelFor(meta.key)} patch ${i + 1}`}
                      >
                        <X className="w-3.5 h-3.5 text-gray-400" />
                      </button>
                    </li>
                  )))}
              </ul>
            )}
          </div>
        )}

        {purpose === 'elevation' && (
          <p className="text-[11px] text-gray-400 flex items-start gap-1.5">
            <Info className="w-3.5 h-3.5 mt-0.5 shrink-0" />
            On the lateral photograph: drag the skin line across the normal skin either side
            of the lesion, then trace along the top of the lesion. Height is measured
            perpendicular to the skin line, so it does not matter how the head was held.
          </p>
        )}
        {isLesion && (
          <p className="text-[11px] text-gray-400 flex items-start gap-1.5">
            <Info className="w-3.5 h-3.5 mt-0.5 shrink-0" />
            Drag round the margin of the lesion; the outline closes itself. Pinch or scroll to
            zoom in first, and crop to the lesion if it is small in the frame. Trace each
            separate nodule as its own outline — their areas are added.
          </p>
        )}
        <p className={`text-[11px] text-gray-400 items-start gap-1.5 ${purpose === 'area' ? 'flex' : 'hidden'}`}>
          <Info className="w-3.5 h-3.5 mt-0.5 shrink-0" />
          Drag to draw; the outline closes itself. Pinch or scroll to zoom in before tracing a
          fine margin. Add as many patches to each layer as the surface has — nothing is
          totalled until you confirm.
        </p>

        {purpose === 'area' && !validation.ok && validation.problems.length > 0 && (
          <ul className="space-y-1">
            {validation.problems.map((p) => (
              <li key={p} className="flex items-start gap-1.5 text-[11px] text-amber-300">
                <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0" /> {p}
              </li>
            ))}
          </ul>
        )}

        <div className="flex gap-2">
          <button
            onClick={undo}
            disabled={!totalRegions.length && !patchCount}
            className="flex items-center gap-1.5 px-3 py-2.5 rounded-xl bg-gray-700 text-sm font-medium disabled:opacity-40"
          >
            <Undo2 className="w-4 h-4" /> Undo
          </button>
          <button
            onClick={() => { setTotalRegions([]); setLayers({}); setDraft([]); setBaseline(null); setProfile([]); }}
            disabled={!totalRegions.length && !patchCount && !baseline && !profile.length}
            className="flex items-center gap-1.5 px-3 py-2.5 rounded-xl bg-gray-700 text-sm font-medium disabled:opacity-40"
          >
            <Trash2 className="w-4 h-4" /> Clear
          </button>
          <button
            onClick={() => {
              if (purpose === 'elevation') {
                if (!baseline || profile.length < 4 || !pixelsPerCm) return;
                const shift = (pt: Point) => (crop
                  ? { x: pt.x + crop.x, y: pt.y + crop.y } : pt);
                onConfirmElevation?.({
                  baselinePx: [shift(baseline[0]), shift(baseline[1])],
                  profilePx: profile.map(shift),
                  pixelsPerCm,
                  calibrationSource,
                });
                return;
              }
              if (!measurement || !pixelsPerCm) return;
              const composition = Object.fromEntries(
                measurement.layers.map((l) => [l.key, l.pct]),
              ) as Record<TissueLayerKey, number>;
              // Traced in the cropped frame; stored in the original
              // photograph's frame, so an outline still lands correctly when
              // redrawn over the full image later.
              const shift = (rs: TracedRegion[]) => (crop
                ? rs.map((r) => ({
                  ...r,
                  points: r.points.map((pt) => ({ x: pt.x + crop.x, y: pt.y + crop.y })),
                }))
                : rs);
              const shiftedLayers: LayerRegions = {};
              for (const meta of TISSUE_LAYERS) {
                if (layers[meta.key]?.length) shiftedLayers[meta.key] = shift(layers[meta.key]!);
              }
              onConfirm?.({
                totalRegions: shift(totalRegions), layers: shiftedLayers,
                pixelsPerCm, calibrationSource, measurement,
                totalAreaCm2: measurement.totalAreaCm2,
                rawAreaCm2: measurement.openAreaCm2,
                healedAreaCm2: measurement.healedAreaCm2,
                healedPct: measurement.healedPct,
                composition,
              });
            }}
            disabled={purpose === 'elevation'
              ? (!baseline || profile.length < 4 || !pixelsPerCm)
              : (!validation.ok || !measurement)}
            className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-teal-600 font-semibold disabled:opacity-40"
          >
            <Check className="w-4 h-4" />
            {purpose === 'elevation'
              ? 'Use this profile'
              : isLesion
                ? (measurement && totalRegions.length
                  ? `Use ${measurement.totalAreaCm2.toFixed(2)} cm²` : 'Confirm')
                : measurement && measurement.basis !== 'none'
                  ? `Use ${measurement.healedPct.toFixed(1)}% ${healedLabel.toLowerCase()}`
                  : 'Confirm'}
          </button>
        </div>
      </div>
    </div>
  );
}

function LayerButton({ active, onClick, colour, label, count, outlineOnly }: {
  active: boolean; onClick: () => void; colour: string; label: string;
  count: number; outlineOnly?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex flex-col items-center gap-0.5 py-2 px-1 rounded-lg text-[11px] leading-tight ${
        active ? 'bg-white text-gray-900 font-semibold' : 'bg-gray-700 text-white'
      }`}
    >
      <span
        className="w-4 h-4 rounded-sm border-2 shrink-0"
        style={{ borderColor: colour, background: outlineOnly ? 'transparent' : `${colour}55` }}
      />
      <span className="text-center">{label}{count > 0 ? ` (${count})` : ''}</span>
    </button>
  );
}

export default RegionTracer;

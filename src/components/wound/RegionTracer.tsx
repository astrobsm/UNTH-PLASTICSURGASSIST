/**
 * Trace the site, trace what is still raw, and let the app measure both.
 *
 * The clinician marks *where* the boundaries are — a judgement that needs the
 * patient in front of you, not a photograph — and everything numeric follows
 * from the calibration marker. Nobody types a length or a percentage.
 *
 * Shared between the wound and graft modules on purpose: a donor site, a
 * grafted bed and an ordinary wound are the same problem, and two tracers
 * would be two definitions of an area.
 *
 * Coordinates are stored in image pixels throughout, never in screen pixels,
 * so zooming and panning cannot change a measurement, and an outline drawn on
 * a phone reopens correctly on a desktop.
 */

import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import {
  Ruler, Undo2, Trash2, Check, X, Loader2, AlertTriangle, Hand,
  Maximize2, Info, Pencil,
} from 'lucide-react';
import {
  measureTrace, validateTrace, calibrationFromLine, simplify, polygonAreaPx,
  pxAreaToCm2, type TracedRegion, type Point,
} from '../../services/tracedRegions';

type Mode = 'calibrate' | 'total' | 'raw' | 'pan';

export interface TraceResult {
  totalRegions: TracedRegion[];
  rawRegions: TracedRegion[];
  pixelsPerCm: number;
  calibrationSource: 'detected' | 'traced';
  totalAreaCm2: number;
  rawAreaCm2: number;
  healedAreaCm2: number;
  healedPct: number;
}

interface Props {
  /** The photograph, already captured. */
  imageUrl: string;
  /** From automatic marker detection, when it succeeded. */
  detectedPixelsPerCm?: number | null;
  /** 'donor' phrases the raw area as not-yet-epithelialized. */
  siteRole: 'donor' | 'recipient';
  /** Known length of the calibration marker in the photograph. */
  markerCm?: number;
  onCancel: () => void;
  onConfirm: (result: TraceResult) => void;
}

const COLOURS = {
  total: '#22c55e',
  raw: '#ef4444',
  calibrate: '#3b82f6',
};

export function RegionTracer({
  imageUrl, detectedPixelsPerCm, siteRole, markerCm = 5, onCancel, onConfirm,
}: Props) {
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);

  const [loaded, setLoaded] = useState(false);
  const [mode, setMode] = useState<Mode>(detectedPixelsPerCm ? 'total' : 'calibrate');
  const [totalRegions, setTotalRegions] = useState<TracedRegion[]>([]);
  const [rawRegions, setRawRegions] = useState<TracedRegion[]>([]);
  const [draft, setDraft] = useState<Point[]>([]);
  const [calLine, setCalLine] = useState<[Point, Point] | null>(null);
  const [tracedPxPerCm, setTracedPxPerCm] = useState<number | null>(null);
  const [knownCm, setKnownCm] = useState(String(markerCm));

  // View transform, in image pixels per screen pixel.
  const view = useRef({ scale: 1, ox: 0, oy: 0 });
  const [, forceRedraw] = useState(0);
  const redraw = useCallback(() => forceRedraw((n) => n + 1), []);

  const pointers = useRef<Map<number, Point>>(new Map());
  const pinch = useRef<{ dist: number; scale: number; mid: Point } | null>(null);
  const drawing = useRef(false);

  const pixelsPerCm = tracedPxPerCm ?? detectedPixelsPerCm ?? null;
  const calibrationSource: 'detected' | 'traced' = tracedPxPerCm ? 'traced' : 'detected';

  // ---- image ---------------------------------------------------------------

  useEffect(() => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => { imgRef.current = img; setLoaded(true); fit(); };
    img.src = imageUrl;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [imageUrl]);

  const fit = useCallback(() => {
    const img = imgRef.current;
    const wrap = wrapRef.current;
    if (!img || !wrap) return;
    const cw = wrap.clientWidth;
    const ch = wrap.clientHeight;
    const s = Math.min(cw / img.width, ch / img.height);
    view.current = {
      scale: s,
      ox: (cw - img.width * s) / 2,
      oy: (ch - img.height * s) / 2,
    };
    redraw();
  }, [redraw]);

  useEffect(() => {
    const onResize = () => fit();
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [fit]);

  // ---- coordinates ---------------------------------------------------------

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
      if (fill && closed) {
        ctx.fillStyle = `${colour}33`;
        ctx.fill();
      }
      // A dark under-stroke, so the outline reads on pale skin and on slough
      // alike — the same reason the measurement overlay does it.
      ctx.lineWidth = lw * 2;
      ctx.strokeStyle = 'rgba(0,0,0,0.55)';
      ctx.stroke();
      ctx.lineWidth = lw;
      ctx.strokeStyle = colour;
      ctx.stroke();
    };

    for (const r of totalRegions) paint(r.points, COLOURS.total, true, true);
    for (const r of rawRegions) paint(r.points, COLOURS.raw, true, true);
    if (draft.length > 1) {
      paint(draft, mode === 'raw' ? COLOURS.raw : COLOURS.total, false, false);
    }
    if (calLine) {
      paint([calLine[0], calLine[1]], COLOURS.calibrate, false, false);
      for (const p of calLine) {
        ctx.beginPath();
        ctx.arc(p.x, p.y, lw * 3, 0, Math.PI * 2);
        ctx.fillStyle = COLOURS.calibrate;
        ctx.fill();
      }
    }
    ctx.restore();
  });

  // ---- pointer handling ----------------------------------------------------

  const onPointerDown = (e: React.PointerEvent) => {
    (e.target as Element).setPointerCapture?.(e.pointerId);
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });

    if (pointers.current.size === 2) {
      // Two fingers always means zoom and pan, whatever the mode — otherwise
      // a clinician cannot get close enough to trace accurately.
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
    if (mode === 'calibrate') {
      setCalLine([p, p]);
      drawing.current = true;
      return;
    }
    drawing.current = true;
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
      // Keep the point under the fingers fixed while the scale changes.
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
    if (mode === 'calibrate') {
      setCalLine((l) => (l ? [l[0], p] : [p, p]));
      return;
    }
    // Thin as we go: a dragged finger emits points a pixel apart.
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

    if (mode === 'calibrate') return;

    const pts = simplify(draft, 2 / view.current.scale);
    setDraft([]);
    if (pts.length < 3) return;   // a tap, not an outline

    const region: TracedRegion = { id: `${mode}-${Date.now()}`, points: pts };
    if (mode === 'total') setTotalRegions((r) => [...r, region]);
    else setRawRegions((r) => [...r, region]);
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

  const applyCalibration = () => {
    if (!calLine) return;
    const cm = Number(knownCm);
    const s = calibrationFromLine(calLine[0], calLine[1], cm);
    if (s) { setTracedPxPerCm(s); setMode('total'); }
  };

  const measurement = useMemo(
    () => (pixelsPerCm ? measureTrace(totalRegions, rawRegions, pixelsPerCm) : null),
    [totalRegions, rawRegions, pixelsPerCm],
  );
  const validation = useMemo(
    () => validateTrace(totalRegions, rawRegions, pixelsPerCm),
    [totalRegions, rawRegions, pixelsPerCm],
  );

  const undo = () => {
    if (mode === 'raw' && rawRegions.length) setRawRegions((r) => r.slice(0, -1));
    else if (totalRegions.length) setTotalRegions((r) => r.slice(0, -1));
    else if (rawRegions.length) setRawRegions((r) => r.slice(0, -1));
  };

  const rawLabel = siteRole === 'donor' ? 'Raw (not yet epithelialized)' : 'Open / non-viable graft';
  const healedLabel = siteRole === 'donor' ? 'Re-epithelialization' : 'Graft take';

  return (
    <div className="fixed inset-0 z-50 bg-gray-900 flex flex-col">
      <header className="flex items-center gap-3 px-4 py-2.5 bg-gray-800 text-white shrink-0">
        <Pencil className="w-5 h-5 text-teal-400 shrink-0" />
        <div className="min-w-0 flex-1">
          <h2 className="font-semibold text-sm truncate">Trace the site</h2>
          <p className="text-[11px] text-gray-400">
            Outline the whole {siteRole === 'donor' ? 'donor site' : 'graft'}, then outline what is still raw
          </p>
        </div>
        <button onClick={onCancel} className="p-1.5 rounded hover:bg-white/10" aria-label="Cancel">
          <X className="w-5 h-5" />
        </button>
      </header>

      {/* The canvas. touch-none so the browser does not scroll the page
          out from under a trace. */}
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

        {/* Live readout, over the image so the clinician sees the number
            change as they trace. */}
        {measurement && (
          <div className="absolute top-2 left-2 rounded-lg bg-black/70 text-white px-3 py-2 text-xs space-y-0.5 pointer-events-none">
            <p>Total <strong className="tabular-nums">{measurement.totalAreaCm2.toFixed(1)} cm²</strong></p>
            <p>Raw <strong className="tabular-nums">{measurement.rawAreaCm2.toFixed(1)} cm²</strong></p>
            <p className="text-teal-300">
              {healedLabel} <strong className="tabular-nums">{measurement.healedPct.toFixed(1)}%</strong>
            </p>
          </div>
        )}

        {mode === 'calibrate' && (
          <div className="absolute bottom-2 left-2 right-2 rounded-lg bg-blue-600/90 text-white px-3 py-2 text-xs">
            Drag a line along the full length of the calibration marker, then confirm its length.
          </div>
        )}
      </div>

      {/* Controls */}
      <div className="bg-gray-800 text-white px-3 py-3 space-y-3 shrink-0">
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
              <label className="text-xs text-gray-300">Marker length</label>
              <input
                type="number" step="0.1" min="0.1" value={knownCm}
                onChange={(e) => setKnownCm(e.target.value)}
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
            <button
              onClick={() => setMode('calibrate')}
              className="ml-auto text-xs underline text-gray-300 hover:text-white"
            >
              {pixelsPerCm ? 'Re-set the scale by hand' : 'Set the scale by hand'}
            </button>
          )}
        </div>

        {/* What is being drawn. */}
        <div className="grid grid-cols-4 gap-1.5">
          <ModeButton active={mode === 'total'} onClick={() => setMode('total')}
                      colour={COLOURS.total} label="Whole site" count={totalRegions.length} />
          <ModeButton active={mode === 'raw'} onClick={() => setMode('raw')}
                      colour={COLOURS.raw} label={siteRole === 'donor' ? 'Raw area' : 'Open area'}
                      count={rawRegions.length} />
          <button
            onClick={() => setMode('pan')}
            className={`flex flex-col items-center gap-0.5 py-2 rounded-lg text-[11px] ${
              mode === 'pan' ? 'bg-white text-gray-900 font-semibold' : 'bg-gray-700'
            }`}
          >
            <Hand className="w-4 h-4" /> Move
          </button>
          <button onClick={fit} className="flex flex-col items-center gap-0.5 py-2 rounded-lg bg-gray-700 text-[11px]">
            <Maximize2 className="w-4 h-4" /> Fit
          </button>
        </div>

        <p className="text-[11px] text-gray-400 flex items-start gap-1.5">
          <Info className="w-3.5 h-3.5 mt-0.5 shrink-0" />
          Drag to draw; the outline closes itself. Pinch or scroll to zoom in before tracing a
          fine margin. Several patches can be drawn on each layer.
          {siteRole === 'donor'
            ? ' Leave the raw layer empty once the donor site has fully epithelialized.'
            : ' Leave the open layer empty once the graft has fully taken.'}
        </p>

        {!validation.ok && validation.problems.length > 0 && (
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
            disabled={!totalRegions.length && !rawRegions.length}
            className="flex items-center gap-1.5 px-3 py-2.5 rounded-xl bg-gray-700 text-sm font-medium disabled:opacity-40"
          >
            <Undo2 className="w-4 h-4" /> Undo
          </button>
          <button
            onClick={() => { setTotalRegions([]); setRawRegions([]); setDraft([]); }}
            disabled={!totalRegions.length && !rawRegions.length}
            className="flex items-center gap-1.5 px-3 py-2.5 rounded-xl bg-gray-700 text-sm font-medium disabled:opacity-40"
          >
            <Trash2 className="w-4 h-4" /> Clear
          </button>
          <button
            onClick={() => {
              if (!measurement || !pixelsPerCm) return;
              onConfirm({
                totalRegions, rawRegions, pixelsPerCm, calibrationSource,
                totalAreaCm2: measurement.totalAreaCm2,
                rawAreaCm2: measurement.rawAreaCm2,
                healedAreaCm2: measurement.healedAreaCm2,
                healedPct: measurement.healedPct,
              });
            }}
            disabled={!validation.ok || !measurement}
            className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-teal-600 font-semibold disabled:opacity-40"
          >
            <Check className="w-4 h-4" />
            {measurement ? `Use ${measurement.healedPct.toFixed(1)}% ${healedLabel.toLowerCase()}` : 'Confirm'}
          </button>
        </div>
      </div>
    </div>
  );
}

function ModeButton({ active, onClick, colour, label, count }: {
  active: boolean; onClick: () => void; colour: string; label: string; count: number;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex flex-col items-center gap-0.5 py-2 rounded-lg text-[11px] ${
        active ? 'bg-white text-gray-900 font-semibold' : 'bg-gray-700 text-white'
      }`}
    >
      <span className="w-4 h-4 rounded-sm border-2" style={{ borderColor: colour, background: `${colour}44` }} />
      {label}{count > 0 ? ` (${count})` : ''}
    </button>
  );
}

/** Re-exported so callers need one import for the tracer and its geometry. */
export { polygonAreaPx, pxAreaToCm2 };
export default RegionTracer;

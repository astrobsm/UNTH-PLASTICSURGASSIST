/**
 * Trace and measure: the clinician traces the wound margin and the tissue
 * regions inside it on the photograph; the app measures everything else.
 *
 * Drawn straight from the decoded photograph (an ImageBitmap) rather than
 * re-loading it from an object URL — on Android the original camera file can
 * be gone by the time a second load is attempted, which left a blank canvas.
 *
 * Phones: zoom in for precision, switch to "Move" to scroll the zoomed photo,
 * back to "Draw" to trace. Each lift of the finger closes the shape.
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Check, Hand, Pencil, Undo2, Trash2, X, ZoomIn, ZoomOut, Wand2 } from 'lucide-react';
import type { Point } from '../../services/woundContourGeometry';
import { computeTrace, TISSUES, TISSUE_STYLE, type Remainder, type Tissue, type TraceResult } from '../../services/woundTissueTrace';

type Layer = 'wound' | Tissue;

export interface TraceOutput extends TraceResult {
  woundPx: Point[];
  regions: Record<Tissue, Point[][]>;
  remainder: Remainder;
  overlay: Blob | null;
}

interface Props {
  source: ImageBitmap | HTMLCanvasElement;
  width: number;
  height: number;
  pixelsPerCm: number;
  scaleLabel?: string;
  /** The automatic outline, in image pixels, offered as a starting point. */
  initialWoundPx?: Point[] | null;
  initial?: { woundPx: Point[]; regions: Record<Tissue, Point[][]>; remainder: Remainder } | null;
  onCancel: () => void;
  onDone: (out: TraceOutput) => void;
}

const EMPTY_REGIONS = (): Record<Tissue, Point[][]> => ({ granulation: [], slough: [], necrotic: [], epithelial: [] });

function tracePath(ctx: CanvasRenderingContext2D, pts: Point[], k: number, close = true) {
  ctx.beginPath();
  pts.forEach((p, i) => (i ? ctx.lineTo(p.x * k, p.y * k) : ctx.moveTo(p.x * k, p.y * k)));
  if (close) ctx.closePath();
}

/** Draw image + tracing at scale k (display px per image px). */
function paint(ctx: CanvasRenderingContext2D, source: CanvasImageSource, w: number, h: number, k: number,
  wound: Point[], regions: Record<Tissue, Point[][]>, live: Point[] | null, liveLayer: Layer) {
  ctx.clearRect(0, 0, w * k, h * k);
  ctx.drawImage(source, 0, 0, w * k, h * k);
  const lw = Math.max(2, 2.5 * Math.min(k * 2, 1.5));
  for (const t of [...TISSUES].reverse()) {
    for (const poly of regions[t]) {
      tracePath(ctx, poly, k);
      ctx.fillStyle = TISSUE_STYLE[t].fill; ctx.fill();
      ctx.strokeStyle = TISSUE_STYLE[t].stroke; ctx.lineWidth = lw * 0.7; ctx.stroke();
    }
  }
  if (wound.length > 2) {
    tracePath(ctx, wound, k);
    ctx.strokeStyle = '#ffffff'; ctx.lineWidth = lw + 2; ctx.stroke();
    ctx.strokeStyle = '#0f766e'; ctx.lineWidth = lw; ctx.stroke();
  }
  if (live && live.length > 1) {
    tracePath(ctx, live, k, false);
    ctx.strokeStyle = liveLayer === 'wound' ? '#0f766e' : TISSUE_STYLE[liveLayer].stroke;
    ctx.lineWidth = lw; ctx.setLineDash([6, 4]); ctx.stroke(); ctx.setLineDash([]);
  }
}

export default function WoundTracer({ source, width, height, pixelsPerCm, scaleLabel, initialWoundPx, initial, onCancel, onDone }: Props) {
  const boxRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [boxW, setBoxW] = useState(320);
  const [zoom, setZoom] = useState(1);
  const [mode, setMode] = useState<'draw' | 'move'>('draw');
  const [layer, setLayer] = useState<Layer>(initial?.woundPx?.length ? 'granulation' : 'wound');
  const [wound, setWound] = useState<Point[]>(initial?.woundPx || []);
  const [regions, setRegions] = useState<Record<Tissue, Point[][]>>(initial?.regions || EMPTY_REGIONS());
  const [remainder, setRemainder] = useState<Remainder>(initial?.remainder || 'granulation');
  const [history, setHistory] = useState<Array<{ wound: Point[]; regions: Record<Tissue, Point[][]> }>>([]);
  const live = useRef<Point[] | null>(null);
  const [, force] = useState(0);
  const [saving, setSaving] = useState(false);

  // Fit to the available width; re-fit on rotation / resize.
  useEffect(() => {
    const fit = () => setBoxW(Math.max(200, Math.floor(boxRef.current?.clientWidth || 320)));
    fit();
    window.addEventListener('resize', fit);
    return () => window.removeEventListener('resize', fit);
  }, []);

  const k = (boxW / width) * zoom;              // display px per image px
  const dpr = Math.min(window.devicePixelRatio || 1, 2);

  const redraw = useCallback(() => {
    const c = canvasRef.current;
    if (!c) return;
    c.width = Math.round(width * k * dpr);
    c.height = Math.round(height * k * dpr);
    c.style.width = `${Math.round(width * k)}px`;
    c.style.height = `${Math.round(height * k)}px`;
    const ctx = c.getContext('2d');
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    paint(ctx, source, width, height, k, wound, regions, live.current, layer);
  }, [source, width, height, k, dpr, wound, regions, layer]);

  useEffect(() => { redraw(); }, [redraw]);

  const toImage = (e: React.PointerEvent<HTMLCanvasElement>): Point => {
    const r = e.currentTarget.getBoundingClientRect();
    return { x: ((e.clientX - r.left) / r.width) * width, y: ((e.clientY - r.top) / r.height) * height };
  };

  const onDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (mode !== 'draw') return;
    e.currentTarget.setPointerCapture(e.pointerId);
    live.current = [toImage(e)];
    force(n => n + 1);
  };
  const onMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (mode !== 'draw' || !live.current) return;
    const p = toImage(e);
    const last = live.current[live.current.length - 1];
    if (Math.hypot((p.x - last.x) * k, (p.y - last.y) * k) < 2.5) return;
    live.current.push(p);
    const ctx = canvasRef.current?.getContext('2d');
    if (ctx) paint(ctx, source, width, height, k, wound, regions, live.current, layer);
  };
  const onUp = () => {
    const pts = live.current;
    live.current = null;
    if (pts && pts.length >= 3) {
      setHistory(h => [...h.slice(-30), { wound, regions }]);
      if (layer === 'wound') {
        setWound(pts);
        if (TISSUES.every(t => regions[t].length === 0)) setLayer('granulation');
      } else {
        setRegions(r => ({ ...r, [layer]: [...r[layer], pts] }));
      }
    } else {
      redraw();
    }
  };

  const undo = () => setHistory(h => {
    const prev = h[h.length - 1];
    if (prev) { setWound(prev.wound); setRegions(prev.regions); }
    return h.slice(0, -1);
  });
  const clearLayer = () => {
    setHistory(h => [...h, { wound, regions }]);
    if (layer === 'wound') setWound([]); else setRegions(r => ({ ...r, [layer]: [] }));
  };

  const result = useMemo(() => computeTrace({ woundPx: wound, regions, pixelsPerCm, remainder }), [wound, regions, pixelsPerCm, remainder]);

  const finish = async () => {
    if (!result) return;
    setSaving(true);
    // Evidence image: the photograph with every traced region, at up to 1600 px.
    let overlay: Blob | null = null;
    try {
      const s = Math.min(1, 1600 / Math.max(width, height));
      const c = document.createElement('canvas');
      c.width = Math.round(width * s); c.height = Math.round(height * s);
      const ctx = c.getContext('2d')!;
      paint(ctx, source, width, height, s, wound, regions, null, 'wound');
      const fs = Math.max(14, Math.round(c.width / 45));
      const lines = [
        `Area ${result.measurements.area} cm²  L ${result.measurements.length} × W ${result.measurements.width} cm`,
        TISSUES.filter(t => result.tissuePct[t] > 0).map(t => `${TISSUE_STYLE[t].label} ${result.tissuePct[t]}%`).join('  ·  ') || 'Tissue not traced',
        `Traced by clinician · ${new Date().toLocaleString()}`,
      ];
      ctx.font = `600 ${fs}px sans-serif`;
      const boxH = lines.length * fs * 1.35 + fs * 0.6;
      ctx.fillStyle = 'rgba(0,0,0,0.6)'; ctx.fillRect(0, c.height - boxH, c.width, boxH);
      ctx.fillStyle = '#fff';
      lines.forEach((l, i) => ctx.fillText(l, fs * 0.5, c.height - boxH + fs * 1.2 + i * fs * 1.35));
      overlay = await new Promise<Blob | null>(res => c.toBlob(b => res(b), 'image/jpeg', 0.85));
    } catch { overlay = null; }
    setSaving(false);
    onDone({ ...result, woundPx: wound, regions, remainder, overlay });
  };

  const layers: Layer[] = ['wound', ...TISSUES];
  const count = (l: Layer) => (l === 'wound' ? (wound.length > 2 ? 1 : 0) : regions[l].length);

  return (
    <div className="fixed inset-0 z-[60] bg-black/70 flex items-stretch sm:items-center justify-center sm:p-4" role="dialog" aria-modal="true" aria-label="Trace and measure the wound">
      <div className="bg-white w-full sm:max-w-3xl sm:rounded-xl flex flex-col max-h-screen sm:max-h-[96vh]">
        <div className="flex items-start justify-between gap-2 px-3 py-2 border-b">
          <div>
            <h3 className="font-semibold text-gray-900">Trace and measure</h3>
            <p className="text-[11px] text-gray-500">Scale: {pixelsPerCm.toFixed(1)} px/cm{scaleLabel ? ` · ${scaleLabel}` : ''}</p>
          </div>
          <button type="button" onClick={onCancel} className="p-1 text-gray-400" aria-label="Close"><X className="w-5 h-5" /></button>
        </div>

        {/* What to trace */}
        <div className="px-3 pt-2 flex gap-1.5 overflow-x-auto">
          {layers.map(l => {
            const st = l === 'wound' ? TISSUE_STYLE.wound : TISSUE_STYLE[l];
            const active = l === layer;
            return (
              <button key={l} type="button" onClick={() => setLayer(l)} disabled={l !== 'wound' && wound.length < 3}
                className={`shrink-0 flex items-center gap-1.5 px-2.5 py-1.5 rounded-full text-xs border disabled:opacity-40 ${active ? 'bg-gray-900 text-white border-gray-900' : 'bg-white text-gray-700 border-gray-300'}`}>
                <span className="w-3 h-3 rounded-full border border-white/60" style={{ background: l === 'wound' ? '#0f766e' : st.stroke }} />
                {st.label}{count(l) ? ` (${count(l)})` : ''}
              </button>
            );
          })}
        </div>
        <p className="px-3 pt-1 text-[11px] text-gray-600">
          {layer === 'wound'
            ? 'Trace the whole wound margin in one stroke; lift to close it. Tracing again replaces it.'
            : `Trace each ${TISSUE_STYLE[layer].label.toLowerCase()} area inside the wound — as many as there are.`}
        </p>

        <div className="px-3 py-1.5 flex flex-wrap items-center gap-1.5">
          <span className="inline-flex rounded-lg border overflow-hidden">
            <button type="button" onClick={() => setMode('draw')} className={`px-2.5 py-1.5 text-xs flex items-center gap-1 ${mode === 'draw' ? 'bg-teal-600 text-white' : ''}`}><Pencil className="w-3.5 h-3.5" /> Draw</button>
            <button type="button" onClick={() => setMode('move')} className={`px-2.5 py-1.5 text-xs flex items-center gap-1 ${mode === 'move' ? 'bg-teal-600 text-white' : ''}`}><Hand className="w-3.5 h-3.5" /> Move</button>
          </span>
          <button type="button" onClick={() => setZoom(z => Math.max(1, z / 1.5))} disabled={zoom <= 1} className="p-1.5 rounded border disabled:opacity-40" aria-label="Zoom out"><ZoomOut className="w-4 h-4" /></button>
          <span className="text-xs w-9 text-center">{zoom.toFixed(1)}×</span>
          <button type="button" onClick={() => { setZoom(z => Math.min(5, z * 1.5)); setMode('move'); }} disabled={zoom >= 5} className="p-1.5 rounded border disabled:opacity-40" aria-label="Zoom in"><ZoomIn className="w-4 h-4" /></button>
          <button type="button" onClick={undo} disabled={!history.length} className="px-2 py-1.5 rounded border text-xs flex items-center gap-1 disabled:opacity-40"><Undo2 className="w-3.5 h-3.5" /> Undo</button>
          <button type="button" onClick={clearLayer} disabled={!count(layer)} className="px-2 py-1.5 rounded border text-xs flex items-center gap-1 disabled:opacity-40"><Trash2 className="w-3.5 h-3.5" /> Clear</button>
          {layer === 'wound' && initialWoundPx && initialWoundPx.length > 2 && (
            <button type="button" onClick={() => { setHistory(h => [...h, { wound, regions }]); setWound(initialWoundPx); }} className="px-2 py-1.5 rounded border text-xs flex items-center gap-1"><Wand2 className="w-3.5 h-3.5" /> Use detected outline</button>
          )}
        </div>

        <div ref={boxRef} className={`mx-3 rounded-lg border bg-gray-900 overflow-auto ${zoom > 1 ? 'max-h-[50vh]' : ''}`} style={{ WebkitOverflowScrolling: 'touch' }}>
          <canvas
            ref={canvasRef}
            onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp}
            className={`block ${mode === 'draw' ? 'touch-none cursor-crosshair' : 'touch-auto cursor-grab'}`}
          />
        </div>

        <div className="px-3 py-2 overflow-y-auto space-y-2">
          {result ? (
            <>
              <div className="grid grid-cols-4 gap-1.5 text-center">
                {([['Area', `${result.measurements.area} cm²`], ['Length', `${result.measurements.length} cm`], ['Width', `${result.measurements.width} cm`], ['Perimeter', `${result.measurements.perimeter} cm`]] as const).map(([l, v]) => (
                  <div key={l} className="rounded-md bg-gray-50 border p-1.5"><div className="text-[10px] text-gray-500">{l}</div><div className="text-sm font-semibold tabular-nums">{v}</div></div>
                ))}
              </div>
              <div className="flex h-3 rounded-full overflow-hidden bg-gray-100" aria-label="Tissue composition">
                {TISSUES.map(t => result.tissuePct[t] > 0 && <div key={t} style={{ width: `${result.tissuePct[t]}%`, background: TISSUE_STYLE[t].stroke }} title={`${TISSUE_STYLE[t].label} ${result.tissuePct[t]}%`} />)}
              </div>
              <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs">
                {TISSUES.map(t => <span key={t}><span className="inline-block w-2 h-2 rounded-full mr-1" style={{ background: TISSUE_STYLE[t].stroke }} />{TISSUE_STYLE[t].label} {result.tissuePct[t]}% <span className="text-gray-400">({result.tissueAreaCm2[t]} cm²)</span></span>)}
                {result.unassignedPct > 0 && <span className="text-gray-500">Unassigned {result.unassignedPct}%</span>}
              </div>
              <label className="flex items-center gap-2 text-xs">
                <span className="text-gray-600">Untraced part of the wound counts as</span>
                <select value={remainder} onChange={e => setRemainder(e.target.value as Remainder)} className="border rounded px-1.5 py-1 text-xs">
                  {TISSUES.map(t => <option key={t} value={t}>{TISSUE_STYLE[t].label}</option>)}
                  <option value="unassigned">Leave unassigned</option>
                </select>
              </label>
              {result.tracedOutsideMargin && <p className="text-[11px] text-amber-700">Part of a tissue tracing lies outside the wound margin; only the part inside the margin is counted.</p>}
            </>
          ) : (
            <p className="text-xs text-gray-500">Start by tracing the wound margin.</p>
          )}
        </div>

        <div className="px-3 py-2 border-t flex gap-2">
          <button type="button" onClick={onCancel} className="flex-1 py-2 rounded-lg border text-sm">Cancel</button>
          <button type="button" onClick={finish} disabled={!result || saving} className="flex-[2] py-2 rounded-lg bg-teal-600 text-white text-sm font-medium disabled:opacity-50 inline-flex items-center justify-center gap-1.5">
            <Check className="w-4 h-4" /> {saving ? 'Saving…' : 'Use these measurements'}
          </button>
        </div>
      </div>
    </div>
  );
}

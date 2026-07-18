import React, { useMemo, useRef, useEffect } from 'react';
import type { WoundProgressEntry } from '../services/aiWoundMeasurement';

/**
 * Serial wound "healing map": every measurement's outline drawn on a shared
 * centimetre grid, registered to a common centre and colour-graded oldest → newest,
 * so the wound boundary is seen literally receding (or expanding) over time.
 *
 * Each entry's outline comes from its stored `contourCm` (cm, centred). Historical
 * entries that predate contour capture fall back to an ellipse synthesised from
 * length/width, so the whole series still plots.
 */
interface WoundHealingMapProps {
  measurements: WoundProgressEntry[];
  height?: number;
}

// Oldest → newest colour ramp (amber → red → green): old wound large & warm,
// newest outline highlighted so shrinkage is obvious.
function rampColor(t: number): string {
  // t in [0,1]; 0 = oldest, 1 = newest
  const stops = [
    { p: 0, c: [180, 83, 9] },     // amber-700
    { p: 0.5, c: [220, 38, 38] },  // red-600
    { p: 1, c: [22, 163, 74] },    // green-600
  ];
  let a = stops[0], b = stops[stops.length - 1];
  for (let i = 0; i < stops.length - 1; i++) {
    if (t >= stops[i].p && t <= stops[i + 1].p) { a = stops[i]; b = stops[i + 1]; break; }
  }
  const span = b.p - a.p || 1;
  const k = (t - a.p) / span;
  const ch = (i: number) => Math.round(a.c[i] + (b.c[i] - a.c[i]) * k);
  return `rgb(${ch(0)}, ${ch(1)}, ${ch(2)})`;
}

function ellipseContour(length: number, width: number): Array<{ x: number; y: number }> {
  const rx = Math.max(0.05, length / 2), ry = Math.max(0.05, width / 2);
  const pts: Array<{ x: number; y: number }> = [];
  for (let i = 0; i < 48; i++) {
    const a = (i / 48) * Math.PI * 2;
    pts.push({ x: Math.cos(a) * rx, y: Math.sin(a) * ry });
  }
  return pts;
}

const WoundHealingMap: React.FC<WoundHealingMapProps> = ({ measurements, height = 300 }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const series = useMemo(() => {
    return [...measurements]
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
      .map(m => ({
        date: m.date,
        area: m.area,
        contour: (m.contourCm && m.contourCm.length > 2) ? m.contourCm : ellipseContour(m.length, m.width),
      }));
  }, [measurements]);

  const maxExtentCm = useMemo(() => {
    let max = 1;
    for (const s of series) for (const p of s.contour) max = Math.max(max, Math.abs(p.x), Math.abs(p.y));
    return max * 1.15; // padding
  }, [series]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dpr = typeof window !== 'undefined' ? (window.devicePixelRatio || 1) : 1;
    const cssW = canvas.clientWidth || 320;
    const cssH = height;
    canvas.width = Math.round(cssW * dpr);
    canvas.height = Math.round(cssH * dpr);
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, cssW, cssH);

    const cx = cssW / 2, cy = cssH / 2;
    const size = Math.min(cssW, cssH) - 24;
    const pxPerCm = size / (2 * maxExtentCm); // cm → px
    const toPx = (p: { x: number; y: number }) => ({ x: cx + p.x * pxPerCm, y: cy + p.y * pxPerCm });

    // --- cm grid ---
    ctx.strokeStyle = 'rgba(148,163,184,0.35)'; // slate-400
    ctx.lineWidth = 1;
    ctx.font = '10px sans-serif';
    ctx.fillStyle = 'rgba(100,116,139,0.9)';
    const gridStep = maxExtentCm > 6 ? 2 : 1; // cm
    for (let c = -Math.floor(maxExtentCm); c <= maxExtentCm; c += gridStep) {
      const x = cx + c * pxPerCm, y = cy + c * pxPerCm;
      ctx.beginPath(); ctx.moveTo(x, cy - size / 2); ctx.lineTo(x, cy + size / 2); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(cx - size / 2, y); ctx.lineTo(cx + size / 2, y); ctx.stroke();
      if (c !== 0) ctx.fillText(`${c}`, x + 2, cy + 12);
    }
    // axes
    ctx.strokeStyle = 'rgba(100,116,139,0.7)';
    ctx.beginPath(); ctx.moveTo(cx, cy - size / 2); ctx.lineTo(cx, cy + size / 2); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(cx - size / 2, cy); ctx.lineTo(cx + size / 2, cy); ctx.stroke();

    // --- serial outlines ---
    series.forEach((s, i) => {
      const t = series.length > 1 ? i / (series.length - 1) : 1;
      const color = rampColor(t);
      const isLatest = i === series.length - 1;
      ctx.beginPath();
      s.contour.forEach((p, j) => {
        const q = toPx(p);
        if (j === 0) ctx.moveTo(q.x, q.y); else ctx.lineTo(q.x, q.y);
      });
      ctx.closePath();
      ctx.strokeStyle = color;
      ctx.lineWidth = isLatest ? 3 : 1.5;
      ctx.globalAlpha = isLatest ? 1 : 0.55;
      ctx.stroke();
      if (isLatest) { ctx.fillStyle = color; ctx.globalAlpha = 0.12; ctx.fill(); }
      ctx.globalAlpha = 1;
    });
  }, [series, maxExtentCm, height]);

  if (series.length < 1) {
    return (
      <div className="bg-gray-50 rounded-lg p-4 text-center text-gray-500 text-sm">
        No measurements yet for the healing map.
      </div>
    );
  }

  const first = series[0], last = series[series.length - 1];
  const areaReduction = first.area > 0 ? ((first.area - last.area) / first.area) * 100 : 0;
  const fmtDate = (d: string) => new Date(d).toLocaleDateString(undefined, { day: 'numeric', month: 'short' });

  return (
    <div className="space-y-2">
      <div className="bg-white rounded-lg border border-gray-200 p-2">
        <div className="flex items-center justify-between px-1 pb-1">
          <h4 className="text-sm font-semibold text-gray-700">Serial Healing Map</h4>
          <span className="text-xs text-gray-500">grid = cm · centred outlines</span>
        </div>
        <canvas ref={canvasRef} style={{ width: '100%', height }} />
      </div>

      {/* Legend: date → colour, oldest to newest */}
      <div className="flex flex-wrap items-center gap-2">
        {series.map((s, i) => {
          const t = series.length > 1 ? i / (series.length - 1) : 1;
          return (
            <span key={i} className="inline-flex items-center gap-1 text-xs text-gray-600">
              <span className="inline-block w-3 h-3 rounded-sm" style={{ backgroundColor: rampColor(t) }} />
              {fmtDate(s.date)} · {s.area.toFixed(1)}cm²
            </span>
          );
        })}
      </div>

      {series.length >= 2 && (
        <div className={`text-xs rounded-md px-3 py-2 ${areaReduction >= 0 ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
          {areaReduction >= 0
            ? `Wound area reduced ${areaReduction.toFixed(0)}% from ${fmtDate(first.date)} (${first.area.toFixed(1)} cm²) to ${fmtDate(last.date)} (${last.area.toFixed(1)} cm²).`
            : `Wound area increased ${Math.abs(areaReduction).toFixed(0)}% — review treatment.`}
        </div>
      )}
    </div>
  );
};

export default WoundHealingMap;

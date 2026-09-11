/**
 * The whole episode on one pair of axes.
 *
 * Each site has its own curve on its own panel, which answers "is this donor
 * site closing?" — but not "is this patient healing?", which is the question
 * asked on a ward round when a patient has a graft, its donor site, and a
 * second graft elsewhere. One chart, every site, same time axis.
 *
 * Two views because they answer different questions. Closure (%) compares
 * sites of different sizes against each other and shows who is falling behind.
 * Area (cm²) shows how much wound is actually left, which is what determines
 * dressing burden and is the figure that matters when a 2 cm² site at 60% is
 * doing better than a 90 cm² site at 80%.
 *
 * Inline SVG, as with DonorHealingCurve: the shape is a handful of polylines
 * and a chart whose geometry is in the file is a chart whose axes can be
 * checked.
 */

import { useMemo, useState } from 'react';
import { TrendingUp, Ruler } from 'lucide-react';
import type { GraftSite } from '../../services/skinGraftService';

const W = 640;
const H = 260;
const PAD = { top: 16, right: 18, bottom: 34, left: 44 };

/** Distinguishable without relying on colour alone — each also gets a marker. */
const SERIES_STYLE = [
  { colour: '#0d9488', dash: undefined },
  { colour: '#6366f1', dash: '6 3' },
  { colour: '#d97706', dash: '2 3' },
  { colour: '#be123c', dash: '8 3 2 3' },
  { colour: '#0369a1', dash: '4 2' },
];

type Mode = 'closure' | 'area';

interface Props {
  sites: GraftSite[];
  className?: string;
}

export function GraftProgressChart({ sites, className = '' }: Props) {
  const [mode, setMode] = useState<Mode>('closure');

  const series = useMemo(() => sites.map((s, i) => ({
    id: s.id,
    label: s.site_label || (s.site_role === 'donor' ? 'Donor site' : 'Recipient site'),
    role: s.site_role,
    style: SERIES_STYLE[i % SERIES_STYLE.length],
    points: s.series
      .filter((p) => p.day != null)
      .map((p) => ({
        day: p.day as number,
        closure: p.closurePct,
        area: p.openAreaCm2,
      }))
      .sort((a, b) => a.day - b.day),
  })).filter((s) => s.points.length > 0), [sites]);

  const hasAny = series.some((s) => s.points.length >= 2);

  const { maxDay, maxArea } = useMemo(() => {
    let d = 1;
    let a = 1;
    for (const s of series) {
      for (const p of s.points) {
        if (p.day > d) d = p.day;
        if (p.area != null && p.area > a) a = p.area;
      }
    }
    return { maxDay: d, maxArea: a };
  }, [series]);

  if (!series.length) {
    return (
      <div className={`bg-white border rounded-2xl p-6 text-sm text-gray-500 ${className}`}>
        No dated photographs yet, so there is no progress chart to draw.
      </div>
    );
  }

  const yMax = mode === 'closure' ? 100 : maxArea;
  const x = (d: number) => PAD.left + (d / (maxDay || 1)) * (W - PAD.left - PAD.right);
  const y = (v: number) => PAD.top + (1 - v / (yMax || 1)) * (H - PAD.top - PAD.bottom);

  const ticks = mode === 'closure'
    ? [0, 25, 50, 75, 100]
    : [0, yMax / 4, yMax / 2, (3 * yMax) / 4, yMax];

  return (
    <section className={`bg-white border rounded-2xl overflow-hidden ${className}`}>
      <header className="px-5 py-3 border-b bg-gray-50 flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-semibold text-gray-800 text-sm flex items-center gap-2">
          <TrendingUp className="w-4 h-4 text-gray-400" /> Progress across every site
        </h2>
        <div className="inline-flex p-0.5 rounded-lg bg-gray-200">
          {([['closure', 'Closure %'], ['area', 'Open area cm²']] as [Mode, string][]).map(([k, label]) => (
            <button
              key={k}
              onClick={() => setMode(k)}
              className={`px-3 py-1 rounded-md text-xs font-medium ${
                mode === k ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-600'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </header>

      <div className="p-4">
        <div className="overflow-x-auto">
          <svg
            viewBox={`0 0 ${W} ${H}`}
            className="w-full min-w-[480px]"
            role="img"
            aria-label={
              `${mode === 'closure' ? 'Closure percentage' : 'Open area'} against postoperative day. `
              + series.map((s) => `${s.label}: `
                + s.points.map((p) => `day ${p.day} ${
                  mode === 'closure'
                    ? (p.closure == null ? 'not measured' : `${Math.round(p.closure)}%`)
                    : (p.area == null ? 'not measured' : `${p.area.toFixed(1)} square centimetres`)
                }`).join(', ')).join('. ')
            }
          >
            {ticks.map((v, i) => (
              <g key={i}>
                <line
                  x1={PAD.left} x2={W - PAD.right} y1={y(v)} y2={y(v)}
                  stroke={mode === 'closure' && v === 100 ? '#86efac' : '#f1f5f9'}
                  strokeWidth={mode === 'closure' && v === 100 ? 1.5 : 1}
                  strokeDasharray={mode === 'closure' && v === 100 ? '4 3' : undefined}
                />
                <text x={PAD.left - 6} y={y(v) + 3.5} textAnchor="end" fontSize="9" className="fill-gray-400">
                  {mode === 'closure' ? v : v.toFixed(v >= 10 ? 0 : 1)}
                </text>
              </g>
            ))}

            {series.map((s) => {
              const pts = s.points.filter(
                (p) => (mode === 'closure' ? p.closure : p.area) != null,
              );
              if (!pts.length) return null;
              const d = pts.map((p, i) => {
                const v = (mode === 'closure' ? p.closure : p.area) as number;
                return `${i === 0 ? 'M' : 'L'}${x(p.day).toFixed(1)},${y(v).toFixed(1)}`;
              }).join(' ');
              return (
                <g key={s.id}>
                  <path
                    d={d} fill="none" stroke={s.style.colour} strokeWidth="2"
                    strokeDasharray={s.style.dash} strokeLinejoin="round"
                  />
                  {pts.map((p) => {
                    const v = (mode === 'closure' ? p.closure : p.area) as number;
                    return s.role === 'donor' ? (
                      <circle key={p.day} cx={x(p.day)} cy={y(v)} r="3.5" fill={s.style.colour} />
                    ) : (
                      <rect
                        key={p.day} x={x(p.day) - 3} y={y(v) - 3}
                        width="6" height="6" fill={s.style.colour}
                      />
                    );
                  })}
                </g>
              );
            })}

            <line x1={PAD.left} x2={W - PAD.right} y1={y(0)} y2={y(0)} stroke="#cbd5e1" />
            {[...new Set(series.flatMap((s) => s.points.map((p) => p.day)))]
              .sort((a, b) => a - b)
              .map((d) => (
                <text key={d} x={x(d)} y={H - PAD.bottom + 14} textAnchor="middle"
                      fontSize="9" className="fill-gray-400">
                  {d}
                </text>
              ))}
            <text x={(W - PAD.left) / 2 + PAD.left} y={H - 4} textAnchor="middle"
                  fontSize="9" className="fill-gray-400">
              postoperative day
            </text>
          </svg>
        </div>

        <ul className="flex flex-wrap gap-x-4 gap-y-1.5 mt-2">
          {series.map((s) => (
            <li key={s.id} className="flex items-center gap-1.5 text-xs text-gray-600">
              <svg width="18" height="10" aria-hidden="true">
                <line x1="0" y1="5" x2="18" y2="5" stroke={s.style.colour} strokeWidth="2"
                      strokeDasharray={s.style.dash} />
                {s.role === 'donor'
                  ? <circle cx="9" cy="5" r="3" fill={s.style.colour} />
                  : <rect x="6" y="2" width="6" height="6" fill={s.style.colour} />}
              </svg>
              <span className="truncate max-w-[14rem]">{s.label}</span>
              <span className="text-gray-400">{s.role === 'donor' ? 'donor' : 'recipient'}</span>
            </li>
          ))}
        </ul>

        {!hasAny && (
          <p className="text-xs text-gray-500 mt-2 flex items-start gap-1.5">
            <Ruler className="w-3.5 h-3.5 mt-0.5 shrink-0" />
            Only one dated photograph so far. A second one on a different day turns these
            points into a trajectory, a rate and a projected healing date.
          </p>
        )}
      </div>
    </section>
  );
}

export default GraftProgressChart;

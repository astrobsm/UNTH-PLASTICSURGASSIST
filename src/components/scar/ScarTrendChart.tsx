/**
 * One domain over time, with the treatments marked on it.
 *
 * The treatment overlay is the point. "Area increased 14%" is a fact; "area
 * increased 14% and the last two injections were eight weeks ago" is a
 * clinical question. Without the events on the same axis a clinician has to
 * hold the injection dates in their head while reading the curve, and in a
 * clinic they will not.
 *
 * Inline SVG for the same reason as the other charts here: the shape is a
 * polyline and some rules, and a chart whose geometry is in the file is a
 * chart whose axes can be checked.
 */

import { useMemo } from 'react';
import { Syringe } from 'lucide-react';
import type { ScarDomain, TreatmentEvent } from '../../services/scarService';

const W = 560;
const H = 180;
const PAD = { top: 14, right: 16, bottom: 28, left: 46 };

const TREND_COLOUR: Record<string, string> = {
  worsening: '#dc2626',
  improving: '#16a34a',
  stable: '#2563eb',
  fluctuating: '#d97706',
  indeterminate: '#94a3b8',
};

interface Props {
  domain: ScarDomain;
  treatments?: TreatmentEvent[];
  className?: string;
}

export function ScarTrendChart({ domain, treatments = [], className = '' }: Props) {
  const pts = domain.series;

  const { minV, maxV, maxDay } = useMemo(() => {
    const vals = pts.map((p) => p.value);
    const days = [
      ...pts.map((p) => p.day),
      ...treatments.map((t) => t.day).filter((d): d is number => d != null),
    ];
    const lo = Math.min(...vals);
    const hi = Math.max(...vals);
    // A flat series would collapse to a line on the axis; give it room.
    const pad = hi === lo ? Math.max(Math.abs(hi) * 0.1, 1) : (hi - lo) * 0.15;
    return {
      minV: lo - pad,
      maxV: hi + pad,
      maxDay: Math.max(1, ...days),
    };
  }, [pts, treatments]);

  if (pts.length === 0) {
    return (
      <div className={`rounded-xl border bg-gray-50 p-4 text-xs text-gray-500 ${className}`}>
        <span className="font-medium text-gray-700">{domain.label}</span> — not measured yet.
      </div>
    );
  }

  const colour = TREND_COLOUR[domain.trend] ?? TREND_COLOUR.indeterminate;
  const x = (d: number) => PAD.left + (d / maxDay) * (W - PAD.left - PAD.right);
  const y = (v: number) => PAD.top + (1 - (v - minV) / (maxV - minV || 1)) * (H - PAD.top - PAD.bottom);

  const path = pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${x(p.day).toFixed(1)},${y(p.value).toFixed(1)}`).join(' ');
  const given = treatments.filter((t) => t.day != null && t.status !== 'scheduled');

  return (
    <figure className={`rounded-xl border bg-white p-3 ${className}`}>
      <figcaption className="flex flex-wrap items-baseline justify-between gap-2 mb-1">
        <span className="text-sm font-semibold text-gray-800">
          {domain.label}
          {domain.unit && <span className="font-normal text-gray-400"> ({domain.unit})</span>}
        </span>
        <span className="text-xs font-medium capitalize" style={{ color: colour }}>
          {domain.trend}
        </span>
      </figcaption>

      <div className="overflow-x-auto">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="w-full min-w-[360px]"
          role="img"
          aria-label={
            `${domain.label} against day: `
            + pts.map((p) => `day ${p.day}, ${p.value}`).join('; ')
            + (given.length ? `. ${given.length} treatment event(s) marked.` : '')
          }
        >
          {[minV, (minV + maxV) / 2, maxV].map((v, i) => (
            <g key={i}>
              <line x1={PAD.left} x2={W - PAD.right} y1={y(v)} y2={y(v)} stroke="#f1f5f9" />
              <text x={PAD.left - 6} y={y(v) + 3.5} textAnchor="end" fontSize="9" className="fill-gray-400">
                {Math.abs(v) >= 10 ? v.toFixed(0) : v.toFixed(1)}
              </text>
            </g>
          ))}

          {/* Treatments, behind the curve so they never obscure a data point. */}
          {given.map((t, i) => (
            <g key={`t${i}`}>
              <line
                x1={x(t.day as number)} x2={x(t.day as number)}
                y1={PAD.top} y2={H - PAD.bottom}
                stroke="#a855f7" strokeWidth="1" strokeDasharray="3 3" opacity="0.7"
              />
              <circle cx={x(t.day as number)} cy={PAD.top - 4} r="3" fill="#a855f7" />
            </g>
          ))}

          <path d={path} fill="none" stroke={colour} strokeWidth="2" strokeLinejoin="round" />
          {pts.map((p) => (
            <circle key={p.day} cx={x(p.day)} cy={y(p.value)} r="3.5" fill={colour} />
          ))}

          <line x1={PAD.left} x2={W - PAD.right} y1={H - PAD.bottom} y2={H - PAD.bottom} stroke="#cbd5e1" />
          {pts.map((p) => (
            <text key={`d${p.day}`} x={x(p.day)} y={H - PAD.bottom + 13}
                  textAnchor="middle" fontSize="9" className="fill-gray-400">
              {p.day}
            </text>
          ))}
        </svg>
      </div>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-1 text-[11px] text-gray-500">
        {domain.fromBaseline?.ok && (
          <span>
            From baseline{' '}
            <strong className="text-gray-700">
              {domain.fromBaseline.absolute! > 0 ? '+' : ''}{domain.fromBaseline.absolute}
            </strong>
            {domain.fromBaseline.percent != null
              ? ` (${domain.fromBaseline.percent > 0 ? '+' : ''}${domain.fromBaseline.percent}%)`
              : ''}
          </span>
        )}
        {domain.rate?.ok && <span>{domain.rate.perMonth} {domain.rate.unit}</span>}
        {domain.acceleration?.ok && domain.acceleration.meaningful && (
          <span className={domain.acceleration.accelerating ? 'text-red-600 font-medium' : 'text-green-700'}>
            {domain.acceleration.accelerating ? 'Accelerating' : 'Decelerating'}
          </span>
        )}
        {given.length > 0 && (
          <span className="flex items-center gap-1 text-purple-600">
            <Syringe className="w-3 h-3" /> {given.length} treatment{given.length === 1 ? '' : 's'}
          </span>
        )}
      </div>

      {/* The percentage is withheld near a zero baseline; say why rather than
          leaving a blank where a number was expected. */}
      {domain.fromBaseline?.percentWithheld && (
        <p className="text-[11px] text-amber-700 mt-0.5">
          {domain.fromBaseline.percentWithheldReason}
        </p>
      )}
    </figure>
  );
}

export default ScarTrendChart;

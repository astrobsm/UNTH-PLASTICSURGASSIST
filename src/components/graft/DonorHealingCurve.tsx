/**
 * Closure against postoperative day, with the fitted line and where it goes.
 *
 * Drawn as inline SVG rather than through a charting library: the page already
 * carries TensorFlow and jsPDF, the shape is four elements, and a chart whose
 * geometry is in the file is a chart whose axes can be checked.
 *
 * The observed points are solid and the extrapolation is dashed, because they
 * are different kinds of claim: one is measured, the other is arithmetic about
 * the future. The prediction interval is shaded so its width — which is the
 * honest part — is the first thing visible.
 */

import { useMemo } from 'react';
import type { SeriesPoint, Prediction } from '../../services/skinGraftService';

interface Props {
  series: SeriesPoint[];
  prediction: Prediction | null;
  /** 'Re-epithelialization' for a donor site, 'Graft take' for a recipient. */
  label: string;
  className?: string;
}

const W = 520;
const H = 220;
const PAD = { top: 14, right: 16, bottom: 30, left: 38 };

export function DonorHealingCurve({ series, prediction, label, className = '' }: Props) {
  const points = useMemo(
    () => series
      .filter((p) => p.day != null && p.closurePct != null)
      .map((p) => ({ day: p.day as number, pct: p.closurePct as number }))
      .sort((a, b) => a.day - b.day),
    [series],
  );

  if (points.length === 0) {
    return (
      <div className={`bg-white border rounded-xl p-5 text-sm text-gray-500 ${className}`}>
        No measured photographs yet, so there is no healing curve to draw.
      </div>
    );
  }

  // The x axis has to reach whichever is further: the last photograph, or the
  // far end of the predicted interval.
  const lastDay = points[points.length - 1].day;
  const predHigh = prediction?.ok && prediction.predictedRange
    ? prediction.predictedRange[1]
    : prediction?.ok && prediction.predictedDay != null ? prediction.predictedDay : lastDay;
  const maxDay = Math.max(lastDay, predHigh, lastDay + 1);
  const minDay = Math.min(0, points[0].day);

  const x = (d: number) => PAD.left + ((d - minDay) / (maxDay - minDay || 1)) * (W - PAD.left - PAD.right);
  const y = (p: number) => PAD.top + (1 - p / 100) * (H - PAD.top - PAD.bottom);

  const path = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${x(p.day).toFixed(1)},${y(p.pct).toFixed(1)}`).join(' ');

  const last = points[points.length - 1];
  const showPrediction = !!prediction?.ok && !prediction.alreadyComplete && prediction.predictedDay != null;

  return (
    <figure className={`bg-white border rounded-xl p-4 ${className}`}>
      <figcaption className="text-sm font-semibold text-gray-800 mb-1">
        {label} against postoperative day
      </figcaption>

      <div className="overflow-x-auto">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="w-full min-w-[420px]"
          role="img"
          aria-label={
            `${label}: ${points.map((p) => `POD ${p.day} ${Math.round(p.pct)}%`).join('; ')}.`
            + (showPrediction ? ` Projected to reach 100% about POD ${prediction!.predictedDay}.` : '')
          }
        >
          {/* Horizontal gridlines at the quartiles, labelled. */}
          {[0, 25, 50, 75, 100].map((v) => (
            <g key={v}>
              <line
                x1={PAD.left} x2={W - PAD.right} y1={y(v)} y2={y(v)}
                stroke={v === 100 ? '#86efac' : '#f1f5f9'}
                strokeWidth={v === 100 ? 1.5 : 1}
                strokeDasharray={v === 100 ? '4 3' : undefined}
              />
              <text x={PAD.left - 6} y={y(v) + 3.5} textAnchor="end" className="fill-gray-400" fontSize="9">
                {v}
              </text>
            </g>
          ))}

          {/* The predicted interval, shaded, so its width reads first. */}
          {showPrediction && prediction!.predictedRange && (
            <rect
              x={x(prediction!.predictedRange![0])}
              y={PAD.top}
              width={Math.max(1, x(prediction!.predictedRange![1]) - x(prediction!.predictedRange![0]))}
              height={H - PAD.top - PAD.bottom}
              fill="#bfdbfe" opacity="0.35"
            />
          )}

          {/* Extrapolation from the last measured point to the projection. */}
          {showPrediction && (
            <line
              x1={x(last.day)} y1={y(last.pct)}
              x2={x(prediction!.predictedDay!)} y2={y(100)}
              stroke="#2563eb" strokeWidth="1.5" strokeDasharray="5 4"
            />
          )}

          {/* What was actually measured. */}
          <path d={path} fill="none" stroke="#16a34a" strokeWidth="2" strokeLinejoin="round" />
          {points.map((p) => (
            <circle key={p.day} cx={x(p.day)} cy={y(p.pct)} r="3.5" fill="#16a34a" />
          ))}

          {/* x axis: the days actually photographed. */}
          <line x1={PAD.left} x2={W - PAD.right} y1={y(0)} y2={y(0)} stroke="#cbd5e1" />
          {points.map((p) => (
            <text key={`t${p.day}`} x={x(p.day)} y={H - PAD.bottom + 14}
                  textAnchor="middle" className="fill-gray-400" fontSize="9">
              {p.day}
            </text>
          ))}
          {showPrediction && (
            <text x={x(prediction!.predictedDay!)} y={H - PAD.bottom + 14}
                  textAnchor="middle" className="fill-blue-600" fontSize="9" fontWeight="600">
              {prediction!.predictedDay}
            </text>
          )}
          <text x={(W - PAD.left) / 2 + PAD.left} y={H - 2} textAnchor="middle"
                className="fill-gray-400" fontSize="9">
            postoperative day
          </text>
        </svg>
      </div>

      {/* What the dashed line is, and what it is not. */}
      {prediction && (
        <p className="text-xs text-gray-500 mt-2 leading-5">
          {prediction.ok && prediction.alreadyComplete ? (
            <>Closed on the most recent photograph.</>
          ) : prediction.ok ? (
            <>
              <span className="font-medium text-gray-700">
                Projected complete about POD {prediction.predictedDay}
                {prediction.predictedRange
                  ? ` (${prediction.predictedRange[0]}–${prediction.predictedRange[1]})`
                  : ''}
              </span>{' '}
              — {prediction.intervalBasis}, from {prediction.basis}, closing about{' '}
              {prediction.ratePctPerDay}% a day. This is a straight-line extrapolation of the
              measured photographs, not a validated predictive model.
            </>
          ) : (
            <>No completion could be projected: {prediction.reason}</>
          )}
        </p>
      )}
    </figure>
  );
}

export default DonorHealingCurve;

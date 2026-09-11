/**
 * One graft site: what the photographs measured, and what it means.
 *
 * The layout follows §58 — photograph first, automated analysis second,
 * clinical review third — and §59's result screen. Every quantitative figure
 * is placed next to the photograph it came from, because a number whose
 * working cannot be seen is a number that has to be taken on trust.
 *
 * The two kinds of number are visually separated and never mixed:
 * areal measurements, which the pipeline genuinely produces, and tissue
 * proportions, which it withholds until a validated model exists.
 */

import { useState } from 'react';
import {
  Camera, Lock, AlertTriangle, CheckCircle2, Info, ChevronDown, ChevronUp,
  Ruler, TrendingUp, HelpCircle, ShieldAlert,
} from 'lucide-react';
import type { GraftSite, SeriesPoint } from '../../services/skinGraftService';
import { DonorHealingCurve } from './DonorHealingCurve';

interface Props {
  site: GraftSite;
  onCapture?: (site: GraftSite) => void;
  onLockBaseline?: (site: GraftSite, point: SeriesPoint) => void;
  className?: string;
}

const TREND_STYLE: Record<string, { label: string; cls: string }> = {
  improving:     { label: 'Improving',            cls: 'bg-green-100 text-green-800' },
  accelerated:   { label: 'Healing faster than expected', cls: 'bg-green-100 text-green-800' },
  expected:      { label: 'On the expected trajectory',   cls: 'bg-green-100 text-green-800' },
  stable:        { label: 'Stable',               cls: 'bg-blue-100 text-blue-800' },
  delayed:       { label: 'Delayed',              cls: 'bg-amber-100 text-amber-800' },
  deteriorating: { label: 'Deteriorating',        cls: 'bg-red-100 text-red-800' },
  uncertain:     { label: 'Uncertain',            cls: 'bg-gray-100 text-gray-600' },
};

export function GraftSitePanel({ site, onCapture, onLockBaseline, className = '' }: Props) {
  const [showAll, setShowAll] = useState(false);

  const isDonor = site.site_role === 'donor';
  const latest = site.series.length ? site.series[site.series.length - 1] : null;
  const trend = TREND_STYLE[site.trend?.trend] || TREND_STYLE.uncertain;
  const closureLabel = isDonor ? 'Re-epithelialization' : 'Graft take';

  return (
    <section className={`bg-white border rounded-2xl overflow-hidden ${className}`}>
      <header className="px-5 py-3 border-b bg-gray-50 flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <h3 className="font-semibold text-gray-900 truncate">
            {site.site_label || (isDonor ? 'Donor site' : 'Recipient site')}
            {site.anatomical_location && (
              <span className="font-normal text-gray-500"> · {site.anatomical_location}</span>
            )}
          </h3>
          <p className="text-xs text-gray-500">
            {isDonor ? 'Donor' : 'Recipient'} · {site.series.length} photograph
            {site.series.length === 1 ? '' : 's'}
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${trend.cls}`}>{trend.label}</span>
          {onCapture && (
            <button
              onClick={() => onCapture(site)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-green-600 text-white text-sm font-medium hover:bg-green-700"
            >
              <Camera className="w-4 h-4" /> Photograph
            </button>
          )}
        </div>
      </header>

      <div className="p-5 space-y-5">
        {/* The baseline, and whether it is fixed. Everything below is a
            proportion of it, so it is stated before any proportion is. */}
        <div className={`flex items-start gap-2.5 p-3 rounded-xl border text-sm ${
          site.baseline_locked
            ? 'bg-gray-50 border-gray-200'
            : 'bg-amber-50 border-amber-200'
        }`}>
          {site.baseline_locked
            ? <Lock className="w-4 h-4 text-gray-500 mt-0.5 shrink-0" />
            : <AlertTriangle className="w-4 h-4 text-amber-600 mt-0.5 shrink-0" />}
          <div className="min-w-0">
            {site.baseline_locked ? (
              <p className="text-gray-700">
                Baseline <strong>{Number(site.baseline_area_cm2).toFixed(1)} cm²</strong>, locked
                {site.baseline_captured_at
                  ? ` from the photograph of ${new Date(site.baseline_captured_at).toLocaleDateString()}`
                  : ''}
                . {closureLabel} is measured against this and does not change when later
                photographs do.
              </p>
            ) : (
              <p className="text-amber-900">
                No baseline is locked for this site, so {closureLabel.toLowerCase()} cannot be
                calculated — there is no denominator. Lock the first post-operative photograph
                as the baseline.
                {latest && onLockBaseline && (
                  <button
                    onClick={() => onLockBaseline(site, latest)}
                    className="ml-2 underline font-medium hover:no-underline"
                  >
                    Lock the latest photograph
                  </button>
                )}
              </p>
            )}
          </div>
        </div>

        {/* §59 — the measured result. */}
        {latest ? (
          <>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <Metric
                label="Image quality"
                value={latest.imageQualityScore != null
                  ? `${Math.round(latest.imageQualityScore * 100)}%` : '—'}
                ok={latest.imageQualityScore != null && latest.imageQualityScore >= 0.6}
              />
              <Metric
                label="Calibration"
                value={latest.scaleReliable ? 'Valid' : 'Unreliable'}
                ok={latest.scaleReliable}
                hint={latest.calibrationType || undefined}
              />
              <Metric
                label="Open area"
                value={latest.openAreaCm2 != null ? `${latest.openAreaCm2.toFixed(1)} cm²` : '—'}
              />
              <Metric
                label={closureLabel}
                value={latest.closurePct != null ? `${latest.closurePct.toFixed(1)}%` : '—'}
                emphasis
              />
            </div>

            {/* §28 — whether this photograph could be compared at all. */}
            {latest.comparable === false && (
              <Note tone="amber" icon={<ShieldAlert className="w-4 h-4" />}>
                {latest.comparabilityReason
                  || 'Longitudinal quantitative comparison cannot be performed reliably from this photograph.'}
              </Note>
            )}

            {/* §14/§36 — the tissue proportions, and why they are absent. */}
            {latest.tissueStatus === 'unavailable' ? (
              <Note tone="gray" icon={<HelpCircle className="w-4 h-4" />}>
                <strong>Automated tissue assessment unavailable.</strong>{' '}
                {latest.tissueReason
                  || 'No validated tissue-classification model is registered on this deployment.'}{' '}
                The areas and {closureLabel.toLowerCase()} above are measured from the photograph
                and are unaffected; the character of the remaining open area is a clinical judgement.
              </Note>
            ) : (
              <div className="grid grid-cols-2 gap-3">
                <Metric
                  label="AI-estimated viable"
                  value={latest.viabilityPct != null ? `${latest.viabilityPct.toFixed(1)}%` : '—'}
                  hint="AI estimate"
                />
                <Metric
                  label="AI-estimated epithelialized"
                  value={latest.epithelializedPct != null ? `${latest.epithelializedPct.toFixed(1)}%` : '—'}
                  hint="AI estimate"
                />
              </div>
            )}

            {/* The evidence: the traced margin over the photograph it came from. */}
            {(latest.overlayUrl || latest.imageUrl) && (
              <div>
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
                  Most recent photograph{latest.overlayUrl ? ', with the traced margin' : ''}
                </p>
                <img
                  src={latest.overlayUrl || latest.imageUrl || ''}
                  alt={`${site.site_label || 'Graft site'} on postoperative day ${latest.day ?? '—'}`}
                  className="rounded-xl border max-h-72 object-contain bg-gray-50"
                  loading="lazy"
                />
                <p className="text-[11px] text-gray-400 mt-1">
                  POD {latest.day ?? '—'} · {new Date(latest.capturedAt).toLocaleString()}
                  {latest.modelName ? ` · ${latest.modelName} ${latest.modelVersion || ''}` : ''}
                </p>
              </div>
            )}
          </>
        ) : (
          <div className="text-center py-8 text-sm text-gray-500">
            <Camera className="w-7 h-7 mx-auto text-gray-300 mb-2" />
            No photographs yet for this site.
          </div>
        )}

        {/* §21/§22 — rate and curve. */}
        {site.series.length >= 2 && (
          <>
            <div className="flex flex-wrap items-center gap-x-5 gap-y-1 text-sm text-gray-600">
              <span className="flex items-center gap-1.5">
                <TrendingUp className="w-4 h-4 text-gray-400" />
                {site.rate?.ok
                  ? <>Closing about <strong>{site.rate.pctPerDay}%</strong> a day
                      {site.rate.cm2PerDay != null && <> ({site.rate.cm2PerDay} cm²/day)</>}</>
                  : <>Rate not yet calculable</>}
              </span>
              {site.rate?.ok && site.rate.r2 != null && (
                <span className="text-xs text-gray-400">fit R² {site.rate.r2}</span>
              )}
            </div>

            <DonorHealingCurve
              series={site.series}
              prediction={site.prediction}
              label={closureLabel}
            />
          </>
        )}

        {site.trend?.reason && (
          <p className="text-xs text-gray-500">
            <Info className="w-3.5 h-3.5 inline mr-1 -mt-0.5" />
            Automated trend assessment: {site.trend.reason}
          </p>
        )}

        {site.overdue && (
          <Note tone="amber" icon={<AlertTriangle className="w-4 h-4" />}>{site.overdue.message}</Note>
        )}

        {/* §40 — every photograph, as a series. */}
        {site.series.length > 1 && (
          <div>
            <button
              onClick={() => setShowAll((v) => !v)}
              className="flex items-center gap-1.5 text-sm font-medium text-gray-600 hover:text-gray-900"
              aria-expanded={showAll}
            >
              {showAll ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              All {site.series.length} photographs
            </button>

            {showAll && (
              <ol className="mt-3 divide-y border rounded-xl overflow-hidden">
                {[...site.series].reverse().map((p) => (
                  <li key={p.assessmentId} className="px-3 py-2.5 flex items-center gap-3 text-sm">
                    <span className="w-14 shrink-0 text-xs font-medium text-gray-500 tabular-nums">
                      POD {p.day ?? '—'}
                    </span>
                    <span className="w-20 shrink-0 tabular-nums text-gray-800">
                      {p.closurePct != null ? `${p.closurePct.toFixed(1)}%` : '—'}
                    </span>
                    <span className="w-24 shrink-0 tabular-nums text-gray-500 text-xs">
                      {p.openAreaCm2 != null ? `${p.openAreaCm2.toFixed(1)} cm² open` : ''}
                    </span>
                    <span className="flex items-center gap-1 text-xs shrink-0">
                      {p.scaleReliable
                        ? <Ruler className="w-3.5 h-3.5 text-green-600" aria-label="calibrated" />
                        : <Ruler className="w-3.5 h-3.5 text-gray-300" aria-label="not calibrated" />}
                    </span>
                    <span className="ml-auto text-xs text-gray-400 shrink-0">
                      {new Date(p.capturedAt).toLocaleDateString()}
                    </span>
                  </li>
                ))}
              </ol>
            )}
          </div>
        )}
      </div>
    </section>
  );
}

function Metric({ label, value, ok, hint, emphasis }: {
  label: string; value: string; ok?: boolean; hint?: string; emphasis?: boolean;
}) {
  return (
    <div className={`rounded-xl border p-3 ${emphasis ? 'bg-green-50 border-green-200' : 'bg-gray-50'}`}>
      <p className="text-[11px] text-gray-500 leading-tight">{label}</p>
      <p className={`font-bold tabular-nums ${emphasis ? 'text-xl text-green-800' : 'text-lg text-gray-900'}`}>
        {value}
        {ok === true && <CheckCircle2 className="w-3.5 h-3.5 inline ml-1 -mt-0.5 text-green-600" />}
        {ok === false && <AlertTriangle className="w-3.5 h-3.5 inline ml-1 -mt-0.5 text-amber-500" />}
      </p>
      {hint && <p className="text-[10px] text-gray-400 mt-0.5 truncate">{hint}</p>}
    </div>
  );
}

function Note({ tone, icon, children }: {
  tone: 'amber' | 'gray' | 'red'; icon: React.ReactNode; children: React.ReactNode;
}) {
  const cls = tone === 'amber' ? 'bg-amber-50 border-amber-200 text-amber-900'
            : tone === 'red' ? 'bg-red-50 border-red-200 text-red-900'
            : 'bg-gray-50 border-gray-200 text-gray-700';
  return (
    <div className={`flex items-start gap-2.5 p-3 rounded-xl border text-sm leading-6 ${cls}`}>
      <span className="mt-0.5 shrink-0">{icon}</span>
      <div className="min-w-0">{children}</div>
    </div>
  );
}

export default GraftSitePanel;

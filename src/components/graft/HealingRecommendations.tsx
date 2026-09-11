/**
 * What the measurements suggest doing next.
 *
 * Decision support, and presented as such. Each item shows the measurement it
 * came from, because advice a clinician cannot interrogate is advice they must
 * either obey or ignore — and in a busy unit they will ignore it.
 *
 * The triggered advice is separated from the standing general measures, so it
 * is obvious what the app actually noticed today versus what it always says.
 */

import { useState } from 'react';
import {
  Lightbulb, AlertOctagon, AlertTriangle, Info, ChevronDown, ChevronUp,
  Stethoscope,
} from 'lucide-react';

export interface Recommendation {
  priority: 'urgent' | 'high' | 'routine' | 'information';
  code: string;
  text: string;
  basis: string;
}

export interface GeneralMeasure {
  area: string;
  text: string;
}

const STYLE: Record<Recommendation['priority'], {
  cls: string; icon: React.ReactNode; label: string;
}> = {
  urgent: {
    cls: 'bg-red-50 border-red-200 text-red-900',
    icon: <AlertOctagon className="w-4 h-4 text-red-600" />, label: 'Act today',
  },
  high: {
    cls: 'bg-amber-50 border-amber-200 text-amber-900',
    icon: <AlertTriangle className="w-4 h-4 text-amber-600" />, label: 'Address soon',
  },
  routine: {
    cls: 'bg-blue-50 border-blue-200 text-blue-900',
    icon: <Info className="w-4 h-4 text-blue-600" />, label: 'Routine',
  },
  information: {
    cls: 'bg-gray-50 border-gray-200 text-gray-700',
    icon: <Info className="w-4 h-4 text-gray-400" />, label: 'For information',
  },
};

interface Props {
  recommendations: Recommendation[];
  generalMeasures?: GeneralMeasure[];
  siteLabel?: string;
  className?: string;
}

export function HealingRecommendations({
  recommendations, generalMeasures = [], siteLabel, className = '',
}: Props) {
  const [showGeneral, setShowGeneral] = useState(false);

  const hasAdvice = recommendations.length > 0;

  return (
    <section className={`bg-white border rounded-2xl overflow-hidden ${className}`}>
      <header className="px-5 py-3 border-b bg-gray-50 flex items-center gap-2">
        <Lightbulb className="w-4 h-4 text-gray-400 shrink-0" />
        <h3 className="font-semibold text-gray-800 text-sm">
          Healing recommendations{siteLabel ? ` — ${siteLabel}` : ''}
        </h3>
      </header>

      <div className="p-4 space-y-3">
        {hasAdvice ? (
          <ul className="space-y-2.5">
            {recommendations.map((r) => {
              const s = STYLE[r.priority] ?? STYLE.information;
              return (
                <li key={r.code} className={`rounded-xl border p-3 ${s.cls}`}>
                  <div className="flex items-start gap-2.5">
                    <span className="mt-0.5 shrink-0">{s.icon}</span>
                    <div className="min-w-0">
                      <p className="text-[11px] font-semibold uppercase tracking-wide opacity-70">
                        {s.label}
                      </p>
                      <p className="text-sm leading-6 mt-0.5">{r.text}</p>
                      {/* The measurement behind it, so the reasoning can be
                          argued with rather than only the conclusion. */}
                      <p className="text-[11px] mt-1.5 opacity-75 italic">
                        Based on: {r.basis}
                      </p>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="text-sm text-gray-500">
            Nothing specific to flag from the measurements so far. Recommendations appear
            as photographs accumulate and the surface is traced.
          </p>
        )}

        {generalMeasures.length > 0 && (
          <div className="pt-1">
            <button
              onClick={() => setShowGeneral((v) => !v)}
              className="flex items-center gap-1.5 text-sm font-medium text-gray-600 hover:text-gray-900"
              aria-expanded={showGeneral}
            >
              {showGeneral ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              <Stethoscope className="w-4 h-4 text-gray-400" />
              General measures for wound healing
            </button>

            {showGeneral && (
              <dl className="mt-2.5 divide-y border rounded-xl overflow-hidden">
                {generalMeasures.map((m) => (
                  <div key={m.area} className="px-3.5 py-2.5">
                    <dt className="text-xs font-semibold text-gray-800">{m.area}</dt>
                    <dd className="text-sm text-gray-600 leading-6 mt-0.5">{m.text}</dd>
                  </div>
                ))}
              </dl>
            )}
          </div>
        )}

        <p className="text-[11px] text-gray-400 leading-5 pt-1 border-t">
          These are suggestions derived from the photographic measurements, for a clinician
          who can examine the patient. They do not diagnose, do not prescribe, and do not
          replace clinical assessment.
        </p>
      </div>
    </section>
  );
}

export default HealingRecommendations;

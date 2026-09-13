/**
 * A keloid's state, in keloid terms.
 *
 * The wound monitor answers "how much smaller, how fast, when closed". None of
 * those is a question a keloid has. It does not epithelialize and it does not
 * close, so a healing map it will never complete and a projected closure date
 * are worse than useless — they are a clinician being shown a number that
 * cannot mean anything.
 *
 * The four panels here are the ones that change management:
 *
 *   Growth      is the bulk increasing, holding, or coming down
 *   Activity    red, itchy, painful, firm — the lesion that responds to steroid
 *   Response    what happened across the injection series
 *   Recurrence  growth after excision, which is a different finding entirely
 */

import {
  TrendingUp, TrendingDown, Minus, Flame, Syringe, AlertOctagon,
  Info, HelpCircle, Activity as ActivityIcon,
} from 'lucide-react';

export interface KeloidAnalytics {
  growth: {
    ok: boolean; direction?: 'growing' | 'regressing' | 'static';
    perMonthCm2?: number; fractionPerMonth?: number;
    currentAreaCm2?: number; baselineAreaCm2?: number;
    totalChangeCm2?: number; totalChangePct?: number | null;
    spanDays?: number; n?: number; reason?: string;
  };
  acceleration: { ok: boolean; accelerating?: boolean; meaningful?: boolean; reason?: string };
  activity: {
    status: 'active' | 'partially_active' | 'quiescent' | 'not_assessed';
    summary: string;
    signals: { name: string; value: unknown; active: boolean }[];
    absent: string[];
  };
  status: { status: string; label: string; summary: string };
  treatmentResponse: {
    ok: boolean; response?: string; changePct?: number; changeCm2?: number;
    beforeAreaCm2?: number; afterAreaCm2?: number; injectionsInInterval?: number;
    intervalDays?: number; caveat?: string; reason?: string;
  };
}

const STATUS_STYLE: Record<string, string> = {
  progressive: 'bg-red-50 border-red-200 text-red-900',
  possible_recurrence: 'bg-red-50 border-red-300 text-red-900',
  stable_active: 'bg-amber-50 border-amber-200 text-amber-900',
  regressing: 'bg-green-50 border-green-200 text-green-900',
  quiescent: 'bg-green-50 border-green-200 text-green-900',
  stable: 'bg-blue-50 border-blue-200 text-blue-900',
  insufficient: 'bg-gray-50 border-gray-200 text-gray-700',
};

const RESPONSE_LABEL: Record<string, { text: string; cls: string }> = {
  marked_reduction: { text: 'Marked reduction', cls: 'text-green-700' },
  partial_reduction: { text: 'Partial reduction', cls: 'text-green-700' },
  no_significant_change: { text: 'No significant change', cls: 'text-amber-700' },
  enlargement_despite_treatment: { text: 'Enlarged despite treatment', cls: 'text-red-700' },
  indeterminate: { text: 'Indeterminate', cls: 'text-gray-600' },
};

export function KeloidStatusPanel({ keloid, className = '' }: {
  keloid: KeloidAnalytics; className?: string;
}) {
  const { growth, acceleration, activity, status, treatmentResponse: tr } = keloid;
  const cls = STATUS_STYLE[status.status] ?? STATUS_STYLE.insufficient;

  const GrowthIcon = growth.direction === 'growing' ? TrendingUp
    : growth.direction === 'regressing' ? TrendingDown : Minus;

  return (
    <div className={`space-y-3 ${className}`}>
      {/* The one line a ward round wants. */}
      <div className={`rounded-xl border p-4 ${cls}`}>
        <div className="flex items-start gap-2.5">
          {status.status === 'possible_recurrence'
            ? <AlertOctagon className="w-5 h-5 mt-0.5 shrink-0" />
            : <ActivityIcon className="w-5 h-5 mt-0.5 shrink-0" />}
          <div className="min-w-0">
            <p className="font-semibold">{status.label}</p>
            <p className="text-sm leading-6 mt-0.5">{status.summary}</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {/* Growth — not "area reduction". */}
        <section className="rounded-xl border bg-white p-3.5">
          <h4 className="text-sm font-semibold text-gray-800 flex items-center gap-1.5 mb-2">
            <GrowthIcon className="w-4 h-4 text-gray-400" /> Growth
          </h4>
          {growth.ok ? (
            <>
              <p className="text-2xl font-bold tabular-nums text-gray-900">
                {growth.perMonthCm2! > 0 ? '+' : ''}{growth.perMonthCm2}
                <span className="text-sm font-normal text-gray-500"> cm²/month</span>
              </p>
              <p className="text-xs text-gray-500 mt-0.5">
                {growth.fractionPerMonth! > 0 ? '+' : ''}{growth.fractionPerMonth}% of current size
                a month · {growth.n} measurements over {growth.spanDays} days
              </p>
              <p className="text-xs text-gray-600 mt-1.5">
                {growth.baselineAreaCm2} → {growth.currentAreaCm2} cm²
                {growth.totalChangePct != null && (
                  <span className={growth.totalChangePct > 0 ? ' text-red-700' : ' text-green-700'}>
                    {' '}({growth.totalChangePct > 0 ? '+' : ''}{growth.totalChangePct}%)
                  </span>
                )}
              </p>
              {acceleration.ok && acceleration.meaningful && (
                <p className={`text-xs font-medium mt-1.5 ${
                  acceleration.accelerating ? 'text-red-700' : 'text-green-700'
                }`}>
                  {acceleration.accelerating
                    ? 'Growth is accelerating'
                    : 'Growth is slowing'}
                </p>
              )}
            </>
          ) : (
            <p className="text-sm text-gray-500">{growth.reason}</p>
          )}
        </section>

        {/* Activity — what decides whether steroid will work. */}
        <section className="rounded-xl border bg-white p-3.5">
          <h4 className="text-sm font-semibold text-gray-800 flex items-center gap-1.5 mb-2">
            <Flame className="w-4 h-4 text-gray-400" /> Activity
          </h4>
          {activity.status === 'not_assessed' ? (
            <div className="flex items-start gap-2 text-sm text-gray-500">
              <HelpCircle className="w-4 h-4 mt-0.5 shrink-0" />
              <span>{activity.summary}</span>
            </div>
          ) : (
            <>
              <p className={`text-lg font-bold capitalize ${
                activity.status === 'active' ? 'text-amber-700'
                  : activity.status === 'partially_active' ? 'text-amber-600' : 'text-green-700'
              }`}>
                {activity.status.replace('_', ' ')}
              </p>
              <p className="text-xs text-gray-600 mt-0.5">{activity.summary}</p>
              <ul className="flex flex-wrap gap-1.5 mt-2">
                {activity.signals.map((s) => (
                  <li key={s.name}
                      className={`px-2 py-0.5 rounded-full text-[11px] capitalize ${
                        s.active ? 'bg-amber-100 text-amber-800' : 'bg-gray-100 text-gray-500'
                      }`}>
                    {s.name}
                  </li>
                ))}
              </ul>
              {activity.absent.length > 0 && (
                <p className="text-[11px] text-gray-400 mt-1.5">
                  Not recorded: {activity.absent.join(', ')}
                </p>
              )}
            </>
          )}
        </section>
      </div>

      {/* Response across the injection series. */}
      <section className="rounded-xl border bg-white p-3.5">
        <h4 className="text-sm font-semibold text-gray-800 flex items-center gap-1.5 mb-2">
          <Syringe className="w-4 h-4 text-gray-400" /> Response to treatment
        </h4>
        {tr.ok ? (
          <>
            <p className={`text-lg font-bold ${RESPONSE_LABEL[tr.response!]?.cls ?? 'text-gray-700'}`}>
              {RESPONSE_LABEL[tr.response!]?.text ?? tr.response}
            </p>
            <p className="text-sm text-gray-600 mt-0.5">
              {tr.beforeAreaCm2} → {tr.afterAreaCm2} cm²{' '}
              ({tr.changePct! > 0 ? '+' : ''}{tr.changePct}%) across{' '}
              {tr.injectionsInInterval} injection{tr.injectionsInInterval === 1 ? '' : 's'}
              {' '}over {tr.intervalDays} days.
            </p>
            {/* Association, not causation — keloids also change on their own. */}
            <p className="flex items-start gap-1.5 text-[11px] text-gray-500 mt-1.5">
              <Info className="w-3.5 h-3.5 mt-0.5 shrink-0" /> {tr.caveat}
            </p>
          </>
        ) : (
          <p className="text-sm text-gray-500">{tr.reason}</p>
        )}
      </section>
    </div>
  );
}

export default KeloidStatusPanel;

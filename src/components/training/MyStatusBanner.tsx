/**
 * Where the signed-in learner stands, shown the moment they arrive.
 *
 * A trainee used to have to open Medical Training and read a participation
 * tracker to discover they were short of sign-out; a student had no way of
 * seeing a score at all. Both now see it on their dashboard as soon as they
 * log in — the overall figure, what each part contributed, what is still
 * outstanding, and how much of the rotation is left.
 *
 * One component for both, because /api/my-status returns one shape for both.
 */

import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  TrendingUp, AlertTriangle, CheckCircle, Clock, ChevronRight,
  Loader2, CalendarDays,
} from 'lucide-react';
import { myStatusService, type MyStatus } from '../../services/myStatusService';

/** Human names for the scoring components. */
const COMPONENT_LABEL: Record<string, string> = {
  clinical: 'Clinical documentation',
  cbt: 'CBT tests',
  cme: 'CME reading',
  selfAssessment: 'Self-assessment',
  duties: 'Duties',
  attendance: 'Attendance',
};

export function MyStatusBanner({ compact = false }: { compact?: boolean }) {
  const [status, setStatus] = useState<MyStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    myStatusService.mine()
      .then((s) => { if (!cancelled) setStatus(s); })
      .catch(() => { if (!cancelled) setFailed(true); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  if (loading) {
    return (
      <div className="bg-white border rounded-xl p-4 flex items-center gap-3 text-gray-500 text-sm">
        <Loader2 className="w-4 h-4 animate-spin" /> Loading your progress…
      </div>
    );
  }

  // A dashboard that cannot reach the server is still a usable dashboard.
  if (failed || !status) return null;

  const { overall, passThreshold, eligible, rotation } = status;
  const signedOut = rotation?.status === 'signed_out';
  const tone = signedOut ? 'slate' : eligible ? 'green' : overall >= passThreshold * 0.6 ? 'amber' : 'red';

  const bar = {
    green: 'bg-green-500', amber: 'bg-amber-500', red: 'bg-red-500', slate: 'bg-slate-400',
  }[tone];
  const chip = {
    green: 'bg-green-100 text-green-800', amber: 'bg-amber-100 text-amber-800',
    red: 'bg-red-100 text-red-800', slate: 'bg-slate-100 text-slate-700',
  }[tone];

  return (
    <div className="bg-white border rounded-xl overflow-hidden">
      <div className="p-4 sm:p-5">
        <div className="flex items-start justify-between gap-4 mb-3">
          <div className="min-w-0">
            <h2 className="font-semibold text-gray-900 flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-gray-500 shrink-0" />
              Your progress
            </h2>
            {status.name && (
              <p className="text-xs text-gray-500 mt-0.5 truncate">
                {status.name} · {status.level.replace(/_/g, ' ')}
              </p>
            )}
          </div>
          <span className={`shrink-0 px-2.5 py-1 rounded-full text-xs font-semibold ${chip}`}>
            {signedOut ? 'Signed out' : eligible ? 'Ready to sign out' : 'In progress'}
          </span>
        </div>

        {/* The headline number */}
        <div className="flex items-end gap-2 mb-1">
          <span className="text-3xl font-bold text-gray-900 tabular-nums">{overall}%</span>
          <span className="text-sm text-gray-500 mb-1">of {passThreshold}% needed</span>
        </div>
        <div className="h-2 bg-gray-100 rounded-full overflow-hidden mb-1">
          <div className={`h-full ${bar} transition-all duration-700`} style={{ width: `${Math.min(100, overall)}%` }} />
        </div>
        {/* Where the threshold sits, so the bar can be read at a glance. */}
        <div className="relative h-3 mb-4">
          <div className="absolute top-0 -translate-x-1/2 text-[10px] text-gray-400"
               style={{ left: `${passThreshold}%` }}>
            ▲ {passThreshold}%
          </div>
        </div>

        {/* Rotation timing */}
        {rotation && !signedOut && (
          <div className="flex items-center gap-2 text-xs text-gray-600 mb-4">
            <CalendarDays className="w-3.5 h-3.5 shrink-0" />
            {rotation.overdue ? (
              <span className="text-amber-700 font-medium">
                Your rotation ended {Math.abs(rotation.daysRemaining ?? 0)} day
                {Math.abs(rotation.daysRemaining ?? 0) === 1 ? '' : 's'} ago
                {status.awaitingDecision ? ' — awaiting a decision' : ''}
              </span>
            ) : (
              <span>
                <strong>{rotation.daysRemaining}</strong> day{rotation.daysRemaining === 1 ? '' : 's'} left
                {rotation.totalDays ? ` of ${rotation.totalDays}` : ''}
                {rotation.extensionCount > 0 && ` · extended ${rotation.extensionCount}×`}
              </span>
            )}
          </div>
        )}

        {signedOut && (
          <div className="flex items-start gap-2 bg-slate-50 border border-slate-200 rounded-lg p-3 text-sm text-slate-700 mb-4">
            <CheckCircle className="w-4 h-4 mt-0.5 shrink-0 text-slate-500" />
            <div>
              <p className="font-medium">
                Rotation complete{rotation?.finalScore != null ? ` at ${rotation.finalScore}%` : ''}.
              </p>
              {rotation?.signOutComments && (
                <p className="text-xs text-slate-500 mt-0.5">{rotation.signOutComments}</p>
              )}
            </div>
          </div>
        )}

        {/* What is still outstanding */}
        {!signedOut && status.notMet.length > 0 && (
          <div className="mb-3">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5 flex items-center gap-1.5">
              <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />
              Still outstanding
            </p>
            <ul className="space-y-1">
              {status.notMet.slice(0, compact ? 3 : 6).map((item) => (
                <li key={item} className="text-sm text-gray-700 flex items-start gap-2">
                  <span className="mt-1.5 w-1 h-1 rounded-full bg-amber-500 shrink-0" />
                  {item}
                </li>
              ))}
              {status.notMet.length > (compact ? 3 : 6) && (
                <li className="text-xs text-gray-400">
                  …and {status.notMet.length - (compact ? 3 : 6)} more
                </li>
              )}
            </ul>
          </div>
        )}

        {!signedOut && eligible && (
          <div className="flex items-center gap-2 bg-green-50 border border-green-200 rounded-lg p-3 text-sm text-green-800 mb-3">
            <CheckCircle className="w-4 h-4 shrink-0" />
            You have met every requirement. You will be signed out automatically when the rotation ends.
          </div>
        )}

        {/* Where effort pays most */}
        {!compact && !signedOut && status.focusOn && (
          <p className="text-xs text-gray-500 flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5 shrink-0" />
            Most marks still available in <strong>{COMPONENT_LABEL[status.focusOn] ?? status.focusOn}</strong>.
          </p>
        )}
      </div>

      {/* Component breakdown */}
      {!compact && (
        <div className="border-t bg-gray-50 px-4 sm:px-5 py-3">
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-2">
            {status.contributions.map((c) => (
              <div key={c.key} className="min-w-0">
                <div className="flex items-baseline justify-between gap-2">
                  <span className="text-xs text-gray-500 truncate">
                    {COMPONENT_LABEL[c.key] ?? c.key}
                  </span>
                  <span className="text-xs font-semibold text-gray-800 tabular-nums shrink-0">
                    {Math.round(c.score)}%
                  </span>
                </div>
                <div className="h-1 bg-gray-200 rounded-full overflow-hidden mt-1">
                  <div className="h-full bg-navy-500" style={{ width: `${Math.min(100, c.score)}%` }} />
                </div>
                <span className="text-[10px] text-gray-400">
                  {c.contribution.toFixed(1)} of {c.available.toFixed(0)} marks
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      <Link
        to="/training"
        className="flex items-center justify-between px-4 sm:px-5 py-3 border-t text-sm font-medium text-navy-700 hover:bg-gray-50"
      >
        Open training
        <ChevronRight className="w-4 h-4" />
      </Link>
    </div>
  );
}

export default MyStatusBanner;

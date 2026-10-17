/** Dashboard banner: catch-up reading / CBT owed for registering late, until done. */
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { BookOpen } from 'lucide-react';
import { postingOnboardingService, type CatchUp } from '../../services/postingOnboardingService';

export function CatchUpBanner() {
  const [c, setC] = useState<CatchUp | null>(null);
  useEffect(() => {
    let live = true;
    postingOnboardingService.status().then(s => { if (live) setC(s?.catchUp && !s.catchUp.complete ? s.catchUp : null); }).catch(() => {});
    return () => { live = false; };
  }, []);
  if (!c) return null;
  const overdue = c.due < new Date().toISOString().slice(0, 10);
  const pct = (d: number, r: number) => (r ? Math.round((d / r) * 100) : 100);
  return (
    <div className={`rounded-xl border p-3 mb-4 ${overdue ? 'border-red-300 bg-red-50' : 'border-amber-300 bg-amber-50'}`}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className={`text-sm font-semibold flex items-center gap-1.5 ${overdue ? 'text-red-800' : 'text-amber-900'}`}>
          <BookOpen className="w-4 h-4" /> Catch-up {overdue ? 'overdue' : 'due'} {new Date(`${c.due}T00:00:00`).toLocaleDateString()} — you registered {c.daysLate} day{c.daysLate === 1 ? '' : 's'} into your posting
        </p>
        <Link to="/training" className="text-xs px-3 py-1.5 rounded-lg bg-green-600 text-white">Open CME &amp; CBT</Link>
      </div>
      <div className="mt-2 grid sm:grid-cols-2 gap-2 text-xs">
        {[['CME articles read', c.articles], ['Missed CBTs completed', c.cbt]].filter(([, v]) => (v as any).required > 0).map(([label, v]: any) => (
          <div key={label}>
            <div className="flex justify-between"><span>{label}</span><span>{v.done}/{v.required}</span></div>
            <div className="h-1.5 rounded-full bg-white overflow-hidden"><div className="h-full bg-green-500" style={{ width: `${pct(v.done, v.required)}%` }} /></div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default CatchUpBanner;

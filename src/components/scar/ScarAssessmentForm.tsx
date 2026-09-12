/**
 * One visit: the scales, the examination, and what the patient says.
 *
 * The scale items are fetched from the server rather than written out here.
 * A second copy of VSS in the client would eventually disagree with the one
 * the scorer uses, and a VSS scored against the wrong anchors is not a VSS.
 *
 * Items are grouped by who has to supply them, because that is how the work is
 * actually divided: the clinician fills the examination items with the patient
 * in front of them, and the patient's own answers are asked, not inferred. An
 * item's source tag is shown so nobody records a guess in a box that needs a
 * hand on the scar.
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Loader2, Save, CheckCircle2, AlertTriangle, ClipboardList, Hand, User, Camera,
} from 'lucide-react';
import {
  scarService, type ScaleDefinition, type ScaleItem,
} from '../../services/scarService';

const PLIABILITY = ['normal', 'supple', 'yielding', 'firm', 'banding', 'contracture'];
const CONSISTENCY = ['soft', 'rubbery', 'firm', 'hard'];
const MOBILITY = ['freely mobile', 'mildly restricted', 'moderately restricted', 'fixed/adherent'];
const SEVERITY = ['none', 'mild', 'moderate', 'severe'];
const COMPRESSIBILITY = ['compressible', 'partially compressible', 'non-compressible'];

const SOURCE_META: Record<ScaleItem['source'], { icon: React.ReactNode; label: string }> = {
  image: { icon: <Camera className="w-3 h-3" />, label: 'from the photograph' },
  exam: { icon: <Hand className="w-3 h-3" />, label: 'requires examination' },
  patient: { icon: <User className="w-3 h-3" />, label: 'patient-reported' },
};

interface Props {
  assessmentId: number;
  onSaved?: () => void;
  className?: string;
}

export function ScarAssessmentForm({ assessmentId, onSaved, className = '' }: Props) {
  const [scales, setScales] = useState<Record<string, ScaleDefinition>>({});
  const [loading, setLoading] = useState(true);
  const [answers, setAnswers] = useState<Record<string, Record<string, number | ''>>>({});
  const [exam, setExam] = useState<Record<string, string | boolean | number | ''>>({});
  const [pro, setPro] = useState<Record<string, number | ''>>({});
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState<string[]>([]);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    scarService.scales()
      .then((r) => { if (!cancelled) setScales(r.scales); })
      .catch(() => { if (!cancelled) setError('Could not load the scale definitions.'); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  const setItem = useCallback((scale: string, key: string, value: number | '') => {
    setAnswers((a) => ({ ...a, [scale]: { ...(a[scale] || {}), [key]: value } }));
  }, []);

  /** How complete each scale is, so the clinician sees what is still missing. */
  const completeness = useMemo(() => {
    const out: Record<string, { done: number; total: number }> = {};
    for (const [key, def] of Object.entries(scales)) {
      const given = answers[key] || {};
      out[key] = {
        done: def.items.filter((i) => given[i.key] !== undefined && given[i.key] !== '').length,
        total: def.items.length,
      };
    }
    return out;
  }, [scales, answers]);

  const save = async () => {
    setSaving(true);
    setError('');
    const done: string[] = [];
    try {
      for (const [key, given] of Object.entries(answers)) {
        if (!Object.keys(given).length) continue;
        await scarService.putScores({ assessmentId, scale: key, items: given });
        done.push(scales[key]?.name || key);
      }
      if (Object.keys(exam).length) {
        await scarService.putExam({ assessmentId, ...exam } as never);
        done.push('Physical examination');
      }
      if (Object.keys(pro).length) {
        await scarService.putPatientReported({ assessmentId, ...pro } as never);
        done.push('Patient-reported outcomes');
      }
      setSaved(done);
      onSaved?.();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save this assessment.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className={`flex items-center gap-2 text-sm text-gray-500 p-4 ${className}`}>
        <Loader2 className="w-4 h-4 animate-spin" /> Loading the assessment forms…
      </div>
    );
  }

  return (
    <div className={`space-y-5 ${className}`}>
      {/* The validated scales, each on its own, never merged. */}
      {Object.entries(scales).map(([key, def]) => {
        const c = completeness[key];
        return (
          <section key={key} className="border rounded-xl overflow-hidden">
            <header className="px-4 py-2.5 bg-gray-50 border-b flex flex-wrap items-center justify-between gap-2">
              <h4 className="text-sm font-semibold text-gray-800 flex items-center gap-2">
                <ClipboardList className="w-4 h-4 text-gray-400" /> {def.name}
              </h4>
              <span className={`text-xs font-medium ${
                c.done === c.total ? 'text-green-700' : 'text-amber-700'
              }`}>
                {c.done}/{c.total} answered
                {c.done > 0 && c.done < c.total && ' — total withheld until complete'}
              </span>
            </header>

            <div className="p-4 space-y-3">
              {def.items.map((item) => (
                <ScaleItemField
                  key={item.key}
                  item={item}
                  value={answers[key]?.[item.key] ?? ''}
                  onChange={(v) => setItem(key, item.key, v)}
                />
              ))}
              {def.overall && (
                <div className="pt-2 border-t">
                  <ScaleItemField
                    item={def.overall}
                    value={answers[key]?.overall ?? ''}
                    onChange={(v) => setItem(key, 'overall', v)}
                    hint="Recorded separately — not part of the six-item total."
                  />
                </div>
              )}
            </div>
          </section>
        );
      })}

      {/* What photography cannot establish. */}
      <section className="border rounded-xl overflow-hidden">
        <header className="px-4 py-2.5 bg-gray-50 border-b">
          <h4 className="text-sm font-semibold text-gray-800 flex items-center gap-2">
            <Hand className="w-4 h-4 text-gray-400" /> Physical examination
          </h4>
        </header>
        <div className="p-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Select label="Pliability" options={PLIABILITY} value={exam.pliability as string}
                  onChange={(v) => setExam((e) => ({ ...e, pliability: v }))} />
          <Select label="Consistency" options={CONSISTENCY} value={exam.consistency as string}
                  onChange={(v) => setExam((e) => ({ ...e, consistency: v }))} />
          <Select label="Mobility" options={MOBILITY} value={exam.mobility as string}
                  onChange={(v) => setExam((e) => ({ ...e, mobility: v }))} />
          <Select label="Tenderness" options={SEVERITY} value={exam.tenderness as string}
                  onChange={(v) => setExam((e) => ({ ...e, tenderness: v }))} />
          <Select label="Compressibility" options={COMPRESSIBILITY} value={exam.compressibility as string}
                  onChange={(v) => setExam((e) => ({ ...e, compressibility: v }))} />
          <Select label="Adherence" options={SEVERITY} value={exam.adherence as string}
                  onChange={(v) => setExam((e) => ({ ...e, adherence: v }))} />

          <label className="flex items-center gap-2 text-sm text-gray-700 sm:col-span-2">
            <input
              type="checkbox"
              checked={!!exam.contracturePresent}
              onChange={(e) => setExam((x) => ({ ...x, contracturePresent: e.target.checked }))}
              className="rounded"
            />
            Contracture present
          </label>

          {!!exam.contracturePresent && (
            <>
              <Text label="Joint involved" value={exam.jointInvolved as string}
                    onChange={(v) => setExam((e) => ({ ...e, jointInvolved: v }))} />
              <NumberField label="Range-of-motion deficit (°)" value={exam.romDeficitDegrees as number | ''}
                      min={0} max={180}
                      onChange={(v) => setExam((e) => ({ ...e, romDeficitDegrees: v }))} />
            </>
          )}
        </div>
      </section>

      {/* What only the patient can report. */}
      <section className="border rounded-xl overflow-hidden">
        <header className="px-4 py-2.5 bg-gray-50 border-b">
          <h4 className="text-sm font-semibold text-gray-800 flex items-center gap-2">
            <User className="w-4 h-4 text-gray-400" /> Patient-reported outcomes
          </h4>
        </header>
        <div className="p-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
          {([
            ['pain', 'Pain'], ['itch', 'Itch'], ['tightness', 'Tightness'],
            ['tenderness', 'Tenderness'], ['functionalLimitation', 'Functional limitation'],
            ['cosmeticConcern', 'Cosmetic concern'],
          ] as [string, string][]).map(([k, label]) => (
            <NumberField key={k} label={`${label} (0–10)`} min={0} max={10}
                    value={pro[k] ?? ''} onChange={(v) => setPro((p) => ({ ...p, [k]: v }))} />
          ))}
        </div>
      </section>

      {error && (
        <div role="alert" className="flex items-start gap-2 p-3 rounded-xl bg-red-50 border border-red-200 text-sm text-red-800">
          <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" /> {error}
        </div>
      )}

      {saved.length > 0 && (
        <div className="flex items-start gap-2 p-3 rounded-xl bg-green-50 border border-green-200 text-sm text-green-900">
          <CheckCircle2 className="w-4 h-4 mt-0.5 shrink-0" />
          Saved: {saved.join(', ')}.
        </div>
      )}

      <button
        onClick={() => void save()}
        disabled={saving}
        className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-purple-600 text-white font-semibold hover:bg-purple-700 disabled:opacity-60"
      >
        {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
        {saving ? 'Saving…' : 'Save this assessment'}
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------

function ScaleItemField({ item, value, onChange, hint }: {
  item: ScaleItem; value: number | ''; onChange: (v: number | '') => void; hint?: string;
}) {
  const meta = SOURCE_META[item.source];
  const points = Array.from({ length: item.max - item.min + 1 }, (_, i) => item.min + i);
  // Two anchors on a 1-10 item describe its ends; one per point describes each.
  const perPoint = item.anchors.length === points.length;

  return (
    <div>
      <div className="flex flex-wrap items-baseline justify-between gap-2 mb-1">
        <label className="text-sm font-medium text-gray-800">{item.label}</label>
        <span className="flex items-center gap-1 text-[11px] text-gray-500">
          {meta.icon} {meta.label}
        </span>
      </div>

      {perPoint ? (
        <select
          value={value}
          onChange={(e) => onChange(e.target.value === '' ? '' : Number(e.target.value))}
          className="w-full px-3 py-2 border rounded-lg text-sm bg-white focus:ring-2 focus:ring-purple-500 focus:outline-none"
        >
          <option value="">Not answered</option>
          {points.map((p, i) => (
            <option key={p} value={p}>{p} — {item.anchors[i]}</option>
          ))}
        </select>
      ) : (
        <div>
          <div className="flex flex-wrap gap-1">
            {points.map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => onChange(value === p ? '' : p)}
                aria-pressed={value === p}
                className={`w-8 h-8 rounded-lg text-xs font-medium border ${
                  value === p ? 'bg-purple-600 text-white border-purple-600' : 'bg-white text-gray-700'
                }`}
              >
                {p}
              </button>
            ))}
          </div>
          <div className="flex justify-between text-[11px] text-gray-400 mt-0.5">
            <span>{item.min} — {item.anchors[0]}</span>
            <span>{item.max} — {item.anchors[1]}</span>
          </div>
        </div>
      )}

      {hint && <p className="text-[11px] text-gray-500 mt-1">{hint}</p>}
    </div>
  );
}

function Select({ label, options, value, onChange }: {
  label: string; options: string[]; value?: string; onChange: (v: string) => void;
}) {
  return (
    <label className="block">
      <span className="text-xs font-medium text-gray-600">{label}</span>
      <select
        value={value ?? ''} onChange={(e) => onChange(e.target.value)}
        className="mt-1 w-full px-3 py-2 border rounded-lg text-sm bg-white capitalize focus:ring-2 focus:ring-purple-500 focus:outline-none"
      >
        <option value="">Not recorded</option>
        {options.map((o) => <option key={o} value={o}>{o}</option>)}
      </select>
    </label>
  );
}

function Text({ label, value, onChange }: {
  label: string; value?: string; onChange: (v: string) => void;
}) {
  return (
    <label className="block">
      <span className="text-xs font-medium text-gray-600">{label}</span>
      <input
        value={value ?? ''} onChange={(e) => onChange(e.target.value)}
        className="mt-1 w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-purple-500 focus:outline-none"
      />
    </label>
  );
}

function NumberField({ label, value, onChange, min, max }: {
  label: string; value: number | ''; onChange: (v: number | '') => void; min?: number; max?: number;
}) {
  return (
    <label className="block">
      <span className="text-xs font-medium text-gray-600">{label}</span>
      <input
        type="number" min={min} max={max} value={value}
        onChange={(e) => onChange(e.target.value === '' ? '' : Number(e.target.value))}
        className="mt-1 w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-purple-500 focus:outline-none"
      />
    </label>
  );
}

export default ScarAssessmentForm;

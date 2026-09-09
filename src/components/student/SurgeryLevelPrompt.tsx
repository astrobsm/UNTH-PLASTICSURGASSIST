/**
 * Which surgery posting am I on?
 *
 * Asked because the answer selects everything else: the CME articles, the
 * self-assessment questions and the CBT pool are all scoped to a rotation
 * category, and without a level there is no way to choose between them. The app
 * could guess from the dates, and a Surgery 1 student would silently be handed
 * the Surgery 4 curriculum with nothing to tell them it was wrong.
 *
 * Asked again at the start of each posting rather than once forever, because
 * students rotate and the answer changes. It can be dismissed for the session —
 * somebody who logged in to check a patient should not be held at a door — but
 * it returns, and the learning module cannot be used without an answer.
 */

import { useState, useEffect } from 'react';
import { GraduationCap, Loader2, AlertCircle, X, ArrowRight } from 'lucide-react';
import { learningContentService, type SurgeryLevelOption } from '../../services/learningContentService';

interface Props {
  /** Shown when the level is already known, to change it. */
  currentLevel?: string | null;
  onSet: (level: string) => void;
  /** Absent when the prompt is compulsory. */
  onDismiss?: () => void;
}

export function SurgeryLevelPrompt({ currentLevel, onSet, onDismiss }: Props) {
  const [options, setOptions] = useState<SurgeryLevelOption[]>([]);
  const [choice, setChoice] = useState(currentLevel ?? '');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    learningContentService.catalogue()
      .then((c) => {
        if (cancelled) return;
        // The options come back with the "needs a level" response; when a level
        // is already set they are not sent, so a sensible list is used instead.
        setOptions(c.options ?? FALLBACK_LEVELS);
      })
      .catch(() => { if (!cancelled) setOptions(FALLBACK_LEVELS); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  const submit = async () => {
    if (!choice) return;
    setSaving(true);
    setError('');
    try {
      await learningContentService.setSurgeryLevel(choice);
      onSet(choice);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save your posting.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-black/50 flex items-start sm:items-center justify-center p-4 overflow-y-auto"
      role="dialog" aria-modal="true" aria-label="Choose your surgery posting"
    >
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md my-8 sm:my-0">
        <header className="flex items-start justify-between gap-3 px-5 py-4 border-b">
          <div className="flex items-start gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-green-100 flex items-center justify-center shrink-0">
              <GraduationCap className="w-5 h-5 text-green-700" />
            </div>
            <div className="min-w-0">
              <h2 className="font-semibold text-gray-900">
                {currentLevel ? 'Change your posting' : 'Which posting are you on?'}
              </h2>
              <p className="text-xs text-gray-500 mt-0.5">
                This decides which articles, self-assessments and CBT you are given.
              </p>
            </div>
          </div>
          {onDismiss && (
            <button onClick={onDismiss} className="p-1 rounded hover:bg-gray-100 shrink-0" aria-label="Not now">
              <X className="w-5 h-5 text-gray-400" />
            </button>
          )}
        </header>

        <div className="p-5">
          {loading ? (
            <div className="flex items-center gap-2 text-sm text-gray-500 py-6">
              <Loader2 className="w-4 h-4 animate-spin" /> Loading the postings…
            </div>
          ) : (
            <div className="space-y-2">
              {options.map((o) => (
                <button
                  key={o.value}
                  onClick={() => setChoice(o.value)}
                  aria-pressed={choice === o.value}
                  className={`w-full text-left p-3 rounded-xl border-2 transition-colors ${
                    choice === o.value
                      ? 'border-green-500 bg-green-50'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <span className="block font-medium text-gray-900">{o.label}</span>
                  {o.description && (
                    <span className="block text-xs text-gray-500 mt-0.5 line-clamp-2">{o.description}</span>
                  )}
                  {o.weeks ? (
                    <span className="block text-[11px] text-gray-400 mt-1">{o.weeks} weeks</span>
                  ) : null}
                </button>
              ))}
            </div>
          )}

          {error && (
            <div role="alert" className="flex items-start gap-2 mt-3 text-xs text-red-700 bg-red-50 border border-red-200 rounded-lg p-2">
              <AlertCircle className="w-3.5 h-3.5 mt-0.5 shrink-0" /> {error}
            </div>
          )}

          <button
            onClick={submit}
            disabled={!choice || saving || loading}
            className="mt-4 w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-green-600 text-white font-medium hover:bg-green-700 disabled:opacity-60"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <ArrowRight className="w-4 h-4" />}
            {saving ? 'Saving…' : 'Continue'}
          </button>

          <p className="text-[11px] text-gray-400 text-center mt-2">
            You can change this whenever you move to a new posting.
          </p>
        </div>
      </div>
    </div>
  );
}

/** Used when the server did not send the list — the four postings are fixed. */
const FALLBACK_LEVELS: SurgeryLevelOption[] = [
  { value: 'surgery_1', label: 'Surgery 1' },
  { value: 'surgery_2', label: 'Surgery 2' },
  { value: 'surgery_3', label: 'Surgery 3' },
  { value: 'surgery_4', label: 'Surgery 4' },
];

export default SurgeryLevelPrompt;

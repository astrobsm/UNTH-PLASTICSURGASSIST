/**
 * A computer-based test drawn from the imported question bank.
 *
 * The bank holds thousands of questions per level, so a paper is a random
 * sample of it rather than a fixed set — sitting the same test twice does not
 * mean seeing the same questions. The answers are marked on the server: the
 * questions arrive without the key, and the first the candidate sees of it is
 * their result.
 *
 * Laid out one question to a screen. The stems are clinical vignettes that run
 * to a paragraph or more, and a list of them on one page put the options of one
 * question against the stem of the next; several were unreadable on a phone.
 * Here the stem keeps its own line breaks, the options wrap instead of being
 * clipped, and nothing overlaps anything else at any width.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import {
  ArrowLeft, ArrowRight, Loader2, AlertCircle, Clock, CheckCircle2,
  XCircle, Flag, RotateCcw, ListChecks,
} from 'lucide-react';
import {
  learningContentService,
  type TestQuestion,
  type TestResult,
} from '../../services/learningContentService';

interface Props {
  onBack: () => void;
  /** How many questions to draw. Twenty-five is a sitting of about 30 minutes. */
  count?: number;
  /** Restrict the draw to one topic. */
  topicId?: string;
  topicName?: string;
  /** Told the result, so a dashboard can refresh its score without a reload. */
  onFinished?: (result: TestResult) => void;
}

const OPTION_KEYS = ['A', 'B', 'C', 'D', 'E'] as const;
type OptionKey = typeof OPTION_KEYS[number];

/** Roughly 72 seconds a question, the pace of the fellowship papers. */
const SECONDS_PER_QUESTION = 72;

function mmss(totalSeconds: number) {
  const s = Math.max(0, Math.round(totalSeconds));
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
}

export function PoolTestRunner({ onBack, count = 25, topicId, topicName, onFinished }: Props) {
  const [questions, setQuestions] = useState<TestQuestion[]>([]);
  const [answers, setAnswers] = useState<Record<string, OptionKey>>({});
  const [flagged, setFlagged] = useState<Set<string>>(new Set());
  const [index, setIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<TestResult | null>(null);
  const [showPalette, setShowPalette] = useState(false);
  const [remaining, setRemaining] = useState(0);

  const startedAt = useRef<string>(new Date().toISOString());
  const startedMs = useRef<number>(Date.now());

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const r = await learningContentService.questions(count, topicId);
      if (!r.questions.length) {
        setError('There are no questions at your level yet. Tell your administrator.');
      }
      setQuestions(r.questions);
      setAnswers({});
      setFlagged(new Set());
      setIndex(0);
      setResult(null);
      startedAt.current = new Date().toISOString();
      startedMs.current = Date.now();
      setRemaining(r.questions.length * SECONDS_PER_QUESTION);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load the questions.');
    } finally {
      setLoading(false);
    }
  }, [count, topicId]);

  useEffect(() => { void load(); }, [load]);

  const submit = useCallback(async (auto = false) => {
    if (submitting || result) return;
    if (!auto) {
      const unanswered = questions.length - Object.keys(answers).length;
      if (unanswered > 0 && !window.confirm(
        `${unanswered} question${unanswered === 1 ? '' : 's'} left unanswered. Submit anyway?`,
      )) return;
    }
    setSubmitting(true);
    setError('');
    try {
      const r = await learningContentService.submitTest({
        answers,
        startedAt: startedAt.current,
        durationSeconds: Math.round((Date.now() - startedMs.current) / 1000),
      });
      setResult(r);
      onFinished?.(r);
      window.scrollTo({ top: 0 });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not submit your answers.');
    } finally {
      setSubmitting(false);
    }
  }, [answers, questions.length, submitting, result, onFinished]);

  // The clock. It stops the paper rather than merely nagging, because a timed
  // test that runs on indefinitely is not a timed test.
  useEffect(() => {
    if (loading || result || !questions.length) return;
    const t = window.setInterval(() => {
      setRemaining((s) => {
        if (s <= 1) {
          window.clearInterval(t);
          void submit(true);
          return 0;
        }
        return s - 1;
      });
    }, 1000);
    return () => window.clearInterval(t);
  }, [loading, result, questions.length, submit]);

  // ---- loading and failure ------------------------------------------------

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
        <div className="flex items-center gap-3 text-gray-500">
          <Loader2 className="w-5 h-5 animate-spin" /> Drawing your questions…
        </div>
      </div>
    );
  }

  if (error && !questions.length) {
    return (
      <div className="min-h-screen bg-gray-50 p-6">
        <button onClick={onBack} className="flex items-center gap-2 text-gray-600 mb-6 hover:text-gray-900">
          <ArrowLeft className="w-4 h-4" /> Back
        </button>
        <div className="max-w-lg mx-auto bg-white border rounded-2xl p-6 text-center">
          <AlertCircle className="w-8 h-8 text-amber-500 mx-auto mb-3" />
          <p className="text-gray-800">{error}</p>
          <button onClick={() => void load()} className="mt-4 px-4 py-2 rounded-lg bg-green-600 text-white text-sm font-medium">
            Try again
          </button>
        </div>
      </div>
    );
  }

  // ---- the result ---------------------------------------------------------

  if (result) return <TestReview result={result} onBack={onBack} onRetake={() => void load()} />;

  // ---- the paper ----------------------------------------------------------

  const q = questions[index];
  const answered = Object.keys(answers).length;
  const low = remaining <= 120;

  return (
    <div className="min-h-screen bg-gray-50 pb-28">
      {/* Kept in view so the clock and the count are never scrolled away. */}
      <header className="sticky top-0 z-20 bg-white border-b">
        <div className="max-w-3xl mx-auto px-4 py-3 flex items-center gap-3">
          <button onClick={onBack} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500" aria-label="Leave the test">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-gray-900 truncate">
              {topicName ? `${topicName} — test` : 'Computer-based test'}
            </p>
            <p className="text-xs text-gray-500">
              Question {index + 1} of {questions.length} · {answered} answered
            </p>
          </div>
          <span
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-sm font-medium tabular-nums ${
              low ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-700'
            }`}
            role="timer"
            aria-live={low ? 'polite' : 'off'}
          >
            <Clock className="w-4 h-4" /> {mmss(remaining)}
          </span>
          <button
            onClick={() => setShowPalette((v) => !v)}
            className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500"
            aria-label="All questions"
            aria-expanded={showPalette}
          >
            <ListChecks className="w-5 h-5" />
          </button>
        </div>
        <div className="h-1 bg-gray-100">
          <div
            className="h-full bg-green-500 transition-all"
            style={{ width: `${(answered / questions.length) * 100}%` }}
          />
        </div>
      </header>

      {/* Every question at a glance, and a way to jump to one. */}
      {showPalette && (
        <div className="max-w-3xl mx-auto px-4 pt-4">
          <div className="bg-white border rounded-xl p-3">
            <div className="grid grid-cols-8 sm:grid-cols-10 gap-1.5">
              {questions.map((item, i) => {
                const done = !!answers[item.id];
                const isFlagged = flagged.has(item.id);
                return (
                  <button
                    key={item.id}
                    onClick={() => { setIndex(i); setShowPalette(false); }}
                    className={`aspect-square rounded-lg text-xs font-medium border-2 ${
                      i === index ? 'border-green-600' : 'border-transparent'
                    } ${
                      isFlagged ? 'bg-amber-100 text-amber-800'
                        : done ? 'bg-green-100 text-green-800'
                              : 'bg-gray-100 text-gray-500'
                    }`}
                    aria-label={`Question ${i + 1}${done ? ', answered' : ''}${isFlagged ? ', flagged' : ''}`}
                  >
                    {i + 1}
                  </button>
                );
              })}
            </div>
            <p className="text-[11px] text-gray-400 mt-2">
              Green: answered · Amber: flagged for review · Grey: not yet answered
            </p>
          </div>
        </div>
      )}

      <main className="max-w-3xl mx-auto px-4 py-5">
        <article className="bg-white border rounded-2xl overflow-hidden">
          <div className="px-5 sm:px-6 py-4 border-b bg-gray-50 flex items-center justify-between gap-3">
            <span className="text-xs font-medium text-gray-500 truncate">
              {q.topic || 'General'}{q.difficulty ? ` · ${q.difficulty}` : ''}
            </span>
            <button
              onClick={() => setFlagged((f) => {
                const next = new Set(f);
                if (next.has(q.id)) next.delete(q.id); else next.add(q.id);
                return next;
              })}
              className={`flex items-center gap-1.5 text-xs px-2 py-1 rounded-lg shrink-0 ${
                flagged.has(q.id) ? 'bg-amber-100 text-amber-800' : 'text-gray-500 hover:bg-gray-100'
              }`}
              aria-pressed={flagged.has(q.id)}
            >
              <Flag className="w-3.5 h-3.5" /> {flagged.has(q.id) ? 'Flagged' : 'Flag'}
            </button>
          </div>

          {/* The stem. whitespace-pre-wrap because the vignettes carry their own
              paragraphing, and break-words because some carry long drug names
              and figures that would otherwise push the card sideways. */}
          <div className="px-5 sm:px-6 py-5">
            <p className="text-[15px] sm:text-base leading-7 text-gray-900 whitespace-pre-wrap break-words">
              {q.question}
            </p>
          </div>

          {/* The options, each its own block so a long one wraps under itself
              and never runs into the letter or the next option. */}
          <fieldset className="px-4 sm:px-6 pb-5 space-y-2.5">
            <legend className="sr-only">Choose one answer</legend>
            {OPTION_KEYS.map((k) => {
              const text = q.options[k as keyof typeof q.options];
              if (!text) return null;
              const chosen = answers[q.id] === k;
              return (
                <label
                  key={k}
                  className={`flex items-start gap-3 p-3 sm:p-3.5 rounded-xl border-2 cursor-pointer transition-colors ${
                    chosen ? 'border-green-500 bg-green-50' : 'border-gray-200 hover:border-gray-300 bg-white'
                  }`}
                >
                  <input
                    type="radio"
                    name={q.id}
                    checked={chosen}
                    onChange={() => setAnswers((a) => ({ ...a, [q.id]: k }))}
                    className="sr-only"
                  />
                  <span className={`w-7 h-7 shrink-0 rounded-lg flex items-center justify-center text-sm font-semibold ${
                    chosen ? 'bg-green-600 text-white' : 'bg-gray-100 text-gray-600'
                  }`}>
                    {k}
                  </span>
                  <span className="text-sm sm:text-[15px] leading-6 text-gray-800 whitespace-pre-wrap break-words min-w-0">
                    {text}
                  </span>
                </label>
              );
            })}
          </fieldset>
        </article>

        {error && (
          <div role="alert" className="flex items-start gap-2 mt-4 text-sm text-red-700 bg-red-50 border border-red-200 rounded-xl p-3">
            <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" /> {error}
          </div>
        )}
      </main>

      {/* Fixed, so moving between questions never needs a scroll. The main
          region is padded by the same amount, so nothing sits underneath it. */}
      <nav className="fixed bottom-0 inset-x-0 bg-white border-t z-20">
        <div className="max-w-3xl mx-auto px-4 py-3 flex items-center gap-3">
          <button
            onClick={() => setIndex((i) => Math.max(0, i - 1))}
            disabled={index === 0}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl border text-sm font-medium text-gray-700 disabled:opacity-40"
          >
            <ArrowLeft className="w-4 h-4" /> Previous
          </button>

          {index === questions.length - 1 ? (
            <button
              onClick={() => void submit()}
              disabled={submitting}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-green-600 text-white text-sm font-semibold hover:bg-green-700 disabled:opacity-60"
            >
              {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
              {submitting ? 'Marking…' : 'Submit for marking'}
            </button>
          ) : (
            <button
              onClick={() => setIndex((i) => Math.min(questions.length - 1, i + 1))}
              className="flex-1 flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl bg-gray-900 text-white text-sm font-semibold"
            >
              Next <ArrowRight className="w-4 h-4" />
            </button>
          )}
        </div>
      </nav>
    </div>
  );
}

// ---------------------------------------------------------------------------

/**
 * What they got, and why.
 *
 * The explanation matters more than the mark: a test that only says 62% has
 * taught nobody anything. Every question is shown back with the answer given,
 * the correct one, and the bank's explanation of it.
 */
function TestReview({ result, onBack, onRetake }: {
  result: TestResult; onBack: () => void; onRetake: () => void;
}) {
  const [filter, setFilter] = useState<'all' | 'wrong'>('wrong');
  const wrong = result.marked.filter((m) => !m.isCorrect);
  const shown = filter === 'wrong' ? wrong : result.marked;

  return (
    <div className="min-h-screen bg-gray-50 pb-10">
      <header className={`${result.passed ? 'bg-green-600' : 'bg-gray-800'} text-white`}>
        <div className="max-w-3xl mx-auto px-4 py-6">
          <button onClick={onBack} className="flex items-center gap-2 text-white/80 hover:text-white text-sm mb-4">
            <ArrowLeft className="w-4 h-4" /> Back to the library
          </button>
          <p className="text-sm text-white/80">Your result</p>
          <p className="text-4xl font-bold tabular-nums">{result.score}%</p>
          <p className="text-sm text-white/90 mt-1">
            {result.correct} of {result.total} correct ·{' '}
            {result.passed ? 'pass' : `below the ${result.passMark}% pass mark`}
          </p>
        </div>
      </header>

      <div className="max-w-3xl mx-auto px-4 py-5">
        <div className="flex items-center gap-2 mb-4">
          <button
            onClick={() => setFilter('wrong')}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium ${
              filter === 'wrong' ? 'bg-gray-900 text-white' : 'bg-white border text-gray-700'
            }`}
          >
            Got wrong ({wrong.length})
          </button>
          <button
            onClick={() => setFilter('all')}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium ${
              filter === 'all' ? 'bg-gray-900 text-white' : 'bg-white border text-gray-700'
            }`}
          >
            All ({result.marked.length})
          </button>
          <button
            onClick={onRetake}
            className="ml-auto flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium bg-white border text-gray-700"
          >
            <RotateCcw className="w-3.5 h-3.5" /> New test
          </button>
        </div>

        {shown.length === 0 ? (
          <div className="bg-white border rounded-2xl p-8 text-center">
            <CheckCircle2 className="w-8 h-8 text-green-600 mx-auto mb-2" />
            <p className="text-gray-800 font-medium">Every question correct.</p>
          </div>
        ) : (
          <ol className="space-y-4">
            {shown.map((m, i) => (
              <li key={m.id} className="bg-white border rounded-2xl overflow-hidden">
                <div className="px-5 py-3 border-b bg-gray-50 flex items-center gap-2">
                  {m.isCorrect
                    ? <CheckCircle2 className="w-4 h-4 text-green-600 shrink-0" />
                    : <XCircle className="w-4 h-4 text-red-500 shrink-0" />}
                  <span className="text-xs font-medium text-gray-500 truncate">
                    {i + 1}. {m.topic || 'General'}
                  </span>
                </div>

                <div className="px-5 py-4">
                  <p className="text-[15px] leading-7 text-gray-900 whitespace-pre-wrap break-words">
                    {m.question}
                  </p>

                  <ul className="mt-3 space-y-1.5">
                    {OPTION_KEYS.map((k) => {
                      const text = m.options[k as keyof typeof m.options];
                      if (!text) return null;
                      const isKey = m.correctOption === k;
                      const isGiven = m.given === k;
                      return (
                        <li
                          key={k}
                          className={`flex items-start gap-2.5 p-2.5 rounded-lg text-sm border ${
                            isKey ? 'border-green-300 bg-green-50'
                              : isGiven ? 'border-red-300 bg-red-50'
                                        : 'border-transparent'
                          }`}
                        >
                          <span className="w-6 h-6 shrink-0 rounded-md bg-white border flex items-center justify-center text-xs font-semibold text-gray-600">
                            {k}
                          </span>
                          <span className="leading-6 text-gray-800 whitespace-pre-wrap break-words min-w-0">
                            {text}
                          </span>
                          {isKey && <span className="ml-auto text-[11px] text-green-700 font-medium shrink-0">correct</span>}
                          {isGiven && !isKey && <span className="ml-auto text-[11px] text-red-600 font-medium shrink-0">your answer</span>}
                        </li>
                      );
                    })}
                  </ul>

                  {!m.given && (
                    <p className="mt-2 text-xs text-amber-700">You did not answer this one.</p>
                  )}

                  <div className="mt-3 p-3 rounded-xl bg-blue-50 border border-blue-100">
                    <p className="text-xs font-semibold text-blue-800 mb-1">Explanation</p>
                    <p className="text-sm leading-6 text-blue-900 whitespace-pre-wrap break-words">
                      {m.explanation}
                    </p>
                  </div>
                </div>
              </li>
            ))}
          </ol>
        )}
      </div>
    </div>
  );
}

export default PoolTestRunner;

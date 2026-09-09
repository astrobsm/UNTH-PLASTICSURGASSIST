/**
 * The reading list and question bank for whoever is signed in.
 *
 * This is the front of the CHAMBER import — 257 CME articles and 8,963
 * questions, each scoped to a rotation category — and the first thing in the
 * app that reads any of it. A student on Surgery 2 and a house officer open the
 * same component and are handed different material, because the server resolves
 * the level and this asks for "mine" rather than for a level by name.
 *
 * Articles open in the existing CME viewer rather than a second reader of their
 * own: it already tracks time per section, keeps the self-assessment locked
 * until the sections have actually been open, and reports the sitting to the
 * server. Two readers would have meant two definitions of having read
 * something, and the score depends on that definition.
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  BookOpen, Loader2, Search, CheckCircle2, Circle, Clock, GraduationCap,
  ClipboardCheck, AlertCircle, RefreshCw, ArrowRight, Award,
} from 'lucide-react';
import {
  learningContentService,
  type LearningCatalogue,
  type LearningArticle,
} from '../../services/learningContentService';
import type { CMETopic } from '../../services/medicalTrainingService';
import CMEArticleViewer from '../training/CMEArticleViewer';
import { PoolTestRunner } from './PoolTestRunner';
import { SurgeryLevelPrompt } from '../student/SurgeryLevelPrompt';

type Filter = 'all' | 'todo' | 'done';

const LEVEL_LABELS: Record<string, string> = {
  surgery_1: 'Surgery 1',
  surgery_2: 'Surgery 2',
  surgery_3: 'Surgery 3',
  surgery_4: 'Surgery 4',
  house_officer: 'House Officer',
  junior_resident: 'Junior Resident',
  senior_resident: 'Senior Resident',
  registrar: 'Registrar',
  senior_registrar: 'Senior Registrar',
};

function levelLabel(level?: string) {
  if (!level) return '';
  return LEVEL_LABELS[level] || level.replace(/_/g, ' ');
}

export function LearningLibrary({ className = '' }: { className?: string }) {
  const [catalogue, setCatalogue] = useState<LearningCatalogue | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<Filter>('all');

  const [openTopic, setOpenTopic] = useState<CMETopic | null>(null);
  const [openingId, setOpeningId] = useState<string | null>(null);
  const [testing, setTesting] = useState(false);
  const [choosingLevel, setChoosingLevel] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      setCatalogue(await learningContentService.catalogue());
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load your material.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const open = useCallback(async (article: LearningArticle) => {
    setOpeningId(article.id);
    setError('');
    try {
      const full = await learningContentService.article(article.id);
      setOpenTopic(full.article);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not open that article.');
    } finally {
      setOpeningId(null);
    }
  }, []);

  const articles = catalogue?.articles ?? [];

  const shown = useMemo(() => {
    const q = search.trim().toLowerCase();
    return articles.filter((a) => {
      if (filter === 'done' && !a.is_fully_completed) return false;
      if (filter === 'todo' && a.is_fully_completed) return false;
      if (!q) return true;
      return [a.title, a.subtitle, a.abstract, a.topic, a.category]
        .some((f) => (f || '').toLowerCase().includes(q));
    });
  }, [articles, search, filter, ]);

  const doneCount = articles.filter((a) => a.is_fully_completed).length;

  // ---- the article reader -------------------------------------------------

  if (openTopic) {
    return (
      <CMEArticleViewer
        topic={openTopic}
        articleId={String(openTopic.id)}
        isCompleted={!!articles.find((a) => a.id === openTopic.id)?.is_fully_completed}
        onBack={() => { setOpenTopic(null); void load(); }}
        // Reading and marking are both recorded server-side by the viewer's own
        // session, so there is nothing to save here — only a list to refresh.
        onComplete={() => { void load(); }}
        onSelfAssessment={() => { void load(); }}
      />
    );
  }

  if (testing) {
    return (
      <PoolTestRunner
        onBack={() => { setTesting(false); void load(); }}
        onFinished={() => { void load(); }}
      />
    );
  }

  // ---- loading, and the two ways there is nothing to show -----------------

  if (loading) {
    return (
      <div className={`bg-white border rounded-xl p-6 flex items-center gap-3 text-gray-500 ${className}`}>
        <Loader2 className="w-5 h-5 animate-spin" /> Loading your material…
      </div>
    );
  }

  if (catalogue && !catalogue.levelKnown) {
    return (
      <div className={className}>
        <div className="bg-white border rounded-2xl p-6 text-center">
          <GraduationCap className="w-8 h-8 text-green-600 mx-auto mb-3" />
          <p className="font-semibold text-gray-900">Which posting are you on?</p>
          <p className="text-sm text-gray-500 mt-1 max-w-sm mx-auto">
            {catalogue.message
              || 'Your articles, self-assessments and tests are chosen by your posting.'}
          </p>
          <button
            onClick={() => setChoosingLevel(true)}
            className="mt-4 px-4 py-2 rounded-xl bg-green-600 text-white text-sm font-semibold hover:bg-green-700"
          >
            Choose your posting
          </button>
        </div>
        {choosingLevel && (
          <SurgeryLevelPrompt
            onDismiss={() => setChoosingLevel(false)}
            onSet={() => { setChoosingLevel(false); void load(); }}
          />
        )}
      </div>
    );
  }

  if (error && !catalogue) {
    return (
      <div className={`bg-white border rounded-xl p-6 ${className}`}>
        <div className="flex items-start gap-2 text-sm text-red-700">
          <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" /> {error}
        </div>
        <button onClick={() => void load()} className="mt-3 px-3 py-1.5 rounded-lg border text-sm font-medium text-gray-700">
          Try again
        </button>
      </div>
    );
  }

  const totals = catalogue?.totals;

  return (
    <div className={className}>
      {/* What this learner has been given, and how much of it is left. */}
      <section className="bg-gradient-to-r from-green-600 to-green-700 text-white rounded-2xl p-5 mb-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-green-100 text-xs uppercase tracking-wide">Your curriculum</p>
            <h2 className="text-lg sm:text-xl font-bold truncate">
              {levelLabel(catalogue?.level)}
            </h2>
            <p className="text-green-100 text-sm mt-0.5 truncate">
              {catalogue?.categories?.map((c) => c.name).join(' · ') || 'No categories mapped'}
            </p>
          </div>
          <button
            onClick={() => void load()}
            className="p-2 rounded-lg bg-white/10 hover:bg-white/20 shrink-0"
            aria-label="Reload"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>

        <div className="grid grid-cols-3 gap-2 mt-4">
          <div className="bg-white/10 rounded-xl p-3">
            <p className="text-green-100 text-[11px]">Articles read</p>
            <p className="text-lg font-bold tabular-nums">
              {doneCount}<span className="text-green-200 text-sm">/{totals?.articles ?? articles.length}</span>
            </p>
          </div>
          <div className="bg-white/10 rounded-xl p-3">
            <p className="text-green-100 text-[11px]">Self-assessments</p>
            <p className="text-lg font-bold tabular-nums">{totals?.selfAssessments ?? 0}</p>
          </div>
          <div className="bg-white/10 rounded-xl p-3">
            <p className="text-green-100 text-[11px]">Questions in bank</p>
            <p className="text-lg font-bold tabular-nums">{totals?.questions ?? 0}</p>
          </div>
        </div>

        {(totals?.questions ?? 0) > 0 && (
          <button
            onClick={() => setTesting(true)}
            className="mt-4 w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-white text-green-700 font-semibold text-sm hover:bg-green-50"
          >
            <ClipboardCheck className="w-4 h-4" /> Sit a 25-question test
            <ArrowRight className="w-4 h-4" />
          </button>
        )}
      </section>

      {/* What is required of this level, where the server says. */}
      {catalogue?.requirements && (
        <div className="flex flex-wrap gap-1.5 mb-4">
          {Object.entries(catalogue.requirements).map(([k, v]) => (
            <span key={k} className="px-2.5 py-1 rounded-full bg-gray-100 text-gray-600 text-[11px]">
              {k.replace(/([A-Z])/g, ' $1').replace(/^./, (c) => c.toUpperCase())}: {v}
            </span>
          ))}
        </div>
      )}

      {/* Finding one article among a hundred. */}
      <div className="flex flex-col sm:flex-row gap-2 mb-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search the articles…"
            aria-label="Search the articles"
            className="w-full pl-9 pr-3 py-2.5 rounded-xl border text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
          />
        </div>
        <div className="flex gap-1.5 shrink-0">
          {([['all', 'All'], ['todo', 'To read'], ['done', 'Read']] as [Filter, string][]).map(([k, label]) => (
            <button
              key={k}
              onClick={() => setFilter(k)}
              className={`px-3 py-2 rounded-xl text-sm font-medium ${
                filter === k ? 'bg-gray-900 text-white' : 'bg-white border text-gray-700'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {error && (
        <div role="alert" className="flex items-start gap-2 mb-4 text-sm text-red-700 bg-red-50 border border-red-200 rounded-xl p-3">
          <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" /> {error}
        </div>
      )}

      {shown.length === 0 ? (
        <div className="bg-white border rounded-2xl p-8 text-center">
          <BookOpen className="w-8 h-8 text-gray-300 mx-auto mb-2" />
          <p className="text-gray-600 text-sm">
            {articles.length === 0
              ? 'No articles have been mapped to your level yet.'
              : 'Nothing matches that.'}
          </p>
        </div>
      ) : (
        <ul className="space-y-2.5">
          {shown.map((a) => (
            <li key={a.id}>
              <button
                onClick={() => void open(a)}
                disabled={openingId === a.id}
                className="w-full text-left bg-white border rounded-2xl p-4 hover:border-green-400 transition-colors disabled:opacity-60"
              >
                <div className="flex items-start gap-3">
                  <span className="mt-0.5 shrink-0">
                    {a.is_fully_completed
                      ? <CheckCircle2 className="w-5 h-5 text-green-600" />
                      : a.reading_completed
                        ? <ClipboardCheck className="w-5 h-5 text-amber-500" />
                        : <Circle className="w-5 h-5 text-gray-300" />}
                  </span>

                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-gray-900 leading-snug break-words">{a.title}</p>
                    {a.subtitle && (
                      <p className="text-sm text-gray-500 mt-0.5 break-words">{a.subtitle}</p>
                    )}

                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-2 text-[11px] text-gray-500">
                      {a.topic && <span className="truncate max-w-[12rem]">{a.topic}</span>}
                      {a.estimated_reading_minutes ? (
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3" /> {a.estimated_reading_minutes} min
                        </span>
                      ) : null}
                      {a.question_count > 0 && (
                        <span className="flex items-center gap-1">
                          <ClipboardCheck className="w-3 h-3" /> {a.question_count} MCQs
                        </span>
                      )}
                      {a.cme_credits ? (
                        <span className="flex items-center gap-1">
                          <Award className="w-3 h-3" /> {a.cme_credits} credit{Number(a.cme_credits) === 1 ? '' : 's'}
                        </span>
                      ) : null}
                    </div>

                    {/* Where they got to, said plainly rather than as a bar with
                        no number against it. */}
                    {!a.is_fully_completed && (a.reading_progress_percent || 0) > 0 && (
                      <p className="text-[11px] text-amber-700 mt-1.5">
                        {a.reading_completed
                          ? 'Read — the self-assessment is still to do'
                          : `${Math.round(Number(a.reading_progress_percent))}% read`}
                      </p>
                    )}
                    {a.is_fully_completed && a.assessment_score != null && (
                      <p className="text-[11px] text-green-700 mt-1.5">
                        Completed · self-assessment {Math.round(Number(a.assessment_score))}%
                      </p>
                    )}
                  </div>

                  {openingId === a.id
                    ? <Loader2 className="w-4 h-4 animate-spin text-gray-400 shrink-0 mt-1" />
                    : <ArrowRight className="w-4 h-4 text-gray-300 shrink-0 mt-1" />}
                </div>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default LearningLibrary;

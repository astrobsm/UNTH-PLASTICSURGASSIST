import React, { useState, useEffect, useRef, useCallback } from 'react';
import { 
  ArrowLeft, 
  BookOpen, 
  CheckCircle, 
  Target, 
  Lightbulb, 
  AlertTriangle,
  Award,
  ClipboardCheck,
  ChevronDown,
  ChevronUp,
  BookMarked,
  GraduationCap,
  Eye,
  Clock,
  Shield,
  Lock
} from 'lucide-react';
import { CMETopic, MCQQuestion } from '../../services/medicalTrainingService';

interface CMEArticleViewerProps {
  topic: CMETopic;
  onBack: () => void;
  onComplete: () => void;
  isCompleted: boolean;
  /** Called when the trainee submits the self-assessment, with their score. */
  onSelfAssessment?: (result: { topicId: string; correct: number; total: number }) => void;
}

type TabType = 'article' | 'keypoints' | 'mcq';

// Anti-fraud: minimum seconds per section (based on avg reading speed ~200 wpm)
const MIN_SECTION_READ_TIME_SECONDS = 30; // 30s minimum per section
const MIN_TOTAL_READ_TIME_SECONDS = 120; // 2 min minimum total reading time
const SCROLL_FRAUD_THRESHOLD_MS = 3000; // If user scrolls to bottom in <3s = fraud

interface SectionReadProgress {
  sectionIndex: number;
  openedAt: number; // timestamp
  timeSpentMs: number;
  visited: boolean;
  sufficientlyRead: boolean; // spent enough time
}

const CMEArticleViewer: React.FC<CMEArticleViewerProps> = ({
  topic,
  onBack,
  onComplete,
  isCompleted,
  onSelfAssessment
}) => {
  const [activeTab, setActiveTab] = useState<TabType>('article');
  const [expandedSections, setExpandedSections] = useState<Set<number>>(new Set([0]));
  const [mcqAnswers, setMcqAnswers] = useState<Map<string, number>>(new Map());
  const [showResults, setShowResults] = useState(false);

  // ── Anti-fraud reading tracking state ──
  const [sectionProgress, setSectionProgress] = useState<SectionReadProgress[]>([]);
  const [readingStartTime] = useState<number>(Date.now());
  const [totalReadTimeMs, setTotalReadTimeMs] = useState(0);
  const [fraudDetected, setFraudDetected] = useState(false);
  const [fraudMessage, setFraudMessage] = useState('');
  const [articleFullyRead, setArticleFullyRead] = useState(false);
  const [readingLocked, setReadingLocked] = useState(false);
  const lastScrollTime = useRef<number>(Date.now());
  const scrollStartY = useRef<number>(0);
  const articleContainerRef = useRef<HTMLDivElement>(null);
  const readTimeInterval = useRef<ReturnType<typeof setInterval> | null>(null);

  const { article } = topic;

  // Initialize section tracking
  useEffect(() => {
    if (article.sections) {
      setSectionProgress(
        article.sections.map((_, i) => ({
          sectionIndex: i,
          openedAt: i === 0 ? Date.now() : 0,
          timeSpentMs: 0,
          visited: i === 0, // first section starts open
          sufficientlyRead: false,
        }))
      );
    }
  }, [topic.id]);

  // Track total reading time
  useEffect(() => {
    readTimeInterval.current = setInterval(() => {
      if (activeTab === 'article') {
        setTotalReadTimeMs(Date.now() - readingStartTime);
      }
    }, 1000);
    return () => {
      if (readTimeInterval.current) clearInterval(readTimeInterval.current);
    };
  }, [readingStartTime, activeTab]);

  // Update section time tracking when sections expand/collapse
  useEffect(() => {
    setSectionProgress(prev => prev.map(sp => {
      if (expandedSections.has(sp.sectionIndex) && !sp.visited) {
        return { ...sp, visited: true, openedAt: Date.now() };
      }
      // Accumulate time for currently open sections
      if (expandedSections.has(sp.sectionIndex) && sp.openedAt > 0) {
        const elapsed = Date.now() - sp.openedAt;
        const newTime = sp.timeSpentMs + elapsed;
        return {
          ...sp,
          openedAt: Date.now(),
          timeSpentMs: newTime,
          sufficientlyRead: newTime >= MIN_SECTION_READ_TIME_SECONDS * 1000,
        };
      }
      return sp;
    }));
  }, [expandedSections]);

  // Check article completion status
  useEffect(() => {
    if (!article.sections || article.sections.length === 0) {
      setArticleFullyRead(true);
      return;
    }
    const allVisited = sectionProgress.every(sp => sp.visited);
    const allSufficientlyRead = sectionProgress.every(sp => sp.sufficientlyRead);
    const totalTimeOk = totalReadTimeMs >= MIN_TOTAL_READ_TIME_SECONDS * 1000;
    setArticleFullyRead(allVisited && allSufficientlyRead && totalTimeOk);
  }, [sectionProgress, totalReadTimeMs]);

  // Anti-fraud scroll detection
  const handleArticleScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    const el = e.currentTarget;
    const now = Date.now();
    const scrolledToBottom = el.scrollTop + el.clientHeight >= el.scrollHeight - 50;

    if (scrolledToBottom) {
      const timeSinceStart = now - readingStartTime;
      if (timeSinceStart < SCROLL_FRAUD_THRESHOLD_MS && !isCompleted) {
        setFraudDetected(true);
        setFraudMessage(
          'Rapid scrolling detected! You scrolled to the bottom in less than 3 seconds. ' +
          'Please read each section carefully. Your reading progress has been reset.'
        );
        // Reset progress
        setSectionProgress(prev => prev.map(sp => ({
          ...sp,
          timeSpentMs: 0,
          sufficientlyRead: false,
          visited: sp.sectionIndex === 0,
          openedAt: sp.sectionIndex === 0 ? Date.now() : 0,
        })));
        setExpandedSections(new Set([0]));
        // Log fraud attempt
        try {
          const token = localStorage.getItem('auth_token');
          if (token) {
            fetch('/api/training-progress', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
              body: JSON.stringify({
                topicId: topic.id,
                level: 'house_officer',
                fraudAttempt: true,
                fraudType: 'rapid_scroll',
                timestamp: new Date().toISOString(),
              }),
            }).catch(() => {});
          }
        } catch {}
      }
    }
  }, [readingStartTime, isCompleted, topic.id]);

  // Calculate reading stats for display
  const getReadingStats = () => {
    const totalSections = article.sections?.length || 0;
    const sectionsRead = sectionProgress.filter(sp => sp.sufficientlyRead).length;
    const sectionsVisited = sectionProgress.filter(sp => sp.visited).length;
    const totalMinutes = Math.floor(totalReadTimeMs / 60000);
    const totalSeconds = Math.floor((totalReadTimeMs % 60000) / 1000);
    const minTimeRemaining = Math.max(0, MIN_TOTAL_READ_TIME_SECONDS - Math.floor(totalReadTimeMs / 1000));
    return { totalSections, sectionsRead, sectionsVisited, totalMinutes, totalSeconds, minTimeRemaining };
  };

  const toggleSection = (index: number) => {
    // Flush accumulated time for currently-open section
    setSectionProgress(prev => prev.map(sp => {
      if (expandedSections.has(sp.sectionIndex) && sp.openedAt > 0) {
        const elapsed = Date.now() - sp.openedAt;
        const newTime = sp.timeSpentMs + elapsed;
        return {
          ...sp,
          openedAt: Date.now(),
          timeSpentMs: newTime,
          sufficientlyRead: newTime >= MIN_SECTION_READ_TIME_SECONDS * 1000,
        };
      }
      return sp;
    }));

    const newExpanded = new Set(expandedSections);
    if (newExpanded.has(index)) {
      newExpanded.delete(index);
    } else {
      newExpanded.add(index);
    }
    setExpandedSections(newExpanded);
  };

  const handleAnswerSelect = (questionId: string, answerIndex: number) => {
    if (showResults) return;
    setMcqAnswers(new Map(mcqAnswers.set(questionId, answerIndex)));
  };

  const handleSubmitMCQ = () => {
    setShowResults(true);
    // Record the self-assessment score (persisted + scored toward sign-out).
    const total = article.selfAssessment?.length || 0;
    const correct = article.selfAssessment?.filter(q => mcqAnswers.get(q.id) === q.correctAnswer).length || 0;
    if (total > 0 && onSelfAssessment) {
      onSelfAssessment({ topicId: String(topic.id), correct, total });
    }
    // Check if all answers are correct AND article was fully read
    const allCorrect = total > 0 && correct === total;
    if (allCorrect && !isCompleted && articleFullyRead) {
      onComplete();
    }
  };

  const resetMCQ = () => {
    setMcqAnswers(new Map());
    setShowResults(false);
  };

  const getScore = () => {
    if (!article.selfAssessment) return { correct: 0, total: 0 };
    const correct = article.selfAssessment.filter(q => 
      mcqAnswers.get(q.id) === q.correctAnswer
    ).length;
    return { correct, total: article.selfAssessment.length };
  };

  const tabs = [
    { id: 'article' as TabType, label: 'Article', icon: BookOpen },
    { id: 'keypoints' as TabType, label: 'Key Points', icon: Target },
    { id: 'mcq' as TabType, label: 'Self-Assessment', icon: ClipboardCheck, locked: !articleFullyRead && !isCompleted }
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Fraud Detection Alert */}
      {fraudDetected && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-start sm:items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-xl max-w-md w-full shadow-2xl my-4 sm:my-8 max-h-[calc(100vh-2rem)] flex flex-col">
            <div className="bg-red-600 p-4 text-white flex items-center gap-3 rounded-t-xl flex-shrink-0">
              <Shield className="h-6 w-6" />
              <h3 className="font-bold text-lg">Reading Integrity Alert</h3>
            </div>
            <div className="p-6 overflow-y-auto flex-1">
              <p className="text-gray-700 mb-4">{fraudMessage}</p>
              <p className="text-sm text-gray-500 mb-4">
                You must read each section for at least {MIN_SECTION_READ_TIME_SECONDS} seconds. 
                Your progress has been reset.
              </p>
              <button
                onClick={() => setFraudDetected(false)}
                className="w-full py-2 bg-red-600 text-white rounded-lg font-medium hover:bg-red-700"
              >
                I Understand — Resume Reading
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 py-4">
          <div className="flex items-center gap-4">
            <button
              onClick={onBack}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <ArrowLeft className="h-5 w-5 text-gray-600" />
            </button>
            <div className="flex-1">
              <h1 className="text-lg font-semibold text-gray-900 line-clamp-1">
                {article.title}
              </h1>
              <p className="text-sm text-gray-500">
                {article.sections?.length || 0} sections • {article.selfAssessment?.length || 0} MCQs
              </p>
            </div>
            {isCompleted && (
              <span className="flex items-center gap-1 text-green-600 text-sm font-medium">
                <CheckCircle className="h-4 w-4" />
                Completed
              </span>
            )}
          </div>
          
          {/* Tabs */}
          <div className="flex gap-2 mt-4">
            {tabs.map(tab => (
              <button
                key={tab.id}
                onClick={() => {
                  if ('locked' in tab && tab.locked) {
                    setFraudMessage('You must read all sections thoroughly before attempting the self-assessment. Each section requires at least ' + MIN_SECTION_READ_TIME_SECONDS + ' seconds of reading time.');
                    setFraudDetected(true);
                    return;
                  }
                  setActiveTab(tab.id);
                }}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors relative
                  ${activeTab === tab.id 
                    ? 'bg-green-500 text-white' 
                    : ('locked' in tab && tab.locked)
                      ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
              >
                {'locked' in tab && tab.locked ? <Lock className="h-4 w-4" /> : <tab.icon className="h-4 w-4" />}
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-6" ref={articleContainerRef} onScroll={handleArticleScroll}>
        {/* Article Tab */}
        {activeTab === 'article' && (
          <div className="space-y-6">
            {/* Reading Progress Tracker */}
            {!isCompleted && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <div className="flex items-center gap-2 mb-3">
                  <Eye className="h-5 w-5 text-blue-600" />
                  <h3 className="font-semibold text-blue-800 text-sm">Reading Progress Tracker</h3>
                  <span className="ml-auto text-xs text-blue-600 flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    {getReadingStats().totalMinutes}m {getReadingStats().totalSeconds}s
                  </span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs mb-3">
                  <div className="bg-white rounded px-2 py-1.5">
                    <span className="text-gray-500">Sections Visited</span>
                    <p className="font-bold text-blue-700">{getReadingStats().sectionsVisited}/{getReadingStats().totalSections}</p>
                  </div>
                  <div className="bg-white rounded px-2 py-1.5">
                    <span className="text-gray-500">Sections Read</span>
                    <p className="font-bold text-blue-700">{getReadingStats().sectionsRead}/{getReadingStats().totalSections}</p>
                  </div>
                  <div className="bg-white rounded px-2 py-1.5">
                    <span className="text-gray-500">Min Time Left</span>
                    <p className={`font-bold ${getReadingStats().minTimeRemaining > 0 ? 'text-amber-600' : 'text-green-600'}`}>
                      {getReadingStats().minTimeRemaining > 0 ? `${getReadingStats().minTimeRemaining}s` : 'Done'}
                    </p>
                  </div>
                  <div className="bg-white rounded px-2 py-1.5">
                    <span className="text-gray-500">MCQ Unlocked</span>
                    <p className={`font-bold ${articleFullyRead ? 'text-green-600' : 'text-red-600'}`}>
                      {articleFullyRead ? 'Yes ✓' : 'No ✗'}
                    </p>
                  </div>
                </div>
                {/* Section-by-section progress bars */}
                <div className="space-y-1">
                  {sectionProgress.map((sp, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <span className="text-xs text-gray-500 w-6 text-right">{i + 1}</span>
                      <div className="flex-1 bg-white rounded-full h-2">
                        <div
                          className={`h-2 rounded-full transition-all ${sp.sufficientlyRead ? 'bg-green-500' : sp.visited ? 'bg-amber-400' : 'bg-gray-200'}`}
                          style={{ width: `${Math.min(100, (sp.timeSpentMs / (MIN_SECTION_READ_TIME_SECONDS * 1000)) * 100)}%` }}
                        />
                      </div>
                      {sp.sufficientlyRead ? (
                        <CheckCircle className="h-3 w-3 text-green-500" />
                      ) : sp.visited ? (
                        <Clock className="h-3 w-3 text-amber-500" />
                      ) : (
                        <div className="h-3 w-3 rounded-full border border-gray-300" />
                      )}
                    </div>
                  ))}
                </div>
                <p className="text-xs text-blue-600 mt-2">
                  <Shield className="inline h-3 w-3 mr-1" />
                  Reading is monitored. Spend at least {MIN_SECTION_READ_TIME_SECONDS}s on each section to unlock the self-assessment.
                </p>
              </div>
            )}

            {/* Overview */}
            <div className="bg-green-50 border border-green-200 rounded-lg p-6">
              <h2 className="text-lg font-semibold text-green-800 mb-3">Overview</h2>
              <p className="text-green-700 leading-relaxed">{article.overview}</p>
            </div>

            {/* Learning Objectives */}
            <div className="bg-white rounded-lg shadow p-6">
              <div className="flex items-center gap-2 mb-4">
                <Target className="h-5 w-5 text-blue-500" />
                <h2 className="text-lg font-semibold text-gray-900">Learning Objectives</h2>
              </div>
              <ul className="space-y-2">
                {article.learningObjectives?.map((objective, index) => (
                  <li key={index} className="flex items-start gap-3">
                    <span className="bg-blue-100 text-blue-700 rounded-full w-6 h-6 flex items-center justify-center text-sm font-medium flex-shrink-0 mt-0.5">
                      {index + 1}
                    </span>
                    <span className="text-gray-700">{objective}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Sections */}
            {article.sections?.map((section, index) => (
              <div key={index} className="bg-white rounded-lg shadow overflow-hidden">
                <button
                  onClick={() => toggleSection(index)}
                  className="w-full flex items-center justify-between p-4 hover:bg-gray-50 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <span className={`rounded-lg w-8 h-8 flex items-center justify-center font-semibold text-white
                      ${sectionProgress[index]?.sufficientlyRead ? 'bg-green-500' : sectionProgress[index]?.visited ? 'bg-amber-500' : 'bg-gray-400'}`}>
                      {sectionProgress[index]?.sufficientlyRead ? '✓' : index + 1}
                    </span>
                    <h3 className="font-semibold text-gray-900 text-left">{section.title}</h3>
                  </div>
                  <div className="flex items-center gap-2">
                    {!isCompleted && sectionProgress[index] && (
                      <span className={`text-xs px-2 py-0.5 rounded-full ${
                        sectionProgress[index].sufficientlyRead
                          ? 'bg-green-100 text-green-700'
                          : sectionProgress[index].visited
                            ? 'bg-amber-100 text-amber-700'
                            : 'bg-gray-100 text-gray-500'
                      }`}>
                        {sectionProgress[index].sufficientlyRead
                          ? 'Read ✓'
                          : sectionProgress[index].visited
                            ? `${Math.floor(sectionProgress[index].timeSpentMs / 1000)}s / ${MIN_SECTION_READ_TIME_SECONDS}s`
                            : 'Not visited'}
                      </span>
                    )}
                    {expandedSections.has(index) ? (
                      <ChevronUp className="h-5 w-5 text-gray-400" />
                    ) : (
                      <ChevronDown className="h-5 w-5 text-gray-400" />
                    )}
                  </div>
                </button>
                
                {expandedSections.has(index) && (
                  <div className="px-4 pb-4 pt-0">
                    <div className="pl-11 border-l-2 border-green-200 ml-4">
                      <p className="text-gray-700 leading-relaxed mb-4">{section.content}</p>
                      
                      {section.subsections?.map((subsection, subIndex) => (
                        <div key={subIndex} className="mt-4 bg-gray-50 rounded-lg p-4">
                          <h4 className="font-medium text-gray-800 mb-2">{subsection.title}</h4>
                          <p className="text-gray-600 text-sm leading-relaxed">{subsection.content}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Key Points Tab */}
        {activeTab === 'keypoints' && (
          <div className="space-y-6">
            {/* Key Points */}
            <div className="bg-white rounded-lg shadow p-6">
              <div className="flex items-center gap-2 mb-4">
                <Target className="h-5 w-5 text-green-500" />
                <h2 className="text-lg font-semibold text-gray-900">Key Points</h2>
              </div>
              <ul className="space-y-3">
                {article.keyPoints?.map((point, index) => (
                  <li key={index} className="flex items-start gap-3">
                    <CheckCircle className="h-5 w-5 text-green-500 flex-shrink-0 mt-0.5" />
                    <span className="text-gray-700">{point}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Exam Tips */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
              <div className="flex items-center gap-2 mb-4">
                <GraduationCap className="h-5 w-5 text-blue-600" />
                <h2 className="text-lg font-semibold text-blue-800">Exam Tips</h2>
              </div>
              <ul className="space-y-3">
                {article.examTips?.map((tip, index) => (
                  <li key={index} className="flex items-start gap-3">
                    <Award className="h-5 w-5 text-blue-500 flex-shrink-0 mt-0.5" />
                    <span className="text-blue-700">{tip}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Clinical Pearls */}
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-6">
              <div className="flex items-center gap-2 mb-4">
                <Lightbulb className="h-5 w-5 text-amber-600" />
                <h2 className="text-lg font-semibold text-amber-800">Clinical Pearls</h2>
              </div>
              <ul className="space-y-3">
                {article.clinicalPearls?.map((pearl, index) => (
                  <li key={index} className="flex items-start gap-3">
                    <Lightbulb className="h-5 w-5 text-amber-500 flex-shrink-0 mt-0.5" />
                    <span className="text-amber-700">{pearl}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Common Mistakes */}
            <div className="bg-red-50 border border-red-200 rounded-lg p-6">
              <div className="flex items-center gap-2 mb-4">
                <AlertTriangle className="h-5 w-5 text-red-600" />
                <h2 className="text-lg font-semibold text-red-800">Common Mistakes to Avoid</h2>
              </div>
              <ul className="space-y-3">
                {article.commonMistakes?.map((mistake, index) => (
                  <li key={index} className="flex items-start gap-3">
                    <AlertTriangle className="h-5 w-5 text-red-500 flex-shrink-0 mt-0.5" />
                    <span className="text-red-700">{mistake}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* References */}
            <div className="bg-white rounded-lg shadow p-6">
              <div className="flex items-center gap-2 mb-4">
                <BookMarked className="h-5 w-5 text-gray-500" />
                <h2 className="text-lg font-semibold text-gray-900">References</h2>
              </div>
              <ol className="space-y-2 list-decimal list-inside">
                {article.references?.map((ref, index) => (
                  <li key={index} className="text-gray-600 text-sm">{ref}</li>
                ))}
              </ol>
            </div>
          </div>
        )}

        {/* MCQ Tab */}
        {activeTab === 'mcq' && (
          <div className="space-y-6">
            {/* Article not fully read warning */}
            {!articleFullyRead && !isCompleted && (
              <div className="bg-amber-50 border border-amber-300 rounded-lg p-4 flex items-start gap-3">
                <AlertTriangle className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-amber-800 font-medium">Article Not Fully Read</p>
                  <p className="text-amber-700 text-sm mt-1">
                    You need to read all sections for at least {MIN_SECTION_READ_TIME_SECONDS}s each and 
                    spend a minimum of {Math.floor(MIN_TOTAL_READ_TIME_SECONDS / 60)} minutes total. 
                    Even if you answer all MCQs correctly, your progress will not be saved until reading is verified.
                  </p>
                </div>
              </div>
            )}

            {/* Score Display */}
            {showResults && (
              <div className={`rounded-lg p-6 ${
                getScore().correct === getScore().total 
                  ? 'bg-green-100 border border-green-200' 
                  : 'bg-amber-100 border border-amber-200'
              }`}>
                <div className="text-center">
                  <p className={`text-xl sm:text-2xl lg:text-3xl font-bold ${
                    getScore().correct === getScore().total ? 'text-green-700' : 'text-amber-700'
                  }`}>
                    {getScore().correct} / {getScore().total}
                  </p>
                  <p className={`${
                    getScore().correct === getScore().total ? 'text-green-600' : 'text-amber-600'
                  }`}>
                    {getScore().correct === getScore().total 
                      ? (articleFullyRead || isCompleted ? 'Excellent! All correct — Topic marked complete!' : 'All correct, but you must read the article thoroughly first!')
                      : 'Review the explanations below'}
                  </p>
                  <button
                    onClick={resetMCQ}
                    className="mt-4 px-4 py-2 bg-white rounded-lg shadow text-gray-700 hover:bg-gray-50"
                  >
                    Try Again
                  </button>
                </div>
              </div>
            )}

            {/* Questions */}
            {article.selfAssessment?.map((question, qIndex) => (
              <div key={question.id} className="bg-white rounded-lg shadow p-6">
                <p className="font-medium text-gray-900 mb-4">
                  <span className="text-green-600 mr-2">Q{qIndex + 1}.</span>
                  {question.question}
                </p>
                
                <div className="space-y-2">
                  {question.options.map((option, oIndex) => {
                    const isSelected = mcqAnswers.get(question.id) === oIndex;
                    const isCorrect = question.correctAnswer === oIndex;
                    
                    let bgColor = 'bg-gray-50 hover:bg-gray-100';
                    let borderColor = 'border-gray-200';
                    let textColor = 'text-gray-700';
                    
                    if (showResults) {
                      if (isCorrect) {
                        bgColor = 'bg-green-50';
                        borderColor = 'border-green-500';
                        textColor = 'text-green-700';
                      } else if (isSelected && !isCorrect) {
                        bgColor = 'bg-red-50';
                        borderColor = 'border-red-500';
                        textColor = 'text-red-700';
                      }
                    } else if (isSelected) {
                      bgColor = 'bg-green-50';
                      borderColor = 'border-green-500';
                      textColor = 'text-green-700';
                    }
                    
                    return (
                      <button
                        key={oIndex}
                        onClick={() => handleAnswerSelect(question.id, oIndex)}
                        disabled={showResults}
                        className={`w-full text-left p-3 rounded-lg border-2 transition-colors
                          ${bgColor} ${borderColor} ${textColor}
                          ${!showResults && 'cursor-pointer'}`}
                      >
                        <div className="flex items-start gap-3">
                          <span className={`w-6 h-6 rounded-full border-2 flex items-center justify-center text-sm font-medium
                            ${isSelected ? 'border-green-500 bg-green-500 text-white' : 'border-gray-300'}`}
                          >
                            {String.fromCharCode(65 + oIndex)}
                          </span>
                          <span>{option}</span>
                        </div>
                      </button>
                    );
                  })}
                </div>
                
                {/* Explanation */}
                {showResults && (
                  <div className="mt-4 p-4 bg-blue-50 rounded-lg border border-blue-200">
                    <p className="text-sm font-medium text-blue-800 mb-1">Explanation:</p>
                    <p className="text-sm text-blue-700">{question.explanation}</p>
                  </div>
                )}
              </div>
            ))}

            {/* Submit Button */}
            {!showResults && article.selfAssessment && article.selfAssessment.length > 0 && (
              <button
                onClick={handleSubmitMCQ}
                disabled={mcqAnswers.size < (article.selfAssessment?.length || 0)}
                className="w-full py-3 bg-green-500 text-white rounded-lg font-medium hover:bg-green-600 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
              >
                Submit Answers ({mcqAnswers.size}/{article.selfAssessment?.length || 0} answered)
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default CMEArticleViewer;

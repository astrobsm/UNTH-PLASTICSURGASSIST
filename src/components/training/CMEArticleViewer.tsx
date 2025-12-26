import React, { useState } from 'react';
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
  GraduationCap
} from 'lucide-react';
import { CMETopic, MCQQuestion } from '../../services/medicalTrainingService';

interface CMEArticleViewerProps {
  topic: CMETopic;
  onBack: () => void;
  onComplete: () => void;
  isCompleted: boolean;
}

type TabType = 'article' | 'keypoints' | 'mcq';

const CMEArticleViewer: React.FC<CMEArticleViewerProps> = ({
  topic,
  onBack,
  onComplete,
  isCompleted
}) => {
  const [activeTab, setActiveTab] = useState<TabType>('article');
  const [expandedSections, setExpandedSections] = useState<Set<number>>(new Set([0]));
  const [mcqAnswers, setMcqAnswers] = useState<Map<string, number>>(new Map());
  const [showResults, setShowResults] = useState(false);

  const { article } = topic;

  const toggleSection = (index: number) => {
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
    // Check if all answers are correct
    const allCorrect = article.selfAssessment?.every(q => 
      mcqAnswers.get(q.id) === q.correctAnswer
    );
    if (allCorrect && !isCompleted) {
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
    { id: 'mcq' as TabType, label: 'Self-Assessment', icon: ClipboardCheck }
  ];

  return (
    <div className="min-h-screen bg-gray-50">
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
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors
                  ${activeTab === tab.id 
                    ? 'bg-green-500 text-white' 
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
              >
                <tab.icon className="h-4 w-4" />
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-6">
        {/* Article Tab */}
        {activeTab === 'article' && (
          <div className="space-y-6">
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
                    <span className="bg-green-500 text-white rounded-lg w-8 h-8 flex items-center justify-center font-semibold">
                      {index + 1}
                    </span>
                    <h3 className="font-semibold text-gray-900 text-left">{section.title}</h3>
                  </div>
                  {expandedSections.has(index) ? (
                    <ChevronUp className="h-5 w-5 text-gray-400" />
                  ) : (
                    <ChevronDown className="h-5 w-5 text-gray-400" />
                  )}
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
            {/* Score Display */}
            {showResults && (
              <div className={`rounded-lg p-6 ${
                getScore().correct === getScore().total 
                  ? 'bg-green-100 border border-green-200' 
                  : 'bg-amber-100 border border-amber-200'
              }`}>
                <div className="text-center">
                  <p className={`text-3xl font-bold ${
                    getScore().correct === getScore().total ? 'text-green-700' : 'text-amber-700'
                  }`}>
                    {getScore().correct} / {getScore().total}
                  </p>
                  <p className={`${
                    getScore().correct === getScore().total ? 'text-green-600' : 'text-amber-600'
                  }`}>
                    {getScore().correct === getScore().total 
                      ? 'Excellent! All correct!' 
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

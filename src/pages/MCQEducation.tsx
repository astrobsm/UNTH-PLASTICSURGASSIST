import React, { useState, useEffect, useRef } from 'react';
import { 
  BookOpen, 
  Brain, 
  Award, 
  Clock, 
  Target, 
  TrendingUp,
  Play,
  CheckCircle,
  XCircle,
  RotateCcw,
  Upload,
  Calendar,
  Download,
  Bell,
  AlertCircle,
  ArrowRight,
  ArrowLeft,
  FileText,
  BarChart,
  Lightbulb,
  Heart,
  Bookmark,
  Filter
} from 'lucide-react';
import { mcqGenerationService, ClinicalTopic, MCQTestSchedule, MCQTestSession, StudyMaterial } from '../services/mcqGenerationService';
import { cmeWACSService, CMEArticle, WACSCategory } from '../services/cmeWACSService';
import { useAuthStore } from '../store/authStore';
import CMEArticleViewer from '../components/CMEArticleViewer';

const MCQEducation: React.FC = () => {
  const { user } = useAuthStore();
  const [activeTab, setActiveTab] = useState<'topics' | 'tests' | 'active-test' | 'results' | 'history' | 'cme-articles'>('topics');
  
  // Topics management (Admin)
  const [topics, setTopics] = useState<ClinicalTopic[]>([]);
  const [uploadingTopic, setUploadingTopic] = useState(false);
  const [topicForm, setTopicForm] = useState({
    title: '',
    category: '',
    content: '',
    targetLevels: [] as ('house_officer' | 'junior_resident' | 'senior_resident')[]
  });

  // Test taking
  const [upcomingTests, setUpcomingTests] = useState<MCQTestSchedule[]>([]);
  const [currentSession, setCurrentSession] = useState<MCQTestSession | null>(null);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [timeRemaining, setTimeRemaining] = useState(600); // 10 minutes
  const [showExplanation, setShowExplanation] = useState(false);
  const [testCompleted, setTestCompleted] = useState(false);

  // Results and history
  const [testHistory, setTestHistory] = useState<MCQTestSession[]>([]);
  const [studyMaterials, setStudyMaterials] = useState<StudyMaterial | null>(null);

  // CME Articles
  const [cmeArticles, setCmeArticles] = useState<CMEArticle[]>([]);
  const [filteredArticles, setFilteredArticles] = useState<CMEArticle[]>([]);
  const [selectedArticle, setSelectedArticle] = useState<string | null>(null);
  const [categoryFilter, setCategoryFilter] = useState<WACSCategory | 'all'>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'unread' | 'completed'>('all');

  // Timer ref
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const userLevel = user?.role === 'intern' ? 'house_officer' : 
                    user?.role === 'registrar' ? 'junior_resident' : 'senior_resident';
  const isAdmin = user?.role === 'admin' || user?.role === 'consultant' || true; // Always show for demo

  useEffect(() => {
    console.log('MCQ Education - User:', user);
    console.log('MCQ Education - Is Admin:', isAdmin);
    loadData();
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  useEffect(() => {
    if (currentSession && !testCompleted) {
      startTimer();
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [currentSession, testCompleted]);

  // Filter CME articles when filters change
  useEffect(() => {
    let filtered = cmeArticles;

    // Filter by category
    if (categoryFilter !== 'all') {
      filtered = filtered.filter(article => article.category === categoryFilter);
    }

    setFilteredArticles(filtered);
  }, [categoryFilter, statusFilter, cmeArticles]);

  const loadData = async () => {
    try {
      const [upcomingData, historyData, articlesData] = await Promise.all([
        mcqGenerationService.getUpcomingTests(userLevel),
        mcqGenerationService.getUserTestHistory(user?.id || 'demo-user'),
        cmeWACSService.getAllArticles()
      ]);

      setUpcomingTests(upcomingData);
      setTestHistory(historyData);
      setCmeArticles(articlesData);
      setFilteredArticles(articlesData);
    } catch (error) {
      console.error('Error loading data:', error);
    }
  };

  const startTimer = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    
    timerRef.current = setInterval(() => {
      setTimeRemaining(prev => {
        if (prev <= 1) {
          handleTimeUp();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  const handleTimeUp = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    handleSubmitTest();
  };

  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const getTimerColor = (): string => {
    if (timeRemaining > 300) return 'text-green-600'; // > 5 min
    if (timeRemaining > 120) return 'text-yellow-600'; // > 2 min
    return 'text-red-600'; // < 2 min
  };

  // Admin: Upload clinical topic
  const handleUploadTopic = async () => {
    console.log('Upload button clicked!');
    console.log('Topic form data:', topicForm);
    
    if (!topicForm.title || !topicForm.content || topicForm.targetLevels.length === 0) {
      alert('Please fill all required fields');
      return;
    }

    try {
      setUploadingTopic(true);
      console.log('Starting MCQ generation...');
      await mcqGenerationService.uploadClinicalTopic(
        topicForm.title,
        topicForm.category,
        topicForm.content,
        topicForm.targetLevels,
        user?.id || 'admin'
      );

      alert('✅ Topic uploaded successfully! MCQs generated and test scheduled for next Tuesday 9 AM.');
      setTopicForm({ title: '', category: '', content: '', targetLevels: [] });
      await loadData();
    } catch (error) {
      console.error('Error uploading topic:', error);
      alert('Error uploading topic: ' + (error as Error).message);
    } finally {
      setUploadingTopic(false);
    }
  };

  // Start test
  const handleStartTest = async (schedule: MCQTestSchedule) => {
    try {
      const session = await mcqGenerationService.startMCQTest(
        user?.id || 'demo-user',
        userLevel,
        schedule.id
      );
      
      setCurrentSession(session);
      setCurrentQuestionIndex(0);
      setTimeRemaining(schedule.testDuration);
      setTestCompleted(false);
      setShowExplanation(false);
      setActiveTab('active-test');
    } catch (error) {
      console.error('Error starting test:', error);
      alert('Error starting test');
    }
  };

  // Submit answer
  const handleSelectAnswer = async (answerIndex: number) => {
    if (!currentSession) return;
    
    const currentQuestion = currentSession.questions[currentQuestionIndex];
    
    try {
      const result = await mcqGenerationService.submitAnswer(
        currentSession.id,
        currentQuestion.id,
        answerIndex
      );
      
      // Update local session
      currentSession.answers[currentQuestion.id] = answerIndex;
      setCurrentSession({ ...currentSession });
      
      // Show explanation immediately
      setShowExplanation(true);
    } catch (error) {
      console.error('Error submitting answer:', error);
    }
  };

  // Navigate questions
  const handleNextQuestion = () => {
    if (currentQuestionIndex < (currentSession?.questions.length || 0) - 1) {
      setCurrentQuestionIndex(prev => prev + 1);
      setShowExplanation(false);
    }
  };

  const handlePreviousQuestion = () => {
    if (currentQuestionIndex > 0) {
      setCurrentQuestionIndex(prev => prev - 1);
      setShowExplanation(false);
    }
  };

  // Submit test
  const handleSubmitTest = async () => {
    if (!currentSession) return;
    
    if (timerRef.current) clearInterval(timerRef.current);
    
    const unansweredCount = currentSession.questions.length - Object.keys(currentSession.answers).length;
    
    if (unansweredCount > 0) {
      const confirm = window.confirm(
        `You have ${unansweredCount} unanswered question(s). Submit anyway?`
      );
      if (!confirm) return;
    }

    try {
      const completedSession = await mcqGenerationService.completeTest(currentSession.id);
      setCurrentSession(completedSession);
      setTestCompleted(true);
      setActiveTab('results');
      
      // Load study materials
      const materials = await mcqGenerationService.generateStudyMaterials(completedSession);
      setStudyMaterials(materials);
      
      await loadData(); // Reload history
    } catch (error) {
      console.error('Error submitting test:', error);
      alert('Error submitting test');
    }
  };

  // Download study materials
  const handleDownloadStudyMaterials = async () => {
    if (!studyMaterials) return;
    
    try {
      const url = await mcqGenerationService.generateStudyMaterialPDF(studyMaterials.id);
      const link = document.createElement('a');
      link.href = url;
      link.download = `Study_Materials_${new Date().toISOString().split('T')[0]}.pdf`;
      link.click();
    } catch (error) {
      console.error('Error downloading study materials:', error);
      alert('Error downloading study materials');
    }
  };

  // Render functions for each tab
  const renderTopicsTab = () => (
    <div className="space-y-6">
      {isAdmin && (
        <div className="bg-white rounded-lg shadow-md p-6 border-l-4 border-green-500">
          <h3 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
            <Upload className="w-6 h-6 text-green-600" />
            Upload Clinical Topic (Admin)
          </h3>
          
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Topic Title *
              </label>
              <input
                type="text"
                value={topicForm.title}
                onChange={(e) => setTopicForm({ ...topicForm, title: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-green-500"
                placeholder="e.g., Management of Burns in Plastic Surgery"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Category *
              </label>
              <input
                type="text"
                value={topicForm.category}
                onChange={(e) => setTopicForm({ ...topicForm, category: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-green-500"
                placeholder="e.g., Emergency Procedures"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Target Levels * (Select all that apply)
              </label>
              <div className="space-y-2">
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={topicForm.targetLevels.includes('house_officer')}
                    onChange={(e) => {
                      const levels = e.target.checked
                        ? [...topicForm.targetLevels, 'house_officer' as const]
                        : topicForm.targetLevels.filter(l => l !== 'house_officer');
                      setTopicForm({ ...topicForm, targetLevels: levels });
                    }}
                    className="mr-2"
                  />
                  <span>House Officers (Moderate Difficulty)</span>
                </label>
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={topicForm.targetLevels.includes('junior_resident')}
                    onChange={(e) => {
                      const levels = e.target.checked
                        ? [...topicForm.targetLevels, 'junior_resident' as const]
                        : topicForm.targetLevels.filter(l => l !== 'junior_resident');
                      setTopicForm({ ...topicForm, targetLevels: levels });
                    }}
                    className="mr-2"
                  />
                  <span>Junior Residents (Moderate Difficulty)</span>
                </label>
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={topicForm.targetLevels.includes('senior_resident')}
                    onChange={(e) => {
                      const levels = e.target.checked
                        ? [...topicForm.targetLevels, 'senior_resident' as const]
                        : topicForm.targetLevels.filter(l => l !== 'senior_resident');
                      setTopicForm({ ...topicForm, targetLevels: levels });
                    }}
                    className="mr-2"
                  />
                  <span>Senior Residents (High Difficulty)</span>
                </label>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Clinical Topic Content *
              </label>
              <textarea
                value={topicForm.content}
                onChange={(e) => setTopicForm({ ...topicForm, content: e.target.value })}
                rows={10}
                className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-green-500 font-mono text-sm"
                placeholder="Paste detailed clinical content including:&#10;- Key concepts&#10;- Management principles&#10;- Clinical scenarios&#10;- Guidelines and protocols&#10;&#10;AI will automatically generate 25 clinical scenario-based MCQs from this content."
              />
              <p className="text-xs text-gray-500 mt-1">
                💡 Tip: Paste comprehensive content for better MCQ generation. Include case examples, management protocols, and key decision points.
              </p>
            </div>

            <button
              onClick={handleUploadTopic}
              disabled={uploadingTopic}
              className="w-full bg-green-600 hover:bg-green-700 text-white px-6 py-3 rounded-md font-medium flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {uploadingTopic ? (
                <>
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                  Generating MCQs...
                </>
              ) : (
                <>
                  <Upload className="w-5 h-5" />
                  Upload Topic & Generate MCQs
                </>
              )}
            </button>

            <div className="bg-blue-50 border border-blue-200 rounded-md p-4">
              <h4 className="font-semibold text-blue-900 mb-2 flex items-center gap-2">
                <Lightbulb className="w-5 h-5" />
                What Happens Next?
              </h4>
              <ol className="text-sm text-blue-800 space-y-1 list-decimal list-inside">
                <li>AI generates 25 clinical scenario MCQs for each selected level</li>
                <li>Test automatically scheduled for next Tuesday at 9:00 AM</li>
                <li>Push notifications sent to all users in target levels</li>
                <li>Each question worth 4 marks, wrong answer: -1 mark</li>
                <li>Test duration: 10 minutes with countdown timer</li>
                <li>Real-time scoring and recommendations</li>
                <li>Personalized study materials generated based on performance</li>
              </ol>
            </div>
          </div>
        </div>
      )}

      <div className="bg-gradient-to-br from-green-50 to-blue-50 rounded-lg shadow-md p-6">
        <h3 className="text-xl font-bold text-gray-900 mb-4">Upcoming Assessments</h3>
        
        {upcomingTests.length === 0 ? (
          <p className="text-gray-600">No upcoming tests scheduled</p>
        ) : (
          <div className="space-y-4">
            {upcomingTests.map((schedule) => (
              <div key={schedule.id} className="bg-white rounded-lg p-4 border-2 border-green-300">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <h4 className="font-semibold text-lg text-gray-900">Clinical MCQ Assessment</h4>
                    <p className="text-sm text-gray-600 mt-1">
                      📅 {new Date(schedule.scheduledFor).toLocaleString('en-US', {
                        weekday: 'long',
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                    </p>
                    <div className="mt-3 flex flex-wrap gap-3 text-sm">
                      <span className="flex items-center gap-1">
                        <Clock className="w-4 h-4 text-gray-500" />
                        {schedule.testDuration / 60} minutes
                      </span>
                      <span className="flex items-center gap-1">
                        <FileText className="w-4 h-4 text-gray-500" />
                        {schedule.totalQuestions} questions
                      </span>
                      <span className="flex items-center gap-1">
                        <Target className="w-4 h-4 text-gray-500" />
                        4 marks each
                      </span>
                    </div>
                  </div>
                  
                  <button
                    onClick={() => handleStartTest(schedule)}
                    disabled={new Date() < new Date(schedule.scheduledFor)}
                    className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-md font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                  >
                    <Play className="w-4 h-4" />
                    {new Date() < new Date(schedule.scheduledFor) ? 'Not Available' : 'Start Test'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );

  const renderActiveTestTab = () => {
    if (!currentSession) return <div>No active test</div>;

    const currentQuestion = currentSession.questions[currentQuestionIndex];
    const userAnswer = currentSession.answers[currentQuestion.id];
    const hasAnswered = userAnswer !== undefined;
    const isCorrect = hasAnswered && userAnswer === currentQuestion.correctAnswer;

    return (
      <div className="space-y-6">
        {/* Timer and Progress */}
        <div className="bg-white rounded-lg shadow-md p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-lg font-bold text-gray-900">
                Question {currentQuestionIndex + 1} of {currentSession.questions.length}
              </h3>
              <div className="w-full bg-gray-200 rounded-full h-2 mt-2">
                <div
                  className="bg-green-600 h-2 rounded-full transition-all"
                  style={{ width: `${((currentQuestionIndex + 1) / currentSession.questions.length) * 100}%` }}
                ></div>
              </div>
            </div>
            
            <div className={`text-3xl font-bold ${getTimerColor()} flex items-center gap-2`}>
              <Clock className="w-8 h-8" />
              {formatTime(timeRemaining)}
            </div>
          </div>

          {timeRemaining < 60 && (
            <div className="bg-red-50 border border-red-300 rounded-md p-3 flex items-center gap-2 text-red-800">
              <AlertCircle className="w-5 h-5" />
              <span className="font-medium">Less than 1 minute remaining!</span>
            </div>
          )}
        </div>

        {/* Question */}
        <div className="bg-white rounded-lg shadow-md p-6">
          <div className="mb-4">
            <span className="inline-block bg-purple-100 text-purple-800 px-3 py-1 rounded-full text-sm font-medium">
              {currentQuestion.category}
            </span>
            <span className="inline-block ml-2 bg-blue-100 text-blue-800 px-3 py-1 rounded-full text-sm font-medium">
              {currentQuestion.points} marks
            </span>
          </div>

          <div className="bg-blue-50 border-l-4 border-blue-500 p-4 mb-6">
            <h4 className="font-semibold text-blue-900 mb-2">Clinical Scenario:</h4>
            <p className="text-gray-800 leading-relaxed">{currentQuestion.clinicalScenario}</p>
          </div>

          <h4 className="font-bold text-lg text-gray-900 mb-4">{currentQuestion.question}</h4>

          <div className="space-y-3">
            {currentQuestion.options.map((option, index) => {
              const isSelected = userAnswer === index;
              const isCorrectOption = index === currentQuestion.correctAnswer;
              
              let bgColor = 'bg-white hover:bg-gray-50';
              let borderColor = 'border-gray-300';
              let textColor = 'text-gray-900';

              if (hasAnswered && showExplanation) {
                if (isCorrectOption) {
                  bgColor = 'bg-green-50';
                  borderColor = 'border-green-500';
                  textColor = 'text-green-900';
                } else if (isSelected && !isCorrect) {
                  bgColor = 'bg-red-50';
                  borderColor = 'border-red-500';
                  textColor = 'text-red-900';
                }
              } else if (isSelected) {
                bgColor = 'bg-blue-50';
                borderColor = 'border-blue-500';
                textColor = 'text-blue-900';
              }

              return (
                <button
                  key={index}
                  onClick={() => !hasAnswered && handleSelectAnswer(index)}
                  disabled={hasAnswered}
                  className={`w-full text-left p-4 rounded-lg border-2 ${bgColor} ${borderColor} ${textColor} transition-all disabled:cursor-not-allowed`}
                >
                  <div className="flex items-center gap-3">
                    <span className="flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center font-bold border-2 ${borderColor}">
                      {String.fromCharCode(65 + index)}
                    </span>
                    <span className="flex-1">{option}</span>
                    {hasAnswered && showExplanation && isCorrectOption && (
                      <CheckCircle className="w-6 h-6 text-green-600 flex-shrink-0" />
                    )}
                    {hasAnswered && showExplanation && isSelected && !isCorrect && (
                      <XCircle className="w-6 h-6 text-red-600 flex-shrink-0" />
                    )}
                  </div>
                </button>
              );
            })}
          </div>

          {hasAnswered && showExplanation && (
            <div className={`mt-6 p-4 rounded-lg border-2 ${isCorrect ? 'bg-green-50 border-green-300' : 'bg-red-50 border-red-300'}`}>
              <h5 className={`font-bold mb-2 flex items-center gap-2 ${isCorrect ? 'text-green-900' : 'text-red-900'}`}>
                {isCorrect ? (
                  <>
                    <CheckCircle className="w-5 h-5" />
                    Correct! (+4 marks)
                  </>
                ) : (
                  <>
                    <XCircle className="w-5 h-5" />
                    Incorrect (-1 mark)
                  </>
                )}
              </h5>
              <p className="text-gray-800 leading-relaxed">{currentQuestion.explanation}</p>
              
              {currentQuestion.learningObjectives.length > 0 && (
                <div className="mt-3">
                  <h6 className="font-semibold text-gray-900 mb-1">Key Learning Points:</h6>
                  <ul className="list-disc list-inside text-sm text-gray-700 space-y-1">
                    {currentQuestion.learningObjectives.map((obj, idx) => (
                      <li key={idx}>{obj}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Navigation */}
        <div className="flex items-center justify-between">
          <button
            onClick={handlePreviousQuestion}
            disabled={currentQuestionIndex === 0}
            className="flex items-center gap-2 px-4 py-2 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-md font-medium disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <ArrowLeft className="w-4 h-4" />
            Previous
          </button>

          <div className="text-sm text-gray-600">
            Answered: {Object.keys(currentSession.answers).length} / {currentSession.questions.length}
          </div>

          {currentQuestionIndex < currentSession.questions.length - 1 ? (
            <button
              onClick={handleNextQuestion}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md font-medium"
            >
              Next
              <ArrowRight className="w-4 h-4" />
            </button>
          ) : (
            <button
              onClick={handleSubmitTest}
              className="flex items-center gap-2 px-6 py-2 bg-green-600 hover:bg-green-700 text-white rounded-md font-medium"
            >
              Submit Test
              <CheckCircle className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>
    );
  };

  const renderResultsTab = () => {
    if (!currentSession || !testCompleted) return <div>No results available</div>;

    const correctCount = Object.keys(currentSession.answers).filter(
      qId => currentSession.answers[qId] === currentSession.questions.find(q => q.id === qId)?.correctAnswer
    ).length;

    const wrongCount = Object.keys(currentSession.answers).length - correctCount;
    const unansweredCount = currentSession.questions.length - Object.keys(currentSession.answers).length;

    return (
      <div className="space-y-6">
        {/* Score Card */}
        <div className="bg-gradient-to-br from-green-50 to-blue-50 rounded-lg shadow-lg p-8 border-2 border-green-300">
          <div className="text-center">
            <h2 className="text-3xl font-bold text-gray-900 mb-2">Test Completed!</h2>
            <div className="text-6xl font-bold my-6 ${currentSession.passed ? 'text-green-600' : 'text-red-600'}">
              {currentSession.percentageScore}%
            </div>
            <div className="text-xl font-semibold mb-4">
              Raw Score: {currentSession.rawScore} / {currentSession.questions.length * 4} marks
            </div>
            
            <div className="flex justify-center gap-8 mt-6">
              <div className="text-center">
                <div className="text-3xl font-bold text-green-600">{correctCount}</div>
                <div className="text-sm text-gray-600">Correct (+4 each)</div>
              </div>
              <div className="text-center">
                <div className="text-3xl font-bold text-red-600">{wrongCount}</div>
                <div className="text-sm text-gray-600">Wrong (-1 each)</div>
              </div>
              <div className="text-center">
                <div className="text-3xl font-bold text-gray-600">{unansweredCount}</div>
                <div className="text-sm text-gray-600">Unanswered (0)</div>
              </div>
            </div>

            <div className={`mt-6 inline-block px-6 py-3 rounded-full font-bold text-lg ${
              currentSession.passed 
                ? 'bg-green-600 text-white' 
                : 'bg-red-600 text-white'
            }`}>
              {currentSession.passed ? '✅ PASSED' : '❌ FAILED'}
            </div>
          </div>
        </div>

        {/* AI Recommendations */}
        {currentSession.aiRecommendations && (
          <div className="bg-white rounded-lg shadow-md p-6">
            <h3 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
              <Brain className="w-6 h-6 text-purple-600" />
              Performance Analysis
            </h3>
            <div className="prose max-w-none">
              <div dangerouslySetInnerHTML={{ __html: currentSession.aiRecommendations.replace(/\n/g, '<br/>') }} />
            </div>
          </div>
        )}

        {/* Study Materials */}
        {studyMaterials && (
          <div className="bg-white rounded-lg shadow-md p-6 border-l-4 border-blue-500">
            <h3 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
              <FileText className="w-6 h-6 text-blue-600" />
              Personalized Study Materials
            </h3>
            
            <p className="text-gray-700 mb-4">
              Comprehensive study materials have been generated based on your performance, focusing on:
            </p>
            
            <div className="bg-blue-50 rounded-md p-4 mb-4">
              <h4 className="font-semibold text-blue-900 mb-2">Weak Areas Identified:</h4>
              <div className="flex flex-wrap gap-2">
                {currentSession.weakAreas.map((area, index) => (
                  <span key={index} className="bg-blue-200 text-blue-800 px-3 py-1 rounded-full text-sm font-medium">
                    {area}
                  </span>
                ))}
              </div>
            </div>

            <button
              onClick={handleDownloadStudyMaterials}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-md font-medium flex items-center justify-center gap-2"
            >
              <Download className="w-5 h-5" />
              Download Comprehensive Study Materials (PDF)
            </button>

            <div className="mt-4 text-sm text-gray-600">
              <h5 className="font-semibold mb-2">Study materials include:</h5>
              <ul className="list-disc list-inside space-y-1">
                <li>Detailed explanations of missed questions</li>
                <li>Key learning objectives and takeaways</li>
                <li>Clinical application guidance</li>
                <li>Recommended reading list</li>
                <li>Practice exercises and algorithms</li>
                <li>Self-assessment checklists</li>
              </ul>
            </div>
          </div>
        )}
      </div>
    );
  };

  const renderHistoryTab = () => (
    <div className="space-y-6">
      <div className="bg-white rounded-lg shadow-md p-6">
        <h3 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
          <BarChart className="w-6 h-6 text-green-600" />
          Your Test History
        </h3>

        {testHistory.length === 0 ? (
          <p className="text-gray-600">No test history available</p>
        ) : (
          <div className="space-y-4">
            {testHistory.map((session) => (
              <div key={session.id} className="border-2 rounded-lg p-4 hover:shadow-md transition-shadow">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <h4 className="font-semibold text-lg">
                      {new Date(session.startedAt).toLocaleDateString()}
                    </h4>
                    <p className="text-sm text-gray-600">
                      Level: {session.userLevel.replace('_', ' ').toUpperCase()}
                    </p>
                  </div>
                  <div className={`text-3xl font-bold ${session.passed ? 'text-green-600' : 'text-red-600'}`}>
                    {session.percentageScore}%
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-4 text-center">
                  <div>
                    <div className="text-2xl font-bold text-gray-900">{session.rawScore}</div>
                    <div className="text-xs text-gray-600">Raw Score</div>
                  </div>
                  <div>
                    <div className="text-2xl font-bold text-gray-900">
                      {Object.keys(session.answers).length}/{session.questions.length}
                    </div>
                    <div className="text-xs text-gray-600">Attempted</div>
                  </div>
                  <div>
                    <div className={`text-2xl font-bold ${session.passed ? 'text-green-600' : 'text-red-600'}`}>
                      {session.passed ? 'PASS' : 'FAIL'}
                    </div>
                    <div className="text-xs text-gray-600">Result</div>
                  </div>
                </div>

                {session.weakAreas.length > 0 && (
                  <div className="mt-3 pt-3 border-t">
                    <div className="text-xs font-semibold text-gray-700 mb-1">Weak Areas:</div>
                    <div className="flex flex-wrap gap-1">
                      {session.weakAreas.map((area, idx) => (
                        <span key={idx} className="text-xs bg-red-100 text-red-700 px-2 py-1 rounded">
                          {area}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );

  const renderCMEArticlesTab = () => {
    const categoryLabels = {
      part_i_principles: 'Part I - Principles',
      part_i_specialty: 'Part I - Specialty Intro',
      part_ii_general: 'Part II - General Surgery',
      part_ii_plastic: 'Part II - Plastic Surgery'
    };

    const difficultyColors = {
      beginner: 'bg-green-100 text-green-800',
      intermediate: 'bg-yellow-100 text-yellow-800',
      advanced: 'bg-red-100 text-red-800'
    };

    return (
      <div className="space-y-6">
        {/* Filters */}
        <div className="bg-white rounded-lg shadow-md p-6">
          <div className="flex items-center gap-2 mb-4">
            <Filter className="w-5 h-5 text-green-600" />
            <h3 className="text-lg font-semibold text-gray-900">Filters</h3>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Category Filter */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Category
              </label>
              <select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value as WACSCategory | 'all')}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
              >
                <option value="all">All Categories</option>
                <option value="part_i_principles">Part I - Principles</option>
                <option value="part_i_specialty">Part I - Specialty Intro</option>
                <option value="part_ii_general">Part II - General Surgery</option>
                <option value="part_ii_plastic">Part II - Plastic Surgery</option>
              </select>
            </div>

            {/* Status Filter */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Reading Status
              </label>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as 'all' | 'unread' | 'completed')}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
              >
                <option value="all">All Articles</option>
                <option value="unread">Unread</option>
                <option value="completed">Completed</option>
              </select>
            </div>
          </div>
        </div>

        {/* Articles Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredArticles.length === 0 ? (
            <div className="col-span-full text-center py-12">
              <BookOpen className="w-16 h-16 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-600">No articles found</p>
            </div>
          ) : (
            filteredArticles.map((article) => (
              <div
                key={article.id}
                className="bg-white rounded-lg shadow-md hover:shadow-lg transition-shadow overflow-hidden"
              >
                {/* Article Header */}
                <div className="p-4 border-b border-gray-200">
                  <div className="flex items-start justify-between mb-2">
                    <span className={`px-3 py-1 rounded-full text-xs font-medium ${difficultyColors[article.difficulty_level]}`}>
                      {article.difficulty_level.charAt(0).toUpperCase() + article.difficulty_level.slice(1)}
                    </span>
                    <div className="flex items-center space-x-1">
                      <Heart className="w-4 h-4 text-gray-400" />
                      <span className="text-sm text-gray-600">{article.like_count || 0}</span>
                    </div>
                  </div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-2 line-clamp-2">
                    {article.title}
                  </h3>
                  <span className="inline-block px-2 py-1 bg-blue-100 text-blue-800 rounded text-xs font-medium">
                    {categoryLabels[article.category]}
                  </span>
                </div>

                {/* Article Body */}
                <div className="p-4">
                  <p className="text-gray-600 text-sm line-clamp-3 mb-4">
                    {article.summary}
                  </p>

                  <div className="flex items-center justify-between text-sm text-gray-500 mb-4">
                    <div className="flex items-center space-x-1">
                      <Clock className="w-4 h-4" />
                      <span>{article.reading_time_minutes} min read</span>
                    </div>
                    <div className="flex items-center space-x-1">
                      <Calendar className="w-4 h-4" />
                      <span>{new Date(article.published_date).toLocaleDateString()}</span>
                    </div>
                  </div>

                  <button
                    onClick={() => setSelectedArticle(article.id)}
                    className="w-full px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors flex items-center justify-center space-x-2"
                  >
                    <BookOpen className="w-4 h-4" />
                    <span>Read Article</span>
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="container mx-auto px-4 py-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
          <Brain className="w-8 h-8 text-green-600" />
          Continuing Medical Education - MCQ Assessment
        </h1>
        <p className="text-gray-600 mt-2">
          Weekly clinical scenario-based assessments with intelligent feedback and personalized study materials
        </p>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-6 overflow-x-auto">
        <button
          onClick={() => setActiveTab('topics')}
          className={`px-4 py-2 rounded-md font-medium whitespace-nowrap ${
            activeTab === 'topics'
              ? 'bg-green-600 text-white'
              : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
          }`}
        >
          📚 Topics & Tests
        </button>
        <button
          onClick={() => setActiveTab('cme-articles')}
          className={`px-4 py-2 rounded-md font-medium whitespace-nowrap ${
            activeTab === 'cme-articles'
              ? 'bg-green-600 text-white'
              : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
          }`}
        >
          📖 CME Articles
        </button>
        <button
          onClick={() => setActiveTab('active-test')}
          disabled={!currentSession || testCompleted}
          className={`px-4 py-2 rounded-md font-medium whitespace-nowrap disabled:opacity-50 disabled:cursor-not-allowed ${
            activeTab === 'active-test'
              ? 'bg-green-600 text-white'
              : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
          }`}
        >
          📝 Active Test
        </button>
        <button
          onClick={() => setActiveTab('results')}
          disabled={!testCompleted}
          className={`px-4 py-2 rounded-md font-medium whitespace-nowrap disabled:opacity-50 disabled:cursor-not-allowed ${
            activeTab === 'results'
              ? 'bg-green-600 text-white'
              : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
          }`}
        >
          📊 Results
        </button>
        <button
          onClick={() => setActiveTab('history')}
          className={`px-4 py-2 rounded-md font-medium whitespace-nowrap ${
            activeTab === 'history'
              ? 'bg-green-600 text-white'
              : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
          }`}
        >
          📈 History
        </button>
      </div>

      {/* Tab Content */}
      {activeTab === 'topics' && renderTopicsTab()}
      {activeTab === 'cme-articles' && renderCMEArticlesTab()}
      {activeTab === 'active-test' && renderActiveTestTab()}
      {activeTab === 'results' && renderResultsTab()}
      {activeTab === 'history' && renderHistoryTab()}

      {/* CME Article Viewer Modal */}
      {selectedArticle && user && (
        <CMEArticleViewer
          articleId={selectedArticle}
          userId={user.id}
          onClose={() => setSelectedArticle(null)}
        />
      )}
    </div>
  );
};

export default MCQEducation;

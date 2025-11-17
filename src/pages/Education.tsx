import React, { useState, useEffect } from 'react';
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
  Settings,
  Key,
  Lightbulb,
  Calendar,
  Download
} from 'lucide-react';
import { cmeService } from '../services/cmeService';
import { aiService, CMETopic, TestSession, CMEProgress, CMECertificate } from '../services/aiService';

const Education: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'topics' | 'test' | 'progress' | 'certificates' | 'settings'>('topics');
  const [topics, setTopics] = useState<CMETopic[]>([]);
  const [selectedTopic, setSelectedTopic] = useState<CMETopic | null>(null);
  const [currentSession, setCurrentSession] = useState<TestSession | null>(null);
  const [progress, setProgress] = useState<CMEProgress[]>([]);
  const [certificates, setCertificates] = useState<CMECertificate[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [showResults, setShowResults] = useState(false);
  const [apiKey, setApiKey] = useState('');
  const [recommendations, setRecommendations] = useState<string[]>([]);

  const currentUserId = 'demo-user'; // In real app, get from auth store

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      
      // Initialize demo data
      await cmeService.initializeDemoData();
      
      // Load topics and user data
      const [topicsData, progressData, certificatesData, recs] = await Promise.all([
        cmeService.getAllTopics(),
        cmeService.getUserProgress(currentUserId),
        cmeService.getUserCertificates(currentUserId),
        cmeService.getStudyRecommendations(currentUserId)
      ]);
      
      setTopics(topicsData);
      setProgress(progressData);
      setCertificates(certificatesData);
      setRecommendations(recs);
    } catch (error) {
      console.error('Error loading education data:', error);
    } finally {
      setLoading(false);
    }
  };

  const startTest = async (topic: CMETopic) => {
    try {
      const session = await cmeService.startTestSession(currentUserId, topic.id);
      setCurrentSession(session);
      setSelectedTopic(topic);
      setCurrentQuestionIndex(0);
      setAnswers({});
      setShowResults(false);
      setActiveTab('test');
    } catch (error) {
      console.error('Error starting test:', error);
    }
  };

  const selectAnswer = (questionId: string, answerIndex: number) => {
    setAnswers(prev => ({
      ...prev,
      [questionId]: answerIndex
    }));
  };

  const nextQuestion = () => {
    if (currentSession && currentQuestionIndex < currentSession.questions.length - 1) {
      setCurrentQuestionIndex(prev => prev + 1);
    }
  };

  const previousQuestion = () => {
    if (currentQuestionIndex > 0) {
      setCurrentQuestionIndex(prev => prev - 1);
    }
  };

  const submitTest = async () => {
    if (!currentSession) return;
    
    try {
      const completedSession = await cmeService.submitTestSession(currentSession.id, answers);
      setCurrentSession(completedSession);
      setShowResults(true);
      
      // Reload progress data
      const updatedProgress = await cmeService.getUserProgress(currentUserId);
      setProgress(updatedProgress);
      
      if (completedSession.certificateEligible) {
        const updatedCertificates = await cmeService.getUserCertificates(currentUserId);
        setCertificates(updatedCertificates);
      }
    } catch (error) {
      console.error('Error submitting test:', error);
    }
  };

  const generateWeeklyTopic = async () => {
    if (!aiService.isReady()) {
      alert('Please configure OpenAI API key first');
      return;
    }
    
    try {
      setLoading(true);
      const newTopic = await cmeService.generateWeeklyTopic();
      setTopics(prev => [newTopic, ...prev]);
      alert('New weekly topic generated successfully!');
    } catch (error) {
      console.error('Error generating weekly topic:', error);
      alert('Failed to generate weekly topic. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const saveApiKey = async () => {
    try {
      const response = await fetch('/api/ai/settings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
        },
        body: JSON.stringify({
          setting_key: 'openai_api_key',
          setting_value: apiKey
        })
      });

      if (response.ok) {
        alert('API key saved successfully! AI features are now enabled.');
      } else {
        alert('Failed to save API key. Please check your permissions.');
      }
    } catch (error) {
      alert('Error saving API key. Please try again.');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-96">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-500"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-clinical-dark">
            Continuing Medical Education
          </h1>
          <p className="text-clinical mt-1">
            Learning modules for plastic surgery residents
          </p>
        </div>
        <div className="flex items-center space-x-4">
          {aiService.isReady() && (
            <button
              onClick={generateWeeklyTopic}
              className="flex items-center space-x-2 px-4 py-2 bg-primary-500 text-white rounded-lg hover:bg-primary-600"
            >
              <Brain className="h-4 w-4" />
              <span>Generate Weekly Topic</span>
            </button>
          )}
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex space-x-8">
          {[
            { id: 'topics', label: 'Topics', icon: BookOpen },
            { id: 'test', label: 'Test', icon: Brain },
            { id: 'progress', label: 'Progress', icon: TrendingUp },
            { id: 'certificates', label: 'Certificates', icon: Award },
            { id: 'settings', label: 'Settings', icon: Settings }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex items-center space-x-2 py-2 px-1 border-b-2 font-medium text-sm ${
                activeTab === tab.id
                  ? 'border-primary-500 text-primary-600'
                  : 'border-transparent text-clinical hover:text-clinical-dark hover:border-gray-300'
              }`}
            >
              <tab.icon className="h-4 w-4" />
              <span>{tab.label}</span>
            </button>
          ))}
        </nav>
      </div>

      {/* Content */}
      <div className="bg-white rounded-lg shadow-sm p-6">
        {activeTab === 'topics' && (
          <div className="space-y-6">
            {/* Study Recommendations */}
            {recommendations.length > 0 && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <div className="flex items-center space-x-2 mb-3">
                  <Lightbulb className="h-5 w-5 text-blue-600" />
                  <h3 className="font-medium text-blue-900">Personalized Study Recommendations</h3>
                </div>
                <ul className="space-y-1">
                  {recommendations.slice(0, 3).map((rec, index) => (
                    <li key={index} className="text-blue-800 text-sm">• {rec}</li>
                  ))}
                </ul>
              </div>
            )}

            {/* Topics Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {topics.map(topic => {
                const topicProgress = progress.find(p => p.topicId === topic.id);
                return (
                  <div key={topic.id} className="border border-gray-200 rounded-lg p-6 hover:shadow-md transition-shadow">
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex-1">
                        <h3 className="font-semibold text-clinical-dark mb-2">{topic.title}</h3>
                        <p className="text-sm text-clinical mb-3">{topic.description}</p>
                        <div className="flex items-center space-x-4 text-xs text-clinical">
                          <span className="flex items-center space-x-1">
                            <Clock className="h-3 w-3" />
                            <span>{topic.estimatedDuration} min</span>
                          </span>
                          <span className="flex items-center space-x-1">
                            <Calendar className="h-3 w-3" />
                            <span>{topic.weekOf}</span>
                          </span>
                        </div>
                      </div>
                      {topicProgress?.completed && (
                        <CheckCircle className="h-5 w-5 text-green-500 flex-shrink-0" />
                      )}
                    </div>
                    
                    <div className="space-y-3">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-clinical">Questions: {topic.questions.length}</span>
                        {topicProgress?.score && (
                          <span className={`font-medium ${
                            topicProgress.score >= 80 ? 'text-green-600' : 
                            topicProgress.score >= 70 ? 'text-yellow-600' : 'text-red-600'
                          }`}>
                            Score: {topicProgress.score}%
                          </span>
                        )}
                      </div>
                      
                      <button
                        onClick={() => startTest(topic)}
                        className="w-full flex items-center justify-center space-x-2 px-4 py-2 bg-primary-500 text-white rounded-lg hover:bg-primary-600"
                      >
                        <Play className="h-4 w-4" />
                        <span>{topicProgress?.completed ? 'Retake Test' : 'Start Test'}</span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>

            {topics.length === 0 && (
              <div className="text-center py-12">
                <BookOpen className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-clinical-dark mb-2">No Topics Available</h3>
                <p className="text-clinical mb-4">
                  Configure your OpenAI API key to generate educational content.
                </p>
                <button
                  onClick={() => setActiveTab('settings')}
                  className="inline-flex items-center space-x-2 px-4 py-2 bg-primary-500 text-white rounded-lg hover:bg-primary-600"
                >
                  <Settings className="h-4 w-4" />
                  <span>Configure Settings</span>
                </button>
              </div>
            )}
          </div>
        )}

        {activeTab === 'test' && currentSession && selectedTopic && (
          <div className="space-y-6">
            {!showResults ? (
              <>
                {/* Test Header */}
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-xl font-semibold text-clinical-dark">{selectedTopic.title}</h2>
                    <p className="text-clinical">
                      Question {currentQuestionIndex + 1} of {currentSession.questions.length}
                    </p>
                  </div>
                  <div className="text-right">
                    <div className="text-sm text-clinical">Progress</div>
                    <div className="w-32 bg-gray-200 rounded-full h-2">
                      <div 
                        className="bg-primary-500 h-2 rounded-full transition-all"
                        style={{ width: `${((currentQuestionIndex + 1) / currentSession.questions.length) * 100}%` }}
                      />
                    </div>
                  </div>
                </div>

                {/* Current Question */}
                {currentSession.questions[currentQuestionIndex] && (
                  <div className="space-y-6">
                    <div className="bg-gray-50 rounded-lg p-6">
                      <h3 className="text-lg font-medium text-clinical-dark mb-4">
                        {currentSession.questions[currentQuestionIndex].question}
                      </h3>
                      
                      <div className="space-y-3">
                        {currentSession.questions[currentQuestionIndex].options.map((option, index) => (
                          <label
                            key={index}
                            className={`block p-4 border rounded-lg cursor-pointer transition-colors ${
                              answers[currentSession.questions[currentQuestionIndex].id] === index
                                ? 'border-primary-500 bg-primary-50'
                                : 'border-gray-200 hover:border-gray-300'
                            }`}
                          >
                            <input
                              type="radio"
                              name={`question-${currentQuestionIndex}`}
                              checked={answers[currentSession.questions[currentQuestionIndex].id] === index}
                              onChange={() => selectAnswer(currentSession.questions[currentQuestionIndex].id, index)}
                              className="sr-only"
                            />
                            <span className="text-clinical-dark">{option}</span>
                          </label>
                        ))}
                      </div>
                    </div>

                    {/* Navigation */}
                    <div className="flex items-center justify-between">
                      <button
                        onClick={previousQuestion}
                        disabled={currentQuestionIndex === 0}
                        className="flex items-center space-x-2 px-4 py-2 border border-gray-300 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
                      >
                        <span>Previous</span>
                      </button>
                      
                      <div className="flex space-x-3">
                        {currentQuestionIndex === currentSession.questions.length - 1 ? (
                          <button
                            onClick={submitTest}
                            disabled={Object.keys(answers).length !== currentSession.questions.length}
                            className="flex items-center space-x-2 px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            <CheckCircle className="h-4 w-4" />
                            <span>Submit Test</span>
                          </button>
                        ) : (
                          <button
                            onClick={nextQuestion}
                            className="flex items-center space-x-2 px-4 py-2 bg-primary-500 text-white rounded-lg hover:bg-primary-600"
                          >
                            <span>Next</span>
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </>
            ) : (
              /* Test Results */
              <div className="space-y-6">
                <div className="text-center">
                  <div className={`mx-auto w-16 h-16 rounded-full flex items-center justify-center mb-4 ${
                    currentSession.passed ? 'bg-green-100' : 'bg-red-100'
                  }`}>
                    {currentSession.passed ? (
                      <CheckCircle className="h-8 w-8 text-green-600" />
                    ) : (
                      <XCircle className="h-8 w-8 text-red-600" />
                    )}
                  </div>
                  <h2 className="text-2xl font-bold text-clinical-dark mb-2">
                    {currentSession.passed ? 'Congratulations!' : 'Test Complete'}
                  </h2>
                  <p className="text-clinical mb-4">
                    You scored {currentSession.score}% on this test
                  </p>
                  {currentSession.certificateEligible && (
                    <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-4">
                      <Award className="h-5 w-5 text-yellow-600 mx-auto mb-2" />
                      <p className="text-yellow-800 font-medium">Certificate Earned!</p>
                      <p className="text-yellow-700 text-sm">You've earned 1.0 CME credit</p>
                    </div>
                  )}
                </div>

                {/* Detailed Results */}
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold text-clinical-dark">Question Review</h3>
                  {currentSession.questions.map((question, index) => {
                    const userAnswer = answers[question.id];
                    const isCorrect = userAnswer === question.correctAnswer;
                    
                    return (
                      <div key={question.id} className="border border-gray-200 rounded-lg p-4">
                        <div className="flex items-start space-x-3">
                          <div className={`flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center ${
                            isCorrect ? 'bg-green-100' : 'bg-red-100'
                          }`}>
                            {isCorrect ? (
                              <CheckCircle className="h-4 w-4 text-green-600" />
                            ) : (
                              <XCircle className="h-4 w-4 text-red-600" />
                            )}
                          </div>
                          <div className="flex-1">
                            <h4 className="font-medium text-clinical-dark mb-2">
                              Question {index + 1}: {question.question}
                            </h4>
                            <div className="space-y-2 text-sm">
                              <div>
                                <span className="font-medium">Your answer: </span>
                                <span className={isCorrect ? 'text-green-600' : 'text-red-600'}>
                                  {question.options[userAnswer]}
                                </span>
                              </div>
                              {!isCorrect && (
                                <div>
                                  <span className="font-medium">Correct answer: </span>
                                  <span className="text-green-600">
                                    {question.options[question.correctAnswer]}
                                  </span>
                                </div>
                              )}
                              <div className="bg-gray-50 rounded p-3 mt-3">
                                <span className="font-medium">Explanation: </span>
                                {question.explanation}
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div className="flex justify-center space-x-4">
                  <button
                    onClick={() => setActiveTab('topics')}
                    className="px-6 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
                  >
                    Back to Topics
                  </button>
                  <button
                    onClick={() => startTest(selectedTopic)}
                    className="flex items-center space-x-2 px-6 py-2 bg-primary-500 text-white rounded-lg hover:bg-primary-600"
                  >
                    <RotateCcw className="h-4 w-4" />
                    <span>Retake Test</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === 'progress' && (
          <div className="space-y-6">
            <h2 className="text-xl font-semibold text-clinical-dark">Learning Progress</h2>
            
            {progress.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {progress.map(prog => {
                  const topic = topics.find(t => t.id === prog.topicId);
                  return (
                    <div key={prog.topicId} className="border border-gray-200 rounded-lg p-6">
                      <h3 className="font-semibold text-clinical-dark mb-2">
                        {topic?.title || 'Unknown Topic'}
                      </h3>
                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between">
                          <span>Status:</span>
                          <span className={prog.completed ? 'text-green-600' : 'text-yellow-600'}>
                            {prog.completed ? 'Completed' : 'In Progress'}
                          </span>
                        </div>
                        {prog.score && (
                          <div className="flex justify-between">
                            <span>Best Score:</span>
                            <span className={`font-medium ${
                              prog.score >= 80 ? 'text-green-600' : 
                              prog.score >= 70 ? 'text-yellow-600' : 'text-red-600'
                            }`}>
                              {prog.score}%
                            </span>
                          </div>
                        )}
                        <div className="flex justify-between">
                          <span>Attempts:</span>
                          <span>{prog.attempts}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Time Spent:</span>
                          <span>{prog.timeSpent} min</span>
                        </div>
                        {prog.certificateEarned && (
                          <div className="flex items-center justify-center mt-3 p-2 bg-yellow-50 border border-yellow-200 rounded">
                            <Award className="h-4 w-4 text-yellow-600 mr-2" />
                            <span className="text-yellow-800 text-xs font-medium">Certificate Earned</span>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="text-center py-12">
                <TrendingUp className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-clinical-dark mb-2">No Progress Yet</h3>
                <p className="text-clinical">Start taking tests to track your learning progress.</p>
              </div>
            )}
          </div>
        )}

        {activeTab === 'certificates' && (
          <div className="space-y-6">
            <h2 className="text-xl font-semibold text-clinical-dark">CME Certificates</h2>
            
            {certificates.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {certificates.map(cert => {
                  const topic = topics.find(t => t.id === cert.topicId);
                  return (
                    <div key={cert.id} className="border border-gray-200 rounded-lg p-6 bg-gradient-to-br from-yellow-50 to-orange-50">
                      <div className="flex items-center justify-between mb-4">
                        <Award className="h-8 w-8 text-yellow-600" />
                        <span className="text-sm text-clinical">
                          {cert.creditsEarned} CME Credit{cert.creditsEarned !== 1 ? 's' : ''}
                        </span>
                      </div>
                      <h3 className="font-semibold text-clinical-dark mb-2">
                        {topic?.title || 'CME Certificate'}
                      </h3>
                      <div className="space-y-1 text-sm text-clinical">
                        <div>Score: {cert.score}%</div>
                        <div>Issued: {new Date(cert.issuedAt).toLocaleDateString()}</div>
                        <div>Valid Until: {new Date(cert.validUntil).toLocaleDateString()}</div>
                      </div>
                      <button className="mt-4 flex items-center space-x-2 text-primary-600 hover:text-primary-700">
                        <Download className="h-4 w-4" />
                        <span>Download Certificate</span>
                      </button>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="text-center py-12">
                <Award className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-clinical-dark mb-2">No Certificates Yet</h3>
                <p className="text-clinical">Complete tests with 80% or higher to earn CME certificates.</p>
              </div>
            )}
          </div>
        )}

        {activeTab === 'settings' && (
          <div className="space-y-6">
            <h2 className="text-xl font-semibold text-clinical-dark">AI Settings</h2>
            
            <div className="max-w-md space-y-4">
              <div>
                <label className="block text-sm font-medium text-clinical-dark mb-2">
                  OpenAI API Key
                </label>
                <div className="flex space-x-3">
                  <input
                    type="password"
                    value={apiKey}
                    onChange={(e) => setApiKey(e.target.value)}
                    placeholder="Enter your OpenAI API key"
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-primary-500 focus:border-primary-500"
                  />
                  <button
                    onClick={saveApiKey}
                    disabled={!apiKey.trim()}
                    className="flex items-center space-x-2 px-4 py-2 bg-primary-500 text-white rounded-lg hover:bg-primary-600 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <Key className="h-4 w-4" />
                    <span>Save</span>
                  </button>
                </div>
                <p className="text-xs text-clinical mt-1">
                  Required for AI-powered topic generation and personalized recommendations
                </p>
              </div>
              
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <div className="flex items-center space-x-2 mb-2">
                  <Lightbulb className="h-5 w-5 text-blue-600" />
                  <span className="font-medium text-blue-900">AI Features</span>
                </div>
                <ul className="text-sm text-blue-800 space-y-1">
                  <li>• Weekly topic generation based on clinical data</li>
                  <li>• Personalized study recommendations</li>
                  <li>• Adaptive question difficulty</li>
                  <li>• Clinical case scenarios</li>
                </ul>
              </div>

              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                <div className="flex items-center space-x-2 mb-2">
                  <Target className="h-5 w-5 text-yellow-600" />
                  <span className="font-medium text-yellow-900">Status</span>
                </div>
                <p className="text-sm text-yellow-800">
                  AI Service: {aiService.isReady() ? 
                    <span className="text-green-600 font-medium">Connected</span> : 
                    <span className="text-red-600 font-medium">Not Configured</span>
                  }
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Education;
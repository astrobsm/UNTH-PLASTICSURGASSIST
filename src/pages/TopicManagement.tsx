import React, { useState, useEffect } from 'react';
import {
  Upload,
  BookOpen,
  Calendar,
  Bell,
  Download,
  RefreshCw,
  CheckCircle,
  Clock,
  Users,
  FileText,
  
  
  Eye,
  
  AlertCircle,
  TrendingUp,
  
  Globe
} from 'lucide-react';
import { 
  topicManagementService, 
  EducationalTopic, 
  WeeklyContent, 
  TopicSchedule 
} from '../services/topicManagementService';
import { useAuthStore } from '../store/authStore';

export default function TopicManagement() {
  const { user } = useAuthStore();
  const [activeTab, setActiveTab] = useState<'upload' | 'topics' | 'schedule' | 'content'>('topics');
  
  // Topics state
  const [topics, setTopics] = useState<EducationalTopic[]>([]);
  const [selectedTopic, setSelectedTopic] = useState<EducationalTopic | null>(null);
  const [uploadMode, setUploadMode] = useState<'single' | 'bulk'>('single');
  
  // Weekly content state
  const [weeklyContents, setWeeklyContents] = useState<WeeklyContent[]>([]);
  const [schedules, setSchedules] = useState<TopicSchedule[]>([]);
  const [generatingContent, setGeneratingContent] = useState(false);
  
  // Form state
  const [topicForm, setTopicForm] = useState({
    title: '',
    category: 'plastic_surgery',
    description: '',
    targetLevels: [] as ('house_officer' | 'junior_registrar' | 'senior_registrar' | 'consultant')[],
    keywords: '',
    difficulty: 'intermediate' as 'beginner' | 'intermediate' | 'advanced',
    estimatedStudyTime: 60
  });

  const [bulkTopics, setBulkTopics] = useState('');
  const [loading, setLoading] = useState(false);

  const isAdmin = user?.role === 'consultant' || user?.role === 'admin';

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [topicsData, contentsData, schedulesData] = await Promise.all([
        topicManagementService.getAllTopics(),
        topicManagementService.getRecentWeeklyContent(10),
        topicManagementService.getUpcomingSchedules()
      ]);
      
      setTopics(topicsData);
      setWeeklyContents(contentsData);
      setSchedules(schedulesData);
    } catch (error) {
      console.error('Error loading data:', error);
    }
  };

  const handleSingleTopicUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const keywords = topicForm.keywords.split(',').map(k => k.trim()).filter(k => k);
      
      await topicManagementService.uploadTopic({
        title: topicForm.title,
        category: topicForm.category,
        description: topicForm.description,
        targetLevels: topicForm.targetLevels,
        keywords,
        difficulty: topicForm.difficulty,
        estimatedStudyTime: topicForm.estimatedStudyTime,
        uploadedBy: user?.id || 'admin'
      });

      // Reset form
      setTopicForm({
        title: '',
        category: 'plastic_surgery',
        description: '',
        targetLevels: [],
        keywords: '',
        difficulty: 'intermediate',
        estimatedStudyTime: 60
      });

      await loadData();
      alert('Topic uploaded successfully! AI content generation scheduled.');
    } catch (error) {
      console.error('Error uploading topic:', error);
      alert('Failed to upload topic');
    } finally {
      setLoading(false);
    }
  };

  const handleBulkUpload = async () => {
    setLoading(true);

    try {
      const lines = bulkTopics.split('\n').filter(line => line.trim());
      const uploadedTopics = [];

      for (const line of lines) {
        const [title, category, difficulty, levels] = line.split('|').map(s => s.trim());
        
        if (title) {
          const targetLevels = (levels || 'intern,registrar').split(',').map(l => l.trim()) as any[];
          
          await topicManagementService.uploadTopic({
            title,
            category: category || 'plastic_surgery',
            description: `Educational topic: ${title}`,
            targetLevels,
            keywords: [],
            difficulty: (difficulty || 'intermediate') as any,
            estimatedStudyTime: 60,
            uploadedBy: user?.id || 'admin'
          });
          
          uploadedTopics.push(title);
        }
      }

      setBulkTopics('');
      await loadData();
      alert(`Successfully uploaded ${uploadedTopics.length} topics!`);
    } catch (error) {
      console.error('Error bulk uploading:', error);
      alert('Failed to upload topics in bulk');
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateWeeklyContent = async (topicId: string) => {
    setGeneratingContent(true);

    try {
      await topicManagementService.generateWeeklyContent(topicId);
      await loadData();
      alert('Weekly content generated successfully! Notifications sent to users.');
    } catch (error) {
      console.error('Error generating content:', error);
      alert('Failed to generate weekly content');
    } finally {
      setGeneratingContent(false);
    }
  };

  const toggleTargetLevel = (level: 'house_officer' | 'junior_registrar' | 'senior_registrar' | 'consultant') => {
    setTopicForm(prev => ({
      ...prev,
      targetLevels: prev.targetLevels.includes(level)
        ? prev.targetLevels.filter(l => l !== level)
        : [...prev.targetLevels, level]
    }));
  };

  const getCategoryColor = (category: string) => {
    const colors: Record<string, string> = {
      plastic_surgery: 'bg-blue-100 text-blue-800',
      reconstructive: 'bg-purple-100 text-purple-800',
      aesthetic: 'bg-pink-100 text-pink-800',
      burn_care: 'bg-red-100 text-red-800',
      hand_surgery: 'bg-green-100 text-green-800',
      craniofacial: 'bg-yellow-100 text-yellow-800',
      microsurgery: 'bg-indigo-100 text-indigo-800',
      wound_care: 'bg-orange-100 text-orange-800'
    };
    return colors[category] || 'bg-gray-100 text-gray-800';
  };

  const getDifficultyColor = (difficulty: string) => {
    const colors: Record<string, string> = {
      beginner: 'bg-green-100 text-green-800',
      intermediate: 'bg-yellow-100 text-yellow-800',
      advanced: 'bg-red-100 text-red-800'
    };
    return colors[difficulty] || 'bg-gray-100 text-gray-800';
  };

  if (!isAdmin) {
    return (
      <div className="p-6">
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <div className="flex items-center space-x-2">
            <AlertCircle className="h-5 w-5 text-yellow-600" />
            <p className="text-yellow-800">
              Topic Management is restricted to administrators and consultants only.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-lg sm:text-2xl font-bold text-gray-900 flex items-center space-x-2">
              <BookOpen className="h-8 w-8 text-green-600" />
              <span>Topic Management System</span>
            </h1>
            <p className="text-gray-600 mt-2">
              Upload topics for weekly auto-generated educational content and MCQ generation
            </p>
          </div>
          <div className="flex items-center space-x-2">
            <Globe className="h-5 w-5 text-blue-600" />
            <span className="text-sm text-gray-600">WHO Best Practices</span>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex space-x-4 mt-6 border-b border-gray-200">
          <button
            onClick={() => setActiveTab('topics')}
            className={`pb-3 px-1 font-medium transition-colors ${
              activeTab === 'topics'
                ? 'text-green-600 border-b-2 border-green-600'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            <div className="flex items-center space-x-2">
              <FileText className="h-4 w-4" />
              <span>All Topics ({topics.length})</span>
            </div>
          </button>
          <button
            onClick={() => setActiveTab('upload')}
            className={`pb-3 px-1 font-medium transition-colors ${
              activeTab === 'upload'
                ? 'text-green-600 border-b-2 border-green-600'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            <div className="flex items-center space-x-2">
              <Upload className="h-4 w-4" />
              <span>Upload Topics</span>
            </div>
          </button>
          <button
            onClick={() => setActiveTab('schedule')}
            className={`pb-3 px-1 font-medium transition-colors ${
              activeTab === 'schedule'
                ? 'text-green-600 border-b-2 border-green-600'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            <div className="flex items-center space-x-2">
              <Calendar className="h-4 w-4" />
              <span>Schedule ({schedules.length})</span>
            </div>
          </button>
          <button
            onClick={() => setActiveTab('content')}
            className={`pb-3 px-1 font-medium transition-colors ${
              activeTab === 'content'
                ? 'text-green-600 border-b-2 border-green-600'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            <div className="flex items-center space-x-2">
              <TrendingUp className="h-4 w-4" />
              <span>Generated Content</span>
            </div>
          </button>
        </div>
      </div>

      {/* Upload Tab */}
      {activeTab === 'upload' && (
        <div className="bg-white rounded-lg shadow-md p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-lg font-semibold text-gray-900">Upload Topics</h2>
            <div className="flex space-x-2">
              <button
                onClick={() => setUploadMode('single')}
                className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                  uploadMode === 'single'
                    ? 'bg-green-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                Single Topic
              </button>
              <button
                onClick={() => setUploadMode('bulk')}
                className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                  uploadMode === 'bulk'
                    ? 'bg-green-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                Bulk Upload
              </button>
            </div>
          </div>

          {uploadMode === 'single' ? (
            <form onSubmit={handleSingleTopicUpload} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Topic Title *
                  </label>
                  <input
                    type="text"
                    value={topicForm.title}
                    onChange={(e) => setTopicForm({ ...topicForm, title: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
                    placeholder="e.g., Management of Diabetic Foot Ulcers"
                    required
                    title="Topic Title"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Category *
                  </label>
                  <select
                    value={topicForm.category}
                    onChange={(e) => setTopicForm({ ...topicForm, category: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
                    title="Category"
                    required
                  >
                    <option value="plastic_surgery">Plastic Surgery</option>
                    <option value="reconstructive">Reconstructive Surgery</option>
                    <option value="aesthetic">Aesthetic Surgery</option>
                    <option value="burn_care">Burn Care</option>
                    <option value="hand_surgery">Hand Surgery</option>
                    <option value="craniofacial">Craniofacial Surgery</option>
                    <option value="microsurgery">Microsurgery</option>
                    <option value="wound_care">Wound Care</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Difficulty Level *
                  </label>
                  <select
                    value={topicForm.difficulty}
                    onChange={(e) => setTopicForm({ ...topicForm, difficulty: e.target.value as any })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
                    title="Difficulty Level"
                    required
                  >
                    <option value="beginner">Beginner</option>
                    <option value="intermediate">Intermediate</option>
                    <option value="advanced">Advanced</option>
                  </select>
                </div>

                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Description
                  </label>
                  <textarea
                    value={topicForm.description}
                    onChange={(e) => setTopicForm({ ...topicForm, description: e.target.value })}
                    rows={3}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
                    placeholder="Brief description of the topic scope and objectives"
                    title="Description"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Keywords (comma-separated)
                  </label>
                  <input
                    type="text"
                    value={topicForm.keywords}
                    onChange={(e) => setTopicForm({ ...topicForm, keywords: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
                    placeholder="diabetes, wound healing, foot care"
                    title="Keywords"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Estimated Study Time (minutes)
                  </label>
                  <input
                    type="number"
                    value={topicForm.estimatedStudyTime}
                    onChange={(e) => setTopicForm({ ...topicForm, estimatedStudyTime: parseInt(e.target.value) })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
                    min="15"
                    step="15"
                    title="Estimated Study Time"
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Target Levels *
                  </label>
                  <div className="flex flex-wrap gap-2">
                    <label className="flex items-center space-x-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={topicForm.targetLevels.includes('house_officer')}
                        onChange={() => toggleTargetLevel('house_officer')}
                        className="rounded text-green-600 focus:ring-green-500"
                      />
                      <span className="text-sm">House Officers</span>
                    </label>
                    <label className="flex items-center space-x-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={topicForm.targetLevels.includes('junior_registrar')}
                        onChange={() => toggleTargetLevel('junior_registrar')}
                        className="rounded text-green-600 focus:ring-green-500"
                      />
                      <span className="text-sm">Registrars</span>
                    </label>
                    <label className="flex items-center space-x-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={topicForm.targetLevels.includes('senior_registrar')}
                        onChange={() => toggleTargetLevel('senior_registrar')}
                        className="rounded text-green-600 focus:ring-green-500"
                      />
                      <span className="text-sm">Senior Registrars</span>
                    </label>
                    <label className="flex items-center space-x-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={topicForm.targetLevels.includes('consultant')}
                        onChange={() => toggleTargetLevel('consultant')}
                        className="rounded text-green-600 focus:ring-green-500"
                      />
                      <span className="text-sm">Consultants</span>
                    </label>
                  </div>
                </div>
              </div>

              <div className="flex justify-end space-x-3 pt-4 border-t">
                <button
                  type="button"
                  onClick={() => setTopicForm({
                    title: '',
                    category: 'plastic_surgery',
                    description: '',
                    targetLevels: [],
                    keywords: '',
                    difficulty: 'intermediate',
                    estimatedStudyTime: 60
                  })}
                  className="px-4 py-2 text-gray-700 bg-gray-200 rounded-lg hover:bg-gray-300 transition-colors"
                >
                  Reset
                </button>
                <button
                  type="submit"
                  disabled={loading || topicForm.targetLevels.length === 0}
                  className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
                >
                  {loading ? (
                    <>
                      <RefreshCw className="h-4 w-4 animate-spin" />
                      <span>Uploading...</span>
                    </>
                  ) : (
                    <>
                      <Upload className="h-4 w-4" />
                      <span>Upload Topic</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          ) : (
            <div className="space-y-4">
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <h3 className="font-medium text-blue-900 mb-2">Bulk Upload Format</h3>
                <p className="text-sm text-blue-700 mb-2">
                  Enter one topic per line using this format:
                </p>
                <code className="text-xs bg-blue-100 px-2 py-1 rounded block">
                  Title | Category | Difficulty | Target Levels (comma-separated)
                </code>
                <p className="text-xs text-blue-600 mt-2">
                  Example: Burn Management | burn_care | intermediate | intern,registrar
                </p>
              </div>

              <textarea
                value={bulkTopics}
                onChange={(e) => setBulkTopics(e.target.value)}
                rows={10}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500 font-mono text-sm"
                placeholder="Diabetic Foot Care | wound_care | intermediate | intern,registrar&#10;Microvascular Free Flaps | microsurgery | advanced | registrar,consultant&#10;Cleft Lip Repair | craniofacial | intermediate | registrar"
                title="Bulk Topics"
              />

              <div className="flex justify-end">
                <button
                  onClick={handleBulkUpload}
                  disabled={loading || !bulkTopics.trim()}
                  className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
                >
                  {loading ? (
                    <>
                      <RefreshCw className="h-4 w-4 animate-spin" />
                      <span>Processing...</span>
                    </>
                  ) : (
                    <>
                      <Upload className="h-4 w-4" />
                      <span>Upload All Topics</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Topics List Tab */}
      {activeTab === 'topics' && (
        <div className="bg-white rounded-lg shadow-md p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-lg font-semibold text-gray-900">All Topics</h2>
            <button
              onClick={loadData}
              className="flex items-center space-x-2 px-4 py-2 text-green-600 hover:bg-green-50 rounded-lg transition-colors"
            >
              <RefreshCw className="h-4 w-4" />
              <span>Refresh</span>
            </button>
          </div>

          {topics.length === 0 ? (
            <div className="text-center py-12">
              <FileText className="h-12 w-12 text-gray-400 mx-auto mb-3" />
              <p className="text-gray-600">No topics uploaded yet</p>
              <button
                onClick={() => setActiveTab('upload')}
                className="mt-4 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
              >
                Upload First Topic
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {topics.map((topic) => (
                <div
                  key={topic.id}
                  className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow"
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1">
                      <h3 className="font-semibold text-gray-900 mb-2">{topic.title}</h3>
                      <div className="flex flex-wrap gap-2 mb-2">
                        <span className={`text-xs px-2 py-1 rounded-full ${getCategoryColor(topic.category)}`}>
                          {topic.category.replace('_', ' ')}
                        </span>
                        <span className={`text-xs px-2 py-1 rounded-full ${getDifficultyColor(topic.difficulty)}`}>
                          {topic.difficulty}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center space-x-1">
                      <button
                        onClick={() => setSelectedTopic(topic)}
                        className="p-2 text-gray-600 hover:text-blue-600 transition-colors"
                        title="View Details"
                      >
                        <Eye className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => handleGenerateWeeklyContent(topic.id)}
                        disabled={generatingContent}
                        className="p-2 text-gray-600 hover:text-green-600 transition-colors disabled:opacity-50"
                        title="Generate Weekly Content"
                      >
                        <RefreshCw className={`h-4 w-4 ${generatingContent ? 'animate-spin' : ''}`} />
                      </button>
                    </div>
                  </div>

                  {topic.description && (
                    <p className="text-sm text-gray-600 mb-3 line-clamp-2">{topic.description}</p>
                  )}

                  <div className="flex items-center justify-between text-xs text-gray-500">
                    <div className="flex items-center space-x-4">
                      <span className="flex items-center space-x-1">
                        <Users className="h-3 w-3" />
                        <span>{topic.targetLevels.length} levels</span>
                      </span>
                      <span className="flex items-center space-x-1">
                        <Clock className="h-3 w-3" />
                        <span>{topic.estimatedStudyTime}min</span>
                      </span>
                    </div>
                    <span className={`px-2 py-1 rounded-full ${
                      topic.status === 'active' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                    }`}>
                      {topic.status}
                    </span>
                  </div>

                  {topic.weeklyContentGenerated && (
                    <div className="mt-3 pt-3 border-t border-gray-200">
                      <div className="flex items-center space-x-2 text-xs text-green-600">
                        <CheckCircle className="h-3 w-3" />
                        <span>Weekly content generated</span>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Schedule Tab */}
      {activeTab === 'schedule' && (
        <div className="bg-white rounded-lg shadow-md p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-6">Weekly Content Schedule</h2>
          
          {schedules.length === 0 ? (
            <div className="text-center py-12">
              <Calendar className="h-12 w-12 text-gray-400 mx-auto mb-3" />
              <p className="text-gray-600">No scheduled content yet</p>
            </div>
          ) : (
            <div className="space-y-4">
              {schedules.map((schedule) => {
                const topic = topics.find(t => t.id === schedule.topicId);
                return (
                  <div
                    key={schedule.id}
                    className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <h3 className="font-semibold text-gray-900 mb-2">
                          {topic?.title || 'Unknown Topic'}
                        </h3>
                        <div className="flex items-center space-x-4 text-sm text-gray-600">
                          <span className="flex items-center space-x-1">
                            <Calendar className="h-4 w-4" />
                            <span>Week of {new Date(schedule.scheduledWeek).toLocaleDateString()}</span>
                          </span>
                          <span className="flex items-center space-x-1">
                            <Bell className="h-4 w-4" />
                            <span>{schedule.notificationsSent ? 'Sent' : 'Pending'}</span>
                          </span>
                        </div>
                      </div>
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                        schedule.status === 'published' ? 'bg-green-100 text-green-800' :
                        schedule.status === 'scheduled' ? 'bg-blue-100 text-blue-800' :
                        'bg-gray-100 text-gray-800'
                      }`}>
                        {schedule.status}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Generated Content Tab */}
      {activeTab === 'content' && (
        <div className="bg-white rounded-lg shadow-md p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-6">Generated Weekly Content</h2>
          
          {weeklyContents.length === 0 ? (
            <div className="text-center py-12">
              <TrendingUp className="h-12 w-12 text-gray-400 mx-auto mb-3" />
              <p className="text-gray-600">No content generated yet</p>
            </div>
          ) : (
            <div className="space-y-4">
              {weeklyContents.map((content) => {
                const topic = topics.find(t => t.id === content.topicId);
                return (
                  <div
                    key={content.id}
                    className="border border-gray-200 rounded-lg p-4"
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex-1">
                        <h3 className="font-semibold text-gray-900 mb-1">
                          {topic?.title || 'Unknown Topic'}
                        </h3>
                        <p className="text-sm text-gray-600">
                          Generated: {new Date(content.generatedAt).toLocaleDateString()}
                        </p>
                      </div>
                      <button
                        className="flex items-center space-x-2 px-3 py-1 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                      >
                        <Download className="h-4 w-4" />
                        <span className="text-sm">Download</span>
                      </button>
                    </div>

                    <div className="bg-gray-50 rounded-lg p-4 mb-3">
                      <p className="text-sm text-gray-700 line-clamp-3">
                        {typeof content.content === 'string' ? content.content.substring(0, 200) : String(content.content || '').substring(0, 200)}...
                      </p>
                    </div>

                    <div className="flex items-center justify-between text-xs text-gray-500">
                      <div className="flex items-center space-x-4">
                        <span>{content.references.length} references</span>
                        <span>{content.learningObjectives.length} objectives</span>
                      </div>
                      <div className="flex items-center space-x-1">
                        <CheckCircle className="h-3 w-3 text-green-600" />
                        <span>WHO Guidelines</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Topic Detail Modal */}
      {selectedTopic && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-0 sm:p-4">
          <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex items-start justify-between mb-4">
                <h2 className="text-xl font-bold text-gray-900">{selectedTopic.title}</h2>
                <button
                  onClick={() => setSelectedTopic(null)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  ×
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <span className="text-sm font-medium text-gray-600">Category:</span>
                  <p className="text-gray-900">{selectedTopic.category.replace('_', ' ')}</p>
                </div>

                {selectedTopic.description && (
                  <div>
                    <span className="text-sm font-medium text-gray-600">Description:</span>
                    <p className="text-gray-900">{selectedTopic.description}</p>
                  </div>
                )}

                  <div>
                    <span className="text-sm font-medium text-gray-600">Target Levels:</span>
                    <div className="flex flex-wrap gap-2 mt-1">
                      {selectedTopic.targetLevels.map((level: string) => (
                        <span key={level} className="px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded-full">
                          {level}
                        </span>
                      ))}
                    </div>
                  </div>

                  {selectedTopic.keywords.length > 0 && (
                    <div>
                      <span className="text-sm font-medium text-gray-600">Keywords:</span>
                      <div className="flex flex-wrap gap-2 mt-1">
                        {selectedTopic.keywords.map((keyword: string, idx: number) => (
                          <span key={idx} className="px-2 py-1 bg-gray-100 text-gray-800 text-xs rounded-full">
                            {keyword}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-4 border-t">
                  <div>
                    <span className="text-sm font-medium text-gray-600">Difficulty:</span>
                    <p className="text-gray-900 capitalize">{selectedTopic.difficulty}</p>
                  </div>
                  <div>
                    <span className="text-sm font-medium text-gray-600">Study Time:</span>
                    <p className="text-gray-900">{selectedTopic.estimatedStudyTime} minutes</p>
                  </div>
                  <div>
                    <span className="text-sm font-medium text-gray-600">Uploaded By:</span>
                    <p className="text-gray-900">{selectedTopic.uploadedBy}</p>
                  </div>
                  <div>
                    <span className="text-sm font-medium text-gray-600">Upload Date:</span>
                    <p className="text-gray-900">
                      {new Date(selectedTopic.uploadedAt).toLocaleDateString()}
                    </p>
                  </div>
                </div>
              </div>

              <div className="flex justify-end space-x-3 mt-6 pt-4 border-t">
                <button
                  onClick={() => setSelectedTopic(null)}
                  className="px-4 py-2 text-gray-700 bg-gray-200 rounded-lg hover:bg-gray-300 transition-colors"
                >
                  Close
                </button>
                <button
                  onClick={() => {
                    handleGenerateWeeklyContent(selectedTopic.id);
                    setSelectedTopic(null);
                  }}
                  className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors flex items-center space-x-2"
                >
                  <RefreshCw className="h-4 w-4" />
                  <span>Generate Content</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

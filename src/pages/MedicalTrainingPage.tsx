import React, { useState, useMemo, useEffect } from 'react';
import { 
  GraduationCap, 
  Book, 
  ChevronRight, 
  ChevronDown, 
  Users, 
  Award,
  FileText,
  CheckCircle,
  Clock,
  Search,
  ArrowLeft,
  ClipboardCheck,
  TrendingUp
} from 'lucide-react';
import { 
  medicalTrainingService, 
  CMEModule, 
  CMETopic, 
  TrainingLevel 
} from '../services/medicalTrainingService';
import { performanceService } from '../services/performanceService';
import CMEArticleViewer from '../components/training/CMEArticleViewer';
import { CBTPage } from '../components/cbt';
import { PerformanceDashboard } from '../components/performance';

type TabType = 'house_officer' | 'junior_resident' | 'senior_resident';

const MedicalTrainingPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<TabType>('house_officer');
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedModules, setExpandedModules] = useState<Set<string>>(new Set(['ho-module-1']));
  const [selectedTopic, setSelectedTopic] = useState<CMETopic | null>(null);
  const [completedTopics, setCompletedTopics] = useState<Set<string>>(new Set());
  const [showCBT, setShowCBT] = useState(false);
  const [showPerformance, setShowPerformance] = useState(false);

  // Record login on component mount
  useEffect(() => {
    performanceService.recordLogin();
  }, []);

  const modules = useMemo(() => {
    return medicalTrainingService.getModulesByLevel(activeTab);
  }, [activeTab]);

  const filteredModules = useMemo(() => {
    if (!searchQuery.trim()) return modules;
    const query = searchQuery.toLowerCase();
    return modules.map(module => ({
      ...module,
      topics: module.topics.filter(topic => 
        topic.title.toLowerCase().includes(query) ||
        (topic.article?.overview || '').toLowerCase().includes(query)
      )
    })).filter(module => module.topics.length > 0);
  }, [modules, searchQuery]);

  const toggleModule = (moduleId: string) => {
    const newExpanded = new Set(expandedModules);
    if (newExpanded.has(moduleId)) {
      newExpanded.delete(moduleId);
    } else {
      newExpanded.add(moduleId);
    }
    setExpandedModules(newExpanded);
  };

  const handleTopicSelect = (topic: CMETopic) => {
    setSelectedTopic(topic);
  };

  const handleTopicComplete = (topicId: string) => {
    setCompletedTopics(prev => new Set([...prev, topicId]));
  };

  const totalTopics = modules.reduce((sum, m) => sum + m.topics.length, 0);
  const completedCount = Array.from(completedTopics).filter(id => 
    modules.some(m => m.topics.some(t => t.id === id))
  ).length;

  const tabs = [
    { 
      id: 'house_officer' as TabType, 
      label: 'House Officer', 
      icon: Users, 
      color: 'bg-blue-500',
      description: 'Intern training modules'
    },
    { 
      id: 'junior_resident' as TabType, 
      label: 'Junior Resident', 
      icon: Award, 
      color: 'bg-green-500',
      description: 'Registrar training'
    },
    { 
      id: 'senior_resident' as TabType, 
      label: 'Senior Resident', 
      icon: GraduationCap, 
      color: 'bg-purple-500',
      description: 'Advanced surgical training'
    }
  ];

  if (selectedTopic) {
    return (
      <CMEArticleViewer
        topic={selectedTopic}
        onBack={() => setSelectedTopic(null)}
        onComplete={() => handleTopicComplete(selectedTopic.id)}
        isCompleted={completedTopics.has(selectedTopic.id)}
      />
    );
  }

  if (showCBT) {
    return (
      <CBTPage
        level={activeTab as TrainingLevel}
        onBack={() => setShowCBT(false)}
      />
    );
  }

  if (showPerformance) {
    return (
      <PerformanceDashboard
        level={activeTab as TrainingLevel}
        onBack={() => setShowPerformance(false)}
      />
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-gradient-to-r from-green-600 to-green-700 text-white">
        <div className="max-w-7xl mx-auto px-4 py-8">
          <div className="flex items-center gap-3 mb-4">
            <GraduationCap className="h-10 w-10" />
            <div>
              <h1 className="text-3xl font-bold">Medical Training</h1>
              <p className="text-green-100">Comprehensive CME for Surgical Practice</p>
            </div>
          </div>
          
          {/* Stats Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6">
            <div className="bg-white/10 backdrop-blur rounded-lg p-4">
              <div className="flex items-center gap-3">
                <Book className="h-8 w-8" />
                <div>
                  <p className="text-green-100 text-sm">Total Topics</p>
                  <p className="text-2xl font-bold">{totalTopics}</p>
                </div>
              </div>
            </div>
            <div className="bg-white/10 backdrop-blur rounded-lg p-4">
              <div className="flex items-center gap-3">
                <CheckCircle className="h-8 w-8" />
                <div>
                  <p className="text-green-100 text-sm">Completed</p>
                  <p className="text-2xl font-bold">{completedCount}</p>
                </div>
              </div>
            </div>
            <div className="bg-white/10 backdrop-blur rounded-lg p-4">
              <div className="flex items-center gap-3">
                <Clock className="h-8 w-8" />
                <div>
                  <p className="text-green-100 text-sm">Progress</p>
                  <p className="text-2xl font-bold">
                    {totalTopics > 0 ? Math.round((completedCount / totalTopics) * 100) : 0}%
                  </p>
                </div>
              </div>
            </div>
          </div>
          
          {/* CBT Button */}
          <button
            onClick={() => setShowCBT(true)}
            className="mt-6 w-full md:w-auto flex items-center justify-center gap-3 px-6 py-4 bg-white/20 hover:bg-white/30 backdrop-blur rounded-xl font-semibold transition-all group"
          >
            <ClipboardCheck className="h-6 w-6" />
            <div className="text-left">
              <p className="font-bold">Take Weekly CBT</p>
              <p className="text-sm text-white/80">Computer-Based Test • 25 MCQs • 10 min</p>
            </div>
            <ChevronRight className="h-5 w-5 ml-2 group-hover:translate-x-1 transition-transform" />
          </button>
          
          {/* Performance Dashboard Button */}
          <button
            onClick={() => setShowPerformance(true)}
            className="mt-6 md:mt-0 md:ml-4 w-full md:w-auto flex items-center justify-center gap-3 px-6 py-4 bg-white/20 hover:bg-white/30 backdrop-blur rounded-xl font-semibold transition-all group"
          >
            <TrendingUp className="h-6 w-6" />
            <div className="text-left">
              <p className="font-bold">Performance Dashboard</p>
              <p className="text-sm text-white/80">Track progress • Sign-out eligibility</p>
            </div>
            <ChevronRight className="h-5 w-5 ml-2 group-hover:translate-x-1 transition-transform" />
          </button>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-6">
        {/* Level Tabs */}
        <div className="flex flex-wrap gap-3 mb-6">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-3 rounded-lg font-medium transition-all
                ${activeTab === tab.id 
                  ? `${tab.color} text-white shadow-lg` 
                  : 'bg-white text-gray-600 hover:bg-gray-100 shadow'}`}
            >
              <tab.icon className="h-5 w-5" />
              <div className="text-left">
                <p className="font-semibold">{tab.label}</p>
                <p className={`text-xs ${activeTab === tab.id ? 'text-white/80' : 'text-gray-400'}`}>
                  {tab.description}
                </p>
              </div>
            </button>
          ))}
        </div>

        {/* Search Bar */}
        <div className="relative mb-6">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
          <input
            type="text"
            placeholder="Search topics..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
          />
        </div>

        {/* Modules List */}
        {filteredModules.length === 0 ? (
          <div className="bg-white rounded-lg shadow p-8 text-center">
            <GraduationCap className="h-16 w-16 mx-auto text-gray-300 mb-4" />
            <h3 className="text-lg font-medium text-gray-600 mb-2">
              {activeTab === 'house_officer' && searchQuery 
                ? 'No topics match your search'
                : 'Content Coming Soon'
              }
            </h3>
            <p className="text-gray-500">
              {activeTab === 'house_officer' && searchQuery
                ? 'Try a different search term'
                : `${tabs.find(t => t.id === activeTab)?.label} CME content is being developed.`
              }
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {filteredModules.map(module => (
              <div key={module.id} className="bg-white rounded-lg shadow overflow-hidden">
                {/* Module Header */}
                <button
                  onClick={() => toggleModule(module.id)}
                  className="w-full flex items-center justify-between p-4 hover:bg-gray-50 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className="bg-green-100 p-2 rounded-lg">
                      <Book className="h-6 w-6 text-green-600" />
                    </div>
                    <div className="text-left">
                      <h3 className="font-semibold text-gray-900">{module.title}</h3>
                      <p className="text-sm text-gray-500">
                        {module.topics.length} topics • 
                        {module.topics.filter(t => completedTopics.has(t.id)).length} completed
                      </p>
                    </div>
                  </div>
                  {expandedModules.has(module.id) ? (
                    <ChevronDown className="h-5 w-5 text-gray-400" />
                  ) : (
                    <ChevronRight className="h-5 w-5 text-gray-400" />
                  )}
                </button>

                {/* Module Topics */}
                {expandedModules.has(module.id) && (
                  <div className="border-t border-gray-100">
                    {module.topics.map((topic, index) => (
                      <button
                        key={topic.id}
                        onClick={() => handleTopicSelect(topic)}
                        className="w-full flex items-center justify-between p-4 hover:bg-green-50 transition-colors border-b border-gray-50 last:border-b-0"
                      >
                        <div className="flex items-center gap-3">
                          <span className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium
                            ${completedTopics.has(topic.id) 
                              ? 'bg-green-500 text-white' 
                              : 'bg-gray-100 text-gray-500'}`}
                          >
                            {completedTopics.has(topic.id) ? (
                              <CheckCircle className="h-4 w-4" />
                            ) : (
                              index + 1
                            )}
                          </span>
                          <div className="text-left">
                            <p className={`font-medium ${completedTopics.has(topic.id) ? 'text-green-700' : 'text-gray-700'}`}>
                              {topic.title}
                            </p>
                            {topic.article && (
                              <p className="text-xs text-gray-400 mt-0.5">
                                {topic.article.sections?.length || 0} sections • 
                                {topic.article.selfAssessment?.length || 0} MCQs
                              </p>
                            )}
                          </div>
                        </div>
                        <ChevronRight className="h-4 w-4 text-gray-400" />
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default MedicalTrainingPage;

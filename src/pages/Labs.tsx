import React, { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { 
  TestTube, 
  Upload, 
  Search, 
  TrendingUp, 
  AlertTriangle, 
  CheckCircle, 
  Clock, 
  FileText, 
  Brain, 
  Plus, 
  Eye,
  BarChart3,
  Activity,
  Zap
} from 'lucide-react';
import { 
  labService, 
  LabInvestigation, 
  LabResult, 
  LabTest, 
  LabCategory, 
  LabTrend,
  GFRCalculation,
  GFRTrend,
  PatientDemographics
} from '../services/labService';
import { db } from '../db/database';

type LabTab = 'investigations' | 'results' | 'upload' | 'trends' | 'requests' | 'gfr';

export default function Labs() {
  const [activeTab, setActiveTab] = useState<LabTab>('investigations');
  const [investigations, setInvestigations] = useState<LabInvestigation[]>([]);
  const [results, setResults] = useState<LabResult[]>([]);
  const [gfrCalculations, setGfrCalculations] = useState<GFRCalculation[]>([]);
  const [gfrTrend, setGfrTrend] = useState<GFRTrend | null>(null);
  const [selectedPatient, setSelectedPatient] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState('');
  const [labStats, setLabStats] = useState<any>(null);

  useEffect(() => {
    loadLabData();
    loadLabStatistics();
  }, [selectedPatient]);

  const loadLabData = async () => {
    try {
      const [investigationsData, resultsData] = await Promise.all([
        labService.getLabInvestigations(selectedPatient),
        labService.getLabResults(selectedPatient)
      ]);
      
      setInvestigations(investigationsData);
      setResults(resultsData);

      // Load GFR data if patient is selected
      if (selectedPatient) {
        loadGFRData();
      }
    } catch (error) {
      console.error('Error loading lab data:', error);
    }
  };

  const loadGFRData = async () => {
    try {
      const [gfrHistory, gfrTrendData] = await Promise.all([
        labService.getGFRHistory(selectedPatient),
        labService.generateGFRTrend(selectedPatient, 12)
      ]);
      
      setGfrCalculations(gfrHistory);
      setGfrTrend(gfrTrendData);
    } catch (error) {
      console.error('Error loading GFR data:', error);
    }
  };

  const loadLabStatistics = async () => {
    try {
      const stats = await labService.getLabStatistics(selectedPatient);
      setLabStats(stats);
    } catch (error) {
      console.error('Error loading lab statistics:', error);
    }
  };

  const TabButton = ({ tab, label, icon: Icon }: { tab: LabTab; label: string; icon: any }) => (
    <button
      onClick={() => setActiveTab(tab)}
      className={`flex items-center space-x-2 px-6 py-3 rounded-lg font-medium transition-colors ${
        activeTab === tab
          ? 'bg-green-600 text-white'
          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
      }`}
    >
      <Icon className="h-5 w-5" />
      <span>{label}</span>
    </button>
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold text-gray-900">Laboratory Management</h1>
          <div className="flex items-center space-x-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
              <input
                type="text"
                placeholder="Search labs..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
              />
            </div>
            <select
              value={selectedPatient}
              onChange={(e) => setSelectedPatient(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
            >
              <option value="">All Patients</option>
              <option value="patient1">John Doe</option>
              <option value="patient2">Jane Smith</option>
              <option value="patient3">Mike Johnson</option>
            </select>
          </div>
        </div>

        {/* Lab Statistics */}
        {labStats && (
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-6">
            <div className="bg-blue-50 p-4 rounded-lg">
              <div className="flex items-center space-x-2">
                <TestTube className="h-5 w-5 text-blue-600" />
                <span className="text-sm font-medium text-blue-600">Total</span>
              </div>
              <p className="text-2xl font-bold text-blue-900">{labStats.totalInvestigations}</p>
            </div>
            <div className="bg-green-50 p-4 rounded-lg">
              <div className="flex items-center space-x-2">
                <CheckCircle className="h-5 w-5 text-green-600" />
                <span className="text-sm font-medium text-green-600">Completed</span>
              </div>
              <p className="text-2xl font-bold text-green-900">{labStats.completedResults}</p>
            </div>
            <div className="bg-yellow-50 p-4 rounded-lg">
              <div className="flex items-center space-x-2">
                <Clock className="h-5 w-5 text-yellow-600" />
                <span className="text-sm font-medium text-yellow-600">Pending</span>
              </div>
              <p className="text-2xl font-bold text-yellow-900">{labStats.pendingResults}</p>
            </div>
            <div className="bg-orange-50 p-4 rounded-lg">
              <div className="flex items-center space-x-2">
                <AlertTriangle className="h-5 w-5 text-orange-600" />
                <span className="text-sm font-medium text-orange-600">Abnormal</span>
              </div>
              <p className="text-2xl font-bold text-orange-900">{labStats.abnormalResults}</p>
            </div>
            <div className="bg-red-50 p-4 rounded-lg">
              <div className="flex items-center space-x-2">
                <Zap className="h-5 w-5 text-red-600" />
                <span className="text-sm font-medium text-red-600">Critical</span>
              </div>
              <p className="text-2xl font-bold text-red-900">{labStats.criticalResults}</p>
            </div>
          </div>
        )}

        {/* Tab Navigation */}
        <div className="flex space-x-4 overflow-x-auto">
          <TabButton tab="investigations" label="Investigations" icon={TestTube} />
          <TabButton tab="results" label="Results" icon={FileText} />
          <TabButton tab="upload" label="Upload Results" icon={Upload} />
          <TabButton tab="trends" label="Trends" icon={TrendingUp} />
          <TabButton tab="gfr" label="GFR Analysis" icon={Activity} />
          <TabButton tab="requests" label="New Request" icon={Plus} />
        </div>
      </div>

      {/* Content Area */}
      {activeTab === 'investigations' && (
        <InvestigationsSection 
          investigations={investigations}
          onRefresh={loadLabData}
          searchQuery={searchQuery}
        />
      )}

      {activeTab === 'results' && (
        <ResultsSection 
          results={results}
          investigations={investigations}
          onRefresh={loadLabData}
          searchQuery={searchQuery}
        />
      )}

      {activeTab === 'upload' && (
        <UploadSection 
          investigations={investigations}
          onRefresh={loadLabData}
        />
      )}

      {activeTab === 'trends' && (
        <TrendsSection 
          selectedPatient={selectedPatient}
        />
      )}

      {activeTab === 'gfr' && (
        <GFRSection 
          patientId={selectedPatient}
          gfrCalculations={gfrCalculations}
          gfrTrend={gfrTrend}
          onRefresh={loadGFRData}
        />
      )}

      {activeTab === 'requests' && (
        <RequestSection 
          onRefresh={loadLabData}
        />
      )}
    </div>
  );
}

// Investigations Section Component
const InvestigationsSection = ({ investigations, onRefresh, searchQuery }: any) => {
  const filteredInvestigations = investigations.filter((inv: LabInvestigation) =>
    inv.patient_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    inv.clinical_indication.toLowerCase().includes(searchQuery.toLowerCase()) ||
    inv.requested_by.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="h-5 w-5 text-green-600" />;
      case 'processing':
        return <Clock className="h-5 w-5 text-blue-600" />;
      case 'cancelled':
        return <AlertTriangle className="h-5 w-5 text-red-600" />;
      default:
        return <TestTube className="h-5 w-5 text-gray-600" />;
    }
  };

  const getUrgencyColor = (urgency: string) => {
    switch (urgency) {
      case 'stat':
        return 'text-red-600 bg-red-100';
      case 'urgent':
        return 'text-orange-600 bg-orange-100';
      default:
        return 'text-green-600 bg-green-100';
    }
  };

  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-semibold text-gray-900">Lab Investigations</h2>
        <span className="text-sm text-gray-600">{filteredInvestigations.length} investigations</span>
      </div>

      <div className="space-y-4">
        {filteredInvestigations.map((investigation: LabInvestigation) => (
          <div key={investigation.id} className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center space-x-3">
                {getStatusIcon(investigation.status)}
                <div>
                  <h3 className="font-semibold text-gray-900">{investigation.patient_name}</h3>
                  <p className="text-sm text-gray-600">{format(investigation.request_date, 'MMM d, yyyy')}</p>
                </div>
              </div>
              <div className="flex items-center space-x-2">
                <span className={`px-2 py-1 rounded-full text-xs font-medium ${getUrgencyColor(investigation.urgency)}`}>
                  {investigation.urgency.toUpperCase()}
                </span>
                <button className="p-2 text-gray-600 hover:text-blue-600 transition-colors">
                  <Eye className="h-4 w-4" />
                </button>
              </div>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-3">
              <div>
                <span className="text-sm font-medium text-gray-500">Requested by:</span>
                <p className="text-sm text-gray-900">{investigation.requested_by}</p>
              </div>
              <div>
                <span className="text-sm font-medium text-gray-500">Tests:</span>
                <p className="text-sm text-gray-900">{investigation.tests.length} tests</p>
              </div>
              <div>
                <span className="text-sm font-medium text-gray-500">Clinical Indication:</span>
                <p className="text-sm text-gray-900">{investigation.clinical_indication}</p>
              </div>
            </div>

            {/* Test List */}
            <div className="border-t pt-3">
              <div className="flex flex-wrap gap-2">
                {investigation.tests.slice(0, 3).map((test: LabTest) => (
                  <span key={test.id} className="px-2 py-1 bg-gray-100 text-gray-700 text-xs rounded">
                    {test.test_name}
                  </span>
                ))}
                {investigation.tests.length > 3 && (
                  <span className="px-2 py-1 bg-gray-100 text-gray-700 text-xs rounded">
                    +{investigation.tests.length - 3} more
                  </span>
                )}
              </div>
            </div>

            <div className="flex items-center justify-between mt-3">
              <span className="text-sm text-gray-600">
                {investigation.collection_date 
                  ? `Collected: ${format(investigation.collection_date, 'MMM d, yyyy')}`
                  : 'Not collected yet'
                }
              </span>
              <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                investigation.status === 'completed' ? 'bg-green-100 text-green-800' :
                investigation.status === 'processing' ? 'bg-blue-100 text-blue-800' :
                investigation.status === 'cancelled' ? 'bg-red-100 text-red-800' :
                'bg-gray-100 text-gray-800'
              }`}>
                {investigation.status.toUpperCase()}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

// Results Section Component
const ResultsSection = ({ results, investigations, onRefresh, searchQuery }: any) => {
  const [selectedResult, setSelectedResult] = useState<LabResult | null>(null);

  const filteredResults = results.filter((result: LabResult) =>
    result.test_id.toLowerCase().includes(searchQuery.toLowerCase()) ||
    result.result_value.toLowerCase().includes(searchQuery.toLowerCase()) ||
    result.ai_interpretation?.interpretation_text.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const getAbnormalityColor = (flag: string) => {
    switch (flag) {
      case 'critical_high':
      case 'critical_low':
        return 'text-red-600 bg-red-100';
      case 'high':
      case 'low':
        return 'text-orange-600 bg-orange-100';
      case 'abnormal':
        return 'text-yellow-600 bg-yellow-100';
      default:
        return 'text-green-600 bg-green-100';
    }
  };

  const getRiskLevelColor = (level: string) => {
    switch (level) {
      case 'critical':
        return 'text-red-600 bg-red-100';
      case 'high':
        return 'text-orange-600 bg-orange-100';
      case 'moderate':
        return 'text-yellow-600 bg-yellow-100';
      default:
        return 'text-green-600 bg-green-100';
    }
  };

  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-semibold text-gray-900">Lab Results</h2>
        <span className="text-sm text-gray-600">{filteredResults.length} results</span>
      </div>

      <div className="space-y-4">
        {filteredResults.map((result: LabResult) => (
          <div key={result.id} className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center space-x-3">
                <TestTube className="h-5 w-5 text-blue-600" />
                <div>
                  <h3 className="font-semibold text-gray-900">{result.test_id}</h3>
                  <p className="text-sm text-gray-600">{format(result.result_date, 'MMM d, yyyy HH:mm')}</p>
                </div>
              </div>
              <div className="flex items-center space-x-2">
                <span className={`px-2 py-1 rounded-full text-xs font-medium ${getAbnormalityColor(result.abnormal_flag)}`}>
                  {result.abnormal_flag.replace('_', ' ').toUpperCase()}
                </span>
                <button 
                  onClick={() => setSelectedResult(result)}
                  className="p-2 text-gray-600 hover:text-blue-600 transition-colors"
                >
                  <Eye className="h-4 w-4" />
                </button>
              </div>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-3">
              <div>
                <span className="text-sm font-medium text-gray-500">Result:</span>
                <p className="text-lg font-semibold text-gray-900">{result.result_value} {result.unit}</p>
              </div>
              <div>
                <span className="text-sm font-medium text-gray-500">Reference Range:</span>
                <p className="text-sm text-gray-900">{result.reference_range}</p>
              </div>
              <div>
                <span className="text-sm font-medium text-gray-500">Lab Technician:</span>
                <p className="text-sm text-gray-900">{result.lab_technician}</p>
              </div>
              <div>
                <span className="text-sm font-medium text-gray-500">Verified:</span>
                <p className="text-sm text-gray-900">
                  {result.verified_by ? `${result.verified_by}` : 'Pending'}
                </p>
              </div>
            </div>

            {/* AI Interpretation */}
            {result.ai_interpretation && (
              <div className="border-t pt-3">
                <div className="flex items-center space-x-2 mb-2">
                  <Brain className="h-4 w-4 text-purple-600" />
                  <span className="text-sm font-medium text-purple-600">AI Interpretation</span>
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${getRiskLevelColor(result.ai_interpretation.risk_level)}`}>
                    {result.ai_interpretation.risk_level.toUpperCase()}
                  </span>
                </div>
                <p className="text-sm text-gray-700 mb-2">{result.ai_interpretation.interpretation_text}</p>
                <p className="text-sm text-gray-600">{result.ai_interpretation.clinical_significance}</p>
                
                {result.ai_interpretation.suggested_actions.length > 0 && (
                  <div className="mt-2">
                    <span className="text-xs font-medium text-gray-500">Suggested Actions:</span>
                    <ul className="text-xs text-gray-600 ml-4">
                      {result.ai_interpretation.suggested_actions.map((action, index) => (
                        <li key={index} className="list-disc">{action}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}

            {/* File Attachments */}
            {result.file_attachments && result.file_attachments.length > 0 && (
              <div className="border-t pt-3 mt-3">
                <span className="text-sm font-medium text-gray-500">Attachments:</span>
                <div className="flex flex-wrap gap-2 mt-1">
                  {result.file_attachments.map((file) => (
                    <a
                      key={file.id}
                      href={file.file_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center space-x-1 px-2 py-1 bg-blue-100 text-blue-700 text-xs rounded hover:bg-blue-200 transition-colors"
                    >
                      <FileText className="h-3 w-3" />
                      <span>{file.file_name}</span>
                    </a>
                  ))}
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Result Detail Modal */}
      {selectedResult && (
        <ResultDetailModal 
          result={selectedResult}
          onClose={() => setSelectedResult(null)}
        />
      )}
    </div>
  );
};

// Upload Section Component
const UploadSection = ({ investigations, onRefresh }: any) => {
  const [formData, setFormData] = useState({
    investigation_id: '',
    test_id: '',
    result_value: '',
    unit: '',
    reference_range: '',
    abnormal_flag: 'normal',
    lab_technician: '',
    comments: ''
  });
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setUploading(true);
    
    try {
      const resultId = await labService.addLabResult({
        ...formData,
        patient_id: investigations.find((inv: any) => inv.id === formData.investigation_id)?.patient_id || '',
        result_date: new Date(),
        verified_by: undefined,
        verified_date: undefined,
        abnormal_flag: formData.abnormal_flag as 'normal' | 'high' | 'low' | 'critical_high' | 'critical_low' | 'abnormal'
      });

      if (selectedFile) {
        await labService.uploadLabFile(selectedFile, resultId, formData.lab_technician);
      }

      // Reset form
      setFormData({
        investigation_id: '',
        test_id: '',
        result_value: '',
        unit: '',
        reference_range: '',
        abnormal_flag: 'normal',
        lab_technician: '',
        comments: ''
      });
      setSelectedFile(null);
      onRefresh();
    } catch (error) {
      console.error('Error uploading result:', error);
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      <div className="flex items-center space-x-3 mb-6">
        <Upload className="h-6 w-6 text-green-600" />
        <h2 className="text-xl font-semibold text-gray-900">Upload Lab Results</h2>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Investigation</label>
            <select
              value={formData.investigation_id}
              onChange={(e) => setFormData({ ...formData, investigation_id: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
              required
            >
              <option value="">Select Investigation</option>
              {investigations.map((inv: LabInvestigation) => (
                <option key={inv.id} value={inv.id}>
                  {inv.patient_name} - {format(inv.request_date, 'MMM d, yyyy')}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Test</label>
            <input
              type="text"
              value={formData.test_id}
              onChange={(e) => setFormData({ ...formData, test_id: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
              placeholder="e.g., FBC, U&E, LFT"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Result Value</label>
            <input
              type="text"
              value={formData.result_value}
              onChange={(e) => setFormData({ ...formData, result_value: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
              placeholder="e.g., 5.2, Normal, Positive"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Unit</label>
            <input
              type="text"
              value={formData.unit}
              onChange={(e) => setFormData({ ...formData, unit: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
              placeholder="e.g., mg/dL, mmol/L, %"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Reference Range</label>
            <input
              type="text"
              value={formData.reference_range}
              onChange={(e) => setFormData({ ...formData, reference_range: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
              placeholder="e.g., 3.5-5.0 mg/dL"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Abnormal Flag</label>
            <select
              value={formData.abnormal_flag}
              onChange={(e) => setFormData({ ...formData, abnormal_flag: e.target.value as any })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
            >
              <option value="normal">Normal</option>
              <option value="high">High</option>
              <option value="low">Low</option>
              <option value="critical_high">Critical High</option>
              <option value="critical_low">Critical Low</option>
              <option value="abnormal">Abnormal</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Lab Technician</label>
            <input
              type="text"
              value={formData.lab_technician}
              onChange={(e) => setFormData({ ...formData, lab_technician: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Attach File (Optional)</label>
            <input
              type="file"
              onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
              accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Comments (Optional)</label>
          <textarea
            value={formData.comments}
            onChange={(e) => setFormData({ ...formData, comments: e.target.value })}
            rows={3}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
            placeholder="Additional comments about the result..."
          />
        </div>

        <div className="flex justify-end space-x-3">
          <button
            type="button"
            onClick={() => {
              setFormData({
                investigation_id: '',
                test_id: '',
                result_value: '',
                unit: '',
                reference_range: '',
                abnormal_flag: 'normal',
                lab_technician: '',
                comments: ''
              });
              setSelectedFile(null);
            }}
            className="px-4 py-2 text-gray-700 bg-gray-200 rounded-lg hover:bg-gray-300 transition-colors"
          >
            Clear
          </button>
          <button
            type="submit"
            disabled={uploading}
            className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50"
          >
            {uploading ? 'Uploading...' : 'Upload Result'}
          </button>
        </div>
      </form>
    </div>
  );
};

// Trends Section Component
const TrendsSection = ({ selectedPatient }: any) => {
  const [trendData, setTrendData] = useState<LabTrend[]>([]);
  const [selectedTest, setSelectedTest] = useState('');
  const [timeRange, setTimeRange] = useState(6);

  useEffect(() => {
    if (selectedPatient && selectedTest) {
      loadTrendData();
    }
  }, [selectedPatient, selectedTest, timeRange]);

  const loadTrendData = async () => {
    try {
      const trend = await labService.getLabTrends(selectedPatient, selectedTest, timeRange);
      setTrendData([trend]);
    } catch (error) {
      console.error('Error loading trend data:', error);
    }
  };

  const getTrendIcon = (direction: string) => {
    switch (direction) {
      case 'improving':
        return <TrendingUp className="h-5 w-5 text-green-600" />;
      case 'worsening':
        return <TrendingUp className="h-5 w-5 text-red-600 transform rotate-180" />;
      case 'fluctuating':
        return <Activity className="h-5 w-5 text-orange-600" />;
      default:
        return <BarChart3 className="h-5 w-5 text-blue-600" />;
    }
  };

  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      <div className="flex items-center space-x-3 mb-6">
        <TrendingUp className="h-6 w-6 text-green-600" />
        <h2 className="text-xl font-semibold text-gray-900">Lab Trends & Serial Tracking</h2>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Test Name</label>
          <input
            type="text"
            value={selectedTest}
            onChange={(e) => setSelectedTest(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
            placeholder="e.g., Hemoglobin, Creatinine"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Time Range</label>
          <select
            value={timeRange}
            onChange={(e) => setTimeRange(parseInt(e.target.value))}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
          >
            <option value={3}>Last 3 months</option>
            <option value={6}>Last 6 months</option>
            <option value={12}>Last 12 months</option>
            <option value={24}>Last 2 years</option>
          </select>
        </div>
        <div className="flex items-end">
          <button
            onClick={loadTrendData}
            disabled={!selectedPatient || !selectedTest}
            className="w-full px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50"
          >
            Analyze Trends
          </button>
        </div>
      </div>

      {trendData.length > 0 && (
        <div className="space-y-6">
          {trendData.map((trend, index) => (
            <div key={index} className="border border-gray-200 rounded-lg p-4">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center space-x-3">
                  {getTrendIcon(trend.trend_direction)}
                  <h3 className="text-lg font-semibold text-gray-900">{trend.test_name}</h3>
                </div>
                <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                  trend.trend_direction === 'improving' ? 'bg-green-100 text-green-800' :
                  trend.trend_direction === 'worsening' ? 'bg-red-100 text-red-800' :
                  trend.trend_direction === 'fluctuating' ? 'bg-orange-100 text-orange-800' :
                  'bg-blue-100 text-blue-800'
                }`}>
                  {trend.trend_direction.toUpperCase()}
                </span>
              </div>

              <p className="text-sm text-gray-600 mb-4">{trend.trend_analysis}</p>

              {/* Data Points */}
              <div className="space-y-2">
                <h4 className="text-sm font-medium text-gray-700">Recent Results:</h4>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                  {trend.results.slice(-6).map((result, resultIndex) => (
                    <div key={resultIndex} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                      <span className="text-sm text-gray-600">{format(result.date, 'MMM d')}</span>
                      <span className="text-sm font-medium">{result.value}</span>
                      <span className={`text-xs px-1 py-0.5 rounded ${
                        result.flag === 'normal' ? 'bg-green-100 text-green-800' :
                        'bg-orange-100 text-orange-800'
                      }`}>
                        {result.flag}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {!selectedPatient && (
        <div className="text-center py-8">
          <BarChart3 className="h-12 w-12 text-gray-400 mx-auto mb-3" />
          <p className="text-gray-600">Select a patient to view lab trends</p>
        </div>
      )}
    </div>
  );
};

// Request Section Component
const RequestSection = ({ onRefresh }: any) => {
  const [formData, setFormData] = useState({
    patient_id: '',
    patient_name: '',
    hospital_number: '',
    requested_by: '',
    urgency: 'routine',
    clinical_indication: '',
    special_instructions: ''
  });
  const [selectedTests, setSelectedTests] = useState<LabTest[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<LabCategory>('hematology');
  const [patients, setPatients] = useState<any[]>([]);
  const [patientSearchQuery, setPatientSearchQuery] = useState('');
  const [showPatientDropdown, setShowPatientDropdown] = useState(false);

  useEffect(() => {
    loadPatients();
  }, []);

  const loadPatients = async () => {
    try {
      const allPatients = await patientService.getAllPatients();
      setPatients(allPatients);
    } catch (error) {
      console.error('Error loading patients:', error);
    }
  };

  const filteredPatients = patients.filter(p => {
    const searchLower = patientSearchQuery.toLowerCase();
    const fullName = `${p.first_name} ${p.last_name}`.toLowerCase();
    const hospitalNum = p.hospital_number?.toLowerCase() || '';
    return fullName.includes(searchLower) || hospitalNum.includes(searchLower);
  }).slice(0, 10); // Limit to 10 results

  const selectPatient = (patient: any) => {
    setFormData({
      ...formData,
      patient_id: patient.id?.toString() || '',
      patient_name: `${patient.first_name} ${patient.last_name}`,
      hospital_number: patient.hospital_number || ''
    });
    setPatientSearchQuery(`${patient.first_name} ${patient.last_name} (${patient.hospital_number})`);
    setShowPatientDropdown(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await labService.createLabInvestigation({
        ...formData,
        request_date: new Date(),
        tests: selectedTests,
        status: 'pending',
        urgency: formData.urgency as 'routine' | 'urgent' | 'stat'
      });

      // Reset form
      setFormData({
        patient_id: '',
        patient_name: '',
        hospital_number: '',
        requested_by: '',
        urgency: 'routine',
        clinical_indication: '',
        special_instructions: ''
      });
      setSelectedTests([]);
      setPatientSearchQuery('');
      onRefresh();
    } catch (error) {
      console.error('Error creating lab request:', error);
    }
  };

  const toggleTest = (test: LabTest) => {
    const exists = selectedTests.find(t => t.id === test.id);
    if (exists) {
      setSelectedTests(selectedTests.filter(t => t.id !== test.id));
    } else {
      setSelectedTests([...selectedTests, test]);
    }
  };

  const removeTest = (testId: string) => {
    setSelectedTests(selectedTests.filter(t => t.id !== testId));
  };

  const labCategories = labService.getLabCategories();
  const availableTests = labService.getCommonTests(selectedCategory);

  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      <div className="flex items-center space-x-3 mb-6">
        <Plus className="h-6 w-6 text-green-600" />
        <h2 className="text-xl font-semibold text-gray-900">Request Lab Investigation</h2>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Patient Search Dropdown */}
          <div className="relative">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Search Patient *
            </label>
            <div className="relative">
              <input
                type="text"
                value={patientSearchQuery}
                onChange={(e) => {
                  setPatientSearchQuery(e.target.value);
                  setShowPatientDropdown(true);
                }}
                onFocus={() => setShowPatientDropdown(true)}
                placeholder="Search by name or hospital number..."
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
                required
              />
              <Search className="absolute right-3 top-2.5 h-5 w-5 text-gray-400" />
            </div>

            {/* Patient Dropdown */}
            {showPatientDropdown && patientSearchQuery && filteredPatients.length > 0 && (
              <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg max-h-60 overflow-y-auto">
                {filteredPatients.map((patient) => (
                  <button
                    key={patient.id}
                    type="button"
                    onClick={() => selectPatient(patient)}
                    className="w-full px-4 py-2 text-left hover:bg-gray-100 transition-colors"
                  >
                    <div className="font-medium text-gray-900">
                      {patient.first_name} {patient.last_name}
                    </div>
                    <div className="text-sm text-gray-600">
                      Hospital No: {patient.hospital_number}
                    </div>
                  </button>
                ))}
              </div>
            )}

            {showPatientDropdown && patientSearchQuery && filteredPatients.length === 0 && (
              <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg p-3">
                <p className="text-sm text-gray-600">No patients found</p>
              </div>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Requested By</label>
            <input
              type="text"
              value={formData.requested_by}
              onChange={(e) => setFormData({ ...formData, requested_by: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Urgency</label>
            <select
              value={formData.urgency}
              onChange={(e) => setFormData({ ...formData, urgency: e.target.value as any })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
            >
              <option value="routine">Routine</option>
              <option value="urgent">Urgent</option>
              <option value="stat">STAT</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Test Category</label>
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value as LabCategory)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
            >
              {labCategories.map(cat => (
                <option key={cat.value} value={cat.value}>{cat.label}</option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Clinical Indication</label>
          <textarea
            value={formData.clinical_indication}
            onChange={(e) => setFormData({ ...formData, clinical_indication: e.target.value })}
            rows={3}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
            required
          />
        </div>

        {/* Checkbox Test Selection */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-3">
            Select Tests from {labCategories.find(c => c.value === selectedCategory)?.label || 'Category'} 
            <span className="text-gray-500 ml-2">({availableTests.length} tests available)</span>
          </label>
          
          {availableTests.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 p-4 bg-gray-50 rounded-lg border border-gray-200">
              {availableTests.map(test => (
                <label
                  key={test.id}
                  className={`flex items-start space-x-3 p-3 border rounded-lg cursor-pointer transition-all ${
                    selectedTests.find(t => t.id === test.id)
                      ? 'bg-green-50 border-green-500 shadow-sm'
                      : 'bg-white border-gray-200 hover:border-green-300 hover:shadow-sm'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={selectedTests.some(t => t.id === test.id)}
                    onChange={() => toggleTest(test)}
                    className="mt-1 w-4 h-4 text-green-600 border-gray-300 rounded focus:ring-green-500"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-gray-900 text-sm">{test.test_name}</div>
                    <div className="text-xs text-gray-600">{test.test_code}</div>
                    {test.fasting_required && (
                      <div className="flex items-center space-x-1 mt-1">
                        <AlertTriangle className="h-3 w-3 text-orange-600" />
                        <span className="text-xs text-orange-600">Fasting required</span>
                      </div>
                    )}
                  </div>
                </label>
              ))}
            </div>
          ) : (
            <div className="p-4 bg-gray-50 rounded-lg border border-gray-200 text-center">
              <p className="text-sm text-gray-600">No tests available in this category</p>
            </div>
          )}
        </div>

        {/* Selected Tests Summary */}
        {selectedTests.length > 0 && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Selected Tests ({selectedTests.length})
            </label>
            <div className="flex flex-wrap gap-2">
              {selectedTests.map(test => (
                <span
                  key={test.id}
                  className="flex items-center space-x-2 px-3 py-1 bg-green-100 text-green-800 rounded-full text-sm"
                >
                  <span>{test.test_name}</span>
                  <button
                    type="button"
                    onClick={() => removeTest(test.id)}
                    className="text-green-600 hover:text-green-800"
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>
          </div>
        )}

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Special Instructions</label>
          <textarea
            value={formData.special_instructions}
            onChange={(e) => setFormData({ ...formData, special_instructions: e.target.value })}
            rows={2}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
            placeholder="Any special collection or preparation instructions..."
          />
        </div>

        <div className="flex justify-end space-x-3">
          <button
            type="button"
            onClick={() => {
              setFormData({
                patient_id: '',
                patient_name: '',
                hospital_number: '',
                requested_by: '',
                urgency: 'routine',
                clinical_indication: '',
                special_instructions: ''
              });
              setSelectedTests([]);
              setPatientSearchQuery('');
            }}
            className="px-4 py-2 text-gray-700 bg-gray-200 rounded-lg hover:bg-gray-300 transition-colors"
          >
            Clear
          </button>
          <button
            type="submit"
            disabled={selectedTests.length === 0 || !formData.patient_id}
            className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50"
          >
            Submit Request
          </button>
        </div>
      </form>
    </div>
  );
};

// Result Detail Modal Component
const ResultDetailModal = ({ result, onClose }: { result: LabResult; onClose: () => void }) => {
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 max-w-3xl w-full mx-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-semibold text-gray-900">Lab Result Details</h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
          >
            <span className="sr-only">Close</span>
            ×
          </button>
        </div>

        <div className="space-y-6">
          {/* Basic Result Info */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-500">Test</label>
              <p className="text-lg font-semibold text-gray-900">{result.test_id}</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-500">Result</label>
              <p className="text-lg font-semibold text-gray-900">{result.result_value} {result.unit}</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-500">Reference Range</label>
              <p className="text-gray-900">{result.reference_range}</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-500">Flag</label>
              <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                result.abnormal_flag === 'normal' ? 'bg-green-100 text-green-800' :
                'bg-orange-100 text-orange-800'
              }`}>
                {result.abnormal_flag.replace('_', ' ').toUpperCase()}
              </span>
            </div>
          </div>

          {/* AI Interpretation */}
          {result.ai_interpretation && (
            <div className="border rounded-lg p-4">
              <div className="flex items-center space-x-2 mb-3">
                <Brain className="h-5 w-5 text-purple-600" />
                <h4 className="font-semibold text-gray-900">AI Interpretation</h4>
              </div>
              
              <div className="space-y-3">
                <div>
                  <label className="block text-sm font-medium text-gray-500">Interpretation</label>
                  <p className="text-gray-900">{result.ai_interpretation.interpretation_text}</p>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-500">Clinical Significance</label>
                  <p className="text-gray-900">{result.ai_interpretation.clinical_significance}</p>
                </div>

                {result.ai_interpretation.suggested_actions.length > 0 && (
                  <div>
                    <label className="block text-sm font-medium text-gray-500">Suggested Actions</label>
                    <ul className="list-disc list-inside text-gray-900">
                      {result.ai_interpretation.suggested_actions.map((action, index) => (
                        <li key={index}>{action}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {result.ai_interpretation.follow_up_recommendations && result.ai_interpretation.follow_up_recommendations.length > 0 && (
                  <div>
                    <label className="block text-sm font-medium text-gray-500">Follow-up Recommendations</label>
                    <ul className="list-disc list-inside text-gray-900">
                      {result.ai_interpretation.follow_up_recommendations.map((rec, index) => (
                        <li key={index}>{rec}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Comments */}
          {result.comments && (
            <div>
              <label className="block text-sm font-medium text-gray-500">Comments</label>
              <p className="text-gray-900">{result.comments}</p>
            </div>
          )}
        </div>

        <div className="flex justify-end mt-6">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

// GFR Section Component
const GFRSection = ({ 
  patientId, 
  gfrCalculations, 
  gfrTrend, 
  onRefresh 
}: { 
  patientId: string;
  gfrCalculations: GFRCalculation[];
  gfrTrend: GFRTrend | null;
  onRefresh: () => void;
}) => {
  const [showAutoCalculate, setShowAutoCalculate] = useState(false);
  const [demographics, setDemographics] = useState<PatientDemographics>({
    age: 30,
    gender: 'male',
    race: 'other'
  });

  const handleAutoCalculateGFR = async () => {
    try {
      await labService.autoGenerateGFRFromResults(patientId, demographics);
      onRefresh();
      setShowAutoCalculate(false);
    } catch (error) {
      console.error('Error auto-calculating GFR:', error);
    }
  };

  const calculateManualGFR = async (creatinine: number, unit: string) => {
    try {
      await labService.calculateGFR(patientId, creatinine, unit, demographics);
      onRefresh();
    } catch (error) {
      console.error('Error calculating GFR:', error);
    }
  };

  const getStageColor = (stage: number) => {
    const colors = {
      1: 'text-green-600',
      2: 'text-yellow-600', 
      3: 'text-orange-600',
      4: 'text-red-600',
      5: 'text-red-800'
    };
    return colors[stage as keyof typeof colors] || 'text-gray-600';
  };

  const getRiskColor = (risk: string) => {
    const colors = {
      'normal': 'text-green-600',
      'mild_decrease': 'text-yellow-600',
      'moderate_decrease': 'text-orange-600', 
      'severe_decrease': 'text-red-600',
      'kidney_failure': 'text-red-800'
    };
    return colors[risk as keyof typeof colors] || 'text-gray-600';
  };

  if (!patientId) {
    return (
      <div className="text-center py-8 text-gray-500">
        <Activity className="mx-auto h-12 w-12 mb-4" />
        <p>Please select a patient to view GFR analysis</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-xl font-semibold text-gray-900">GFR Analysis & Kidney Function</h2>
          <p className="text-gray-600">Glomerular Filtration Rate calculations and trends</p>
        </div>
        <div className="flex space-x-3">
          <button
            onClick={() => setShowAutoCalculate(true)}
            className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition-colors flex items-center space-x-2"
          >
            <Zap className="h-4 w-4" />
            <span>Auto Calculate from Results</span>
          </button>
          <button
            onClick={onRefresh}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
          >
            Refresh
          </button>
        </div>
      </div>

      {/* GFR Trend Summary */}
      {gfrTrend && gfrTrend.gfr_calculations.length > 0 && (
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <h3 className="text-lg font-medium text-gray-900 mb-4">Kidney Function Trend Summary</h3>
          
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Current Status */}
            <div className="space-y-3">
              <h4 className="font-medium text-gray-700">Current Status</h4>
              {gfrTrend.gfr_calculations.length > 0 && (
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Latest GFR:</span>
                    <span className="font-semibold">
                      {gfrTrend.gfr_calculations[gfrTrend.gfr_calculations.length - 1].gfr_value} mL/min/1.73m²
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">CKD Stage:</span>
                    <span className={`font-semibold ${getStageColor(gfrTrend.gfr_calculations[gfrTrend.gfr_calculations.length - 1].ckd_stage)}`}>
                      Stage {gfrTrend.gfr_calculations[gfrTrend.gfr_calculations.length - 1].ckd_stage}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Risk Level:</span>
                    <span className={`font-semibold ${getRiskColor(gfrTrend.gfr_calculations[gfrTrend.gfr_calculations.length - 1].risk_assessment)}`}>
                      {gfrTrend.gfr_calculations[gfrTrend.gfr_calculations.length - 1].risk_assessment.replace('_', ' ')}
                    </span>
                  </div>
                </div>
              )}
            </div>

            {/* Trend Analysis */}
            <div className="space-y-3">
              <h4 className="font-medium text-gray-700">Trend Analysis</h4>
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-gray-600">Direction:</span>
                  <span className={`font-semibold capitalize ${
                    gfrTrend.trend_direction === 'improving' ? 'text-green-600' :
                    gfrTrend.trend_direction === 'declining' ? 'text-red-600' :
                    gfrTrend.trend_direction === 'fluctuating' ? 'text-orange-600' :
                    'text-blue-600'
                  }`}>
                    {gfrTrend.trend_direction}
                  </span>
                </div>
                {gfrTrend.rate_of_decline && (
                  <div className="flex justify-between">
                    <span className="text-gray-600">Rate:</span>
                    <span className="font-semibold">
                      {gfrTrend.rate_of_decline > 0 ? '+' : ''}{gfrTrend.rate_of_decline} mL/min/1.73m²/year
                    </span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-gray-600">Risk Progression:</span>
                  <span className={`font-semibold capitalize ${getRiskColor(gfrTrend.risk_progression)}`}>
                    {gfrTrend.risk_progression.replace('_', ' ')}
                  </span>
                </div>
              </div>
            </div>

            {/* Estimates */}
            <div className="space-y-3">
              <h4 className="font-medium text-gray-700">Clinical Estimates</h4>
              <div className="space-y-2">
                {gfrTrend.time_to_dialysis_estimate && gfrTrend.time_to_dialysis_estimate > 0 && (
                  <div className="flex justify-between">
                    <span className="text-gray-600">Time to Dialysis:</span>
                    <span className="font-semibold text-red-600">
                      ~{gfrTrend.time_to_dialysis_estimate} months
                    </span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-gray-600">Measurements:</span>
                  <span className="font-semibold">
                    {gfrTrend.gfr_calculations.length} readings
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Trend Analysis Text */}
          <div className="mt-6 pt-6 border-t border-gray-200">
            <h4 className="font-medium text-gray-700 mb-2">Detailed Analysis</h4>
            <p className="text-gray-600">{gfrTrend.trend_analysis}</p>
          </div>

          {/* Recommendations */}
          {gfrTrend.follow_up_recommendations.length > 0 && (
            <div className="mt-6 pt-6 border-t border-gray-200">
              <h4 className="font-medium text-gray-700 mb-2">Follow-up Recommendations</h4>
              <ul className="list-disc list-inside text-gray-600 space-y-1">
                {gfrTrend.follow_up_recommendations.map((rec, index) => (
                  <li key={index}>{rec}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {/* GFR Calculations History */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h3 className="text-lg font-medium text-gray-900 mb-4">GFR Calculations History</h3>
        
        {gfrCalculations.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <Activity className="mx-auto h-12 w-12 mb-4" />
            <p>No GFR calculations available</p>
            <p className="text-sm">Upload creatinine results and use auto-calculate to generate GFR values</p>
          </div>
        ) : (
          <div className="space-y-4">
            {gfrCalculations.map((calc) => (
              <div key={calc.id} className="border border-gray-200 rounded-lg p-4">
                <div className="flex justify-between items-start mb-3">
                  <div>
                    <div className="flex items-center space-x-3">
                      <span className="text-lg font-semibold text-blue-600">
                        {calc.gfr_value} mL/min/1.73m²
                      </span>
                      <span className={`px-2 py-1 rounded text-sm font-medium ${getStageColor(calc.ckd_stage)}`}>
                        CKD Stage {calc.ckd_stage}
                      </span>
                      <span className={`px-2 py-1 rounded text-sm ${getRiskColor(calc.risk_assessment)}`}>
                        {calc.risk_assessment.replace('_', ' ')}
                      </span>
                    </div>
                    <p className="text-gray-600 text-sm mt-1">
                      {format(new Date(calc.calculation_date), 'PPP p')} • {calc.gfr_formula} formula
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-gray-600">Creatinine:</span> 
                    <span className="ml-2 font-medium">{calc.creatinine_value} {calc.creatinine_unit}</span>
                  </div>
                  <div>
                    <span className="text-gray-600">Demographics:</span> 
                    <span className="ml-2 font-medium">{calc.age}y, {calc.gender}, {calc.race.replace('_', ' ')}</span>
                  </div>
                </div>

                <div className="mt-3 pt-3 border-t border-gray-100">
                  <p className="text-gray-700 text-sm">{calc.clinical_interpretation}</p>
                </div>

                {calc.recommendations && calc.recommendations.length > 0 && (
                  <div className="mt-3 pt-3 border-t border-gray-100">
                    <h5 className="text-sm font-medium text-gray-700 mb-2">Recommendations:</h5>
                    <ul className="list-disc list-inside text-sm text-gray-600 space-y-1">
                      {calc.recommendations.map((rec, index) => (
                        <li key={index}>{rec}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Auto Calculate Modal */}
      {showAutoCalculate && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4">
            <div className="p-6">
              <h3 className="text-lg font-medium text-gray-900 mb-4">
                Auto Calculate GFR from Results
              </h3>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Patient Age
                  </label>
                  <input
                    type="number"
                    value={demographics.age}
                    onChange={(e) => setDemographics(prev => ({ ...prev, age: parseInt(e.target.value) || 0 }))}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2"
                    min="1"
                    max="120"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Gender
                  </label>
                  <select
                    value={demographics.gender}
                    onChange={(e) => setDemographics(prev => ({ ...prev, gender: e.target.value as 'male' | 'female' }))}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2"
                  >
                    <option value="male">Male</option>
                    <option value="female">Female</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Race/Ethnicity
                  </label>
                  <select
                    value={demographics.race}
                    onChange={(e) => setDemographics(prev => ({ ...prev, race: e.target.value as 'african_american' | 'other' }))}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2"
                  >
                    <option value="other">Other/Non-African American</option>
                    <option value="african_american">African American</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Weight (kg) - Optional for Cockcroft-Gault
                  </label>
                  <input
                    type="number"
                    value={demographics.weight || ''}
                    onChange={(e) => setDemographics(prev => ({ ...prev, weight: parseFloat(e.target.value) || undefined }))}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2"
                    step="0.1"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Height (cm) - Optional
                  </label>
                  <input
                    type="number"
                    value={demographics.height || ''}
                    onChange={(e) => setDemographics(prev => ({ ...prev, height: parseFloat(e.target.value) || undefined }))}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2"
                    step="0.1"
                  />
                </div>
              </div>

              <div className="flex space-x-3 mt-6">
                <button
                  onClick={handleAutoCalculateGFR}
                  className="flex-1 bg-green-600 text-white py-2 px-4 rounded-lg hover:bg-green-700 transition-colors"
                >
                  Calculate GFR
                </button>
                <button
                  onClick={() => setShowAutoCalculate(false)}
                  className="flex-1 bg-gray-500 text-white py-2 px-4 rounded-lg hover:bg-gray-600 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
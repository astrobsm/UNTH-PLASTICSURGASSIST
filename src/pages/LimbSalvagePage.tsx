import React, { useState, useEffect } from 'react';
import { 
  Footprints, 
  Plus, 
  Search, 
  Calendar,
  User,
  AlertTriangle,
  CheckCircle,
  Clock,
  FileText,
  TrendingUp,
  Activity,
  Loader2,
  Trash2
} from 'lucide-react';
import { DiabeticFootAssessmentForm } from '../components/limbSalvage/DiabeticFootAssessmentForm';
import { diabeticFootService, DiabeticFootAssessment, RiskCategory } from '../services/diabeticFootService';
import { patientService } from '../services/patientService';

interface AssessmentSummary {
  id: string;
  patientId: string;
  patientName: string;
  hospitalNumber?: string;
  assessmentDate: Date;
  totalScore: number;
  riskCategory: RiskCategory;
  recommendedIntervention: string;
  status: 'draft' | 'completed' | 'reviewed';
}

const LimbSalvagePage: React.FC = () => {
  const [view, setView] = useState<'list' | 'new' | 'detail'>('list');
  const [assessments, setAssessments] = useState<AssessmentSummary[]>([]);
  const [selectedAssessment, setSelectedAssessment] = useState<DiabeticFootAssessment | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterRisk, setFilterRisk] = useState<RiskCategory | 'all'>('all');
  const [selectedPatientId, setSelectedPatientId] = useState<string>('');
  const [isLoading, setIsLoading] = useState(true);
  const [patients, setPatients] = useState<any[]>([]);

  // Load assessments and patients from database
  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setIsLoading(true);
      
      // Fetch patients first
      const patientsData = await patientService.getAllPatients();
      setPatients(patientsData);
      
      // Fetch assessments from database
      const dbAssessments = await diabeticFootService.getAllAssessments();
      
      // Map assessments to summary format with patient names
      const summaries: AssessmentSummary[] = dbAssessments.map(a => {
        const patient = patientsData.find((p: any) => 
          p.id === a.patientId || String(p.id) === a.patientId
        );
        const patientName = patient 
          ? `${patient.first_name} ${patient.last_name}` 
          : 'Unknown Patient';
        
        return {
          id: a.id,
          patientId: a.patientId,
          patientName,
          hospitalNumber: patient?.hospital_number,
          assessmentDate: a.assessmentDate,
          totalScore: a.totalScore || 0,
          riskCategory: a.riskCategory || 'low_risk_limb_salvage_likely',
          recommendedIntervention: a.recommendedIntervention || '',
          status: a.status
        };
      });
      
      setAssessments(summaries);
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const getRiskBadge = (category: RiskCategory) => {
    const display = diabeticFootService.getRiskCategoryDisplay(category);
    const colorClasses = {
      green: 'bg-green-100 text-green-800 border-green-200',
      yellow: 'bg-yellow-100 text-yellow-800 border-yellow-200',
      orange: 'bg-orange-100 text-orange-800 border-orange-200',
      red: 'bg-red-100 text-red-800 border-red-200'
    };
    return (
      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${colorClasses[display.color as keyof typeof colorClasses]}`}>
        {display.icon} {display.label}
      </span>
    );
  };

  const getStatusBadge = (status: 'draft' | 'completed' | 'reviewed') => {
    const styles = {
      draft: 'bg-gray-100 text-gray-800',
      completed: 'bg-blue-100 text-blue-800',
      reviewed: 'bg-green-100 text-green-800'
    };
    const icons = {
      draft: <Clock className="w-3 h-3 mr-1" />,
      completed: <CheckCircle className="w-3 h-3 mr-1" />,
      reviewed: <FileText className="w-3 h-3 mr-1" />
    };
    return (
      <span className={`inline-flex items-center px-2 py-1 rounded text-xs font-medium ${styles[status]}`}>
        {icons[status]}
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </span>
    );
  };

  const filteredAssessments = assessments.filter(a => {
    const matchesSearch = (a.patientName || '').toLowerCase().includes(searchTerm.toLowerCase());
    const matchesRisk = filterRisk === 'all' || a.riskCategory === filterRisk;
    return matchesSearch && matchesRisk;
  });

  const handleNewAssessment = () => {
    setView('new');
    setSelectedAssessment(null);
  };

  const handleSaveAssessment = async (assessment: DiabeticFootAssessment) => {
    try {
      // Save to database
      await diabeticFootService.saveAssessment(assessment);
      console.log('Assessment saved successfully:', assessment);
      
      // Refresh list
      await loadData();
      setView('list');
    } catch (error) {
      console.error('Error saving assessment:', error);
      alert('Failed to save assessment. Please try again.');
    }
  };

  const handleDeleteAssessment = async (id: string) => {
    if (!confirm('Are you sure you want to delete this assessment?')) return;
    
    try {
      await diabeticFootService.deleteAssessment(id);
      await loadData();
    } catch (error) {
      console.error('Error deleting assessment:', error);
      alert('Failed to delete assessment. Please try again.');
    }
  };

  const handleCancelAssessment = () => {
    setView('list');
    setSelectedAssessment(null);
  };

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-primary-100 rounded-lg">
              <Footprints className="w-8 h-8 text-primary-600" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Diabetic Foot - Limb Salvage Module</h1>
              <p className="text-gray-500">Comprehensive assessment for limb salvage decision-making</p>
            </div>
          </div>
          {view === 'list' && (
            <button
              onClick={handleNewAssessment}
              className="inline-flex items-center px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
            >
              <Plus className="w-5 h-5 mr-2" />
              New Assessment
            </button>
          )}
        </div>
      </div>

      {view === 'list' && (
        <>
          {/* Loading State */}
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-primary-600" />
              <span className="ml-2 text-gray-600">Loading assessments...</span>
            </div>
          ) : (
          <>
          {/* Stats Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            <div className="bg-white rounded-lg shadow p-4 border-l-4 border-green-500">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500">Low Risk</p>
                  <p className="text-2xl font-bold text-green-600">
                    {assessments.filter(a => a.riskCategory === 'low_risk_limb_salvage_likely').length}
                  </p>
                </div>
                <CheckCircle className="w-8 h-8 text-green-200" />
              </div>
            </div>
            <div className="bg-white rounded-lg shadow p-4 border-l-4 border-yellow-500">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500">Moderate Risk</p>
                  <p className="text-2xl font-bold text-yellow-600">
                    {assessments.filter(a => a.riskCategory === 'moderate_risk_limb_salvage_possible').length}
                  </p>
                </div>
                <Activity className="w-8 h-8 text-yellow-200" />
              </div>
            </div>
            <div className="bg-white rounded-lg shadow p-4 border-l-4 border-orange-500">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500">High Risk</p>
                  <p className="text-2xl font-bold text-orange-600">
                    {assessments.filter(a => a.riskCategory === 'high_risk_consider_amputation').length}
                  </p>
                </div>
                <AlertTriangle className="w-8 h-8 text-orange-200" />
              </div>
            </div>
            <div className="bg-white rounded-lg shadow p-4 border-l-4 border-red-500">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500">Critical</p>
                  <p className="text-2xl font-bold text-red-600">
                    {assessments.filter(a => a.riskCategory === 'critical_amputation_recommended').length}
                  </p>
                </div>
                <TrendingUp className="w-8 h-8 text-red-200" />
              </div>
            </div>
          </div>

          {/* Filters */}
          <div className="bg-white rounded-lg shadow p-4 mb-6">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
              <div className="relative flex-1 max-w-md">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                <input
                  type="text"
                  placeholder="Search patients..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                />
              </div>
              <div className="flex items-center space-x-2">
                <label className="text-sm text-gray-600">Risk Level:</label>
                <select
                  value={filterRisk}
                  onChange={(e) => setFilterRisk(e.target.value as RiskCategory | 'all')}
                  className="border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-primary-500"
                >
                  <option value="all">All Levels</option>
                  <option value="low_risk_limb_salvage_likely">Low Risk</option>
                  <option value="moderate_risk_limb_salvage_possible">Moderate Risk</option>
                  <option value="high_risk_consider_amputation">High Risk</option>
                  <option value="critical_amputation_recommended">Critical</option>
                </select>
              </div>
            </div>
          </div>

          {/* Assessments Table */}
          <div className="bg-white rounded-lg shadow overflow-hidden">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Patient
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Date
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Score
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Risk Category
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredAssessments.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-12 text-center text-gray-500">
                      <Footprints className="w-12 h-12 mx-auto mb-4 text-gray-300" />
                      <p className="text-lg font-medium">No assessments found</p>
                      <p className="text-sm">Create a new assessment to get started</p>
                    </td>
                  </tr>
                ) : (
                  filteredAssessments.map((assessment) => (
                    <tr key={assessment.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <div className="flex-shrink-0 h-10 w-10 bg-gray-100 rounded-full flex items-center justify-center">
                            <User className="w-5 h-5 text-gray-500" />
                          </div>
                          <div className="ml-4">
                            <div className="text-sm font-medium text-gray-900">{assessment.patientName}</div>
                            <div className="text-sm text-gray-500">
                              {assessment.hospitalNumber || `ID: ${assessment.patientId}`}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center text-sm text-gray-900">
                          <Calendar className="w-4 h-4 mr-2 text-gray-400" />
                          {new Date(assessment.assessmentDate).toLocaleDateString()}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-lg font-bold text-gray-900">{assessment.totalScore}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {getRiskBadge(assessment.riskCategory)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {getStatusBadge(assessment.status)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <button className="text-primary-600 hover:text-primary-900 mr-3">
                          View
                        </button>
                        <button className="text-gray-600 hover:text-gray-900 mr-3">
                          Edit
                        </button>
                        <button 
                          onClick={() => handleDeleteAssessment(assessment.id)}
                          className="text-red-600 hover:text-red-900"
                        >
                          <Trash2 className="w-4 h-4 inline" />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          </>
          )}
        </>
      )}

      {view === 'new' && (
        <DiabeticFootAssessmentForm
          patientId={selectedPatientId}
          onSave={handleSaveAssessment}
          onCancel={handleCancelAssessment}
        />
      )}
    </div>
  );
};

export default LimbSalvagePage;

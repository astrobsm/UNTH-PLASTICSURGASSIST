// Investigation Ordering Modal with Result Tracking and Normal Value Checking
import React, { useState, useEffect } from 'react';
import { X, Plus, TestTube, AlertTriangle, CheckCircle, Search, Upload, Trash2, TrendingUp, FileText } from 'lucide-react';
import { format } from 'date-fns';
import { 
  interpretLabResult, 
  getReferenceRange, 
  ALL_REFERENCE_RANGES,
  ReferenceRange 
} from '../data/labReferenceValues';
import {
  INVESTIGATIONS,
  INVESTIGATION_CATEGORIES as INVESTIGATIONS_DB_CATEGORIES,
  INVESTIGATION_PANELS,
  searchInvestigations,
  getInvestigationsByCategory,
  getNormalRangeForPatient,
  checkCriticalValue
} from '../data/investigations';

interface Investigation {
  id: string;
  test_name: string;
  test_category: string;
  priority: 'routine' | 'urgent' | 'stat';
  clinical_indication: string;
  ordered_date: Date;
  status: 'pending' | 'collected' | 'completed' | 'cancelled';
  results?: InvestigationResult[];
}

interface InvestigationResult {
  id: string;
  parameter: string;
  value: number | string;
  unit: string;
  reference_range: string;
  flag: 'normal' | 'low' | 'high' | 'critical_low' | 'critical_high' | 'abnormal';
  interpretation?: string;
  clinical_significance?: string;
  suggested_actions?: string[];
  result_date: Date;
  verified_by?: string;
}

interface InvestigationOrderingModalProps {
  patientId: string;
  patientName: string;
  patientGender?: 'male' | 'female';
  source: 'ward_round' | 'treatment_plan';
  existingInvestigations?: Investigation[];
  onSave: (investigations: Investigation[]) => void;
  onClose: () => void;
}

const INVESTIGATION_CATEGORIES = {
  hematology: {
    name: 'Hematology',
    tests: ['FBC', 'ESR', 'Reticulocyte Count', 'Blood Film', 'G6PD', 'Sickle Cell Test']
  },
  biochemistry: {
    name: 'Biochemistry',
    tests: ['U&E', 'LFT', 'Bone Profile', 'Lipid Profile', 'Amylase', 'Troponin', 'CK-MB', 'BNP']
  },
  coagulation: {
    name: 'Coagulation',
    tests: ['PT/INR', 'APTT', 'D-Dimer', 'Fibrinogen', 'Bleeding Time', 'Clotting Time']
  },
  endocrinology: {
    name: 'Endocrinology',
    tests: ['Thyroid Function', 'Cortisol', 'ACTH', 'Growth Hormone', 'Prolactin']
  },
  diabetes: {
    name: 'Diabetes',
    tests: ['Fasting Glucose', 'Random Glucose', 'HbA1c', 'OGTT', 'C-Peptide']
  },
  immunology: {
    name: 'Immunology',
    tests: ['CRP', 'RF', 'ANA', 'Anti-dsDNA', 'Complement (C3, C4)', 'Immunoglobulins']
  },
  microbiology: {
    name: 'Microbiology',
    tests: ['Blood Culture', 'Urine Culture', 'Wound Swab', 'Sputum C&S', 'Stool C&S']
  },
  histopathology: {
    name: 'Histopathology',
    tests: ['Biopsy', 'FNAC', 'Frozen Section', 'Immunohistochemistry']
  },
  radiology: {
    name: 'Radiology',
    tests: ['Chest X-Ray', 'Abdominal X-Ray', 'Ultrasound', 'CT Scan', 'MRI', 'Mammogram']
  }
};

export const InvestigationOrderingModal: React.FC<InvestigationOrderingModalProps> = ({
  patientId,
  patientName,
  patientGender = 'male',
  source,
  existingInvestigations = [],
  onSave,
  onClose
}) => {
  const [investigations, setInvestigations] = useState<Investigation[]>(existingInvestigations);
  const [activeTab, setActiveTab] = useState<'order' | 'track' | 'results'>('order');
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedInvestigation, setSelectedInvestigation] = useState<Investigation | null>(null);
  
  // New investigation form
  const [newInvestigation, setNewInvestigation] = useState({
    test_name: '',
    test_category: '',
    priority: 'routine' as 'routine' | 'urgent' | 'stat',
    clinical_indication: ''
  });

  // Result entry form
  const [resultForm, setResultForm] = useState({
    parameter: '',
    value: '',
    unit: '',
    result_date: format(new Date(), 'yyyy-MM-dd')
  });

  const [showResultEntry, setShowResultEntry] = useState(false);

  // Filter tests based on category and search
  const getFilteredTests = () => {
    if (!selectedCategory) return [];
    const category = INVESTIGATION_CATEGORIES[selectedCategory as keyof typeof INVESTIGATION_CATEGORIES];
    if (!category) return [];
    
    if (searchQuery) {
      return category.tests.filter(test => 
        test.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }
    return category.tests;
  };

  // Add new investigation
  const addInvestigation = () => {
    if (!newInvestigation.test_name) {
      alert('Please select a test');
      return;
    }

    const investigation: Investigation = {
      id: `inv_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      test_name: newInvestigation.test_name,
      test_category: newInvestigation.test_category,
      priority: newInvestigation.priority,
      clinical_indication: newInvestigation.clinical_indication,
      ordered_date: new Date(),
      status: 'pending',
      results: []
    };

    setInvestigations([...investigations, investigation]);
    setNewInvestigation({
      test_name: '',
      test_category: '',
      priority: 'routine',
      clinical_indication: ''
    });
    setSelectedCategory('');
  };

  // Remove investigation
  const removeInvestigation = (id: string) => {
    setInvestigations(investigations.filter(inv => inv.id !== id));
  };

  // Add result to investigation
  const addResult = () => {
    if (!selectedInvestigation || !resultForm.parameter || !resultForm.value) {
      alert('Please fill in all required fields');
      return;
    }

    const numericValue = parseFloat(resultForm.value);
    if (isNaN(numericValue)) {
      alert('Please enter a valid numeric value');
      return;
    }

    // Get interpretation
    const interpretation = interpretLabResult(
      selectedInvestigation.test_name,
      resultForm.parameter,
      numericValue,
      patientGender
    );

    // Get reference range
    const referenceRange = getReferenceRange(
      selectedInvestigation.test_name,
      resultForm.parameter,
      patientGender
    );

    const result: InvestigationResult = {
      id: `result_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      parameter: resultForm.parameter,
      value: numericValue,
      unit: resultForm.unit,
      reference_range: referenceRange,
      flag: interpretation.flag,
      interpretation: interpretation.message,
      clinical_significance: interpretation.clinical_significance,
      suggested_actions: interpretation.suggested_actions,
      result_date: new Date(resultForm.result_date)
    };

    // Update investigation with new result
    setInvestigations(investigations.map(inv => 
      inv.id === selectedInvestigation.id
        ? {
            ...inv,
            results: [...(inv.results || []), result],
            status: 'completed' as const
          }
        : inv
    ));

    // Reset form
    setResultForm({
      parameter: '',
      value: '',
      unit: '',
      result_date: format(new Date(), 'yyyy-MM-dd')
    });
    setShowResultEntry(false);
    setSelectedInvestigation(null);
  };

  // Get suggested parameters based on test name
  const getSuggestedParameters = (testName: string): string[] => {
    const parameterMap: Record<string, string[]> = {
      'FBC': ['Hemoglobin', 'WBC', 'Platelets', 'Neutrophils', 'Lymphocytes', 'Hematocrit', 'MCV'],
      'U&E': ['Sodium', 'Potassium', 'Chloride', 'Bicarbonate', 'Urea', 'Creatinine'],
      'LFT': ['ALT', 'AST', 'ALP', 'Bilirubin (Total)', 'Albumin', 'Total Protein', 'GGT'],
      'PT/INR': ['PT', 'INR', 'Control PT'],
      'APTT': ['APTT', 'Control APTT'],
      'Fasting Glucose': ['Fasting Glucose'],
      'Random Glucose': ['Random Glucose'],
      'HbA1c': ['HbA1c'],
      'Lipid Profile': ['Total Cholesterol', 'LDL Cholesterol', 'HDL Cholesterol', 'Triglycerides'],
      'Thyroid Function': ['TSH', 'Free T4', 'Free T3'],
      'CRP': ['CRP'],
      'ESR': ['ESR']
    };

    return parameterMap[testName] || [];
  };

  // Get priority badge color
  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'stat':
        return 'bg-red-100 text-red-800';
      case 'urgent':
        return 'bg-orange-100 text-orange-800';
      default:
        return 'bg-blue-100 text-blue-800';
    }
  };

  // Get status badge color
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'bg-green-100 text-green-800';
      case 'collected':
        return 'bg-yellow-100 text-yellow-800';
      case 'cancelled':
        return 'bg-gray-100 text-gray-800';
      default:
        return 'bg-blue-100 text-blue-800';
    }
  };

  // Get flag badge
  const getFlagBadge = (flag: string) => {
    switch (flag) {
      case 'critical_high':
      case 'critical_low':
        return <span className="px-2 py-1 rounded-full text-xs font-semibold bg-red-600 text-white">CRITICAL</span>;
      case 'high':
      case 'low':
      case 'abnormal':
        return <span className="px-2 py-1 rounded-full text-xs font-semibold bg-orange-500 text-white">ABNORMAL</span>;
      default:
        return <span className="px-2 py-1 rounded-full text-xs font-semibold bg-green-100 text-green-800">Normal</span>;
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-0 sm:p-4">
      <div className="bg-white rounded-none sm:rounded-lg shadow-xl sm:max-w-6xl w-full h-full sm:h-auto sm:max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="border-b border-gray-200 px-3 sm:px-6 py-3 sm:py-4 flex items-center justify-between flex-shrink-0">
          <div className="min-w-0 flex-1">
            <h2 className="text-lg sm:text-2xl font-bold text-gray-900 truncate">Investigation Management</h2>
            <p className="text-xs sm:text-sm text-gray-600 mt-1 truncate">
              {patientName} • {source === 'ward_round' ? 'Ward Round' : 'Treatment Planning'}
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Tabs */}
        <div className="border-b border-gray-200 flex-shrink-0">
          <div className="flex px-3 sm:px-6">
            <button
              onClick={() => setActiveTab('order')}
              className={`px-4 py-3 font-medium transition-colors relative ${
                activeTab === 'order'
                  ? 'text-green-600 border-b-2 border-green-600'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <div className="flex items-center gap-2">
                <Plus className="w-4 h-4" />
                Order New
              </div>
            </button>
            <button
              onClick={() => setActiveTab('track')}
              className={`px-4 py-3 font-medium transition-colors relative ${
                activeTab === 'track'
                  ? 'text-green-600 border-b-2 border-green-600'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <div className="flex items-center gap-2">
                <TestTube className="w-4 h-4" />
                Track ({investigations.length})
              </div>
            </button>
            <button
              onClick={() => setActiveTab('results')}
              className={`px-4 py-3 font-medium transition-colors relative ${
                activeTab === 'results'
                  ? 'text-green-600 border-b-2 border-green-600'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <div className="flex items-center gap-2">
                <FileText className="w-4 h-4" />
                Enter Results
              </div>
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          {/* Order Tab */}
          {activeTab === 'order' && (
            <div className="space-y-6">
              {/* Category Selection */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Select Category
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {Object.entries(INVESTIGATION_CATEGORIES).map(([key, category]) => (
                    <button
                      key={key}
                      onClick={() => {
                        setSelectedCategory(key);
                        setNewInvestigation({ ...newInvestigation, test_category: category.name });
                      }}
                      className={`px-4 py-2 rounded-lg border-2 transition-colors ${
                        selectedCategory === key
                          ? 'border-green-600 bg-green-50 text-green-700 font-medium'
                          : 'border-gray-300 hover:border-green-400'
                      }`}
                    >
                      {category.name}
                    </button>
                  ))}
                </div>
              </div>

              {/* Test Selection */}
              {selectedCategory && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Select Test
                  </label>
                  <div className="relative mb-3">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Search tests..."
                      className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
                    />
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-40 overflow-y-auto">
                    {getFilteredTests().map((test) => (
                      <button
                        key={test}
                        onClick={() => setNewInvestigation({ ...newInvestigation, test_name: test })}
                        className={`px-3 py-2 rounded border text-left transition-colors ${
                          newInvestigation.test_name === test
                            ? 'border-green-600 bg-green-50 text-green-700 font-medium'
                            : 'border-gray-300 hover:border-green-400'
                        }`}
                      >
                        {test}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Priority Selection */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Priority
                </label>
                <div className="flex gap-2">
                  {['routine', 'urgent', 'stat'].map((priority) => (
                    <button
                      key={priority}
                      onClick={() => setNewInvestigation({ ...newInvestigation, priority: priority as any })}
                      className={`px-4 py-2 rounded-lg border-2 capitalize transition-colors ${
                        newInvestigation.priority === priority
                          ? 'border-green-600 bg-green-50 text-green-700 font-medium'
                          : 'border-gray-300 hover:border-green-400'
                      }`}
                    >
                      {priority}
                    </button>
                  ))}
                </div>
              </div>

              {/* Clinical Indication */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Clinical Indication
                </label>
                <textarea
                  value={newInvestigation.clinical_indication}
                  onChange={(e) => setNewInvestigation({ ...newInvestigation, clinical_indication: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
                  rows={3}
                  placeholder="Reason for ordering this investigation..."
                />
              </div>

              {/* Add Button */}
              <button
                onClick={addInvestigation}
                className="w-full px-4 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 font-medium flex items-center justify-center gap-2"
              >
                <Plus className="w-5 h-5" />
                Add Investigation
              </button>
            </div>
          )}

          {/* Track Tab */}
          {activeTab === 'track' && (
            <div className="space-y-4">
              {investigations.length === 0 ? (
                <div className="text-center py-12 text-gray-500">
                  <TestTube className="w-16 h-16 mx-auto mb-4 text-gray-300" />
                  <p className="text-lg font-medium">No investigations ordered yet</p>
                  <p className="text-sm">Order investigations from the "Order New" tab</p>
                </div>
              ) : (
                investigations.map((inv) => (
                  <div key={inv.id} className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow">
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <h3 className="font-semibold text-lg">{inv.test_name}</h3>
                          <span className={`px-2 py-1 rounded text-xs font-medium ${getPriorityColor(inv.priority)}`}>
                            {inv.priority.toUpperCase()}
                          </span>
                          <span className={`px-2 py-1 rounded text-xs font-medium ${getStatusColor(inv.status)}`}>
                            {inv.status}
                          </span>
                        </div>
                        <p className="text-sm text-gray-600">{inv.test_category}</p>
                        {inv.clinical_indication && (
                          <p className="text-sm text-gray-700 mt-2">
                            <span className="font-medium">Indication:</span> {inv.clinical_indication}
                          </p>
                        )}
                        <p className="text-xs text-gray-500 mt-1">
                          Ordered: {format(inv.ordered_date, 'dd MMM yyyy HH:mm')}
                        </p>
                      </div>
                      <button
                        onClick={() => removeInvestigation(inv.id)}
                        className="text-red-600 hover:text-red-800 p-2"
                      >
                        <Trash2 className="w-5 h-5" />
                      </button>
                    </div>

                    {/* Results Summary */}
                    {inv.results && inv.results.length > 0 && (
                      <div className="mt-3 pt-3 border-t border-gray-200">
                        <h4 className="text-sm font-medium text-gray-700 mb-2">Results:</h4>
                        <div className="space-y-1">
                          {inv.results.map((result) => (
                            <div key={result.id} className="flex items-center justify-between text-sm">
                              <span className="text-gray-600">{result.parameter}:</span>
                              <div className="flex items-center gap-2">
                                <span className="font-medium">{result.value} {result.unit}</span>
                                {getFlagBadge(result.flag)}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          )}

          {/* Results Entry Tab */}
          {activeTab === 'results' && (
            <div className="space-y-6">
              {/* Select Investigation */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Select Investigation
                </label>
                <select
                  value={selectedInvestigation?.id || ''}
                  onChange={(e) => {
                    const inv = investigations.find(i => i.id === e.target.value);
                    setSelectedInvestigation(inv || null);
                    setShowResultEntry(!!inv);
                  }}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
                >
                  <option value="">-- Select Investigation --</option>
                  {investigations.map((inv) => (
                    <option key={inv.id} value={inv.id}>
                      {inv.test_name} - {format(inv.ordered_date, 'dd MMM yyyy')} ({inv.status})
                    </option>
                  ))}
                </select>
              </div>

              {/* Result Entry Form */}
              {showResultEntry && selectedInvestigation && (
                <div className="border border-gray-200 rounded-lg p-4 space-y-4">
                  <h3 className="font-semibold text-lg">Enter Result for {selectedInvestigation.test_name}</h3>
                  
                  {/* Parameter Selection */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Parameter
                    </label>
                    <select
                      value={resultForm.parameter}
                      onChange={(e) => setResultForm({ ...resultForm, parameter: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
                    >
                      <option value="">-- Select Parameter --</option>
                      {getSuggestedParameters(selectedInvestigation.test_name).map((param) => (
                        <option key={param} value={param}>
                          {param}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Reference Range Display */}
                  {resultForm.parameter && (
                    <div className="bg-blue-50 border border-blue-200 rounded p-3">
                      <p className="text-sm font-medium text-blue-900">
                        Reference Range: {getReferenceRange(
                          selectedInvestigation.test_name,
                          resultForm.parameter,
                          patientGender
                        )}
                      </p>
                    </div>
                  )}

                  {/* Value and Unit */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Value *
                      </label>
                      <input
                        type="number"
                        step="any"
                        value={resultForm.value}
                        onChange={(e) => setResultForm({ ...resultForm, value: e.target.value })}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
                        placeholder="e.g., 14.5"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Unit
                      </label>
                      <input
                        type="text"
                        value={resultForm.unit}
                        onChange={(e) => setResultForm({ ...resultForm, unit: e.target.value })}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
                        placeholder="e.g., g/dL, mmol/L"
                      />
                    </div>
                  </div>

                  {/* Result Date */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Result Date
                    </label>
                    <input
                      type="date"
                      value={resultForm.result_date}
                      onChange={(e) => setResultForm({ ...resultForm, result_date: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
                    />
                  </div>

                  {/* Preview Interpretation */}
                  {resultForm.parameter && resultForm.value && !isNaN(parseFloat(resultForm.value)) && (
                    <div className="border-t pt-4">
                      {(() => {
                        const interpretation = interpretLabResult(
                          selectedInvestigation.test_name,
                          resultForm.parameter,
                          parseFloat(resultForm.value),
                          patientGender
                        );
                        return (
                          <div className={`p-4 rounded-lg ${
                            interpretation.status === 'critical' ? 'bg-red-50 border-2 border-red-600' :
                            interpretation.status === 'abnormal' ? 'bg-orange-50 border border-orange-400' :
                            'bg-green-50 border border-green-400'
                          }`}>
                            <div className="flex items-start gap-3">
                              {interpretation.status === 'critical' && <AlertTriangle className="w-6 h-6 text-red-600 flex-shrink-0 mt-1" />}
                              {interpretation.status === 'abnormal' && <AlertTriangle className="w-6 h-6 text-orange-600 flex-shrink-0 mt-1" />}
                              {interpretation.status === 'normal' && <CheckCircle className="w-6 h-6 text-green-600 flex-shrink-0 mt-1" />}
                              <div className="flex-1">
                                <h4 className={`font-semibold mb-2 ${
                                  interpretation.status === 'critical' ? 'text-red-900' :
                                  interpretation.status === 'abnormal' ? 'text-orange-900' :
                                  'text-green-900'
                                }`}>
                                  {interpretation.message}
                                </h4>
                                <p className="text-sm text-gray-700 mb-2">
                                  <span className="font-medium">Clinical Significance:</span> {interpretation.clinical_significance}
                                </p>
                                {interpretation.suggested_actions && interpretation.suggested_actions.length > 0 && (
                                  <div className="text-sm">
                                    <span className="font-medium">Suggested Actions:</span>
                                    <ul className="list-disc list-inside mt-1 space-y-1">
                                      {interpretation.suggested_actions.map((action, idx) => (
                                        <li key={idx}>{action}</li>
                                      ))}
                                    </ul>
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      })()}
                    </div>
                  )}

                  {/* Add Result Button */}
                  <button
                    onClick={addResult}
                    className="w-full px-4 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 font-medium"
                  >
                    Add Result
                  </button>
                </div>
              )}

              {/* Existing Results for Selected Investigation */}
              {selectedInvestigation && selectedInvestigation.results && selectedInvestigation.results.length > 0 && (
                <div className="border border-gray-200 rounded-lg p-4">
                  <h3 className="font-semibold text-lg mb-4">Existing Results</h3>
                  <div className="space-y-3">
                    {selectedInvestigation.results.map((result) => (
                      <div key={result.id} className="border-l-4 pl-4 py-2" style={{
                        borderLeftColor: result.flag.includes('critical') ? '#DC2626' : 
                                       result.flag !== 'normal' ? '#F59E0B' : '#10B981'
                      }}>
                        <div className="flex items-center justify-between mb-2">
                          <span className="font-medium">{result.parameter}</span>
                          {getFlagBadge(result.flag)}
                        </div>
                        <p className="text-sm text-gray-700">
                          <span className="font-medium">{result.value} {result.unit}</span>
                          <span className="text-gray-500 ml-2">({result.reference_range})</span>
                        </p>
                        {result.interpretation && (
                          <p className="text-sm text-gray-600 mt-1">{result.interpretation}</p>
                        )}
                        <p className="text-xs text-gray-500 mt-1">
                          {format(result.result_date, 'dd MMM yyyy HH:mm')}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-gray-200 px-6 py-4 bg-gray-50 flex justify-between">
          <button
            onClick={onClose}
            className="px-6 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-100"
          >
            Cancel
          </button>
          <button
            onClick={() => {
              onSave(investigations);
              onClose();
            }}
            className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 font-medium"
          >
            Save Investigations ({investigations.length})
          </button>
        </div>
      </div>
    </div>
  );
};

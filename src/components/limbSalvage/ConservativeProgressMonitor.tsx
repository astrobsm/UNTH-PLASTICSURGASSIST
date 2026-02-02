import React, { useState, useEffect } from 'react';
import {
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  CheckCircle,
  Clock,
  Calendar,
  Activity,
  FileText,
  Plus,
  Eye,
  ChevronDown,
  ChevronUp,
  AlertCircle,
  Loader2,
  ArrowRight,
  Scissors
} from 'lucide-react';
import { diabeticFootService, DiabeticFootAssessment, RiskCategory } from '../../services/diabeticFootService';
import { patientService } from '../../services/patientService';

interface ProgressEntry {
  id: string;
  assessmentId: string;
  date: Date;
  woundStatus: 'improving' | 'stable' | 'deteriorating';
  woundSize: { length: number; width: number; depth: number };
  granulationPercentage: number;
  infectionSigns: string[];
  painLevel: number; // 0-10
  exudateAmount: 'none' | 'minimal' | 'moderate' | 'heavy';
  exudateType: 'serous' | 'sanguineous' | 'purulent' | 'serosanguineous';
  odor: boolean;
  woundEdges: 'well-defined' | 'undermined' | 'rolled' | 'fibrotic';
  surroundingSkin: string[];
  vascularStatus: 'improved' | 'stable' | 'worsened';
  offloadingCompliance: 'excellent' | 'good' | 'poor';
  glycemicControl: 'good' | 'moderate' | 'poor';
  antibioticTherapy?: string;
  notes: string;
  assessedBy: string;
  recommendAction: 'continue' | 'escalate' | 'consider_amputation' | 'urgent_amputation';
}

interface ConservativePatient {
  patientId: string;
  patientName: string;
  hospitalNumber?: string;
  latestAssessment: DiabeticFootAssessment;
  progressEntries: ProgressEntry[];
  daysOnConservative: number;
  trend: 'improving' | 'stable' | 'deteriorating';
  alertLevel: 'none' | 'warning' | 'critical';
  nextReviewDate?: Date;
}

interface ConservativeProgressMonitorProps {
  onSelectPatient?: (patientId: string) => void;
}

export const ConservativeProgressMonitor: React.FC<ConservativeProgressMonitorProps> = ({
  onSelectPatient
}) => {
  const [patients, setPatients] = useState<ConservativePatient[]>([]);
  const [selectedPatient, setSelectedPatient] = useState<ConservativePatient | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [showAddProgress, setShowAddProgress] = useState(false);
  const [expandedPatientId, setExpandedPatientId] = useState<string | null>(null);
  const [filterLevel, setFilterLevel] = useState<'all' | 'warning' | 'critical'>('all');

  useEffect(() => {
    loadConservativePatients();
  }, []);

  const loadConservativePatients = async () => {
    try {
      setIsLoading(true);
      const allAssessments = await diabeticFootService.getAllAssessments();
      const allPatients = await patientService.getAllPatients();

      // Get patients on conservative management (low to moderate risk, not critical)
      const conservativeAssessments = allAssessments.filter(a => 
        a.riskCategory === 'low_risk_limb_salvage_likely' ||
        a.riskCategory === 'moderate_risk_limb_salvage_possible' ||
        a.recommendedIntervention === 'conservative_management' ||
        a.recommendedIntervention === 'wound_care_debridement'
      );

      // Group by patient and get the latest assessment
      const patientMap = new Map<string, DiabeticFootAssessment[]>();
      conservativeAssessments.forEach(a => {
        const existing = patientMap.get(a.patientId) || [];
        existing.push(a);
        patientMap.set(a.patientId, existing);
      });

      const conservativePatients: ConservativePatient[] = [];

      patientMap.forEach((assessments, patientId) => {
        // Sort by date, most recent first
        assessments.sort((a, b) => 
          new Date(b.assessmentDate).getTime() - new Date(a.assessmentDate).getTime()
        );

        const latestAssessment = assessments[0];
        const patient = allPatients.find((p: any) => 
          p.id === patientId || String(p.id) === patientId
        );

        const patientName = patient 
          ? `${patient.first_name} ${patient.last_name}` 
          : 'Unknown Patient';

        // Calculate days on conservative management
        const firstAssessmentDate = new Date(assessments[assessments.length - 1].assessmentDate);
        const daysOnConservative = Math.floor(
          (Date.now() - firstAssessmentDate.getTime()) / (1000 * 60 * 60 * 24)
        );

        // Load progress entries from localStorage (would be database in production)
        const storedProgress = localStorage.getItem(`limb_salvage_progress_${patientId}`);
        const progressEntries: ProgressEntry[] = storedProgress 
          ? JSON.parse(storedProgress)
          : [];

        // Determine trend and alert level
        const { trend, alertLevel } = calculateTrendAndAlert(
          latestAssessment, 
          progressEntries, 
          daysOnConservative
        );

        conservativePatients.push({
          patientId,
          patientName,
          hospitalNumber: patient?.hospital_number,
          latestAssessment,
          progressEntries,
          daysOnConservative,
          trend,
          alertLevel,
          nextReviewDate: calculateNextReviewDate(latestAssessment, progressEntries)
        });
      });

      // Sort by alert level (critical first, then warning, then none)
      conservativePatients.sort((a, b) => {
        const alertOrder = { critical: 0, warning: 1, none: 2 };
        return alertOrder[a.alertLevel] - alertOrder[b.alertLevel];
      });

      setPatients(conservativePatients);
    } catch (error) {
      console.error('Error loading conservative patients:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const calculateTrendAndAlert = (
    assessment: DiabeticFootAssessment,
    progressEntries: ProgressEntry[],
    daysOnConservative: number
  ): { trend: 'improving' | 'stable' | 'deteriorating'; alertLevel: 'none' | 'warning' | 'critical' } => {
    // If no progress entries, check based on assessment
    if (progressEntries.length === 0) {
      // Long time without assessment is concerning
      if (daysOnConservative > 14) {
        return { trend: 'stable', alertLevel: 'warning' };
      }
      return { trend: 'stable', alertLevel: 'none' };
    }

    // Sort progress entries by date
    const sortedEntries = [...progressEntries].sort(
      (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
    );

    const recentEntry = sortedEntries[0];

    // Critical alerts
    if (recentEntry.recommendAction === 'urgent_amputation') {
      return { trend: 'deteriorating', alertLevel: 'critical' };
    }

    if (recentEntry.woundStatus === 'deteriorating' && sortedEntries.length >= 2) {
      const prevEntry = sortedEntries[1];
      if (prevEntry.woundStatus === 'deteriorating') {
        return { trend: 'deteriorating', alertLevel: 'critical' };
      }
    }

    // Check for infection signs
    if (recentEntry.infectionSigns.length >= 3 || recentEntry.odor) {
      return { trend: 'deteriorating', alertLevel: 'critical' };
    }

    // Warning alerts
    if (recentEntry.recommendAction === 'consider_amputation' || 
        recentEntry.recommendAction === 'escalate') {
      return { trend: 'deteriorating', alertLevel: 'warning' };
    }

    if (recentEntry.woundStatus === 'deteriorating') {
      return { trend: 'deteriorating', alertLevel: 'warning' };
    }

    if (recentEntry.granulationPercentage < 30 && daysOnConservative > 30) {
      return { trend: 'stable', alertLevel: 'warning' };
    }

    // Check for prolonged conservative management with no improvement
    if (daysOnConservative > 60 && recentEntry.woundStatus === 'stable') {
      return { trend: 'stable', alertLevel: 'warning' };
    }

    // Improving
    if (recentEntry.woundStatus === 'improving' && recentEntry.granulationPercentage > 50) {
      return { trend: 'improving', alertLevel: 'none' };
    }

    return { trend: recentEntry.woundStatus, alertLevel: 'none' };
  };

  const calculateNextReviewDate = (
    assessment: DiabeticFootAssessment,
    progressEntries: ProgressEntry[]
  ): Date => {
    const lastEntry = progressEntries.length > 0 
      ? new Date(progressEntries[progressEntries.length - 1].date)
      : new Date(assessment.assessmentDate);

    // Default to weekly reviews, more frequent for higher risk
    let daysToAdd = 7;
    if (assessment.riskCategory === 'moderate_risk_limb_salvage_possible') {
      daysToAdd = 3;
    } else if (assessment.riskCategory === 'high_risk_consider_amputation') {
      daysToAdd = 2;
    }

    const nextDate = new Date(lastEntry);
    nextDate.setDate(nextDate.getDate() + daysToAdd);
    return nextDate;
  };

  const getAlertBadge = (alertLevel: 'none' | 'warning' | 'critical') => {
    switch (alertLevel) {
      case 'critical':
        return (
          <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold bg-red-100 text-red-800 border border-red-300 animate-pulse">
            <AlertTriangle className="w-3 h-3 mr-1" />
            CRITICAL - Consider Amputation
          </span>
        );
      case 'warning':
        return (
          <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-orange-100 text-orange-800 border border-orange-300">
            <AlertCircle className="w-3 h-3 mr-1" />
            Warning - Needs Review
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800 border border-green-300">
            <CheckCircle className="w-3 h-3 mr-1" />
            On Track
          </span>
        );
    }
  };

  const getTrendIcon = (trend: 'improving' | 'stable' | 'deteriorating') => {
    switch (trend) {
      case 'improving':
        return <TrendingUp className="w-5 h-5 text-green-600" />;
      case 'deteriorating':
        return <TrendingDown className="w-5 h-5 text-red-600" />;
      default:
        return <Activity className="w-5 h-5 text-yellow-600" />;
    }
  };

  const filteredPatients = patients.filter(p => {
    if (filterLevel === 'all') return true;
    return p.alertLevel === filterLevel;
  });

  const criticalCount = patients.filter(p => p.alertLevel === 'critical').length;
  const warningCount = patients.filter(p => p.alertLevel === 'warning').length;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-primary-600" />
        <span className="ml-2 text-gray-600">Loading conservative management patients...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Alert Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div 
          onClick={() => setFilterLevel('critical')}
          className={`bg-white rounded-lg shadow p-4 border-l-4 border-red-500 cursor-pointer hover:shadow-md transition-shadow ${filterLevel === 'critical' ? 'ring-2 ring-red-500' : ''}`}
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Critical - Consider Amputation</p>
              <p className="text-3xl font-bold text-red-600">{criticalCount}</p>
            </div>
            <AlertTriangle className="w-10 h-10 text-red-200" />
          </div>
          <p className="text-xs text-gray-500 mt-2">
            Patients showing deterioration requiring urgent review
          </p>
        </div>

        <div 
          onClick={() => setFilterLevel('warning')}
          className={`bg-white rounded-lg shadow p-4 border-l-4 border-orange-500 cursor-pointer hover:shadow-md transition-shadow ${filterLevel === 'warning' ? 'ring-2 ring-orange-500' : ''}`}
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Warning - Needs Review</p>
              <p className="text-3xl font-bold text-orange-600">{warningCount}</p>
            </div>
            <AlertCircle className="w-10 h-10 text-orange-200" />
          </div>
          <p className="text-xs text-gray-500 mt-2">
            Patients with slow progress or overdue reviews
          </p>
        </div>

        <div 
          onClick={() => setFilterLevel('all')}
          className={`bg-white rounded-lg shadow p-4 border-l-4 border-green-500 cursor-pointer hover:shadow-md transition-shadow ${filterLevel === 'all' ? 'ring-2 ring-green-500' : ''}`}
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Total on Conservative</p>
              <p className="text-3xl font-bold text-green-600">{patients.length}</p>
            </div>
            <Activity className="w-10 h-10 text-green-200" />
          </div>
          <p className="text-xs text-gray-500 mt-2">
            All patients being managed conservatively
          </p>
        </div>
      </div>

      {/* Decision Support Box */}
      {criticalCount > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="flex items-start">
            <AlertTriangle className="w-6 h-6 text-red-600 mt-0.5" />
            <div className="ml-3">
              <h3 className="text-lg font-semibold text-red-800">
                ⚠️ Amputation Decision Required
              </h3>
              <p className="text-red-700 mt-1">
                {criticalCount} patient(s) are showing signs of deterioration despite conservative management. 
                Consider escalating to surgical intervention to avoid unnecessary delays and complications.
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <span className="text-xs text-red-600 bg-red-100 px-2 py-1 rounded">
                  Worsening wound status
                </span>
                <span className="text-xs text-red-600 bg-red-100 px-2 py-1 rounded">
                  Multiple infection signs
                </span>
                <span className="text-xs text-red-600 bg-red-100 px-2 py-1 rounded">
                  Prolonged conservative treatment
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Patient List */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200 bg-gray-50">
          <h3 className="text-lg font-semibold text-gray-900">
            Conservative Management Patients
          </h3>
          <p className="text-sm text-gray-500">
            Monitor wound healing progress and identify when to escalate to amputation
          </p>
        </div>

        {filteredPatients.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            <Activity className="w-12 h-12 mx-auto mb-4 text-gray-300" />
            <p className="text-lg font-medium">
              {filterLevel === 'all' 
                ? 'No patients on conservative management' 
                : `No ${filterLevel} level patients`}
            </p>
            <p className="text-sm">
              Patients with low to moderate risk assessments will appear here
            </p>
          </div>
        ) : (
          <div className="divide-y divide-gray-200">
            {filteredPatients.map((patient) => (
              <div key={patient.patientId} className="hover:bg-gray-50">
                <div 
                  className="px-6 py-4 cursor-pointer"
                  onClick={() => setExpandedPatientId(
                    expandedPatientId === patient.patientId ? null : patient.patientId
                  )}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-4">
                      <div className="flex-shrink-0">
                        {getTrendIcon(patient.trend)}
                      </div>
                      <div>
                        <h4 className="text-lg font-medium text-gray-900">
                          {patient.patientName}
                        </h4>
                        <div className="flex items-center space-x-3 text-sm text-gray-500">
                          {patient.hospitalNumber && (
                            <span>#{patient.hospitalNumber}</span>
                          )}
                          <span className="flex items-center">
                            <Clock className="w-4 h-4 mr-1" />
                            {patient.daysOnConservative} days
                          </span>
                          <span className="flex items-center">
                            <FileText className="w-4 h-4 mr-1" />
                            {patient.progressEntries.length} reviews
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center space-x-3">
                      {getAlertBadge(patient.alertLevel)}
                      {expandedPatientId === patient.patientId ? (
                        <ChevronUp className="w-5 h-5 text-gray-400" />
                      ) : (
                        <ChevronDown className="w-5 h-5 text-gray-400" />
                      )}
                    </div>
                  </div>

                  {/* Next Review Date Warning */}
                  {patient.nextReviewDate && new Date(patient.nextReviewDate) < new Date() && (
                    <div className="mt-2 text-sm text-orange-600 flex items-center">
                      <AlertCircle className="w-4 h-4 mr-1" />
                      Review overdue since {new Date(patient.nextReviewDate).toLocaleDateString()}
                    </div>
                  )}
                </div>

                {/* Expanded Details */}
                {expandedPatientId === patient.patientId && (
                  <div className="px-6 pb-4 bg-gray-50 border-t border-gray-100">
                    {/* Quick Actions */}
                    <div className="flex flex-wrap gap-2 py-4">
                      <button 
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedPatient(patient);
                          setShowAddProgress(true);
                        }}
                        className="inline-flex items-center px-3 py-2 bg-primary-600 text-white text-sm rounded-lg hover:bg-primary-700"
                      >
                        <Plus className="w-4 h-4 mr-1" />
                        Add Progress Note
                      </button>
                      <button 
                        onClick={(e) => {
                          e.stopPropagation();
                          onSelectPatient?.(patient.patientId);
                        }}
                        className="inline-flex items-center px-3 py-2 bg-gray-600 text-white text-sm rounded-lg hover:bg-gray-700"
                      >
                        <Eye className="w-4 h-4 mr-1" />
                        View Full Assessment
                      </button>
                      {patient.alertLevel === 'critical' && (
                        <button className="inline-flex items-center px-3 py-2 bg-red-600 text-white text-sm rounded-lg hover:bg-red-700">
                          <Scissors className="w-4 h-4 mr-1" />
                          Schedule Amputation
                        </button>
                      )}
                    </div>

                    {/* Progress Timeline */}
                    {patient.progressEntries.length > 0 ? (
                      <div className="mt-2">
                        <h5 className="text-sm font-semibold text-gray-700 mb-3">Progress Timeline</h5>
                        <div className="space-y-3">
                          {patient.progressEntries.slice(0, 3).map((entry, index) => (
                            <div 
                              key={entry.id} 
                              className={`p-3 rounded-lg border ${
                                entry.woundStatus === 'deteriorating' 
                                  ? 'bg-red-50 border-red-200'
                                  : entry.woundStatus === 'improving'
                                  ? 'bg-green-50 border-green-200'
                                  : 'bg-gray-50 border-gray-200'
                              }`}
                            >
                              <div className="flex items-center justify-between">
                                <div className="flex items-center">
                                  <Calendar className="w-4 h-4 mr-2 text-gray-400" />
                                  <span className="text-sm font-medium">
                                    {new Date(entry.date).toLocaleDateString()}
                                  </span>
                                </div>
                                <span className={`text-xs font-medium px-2 py-1 rounded ${
                                  entry.woundStatus === 'deteriorating' 
                                    ? 'bg-red-100 text-red-700'
                                    : entry.woundStatus === 'improving'
                                    ? 'bg-green-100 text-green-700'
                                    : 'bg-gray-100 text-gray-700'
                                }`}>
                                  {entry.woundStatus.charAt(0).toUpperCase() + entry.woundStatus.slice(1)}
                                </span>
                              </div>
                              <div className="mt-2 grid grid-cols-3 gap-2 text-xs text-gray-600">
                                <div>
                                  <span className="font-medium">Granulation:</span> {entry.granulationPercentage}%
                                </div>
                                <div>
                                  <span className="font-medium">Pain:</span> {entry.painLevel}/10
                                </div>
                                <div>
                                  <span className="font-medium">Exudate:</span> {entry.exudateAmount}
                                </div>
                              </div>
                              {entry.infectionSigns.length > 0 && (
                                <div className="mt-2 text-xs text-red-600">
                                  ⚠️ Infection signs: {entry.infectionSigns.join(', ')}
                                </div>
                              )}
                              {entry.notes && (
                                <p className="mt-2 text-xs text-gray-500 italic">"{entry.notes}"</p>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : (
                      <div className="mt-2 p-4 bg-yellow-50 rounded-lg text-center">
                        <p className="text-sm text-yellow-700">
                          No progress notes recorded yet. Add a progress note to track wound healing.
                        </p>
                      </div>
                    )}

                    {/* Amputation Decision Guide */}
                    {(patient.alertLevel === 'critical' || patient.alertLevel === 'warning') && (
                      <div className="mt-4 p-4 bg-amber-50 rounded-lg border border-amber-200">
                        <h5 className="text-sm font-bold text-amber-800 flex items-center">
                          <AlertTriangle className="w-4 h-4 mr-2" />
                          Amputation Decision Guide
                        </h5>
                        <div className="mt-2 text-sm text-amber-700 space-y-1">
                          <p className="flex items-center">
                            <ArrowRight className="w-3 h-3 mr-2" />
                            Progressive tissue necrosis despite treatment
                          </p>
                          <p className="flex items-center">
                            <ArrowRight className="w-3 h-3 mr-2" />
                            Uncontrolled infection with sepsis risk
                          </p>
                          <p className="flex items-center">
                            <ArrowRight className="w-3 h-3 mr-2" />
                            No improvement after 4-6 weeks of conservative Rx
                          </p>
                          <p className="flex items-center">
                            <ArrowRight className="w-3 h-3 mr-2" />
                            Non-reconstructible vascular disease
                          </p>
                          <p className="flex items-center">
                            <ArrowRight className="w-3 h-3 mr-2" />
                            Severe pain limiting quality of life
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Add Progress Modal */}
      {showAddProgress && selectedPatient && (
        <ProgressEntryModal
          patient={selectedPatient}
          onSave={(entry) => {
            // Save progress entry
            const existingEntries = JSON.parse(
              localStorage.getItem(`limb_salvage_progress_${selectedPatient.patientId}`) || '[]'
            );
            existingEntries.push(entry);
            localStorage.setItem(
              `limb_salvage_progress_${selectedPatient.patientId}`,
              JSON.stringify(existingEntries)
            );
            setShowAddProgress(false);
            loadConservativePatients();
          }}
          onClose={() => setShowAddProgress(false)}
        />
      )}
    </div>
  );
};

// Progress Entry Modal Component
interface ProgressEntryModalProps {
  patient: ConservativePatient;
  onSave: (entry: ProgressEntry) => void;
  onClose: () => void;
}

const ProgressEntryModal: React.FC<ProgressEntryModalProps> = ({
  patient,
  onSave,
  onClose
}) => {
  const [entry, setEntry] = useState<Partial<ProgressEntry>>({
    woundStatus: 'stable',
    woundSize: { length: 0, width: 0, depth: 0 },
    granulationPercentage: 50,
    infectionSigns: [],
    painLevel: 3,
    exudateAmount: 'minimal',
    exudateType: 'serous',
    odor: false,
    woundEdges: 'well-defined',
    surroundingSkin: [],
    vascularStatus: 'stable',
    offloadingCompliance: 'good',
    glycemicControl: 'moderate',
    notes: '',
    recommendAction: 'continue'
  });

  const infectionSignOptions = [
    'Erythema', 'Warmth', 'Swelling', 'Purulent discharge', 
    'Increased pain', 'Fever', 'Lymphangitis', 'Crepitus'
  ];

  const surroundingSkinOptions = [
    'Normal', 'Macerated', 'Dry/Scaly', 'Eczematous', 
    'Callused', 'Edematous', 'Discolored'
  ];

  const handleSave = () => {
    const newEntry: ProgressEntry = {
      id: `progress_${Date.now()}`,
      assessmentId: patient.latestAssessment.id,
      date: new Date(),
      woundStatus: entry.woundStatus!,
      woundSize: entry.woundSize!,
      granulationPercentage: entry.granulationPercentage!,
      infectionSigns: entry.infectionSigns!,
      painLevel: entry.painLevel!,
      exudateAmount: entry.exudateAmount!,
      exudateType: entry.exudateType!,
      odor: entry.odor!,
      woundEdges: entry.woundEdges!,
      surroundingSkin: entry.surroundingSkin!,
      vascularStatus: entry.vascularStatus!,
      offloadingCompliance: entry.offloadingCompliance!,
      glycemicControl: entry.glycemicControl!,
      antibioticTherapy: entry.antibioticTherapy,
      notes: entry.notes!,
      assessedBy: localStorage.getItem('userName') || 'Unknown',
      recommendAction: entry.recommendAction!
    };
    onSave(newEntry);
  };

  const toggleInfectionSign = (sign: string) => {
    const current = entry.infectionSigns || [];
    if (current.includes(sign)) {
      setEntry({ ...entry, infectionSigns: current.filter(s => s !== sign) });
    } else {
      setEntry({ ...entry, infectionSigns: [...current, sign] });
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50 overflow-y-auto">
      <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="bg-primary-600 text-white p-6 sticky top-0">
          <h2 className="text-xl font-bold">Add Progress Note</h2>
          <p className="text-primary-100 text-sm">
            {patient.patientName} - Day {patient.daysOnConservative} of conservative management
          </p>
        </div>

        <div className="p-6 space-y-6">
          {/* Wound Status */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Overall Wound Status *
            </label>
            <div className="grid grid-cols-3 gap-2">
              {(['improving', 'stable', 'deteriorating'] as const).map(status => (
                <button
                  key={status}
                  onClick={() => setEntry({ ...entry, woundStatus: status })}
                  className={`py-3 px-4 rounded-lg border-2 text-sm font-medium transition-colors ${
                    entry.woundStatus === status
                      ? status === 'improving' 
                        ? 'border-green-500 bg-green-50 text-green-700'
                        : status === 'deteriorating'
                        ? 'border-red-500 bg-red-50 text-red-700'
                        : 'border-yellow-500 bg-yellow-50 text-yellow-700'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  {status === 'improving' && <TrendingUp className="w-5 h-5 mx-auto mb-1" />}
                  {status === 'stable' && <Activity className="w-5 h-5 mx-auto mb-1" />}
                  {status === 'deteriorating' && <TrendingDown className="w-5 h-5 mx-auto mb-1" />}
                  {status.charAt(0).toUpperCase() + status.slice(1)}
                </button>
              ))}
            </div>
          </div>

          {/* Wound Measurements */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Wound Size (cm)
            </label>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="text-xs text-gray-500">Length</label>
                <input
                  type="number"
                  step="0.1"
                  value={entry.woundSize?.length || 0}
                  onChange={(e) => setEntry({
                    ...entry,
                    woundSize: { ...entry.woundSize!, length: parseFloat(e.target.value) || 0 }
                  })}
                  className="w-full px-3 py-2 border rounded-lg"
                />
              </div>
              <div>
                <label className="text-xs text-gray-500">Width</label>
                <input
                  type="number"
                  step="0.1"
                  value={entry.woundSize?.width || 0}
                  onChange={(e) => setEntry({
                    ...entry,
                    woundSize: { ...entry.woundSize!, width: parseFloat(e.target.value) || 0 }
                  })}
                  className="w-full px-3 py-2 border rounded-lg"
                />
              </div>
              <div>
                <label className="text-xs text-gray-500">Depth</label>
                <input
                  type="number"
                  step="0.1"
                  value={entry.woundSize?.depth || 0}
                  onChange={(e) => setEntry({
                    ...entry,
                    woundSize: { ...entry.woundSize!, depth: parseFloat(e.target.value) || 0 }
                  })}
                  className="w-full px-3 py-2 border rounded-lg"
                />
              </div>
            </div>
          </div>

          {/* Granulation & Pain */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Granulation Tissue: {entry.granulationPercentage}%
              </label>
              <input
                type="range"
                min="0"
                max="100"
                value={entry.granulationPercentage}
                onChange={(e) => setEntry({ ...entry, granulationPercentage: parseInt(e.target.value) })}
                className="w-full"
              />
              <div className="flex justify-between text-xs text-gray-500">
                <span>0% (None)</span>
                <span>100% (Fully covered)</span>
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Pain Level: {entry.painLevel}/10
              </label>
              <input
                type="range"
                min="0"
                max="10"
                value={entry.painLevel}
                onChange={(e) => setEntry({ ...entry, painLevel: parseInt(e.target.value) })}
                className="w-full"
              />
              <div className="flex justify-between text-xs text-gray-500">
                <span>No pain</span>
                <span>Severe</span>
              </div>
            </div>
          </div>

          {/* Infection Signs */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Signs of Infection
            </label>
            <div className="flex flex-wrap gap-2">
              {infectionSignOptions.map(sign => (
                <button
                  key={sign}
                  onClick={() => toggleInfectionSign(sign)}
                  className={`px-3 py-1 rounded-full text-sm transition-colors ${
                    entry.infectionSigns?.includes(sign)
                      ? 'bg-red-100 text-red-700 border-2 border-red-300'
                      : 'bg-gray-100 text-gray-600 border-2 border-transparent hover:bg-gray-200'
                  }`}
                >
                  {sign}
                </button>
              ))}
            </div>
            <label className="flex items-center mt-3 text-sm">
              <input
                type="checkbox"
                checked={entry.odor}
                onChange={(e) => setEntry({ ...entry, odor: e.target.checked })}
                className="rounded border-gray-300 text-red-600 mr-2"
              />
              Foul odor present
            </label>
          </div>

          {/* Exudate */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Exudate Amount
              </label>
              <select
                value={entry.exudateAmount}
                onChange={(e) => setEntry({ ...entry, exudateAmount: e.target.value as any })}
                className="w-full px-3 py-2 border rounded-lg"
              >
                <option value="none">None</option>
                <option value="minimal">Minimal</option>
                <option value="moderate">Moderate</option>
                <option value="heavy">Heavy</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Exudate Type
              </label>
              <select
                value={entry.exudateType}
                onChange={(e) => setEntry({ ...entry, exudateType: e.target.value as any })}
                className="w-full px-3 py-2 border rounded-lg"
              >
                <option value="serous">Serous (clear)</option>
                <option value="sanguineous">Sanguineous (bloody)</option>
                <option value="serosanguineous">Serosanguineous</option>
                <option value="purulent">Purulent (pus)</option>
              </select>
            </div>
          </div>

          {/* Compliance */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Offloading Compliance
              </label>
              <select
                value={entry.offloadingCompliance}
                onChange={(e) => setEntry({ ...entry, offloadingCompliance: e.target.value as any })}
                className="w-full px-3 py-2 border rounded-lg"
              >
                <option value="excellent">Excellent</option>
                <option value="good">Good</option>
                <option value="poor">Poor</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Glycemic Control
              </label>
              <select
                value={entry.glycemicControl}
                onChange={(e) => setEntry({ ...entry, glycemicControl: e.target.value as any })}
                className="w-full px-3 py-2 border rounded-lg"
              >
                <option value="good">Good (HbA1c &lt; 7%)</option>
                <option value="moderate">Moderate (7-9%)</option>
                <option value="poor">Poor (&gt; 9%)</option>
              </select>
            </div>
          </div>

          {/* Recommendation */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Recommended Action *
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => setEntry({ ...entry, recommendAction: 'continue' })}
                className={`py-3 px-4 rounded-lg border-2 text-sm transition-colors ${
                  entry.recommendAction === 'continue'
                    ? 'border-green-500 bg-green-50 text-green-700'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <CheckCircle className="w-5 h-5 mx-auto mb-1" />
                Continue Conservative
              </button>
              <button
                onClick={() => setEntry({ ...entry, recommendAction: 'escalate' })}
                className={`py-3 px-4 rounded-lg border-2 text-sm transition-colors ${
                  entry.recommendAction === 'escalate'
                    ? 'border-orange-500 bg-orange-50 text-orange-700'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <AlertCircle className="w-5 h-5 mx-auto mb-1" />
                Escalate Treatment
              </button>
              <button
                onClick={() => setEntry({ ...entry, recommendAction: 'consider_amputation' })}
                className={`py-3 px-4 rounded-lg border-2 text-sm transition-colors ${
                  entry.recommendAction === 'consider_amputation'
                    ? 'border-red-500 bg-red-50 text-red-700'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <AlertTriangle className="w-5 h-5 mx-auto mb-1" />
                Consider Amputation
              </button>
              <button
                onClick={() => setEntry({ ...entry, recommendAction: 'urgent_amputation' })}
                className={`py-3 px-4 rounded-lg border-2 text-sm transition-colors ${
                  entry.recommendAction === 'urgent_amputation'
                    ? 'border-red-700 bg-red-100 text-red-800'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <Scissors className="w-5 h-5 mx-auto mb-1" />
                Urgent Amputation
              </button>
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Clinical Notes
            </label>
            <textarea
              value={entry.notes}
              onChange={(e) => setEntry({ ...entry, notes: e.target.value })}
              rows={3}
              className="w-full px-3 py-2 border rounded-lg"
              placeholder="Additional observations, treatment changes, etc."
            />
          </div>
        </div>

        {/* Footer */}
        <div className="p-6 border-t bg-gray-50 flex justify-end gap-3 sticky bottom-0">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="px-6 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700"
          >
            Save Progress Note
          </button>
        </div>
      </div>
    </div>
  );
};

export default ConservativeProgressMonitor;

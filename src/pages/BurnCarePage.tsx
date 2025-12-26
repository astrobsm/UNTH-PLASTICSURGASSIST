import React, { useState, useEffect } from 'react';
import { 
  Flame, 
  Plus, 
  Search, 
  Filter,
  AlertTriangle,
  Activity,
  Droplets,
  ThermometerSun,
  Users,
  Clock,
  TrendingUp,
  ChevronRight,
  Bed,
  HeartPulse,
  RefreshCw
} from 'lucide-react';
import { BurnPatient, BurnAlert, burnCareService } from '../services/burnCareService';
import BurnAdmissionForm from '../components/burnCare/BurnAdmissionForm';
import BurnMonitoringDashboard from '../components/burnCare/BurnMonitoringDashboard';

interface BurnStats {
  activePatients: number;
  icuPatients: number;
  wardPatients: number;
  criticalAlerts: number;
  pendingAssessments: number;
  avgTBSA: number;
}

const BurnCarePage: React.FC = () => {
  const [view, setView] = useState<'list' | 'admission' | 'monitoring'>('list');
  const [patients, setPatients] = useState<BurnPatient[]>([]);
  const [selectedPatient, setSelectedPatient] = useState<BurnPatient | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<'all' | 'active' | 'icu' | 'critical'>('all');
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<BurnStats>({
    activePatients: 0,
    icuPatients: 0,
    wardPatients: 0,
    criticalAlerts: 0,
    pendingAssessments: 0,
    avgTBSA: 0,
  });

  // Mock data for demonstration
  useEffect(() => {
    // In production, this would fetch from API
    const mockPatients: BurnPatient[] = [
      {
        id: '1',
        patientId: 'P001',
        admissionDate: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
        timeOfBurn: new Date(Date.now() - 2.5 * 24 * 60 * 60 * 1000),
        mechanism: 'flame',
        tbsaAssessment: {
          method: 'lund_browder',
          totalTBSA: 25,
          regions: [],
          assessmentDate: new Date(),
          assessedBy: 'Dr. Smith'
        },
        bauxScore: 55,
        revisedBauxScore: 72,
        absiScore: {
          agePoints: 2,
          sexPoints: 1,
          tbsaPoints: 3,
          fullThicknessPoints: 1,
          inhalationInjuryPoints: 1,
          totalScore: 8,
          mortalityRisk: '70-80%'
        },
        inhalationInjury: {
          suspected: true,
          confirmed: true,
          signs: {
            facialBurn: true,
            singedNasalHairs: true,
            carbonaceousSputum: true,
            hoarseness: false,
            stridorOrWheezing: false,
            enclosedSpaceBurn: true,
            alteredConsciousness: false
          },
          bronchoscopyPerformed: true,
          bronchoscopyGrade: 2,
          intubated: true,
          intubationDate: new Date()
        },
        age: 30,
        weight: 70,
        gender: 'male',
        resuscitation: burnCareService.calculateParklandFormula(70, 25, new Date(Date.now() - 2.5 * 24 * 60 * 60 * 1000)),
        monitoring: {
          vitals: [],
          urineOutputs: [],
          fluidBalance: { inputs: [], outputs: [], cumulative24h: 0, cumulative48h: 0, cumulativeTotal: 0 },
          labs: [],
          woundAssessments: [],
          painScores: []
        },
        activeAlerts: [
          {
            id: 'a1',
            type: 'low_urine_output',
            severity: 'critical',
            message: 'Low urine output: 0.3 mL/kg/hr for 2 consecutive hours',
            criteria: 'UO < 0.5 mL/kg/hr',
            suggestedAction: 'Increase crystalloid infusion by 20-30%',
            createdAt: new Date(),
            status: 'open'
          }
        ],
        status: 'active',
        disposition: 'icu',
        tetanusStatus: 'current',
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        id: '2',
        patientId: 'P002',
        admissionDate: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
        timeOfBurn: new Date(Date.now() - 5.2 * 24 * 60 * 60 * 1000),
        mechanism: 'scald',
        tbsaAssessment: {
          method: 'lund_browder',
          totalTBSA: 12,
          regions: [],
          assessmentDate: new Date(),
          assessedBy: 'Dr. Johnson'
        },
        bauxScore: 57,
        revisedBauxScore: 57,
        absiScore: {
          agePoints: 3,
          sexPoints: 0,
          tbsaPoints: 2,
          fullThicknessPoints: 0,
          inhalationInjuryPoints: 0,
          totalScore: 5,
          mortalityRisk: '10-20%'
        },
        inhalationInjury: {
          suspected: false,
          confirmed: false,
          signs: {
            facialBurn: false,
            singedNasalHairs: false,
            carbonaceousSputum: false,
            hoarseness: false,
            stridorOrWheezing: false,
            enclosedSpaceBurn: false,
            alteredConsciousness: false
          },
          bronchoscopyPerformed: false,
          intubated: false
        },
        age: 45,
        weight: 65,
        gender: 'female',
        resuscitation: burnCareService.calculateParklandFormula(65, 12, new Date(Date.now() - 5.2 * 24 * 60 * 60 * 1000)),
        monitoring: {
          vitals: [],
          urineOutputs: [],
          fluidBalance: { inputs: [], outputs: [], cumulative24h: 0, cumulative48h: 0, cumulativeTotal: 0 },
          labs: [],
          woundAssessments: [],
          painScores: []
        },
        activeAlerts: [],
        status: 'active',
        disposition: 'ward',
        tetanusStatus: 'current',
        createdAt: new Date(),
        updatedAt: new Date()
      }
    ];

    setPatients(mockPatients);
    
    // Calculate stats
    const activePatients = mockPatients.filter(p => p.status === 'active').length;
    const icuPatients = mockPatients.filter(p => p.disposition === 'icu').length;
    const wardPatients = mockPatients.filter(p => p.disposition === 'ward').length;
    const criticalAlerts = mockPatients.reduce((sum, p) => 
      sum + p.activeAlerts.filter(a => a.severity === 'critical' && a.status === 'open').length, 0);
    const avgTBSA = mockPatients.length > 0 
      ? mockPatients.reduce((sum, p) => sum + p.tbsaAssessment.totalTBSA, 0) / mockPatients.length 
      : 0;

    setStats({
      activePatients,
      icuPatients,
      wardPatients,
      criticalAlerts,
      pendingAssessments: 3,
      avgTBSA: Math.round(avgTBSA * 10) / 10
    });

    setLoading(false);
  }, []);

  const filteredPatients = patients.filter(patient => {
    const matchesSearch = (patient.patientId || '').toLowerCase().includes(searchTerm.toLowerCase());
    const matchesFilter = 
      filterStatus === 'all' ||
      (filterStatus === 'active' && patient.status === 'active') ||
      (filterStatus === 'icu' && patient.disposition === 'icu') ||
      (filterStatus === 'critical' && patient.activeAlerts?.some(a => a.severity === 'critical'));
    return matchesSearch && matchesFilter;
  });

  const handleNewAdmission = () => {
    setSelectedPatient(null);
    setView('admission');
  };

  const handleViewMonitoring = (patient: BurnPatient) => {
    setSelectedPatient(patient);
    setView('monitoring');
  };

  const handleAdmissionComplete = (newPatient: BurnPatient) => {
    setPatients(prev => [...prev, newPatient]);
    setView('list');
  };

  const getSeverityBadge = (patient: BurnPatient) => {
    const criticalAlerts = patient.activeAlerts.filter(a => a.severity === 'critical' && a.status === 'open');
    if (criticalAlerts.length > 0) {
      return (
        <span className="px-2 py-1 bg-red-100 text-red-800 rounded-full text-xs font-medium flex items-center gap-1">
          <AlertTriangle className="h-3 w-3" />
          {criticalAlerts.length} Critical
        </span>
      );
    }
    if (patient.disposition === 'icu') {
      return (
        <span className="px-2 py-1 bg-orange-100 text-orange-800 rounded-full text-xs font-medium">
          ICU
        </span>
      );
    }
    return (
      <span className="px-2 py-1 bg-green-100 text-green-800 rounded-full text-xs font-medium">
        Stable
      </span>
    );
  };

  const getTimeSinceBurn = (timeOfBurn: Date): string => {
    const hours = Math.floor((Date.now() - new Date(timeOfBurn).getTime()) / (1000 * 60 * 60));
    if (hours < 24) return `${hours}h`;
    const days = Math.floor(hours / 24);
    return `${days}d ${hours % 24}h`;
  };

  if (view === 'admission') {
    return (
      <BurnAdmissionForm 
        onComplete={handleAdmissionComplete}
        onCancel={() => setView('list')}
      />
    );
  }

  if (view === 'monitoring' && selectedPatient) {
    return (
      <BurnMonitoringDashboard 
        patient={selectedPatient}
        onBack={() => setView('list')}
      />
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-gradient-to-r from-orange-600 to-red-600 text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-white/20 rounded-lg">
                <Flame className="h-8 w-8" />
              </div>
              <div>
                <h1 className="text-2xl font-bold">Burn Care Protocol</h1>
                <p className="text-orange-100 text-sm">WHO/ISBI Compliant Management</p>
              </div>
            </div>
            <button
              onClick={handleNewAdmission}
              className="flex items-center gap-2 bg-white text-orange-600 px-4 py-2 rounded-lg font-medium hover:bg-orange-50 transition-colors"
            >
              <Plus className="h-5 w-5" />
              New Burn Admission
            </button>
          </div>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 -mt-6">
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          <div className="bg-white rounded-xl shadow-lg p-4 border-l-4 border-orange-500">
            <div className="flex items-center gap-3">
              <Users className="h-8 w-8 text-orange-500" />
              <div>
                <p className="text-2xl font-bold text-gray-900">{stats.activePatients}</p>
                <p className="text-xs text-gray-500">Active Patients</p>
              </div>
            </div>
          </div>
          
          <div className="bg-white rounded-xl shadow-lg p-4 border-l-4 border-red-500">
            <div className="flex items-center gap-3">
              <HeartPulse className="h-8 w-8 text-red-500" />
              <div>
                <p className="text-2xl font-bold text-gray-900">{stats.icuPatients}</p>
                <p className="text-xs text-gray-500">ICU Patients</p>
              </div>
            </div>
          </div>
          
          <div className="bg-white rounded-xl shadow-lg p-4 border-l-4 border-blue-500">
            <div className="flex items-center gap-3">
              <Bed className="h-8 w-8 text-blue-500" />
              <div>
                <p className="text-2xl font-bold text-gray-900">{stats.wardPatients}</p>
                <p className="text-xs text-gray-500">Ward Patients</p>
              </div>
            </div>
          </div>
          
          <div className="bg-white rounded-xl shadow-lg p-4 border-l-4 border-red-600">
            <div className="flex items-center gap-3">
              <AlertTriangle className="h-8 w-8 text-red-600" />
              <div>
                <p className="text-2xl font-bold text-gray-900">{stats.criticalAlerts}</p>
                <p className="text-xs text-gray-500">Critical Alerts</p>
              </div>
            </div>
          </div>
          
          <div className="bg-white rounded-xl shadow-lg p-4 border-l-4 border-yellow-500">
            <div className="flex items-center gap-3">
              <Clock className="h-8 w-8 text-yellow-500" />
              <div>
                <p className="text-2xl font-bold text-gray-900">{stats.pendingAssessments}</p>
                <p className="text-xs text-gray-500">Pending Reviews</p>
              </div>
            </div>
          </div>
          
          <div className="bg-white rounded-xl shadow-lg p-4 border-l-4 border-purple-500">
            <div className="flex items-center gap-3">
              <TrendingUp className="h-8 w-8 text-purple-500" />
              <div>
                <p className="text-2xl font-bold text-gray-900">{stats.avgTBSA}%</p>
                <p className="text-xs text-gray-500">Avg TBSA</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Search and Filter */}
        <div className="bg-white rounded-lg shadow-sm p-4 mb-6">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
              <input
                type="text"
                placeholder="Search patients..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
              />
            </div>
            <div className="flex gap-2">
              {(['all', 'active', 'icu', 'critical'] as const).map((filter) => (
                <button
                  key={filter}
                  onClick={() => setFilterStatus(filter)}
                  className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                    filterStatus === filter
                      ? 'bg-orange-600 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  {filter.charAt(0).toUpperCase() + filter.slice(1)}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Patient List */}
        <div className="bg-white rounded-lg shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900">Active Burn Patients</h2>
          </div>
          
          {loading ? (
            <div className="p-12 text-center">
              <RefreshCw className="h-8 w-8 text-gray-400 animate-spin mx-auto mb-4" />
              <p className="text-gray-500">Loading patients...</p>
            </div>
          ) : filteredPatients.length === 0 ? (
            <div className="p-12 text-center">
              <Flame className="h-12 w-12 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-500 mb-4">No burn patients found</p>
              <button
                onClick={handleNewAdmission}
                className="text-orange-600 hover:text-orange-700 font-medium"
              >
                Add new admission
              </button>
            </div>
          ) : (
            <div className="divide-y divide-gray-200">
              {filteredPatients.map((patient) => (
                <div
                  key={patient.id}
                  className="px-6 py-4 hover:bg-gray-50 cursor-pointer transition-colors"
                  onClick={() => handleViewMonitoring(patient)}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className={`w-12 h-12 rounded-full flex items-center justify-center ${
                        patient.disposition === 'icu' ? 'bg-red-100' : 'bg-orange-100'
                      }`}>
                        <Flame className={`h-6 w-6 ${
                          patient.disposition === 'icu' ? 'text-red-600' : 'text-orange-600'
                        }`} />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-gray-900">{patient.patientId}</span>
                          {getSeverityBadge(patient)}
                        </div>
                        <div className="flex items-center gap-4 text-sm text-gray-500 mt-1">
                          <span className="flex items-center gap-1">
                            <ThermometerSun className="h-4 w-4" />
                            {patient.tbsaAssessment.totalTBSA}% TBSA
                          </span>
                          <span className="capitalize">{patient.mechanism} burn</span>
                          <span>{patient.age}y, {patient.weight}kg</span>
                        </div>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-6">
                      <div className="text-right">
                        <div className="flex items-center gap-2 text-sm">
                          <Clock className="h-4 w-4 text-gray-400" />
                          <span className="text-gray-600">
                            {getTimeSinceBurn(patient.timeOfBurn)} since burn
                          </span>
                        </div>
                        <div className="text-sm text-gray-500 mt-1">
                          ABSI: {patient.absiScore.totalScore} ({patient.absiScore.mortalityRisk})
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-2">
                        {patient.inhalationInjury.confirmed && (
                          <span className="p-1 bg-purple-100 rounded" title="Inhalation Injury">
                            <Activity className="h-4 w-4 text-purple-600" />
                          </span>
                        )}
                        {patient.inhalationInjury.intubated && (
                          <span className="p-1 bg-blue-100 rounded" title="Intubated">
                            <Droplets className="h-4 w-4 text-blue-600" />
                          </span>
                        )}
                        <ChevronRight className="h-5 w-5 text-gray-400" />
                      </div>
                    </div>
                  </div>
                  
                  {/* Active Alerts Preview */}
                  {patient.activeAlerts.filter(a => a.status === 'open').length > 0 && (
                    <div className="mt-3 pl-16">
                      <div className="flex flex-wrap gap-2">
                        {patient.activeAlerts
                          .filter(a => a.status === 'open')
                          .slice(0, 3)
                          .map((alert) => (
                            <span
                              key={alert.id}
                              className={`text-xs px-2 py-1 rounded-full ${
                                alert.severity === 'critical' 
                                  ? 'bg-red-100 text-red-700'
                                  : alert.severity === 'warning'
                                  ? 'bg-yellow-100 text-yellow-700'
                                  : 'bg-blue-100 text-blue-700'
                              }`}
                            >
                              {alert.message}
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

        {/* Quick Reference */}
        <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Resuscitation Targets */}
          <div className="bg-white rounded-lg shadow-sm p-6">
            <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <Droplets className="h-5 w-5 text-blue-500" />
              Resuscitation Targets
            </h3>
            <div className="space-y-3 text-sm">
              <div className="flex justify-between p-2 bg-gray-50 rounded">
                <span className="text-gray-600">Parkland Formula</span>
                <span className="font-medium">4 mL × kg × %TBSA</span>
              </div>
              <div className="flex justify-between p-2 bg-gray-50 rounded">
                <span className="text-gray-600">Adult Urine Output</span>
                <span className="font-medium text-green-600">0.5–1.0 mL/kg/hr</span>
              </div>
              <div className="flex justify-between p-2 bg-gray-50 rounded">
                <span className="text-gray-600">Pediatric Urine Output</span>
                <span className="font-medium text-green-600">1.0–1.5 mL/kg/hr</span>
              </div>
              <div className="flex justify-between p-2 bg-gray-50 rounded">
                <span className="text-gray-600">Target MAP</span>
                <span className="font-medium">≥65 mmHg</span>
              </div>
            </div>
          </div>

          {/* Burn Center Referral Criteria */}
          <div className="bg-white rounded-lg shadow-sm p-6">
            <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-orange-500" />
              Burn Center Referral (ABA)
            </h3>
            <ul className="space-y-2 text-sm text-gray-600">
              <li className="flex items-start gap-2">
                <span className="text-orange-500">•</span>
                Partial thickness burns &gt;10% TBSA
              </li>
              <li className="flex items-start gap-2">
                <span className="text-orange-500">•</span>
                Full thickness burns any size
              </li>
              <li className="flex items-start gap-2">
                <span className="text-orange-500">•</span>
                Burns to face, hands, feet, genitalia, major joints
              </li>
              <li className="flex items-start gap-2">
                <span className="text-orange-500">•</span>
                Chemical, electrical, or inhalation injury
              </li>
              <li className="flex items-start gap-2">
                <span className="text-orange-500">•</span>
                Circumferential burns
              </li>
              <li className="flex items-start gap-2">
                <span className="text-orange-500">•</span>
                Pre-existing conditions complicating care
              </li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};

export default BurnCarePage;

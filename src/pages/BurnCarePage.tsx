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
import { db } from '../db/database';
import { syncService } from '../db/syncService';

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

  // Load burn patients from database (empty initially - patients added via admission form)
  useEffect(() => {
    loadBurnPatients();
  }, []);

  const loadBurnPatients = async () => {
    try {
      setLoading(true);
      // Load burn patients from IndexedDB
      const storedPatients = await db.burn_patients.toArray();
      const burnPatients: BurnPatient[] = storedPatients.map((p: any) => ({
        ...p,
        activeAlerts: p.activeAlerts || [],
        monitoring: p.monitoring || { vitals: [], urineOutputs: [], fluidBalance: { inputs: [], outputs: [] } },
        tbsaAssessment: p.tbsaAssessment || { totalTBSA: p.tbsa_percentage || 0 },
      }));
      
      setPatients(burnPatients);
      
      // Calculate stats from loaded patients
      const activePatients = burnPatients.filter(p => p.status === 'active').length;
      const icuPatients = burnPatients.filter(p => p.disposition === 'icu').length;
      const wardPatients = burnPatients.filter(p => p.disposition === 'ward').length;
      const criticalAlerts = burnPatients.reduce((sum, p) => 
        sum + (p.activeAlerts?.filter(a => a.severity === 'critical' && a.status === 'open').length || 0), 0);
      const avgTBSA = burnPatients.length > 0 
        ? burnPatients.reduce((sum, p) => sum + p.tbsaAssessment.totalTBSA, 0) / burnPatients.length 
        : 0;

      setStats({
        activePatients,
        icuPatients,
        wardPatients,
        criticalAlerts,
        pendingAssessments: 0,
        avgTBSA: Math.round(avgTBSA * 10) / 10
      });
    } catch (error) {
      console.error('Error loading burn patients:', error);
    } finally {
      setLoading(false);
    }
  };

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

  const handleAdmissionComplete = async (newPatient: BurnPatient) => {
    try {
      // Save to IndexedDB
      const burnRecord = {
        ...newPatient,
        patient_id: newPatient.patientId,
        admission_date: newPatient.admissionDate || new Date(),
        tbsa_percentage: newPatient.tbsaAssessment?.totalTBSA || 0,
        mechanism: newPatient.mechanism || '',
        baux_score: newPatient.bauxScore || 0,
        disposition: newPatient.disposition || 'ward',
        status: newPatient.status || 'active',
        created_at: new Date(),
      };
      const localId = await db.burn_patients.add(burnRecord as any);
      await syncService.queueAction('create', 'burn_patients', localId as number, burnRecord);

      setPatients(prev => [...prev, newPatient]);
      setView('list');
      // Reload to get updated stats
      loadBurnPatients();
    } catch (error) {
      console.error('Error saving burn patient:', error);
      alert('Failed to save burn patient admission. Please try again.');
    }
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

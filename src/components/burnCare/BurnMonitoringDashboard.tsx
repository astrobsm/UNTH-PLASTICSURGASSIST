import React, { useState, useEffect } from 'react';
import { 
  ArrowLeft,
  Activity,
  Droplets,
  ThermometerSun,
  Heart,
  AlertTriangle,
  Clock,
  Plus,
  TrendingUp,
  TrendingDown,
  Minus,
  CheckCircle,
  XCircle,
  RefreshCw,
  FileText,
  Syringe,
  Pill,
  Stethoscope,
  BarChart3,
  Bell,
  BellOff
} from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';
import { 
  BurnPatient,
  BurnAlert,
  VitalSign,
  UrineOutput,
  FluidInput,
  burnCareService,
  BURN_ALERT_THRESHOLDS
} from '../../services/burnCareService';

interface BurnMonitoringDashboardProps {
  patient: BurnPatient;
  onBack: () => void;
}

type TabType = 'overview' | 'vitals' | 'fluids' | 'alerts' | 'wounds';

const BurnMonitoringDashboard: React.FC<BurnMonitoringDashboardProps> = ({ patient, onBack }) => {
  const [activeTab, setActiveTab] = useState<TabType>('overview');
  const [patientData, setPatientData] = useState<BurnPatient>(patient);
  const [showVitalsModal, setShowVitalsModal] = useState(false);
  const [showUrineModal, setShowUrineModal] = useState(false);
  const [showFluidModal, setShowFluidModal] = useState(false);

  // Calculate hours since burn
  const hoursSinceBurn = Math.floor(
    (Date.now() - new Date(patient.timeOfBurn).getTime()) / (1000 * 60 * 60)
  );

  // Calculate resuscitation phase
  const getResuscitationPhase = (): string => {
    if (hoursSinceBurn < 8) return 'First Half (0-8hrs)';
    if (hoursSinceBurn < 24) return 'Second Half (8-24hrs)';
    if (hoursSinceBurn < 48) return 'Maintenance Phase (24-48hrs)';
    return 'Post-Resuscitation';
  };

  // Latest vitals
  const latestVitals = patientData.monitoring.vitals[patientData.monitoring.vitals.length - 1];
  
  // Urine output in last hour
  const lastHourUO = patientData.monitoring.urineOutputs
    .filter(uo => Date.now() - new Date(uo.timestamp).getTime() < 60 * 60 * 1000)
    .reduce((sum, uo) => sum + uo.volumeML, 0);
  const lastHourUORate = lastHourUO / patient.weight;

  // Total fluids given
  const totalFluidsGiven = patientData.monitoring.fluidBalance.inputs
    .reduce((sum, input) => sum + input.volumeML, 0);

  // Active critical alerts
  const criticalAlerts = patientData.activeAlerts.filter(
    a => a.severity === 'critical' && a.status === 'open'
  );

  const acknowledgeAlert = (alertId: string) => {
    setPatientData(prev => ({
      ...prev,
      activeAlerts: prev.activeAlerts.map(a =>
        a.id === alertId ? { ...a, status: 'acknowledged', acknowledgedAt: new Date() } : a
      )
    }));
  };

  const resolveAlert = (alertId: string) => {
    setPatientData(prev => ({
      ...prev,
      activeAlerts: prev.activeAlerts.map(a =>
        a.id === alertId ? { ...a, status: 'resolved', resolvedAt: new Date() } : a
      )
    }));
  };

  // Add new vitals
  const addVitals = (vitals: Omit<VitalSign, 'id' | 'timestamp' | 'recordedBy'>) => {
    const newVitals: VitalSign = {
      ...vitals,
      id: uuidv4(),
      timestamp: new Date(),
      recordedBy: 'Current User',
    };

    // Generate alerts based on vitals
    const newAlerts = burnCareService.generateVitalAlerts(newVitals, patient.weight);

    setPatientData(prev => ({
      ...prev,
      monitoring: {
        ...prev.monitoring,
        vitals: [...prev.monitoring.vitals, newVitals],
      },
      activeAlerts: [...prev.activeAlerts, ...newAlerts],
    }));
    setShowVitalsModal(false);
  };

  // Add urine output
  const addUrineOutput = (volumeML: number, color: UrineOutput['color']) => {
    const newUO: UrineOutput = {
      id: uuidv4(),
      timestamp: new Date(),
      volumeML,
      mlPerKgPerHr: burnCareService.calculateUrineOutputRate(volumeML, patient.weight),
      color,
      recordedBy: 'Current User',
    };

    const updatedOutputs = [...patientData.monitoring.urineOutputs, newUO];
    
    // Check for low UO alert
    const uoAlert = burnCareService.generateUrineOutputAlert(
      updatedOutputs, 
      patient.age < 18 ? 1.0 : 0.5
    );

    setPatientData(prev => ({
      ...prev,
      monitoring: {
        ...prev.monitoring,
        urineOutputs: updatedOutputs,
        fluidBalance: {
          ...prev.monitoring.fluidBalance,
          outputs: [...prev.monitoring.fluidBalance.outputs, {
            id: uuidv4(),
            timestamp: new Date(),
            type: 'urine',
            volumeML,
            recordedBy: 'Current User',
          }],
        },
      },
      activeAlerts: uoAlert ? [...prev.activeAlerts, uoAlert] : prev.activeAlerts,
    }));
    setShowUrineModal(false);
  };

  // Add fluid input
  const addFluidInput = (input: Omit<FluidInput, 'id' | 'timestamp' | 'recordedBy'>) => {
    const newInput: FluidInput = {
      ...input,
      id: uuidv4(),
      timestamp: new Date(),
      recordedBy: 'Current User',
    };

    setPatientData(prev => ({
      ...prev,
      monitoring: {
        ...prev.monitoring,
        fluidBalance: {
          ...prev.monitoring.fluidBalance,
          inputs: [...prev.monitoring.fluidBalance.inputs, newInput],
        },
      },
      resuscitation: {
        ...prev.resuscitation,
        volumeGiven: prev.resuscitation.volumeGiven + input.volumeML,
        remainingVolume: prev.resuscitation.remainingVolume - input.volumeML,
      },
    }));
    setShowFluidModal(false);
  };

  const getTrend = (current: number, target: { min: number; max: number }): 'up' | 'down' | 'stable' => {
    if (current < target.min) return 'down';
    if (current > target.max) return 'up';
    return 'stable';
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-gradient-to-r from-orange-600 to-red-600 text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button
                onClick={onBack}
                className="p-2 hover:bg-white/20 rounded-lg transition-colors"
              >
                <ArrowLeft className="h-6 w-6" />
              </button>
              <div>
                <h1 className="text-xl font-bold">{patient.patientId}</h1>
                <p className="text-orange-100 text-sm">
                  {patient.age}y {patient.gender} • {patient.weight}kg • 
                  {patient.tbsaAssessment.totalTBSA}% TBSA {patient.mechanism} burn
                </p>
              </div>
            </div>
            
            <div className="flex items-center gap-4">
              <div className="text-right">
                <div className="text-2xl font-bold">{hoursSinceBurn}h</div>
                <div className="text-orange-100 text-xs">{getResuscitationPhase()}</div>
              </div>
              
              {criticalAlerts.length > 0 && (
                <div className="p-2 bg-red-500 rounded-lg animate-pulse flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5" />
                  <span className="font-bold">{criticalAlerts.length}</span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex gap-1 overflow-x-auto">
            {([
              { id: 'overview', label: 'Overview', icon: Activity },
              { id: 'vitals', label: 'Vitals', icon: Heart },
              { id: 'fluids', label: 'Fluids & UO', icon: Droplets },
              { id: 'alerts', label: 'Alerts', icon: Bell },
              { id: 'wounds', label: 'Wounds', icon: FileText },
            ] as const).map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-2 px-4 py-3 rounded-t-lg transition-colors ${
                    activeTab === tab.id
                      ? 'bg-white text-orange-600'
                      : 'text-orange-100 hover:bg-white/10'
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  <span className="font-medium">{tab.label}</span>
                  {tab.id === 'alerts' && criticalAlerts.length > 0 && (
                    <span className="px-2 py-0.5 bg-red-500 text-white text-xs rounded-full">
                      {criticalAlerts.length}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {activeTab === 'overview' && (
          <div className="space-y-6">
            {/* Quick Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {/* Latest HR */}
              <div className="bg-white rounded-lg shadow-sm p-4">
                <div className="flex items-center justify-between mb-2">
                  <Heart className="h-5 w-5 text-red-500" />
                  <span className={`text-xs px-2 py-0.5 rounded-full ${
                    latestVitals && latestVitals.heartRate > BURN_ALERT_THRESHOLDS.vitals.hrHigh
                      ? 'bg-red-100 text-red-700'
                      : 'bg-green-100 text-green-700'
                  }`}>
                    {latestVitals && latestVitals.heartRate > BURN_ALERT_THRESHOLDS.vitals.hrHigh ? 'HIGH' : 'NORMAL'}
                  </span>
                </div>
                <div className="text-2xl font-bold text-gray-900">
                  {latestVitals?.heartRate || '--'} <span className="text-sm font-normal text-gray-500">bpm</span>
                </div>
                <div className="text-xs text-gray-500">Heart Rate</div>
              </div>

              {/* MAP */}
              <div className="bg-white rounded-lg shadow-sm p-4">
                <div className="flex items-center justify-between mb-2">
                  <Activity className="h-5 w-5 text-blue-500" />
                  <span className={`text-xs px-2 py-0.5 rounded-full ${
                    latestVitals && latestVitals.map < BURN_ALERT_THRESHOLDS.vitals.mapLow
                      ? 'bg-red-100 text-red-700'
                      : 'bg-green-100 text-green-700'
                  }`}>
                    {latestVitals && latestVitals.map < BURN_ALERT_THRESHOLDS.vitals.mapLow ? 'LOW' : 'OK'}
                  </span>
                </div>
                <div className="text-2xl font-bold text-gray-900">
                  {latestVitals?.map || '--'} <span className="text-sm font-normal text-gray-500">mmHg</span>
                </div>
                <div className="text-xs text-gray-500">MAP (target ≥65)</div>
              </div>

              {/* Urine Output */}
              <div className="bg-white rounded-lg shadow-sm p-4">
                <div className="flex items-center justify-between mb-2">
                  <Droplets className="h-5 w-5 text-yellow-500" />
                  {getTrend(lastHourUORate, { min: 0.5, max: 1.0 }) === 'down' ? (
                    <TrendingDown className="h-4 w-4 text-red-500" />
                  ) : getTrend(lastHourUORate, { min: 0.5, max: 1.0 }) === 'up' ? (
                    <TrendingUp className="h-4 w-4 text-yellow-500" />
                  ) : (
                    <Minus className="h-4 w-4 text-green-500" />
                  )}
                </div>
                <div className="text-2xl font-bold text-gray-900">
                  {lastHourUORate.toFixed(2)} <span className="text-sm font-normal text-gray-500">mL/kg/hr</span>
                </div>
                <div className="text-xs text-gray-500">Urine Output (target 0.5-1.0)</div>
              </div>

              {/* Fluids Given */}
              <div className="bg-white rounded-lg shadow-sm p-4">
                <div className="flex items-center justify-between mb-2">
                  <Syringe className="h-5 w-5 text-purple-500" />
                  <span className="text-xs text-gray-500">
                    {Math.round((totalFluidsGiven / patient.resuscitation.totalVolume24h) * 100)}%
                  </span>
                </div>
                <div className="text-2xl font-bold text-gray-900">
                  {(totalFluidsGiven / 1000).toFixed(1)} <span className="text-sm font-normal text-gray-500">L</span>
                </div>
                <div className="text-xs text-gray-500">
                  of {(patient.resuscitation.totalVolume24h / 1000).toFixed(1)}L target
                </div>
              </div>
            </div>

            {/* Resuscitation Progress */}
            <div className="bg-white rounded-lg shadow-sm p-6">
              <h3 className="font-semibold text-gray-900 mb-4">Resuscitation Progress</h3>
              <div className="relative h-4 bg-gray-200 rounded-full overflow-hidden mb-2">
                <div 
                  className="absolute h-full bg-blue-500 transition-all"
                  style={{ width: `${Math.min(100, (totalFluidsGiven / patient.resuscitation.totalVolume24h) * 100)}%` }}
                />
                {/* Phase markers */}
                <div className="absolute h-full w-0.5 bg-gray-400 left-1/3" title="8hr mark" />
                <div className="absolute h-full w-0.5 bg-gray-600 left-2/3" title="16hr mark" />
              </div>
              <div className="flex justify-between text-xs text-gray-500">
                <span>0h</span>
                <span>8h ({(patient.resuscitation.firstHalfVolume / 1000).toFixed(1)}L)</span>
                <span>24h ({(patient.resuscitation.totalVolume24h / 1000).toFixed(1)}L)</span>
              </div>
              
              {/* Current Rate */}
              <div className="mt-4 p-3 bg-blue-50 rounded-lg">
                <div className="flex items-center justify-between">
                  <span className="text-blue-700">Current Rate:</span>
                  <span className="font-bold text-blue-900">
                    {patient.resuscitation.currentRate} mL/hr
                  </span>
                </div>
                {lastHourUORate < 0.5 && (
                  <div className="mt-2 text-sm text-yellow-700 flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4" />
                    Consider increasing rate by 20% due to low UO
                  </div>
                )}
              </div>
            </div>

            {/* Quick Actions */}
            <div className="grid grid-cols-3 gap-4">
              <button
                onClick={() => setShowVitalsModal(true)}
                className="p-4 bg-white rounded-lg shadow-sm hover:shadow-md transition-shadow text-center"
              >
                <Heart className="h-8 w-8 text-red-500 mx-auto mb-2" />
                <span className="text-sm font-medium text-gray-900">Record Vitals</span>
              </button>
              <button
                onClick={() => setShowUrineModal(true)}
                className="p-4 bg-white rounded-lg shadow-sm hover:shadow-md transition-shadow text-center"
              >
                <Droplets className="h-8 w-8 text-yellow-500 mx-auto mb-2" />
                <span className="text-sm font-medium text-gray-900">Log Urine Output</span>
              </button>
              <button
                onClick={() => setShowFluidModal(true)}
                className="p-4 bg-white rounded-lg shadow-sm hover:shadow-md transition-shadow text-center"
              >
                <Syringe className="h-8 w-8 text-blue-500 mx-auto mb-2" />
                <span className="text-sm font-medium text-gray-900">Record Fluids</span>
              </button>
            </div>

            {/* Active Alerts */}
            {patientData.activeAlerts.filter(a => a.status === 'open').length > 0 && (
              <div className="bg-white rounded-lg shadow-sm p-4">
                <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
                  <Bell className="h-5 w-5 text-red-500" />
                  Active Alerts
                </h3>
                <div className="space-y-2">
                  {patientData.activeAlerts
                    .filter(a => a.status === 'open')
                    .map((alert) => (
                      <div
                        key={alert.id}
                        className={`p-3 rounded-lg flex items-start justify-between ${
                          alert.severity === 'critical' ? 'bg-red-50 border border-red-200' :
                          alert.severity === 'warning' ? 'bg-yellow-50 border border-yellow-200' :
                          'bg-blue-50 border border-blue-200'
                        }`}
                      >
                        <div className="flex items-start gap-2">
                          <AlertTriangle className={`h-5 w-5 mt-0.5 ${
                            alert.severity === 'critical' ? 'text-red-600' :
                            alert.severity === 'warning' ? 'text-yellow-600' :
                            'text-blue-600'
                          }`} />
                          <div>
                            <div className="font-medium text-gray-900">{alert.message}</div>
                            <div className="text-sm text-gray-600">{alert.suggestedAction}</div>
                          </div>
                        </div>
                        <button
                          onClick={() => acknowledgeAlert(alert.id)}
                          className="text-xs px-2 py-1 bg-white rounded border hover:bg-gray-50"
                        >
                          Acknowledge
                        </button>
                      </div>
                    ))}
                </div>
              </div>
            )}

            {/* Prognostic Scores */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-white rounded-lg shadow-sm p-4">
                <div className="text-sm text-gray-600 mb-1">Baux Score</div>
                <div className="text-2xl font-bold text-gray-900">{patient.bauxScore}</div>
                <div className="text-sm text-gray-500">
                  {burnCareService.interpretBauxScore(patient.bauxScore).mortality} mortality
                </div>
              </div>
              <div className="bg-white rounded-lg shadow-sm p-4">
                <div className="text-sm text-gray-600 mb-1">Revised Baux</div>
                <div className="text-2xl font-bold text-gray-900">{patient.revisedBauxScore}</div>
                <div className="text-sm text-gray-500">
                  {patient.inhalationInjury.confirmed ? '+17 for inhalation' : 'No modifier'}
                </div>
              </div>
              <div className="bg-white rounded-lg shadow-sm p-4">
                <div className="text-sm text-gray-600 mb-1">ABSI Score</div>
                <div className="text-2xl font-bold text-gray-900">{patient.absiScore.totalScore}</div>
                <div className="text-sm text-gray-500">
                  {patient.absiScore.mortalityRisk} mortality risk
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'vitals' && (
          <div className="space-y-6">
            <div className="flex justify-between items-center">
              <h2 className="text-lg font-semibold text-gray-900">Vital Signs Monitoring</h2>
              <button
                onClick={() => setShowVitalsModal(true)}
                className="flex items-center gap-2 px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700"
              >
                <Plus className="h-4 w-4" />
                Record Vitals
              </button>
            </div>

            {/* Vitals Table */}
            <div className="bg-white rounded-lg shadow-sm overflow-hidden">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Time</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">HR</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">BP</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">MAP</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">RR</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">SpO₂</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Temp</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {patientData.monitoring.vitals.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-4 py-8 text-center text-gray-500">
                        No vitals recorded yet
                      </td>
                    </tr>
                  ) : (
                    patientData.monitoring.vitals.slice().reverse().map((vital) => (
                      <tr key={vital.id}>
                        <td className="px-4 py-3 text-sm text-gray-900">
                          {new Date(vital.timestamp).toLocaleTimeString()}
                        </td>
                        <td className={`px-4 py-3 text-sm font-medium ${
                          vital.heartRate > BURN_ALERT_THRESHOLDS.vitals.hrHigh ? 'text-red-600' : 'text-gray-900'
                        }`}>
                          {vital.heartRate}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-900">
                          {vital.systolicBP}/{vital.diastolicBP}
                        </td>
                        <td className={`px-4 py-3 text-sm font-medium ${
                          vital.map < BURN_ALERT_THRESHOLDS.vitals.mapLow ? 'text-red-600' : 'text-gray-900'
                        }`}>
                          {vital.map}
                        </td>
                        <td className={`px-4 py-3 text-sm ${
                          vital.respiratoryRate > BURN_ALERT_THRESHOLDS.vitals.rrHigh ? 'text-red-600' : 'text-gray-900'
                        }`}>
                          {vital.respiratoryRate}
                        </td>
                        <td className={`px-4 py-3 text-sm ${
                          vital.spo2 < BURN_ALERT_THRESHOLDS.vitals.spo2Low ? 'text-red-600' : 'text-gray-900'
                        }`}>
                          {vital.spo2}%
                        </td>
                        <td className={`px-4 py-3 text-sm ${
                          vital.temperature > BURN_ALERT_THRESHOLDS.vitals.tempHigh || 
                          vital.temperature < BURN_ALERT_THRESHOLDS.vitals.tempLow 
                            ? 'text-red-600' : 'text-gray-900'
                        }`}>
                          {vital.temperature}°C
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activeTab === 'fluids' && (
          <div className="space-y-6">
            <div className="flex justify-between items-center">
              <h2 className="text-lg font-semibold text-gray-900">Fluid Balance & Urine Output</h2>
              <div className="flex gap-2">
                <button
                  onClick={() => setShowUrineModal(true)}
                  className="flex items-center gap-2 px-4 py-2 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700"
                >
                  <Plus className="h-4 w-4" />
                  Log UO
                </button>
                <button
                  onClick={() => setShowFluidModal(true)}
                  className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  <Plus className="h-4 w-4" />
                  Add Fluid
                </button>
              </div>
            </div>

            {/* Fluid Summary */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-blue-50 rounded-lg p-4">
                <div className="text-sm text-blue-600 mb-1">Total Input</div>
                <div className="text-2xl font-bold text-blue-900">
                  {totalFluidsGiven.toLocaleString()} mL
                </div>
              </div>
              <div className="bg-yellow-50 rounded-lg p-4">
                <div className="text-sm text-yellow-600 mb-1">Total Output</div>
                <div className="text-2xl font-bold text-yellow-900">
                  {patientData.monitoring.urineOutputs.reduce((sum, uo) => sum + uo.volumeML, 0).toLocaleString()} mL
                </div>
              </div>
              <div className="bg-green-50 rounded-lg p-4">
                <div className="text-sm text-green-600 mb-1">Net Balance</div>
                <div className="text-2xl font-bold text-green-900">
                  +{(totalFluidsGiven - patientData.monitoring.urineOutputs.reduce((sum, uo) => sum + uo.volumeML, 0)).toLocaleString()} mL
                </div>
              </div>
            </div>

            {/* UO Table */}
            <div className="bg-white rounded-lg shadow-sm overflow-hidden">
              <div className="px-4 py-3 bg-gray-50 border-b">
                <h3 className="font-medium text-gray-900">Hourly Urine Output</h3>
              </div>
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Time</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Volume</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Rate (mL/kg/hr)</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Color</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {patientData.monitoring.urineOutputs.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-4 py-8 text-center text-gray-500">
                        No urine output recorded yet
                      </td>
                    </tr>
                  ) : (
                    patientData.monitoring.urineOutputs.slice().reverse().map((uo) => (
                      <tr key={uo.id}>
                        <td className="px-4 py-3 text-sm text-gray-900">
                          {new Date(uo.timestamp).toLocaleTimeString()}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-900">{uo.volumeML} mL</td>
                        <td className={`px-4 py-3 text-sm font-medium ${
                          uo.mlPerKgPerHr < 0.5 ? 'text-red-600' :
                          uo.mlPerKgPerHr > 1.0 ? 'text-yellow-600' : 'text-green-600'
                        }`}>
                          {uo.mlPerKgPerHr.toFixed(2)}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-900 capitalize">{uo.color.replace('_', ' ')}</td>
                        <td className="px-4 py-3">
                          {uo.mlPerKgPerHr < 0.5 ? (
                            <span className="text-xs px-2 py-0.5 bg-red-100 text-red-700 rounded-full">Low</span>
                          ) : uo.mlPerKgPerHr > 1.0 ? (
                            <span className="text-xs px-2 py-0.5 bg-yellow-100 text-yellow-700 rounded-full">High</span>
                          ) : (
                            <span className="text-xs px-2 py-0.5 bg-green-100 text-green-700 rounded-full">Target</span>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activeTab === 'alerts' && (
          <div className="space-y-6">
            <h2 className="text-lg font-semibold text-gray-900">Alert History</h2>
            
            <div className="bg-white rounded-lg shadow-sm divide-y">
              {patientData.activeAlerts.length === 0 ? (
                <div className="p-8 text-center text-gray-500">
                  <BellOff className="h-12 w-12 text-gray-300 mx-auto mb-4" />
                  <p>No alerts recorded</p>
                </div>
              ) : (
                patientData.activeAlerts.map((alert) => (
                  <div
                    key={alert.id}
                    className={`p-4 ${alert.status === 'resolved' ? 'opacity-60' : ''}`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex items-start gap-3">
                        <div className={`p-2 rounded-lg ${
                          alert.severity === 'critical' ? 'bg-red-100' :
                          alert.severity === 'warning' ? 'bg-yellow-100' :
                          alert.severity === 'emergency' ? 'bg-purple-100' :
                          'bg-blue-100'
                        }`}>
                          <AlertTriangle className={`h-5 w-5 ${
                            alert.severity === 'critical' ? 'text-red-600' :
                            alert.severity === 'warning' ? 'text-yellow-600' :
                            alert.severity === 'emergency' ? 'text-purple-600' :
                            'text-blue-600'
                          }`} />
                        </div>
                        <div>
                          <div className="font-medium text-gray-900">{alert.message}</div>
                          <div className="text-sm text-gray-600 mt-1">{alert.suggestedAction}</div>
                          <div className="text-xs text-gray-400 mt-2">
                            {new Date(alert.createdAt).toLocaleString()}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={`text-xs px-2 py-1 rounded-full ${
                          alert.status === 'open' ? 'bg-red-100 text-red-700' :
                          alert.status === 'acknowledged' ? 'bg-yellow-100 text-yellow-700' :
                          'bg-green-100 text-green-700'
                        }`}>
                          {alert.status}
                        </span>
                        {alert.status === 'open' && (
                          <button
                            onClick={() => acknowledgeAlert(alert.id)}
                            className="text-xs px-2 py-1 border rounded hover:bg-gray-50"
                          >
                            Acknowledge
                          </button>
                        )}
                        {alert.status === 'acknowledged' && (
                          <button
                            onClick={() => resolveAlert(alert.id)}
                            className="text-xs px-2 py-1 border rounded hover:bg-gray-50"
                          >
                            Resolve
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {activeTab === 'wounds' && (
          <div className="space-y-6">
            <h2 className="text-lg font-semibold text-gray-900">Wound Assessment</h2>
            
            <div className="bg-white rounded-lg shadow-sm p-6">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                <div className="text-center p-4 bg-gray-50 rounded-lg">
                  <div className="text-3xl font-bold text-orange-600">{patient.tbsaAssessment.totalTBSA}%</div>
                  <div className="text-sm text-gray-600">Total TBSA</div>
                </div>
                <div className="text-center p-4 bg-gray-50 rounded-lg">
                  <div className="text-3xl font-bold text-red-600">
                    {patient.tbsaAssessment.regions.filter(r => r.depth === 'full_thickness').length}
                  </div>
                  <div className="text-sm text-gray-600">Full Thickness Regions</div>
                </div>
                <div className="text-center p-4 bg-gray-50 rounded-lg">
                  <div className="text-3xl font-bold text-yellow-600">
                    {patient.tbsaAssessment.regions.filter(r => r.isCircumferential).length}
                  </div>
                  <div className="text-sm text-gray-600">Circumferential</div>
                </div>
                <div className="text-center p-4 bg-gray-50 rounded-lg">
                  <div className="text-3xl font-bold text-purple-600 capitalize">{patient.mechanism}</div>
                  <div className="text-sm text-gray-600">Mechanism</div>
                </div>
              </div>

              <h3 className="font-medium text-gray-900 mb-3">Affected Regions</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                {patient.tbsaAssessment.regions.map((region, idx) => (
                  <div 
                    key={idx}
                    className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                  >
                    <div className="flex items-center gap-3">
                      <span className={`w-3 h-3 rounded-full ${
                        region.depth === 'full_thickness' ? 'bg-amber-800' :
                        region.depth === 'deep_partial' ? 'bg-yellow-400' :
                        region.depth === 'superficial_partial' ? 'bg-red-400' :
                        'bg-pink-300'
                      }`} />
                      <span className="text-gray-900">
                        {burnCareService.getRegionDisplayName(region.region)}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 text-sm">
                      <span className="text-gray-600">{region.percentBurned}%</span>
                      {region.isCircumferential && (
                        <span className="text-xs px-2 py-0.5 bg-red-100 text-red-700 rounded-full">
                          Circumferential
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Vitals Modal */}
      {showVitalsModal && (
        <VitalsModal 
          onSubmit={addVitals}
          onClose={() => setShowVitalsModal(false)}
        />
      )}

      {/* Urine Output Modal */}
      {showUrineModal && (
        <UrineOutputModal
          onSubmit={addUrineOutput}
          onClose={() => setShowUrineModal(false)}
          patientWeight={patient.weight}
        />
      )}

      {/* Fluid Input Modal */}
      {showFluidModal && (
        <FluidInputModal
          onSubmit={addFluidInput}
          onClose={() => setShowFluidModal(false)}
        />
      )}
    </div>
  );
};

// Vitals Modal Component
const VitalsModal: React.FC<{
  onSubmit: (vitals: Omit<VitalSign, 'id' | 'timestamp' | 'recordedBy'>) => void;
  onClose: () => void;
}> = ({ onSubmit, onClose }) => {
  const [hr, setHr] = useState(80);
  const [sbp, setSbp] = useState(120);
  const [dbp, setDbp] = useState(80);
  const [rr, setRr] = useState(16);
  const [spo2, setSpo2] = useState(98);
  const [temp, setTemp] = useState(37.0);

  const handleSubmit = () => {
    onSubmit({
      heartRate: hr,
      systolicBP: sbp,
      diastolicBP: dbp,
      map: burnCareService.calculateMAP(sbp, dbp),
      respiratoryRate: rr,
      spo2,
      temperature: temp,
    });
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg w-full max-w-md p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Record Vital Signs</h3>
        
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-gray-600 mb-1">Heart Rate (bpm)</label>
              <input
                type="number"
                value={hr}
                onChange={(e) => setHr(Number(e.target.value))}
                className="w-full px-3 py-2 border rounded-lg"
              />
            </div>
            <div>
              <label className="block text-sm text-gray-600 mb-1">SpO₂ (%)</label>
              <input
                type="number"
                value={spo2}
                onChange={(e) => setSpo2(Number(e.target.value))}
                className="w-full px-3 py-2 border rounded-lg"
              />
            </div>
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-gray-600 mb-1">Systolic BP</label>
              <input
                type="number"
                value={sbp}
                onChange={(e) => setSbp(Number(e.target.value))}
                className="w-full px-3 py-2 border rounded-lg"
              />
            </div>
            <div>
              <label className="block text-sm text-gray-600 mb-1">Diastolic BP</label>
              <input
                type="number"
                value={dbp}
                onChange={(e) => setDbp(Number(e.target.value))}
                className="w-full px-3 py-2 border rounded-lg"
              />
            </div>
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-gray-600 mb-1">Resp Rate</label>
              <input
                type="number"
                value={rr}
                onChange={(e) => setRr(Number(e.target.value))}
                className="w-full px-3 py-2 border rounded-lg"
              />
            </div>
            <div>
              <label className="block text-sm text-gray-600 mb-1">Temperature (°C)</label>
              <input
                type="number"
                step="0.1"
                value={temp}
                onChange={(e) => setTemp(Number(e.target.value))}
                className="w-full px-3 py-2 border rounded-lg"
              />
            </div>
          </div>

          <div className="p-3 bg-gray-50 rounded-lg">
            <span className="text-sm text-gray-600">Calculated MAP: </span>
            <span className="font-bold">{burnCareService.calculateMAP(sbp, dbp)} mmHg</span>
          </div>
        </div>

        <div className="flex justify-end gap-3 mt-6">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-600 hover:text-gray-800"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            className="px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700"
          >
            Save Vitals
          </button>
        </div>
      </div>
    </div>
  );
};

// Urine Output Modal
const UrineOutputModal: React.FC<{
  onSubmit: (volume: number, color: UrineOutput['color']) => void;
  onClose: () => void;
  patientWeight: number;
}> = ({ onSubmit, onClose, patientWeight }) => {
  const [volume, setVolume] = useState(50);
  const [color, setColor] = useState<UrineOutput['color']>('yellow');

  const rate = burnCareService.calculateUrineOutputRate(volume, patientWeight);

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg w-full max-w-md p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Log Urine Output</h3>
        
        <div className="space-y-4">
          <div>
            <label className="block text-sm text-gray-600 mb-1">Volume (mL)</label>
            <input
              type="number"
              value={volume}
              onChange={(e) => setVolume(Number(e.target.value))}
              className="w-full px-3 py-2 border rounded-lg"
            />
          </div>

          <div>
            <label className="block text-sm text-gray-600 mb-1">Color</label>
            <select
              value={color}
              onChange={(e) => setColor(e.target.value as UrineOutput['color'])}
              className="w-full px-3 py-2 border rounded-lg"
            >
              <option value="clear">Clear</option>
              <option value="yellow">Yellow</option>
              <option value="dark_yellow">Dark Yellow</option>
              <option value="amber">Amber</option>
              <option value="cola">Cola (myoglobinuria)</option>
              <option value="bloody">Bloody</option>
            </select>
          </div>

          <div className={`p-3 rounded-lg ${
            rate < 0.5 ? 'bg-red-50' : rate > 1.0 ? 'bg-yellow-50' : 'bg-green-50'
          }`}>
            <div className="flex justify-between">
              <span className="text-sm text-gray-600">Rate:</span>
              <span className={`font-bold ${
                rate < 0.5 ? 'text-red-600' : rate > 1.0 ? 'text-yellow-600' : 'text-green-600'
              }`}>
                {rate.toFixed(2)} mL/kg/hr
              </span>
            </div>
            {rate < 0.5 && (
              <p className="text-xs text-red-600 mt-1">
                Below target - consider increasing fluid rate
              </p>
            )}
          </div>
        </div>

        <div className="flex justify-end gap-3 mt-6">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-600 hover:text-gray-800"
          >
            Cancel
          </button>
          <button
            onClick={() => onSubmit(volume, color)}
            className="px-4 py-2 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700"
          >
            Log Output
          </button>
        </div>
      </div>
    </div>
  );
};

// Fluid Input Modal
const FluidInputModal: React.FC<{
  onSubmit: (input: Omit<FluidInput, 'id' | 'timestamp' | 'recordedBy'>) => void;
  onClose: () => void;
}> = ({ onSubmit, onClose }) => {
  const [type, setType] = useState<FluidInput['type']>('crystalloid');
  const [fluidName, setFluidName] = useState('Lactated Ringers');
  const [volume, setVolume] = useState(500);

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg w-full max-w-md p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Record Fluid Input</h3>
        
        <div className="space-y-4">
          <div>
            <label className="block text-sm text-gray-600 mb-1">Type</label>
            <select
              value={type}
              onChange={(e) => setType(e.target.value as FluidInput['type'])}
              className="w-full px-3 py-2 border rounded-lg"
            >
              <option value="crystalloid">Crystalloid</option>
              <option value="colloid">Colloid</option>
              <option value="blood_product">Blood Product</option>
              <option value="enteral">Enteral</option>
              <option value="oral">Oral</option>
              <option value="medication">Medication</option>
            </select>
          </div>

          <div>
            <label className="block text-sm text-gray-600 mb-1">Fluid Name</label>
            <input
              type="text"
              value={fluidName}
              onChange={(e) => setFluidName(e.target.value)}
              className="w-full px-3 py-2 border rounded-lg"
              placeholder="e.g., Lactated Ringers, Normal Saline"
            />
          </div>

          <div>
            <label className="block text-sm text-gray-600 mb-1">Volume (mL)</label>
            <input
              type="number"
              value={volume}
              onChange={(e) => setVolume(Number(e.target.value))}
              className="w-full px-3 py-2 border rounded-lg"
            />
          </div>
        </div>

        <div className="flex justify-end gap-3 mt-6">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-600 hover:text-gray-800"
          >
            Cancel
          </button>
          <button
            onClick={() => onSubmit({ type, fluidName, volumeML: volume })}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            Add Fluid
          </button>
        </div>
      </div>
    </div>
  );
};

export default BurnMonitoringDashboard;

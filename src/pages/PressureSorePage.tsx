import React, { useState, useEffect, useCallback } from 'react';
import {
  AlertCircle, AlertTriangle, ArrowRight, Award, BookOpen, Calculator,
  CheckCircle, ChevronDown, ChevronUp, Clock, ClipboardList,
  Download, FileText, FlaskConical, Heart, Loader2,
  Plus, Printer, Save, Search, Shield,
  Thermometer, TrendingUp, User, X, Activity,
  Bed, CircleDot, Eye, List, BarChart3, Utensils, Scissors
} from 'lucide-react';
import { patientService } from '../services/patientService';
import { useAuthStore } from '../store/authStore';
import { apiClient } from '../services/apiClient';
import { useOnSelectedPatient } from '../hooks/useSelectedPatient';
import {
  PRESSURE_INJURY_STAGES, BRADEN_SCALE, BRADEN_INTERPRETATION,
  TIME_FRAMEWORK, PS_LAB_PANELS, PS_TREATMENT_PROTOCOLS,
  PS_LOCATION_GUIDE, PS_NURSING_PROTOCOLS, PS_PATIENT_EDUCATION,
  PS_CME_ARTICLE
} from '../data/pressureSoreProtocol';

// ============================================
// TYPES
// ============================================
interface Patient {
  id: string | number;
  hospital_number: string;
  full_name?: string;
  first_name?: string;
  last_name?: string;
}

const API_BASE = '/pressure-sore-protocol';

// ============================================
// MAIN COMPONENT
// ============================================
const PressureSorePage: React.FC = () => {
  const { user } = useAuthStore();
  const [activeTab, setActiveTab] = useState<'protocol' | 'braden' | 'wound' | 'wounds' | 'treatment' | 'progress' | 'orders' | 'education' | 'cme'>('protocol');
  const [patients, setPatients] = useState<Patient[]>([]);
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);
  const [patientSearch, setPatientSearch] = useState('');
  useOnSelectedPatient((p) => setSelectedPatient(p as unknown as Patient));
  const [wounds, setWounds] = useState<any[]>([]);
  const [selectedWound, setSelectedWound] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Braden Scale State
  const [bradenInputs, setBradenInputs] = useState<Record<string, number>>({
    'Sensory Perception': 3, 'Moisture': 3, 'Activity': 3,
    'Mobility': 3, 'Nutrition': 3, 'Friction & Shear': 2
  });
  const [bradenTotal, setBradenTotal] = useState(0);
  const [bradenRisk, setBradenRisk] = useState('');

  // Wound Form
  const [woundForm, setWoundForm] = useState({
    location: '', laterality: 'midline', currentStage: '',
    woundLength: '', woundWidth: '', woundDepth: '',
    undermining: false, underminingDetails: '',
    tunneling: false, tunnelingDetails: '',
    granulationPercent: 0, sloughPercent: 0, escharPercent: 0,
    exudateType: 'serous', exudateAmount: 'minimal',
    woundEdges: 'distinct', periWoundSkin: 'intact',
    infectionSigns: [] as string[], probeToBone: false,
    odor: false, painLevel: 0,
    bradenScore: 0, bradenRisk: '',
    photos: '', notes: ''
  });

  // Progress Note Form
  const [progressForm, setProgressForm] = useState({
    woundLength: '', woundWidth: '', woundDepth: '',
    granulationPercent: 0, sloughPercent: 0, escharPercent: 0,
    exudateType: 'serous', exudateAmount: 'minimal',
    woundEdges: 'distinct', periWoundSkin: 'intact',
    dressingUsed: '', repositioningCompliance: true,
    nutritionAdherence: true, painLevel: 0,
    infectionSigns: [] as string[], notes: ''
  });

  // Treatment Plan State
  const [treatmentPlans, setTreatmentPlans] = useState<any[]>([]);
  const [progressNotes, setProgressNotes] = useState<any[]>([]);
  const [orders, setOrders] = useState<any[]>([]);

  // CME State
  const [cmeAnswers, setCmeAnswers] = useState<Record<number, number>>({});
  const [cmeSubmitted, setCmeSubmitted] = useState(false);
  const [cmeScore, setCmeScore] = useState(0);

  // Patient search
  useEffect(() => {
    if (patientSearch.length >= 2) {
      searchPatients(patientSearch);
    }
  }, [patientSearch]);

  const searchPatients = async (searchTerm: string) => {
    try {
      const results = await patientService.searchPatients(searchTerm);
      setPatients(results);
    } catch (err) {
      console.error('Error searching patients:', err);
    }
  };

  const fetchWounds = useCallback(async (patientId?: string) => {
    setIsLoading(true);
    try {
      const params = patientId ? `?patientId=${patientId}` : '';
      const data = await apiClient.get(`${API_BASE}/wounds${params}`);
      setWounds(data.wounds || []);
    } catch (err) {
      console.error('Error fetching wounds:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const fetchWoundDetails = async (id: string) => {
    try {
      const data = await apiClient.get(`${API_BASE}/wounds/${id}`);
      setSelectedWound(data.wound);
      setTreatmentPlans(data.treatmentPlans || []);
      setProgressNotes(data.progress || []);
      setOrders(data.orders || []);
    } catch (err) {
      console.error('Error fetching wound details:', err);
    }
  };

  // ============================================
  // BRADEN SCALE CALCULATOR
  // ============================================
  const calculateBraden = () => {
    const total = Object.values(bradenInputs).reduce((sum, v) => sum + v, 0);
    setBradenTotal(total);

    let risk = '';
    if (total <= 9) risk = 'Very High Risk';
    else if (total <= 12) risk = 'High Risk';
    else if (total <= 14) risk = 'Moderate Risk';
    else if (total <= 18) risk = 'Mild Risk';
    else risk = 'No Risk';
    setBradenRisk(risk);
  };

  useEffect(() => {
    calculateBraden();
  }, [bradenInputs]);

  // ============================================
  // SAVE WOUND
  // ============================================
  const saveWound = async () => {
    if (!selectedPatient) {
      setMessage({ type: 'error', text: 'Please select a patient first' });
      return;
    }
    if (!woundForm.location || !woundForm.currentStage) {
      setMessage({ type: 'error', text: 'Location and stage are required' });
      return;
    }

    setIsSaving(true);
    try {
      const payload = {
        patientId: selectedPatient.id,
        hospitalNumber: selectedPatient.hospital_number,
        patientName: selectedPatient.full_name || `${selectedPatient.first_name} ${selectedPatient.last_name}`,
        ...woundForm,
        bradenScore: bradenTotal,
        bradenRisk
      };

      const res = await apiClient.post(`${API_BASE}/wounds`, payload);

      setMessage({ type: 'success', text: 'Wound record saved successfully' });
      setSelectedWound(res.wound);
      fetchWounds(String(selectedPatient.id));
      setActiveTab('treatment');
    } catch (err) {
      setMessage({ type: 'error', text: 'Network error saving wound' });
    } finally {
      setIsSaving(false);
    }
  };

  // ============================================
  // CREATE TREATMENT PLAN
  // ============================================
  const createTreatmentPlan = async (protocolId: string) => {
    if (!selectedWound) return;

    const protocol = PS_TREATMENT_PROTOCOLS.find(p => p.id === protocolId);
    if (!protocol) return;

    setIsSaving(true);
    try {
      const payload = {
        woundId: selectedWound.id,
        patientId: selectedWound.patient_id,
        hospitalNumber: selectedWound.hospital_number,
        patientName: selectedWound.patient_name,
        protocolId,
        stage: selectedWound.current_stage,
        severity: protocol.severity,
        woundCare: protocol.woundCare.map(wc => ({
          name: wc.name, indication: wc.indication, technique: wc.technique,
          dressingType: wc.dressingType, frequency: wc.frequency, precautions: wc.precautions
        })),
        surgicalOptions: protocol.surgicalOptions.map(so => ({
          procedure: so.procedure, indication: so.indication, timing: so.timing,
          technique: so.technique, flapOptions: so.flapOptions,
          postoperativeCare: so.postoperativeCare, expectedOutcome: so.expectedOutcome
        })),
        nutritionPlan: protocol.nutritionPlan,
        pressureRelief: protocol.pressureRelief || [],
        supportiveCare: protocol.supportiveCare || [],
        monitoring: protocol.monitoring || [],
        antibiotics: protocol.antibiotics?.map(abx => ({
          drug: abx.drug, dose: abx.dose, route: abx.route,
          frequency: abx.frequency, duration: abx.duration, indication: abx.indication
        })) || [],
        comorbidityModifications: protocol.comorbidityModifications?.map(cm => ({
          comorbidity: cm.comorbidity, modifications: cm.modifications
        })) || []
      };

      const res = await apiClient.post(`${API_BASE}/treatment-plans`, payload);

      setTreatmentPlans(prev => [res.treatmentPlan, ...prev]);
      setMessage({ type: 'success', text: 'Treatment plan created. Approve to auto-generate orders.' });
    } catch (err) {
      setMessage({ type: 'error', text: 'Failed to create treatment plan' });
    } finally {
      setIsSaving(false);
    }
  };

  // ============================================
  // APPROVE TREATMENT PLAN
  // ============================================
  const approveTreatmentPlan = async (planId: string) => {
    setIsSaving(true);
    try {
      const data = await apiClient.put(`${API_BASE}/treatment-plans/${planId}`, { autoOrdersApproved: true });

      setTreatmentPlans(prev => prev.map(p => p.id === planId ? data.treatmentPlan : p));
      setMessage({ type: 'success', text: 'Treatment plan approved! Auto-orders generated for prescriptions, labs, and procedures.' });
      if (selectedWound) fetchWoundDetails(selectedWound.id);
    } catch (err) {
      setMessage({ type: 'error', text: 'Failed to approve treatment plan' });
    } finally {
      setIsSaving(false);
    }
  };

  // ============================================
  // SAVE PROGRESS NOTE
  // ============================================
  const saveProgressNote = async () => {
    if (!selectedWound || !selectedPatient) return;
    setIsSaving(true);
    try {
      const prevLength = selectedWound.wound_length || 0;
      const prevWidth = selectedWound.wound_width || 0;
      const prevArea = prevLength * prevWidth;
      const newArea = (parseFloat(progressForm.woundLength) || 0) * (parseFloat(progressForm.woundWidth) || 0);
      const healingRate = prevArea > 0 ? Math.round(((prevArea - newArea) / prevArea) * 100) : 0;

      const payload = {
        woundId: selectedWound.id,
        patientId: selectedPatient.id,
        hospitalNumber: selectedPatient.hospital_number,
        patientName: selectedPatient.full_name || `${selectedPatient.first_name} ${selectedPatient.last_name}`,
        ...progressForm,
        healingRate,
        assessedBy: user?.name || user?.email || 'Unknown'
      };

      const data = await apiClient.post(`${API_BASE}/progress`, payload);

      setProgressNotes(prev => [data.progress, ...prev]);
      setMessage({ type: 'success', text: `Progress note recorded. Healing rate: ${healingRate}%` });
    } catch (err) {
      setMessage({ type: 'error', text: 'Failed to save progress note' });
    } finally {
      setIsSaving(false);
    }
  };

  // ============================================
  // CME QUIZ
  // ============================================
  const submitCME = async () => {
    const questions = PS_CME_ARTICLE.mcqQuestions;
    let correct = 0;
    questions.forEach((q, idx) => {
      if (cmeAnswers[idx] === q.correctAnswer) correct++;
    });
    const score = Math.round((correct / questions.length) * 100);
    setCmeScore(score);
    setCmeSubmitted(true);

    try {
      await apiClient.post(`${API_BASE}/cme`, {
          articleId: PS_CME_ARTICLE.id,
          score,
          totalQuestions: questions.length,
          correctAnswers: correct,
          answers: cmeAnswers,
          passed: score >= 70,
          creditsEarned: score >= 70 ? PS_CME_ARTICLE.cmeCredits : 0
        });
    } catch (err) {
      console.error('Error recording CME:', err);
    }
  };

  // ============================================
  // EXPORT / PRINT
  // ============================================
  const exportWoundData = () => {
    if (!selectedWound) return;
    const data = JSON.stringify({ wound: selectedWound, treatmentPlans, progressNotes, orders }, null, 2);
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `PressureSore_${selectedWound.hospital_number}_${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const printProtocol = () => { window.print(); };

  // ============================================
  // TABS
  // ============================================
  const tabs = [
    { id: 'protocol', label: 'Staging Guide', icon: BookOpen },
    { id: 'braden', label: 'Braden Scale', icon: Calculator },
    { id: 'wound', label: 'New Wound', icon: Plus },
    { id: 'wounds', label: 'Wound Records', icon: FileText },
    { id: 'treatment', label: 'Treatment Plans', icon: Activity },
    { id: 'progress', label: 'Progress Tracking', icon: TrendingUp },
    { id: 'orders', label: 'Auto-Orders', icon: List },
    { id: 'education', label: 'Education', icon: BookOpen },
    { id: 'cme', label: 'CME Assessment', icon: Award },
  ];

  return (
    <div className="max-w-7xl mx-auto px-4 py-6 print:p-0">
      {/* Header */}
      <div className="flex items-center justify-between mb-6 print:mb-2">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-purple-100 rounded-lg">
            <CircleDot className="h-8 w-8 text-purple-600" />
          </div>
          <div>
            <h1 className="text-lg sm:text-2xl font-bold text-gray-900">Pressure Sore Management Protocol</h1>
            <p className="text-sm text-gray-500">NPUAP/EPUAP Staging, Braden Scale, TIME Framework & Surgical Options</p>
          </div>
        </div>
        <div className="flex gap-2 print:hidden">
          <button onClick={printProtocol} className="flex items-center gap-1 px-3 py-2 border rounded-lg hover:bg-gray-50 text-sm">
            <Printer className="h-4 w-4" /> Print
          </button>
          <button onClick={exportWoundData} className="flex items-center gap-1 px-3 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm" disabled={!selectedWound}>
            <Download className="h-4 w-4" /> Export
          </button>
        </div>
      </div>

      {/* Message */}
      {message && (
        <div className={`mb-4 p-3 rounded-lg flex items-center gap-2 ${message.type === 'success' ? 'bg-green-50 text-green-800 border border-green-200' : 'bg-red-50 text-red-800 border border-red-200'}`}>
          {message.type === 'success' ? <CheckCircle className="h-5 w-5" /> : <AlertCircle className="h-5 w-5" />}
          <span className="text-sm">{message.text}</span>
          <button onClick={() => setMessage(null)} className="ml-auto" title="Dismiss message"><X className="h-4 w-4" /></button>
        </div>
      )}

      {/* Tab Navigation */}
      <div className="flex flex-wrap gap-1 mb-6 border-b print:hidden overflow-x-auto">
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={`flex items-center gap-1.5 px-3 py-2 text-sm font-medium rounded-t-lg whitespace-nowrap transition-colors ${
              activeTab === tab.id
                ? 'bg-purple-50 text-purple-700 border-b-2 border-purple-600'
                : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
            }`}
          >
            <tab.icon className="h-4 w-4" />
            {tab.label}
          </button>
        ))}
      </div>

      {/* ============================================ */}
      {/* PROTOCOL / STAGING GUIDE TAB */}
      {/* ============================================ */}
      {activeTab === 'protocol' && (
        <div className="space-y-6">
          <h2 className="text-xl font-bold text-gray-800">NPUAP/EPUAP Pressure Injury Staging</h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {PRESSURE_INJURY_STAGES.map((stg) => (
              <div key={stg.id} className={`border-l-4 rounded-lg p-4 shadow-sm ${
                stg.severity === 'critical' ? 'border-red-600 bg-red-50' :
                stg.severity === 'severe' ? 'border-orange-500 bg-orange-50' :
                stg.severity === 'moderate' ? 'border-yellow-500 bg-yellow-50' :
                'border-green-500 bg-green-50'
              }`}>
                <div className="flex items-center justify-between mb-2">
                  <h3 className="font-bold text-gray-900">{stg.stage}: {stg.name}</h3>
                  <span className={`px-2 py-0.5 rounded text-xs font-semibold uppercase ${
                    stg.severity === 'critical' ? 'bg-red-200 text-red-800' :
                    stg.severity === 'severe' ? 'bg-orange-200 text-orange-800' :
                    stg.severity === 'moderate' ? 'bg-yellow-200 text-yellow-800' :
                    'bg-green-200 text-green-800'
                  }`}>{stg.severity}</span>
                </div>
                <p className="text-sm text-gray-700 mb-2">{stg.description}</p>

                <div className="mt-2">
                  <p className="text-xs font-semibold text-gray-600 mb-1">Clinical Features:</p>
                  <ul className="space-y-0.5">
                    {stg.clinicalFeatures.slice(0, 3).map((f, i) => (
                      <li key={i} className="text-xs text-gray-600 flex items-start gap-1">
                        <ArrowRight className="h-3 w-3 mt-0.5 text-purple-500 flex-shrink-0" /> {f}
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="mt-2">
                  <p className="text-xs font-semibold text-gray-600 mb-1">Tissue Involvement:</p>
                  <p className="text-xs text-gray-600">{stg.tissueInvolvement}</p>
                </div>

                <div className="mt-2 flex flex-wrap gap-1">
                  {stg.typicalLocations.slice(0, 4).map((loc, i) => (
                    <span key={i} className="text-xs bg-white/70 px-2 py-0.5 rounded border">{loc}</span>
                  ))}
                </div>
              </div>
            ))}
          </div>

          {/* TIME Framework */}
          <div className="mt-8">
            <h2 className="text-xl font-bold text-gray-800 mb-4">TIME Wound Bed Preparation Framework</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {TIME_FRAMEWORK.map((comp) => (
                <div key={comp.acronym} className="bg-white border rounded-lg p-4 shadow-sm">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-lg sm:text-2xl font-bold text-purple-600">{comp.acronym}</span>
                    <span className="text-sm font-semibold text-gray-800">{comp.component}</span>
                  </div>
                  <p className="text-xs text-gray-600 mb-2">{comp.description}</p>
                  <div className="mt-2">
                    <p className="text-xs font-semibold text-gray-700 mb-1">Interventions:</p>
                    {comp.interventions.slice(0, 3).map((int, i) => (
                      <p key={i} className="text-xs text-gray-600 flex items-start gap-1">
                        <CheckCircle className="h-3 w-3 mt-0.5 text-green-500 flex-shrink-0" /> {int}
                      </p>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Location Guide */}
          <div className="mt-8">
            <h2 className="text-xl font-bold text-gray-800 mb-4">Location-Specific Surgical Guide</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {PS_LOCATION_GUIDE.map((loc: any) => (
                <div key={loc.location} className="bg-white border rounded-lg p-4 shadow-sm">
                  <h3 className="font-bold text-gray-800 mb-2">{loc.location}</h3>
                  <p className="text-xs text-gray-600 mb-2">{loc.prevalence}</p>
                  {loc.flapOptions && (
                    <div className="mb-2">
                      <p className="text-xs font-semibold text-purple-700 mb-1">Flap Options:</p>
                      {loc.flapOptions.map((f: string, i: number) => (
                        <p key={i} className="text-xs text-gray-600 ml-2">• {f}</p>
                      ))}
                    </div>
                  )}
                  {loc.specialConsiderations && (
                    <div>
                      <p className="text-xs font-semibold text-gray-700 mb-1">Considerations:</p>
                      {loc.specialConsiderations.slice(0, 3).map((c: string, i: number) => (
                        <p key={i} className="text-xs text-gray-500 ml-2">• {c}</p>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ============================================ */}
      {/* BRADEN SCALE CALCULATOR TAB */}
      {/* ============================================ */}
      {activeTab === 'braden' && (
        <div className="space-y-6">
          <div className="bg-white border rounded-lg p-6 shadow-sm">
            <div className="flex items-center gap-2 mb-4">
              <Calculator className="h-6 w-6 text-purple-600" />
              <h2 className="text-xl font-bold text-gray-800">Braden Scale for Predicting Pressure Sore Risk</h2>
            </div>
            <p className="text-sm text-gray-600 mb-6">Score range: 6–23. Lower scores = higher risk.</p>

            <div className="space-y-4">
              {BRADEN_SCALE.map((param) => (
                <div key={param.parameter} className="border rounded-lg p-4">
                  <label className="block text-sm font-semibold text-gray-800 mb-2">
                    {param.parameter} <span className="text-gray-500 font-normal">— {param.description}</span>
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
                    {param.levels.map((level) => (
                      <label key={level.score} className={`flex items-start gap-2 p-2 border rounded cursor-pointer transition-colors ${
                        bradenInputs[param.parameter] === level.score ? 'bg-purple-50 border-purple-400' : 'hover:bg-gray-50'
                      }`}>
                        <input
                          type="radio"
                          name={param.parameter}
                          value={level.score}
                          checked={bradenInputs[param.parameter] === level.score}
                          onChange={() => setBradenInputs(prev => ({ ...prev, [param.parameter]: level.score }))}
                          className="mt-1 text-purple-600"
                        />
                        <div>
                          <span className="text-sm font-medium">{level.score} — {level.label}</span>
                          <p className="text-xs text-gray-500">{level.criteria}</p>
                        </div>
                      </label>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            {/* Result */}
            <div className={`mt-6 p-4 rounded-lg border-2 ${
              bradenTotal <= 9 ? 'border-red-500 bg-red-50' :
              bradenTotal <= 12 ? 'border-orange-500 bg-orange-50' :
              bradenTotal <= 14 ? 'border-yellow-500 bg-yellow-50' :
              bradenTotal <= 18 ? 'border-blue-500 bg-blue-50' :
              'border-green-500 bg-green-50'
            }`}>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-lg font-bold">Braden Score: {bradenTotal}/23</p>
                  <p className={`text-sm font-semibold ${
                    bradenTotal <= 9 ? 'text-red-700' :
                    bradenTotal <= 12 ? 'text-orange-700' :
                    bradenTotal <= 14 ? 'text-yellow-700' :
                    bradenTotal <= 18 ? 'text-blue-700' :
                    'text-green-700'
                  }`}>{bradenRisk}</p>
                </div>
                <Shield className={`h-12 w-12 ${
                  bradenTotal <= 12 ? 'text-red-400' : bradenTotal <= 18 ? 'text-yellow-400' : 'text-green-400'
                }`} />
              </div>
            </div>

            {/* Interpretation table */}
            <div className="mt-4">
              <h3 className="text-sm font-semibold text-gray-700 mb-2">Interpretation</h3>
              <div className="grid grid-cols-1 sm:grid-cols-5 gap-2">
                {BRADEN_INTERPRETATION.map((interp: any) => (
                  <div key={interp.range} className={`p-2 rounded text-center text-xs border ${
                    interp.risk?.includes('Very High') || interp.risk?.includes('Severe') ? 'bg-red-100 border-red-300' :
                    interp.risk?.includes('High') ? 'bg-orange-100 border-orange-300' :
                    interp.risk?.includes('Moderate') ? 'bg-yellow-100 border-yellow-300' :
                    interp.risk?.includes('Mild') ? 'bg-blue-100 border-blue-300' :
                    'bg-green-100 border-green-300'
                  }`}>
                    <p className="font-semibold">{interp.range}</p>
                    <p>{interp.risk}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ============================================ */}
      {/* NEW WOUND TAB */}
      {/* ============================================ */}
      {activeTab === 'wound' && (
        <div className="space-y-6">
          <div className="bg-white border rounded-lg p-6 shadow-sm">
            <h2 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
              <Plus className="h-5 w-5 text-purple-600" /> Record New Pressure Wound
            </h2>

            {/* Patient Search */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">Select Patient</label>
              <div className="relative">
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
                <input
                  type="text"
                  value={patientSearch}
                  onChange={(e) => setPatientSearch(e.target.value)}
                  placeholder="Search by name or hospital number..."
                  className="w-full pl-9 pr-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                />
              </div>
              {patients.length > 0 && patientSearch && (
                <div className="mt-1 border rounded-lg shadow-lg max-h-40 overflow-y-auto bg-white z-10">
                  {patients.map(p => (
                    <button key={p.id} onClick={() => { setSelectedPatient(p); setPatientSearch(''); setPatients([]); }}
                      className="w-full text-left px-3 py-2 hover:bg-purple-50 text-sm border-b last:border-b-0">
                      <span className="font-medium">{p.full_name || `${p.first_name} ${p.last_name}`}</span>
                      <span className="text-gray-500 ml-2">({p.hospital_number})</span>
                    </button>
                  ))}
                </div>
              )}
              {selectedPatient && (
                <div className="mt-2 p-2 bg-purple-50 rounded-lg text-sm flex items-center justify-between">
                  <span><User className="h-4 w-4 inline mr-1" /> {selectedPatient.full_name || `${selectedPatient.first_name} ${selectedPatient.last_name}`} ({selectedPatient.hospital_number})</span>
                  <button onClick={() => setSelectedPatient(null)} className="text-gray-400 hover:text-gray-600" title="Clear patient selection"><X className="h-4 w-4" /></button>
                </div>
              )}
            </div>

            {/* Wound Details Form */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Location *</label>
                <select value={woundForm.location} onChange={e => setWoundForm(prev => ({ ...prev, location: e.target.value }))} title="Wound location"
                  className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-purple-500">
                  <option value="">Select location...</option>
                  <option value="sacrum">Sacrum</option>
                  <option value="ischial_tuberosity">Ischial Tuberosity</option>
                  <option value="greater_trochanter">Greater Trochanter</option>
                  <option value="heel">Heel</option>
                  <option value="occiput">Occiput</option>
                  <option value="scapula">Scapula</option>
                  <option value="elbow">Elbow</option>
                  <option value="malleolus">Malleolus</option>
                  <option value="other">Other</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Laterality</label>
                <select value={woundForm.laterality} onChange={e => setWoundForm(prev => ({ ...prev, laterality: e.target.value }))} title="Laterality"
                  className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-purple-500">
                  <option value="midline">Midline</option>
                  <option value="left">Left</option>
                  <option value="right">Right</option>
                  <option value="bilateral">Bilateral</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Stage *</label>
                <select value={woundForm.currentStage} onChange={e => setWoundForm(prev => ({ ...prev, currentStage: e.target.value }))} title="Wound stage"
                  className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-purple-500">
                  <option value="">Select stage...</option>
                  {PRESSURE_INJURY_STAGES.map(s => (
                    <option key={s.id} value={s.stage}>{s.stage} — {s.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Length (cm)</label>
                <input type="number" step="0.1" value={woundForm.woundLength} title="Wound length in cm"
                  onChange={e => setWoundForm(prev => ({ ...prev, woundLength: e.target.value }))}
                  className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-purple-500" />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Width (cm)</label>
                <input type="number" step="0.1" value={woundForm.woundWidth} title="Wound width in cm"
                  onChange={e => setWoundForm(prev => ({ ...prev, woundWidth: e.target.value }))}
                  className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-purple-500" />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Depth (cm)</label>
                <input type="number" step="0.1" value={woundForm.woundDepth} title="Wound depth in cm"
                  onChange={e => setWoundForm(prev => ({ ...prev, woundDepth: e.target.value }))}
                  className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-purple-500" />
              </div>
            </div>

            {/* Wound Bed Composition */}
            <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Granulation %</label>
                <input type="number" min="0" max="100" value={woundForm.granulationPercent} title="Granulation percentage"
                  onChange={e => setWoundForm(prev => ({ ...prev, granulationPercent: Number(e.target.value) }))}
                  className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-purple-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Slough %</label>
                <input type="number" min="0" max="100" value={woundForm.sloughPercent} title="Slough percentage"
                  onChange={e => setWoundForm(prev => ({ ...prev, sloughPercent: Number(e.target.value) }))}
                  className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-purple-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Eschar %</label>
                <input type="number" min="0" max="100" value={woundForm.escharPercent} title="Eschar percentage"
                  onChange={e => setWoundForm(prev => ({ ...prev, escharPercent: Number(e.target.value) }))}
                  className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-purple-500" />
              </div>
            </div>

            {/* Additional details */}
            <div className="mt-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Exudate Type</label>
                <select value={woundForm.exudateType} onChange={e => setWoundForm(prev => ({ ...prev, exudateType: e.target.value }))} title="Exudate type"
                  className="w-full border rounded-lg px-3 py-2 text-sm">
                  <option value="serous">Serous</option>
                  <option value="serosanguinous">Serosanguinous</option>
                  <option value="sanguinous">Sanguinous</option>
                  <option value="purulent">Purulent</option>
                  <option value="none">None</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Exudate Amount</label>
                <select value={woundForm.exudateAmount} onChange={e => setWoundForm(prev => ({ ...prev, exudateAmount: e.target.value }))} title="Exudate amount"
                  className="w-full border rounded-lg px-3 py-2 text-sm">
                  <option value="none">None</option>
                  <option value="minimal">Minimal</option>
                  <option value="moderate">Moderate</option>
                  <option value="copious">Copious</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Pain Level (0-10)</label>
                <input type="number" min="0" max="10" value={woundForm.painLevel} title="Pain level 0-10"
                  onChange={e => setWoundForm(prev => ({ ...prev, painLevel: Number(e.target.value) }))}
                  className="w-full border rounded-lg px-3 py-2 text-sm" />
              </div>
            </div>

            {/* Important findings */}
            <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-3">
              {[
                { key: 'undermining', label: 'Undermining Present' },
                { key: 'tunneling', label: 'Tunneling Present' },
                { key: 'probeToBone', label: 'Probe to Bone +ve' },
                { key: 'odor', label: 'Odor Present' },
              ].map(item => (
                <label key={item.key} className="flex items-center gap-2 p-2 border rounded cursor-pointer hover:bg-gray-50">
                  <input type="checkbox" checked={(woundForm as any)[item.key]}
                    onChange={e => setWoundForm(prev => ({ ...prev, [item.key]: e.target.checked }))}
                    className="text-purple-600 rounded" />
                  <span className="text-sm">{item.label}</span>
                </label>
              ))}
            </div>

            {/* Infection Signs */}
            <div className="mt-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">Infection Signs</label>
              <div className="flex flex-wrap gap-2">
                {['Increased pain', 'Increased exudate', 'Erythema spreading', 'Warmth', 'Swelling', 'Purulent drainage', 'Foul odor', 'Fever', 'Delayed healing', 'Friable granulation'].map(sign => (
                  <label key={sign} className={`text-xs px-2 py-1 rounded cursor-pointer border transition-colors ${
                    woundForm.infectionSigns.includes(sign) ? 'bg-red-100 border-red-400 text-red-800' : 'bg-gray-50 hover:bg-gray-100'
                  }`}>
                    <input type="checkbox" className="hidden"
                      checked={woundForm.infectionSigns.includes(sign)}
                      onChange={e => {
                        if (e.target.checked) setWoundForm(prev => ({ ...prev, infectionSigns: [...prev.infectionSigns, sign] }));
                        else setWoundForm(prev => ({ ...prev, infectionSigns: prev.infectionSigns.filter(s => s !== sign) }));
                      }} />
                    {sign}
                  </label>
                ))}
              </div>
            </div>

            {/* Notes */}
            <div className="mt-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">Clinical Notes</label>
              <textarea rows={3} value={woundForm.notes}
                onChange={e => setWoundForm(prev => ({ ...prev, notes: e.target.value }))}
                className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-purple-500"
                placeholder="Additional clinical notes..." />
            </div>

            <div className="mt-6 flex gap-3">
              <button onClick={saveWound} disabled={isSaving}
                className="flex items-center gap-2 px-6 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50">
                {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                Save Wound Record
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ============================================ */}
      {/* WOUND RECORDS TAB */}
      {/* ============================================ */}
      {activeTab === 'wounds' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-gray-800">Patient Wound Records</h2>
            <button onClick={() => fetchWounds()} className="flex items-center gap-1 px-3 py-2 border rounded-lg hover:bg-gray-50 text-sm">
              <Search className="h-4 w-4" /> Load All Wounds
            </button>
          </div>

          {/* Patient filter */}
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
              <input type="text" value={patientSearch}
                onChange={(e) => { setPatientSearch(e.target.value); }}
                placeholder="Search patient to filter wounds..."
                className="w-full pl-9 pr-3 py-2 border rounded-lg text-sm" />
            </div>
            {patients.length > 0 && patientSearch && (
              <div className="absolute mt-10 bg-white border rounded-lg shadow-lg max-h-40 overflow-y-auto z-10">
                {patients.map(p => (
                  <button key={p.id} onClick={() => {
                    setSelectedPatient(p); setPatientSearch(''); setPatients([]);
                    fetchWounds(String(p.id));
                  }} className="w-full text-left px-3 py-2 hover:bg-purple-50 text-sm border-b">
                    {p.full_name || `${p.first_name} ${p.last_name}`} ({p.hospital_number})
                  </button>
                ))}
              </div>
            )}
          </div>

          {isLoading ? (
            <div className="flex justify-center py-8"><Loader2 className="h-8 w-8 animate-spin text-purple-600" /></div>
          ) : wounds.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <CircleDot className="h-12 w-12 mx-auto mb-2 text-gray-300" />
              <p>No wound records found. Record a new wound assessment.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {wounds.map(wound => (
                <div key={wound.id} className={`border rounded-lg p-4 shadow-sm cursor-pointer hover:shadow-md transition-shadow ${
                  selectedWound?.id === wound.id ? 'ring-2 ring-purple-500' : ''
                }`} onClick={() => fetchWoundDetails(wound.id)}>
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="font-bold text-gray-800">{wound.patient_name}</h3>
                    <span className={`px-2 py-0.5 rounded text-xs font-semibold ${
                      wound.current_stage?.includes('4') || wound.current_stage === 'Unstageable' ? 'bg-red-200 text-red-800' :
                      wound.current_stage?.includes('3') ? 'bg-orange-200 text-orange-800' :
                      wound.current_stage?.includes('2') ? 'bg-yellow-200 text-yellow-800' :
                      'bg-green-200 text-green-800'
                    }`}>{wound.current_stage}</span>
                  </div>
                  <p className="text-sm text-gray-600">Location: {wound.location} ({wound.laterality})</p>
                  <p className="text-sm text-gray-600">Size: {wound.wound_length}×{wound.wound_width}×{wound.wound_depth} cm</p>
                  <p className="text-xs text-gray-400 mt-1">Braden: {wound.braden_score} | {wound.braden_risk}</p>
                  <p className="text-xs text-gray-400">{new Date(wound.created_at).toLocaleDateString()}</p>
                  {wound.probe_to_bone && (
                    <span className="inline-block mt-1 text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded">Probe to Bone +ve</span>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ============================================ */}
      {/* TREATMENT PLANS TAB */}
      {/* ============================================ */}
      {activeTab === 'treatment' && (
        <div className="space-y-6">
          {selectedWound ? (
            <>
              <div className="bg-purple-50 border border-purple-200 rounded-lg p-3 text-sm">
                <strong>Active wound:</strong> {selectedWound.patient_name} — {selectedWound.location} ({selectedWound.current_stage})
                | Size: {selectedWound.wound_length}×{selectedWound.wound_width} cm
              </div>

              {/* Select Protocol */}
              <div>
                <h3 className="text-lg font-bold text-gray-800 mb-3">Select Treatment Protocol</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {PS_TREATMENT_PROTOCOLS.map(protocol => (
                    <div key={protocol.id} className="border rounded-lg p-4 shadow-sm">
                      <h4 className="font-bold text-gray-800">{protocol.stage} ({protocol.severity})</h4>
                      <div className="mt-2 text-xs text-gray-600">
                        <p><strong>Wound Care:</strong> {protocol.woundCare.length} interventions</p>
                        <p><strong>Surgical Options:</strong> {protocol.surgicalOptions.length} procedures</p>
                        {protocol.antibiotics && <p><strong>Antibiotics:</strong> {protocol.antibiotics.length} regimens</p>}
                      </div>
                      {/* Wound care details */}
                      <div className="mt-2">
                        {protocol.woundCare.slice(0, 2).map((wc, i) => (
                          <p key={i} className="text-xs text-gray-500">• {wc.name}: {wc.dressingType}</p>
                        ))}
                      </div>
                      {/* Surgical options preview */}
                      {protocol.surgicalOptions.length > 0 && (
                        <div className="mt-2">
                          <p className="text-xs font-semibold text-purple-700">Surgical:</p>
                          {protocol.surgicalOptions.slice(0, 2).map((so, i) => (
                            <p key={i} className="text-xs text-gray-500">• {so.procedure} ({so.timing})</p>
                          ))}
                        </div>
                      )}
                      {/* Nutrition preview */}
                      <div className="mt-2 text-xs text-gray-500">
                        <p><strong>Nutrition:</strong> {protocol.nutritionPlan.calories}, Protein: {protocol.nutritionPlan.protein}</p>
                      </div>
                      <button onClick={() => createTreatmentPlan(protocol.id)} disabled={isSaving}
                        className="mt-3 w-full flex items-center justify-center gap-1 px-3 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 text-sm disabled:opacity-50">
                        {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                        Apply Protocol
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              {/* Existing Treatment Plans */}
              {treatmentPlans.length > 0 && (
                <div>
                  <h3 className="text-lg font-bold text-gray-800 mb-3">Active Treatment Plans</h3>
                  {treatmentPlans.map(plan => (
                    <div key={plan.id} className="border rounded-lg p-4 shadow-sm mb-3">
                      <div className="flex items-center justify-between mb-2">
                        <div>
                          <h4 className="font-bold text-gray-800">{plan.stage} Protocol</h4>
                          <p className="text-xs text-gray-500">Created: {new Date(plan.created_at).toLocaleDateString()}</p>
                        </div>
                        {plan.auto_orders_approved ? (
                          <span className="px-2 py-1 bg-green-100 text-green-800 rounded text-xs font-semibold">
                            <CheckCircle className="h-3 w-3 inline mr-1" /> Approved & Orders Sent
                          </span>
                        ) : (
                          <button onClick={() => approveTreatmentPlan(plan.id)} disabled={isSaving}
                            className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm flex items-center gap-1">
                            <CheckCircle className="h-4 w-4" /> Approve & Auto-Order
                          </button>
                        )}
                      </div>
                      {/* Show plan details */}
                      {plan.wound_care && (
                        <div className="mt-2 text-xs text-gray-600">
                          <p className="font-semibold">Wound Care:</p>
                          {(typeof plan.wound_care === 'string' ? JSON.parse(plan.wound_care) : plan.wound_care).slice(0, 2).map((wc: any, i: number) => (
                            <p key={i} className="ml-2">• {wc.name} — {wc.dressingType} ({wc.frequency})</p>
                          ))}
                        </div>
                      )}
                      {plan.nutrition_plan && (
                        <div className="mt-1 text-xs text-gray-600">
                          <p className="font-semibold">Nutrition:</p>
                          <p className="ml-2">{(typeof plan.nutrition_plan === 'string' ? JSON.parse(plan.nutrition_plan) : plan.nutrition_plan).calories} | Protein: {(typeof plan.nutrition_plan === 'string' ? JSON.parse(plan.nutrition_plan) : plan.nutrition_plan).protein}</p>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </>
          ) : (
            <div className="text-center py-8 text-gray-500">
              <Activity className="h-12 w-12 mx-auto mb-2 text-gray-300" />
              <p>Select a wound from the "Wound Records" tab to create or view treatment plans.</p>
            </div>
          )}
        </div>
      )}

      {/* ============================================ */}
      {/* PROGRESS TRACKING TAB */}
      {/* ============================================ */}
      {activeTab === 'progress' && (
        <div className="space-y-6">
          {selectedWound ? (
            <>
              <div className="bg-purple-50 border border-purple-200 rounded-lg p-3 text-sm">
                <strong>Tracking:</strong> {selectedWound.patient_name} — {selectedWound.location} ({selectedWound.current_stage})
              </div>

              {/* Progress Note Form */}
              <div className="bg-white border rounded-lg p-6 shadow-sm">
                <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
                  <TrendingUp className="h-5 w-5 text-purple-600" /> New Progress Note
                </h3>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Length (cm)</label>
                    <input type="number" step="0.1" value={progressForm.woundLength} title="Wound length in cm"
                      onChange={e => setProgressForm(prev => ({ ...prev, woundLength: e.target.value }))}
                      className="w-full border rounded-lg px-3 py-2 text-sm" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Width (cm)</label>
                    <input type="number" step="0.1" value={progressForm.woundWidth} title="Wound width in cm"
                      onChange={e => setProgressForm(prev => ({ ...prev, woundWidth: e.target.value }))}
                      className="w-full border rounded-lg px-3 py-2 text-sm" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Depth (cm)</label>
                    <input type="number" step="0.1" value={progressForm.woundDepth} title="Wound depth in cm"
                      onChange={e => setProgressForm(prev => ({ ...prev, woundDepth: e.target.value }))}
                      className="w-full border rounded-lg px-3 py-2 text-sm" />
                  </div>
                </div>

                <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Granulation %</label>
                    <input type="number" min="0" max="100" value={progressForm.granulationPercent} title="Granulation percentage"
                      onChange={e => setProgressForm(prev => ({ ...prev, granulationPercent: Number(e.target.value) }))}
                      className="w-full border rounded-lg px-3 py-2 text-sm" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Slough %</label>
                    <input type="number" min="0" max="100" value={progressForm.sloughPercent} title="Slough percentage"
                      onChange={e => setProgressForm(prev => ({ ...prev, sloughPercent: Number(e.target.value) }))}
                      className="w-full border rounded-lg px-3 py-2 text-sm" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Eschar %</label>
                    <input type="number" min="0" max="100" value={progressForm.escharPercent} title="Eschar percentage"
                      onChange={e => setProgressForm(prev => ({ ...prev, escharPercent: Number(e.target.value) }))}
                      className="w-full border rounded-lg px-3 py-2 text-sm" />
                  </div>
                </div>

                <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Dressing Used</label>
                    <input type="text" value={progressForm.dressingUsed}
                      onChange={e => setProgressForm(prev => ({ ...prev, dressingUsed: e.target.value }))}
                      className="w-full border rounded-lg px-3 py-2 text-sm"
                      placeholder="e.g., Foam dressing, Hydrocolloid..." />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Pain Level (0-10)</label>
                    <input type="number" min="0" max="10" value={progressForm.painLevel} title="Pain level 0-10"
                      onChange={e => setProgressForm(prev => ({ ...prev, painLevel: Number(e.target.value) }))}
                      className="w-full border rounded-lg px-3 py-2 text-sm" />
                  </div>
                  <div className="flex items-end gap-4">
                    <label className="flex items-center gap-2 text-sm">
                      <input type="checkbox" checked={progressForm.repositioningCompliance}
                        onChange={e => setProgressForm(prev => ({ ...prev, repositioningCompliance: e.target.checked }))}
                        className="text-purple-600 rounded" />
                      Repositioning Compliant
                    </label>
                    <label className="flex items-center gap-2 text-sm">
                      <input type="checkbox" checked={progressForm.nutritionAdherence}
                        onChange={e => setProgressForm(prev => ({ ...prev, nutritionAdherence: e.target.checked }))}
                        className="text-purple-600 rounded" />
                      Nutrition Adherent
                    </label>
                  </div>
                </div>

                <div className="mt-4">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
                  <textarea rows={2} value={progressForm.notes}
                    onChange={e => setProgressForm(prev => ({ ...prev, notes: e.target.value }))}
                    className="w-full border rounded-lg px-3 py-2 text-sm"
                    placeholder="Progress observations..." />
                </div>

                <button onClick={saveProgressNote} disabled={isSaving}
                  className="mt-4 flex items-center gap-2 px-6 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50">
                  {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                  Record Progress Note
                </button>
              </div>

              {/* Progress History */}
              {progressNotes.length > 0 && (
                <div>
                  <h3 className="text-lg font-bold text-gray-800 mb-3">Progress History</h3>
                  <div className="overflow-x-auto">
                    <table className="min-w-full text-sm border">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-3 py-2 text-left border-b">Date</th>
                          <th className="px-3 py-2 text-left border-b">Size (L×W×D)</th>
                          <th className="px-3 py-2 text-left border-b">Gran %</th>
                          <th className="px-3 py-2 text-left border-b">Slough %</th>
                          <th className="px-3 py-2 text-left border-b">Healing Rate</th>
                          <th className="px-3 py-2 text-left border-b">Pain</th>
                          <th className="px-3 py-2 text-left border-b">Dressing</th>
                          <th className="px-3 py-2 text-left border-b">Notes</th>
                        </tr>
                      </thead>
                      <tbody>
                        {progressNotes.map((note, idx) => (
                          <tr key={note.id || idx} className="border-b hover:bg-gray-50">
                            <td className="px-3 py-2">{new Date(note.assessment_date || note.created_at).toLocaleDateString()}</td>
                            <td className="px-3 py-2">{note.wound_length}×{note.wound_width}×{note.wound_depth}</td>
                            <td className="px-3 py-2">{note.granulation_percent}%</td>
                            <td className="px-3 py-2">{note.slough_percent}%</td>
                            <td className="px-3 py-2">
                              <span className={`px-2 py-0.5 rounded text-xs font-semibold ${
                                (note.healing_rate || 0) > 0 ? 'bg-green-100 text-green-700' :
                                (note.healing_rate || 0) < 0 ? 'bg-red-100 text-red-700' :
                                'bg-gray-100 text-gray-700'
                              }`}>{note.healing_rate || 0}%</span>
                            </td>
                            <td className="px-3 py-2">{note.pain_level}/10</td>
                            <td className="px-3 py-2">{note.dressing_used}</td>
                            <td className="px-3 py-2 max-w-[200px] truncate">{note.notes}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="text-center py-8 text-gray-500">
              <TrendingUp className="h-12 w-12 mx-auto mb-2 text-gray-300" />
              <p>Select a wound from "Wound Records" to track progress.</p>
            </div>
          )}
        </div>
      )}

      {/* ============================================ */}
      {/* AUTO-ORDERS TAB */}
      {/* ============================================ */}
      {activeTab === 'orders' && (
        <div className="space-y-4">
          <h2 className="text-lg font-bold text-gray-800 flex items-center gap-2">
            <List className="h-5 w-5 text-purple-600" /> Auto-Generated Orders
          </h2>
          <p className="text-sm text-gray-600">
            Orders are automatically generated when a treatment plan is approved. They are linked to the patient's prescriptions, lab orders, and procedures.
          </p>

          {orders.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <List className="h-12 w-12 mx-auto mb-2 text-gray-300" />
              <p>No auto-orders yet. Approve a treatment plan to generate orders.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {orders.map(order => (
                <div key={order.id} className={`border rounded-lg p-4 shadow-sm flex items-center justify-between ${
                  order.order_type === 'prescription' ? 'border-l-4 border-l-blue-500' :
                  order.order_type === 'lab' ? 'border-l-4 border-l-yellow-500' :
                  'border-l-4 border-l-green-500'
                }`}>
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`px-2 py-0.5 rounded text-xs font-semibold uppercase ${
                        order.order_type === 'prescription' ? 'bg-blue-100 text-blue-800' :
                        order.order_type === 'lab' ? 'bg-yellow-100 text-yellow-800' :
                        'bg-green-100 text-green-800'
                      }`}>{order.order_type}</span>
                      <span className={`px-2 py-0.5 rounded text-xs ${
                        order.tracking_status === 'completed' ? 'bg-green-100 text-green-800' :
                        order.tracking_status === 'in_progress' ? 'bg-blue-100 text-blue-800' :
                        'bg-gray-100 text-gray-700'
                      }`}>{order.tracking_status || 'pending'}</span>
                    </div>
                    <p className="text-sm font-medium text-gray-800">{order.order_details?.description || order.order_details?.drug || order.order_details?.testName || 'Order'}</p>
                    <p className="text-xs text-gray-500">{new Date(order.created_at).toLocaleDateString()}</p>
                  </div>
                  <div className="text-xs text-gray-400">
                    {order.linked_prescription_id && <span className="block">Rx #{order.linked_prescription_id}</span>}
                    {order.linked_lab_order_id && <span className="block">Lab #{order.linked_lab_order_id}</span>}
                    {order.linked_procedure_id && <span className="block">Proc #{order.linked_procedure_id}</span>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ============================================ */}
      {/* EDUCATION TAB */}
      {/* ============================================ */}
      {activeTab === 'education' && (
        <div className="space-y-6">
          <h2 className="text-xl font-bold text-gray-800">Patient & Caregiver Education</h2>

          {PS_PATIENT_EDUCATION.map(edu => (
            <div key={edu.id} className="bg-white border rounded-lg p-6 shadow-sm">
              <div className="flex items-center gap-2 mb-4">
                <BookOpen className="h-5 w-5 text-purple-600" />
                <h3 className="text-lg font-bold text-gray-800">{edu.title}</h3>
                <span className="px-2 py-0.5 bg-purple-100 text-purple-800 rounded text-xs">{edu.targetAudience}</span>
              </div>

              <div className="space-y-4">
                {edu.content.map((section, i) => (
                  <div key={i}>
                    <h4 className="font-semibold text-gray-700 mb-1">{section.heading}</h4>
                    <p className="text-sm text-gray-600 whitespace-pre-line">{section.body}</p>
                  </div>
                ))}
              </div>

              {edu.warningSignsToReport.length > 0 && (
                <div className="mt-4 bg-red-50 border border-red-200 rounded-lg p-4">
                  <h4 className="text-sm font-bold text-red-800 mb-2 flex items-center gap-1">
                    <AlertTriangle className="h-4 w-4" /> Warning Signs — When to Seek Immediate Help
                  </h4>
                  <ul className="space-y-1">
                    {edu.warningSignsToReport.map((sign, i) => (
                      <li key={i} className="text-sm text-red-700 flex items-start gap-1">
                        <AlertCircle className="h-3 w-3 mt-0.5 flex-shrink-0" /> {sign}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {edu.selfCareInstructions.length > 0 && (
                <div className="mt-4 bg-green-50 border border-green-200 rounded-lg p-4">
                  <h4 className="text-sm font-bold text-green-800 mb-2">Self-Care Instructions</h4>
                  <ul className="space-y-1">
                    {edu.selfCareInstructions.map((inst, i) => (
                      <li key={i} className="text-sm text-green-700 flex items-start gap-1">
                        <CheckCircle className="h-3 w-3 mt-0.5 flex-shrink-0" /> {inst}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          ))}

          {/* Nursing Protocols */}
          <h2 className="text-xl font-bold text-gray-800 mt-8">Nursing Protocols</h2>
          {PS_NURSING_PROTOCOLS.map(np => (
            <div key={np.id} className="bg-white border rounded-lg p-6 shadow-sm">
              <h3 className="text-lg font-bold text-gray-800 mb-2">{np.topic}</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-3">
                <div>
                  <p className="text-xs font-semibold text-gray-600 mb-1">Objectives:</p>
                  {np.objectives.map((obj, i) => (
                    <p key={i} className="text-xs text-gray-500 flex items-start gap-1 mb-0.5">
                      <ArrowRight className="h-3 w-3 mt-0.5 text-green-500 flex-shrink-0" /> {obj}
                    </p>
                  ))}
                </div>
                <div>
                  <p className="text-xs font-semibold text-gray-600 mb-1">Key Points:</p>
                  {np.keyPoints.map((kp, i) => (
                    <p key={i} className="text-xs text-gray-500 flex items-start gap-1 mb-0.5">
                      <CheckCircle className="h-3 w-3 mt-0.5 text-purple-500 flex-shrink-0" /> {kp}
                    </p>
                  ))}
                </div>
              </div>
              {np.escalationTriggers.length > 0 && (
                <div className="mt-3 bg-red-50 p-3 rounded-lg">
                  <p className="text-xs font-semibold text-red-700 mb-1">Escalation Triggers:</p>
                  <div className="flex flex-wrap gap-1">
                    {np.escalationTriggers.map((t, i) => (
                      <span key={i} className="text-xs bg-red-200/60 text-red-800 px-2 py-0.5 rounded">{t}</span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ))}

          {/* Lab Panels */}
          <h2 className="text-xl font-bold text-gray-800 mt-8">Laboratory Panels</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {PS_LAB_PANELS.map(panel => (
              <div key={panel.id} className="bg-white border rounded-lg p-4 shadow-sm">
                <h3 className="font-bold text-gray-800 mb-1">{panel.name}</h3>
                <p className="text-xs text-gray-500 mb-2">Frequency: {panel.frequency} | Stages: {panel.applicableStages.join(', ')}</p>
                <div className="space-y-1">
                  {panel.tests.map((test, i) => (
                    <div key={i} className="flex items-center justify-between text-xs">
                      <span className="text-gray-700">{test.testName}</span>
                      <span className={`px-1.5 py-0.5 rounded ${
                        test.urgency === 'stat' ? 'bg-red-100 text-red-700' :
                        test.urgency === 'urgent' ? 'bg-orange-100 text-orange-700' :
                        'bg-gray-100 text-gray-600'
                      }`}>{test.urgency}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ============================================ */}
      {/* CME ASSESSMENT TAB */}
      {/* ============================================ */}
      {activeTab === 'cme' && (
        <div className="space-y-6">
          <div className="bg-white border rounded-lg p-6 shadow-sm">
            <div className="flex items-center gap-2 mb-2">
              <Award className="h-6 w-6 text-purple-600" />
              <h2 className="text-xl font-bold text-gray-800">{PS_CME_ARTICLE.title}</h2>
            </div>
            <p className="text-sm text-gray-600 mb-1">{PS_CME_ARTICLE.authors}</p>
            <p className="text-sm text-gray-700 mb-4">{PS_CME_ARTICLE.abstract}</p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs mb-4">
              <div className="bg-purple-50 p-2 rounded"><strong>CME Credits:</strong> {PS_CME_ARTICLE.cmeCredits}</div>
              <div className="bg-purple-50 p-2 rounded"><strong>Passing Score:</strong> 70%</div>
            </div>

            {/* Article Sections */}
            <div className="space-y-4 mb-8">
              {PS_CME_ARTICLE.sections.map((section, i) => (
                <div key={i}>
                  <h3 className="font-bold text-gray-800 mb-1">{section.heading}</h3>
                  <p className="text-sm text-gray-600 whitespace-pre-line">{section.content}</p>
                </div>
              ))}
            </div>

            {/* Learning Objectives */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
              <h3 className="font-bold text-blue-800 mb-2">Learning Objectives</h3>
              <ul className="space-y-1">
                {PS_CME_ARTICLE.learningObjectives.map((obj, i) => (
                  <li key={i} className="text-sm text-blue-700 flex items-start gap-1">
                    <CheckCircle className="h-3 w-3 mt-0.5 flex-shrink-0" /> {obj}
                  </li>
                ))}
              </ul>
            </div>

            {/* MCQ Questions */}
            <h3 className="text-lg font-bold text-gray-800 mb-4">Assessment Questions</h3>
            <div className="space-y-6">
              {PS_CME_ARTICLE.mcqQuestions.map((q, idx) => (
                <div key={q.id} className={`border rounded-lg p-4 ${
                  cmeSubmitted ? (cmeAnswers[idx] === q.correctAnswer ? 'bg-green-50 border-green-300' : 'bg-red-50 border-red-300') : ''
                }`}>
                  <p className="text-sm font-medium text-gray-800 mb-3">
                    {idx + 1}. {q.question}
                    <span className="ml-2 text-xs text-gray-400">({q.difficulty})</span>
                  </p>
                  <div className="space-y-2">
                    {q.options.map((opt, oi) => (
                      <label key={oi} className={`flex items-start gap-2 p-2 rounded cursor-pointer text-sm ${
                        cmeSubmitted && oi === q.correctAnswer ? 'bg-green-100 font-semibold' :
                        cmeSubmitted && cmeAnswers[idx] === oi && oi !== q.correctAnswer ? 'bg-red-100' :
                        cmeAnswers[idx] === oi ? 'bg-purple-50 border border-purple-300' : 'hover:bg-gray-50'
                      }`}>
                        <input type="radio" name={`cme-q-${idx}`} value={oi}
                          checked={cmeAnswers[idx] === oi}
                          onChange={() => setCmeAnswers(prev => ({ ...prev, [idx]: oi }))}
                          disabled={cmeSubmitted}
                          className="mt-0.5 text-purple-600" />
                        {opt}
                      </label>
                    ))}
                  </div>
                  {cmeSubmitted && (
                    <div className="mt-2 text-xs text-gray-600 bg-white/80 p-2 rounded">
                      <strong>Explanation:</strong> {q.explanation}
                    </div>
                  )}
                </div>
              ))}
            </div>

            {!cmeSubmitted ? (
              <button onClick={submitCME}
                disabled={Object.keys(cmeAnswers).length < PS_CME_ARTICLE.mcqQuestions.length}
                className="mt-6 w-full py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 font-semibold">
                Submit CME Assessment ({Object.keys(cmeAnswers).length}/{PS_CME_ARTICLE.mcqQuestions.length} answered)
              </button>
            ) : (
              <div className={`mt-6 p-4 rounded-lg text-center ${cmeScore >= 70 ? 'bg-green-100 border border-green-300' : 'bg-red-100 border border-red-300'}`}>
                <p className="text-lg sm:text-2xl font-bold">{cmeScore}%</p>
                <p className={`text-sm font-semibold ${cmeScore >= 70 ? 'text-green-800' : 'text-red-800'}`}>
                  {cmeScore >= 70 ? `PASSED — ${PS_CME_ARTICLE.cmeCredits} CME credits earned!` : 'Did not pass. Review the material and retake.'}
                </p>
                {cmeScore < 70 && (
                  <button onClick={() => { setCmeSubmitted(false); setCmeAnswers({}); setCmeScore(0); }}
                    className="mt-2 px-4 py-2 bg-purple-600 text-white rounded-lg text-sm">
                    Retake Assessment
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default PressureSorePage;

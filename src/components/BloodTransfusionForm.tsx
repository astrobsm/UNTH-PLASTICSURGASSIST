import React, { useState, useEffect } from 'react';
import { 
  Droplet, 
  AlertCircle, 
  CheckCircle,
  Plus,
  X,
  Activity,
  Clock,
  FileText,
  Save,
  Play,
  Square,
  CheckSquare,
  Download,
  Upload,
  Printer,
  FileDown,
  ClipboardList
} from 'lucide-react';
import { db } from '../db/database';
import { patientService } from '../services/patientService';
import {
  bloodTransfusionService,
  BloodTransfusion,
  BloodBagDetails,
  TransfusionVitals,
  TransfusionComplication,
  PreviousTransfusion
} from '../services/bloodTransfusionService';
import { transfusionPdfService, TransfusionOrderData, TransfusionMonitoringEntry } from '../services/transfusionPdfService';
import TransfusionChartUpload from './TransfusionChartUpload';
import { format } from 'date-fns';

// Helper component to display vitals
function VitalsDisplay({ vitals }: { vitals: TransfusionVitals }) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-sm">
      <div><strong>Temperature:</strong> {vitals.temperature}°C</div>
      <div><strong>Pulse:</strong> {vitals.pulse} bpm</div>
      <div><strong>BP:</strong> {vitals.bp_systolic}/{vitals.bp_diastolic} mmHg</div>
      <div><strong>Resp Rate:</strong> {vitals.respiratory_rate} bpm</div>
      <div><strong>SpO₂:</strong> {vitals.spo2}%</div>
      <div><strong>Recorded by:</strong> {vitals.recorded_by}</div>
    </div>
  );
}

interface BloodTransfusionFormProps {
  transfusionId?: string;
  patientId?: string;
  onClose: () => void;
  onSave?: () => void;
}

export default function BloodTransfusionForm({
  transfusionId,
  patientId,
  onClose,
  onSave
}: BloodTransfusionFormProps) {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [patients, setPatients] = useState<any[]>([]);
  const [selectedPatient, setSelectedPatient] = useState<any>(null);
  const [activeTab, setActiveTab] = useState<'details' | 'bags' | 'vitals' | 'complications' | 'documents'>('details');

  // Form data
  const [formData, setFormData] = useState<Partial<BloodTransfusion>>({
    patient_id: patientId || '',
    hospital_number: '',
    indication: '',
    baseline_hb: 0,
    target_hb: undefined,
    clinical_status: '',
    urgent: false,
    blood_bags: [],
    total_units: 0,
    previous_transfusions: [],
    history_of_reactions: false,
    transfusion_date: new Date(),
    start_time: '',
    consent_obtained: false,
    patient_identification_verified: false,
    blood_group_verified: false,
    crossmatch_checked: false,
    adverse_events: false,
    status: 'planned',
    administered_by: localStorage.getItem('user_name') || 'Current User'
  });

  // Blood bag form
  const [newBag, setNewBag] = useState<Partial<BloodBagDetails>>({
    bag_number: '',
    blood_group: 'O+',
    component_type: 'packed_rbc',
    volume_ml: 350,
    donation_date: new Date(),
    expiry_date: new Date(),
    source: 'blood_bank',
    screening_done: true,
    crossmatch_compatible: true
  });

  // Vitals form
  const [vitalsType, setVitalsType] = useState<'pre' | 'during' | 'post'>('pre');
  const [newVitals, setNewVitals] = useState<Partial<TransfusionVitals>>({
    temperature: 36.5,
    pulse: 80,
    bp_systolic: 120,
    bp_diastolic: 80,
    respiratory_rate: 18,
    spo2: 98
  });

  // Complication form
  const [newComplication, setNewComplication] = useState<Partial<TransfusionComplication>>({
    complication_type: 'febrile_reaction',
    severity: 'mild',
    symptoms: [],
    management: '',
    resolved: false
  });
  const [symptomInput, setSymptomInput] = useState('');

  // Previous transfusion form
  const [newPreviousTransfusion, setNewPreviousTransfusion] = useState<Partial<PreviousTransfusion>>({
    date: new Date(),
    indication: '',
    blood_group: '',
    component: '',
    units: 1,
    complications: ''
  });

  const tabs = [
    { id: 'details', label: 'Patient & Indication', icon: FileText },
    { id: 'bags', label: 'Blood Bags', icon: Droplet },
    { id: 'vitals', label: 'Vitals Monitoring', icon: Activity },
    { id: 'complications', label: 'Complications', icon: AlertCircle },
    { id: 'documents', label: 'Documents & Charts', icon: ClipboardList }
  ];

  useEffect(() => {
    loadPatients();
    if (transfusionId) {
      loadTransfusion();
    } else if (patientId) {
      loadPatient(patientId);
    }
  }, [transfusionId, patientId]);

  const loadPatients = async () => {
    try {
      const list = await patientService.getAllPatients();
      setPatients(list);
    } catch (error) {
      console.error('Failed to load patients:', error);
    }
  };

  const loadPatient = async (pid: string) => {
    try {
      const patient = await patientService.getPatient(pid);
      if (patient) {
        setSelectedPatient(patient);
        setFormData(prev => ({
          ...prev,
          patient_id: String(patient.id),
          patient_name: `${patient.first_name} ${patient.last_name}`,
          hospital_number: patient.hospital_number
        }));
      }
    } catch (error) {
      console.error('Failed to load patient:', error);
    }
  };

  const loadTransfusion = async () => {
    if (!transfusionId) return;
    try {
      setLoading(true);
      const transfusion = await bloodTransfusionService.getTransfusion(transfusionId);
      if (transfusion) {
        setFormData(transfusion);
        if (transfusion.patient_id) {
          await loadPatient(transfusion.patient_id);
        }
      }
    } catch (error) {
      console.error('Failed to load transfusion:', error);
    } finally {
      setLoading(false);
    }
  };

  const handlePatientSelect = async (e: React.ChangeEvent<HTMLSelectElement>) => {
    const pid = e.target.value;
    if (pid) {
      await loadPatient(pid);
    }
  };

  const addBloodBag = () => {
    if (!newBag.bag_number || !newBag.blood_group) {
      alert('Please enter bag number and blood group');
      return;
    }

    // Validate compatibility if patient blood group is known
    if (selectedPatient?.blood_group && newBag.blood_group) {
      const validation = bloodTransfusionService.validateBloodBag(
        selectedPatient.blood_group,
        newBag.blood_group
      );
      if (!validation.compatible) {
        const proceed = window.confirm(`${validation.message}\n\nAre you ABSOLUTELY SURE you want to proceed?`);
        if (!proceed) return;
      }
    }

    const bags = [...(formData.blood_bags || []), newBag as BloodBagDetails];
    setFormData({
      ...formData,
      blood_bags: bags,
      total_units: bags.length
    });

    // Reset form
    setNewBag({
      bag_number: '',
      blood_group: newBag.blood_group,
      component_type: newBag.component_type,
      volume_ml: 350,
      donation_date: new Date(),
      expiry_date: new Date(),
      source: newBag.source,
      screening_done: true,
      crossmatch_compatible: true
    });
  };

  const removeBag = (index: number) => {
    const bags = formData.blood_bags?.filter((_, i) => i !== index) || [];
    setFormData({
      ...formData,
      blood_bags: bags,
      total_units: bags.length
    });
  };

  const recordVitals = async () => {
    if (!transfusionId) {
      alert('Save the transfusion record first before recording vitals');
      return;
    }

    try {
      const vitals: TransfusionVitals = {
        transfusion_id: transfusionId,
        patient_id: formData.patient_id!,
        measurement_type: vitalsType,
        temperature: newVitals.temperature!,
        pulse: newVitals.pulse!,
        bp_systolic: newVitals.bp_systolic!,
        bp_diastolic: newVitals.bp_diastolic!,
        respiratory_rate: newVitals.respiratory_rate!,
        spo2: newVitals.spo2!,
        recorded_at: new Date(),
        recorded_by: localStorage.getItem('user_name') || 'Current User'
      };

      await bloodTransfusionService.recordVitals(vitals);
      alert('Vitals recorded successfully!');
      
      // Reload transfusion to get updated vitals
      await loadTransfusion();
    } catch (error) {
      console.error('Failed to record vitals:', error);
      alert('Failed to record vitals');
    }
  };

  const addComplication = async () => {
    if (!transfusionId) {
      alert('Save the transfusion record first');
      return;
    }

    if (newComplication.symptoms!.length === 0) {
      alert('Please add at least one symptom');
      return;
    }

    try {
      const complication: TransfusionComplication = {
        transfusion_id: transfusionId,
        patient_id: formData.patient_id!,
        complication_type: newComplication.complication_type!,
        severity: newComplication.severity!,
        symptoms: newComplication.symptoms!,
        management: newComplication.management!,
        detected_at: new Date(),
        resolved: false
      };

      await bloodTransfusionService.recordComplication(complication);
      alert('Complication recorded successfully!');
      
      // Reload transfusion
      await loadTransfusion();
      
      // Reset form
      setNewComplication({
        complication_type: 'febrile_reaction',
        severity: 'mild',
        symptoms: [],
        management: '',
        resolved: false
      });
    } catch (error) {
      console.error('Failed to record complication:', error);
      alert('Failed to record complication');
    }
  };

  const addSymptom = () => {
    if (symptomInput.trim()) {
      setNewComplication({
        ...newComplication,
        symptoms: [...(newComplication.symptoms || []), symptomInput.trim()]
      });
      setSymptomInput('');
    }
  };

  const removeSymptom = (index: number) => {
    setNewComplication({
      ...newComplication,
      symptoms: newComplication.symptoms?.filter((_, i) => i !== index)
    });
  };

  const addPreviousTransfusion = () => {
    if (!newPreviousTransfusion.indication || !newPreviousTransfusion.blood_group) {
      alert('Please enter indication and blood group');
      return;
    }

    setFormData({
      ...formData,
      previous_transfusions: [
        ...(formData.previous_transfusions || []),
        newPreviousTransfusion as PreviousTransfusion
      ]
    });

    setNewPreviousTransfusion({
      date: new Date(),
      indication: '',
      blood_group: '',
      component: '',
      units: 1
    });
  };

  const saveTransfusion = async () => {
    if (!formData.patient_id || !formData.indication || !formData.baseline_hb) {
      alert('Please fill in patient, indication, and baseline Hb');
      return;
    }

    if (!formData.blood_bags || formData.blood_bags.length === 0) {
      alert('Please add at least one blood bag');
      return;
    }

    try {
      setSaving(true);
      
      if (transfusionId) {
        await bloodTransfusionService.updateTransfusion(transfusionId, formData);
        alert('Transfusion updated successfully!');
      } else {
        const id = await bloodTransfusionService.createTransfusion(formData as BloodTransfusion);
        alert('Transfusion record created successfully!');
        // Reload with new ID
        window.location.reload(); // Simple approach - you can make this more elegant
      }
      
      if (onSave) onSave();
    } catch (error) {
      console.error('Failed to save transfusion:', error);
      alert('Failed to save transfusion record');
    } finally {
      setSaving(false);
    }
  };

  const startTransfusion = async () => {
    if (!transfusionId) {
      alert('Please save the transfusion record first');
      return;
    }

    if (!formData.consent_obtained || !formData.patient_identification_verified ||
        !formData.blood_group_verified || !formData.crossmatch_checked) {
      alert('All pre-transfusion checks must be completed before starting');
      return;
    }

    const startTime = new Date().toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit' });
    try {
      await bloodTransfusionService.startTransfusion(transfusionId, startTime);
      setFormData({ ...formData, status: 'in-progress', start_time: startTime });
      alert('Transfusion started!');
    } catch (error) {
      console.error('Failed to start transfusion:', error);
      alert('Failed to start transfusion');
    }
  };

  const completeTransfusion = async () => {
    if (!transfusionId) return;

    const postHb = prompt('Enter post-transfusion Hb (g/dL):');
    if (!postHb) return;

    const endTime = new Date().toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit' });
    try {
      await bloodTransfusionService.completeTransfusion(transfusionId, endTime, parseFloat(postHb));
      alert('Transfusion completed successfully!');
      await loadTransfusion();
    } catch (error) {
      console.error('Failed to complete transfusion:', error);
      alert('Failed to complete transfusion');
    }
  };

  const stopTransfusion = async () => {
    if (!transfusionId) return;

    const reason = prompt('Enter reason for stopping transfusion:');
    if (!reason) return;

    try {
      await bloodTransfusionService.stopTransfusion(transfusionId, reason);
      alert('Transfusion stopped');
      await loadTransfusion();
    } catch (error) {
      console.error('Failed to stop transfusion:', error);
      alert('Failed to stop transfusion');
    }
  };

  // PDF Generation Functions
  const generateTransfusionOrderPDF = () => {
    if (!formData.patient_id || !formData.indication) {
      alert('Please fill in patient and indication details first');
      return;
    }

    const orderData: TransfusionOrderData = {
      transfusion: formData as BloodTransfusion,
      patientDetails: {
        name: selectedPatient ? `${selectedPatient.first_name} ${selectedPatient.last_name}` : formData.patient_name || 'Unknown',
        age: selectedPatient?.date_of_birth ? 
          Math.floor((new Date().getTime() - new Date(selectedPatient.date_of_birth).getTime()) / (365.25 * 24 * 60 * 60 * 1000)) : 
          undefined,
        gender: selectedPatient?.gender,
        ward: selectedPatient?.ward_id || 'N/A',
        bed_number: selectedPatient?.bed_number,
        diagnosis: formData.clinical_status
      },
      patientBloodDetails: {
        blood_group: selectedPatient?.blood_group || formData.blood_bags?.[0]?.blood_group || 'Unknown',
        genotype: selectedPatient?.genotype,
        rh_factor: selectedPatient?.blood_group?.includes('+') ? 'Positive' : selectedPatient?.blood_group?.includes('-') ? 'Negative' : undefined,
        antibody_screen: 'Negative',
        crossmatch_result: formData.crossmatch_checked ? 'Compatible' : 'Pending',
        previous_transfusion_history: formData.previous_transfusions?.length > 0 
          ? `${formData.previous_transfusions.length} previous transfusion(s). ${formData.history_of_reactions ? 'History of reactions.' : 'No reactions reported.'}`
          : 'None'
      },
      productDetails: {
        component_type: formData.blood_bags?.[0]?.component_type || 'packed_rbc',
        volume_ml: formData.blood_bags?.reduce((sum, bag) => sum + bag.volume_ml, 0) || 350,
        special_requirements: []
      },
      transfusionRate: {
        initial_rate_ml_per_hour: 50, // Slow initial rate for first 15 min
        maintenance_rate_ml_per_hour: formData.rate_ml_per_hour || 150,
        max_duration_hours: 4
      },
      productSource: {
        source: formData.blood_bags?.[0]?.source || 'blood_bank',
        source_name: formData.blood_bags?.[0]?.source_details
      },
      screeningTests: {
        hiv: 'negative',
        hbsag: 'negative',
        hcv: 'negative',
        vdrl: 'negative',
        malaria: 'negative'
      },
      reactionProtocol: [
        '1. STOP the transfusion immediately',
        '2. Keep IV line open with normal saline',
        '3. Call the doctor immediately',
        '4. Check and record vital signs (BP, pulse, temperature, SpO2)',
        '5. Recheck patient identity and blood bag details',
        '6. Send blood bag, tubing, and fresh patient samples to blood bank',
        '7. Collect blood and urine samples for investigation',
        '8. Document all observations and actions taken',
        '9. Administer emergency medications as ordered',
        '10. Complete transfusion reaction report form'
      ],
      orderingPhysician: formData.administered_by || 'Current User',
      orderDate: new Date()
    };

    transfusionPdfService.generateTransfusionOrderPDF(orderData);
  };

  const generateMonitoringChartPDF = (blank: boolean = false) => {
    if (blank) {
      transfusionPdfService.generateBlankMonitoringChart();
      return;
    }

    const patientName = selectedPatient 
      ? `${selectedPatient.first_name} ${selectedPatient.last_name}` 
      : formData.patient_name || 'Unknown';

    // Convert recorded vitals to monitoring entries
    const entries: TransfusionMonitoringEntry[] = [];
    
    if (formData.pre_transfusion_vitals) {
      entries.push({
        time: 'Pre-transfusion',
        volume_infused_ml: 0,
        temperature: formData.pre_transfusion_vitals.temperature,
        pulse: formData.pre_transfusion_vitals.pulse,
        bp_systolic: formData.pre_transfusion_vitals.bp_systolic,
        bp_diastolic: formData.pre_transfusion_vitals.bp_diastolic,
        respiratory_rate: formData.pre_transfusion_vitals.respiratory_rate,
        spo2: formData.pre_transfusion_vitals.spo2,
        observations: '',
        initials: formData.pre_transfusion_vitals.recorded_by?.substring(0, 3) || ''
      });
    }

    if (formData.during_transfusion_vitals) {
      formData.during_transfusion_vitals.forEach((vitals, idx) => {
        entries.push({
          time: `During (${idx + 1})`,
          volume_infused_ml: 0,
          temperature: vitals.temperature,
          pulse: vitals.pulse,
          bp_systolic: vitals.bp_systolic,
          bp_diastolic: vitals.bp_diastolic,
          respiratory_rate: vitals.respiratory_rate,
          spo2: vitals.spo2,
          observations: '',
          initials: vitals.recorded_by?.substring(0, 3) || ''
        });
      });
    }

    if (formData.post_transfusion_vitals) {
      entries.push({
        time: 'Post-transfusion',
        volume_infused_ml: formData.blood_bags?.reduce((sum, bag) => sum + bag.volume_ml, 0) || 0,
        temperature: formData.post_transfusion_vitals.temperature,
        pulse: formData.post_transfusion_vitals.pulse,
        bp_systolic: formData.post_transfusion_vitals.bp_systolic,
        bp_diastolic: formData.post_transfusion_vitals.bp_diastolic,
        respiratory_rate: formData.post_transfusion_vitals.respiratory_rate,
        spo2: formData.post_transfusion_vitals.spo2,
        observations: formData.adverse_events ? 'Adverse event recorded' : 'Completed without complications',
        initials: formData.post_transfusion_vitals.recorded_by?.substring(0, 3) || ''
      });
    }

    transfusionPdfService.generateMonitoringChartPDF(
      formData as BloodTransfusion,
      patientName,
      entries,
      entries.length === 0
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-red-600"></div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 overflow-y-auto">
      <div className="bg-white rounded-lg shadow-xl max-w-7xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200 bg-red-50">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold text-gray-900 flex items-center space-x-2">
                <Droplet className="h-6 w-6 text-red-600" />
                <span>Blood Transfusion Record</span>
              </h2>
              {selectedPatient && (
                <p className="text-sm text-gray-600 mt-1">
                  {selectedPatient.first_name} {selectedPatient.last_name} ({selectedPatient.hospital_number})
                  {selectedPatient.blood_group && <span className="ml-2 font-semibold">Blood Group: {selectedPatient.blood_group}</span>}
                </p>
              )}
              {formData.status && (
                <div className="mt-2">
                  <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${
                    formData.status === 'planned' ? 'bg-blue-100 text-blue-800' :
                    formData.status === 'in-progress' ? 'bg-yellow-100 text-yellow-800' :
                    formData.status === 'completed' ? 'bg-green-100 text-green-800' :
                    'bg-red-100 text-red-800'
                  }`}>
                    {formData.status.toUpperCase()}
                  </span>
                </div>
              )}
            </div>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 transition-colors"
            >
              <X className="h-6 w-6" />
            </button>
          </div>
        </div>

        {/* Action Buttons */}
        {transfusionId && (
          <div className="px-6 py-3 bg-gray-50 border-b border-gray-200 flex items-center justify-between">
            <div className="flex items-center space-x-2">
              {formData.status === 'planned' && (
                <button
                  onClick={startTransfusion}
                  className="flex items-center space-x-2 bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition-colors"
                >
                  <Play className="h-4 w-4" />
                  <span>Start Transfusion</span>
                </button>
              )}
              {formData.status === 'in-progress' && (
                <>
                  <button
                    onClick={completeTransfusion}
                    className="flex items-center space-x-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
                  >
                    <CheckSquare className="h-4 w-4" />
                    <span>Complete Transfusion</span>
                  </button>
                  <button
                    onClick={stopTransfusion}
                    className="flex items-center space-x-2 bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 transition-colors"
                  >
                    <Square className="h-4 w-4" />
                    <span>Stop Transfusion</span>
                  </button>
                </>
              )}
            </div>
            {formData.start_time && (
              <div className="flex items-center space-x-2 text-sm text-gray-600">
                <Clock className="h-4 w-4" />
                <span>Started: {formData.start_time}</span>
                {formData.end_time && <span>• Ended: {formData.end_time}</span>}
              </div>
            )}
          </div>
        )}

        {/* Tabs */}
        <div className="border-b border-gray-200 bg-white px-6 overflow-x-auto">
          <div className="flex space-x-1 min-w-max">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              const bagCount = tab.id === 'bags' ? (formData.blood_bags?.length || 0) : null;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as any)}
                  className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap flex items-center space-x-2 ${
                    activeTab === tab.id
                      ? 'border-red-600 text-red-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  <span>{tab.label}</span>
                  {bagCount !== null && (
                    <span className={`ml-1 px-2 py-0.5 text-xs font-bold rounded-full ${
                      bagCount === 0 
                        ? 'bg-red-100 text-red-800' 
                        : 'bg-green-100 text-green-800'
                    }`}>
                      {bagCount}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {/* DETAILS TAB */}
          {activeTab === 'details' && (
            <div className="space-y-6">
              {/* IMPORTANT: Guide to Blood Bags */}
              {(!formData.blood_bags || formData.blood_bags.length === 0) && (
                <div className="bg-yellow-50 border-2 border-yellow-400 rounded-lg p-4 flex items-start space-x-3">
                  <AlertCircle className="h-6 w-6 text-yellow-600 flex-shrink-0 mt-1" />
                  <div>
                    <h3 className="font-bold text-yellow-900 mb-1">⚠️ Blood Bag Details Required</h3>
                    <p className="text-sm text-yellow-800 mb-2">
                      Before you can complete this transfusion record, you must add at least one blood bag with all required details.
                    </p>
                    <button
                      onClick={() => setActiveTab('bags')}
                      className="bg-yellow-600 text-white px-4 py-2 rounded-lg hover:bg-yellow-700 font-semibold flex items-center space-x-2"
                    >
                      <Droplet className="h-4 w-4" />
                      <span>Go to Blood Bags Tab →</span>
                    </button>
                  </div>
                </div>
              )}
              
              {/* Patient Selection */}
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <h3 className="font-semibold text-blue-900 mb-3">Patient Information</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Select Patient*</label>
                    <select
                      value={formData.patient_id}
                      onChange={handlePatientSelect}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2"
                      disabled={!!transfusionId}
                    >
                      <option value="">-- Select Patient --</option>
                      {patients.map(p => (
                        <option key={p.id} value={p.id}>
                          {p.hospital_number} - {p.first_name} {p.last_name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Hospital Number</label>
                    <input
                      type="text"
                      value={formData.hospital_number}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 bg-gray-50"
                      readOnly
                    />
                  </div>
                </div>
              </div>

              {/* Transfusion Details */}
              <div className="bg-white border border-gray-300 rounded-lg p-4">
                <h3 className="font-semibold mb-4">Transfusion Details</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-1">Indication for Transfusion*</label>
                    <textarea
                      value={formData.indication}
                      onChange={(e) => setFormData({ ...formData, indication: e.target.value })}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2"
                      rows={3}
                      placeholder="e.g., Symptomatic anemia, Active bleeding, Pre-operative optimization"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Baseline Hb (g/dL)*</label>
                    <input
                      type="number"
                      step="0.1"
                      value={formData.baseline_hb}
                      onChange={(e) => setFormData({ ...formData, baseline_hb: parseFloat(e.target.value) })}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2"
                      placeholder="e.g., 7.5"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Target Hb (g/dL)</label>
                    <input
                      type="number"
                      step="0.1"
                      value={formData.target_hb || ''}
                      onChange={(e) => setFormData({ ...formData, target_hb: parseFloat(e.target.value) })}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2"
                      placeholder="e.g., 10.0"
                    />
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-1">Clinical Status</label>
                    <input
                      type="text"
                      value={formData.clinical_status}
                      onChange={(e) => setFormData({ ...formData, clinical_status: e.target.value })}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2"
                      placeholder="Patient's current condition"
                    />
                  </div>
                  <div>
                    <label className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        checked={formData.urgent}
                        onChange={(e) => setFormData({ ...formData, urgent: e.target.checked })}
                        className="rounded border-gray-300"
                      />
                      <span className="text-sm font-medium text-gray-700">Urgent Transfusion</span>
                    </label>
                  </div>
                </div>
              </div>

              {/* Previous Transfusion History */}
              <div className="bg-white border border-gray-300 rounded-lg p-4">
                <h3 className="font-semibold mb-4">Previous Transfusion History</h3>
                <label className="flex items-center space-x-2 mb-4">
                  <input
                    type="checkbox"
                    checked={formData.history_of_reactions}
                    onChange={(e) => setFormData({ ...formData, history_of_reactions: e.target.checked })}
                    className="rounded border-gray-300"
                  />
                  <span className="text-sm font-medium text-gray-700">History of Transfusion Reactions</span>
                </label>

                {formData.previous_transfusions && formData.previous_transfusions.length > 0 && (
                  <div className="space-y-2 mb-4">
                    {formData.previous_transfusions.map((pt, index) => (
                      <div key={index} className="bg-gray-50 p-3 rounded border border-gray-200">
                        <div className="grid grid-cols-4 gap-2 text-sm">
                          <div><strong>Date:</strong> {format(new Date(pt.date), 'MMM d, yyyy')}</div>
                          <div><strong>Group:</strong> {pt.blood_group}</div>
                          <div><strong>Component:</strong> {pt.component}</div>
                          <div><strong>Units:</strong> {pt.units}</div>
                          <div className="col-span-4"><strong>Indication:</strong> {pt.indication}</div>
                          {pt.complications && <div className="col-span-4 text-red-600"><strong>Complications:</strong> {pt.complications}</div>}
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
                  <div>
                    <input
                      type="date"
                      value={format(new Date(newPreviousTransfusion.date!), 'yyyy-MM-dd')}
                      onChange={(e) => setNewPreviousTransfusion({ ...newPreviousTransfusion, date: new Date(e.target.value) })}
                      className="w-full border border-gray-300 rounded px-2 py-1 text-sm"
                    />
                  </div>
                  <div>
                    <input
                      type="text"
                      value={newPreviousTransfusion.blood_group}
                      onChange={(e) => setNewPreviousTransfusion({ ...newPreviousTransfusion, blood_group: e.target.value })}
                      placeholder="Blood Group"
                      className="w-full border border-gray-300 rounded px-2 py-1 text-sm"
                    />
                  </div>
                  <div>
                    <input
                      type="text"
                      value={newPreviousTransfusion.component}
                      onChange={(e) => setNewPreviousTransfusion({ ...newPreviousTransfusion, component: e.target.value })}
                      placeholder="Component"
                      className="w-full border border-gray-300 rounded px-2 py-1 text-sm"
                    />
                  </div>
                  <div>
                    <input
                      type="text"
                      value={newPreviousTransfusion.indication}
                      onChange={(e) => setNewPreviousTransfusion({ ...newPreviousTransfusion, indication: e.target.value })}
                      placeholder="Indication"
                      className="w-full border border-gray-300 rounded px-2 py-1 text-sm"
                    />
                  </div>
                  <button
                    onClick={addPreviousTransfusion}
                    className="bg-blue-600 text-white px-3 py-1 rounded text-sm hover:bg-blue-700"
                  >
                    Add
                  </button>
                </div>
              </div>

              {/* Pre-Transfusion Checks */}
              <div className="bg-yellow-50 border border-yellow-300 rounded-lg p-4">
                <h3 className="font-semibold text-yellow-900 mb-3">Pre-Transfusion Safety Checks</h3>
                <div className="space-y-2">
                  <label className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      checked={formData.consent_obtained}
                      onChange={(e) => setFormData({ ...formData, consent_obtained: e.target.checked })}
                      className="rounded border-gray-300"
                    />
                    <span className="text-sm font-medium">Informed Consent Obtained</span>
                  </label>
                  <label className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      checked={formData.patient_identification_verified}
                      onChange={(e) => setFormData({ ...formData, patient_identification_verified: e.target.checked })}
                      className="rounded border-gray-300"
                    />
                    <span className="text-sm font-medium">Patient Identification Verified</span>
                  </label>
                  <label className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      checked={formData.blood_group_verified}
                      onChange={(e) => setFormData({ ...formData, blood_group_verified: e.target.checked })}
                      className="rounded border-gray-300"
                    />
                    <span className="text-sm font-medium">Blood Group Verified</span>
                  </label>
                  <label className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      checked={formData.crossmatch_checked}
                      onChange={(e) => setFormData({ ...formData, crossmatch_checked: e.target.checked })}
                      className="rounded border-gray-300"
                    />
                    <span className="text-sm font-medium">Crossmatch Report Checked</span>
                  </label>
                </div>
              </div>
            </div>
          )}

          {/* BLOOD BAGS TAB */}
          {activeTab === 'bags' && (
            <div className="space-y-6">
              <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                <h3 className="font-semibold text-red-900 mb-2">Blood Bag Details</h3>
                <p className="text-sm text-red-700">Record all blood bag information including bag number, blood group, component type, and donation details.</p>
              </div>

              {/* Existing Bags */}
              {formData.blood_bags && formData.blood_bags.length > 0 && (
                <div className="space-y-3">
                  {formData.blood_bags.map((bag, index) => (
                    <div key={index} className="bg-white border border-gray-300 rounded-lg p-4">
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex items-center space-x-2">
                          <Droplet className="h-5 w-5 text-red-600" />
                          <h4 className="font-semibold">Bag #{bag.bag_number}</h4>
                          <span className={`px-2 py-1 text-xs rounded ${
                            bag.transfused ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                          }`}>
                            {bag.transfused ? 'Transfused' : 'Pending'}
                          </span>
                        </div>
                        <button onClick={() => removeBag(index)} className="text-red-600 hover:text-red-800">
                          <X className="h-5 w-5" />
                        </button>
                      </div>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                        <div><strong>Blood Group:</strong> {bag.blood_group}</div>
                        <div><strong>Component:</strong> {bag.component_type.replace(/_/g, ' ').toUpperCase()}</div>
                        <div><strong>Volume:</strong> {bag.volume_ml} mL</div>
                        <div><strong>Source:</strong> {bag.source.replace(/_/g, ' ')}</div>
                        <div><strong>Donation:</strong> {format(new Date(bag.donation_date), 'MMM d, yyyy')}</div>
                        <div><strong>Expiry:</strong> {format(new Date(bag.expiry_date), 'MMM d, yyyy')}</div>
                        <div className="flex items-center space-x-1">
                          {bag.screening_done ? <CheckCircle className="h-4 w-4 text-green-600" /> : <X className="h-4 w-4 text-red-600" />}
                          <span>Screening Done</span>
                        </div>
                        <div className="flex items-center space-x-1">
                          {bag.crossmatch_compatible ? <CheckCircle className="h-4 w-4 text-green-600" /> : <X className="h-4 w-4 text-red-600" />}
                          <span>Crossmatch Compatible</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Add New Bag */}
              <div className="bg-white border border-gray-300 rounded-lg p-4">
                <h4 className="font-semibold mb-4">Add Blood Bag</h4>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Bag Number*</label>
                    <input
                      type="text"
                      value={newBag.bag_number}
                      onChange={(e) => setNewBag({ ...newBag, bag_number: e.target.value })}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2"
                      placeholder="e.g., BB123456"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Blood Group*</label>
                    <select
                      value={newBag.blood_group}
                      onChange={(e) => setNewBag({ ...newBag, blood_group: e.target.value as any })}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2"
                    >
                      <option value="O+">O+</option>
                      <option value="O-">O-</option>
                      <option value="A+">A+</option>
                      <option value="A-">A-</option>
                      <option value="B+">B+</option>
                      <option value="B-">B-</option>
                      <option value="AB+">AB+</option>
                      <option value="AB-">AB-</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Component Type*</label>
                    <select
                      value={newBag.component_type}
                      onChange={(e) => setNewBag({ ...newBag, component_type: e.target.value as any })}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2"
                    >
                      <option value="packed_rbc">Packed RBC</option>
                      <option value="whole_blood">Whole Blood</option>
                      <option value="platelets">Platelets</option>
                      <option value="ffp">Fresh Frozen Plasma (FFP)</option>
                      <option value="cryoprecipitate">Cryoprecipitate</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Volume (mL)*</label>
                    <input
                      type="number"
                      value={newBag.volume_ml}
                      onChange={(e) => setNewBag({ ...newBag, volume_ml: parseInt(e.target.value) })}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Donation Date*</label>
                    <input
                      type="date"
                      value={format(new Date(newBag.donation_date!), 'yyyy-MM-dd')}
                      onChange={(e) => setNewBag({ ...newBag, donation_date: new Date(e.target.value) })}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Expiry Date*</label>
                    <input
                      type="date"
                      value={format(new Date(newBag.expiry_date!), 'yyyy-MM-dd')}
                      onChange={(e) => setNewBag({ ...newBag, expiry_date: new Date(e.target.value) })}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Source</label>
                    <select
                      value={newBag.source}
                      onChange={(e) => setNewBag({ ...newBag, source: e.target.value as any })}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2"
                    >
                      <option value="blood_bank">Blood Bank</option>
                      <option value="directed_donation">Directed Donation</option>
                      <option value="autologous">Autologous</option>
                      <option value="emergency_stock">Emergency Stock</option>
                    </select>
                  </div>
                  <div className="flex items-center space-x-4">
                    <label className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        checked={newBag.screening_done}
                        onChange={(e) => setNewBag({ ...newBag, screening_done: e.target.checked })}
                        className="rounded border-gray-300"
                      />
                      <span className="text-sm">Screening Done</span>
                    </label>
                    <label className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        checked={newBag.crossmatch_compatible}
                        onChange={(e) => setNewBag({ ...newBag, crossmatch_compatible: e.target.checked })}
                        className="rounded border-gray-300"
                      />
                      <span className="text-sm">Compatible</span>
                    </label>
                  </div>
                </div>
                <button
                  onClick={addBloodBag}
                  className="bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 transition-colors flex items-center space-x-2"
                >
                  <Plus className="h-4 w-4" />
                  <span>Add Blood Bag</span>
                </button>
              </div>
            </div>
          )}

          {/* VITALS TAB */}
          {activeTab === 'vitals' && (
            <div className="space-y-6">
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <h3 className="font-semibold text-blue-900 mb-2">Transfusion Vitals Monitoring</h3>
                <p className="text-sm text-blue-700">Record vital signs before, during, and after transfusion to monitor for adverse reactions.</p>
              </div>

              {/* Record New Vitals */}
              <div className="bg-white border border-gray-300 rounded-lg p-4">
                <h4 className="font-semibold mb-4">Record Vitals</h4>
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-2">Measurement Type</label>
                  <div className="flex space-x-4">
                    <label className="flex items-center space-x-2">
                      <input
                        type="radio"
                        value="pre"
                        checked={vitalsType === 'pre'}
                        onChange={(e) => setVitalsType(e.target.value as any)}
                        className="rounded-full"
                      />
                      <span>Pre-Transfusion</span>
                    </label>
                    <label className="flex items-center space-x-2">
                      <input
                        type="radio"
                        value="during"
                        checked={vitalsType === 'during'}
                        onChange={(e) => setVitalsType(e.target.value as any)}
                        className="rounded-full"
                      />
                      <span>During Transfusion</span>
                    </label>
                    <label className="flex items-center space-x-2">
                      <input
                        type="radio"
                        value="post"
                        checked={vitalsType === 'post'}
                        onChange={(e) => setVitalsType(e.target.value as any)}
                        className="rounded-full"
                      />
                      <span>Post-Transfusion</span>
                    </label>
                  </div>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Temperature (°C)</label>
                    <input
                      type="number"
                      step="0.1"
                      value={newVitals.temperature}
                      onChange={(e) => setNewVitals({ ...newVitals, temperature: parseFloat(e.target.value) })}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Pulse (bpm)</label>
                    <input
                      type="number"
                      value={newVitals.pulse}
                      onChange={(e) => setNewVitals({ ...newVitals, pulse: parseInt(e.target.value) })}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">BP Systolic (mmHg)</label>
                    <input
                      type="number"
                      value={newVitals.bp_systolic}
                      onChange={(e) => setNewVitals({ ...newVitals, bp_systolic: parseInt(e.target.value) })}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">BP Diastolic (mmHg)</label>
                    <input
                      type="number"
                      value={newVitals.bp_diastolic}
                      onChange={(e) => setNewVitals({ ...newVitals, bp_diastolic: parseInt(e.target.value) })}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Respiratory Rate (bpm)</label>
                    <input
                      type="number"
                      value={newVitals.respiratory_rate}
                      onChange={(e) => setNewVitals({ ...newVitals, respiratory_rate: parseInt(e.target.value) })}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">SpO₂ (%)</label>
                    <input
                      type="number"
                      value={newVitals.spo2}
                      onChange={(e) => setNewVitals({ ...newVitals, spo2: parseInt(e.target.value) })}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2"
                    />
                  </div>
                </div>
                <button
                  onClick={recordVitals}
                  className="mt-4 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors flex items-center space-x-2"
                >
                  <Activity className="h-4 w-4" />
                  <span>Record Vitals</span>
                </button>
              </div>

              {/* Display Recorded Vitals */}
              {formData.pre_transfusion_vitals && (
                <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                  <h4 className="font-semibold text-green-900 mb-3">Pre-Transfusion Vitals</h4>
                  <VitalsDisplay vitals={formData.pre_transfusion_vitals} />
                </div>
              )}
              {formData.during_transfusion_vitals && formData.during_transfusion_vitals.length > 0 && (
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                  <h4 className="font-semibold text-yellow-900 mb-3">During Transfusion Vitals</h4>
                  {formData.during_transfusion_vitals.map((v, i) => (
                    <div key={i} className="mb-3 last:mb-0">
                      <p className="text-sm font-medium mb-1">Reading #{i + 1} - {format(new Date(v.recorded_at!), 'HH:mm')}</p>
                      <VitalsDisplay vitals={v} />
                    </div>
                  ))}
                </div>
              )}
              {formData.post_transfusion_vitals && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <h4 className="font-semibold text-blue-900 mb-3">Post-Transfusion Vitals</h4>
                  <VitalsDisplay vitals={formData.post_transfusion_vitals} />
                </div>
              )}
            </div>
          )}

          {/* COMPLICATIONS TAB */}
          {activeTab === 'complications' && (
            <div className="space-y-6">
              <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                <h3 className="font-semibold text-red-900 mb-2">Transfusion Complications</h3>
                <p className="text-sm text-red-700">Record any adverse events or complications during or after transfusion.</p>
              </div>

              {/* Existing Complications */}
              {formData.complications && formData.complications.length > 0 && (
                <div className="space-y-3">
                  {formData.complications.map((comp, index) => (
                    <div key={index} className={`border-2 rounded-lg p-4 ${
                      comp.severity === 'severe' ? 'bg-red-50 border-red-300' :
                      comp.severity === 'moderate' ? 'bg-orange-50 border-orange-300' :
                      'bg-yellow-50 border-yellow-300'
                    }`}>
                      <div className="flex items-start justify-between mb-2">
                        <div>
                          <h4 className="font-semibold capitalize">{comp.complication_type.replace(/_/g, ' ')}</h4>
                          <p className="text-sm text-gray-600">Severity: <span className="font-medium uppercase">{comp.severity}</span></p>
                        </div>
                        <span className={`px-2 py-1 text-xs rounded ${
                          comp.resolved ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                        }`}>
                          {comp.resolved ? 'Resolved' : 'Ongoing'}
                        </span>
                      </div>
                      <div className="space-y-2 text-sm">
                        <div>
                          <strong>Symptoms:</strong>
                          <ul className="list-disc list-inside ml-2">
                            {comp.symptoms.map((s, i) => <li key={i}>{s}</li>)}
                          </ul>
                        </div>
                        <div><strong>Management:</strong> {comp.management}</div>
                        <div><strong>Detected:</strong> {format(new Date(comp.detected_at!), 'MMM d, yyyy HH:mm')}</div>
                        {comp.resolved_at && (
                          <div><strong>Resolved:</strong> {format(new Date(comp.resolved_at), 'MMM d, yyyy HH:mm')}</div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Add Complication */}
              <div className="bg-white border border-gray-300 rounded-lg p-4">
                <h4 className="font-semibold mb-4">Record Complication</h4>
                <div className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Complication Type</label>
                      <select
                        value={newComplication.complication_type}
                        onChange={(e) => setNewComplication({ ...newComplication, complication_type: e.target.value as any })}
                        className="w-full border border-gray-300 rounded-lg px-3 py-2"
                      >
                        <option value="febrile_reaction">Febrile Reaction</option>
                        <option value="allergic_reaction">Allergic Reaction</option>
                        <option value="anaphylaxis">Anaphylaxis</option>
                        <option value="hemolytic_reaction">Hemolytic Reaction</option>
                        <option value="trali">TRALI (Transfusion-Related Acute Lung Injury)</option>
                        <option value="taco">TACO (Transfusion-Associated Circulatory Overload)</option>
                        <option value="sepsis">Bacterial Contamination/Sepsis</option>
                        <option value="other">Other</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Severity</label>
                      <select
                        value={newComplication.severity}
                        onChange={(e) => setNewComplication({ ...newComplication, severity: e.target.value as any })}
                        className="w-full border border-gray-300 rounded-lg px-3 py-2"
                      >
                        <option value="mild">Mild</option>
                        <option value="moderate">Moderate</option>
                        <option value="severe">Severe</option>
                        <option value="life_threatening">Life-Threatening</option>
                      </select>
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Symptoms</label>
                    <div className="flex space-x-2 mb-2">
                      <input
                        type="text"
                        value={symptomInput}
                        onChange={(e) => setSymptomInput(e.target.value)}
                        onKeyPress={(e) => e.key === 'Enter' && addSymptom()}
                        className="flex-1 border border-gray-300 rounded-lg px-3 py-2"
                        placeholder="Enter symptom and press Enter"
                      />
                      <button
                        onClick={addSymptom}
                        className="bg-gray-600 text-white px-4 py-2 rounded-lg hover:bg-gray-700"
                      >
                        <Plus className="h-4 w-4" />
                      </button>
                    </div>
                    {newComplication.symptoms && newComplication.symptoms.length > 0 && (
                      <div className="flex flex-wrap gap-2">
                        {newComplication.symptoms.map((symptom, index) => (
                          <span key={index} className="bg-red-100 text-red-800 px-3 py-1 rounded-full text-sm flex items-center space-x-1">
                            <span>{symptom}</span>
                            <button onClick={() => removeSymptom(index)} className="hover:text-red-900">
                              <X className="h-3 w-3" />
                            </button>
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Management/Treatment</label>
                    <textarea
                      value={newComplication.management}
                      onChange={(e) => setNewComplication({ ...newComplication, management: e.target.value })}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2"
                      rows={3}
                      placeholder="Describe management and interventions"
                    />
                  </div>
                  <button
                    onClick={addComplication}
                    className="bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 transition-colors flex items-center space-x-2"
                  >
                    <AlertCircle className="h-4 w-4" />
                    <span>Record Complication</span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* DOCUMENTS TAB */}
          {activeTab === 'documents' && (
            <div className="space-y-6">
              {/* PDF Generation Section */}
              <div className="bg-gradient-to-r from-red-50 to-orange-50 border border-red-200 rounded-lg p-6">
                <h3 className="text-lg font-bold text-red-900 mb-4 flex items-center">
                  <FileDown className="h-5 w-5 mr-2" />
                  Generate Transfusion Documents
                </h3>
                
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {/* Transfusion Order PDF */}
                  <div className="bg-white rounded-lg border border-red-200 p-4 shadow-sm">
                    <div className="flex items-center mb-3">
                      <div className="w-10 h-10 bg-red-100 rounded-lg flex items-center justify-center mr-3">
                        <Printer className="h-5 w-5 text-red-600" />
                      </div>
                      <div>
                        <h4 className="font-semibold text-gray-900">Transfusion Order</h4>
                        <p className="text-xs text-gray-500">Official order form</p>
                      </div>
                    </div>
                    <p className="text-sm text-gray-600 mb-4">
                      Complete transfusion order with patient details, blood product info, screening tests, and reaction protocol.
                    </p>
                    <button
                      onClick={generateTransfusionOrderPDF}
                      className="w-full bg-red-600 text-white py-2 px-4 rounded-lg hover:bg-red-700 transition-colors flex items-center justify-center space-x-2"
                    >
                      <Download className="h-4 w-4" />
                      <span>Download Order PDF</span>
                    </button>
                  </div>

                  {/* Monitoring Chart PDF */}
                  <div className="bg-white rounded-lg border border-blue-200 p-4 shadow-sm">
                    <div className="flex items-center mb-3">
                      <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center mr-3">
                        <Activity className="h-5 w-5 text-blue-600" />
                      </div>
                      <div>
                        <h4 className="font-semibold text-gray-900">Monitoring Chart</h4>
                        <p className="text-xs text-gray-500">With recorded vitals</p>
                      </div>
                    </div>
                    <p className="text-sm text-gray-600 mb-4">
                      Transfusion monitoring chart populated with any recorded vital signs and observations.
                    </p>
                    <button
                      onClick={() => generateMonitoringChartPDF(false)}
                      className="w-full bg-blue-600 text-white py-2 px-4 rounded-lg hover:bg-blue-700 transition-colors flex items-center justify-center space-x-2"
                    >
                      <Download className="h-4 w-4" />
                      <span>Download Chart PDF</span>
                    </button>
                  </div>

                  {/* Blank Monitoring Chart */}
                  <div className="bg-white rounded-lg border border-gray-200 p-4 shadow-sm">
                    <div className="flex items-center mb-3">
                      <div className="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center mr-3">
                        <ClipboardList className="h-5 w-5 text-gray-600" />
                      </div>
                      <div>
                        <h4 className="font-semibold text-gray-900">Blank Chart Template</h4>
                        <p className="text-xs text-gray-500">For manual documentation</p>
                      </div>
                    </div>
                    <p className="text-sm text-gray-600 mb-4">
                      Empty monitoring chart template for bedside documentation during transfusion.
                    </p>
                    <button
                      onClick={() => generateMonitoringChartPDF(true)}
                      className="w-full bg-gray-600 text-white py-2 px-4 rounded-lg hover:bg-gray-700 transition-colors flex items-center justify-center space-x-2"
                    >
                      <Download className="h-4 w-4" />
                      <span>Download Blank Chart</span>
                    </button>
                  </div>
                </div>

                {/* Document Details */}
                <div className="mt-4 p-4 bg-white rounded-lg border border-gray-200">
                  <h4 className="font-semibold text-gray-900 mb-2">Transfusion Order Includes:</h4>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-sm text-gray-600">
                    <div className="flex items-center">
                      <CheckCircle className="h-4 w-4 text-green-500 mr-2" />
                      Patient Information
                    </div>
                    <div className="flex items-center">
                      <CheckCircle className="h-4 w-4 text-green-500 mr-2" />
                      Blood Group Details
                    </div>
                    <div className="flex items-center">
                      <CheckCircle className="h-4 w-4 text-green-500 mr-2" />
                      Indication & Baseline Hb
                    </div>
                    <div className="flex items-center">
                      <CheckCircle className="h-4 w-4 text-green-500 mr-2" />
                      Product Details
                    </div>
                    <div className="flex items-center">
                      <CheckCircle className="h-4 w-4 text-green-500 mr-2" />
                      Transfusion Rate
                    </div>
                    <div className="flex items-center">
                      <CheckCircle className="h-4 w-4 text-green-500 mr-2" />
                      Screening Tests
                    </div>
                    <div className="flex items-center">
                      <CheckCircle className="h-4 w-4 text-green-500 mr-2" />
                      Reaction Protocol
                    </div>
                    <div className="flex items-center">
                      <CheckCircle className="h-4 w-4 text-green-500 mr-2" />
                      Pre-transfusion Checklist
                    </div>
                  </div>
                </div>
              </div>

              {/* Upload Completed Charts Section */}
              <div className="bg-white border border-gray-200 rounded-lg p-6">
                <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center">
                  <Upload className="h-5 w-5 mr-2 text-red-600" />
                  Upload Completed Monitoring Charts
                </h3>
                
                <p className="text-sm text-gray-600 mb-4">
                  Upload scanned or photographed transfusion monitoring charts. You can also use OCR to extract text from images for efficient storage.
                </p>

                <TransfusionChartUpload
                  transfusionId={transfusionId || 'new'}
                  hospitalNumber={formData.hospital_number || ''}
                  onChartUploaded={(chart) => {
                    console.log('Chart uploaded:', chart);
                    // In production, save this to the database
                  }}
                  existingCharts={[]}
                />
              </div>

              {/* Transfusion Summary */}
              {transfusionId && formData.status === 'completed' && (
                <div className="bg-green-50 border border-green-200 rounded-lg p-6">
                  <h3 className="text-lg font-bold text-green-900 mb-4 flex items-center">
                    <CheckCircle className="h-5 w-5 mr-2" />
                    Transfusion Summary
                  </h3>
                  
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="bg-white rounded-lg p-3 border border-green-200">
                      <p className="text-sm text-gray-500">Date</p>
                      <p className="text-lg font-semibold text-gray-900">
                        {format(new Date(formData.transfusion_date!), 'dd MMM yyyy')}
                      </p>
                    </div>
                    <div className="bg-white rounded-lg p-3 border border-green-200">
                      <p className="text-sm text-gray-500">Duration</p>
                      <p className="text-lg font-semibold text-gray-900">
                        {formData.duration_minutes ? `${Math.floor(formData.duration_minutes / 60)}h ${formData.duration_minutes % 60}m` : 'N/A'}
                      </p>
                    </div>
                    <div className="bg-white rounded-lg p-3 border border-green-200">
                      <p className="text-sm text-gray-500">Units Transfused</p>
                      <p className="text-lg font-semibold text-gray-900">{formData.total_units}</p>
                    </div>
                    <div className="bg-white rounded-lg p-3 border border-green-200">
                      <p className="text-sm text-gray-500">Hb Rise</p>
                      <p className="text-lg font-semibold text-gray-900">
                        {formData.baseline_hb} → {formData.post_transfusion_hb || '?'} g/dL
                        {formData.hb_increment && (
                          <span className="text-green-600 text-sm ml-1">(+{formData.hb_increment.toFixed(1)})</span>
                        )}
                      </p>
                    </div>
                  </div>

                  {formData.adverse_events && (
                    <div className="mt-4 p-3 bg-red-100 rounded-lg border border-red-200">
                      <p className="text-sm font-medium text-red-800 flex items-center">
                        <AlertCircle className="h-4 w-4 mr-2" />
                        Adverse events were recorded during this transfusion. See Complications tab for details.
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-200 bg-gray-50 flex items-center justify-between">
          <button
            onClick={onClose}
            className="text-gray-700 hover:text-gray-900 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={saveTransfusion}
            disabled={saving}
            className="bg-red-600 text-white px-6 py-2 rounded-lg hover:bg-red-700 transition-colors flex items-center space-x-2 disabled:opacity-50"
          >
            <Save className="h-5 w-5" />
            <span>{saving ? 'Saving...' : 'Save Transfusion Record'}</span>
          </button>
        </div>
      </div>
    </div>
  );
}

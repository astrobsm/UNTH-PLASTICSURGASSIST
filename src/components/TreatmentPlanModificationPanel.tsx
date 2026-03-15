import React, { useState, useEffect } from 'react';
import { 
  Plus, Trash2, Check, X, Clock, AlertTriangle, 
  Pill, TestTube, Activity, Calendar, FileText, 
  CheckCircle, XCircle, Edit, Send
} from 'lucide-react';
import { useAuthStore } from '../store/authStore';
import { 
  treatmentPlanningService, 
  TreatmentPlanModification,
  EnhancedTreatmentPlan 
} from '../services/treatmentPlanningService';
import { format } from 'date-fns';

interface TreatmentPlanModificationPanelProps {
  planId: string;
  patientId: string;
  patientName: string;
  source: 'ward_round' | 'mdt_review' | 'direct_edit';
  wardRoundId?: string;
  mdtSessionId?: string;
  specialty?: string;
  onClose?: () => void;
  onModificationSubmitted?: () => void;
}

export const TreatmentPlanModificationPanel: React.FC<TreatmentPlanModificationPanelProps> = ({
  planId,
  patientId,
  patientName,
  source,
  wardRoundId,
  mdtSessionId,
  specialty,
  onClose,
  onModificationSubmitted
}) => {
  const { user } = useAuthStore();
  const [plan, setPlan] = useState<EnhancedTreatmentPlan | null>(null);
  const [activeTab, setActiveTab] = useState<'medications' | 'investigations' | 'procedures' | 'general'>('medications');
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // Modification form states
  const [modType, setModType] = useState<'add' | 'update' | 'remove'>('add');
  const [priority, setPriority] = useState<'routine' | 'urgent' | 'emergency'>('routine');
  const [reason, setReason] = useState('');
  
  // Medication modification
  const [newMed, setNewMed] = useState({
    medication_name: '',
    dosage: '',
    route: 'oral',
    frequency: '',
    duration: '',
    notes: ''
  });
  const [selectedMedId, setSelectedMedId] = useState('');
  
  // Investigation modification
  const [newInv, setNewInv] = useState({
    investigation_name: '',
    investigation_type: 'lab' as 'lab' | 'imaging' | 'other',
    frequency: 'once' as 'once' | 'daily' | 'alternate_days' | 'twice_weekly' | 'weekly' | 'biweekly' | 'as_needed',
    target_value: '',
    notes: ''
  });
  const [selectedInvId, setSelectedInvId] = useState('');
  
  // Procedure modification
  const [newProc, setNewProc] = useState({
    procedure_name: '',
    procedure_type: 'minor' as 'minor' | 'major' | 'diagnostic' | 'therapeutic',
    proposed_date: format(new Date(), 'yyyy-MM-dd'),
    notes: ''
  });
  const [selectedProcId, setSelectedProcId] = useState('');
  
  // General modification
  const [generalChanges, setGeneralChanges] = useState({
    diagnosis: '',
    notes: ''
  });

  const canDirectlyModify = user?.role === 'consultant' || user?.role === 'admin';
  const userRole = user?.role as 'senior_registrar' | 'junior_registrar' | 'house_officer';

  useEffect(() => {
    loadPlan();
  }, [planId]);

  const loadPlan = async () => {
    try {
      const loadedPlan = await treatmentPlanningService.getTreatmentPlan(planId);
      setPlan(loadedPlan);
      if (loadedPlan) {
        setGeneralChanges({
          diagnosis: loadedPlan.diagnosis || '',
          notes: loadedPlan.notes || ''
        });
      }
    } catch (error) {
      console.error('Error loading treatment plan:', error);
    }
  };

  const handleSubmitModification = async () => {
    if (!reason.trim()) {
      alert('Please provide a reason for this modification');
      return;
    }

    setIsSubmitting(true);

    try {
      let modificationType: TreatmentPlanModification['modification_type'] = 'general';
      let modificationAction: TreatmentPlanModification['modification_action'] = modType;
      let proposedValue: any = null;
      let originalValue: any = null;

      switch (activeTab) {
        case 'medications':
          modificationType = 'medication';
          if (modType === 'add') {
            proposedValue = { ...newMed, start_date: new Date() };
          } else if (modType === 'update' || modType === 'remove') {
            originalValue = plan?.planned_medications?.find(m => m.id === selectedMedId);
            proposedValue = modType === 'update' ? { ...newMed } : null;
          }
          break;

        case 'investigations':
          modificationType = 'investigation';
          if (modType === 'add') {
            proposedValue = { ...newInv, ordered_date: new Date() };
          } else if (modType === 'update' || modType === 'remove') {
            originalValue = plan?.planned_investigations?.find(i => i.id === selectedInvId);
            proposedValue = modType === 'update' ? { ...newInv } : null;
          }
          break;

        case 'procedures':
          modificationType = 'procedure';
          if (modType === 'add') {
            proposedValue = { ...newProc, proposed_date: new Date(newProc.proposed_date) };
          } else if (modType === 'update' || modType === 'remove') {
            originalValue = plan?.planned_procedures?.find(p => p.id === selectedProcId);
            proposedValue = modType === 'update' ? { ...newProc } : null;
          }
          break;

        case 'general':
          modificationType = 'general';
          modificationAction = 'update';
          proposedValue = generalChanges;
          originalValue = { diagnosis: plan?.diagnosis, notes: plan?.notes };
          break;
      }

      if (canDirectlyModify) {
        // Consultants can modify directly
        await treatmentPlanningService.directModification(
          planId,
          modificationType,
          modificationAction,
          proposedValue,
          reason,
          user?.name || user?.email || 'Unknown',
          user?.role || 'consultant',
          originalValue
        );
      } else {
        // Other roles need approval
        if (source === 'ward_round' && wardRoundId) {
          await treatmentPlanningService.createWardRoundModification(
            planId,
            wardRoundId,
            modificationType,
            modificationAction,
            proposedValue,
            reason,
            user?.name || user?.email || 'Unknown',
            userRole,
            priority,
            originalValue
          );
        } else if (source === 'mdt_review' && mdtSessionId) {
          await treatmentPlanningService.createMDTModification(
            planId,
            mdtSessionId,
            specialty || 'Unknown Specialty',
            modificationType,
            modificationAction,
            proposedValue,
            reason,
            user?.name || user?.email || 'Unknown',
            userRole as 'senior_registrar' | 'junior_registrar',
            priority,
            originalValue
          );
        } else {
          await treatmentPlanningService.createModificationRequest(planId, {
            plan_id: planId,
            patient_id: patientId,
            patient_name: patientName,
            requested_by: user?.name || user?.email || 'Unknown',
            requested_by_role: userRole,
            requested_at: new Date(),
            source: source,
            modification_type: modificationType,
            modification_action: modificationAction,
            original_value: originalValue,
            proposed_value: proposedValue,
            reason: reason,
            priority: priority
          });
        }
      }

      // Reset form
      setReason('');
      setNewMed({ medication_name: '', dosage: '', route: 'oral', frequency: '', duration: '', notes: '' });
      setNewInv({ investigation_name: '', investigation_type: 'lab', frequency: 'once', target_value: '', notes: '' });
      setNewProc({ procedure_name: '', procedure_type: 'minor', proposed_date: format(new Date(), 'yyyy-MM-dd'), notes: '' });
      
      onModificationSubmitted?.();
      await loadPlan();
    } catch (error) {
      console.error('Error submitting modification:', error);
      alert('Failed to submit modification. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const tabs = [
    { id: 'medications', label: 'Medications', icon: Pill },
    { id: 'investigations', label: 'Investigations', icon: TestTube },
    { id: 'procedures', label: 'Procedures', icon: Activity },
    { id: 'general', label: 'General', icon: FileText }
  ];

  return (
    <div className="bg-white rounded-lg shadow-lg border border-gray-200">
      {/* Header */}
      <div className="bg-gradient-to-r from-green-600 to-green-700 text-white px-6 py-4 rounded-t-lg">
        <div className="flex justify-between items-center">
          <div>
            <h3 className="text-lg font-bold">Modify Treatment Plan</h3>
            <p className="text-green-100 text-sm">{patientName}</p>
          </div>
          {onClose && (
            <button onClick={onClose} className="text-white hover:text-gray-200">
              <X className="w-5 h-5" />
            </button>
          )}
        </div>
        {!canDirectlyModify && (
          <div className="mt-2 flex items-center text-yellow-200 text-sm">
            <Clock className="w-4 h-4 mr-1" />
            <span>Your modifications will be submitted for consultant approval</span>
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <div className="flex">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`flex items-center px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === tab.id
                    ? 'border-green-500 text-green-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                <Icon className="w-4 h-4 mr-2" />
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="p-6">
        {/* Action Type Selection */}
        {activeTab !== 'general' && (
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">Action</label>
            <div className="flex gap-2">
              <button
                onClick={() => setModType('add')}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  modType === 'add'
                    ? 'bg-green-100 text-green-700 border-2 border-green-500'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                <Plus className="w-4 h-4 inline mr-1" />
                Add New
              </button>
              <button
                onClick={() => setModType('update')}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  modType === 'update'
                    ? 'bg-blue-100 text-blue-700 border-2 border-blue-500'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                <Edit className="w-4 h-4 inline mr-1" />
                Modify Existing
              </button>
              <button
                onClick={() => setModType('remove')}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  modType === 'remove'
                    ? 'bg-red-100 text-red-700 border-2 border-red-500'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                <Trash2 className="w-4 h-4 inline mr-1" />
                Remove
              </button>
            </div>
          </div>
        )}

        {/* Medication Form */}
        {activeTab === 'medications' && (
          <div className="space-y-4">
            {(modType === 'update' || modType === 'remove') && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Select Medication</label>
                <select
                  value={selectedMedId}
                  onChange={(e) => {
                    setSelectedMedId(e.target.value);
                    const med = plan?.planned_medications?.find(m => m.id === e.target.value);
                    if (med) {
                      setNewMed({
                        medication_name: med.medication_name,
                        dosage: med.dosage,
                        route: med.route,
                        frequency: med.frequency,
                        duration: med.duration || '',
                        notes: med.notes || ''
                      });
                    }
                  }}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-green-500"
                >
                  <option value="">-- Select Medication --</option>
                  {plan?.planned_medications?.map(med => (
                    <option key={med.id} value={med.id}>
                      {med.medication_name} - {med.dosage} {med.frequency}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {modType !== 'remove' && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Medication Name *</label>
                  <input
                    type="text"
                    value={newMed.medication_name}
                    onChange={(e) => setNewMed({ ...newMed, medication_name: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-green-500"
                    placeholder="e.g., Amoxicillin"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Dosage *</label>
                  <input
                    type="text"
                    value={newMed.dosage}
                    onChange={(e) => setNewMed({ ...newMed, dosage: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-green-500"
                    placeholder="e.g., 500mg"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Route</label>
                  <select
                    value={newMed.route}
                    onChange={(e) => setNewMed({ ...newMed, route: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-green-500"
                  >
                    <option value="oral">Oral</option>
                    <option value="IV">IV</option>
                    <option value="IM">IM</option>
                    <option value="SC">SC</option>
                    <option value="topical">Topical</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Frequency</label>
                  <input
                    type="text"
                    value={newMed.frequency}
                    onChange={(e) => setNewMed({ ...newMed, frequency: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-green-500"
                    placeholder="e.g., TDS, BD, OD"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Duration</label>
                  <input
                    type="text"
                    value={newMed.duration}
                    onChange={(e) => setNewMed({ ...newMed, duration: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-green-500"
                    placeholder="e.g., 7 days"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
                  <input
                    type="text"
                    value={newMed.notes}
                    onChange={(e) => setNewMed({ ...newMed, notes: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-green-500"
                    placeholder="Additional notes"
                  />
                </div>
              </div>
            )}
          </div>
        )}

        {/* Investigation Form */}
        {activeTab === 'investigations' && (
          <div className="space-y-4">
            {(modType === 'update' || modType === 'remove') && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Select Investigation</label>
                <select
                  value={selectedInvId}
                  onChange={(e) => {
                    setSelectedInvId(e.target.value);
                    const inv = plan?.planned_investigations?.find(i => i.id === e.target.value);
                    if (inv) {
                      setNewInv({
                        investigation_name: inv.investigation_name,
                        investigation_type: inv.investigation_type,
                        frequency: inv.frequency,
                        target_value: inv.target_value || '',
                        notes: inv.notes || ''
                      });
                    }
                  }}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-green-500"
                >
                  <option value="">-- Select Investigation --</option>
                  {plan?.planned_investigations?.map(inv => (
                    <option key={inv.id} value={inv.id}>
                      {inv.investigation_name} ({inv.investigation_type})
                    </option>
                  ))}
                </select>
              </div>
            )}

            {modType !== 'remove' && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="col-span-1 sm:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Investigation Name *</label>
                  <input
                    type="text"
                    value={newInv.investigation_name}
                    onChange={(e) => setNewInv({ ...newInv, investigation_name: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-green-500"
                    placeholder="e.g., FBC, U&E, CT Scan"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Type</label>
                  <select
                    value={newInv.investigation_type}
                    onChange={(e) => setNewInv({ ...newInv, investigation_type: e.target.value as any })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-green-500"
                  >
                    <option value="lab">Laboratory</option>
                    <option value="imaging">Imaging</option>
                    <option value="other">Other</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Frequency</label>
                  <select
                    value={newInv.frequency}
                    onChange={(e) => setNewInv({ ...newInv, frequency: e.target.value as any })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-green-500"
                  >
                    <option value="once">Once</option>
                    <option value="daily">Daily</option>
                    <option value="weekly">Weekly</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Target Value</label>
                  <input
                    type="text"
                    value={newInv.target_value}
                    onChange={(e) => setNewInv({ ...newInv, target_value: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-green-500"
                    placeholder="e.g., Hb > 10g/dL"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
                  <input
                    type="text"
                    value={newInv.notes}
                    onChange={(e) => setNewInv({ ...newInv, notes: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-green-500"
                    placeholder="Additional notes"
                  />
                </div>
              </div>
            )}
          </div>
        )}

        {/* Procedure Form */}
        {activeTab === 'procedures' && (
          <div className="space-y-4">
            {(modType === 'update' || modType === 'remove') && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Select Procedure</label>
                <select
                  value={selectedProcId}
                  onChange={(e) => {
                    setSelectedProcId(e.target.value);
                    const proc = plan?.planned_procedures?.find(p => p.id === e.target.value);
                    if (proc) {
                      setNewProc({
                        procedure_name: proc.procedure_name,
                        procedure_type: proc.procedure_type,
                        proposed_date: format(new Date(proc.proposed_date), 'yyyy-MM-dd'),
                        notes: proc.notes || ''
                      });
                    }
                  }}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-green-500"
                >
                  <option value="">-- Select Procedure --</option>
                  {plan?.planned_procedures?.map(proc => (
                    <option key={proc.id} value={proc.id}>
                      {proc.procedure_name} ({format(new Date(proc.proposed_date), 'dd/MM/yyyy')})
                    </option>
                  ))}
                </select>
              </div>
            )}

            {modType !== 'remove' && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="col-span-1 sm:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Procedure Name *</label>
                  <input
                    type="text"
                    value={newProc.procedure_name}
                    onChange={(e) => setNewProc({ ...newProc, procedure_name: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-green-500"
                    placeholder="e.g., Skin Grafting, Debridement"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Type</label>
                  <select
                    value={newProc.procedure_type}
                    onChange={(e) => setNewProc({ ...newProc, procedure_type: e.target.value as any })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-green-500"
                  >
                    <option value="minor">Minor</option>
                    <option value="major">Major</option>
                    <option value="therapeutic">Therapeutic</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Proposed Date</label>
                  <input
                    type="date"
                    value={newProc.proposed_date}
                    onChange={(e) => setNewProc({ ...newProc, proposed_date: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-green-500"
                  />
                </div>
                <div className="col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
                  <textarea
                    value={newProc.notes}
                    onChange={(e) => setNewProc({ ...newProc, notes: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-green-500"
                    rows={2}
                    placeholder="Additional notes"
                  />
                </div>
              </div>
            )}
          </div>
        )}

        {/* General Changes Form */}
        {activeTab === 'general' && (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Diagnosis</label>
              <textarea
                value={generalChanges.diagnosis}
                onChange={(e) => setGeneralChanges({ ...generalChanges, diagnosis: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-green-500"
                rows={3}
                placeholder="Update diagnosis..."
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
              <textarea
                value={generalChanges.notes}
                onChange={(e) => setGeneralChanges({ ...generalChanges, notes: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-green-500"
                rows={3}
                placeholder="Additional notes..."
              />
            </div>
          </div>
        )}

        {/* Reason & Priority */}
        <div className="mt-6 space-y-4 border-t pt-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Reason for Modification *
            </label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-green-500"
              rows={2}
              placeholder="Explain why this change is needed..."
              required
            />
          </div>

          {!canDirectlyModify && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Priority</label>
              <div className="flex gap-2">
                <button
                  onClick={() => setPriority('routine')}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                    priority === 'routine'
                      ? 'bg-gray-200 text-gray-800 border-2 border-gray-400'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  Routine
                </button>
                <button
                  onClick={() => setPriority('urgent')}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                    priority === 'urgent'
                      ? 'bg-orange-200 text-orange-800 border-2 border-orange-400'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  <AlertTriangle className="w-4 h-4 inline mr-1" />
                  Urgent
                </button>
                <button
                  onClick={() => setPriority('emergency')}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                    priority === 'emergency'
                      ? 'bg-red-200 text-red-800 border-2 border-red-400'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  <AlertTriangle className="w-4 h-4 inline mr-1" />
                  Emergency
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Submit Button */}
        <div className="mt-6 flex justify-end gap-3">
          {onClose && (
            <button
              onClick={onClose}
              className="px-4 py-2 text-gray-600 hover:text-gray-800 font-medium"
            >
              Cancel
            </button>
          )}
          <button
            onClick={handleSubmitModification}
            disabled={isSubmitting || !reason.trim()}
            className={`flex items-center px-6 py-2 rounded-lg font-medium transition-colors ${
              canDirectlyModify
                ? 'bg-green-600 text-white hover:bg-green-700'
                : 'bg-blue-600 text-white hover:bg-blue-700'
            } disabled:opacity-50 disabled:cursor-not-allowed`}
          >
            {isSubmitting ? (
              <>
                <Clock className="w-4 h-4 mr-2 animate-spin" />
                Submitting...
              </>
            ) : canDirectlyModify ? (
              <>
                <Check className="w-4 h-4 mr-2" />
                Apply Change
              </>
            ) : (
              <>
                <Send className="w-4 h-4 mr-2" />
                Submit for Approval
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default TreatmentPlanModificationPanel;

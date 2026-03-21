import React, { useState } from 'react';
import MedicalAutocompleteTextarea from './MedicalAutocompleteTextarea';
import { useAuthStore } from '../store/authStore';
import { MEDICATION_DATABASE } from '../data/medicationDatabase';
import { patientActivityService } from '../services/patientActivityService';
import { apiClient } from '../services/apiClient';
import { syncService } from '../db/syncService';
import { db } from '../db/database';
import { logPrescriptionAction } from '../services/auditLoggingService';

interface PrescriptionModalProps {
  isOpen: boolean;
  onClose: () => void;
  patientId: string;
  patientName: string;
  onSuccess: () => void;
}

interface Prescription {
  medication: string;
  genericName: string;
  dosage: string;
  route: string;
  frequency: string;
  duration: string;
  instructions: string;
  indication: string;
}

export const PrescriptionModal: React.FC<PrescriptionModalProps> = ({
  isOpen,
  onClose,
  patientId,
  patientName,
  onSuccess
}) => {
  const { user } = useAuthStore();
  const [prescriptions, setPrescriptions] = useState<Prescription[]>([{
    medication: '',
    genericName: '',
    dosage: '',
    route: 'oral',
    frequency: 'TDS',
    duration: '7 days',
    instructions: '',
    indication: ''
  }]);
  const [saving, setSaving] = useState(false);

  const routes = ['oral', 'IV', 'IM', 'SC', 'topical', 'rectal', 'sublingual', 'inhalation'];
  const frequencies = ['OD', 'BD', 'TDS', 'QID', 'PRN', 'STAT', 'Q4H', 'Q6H', 'Q8H', 'Q12H', 'Weekly'];

  const handleAddPrescription = () => {
    setPrescriptions([...prescriptions, {
      medication: '',
      genericName: '',
      dosage: '',
      route: 'oral',
      frequency: 'TDS',
      duration: '7 days',
      instructions: '',
      indication: ''
    }]);
  };

  const handleRemovePrescription = (index: number) => {
    setPrescriptions(prescriptions.filter((_, i) => i !== index));
  };

  const handlePrescriptionChange = (index: number, field: keyof Prescription, value: string) => {
    const updated = [...prescriptions];
    updated[index] = { ...updated[index], [field]: value };

    // Auto-fill generic name and typical dosage if medication is selected from database
    if (field === 'medication') {
      const med: any = Object.values(MEDICATION_DATABASE)
        .flat()
        .find((m: any) => m.name === value);
      if (med) {
        updated[index].genericName = med.genericName || '';
        updated[index].dosage = med.typicalDose || '';
      }
    }

    setPrescriptions(updated);
  };

  const handleSave = async () => {
    // Validate
    const invalid = prescriptions.some(p => !p.medication || !p.dosage || !p.indication);
    if (invalid) {
      alert('Please fill in medication, dosage, and indication for all prescriptions');
      return;
    }

    try {
      setSaving(true);

      const prescriptionData = {
        patient_id: patientId,
        patient_name: patientName,
        prescriber: user?.name || 'Unknown',
        prescriber_role: user?.role || 'Unknown',
        prescriptions: prescriptions,
        date: new Date().toISOString(),
        created_at: new Date(),
        updated_at: new Date()
      };

      // Try to sync to server first
      let prescriptionId: string = '';
      try {
        const savedPrescription = await apiClient.createPrescription(prescriptionData);
        prescriptionId = savedPrescription.id;
        console.log('✅ Prescription synced to server:', prescriptionId);
        
        // Save to IndexedDB with server ID
        if (db.prescriptions) {
          await db.prescriptions.add({ ...prescriptionData, id: prescriptionId, synced: true });
        }
      } catch (error) {
        console.warn('⚠️ Failed to sync prescription to server, saving locally', error);
        
        // Fallback: save locally and queue for sync
        if (db.prescriptions) {
          const localId = await db.prescriptions.add({ ...prescriptionData, synced: false });
          prescriptionId = localId.toString();
          await syncService.queueAction('create', 'prescriptions', localId, prescriptionData);
          console.log('📱 Prescription saved locally, will sync when online:', localId);
        } else {
          // Ultimate fallback to localStorage if db table doesn't exist
          const existing = JSON.parse(localStorage.getItem('prescriptions') || '[]');
          existing.push(prescriptionData);
          localStorage.setItem('prescriptions', JSON.stringify(existing));
          prescriptionId = `local-${Date.now()}`;
          console.log('📱 Prescription saved to localStorage (fallback)');
        }
      }

      // Log activity
      await patientActivityService.logPrescription(
        Number(patientId),
        patientId,
        user?.id?.toString() || 'unknown',
        user?.name || 'Unknown',
        user?.role || 'unknown',
        prescriptions,
        'created'
      );

      // Log audit for HIPAA compliance
      if (user) {
        await logPrescriptionAction(
          user.id,
          user.name,
          user.role,
          prescriptionId,
          patientId,
          'CREATE',
          `Created ${prescriptions.length} prescription(s) for ${patientName}`
        );
      }

      alert(`${prescriptions.length} prescription(s) saved successfully!`);
      onSuccess();
      handleClose();
    } catch (error) {
      console.error('Error saving prescription:', error);
      alert('Failed to save prescription');
    } finally {
      setSaving(false);
    }
  };

  const handleClose = () => {
    setPrescriptions([{
      medication: '',
      genericName: '',
      dosage: '',
      route: 'oral',
      frequency: 'TDS',
      duration: '7 days',
      instructions: '',
      indication: ''
    }]);
    onClose();
  };

  if (!isOpen) return null;

  // Get all medications for dropdown
  const allMedications = Object.values(MEDICATION_DATABASE).flat() as any[];

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center sm:block sm:p-0">
        <div className="fixed inset-0 transition-opacity bg-gray-500 bg-opacity-75" onClick={handleClose}></div>

        <span className="hidden sm:inline-block sm:align-middle sm:h-screen">&#8203;</span>

        <div className="inline-block w-full max-w-5xl px-4 pt-5 pb-4 overflow-hidden text-left align-bottom transition-all transform bg-white rounded-lg shadow-xl sm:my-8 sm:align-middle sm:p-6">
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="text-lg sm:text-2xl font-bold text-gray-900">Prescribe Medication</h3>
              <p className="text-sm text-gray-600 mt-1">
                Patient: <span className="font-medium">{patientName}</span>
              </p>
              <p className="text-xs text-gray-500">
                {new Date().toLocaleDateString()} {new Date().toLocaleTimeString()}
              </p>
            </div>
            <button
              onClick={handleClose}
              className="text-gray-400 hover:text-gray-600"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <div className="space-y-4 max-h-[65vh] overflow-y-auto pr-2">
            {prescriptions.map((prescription, index) => (
              <div key={index} className="bg-gray-50 p-4 rounded-lg border border-gray-200">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="font-semibold text-gray-900">Prescription {index + 1}</h4>
                  {prescriptions.length > 1 && (
                    <button
                      onClick={() => handleRemovePrescription(index)}
                      className="text-red-600 hover:text-red-800 text-sm"
                    >
                      Remove
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Medication */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Medication <span className="text-red-500">*</span>
                    </label>
                    <select
                      value={prescription.medication}
                      onChange={(e) => handlePrescriptionChange(index, 'medication', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md"
                    >
                      <option value="">Select medication</option>
                      {allMedications.map((med, i) => (
                        <option key={i} value={med.name}>{med.name}</option>
                      ))}
                    </select>
                  </div>

                  {/* Generic Name */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Generic Name
                    </label>
                    <input
                      type="text"
                      value={prescription.genericName}
                      onChange={(e) => handlePrescriptionChange(index, 'genericName', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-100"
                      placeholder="Auto-filled"
                      readOnly
                    />
                  </div>

                  {/* Dosage */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Dosage <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={prescription.dosage}
                      onChange={(e) => handlePrescriptionChange(index, 'dosage', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md"
                      placeholder="e.g., 500mg, 1 tablet"
                    />
                  </div>

                  {/* Route */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Route
                    </label>
                    <select
                      value={prescription.route}
                      onChange={(e) => handlePrescriptionChange(index, 'route', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md"
                    >
                      {routes.map(route => (
                        <option key={route} value={route}>{route.toUpperCase()}</option>
                      ))}
                    </select>
                  </div>

                  {/* Frequency */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Frequency
                    </label>
                    <select
                      value={prescription.frequency}
                      onChange={(e) => handlePrescriptionChange(index, 'frequency', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md"
                    >
                      {frequencies.map(freq => (
                        <option key={freq} value={freq}>{freq}</option>
                      ))}
                    </select>
                  </div>

                  {/* Duration */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Duration
                    </label>
                    <input
                      type="text"
                      value={prescription.duration}
                      onChange={(e) => handlePrescriptionChange(index, 'duration', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md"
                      placeholder="e.g., 7 days, 2 weeks"
                    />
                  </div>

                  {/* Indication */}
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Indication <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={prescription.indication}
                      onChange={(e) => handlePrescriptionChange(index, 'indication', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md"
                      placeholder="Reason for prescription"
                    />
                  </div>

                  {/* Special Instructions */}
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Special Instructions
                    </label>
                    <MedicalAutocompleteTextarea
                      value={prescription.instructions}
                      onChange={(val) => handlePrescriptionChange(index, 'instructions', val)}
                      rows={2}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md"
                      placeholder="Take with food, avoid alcohol, etc."
                    />
                  </div>
                </div>
              </div>
            ))}

            <button
              onClick={handleAddPrescription}
              className="w-full py-2 border-2 border-dashed border-gray-300 rounded-lg text-gray-600 hover:border-orange-500 hover:text-orange-600 transition-colors"
            >
              + Add Another Medication
            </button>
          </div>

          {/* Footer */}
          <div className="mt-6 flex justify-between items-center pt-4 border-t border-gray-200">
            <div className="text-xs text-gray-500">
              <p>Prescriber: <span className="font-medium">{user?.name || 'Unknown'}</span></p>
              <p>Role: <span className="font-medium">{user?.role || 'Unknown'}</span></p>
            </div>
            <div className="flex gap-3">
              <button
                onClick={handleClose}
                className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="px-6 py-2 bg-orange-600 text-white rounded-md hover:bg-orange-700 disabled:opacity-50"
              >
                {saving ? 'Saving...' : `Save ${prescriptions.length} Prescription(s)`}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

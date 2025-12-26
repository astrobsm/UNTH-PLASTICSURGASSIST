import React, { useState, useEffect } from 'react';
import { 
  Admission, 
  DischargeMedication, 
  MDTMedicationReview,
  admissionDischargeService 
} from '../services/admissionDischargeService';

interface MDTDischargeMedicationsProps {
  admission: Admission;
  onComplete: (medications: DischargeMedication[], reviewId?: number) => void;
  onBack: () => void;
}

const COMMON_MEDICATIONS = [
  { name: 'Paracetamol', dosages: ['500mg', '1g'], frequencies: ['8 hourly', '6 hourly PRN'] },
  { name: 'Tramadol', dosages: ['50mg', '100mg'], frequencies: ['8 hourly', '12 hourly'] },
  { name: 'Diclofenac', dosages: ['50mg', '75mg'], frequencies: ['8 hourly', '12 hourly'] },
  { name: 'Amoxicillin', dosages: ['250mg', '500mg'], frequencies: ['8 hourly'] },
  { name: 'Metronidazole', dosages: ['400mg', '500mg'], frequencies: ['8 hourly'] },
  { name: 'Ciprofloxacin', dosages: ['500mg'], frequencies: ['12 hourly'] },
  { name: 'Omeprazole', dosages: ['20mg', '40mg'], frequencies: ['Once daily', '12 hourly'] },
  { name: 'Metformin', dosages: ['500mg', '850mg', '1000mg'], frequencies: ['Once daily', '12 hourly'] },
  { name: 'Amlodipine', dosages: ['5mg', '10mg'], frequencies: ['Once daily'] },
  { name: 'Lisinopril', dosages: ['2.5mg', '5mg', '10mg', '20mg'], frequencies: ['Once daily'] },
  { name: 'Aspirin', dosages: ['75mg', '100mg'], frequencies: ['Once daily'] },
  { name: 'Clopidogrel', dosages: ['75mg'], frequencies: ['Once daily'] },
  { name: 'Atorvastatin', dosages: ['10mg', '20mg', '40mg'], frequencies: ['Once daily at night'] },
  { name: 'Insulin (Mixtard)', dosages: ['As prescribed'], frequencies: ['Before breakfast', '12 hourly'] },
  { name: 'Vitamin C', dosages: ['500mg', '1000mg'], frequencies: ['Once daily', '12 hourly'] },
  { name: 'Zinc', dosages: ['20mg', '50mg'], frequencies: ['Once daily'] },
  { name: 'Ferrous Sulphate', dosages: ['200mg'], frequencies: ['Once daily', '12 hourly'] },
  { name: 'Folic Acid', dosages: ['5mg'], frequencies: ['Once daily'] },
];

const SPECIALTIES = [
  'Plastic Surgery',
  'Internal Medicine',
  'Cardiology',
  'Endocrinology',
  'Nephrology',
  'Neurology',
  'Orthopedics',
  'General Surgery',
  'Infectious Disease',
  'Pain Management',
  'Pharmacy'
];

const DURATIONS = ['3 days', '5 days', '7 days', '10 days', '14 days', '21 days', '1 month', '2 months', '3 months', 'Continuous'];

const ROUTES = ['Oral', 'IV', 'IM', 'SC', 'Topical', 'Sublingual', 'Rectal', 'Inhaled'];

export default function MDTDischargeMedications({ admission, onComplete, onBack }: MDTDischargeMedicationsProps) {
  const [medications, setMedications] = useState<DischargeMedication[]>([]);
  const [medicationsBySpecialty, setMedicationsBySpecialty] = useState<Record<string, DischargeMedication[]>>({});
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedSpecialty, setSelectedSpecialty] = useState('Plastic Surgery');
  const [showHarmonization, setShowHarmonization] = useState(false);
  const [harmonizationResult, setHarmonizationResult] = useState<{
    harmonizedMedications: DischargeMedication[];
    duplicates: string[];
    interactions: string[];
    recommendations: string[];
  } | null>(null);

  // New medication form state
  const [newMed, setNewMed] = useState<DischargeMedication>({
    medication: '',
    dosage: '',
    frequency: '',
    duration: '',
    route: 'Oral',
    instructions: '',
    prescribing_specialty: 'Plastic Surgery',
    is_mdt_harmonized: false
  });

  // Check for existing prescriptions on load
  useEffect(() => {
    // Could load from prescriptions service if available
    // For now, start with empty list
  }, [admission.id]);

  const handleAddMedication = () => {
    if (!newMed.medication || !newMed.dosage || !newMed.frequency || !newMed.duration) {
      alert('Please fill in all required fields');
      return;
    }

    const specialty = newMed.prescribing_specialty || 'Plastic Surgery';
    const updatedBySpecialty = { ...medicationsBySpecialty };
    if (!updatedBySpecialty[specialty]) {
      updatedBySpecialty[specialty] = [];
    }
    updatedBySpecialty[specialty].push({ ...newMed });
    setMedicationsBySpecialty(updatedBySpecialty);

    // Reset form
    setNewMed({
      medication: '',
      dosage: '',
      frequency: '',
      duration: '',
      route: 'Oral',
      instructions: '',
      prescribing_specialty: selectedSpecialty,
      is_mdt_harmonized: false
    });
    setShowAddModal(false);
  };

  const handleRemoveMedication = (specialty: string, index: number) => {
    const updatedBySpecialty = { ...medicationsBySpecialty };
    updatedBySpecialty[specialty] = updatedBySpecialty[specialty].filter((_, i) => i !== index);
    if (updatedBySpecialty[specialty].length === 0) {
      delete updatedBySpecialty[specialty];
    }
    setMedicationsBySpecialty(updatedBySpecialty);
    setHarmonizationResult(null);
    setShowHarmonization(false);
  };

  const handleHarmonize = () => {
    const result = admissionDischargeService.harmonizeMDTMedications(medicationsBySpecialty);
    setHarmonizationResult(result);
    setShowHarmonization(true);
  };

  const handleComplete = async () => {
    const finalMedications = harmonizationResult?.harmonizedMedications || 
      Object.values(medicationsBySpecialty).flat();
    
    if (finalMedications.length === 0) {
      if (!confirm('No medications added. Continue without discharge medications?')) {
        return;
      }
    }

    onComplete(finalMedications);
  };

  const totalMedCount = Object.values(medicationsBySpecialty).flat().length;
  const specialtiesInvolved = Object.keys(medicationsBySpecialty);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-purple-50 p-4 rounded-lg border border-purple-200">
        <h3 className="text-lg font-bold text-purple-800">💊 MDT Harmonized Discharge Medications</h3>
        <p className="text-sm text-purple-600 mt-1">
          Add medications from all specialties involved in patient care. The system will check for duplicates and drug interactions.
        </p>
        <div className="mt-2 text-sm">
          <strong>Patient:</strong> {admission.patient_name} ({admission.hospital_number})
        </div>
      </div>

      {/* Summary Bar */}
      <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border">
        <div className="flex gap-4 text-sm">
          <span><strong>{totalMedCount}</strong> medications</span>
          <span><strong>{specialtiesInvolved.length}</strong> specialties</span>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setShowAddModal(true)}
            className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 text-sm"
          >
            ➕ Add Medication
          </button>
          {totalMedCount >= 2 && (
            <button
              onClick={handleHarmonize}
              className="px-4 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700 text-sm"
            >
              🔄 Harmonize MDT Medications
            </button>
          )}
        </div>
      </div>

      {/* Add Medication Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h4 className="text-lg font-semibold">Add Discharge Medication</h4>
              <button onClick={() => setShowAddModal(false)} className="text-gray-500 hover:text-gray-700 text-xl">×</button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Prescribing Specialty */}
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">Prescribing Specialty</label>
                <select
                  value={newMed.prescribing_specialty}
                  onChange={(e) => setNewMed({ ...newMed, prescribing_specialty: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                >
                  {SPECIALTIES.map(s => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </div>

              {/* Medication */}
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">Medication *</label>
                <input
                  type="text"
                  list="medication-suggestions"
                  value={newMed.medication}
                  onChange={(e) => setNewMed({ ...newMed, medication: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                  placeholder="Start typing medication name..."
                />
                <datalist id="medication-suggestions">
                  {COMMON_MEDICATIONS.map(m => (
                    <option key={m.name} value={m.name} />
                  ))}
                </datalist>
              </div>

              {/* Dosage */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Dosage *</label>
                <input
                  type="text"
                  value={newMed.dosage}
                  onChange={(e) => setNewMed({ ...newMed, dosage: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                  placeholder="e.g., 500mg"
                />
              </div>

              {/* Route */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Route</label>
                <select
                  value={newMed.route}
                  onChange={(e) => setNewMed({ ...newMed, route: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                >
                  {ROUTES.map(r => (
                    <option key={r} value={r}>{r}</option>
                  ))}
                </select>
              </div>

              {/* Frequency */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Frequency *</label>
                <input
                  type="text"
                  value={newMed.frequency}
                  onChange={(e) => setNewMed({ ...newMed, frequency: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                  placeholder="e.g., 8 hourly, Once daily"
                />
              </div>

              {/* Duration */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Duration *</label>
                <select
                  value={newMed.duration}
                  onChange={(e) => setNewMed({ ...newMed, duration: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                >
                  <option value="">Select duration</option>
                  {DURATIONS.map(d => (
                    <option key={d} value={d}>{d}</option>
                  ))}
                </select>
              </div>

              {/* Instructions */}
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">Special Instructions</label>
                <textarea
                  value={newMed.instructions}
                  onChange={(e) => setNewMed({ ...newMed, instructions: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                  rows={2}
                  placeholder="e.g., Take with food, Avoid alcohol"
                />
              </div>
            </div>

            {/* Quick Add Common Medications */}
            <div className="mt-4 pt-4 border-t">
              <label className="block text-sm font-medium text-gray-700 mb-2">Quick Add Common Medications</label>
              <div className="flex flex-wrap gap-2">
                {COMMON_MEDICATIONS.slice(0, 10).map(m => (
                  <button
                    key={m.name}
                    onClick={() => setNewMed({ 
                      ...newMed, 
                      medication: m.name,
                      dosage: m.dosages[0],
                      frequency: m.frequencies[0]
                    })}
                    className="px-2 py-1 text-xs bg-gray-100 hover:bg-gray-200 rounded"
                  >
                    {m.name}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={() => setShowAddModal(false)}
                className="px-4 py-2 border border-gray-300 rounded-md text-gray-700"
              >
                Cancel
              </button>
              <button
                onClick={handleAddMedication}
                className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700"
              >
                Add Medication
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Medications by Specialty */}
      {specialtiesInvolved.length === 0 ? (
        <div className="text-center py-12 bg-gray-50 rounded-lg border border-dashed border-gray-300">
          <p className="text-gray-500">No medications added yet</p>
          <button
            onClick={() => setShowAddModal(true)}
            className="mt-4 px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700"
          >
            ➕ Add First Medication
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {specialtiesInvolved.map(specialty => (
            <div key={specialty} className="bg-white rounded-lg border border-gray-200 overflow-hidden">
              <div className="bg-gray-100 px-4 py-2 flex justify-between items-center">
                <h5 className="font-semibold text-gray-800">{specialty}</h5>
                <span className="text-sm text-gray-600">
                  {medicationsBySpecialty[specialty].length} medication(s)
                </span>
              </div>
              <div className="divide-y">
                {medicationsBySpecialty[specialty].map((med, idx) => (
                  <div key={idx} className="px-4 py-3 flex justify-between items-start hover:bg-gray-50">
                    <div>
                      <div className="font-medium text-gray-900">{med.medication}</div>
                      <div className="text-sm text-gray-600">
                        {med.dosage} | {med.route} | {med.frequency} | {med.duration}
                      </div>
                      {med.instructions && (
                        <div className="text-sm text-blue-600 mt-1">📝 {med.instructions}</div>
                      )}
                    </div>
                    <button
                      onClick={() => handleRemoveMedication(specialty, idx)}
                      className="text-red-500 hover:text-red-700 ml-4"
                    >
                      🗑️
                    </button>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Harmonization Results */}
      {showHarmonization && harmonizationResult && (
        <div className="bg-blue-50 p-4 rounded-lg border border-blue-200 space-y-4">
          <h4 className="font-semibold text-blue-800">🔄 MDT Medication Harmonization Results</h4>
          
          {/* Duplicates */}
          {harmonizationResult.duplicates.length > 0 && (
            <div className="bg-yellow-50 p-3 rounded border border-yellow-200">
              <h5 className="font-medium text-yellow-800">⚠️ Duplicates Detected</h5>
              <ul className="mt-2 text-sm text-yellow-700">
                {harmonizationResult.duplicates.map((dup, idx) => (
                  <li key={idx}>• {dup}</li>
                ))}
              </ul>
            </div>
          )}

          {/* Interactions */}
          {harmonizationResult.interactions.length > 0 && (
            <div className="bg-red-50 p-3 rounded border border-red-200">
              <h5 className="font-medium text-red-800">🚨 Potential Drug Interactions</h5>
              <ul className="mt-2 text-sm text-red-700">
                {harmonizationResult.interactions.map((int, idx) => (
                  <li key={idx}>• {int}</li>
                ))}
              </ul>
            </div>
          )}

          {/* Recommendations */}
          {harmonizationResult.recommendations.length > 0 && (
            <div className="bg-green-50 p-3 rounded border border-green-200">
              <h5 className="font-medium text-green-800">💡 Recommendations</h5>
              <ul className="mt-2 text-sm text-green-700">
                {harmonizationResult.recommendations.map((rec, idx) => (
                  <li key={idx}>• {rec}</li>
                ))}
              </ul>
            </div>
          )}

          {/* Final List */}
          <div>
            <h5 className="font-medium text-blue-800 mb-2">✅ Final Harmonized Medication List ({harmonizationResult.harmonizedMedications.length})</h5>
            <div className="bg-white rounded border divide-y">
              {harmonizationResult.harmonizedMedications.map((med, idx) => (
                <div key={idx} className="px-3 py-2 flex justify-between">
                  <span className="font-medium">{med.medication}</span>
                  <span className="text-sm text-gray-600">{med.dosage} | {med.frequency} | {med.duration}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Pharmacy Consultation */}
      {totalMedCount > 5 && (
        <div className="bg-orange-50 p-4 rounded-lg border border-orange-200">
          <div className="flex items-center gap-2">
            <span className="text-2xl">⚕️</span>
            <div>
              <h5 className="font-medium text-orange-800">Pharmacy Review Recommended</h5>
              <p className="text-sm text-orange-600">
                Patient has 5+ medications. Consider pharmacy consultation for medication reconciliation.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex justify-between pt-4 border-t">
        <button
          onClick={onBack}
          className="px-6 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
        >
          ← Back
        </button>
        <button
          onClick={handleComplete}
          className="px-6 py-2 bg-green-600 text-white rounded-md hover:bg-green-700"
        >
          Continue to Summary →
        </button>
      </div>
    </div>
  );
}

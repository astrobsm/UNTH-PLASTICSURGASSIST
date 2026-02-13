import React, { useState } from 'react';
import { useAuthStore } from '../store/authStore';
import { patientActivityService } from '../services/patientActivityService';
import { apiClient } from '../services/apiClient';
import { syncService } from '../db/syncService';
import { db } from '../db/database';

interface ProgressNoteModalProps {
  isOpen: boolean;
  onClose: () => void;
  patientId: string;
  patientName: string;
  patientSex?: string;
  onSuccess: () => void;
}

interface ProgressNote {
  subjective: string;
  objective: string;
  assessment: string;
  plan: string;
}

export const ProgressNoteModal: React.FC<ProgressNoteModalProps> = ({
  isOpen,
  onClose,
  patientId,
  patientName,
  patientSex,
  onSuccess
}) => {
  const { user } = useAuthStore();
  const [note, setNote] = useState<ProgressNote>({
    subjective: '',
    objective: '',
    assessment: '',
    plan: ''
  });
  const [vitalSigns, setVitalSigns] = useState({
    temperature: '',
    bloodPressure: '',
    pulse: '',
    respiratoryRate: '',
    oxygenSaturation: '',
    painScore: ''
  });
  const [lmp, setLmp] = useState('');
  const [saving, setSaving] = useState(false);

  const isFemale = patientSex?.toLowerCase() === 'female' || patientSex?.toLowerCase() === 'f';

  const handleSave = async () => {
    if (!note.subjective || !note.objective || !note.assessment || !note.plan) {
      alert('Please fill in all SOAP sections');
      return;
    }

    if (isFemale && !lmp) {
      alert('LMP (Last Menstrual Period) is required for female patients');
      return;
    }

    try {
      setSaving(true);

      const progressNote = {
        patient_id: patientId,
        patient_name: patientName,
        author: user?.name || 'Unknown',
        author_role: user?.role || 'Unknown',
        date: new Date().toISOString(),
        vital_signs: vitalSigns,
        lmp: isFemale ? lmp : undefined,
        soap: note,
        created_at: new Date(),
        updated_at: new Date()
      };

      // Try to sync to server first
      try {
        const savedNote = await apiClient.createProgressNote(progressNote);
        console.log('✅ Progress note synced to server:', savedNote.id);
        
        // Save to IndexedDB with server ID
        if (db.progress_notes) {
          await db.progress_notes.add({ ...progressNote, id: savedNote.id, synced: true });
        }
      } catch (error) {
        console.warn('⚠️ Failed to sync progress note to server, saving locally', error);
        
        // Fallback: save locally and queue for sync
        if (db.progress_notes) {
          const localId = await db.progress_notes.add({ ...progressNote, synced: false });
          await syncService.queueAction('create', 'progress_notes', localId, progressNote);
          console.log('📱 Progress note saved locally, will sync when online:', localId);
        } else {
          // Ultimate fallback to localStorage if db table doesn't exist
          const existingNotes = JSON.parse(localStorage.getItem('progressNotes') || '[]');
          existingNotes.push(progressNote);
          localStorage.setItem('progressNotes', JSON.stringify(existingNotes));
          console.log('📱 Progress note saved to localStorage (fallback)');
        }
      }

      // Log activity
      await patientActivityService.logProgressNote(
        Number(patientId),
        patientId,
        user?.id?.toString() || 'unknown',
        user?.name || 'Unknown',
        user?.role || 'unknown',
        'SOAP',
        `S: ${note.subjective.substring(0, 100)}...`
      );

      alert('Progress note saved successfully!');
      onSuccess();
      handleClose();
    } catch (error) {
      console.error('Error saving progress note:', error);
      alert('Failed to save progress note');
    } finally {
      setSaving(false);
    }
  };

  const handleClose = () => {
    setNote({ subjective: '', objective: '', assessment: '', plan: '' });
    setVitalSigns({
      temperature: '',
      bloodPressure: '',
      pulse: '',
      respiratoryRate: '',
      oxygenSaturation: '',
      painScore: ''
    });
    setLmp('');
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center sm:block sm:p-0">
        <div className="fixed inset-0 transition-opacity bg-gray-500 bg-opacity-75" onClick={handleClose}></div>

        <span className="hidden sm:inline-block sm:align-middle sm:h-screen">&#8203;</span>

        <div className="inline-block w-full max-w-4xl px-4 pt-5 pb-4 overflow-hidden text-left align-bottom transition-all transform bg-white rounded-lg shadow-xl sm:my-8 sm:align-middle sm:p-6">
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="text-2xl font-bold text-gray-900">Add Progress Note</h3>
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

          <div className="space-y-6 max-h-[70vh] overflow-y-auto pr-2">
            {/* LMP Field for Female Patients */}
            {isFemale && (
              <div className="bg-pink-50 border border-pink-200 p-4 rounded-lg">
                <h4 className="font-semibold text-pink-900 mb-3 flex items-center">
                  <span className="mr-2">LMP (Last Menstrual Period)</span>
                  <span className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded-full">Required</span>
                </h4>
                <input
                  type="date"
                  value={lmp}
                  onChange={(e) => setLmp(e.target.value)}
                  max={new Date().toISOString().split('T')[0]}
                  className="w-full sm:w-1/2 px-3 py-2 border border-pink-300 rounded-md text-sm focus:ring-pink-500 focus:border-pink-500"
                  required
                />
                {lmp && (
                  <p className="text-xs text-pink-700 mt-1">
                    {Math.floor((new Date().getTime() - new Date(lmp).getTime()) / (1000 * 60 * 60 * 24))} days ago
                  </p>
                )}
              </div>
            )}

            {/* Vital Signs */}
            <div className="bg-blue-50 p-4 rounded-lg">
              <h4 className="font-semibold text-blue-900 mb-3">Vital Signs</h4>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    Temperature (°C)
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    value={vitalSigns.temperature}
                    onChange={(e) => setVitalSigns({ ...vitalSigns, temperature: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                    placeholder="37.0"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    BP (mmHg)
                  </label>
                  <input
                    type="text"
                    value={vitalSigns.bloodPressure}
                    onChange={(e) => setVitalSigns({ ...vitalSigns, bloodPressure: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                    placeholder="120/80"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    Pulse (bpm)
                  </label>
                  <input
                    type="number"
                    value={vitalSigns.pulse}
                    onChange={(e) => setVitalSigns({ ...vitalSigns, pulse: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                    placeholder="72"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    Resp Rate (rpm)
                  </label>
                  <input
                    type="number"
                    value={vitalSigns.respiratoryRate}
                    onChange={(e) => setVitalSigns({ ...vitalSigns, respiratoryRate: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                    placeholder="16"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    SpO2 (%)
                  </label>
                  <input
                    type="number"
                    value={vitalSigns.oxygenSaturation}
                    onChange={(e) => setVitalSigns({ ...vitalSigns, oxygenSaturation: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                    placeholder="98"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    Pain Score (0-10)
                  </label>
                  <input
                    type="number"
                    min="0"
                    max="10"
                    value={vitalSigns.painScore}
                    onChange={(e) => setVitalSigns({ ...vitalSigns, painScore: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                    placeholder="0"
                  />
                </div>
              </div>
            </div>

            {/* SOAP Note */}
            <div className="space-y-4">
              {/* Subjective */}
              <div>
                <label className="block text-sm font-semibold text-gray-900 mb-2">
                  S - Subjective (Patient's Complaints & History)
                  <span className="text-red-500 ml-1">*</span>
                </label>
                <textarea
                  required
                  value={note.subjective}
                  onChange={(e) => setNote({ ...note, subjective: e.target.value })}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-purple-500 focus:border-purple-500"
                  placeholder="Patient reports... Chief complaint... History of present illness..."
                />
              </div>

              {/* Objective */}
              <div>
                <label className="block text-sm font-semibold text-gray-900 mb-2">
                  O - Objective (Physical Examination & Findings)
                  <span className="text-red-500 ml-1">*</span>
                </label>
                <textarea
                  required
                  value={note.objective}
                  onChange={(e) => setNote({ ...note, objective: e.target.value })}
                  rows={4}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-purple-500 focus:border-purple-500"
                  placeholder="General appearance... Examination findings... Lab results... Imaging..."
                />
              </div>

              {/* Assessment */}
              <div>
                <label className="block text-sm font-semibold text-gray-900 mb-2">
                  A - Assessment (Clinical Impression & Diagnosis)
                  <span className="text-red-500 ml-1">*</span>
                </label>
                <textarea
                  required
                  value={note.assessment}
                  onChange={(e) => setNote({ ...note, assessment: e.target.value })}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-purple-500 focus:border-purple-500"
                  placeholder="Working diagnosis... Differential diagnosis... Clinical progress..."
                />
              </div>

              {/* Plan */}
              <div>
                <label className="block text-sm font-semibold text-gray-900 mb-2">
                  P - Plan (Management & Follow-up)
                  <span className="text-red-500 ml-1">*</span>
                </label>
                <textarea
                  required
                  value={note.plan}
                  onChange={(e) => setNote({ ...note, plan: e.target.value })}
                  rows={4}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-purple-500 focus:border-purple-500"
                  placeholder="Treatment plan... Medications... Investigations... Follow-up... Consultations..."
                />
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="mt-6 flex justify-between items-center pt-4 border-t border-gray-200">
            <div className="text-xs text-gray-500">
              <p>Author: <span className="font-medium">{user?.name || 'Unknown'}</span></p>
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
                className="px-6 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700 disabled:opacity-50"
              >
                {saving ? 'Saving...' : 'Save Progress Note'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

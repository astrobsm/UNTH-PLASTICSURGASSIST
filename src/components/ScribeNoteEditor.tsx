/**
 * ScribeNoteEditor — Review & edit AI-structured medical notes
 * 
 * Displays SOAP sections, extracted vitals/meds/orders/wounds in editable form.
 * User reviews, edits, then applies to ward round form or saves as review.
 */

import React, { useState, useCallback } from 'react';
import {
  X,
  Save,
  Wand2,
  Edit3,
  
  AlertTriangle,
  Trash2,
  Plus,
  ChevronDown,
  ChevronUp,
  Thermometer,
  Heart,
  Activity,
  Wind,
  Brain,
  Pill,
  TestTube,
  Scissors,
  ClipboardList,
  FileText,
  Loader2,
} from 'lucide-react';
import {
  StructuredNote,
  ExtractedVitals,
  ExtractedMedication,
  ExtractedOrder,
  ExtractedWoundAssessment,
  medicalScribeService,
  NoteSection,
} from '../services/medicalScribeService';

interface ScribeNoteEditorProps {
  note: StructuredNote;
  patientName: string;
  onSave: (editedNote: StructuredNote) => void;
  onApplyToForm?: (formData: Record<string, any>) => void;
  onClose: () => void;
  showApplyButton?: boolean;
  /** When provided, enables "Save vitals to observation chart" for this patient. */
  patientId?: string | number;
  recordedBy?: { name?: string; role?: string };
}

export const ScribeNoteEditor: React.FC<ScribeNoteEditorProps> = ({
  note,
  patientName,
  onSave,
  onApplyToForm,
  onClose,
  showApplyButton = true,
  patientId,
  recordedBy,
}) => {
  const [editedNote, setEditedNote] = useState<StructuredNote>({ ...note });
  const [expandedSections, setExpandedSections] = useState<Set<string>>(
    new Set(['subjective', 'objective', 'assessment', 'plan'])
  );
  const [enhancingSection, setEnhancingSection] = useState<string | null>(null);
  const [hasChanges, setHasChanges] = useState(false);
  const [vitalsChartStatus, setVitalsChartStatus] = useState<'idle' | 'saving' | 'saved' | 'empty'>('idle');

  // Push the (reviewed) dictated vitals onto the patient's observation chart.
  const saveVitalsToChart = useCallback(async () => {
    if (patientId == null) return;
    setVitalsChartStatus('saving');
    const saved = await medicalScribeService.saveVitalsToChart(editedNote, patientId, recordedBy);
    setVitalsChartStatus(saved > 0 ? 'saved' : 'empty');
    if (saved > 0) setTimeout(() => setVitalsChartStatus('idle'), 3000);
  }, [editedNote, patientId, recordedBy]);

  const hasAnyVital = Object.values(editedNote.vitals).some(v => v !== undefined && v !== null);

  // ─── Section Toggle ─────────────────────────────────────────────

  const toggleSection = (section: string) => {
    const newExpanded = new Set(expandedSections);
    if (newExpanded.has(section)) newExpanded.delete(section);
    else newExpanded.add(section);
    setExpandedSections(newExpanded);
  };

  // ─── Text Update ────────────────────────────────────────────────

  const updateTextField = useCallback((field: keyof StructuredNote, value: string) => {
    setEditedNote(prev => ({ ...prev, [field]: value }));
    setHasChanges(true);
  }, []);

  // ─── Vitals Update ─────────────────────────────────────────────

  const updateVital = useCallback((key: keyof ExtractedVitals, value: string) => {
    const numVal = value === '' ? undefined : parseFloat(value);
    setEditedNote(prev => ({
      ...prev,
      vitals: { ...prev.vitals, [key]: numVal },
    }));
    setHasChanges(true);
  }, []);

  // ─── Medication Update ─────────────────────────────────────────

  const updateMedication = useCallback((index: number, field: keyof ExtractedMedication, value: any) => {
    setEditedNote(prev => {
      const meds = [...prev.medications];
      meds[index] = { ...meds[index], [field]: value };
      return { ...prev, medications: meds };
    });
    setHasChanges(true);
  }, []);

  const removeMedication = useCallback((index: number) => {
    setEditedNote(prev => ({
      ...prev,
      medications: prev.medications.filter((_, i) => i !== index),
    }));
    setHasChanges(true);
  }, []);

  const addMedication = useCallback(() => {
    setEditedNote(prev => ({
      ...prev,
      medications: [...prev.medications, { name: '', action: 'start' as const }],
    }));
    setHasChanges(true);
  }, []);

  // ─── Order Update ──────────────────────────────────────────────

  const updateOrder = useCallback((index: number, field: keyof ExtractedOrder, value: any) => {
    setEditedNote(prev => {
      const orders = [...prev.orders];
      orders[index] = { ...orders[index], [field]: value };
      return { ...prev, orders: orders };
    });
    setHasChanges(true);
  }, []);

  const removeOrder = useCallback((index: number) => {
    setEditedNote(prev => ({
      ...prev,
      orders: prev.orders.filter((_, i) => i !== index),
    }));
    setHasChanges(true);
  }, []);

  const addOrder = useCallback(() => {
    setEditedNote(prev => ({
      ...prev,
      orders: [...prev.orders, { type: 'lab' as const, description: '', priority: 'routine' as const }],
    }));
    setHasChanges(true);
  }, []);

  // ─── Wound Update ──────────────────────────────────────────────

  const updateWound = useCallback((index: number, field: keyof ExtractedWoundAssessment, value: any) => {
    setEditedNote(prev => {
      const wounds = [...prev.wounds];
      wounds[index] = { ...wounds[index], [field]: value };
      return { ...prev, wounds: wounds };
    });
    setHasChanges(true);
  }, []);

  const removeWound = useCallback((index: number) => {
    setEditedNote(prev => ({
      ...prev,
      wounds: prev.wounds.filter((_, i) => i !== index),
    }));
    setHasChanges(true);
  }, []);

  // ─── AI Enhance Section ────────────────────────────────────────

  const enhanceSection = async (sectionName: NoteSection, currentText: string) => {
    if (!currentText.trim()) return;
    setEnhancingSection(sectionName);
    try {
      const enhanced = await medicalScribeService.enhanceSection(currentText, sectionName);
      updateTextField(sectionName as keyof StructuredNote, enhanced);
    } catch {
      // silently fail
    } finally {
      setEnhancingSection(null);
    }
  };

  // ─── Apply to Form ─────────────────────────────────────────────

  const handleApplyToForm = () => {
    if (onApplyToForm) {
      const formData = medicalScribeService.toWardRoundFormData(editedNote);
      onApplyToForm(formData);
    }
  };

  // ─── Save ──────────────────────────────────────────────────────

  const handleSave = () => {
    onSave(editedNote);
  };

  // ─── Progress Badge ────────────────────────────────────────────

  const progressColors: Record<string, string> = {
    improved: 'bg-green-100 text-green-800 border-green-200',
    stable: 'bg-blue-100 text-blue-800 border-blue-200',
    deteriorating: 'bg-orange-100 text-orange-800 border-orange-200',
    critical: 'bg-red-100 text-red-800 border-red-200',
  };

  // ─── Section Header ────────────────────────────────────────────

  const SectionHeader: React.FC<{
    title: string;
    section: string;
    icon: React.ReactNode;
    color: string;
    count?: number;
    sectionKey?: NoteSection;
    sectionText?: string;
  }> = ({ title, section, icon, color, count, sectionKey, sectionText }) => (
    <div
      className={`flex items-center justify-between px-4 py-3 cursor-pointer hover:bg-gray-50 border-l-4 ${color}`}
      onClick={() => toggleSection(section)}
    >
      <div className="flex items-center gap-2">
        {icon}
        <span className="font-semibold text-gray-900">{title}</span>
        {count !== undefined && count > 0 && (
          <span className="px-2 py-0.5 bg-gray-200 text-gray-700 rounded-full text-xs">{count}</span>
        )}
      </div>
      <div className="flex items-center gap-2">
        {sectionKey && sectionText && sectionText.trim() && (
          <button
            onClick={(e) => { e.stopPropagation(); enhanceSection(sectionKey, sectionText); }}
            className="p-1 text-blue-500 hover:text-blue-700 hover:bg-blue-50 rounded"
            title="AI Enhance"
            disabled={!!enhancingSection}
          >
            {enhancingSection === sectionKey ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Wand2 className="w-4 h-4" />
            )}
          </button>
        )}
        {expandedSections.has(section) ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
      </div>
    </div>
  );

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-0 sm:p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">

        {/* Header */}
        <div className="px-6 py-4 bg-gradient-to-r from-indigo-600 to-purple-600 text-white flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-3">
            <Brain className="w-6 h-6" />
            <div>
              <h2 className="text-lg font-bold">AI Scribe — Note Review</h2>
              <p className="text-sm opacity-80">{patientName}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {note.confidence > 0 && (
              <span className={`text-xs px-2 py-1 rounded-full ${
                note.confidence >= 0.8 ? 'bg-green-500/30' : note.confidence >= 0.6 ? 'bg-yellow-500/30' : 'bg-red-500/30'
              }`}>
                {Math.round(note.confidence * 100)}% AI confidence
              </span>
            )}
            <button onClick={onClose} className="p-1 hover:bg-white/20 rounded"><X className="w-5 h-5" /></button>
          </div>
        </div>

        {/* Progress Status */}
        <div className="px-6 py-2 border-b bg-gray-50 flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-600">Patient Progress:</span>
            <select
              value={editedNote.progress_status}
              onChange={(e) => { setEditedNote(prev => ({ ...prev, progress_status: e.target.value as any })); setHasChanges(true); }}
              className={`text-sm px-3 py-1 rounded-full border font-medium ${progressColors[editedNote.progress_status]}`}
            >
              <option value="improved">Improved</option>
              <option value="stable">Stable</option>
              <option value="deteriorating">Deteriorating</option>
              <option value="critical">Critical</option>
            </select>
          </div>
          {hasChanges && (
            <span className="text-xs text-amber-600 flex items-center gap-1">
              <Edit3 className="w-3 h-3" /> Unsaved changes
            </span>
          )}
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto">

          {/* ─── Subjective ─────────────────────── */}
          <SectionHeader title="Subjective" section="subjective" icon={<FileText className="w-5 h-5 text-blue-600" />} color="border-blue-500" sectionKey="subjective" sectionText={editedNote.subjective} />
          {expandedSections.has('subjective') && (
            <div className="px-6 py-3">
              <textarea
                value={editedNote.subjective}
                onChange={(e) => updateTextField('subjective', e.target.value)}
                className="w-full p-3 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                rows={4}
                placeholder="Patient complaints, history, symptoms..."
              />
            </div>
          )}

          {/* ─── Objective ──────────────────────── */}
          <SectionHeader title="Objective" section="objective" icon={<Activity className="w-5 h-5 text-green-600" />} color="border-green-500" sectionKey="objective" sectionText={editedNote.objective} />
          {expandedSections.has('objective') && (
            <div className="px-6 py-3">
              <textarea
                value={editedNote.objective}
                onChange={(e) => updateTextField('objective', e.target.value)}
                className="w-full p-3 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-green-500 focus:border-green-500"
                rows={4}
                placeholder="Examination findings, vitals narrative..."
              />
            </div>
          )}

          {/* ─── Vitals ─────────────────────────── */}
          <SectionHeader
            title="Extracted Vitals"
            section="vitals"
            icon={<Thermometer className="w-5 h-5 text-red-600" />}
            color="border-red-500"
            count={Object.values(editedNote.vitals).filter(v => v !== undefined).length}
          />
          {expandedSections.has('vitals') && (
            <div className="px-6 py-3">
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1 flex items-center gap-1">
                    <Thermometer className="w-3 h-3" /> Temperature (°C)
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    value={editedNote.vitals.temperature ?? ''}
                    onChange={(e) => updateVital('temperature', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                    placeholder="36.5"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1 flex items-center gap-1">
                    <Heart className="w-3 h-3" /> Pulse (bpm)
                  </label>
                  <input
                    type="number"
                    value={editedNote.vitals.pulse ?? ''}
                    onChange={(e) => updateVital('pulse', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                    placeholder="72"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">BP Systolic</label>
                  <input
                    type="number"
                    value={editedNote.vitals.bp_systolic ?? ''}
                    onChange={(e) => updateVital('bp_systolic', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                    placeholder="120"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">BP Diastolic</label>
                  <input
                    type="number"
                    value={editedNote.vitals.bp_diastolic ?? ''}
                    onChange={(e) => updateVital('bp_diastolic', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                    placeholder="80"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1 flex items-center gap-1">
                    <Wind className="w-3 h-3" /> Resp Rate
                  </label>
                  <input
                    type="number"
                    value={editedNote.vitals.respiratory_rate ?? ''}
                    onChange={(e) => updateVital('respiratory_rate', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                    placeholder="18"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">SpO₂ (%)</label>
                  <input
                    type="number"
                    value={editedNote.vitals.spo2 ?? ''}
                    onChange={(e) => updateVital('spo2', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                    placeholder="98"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Pain Score (0-10)</label>
                  <input
                    type="number"
                    min="0"
                    max="10"
                    value={editedNote.vitals.pain_score ?? ''}
                    onChange={(e) => updateVital('pain_score', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                    placeholder="3"
                  />
                </div>
              </div>

              {/* Push reviewed vitals onto the observation chart */}
              {patientId != null && (
                <div className="mt-3 flex items-center gap-3">
                  <button
                    type="button"
                    onClick={saveVitalsToChart}
                    disabled={!hasAnyVital || vitalsChartStatus === 'saving'}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-md bg-red-600 text-white hover:bg-red-700 disabled:opacity-50"
                  >
                    {vitalsChartStatus === 'saving' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Thermometer className="w-4 h-4" />}
                    Save vitals to observation chart
                  </button>
                  {vitalsChartStatus === 'saved' && <span className="text-xs text-green-600">✓ Added to chart</span>}
                  {vitalsChartStatus === 'empty' && <span className="text-xs text-gray-500">No vitals to save</span>}
                  <span className="text-xs text-gray-400">Review the values above first — this records a timed reading on the patient's trend chart.</span>
                </div>
              )}
            </div>
          )}

          {/* ─── Assessment ─────────────────────── */}
          <SectionHeader title="Assessment" section="assessment" icon={<Brain className="w-5 h-5 text-yellow-600" />} color="border-yellow-500" sectionKey="assessment" sectionText={editedNote.assessment} />
          {expandedSections.has('assessment') && (
            <div className="px-6 py-3">
              <textarea
                value={editedNote.assessment}
                onChange={(e) => updateTextField('assessment', e.target.value)}
                className="w-full p-3 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-yellow-500 focus:border-yellow-500"
                rows={3}
                placeholder="Clinical impression, diagnosis..."
              />
            </div>
          )}

          {/* ─── Plan ───────────────────────────── */}
          <SectionHeader title="Plan" section="plan" icon={<ClipboardList className="w-5 h-5 text-purple-600" />} color="border-purple-500" sectionKey="plan" sectionText={editedNote.plan} />
          {expandedSections.has('plan') && (
            <div className="px-6 py-3">
              <textarea
                value={editedNote.plan}
                onChange={(e) => updateTextField('plan', e.target.value)}
                className="w-full p-3 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                rows={4}
                placeholder="Treatment plan, orders, follow-up..."
              />
            </div>
          )}

          {/* ─── Medications ────────────────────── */}
          <SectionHeader
            title="Medications"
            section="medications"
            icon={<Pill className="w-5 h-5 text-orange-600" />}
            color="border-orange-500"
            count={editedNote.medications.length}
          />
          {expandedSections.has('medications') && (
            <div className="px-6 py-3 space-y-2">
              {editedNote.medications.map((med, i) => (
                <div key={i} className="flex items-center gap-2 p-2 bg-gray-50 rounded-lg">
                  <select
                    value={med.action}
                    onChange={(e) => updateMedication(i, 'action', e.target.value)}
                    className={`text-xs px-2 py-1 rounded font-medium border ${
                      med.action === 'start' ? 'bg-green-100 text-green-700 border-green-200' :
                      med.action === 'stop' ? 'bg-red-100 text-red-700 border-red-200' :
                      med.action === 'modify' ? 'bg-yellow-100 text-yellow-700 border-yellow-200' :
                      'bg-blue-100 text-blue-700 border-blue-200'
                    }`}
                  >
                    <option value="start">START</option>
                    <option value="continue">CONTINUE</option>
                    <option value="stop">STOP</option>
                    <option value="modify">MODIFY</option>
                  </select>
                  <input
                    value={med.name}
                    onChange={(e) => updateMedication(i, 'name', e.target.value)}
                    className="flex-1 px-2 py-1 border border-gray-300 rounded text-sm min-w-0"
                    placeholder="Medication name"
                  />
                  <input
                    value={med.dose || ''}
                    onChange={(e) => updateMedication(i, 'dose', e.target.value)}
                    className="w-20 px-2 py-1 border border-gray-300 rounded text-sm"
                    placeholder="Dose"
                  />
                  <input
                    value={med.route || ''}
                    onChange={(e) => updateMedication(i, 'route', e.target.value)}
                    className="w-16 px-2 py-1 border border-gray-300 rounded text-sm"
                    placeholder="Route"
                  />
                  <input
                    value={med.frequency || ''}
                    onChange={(e) => updateMedication(i, 'frequency', e.target.value)}
                    className="w-16 px-2 py-1 border border-gray-300 rounded text-sm"
                    placeholder="Freq"
                  />
                  <button onClick={() => removeMedication(i)} className="p-1 text-red-400 hover:text-red-600">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
              <button onClick={addMedication} className="flex items-center gap-1 text-sm text-green-600 hover:text-green-700">
                <Plus className="w-4 h-4" /> Add Medication
              </button>
            </div>
          )}

          {/* ─── Orders ─────────────────────────── */}
          <SectionHeader
            title="Orders"
            section="orders"
            icon={<TestTube className="w-5 h-5 text-indigo-600" />}
            color="border-indigo-500"
            count={editedNote.orders.length}
          />
          {expandedSections.has('orders') && (
            <div className="px-6 py-3 space-y-2">
              {editedNote.orders.map((order, i) => (
                <div key={i} className="flex items-center gap-2 p-2 bg-gray-50 rounded-lg">
                  <select
                    value={order.type}
                    onChange={(e) => updateOrder(i, 'type', e.target.value)}
                    className="text-xs px-2 py-1 rounded border border-gray-300 bg-white"
                  >
                    <option value="lab">Lab</option>
                    <option value="imaging">Imaging</option>
                    <option value="consultation">Consult</option>
                    <option value="procedure">Procedure</option>
                    <option value="nursing">Nursing</option>
                    <option value="other">Other</option>
                  </select>
                  <input
                    value={order.description}
                    onChange={(e) => updateOrder(i, 'description', e.target.value)}
                    className="flex-1 px-2 py-1 border border-gray-300 rounded text-sm min-w-0"
                    placeholder="Order description"
                  />
                  <select
                    value={order.priority}
                    onChange={(e) => updateOrder(i, 'priority', e.target.value)}
                    className={`text-xs px-2 py-1 rounded border font-medium ${
                      order.priority === 'stat' ? 'bg-red-100 text-red-700 border-red-200' :
                      order.priority === 'urgent' ? 'bg-orange-100 text-orange-700 border-orange-200' :
                      'bg-gray-100 text-gray-700 border-gray-200'
                    }`}
                  >
                    <option value="routine">Routine</option>
                    <option value="urgent">Urgent</option>
                    <option value="stat">STAT</option>
                  </select>
                  <button onClick={() => removeOrder(i)} className="p-1 text-red-400 hover:text-red-600">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
              <button onClick={addOrder} className="flex items-center gap-1 text-sm text-green-600 hover:text-green-700">
                <Plus className="w-4 h-4" /> Add Order
              </button>
            </div>
          )}

          {/* ─── Wounds ─────────────────────────── */}
          {editedNote.wounds.length > 0 && (
            <>
              <SectionHeader
                title="Wound Assessments"
                section="wounds"
                icon={<Scissors className="w-5 h-5 text-pink-600" />}
                color="border-pink-500"
                count={editedNote.wounds.length}
              />
              {expandedSections.has('wounds') && (
                <div className="px-6 py-3 space-y-3">
                  {editedNote.wounds.map((wound, i) => (
                    <div key={i} className="p-3 bg-pink-50 rounded-lg border border-pink-100">
                      <div className="flex items-center justify-between mb-2">
                        <input
                          value={wound.location}
                          onChange={(e) => updateWound(i, 'location', e.target.value)}
                          className="font-medium text-sm px-2 py-1 border border-pink-200 rounded bg-white"
                          placeholder="Wound location"
                        />
                        <button onClick={() => removeWound(i)} className="p-1 text-red-400 hover:text-red-600">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                      <textarea
                        value={wound.description}
                        onChange={(e) => updateWound(i, 'description', e.target.value)}
                        className="w-full px-2 py-1 border border-gray-300 rounded text-sm"
                        rows={2}
                        placeholder="Wound description"
                      />
                      <label className="flex items-center gap-2 mt-2 text-sm">
                        <input
                          type="checkbox"
                          checked={wound.dressing_change || false}
                          onChange={(e) => updateWound(i, 'dressing_change', e.target.checked)}
                          className="rounded border-gray-300 text-green-600"
                        />
                        Dressing changed
                      </label>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}

          {/* ─── Discharge / Complications ──────── */}
          {(editedNote.discharge_planning || editedNote.complications) && (
            <>
              <SectionHeader title="Additional Notes" section="additional" icon={<AlertTriangle className="w-5 h-5 text-gray-600" />} color="border-gray-400" />
              {expandedSections.has('additional') && (
                <div className="px-6 py-3 space-y-3">
                  {editedNote.discharge_planning !== undefined && (
                    <div>
                      <label className="block text-xs font-medium text-gray-500 mb-1">Discharge Planning</label>
                      <textarea
                        value={editedNote.discharge_planning || ''}
                        onChange={(e) => updateTextField('discharge_planning' as any, e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                        rows={2}
                      />
                    </div>
                  )}
                  {editedNote.complications !== undefined && (
                    <div>
                      <label className="block text-xs font-medium text-gray-500 mb-1">Complications</label>
                      <textarea
                        value={editedNote.complications || ''}
                        onChange={(e) => updateTextField('complications' as any, e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                        rows={2}
                      />
                    </div>
                  )}
                </div>
              )}
            </>
          )}

          {/* ─── Raw Transcript ─────────────────── */}
          <SectionHeader title="Raw Transcript" section="transcript" icon={<FileText className="w-5 h-5 text-gray-500" />} color="border-gray-300" />
          {expandedSections.has('transcript') && (
            <div className="px-6 py-3">
              <div className="p-3 bg-gray-50 rounded-lg text-sm text-gray-600 max-h-32 overflow-y-auto whitespace-pre-wrap">
                {editedNote.raw_transcript || 'No transcript available'}
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="px-6 py-4 border-t bg-gray-50 flex items-center justify-between flex-shrink-0">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-600 hover:text-gray-800 text-sm"
          >
            Cancel
          </button>
          <div className="flex items-center gap-3">
            {showApplyButton && onApplyToForm && (
              <button
                onClick={handleApplyToForm}
                className="flex items-center gap-2 px-5 py-2.5 bg-green-600 text-white rounded-lg hover:bg-green-700 font-medium text-sm shadow-sm"
              >
                <Wand2 className="w-4 h-4" />
                Apply to Ward Round
              </button>
            )}
            <button
              onClick={handleSave}
              className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 font-medium text-sm shadow-sm"
            >
              <Save className="w-4 h-4" />
              Save Note
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ScribeNoteEditor;

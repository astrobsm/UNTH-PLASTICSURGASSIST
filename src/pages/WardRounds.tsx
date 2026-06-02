import React, { useState, useEffect, useMemo } from 'react';
import { Calendar, User, Activity, FileText, Plus, Search, TrendingUp, Clock, AlertCircle, ChevronDown, ChevronUp, Thermometer, Heart, Wind, Droplets, Stethoscope, Pill, TestTube, Eye, ClipboardList, ArrowLeft, X, FileDown, FileBarChart } from 'lucide-react';
import WardRoundForm from '../components/WardRoundForm';
import { wardRoundsService, WardRound, ROUND_TYPES } from '../services/wardRoundsService';
import { db } from '../db/database';
import { patientService } from '../services/patientService';
import { useOnSelectedPatient } from '../hooks/useSelectedPatient';
import { format, isWithinInterval, parseISO, startOfDay, endOfDay } from 'date-fns';
import { safeFormatDate } from '../utils/dateUtils';

interface Patient {
  id: string;
  name: string;
  hospital_number: string;
}

export default function WardRounds() {
  const [rounds, setRounds] = useState<WardRound[]>([]);
  const [patients, setPatients] = useState<Patient[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [selectedRound, setSelectedRound] = useState<WardRound | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<'all' | 'stable' | 'deteriorating' | 'critical' | 'improved'>('all');
  const [filterDate, setFilterDate] = useState<'today' | 'week' | 'month' | 'all'>('all');

  // Patient-focused documentation preview
  const [selectedPatientId, setSelectedPatientId] = useState<string | null>(null);
  useOnSelectedPatient((p) => setSelectedPatientId(String(p.id)));
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [expandedRoundIds, setExpandedRoundIds] = useState<Set<string>>(new Set());
  const [patientSearch, setPatientSearch] = useState('');

  // Harmonised Summary state
  const [showHarmonisedSummary, setShowHarmonisedSummary] = useState(false);
  const [harmonisedSummary, setHarmonisedSummary] = useState('');
  const [generatingSummary, setGeneratingSummary] = useState(false);

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const [roundsData, patientsData] = await Promise.all([
        wardRoundsService.getAllWardRounds(),
        patientService.getAllPatients()
      ]);
      setRounds(roundsData);
      setPatients(patientsData.map(p => ({
        id: p.id?.toString() || '',
        name: `${p.first_name || ''} ${p.last_name || ''}`.trim() || 'Unknown Patient',
        hospital_number: p.hospital_number || ''
      })));
    } catch (error) {
      console.error('Error loading ward rounds data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateRound = () => { setSelectedRound(null); setShowForm(true); };
  const handleEditRound = (round: WardRound) => { setSelectedRound(round); setShowForm(true); };
  const handleCloseForm = () => { setShowForm(false); setSelectedRound(null); loadData(); };

  const handleDeleteRound = async (id: string) => {
    if (window.confirm('Are you sure you want to delete this ward round entry?')) {
      try {
        await wardRoundsService.deleteRound(id);
        loadData();
      } catch (error) {
        console.error('Error deleting ward round:', error);
        alert('Failed to delete ward round entry');
      }
    }
  };

  // Generate harmonised patient summary from all data
  const generateHarmonisedSummary = async () => {
    if (!selectedPatientId || !selectedPatient) return;
    setGeneratingSummary(true);
    try {
      // Gather all patient data in parallel
      const [
        labInvestigations,
        prescriptions,
        admissions,
        treatmentPlans,
        progressNotes,
        woundCareRecords,
      ] = await Promise.all([
        db.lab_investigations?.where('patient_id').equals(selectedPatientId).toArray().catch(() => []) || [],
        db.prescriptions?.where('patient_id').equals(selectedPatientId).toArray().catch(() => []) || [],
        db.admissions?.where('patient_id').equals(selectedPatientId).toArray().catch(() => []) || [],
        db.treatment_plans?.where('patient_id').equals(selectedPatientId).toArray().catch(() => []) || [],
        db.progress_notes?.where('patient_id').equals(selectedPatientId).toArray().catch(() => []) || [],
        db.wound_care?.where('patient_id').equals(selectedPatientId).toArray().catch(() => []) || [],
      ]);

      const sortedRounds = [...patientRounds].sort((a, b) => new Date(a.round_date).getTime() - new Date(b.round_date).getTime());
      const latestRound = sortedRounds[sortedRounds.length - 1] as any;

      let summary = `---------------------------------------------------\n`;
      summary += `  HARMONISED PATIENT SUMMARY\n`;
      summary += `  ${selectedPatient.name} (${selectedPatient.hospital_number})\n`;
      summary += `  Generated: ${format(new Date(), 'dd MMM yyyy HH:mm')}\n`;
      summary += `---------------------------------------------------\n\n`;

      // Demographics
      summary += `? PATIENT DETAILS\n`;
      summary += `  Name: ${selectedPatient.name}\n`;
      summary += `  Hospital No: ${selectedPatient.hospital_number}\n\n`;

      // Admission info
      if (admissions && admissions.length > 0) {
        const activeAdmission = admissions.find((a: any) => a.status === 'active') || admissions[admissions.length - 1];
        summary += `? ADMISSION\n`;
        summary += `  Date: ${safeFormatDate((activeAdmission as any).admission_date, 'dd MMM yyyy') || 'N/A'}\n`;
        summary += `  Ward: ${(activeAdmission as any).ward_location || 'N/A'}\n`;
        summary += `  Diagnosis: ${(activeAdmission as any).provisional_diagnosis || (activeAdmission as any).admitting_diagnosis || 'N/A'}\n\n`;
      }

      // Latest vitals
      if (latestRound) {
        summary += `? LATEST VITALS (${safeFormatDate(latestRound.round_date, 'dd MMM yyyy')})\n`;
        if (latestRound.temperature) summary += `  Temperature: ${latestRound.temperature}�C\n`;
        if (latestRound.pulse) summary += `  Pulse: ${latestRound.pulse} bpm\n`;
        if (latestRound.bp_systolic || latestRound.blood_pressure) summary += `  BP: ${latestRound.bp_systolic ? `${latestRound.bp_systolic}/${latestRound.bp_diastolic}` : latestRound.blood_pressure} mmHg\n`;
        if (latestRound.respiratory_rate) summary += `  RR: ${latestRound.respiratory_rate}/min\n`;
        if (latestRound.spo2) summary += `  SpO2: ${latestRound.spo2}%\n`;
        if (latestRound.pain_score > 0) summary += `  Pain Score: ${latestRound.pain_score}/10\n`;
        summary += `  Status: ${latestRound.progress_status?.toUpperCase()}\n\n`;
      }

      // Ward Round History
      summary += `? WARD ROUND HISTORY (${sortedRounds.length} entries)\n`;
      sortedRounds.forEach((r: any) => {
        summary += `  ${safeFormatDate(r.round_date, 'dd/MM/yyyy')} - ${roundTypeLabel(r.round_type)} | ${r.progress_status} | ${r.reviewing_doctor || r.reviewed_by || 'N/A'}\n`;
        if (r.chief_complaint) summary += `    Complaint: ${r.chief_complaint}\n`;
        if (r.clinical_notes) summary += `    Notes: ${r.clinical_notes}\n`;
        if (r.assessment_notes) summary += `    Assessment: ${r.assessment_notes}\n`;
        if (r.wound_status || r.wound_notes) summary += `    Wound: ${r.wound_status || ''} ${r.wound_notes || ''}\n`;
        if (r.complications) summary += `    ? Complications: ${r.complications}\n`;
        if (r.follow_up_plan) summary += `    Plan: ${r.follow_up_plan}\n`;
      });
      summary += '\n';

      // Lab Work
      if (labInvestigations && labInvestigations.length > 0) {
        summary += `? LABORATORY INVESTIGATIONS (${labInvestigations.length})\n`;
        labInvestigations.forEach((lab: any) => {
          summary += `  ${safeFormatDate(lab.ordered_date || lab.created_at, 'dd/MM/yyyy')} - ${lab.test_name || lab.investigation_name || 'Unknown'} [${(lab.status || 'pending').toUpperCase()}]`;
          if (lab.result || lab.result_value) summary += ` ? ${lab.result || lab.result_value}`;
          summary += '\n';
        });
        summary += '\n';
      }

      // Medications from ward rounds
      const allMeds: string[] = [];
      sortedRounds.forEach((r: any) => {
        if (r.new_medications?.length > 0) {
          r.new_medications.forEach((m: any) => {
            allMeds.push(`${m.name} ${m.dose} ${m.frequency} (${m.route})`);
          });
        }
        if (r.medication_changes) allMeds.push(r.medication_changes);
      });
      if (prescriptions && prescriptions.length > 0) {
        prescriptions.forEach((p: any) => {
          allMeds.push(`${p.medication_name || p.drug_name || 'Unknown'} ${p.dosage || ''} ${p.frequency || ''} (${p.route || 'oral'})`);
        });
      }
      if (allMeds.length > 0) {
        summary += `? MEDICATIONS\n`;
        [...new Set(allMeds)].forEach(med => summary += `  � ${med}\n`);
        summary += '\n';
      }

      // Treatment Plans
      if (treatmentPlans && treatmentPlans.length > 0) {
        summary += `? TREATMENT PLANS\n`;
        treatmentPlans.forEach((tp: any) => {
          summary += `  ${tp.plan_name || tp.title || 'Treatment Plan'} - Status: ${tp.status || 'active'}\n`;
          if (tp.current_phase) summary += `    Phase: ${tp.current_phase}\n`;
          if (tp.description) summary += `    ${tp.description}\n`;
        });
        summary += '\n';
      }

      // Wound Care
      if (woundCareRecords && woundCareRecords.length > 0) {
        summary += `? WOUND CARE RECORDS (${woundCareRecords.length})\n`;
        woundCareRecords.forEach((w: any) => {
          summary += `  ${safeFormatDate(w.assessment_date || w.created_at, 'dd/MM/yyyy')} - ${w.wound_type || w.wound_location || 'Wound'}: ${w.wound_status || w.status || 'N/A'}\n`;
        });
        summary += '\n';
      }

      // Progress Notes
      if (progressNotes && progressNotes.length > 0) {
        summary += `? PROGRESS NOTES (${progressNotes.length})\n`;
        progressNotes.slice(-5).forEach((pn: any) => {
          summary += `  ${safeFormatDate(pn.note_date || pn.created_at, 'dd/MM/yyyy')} - ${pn.note_type || 'Note'}: ${(pn.content || pn.note || '').substring(0, 100)}${(pn.content || pn.note || '').length > 100 ? '...' : ''}\n`;
        });
        summary += '\n';
      }

      // Current Plan
      if (latestRound) {
        summary += `? CURRENT PLAN\n`;
        if (latestRound.follow_up_plan) summary += `  Follow-up: ${latestRound.follow_up_plan}\n`;
        if (latestRound.treatment_plan_changes) summary += `  Treatment changes: ${latestRound.treatment_plan_changes}\n`;
        if (latestRound.dietary_modifications) summary += `  Diet: ${latestRound.dietary_modifications}\n`;
        if (latestRound.activity_orders) summary += `  Activity: ${latestRound.activity_orders}\n`;
        if (latestRound.nursing_instructions) summary += `  Nursing: ${latestRound.nursing_instructions}\n`;
        if (latestRound.discharge_planning) summary += `  Discharge: ${latestRound.discharge_planning}\n`;
        if (latestRound.next_review_date) summary += `  Next Review: ${safeFormatDate(latestRound.next_review_date, 'dd MMM yyyy')}\n`;
        summary += '\n';
      }

      summary += `---------------------------------------------------\n`;
      summary += `  END OF HARMONISED SUMMARY\n`;
      summary += `---------------------------------------------------\n`;

      setHarmonisedSummary(summary);
      setShowHarmonisedSummary(true);
    } catch (error) {
      console.error('Error generating harmonised summary:', error);
      alert('Failed to generate harmonised summary');
    } finally {
      setGeneratingSummary(false);
    }
  };

  const toggleExpand = (id: string) => {
    setExpandedRoundIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const expandAll = () => {
    setExpandedRoundIds(new Set(patientRounds.map(r => r.id || '')));
  };
  const collapseAll = () => setExpandedRoundIds(new Set());

  // Patients who have at least one ward round
  const patientsWithRounds = useMemo(() => {
    const patientIds = new Set(rounds.map(r => r.patient_id));
    return patients.filter(p => patientIds.has(p.id));
  }, [patients, rounds]);

  // Filtered patient list for sidebar search
  const filteredPatientList = useMemo(() => {
    if (!patientSearch) return patientsWithRounds;
    const s = patientSearch.toLowerCase();
    return patientsWithRounds.filter(p =>
      p.name.toLowerCase().includes(s) || p.hospital_number.toLowerCase().includes(s)
    );
  }, [patientsWithRounds, patientSearch]);

  const selectedPatient = patients.find(p => p.id === selectedPatientId);

  // Rounds for the selected patient, filtered by date range
  const patientRounds = useMemo(() => {
    if (!selectedPatientId) return [];
    let pr = rounds.filter(r => r.patient_id === selectedPatientId);

    if (dateFrom) {
      const from = startOfDay(new Date(dateFrom));
      pr = pr.filter(r => {
        try { return new Date(r.round_date) >= from; } catch { return true; }
      });
    }
    if (dateTo) {
      const to = endOfDay(new Date(dateTo));
      pr = pr.filter(r => {
        try { return new Date(r.round_date) <= to; } catch { return true; }
      });
    }

    return pr.sort((a, b) => new Date(b.round_date).getTime() - new Date(a.round_date).getTime());
  }, [selectedPatientId, rounds, dateFrom, dateTo]);

  // Filtered rounds for the main list view (when no patient selected)
  const getFilteredRounds = () => {
    let filtered = rounds;
    if (filterStatus !== 'all') {
      filtered = filtered.filter(r => r.progress_status === filterStatus);
    }
    const now = new Date(); now.setHours(0, 0, 0, 0);
    if (filterDate !== 'all') {
      filtered = filtered.filter(r => {
        const d = new Date(r.round_date); d.setHours(0, 0, 0, 0);
        const diff = Math.round((now.getTime() - d.getTime()) / 86400000);
        if (filterDate === 'today') return diff === 0;
        if (filterDate === 'week') return diff >= 0 && diff <= 7;
        if (filterDate === 'month') return diff >= 0 && diff <= 30;
        return true;
      });
    }
    if (searchTerm) {
      const s = searchTerm.toLowerCase();
      filtered = filtered.filter(r => {
        const p = patients.find(x => x.id === r.patient_id);
        return (p?.name || '').toLowerCase().includes(s) ||
               (p?.hospital_number || '').toLowerCase().includes(s) ||
               (r.chief_complaint || '').toLowerCase().includes(s);
      });
    }
    return filtered.sort((a, b) => new Date(b.round_date).getTime() - new Date(a.round_date).getTime());
  };

  const statusColor = (s: string) => {
    switch (s) {
      case 'stable': return 'bg-green-100 text-green-800 border-green-300';
      case 'improved': return 'bg-blue-100 text-blue-800 border-blue-300';
      case 'deteriorating': return 'bg-yellow-100 text-yellow-800 border-yellow-300';
      case 'critical': return 'bg-red-100 text-red-800 border-red-300';
      default: return 'bg-gray-100 text-gray-800 border-gray-300';
    }
  };

  const roundTypeLabel = (t: string) => ROUND_TYPES.find(rt => rt.value === t)?.label || t;

  const getStats = () => {
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const todayRounds = rounds.filter(r => {
      const d = new Date(r.round_date); d.setHours(0, 0, 0, 0);
      return d.getTime() === today.getTime();
    });
    return {
      total: rounds.length,
      today: todayRounds.length,
      stable: rounds.filter(r => r.progress_status === 'stable').length,
      critical: rounds.filter(r => r.progress_status === 'critical').length,
      deteriorating: rounds.filter(r => r.progress_status === 'deteriorating').length
    };
  };

  const stats = getStats();
  const filteredRounds = getFilteredRounds();

  if (showForm) {
    return (
      <WardRoundForm
        patientId={selectedRound?.patient_id || selectedPatientId || undefined}
        wardRoundId={selectedRound?.id}
        onClose={handleCloseForm}
        onSave={handleCloseForm}
      />
    );
  }

  //  DOCUMENTATION PREVIEW for selected patient 
  if (selectedPatientId && selectedPatient) {
    return (
      <div className="space-y-4">
        {/* Back button + patient header */}
        <div className="flex flex-col sm:flex-row sm:items-center gap-3 bg-white rounded-lg shadow p-4">
          <button onClick={() => { setSelectedPatientId(null); setExpandedRoundIds(new Set()); }} className="flex items-center gap-2 text-green-700 hover:text-green-900 font-medium">
            <ArrowLeft className="w-5 h-5" /> Back to All Rounds
          </button>
          <div className="flex-1 min-w-0">
            <h2 className="text-lg font-bold text-gray-900 truncate">{selectedPatient.name}</h2>
            <p className="text-sm text-gray-500">{selectedPatient.hospital_number}</p>
          </div>
          <button onClick={() => { setSelectedRound(null); setShowForm(true); }} className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm">
            <Plus className="w-4 h-4" /> New Round for Patient
          </button>
          <button 
            onClick={generateHarmonisedSummary} 
            disabled={generatingSummary}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 text-sm disabled:opacity-50"
          >
            <FileBarChart className="w-4 h-4" /> {generatingSummary ? 'Generating...' : 'Harmonised Summary'}
          </button>
        </div>

        {/* Date range filter */}
        <div className="bg-white rounded-lg shadow p-4">
          <div className="flex flex-col sm:flex-row sm:items-end gap-3">
            <div className="flex-1">
              <label className="block text-xs font-medium text-gray-600 mb-1">From Date</label>
              <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className="w-full p-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-green-500" title="From date" />
            </div>
            <div className="flex-1">
              <label className="block text-xs font-medium text-gray-600 mb-1">To Date</label>
              <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className="w-full p-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-green-500" title="To date" />
            </div>
            <button onClick={() => { setDateFrom(''); setDateTo(''); }} className="px-3 py-2 text-sm text-gray-600 border border-gray-300 rounded-md hover:bg-gray-50">Clear</button>
            <div className="flex gap-2">
              <button onClick={expandAll} className="px-3 py-2 text-sm text-green-700 border border-green-300 rounded-md hover:bg-green-50">Expand All</button>
              <button onClick={collapseAll} className="px-3 py-2 text-sm text-gray-600 border border-gray-300 rounded-md hover:bg-gray-50">Collapse All</button>
            </div>
          </div>
          <p className="mt-2 text-xs text-gray-500">{patientRounds.length} round{patientRounds.length !== 1 ? 's' : ''} found{dateFrom || dateTo ? ' in selected range' : ''}</p>
        </div>

        {/* Documentation entries */}
        {patientRounds.length === 0 ? (
          <div className="bg-white rounded-lg shadow p-8 text-center text-gray-500">
            <Activity className="w-12 h-12 mx-auto mb-3 text-gray-300" />
            <p className="font-medium">No ward round documentation found</p>
            <p className="text-sm mt-1">{dateFrom || dateTo ? 'Try adjusting the date range' : 'No ward rounds recorded for this patient yet'}</p>
          </div>
        ) : (
          <div className="space-y-3">
            {patientRounds.map(round => {
              const isExpanded = expandedRoundIds.has(round.id || '');
              const r = round as any;
              return (
                <div key={round.id} className={`bg-white rounded-lg shadow overflow-hidden border-l-4 ${
                  round.progress_status === 'critical' ? 'border-red-500' :
                  round.progress_status === 'deteriorating' ? 'border-yellow-500' :
                  round.progress_status === 'improved' ? 'border-blue-500' : 'border-green-500'
                }`}>
                  {/* Round header - always visible */}
                  <div className="p-4 cursor-pointer hover:bg-gray-50" onClick={() => toggleExpand(round.id || '')}>
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-2 mb-1">
                          <span className="font-semibold text-gray-900">{safeFormatDate(round.round_date, 'EEE, MMM dd yyyy')}</span>
                          <span className="text-sm text-gray-500">{r.round_time || ''}</span>
                          <span className={`px-2 py-0.5 text-xs font-medium rounded-full border ${statusColor(round.progress_status)}`}>
                            {round.progress_status?.charAt(0).toUpperCase() + round.progress_status?.slice(1)}
                          </span>
                          <span className="px-2 py-0.5 text-xs bg-purple-50 text-purple-700 rounded-full">{roundTypeLabel(round.round_type)}</span>
                        </div>
                        <div className="flex flex-wrap items-center gap-3 text-xs text-gray-500">
                          <span className="flex items-center gap-1"><User className="w-3 h-3" />{round.reviewing_doctor || round.reviewed_by || 'N/A'}</span>
                          <span className="flex items-center gap-1"><FileText className="w-3 h-3" />{round.chief_complaint || 'No complaint recorded'}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <button onClick={e => { e.stopPropagation(); handleEditRound(round); }} className="text-xs text-green-600 hover:text-green-800 px-2 py-1 border border-green-200 rounded">Edit</button>
                        <button onClick={e => { e.stopPropagation(); handleDeleteRound(round.id!); }} className="text-xs text-red-600 hover:text-red-800 px-2 py-1 border border-red-200 rounded">Delete</button>
                        {isExpanded ? <ChevronUp className="w-5 h-5 text-gray-400" /> : <ChevronDown className="w-5 h-5 text-gray-400" />}
                      </div>
                    </div>
                  </div>

                  {/* Expanded documentation preview */}
                  {isExpanded && (
                    <div className="border-t border-gray-100 px-4 pb-3">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mt-3">

                        {/* Vitals - single-line compact */}
                        {(r.temperature || r.pulse || r.bp_systolic || r.blood_pressure || r.respiratory_rate || r.spo2) && (
                          <div className="bg-blue-50 rounded p-2">
                            <h4 className="text-xs font-semibold text-blue-800 mb-1 flex items-center gap-1"><Thermometer className="w-3 h-3" /> Vitals</h4>
                            <p className="text-xs leading-snug">
                              {[r.temperature && `T: ${r.temperature}�C`, r.pulse && `PR: ${r.pulse}/min`, (r.bp_systolic || r.blood_pressure) && `BP: ${r.bp_systolic ? `${r.bp_systolic}/${r.bp_diastolic}` : r.blood_pressure} mmHg`, r.respiratory_rate && `RR: ${r.respiratory_rate}/min`, r.spo2 && `SpO2: ${r.spo2}%`, r.pain_score > 0 && `Pain: ${r.pain_score}/10`].filter(Boolean).join(' | ')}
                            </p>
                          </div>
                        )}

                        {/* Subjective */}
                        {(r.subjective_complaints || r.sleep_quality || r.appetite || r.bowel_movement) && (
                          <div className="bg-green-50 rounded p-2">
                            <h4 className="text-xs font-semibold text-green-800 mb-1 flex items-center gap-1"><User className="w-3 h-3" /> Subjective</h4>
                            <div className="text-xs leading-snug">
                              {r.subjective_complaints && <p className="mb-0.5"><span className="text-gray-500">Complaints:</span> {r.subjective_complaints}</p>}
                              {r.sleep_quality && r.sleep_quality !== 'good' && <span className="text-gray-500">Sleep: {r.sleep_quality} </span>}
                              {r.appetite && r.appetite !== 'good' && <span className="text-gray-500">Appetite: {r.appetite} </span>}
                              {r.bowel_movement && r.bowel_movement !== 'normal' && <span className="text-gray-500">Bowel: {r.bowel_movement}</span>}
                            </div>
                          </div>
                        )}

                        {/* Clinical Notes */}
                        {(round.clinical_notes || round.examination_findings) && (
                          <div className="bg-purple-50 rounded p-2">
                            <h4 className="text-xs font-semibold text-purple-800 mb-1 flex items-center gap-1"><Stethoscope className="w-3 h-3" /> Clinical Assessment</h4>
                            <div className="text-xs leading-snug">
                              {round.clinical_notes && <p className="mb-0.5"><span className="text-gray-500 font-medium">Notes:</span> {round.clinical_notes}</p>}
                              {round.examination_findings && <p className="mb-0.5"><span className="text-gray-500 font-medium">Examination:</span> {round.examination_findings}</p>}
                              {r.general_appearance && <p className="mb-0.5"><span className="text-gray-500 font-medium">Appearance:</span> {r.general_appearance}</p>}
                              {r.clinical_impression && <p><span className="text-gray-500 font-medium">Impression:</span> {r.clinical_impression}</p>}
                            </div>
                          </div>
                        )}

                        {/* Wound / Drain */}
                        {(r.wound_status || r.wound_notes || r.drain_output) && (
                          <div className="bg-orange-50 rounded p-2">
                            <h4 className="text-xs font-semibold text-orange-800 mb-1 flex items-center gap-1"><Eye className="w-3 h-3" /> Wound / Drain</h4>
                            <p className="text-xs leading-snug">
                              {[r.wound_status && `Status: ${r.wound_status}`, round.wound_notes && `Notes: ${round.wound_notes}`, r.drain_output && `Drain output: ${r.drain_output}`].filter(Boolean).join(' | ')}
                            </p>
                          </div>
                        )}
                      </div>

                      {/* Full width sections */}
                      <div className="space-y-2 mt-2">
                        {/* Assessment Notes */}
                        {round.assessment_notes && (
                          <div className="bg-gray-50 rounded p-2">
                            <h4 className="text-xs font-semibold text-gray-700 mb-0.5">Assessment</h4>
                            <p className="text-xs text-gray-600 leading-snug">{round.assessment_notes}</p>
                          </div>
                        )}

                        {/* Complications */}
                        {round.complications && (
                          <div className="bg-red-50 rounded p-2">
                            <h4 className="text-xs font-semibold text-red-700 mb-0.5 flex items-center gap-1"><AlertCircle className="w-3 h-3" /> Complications</h4>
                            <p className="text-xs text-red-600 leading-snug">{round.complications}</p>
                          </div>
                        )}

                        {/* Medications */}
                        {(round.medication_changes || r.new_medications?.length > 0 || r.stop_medications?.length > 0) && (
                          <div className="bg-indigo-50 rounded p-2">
                            <h4 className="text-xs font-semibold text-indigo-800 mb-0.5 flex items-center gap-1"><Pill className="w-3 h-3" /> Medication Changes</h4>
                            <div className="text-xs leading-snug">
                              {round.medication_changes && <p>{round.medication_changes}</p>}
                              {r.new_medications?.length > 0 && (
                                <div><span className="text-gray-500 font-medium">New:</span>
                                  <ul className="list-disc ml-4">{r.new_medications.map((m: any, i: number) => <li key={i}>{m.name} {m.dose} {m.frequency} ({m.route})</li>)}</ul>
                                </div>
                              )}
                              {r.stop_medications?.length > 0 && (
                                <div><span className="text-red-600 font-medium">Stopped:</span> {r.stop_medications.join(', ')}</div>
                              )}
                            </div>
                          </div>
                        )}

                        {/* Investigations */}
                        {(round.lab_notes || r.investigations_ordered?.length > 0) && (
                          <div className="bg-teal-50 rounded p-2">
                            <h4 className="text-xs font-semibold text-teal-800 mb-0.5 flex items-center gap-1"><TestTube className="w-3 h-3" /> Investigations</h4>
                            <div className="text-xs leading-snug">
                              {round.lab_notes && <p>{round.lab_notes}</p>}
                              {r.investigations_ordered?.length > 0 && <p><span className="text-gray-500 font-medium">Ordered:</span> {r.investigations_ordered.join(', ')}</p>}
                            </div>
                          </div>
                        )}

                        {/* Plan */}
                        {(round.follow_up_plan || round.plan_changes?.length > 0 || round.discharge_planning || r.treatment_plan_changes || r.dietary_modifications || r.activity_orders || r.nursing_instructions) && (
                          <div className="bg-emerald-50 rounded p-2">
                            <h4 className="text-xs font-semibold text-emerald-800 mb-0.5 flex items-center gap-1"><ClipboardList className="w-3 h-3" /> Plan</h4>
                            <div className="text-xs leading-snug">
                              {round.follow_up_plan && <p><span className="text-gray-500 font-medium">Follow-up:</span> {round.follow_up_plan}</p>}
                              {round.plan_changes?.length > 0 && <p><span className="text-gray-500 font-medium">Plan changes:</span> {round.plan_changes.join('; ')}</p>}
                              {r.treatment_plan_changes && <p><span className="text-gray-500 font-medium">Treatment plan:</span> {r.treatment_plan_changes}</p>}
                              {r.dietary_modifications && <p><span className="text-gray-500 font-medium">Diet:</span> {r.dietary_modifications}</p>}
                              {r.activity_orders && <p><span className="text-gray-500 font-medium">Activity:</span> {r.activity_orders}</p>}
                              {r.nursing_instructions && <p><span className="text-gray-500 font-medium">Nursing:</span> {r.nursing_instructions}</p>}
                              {round.discharge_planning && <p><span className="text-gray-500 font-medium">Discharge plan:</span> {round.discharge_planning}</p>}
                              {round.next_review_date && <p><span className="text-gray-500 font-medium">Next review:</span> {safeFormatDate(round.next_review_date, 'MMM dd, yyyy')}</p>}
                            </div>
                          </div>
                        )}

                        {/* Consultation */}
                        {round.consultation_requested && (
                          <div className="bg-pink-50 rounded p-2">
                            <h4 className="text-xs font-semibold text-pink-800 mb-0.5">Consultation Requested</h4>
                            <p className="text-xs">{round.consultation_specialty}{round.consultation_reason ? `  ${round.consultation_reason}` : ''}</p>
                          </div>
                        )}

                        {/* LMP */}
                        {r.lmp && (
                          <div className="text-xs text-gray-500 mt-1">LMP: {r.lmp}</div>
                        )}

                        {/* Clinical Images */}
                        {round.clinical_images && round.clinical_images.length > 0 && (
                          <div className="bg-gray-50 rounded p-2">
                            <h4 className="text-xs font-semibold text-gray-700 mb-1">Clinical Images ({round.clinical_images.length})</h4>
                            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2">
                              {round.clinical_images.map((img, i) => (
                                <div key={img.id || i} className="relative">
                                  <img src={img.data} alt={img.caption || img.type} className="w-full h-20 object-cover rounded" />
                                  {img.caption && <p className="text-[10px] text-gray-500 truncate mt-0.5">{img.caption}</p>}
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* OCR text */}
                        {r.ocr_extracted_text && (
                          <div className="bg-yellow-50 rounded p-2">
                            <h4 className="text-xs font-semibold text-yellow-800 mb-0.5">Extracted Text (OCR)</h4>
                            <p className="text-xs leading-snug">{r.ocr_extracted_text}</p>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Harmonised Summary Modal */}
        {showHarmonisedSummary && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-0 sm:p-4">
            <div className="bg-white rounded-none sm:rounded-lg shadow-xl w-full sm:max-w-4xl h-full sm:h-auto sm:max-h-[90vh] overflow-hidden flex flex-col">
              <div className="bg-indigo-600 text-white px-3 sm:px-6 py-3 sm:py-4 flex justify-between items-start sm:items-center flex-shrink-0">
                <div className="min-w-0 flex-1">
                  <h2 className="text-lg sm:text-xl font-bold flex items-center gap-2 truncate">
                    <FileBarChart className="w-5 h-5 sm:w-6 sm:h-6 flex-shrink-0" /> Harmonised Patient Summary
                  </h2>
                  <p className="text-indigo-200 text-xs sm:text-sm truncate">{selectedPatient?.name} • {selectedPatient?.hospital_number}</p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(harmonisedSummary);
                      alert('Summary copied to clipboard!');
                    }}
                    className="px-3 py-1.5 bg-white bg-opacity-20 hover:bg-opacity-30 rounded text-sm"
                  >
                    Copy
                  </button>
                  <button onClick={() => setShowHarmonisedSummary(false)} className="text-white hover:text-gray-200">
                    <X className="w-6 h-6" />
                  </button>
                </div>
              </div>
              <div className="p-3 sm:p-6 overflow-y-auto flex-1 min-h-0 scroll-touch">
                <pre className="whitespace-pre-wrap font-mono text-xs sm:text-sm text-gray-800 bg-gray-50 p-3 sm:p-4 rounded-lg border">{harmonisedSummary}</pre>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  //  MAIN LIST VIEW (default) 
  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Activity className="w-6 h-6 sm:w-8 sm:h-8 text-green-600 flex-shrink-0" />
            Ward Rounds
          </h1>
          <p className="text-sm sm:text-base text-gray-600 mt-1">Daily patient reviews and clinical updates</p>
        </div>
        <button onClick={handleCreateRound} className="flex items-center justify-center gap-2 px-4 py-2.5 bg-green-600 text-white rounded-lg hover:bg-green-700 w-full sm:w-auto">
          <Plus className="w-5 h-5" /> New Ward Round
        </button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3 sm:gap-4">
        <div className="bg-white rounded-lg shadow p-3 sm:p-4">
          <div className="flex items-center justify-between">
            <div><p className="text-xs sm:text-sm text-gray-600">Total Rounds</p><p className="text-xl sm:text-2xl font-bold text-gray-900">{stats.total}</p></div>
            <Activity className="w-6 h-6 sm:w-8 sm:h-8 text-blue-600" />
          </div>
        </div>
        <div className="bg-white rounded-lg shadow p-3 sm:p-4">
          <div className="flex items-center justify-between">
            <div><p className="text-xs sm:text-sm text-gray-600">Today</p><p className="text-xl sm:text-2xl font-bold text-green-600">{stats.today}</p></div>
            <Clock className="w-6 h-6 sm:w-8 sm:h-8 text-green-600" />
          </div>
        </div>
        <div className="bg-white rounded-lg shadow p-3 sm:p-4">
          <div className="flex items-center justify-between">
            <div><p className="text-xs sm:text-sm text-gray-600">Stable</p><p className="text-xl sm:text-2xl font-bold text-green-600">{stats.stable}</p></div>
            <TrendingUp className="w-6 h-6 sm:w-8 sm:h-8 text-green-600" />
          </div>
        </div>
        <div className="bg-white rounded-lg shadow p-3 sm:p-4">
          <div className="flex items-center justify-between">
            <div><p className="text-xs sm:text-sm text-gray-600">Deteriorating</p><p className="text-xl sm:text-2xl font-bold text-yellow-600">{stats.deteriorating}</p></div>
            <AlertCircle className="w-6 h-6 sm:w-8 sm:h-8 text-yellow-600" />
          </div>
        </div>
        <div className="bg-white rounded-lg shadow p-3 sm:p-4 col-span-2 sm:col-span-1">
          <div className="flex items-center justify-between">
            <div><p className="text-xs sm:text-sm text-gray-600">Critical</p><p className="text-xl sm:text-2xl font-bold text-red-600">{stats.critical}</p></div>
            <AlertCircle className="w-6 h-6 sm:w-8 sm:h-8 text-red-600" />
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg shadow p-3 sm:p-4">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input type="text" placeholder="Search patients..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="form-input pl-10" />
          </div>
          <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value as any)} className="form-select" title="Filter by status">
            <option value="all">All Status</option>
            <option value="improved">Improved</option>
            <option value="stable">Stable</option>
            <option value="deteriorating">Deteriorating</option>
            <option value="critical">Critical</option>
          </select>
          <select value={filterDate} onChange={(e) => setFilterDate(e.target.value as any)} className="form-select" title="Filter by date range">
            <option value="today">Today</option>
            <option value="week">This Week</option>
            <option value="month">This Month</option>
            <option value="all">All Time</option>
          </select>
        </div>
      </div>

      {/* Patient Quick Select Bar */}
      {patientsWithRounds.length > 0 && (
        <div className="bg-white rounded-lg shadow p-3 sm:p-4">
          <h3 className="text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
            <User className="w-4 h-4" /> Select Patient for Documentation Preview
          </h3>
          <div className="relative mb-3">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search patients with ward rounds..."
              value={patientSearch}
              onChange={e => setPatientSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-2 border border-gray-200 rounded-md text-sm focus:ring-2 focus:ring-green-500"
            />
          </div>
          <div className="flex flex-wrap gap-2 max-h-32 overflow-y-auto">
            {filteredPatientList.map(p => {
              const count = rounds.filter(r => r.patient_id === p.id).length;
              return (
                <button
                  key={p.id}
                  onClick={() => { setSelectedPatientId(p.id); setExpandedRoundIds(new Set()); }}
                  className="flex items-center gap-2 px-3 py-1.5 bg-gray-50 hover:bg-green-50 border border-gray-200 hover:border-green-400 rounded-full text-sm transition-colors"
                >
                  <span className="font-medium text-gray-800 truncate max-w-[120px] sm:max-w-[200px]">{p.name}</span>
                  <span className="text-xs text-gray-400">{p.hospital_number}</span>
                  <span className="bg-green-100 text-green-700 text-xs font-medium px-1.5 py-0.5 rounded-full">{count}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Ward Rounds List */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        {loading ? (
          <div className="p-6 sm:p-8 text-center text-gray-500">Loading ward rounds...</div>
        ) : filteredRounds.length === 0 ? (
          <div className="p-6 sm:p-8 text-center text-gray-500">
            <Activity className="w-10 h-10 sm:w-12 sm:h-12 mx-auto mb-4 text-gray-400" />
            <p className="text-base sm:text-lg font-medium">No ward rounds found</p>
            <p className="text-sm mt-2">Create your first ward round entry to get started</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-200">
            {filteredRounds.map((round) => {
              const patient = patients.find(p => p.id === round.patient_id);
              return (
                <div
                  key={round.id}
                  className="p-3 sm:p-4 hover:bg-gray-50 cursor-pointer active:bg-gray-100"
                  onClick={() => handleEditRound(round)}
                >
                  <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2 sm:gap-3 mb-2">
                        <h3 className="font-semibold text-gray-900 truncate">{patient?.name || 'Unknown Patient'}</h3>
                        <span className="text-xs sm:text-sm text-gray-500">{patient?.hospital_number}</span>
                        <span className={`px-2 py-0.5 text-xs font-medium rounded-full border ${statusColor(round.progress_status)}`}>
                          {round.progress_status?.charAt(0).toUpperCase() + round.progress_status?.slice(1)}
                        </span>
                        <span className="px-2 py-0.5 text-xs bg-purple-50 text-purple-700 rounded-full">{roundTypeLabel(round.round_type)}</span>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-1 sm:gap-2 text-xs sm:text-sm text-gray-600">
                        <div className="flex items-center gap-2">
                          <Calendar className="w-3 h-3 sm:w-4 sm:h-4 flex-shrink-0" />
                          <span className="truncate">{safeFormatDate(round.round_date, 'MMM dd, yyyy')}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <User className="w-3 h-3 sm:w-4 sm:h-4 flex-shrink-0" />
                          <span className="truncate">{round.reviewing_doctor || round.reviewed_by}</span>
                        </div>
                        <div className="flex items-center gap-2 sm:col-span-2">
                          <FileText className="w-3 h-3 sm:w-4 sm:h-4 flex-shrink-0" />
                          <span className="truncate">{round.chief_complaint}</span>
                        </div>
                      </div>
                      {round.assessment_notes && (
                        <p className="mt-2 text-xs sm:text-sm text-gray-700 line-clamp-2">{round.assessment_notes}</p>
                      )}
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <button
                        onClick={(e) => { e.stopPropagation(); setSelectedPatientId(round.patient_id); setExpandedRoundIds(new Set([round.id || ''])); }}
                        className="text-green-600 hover:text-green-800 text-sm px-3 py-1.5 border border-green-200 rounded-lg"
                      >
                        Preview
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); handleDeleteRound(round.id!); }}
                        className="text-red-600 hover:text-red-800 text-sm px-3 py-1.5 border border-red-200 rounded-lg"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

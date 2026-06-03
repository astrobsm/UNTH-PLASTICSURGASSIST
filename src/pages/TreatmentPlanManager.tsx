import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  User, Search, ChevronRight, ChevronDown, AlertTriangle, CheckCircle, Clock,
  Calendar, Pill, Activity, FileText, Heart, Shield, Apple, Printer, Download,
  Bell, X, Edit3, Eye, BarChart3, AlertCircle, Loader2, RefreshCw, Plus, Trash2
} from 'lucide-react';
import { format, isPast, differenceInDays, addDays } from 'date-fns';
import { useAuthStore } from '../store/authStore';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { db } from '../db/database';
import { apiClient } from '../services/apiClient';
import { treatmentPlanningService } from '../services/treatmentPlanningService';
import { medicalTeamService } from '../services/medicalTeamService';
import toast from 'react-hot-toast';

// ─── WHO DISCHARGE CRITERIA (shared) ─────────────────────────────────────────
const WHO_DISCHARGE_CRITERIA = [
  { id: 'vital_signs', label: 'Vital signs stable for ≥ 24 hours', category: 'Clinical' },
  { id: 'afebrile', label: 'Afebrile (temp < 37.5°C) for ≥ 24 hours', category: 'Clinical' },
  { id: 'pain_control', label: 'Pain controlled on oral medications', category: 'Clinical' },
  { id: 'oral_intake', label: 'Tolerating oral intake and fluids', category: 'Clinical' },
  { id: 'wound_healing', label: 'Wound clean and healing satisfactorily', category: 'Surgical' },
  { id: 'drain_removed', label: 'Drains removed or output minimal', category: 'Surgical' },
  { id: 'mobility', label: 'Adequate mobility for home care', category: 'Functional' },
  { id: 'self_care', label: 'Able to perform basic self-care or has caregiver', category: 'Functional' },
  { id: 'meds_arranged', label: 'Discharge medications prescribed and understood', category: 'Discharge' },
  { id: 'follow_up', label: 'Follow-up appointment arranged', category: 'Discharge' },
  { id: 'wound_care_education', label: 'Wound care instructions given and understood', category: 'Discharge' },
  { id: 'dvt_prophylaxis', label: 'DVT prophylaxis plan arranged if needed', category: 'Discharge' },
  { id: 'social_support', label: 'Social support at home confirmed', category: 'Social' },
  { id: 'transport', label: 'Transport to home arranged', category: 'Social' },
];

const TreatmentPlanManager: React.FC = () => {
  const { user } = useAuthStore();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const preselectedPatientId = searchParams.get('patientId');

  const [plans, setPlans] = useState<any[]>([]);
  const [patients, setPatients] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedPlan, setSelectedPlan] = useState<any>(null);
  const [activeTab, setActiveTab] = useState<'overview' | 'medications' | 'investigations' | 'procedures' | 'compliance' | 'discharge'>('overview');
  const [staffLists, setStaffLists] = useState<{ sr: any[]; reg: any[]; ho: any[] }>({ sr: [], reg: [], ho: [] });
  const [editingTeam, setEditingTeam] = useState(false);
  const [updatedTeam, setUpdatedTeam] = useState({ sr: '', reg: '', ho: '' });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    if (preselectedPatientId && plans.length > 0) {
      const patientPlan = plans.find(p => String(p.patient_id) === preselectedPatientId);
      if (patientPlan) {
        setSelectedPlan(patientPlan);
      } else {
        // No existing plan for this patient — jump straight to the Creator
        navigate(`/treatment-plan-creator?patientId=${preselectedPatientId}`, { replace: true });
      }
    }
  }, [preselectedPatientId, plans]);

  const loadData = async () => {
    setLoading(true);
    try {
      // Load patients
      const localPatients = await db.patients.toArray();
      setPatients(localPatients);

      // Load all treatment plans
      const localPlans = await db.treatment_plans.toArray();
      let serverPlans: any[] = [];
      if (navigator.onLine) {
        try {
          const resp = await apiClient.get('/treatment-plans');
          serverPlans = resp?.plans || resp?.treatmentPlans || [];
        } catch { /* offline fallback */ }
      }

      // Merge, preferring server data
      const merged = new Map<string, any>();
      localPlans.forEach(p => merged.set(String(p.id), p));
      serverPlans.forEach(p => merged.set(String(p.id), p));
      const allPlans = Array.from(merged.values()).sort((a, b) =>
        new Date(b.updated_at || b.created_at || 0).getTime() - new Date(a.updated_at || a.created_at || 0).getTime()
      );
      setPlans(allPlans);

      // Load staff
      const [sr, reg, ho] = await Promise.all([
        medicalTeamService.getStaffByRole('senior_registrar').catch(() => []),
        medicalTeamService.getStaffByRole('registrar').catch(() => []),
        medicalTeamService.getStaffByRole('house_officer').catch(() => [])
      ]);
      setStaffLists({ sr, reg, ho });
    } catch (err) {
      console.error('Load error:', err);
    }
    setLoading(false);
  };

  // ── HELPERS ────────────────────────────────────────────────────────────────
  const parseJSON = (val: any) => {
    if (!val) return [];
    if (Array.isArray(val)) return val;
    if (typeof val === 'string') { try { return JSON.parse(val); } catch { return []; } }
    if (typeof val === 'object') return [val];
    return [];
  };

  const parseObj = (val: any) => {
    if (!val) return null;
    if (typeof val === 'object' && !Array.isArray(val)) return val;
    if (typeof val === 'string') { try { return JSON.parse(val); } catch { return null; } }
    return null;
  };

  const getPatientName = (plan: any) => plan.patient_name || patients.find(p => String(p.id) === String(plan.patient_id))?.full_name || 'Unknown';

  const filteredPlans = useMemo(() => {
    if (!searchQuery.trim()) return plans;
    const q = searchQuery.toLowerCase();
    return plans.filter(p => {
      const name = getPatientName(p).toLowerCase();
      const diag = (p.diagnosis || p.title || '').toLowerCase();
      const hn = (p.hospital_number || '').toLowerCase();
      return name.includes(q) || diag.includes(q) || hn.includes(q);
    });
  }, [searchQuery, plans, patients]);

  const getComplianceStats = useCallback((plan: any) => {
    const meds = parseJSON(plan.planned_medications || plan.medications);
    const invs = parseJSON(plan.planned_investigations || plan.investigations);
    const procs = parseJSON(plan.planned_procedures || plan.procedures);
    const reviews = parseJSON(plan.planned_reviews || plan.reviews);

    const medsActive = meds.filter((m: any) => m.status === 'active').length;
    const medsCompleted = meds.filter((m: any) => m.status === 'completed').length;
    const invsCompleted = invs.filter((i: any) => i.status === 'completed').length;
    const procsCompleted = procs.filter((p: any) => p.status === 'completed').length;
    const totalItems = meds.length + invs.length + procs.length;
    const completedItems = medsCompleted + invsCompleted + procsCompleted;
    const compliance = totalItems > 0 ? Math.round((completedItems / totalItems) * 100) : 0;

    const pending = totalItems - completedItems;
    const overdue = [
      ...invs.filter((i: any) => i.status === 'pending' && i.ordered_date && isPast(new Date(i.ordered_date))),
      ...procs.filter((p: any) => (p.status === 'planned' || p.status === 'scheduled') && p.proposed_date && isPast(new Date(p.proposed_date))),
    ].length;

    return { compliance, totalItems, completedItems, pending, overdue, medsActive, meds: meds.length, invs: invs.length, procs: procs.length };
  }, []);

  const getDischargeStatus = (plan: any) => {
    const dp = parseObj(plan.discharge_plan);
    if (!dp) return { met: 0, total: WHO_DISCHARGE_CRITERIA.length, percent: 0, date: null };
    const met = (dp.criteria_met || []).length;
    const total = WHO_DISCHARGE_CRITERIA.length;
    return { met, total, percent: Math.round((met / total) * 100), date: dp.current_discharge_date || dp.initial_discharge_date };
  };

  const getRiskAssessments = (plan: any) => {
    const ra = parseObj(plan.risk_assessments);
    return ra || { dvt: null, pressure_sore: null, nutritional: null };
  };

  // ── UPDATE TEAM ────────────────────────────────────────────────────────────
  const saveTeamChange = async () => {
    if (!selectedPlan) return;
    setSaving(true);
    try {
      const srStaff = staffLists.sr.find(s => String(s.id) === updatedTeam.sr);
      const regStaff = staffLists.reg.find(s => String(s.id) === updatedTeam.reg);
      const hoStaff = staffLists.ho.find(s => String(s.id) === updatedTeam.ho);
      const newTeam = {
        senior_registrar: srStaff?.full_name || updatedTeam.sr,
        registrar: regStaff?.full_name || updatedTeam.reg,
        house_officer: hoStaff?.full_name || updatedTeam.ho,
        assigned_date: new Date()
      };
      await treatmentPlanningService.updateTreatmentPlan(String(selectedPlan.id), { medical_team: newTeam });
      setSelectedPlan((prev: any) => ({ ...prev, medical_team: newTeam }));
      setEditingTeam(false);
      toast.success('Medical team updated');
    } catch (err: any) {
      toast.error('Failed to update team');
    }
    setSaving(false);
  };

  // ── UPDATE ITEM STATUS ─────────────────────────────────────────────────────
  const updateItemStatus = async (field: string, itemId: string, newStatus: string) => {
    if (!selectedPlan) return;
    const items = parseJSON(selectedPlan[field]);
    const updated = items.map((item: any) => item.id === itemId ? { ...item, status: newStatus, completed_at: newStatus === 'completed' ? new Date() : undefined } : item);
    try {
      await treatmentPlanningService.updateTreatmentPlan(String(selectedPlan.id), { [field]: updated });
      setSelectedPlan((prev: any) => ({ ...prev, [field]: updated }));
      toast.success('Status updated');
      // Send notification if completed
      if (newStatus === 'completed') {
        try {
          const { notificationService } = await import('../services/notificationBackgroundService');
          const itemName = items.find((i: any) => i.id === itemId)?.name || items.find((i: any) => i.id === itemId)?.medication_name || 'Item';
          notificationService.sendNotification('Treatment Plan Update', {
            body: `${itemName} marked as completed for ${getPatientName(selectedPlan)}`,
            tag: 'treatment-plan-update'
          });
        } catch { /* optional */ }
      }
    } catch { toast.error('Failed to update'); }
  };

  // ── UPDATE DISCHARGE CRITERIA ──────────────────────────────────────────────
  const toggleDischargeCriteria = async (criteriaId: string) => {
    if (!selectedPlan) return;
    const dp = parseObj(selectedPlan.discharge_plan) || { criteria_met: [], criteria_pending: [] };
    const metLabels = dp.criteria_met || [];
    const criteriaLabel = WHO_DISCHARGE_CRITERIA.find(c => c.id === criteriaId)?.label || '';
    const isMet = metLabels.includes(criteriaLabel);
    const newMet = isMet ? metLabels.filter((l: string) => l !== criteriaLabel) : [...metLabels, criteriaLabel];
    const newPending = WHO_DISCHARGE_CRITERIA.filter(c => !newMet.includes(c.label)).map(c => c.label);
    const newDp = { ...dp, criteria_met: newMet, criteria_pending: newPending };

    try {
      await treatmentPlanningService.updateTreatmentPlan(String(selectedPlan.id), { discharge_plan: newDp });
      setSelectedPlan((prev: any) => ({ ...prev, discharge_plan: newDp }));
    } catch { toast.error('Failed to update discharge criteria'); }
  };

  // ── EXPORT PDF ─────────────────────────────────────────────────────────────
  const exportPDF = () => {
    if (!selectedPlan) return;
    const plan = selectedPlan;
    const team = parseObj(plan.medical_team);
    const meds = parseJSON(plan.planned_medications || plan.medications);
    const invs = parseJSON(plan.planned_investigations || plan.investigations);
    const procs = parseJSON(plan.planned_procedures || plan.procedures);
    const dp = parseObj(plan.discharge_plan);
    const ra = getRiskAssessments(plan);

    const printWindow = window.open('', '_blank');
    if (!printWindow) return;
    printWindow.document.write(`<!DOCTYPE html><html><head><title>Treatment Plan - ${getPatientName(plan)}</title>
<style>
  body{font-family:Arial,sans-serif;font-size:12px;margin:20px;color:#333}
  h1{font-size:18px;color:#0E9F6E;border-bottom:2px solid #0E9F6E;padding-bottom:5px}
  h2{font-size:14px;color:#333;margin-top:15px;border-bottom:1px solid #ddd;padding-bottom:3px}
  table{width:100%;border-collapse:collapse;margin:8px 0}
  th,td{border:1px solid #ddd;padding:4px 8px;text-align:left;font-size:11px}
  th{background:#f0f0f0;font-weight:bold}
  .badge{display:inline-block;padding:2px 8px;border-radius:10px;font-size:10px;font-weight:bold}
  .green{background:#dcfce7;color:#166534}.red{background:#fef2f2;color:#991b1b}
  .yellow{background:#fefce8;color:#854d0e}.blue{background:#dbeafe;color:#1e40af}
  .header{display:flex;justify-content:space-between;align-items:center}
  .grid{display:grid;grid-template-columns:1fr 1fr;gap:10px}
  @media print{body{margin:5mm}@page{size:A4;margin:10mm}}
  @media print and (max-width:80mm){body{font-size:10px;margin:2mm}h1{font-size:14px}table{font-size:9px}@page{size:80mm auto;margin:2mm}}
</style></head><body>
<h1>TREATMENT PLAN</h1>
<div class="grid">
  <div><strong>Patient:</strong> ${getPatientName(plan)}</div>
  <div><strong>Hospital Number:</strong> ${plan.hospital_number || 'N/A'}</div>
  <div><strong>Diagnosis:</strong> ${plan.diagnosis || plan.title || 'N/A'}</div>
  <div><strong>Date:</strong> ${plan.created_at ? format(new Date(plan.created_at), 'dd/MM/yyyy') : 'N/A'}</div>
  <div><strong>Created By:</strong> ${plan.created_by || 'N/A'}</div>
  <div><strong>Status:</strong> <span class="badge ${plan.status === 'active' ? 'green' : 'blue'}">${plan.status || 'active'}</span></div>
</div>
${team ? `<h2>Medical Team</h2><div class="grid">
  <div><strong>Senior Registrar:</strong> ${team.senior_registrar || 'N/A'}</div>
  <div><strong>Registrar:</strong> ${team.registrar || 'N/A'}</div>
  <div><strong>House Officer:</strong> ${team.house_officer || 'N/A'}</div>
</div>` : ''}
${plan.description ? `<h2>Clinical Summary</h2><p>${plan.description}</p>` : ''}
${ra.dvt ? `<h2>Risk Assessments</h2><div class="grid">
  <div>DVT Risk: <span class="badge ${ra.dvt.risk === 'Low' ? 'green' : 'red'}">${ra.dvt.risk} (Score: ${ra.dvt.score})</span></div>
  <div>Pressure Sore: <span class="badge ${ra.pressure_sore?.risk === 'No Risk' ? 'green' : 'yellow'}">${ra.pressure_sore?.risk || 'N/A'} (${ra.pressure_sore?.score || 'N/A'})</span></div>
  <div>Nutritional: <span class="badge ${ra.nutritional?.risk === 'Low Risk' ? 'green' : 'yellow'}">${ra.nutritional?.risk || 'N/A'} (${ra.nutritional?.score || 'N/A'})</span></div>
</div>` : ''}
${procs.length > 0 ? `<h2>Procedures (${procs.length})</h2><table><tr><th>Procedure</th><th>Type</th><th>Date</th><th>Status</th></tr>${procs.map((p: any) => `<tr><td>${p.name || p.procedure_name}</td><td>${p.type || p.procedure_type}</td><td>${p.date || (p.proposed_date ? format(new Date(p.proposed_date), 'dd/MM/yyyy') : 'TBD')}</td><td>${p.status}</td></tr>`).join('')}</table>` : ''}
${invs.length > 0 ? `<h2>Investigations (${invs.length})</h2><table><tr><th>Investigation</th><th>Type</th><th>Frequency</th><th>Status</th></tr>${invs.map((i: any) => `<tr><td>${i.name || i.investigation_name}</td><td>${i.type || i.investigation_type}</td><td>${i.frequency}</td><td>${i.status}</td></tr>`).join('')}</table>` : ''}
${meds.length > 0 ? `<h2>Medications (${meds.length})</h2><table><tr><th>Medication</th><th>Dosage</th><th>Route</th><th>Frequency</th><th>Duration</th><th>Status</th></tr>${meds.map((m: any) => `<tr><td>${m.name || m.medication_name}</td><td>${m.dosage}</td><td>${m.route}</td><td>${m.frequency}</td><td>${m.duration}</td><td>${m.status}</td></tr>`).join('')}</table>` : ''}
${dp ? `<h2>Discharge Planning</h2>
<p><strong>Planned Date:</strong> ${dp.current_discharge_date ? format(new Date(dp.current_discharge_date), 'dd/MM/yyyy') : 'TBD'}</p>
<p><strong>Criteria Met:</strong> ${(dp.criteria_met || []).length}/${WHO_DISCHARGE_CRITERIA.length} (${Math.round(((dp.criteria_met || []).length / WHO_DISCHARGE_CRITERIA.length) * 100)}%)</p>` : ''}
<hr style="margin-top:20px"><p style="font-size:10px;color:#999">Generated by PSA Treatment Planning System • ${format(new Date(), 'dd/MM/yyyy HH:mm')}</p>
</body></html>`);
    printWindow.document.close();
    printWindow.print();
  };

  // ── THERMAL PRINT (80mm) ───────────────────────────────────────────────────
  const thermalPrint = () => {
    if (!selectedPlan) return;
    const plan = selectedPlan;
    const team = parseObj(plan.medical_team);
    const meds = parseJSON(plan.planned_medications || plan.medications);

    const printWindow = window.open('', '_blank');
    if (!printWindow) return;
    printWindow.document.write(`<!DOCTYPE html><html><head><title>Rx</title>
<style>body{font-family:monospace;font-size:10px;margin:2mm;width:76mm}h3{font-size:12px;margin:3px 0;text-align:center}
.line{border-top:1px dashed #000;margin:3px 0}p{margin:1px 0}table{width:100%}td{font-size:9px;padding:1px}</style></head><body>
<h3>TREATMENT PLAN</h3><div class="line"></div>
<p><b>Patient:</b> ${getPatientName(plan)}</p>
<p><b>HN:</b> ${plan.hospital_number || 'N/A'}</p>
<p><b>Dx:</b> ${plan.diagnosis || 'N/A'}</p>
<p><b>Date:</b> ${format(new Date(), 'dd/MM/yyyy HH:mm')}</p>
${team ? `<p><b>Team:</b> SR:${team.senior_registrar || '-'} Reg:${team.registrar || '-'} HO:${team.house_officer || '-'}</p>` : ''}
<div class="line"></div><p><b>MEDICATIONS (${meds.length}):</b></p>
${meds.map((m: any, i: number) => `<p>${i + 1}. ${m.name || m.medication_name} ${m.dosage} ${m.route} ${m.frequency} x${m.duration}</p>`).join('')}
<div class="line"></div><p style="text-align:center;font-size:8px">PSA System • ${format(new Date(), 'dd/MM/yyyy')}</p>
</body></html>`);
    printWindow.document.close();
    printWindow.print();
  };

  if (loading) return <div className="flex items-center justify-center min-h-screen"><Loader2 className="w-8 h-8 animate-spin text-green-600" /></div>;

  // ── PLAN LIST VIEW ─────────────────────────────────────────────────────────
  if (!selectedPlan) {
    return (
      <div className="min-h-screen bg-gray-50 pb-20">
        <div className="bg-white border-b px-4 py-3 sticky top-0 z-30">
          <div className="flex items-center justify-between max-w-5xl mx-auto">
            <h1 className="text-lg font-bold text-gray-900">Treatment Plan Manager</h1>
            <button onClick={() => navigate(preselectedPatientId ? `/treatment-plan-creator?patientId=${preselectedPatientId}` : '/treatment-plan-creator')} className="flex items-center gap-1 px-3 py-1.5 bg-green-600 text-white text-sm rounded-lg hover:bg-green-700">
              <Plus className="w-4 h-4" /> New Plan
            </button>
          </div>
        </div>

        <div className="max-w-5xl mx-auto p-4">
          <div className="relative mb-4">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
              placeholder="Search by patient name, diagnosis, hospital number..."
              className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-green-500 bg-white" />
          </div>

          {filteredPlans.length === 0 ? (
            <div className="text-center py-12 bg-white rounded-xl border">
              <FileText className="w-12 h-12 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500">No treatment plans found</p>
              <button onClick={() => navigate(preselectedPatientId ? `/treatment-plan-creator?patientId=${preselectedPatientId}` : '/treatment-plan-creator')} className="mt-3 px-4 py-2 bg-green-600 text-white rounded-lg text-sm">Create First Plan</button>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredPlans.map(plan => {
                const stats = getComplianceStats(plan);
                const discharge = getDischargeStatus(plan);
                const team = parseObj(plan.medical_team);
                const isOverdue = plan.target_date && isPast(new Date(plan.target_date)) && plan.status !== 'completed';

                return (
                  <div key={plan.id} onClick={() => setSelectedPlan(plan)}
                    className={`bg-white rounded-xl border p-4 cursor-pointer hover:shadow-md transition-all ${isOverdue ? 'border-red-300' : 'border-gray-200'}`}>
                    <div className="flex items-start justify-between">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <h3 className="font-semibold text-gray-900 truncate">{getPatientName(plan)}</h3>
                          <span className={`px-2 py-0.5 text-xs rounded-full font-medium ${
                            plan.status === 'completed' ? 'bg-green-100 text-green-700' :
                            plan.status === 'active' ? 'bg-blue-100 text-blue-700' :
                            'bg-gray-100 text-gray-600'
                          }`}>{plan.status || 'active'}</span>
                          {isOverdue && <span className="px-2 py-0.5 text-xs rounded-full bg-red-100 text-red-700 animate-pulse">Overdue</span>}
                        </div>
                        <p className="text-sm text-gray-600 mt-0.5">{plan.diagnosis || plan.title || 'No diagnosis'}</p>
                        <div className="flex items-center gap-3 mt-1 text-xs text-gray-400">
                          <span>HN: {plan.hospital_number || 'N/A'}</span>
                          <span>{plan.created_at ? format(new Date(plan.created_at), 'dd MMM yyyy') : ''}</span>
                          {team?.house_officer && <span>HO: {team.house_officer}</span>}
                        </div>
                      </div>
                      <div className="flex items-center gap-3 ml-3">
                        {/* Compliance ring */}
                        <div className="relative w-12 h-12">
                          <svg className="w-12 h-12 -rotate-90" viewBox="0 0 36 36">
                            <path d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="#e5e7eb" strokeWidth="3" />
                            <path d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none"
                              stroke={stats.compliance >= 75 ? '#22c55e' : stats.compliance >= 50 ? '#eab308' : '#ef4444'}
                              strokeWidth="3" strokeDasharray={`${stats.compliance}, 100`} />
                          </svg>
                          <div className="absolute inset-0 flex items-center justify-center">
                            <span className="text-xs font-bold">{stats.compliance}%</span>
                          </div>
                        </div>
                        <ChevronRight className="w-5 h-5 text-gray-300" />
                      </div>
                    </div>

                    {/* Quick stats */}
                    <div className="flex gap-2 mt-2 flex-wrap">
                      {stats.overdue > 0 && <span className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded-full">⚠ {stats.overdue} overdue</span>}
                      <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">{stats.pending} pending</span>
                      <span className="text-xs bg-purple-100 text-purple-600 px-2 py-0.5 rounded-full">{stats.medsActive} active meds</span>
                      <span className="text-xs bg-green-100 text-green-600 px-2 py-0.5 rounded-full">Discharge: {discharge.percent}%</span>
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

  // ── PLAN DETAIL VIEW ───────────────────────────────────────────────────────
  const plan = selectedPlan;
  const team = parseObj(plan.medical_team);
  const meds = parseJSON(plan.planned_medications || plan.medications);
  const invs = parseJSON(plan.planned_investigations || plan.investigations);
  const procs = parseJSON(plan.planned_procedures || plan.procedures);
  const reviews = parseJSON(plan.planned_reviews || plan.reviews);
  const dp = parseObj(plan.discharge_plan);
  const ra = getRiskAssessments(plan);
  const stats = getComplianceStats(plan);
  const woundDressing = parseJSON(plan.wound_dressing_prescription);
  const woundDebridement = parseJSON(plan.wound_debridement_prescription);
  const mealPlan = (() => { try { return JSON.parse(localStorage.getItem(`meal_plan_${plan.patient_id}`) || 'null'); } catch { return null; } })();

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      {/* Header */}
      <div className="bg-white border-b px-4 py-3 sticky top-0 z-30">
        <div className="flex items-center justify-between max-w-5xl mx-auto">
          <div className="flex items-center gap-3">
            <button onClick={() => setSelectedPlan(null)} className="text-gray-500 hover:text-gray-700" title="Back"><ChevronRight className="w-5 h-5 rotate-180" /></button>
            <div>
              <h1 className="text-base font-bold text-gray-900">{getPatientName(plan)}</h1>
              <p className="text-xs text-gray-500">{plan.diagnosis || plan.title} • HN: {plan.hospital_number || 'N/A'}</p>
            </div>
          </div>
          <div className="flex gap-2">
            <button onClick={thermalPrint} className="p-2 text-gray-500 hover:bg-gray-100 rounded-lg" title="Thermal Print (80mm)"><Printer className="w-4 h-4" /></button>
            <button onClick={exportPDF} className="p-2 text-gray-500 hover:bg-gray-100 rounded-lg" title="Export PDF"><Download className="w-4 h-4" /></button>
            <button onClick={() => navigate(`/treatment-plan-creator?patientId=${plan.patient_id}`)} className="p-2 text-green-600 hover:bg-green-50 rounded-lg" title="Add to Plan"><Plus className="w-4 h-4" /></button>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-white border-b px-4 overflow-x-auto">
        <div className="flex max-w-5xl mx-auto min-w-max">
          {([
            { key: 'overview', label: 'Overview', icon: <Eye className="w-3.5 h-3.5" /> },
            { key: 'medications', label: `Meds (${meds.length})`, icon: <Pill className="w-3.5 h-3.5" /> },
            { key: 'investigations', label: `Invx (${invs.length})`, icon: <Activity className="w-3.5 h-3.5" /> },
            { key: 'procedures', label: `Proc (${procs.length})`, icon: <FileText className="w-3.5 h-3.5" /> },
            { key: 'compliance', label: 'Compliance', icon: <BarChart3 className="w-3.5 h-3.5" /> },
            { key: 'discharge', label: 'Discharge', icon: <Heart className="w-3.5 h-3.5" /> },
          ] as const).map(tab => (
            <button key={tab.key} onClick={() => setActiveTab(tab.key)}
              className={`flex items-center gap-1 px-3 py-2.5 text-xs font-medium border-b-2 whitespace-nowrap transition-all ${
                activeTab === tab.key ? 'border-green-600 text-green-700' : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}>{tab.icon} {tab.label}</button>
          ))}
        </div>
      </div>

      <div className="max-w-5xl mx-auto p-4 space-y-4">

        {/* ── OVERVIEW TAB ── */}
        {activeTab === 'overview' && (
          <div className="space-y-4">
            {/* Compliance Summary */}
            <div className="bg-white rounded-xl border p-4">
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 text-center">
                <div className="p-2 bg-green-50 rounded-lg">
                  <div className="text-2xl font-bold text-green-700">{stats.compliance}%</div>
                  <div className="text-xs text-gray-500">Compliance</div>
                </div>
                <div className="p-2 bg-yellow-50 rounded-lg">
                  <div className="text-2xl font-bold text-yellow-700">{stats.pending}</div>
                  <div className="text-xs text-gray-500">Pending</div>
                </div>
                <div className="p-2 bg-red-50 rounded-lg">
                  <div className="text-2xl font-bold text-red-700">{stats.overdue}</div>
                  <div className="text-xs text-gray-500">Overdue</div>
                </div>
                <div className="p-2 bg-purple-50 rounded-lg">
                  <div className="text-2xl font-bold text-purple-700">{stats.medsActive}</div>
                  <div className="text-xs text-gray-500">Active Meds</div>
                </div>
                <div className="p-2 bg-blue-50 rounded-lg">
                  <div className="text-2xl font-bold text-blue-700">{getDischargeStatus(plan).percent}%</div>
                  <div className="text-xs text-gray-500">Discharge Ready</div>
                </div>
              </div>
            </div>

            {/* Medical Team */}
            <div className="bg-white rounded-xl border p-4">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-sm font-semibold text-gray-700">Medical Team</h3>
                {user?.role === 'admin' || user?.role === 'consultant' ? (
                  <button onClick={() => { setEditingTeam(!editingTeam); setUpdatedTeam({ sr: '', reg: '', ho: '' }); }}
                    className="text-xs text-blue-600 hover:underline flex items-center gap-1"><Edit3 className="w-3 h-3" /> Change</button>
                ) : null}
              </div>
              {editingTeam ? (
                <div className="space-y-2">
                  <div className="grid grid-cols-3 gap-2">
                    <div>
                      <label className="text-xs text-gray-500">Senior Registrar</label>
                      <select value={updatedTeam.sr} onChange={e => setUpdatedTeam(p => ({ ...p, sr: e.target.value }))} className="w-full px-2 py-1.5 border rounded text-sm" title="Senior Registrar">
                        <option value="">Keep current</option>
                        {staffLists.sr.map(s => <option key={s.id} value={String(s.id)}>{s.full_name}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="text-xs text-gray-500">Registrar</label>
                      <select value={updatedTeam.reg} onChange={e => setUpdatedTeam(p => ({ ...p, reg: e.target.value }))} className="w-full px-2 py-1.5 border rounded text-sm" title="Registrar">
                        <option value="">Keep current</option>
                        {staffLists.reg.map(s => <option key={s.id} value={String(s.id)}>{s.full_name}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="text-xs text-gray-500">House Officer</label>
                      <select value={updatedTeam.ho} onChange={e => setUpdatedTeam(p => ({ ...p, ho: e.target.value }))} className="w-full px-2 py-1.5 border rounded text-sm" title="House Officer">
                        <option value="">Keep current</option>
                        {staffLists.ho.map(s => <option key={s.id} value={String(s.id)}>{s.full_name}</option>)}
                      </select>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={saveTeamChange} disabled={saving} className="px-3 py-1.5 bg-green-600 text-white rounded text-xs disabled:opacity-50">
                      {saving ? 'Saving...' : 'Save Changes'}
                    </button>
                    <button onClick={() => setEditingTeam(false)} className="px-3 py-1.5 border rounded text-xs">Cancel</button>
                  </div>
                </div>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {team?.senior_registrar && <span className="text-xs bg-purple-100 text-purple-700 px-2 py-1 rounded-full">SR: {team.senior_registrar}</span>}
                  {team?.registrar && <span className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded-full">Reg: {team.registrar}</span>}
                  {team?.house_officer && <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded-full">HO: {team.house_officer}</span>}
                </div>
              )}
            </div>

            {/* Risk Assessments */}
            {ra.dvt && (
              <div className="bg-white rounded-xl border p-4">
                <h3 className="text-sm font-semibold text-gray-700 mb-2">Risk Assessments</h3>
                <div className="grid grid-cols-3 gap-2">
                  <div className={`p-2 rounded-lg text-center ${ra.dvt.risk === 'Low' ? 'bg-green-50' : ra.dvt.risk === 'Very High' ? 'bg-red-50' : 'bg-yellow-50'}`}>
                    <div className="text-xs text-gray-500">DVT (Caprini)</div>
                    <div className="font-bold text-sm">{ra.dvt.risk}</div>
                    <div className="text-xs text-gray-400">Score: {ra.dvt.score}</div>
                  </div>
                  {ra.pressure_sore && (
                    <div className={`p-2 rounded-lg text-center ${ra.pressure_sore.risk === 'No Risk' ? 'bg-green-50' : 'bg-orange-50'}`}>
                      <div className="text-xs text-gray-500">Pressure (Braden)</div>
                      <div className="font-bold text-sm">{ra.pressure_sore.risk}</div>
                      <div className="text-xs text-gray-400">Score: {ra.pressure_sore.score}</div>
                    </div>
                  )}
                  {ra.nutritional && (
                    <div className={`p-2 rounded-lg text-center ${ra.nutritional.risk === 'Low Risk' ? 'bg-green-50' : 'bg-yellow-50'}`}>
                      <div className="text-xs text-gray-500">Nutrition (MUST)</div>
                      <div className="font-bold text-sm">{ra.nutritional.risk}</div>
                      <div className="text-xs text-gray-400">Score: {ra.nutritional.score}</div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Clinical Summary */}
            {plan.description && (
              <div className="bg-white rounded-xl border p-4">
                <h3 className="text-sm font-semibold text-gray-700 mb-1">Clinical Summary</h3>
                <p className="text-sm text-gray-600">{plan.description}</p>
              </div>
            )}

            {/* Meal Plan */}
            {mealPlan && (
              <div className="bg-white rounded-xl border p-4">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-semibold text-gray-700 flex items-center gap-1"><Apple className="w-4 h-4 text-green-600" /> 7-Day Nutritional Plan</h3>
                  <button onClick={() => {
                    const pw = window.open('', '_blank');
                    if (!pw) return;
                    pw.document.write(`<!DOCTYPE html><html><head><title>Meal Plan</title>
<style>body{font-family:Arial;font-size:11px;margin:10px}h2{color:#0E9F6E}table{width:100%;border-collapse:collapse;margin:5px 0}th,td{border:1px solid #ddd;padding:3px;font-size:10px}th{background:#f0f0f0}
@media print{@page{size:A4;margin:8mm}}</style></head><body>
<h2>7-DAY MEAL PLAN - ${getPatientName(plan)}</h2>
<p><b>Targets:</b> ${mealPlan.targets.calories} | Protein: ${mealPlan.targets.protein} | Fluids: ${mealPlan.targets.fluid}</p>
<table><tr><th>Day</th><th>Breakfast</th><th>Mid-AM</th><th>Lunch</th><th>Mid-PM</th><th>Dinner</th><th>Fruits</th><th>Water</th></tr>
${mealPlan.days.map((d: any) => `<tr><td><b>${d.day}</b></td><td>${d.meals.breakfast}</td><td>${d.meals.mid_morning}</td><td>${d.meals.lunch}</td><td>${d.meals.mid_afternoon}</td><td>${d.meals.dinner}</td><td>${d.meals.fruits}</td><td>${d.water}</td></tr>`).join('')}</table>
${mealPlan.notes.length > 0 ? `<h3>Notes:</h3><ul>${mealPlan.notes.map((n: string) => `<li>${n}</li>`).join('')}</ul>` : ''}
</body></html>`);
                    pw.document.close(); pw.print();
                  }} className="text-xs text-blue-600 hover:underline flex items-center gap-1"><Printer className="w-3 h-3" /> Print</button>
                </div>
                <div className="text-xs text-gray-500 mb-2">
                  Targets: {mealPlan.targets.calories} | Protein: {mealPlan.targets.protein} | Fluids: {mealPlan.targets.fluid}
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs border-collapse">
                    <thead>
                      <tr className="bg-green-50">
                        <th className="border px-2 py-1 text-left">Day</th>
                        <th className="border px-2 py-1">Breakfast</th>
                        <th className="border px-2 py-1">Lunch</th>
                        <th className="border px-2 py-1">Dinner</th>
                        <th className="border px-2 py-1">Fruits</th>
                      </tr>
                    </thead>
                    <tbody>
                      {mealPlan.days.map((d: any, i: number) => (
                        <tr key={i} className={i % 2 === 0 ? 'bg-gray-50' : ''}>
                          <td className="border px-2 py-1 font-medium">{d.day.slice(0, 3)}</td>
                          <td className="border px-2 py-1">{d.meals.breakfast}</td>
                          <td className="border px-2 py-1">{d.meals.lunch}</td>
                          <td className="border px-2 py-1">{d.meals.dinner}</td>
                          <td className="border px-2 py-1">{d.meals.fruits}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {mealPlan.notes.length > 0 && (
                  <div className="mt-2 space-y-0.5">
                    {mealPlan.notes.map((n: string, i: number) => <p key={i} className="text-xs text-gray-600">{n}</p>)}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* ── MEDICATIONS TAB ── */}
        {activeTab === 'medications' && (
          <div className="space-y-3">
            {meds.length === 0 ? (
              <div className="bg-white rounded-xl border p-8 text-center"><Pill className="w-10 h-10 mx-auto text-gray-300 mb-2" /><p className="text-gray-500">No medications prescribed</p></div>
            ) : meds.map((med: any, i: number) => {
              const isCompleted = med.status === 'completed';
              const isDiscontinued = med.status === 'discontinued';
              return (
                <div key={med.id || i} className={`bg-white rounded-xl border p-3 ${isCompleted ? 'opacity-60' : isDiscontinued ? 'opacity-40 line-through' : ''}`}>
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="font-medium text-sm">{med.name || med.medication_name}</div>
                      <div className="text-xs text-gray-500">{med.dosage} • {med.route} • {med.frequency} • {med.duration}</div>
                      {med.notes && <div className="text-xs text-orange-600 mt-0.5">{med.notes}</div>}
                    </div>
                    <div className="flex items-center gap-1">
                      <span className={`px-2 py-0.5 text-xs rounded-full ${
                        isCompleted ? 'bg-green-100 text-green-700' :
                        isDiscontinued ? 'bg-red-100 text-red-700' : 'bg-blue-100 text-blue-700'
                      }`}>{med.status}</span>
                      {!isCompleted && !isDiscontinued && (
                        <>
                          <button onClick={() => updateItemStatus('planned_medications', med.id, 'completed')}
                            className="p-1 text-green-600 hover:bg-green-50 rounded" title="Mark completed"><CheckCircle className="w-4 h-4" /></button>
                          <button onClick={() => updateItemStatus('planned_medications', med.id, 'discontinued')}
                            className="p-1 text-red-500 hover:bg-red-50 rounded" title="Discontinue"><X className="w-4 h-4" /></button>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}

            {/* Wound Dressing */}
            {woundDressing.length > 0 && (
              <div className="bg-white rounded-xl border p-4">
                <h3 className="text-sm font-semibold mb-2">🩹 Wound Dressing Prescription</h3>
                {woundDressing.map((item: any, i: number) => (
                  <div key={i} className="flex justify-between text-xs py-1 border-b last:border-0">
                    <span>{item.name}</span><span className="text-gray-500">× {item.quantity} {item.unit}</span>
                  </div>
                ))}
              </div>
            )}
            {woundDebridement.length > 0 && (
              <div className="bg-white rounded-xl border p-4">
                <h3 className="text-sm font-semibold mb-2">🔪 Wound Debridement Prescription</h3>
                {woundDebridement.map((item: any, i: number) => (
                  <div key={i} className="flex justify-between text-xs py-1 border-b last:border-0">
                    <span>{item.name}</span><span className="text-gray-500">× {item.quantity} {item.unit}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── INVESTIGATIONS TAB ── */}
        {activeTab === 'investigations' && (
          <div className="space-y-3">
            {invs.length === 0 ? (
              <div className="bg-white rounded-xl border p-8 text-center"><Activity className="w-10 h-10 mx-auto text-gray-300 mb-2" /><p className="text-gray-500">No investigations ordered</p></div>
            ) : invs.map((inv: any, i: number) => (
              <div key={inv.id || i} className={`bg-white rounded-xl border p-3 ${inv.status === 'completed' ? 'opacity-60' : ''}`}>
                <div className="flex items-start justify-between">
                  <div>
                    <div className="font-medium text-sm">{inv.name || inv.investigation_name}</div>
                    <div className="text-xs text-gray-500">{inv.type || inv.investigation_type} • {inv.frequency} {inv.repeat_count > 1 ? `× ${inv.repeat_count}` : ''}</div>
                    {inv.target_range && <div className="text-xs text-blue-600">Target: {inv.target_range}</div>}
                    {inv.results?.length > 0 && (
                      <div className="mt-1 text-xs text-green-700 bg-green-50 rounded p-1">
                        Latest: {inv.results[inv.results.length - 1].value || inv.results[inv.results.length - 1].result} ({inv.results[inv.results.length - 1].status})
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-1">
                    <span className={`px-2 py-0.5 text-xs rounded-full ${
                      inv.status === 'completed' ? 'bg-green-100 text-green-700' :
                      inv.status === 'in_progress' ? 'bg-yellow-100 text-yellow-700' : 'bg-gray-100 text-gray-600'
                    }`}>{inv.status}</span>
                    {inv.status !== 'completed' && (
                      <button onClick={() => updateItemStatus(plan.planned_investigations ? 'planned_investigations' : 'investigations', inv.id, 'completed')}
                        className="p-1 text-green-600 hover:bg-green-50 rounded" title="Mark completed"><CheckCircle className="w-4 h-4" /></button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ── PROCEDURES TAB ── */}
        {activeTab === 'procedures' && (
          <div className="space-y-3">
            {procs.length === 0 ? (
              <div className="bg-white rounded-xl border p-8 text-center"><FileText className="w-10 h-10 mx-auto text-gray-300 mb-2" /><p className="text-gray-500">No procedures planned</p></div>
            ) : procs.map((proc: any, i: number) => {
              const procDate = proc.date || proc.proposed_date;
              const isOverdue = procDate && isPast(new Date(procDate)) && proc.status !== 'completed';
              return (
                <div key={proc.id || i} className={`bg-white rounded-xl border p-3 ${proc.status === 'completed' ? 'opacity-60' : isOverdue ? 'border-red-300' : ''}`}>
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="font-medium text-sm flex items-center gap-1">
                        {isOverdue && <AlertTriangle className="w-3.5 h-3.5 text-red-500" />}
                        {proc.name || proc.procedure_name}
                      </div>
                      <div className="text-xs text-gray-500">
                        {proc.type || proc.procedure_type} • {procDate ? format(new Date(procDate), 'dd MMM yyyy') : 'TBD'} {proc.time || ''} • {proc.frequency || 'once'}
                      </div>
                      {proc.surgeon && <div className="text-xs text-gray-400">Surgeon: {proc.surgeon}</div>}
                      {proc.notes && <div className="text-xs text-blue-600 mt-0.5">{proc.notes}</div>}
                    </div>
                    <div className="flex items-center gap-1">
                      <span className={`px-2 py-0.5 text-xs rounded-full ${
                        proc.status === 'completed' ? 'bg-green-100 text-green-700' :
                        isOverdue ? 'bg-red-100 text-red-700' : 'bg-blue-100 text-blue-700'
                      }`}>{isOverdue ? 'OVERDUE' : proc.status}</span>
                      {proc.status !== 'completed' && (
                        <button onClick={() => updateItemStatus(plan.planned_procedures ? 'planned_procedures' : 'procedures', proc.id, 'completed')}
                          className="p-1 text-green-600 hover:bg-green-50 rounded" title="Mark completed"><CheckCircle className="w-4 h-4" /></button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* ── COMPLIANCE TAB ── */}
        {activeTab === 'compliance' && (
          <div className="space-y-4">
            <div className="bg-white rounded-xl border p-4">
              <h3 className="text-base font-semibold mb-3">Treatment Plan Compliance</h3>
              <div className="flex items-center justify-center mb-4">
                <div className="relative w-32 h-32">
                  <svg className="w-32 h-32 -rotate-90" viewBox="0 0 36 36">
                    <path d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="#e5e7eb" strokeWidth="2.5" />
                    <path d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none"
                      stroke={stats.compliance >= 75 ? '#22c55e' : stats.compliance >= 50 ? '#eab308' : '#ef4444'}
                      strokeWidth="2.5" strokeDasharray={`${stats.compliance}, 100`} />
                  </svg>
                  <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <span className="text-3xl font-bold">{stats.compliance}%</span>
                    <span className="text-xs text-gray-500">Overall</span>
                  </div>
                </div>
              </div>

              <div className="space-y-3">
                {/* Medications Progress */}
                <div>
                  <div className="flex justify-between text-xs mb-1"><span className="font-medium">Medications</span><span>{meds.filter((m: any) => m.status === 'completed').length}/{meds.length}</span></div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div className="bg-purple-600 h-2 rounded-full transition-all" style={{ width: `${meds.length ? (meds.filter((m: any) => m.status === 'completed').length / meds.length) * 100 : 0}%` }} />
                  </div>
                </div>
                {/* Investigations Progress */}
                <div>
                  <div className="flex justify-between text-xs mb-1"><span className="font-medium">Investigations</span><span>{invs.filter((i: any) => i.status === 'completed').length}/{invs.length}</span></div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div className="bg-yellow-600 h-2 rounded-full transition-all" style={{ width: `${invs.length ? (invs.filter((i: any) => i.status === 'completed').length / invs.length) * 100 : 0}%` }} />
                  </div>
                </div>
                {/* Procedures Progress */}
                <div>
                  <div className="flex justify-between text-xs mb-1"><span className="font-medium">Procedures</span><span>{procs.filter((p: any) => p.status === 'completed').length}/{procs.length}</span></div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div className="bg-blue-600 h-2 rounded-full transition-all" style={{ width: `${procs.length ? (procs.filter((p: any) => p.status === 'completed').length / procs.length) * 100 : 0}%` }} />
                  </div>
                </div>
                {/* Discharge Readiness */}
                <div>
                  <div className="flex justify-between text-xs mb-1"><span className="font-medium">Discharge Readiness</span><span>{getDischargeStatus(plan).met}/{getDischargeStatus(plan).total}</span></div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div className="bg-green-600 h-2 rounded-full transition-all" style={{ width: `${getDischargeStatus(plan).percent}%` }} />
                  </div>
                </div>
              </div>
            </div>

            {/* Outstanding / Pending Items */}
            <div className="bg-white rounded-xl border p-4">
              <h3 className="text-sm font-semibold mb-2 flex items-center gap-1"><AlertCircle className="w-4 h-4 text-orange-500" /> Outstanding Items</h3>
              <div className="space-y-1">
                {meds.filter((m: any) => m.status === 'active').map((m: any, i: number) => (
                  <div key={i} className="text-xs flex items-center gap-2 p-1.5 bg-purple-50 rounded">
                    <Pill className="w-3 h-3 text-purple-600" /> <span>{m.name || m.medication_name} — {m.dosage} {m.frequency}</span>
                    <span className="ml-auto text-purple-500">Active</span>
                  </div>
                ))}
                {invs.filter((i: any) => i.status !== 'completed').map((inv: any, idx: number) => (
                  <div key={idx} className="text-xs flex items-center gap-2 p-1.5 bg-yellow-50 rounded">
                    <Activity className="w-3 h-3 text-yellow-600" /> <span>{inv.name || inv.investigation_name}</span>
                    <span className="ml-auto text-yellow-600">{inv.status}</span>
                  </div>
                ))}
                {procs.filter((p: any) => p.status !== 'completed').map((proc: any, idx: number) => (
                  <div key={idx} className="text-xs flex items-center gap-2 p-1.5 bg-blue-50 rounded">
                    <Calendar className="w-3 h-3 text-blue-600" /> <span>{proc.name || proc.procedure_name}</span>
                    <span className="ml-auto text-blue-600">{proc.status}</span>
                  </div>
                ))}
                {stats.pending === 0 && <p className="text-xs text-green-600">All items completed!</p>}
              </div>
            </div>
          </div>
        )}

        {/* ── DISCHARGE TAB ── */}
        {activeTab === 'discharge' && (
          <div className="space-y-4">
            <div className="bg-white rounded-xl border p-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-base font-semibold flex items-center gap-2"><Heart className="w-5 h-5 text-red-600" /> Discharge Criteria (WHO)</h3>
                <div className={`px-3 py-1 rounded-full text-sm font-bold ${
                  getDischargeStatus(plan).percent === 100 ? 'bg-green-100 text-green-700' :
                  getDischargeStatus(plan).percent >= 70 ? 'bg-yellow-100 text-yellow-700' : 'bg-red-100 text-red-700'
                }`}>{getDischargeStatus(plan).met}/{getDischargeStatus(plan).total} ({getDischargeStatus(plan).percent}%)</div>
              </div>
              {dp?.current_discharge_date && (
                <p className="text-sm text-gray-600 mb-3">Planned Discharge: <strong>{format(new Date(dp.current_discharge_date), 'dd MMM yyyy')}</strong>
                  {isPast(new Date(dp.current_discharge_date)) && <span className="text-red-600 ml-2">(OVERDUE by {differenceInDays(new Date(), new Date(dp.current_discharge_date))} days)</span>}
                </p>
              )}
              <div className="space-y-1">
                {(['Clinical', 'Surgical', 'Functional', 'Discharge', 'Social'] as const).map(cat => (
                  <div key={cat} className="mb-3">
                    <h4 className="text-xs font-semibold text-gray-500 uppercase mb-1">{cat}</h4>
                    {WHO_DISCHARGE_CRITERIA.filter(c => c.category === cat).map(c => {
                      const isMet = (dp?.criteria_met || []).includes(c.label);
                      return (
                        <label key={c.id} className={`flex items-center gap-2 p-2 rounded-lg cursor-pointer transition-all ${
                          isMet ? 'bg-green-50 border border-green-200' : 'hover:bg-gray-50'
                        }`}>
                          <input type="checkbox" checked={isMet} onChange={() => toggleDischargeCriteria(c.id)} className="w-4 h-4 text-green-600 rounded" />
                          <span className={`text-sm ${isMet ? 'text-green-700' : 'text-gray-700'}`}>{c.label}</span>
                          {isMet && <CheckCircle className="w-4 h-4 text-green-500 ml-auto" />}
                        </label>
                      );
                    })}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default TreatmentPlanManager;

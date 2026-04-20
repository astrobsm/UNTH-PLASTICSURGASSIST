import { 
  Users, 
  Calendar, 
  FlaskConical, 
  ClipboardCheck,
  AlertTriangle,
  TrendingUp,
  Megaphone,
  MapPin,
  Search,
  ChevronRight,
  UserCheck,
  Building2,
  Download,
  CheckCircle2,
  Loader2,
  WifiOff,
  FileText,
  Pill,
  Activity,
  Plus,
  Siren,
  X,
  Edit3
} from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { useState, useEffect, useCallback } from 'react';
import { db, Patient } from '../db/database';
import { patientService } from '../services/patientService';
import { admissionDischargeService, Admission } from '../services/admissionDischargeService';
import { admissionService } from '../services/admissionService';
import { schedulingService, SurgeryBooking } from '../services/schedulingService';
import { warmCache, CacheWarmProgress } from '../services/cacheWarmer';
import { syncService } from '../db/syncService';
import toast from 'react-hot-toast';
import UnitRosterWidget from '../components/UnitRosterWidget';
import { userManagementService, ApprovedUser } from '../services/userManagementService';
import { medicalTeamService } from '../services/medicalTeamService';
import { getCurrentUserName } from '../utils/getCurrentUser';
import { PS_UNITS, getCurrentAssignments, getTodaySchedule, UnitRosterConfig } from '../config/psUnits';
import HOResponsibilitiesGuide, { HOResponsibilitiesCard } from '../components/HOResponsibilitiesGuide';

interface DashboardPatient {
  id: number | string;
  name: string;
  hospital_number: string;
  ward: string;
  bed: string;
  consultant: string;
  resident: string;
  house_officer: string;
  admission_status: 'active' | 'discharged' | 'outpatient';
  admission_date?: string;
}

export default function Dashboard() {
  const { user } = useAuthStore();
  const navigate = useNavigate();
  const [stats, setStats] = useState({
    activePatients: 0,
    myPatients: 0,
    admittedPatients: 0,
    pendingTasks: 0,
    labResults: 0,
    urgentItems: 0
  });
  const [recentActivities, setRecentActivities] = useState<Array<{
    id: string;
    title: string;
    time: string;
    type: string;
  }>>([]);
  const [dashboardPatients, setDashboardPatients] = useState<DashboardPatient[]>([]);
  const [patientSearch, setPatientSearch] = useState('');
  const [wardFilter, setWardFilter] = useState('all');
  const [availableWards, setAvailableWards] = useState<string[]>([]);
  const [cacheProgress, setCacheProgress] = useState<CacheWarmProgress | null>(null);
  const [syncBreakdown, setSyncBreakdown] = useState<{
    total: number;
    byTable: Record<string, number>;
    byAction: Record<string, number>;
    staleCount: number;
    failedCount: number;
    rawRequestCount: number;
  } | null>(null);
  const [syncDiagOpen, setSyncDiagOpen] = useState(false);
  const [syncClearing, setSyncClearing] = useState(false);

  // Staff Patient Lookup
  const [staffList, setStaffList] = useState<ApprovedUser[]>([]);
  const [selectedStaffId, setSelectedStaffId] = useState('');
  const [staffPatients, setStaffPatients] = useState<DashboardPatient[]>([]);
  const [forceDischarging, setForceDischarging] = useState(false);
  const [selectedForDischarge, setSelectedForDischarge] = useState<Set<string | number>>(new Set());

  // Force Admit modal state
  const [showForceAdmitModal, setShowForceAdmitModal] = useState(false);
  const [forceAdmitting, setForceAdmitting] = useState(false);
  const [allPatients, setAllPatients] = useState<Patient[]>([]);
  const [faPatientSearch, setFaPatientSearch] = useState('');
  const [faSelectedPatient, setFaSelectedPatient] = useState<Patient | null>(null);
  const [faWard, setFaWard] = useState('');
  const [faBed, setFaBed] = useState('');
  const [faDiagnosis, setFaDiagnosis] = useState('');
  const [faConsultant, setFaConsultant] = useState('');
  const [faReason, setFaReason] = useState('');

  // Emergency Surgery Booking modal state
  const [showEmergencySurgeryModal, setShowEmergencySurgeryModal] = useState(false);
  const [bookingSurgery, setBookingSurgery] = useState(false);
  const [esPatientSearch, setEsPatientSearch] = useState('');
  const [esSelectedPatient, setEsSelectedPatient] = useState<Patient | null>(null);
  const [esProcedure, setEsProcedure] = useState('');
  const [esIndication, setEsIndication] = useState('');
  const [esSurgeon, setEsSurgeon] = useState('');
  const [esAssistant, setEsAssistant] = useState('');
  const [esAnaesthetist, setEsAnaesthetist] = useState('');
  const [esAnaesthesiaType, setEsAnaesthesiaType] = useState<'general' | 'regional' | 'local' | 'sedation'>('general');
  const [esTheatre, setEsTheatre] = useState('');
  const [esDuration, setEsDuration] = useState('60');
  const [esDiagnosis, setEsDiagnosis] = useState('');
  const [esBloodType, setEsBloodType] = useState('');
  const [esInfected, setEsInfected] = useState(false);
  const [esHivPositive, setEsHivPositive] = useState(false);
  const [esDiabetic, setEsDiabetic] = useState(false);
  const [esSpecialReqs, setEsSpecialReqs] = useState('');
  const [esNotes, setEsNotes] = useState('');
  const [showHOGuide, setShowHOGuide] = useState(false);

  // Treatment Plan Tracking
  const [treatmentPlanSummaries, setTreatmentPlanSummaries] = useState<Array<{
    id: string;
    patientName: string;
    hospitalNumber: string;
    title: string;
    status: string;
    totalMeds: number;
    activeMeds: number;
    totalInvestigations: number;
    completedInvestigations: number;
    totalProcedures: number;
    completedProcedures: number;
    dischargeMet: number;
    dischargeTotal: number;
    compliancePercent: number;
    createdAt: string;
  }>>([]);
  const [staffLookupLoading, setStaffLookupLoading] = useState(false);
  const [autoAssigning, setAutoAssigning] = useState(false);
  const [autoAssignResult, setAutoAssignResult] = useState<string | null>(null);

  // HO Duty Section
  const [hoDutyData, setHoDutyData] = useState<{
    todaySchedule: Array<{ unit: string; activity: string; time?: string }>;
    unit1HO: string;
    unit2HO: string;
    unit1SR: string;
    unit2SR: string;
  } | null>(null);

  const isAdmin = user?.role === 'admin';

  const handleWarmCache = useCallback(async () => {
    if (cacheProgress?.status === 'warming') return; // prevent double-click
    setCacheProgress({ current: 0, total: 1, currentModule: 'Starting...', status: 'warming', errors: [], cached: 0, skipped: 0 });
    try {
      await warmCache((p) => setCacheProgress({ ...p }));
    } catch {
      setCacheProgress(prev => prev ? { ...prev, status: 'error' } : null);
    }
  }, [cacheProgress?.status]);

  const handleSyncDiagnostics = useCallback(async () => {
    try {
      const breakdown = await syncService.getQueueBreakdown();
      setSyncBreakdown(breakdown);
      setSyncDiagOpen(true);
    } catch (e) {
      console.error('Failed to get sync breakdown:', e);
    }
  }, []);

  const handleClearSyncQueue = useCallback(async () => {
    if (!confirm('This will clear ALL pending sync items. Data that hasn\'t been synced to the server will be lost. Continue?')) return;
    setSyncClearing(true);
    try {
      const cleared = await syncService.clearAllQueue();
      setSyncBreakdown(null);
      setSyncDiagOpen(false);
      toast.success(`Cleared ${cleared} pending sync items`);
    } catch (e) {
      toast.error('Failed to clear sync queue');
    } finally {
      setSyncClearing(false);
    }
  }, []);

  const handleForceSync = useCallback(async () => {
    try {
      toast.loading('Force syncing...', { id: 'force-sync' });
      const result = await syncService.forceSync();
      toast.dismiss('force-sync');
      if (result.synced > 0 || result.failed > 0) {
        toast.success(`Sync: ${result.synced} succeeded, ${result.failed} failed`);
      }
      // Refresh diagnostics
      handleSyncDiagnostics();
    } catch (e) {
      toast.dismiss('force-sync');
      toast.error('Force sync failed');
    }
  }, [handleSyncDiagnostics]);

  useEffect(() => {
    const init = async () => {
      await loadDashboardData();
      // Auto-assign HOs to any newly admitted patients on startup
      try {
        const result = await medicalTeamService.autoAssignAdmittedPatientsToHouseOfficers();
        if (result.assigned > 0) {
          // Reload to reflect new assignments
          await loadDashboardData();
        }
      } catch {
        // Silently ignore — assignment is best-effort on load
      }
    };
    init();
    loadStaffList();
    loadHODutyData();
  }, []);

  const loadDashboardData = async () => {
    try {
      // Get patients data from API/database (exclude deleted)
      const allPatients = await patientService.getAllPatients();
      const activePatientsList = allPatients.filter((p: any) => !p.deleted);
      const activePatients = activePatientsList.length;

      // Get active admissions for ward/bed info (server-synced)
      let activeAdmissions: Admission[] = [];
      try {
        activeAdmissions = await admissionDischargeService.getActiveAdmissions();
      } catch { /* admissions may not exist yet */ }

      // Build admission lookup by patient_id AND hospital_number
      const admissionByPid = new Map<string, Admission>();
      const admissionByHn = new Map<string, Admission>();
      for (const adm of activeAdmissions) {
        admissionByPid.set(String(adm.patient_id), adm);
        if (adm.hospital_number) {
          admissionByHn.set(adm.hospital_number.trim().toLowerCase(), adm);
        }
      }

      // Load patient_assignments for accurate team data
      let allAssignments: any[] = [];
      try { allAssignments = await db.patient_assignments.toArray(); } catch { /* table may not exist */ }
      const assignmentByPid = new Map<number, any>();
      for (const a of allAssignments) {
        if (a.is_active) assignmentByPid.set(a.patient_id, a);
      }
      // Build user lookup for resolving IDs to names
      let allUsers: any[] = [];
      try { allUsers = await db.users.toArray(); } catch { /* */ }
      const userById = new Map<number, any>();
      for (const u of allUsers) userById.set(u.id, u);

      // Build dashboard patient list
      const userName = user?.name || '';
      const userId = user?.id || '';
      const dPatients: DashboardPatient[] = [];

      for (const p of activePatientsList) {
        const pid = String(p.id || p.serverId || '');
        const numPid = Number(pid);
        const hn = (p.hospital_number || '').trim().toLowerCase();
        const adm = admissionByPid.get(pid) || (hn ? admissionByHn.get(hn) : undefined);
        const assignment = assignmentByPid.get(numPid);

        const ward = adm?.ward_location || p.ward_id || '';
        const bed = adm?.bed_number || p.bed_number || '';
        // Resolve consultant from patient_assignments first, then fallback to admission/patient text fields
        const assignedConsultant = assignment?.consultant_id ? userById.get(assignment.consultant_id) : null;
        const consultant = assignedConsultant ? (assignedConsultant.full_name || assignedConsultant.name || '') : (adm?.admitting_consultant || p.consultant_in_charge || '');
        // Resolve resident from patient_assignments (senior_registrar or registrar), NOT admitting_doctor
        const srUser = assignment?.senior_registrar_id ? userById.get(assignment.senior_registrar_id) : null;
        const regUser = assignment?.registrar_id ? userById.get(assignment.registrar_id) : null;
        const resident = srUser ? (srUser.full_name || srUser.name || '') : regUser ? (regUser.full_name || regUser.name || '') : (p.resident_in_charge || '');
        const hoUser = assignment?.house_officer_id ? userById.get(assignment.house_officer_id) : null;
        const houseOfficer = hoUser ? (hoUser.full_name || hoUser.name || '') : '';
        const admStatus = adm ? 'active' as const : 'outpatient' as const;

        // For non-admin: check if patient is assigned to this user via name OR via patient_assignments
        const myUserId = Number(userId);
        const isAssigned = isAdmin ||
          consultant.toLowerCase().includes(userName.toLowerCase()) ||
          resident.toLowerCase().includes(userName.toLowerCase()) ||
          (p.consultant_in_charge || '').toLowerCase().includes(userName.toLowerCase()) ||
          (p.resident_in_charge || '').toLowerCase().includes(userName.toLowerCase()) ||
          adm?.admitting_doctor?.toLowerCase().includes(userName.toLowerCase()) ||
          adm?.admitting_consultant?.toLowerCase().includes(userName.toLowerCase()) ||
          adm?.created_by === userId ||
          (assignment && (
            assignment.consultant_id === myUserId ||
            assignment.senior_registrar_id === myUserId ||
            assignment.registrar_id === myUserId ||
            assignment.house_officer_id === myUserId
          ));

        if (isAdmin || isAssigned) {
          dPatients.push({
            id: p.id || p.serverId || '',
            name: `${p.first_name || ''} ${p.last_name || ''}`.trim() || p.full_name || 'Unknown',
            hospital_number: p.hospital_number || '',
            ward,
            bed,
            consultant,
            resident,
            house_officer: houseOfficer,
            admission_status: admStatus,
            admission_date: adm ? new Date(adm.admission_date).toLocaleDateString() : undefined
          });
        }
      }

      setDashboardPatients(dPatients);

      // Collect unique wards
      const wards = [...new Set(dPatients.map(p => p.ward).filter(Boolean))].sort();
      setAvailableWards(wards);

      // Get treatment plans from database (exclude deleted)
      const allTreatmentPlans = await db.treatment_plans.toArray();
      const activePlansAll = allTreatmentPlans.filter(tp => 
        (tp.status === 'active' || tp.status === 'draft') && !tp.deleted
      );

      // Deduplicate plans: keep only the most recent active plan per patient
      // Use both patient_id and patient_name+hospital_number as dedup keys
      const latestPlanByPatient = new Map<string, typeof activePlansAll[0]>();
      for (const tp of activePlansAll) {
        const pid = String(tp.patient_id || (tp as any).patientId || '').trim();
        const nameKey = `${(tp.patient_name || '').trim().toLowerCase()}|${((tp as any).hospital_number || '').trim().toLowerCase()}`;
        // Use whichever key identifies this patient best
        const key = pid && pid !== '0' && pid !== 'undefined' && pid !== 'null' ? pid : (nameKey !== '|' ? nameKey : '');
        if (!key) continue;
        const existing = latestPlanByPatient.get(key);
        if (!existing || new Date(tp.updated_at || tp.created_at || 0).getTime() > new Date(existing.updated_at || existing.created_at || 0).getTime()) {
          latestPlanByPatient.set(key, tp);
        }
      }
      // Second pass: also dedup by patient_name if different keys resolved to the same patient
      const finalPlanByName = new Map<string, typeof activePlansAll[0]>();
      for (const [, tp] of latestPlanByPatient) {
        const nameKey = `${(tp.patient_name || '').trim().toLowerCase()}|${((tp as any).hospital_number || '').trim().toLowerCase()}`;
        const existing = finalPlanByName.get(nameKey);
        if (!existing || new Date(tp.updated_at || tp.created_at || 0).getTime() > new Date(existing.updated_at || existing.created_at || 0).getTime()) {
          finalPlanByName.set(nameKey, tp);
        }
      }
      const dedupedPlans = Array.from(finalPlanByName.values());

      // Pending Tasks: count actual incomplete items within deduped active plans
      let pendingTasks = 0;
      let urgentItems = 0;
      for (const tp of dedupedPlans) {
        const meds = ((tp as any).medications || []).filter((m: any) => m.status && m.status !== 'completed' && m.status !== 'discontinued' && m.status !== 'stopped');
        const invs = ((tp as any).investigations || []).filter((i: any) => i.status && i.status !== 'completed');
        const procs = ((tp as any).procedures || []).filter((p: any) => p.status && p.status !== 'completed');
        const discharge = Array.isArray((tp as any).discharge_criteria) ? (tp as any).discharge_criteria.filter((d: any) => !d.met && !d.completed) : [];
        pendingTasks += meds.length + invs.length + procs.length + discharge.length;

        // Urgent: overdue investigations or procedures past their scheduled date
        const now = Date.now();
        const overdueInvs = invs.filter((i: any) => i.due_date && new Date(i.due_date).getTime() < now);
        const overdueProcs = procs.filter((p: any) => p.scheduled_date && new Date(p.scheduled_date).getTime() < now);
        urgentItems += overdueInvs.length + overdueProcs.length;
      }

      // Lab results: count completed results ready for review
      const allLabInvestigations = await db.lab_investigations?.toArray() || [];
      const labResults = allLabInvestigations.filter((li: any) => 
        li.status === 'completed' || li.result
      ).length;

      const admittedPatients = dPatients.filter(p => p.admission_status === 'active').length;

      setStats({
        activePatients,
        myPatients: dPatients.length,
        admittedPatients,
        pendingTasks,
        labResults,
        urgentItems
      });

      // Generate recent activities
      const activities = [];
      const recentPlans = allTreatmentPlans
        .filter(tp => tp.created_at && !tp.deleted)
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
        .slice(0, 2);
      
      for (const plan of recentPlans) {
        const patient = allPatients.find((p: any) => p.id === plan.patient_id);
        if (patient) {
          activities.push({
            id: plan.id?.toString() || '',
            title: `Treatment plan: ${plan.title} for ${patient.first_name} ${patient.last_name}`,
            time: formatTimeAgo(new Date(plan.created_at)),
            type: 'plan'
          });
        }
      }

      const recentPatients = allPatients
        .filter((p: any) => p.created_at && !p.deleted)
        .sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
        .slice(0, 1);
      
      for (const patient of recentPatients) {
        activities.push({
          id: patient.id?.toString() || '',
          title: `New patient registered: ${patient.first_name} ${patient.last_name}`,
          time: formatTimeAgo(new Date(patient.created_at)),
          type: 'registration'
        });
      }

      setRecentActivities(activities.slice(0, 3));

      // Load treatment plan summaries for this user's patients
      try {
        const myPatientIds = new Set(dPatients.map(p => Number(p.id)));
        const activePlans = allTreatmentPlans.filter(tp =>
          !tp.deleted && (tp.status === 'active' || tp.status === 'draft') &&
          (isAdmin || myPatientIds.has(Number(tp.patient_id)))
        );

        // Deduplicate: keep only the most recent plan per patient for the tracker
        const trackerByPatient = new Map<string, typeof activePlans[0]>();
        for (const tp of activePlans) {
          const pid = String(tp.patient_id || (tp as any).patientId || '').trim();
          const nameKey = `${(tp.patient_name || '').trim().toLowerCase()}|${((tp as any).hospital_number || '').trim().toLowerCase()}`;
          const key = pid && pid !== '0' && pid !== 'undefined' && pid !== 'null' ? pid : (nameKey !== '|' ? nameKey : '');
          if (!key) continue;
          const existing = trackerByPatient.get(key);
          if (!existing || new Date(tp.updated_at || tp.created_at || 0).getTime() > new Date(existing.updated_at || existing.created_at || 0).getTime()) {
            trackerByPatient.set(key, tp);
          }
        }
        // Second pass dedup by name+hospital_number
        const trackerByName = new Map<string, typeof activePlans[0]>();
        for (const [, tp] of trackerByPatient) {
          const nameKey = `${(tp.patient_name || '').trim().toLowerCase()}|${((tp as any).hospital_number || '').trim().toLowerCase()}`;
          const existing = trackerByName.get(nameKey);
          if (!existing || new Date(tp.updated_at || tp.created_at || 0).getTime() > new Date(existing.updated_at || existing.created_at || 0).getTime()) {
            trackerByName.set(nameKey, tp);
          }
        }
        const uniquePatientPlans = Array.from(trackerByName.values())
          .sort((a, b) => new Date(b.updated_at || b.created_at || 0).getTime() - new Date(a.updated_at || a.created_at || 0).getTime());

        const planSummaries = uniquePatientPlans.slice(0, 10).map(plan => {
          const patient = activePatientsList.find((p: any) =>
            String(p.id) === String(plan.patient_id) ||
            String(p.serverId) === String(plan.patient_id) ||
            (p.hospital_number && p.hospital_number === (plan as any).hospital_number)
          );
          const meds = (plan as any).medications || [];
          const invs = (plan as any).investigations || [];
          const procs = (plan as any).procedures || [];
          const discharge = (plan as any).discharge_criteria || [];
          const activeMeds = meds.filter((m: any) => m.status === 'active').length;
          const completedInvs = invs.filter((i: any) => i.status === 'completed').length;
          const completedProcs = procs.filter((p: any) => p.status === 'completed').length;
          const dischargeMet = Array.isArray(discharge) ? discharge.filter((d: any) => d.met || d.completed).length : 0;
          const dischargeTotal = Array.isArray(discharge) ? discharge.length : 0;

          const totalItems = meds.length + invs.length + procs.length + dischargeTotal;
          const completedItems = activeMeds + completedInvs + completedProcs + dischargeMet;
          const compliancePercent = totalItems > 0 ? Math.round((completedItems / totalItems) * 100) : 0;

          return {
            id: String(plan.id || ''),
            patientName: patient
              ? (`${patient.first_name || ''} ${patient.last_name || ''}`.trim() || patient.full_name || plan.patient_name || 'Unnamed')
              : (plan.patient_name || 'Unnamed'),
            hospitalNumber: patient?.hospital_number || (plan as any).hospital_number || '',
            title: plan.title || 'Treatment Plan',
            status: plan.status || 'active',
            totalMeds: meds.length,
            activeMeds,
            totalInvestigations: invs.length,
            completedInvestigations: completedInvs,
            totalProcedures: procs.length,
            completedProcedures: completedProcs,
            dischargeMet,
            dischargeTotal,
            compliancePercent,
            createdAt: plan.created_at ? new Date(plan.created_at).toLocaleDateString() : ''
          };
        });

        setTreatmentPlanSummaries(planSummaries);
      } catch (e) {
        console.error('Failed to load treatment plan summaries:', e);
      }
    } catch (error) {
      console.error('Error loading dashboard data:', error);
    }
  };

  const loadStaffList = async () => {
    try {
      const all = await userManagementService.getAllApprovedUsers();
      setStaffList(all);
    } catch {
      // Fallback: load from local IndexedDB
      try {
        const localUsers = await db.users?.toArray() || [];
        const mapped: ApprovedUser[] = localUsers
          .filter((u: any) => u.is_approved && u.is_active === true)
          .map((u: any) => ({
            id: u.id,
            full_name: u.full_name || u.name || u.username || 'Unknown',
            email: u.email || '',
            role: u.role || 'house_officer',
            is_approved: true,
            is_active: true,
            username: u.username || u.email || '',
            created_at: u.created_at || '',
          }));
        if (mapped.length > 0) setStaffList(mapped);
      } catch { /* no local fallback available */ }
    }
  };

  const loadHODutyData = async () => {
    try {
      const schedule = getTodaySchedule();
      // Load roster config from IndexedDB (same source as UnitRosterWidget)
      let config: UnitRosterConfig | null = null;
      try {
        const rosters = await db.ps_unit_rosters?.toArray() || [];
        const active = rosters.find((r: any) => r.isActive || r.is_active);
        if (active) {
          config = {
            startDate: active.startDate || active.start_date,
            rotationWeeks: active.rotationWeeks || active.rotation_weeks || 2,
            seniorRegistrars: active.seniorRegistrars || active.senior_registrars || [],
            houseOfficers: active.houseOfficers || active.house_officers || [],
            isActive: true,
          };
        }
      } catch { /* roster table may not exist */ }

      let unit1HO = '', unit2HO = '', unit1SR = '', unit2SR = '';
      if (config) {
        const assignments = getCurrentAssignments(config);
        unit1HO = assignments.unit1.houseOfficer;
        unit2HO = assignments.unit2.houseOfficer;
        unit1SR = assignments.unit1.seniorRegistrar;
        unit2SR = assignments.unit2.seniorRegistrar;
      }

      setHoDutyData({ todaySchedule: schedule, unit1HO, unit2HO, unit1SR, unit2SR });
    } catch { /* non-critical */ }
  };

  const handleStaffLookup = async (staffId: string) => {
    setSelectedStaffId(staffId);
    if (!staffId) { setStaffPatients([]); return; }
    setStaffLookupLoading(true);
    try {
      const staffUser = staffList.find(u => String(u.id) === staffId);
      if (!staffUser) { setStaffPatients([]); return; }
      const staffName = staffUser.full_name.toLowerCase();
      const staffNumId = Number(staffId);

      // Load patient_assignments for ID-based matching
      let allAssignments: any[] = [];
      try { allAssignments = await db.patient_assignments.toArray(); } catch { /* */ }
      const assignedPatientIds = new Set<number>();
      for (const a of allAssignments) {
        if (!a.is_active) continue;
        if (a.consultant_id === staffNumId || a.senior_registrar_id === staffNumId ||
            a.registrar_id === staffNumId || a.house_officer_id === staffNumId) {
          assignedPatientIds.add(a.patient_id);
        }
      }

      const allPatients = await patientService.getAllPatients();
      const activePatientsList = allPatients.filter((p: any) => !p.deleted);
      let activeAdmissions: Admission[] = [];
      try { activeAdmissions = await admissionDischargeService.getActiveAdmissions(); } catch {}
      const admissionByPid = new Map<string, Admission>();
      const admissionByHn = new Map<string, Admission>();
      for (const adm of activeAdmissions) {
        admissionByPid.set(String(adm.patient_id), adm);
        if (adm.hospital_number) admissionByHn.set(adm.hospital_number.trim().toLowerCase(), adm);
      }

      // Resolve HO names
      let allUsers: any[] = [];
      try { allUsers = await db.users.toArray(); } catch { /* */ }
      const userById = new Map<number, any>();
      for (const u of allUsers) userById.set(u.id, u);
      const assignmentByPid = new Map<number, any>();
      for (const a of allAssignments) { if (a.is_active) assignmentByPid.set(a.patient_id, a); }

      const matched: DashboardPatient[] = [];
      for (const p of activePatientsList) {
        const pid = String(p.id || p.serverId || '');
        const numPid = Number(pid);
        const hn = (p.hospital_number || '').trim().toLowerCase();
        const adm = admissionByPid.get(pid) || (hn ? admissionByHn.get(hn) : undefined);
        const assignment = assignmentByPid.get(numPid);
        const consultant = (adm?.admitting_consultant || p.consultant_in_charge || '').toLowerCase();
        // Resolve resident name from patient_assignments for matching, NOT admitting_doctor
        const srMatch = assignment?.senior_registrar_id ? userById.get(assignment.senior_registrar_id) : null;
        const regMatch = assignment?.registrar_id ? userById.get(assignment.registrar_id) : null;
        const residentForMatch = (srMatch ? (srMatch.full_name || srMatch.name || '') : regMatch ? (regMatch.full_name || regMatch.name || '') : (p.resident_in_charge || '')).toLowerCase();

        const isAssigned = assignedPatientIds.has(numPid) ||
          consultant.includes(staffName) || residentForMatch.includes(staffName) ||
          (p.consultant_in_charge || '').toLowerCase().includes(staffName) ||
          (p.resident_in_charge || '').toLowerCase().includes(staffName) ||
          adm?.admitting_consultant?.toLowerCase().includes(staffName) ||
          adm?.created_by === staffId;

        if (isAssigned) {
          const hoUser = assignment?.house_officer_id ? userById.get(assignment.house_officer_id) : null;
          // Resolve resident from patient_assignments (senior_registrar or registrar), NOT admitting_doctor
          const srStaff = assignment?.senior_registrar_id ? userById.get(assignment.senior_registrar_id) : null;
          const regStaff = assignment?.registrar_id ? userById.get(assignment.registrar_id) : null;
          const residentName = srStaff ? (srStaff.full_name || srStaff.name || '') : regStaff ? (regStaff.full_name || regStaff.name || '') : (p.resident_in_charge || '');
          const assignedConsultantUser = assignment?.consultant_id ? userById.get(assignment.consultant_id) : null;
          const consultantName = assignedConsultantUser ? (assignedConsultantUser.full_name || assignedConsultantUser.name || '') : (adm?.admitting_consultant || p.consultant_in_charge || '');
          matched.push({
            id: p.id || p.serverId || '',
            name: `${p.first_name || ''} ${p.last_name || ''}`.trim() || p.full_name || 'Unknown',
            hospital_number: p.hospital_number || '',
            ward: adm?.ward_location || p.ward_id || '',
            bed: adm?.bed_number || p.bed_number || '',
            consultant: consultantName,
            resident: residentName,
            house_officer: hoUser ? (hoUser.full_name || hoUser.name || '') : '',
            admission_status: adm ? 'active' as const : 'outpatient' as const,
            admission_date: adm ? new Date(adm.admission_date).toLocaleDateString() : undefined
          });
        }
      }
      setStaffPatients(matched);
    } catch { setStaffPatients([]); }
    finally { setStaffLookupLoading(false); }
  };

  const handleAutoAssignHO = async () => {
    setAutoAssigning(true);
    setAutoAssignResult(null);
    try {
      const result = await medicalTeamService.autoAssignAdmittedPatientsToHouseOfficers();
      setAutoAssignResult(`Assigned ${result.assigned} of ${result.total} admitted patients to house officers.`);
      // Reload dashboard data
      await loadDashboardData();
    } catch (err: any) {
      setAutoAssignResult(`Error: ${err.message || 'Failed to auto-assign'}`);
    } finally { setAutoAssigning(false); }
  };

  const handleReassignHO = async () => {
    setAutoAssigning(true);
    setAutoAssignResult(null);
    try {
      const result = await medicalTeamService.reassignAllHouseOfficers();
      setAutoAssignResult(`Reassigned ${result.reassigned} admitted patients evenly across house officers.`);
      await loadDashboardData();
    } catch (err: any) {
      setAutoAssignResult(`Error: ${err.message || 'Failed to reassign'}`);
    } finally { setAutoAssigning(false); }
  };

  const toggleSelectPatient = (id: string | number) => {
    setSelectedForDischarge(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedForDischarge.size === filteredPatients.length) {
      setSelectedForDischarge(new Set());
    } else {
      setSelectedForDischarge(new Set(filteredPatients.map(p => p.id)));
    }
  };

  const handleForceDischargeSelected = async () => {
    const selectedIds = Array.from(selectedForDischarge);
    if (selectedIds.length === 0) {
      toast.error('No patients selected for discharge');
      return;
    }
    const confirmed = window.confirm(
      `⚠️ FORCE DISCHARGE ${selectedIds.length} PATIENT(S) ⚠️\n\nThis will discharge the ${selectedIds.length} selected patient(s).\n\nThis action is intended for clearing test data and cannot be undone.\n\nAre you sure?`
    );
    if (!confirmed) return;

    setForceDischarging(true);
    try {
      const selectedPidSet = new Set(selectedIds.map(String));

      // 1. Call server API to discharge selected in PostgreSQL
      const { apiClient } = await import('../services/apiClient');
      try {
        const response = await apiClient.post('/admissions', {
          action: 'force-discharge-selected',
          patient_ids: selectedIds.map(Number)
        });
        toast.success(`Server: ${response.message || `Discharged ${response.count} admissions`}`);
      } catch (apiErr: any) {
        console.warn('Server force-discharge failed (will still update local):', apiErr.message);
      }

      // 2. Update matching active admissions in local IndexedDB
      const allAdmissions = await db.admissions.toArray();
      const now = new Date().toISOString().split('T')[0];
      let localCount = 0;
      for (const adm of allAdmissions) {
        if (adm.status === 'active' && selectedPidSet.has(String(adm.patient_id))) {
          await db.admissions.update(adm.id!, {
            status: 'discharged',
            discharge_date: now,
            updated_at: new Date()
          });
          localCount++;
        }
      }

      toast.success(`Force-discharged ${localCount} admissions locally`);
      setSelectedForDischarge(new Set());
      await loadDashboardData();
    } catch (err: any) {
      toast.error(`Error: ${err.message || 'Failed to force discharge'}`);
    } finally {
      setForceDischarging(false);
    }
  };

  const formatTimeAgo = (date: Date): string => {
    const seconds = Math.floor((new Date().getTime() - date.getTime()) / 1000);
    if (seconds < 60) return 'just now';
    if (seconds < 3600) return `${Math.floor(seconds / 60)} minutes ago`;
    if (seconds < 3600 * 24) return `${Math.floor(seconds / 3600)} hours ago`;
    if (seconds < 604800) return `${Math.floor(seconds / 86400)} days ago`;
    return `${Math.floor(seconds / 604800)} weeks ago`;
  };

  // Load all patients for Force Admit / Emergency Surgery modals
  const loadAllPatients = async () => {
    try {
      const pts = await patientService.getAllPatients();
      setAllPatients(pts.filter((p: any) => !p.deleted));
    } catch { /* ignore */ }
  };

  const openForceAdmitModal = () => {
    loadAllPatients();
    setFaPatientSearch('');
    setFaSelectedPatient(null);
    setFaWard('');
    setFaBed('');
    setFaDiagnosis('');
    setFaConsultant('');
    setFaReason('');
    setShowForceAdmitModal(true);
  };

  const handleForceAdmit = async () => {
    if (!faSelectedPatient) { toast.error('Select a patient'); return; }
    if (!faWard.trim()) { toast.error('Ward is required'); return; }
    if (!faDiagnosis.trim()) { toast.error('Provisional diagnosis is required'); return; }

    setForceAdmitting(true);
    try {
      const now = new Date();
      const admissionData: Omit<Admission, 'id' | 'created_at' | 'updated_at'> = {
        patient_id: faSelectedPatient.id!,
        patient_name: faSelectedPatient.name || `${faSelectedPatient.first_name || ''} ${faSelectedPatient.last_name || ''}`.trim(),
        hospital_number: faSelectedPatient.hospital_number || '',
        admission_date: now.toISOString().split('T')[0],
        admission_time: now.toTimeString().slice(0, 5),
        ward_location: faWard.trim(),
        bed_number: faBed.trim() || undefined,
        route_of_admission: 'emergency',
        reasons_for_admission: faReason.trim() || faDiagnosis.trim(),
        presenting_complaint: faReason.trim() || faDiagnosis.trim(),
        provisional_diagnosis: faDiagnosis.trim(),
        admitting_doctor: getCurrentUserName(),
        admitting_consultant: faConsultant || undefined,
        status: 'active',
        created_by: getCurrentUserName(),
        created_at: now,
        updated_at: now,
      };

      await admissionDischargeService.createAdmission(admissionData);
      toast.success(`${admissionData.patient_name} admitted to ${faWard}`);
      setShowForceAdmitModal(false);
      await loadDashboardData();
    } catch (err: any) {
      toast.error(`Admission failed: ${err.message || 'Unknown error'}`);
    } finally {
      setForceAdmitting(false);
    }
  };

  const openEmergencySurgeryModal = () => {
    loadAllPatients();
    setEsPatientSearch('');
    setEsSelectedPatient(null);
    setEsProcedure('');
    setEsIndication('');
    setEsSurgeon('');
    setEsAssistant('');
    setEsAnaesthetist('');
    setEsAnaesthesiaType('general');
    setEsTheatre('');
    setEsDuration('60');
    setEsDiagnosis('');
    setEsBloodType('');
    setEsInfected(false);
    setEsHivPositive(false);
    setEsDiabetic(false);
    setEsSpecialReqs('');
    setEsNotes('');
    setShowEmergencySurgeryModal(true);
  };

  const handleEmergencySurgeryBooking = async () => {
    if (!esSelectedPatient) { toast.error('Select a patient'); return; }
    if (!esProcedure.trim()) { toast.error('Procedure name is required'); return; }
    if (!esSurgeon.trim()) { toast.error('Primary surgeon is required'); return; }

    setBookingSurgery(true);
    try {
      const now = new Date();
      const booking: Omit<SurgeryBooking, 'id' | 'created_at' | 'updated_at'> = {
        date: now.toISOString().split('T')[0],
        theatre_number: esTheatre.trim() || 'Emergency Theatre',
        start_time: now.toTimeString().slice(0, 5),
        estimated_end_time: new Date(now.getTime() + parseInt(esDuration || '60') * 60000).toTimeString().slice(0, 5),
        primary_surgeon: esSurgeon.trim(),
        assistant_surgeon: esAssistant.trim() || undefined,
        anaesthetist: esAnaesthetist.trim() || undefined,
        patient_id: esSelectedPatient.id!,
        patient_name: esSelectedPatient.name || `${esSelectedPatient.first_name || ''} ${esSelectedPatient.last_name || ''}`.trim(),
        hospital_number: esSelectedPatient.hospital_number || '',
        procedure_name: esProcedure.trim(),
        urgency: 'emergency',
        anaesthesia_type: esAnaesthesiaType,
        estimated_duration_minutes: parseInt(esDuration || '60'),
        is_emergency: true,
        is_infected: esInfected,
        is_hiv_positive: esHivPositive,
        is_diabetic: esDiabetic,
        case_category: 'emergency',
        special_requirements: esSpecialReqs.trim() ? [esSpecialReqs.trim()] : [],
        notes: [esNotes.trim(), esIndication.trim() ? `Indication: ${esIndication.trim()}` : ''].filter(Boolean).join('\n') || undefined,
        medical_conditions: esDiagnosis.trim() ? [esDiagnosis.trim()] : [],
        remarks: esBloodType.trim() ? [`Blood type: ${esBloodType.trim()}`] : [],
        status: 'scheduled',
      };

      await schedulingService.createSurgeryBooking(booking);
      toast.success(`Emergency surgery booked for ${booking.patient_name}`);
      setShowEmergencySurgeryModal(false);
    } catch (err: any) {
      toast.error(`Booking failed: ${err.message || 'Unknown error'}`);
    } finally {
      setBookingSurgery(false);
    }
  };

  // Filter patients by search, ward, and admission status (admitted only for admin)
  const filteredPatients = dashboardPatients.filter(p => {
    // Only show admitted patients
    if (p.admission_status !== 'active') return false;
    const matchesSearch = !patientSearch || 
      p.name.toLowerCase().includes(patientSearch.toLowerCase()) ||
      p.hospital_number.toLowerCase().includes(patientSearch.toLowerCase()) ||
      p.consultant.toLowerCase().includes(patientSearch.toLowerCase()) ||
      p.resident.toLowerCase().includes(patientSearch.toLowerCase());
    const matchesWard = wardFilter === 'all' || p.ward === wardFilter;
    return matchesSearch && matchesWard;
  });

  const statsDisplay = [
    {
      name: isAdmin ? 'Total Patients' : 'My Patients',
      value: stats.myPatients.toString(),
      icon: UserCheck,
      color: 'text-primary-600',
      bg: 'bg-primary-50',
    },
    {
      name: 'On Admission',
      value: stats.admittedPatients.toString(),
      icon: Building2,
      color: 'text-emerald-600',
      bg: 'bg-emerald-50',
    },
    {
      name: 'Pending Items',
      value: stats.pendingTasks.toString(),
      icon: ClipboardCheck,
      color: 'text-yellow-600',
      bg: 'bg-yellow-50',
    },
    {
      name: 'Lab Results',
      value: stats.labResults.toString(),
      icon: FlaskConical,
      color: 'text-blue-600',
      bg: 'bg-blue-50',
    },
    {
      name: 'Overdue Items',
      value: stats.urgentItems.toString(),
      icon: AlertTriangle,
      color: 'text-danger-600',
      bg: 'bg-danger-50',
    },
  ];

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Header */}
      <div className="page-header">
        <h1 className="page-title">
          Welcome back, {user?.name?.split(' ')[1] || user?.name}
        </h1>
        <p className="page-subtitle">
          {isAdmin 
            ? "Admin overview — all patients and their assigned team members."
            : "Here's what's happening with your assigned patients today."}
        </p>
      </div>

      {/* HO Responsibilities Quick Reference Card — visible to all */}
      <HOResponsibilitiesCard onOpen={() => setShowHOGuide(true)} />

      {/* Stats Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 sm:gap-6">
        {statsDisplay.map((stat) => (
          <div key={stat.name} className="stat-card">
            <div className="flex items-center">
              <div className={`p-2 sm:p-3 rounded-lg ${stat.bg}`}>
                <stat.icon className={`h-5 w-5 sm:h-6 sm:w-6 ${stat.color}`} />
              </div>
              <div className="ml-3 sm:ml-4 min-w-0">
                <p className="stat-label truncate">{stat.name}</p>
                <p className="stat-value">{stat.value}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Patient List Section */}
      <div className="card p-4 sm:p-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
          <h3 className="text-base sm:text-lg font-semibold text-clinical-dark flex items-center gap-2">
            <UserCheck className="h-5 w-5 text-primary-600" />
            {isAdmin ? 'Admitted Patients & Assignments' : 'My Assigned Patients'}
            <span className="text-sm font-normal text-gray-500">({filteredPatients.length})</span>
          </h3>
          <div className="flex flex-col sm:flex-row gap-2">
            {isAdmin && (
              <>
                <button
                  onClick={handleAutoAssignHO}
                  disabled={autoAssigning}
                  className="px-3 py-1.5 text-xs font-medium rounded-lg bg-primary-600 text-white hover:bg-primary-700 disabled:opacity-50"
                >
                  {autoAssigning ? 'Assigning...' : 'Auto-Assign HOs'}
                </button>
                <button
                  onClick={handleReassignHO}
                  disabled={autoAssigning}
                  className="px-3 py-1.5 text-xs font-medium rounded-lg bg-amber-600 text-white hover:bg-amber-700 disabled:opacity-50"
                >
                  {autoAssigning ? 'Reassigning...' : 'Reassign All HOs'}
                </button>
                <button
                  onClick={handleForceDischargeSelected}
                  disabled={forceDischarging || selectedForDischarge.size === 0}
                  className="px-3 py-1.5 text-xs font-medium rounded-lg bg-red-600 text-white hover:bg-red-700 disabled:opacity-50"
                >
                  {forceDischarging ? 'Discharging...' : `Force Discharge (${selectedForDischarge.size})`}
                </button>
                <button
                  onClick={openForceAdmitModal}
                  className="px-3 py-1.5 text-xs font-medium rounded-lg bg-green-600 text-white hover:bg-green-700 flex items-center gap-1"
                >
                  <Plus className="h-3.5 w-3.5" /> Force Admit
                </button>
                <button
                  onClick={openEmergencySurgeryModal}
                  className="px-3 py-1.5 text-xs font-medium rounded-lg bg-orange-600 text-white hover:bg-orange-700 flex items-center gap-1"
                >
                  <Siren className="h-3.5 w-3.5" /> Emergency Surgery
                </button>
              </>
            )}
            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search patients..."
                value={patientSearch}
                onChange={(e) => setPatientSearch(e.target.value)}
                className="pl-9 pr-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-primary-500 focus:border-primary-500 w-full sm:w-56"
              />
            </div>
            {/* Ward Filter */}
            {availableWards.length > 0 && (
              <select
                value={wardFilter}
                onChange={(e) => setWardFilter(e.target.value)}
                className="py-2 px-3 text-sm border border-gray-300 rounded-lg focus:ring-primary-500 focus:border-primary-500"
              >
                <option value="all">All Wards</option>
                {availableWards.map(w => (
                  <option key={w} value={w}>{w}</option>
                ))}
              </select>
            )}
          </div>
        </div>

        {autoAssignResult && (
          <div className="mb-3 px-3 py-2 rounded-lg bg-blue-50 text-blue-800 text-sm">
            {autoAssignResult}
          </div>
        )}

        {filteredPatients.length > 0 ? (
          <>
            {/* Desktop Table */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 text-left">
                    {isAdmin && (
                      <th className="px-3 py-2 w-8">
                        <input
                          type="checkbox"
                          checked={filteredPatients.length > 0 && selectedForDischarge.size === filteredPatients.length}
                          onChange={toggleSelectAll}
                          className="h-4 w-4 rounded border-gray-300 text-red-600 focus:ring-red-500 cursor-pointer"
                          title="Select all for discharge"
                        />
                      </th>
                    )}
                    <th className="px-3 py-2 font-medium text-gray-600">Patient</th>
                    <th className="px-3 py-2 font-medium text-gray-600">Hospital #</th>
                    <th className="px-3 py-2 font-medium text-gray-600">
                      <span className="flex items-center gap-1"><MapPin className="h-3.5 w-3.5" /> Location</span>
                    </th>
                    {isAdmin && (
                      <>
                        <th className="px-3 py-2 font-medium text-gray-600">Consultant</th>
                        <th className="px-3 py-2 font-medium text-gray-600">Resident</th>
                        <th className="px-3 py-2 font-medium text-gray-600">House Officer</th>
                      </>
                    )}
                    <th className="px-3 py-2 font-medium text-gray-600">Status</th>
                    <th className="px-3 py-2 font-medium text-gray-600"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {filteredPatients.map((p) => (
                    <tr
                      key={p.id}
                      className={`hover:bg-primary-50/50 cursor-pointer transition-colors ${selectedForDischarge.has(p.id) ? 'bg-red-50' : ''}`}
                      onClick={() => navigate(`/patients/${p.id}`)}
                    >
                      {isAdmin && (
                        <td className="px-3 py-3" onClick={(e) => e.stopPropagation()}>
                          <input
                            type="checkbox"
                            checked={selectedForDischarge.has(p.id)}
                            onChange={() => toggleSelectPatient(p.id)}
                            className="h-4 w-4 rounded border-gray-300 text-red-600 focus:ring-red-500 cursor-pointer"
                          />
                        </td>
                      )}
                      <td className="px-3 py-3 font-medium text-clinical-dark">{p.name}</td>
                      <td className="px-3 py-3 text-gray-600">{p.hospital_number}</td>
                      <td className="px-3 py-3">
                        {p.ward ? (
                          <span className="inline-flex items-center gap-1 text-gray-700">
                            <Building2 className="h-3.5 w-3.5 text-primary-500" />
                            {p.ward}{p.bed ? `, Bed ${p.bed}` : ''}
                          </span>
                        ) : (
                          <span className="text-gray-400 text-xs">—</span>
                        )}
                      </td>
                      {isAdmin && (
                        <>
                          <td className="px-3 py-3 text-gray-600">{p.consultant || <span className="text-gray-400 text-xs">Unassigned</span>}</td>
                          <td className="px-3 py-3 text-gray-600">{p.resident || <span className="text-gray-400 text-xs">Unassigned</span>}</td>
                          <td className="px-3 py-3 text-gray-600">{p.house_officer || <span className="text-gray-400 text-xs">Unassigned</span>}</td>
                        </>
                      )}
                      <td className="px-3 py-3">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                          p.admission_status === 'active' 
                            ? 'bg-green-100 text-green-800' 
                            : 'bg-gray-100 text-gray-600'
                        }`}>
                          {p.admission_status === 'active' ? 'Admitted' : 'Outpatient'}
                        </span>
                      </td>
                      <td className="px-3 py-3">
                        <ChevronRight className="h-4 w-4 text-gray-400" />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile Cards */}
            <div className="md:hidden space-y-2">
              {filteredPatients.map((p) => (
                <div
                  key={p.id}
                  className={`border rounded-lg p-3 hover:bg-primary-50/50 cursor-pointer transition-colors ${selectedForDischarge.has(p.id) ? 'border-red-300 bg-red-50' : 'border-gray-200'}`}
                  onClick={() => navigate(`/patients/${p.id}`)}
                >
                  <div className="flex justify-between items-start">
                    <div className="flex items-center gap-2">
                      {isAdmin && (
                        <input
                          type="checkbox"
                          checked={selectedForDischarge.has(p.id)}
                          onChange={() => toggleSelectPatient(p.id)}
                          onClick={(e) => e.stopPropagation()}
                          className="h-4 w-4 rounded border-gray-300 text-red-600 focus:ring-red-500 cursor-pointer"
                        />
                      )}
                      <div>
                        <p className="font-medium text-clinical-dark">{p.name}</p>
                        <p className="text-xs text-gray-500">{p.hospital_number}</p>
                      </div>
                    </div>
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                      p.admission_status === 'active' 
                        ? 'bg-green-100 text-green-800' 
                        : 'bg-gray-100 text-gray-600'
                    }`}>
                      {p.admission_status === 'active' ? 'Admitted' : 'Outpatient'}
                    </span>
                  </div>
                  {p.ward && (
                    <p className="text-xs text-gray-600 mt-1 flex items-center gap-1">
                      <MapPin className="h-3 w-3 text-primary-500" />
                      {p.ward}{p.bed ? `, Bed ${p.bed}` : ''}
                    </p>
                  )}
                  {isAdmin && (p.consultant || p.resident || p.house_officer) && (
                    <div className="mt-1 text-xs text-gray-500">
                      {p.consultant && <span>Consultant: {p.consultant}</span>}
                      {p.consultant && p.resident && <span> · </span>}
                      {p.resident && <span>Resident: {p.resident}</span>}
                      {(p.consultant || p.resident) && p.house_officer && <span> · </span>}
                      {p.house_officer && <span>HO: {p.house_officer}</span>}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </>
        ) : (
          <div className="text-center py-8 text-gray-500">
            <Users className="h-10 w-10 mx-auto mb-2 text-gray-300" />
            <p className="text-sm">
              {patientSearch || wardFilter !== 'all' 
                ? 'No patients match your search criteria.' 
                : isAdmin 
                  ? 'No patients registered yet.'
                  : 'No patients assigned to you yet.'}
            </p>
          </div>
        )}
      </div>

      {/* Treatment Plan Tracking */}
      <div className="card p-4 sm:p-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
          <h3 className="text-base sm:text-lg font-semibold text-clinical-dark flex items-center gap-2">
            <ClipboardCheck className="h-5 w-5 text-primary-600" />
            Treatment Plan Tracker
            <span className="text-sm font-normal text-gray-500">({treatmentPlanSummaries.length})</span>
          </h3>
          <div className="flex gap-2">
            <Link
              to="/treatment-plan-creator"
              className="px-3 py-1.5 text-xs font-medium rounded-lg bg-primary-600 text-white hover:bg-primary-700"
            >
              + New Plan
            </Link>
            <Link
              to="/treatment-plan-manager"
              className="px-3 py-1.5 text-xs font-medium rounded-lg bg-gray-100 text-gray-700 hover:bg-gray-200"
            >
              View All
            </Link>
          </div>
        </div>

        {treatmentPlanSummaries.length > 0 ? (
          <div className="space-y-3">
            {treatmentPlanSummaries.map(plan => (
              <div
                key={plan.id}
                className="border border-gray-200 rounded-lg p-3 hover:bg-primary-50/50 cursor-pointer transition-colors"
                onClick={() => navigate('/treatment-plan-manager')}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-medium text-clinical-dark truncate">{plan.patientName}</p>
                      <span className="text-xs text-gray-500">{plan.hospitalNumber}</span>
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                        plan.status === 'active' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'
                      }`}>
                        {plan.status}
                      </span>
                    </div>
                    <p className="text-xs text-gray-500 mt-0.5">{plan.title}</p>
                    {/* Quick stats row */}
                    <div className="flex flex-wrap gap-3 mt-2 text-xs text-gray-600">
                      <span className="flex items-center gap-1">
                        <Pill className="h-3 w-3 text-blue-500" />
                        {plan.activeMeds}/{plan.totalMeds} meds
                      </span>
                      <span className="flex items-center gap-1">
                        <FlaskConical className="h-3 w-3 text-purple-500" />
                        {plan.completedInvestigations}/{plan.totalInvestigations} labs
                      </span>
                      <span className="flex items-center gap-1">
                        <Activity className="h-3 w-3 text-amber-500" />
                        {plan.completedProcedures}/{plan.totalProcedures} procedures
                      </span>
                      {plan.dischargeTotal > 0 && (
                        <span className="flex items-center gap-1">
                          <FileText className="h-3 w-3 text-green-500" />
                          {plan.dischargeMet}/{plan.dischargeTotal} discharge
                        </span>
                      )}
                    </div>
                  </div>
                  {/* Compliance ring */}
                  <div className="flex-shrink-0">
                    <svg width="44" height="44" viewBox="0 0 44 44" className="transform -rotate-90">
                      <circle cx="22" cy="22" r="18" stroke="#e5e7eb" strokeWidth="4" fill="none" />
                      <circle
                        cx="22" cy="22" r="18"
                        stroke={plan.compliancePercent >= 80 ? '#10b981' : plan.compliancePercent >= 50 ? '#f59e0b' : '#ef4444'}
                        strokeWidth="4"
                        fill="none"
                        strokeDasharray={`${(plan.compliancePercent / 100) * 113.1} 113.1`}
                        strokeLinecap="round"
                      />
                    </svg>
                    <p className="text-xs text-center font-medium mt-0.5" style={{
                      color: plan.compliancePercent >= 80 ? '#10b981' : plan.compliancePercent >= 50 ? '#f59e0b' : '#ef4444'
                    }}>
                      {plan.compliancePercent}%
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-8 text-gray-500">
            <ClipboardCheck className="h-10 w-10 mx-auto mb-2 text-gray-300" />
            <p className="text-sm">No active treatment plans found.</p>
            <Link to="/treatment-plan-creator" className="text-xs text-primary-600 hover:underline mt-1 inline-block">
              Create your first treatment plan
            </Link>
          </div>
        )}
      </div>

      {/* Staff Patient Lookup */}
      <div className="card p-4 sm:p-6">
        <h3 className="text-base sm:text-lg font-semibold text-clinical-dark flex items-center gap-2 mb-4">
          <Users className="h-5 w-5 text-blue-600" />
          Staff Patient Lookup
        </h3>
        <div className="mb-4">
          <select
            value={selectedStaffId}
            onChange={(e) => handleStaffLookup(e.target.value)}
            className="w-full px-3 py-3 text-base sm:text-sm border border-gray-300 rounded-lg bg-white focus:ring-primary-500 focus:border-primary-500 appearance-none"
            style={{ fontSize: '16px' }}
          >
            <option value="">-- Select a staff member --</option>
            {staffList.map(s => (
              <option key={s.id} value={s.id}>
                {s.full_name} ({s.role?.replace('_', ' ')})
              </option>
            ))}
          </select>
        </div>

        {staffLookupLoading && (
          <div className="text-center py-4"><Loader2 className="h-5 w-5 animate-spin mx-auto text-primary-600" /></div>
        )}

        {!staffLookupLoading && selectedStaffId && staffPatients.length > 0 && (
          <div className="space-y-2">
            <p className="text-sm text-gray-500 mb-2">{staffPatients.length} patient(s) assigned</p>
            {/* Desktop Table */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-blue-50 text-left">
                    <th className="px-3 py-2 font-medium text-gray-600">Patient</th>
                    <th className="px-3 py-2 font-medium text-gray-600">Hospital #</th>
                    <th className="px-3 py-2 font-medium text-gray-600">Ward</th>
                    <th className="px-3 py-2 font-medium text-gray-600">Status</th>
                    <th className="px-3 py-2"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {staffPatients.map((p) => (
                    <tr key={p.id} className="hover:bg-blue-50/50 cursor-pointer" onClick={() => navigate(`/patients/${p.id}`)}>
                      <td className="px-3 py-2 font-medium text-clinical-dark">{p.name}</td>
                      <td className="px-3 py-2 text-gray-600">{p.hospital_number}</td>
                      <td className="px-3 py-2 text-gray-600">{p.ward || '—'}{p.bed ? `, Bed ${p.bed}` : ''}</td>
                      <td className="px-3 py-2">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${p.admission_status === 'active' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'}`}>
                          {p.admission_status === 'active' ? 'Admitted' : 'Outpatient'}
                        </span>
                      </td>
                      <td className="px-3 py-2"><ChevronRight className="h-4 w-4 text-gray-400" /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {/* Mobile Cards */}
            <div className="md:hidden space-y-2">
              {staffPatients.map((p) => (
                <div key={p.id} className="border border-gray-200 rounded-lg p-3 hover:bg-blue-50/50 cursor-pointer" onClick={() => navigate(`/patients/${p.id}`)}>
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="font-medium text-clinical-dark">{p.name}</p>
                      <p className="text-xs text-gray-500">{p.hospital_number}</p>
                    </div>
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${p.admission_status === 'active' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'}`}>
                      {p.admission_status === 'active' ? 'Admitted' : 'Outpatient'}
                    </span>
                  </div>
                  {p.ward && <p className="text-xs text-gray-600 mt-1">{p.ward}{p.bed ? `, Bed ${p.bed}` : ''}</p>}
                </div>
              ))}
            </div>
          </div>
        )}

        {!staffLookupLoading && selectedStaffId && staffPatients.length === 0 && (
          <p className="text-sm text-gray-500 text-center py-4">No patients assigned to this staff member.</p>
        )}

        {!selectedStaffId && (
          <p className="text-sm text-gray-400 text-center py-4">Select a staff member above to view their assigned patients.</p>
        )}
      </div>

      {/* PS Unit Roster & Schedule */}
      <UnitRosterWidget />

      {/* HO Duty Section — Today's Assignments */}
      {hoDutyData && hoDutyData.todaySchedule.length > 0 && (
        <div className="card p-4 sm:p-6">
          <h3 className="text-base sm:text-lg font-semibold text-clinical-dark mb-3 flex items-center gap-2">
            <ClipboardCheck className="w-5 h-5 text-green-600" />
            Today&apos;s Duty Assignments
          </h3>
          <div className="space-y-3">
            {hoDutyData.todaySchedule.map((item, idx) => {
              const isUnit1 = item.unit.includes('1');
              const ho = isUnit1 ? hoDutyData.unit1HO : hoDutyData.unit2HO;
              const sr = isUnit1 ? hoDutyData.unit1SR : hoDutyData.unit2SR;
              const activityColor = item.activity.toLowerCase().includes('theatre')
                ? 'bg-red-50 border-red-200 text-red-800'
                : item.activity.toLowerCase().includes('clinic')
                ? 'bg-blue-50 border-blue-200 text-blue-800'
                : 'bg-green-50 border-green-200 text-green-800';
              const roleBadge = item.activity.toLowerCase().includes('theatre') ? 'Theatre Coordinator' : 'Ward Coverage';

              return (
                <div key={idx} className={`rounded-lg border p-3 ${activityColor}`}>
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-sm">{item.unit}</span>
                      <span className="text-xs px-2 py-0.5 rounded-full bg-white bg-opacity-60 font-medium">{item.activity}</span>
                    </div>
                    {item.time && <span className="text-xs opacity-75">{item.time}</span>}
                  </div>
                  <div className="flex flex-wrap gap-3 text-xs">
                    {sr && (
                      <div className="flex items-center gap-1">
                        <UserCheck className="w-3.5 h-3.5" />
                        <span className="font-medium">SR:</span> {sr}
                      </div>
                    )}
                    {ho && (
                      <div className="flex items-center gap-1">
                        <Users className="w-3.5 h-3.5" />
                        <span className="font-medium">HO:</span> {ho}
                        <span className="ml-1 px-1.5 py-0.5 bg-white bg-opacity-50 rounded text-[10px] font-medium">{roleBadge}</span>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Recent Activities & Quick Actions */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
        {/* Recent Activities */}
        <div className="card p-4 sm:p-6">
          <h3 className="text-base sm:text-lg font-semibold text-clinical-dark mb-3 sm:mb-4">
            Recent Activities
          </h3>
          <div className="space-y-3 sm:space-y-4">
            {recentActivities.length > 0 ? (
              recentActivities.map((activity) => (
                <div key={activity.id} className="flex items-start space-x-3">
                  <div className="w-2 h-2 bg-primary-500 rounded-full mt-2 flex-shrink-0"></div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-clinical-dark line-clamp-2">{activity.title}</p>
                    <p className="text-xs text-gray-500">{activity.time}</p>
                  </div>
                </div>
              ))
            ) : (
              <p className="text-sm text-gray-500">No recent activities</p>
            )}
          </div>
        </div>

        {/* Quick Actions */}
        <div className="card p-4 sm:p-6">
          <h3 className="text-base sm:text-lg font-semibold text-clinical-dark mb-3 sm:mb-4">
            Quick Actions
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-1 gap-2 sm:gap-3">
            <Link to="/patients" className="btn-primary w-full justify-start">
              <Users className="h-4 w-4 mr-2 flex-shrink-0" />
              <span className="truncate">Add New Patient</span>
            </Link>
            <Link to="/treatment-plan-creator" className="btn-secondary w-full justify-start">
              <ClipboardCheck className="h-4 w-4 mr-2 flex-shrink-0" />
              <span className="truncate">Create Treatment Plan</span>
            </Link>
            <Link to="/booking-register" className="btn-secondary w-full justify-start">
              <Calendar className="h-4 w-4 mr-2 flex-shrink-0" />
              <span className="truncate">Booking Register</span>
            </Link>
            <Link to="/labs" className="btn-secondary w-full justify-start">
              <FlaskConical className="h-4 w-4 mr-2 flex-shrink-0" />
              <span className="truncate">Order Lab Tests</span>
            </Link>
            <Link to="/notice-board" className="btn-secondary w-full justify-start">
              <Megaphone className="h-4 w-4 mr-2 flex-shrink-0" />
              <span className="truncate">Notice Board</span>
            </Link>
          </div>

          {/* Offline Cache Warmer */}
          <div className="mt-4 pt-4 border-t border-gray-200">
            <button
              onClick={handleWarmCache}
              disabled={cacheProgress?.status === 'warming' || !navigator.onLine}
              className={`w-full flex items-center justify-center gap-2 px-4 py-3 rounded-lg text-sm font-medium transition-all duration-200 ${
                cacheProgress?.status === 'done'
                  ? 'bg-green-50 text-green-700 border border-green-200'
                  : cacheProgress?.status === 'warming'
                    ? 'bg-amber-50 text-amber-700 border border-amber-200 cursor-wait'
                    : !navigator.onLine
                      ? 'bg-gray-100 text-gray-400 border border-gray-200 cursor-not-allowed'
                      : 'bg-primary-50 text-primary-700 border border-primary-200 hover:bg-primary-100 active:bg-primary-200'
              }`}
            >
              {cacheProgress?.status === 'warming' ? (
                <Loader2 className="h-4 w-4 animate-spin flex-shrink-0" />
              ) : cacheProgress?.status === 'done' ? (
                <CheckCircle2 className="h-4 w-4 flex-shrink-0" />
              ) : !navigator.onLine ? (
                <WifiOff className="h-4 w-4 flex-shrink-0" />
              ) : (
                <Download className="h-4 w-4 flex-shrink-0" />
              )}
              <span>
                {cacheProgress?.status === 'warming'
                  ? `Caching: ${cacheProgress.currentModule} (${cacheProgress.current}/${cacheProgress.total})`
                  : cacheProgress?.status === 'done'
                    ? `Offline ready! ${cacheProgress.cached} modules cached`
                    : !navigator.onLine
                      ? 'Go online to cache data'
                      : 'Download for Offline Use'}
              </span>
            </button>

            {/* Progress bar */}
            {cacheProgress?.status === 'warming' && (
              <div className="mt-2">
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div
                    className="bg-primary-500 h-2 rounded-full transition-all duration-300"
                    style={{ width: `${Math.round((cacheProgress.current / cacheProgress.total) * 100)}%` }}
                  />
                </div>
                <p className="text-xs text-gray-500 mt-1 text-center">
                  {Math.round((cacheProgress.current / cacheProgress.total) * 100)}% complete
                </p>
              </div>
            )}

            {/* Done summary */}
            {cacheProgress?.status === 'done' && cacheProgress.skipped > 0 && (
              <p className="text-xs text-gray-500 mt-1 text-center">
                {cacheProgress.skipped} endpoint{cacheProgress.skipped !== 1 ? 's' : ''} skipped (not available)
              </p>
            )}
            {cacheProgress?.status === 'error' && (
              <p className="text-xs text-red-500 mt-1 text-center">
                Some modules failed. Try again or check your connection.
              </p>
            )}
          </div>

          {/* Sync Queue Diagnostics */}
          <div className="mt-4 pt-4 border-t border-gray-200">
            <div className="flex items-center justify-between mb-2">
              <h4 className="text-sm font-medium text-gray-700">Sync Queue</h4>
              <button
                onClick={handleSyncDiagnostics}
                className="text-xs text-primary-600 hover:text-primary-800 underline"
              >
                {syncDiagOpen ? 'Refresh' : 'Diagnose'}
              </button>
            </div>

            {syncDiagOpen && syncBreakdown && (
              <div className="space-y-2 text-xs">
                <div className="flex justify-between text-gray-600">
                  <span>Total pending:</span>
                  <span className={`font-semibold ${syncBreakdown.total > 0 ? 'text-amber-600' : 'text-green-600'}`}>
                    {syncBreakdown.total}
                  </span>
                </div>
                {syncBreakdown.staleCount > 0 && (
                  <div className="flex justify-between text-red-600">
                    <span>Stale (will be purged):</span>
                    <span className="font-semibold">{syncBreakdown.staleCount}</span>
                  </div>
                )}
                {syncBreakdown.failedCount > 0 && (
                  <div className="flex justify-between text-red-600">
                    <span>Failed (max retries):</span>
                    <span className="font-semibold">{syncBreakdown.failedCount}</span>
                  </div>
                )}

                {Object.keys(syncBreakdown.byTable).length > 0 && (
                  <div className="mt-1 p-2 bg-gray-50 rounded text-xs max-h-32 overflow-y-auto">
                    <p className="font-medium text-gray-500 mb-1">By table:</p>
                    {Object.entries(syncBreakdown.byTable)
                      .sort(([, a], [, b]) => (b as number) - (a as number))
                      .map(([table, count]) => (
                        <div key={table} className="flex justify-between py-0.5">
                          <span className="text-gray-600 truncate mr-2">{table}</span>
                          <span className="font-mono text-gray-800">{count as number}</span>
                        </div>
                      ))}
                  </div>
                )}
              </div>
            )}

            <div className="flex gap-2 mt-2">
              <button
                onClick={handleForceSync}
                disabled={!navigator.onLine}
                className="flex-1 px-3 py-2 text-xs font-medium rounded-lg bg-blue-50 text-blue-700 border border-blue-200 hover:bg-blue-100 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Force Sync
              </button>
              <button
                onClick={handleClearSyncQueue}
                disabled={syncClearing}
                className="flex-1 px-3 py-2 text-xs font-medium rounded-lg bg-red-50 text-red-700 border border-red-200 hover:bg-red-100 disabled:opacity-50"
              >
                {syncClearing ? 'Clearing...' : 'Clear Queue'}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Force Admit Modal */}
      {showForceAdmitModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-0 sm:p-4">
          <div className="bg-white rounded-none sm:rounded-xl shadow-2xl w-full sm:max-w-lg h-full sm:h-auto sm:max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-4 border-b bg-green-50 rounded-t-xl">
              <h3 className="text-lg font-bold text-green-800 flex items-center gap-2">
                <Plus className="h-5 w-5" /> Force Admit Patient
              </h3>
              <button onClick={() => setShowForceAdmitModal(false)} className="text-gray-500 hover:text-gray-700">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="p-4 space-y-4">
              <p className="text-xs text-gray-500">Quick admission — you can edit full details later from the patient's profile.</p>

              {/* Patient Search */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Patient *</label>
                {faSelectedPatient ? (
                  <div className="flex items-center justify-between p-2 bg-green-50 border border-green-200 rounded-lg">
                    <span className="text-sm font-medium">{faSelectedPatient.name || `${faSelectedPatient.first_name} ${faSelectedPatient.last_name}`} — {faSelectedPatient.hospital_number}</span>
                    <button onClick={() => setFaSelectedPatient(null)} className="text-red-500 text-xs hover:underline">Change</button>
                  </div>
                ) : (
                  <div>
                    <input
                      type="text"
                      placeholder="Search by name or hospital number..."
                      value={faPatientSearch}
                      onChange={(e) => setFaPatientSearch(e.target.value)}
                      className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-green-500 focus:border-green-500"
                    />
                    {faPatientSearch.length >= 2 && (
                      <div className="mt-1 max-h-32 overflow-y-auto border border-gray-200 rounded-lg bg-white">
                        {allPatients
                          .filter(p => {
                            const q = faPatientSearch.toLowerCase();
                            const name = (p.name || `${p.first_name || ''} ${p.last_name || ''}`).toLowerCase();
                            return name.includes(q) || (p.hospital_number || '').toLowerCase().includes(q);
                          })
                          .slice(0, 10)
                          .map(p => (
                            <button
                              key={p.id}
                              onClick={() => { setFaSelectedPatient(p); setFaPatientSearch(''); }}
                              className="w-full text-left px-3 py-2 text-sm hover:bg-green-50 border-b border-gray-100 last:border-0"
                            >
                              {p.name || `${p.first_name} ${p.last_name}`} — {p.hospital_number}
                            </button>
                          ))}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Ward */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Ward *</label>
                <select
                  value={faWard}
                  onChange={(e) => setFaWard(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-green-500 focus:border-green-500"
                >
                  <option value="">Select Ward</option>
                  <option value="Plastic Surgery Ward">Plastic Surgery Ward</option>
                  <option value="Burns Ward">Burns Ward</option>
                  <option value="Male Surgical Ward">Male Surgical Ward</option>
                  <option value="Female Surgical Ward">Female Surgical Ward</option>
                  <option value="Paediatric Ward">Paediatric Ward</option>
                  <option value="ICU">ICU</option>
                  <option value="Emergency Ward">Emergency Ward</option>
                </select>
              </div>

              {/* Bed */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Bed Number</label>
                <input
                  type="text"
                  value={faBed}
                  onChange={(e) => setFaBed(e.target.value)}
                  placeholder="e.g. B12"
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg"
                />
              </div>

              {/* Provisional Diagnosis */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Provisional Diagnosis *</label>
                <input
                  type="text"
                  value={faDiagnosis}
                  onChange={(e) => setFaDiagnosis(e.target.value)}
                  placeholder="e.g. Hand burn, laceration of face..."
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg"
                />
              </div>

              {/* Reason for Admission */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Reason for Admission</label>
                <input
                  type="text"
                  value={faReason}
                  onChange={(e) => setFaReason(e.target.value)}
                  placeholder="e.g. For wound care and dressing"
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg"
                />
              </div>

              {/* Admitting Consultant */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Admitting Consultant</label>
                <select
                  value={faConsultant}
                  onChange={(e) => setFaConsultant(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg"
                >
                  <option value="">Select Consultant</option>
                  {staffList
                    .filter(s => s.role === 'consultant')
                    .map(s => (
                      <option key={s.id} value={s.name}>{s.name}</option>
                    ))}
                </select>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 p-4 border-t bg-gray-50 rounded-b-xl">
              <button
                onClick={() => setShowForceAdmitModal(false)}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleForceAdmit}
                disabled={forceAdmitting}
                className="px-4 py-2 text-sm font-medium text-white bg-green-600 rounded-lg hover:bg-green-700 disabled:opacity-50 flex items-center gap-2"
              >
                {forceAdmitting ? <><Loader2 className="h-4 w-4 animate-spin" /> Admitting...</> : 'Admit Patient'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Emergency Surgery Booking Modal */}
      {showEmergencySurgeryModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-0 sm:p-4">
          <div className="bg-white rounded-none sm:rounded-xl shadow-2xl w-full sm:max-w-2xl h-full sm:h-auto sm:max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-4 border-b bg-orange-50 rounded-t-xl">
              <h3 className="text-lg font-bold text-orange-800 flex items-center gap-2">
                <Siren className="h-5 w-5" /> Emergency Surgery Booking
              </h3>
              <button onClick={() => setShowEmergencySurgeryModal(false)} className="text-gray-500 hover:text-gray-700">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="p-4 space-y-4">
              <div className="bg-red-50 border border-red-200 rounded-lg p-2 text-xs text-red-700 flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 flex-shrink-0" /> Emergency case — booking is marked urgent and scheduled immediately.
              </div>

              {/* Patient Search */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Patient *</label>
                {esSelectedPatient ? (
                  <div className="flex items-center justify-between p-2 bg-orange-50 border border-orange-200 rounded-lg">
                    <span className="text-sm font-medium">{esSelectedPatient.name || `${esSelectedPatient.first_name} ${esSelectedPatient.last_name}`} — {esSelectedPatient.hospital_number}</span>
                    <button onClick={() => setEsSelectedPatient(null)} className="text-red-500 text-xs hover:underline">Change</button>
                  </div>
                ) : (
                  <div>
                    <input
                      type="text"
                      placeholder="Search by name or hospital number..."
                      value={esPatientSearch}
                      onChange={(e) => setEsPatientSearch(e.target.value)}
                      className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-orange-500 focus:border-orange-500"
                    />
                    {esPatientSearch.length >= 2 && (
                      <div className="mt-1 max-h-32 overflow-y-auto border border-gray-200 rounded-lg bg-white">
                        {allPatients
                          .filter(p => {
                            const q = esPatientSearch.toLowerCase();
                            const name = (p.name || `${p.first_name || ''} ${p.last_name || ''}`).toLowerCase();
                            return name.includes(q) || (p.hospital_number || '').toLowerCase().includes(q);
                          })
                          .slice(0, 10)
                          .map(p => (
                            <button
                              key={p.id}
                              onClick={() => { setEsSelectedPatient(p); setEsPatientSearch(''); }}
                              className="w-full text-left px-3 py-2 text-sm hover:bg-orange-50 border-b border-gray-100 last:border-0"
                            >
                              {p.name || `${p.first_name} ${p.last_name}`} — {p.hospital_number}
                            </button>
                          ))}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Procedure and Indication */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Procedure Name *</label>
                  <input
                    type="text"
                    value={esProcedure}
                    onChange={(e) => setEsProcedure(e.target.value)}
                    placeholder="e.g. Wound debridement, Skin grafting"
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Indication</label>
                  <input
                    type="text"
                    value={esIndication}
                    onChange={(e) => setEsIndication(e.target.value)}
                    placeholder="e.g. Burn wound infection, traumatic avulsion"
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg"
                  />
                </div>
              </div>

              {/* Diagnosis */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Diagnosis / Medical Conditions</label>
                <input
                  type="text"
                  value={esDiagnosis}
                  onChange={(e) => setEsDiagnosis(e.target.value)}
                  placeholder="e.g. Deep dermal burn 20% TBSA"
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg"
                />
              </div>

              {/* Surgeon team */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Primary Surgeon *</label>
                  <select
                    value={esSurgeon}
                    onChange={(e) => setEsSurgeon(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg"
                  >
                    <option value="">Select Surgeon</option>
                    {staffList
                      .filter(s => ['consultant', 'senior_registrar'].includes(s.role))
                      .map(s => (
                        <option key={s.id} value={s.name}>{s.name} ({s.role})</option>
                      ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Assistant Surgeon</label>
                  <select
                    value={esAssistant}
                    onChange={(e) => setEsAssistant(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg"
                  >
                    <option value="">Select Assistant</option>
                    {staffList
                      .filter(s => ['senior_registrar', 'junior_registrar'].includes(s.role))
                      .map(s => (
                        <option key={s.id} value={s.name}>{s.name}</option>
                      ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Anaesthetist</label>
                  <input
                    type="text"
                    value={esAnaesthetist}
                    onChange={(e) => setEsAnaesthetist(e.target.value)}
                    placeholder="Anaesthetist name"
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg"
                  />
                </div>
              </div>

              {/* Theatre, Anaesthesia Type, Duration */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Theatre</label>
                  <input
                    type="text"
                    value={esTheatre}
                    onChange={(e) => setEsTheatre(e.target.value)}
                    placeholder="e.g. Emergency Theatre 1"
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Anaesthesia Type</label>
                  <select
                    value={esAnaesthesiaType}
                    onChange={(e) => setEsAnaesthesiaType(e.target.value as any)}
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg"
                  >
                    <option value="general">General</option>
                    <option value="regional">Regional</option>
                    <option value="local">Local</option>
                    <option value="sedation">Sedation</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Est. Duration (min)</label>
                  <input
                    type="number"
                    value={esDuration}
                    onChange={(e) => setEsDuration(e.target.value)}
                    min="15"
                    step="15"
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg"
                  />
                </div>
              </div>

              {/* Blood type */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Blood Group / Crossmatch</label>
                <input
                  type="text"
                  value={esBloodType}
                  onChange={(e) => setEsBloodType(e.target.value)}
                  placeholder="e.g. O+, 2 units crossmatched"
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg"
                />
              </div>

              {/* Flags */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Clinical Flags</label>
                <div className="flex flex-wrap gap-4">
                  <label className="flex items-center gap-2 text-sm">
                    <input type="checkbox" checked={esInfected} onChange={(e) => setEsInfected(e.target.checked)} className="rounded border-gray-300" />
                    Infected Case
                  </label>
                  <label className="flex items-center gap-2 text-sm">
                    <input type="checkbox" checked={esHivPositive} onChange={(e) => setEsHivPositive(e.target.checked)} className="rounded border-gray-300" />
                    HIV Positive
                  </label>
                  <label className="flex items-center gap-2 text-sm">
                    <input type="checkbox" checked={esDiabetic} onChange={(e) => setEsDiabetic(e.target.checked)} className="rounded border-gray-300" />
                    Diabetic
                  </label>
                </div>
              </div>

              {/* Special Requirements */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Special Requirements / Equipment</label>
                <input
                  type="text"
                  value={esSpecialReqs}
                  onChange={(e) => setEsSpecialReqs(e.target.value)}
                  placeholder="e.g. Dermatome, mesh graft equipment, tourniquet"
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg"
                />
              </div>

              {/* Notes */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Additional Notes</label>
                <textarea
                  value={esNotes}
                  onChange={(e) => setEsNotes(e.target.value)}
                  rows={2}
                  placeholder="Any additional notes, pre-op instructions..."
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg resize-none"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 p-4 border-t bg-gray-50 rounded-b-xl">
              <button
                onClick={() => setShowEmergencySurgeryModal(false)}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleEmergencySurgeryBooking}
                disabled={bookingSurgery}
                className="px-4 py-2 text-sm font-medium text-white bg-orange-600 rounded-lg hover:bg-orange-700 disabled:opacity-50 flex items-center gap-2"
              >
                {bookingSurgery ? <><Loader2 className="h-4 w-4 animate-spin" /> Booking...</> : <><Siren className="h-4 w-4" /> Book Emergency Surgery</>}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* HO Responsibilities Reference Modal */}
      {showHOGuide && (
        <div className="fixed inset-0 bg-black bg-opacity-60 z-50 flex items-center justify-center p-0 sm:p-4">
          <HOResponsibilitiesGuide
            mode="reference"
            onClose={() => setShowHOGuide(false)}
          />
        </div>
      )}
    </div>
  );
}
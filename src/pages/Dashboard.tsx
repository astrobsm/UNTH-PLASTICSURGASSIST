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
  Activity
} from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { useState, useEffect, useCallback } from 'react';
import { db, Patient } from '../db/database';
import { patientService } from '../services/patientService';
import { admissionDischargeService, Admission } from '../services/admissionDischargeService';
import { warmCache, CacheWarmProgress } from '../services/cacheWarmer';
import { syncService } from '../db/syncService';
import toast from 'react-hot-toast';
import UnitRosterWidget from '../components/UnitRosterWidget';
import { userManagementService, ApprovedUser } from '../services/userManagementService';
import { medicalTeamService } from '../services/medicalTeamService';

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
    loadDashboardData();
    loadStaffList();
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
        const consultant = adm?.admitting_consultant || p.consultant_in_charge || '';
        const resident = adm?.admitting_doctor || p.resident_in_charge || '';
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

      // Pending Tasks: count actual incomplete items within active plans
      let pendingTasks = 0;
      let urgentItems = 0;
      for (const tp of activePlansAll) {
        const meds = ((tp as any).medications || []).filter((m: any) => m.status !== 'active' && m.status !== 'completed');
        const invs = ((tp as any).investigations || []).filter((i: any) => i.status !== 'completed');
        const procs = ((tp as any).procedures || []).filter((p: any) => p.status !== 'completed');
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

      setStats({
        activePatients,
        myPatients: dPatients.length,
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

        const planSummaries = activePlans.slice(0, 10).map(plan => {
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
      setStaffList(all.filter(u => u.is_active));
    } catch {
      // Fallback: load from local IndexedDB
      try {
        const localUsers = await db.users?.toArray() || [];
        const mapped: ApprovedUser[] = localUsers
          .filter((u: any) => u.is_approved && u.is_active !== false)
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
        const resident = (adm?.admitting_doctor || p.resident_in_charge || '').toLowerCase();

        const isAssigned = assignedPatientIds.has(numPid) ||
          consultant.includes(staffName) || resident.includes(staffName) ||
          (p.consultant_in_charge || '').toLowerCase().includes(staffName) ||
          (p.resident_in_charge || '').toLowerCase().includes(staffName) ||
          adm?.admitting_doctor?.toLowerCase().includes(staffName) ||
          adm?.admitting_consultant?.toLowerCase().includes(staffName) ||
          adm?.created_by === staffId;

        if (isAssigned) {
          const hoUser = assignment?.house_officer_id ? userById.get(assignment.house_officer_id) : null;
          matched.push({
            id: p.id || p.serverId || '',
            name: `${p.first_name || ''} ${p.last_name || ''}`.trim() || p.full_name || 'Unknown',
            hospital_number: p.hospital_number || '',
            ward: adm?.ward_location || p.ward_id || '',
            bed: adm?.bed_number || p.bed_number || '',
            consultant: adm?.admitting_consultant || p.consultant_in_charge || '',
            resident: adm?.admitting_doctor || p.resident_in_charge || '',
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

  const formatTimeAgo = (date: Date): string => {
    const seconds = Math.floor((new Date().getTime() - date.getTime()) / 1000);
    if (seconds < 60) return 'just now';
    if (seconds < 3600) return `${Math.floor(seconds / 60)} minutes ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)} hours ago`;
    if (seconds < 604800) return `${Math.floor(seconds / 86400)} days ago`;
    return `${Math.floor(seconds / 604800)} weeks ago`;
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

      {/* Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-6">
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
                      className="hover:bg-primary-50/50 cursor-pointer transition-colors"
                      onClick={() => navigate(`/patients/${p.id}`)}
                    >
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
                  className="border border-gray-200 rounded-lg p-3 hover:bg-primary-50/50 cursor-pointer transition-colors"
                  onClick={() => navigate(`/patients/${p.id}`)}
                >
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="font-medium text-clinical-dark">{p.name}</p>
                      <p className="text-xs text-gray-500">{p.hospital_number}</p>
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
    </div>
  );
}
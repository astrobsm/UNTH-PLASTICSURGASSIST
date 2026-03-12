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
  Building2
} from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { useState, useEffect } from 'react';
import { db, Patient } from '../db/database';
import { patientService } from '../services/patientService';
import { admissionDischargeService, Admission } from '../services/admissionDischargeService';
import UnitRosterWidget from '../components/UnitRosterWidget';

interface DashboardPatient {
  id: number | string;
  name: string;
  hospital_number: string;
  ward: string;
  bed: string;
  consultant: string;
  resident: string;
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

  const isAdmin = user?.role === 'admin';

  useEffect(() => {
    loadDashboardData();
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

      // Build dashboard patient list
      const userName = user?.name || '';
      const userId = user?.id || '';
      const dPatients: DashboardPatient[] = [];

      for (const p of activePatientsList) {
        const pid = String(p.id || p.serverId || '');
        const hn = (p.hospital_number || '').trim().toLowerCase();
        const adm = admissionByPid.get(pid) || (hn ? admissionByHn.get(hn) : undefined);
        
        const ward = adm?.ward_location || p.ward_id || '';
        const bed = adm?.bed_number || p.bed_number || '';
        const consultant = adm?.admitting_consultant || p.consultant_in_charge || '';
        const resident = adm?.admitting_doctor || p.resident_in_charge || '';
        const admStatus = adm ? 'active' as const : 'outpatient' as const;

        // For non-admin: check if patient is assigned to this user
        const isAssigned = isAdmin || 
          consultant.toLowerCase().includes(userName.toLowerCase()) ||
          resident.toLowerCase().includes(userName.toLowerCase()) ||
          (p.consultant_in_charge || '').toLowerCase().includes(userName.toLowerCase()) ||
          (p.resident_in_charge || '').toLowerCase().includes(userName.toLowerCase()) ||
          adm?.admitting_doctor?.toLowerCase().includes(userName.toLowerCase()) ||
          adm?.admitting_consultant?.toLowerCase().includes(userName.toLowerCase()) ||
          adm?.created_by === userId;

        if (isAdmin || isAssigned) {
          dPatients.push({
            id: p.id || p.serverId || '',
            name: `${p.first_name || ''} ${p.last_name || ''}`.trim() || p.full_name || 'Unknown',
            hospital_number: p.hospital_number || '',
            ward,
            bed,
            consultant,
            resident,
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
      const pendingTasks = allTreatmentPlans.filter(tp => 
        (tp.status === 'active' || tp.status === 'draft') && !tp.deleted
      ).length;

      // Get urgent items
      const urgentItems = allTreatmentPlans.filter(tp => 
        tp.status === 'active' && !tp.deleted
      ).length;

      // Lab results
      const allLabInvestigations = await db.lab_investigations?.toArray() || [];
      const labResults = allLabInvestigations.filter(li => 
        li.status === 'pending' || li.status === 'in_progress'
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
    } catch (error) {
      console.error('Error loading dashboard data:', error);
    }
  };

  const formatTimeAgo = (date: Date): string => {
    const seconds = Math.floor((new Date().getTime() - date.getTime()) / 1000);
    if (seconds < 60) return 'just now';
    if (seconds < 3600) return `${Math.floor(seconds / 60)} minutes ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)} hours ago`;
    if (seconds < 604800) return `${Math.floor(seconds / 86400)} days ago`;
    return `${Math.floor(seconds / 604800)} weeks ago`;
  };

  // Filter patients by search and ward
  const filteredPatients = dashboardPatients.filter(p => {
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
      name: 'Pending Tasks',
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
      name: 'Urgent Items',
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
            {isAdmin ? 'All Patients & Assignments' : 'My Assigned Patients'}
            <span className="text-sm font-normal text-gray-500">({filteredPatients.length})</span>
          </h3>
          <div className="flex flex-col sm:flex-row gap-2">
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
                  {isAdmin && (p.consultant || p.resident) && (
                    <div className="mt-1 text-xs text-gray-500">
                      {p.consultant && <span>Consultant: {p.consultant}</span>}
                      {p.consultant && p.resident && <span> · </span>}
                      {p.resident && <span>Resident: {p.resident}</span>}
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
            <Link to="/treatment-planning" className="btn-secondary w-full justify-start">
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
        </div>
      </div>
    </div>
  );
}
import { 
  Users, 
  Calendar, 
  FlaskConical, 
  ClipboardCheck,
  AlertTriangle,
  TrendingUp,
  Megaphone 
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { useState, useEffect } from 'react';
import { db } from '../db/database';
import { patientService } from '../services/patientService';

export default function Dashboard() {
  const { user } = useAuthStore();
  const [stats, setStats] = useState({
    activePatients: 0,
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

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    try {
      // Get patients data from API/database (exclude deleted)
      const allPatients = await patientService.getAllPatients();
      const activePatients = allPatients.filter(p => !p.deleted).length;

      // Get treatment plans from database (exclude deleted)
      const allTreatmentPlans = await db.treatment_plans.toArray();
      const pendingTasks = allTreatmentPlans.filter(tp => 
        (tp.status === 'active' || tp.status === 'draft') && !tp.deleted
      ).length;

      // Get urgent items - count treatment plans marked as active
      const urgentItems = allTreatmentPlans.filter(tp => 
        tp.status === 'active' && !tp.deleted
      ).length;

      // Lab results - count recent lab investigations
      const allLabInvestigations = await db.lab_investigations?.toArray() || [];
      const labResults = allLabInvestigations.filter(li => 
        li.status === 'pending' || li.status === 'in_progress'
      ).length;

      setStats({
        activePatients,
        pendingTasks,
        labResults,
        urgentItems
      });

      // Generate recent activities from treatment plans
      const activities = [];
      
      // Add recent treatment plans
      const recentPlans = allTreatmentPlans
        .filter(tp => tp.created_at && !tp.deleted)
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
        .slice(0, 2);
      
      for (const plan of recentPlans) {
        const patient = allPatients.find(p => p.id === plan.patient_id);
        if (patient) {
          const patientName = `${patient.first_name} ${patient.last_name}`;
          activities.push({
            id: plan.id?.toString() || '',
            title: `Treatment plan: ${plan.title} for ${patientName}`,
            time: formatTimeAgo(new Date(plan.created_at)),
            type: 'plan'
          });
        }
      }

      // Add recent patient registrations
      const recentPatients = allPatients
        .filter(p => p.created_at && !p.deleted)
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
        .slice(0, 1);
      
      for (const patient of recentPatients) {
        const patientName = `${patient.first_name} ${patient.last_name}`;
        activities.push({
          id: patient.id?.toString() || '',
          title: `New patient registered: ${patientName}`,
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

  const statsDisplay = [
    {
      name: 'Active Patients',
      value: stats.activePatients.toString(),
      icon: Users,
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
          Here's what's happening with your patients today.
        </p>
      </div>

      {/* Stats Grid - Mobile: 2 cols, Desktop: 4 cols */}
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

      {/* Recent Activities & Quick Actions - Stack on mobile */}
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
            <Link to="/procedures" className="btn-secondary w-full justify-start">
              <Calendar className="h-4 w-4 mr-2 flex-shrink-0" />
              <span className="truncate">Schedule Surgery</span>
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
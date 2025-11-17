import { 
  Users, 
  Calendar, 
  FlaskConical, 
  ClipboardCheck,
  AlertTriangle,
  TrendingUp 
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
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-clinical-dark">
          Welcome back, {user?.name?.split(' ')[1] || user?.name}
        </h1>
        <p className="text-clinical mt-1">
          Here's what's happening with your patients today.
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {statsDisplay.map((stat) => (
          <div key={stat.name} className="card p-6">
            <div className="flex items-center">
              <div className={`p-3 rounded-lg ${stat.bg}`}>
                <stat.icon className={`h-6 w-6 ${stat.color}`} />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-500">{stat.name}</p>
                <p className="text-2xl font-bold text-clinical-dark">{stat.value}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Recent Activities & Quick Actions */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Activities */}
        <div className="card p-6">
          <h3 className="text-lg font-semibold text-clinical-dark mb-4">
            Recent Activities
          </h3>
          <div className="space-y-4">
            {recentActivities.map((activity) => (
              <div key={activity.id} className="flex items-start space-x-3">
                <div className="w-2 h-2 bg-primary-500 rounded-full mt-2"></div>
                <div className="flex-1">
                  <p className="text-sm text-clinical-dark">{activity.title}</p>
                  <p className="text-xs text-gray-500">{activity.time}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Quick Actions */}
        <div className="card p-6">
          <h3 className="text-lg font-semibold text-clinical-dark mb-4">
            Quick Actions
          </h3>
          <div className="space-y-3">
            <Link to="/patients" className="w-full btn-primary justify-start">
              <Users className="h-4 w-4 mr-2" />
              Add New Patient
            </Link>
            <Link to="/treatment-planning" className="w-full btn-secondary justify-start">
              <ClipboardCheck className="h-4 w-4 mr-2" />
              Create Treatment Plan
            </Link>
            <Link to="/scheduling" className="w-full btn-secondary justify-start">
              <Calendar className="h-4 w-4 mr-2" />
              Schedule Surgery
            </Link>
            <Link to="/labs" className="w-full btn-secondary justify-start">
              <FlaskConical className="h-4 w-4 mr-2" />
              Order Lab Tests
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
import React, { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { 
  Activity, 
  AlertTriangle, 
  ArrowRightLeft, 
  FileText, 
  Pill, 
  LogOut, 
  LogIn, 
  TestTube, 
  Scissors, 
  Heart,
  Clock,
  User,
  Filter,
  Download
} from 'lucide-react';
import { patientActivityService, PatientActivity } from '../services/patientActivityService';

interface PatientActivityTimelineProps {
  patientId: number;
  hospitalNumber: string;
  limit?: number;
}

export const PatientActivityTimeline: React.FC<PatientActivityTimelineProps> = ({ 
  patientId, 
  hospitalNumber,
  limit = 50 
}) => {
  const [activities, setActivities] = useState<PatientActivity[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterType, setFilterType] = useState<string>('all');
  const [stats, setStats] = useState<any>(null);

  useEffect(() => {
    loadActivities();
    loadStats();
  }, [patientId, filterType]);

  const loadActivities = async () => {
    setLoading(true);
    try {
      let fetchedActivities: PatientActivity[];
      
      if (filterType === 'all') {
        fetchedActivities = await patientActivityService.getPatientActivities(patientId, limit);
      } else {
        fetchedActivities = await patientActivityService.getPatientActivitiesByType(
          patientId, 
          filterType as any,
          limit
        );
      }
      
      setActivities(fetchedActivities);
    } catch (error) {
      console.error('Error loading activities:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadStats = async () => {
    try {
      const statistics = await patientActivityService.getPatientActivityStats(patientId);
      setStats(statistics);
    } catch (error) {
      console.error('Error loading stats:', error);
    }
  };

  const getActivityIcon = (type: string) => {
    switch (type) {
      case 'risk_assessment': return AlertTriangle;
      case 'transfer': return ArrowRightLeft;
      case 'progress_note': return FileText;
      case 'prescription': return Pill;
      case 'discharge': return LogOut;
      case 'admission': return LogIn;
      case 'lab_order': return TestTube;
      case 'surgery': return Scissors;
      case 'vital_signs': return Heart;
      default: return Activity;
    }
  };

  const getActivityColor = (type: string) => {
    switch (type) {
      case 'risk_assessment': return 'bg-yellow-100 text-yellow-700 border-yellow-200';
      case 'transfer': return 'bg-blue-100 text-blue-700 border-blue-200';
      case 'progress_note': return 'bg-purple-100 text-purple-700 border-purple-200';
      case 'prescription': return 'bg-green-100 text-green-700 border-green-200';
      case 'discharge': return 'bg-red-100 text-red-700 border-red-200';
      case 'admission': return 'bg-indigo-100 text-indigo-700 border-indigo-200';
      case 'lab_order': return 'bg-cyan-100 text-cyan-700 border-cyan-200';
      case 'surgery': return 'bg-pink-100 text-pink-700 border-pink-200';
      case 'vital_signs': return 'bg-rose-100 text-rose-700 border-rose-200';
      default: return 'bg-gray-100 text-gray-700 border-gray-200';
    }
  };

  const getActionBadge = (action: string) => {
    const colors: Record<string, string> = {
      created: 'bg-green-100 text-green-800',
      updated: 'bg-blue-100 text-blue-800',
      deleted: 'bg-red-100 text-red-800',
      completed: 'bg-purple-100 text-purple-800',
      viewed: 'bg-gray-100 text-gray-800'
    };

    return (
      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${colors[action] || colors.viewed}`}>
        {action.charAt(0).toUpperCase() + action.slice(1)}
      </span>
    );
  };

  const exportActivities = () => {
    const csv = [
      ['Timestamp', 'Activity Type', 'Action', 'User', 'Role', 'Description'].join(','),
      ...activities.map(activity => [
        format(new Date(activity.timestamp), 'yyyy-MM-dd HH:mm:ss'),
        activity.activity_type,
        activity.action,
        activity.user_name,
        activity.user_role,
        `"${activity.description.replace(/"/g, '""')}"`
      ].join(','))
    ].join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `patient-${hospitalNumber}-activity-log-${format(new Date(), 'yyyy-MM-dd')}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (loading && activities.length === 0) {
    return (
      <div className="p-6 bg-white rounded-lg border border-gray-200">
        <div className="animate-pulse space-y-4">
          <div className="h-4 bg-gray-200 rounded w-1/4"></div>
          <div className="h-20 bg-gray-200 rounded"></div>
          <div className="h-20 bg-gray-200 rounded"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header with Stats */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
          <div>
            <h2 className="text-xl font-semibold text-gray-900 flex items-center space-x-2">
              <Activity className="h-5 w-5" />
              <span>Patient Activity Timeline</span>
            </h2>
            <p className="text-sm text-gray-600 mt-1">
              Complete audit trail of patient interactions
            </p>
          </div>
          <button
            onClick={exportActivities}
            className="flex items-center space-x-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
          >
            <Download className="h-4 w-4" />
            <span>Export</span>
          </button>
        </div>

        {/* Statistics */}
        {stats && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
            <div className="bg-gray-50 rounded-lg p-4">
              <div className="text-lg sm:text-2xl font-bold text-gray-900">{stats.total}</div>
              <div className="text-sm text-gray-600">Total Activities</div>
            </div>
            <div className="bg-gray-50 rounded-lg p-4">
              <div className="text-lg sm:text-2xl font-bold text-gray-900">{Object.keys(stats.byType).length}</div>
              <div className="text-sm text-gray-600">Activity Types</div>
            </div>
            <div className="bg-gray-50 rounded-lg p-4">
              <div className="text-lg sm:text-2xl font-bold text-gray-900">{Object.keys(stats.byUser).length}</div>
              <div className="text-sm text-gray-600">Team Members</div>
            </div>
            <div className="bg-gray-50 rounded-lg p-4">
              <div className="text-sm font-medium text-gray-900">Last Activity</div>
              <div className="text-xs text-gray-600">
                {stats.lastActivity 
                  ? format(new Date(stats.lastActivity.timestamp), 'MMM d, HH:mm')
                  : 'No activities'}
              </div>
            </div>
          </div>
        )}

        {/* Filter */}
        <div className="flex items-center space-x-2 flex-wrap gap-2">
          <Filter className="h-4 w-4 text-gray-400" />
          <button
            onClick={() => setFilterType('all')}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              filterType === 'all' 
                ? 'bg-green-600 text-white' 
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            All
          </button>
          {['risk_assessment', 'progress_note', 'prescription', 'transfer', 'admission', 'discharge', 'lab_order', 'surgery'].map(type => (
            <button
              key={type}
              onClick={() => setFilterType(type)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                filterType === type 
                  ? 'bg-green-600 text-white' 
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              {type.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}
            </button>
          ))}
        </div>
      </div>

      {/* Timeline */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        {activities.length === 0 ? (
          <div className="text-center py-12">
            <Activity className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No activities found</h3>
            <p className="text-gray-600">
              {filterType === 'all' 
                ? 'No activities have been recorded for this patient yet.'
                : `No ${filterType.replace('_', ' ')} activities found.`}
            </p>
          </div>
        ) : (
          <div className="space-y-6">
            {activities.map((activity, index) => {
              const Icon = getActivityIcon(activity.activity_type);
              const colorClass = getActivityColor(activity.activity_type);

              return (
                <div key={activity.id || index} className="relative">
                  {/* Timeline connector */}
                  {index < activities.length - 1 && (
                    <div className="absolute left-6 top-12 bottom-0 w-0.5 bg-gray-200"></div>
                  )}

                  <div className="flex items-start space-x-4">
                    {/* Icon */}
                    <div className={`flex-shrink-0 w-12 h-12 rounded-full border-2 flex items-center justify-center ${colorClass}`}>
                      <Icon className="h-5 w-5" />
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2 mb-2">
                        <div className="flex items-center space-x-2 flex-wrap">
                          <h3 className="text-base font-medium text-gray-900">
                            {activity.activity_type.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}
                          </h3>
                          {getActionBadge(activity.action)}
                        </div>
                        <div className="flex items-center space-x-2 text-sm text-gray-500">
                          <Clock className="h-4 w-4" />
                          <span>{format(new Date(activity.timestamp), 'MMM d, yyyy HH:mm:ss')}</span>
                        </div>
                      </div>

                      <p className="text-gray-700 mb-2">{activity.description}</p>

                      <div className="flex items-center space-x-4 text-sm text-gray-600">
                        <div className="flex items-center space-x-1">
                          <User className="h-4 w-4" />
                          <span>{activity.user_name}</span>
                        </div>
                        <span className="px-2 py-0.5 bg-gray-100 text-gray-700 rounded text-xs font-medium">
                          {activity.user_role.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}
                        </span>
                      </div>

                      {/* Details expansion */}
                      {activity.details && (
                        <details className="mt-3 bg-gray-50 rounded-lg p-3">
                          <summary className="cursor-pointer text-sm font-medium text-gray-700 hover:text-gray-900">
                            View Details
                          </summary>
                          <pre className="mt-2 text-xs text-gray-600 overflow-x-auto">
                            {JSON.stringify(activity.details, null, 2)}
                          </pre>
                        </details>
                      )}
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
};

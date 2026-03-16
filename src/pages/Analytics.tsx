import React, { useState, useEffect } from 'react';
import { 
  TrendingUp, 
  Users, 
  Activity, 
  Clock, 
  CheckCircle, 
  AlertTriangle,
  Calendar,
  Award,
  BarChart3,
  User,
  Search,
  Filter
} from 'lucide-react';
import { analyticsService, UserPerformanceMetrics } from '../services/analyticsService';
import { admissionTrackingService, PatientAdmissionStatus } from '../services/admissionTrackingService';
import { format } from 'date-fns';

export default function Analytics() {
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState<'day' | 'week' | 'month' | 'year'>('month');
  const [userPerformance, setUserPerformance] = useState<UserPerformanceMetrics[]>([]);
  const [dashboardSummary, setDashboardSummary] = useState<any>(null);
  const [admissionStatuses, setAdmissionStatuses] = useState<PatientAdmissionStatus[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterRole, setFilterRole] = useState<'all' | 'consultant' | 'registrar' | 'house_officer'>('all');
  const [selectedTab, setSelectedTab] = useState<'performance' | 'admissions' | 'treatment_plans'>('performance');

  useEffect(() => {
    loadAnalyticsData();
  }, [period]);

  const loadAnalyticsData = async () => {
    try {
      setLoading(true);
      const [performance, summary] = await Promise.all([
        analyticsService.getAllUsersPerformance(period),
        admissionTrackingService.getDashboardSummary()
      ]);

      setUserPerformance(performance);
      setDashboardSummary(summary);

      // Load active admissions with status
      const activeAdmissions = await admissionTrackingService.getAllActiveAdmissions();
      const statusPromises = activeAdmissions.map(admission => 
        admissionTrackingService.getPatientAdmissionStatus(admission.patient_id)
      );
      const statuses = await Promise.all(statusPromises);
      setAdmissionStatuses(statuses.filter(s => s !== null) as PatientAdmissionStatus[]);
    } catch (error) {
      console.error('Error loading analytics data:', error);
    } finally {
      setLoading(false);
    }
  };

  const getFilteredPerformance = () => {
    let filtered = userPerformance;

    if (filterRole !== 'all') {
      filtered = filtered.filter(p => p.user_role && p.user_role.toLowerCase() === filterRole);
    }

    if (searchTerm) {
      filtered = filtered.filter(p => 
        p.user_name && p.user_name.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    return filtered.sort((a, b) => b.average_quality_score - a.average_quality_score);
  };

  const getRoleColor = (role: string) => {
    switch (role.toLowerCase()) {
      case 'consultant': return 'bg-purple-100 text-purple-800';
      case 'registrar': return 'bg-blue-100 text-blue-800';
      case 'house_officer': return 'bg-green-100 text-green-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getProgressColor = (percentage: number) => {
    if (percentage >= 80) return 'bg-green-600';
    if (percentage >= 60) return 'bg-blue-600';
    if (percentage >= 40) return 'bg-yellow-600';
    return 'bg-red-600';
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading analytics...</p>
        </div>
      </div>
    );
  }

  const filteredPerformance = getFilteredPerformance();

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-lg sm:text-2xl font-bold text-gray-900 flex items-center gap-2">
            <BarChart3 className="w-8 h-8 text-green-600" />
            Analytics Dashboard
          </h1>
          <p className="text-gray-600 mt-1">Performance metrics and patient tracking</p>
        </div>

        <select
          value={period}
          onChange={(e) => setPeriod(e.target.value as any)}
          className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
        >
          <option value="day">Today</option>
          <option value="week">This Week</option>
          <option value="month">This Month</option>
          <option value="year">This Year</option>
        </select>
      </div>

      {/* Summary Cards */}
      {dashboardSummary && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-white rounded-lg shadow p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Active Admissions</p>
                <p className="text-lg sm:text-2xl font-bold text-gray-900">{dashboardSummary.total_active_admissions}</p>
              </div>
              <Users className="w-8 h-8 text-blue-600" />
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Avg Length of Stay</p>
                <p className="text-lg sm:text-2xl font-bold text-gray-900">{dashboardSummary.average_los_days.toFixed(1)} days</p>
              </div>
              <Clock className="w-8 h-8 text-green-600" />
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Plans On Track</p>
                <p className="text-lg sm:text-2xl font-bold text-green-600">{dashboardSummary.treatment_plans_on_track}</p>
              </div>
              <CheckCircle className="w-8 h-8 text-green-600" />
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Plans Delayed</p>
                <p className="text-lg sm:text-2xl font-bold text-red-600">{dashboardSummary.treatment_plans_delayed}</p>
              </div>
              <AlertTriangle className="w-8 h-8 text-red-600" />
            </div>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="bg-white rounded-lg shadow">
        <div className="border-b border-gray-200">
          <nav className="flex -mb-px">
            <button
              onClick={() => setSelectedTab('performance')}
              className={`px-6 py-3 border-b-2 font-medium text-sm ${
                selectedTab === 'performance'
                  ? 'border-green-600 text-green-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <div className="flex items-center gap-2">
                <Award className="w-4 h-4" />
                User Performance
              </div>
            </button>
            <button
              onClick={() => setSelectedTab('admissions')}
              className={`px-6 py-3 border-b-2 font-medium text-sm ${
                selectedTab === 'admissions'
                  ? 'border-green-600 text-green-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4" />
                Admission Duration
              </div>
            </button>
            <button
              onClick={() => setSelectedTab('treatment_plans')}
              className={`px-6 py-3 border-b-2 font-medium text-sm ${
                selectedTab === 'treatment_plans'
                  ? 'border-green-600 text-green-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <div className="flex items-center gap-2">
                <Activity className="w-4 h-4" />
                Treatment Plan Execution
              </div>
            </button>
          </nav>
        </div>

        <div className="p-6">
          {/* Performance Tab */}
          {selectedTab === 'performance' && (
            <div className="space-y-4">
              {/* Filters */}
              <div className="flex gap-4">
                <div className="flex-1 relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Search users..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                  />
                </div>
                <select
                  value={filterRole}
                  onChange={(e) => setFilterRole(e.target.value as any)}
                  className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                >
                  <option value="all">All Roles</option>
                  <option value="consultant">Consultants</option>
                  <option value="registrar">Registrars</option>
                  <option value="house_officer">House Officers</option>
                </select>
              </div>

              {/* Performance Table */}
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-2 sm:px-4 py-2 sm:py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">User</th>
                      <th className="px-2 sm:px-4 py-2 sm:py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Role</th>
                      <th className="px-2 sm:px-4 py-2 sm:py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Activities</th>
                      <th className="px-2 sm:px-4 py-2 sm:py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Patients Seen</th>
                      <th className="px-2 sm:px-4 py-2 sm:py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Ward Rounds</th>
                      <th className="px-2 sm:px-4 py-2 sm:py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Quality Score</th>
                      <th className="px-2 sm:px-4 py-2 sm:py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Compliance</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {filteredPerformance.map((user) => (
                      <tr key={user.user_id} className="hover:bg-gray-50">
                        <td className="px-2 sm:px-4 py-2 sm:py-4 whitespace-nowrap">
                          <div className="flex items-center">
                            <User className="w-5 h-5 text-gray-400 mr-2" />
                            <span className="font-medium text-gray-900">{user.user_name}</span>
                          </div>
                        </td>
                        <td className="px-2 sm:px-4 py-2 sm:py-4 whitespace-nowrap">
                          <span className={`px-2 py-1 text-xs font-medium rounded-full ${getRoleColor(user.user_role)}`}>
                            {user.user_role}
                          </span>
                        </td>
                        <td className="px-2 sm:px-4 py-2 sm:py-4 whitespace-nowrap text-sm text-gray-900">{user.total_activities}</td>
                        <td className="px-2 sm:px-4 py-2 sm:py-4 whitespace-nowrap text-sm text-gray-900">{user.patients_seen}</td>
                        <td className="px-2 sm:px-4 py-2 sm:py-4 whitespace-nowrap text-sm text-gray-900">{user.ward_rounds_completed}</td>
                        <td className="px-2 sm:px-4 py-2 sm:py-4 whitespace-nowrap">
                          <div className="flex items-center">
                            <div className="w-16 bg-gray-200 rounded-full h-2 mr-2">
                              <div
                                className={`h-2 rounded-full ${getProgressColor(user.average_quality_score)}`}
                                style={{ width: `${user.average_quality_score}%` }}
                              ></div>
                            </div>
                            <span className="text-sm text-gray-900">{user.average_quality_score.toFixed(0)}%</span>
                          </div>
                        </td>
                        <td className="px-2 sm:px-4 py-2 sm:py-4 whitespace-nowrap">
                          <div className="flex items-center">
                            <div className="w-16 bg-gray-200 rounded-full h-2 mr-2">
                              <div
                                className={`h-2 rounded-full ${getProgressColor(user.compliance_score)}`}
                                style={{ width: `${user.compliance_score}%` }}
                              ></div>
                            </div>
                            <span className="text-sm text-gray-900">{user.compliance_score.toFixed(0)}%</span>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Admissions Tab */}
          {selectedTab === 'admissions' && (
            <div className="space-y-4">
              {admissionStatuses.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <Clock className="w-12 h-12 mx-auto mb-4 text-gray-400" />
                  <p>No active admissions</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-4">
                  {admissionStatuses.map((status) => (
                    <div key={status.patient_id} className="bg-white border border-gray-200 rounded-lg p-4">
                      <div className="flex items-start justify-between mb-4">
                        <div>
                          <h3 className="font-semibold text-gray-900">{status.patient_name}</h3>
                          <p className="text-sm text-gray-600">{status.hospital_number}</p>
                        </div>
                        {status.admission && (
                          <div className="text-right">
                            <p className="text-sm font-medium text-gray-900">
                              {admissionTrackingService.formatDuration(
                                status.admission.length_of_stay_days,
                                status.admission.length_of_stay_hours
                              )}
                            </p>
                            <p className="text-xs text-gray-500">
                              Admitted: {format(new Date(status.admission.admission_date), 'MMM dd, yyyy')}
                            </p>
                          </div>
                        )}
                      </div>

                      {/* Overall Progress */}
                      <div className="mb-4">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-sm font-medium text-gray-700">Overall Progress</span>
                          <span className="text-sm text-gray-600">{status.overall_progress}%</span>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-2">
                          <div
                            className={`h-2 rounded-full ${getProgressColor(status.overall_progress)}`}
                            style={{ width: `${status.overall_progress}%` }}
                          ></div>
                        </div>
                      </div>

                      {/* Alerts */}
                      {status.alerts.length > 0 && (
                        <div className="space-y-2">
                          {status.alerts.map((alert, idx) => (
                            <div
                              key={idx}
                              className={`flex items-center gap-2 p-2 rounded border ${admissionTrackingService.getAlertColor(alert.severity)}`}
                            >
                              <AlertTriangle className="w-4 h-4" />
                              <span className="text-sm">{alert.message}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Treatment Plans Tab */}
          {selectedTab === 'treatment_plans' && (
            <div className="space-y-4">
              {admissionStatuses.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <Activity className="w-12 h-12 mx-auto mb-4 text-gray-400" />
                  <p>No active treatment plans</p>
                </div>
              ) : (
                <div className="space-y-6">
                  {admissionStatuses.map((status) => (
                    status.treatment_plans.length > 0 && (
                      <div key={status.patient_id} className="bg-white border border-gray-200 rounded-lg p-4">
                        <h3 className="font-semibold text-gray-900 mb-4">
                          {status.patient_name} - {status.hospital_number}
                        </h3>
                        
                        <div className="space-y-4">
                          {status.treatment_plans.map((plan) => (
                            <div key={plan.id} className="border-l-4 border-blue-500 pl-4 py-2">
                              <div className="flex items-start justify-between mb-2">
                                <div>
                                  <h4 className="font-medium text-gray-900">{plan.plan_title}</h4>
                                  <p className="text-sm text-gray-600">
                                    {plan.days_elapsed} days elapsed
                                    {plan.days_remaining !== undefined && ` • ${plan.days_remaining} days remaining`}
                                  </p>
                                </div>
                                <span className={`px-2 py-1 text-xs font-medium rounded-full ${admissionTrackingService.getStatusColor(plan.status)}`}>
                                  {plan.status.replace('_', ' ').toUpperCase()}
                                </span>
                              </div>

                              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-2 text-sm">
                                <div>
                                  <span className="text-gray-600">Total Steps:</span>
                                  <span className="ml-2 font-medium text-gray-900">{plan.total_steps}</span>
                                </div>
                                <div>
                                  <span className="text-gray-600">Completed:</span>
                                  <span className="ml-2 font-medium text-green-600">{plan.completed_steps}</span>
                                </div>
                                <div>
                                  <span className="text-gray-600">Overdue:</span>
                                  <span className="ml-2 font-medium text-red-600">{plan.overdue_steps}</span>
                                </div>
                              </div>

                              <div className="flex items-center gap-2">
                                <div className="flex-1 bg-gray-200 rounded-full h-2">
                                  <div
                                    className={`h-2 rounded-full ${getProgressColor(plan.completion_percentage)}`}
                                    style={{ width: `${plan.completion_percentage}%` }}
                                  ></div>
                                </div>
                                <span className="text-sm font-medium text-gray-900">{plan.completion_percentage}%</span>
                                {!plan.is_on_schedule && (
                                  <AlertTriangle className="w-4 h-4 text-yellow-600" />
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

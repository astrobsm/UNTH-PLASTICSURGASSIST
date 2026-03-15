import React, { useState, useEffect } from 'react';
import { medicalTeamService, TeamWorkload, StaffByRole } from '../services/medicalTeamService';

interface TeamAnalyticsProps {
  refreshTrigger?: number;
}

interface StaffAnalytics {
  id: number;
  full_name: string;
  role: string;
  total_activities: number;
  ward_rounds: number;
  procedures: number;
  prescriptions: number;
  consultations: number;
  documentation: number;
}

export default function TeamAnalytics({ refreshTrigger }: TeamAnalyticsProps) {
  const [workload, setWorkload] = useState<TeamWorkload | null>(null);
  const [analytics, setAnalytics] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState(30);
  const [selectedRole, setSelectedRole] = useState<string>('all');

  useEffect(() => {
    loadData();
  }, [refreshTrigger, period]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [workloadData, analyticsData] = await Promise.all([
        medicalTeamService.getTeamWorkload(),
        medicalTeamService.getTeamAnalytics(undefined, period)
      ]);
      
      setWorkload(workloadData);
      setAnalytics(analyticsData);
    } catch (error) {
      console.error('Error loading team analytics:', error);
    } finally {
      setLoading(false);
    }
  };

  const getRoleBadgeColor = (role: string) => {
    switch (role) {
      case 'consultant': return 'bg-green-100 text-green-700';
      case 'senior_registrar': return 'bg-blue-100 text-blue-700';
      case 'registrar': return 'bg-indigo-100 text-indigo-700';
      case 'house_officer': return 'bg-purple-100 text-purple-700';
      default: return 'bg-gray-100 text-gray-700';
    }
  };

  const getRoleLabel = (role: string) => {
    switch (role) {
      case 'consultant': return 'Consultant';
      case 'senior_registrar': return 'Senior Registrar';
      case 'registrar': return 'Registrar';
      case 'house_officer': return 'House Officer';
      default: return role;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-600"></div>
        <span className="ml-3 text-gray-600">Loading team analytics...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <h2 className="text-xl font-bold text-gray-800">👥 Medical Team Analytics</h2>
        <div className="flex gap-3">
          <select
            value={period}
            onChange={(e) => setPeriod(Number(e.target.value))}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
          >
            <option value={7}>Last 7 days</option>
            <option value={30}>Last 30 days</option>
            <option value={90}>Last 90 days</option>
          </select>
          <button
            onClick={loadData}
            className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm"
          >
            🔄 Refresh
          </button>
        </div>
      </div>

      {/* Workload Distribution */}
      {workload && (
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold text-gray-800 mb-4">📊 Workload Distribution</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {(['senior_registrar', 'registrar', 'house_officer', 'consultant'] as const).map((role) => {
              const roleData = workload[role];
              if (!roleData) return null;
              
              return (
                <div key={role} className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                  <div className="flex items-center justify-between mb-2">
                    <span className={`px-2 py-1 rounded text-xs font-medium ${getRoleBadgeColor(role)}`}>
                      {getRoleLabel(role)}
                    </span>
                    <span className="text-xs text-gray-500">{roleData.staff.length} staff</span>
                  </div>
                  <div className="text-2xl font-bold text-gray-800">{roleData.totalPatients}</div>
                  <div className="text-sm text-gray-600">Total patients</div>
                  <div className="mt-2 text-xs text-gray-500">
                    Avg: {roleData.avgPatients} patients/staff
                  </div>
                  
                  {/* Staff breakdown */}
                  <div className="mt-3 space-y-1 max-h-32 overflow-y-auto">
                    {roleData.staff.map((staff: StaffByRole) => (
                      <div key={staff.id} className="flex justify-between text-xs">
                        <span className="truncate">{staff.full_name}</span>
                        <span className="font-medium text-gray-700">{staff.current_patients}</span>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Activity Analytics */}
      {analytics?.byStaff && (
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-800">📋 Activity Tracking</h3>
            <select
              value={selectedRole}
              onChange={(e) => setSelectedRole(e.target.value)}
              className="px-3 py-1 border border-gray-300 rounded text-sm"
            >
              <option value="all">All Roles</option>
              <option value="consultant">Consultants</option>
              <option value="senior_registrar">Senior Registrars</option>
              <option value="registrar">Registrars</option>
              <option value="house_officer">House Officers</option>
            </select>
          </div>
          
          {analytics.byStaff.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Staff</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Role</th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Ward Rounds</th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Procedures</th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Prescriptions</th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Consultations</th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Total</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {analytics.byStaff
                  .filter((staff: StaffAnalytics) => selectedRole === 'all' || staff.role === selectedRole)
                  .map((staff: StaffAnalytics) => (
                    <tr key={staff.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3">
                        <div className="font-medium text-gray-900">{staff.full_name}</div>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-1 rounded text-xs ${getRoleBadgeColor(staff.role)}`}>
                          {getRoleLabel(staff.role)}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-blue-50 text-blue-700 font-medium">
                          {staff.ward_rounds || 0}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-red-50 text-red-700 font-medium">
                          {staff.procedures || 0}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-green-50 text-green-700 font-medium">
                          {staff.prescriptions || 0}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-purple-50 text-purple-700 font-medium">
                          {staff.consultations || 0}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className="inline-flex items-center justify-center w-10 h-10 rounded-full bg-gray-100 text-gray-800 font-bold">
                          {staff.total_activities || 0}
                        </span>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
          ) : (
          <div className="text-center py-8 text-gray-500">
            No active clinical staff found. Ensure staff accounts are approved and active.
          </div>
          )}
          
          <div className="mt-3 text-xs text-gray-400">
            Data computed from ward rounds, surgeries, prescriptions, and lab orders within the selected period.
          </div>
        </div>
      )}

      {/* Workload Summary */}
      {analytics?.summary?.workloadDistribution && (
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold text-gray-800 mb-4">📈 Workload Summary</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {analytics.summary.workloadDistribution.map((item: any) => (
              <div key={item.role} className="text-center p-4 bg-gray-50 rounded-lg">
                <div className={`inline-block px-3 py-1 rounded mb-2 ${getRoleBadgeColor(item.role)}`}>
                  {getRoleLabel(item.role)}
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm mt-3">
                  <div>
                    <div className="text-gray-500">Staff</div>
                    <div className="font-bold">{item.staff_count}</div>
                  </div>
                  <div>
                    <div className="text-gray-500">Patients</div>
                    <div className="font-bold">{item.total_patients}</div>
                  </div>
                  <div>
                    <div className="text-gray-500">Min</div>
                    <div className="font-bold text-green-600">{item.min_patients}</div>
                  </div>
                  <div>
                    <div className="text-gray-500">Max</div>
                    <div className="font-bold text-red-600">{item.max_patients}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Info Section */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <h4 className="font-medium text-blue-800 mb-2">ℹ️ About Team Analytics</h4>
        <ul className="text-sm text-blue-700 space-y-1">
          <li>• <strong>Workload Distribution:</strong> Shows current patient assignments per staff member</li>
          <li>• <strong>Activity Tracking:</strong> Logs ward rounds, procedures, prescriptions, and consultations</li>
          <li>• <strong>Auto-Assignment:</strong> New patients are automatically assigned to staff with lowest workload</li>
          <li>• Activities are logged when staff perform clinical actions on patients</li>
        </ul>
      </div>
    </div>
  );
}

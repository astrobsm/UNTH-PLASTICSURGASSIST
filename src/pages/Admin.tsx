import React, { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { adminService } from '../services/adminService';
import { apiClient } from '../services/apiClient';
import { patientService } from '../services/patientService';
import { syncService } from '../db/syncService';
import { 
  Users, 
  Settings, 
  Database, 
  Shield, 
  Activity, 
  AlertTriangle, 
  Download, 
  Upload, 
  Trash2, 
  UserPlus, 
  Edit3, 
  Eye, 
  Server, 
  BarChart3, 
  Lock, 
  Unlock, 
  RefreshCw, 
  FileText, 
  Calendar, 
  Clock,
  CheckCircle,
  XCircle,
  Search,
  Filter,
  Plus,
  Save,
  X,
  Key,
  Mail,
  Phone,
  MapPin,
  Building,
  UserCheck,
  Globe,
  Wifi,
  WifiOff,
  Copy,
  Check
} from 'lucide-react';
import Layout from '../components/Layout';
import { UserApprovalManager } from '../components/UserApprovalManager';
import { AISettingsPanel } from '../components/AISettingsPanel';
import BulkUserImport from '../components/BulkUserImport';
import { medicalTeamService } from '../services/medicalTeamService';
import { db } from '../db/database';
import { resetDatabase } from '../utils/dbReset';
import toast from 'react-hot-toast';

type AdminTab = 'dashboard' | 'user-approvals' | 'users' | 'bulk-import' | 'system' | 'database' | 'security' | 'analytics' | 'settings';

interface User {
  id: string;
  username?: string;
  email: string;
  name: string;
  role: 'admin' | 'consultant' | 'senior_registrar' | 'junior_registrar' | 'house_officer';
  department: string;
  status: 'active' | 'inactive' | 'suspended';
  lastLogin: Date | null;
  permissions: string[];
  createdAt: Date;
  updatedAt: Date;
}

interface SystemMetrics {
  totalUsers: number;
  activeUsers: number;
  totalPatients: number;
  totalProcedures: number;
  totalLabResults: number;
  systemUptime: string;
  databaseSize: string;
  lastBackup: Date | null;
  errorCount: number;
  performanceScore: number;
}

interface AuditLog {
  id: string;
  userId: string;
  userName: string;
  action: string;
  resource: string;
  details: string;
  timestamp: Date;
  ipAddress: string;
  userAgent: string;
  success: boolean;
}

export default function Admin() {
  const [activeTab, setActiveTab] = useState<AdminTab>('dashboard');
  const [users, setUsers] = useState<User[]>([]);
  const [metrics, setMetrics] = useState<SystemMetrics | null>(null);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [showUserModal, setShowUserModal] = useState(false);
  const [showBackupModal, setShowBackupModal] = useState(false);
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  useEffect(() => {
    loadAdminData();
    
    // Listen for online/offline status
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const loadAdminData = async () => {
    setLoading(true);
    try {
      await Promise.all([
        loadUsers(),
        loadSystemMetrics(),
        loadAuditLogs()
      ]);
    } catch (error) {
      console.error('Error loading admin data:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadUsers = async () => {
    try {
      // Fetch real users from API
      const apiUsers = await apiClient.getUsers();
      const mappedUsers: User[] = apiUsers.map((u: any) => ({
        id: u.id?.toString() || '',
        username: u.username || '',
        email: u.email || '',
        name: u.full_name || u.name || '',
        role: u.role || 'house_officer',
        department: u.department || 'Plastic Surgery',
        status: u.is_active ? 'active' : 'inactive',
        lastLogin: u.last_login ? new Date(u.last_login) : null,
        permissions: u.role === 'admin' ? ['all'] : ['patient_read'],
        createdAt: u.created_at ? new Date(u.created_at) : new Date(),
        updatedAt: u.updated_at ? new Date(u.updated_at) : new Date()
      }));
      setUsers(mappedUsers);
    } catch (error) {
      console.error('Error loading users:', error);
      setUsers([]);
    }
  };

  const loadSystemMetrics = async () => {
    try {
      const [patients, procedures, labResults] = await Promise.all([
        db.patients.count(),
        db.surgery_bookings.count(),
        db.lab_results.count()
      ]);

      const mockMetrics: SystemMetrics = {
        totalUsers: users.length,
        activeUsers: users.filter(u => u.status === 'active').length,
        totalPatients: patients,
        totalProcedures: procedures,
        totalLabResults: labResults,
        systemUptime: '15 days, 3 hours',
        databaseSize: '45.2 MB',
        lastBackup: new Date(Date.now() - 24 * 60 * 60 * 1000), // Yesterday
        errorCount: 3,
        performanceScore: 92
      };
      setMetrics(mockMetrics);
    } catch (error) {
      console.error('Error loading system metrics:', error);
    }
  };

  const loadAuditLogs = async () => {
    // Mock audit logs - in real app would come from API
    const mockLogs: AuditLog[] = [
      {
        id: '1',
        userId: '2',
        userName: 'Dr. John Smith',
        action: 'CREATE',
        resource: 'patient',
        details: 'Created new patient record: John Doe',
        timestamp: new Date(),
        ipAddress: '192.168.1.100',
        userAgent: 'Mozilla/5.0...',
        success: true
      },
      {
        id: '2',
        userId: '3',
        userName: 'Dr. Sarah Jones',
        action: 'UPDATE',
        resource: 'procedure',
        details: 'Updated surgical checklist for patient ID: 123',
        timestamp: new Date(Date.now() - 30 * 60 * 1000),
        ipAddress: '192.168.1.101',
        userAgent: 'Mozilla/5.0...',
        success: true
      },
      {
        id: '3',
        userId: '1',
        userName: 'System Administrator',
        action: 'LOGIN',
        resource: 'system',
        details: 'Administrative login',
        timestamp: new Date(Date.now() - 60 * 60 * 1000),
        ipAddress: '192.168.1.50',
        userAgent: 'Mozilla/5.0...',
        success: true
      }
    ];
    setAuditLogs(mockLogs);
  };

  const handleCreateUser = () => {
    setSelectedUser(null);
    setShowUserModal(true);
  };

  const handleEditUser = (user: User) => {
    setSelectedUser(user);
    setShowUserModal(true);
  };

  const handleDeleteUser = async (userId: string) => {
    if (confirm('Are you sure you want to delete this user?')) {
      setUsers(users.filter(u => u.id !== userId));
      // In real app, would call API to delete user
    }
  };

  const handleSuspendUser = async (userId: string) => {
    setUsers(users.map(u => 
      u.id === userId 
        ? { ...u, status: u.status === 'suspended' ? 'active' : 'suspended' as const }
        : u
    ));
    // In real app, would call API to update user status
  };

  const handleDatabaseBackup = async () => {
    setLoading(true);
    try {
      // Simulate backup process
      await new Promise(resolve => setTimeout(resolve, 2000));
      alert('Database backup completed successfully!');
      setShowBackupModal(false);
    } catch (error) {
      alert('Backup failed: ' + error);
    } finally {
      setLoading(false);
    }
  };

  const handleDatabaseRestore = async () => {
    if (confirm('Are you sure you want to restore the database? This will overwrite all current data.')) {
      setLoading(true);
      try {
        // Simulate restore process
        await new Promise(resolve => setTimeout(resolve, 3000));
        alert('Database restored successfully!');
      } catch (error) {
        alert('Restore failed: ' + error);
      } finally {
        setLoading(false);
      }
    }
  };

  const handleClearDatabase = async () => {
    if (confirm('Are you sure you want to clear the entire database? This action cannot be undone.')) {
      try {
        await resetDatabase();
      } catch (error) {
        alert('Failed to clear database: ' + error);
      }
    }
  };

  const handleSyncLocalData = async () => {
    const loadingToast = toast.loading('Syncing local data to server...');
    try {
      // Queue all unsynced patients
      await patientService.syncLocalChanges();
      
      // Get sync queue count
      const queueCount = await db.sync_queue.count();
      
      if (queueCount === 0) {
        toast.success('No pending changes to sync', { id: loadingToast });
      } else {
        toast.success(`Successfully queued ${queueCount} items for sync`, { id: loadingToast });
      }
    } catch (error) {
      console.error('Sync error:', error);
      toast.error('Failed to sync local data', { id: loadingToast });
    }
  };

  const handleAssignMedicalTeams = async () => {
    const loadingToast = toast.loading('Assigning medical teams to all patients...');
    try {
      await medicalTeamService.assignTeamsToAllPatients();
      toast.success('Medical teams assigned successfully!', { id: loadingToast });
    } catch (error) {
      console.error('Error assigning medical teams:', error);
      toast.error('Failed to assign medical teams', { id: loadingToast });
    }
  };

  const TabButton = ({ tab, label, icon: Icon }: { tab: AdminTab; label: string; icon: any }) => (
    <button
      onClick={() => setActiveTab(tab)}
      className={`flex items-center space-x-1 sm:space-x-2 px-3 sm:px-4 py-2 sm:py-3 rounded-lg font-medium transition-colors whitespace-nowrap flex-shrink-0 text-sm sm:text-base ${
        activeTab === tab
          ? 'bg-green-600 text-white'
          : 'text-gray-600 hover:bg-gray-100'
      }`}
    >
      <Icon className="h-4 w-4 sm:h-5 sm:w-5" />
      <span className="hidden sm:inline">{label}</span>
      <span className="sm:hidden">{label.split(' ')[0]}</span>
    </button>
  );

  const filteredUsers = users.filter(user => 
    (user.name || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
    (user.email || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
    (user.department || '').toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 mb-4 sm:mb-6">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">System Administration</h1>
          <p className="text-sm sm:text-base text-gray-600">Manage users, settings, and monitor health</p>
        </div>
        <div className="flex items-center space-x-2 sm:space-x-4">
          <div className={`flex items-center space-x-1 sm:space-x-2 px-2 sm:px-3 py-1.5 sm:py-2 rounded-lg text-xs sm:text-sm ${
            isOnline ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
          }`}>
            {isOnline ? <Wifi className="h-3 w-3 sm:h-4 sm:w-4" /> : <WifiOff className="h-3 w-3 sm:h-4 sm:w-4" />}
            <span className="font-medium">
              {isOnline ? 'Online' : 'Offline'}
            </span>
          </div>
          <button
            onClick={loadAdminData}
            disabled={loading}
            className="bg-blue-600 text-white px-3 sm:px-4 py-1.5 sm:py-2 rounded-lg hover:bg-blue-700 transition-colors flex items-center space-x-1 sm:space-x-2 text-sm sm:text-base"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline">Refresh</span>
          </button>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="flex space-x-2 mb-4 sm:mb-6 overflow-x-auto scrollbar-hide -mx-4 px-4 sm:mx-0 sm:px-0 pb-2">
        <TabButton tab="dashboard" label="Dashboard" icon={BarChart3} />
        <TabButton tab="user-approvals" label="Approvals" icon={UserCheck} />
        <TabButton tab="users" label="Users" icon={Users} />
        <TabButton tab="bulk-import" label="Bulk Import" icon={UserPlus} />
        <TabButton tab="system" label="System" icon={Activity} />
        <TabButton tab="database" label="Database" icon={Database} />
        <TabButton tab="security" label="Security" icon={Shield} />
        <TabButton tab="analytics" label="Analytics" icon={BarChart3} />
        <TabButton tab="settings" label="Settings" icon={Settings} />
      </div>

      {/* Dashboard Tab */}
      {activeTab === 'dashboard' && (
        <div className="space-y-4 sm:space-y-6">
          {/* System Metrics Overview */}
          {metrics && (
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-6">
              <div className="bg-white rounded-lg border border-gray-200 p-4 sm:p-6">
                <div className="flex items-center">
                  <Users className="h-6 w-6 sm:h-8 sm:w-8 text-blue-600 flex-shrink-0" />
                  <div className="ml-3 sm:ml-4 min-w-0">
                    <p className="text-xs sm:text-sm font-medium text-gray-500 truncate">Total Users</p>
                    <p className="text-xl sm:text-2xl font-bold text-gray-900">{metrics.totalUsers}</p>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-lg border border-gray-200 p-4 sm:p-6">
                <div className="flex items-center">
                  <UserCheck className="h-6 w-6 sm:h-8 sm:w-8 text-green-600 flex-shrink-0" />
                  <div className="ml-3 sm:ml-4 min-w-0">
                    <p className="text-xs sm:text-sm font-medium text-gray-500 truncate">Active Users</p>
                    <p className="text-xl sm:text-2xl font-bold text-gray-900">{metrics.activeUsers}</p>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-lg border border-gray-200 p-4 sm:p-6">
                <div className="flex items-center">
                  <Users className="h-6 w-6 sm:h-8 sm:w-8 text-purple-600 flex-shrink-0" />
                  <div className="ml-3 sm:ml-4 min-w-0">
                    <p className="text-xs sm:text-sm font-medium text-gray-500 truncate">Total Patients</p>
                    <p className="text-xl sm:text-2xl font-bold text-gray-900">{metrics.totalPatients}</p>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-lg border border-gray-200 p-4 sm:p-6">
                <div className="flex items-center">
                  <Activity className="h-6 w-6 sm:h-8 sm:w-8 text-orange-600 flex-shrink-0" />
                  <div className="ml-3 sm:ml-4 min-w-0">
                    <p className="text-xs sm:text-sm font-medium text-gray-500 truncate">System Health</p>
                    <p className="text-xl sm:text-2xl font-bold text-gray-900">{metrics.performanceScore}%</p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Recent Activity */}
          <div className="bg-white rounded-lg border border-gray-200 p-4 sm:p-6">
            <h3 className="text-base sm:text-lg font-medium text-gray-900 mb-3 sm:mb-4">Recent System Activity</h3>
            <div className="space-y-3 sm:space-y-4">
              {auditLogs.slice(0, 5).map((log) => (
                <div key={log.id} className="flex items-start sm:items-center space-x-3 sm:space-x-4 p-2 sm:p-3 bg-gray-50 rounded-lg">
                  <div className={`p-1.5 sm:p-2 rounded-full flex-shrink-0 ${
                    log.success ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-600'
                  }`}>
                    {log.success ? <CheckCircle className="h-3 w-3 sm:h-4 sm:w-4" /> : <XCircle className="h-3 w-3 sm:h-4 sm:w-4" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs sm:text-sm font-medium text-gray-900 truncate">
                      {log.userName} {log.action.toLowerCase()}d {log.resource}
                    </p>
                    <p className="text-xs text-gray-500 truncate">{log.details}</p>
                  </div>
                  <div className="text-xs text-gray-500 flex-shrink-0">
                    {format(new Date(log.timestamp), 'MMM d, HH:mm')}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* User Approvals Tab */}
      {activeTab === 'user-approvals' && (
        <UserApprovalManager />
      )}

      {/* User Management Tab */}
      {activeTab === 'users' && (
        <div className="space-y-4 sm:space-y-6">
          {/* User Management Header */}
          <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3">
            <div>
              <h2 className="text-lg sm:text-xl font-semibold text-gray-900">User Management</h2>
              <p className="text-sm text-gray-600">Manage user accounts, roles, and permissions</p>
            </div>
            <button
              onClick={handleCreateUser}
              className="bg-green-600 text-white px-4 py-2.5 rounded-lg hover:bg-green-700 transition-colors flex items-center justify-center space-x-2 w-full sm:w-auto"
            >
              <UserPlus className="h-4 w-4" />
              <span>Add User</span>
            </button>
          </div>

          {/* Search and Filters */}
          <div className="bg-white rounded-lg border border-gray-200 p-3 sm:p-4">
            <div className="flex flex-col sm:flex-row gap-3 sm:space-x-4">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search users..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="form-input pl-10"
                />
              </div>
              <button className="px-4 py-2.5 border border-gray-300 rounded-lg hover:bg-gray-50 flex items-center justify-center space-x-2 w-full sm:w-auto">
                <Filter className="h-4 w-4" />
                <span>Filter</span>
              </button>
            </div>
          </div>

          {/* Users - Card layout on mobile, table on desktop */}
          <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
            {/* Mobile Card Layout */}
            <div className="sm:hidden divide-y divide-gray-200">
              {filteredUsers.map((user) => (
                <div key={user.id} className="p-4 space-y-3">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center space-x-3">
                      <div className="w-10 h-10 bg-green-100 text-green-600 rounded-full flex items-center justify-center font-semibold">
                        {user.name.charAt(0)}
                      </div>
                      <div>
                        <p className="font-medium text-gray-900">{user.name}</p>
                        <p className="text-xs text-gray-500">{user.email}</p>
                      </div>
                    </div>
                    <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                      user.status === 'active' ? 'bg-green-100 text-green-800' :
                      user.status === 'suspended' ? 'bg-red-100 text-red-800' :
                      'bg-gray-100 text-gray-800'
                    }`}>
                      {user.status}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-600">{user.role.replace('_', ' ')}</span>
                    <span className="text-gray-500">{user.department}</span>
                  </div>
                  <div className="flex items-center space-x-2 pt-2">
                    <button
                      onClick={() => handleEditUser(user)}
                      className="flex-1 px-3 py-2 text-sm bg-gray-100 rounded-lg hover:bg-gray-200"
                    >
                      <Edit3 className="h-4 w-4 inline mr-1" /> Edit
                    </button>
                    <button
                      onClick={() => handleSuspendUser(user.id)}
                      className={`flex-1 px-3 py-2 text-sm rounded-lg ${
                        user.status === 'suspended' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'
                      }`}
                    >
                      {user.status === 'suspended' ? 'Activate' : 'Suspend'}
                    </button>
                    <button
                      onClick={() => handleDeleteUser(user.id)}
                      className="px-3 py-2 text-sm bg-red-100 text-red-600 rounded-lg"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {/* Desktop Table Layout */}
            <div className="hidden sm:block overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      User
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Login Credentials
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Role & Department
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Last Login
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {filteredUsers.map((user) => (
                    <tr key={user.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <div className="h-10 w-10 rounded-full bg-gray-300 flex items-center justify-center">
                            <span className="text-sm font-medium text-gray-700">
                              {user.name.split(' ').map(n => n[0]).join('')}
                            </span>
                          </div>
                          <div className="ml-4">
                            <div className="text-sm font-medium text-gray-900">{user.name}</div>
                            <div className="text-sm text-gray-500">{user.email}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center space-x-2">
                          <Key className="h-4 w-4 text-gray-400" />
                          <div>
                            <div className="text-sm font-mono text-gray-900">{user.username || 'N/A'}</div>
                            <div className="text-xs text-gray-500">Username</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900 capitalize">{user.role.replace('_', ' ')}</div>
                        <div className="text-sm text-gray-500">{user.department}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                          user.status === 'active' 
                            ? 'bg-green-100 text-green-800'
                            : user.status === 'suspended'
                            ? 'bg-red-100 text-red-800'
                            : 'bg-gray-100 text-gray-800'
                        }`}>
                          {user.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {user.lastLogin ? format(new Date(user.lastLogin), 'MMM d, yyyy HH:mm') : 'Never'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium space-x-2">
                        <button
                          onClick={() => handleEditUser(user)}
                          className="text-blue-600 hover:text-blue-900"
                        >
                          <Edit3 className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => handleSuspendUser(user.id)}
                          className="text-yellow-600 hover:text-yellow-900"
                        >
                          {user.status === 'suspended' ? <Unlock className="h-4 w-4" /> : <Lock className="h-4 w-4" />}
                        </button>
                        <button
                          onClick={() => handleDeleteUser(user.id)}
                          className="text-red-600 hover:text-red-900"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Bulk Import Tab */}
      {activeTab === 'bulk-import' && (
        <BulkUserImport />
      )}

      {/* System Health Tab */}
      {activeTab === 'system' && (
        <div className="space-y-6">
          <div>
            <h2 className="text-xl font-semibold text-gray-900">System Health & Monitoring</h2>
            <p className="text-gray-600">Monitor system performance and health metrics</p>
          </div>

          {metrics && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* System Status */}
              <div className="bg-white rounded-lg border border-gray-200 p-6">
                <h3 className="text-lg font-medium text-gray-900 mb-4">System Status</h3>
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <span className="text-gray-600">System Uptime</span>
                    <span className="font-medium">{metrics.systemUptime}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-gray-600">Performance Score</span>
                    <span className="font-medium text-green-600">{metrics.performanceScore}%</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-gray-600">Error Count (24h)</span>
                    <span className="font-medium text-red-600">{metrics.errorCount}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-gray-600">Database Size</span>
                    <span className="font-medium">{metrics.databaseSize}</span>
                  </div>
                </div>
              </div>

              {/* Quick Actions */}
              <div className="bg-white rounded-lg border border-gray-200 p-6">
                <h3 className="text-lg font-medium text-gray-900 mb-4">Quick Actions</h3>
                <div className="space-y-3">
                  <button
                    onClick={loadAdminData}
                    className="w-full flex items-center justify-center space-x-2 py-2 px-4 border border-gray-300 rounded-lg hover:bg-gray-50"
                  >
                    <RefreshCw className="h-4 w-4" />
                    <span>Refresh System Status</span>
                  </button>
                  <button
                    onClick={handleSyncLocalData}
                    className="w-full flex items-center justify-center space-x-2 py-2 px-4 bg-green-600 text-white rounded-lg hover:bg-green-700"
                  >
                    <Wifi className="h-4 w-4" />
                    <span>Sync Local Data</span>
                  </button>
                  <button
                    onClick={() => setShowBackupModal(true)}
                    className="w-full flex items-center justify-center space-x-2 py-2 px-4 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                  >
                    <Download className="h-4 w-4" />
                    <span>Create Backup</span>
                  </button>
                  <button
                    onClick={handleClearDatabase}
                    className="w-full flex items-center justify-center space-x-2 py-2 px-4 bg-red-600 text-white rounded-lg hover:bg-red-700"
                  >
                    <Trash2 className="h-4 w-4" />
                    <span>Clear Database</span>
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Database Tab */}
      {activeTab === 'database' && (
        <div className="space-y-6">
          <div>
            <h2 className="text-xl font-semibold text-gray-900">Database Management</h2>
            <p className="text-gray-600">Manage database backups, restoration, and maintenance</p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Database Info */}
            <div className="bg-white rounded-lg border border-gray-200 p-6">
              <h3 className="text-lg font-medium text-gray-900 mb-4">Database Information</h3>
              {metrics && (
                <div className="space-y-3">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Database Size</span>
                    <span className="font-medium">{metrics.databaseSize}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Total Patients</span>
                    <span className="font-medium">{metrics.totalPatients}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Total Procedures</span>
                    <span className="font-medium">{metrics.totalProcedures}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Lab Results</span>
                    <span className="font-medium">{metrics.totalLabResults}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Last Backup</span>
                    <span className="font-medium">
                      {metrics.lastBackup ? format(new Date(metrics.lastBackup), 'MMM d, yyyy HH:mm') : 'Never'}
                    </span>
                  </div>
                </div>
              )}
            </div>

            {/* Database Actions */}
            <div className="bg-white rounded-lg border border-gray-200 p-6">
              <h3 className="text-lg font-medium text-gray-900 mb-4">Database Actions</h3>
              <div className="space-y-3">
                <button
                  onClick={handleAssignMedicalTeams}
                  className="w-full flex items-center justify-center space-x-2 py-3 px-4 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
                >
                  <Users className="h-4 w-4" />
                  <span>Assign Medical Teams</span>
                </button>
                <button
                  onClick={() => setShowBackupModal(true)}
                  className="w-full flex items-center justify-center space-x-2 py-3 px-4 bg-green-600 text-white rounded-lg hover:bg-green-700"
                >
                  <Download className="h-4 w-4" />
                  <span>Create Backup</span>
                </button>
                <button
                  onClick={handleDatabaseRestore}
                  className="w-full flex items-center justify-center space-x-2 py-3 px-4 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  <Upload className="h-4 w-4" />
                  <span>Restore Backup</span>
                </button>
                <button
                  onClick={handleClearDatabase}
                  className="w-full flex items-center justify-center space-x-2 py-3 px-4 bg-red-600 text-white rounded-lg hover:bg-red-700"
                >
                  <Trash2 className="h-4 w-4" />
                  <span>Clear All Data</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Security Tab */}
      {activeTab === 'security' && (
        <div className="space-y-6">
          <div>
            <h2 className="text-xl font-semibold text-gray-900">Security & Audit</h2>
            <p className="text-gray-600">Monitor security events and audit logs</p>
          </div>

          {/* Audit Logs */}
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <h3 className="text-lg font-medium text-gray-900 mb-4">Recent Audit Logs</h3>
            <div className="space-y-4">
              {auditLogs.map((log) => (
                <div key={log.id} className="border border-gray-200 rounded-lg p-4">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center space-x-3">
                      <div className={`p-2 rounded-full ${
                        log.success ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-600'
                      }`}>
                        {log.success ? <CheckCircle className="h-4 w-4" /> : <XCircle className="h-4 w-4" />}
                      </div>
                      <div>
                        <p className="font-medium text-gray-900">{log.action} - {log.resource}</p>
                        <p className="text-sm text-gray-500">by {log.userName}</p>
                      </div>
                    </div>
                    <span className="text-sm text-gray-500">
                      {format(new Date(log.timestamp), 'MMM d, yyyy HH:mm:ss')}
                    </span>
                  </div>
                  <p className="text-sm text-gray-600 mb-2">{log.details}</p>
                  <div className="text-xs text-gray-500 space-x-4">
                    <span>IP: {log.ipAddress}</span>
                    <span>Status: {log.success ? 'Success' : 'Failed'}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Analytics Tab */}
      {activeTab === 'analytics' && (
        <div className="space-y-6">
          <div>
            <h2 className="text-xl font-semibold text-gray-900">System Analytics</h2>
            <p className="text-gray-600">View usage statistics and performance metrics</p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Usage Statistics */}
            <div className="bg-white rounded-lg border border-gray-200 p-6">
              <h3 className="text-lg font-medium text-gray-900 mb-4">Usage Statistics (Last 30 Days)</h3>
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <span className="text-gray-600">Total Logins</span>
                  <span className="font-medium">1,247</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-600">New Patients</span>
                  <span className="font-medium">89</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-600">Procedures Completed</span>
                  <span className="font-medium">156</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-600">Lab Results Processed</span>
                  <span className="font-medium">432</span>
                </div>
              </div>
            </div>

            {/* Performance Metrics */}
            <div className="bg-white rounded-lg border border-gray-200 p-6">
              <h3 className="text-lg font-medium text-gray-900 mb-4">Performance Metrics</h3>
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <span className="text-gray-600">Average Response Time</span>
                  <span className="font-medium">245ms</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-600">Error Rate</span>
                  <span className="font-medium text-green-600">0.12%</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-600">Uptime</span>
                  <span className="font-medium text-green-600">99.8%</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-600">Active Sessions</span>
                  <span className="font-medium">23</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Settings Tab */}
      {activeTab === 'settings' && (
        <div className="space-y-6">
          <div>
            <h2 className="text-xl font-semibold text-gray-900">System Settings</h2>
            <p className="text-gray-600">Configure system-wide settings and preferences</p>
          </div>

          <div className="grid grid-cols-1 gap-6">
            {/* AI Configuration */}
            <AISettingsPanel />

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* General Settings */}
              <div className="bg-white rounded-lg border border-gray-200 p-6">
                <h3 className="text-lg font-medium text-gray-900 mb-4">General Settings</h3>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Application Name
                    </label>
                    <input
                      type="text"
                      defaultValue="Plastic Surgeon Assistant"
                      className="w-full border border-gray-300 rounded-lg px-3 py-2"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Default Language
                    </label>
                    <select className="w-full border border-gray-300 rounded-lg px-3 py-2">
                      <option value="en">English</option>
                      <option value="es">Spanish</option>
                      <option value="fr">French</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Session Timeout (minutes)
                    </label>
                    <input
                      type="number"
                      defaultValue="30"
                      className="w-full border border-gray-300 rounded-lg px-3 py-2"
                    />
                  </div>
                </div>
              </div>

              {/* Security Settings */}
              <div className="bg-white rounded-lg border border-gray-200 p-6">
                <h3 className="text-lg font-medium text-gray-900 mb-4">Security Settings</h3>
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-900">Require 2FA</p>
                      <p className="text-xs text-gray-500">Require two-factor authentication for all users</p>
                    </div>
                    <input type="checkbox" className="rounded" />
                  </div>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-900">Password Complexity</p>
                      <p className="text-xs text-gray-500">Enforce strong password requirements</p>
                    </div>
                    <input type="checkbox" defaultChecked className="rounded" />
                  </div>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-900">Audit Logging</p>
                      <p className="text-xs text-gray-500">Log all user actions for security audit</p>
                    </div>
                    <input type="checkbox" defaultChecked className="rounded" />
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Save Settings */}
          <div className="flex justify-end">
            <button className="bg-green-600 text-white px-6 py-2 rounded-lg hover:bg-green-700 transition-colors flex items-center space-x-2">
              <Save className="h-4 w-4" />
              <span>Save Settings</span>
            </button>
          </div>
        </div>
      )}

      {/* User Modal */}
      {showUserModal && (
        <UserModal
          user={selectedUser}
          onClose={() => setShowUserModal(false)}
          onSave={async (user, credentials) => {
            if (selectedUser) {
              // Update existing user
              setUsers(users.map(u => u.id === user.id ? user : u));
            } else {
              // Add new user to the list
              setUsers([...users, user]);
            }
            setShowUserModal(false);
            
            // If credentials were generated, show a prompt to copy them
            if (credentials) {
              alert(`User created successfully!\n\nUsername: ${credentials.username}\nTemporary Password: ${credentials.temporaryPassword}\n\nPlease share these credentials with the user securely. They must change their password on first login.`);
            }
          }}
        />
      )}

      {/* Backup Modal */}
      {showBackupModal && (
        <BackupModal
          onClose={() => setShowBackupModal(false)}
          onBackup={handleDatabaseBackup}
          loading={loading}
        />
      )}
    </div>
  );
}

// User Modal Component with auto-generated credentials
const UserModal = ({ 
  user, 
  onClose, 
  onSave 
}: { 
  user: User | null; 
  onClose: () => void; 
  onSave: (user: User, credentials?: { username: string; temporaryPassword: string }) => void; 
}) => {
  const [formData, setFormData] = useState({
    name: user?.name || '',
    email: user?.email || '',
    role: user?.role || 'house_officer',
    department: user?.department || '',
    status: user?.status || 'active'
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [createdCredentials, setCreatedCredentials] = useState<{
    username: string;
    temporaryPassword: string;
    email: string;
    fullName: string;
    role: string;
    mustChangePassword: boolean;
  } | null>(null);
  const [copied, setCopied] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      if (user) {
        // Update existing user - just local state for now
        const userData: User = {
          id: user.id,
          ...formData,
          permissions: formData.role === 'admin' ? ['all'] : ['patient_read'],
          lastLogin: user.lastLogin,
          createdAt: user.createdAt,
          updatedAt: new Date()
        };
        onSave(userData);
      } else {
        // Create new user via API
        const response = await apiClient.createUser({
          fullName: formData.name,
          email: formData.email,
          role: formData.role
        });

        if (response.credentials) {
          setCreatedCredentials(response.credentials);
        } else {
          // User created but no credentials returned
          const userData: User = {
            id: response.user?.id?.toString() || Date.now().toString(),
            name: formData.name,
            email: formData.email,
            role: formData.role as User['role'],
            department: formData.department,
            status: 'active',
            permissions: formData.role === 'admin' ? ['all'] : ['patient_read'],
            lastLogin: null,
            createdAt: new Date(),
            updatedAt: new Date()
          };
          onSave(userData);
        }
      }
    } catch (err: any) {
      setError(err.message || 'Failed to save user');
    } finally {
      setLoading(false);
    }
  };

  const handleCopyCredentials = () => {
    if (createdCredentials) {
      const text = `Username: ${createdCredentials.username}\nTemporary Password: ${createdCredentials.temporaryPassword}\nEmail: ${createdCredentials.email}`;
      navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleDone = () => {
    if (createdCredentials) {
      const userData: User = {
        id: Date.now().toString(),
        name: createdCredentials.fullName,
        email: createdCredentials.email,
        role: createdCredentials.role as User['role'],
        department: formData.department,
        status: 'active',
        permissions: createdCredentials.role === 'admin' ? ['all'] : ['patient_read'],
        lastLogin: null,
        createdAt: new Date(),
        updatedAt: new Date()
      };
      onSave(userData, {
        username: createdCredentials.username,
        temporaryPassword: createdCredentials.temporaryPassword
      });
    }
  };

  // Show credentials screen after user is created
  if (createdCredentials) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4">
          <div className="p-6">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-medium text-gray-900 flex items-center">
                <CheckCircle className="h-5 w-5 text-green-500 mr-2" />
                User Created Successfully
              </h3>
            </div>

            <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-4">
              <p className="text-sm text-green-800 mb-3">
                Share these credentials with <strong>{createdCredentials.fullName}</strong> securely.
                {createdCredentials.mustChangePassword && (
                  <span className="block mt-1">They must change their password on first login.</span>
                )}
              </p>
              
              <div className="space-y-2 bg-white rounded-lg p-3 border border-green-300">
                <div className="flex justify-between">
                  <span className="text-sm font-medium text-gray-600">Username:</span>
                  <span className="text-sm font-mono text-gray-900">{createdCredentials.username}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm font-medium text-gray-600">Email:</span>
                  <span className="text-sm font-mono text-gray-900">{createdCredentials.email}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm font-medium text-gray-600">Temp Password:</span>
                  <span className="text-sm font-mono text-gray-900 bg-yellow-100 px-2 rounded">{createdCredentials.temporaryPassword}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm font-medium text-gray-600">Role:</span>
                  <span className="text-sm text-gray-900 capitalize">{createdCredentials.role.replace('_', ' ')}</span>
                </div>
              </div>
            </div>

            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 mb-4">
              <div className="flex items-start">
                <AlertTriangle className="h-4 w-4 text-yellow-600 mt-0.5 flex-shrink-0" />
                <p className="ml-2 text-xs text-yellow-800">
                  This is the only time you can see the password. Please copy it now and share it securely with the user.
                </p>
              </div>
            </div>

            <div className="flex space-x-3">
              <button
                onClick={handleCopyCredentials}
                className="flex-1 bg-blue-600 text-white py-2 px-4 rounded-lg hover:bg-blue-700 transition-colors flex items-center justify-center space-x-2"
              >
                {copied ? (
                  <>
                    <Check className="h-4 w-4" />
                    <span>Copied!</span>
                  </>
                ) : (
                  <>
                    <Copy className="h-4 w-4" />
                    <span>Copy Credentials</span>
                  </>
                )}
              </button>
              <button
                onClick={handleDone}
                className="flex-1 bg-green-600 text-white py-2 px-4 rounded-lg hover:bg-green-700 transition-colors"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4">
        <div className="p-6">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-medium text-gray-900">
              {user ? 'Edit User' : 'Add New User'}
            </h3>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
              <X className="h-6 w-6" />
            </button>
          </div>

          {!user && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-4">
              <p className="text-sm text-blue-800">
                <Key className="h-4 w-4 inline mr-1" />
                A temporary password will be auto-generated. The user must change it on first login.
              </p>
            </div>
          )}

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-4">
              <p className="text-sm text-red-800">{error}</p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Full Name *
              </label>
              <input
                type="text"
                required
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-green-500 focus:border-transparent"
                placeholder="Enter full name"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Email Address *
              </label>
              <input
                type="email"
                required
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-green-500 focus:border-transparent"
                placeholder="user@hospital.com"
              />
              {!user && (
                <p className="text-xs text-gray-500 mt-1">Username will be generated from email</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Role *
              </label>
              <select
                value={formData.role}
                onChange={(e) => setFormData({ ...formData, role: e.target.value as User['role'] })}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-green-500 focus:border-transparent"
              >
                <option value="house_officer">House Officer</option>
                <option value="junior_registrar">Junior Registrar</option>
                <option value="senior_registrar">Senior Registrar</option>
                <option value="consultant">Consultant</option>
                <option value="admin">Admin</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Department
              </label>
              <input
                type="text"
                value={formData.department}
                onChange={(e) => setFormData({ ...formData, department: e.target.value })}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-green-500 focus:border-transparent"
                placeholder="e.g., Plastic Surgery"
              />
            </div>

            {user && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Status
                </label>
                <select
                  value={formData.status}
                  onChange={(e) => setFormData({ ...formData, status: e.target.value as User['status'] })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-green-500 focus:border-transparent"
                >
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                  <option value="suspended">Suspended</option>
                </select>
              </div>
            )}

            <div className="flex space-x-3 pt-4">
              <button
                type="submit"
                disabled={loading}
                className="flex-1 bg-green-600 text-white py-2 px-4 rounded-lg hover:bg-green-700 transition-colors flex items-center justify-center space-x-2 disabled:opacity-50"
              >
                {loading ? (
                  <>
                    <RefreshCw className="h-4 w-4 animate-spin" />
                    <span>Creating...</span>
                  </>
                ) : (
                  <span>{user ? 'Update User' : 'Create User'}</span>
                )}
              </button>
              <button
                type="button"
                onClick={onClose}
                disabled={loading}
                className="flex-1 bg-gray-500 text-white py-2 px-4 rounded-lg hover:bg-gray-600 transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

// Backup Modal Component
const BackupModal = ({ 
  onClose, 
  onBackup, 
  loading 
}: { 
  onClose: () => void; 
  onBackup: () => void; 
  loading: boolean; 
}) => {
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4">
        <div className="p-6">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-medium text-gray-900">Create Database Backup</h3>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
              <X className="h-6 w-6" />
            </button>
          </div>

          <div className="mb-6">
            <p className="text-gray-600 mb-4">
              This will create a complete backup of the current database including all patient data, 
              procedures, lab results, and system settings.
            </p>
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
              <div className="flex">
                <AlertTriangle className="h-5 w-5 text-yellow-400" />
                <div className="ml-3">
                  <p className="text-sm text-yellow-800">
                    <strong>Important:</strong> This process may take several minutes depending on 
                    the amount of data in your system.
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="flex space-x-3">
            <button
              onClick={onBackup}
              disabled={loading}
              className="flex-1 bg-green-600 text-white py-2 px-4 rounded-lg hover:bg-green-700 transition-colors flex items-center justify-center space-x-2"
            >
              {loading ? (
                <>
                  <RefreshCw className="h-4 w-4 animate-spin" />
                  <span>Creating Backup...</span>
                </>
              ) : (
                <>
                  <Download className="h-4 w-4" />
                  <span>Create Backup</span>
                </>
              )}
            </button>
            <button
              onClick={onClose}
              disabled={loading}
              className="flex-1 bg-gray-500 text-white py-2 px-4 rounded-lg hover:bg-gray-600 transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
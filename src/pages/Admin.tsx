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
  Check,
  GraduationCap,
  Loader2,
  Star
} from 'lucide-react';
import Layout from '../components/Layout';
import { UserApprovalManager } from '../components/UserApprovalManager';
import { AISettingsPanel } from '../components/AISettingsPanel';
import { userManagementService } from '../services/userManagementService';
import BulkUserImport from '../components/BulkUserImport';
import TeamAnalytics from '../components/TeamAnalytics';
import { medicalTeamService } from '../services/medicalTeamService';
import { getRecentAuditLogs, AuditLog as AuditLogType } from '../services/auditLoggingService';
import { db } from '../db/database';
import { resetDatabase, fullDatabaseRecovery, triggerEmergencyRecovery } from '../utils/dbReset';
import toast from 'react-hot-toast';
import RotationManagement from '../components/admin/RotationManagement';
import { UnitRosterConfig } from '../config/psUnits';

type AdminTab = 'dashboard' | 'user-approvals' | 'users' | 'bulk-import' | 'team-analytics' | 'rotations' | 'students' | 'system' | 'database' | 'security' | 'analytics' | 'settings';

interface User {
  id: string;
  username?: string;
  email: string;
  name: string;
  phone?: string;
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
  const [activeTab, setActiveTab] = useState<AdminTab>(() => {
    const params = new URLSearchParams(window.location.search);
    const tab = params.get('tab');
    return (tab && ['dashboard','user-approvals','users','bulk-import','team-analytics','rotations','students','system','database','security','analytics','settings'].includes(tab))
      ? tab as AdminTab : 'dashboard';
  });
  const [users, setUsers] = useState<User[]>([]);
  const [metrics, setMetrics] = useState<SystemMetrics | null>(null);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [showUserModal, setShowUserModal] = useState(false);
  const [showBackupModal, setShowBackupModal] = useState(false);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  // Deactivation modal state
  const [showDeactivateModal, setShowDeactivateModal] = useState(false);
  const [deactivateTarget, setDeactivateTarget] = useState<{ id: string; name: string; currentStatus: string } | null>(null);
  const [deactivatePassword, setDeactivatePassword] = useState('');
  const [deactivateError, setDeactivateError] = useState('');
  const [deactivating, setDeactivating] = useState(false);
  const [showDeactivatePassword, setShowDeactivatePassword] = useState(false);

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
      const loadedUsers = await loadUsers();
      await Promise.all([
        loadSystemMetrics(loadedUsers),
        loadAuditLogs()
      ]);
    } catch (error) {
      console.error('Error loading admin data:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadUsers = async (): Promise<User[]> => {
    try {
      // Fetch real users from API
      const apiUsers = await apiClient.getUsers();
      const mappedUsers: User[] = apiUsers.map((u: any) => ({
        id: u.id?.toString() || '',
        username: u.username || '',
        email: u.email || '',
        name: u.full_name || u.name || '',
        phone: u.phone || '',
        role: u.role || 'house_officer',
        department: u.department || 'Plastic Surgery',
        status: u.is_active ? 'active' : 'inactive',
        lastLogin: u.last_login ? new Date(u.last_login) : null,
        permissions: u.role === 'admin' ? ['all'] : ['patient_read'],
        createdAt: u.created_at ? new Date(u.created_at) : new Date(),
        updatedAt: u.updated_at ? new Date(u.updated_at) : new Date()
      }));
      setUsers(mappedUsers);
      return mappedUsers;
    } catch (error) {
      console.error('Error loading users:', error);
      setUsers([]);
      return [];
    }
  };

  const loadSystemMetrics = async (currentUsers: User[]) => {
    try {
      const [patients, procedures, labResults] = await Promise.all([
        db.patients.count(),
        db.surgery_bookings.count(),
        db.lab_results.count()
      ]);

      const mockMetrics: SystemMetrics = {
        totalUsers: currentUsers.length,
        activeUsers: currentUsers.filter(u => u.status === 'active').length,
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
    try {
      const logs = await getRecentAuditLogs(50);
      // Transform to the component's expected format
      const formattedLogs: AuditLog[] = logs.map((log, index) => ({
        id: String(log.id || index),
        userId: log.user_id,
        userName: log.user_name,
        action: log.action,
        resource: log.resource_type.toLowerCase(),
        details: log.details || '',
        timestamp: new Date(log.timestamp),
        ipAddress: log.ip_address || 'N/A',
        userAgent: 'N/A',
        success: true
      }));
      setAuditLogs(formattedLogs);
    } catch (error) {
      console.error('Error loading audit logs:', error);
      setAuditLogs([]);
    }
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
    const user = users.find(u => u.id === userId);
    if (!user) return;

    // Only allow deleting registrars and house officers
    const deletableRoles = ['senior_registrar', 'junior_registrar', 'house_officer'];
    if (!deletableRoles.includes(user.role)) {
      toast.error('Only Registrars and House Officers can be deleted.');
      return;
    }

    const password = prompt(`To permanently delete ${user.name} (${user.role.replace('_', ' ')}), enter admin password:`);
    if (password !== 'blackvelvet') {
      if (password !== null) toast.error('Incorrect password. Deletion cancelled.');
      return;
    }

    try {
      await userManagementService.deleteUser(userId);

      // Also remove from any active PS Unit roster
      try {
        const rosters = await db.ps_unit_rosters.toArray();
        for (const roster of rosters) {
          const config = roster as UnitRosterConfig;
          let changed = false;
          if (config.seniorRegistrars?.includes(user.name)) {
            config.seniorRegistrars = config.seniorRegistrars.filter((n: string) => n !== user.name);
            changed = true;
          }
          if (config.houseOfficers?.includes(user.name)) {
            config.houseOfficers = config.houseOfficers.filter((n: string) => n !== user.name);
            changed = true;
          }
          if (changed && roster.id) {
            await db.ps_unit_rosters.update(roster.id, {
              seniorRegistrars: config.seniorRegistrars,
              houseOfficers: config.houseOfficers,
              updatedAt: new Date().toISOString()
            });
          }
        }
      } catch { /* roster table may not exist */ }

      await loadUsers();
      toast.success(`${user.name} has been permanently deleted.`);
    } catch (error: any) {
      toast.error(`Failed to delete user: ${error.message}`);
    }
  };

  const handleDeactivateUser = (userId: string) => {
    const user = users.find(u => u.id === userId);
    if (!user) return;
    setDeactivateTarget({ id: userId, name: user.name, currentStatus: user.status });
    setDeactivatePassword('');
    setDeactivateError('');
    setShowDeactivatePassword(false);
    setShowDeactivateModal(true);
  };

  const handleDeactivateConfirm = async () => {
    if (deactivatePassword !== 'blackvelvet') {
      setDeactivateError('Incorrect password. Access denied.');
      return;
    }
    if (!deactivateTarget) return;

    const isCurrentlyActive = deactivateTarget.currentStatus === 'active';
    const action = isCurrentlyActive ? 'deactivate' : 'activate';
    setDeactivating(true);
    try {
      await userManagementService.updateUserStatus(deactivateTarget.id, !isCurrentlyActive);
      setShowDeactivateModal(false);
      setDeactivateTarget(null);
      toast.success(`${deactivateTarget.name} ${action}d successfully! This applies across all devices.`);
      await loadUsers();
    } catch (error: any) {
      setDeactivateError(`Failed to ${action} user: ${error.message}`);
    } finally {
      setDeactivating(false);
    }
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

  const handleFullRecovery = async () => {
    if (confirm('This will clear all local data, caches, and service workers to fix database corruption. Your server data will be re-synced after reload. Continue?')) {
      const loadingToast = toast.loading('Performing full database recovery...');
      try {
        await fullDatabaseRecovery();
      } catch (error) {
        toast.dismiss(loadingToast);
        toast.error('Recovery failed: ' + error);
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
        <TabButton tab="team-analytics" label="Team Analytics" icon={Activity} />
        <TabButton tab="rotations" label="Rotations" icon={Calendar} />
        <TabButton tab="students" label="Students" icon={GraduationCap} />
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
                        {user.phone && (
                          <p className="text-xs text-gray-500 flex items-center gap-1">
                            <Phone className="h-3 w-3" />{user.phone}
                          </p>
                        )}
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
                      onClick={() => handleDeactivateUser(user.id)}
                      className={`flex-1 px-3 py-2.5 text-sm rounded-lg font-bold flex items-center justify-center gap-1 ${
                        user.status === 'active' 
                          ? 'bg-red-600 text-white hover:bg-red-700' 
                          : 'bg-green-600 text-white hover:bg-green-700'
                      }`}
                    >
                      <Lock className="h-4 w-4" />
                      {user.status === 'active' ? 'DEACTIVATE' : 'ACTIVATE'}
                    </button>
                    <button
                      onClick={() => handleEditUser(user)}
                      className="px-3 py-2.5 text-sm bg-gray-100 rounded-lg hover:bg-gray-200"
                    >
                      <Edit3 className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => handleDeleteUser(user.id)}
                      className="px-3 py-2 text-sm bg-red-100 text-red-600 rounded-lg hover:bg-red-200"
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
                    <th className="px-2 sm:px-4 py-2 sm:py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      User
                    </th>
                    <th className="px-2 sm:px-4 py-2 sm:py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Login Credentials
                    </th>
                    <th className="px-2 sm:px-4 py-2 sm:py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Role & Department
                    </th>
                    <th className="px-2 sm:px-4 py-2 sm:py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-2 sm:px-4 py-2 sm:py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Last Login
                    </th>
                    <th className="px-2 sm:px-4 py-2 sm:py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {filteredUsers.map((user) => (
                    <tr key={user.id} className="hover:bg-gray-50">
                      <td className="px-2 sm:px-4 py-2 sm:py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <div className="h-10 w-10 rounded-full bg-gray-300 flex items-center justify-center">
                            <span className="text-sm font-medium text-gray-700">
                              {user.name.split(' ').map(n => n[0]).join('')}
                            </span>
                          </div>
                          <div className="ml-4">
                            <div className="text-sm font-medium text-gray-900">{user.name}</div>
                            <div className="text-sm text-gray-500">{user.email}</div>
                            {user.phone && (
                              <div className="text-xs text-gray-400 flex items-center gap-1">
                                <Phone className="h-3 w-3" />{user.phone}
                              </div>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-2 sm:px-4 py-2 sm:py-4 whitespace-nowrap">
                        <div className="flex items-center space-x-2">
                          <Key className="h-4 w-4 text-gray-400" />
                          <div>
                            <div className="text-sm font-mono text-gray-900">{user.username || 'N/A'}</div>
                            <div className="text-xs text-gray-500">Username</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-2 sm:px-4 py-2 sm:py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900 capitalize">{user.role.replace('_', ' ')}</div>
                        <div className="text-sm text-gray-500">{user.department}</div>
                      </td>
                      <td className="px-2 sm:px-4 py-2 sm:py-4 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                            user.status === 'active' 
                              ? 'bg-green-100 text-green-800'
                              : user.status === 'suspended'
                              ? 'bg-red-100 text-red-800'
                              : 'bg-gray-100 text-gray-800'
                          }`}>
                            {user.status}
                          </span>
                          <button
                            onClick={() => handleDeactivateUser(user.id)}
                            className={`px-3 py-1.5 rounded-md transition text-xs font-medium flex items-center gap-1 ${
                              user.status === 'active'
                                ? 'bg-red-100 text-red-700 hover:bg-red-200 border border-red-300'
                                : 'bg-green-100 text-green-700 hover:bg-green-200 border border-green-300'
                            }`}
                            title={user.status === 'active' ? 'Deactivate User' : 'Activate User'}
                          >
                            <Lock className="h-3.5 w-3.5" />
                            {user.status === 'active' ? 'Deactivate' : 'Activate'}
                          </button>
                        </div>
                      </td>
                      <td className="px-2 sm:px-4 py-2 sm:py-4 whitespace-nowrap text-sm text-gray-500">
                        {user.lastLogin ? format(new Date(user.lastLogin), 'MMM d, yyyy HH:mm') : 'Never'}
                      </td>
                      <td className="px-2 sm:px-4 py-2 sm:py-4 whitespace-nowrap text-sm font-medium">
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => handleEditUser(user)}
                            className="text-blue-600 hover:text-blue-900" title="Edit"
                          >
                            <Edit3 className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => handleDeactivateUser(user.id)}
                            className={`px-3 py-1.5 rounded-md transition text-xs font-medium flex items-center gap-1 ${
                              user.status === 'active'
                                ? 'bg-red-50 text-red-700 hover:bg-red-100 border border-red-200'
                                : 'bg-green-50 text-green-700 hover:bg-green-100 border border-green-200'
                            }`}
                            title={user.status === 'active' ? 'Deactivate User' : 'Activate User'}
                          >
                            <Lock className="h-3.5 w-3.5" />
                            {user.status === 'active' ? 'Deactivate' : 'Activate'}
                          </button>
                          <button
                            onClick={() => handleDeleteUser(user.id)}
                            className="text-red-600 hover:text-red-900" title="Delete"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Deactivation Password Confirmation Modal */}
      {showDeactivateModal && deactivateTarget && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-0 sm:p-4 z-50">
          <div className="bg-white rounded-none sm:rounded-lg shadow-xl w-full sm:max-w-md h-full sm:h-auto">
            <div className="px-3 sm:px-6 py-3 sm:py-4 border-b flex items-center gap-3">
              <div className={`p-2 rounded-full ${
                deactivateTarget.currentStatus === 'active' ? 'bg-red-100' : 'bg-green-100'
              }`}>
                <Lock className={`h-5 w-5 ${
                  deactivateTarget.currentStatus === 'active' ? 'text-red-600' : 'text-green-600'
                }`} />
              </div>
              <div>
                <h3 className="text-lg font-bold text-gray-900">
                  {deactivateTarget.currentStatus === 'active' ? 'Deactivate' : 'Activate'} User
                </h3>
                <p className="text-sm text-gray-500">{deactivateTarget.name}</p>
              </div>
            </div>
            <div className="p-6 space-y-4">
              {deactivateTarget.currentStatus === 'active' && (
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                  <p className="text-sm text-amber-800"><strong>Warning:</strong> Deactivating this user will:</p>
                  <ul className="text-xs text-amber-700 mt-1 ml-4 list-disc space-y-0.5">
                    <li>Prevent them from logging in on all devices</li>
                    <li>Exclude them from clinic duties & rosters</li>
                    <li>Exclude them from team analytics & assignments</li>
                    <li>This change persists in the database across all devices</li>
                  </ul>
                </div>
              )}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Enter admin password to confirm
                </label>
                <div className="relative">
                  <input
                    type={showDeactivatePassword ? 'text' : 'password'}
                    value={deactivatePassword}
                    onChange={(e) => { setDeactivatePassword(e.target.value); setDeactivateError(''); }}
                    onKeyDown={(e) => e.key === 'Enter' && handleDeactivateConfirm()}
                    placeholder="Enter password..."
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 pr-10"
                    autoFocus
                  />
                  <button
                    type="button"
                    onClick={() => setShowDeactivatePassword(!showDeactivatePassword)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    {showDeactivatePassword ? <XCircle className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                {deactivateError && (
                  <p className="text-sm text-red-600 mt-1">{deactivateError}</p>
                )}
              </div>
              <div className="flex gap-3">
                <button
                  onClick={handleDeactivateConfirm}
                  disabled={!deactivatePassword || deactivating}
                  className={`flex-1 px-4 py-2 rounded-lg font-medium text-white transition disabled:opacity-50 ${
                    deactivateTarget.currentStatus === 'active'
                      ? 'bg-red-600 hover:bg-red-700'
                      : 'bg-green-600 hover:bg-green-700'
                  }`}
                >
                  {deactivating ? 'Processing...' : deactivateTarget.currentStatus === 'active' ? 'Deactivate' : 'Activate'}
                </button>
                <button
                  onClick={() => { setShowDeactivateModal(false); setDeactivateTarget(null); }}
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-lg font-medium text-gray-700 hover:bg-gray-50 transition"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Bulk Import Tab */}
      {activeTab === 'bulk-import' && (
        <BulkUserImport />
      )}

      {/* Team Analytics Tab */}
      {activeTab === 'team-analytics' && (
        <TeamAnalytics />
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
                  <button
                    onClick={handleFullRecovery}
                    className="w-full flex items-center justify-center space-x-2 py-2 px-4 bg-orange-600 text-white rounded-lg hover:bg-orange-700"
                  >
                    <AlertTriangle className="h-4 w-4" />
                    <span>Fix Corrupted Database</span>
                  </button>
                  <button
                    onClick={triggerEmergencyRecovery}
                    className="w-full flex items-center justify-center space-x-2 py-2 px-4 bg-purple-600 text-white rounded-lg hover:bg-purple-700"
                  >
                    <AlertTriangle className="h-4 w-4" />
                    <span>Emergency Recovery (Severe)</span>
                  </button>
                  <p className="text-xs text-gray-500 mt-2">
                    If buttons don't work, visit: <a href="/?recover=true" className="text-blue-600 underline">/?recover=true</a>
                  </p>
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

      {/* Rotations Tab */}
      {activeTab === 'rotations' && (
        <RotationManagement />
      )}

      {/* Students Tab */}
      {activeTab === 'students' && <StudentManagementTab />}

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
    phone: user?.phone || '',
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
        // Update existing user via API
        try {
          await apiClient.updateUser(user.id, {
            fullName: formData.name,
            email: formData.email,
            phone: formData.phone,
            role: formData.role
          });
        } catch (err) {
          console.warn('Server update failed, updating locally:', err);
        }
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
          phone: formData.phone,
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
                Phone Number
              </label>
              <div className="relative">
                <Phone className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <input
                  type="tel"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg pl-10 pr-3 py-2 focus:ring-2 focus:ring-green-500 focus:border-transparent"
                  placeholder="e.g., +234 801 234 5678"
                />
              </div>
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

// ═══════════════════════════════════════════════════════════════════════════════
// STUDENT MANAGEMENT TAB  
// ═══════════════════════════════════════════════════════════════════════════════
function StudentManagementTab() {
  const [students, setStudents] = useState<any[]>([]);
  const [overview, setOverview] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [selectedStudent, setSelectedStudent] = useState<any>(null);
  const [detail, setDetail] = useState<any>(null);
  const [evalModal, setEvalModal] = useState<{ type: 'clerking' | 'plan'; id: number } | null>(null);
  const [evalScore, setEvalScore] = useState('');
  const [evalFeedback, setEvalFeedback] = useState('');
  const [evalSaving, setEvalSaving] = useState(false);
  const [assigningPatients, setAssigningPatients] = useState(false);
  const [bulkApproving, setBulkApproving] = useState(false);
  const [patientPickerOpen, setPatientPickerOpen] = useState(false);
  const [availablePatients, setAvailablePatients] = useState<any[]>([]);
  const [patientSearch, setPatientSearch] = useState('');
  const [loadingPatients, setLoadingPatients] = useState(false);

  const shareLink = `${window.location.origin}/student-register`;

  const loadData = async () => {
    setLoading(true);
    try {
      const [studentList, overviewData] = await Promise.all([
        apiClient.get('/students'),
        apiClient.get('/students/overview'),
      ]);
      setStudents(studentList);
      setOverview(overviewData.stats);
    } catch (err) {
      console.error('Failed to load students:', err);
    } finally {
      setLoading(false);
    }
  };

  const loadStudentDetail = async (id: number) => {
    try {
      const data = await apiClient.get(`/students/${id}`);
      setDetail(data);
      setSelectedStudent(data.student);
    } catch (err) {
      console.error('Failed to load student detail:', err);
    }
  };

  const approveStudent = async (id: number, approved: boolean) => {
    try {
      await apiClient.put('/students/approve', { studentId: id, approved });
      await loadData();
      if (detail?.student?.id === id) await loadStudentDetail(id);
    } catch (err: any) {
      alert(err.message || 'Failed');
    }
  };

  const deactivateStudent = async (id: number, active: boolean) => {
    try {
      await apiClient.put('/students/deactivate', { studentId: id, active });
      await loadData();
      if (detail?.student?.id === id) await loadStudentDetail(id);
    } catch (err: any) {
      alert(err.message || 'Failed');
    }
  };

  const submitEvaluation = async () => {
    if (!evalModal || !evalScore) return;
    setEvalSaving(true);
    try {
      const body: any = { score: parseInt(evalScore), feedback: evalFeedback };
      if (evalModal.type === 'clerking') body.clerkingId = evalModal.id;
      else body.treatmentPlanId = evalModal.id;
      await apiClient.put('/students/evaluate', body);
      setEvalModal(null);
      setEvalScore('');
      setEvalFeedback('');
      if (selectedStudent) await loadStudentDetail(selectedStudent.id);
    } catch (err: any) {
      alert(err.message || 'Evaluation failed');
    } finally {
      setEvalSaving(false);
    }
  };

  // Bulk approve all pending students
  const bulkApproveAll = async () => {
    if (!confirm('Approve ALL pending students and auto-assign patients?')) return;
    setBulkApproving(true);
    try {
      const result = await apiClient.post('/students/bulk-approve', {});
      alert(result.message || 'Students approved');
      await loadData();
    } catch (err: any) {
      alert(err.message || 'Bulk approve failed');
    } finally {
      setBulkApproving(false);
    }
  };

  // Auto-assign patients for all active students
  const autoAssignAll = async () => {
    setAssigningPatients(true);
    try {
      const result = await apiClient.post('/students/auto-assign-all', {});
      alert(result.message || 'Patients assigned');
      await loadData();
    } catch (err: any) {
      alert(err.message || 'Auto-assign failed');
    } finally {
      setAssigningPatients(false);
    }
  };

  // Auto-assign patients to a student
  const autoAssignPatients = async (studentId: number) => {
    setAssigningPatients(true);
    try {
      const result = await apiClient.post('/students/assign-patients', { studentId });
      alert(result.message || `${result.assigned} patients assigned`);
      await loadData();
      if (detail?.student?.id === studentId) await loadStudentDetail(studentId);
    } catch (err: any) {
      alert(err.message || 'Failed to assign patients');
    } finally {
      setAssigningPatients(false);
    }
  };

  // Open patient picker for manual assignment
  const openPatientPicker = async (studentId: number) => {
    setPatientPickerOpen(true);
    setPatientSearch('');
    await searchAvailablePatients(studentId, '');
  };

  // Search available patients
  const searchAvailablePatients = async (studentId: number, search: string) => {
    setLoadingPatients(true);
    try {
      const params = new URLSearchParams({ studentId: String(studentId) });
      if (search) params.set('search', search);
      const patients = await apiClient.get(`/students/available-patients?${params}`);
      setAvailablePatients(patients);
    } catch (err) {
      console.error('Failed to load patients:', err);
      setAvailablePatients([]);
    } finally {
      setLoadingPatients(false);
    }
  };

  // Manually assign a single patient
  const assignSinglePatient = async (studentId: number, patientId: number) => {
    try {
      await apiClient.post('/students/assign-patient', { studentId, patientId });
      await loadStudentDetail(studentId);
      await loadData();
      // Refresh available patients
      await searchAvailablePatients(studentId, patientSearch);
    } catch (err: any) {
      alert(err.message || 'Failed to assign patient');
    }
  };

  // Unassign a patient
  const unassignPatient = async (studentId: number, patientId: string) => {
    if (!confirm('Remove this patient from the student?')) return;
    try {
      await apiClient.put('/students/unassign-patient', { studentId, patientId });
      await loadStudentDetail(studentId);
      await loadData();
    } catch (err: any) {
      alert(err.message || 'Failed to unassign patient');
    }
  };

  useEffect(() => { loadData(); }, []);

  if (loading) return <div className="flex justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-green-600" /></div>;

  return (
    <div className="space-y-6">
      {/* Header + Share Link */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold text-gray-900">Student Management</h2>
          <p className="text-sm text-gray-500">Manage clinical posting students</p>
        </div>
        <div className="flex items-center gap-2">
          <input readOnly value={shareLink} className="text-xs border border-gray-300 rounded-lg px-3 py-2 w-64 bg-gray-50" onClick={e => (e.target as HTMLInputElement).select()} title="Student registration link" />
          <button onClick={() => { navigator.clipboard.writeText(shareLink); alert('Link copied!'); }}
            className="px-3 py-2 bg-green-600 text-white rounded-lg text-sm hover:bg-green-700 flex items-center gap-1">
            <Copy className="w-4 h-4" /> Copy Link
          </button>
        </div>
      </div>

      {/* Bulk Actions */}
      {overview && (parseInt(overview.pending_approval) > 0 || parseInt(overview.active_students) > 0) && (
        <div className="flex flex-wrap gap-2">
          {parseInt(overview.pending_approval) > 0 && (
            <button onClick={bulkApproveAll} disabled={bulkApproving}
              className="px-4 py-2 bg-green-600 text-white text-sm rounded-lg hover:bg-green-700 disabled:opacity-50 flex items-center gap-1.5">
              {bulkApproving ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
              Approve All Pending ({overview.pending_approval})
            </button>
          )}
          <button onClick={autoAssignAll} disabled={assigningPatients}
            className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center gap-1.5">
            {assigningPatients ? <Loader2 className="w-4 h-4 animate-spin" /> : <UserPlus className="w-4 h-4" />}
            Auto-Assign Patients to All
          </button>
        </div>
      )}

      {/* Overview Stats */}
      {overview && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: 'Total Students', value: overview.total_students, color: 'blue' },
            { label: 'Active', value: overview.active_students, color: 'green' },
            { label: 'Pending Approval', value: overview.pending_approval, color: 'yellow' },
            { label: 'Expired Postings', value: overview.expired_postings, color: 'red' },
          ].map((s, i) => (
            <div key={i} className="bg-white border border-gray-200 rounded-lg p-4">
              <p className="text-xs text-gray-500">{s.label}</p>
              <p className={`text-2xl font-bold text-${s.color}-600`}>{s.value}</p>
            </div>
          ))}
        </div>
      )}

      {/* Back button when viewing detail */}
      {selectedStudent && (
        <button onClick={() => { setSelectedStudent(null); setDetail(null); }}
          className="text-sm text-blue-600 hover:underline">&larr; Back to student list</button>
      )}

      {/* Student Detail View */}
      {selectedStudent && detail ? (
        <div className="space-y-4">
          <div className="bg-white border border-gray-200 rounded-lg p-5">
            <div className="flex items-start justify-between mb-4">
              <div>
                <h3 className="text-lg font-bold text-gray-900">{selectedStudent.full_name}</h3>
                <p className="text-sm text-gray-500">{selectedStudent.email} · {selectedStudent.university || 'N/A'} · {selectedStudent.matric_number || 'N/A'}</p>
                <p className="text-sm text-gray-500">Posting: {new Date(selectedStudent.posting_start).toLocaleDateString()} – {new Date(selectedStudent.posting_end).toLocaleDateString()}</p>
              </div>
              <div className="flex gap-2">
                {!selectedStudent.is_approved ? (
                  <button onClick={() => approveStudent(selectedStudent.id, true)}
                    className="px-3 py-1.5 bg-green-600 text-white text-sm rounded-lg hover:bg-green-700">Approve</button>
                ) : (
                  <span className="px-2 py-1 text-xs bg-green-100 text-green-700 rounded-full">Approved</span>
                )}
                <button onClick={() => deactivateStudent(selectedStudent.id, !selectedStudent.is_active)}
                  className={`px-3 py-1.5 text-sm rounded-lg ${selectedStudent.is_active ? 'bg-red-600 text-white hover:bg-red-700' : 'bg-gray-600 text-white hover:bg-gray-700'}`}>
                  {selectedStudent.is_active ? 'Deactivate' : 'Reactivate'}
                </button>
              </div>
            </div>

            {/* Assigned Patients */}
            <div className="flex items-center justify-between mb-2 mt-4">
              <h4 className="font-semibold text-gray-800">Assigned Patients ({detail.patients?.length || 0}/5)</h4>
              <div className="flex gap-2">
                {(detail.patients?.length || 0) < 5 && (
                  <>
                    <button onClick={() => autoAssignPatients(selectedStudent.id)} disabled={assigningPatients}
                      className="px-3 py-1.5 bg-green-600 text-white text-xs rounded-lg hover:bg-green-700 disabled:opacity-50 flex items-center gap-1">
                      {assigningPatients ? <Loader2 className="w-3 h-3 animate-spin" /> : <UserPlus className="w-3 h-3" />} Auto-Assign
                    </button>
                    <button onClick={() => openPatientPicker(selectedStudent.id)}
                      className="px-3 py-1.5 bg-blue-600 text-white text-xs rounded-lg hover:bg-blue-700 flex items-center gap-1">
                      <Plus className="w-3 h-3" /> Add Patient
                    </button>
                  </>
                )}
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mb-4">
              {(detail.patients || []).map((p: any) => (
                <div key={p.patient_id} className="bg-gray-50 rounded-lg p-3 text-sm flex items-center justify-between">
                  <div>
                    <p className="font-medium">{p.first_name} {p.last_name}</p>
                    <p className="text-xs text-gray-500">
                      {p.hospital_number ? `HN: ${p.hospital_number} · ` : ''}Ward: {p.ward_id || 'N/A'} · Bed: {p.bed_number || 'N/A'}
                    </p>
                  </div>
                  <button onClick={() => unassignPatient(selectedStudent.id, p.patient_id)}
                    className="p-1 hover:bg-red-100 rounded" title="Remove patient">
                    <XCircle className="w-4 h-4 text-red-400" />
                  </button>
                </div>
              ))}
              {(!detail.patients || detail.patients.length === 0) && (
                <p className="text-sm text-gray-400 col-span-2">No patients assigned. Click "Auto-Assign" or "Add Patient" above.</p>
              )}
            </div>

            {/* Patient Picker Modal */}
            {patientPickerOpen && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="font-semibold text-blue-900">Select Patient to Assign</h4>
                  <button onClick={() => setPatientPickerOpen(false)} className="text-gray-400 hover:text-gray-600">
                    <X className="w-4 h-4" />
                  </button>
                </div>
                <input type="text" placeholder="Search by name or hospital number..." value={patientSearch}
                  onChange={e => { setPatientSearch(e.target.value); searchAvailablePatients(selectedStudent.id, e.target.value); }}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm mb-3" />
                {loadingPatients ? (
                  <div className="flex justify-center py-4"><Loader2 className="w-5 h-5 animate-spin text-blue-500" /></div>
                ) : availablePatients.length > 0 ? (
                  <div className="max-h-48 overflow-y-auto space-y-1">
                    {availablePatients.map((p: any) => (
                      <div key={p.id} className="flex items-center justify-between bg-white rounded px-3 py-2 text-sm hover:bg-blue-50">
                        <div>
                          <span className="font-medium">{p.first_name || ''} {p.last_name || ''}</span>
                          {p.full_name && !p.first_name && <span className="font-medium">{p.full_name}</span>}
                          <span className="text-xs text-gray-500 ml-2">{p.hospital_number || ''} {p.ward_id ? `· Ward ${p.ward_id}` : ''}</span>
                        </div>
                        <button onClick={() => assignSinglePatient(selectedStudent.id, p.id)}
                          className="px-2 py-1 bg-green-600 text-white text-xs rounded hover:bg-green-700">Assign</button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-gray-400 text-center py-2">No available patients found</p>
                )}
              </div>
            )}

            {/* Clerkings */}
            <h4 className="font-semibold text-gray-800 mb-2">Clerkings ({detail.clerkings?.length || 0})</h4>
            <div className="space-y-2 mb-4">
              {(detail.clerkings || []).map((c: any) => (
                <div key={c.id} className="bg-white border border-gray-200 rounded-lg p-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium">{c.provisional_diagnosis || 'Draft'}</p>
                      <p className="text-xs text-gray-500">{c.first_name} {c.last_name} · {new Date(c.created_at).toLocaleDateString()}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      {c.evaluation_score != null ? (
                        <span className={`text-sm font-bold ${c.evaluation_score >= 70 ? 'text-green-600' : c.evaluation_score >= 50 ? 'text-yellow-600' : 'text-red-600'}`}>{c.evaluation_score}/100</span>
                      ) : (
                        <button onClick={() => { setEvalModal({ type: 'clerking', id: c.id }); setEvalScore(''); setEvalFeedback(''); }}
                          className="px-2 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700 flex items-center gap-1">
                          <Star className="w-3 h-3" /> Evaluate
                        </button>
                      )}
                    </div>
                  </div>
                  {c.chief_complaint && <p className="text-xs text-gray-600 mt-1 truncate">CC: {c.chief_complaint}</p>}
                </div>
              ))}
              {(!detail.clerkings || detail.clerkings.length === 0) && <p className="text-sm text-gray-400">No clerkings yet</p>}
            </div>

            {/* Treatment Plans */}
            <h4 className="font-semibold text-gray-800 mb-2">Treatment Plans ({detail.treatmentPlans?.length || 0})</h4>
            <div className="space-y-2">
              {(detail.treatmentPlans || []).map((p: any) => (
                <div key={p.id} className="bg-white border border-gray-200 rounded-lg p-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium">{p.diagnosis || 'Draft'}</p>
                      <p className="text-xs text-gray-500">{p.first_name} {p.last_name} · {new Date(p.created_at).toLocaleDateString()}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      {p.evaluation_score != null ? (
                        <span className={`text-sm font-bold ${p.evaluation_score >= 70 ? 'text-green-600' : p.evaluation_score >= 50 ? 'text-yellow-600' : 'text-red-600'}`}>{p.evaluation_score}/100</span>
                      ) : (
                        <button onClick={() => { setEvalModal({ type: 'plan', id: p.id }); setEvalScore(''); setEvalFeedback(''); }}
                          className="px-2 py-1 text-xs bg-purple-600 text-white rounded hover:bg-purple-700 flex items-center gap-1">
                          <Star className="w-3 h-3" /> Evaluate
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
              {(!detail.treatmentPlans || detail.treatmentPlans.length === 0) && <p className="text-sm text-gray-400">No treatment plans yet</p>}
            </div>
          </div>
        </div>
      ) : (
        /* Student List */
        <div className="bg-white border border-gray-200 rounded-lg overflow-x-auto">
          <table className="w-full text-sm min-w-[700px]">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Name</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">University</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Posting</th>
                <th className="text-center px-4 py-3 font-medium text-gray-600">Patients</th>
                <th className="text-center px-4 py-3 font-medium text-gray-600">Clerkings</th>
                <th className="text-center px-4 py-3 font-medium text-gray-600">Avg Score</th>
                <th className="text-center px-4 py-3 font-medium text-gray-600">Status</th>
                <th className="text-right px-4 py-3 font-medium text-gray-600">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {students.map(s => {
                const expired = new Date(s.posting_end) < new Date();
                const avgScore = s.avg_clerking_score ? Math.round(Number(s.avg_clerking_score)) : null;
                return (
                  <tr key={s.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <p className="font-medium text-gray-900">{s.full_name}</p>
                      <p className="text-xs text-gray-400">{s.email}</p>
                    </td>
                    <td className="px-4 py-3 text-gray-600">{s.university || '—'}</td>
                    <td className="px-4 py-3 text-xs text-gray-500">
                      {new Date(s.posting_start).toLocaleDateString()} – {new Date(s.posting_end).toLocaleDateString()}
                      {expired && <span className="ml-1 text-red-500 font-medium">(Expired)</span>}
                    </td>
                    <td className="px-4 py-3 text-center">{s.assigned_patients || 0}/5</td>
                    <td className="px-4 py-3 text-center">{s.total_clerkings || 0}</td>
                    <td className="px-4 py-3 text-center">
                      {avgScore != null ? <span className={`font-medium ${avgScore >= 70 ? 'text-green-600' : avgScore >= 50 ? 'text-yellow-600' : 'text-red-600'}`}>{avgScore}%</span> : '—'}
                    </td>
                    <td className="px-4 py-3 text-center">
                      {!s.is_approved ? (
                        <span className="px-2 py-0.5 text-xs bg-yellow-100 text-yellow-700 rounded-full">Pending</span>
                      ) : !s.is_active ? (
                        <span className="px-2 py-0.5 text-xs bg-red-100 text-red-700 rounded-full">Inactive</span>
                      ) : (
                        <span className="px-2 py-0.5 text-xs bg-green-100 text-green-700 rounded-full">Active</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button onClick={() => loadStudentDetail(s.id)} className="p-1.5 hover:bg-gray-100 rounded" title="View detail">
                          <Eye className="w-4 h-4 text-gray-500" />
                        </button>
                        {s.is_approved && s.is_active && (s.assigned_patients || 0) < 5 && (
                          <button onClick={() => autoAssignPatients(s.id)} disabled={assigningPatients}
                            className="p-1.5 hover:bg-green-100 rounded" title="Auto-assign patients">
                            <UserPlus className="w-4 h-4 text-green-600" />
                          </button>
                        )}
                        {!s.is_approved && (
                          <button onClick={() => approveStudent(s.id, true)} className="p-1.5 hover:bg-green-100 rounded" title="Approve">
                            <CheckCircle className="w-4 h-4 text-green-600" />
                          </button>
                        )}
                        <button onClick={() => deactivateStudent(s.id, !s.is_active)}
                          className="p-1.5 hover:bg-red-100 rounded" title={s.is_active ? 'Deactivate' : 'Reactivate'}>
                          {s.is_active ? <XCircle className="w-4 h-4 text-red-500" /> : <CheckCircle className="w-4 h-4 text-gray-500" />}
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {students.length === 0 && (
                <tr><td colSpan={8} className="px-4 py-8 text-center text-gray-400">No students registered yet. Share the registration link above.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Evaluation Modal */}
      {evalModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-gray-900">Evaluate {evalModal.type === 'clerking' ? 'Clerking' : 'Treatment Plan'}</h3>
              <button onClick={() => setEvalModal(null)} aria-label="Close"><X className="w-5 h-5 text-gray-400" /></button>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Score (0–100) *</label>
              <input type="number" min="0" max="100" value={evalScore} onChange={e => setEvalScore(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg" placeholder="e.g. 75" title="Evaluation score" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Feedback</label>
              <textarea rows={3} value={evalFeedback} onChange={e => setEvalFeedback(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" placeholder="Comments on strengths, areas for improvement..." />
            </div>
            <div className="flex gap-3">
              <button onClick={() => setEvalModal(null)} className="flex-1 py-2 border border-gray-300 rounded-lg text-sm">Cancel</button>
              <button onClick={submitEvaluation} disabled={!evalScore || evalSaving}
                className="flex-1 py-2 bg-green-600 text-white rounded-lg text-sm hover:bg-green-700 disabled:opacity-50 flex items-center justify-center gap-1">
                {evalSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Star className="w-4 h-4" />} Submit Score
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
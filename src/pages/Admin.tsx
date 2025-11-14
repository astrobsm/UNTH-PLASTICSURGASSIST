import React, { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { adminService } from '../services/adminService';
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
  WifiOff
} from 'lucide-react';
import Layout from '../components/Layout';
import { UserApprovalManager } from '../components/UserApprovalManager';
import { AISettingsPanel } from '../components/AISettingsPanel';
import { db } from '../db/database';
import { resetDatabase } from '../utils/dbReset';

type AdminTab = 'dashboard' | 'user-approvals' | 'users' | 'system' | 'database' | 'security' | 'analytics' | 'settings';

interface User {
  id: string;
  email: string;
  name: string;
  role: 'super_admin' | 'consultant' | 'registrar' | 'intern' | 'nurse' | 'lab_staff' | 'pharmacy';
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
    // Mock users data - in real app would come from API
    const mockUsers: User[] = [
      {
        id: '1',
        email: 'admin@hospital.com',
        name: 'System Administrator',
        role: 'super_admin',
        department: 'IT',
        status: 'active',
        lastLogin: new Date(),
        permissions: ['all'],
        createdAt: new Date('2024-01-01'),
        updatedAt: new Date()
      },
      {
        id: '2',
        email: 'dr.smith@hospital.com',
        name: 'Dr. John Smith',
        role: 'consultant',
        department: 'Plastic Surgery',
        status: 'active',
        lastLogin: new Date(),
        permissions: ['patient_read', 'patient_write', 'procedure_all'],
        createdAt: new Date('2024-01-15'),
        updatedAt: new Date()
      },
      {
        id: '3',
        email: 'dr.jones@hospital.com',
        name: 'Dr. Sarah Jones',
        role: 'registrar',
        department: 'Plastic Surgery',
        status: 'active',
        lastLogin: new Date(Date.now() - 2 * 60 * 60 * 1000), // 2 hours ago
        permissions: ['patient_read', 'patient_write', 'procedure_read'],
        createdAt: new Date('2024-02-01'),
        updatedAt: new Date()
      }
    ];
    setUsers(mockUsers);
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

  const TabButton = ({ tab, label, icon: Icon }: { tab: AdminTab; label: string; icon: any }) => (
    <button
      onClick={() => setActiveTab(tab)}
      className={`flex items-center space-x-2 px-4 py-3 rounded-lg font-medium transition-colors ${
        activeTab === tab
          ? 'bg-green-600 text-white'
          : 'text-gray-600 hover:bg-gray-100'
      }`}
    >
      <Icon className="h-5 w-5" />
      <span>{label}</span>
    </button>
  );

  const filteredUsers = users.filter(user => 
    user.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    user.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
    user.department.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">System Administration</h1>
          <p className="text-gray-600">Manage users, system settings, and monitor application health</p>
        </div>
        <div className="flex items-center space-x-4">
          <div className={`flex items-center space-x-2 px-3 py-2 rounded-lg ${
            isOnline ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
          }`}>
            {isOnline ? <Wifi className="h-4 w-4" /> : <WifiOff className="h-4 w-4" />}
            <span className="text-sm font-medium">
              {isOnline ? 'Online' : 'Offline'}
            </span>
          </div>
          <button
            onClick={loadAdminData}
            disabled={loading}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors flex items-center space-x-2"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="flex space-x-2 mb-6 overflow-x-auto">
        <TabButton tab="dashboard" label="Dashboard" icon={BarChart3} />
        <TabButton tab="user-approvals" label="User Approvals" icon={UserCheck} />
        <TabButton tab="users" label="User Management" icon={Users} />
        <TabButton tab="system" label="System Health" icon={Activity} />
        <TabButton tab="database" label="Database" icon={Database} />
        <TabButton tab="security" label="Security" icon={Shield} />
        <TabButton tab="analytics" label="Analytics" icon={BarChart3} />
        <TabButton tab="settings" label="Settings" icon={Settings} />
      </div>

      {/* Dashboard Tab */}
      {activeTab === 'dashboard' && (
        <div className="space-y-6">
          {/* System Metrics Overview */}
          {metrics && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <div className="bg-white rounded-lg border border-gray-200 p-6">
                <div className="flex items-center">
                  <Users className="h-8 w-8 text-blue-600" />
                  <div className="ml-4">
                    <p className="text-sm font-medium text-gray-500">Total Users</p>
                    <p className="text-2xl font-bold text-gray-900">{metrics.totalUsers}</p>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-lg border border-gray-200 p-6">
                <div className="flex items-center">
                  <UserCheck className="h-8 w-8 text-green-600" />
                  <div className="ml-4">
                    <p className="text-sm font-medium text-gray-500">Active Users</p>
                    <p className="text-2xl font-bold text-gray-900">{metrics.activeUsers}</p>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-lg border border-gray-200 p-6">
                <div className="flex items-center">
                  <Users className="h-8 w-8 text-purple-600" />
                  <div className="ml-4">
                    <p className="text-sm font-medium text-gray-500">Total Patients</p>
                    <p className="text-2xl font-bold text-gray-900">{metrics.totalPatients}</p>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-lg border border-gray-200 p-6">
                <div className="flex items-center">
                  <Activity className="h-8 w-8 text-orange-600" />
                  <div className="ml-4">
                    <p className="text-sm font-medium text-gray-500">System Health</p>
                    <p className="text-2xl font-bold text-gray-900">{metrics.performanceScore}%</p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Recent Activity */}
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <h3 className="text-lg font-medium text-gray-900 mb-4">Recent System Activity</h3>
            <div className="space-y-4">
              {auditLogs.slice(0, 5).map((log) => (
                <div key={log.id} className="flex items-center space-x-4 p-3 bg-gray-50 rounded-lg">
                  <div className={`p-2 rounded-full ${
                    log.success ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-600'
                  }`}>
                    {log.success ? <CheckCircle className="h-4 w-4" /> : <XCircle className="h-4 w-4" />}
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-gray-900">
                      {log.userName} {log.action.toLowerCase()}d {log.resource}
                    </p>
                    <p className="text-xs text-gray-500">{log.details}</p>
                  </div>
                  <div className="text-xs text-gray-500">
                    {format(log.timestamp, 'MMM d, HH:mm')}
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
        <div className="space-y-6">
          {/* User Management Header */}
          <div className="flex justify-between items-center">
            <div>
              <h2 className="text-xl font-semibold text-gray-900">User Management</h2>
              <p className="text-gray-600">Manage user accounts, roles, and permissions</p>
            </div>
            <button
              onClick={handleCreateUser}
              className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition-colors flex items-center space-x-2"
            >
              <UserPlus className="h-4 w-4" />
              <span>Add User</span>
            </button>
          </div>

          {/* Search and Filters */}
          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <div className="flex space-x-4">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search users by name, email, or department..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                />
              </div>
              <button className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 flex items-center space-x-2">
                <Filter className="h-4 w-4" />
                <span>Filter</span>
              </button>
            </div>
          </div>

          {/* Users Table */}
          <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      User
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
                        {user.lastLogin ? format(user.lastLogin, 'MMM d, yyyy HH:mm') : 'Never'}
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
                      {metrics.lastBackup ? format(metrics.lastBackup, 'MMM d, yyyy HH:mm') : 'Never'}
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
                      {format(log.timestamp, 'MMM d, yyyy HH:mm:ss')}
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
          onSave={(user) => {
            if (selectedUser) {
              setUsers(users.map(u => u.id === user.id ? user : u));
            } else {
              setUsers([...users, { ...user, id: Date.now().toString() }]);
            }
            setShowUserModal(false);
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

// User Modal Component
const UserModal = ({ 
  user, 
  onClose, 
  onSave 
}: { 
  user: User | null; 
  onClose: () => void; 
  onSave: (user: User) => void; 
}) => {
  const [formData, setFormData] = useState({
    name: user?.name || '',
    email: user?.email || '',
    role: user?.role || 'intern',
    department: user?.department || '',
    status: user?.status || 'active'
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const userData: User = {
      id: user?.id || '',
      ...formData,
      permissions: formData.role === 'super_admin' ? ['all'] : ['patient_read'],
      lastLogin: user?.lastLogin || null,
      createdAt: user?.createdAt || new Date(),
      updatedAt: new Date()
    };
    onSave(userData);
  };

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

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Full Name
              </label>
              <input
                type="text"
                required
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-green-500 focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Email Address
              </label>
              <input
                type="email"
                required
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-green-500 focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Role
              </label>
              <select
                value={formData.role}
                onChange={(e) => setFormData({ ...formData, role: e.target.value as User['role'] })}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-green-500 focus:border-transparent"
              >
                <option value="intern">Intern</option>
                <option value="registrar">Registrar</option>
                <option value="consultant">Consultant</option>
                <option value="nurse">Nurse</option>
                <option value="lab_staff">Lab Staff</option>
                <option value="pharmacy">Pharmacy</option>
                <option value="super_admin">Super Admin</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Department
              </label>
              <input
                type="text"
                required
                value={formData.department}
                onChange={(e) => setFormData({ ...formData, department: e.target.value })}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-green-500 focus:border-transparent"
              />
            </div>

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

            <div className="flex space-x-3 pt-4">
              <button
                type="submit"
                className="flex-1 bg-green-600 text-white py-2 px-4 rounded-lg hover:bg-green-700 transition-colors"
              >
                {user ? 'Update User' : 'Create User'}
              </button>
              <button
                type="button"
                onClick={onClose}
                className="flex-1 bg-gray-500 text-white py-2 px-4 rounded-lg hover:bg-gray-600 transition-colors"
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
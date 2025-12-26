import { useState, useEffect } from 'react';
import { userManagementService, PendingUser, ApprovedUser } from '../services/userManagementService';
import { 
  CheckCircle, 
  XCircle, 
  Clock, 
  Shield, 
  Mail, 
  Phone, 
  Building,
  FileText,
  User,
  AlertCircle,
  Search,
  Filter,
  UserCheck,
  Users
} from 'lucide-react';
import { format } from 'date-fns';

export function UserApprovalManager() {
  const [pendingUsers, setPendingUsers] = useState<PendingUser[]>([]);
  const [approvedUsers, setApprovedUsers] = useState<ApprovedUser[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeView, setActiveView] = useState<'pending' | 'approved'>('pending');
  const [searchQuery, setSearchQuery] = useState('');
  const [filterRole, setFilterRole] = useState<string>('all');
  const [selectedUser, setSelectedUser] = useState<PendingUser | ApprovedUser | null>(null);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [rejectionReason, setRejectionReason] = useState('');

  useEffect(() => {
    loadUsers();
  }, []);

  const loadUsers = async () => {
    setLoading(true);
    try {
      const pending = await userManagementService.getPendingRequests();
      const approved = await userManagementService.getAllApprovedUsers();
      setPendingUsers(pending);
      setApprovedUsers(approved);
    } catch (error) {
      console.error('Failed to load users:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (userId: string) => {
    if (!confirm('Are you sure you want to approve this registration?')) {
      return;
    }

    try {
      await userManagementService.approveRegistration(userId);
      alert('User approved successfully!');
      await loadUsers();
    } catch (error: any) {
      alert(`Failed to approve user: ${error.message}`);
    }
  };

  const handleReject = async (userId: string) => {
    const reason = prompt('Enter rejection reason:');
    if (!reason) return;

    try {
      await userManagementService.rejectRegistration(userId, reason);
      alert('Registration rejected.');
      await loadUsers();
    } catch (error: any) {
      alert(`Failed to reject user: ${error.message}`);
    }
  };

  const handleToggleActive = async (userId: string, currentStatus: boolean) => {
    const action = currentStatus ? 'deactivate' : 'activate';
    if (!confirm(`Are you sure you want to ${action} this user?`)) {
      return;
    }

    try {
      await userManagementService.updateUserStatus(userId, !currentStatus);
      alert(`User ${action}d successfully!`);
      await loadUsers();
    } catch (error: any) {
      alert(`Failed to ${action} user: ${error.message}`);
    }
  };

  const getRoleBadgeColor = (role: string) => {
    const colors: Record<string, string> = {
      super_admin: 'bg-red-100 text-red-800',
      consultant: 'bg-purple-100 text-purple-800',
      senior_registrar: 'bg-blue-100 text-blue-800',
      junior_registrar: 'bg-green-100 text-green-800',
      medical_officer: 'bg-yellow-100 text-yellow-800',
      house_officer: 'bg-gray-100 text-gray-800'
    };
    return colors[role] || 'bg-gray-100 text-gray-800';
  };

  const getStatusBadge = (status: string) => {
    const badges: Record<string, { color: string; icon: JSX.Element }> = {
      pending: { color: 'bg-yellow-100 text-yellow-800', icon: <Clock className="h-4 w-4" /> },
      approved: { color: 'bg-green-100 text-green-800', icon: <CheckCircle className="h-4 w-4" /> },
      rejected: { color: 'bg-red-100 text-red-800', icon: <XCircle className="h-4 w-4" /> }
    };
    const badge = badges[status] || badges.pending;
    return (
      <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${badge.color}`}>
        {badge.icon}
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </span>
    );
  };

  const filteredPending = pendingUsers.filter(user => {
    const matchesSearch = 
      (user.full_name || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (user.email || '').toLowerCase().includes(searchQuery.toLowerCase());
    const matchesRole = filterRole === 'all' || user.role === filterRole;
    return matchesSearch && matchesRole;
  });

  const filteredApproved = approvedUsers.filter(user => {
    const matchesSearch = 
      (user.full_name || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (user.email || '').toLowerCase().includes(searchQuery.toLowerCase());
    const matchesRole = filterRole === 'all' || user.role === filterRole;
    return matchesSearch && matchesRole;
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-clinical-dark">User Management</h2>
          <p className="text-sm text-clinical mt-1">Manage user registrations and approvals</p>
        </div>
        <div className="flex items-center gap-4">
          <div className="bg-blue-50 px-4 py-2 rounded-lg">
            <div className="text-sm text-blue-600 font-medium">Pending Requests</div>
            <div className="text-2xl font-bold text-blue-900">{pendingUsers.length}</div>
          </div>
          <div className="bg-green-50 px-4 py-2 rounded-lg">
            <div className="text-sm text-green-600 font-medium">Active Users</div>
            <div className="text-2xl font-bold text-green-900">{approvedUsers.filter(u => u.is_active).length}</div>
          </div>
        </div>
      </div>

      {/* View Toggle */}
      <div className="flex items-center gap-2 border-b">
        <button
          onClick={() => setActiveView('pending')}
          className={`px-4 py-2 font-medium transition ${
            activeView === 'pending'
              ? 'text-primary-600 border-b-2 border-primary-600'
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4" />
            Pending Approvals ({pendingUsers.filter(u => u.status === 'pending').length})
          </div>
        </button>
        <button
          onClick={() => setActiveView('approved')}
          className={`px-4 py-2 font-medium transition ${
            activeView === 'approved'
              ? 'text-primary-600 border-b-2 border-primary-600'
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          <div className="flex items-center gap-2">
            <Users className="h-4 w-4" />
            All Users ({approvedUsers.length})
          </div>
        </button>
      </div>

      {/* Filters */}
      <div className="flex gap-4">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
          <input
            type="text"
            placeholder="Search by name or email..."
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        <div className="relative">
          <Filter className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
          <select
            id="roleFilter"
            aria-label="Filter by role"
            className="pl-10 pr-8 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 appearance-none bg-white"
            value={filterRole}
            onChange={(e) => setFilterRole(e.target.value)}
          >
            <option value="all">All Roles</option>
            <option value="consultant">Consultant</option>
            <option value="senior_registrar">Senior Registrar</option>
            <option value="junior_registrar">Junior Registrar</option>
            <option value="medical_officer">Medical Officer</option>
            <option value="house_officer">House Officer</option>
          </select>
        </div>
      </div>

      {/* Pending Requests Table */}
      {activeView === 'pending' && (
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">User</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Role</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Contact</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Department</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Requested</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredPending.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-8 text-center text-gray-500">
                    <Clock className="h-12 w-12 mx-auto text-gray-300 mb-2" />
                    <p>No pending registration requests</p>
                  </td>
                </tr>
              ) : (
                filteredPending.map((user) => (
                  <tr key={user.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-full bg-primary-100 flex items-center justify-center">
                          <User className="h-5 w-5 text-primary-600" />
                        </div>
                        <div>
                          <div className="font-medium text-clinical-dark">{user.full_name}</div>
                          <div className="text-sm text-gray-500">{user.email}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${getRoleBadgeColor(user.role)}`}>
                        {user.role.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600">
                      {user.phone && (
                        <div className="flex items-center gap-1">
                          <Phone className="h-4 w-4" />
                          {user.phone}
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600">
                      {user.department && (
                        <div className="flex items-center gap-1">
                          <Building className="h-4 w-4" />
                          {user.department}
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600">
                      {format(new Date(user.requested_at), 'MMM dd, yyyy')}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleApprove(user.id!)}
                          className="p-2 text-green-600 hover:bg-green-50 rounded-md transition"
                          title="Approve"
                        >
                          <CheckCircle className="h-5 w-5" />
                        </button>
                        <button
                          onClick={() => handleReject(user.id!)}
                          className="p-2 text-red-600 hover:bg-red-50 rounded-md transition"
                          title="Reject"
                        >
                          <XCircle className="h-5 w-5" />
                        </button>
                        <button
                          onClick={() => {
                            setSelectedUser(user);
                            setShowDetailsModal(true);
                          }}
                          className="p-2 text-blue-600 hover:bg-blue-50 rounded-md transition"
                          title="View Details"
                        >
                          <FileText className="h-5 w-5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Approved Users Table */}
      {activeView === 'approved' && (
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">User</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Role</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Last Login</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Approved</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredApproved.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-8 text-center text-gray-500">
                    <Users className="h-12 w-12 mx-auto text-gray-300 mb-2" />
                    <p>No approved users found</p>
                  </td>
                </tr>
              ) : (
                filteredApproved.map((user) => (
                  <tr key={user.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-full bg-primary-100 flex items-center justify-center">
                          <User className="h-5 w-5 text-primary-600" />
                        </div>
                        <div>
                          <div className="font-medium text-clinical-dark">{user.full_name}</div>
                          <div className="text-sm text-gray-500">{user.email}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${getRoleBadgeColor(user.role)}`}>
                        {user.role.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${
                        user.is_active ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                      }`}>
                        {user.is_active ? <CheckCircle className="h-3 w-3" /> : <XCircle className="h-3 w-3" />}
                        {user.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600">
                      {user.last_login ? format(new Date(user.last_login), 'MMM dd, yyyy HH:mm') : 'Never'}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600">
                      {user.created_at ? format(new Date(user.created_at), 'MMM dd, yyyy') : '-'}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleToggleActive(user.id!, user.is_active)}
                          className={`p-2 rounded-md transition ${
                            user.is_active 
                              ? 'text-orange-600 hover:bg-orange-50' 
                              : 'text-green-600 hover:bg-green-50'
                          }`}
                          title={user.is_active ? 'Deactivate' : 'Activate'}
                        >
                          {user.is_active ? <XCircle className="h-5 w-5" /> : <CheckCircle className="h-5 w-5" />}
                        </button>
                        <button
                          onClick={() => {
                            setSelectedUser(user);
                            setShowDetailsModal(true);
                          }}
                          className="p-2 text-blue-600 hover:bg-blue-50 rounded-md transition"
                          title="View Details"
                        >
                          <FileText className="h-5 w-5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* User Details Modal */}
      {showDetailsModal && selectedUser && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b px-6 py-4 flex items-center justify-between">
              <h3 className="text-xl font-bold text-clinical-dark">User Details</h3>
              <button
                onClick={() => setShowDetailsModal(false)}
                className="text-gray-400 hover:text-gray-600"
                aria-label="Close details modal"
              >
                <XCircle className="h-6 w-6" />
              </button>
            </div>

            <div className="p-6 space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-gray-500">Full Name</label>
                  <p className="text-clinical-dark font-medium">{selecteduser.full_name}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-500">Email</label>
                  <p className="text-clinical-dark">{selectedUser.email}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-500">Role</label>
                  <p className="text-clinical-dark">
                    {selectedUser.role.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}
                  </p>
                </div>
                {'phone' in selectedUser && selectedUser.phone && (
                  <div>
                    <label className="text-sm font-medium text-gray-500">Phone</label>
                    <p className="text-clinical-dark">{selectedUser.phone}</p>
                  </div>
                )}
                {'department' in selectedUser && selectedUser.department && (
                  <div>
                    <label className="text-sm font-medium text-gray-500">Department</label>
                    <p className="text-clinical-dark">{selectedUser.department}</p>
                  </div>
                )}
                {'registration_number' in selectedUser && selectedUser.registration_number && (
                  <div>
                    <label className="text-sm font-medium text-gray-500">Registration Number</label>
                    <p className="text-clinical-dark">{selectedUser.registration_number}</p>
                  </div>
                )}
                {'privileges' in selectedUser && (
                  <div className="col-span-2">
                    <label className="text-sm font-medium text-gray-500">Privileges</label>
                    <div className="flex flex-wrap gap-2 mt-2">
                      {selectedUser.privileges.map((priv, idx) => (
                        <span key={idx} className="px-2 py-1 bg-blue-50 text-blue-700 text-xs rounded">
                          {priv.replace('_', ' ')}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <div className="flex justify-end">
                <button
                  onClick={() => setShowDetailsModal(false)}
                  className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}


import { apiClient } from './apiClient';

export interface PendingUser {
  id: string;
  full_name: string;
  email: string;
  role: 'admin' | 'consultant' | 'senior_registrar' | 'junior_registrar' | 'house_officer';
  phone?: string;
  department?: string;
  specialization?: string;
  license_number?: string;
  created_at: string;
  is_approved: boolean;
  is_active: boolean;
}

export interface ApprovedUser {
  id: string;
  full_name: string;
  email: string;
  role: 'admin' | 'consultant' | 'senior_registrar' | 'junior_registrar' | 'house_officer';
  phone?: string;
  department?: string;
  specialization?: string;
  license_number?: string;
  created_at: string;
  updated_at?: string;
  is_approved: boolean;
  is_active: boolean;
}

export interface BulkImportUser {
  fullName: string;
  email: string;
  role?: string;
  department?: string;
}

export interface BulkImportResult {
  message: string;
  success: Array<{
    id: number;
    username: string;
    email: string;
    fullName: string;
    role: string;
  }>;
  failed: Array<{
    email: string;
    fullName: string;
    error: string;
  }>;
  credentials: Array<{
    fullName: string;
    email: string;
    username: string;
    tempPassword: string;
    role: string;
    mustChangePassword: boolean;
  }>;
}

class UserManagementService {
  async getPendingRequests(): Promise<PendingUser[]> {
    try {
      const users = await apiClient.getUsers();
      if (!Array.isArray(users)) {
        console.warn('getUsers did not return an array:', users);
        return [];
      }
      return users.filter((user: PendingUser) => !user.is_approved);
    } catch (error) {
      console.error('Error fetching pending requests:', error);
      throw error;
    }
  }

  async getAllApprovedUsers(): Promise<ApprovedUser[]> {
    try {
      const users = await apiClient.getUsers();
      if (!Array.isArray(users)) {
        console.warn('getUsers did not return an array:', users);
        return [];
      }
      return users.filter((user: ApprovedUser) => user.is_approved);
    } catch (error) {
      console.error('Error fetching approved users:', error);
      throw error;
    }
  }

  async approveRegistration(userId: string): Promise<void> {
    try {
      await apiClient.approveUser(userId, true);
    } catch (error) {
      console.error('Error approving user:', error);
      throw error;
    }
  }

  async rejectRegistration(userId: string, reason: string): Promise<void> {
    try {
      await apiClient.approveUser(userId, false);
    } catch (error) {
      console.error('Error rejecting user:', error);
      throw error;
    }
  }

  async updateUserStatus(userId: string, isActive: boolean): Promise<void> {
    try {
      await apiClient.updateUserStatus(userId, isActive);
    } catch (error) {
      console.error('Error updating user status:', error);
      throw error;
    }
  }

  async submitRegistrationRequest(userData: {
    name: string;
    email: string;
    password: string;
    role: string;
    phone?: string;
    department?: string;
    registration_number?: string;
  }): Promise<void> {
    try {
      await apiClient.register({
        full_name: userData.name,
        email: userData.email,
        password: userData.password,
        role: userData.role as any,
        phone: userData.phone,
        department: userData.department,
        license_number: userData.registration_number
      });
    } catch (error) {
      console.error('Error submitting registration request:', error);
      throw error;
    }
  }

  // Bulk import users with auto-generated credentials
  async bulkImportUsers(users: BulkImportUser[]): Promise<BulkImportResult> {
    try {
      const response = await apiClient.bulkImportUsers(users);
      // API returns { message, results } - extract results
      return response.results || response;
    } catch (error) {
      console.error('Error bulk importing users:', error);
      throw error;
    }
  }

  // Force password change after first login
  async forcePasswordChange(userId: string, currentPassword: string, newPassword: string): Promise<void> {
    try {
      await apiClient.forcePasswordChange(userId, currentPassword, newPassword);
    } catch (error) {
      console.error('Error changing password:', error);
      throw error;
    }
  }

  // Change user password
  async changePassword(userId: string, currentPassword: string, newPassword: string): Promise<void> {
    try {
      await apiClient.changePassword(userId, currentPassword, newPassword);
    } catch (error) {
      console.error('Error changing password:', error);
      throw error;
    }
  }

  // Parse CSV content for bulk import
  parseCSV(csvContent: string): BulkImportUser[] {
    const lines = csvContent.trim().split('\n');
    if (lines.length < 2) {
      throw new Error('CSV must contain a header row and at least one data row');
    }

    const headers = lines[0].toLowerCase().split(',').map(h => h.trim());
    const requiredHeaders = ['fullname', 'email'];
    const missingHeaders = requiredHeaders.filter(h => !headers.includes(h) && !headers.includes(h.replace('fullname', 'full_name')));
    
    if (missingHeaders.length > 0) {
      throw new Error(`Missing required columns: ${missingHeaders.join(', ')}`);
    }

    const fullNameIndex = headers.findIndex(h => h === 'fullname' || h === 'full_name' || h === 'name');
    const emailIndex = headers.findIndex(h => h === 'email');
    const roleIndex = headers.findIndex(h => h === 'role');
    const departmentIndex = headers.findIndex(h => h === 'department');

    const users: BulkImportUser[] = [];

    for (let i = 1; i < lines.length; i++) {
      const values = lines[i].split(',').map(v => v.trim().replace(/^["']|["']$/g, ''));
      
      if (values.length < 2 || !values[fullNameIndex] || !values[emailIndex]) {
        continue; // Skip empty or invalid rows
      }

      users.push({
        fullName: values[fullNameIndex],
        email: values[emailIndex],
        role: roleIndex >= 0 ? values[roleIndex] : 'house_officer',
        department: departmentIndex >= 0 ? values[departmentIndex] : ''
      });
    }

    return users;
  }

  // Generate downloadable credentials file
  generateCredentialsCSV(credentials: BulkImportResult['credentials']): string {
    const header = 'Full Name,Email,Username,Temporary Password,Role,Must Change Password\n';
    const rows = credentials.map(cred => 
      `"${cred.fullName}","${cred.email}","${cred.username}","${cred.tempPassword}","${cred.role}","${cred.mustChangePassword ? 'Yes' : 'No'}"`
    ).join('\n');
    return header + rows;
  }

  // Download credentials as CSV file
  downloadCredentials(credentials: BulkImportResult['credentials'], filename: string = 'user_credentials.csv'): void {
    const csvContent = this.generateCredentialsCSV(credentials);
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', filename);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }
}

export const userManagementService = new UserManagementService();

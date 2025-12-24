import { db } from '../db/database';
import { apiClient } from './apiClient';

// Helper for authenticated fetch requests
const authenticatedFetch = async (url: string, options: RequestInit = {}): Promise<Response> => {
  const token = apiClient.getToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
    ...(options.headers as Record<string, string> || {})
  };
  
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  
  return fetch(url, {
    ...options,
    headers,
    credentials: 'include'
  });
};

export interface PatientTeamAssignment {
  id?: string;
  patient_id: string;
  patient_name: string;
  hospital_number: string;
  consultant_id?: string;
  consultant_name?: string;
  registrar_id?: string;
  registrar_name?: string;
  house_officer_id?: string;
  house_officer_name?: string;
  assigned_at: Date;
  updated_at: Date;
  is_active: boolean;
  assignment_method: 'automatic' | 'manual';
}

export interface TeamMember {
  id: string;
  name: string;
  email: string;
  role: 'consultant' | 'registrar' | 'house_officer';
  is_active: boolean;
  current_patient_count: number;
  max_patient_capacity: number;
  specialization?: string;
}

class PatientAssignmentService {
  /**
   * Get all available team members
   */
  async getAvailableTeamMembers(): Promise<{
    consultants: TeamMember[];
    registrars: TeamMember[];
    houseOfficers: TeamMember[];
  }> {
    try {
      const response = await authenticatedFetch('/api/team/members');

      if (!response.ok) throw new Error('Failed to fetch team members');

      const data = await response.json();
      return {
        consultants: data.filter((m: TeamMember) => m.role === 'consultant'),
        registrars: data.filter((m: TeamMember) => m.role === 'registrar'),
        houseOfficers: data.filter((m: TeamMember) => m.role === 'house_officer')
      };
    } catch (error) {
      console.error('Error fetching team members:', error);
      return { consultants: [], registrars: [], houseOfficers: [] };
    }
  }

  /**
   * Automatically assign a patient to a team
   * Uses round-robin and load balancing
   */
  async autoAssignPatient(
    patientId: string,
    patientName: string,
    hospitalNumber: string,
    admissionType?: 'elective' | 'emergency',
    specialization?: string
  ): Promise<PatientTeamAssignment | null> {
    try {
      const members = await this.getAvailableTeamMembers();

      // Filter by specialization if provided
      let consultants = members.consultants.filter(c => c.is_active);
      let registrars = members.registrars.filter(r => r.is_active);
      let houseOfficers = members.houseOfficers.filter(h => h.is_active);

      if (specialization) {
        consultants = consultants.filter(c => 
          c.specialization?.toLowerCase().includes(specialization.toLowerCase())
        );
      }

      // Priority assignment for emergency cases
      if (admissionType === 'emergency') {
        // Assign to consultant with lowest patient count
        consultants.sort((a, b) => a.current_patient_count - b.current_patient_count);
      }

      // Select team members with lowest patient count (load balancing)
      const selectedConsultant = consultants.sort((a, b) => 
        a.current_patient_count - b.current_patient_count
      )[0];

      const selectedRegistrar = registrars.sort((a, b) => 
        a.current_patient_count - b.current_patient_count
      )[0];

      const selectedHouseOfficer = houseOfficers.sort((a, b) => 
        a.current_patient_count - b.current_patient_count
      )[0];

      if (!selectedConsultant || !selectedRegistrar || !selectedHouseOfficer) {
        throw new Error('Not enough team members available for assignment');
      }

      const assignment: Omit<PatientTeamAssignment, 'id'> = {
        patient_id: patientId,
        patient_name: patientName,
        hospital_number: hospitalNumber,
        consultant_id: selectedConsultant.id,
        consultant_name: selectedConsultant.name,
        registrar_id: selectedRegistrar.id,
        registrar_name: selectedRegistrar.name,
        house_officer_id: selectedHouseOfficer.id,
        house_officer_name: selectedHouseOfficer.name,
        assigned_at: new Date(),
        updated_at: new Date(),
        is_active: true,
        assignment_method: 'automatic'
      };

      // Save to backend
      const response = await authenticatedFetch('/api/team/assignments', {
        method: 'POST',
        body: JSON.stringify(assignment)
      });

      if (!response.ok) throw new Error('Failed to create team assignment');

      return await response.json();
    } catch (error) {
      console.error('Error auto-assigning patient:', error);
      return null;
    }
  }

  /**
   * Manually assign a patient to specific team members
   */
  async manualAssignPatient(
    patientId: string,
    patientName: string,
    hospitalNumber: string,
    consultantId: string,
    registrarId: string,
    houseOfficerId: string
  ): Promise<PatientTeamAssignment | null> {
    try {
      // Get team member names
      const members = await this.getAvailableTeamMembers();
      const consultant = [...members.consultants].find(c => c.id === consultantId);
      const registrar = [...members.registrars].find(r => r.id === registrarId);
      const houseOfficer = [...members.houseOfficers].find(h => h.id === houseOfficerId);

      if (!consultant || !registrar || !houseOfficer) {
        throw new Error('One or more selected team members not found');
      }

      const assignment: Omit<PatientTeamAssignment, 'id'> = {
        patient_id: patientId,
        patient_name: patientName,
        hospital_number: hospitalNumber,
        consultant_id: consultantId,
        consultant_name: consultant.name,
        registrar_id: registrarId,
        registrar_name: registrar.name,
        house_officer_id: houseOfficerId,
        house_officer_name: houseOfficer.name,
        assigned_at: new Date(),
        updated_at: new Date(),
        is_active: true,
        assignment_method: 'manual'
      };

      const response = await authenticatedFetch('/api/team/assignments', {
        method: 'POST',
        body: JSON.stringify(assignment)
      });

      if (!response.ok) throw new Error('Failed to create team assignment');

      return await response.json();
    } catch (error) {
      console.error('Error manually assigning patient:', error);
      return null;
    }
  }

  /**
   * Get team assignment for a specific patient
   */
  async getPatientAssignment(patientId: string): Promise<PatientTeamAssignment | null> {
    try {
      const response = await authenticatedFetch(`/api/team/assignments/patient/${patientId}`);

      if (!response.ok) {
        if (response.status === 404) return null;
        throw new Error('Failed to fetch patient assignment');
      }

      return await response.json();
    } catch (error) {
      console.error('Error fetching patient assignment:', error);
      return null;
    }
  }

  /**
   * Get all assignments for a team member
   */
  async getTeamMemberAssignments(
    userId: string,
    role: 'consultant' | 'registrar' | 'house_officer'
  ): Promise<PatientTeamAssignment[]> {
    try {
      const response = await authenticatedFetch(`/api/team/assignments/user/${userId}?role=${role}`);

      if (!response.ok) throw new Error('Failed to fetch team member assignments');

      return await response.json();
    } catch (error) {
      console.error('Error fetching team member assignments:', error);
      return [];
    }
  }

  /**
   * Get all active assignments
   */
  async getAllAssignments(activeOnly: boolean = true): Promise<PatientTeamAssignment[]> {
    try {
      const response = await authenticatedFetch(`/api/team/assignments?activeOnly=${activeOnly}`);

      if (!response.ok) throw new Error('Failed to fetch assignments');

      return await response.json();
    } catch (error) {
      console.error('Error fetching assignments:', error);
      return [];
    }
  }

  /**
   * Update team assignment
   */
  async updateAssignment(
    assignmentId: string,
    updates: Partial<PatientTeamAssignment>
  ): Promise<boolean> {
    try {
      const response = await authenticatedFetch(`/api/team/assignments/${assignmentId}`, {
        method: 'PUT',
        body: JSON.stringify({
          ...updates,
          updated_at: new Date()
        })
      });

      return response.ok;
    } catch (error) {
      console.error('Error updating assignment:', error);
      return false;
    }
  }

  /**
   * Reassign a specific team member role
   */
  async reassignTeamMember(
    assignmentId: string,
    role: 'consultant' | 'registrar' | 'house_officer',
    newMemberId: string,
    newMemberName: string
  ): Promise<boolean> {
    try {
      const updates: Partial<PatientTeamAssignment> = {
        updated_at: new Date(),
        assignment_method: 'manual'
      };

      if (role === 'consultant') {
        updates.consultant_id = newMemberId;
        updates.consultant_name = newMemberName;
      } else if (role === 'registrar') {
        updates.registrar_id = newMemberId;
        updates.registrar_name = newMemberName;
      } else {
        updates.house_officer_id = newMemberId;
        updates.house_officer_name = newMemberName;
      }

      return await this.updateAssignment(assignmentId, updates);
    } catch (error) {
      console.error('Error reassigning team member:', error);
      return false;
    }
  }

  /**
   * Deactivate assignment (when patient is discharged)
   */
  async deactivateAssignment(assignmentId: string): Promise<boolean> {
    try {
      return await this.updateAssignment(assignmentId, {
        is_active: false,
        updated_at: new Date()
      });
    } catch (error) {
      console.error('Error deactivating assignment:', error);
      return false;
    }
  }

  /**
   * Get assignment statistics
   */
  async getAssignmentStatistics(): Promise<{
    total_active_assignments: number;
    assignments_by_consultant: Record<string, number>;
    assignments_by_registrar: Record<string, number>;
    assignments_by_house_officer: Record<string, number>;
    automatic_assignments: number;
    manual_assignments: number;
    average_patient_load: {
      consultants: number;
      registrars: number;
      houseOfficers: number;
    };
  }> {
    try {
      const response = await authenticatedFetch('/api/team/assignments/statistics');

      if (!response.ok) throw new Error('Failed to fetch assignment statistics');

      return await response.json();
    } catch (error) {
      console.error('Error fetching assignment statistics:', error);
      return {
        total_active_assignments: 0,
        assignments_by_consultant: {},
        assignments_by_registrar: {},
        assignments_by_house_officer: {},
        automatic_assignments: 0,
        manual_assignments: 0,
        average_patient_load: {
          consultants: 0,
          registrars: 0,
          houseOfficers: 0
        }
      };
    }
  }

  /**
   * Bulk auto-assign patients (for initial setup or batch processing)
   */
  async bulkAutoAssignPatients(patientIds: string[]): Promise<{
    successful: number;
    failed: number;
    assignments: PatientTeamAssignment[];
  }> {
    const assignments: PatientTeamAssignment[] = [];
    let successful = 0;
    let failed = 0;

    for (const patientId of patientIds) {
      try {
        // Get patient info
        const patient = await db.patients.get(patientId);
        if (!patient) {
          failed++;
          continue;
        }

        const assignment = await this.autoAssignPatient(
          patientId,
          `${patient.first_name} ${patient.last_name}`,
          patient.hospital_number
        );

        if (assignment) {
          assignments.push(assignment);
          successful++;
        } else {
          failed++;
        }
      } catch (error) {
        console.error(`Error assigning patient ${patientId}:`, error);
        failed++;
      }
    }

    return { successful, failed, assignments };
  }
}

export const patientAssignmentService = new PatientAssignmentService();

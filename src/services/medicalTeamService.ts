import { db } from '../db/database';

export interface MedicalTeamAssignment {
  id?: number;
  patient_id: number;
  hospital_number: string;
  consultant_id?: number;
  senior_registrar_id?: number;
  registrar_id?: number;
  house_officer_id?: number;
  nurse_ids?: number[]; // Can have multiple nurses
  admission_type?: string;
  assigned_at: Date;
  is_active: boolean;
}

export interface TeamMember {
  id: number;
  name: string;
  full_name?: string;
  email: string;
  role: string;
  phone?: string;
  roleLabel: string;
  color: string;
  priority: number;
  current_patients?: number;
}

export interface StaffByRole {
  id: number;
  full_name: string;
  email: string;
  role: string;
  current_patients: number;
}

export interface SuggestedTeam {
  senior_registrar: StaffByRole | null;
  registrar: StaffByRole | null;
  house_officer: StaffByRole | null;
}

export interface TeamWorkload {
  consultant: { staff: StaffByRole[]; totalPatients: number; avgPatients: number };
  senior_registrar: { staff: StaffByRole[]; totalPatients: number; avgPatients: number };
  registrar: { staff: StaffByRole[]; totalPatients: number; avgPatients: number };
  house_officer: { staff: StaffByRole[]; totalPatients: number; avgPatients: number };
}

class MedicalTeamService {
  private roleConfig = {
    consultant: { priority: 1, color: 'bg-green-600', label: 'Consultant' },
    senior_registrar: { priority: 2, color: 'bg-blue-600', label: 'Senior Registrar' },
    registrar: { priority: 3, color: 'bg-indigo-600', label: 'Registrar' },
    house_officer: { priority: 4, color: 'bg-purple-600', label: 'House Officer' },
    nurse: { priority: 5, color: 'bg-pink-600', label: 'Nurse' }
  };

  /**
   * Assign medical team to a specific patient
   */
  async assignTeamToPatient(patientId: number, hospitalNumber: string): Promise<void> {
    try {
      const users = await db.users.toArray();
      
      // Get one of each role for balanced distribution
      const consultant = users.find(u => u.role === 'consultant');
      const seniorRegistrar = users.find(u => u.role === 'senior_registrar');
      const registrar = users.find(u => u.role === 'registrar');
      const houseOfficer = users.find(u => u.role === 'house_officer');
      const nurses = users.filter(u => u.role === 'nurse').slice(0, 2); // Assign 2 nurses

      const assignment: MedicalTeamAssignment = {
        patient_id: patientId,
        hospital_number: hospitalNumber,
        consultant_id: consultant?.id,
        senior_registrar_id: seniorRegistrar?.id,
        registrar_id: registrar?.id,
        house_officer_id: houseOfficer?.id,
        nurse_ids: nurses.map(n => n.id),
        assigned_at: new Date(),
        is_active: true
      };

      await db.patient_assignments.add(assignment);
      console.log(`✅ Assigned medical team to patient ${hospitalNumber}`);
    } catch (error) {
      console.error('Error assigning medical team:', error);
      throw error;
    }
  }

  /**
   * Assign medical teams to all patients without assignments
   */
  async assignTeamsToAllPatients(): Promise<void> {
    try {
      // Get all patients
      const patients = await db.patients.toArray();
      
      // Get existing assignments
      const existingAssignments = await db.patient_assignments.toArray();
      const assignedPatientIds = new Set(existingAssignments.map(a => a.patient_id));
      
      // Filter patients without assignments
      const unassignedPatients = patients.filter(p => !assignedPatientIds.has(p.id!));
      
      if (unassignedPatients.length === 0) {
        console.log('✅ All patients already have medical team assignments');
        return;
      }

      console.log(`📋 Assigning medical teams to ${unassignedPatients.length} patients...`);
      
      // Get all medical staff
      const users = await db.users.toArray();
      const consultants = users.filter(u => u.role === 'consultant');
      const seniorRegistrars = users.filter(u => u.role === 'senior_registrar');
      const registrars = users.filter(u => u.role === 'registrar');
      const houseOfficers = users.filter(u => u.role === 'house_officer');
      const nurses = users.filter(u => u.role === 'nurse');

      // Round-robin assignment for load balancing
      let consultantIndex = 0;
      let seniorRegistrarIndex = 0;
      let registrarIndex = 0;
      let houseOfficerIndex = 0;
      let nurseIndex = 0;

      for (const patient of unassignedPatients) {
        const assignment: MedicalTeamAssignment = {
          patient_id: patient.id!,
          hospital_number: patient.hospital_number,
          consultant_id: consultants.length > 0 ? consultants[consultantIndex % consultants.length]?.id : undefined,
          senior_registrar_id: seniorRegistrars.length > 0 ? seniorRegistrars[seniorRegistrarIndex % seniorRegistrars.length]?.id : undefined,
          registrar_id: registrars.length > 0 ? registrars[registrarIndex % registrars.length]?.id : undefined,
          house_officer_id: houseOfficers.length > 0 ? houseOfficers[houseOfficerIndex % houseOfficers.length]?.id : undefined,
          nurse_ids: nurses.length > 0 ? [
            nurses[nurseIndex % nurses.length]?.id,
            nurses[(nurseIndex + 1) % nurses.length]?.id
          ].filter(Boolean) : [],
          assigned_at: new Date(),
          is_active: true
        };

        await db.patient_assignments.add(assignment);

        // Increment indices for round-robin
        consultantIndex++;
        seniorRegistrarIndex++;
        registrarIndex++;
        houseOfficerIndex++;
        nurseIndex += 2;
      }

      console.log(`✅ Successfully assigned medical teams to ${unassignedPatients.length} patients`);
    } catch (error) {
      console.error('Error assigning teams to all patients:', error);
      throw error;
    }
  }

  /**
   * Get assigned medical team for a specific patient
   */
  async getPatientMedicalTeam(patientId: number): Promise<TeamMember[]> {
    try {
      const assignment = await db.patient_assignments
        .where('patient_id')
        .equals(patientId)
        .and(a => a.is_active)
        .first();

      if (!assignment) {
        return [];
      }

      const teamMembers: TeamMember[] = [];
      const users = await db.users.toArray();

      // Add consultant
      if (assignment.consultant_id) {
        const consultant = users.find(u => u.id === assignment.consultant_id);
        if (consultant) {
          teamMembers.push({
            ...consultant,
            roleLabel: this.roleConfig.consultant.label,
            color: this.roleConfig.consultant.color,
            priority: this.roleConfig.consultant.priority
          });
        }
      }

      // Add senior registrar
      if (assignment.senior_registrar_id) {
        const seniorRegistrar = users.find(u => u.id === assignment.senior_registrar_id);
        if (seniorRegistrar) {
          teamMembers.push({
            ...seniorRegistrar,
            roleLabel: this.roleConfig.senior_registrar.label,
            color: this.roleConfig.senior_registrar.color,
            priority: this.roleConfig.senior_registrar.priority
          });
        }
      }

      // Add registrar
      if (assignment.registrar_id) {
        const registrar = users.find(u => u.id === assignment.registrar_id);
        if (registrar) {
          teamMembers.push({
            ...registrar,
            roleLabel: this.roleConfig.registrar.label,
            color: this.roleConfig.registrar.color,
            priority: this.roleConfig.registrar.priority
          });
        }
      }

      // Add house officer
      if (assignment.house_officer_id) {
        const houseOfficer = users.find(u => u.id === assignment.house_officer_id);
        if (houseOfficer) {
          teamMembers.push({
            ...houseOfficer,
            roleLabel: this.roleConfig.house_officer.label,
            color: this.roleConfig.house_officer.color,
            priority: this.roleConfig.house_officer.priority
          });
        }
      }

      // Add nurses
      if (assignment.nurse_ids && assignment.nurse_ids.length > 0) {
        for (const nurseId of assignment.nurse_ids) {
          const nurse = users.find(u => u.id === nurseId);
          if (nurse) {
            teamMembers.push({
              ...nurse,
              roleLabel: this.roleConfig.nurse.label,
              color: this.roleConfig.nurse.color,
              priority: this.roleConfig.nurse.priority
            });
          }
        }
      }

      // Sort by priority
      return teamMembers.sort((a, b) => a.priority - b.priority);
    } catch (error) {
      console.error('Error getting patient medical team:', error);
      return [];
    }
  }

  /**
   * Update team assignment for a patient
   */
  async updateTeamAssignment(
    patientId: number,
    updates: Partial<MedicalTeamAssignment>
  ): Promise<void> {
    try {
      const assignment = await db.patient_assignments
        .where('patient_id')
        .equals(patientId)
        .and(a => a.is_active)
        .first();

      if (assignment?.id) {
        await db.patient_assignments.update(assignment.id, updates);
        console.log(`✅ Updated team assignment for patient ${patientId}`);
      }
    } catch (error) {
      console.error('Error updating team assignment:', error);
      throw error;
    }
  }

  /**
   * Remove team assignment for a patient
   */
  async removeTeamAssignment(patientId: number): Promise<void> {
    try {
      const assignment = await db.patient_assignments
        .where('patient_id')
        .equals(patientId)
        .and(a => a.is_active)
        .first();

      if (assignment?.id) {
        await db.patient_assignments.update(assignment.id, { is_active: false });
        console.log(`✅ Removed team assignment for patient ${patientId}`);
      }
    } catch (error) {
      console.error('Error removing team assignment:', error);
      throw error;
    }
  }

  // ============= SERVER-BASED METHODS WITH LOAD BALANCING =============

  /**
   * Fetch staff by role from server with current workload
   */
  async getStaffByRole(role: string): Promise<StaffByRole[]> {
    try {
      const token = localStorage.getItem('auth_token');
      if (!token) {
        console.warn('No auth token, using local data');
        return this.getLocalStaffByRole(role);
      }

      const response = await fetch(`/api/medical-team/by-role?role=${role}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const data = await response.json();
        console.log(`✅ Fetched ${data.staff?.length || 0} ${role}s from server`);
        return data.staff || [];
      } else {
        console.warn('Server fetch failed, using local data');
        return this.getLocalStaffByRole(role);
      }
    } catch (error) {
      console.warn('Error fetching staff by role:', error);
      return this.getLocalStaffByRole(role);
    }
  }

  /**
   * Get local staff by role (fallback)
   */
  private async getLocalStaffByRole(role: string): Promise<StaffByRole[]> {
    const users = await db.users.toArray();
    const roleUsers = users.filter(u => u.role === role);
    
    // Get patient counts from local assignments
    const assignments = await db.patient_assignments.toArray();
    
    return roleUsers.map(user => {
      const roleColumn = {
        'senior_registrar': 'senior_registrar_id',
        'registrar': 'registrar_id',
        'house_officer': 'house_officer_id',
        'consultant': 'consultant_id'
      }[role] || '';
      
      const patientCount = assignments.filter(a => 
        a.is_active && (a as any)[roleColumn] === user.id
      ).length;

      return {
        id: user.id,
        full_name: user.full_name || user.name || 'Unknown',
        email: user.email || '',
        role: user.role,
        current_patients: patientCount
      };
    }).sort((a, b) => a.current_patients - b.current_patients);
  }

  /**
   * Get suggested team assignment (least loaded staff for each role)
   */
  async getSuggestedTeamAssignment(): Promise<SuggestedTeam> {
    try {
      const token = localStorage.getItem('auth_token');
      if (!token) {
        console.warn('No auth token, using local suggestion');
        return this.getLocalSuggestedTeam();
      }

      const response = await fetch('/api/medical-team/suggest-assignment', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const data = await response.json();
        console.log('✅ Got team suggestions from server:', data.suggestions);
        return data.suggestions;
      } else {
        console.warn('Server suggestion failed, using local');
        return this.getLocalSuggestedTeam();
      }
    } catch (error) {
      console.warn('Error getting team suggestions:', error);
      return this.getLocalSuggestedTeam();
    }
  }

  /**
   * Local fallback for team suggestions
   */
  private async getLocalSuggestedTeam(): Promise<SuggestedTeam> {
    const [seniorRegistrars, registrars, houseOfficers] = await Promise.all([
      this.getLocalStaffByRole('senior_registrar'),
      this.getLocalStaffByRole('registrar'),
      this.getLocalStaffByRole('house_officer')
    ]);

    return {
      senior_registrar: seniorRegistrars[0] || null,
      registrar: registrars[0] || null,
      house_officer: houseOfficers[0] || null
    };
  }

  /**
   * Get team workload statistics
   */
  async getTeamWorkload(): Promise<TeamWorkload | null> {
    try {
      const token = localStorage.getItem('auth_token');
      if (!token) return null;

      const response = await fetch('/api/medical-team/workload', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const data = await response.json();
        return data.workload;
      }
      return null;
    } catch (error) {
      console.warn('Error fetching team workload:', error);
      return null;
    }
  }

  /**
   * Log a team activity for analytics tracking
   */
  async logActivity(
    patientId: number,
    activityType: 'ward_round' | 'procedure' | 'prescription' | 'consultation' | 'documentation' | 'admission' | 'discharge',
    description: string,
    assignedStaffId?: number,
    notes?: string
  ): Promise<boolean> {
    try {
      const token = localStorage.getItem('auth_token');
      if (!token) {
        console.warn('No auth token, skipping activity log');
        return false;
      }

      const response = await fetch('/api/medical-team/log-activity', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          patient_id: patientId,
          activity_type: activityType,
          description,
          assigned_staff_id: assignedStaffId,
          notes
        })
      });

      if (response.ok) {
        console.log(`✅ Logged ${activityType} activity for patient ${patientId}`);
        return true;
      }
      return false;
    } catch (error) {
      console.warn('Error logging activity:', error);
      return false;
    }
  }

  /**
   * Get team analytics
   */
  async getTeamAnalytics(staffId?: number, period: number = 30): Promise<any> {
    try {
      const token = localStorage.getItem('auth_token');
      if (!token) return null;

      let url = `/api/medical-team/analytics?period=${period}`;
      if (staffId) url += `&staff_id=${staffId}`;

      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const data = await response.json();
        return data.analytics;
      }
      return null;
    } catch (error) {
      console.warn('Error fetching team analytics:', error);
      return null;
    }
  }

  /**
   * Create patient assignment with specific team members
   */
  async createAssignmentWithTeam(
    patientId: number,
    hospitalNumber: string,
    team: {
      senior_registrar_id?: number;
      registrar_id?: number;
      house_officer_id?: number;
    }
  ): Promise<void> {
    const assignment: MedicalTeamAssignment = {
      patient_id: patientId,
      hospital_number: hospitalNumber,
      senior_registrar_id: team.senior_registrar_id,
      registrar_id: team.registrar_id,
      house_officer_id: team.house_officer_id,
      assigned_at: new Date(),
      is_active: true
    };

    // Save locally first
    await db.patient_assignments.put(assignment);
    console.log(`✅ Created team assignment for patient ${hospitalNumber}`);

    // Log the admission activity
    await this.logActivity(
      patientId,
      'admission',
      `Patient ${hospitalNumber} admitted with team assignment`,
      undefined,
      `SR: ${team.senior_registrar_id}, Reg: ${team.registrar_id}, HO: ${team.house_officer_id}`
    );
  }
}

export const medicalTeamService = new MedicalTeamService();

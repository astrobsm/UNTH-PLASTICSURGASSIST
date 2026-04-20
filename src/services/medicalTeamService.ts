import { db } from '../db/database';
import { apiClient } from './apiClient';
import { syncService } from '../db/syncService';

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
      const activeUsers = users.filter(u => u.is_active !== false);
      
      // Get one of each role for balanced distribution (only active users)
      const consultant = activeUsers.find(u => u.role === 'consultant');
      const seniorRegistrar = activeUsers.find(u => u.role === 'senior_registrar');
      const registrar = activeUsers.find(u => u.role === 'registrar');
      const houseOfficer = activeUsers.find(u => u.role === 'house_officer');
      const nurses = activeUsers.filter(u => u.role === 'nurse').slice(0, 2); // Assign 2 nurses

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

      const localId = await db.patient_assignments.add(assignment);
      // Queue sync to server
      try {
        await syncService.queueAction('create', 'patient_assignments', localId as number, { ...assignment, id: localId });
      } catch (syncErr) {
        console.warn('Failed to queue patient_assignment sync:', syncErr);
      }
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
      
      // Get all active medical staff (exclude inactive users)
      const users = await db.users.toArray();
      const activeUsers = users.filter(u => u.is_active !== false);
      const consultants = activeUsers.filter(u => u.role === 'consultant');
      const seniorRegistrars = activeUsers.filter(u => u.role === 'senior_registrar');
      const registrars = activeUsers.filter(u => u.role === 'registrar');
      const houseOfficers = activeUsers.filter(u => u.role === 'house_officer');
      const nurses = activeUsers.filter(u => u.role === 'nurse');

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

        const localId = await db.patient_assignments.add(assignment);
        // Queue sync to server
        try {
          await syncService.queueAction('create', 'patient_assignments', localId as number, { ...assignment, id: localId });
        } catch (syncErr) {
          console.warn('Failed to queue patient_assignment sync:', syncErr);
        }

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
   * Get assigned medical team for a patient from the server API
   * This is the preferred method for cross-device sync
   */
  async getPatientMedicalTeamFromAPI(patientId: string | number): Promise<TeamMember[]> {
    try {
      const data = await apiClient.get(`/medical-team/patient?patient_id=${patientId}`);
      return data.team || [];
    } catch (error) {
      console.error('Error fetching medical team from API:', error);
      // Fall back to local IndexedDB
      return this.getPatientMedicalTeam(Number(patientId));
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
      const data = await apiClient.get(`/medical-team/by-role?role=${role}`);
      console.log(`✅ Fetched ${data.staff?.length || 0} ${role}s from server`);
      return data.staff || [];
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
    const roleUsers = users.filter(u => u.role === role && u.is_active !== false);
    
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
      const data = await apiClient.get('/medical-team/suggest-assignment');
      console.log('✅ Got team suggestions from server:', data.suggestions);
      return data.suggestions;
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
      const data = await apiClient.get('/medical-team/workload');
      return data.workload;
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
      await apiClient.post('/medical-team/log-activity', {
        patient_id: patientId,
        activity_type: activityType,
        description,
        assigned_staff_id: assignedStaffId,
        notes
      });
      console.log(`✅ Logged ${activityType} activity for patient ${patientId}`);
      return true;
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
      let url = `/medical-team/analytics?period=${period}`;
      if (staffId) url += `&staff_id=${staffId}`;

      const data = await apiClient.get(url);
      return data.analytics;
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

  /**
   * Auto-assign all admitted patients evenly to active house officers.
   * Creates assignments for patients that don't have one yet, and
   * fills in house_officer_id for existing assignments missing one.
   */
  async autoAssignAdmittedPatientsToHouseOfficers(): Promise<{ assigned: number; total: number }> {
    try {
      // Get active admissions from local DB
      let admissions: any[] = [];
      try {
        admissions = await db.admissions.filter(a => a.status === 'active').toArray();
      } catch { /* table may not exist */ }

      // Also get patients table for hospital_number
      const patients = await db.patients.toArray();
      const patientMap = new Map<number, any>();
      for (const p of patients) { if (p.id) patientMap.set(p.id, p); }

      // Get active house officers sorted by least loaded
      const houseOfficers = await this.getLocalStaffByRole('house_officer');
      if (houseOfficers.length === 0) {
        console.warn('No active house officers available for auto-assignment');
        return { assigned: 0, total: admissions.length };
      }

      // Get existing assignments
      const existingAssignments = await db.patient_assignments.toArray();
      const assignmentByPid = new Map<number, any>();
      for (const a of existingAssignments) {
        if (a.is_active) assignmentByPid.set(a.patient_id, a);
      }

      // Build current load counts per HO
      const hoLoad = new Map<number, number>();
      for (const ho of houseOfficers) hoLoad.set(ho.id, 0);
      for (const a of existingAssignments) {
        if (a.is_active && a.house_officer_id && hoLoad.has(a.house_officer_id)) {
          hoLoad.set(a.house_officer_id, (hoLoad.get(a.house_officer_id) || 0) + 1);
        }
      }

      let assignedCount = 0;
      const admittedPatientIds = new Set(admissions.map(a => Number(a.patient_id)));

      for (const adm of admissions) {
        const pid = Number(adm.patient_id);
        const existing = assignmentByPid.get(pid);

        if (existing && existing.house_officer_id) {
          // Already has HO assigned — skip
          continue;
        }

        // Pick least-loaded HO
        const leastLoaded = [...hoLoad.entries()].sort((a, b) => a[1] - b[1])[0];
        const hoId = leastLoaded[0];

        if (existing) {
          // Update existing assignment with HO
          await db.patient_assignments.update(existing.id, { house_officer_id: hoId });
        } else {
          // Create new assignment
          const patient = patientMap.get(pid);
          const hn = patient?.hospital_number || adm.hospital_number || '';
          await db.patient_assignments.add({
            patient_id: pid,
            hospital_number: hn,
            house_officer_id: hoId,
            assigned_at: new Date(),
            is_active: true
          });
        }

        hoLoad.set(hoId, (hoLoad.get(hoId) || 0) + 1);
        assignedCount++;
      }

      console.log(`✅ Auto-assigned ${assignedCount} admitted patients to house officers`);
      return { assigned: assignedCount, total: admissions.length };
    } catch (error) {
      console.error('Error auto-assigning house officers:', error);
      throw error;
    }
  }

  /**
   * Reassign ALL admitted patients' house officers evenly.
   * Called when a new HO is added or an HO is deactivated.
   * Clears all HO assignments and redistributes evenly.
   */
  async reassignAllHouseOfficers(): Promise<{ reassigned: number }> {
    try {
      // Get active admissions
      let admissions: any[] = [];
      try {
        admissions = await db.admissions.filter(a => a.status === 'active').toArray();
      } catch { /* */ }

      const admittedPids = new Set(admissions.map(a => Number(a.patient_id)));

      // Get active house officers
      const houseOfficers = await this.getLocalStaffByRole('house_officer');
      if (houseOfficers.length === 0) {
        console.warn('No active house officers for reassignment');
        return { reassigned: 0 };
      }

      // Get all active assignments for admitted patients
      const allAssignments = await db.patient_assignments.toArray();
      const admittedAssignments = allAssignments.filter(
        a => a.is_active && admittedPids.has(a.patient_id)
      );

      // Also handle admitted patients with no assignment at all
      const patients = await db.patients.toArray();
      const patientMap = new Map<number, any>();
      for (const p of patients) { if (p.id) patientMap.set(p.id, p); }
      const assignedPids = new Set(admittedAssignments.map(a => a.patient_id));
      const unassignedAdmittedPids = [...admittedPids].filter(pid => !assignedPids.has(pid));

      // Total patients to distribute
      const totalPatients = admittedAssignments.length + unassignedAdmittedPids.length;
      let hoIndex = 0;

      // Redistribute existing assignments
      for (const a of admittedAssignments) {
        const hoId = houseOfficers[hoIndex % houseOfficers.length].id;
        await db.patient_assignments.update(a.id!, { house_officer_id: hoId });
        hoIndex++;
      }

      // Create assignments for unassigned admitted patients
      for (const pid of unassignedAdmittedPids) {
        const hoId = houseOfficers[hoIndex % houseOfficers.length].id;
        const patient = patientMap.get(pid);
        const adm = admissions.find(a => Number(a.patient_id) === pid);
        await db.patient_assignments.add({
          patient_id: pid,
          hospital_number: patient?.hospital_number || adm?.hospital_number || '',
          house_officer_id: hoId,
          assigned_at: new Date(),
          is_active: true
        });
        hoIndex++;
      }

      console.log(`✅ Reassigned ${totalPatients} admitted patients evenly across ${houseOfficers.length} house officers`);
      return { reassigned: totalPatients };
    } catch (error) {
      console.error('Error reassigning house officers:', error);
      throw error;
    }
  }

  /**
   * Push all local patient_assignments to the server (for initial sync / catch-up)
   */
  async pushAssignmentsToServer(): Promise<{ pushed: number; errors: number }> {
    const result = { pushed: 0, errors: 0 };
    try {
      const assignments = await db.patient_assignments.toArray();
      if (assignments.length === 0) return result;

      for (const assignment of assignments) {
        try {
          const payload = {
            patient_id: String(assignment.patient_id),
            hospital_number: assignment.hospital_number || '',
            consultant_id: assignment.consultant_id ? String(assignment.consultant_id) : null,
            senior_registrar_id: assignment.senior_registrar_id ? String(assignment.senior_registrar_id) : null,
            registrar_id: assignment.registrar_id ? String(assignment.registrar_id) : null,
            house_officer_id: assignment.house_officer_id ? String(assignment.house_officer_id) : null,
            admission_type: assignment.admission_type || null,
            is_active: assignment.is_active !== false,
            assigned_at: assignment.assigned_at ? new Date(assignment.assigned_at).toISOString() : new Date().toISOString(),
          };

          await apiClient.request('/sync/push', {
            method: 'POST',
            body: JSON.stringify({
              changes: [{
                entityType: 'patient_assignments',
                entityId: assignment.id,
                action: 'create',
                payload
              }]
            })
          });
          result.pushed++;
        } catch (err) {
          result.errors++;
        }
      }
      console.log(`📤 Pushed ${result.pushed} patient_assignments to server (${result.errors} errors)`);
    } catch (error) {
      console.error('Error pushing assignments to server:', error);
    }
    return result;
  }
}

export const medicalTeamService = new MedicalTeamService();

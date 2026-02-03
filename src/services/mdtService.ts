import { db } from '../db/database';
import { format } from 'date-fns';

// API Base URL - handles all environments
const API_BASE_URL = (import.meta as any).env?.VITE_API_BASE_URL 
  || ((import.meta as any).env?.PROD 
    ? '/api'  // Production fallback: use relative path
    : 'http://localhost:3001/api');  // Development: direct to backend

// Get auth headers from localStorage
function getAuthHeaders(): HeadersInit {
  const token = localStorage.getItem('auth_token');
  return {
    'Content-Type': 'application/json',
    ...(token ? { 'Authorization': `Bearer ${token}` } : {})
  };
}

// Helper to sync MDT data to server
async function syncToServer(endpoint: string, method: string, data?: any): Promise<any> {
  try {
    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      method,
      headers: getAuthHeaders(),
      body: data ? JSON.stringify(data) : undefined
    });
    if (!response.ok) {
      console.warn(`MDT sync failed: ${response.status}`);
      return null;
    }
    return await response.json();
  } catch (error) {
    console.warn('MDT sync error (will retry later):', error);
    return null;
  }
}

export interface MDTSpecialty {
  id: string;
  specialty_name: string;
  unit_name: string;
  consultant_name: string;
  contact_phone: string;
  contact_email: string;
  ward_location?: string;
  notes?: string;
}

export interface MDTPatientTeam {
  id: string;
  patient_id: string;
  patient_name: string;
  hospital_number: string;
  primary_specialty: string; // Plastic Surgery
  is_active: boolean;
  specialties: MDTSpecialty[];
  created_at: Date;
  updated_at: Date;
}

export interface MDTMeeting {
  id: string;
  patient_id: string;
  patient_name: string;
  hospital_number: string;
  meeting_title: string;
  meeting_date: Date;
  meeting_time: string;
  location: string;
  meeting_type: 'routine' | 'urgent' | 'emergency';
  status: 'scheduled' | 'completed' | 'cancelled' | 'rescheduled';
  agenda: string;
  attending_specialties: Array<{
    specialty_id: string;
    specialty_name: string;
    consultant_name: string;
    attendance_status: 'invited' | 'confirmed' | 'declined' | 'attended';
  }>;
  discussion_points?: string;
  decisions_made?: string;
  action_items?: Array<{
    id: string;
    action: string;
    assigned_to: string;
    specialty: string;
    due_date: Date;
    status: 'pending' | 'in_progress' | 'completed';
    completed_at?: Date;
  }>;
  next_meeting_date?: Date;
  created_by: string;
  created_at: Date;
  updated_at: Date;
}

export interface MDTContactLog {
  id: string;
  patient_id: string;
  patient_name: string;
  hospital_number: string;
  specialty_id: string;
  specialty_name: string;
  contact_type: 'phone' | 'email' | 'in_person' | 'referral';
  contact_date: Date;
  contact_time: string;
  contacted_person: string;
  reason: string;
  discussion_summary: string;
  outcome: string;
  follow_up_required: boolean;
  follow_up_date?: Date;
  created_by: string;
  created_at: Date;
}

class MDTService {
  // Create or update MDT team for a patient
  async createPatientTeam(patientId: string, patientName: string, hospitalNumber: string): Promise<MDTPatientTeam> {
    const team: MDTPatientTeam = {
      id: `mdt_team_${Date.now()}`,
      patient_id: patientId,
      patient_name: patientName,
      hospital_number: hospitalNumber,
      primary_specialty: 'Plastic Surgery',
      is_active: true,
      specialties: [],
      created_at: new Date(),
      updated_at: new Date()
    };

    // Save locally first
    await db.mdt_patient_teams.add(team as any);
    
    // Sync to server (async, don't block)
    syncToServer('/mdt/patient-teams', 'POST', {
      patient_id: patientId,
      patient_name: patientName,
      hospital_number: hospitalNumber,
      primary_specialty: 'Plastic Surgery',
      specialties: []
    }).then(serverTeam => {
      if (serverTeam?.id) {
        // Update local record with server ID
        db.mdt_patient_teams.update(team.id, { server_id: serverTeam.id });
      }
    });
    
    return team;
  }

  // Add specialty to patient's MDT team
  async addSpecialtyToTeam(teamId: string, specialty: Omit<MDTSpecialty, 'id'>): Promise<void> {
    const team = await db.mdt_patient_teams.get(teamId);
    if (team) {
      const newSpecialty: MDTSpecialty = {
        ...specialty,
        id: `specialty_${Date.now()}`
      };

      const specialties = [...(team.specialties || []), newSpecialty];
      await db.mdt_patient_teams.update(teamId, {
        specialties,
        updated_at: new Date()
      });
    }
  }

  // Remove specialty from patient's MDT team
  async removeSpecialtyFromTeam(teamId: string, specialtyId: string): Promise<void> {
    const team = await db.mdt_patient_teams.get(teamId);
    if (team) {
      const specialties = (team.specialties || []).filter((s: any) => s.id !== specialtyId);
      await db.mdt_patient_teams.update(teamId, {
        specialties,
        updated_at: new Date()
      });
    }
  }

  // Update specialty contact information
  async updateSpecialtyContact(teamId: string, specialtyId: string, updates: Partial<MDTSpecialty>): Promise<void> {
    const team = await db.mdt_patient_teams.get(teamId);
    if (team && team.specialties) {
      const specialtyIndex = team.specialties.findIndex((s: any) => s.id === specialtyId);
      if (specialtyIndex !== -1) {
        team.specialties[specialtyIndex] = {
          ...team.specialties[specialtyIndex],
          ...updates
        };
        await db.mdt_patient_teams.update(teamId, {
          specialties: team.specialties,
          updated_at: new Date()
        });
      }
    }
  }

  // Get patient's MDT team
  async getPatientTeam(patientId: string): Promise<MDTPatientTeam | undefined> {
    const teams = await db.mdt_patient_teams
      .where('patient_id')
      .equals(patientId)
      .and(t => t.is_active)
      .toArray();
    return teams[0];
  }

  // Get all active MDT patients
  async getAllActiveMDTPatients(): Promise<MDTPatientTeam[]> {
    const allTeams = await db.mdt_patient_teams.toArray();
    return allTeams.filter(team => team.is_active === true);
  }

  // Schedule MDT meeting
  async scheduleMeeting(meetingData: Omit<MDTMeeting, 'id' | 'created_at' | 'updated_at'>): Promise<string> {
    const meeting: MDTMeeting = {
      ...meetingData,
      id: `mdt_meeting_${Date.now()}`,
      created_at: new Date(),
      updated_at: new Date()
    };

    await db.mdt_meetings.add(meeting as any);
    return meeting.id;
  }

  // Update meeting status
  async updateMeetingStatus(meetingId: string, status: MDTMeeting['status']): Promise<void> {
    await db.mdt_meetings.update(meetingId, {
      status,
      updated_at: new Date()
    });
  }

  // Add meeting minutes
  async addMeetingMinutes(
    meetingId: string, 
    discussionPoints: string, 
    decisionsMade: string, 
    actionItems: MDTMeeting['action_items']
  ): Promise<void> {
    await db.mdt_meetings.update(meetingId, {
      discussion_points: discussionPoints,
      decisions_made: decisionsMade,
      action_items: actionItems,
      status: 'completed',
      updated_at: new Date()
    });
  }

  // Update attendance status
  async updateAttendanceStatus(
    meetingId: string, 
    specialtyId: string, 
    attendanceStatus: 'invited' | 'confirmed' | 'declined' | 'attended'
  ): Promise<void> {
    const meeting = await db.mdt_meetings.get(meetingId);
    if (meeting && meeting.attending_specialties) {
      const specialtyIndex = meeting.attending_specialties.findIndex(s => s.specialty_id === specialtyId);
      if (specialtyIndex !== -1) {
        meeting.attending_specialties[specialtyIndex].attendance_status = attendanceStatus;
        await db.mdt_meetings.update(meetingId, {
          attending_specialties: meeting.attending_specialties,
          updated_at: new Date()
        });
      }
    }
  }

  // Get patient's MDT meetings
  async getPatientMeetings(patientId: string): Promise<MDTMeeting[]> {
    return await db.mdt_meetings
      .where('patient_id')
      .equals(patientId)
      .reverse()
      .sortBy('meeting_date');
  }

  // Get upcoming meetings
  async getUpcomingMeetings(): Promise<MDTMeeting[]> {
    const now = new Date();
    const allMeetings = await db.mdt_meetings.toArray();
    
    return allMeetings
      .filter(m => m.status === 'scheduled' && new Date(m.meeting_date) >= now)
      .sort((a, b) => new Date(a.meeting_date).getTime() - new Date(b.meeting_date).getTime());
  }

  // Log contact with specialty
  async logContact(contactData: Omit<MDTContactLog, 'id' | 'created_at'>): Promise<string> {
    const contact: MDTContactLog = {
      ...contactData,
      id: `mdt_contact_${Date.now()}`,
      created_at: new Date()
    };

    await db.mdt_contact_logs.add(contact as any);
    return contact.id;
  }

  // Get contact history for patient
  async getPatientContactHistory(patientId: string): Promise<MDTContactLog[]> {
    return await db.mdt_contact_logs
      .where('patient_id')
      .equals(patientId)
      .reverse()
      .sortBy('contact_date');
  }

  // Get contact history by specialty
  async getSpecialtyContactHistory(patientId: string, specialtyId: string): Promise<MDTContactLog[]> {
    const contacts = await db.mdt_contact_logs
      .where('patient_id')
      .equals(patientId)
      .toArray();
    
    return contacts
      .filter(c => c.specialty_id === specialtyId)
      .sort((a, b) => new Date(b.contact_date).getTime() - new Date(a.contact_date).getTime());
  }

  // Get all contacts requiring follow-up
  async getContactsRequiringFollowUp(): Promise<MDTContactLog[]> {
    const allContacts = await db.mdt_contact_logs.toArray();
    
    return allContacts.filter(c => {
      if (!c.follow_up_required) return false;
      if (c.follow_up_date) {
        return new Date(c.follow_up_date) >= new Date();
      }
      return true;
    });
  }

  // Quick contact specialty (get contact info)
  async getQuickContactInfo(teamId: string, specialtyId: string): Promise<MDTSpecialty | undefined> {
    const team = await db.mdt_patient_teams.get(teamId);
    if (team && team.specialties) {
      return team.specialties.find((s: any) => s.id === specialtyId);
    }
    return undefined;
  }

  // Get statistics
  async getMDTStatistics(): Promise<{
    totalMDTPatients: number;
    upcomingMeetings: number;
    pendingFollowUps: number;
    activeSpecialties: Set<string>;
  }> {
    const [patients, upcomingMeetings, followUps] = await Promise.all([
      this.getAllActiveMDTPatients(),
      this.getUpcomingMeetings(),
      this.getContactsRequiringFollowUp()
    ]);

    const activeSpecialties = new Set<string>();
    patients.forEach(p => {
      p.specialties?.forEach((s: any) => activeSpecialties.add(s.specialty_name));
    });

    return {
      totalMDTPatients: patients.length,
      upcomingMeetings: upcomingMeetings.length,
      pendingFollowUps: followUps.length,
      activeSpecialties
    };
  }

  // Sync MDT data from server
  async syncFromServer(): Promise<void> {
    try {
      // Fetch all MDT data from server using sync/pull endpoint
      const headers = getAuthHeaders();
      const body = JSON.stringify({
        since: '2020-01-01',
        entities: ['mdt_patient_teams', 'mdt_meetings', 'mdt_contact_logs']
      });
      
      const pullRes = await fetch(`${API_BASE_URL}/sync/pull`, {
        method: 'POST',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body
      });

      if (pullRes.ok) {
        const data = await pullRes.json();
        const updates = data.updates || {};
        
        // Process MDT Patient Teams
        const teams = updates.mdt_patient_teams || [];
        if (Array.isArray(teams) && teams.length > 0) {
          for (const team of teams) {
            // Check if exists locally by patient_id
            const existing = await db.mdt_patient_teams
              .where('patient_id')
              .equals(team.patient_id?.toString())
              .first();
            
            if (existing) {
              await db.mdt_patient_teams.update(existing.id, {
                ...team,
                id: existing.id,
                server_id: team.id
              });
            } else {
              await db.mdt_patient_teams.put({
                ...team,
                id: team.id || `mdt_team_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                server_id: team.id
              });
            }
          }
          console.log(`✅ Synced ${teams.length} MDT patient teams from server`);
        }

        // Process MDT Meetings
        const meetings = updates.mdt_meetings || [];
        if (Array.isArray(meetings) && meetings.length > 0) {
          for (const meeting of meetings) {
            await db.mdt_meetings.put({
              ...meeting,
              id: meeting.id || `mdt_meeting_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
              server_id: meeting.id
            });
          }
          console.log(`✅ Synced ${meetings.length} MDT meetings from server`);
        }

        // Process MDT Contact Logs
        const contacts = updates.mdt_contact_logs || [];
        if (Array.isArray(contacts) && contacts.length > 0) {
          for (const contact of contacts) {
            await db.mdt_contact_logs.put({
              ...contact,
              id: contact.id || `mdt_contact_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
              server_id: contact.id
            });
          }
          console.log(`✅ Synced ${contacts.length} MDT contact logs from server`);
        }
      }
    } catch (error) {
      console.error('MDT sync from server error:', error);
    }
  }

  // Push all local MDT data to server
  async pushToServer(): Promise<void> {
    try {
      const headers = getAuthHeaders();
      
      // Get all local MDT data
      const [teams, meetings, contacts] = await Promise.all([
        db.mdt_patient_teams.toArray(),
        db.mdt_meetings.toArray(),
        db.mdt_contact_logs.toArray()
      ]);

      // Push to server via sync/push endpoint
      const changes: any[] = [];
      
      teams.forEach(team => {
        changes.push({
          entityType: 'mdt_patient_teams',
          entityId: team.id,
          action: 'upsert',
          payload: team
        });
      });
      
      meetings.forEach(meeting => {
        changes.push({
          entityType: 'mdt_meetings',
          entityId: meeting.id,
          action: 'upsert',
          payload: meeting
        });
      });
      
      contacts.forEach(contact => {
        changes.push({
          entityType: 'mdt_contact_logs',
          entityId: contact.id,
          action: 'upsert',
          payload: contact
        });
      });

      if (changes.length > 0) {
        const response = await fetch(`${API_BASE_URL}/sync/push`, {
          method: 'POST',
          headers: { ...headers, 'Content-Type': 'application/json' },
          body: JSON.stringify({ changes })
        });
        
        if (response.ok) {
          console.log(`✅ Pushed ${changes.length} MDT records to server`);
        } else {
          console.warn('MDT push failed:', await response.text());
        }
      }
    } catch (error) {
      console.error('MDT push to server error:', error);
    }
  }
}

export const mdtService = new MDTService();

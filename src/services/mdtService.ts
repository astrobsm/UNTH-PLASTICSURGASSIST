import { db } from '../db/database';
import { format } from 'date-fns';
import { apiClient } from './apiClient';

// Helper to sync MDT data to server
async function syncToServer(endpoint: string, method: string, data?: any): Promise<any> {
  try {
    if (method === 'GET') {
      return await apiClient.get(endpoint);
    } else if (method === 'POST') {
      return await apiClient.post(endpoint, data);
    } else if (method === 'PUT') {
      return await apiClient.put(endpoint, data);
    } else if (method === 'DELETE') {
      return await apiClient.delete(endpoint);
    }
    return null;
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

export interface MDTTeamReview {
  id: string;
  specialty_name: string;
  reviewer_name: string;
  review_date: Date;
  review_text: string;
  plan_text: string;
  scanned_via_ocr: boolean;
  created_at: Date;
}

export interface MDTWeeklyHarmonization {
  id: string;
  week_start: Date;
  week_end: Date;
  reviews_included: string[]; // review IDs
  harmonized_plan: string;
  created_at: Date;
  created_by: string;
}

export interface MDTPatientTeam {
  id: string;
  patient_id: string;
  patient_name: string;
  hospital_number: string;
  primary_specialty: string; // Plastic Surgery
  is_active: boolean;
  specialties: MDTSpecialty[];
  team_reviews?: MDTTeamReview[];
  weekly_harmonizations?: MDTWeeklyHarmonization[];
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
    
    // Immediately sync to server using the proper push method
    // This ensures cross-device sync happens right away
    setTimeout(async () => {
      try {
        await this.pushToServer();
        console.log('✅ MDT patient team synced to server immediately');
      } catch (error) {
        console.warn('MDT immediate sync failed, will retry on periodic sync:', error);
      }
    }, 500);
    
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

      // Push to server immediately so other devices see the specialty
      if (navigator.onLine) {
        try {
          await this.pushToServer();
          console.log('✅ MDT specialty synced to server immediately');
        } catch (error) {
          console.warn('MDT specialty sync failed, will retry on periodic sync:', error);
        }
      }
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

  // Get patient's MDT team (reads from local IndexedDB only - sync happens via Force Sync)
  async getPatientTeam(patientId: string): Promise<MDTPatientTeam | undefined> {
    const teams = await db.mdt_patient_teams
      .where('patient_id')
      .equals(patientId)
      .and(t => t.is_active)
      .toArray();
    return teams[0];
  }

  // Get all active MDT patients (reads from local IndexedDB only - sync happens via Force Sync)
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
    // Push to server immediately
    if (navigator.onLine) {
      try { await this.pushToServer(); } catch { /* will retry */ }
    }
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
    // Push to server immediately
    if (navigator.onLine) {
      try { await this.pushToServer(); } catch { /* will retry */ }
    }
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

  // Add team review (from OCR scan or manual entry)
  async addTeamReview(teamId: string, review: Omit<MDTTeamReview, 'id' | 'created_at'>): Promise<void> {
    const team = await db.mdt_patient_teams.get(teamId);
    if (team) {
      const newReview: MDTTeamReview = {
        ...review,
        id: `review_${Date.now()}`,
        created_at: new Date()
      };
      const reviews = [...(team.team_reviews || []), newReview];
      await db.mdt_patient_teams.update(teamId, {
        team_reviews: reviews,
        updated_at: new Date()
      });

      // Push to server
      if (navigator.onLine) {
        try { await this.pushToServer(); } catch { /* retry later */ }
      }
    }
  }

  // Harmonize weekly plans - collect all reviews from past week and generate summary
  async harmonizeWeeklyPlans(teamId: string, createdBy: string): Promise<MDTWeeklyHarmonization | null> {
    const team = await db.mdt_patient_teams.get(teamId);
    if (!team || !team.team_reviews || team.team_reviews.length === 0) return null;

    const now = new Date();
    const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    // Get reviews from the past week
    const weeklyReviews = team.team_reviews.filter((r: any) => 
      new Date(r.review_date) >= oneWeekAgo && new Date(r.review_date) <= now
    );

    if (weeklyReviews.length === 0) return null;

    // Group reviews by specialty
    const bySpecialty: Record<string, MDTTeamReview[]> = {};
    weeklyReviews.forEach((r: any) => {
      if (!bySpecialty[r.specialty_name]) bySpecialty[r.specialty_name] = [];
      bySpecialty[r.specialty_name].push(r);
    });

    // Build harmonized plan
    let harmonizedPlan = `WEEKLY MDT HARMONIZED PLAN\nPatient: ${team.patient_name} (${team.hospital_number})\nWeek: ${format(oneWeekAgo, 'dd/MM/yyyy')} - ${format(now, 'dd/MM/yyyy')}\n\n`;

    Object.entries(bySpecialty).forEach(([specialty, reviews]) => {
      harmonizedPlan += `--- ${specialty.toUpperCase()} ---\n`;
      reviews.forEach((r: any) => {
        harmonizedPlan += `Date: ${format(new Date(r.review_date), 'dd/MM/yyyy')}\n`;
        harmonizedPlan += `Reviewer: ${r.reviewer_name}\n`;
        harmonizedPlan += `Findings: ${r.review_text}\n`;
        if (r.plan_text) harmonizedPlan += `Plan: ${r.plan_text}\n`;
        harmonizedPlan += '\n';
      });
    });

    harmonizedPlan += `--- HARMONIZED SUMMARY ---\n`;
    harmonizedPlan += `Total specialties reporting: ${Object.keys(bySpecialty).length}\n`;
    harmonizedPlan += `Total reviews this week: ${weeklyReviews.length}\n`;
    harmonizedPlan += `Specialties involved: ${Object.keys(bySpecialty).join(', ')}\n\n`;

    // Combine all plans into a consolidated action plan
    harmonizedPlan += `CONSOLIDATED ACTION ITEMS:\n`;
    weeklyReviews.forEach((r: any, idx: number) => {
      if (r.plan_text) {
        harmonizedPlan += `${idx + 1}. [${r.specialty_name}] ${r.plan_text}\n`;
      }
    });

    const harmonization: MDTWeeklyHarmonization = {
      id: `harmonize_${Date.now()}`,
      week_start: oneWeekAgo,
      week_end: now,
      reviews_included: weeklyReviews.map((r: any) => r.id),
      harmonized_plan: harmonizedPlan,
      created_at: now,
      created_by: createdBy
    };

    const harmonizations = [...(team.weekly_harmonizations || []), harmonization];
    await db.mdt_patient_teams.update(teamId, {
      weekly_harmonizations: harmonizations,
      updated_at: new Date()
    });

    // Push to server
    if (navigator.onLine) {
      try { await this.pushToServer(); } catch { /* retry later */ }
    }

    return harmonization;
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
      const pullRes = await apiClient.post('/sync/pull', {
        since: '2020-01-01',
        entities: ['mdt_patient_teams', 'mdt_meetings', 'mdt_contact_logs']
      });

      if (pullRes) {
        const updates = pullRes.updates || {};
        
        // Process MDT Patient Teams
        const teams = updates.mdt_patient_teams || [];
        if (Array.isArray(teams) && teams.length > 0) {
          for (const team of teams) {
            try {
              // Normalize patient_id to string for consistency
              const normalizedTeam = {
                ...team,
                patient_id: String(team.patient_id),
                specialties: typeof team.specialties === 'string' 
                  ? JSON.parse(team.specialties) 
                  : (team.specialties || []),
                team_reviews: typeof team.team_reviews === 'string'
                  ? JSON.parse(team.team_reviews)
                  : (team.team_reviews || []),
                weekly_harmonizations: typeof team.weekly_harmonizations === 'string'
                  ? JSON.parse(team.weekly_harmonizations)
                  : (team.weekly_harmonizations || [])
              };
              
              // Use filter instead of where to avoid index issues
              const allTeams = await db.mdt_patient_teams.toArray();
              const existing = allTeams.find(t => 
                t.patient_id === normalizedTeam.patient_id || 
                String(t.patient_id) === normalizedTeam.patient_id ||
                t.server_id === team.id
              );
              
              if (existing) {
                // Merge specialties: union of local + server (don't overwrite locally-added specialties)
                const localSpecialties = Array.isArray(existing.specialties) ? existing.specialties : [];
                const serverSpecialties = Array.isArray(normalizedTeam.specialties) ? normalizedTeam.specialties : [];
                const mergedSpecialties = [...localSpecialties];
                for (const serverSpec of serverSpecialties) {
                  const alreadyExists = mergedSpecialties.some((ls: any) => 
                    ls.id === serverSpec.id || 
                    (ls.specialty_name === serverSpec.specialty_name && ls.consultant_name === serverSpec.consultant_name)
                  );
                  if (!alreadyExists) {
                    mergedSpecialties.push(serverSpec);
                  }
                }

                // Merge team_reviews: union of local + server by review id
                const localReviews = Array.isArray(existing.team_reviews) ? existing.team_reviews : [];
                const serverReviews = Array.isArray(normalizedTeam.team_reviews) ? normalizedTeam.team_reviews : [];
                const mergedReviews = [...localReviews];
                for (const serverReview of serverReviews) {
                  const alreadyExists = mergedReviews.some((lr: any) => lr.id === serverReview.id);
                  if (!alreadyExists) {
                    mergedReviews.push(serverReview);
                  }
                }

                // Merge weekly_harmonizations: union of local + server by harmonization id
                const localHarmonizations = Array.isArray(existing.weekly_harmonizations) ? existing.weekly_harmonizations : [];
                const serverHarmonizations = Array.isArray(normalizedTeam.weekly_harmonizations) ? normalizedTeam.weekly_harmonizations : [];
                const mergedHarmonizations = [...localHarmonizations];
                for (const serverHarm of serverHarmonizations) {
                  const alreadyExists = mergedHarmonizations.some((lh: any) => lh.id === serverHarm.id);
                  if (!alreadyExists) {
                    mergedHarmonizations.push(serverHarm);
                  }
                }

                await db.mdt_patient_teams.update(existing.id, {
                  ...normalizedTeam,
                  specialties: mergedSpecialties,
                  team_reviews: mergedReviews,
                  weekly_harmonizations: mergedHarmonizations,
                  id: existing.id,
                  server_id: team.id
                });
              } else {
                await db.mdt_patient_teams.put({
                  ...normalizedTeam,
                  id: `mdt_team_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                  server_id: team.id
                });
              }
            } catch (e) {
              console.warn('Error processing MDT team:', e);
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
      // Get all local MDT data
      const [teams, meetings, contacts] = await Promise.all([
        db.mdt_patient_teams.toArray(),
        db.mdt_meetings.toArray(),
        db.mdt_contact_logs.toArray()
      ]);

      console.log(`[MDT PUSH] Found ${teams.length} teams, ${meetings.length} meetings, ${contacts.length} contacts in IndexedDB`);
      
      // Log team details for debugging
      teams.forEach(team => {
        console.log(`[MDT PUSH] Team: patient_id=${team.patient_id}, name=${team.patient_name}, hospital=${team.hospital_number}`);
      });

      // Push to server via sync/push endpoint
      const changes: any[] = [];
      
      // Only push teams with valid patient_id (skip corrupt/orphaned records)
      teams.filter(team => team.patient_id != null).forEach(team => {
        changes.push({
          entityType: 'mdt_patient_teams',
          entityId: team.id,
          action: 'upsert',
          payload: team
        });
      });
      
      const skippedTeams = teams.length - changes.length;
      if (skippedTeams > 0) {
        console.warn(`[MDT PUSH] Skipped ${skippedTeams} teams with missing patient_id — deleting corrupt records`);
        // Clean up corrupt records from IndexedDB so they don't pollute every sync
        const corruptIds = teams.filter(t => t.patient_id == null).map(t => t.id).filter(Boolean);
        if (corruptIds.length > 0) {
          await db.mdt_patient_teams.bulkDelete(corruptIds as number[]);
          console.log(`[MDT PUSH] Deleted ${corruptIds.length} corrupt team records from IndexedDB`);
        }
      }
      
      meetings.filter(m => m.patient_id != null).forEach(meeting => {
        changes.push({
          entityType: 'mdt_meetings',
          entityId: meeting.id,
          action: 'upsert',
          payload: meeting
        });
      });
      
      contacts.filter(c => c.patient_id != null).forEach(contact => {
        changes.push({
          entityType: 'mdt_contact_logs',
          entityId: contact.id,
          action: 'upsert',
          payload: contact
        });
      });

      if (changes.length > 0) {
        console.log(`[MDT PUSH] Sending ${changes.length} changes to server...`);
        const responseData = await apiClient.post('/sync/push', { changes });
        console.log(`[MDT PUSH] Server response:`, responseData);
        
        console.log(`✅ Pushed ${changes.length} MDT records to server`);
        // Check for any errors in the results
        if (responseData.results) {
          const errors = responseData.results.filter((r: any) => r.status === 'error');
          if (errors.length > 0) {
            console.warn('[MDT PUSH] Some records failed:', errors);
          }
        }
        
        return responseData;
      } else {
        console.log('[MDT PUSH] No changes to push');
      }
    } catch (error) {
      console.error('[MDT PUSH] Error:', error);
      throw error;
    }
  }
}

export const mdtService = new MDTService();

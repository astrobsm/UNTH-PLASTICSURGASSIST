/**
 * Patient Service - Centralized patient data management
 * Handles both API calls (for sync) and IndexedDB (for offline)
 */

import { apiClient } from './apiClient';
import { db } from '../db/database';
import { syncService } from '../db/syncService';
import { pushNotificationService } from './pushNotificationService';

/**
 * Safely convert an array field to an array of strings.
 * Handles cases where items are objects (e.g., {condition, currentlyManaged}) instead of plain strings.
 */
function normalizeArrayField(value: any): string[] {
  if (!value) return [];
  const arr = Array.isArray(value) ? value : [value];
  return arr.map((item: any) => {
    if (typeof item === 'string') return item;
    if (typeof item === 'object' && item !== null) {
      // Handle {condition: "...", currentlyManaged: true/false} objects
      return item.condition || item.name || item.label || JSON.stringify(item);
    }
    return String(item);
  }).filter(Boolean);
}

/**
 * Normalize patient data to ensure arrays are always arrays and computed fields exist.
 * Handles all field name variants: snake_case, camelCase, and different naming conventions
 * between frontend (dob/sex), registration form (date_of_birth/sex), and server (date_of_birth/gender).
 */
function normalizePatientData(patient: any) {
  if (!patient) return patient;
  
  // Ensure full_name is always set
  const firstName = patient.first_name || patient.firstName || '';
  const lastName = patient.last_name || patient.lastName || '';
  const fullName = patient.full_name || patient.fullName || `${firstName} ${lastName}`.trim() || 'Unknown';
  
  // Normalize dob / date_of_birth - ensure both fields are populated
  // Check all possible field name variants
  const rawDob = patient.dob || patient.date_of_birth || patient.dateOfBirth || '';
  
  // If the dob is a Date object, convert to ISO date string (YYYY-MM-DD)
  const dob = rawDob instanceof Date 
    ? rawDob.toISOString().split('T')[0] 
    : (typeof rawDob === 'string' && rawDob.includes('T') ? rawDob.split('T')[0] : rawDob);

  // Normalize sex/gender - handle all variants and capitalize
  const rawSex = patient.sex || patient.gender || '';
  const sex = rawSex ? rawSex.charAt(0).toUpperCase() + rawSex.slice(1).toLowerCase() : '';
  
  // Normalize address
  const address = patient.address || '';

  return {
    ...patient,
    full_name: fullName,
    first_name: firstName,
    last_name: lastName,
    hospital_number: patient.hospital_number || patient.hospitalNumber || '',
    gender: sex,
    sex: sex,
    dob: dob,
    date_of_birth: dob, // Use the same normalized value for both
    address: address,
    phone: patient.phone || '',
    allergies: normalizeArrayField(patient.allergies),
    comorbidities: normalizeArrayField(patient.comorbidities || patient.chronic_conditions)
  };
}

/**
 * Merge two patient records, keeping the most complete data from each.
 * Non-empty values are preferred over empty/null/undefined values.
 * The 'primary' record takes priority when both have values.
 */
function mergePatientData(primary: any, secondary: any): any {
  if (!secondary) return primary;
  if (!primary) return secondary;
  
  const merged = { ...secondary, ...primary };
  
  // For each key in secondary, if primary's value is empty/null/undefined, use secondary's
  for (const key of Object.keys(secondary)) {
    const primaryVal = primary[key];
    const secondaryVal = secondary[key];
    
    // Skip non-data fields
    if (['synced', 'deleted', 'updated_at', 'created_at'].includes(key)) continue;
    
    // If primary value is empty/null/undefined, use secondary value
    if (primaryVal === null || primaryVal === undefined || primaryVal === '' || primaryVal === 'N/A') {
      if (secondaryVal !== null && secondaryVal !== undefined && secondaryVal !== '' && secondaryVal !== 'N/A') {
        merged[key] = secondaryVal;
      }
    }
  }
  
  return merged;
}

class PatientService {
  /**
   * Get all patients - fetches from API and updates local IndexedDB
   */
  async getAllPatients() {
    try {
      // Check if online first
      if (!navigator.onLine) {
        console.log('Offline mode - fetching from local IndexedDB');
        return this.getLocalPatients();
      }

      // Fetch from API (server source of truth)
      const patients = await apiClient.getPatients();
      
      // Ensure we have an array
      if (!Array.isArray(patients)) {
        console.warn('API returned non-array for patients:', patients);
        return this.getLocalPatients();
      }
      
      // Get all existing local patients for merge
      const allLocalPatients = await db.patients.toArray();
      const localPatientsMap = new Map<string, any>();
      for (const lp of allLocalPatients) {
        if (lp.id) localPatientsMap.set(String(lp.id), lp);
        if (lp.hospital_number) localPatientsMap.set(lp.hospital_number, lp);
      }

      // Merge server data with local data (keep best values from both)
      if (patients.length > 0) {
        const mergedPatients = patients.map((serverPatient: any) => {
          const localMatch = localPatientsMap.get(String(serverPatient.id)) 
            || localPatientsMap.get(serverPatient.hospital_number);
          
          if (localMatch) {
            // Merge: server is primary, but keep non-empty local fields
            return normalizePatientData(mergePatientData(
              { ...serverPatient, synced: true },
              localMatch
            ));
          }
          return normalizePatientData({ ...serverPatient, synced: true });
        });
        await db.patients.bulkPut(mergedPatients);
        console.log(`✅ Synced ${patients.length} patients from server (merged with local)`);
      }

      // Also include local-only patients (not yet synced to server)
      const localOnly = allLocalPatients.filter(p => 
        !p.deleted && !p.synced && 
        !patients.some((sp: any) => String(sp.id) === String(p.id) || sp.hospital_number === p.hospital_number)
      );
      
      const allNormalized = [
        ...patients.map((p: any) => {
          const localMatch = localPatientsMap.get(String(p.id)) || localPatientsMap.get(p.hospital_number);
          return normalizePatientData(localMatch ? mergePatientData({ ...p, synced: true }, localMatch) : p);
        }),
        ...localOnly.map(normalizePatientData)
      ];
      
      return allNormalized;
    } catch (error) {
      console.error('Error fetching patients from API:', error);
      
      // Fallback to IndexedDB if API fails
      return this.getLocalPatients();
    }
  }

  /**
   * Get patients from local IndexedDB
   */
  private async getLocalPatients() {
    console.log('📱 Fetching patients from local IndexedDB');
    const localPatients = await db.patients
      .filter(p => !p.deleted)
      .toArray();
    console.log(`Found ${localPatients.length} local patients`);
    return localPatients.map(normalizePatientData);
  }

  /**
   * Get patient by ID (for components needing quick ID lookup)
   */
  async getPatientById(id: string | number) {
    return this.getPatient(id);
  }

  /**
   * Search patients by name or hospital number
   */
  async searchPatients(searchTerm: string) {
    try {
      const allPatients = await this.getAllPatients();
      const term = searchTerm.toLowerCase().trim();
      
      if (!term) return allPatients;
      
      return allPatients.filter((patient: any) => {
        const fullName = (patient.full_name || `${patient.first_name || ''} ${patient.last_name || ''}`).toLowerCase();
        const hospitalNumber = (patient.hospital_number || '').toLowerCase();
        return fullName.includes(term) || hospitalNumber.includes(term);
      });
    } catch (error) {
      console.error('Error searching patients:', error);
      return [];
    }
  }

  /**
   * Get a single patient by ID
   * Merges data from API and local IndexedDB to ensure the most complete record
   */
  async getPatient(id: string | number) {
    // Always load local data first as baseline
    const lookupId = typeof id === 'string' 
      ? (id.includes('-') ? id : (parseInt(id, 10) || id)) 
      : Number(id);
    
    let localPatient: any = null;
    try {
      localPatient = await db.patients.get(lookupId);
      
      // Also try lookup by hospital_number if direct ID lookup fails
      if (!localPatient && typeof id === 'string') {
        const byHospitalNum = await db.patients
          .where('hospital_number')
          .equals(id)
          .first();
        if (byHospitalNum) localPatient = byHospitalNum;
      }
    } catch (dbErr) {
      console.warn('IndexedDB lookup failed:', dbErr);
    }

    // Try API if online
    let apiPatient: any = null;
    try {
      if (navigator.onLine) {
        apiPatient = await apiClient.getPatient(String(id));
      }
    } catch (error) {
      // Common when patient exists locally but not on server - silently fall through
      const errorMessage = error instanceof Error ? error.message : String(error);
      if (!errorMessage.includes('404') && !errorMessage.includes('not found') && !errorMessage.includes('500') && !errorMessage.includes('Internal server error')) {
        console.error('Error fetching patient from API:', errorMessage);
      }
    }

    // Merge: prefer local data for fields that might be missing from server
    let patient: any = null;
    if (apiPatient && localPatient) {
      // Merge: API is primary (latest from server), but keep local non-empty fields
      patient = mergePatientData(apiPatient, localPatient);
      patient.synced = true;
    } else if (apiPatient) {
      patient = { ...apiPatient, synced: true };
    } else if (localPatient) {
      patient = localPatient;
    }

    if (patient) {
      const normalized = normalizePatientData(patient);
      // Save merged data back to IndexedDB
      try {
        await db.patients.put(normalized);
      } catch (putErr) {
        console.warn('Failed to update local patient cache:', putErr);
      }
      console.log('📋 Loaded patient:', normalized.hospital_number, '| DOB:', normalized.dob, '| Sex:', normalized.sex);
      return normalized;
    }

    return null;
  }

  /**
   * Create a new patient
   */
  async createPatient(patientData: any) {
    try {
      // Save to API first
      const savedPatient = await apiClient.createPatient(patientData);
      
      // Update local cache
      if (savedPatient) {
        await db.patients.put({ ...savedPatient, synced: true });
        
        // Send notification to all users with voice announcement
        await pushNotificationService.notifyPatientRegistered(
          `${savedPatient.first_name} ${savedPatient.last_name}`,
          savedPatient.hospital_number
        );
      }
      
      return savedPatient;
    } catch (error) {
      console.error('Error creating patient via API:', error);
      
      // Save to IndexedDB only (will sync later)
      const localId = await db.patients.add({
        ...patientData,
        synced: false,
        created_at: new Date(),
        updated_at: new Date()
      });
      
      // Queue for sync when online
      await syncService.queueAction('create', 'patients', localId as number, patientData);
      
      // Send notification even for local-only save
      await pushNotificationService.notifyPatientRegistered(
        `${patientData.first_name} ${patientData.last_name}`,
        patientData.hospital_number
      );
      
      return { ...patientData, id: localId, synced: false };
    }
  }

  /**
   * Update an existing patient
   */
  async updatePatient(id: string | number, patientData: any) {
    try {
      // Normalize field names before sending (ensure server-compatible names)
      const normalizedData = {
        ...patientData,
        date_of_birth: patientData.date_of_birth || patientData.dob || patientData.dateOfBirth || '',
        gender: patientData.gender || patientData.sex || '',
      };
      
      // Update via API first
      const updatedPatient = await apiClient.updatePatient(String(id), normalizedData);
      
      // Update local cache
      if (updatedPatient) {
        await db.patients.put(normalizePatientData({ ...updatedPatient, synced: true }));
      }
      
      return updatedPatient;
    } catch (error) {
      console.error('Error updating patient via API:', error);
      
      // Update IndexedDB only (will sync later)
      const localId = typeof id === 'string' ? (id.includes('-') ? id : parseInt(id, 10)) : Number(id);
      const normalizedUpdate = normalizePatientData({
        ...patientData,
        date_of_birth: patientData.date_of_birth || patientData.dob || patientData.dateOfBirth || '',
        gender: patientData.gender || patientData.sex || '',
        synced: false,
        updated_at: new Date()
      });
      await db.patients.update(localId, normalizedUpdate);
      
      // Queue for sync when online
      await syncService.queueAction('update', 'patients', localId as number, normalizedUpdate);
      
      return { ...normalizedUpdate, id, synced: false };
    }
  }

  /**
   * Delete a patient (soft delete)
   */
  async deletePatient(id: string | number) {
    try {
      // Delete via API
      await apiClient.deletePatient(String(id));
      
      // Update local cache (soft delete)
      const localId = typeof id === 'string' ? id : Number(id);
      await db.patients.update(localId, { 
        deleted: true, 
        synced: true 
      });
      
      return true;
    } catch (error) {
      console.error('Error deleting patient via API:', error);
      
      // Mark as deleted locally (will sync later)
      const localId = typeof id === 'string' ? (id.includes('-') ? id : parseInt(id, 10)) : Number(id);
      await db.patients.update(localId, { 
        deleted: true, 
        synced: false 
      });
      
      // Queue for sync when online
      await syncService.queueAction('delete', 'patients', localId as number, {});
      
      return false;
    }
  }

  /**
   * Sync local changes to server
   */
  async syncLocalChanges() {
    try {
      // Find unsynced patients
      const unsyncedPatients = await db.patients
        .filter(p => !p.synced && !p.deleted)
        .toArray();
      
      console.log(`Found ${unsyncedPatients.length} unsynced patients. Queueing for sync...`);
      
      // Queue each patient for sync
      for (const patient of unsyncedPatients) {
        if (patient.id) {
          // Determine if it's a create or update based on whether it has a serverId
          const action = patient.serverId ? 'update' : 'create';
          await syncService.queueAction(action, 'patients', patient.id, patient);
        }
      }
      
      // Trigger sync immediately if online
      if (navigator.onLine) {
        await syncService.syncAll();
      }
      
      return true;
    } catch (error) {
      console.error('Error queueing local changes for sync:', error);
      return false;
    }
  }
}

export const patientService = new PatientService();
export default patientService;

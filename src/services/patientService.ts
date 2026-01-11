/**
 * Patient Service - Centralized patient data management
 * Handles both API calls (for sync) and IndexedDB (for offline)
 */

import { apiClient } from './apiClient';
import { db } from '../db/database';
import { syncService } from '../db/syncService';
import { pushNotificationService } from './pushNotificationService';

/**
 * Normalize patient data to ensure arrays are always arrays
 */
function normalizePatientData(patient: any) {
  if (!patient) return patient;
  
  return {
    ...patient,
    allergies: Array.isArray(patient.allergies) 
      ? patient.allergies 
      : (patient.allergies ? [patient.allergies] : []),
    comorbidities: Array.isArray(patient.comorbidities)
      ? patient.comorbidities
      : (patient.comorbidities ? [patient.comorbidities] : [])
  };
}

class PatientService {
  /**
   * Get all patients - fetches from API and updates local IndexedDB
   */
  async getAllPatients() {
    try {
      // Fetch from API (server source of truth)
      const patients = await apiClient.getPatients();
      
      // Update local IndexedDB for offline access
      if (patients && patients.length > 0) {
        const normalizedPatients = patients.map((p: any) => normalizePatientData({
          ...p,
          synced: true
        }));
        await db.patients.bulkPut(normalizedPatients);
      }
      
      return patients.map(normalizePatientData);
    } catch (error) {
      console.error('Error fetching patients from API:', error);
      
      // Fallback to IndexedDB if API fails (offline mode)
      console.log('Falling back to local IndexedDB');
      const localPatients = await db.patients
        .filter(p => !p.deleted)
        .toArray();
      
      return localPatients;
    }
  }

  /**
   * Get a single patient by ID
   */
  async getPatient(id: string | number) {
    try {
      // Try API first (only if online)
      if (navigator.onLine) {
        const patient = await apiClient.getPatient(String(id));
        
        // Update local cache
        if (patient) {
          const normalized = normalizePatientData({ ...patient, synced: true });
          await db.patients.put(normalized);
          return normalized;
        }
        
        return patient;
      }
    } catch (error) {
      // Only log if it's an unexpected error, not a 404/500 or network error
      // These are common when patient exists locally but not on server
      const errorMessage = error instanceof Error ? error.message : String(error);
      if (!errorMessage.includes('404') && !errorMessage.includes('not found') && !errorMessage.includes('500') && !errorMessage.includes('Internal server error')) {
        console.error('Error fetching patient from API:', errorMessage);
      }
    }
    
    // Fallback to IndexedDB
    // Handle both UUID strings and numeric IDs
    const lookupId = typeof id === 'string' 
      ? (id.includes('-') ? id : (parseInt(id, 10) || id)) 
      : Number(id);
    
    const localPatient = await db.patients.get(lookupId);
    
    return localPatient ? normalizePatientData(localPatient) : localPatient;
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
      await syncService.queueAction('create', 'patients', localId, patientData);
      
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
      // Update via API first
      const updatedPatient = await apiClient.updatePatient(String(id), patientData);
      
      // Update local cache
      if (updatedPatient) {
        await db.patients.put({ ...updatedPatient, synced: true });
      }
      
      return updatedPatient;
    } catch (error) {
      console.error('Error updating patient via API:', error);
      
      // Update IndexedDB only (will sync later)
      const localId = typeof id === 'string' ? (id.includes('-') ? id : parseInt(id, 10)) : Number(id);
      await db.patients.update(localId, { 
        ...patientData, 
        synced: false, 
        updated_at: new Date() 
      });
      
      // Queue for sync when online
      await syncService.queueAction('update', 'patients', localId as number, patientData);
      
      return { ...patientData, id, synced: false };
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

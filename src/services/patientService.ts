/**
 * Patient Service - Centralized patient data management
 * Handles both API calls (for sync) and IndexedDB (for offline)
 */

import { apiClient } from './apiClient';
import { db } from '../db/database';

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
      // Only log if it's an unexpected error, not a 404 or network error
      const errorMessage = error instanceof Error ? error.message : String(error);
      if (!errorMessage.includes('404') && !errorMessage.includes('not found')) {
        console.error('Error fetching patient from API:', errorMessage);
      }
    }
    
    // Fallback to IndexedDB
    const localPatient = await db.patients.get(
      typeof id === 'string' ? parseInt(id, 10) || id : Number(id)
    );
    
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
      await db.patients.update(
        typeof id === 'string' ? id : Number(id),
        { ...patientData, synced: false, updated_at: new Date() }
      );
      
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
      await db.patients.update(
        typeof id === 'string' ? id : Number(id),
        { deleted: true, synced: true }
      );
      
      return true;
    } catch (error) {
      console.error('Error deleting patient via API:', error);
      
      // Mark as deleted locally (will sync later)
      await db.patients.update(
        typeof id === 'string' ? id : Number(id),
        { deleted: true, synced: false }
      );
      
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
      
      console.log(`Syncing ${unsyncedPatients.length} local patients to server`);
      
      for (const patient of unsyncedPatients) {
        try {
          // Check if patient exists on server
          if (patient.id) {
            await apiClient.updatePatient(String(patient.id), patient);
          } else {
            await apiClient.createPatient(patient);
          }
          
          // Mark as synced
          await db.patients.update(patient.id!, { synced: true });
        } catch (error) {
          console.error(`Failed to sync patient ${patient.id}:`, error);
        }
      }
      
      return true;
    } catch (error) {
      console.error('Error syncing local changes:', error);
      return false;
    }
  }
}

export const patientService = new PatientService();
export default patientService;

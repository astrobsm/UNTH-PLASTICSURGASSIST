/**
 * Patient Service - Centralized patient data management
 * Handles both API calls (for sync) and IndexedDB (for offline)
 */

import { apiClient } from './apiClient';
import { db } from '../db/database';

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
        await db.patients.bulkPut(patients.map((p: any) => ({
          ...p,
          synced: true
        })));
      }
      
      return patients;
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
      // Try API first
      const patient = await apiClient.getPatient(String(id));
      
      // Update local cache
      if (patient) {
        await db.patients.put({ ...patient, synced: true });
      }
      
      return patient;
    } catch (error) {
      console.error('Error fetching patient from API:', error);
      
      // Fallback to IndexedDB
      const localPatient = await db.patients.get(
        typeof id === 'string' ? id : Number(id)
      );
      
      return localPatient;
    }
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

import { apiClient } from './apiClient';
import { patientService } from './patientService';

export interface ConferencePatient {
  id: string;
  hospital_number: string;
  full_name: string;
  first_name?: string;
  last_name?: string;
  date_of_birth: string;
  gender: string;
  blood_group: string;
  allergies: string;
  medical_history: string;
  primary_diagnosis: string;
  secondary_diagnoses: string[];
  ward: string;
  bed_number: string;
}

export interface Comorbidity {
  name: string;
  severity: string;
  notes: string;
}

export interface ClinicalPhotograph {
  id: string;
  url: string;
  caption: string;
  date: string;
  type: string;
}

export interface LabResult {
  id: number;
  test_type: string;
  test_name: string;
  results: any;
  status: string;
  ordered_at: string;
  completed_at: string;
  ordered_by_name?: string;
}

export interface Medication {
  id: number;
  medication_name: string;
  dosage: string;
  frequency: string;
  duration: string;
  route: string;
  instructions: string;
  status: string;
  prescribed_by_name?: string;
  prescribed_at: string;
  category?: string;
}

export interface AnaesthetistComment {
  id: number;
  comment: string;
  anaesthetist_name: string;
  asa_grade?: string;
  airway_assessment?: string;
  anesthesia_plan?: string;
  created_at: string;
}

export interface PlannedProcedure {
  id: number;
  procedure_name: string;
  procedure_type: string;
  scheduled_date: string;
  estimated_duration: number;
  surgeon_name?: string;
  anesthesia_type: string;
  operating_room: string;
  pre_op_notes: string;
  required_equipment: any[];
  status: string;
}

export interface ShoppingListStatus {
  patient_id: string;
  is_complete: boolean;
  total_items: number;
  procured_items: number;
  pending_items: number;
  items: Array<{
    name: string;
    quantity: number;
    status: string;
    category: string;
  }>;
}

export interface PreparingTeamMember {
  id: number;
  name: string;
  role: string;
  tasks_completed: string[];
  preparation_date: string;
}

export interface ConferenceData {
  patient: ConferencePatient;
  comorbidities: Comorbidity[];
  clinicalPhotographs: ClinicalPhotograph[];
  labResults: LabResult[];
  medications: Medication[];
  anaesthetistComments: AnaesthetistComment[];
  plannedProcedures: PlannedProcedure[];
  shoppingListStatus: ShoppingListStatus;
  preparingTeam: PreparingTeamMember[];
}

class PreSurgicalConferenceService {
  private baseUrl = '/pre-surgical-conference';

  async getConferenceData(patientId: string): Promise<ConferenceData> {
    try {
      const response = await apiClient.get(`${this.baseUrl}/${patientId}`);
      // Ensure all array fields are actually arrays (API may return null/undefined)
      return {
        patient: response.patient || {} as ConferencePatient,
        comorbidities: Array.isArray(response.comorbidities) ? response.comorbidities : [],
        clinicalPhotographs: Array.isArray(response.clinicalPhotographs) ? response.clinicalPhotographs : [],
        labResults: Array.isArray(response.labResults) ? response.labResults : [],
        medications: Array.isArray(response.medications) ? response.medications : [],
        anaesthetistComments: Array.isArray(response.anaesthetistComments) ? response.anaesthetistComments : [],
        plannedProcedures: Array.isArray(response.plannedProcedures) ? response.plannedProcedures : [],
        shoppingListStatus: response.shoppingListStatus || { patient_id: patientId, is_complete: false, total_items: 0, procured_items: 0, pending_items: 0, items: [] },
        preparingTeam: Array.isArray(response.preparingTeam) ? response.preparingTeam : [],
      };
    } catch (error) {
      console.error('Error fetching conference data:', error);
      throw error;
    }
  }

  async getScheduledPatients(): Promise<ConferencePatient[]> {
    try {
      const response = await apiClient.get(`${this.baseUrl}/scheduled-patients`);
      // API returns { patients: [...] } - extract the array
      const patients = Array.isArray(response) ? response : (response?.patients || []);
      return patients;
    } catch (error) {
      console.error('Error fetching scheduled patients:', error);
      // Fallback to getting all patients with scheduled surgeries from local DB
      try {
        const patients = await patientService.getAllPatients();
        return Array.isArray(patients) ? patients : [];
      } catch {
        return [];
      }
    }
  }

  async saveConferenceNotes(patientId: string, notes: {
    additional_comments: string;
    conference_decision: string;
    cleared_for_surgery: boolean;
  }): Promise<any> {
    try {
      const response = await apiClient.post(`${this.baseUrl}/${patientId}/notes`, notes);
      return response;
    } catch (error) {
      console.error('Error saving conference notes:', error);
      throw error;
    }
  }

  // Categorize medications by type
  categorizeMedications(medications: Medication[]): Record<string, Medication[]> {
    const categories: Record<string, Medication[]> = {};
    if (!Array.isArray(medications)) return categories;
    medications.forEach(med => {
      const category = med.category || this.inferMedicationCategory(med.medication_name);
      if (!categories[category]) categories[category] = [];
      categories[category].push(med);
    });
    return categories;
  }

  private inferMedicationCategory(name: string): string {
    const nameLC = name.toLowerCase();
    if (/amoxicillin|ceftriaxone|metronidazole|ciprofloxacin|augmentin|azithromycin|gentamicin|clindamycin|vancomycin/i.test(nameLC)) return 'Antibiotics';
    if (/paracetamol|ibuprofen|diclofenac|tramadol|morphine|pentazocine|ketorolac|codeine/i.test(nameLC)) return 'Analgesics';
    if (/amlodipine|lisinopril|losartan|atenolol|nifedipine|methyldopa|hydralazine/i.test(nameLC)) return 'Antihypertensives';
    if (/metformin|glibenclamide|insulin|glimepiride/i.test(nameLC)) return 'Antidiabetics';
    if (/heparin|enoxaparin|warfarin|rivaroxaban|clopidogrel|aspirin/i.test(nameLC)) return 'Anticoagulants/Antiplatelets';
    if (/omeprazole|ranitidine|pantoprazole|esomeprazole/i.test(nameLC)) return 'GI Medications';
    if (/diazepam|midazolam|propofol|ketamine|thiopentone/i.test(nameLC)) return 'Sedatives/Anaesthetic Agents';
    if (/dexamethasone|prednisolone|hydrocortisone/i.test(nameLC)) return 'Steroids';
    if (/salbutamol|aminophylline|ipratropium/i.test(nameLC)) return 'Respiratory';
    if (/iron|folic|vitamin|multivitamin|calcium/i.test(nameLC)) return 'Supplements';
    return 'Other';
  }

  // Categorize lab results by type
  categorizeLabResults(labResults: LabResult[]): Record<string, LabResult[]> {
    const categories: Record<string, LabResult[]> = {};
    if (!Array.isArray(labResults)) return categories;
    labResults.forEach(lab => {
      const category = lab.test_type || 'Other';
      if (!categories[category]) categories[category] = [];
      categories[category].push(lab);
    });
    // Sort within each category chronologically
    Object.keys(categories).forEach(key => {
      categories[key].sort((a, b) => new Date(a.ordered_at).getTime() - new Date(b.ordered_at).getTime());
    });
    return categories;
  }
}

export const preSurgicalConferenceService = new PreSurgicalConferenceService();

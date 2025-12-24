import { aiService } from './aiService';
import { db } from '../db/database';
import { apiClient } from './apiClient';
import { v4 as uuidv4 } from 'uuid';

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

// Enhanced Patient Management Interfaces for UNTH
export interface Ward {
  id: string;
  name: string;
  type: 'general' | 'surgical' | 'medical' | 'emergency' | 'icu' | 'private';
  capacity: number;
  currentOccupancy: number;
  supervisor: string;
}

export interface PatientRegistration {
  // Basic Demographics
  hospital_number: string;
  first_name: string;
  last_name: string;
  middle_name?: string;
  date_of_birth: string;
  sex: 'male' | 'female';
  marital_status: 'single' | 'married' | 'divorced' | 'widowed';
  
  // Contact Information
  phone: string;
  email?: string;
  address: string;
  state_of_origin: string;
  lga: string;
  nationality: string;
  
  // Emergency Contact
  next_of_kin: {
    name: string;
    relationship: string;
    phone: string;
    address: string;
  };
  
  // Medical Information
  blood_group?: 'A+' | 'A-' | 'B+' | 'B-' | 'O+' | 'O-' | 'AB+' | 'AB-';
  genotype?: 'AA' | 'AS' | 'SS' | 'AC' | 'SC';
  allergies: string[];
  medical_history: string[];
  surgical_history: string[];
  drug_history: string[];
  family_history: string[];
  social_history: {
    smoking: boolean;
    alcohol: boolean;
    occupation: string;
    other_habits?: string;
  };
  
  // Insurance/Financial
  insurance_type?: 'nhis' | 'private' | 'cash' | 'company';
  insurance_number?: string;
  
  // UNTH Specific
  ward_id?: string;
  bed_number?: string;
  // patient_type: outpatient or inpatient. For outpatients admission details may be omitted.
  patient_type?: 'outpatient' | 'inpatient';
  admission_type?: 'emergency' | 'clinic' | 'referral' | 'elective';
  referring_hospital?: string;
  consultant_in_charge: string;
  resident_in_charge?: string;
  
  // Timestamps
  registration_date: Date;
  admission_date?: Date;
}

export interface PatientTransfer {
  id: string;
  patient_id: string;
  from_ward: string;
  to_ward: string;
  from_bed?: string;
  to_bed?: string;
  transfer_type: 'ward_transfer' | 'emergency_admission' | 'clinic_admission' | 'inter_hospital';
  reason: string;
  authorized_by: string;
  completed_by?: string;
  transfer_date: Date;
  completion_date?: Date;
  status: 'pending' | 'in_progress' | 'completed' | 'cancelled';
  notes?: string;
  receiving_team?: string;
}

export interface PatientSummary {
  id: string;
  patient_id: string;
  summary_type: 'admission' | 'progress' | 'discharge' | 'consultation';
  generated_by: 'ai' | 'manual';
  content: string;
  key_points: string[];
  current_problems: string[];
  medications: string[];
  investigations_pending: string[];
  plan: string[];
  generated_at: Date;
  generated_by_user: string;
  ai_confidence?: number;
}

export interface DischargeDetails {
  id: string;
  patient_id: string;
  discharge_date: Date;
  discharge_type: 'home' | 'transfer' | 'absconded' | 'against_medical_advice' | 'death';
  discharge_destination?: string;
  final_diagnosis: string[];
  procedures_performed: string[];
  
  // Discharge Summary (AI Generated)
  discharge_summary: string;
  hospital_course: string;
  condition_on_discharge: string;
  
  // Discharge Instructions (AI Generated)
  medications_on_discharge: {
    name: string;
    dosage: string;
    frequency: string;
    duration: string;
    instructions: string;
  }[];
  
  follow_up_instructions: {
    clinic: string;
    date: string;
    doctor: string;
    instructions: string;
  }[];
  
  activity_restrictions: string[];
  warning_signs: string[];
  emergency_contacts: string[];
  
  // Administrative
  authorized_by: string;
  prepared_by: string;
  patient_counseled: boolean;
  relative_counseled: boolean;
  certificates_issued: string[];
}

export interface TreatmentProgress {
  id: string;
  patient_id: string;
  date: Date;
  recorded_by: string;
  
  // Vital Signs
  vital_signs: {
    temperature: number;
    pulse: number;
    blood_pressure: string;
    respiratory_rate: number;
    oxygen_saturation?: number;
    weight?: number;
  };
  
  // Clinical Assessment
  subjective: string; // Patient complaints
  objective: string; // Physical findings
  assessment: string; // Clinical impression
  plan: string; // Management plan
  
  // Nursing Notes
  input_output?: {
    fluid_intake: number;
    urine_output: number;
    other_output?: string;
  };
  
  wound_care?: {
    site: string;
    appearance: string;
    drainage: string;
    care_provided: string;
  }[];
  
  // Medications Given
  medications_administered: {
    name: string;
    dose: string;
    route: string;
    time: string;
    given_by: string;
  }[];
}

class UNTHPatientService {
  private wards: Ward[] = [
    { id: 'emergency_ward', name: 'Emergency Ward', type: 'emergency', capacity: 40, currentOccupancy: 15, supervisor: 'Ward Supervisor' },
    { id: 'ward_1', name: 'Ward 1', type: 'general', capacity: 30, currentOccupancy: 10, supervisor: 'Ward Supervisor' },
    { id: 'ward_2', name: 'Ward 2', type: 'general', capacity: 30, currentOccupancy: 10, supervisor: 'Ward Supervisor' },
    { id: 'ward_3', name: 'Ward 3', type: 'general', capacity: 30, currentOccupancy: 10, supervisor: 'Ward Supervisor' },
    { id: 'ward_4', name: 'Ward 4', type: 'general', capacity: 30, currentOccupancy: 10, supervisor: 'Ward Supervisor' },
    { id: 'ward_5', name: 'Ward 5', type: 'general', capacity: 30, currentOccupancy: 10, supervisor: 'Ward Supervisor' },
    { id: 'ward_6', name: 'Ward 6', type: 'general', capacity: 30, currentOccupancy: 10, supervisor: 'Ward Supervisor' },
    { id: 'ward_7', name: 'Ward 7', type: 'general', capacity: 30, currentOccupancy: 10, supervisor: 'Ward Supervisor' },
    { id: 'ward_8', name: 'Ward 8', type: 'general', capacity: 30, currentOccupancy: 10, supervisor: 'Ward Supervisor' },
    { id: 'ward_9', name: 'Ward 9', type: 'general', capacity: 30, currentOccupancy: 10, supervisor: 'Ward Supervisor' },
    { id: 'ward_10', name: 'Ward 10', type: 'general', capacity: 30, currentOccupancy: 10, supervisor: 'Ward Supervisor' },
    { id: 'eye_ward', name: 'Eye Ward', type: 'surgical', capacity: 20, currentOccupancy: 5, supervisor: 'Ward Supervisor' },
    { id: 'private_ward', name: 'Private Ward', type: 'private', capacity: 15, currentOccupancy: 2, supervisor: 'Ward Supervisor' },
    { id: 'male_medical_ward', name: 'Male Medical Ward', type: 'medical', capacity: 30, currentOccupancy: 20, supervisor: 'Ward Supervisor' },
    { id: 'female_medical_ward', name: 'Female Medical Ward', type: 'medical', capacity: 30, currentOccupancy: 18, supervisor: 'Ward Supervisor' },
    { id: 'oncology_ward', name: 'Oncology Ward', type: 'medical', capacity: 25, currentOccupancy: 10, supervisor: 'Ward Supervisor' },
    { id: 'male_medical_ext', name: 'Male Medical Ward Extension', type: 'medical', capacity: 20, currentOccupancy: 5, supervisor: 'Ward Supervisor' },
    { id: 'ward_6a', name: 'Ward 6A', type: 'general', capacity: 15, currentOccupancy: 3, supervisor: 'Ward Supervisor' },
    { id: 'ward_6b', name: 'Ward 6B', type: 'general', capacity: 15, currentOccupancy: 4, supervisor: 'Ward Supervisor' },
    { id: 'picu', name: 'PICU', type: 'icu', capacity: 10, currentOccupancy: 6, supervisor: 'Ward Supervisor' },
    { id: 'newborn', name: 'Newborn', type: 'icu', capacity: 20, currentOccupancy: 8, supervisor: 'Ward Supervisor' },
  ];

  // Consultants list for auto-assignment
  private consultants: string[] = [
    'Dr Okwesili',
    'Dr Nnadi',
    'Dr Eze C. B'
  ];

  /**
   * Return the next consultant name in round-robin fashion (persist index in localStorage)
   */
  private getNextConsultant(): string {
    try {
      const key = 'unth_consultant_index';
      const raw = (typeof window !== 'undefined' && window.localStorage) ? window.localStorage.getItem(key) : null;
      let idx = raw ? parseInt(raw, 10) : 0;
      if (isNaN(idx) || idx < 0) idx = 0;
      const consultant = this.consultants[idx % this.consultants.length];
      // store next index
      const next = (idx + 1) % this.consultants.length;
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.setItem(key, String(next));
      }
      return consultant;
    } catch (error) {
      return this.consultants[0];
    }
  }

  /**
   * Register a new patient at UNTH
   */
  async registerPatient(registrationData: PatientRegistration): Promise<string> {
    try {
      // Generate hospital number if not provided
      if (!registrationData.hospital_number) {
        registrationData.hospital_number = await this.generateHospitalNumber();
      }

      // Auto-assign consultant if not provided
      if (!registrationData.consultant_in_charge) {
        registrationData.consultant_in_charge = this.getNextConsultant();
      }

      // Validate and save patient data
      const patientId = await this.savePatientRegistration(registrationData);

      // Generate AI-powered admission summary only for inpatients (and non-elective admissions)
      if (registrationData.patient_type === 'inpatient' && registrationData.admission_type !== 'elective') {
        await this.generateAdmissionSummary(patientId, registrationData);
      }

      return patientId;
    } catch (error) {
      console.error('Error registering patient:', error);
      throw new Error('Patient registration failed');
    }
  }

  /**
   * Transfer patient between wards or from emergency/clinic
   */
  async transferPatient(transferData: Omit<PatientTransfer, 'id' | 'transfer_date'>): Promise<PatientTransfer> {
    try {
      const transfer: PatientTransfer = {
        id: this.generateId(),
        transfer_date: new Date(),
        ...transferData
      };

      // Update patient ward information
      await this.updatePatientWard(transfer.patient_id, transfer.to_ward, transfer.to_bed);

      // Generate transfer summary
      if (aiService.isReady()) {
        await this.generateTransferSummary(transfer);
      }

      // Save transfer record
      await this.saveTransferRecord(transfer);

      return transfer;
    } catch (error) {
      console.error('Error transferring patient:', error);
      throw new Error('Patient transfer failed');
    }
  }

  /**
   * Generate AI-powered patient summary
   */
  async generatePatientSummary(
    patientId: string, 
    summaryType: PatientSummary['summary_type'],
    additionalContext?: string
  ): Promise<PatientSummary> {
    try {
      const isReady = await aiService.isReady();
      if (!isReady) {
        // Return a basic summary when AI is not configured
        return this.generateBasicSummary(patientId, summaryType);
      }

      // Gather patient data
      const patientData = await this.getPatientClinicalData(patientId);

      // Generate summary using AI
      const summaryContent = await this.generateAISummary(patientData, summaryType, additionalContext);

      const summary: PatientSummary = {
        id: this.generateId(),
        patient_id: patientId,
        summary_type: summaryType,
        generated_by: 'ai',
        content: summaryContent.summary,
        key_points: summaryContent.keyPoints,
        current_problems: summaryContent.currentProblems,
        medications: summaryContent.medications,
        investigations_pending: summaryContent.investigationsPending,
        plan: summaryContent.plan,
        generated_at: new Date(),
        generated_by_user: 'ai-system',
        ai_confidence: summaryContent.confidence
      };

      await this.saveSummary(summary);
      return summary;
    } catch (error) {
      console.error('Error generating patient summary:', error);
      throw new Error('Failed to generate patient summary');
    }
  }

  /**
   * Generate basic summary when AI is not available
   */
  private async generateBasicSummary(
    patientId: string,
    summaryType: PatientSummary['summary_type']
  ): Promise<PatientSummary> {
    
    return {
      id: this.generateId(),
      patient_id: patientId,
      summary_type: summaryType,
      generated_by: 'manual',
      content: `Basic ${summaryType} summary. AI features are currently disabled. Please configure OpenAI API key for AI-powered summaries or enter summary manually.`,
      key_points: [
        'AI summary generation not configured',
        'Manual summary entry recommended'
      ],
      current_problems: [],
      medications: [],
      investigations_pending: [],
      plan: [],
      generated_at: new Date(),
      generated_by_user: 'system',
      ai_confidence: 0
    };
  }

  /**
   * Record treatment progress with AI analysis
   */
  async recordTreatmentProgress(progressData: Omit<TreatmentProgress, 'id'>): Promise<TreatmentProgress> {
    try {
      const progress: TreatmentProgress = {
        id: this.generateId(),
        ...progressData
      };

      // Save progress record
      await this.saveProgressRecord(progress);

      // Generate AI-powered progress analysis
      if (aiService.isReady()) {
        await this.analyzeProgressWithAI(progress);
      }

      return progress;
    } catch (error) {
      console.error('Error recording treatment progress:', error);
      throw new Error('Failed to record treatment progress');
    }
  }

  /**
   * Generate AI-powered discharge summary and instructions
   */
  async generateDischargePlan(patientId: string, dischargeType: DischargeDetails['discharge_type']): Promise<DischargeDetails> {
    try {
      if (!aiService.isReady()) {
        throw new Error('AI service not configured');
      }

      // Gather comprehensive patient data
      const patientData = await this.getComprehensivePatientData(patientId);

      // Generate AI-powered discharge content
      const dischargeContent = await this.generateAIDischargeContent(patientData, dischargeType);

      const dischargeDetails: DischargeDetails = {
        id: this.generateId(),
        patient_id: patientId,
        discharge_date: new Date(),
        discharge_type: dischargeType,
        final_diagnosis: dischargeContent.finalDiagnosis,
        procedures_performed: dischargeContent.proceduresPerformed,
        discharge_summary: dischargeContent.dischargeSummary,
        hospital_course: dischargeContent.hospitalCourse,
        condition_on_discharge: dischargeContent.conditionOnDischarge,
        medications_on_discharge: dischargeContent.medicationsOnDischarge,
        follow_up_instructions: dischargeContent.followUpInstructions,
        activity_restrictions: dischargeContent.activityRestrictions,
        warning_signs: dischargeContent.warningSigns,
        emergency_contacts: ['+234 703 132 2008 (UNTH Emergency)'],
        authorized_by: 'pending',
        prepared_by: 'ai-system',
        patient_counseled: false,
        relative_counseled: false,
        certificates_issued: []
      };

      await this.saveDischargeDetails(dischargeDetails);
      return dischargeDetails;
    } catch (error) {
      console.error('Error generating discharge plan:', error);
      throw new Error('Failed to generate discharge plan');
    }
  }

  /**
   * Get upcoming treatment plans for a patient
   */
  async getUpcomingPlans(patientId: string): Promise<any[]> {
    try {
      // Get treatment plans from database
      const plans = await db.treatment_plans
        .where('patient_id')
        .equals(patientId)
        .and(plan => plan.status === 'active')
        .toArray();

      // Get upcoming steps
      const upcomingSteps = await Promise.all(
        plans.map(async plan => {
          const steps = await db.plan_steps
            .where('plan_id')
            .equals(plan.id!)
            .and(step => ['pending', 'in_progress'].includes(step.status))
            .toArray();
          
          return {
            plan,
            upcomingSteps: steps.filter(step => 
              step.due_date && new Date(step.due_date) > new Date()
            ).sort((a, b) => 
              new Date(a.due_date!).getTime() - new Date(b.due_date!).getTime()
            )
          };
        })
      );

      return upcomingSteps.filter(item => item.upcomingSteps.length > 0);
    } catch (error) {
      console.error('Error getting upcoming plans:', error);
      return [];
    }
  }

  /**
   * Get available wards for transfer
   */
  getAvailableWards(): Ward[] {
    return this.wards.filter(ward => ward.currentOccupancy < ward.capacity);
  }

  /**
   * Get ward information
   */
  getWardInfo(wardId: string): Ward | undefined {
    return this.wards.find(ward => ward.id === wardId);
  }

  // Private helper methods
  private async generateHospitalNumber(): Promise<string> {
    const year = new Date().getFullYear();
    const sequence = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
    return `UNTH/${year}/${sequence}`;
  }

  private async generateAISummary(patientData: any, summaryType: string, additionalContext?: string) {
    const prompt = `
    You are a clinical AI assistant at University of Nigeria Teaching Hospital (UNTH), Plastic Surgery Department.
    Generate a comprehensive ${summaryType} summary based on the following patient data.
    
    PATIENT INFORMATION:
    - Name: ${patientData.name || 'Not provided'}
    - Age: ${patientData.age || 'Not provided'}
    - Sex: ${patientData.sex || 'Not provided'}
    - Hospital Number: ${patientData.hospital_number || 'Not provided'}
    
    ADMISSION DETAILS:
    - Admission Date: ${patientData.admission_date || 'Not provided'}
    - Admission Type: ${patientData.admission_type || 'Not provided'}
    - Ward: ${patientData.ward || 'Not provided'}
    - Consultant: ${patientData.consultant || 'Not provided'}
    
    CLINICAL PRESENTATION:
    - Chief Complaint: ${patientData.chief_complaint || 'Not provided'}
    - Presenting Complaint: ${patientData.presenting_complaint || 'Not provided'}
    - History of Presenting Complaint: ${patientData.history_presenting_complaint || 'Not provided'}
    
    PAST MEDICAL HISTORY:
    - Medical History: ${patientData.past_medical_history || 'Not provided'}
    - Surgical History: ${patientData.past_surgical_history || 'Not provided'}
    - Allergies: ${patientData.allergies?.join(', ') || 'None known'}
    - Current Medications: ${patientData.current_medications?.join(', ') || 'None'}
    
    EXAMINATION FINDINGS:
    - General Examination: ${patientData.general_examination || 'Not provided'}
    - Systemic Examination: ${patientData.systemic_examination || 'Not provided'}
    - Local Examination: ${patientData.local_examination || 'Not provided'}
    - Vital Signs: ${JSON.stringify(patientData.vital_signs || {}) || 'Not provided'}
    
    INVESTIGATION RESULTS:
    ${patientData.investigation_results ? JSON.stringify(patientData.investigation_results, null, 2) : 'No investigations yet'}
    
    DIAGNOSIS:
    - Primary Diagnosis: ${patientData.primary_diagnosis || 'Not provided'}
    - Differential Diagnoses: ${patientData.differential_diagnoses?.join(', ') || 'Not provided'}
    
    TREATMENT PLAN:
    ${patientData.treatment_plan || 'Not provided'}
    
    ADDITIONAL CONTEXT:
    ${additionalContext || 'None'}
    
    Please generate a comprehensive clinical ${summaryType} summary with the following structure in JSON format:
    {
      "summary": "A detailed narrative clinical summary (3-5 paragraphs)",
      "keyPoints": ["Array of 5-7 key clinical points"],
      "currentProblems": ["Active clinical problems requiring attention"],
      "medications": ["Current medications with dosages"],
      "investigationsPending": ["Pending investigations or results"],
      "plan": ["Management plan steps"],
      "confidence": 85
    }
    
    Focus on:
    1. Clear clinical presentation
    2. Relevant past medical/surgical history
    3. Key examination findings
    4. Current diagnosis and working differential
    5. Active treatment plan and pending investigations
    6. Patient-specific concerns or special considerations
    `;

    try {
      // Check if AI is configured
      const isConfigured = await aiService.isReady();
      if (!isConfigured) {
        // Return fallback summary with actual patient data
        return {
          summary: `${summaryType} Summary for ${patientData.name || 'Patient'}
          
Admission: ${patientData.admission_date ? new Date(patientData.admission_date).toLocaleDateString() : 'Not specified'}
Chief Complaint: ${patientData.chief_complaint || 'Not documented'}
Diagnosis: ${patientData.primary_diagnosis || 'Pending'}

AI-powered detailed summary is currently unavailable. Please configure OpenAI API key in Admin settings to enable comprehensive AI-generated summaries.

Current clinical data has been documented above. For full AI analysis, please complete the AI configuration.`,
          keyPoints: [
            `Patient: ${patientData.name || 'Not named'}`,
            `Admission Type: ${patientData.admission_type || 'Not specified'}`,
            `Chief Complaint: ${patientData.chief_complaint || 'Not documented'}`,
            `Primary Diagnosis: ${patientData.primary_diagnosis || 'Pending'}`,
            `Consultant: ${patientData.consultant || 'Not assigned'}`,
            'AI features require OpenAI configuration'
          ],
          currentProblems: patientData.current_problems || [patientData.primary_diagnosis || 'Diagnosis pending'],
          medications: patientData.current_medications || ['Medications to be reviewed'],
          investigationsPending: patientData.investigations_pending || ['Full workup pending'],
          plan: patientData.management_plan || ['Treatment plan to be formulated'],
          confidence: 50
        };
      }

      // Use AI service to generate comprehensive summary
      const aiResponse = await authenticatedFetch('/api/ai/chat', {
        method: 'POST',
        body: JSON.stringify({
          messages: [
            {
              role: 'system',
              content: 'You are an expert plastic surgery clinical assistant. Generate comprehensive, evidence-based clinical summaries in proper medical format. Always respond with valid JSON only.'
            },
            {
              role: 'user',
              content: prompt
            }
          ],
          model: 'gpt-4',
          max_tokens: 2000
        })
      });

      if (!aiResponse.ok) {
        throw new Error('AI service unavailable');
      }

      const aiData = await aiResponse.json();
      const parsedResponse = JSON.parse(aiData.response);

      return {
        summary: parsedResponse.summary || 'Summary generation incomplete',
        keyPoints: parsedResponse.keyPoints || ['AI summary pending'],
        currentProblems: parsedResponse.currentProblems || ['Pending analysis'],
        medications: parsedResponse.medications || ['Medications to be reviewed'],
        investigationsPending: parsedResponse.investigationsPending || ['Investigations pending'],
        plan: parsedResponse.plan || ['Management plan pending'],
        confidence: parsedResponse.confidence || 75
      };
    } catch (error) {
      console.error('AI summary generation error:', error);
      // Fallback with patient data
      return {
        summary: `Clinical Summary for ${patientData.name || 'Patient'}
        
This ${summaryType} summary is based on available clinical data. AI-enhanced analysis encountered an error.

Admission Details: ${patientData.admission_date ? new Date(patientData.admission_date).toLocaleDateString() : 'Not specified'}
Chief Complaint: ${patientData.chief_complaint || 'Not documented'}
Primary Diagnosis: ${patientData.primary_diagnosis || 'Pending'}
Consultant: ${patientData.consultant || 'Not assigned'}

Please review patient file for complete clinical details or retry AI summary generation.`,
        keyPoints: [
          `Patient admitted: ${patientData.admission_date ? new Date(patientData.admission_date).toLocaleDateString() : 'Date not specified'}`,
          `Presenting with: ${patientData.chief_complaint || 'Complaint not documented'}`,
          `Diagnosis: ${patientData.primary_diagnosis || 'Under investigation'}`,
          'AI analysis encountered error - manual review recommended'
        ],
        currentProblems: patientData.current_problems || [patientData.primary_diagnosis || 'Assessment pending'],
        medications: patientData.current_medications || ['Review required'],
        investigationsPending: ['Full clinical workup'],
        plan: ['Complete clinical assessment', 'Formulate treatment plan'],
        confidence: 40
      };
    }
  }

  private async generateAIDischargeContent(patientData: any, dischargeType: string) {
    // Simplified discharge content generation
    return {
      finalDiagnosis: ['Primary diagnosis pending'],
      proceduresPerformed: ['Procedures to be documented'],
      dischargeSummary: 'Patient discharge summary generated by AI system.',
      hospitalCourse: 'Hospital course details pending AI generation.',
      conditionOnDischarge: 'Stable condition',
      medicationsOnDischarge: [
        {
          name: 'Medication Name',
          dosage: 'Dosage',
          frequency: 'Frequency',
          duration: 'Duration',
          instructions: 'Special instructions'
        }
      ],
      followUpInstructions: [
        {
          clinic: 'Plastic Surgery Clinic',
          date: 'To be scheduled',
          doctor: 'Consultant Plastic Surgeon',
          instructions: 'Follow-up care instructions'
        }
      ],
      activityRestrictions: ['Activity restrictions as advised'],
      warningSigns: ['Warning signs to watch for']
    };
  }

  private async getPatientClinicalData(patientId: string) {
    // Gather all clinical data for the patient
    const patient = await db.patients.get(patientId);
    const plans = await db.treatment_plans.where('patient_id').equals(patientId).toArray();
    // Add more data gathering as needed
    return { patient, plans };
  }

  private async getComprehensivePatientData(patientId: string) {
    return await this.getPatientClinicalData(patientId);
  }

  private async savePatientRegistration(registrationData: PatientRegistration): Promise<string> {
    try {
      // Generate a unique ID for the patient
      const patientId = uuidv4();

      // Convert to database format matching PostgreSQL schema
      const patientRecord = {
        id: patientId,
        hospital_number: registrationData.hospital_number,
        first_name: registrationData.first_name,
        last_name: registrationData.last_name,
        other_names: registrationData.middle_name || '',
        date_of_birth: registrationData.date_of_birth,
        gender: registrationData.sex === 'male' ? 'Male' : 'Female',
        phone: registrationData.phone || '',
        email: registrationData.email || '',
        address: registrationData.address || '',
        city: '',
        state: registrationData.state_of_origin || '',
        country: registrationData.nationality || 'Nigeria',
        emergency_contact_name: registrationData.next_of_kin?.name || '',
        emergency_contact_phone: registrationData.next_of_kin?.phone || '',
        emergency_contact_relationship: registrationData.next_of_kin?.relationship || '',
        blood_group: registrationData.blood_group || null,
        genotype: registrationData.genotype || null,
        allergies: registrationData.allergies?.join(', ') || '',
        chronic_conditions: registrationData.medical_history?.join(', ') || '',
        current_medications: registrationData.drug_history?.join(', ') || '',
        synced: true
      };

      // Save to backend API instead of IndexedDB
      const savedPatient = await apiClient.createPatient(patientRecord);
      
      if (!savedPatient || !savedPatient.id) {
        throw new Error('Failed to save patient to server');
      }
      
      // Also save to IndexedDB for offline support (sync will happen automatically)
      try {
        await db.patients.put({
          ...patientRecord,
          consultant_in_charge: registrationData.consultant_in_charge,
          resident_in_charge: registrationData.resident_in_charge,
          ward_id: registrationData.ward_id,
          bed_number: registrationData.bed_number,
          patient_type: registrationData.patient_type,
          admission_type: registrationData.admission_type,
          referring_hospital: registrationData.referring_hospital,
          registration_date: registrationData.registration_date || new Date(),
          admission_date: registrationData.admission_date,
          created_at: new Date(),
          updated_at: new Date(),
          synced: true,
          deleted: false
        });
      } catch (dbError) {
        console.warn('Failed to save to IndexedDB (offline cache):', dbError);
        // Continue - server save succeeded
      }
      
      console.log('Patient registered successfully:', { 
        id: savedPatient.id, 
        hospital_number: patientRecord.hospital_number 
      });
      
      return savedPatient.id;
    } catch (error) {
      console.error('Error saving patient registration:', error);
      throw new Error('Patient registration failed: ' + (error instanceof Error ? error.message : 'Unknown error'));
    }
  }

  private async updatePatientWard(patientId: string, wardId: string, bedNumber?: string) {
    // Update patient ward information
    // This would be implemented with proper database updates
  }

  private async saveTransferRecord(transfer: PatientTransfer) {
    // Save transfer record to database
  }

  private async generateAdmissionSummary(patientId: string, registrationData: PatientRegistration) {
    try {
      // Build comprehensive patient data from registration
      const patientData = {
        name: `${registrationData.firstName} ${registrationData.lastName}`,
        age: registrationData.dateOfBirth ? this.calculateAge(new Date(registrationData.dateOfBirth)) : 'Not provided',
        sex: registrationData.sex,
        hospital_number: registrationData.hospitalNumber,
        admission_date: registrationData.admissionDate,
        admission_type: registrationData.admissionType,
        ward: registrationData.ward,
        consultant: registrationData.consultant,
        chief_complaint: registrationData.chiefComplaint,
        presenting_complaint: registrationData.presentingComplaint,
        history_presenting_complaint: registrationData.historyPresentingComplaint,
        past_medical_history: registrationData.pastMedicalHistory,
        past_surgical_history: registrationData.pastSurgicalHistory,
        allergies: registrationData.allergies,
        current_medications: registrationData.currentMedications,
        general_examination: registrationData.generalExamination,
        systemic_examination: registrationData.systemicExamination,
        local_examination: registrationData.localExamination,
        vital_signs: registrationData.vitalSigns,
        investigation_results: registrationData.investigationResults,
        primary_diagnosis: registrationData.primaryDiagnosis,
        differential_diagnoses: registrationData.differentialDiagnoses,
        treatment_plan: registrationData.treatmentPlan,
        current_problems: registrationData.currentProblems,
        investigations_pending: registrationData.investigationsPending,
        management_plan: registrationData.managementPlan
      };

      // Generate AI-powered admission summary
      await this.generatePatientSummary(patientId, 'admission', 
        `Patient admitted to ${registrationData.ward} ward under ${registrationData.consultant}`);
    } catch (error) {
      console.error('Error generating admission summary:', error);
      // Don't throw - admission can proceed without AI summary
    }
  }

  private calculateAge(dateOfBirth: Date): string {
    const today = new Date();
    let age = today.getFullYear() - dateOfBirth.getFullYear();
    const monthDiff = today.getMonth() - dateOfBirth.getMonth();
    
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < dateOfBirth.getDate())) {
      age--;
    }
    
    return `${age} years`;
  }

  private async generateTransferSummary(transfer: PatientTransfer) {
    // Generate AI transfer summary
  }

  private async saveSummary(summary: PatientSummary) {
    try {
      // Save to IndexedDB
      await db.patient_summaries.add(summary as any);
      console.log('✅ Patient summary saved to database');
    } catch (error) {
      console.error('Error saving patient summary:', error);
      throw new Error('Failed to save patient summary');
    }
  }

  private async saveProgressRecord(progress: TreatmentProgress) {
    // Save progress record to database
  }

  private async analyzeProgressWithAI(progress: TreatmentProgress) {
    // Analyze progress with AI
  }

  private async saveDischargeDetails(dischargeDetails: DischargeDetails) {
    // Save discharge details to database
  }

  private generateId(): string {
    return `${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  }
}

export const unthPatientService = new UNTHPatientService();
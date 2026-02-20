import { db } from '../db/database';
import { apiClient } from './apiClient';

export type PaperworkType = 'consult_request' | 'discharge_summary' | 'medical_report';

export interface ConsultRequestData {
  patient_id: string;
  patient_name: string;
  hospital_number: string;
  consulting_department: string;
  reason_for_consult: string;
  relevant_history: string;
  current_medications: string;
  examination_findings: string;
  investigations: string;
  specific_question: string;
  urgency: 'routine' | 'urgent' | 'emergency';
}

export interface DischargeSummaryData {
  patient_id: string;
  patient_name: string;
  hospital_number: string;
  admission_date: Date;
  discharge_date: Date;
  admission_diagnosis: string;
  final_diagnosis: string;
  procedures_performed: string[];
  hospital_course: string;
  discharge_medications: string;
  follow_up_plan: string;
  discharge_condition: string;
}

export interface MedicalReportData {
  patient_id: string;
  patient_name: string;
  hospital_number: string;
  report_type: 'insurance' | 'legal' | 'employment' | 'school' | 'other';
  recipient: string;
  recipient_address: string;
  diagnosis: string;
  treatment_given: string;
  current_status: string;
  prognosis: string;
  restrictions: string;
  additional_notes: string;
}

export interface PaperworkDocument {
  id: string;
  type: PaperworkType;
  patient_id: string;
  patient_name: string;
  hospital_number: string;
  title: string;
  content: string;
  data: ConsultRequestData | DischargeSummaryData | MedicalReportData;
  generated_by: 'ai' | 'manual';
  created_by: string;
  created_at: Date;
  last_modified: Date;
  status: 'draft' | 'final' | 'sent';
}

class PaperworkService {
  // Helper: push a document to server
  private async pushToServer(document: PaperworkDocument): Promise<void> {
    try {
      await apiClient.post('/sync/push', {
        changes: [{
          entityType: 'paperwork_documents',
          entityId: document.id,
          action: 'upsert',
          payload: {
            ...document,
            data: typeof document.data === 'object' ? JSON.stringify(document.data) : document.data
          }
        }]
      });
    } catch (error) {
      console.warn('Failed to push paperwork document to server:', error);
    }
  }

  // Helper: pull documents from server and sync to local
  private async pullFromServer(): Promise<PaperworkDocument[]> {
    const response = await apiClient.get('/sync/paperwork-documents');
    if (Array.isArray(response)) {
      // Sync to local DB
      for (const doc of response) {
        try {
          const parsed = {
            ...doc,
            data: typeof doc.data === 'string' ? JSON.parse(doc.data) : doc.data,
            created_at: new Date(doc.created_at),
            last_modified: new Date(doc.last_modified || doc.updated_at),
          };
          const existing = await db.paperwork_documents.get(doc.id);
          if (existing) {
            await db.paperwork_documents.update(doc.id, parsed);
          } else {
            await db.paperwork_documents.add(parsed as any);
          }
        } catch (e) {
          console.warn('Error syncing paperwork document to local:', e);
        }
      }
      return response.map(doc => ({
        ...doc,
        data: typeof doc.data === 'string' ? JSON.parse(doc.data) : doc.data,
        created_at: new Date(doc.created_at),
        last_modified: new Date(doc.last_modified || doc.updated_at),
      }));
    }
    return [];
  }

  // Generate AI-powered Consult Request
  async generateConsultRequest(data: ConsultRequestData, userId: string): Promise<PaperworkDocument> {
    const content = this.buildConsultRequestContent(data);
    
    const document: PaperworkDocument = {
      id: `consult_${Date.now()}`,
      type: 'consult_request',
      patient_id: data.patient_id,
      patient_name: data.patient_name,
      hospital_number: data.hospital_number,
      title: `Consult Request - ${data.consulting_department}`,
      content,
      data,
      generated_by: 'ai',
      created_by: userId,
      created_at: new Date(),
      last_modified: new Date(),
      status: 'draft'
    };

    await db.paperwork_documents.add(document as any);
    // Push to server for cross-device sync
    await this.pushToServer(document);
    return document;
  }

  private buildConsultRequestContent(data: ConsultRequestData): string {
    const date = new Date().toLocaleDateString('en-GB', { 
      day: 'numeric', 
      month: 'long', 
      year: 'numeric' 
    });

    return `
CONSULT REQUEST - ${data.urgency.toUpperCase()}

Date: ${date}
To: ${data.consulting_department}
From: Plastic Surgery Unit

PATIENT INFORMATION:
Name: ${data.patient_name}
Hospital Number: ${data.hospital_number}

REASON FOR CONSULT:
${data.reason_for_consult}

RELEVANT CLINICAL HISTORY:
${data.relevant_history}

CURRENT MEDICATIONS:
${data.current_medications}

EXAMINATION FINDINGS:
${data.examination_findings}

INVESTIGATIONS:
${data.investigations}

SPECIFIC QUESTION(S):
${data.specific_question}

We would appreciate your expert opinion and recommendations on the management of this patient.

Thank you for your prompt attention to this ${data.urgency} consult.

Respectfully,
Plastic Surgery Team
University of Nigeria Teaching Hospital
    `.trim();
  }

  // Generate AI-powered Discharge Summary
  async generateDischargeSummary(data: DischargeSummaryData, userId: string): Promise<PaperworkDocument> {
    const content = this.buildDischargeSummaryContent(data);
    
    const document: PaperworkDocument = {
      id: `discharge_${Date.now()}`,
      type: 'discharge_summary',
      patient_id: data.patient_id,
      patient_name: data.patient_name,
      hospital_number: data.hospital_number,
      title: `Discharge Summary - ${data.patient_name}`,
      content,
      data,
      generated_by: 'ai',
      created_by: userId,
      created_at: new Date(),
      last_modified: new Date(),
      status: 'draft'
    };

    await db.paperwork_documents.add(document as any);
    // Push to server for cross-device sync
    await this.pushToServer(document);
    return document;
  }

  private buildDischargeSummaryContent(data: DischargeSummaryData): string {
    const admissionDate = new Date(data.admission_date).toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    });

    const dischargeDate = new Date(data.discharge_date).toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    });

    const lengthOfStay = Math.ceil(
      (new Date(data.discharge_date).getTime() - new Date(data.admission_date).getTime()) / (1000 * 60 * 60 * 24)
    );

    return `
DISCHARGE SUMMARY

PATIENT INFORMATION:
Name: ${data.patient_name}
Hospital Number: ${data.hospital_number}
Admission Date: ${admissionDate}
Discharge Date: ${dischargeDate}
Length of Stay: ${lengthOfStay} day(s)

ADMISSION DIAGNOSIS:
${data.admission_diagnosis}

FINAL DIAGNOSIS:
${data.final_diagnosis}

PROCEDURES PERFORMED:
${data.procedures_performed.map((p, i) => `${i + 1}. ${p}`).join('\n')}

HOSPITAL COURSE:
${data.hospital_course}

DISCHARGE MEDICATIONS:
${data.discharge_medications}

FOLLOW-UP PLAN:
${data.follow_up_plan}

DISCHARGE CONDITION:
${data.discharge_condition}

Prepared by: Plastic Surgery Unit
University of Nigeria Teaching Hospital
Date: ${dischargeDate}
    `.trim();
  }

  // Generate AI-powered Medical Report
  async generateMedicalReport(data: MedicalReportData, userId: string): Promise<PaperworkDocument> {
    const content = this.buildMedicalReportContent(data);
    
    const document: PaperworkDocument = {
      id: `report_${Date.now()}`,
      type: 'medical_report',
      patient_id: data.patient_id,
      patient_name: data.patient_name,
      hospital_number: data.hospital_number,
      title: `Medical Report - ${data.report_type}`,
      content,
      data,
      generated_by: 'ai',
      created_by: userId,
      created_at: new Date(),
      last_modified: new Date(),
      status: 'draft'
    };

    await db.paperwork_documents.add(document as any);
    // Push to server for cross-device sync
    await this.pushToServer(document);
    return document;
  }

  private buildMedicalReportContent(data: MedicalReportData): string {
    const date = new Date().toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    });

    const reportTypeLabel = data.report_type.replace('_', ' ').toUpperCase();

    return `
MEDICAL REPORT (${reportTypeLabel})

Date: ${date}

To: ${data.recipient}
${data.recipient_address}

RE: ${data.patient_name} (Hospital Number: ${data.hospital_number})

Dear ${data.recipient},

This is to certify that the above-named patient has been under our care at the Plastic Surgery Unit, University of Nigeria Teaching Hospital.

DIAGNOSIS:
${data.diagnosis}

TREATMENT PROVIDED:
${data.treatment_given}

CURRENT STATUS:
${data.current_status}

PROGNOSIS:
${data.prognosis}

RESTRICTIONS/LIMITATIONS:
${data.restrictions}

ADDITIONAL NOTES:
${data.additional_notes}

This report is issued upon the patient's request for ${reportTypeLabel.toLowerCase()} purposes.

Should you require any further information or clarification, please do not hesitate to contact our department.

Yours faithfully,

_____________________
Plastic Surgery Unit
University of Nigeria Teaching Hospital
Ituku-Ozalla, Enugu State

Contact: Burns, Plastic & Reconstructive Surgery UNIT, Department of Surgery
Phone: [Hospital Contact Number]
    `.trim();
  }

  // Get document by ID
  async getDocument(documentId: string): Promise<PaperworkDocument | undefined> {
    try {
      const serverDocs = await this.pullFromServer();
      const found = serverDocs.find(d => d.id === documentId);
      if (found) return found;
    } catch (error) {
      console.warn('Server fetch failed for document, using local:', error);
    }
    return await db.paperwork_documents.get(documentId);
  }

  // Get all documents for a patient
  async getPatientDocuments(patientId: string): Promise<PaperworkDocument[]> {
    try {
      const serverDocs = await this.pullFromServer();
      const filtered = serverDocs
        .filter(d => d.patient_id === patientId)
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      if (filtered.length > 0) return filtered;
    } catch (error) {
      console.warn('Server fetch failed for patient documents, using local:', error);
    }
    return await db.paperwork_documents
      .where('patient_id')
      .equals(patientId)
      .reverse()
      .sortBy('created_at');
  }

  // Get documents by type
  async getDocumentsByType(type: PaperworkType): Promise<PaperworkDocument[]> {
    try {
      const serverDocs = await this.pullFromServer();
      const filtered = serverDocs
        .filter(d => d.type === type)
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      if (filtered.length > 0) return filtered;
    } catch (error) {
      console.warn('Server fetch failed for documents by type, using local:', error);
    }
    return await db.paperwork_documents
      .where('type')
      .equals(type)
      .reverse()
      .sortBy('created_at');
  }

  // Update document
  async updateDocument(documentId: string, updates: Partial<PaperworkDocument>): Promise<void> {
    const updatedFields = { ...updates, last_modified: new Date() };
    await db.paperwork_documents.update(documentId, updatedFields);
    // Push update to server
    try {
      const doc = await db.paperwork_documents.get(documentId);
      if (doc) await this.pushToServer(doc as PaperworkDocument);
    } catch (error) {
      console.warn('Failed to push document update to server:', error);
    }
  }

  // Update document status
  async updateStatus(documentId: string, status: 'draft' | 'final' | 'sent'): Promise<void> {
    await db.paperwork_documents.update(documentId, {
      status,
      last_modified: new Date()
    });
    // Push status update to server
    try {
      const doc = await db.paperwork_documents.get(documentId);
      if (doc) await this.pushToServer(doc as PaperworkDocument);
    } catch (error) {
      console.warn('Failed to push status update to server:', error);
    }
  }

  // Delete document
  async deleteDocument(documentId: string): Promise<void> {
    await db.paperwork_documents.delete(documentId);
    // Push delete to server
    try {
      await apiClient.post('/sync/push', {
        changes: [{
          entityType: 'paperwork_documents',
          entityId: documentId,
          action: 'delete',
          payload: { id: documentId }
        }]
      });
    } catch (error) {
      console.warn('Failed to push document delete to server:', error);
    }
  }

  // Get recent documents
  async getRecentDocuments(limit: number = 10): Promise<PaperworkDocument[]> {
    try {
      const serverDocs = await this.pullFromServer();
      if (serverDocs.length > 0) {
        return serverDocs
          .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
          .slice(0, limit);
      }
    } catch (error) {
      console.warn('Server fetch failed for recent documents, using local:', error);
    }
    const documents = await db.paperwork_documents.toArray();
    return documents
      .sort((a, b) => b.created_at.getTime() - a.created_at.getTime())
      .slice(0, limit);
  }
}

export const paperworkService = new PaperworkService();

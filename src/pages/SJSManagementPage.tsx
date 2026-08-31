import { useState, useCallback, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft, Download, AlertTriangle, CheckCircle, Eye, Heart,
  Thermometer, Activity, Users, FileText, Pill, Shield, BookOpen, Save
} from 'lucide-react';
import { burnCareService } from '../services/burnCareService';
import { apiClient } from '../services/apiClient';
import { db } from '../db/database';
import {
  createPDF, addPDFHeader, addSectionHeader, addBodyText, addBulletList,
  addSeparator, addFooter, addWarningBox, addTwoColumnText,
  createPageBreakHandler, PDF_MARGINS, PDF_COLORS, PDF_FONT_SIZES,
  PDF_LINE_HEIGHT, sanitizeTextForPDF
} from '../utils/pdfUtils';

// ── Common causative drugs ──────────────────────────────────────────────
const CAUSATIVE_DRUGS = [
  'Allopurinol', 'Carbamazepine', 'Phenytoin', 'Lamotrigine', 'Phenobarbital',
  'Nevirapine', 'Sulfasalazine', 'Cotrimoxazole (TMP-SMX)', 'Sulfonamides',
  'Amoxicillin', 'Ampicillin', 'Cephalosporins', 'Quinolones',
  'Piroxicam', 'Meloxicam', 'Tenoxicam',
  'Oxcarbazepine', 'Dapsone', 'Methotrexate',
  'Unknown / Other',
];

// ── Organ involvement checklist ─────────────────────────────────────────
const ORGAN_SYSTEMS = [
  { key: 'skin', label: 'Skin / Mucocutaneous', icon: Shield },
  { key: 'eyes', label: 'Ocular (conjunctivae, cornea)', icon: Eye },
  { key: 'oral', label: 'Oral mucosa (lips, buccal, palate)', icon: Activity },
  { key: 'genital', label: 'Genital / Urethral mucosa', icon: Heart },
  { key: 'respiratory', label: 'Respiratory tract (tracheobronchial)', icon: Thermometer },
  { key: 'gi', label: 'Gastrointestinal (oesophageal, intestinal)', icon: Activity },
  { key: 'hepatic', label: 'Hepatic involvement', icon: Activity },
  { key: 'renal', label: 'Renal involvement', icon: Activity },
] as const;

type OrganKey = typeof ORGAN_SYSTEMS[number]['key'];

interface AssessmentData {
  patientName: string;
  hospitalNumber: string;
  age: number;
  sex: 'Male' | 'Female';
  weight: number;
  dateOfOnset: string;
  dateOfAssessment: string;
  causativeDrug: string;
  otherDrug: string;
  daysSinceDrugStart: number;
  classification: 'SJS' | 'SJS-TEN Overlap' | 'TEN';
  bsaDetached: number;
  organInvolvement: Record<OrganKey, boolean>;
  organNotes: Record<OrganKey, string>;
  // SCORTEN parameters
  heartRate: number;
  hasMalignancy: boolean;
  serumUrea: number;
  serumBicarbonate: number;
  serumGlucose: number;
  // Additional clinical
  nikolskySign: boolean;
  feverOnAdmission: boolean;
  temperature: number;
  painScore: number;
  // Counselling
  patientAware: boolean;
  familyCounselled: boolean;
  counsellingNotes: string;
}

const defaultAssessment: AssessmentData = {
  patientName: '',
  hospitalNumber: '',
  age: 0,
  sex: 'Male',
  weight: 0,
  dateOfOnset: new Date().toISOString().split('T')[0],
  dateOfAssessment: new Date().toISOString().split('T')[0],
  causativeDrug: '',
  otherDrug: '',
  daysSinceDrugStart: 0,
  classification: 'SJS',
  bsaDetached: 0,
  organInvolvement: { skin: true, eyes: false, oral: false, genital: false, respiratory: false, gi: false, hepatic: false, renal: false },
  organNotes: { skin: '', eyes: '', oral: '', genital: '', respiratory: '', gi: '', hepatic: '', renal: '' },
  heartRate: 80,
  hasMalignancy: false,
  serumUrea: 5,
  serumBicarbonate: 24,
  serumGlucose: 5,
  nikolskySign: false,
  feverOnAdmission: false,
  temperature: 37,
  painScore: 5,
  patientAware: false,
  familyCounselled: false,
  counsellingNotes: '',
};

// ── Classification helper ───────────────────────────────────────────────
function getClassification(bsa: number): 'SJS' | 'SJS-TEN Overlap' | 'TEN' {
  if (bsa < 10) return 'SJS';
  if (bsa <= 30) return 'SJS-TEN Overlap';
  return 'TEN';
}

// ── Specialist referrals builder ────────────────────────────────────────
function buildReferrals(data: AssessmentData): string[] {
  const refs: string[] = [
    'Dermatology — primary managing team',
    'Burns / Plastic Surgery — wound care and possible debridement',
  ];
  if (data.organInvolvement.eyes) refs.push('Ophthalmology — URGENT within 24 hours: symblepharon prevention, amniotic membrane transplant consideration');
  if (data.organInvolvement.oral) refs.push('Oral Medicine / ENT — oral care, sialorrhea management');
  if (data.organInvolvement.genital) refs.push('Gynaecology / Urology — mucosal adhesion prevention');
  if (data.organInvolvement.respiratory) refs.push('Pulmonology / ICU — bronchoscopy, respiratory support');
  if (data.organInvolvement.gi) refs.push('Gastroenterology — endoscopy if GI symptoms worsen');
  if (data.organInvolvement.hepatic) refs.push('Hepatology — monitor LFTs, consider N-acetylcysteine');
  if (data.organInvolvement.renal) refs.push('Nephrology — monitor renal function, dose-adjust medications');
  refs.push('Psychiatry / Psychology — emotional support, PTSD screening');
  refs.push('Nutrition / Dietetics — high-calorie high-protein diet planning');
  refs.push('Physiotherapy — early mobilisation when safe');
  refs.push('Pain team — multimodal analgesia');
  return refs;
}

// ── Wound care protocol ─────────────────────────────────────────────────
function getWoundCareProtocol(bsa: number): string[] {
  const protocol = [
    'Gentle cleansing with saline or chlorhexidine 0.05%',
    'NON-adhesive dressings: Mepitel One, Mepilex Ag, or similar silicone-based',
    'Avoid debridement of intact blisters where possible',
    'Sheared epidermis can be used as biological dressing',
    'Daily wound assessment and photography',
    'Barrier creams (e.g. petroleum jelly) for intact surrounding skin',
    'Mouth care: chlorhexidine mouthwash, lip petroleum jelly, soft diet',
  ];
  if (bsa >= 30) {
    protocol.push('Consider biosynthetic dressings (Biobrane) for large areas');
    protocol.push('Avoid silver sulfadiazine (sulfonamide — potential causative agent)');
  }
  return protocol;
}

// ── Systemic therapy options ────────────────────────────────────────────
function getSystemicTherapy(scortenScore: number, bsa: number): string[] {
  const therapy = [
    'STOP ALL SUSPECTED CAUSATIVE DRUGS IMMEDIATELY',
    'Aggressive IV fluid resuscitation: 2 mL/kg/% BSA detached (less than thermal burns)',
    'Maintain ambient temperature 30-32°C',
    'VTE prophylaxis: LMWH (enoxaparin 40 mg SC daily)',
    'Stress ulcer prophylaxis: PPI (omeprazole 40 mg IV daily)',
    'Analgesia: paracetamol + tramadol (AVOID NSAIDs)',
    'Nutritional support: 25-30 kcal/kg/day, 1.5 g protein/kg/day',
    'Blood sugar monitoring 6-hourly',
    'Strict fluid balance charting',
  ];
  if (scortenScore >= 2 || bsa >= 10) {
    therapy.push('');
    therapy.push('IMMUNOMODULATORY THERAPY (discuss with dermatology):');
    therapy.push('Option A: Cyclosporine 3-5 mg/kg/day PO/IV for 10-14 days (preferred if no contraindication)');
    therapy.push('Option B: IVIG 0.5-1 g/kg/day for 3-4 days (controversial; consider if cyclosporine contraindicated)');
    therapy.push('Option C: Etanercept 50 mg SC x1 (evidence emerging)');
    therapy.push('Note: Systemic corticosteroids are controversial — short pulse may be considered in early SJS');
  }
  if (scortenScore >= 4) {
    therapy.push('');
    therapy.push('CRITICAL CARE REQUIREMENTS:');
    therapy.push('Central venous access for resuscitation');
    therapy.push('Arterial line for continuous BP monitoring');
    therapy.push('Urinary catheter — strict I/O monitoring');
    therapy.push('Consider intubation if respiratory tract involvement with deterioration');
  }
  return therapy;
}

// ── Monitoring schedule ─────────────────────────────────────────────────
function getMonitoringSchedule(scortenScore: number): string[] {
  const schedule = [
    'Vital signs: every 4 hours (every 1 hour if SCORTEN >= 4)',
    'Fluid balance: strict input/output every 4 hours',
    'Daily wound assessment with photography',
    'Daily SCORTEN recalculation for first 5 days',
    'FBC, U+E, LFTs, glucose — daily for first 5 days then every 48 hours',
    'Blood cultures if febrile (> 38.5°C)',
    'CRP/ESR — every 48 hours for infection monitoring',
    'Ophthalmology review — daily if ocular involvement',
    'Pain assessment Q4H using validated scale',
    'Nutritional intake monitoring daily',
    'Psychological wellbeing assessment daily',
  ];
  if (scortenScore >= 3) {
    schedule.push('ABG — daily or as needed');
    schedule.push('Albumin/pre-albumin — every 48 hours');
    schedule.push('Consider central venous pressure monitoring');
  }
  return schedule;
}

// ── Patient / relative counselling content ──────────────────────────────
const PATIENT_COUNSELLING = [
  {
    heading: 'What is SJS / TEN?',
    content: 'Stevens-Johnson Syndrome (SJS) and Toxic Epidermal Necrolysis (TEN) are severe, potentially life-threatening skin reactions most commonly triggered by medications. The body\'s immune system attacks the skin, causing blistering, peeling, and damage to mucous membranes (mouth, eyes, genitals). SJS involves less than 10% of body surface area, SJS-TEN overlap involves 10-30%, and TEN involves more than 30%.',
  },
  {
    heading: 'What caused this?',
    content: 'In most cases, a medication triggers the reaction. The drug has been stopped. We will provide you with a drug allergy card listing the suspected drug and related medications to ALWAYS AVOID in the future. This card should be shown to ALL healthcare providers before taking any medication.',
  },
  {
    heading: 'What treatment are we providing?',
    content: 'Treatment focuses on: (1) Stopping the causative drug, (2) Careful wound care similar to burn management, (3) Preventing infection, (4) Managing pain, (5) Protecting the eyes and mucous membranes, (6) Supporting nutrition, and (7) Possible immune-modulating medication to slow the disease progression.',
  },
  {
    heading: 'What to expect during recovery',
    content: 'The acute phase typically lasts 1-3 weeks. During this time, new blisters may continue to appear even after the drug is stopped. Skin regrowth begins from the edges and takes 2-4 weeks. Full recovery often takes 3-6 months. Scarring, skin colour changes, and nail changes are common. Eye symptoms may persist and require ongoing treatment.',
  },
  {
    heading: 'Potential long-term complications',
    content: 'Some patients experience: skin colour changes (hyper/hypopigmentation), dry eyes or chronic eye problems, vaginal or urethral narrowing, nail irregularities, dental problems, psychological effects including PTSD, anxiety, and depression. All of these can be managed with appropriate specialist follow-up.',
  },
  {
    heading: 'Important safety information',
    content: 'You must NEVER take the suspected causative drug again, or any drugs in the same family. Always carry your drug allergy card. Inform ALL healthcare providers, dentists, and pharmacists about this allergy. Consider wearing a medical alert bracelet. If prescribed a new medication and you are unsure if it is safe, contact us before taking it.',
  },
  {
    heading: 'Follow-up care',
    content: 'After discharge, you will need: (1) Dermatology follow-up at 2 weeks, 1 month, 3 months, and 6 months, (2) Ophthalmology follow-up if eyes were involved, (3) Psychology/Psychiatry referral for emotional support, (4) Physiotherapy for mobility. Do not hesitate to return to the hospital if you develop new blistering, fever, worsening eye symptoms, or difficulty swallowing.',
  },
];

// ═══════════════════════════════════════════════════════════════════════
// COMPONENT
// ═══════════════════════════════════════════════════════════════════════
export default function SJSManagementPage() {
  const navigate = useNavigate();
  const [data, setData] = useState<AssessmentData>(defaultAssessment);
  const [activeTab, setActiveTab] = useState<'assessment' | 'management' | 'counselling'>('assessment');
  const [scortenResult, setScortenResult] = useState<ReturnType<typeof burnCareService.calculateSCORTEN> | null>(null);
  const [generatingPDF, setGeneratingPDF] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savedId, setSavedId] = useState<number | null>(null);
  const [savedAssessments, setSavedAssessments] = useState<any[]>([]);

  // ── Load saved assessments on mount ───────────────────────────────────
  useEffect(() => {
    loadSavedAssessments();
  }, []);

  const loadSavedAssessments = async () => {
    try {
      const response = await apiClient.get<{ assessments: any[] }>('/sjs-assessments?status=active');
      setSavedAssessments(response.assessments || []);
    } catch {
      // Fallback to IndexedDB
      try {
        const local = await db.sjs_assessments.orderBy('created_at').reverse().limit(50).toArray();
        setSavedAssessments(local);
      } catch { /* offline with no local data */ }
    }
  };

  const saveAssessment = async () => {
    setSaving(true);
    try {
      const score = scortenResult?.score ?? 0;
      const mortality = scortenResult?.predictedMortality ?? 'N/A';
      const payload = {
        patient_name: data.patientName,
        hospital_number: data.hospitalNumber,
        age: data.age,
        sex: data.sex,
        weight: data.weight,
        date_of_onset: data.dateOfOnset,
        date_of_assessment: data.dateOfAssessment,
        causative_drug: data.causativeDrug === 'Unknown / Other' ? data.otherDrug : data.causativeDrug,
        other_drug: data.otherDrug,
        days_since_drug_start: data.daysSinceDrugStart,
        classification: data.classification,
        bsa_detached: data.bsaDetached,
        organ_involvement: data.organInvolvement,
        organ_notes: data.organNotes,
        heart_rate: data.heartRate,
        has_malignancy: data.hasMalignancy,
        serum_urea: data.serumUrea,
        serum_bicarbonate: data.serumBicarbonate,
        serum_glucose: data.serumGlucose,
        nikolsky_sign: data.nikolskySign,
        fever_on_admission: data.feverOnAdmission,
        temperature: data.temperature,
        pain_score: data.painScore,
        scorten_score: score,
        scorten_mortality: mortality,
        patient_aware: data.patientAware,
        family_counselled: data.familyCounselled,
        counselling_notes: data.counsellingNotes,
      };

      // Save to IndexedDB first for offline support
      const localRecord = { ...payload, created_at: new Date().toISOString(), status: 'active' };
      const localId = await db.sjs_assessments.add(localRecord);

      // Try to save to server
      try {
        const response = savedId
          ? await apiClient.put<{ assessment: any }>(`/sjs-assessments/${savedId}`, payload)
          : await apiClient.post<{ assessment: any }>('/sjs-assessments', payload);
        const serverAssessment = response.assessment;
        setSavedId(serverAssessment.id);
        // Update local record with server ID
        await db.sjs_assessments.update(localId, { serverId: serverAssessment.id, synced: true });
      } catch {
        // Offline — data saved locally
      }

      await loadSavedAssessments();
      alert('Assessment saved successfully');
    } catch (err) {
      console.error('Save failed:', err);
      alert('Failed to save assessment');
    } finally {
      setSaving(false);
    }
  };

  const loadAssessment = (assessment: any) => {
    setData({
      patientName: assessment.patient_name || '',
      hospitalNumber: assessment.hospital_number || '',
      age: assessment.age || 0,
      sex: assessment.sex || 'Male',
      weight: assessment.weight || 0,
      dateOfOnset: assessment.date_of_onset?.split('T')[0] || defaultAssessment.dateOfOnset,
      dateOfAssessment: assessment.date_of_assessment?.split('T')[0] || defaultAssessment.dateOfAssessment,
      causativeDrug: assessment.causative_drug || '',
      otherDrug: assessment.other_drug || '',
      daysSinceDrugStart: assessment.days_since_drug_start || 0,
      classification: assessment.classification || 'SJS',
      bsaDetached: parseFloat(assessment.bsa_detached) || 0,
      organInvolvement: assessment.organ_involvement || defaultAssessment.organInvolvement,
      organNotes: assessment.organ_notes || defaultAssessment.organNotes,
      heartRate: assessment.heart_rate || 80,
      hasMalignancy: assessment.has_malignancy || false,
      serumUrea: parseFloat(assessment.serum_urea) || 5,
      serumBicarbonate: parseFloat(assessment.serum_bicarbonate) || 24,
      serumGlucose: parseFloat(assessment.serum_glucose) || 5,
      nikolskySign: assessment.nikolsky_sign || false,
      feverOnAdmission: assessment.fever_on_admission || false,
      temperature: parseFloat(assessment.temperature) || 37,
      painScore: assessment.pain_score || 5,
      patientAware: assessment.patient_aware || false,
      familyCounselled: assessment.family_counselled || false,
      counsellingNotes: assessment.counselling_notes || '',
    });
    setSavedId(assessment.id || assessment.serverId || null);
    if (assessment.scorten_score) {
      setScortenResult({
        score: assessment.scorten_score,
        predictedMortality: assessment.scorten_mortality || 'N/A',
        breakdown: [],
      } as any);
    }
  };

  // ── Field updater ─────────────────────────────────────────────────────
  const update = useCallback(<K extends keyof AssessmentData>(field: K, value: AssessmentData[K]) => {
    setData(prev => {
      const next = { ...prev, [field]: value };
      if (field === 'bsaDetached') next.classification = getClassification(value as number);
      return next;
    });
  }, []);

  const updateOrgan = useCallback((key: OrganKey, involved: boolean) => {
    setData(prev => ({ ...prev, organInvolvement: { ...prev.organInvolvement, [key]: involved } }));
  }, []);

  const updateOrganNote = useCallback((key: OrganKey, note: string) => {
    setData(prev => ({ ...prev, organNotes: { ...prev.organNotes, [key]: note } }));
  }, []);

  // ── Calculate SCORTEN ─────────────────────────────────────────────────
  const calculateScore = useCallback(() => {
    const result = burnCareService.calculateSCORTEN({
      age: data.age,
      heartRate: data.heartRate,
      hasMalignancy: data.hasMalignancy,
      bsaDetached: data.bsaDetached,
      serumUrea: data.serumUrea,
      serumBicarbonate: data.serumBicarbonate,
      serumGlucose: data.serumGlucose,
    });
    setScortenResult(result);
  }, [data]);

  // ── Generate comprehensive PDF ────────────────────────────────────────
  const generatePDF = useCallback(() => {
    setGeneratingPDF(true);
    try {
      const score = scortenResult?.score ?? 0;
      const mortality = scortenResult?.predictedMortality ?? 'N/A';
      const doc = createPDF();
      const pageHeight = doc.internal.pageSize.getHeight();
      const pageWidth = doc.internal.pageSize.getWidth();

      // page-break helper
      const pbHandler = createPageBreakHandler(doc, () => {
        // re-add header on new pages
        doc.setFontSize(PDF_FONT_SIZES.footer);
        doc.setFont('times', 'italic');
        doc.setTextColor(PDF_COLORS.gray.r, PDF_COLORS.gray.g, PDF_COLORS.gray.b);
        doc.text(`SJS/TEN Management — ${sanitizeTextForPDF(data.patientName || 'Patient')}`, PDF_MARGINS.left, PDF_MARGINS.top - 3);
        doc.setTextColor(PDF_COLORS.text.r, PDF_COLORS.text.g, PDF_COLORS.text.b);
        return PDF_MARGINS.top + 5;
      });

      const checkBreak = (needed: number) => {
        if (pbHandler.getYPos() + needed > pageHeight - PDF_MARGINS.bottom) {
          doc.addPage();
          pbHandler.setYPos(pbHandler.getYPos()); // triggers header via handler
          const nY = PDF_MARGINS.top + 5;
          doc.setFontSize(PDF_FONT_SIZES.footer);
          doc.setFont('times', 'italic');
          doc.setTextColor(PDF_COLORS.gray.r, PDF_COLORS.gray.g, PDF_COLORS.gray.b);
          doc.text(`SJS/TEN Management — ${sanitizeTextForPDF(data.patientName || 'Patient')}`, PDF_MARGINS.left, PDF_MARGINS.top - 3);
          doc.setTextColor(PDF_COLORS.text.r, PDF_COLORS.text.g, PDF_COLORS.text.b);
          return nY;
        }
        return pbHandler.getYPos();
      };

      let y = addPDFHeader(doc, 'SJS / TEN MANAGEMENT PLAN', `Comprehensive Assessment & Treatment Protocol`);
      y += 2;

      // ── Patient demographics ────────────────────────────────────────
      y = addSectionHeader(doc, '1. PATIENT INFORMATION', y, { underline: true });
      y = addTwoColumnText(doc, 'Name: ', sanitizeTextForPDF(data.patientName || 'N/A'), 'Hospital No: ', sanitizeTextForPDF(data.hospitalNumber || 'N/A'), y);
      y = addTwoColumnText(doc, 'Age: ', `${data.age} years`, 'Sex: ', data.sex, y);
      y = addTwoColumnText(doc, 'Weight: ', `${data.weight} kg`, 'Date of Onset: ', data.dateOfOnset, y);
      y = addTwoColumnText(doc, 'Date of Assessment: ', data.dateOfAssessment, 'Days since drug start: ', `${data.daysSinceDrugStart}`, y);

      const drugName = data.causativeDrug === 'Unknown / Other' && data.otherDrug ? data.otherDrug : data.causativeDrug;
      y = addBodyText(doc, `Suspected Causative Drug: ${sanitizeTextForPDF(drugName || 'Not identified')}`, y, { bold: true });
      y += 3;

      y = addSeparator(doc, y);

      // ── Classification & SCORTEN ────────────────────────────────────
      y = checkBreak(50);
      y = addSectionHeader(doc, '2. CLASSIFICATION & SEVERITY', y, { underline: true });

      // Classification box
      const classColor = data.classification === 'TEN' ? PDF_COLORS.danger :
        data.classification === 'SJS-TEN Overlap' ? PDF_COLORS.warning : PDF_COLORS.primary;
      doc.setFillColor(classColor.r, classColor.g, classColor.b);
      doc.roundedRect(PDF_MARGINS.left, y - 3, 90, 12, 2, 2, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(PDF_FONT_SIZES.subHeader);
      doc.setFont('times', 'bold');
      doc.text(`Classification: ${data.classification}`, PDF_MARGINS.left + 5, y + 4);
      doc.setTextColor(PDF_COLORS.text.r, PDF_COLORS.text.g, PDF_COLORS.text.b);

      // BSA & Nikolsky
      doc.setFontSize(PDF_FONT_SIZES.body);
      doc.setFont('times', 'normal');
      doc.text(`BSA Detached: ${data.bsaDetached}%`, PDF_MARGINS.left + 95, y + 1);
      doc.text(`Nikolsky Sign: ${data.nikolskySign ? 'POSITIVE' : 'Negative'}`, PDF_MARGINS.left + 95, y + 7);
      y += 16;

      // SCORTEN breakdown table
      y = addBodyText(doc, `SCORTEN Score: ${score} / 7   |   Predicted Mortality: ${mortality}`, y, { bold: true });
      y += 2;

      if (scortenResult) {
        // Table header
        doc.setFillColor(14, 80, 60);
        doc.rect(PDF_MARGINS.left, y - 3, pageWidth - PDF_MARGINS.left - PDF_MARGINS.right, 8, 'F');
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(10);
        doc.setFont('times', 'bold');
        doc.text('Criterion', PDF_MARGINS.left + 3, y + 2);
        doc.text('Value', PDF_MARGINS.left + 110, y + 2);
        doc.text('Met?', PDF_MARGINS.left + 155, y + 2);
        y += 8;
        doc.setTextColor(PDF_COLORS.text.r, PDF_COLORS.text.g, PDF_COLORS.text.b);

        scortenResult.breakdown.forEach((item, idx) => {
          if (idx % 2 === 0) {
            doc.setFillColor(245, 245, 245);
            doc.rect(PDF_MARGINS.left, y - 4, pageWidth - PDF_MARGINS.left - PDF_MARGINS.right, 7, 'F');
          }
          doc.setFont('times', 'normal');
          doc.setFontSize(10);
          doc.text(sanitizeTextForPDF(item.criterion), PDF_MARGINS.left + 3, y);
          doc.text(sanitizeTextForPDF(item.value), PDF_MARGINS.left + 110, y);
          doc.setTextColor(item.met ? 220 : 0, item.met ? 38 : 128, item.met ? 38 : 0);
          doc.setFont('times', 'bold');
          doc.text(item.met ? 'YES' : 'No', PDF_MARGINS.left + 155, y);
          doc.setTextColor(PDF_COLORS.text.r, PDF_COLORS.text.g, PDF_COLORS.text.b);
          y += 7;
        });
        y += 3;
      }

      y = addSeparator(doc, y);

      // ── Organ involvement ───────────────────────────────────────────
      y = checkBreak(50);
      y = addSectionHeader(doc, '3. ORGAN INVOLVEMENT', y, { underline: true });

      const involvedOrgans = ORGAN_SYSTEMS.filter(o => data.organInvolvement[o.key]);
      const uninvolvedOrgans = ORGAN_SYSTEMS.filter(o => !data.organInvolvement[o.key]);

      if (involvedOrgans.length > 0) {
        doc.setFont('times', 'bold');
        doc.setFontSize(PDF_FONT_SIZES.body);
        y = addBodyText(doc, 'Affected Systems:', y, { bold: true });
        involvedOrgans.forEach(organ => {
          y = checkBreak(15);
          const note = data.organNotes[organ.key];
          const text = note ? `${organ.label}: ${sanitizeTextForPDF(note)}` : organ.label;
          doc.setFont('times', 'normal');
          doc.setFontSize(PDF_FONT_SIZES.body);
          doc.setTextColor(220, 38, 38);
          doc.text('*', PDF_MARGINS.left + 3, y);
          doc.setTextColor(PDF_COLORS.text.r, PDF_COLORS.text.g, PDF_COLORS.text.b);
          const lines = doc.splitTextToSize(sanitizeTextForPDF(text), pageWidth - PDF_MARGINS.left - PDF_MARGINS.right - 10);
          lines.forEach((line: string) => { doc.text(line, PDF_MARGINS.left + 8, y); y += PDF_LINE_HEIGHT; });
        });
        y += 2;
      }
      if (uninvolvedOrgans.length) {
        y = addBodyText(doc, `Not Involved: ${uninvolvedOrgans.map(o => o.label).join(', ')}`, y, { fontSize: 10 });
      }
      y += 3;
      y = addSeparator(doc, y);

      // ── Management protocol ─────────────────────────────────────────
      y = checkBreak(40);
      y = addSectionHeader(doc, '4. MANAGEMENT PROTOCOL', y, { underline: true, color: PDF_COLORS.primary });

      const protocols = burnCareService.getSJSTENProtocol(score);
      y = addBulletList(doc, protocols, y, { checkPageBreak: (n) => { const ny = checkBreak(n); if (ny !== y) y = ny; return ny !== y; } });
      y += 3;
      y = addSeparator(doc, y);

      // ── Wound care ──────────────────────────────────────────────────
      y = checkBreak(40);
      y = addSectionHeader(doc, '5. WOUND CARE PROTOCOL', y, { underline: true });
      const woundCare = getWoundCareProtocol(data.bsaDetached);
      y = addBulletList(doc, woundCare, y, { checkPageBreak: (n) => { const ny = checkBreak(n); if (ny !== y) y = ny; return ny !== y; } });
      y += 3;
      y = addSeparator(doc, y);

      // ── Systemic therapy ────────────────────────────────────────────
      y = checkBreak(40);
      y = addSectionHeader(doc, '6. SYSTEMIC THERAPY', y, { underline: true });
      const therapy = getSystemicTherapy(score, data.bsaDetached);
      therapy.forEach(line => {
        if (!line) { y += 3; return; }
        y = checkBreak(10);
        if (line.startsWith('STOP ALL') || line.startsWith('IMMUNOMODULATORY') || line.startsWith('CRITICAL CARE')) {
          y = addBodyText(doc, line, y, { bold: true });
        } else {
          y = addBodyText(doc, `- ${line}`, y);
        }
      });
      y += 3;
      y = addSeparator(doc, y);

      // ── Specialist referrals ────────────────────────────────────────
      y = checkBreak(40);
      y = addSectionHeader(doc, '7. SPECIALIST REFERRALS', y, { underline: true });
      const referrals = buildReferrals(data);
      y = addBulletList(doc, referrals, y, { checkPageBreak: (n) => { const ny = checkBreak(n); if (ny !== y) y = ny; return ny !== y; } });
      y += 3;
      y = addSeparator(doc, y);

      // ── Monitoring schedule ─────────────────────────────────────────
      y = checkBreak(40);
      y = addSectionHeader(doc, '8. MONITORING SCHEDULE', y, { underline: true });
      const monitoring = getMonitoringSchedule(score);
      y = addBulletList(doc, monitoring, y, { checkPageBreak: (n) => { const ny = checkBreak(n); if (ny !== y) y = ny; return ny !== y; } });
      y += 3;

      // ── Warning box for high SCORTEN ────────────────────────────────
      if (score >= 3) {
        y = checkBreak(35);
        y = addWarningBox(doc, 'HIGH MORTALITY RISK', [
          `SCORTEN ${score}/7 — Predicted Mortality: ${mortality}`,
          'Multi-disciplinary team discussion mandatory',
          'Early ICU involvement if not already admitted',
          'Discuss prognosis with patient and family',
        ], y);
      }

      // ══════════════════════════════════════════════════════════════════
      // PAGE: PATIENT & FAMILY COUNSELLING DOCUMENT
      // ══════════════════════════════════════════════════════════════════
      doc.addPage();
      y = addPDFHeader(doc, 'PATIENT & FAMILY INFORMATION', 'Stevens-Johnson Syndrome / Toxic Epidermal Necrolysis');
      y += 2;

      y = addBodyText(doc, `Prepared for: ${sanitizeTextForPDF(data.patientName || 'Patient')}     Hospital No: ${sanitizeTextForPDF(data.hospitalNumber || 'N/A')}`, y, { bold: true });
      y = addBodyText(doc, `Date: ${data.dateOfAssessment}     Classification: ${data.classification}`, y);
      y += 3;
      y = addSeparator(doc, y);

      PATIENT_COUNSELLING.forEach(section => {
        y = checkBreak(35);
        y = addSectionHeader(doc, section.heading, y, { underline: true, color: PDF_COLORS.primary });
        y = addBodyText(doc, section.content, y);
        y += 4;
      });

      // Drug allergy card section
      y = checkBreak(50);
      y = addSeparator(doc, y);
      y = addSectionHeader(doc, 'DRUG ALLERGY ALERT CARD (cut along dotted line)', y, { underline: true, color: PDF_COLORS.danger });
      y += 2;

      // Draw dotted border
      doc.setDrawColor(PDF_COLORS.danger.r, PDF_COLORS.danger.g, PDF_COLORS.danger.b);
      doc.setLineDashPattern([2, 2], 0);
      doc.rect(PDF_MARGINS.left, y - 3, pageWidth - PDF_MARGINS.left - PDF_MARGINS.right, 50);
      doc.setLineDashPattern([], 0);

      y += 4;
      doc.setFontSize(14);
      doc.setFont('times', 'bold');
      doc.setTextColor(PDF_COLORS.danger.r, PDF_COLORS.danger.g, PDF_COLORS.danger.b);
      doc.text('DRUG ALLERGY — DO NOT PRESCRIBE', pageWidth / 2, y, { align: 'center' });
      y += 8;
      doc.setTextColor(PDF_COLORS.text.r, PDF_COLORS.text.g, PDF_COLORS.text.b);
      doc.setFontSize(PDF_FONT_SIZES.body);
      doc.setFont('times', 'normal');
      doc.text(`Patient: ${sanitizeTextForPDF(data.patientName || '_______________')}`, PDF_MARGINS.left + 5, y);
      y += 7;
      doc.text(`Hospital No: ${sanitizeTextForPDF(data.hospitalNumber || '_______________')}`, PDF_MARGINS.left + 5, y);
      y += 7;
      doc.setFont('times', 'bold');
      doc.text(`ALLERGIC TO: ${sanitizeTextForPDF(drugName || '_______________')}`, PDF_MARGINS.left + 5, y);
      y += 7;
      doc.setFont('times', 'normal');
      doc.text(`Reaction Type: ${data.classification} (${data.dateOfOnset})`, PDF_MARGINS.left + 5, y);
      y += 7;
      doc.text(`Issuing Hospital: UNTH, Enugu`, PDF_MARGINS.left + 5, y);

      // Additional counselling notes
      if (data.counsellingNotes) {
        y += 15;
        y = checkBreak(25);
        y = addSectionHeader(doc, 'Additional Counselling Notes', y, { underline: true });
        y = addBodyText(doc, sanitizeTextForPDF(data.counsellingNotes), y);
      }

      // Footer on all pages
      addFooter(doc, 'CONFIDENTIAL — SJS/TEN Management Plan');

      // Save
      const filename = `SJS_TEN_Management_${sanitizeTextForPDF(data.patientName || 'Patient').replace(/\s+/g, '_')}_${data.dateOfAssessment}.pdf`;
      doc.save(filename);
    } catch (err) {
      console.error('PDF generation failed:', err);
      alert('Failed to generate PDF. Please try again.');
    } finally {
      setGeneratingPDF(false);
    }
  }, [data, scortenResult]);

  // ══════════════════════════════════════════════════════════════════════
  // RENDER
  // ══════════════════════════════════════════════════════════════════════

  const involvedCount = Object.values(data.organInvolvement).filter(Boolean).length;
  const severityColor = data.classification === 'TEN' ? 'red' : data.classification === 'SJS-TEN Overlap' ? 'yellow' : 'green';
  const severityBg = { red: 'bg-red-50 border-red-300', yellow: 'bg-yellow-50 border-yellow-300', green: 'bg-green-50 border-green-300' }[severityColor];
  const severityText = { red: 'text-red-700', yellow: 'text-yellow-700', green: 'text-green-700' }[severityColor];

  return (
    <div className="max-w-6xl mx-auto p-4 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate(-1)} className="p-2 rounded-lg hover:bg-gray-100"><ArrowLeft size={20} /></button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
              <Shield className="text-purple-600" size={28} />
              SJS / TEN Management Module
            </h1>
            <p className="text-sm text-gray-500">Comprehensive assessment, treatment planning &amp; patient counselling</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={saveAssessment}
            disabled={saving || !data.patientName}
            className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50"
          >
            <Save size={18} />
            {saving ? 'Saving...' : savedId ? 'Update' : 'Save'}
          </button>
          <button
            onClick={generatePDF}
            disabled={generatingPDF || !data.patientName}
            className="flex items-center gap-2 bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 disabled:opacity-50"
          >
            <Download size={18} />
            {generatingPDF ? 'Generating...' : 'Download PDF'}
          </button>
        </div>
      </div>

      {/* Saved Assessments Quick Load */}
      {savedAssessments.length > 0 && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
          <p className="text-sm font-medium text-blue-700 mb-2">Saved Assessments ({savedAssessments.length})</p>
          <div className="flex flex-wrap gap-2">
            {savedAssessments.slice(0, 5).map((a: any) => (
              <button
                key={a.id}
                onClick={() => loadAssessment(a)}
                className="text-xs bg-white border border-blue-300 text-blue-700 px-2 py-1 rounded hover:bg-blue-100"
              >
                {a.patient_name || 'Unknown'} — {a.date_of_assessment?.split('T')[0] || 'N/A'}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Severity banner */}
      {data.bsaDetached > 0 && (
        <div className={`p-4 rounded-lg border-2 ${severityBg} flex items-center justify-between flex-wrap gap-2`}>
          <div className="flex items-center gap-3">
            <AlertTriangle className={severityText} size={24} />
            <div>
              <span className={`font-bold text-lg ${severityText}`}>{data.classification}</span>
              <span className="text-gray-600 ml-2">BSA Detached: {data.bsaDetached}%</span>
            </div>
          </div>
          {scortenResult && (
            <div className="text-right">
              <span className="font-bold text-lg">SCORTEN: {scortenResult.score}/7</span>
              <span className="text-gray-600 ml-2">Mortality: {scortenResult.predictedMortality}</span>
            </div>
          )}
        </div>
      )}

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <div className="flex gap-1">
          {([
            { id: 'assessment' as const, label: 'Assessment', icon: FileText },
            { id: 'management' as const, label: 'Management Plan', icon: Pill },
            { id: 'counselling' as const, label: 'Counselling', icon: Users },
          ]).map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-2 font-medium rounded-t-lg transition-colors
                ${activeTab === tab.id ? 'bg-white border border-b-0 border-gray-200 text-green-700' : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'}`}
            >
              <tab.icon size={16} /> {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* ════════════════════════════════════════════════════════════════════
           TAB 1: ASSESSMENT
         ════════════════════════════════════════════════════════════════════ */}
      {activeTab === 'assessment' && (
        <div className="space-y-6">
          {/* Patient Info */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-lg font-bold mb-4 flex items-center gap-2"><FileText size={18} className="text-purple-600" /> Patient Information</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">Patient Name *</label>
                <input type="text" value={data.patientName} onChange={e => update('patientName', e.target.value)}
                  className="w-full border rounded-lg px-3 py-2" placeholder="Full name" />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Hospital Number</label>
                <input type="text" value={data.hospitalNumber} onChange={e => update('hospitalNumber', e.target.value)}
                  className="w-full border rounded-lg px-3 py-2" placeholder="e.g. UNTH/001234" />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Age (years)</label>
                <input type="number" value={data.age || ''} onChange={e => update('age', parseInt(e.target.value) || 0)}
                  className="w-full border rounded-lg px-3 py-2" min={0} />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Sex</label>
                <select value={data.sex} onChange={e => update('sex', e.target.value as 'Male' | 'Female')}
                  className="w-full border rounded-lg px-3 py-2">
                  <option>Male</option>
                  <option>Female</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Weight (kg)</label>
                <input type="number" value={data.weight || ''} onChange={e => update('weight', parseFloat(e.target.value) || 0)}
                  className="w-full border rounded-lg px-3 py-2" min={0} step={0.1} />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Date of Onset</label>
                <input type="date" value={data.dateOfOnset} onChange={e => update('dateOfOnset', e.target.value)}
                  className="w-full border rounded-lg px-3 py-2" />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Date of Assessment</label>
                <input type="date" value={data.dateOfAssessment} onChange={e => update('dateOfAssessment', e.target.value)}
                  className="w-full border rounded-lg px-3 py-2" />
              </div>
            </div>
          </div>

          {/* Causative Drug */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-lg font-bold mb-4 flex items-center gap-2"><Pill size={18} className="text-red-600" /> Causative Drug Identification</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">Suspected Drug</label>
                <select value={data.causativeDrug} onChange={e => update('causativeDrug', e.target.value)}
                  className="w-full border rounded-lg px-3 py-2">
                  <option value="">-- Select drug --</option>
                  {CAUSATIVE_DRUGS.map(d => <option key={d} value={d}>{d}</option>)}
                </select>
              </div>
              {data.causativeDrug === 'Unknown / Other' && (
                <div>
                  <label className="block text-sm font-medium mb-1">Specify Drug</label>
                  <input type="text" value={data.otherDrug} onChange={e => update('otherDrug', e.target.value)}
                    className="w-full border rounded-lg px-3 py-2" placeholder="Enter drug name" />
                </div>
              )}
              <div>
                <label className="block text-sm font-medium mb-1">Days since drug started</label>
                <input type="number" value={data.daysSinceDrugStart || ''} onChange={e => update('daysSinceDrugStart', parseInt(e.target.value) || 0)}
                  className="w-full border rounded-lg px-3 py-2" min={0} />
              </div>
            </div>
            <p className="text-xs text-gray-500 mt-2">Most reactions occur 1-3 weeks after drug initiation. Allopurinol may take longer.</p>
          </div>

          {/* BSA & Classification */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-lg font-bold mb-4 flex items-center gap-2"><Activity size={18} className="text-orange-600" /> BSA Detachment &amp; Classification</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">BSA Detached (%)</label>
                <input type="number" value={data.bsaDetached || ''} onChange={e => update('bsaDetached', parseFloat(e.target.value) || 0)}
                  className="w-full border rounded-lg px-3 py-2" min={0} max={100} step={0.5} />
                <p className="text-xs text-gray-500 mt-1">Include areas where epidermis easily detaches (Nikolsky positive areas)</p>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Classification (auto-calculated)</label>
                <div className={`w-full border-2 rounded-lg px-3 py-2 font-bold ${severityBg} ${severityText}`}>
                  {data.classification}
                  <span className="text-xs font-normal ml-2">
                    ({data.classification === 'SJS' ? '<10% BSA' : data.classification === 'SJS-TEN Overlap' ? '10-30% BSA' : '>30% BSA'})
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <input type="checkbox" id="nikolsky" checked={data.nikolskySign} onChange={e => update('nikolskySign', e.target.checked)}
                  className="w-4 h-4 rounded text-red-600" />
                <label htmlFor="nikolsky" className="text-sm font-medium">Nikolsky Sign Positive</label>
              </div>
              <div className="flex items-center gap-2">
                <input type="checkbox" id="fever" checked={data.feverOnAdmission} onChange={e => update('feverOnAdmission', e.target.checked)}
                  className="w-4 h-4 rounded text-red-600" />
                <label htmlFor="fever" className="text-sm font-medium">Fever on Admission</label>
              </div>
              {data.feverOnAdmission && (
                <div>
                  <label className="block text-sm font-medium mb-1">Temperature (°C)</label>
                  <input type="number" value={data.temperature} onChange={e => update('temperature', parseFloat(e.target.value) || 37)}
                    className="w-full border rounded-lg px-3 py-2" step={0.1} min={35} max={43} />
                </div>
              )}
              <div>
                <label className="block text-sm font-medium mb-1">Pain Score (0-10)</label>
                <input type="range" value={data.painScore} onChange={e => update('painScore', parseInt(e.target.value))}
                  className="w-full" min={0} max={10} />
                <div className="flex justify-between text-xs text-gray-500"><span>0</span><span className="font-bold text-lg">{data.painScore}</span><span>10</span></div>
              </div>
            </div>
          </div>

          {/* Organ Involvement */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-lg font-bold mb-4 flex items-center gap-2"><Eye size={18} className="text-blue-600" /> Organ Involvement ({involvedCount}/{ORGAN_SYSTEMS.length})</h2>
            <div className="space-y-3">
              {ORGAN_SYSTEMS.map(organ => (
                <div key={organ.key} className={`p-3 rounded-lg border transition-colors ${data.organInvolvement[organ.key] ? 'bg-red-50 border-red-200' : 'bg-gray-50 border-gray-200'}`}>
                  <div className="flex items-center gap-3">
                    <input type="checkbox" checked={data.organInvolvement[organ.key]}
                      onChange={e => updateOrgan(organ.key, e.target.checked)}
                      className="w-5 h-5 rounded text-red-600" />
                    <organ.icon size={18} className={data.organInvolvement[organ.key] ? 'text-red-500' : 'text-gray-400'} />
                    <span className="font-medium">{organ.label}</span>
                  </div>
                  {data.organInvolvement[organ.key] && (
                    <textarea
                      value={data.organNotes[organ.key]}
                      onChange={e => updateOrganNote(organ.key, e.target.value)}
                      className="mt-2 w-full border rounded-lg px-3 py-2 text-sm"
                      rows={2}
                      placeholder={`Describe ${organ.label.toLowerCase()} findings...`}
                    />
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* SCORTEN Calculator */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-lg font-bold mb-4 flex items-center gap-2"><Thermometer size={18} className="text-red-600" /> SCORTEN Severity Score</h2>
            <p className="text-sm text-gray-600 mb-4">
              SCORTEN predicts mortality in SJS/TEN. Age and BSA are taken from above. Enter the remaining parameters:
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">Heart Rate (bpm)</label>
                <input type="number" value={data.heartRate} onChange={e => update('heartRate', parseInt(e.target.value) || 0)}
                  className="w-full border rounded-lg px-3 py-2" min={0} />
                <p className="text-xs text-gray-500 mt-1">Threshold: &ge;120 bpm scores 1</p>
              </div>
              <div className="flex items-center gap-2 self-center">
                <input type="checkbox" id="malignancy" checked={data.hasMalignancy} onChange={e => update('hasMalignancy', e.target.checked)}
                  className="w-4 h-4 rounded text-red-600" />
                <label htmlFor="malignancy" className="text-sm font-medium">Active malignancy / haematological cancer</label>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Serum Urea (mmol/L)</label>
                <input type="number" value={data.serumUrea} onChange={e => update('serumUrea', parseFloat(e.target.value) || 0)}
                  className="w-full border rounded-lg px-3 py-2" step={0.1} min={0} />
                <p className="text-xs text-gray-500 mt-1">Threshold: &gt;10 mmol/L scores 1</p>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Serum Bicarbonate (mmol/L)</label>
                <input type="number" value={data.serumBicarbonate} onChange={e => update('serumBicarbonate', parseFloat(e.target.value) || 0)}
                  className="w-full border rounded-lg px-3 py-2" step={0.1} min={0} />
                <p className="text-xs text-gray-500 mt-1">Threshold: &lt;20 mmol/L scores 1</p>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Serum Glucose (mmol/L)</label>
                <input type="number" value={data.serumGlucose} onChange={e => update('serumGlucose', parseFloat(e.target.value) || 0)}
                  className="w-full border rounded-lg px-3 py-2" step={0.1} min={0} />
                <p className="text-xs text-gray-500 mt-1">Threshold: &gt;14 mmol/L scores 1</p>
              </div>
            </div>

            <button onClick={calculateScore}
              className="mt-4 bg-purple-600 text-white px-6 py-2 rounded-lg hover:bg-purple-700 font-medium">
              Calculate SCORTEN
            </button>

            {scortenResult && (
              <div className="mt-4 space-y-4">
                {/* Score display */}
                <div className={`p-4 rounded-lg border-2 ${
                  scortenResult.score >= 4 ? 'bg-red-50 border-red-400' :
                  scortenResult.score >= 3 ? 'bg-orange-50 border-orange-400' :
                  scortenResult.score >= 2 ? 'bg-yellow-50 border-yellow-400' :
                  'bg-green-50 border-green-400'
                }`}>
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <div>
                      <span className="text-3xl font-bold">{scortenResult.score}</span>
                      <span className="text-lg text-gray-500">/7</span>
                    </div>
                    <div className="text-right">
                      <div className="text-sm text-gray-600">Predicted Mortality</div>
                      <div className="text-2xl font-bold">{scortenResult.predictedMortality}</div>
                    </div>
                  </div>
                </div>

                {/* Breakdown */}
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-100">
                      <tr>
                        <th className="text-left p-2">Criterion</th>
                        <th className="text-left p-2">Value</th>
                        <th className="text-center p-2">Met?</th>
                      </tr>
                    </thead>
                    <tbody>
                      {scortenResult.breakdown.map((item, i) => (
                        <tr key={i} className={i % 2 ? 'bg-gray-50' : ''}>
                          <td className="p-2">{item.criterion}</td>
                          <td className="p-2">{item.value}</td>
                          <td className="p-2 text-center">
                            {item.met ? <CheckCircle className="inline text-red-500" size={18} /> : <span className="text-gray-400">—</span>}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ════════════════════════════════════════════════════════════════════
           TAB 2: MANAGEMENT PLAN
         ════════════════════════════════════════════════════════════════════ */}
      {activeTab === 'management' && (
        <div className="space-y-6">
          {/* Protocol */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-lg font-bold mb-4 flex items-center gap-2"><Shield size={18} className="text-green-600" /> Management Protocol</h2>
            {!scortenResult && (
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-4 flex items-center gap-2">
                <AlertTriangle className="text-yellow-600" size={20} />
                <span className="text-sm text-yellow-700">Calculate SCORTEN in the Assessment tab first for severity-specific recommendations.</span>
              </div>
            )}
            <div className="space-y-2">
              {burnCareService.getSJSTENProtocol(scortenResult?.score ?? 0).map((item, i) => (
                <div key={i} className="flex items-start gap-2 p-2 rounded hover:bg-gray-50">
                  <CheckCircle className="text-green-500 mt-0.5 flex-shrink-0" size={16} />
                  <span className="text-sm">{item}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Wound Care */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-lg font-bold mb-4 flex items-center gap-2"><Activity size={18} className="text-blue-600" /> Wound Care Protocol</h2>
            <div className="space-y-2">
              {getWoundCareProtocol(data.bsaDetached).map((item, i) => (
                <div key={i} className="flex items-start gap-2 p-2 rounded hover:bg-gray-50">
                  <CheckCircle className="text-blue-500 mt-0.5 flex-shrink-0" size={16} />
                  <span className="text-sm">{item}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Systemic Therapy */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-lg font-bold mb-4 flex items-center gap-2"><Pill size={18} className="text-red-600" /> Systemic Therapy</h2>
            <div className="space-y-2">
              {getSystemicTherapy(scortenResult?.score ?? 0, data.bsaDetached).map((item, i) => {
                if (!item) return <div key={i} className="h-2" />;
                const isHeader = item.startsWith('STOP ALL') || item.startsWith('IMMUNOMODULATORY') || item.startsWith('CRITICAL CARE');
                return (
                  <div key={i} className={`flex items-start gap-2 p-2 rounded ${isHeader ? 'bg-red-50 border border-red-200 font-bold' : 'hover:bg-gray-50'}`}>
                    {isHeader ? <AlertTriangle className="text-red-500 mt-0.5 flex-shrink-0" size={16} /> : <span className="text-gray-400 mt-0.5">-</span>}
                    <span className="text-sm">{item}</span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Specialist Referrals */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-lg font-bold mb-4 flex items-center gap-2"><Users size={18} className="text-purple-600" /> Specialist Referrals</h2>
            <div className="space-y-2">
              {buildReferrals(data).map((item, i) => (
                <div key={i} className="flex items-start gap-2 p-2 rounded hover:bg-gray-50">
                  <CheckCircle className="text-purple-500 mt-0.5 flex-shrink-0" size={16} />
                  <span className="text-sm">{item}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Monitoring Schedule */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-lg font-bold mb-4 flex items-center gap-2"><Thermometer size={18} className="text-orange-600" /> Monitoring Schedule</h2>
            <div className="space-y-2">
              {getMonitoringSchedule(scortenResult?.score ?? 0).map((item, i) => (
                <div key={i} className="flex items-start gap-2 p-2 rounded hover:bg-gray-50">
                  <CheckCircle className="text-orange-500 mt-0.5 flex-shrink-0" size={16} />
                  <span className="text-sm">{item}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ════════════════════════════════════════════════════════════════════
           TAB 3: COUNSELLING
         ════════════════════════════════════════════════════════════════════ */}
      {activeTab === 'counselling' && (
        <div className="space-y-6">
          <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
            <h3 className="font-bold text-purple-800 flex items-center gap-2"><BookOpen size={18} /> Patient &amp; Family Counselling</h3>
            <p className="text-sm text-purple-700 mt-1">
              This information is included in the downloadable PDF for patients and relatives. Review and customise before downloading.
            </p>
          </div>

          {PATIENT_COUNSELLING.map((section, i) => (
            <div key={i} className="bg-white rounded-lg shadow p-6">
              <h2 className="text-lg font-bold mb-3 text-gray-900">{section.heading}</h2>
              <p className="text-sm text-gray-700 leading-relaxed">{section.content}</p>
            </div>
          ))}

          {/* Counselling status */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-lg font-bold mb-4">Counselling Documentation</h2>
            <div className="space-y-3">
              <label className="flex items-center gap-3 p-3 rounded-lg border hover:bg-gray-50 cursor-pointer">
                <input type="checkbox" checked={data.patientAware} onChange={e => update('patientAware', e.target.checked)}
                  className="w-5 h-5 rounded text-green-600" />
                <span className="text-sm font-medium">Patient has been informed of the diagnosis and prognosis</span>
              </label>
              <label className="flex items-center gap-3 p-3 rounded-lg border hover:bg-gray-50 cursor-pointer">
                <input type="checkbox" checked={data.familyCounselled} onChange={e => update('familyCounselled', e.target.checked)}
                  className="w-5 h-5 rounded text-green-600" />
                <span className="text-sm font-medium">Family / next-of-kin has been counselled</span>
              </label>
              <div>
                <label className="block text-sm font-medium mb-1">Additional Counselling Notes</label>
                <textarea
                  value={data.counsellingNotes}
                  onChange={e => update('counsellingNotes', e.target.value)}
                  className="w-full border rounded-lg px-3 py-2"
                  rows={4}
                  placeholder="Document any additional counselling points, patient/family questions, or concerns..."
                />
              </div>
            </div>
          </div>

          {/* Drug Allergy Card Preview */}
          <div className="bg-white rounded-lg shadow p-6 border-2 border-dashed border-red-300">
            <h2 className="text-lg font-bold mb-4 text-red-700 flex items-center gap-2">
              <AlertTriangle size={18} /> Drug Allergy Alert Card (included in PDF)
            </h2>
            <div className="bg-red-50 rounded-lg p-4 space-y-2">
              <p className="text-center font-bold text-red-800 text-lg">DRUG ALLERGY — DO NOT PRESCRIBE</p>
              <p className="text-sm"><strong>Patient:</strong> {data.patientName || '_______________'}</p>
              <p className="text-sm"><strong>Hospital No:</strong> {data.hospitalNumber || '_______________'}</p>
              <p className="text-sm font-bold text-red-700">
                ALLERGIC TO: {data.causativeDrug === 'Unknown / Other' && data.otherDrug ? data.otherDrug : data.causativeDrug || '_______________'}
              </p>
              <p className="text-sm"><strong>Reaction Type:</strong> {data.classification} ({data.dateOfOnset})</p>
              <p className="text-sm"><strong>Issuing Hospital:</strong> UNTH, Enugu</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

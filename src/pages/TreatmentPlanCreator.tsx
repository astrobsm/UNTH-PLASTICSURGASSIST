import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  User, Search, Plus, Trash2, ChevronRight, ChevronDown, AlertTriangle,
  CheckCircle, Clock, Calendar, Pill, Activity, FileText, Heart,
  Shield, Apple, Printer, Download, Bell, X, Info, Loader2, Beaker, Camera, Scan
} from 'lucide-react';
import { format, addDays, addWeeks } from 'date-fns';
import { useAuthStore } from '../store/authStore';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { db } from '../db/database';
import { normalizeArrayField } from '../services/patientService';
import { apiClient } from '../services/apiClient';
import { treatmentPlanningService } from '../services/treatmentPlanningService';
import { medicalTeamService } from '../services/medicalTeamService';
import { searchMedications, getMedicationByName, BNFMedication } from '../data/bnfMedications';
import { searchInvestigations, getInvestigationByName } from '../data/investigationDatabase';
import { medicationDosingService } from '../services/medicationDosingService';
import { DocumentScannerModal } from '../components/DocumentScannerModal';
import toast from 'react-hot-toast';

// ─── PRESCRIPTION TEMPLATES ──────────────────────────────────────────────────
const WOUND_CARE_SUPPLEMENTS = [
  { name: 'Vitamin C', dosage: '1g', route: 'oral', frequency: 'OD', duration: 'Until discharge', notes: 'Wound healing supplement' },
  { name: 'Vitamin B Complex', dosage: '2 tablets', route: 'oral', frequency: 'TDS', duration: 'Until discharge', notes: 'Wound healing supplement' },
  { name: 'Zinc Gluconate', dosage: '100mg', route: 'oral', frequency: 'OD', duration: 'Until discharge', notes: 'Wound healing supplement' },
  { name: 'Omega 3 Fatty Acids', dosage: '1 capsule', route: 'oral', frequency: 'BD', duration: 'Until discharge', notes: 'Wound healing supplement' },
  { name: 'Vitamin A', dosage: '20000IU', route: 'oral', frequency: 'OD', duration: 'Until discharge', notes: 'Wound healing supplement' },
  { name: 'Astyfer', dosage: '1 capsule', route: 'oral', frequency: 'OD', duration: 'Until discharge', notes: 'NOT for SCD patients - Iron supplement' },
  { name: 'CAC 1000', dosage: '1 tablet in glass of water', route: 'oral', frequency: 'OD', duration: 'Until discharge', notes: 'Effervescent calcium + vitamin C' },
];

const WOUND_DRESSING_ITEMS = [
  { name: 'Surgical Gloves Size 8.0', quantity: 5, unit: 'pairs' },
  { name: 'Surgical Blade', quantity: 5, unit: 'pcs' },
  { name: 'Hera Wound Gel', quantity: 1, unit: 'tube' },
  { name: 'Wound Care Gauze', quantity: 1, unit: 'pack' },
  { name: 'Plaster Medium', quantity: 1, unit: 'pc' },
  { name: 'Dressing Pack (with instrument)', quantity: 1, unit: 'pc' },
  { name: 'Dressing Pack (without instrument)', quantity: 5, unit: 'pcs' },
  { name: 'Crepe Bandage 6 inches', quantity: 1, unit: 'pc', optional: true, notes: 'If needed' },
  { name: 'Stopain Spray', quantity: 1, unit: 'can' },
];

const WOUND_DEBRIDEMENT_ITEMS = [
  { name: 'Vicryl 2/0', quantity: 1, unit: 'pc' },
  { name: 'Hydrogen Peroxide', quantity: 1, unit: 'bottle' },
  { name: 'Wound Clex Spray', quantity: 1, unit: 'can' },
  { name: 'Surgical Gloves Size 8.0', quantity: 5, unit: 'pairs' },
  { name: 'Surgical Blade', quantity: 5, unit: 'pcs' },
  { name: 'Hera Wound Gel', quantity: 1, unit: 'tube' },
  { name: 'Wound Care Gauze', quantity: 1, unit: 'pack' },
  { name: 'Plaster Medium', quantity: 1, unit: 'pc' },
  { name: 'Dressing Pack (with instrument)', quantity: 1, unit: 'pc' },
  { name: 'Dressing Pack (without instrument)', quantity: 5, unit: 'pcs' },
  { name: 'Crepe Bandage 6 inches', quantity: 1, unit: 'pc', optional: true, notes: 'If needed' },
  { name: 'Stopain Spray', quantity: 1, unit: 'can' },
  { name: 'Xylocaine + Adrenaline', quantity: 1, unit: 'vial' },
  { name: 'Paracetamol Infusion', quantity: 1, unit: 'bag' },
  { name: 'Tramadol Injection 100mg', quantity: 1, unit: 'amp' },
  { name: '5ml Syringe', quantity: 5, unit: 'pcs' },
  { name: '10ml Syringe', quantity: 5, unit: 'pcs' },
];

// ─── DVT RISK ASSESSMENT (CAPRINI SCORE) ─────────────────────────────────────
const DVT_RISK_FACTORS = {
  one_point: [
    'Age 41-60 years', 'Minor surgery planned', 'BMI > 25', 'Swollen legs',
    'Varicose veins', 'Pregnancy or postpartum', 'History of unexplained stillbirth',
    'Oral contraceptives or HRT', 'Sepsis (< 1 month)', 'Serious lung disease including pneumonia (< 1 month)',
    'Abnormal pulmonary function', 'Acute MI', 'CHF (< 1 month)', 'History of IBD',
    'Medical patient currently on bed rest'
  ],
  two_points: [
    'Age 61-74 years', 'Arthroscopic surgery', 'Major open surgery (> 45 min)',
    'Laparoscopic surgery (> 45 min)', 'Malignancy (present or previous)',
    'Confined to bed (> 72 hours)', 'Immobilizing plaster cast',
    'Central venous access'
  ],
  three_points: [
    'Age 75 or older', 'History of DVT/PE', 'Family history of DVT/PE',
    'Factor V Leiden', 'Prothrombin 20210A', 'Lupus anticoagulant',
    'Anticardiolipin antibodies', 'Elevated serum homocysteine',
    'Heparin-induced thrombocytopenia', 'Other congenital or acquired thrombophilia'
  ],
  five_points: [
    'Stroke (< 1 month)', 'Multiple trauma (< 1 month)',
    'Acute spinal cord injury (< 1 month)', 'Major lower extremity arthroplasty'
  ]
};

// ─── PRESSURE SORE RISK (BRADEN SCALE) ───────────────────────────────────────
const BRADEN_CATEGORIES = {
  sensory_perception: { label: 'Sensory Perception', options: [
    { score: 1, label: 'Completely Limited', desc: 'Unresponsive to painful stimuli' },
    { score: 2, label: 'Very Limited', desc: 'Responds only to painful stimuli' },
    { score: 3, label: 'Slightly Limited', desc: 'Responds to verbal commands but cannot always communicate discomfort' },
    { score: 4, label: 'No Impairment', desc: 'Responds to verbal commands, has no sensory deficit' }
  ]},
  moisture: { label: 'Moisture', options: [
    { score: 1, label: 'Constantly Moist', desc: 'Skin is kept moist almost constantly' },
    { score: 2, label: 'Very Moist', desc: 'Skin is often but not always moist' },
    { score: 3, label: 'Occasionally Moist', desc: 'Skin is occasionally moist' },
    { score: 4, label: 'Rarely Moist', desc: 'Skin is usually dry' }
  ]},
  activity: { label: 'Activity', options: [
    { score: 1, label: 'Bedfast', desc: 'Confined to bed' },
    { score: 2, label: 'Chairfast', desc: 'Ability to walk severely limited or nonexistent' },
    { score: 3, label: 'Walks Occasionally', desc: 'Walks occasionally during day, very short distances' },
    { score: 4, label: 'Walks Frequently', desc: 'Walks outside room at least twice a day' }
  ]},
  mobility: { label: 'Mobility', options: [
    { score: 1, label: 'Completely Immobile', desc: 'Does not make even slight changes in position' },
    { score: 2, label: 'Very Limited', desc: 'Makes occasional slight changes in position' },
    { score: 3, label: 'Slightly Limited', desc: 'Makes frequent though slight changes in position' },
    { score: 4, label: 'No Limitation', desc: 'Makes major and frequent changes in position' }
  ]},
  nutrition: { label: 'Nutrition', options: [
    { score: 1, label: 'Very Poor', desc: 'Never eats a complete meal, rarely eats more than 1/3 of food' },
    { score: 2, label: 'Probably Inadequate', desc: 'Rarely eats a complete meal, generally eats only about 1/2 of food' },
    { score: 3, label: 'Adequate', desc: 'Eats over half of most meals' },
    { score: 4, label: 'Excellent', desc: 'Eats most of every meal, never refuses a meal' }
  ]},
  friction_shear: { label: 'Friction & Shear', options: [
    { score: 1, label: 'Problem', desc: 'Requires moderate to maximum assistance in moving' },
    { score: 2, label: 'Potential Problem', desc: 'Moves feebly or requires minimum assistance' },
    { score: 3, label: 'No Apparent Problem', desc: 'Moves in bed independently and has sufficient muscle strength' }
  ]}
};

// ─── NUTRITIONAL RISK (MUST TOOL) ────────────────────────────────────────────
const MUST_CATEGORIES = {
  bmi_score: { label: 'BMI Score', options: [
    { score: 0, label: 'BMI > 20 (>30 obese)', desc: 'Normal/overweight' },
    { score: 1, label: 'BMI 18.5-20', desc: 'Thin' },
    { score: 2, label: 'BMI < 18.5', desc: 'Underweight' }
  ]},
  weight_loss: { label: 'Unplanned Weight Loss in 3-6 months', options: [
    { score: 0, label: '< 5%', desc: 'Minimal or no weight loss' },
    { score: 1, label: '5-10%', desc: 'Moderate weight loss' },
    { score: 2, label: '> 10%', desc: 'Significant weight loss' }
  ]},
  acute_disease: { label: 'Acute Disease Effect', options: [
    { score: 0, label: 'No', desc: 'Not acutely ill with no/negligible nutritional intake for > 5 days' },
    { score: 2, label: 'Yes', desc: 'Acutely ill AND likely no nutritional intake for > 5 days' }
  ]}
};

// ─── WHO DISCHARGE CRITERIA ──────────────────────────────────────────────────
const WHO_DISCHARGE_CRITERIA = [
  { id: 'vital_signs', label: 'Vital signs stable for ≥ 24 hours', category: 'Clinical' },
  { id: 'afebrile', label: 'Afebrile (temp < 37.5°C) for ≥ 24 hours', category: 'Clinical' },
  { id: 'pain_control', label: 'Pain controlled on oral medications', category: 'Clinical' },
  { id: 'oral_intake', label: 'Tolerating oral intake and fluids', category: 'Clinical' },
  { id: 'wound_healing', label: 'Wound clean and healing satisfactorily', category: 'Surgical' },
  { id: 'drain_removed', label: 'Drains removed or output minimal', category: 'Surgical' },
  { id: 'mobility', label: 'Adequate mobility for home care', category: 'Functional' },
  { id: 'self_care', label: 'Able to perform basic self-care or has caregiver', category: 'Functional' },
  { id: 'meds_arranged', label: 'Discharge medications prescribed and understood', category: 'Discharge' },
  { id: 'follow_up', label: 'Follow-up appointment arranged', category: 'Discharge' },
  { id: 'wound_care_education', label: 'Wound care instructions given and understood', category: 'Discharge' },
  { id: 'dvt_prophylaxis', label: 'DVT prophylaxis plan arranged if needed', category: 'Discharge' },
  { id: 'social_support', label: 'Social support at home confirmed', category: 'Social' },
  { id: 'transport', label: 'Transport to home arranged', category: 'Social' },
];

// ─── COMPONENT ───────────────────────────────────────────────────────────────
const TreatmentPlanCreator: React.FC = () => {
  const { user } = useAuthStore();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const preselectedPatientId = searchParams.get('patientId')
    || (() => { try { const c = JSON.parse(localStorage.getItem('selectedPatient') || 'null'); return c?.id ? String(c.id) : null; } catch { return null; } })();

  // ── STATE ──────────────────────────────────────────────────────────────────
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [patients, setPatients] = useState<any[]>([]);
  const [patientSearch, setPatientSearch] = useState('');
  const [showPatientDropdown, setShowPatientDropdown] = useState(false);
  const patientSearchRef = useRef<HTMLDivElement>(null);

  // Step 1: Patient & Team
  const [selectedPatient, setSelectedPatient] = useState<any>(null);
  const [medicalTeam, setMedicalTeam] = useState({ senior_registrar: '', registrar: '', house_officer: '', sr_name: '', reg_name: '', ho_name: '' });
  const [staffLists, setStaffLists] = useState<{ sr: any[]; reg: any[]; ho: any[] }>({ sr: [], reg: [], ho: [] });
  const [diagnosis, setDiagnosis] = useState('');
  const [clinicalSummary, setClinicalSummary] = useState('');
  const [admissionDate, setAdmissionDate] = useState(format(new Date(), 'yyyy-MM-dd'));

  // Step 2: Risk Assessments
  const [dvtFactors, setDvtFactors] = useState<string[]>([]);
  const [bradenScores, setBradenScores] = useState<Record<string, number>>({
    sensory_perception: 4, moisture: 4, activity: 4, mobility: 4, nutrition: 3, friction_shear: 3
  });
  const [mustScores, setMustScores] = useState<Record<string, number>>({
    bmi_score: 0, weight_loss: 0, acute_disease: 0
  });
  const [comorbidities, setComorbidities] = useState<string[]>([]);
  const [newComorbidity, setNewComorbidity] = useState('');

  // Step 3: Procedures
  const [procedures, setProcedures] = useState<any[]>([]);
  const [newProc, setNewProc] = useState({ name: '', type: 'minor', date: format(addDays(new Date(), 3), 'yyyy-MM-dd'), time: '08:00', frequency: 'once', surgeon: '', notes: '' });

  // Step 4: Investigations
  const [investigations, setInvestigations] = useState<any[]>([]);
  const [invSearch, setInvSearch] = useState('');
  const [invSuggestions, setInvSuggestions] = useState<any[]>([]);
  const [newInv, setNewInv] = useState({ name: '', type: 'lab', frequency: 'once', repeat_count: 1, target_range: '', notes: '' });

  // Step 5: Prescriptions
  const [medications, setMedications] = useState<any[]>([]);
  const [medSearch, setMedSearch] = useState('');
  const [medSuggestions, setMedSuggestions] = useState<any[]>([]);
  const [newMed, setNewMed] = useState({ name: '', dosage: '', route: 'oral', frequency: 'OD', duration: '7 days', notes: '' });
  const [woundDressing, setWoundDressing] = useState<any[]>([]);
  const [woundDebridement, setWoundDebridement] = useState<any[]>([]);

  // Step 6: Ward Rounds & Reviews
  const [reviewFrequency, setReviewFrequency] = useState('daily');
  const [reviewDays, setReviewDays] = useState<Record<string, boolean>>({
    monday: true, tuesday: true, wednesday: true, thursday: true, friday: true, saturday: false, sunday: false
  });
  const [reviewAssignee, setReviewAssignee] = useState('house_officer');

  // Step 7: Discharge
  const [plannedDischargeDate, setPlannedDischargeDate] = useState(format(addWeeks(new Date(), 1), 'yyyy-MM-dd'));
  const [dischargeCriteriaMet, setDischargeCriteriaMet] = useState<string[]>([]);

  // OCR Scanner
  const [ocrModal, setOcrModal] = useState<'clinical' | 'investigation' | 'prescription' | null>(null);

  // ── COMPUTED VALUES ────────────────────────────────────────────────────────
  const dvtScore = useMemo(() => {
    let score = 0;
    dvtFactors.forEach(f => {
      if (DVT_RISK_FACTORS.one_point.includes(f)) score += 1;
      if (DVT_RISK_FACTORS.two_points.includes(f)) score += 2;
      if (DVT_RISK_FACTORS.three_points.includes(f)) score += 3;
      if (DVT_RISK_FACTORS.five_points.includes(f)) score += 5;
    });
    return score;
  }, [dvtFactors]);

  const dvtRisk = useMemo(() => {
    if (dvtScore === 0) return { level: 'Low', color: 'green', prophylaxis: 'Early ambulation only' };
    if (dvtScore <= 2) return { level: 'Moderate', color: 'yellow', prophylaxis: 'Enoxaparin 40mg SC OD or TED stockings + early ambulation' };
    if (dvtScore <= 4) return { level: 'High', color: 'orange', prophylaxis: 'Enoxaparin 40mg SC OD + TED stockings + IPC + early ambulation' };
    return { level: 'Very High', color: 'red', prophylaxis: 'Enoxaparin 40mg SC BD + TED stockings + IPC + early ambulation + consider IVC filter' };
  }, [dvtScore]);

  const bradenTotal = useMemo(() => Object.values(bradenScores).reduce((a, b) => a + b, 0), [bradenScores]);
  const bradenRisk = useMemo(() => {
    if (bradenTotal <= 9) return { level: 'Very High Risk', color: 'red' };
    if (bradenTotal <= 12) return { level: 'High Risk', color: 'orange' };
    if (bradenTotal <= 14) return { level: 'Moderate Risk', color: 'yellow' };
    if (bradenTotal <= 18) return { level: 'Mild Risk', color: 'blue' };
    return { level: 'No Risk', color: 'green' };
  }, [bradenTotal]);

  const mustTotal = useMemo(() => Object.values(mustScores).reduce((a, b) => a + b, 0), [mustScores]);
  const mustRisk = useMemo(() => {
    if (mustTotal === 0) return { level: 'Low Risk', color: 'green', action: 'Routine clinical care' };
    if (mustTotal === 1) return { level: 'Medium Risk', color: 'yellow', action: 'Observe - Document dietary intake for 3 days, if adequate, little concern' };
    return { level: 'High Risk', color: 'red', action: 'Treat - Refer to dietitian, set goals, improve and increase nutritional intake, monitor and review care plan' };
  }, [mustTotal]);

  const dischargeScore = useMemo(() => {
    const total = WHO_DISCHARGE_CRITERIA.length;
    const met = dischargeCriteriaMet.length;
    return { met, total, percent: Math.round((met / total) * 100) };
  }, [dischargeCriteriaMet]);

  // ── EFFECTS ────────────────────────────────────────────────────────────────
  useEffect(() => {
    loadPatients();
    loadStaff();
  }, []);

  useEffect(() => {
    if (preselectedPatientId && patients.length > 0) {
      const p = patients.find((pt: any) => String(pt.id) === preselectedPatientId || String(pt.serverId) === preselectedPatientId);
      if (p) selectPatient(p);
    }
  }, [preselectedPatientId, patients]);

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (patientSearchRef.current && !patientSearchRef.current.contains(e.target as Node)) setShowPatientDropdown(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const loadPatients = async () => {
    try {
      const localPatients = await db.patients.toArray();
      const serverPatients = navigator.onLine ? await apiClient.getPatients().catch(() => []) : [];
      const merged = [...localPatients];
      (Array.isArray(serverPatients) ? serverPatients : (serverPatients as any)?.patients || []).forEach((sp: any) => {
        if (!merged.find(lp => String(lp.id) === String(sp.id) || String(lp.serverId) === String(sp.id))) merged.push(sp);
      });
      setPatients(merged);
    } catch { setPatients([]); }
    setLoading(false);
  };

  const loadStaff = async () => {
    try {
      const [sr, reg, ho] = await Promise.all([
        medicalTeamService.getStaffByRole('senior_registrar').catch(() => []),
        medicalTeamService.getStaffByRole('registrar').catch(() => []),
        medicalTeamService.getStaffByRole('house_officer').catch(() => [])
      ]);
      setStaffLists({ sr, reg, ho });
      // Auto-assign least loaded
      const suggestions = await medicalTeamService.getSuggestedTeamAssignment().catch(() => ({} as any));
      setMedicalTeam({
        senior_registrar: suggestions.senior_registrar ? String(suggestions.senior_registrar.id) : sr[0]?.id ? String(sr[0].id) : '',
        registrar: suggestions.registrar ? String(suggestions.registrar.id) : reg[0]?.id ? String(reg[0].id) : '',
        house_officer: suggestions.house_officer ? String(suggestions.house_officer.id) : ho[0]?.id ? String(ho[0].id) : '',
        sr_name: suggestions.senior_registrar?.full_name || sr[0]?.full_name || '',
        reg_name: suggestions.registrar?.full_name || reg[0]?.full_name || '',
        ho_name: suggestions.house_officer?.full_name || ho[0]?.full_name || ''
      });
    } catch (e) { console.warn('Staff load error:', e); }
  };

  const selectPatient = (p: any) => {
    setSelectedPatient(p);
    setPatientSearch(p.full_name || p.name || `${p.first_name || ''} ${p.last_name || ''}`.trim());
    setShowPatientDropdown(false);
    // Load comorbidities from patient data
    const co = p.comorbidities || p.medical_history || [];
    setComorbidities(normalizeArrayField(co));
    if (p.diagnosis) setDiagnosis(p.diagnosis);
  };

  const filteredPatients = useMemo(() => {
    if (!patientSearch.trim()) return patients.slice(0, 20);
    const q = patientSearch.toLowerCase();
    return patients.filter(p => {
      const name = (p.full_name || p.name || `${p.first_name || ''} ${p.last_name || ''}`).toLowerCase();
      const hn = (p.hospital_number || '').toLowerCase();
      return name.includes(q) || hn.includes(q);
    }).slice(0, 15);
  }, [patientSearch, patients]);

  // BNF medication search
  useEffect(() => {
    if (medSearch.length >= 2) setMedSuggestions(searchMedications(medSearch).slice(0, 10));
    else setMedSuggestions([]);
  }, [medSearch]);

  // Investigation search
  useEffect(() => {
    if (invSearch.length >= 2) setInvSuggestions(searchInvestigations(invSearch).slice(0, 10));
    else setInvSuggestions([]);
  }, [invSearch]);

  const selectMedFromBNF = (med: BNFMedication) => {
    setNewMed({
      name: med.name,
      dosage: med.dosages[0]?.adult || '',
      route: (med.routes[0] || 'oral').toLowerCase() as any,
      frequency: med.frequencies[0] || 'OD',
      duration: '7 days',
      notes: med.warnings.length > 0 ? `⚠️ ${med.warnings[0]}` : ''
    });
    setMedSearch('');
    setMedSuggestions([]);
  };

  const addMedication = () => {
    if (!newMed.name) return;
    setMedications([...medications, { ...newMed, id: `med_${Date.now()}`, status: 'active', start_date: new Date() }]);
    setNewMed({ name: '', dosage: '', route: 'oral', frequency: 'OD', duration: '7 days', notes: '' });
  };

  const addWoundCareSupplements = () => {
    const hasAstyfer = comorbidities.some(c => c.toLowerCase().includes('sickle') || c.toLowerCase().includes('scd'));
    const supplements = WOUND_CARE_SUPPLEMENTS.filter(s => !(hasAstyfer && s.name === 'Astyfer')).map(s => ({
      ...s, id: `med_${Date.now()}_${Math.random().toString(36).slice(2)}`, status: 'active', start_date: new Date()
    }));
    setMedications(prev => [...prev, ...supplements]);
    toast.success(`Added ${supplements.length} wound care supplements`);
  };

  const addWoundDressingPrescription = () => {
    setWoundDressing(WOUND_DRESSING_ITEMS.map(i => ({ ...i, id: `wd_${Date.now()}_${Math.random().toString(36).slice(2)}` })));
    toast.success('Wound dressing prescription added');
  };

  const addWoundDebridementPrescription = () => {
    setWoundDebridement(WOUND_DEBRIDEMENT_ITEMS.map(i => ({ ...i, id: `wdb_${Date.now()}_${Math.random().toString(36).slice(2)}` })));
    toast.success('Wound debridement prescription added');
  };

  const selectInvFromDB = (inv: any) => {
    setNewInv({ name: inv.name, type: inv.category === 'Imaging' ? 'imaging' : 'lab', frequency: 'once', repeat_count: 1, target_range: inv.normalRange || '', notes: '' });
    setInvSearch('');
    setInvSuggestions([]);
  };

  const addInvestigation = () => {
    if (!newInv.name) return;
    setInvestigations([...investigations, { ...newInv, id: `inv_${Date.now()}`, status: 'pending', ordered_date: new Date() }]);
    setNewInv({ name: '', type: 'lab', frequency: 'once', repeat_count: 1, target_range: '', notes: '' });
  };

  const addProcedure = () => {
    if (!newProc.name) return;
    setProcedures([...procedures, { ...newProc, id: `proc_${Date.now()}`, status: 'planned' }]);
    setNewProc({ name: '', type: 'minor', date: format(addDays(new Date(), 3), 'yyyy-MM-dd'), time: '08:00', frequency: 'once', surgeon: '', notes: '' });
  };

  // ── AUTO-GENERATE PROTOCOLS ────────────────────────────────────────────────
  const generateDVTProphylaxis = () => {
    const meds: any[] = [];
    if (dvtScore >= 1) {
      meds.push({ name: 'Enoxaparin (Clexane)', dosage: dvtScore >= 5 ? '40mg BD' : '40mg OD', route: 'SC', frequency: dvtScore >= 5 ? 'BD' : 'OD', duration: 'Until ambulant/discharge', notes: `DVT prophylaxis - Caprini score: ${dvtScore} (${dvtRisk.level})`, id: `med_dvt_${Date.now()}`, status: 'active', start_date: new Date() });
    }
    if (dvtScore >= 3) {
      const procItems = [
        { name: 'TED Stockings Application', type: 'therapeutic', date: format(new Date(), 'yyyy-MM-dd'), time: '08:00', frequency: 'daily', surgeon: '', notes: 'DVT prophylaxis', id: `proc_ted_${Date.now()}`, status: 'planned' },
        { name: 'Intermittent Pneumatic Compression (IPC)', type: 'therapeutic', date: format(new Date(), 'yyyy-MM-dd'), time: '08:00', frequency: 'daily', surgeon: '', notes: 'DVT prophylaxis', id: `proc_ipc_${Date.now()}`, status: 'planned' }
      ];
      setProcedures(prev => [...prev, ...procItems]);
    }
    // Always add early ambulation
    setProcedures(prev => [...prev, { name: 'Early Ambulation', type: 'therapeutic', date: format(new Date(), 'yyyy-MM-dd'), time: '06:00', frequency: 'daily', surgeon: '', notes: `DVT prophylaxis - commence post-op day 1`, id: `proc_amb_${Date.now()}`, status: 'planned' }]);
    if (meds.length > 0) setMedications(prev => [...prev, ...meds]);
    toast.success(`DVT prophylaxis plan generated (Caprini: ${dvtScore}, ${dvtRisk.level} risk)`);
  };

  const generatePressureSorePrevention = () => {
    const protocol: any[] = [];
    if (bradenTotal <= 18) {
      protocol.push({ name: '2-Hourly Repositioning', type: 'therapeutic', date: format(new Date(), 'yyyy-MM-dd'), time: '00:00', frequency: 'daily', surgeon: '', notes: `Pressure sore prevention - Braden: ${bradenTotal} (${bradenRisk.level})`, id: `proc_repo_${Date.now()}`, status: 'planned' });
      protocol.push({ name: 'Skin Assessment & Moisturizing', type: 'therapeutic', date: format(new Date(), 'yyyy-MM-dd'), time: '08:00', frequency: 'daily', surgeon: '', notes: 'Daily skin integrity check - pressure points', id: `proc_skin_${Date.now()}`, status: 'planned' });
    }
    if (bradenTotal <= 14) {
      protocol.push({ name: 'Pressure-Relieving Mattress', type: 'therapeutic', date: format(new Date(), 'yyyy-MM-dd'), time: '08:00', frequency: 'once', surgeon: '', notes: 'Alternating pressure mattress required', id: `proc_matt_${Date.now()}`, status: 'planned' });
      protocol.push({ name: 'Heel Elevation with Pillow', type: 'therapeutic', date: format(new Date(), 'yyyy-MM-dd'), time: '08:00', frequency: 'daily', surgeon: '', notes: 'Offload heels at all times', id: `proc_heel_${Date.now()}`, status: 'planned' });
    }
    if (bradenTotal <= 12) {
      setMedications(prev => [...prev, { name: 'Barrier Cream (Zinc Oxide)', dosage: 'Apply liberally', route: 'topical', frequency: 'TDS', duration: 'Until discharge', notes: 'Apply to all pressure areas TDS', id: `med_barrier_${Date.now()}`, status: 'active', start_date: new Date() }]);
    }
    if (protocol.length > 0) setProcedures(prev => [...prev, ...protocol]);
    toast.success(`Pressure sore prevention protocol generated (Braden: ${bradenTotal})`);
  };

  const generateNutritionalPlan = () => {
    const hasDiabetes = comorbidities.some(c => /diabet|dm|glyc/i.test(c));
    const hasRenal = comorbidities.some(c => /renal|kidney|ckd|dialysis/i.test(c));
    const hasHeart = comorbidities.some(c => /heart|cardiac|chf|ccf/i.test(c));
    const isBurn = comorbidities.some(c => /burn/i.test(c)) || diagnosis.toLowerCase().includes('burn');

    let calTarget = '2000-2500 kcal/day';
    let proteinTarget = '1.2-1.5 g/kg/day';
    let fluidTarget = '2-2.5L/day';
    if (isBurn) { calTarget = '3000-4000 kcal/day'; proteinTarget = '2-2.5 g/kg/day'; fluidTarget = 'As per Parkland formula + maintenance'; }
    if (hasRenal) { proteinTarget = '0.6-0.8 g/kg/day'; fluidTarget = '1-1.5L/day (fluid restrict)'; }
    if (hasHeart) { fluidTarget = '1.5L/day (fluid restrict)'; }

    const mealPlan = {
      targets: { calories: calTarget, protein: proteinTarget, fluid: fluidTarget },
      days: Array.from({ length: 7 }, (_, i) => ({
        day: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'][i],
        meals: {
          breakfast: hasDiabetes
            ? 'Whole grain oats with nuts + boiled eggs (2) + low-sugar fruit (apple/pear)'
            : 'Pap/oats with milk + eggs (2) + banana + tea with honey',
          mid_morning: 'Fresh fruit (orange/watermelon) + handful of groundnuts',
          lunch: hasRenal
            ? `White rice + grilled ${['chicken', 'fish', 'turkey', 'chicken', 'fish', 'turkey', 'chicken'][i]} + steamed vegetables (small portion)`
            : `${['Rice', 'Pasta', 'Amala', 'Rice', 'Semovita', 'Tuwo', 'Rice'][i]} + ${['Chicken stew', 'Fish pepper soup', 'Egusi soup + beef', 'Vegetable soup + fish', 'Okra soup + chicken', 'Beans + plantain', 'Jollof rice + chicken'][i]}`,
          mid_afternoon: hasDiabetes ? 'Sugar-free yogurt + cucumber slices' : 'Yogurt + biscuit/chin-chin',
          dinner: `Light soup + ${['bread', 'moi-moi', 'yam', 'bread', 'potato', 'plantain', 'noodles'][i]} + boiled ${['egg', 'fish', 'chicken', 'egg', 'fish', 'chicken', 'egg'][i]}`,
          supper: 'Warm milk/milo + crackers/digestive biscuit',
          fruits: ['Watermelon', 'Orange + pawpaw', 'Banana + apple', 'Pineapple', 'Guava + grape', 'Mango', 'Mixed fruit'][i],
        },
        water: hasRenal || hasHeart ? '200ml x 6-8 glasses (max 1.5L)' : '300ml x 8-10 glasses (2.5L min)',
      })),
      notes: [
        hasDiabetes ? '⚠️ DIABETIC: Avoid refined sugars, white bread, sweet drinks. Monitor blood glucose before meals.' : '',
        hasRenal ? '⚠️ RENAL: Low potassium, low phosphate, restrict protein. Avoid oranges, bananas, tomatoes.' : '',
        hasHeart ? '⚠️ CARDIAC: Low salt diet (< 2g/day). Fluid restriction 1.5L/day. Avoid processed foods.' : '',
        isBurn ? '⚠️ BURN: High calorie, high protein diet. Frequent small meals. Ensure adequate micronutrients.' : '',
        'Ensure adequate protein at each meal for wound healing',
        'Fruit intake minimum 3 servings per day',
        'Avoid skipping meals - maintain regular eating schedule',
      ].filter(Boolean)
    };

    // Store meal plan in notes for now
    localStorage.setItem(`meal_plan_${selectedPatient?.id}`, JSON.stringify(mealPlan));
    toast.success('7-day nutritional meal plan generated. View in plan details.');
    return mealPlan;
  };

  // ── SAVE PLAN ──────────────────────────────────────────────────────────────
  const savePlan = async () => {
    if (!selectedPatient) { toast.error('Please select a patient'); return; }
    if (!diagnosis) { toast.error('Please enter diagnosis'); return; }
    setSaving(true);

    try {
      const planData = {
        patient_id: String(selectedPatient.id || selectedPatient.serverId),
        patient_name: selectedPatient.full_name || selectedPatient.name || `${selectedPatient.first_name || ''} ${selectedPatient.last_name || ''}`.trim(),
        hospital_number: selectedPatient.hospital_number || '',
        title: `Treatment Plan - ${diagnosis}`,
        diagnosis,
        description: clinicalSummary,
        admission_date: new Date(admissionDate),
        status: 'active' as const,
        medical_team: {
          senior_registrar: medicalTeam.sr_name || medicalTeam.senior_registrar,
          registrar: medicalTeam.reg_name || medicalTeam.registrar,
          house_officer: medicalTeam.ho_name || medicalTeam.house_officer,
          assigned_date: new Date()
        },
        planned_medications: medications,
        planned_investigations: investigations.map(inv => ({
          ...inv,
          investigation_name: inv.name,
          investigation_type: inv.type,
          ordered_date: inv.ordered_date || new Date(),
          scheduled_dates: [],
        })),
        planned_procedures: procedures.map(proc => ({
          ...proc,
          procedure_name: proc.name,
          procedure_type: proc.type,
          proposed_date: new Date(proc.date),
          proposed_time: proc.time,
        })),
        planned_reviews: [{
          id: `review_${Date.now()}`,
          review_type: reviewFrequency,
          days_of_week: reviewDays,
          start_date: new Date(),
          assigned_to: reviewAssignee,
          assigned_person_name: reviewAssignee === 'house_officer' ? medicalTeam.ho_name : reviewAssignee === 'registrar' ? medicalTeam.reg_name : medicalTeam.sr_name,
          completed_reviews: [],
          missed_reviews: [],
          status: 'active' as const
        }],
        discharge_plan: {
          id: `dp_${Date.now()}`,
          initial_discharge_date: new Date(plannedDischargeDate),
          current_discharge_date: new Date(plannedDischargeDate),
          discharge_criteria: WHO_DISCHARGE_CRITERIA.map(c => c.label),
          criteria_met: dischargeCriteriaMet.map(id => WHO_DISCHARGE_CRITERIA.find(c => c.id === id)?.label || ''),
          criteria_pending: WHO_DISCHARGE_CRITERIA.filter(c => !dischargeCriteriaMet.includes(c.id)).map(c => c.label),
          extensions: [],
          status: 'planned' as const
        },
        risk_assessments: {
          dvt: { score: dvtScore, risk: dvtRisk.level, factors: dvtFactors, assessed_at: new Date() },
          pressure_sore: { score: bradenTotal, risk: bradenRisk.level, scores: bradenScores, assessed_at: new Date() },
          nutritional: { score: mustTotal, risk: mustRisk.level, scores: mustScores, assessed_at: new Date() }
        },
        comorbidities,
        wound_dressing_prescription: woundDressing,
        wound_debridement_prescription: woundDebridement,
        notes: clinicalSummary,
        created_by: user?.name || 'Unknown',
      };

      await treatmentPlanningService.createTreatmentPlan(planData);

      // Send notification to team
      try {
        const { notificationService } = await import('../services/notificationBackgroundService');
        notificationService.sendNotification('New Treatment Plan Created', {
          body: `${planData.patient_name} - ${diagnosis}. Assigned: HO: ${medicalTeam.ho_name}`,
          tag: 'treatment-plan-new',
          requireInteraction: true
        });
      } catch { /* notifications optional */ }

      toast.success('Treatment plan created successfully!');
      navigate('/treatment-plan-manager');
    } catch (err: any) {
      console.error('Save error:', err);
      toast.error('Failed to save: ' + (err.message || 'Unknown error'));
    } finally {
      setSaving(false);
    }
  };

  // ── OCR FIELD EXTRACTION HANDLERS ────────────────────────────────────────
  const handleOCRFields = (fields: Record<string, any>) => {
    if (ocrModal === 'clinical') {
      if (fields.diagnosis || fields.primary_diagnosis) {
        setDiagnosis(prev => prev || fields.diagnosis || fields.primary_diagnosis || '');
      }
      if (fields.clinical_summary || fields.history || fields.presenting_complaint || fields.notes) {
        const summary = fields.clinical_summary || fields.history || fields.presenting_complaint || fields.notes || '';
        setClinicalSummary(prev => prev ? `${prev}\n${summary}` : summary);
      }
      if (fields.comorbidities && Array.isArray(fields.comorbidities)) {
        setComorbidities(prev => [...new Set([...prev, ...fields.comorbidities])]);
      }
      toast.success('Clinical notes extracted from scan');
    } else if (ocrModal === 'investigation') {
      const extracted: any[] = [];
      if (Array.isArray(fields.investigations)) {
        fields.investigations.forEach((inv: any) => {
          extracted.push({
            id: Date.now() + Math.random(),
            name: inv.name || inv.test_name || 'Unknown',
            type: inv.type || 'lab',
            frequency: 'once',
            repeat_count: 1,
            target_range: inv.reference_range || inv.normal_range || '',
            notes: inv.result ? `Previous result: ${inv.result}${inv.unit ? ' ' + inv.unit : ''}` : '',
          });
        });
      } else if (Array.isArray(fields.results)) {
        fields.results.forEach((r: any) => {
          extracted.push({
            id: Date.now() + Math.random(),
            name: r.test_name || r.name || 'Unknown',
            type: 'lab',
            frequency: 'once',
            repeat_count: 1,
            target_range: r.reference_range || '',
            notes: r.result_value ? `Previous: ${r.result_value}${r.unit ? ' ' + r.unit : ''}` : '',
          });
        });
      }
      if (extracted.length > 0) {
        setInvestigations(prev => [...prev, ...extracted]);
        toast.success(`${extracted.length} investigation(s) extracted from scan`);
      } else {
        toast.error('No investigations could be extracted from this scan');
      }
    } else if (ocrModal === 'prescription') {
      const extracted: any[] = [];
      if (Array.isArray(fields.medications)) {
        fields.medications.forEach((med: any) => {
          extracted.push({
            id: Date.now() + Math.random(),
            name: med.name || med.drug_name || 'Unknown',
            dosage: med.dosage || med.dose || '',
            route: med.route || 'oral',
            frequency: med.frequency || 'OD',
            duration: med.duration || '7 days',
            notes: med.notes || med.instructions || '',
          });
        });
      }
      if (extracted.length > 0) {
        setMedications(prev => [...prev, ...extracted]);
        toast.success(`${extracted.length} medication(s) extracted from scan`);
      } else {
        toast.error('No medications could be extracted from this scan');
      }
    }
    setOcrModal(null);
  };

  // ── STEP TITLES ────────────────────────────────────────────────────────────
  const steps = [
    { num: 1, title: 'Patient & Team', icon: <User className="w-4 h-4" /> },
    { num: 2, title: 'Risk Assessment', icon: <Shield className="w-4 h-4" /> },
    { num: 3, title: 'Procedures', icon: <Activity className="w-4 h-4" /> },
    { num: 4, title: 'Investigations', icon: <Beaker className="w-4 h-4" /> },
    { num: 5, title: 'Prescriptions', icon: <Pill className="w-4 h-4" /> },
    { num: 6, title: 'Reviews & Rounds', icon: <Clock className="w-4 h-4" /> },
    { num: 7, title: 'Discharge', icon: <Heart className="w-4 h-4" /> },
  ];

  if (loading) return <div className="flex items-center justify-center min-h-screen"><Loader2 className="w-8 h-8 animate-spin text-green-600" /></div>;

  // ── RENDER ─────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      {/* Header */}
      <div className="bg-white border-b px-4 py-3 sticky top-0 z-30">
        <div className="flex items-center justify-between max-w-5xl mx-auto">
          <h1 className="text-lg font-bold text-gray-900">Create Treatment Plan</h1>
          <button onClick={() => navigate(-1)} className="text-gray-500 hover:text-gray-700"><X className="w-5 h-5" /></button>
        </div>
      </div>

      {/* Step Progress */}
      <div className="bg-white border-b px-4 py-2 overflow-x-auto">
        <div className="flex gap-1 max-w-5xl mx-auto min-w-max">
          {steps.map(s => (
            <button key={s.num} onClick={() => setStep(s.num)}
              className={`flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-all ${
                step === s.num ? 'bg-green-600 text-white' : s.num < step ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
              }`}>
              {s.num < step ? <CheckCircle className="w-3.5 h-3.5" /> : s.icon}
              <span className="hidden sm:inline">{s.title}</span>
              <span className="sm:hidden">{s.num}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="max-w-5xl mx-auto p-4 space-y-4">

        {/* ─── STEP 1: PATIENT & TEAM ─── */}
        {step === 1 && (
          <div className="space-y-4">
            <div className="bg-white rounded-xl shadow-sm border p-4 space-y-4">
              <h2 className="text-base font-semibold flex items-center gap-2"><User className="w-5 h-5 text-green-600" /> Select Patient</h2>
              <div ref={patientSearchRef} className="relative">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input value={patientSearch} onChange={e => { setPatientSearch(e.target.value); setShowPatientDropdown(true); }}
                    onFocus={() => setShowPatientDropdown(true)}
                    placeholder="Search patient by name or hospital number..."
                    className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-green-500 focus:border-green-500" />
                </div>
                {showPatientDropdown && filteredPatients.length > 0 && (
                  <div className="absolute z-20 top-full left-0 right-0 mt-1 bg-white border rounded-lg shadow-lg max-h-60 overflow-y-auto">
                    {filteredPatients.map(p => (
                      <button key={p.id} onClick={() => selectPatient(p)}
                        className="w-full px-4 py-2.5 text-left hover:bg-green-50 border-b last:border-0 flex justify-between items-center">
                        <div>
                          <div className="text-sm font-medium text-gray-900">{p.full_name || p.name || `${p.first_name || ''} ${p.last_name || ''}`}</div>
                          <div className="text-xs text-gray-500">{p.hospital_number || 'No HN'} • {p.ward || ''}</div>
                        </div>
                        <ChevronRight className="w-4 h-4 text-gray-300" />
                      </button>
                    ))}
                  </div>
                )}
              </div>
              {selectedPatient && (
                <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-green-600 text-white flex items-center justify-center font-bold">
                      {(selectedPatient.full_name || selectedPatient.name || 'P')[0]}
                    </div>
                    <div>
                      <div className="font-medium">{selectedPatient.full_name || selectedPatient.name}</div>
                      <div className="text-xs text-gray-600">HN: {selectedPatient.hospital_number} • Ward: {selectedPatient.ward || 'N/A'} • Age: {(() => {
                        const dob = selectedPatient.date_of_birth || selectedPatient.dob;
                        if (selectedPatient.age) return `${selectedPatient.age}y`;
                        if (!dob) return 'N/A';
                        const d = new Date(dob);
                        if (isNaN(d.getTime())) return 'N/A';
                        const ageMs = Date.now() - d.getTime();
                        const years = Math.floor(ageMs / (365.25 * 24 * 3600 * 1000));
                        return years >= 0 ? `${years}y` : 'N/A';
                      })()} • Sex: {(selectedPatient.gender || 'N/A').toString().charAt(0).toUpperCase()}</div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Medical Team */}
            <div className="bg-white rounded-xl shadow-sm border p-4 space-y-3">
              <h2 className="text-base font-semibold flex items-center gap-2"><User className="w-5 h-5 text-purple-600" /> Medical Team (Auto-Assigned)</h2>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="text-xs font-medium text-gray-600">Senior Registrar</label>
                  <select value={medicalTeam.senior_registrar} onChange={e => {
                    const s = staffLists.sr.find(x => String(x.id) === e.target.value);
                    setMedicalTeam(prev => ({ ...prev, senior_registrar: e.target.value, sr_name: s?.full_name || '' }));
                  }} className="w-full mt-1 px-3 py-2 border rounded-lg text-sm" title="Senior Registrar">
                    <option value="">Select...</option>
                    {staffLists.sr.map(s => <option key={s.id} value={String(s.id)}>{s.full_name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-600">Registrar</label>
                  <select value={medicalTeam.registrar} onChange={e => {
                    const s = staffLists.reg.find(x => String(x.id) === e.target.value);
                    setMedicalTeam(prev => ({ ...prev, registrar: e.target.value, reg_name: s?.full_name || '' }));
                  }} className="w-full mt-1 px-3 py-2 border rounded-lg text-sm" title="Registrar">
                    <option value="">Select...</option>
                    {staffLists.reg.map(s => <option key={s.id} value={String(s.id)}>{s.full_name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-600">House Officer</label>
                  <select value={medicalTeam.house_officer} onChange={e => {
                    const s = staffLists.ho.find(x => String(x.id) === e.target.value);
                    setMedicalTeam(prev => ({ ...prev, house_officer: e.target.value, ho_name: s?.full_name || '' }));
                  }} className="w-full mt-1 px-3 py-2 border rounded-lg text-sm" title="House Officer">
                    <option value="">Select...</option>
                    {staffLists.ho.map(s => <option key={s.id} value={String(s.id)}>{s.full_name}</option>)}
                  </select>
                </div>
              </div>
            </div>

            {/* Clinical Summary */}
            <div className="bg-white rounded-xl shadow-sm border p-4 space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="text-base font-semibold flex items-center gap-2"><FileText className="w-5 h-5 text-blue-600" /> Clinical Information</h2>
                <button onClick={() => setOcrModal('clinical')} className="flex items-center gap-1 px-3 py-1.5 bg-blue-100 text-blue-700 rounded-lg text-xs font-medium hover:bg-blue-200">
                  <Scan className="w-3.5 h-3.5" /> Scan Notes
                </button>
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600">Diagnosis *</label>
                <input value={diagnosis} onChange={e => setDiagnosis(e.target.value)} placeholder="Primary diagnosis..."
                  className="w-full mt-1 px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-green-500" />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600">Clinical Summary</label>
                <textarea value={clinicalSummary} onChange={e => setClinicalSummary(e.target.value)} rows={3}
                  placeholder="Brief clinical summary, presenting complaints, examination findings..."
                  className="w-full mt-1 px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-green-500" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-gray-600">Admission Date</label>
                  <input type="date" value={admissionDate} onChange={e => setAdmissionDate(e.target.value)} className="w-full mt-1 px-3 py-2 border rounded-lg text-sm" />
                </div>
              </div>
              {/* Comorbidities */}
              <div>
                <label className="text-xs font-medium text-gray-600">Comorbidities</label>
                <div className="flex flex-wrap gap-1 mt-1 mb-2">
                  {comorbidities.map((c, i) => (
                    <span key={i} className="inline-flex items-center gap-1 px-2 py-0.5 bg-orange-100 text-orange-700 text-xs rounded-full">
                      {c} <button onClick={() => setComorbidities(prev => prev.filter((_, j) => j !== i))} className="hover:text-red-600" title="Remove"><X className="w-3 h-3" /></button>
                    </span>
                  ))}
                </div>
                <div className="flex gap-2">
                  <input value={newComorbidity} onChange={e => setNewComorbidity(e.target.value)} placeholder="Add comorbidity (e.g., Diabetes, CKD, SCD...)"
                    onKeyDown={e => { if (e.key === 'Enter' && newComorbidity.trim()) { setComorbidities(prev => [...prev, newComorbidity.trim()]); setNewComorbidity(''); } }}
                    className="flex-1 px-3 py-2 border rounded-lg text-sm" />
                  <button onClick={() => { if (newComorbidity.trim()) { setComorbidities(prev => [...prev, newComorbidity.trim()]); setNewComorbidity(''); } }}
                    className="px-3 py-2 bg-orange-600 text-white rounded-lg text-sm"><Plus className="w-4 h-4" /></button>
                </div>
              </div>
            </div>

            <div className="flex justify-end">
              <button onClick={() => setStep(2)} disabled={!selectedPatient || !diagnosis}
                className="px-6 py-2.5 bg-green-600 text-white rounded-lg font-medium disabled:opacity-50 flex items-center gap-2">
                Next: Risk Assessment <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* ─── STEP 2: RISK ASSESSMENTS ─── */}
        {step === 2 && (
          <div className="space-y-4">
            {/* DVT Risk */}
            <div className="bg-white rounded-xl shadow-sm border p-4">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-base font-semibold flex items-center gap-2"><Shield className="w-5 h-5 text-red-600" /> DVT Risk Assessment (Caprini Score)</h2>
                <div className={`px-3 py-1 rounded-full text-sm font-bold ${
                  dvtRisk.color === 'green' ? 'bg-green-100 text-green-700' :
                  dvtRisk.color === 'yellow' ? 'bg-yellow-100 text-yellow-700' :
                  dvtRisk.color === 'orange' ? 'bg-orange-100 text-orange-700' : 'bg-red-100 text-red-700'
                }`}>Score: {dvtScore} — {dvtRisk.level}</div>
              </div>
              {Object.entries(DVT_RISK_FACTORS).map(([key, factors]) => {
                const pts = key === 'one_point' ? 1 : key === 'two_points' ? 2 : key === 'three_points' ? 3 : 5;
                return (
                  <div key={key} className="mb-3">
                    <h4 className="text-xs font-semibold text-gray-500 uppercase mb-1">{pts} Point{pts > 1 ? 's' : ''} Each</h4>
                    <div className="flex flex-wrap gap-1.5">
                      {factors.map(f => (
                        <button key={f} onClick={() => setDvtFactors(prev => prev.includes(f) ? prev.filter(x => x !== f) : [...prev, f])}
                          className={`px-2 py-1 text-xs rounded-full border transition-all ${
                            dvtFactors.includes(f) ? 'bg-red-100 border-red-400 text-red-700 font-medium' : 'bg-gray-50 border-gray-200 text-gray-600 hover:border-red-300'
                          }`}>{f}</button>
                      ))}
                    </div>
                  </div>
                );
              })}
              {dvtScore > 0 && (
                <div className="mt-3 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                  <p className="text-sm font-medium text-blue-800">Recommended Prophylaxis:</p>
                  <p className="text-sm text-blue-700">{dvtRisk.prophylaxis}</p>
                  <button onClick={generateDVTProphylaxis} className="mt-2 px-4 py-1.5 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 flex items-center gap-1">
                    <Shield className="w-4 h-4" /> Auto-Generate DVT Prophylaxis Plan
                  </button>
                </div>
              )}
            </div>

            {/* Pressure Sore Risk - Braden Scale */}
            <div className="bg-white rounded-xl shadow-sm border p-4">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-base font-semibold flex items-center gap-2"><AlertTriangle className="w-5 h-5 text-orange-600" /> Pressure Sore Risk (Braden Scale)</h2>
                <div className={`px-3 py-1 rounded-full text-sm font-bold ${
                  bradenRisk.color === 'green' ? 'bg-green-100 text-green-700' :
                  bradenRisk.color === 'blue' ? 'bg-blue-100 text-blue-700' :
                  bradenRisk.color === 'yellow' ? 'bg-yellow-100 text-yellow-700' :
                  bradenRisk.color === 'orange' ? 'bg-orange-100 text-orange-700' : 'bg-red-100 text-red-700'
                }`}>Score: {bradenTotal}/23 — {bradenRisk.level}</div>
              </div>
              <div className="space-y-3">
                {Object.entries(BRADEN_CATEGORIES).map(([key, cat]) => (
                  <div key={key}>
                    <label className="text-xs font-semibold text-gray-600">{cat.label} (Score: {bradenScores[key]})</label>
                    <div className="flex flex-wrap gap-1.5 mt-1">
                      {cat.options.map(opt => (
                        <button key={opt.score} onClick={() => setBradenScores(prev => ({ ...prev, [key]: opt.score }))}
                          className={`px-2 py-1 text-xs rounded-lg border transition-all ${
                            bradenScores[key] === opt.score ? 'bg-orange-100 border-orange-400 text-orange-700 font-medium' : 'bg-gray-50 border-gray-200 text-gray-600'
                          }`} title={opt.desc}>{opt.score}. {opt.label}</button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
              {bradenTotal <= 18 && (
                <div className="mt-3">
                  <button onClick={generatePressureSorePrevention} className="px-4 py-1.5 bg-orange-600 text-white text-sm rounded-lg hover:bg-orange-700 flex items-center gap-1">
                    <Shield className="w-4 h-4" /> Auto-Generate Pressure Sore Prevention Protocol
                  </button>
                </div>
              )}
            </div>

            {/* Nutritional Risk - MUST */}
            <div className="bg-white rounded-xl shadow-sm border p-4">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-base font-semibold flex items-center gap-2"><Apple className="w-5 h-5 text-green-600" /> Nutritional Risk (MUST Screening)</h2>
                <div className={`px-3 py-1 rounded-full text-sm font-bold ${
                  mustRisk.color === 'green' ? 'bg-green-100 text-green-700' :
                  mustRisk.color === 'yellow' ? 'bg-yellow-100 text-yellow-700' : 'bg-red-100 text-red-700'
                }`}>Score: {mustTotal} — {mustRisk.level}</div>
              </div>
              <div className="space-y-3">
                {Object.entries(MUST_CATEGORIES).map(([key, cat]) => (
                  <div key={key}>
                    <label className="text-xs font-semibold text-gray-600">{cat.label}</label>
                    <div className="flex flex-wrap gap-1.5 mt-1">
                      {cat.options.map(opt => (
                        <button key={opt.score} onClick={() => setMustScores(prev => ({ ...prev, [key]: opt.score }))}
                          className={`px-3 py-1.5 text-xs rounded-lg border transition-all ${
                            mustScores[key] === opt.score ? 'bg-green-100 border-green-400 text-green-700 font-medium' : 'bg-gray-50 border-gray-200 text-gray-600'
                          }`} title={opt.desc}>{opt.label}</button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
              <div className="mt-3 p-2 bg-gray-50 rounded-lg text-sm text-gray-700">
                <strong>Action:</strong> {mustRisk.action}
              </div>
              <button onClick={() => { const mp = generateNutritionalPlan(); }} className="mt-2 px-4 py-1.5 bg-green-600 text-white text-sm rounded-lg hover:bg-green-700 flex items-center gap-1">
                <Apple className="w-4 h-4" /> Auto-Generate 7-Day Nutritional Meal Plan
              </button>
            </div>

            <div className="flex justify-between">
              <button onClick={() => setStep(1)} className="px-4 py-2 border rounded-lg text-sm">Back</button>
              <button onClick={() => setStep(3)} className="px-6 py-2.5 bg-green-600 text-white rounded-lg font-medium flex items-center gap-2">
                Next: Procedures <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* ─── STEP 3: PROCEDURES ─── */}
        {step === 3 && (
          <div className="space-y-4">
            <div className="bg-white rounded-xl shadow-sm border p-4">
              <h2 className="text-base font-semibold flex items-center gap-2 mb-3"><Activity className="w-5 h-5 text-blue-600" /> Proposed Procedures</h2>
              {procedures.length > 0 && (
                <div className="space-y-2 mb-4">
                  {procedures.map((proc, i) => (
                    <div key={proc.id || i} className="flex items-center justify-between p-2 bg-blue-50 rounded-lg border border-blue-200">
                      <div>
                        <div className="text-sm font-medium">{proc.name}</div>
                        <div className="text-xs text-gray-500">{proc.date} {proc.time} • {proc.type} • {proc.frequency}</div>
                      </div>
                      <button onClick={() => setProcedures(prev => prev.filter((_, j) => j !== i))} className="text-red-500 hover:text-red-700" title="Remove"><Trash2 className="w-4 h-4" /></button>
                    </div>
                  ))}
                </div>
              )}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 p-3 bg-gray-50 rounded-lg">
                <input value={newProc.name} onChange={e => setNewProc(prev => ({ ...prev, name: e.target.value }))} placeholder="Procedure name *" className="px-3 py-2 border rounded-lg text-sm" />
                <select value={newProc.type} onChange={e => setNewProc(prev => ({ ...prev, type: e.target.value }))} className="px-3 py-2 border rounded-lg text-sm" title="Procedure type">
                  <option value="minor">Minor</option><option value="major">Major</option><option value="diagnostic">Diagnostic</option><option value="therapeutic">Therapeutic</option>
                </select>
                <input type="date" value={newProc.date} onChange={e => setNewProc(prev => ({ ...prev, date: e.target.value }))} className="px-3 py-2 border rounded-lg text-sm" title="Proposed date" />
                <input type="time" value={newProc.time} onChange={e => setNewProc(prev => ({ ...prev, time: e.target.value }))} className="px-3 py-2 border rounded-lg text-sm" title="Proposed time" />
                <select value={newProc.frequency} onChange={e => setNewProc(prev => ({ ...prev, frequency: e.target.value }))} className="px-3 py-2 border rounded-lg text-sm" title="Frequency">
                  <option value="once">Once</option><option value="daily">Daily</option><option value="alternate_days">Alternate Days</option><option value="weekly">Weekly</option>
                </select>
                <input value={newProc.surgeon} onChange={e => setNewProc(prev => ({ ...prev, surgeon: e.target.value }))} placeholder="Surgeon (optional)" className="px-3 py-2 border rounded-lg text-sm" />
                <textarea value={newProc.notes} onChange={e => setNewProc(prev => ({ ...prev, notes: e.target.value }))} placeholder="Notes..." className="px-3 py-2 border rounded-lg text-sm sm:col-span-2" rows={1} />
                <button onClick={addProcedure} disabled={!newProc.name} className="sm:col-span-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm disabled:opacity-50 flex items-center justify-center gap-1">
                  <Plus className="w-4 h-4" /> Add Procedure
                </button>
              </div>
            </div>
            <div className="flex justify-between">
              <button onClick={() => setStep(2)} className="px-4 py-2 border rounded-lg text-sm">Back</button>
              <button onClick={() => setStep(4)} className="px-6 py-2.5 bg-green-600 text-white rounded-lg font-medium flex items-center gap-2">
                Next: Investigations <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* ─── STEP 4: INVESTIGATIONS ─── */}
        {step === 4 && (
          <div className="space-y-4">
            <div className="bg-white rounded-xl shadow-sm border p-4">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-base font-semibold flex items-center gap-2"><Beaker className="w-5 h-5 text-yellow-600" /> Investigations</h2>
                <button onClick={() => setOcrModal('investigation')} className="flex items-center gap-1 px-3 py-1.5 bg-yellow-100 text-yellow-700 rounded-lg text-xs font-medium hover:bg-yellow-200">
                  <Scan className="w-3.5 h-3.5" /> Scan Lab Form
                </button>
              </div>
              {investigations.length > 0 && (
                <div className="space-y-2 mb-4">
                  {investigations.map((inv, i) => (
                    <div key={inv.id || i} className="flex items-center justify-between p-2 bg-yellow-50 rounded-lg border border-yellow-200">
                      <div>
                        <div className="text-sm font-medium">{inv.name}</div>
                        <div className="text-xs text-gray-500">{inv.type} • {inv.frequency} {inv.repeat_count > 1 ? `× ${inv.repeat_count}` : ''} {inv.target_range && `| Range: ${inv.target_range}`}</div>
                      </div>
                      <button onClick={() => setInvestigations(prev => prev.filter((_, j) => j !== i))} className="text-red-500 hover:text-red-700" title="Remove"><Trash2 className="w-4 h-4" /></button>
                    </div>
                  ))}
                </div>
              )}
              <div className="p-3 bg-gray-50 rounded-lg space-y-2">
                <div className="relative">
                  <input value={invSearch} onChange={e => setInvSearch(e.target.value)} placeholder="Search investigation (e.g., FBC, U&E, Chest X-ray)..."
                    className="w-full px-3 py-2 border rounded-lg text-sm" />
                  {invSuggestions.length > 0 && (
                    <div className="absolute z-10 top-full left-0 right-0 mt-1 bg-white border rounded-lg shadow-lg max-h-40 overflow-y-auto">
                      {invSuggestions.map((s: any, i: number) => (
                        <button key={i} onClick={() => selectInvFromDB(s)} className="w-full px-3 py-2 text-left text-sm hover:bg-yellow-50 border-b last:border-0">
                          <span className="font-medium">{s.name}</span>
                          <span className="text-xs text-gray-400 ml-2">{s.category} {s.normalRange ? `| Normal: ${s.normalRange}` : ''}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  <input value={newInv.name} onChange={e => setNewInv(prev => ({ ...prev, name: e.target.value }))} placeholder="Investigation name *" className="px-3 py-2 border rounded-lg text-sm" />
                  <select value={newInv.type} onChange={e => setNewInv(prev => ({ ...prev, type: e.target.value }))} className="px-3 py-2 border rounded-lg text-sm" title="Investigation type">
                    <option value="lab">Lab</option><option value="imaging">Imaging</option><option value="other">Other</option>
                  </select>
                  <select value={newInv.frequency} onChange={e => setNewInv(prev => ({ ...prev, frequency: e.target.value }))} className="px-3 py-2 border rounded-lg text-sm" title="Frequency">
                    <option value="once">Once</option><option value="daily">Daily</option><option value="alternate_days">Alternate Days</option>
                    <option value="twice_weekly">Twice Weekly</option><option value="weekly">Weekly</option><option value="biweekly">Biweekly</option>
                  </select>
                  {newInv.frequency !== 'once' && (
                    <input type="number" value={newInv.repeat_count} min={1} onChange={e => setNewInv(prev => ({ ...prev, repeat_count: parseInt(e.target.value) || 1 }))}
                      placeholder="Repeat count" className="px-3 py-2 border rounded-lg text-sm" title="Repeat count" />
                  )}
                  <input value={newInv.target_range} onChange={e => setNewInv(prev => ({ ...prev, target_range: e.target.value }))} placeholder="Target range (optional)" className="px-3 py-2 border rounded-lg text-sm" />
                </div>
                <button onClick={addInvestigation} disabled={!newInv.name} className="w-full px-4 py-2 bg-yellow-600 text-white rounded-lg text-sm disabled:opacity-50 flex items-center justify-center gap-1">
                  <Plus className="w-4 h-4" /> Add Investigation
                </button>
              </div>
            </div>
            <div className="flex justify-between">
              <button onClick={() => setStep(3)} className="px-4 py-2 border rounded-lg text-sm">Back</button>
              <button onClick={() => setStep(5)} className="px-6 py-2.5 bg-green-600 text-white rounded-lg font-medium flex items-center gap-2">
                Next: Prescriptions <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* ─── STEP 5: PRESCRIPTIONS ─── */}
        {step === 5 && (
          <div className="space-y-4">
            {/* Quick Templates */}
            <div className="bg-white rounded-xl shadow-sm border p-4">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-base font-semibold flex items-center gap-2"><Pill className="w-5 h-5 text-purple-600" /> Quick Prescription Templates</h2>
                <button onClick={() => setOcrModal('prescription')} className="flex items-center gap-1 px-3 py-1.5 bg-purple-100 text-purple-700 rounded-lg text-xs font-medium hover:bg-purple-200">
                  <Scan className="w-3.5 h-3.5" /> Scan Prescription
                </button>
              </div>
              <div className="flex flex-wrap gap-2">
                <button onClick={addWoundCareSupplements} className="px-3 py-2 bg-green-100 text-green-700 rounded-lg text-sm font-medium hover:bg-green-200 flex items-center gap-1">
                  <Plus className="w-4 h-4" /> Wound Care Supplements
                </button>
                <button onClick={addWoundDressingPrescription} className="px-3 py-2 bg-blue-100 text-blue-700 rounded-lg text-sm font-medium hover:bg-blue-200 flex items-center gap-1">
                  <Plus className="w-4 h-4" /> Wound Dressing Pack
                </button>
                <button onClick={addWoundDebridementPrescription} className="px-3 py-2 bg-orange-100 text-orange-700 rounded-lg text-sm font-medium hover:bg-orange-200 flex items-center gap-1">
                  <Plus className="w-4 h-4" /> Wound Debridement Pack
                </button>
              </div>
            </div>

            {/* Medications */}
            <div className="bg-white rounded-xl shadow-sm border p-4">
              <h2 className="text-base font-semibold mb-3">Medications ({medications.length})</h2>
              {medications.length > 0 && (
                <div className="space-y-1 mb-4 max-h-60 overflow-y-auto">
                  {medications.map((med, i) => (
                    <div key={med.id || i} className="flex items-center justify-between p-2 bg-purple-50 rounded-lg border border-purple-200">
                      <div>
                        <div className="text-sm font-medium">{med.name}</div>
                        <div className="text-xs text-gray-500">{med.dosage} • {med.route} • {med.frequency} • {med.duration}</div>
                        {med.notes && <div className="text-xs text-orange-600">{med.notes}</div>}
                      </div>
                      <button onClick={() => setMedications(prev => prev.filter((_, j) => j !== i))} className="text-red-500 hover:text-red-700" title="Remove"><Trash2 className="w-4 h-4" /></button>
                    </div>
                  ))}
                </div>
              )}
              <div className="p-3 bg-gray-50 rounded-lg space-y-2">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input value={medSearch} onChange={e => setMedSearch(e.target.value)} placeholder="Search BNF drug database..."
                    className="w-full pl-10 pr-4 py-2 border rounded-lg text-sm" />
                  {medSuggestions.length > 0 && (
                    <div className="absolute z-10 top-full left-0 right-0 mt-1 bg-white border rounded-lg shadow-lg max-h-48 overflow-y-auto">
                      {medSuggestions.map((s: BNFMedication, i: number) => (
                        <button key={i} onClick={() => selectMedFromBNF(s)} className="w-full px-3 py-2 text-left text-sm hover:bg-purple-50 border-b last:border-0">
                          <div className="font-medium">{s.name}</div>
                          <div className="text-xs text-gray-400">{s.category} • {s.dosages[0]?.adult || ''} • Routes: {s.routes.join(', ')}</div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                <div className="text-xs text-gray-400 italic">If medication not in BNF database, enter manually below:</div>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  <input value={newMed.name} onChange={e => setNewMed(prev => ({ ...prev, name: e.target.value }))} placeholder="Medication name *" className="px-3 py-2 border rounded-lg text-sm" />
                  <input value={newMed.dosage} onChange={e => setNewMed(prev => ({ ...prev, dosage: e.target.value }))} placeholder="Dosage (e.g., 500mg)" className="px-3 py-2 border rounded-lg text-sm" />
                  <select value={newMed.route} onChange={e => setNewMed(prev => ({ ...prev, route: e.target.value }))} className="px-3 py-2 border rounded-lg text-sm" title="Route">
                    <option value="oral">Oral</option><option value="IV">IV</option><option value="IM">IM</option><option value="SC">SC</option>
                    <option value="topical">Topical</option><option value="rectal">Rectal</option><option value="sublingual">Sublingual</option>
                  </select>
                  <select value={newMed.frequency} onChange={e => setNewMed(prev => ({ ...prev, frequency: e.target.value }))} className="px-3 py-2 border rounded-lg text-sm" title="Frequency">
                    <option value="OD">OD (Once daily)</option><option value="BD">BD (Twice daily)</option><option value="TDS">TDS (Three times daily)</option>
                    <option value="QDS">QDS (Four times daily)</option><option value="Q6H">Q6H (Every 6 hours)</option><option value="Q8H">Q8H (Every 8 hours)</option>
                    <option value="Q12H">Q12H (Every 12 hours)</option><option value="STAT">STAT (Immediately)</option><option value="PRN">PRN (As needed)</option>
                    <option value="Nocte">Nocte (At night)</option><option value="Mane">Mane (Morning)</option>
                  </select>
                  <input value={newMed.duration} onChange={e => setNewMed(prev => ({ ...prev, duration: e.target.value }))} placeholder="Duration (e.g., 7 days)" className="px-3 py-2 border rounded-lg text-sm" />
                  <input value={newMed.notes} onChange={e => setNewMed(prev => ({ ...prev, notes: e.target.value }))} placeholder="Notes (optional)" className="px-3 py-2 border rounded-lg text-sm" />
                </div>
                <button onClick={addMedication} disabled={!newMed.name} className="w-full px-4 py-2 bg-purple-600 text-white rounded-lg text-sm disabled:opacity-50 flex items-center justify-center gap-1">
                  <Plus className="w-4 h-4" /> Add Medication
                </button>
              </div>
            </div>

            {/* Wound Dressing Prescription */}
            {woundDressing.length > 0 && (
              <div className="bg-white rounded-xl shadow-sm border p-4">
                <h3 className="text-sm font-semibold mb-2 flex items-center gap-2">🩹 Wound Dressing Prescription</h3>
                <div className="space-y-1">
                  {woundDressing.map((item, i) => (
                    <div key={item.id || i} className="flex justify-between items-center text-sm p-1.5 bg-blue-50 rounded">
                      <span>{item.name}</span>
                      <span className="text-gray-500">× {item.quantity} {item.unit} {item.optional ? '(if needed)' : ''}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Wound Debridement Prescription */}
            {woundDebridement.length > 0 && (
              <div className="bg-white rounded-xl shadow-sm border p-4">
                <h3 className="text-sm font-semibold mb-2 flex items-center gap-2">🔪 Wound Debridement Prescription</h3>
                <div className="space-y-1">
                  {woundDebridement.map((item, i) => (
                    <div key={item.id || i} className="flex justify-between items-center text-sm p-1.5 bg-orange-50 rounded">
                      <span>{item.name}</span>
                      <span className="text-gray-500">× {item.quantity} {item.unit} {item.optional ? '(if needed)' : ''}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="flex justify-between">
              <button onClick={() => setStep(4)} className="px-4 py-2 border rounded-lg text-sm">Back</button>
              <button onClick={() => setStep(6)} className="px-6 py-2.5 bg-green-600 text-white rounded-lg font-medium flex items-center gap-2">
                Next: Reviews <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* ─── STEP 6: WARD ROUNDS & REVIEWS ─── */}
        {step === 6 && (
          <div className="space-y-4">
            <div className="bg-white rounded-xl shadow-sm border p-4">
              <h2 className="text-base font-semibold flex items-center gap-2 mb-3"><Clock className="w-5 h-5 text-indigo-600" /> Ward Rounds & Review Schedule</h2>
              <div className="space-y-3">
                <div>
                  <label className="text-xs font-semibold text-gray-600">Review Frequency</label>
                  <select value={reviewFrequency} onChange={e => setReviewFrequency(e.target.value)} className="w-full mt-1 px-3 py-2 border rounded-lg text-sm" title="Review frequency">
                    <option value="daily">Daily</option><option value="alternate_days">Alternate Days</option>
                    <option value="weekly">Weekly</option><option value="biweekly">Biweekly</option><option value="custom">Custom</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-600">Review Days</label>
                  <div className="flex flex-wrap gap-2 mt-1">
                    {Object.entries(reviewDays).map(([day, checked]) => (
                      <label key={day} className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs cursor-pointer border transition-all ${
                        checked ? 'bg-indigo-100 border-indigo-400 text-indigo-700' : 'bg-gray-50 border-gray-200 text-gray-500'
                      }`}>
                        <input type="checkbox" checked={checked} onChange={e => setReviewDays(prev => ({ ...prev, [day]: e.target.checked }))} className="sr-only" />
                        {day.charAt(0).toUpperCase() + day.slice(1, 3)}
                      </label>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-600">Primary Reviewer</label>
                  <select value={reviewAssignee} onChange={e => setReviewAssignee(e.target.value)} className="w-full mt-1 px-3 py-2 border rounded-lg text-sm" title="Primary reviewer">
                    <option value="house_officer">House Officer{medicalTeam.ho_name ? ` (${medicalTeam.ho_name})` : ''}</option>
                    <option value="registrar">Registrar{medicalTeam.reg_name ? ` (${medicalTeam.reg_name})` : ''}</option>
                    <option value="senior_registrar">Senior Registrar{medicalTeam.sr_name ? ` (${medicalTeam.sr_name})` : ''}</option>
                  </select>
                </div>
              </div>
            </div>
            <div className="flex justify-between">
              <button onClick={() => setStep(5)} className="px-4 py-2 border rounded-lg text-sm">Back</button>
              <button onClick={() => setStep(7)} className="px-6 py-2.5 bg-green-600 text-white rounded-lg font-medium flex items-center gap-2">
                Next: Discharge <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* ─── STEP 7: DISCHARGE CRITERIA ─── */}
        {step === 7 && (
          <div className="space-y-4">
            <div className="bg-white rounded-xl shadow-sm border p-4">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-base font-semibold flex items-center gap-2"><Heart className="w-5 h-5 text-red-600" /> Discharge Planning (WHO Criteria)</h2>
                <div className={`px-3 py-1 rounded-full text-sm font-bold ${
                  dischargeScore.percent === 100 ? 'bg-green-100 text-green-700' :
                  dischargeScore.percent >= 70 ? 'bg-yellow-100 text-yellow-700' : 'bg-red-100 text-red-700'
                }`}>{dischargeScore.met}/{dischargeScore.total} ({dischargeScore.percent}%)</div>
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-600">Planned Discharge Date</label>
                <input type="date" value={plannedDischargeDate} onChange={e => setPlannedDischargeDate(e.target.value)} className="w-full mt-1 px-3 py-2 border rounded-lg text-sm" />
              </div>
              <div className="mt-4 space-y-1">
                {(['Clinical', 'Surgical', 'Functional', 'Discharge', 'Social'] as const).map(cat => (
                  <div key={cat} className="mb-3">
                    <h4 className="text-xs font-semibold text-gray-500 uppercase mb-1">{cat}</h4>
                    {WHO_DISCHARGE_CRITERIA.filter(c => c.category === cat).map(c => (
                      <label key={c.id} className={`flex items-center gap-2 p-2 rounded-lg cursor-pointer transition-all ${
                        dischargeCriteriaMet.includes(c.id) ? 'bg-green-50 border border-green-200' : 'hover:bg-gray-50'
                      }`}>
                        <input type="checkbox" checked={dischargeCriteriaMet.includes(c.id)}
                          onChange={e => setDischargeCriteriaMet(prev => e.target.checked ? [...prev, c.id] : prev.filter(x => x !== c.id))}
                          className="w-4 h-4 text-green-600 rounded" />
                        <span className="text-sm">{c.label}</span>
                        {dischargeCriteriaMet.includes(c.id) && <CheckCircle className="w-4 h-4 text-green-500 ml-auto" />}
                      </label>
                    ))}
                  </div>
                ))}
              </div>
            </div>

            {/* Summary & Save */}
            <div className="bg-white rounded-xl shadow-sm border p-4">
              <h2 className="text-base font-semibold mb-3">Plan Summary</h2>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
                <div className="p-2 bg-blue-50 rounded-lg">
                  <div className="text-2xl font-bold text-blue-700">{procedures.length}</div>
                  <div className="text-xs text-gray-500">Procedures</div>
                </div>
                <div className="p-2 bg-yellow-50 rounded-lg">
                  <div className="text-2xl font-bold text-yellow-700">{investigations.length}</div>
                  <div className="text-xs text-gray-500">Investigations</div>
                </div>
                <div className="p-2 bg-purple-50 rounded-lg">
                  <div className="text-2xl font-bold text-purple-700">{medications.length}</div>
                  <div className="text-xs text-gray-500">Medications</div>
                </div>
                <div className="p-2 bg-green-50 rounded-lg">
                  <div className="text-2xl font-bold text-green-700">{dischargeScore.percent}%</div>
                  <div className="text-xs text-gray-500">Discharge Ready</div>
                </div>
              </div>
              <div className="mt-3 grid grid-cols-3 gap-2 text-center text-xs">
                <div className={`p-2 rounded-lg ${dvtRisk.color === 'green' ? 'bg-green-50 text-green-700' : dvtRisk.color === 'red' ? 'bg-red-50 text-red-700' : 'bg-yellow-50 text-yellow-700'}`}>
                  DVT: {dvtRisk.level} ({dvtScore})
                </div>
                <div className={`p-2 rounded-lg ${bradenRisk.color === 'green' ? 'bg-green-50 text-green-700' : bradenRisk.color === 'red' ? 'bg-red-50 text-red-700' : 'bg-yellow-50 text-yellow-700'}`}>
                  Pressure: {bradenRisk.level}
                </div>
                <div className={`p-2 rounded-lg ${mustRisk.color === 'green' ? 'bg-green-50 text-green-700' : mustRisk.color === 'red' ? 'bg-red-50 text-red-700' : 'bg-yellow-50 text-yellow-700'}`}>
                  Nutrition: {mustRisk.level}
                </div>
              </div>
            </div>

            <div className="flex justify-between">
              <button onClick={() => setStep(6)} className="px-4 py-2 border rounded-lg text-sm">Back</button>
              <button onClick={savePlan} disabled={saving || !selectedPatient || !diagnosis}
                className="px-8 py-2.5 bg-green-600 text-white rounded-lg font-medium disabled:opacity-50 flex items-center gap-2">
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
                {saving ? 'Saving...' : 'Create Treatment Plan'}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* OCR Document Scanner Modal */}
      <DocumentScannerModal
        isOpen={ocrModal !== null}
        onClose={() => setOcrModal(null)}
        onFieldsExtracted={handleOCRFields}
        documentType={ocrModal === 'clinical' ? 'clinical_note' : ocrModal === 'investigation' ? 'lab_report' : ocrModal === 'prescription' ? 'prescription' : 'general'}
        patientContext={selectedPatient ? {
          name: selectedPatient.full_name || selectedPatient.name || `${selectedPatient.first_name || ''} ${selectedPatient.last_name || ''}`,
          hospitalNumber: selectedPatient.hospital_number,
          ward: selectedPatient.ward,
          diagnosis: diagnosis,
        } : undefined}
        targetForm={ocrModal === 'prescription' ? 'prescription' : ocrModal === 'investigation' ? 'lab_entry' : 'progress_note'}
      />
    </div>
  );
};

export default TreatmentPlanCreator;

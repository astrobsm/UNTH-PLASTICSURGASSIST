import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import {
  Search, Plus, X, AlertTriangle, AlertCircle, Info, ChevronDown, ChevronUp,
  Pill, FileText, Check, Printer, Trash2, Clock, User, ShieldAlert,
  Baby, Heart, Droplet as KidneyIcon, Activity, ChevronRight, Download
} from 'lucide-react';
import {
  BNF_DRUG_DATABASE,
  searchDrugs,
  getDrugCategories,
  getDrugsByCategory,
  getDrugById,
  getFrequencyLabel,
  getRouteLabel,
  generatePatientWarnings,
  checkDrugInteractions,
  type BNFDrug,
  type DrugFrequency,
  type DrugRoute,
  type DrugCategory,
} from '../data/bnfDrugDatabase';
import { useAuthStore } from '../store/authStore';
import { db } from '../db/database';
import { syncService } from '../db/syncService';
import { patientService } from '../services/patientService';
import { apiClient } from '../services/apiClient';
import jsPDF from 'jspdf';

// ─── TYPES ──────────────────────────────────────────────────────────────────

interface PatientContext {
  patient_id?: string;
  name: string;
  hospitalNumber: string;
  sex?: string;
  age?: number;
  weight?: number;
  pregnant?: boolean;
  lactating?: boolean;
  gfr?: number;
  /** Serum creatinine value as entered by the user (numeric, in `creatinineUnit`). */
  creatinine?: number;
  /** Unit for `creatinine`. Cockcroft-Gault expects mg/dL; µmol/L is auto-converted (÷ 88.4). */
  creatinineUnit?: 'mg/dL' | 'µmol/L';
  /** True when `gfr` was computed from creatinine+weight+age+sex (clinician can still override). */
  gfrAutoCalculated?: boolean;
  hepaticImpairment?: boolean;
  cardiacDisease?: boolean;
  allergies: string[];
  comorbidities: string[];
  currentMedications: string[];
}

interface PrescriptionItem {
  id: string;
  drug: BNFDrug;
  dose: string;
  route: DrugRoute;
  frequency: DrugFrequency;
  duration: string;
  instructions: string;
  prescribedBy: string;
  prescribedAt: string;
  warnings: { level: 'danger' | 'warning' | 'info'; message: string }[];
}

// ─── COMPONENT ──────────────────────────────────────────────────────────────

export default function PrescriptionsPage() {
  const { user } = useAuthStore();

  // Patient context
  const [patientContext, setPatientContext] = useState<PatientContext>({
    name: '',
    hospitalNumber: '',
    creatinineUnit: 'mg/dL',
    allergies: [],
    comorbidities: [],
    currentMedications: [],
  });
  const [showPatientForm, setShowPatientForm] = useState(true);

  // Auto-calculate eGFR via Cockcroft-Gault whenever the underlying inputs
  // change (age, weight, sex, serum creatinine, unit). The clinician can
  // still manually override the eGFR field — doing so flips
  // gfrAutoCalculated to false and we stop recomputing until they clear it.
  useEffect(() => {
    setPatientContext(p => {
      const { age, weight, sex, creatinine, creatinineUnit, gfrAutoCalculated, gfr } = p;
      const canCompute =
        typeof age === 'number' && age > 0 &&
        typeof weight === 'number' && weight > 0 &&
        typeof creatinine === 'number' && creatinine > 0;

      // If the field is empty OR was previously auto-calculated, we own it.
      const weOwnTheField = gfr === undefined || gfrAutoCalculated === true;
      if (!weOwnTheField) return p;

      if (!canCompute) {
        // Clear stale auto value if inputs were removed
        if (gfrAutoCalculated && gfr !== undefined) {
          return { ...p, gfr: undefined };
        }
        return p;
      }

      // Cockcroft-Gault expects creatinine in mg/dL
      const creatMgDl = creatinineUnit === 'µmol/L' ? (creatinine as number) / 88.4 : (creatinine as number);
      const sexFactor = sex === 'female' ? 0.85 : 1;
      const computed = ((140 - (age as number)) * (weight as number) * sexFactor) / (72 * creatMgDl);
      const rounded = Math.max(0, Math.round(computed * 10) / 10);
      if (p.gfr === rounded && p.gfrAutoCalculated === true) return p;
      return { ...p, gfr: rounded, gfrAutoCalculated: true };
    });
  }, [
    patientContext.age,
    patientContext.weight,
    patientContext.sex,
    patientContext.creatinine,
    patientContext.creatinineUnit,
  ]);

  // Drug search
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [searchResults, setSearchResults] = useState<BNFDrug[]>([]);
  const [showSearchResults, setShowSearchResults] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);

  // Selected drug & prescription form
  const [selectedDrug, setSelectedDrug] = useState<BNFDrug | null>(null);
  const [prescriptionDose, setPrescriptionDose] = useState('');
  const [prescriptionRoute, setPrescriptionRoute] = useState<DrugRoute>('oral');
  const [prescriptionFrequency, setPrescriptionFrequency] = useState<DrugFrequency>('od');
  const [prescriptionDuration, setPrescriptionDuration] = useState('');
  const [prescriptionInstructions, setPrescriptionInstructions] = useState('');
  const [showDrugDetail, setShowDrugDetail] = useState(false);

  // Prescription list
  const [prescriptions, setPrescriptions] = useState<PrescriptionItem[]>([]);
  const [expandedPrescription, setExpandedPrescription] = useState<string | null>(null);

  // UI state
  const [activeTab, setActiveTab] = useState<'prescribe' | 'current' | 'history'>('prescribe');
  const [savedPrescriptions, setSavedPrescriptions] = useState<any[]>([]);
  const [allergyInput, setAllergyInput] = useState('');
  const [medInput, setMedInput] = useState('');

  // Patient search from DB
  const [allPatients, setAllPatients] = useState<any[]>([]);
  const [patientSearchQuery, setPatientSearchQuery] = useState('');
  const [showPatientDropdown, setShowPatientDropdown] = useState(false);
  const patientSearchRef = useRef<HTMLDivElement>(null);

  // Load saved prescriptions from IndexedDB
  useEffect(() => {
    loadSavedPrescriptions();
    loadAllPatients();
  }, []);

  async function loadAllPatients() {
    try {
      const pts = await patientService.getAllPatients();
      setAllPatients(pts);
    } catch (err) {
      console.error('Failed to load patients:', err);
    }
  }

  const filteredPatients = useMemo(() => {
    if (!patientSearchQuery || patientSearchQuery.length < 1) return [];
    const q = patientSearchQuery.toLowerCase();
    return allPatients.filter(p => {
      const fullName = `${p.first_name || ''} ${p.last_name || ''}`.toLowerCase();
      const hospNum = (p.hospital_number || '').toLowerCase();
      return fullName.includes(q) || hospNum.includes(q);
    }).slice(0, 10);
  }, [patientSearchQuery, allPatients]);

  // Close patient dropdown on outside click
  useEffect(() => {
    function handlePatientClick(e: MouseEvent) {
      if (patientSearchRef.current && !patientSearchRef.current.contains(e.target as Node)) {
        setShowPatientDropdown(false);
      }
    }
    document.addEventListener('mousedown', handlePatientClick);
    return () => document.removeEventListener('mousedown', handlePatientClick);
  }, []);

  function selectPatient(patient: any) {
    const fullName = `${patient.first_name || ''} ${patient.last_name || ''}`.trim();
    const dob = patient.date_of_birth ? new Date(patient.date_of_birth) : null;
    let age: number | undefined;
    if (dob) {
      const now = new Date();
      age = now.getFullYear() - dob.getFullYear();
      const monthDiff = now.getMonth() - dob.getMonth();
      if (monthDiff < 0 || (monthDiff === 0 && now.getDate() < dob.getDate())) {
        age--;
      }
    }
    setPatientContext(p => ({
      ...p,
      patient_id: patient.id?.toString() || patient.serverId?.toString() || '',
      name: fullName,
      hospitalNumber: patient.hospital_number || '',
      sex: patient.gender?.toLowerCase() || patient.sex?.toLowerCase() || '',
      age: age,
    }));
    setPatientSearchQuery(`${fullName} (${patient.hospital_number || 'N/A'})`);
    setShowPatientDropdown(false);
  }

  async function loadSavedPrescriptions() {
    try {
      // Fetch from cloud first, merge into local DB
      if (navigator.onLine && apiClient.getToken()) {
        try {
          const cloudData = await apiClient.getPrescriptions();
          if (Array.isArray(cloudData) && cloudData.length > 0) {
            for (const rx of cloudData) {
              try { await db.table('prescriptions').put({ ...rx, synced: true }); } catch { /* ignore dups */ }
            }
          }
        } catch (e) { console.warn('Failed to pull prescriptions from cloud:', e); }
      }
      const items = await db.table('prescriptions').toArray();
      setSavedPrescriptions(items);
    } catch {
      // table may not exist
    }
  }

  // Drug search handler
  useEffect(() => {
    if (searchQuery.trim().length >= 2) {
      const results = searchDrugs(searchQuery);
      setSearchResults(results);
      setShowSearchResults(true);
    } else if (selectedCategory) {
      const results = getDrugsByCategory(selectedCategory as DrugCategory);
      setSearchResults(results);
      setShowSearchResults(true);
    } else {
      setSearchResults([]);
      setShowSearchResults(false);
    }
  }, [searchQuery, selectedCategory]);

  // Close search results on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setShowSearchResults(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  // Generate warnings when a drug is selected
  const currentWarnings = useMemo(() => {
    if (!selectedDrug) return [];
    return generatePatientWarnings(selectedDrug, {
      sex: patientContext.sex,
      pregnant: patientContext.pregnant,
      lactating: patientContext.lactating,
      age: patientContext.age,
      weight: patientContext.weight,
      gfr: patientContext.gfr,
      hepaticImpairment: patientContext.hepaticImpairment,
      cardiacDisease: patientContext.cardiacDisease,
      allergies: patientContext.allergies,
      comorbidities: patientContext.comorbidities,
      currentMedications: patientContext.currentMedications,
    });
  }, [selectedDrug, patientContext]);

  // Check interactions with existing prescriptions
  const interactionWarnings = useMemo(() => {
    if (!selectedDrug || prescriptions.length === 0) return [];
    const warnings: { severity: 'minor' | 'moderate' | 'major'; effect: string }[] = [];
    prescriptions.forEach(rx => {
      const interactions = checkDrugInteractions(selectedDrug, rx.drug);
      warnings.push(...interactions);
    });
    return warnings;
  }, [selectedDrug, prescriptions]);

  // Select a drug from search
  function handleSelectDrug(drug: BNFDrug) {
    setSelectedDrug(drug);
    setSearchQuery(drug.genericName);
    setShowSearchResults(false);

    // Pre-fill defaults
    const defaultDose = drug.dosage.adult.standard;
    setPrescriptionDose(defaultDose);
    const firstRoute = drug.formulations[0]?.route || 'oral';
    setPrescriptionRoute(firstRoute);
    const firstFreq = drug.dosage.adult.frequency[0] || 'od';
    setPrescriptionFrequency(firstFreq);
    setPrescriptionDuration(drug.dosage.adult.duration || '');
    setPrescriptionInstructions(drug.instructions || '');
  }

  // Add prescription to list
  function handleAddPrescription() {
    if (!selectedDrug || !prescriptionDose) return;

    const hasDanger = currentWarnings.some(w => w.level === 'danger');
    if (hasDanger) {
      const confirmed = window.confirm(
        'WARNING: This drug has CRITICAL safety alerts for this patient.\n\n' +
        currentWarnings.filter(w => w.level === 'danger').map(w => w.message).join('\n\n') +
        '\n\nAre you sure you want to prescribe this drug?'
      );
      if (!confirmed) return;
    }

    const newItem: PrescriptionItem = {
      id: `rx-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      drug: selectedDrug,
      dose: prescriptionDose,
      route: prescriptionRoute,
      frequency: prescriptionFrequency,
      duration: prescriptionDuration,
      instructions: prescriptionInstructions,
      prescribedBy: user?.full_name || user?.username || 'Unknown',
      prescribedAt: new Date().toISOString(),
      warnings: currentWarnings,
    };

    setPrescriptions(prev => [...prev, newItem]);
    // Reset form
    setSelectedDrug(null);
    setSearchQuery('');
    setPrescriptionDose('');
    setPrescriptionRoute('oral');
    setPrescriptionFrequency('od');
    setPrescriptionDuration('');
    setPrescriptionInstructions('');
  }

  // Remove prescription
  function handleRemovePrescription(id: string) {
    setPrescriptions(prev => prev.filter(p => p.id !== id));
  }

  // Save all prescriptions
  async function handleSavePrescriptions() {
    if (prescriptions.length === 0) return;
    try {
      const record = {
        id: `presc-${Date.now()}`,
        patient_id: patientContext.patient_id || '',
        patientName: patientContext.name,
        hospitalNumber: patientContext.hospitalNumber,
        prescriptions: prescriptions.map(p => ({
          drugId: p.drug.id,
          drugName: p.drug.genericName,
          dose: p.dose,
          route: p.route,
          frequency: p.frequency,
          duration: p.duration,
          instructions: p.instructions,
          prescribedBy: p.prescribedBy,
          prescribedAt: p.prescribedAt,
          warnings: p.warnings.map(w => ({ level: w.level, message: w.message })),
        })),
        createdAt: new Date().toISOString(),
        createdBy: user?.full_name || user?.username || 'Unknown',
      };
      await db.table('prescriptions').put(record);
      // Sync to cloud directly via apiClient
      if (navigator.onLine && apiClient.getToken()) {
        try {
          await apiClient.createPrescription(record);
        } catch (e) {
          console.warn('Cloud sync failed, queuing for later:', e);
          const localId = record.id || Date.now();
          await syncService.queueAction('create', 'prescriptions', localId as number, record);
        }
      } else {
        const localId = record.id || Date.now();
        await syncService.queueAction('create', 'prescriptions', localId as number, record);
      }
      alert('Prescriptions saved successfully!');
      loadSavedPrescriptions();
    } catch (err) {
      console.error('Failed to save prescriptions:', err);
      alert('Failed to save. Try again.');
    }
  }

  // Print prescription as PDF
  function handlePrintPrescription() {
    if (prescriptions.length === 0) return;

    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    const pageWidth = doc.internal.pageSize.getWidth();
    const margin = 15;
    const contentWidth = pageWidth - margin * 2;
    let y = 20;

    // Header
    doc.setFont('times', 'bold');
    doc.setFontSize(14);
    doc.text('PRESCRIPTION CHART', pageWidth / 2, y, { align: 'center' });
    y += 8;

    doc.setFont('times', 'normal');
    doc.setFontSize(11);
    doc.text('Division of Plastic, Reconstructive & Burn Surgery', pageWidth / 2, y, { align: 'center' });
    y += 6;
    doc.text('University of Nigeria Teaching Hospital (UNTH), Ituku-Ozalla, Enugu', pageWidth / 2, y, { align: 'center' });
    y += 10;

    // Patient info
    doc.setFontSize(10);
    doc.setFont('times', 'bold');
    doc.text('Patient:', margin, y);
    doc.setFont('times', 'normal');
    doc.text(patientContext.name || 'N/A', margin + 20, y);
    doc.setFont('times', 'bold');
    doc.text('Hospital No:', pageWidth / 2, y);
    doc.setFont('times', 'normal');
    doc.text(patientContext.hospitalNumber || 'N/A', pageWidth / 2 + 28, y);
    y += 6;

    if (patientContext.allergies.length > 0) {
      doc.setFont('times', 'bold');
      doc.text('ALLERGIES:', margin, y);
      doc.setFont('times', 'normal');
      doc.text(patientContext.allergies.join(', '), margin + 26, y);
      y += 6;
    }

    // Line
    doc.setLineWidth(0.5);
    doc.line(margin, y, pageWidth - margin, y);
    y += 6;

    // Prescription items
    doc.setFont('times', 'bold');
    doc.setFontSize(10);
    const colDrug = margin;
    const colDose = margin + 55;
    const colRoute = margin + 85;
    const colFreq = margin + 105;
    const colDuration = margin + 135;
    doc.text('Drug', colDrug, y);
    doc.text('Dose', colDose, y);
    doc.text('Route', colRoute, y);
    doc.text('Frequency', colFreq, y);
    doc.text('Duration', colDuration, y);
    y += 2;
    doc.line(margin, y, pageWidth - margin, y);
    y += 5;

    doc.setFont('times', 'normal');
    doc.setFontSize(10);

    prescriptions.forEach(rx => {
      if (y > 260) {
        doc.addPage();
        y = 20;
      }
      doc.text(rx.drug.genericName, colDrug, y, { maxWidth: 50 });
      doc.text(rx.dose, colDose, y, { maxWidth: 25 });
      doc.text(getRouteLabel(rx.route).split(' ')[0], colRoute, y, { maxWidth: 18 });
      doc.text(getFrequencyLabel(rx.frequency).split(' ')[0], colFreq, y, { maxWidth: 28 });
      doc.text(rx.duration || '-', colDuration, y, { maxWidth: 30 });
      y += 5;

      if (rx.instructions) {
        doc.setFont('times', 'italic');
        doc.setFontSize(9);
        const lines = doc.splitTextToSize(`Instructions: ${rx.instructions}`, contentWidth);
        lines.forEach((line: string) => {
          if (y > 270) { doc.addPage(); y = 20; }
          doc.text(line, margin + 4, y);
          y += 4;
        });
        doc.setFont('times', 'normal');
        doc.setFontSize(10);
      }

      // Warnings
      const dangerWarns = rx.warnings.filter(w => w.level === 'danger' || w.level === 'warning');
      if (dangerWarns.length > 0) {
        doc.setFontSize(8);
        dangerWarns.forEach(w => {
          if (y > 270) { doc.addPage(); y = 20; }
          const prefix = w.level === 'danger' ? '!! ' : '! ';
          const wLines = doc.splitTextToSize(`${prefix}${w.message}`, contentWidth - 8);
          wLines.forEach((wl: string) => {
            doc.text(wl, margin + 4, y);
            y += 3.5;
          });
        });
        doc.setFontSize(10);
      }

      y += 3;
    });

    // Footer
    y += 10;
    if (y > 250) { doc.addPage(); y = 20; }
    doc.line(margin, y, margin + 60, y);
    y += 5;
    doc.setFontSize(9);
    doc.text(`Prescriber: ${user?.full_name || user?.username || ''}`, margin, y);
    y += 4;
    doc.text(`Date: ${new Date().toLocaleDateString('en-GB')}`, margin, y);
    y += 4;
    doc.text(`Time: ${new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}`, margin, y);

    doc.save(`Prescription_${patientContext.hospitalNumber || 'chart'}_${new Date().toISOString().slice(0, 10)}.pdf`);
  }

  // Thermal print 80mm prescription
  function handleThermalPrint() {
    if (prescriptions.length === 0) return;

    const thermalWidth = 80;
    const margin = 4;
    const contentWidth = thermalWidth - margin * 2;
    // Calculate height needed
    let estHeight = 60 + prescriptions.length * 30;
    if (patientContext.allergies.length > 0) estHeight += 10;
    estHeight = Math.max(estHeight, 100);

    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: [thermalWidth, estHeight] });
    let y = 6;

    // Header
    doc.setFont('times', 'bold');
    doc.setFontSize(14);
    doc.text('PRESCRIPTION', thermalWidth / 2, y, { align: 'center' });
    y += 5;

    doc.setFontSize(8);
    doc.setFont('times', 'normal');
    doc.text('Plastic, Reconstructive & Burn Surgery', thermalWidth / 2, y, { align: 'center' });
    y += 3.5;
    doc.text('UNTH, Ituku-Ozalla, Enugu', thermalWidth / 2, y, { align: 'center' });
    y += 4;

    // Dashed line
    doc.setLineDashPattern([1, 1], 0);
    doc.line(margin, y, thermalWidth - margin, y);
    doc.setLineDashPattern([], 0);
    y += 4;

    // Patient info
    doc.setFontSize(10);
    doc.setFont('times', 'bold');
    doc.text(patientContext.name || 'N/A', margin, y);
    y += 4;
    doc.setFont('times', 'normal');
    doc.setFontSize(9);
    doc.text(`Hosp No: ${patientContext.hospitalNumber || 'N/A'}`, margin, y);
    if (patientContext.sex) {
      doc.text(`Sex: ${patientContext.sex === 'male' ? 'M' : 'F'}`, thermalWidth / 2, y);
    }
    y += 4;
    if (patientContext.age) {
      doc.text(`Age: ${patientContext.age}yrs`, margin, y);
      y += 4;
    }

    if (patientContext.allergies.length > 0) {
      doc.setFont('times', 'bold');
      doc.setFontSize(9);
      doc.text(`ALLERGIES: ${patientContext.allergies.join(', ')}`, margin, y, { maxWidth: contentWidth });
      y += 4;
      doc.setFont('times', 'normal');
    }

    // Dashed line
    doc.setLineDashPattern([1, 1], 0);
    doc.line(margin, y, thermalWidth - margin, y);
    doc.setLineDashPattern([], 0);
    y += 4;

    // Prescriptions
    doc.setFontSize(10);
    prescriptions.forEach((rx, idx) => {
      if (y > estHeight - 20) {
        doc.addPage([thermalWidth, estHeight]);
        y = 6;
      }
      doc.setFont('times', 'bold');
      doc.text(`${idx + 1}. ${rx.drug.genericName}`, margin, y, { maxWidth: contentWidth });
      y += 4;
      doc.setFont('times', 'normal');
      doc.setFontSize(9);
      doc.text(`${rx.dose} | ${getRouteLabel(rx.route).split(' ')[0]} | ${getFrequencyLabel(rx.frequency).split(' ')[0]}`, margin + 2, y, { maxWidth: contentWidth - 2 });
      y += 3.5;
      if (rx.duration) {
        doc.text(`Duration: ${rx.duration}`, margin + 2, y);
        y += 3.5;
      }
      if (rx.instructions) {
        doc.setFont('times', 'italic');
        doc.setFontSize(8);
        const instrLines = doc.splitTextToSize(rx.instructions, contentWidth - 4);
        instrLines.forEach((line: string) => {
          doc.text(line, margin + 2, y);
          y += 3;
        });
        doc.setFont('times', 'normal');
      }
      doc.setFontSize(10);
      y += 2;
    });

    // Footer
    y += 2;
    doc.setLineDashPattern([1, 1], 0);
    doc.line(margin, y, thermalWidth - margin, y);
    doc.setLineDashPattern([], 0);
    y += 4;
    doc.setFontSize(8);
    doc.text(`Prescriber: ${user?.full_name || user?.username || ''}`, margin, y);
    y += 3;
    doc.text(`Date: ${new Date().toLocaleDateString('en-GB')} ${new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}`, margin, y);

    doc.save(`Rx_thermal_${patientContext.hospitalNumber || 'chart'}_${new Date().toISOString().slice(0, 10)}.pdf`);
  }

  // Add allergy
  function addAllergy() {
    const val = allergyInput.trim();
    if (val && !patientContext.allergies.includes(val)) {
      setPatientContext(p => ({ ...p, allergies: [...p.allergies, val] }));
      setAllergyInput('');
    }
  }

  // Add current medication
  function addCurrentMed() {
    const val = medInput.trim();
    if (val && !patientContext.currentMedications.includes(val)) {
      setPatientContext(p => ({ ...p, currentMedications: [...p.currentMedications, val] }));
      setMedInput('');
    }
  }

  const categories = getDrugCategories();

  // ─── RENDER ─────────────────────────────────────────────────────────────

  return (
    <div className="max-w-7xl mx-auto px-2 sm:px-4 py-4 sm:py-6 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="bg-green-100 p-2 rounded-lg">
            <Pill className="h-6 w-6 text-green-700" />
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Prescriptions</h1>
            <p className="text-sm text-gray-500">WHO-Standard Prescribing with BNF Safety Checks</p>
          </div>
        </div>
        <div className="text-xs text-gray-400">
          {BNF_DRUG_DATABASE.length} drugs in database
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-gray-200">
        {(['prescribe', 'current', 'history'] as const).map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              activeTab === tab
                ? 'border-green-600 text-green-700'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            {tab === 'prescribe' ? 'New Prescription' : tab === 'current' ? 'Current Chart' : 'History'}
          </button>
        ))}
      </div>

      {/* ══════ NEW PRESCRIPTION TAB ══════ */}
      {activeTab === 'prescribe' && (
        <div className="space-y-4">
          {/* Patient Context Panel */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            <button
              onClick={() => setShowPatientForm(!showPatientForm)}
              className="w-full flex items-center justify-between p-4 hover:bg-gray-50"
            >
              <div className="flex items-center gap-2">
                <User className="h-5 w-5 text-green-600" />
                <span className="font-semibold text-gray-900">Patient Information</span>
                {patientContext.name && (
                  <span className="text-sm text-gray-500 ml-2">
                    - {patientContext.name} ({patientContext.hospitalNumber || 'No ID'})
                  </span>
                )}
              </div>
              {showPatientForm ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </button>

            {showPatientForm && (
              <div className="p-4 border-t border-gray-100 space-y-4">
                {/* Patient Search from Database */}
                <div ref={patientSearchRef} className="relative">
                  <label className="block text-xs font-medium text-gray-600 mb-1">Search Patient from Database *</label>
                  <div className="relative">
                    <input
                      type="text"
                      value={patientSearchQuery}
                      onChange={e => { setPatientSearchQuery(e.target.value); setShowPatientDropdown(true); }}
                      onFocus={() => setShowPatientDropdown(true)}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-green-500 focus:border-green-500 pr-10"
                      placeholder="Type patient name or hospital number..."
                    />
                    <Search className="absolute right-3 top-2.5 h-4 w-4 text-gray-400" />
                  </div>
                  {showPatientDropdown && patientSearchQuery && filteredPatients.length > 0 && (
                    <div className="absolute z-20 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                      {filteredPatients.map(patient => (
                        <button
                          key={patient.id || patient.serverId}
                          type="button"
                          onClick={() => selectPatient(patient)}
                          className="w-full text-left px-3 py-2 hover:bg-green-50 border-b border-gray-100 last:border-0"
                        >
                          <div className="font-medium text-sm text-gray-900">
                            {patient.first_name} {patient.last_name}
                          </div>
                          <div className="text-xs text-gray-500">
                            {patient.hospital_number || 'No ID'} | {patient.gender || patient.sex || 'N/A'} | DOB: {patient.date_of_birth ? new Date(patient.date_of_birth).toLocaleDateString('en-GB') : 'N/A'}
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                  {showPatientDropdown && patientSearchQuery && patientSearchQuery.length >= 1 && filteredPatients.length === 0 && (
                    <div className="absolute z-20 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg p-3 text-sm text-gray-500 text-center">
                      No patients found. You can enter details manually below.
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Patient Name *</label>
                    <input
                      type="text"
                      value={patientContext.name}
                      onChange={e => setPatientContext(p => ({ ...p, name: e.target.value }))}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-green-500 focus:border-green-500 bg-gray-50"
                      placeholder="Auto-filled from search"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Hospital Number</label>
                    <input
                      type="text"
                      value={patientContext.hospitalNumber}
                      onChange={e => setPatientContext(p => ({ ...p, hospitalNumber: e.target.value }))}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-green-500 focus:border-green-500 bg-gray-50"
                      placeholder="Auto-filled from search"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Sex</label>
                    <select
                      value={patientContext.sex || ''}
                      onChange={e => setPatientContext(p => ({ ...p, sex: e.target.value }))}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-green-500 focus:border-green-500"
                    >
                      <option value="">Select</option>
                      <option value="male">Male</option>
                      <option value="female">Female</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Age (years)</label>
                    <input
                      type="number"
                      value={patientContext.age || ''}
                      onChange={e => setPatientContext(p => ({ ...p, age: parseInt(e.target.value) || undefined }))}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-green-500 focus:border-green-500"
                      placeholder="Age"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Weight (kg)</label>
                    <input
                      type="number"
                      value={patientContext.weight || ''}
                      onChange={e => setPatientContext(p => ({ ...p, weight: parseFloat(e.target.value) || undefined }))}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-green-500 focus:border-green-500"
                      placeholder="kg"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Serum Creatinine</label>
                    <div className="flex gap-1">
                      <input
                        type="number"
                        step="0.01"
                        value={patientContext.creatinine ?? ''}
                        onChange={e => setPatientContext(p => ({
                          ...p,
                          creatinine: e.target.value === '' ? undefined : parseFloat(e.target.value),
                        }))}
                        className="flex-1 min-w-0 border border-gray-300 rounded-l-lg px-3 py-2 text-sm focus:ring-2 focus:ring-green-500 focus:border-green-500"
                        placeholder={patientContext.creatinineUnit === 'µmol/L' ? 'e.g., 88' : 'e.g., 1.0'}
                      />
                      <select
                        value={patientContext.creatinineUnit || 'mg/dL'}
                        onChange={e => setPatientContext(p => ({ ...p, creatinineUnit: e.target.value as 'mg/dL' | 'µmol/L' }))}
                        className="border border-l-0 border-gray-300 rounded-r-lg px-2 py-2 text-xs bg-gray-50 focus:ring-2 focus:ring-green-500 focus:border-green-500"
                        title="Serum creatinine unit"
                      >
                        <option value="mg/dL">mg/dL</option>
                        <option value="µmol/L">µmol/L</option>
                      </select>
                    </div>
                  </div>
                  <div>
                    <label className="flex items-center justify-between text-xs font-medium text-gray-600 mb-1">
                      <span>
                        eGFR (mL/min)
                        {patientContext.gfrAutoCalculated && (
                          <span className="ml-1 text-[10px] font-normal text-green-700 bg-green-100 px-1.5 py-0.5 rounded">
                            auto (C-G)
                          </span>
                        )}
                      </span>
                      {patientContext.gfr !== undefined && !patientContext.gfrAutoCalculated && (
                        <button
                          type="button"
                          onClick={() => setPatientContext(p => ({ ...p, gfr: undefined, gfrAutoCalculated: false }))}
                          className="text-[10px] text-blue-600 hover:underline"
                          title="Clear override and recompute from creatinine"
                        >
                          reset
                        </button>
                      )}
                    </label>
                    <input
                      type="number"
                      value={patientContext.gfr ?? ''}
                      onChange={e => setPatientContext(p => ({
                        ...p,
                        gfr: e.target.value === '' ? undefined : parseFloat(e.target.value),
                        gfrAutoCalculated: false, // manual override
                      }))}
                      className={`w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-green-500 focus:border-green-500 ${
                        patientContext.gfrAutoCalculated
                          ? 'border-green-300 bg-green-50 text-green-900'
                          : 'border-gray-300'
                      }`}
                      placeholder={
                        patientContext.age && patientContext.weight && patientContext.creatinine
                          ? 'Auto-calculating...'
                          : 'Enter creatinine + weight + age'
                      }
                    />
                  </div>
                  <div className="flex items-end gap-4">
                    {patientContext.sex === 'female' && (
                      <>
                        <label className="flex items-center gap-2 text-sm">
                          <input
                            type="checkbox"
                            checked={patientContext.pregnant || false}
                            onChange={e => setPatientContext(p => ({ ...p, pregnant: e.target.checked }))}
                            className="rounded border-gray-300 text-green-600 focus:ring-green-500"
                          />
                          <Baby className="h-4 w-4 text-pink-500" />
                          Pregnant
                        </label>
                        <label className="flex items-center gap-2 text-sm">
                          <input
                            type="checkbox"
                            checked={patientContext.lactating || false}
                            onChange={e => setPatientContext(p => ({ ...p, lactating: e.target.checked }))}
                            className="rounded border-gray-300 text-green-600 focus:ring-green-500"
                          />
                          Lactating
                        </label>
                      </>
                    )}
                  </div>
                  <div className="flex items-end gap-4">
                    <label className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={patientContext.hepaticImpairment || false}
                        onChange={e => setPatientContext(p => ({ ...p, hepaticImpairment: e.target.checked }))}
                        className="rounded border-gray-300 text-green-600 focus:ring-green-500"
                      />
                      Liver Disease
                    </label>
                    <label className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={patientContext.cardiacDisease || false}
                        onChange={e => setPatientContext(p => ({ ...p, cardiacDisease: e.target.checked }))}
                        className="rounded border-gray-300 text-green-600 focus:ring-green-500"
                      />
                      <Heart className="h-4 w-4 text-red-500" />
                      Cardiac
                    </label>
                  </div>
                </div>

                {/* Allergies */}
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Known Allergies</label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={allergyInput}
                      onChange={e => setAllergyInput(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addAllergy(); } }}
                      className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-green-500 focus:border-green-500"
                      placeholder="Type allergy and press Enter"
                    />
                    <button onClick={addAllergy} className="px-3 py-2 bg-red-100 text-red-700 rounded-lg text-sm hover:bg-red-200">
                      Add
                    </button>
                  </div>
                  {patientContext.allergies.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-2">
                      {patientContext.allergies.map(a => (
                        <span key={a} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-red-100 text-red-800 text-xs font-medium">
                          <ShieldAlert className="h-3 w-3" />
                          {a}
                          <button onClick={() => setPatientContext(p => ({ ...p, allergies: p.allergies.filter(x => x !== a) }))} className="hover:text-red-600">
                            <X className="h-3 w-3" />
                          </button>
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                {/* Current Medications */}
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Current Medications (for interaction checking)</label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={medInput}
                      onChange={e => setMedInput(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addCurrentMed(); } }}
                      className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-green-500 focus:border-green-500"
                      placeholder="Type medication name and press Enter"
                    />
                    <button onClick={addCurrentMed} className="px-3 py-2 bg-blue-100 text-blue-700 rounded-lg text-sm hover:bg-blue-200">
                      Add
                    </button>
                  </div>
                  {patientContext.currentMedications.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-2">
                      {patientContext.currentMedications.map(m => (
                        <span key={m} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-blue-100 text-blue-800 text-xs font-medium">
                          <Pill className="h-3 w-3" />
                          {m}
                          <button onClick={() => setPatientContext(p => ({ ...p, currentMedications: p.currentMedications.filter(x => x !== m) }))} className="hover:text-blue-600">
                            <X className="h-3 w-3" />
                          </button>
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Drug Search Section */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 space-y-4">
            <h3 className="font-semibold text-gray-900 flex items-center gap-2">
              <Search className="h-5 w-5 text-green-600" />
              Search Drug Database
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3" ref={searchRef}>
              <div className="sm:col-span-2 relative">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={e => { setSearchQuery(e.target.value); setSelectedCategory(''); }}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 pl-9 text-sm focus:ring-2 focus:ring-green-500 focus:border-green-500"
                  placeholder="Search by drug name, brand, or class..."
                />
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />

                {/* Search results dropdown */}
                {showSearchResults && searchResults.length > 0 && (
                  <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-80 overflow-y-auto">
                    {searchResults.map(drug => (
                      <button
                        key={drug.id}
                        onClick={() => handleSelectDrug(drug)}
                        className="w-full text-left px-4 py-3 hover:bg-green-50 border-b border-gray-100 last:border-b-0"
                      >
                        <div className="font-medium text-sm text-gray-900">{drug.genericName}</div>
                        <div className="text-xs text-gray-500">
                          {drug.brandNames.join(', ')} | {drug.category}
                          {drug.pregnancyCategory === 'X' && (
                            <span className="ml-2 text-red-600 font-bold">Pregnancy: X</span>
                          )}
                          {drug.pregnancyCategory === 'D' && (
                            <span className="ml-2 text-orange-600 font-bold">Pregnancy: D</span>
                          )}
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <div>
                <select
                  value={selectedCategory}
                  onChange={e => { setSelectedCategory(e.target.value); setSearchQuery(''); }}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-green-500 focus:border-green-500"
                >
                  <option value="">Browse by Category</option>
                  {categories.map(cat => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Selected Drug Details */}
            {selectedDrug && (
              <div className="space-y-4 border-t border-gray-100 pt-4">
                {/* Drug info header */}
                <div className="flex items-start justify-between">
                  <div>
                    <h4 className="text-lg font-bold text-gray-900">{selectedDrug.genericName}</h4>
                    <p className="text-sm text-gray-500">{selectedDrug.brandNames.join(', ')} | {selectedDrug.category}</p>
                  </div>
                  <button
                    onClick={() => setShowDrugDetail(!showDrugDetail)}
                    className="text-xs text-green-600 hover:text-green-800 flex items-center gap-1"
                  >
                    <Info className="h-3 w-3" />
                    {showDrugDetail ? 'Hide details' : 'Full details'}
                  </button>
                </div>

                {/* Safety Badges */}
                <div className="flex flex-wrap gap-2">
                  <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${
                    selectedDrug.pregnancyCategory === 'X' ? 'bg-red-100 text-red-800' :
                    selectedDrug.pregnancyCategory === 'D' ? 'bg-orange-100 text-orange-800' :
                    selectedDrug.pregnancyCategory === 'C' ? 'bg-yellow-100 text-yellow-800' :
                    'bg-green-100 text-green-800'
                  }`}>
                    <Baby className="h-3 w-3" />
                    Pregnancy: {selectedDrug.pregnancyCategory}
                  </span>
                  <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${
                    selectedDrug.lactationSafety === 'avoid' ? 'bg-red-100 text-red-800' :
                    selectedDrug.lactationSafety === 'caution' ? 'bg-yellow-100 text-yellow-800' :
                    'bg-green-100 text-green-800'
                  }`}>
                    Lactation: {selectedDrug.lactationSafety}
                  </span>
                  <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${
                    selectedDrug.renalRisk === 'avoid' ? 'bg-red-100 text-red-800' :
                    selectedDrug.renalRisk === 'dose_adjust' ? 'bg-yellow-100 text-yellow-800' :
                    'bg-green-100 text-green-800'
                  }`}>
                    <KidneyIcon className="h-3 w-3" />
                    Renal: {selectedDrug.renalRisk}
                  </span>
                  <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${
                    selectedDrug.hepaticRisk === 'avoid' ? 'bg-red-100 text-red-800' :
                    selectedDrug.hepaticRisk === 'dose_adjust' ? 'bg-yellow-100 text-yellow-800' :
                    'bg-green-100 text-green-800'
                  }`}>
                    Hepatic: {selectedDrug.hepaticRisk}
                  </span>
                  <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${
                    selectedDrug.cardiacRisk === 'avoid' ? 'bg-red-100 text-red-800' :
                    selectedDrug.cardiacRisk === 'caution' ? 'bg-yellow-100 text-yellow-800' :
                    'bg-green-100 text-green-800'
                  }`}>
                    <Heart className="h-3 w-3" />
                    Cardiac: {selectedDrug.cardiacRisk}
                  </span>
                </div>

                {/* Patient-Specific Warnings */}
                {currentWarnings.length > 0 && (
                  <div className="space-y-2">
                    {currentWarnings.map((w, i) => (
                      <div
                        key={i}
                        className={`flex items-start gap-2 p-3 rounded-lg text-sm ${
                          w.level === 'danger' ? 'bg-red-50 border border-red-200 text-red-800' :
                          w.level === 'warning' ? 'bg-yellow-50 border border-yellow-200 text-yellow-800' :
                          'bg-blue-50 border border-blue-200 text-blue-800'
                        }`}
                      >
                        {w.level === 'danger' ? <AlertTriangle className="h-4 w-4 flex-shrink-0 mt-0.5" /> :
                         w.level === 'warning' ? <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5" /> :
                         <Info className="h-4 w-4 flex-shrink-0 mt-0.5" />}
                        <span>{w.message}</span>
                      </div>
                    ))}
                  </div>
                )}

                {/* Drug-Drug Interaction Warnings */}
                {interactionWarnings.length > 0 && (
                  <div className="space-y-2">
                    <h5 className="text-sm font-semibold text-red-700 flex items-center gap-1">
                      <ShieldAlert className="h-4 w-4" />
                      Drug Interactions Detected
                    </h5>
                    {interactionWarnings.map((w, i) => (
                      <div key={i} className={`flex items-start gap-2 p-3 rounded-lg text-sm ${
                        w.severity === 'major' ? 'bg-red-50 border border-red-200 text-red-800' :
                        w.severity === 'moderate' ? 'bg-yellow-50 border border-yellow-200 text-yellow-800' :
                        'bg-blue-50 border border-blue-200 text-blue-800'
                      }`}>
                        <AlertTriangle className="h-4 w-4 flex-shrink-0 mt-0.5" />
                        <span><strong>{w.severity.toUpperCase()}:</strong> {w.effect}</span>
                      </div>
                    ))}
                  </div>
                )}

                {/* Full Drug Details (collapsible) */}
                {showDrugDetail && (
                  <div className="bg-gray-50 rounded-lg p-4 space-y-3 text-sm">
                    <div>
                      <strong>Max daily dose:</strong> {selectedDrug.maxDailyDose}
                    </div>
                    <div>
                      <strong>Standard adult dose:</strong> {selectedDrug.dosage.adult.standard} ({selectedDrug.dosage.adult.min} - {selectedDrug.dosage.adult.max})
                    </div>
                    {selectedDrug.dosage.pediatric && (
                      <div><strong>Paediatric dose:</strong> {selectedDrug.dosage.pediatric.standard}</div>
                    )}
                    {selectedDrug.dosage.elderly && (
                      <div><strong>Elderly dose:</strong> {selectedDrug.dosage.elderly.standard}</div>
                    )}
                    {selectedDrug.dosage.renalImpairment && (
                      <div><strong>Renal adjustment:</strong> {selectedDrug.dosage.renalImpairment.adjustment}</div>
                    )}
                    {selectedDrug.dosage.hepaticImpairment && (
                      <div><strong>Hepatic adjustment:</strong> {selectedDrug.dosage.hepaticImpairment.adjustment}</div>
                    )}
                    <div>
                      <strong>Contraindications:</strong>
                      <ul className="list-disc list-inside ml-2 mt-1">
                        {selectedDrug.contraindications.map((c, i) => <li key={i}>{c}</li>)}
                      </ul>
                    </div>
                    <div>
                      <strong>Common side effects:</strong> {selectedDrug.sideEffects.common.join(', ')}
                    </div>
                    <div>
                      <strong>Serious side effects:</strong> {selectedDrug.sideEffects.serious.join(', ')}
                    </div>
                    {selectedDrug.monitoringRequired && selectedDrug.monitoringRequired.length > 0 && (
                      <div>
                        <strong>Monitoring required:</strong> {selectedDrug.monitoringRequired.join(', ')}
                      </div>
                    )}
                    <div>
                      <strong>Precautions:</strong>
                      <ul className="list-disc list-inside ml-2 mt-1">
                        {selectedDrug.precautions.map((p, i) => <li key={i}>{p}</li>)}
                      </ul>
                    </div>
                  </div>
                )}

                {/* Prescription Form */}
                <div className="bg-green-50 rounded-lg p-4 space-y-3 border border-green-200">
                  <h5 className="font-semibold text-green-800 flex items-center gap-2">
                    <Plus className="h-4 w-4" />
                    Prescribe {selectedDrug.genericName}
                  </h5>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-green-700 mb-1">Dose *</label>
                      <input
                        type="text"
                        value={prescriptionDose}
                        onChange={e => setPrescriptionDose(e.target.value)}
                        className="w-full border border-green-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-green-500 bg-white"
                        placeholder="e.g. 500mg"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-green-700 mb-1">Route *</label>
                      <select
                        value={prescriptionRoute}
                        onChange={e => setPrescriptionRoute(e.target.value as DrugRoute)}
                        className="w-full border border-green-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-green-500 bg-white"
                      >
                        {selectedDrug.formulations.map((f, i) => (
                          <option key={i} value={f.route}>{getRouteLabel(f.route)} ({f.form})</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-green-700 mb-1">Frequency *</label>
                      <select
                        value={prescriptionFrequency}
                        onChange={e => setPrescriptionFrequency(e.target.value as DrugFrequency)}
                        className="w-full border border-green-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-green-500 bg-white"
                      >
                        {selectedDrug.dosage.adult.frequency.map(f => (
                          <option key={f} value={f}>{getFrequencyLabel(f)}</option>
                        ))}
                        {/* Also offer commonly used frequencies not in the drug's default */}
                        {(['stat', 'prn'] as DrugFrequency[]).filter(f => !selectedDrug!.dosage.adult.frequency.includes(f)).map(f => (
                          <option key={f} value={f}>{getFrequencyLabel(f)}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-green-700 mb-1">Duration</label>
                      <input
                        type="text"
                        value={prescriptionDuration}
                        onChange={e => setPrescriptionDuration(e.target.value)}
                        className="w-full border border-green-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-green-500 bg-white"
                        placeholder="e.g. 5 days"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-green-700 mb-1">Special Instructions</label>
                    <textarea
                      value={prescriptionInstructions}
                      onChange={e => setPrescriptionInstructions(e.target.value)}
                      className="w-full border border-green-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-green-500 bg-white"
                      rows={2}
                      placeholder="Additional instructions for patient/nurse..."
                    />
                  </div>
                  <button
                    onClick={handleAddPrescription}
                    disabled={!prescriptionDose}
                    className="w-full sm:w-auto px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium text-sm flex items-center gap-2 justify-center"
                  >
                    <Plus className="h-4 w-4" />
                    Add to Prescription Chart
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Current Prescription Chart */}
          {prescriptions.length > 0 && (
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-gray-900 flex items-center gap-2">
                  <FileText className="h-5 w-5 text-green-600" />
                  Prescription Chart ({prescriptions.length} item{prescriptions.length > 1 ? 's' : ''})
                </h3>
                <div className="flex gap-2">
                  <button
                    onClick={handlePrintPrescription}
                    className="px-3 py-1.5 bg-gray-100 text-gray-700 rounded-lg text-sm hover:bg-gray-200 flex items-center gap-1"
                  >
                    <Printer className="h-4 w-4" />
                    A4 PDF
                  </button>
                  <button
                    onClick={handleThermalPrint}
                    className="px-3 py-1.5 bg-yellow-100 text-yellow-800 rounded-lg text-sm hover:bg-yellow-200 flex items-center gap-1"
                  >
                    <Download className="h-4 w-4" />
                    80mm Print
                  </button>
                  <button
                    onClick={handleSavePrescriptions}
                    className="px-3 py-1.5 bg-green-600 text-white rounded-lg text-sm hover:bg-green-700 flex items-center gap-1"
                  >
                    <Check className="h-4 w-4" />
                    Save
                  </button>
                </div>
              </div>

              <div className="divide-y divide-gray-100">
                {prescriptions.map((rx, idx) => (
                  <div key={rx.id} className="py-3">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-mono text-gray-400">{idx + 1}.</span>
                          <span className="font-semibold text-gray-900">{rx.drug.genericName}</span>
                          <span className="text-sm text-gray-600">
                            {rx.dose} | {getRouteLabel(rx.route).split(' ')[0]} | {getFrequencyLabel(rx.frequency).split(' ')[0]}
                          </span>
                          {rx.duration && <span className="text-sm text-gray-500">x {rx.duration}</span>}
                        </div>
                        {rx.instructions && (
                          <p className="text-xs text-gray-500 mt-1 italic ml-6">{rx.instructions}</p>
                        )}
                        {rx.warnings.filter(w => w.level === 'danger').length > 0 && (
                          <div className="ml-6 mt-1">
                            {rx.warnings.filter(w => w.level === 'danger').map((w, wi) => (
                              <p key={wi} className="text-xs text-red-600 flex items-center gap-1">
                                <AlertTriangle className="h-3 w-3" /> {w.message.slice(0, 100)}...
                              </p>
                            ))}
                          </div>
                        )}
                      </div>
                      <button
                        onClick={() => handleRemovePrescription(rx.id)}
                        className="p-1 text-gray-400 hover:text-red-600"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ══════ CURRENT CHART TAB ══════ */}
      {activeTab === 'current' && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
          {prescriptions.length === 0 ? (
            <div className="text-center py-12 text-gray-400">
              <Pill className="h-12 w-12 mx-auto mb-3 opacity-30" />
              <p className="text-lg font-medium">No active prescriptions</p>
              <p className="text-sm">Switch to "New Prescription" tab to add medications</p>
            </div>
          ) : (
            <div className="space-y-3">
              <h3 className="font-semibold text-gray-900 mb-4">Active Prescription Chart - {patientContext.name || 'Patient'}</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b-2 border-gray-200 text-left">
                      <th className="py-2 pr-3 font-semibold text-gray-700">#</th>
                      <th className="py-2 pr-3 font-semibold text-gray-700">Drug</th>
                      <th className="py-2 pr-3 font-semibold text-gray-700">Dose</th>
                      <th className="py-2 pr-3 font-semibold text-gray-700">Route</th>
                      <th className="py-2 pr-3 font-semibold text-gray-700">Frequency</th>
                      <th className="py-2 pr-3 font-semibold text-gray-700">Duration</th>
                      <th className="py-2 pr-3 font-semibold text-gray-700">Alerts</th>
                    </tr>
                  </thead>
                  <tbody>
                    {prescriptions.map((rx, idx) => (
                      <tr key={rx.id} className="border-b border-gray-100">
                        <td className="py-2 pr-3 text-gray-400">{idx + 1}</td>
                        <td className="py-2 pr-3 font-medium">{rx.drug.genericName}</td>
                        <td className="py-2 pr-3">{rx.dose}</td>
                        <td className="py-2 pr-3">{getRouteLabel(rx.route).split('(')[1]?.replace(')', '') || rx.route}</td>
                        <td className="py-2 pr-3">{getFrequencyLabel(rx.frequency)}</td>
                        <td className="py-2 pr-3">{rx.duration || '-'}</td>
                        <td className="py-2 pr-3">
                          {rx.warnings.filter(w => w.level === 'danger').length > 0 && (
                            <span className="inline-flex items-center gap-1 text-red-600">
                              <AlertTriangle className="h-3 w-3" />
                              {rx.warnings.filter(w => w.level === 'danger').length}
                            </span>
                          )}
                          {rx.warnings.filter(w => w.level === 'warning').length > 0 && (
                            <span className="inline-flex items-center gap-1 text-yellow-600 ml-1">
                              <AlertCircle className="h-3 w-3" />
                              {rx.warnings.filter(w => w.level === 'warning').length}
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="flex justify-end gap-2 mt-4">
                <button
                  onClick={handlePrintPrescription}
                  className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg text-sm hover:bg-gray-200 flex items-center gap-2"
                >
                  <Printer className="h-4 w-4" />
                  A4 PDF
                </button>
                <button
                  onClick={handleThermalPrint}
                  className="px-4 py-2 bg-yellow-100 text-yellow-800 rounded-lg text-sm hover:bg-yellow-200 flex items-center gap-2"
                >
                  <Download className="h-4 w-4" />
                  80mm Print
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ══════ HISTORY TAB ══════ */}
      {activeTab === 'history' && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
          {savedPrescriptions.length === 0 ? (
            <div className="text-center py-12 text-gray-400">
              <Clock className="h-12 w-12 mx-auto mb-3 opacity-30" />
              <p className="text-lg font-medium">No prescription history</p>
              <p className="text-sm">Saved prescriptions will appear here</p>
            </div>
          ) : (
            <div className="space-y-3">
              <h3 className="font-semibold text-gray-900 mb-4">Prescription History</h3>
              {savedPrescriptions
                .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
                .map(record => (
                  <div key={record.id} className="border border-gray-200 rounded-lg">
                    <button
                      onClick={() => setExpandedPrescription(expandedPrescription === record.id ? null : record.id)}
                      className="w-full flex items-center justify-between p-3 hover:bg-gray-50"
                    >
                      <div className="text-left">
                        <div className="font-medium text-sm text-gray-900">
                          {record.patientName || 'Unknown Patient'} - {record.hospitalNumber || 'N/A'}
                        </div>
                        <div className="text-xs text-gray-500">
                          {new Date(record.createdAt).toLocaleString('en-GB')} | {record.prescriptions?.length || 0} items | By: {record.createdBy}
                        </div>
                      </div>
                      <ChevronRight className={`h-4 w-4 text-gray-400 transition-transform ${expandedPrescription === record.id ? 'rotate-90' : ''}`} />
                    </button>
                    {expandedPrescription === record.id && record.prescriptions && (
                      <div className="border-t border-gray-100 p-3 space-y-2">
                        {record.prescriptions.map((rx: any, idx: number) => (
                          <div key={idx} className="text-sm flex items-center gap-3 py-1">
                            <span className="text-gray-400 text-xs w-4">{idx + 1}.</span>
                            <span className="font-medium">{rx.drugName}</span>
                            <span className="text-gray-500">{rx.dose} | {rx.route} | {rx.frequency}</span>
                            {rx.duration && <span className="text-gray-400">x {rx.duration}</span>}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

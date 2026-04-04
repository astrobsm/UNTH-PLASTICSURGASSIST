import React, { useState, useEffect, useRef, useMemo } from 'react';
import { X, Plus, Trash2, AlertTriangle, Info, FileDown, Printer, Search, ChevronDown, Beaker, Activity } from 'lucide-react';
import MedicalAutocompleteTextarea from './MedicalAutocompleteTextarea';
import { format } from 'date-fns';
import { useAuthStore } from '../store/authStore';
import { db } from '../db/database';
import {
  PlannedMedication,
  PlannedInvestigation,
  PlannedProcedureEnhanced,
  PlannedReview,
  MedicalTeamAssignment,
  DischargePlanning,
  treatmentPlanningService
} from '../services/treatmentPlanningService';
import { medicationDosingService, GFRDosingRecommendation } from '../services/medicationDosingService';
import { investigationPdfService } from '../services/investigationPdfService';
import { medicalTeamService, StaffByRole } from '../services/medicalTeamService';
import { searchMedications, getMedicationByName, BNFMedication, MEDICATION_CATEGORIES, checkInteractions } from '../data/bnfMedications';
import { searchInvestigations, getInvestigationByName, Investigation, INVESTIGATION_CATEGORIES, PREOP_PANELS } from '../data/investigationDatabase';

interface ComprehensiveTreatmentPlanFormProps {
  onClose: () => void;
  onSubmit: (data: any) => Promise<void>;
  patients: any[];
}

export const ComprehensiveTreatmentPlanForm: React.FC<ComprehensiveTreatmentPlanFormProps> = ({
  onClose,
  onSubmit,
  patients
}) => {
  const { user } = useAuthStore();
  const [currentStep, setCurrentStep] = useState(1);
  const [loading, setLoading] = useState(true);
  const [existingPlanId, setExistingPlanId] = useState<string | null>(null);
  const [loadingExistingPlan, setLoadingExistingPlan] = useState(false);
  
  // Staff by role - fetched from server API
  const [seniorRegistrars, setSeniorRegistrars] = useState<StaffByRole[]>([]);
  const [registrars, setRegistrars] = useState<StaffByRole[]>([]);
  const [houseOfficers, setHouseOfficers] = useState<StaffByRole[]>([]);
  
  // Fetch medical team from server and auto-assign fairly (least loaded)
  useEffect(() => {
    const fetchTeamAndAutoAssign = async () => {
      try {
        // Fetch staff by role from server (with workload counts)
        const [srData, regData, hoData] = await Promise.all([
          medicalTeamService.getStaffByRole('senior_registrar'),
          medicalTeamService.getStaffByRole('registrar'),
          medicalTeamService.getStaffByRole('house_officer')
        ]);

        setSeniorRegistrars(srData);
        setRegistrars(regData);
        setHouseOfficers(hoData);

        // Get suggested auto-assignment from server (least loaded staff)
        const suggestions = await medicalTeamService.getSuggestedTeamAssignment();

        setMedicalTeam({
          senior_registrar: suggestions.senior_registrar ? String(suggestions.senior_registrar.id) : '',
          registrar: suggestions.registrar ? String(suggestions.registrar.id) : '',
          house_officer: suggestions.house_officer ? String(suggestions.house_officer.id) : '',
          assigned_date: new Date()
        });

        console.log('✅ Auto-assigned medical team fairly:', {
          seniorRegistrar: suggestions.senior_registrar?.full_name || 'None available',
          registrar: suggestions.registrar?.full_name || 'None available',
          houseOfficer: suggestions.house_officer?.full_name || 'None available'
        });
      } catch (error) {
        console.error('Error fetching medical team:', error);
      } finally {
        setLoading(false);
      }
    };
    
    fetchTeamAndAutoAssign();
  }, []);
  
  // Basic Information (must be declared before the useEffect that depends on it)
  const [basicInfo, setBasicInfo] = useState({
    patient_id: '',
    diagnosis: '',
    admission_date: format(new Date(), 'yyyy-MM-dd'),
    notes: ''
  });

  // Auto-fetch existing treatment plan when patient changes
  useEffect(() => {
    if (!basicInfo.patient_id) {
      setExistingPlanId(null);
      return;
    }
    let cancelled = false;
    const fetchExisting = async () => {
      setLoadingExistingPlan(true);
      try {
        const plans = await treatmentPlanningService.getPatientTreatmentPlans(basicInfo.patient_id);
        if (cancelled) return;
        // Find the most recent active plan
        const activePlan = plans
          .filter(p => p.status === 'active' || p.status === 'draft')
          .sort((a, b) => new Date(b.updated_at || b.created_at || 0).getTime() - new Date(a.updated_at || a.created_at || 0).getTime())[0];
        if (activePlan) {
          setExistingPlanId(String(activePlan.id));
          // Pre-populate basic info
          setBasicInfo(prev => ({
            ...prev,
            diagnosis: activePlan.diagnosis || prev.diagnosis,
            admission_date: activePlan.admission_date
              ? format(new Date(activePlan.admission_date), 'yyyy-MM-dd')
              : prev.admission_date,
            notes: activePlan.notes || prev.notes
          }));
          // Pre-populate medical team
          if (activePlan.medical_team) {
            const mt = activePlan.medical_team as any;
            setMedicalTeam(prev => ({
              ...prev,
              senior_registrar: mt.senior_registrar || prev.senior_registrar,
              registrar: mt.registrar || prev.registrar,
              house_officer: mt.house_officer || prev.house_officer,
            }));
          }
          // Pre-populate medications
          const meds = activePlan.planned_medications || activePlan.medications || [];
          if (Array.isArray(meds) && meds.length > 0) {
            setMedications(meds.map((m: any) => ({
              medication_name: m.medication_name || m.name || '',
              dosage: m.dosage || m.dose || '',
              route: m.route || 'oral',
              frequency: m.frequency || '',
              duration: m.duration || '',
              start_date: m.start_date ? new Date(m.start_date) : new Date(),
              notes: m.notes || '',
              status: m.status || 'active'
            })));
          }
          // Pre-populate investigations
          const invs = activePlan.planned_investigations || activePlan.investigations || [];
          if (Array.isArray(invs) && invs.length > 0) {
            setInvestigations(invs.map((inv: any) => ({
              investigation_name: inv.investigation_name || inv.name || '',
              investigation_type: inv.investigation_type || 'lab',
              frequency: inv.frequency || 'once',
              repeat_count: inv.repeat_count || 1,
              target_value: inv.target_value || '',
              target_range: inv.target_range || '',
              ordered_date: inv.ordered_date ? new Date(inv.ordered_date) : new Date(),
              notes: inv.notes || '',
              status: inv.status || 'pending'
            })));
          }
          // Pre-populate procedures
          const procs = activePlan.planned_procedures || activePlan.procedures || [];
          if (Array.isArray(procs) && procs.length > 0) {
            setProcedures(procs.map((p: any) => ({
              procedure_name: p.procedure_name || p.name || '',
              procedure_type: p.procedure_type || 'minor',
              proposed_date: p.proposed_date ? new Date(p.proposed_date) : new Date(),
              proposed_time: p.proposed_time || '',
              frequency: p.frequency,
              repeat_count: p.repeat_count,
              surgeon: p.surgeon || '',
              location: p.location || '',
              notes: p.notes || '',
              status: p.status || 'planned'
            })));
          }
          // Pre-populate reviews
          const revs = activePlan.planned_reviews || activePlan.reviews || [];
          if (Array.isArray(revs) && revs.length > 0) {
            setReviews(revs.map((r: any) => ({
              review_type: r.review_type || 'daily',
              days_of_week: r.days_of_week || { monday: false, tuesday: false, wednesday: false, thursday: false, friday: false, saturday: false, sunday: false },
              start_date: r.start_date ? new Date(r.start_date) : new Date(),
              end_date: r.end_date ? new Date(r.end_date) : undefined,
              assigned_to: r.assigned_to || 'house_officer',
              assigned_person_name: r.assigned_person_name || '',
              status: r.status || 'active'
            })));
          }
          // Pre-populate discharge plan
          if (activePlan.discharge_plan) {
            const dp = activePlan.discharge_plan as any;
            setDischargePlan({
              initial_discharge_date: dp.initial_discharge_date ? new Date(dp.initial_discharge_date) : dischargePlan.initial_discharge_date,
              current_discharge_date: dp.current_discharge_date ? new Date(dp.current_discharge_date) : dischargePlan.current_discharge_date,
              discharge_criteria: dp.discharge_criteria || [],
              extensions: dp.extensions || [],
              status: dp.status || 'on_track'
            });
          }
          console.log('📋 Loaded existing treatment plan for editing:', activePlan.id);
        } else {
          setExistingPlanId(null);
        }
      } catch (error) {
        console.warn('Could not fetch existing treatment plans:', error);
        setExistingPlanId(null);
      } finally {
        if (!cancelled) setLoadingExistingPlan(false);
      }
    };
    fetchExisting();
    return () => { cancelled = true; };
  }, [basicInfo.patient_id]);

  // Medical Team
  const [medicalTeam, setMedicalTeam] = useState<MedicalTeamAssignment>({
    senior_registrar: '',
    registrar: '',
    house_officer: '',
    assigned_date: new Date()
  });

  // Medications
  const [medications, setMedications] = useState<Omit<PlannedMedication, 'id'>[]>([]);
  const [newMed, setNewMed] = useState({
    medication_name: '',
    dosage: '',
    route: 'oral' as const,
    frequency: '',
    duration: '',
    start_date: format(new Date(), 'yyyy-MM-dd'),
    notes: ''
  });
  
  // GFR-based dosing - calculator fields
  const [gfrAge, setGfrAge] = useState<number | ''>('');
  const [gfrGender, setGfrGender] = useState<'male' | 'female'>('male');
  const [gfrWeight, setGfrWeight] = useState<number | ''>('');
  const [gfrCreatinine, setGfrCreatinine] = useState<number | ''>('');
  const [gfrCreatinineUnit, setGfrCreatinineUnit] = useState<'mg/dL' | 'µmol/L'>('µmol/L');

  // Auto-calculate eGFR using Cockcroft-Gault formula (standard for drug dosing)
  const patientGFR: number | '' = useMemo(() => {
    if (!gfrAge || !gfrWeight || !gfrCreatinine || gfrAge <= 0 || gfrWeight <= 0 || gfrCreatinine <= 0) return '';
    // Convert creatinine to mg/dL if in µmol/L
    const creatinineMgDl = gfrCreatinineUnit === 'µmol/L' ? gfrCreatinine / 88.4 : gfrCreatinine;
    if (creatinineMgDl <= 0) return '';
    // Cockcroft-Gault: CrCl = ((140 - age) × weight) / (72 × Scr)  × 0.85 if female
    let gfr = ((140 - gfrAge) * gfrWeight) / (72 * creatinineMgDl);
    if (gfrGender === 'female') gfr *= 0.85;
    return Math.round(gfr);
  }, [gfrAge, gfrGender, gfrWeight, gfrCreatinine, gfrCreatinineUnit]);
  const [gfrRecommendation, setGfrRecommendation] = useState<GFRDosingRecommendation | null>(null);
  
  // BNF Medication Search
  const [medSearchQuery, setMedSearchQuery] = useState('');
  const [medSearchResults, setMedSearchResults] = useState<BNFMedication[]>([]);
  const [showMedDropdown, setShowMedDropdown] = useState(false);
  const [selectedBNFMed, setSelectedBNFMed] = useState<BNFMedication | null>(null);
  const medSearchRef = useRef<HTMLDivElement>(null);
  
  // Investigation Search
  const [invSearchQuery, setInvSearchQuery] = useState('');
  const [invSearchResults, setInvSearchResults] = useState<Investigation[]>([]);
  const [showInvDropdown, setShowInvDropdown] = useState(false);
  const [selectedInvestigation, setSelectedInvestigation] = useState<Investigation | null>(null);
  const [showPanelSelector, setShowPanelSelector] = useState(false);
  const invSearchRef = useRef<HTMLDivElement>(null);
  
  // Click outside to close dropdowns
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (medSearchRef.current && !medSearchRef.current.contains(e.target as Node)) {
        setShowMedDropdown(false);
      }
      if (invSearchRef.current && !invSearchRef.current.contains(e.target as Node)) {
        setShowInvDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);
  
  // Medication search handler
  const handleMedSearch = (query: string) => {
    setMedSearchQuery(query);
    setNewMed({ ...newMed, medication_name: query });
    if (query.length >= 2) {
      const results = searchMedications(query);
      setMedSearchResults(results);
      setShowMedDropdown(results.length > 0);
    } else {
      setMedSearchResults([]);
      setShowMedDropdown(false);
    }
    setSelectedBNFMed(null);
  };
  
  // Select a BNF medication from search results
  const selectBNFMedication = (med: BNFMedication) => {
    setSelectedBNFMed(med);
    setMedSearchQuery(med.name);
    setShowMedDropdown(false);
    
    // Auto-fill fields from BNF data
    const defaultDosage = med.dosages.length > 0 ? med.dosages[0].adult : '';
    const defaultRoute = med.routes.length > 0 ? med.routes[0].toLowerCase() : 'oral';
    const defaultFrequency = med.frequencies.length > 0 ? med.frequencies[0] : '';
    
    // Check for GFR adjustment inline (avoid stale closure from handleMedicationChange)
    if (patientGFR && typeof patientGFR === 'number') {
      const recommendation = medicationDosingService.getDosingRecommendation(
        med.name,
        patientGFR,
        defaultDosage,
        defaultFrequency
      );
      setGfrRecommendation(recommendation);
      
      if (recommendation.adjustedDose && !recommendation.contraindicated) {
        setNewMed(prev => ({
          ...prev,
          medication_name: med.name,
          dosage: recommendation.adjustedDose,
          route: defaultRoute as any,
          frequency: recommendation.adjustedFrequency,
          notes: recommendation.notes || prev.notes
        }));
      } else {
        setNewMed(prev => ({
          ...prev,
          medication_name: med.name,
          dosage: defaultDosage,
          route: defaultRoute as any,
          frequency: defaultFrequency,
        }));
      }
    } else {
      setNewMed(prev => ({
        ...prev,
        medication_name: med.name,
        dosage: defaultDosage,
        route: defaultRoute as any,
        frequency: defaultFrequency,
      }));
      setGfrRecommendation(null);
    }
  };
  
  // Investigation search handler
  const handleInvSearch = (query: string) => {
    setInvSearchQuery(query);
    setNewInv({ ...newInv, investigation_name: query });
    if (query.length >= 1) {
      const results = searchInvestigations(query);
      setInvSearchResults(results);
      setShowInvDropdown(results.length > 0);
    } else {
      setInvSearchResults([]);
      setShowInvDropdown(false);
    }
    setSelectedInvestigation(null);
  };
  
  // Select an investigation from search results
  const selectInvestigation = (inv: Investigation) => {
    setSelectedInvestigation(inv);
    setInvSearchQuery(inv.name);
    setShowInvDropdown(false);
    
    // Auto-fill fields from investigation database
    const typeMap: Record<string, string> = { lab: 'lab', imaging: 'imaging', bedside: 'other', special: 'other' };
    setNewInv(prev => ({
      ...prev,
      investigation_name: inv.name,
      investigation_type: (typeMap[inv.type] || 'lab') as any,
      target_range: inv.normalRange || '',
      notes: inv.preAnalytical ? `Pre-analytical: ${inv.preAnalytical.join('; ')}` : prev.notes,
    }));
  };
  
  // Add entire investigation panel at once
  const addInvestigationPanel = (panelName: string) => {
    const panelItems = PREOP_PANELS[panelName];
    if (!panelItems) return;
    
    const newInvestigations = panelItems.map(invName => {
      const inv = getInvestigationByName(invName);
      const typeMap: Record<string, string> = { lab: 'lab', imaging: 'imaging', bedside: 'other', special: 'other' };
      return {
        investigation_name: invName,
        investigation_type: (inv ? typeMap[inv.type] || 'lab' : 'lab') as 'lab' | 'imaging' | 'other',
        frequency: 'once' as const,
        repeat_count: 1,
        target_value: '',
        target_range: inv?.normalRange || '',
        ordered_date: new Date(),
        notes: '',
        status: 'pending' as const
      };
    });
    
    // Filter out already-added investigations
    const existingNames = investigations.map(i => i.investigation_name.toLowerCase());
    const toAdd = newInvestigations.filter(i => !existingNames.includes(i.investigation_name.toLowerCase()));
    
    if (toAdd.length > 0) {
      setInvestigations([...investigations, ...toAdd]);
    }
    setShowPanelSelector(false);
  };
  
  // Drug-drug interaction check
  const drugInteractions = medications.length >= 2 
    ? checkInteractions(medications.map(m => m.medication_name)) 
    : [];
  
  // Auto-fill dosing based on medication name and GFR
  const handleMedicationChange = (medicationName: string) => {
    setNewMed({ ...newMed, medication_name: medicationName });
    
    if (medicationName && patientGFR && typeof patientGFR === 'number') {
      const recommendation = medicationDosingService.getDosingRecommendation(
        medicationName,
        patientGFR,
        newMed.dosage,
        newMed.frequency
      );
      setGfrRecommendation(recommendation);
      
      // Auto-fill adjusted dose and frequency if available
      if (recommendation.adjustedDose && !recommendation.contraindicated) {
        setNewMed(prev => ({
          ...prev,
          medication_name: medicationName,
          dosage: recommendation.adjustedDose,
          frequency: recommendation.adjustedFrequency,
          notes: recommendation.notes || prev.notes
        }));
      }
    } else {
      setGfrRecommendation(null);
    }
  };
  
  // Update recommendation when GFR changes
  useEffect(() => {
    if (newMed.medication_name && patientGFR && typeof patientGFR === 'number') {
      const recommendation = medicationDosingService.getDosingRecommendation(
        newMed.medication_name,
        patientGFR
      );
      setGfrRecommendation(recommendation);
    }
  }, [patientGFR]);

  // Investigations
  const [investigations, setInvestigations] = useState<Omit<PlannedInvestigation, 'id' | 'scheduled_dates' | 'results'>[]>([]);
  const [newInv, setNewInv] = useState({
    investigation_name: '',
    investigation_type: 'lab' as const,
    frequency: 'once' as const,
    repeat_count: 1,
    target_value: '',
    target_range: '',
    ordered_date: format(new Date(), 'yyyy-MM-dd'),
    notes: ''
  });

  // Procedures
  const [procedures, setProcedures] = useState<Omit<PlannedProcedureEnhanced, 'id' | 'actual_dates'>[]>([]);
  const [newProc, setNewProc] = useState({
    procedure_name: '',
    procedure_type: 'minor' as const,
    proposed_date: format(new Date(), 'yyyy-MM-dd'),
    proposed_time: '',
    frequency: undefined as 'once' | 'daily' | 'alternate_days' | 'weekly' | 'as_needed' | undefined,
    repeat_count: undefined as number | undefined,
    surgeon: '',
    location: '',
    notes: ''
  });

  // Planned Reviews
  const [reviews, setReviews] = useState<Omit<PlannedReview, 'id' | 'completed_reviews' | 'missed_reviews'>[]>([]);
  const [newReview, setNewReview] = useState({
    review_type: 'daily' as const,
    days_of_week: {
      monday: false,
      tuesday: false,
      wednesday: false,
      thursday: false,
      friday: false,
      saturday: false,
      sunday: false
    },
    start_date: format(new Date(), 'yyyy-MM-dd'),
    end_date: '',
    assigned_to: 'house_officer' as const,
    assigned_person_name: ''
  });

  // Auto-fill assigned person name when staff data loads (default role is house_officer)
  useEffect(() => {
    if (medicalTeam.house_officer && houseOfficers.length > 0 && !newReview.assigned_person_name) {
      const ho = houseOfficers.find(h => String(h.id) === medicalTeam.house_officer);
      if (ho) {
        setNewReview(prev => ({ ...prev, assigned_person_name: ho.full_name }));
      }
    }
  }, [medicalTeam.house_officer, houseOfficers]);

  // Discharge Planning
  const [dischargePlan, setDischargePlan] = useState<Partial<DischargePlanning>>({
    initial_discharge_date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    current_discharge_date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    discharge_criteria: [],
    extensions: [],
    status: 'on_track'
  });
  const [newCriterion, setNewCriterion] = useState('');

  // Add Medication
  const addMedication = () => {
    if (!newMed.medication_name || !newMed.dosage || !newMed.frequency) return;
    
    setMedications([...medications, {
      ...newMed,
      start_date: new Date(newMed.start_date),
      status: 'active'
    }]);
    
    setNewMed({
      medication_name: '',
      dosage: '',
      route: 'oral',
      frequency: '',
      duration: '',
      start_date: format(new Date(), 'yyyy-MM-dd'),
      notes: ''
    });
  };

  // Add Investigation
  const addInvestigation = () => {
    if (!newInv.investigation_name) return;
    
    setInvestigations([...investigations, {
      ...newInv,
      ordered_date: new Date(newInv.ordered_date),
      status: 'pending'
    }]);
    
    setNewInv({
      investigation_name: '',
      investigation_type: 'lab',
      frequency: 'once',
      repeat_count: 1,
      target_value: '',
      target_range: '',
      ordered_date: format(new Date(), 'yyyy-MM-dd'),
      notes: ''
    });
  };

  // Add Procedure
  const addProcedure = () => {
    if (!newProc.procedure_name) return;
    
    setProcedures([...procedures, {
      ...newProc,
      proposed_date: new Date(newProc.proposed_date),
      status: 'planned'
    }]);
    
    setNewProc({
      procedure_name: '',
      procedure_type: 'minor',
      proposed_date: format(new Date(), 'yyyy-MM-dd'),
      proposed_time: '',
      frequency: undefined,
      repeat_count: undefined,
      surgeon: '',
      location: '',
      notes: ''
    });
  };

  // Add Review
  const addReview = () => {
    if (!newReview.assigned_person_name) return;
    
    setReviews([...reviews, {
      ...newReview,
      start_date: new Date(newReview.start_date),
      end_date: newReview.end_date ? new Date(newReview.end_date) : undefined,
      status: 'active'
    }]);
    
    setNewReview({
      review_type: 'daily',
      days_of_week: {
        monday: false,
        tuesday: false,
        wednesday: false,
        thursday: false,
        friday: false,
        saturday: false,
        sunday: false
      },
      start_date: format(new Date(), 'yyyy-MM-dd'),
      end_date: '',
      assigned_to: 'house_officer',
      assigned_person_name: ''
    });
  };

  // Add Discharge Criterion
  const addDischargeCriterion = () => {
    if (!newCriterion.trim()) return;
    
    setDischargePlan({
      ...dischargePlan,
      discharge_criteria: [...(dischargePlan.discharge_criteria || []), newCriterion],
      criteria_pending: [...(dischargePlan.criteria_pending || []), newCriterion]
    });
    
    setNewCriterion('');
  };

  // Download Investigation Request PDF
  const downloadInvestigationPDF = (thermal: boolean = true) => {
    if (investigations.length === 0) {
      alert('Please add at least one investigation before downloading the request form.');
      return;
    }

    const patient = patients.find(p => p.id === parseInt(basicInfo.patient_id));
    if (!patient) {
      alert('Please select a patient first.');
      return;
    }

    const patientData = {
      patient_id: patient.id?.toString() || '',
      patient_name: `${patient.first_name} ${patient.last_name}`,
      ward: patient.ward || 'Not specified',
      consultant: patient.assigned_consultant || 'Not assigned',
      hospital_number: patient.hospital_number || patient.id?.toString() || ''
    };

    const investigationsForPdf = investigations.map(inv => ({
      investigation_name: inv.investigation_name,
      investigation_type: inv.investigation_type,
      frequency: inv.frequency,
      repeat_count: inv.repeat_count,
      target_value: inv.target_value,
      notes: inv.notes || '',
      urgency: 'routine' as const
    }));

    const pdfData = {
      patientName: patientData.patient_name,
      hospitalNumber: patientData.hospital_number,
      ward: patientData.ward,
      diagnosis: basicInfo.diagnosis || '',
      investigations: investigationsForPdf,
      requestedBy: user?.name || patientData.consultant || 'N/A',
      requestDate: new Date(),
    };

    if (thermal) {
      investigationPdfService.generateThermalInvestigationRequestPDF(pdfData as any);
    } else {
      investigationPdfService.generateInvestigationRequestPDF(pdfData as any);
    }
  };

  const handleSubmit = async () => {
    // Validate required fields
    if (!basicInfo.patient_id) {
      alert('Please select a patient');
      setCurrentStep(1);
      return;
    }
    
    if (!basicInfo.diagnosis || basicInfo.diagnosis.trim() === '') {
      alert('Diagnosis is required. Please enter a diagnosis before submitting.');
      setCurrentStep(1);
      return;
    }
    
    const patient = patients.find(p => p.id === parseInt(basicInfo.patient_id));
    if (!patient) return;

    const planData = {
      ...basicInfo,
      existingPlanId: existingPlanId || undefined,
      patient_id: parseInt(basicInfo.patient_id),
      patient_name: `${patient.first_name} ${patient.last_name}`,
      hospital_number: patient.hospital_number,
      admission_date: new Date(basicInfo.admission_date),
      title: `Treatment Plan - ${basicInfo.diagnosis.substring(0, 50)}`,
      status: 'active',
      medical_team: {
        ...medicalTeam,
        senior_registrar_name: seniorRegistrars.find(s => String(s.id) === medicalTeam.senior_registrar)?.full_name || '',
        registrar_name: registrars.find(r => String(r.id) === medicalTeam.registrar)?.full_name || '',
        house_officer_name: houseOfficers.find(h => String(h.id) === medicalTeam.house_officer)?.full_name || '',
      },
      planned_medications: medications.map((m, i) => ({ ...m, id: `med_${Date.now()}_${i}` })),
      planned_investigations: investigations.map((inv, i) => ({ 
        ...inv, 
        id: `inv_${Date.now()}_${i}`,
        scheduled_dates: [],
        results: []
      })),
      planned_procedures: procedures.map((p, i) => ({ ...p, id: `proc_${Date.now()}_${i}`, actual_dates: [] })),
      planned_reviews: reviews.map((r, i) => ({ 
        ...r, 
        id: `review_${Date.now()}_${i}`,
        completed_reviews: [],
        missed_reviews: []
      })),
      discharge_plan: {
        ...dischargePlan,
        id: `discharge_${Date.now()}`,
        criteria_met: [],
        criteria_pending: dischargePlan.discharge_criteria || []
      },
      // Legacy fields for compatibility - populate from form data for display
      reviews: reviews.map((r, i) => ({
        id: `review_${Date.now()}_${i}`,
        plan_id: '',
        review_date: r.start_date || new Date(),
        scheduled_date: r.start_date || new Date(),
        assigned_house_officer: r.assigned_person_name || '',
        assigned_to: r.assigned_person_name || r.assigned_to || '',
        status: 'pending',
        notes: `${r.review_type || ''} review`,
        created_at: new Date(),
        updated_at: new Date(),
      })),
      lab_works: investigations.map((inv, i) => ({
        id: `lab_${Date.now()}_${i}`,
        plan_id: '',
        patient_id: parseInt(basicInfo.patient_id),
        test_type: inv.investigation_name,
        frequency: inv.frequency || 'once',
        timeline_start: inv.ordered_date || new Date(),
        scheduled_dates: [],
        completed_dates: [],
        results: [],
        status: inv.status || 'pending',
        created_at: new Date(),
        updated_at: new Date(),
      })),
      procedures: procedures.map((p, i) => ({
        id: `proc_${Date.now()}_${i}`,
        plan_id: '',
        patient_id: parseInt(basicInfo.patient_id),
        procedure_name: p.procedure_name,
        procedure_type: p.procedure_type || 'minor',
        planned_date: p.proposed_date || new Date(),
        proposed_date: p.proposed_date || new Date(),
        status: p.status || 'planned',
        surgeon: p.surgeon || '',
        location: p.location || '',
        notes: p.notes || '',
        created_at: new Date(),
        updated_at: new Date(),
      })),
      medications: medications.map((m, i) => ({
        id: `med_${Date.now()}_${i}`,
        plan_id: '',
        patient_id: parseInt(basicInfo.patient_id),
        medication_name: m.medication_name,
        dosage: m.dosage || '',
        route: m.route || 'oral',
        frequency: m.frequency || '',
        start_date: m.start_date || new Date(),
        end_date: m.end_date,
        status: m.status || 'active',
        created_at: new Date(),
        updated_at: new Date(),
      })),
      created_by: user?.email || 'Unknown'
    };

    await onSubmit(planData);
  };

  const steps = [
    { number: 1, name: 'Basic Info & Team' },
    { number: 2, name: 'Medications' },
    { number: 3, name: 'Investigations' },
    { number: 4, name: 'Procedures' },
    { number: 5, name: 'Reviews' },
    { number: 6, name: 'Discharge Plan' }
  ];

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-0 sm:p-4">
      <div className="bg-white rounded-none sm:rounded-lg shadow-xl sm:max-w-4xl w-full h-full sm:h-auto sm:max-h-[90vh] overflow-y-auto scroll-touch flex flex-col">
        <div className="sticky top-0 bg-white border-b border-gray-200 p-3 sm:p-6 z-10">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg sm:text-2xl font-bold text-gray-900 truncate">Create Comprehensive Treatment Plan</h2>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
              <X className="w-6 h-6" />
            </button>
          </div>
          
          {/* Progress Steps */}
          <div className="steps-scroll">
            {steps.map((step, index) => (
              <div key={step.number} className="flex items-center flex-shrink-0">
                <div className={`flex items-center justify-center w-7 h-7 sm:w-8 sm:h-8 rounded-full flex-shrink-0 ${
                  currentStep >= step.number ? 'bg-green-600 text-white' : 'bg-gray-200 text-gray-600'
                }`}>
                  {step.number}
                </div>
                <span className={`ml-2 text-sm font-medium whitespace-nowrap ${
                  currentStep >= step.number ? 'text-green-600' : 'text-gray-500'
                }`}>
                  {step.name}
                </span>
                {index < steps.length - 1 && (
                  <div className={`w-12 h-1 mx-2 flex-shrink-0 ${
                    currentStep > step.number ? 'bg-green-600' : 'bg-gray-200'
                  }`} />
                )}
              </div>
            ))}
          </div>
        </div>

        <form onSubmit={(e) => e.preventDefault()} onKeyDown={(e) => {
          // Block ALL native form submission from keyboard
          if (e.key === 'Enter' && !(e.target as HTMLElement).matches('textarea')) {
            e.preventDefault();
          }
        }} className="p-3 sm:p-6 flex-1">
          {/* Step 1: Basic Info & Medical Team */}
          {currentStep === 1 && (
            <div className="space-y-6">
              <h3 className="text-lg font-semibold text-gray-900">Basic Information</h3>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Patient *</label>
                  <select
                    required
                    value={basicInfo.patient_id}
                    onChange={(e) => setBasicInfo({ ...basicInfo, patient_id: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
                  >
                    <option value="">Select patient...</option>
                    {patients.map(p => (
                      <option key={p.id} value={p.id}>
                        {p.first_name} {p.last_name} ({p.hospital_number})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Admission Date *</label>
                  <input
                    type="date"
                    required
                    value={basicInfo.admission_date}
                    onChange={(e) => setBasicInfo({ ...basicInfo, admission_date: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
                  />
                </div>
              </div>

              {/* Existing plan banner */}
              {loadingExistingPlan && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 flex items-center gap-2">
                  <div className="animate-spin rounded-full h-4 w-4 border-2 border-blue-600 border-t-transparent" />
                  <span className="text-sm text-blue-700">Checking for existing treatment plans...</span>
                </div>
              )}
              {existingPlanId && !loadingExistingPlan && (
                <div className="bg-amber-50 border border-amber-300 rounded-lg p-4">
                  <div className="flex items-start gap-2">
                    <Info className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="text-sm font-medium text-amber-800">Existing Treatment Plan Found</p>
                      <p className="text-sm text-amber-700 mt-1">
                        This patient already has an active treatment plan (#{existingPlanId}). The form has been pre-populated with the existing data.
                        Edit the fields as needed and submit to update the plan. No duplicate will be created.
                      </p>
                    </div>
                  </div>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Diagnosis *</label>
                <MedicalAutocompleteTextarea
                  required
                  value={basicInfo.diagnosis}
                  onChange={(val) => setBasicInfo({ ...basicInfo, diagnosis: val })}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
                  placeholder="Enter diagnosis..."
                />
              </div>

              <h3 className="text-lg font-semibold text-gray-900 mt-6">Medical Team Assignment</h3>
              <p className="text-sm text-gray-500 mb-2">Team members are auto-assigned fairly based on current workload. You can change the assignment if needed.</p>
              
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Senior Registrar <span className="text-gray-400 text-xs">(optional)</span>
                  </label>
                  <select
                    value={medicalTeam.senior_registrar}
                    onChange={(e) => setMedicalTeam({ ...medicalTeam, senior_registrar: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
                    disabled={loading}
                  >
                    <option value="">-- Select --</option>
                    {seniorRegistrars.map(u => (
                      <option key={u.id} value={String(u.id)}>
                        {u.full_name} ({u.current_patients} pts)
                      </option>
                    ))}
                  </select>
                  {!loading && seniorRegistrars.length === 0 && (
                    <p className="text-xs text-amber-600 mt-1">No senior registrars in database</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Registrar <span className="text-gray-400 text-xs">(optional)</span>
                  </label>
                  <select
                    value={medicalTeam.registrar}
                    onChange={(e) => setMedicalTeam({ ...medicalTeam, registrar: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
                    disabled={loading}
                  >
                    <option value="">-- Select --</option>
                    {registrars.map(u => (
                      <option key={u.id} value={String(u.id)}>
                        {u.full_name} ({u.current_patients} pts)
                      </option>
                    ))}
                  </select>
                  {!loading && registrars.length === 0 && (
                    <p className="text-xs text-amber-600 mt-1">No registrars in database</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    House Officer <span className="text-gray-400 text-xs">(optional)</span>
                  </label>
                  <select
                    value={medicalTeam.house_officer}
                    onChange={(e) => setMedicalTeam({ ...medicalTeam, house_officer: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
                    disabled={loading}
                  >
                    <option value="">-- Select --</option>
                    {houseOfficers.map(u => (
                      <option key={u.id} value={String(u.id)}>
                        {u.full_name} ({u.current_patients} pts)
                      </option>
                    ))}
                  </select>
                  {!loading && houseOfficers.length === 0 && (
                    <p className="text-xs text-amber-600 mt-1">No house officers in database</p>
                  )}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Additional Notes</label>
                <textarea
                  value={basicInfo.notes}
                  onChange={(e) => setBasicInfo({ ...basicInfo, notes: e.target.value })}
                  rows={2}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
                  placeholder="Additional notes..."
                />
              </div>
            </div>
          )}

          {/* Step 2: Medications */}
          {currentStep === 2 && (
            <div className="space-y-6">
              <h3 className="text-lg font-semibold text-gray-900">Medications</h3>
              
              {/* GFR Calculator for Dosing Guidance */}
              <div className="bg-blue-50 border border-blue-200 p-4 rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  <Info className="w-5 h-5 text-blue-600" />
                  <h4 className="font-medium text-blue-900">GFR-Based Dosing Guidance</h4>
                </div>
                <p className="text-sm text-blue-700 mb-3">
                  Enter patient details to auto-calculate GFR (Cockcroft-Gault) for renal dosing adjustments.
                </p>
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Age (years)</label>
                    <input
                      type="number"
                      min="1"
                      max="120"
                      value={gfrAge}
                      onChange={(e) => setGfrAge(e.target.value ? parseInt(e.target.value) : '')}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                      placeholder="e.g., 45"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Gender</label>
                    <select
                      value={gfrGender}
                      onChange={(e) => setGfrGender(e.target.value as 'male' | 'female')}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                    >
                      <option value="male">Male</option>
                      <option value="female">Female</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Weight (kg)</label>
                    <input
                      type="number"
                      min="1"
                      max="300"
                      value={gfrWeight}
                      onChange={(e) => setGfrWeight(e.target.value ? parseFloat(e.target.value) : '')}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                      placeholder="e.g., 70"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">
                      Creatinine
                      <select
                        value={gfrCreatinineUnit}
                        onChange={(e) => setGfrCreatinineUnit(e.target.value as 'mg/dL' | 'µmol/L')}
                        className="ml-1 text-xs text-blue-600 bg-transparent border-none p-0 focus:outline-none cursor-pointer"
                      >
                        <option value="µmol/L">(µmol/L)</option>
                        <option value="mg/dL">(mg/dL)</option>
                      </select>
                    </label>
                    <input
                      type="number"
                      min="0"
                      step="0.1"
                      value={gfrCreatinine}
                      onChange={(e) => setGfrCreatinine(e.target.value ? parseFloat(e.target.value) : '')}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                      placeholder={gfrCreatinineUnit === 'µmol/L' ? 'e.g., 120' : 'e.g., 1.4'}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Calculated GFR</label>
                    <div className={`w-full px-3 py-2 rounded-md text-sm font-semibold text-center ${
                      patientGFR === '' ? 'bg-gray-100 text-gray-400' :
                      patientGFR >= 90 ? 'bg-green-100 text-green-800' :
                      patientGFR >= 60 ? 'bg-yellow-100 text-yellow-800' :
                      patientGFR >= 30 ? 'bg-orange-100 text-orange-800' :
                      'bg-red-100 text-red-800'
                    }`}>
                      {patientGFR === '' ? '—' : `${patientGFR} mL/min`}
                    </div>
                  </div>
                </div>
                {patientGFR !== '' && typeof patientGFR === 'number' && (
                  <div className={`mt-2 text-sm px-3 py-1.5 rounded-md inline-block ${
                    patientGFR >= 90 ? 'bg-green-100 text-green-800' :
                    patientGFR >= 60 ? 'bg-yellow-100 text-yellow-800' :
                    patientGFR >= 30 ? 'bg-orange-100 text-orange-800' :
                    'bg-red-100 text-red-800'
                  }`}>
                    {patientGFR >= 90 ? 'Normal kidney function' :
                     patientGFR >= 60 ? 'Mild decrease (CKD 2)' :
                     patientGFR >= 45 ? 'Mild-moderate decrease (CKD 3a)' :
                     patientGFR >= 30 ? 'Moderate-severe decrease (CKD 3b)' :
                     patientGFR >= 15 ? 'Severe decrease (CKD 4)' : 'Kidney failure (CKD 5)'}
                  </div>
                )}
              </div>
              
              <div className="bg-gray-50 p-4 rounded-lg space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div ref={medSearchRef} className="relative">
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      <Search className="w-3.5 h-3.5 inline mr-1" />
                      Medication Name (BNF)
                    </label>
                    <input
                      type="text"
                      value={medSearchQuery}
                      onChange={(e) => handleMedSearch(e.target.value)}
                      onFocus={() => { if (medSearchResults.length > 0) setShowMedDropdown(true); }}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
                      placeholder="Search BNF... e.g., Paracetamol, Amoxicillin"
                    />
                    {/* BNF Search Results Dropdown */}
                    {showMedDropdown && medSearchResults.length > 0 && (
                      <div className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-64 overflow-y-auto">
                        {medSearchResults.map((med, idx) => (
                          <button
                            key={idx}
                            type="button"
                            onClick={() => selectBNFMedication(med)}
                            className="w-full px-3 py-2 text-left hover:bg-green-50 border-b border-gray-100 last:border-0"
                          >
                            <p className="font-medium text-gray-900 text-sm">{med.name}</p>
                            <p className="text-xs text-gray-500">
                              {med.category} &bull; {med.routes.join(', ')} &bull; {med.frequencies.slice(0, 2).join(', ')}
                            </p>
                            {med.warnings.length > 0 && (
                              <p className="text-xs text-amber-600 mt-0.5">⚠ {med.warnings[0]}</p>
                            )}
                          </button>
                        ))}
                      </div>
                    )}
                    {selectedBNFMed && (
                      <p className="text-xs text-green-700 mt-1">
                        ✓ BNF: {selectedBNFMed.category} &bull; {selectedBNFMed.genericName}
                      </p>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Dosage</label>
                    <input
                      type="text"
                      value={newMed.dosage}
                      onChange={(e) => setNewMed({ ...newMed, dosage: e.target.value })}
                      className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-green-500 ${
                        gfrRecommendation?.contraindicated ? 'border-red-300 bg-red-50' : 'border-gray-300'
                      }`}
                      placeholder="e.g., 1g, 500mg"
                    />
                  </div>
                  
                {/* GFR Recommendation Alert */}
                {gfrRecommendation && patientGFR && (
                  <div className={`col-span-2 p-3 rounded-lg ${
                    gfrRecommendation.contraindicated 
                      ? 'bg-red-50 border border-red-200' 
                      : gfrRecommendation.requiresMonitoring 
                        ? 'bg-amber-50 border border-amber-200'
                        : 'bg-green-50 border border-green-200'
                  }`}>
                    <div className="flex items-start gap-2">
                      <AlertTriangle className={`w-5 h-5 flex-shrink-0 ${
                        gfrRecommendation.contraindicated ? 'text-red-600' : 
                        gfrRecommendation.requiresMonitoring ? 'text-amber-600' : 'text-green-600'
                      }`} />
                      <div>
                        <p className={`font-medium ${
                          gfrRecommendation.contraindicated ? 'text-red-900' : 
                          gfrRecommendation.requiresMonitoring ? 'text-amber-900' : 'text-green-900'
                        }`}>
                          {gfrRecommendation.contraindicated 
                            ? '⚠️ Medication contraindicated in this GFR range'
                            : `GFR-Adjusted Dose: ${gfrRecommendation.adjustedDose} ${gfrRecommendation.adjustedFrequency}`}
                        </p>
                        {gfrRecommendation.notes && (
                          <p className="text-sm mt-1 text-gray-700">{gfrRecommendation.notes}</p>
                        )}
                        {gfrRecommendation.requiresMonitoring && !gfrRecommendation.contraindicated && (
                          <p className="text-sm mt-1 text-amber-700">⚡ Requires monitoring in renal impairment</p>
                        )}
                      </div>
                    </div>
                  </div>
                )}                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Route</label>
                    <select
                      value={newMed.route}
                      onChange={(e) => setNewMed({ ...newMed, route: e.target.value as any })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
                    >
                      <option value="oral">Oral</option>
                      <option value="IV">IV</option>
                      <option value="IM">IM</option>
                      <option value="SC">SC</option>
                      <option value="topical">Topical</option>
                      <option value="rectal">Rectal</option>
                      <option value="sublingual">Sublingual</option>
                      <option value="inhalation">Inhalation</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Frequency</label>
                    <input
                      type="text"
                      value={newMed.frequency}
                      onChange={(e) => setNewMed({ ...newMed, frequency: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
                      placeholder="e.g., TDS, BD, OD, Q6H"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Duration</label>
                    <input
                      type="text"
                      value={newMed.duration}
                      onChange={(e) => setNewMed({ ...newMed, duration: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
                      placeholder="e.g., 7 days, 2 weeks"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Start Date</label>
                    <input
                      type="date"
                      value={newMed.start_date}
                      onChange={(e) => setNewMed({ ...newMed, start_date: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
                    />
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    addMedication();
                    setMedSearchQuery('');
                    setSelectedBNFMed(null);
                  }}
                  className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700"
                >
                  <Plus className="w-4 h-4" />
                  Add Medication
                </button>
                
                {/* BNF Medication Details Panel */}
                {selectedBNFMed && (
                  <div className="bg-blue-50 border border-blue-200 p-3 rounded-lg">
                    <h5 className="font-medium text-blue-900 mb-2">
                      <Activity className="w-4 h-4 inline mr-1" />
                      BNF Details: {selectedBNFMed.name}
                    </h5>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-gray-700">
                      <div><span className="font-medium">Generic:</span> {selectedBNFMed.genericName}</div>
                      <div><span className="font-medium">Category:</span> {selectedBNFMed.category}</div>
                      <div><span className="font-medium">Routes:</span> {selectedBNFMed.routes.join(', ')}</div>
                      <div><span className="font-medium">Frequencies:</span> {selectedBNFMed.frequencies.join(', ')}</div>
                      {selectedBNFMed.maxDailyDose && (
                        <div className="col-span-2"><span className="font-medium">Max Daily Dose:</span> {selectedBNFMed.maxDailyDose}</div>
                      )}
                      {selectedBNFMed.contraindications.length > 0 && (
                        <div className="col-span-2 text-red-700">
                          <span className="font-medium">Contraindications:</span> {selectedBNFMed.contraindications.slice(0, 3).join(', ')}
                        </div>
                      )}
                      {selectedBNFMed.warnings.length > 0 && (
                        <div className="col-span-2 text-amber-700">
                          <span className="font-medium">Warnings:</span> {selectedBNFMed.warnings.slice(0, 2).join('; ')}
                        </div>
                      )}
                      {selectedBNFMed.monitoringRequired && selectedBNFMed.monitoringRequired.length > 0 && (
                        <div className="col-span-2 text-purple-700">
                          <span className="font-medium">Monitoring Required:</span> {selectedBNFMed.monitoringRequired.join(', ')}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Drug Interaction Warnings */}
              {drugInteractions.length > 0 && (
                <div className="bg-red-50 border border-red-200 p-3 rounded-lg">
                  <div className="flex items-center gap-2 mb-2">
                    <AlertTriangle className="w-5 h-5 text-red-600" />
                    <h5 className="font-medium text-red-900">Drug Interaction Warnings</h5>
                  </div>
                  {drugInteractions.map((inter, idx) => (
                    <p key={idx} className="text-sm text-red-800">
                      <span className="font-medium">{inter.med1}</span> ↔ <span className="font-medium">{inter.med2}</span>: {inter.interaction}
                    </p>
                  ))}
                </div>
              )}

              {/* Medications List */}
              {medications.length > 0 && (
                <div className="space-y-2">
                  <h4 className="font-medium text-gray-900">Added Medications ({medications.length})</h4>
                  {medications.map((med, index) => (
                    <div key={index} className="flex items-center justify-between bg-white border border-gray-200 rounded-lg p-3">
                      <div className="flex-1">
                        <p className="font-medium text-gray-900">{med.medication_name}</p>
                        <p className="text-sm text-gray-600">
                          {med.dosage} • {med.route} • {med.frequency} • {med.duration}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => setMedications(medications.filter((_, i) => i !== index))}
                        className="text-red-600 hover:text-red-700 p-2"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Step 3: Investigations */}
          {currentStep === 3 && (
            <div className="space-y-6">
              <h3 className="text-lg font-semibold text-gray-900">
                <Beaker className="w-5 h-5 inline mr-1" />
                Investigations
              </h3>
              
              {/* Quick Panel Selector */}
              <div className="bg-purple-50 border border-purple-200 p-4 rounded-lg">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <Info className="w-5 h-5 text-purple-600" />
                    <h4 className="font-medium text-purple-900">Quick Investigation Panels</h4>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowPanelSelector(!showPanelSelector)}
                    className="flex items-center gap-1 px-3 py-1.5 text-sm bg-purple-600 text-white rounded-md hover:bg-purple-700"
                  >
                    <ChevronDown className={`w-4 h-4 transition-transform ${showPanelSelector ? 'rotate-180' : ''}`} />
                    {showPanelSelector ? 'Hide Panels' : 'Add Panel'}
                  </button>
                </div>
                <p className="text-sm text-purple-700 mb-2">
                  Quickly add standard investigation panels for common clinical scenarios.
                </p>
                {showPanelSelector && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-3">
                    {Object.keys(PREOP_PANELS).map((panelName) => (
                      <button
                        key={panelName}
                        type="button"
                        onClick={() => addInvestigationPanel(panelName)}
                        className="text-left px-3 py-2 bg-white border border-purple-200 rounded-lg hover:bg-purple-100 transition"
                      >
                        <p className="text-sm font-medium text-gray-900">{panelName}</p>
                        <p className="text-xs text-gray-500">{PREOP_PANELS[panelName].length} investigations</p>
                      </button>
                    ))}
                  </div>
                )}
              </div>
              
              <div className="bg-gray-50 p-4 rounded-lg space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div ref={invSearchRef} className="relative">
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      <Search className="w-3.5 h-3.5 inline mr-1" />
                      Investigation Name
                    </label>
                    <input
                      type="text"
                      value={invSearchQuery}
                      onChange={(e) => handleInvSearch(e.target.value)}
                      onFocus={() => { if (invSearchResults.length > 0) setShowInvDropdown(true); }}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
                      placeholder="Search... e.g., FBC, CXR, Blood culture"
                    />
                    {/* Investigation Search Results Dropdown */}
                    {showInvDropdown && invSearchResults.length > 0 && (
                      <div className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-64 overflow-y-auto">
                        {invSearchResults.map((inv, idx) => (
                          <button
                            key={idx}
                            type="button"
                            onClick={() => selectInvestigation(inv)}
                            className="w-full px-3 py-2 text-left hover:bg-green-50 border-b border-gray-100 last:border-0"
                          >
                            <div className="flex items-center justify-between">
                              <p className="font-medium text-gray-900 text-sm">{inv.name}</p>
                              <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${
                                inv.type === 'lab' ? 'bg-blue-100 text-blue-700' :
                                inv.type === 'imaging' ? 'bg-purple-100 text-purple-700' :
                                inv.type === 'bedside' ? 'bg-green-100 text-green-700' :
                                'bg-gray-100 text-gray-700'
                              }`}>{inv.type}</span>
                            </div>
                            <p className="text-xs text-gray-500">
                              {inv.abbreviation !== inv.name && `(${inv.abbreviation}) `}
                              {inv.category} {inv.specimen ? `• ${inv.specimen}` : ''}
                            </p>
                            {inv.turnaroundTime && (
                              <p className="text-xs text-gray-400">TAT: {inv.turnaroundTime}</p>
                            )}
                          </button>
                        ))}
                      </div>
                    )}
                    {selectedInvestigation && (
                      <p className="text-xs text-green-700 mt-1">
                        ✓ {selectedInvestigation.category} • {selectedInvestigation.abbreviation}
                        {selectedInvestigation.specimen && ` • ${selectedInvestigation.specimen}`}
                      </p>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Type</label>
                    <select
                      value={newInv.investigation_type}
                      onChange={(e) => setNewInv({ ...newInv, investigation_type: e.target.value as any })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
                    >
                      <option value="lab">Laboratory</option>
                      <option value="imaging">Imaging</option>
                      <option value="other">Other (Bedside/Special)</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Frequency</label>
                    <select
                      value={newInv.frequency}
                      onChange={(e) => setNewInv({ ...newInv, frequency: e.target.value as any })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
                    >
                      <option value="once">Once</option>
                      <option value="daily">Daily</option>
                      <option value="alternate_days">Alternate Days</option>
                      <option value="twice_weekly">Twice Weekly</option>
                      <option value="weekly">Weekly</option>
                      <option value="biweekly">Biweekly</option>
                      <option value="as_needed">As Needed</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Repeat Count</label>
                    <input
                      type="number"
                      value={newInv.repeat_count}
                      onChange={(e) => setNewInv({ ...newInv, repeat_count: parseInt(e.target.value) })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
                      min="1"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Target Value</label>
                    <input
                      type="text"
                      value={newInv.target_value}
                      onChange={(e) => setNewInv({ ...newInv, target_value: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
                      placeholder="Expected result"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Normal Range</label>
                    <input
                      type="text"
                      value={newInv.target_range}
                      onChange={(e) => setNewInv({ ...newInv, target_range: e.target.value })}
                      className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-green-500 ${
                        selectedInvestigation?.normalRange ? 'border-green-300 bg-green-50' : 'border-gray-300'
                      }`}
                      placeholder="e.g., 4.0-5.5 mmol/L"
                    />
                  </div>
                </div>
                
                {/* Investigation Details Panel */}
                {selectedInvestigation && (
                  <div className="bg-blue-50 border border-blue-200 p-3 rounded-lg">
                    <h5 className="font-medium text-blue-900 mb-2 text-sm">
                      <Beaker className="w-3.5 h-3.5 inline mr-1" />
                      {selectedInvestigation.name} ({selectedInvestigation.abbreviation})
                    </h5>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-gray-700">
                      <div><span className="font-medium">Category:</span> {selectedInvestigation.category}</div>
                      <div><span className="font-medium">Type:</span> {selectedInvestigation.type}</div>
                      {selectedInvestigation.specimen && (
                        <div><span className="font-medium">Specimen:</span> {selectedInvestigation.specimen}</div>
                      )}
                      {selectedInvestigation.turnaroundTime && (
                        <div><span className="font-medium">TAT:</span> {selectedInvestigation.turnaroundTime}</div>
                      )}
                      {selectedInvestigation.normalRange && (
                        <div className="col-span-2"><span className="font-medium">Normal Range:</span> {selectedInvestigation.normalRange}</div>
                      )}
                      {selectedInvestigation.panels && selectedInvestigation.panels.length > 0 && (
                        <div className="col-span-2">
                          <span className="font-medium">Includes:</span> {selectedInvestigation.panels.join(', ')}
                        </div>
                      )}
                      {selectedInvestigation.preAnalytical && selectedInvestigation.preAnalytical.length > 0 && (
                        <div className="col-span-2 text-amber-700">
                          <span className="font-medium">⚠ Pre-analytical:</span> {selectedInvestigation.preAnalytical.join('; ')}
                        </div>
                      )}
                      {selectedInvestigation.cost && (
                        <div>
                          <span className="font-medium">Cost:</span>{' '}
                          <span className={
                            selectedInvestigation.cost === 'low' ? 'text-green-600' :
                            selectedInvestigation.cost === 'moderate' ? 'text-yellow-600' :
                            selectedInvestigation.cost === 'high' ? 'text-orange-600' : 'text-red-600'
                          }>
                            {selectedInvestigation.cost}
                          </span>
                        </div>
                      )}
                      {selectedInvestigation.urgent && (
                        <div className="text-red-600 font-medium">🚨 Available as urgent</div>
                      )}
                    </div>
                  </div>
                )}

                <button
                  type="button"
                  onClick={() => {
                    addInvestigation();
                    setInvSearchQuery('');
                    setSelectedInvestigation(null);
                  }}
                  className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700"
                >
                  <Plus className="w-4 h-4" />
                  Add Investigation
                </button>
              </div>

              {investigations.length > 0 && (
                <div className="space-y-2">
                  <h4 className="font-medium text-gray-900">Added Investigations ({investigations.length})</h4>
                  {investigations.map((inv, index) => (
                    <div key={index} className="flex items-center justify-between bg-white border border-gray-200 rounded-lg p-3">
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <p className="font-medium text-gray-900">{inv.investigation_name}</p>
                          {(() => {
                            const dbInv = getInvestigationByName(inv.investigation_name);
                            return dbInv ? (
                              <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${
                                dbInv.type === 'lab' ? 'bg-blue-100 text-blue-700' :
                                dbInv.type === 'imaging' ? 'bg-purple-100 text-purple-700' :
                                'bg-gray-100 text-gray-700'
                              }`}>{dbInv.abbreviation}</span>
                            ) : null;
                          })()}
                        </div>
                        <p className="text-sm text-gray-600">
                          {inv.investigation_type} • {inv.frequency} • Repeat: {inv.repeat_count}x
                          {inv.target_value && ` • Target: ${inv.target_value}`}
                          {inv.target_range && ` • Range: ${inv.target_range}`}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => setInvestigations(investigations.filter((_, i) => i !== index))}
                        className="text-red-600 hover:text-red-700 p-2"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                  
                  {/* Download Investigation Request Form Buttons */}
                  <div className="flex gap-3 mt-4 pt-4 border-t border-gray-200">
                    <button
                      type="button"
                      onClick={() => downloadInvestigationPDF(true)}
                      className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
                    >
                      <Printer className="w-4 h-4" />
                      Print Thermal (80mm)
                    </button>
                    <button
                      type="button"
                      onClick={() => downloadInvestigationPDF(false)}
                      className="flex items-center gap-2 px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700"
                    >
                      <FileDown className="w-4 h-4" />
                      Download A4 PDF
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Step 4: Procedures */}
          {currentStep === 4 && (
            <div className="space-y-6">
              <h3 className="text-lg font-semibold text-gray-900">Procedures</h3>
              
              <div className="bg-gray-50 p-4 rounded-lg space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Procedure Name</label>
                    <input
                      type="text"
                      value={newProc.procedure_name}
                      onChange={(e) => setNewProc({ ...newProc, procedure_name: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
                      placeholder="e.g., Wound debridement"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Type</label>
                    <select
                      value={newProc.procedure_type}
                      onChange={(e) => setNewProc({ ...newProc, procedure_type: e.target.value as any })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
                    >
                      <option value="minor">Minor</option>
                      <option value="major">Major</option>
                      <option value="diagnostic">Diagnostic</option>
                      <option value="therapeutic">Therapeutic</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Proposed Date</label>
                    <input
                      type="date"
                      value={newProc.proposed_date}
                      onChange={(e) => setNewProc({ ...newProc, proposed_date: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Proposed Time</label>
                    <input
                      type="time"
                      value={newProc.proposed_time}
                      onChange={(e) => setNewProc({ ...newProc, proposed_time: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Frequency (if repeated)</label>
                    <select
                      value={newProc.frequency || ''}
                      onChange={(e) => setNewProc({ ...newProc, frequency: e.target.value as any || undefined })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
                    >
                      <option value="">One-time procedure</option>
                      <option value="daily">Daily</option>
                      <option value="alternate_days">Alternate Days</option>
                      <option value="weekly">Weekly</option>
                      <option value="as_needed">As Needed</option>
                    </select>
                  </div>

                  {newProc.frequency && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Repeat Count</label>
                      <input
                        type="number"
                        value={newProc.repeat_count || 1}
                        onChange={(e) => setNewProc({ ...newProc, repeat_count: parseInt(e.target.value) })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
                        min="1"
                      />
                    </div>
                  )}

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Surgeon</label>
                    <input
                      type="text"
                      value={newProc.surgeon}
                      onChange={(e) => setNewProc({ ...newProc, surgeon: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
                      placeholder="Dr. Name"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Location</label>
                    <input
                      type="text"
                      value={newProc.location}
                      onChange={(e) => setNewProc({ ...newProc, location: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
                      placeholder="e.g., OT 1, Ward"
                    />
                  </div>
                </div>

                <button
                  type="button"
                  onClick={addProcedure}
                  className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700"
                >
                  <Plus className="w-4 h-4" />
                  Add Procedure
                </button>
              </div>

              {procedures.length > 0 && (
                <div className="space-y-2">
                  <h4 className="font-medium text-gray-900">Added Procedures ({procedures.length})</h4>
                  {procedures.map((proc, index) => (
                    <div key={index} className="flex items-center justify-between bg-white border border-gray-200 rounded-lg p-3">
                      <div className="flex-1">
                        <p className="font-medium text-gray-900">{proc.procedure_name}</p>
                        <p className="text-sm text-gray-600">
                          {proc.procedure_type} • {format(new Date(proc.proposed_date), 'MMM d, yyyy')}
                          {proc.frequency && ` • ${proc.frequency}`}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => setProcedures(procedures.filter((_, i) => i !== index))}
                        className="text-red-600 hover:text-red-700 p-2"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Step 5: Reviews */}
          {currentStep === 5 && (
            <div className="space-y-6">
              <h3 className="text-lg font-semibold text-gray-900">Planned Reviews</h3>
              
              <div className="bg-gray-50 p-4 rounded-lg space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Review Type</label>
                    <select
                      value={newReview.review_type}
                      onChange={(e) => setNewReview({ ...newReview, review_type: e.target.value as any })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
                    >
                      <option value="daily">Daily</option>
                      <option value="alternate_days">Alternate Days</option>
                      <option value="weekly">Weekly</option>
                      <option value="biweekly">Biweekly</option>
                      <option value="custom">Custom Days</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Assigned To</label>
                    <select
                      value={newReview.assigned_to}
                      onChange={(e) => {
                        const role = e.target.value;
                        let personName = '';
                        if (role === 'house_officer' && medicalTeam.house_officer) {
                          personName = houseOfficers.find(h => String(h.id) === medicalTeam.house_officer)?.full_name || '';
                        } else if (role === 'registrar' && medicalTeam.registrar) {
                          personName = registrars.find(r => String(r.id) === medicalTeam.registrar)?.full_name || '';
                        } else if (role === 'senior_registrar' && medicalTeam.senior_registrar) {
                          personName = seniorRegistrars.find(s => String(s.id) === medicalTeam.senior_registrar)?.full_name || '';
                        }
                        setNewReview({ ...newReview, assigned_to: role as any, assigned_person_name: personName });
                      }}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
                    >
                      <option value="house_officer">House Officer</option>
                      <option value="registrar">Registrar</option>
                      <option value="senior_registrar">Senior Registrar</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Assigned Person Name</label>
                    <input
                      type="text"
                      value={newReview.assigned_person_name}
                      onChange={(e) => setNewReview({ ...newReview, assigned_person_name: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
                      placeholder="Dr. Name"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Start Date</label>
                    <input
                      type="date"
                      value={newReview.start_date}
                      onChange={(e) => setNewReview({ ...newReview, start_date: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
                    />
                  </div>

                  <div className="col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-2">Days of Week</label>
                    <div className="flex gap-2 flex-wrap">
                      {['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'].map(day => (
                        <label key={day} className="flex items-center gap-2 px-3 py-2 bg-white border border-gray-300 rounded-md cursor-pointer hover:bg-gray-50">
                          <input
                            type="checkbox"
                            checked={newReview.days_of_week[day as keyof typeof newReview.days_of_week]}
                            onChange={(e) => setNewReview({
                              ...newReview,
                              days_of_week: {
                                ...newReview.days_of_week,
                                [day]: e.target.checked
                              }
                            })}
                            className="rounded text-green-600 focus:ring-green-500"
                          />
                          <span className="text-sm capitalize">{day.substring(0, 3)}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={addReview}
                  className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700"
                >
                  <Plus className="w-4 h-4" />
                  Add Review Schedule
                </button>
              </div>

              {reviews.length > 0 && (
                <div className="space-y-2">
                  <h4 className="font-medium text-gray-900">Scheduled Reviews ({reviews.length})</h4>
                  {reviews.map((review, index) => (
                    <div key={index} className="flex items-center justify-between bg-white border border-gray-200 rounded-lg p-3">
                      <div className="flex-1">
                        <p className="font-medium text-gray-900">{review.review_type} - {review.assigned_person_name}</p>
                        <p className="text-sm text-gray-600">
                          {review.assigned_to} • 
                          {Object.entries(review.days_of_week)
                            .filter(([_, checked]) => checked)
                            .map(([day]) => day.substring(0, 3))
                            .join(', ')}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => setReviews(reviews.filter((_, i) => i !== index))}
                        className="text-red-600 hover:text-red-700 p-2"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Step 6: Discharge Planning */}
          {currentStep === 6 && (
            <div className="space-y-6">
              <h3 className="text-lg font-semibold text-gray-900">Discharge Planning</h3>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Proposed Discharge Date *</label>
                  <input
                    type="date"
                    required
                    value={dischargePlan.initial_discharge_date ? format(new Date(dischargePlan.initial_discharge_date), 'yyyy-MM-dd') : ''}
                    onChange={(e) => setDischargePlan({
                      ...dischargePlan,
                      initial_discharge_date: new Date(e.target.value),
                      current_discharge_date: new Date(e.target.value)
                    })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Discharge Criteria</label>
                <div className="flex gap-2 mb-2">
                  <input
                    type="text"
                    value={newCriterion}
                    onChange={(e) => setNewCriterion(e.target.value)}
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
                    placeholder="e.g., Wound healing satisfactory"
                    onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), addDischargeCriterion())}
                  />
                  <button
                    type="button"
                    onClick={addDischargeCriterion}
                    className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700"
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                </div>

                {dischargePlan.discharge_criteria && dischargePlan.discharge_criteria.length > 0 && (
                  <div className="space-y-1">
                    {dischargePlan.discharge_criteria.map((criterion, index) => (
                      <div key={index} className="flex items-center justify-between bg-gray-50 p-2 rounded">
                        <span className="text-sm text-gray-900">{criterion}</span>
                        <button
                          type="button"
                          onClick={() => setDischargePlan({
                            ...dischargePlan,
                            discharge_criteria: dischargePlan.discharge_criteria?.filter((_, i) => i !== index),
                            criteria_pending: dischargePlan.criteria_pending?.filter((_, i) => i !== index)
                          })}
                          className="text-red-600 hover:text-red-700"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <p className="text-sm text-blue-900">
                  💡 Discharge extensions can be added later if targets are not met. The system will track all extensions and reasons.
                </p>
              </div>
            </div>
          )}

          {/* Navigation Buttons */}
          <div className="flex justify-between mt-6 sm:mt-8 pt-4 sm:pt-6 border-t border-gray-200">
            <button
              type="button"
              onClick={() => setCurrentStep(Math.max(1, currentStep - 1))}
              disabled={currentStep === 1}
              className="px-4 sm:px-6 py-2.5 text-sm sm:text-base text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed min-h-[44px]"
            >
              Previous
            </button>

            {currentStep < 6 ? (
              <button
                type="button"
                onClick={() => setCurrentStep(currentStep + 1)}
                className="px-4 sm:px-6 py-2.5 text-sm sm:text-base text-white bg-green-600 rounded-md hover:bg-green-700 min-h-[44px]"
              >
                Next
              </button>
            ) : (
              <button
                type="button"
                onClick={() => handleSubmit()}
                className="px-4 sm:px-6 py-2.5 text-sm sm:text-base text-white bg-green-600 rounded-md hover:bg-green-700 min-h-[44px]"
              >
                {existingPlanId ? 'Update Treatment Plan' : 'Create Treatment Plan'}
              </button>
            )}
          </div>
        </form>
      </div>
    </div>
  );
};

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Activity,
  Camera,
  ChevronDown,
  ChevronUp,
  Clock,
  Download,
  FileText,
  Loader2,
  Plus,
  Printer,
  RefreshCw,
  Ruler,
  Save,
  Search,
  Trash2,
  Upload,
  User,
  X,
  AlertCircle,
  CheckCircle,
  Calendar,
  Droplet,
  Thermometer,
  TrendingUp,
  TrendingDown,
  Minus as TrendingFlat,
  Scissors,
  Heart,
  Eye
} from 'lucide-react';
import { patientService } from '../services/patientService';
import { db } from '../db/database';
import { sanitizeTextForPDF } from '../utils/pdfUtils';

// ============================================
// TYPES & INTERFACES
// ============================================

interface Patient {
  id: string | number;
  hospital_number: string;
  full_name?: string;
  first_name?: string;
  last_name?: string;
  date_of_birth?: string;
  gender?: string;
}

interface WoundPhoto {
  id: string;
  dataUrl: string;
  timestamp: Date;
  measurements?: {
    length: number;
    width: number;
    area: number;
    perimeter: number;
  };
}

interface WoundAssessment {
  id: string;
  patient_id: string;
  patient_name: string;
  hospital_number: string;
  location: string;
  wound_type: string;
  etiology: string;
  length: number;
  width: number;
  depth: number;
  area: number;
  tissue_types: string[];
  granulation_percentage: number;
  exudate_amount: 'none' | 'light' | 'moderate' | 'heavy';
  exudate_type: 'serous' | 'sanguineous' | 'serosanguineous' | 'purulent' | 'none';
  pain_level: number;
  odor_present: boolean;
  periwound_condition: string;
  healing_phase: 'extension' | 'transition' | 'repair';
  healing_progress: 'improving' | 'stable' | 'deteriorating';
  photos: WoundPhoto[];
  dressing_protocol: DressingStep[];
  assessment_date: Date;
  assessed_by: string;
  notes?: string;
  created_at: Date;
  updated_at: Date;
}

interface DressingStep {
  step: number;
  action: string;
  product?: string;
}

interface TreatmentPlan {
  id: string;
  wound_id: string;
  name: string;
  start_date: Date;
  status: 'active' | 'completed' | 'paused';
  frequency: 'daily' | 'alternate_day' | 'weekly';
  notes?: string;
}

// ============================================
// WOUND PHASE DEFINITIONS
// ============================================

const WOUND_PHASES = {
  extension: {
    name: 'Extension Phase',
    description: 'Necrotic and edematous with no evidence of granulation or healthy tissue',
    granulation: '0%',
    frequency: 'Daily',
    color: 'bg-red-100 border-red-500 text-red-800'
  },
  transition: {
    name: 'Transition Phase',
    description: 'Granulation up to 40% of wound surface, edema reduced, discharges minimal',
    granulation: '1-40%',
    frequency: 'Alternate Day',
    color: 'bg-yellow-100 border-yellow-500 text-yellow-800'
  },
  repair: {
    name: 'Repair/Indolent Phase',
    description: 'Active granulation and epithelialization, minimal to no exudate',
    granulation: '>40%',
    frequency: 'Alternate Day',
    color: 'bg-green-100 border-green-500 text-green-800'
  }
};

const WOUND_TYPES = [
  'Pressure Ulcer',
  'Venous Ulcer',
  'Arterial Ulcer',
  'Diabetic Foot Ulcer',
  'Surgical Wound',
  'Traumatic Wound',
  'Burn Wound',
  'Skin Graft Donor Site',
  'Skin Graft Recipient Site',
  'Dehisced Wound',
  'Necrotizing Fasciitis',
  'Other'
];

const TISSUE_TYPES = ['Epithelial', 'Granulation', 'Slough', 'Necrotic', 'Eschar'];

// ============================================
// DRESSING PROTOCOLS
// ============================================

const generateDressingProtocol = (assessment: Partial<WoundAssessment>): DressingStep[] => {
  const steps: DressingStep[] = [];
  
  // Step 1: Always clean
  steps.push({ step: 1, action: 'Clean with Wound Clex Solution' });
  
  // Step 2: First layer based on tissue type
  if (assessment.tissue_types?.includes('Necrotic') || assessment.tissue_types?.includes('Eschar')) {
    steps.push({ step: 2, action: 'Pack with first layer: Hera Gel (for debridement)' });
  } else if (assessment.tissue_types?.includes('Slough')) {
    steps.push({ step: 2, action: 'Pack with first layer: Hera Gel' });
  } else if (assessment.granulation_percentage && assessment.granulation_percentage > 40) {
    steps.push({ step: 2, action: 'Pack with first layer: Woundcare-Honey Gauze' });
  } else {
    steps.push({ step: 2, action: 'Pack with first layer: Hera Gel' });
  }
  
  // Step 3: Second layer
  if (assessment.exudate_amount === 'heavy' || assessment.exudate_amount === 'moderate') {
    steps.push({ step: 3, action: 'Second layer: Woundcare-Honey Gauze (absorbent)' });
  } else {
    steps.push({ step: 3, action: 'Second layer: Woundcare-Honey Gauze' });
  }
  
  // Step 4: Capillary layer
  steps.push({ step: 4, action: 'Capillary layer: Sterile Gauze' });
  
  // Step 5: Absorbent layer
  steps.push({ step: 5, action: 'Absorbent layer: Cotton Wool' });
  
  // Step 6: Secure
  steps.push({ step: 6, action: 'Secure with Crepe Bandage or Plaster' });
  
  return steps;
};

// Skin Graft Recipient Site Protocol - Day 5 Post-Op onwards
const GRAFT_SITE_PROTOCOL: DressingStep[] = [
  { step: 1, action: 'Irrigate using Wound Clex Spray solution' },
  { step: 2, action: 'Apply Sofratulle gauze embedded with Hera Gel' },
  { step: 3, action: 'Overlay with 3 layers of sterile dry gauze' },
  { step: 4, action: 'Secure with crepe bandage or plaster as appropriate for the site' }
];

// Skin Graft Donor Site Protocol - Day 5 Post-Op onwards
const DONOR_SITE_PROTOCOL: DressingStep[] = [
  { step: 1, action: 'After surgeon removes last Sofratulle layer of intraoperative dressing:' },
  { step: 2, action: 'Irrigate gently with Wound Clex Solution' },
  { step: 3, action: 'Apply Hera Gel embedded in Sofratulle gauze' },
  { step: 4, action: 'Overlay with 4 layers of sterile dry gauze' },
  { step: 5, action: 'Secure with crepe bandage or plaster as appropriate' }
];

// Warning messages for graft sites
const GRAFT_SITE_WARNINGS = [
  'Handle graft site with extreme care',
  'Do not apply excessive pressure',
  'Monitor for graft failure signs (discoloration, separation)',
  'Next dressing: Day 7'
];

const DONOR_SITE_WARNINGS = [
  'DO NOT force any Sofratulle layer out if stuck and dry',
  'If stuck: Simply trim edges and overlay with sterile dry gauze',
  'Secure with crepe bandage',
  'When removing primary intraoperative dressings, do so CAREFULLY',
  'DO NOT attempt to moisten with any solution',
  'If stuck and dry, allow it in place'
];

const DONOR_SITE_SPECIAL_INSTRUCTIONS = 'Keep dry. Allow dressing to fall off naturally.';

// ============================================
// MAIN COMPONENT
// ============================================

const WoundCarePage: React.FC = () => {
  // State
  const [activeTab, setActiveTab] = useState<'phases' | 'assessments' | 'new' | 'details'>('phases');
  const [patients, setPatients] = useState<Patient[]>([]);
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);
  const [patientSearch, setPatientSearch] = useState('');
  const [assessments, setAssessments] = useState<WoundAssessment[]>([]);
  const [selectedAssessment, setSelectedAssessment] = useState<WoundAssessment | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [showPhotoModal, setShowPhotoModal] = useState(false);
  const [capturedPhotos, setCapturedPhotos] = useState<WoundPhoto[]>([]);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  
  // New assessment form state
  const [formData, setFormData] = useState({
    location: '',
    wound_type: '',
    etiology: '',
    length: 0,
    width: 0,
    depth: 0,
    tissue_types: [] as string[],
    granulation_percentage: 0,
    exudate_amount: 'light' as 'none' | 'light' | 'moderate' | 'heavy',
    exudate_type: 'serous' as 'serous' | 'sanguineous' | 'serosanguineous' | 'purulent' | 'none',
    pain_level: 5,
    odor_present: false,
    periwound_condition: '',
    notes: ''
  });

  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Load patients and assessments
  useEffect(() => {
    loadPatients();
    loadAssessments();
  }, []);

  const loadPatients = async () => {
    try {
      const allPatients = await patientService.getAllPatients();
      setPatients(allPatients);
    } catch (error) {
      console.error('Error loading patients:', error);
    }
  };

  const loadAssessments = async () => {
    try {
      const woundCareRecords = await db.wound_care.toArray();
      setAssessments(woundCareRecords as WoundAssessment[]);
    } catch (error) {
      console.error('Error loading assessments:', error);
    }
  };

  // Calculate healing phase based on granulation percentage
  const calculateHealingPhase = (granulation: number): 'extension' | 'transition' | 'repair' => {
    if (granulation === 0) return 'extension';
    if (granulation <= 40) return 'transition';
    return 'repair';
  };

  // Calculate area
  const calculateArea = (length: number, width: number): number => {
    return Math.round(length * width * 100) / 100;
  };

  // Filter patients
  const filteredPatients = patients.filter(p => {
    const fullName = p.full_name || `${p.first_name || ''} ${p.last_name || ''}`.trim();
    const searchLower = patientSearch.toLowerCase();
    return fullName.toLowerCase().includes(searchLower) || 
           (p.hospital_number || '').toLowerCase().includes(searchLower);
  });

  // Handle photo capture
  const handlePhotoCapture = async () => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    setIsAnalyzing(true);
    
    for (const file of Array.from(files)) {
      const reader = new FileReader();
      reader.onload = async (event) => {
        const dataUrl = event.target?.result as string;
        
        // AI Measurement simulation (in production, use TensorFlow.js)
        const measurements = await simulateAIMeasurement(dataUrl);
        
        const newPhoto: WoundPhoto = {
          id: `photo_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          dataUrl,
          timestamp: new Date(),
          measurements
        };
        
        setCapturedPhotos(prev => [...prev, newPhoto]);
        
        // Auto-fill measurements if this is the first photo
        if (capturedPhotos.length === 0 && measurements) {
          setFormData(prev => ({
            ...prev,
            length: measurements.length,
            width: measurements.width
          }));
        }
      };
      reader.readAsDataURL(file);
    }
    
    setTimeout(() => setIsAnalyzing(false), 2000);
  };

  // Simulate AI wound measurement (placeholder for TensorFlow integration)
  const simulateAIMeasurement = async (imageDataUrl: string): Promise<{
    length: number;
    width: number;
    area: number;
    perimeter: number;
  }> => {
    // In production, this would use TensorFlow.js with a wound segmentation model
    // For now, return simulated measurements
    await new Promise(resolve => setTimeout(resolve, 1500));
    
    const length = Math.round((5 + Math.random() * 10) * 10) / 10;
    const width = Math.round((3 + Math.random() * 8) * 10) / 10;
    
    return {
      length,
      width,
      area: Math.round(length * width * 100) / 100,
      perimeter: Math.round((2 * length + 2 * width) * 100) / 100
    };
  };

  // Save new assessment
  const handleSaveAssessment = async () => {
    if (!selectedPatient) {
      alert('Please select a patient');
      return;
    }
    
    if (!formData.location || !formData.wound_type) {
      alert('Please fill in required fields');
      return;
    }

    setIsSaving(true);
    
    try {
      const patientName = selectedPatient.full_name || 
        `${selectedPatient.first_name || ''} ${selectedPatient.last_name || ''}`.trim();
      
      const healingPhase = calculateHealingPhase(formData.granulation_percentage);
      const area = calculateArea(formData.length, formData.width);
      
      const dressing_protocol = generateDressingProtocol({
        ...formData,
        granulation_percentage: formData.granulation_percentage
      });
      
      const newAssessment: WoundAssessment = {
        id: `wound_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        patient_id: String(selectedPatient.id),
        patient_name: patientName,
        hospital_number: selectedPatient.hospital_number || '',
        location: formData.location,
        wound_type: formData.wound_type,
        etiology: formData.etiology,
        length: formData.length,
        width: formData.width,
        depth: formData.depth,
        area,
        tissue_types: formData.tissue_types,
        granulation_percentage: formData.granulation_percentage,
        exudate_amount: formData.exudate_amount,
        exudate_type: formData.exudate_type,
        pain_level: formData.pain_level,
        odor_present: formData.odor_present,
        periwound_condition: formData.periwound_condition,
        healing_phase: healingPhase,
        healing_progress: 'stable',
        photos: capturedPhotos,
        dressing_protocol,
        assessment_date: new Date(),
        assessed_by: 'Current User',
        notes: formData.notes,
        created_at: new Date(),
        updated_at: new Date()
      };

      await db.wound_care.add(newAssessment as any);
      
      setAssessments(prev => [newAssessment, ...prev]);
      setSelectedAssessment(newAssessment);
      setActiveTab('details');
      
      // Reset form
      setFormData({
        location: '',
        wound_type: '',
        etiology: '',
        length: 0,
        width: 0,
        depth: 0,
        tissue_types: [],
        granulation_percentage: 0,
        exudate_amount: 'light',
        exudate_type: 'serous',
        pain_level: 5,
        odor_present: false,
        periwound_condition: '',
        notes: ''
      });
      setCapturedPhotos([]);
      setSelectedPatient(null);
      
    } catch (error) {
      console.error('Error saving assessment:', error);
      alert('Failed to save assessment');
    } finally {
      setIsSaving(false);
    }
  };

  // Generate thermal PDF for dressing protocol
  const generateThermalProtocolPDF = async (assessment: WoundAssessment, protocolType: 'standard' | 'graft' | 'donor' = 'standard') => {
    const { jsPDF } = await import('jspdf');
    
    const thermalWidth = 80;
    let protocol: DressingStep[];
    let title: string;
    let siteType: string;
    
    if (protocolType === 'graft') {
      protocol = GRAFT_SITE_PROTOCOL;
      title = 'SKIN GRAFT PROTOCOL';
      siteType = 'Skin Graft Recipient Site';
    } else if (protocolType === 'donor') {
      protocol = DONOR_SITE_PROTOCOL;
      title = 'SKIN GRAFT PROTOCOL';
      siteType = 'Skin Graft Donor Site';
    } else {
      protocol = assessment.dressing_protocol;
      title = 'WOUND DRESSING PROTOCOL';
      siteType = assessment.wound_type;
    }
    
    const estimatedHeight = 180 + (protocol.length * 8);
    
    const doc = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: [thermalWidth, estimatedHeight]
    });

    const margin = 3;
    let yPos = margin;

    // Header
    doc.setFont('times', 'bold');
    doc.setFontSize(12);
    doc.text(title, thermalWidth / 2, yPos, { align: 'center' });
    yPos += 6;
    
    doc.setFontSize(10);
    doc.text(siteType, thermalWidth / 2, yPos, { align: 'center' });
    yPos += 5;

    // Divider
    doc.setLineWidth(0.3);
    doc.line(margin, yPos, thermalWidth - margin, yPos);
    yPos += 5;

    // Post-Op Day for graft/donor
    if (protocolType === 'graft' || protocolType === 'donor') {
      doc.setFont('times', 'bold');
      doc.setFontSize(10);
      doc.text('POST-OP DAY: 5', margin, yPos);
      yPos += 6;
    }

    // Patient Info
    doc.setFontSize(10);
    doc.setFont('times', 'normal');
    doc.text(`Patient: ${assessment.patient_name}`, margin, yPos);
    yPos += 4;
    doc.text(`Hosp #: ${assessment.hospital_number}`, margin, yPos);
    yPos += 4;
    doc.text(`Location: ${assessment.location}`, margin, yPos);
    yPos += 4;
    doc.text(`Date: ${new Date().toLocaleDateString()}`, margin, yPos);
    yPos += 4;
    doc.text(`Time: ${new Date().toLocaleTimeString()}`, margin, yPos);
    yPos += 5;

    // Divider
    doc.line(margin, yPos, thermalWidth - margin, yPos);
    yPos += 4;

    // Wound Phase (for standard protocol only)
    if (protocolType === 'standard') {
      const phase = WOUND_PHASES[assessment.healing_phase];
      doc.setFont('times', 'bold');
      doc.setFontSize(10);
      doc.text(`Phase: ${phase.name}`, margin, yPos);
      yPos += 4;
      doc.setFont('times', 'normal');
      doc.setFontSize(9);
      doc.text(`Granulation: ${assessment.granulation_percentage}%`, margin, yPos);
      yPos += 4;
      doc.text(`Dressing: ${phase.frequency}`, margin, yPos);
      yPos += 5;
      doc.line(margin, yPos, thermalWidth - margin, yPos);
      yPos += 4;
    }

    // Protocol Steps Header
    doc.setFont('times', 'bold');
    doc.setFontSize(10);
    doc.text('DRESSING PROTOCOL', margin, yPos);
    yPos += 2;
    doc.line(margin, yPos, thermalWidth - margin, yPos);
    yPos += 5;

    // Protocol Steps
    doc.setFont('times', 'normal');
    doc.setFontSize(10);
    protocol.forEach((step) => {
      const text = `${step.step}. ${step.action}`;
      const lines = doc.splitTextToSize(text, thermalWidth - margin * 2 - 5);
      lines.forEach((line: string) => {
        doc.text(line, margin + 2, yPos);
        yPos += 4;
      });
      yPos += 1;
    });

    // Important warnings for graft sites
    if (protocolType === 'graft' || protocolType === 'donor') {
      yPos += 3;
      doc.line(margin, yPos, thermalWidth - margin, yPos);
      yPos += 4;
      
      doc.setFont('times', 'bold');
      doc.setFontSize(9);
      doc.text('IMPORTANT WARNINGS', margin, yPos);
      yPos += 4;
      
      doc.setFont('times', 'normal');
      doc.setFontSize(8);
      
      if (protocolType === 'graft') {
        const warnings = [
          'â€¢ Handle graft site with extreme care',
          'â€¢ Do not apply excessive pressure',
          'â€¢ Monitor for graft failure signs',
          '  (discoloration, separation)',
          'â€¢ Next dressing: Day 7'
        ];
        warnings.forEach(w => {
          doc.text(w, margin, yPos);
          yPos += 3.5;
        });
      } else {
        // Donor site specific warnings
        const warnings = DONOR_SITE_WARNINGS.map(w => `âš ï¸ ${w}`);
        warnings.forEach(w => {
          const lines = doc.splitTextToSize(w, thermalWidth - margin * 2 - 2);
          lines.forEach((line: string) => {
            doc.text(line, margin, yPos);
            yPos += 3.5;
          });
        });
      }
    }

    // Special Instructions
    yPos += 3;
    doc.line(margin, yPos, thermalWidth - margin, yPos);
    yPos += 4;
    
    doc.setFont('times', 'bold');
    doc.setFontSize(9);
    doc.text('SPECIAL INSTRUCTIONS', margin, yPos);
    yPos += 4;
    
    doc.setFont('times', 'normal');
    doc.setFontSize(8);
    
    // Use specific instructions for donor site
    let specialInstructions: string;
    if (protocolType === 'donor') {
      specialInstructions = DONOR_SITE_SPECIAL_INSTRUCTIONS;
    } else if (protocolType === 'graft') {
      specialInstructions = 'Handle with care. Monitor for graft take.';
    } else {
      specialInstructions = assessment.dressing_protocol.map(s => s.action).join('; ');
    }
    
    const dressLines = doc.splitTextToSize(specialInstructions, thermalWidth - margin * 2);
    dressLines.forEach((line: string) => {
      doc.text(line, margin, yPos);
      yPos += 3.5;
    });

    // Footer with signature line
    yPos += 4;
    doc.line(margin, yPos, thermalWidth - margin, yPos);
    yPos += 4;
    doc.setFontSize(9);
    doc.text(`Assessed by: ${assessment.assessed_by || 'Dr. ___________'}`, margin, yPos);
    yPos += 6;
    doc.text('Signature / Stamp:', margin, yPos);
    yPos += 8;
    doc.line(margin, yPos, thermalWidth / 2, yPos); // Signature line
    yPos += 5;
    doc.setFont('times', 'bold');
    doc.setFontSize(8);
    doc.text('UNTH Plastic & Reconstructive Surgery', thermalWidth / 2, yPos, { align: 'center' });

    // Save
    const filename = `${protocolType === 'graft' ? 'GraftSite' : protocolType === 'donor' ? 'DonorSite' : 'Dressing'}_${assessment.hospital_number}_${new Date().toISOString().split('T')[0]}.pdf`;
    doc.save(filename);
  };

  // Print Rulers helper - 4 full A4 pages with 15cm ruler grids, bold numbers, full-surface coverage
  const printRulers = async () => {
    const { jsPDF } = await import('jspdf');
    
    // A4 dimensions in mm: 210 x 297 (portrait)
    const doc = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4'
    });

    const pageWidth = 210;
    const pageHeight = 297;
    const totalPages = 4;
    const rulerMaxCm = 15; // 15cm ruler
    const gridSizeMm = 150; // 15cm = 150mm
    const cmInMm = 10; // 1cm = 10mm

    const drawRulerPage = (pageNum: number) => {
      // ---- Margins for labels ----
      const labelMarginLeft = 18; // space for left ruler numbers
      const labelMarginTop = 28; // space for top title + ruler numbers
      const labelMarginRight = 18; // space for right ruler numbers
      const labelMarginBottom = 30; // space for bottom ruler numbers + footer

      // ---- Compute grid origin to center the 15cm grid on the page ----
      const availableW = pageWidth - labelMarginLeft - labelMarginRight;
      const availableH = pageHeight - labelMarginTop - labelMarginBottom;
      const gridW = Math.min(gridSizeMm, availableW);
      const gridH = Math.min(gridSizeMm, availableH);
      const startX = labelMarginLeft + (availableW - gridW) / 2;
      const startY = labelMarginTop + (availableH - gridH) / 2;

      // =======================================
      // TITLE
      // =======================================
      doc.setTextColor(0, 0, 0);
      doc.setFontSize(16);
      doc.setFont('helvetica', 'bold');
      doc.text('WOUND MEASUREMENT RULER — 15 cm', pageWidth / 2, 10, { align: 'center' });
      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      doc.text(`Page ${pageNum} of ${totalPages}  •  Print at 100% (Actual Size)  •  1 cm grid squares`, pageWidth / 2, 17, { align: 'center' });
      doc.setFontSize(8);
      doc.text('UNTH Plastic & Reconstructive Surgery Unit', pageWidth / 2, 22, { align: 'center' });

      // =======================================
      // 5mm SUB-GRID LINES (lightest, drawn first)
      // =======================================
      doc.setDrawColor(210, 210, 210);
      doc.setLineWidth(0.1);
      for (let mm = 0; mm <= gridW; mm += 5) {
        if (mm % cmInMm !== 0) { // skip full-cm lines
          doc.line(startX + mm, startY, startX + mm, startY + gridH);
        }
      }
      for (let mm = 0; mm <= gridH; mm += 5) {
        if (mm % cmInMm !== 0) {
          doc.line(startX, startY + mm, startX + gridW, startY + mm);
        }
      }

      // =======================================
      // 1cm GRID LINES
      // =======================================
      for (let cm = 0; cm <= rulerMaxCm; cm++) {
        const offset = cm * cmInMm;
        if (offset > gridW && offset > gridH) continue;

        if (cm % 5 === 0 && cm !== 0) {
          // Every 5cm — heavy dark line
          doc.setDrawColor(0, 0, 0);
          doc.setLineWidth(0.7);
        } else {
          // Normal 1cm lines — medium gray
          doc.setDrawColor(120, 120, 120);
          doc.setLineWidth(0.3);
        }

        // Vertical line
        if (offset <= gridW) {
          doc.line(startX + offset, startY, startX + offset, startY + gridH);
        }
        // Horizontal line
        if (offset <= gridH) {
          doc.line(startX, startY + offset, startX + gridW, startY + offset);
        }
      }

      // =======================================
      // BOLD OUTER BORDER (thick black)
      // =======================================
      doc.setDrawColor(0, 0, 0);
      doc.setLineWidth(1.2);
      doc.rect(startX, startY, gridW, gridH);

      // =======================================
      // RULER NUMBERS — LEFT EDGE (vertical, 0-15)
      // =======================================
      doc.setTextColor(0, 0, 0);
      for (let cm = 0; cm <= rulerMaxCm; cm++) {
        const y = startY + (cm * cmInMm);
        if (y > startY + gridH + 1) break;

        if (cm % 5 === 0) {
          doc.setFontSize(14);
          doc.setFont('helvetica', 'bold');
        } else {
          doc.setFontSize(11);
          doc.setFont('helvetica', 'bold');
        }
        doc.text(`${cm}`, startX - 3, y + 1.5, { align: 'right' });

        // Tick mark
        doc.setDrawColor(0, 0, 0);
        doc.setLineWidth(0.6);
        doc.line(startX - 2, y, startX, y);
      }

      // =======================================
      // RULER NUMBERS — RIGHT EDGE (vertical, 0-15)
      // =======================================
      for (let cm = 0; cm <= rulerMaxCm; cm++) {
        const y = startY + (cm * cmInMm);
        if (y > startY + gridH + 1) break;

        if (cm % 5 === 0) {
          doc.setFontSize(14);
          doc.setFont('helvetica', 'bold');
        } else {
          doc.setFontSize(11);
          doc.setFont('helvetica', 'bold');
        }
        doc.text(`${cm}`, startX + gridW + 3, y + 1.5, { align: 'left' });

        // Tick mark
        doc.setDrawColor(0, 0, 0);
        doc.setLineWidth(0.6);
        doc.line(startX + gridW, y, startX + gridW + 2, y);
      }

      // =======================================
      // RULER NUMBERS — TOP EDGE (horizontal, 0-15)
      // =======================================
      for (let cm = 0; cm <= rulerMaxCm; cm++) {
        const x = startX + (cm * cmInMm);
        if (x > startX + gridW + 1) break;

        if (cm % 5 === 0) {
          doc.setFontSize(14);
          doc.setFont('helvetica', 'bold');
        } else {
          doc.setFontSize(11);
          doc.setFont('helvetica', 'bold');
        }
        doc.text(`${cm}`, x, startY - 4, { align: 'center' });

        // Tick mark
        doc.setDrawColor(0, 0, 0);
        doc.setLineWidth(0.6);
        doc.line(x, startY - 2, x, startY);
      }

      // =======================================
      // RULER NUMBERS — BOTTOM EDGE (horizontal, 0-15)
      // =======================================
      for (let cm = 0; cm <= rulerMaxCm; cm++) {
        const x = startX + (cm * cmInMm);
        if (x > startX + gridW + 1) break;

        if (cm % 5 === 0) {
          doc.setFontSize(14);
          doc.setFont('helvetica', 'bold');
        } else {
          doc.setFontSize(11);
          doc.setFont('helvetica', 'bold');
        }
        doc.text(`${cm}`, x, startY + gridH + 6, { align: 'center' });

        // Tick mark
        doc.setDrawColor(0, 0, 0);
        doc.setLineWidth(0.6);
        doc.line(x, startY + gridH, x, startY + gridH + 2);
      }

      // =======================================
      // "cm" UNIT LABELS on each edge
      // =======================================
      doc.setFontSize(9);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(80, 80, 80);
      doc.text('cm', startX - 3, startY - 6, { align: 'right' });
      doc.text('cm', startX + gridW + 3, startY - 6, { align: 'left' });

      // =======================================
      // 5cm ZONE LABELS (large, faint watermark inside grid)
      // =======================================
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(28);
      doc.setTextColor(235, 235, 235);
      const zones = [
        { label: '5×5', cx: 25, cy: 25 },
        { label: '10×5', cx: 75, cy: 25 },
        { label: '5×10', cx: 25, cy: 75 },
        { label: '10×10', cx: 75, cy: 75 },
        { label: '15×5', cx: 125, cy: 25 },
        { label: '15×10', cx: 125, cy: 75 },
        { label: '5×15', cx: 25, cy: 125 },
        { label: '10×15', cx: 75, cy: 125 },
        { label: '15×15', cx: 125, cy: 125 },
      ];
      zones.forEach(z => {
        if (z.cx <= gridW && z.cy <= gridH) {
          doc.text(z.label, startX + z.cx, startY + z.cy, { align: 'center' });
        }
      });

      // =======================================
      // VERIFICATION SQUARE (exactly 1cm × 1cm)
      // =======================================
      doc.setTextColor(0, 0, 0);
      doc.setDrawColor(0, 0, 0);
      doc.setLineWidth(0.5);
      const verifyX = startX + gridW - 30;
      const verifyY = startY + gridH + 12;
      doc.rect(verifyX, verifyY, 10, 10);
      doc.setFontSize(8);
      doc.setFont('helvetica', 'bold');
      doc.text('Verify: 1cm × 1cm', verifyX + 5, verifyY + 15, { align: 'center' });

      // =======================================
      // FOOTER INSTRUCTIONS
      // =======================================
      doc.setTextColor(0, 0, 0);
      doc.setFontSize(8);
      doc.setFont('helvetica', 'normal');
      const footerY = pageHeight - 20;
      doc.text('Instructions: 1. Print at 100% scale (Actual Size — do NOT fit-to-page)  2. Cut along bold border', startX, footerY);
      doc.text('3. Place ruler flat beside wound  4. Photograph from directly above for AI calibration', startX, footerY + 4);
      doc.setFontSize(7);
      doc.setFont('helvetica', 'bold');
      doc.text(`Page ${pageNum} / ${totalPages}`, pageWidth - 15, footerY + 4, { align: 'right' });
    };

    // Generate 4 pages
    for (let p = 1; p <= totalPages; p++) {
      if (p > 1) doc.addPage('a4', 'portrait');
      drawRulerPage(p);
    }

    doc.save('Wound_15cm_Ruler_Grid_4Pages.pdf');
  };

  // ============================================
  // RENDER FUNCTIONS
  // ============================================

  const renderPhasesTab = () => (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-xl font-bold text-gray-900">Wound Care Management</h2>
          <p className="text-gray-500">AI-powered wound assessment and treatment protocols</p>
        </div>
        <div className="flex space-x-2">
          <button
            onClick={printRulers}
            className="flex items-center px-3 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200"
          >
            <Ruler className="w-4 h-4 mr-2" />
            Print Rulers
          </button>
          <button
            onClick={() => setActiveTab('new')}
            className="flex items-center px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700"
          >
            <Plus className="w-4 h-4 mr-2" />
            New Assessment
          </button>
        </div>
      </div>

      {/* Phase Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {Object.entries(WOUND_PHASES).map(([key, phase]) => (
          <div key={key} className={`p-5 rounded-xl border-2 ${phase.color}`}>
            <h3 className="text-lg font-bold mb-2">{phase.name}</h3>
            <p className="text-sm mb-4">{phase.description}</p>
            <div className="flex justify-between text-sm font-medium">
              <span>Granulation: {phase.granulation}</span>
              <span>{phase.frequency}</span>
            </div>
          </div>
        ))}
      </div>

      {/* Recent Assessments */}
      <div className="bg-white rounded-xl shadow-sm border p-4">
        <h3 className="text-lg font-semibold mb-4">Recent Assessments</h3>
        {assessments.length === 0 ? (
          <p className="text-gray-500 text-center py-8">No wound assessments yet</p>
        ) : (
          <div className="space-y-3">
            {assessments.slice(0, 5).map(assessment => (
              <div
                key={assessment.id}
                onClick={() => {
                  setSelectedAssessment(assessment);
                  setActiveTab('details');
                }}
                className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 cursor-pointer"
              >
                <div>
                  <p className="font-medium">{assessment.patient_name}</p>
                  <p className="text-sm text-gray-500">{assessment.location} - {assessment.wound_type}</p>
                </div>
                <div className="text-right">
                  <span className={`text-xs px-2 py-1 rounded-full ${WOUND_PHASES[assessment.healing_phase].color}`}>
                    {WOUND_PHASES[assessment.healing_phase].name}
                  </span>
                  <p className="text-xs text-gray-400 mt-1">
                    {new Date(assessment.assessment_date).toLocaleDateString()}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );

  const renderNewAssessmentTab = () => (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold">New Wound Assessment</h2>
        <button
          onClick={() => setActiveTab('phases')}
          className="text-gray-500 hover:text-gray-700"
          title="Close form"
        >
          <X className="w-6 h-6" />
        </button>
      </div>

      {/* Patient Selection */}
      <div className="bg-white rounded-xl shadow-sm border p-4">
        <label className="block text-sm font-medium text-gray-700 mb-2">Patient *</label>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
          <input
            type="text"
            value={patientSearch}
            onChange={(e) => setPatientSearch(e.target.value)}
            placeholder="Search patient by name or hospital number..."
            className="w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500"
          />
        </div>
        {patientSearch && filteredPatients.length > 0 && (
          <div className="mt-2 max-h-40 overflow-y-auto border rounded-lg">
            {filteredPatients.slice(0, 5).map(patient => (
              <div
                key={patient.id}
                onClick={() => {
                  setSelectedPatient(patient);
                  setPatientSearch('');
                }}
                className="p-2 hover:bg-gray-100 cursor-pointer"
              >
                <p className="font-medium">{patient.full_name || `${patient.first_name} ${patient.last_name}`}</p>
                <p className="text-sm text-gray-500">#{patient.hospital_number}</p>
              </div>
            ))}
          </div>
        )}
        {selectedPatient && (
          <div className="mt-2 p-3 bg-primary-50 rounded-lg flex items-center justify-between">
            <div>
              <p className="font-medium">{selectedPatient.full_name || `${selectedPatient.first_name} ${selectedPatient.last_name}`}</p>
              <p className="text-sm text-gray-600">#{selectedPatient.hospital_number}</p>
            </div>
            <button onClick={() => setSelectedPatient(null)} className="text-red-500" title="Clear patient selection">
              <X className="w-5 h-5" />
            </button>
          </div>
        )}
      </div>

      {/* Wound Details */}
      <div className="bg-white rounded-xl shadow-sm border p-4 space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Location *</label>
            <input
              type="text"
              value={formData.location}
              onChange={(e) => setFormData(prev => ({ ...prev, location: e.target.value }))}
              placeholder="e.g., Left lower leg"
              className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Wound Type *</label>
            <select
              value={formData.wound_type}
              onChange={(e) => setFormData(prev => ({ ...prev, wound_type: e.target.value }))}
              className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500"
              title="Wound type"
            >
              <option value="">Select type</option>
              {WOUND_TYPES.map(type => (
                <option key={type} value={type}>{type}</option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Etiology *</label>
          <input
            type="text"
            value={formData.etiology}
            onChange={(e) => setFormData(prev => ({ ...prev, etiology: e.target.value }))}
            placeholder="Cause of wound"
            className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500"
          />
        </div>

        {/* Wound Dimensions */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="block text-sm font-medium text-gray-700">Wound Dimensions</label>
            <button
              onClick={handlePhotoCapture}
              className="flex items-center text-sm text-primary-600 hover:text-primary-700"
            >
              <Camera className="w-4 h-4 mr-1" />
              AI Measurement
            </button>
          </div>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-xs text-gray-500 mb-1">Length (cm) *</label>
              <input
                type="number"
                step="0.1"
                value={formData.length || ''}
                onChange={(e) => setFormData(prev => ({ ...prev, length: parseFloat(e.target.value) || 0 }))}
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500"
                title="Wound length in cm"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Width (cm) *</label>
              <input
                type="number"
                step="0.1"
                value={formData.width || ''}
                onChange={(e) => setFormData(prev => ({ ...prev, width: parseFloat(e.target.value) || 0 }))}
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500"
                title="Wound width in cm"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Depth (cm)</label>
              <input
                type="number"
                step="0.1"
                value={formData.depth || ''}
                onChange={(e) => setFormData(prev => ({ ...prev, depth: parseFloat(e.target.value) || 0 }))}
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500"
                title="Wound depth in cm"
              />
            </div>
          </div>
          {formData.length > 0 && formData.width > 0 && (
            <p className="text-sm text-gray-500 mt-2">
              Area: {calculateArea(formData.length, formData.width)} cmÂ²
            </p>
          )}
        </div>

        {/* Tissue Types */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Tissue Types *</label>
          <div className="flex flex-wrap gap-2">
            {TISSUE_TYPES.map(type => (
              <button
                key={type}
                type="button"
                onClick={() => {
                  setFormData(prev => ({
                    ...prev,
                    tissue_types: prev.tissue_types.includes(type)
                      ? prev.tissue_types.filter(t => t !== type)
                      : [...prev.tissue_types, type]
                  }));
                }}
                className={`px-3 py-1 rounded-full text-sm ${
                  formData.tissue_types.includes(type)
                    ? 'bg-primary-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {type}
              </button>
            ))}
          </div>
        </div>

        {/* Granulation Percentage */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Granulation Percentage: {formData.granulation_percentage}%
          </label>
          <input
            type="range"
            min="0"
            max="100"
            value={formData.granulation_percentage}
            onChange={(e) => setFormData(prev => ({ ...prev, granulation_percentage: parseInt(e.target.value) }))}
            className="w-full"
            title="Granulation percentage"
          />
          <div className="flex justify-between text-xs text-gray-500 mt-1">
            <span>0% (Extension)</span>
            <span>40% (Transition)</span>
            <span>100% (Repair)</span>
          </div>
        </div>

        {/* Wound Photos */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Wound Photos</label>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            multiple
            onChange={handleFileUpload}
            className="hidden"
            title="Upload wound photos"
          />
          <div
            onClick={handlePhotoCapture}
            className="border-2 border-dashed rounded-lg p-6 text-center cursor-pointer hover:border-primary-500 hover:bg-primary-50 transition-colors"
          >
            {isAnalyzing ? (
              <div className="flex flex-col items-center">
                <Loader2 className="w-8 h-8 text-primary-600 animate-spin mb-2" />
                <p className="text-primary-600">Analyzing wound image...</p>
              </div>
            ) : (
              <>
                <Upload className="w-8 h-8 text-gray-400 mx-auto mb-2" />
                <p className="text-gray-500">Click to upload wound images</p>
              </>
            )}
          </div>
          {capturedPhotos.length > 0 && (
            <div className="grid grid-cols-3 gap-2 mt-3">
              {capturedPhotos.map(photo => (
                <div key={photo.id} className="relative">
                  <img src={photo.dataUrl} alt="Wound" className="w-full h-24 object-cover rounded-lg" />
                  {photo.measurements && (
                    <div className="absolute bottom-0 left-0 right-0 bg-black bg-opacity-60 text-white text-xs p-1 rounded-b-lg">
                      {photo.measurements.length} x {photo.measurements.width} cm
                    </div>
                  )}
                  <button
                    onClick={() => setCapturedPhotos(prev => prev.filter(p => p.id !== photo.id))}
                    className="absolute top-1 right-1 bg-red-500 text-white rounded-full p-1"
                    title="Remove photo"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Exudate & Pain */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Exudate Amount *</label>
            <div className="flex space-x-2">
              {['none', 'light', 'moderate', 'heavy'].map(amount => (
                <button
                  key={amount}
                  type="button"
                  onClick={() => setFormData(prev => ({ ...prev, exudate_amount: amount as any }))}
                  className={`flex-1 py-2 rounded-lg text-sm capitalize ${
                    formData.exudate_amount === amount
                      ? 'bg-primary-600 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  {amount}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Exudate Type</label>
            <select
              value={formData.exudate_type}
              onChange={(e) => setFormData(prev => ({ ...prev, exudate_type: e.target.value as any }))}
              className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500"
              title="Exudate type"
            >
              <option value="none">None</option>
              <option value="serous">Serous</option>
              <option value="sanguineous">Sanguineous</option>
              <option value="serosanguineous">Serosanguineous</option>
              <option value="purulent">Purulent</option>
            </select>
          </div>
        </div>

        {/* Pain Level */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Pain Level (0-10) *: {formData.pain_level}/10
          </label>
          <input
            type="range"
            min="0"
            max="10"
            value={formData.pain_level}
            onChange={(e) => setFormData(prev => ({ ...prev, pain_level: parseInt(e.target.value) }))}
            className="w-full"
            title="Pain level 0-10"
          />
          <div className="flex justify-between text-xs text-gray-500 mt-1">
            <span>No pain</span>
            <span>5/10</span>
            <span>Worst pain</span>
          </div>
        </div>

        {/* Odor */}
        <div className="flex items-center">
          <input
            type="checkbox"
            id="odor"
            checked={formData.odor_present}
            onChange={(e) => setFormData(prev => ({ ...prev, odor_present: e.target.checked }))}
            className="w-4 h-4 text-primary-600 rounded focus:ring-primary-500"
          />
          <label htmlFor="odor" className="ml-2 text-sm text-gray-700">
            Odor Present - Wound has noticeable odor
          </label>
        </div>

        {/* Peri-wound Condition */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Peri-wound Condition</label>
          <input
            type="text"
            value={formData.periwound_condition}
            onChange={(e) => setFormData(prev => ({ ...prev, periwound_condition: e.target.value }))}
            placeholder="Describe surrounding skin condition..."
            className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500"
          />
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex justify-end space-x-3">
        <button
          onClick={() => setActiveTab('phases')}
          className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200"
        >
          Cancel
        </button>
        <button
          onClick={handleSaveAssessment}
          disabled={isSaving}
          className="px-6 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50 flex items-center"
        >
          {isSaving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
          Save Assessment
        </button>
      </div>
    </div>
  );

  const renderDetailsTab = () => {
    if (!selectedAssessment) {
      return (
        <div className="text-center py-12">
          <p className="text-gray-500">Select an assessment to view details</p>
        </div>
      );
    }

    const assessment = selectedAssessment;
    const phase = WOUND_PHASES[assessment.healing_phase];

    return (
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold">{assessment.patient_name} - {assessment.location.toUpperCase()}</h2>
            <p className="text-gray-500">{assessment.wound_type}</p>
          </div>
          <div className="flex space-x-2">
            <button
              onClick={() => generateThermalProtocolPDF(assessment, 'standard')}
              className="flex items-center px-3 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200"
            >
              <Printer className="w-4 h-4 mr-2" />
              Print Protocol
            </button>
            <button
              onClick={() => generateThermalProtocolPDF(assessment, 'standard')}
              className="flex items-center px-3 py-2 bg-primary-100 text-primary-700 rounded-lg hover:bg-primary-200"
            >
              <Download className="w-4 h-4 mr-2" />
              Export PDF
            </button>
            <button
              onClick={() => setActiveTab('phases')}
              className="text-gray-500 hover:text-gray-700"
              title="Close details"
            >
              <X className="w-6 h-6" />
            </button>
          </div>
        </div>

        {/* Phase Badge */}
        <div className={`p-4 rounded-xl border-2 ${phase.color}`}>
          <h3 className="text-lg font-bold">{phase.name}</h3>
          <p className="text-sm">{phase.description}</p>
          <p className="mt-2 text-sm font-medium">Dressing: {phase.frequency}</p>
        </div>

        {/* Wound Information */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-white rounded-xl shadow-sm border p-4">
            <h4 className="font-semibold mb-3">Wound Information</h4>
            <div className="space-y-2 text-sm">
              <p><span className="text-gray-500">Type:</span> {assessment.wound_type}</p>
              <p><span className="text-gray-500">Etiology:</span> {assessment.etiology}</p>
              <p><span className="text-gray-500">Location:</span> {assessment.location}</p>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm border p-4">
            <h4 className="font-semibold mb-3">Current Measurements</h4>
            <div className="grid grid-cols-4 gap-2 text-center">
              <div className="bg-gray-50 p-2 rounded-lg">
                <p className="text-lg font-bold">{assessment.length.toFixed(2)}</p>
                <p className="text-xs text-gray-500">Length (cm)</p>
              </div>
              <div className="bg-gray-50 p-2 rounded-lg">
                <p className="text-lg font-bold">{assessment.width.toFixed(2)}</p>
                <p className="text-xs text-gray-500">Width (cm)</p>
              </div>
              <div className="bg-gray-50 p-2 rounded-lg">
                <p className="text-lg font-bold">{assessment.depth.toFixed(2)}</p>
                <p className="text-xs text-gray-500">Depth (cm)</p>
              </div>
              <div className="bg-gray-50 p-2 rounded-lg">
                <p className="text-lg font-bold">{assessment.area.toFixed(1)}</p>
                <p className="text-xs text-gray-500">Area (cmÂ²)</p>
              </div>
            </div>
          </div>
        </div>

        {/* Clinical Status */}
        <div className="bg-white rounded-xl shadow-sm border p-4">
          <h4 className="font-semibold mb-3">Clinical Status</h4>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div>
              <p className="text-gray-500">Healing Progress:</p>
              <p className="font-medium">{assessment.healing_progress}</p>
            </div>
            <div>
              <p className="text-gray-500">Exudate:</p>
              <p className="font-medium">{assessment.exudate_amount} - {assessment.exudate_type}</p>
            </div>
            <div>
              <p className="text-gray-500">Pain Level:</p>
              <p className="font-medium">{assessment.pain_level}/10</p>
            </div>
            <div>
              <p className="text-gray-500">Odor:</p>
              <p className="font-medium">{assessment.odor_present ? 'Present' : 'None'}</p>
            </div>
          </div>
          <div className="mt-3">
            <p className="text-gray-500 text-sm">Tissue Types:</p>
            <div className="flex flex-wrap gap-2 mt-1">
              {assessment.tissue_types.map(type => (
                <span key={type} className="px-2 py-1 bg-gray-100 rounded-full text-xs">{type}</span>
              ))}
            </div>
          </div>
        </div>

        {/* Dressing Protocol */}
        <div className="bg-white rounded-xl shadow-sm border p-4">
          <h4 className="font-semibold mb-3">Recommended Dressing Protocol</h4>
          <div className="space-y-2">
            {assessment.dressing_protocol.map(step => (
              <div key={step.step} className="flex items-start">
                <span className="w-6 h-6 bg-primary-100 text-primary-700 rounded-full flex items-center justify-center text-sm font-medium mr-3 flex-shrink-0">
                  {step.step}
                </span>
                <p className="text-sm">{step.action}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Skin Graft Protocols */}
        {(assessment.wound_type === 'Skin Graft Recipient Site' || assessment.wound_type === 'Skin Graft Donor Site') && (
          <div className="bg-blue-50 rounded-xl border border-blue-200 p-4">
            <h4 className="font-semibold mb-3 text-blue-800">Skin Graft Dressing Protocols</h4>
            <p className="text-sm text-blue-600 mb-3">Specialized protocols for skin graft recipient and donor sites</p>
            <div className="flex space-x-3">
              <button
                onClick={() => generateThermalProtocolPDF(assessment, 'graft')}
                className="flex items-center px-3 py-2 bg-white border border-blue-300 text-blue-700 rounded-lg hover:bg-blue-50"
              >
                ðŸ©¹ Graft Site
                <Printer className="w-4 h-4 ml-2" />
              </button>
              <button
                onClick={() => generateThermalProtocolPDF(assessment, 'donor')}
                className="flex items-center px-3 py-2 bg-white border border-blue-300 text-blue-700 rounded-lg hover:bg-blue-50"
              >
                ðŸ¥ Donor Site
                <Printer className="w-4 h-4 ml-2" />
              </button>
            </div>
          </div>
        )}

        {/* Photos */}
        {assessment.photos.length > 0 && (
          <div className="bg-white rounded-xl shadow-sm border p-4">
            <h4 className="font-semibold mb-3">Wound Photos</h4>
            <div className="grid grid-cols-3 gap-3">
              {assessment.photos.map(photo => (
                <div key={photo.id} className="relative">
                  <img src={photo.dataUrl} alt="Wound" className="w-full h-32 object-cover rounded-lg" />
                  <p className="text-xs text-gray-500 mt-1">
                    {new Date(photo.timestamp).toLocaleString()}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  };

  // ============================================
  // MAIN RENDER
  // ============================================

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-6">
      {/* Tab Navigation */}
      <div className="flex space-x-1 mb-6 bg-white rounded-lg p-1 shadow-sm">
        <button
          onClick={() => setActiveTab('phases')}
          className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-colors ${
            activeTab === 'phases' ? 'bg-primary-600 text-white' : 'text-gray-600 hover:bg-gray-100'
          }`}
        >
          <Activity className="w-4 h-4 inline mr-2" />
          Wound Phases
        </button>
        <button
          onClick={() => setActiveTab('assessments')}
          className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-colors ${
            activeTab === 'assessments' ? 'bg-primary-600 text-white' : 'text-gray-600 hover:bg-gray-100'
          }`}
        >
          <FileText className="w-4 h-4 inline mr-2" />
          All Assessments
        </button>
        <button
          onClick={() => setActiveTab('new')}
          className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-colors ${
            activeTab === 'new' ? 'bg-primary-600 text-white' : 'text-gray-600 hover:bg-gray-100'
          }`}
        >
          <Plus className="w-4 h-4 inline mr-2" />
          New Assessment
        </button>
      </div>

      {/* Tab Content */}
      {activeTab === 'phases' && renderPhasesTab()}
      {activeTab === 'new' && renderNewAssessmentTab()}
      {activeTab === 'details' && renderDetailsTab()}
      {activeTab === 'assessments' && (
        <div className="space-y-4">
          <h2 className="text-xl font-bold">All Wound Assessments</h2>
          {assessments.length === 0 ? (
            <p className="text-gray-500 text-center py-12">No assessments yet</p>
          ) : (
            <div className="grid gap-4">
              {assessments.map(assessment => (
                <div
                  key={assessment.id}
                  onClick={() => {
                    setSelectedAssessment(assessment);
                    setActiveTab('details');
                  }}
                  className="bg-white rounded-xl shadow-sm border p-4 hover:border-primary-500 cursor-pointer transition-colors"
                >
                  <div className="flex justify-between items-start">
                    <div>
                      <h3 className="font-semibold">{assessment.patient_name}</h3>
                      <p className="text-sm text-gray-500">{assessment.location} - {assessment.wound_type}</p>
                      <p className="text-xs text-gray-400 mt-1">
                        {assessment.length} x {assessment.width} cm | Area: {assessment.area} cmÂ²
                      </p>
                    </div>
                    <div className="text-right">
                      <span className={`text-xs px-2 py-1 rounded-full ${WOUND_PHASES[assessment.healing_phase].color}`}>
                        {WOUND_PHASES[assessment.healing_phase].name}
                      </span>
                      <p className="text-xs text-gray-400 mt-2">
                        {new Date(assessment.assessment_date).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default WoundCarePage;

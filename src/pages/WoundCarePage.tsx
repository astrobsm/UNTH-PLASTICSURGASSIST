import React, { useState, useEffect, useRef, useCallback, Suspense, lazy } from 'react';
import { useOnSelectedPatient } from '../hooks/useSelectedPatient';
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
import { syncService } from '../db/syncService';
import { sanitizeTextForPDF } from '../utils/pdfUtils';
import { getCurrentUserName } from '../utils/getCurrentUser';
import { aiWoundMeasurement } from '../services/aiWoundMeasurement';
import type { WoundMeasurementResult, WoundProgressEntry, CalibrationReference } from '../services/aiWoundMeasurement';
// Lazy-load chart.js (~200 KB) only when the wound-progress panel actually renders
const WoundProgressChart = lazy(() => import('../components/WoundProgressChart'));
const WoundHealingMap = lazy(() => import('../components/WoundHealingMap'));

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
  // For the serial healing map & tissue trend (captured with the measurement).
  contourCm?: Array<{ x: number; y: number }>;
  tissue?: { granulation: number; slough: number; necrotic: number; epithelial: number };
  scaleReliable?: boolean;
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
  useOnSelectedPatient((p) => { setSelectedPatient(p as unknown as Patient); setActiveTab('new'); });
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
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [showCamera, setShowCamera] = useState(false);
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);
  const [cameraError, setCameraError] = useState('');
  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment');
  const overlayCanvasRef = useRef<HTMLCanvasElement>(null);
  const [lastMeasurementResult, setLastMeasurementResult] = useState<WoundMeasurementResult | null>(null);
  // Hybrid AI: enrich the on-device measurement with GPT-4o Vision (tissue %, wound
  // type, healing stage, cross-check). Sends the photo to the server → OpenAI, so
  // staff can toggle it off per session for privacy / offline use.
  const [useAiAssessment, setUseAiAssessment] = useState(true);
  const [aiEnriching, setAiEnriching] = useState(false);

  // ----- Reference-marker & calibration state -----
  const [calibrationMethod, setCalibrationMethod] = useState<'auto' | 'coin' | 'card' | 'manual'>('auto');
  const [calibrationOverride, setCalibrationOverride] = useState<CalibrationReference | null>(null);
  const [showManualCalibration, setShowManualCalibration] = useState(false);
  const [manualCalibPhoto, setManualCalibPhoto] = useState<string | null>(null);
  const [manualCalibPoints, setManualCalibPoints] = useState<Array<{ x: number; y: number }>>([]);
  const [manualKnownCm, setManualKnownCm] = useState<number>(1);
  const manualCalibImgRef = useRef<HTMLImageElement>(null);

  // Build a CalibrationReference from a non-manual quick-pick (coin / card)
  const buildQuickCalibration = (method: 'coin' | 'card'): CalibrationReference | null => {
    // Without an in-image detection we can only suggest the known size; pixel scale comes from manual calibration.
    // For coin/card we leave override null — detector still runs auto, but knownSizeCm is recorded for audit.
    const knownSizes = { coin: 2.4, card: 8.56 };
    return { type: method, knownSizeCm: knownSizes[method], pixelSize: 0, detectionMethod: 'manual_selection', confidence: 0.6 };
  };

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

  // --- Camera Functions --------------------------------
  const startCamera = async () => {
    setCameraError('');
    try {
      // Stop existing stream if any
      if (cameraStream) {
        cameraStream.getTracks().forEach(t => t.stop());
      }
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode, width: { ideal: 1920 }, height: { ideal: 1080 } },
        audio: false
      });
      setCameraStream(stream);
      setShowCamera(true);
      // Wait for videoRef to mount then attach
      setTimeout(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.play().catch(() => {});
        }
      }, 100);
    } catch (err: any) {
      console.error('Camera access error:', err);
      // Fallback: use file input with capture attribute on mobile
      if (cameraInputRef.current) {
        cameraInputRef.current.click();
      } else if (fileInputRef.current) {
        fileInputRef.current.click();
      }
      setCameraError('Camera not available � use file upload instead.');
    }
  };

  const stopCamera = () => {
    if (cameraStream) {
      cameraStream.getTracks().forEach(t => t.stop());
      setCameraStream(null);
    }
    setShowCamera(false);
  };

  const switchCamera = async () => {
    const newMode = facingMode === 'environment' ? 'user' : 'environment';
    setFacingMode(newMode);
    if (cameraStream) {
      cameraStream.getTracks().forEach(t => t.stop());
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: newMode, width: { ideal: 1920 }, height: { ideal: 1080 } },
        audio: false
      });
      setCameraStream(stream);
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play().catch(() => {});
      }
    } catch {
      setCameraError('Could not switch camera.');
    }
  };

  const captureFromCamera = async () => {
    if (!videoRef.current || !canvasRef.current) return;
    const video = videoRef.current;
    const canvas = canvasRef.current;
    canvas.width = video.videoWidth || 1280;
    canvas.height = video.videoHeight || 720;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const dataUrl = canvas.toDataURL('image/jpeg', 0.9);

    setIsAnalyzing(true);
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const result = await aiWoundMeasurement.measureWound(imageData, calibrationOverride || undefined);
    setLastMeasurementResult(result);
    // Draw the overlay on the captured image
    if (overlayCanvasRef.current) {
      const oc = overlayCanvasRef.current;
      oc.width = canvas.width;
      oc.height = canvas.height;
      const octx = oc.getContext('2d');
      if (octx) {
        octx.drawImage(canvas, 0, 0);
        aiWoundMeasurement.renderOverlay(octx, result, oc.width, oc.height);
      }
    }
    const measurements = { length: result.length, width: result.width, area: result.area, perimeter: result.perimeter };
    const newPhoto: WoundPhoto = {
      id: `photo_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      dataUrl: overlayCanvasRef.current?.toDataURL('image/jpeg', 0.9) || dataUrl,
      timestamp: new Date(),
      measurements,
      contourCm: result.contourCm,
      tissue: result.tissue,
      scaleReliable: result.scaleReliable,
    };
    setCapturedPhotos(prev => [...prev, newPhoto]);
    if (capturedPhotos.length === 0 && measurements) {
      setFormData(prev => ({ ...prev, length: measurements.length, width: measurements.width }));
    }
    setIsAnalyzing(false);
    // Hybrid AI enrichment (non-blocking): merge tissue/type/stage into the result & photo.
    void enrichWithAI(result, dataUrl, newPhoto.id);
    // Don't stop camera — allow multiple captures
  };

  // Send the captured photo to the GPT-4o Vision endpoint and merge its qualitative
  // assessment into the on-device result. Best-effort: silently no-ops when the AI
  // toggle is off, no patient is selected, or the service is unavailable.
  const enrichWithAI = async (result: WoundMeasurementResult, imageDataUrl: string, photoId: string) => {
    if (!useAiAssessment || !selectedPatient?.id || result.area <= 0) return;
    setAiEnriching(true);
    try {
      const ai = await aiWoundMeasurement.analyzeWithAI(imageDataUrl, selectedPatient.id, {
        calibrationType: result.calibrationMethod,
        calibrationValue: result.scaleReliable ? `${result.measurements.calibrationFactor.toFixed(1)} px/cm` : undefined,
      });
      if (!ai) return;
      const merged = aiWoundMeasurement.mergeAiAssessment(result, ai);
      setLastMeasurementResult(prev => (prev === result || prev?.contourCm === result.contourCm ? merged : prev));
      setCapturedPhotos(prev => prev.map(p => p.id === photoId ? { ...p, tissue: merged.tissue } : p));
    } finally {
      setAiEnriching(false);
    }
  };

  // Cleanup camera on unmount
  useEffect(() => {
    return () => {
      if (cameraStream) {
        cameraStream.getTracks().forEach(t => t.stop());
      }
    };
  }, [cameraStream]);

  // Handle photo capture (legacy � triggers file input)
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
        
        // Real AI wound measurement
        const img = new Image();
        img.onload = async () => {
          const cvs = document.createElement('canvas');
          cvs.width = img.naturalWidth;
          cvs.height = img.naturalHeight;
          const cctx = cvs.getContext('2d')!;
          cctx.drawImage(img, 0, 0);
          const imgData = cctx.getImageData(0, 0, cvs.width, cvs.height);
          const result = await aiWoundMeasurement.measureWound(imgData, calibrationOverride || undefined);
          setLastMeasurementResult(result);
          // Draw overlay
          aiWoundMeasurement.renderOverlay(cctx, result, cvs.width, cvs.height);
          const overlayUrl = cvs.toDataURL('image/jpeg', 0.9);
          const measurements = { length: result.length, width: result.width, area: result.area, perimeter: result.perimeter };

        const newPhoto: WoundPhoto = {
          id: `photo_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          dataUrl: overlayUrl,
          timestamp: new Date(),
          measurements,
          contourCm: result.contourCm,
          tissue: result.tissue,
          scaleReliable: result.scaleReliable,
        };

        setCapturedPhotos(prev => [...prev, newPhoto]);
        // Hybrid AI enrichment uses the original (un-overlaid) image.
        void enrichWithAI(result, dataUrl, newPhoto.id);
        
        // Auto-fill measurements if this is the first photo
        if (capturedPhotos.length === 0 && measurements) {
          setFormData(prev => ({
            ...prev,
            length: measurements.length,
            width: measurements.width
          }));
        }
        };
        img.src = dataUrl;
      };
      reader.readAsDataURL(file);
    }
    
    setTimeout(() => setIsAnalyzing(false), 2000);
  };

  // Pull the stored contour/tissue from an assessment's measured photo (newest with data)
  // so the serial healing map can draw the real outline instead of only an ellipse.
  const photoShape = (a: WoundAssessment): Pick<WoundProgressEntry, 'contourCm' | 'tissue'> => {
    const p = [...(a.photos || [])].reverse().find(ph => ph.contourCm && ph.contourCm.length > 2);
    return { contourCm: p?.contourCm, tissue: p?.tissue };
  };

  // Build progress data for selected patient's particular wound (patient + location + wound_type)
  const getProgressData = useCallback((): WoundProgressEntry[] => {
    if (!selectedAssessment) return [];
    return assessments
      .filter(a =>
        a.patient_id === selectedAssessment.patient_id &&
        a.location === selectedAssessment.location &&
        (a.wound_type || '') === (selectedAssessment.wound_type || '')
      )
      .sort((a, b) => new Date(a.assessment_date).getTime() - new Date(b.assessment_date).getTime())
      .map(a => ({
        date: new Date(a.assessment_date).toISOString(),
        length: a.length,
        width: a.width,
        area: a.area,
        granulation_percentage: a.granulation_percentage,
        healing_phase: a.healing_phase,
        ...photoShape(a),
      }));
  }, [assessments, selectedAssessment]);

  // Inline trend preview while creating a new assessment — finds prior assessments of the SAME wound
  const getInlineProgressData = useCallback((): WoundProgressEntry[] => {
    if (!selectedPatient || !formData.location || !formData.wound_type) return [];
    const pid = String(selectedPatient.id);
    return assessments
      .filter(a =>
        a.patient_id === pid &&
        a.location.toLowerCase().trim() === formData.location.toLowerCase().trim() &&
        (a.wound_type || '').toLowerCase().trim() === (formData.wound_type || '').toLowerCase().trim()
      )
      .sort((a, b) => new Date(a.assessment_date).getTime() - new Date(b.assessment_date).getTime())
      .map(a => ({
        date: new Date(a.assessment_date).toISOString(),
        length: a.length,
        width: a.width,
        area: a.area,
        granulation_percentage: a.granulation_percentage,
        healing_phase: a.healing_phase,
        ...photoShape(a),
      }));
  }, [assessments, selectedPatient, formData.location, formData.wound_type]);

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
        assessed_by: getCurrentUserName(),
        notes: formData.notes,
        created_at: new Date(),
        updated_at: new Date()
      };

      const localId = await db.wound_care.add(newAssessment as any);
      
      // Queue for cloud sync
      await syncService.queueAction('create', 'wound_care', localId as number, newAssessment);

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
    
    const estimatedHeight = 250 + (protocol.length * 12);
    
    const doc = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: [thermalWidth, estimatedHeight]
    });

    const margin = 3;
    let yPos = margin;

    // Header
    doc.setFont('times', 'bold');
    doc.setFontSize(14);
    doc.text(title, thermalWidth / 2, yPos, { align: 'center' });
    yPos += 6;
    
    doc.setFontSize(14);
    doc.text(siteType, thermalWidth / 2, yPos, { align: 'center' });
    yPos += 6;

    // Divider
    doc.setLineWidth(0.3);
    doc.line(margin, yPos, thermalWidth - margin, yPos);
    yPos += 5;

    // Post-Op Day for graft/donor
    if (protocolType === 'graft' || protocolType === 'donor') {
      doc.setFont('times', 'bold');
      doc.setFontSize(14);
      doc.text('POST-OP DAY: 5', margin, yPos);
      yPos += 6;
    }

    // Patient Info
    doc.setFontSize(14);
    doc.setFont('times', 'normal');
    doc.text(`Patient: ${assessment.patient_name}`, margin, yPos);
    yPos += 5;
    doc.text(`Hosp #: ${assessment.hospital_number}`, margin, yPos);
    yPos += 5;
    doc.text(`Location: ${assessment.location}`, margin, yPos);
    yPos += 5;
    doc.text(`Date: ${new Date().toLocaleDateString()}`, margin, yPos);
    yPos += 5;
    doc.text(`Time: ${new Date().toLocaleTimeString()}`, margin, yPos);
    yPos += 6;

    // Divider
    doc.line(margin, yPos, thermalWidth - margin, yPos);
    yPos += 5;

    // Wound Phase (for standard protocol only)
    if (protocolType === 'standard') {
      const phase = WOUND_PHASES[assessment.healing_phase];
      doc.setFont('times', 'bold');
      doc.setFontSize(14);
      doc.text(`Phase: ${phase.name}`, margin, yPos);
      yPos += 5;
      doc.setFont('times', 'normal');
      doc.setFontSize(14);
      doc.text(`Granulation: ${assessment.granulation_percentage}%`, margin, yPos);
      yPos += 5;
      doc.text(`Dressing: ${phase.frequency}`, margin, yPos);
      yPos += 6;
      doc.line(margin, yPos, thermalWidth - margin, yPos);
      yPos += 5;
    }

    // Protocol Steps Header
    doc.setFont('times', 'bold');
    doc.setFontSize(14);
    doc.text('DRESSING PROTOCOL', margin, yPos);
    yPos += 2;
    doc.line(margin, yPos, thermalWidth - margin, yPos);
    yPos += 5;

    // Protocol Steps
    doc.setFont('times', 'normal');
    doc.setFontSize(14);
    protocol.forEach((step) => {
      const text = `${step.step}. ${step.action}`;
      const lines = doc.splitTextToSize(text, thermalWidth - margin * 2 - 5);
      lines.forEach((line: string) => {
        doc.text(line, margin + 2, yPos);
        yPos += 5;
      });
      yPos += 1;
    });

    // Important warnings for graft sites
    if (protocolType === 'graft' || protocolType === 'donor') {
      yPos += 3;
      doc.line(margin, yPos, thermalWidth - margin, yPos);
      yPos += 5;
      
      doc.setFont('times', 'bold');
      doc.setFontSize(14);
      doc.text('IMPORTANT WARNINGS', margin, yPos);
      yPos += 5;
      
      doc.setFont('times', 'normal');
      doc.setFontSize(14);
      
      if (protocolType === 'graft') {
        const warnings = [
          ' Handle graft site with extreme care',
          ' Do not apply excessive pressure',
          ' Monitor for graft failure signs',
          '  (discoloration, separation)',
          ' Next dressing: Day 7'
        ];
        warnings.forEach(w => {
          doc.text(w, margin, yPos);
          yPos += 5;
        });
      } else {
        // Donor site specific warnings
        const warnings = DONOR_SITE_WARNINGS.map(w => `* �� ${w}`);
        warnings.forEach(w => {
          const lines = doc.splitTextToSize(w, thermalWidth - margin * 2 - 2);
          lines.forEach((line: string) => {
            doc.text(line, margin, yPos);
            yPos += 5;
          });
        });
      }
    }

    // Special Instructions
    yPos += 3;
    doc.line(margin, yPos, thermalWidth - margin, yPos);
    yPos += 5;
    
    doc.setFont('times', 'bold');
    doc.setFontSize(14);
    doc.text('SPECIAL INSTRUCTIONS', margin, yPos);
    yPos += 5;
    
    doc.setFont('times', 'normal');
    doc.setFontSize(14);
    
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
      yPos += 5;
    });

    // Footer with signature line
    yPos += 5;
    doc.line(margin, yPos, thermalWidth - margin, yPos);
    yPos += 5;
    doc.setFontSize(14);
    doc.text(`Assessed by: ${assessment.assessed_by || 'Dr. ___________'}`, margin, yPos);
    yPos += 6;
    doc.text('Signature / Stamp:', margin, yPos);
    yPos += 8;
    doc.line(margin, yPos, thermalWidth / 2, yPos); // Signature line
    yPos += 5;
    doc.setFont('times', 'bold');
    doc.setFontSize(14);
    doc.text('UNTH Plastic & Reconstructive Surgery', thermalWidth / 2, yPos, { align: 'center' });

    // Save
    const filename = `${protocolType === 'graft' ? 'GraftSite' : protocolType === 'donor' ? 'DonorSite' : 'Dressing'}_${assessment.hospital_number}_${new Date().toISOString().split('T')[0]}.pdf`;
    doc.save(filename);
  };

  // Print Rulers helper - Calibration rulers with 0.5mm precision grid, dashed cut lines
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
    const rulerLength = 150; // 15cm = 150mm
    const rulerHeight = 25; // Height of each ruler strip
    const margin = 28; // Page margins
    
    const drawCalibrationPage = () => {
      // =======================================
      // PAGE TITLE (Blue color like the reference)
      // =======================================
      doc.setTextColor(81, 112, 255); // Blue color
      doc.setFontSize(14);
      doc.setFont('helvetica', 'bold');
      doc.text('15cm Calibration Rulers - Standard Size', pageWidth / 2, 18, { align: 'center' });
      
      // Subtitle with instructions
      doc.setTextColor(100, 100, 100);
      doc.setFontSize(8);
      doc.setFont('helvetica', 'normal');
      doc.text('Print at 100% scale (no scaling) � Cut along dashed lines � 0.5mm grid for precision', pageWidth / 2, 25, { align: 'center' });

      // Draw multiple ruler strips on the page
      // 6 rulers per page, evenly spaced to avoid overlap.
      // Each ruler footprint = rulerHeight (25mm) + ~6mm for cm-number labels (top+bottom) + 6mm dashed cut-line margin (3mm each side)
      // → effective slot ≈ 37mm. We use 42mm spacing for comfortable whitespace between strips.
      const startX = (pageWidth - rulerLength) / 2;
      const rulersPerPage = 6;
      const topOffset = 38;                 // first ruler starts below title/subtitle
      const bottomReserve = 18;             // reserve for footer
      const usableHeight = pageHeight - topOffset - bottomReserve;
      const rulerSpacing = Math.floor(usableHeight / rulersPerPage); // ≈ 40mm

      for (let r = 0; r < rulersPerPage; r++) {
        const startY = topOffset + (r * rulerSpacing);
        if (startY + rulerHeight + 6 > pageHeight - bottomReserve) break;

        drawSingleRuler(startX, startY, rulerLength, rulerHeight, r + 1);
      }

      // =======================================
      // FOOTER
      // =======================================
      doc.setTextColor(100, 100, 100);
      doc.setFontSize(7);
      doc.setFont('helvetica', 'normal');
      doc.text('UNTH Plastic & Reconstructive Surgery Unit - Wound Care Calibration Rulers', pageWidth / 2, pageHeight - 10, { align: 'center' });
    };

    const drawSingleRuler = (startX: number, startY: number, width: number, height: number, rulerNum: number) => {
      // =======================================
      // DASHED CUT LINE BORDER
      // =======================================
      doc.setDrawColor(150, 150, 150);
      doc.setLineWidth(0.2);
      doc.setLineDashPattern([2, 2], 0);
      doc.rect(startX - 3, startY - 3, width + 6, height + 6);
      doc.setLineDashPattern([], 0); // Reset to solid
      
      // =======================================
      // SOLID RULER BORDER (thick black)
      // =======================================
      doc.setDrawColor(0, 0, 0);
      doc.setLineWidth(0.3);
      doc.rect(startX, startY, width, height);

      // =======================================
      // 0.5mm GRID LINES (finest - lightest gray)
      // =======================================
      doc.setDrawColor(220, 220, 220);
      doc.setLineWidth(0.05);
      // Vertical 0.5mm lines
      for (let mm = 0; mm <= width; mm += 0.5) {
        if (mm % 1 !== 0) { // Skip 1mm lines
          doc.line(startX + mm, startY, startX + mm, startY + height);
        }
      }
      // Horizontal 0.5mm lines
      for (let mm = 0; mm <= height; mm += 0.5) {
        if (mm % 1 !== 0) {
          doc.line(startX, startY + mm, startX + width, startY + mm);
        }
      }

      // =======================================
      // 1mm GRID LINES (light gray)
      // =======================================
      doc.setDrawColor(200, 200, 200);
      doc.setLineWidth(0.08);
      for (let mm = 0; mm <= width; mm += 1) {
        if (mm % 5 !== 0) { // Skip 5mm lines
          doc.line(startX + mm, startY, startX + mm, startY + height);
        }
      }
      for (let mm = 0; mm <= height; mm += 1) {
        if (mm % 5 !== 0) {
          doc.line(startX, startY + mm, startX + width, startY + mm);
        }
      }

      // =======================================
      // 5mm GRID LINES (medium gray)
      // =======================================
      doc.setDrawColor(170, 170, 170);
      doc.setLineWidth(0.12);
      for (let mm = 0; mm <= width; mm += 5) {
        if (mm % 10 !== 0) { // Skip 1cm lines
          doc.line(startX + mm, startY, startX + mm, startY + height);
        }
      }
      for (let mm = 0; mm <= height; mm += 5) {
        if (mm % 10 !== 0) {
          doc.line(startX, startY + mm, startX + width, startY + mm);
        }
      }

      // =======================================
      // 1cm GRID LINES (dark, prominent)
      // =======================================
      doc.setDrawColor(100, 100, 100);
      doc.setLineWidth(0.2);
      for (let cm = 0; cm <= 15; cm++) {
        const offset = cm * 10;
        if (offset <= width) {
          doc.line(startX + offset, startY, startX + offset, startY + height);
        }
      }
      for (let mm = 0; mm <= height; mm += 10) {
        doc.line(startX, startY + mm, startX + width, startY + mm);
      }

      // =======================================
      // CM NUMBERS ON TOP
      // =======================================
      doc.setTextColor(0, 0, 0);
      doc.setFontSize(7);
      doc.setFont('helvetica', 'bold');
      for (let cm = 0; cm <= 15; cm++) {
        const x = startX + (cm * 10);
        if (x <= startX + width) {
          // Draw tick mark
          doc.setDrawColor(0, 0, 0);
          doc.setLineWidth(0.3);
          doc.line(x, startY, x, startY + 3);
          
          // Draw number above ruler
          if (cm > 0) {
            doc.text(`${cm}`, x, startY - 1, { align: 'center' });
          }
        }
      }

      // =======================================
      // 5mm TICK MARKS ON TOP
      // =======================================
      doc.setLineWidth(0.15);
      for (let mm = 5; mm <= width; mm += 10) {
        if (mm % 10 !== 0) {
          doc.line(startX + mm, startY, startX + mm, startY + 2);
        }
      }

      // =======================================
      // CM NUMBERS ON BOTTOM
      // =======================================
      for (let cm = 0; cm <= 15; cm++) {
        const x = startX + (cm * 10);
        if (x <= startX + width) {
          // Draw tick mark
          doc.setLineWidth(0.3);
          doc.line(x, startY + height - 3, x, startY + height);
          
          // Draw number below ruler
          if (cm > 0) {
            doc.text(`${cm}`, x, startY + height + 3, { align: 'center' });
          }
        }
      }

      // 5mm tick marks on bottom
      doc.setLineWidth(0.15);
      for (let mm = 5; mm <= width; mm += 10) {
        if (mm % 10 !== 0) {
          doc.line(startX + mm, startY + height - 2, startX + mm, startY + height);
        }
      }

      // =======================================
      // RULER LABEL
      // =======================================
      doc.setTextColor(150, 150, 150);
      doc.setFontSize(6);
      doc.setFont('helvetica', 'normal');
      doc.text(`Ruler #${rulerNum}`, startX + 2, startY + height - 2);
      
      // =======================================
      // GREEN CALIBRATION MARKERS (for AI auto-detect)
      // =======================================
      const markerSize = 4; // 4mm squares
      doc.setFillColor(14, 159, 110); // #0E9F6E green
      // Top-left marker
      doc.rect(startX - 3, startY - 3, markerSize, markerSize, 'F');
      // Top-right marker
      doc.rect(startX + width - markerSize + 3, startY - 3, markerSize, markerSize, 'F');
      // Bottom-left marker
      doc.rect(startX - 3, startY + height - markerSize + 3, markerSize, markerSize, 'F');
      // Bottom-right marker
      doc.rect(startX + width - markerSize + 3, startY + height - markerSize + 3, markerSize, markerSize, 'F');
      
      // "cm" label
      doc.setTextColor(100, 100, 100);
      doc.setFontSize(6);
      doc.text('cm', startX + width - 5, startY + height / 2 + 1);
    };

    // Generate the calibration page
    drawCalibrationPage();
    
    // Add a second page with large grid ruler
    doc.addPage('a4', 'portrait');
    drawLargeGridRuler();

    function drawLargeGridRuler() {
      // =======================================
      // PAGE TITLE
      // =======================================
      doc.setTextColor(81, 112, 255);
      doc.setFontSize(14);
      doc.setFont('helvetica', 'bold');
      doc.text('15cm x 15cm Measurement Grid', pageWidth / 2, 18, { align: 'center' });
      
      doc.setTextColor(100, 100, 100);
      doc.setFontSize(8);
      doc.setFont('helvetica', 'normal');
      doc.text('Print at 100% scale � Place beside wound for accurate AI measurement', pageWidth / 2, 25, { align: 'center' });

      const gridSize = 150; // 15cm
      const startX = (pageWidth - gridSize) / 2;
      const startY = 35;

      // =======================================
      // DASHED CUT LINE
      // =======================================
      doc.setDrawColor(150, 150, 150);
      doc.setLineWidth(0.2);
      doc.setLineDashPattern([2, 2], 0);
      doc.rect(startX - 5, startY - 5, gridSize + 10, gridSize + 25);
      doc.setLineDashPattern([], 0);

      // =======================================
      // 0.5mm GRID (finest)
      // =======================================
      doc.setDrawColor(230, 230, 230);
      doc.setLineWidth(0.03);
      for (let mm = 0; mm <= gridSize; mm += 0.5) {
        if (mm % 1 !== 0) {
          doc.line(startX + mm, startY, startX + mm, startY + gridSize);
          doc.line(startX, startY + mm, startX + gridSize, startY + mm);
        }
      }

      // =======================================
      // 1mm GRID
      // =======================================
      doc.setDrawColor(210, 210, 210);
      doc.setLineWidth(0.05);
      for (let mm = 0; mm <= gridSize; mm += 1) {
        if (mm % 5 !== 0) {
          doc.line(startX + mm, startY, startX + mm, startY + gridSize);
          doc.line(startX, startY + mm, startX + gridSize, startY + mm);
        }
      }

      // =======================================
      // 5mm GRID
      // =======================================
      doc.setDrawColor(180, 180, 180);
      doc.setLineWidth(0.1);
      for (let mm = 0; mm <= gridSize; mm += 5) {
        if (mm % 10 !== 0) {
          doc.line(startX + mm, startY, startX + mm, startY + gridSize);
          doc.line(startX, startY + mm, startX + gridSize, startY + mm);
        }
      }

      // =======================================
      // 1cm GRID (prominent)
      // =======================================
      doc.setDrawColor(120, 120, 120);
      doc.setLineWidth(0.2);
      for (let cm = 0; cm <= 15; cm++) {
        const offset = cm * 10;
        doc.line(startX + offset, startY, startX + offset, startY + gridSize);
        doc.line(startX, startY + offset, startX + gridSize, startY + offset);
      }

      // =======================================
      // 5cm GRID (bold)
      // =======================================
      doc.setDrawColor(0, 0, 0);
      doc.setLineWidth(0.4);
      for (let cm = 0; cm <= 15; cm += 5) {
        const offset = cm * 10;
        doc.line(startX + offset, startY, startX + offset, startY + gridSize);
        doc.line(startX, startY + offset, startX + gridSize, startY + offset);
      }

      // =======================================
      // OUTER BORDER
      // =======================================
      doc.setDrawColor(0, 0, 0);
      doc.setLineWidth(0.6);
      doc.rect(startX, startY, gridSize, gridSize);

      // =======================================
      // TOP RULER NUMBERS
      // =======================================
      doc.setTextColor(0, 0, 0);
      doc.setFontSize(8);
      doc.setFont('helvetica', 'bold');
      for (let cm = 0; cm <= 15; cm++) {
        const x = startX + (cm * 10);
        doc.text(`${cm}`, x, startY - 2, { align: 'center' });
      }

      // =======================================
      // LEFT RULER NUMBERS
      // =======================================
      for (let cm = 0; cm <= 15; cm++) {
        const y = startY + (cm * 10);
        doc.text(`${cm}`, startX - 3, y + 1, { align: 'right' });
      }

      // =======================================
      // GREEN CALIBRATION MARKERS (for AI auto-detect)
      // =======================================
      const mkSz = 6; // 6mm squares for large grid
      doc.setFillColor(14, 159, 110); // #0E9F6E green
      doc.rect(startX - 5, startY - 5, mkSz, mkSz, 'F');
      doc.rect(startX + gridSize - mkSz + 5, startY - 5, mkSz, mkSz, 'F');
      doc.rect(startX - 5, startY + gridSize - mkSz + 5, mkSz, mkSz, 'F');
      doc.rect(startX + gridSize - mkSz + 5, startY + gridSize - mkSz + 5, mkSz, mkSz, 'F');

      // =======================================
      // VERIFICATION BOX
      // =======================================
      doc.setFontSize(7);
      doc.setFont('helvetica', 'normal');
      doc.text('Verify: This box should measure exactly 1cm x 1cm', startX, startY + gridSize + 8);
      doc.setLineWidth(0.3);
      doc.rect(startX + gridSize - 15, startY + gridSize + 5, 10, 10);
      doc.setFontSize(6);
      doc.text('1cm', startX + gridSize - 10, startY + gridSize + 11, { align: 'center' });

      // =======================================
      // FOOTER
      // =======================================
      doc.setTextColor(100, 100, 100);
      doc.setFontSize(7);
      doc.text('UNTH Plastic & Reconstructive Surgery Unit', pageWidth / 2, pageHeight - 10, { align: 'center' });
    }

    doc.save('Wound_Calibration_Rulers_15cm.pdf');
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
              onClick={startCamera}
              className="flex items-center text-sm text-primary-600 hover:text-primary-700"
            >
              <Camera className="w-4 h-4 mr-1" />
              AI Measurement
            </button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
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
              Area: {calculateArea(formData.length, formData.width)} cm²
            </p>
          )}
        </div>

        {/* Reference Marker & Calibration */}
        <div className="bg-gradient-to-br from-primary-50 to-white border-2 border-primary-200 rounded-xl p-4">
          <div className="flex items-center justify-between mb-3">
            <h4 className="font-semibold text-primary-800 flex items-center">
              <Ruler className="w-4 h-4 mr-2" />
              Reference Marker (for AI calibration)
            </h4>
            {calibrationOverride && (
              <span className="text-xs px-2 py-1 rounded-full bg-primary-600 text-white">
                {calibrationOverride.type} · {calibrationOverride.knownSizeCm} cm
              </span>
            )}
          </div>
          <p className="text-xs text-gray-600 mb-3">
            Place a reference object next to the wound before taking the photo so the AI can convert pixels to centimetres accurately.
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-3">
            {([
              { key: 'auto', label: 'Auto-detect', sub: 'green marker / ruler / grid' },
              { key: 'coin', label: 'Coin', sub: '₦100 ≈ 2.4 cm' },
              { key: 'card', label: 'Credit card', sub: '8.56 cm wide' },
              { key: 'manual', label: 'Manual scale', sub: 'tap two points' },
            ] as const).map(opt => (
              <button
                key={opt.key}
                type="button"
                onClick={() => {
                  setCalibrationMethod(opt.key);
                  if (opt.key === 'auto') {
                    setCalibrationOverride(null);
                  } else if (opt.key === 'coin' || opt.key === 'card') {
                    setCalibrationOverride(buildQuickCalibration(opt.key));
                  } else if (opt.key === 'manual') {
                    // Open modal with most recent photo (if any)
                    const recent = capturedPhotos[capturedPhotos.length - 1]?.dataUrl || null;
                    setManualCalibPhoto(recent);
                    setManualCalibPoints([]);
                    setShowManualCalibration(true);
                  }
                }}
                className={`text-left px-3 py-2 rounded-lg border-2 transition ${
                  calibrationMethod === opt.key
                    ? 'border-primary-600 bg-primary-100 text-primary-800'
                    : 'border-gray-200 bg-white text-gray-700 hover:border-primary-300'
                }`}
              >
                <div className="text-sm font-medium">{opt.label}</div>
                <div className="text-[10px] text-gray-500">{opt.sub}</div>
              </button>
            ))}
          </div>
          {calibrationOverride && calibrationOverride.type === 'manual' && calibrationOverride.pixelSize > 0 && (
            <p className="text-xs text-green-700 bg-green-50 border border-green-200 rounded p-2">
              ✓ Manual calibration set: {calibrationOverride.pixelSize.toFixed(1)} px / cm ({calibrationOverride.knownSizeCm} cm reference)
            </p>
          )}
          {calibrationMethod === 'auto' && (
            <p className="text-xs text-gray-500 italic">
              AI will look for our printed green markers, a visible ruler, or a 1cm grid. Confidence is shown after measurement.
            </p>
          )}
          {/* Hybrid AI assessment toggle */}
          <label className="flex items-center gap-2 mt-2 text-xs text-gray-700 cursor-pointer">
            <input
              type="checkbox"
              checked={useAiAssessment}
              onChange={e => setUseAiAssessment(e.target.checked)}
              className="rounded border-gray-300"
            />
            <span>
              AI wound-bed assessment (tissue %, type, healing stage){' '}
              <span className="text-gray-400">— sends the photo to the secure AI service; turn off for offline/private capture.</span>
            </span>
            {aiEnriching && <span className="text-indigo-600 animate-pulse">· analysing…</span>}
          </label>
        </div>

        {/* Inline trend preview for THIS wound */}
        {(() => {
          const inlineData = getInlineProgressData();
          if (inlineData.length < 2) return null;
          const report = aiWoundMeasurement.generateProgressReport(inlineData);
          return (
            <div className="bg-white border-2 border-blue-200 rounded-xl p-4">
              <h4 className="font-semibold mb-2 flex items-center text-blue-800">
                <TrendingUp className="w-4 h-4 mr-2" />
                Trend for this wound ({inlineData.length} prior assessments)
              </h4>
              <p className="text-xs text-gray-500 mb-2">
                {selectedPatient?.full_name} · {formData.location} · {formData.wound_type}
              </p>
              <Suspense fallback={<div className="bg-gray-50 rounded-lg p-3 text-center text-xs text-gray-400">Loading chart…</div>}>
                <WoundProgressChart measurements={inlineData} report={report} />
                <div className="mt-3">
                  <WoundHealingMap measurements={inlineData} height={260} />
                </div>
              </Suspense>
            </div>
          );
        })()}

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
          {/* Hidden file inputs */}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            multiple
            onChange={handleFileUpload}
            className="hidden"
            title="Upload wound photos"
          />
          <input
            ref={cameraInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            onChange={handleFileUpload}
            className="hidden"
            title="Take wound photo"
          />
          {/* Hidden canvas for camera capture */}
          <canvas ref={canvasRef} className="hidden" />
          <canvas ref={overlayCanvasRef} className="hidden" />

          {/* Camera Viewfinder */}
          {showCamera && (
            <div className="relative mb-3 rounded-xl overflow-hidden bg-black border-2 border-primary-500 shadow-lg">
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className="w-full rounded-xl"
                style={{ maxHeight: '50vh' }}
              />
              {/* Camera overlay controls */}
              <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-4 flex items-center justify-center gap-4">
                <button
                  onClick={stopCamera}
                  className="p-3 bg-red-600 hover:bg-red-700 text-white rounded-full shadow-lg transition"
                  title="Close camera"
                  type="button"
                >
                  <X className="w-5 h-5" />
                </button>
                <button
                  onClick={captureFromCamera}
                  className="p-4 bg-white hover:bg-gray-100 rounded-full shadow-lg transition border-4 border-primary-500"
                  title="Capture photo"
                  type="button"
                  disabled={isAnalyzing}
                >
                  {isAnalyzing ? (
                    <Loader2 className="w-8 h-8 text-primary-600 animate-spin" />
                  ) : (
                    <Camera className="w-8 h-8 text-primary-600" />
                  )}
                </button>
                <button
                  onClick={switchCamera}
                  className="p-3 bg-gray-700 hover:bg-gray-600 text-white rounded-full shadow-lg transition"
                  title="Switch camera"
                  type="button"
                >
                  <RefreshCw className="w-5 h-5" />
                </button>
              </div>
              {/* Photo count badge */}
              {capturedPhotos.length > 0 && (
                <div className="absolute top-3 right-3 bg-primary-600 text-white text-xs font-bold px-2 py-1 rounded-full shadow">
                  {capturedPhotos.length} photo{capturedPhotos.length > 1 ? 's' : ''}
                </div>
              )}
            </div>
          )}

          {/* Camera & Upload buttons */}
          {!showCamera && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <button
                type="button"
                onClick={startCamera}
                className="flex flex-col items-center justify-center border-2 border-dashed border-primary-400 rounded-lg p-5 cursor-pointer hover:border-primary-600 hover:bg-primary-50 transition-colors"
              >
                <Camera className="w-8 h-8 text-primary-500 mb-2" />
                <p className="text-primary-600 font-medium text-sm">Take Photo</p>
                <p className="text-gray-400 text-xs mt-0.5">Open camera</p>
              </button>
              <button
                type="button"
                onClick={handlePhotoCapture}
                className="flex flex-col items-center justify-center border-2 border-dashed border-gray-300 rounded-lg p-5 cursor-pointer hover:border-gray-400 hover:bg-gray-50 transition-colors"
              >
                {isAnalyzing ? (
                  <div className="flex flex-col items-center">
                    <Loader2 className="w-8 h-8 text-primary-600 animate-spin mb-2" />
                    <p className="text-primary-600 text-sm">Analyzing...</p>
                  </div>
                ) : (
                  <>
                    <Upload className="w-8 h-8 text-gray-400 mb-2" />
                    <p className="text-gray-600 font-medium text-sm">Upload Image</p>
                    <p className="text-gray-400 text-xs mt-0.5">From gallery</p>
                  </>
                )}
              </button>
            </div>
          )}

          {/* Camera error */}
          {cameraError && (
            <div className="flex items-center gap-2 mt-2 p-2 bg-yellow-50 border border-yellow-200 rounded-lg text-yellow-700 text-xs">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>{cameraError}</span>
              <button onClick={() => setCameraError('')} className="ml-auto" title="Dismiss error">
                <X className="w-3 h-3" />
              </button>
            </div>
          )}

          {/* Captured photos grid */}
          {capturedPhotos.length > 0 && (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mt-3">
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

          {/* Automated measurement result */}
          {lastMeasurementResult && (
            <div className="mt-3 bg-white border-2 border-green-300 rounded-xl p-4">
              <div className="flex items-center justify-between mb-3">
                <h4 className="font-semibold text-green-800 flex items-center">
                  <CheckCircle className="w-4 h-4 mr-2" />
                  AI Measurement Result
                </h4>
                <span className={`text-xs px-2 py-1 rounded-full ${
                  lastMeasurementResult.confidence > 0.7 ? 'bg-green-100 text-green-700'
                    : lastMeasurementResult.confidence > 0.4 ? 'bg-yellow-100 text-yellow-700'
                    : 'bg-red-100 text-red-700'
                }`}>
                  {(lastMeasurementResult.confidence * 100).toFixed(0)}% confidence · {lastMeasurementResult.calibrationMethod}
                </span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center">
                <div className="bg-gray-50 p-2 rounded-lg">
                  <p className="text-lg font-bold">{lastMeasurementResult.length.toFixed(2)}</p>
                  <p className="text-[10px] text-gray-500">Length (cm)</p>
                </div>
                <div className="bg-gray-50 p-2 rounded-lg">
                  <p className="text-lg font-bold">{lastMeasurementResult.width.toFixed(2)}</p>
                  <p className="text-[10px] text-gray-500">Width (cm)</p>
                </div>
                <div className="bg-gray-50 p-2 rounded-lg">
                  <p className="text-lg font-bold">{lastMeasurementResult.area.toFixed(2)}</p>
                  <p className="text-[10px] text-gray-500">Area (cm²)</p>
                </div>
                <div className="bg-gray-50 p-2 rounded-lg">
                  <p className="text-lg font-bold">{lastMeasurementResult.perimeter.toFixed(2)}</p>
                  <p className="text-[10px] text-gray-500">Perimeter (cm)</p>
                </div>
              </div>

              {/* Scale reliability */}
              <div className={`mt-2 text-xs rounded-md px-2 py-1.5 flex items-center gap-1.5 ${
                lastMeasurementResult.scaleReliable ? 'bg-green-50 text-green-700' : 'bg-amber-50 text-amber-700'
              }`}>
                {lastMeasurementResult.scaleReliable
                  ? `✓ Scale reference detected (${lastMeasurementResult.calibrationMethod}, ${(lastMeasurementResult.calibrationConfidence * 100).toFixed(0)}%) — dimensions are to scale.`
                  : '⚠ No reliable scale reference — dimensions are approximate. Add a ruler / printed marker, or set a manual scale.'}
              </div>

              {/* Tissue composition */}
              {lastMeasurementResult.tissue && (
                <div className="mt-2">
                  <p className="text-[10px] text-gray-500 mb-1">Wound-bed composition{lastMeasurementResult.aiAssessment ? ' (AI)' : ''}</p>
                  <div className="flex h-3 rounded overflow-hidden">
                    {([
                      ['granulation', '#DC2626', 'Granulation'],
                      ['slough', '#CA8A04', 'Slough'],
                      ['necrotic', '#1F2937', 'Necrotic'],
                      ['epithelial', '#F9A8D4', 'Epithelial'],
                    ] as const).map(([k, color]) => {
                      const v = (lastMeasurementResult.tissue as any)[k] as number;
                      return v > 0 ? <div key={k} title={`${k}: ${v}%`} style={{ width: `${v}%`, backgroundColor: color }} /> : null;
                    })}
                  </div>
                  <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-1 text-[10px] text-gray-600">
                    <span>🟥 Granulation {lastMeasurementResult.tissue.granulation}%</span>
                    <span>🟨 Slough {lastMeasurementResult.tissue.slough}%</span>
                    <span>⬛ Necrotic {lastMeasurementResult.tissue.necrotic}%</span>
                    <span>🟪 Epithelial {lastMeasurementResult.tissue.epithelial}%</span>
                  </div>
                </div>
              )}

              {/* AI qualitative assessment (hybrid) */}
              {lastMeasurementResult.aiAssessment && (
                <div className="mt-2 text-xs bg-indigo-50 border border-indigo-200 rounded-md px-2 py-1.5 text-indigo-800 space-y-0.5">
                  <p className="font-semibold flex items-center gap-1">🤖 AI assessment</p>
                  {lastMeasurementResult.aiAssessment.wound_type && <p>Type: {lastMeasurementResult.aiAssessment.wound_type}</p>}
                  {lastMeasurementResult.aiAssessment.healing_stage && <p>Stage: {lastMeasurementResult.aiAssessment.healing_stage}</p>}
                  {lastMeasurementResult.aiAssessment.edges && <p>Edges: {lastMeasurementResult.aiAssessment.edges}</p>}
                  {lastMeasurementResult.aiAssessment.exudate && <p>Exudate: {lastMeasurementResult.aiAssessment.exudate}{lastMeasurementResult.aiAssessment.exudate_type ? ` (${lastMeasurementResult.aiAssessment.exudate_type})` : ''}</p>}
                  {Array.isArray(lastMeasurementResult.aiAssessment.signs_of_infection) && lastMeasurementResult.aiAssessment.signs_of_infection.length > 0 && (
                    <p className="text-red-700">Infection signs: {lastMeasurementResult.aiAssessment.signs_of_infection.join(', ')}</p>
                  )}
                  {lastMeasurementResult.aiAssessment.observations && <p className="italic">{lastMeasurementResult.aiAssessment.observations}</p>}
                </div>
              )}

              {/* Warnings */}
              {lastMeasurementResult.warnings && lastMeasurementResult.warnings.length > 0 && (
                <ul className="mt-2 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded p-2 space-y-0.5">
                  {lastMeasurementResult.warnings.map((wmsg, i) => <li key={i}>⚠ {wmsg}</li>)}
                </ul>
              )}

              <div className="flex gap-2 mt-3">
                <button
                  type="button"
                  onClick={() => {
                    const t = lastMeasurementResult.tissue;
                    const tissueTypes = t
                      ? (['granulation', 'slough', 'necrotic', 'epithelial'] as const)
                          .filter(k => (t as any)[k] >= 10)
                          .map(k => k.charAt(0).toUpperCase() + k.slice(1))
                      : undefined;
                    setFormData(prev => ({
                      ...prev,
                      length: lastMeasurementResult.length,
                      width: lastMeasurementResult.width,
                      area: lastMeasurementResult.area,
                      ...(t ? { granulation_percentage: t.granulation } : {}),
                      ...(tissueTypes && tissueTypes.length ? { tissue_types: tissueTypes } : {}),
                    }));
                  }}
                  className="flex-1 px-3 py-2 bg-primary-600 text-white text-sm rounded-lg hover:bg-primary-700"
                >
                  Apply to form
                </button>
                <button
                  type="button"
                  onClick={() => setLastMeasurementResult(null)}
                  className="px-3 py-2 bg-gray-100 text-gray-700 text-sm rounded-lg hover:bg-gray-200"
                >
                  Dismiss
                </button>
              </div>
              {lastMeasurementResult.confidence < 0.4 && (
                <p className="text-xs text-yellow-700 bg-yellow-50 border border-yellow-200 rounded p-2 mt-2">
                  ⚠ Low confidence — consider using a clearer reference marker (manual scale or printed green ruler) and re-taking the photo.
                </p>
              )}
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

      {/* ===== Manual Calibration Modal ===== */}
      {showManualCalibration && (
        <div className="fixed inset-0 bg-black bg-opacity-70 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-4 border-b flex items-center justify-between">
              <h3 className="font-semibold text-lg flex items-center">
                <Ruler className="w-5 h-5 mr-2 text-primary-600" />
                Manual Calibration
              </h3>
              <button
                type="button"
                onClick={() => { setShowManualCalibration(false); setManualCalibPoints([]); }}
                className="p-1 hover:bg-gray-100 rounded"
                title="Close"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-4 space-y-3">
              <p className="text-sm text-gray-600">
                Click <strong>two points</strong> on the photo that span a known distance (e.g. across a coin or a ruler mark), then enter the real-world distance in centimetres.
              </p>
              {!manualCalibPhoto && (
                <div className="bg-yellow-50 border border-yellow-200 rounded p-3 text-sm text-yellow-800">
                  Capture or upload a photo first, then re-open this dialog.
                </div>
              )}
              {manualCalibPhoto && (
                <div className="relative inline-block max-w-full border-2 border-primary-300 rounded-lg overflow-hidden">
                  <img
                    ref={manualCalibImgRef}
                    src={manualCalibPhoto}
                    alt="Calibration"
                    className="block max-w-full max-h-[50vh] cursor-crosshair"
                    onClick={(e) => {
                      if (manualCalibPoints.length >= 2) return;
                      const img = e.currentTarget;
                      const rect = img.getBoundingClientRect();
                      const x = ((e.clientX - rect.left) / rect.width) * img.naturalWidth;
                      const y = ((e.clientY - rect.top) / rect.height) * img.naturalHeight;
                      setManualCalibPoints(prev => [...prev, { x, y }]);
                    }}
                  />
                  {/* Render markers */}
                  {manualCalibImgRef.current && manualCalibPoints.map((p, i) => {
                    const img = manualCalibImgRef.current!;
                    const rect = img.getBoundingClientRect();
                    const containerRect = img.parentElement!.getBoundingClientRect();
                    const left = (p.x / img.naturalWidth) * rect.width + (rect.left - containerRect.left);
                    const top = (p.y / img.naturalHeight) * rect.height + (rect.top - containerRect.top);
                    return (
                      <div
                        key={i}
                        className="absolute w-5 h-5 -ml-2.5 -mt-2.5 rounded-full bg-red-500 border-2 border-white shadow-lg pointer-events-none flex items-center justify-center text-white text-[10px] font-bold"
                        style={{ left, top }}
                      >
                        {i + 1}
                      </div>
                    );
                  })}
                </div>
              )}
              <div className="flex items-center gap-3">
                <label className="text-sm font-medium text-gray-700 whitespace-nowrap">Known distance (cm):</label>
                <input
                  type="number"
                  step="0.1"
                  min="0.1"
                  value={manualKnownCm}
                  onChange={(e) => setManualKnownCm(parseFloat(e.target.value) || 1)}
                  className="w-24 px-2 py-1 border rounded"
                  title="Real-world distance between the two points"
                />
                <button
                  type="button"
                  onClick={() => setManualCalibPoints([])}
                  className="text-xs px-2 py-1 bg-gray-100 rounded hover:bg-gray-200"
                >
                  Reset points
                </button>
                <span className="text-xs text-gray-500 ml-auto">
                  {manualCalibPoints.length}/2 points
                </span>
              </div>
            </div>
            <div className="p-4 border-t flex justify-end gap-2">
              <button
                type="button"
                onClick={() => { setShowManualCalibration(false); setManualCalibPoints([]); }}
                className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={manualCalibPoints.length !== 2 || manualKnownCm <= 0}
                onClick={() => {
                  const [p1, p2] = manualCalibPoints;
                  const pixelLen = Math.hypot(p2.x - p1.x, p2.y - p1.y);
                  const ref = aiWoundMeasurement.createManualCalibration(pixelLen, manualKnownCm);
                  setCalibrationOverride(ref);
                  setShowManualCalibration(false);
                  setManualCalibPoints([]);
                }}
                className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50"
              >
                Apply calibration
              </button>
            </div>
          </div>
        </div>
      )}
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
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center">
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
                <p className="text-xs text-gray-500">Area (cm�)</p>
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
                Graft Site
                <Printer className="w-4 h-4 ml-2" />
              </button>
              <button
                onClick={() => generateThermalProtocolPDF(assessment, 'donor')}
                className="flex items-center px-3 py-2 bg-white border border-blue-300 text-blue-700 rounded-lg hover:bg-blue-50"
              >
                Donor Site
                <Printer className="w-4 h-4 ml-2" />
              </button>
            </div>
          </div>
        )}

        {/* Photos */}
        {assessment.photos.length > 0 && (
          <div className="bg-white rounded-xl shadow-sm border p-4">
            <h4 className="font-semibold mb-3">Wound Photos</h4>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
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

        {/* Wound Healing Progress Chart */}
        {(() => {
          const progressData = getProgressData();
          const report = progressData.length >= 2 ? aiWoundMeasurement.generateProgressReport(progressData) : null;
          return (
            <div className="bg-white rounded-xl shadow-sm border p-4">
              <h4 className="font-semibold mb-3 flex items-center">
                <TrendingUp className="w-4 h-4 mr-2 text-green-600" />
                Healing Progress
              </h4>
              <Suspense fallback={<div className="bg-gray-50 rounded-lg p-4 text-center text-xs text-gray-400">Loading chart…</div>}>
                <WoundProgressChart measurements={progressData} report={report} />
                {progressData.length >= 1 && (
                  <div className="mt-4">
                    <WoundHealingMap measurements={progressData} height={300} />
                  </div>
                )}
              </Suspense>
            </div>
          );
        })()}
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
                        {assessment.length} x {assessment.width} cm | Area: {assessment.area} cm�
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

import React, { useState, useRef, useCallback, useEffect } from 'react';
import {
  Camera, Upload, X, FileText, Loader2, CheckCircle, AlertTriangle,
  RotateCw, ZoomIn, ZoomOut, Scan, Brain, Clipboard, Eye
} from 'lucide-react';
import { ocrService, AIEnhancedOCRResult } from '../services/ocrService';
import type { DocumentType } from '../services/ocrService';

interface DocumentScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onFieldsExtracted: (fields: Record<string, any>) => void;
  documentType?: DocumentType;
  patientContext?: {
    name?: string;
    hospitalNumber?: string;
    ward?: string;
    diagnosis?: string;
  };
  /** Target form field mapping context */
  targetForm?: 'ward_round' | 'review_note' | 'progress_note' | 'prescription' | 'lab_entry';
}

type ScanStep = 'capture' | 'processing' | 'review' | 'error';

export const DocumentScannerModal: React.FC<DocumentScannerModalProps> = ({
  isOpen,
  onClose,
  onFieldsExtracted,
  documentType = 'general',
  patientContext,
  targetForm = 'ward_round',
}) => {
  const [step, setStep] = useState<ScanStep>('capture');
  const [selectedDocType, setSelectedDocType] = useState<DocumentType>(documentType);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const [progressText, setProgressText] = useState('');
  const [result, setResult] = useState<AIEnhancedOCRResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedFields, setSelectedFields] = useState<Set<string>>(new Set());
  const [showRawText, setShowRawText] = useState(false);
  const [handwritingMode, setHandwritingMode] = useState(true);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isCameraActive, setIsCameraActive] = useState(false);
  const streamRef = useRef<MediaStream | null>(null);

  const resetState = useCallback(() => {
    setStep('capture');
    setSelectedDocType(documentType);
    setImagePreview(null);
    setProgress(0);
    setProgressText('');
    setResult(null);
    setError(null);
    setSelectedFields(new Set());
    setShowRawText(false);
    setHandwritingMode(false);
    stopCamera();
  }, []);

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    setIsCameraActive(false);
  };

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: { ideal: 1920 }, height: { ideal: 1080 } }
      });
      streamRef.current = stream;
      setIsCameraActive(true);
    } catch (err) {
      console.error('Camera access failed:', err);
      setError('Camera access denied. Please use file upload instead.');
    }
  };

  // Attach the stream to the video element after it renders
  useEffect(() => {
    if (isCameraActive && streamRef.current && videoRef.current) {
      videoRef.current.srcObject = streamRef.current;
      videoRef.current.play().catch(() => {});
    }
  }, [isCameraActive]);

  const captureFromCamera = () => {
    if (!videoRef.current || !canvasRef.current) return;
    const video = videoRef.current;
    const canvas = canvasRef.current;

    // Ensure the video is actually producing frames before capturing
    if (!video.videoWidth || !video.videoHeight) {
      setError('Camera is not ready yet. Please wait a moment and try again.');
      return;
    }

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.drawImage(video, 0, 0);
    const dataUrl = canvas.toDataURL('image/jpeg', 0.95);
    setImagePreview(dataUrl);
    stopCamera();
    processImage(dataUrl);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const isImage = file.type.startsWith('image/') || /\.(jpe?g|png|gif|bmp|webp|tiff?)$/i.test(file.name);
    const isPDF = file.type === 'application/pdf' || /\.pdf$/i.test(file.name);

    if (!isImage && !isPDF) {
      setError('Please select an image (JPEG, PNG) or PDF file.');
      return;
    }

    // Reset the input so the same file can be re-selected
    e.target.value = '';

    const reader = new FileReader();
    reader.onerror = () => {
      setError('Failed to read the selected file. Please try again.');
    };
    reader.onload = (ev) => {
      const dataUrl = ev.target?.result as string;
      if (!dataUrl) {
        setError('Failed to read the selected file. Please try again.');
        return;
      }

      if (isPDF) {
        // PDFs can't be previewed as <img>, pass the File directly to OCR
        setImagePreview(null);
        processImage(file);
      } else {
        // Validate image can be loaded before processing
        const img = new Image();
        img.onload = () => {
          setImagePreview(dataUrl);
          processImage(dataUrl);
        };
        img.onerror = () => {
          // Fallback: try passing the file directly if the data URL fails
          processImage(file);
        };
        img.src = dataUrl;
      }
    };
    reader.readAsDataURL(file);
  };

  const processImage = async (imageSource: File | Blob | string) => {
    setStep('processing');
    setProgress(0);
    setProgressText(handwritingMode ? 'Sending to AI Vision for handwriting recognition...' : 'Initializing OCR engine...');
    setError(null);

    try {
      const aiResult = await ocrService.processDocumentWithAI(
        imageSource,
        selectedDocType,
        patientContext,
        (p) => {
          setProgress(Math.round(p.progress * 100));
          if (handwritingMode) {
            if (p.progress < 0.3) setProgressText('Sending to AI Vision for handwriting recognition...');
            else if (p.progress < 0.7) setProgressText('AI reading handwritten text...');
            else if (p.progress < 0.9) setProgressText('Structuring clinical data...');
            else setProgressText('Almost done...');
          } else {
            if (p.progress < 0.3) setProgressText('Initializing OCR engine...');
            else if (p.progress < 0.5) setProgressText('Scanning document...');
            else if (p.progress < 0.6) setProgressText('OCR text extracted, sending to AI...');
            else if (p.progress < 0.85) setProgressText('AI analyzing clinical content...');
            else setProgressText('Structuring form fields...');
          }
        },
        { handwritingMode }
      );

      setResult(aiResult);
      
      // Pre-select all fields by default
      if (aiResult.structuredData) {
        const fields = new Set<string>();
        flattenFields(aiResult.structuredData, '', fields);
        setSelectedFields(fields);
      }
      
      setStep('review');
    } catch (err: any) {
      console.error('Document processing failed:', err);
      setError(err.message || 'Failed to process document');
      setStep('error');
    }
  };

  /** Flatten nested object keys into dot-notation paths */
  const flattenFields = (obj: any, prefix: string, result: Set<string>) => {
    for (const [key, value] of Object.entries(obj)) {
      if (key === 'confidence') continue;
      const path = prefix ? `${prefix}.${key}` : key;
      if (value !== null && value !== undefined && value !== '') {
        if (Array.isArray(value)) {
          // Add each array index as a selectable field (e.g., vital_signs_series.0)
          value.forEach((_: any, i: number) => result.add(`${path}.${i}`));
        } else if (typeof value === 'object') {
          flattenFields(value, path, result);
        } else {
          result.add(path);
        }
      }
    }
  };

  const toggleField = (field: string) => {
    setSelectedFields(prev => {
      const next = new Set(prev);
      next.has(field) ? next.delete(field) : next.add(field);
      return next;
    });
  };

  const applySelectedFields = () => {
    if (!result?.structuredData) return;

    const extractedFields: Record<string, any> = {};
    
    // Map structured data to the target form fields
    const data = result.structuredData;
    
    if (targetForm === 'ward_round' || targetForm === 'review_note') {
      if (selectedFields.has('clinical_status') && data.clinical_status) {
        extractedFields.clinical_status = data.clinical_status;
      }
      if (selectedFields.has('subjective') && data.subjective) {
        extractedFields.subjective = data.subjective;
      }
      if (selectedFields.has('objective') && data.objective) {
        extractedFields.objective = data.objective;
        extractedFields.findings = data.objective;
        extractedFields.examination_findings = data.objective;
      }
      if (selectedFields.has('assessment') && data.assessment) {
        extractedFields.assessment = data.assessment;
      }
      if (selectedFields.has('plan') && data.plan) {
        extractedFields.plan = data.plan;
        extractedFields.management_plan = data.plan;
      }
      
      // Map vitals
      if (data.vitals) {
        const vitals: any = {};
        if (selectedFields.has('vitals.temperature') && data.vitals.temperature) vitals.temperature = data.vitals.temperature;
        if (selectedFields.has('vitals.pulse') && data.vitals.pulse) vitals.pulse = data.vitals.pulse;
        if (selectedFields.has('vitals.bp_systolic') && data.vitals.bp_systolic) {
          vitals.bloodPressure = `${data.vitals.bp_systolic}/${data.vitals.bp_diastolic || ''}`;
          vitals.bp_systolic = data.vitals.bp_systolic;
          vitals.bp_diastolic = data.vitals.bp_diastolic;
        }
        if (selectedFields.has('vitals.respiratory_rate') && data.vitals.respiratory_rate) vitals.respiratoryRate = data.vitals.respiratory_rate;
        if (selectedFields.has('vitals.spo2') && data.vitals.spo2) vitals.oxygenSaturation = data.vitals.spo2;
        if (selectedFields.has('vitals.pain_score') && data.vitals.pain_score != null) vitals.painScore = data.vitals.pain_score;
        if (selectedFields.has('vitals.weight') && data.vitals.weight) vitals.weight = data.vitals.weight;
        if (Object.keys(vitals).length > 0) extractedFields.vital_signs = vitals;
      }

      // Map vital signs series (post-op chart time-series readings)
      if (data.vital_signs_series && Array.isArray(data.vital_signs_series) && data.vital_signs_series.length > 0) {
        const selectedSeries = data.vital_signs_series.filter((_: any, i: number) =>
          selectedFields.has(`vital_signs_series.${i}`)
        );
        if (selectedSeries.length > 0) {
          extractedFields.vital_signs_series = selectedSeries;
        }
      }

      // Map medications
      if (data.medications && Array.isArray(data.medications) && data.medications.length > 0) {
        const anyMedSelected = data.medications.some((_: any, i: number) => selectedFields.has(`medications.${i}`));
        if (anyMedSelected || selectedFields.has('medications')) {
          extractedFields.medications = data.medications;
        }
      }

      // Map investigations
      if (data.investigations && Array.isArray(data.investigations) && data.investigations.length > 0) {
        extractedFields.investigations = data.investigations;
      }

      // Map wounds
      if (data.wounds && Array.isArray(data.wounds) && data.wounds.length > 0) {
        extractedFields.wounds = data.wounds;
      }

      // Map diagnoses
      if (data.diagnoses && Array.isArray(data.diagnoses) && data.diagnoses.length > 0) {
        extractedFields.diagnoses = data.diagnoses;
      }

      // Additional fields
      if (data.diet) extractedFields.diet = data.diet;
      if (data.activity) extractedFields.activity = data.activity;
      if (data.fluid_balance) extractedFields.fluid_balance = data.fluid_balance;
      if (data.notes) extractedFields.notes = data.notes;
      if (selectedFields.has('raw_text') && data.raw_text) {
        extractedFields.notes = extractedFields.notes
          ? extractedFields.notes + '\n' + data.raw_text
          : data.raw_text;
      }
    } else if (targetForm === 'prescription' && data.medications) {
      extractedFields.medications = data.medications;
      if (data.prescriber) extractedFields.prescriber = data.prescriber;
    } else if (targetForm === 'lab_entry' && data.results) {
      extractedFields.results = data.results;
      if (data.specimen_type) extractedFields.specimen_type = data.specimen_type;
    } else {
      // Generic: pass through all selected field values
      for (const field of selectedFields) {
        const value = getNestedValue(result.structuredData, field);
        if (value !== undefined) extractedFields[field] = value;
      }
    }

    onFieldsExtracted(extractedFields);
    onClose();
    resetState();
  };

  const getNestedValue = (obj: any, path: string): any => {
    return path.split('.').reduce((o, k) => o?.[k], obj);
  };

  const renderFieldValue = (value: any): string => {
    if (value === null || value === undefined) return 'N/A';
    if (Array.isArray(value)) {
      return value.map(v => {
        if (typeof v === 'object' && v !== null) {
          // Lab result: {test_name, result_value, unit, ...}
          if (v.test_name || v.name) return `${v.test_name || v.name}: ${v.result_value || v.result || v.value || ''}${v.unit ? ' ' + v.unit : ''}${v.abnormal ? ' ⚠' : ''}`;
          // Medication: {name, dose, route, frequency}
          if (v.name && (v.dose || v.route)) return `${v.name} ${v.dose || ''} ${v.route || ''} ${v.frequency || ''}`.trim();
          // Wound: {location, description}
          if (v.location) return `${v.location}: ${v.description || ''}`;
          return Object.values(v).filter(Boolean).join(', ');
        }
        return String(v);
      }).join('\n');
    }
    if (typeof value === 'object') {
      // Vitals object
      return Object.entries(value).filter(([,v]) => v != null).map(([k, v]) => `${k.replace(/_/g, ' ')}: ${v}`).join(', ');
    }
    return String(value);
  };

  /** Render extracted fields as a reviewable checklist */
  const renderFieldReview = () => {
    if (!result?.structuredData) return null;
    const data = result.structuredData;
    const sections: { title: string; fields: { key: string; label: string; value: any }[] }[] = [];

    // SOAP sections
    const soapFields: { key: string; label: string; value: any }[] = [];
    if (data.clinical_status) soapFields.push({ key: 'clinical_status', label: 'Clinical Status', value: data.clinical_status });
    if (data.subjective) soapFields.push({ key: 'subjective', label: 'Subjective', value: data.subjective });
    if (data.objective) soapFields.push({ key: 'objective', label: 'Objective', value: data.objective });
    if (data.assessment) soapFields.push({ key: 'assessment', label: 'Assessment', value: data.assessment });
    if (data.plan) soapFields.push({ key: 'plan', label: 'Plan', value: data.plan });
    if (soapFields.length > 0) sections.push({ title: 'Clinical Notes', fields: soapFields });

    // Vitals
    if (data.vitals) {
      const vitalFields: { key: string; label: string; value: any }[] = [];
      if (data.vitals.temperature) vitalFields.push({ key: 'vitals.temperature', label: 'Temperature', value: `${data.vitals.temperature}°C` });
      if (data.vitals.pulse) vitalFields.push({ key: 'vitals.pulse', label: 'Pulse', value: `${data.vitals.pulse} bpm` });
      if (data.vitals.bp_systolic) vitalFields.push({ key: 'vitals.bp_systolic', label: 'Blood Pressure', value: `${data.vitals.bp_systolic}/${data.vitals.bp_diastolic} mmHg` });
      if (data.vitals.respiratory_rate) vitalFields.push({ key: 'vitals.respiratory_rate', label: 'Respiratory Rate', value: `${data.vitals.respiratory_rate}/min` });
      if (data.vitals.spo2) vitalFields.push({ key: 'vitals.spo2', label: 'SpO2', value: `${data.vitals.spo2}%` });
      if (data.vitals.pain_score != null) vitalFields.push({ key: 'vitals.pain_score', label: 'Pain Score', value: `${data.vitals.pain_score}/10` });
      if (data.vitals.weight) vitalFields.push({ key: 'vitals.weight', label: 'Weight', value: `${data.vitals.weight} kg` });
      if (vitalFields.length > 0) sections.push({ title: 'Vital Signs', fields: vitalFields });
    }

    // Vital Signs Series (post-op / observation chart time-series)
    if (data.vital_signs_series && Array.isArray(data.vital_signs_series) && data.vital_signs_series.length > 0) {
      sections.push({
        title: `Vital Signs Chart (${data.vital_signs_series.length} readings)`,
        fields: data.vital_signs_series.map((v: any, i: number) => ({
          key: `vital_signs_series.${i}`,
          label: v.date || v.time || `Reading ${i + 1}`,
          value: [
            v.bp_systolic ? `BP: ${v.bp_systolic}/${v.bp_diastolic}` : '',
            v.temperature ? `T: ${v.temperature}°C` : '',
            v.pulse ? `P: ${v.pulse}` : '',
            v.respiratory_rate ? `RR: ${v.respiratory_rate}` : '',
            v.spo2 ? `SpO2: ${v.spo2}%` : '',
            v.notes || '',
          ].filter(Boolean).join(' | '),
        })),
      });
    }

    // Medications
    if (data.medications && Array.isArray(data.medications) && data.medications.length > 0) {
      sections.push({
        title: 'Medications',
        fields: data.medications.map((m: any, i: number) => ({
          key: 'medications',
          label: m.name || `Medication ${i + 1}`,
          value: [m.dose, m.route, m.frequency, m.duration].filter(Boolean).join(' — ') || 'Details extracted',
        })),
      });
    }

    // Investigations / Lab results
    if (data.investigations && Array.isArray(data.investigations) && data.investigations.length > 0) {
      sections.push({
        title: 'Investigations',
        fields: data.investigations.map((inv: any, i: number) => ({
          key: `investigations.${i}`,
          label: inv.name || inv.test_name || `Test ${i + 1}`,
          value: `${inv.result || inv.result_value || 'Pending'} ${inv.unit || ''} ${inv.abnormal ? '⚠️ ABNORMAL' : ''}`.trim(),
        })),
      });
    }
    if (data.results && Array.isArray(data.results) && data.results.length > 0) {
      sections.push({
        title: 'Lab Results',
        fields: data.results.map((r: any, i: number) => ({
          key: `results.${i}`,
          label: r.test_name || `Result ${i + 1}`,
          value: `${r.result_value} ${r.unit || ''} (Ref: ${r.reference_range || 'N/A'}) ${r.abnormal ? '⚠️' : '✓'}`,
        })),
      });
    }

    // Wounds
    if (data.wounds && Array.isArray(data.wounds) && data.wounds.length > 0) {
      sections.push({
        title: 'Wounds',
        fields: data.wounds.map((w: any, i: number) => ({
          key: `wounds.${i}`,
          label: w.location || `Wound ${i + 1}`,
          value: w.description || 'Wound documented',
        })),
      });
    }

    // Diagnoses
    if (data.diagnoses && Array.isArray(data.diagnoses) && data.diagnoses.length > 0) {
      sections.push({
        title: 'Diagnoses',
        fields: data.diagnoses.map((d: string, i: number) => ({
          key: `diagnoses.${i}`,
          label: `Diagnosis ${i + 1}`,
          value: d,
        })),
      });
    }

    // Additional fields
    const otherFields: { key: string; label: string; value: any }[] = [];
    if (data.diet) otherFields.push({ key: 'diet', label: 'Diet', value: data.diet });
    if (data.activity) otherFields.push({ key: 'activity', label: 'Activity', value: data.activity });
    if (data.notes) otherFields.push({ key: 'notes', label: 'Additional Notes', value: data.notes });
    if (data.findings) otherFields.push({ key: 'findings', label: 'Findings', value: data.findings });
    if (data.impression) otherFields.push({ key: 'impression', label: 'Impression', value: data.impression });
    if (data.raw_text && otherFields.length === 0 && sections.length === 0) {
      otherFields.push({ key: 'raw_text', label: 'Raw Scanned Text', value: data.raw_text });
    }
    if (otherFields.length > 0) sections.push({ title: 'Other', fields: otherFields });

    return (
      <div className="space-y-4 max-h-96 overflow-y-auto">
        {sections.map((section) => (
          <div key={section.title} className="border border-gray-200 rounded-lg overflow-hidden">
            <div className="bg-gray-50 px-4 py-2 font-medium text-sm text-gray-700 flex items-center justify-between">
              <span>{section.title}</span>
              <span className="text-xs text-gray-500">{section.fields.length} field(s)</span>
            </div>
            <div className="divide-y divide-gray-100">
              {section.fields.map((field, idx) => (
                <label
                  key={`${field.key}-${idx}`}
                  className="flex items-start px-4 py-2 hover:bg-green-50 cursor-pointer transition"
                >
                  <input
                    type="checkbox"
                    checked={selectedFields.has(field.key)}
                    onChange={() => toggleField(field.key)}
                    className="mt-1 mr-3 rounded border-gray-300 text-green-600 focus:ring-green-500"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-gray-800">{field.label}</div>
                    <div className="text-sm text-gray-600 whitespace-pre-wrap break-words">
                      {typeof field.value === 'string' && field.value.length > 200
                        ? field.value.substring(0, 200) + '...'
                        : renderFieldValue(field.value)}
                    </div>
                  </div>
                </label>
              ))}
            </div>
          </div>
        ))}
      </div>
    );
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-0 sm:p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-3 sm:px-6 py-3 sm:py-4 border-b border-gray-200">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-lg bg-green-100 flex items-center justify-center">
              <Scan className="h-5 w-5 text-green-600" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-gray-900">AI Document Scanner</h2>
              <p className="text-xs text-gray-500">
                {step === 'capture' && 'Scan or upload a clinical document'}
                {step === 'processing' && 'Processing document with AI...'}
                {step === 'review' && 'Review extracted fields'}
                {step === 'error' && 'Processing failed'}
              </p>
            </div>
          </div>
          <button onClick={() => { resetState(); onClose(); }} className="p-2 hover:bg-gray-100 rounded-lg">
            <X className="h-5 w-5 text-gray-500" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          {/* ─── STEP: Capture ─── */}
          {step === 'capture' && (
            <div className="space-y-4">
              {isCameraActive ? (
                <div className="relative">
                  <video
                    ref={videoRef}
                    className="w-full rounded-lg bg-black"
                    style={{ minHeight: '240px' }}
                    autoPlay
                    playsInline
                    muted
                  />
                  <canvas ref={canvasRef} className="hidden" />
                  <div className="absolute bottom-4 left-0 right-0 flex justify-center space-x-4">
                    <button
                      onClick={captureFromCamera}
                      className="w-16 h-16 bg-white rounded-full border-4 border-green-500 flex items-center justify-center shadow-lg hover:scale-105 transition"
                    >
                      <Camera className="h-7 w-7 text-green-600" />
                    </button>
                    <button
                      onClick={stopCamera}
                      className="w-12 h-12 bg-red-500 rounded-full flex items-center justify-center shadow-lg hover:bg-red-600 transition"
                    >
                      <X className="h-5 w-5 text-white" />
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  {imagePreview ? (
                    <div className="relative">
                      <img src={imagePreview} alt="Document preview" className="w-full rounded-lg border border-gray-200" />
                      <button
                        onClick={() => { setImagePreview(null); }}
                        className="absolute top-2 right-2 p-1 bg-white rounded-full shadow"
                      >
                        <X className="h-4 w-4 text-gray-600" />
                      </button>
                    </div>
                  ) : (
                    <div className="border-2 border-dashed border-gray-300 rounded-xl p-8 text-center">
                      <div className="flex justify-center space-x-4 mb-4">
                        <div className="w-16 h-16 rounded-full bg-green-50 flex items-center justify-center">
                          <Camera className="h-8 w-8 text-green-600" />
                        </div>
                        <div className="w-16 h-16 rounded-full bg-blue-50 flex items-center justify-center">
                          <Upload className="h-8 w-8 text-blue-600" />
                        </div>
                      </div>
                      <h3 className="text-lg font-medium text-gray-900 mb-1">Scan Clinical Document</h3>
                      <p className="text-sm text-gray-500 mb-6">
                        Capture with camera or upload an image/PDF of ward round notes, lab reports, prescriptions, or referral letters
                      </p>
                      <div className="flex justify-center space-x-3">
                        <button
                          onClick={startCamera}
                          className="px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 flex items-center space-x-2 shadow-sm transition"
                        >
                          <Camera className="h-5 w-5" />
                          <span>Use Camera</span>
                        </button>
                        <button
                          onClick={() => fileInputRef.current?.click()}
                          className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center space-x-2 shadow-sm transition"
                        >
                          <Upload className="h-5 w-5" />
                          <span>Upload File</span>
                        </button>
                      </div>
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/*,.pdf"
                        onChange={handleFileSelect}
                        className="hidden"
                      />
                      <input
                        ref={cameraInputRef}
                        type="file"
                        accept="image/*"
                        capture="environment"
                        onChange={handleFileSelect}
                        className="hidden"
                      />
                    </div>
                  )}

                  {/* Document type selector */}
                  <div className="bg-gray-50 rounded-lg p-4">
                    <h4 className="text-sm font-medium text-gray-700 mb-2">Document Type (helps AI accuracy)</h4>
                    <div className="flex flex-wrap gap-2">
                      {[
                        { value: 'general', label: 'Auto-detect', icon: '🔍' },
                        { value: 'handwritten_note', label: 'Handwritten Notes', icon: '✍️' },
                        { value: 'lab_report', label: 'Lab Report', icon: '🧪' },
                        { value: 'prescription', label: 'Prescription', icon: '💊' },
                        { value: 'imaging_report', label: 'Imaging Report', icon: '📷' },
                      ].map(dt => (
                        <button
                          type="button"
                          key={dt.value}
                          onClick={() => {
                            setSelectedDocType(dt.value as DocumentType);
                            if (dt.value === 'handwritten_note') setHandwritingMode(true);
                          }}
                          className={`px-3 py-1.5 rounded-lg text-sm border transition ${
                            selectedDocType === dt.value
                              ? 'bg-green-600 text-white border-green-600'
                              : 'bg-white text-gray-700 border-gray-300 hover:border-green-400'
                          }`}
                        >
                          {dt.icon} {dt.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Handwriting Mode Toggle */}
                  <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                    <label className="flex items-center justify-between cursor-pointer">
                      <div className="flex items-center space-x-3">
                        <span className="text-xl">✍️</span>
                        <div>
                          <h4 className="text-sm font-medium text-gray-900">Advanced Handwriting Recognition</h4>
                          <p className="text-xs text-gray-500">Uses GPT-4o Vision AI to read handwritten medical notes directly from the image</p>
                        </div>
                      </div>
                      <div className="relative">
                        <input
                          type="checkbox"
                          checked={handwritingMode}
                          onChange={e => setHandwritingMode(e.target.checked)}
                          className="sr-only"
                        />
                        <div className={`w-11 h-6 rounded-full transition-colors ${handwritingMode ? 'bg-green-600' : 'bg-gray-300'}`}>
                          <div className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${handwritingMode ? 'translate-x-5' : 'translate-x-0'}`} />
                        </div>
                      </div>
                    </label>
                  </div>
                </>
              )}
            </div>
          )}

          {/* ─── STEP: Processing ─── */}
          {step === 'processing' && (
            <div className="py-12 text-center space-y-6">
              <div className="relative w-24 h-24 mx-auto">
                <div className="absolute inset-0 rounded-full border-4 border-gray-200" />
                <div
                  className="absolute inset-0 rounded-full border-4 border-green-500 border-t-transparent animate-spin"
                  style={{ animationDuration: '1.5s' }}
                />
                <div className="absolute inset-0 flex items-center justify-center">
                  <Brain className="h-10 w-10 text-green-600" />
                </div>
              </div>
              <div>
                <p className="text-lg font-medium text-gray-900">{progressText}</p>
                <div className="mt-3 mx-auto max-w-xs">
                  <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-green-500 rounded-full transition-all duration-500"
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                  <p className="text-sm text-gray-500 mt-1">{progress}% complete</p>
                </div>
              </div>
              {imagePreview && (
                <img src={imagePreview} alt="Processing" className="mx-auto w-48 rounded-lg border border-gray-200 opacity-50" />
              )}
            </div>
          )}

          {/* ─── STEP: Review ─── */}
          {step === 'review' && result && (
            <div className="space-y-4">
              {/* Confidence badge */}
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  {result.aiProcessed ? (
                    <div className="flex items-center space-x-1 px-3 py-1 bg-green-100 text-green-700 rounded-full text-sm">
                      <Brain className="h-4 w-4" />
                      <span>AI Enhanced</span>
                    </div>
                  ) : (
                    <div className="flex items-center space-x-1 px-3 py-1 bg-yellow-100 text-yellow-700 rounded-full text-sm">
                      <AlertTriangle className="h-4 w-4" />
                      <span>Rule-based (AI unavailable)</span>
                    </div>
                  )}
                  <span className="text-sm text-gray-500">
                    Confidence: {Math.round(result.aiConfidence * 100)}% | OCR: {Math.round(result.confidence * 100)}%
                  </span>
                </div>
                <button
                  onClick={() => setShowRawText(!showRawText)}
                  className="text-sm text-gray-600 hover:text-gray-900 flex items-center space-x-1"
                >
                  <Eye className="h-4 w-4" />
                  <span>{showRawText ? 'Hide' : 'Show'} Raw Text</span>
                </button>
              </div>

              {/* Raw OCR text (collapsible) */}
              {showRawText && (
                <div className="bg-gray-50 rounded-lg p-4 max-h-40 overflow-y-auto">
                  <h4 className="text-xs font-semibold text-gray-500 uppercase mb-1">Raw OCR Text</h4>
                  <pre className="text-xs text-gray-700 whitespace-pre-wrap font-mono">{result.text}</pre>
                </div>
              )}

              {/* Extracted fields checklist */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <h4 className="text-sm font-medium text-gray-700">Extracted Fields — Select to Apply</h4>
                  <div className="flex space-x-2">
                    <button
                      onClick={() => {
                        const all = new Set<string>();
                        flattenFields(result.structuredData, '', all);
                        setSelectedFields(all);
                      }}
                      className="text-xs text-green-600 hover:text-green-800"
                    >
                      Select All
                    </button>
                    <button
                      onClick={() => setSelectedFields(new Set())}
                      className="text-xs text-gray-500 hover:text-gray-700"
                    >
                      Deselect All
                    </button>
                  </div>
                </div>
                {renderFieldReview()}
              </div>
            </div>
          )}

          {/* ─── STEP: Error ─── */}
          {step === 'error' && (
            <div className="py-12 text-center space-y-4">
              <AlertTriangle className="h-16 w-16 text-red-400 mx-auto" />
              <h3 className="text-lg font-medium text-gray-900">Processing Failed</h3>
              <p className="text-sm text-gray-500">{error}</p>
              <button
                onClick={resetState}
                className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 flex items-center space-x-2 mx-auto"
              >
                <RotateCw className="h-4 w-4" />
                <span>Try Again</span>
              </button>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-gray-200 px-6 py-3 flex items-center justify-between bg-gray-50 rounded-b-xl">
          <div className="text-xs text-gray-500">
            {step === 'review' && result && (
              <>Processed in {(result.processingTime / 1000).toFixed(1)}s • {selectedFields.size} field(s) selected</>
            )}
          </div>
          <div className="flex space-x-3">
            <button
              onClick={() => { resetState(); onClose(); }}
              className="px-4 py-2 text-sm text-gray-700 bg-gray-200 rounded-lg hover:bg-gray-300 transition"
            >
              Cancel
            </button>
            {step === 'review' && (
              <button
                onClick={applySelectedFields}
                disabled={selectedFields.size === 0}
                className="px-4 py-2 text-sm text-white bg-green-600 rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2 transition"
              >
                <Clipboard className="h-4 w-4" />
                <span>Apply to Form ({selectedFields.size})</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default DocumentScannerModal;

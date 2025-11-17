import React, { useState, useRef, useEffect } from 'react';
import { procedureService, WoundCareAssessment } from '../../services/procedureService';
import { aiWoundMeasurement, WoundMeasurementResult, CalibrationReference } from '../../services/aiWoundMeasurement';
import jsPDF from 'jspdf';

interface WoundCareAssessmentFormProps {
  patientId: string;
  procedureId: string;
  onComplete: (assessmentId: string) => void;
}

export const WoundCareAssessmentForm: React.FC<WoundCareAssessmentFormProps> = ({
  patientId,
  procedureId,
  onComplete
}) => {
  const [assessment, setAssessment] = useState<Partial<WoundCareAssessment>>({
    patient_id: patientId,
    procedure_id: procedureId,
    wound_location: '',
    wound_type: 'surgical',
    wound_nature: 'acute', // New field
    wound_classification: 'clean', // Only shown for acute wounds
    dimensions: {
      length: 0,
      width: 0,
      depth: 0,
      area: 0,
      measurement_method: 'manual'
    },
    dimension_history: [], // Track measurements over time
    appearance: {
      tissue_type: [],
      exudate_amount: 'minimal',
      exudate_type: 'serous',
      odor: 'none',
      surrounding_skin: 'normal'
    },
    healing_stage: 'inflammatory',
    signs_of_infection: {
      present: false,
      signs: [],
      cultures_taken: false
    },
    pain_score: 0,
    pain_characteristics: [],
    dressing_type: '',
    dressing_change_frequency: 'daily',
    topical_treatments: [],
    systemic_treatments: [],
    progress_notes: '',
    healing_rate: 'good',
    expected_healing_time: ''
  });

  const [currentSection, setCurrentSection] = useState('basic_info');
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // AI measurement states
  const [showAIMeasurement, setShowAIMeasurement] = useState(false);
  const [aiMeasurementPhoto, setAIMeasurementPhoto] = useState<File | null>(null);
  const [aiMeasurementResult, setAIMeasurementResult] = useState<WoundMeasurementResult | null>(null);
  const [calibrationReference, setCalibrationReference] = useState<CalibrationReference | null>(null);
  const [calibrationType, setCalibrationType] = useState<'ruler' | 'coin' | 'card' | 'manual' | 'reference_paper'>('reference_paper');
  const [manualPixelsPerCm, setManualPixelsPerCm] = useState<number>(50);
  const [referencePaperLength, setReferencePaperLength] = useState<number>(10); // Default 10cm line
  const [isProcessing, setIsProcessing] = useState(false);
  const photoInputRef = useRef<HTMLInputElement>(null);
  const segmentationCanvasRef = useRef<HTMLCanvasElement>(null);

  // Initialize AI model on mount
  useEffect(() => {
    aiWoundMeasurement.loadModel().catch(console.error);
  }, []);

  const handleInputChange = (field: string, value: any) => {
    setAssessment(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleNestedInputChange = (section: string, field: string, value: any) => {
    setAssessment(prev => ({
      ...prev,
      [section]: {
        ...((prev as any)[section] || {}),
        [field]: value
      }
    }));
  };

  const handleArrayFieldChange = (section: string, field: string, value: string) => {
    const items = value.split('\n').map(item => item.trim()).filter(Boolean);
    handleNestedInputChange(section, field, items);
  };

  const submitAssessment = async () => {
    setIsSubmitting(true);
    try {
      const assessmentId = await procedureService.createWoundCareAssessment(assessment as WoundCareAssessment);
      onComplete(assessmentId);
    } catch (error) {
      console.error('Failed to save wound care assessment:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  // AI Wound Measurement Handlers
  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setAIMeasurementPhoto(file);
      setAIMeasurementResult(null); // Clear previous results
    }
  };

  const handleCalibration = async () => {
    if (!aiMeasurementPhoto) {
      alert('Please upload a wound photo first');
      return;
    }

    let calibration: CalibrationReference;

    if (calibrationType === 'manual') {
      calibration = aiWoundMeasurement.createManualCalibration(manualPixelsPerCm);
    } else if (calibrationType === 'reference_paper') {
      // Reference paper with bold line - RECOMMENDED METHOD
      const img = await loadImageFromFile(aiMeasurementPhoto);
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d')!;
      canvas.width = img.width;
      canvas.height = img.height;
      ctx.drawImage(img, 0, 0);
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);

      calibration = await aiWoundMeasurement.detectReferencePaper(imageData, referencePaperLength);
    } else {
      // For automatic detection, we'd need the image data
      const img = await loadImageFromFile(aiMeasurementPhoto);
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d')!;
      canvas.width = img.width;
      canvas.height = img.height;
      ctx.drawImage(img, 0, 0);
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);

      calibration = await aiWoundMeasurement.detectCalibrationReference(imageData, calibrationType);
    }

    setCalibrationReference(calibration);
    alert(`Calibration set: ${calibration.pixelSize.toFixed(1)} pixels = ${calibration.knownSizeCm} cm`);
  };

  const performAIMeasurement = async () => {
    if (!aiMeasurementPhoto) {
      alert('Please upload a wound photo');
      return;
    }

    if (!calibrationReference) {
      alert('Please calibrate the measurement first');
      return;
    }

    setIsProcessing(true);
    try {
      const result = await aiWoundMeasurement.measureWound(aiMeasurementPhoto, calibrationReference);
      setAIMeasurementResult(result);

      // Display segmentation mask
      if (segmentationCanvasRef.current && result.segmentationMask) {
        const canvas = segmentationCanvasRef.current;
        canvas.width = result.segmentationMask.width;
        canvas.height = result.segmentationMask.height;
        const ctx = canvas.getContext('2d')!;
        ctx.putImageData(result.segmentationMask, 0, 0);
      }

      // Update assessment with AI measurements
      const currentDate = new Date().toISOString();
      const photoBase64 = await fileToBase64(aiMeasurementPhoto);

      setAssessment(prev => ({
        ...prev,
        dimensions: {
          ...prev.dimensions,
          length: result.length,
          width: result.width,
          area: result.area,
          depth: prev.dimensions?.depth || 0,
          measurement_method: 'ai_segmentation',
          ai_confidence_score: result.confidence,
          wound_photo: photoBase64
        },
        dimension_history: [
          ...(prev.dimension_history || []),
          {
            date: currentDate,
            length: result.length,
            width: result.width,
            depth: prev.dimensions?.depth || 0,
            area: result.area,
            measurement_method: 'ai_segmentation',
            photo: photoBase64,
            notes: `AI measurement (${(result.confidence * 100).toFixed(0)}% confidence)`
          }
        ]
      }));

      alert(`✅ Wound measured successfully!\nLength: ${result.length} cm\nWidth: ${result.width} cm\nArea: ${result.area} cm²\nConfidence: ${(result.confidence * 100).toFixed(0)}%`);
    } catch (error) {
      console.error('AI measurement failed:', error);
      alert('Failed to measure wound. Please try manual measurement.');
    } finally {
      setIsProcessing(false);
    }
  };

  const saveMeasurementManually = () => {
    if (!assessment.dimensions || assessment.dimensions.length === 0 || assessment.dimensions.width === 0) {
      alert('Please enter wound dimensions');
      return;
    }

    const currentDate = new Date().toISOString();
    const currentDimensions = assessment.dimensions;

    setAssessment(prev => ({
      ...prev,
      dimension_history: [
        ...(prev.dimension_history || []),
        {
          date: currentDate,
          length: currentDimensions.length,
          width: currentDimensions.width,
          depth: currentDimensions.depth || 0,
          area: currentDimensions.area,
          measurement_method: 'manual',
          notes: 'Manual measurement'
        }
      ]
    }));

    alert('✅ Measurement saved to history');
  };

  const generateProgressReport = () => {
    if (!assessment.dimension_history || assessment.dimension_history.length < 2) {
      alert('Need at least 2 measurements to generate a progress report');
      return;
    }

    const report = aiWoundMeasurement.generateProgressReport(assessment.dimension_history);

    // Generate PDF report
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    let yPosition = 20;

    // Header
    doc.setFillColor(14, 159, 110);
    doc.rect(0, 0, pageWidth, 40, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.text('WOUND HEALING PROGRESS REPORT', pageWidth / 2, 15, { align: 'center' });
    doc.setFontSize(10);
    doc.text('PLASTIC AND RECONSTRUCTIVE SURGERY UNIT', pageWidth / 2, 25, { align: 'center' });
    doc.text(`Generated: ${new Date().toLocaleDateString('en-NG')}`, pageWidth / 2, 32, { align: 'center' });

    yPosition = 50;
    doc.setTextColor(0, 0, 0);

    // Patient info
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.text(`Patient ID: ${patientId}`, 15, yPosition);
    yPosition += 7;
    doc.text(`Procedure ID: ${procedureId}`, 15, yPosition);
    yPosition += 10;

    // Overall trend
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    const trendColor = report.trend === 'improving' ? [14, 159, 110] : report.trend === 'worsening' ? [220, 38, 38] : [234, 179, 8];
    doc.setTextColor(...trendColor);
    doc.text(`Healing Trend: ${report.trend.toUpperCase()}`, 15, yPosition);
    yPosition += 10;

    doc.setTextColor(0, 0, 0);
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text(`Area Change: ${report.percentageChange > 0 ? '+' : ''}${report.percentageChange}%`, 15, yPosition);
    yPosition += 6;
    doc.text(`Average Healing Rate: ${report.averageHealingRate} cm²/day`, 15, yPosition);
    yPosition += 6;
    if (report.estimatedHealingTime) {
      doc.text(`Estimated Complete Healing: ${report.estimatedHealingTime} days`, 15, yPosition);
      yPosition += 6;
    }
    yPosition += 5;

    // Measurement history
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.text('Measurement History:', 15, yPosition);
    yPosition += 8;

    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    assessment.dimension_history!.forEach((measurement, index) => {
      const date = new Date(measurement.date).toLocaleDateString('en-NG');
      doc.text(`${index + 1}. ${date}: Length ${measurement.length} cm × Width ${measurement.width} cm = Area ${measurement.area} cm²`, 20, yPosition);
      yPosition += 5;
      doc.text(`   Method: ${measurement.measurement_method === 'ai_segmentation' ? 'AI Segmentation' : 'Manual'}`, 20, yPosition);
      yPosition += 6;
    });
    yPosition += 5;

    // Recommendations
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.text('Clinical Recommendations:', 15, yPosition);
    yPosition += 8;

    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    report.recommendations.forEach(rec => {
      const lines = doc.splitTextToSize(rec, pageWidth - 30);
      lines.forEach((line: string) => {
        doc.text(line, 20, yPosition);
        yPosition += 5;
      });
    });

    // Save
    doc.save(`UNTH_WoundProgressReport_${patientId}_${new Date().toISOString().split('T')[0]}.pdf`);
  };

  // Helper functions
  const loadImageFromFile = (file: File): Promise<HTMLImageElement> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = reject;
        img.src = e.target?.result as string;
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };

  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };

  const downloadReferencePaperTemplate = () => {
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();

    // Minimal header
    doc.setFillColor(14, 159, 110);
    doc.rect(0, 0, pageWidth, 12, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.text('WOUND MEASUREMENT REFERENCE - 10cm Lines', pageWidth / 2, 7, { align: 'center' });

    // Minimal footer
    doc.setFillColor(14, 159, 110);
    doc.rect(0, pageHeight - 8, pageWidth, 8, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(6);
    doc.text('PLASTIC AND RECONSTRUCTIVE SURGERY UNIT | Print at 100% - DO NOT SCALE | Cut any line for use', pageWidth / 2, pageHeight - 3, { align: 'center' });

    // Define printable area (avoiding header and footer)
    const startY = 15;
    const endY = pageHeight - 10;
    const availableHeight = endY - startY;
    
    const lineLength = 100; // 10cm = 100mm
    const gapBetweenLines = 25; // 2.5cm = 25mm
    const lineHeight = 10; // Height allocated for each line including labels
    const rowSpacing = lineHeight + gapBetweenLines; // Total vertical space per row
    
    // Calculate how many rows of lines we can fit
    const numberOfRows = Math.floor(availableHeight / rowSpacing);
    
    // Calculate how many columns we can fit (each line is 100mm wide)
    const marginX = 10;
    const availableWidth = pageWidth - (2 * marginX);
    const numberOfColumns = Math.floor(availableWidth / (lineLength + 20)); // 20mm gap between columns
    
    // Center the grid
    const totalGridWidth = numberOfColumns * lineLength + (numberOfColumns - 1) * 20;
    const startX = (pageWidth - totalGridWidth) / 2;
    
    // Draw cutting guides (light gray dashed lines between rows)
    doc.setDrawColor(180, 180, 180);
    doc.setLineDash([2, 2]);
    doc.setLineWidth(0.3);
    
    for (let row = 1; row < numberOfRows; row++) {
      const y = startY + (row * rowSpacing) - (gapBetweenLines / 2);
      doc.line(0, y, pageWidth, y);
    }
    doc.setLineDash([]); // Reset to solid lines

    // Draw 10cm lines in a grid pattern
    let lineNumber = 1;
    
    for (let row = 0; row < numberOfRows; row++) {
      for (let col = 0; col < numberOfColumns; col++) {
        const x = startX + (col * (lineLength + 20));
        const y = startY + (row * rowSpacing) + 8;
        
        // Draw the 10cm line - BOLD
        doc.setDrawColor(0, 0, 0);
        doc.setLineWidth(4);
        doc.line(x, y, x + lineLength, y);
        
        // End markers (vertical bars)
        doc.setLineWidth(3);
        doc.line(x, y - 4, x, y + 4);
        doc.line(x + lineLength, y - 4, x + lineLength, y + 4);
        
        // Label above line
        doc.setTextColor(0, 0, 0);
        doc.setFontSize(8);
        doc.setFont('helvetica', 'bold');
        doc.text('10.0 cm', x + (lineLength / 2), y - 2, { align: 'center' });
        
        // Label below line (line number for reference)
        doc.setFontSize(6);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(100, 100, 100);
        doc.text(`#${lineNumber}`, x + (lineLength / 2), y + 7, { align: 'center' });
        
        lineNumber++;
      }
    }

    // Add corner marks for cutting
    doc.setDrawColor(220, 38, 38);
    doc.setLineWidth(0.5);
    const cornerSize = 3;
    
    // Add cutting marks between each row
    for (let row = 1; row < numberOfRows; row++) {
      const cutY = startY + (row * rowSpacing) - (gapBetweenLines / 2);
      
      // Left edge marks
      doc.line(5, cutY - cornerSize, 5, cutY + cornerSize);
      doc.line(5 - cornerSize, cutY, 5 + cornerSize, cutY);
      
      // Right edge marks
      doc.line(pageWidth - 5, cutY - cornerSize, pageWidth - 5, cutY + cornerSize);
      doc.line(pageWidth - 5 - cornerSize, cutY, pageWidth - 5 + cornerSize, cutY);
    }

    // Instructions in remaining space (if any)
    if (numberOfRows * rowSpacing < availableHeight - 15) {
      const instructY = startY + (numberOfRows * rowSpacing) + 5;
      doc.setTextColor(0, 0, 0);
      doc.setFontSize(7);
      doc.setFont('helvetica', 'bold');
      doc.text('INSTRUCTIONS:', pageWidth / 2, instructY, { align: 'center' });
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(6);
      doc.text('Cut along dashed lines to separate individual 10cm reference lines • Place beside wound • Photo from directly above', pageWidth / 2, instructY + 4, { align: 'center' });
    }

    // Save
    doc.save('UNTH_Wound_Measurement_Reference_Template.pdf');
  };

  const renderBasicInfo = () => (
    <div className="space-y-6">
      <h3 className="text-lg font-semibold text-gray-900">Basic Wound Information</h3>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Wound Type */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Wound Type
          </label>
          <select
            value={assessment.wound_type || 'surgical'}
            onChange={(e) => handleInputChange('wound_type', e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-purple-500"
          >
            <option value="surgical">Surgical Wound</option>
            <option value="traumatic">Traumatic Wound</option>
            <option value="pressure">Pressure Ulcer</option>
            <option value="venous">Venous Ulcer</option>
            <option value="arterial">Arterial Ulcer</option>
            <option value="diabetic">Diabetic Ulcer</option>
            <option value="other">Other</option>
          </select>
        </div>

        {/* Wound Nature - NEW FIELD */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            <span className="inline-flex items-center">
              Wound Nature
              <span className="ml-2 text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded">Dynamic</span>
            </span>
          </label>
          <select
            value={assessment.wound_nature || 'acute'}
            onChange={(e) => {
              const nature = e.target.value as 'acute' | 'chronic';
              handleInputChange('wound_nature', nature);
              // Reset dependent fields
              if (nature === 'acute') {
                handleInputChange('healing_stage', undefined);
              } else {
                handleInputChange('wound_classification', undefined);
              }
            }}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-purple-500"
          >
            <option value="acute">Acute Wound</option>
            <option value="chronic">Chronic Wound</option>
          </select>
          <p className="text-xs text-gray-500 mt-1">
            {assessment.wound_nature === 'acute' 
              ? '⚡ Acute wounds heal in expected timeframe' 
              : '🕐 Chronic wounds persist beyond normal healing time'}
          </p>
        </div>
      </div>

      {/* Dynamic Field: Wound Classification (only for Acute wounds) */}
      {assessment.wound_nature === 'acute' && (
        <div className="bg-blue-50 border-2 border-blue-200 rounded-lg p-4">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            <span className="inline-flex items-center">
              🔍 Wound Classification (Acute Wound)
            </span>
          </label>
          <select
            value={assessment.wound_classification || 'clean'}
            onChange={(e) => handleInputChange('wound_classification', e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
          >
            <option value="clean">Clean</option>
            <option value="clean_contaminated">Clean-Contaminated</option>
            <option value="contaminated">Contaminated</option>
            <option value="dirty">Dirty/Infected</option>
          </select>
          <p className="text-xs text-gray-600 mt-2">
            Classification based on surgical wound contamination level
          </p>
        </div>
      )}

      {/* Dynamic Field: Healing Stage (only for Chronic wounds) */}
      {assessment.wound_nature === 'chronic' && (
        <div className="bg-orange-50 border-2 border-orange-200 rounded-lg p-4">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            <span className="inline-flex items-center">
              📊 Healing Stage (Chronic Wound)
            </span>
          </label>
          <select
            value={assessment.healing_stage || 'acute_wound'}
            onChange={(e) => handleInputChange('healing_stage', e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-orange-500"
          >
            <option value="acute_wound">Acute Wound (0-4 days)</option>
            <option value="extension_wound">Extension Wound (2-14 days)</option>
            <option value="transition_wound">Transition Wound (14-21 days)</option>
            <option value="repair_wound">Repair Wound (21-42 days)</option>
            <option value="indolent_wound">Indolent Wound ({'>'}42 days, non-healing)</option>
          </select>
          <div className="mt-3 text-xs text-gray-600 space-y-1">
            <p><strong>Acute Wound:</strong> Initial inflammatory response (0-4 days)</p>
            <p><strong>Extension Wound:</strong> Active inflammation, granulation beginning (2-14 days)</p>
            <p><strong>Transition Wound:</strong> Transition to epithelialization (14-21 days)</p>
            <p><strong>Repair Wound:</strong> Active repair, wound contraction (21-42 days)</p>
            <p><strong>Indolent Wound:</strong> Stalled healing, requires intervention ({'>'}42 days)</p>
          </div>
        </div>
      )}

      {/* Wound Location */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Wound Location
        </label>
        <textarea
          value={assessment.wound_location || ''}
          onChange={(e) => handleInputChange('wound_location', e.target.value)}
          rows={2}
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-purple-500"
          placeholder="Describe exact anatomical location of the wound..."
        />
      </div>

      {/* AI-Powered Wound Measurement Section */}
      <div className="bg-gradient-to-br from-purple-50 to-blue-50 border-2 border-purple-300 rounded-lg p-6 shadow-md">
        <div className="flex items-center justify-between mb-4">
          <h4 className="text-lg font-bold text-gray-900 flex items-center">
            <span className="text-2xl mr-2">🤖</span>
            Wound Dimension Measurement
          </h4>
          <button
            type="button"
            onClick={() => setShowAIMeasurement(!showAIMeasurement)}
            className="px-4 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700 transition-colors"
          >
            {showAIMeasurement ? '📏 Manual Entry' : '📸 AI Measurement'}
          </button>
        </div>

        <p className="text-sm text-gray-700 mb-4">
          {showAIMeasurement 
            ? '🎯 Upload a wound photo and use AI segmentation to automatically measure dimensions with high accuracy'
            : '✍️ Enter wound dimensions manually'}
        </p>

        {showAIMeasurement ? (
          /* AI Measurement Interface */
          <div className="space-y-4">
            {/* Photo Upload */}
            <div className="bg-white rounded-lg p-4 border-2 border-dashed border-purple-300">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                📷 Upload Wound Photograph
              </label>
              <input
                ref={photoInputRef}
                type="file"
                accept="image/*"
                capture="environment"
                onChange={handlePhotoUpload}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-purple-500"
              />
              <p className="text-xs text-gray-500 mt-2">
                💡 Tip: Include a ruler, coin, or credit card in the photo for automatic calibration
              </p>
              
              {aiMeasurementPhoto && (
                <div className="mt-3">
                  <img
                    src={URL.createObjectURL(aiMeasurementPhoto)}
                    alt="Wound"
                    className="max-w-full h-auto rounded-md border-2 border-purple-200"
                    style={{ maxHeight: '300px' }}
                  />
                </div>
              )}
            </div>

            {/* Calibration */}
            <div className="bg-white rounded-lg p-4 border border-purple-200">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                📐 Calibration Method
              </label>
              
              {/* RECOMMENDED METHOD HIGHLIGHT */}
              <div className="bg-gradient-to-r from-green-50 to-emerald-50 border-2 border-green-400 rounded-lg p-3 mb-4">
                <div className="flex items-start space-x-2">
                  <span className="text-2xl">⭐</span>
                  <div className="flex-1">
                    <p className="font-bold text-green-800 mb-1">RECOMMENDED: Reference Paper Method</p>
                    <p className="text-xs text-green-700 mb-2">
                      Place a white paper beside the wound with a bold horizontal line (use a marker or pen).
                      Write the line length (e.g., "10 cm") clearly next to it for verification.
                    </p>
                    <div className="bg-white rounded p-2 text-xs text-gray-700 mb-3">
                      <p className="font-semibold mb-1">✅ Benefits:</p>
                      <ul className="list-disc list-inside space-y-1">
                        <li>Most accurate calibration method</li>
                        <li>Easy to standardize across measurements</li>
                        <li>Human-readable for verification</li>
                        <li>High contrast for AI detection</li>
                        <li>Reusable reference (can laminate)</li>
                      </ul>
                    </div>
                    <button
                      type="button"
                      onClick={downloadReferencePaperTemplate}
                      className="w-full bg-green-600 hover:bg-green-700 text-white px-4 py-2.5 rounded-md font-medium flex items-center justify-center gap-2 shadow-sm transition-colors"
                    >
                      <span className="text-lg">📄</span>
                      Download Reference Paper Template (PDF)
                      <span className="text-lg">⬇️</span>
                    </button>
                    <p className="text-xs text-green-700 mt-2 text-center">
                      Print on A4 paper • Optional: Laminate for repeated use • Contains 5cm, 10cm, 15cm, 20cm lines
                    </p>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-3">
                <label className="flex items-center space-x-2 cursor-pointer bg-green-50 border-2 border-green-500 rounded-lg p-2">
                  <input
                    type="radio"
                    value="reference_paper"
                    checked={calibrationType === 'reference_paper'}
                    onChange={(e) => setCalibrationType(e.target.value as any)}
                    className="text-green-600 focus:ring-green-500"
                  />
                  <span className="text-sm font-semibold text-green-800">📄 Reference Paper ⭐</span>
                </label>
                <label className="flex items-center space-x-2 cursor-pointer">
                  <input
                    type="radio"
                    value="ruler"
                    checked={calibrationType === 'ruler'}
                    onChange={(e) => setCalibrationType(e.target.value as any)}
                    className="text-purple-600 focus:ring-purple-500"
                  />
                  <span className="text-sm">📏 Ruler</span>
                </label>
                <label className="flex items-center space-x-2 cursor-pointer">
                  <input
                    type="radio"
                    value="coin"
                    checked={calibrationType === 'coin'}
                    onChange={(e) => setCalibrationType(e.target.value as any)}
                    className="text-purple-600 focus:ring-purple-500"
                  />
                  <span className="text-sm">🪙 Coin</span>
                </label>
                <label className="flex items-center space-x-2 cursor-pointer">
                  <input
                    type="radio"
                    value="card"
                    checked={calibrationType === 'card'}
                    onChange={(e) => setCalibrationType(e.target.value as any)}
                    className="text-purple-600 focus:ring-purple-500"
                  />
                  <span className="text-sm">💳 Card</span>
                </label>
                <label className="flex items-center space-x-2 cursor-pointer">
                  <input
                    type="radio"
                    value="manual"
                    checked={calibrationType === 'manual'}
                    onChange={(e) => setCalibrationType(e.target.value as any)}
                    className="text-purple-600 focus:ring-purple-500"
                  />
                  <span className="text-sm">✍️ Manual</span>
                </label>
              </div>

              {calibrationType === 'reference_paper' && (
                <div className="mb-3 bg-green-50 rounded-lg p-3 border border-green-200">
                  <label className="block text-sm font-semibold text-green-800 mb-2">
                    📏 Reference Line Length (cm):
                  </label>
                  <input
                    type="number"
                    step="0.5"
                    value={referencePaperLength}
                    onChange={(e) => setReferencePaperLength(parseFloat(e.target.value) || 10)}
                    className="w-full px-3 py-2 border-2 border-green-300 rounded-md focus:ring-2 focus:ring-green-500"
                    placeholder="e.g., 10"
                  />
                  <p className="text-xs text-green-700 mt-2">
                    📝 Enter the exact length of the bold line you drew on the reference paper
                  </p>
                  <div className="mt-3 p-2 bg-white rounded border border-green-200">
                    <p className="text-xs font-semibold text-gray-700 mb-1">💡 Quick Setup Instructions:</p>
                    <ol className="text-xs text-gray-600 space-y-1 list-decimal list-inside">
                      <li>Take a white A4 paper</li>
                      <li>Draw a bold horizontal line (10 cm recommended) using a black marker</li>
                      <li>Write "10 cm" or your chosen length clearly next to the line</li>
                      <li>Place the paper flat beside the wound</li>
                      <li>Take the photo ensuring both wound and reference line are visible</li>
                      <li>Keep the camera directly above (perpendicular) for best accuracy</li>
                    </ol>
                  </div>
                </div>
              )}

              {calibrationType === 'manual' && (
                <div className="mb-3">
                  <label className="block text-xs text-gray-600 mb-1">Pixels per centimeter:</label>
                  <input
                    type="number"
                    value={manualPixelsPerCm}
                    onChange={(e) => setManualPixelsPerCm(parseFloat(e.target.value))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-purple-500"
                    placeholder="e.g., 50"
                  />
                </div>
              )}

              <button
                type="button"
                onClick={handleCalibration}
                disabled={!aiMeasurementPhoto}
                className="w-full px-4 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700 transition-colors disabled:bg-gray-300 disabled:cursor-not-allowed"
              >
                ✅ Set Calibration
              </button>
              
              {calibrationReference && (
                <div className="mt-2 p-2 bg-green-100 text-green-800 text-xs rounded">
                  ✓ Calibration set: {calibrationReference.pixelSize.toFixed(1)} pixels = {calibrationReference.knownSizeCm} cm
                </div>
              )}
            </div>

            {/* Measure Button */}
            <button
              type="button"
              onClick={performAIMeasurement}
              disabled={!aiMeasurementPhoto || !calibrationReference || isProcessing}
              className="w-full px-6 py-3 bg-gradient-to-r from-purple-600 to-blue-600 text-white rounded-lg font-semibold hover:from-purple-700 hover:to-blue-700 transition-all disabled:bg-gray-300 disabled:cursor-not-allowed shadow-md flex items-center justify-center space-x-2"
            >
              {isProcessing ? (
                <>
                  <span className="animate-spin">⏳</span>
                  <span>Processing AI Measurement...</span>
                </>
              ) : (
                <>
                  <span>🤖</span>
                  <span>Perform AI Measurement</span>
                </>
              )}
            </button>

            {/* Segmentation Result */}
            {aiMeasurementResult && (
              <div className="bg-white rounded-lg p-4 border-2 border-green-300">
                <h5 className="font-bold text-green-800 mb-3">✅ AI Measurement Results</h5>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-3">
                  <div className="bg-green-50 p-3 rounded">
                    <p className="text-xs text-gray-600">Length</p>
                    <p className="text-lg font-bold text-green-700">{aiMeasurementResult.length} cm</p>
                  </div>
                  <div className="bg-green-50 p-3 rounded">
                    <p className="text-xs text-gray-600">Width</p>
                    <p className="text-lg font-bold text-green-700">{aiMeasurementResult.width} cm</p>
                  </div>
                  <div className="bg-green-50 p-3 rounded">
                    <p className="text-xs text-gray-600">Area</p>
                    <p className="text-lg font-bold text-green-700">{aiMeasurementResult.area} cm²</p>
                  </div>
                  <div className="bg-green-50 p-3 rounded">
                    <p className="text-xs text-gray-600">Confidence</p>
                    <p className="text-lg font-bold text-green-700">{(aiMeasurementResult.confidence * 100).toFixed(0)}%</p>
                  </div>
                </div>
                
                <canvas
                  ref={segmentationCanvasRef}
                  className="w-full h-auto rounded-md border-2 border-green-300"
                  style={{ maxHeight: '300px' }}
                />
                <p className="text-xs text-gray-500 mt-2 text-center">AI Segmentation Mask</p>
              </div>
            )}
          </div>
        ) : (
          /* Manual Entry Interface */
          <div className="space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Length (cm)
                </label>
                <input
                  type="number"
                  step="0.1"
                  value={assessment.dimensions?.length || ''}
                  onChange={(e) => handleNestedInputChange('dimensions', 'length', parseFloat(e.target.value) || 0)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-purple-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Width (cm)
                </label>
                <input
                  type="number"
                  step="0.1"
                  value={assessment.dimensions?.width || ''}
                  onChange={(e) => handleNestedInputChange('dimensions', 'width', parseFloat(e.target.value) || 0)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-purple-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Depth (cm)
                </label>
                <input
                  type="number"
                  step="0.1"
                  value={assessment.dimensions?.depth || ''}
                  onChange={(e) => handleNestedInputChange('dimensions', 'depth', parseFloat(e.target.value) || 0)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-purple-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Area (cm²)
                </label>
                <input
                  type="number"
                  step="0.1"
                  value={assessment.dimensions?.area || ''}
                  onChange={(e) => handleNestedInputChange('dimensions', 'area', parseFloat(e.target.value) || 0)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-purple-500"
                />
              </div>
            </div>

            <button
              type="button"
              onClick={saveMeasurementManually}
              className="w-full px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
            >
              💾 Save Manual Measurement to History
            </button>
          </div>
        )}
      </div>

      {/* Measurement History & Progress Report */}
      {assessment.dimension_history && assessment.dimension_history.length > 0 && (
        <div className="bg-gradient-to-br from-green-50 to-teal-50 border-2 border-green-300 rounded-lg p-6">
          <h4 className="text-lg font-bold text-gray-900 mb-4 flex items-center">
            <span className="text-2xl mr-2">📊</span>
            Wound Measurement History & Progress Tracking
          </h4>

          <div className="space-y-3 mb-4">
            {assessment.dimension_history.map((measurement, index) => (
              <div key={index} className="bg-white rounded-lg p-3 border border-green-200">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-semibold text-gray-800">
                      {index + 1}. {new Date(measurement.date).toLocaleDateString('en-NG')}
                    </p>
                    <p className="text-sm text-gray-600">
                      Length: {measurement.length} cm × Width: {measurement.width} cm = Area: {measurement.area} cm²
                    </p>
                    <p className="text-xs text-gray-500">
                      Method: {measurement.measurement_method === 'ai_segmentation' ? '🤖 AI Segmentation' : '✍️ Manual'}
                      {measurement.notes && ` | ${measurement.notes}`}
                    </p>
                  </div>
                  {measurement.photo && (
                    <img
                      src={measurement.photo}
                      alt={`Measurement ${index + 1}`}
                      className="w-16 h-16 object-cover rounded-md border border-green-300"
                    />
                  )}
                </div>
              </div>
            ))}
          </div>

          {assessment.dimension_history.length >= 2 && (
            <button
              type="button"
              onClick={generateProgressReport}
              className="w-full px-6 py-3 bg-gradient-to-r from-green-600 to-teal-600 text-white rounded-lg font-semibold hover:from-green-700 hover:to-teal-700 transition-all shadow-md flex items-center justify-center space-x-2"
            >
              <span>📈</span>
              <span>Generate Healing Progress Report (PDF)</span>
            </button>
          )}
        </div>
      )}
    </div>
  );

  const renderWoundCharacteristics = () => (
    <div className="space-y-6">
      <h3 className="text-lg font-semibold text-gray-900">Wound Appearance & Characteristics</h3>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Exudate Amount
          </label>
          <select
            value={assessment.appearance?.exudate_amount || 'minimal'}
            onChange={(e) => handleNestedInputChange('appearance', 'exudate_amount', e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-purple-500"
          >
            <option value="none">None</option>
            <option value="minimal">Minimal</option>
            <option value="moderate">Moderate</option>
            <option value="heavy">Heavy</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Exudate Type
          </label>
          <select
            value={assessment.appearance?.exudate_type || 'serous'}
            onChange={(e) => handleNestedInputChange('appearance', 'exudate_type', e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-purple-500"
          >
            <option value="serous">Serous (Clear)</option>
            <option value="serosanguinous">Serosanguinous (Pink/Red)</option>
            <option value="sanguinous">Sanguinous (Bloody)</option>
            <option value="purulent">Purulent (Pus)</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Odor
          </label>
          <select
            value={assessment.appearance?.odor || 'none'}
            onChange={(e) => handleNestedInputChange('appearance', 'odor', e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-purple-500"
          >
            <option value="none">No Odor</option>
            <option value="mild">Mild Odor</option>
            <option value="moderate">Moderate Odor</option>
            <option value="strong">Strong Odor</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Pain Score (0-10)
          </label>
          <input
            type="number"
            min="0"
            max="10"
            value={assessment.pain_score || 0}
            onChange={(e) => handleInputChange('pain_score', parseInt(e.target.value))}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-purple-500"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Surrounding Skin
          </label>
          <select
            value={assessment.appearance?.surrounding_skin || 'normal'}
            onChange={(e) => handleNestedInputChange('appearance', 'surrounding_skin', e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-purple-500"
          >
            <option value="normal">Normal</option>
            <option value="erythema">Erythema (Red)</option>
            <option value="maceration">Maceration</option>
            <option value="induration">Induration (Hard)</option>
            <option value="other">Other</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Healing Rate
          </label>
          <select
            value={assessment.healing_rate || 'good'}
            onChange={(e) => handleInputChange('healing_rate', e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-purple-500"
          >
            <option value="excellent">Excellent</option>
            <option value="good">Good</option>
            <option value="fair">Fair</option>
            <option value="poor">Poor</option>
          </select>
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Tissue Types Present (One per line)
        </label>
        <textarea
          value={assessment.appearance?.tissue_type?.join('\n') || ''}
          onChange={(e) => handleArrayFieldChange('appearance', 'tissue_type', e.target.value)}
          rows={4}
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-purple-500"
          placeholder={`granulation
necrotic
slough
eschar
epithelial`}
        />
      </div>

      <div>
        <h4 className="text-md font-semibold text-gray-800 mb-3">Signs of Infection</h4>
        <div className="space-y-3">
          <div className="flex items-center">
            <input
              type="checkbox"
              id="infection_present"
              checked={assessment.signs_of_infection?.present || false}
              onChange={(e) => handleNestedInputChange('signs_of_infection', 'present', e.target.checked)}
              className="h-4 w-4 text-purple-600 focus:ring-purple-500 border-gray-300 rounded"
            />
            <label htmlFor="infection_present" className="ml-3 text-sm font-medium text-gray-700">
              Signs of infection present
            </label>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Infection Signs (One per line)
            </label>
            <textarea
              value={assessment.signs_of_infection?.signs?.join('\n') || ''}
              onChange={(e) => handleArrayFieldChange('signs_of_infection', 'signs', e.target.value)}
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-purple-500"
              placeholder={`erythema
warmth
swelling
pain
purulent_drainage
fever`}
            />
          </div>

          <div className="flex items-center">
            <input
              type="checkbox"
              id="cultures_taken"
              checked={assessment.signs_of_infection?.cultures_taken || false}
              onChange={(e) => handleNestedInputChange('signs_of_infection', 'cultures_taken', e.target.checked)}
              className="h-4 w-4 text-purple-600 focus:ring-purple-500 border-gray-300 rounded"
            />
            <label htmlFor="cultures_taken" className="ml-3 text-sm font-medium text-gray-700">
              Cultures taken for analysis
            </label>
          </div>
        </div>
      </div>
    </div>
  );

  const renderTreatment = () => (
    <div className="space-y-6">
      <h3 className="text-lg font-semibold text-gray-900">Treatment Plan</h3>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Dressing Type
          </label>
          <input
            type="text"
            value={assessment.dressing_type || ''}
            onChange={(e) => handleInputChange('dressing_type', e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-purple-500"
            placeholder="Gauze, hydrocolloid, foam, etc."
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Dressing Change Frequency
          </label>
          <select
            value={assessment.dressing_change_frequency || 'daily'}
            onChange={(e) => handleInputChange('dressing_change_frequency', e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-purple-500"
          >
            <option value="twice_daily">Twice Daily</option>
            <option value="daily">Daily</option>
            <option value="every_other_day">Every Other Day</option>
            <option value="twice_weekly">Twice Weekly</option>
            <option value="weekly">Weekly</option>
            <option value="as_needed">As Needed</option>
          </select>
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Topical Treatments (One per line)
        </label>
        <textarea
          value={assessment.topical_treatments?.join('\n') || ''}
          onChange={(e) => handleArrayFieldChange('', 'topical_treatments', e.target.value)}
          rows={3}
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-purple-500"
          placeholder={`Antibiotic ointment
Silver sulfadiazine
Hydrogel`}
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Systemic Treatments (One per line)
        </label>
        <textarea
          value={assessment.systemic_treatments?.join('\n') || ''}
          onChange={(e) => handleArrayFieldChange('', 'systemic_treatments', e.target.value)}
          rows={3}
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-purple-500"
          placeholder={`Antibiotics
Pain medications
Anti-inflammatory drugs`}
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Expected Healing Time
        </label>
        <input
          type="text"
          value={assessment.expected_healing_time || ''}
          onChange={(e) => handleInputChange('expected_healing_time', e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-purple-500"
          placeholder="e.g., 2-3 weeks, 1 month"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Progress Notes
        </label>
        <textarea
          value={assessment.progress_notes || ''}
          onChange={(e) => handleInputChange('progress_notes', e.target.value)}
          rows={4}
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-purple-500"
          placeholder="Document healing progress, patient tolerance, any concerns..."
        />
      </div>
    </div>
  );

  const sections = [
    { id: 'basic_info', name: 'Basic Info', icon: '📋' },
    { id: 'characteristics', name: 'Characteristics', icon: '🔍' },
    { id: 'treatment', name: 'Treatment Plan', icon: '🩹' }
  ];

  const renderCurrentSection = () => {
    switch (currentSection) {
      case 'basic_info':
        return renderBasicInfo();
      case 'characteristics':
        return renderWoundCharacteristics();
      case 'treatment':
        return renderTreatment();
      default:
        return renderBasicInfo();
    }
  };

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200">
      <div className="px-6 py-4 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-gray-900">Wound Care Assessment</h2>
            <p className="text-gray-600 mt-1">Comprehensive wound evaluation and management</p>
          </div>
          
          <div className="text-right text-sm text-gray-500">
            <div>Type: {assessment.wound_type}</div>
            <div>Stage: {assessment.healing_stage}</div>
          </div>
        </div>
      </div>

      {/* Section Navigation */}
      <div className="border-b border-gray-200">
        <nav className="flex space-x-8 px-6">
          {sections.map(section => (
            <button
              key={section.id}
              onClick={() => setCurrentSection(section.id)}
              className={`py-4 px-1 border-b-2 font-medium text-sm ${
                currentSection === section.id
                  ? 'border-purple-500 text-purple-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <span className="mr-2">{section.icon}</span>
              {section.name}
            </button>
          ))}
        </nav>
      </div>

      <div className="p-6">
        {renderCurrentSection()}

        <div className="mt-8 flex justify-between">
          <button
            onClick={() => {
              const currentIndex = sections.findIndex(s => s.id === currentSection);
              if (currentIndex > 0) {
                setCurrentSection(sections[currentIndex - 1].id);
              }
            }}
            disabled={sections.findIndex(s => s.id === currentSection) === 0}
            className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Previous Section
          </button>
          
          {sections.findIndex(s => s.id === currentSection) === sections.length - 1 ? (
            <button
              onClick={submitAssessment}
              disabled={isSubmitting}
              className="px-6 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting ? 'Saving Assessment...' : 'Complete Assessment'}
            </button>
          ) : (
            <button
              onClick={() => {
                const currentIndex = sections.findIndex(s => s.id === currentSection);
                if (currentIndex < sections.length - 1) {
                  setCurrentSection(sections[currentIndex + 1].id);
                }
              }}
              className="px-4 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700"
            >
              Next Section
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
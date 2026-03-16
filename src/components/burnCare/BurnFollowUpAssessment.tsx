/**
 * Burn Follow-Up Assessment Component
 * 
 * AI-powered wound healing assessment and tracking for burn patients
 * Features:
 * - Compare current wound status to previous assessments
 * - AI analysis of healing trajectory
 * - Wound image capture and analysis
 * - Vancouver Scar Scale scoring
 * - Treatment recommendations
 */

import React, { useState, useRef, useCallback, useEffect } from 'react';
import {
  Camera,
  Upload,
  TrendingUp,
  TrendingDown,
  Minus,
  AlertTriangle,
  CheckCircle,
  Clock,
  Activity,
  Thermometer,
  Droplet,
  Calendar,
  ChevronDown,
  ChevronUp,
  RefreshCw,
  X,
  Save,
  Image as ImageIcon,
  Brain,
  FileText,
  BarChart3,
  AlertCircle,
  ArrowRight,
  Stethoscope,
  Scissors,
  Heart,
  Utensils,
  Users
} from 'lucide-react';
import {
  burnExpertAIService,
  FollowUpAssessment,
  WoundRegionStatus,
  WoundHealingStatus,
  InfectionStatus,
  GraftStatus,
  ScarAssessment,
  VancouverScarScale,
  FollowUpAIAnalysis,
  FollowUpRecommendation,
  FollowUpImage,
  HealingProgressReport
} from '../../services/burnExpertAIService';
import { AnatomicalRegion, BurnDepth, TBSARegion } from '../../services/burnCareService';

interface BurnFollowUpAssessmentProps {
  burnPatientId: string;
  patientName: string;
  injuryDate: Date;
  initialTBSA: number;
  initialRegions: TBSARegion[];
  previousAssessments: FollowUpAssessment[];
  currentUser: string;
  onSaveAssessment: (assessment: FollowUpAssessment) => void;
  onClose?: () => void;
}

const REGION_NAMES: Record<AnatomicalRegion, string> = {
  'head_anterior': 'Head (Front)',
  'head_posterior': 'Head (Back)',
  'neck_anterior': 'Neck (Front)',
  'neck_posterior': 'Neck (Back)',
  'trunk_anterior': 'Chest/Abdomen',
  'trunk_posterior': 'Back',
  'right_arm_anterior': 'Right Arm (Front)',
  'right_arm_posterior': 'Right Arm (Back)',
  'left_arm_anterior': 'Left Arm (Front)',
  'left_arm_posterior': 'Left Arm (Back)',
  'right_hand': 'Right Hand',
  'left_hand': 'Left Hand',
  'genitalia': 'Perineum',
  'right_thigh_anterior': 'Right Thigh (Front)',
  'right_thigh_posterior': 'Right Thigh (Back)',
  'left_thigh_anterior': 'Left Thigh (Front)',
  'left_thigh_posterior': 'Left Thigh (Back)',
  'right_leg_anterior': 'Right Lower Leg (Front)',
  'right_leg_posterior': 'Right Lower Leg (Back)',
  'left_leg_anterior': 'Left Lower Leg (Front)',
  'left_leg_posterior': 'Left Lower Leg (Back)',
  'right_foot': 'Right Foot',
  'left_foot': 'Left Foot',
};

const HEALING_STATUS_STYLES: Record<WoundHealingStatus, { bg: string; text: string; icon: React.ReactNode }> = {
  improving: { bg: 'bg-green-100', text: 'text-green-700', icon: <TrendingUp className="h-4 w-4" /> },
  static: { bg: 'bg-yellow-100', text: 'text-yellow-700', icon: <Minus className="h-4 w-4" /> },
  deteriorating: { bg: 'bg-red-100', text: 'text-red-700', icon: <TrendingDown className="h-4 w-4" /> },
  healed: { bg: 'bg-blue-100', text: 'text-blue-700', icon: <CheckCircle className="h-4 w-4" /> },
  grafted: { bg: 'bg-purple-100', text: 'text-purple-700', icon: <Scissors className="h-4 w-4" /> },
};

const INFECTION_STATUS_STYLES: Record<InfectionStatus, { bg: string; text: string }> = {
  none: { bg: 'bg-green-100', text: 'text-green-700' },
  suspected: { bg: 'bg-yellow-100', text: 'text-yellow-700' },
  confirmed: { bg: 'bg-red-100', text: 'text-red-700' },
  resolving: { bg: 'bg-blue-100', text: 'text-blue-700' },
};

const RECOMMENDATION_ICONS: Record<string, React.ReactNode> = {
  wound_care: <Droplet className="h-4 w-4" />,
  surgery: <Scissors className="h-4 w-4" />,
  rehabilitation: <Activity className="h-4 w-4" />,
  infection: <AlertTriangle className="h-4 w-4" />,
  nutrition: <Utensils className="h-4 w-4" />,
  psychology: <Heart className="h-4 w-4" />,
  follow_up: <Calendar className="h-4 w-4" />,
};

const BurnFollowUpAssessment: React.FC<BurnFollowUpAssessmentProps> = ({
  burnPatientId,
  patientName,
  injuryDate,
  initialTBSA,
  initialRegions,
  previousAssessments,
  currentUser,
  onSaveAssessment,
  onClose
}) => {
  // State
  const [activeStep, setActiveStep] = useState(0);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Assessment data
  const [woundStatuses, setWoundStatuses] = useState<WoundRegionStatus[]>([]);
  const [infectionSigns, setInfectionSigns] = useState({
    increasedPain: false,
    erythema: false,
    purulentDischarge: false,
    malodor: false,
    fever: false,
    elevatedWBC: false,
    positiveWoundCulture: false
  });
  const [graftStatus, setGraftStatus] = useState<GraftStatus>('not_applicable');
  const [graftTakePercentage, setGraftTakePercentage] = useState<number>(0);
  const [functionalStatus, setFunctionalStatus] = useState({
    rangeOfMotion: 'full' as 'full' | 'mild_limitation' | 'moderate_limitation' | 'severe_limitation',
    painLevel: 3,
    abilityToPerformADL: 'independent' as 'independent' | 'needs_assistance' | 'dependent'
  });
  const [vancouverScore, setVancouverScore] = useState<VancouverScarScale | null>(null);
  const [notes, setNotes] = useState('');
  
  // Images
  const [capturedImages, setCapturedImages] = useState<FollowUpImage[]>([]);
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [isCameraLoading, setIsCameraLoading] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // AI Analysis
  const [aiAnalysis, setAiAnalysis] = useState<FollowUpAIAnalysis | null>(null);
  const [progressReport, setProgressReport] = useState<HealingProgressReport | null>(null);
  
  // Calculate days since injury
  const daysSinceInjury = Math.floor((new Date().getTime() - new Date(injuryDate).getTime()) / (1000 * 60 * 60 * 24));
  
  // Initialize wound statuses from initial regions
  useEffect(() => {
    const lastAssessment = previousAssessments[previousAssessments.length - 1];
    
    if (lastAssessment) {
      // Start from last assessment
      setWoundStatuses(lastAssessment.woundStatus.map(ws => ({
        ...ws,
        healingStatus: 'static' as WoundHealingStatus
      })));
    } else {
      // Initialize from initial burn regions
      setWoundStatuses(initialRegions.map(r => ({
        region: r.region,
        previousPercentBurned: r.percentBurned,
        currentPercentOpen: r.percentBurned,
        healingStatus: 'static' as WoundHealingStatus,
        currentDepth: r.depth,
        granulationQuality: 'moderate' as 'good' | 'moderate' | 'poor' | 'not_applicable',
        epithelialization: 'none' as 'complete' | 'progressing' | 'minimal' | 'none',
        requiresGrafting: r.depth === 'full_thickness',
        infectionPresent: false
      })));
    }
  }, [initialRegions, previousAssessments]);

  // Steps configuration
  const steps = [
    { title: 'Wound Status', icon: <Activity className="h-5 w-5" /> },
    { title: 'Images', icon: <Camera className="h-5 w-5" /> },
    { title: 'Infection Check', icon: <Thermometer className="h-5 w-5" /> },
    { title: 'Graft/Scar', icon: <Scissors className="h-5 w-5" /> },
    { title: 'AI Analysis', icon: <Brain className="h-5 w-5" /> },
    { title: 'Summary', icon: <FileText className="h-5 w-5" /> },
  ];

  // Camera functions
  const startCamera = useCallback(async () => {
    try {
      setError(null);
      setIsCameraLoading(true);
      
      if (!navigator.mediaDevices?.getUserMedia) {
        setError('Camera not supported. Please use file upload.');
        setIsCameraLoading(false);
        return;
      }
      
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } }
      });
      
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.onloadedmetadata = () => {
          videoRef.current?.play();
          setIsCameraLoading(false);
        };
        setIsCameraActive(true);
      }
    } catch (err: any) {
      setIsCameraLoading(false);
      if (err.name === 'NotAllowedError') {
        setError('Camera permission denied.');
      } else {
        setError('Unable to access camera. Please use file upload.');
      }
    }
  }, []);

  const stopCamera = useCallback(() => {
    if (videoRef.current?.srcObject) {
      const tracks = (videoRef.current.srcObject as MediaStream).getTracks();
      tracks.forEach(track => track.stop());
      videoRef.current.srcObject = null;
      setIsCameraActive(false);
    }
  }, []);

  const captureImage = useCallback(() => {
    if (!videoRef.current || !canvasRef.current) return;
    
    const canvas = canvasRef.current;
    const video = videoRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    ctx.drawImage(video, 0, 0);
    
    const imageUrl = canvas.toDataURL('image/jpeg', 0.9);
    const newImage: FollowUpImage = {
      id: `img_${Date.now()}`,
      imageUrl,
      capturedAt: new Date(),
      aiProcessed: false
    };
    
    setCapturedImages(prev => [...prev, newImage]);
    stopCamera();
  }, [stopCamera]);

  const handleFileUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = (event) => {
      const newImage: FollowUpImage = {
        id: `img_${Date.now()}`,
        imageUrl: event.target?.result as string,
        capturedAt: new Date(),
        aiProcessed: false
      };
      setCapturedImages(prev => [...prev, newImage]);
    };
    reader.readAsDataURL(file);
  }, []);

  const removeImage = (imageId: string) => {
    setCapturedImages(prev => prev.filter(img => img.id !== imageId));
  };

  // Update wound status
  const updateWoundStatus = (region: AnatomicalRegion, updates: Partial<WoundRegionStatus>) => {
    setWoundStatuses(prev => prev.map(ws => 
      ws.region === region ? { ...ws, ...updates } : ws
    ));
  };

  // Calculate Vancouver Scar Score
  const calculateVancouverScore = () => {
    // This would be filled in by user input - using defaults for demo
    const score = burnExpertAIService.calculateVancouverScarScore(1, 1, 2, 1);
    setVancouverScore(score);
  };

  // Run AI Analysis
  const runAIAnalysis = async () => {
    setIsProcessing(true);
    setError(null);
    
    try {
      // Analyze images if available
      const analysis = await burnExpertAIService.analyzeFollowUpImages(capturedImages);
      setAiAnalysis(analysis);
      
      // Generate progress report
      const report = burnExpertAIService.generateHealingProgressReport(
        burnPatientId,
        previousAssessments,
        initialTBSA
      );
      setProgressReport(report);
    } catch (err) {
      setError('Failed to complete AI analysis. Please try again.');
    } finally {
      setIsProcessing(false);
    }
  };

  // Save assessment
  const saveAssessment = async () => {
    setIsProcessing(true);
    
    try {
      const assessment = await burnExpertAIService.createFollowUpAssessment(
        burnPatientId,
        previousAssessments,
        woundStatuses,
        currentUser,
        new Date(injuryDate)
      );
      
      // Enhance with additional data
      assessment.infectionSigns = infectionSigns;
      assessment.graftStatus = graftStatus;
      assessment.graftTakePercentage = graftTakePercentage;
      assessment.functionalStatus = functionalStatus;
      assessment.vancouverScarScore = vancouverScore || undefined;
      assessment.images = capturedImages;
      assessment.aiAnalysis = aiAnalysis || undefined;
      
      onSaveAssessment(assessment);
    } catch (err) {
      setError('Failed to save assessment. Please try again.');
    } finally {
      setIsProcessing(false);
    }
  };

  // Render step content
  const renderStepContent = () => {
    switch (activeStep) {
      case 0: // Wound Status
        return (
          <div className="space-y-4">
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
              <div className="flex items-center gap-2 text-blue-800">
                <Activity className="h-5 w-5" />
                <span className="font-medium">Day {daysSinceInjury} Post-Injury</span>
              </div>
              <p className="text-sm text-blue-600 mt-1">
                Initial TBSA: {initialTBSA}% | Previous Assessments: {previousAssessments.length}
              </p>
            </div>
            
            <h3 className="font-semibold text-gray-900">Update Wound Status by Region</h3>
            
            <div className="space-y-3 max-h-[400px] overflow-y-auto">
              {woundStatuses.map((ws) => (
                <div key={ws.region} className="border rounded-lg p-3 bg-white">
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-medium text-gray-800">{REGION_NAMES[ws.region]}</span>
                    <span className={`px-2 py-0.5 rounded text-xs ${HEALING_STATUS_STYLES[ws.healingStatus].bg} ${HEALING_STATUS_STYLES[ws.healingStatus].text}`}>
                      {ws.healingStatus}
                    </span>
                  </div>
                  
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                    <div>
                      <label className="text-gray-600 text-xs">Current Open (%)</label>
                      <input
                        type="number"
                        min="0"
                        max={ws.previousPercentBurned}
                        value={ws.currentPercentOpen}
                        onChange={(e) => updateWoundStatus(ws.region, { 
                          currentPercentOpen: parseFloat(e.target.value) || 0,
                          healingStatus: parseFloat(e.target.value) < ws.previousPercentBurned ? 'improving' : 
                                        parseFloat(e.target.value) > ws.previousPercentBurned ? 'deteriorating' : 'static'
                        })}
                        className="w-full border rounded px-2 py-1 mt-1"
                      />
                    </div>
                    <div>
                      <label className="text-gray-600 text-xs">Status</label>
                      <select
                        value={ws.healingStatus}
                        onChange={(e) => updateWoundStatus(ws.region, { healingStatus: e.target.value as WoundHealingStatus })}
                        className="w-full border rounded px-2 py-1 mt-1"
                      >
                        <option value="improving">Improving</option>
                        <option value="static">Static</option>
                        <option value="deteriorating">Deteriorating</option>
                        <option value="healed">Healed</option>
                        <option value="grafted">Grafted</option>
                      </select>
                    </div>
                    <div>
                      <label className="text-gray-600 text-xs">Granulation</label>
                      <select
                        value={ws.granulationQuality}
                        onChange={(e) => updateWoundStatus(ws.region, { granulationQuality: e.target.value as any })}
                        className="w-full border rounded px-2 py-1 mt-1"
                      >
                        <option value="good">Good</option>
                        <option value="moderate">Moderate</option>
                        <option value="poor">Poor</option>
                        <option value="not_applicable">N/A</option>
                      </select>
                    </div>
                    <div>
                      <label className="text-gray-600 text-xs">Epithelialization</label>
                      <select
                        value={ws.epithelialization}
                        onChange={(e) => updateWoundStatus(ws.region, { epithelialization: e.target.value as any })}
                        className="w-full border rounded px-2 py-1 mt-1"
                      >
                        <option value="complete">Complete</option>
                        <option value="progressing">Progressing</option>
                        <option value="minimal">Minimal</option>
                        <option value="none">None</option>
                      </select>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-4 mt-2">
                    <label className="flex items-center gap-1 text-sm">
                      <input
                        type="checkbox"
                        checked={ws.requiresGrafting}
                        onChange={(e) => updateWoundStatus(ws.region, { requiresGrafting: e.target.checked })}
                        className="rounded"
                      />
                      <span>Needs Grafting</span>
                    </label>
                    <label className="flex items-center gap-1 text-sm">
                      <input
                        type="checkbox"
                        checked={ws.infectionPresent}
                        onChange={(e) => updateWoundStatus(ws.region, { infectionPresent: e.target.checked })}
                        className="rounded text-red-600"
                      />
                      <span className="text-red-600">Infection</span>
                    </label>
                  </div>
                </div>
              ))}
            </div>
          </div>
        );

      case 1: // Images
        return (
          <div className="space-y-4">
            <h3 className="font-semibold text-gray-900">Capture Wound Images</h3>
            
            {/* Hidden video element */}
            <video ref={videoRef} autoPlay playsInline muted style={{ display: 'none' }} />
            <canvas ref={canvasRef} style={{ display: 'none' }} />
            
            {error && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-3 flex items-center gap-2 text-red-700">
                <AlertCircle className="h-5 w-5" />
                <span>{error}</span>
                <button onClick={() => setError(null)} className="ml-auto">
                  <X className="h-4 w-4" />
                </button>
              </div>
            )}
            
            {/* Camera controls */}
            {!isCameraActive ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <button
                  onClick={startCamera}
                  disabled={isCameraLoading}
                  className="flex flex-col items-center justify-center p-6 border-2 border-dashed border-green-300 rounded-lg hover:bg-green-50 transition-colors"
                >
                  {isCameraLoading ? (
                    <RefreshCw className="h-8 w-8 text-green-500 animate-spin" />
                  ) : (
                    <Camera className="h-8 w-8 text-green-500" />
                  )}
                  <span className="text-sm font-medium text-green-700 mt-2">Use Camera</span>
                </button>
                
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="flex flex-col items-center justify-center p-6 border-2 border-dashed border-green-300 rounded-lg hover:bg-green-50 transition-colors"
                >
                  <Upload className="h-8 w-8 text-green-500" />
                  <span className="text-sm font-medium text-green-700 mt-2">Upload Image</span>
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleFileUpload}
                  className="hidden"
                />
              </div>
            ) : (
              <div className="relative rounded-lg overflow-hidden bg-black">
                <CameraPreview videoRef={videoRef} />
                <div className="absolute bottom-4 left-0 right-0 flex justify-center gap-4">
                  <button
                    onClick={captureImage}
                    className="p-4 bg-white rounded-full shadow-lg hover:bg-gray-100 border-4 border-green-500"
                  >
                    <Camera className="h-6 w-6 text-green-600" />
                  </button>
                  <button onClick={stopCamera} className="p-4 bg-white rounded-full shadow-lg hover:bg-gray-100">
                    <X className="h-6 w-6 text-red-600" />
                  </button>
                </div>
                <div className="absolute top-4 left-4 px-3 py-1 bg-red-500 text-white text-xs font-medium rounded-full flex items-center gap-1">
                  <span className="w-2 h-2 bg-white rounded-full animate-pulse" />
                  LIVE
                </div>
              </div>
            )}
            
            {/* Captured images grid */}
            {capturedImages.length > 0 && (
              <div className="mt-4">
                <h4 className="text-sm font-medium text-gray-700 mb-2">Captured Images ({capturedImages.length})</h4>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {capturedImages.map((img) => (
                    <div key={img.id} className="relative rounded-lg overflow-hidden">
                      <img src={img.imageUrl} alt="Wound" className="w-full h-24 object-cover" />
                      <button
                        onClick={() => removeImage(img.id)}
                        className="absolute top-1 right-1 p-1 bg-red-500 text-white rounded-full hover:bg-red-600"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        );

      case 2: // Infection Check
        return (
          <div className="space-y-4">
            <h3 className="font-semibold text-gray-900">Infection Assessment</h3>
            
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
              <h4 className="font-medium text-yellow-800 mb-3">Check all signs present:</h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {[
                  { key: 'increasedPain', label: 'Increased Pain' },
                  { key: 'erythema', label: 'Spreading Erythema' },
                  { key: 'purulentDischarge', label: 'Purulent Discharge' },
                  { key: 'malodor', label: 'Malodor' },
                  { key: 'fever', label: 'Fever (>38.3°C)' },
                  { key: 'elevatedWBC', label: 'Elevated WBC' },
                  { key: 'positiveWoundCulture', label: 'Positive Culture' },
                ].map(({ key, label }) => (
                  <label key={key} className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={infectionSigns[key as keyof typeof infectionSigns]}
                      onChange={(e) => setInfectionSigns(prev => ({ ...prev, [key]: e.target.checked }))}
                      className="rounded"
                    />
                    <span>{label}</span>
                  </label>
                ))}
              </div>
            </div>
            
            {/* Infection status indicator */}
            {Object.values(infectionSigns).filter(Boolean).length >= 3 && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-center gap-3">
                <AlertTriangle className="h-6 w-6 text-red-500" />
                <div>
                  <p className="font-medium text-red-800">High Risk of Wound Infection</p>
                  <p className="text-sm text-red-600">Multiple infection signs detected. Consider wound culture and antimicrobial therapy.</p>
                </div>
              </div>
            )}
          </div>
        );

      case 3: // Graft/Scar Assessment
        return (
          <div className="space-y-6">
            {/* Graft Status */}
            <div>
              <h3 className="font-semibold text-gray-900 mb-3">Graft Assessment</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-sm text-gray-600">Graft Status</label>
                  <select
                    value={graftStatus}
                    onChange={(e) => setGraftStatus(e.target.value as GraftStatus)}
                    className="w-full border rounded-lg px-3 py-2 mt-1"
                  >
                    <option value="not_applicable">Not Applicable</option>
                    <option value="pending">Pending/Planned</option>
                    <option value="taken">Successfully Taken</option>
                    <option value="partial_take">Partial Take</option>
                    <option value="failed">Failed</option>
                  </select>
                </div>
                {graftStatus !== 'not_applicable' && (
                  <div>
                    <label className="text-sm text-gray-600">Take Percentage</label>
                    <input
                      type="number"
                      min="0"
                      max="100"
                      value={graftTakePercentage}
                      onChange={(e) => setGraftTakePercentage(parseInt(e.target.value) || 0)}
                      className="w-full border rounded-lg px-3 py-2 mt-1"
                    />
                  </div>
                )}
              </div>
            </div>
            
            {/* Vancouver Scar Scale */}
            {daysSinceInjury > 14 && (
              <div>
                <h3 className="font-semibold text-gray-900 mb-3">Vancouver Scar Scale</h3>
                <button
                  onClick={calculateVancouverScore}
                  className="flex items-center gap-2 px-4 py-2 bg-purple-100 text-purple-700 rounded-lg hover:bg-purple-200"
                >
                  <BarChart3 className="h-4 w-4" />
                  Calculate Scar Score
                </button>
                
                {vancouverScore && (
                  <div className="mt-3 p-4 bg-purple-50 border border-purple-200 rounded-lg">
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-medium">Total Score</span>
                      <span className="text-lg sm:text-2xl font-bold text-purple-700">{vancouverScore.totalScore}/13</span>
                    </div>
                    <p className="text-sm text-purple-600">{vancouverScore.interpretation}</p>
                  </div>
                )}
              </div>
            )}
            
            {/* Functional Status */}
            <div>
              <h3 className="font-semibold text-gray-900 mb-3">Functional Status</h3>
              <div className="space-y-3">
                <div>
                  <label className="text-sm text-gray-600">Range of Motion</label>
                  <select
                    value={functionalStatus.rangeOfMotion}
                    onChange={(e) => setFunctionalStatus(prev => ({ ...prev, rangeOfMotion: e.target.value as any }))}
                    className="w-full border rounded-lg px-3 py-2 mt-1"
                  >
                    <option value="full">Full ROM</option>
                    <option value="mild_limitation">Mild Limitation</option>
                    <option value="moderate_limitation">Moderate Limitation</option>
                    <option value="severe_limitation">Severe Limitation</option>
                  </select>
                </div>
                <div>
                  <label className="text-sm text-gray-600">Pain Level (0-10): {functionalStatus.painLevel}</label>
                  <input
                    type="range"
                    min="0"
                    max="10"
                    value={functionalStatus.painLevel}
                    onChange={(e) => setFunctionalStatus(prev => ({ ...prev, painLevel: parseInt(e.target.value) }))}
                    className="w-full mt-1"
                  />
                </div>
              </div>
            </div>
          </div>
        );

      case 4: // AI Analysis
        return (
          <div className="space-y-4">
            <h3 className="font-semibold text-gray-900">AI Wound Healing Analysis</h3>
            
            {!aiAnalysis && !isProcessing && (
              <div className="text-center py-8">
                <Brain className="h-16 w-16 text-purple-300 mx-auto mb-4" />
                <p className="text-gray-600 mb-4">Run AI analysis to get healing trajectory prediction and recommendations</p>
                <button
                  onClick={runAIAnalysis}
                  className="px-6 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 flex items-center gap-2 mx-auto"
                >
                  <Brain className="h-5 w-5" />
                  Run AI Analysis
                </button>
              </div>
            )}
            
            {isProcessing && (
              <div className="text-center py-8">
                <RefreshCw className="h-12 w-12 text-purple-500 animate-spin mx-auto mb-4" />
                <p className="text-gray-600">Analyzing wound images and healing data...</p>
              </div>
            )}
            
            {aiAnalysis && (
              <div className="space-y-4">
                {/* Healing Trajectory */}
                <div className={`p-4 rounded-lg ${
                  aiAnalysis.healingTrajectory === 'ahead_of_schedule' ? 'bg-green-50 border-green-200' :
                  aiAnalysis.healingTrajectory === 'on_track' ? 'bg-blue-50 border-blue-200' :
                  aiAnalysis.healingTrajectory === 'delayed' ? 'bg-yellow-50 border-yellow-200' :
                  'bg-red-50 border-red-200'
                } border`}>
                  <div className="flex items-center gap-3">
                    {aiAnalysis.healingTrajectory === 'ahead_of_schedule' && <TrendingUp className="h-6 w-6 text-green-600" />}
                    {aiAnalysis.healingTrajectory === 'on_track' && <CheckCircle className="h-6 w-6 text-blue-600" />}
                    {aiAnalysis.healingTrajectory === 'delayed' && <Clock className="h-6 w-6 text-yellow-600" />}
                    {aiAnalysis.healingTrajectory === 'stalled' && <AlertTriangle className="h-6 w-6 text-red-600" />}
                    <div>
                      <p className="font-medium capitalize">{aiAnalysis.healingTrajectory.replace('_', ' ')}</p>
                      <p className="text-sm opacity-75">AI Confidence: {Math.round(aiAnalysis.aiConfidence * 100)}%</p>
                    </div>
                  </div>
                </div>
                
                {/* Progress Metrics */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="bg-gray-50 rounded-lg p-3 text-center">
                    <p className="text-lg sm:text-2xl font-bold text-green-600">
                      {Math.round(aiAnalysis.comparisonToBaseline.tbsaReduction)}%
                    </p>
                    <p className="text-xs text-gray-600">TBSA Reduction</p>
                  </div>
                  <div className="bg-gray-50 rounded-lg p-3 text-center">
                    <p className="text-lg sm:text-2xl font-bold text-blue-600">
                      {Math.round(aiAnalysis.comparisonToBaseline.overallProgress)}%
                    </p>
                    <p className="text-xs text-gray-600">Overall Progress</p>
                  </div>
                  <div className="bg-gray-50 rounded-lg p-3 text-center">
                    <p className={`text-sm font-bold ${
                      aiAnalysis.infectionRisk === 'low' ? 'text-green-600' :
                      aiAnalysis.infectionRisk === 'moderate' ? 'text-yellow-600' : 'text-red-600'
                    }`}>
                      {aiAnalysis.infectionRisk.toUpperCase()}
                    </p>
                    <p className="text-xs text-gray-600">Infection Risk</p>
                  </div>
                </div>
                
                {/* Warnings */}
                {aiAnalysis.warnings.length > 0 && (
                  <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                    <h4 className="font-medium text-red-800 flex items-center gap-2">
                      <AlertTriangle className="h-4 w-4" />
                      Warnings
                    </h4>
                    <ul className="mt-2 space-y-1 text-sm text-red-700">
                      {aiAnalysis.warnings.map((w, i) => (
                        <li key={i}>{w}</li>
                      ))}
                    </ul>
                  </div>
                )}
                
                {/* Recommendations */}
                <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                  <h4 className="font-medium text-green-800 flex items-center gap-2">
                    <CheckCircle className="h-4 w-4" />
                    AI Recommendations
                  </h4>
                  <ul className="mt-2 space-y-1 text-sm text-green-700">
                    {aiAnalysis.recommendations.map((r, i) => (
                      <li key={i} className="flex items-start gap-2">
                        <ArrowRight className="h-3 w-3 mt-1 flex-shrink-0" />
                        {r}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            )}
          </div>
        );

      case 5: // Summary
        return (
          <div className="space-y-4">
            <h3 className="font-semibold text-gray-900">Assessment Summary</h3>
            
            {/* Quick Stats */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="bg-blue-50 rounded-lg p-3">
                <p className="text-sm text-blue-600">Day Post-Injury</p>
                <p className="text-lg sm:text-2xl font-bold text-blue-800">{daysSinceInjury}</p>
              </div>
              <div className="bg-green-50 rounded-lg p-3">
                <p className="text-sm text-green-600">Images Captured</p>
                <p className="text-lg sm:text-2xl font-bold text-green-800">{capturedImages.length}</p>
              </div>
            </div>
            
            {/* Wound Summary */}
            <div className="bg-gray-50 rounded-lg p-4">
              <h4 className="font-medium mb-3">Wound Status Summary</h4>
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Regions Improving</span>
                  <span className="font-medium text-green-600">
                    {woundStatuses.filter(w => w.healingStatus === 'improving').length}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Regions Static</span>
                  <span className="font-medium text-yellow-600">
                    {woundStatuses.filter(w => w.healingStatus === 'static').length}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Regions Healed</span>
                  <span className="font-medium text-blue-600">
                    {woundStatuses.filter(w => w.healingStatus === 'healed').length}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Infection Suspected</span>
                  <span className={`font-medium ${
                    woundStatuses.some(w => w.infectionPresent) ? 'text-red-600' : 'text-green-600'
                  }`}>
                    {woundStatuses.some(w => w.infectionPresent) ? 'Yes' : 'No'}
                  </span>
                </div>
              </div>
            </div>
            
            {/* Notes */}
            <div>
              <label className="text-sm font-medium text-gray-700">Additional Notes</label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
                className="w-full border rounded-lg px-3 py-2 mt-1"
                placeholder="Enter any additional observations..."
              />
            </div>
            
            {/* Save Button */}
            <button
              onClick={saveAssessment}
              disabled={isProcessing}
              className="w-full py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {isProcessing ? (
                <RefreshCw className="h-5 w-5 animate-spin" />
              ) : (
                <Save className="h-5 w-5" />
              )}
              Save Follow-Up Assessment
            </button>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="bg-white rounded-xl shadow-lg overflow-hidden max-w-2xl mx-auto">
      {/* Header */}
      <div className="bg-gradient-to-r from-green-600 to-emerald-600 px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Activity className="h-6 w-6 text-white" />
            <div>
              <h2 className="text-xl font-bold text-white">Burn Follow-Up Assessment</h2>
              <p className="text-green-100 text-sm">{patientName}</p>
            </div>
          </div>
          {onClose && (
            <button onClick={onClose} className="text-white hover:text-green-100">
              <X className="h-6 w-6" />
            </button>
          )}
        </div>
      </div>
      
      {/* Progress Steps */}
      <div className="px-4 py-3 bg-gray-50 border-b overflow-x-auto">
        <div className="flex gap-2 min-w-max">
          {steps.map((step, index) => (
            <button
              key={index}
              onClick={() => setActiveStep(index)}
              className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                activeStep === index
                  ? 'bg-green-600 text-white'
                  : index < activeStep
                  ? 'bg-green-100 text-green-700'
                  : 'bg-white text-gray-500 hover:bg-gray-100'
              }`}
            >
              {step.icon}
              <span className="hidden sm:inline">{step.title}</span>
            </button>
          ))}
        </div>
      </div>
      
      {/* Content */}
      <div className="p-6 max-h-[60vh] overflow-y-auto">
        {renderStepContent()}
      </div>
      
      {/* Navigation */}
      <div className="px-6 py-4 bg-gray-50 border-t flex justify-between">
        <button
          onClick={() => setActiveStep(Math.max(0, activeStep - 1))}
          disabled={activeStep === 0}
          className="px-4 py-2 text-gray-600 hover:text-gray-800 disabled:opacity-50"
        >
          ← Previous
        </button>
        <button
          onClick={() => setActiveStep(Math.min(steps.length - 1, activeStep + 1))}
          disabled={activeStep === steps.length - 1}
          className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
        >
          Next →
        </button>
      </div>
    </div>
  );
};

// Camera Preview component
const CameraPreview: React.FC<{ videoRef: React.RefObject<HTMLVideoElement> }> = ({ videoRef }) => {
  const previewCanvasRef = useRef<HTMLCanvasElement>(null);
  const animationFrameRef = useRef<number>();

  useEffect(() => {
    const drawFrame = () => {
      if (videoRef.current && previewCanvasRef.current) {
        const video = videoRef.current;
        const canvas = previewCanvasRef.current;
        const ctx = canvas.getContext('2d');
        
        if (ctx && video.readyState >= 2) {
          if (canvas.width !== video.videoWidth || canvas.height !== video.videoHeight) {
            canvas.width = video.videoWidth || 640;
            canvas.height = video.videoHeight || 480;
          }
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        }
      }
      animationFrameRef.current = requestAnimationFrame(drawFrame);
    };

    drawFrame();
    return () => {
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
    };
  }, [videoRef]);

  return <canvas ref={previewCanvasRef} className="w-full min-h-[300px] rounded-lg bg-black object-contain" />;
};

export default BurnFollowUpAssessment;

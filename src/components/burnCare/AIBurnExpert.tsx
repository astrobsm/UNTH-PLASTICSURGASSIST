/**
 * AI Burn Expert Component
 * 
 * Provides AI-powered burn assessment features:
 * - Image capture and analysis
 * - Automatic TBSA estimation
 * - Burn depth detection
 * - Clinical recommendations
 */

import React, { useState, useRef, useCallback, useEffect } from 'react';
import {
  Camera,
  Upload,
  Sparkles,
  RefreshCw,
  CheckCircle,
  AlertTriangle,
  X,
  Image as ImageIcon,
  Zap,
  ChevronDown,
  ChevronUp,
  Info,
  Target,
  Activity,
  ThermometerSun,
  Download,
  Brain
} from 'lucide-react';
import { 
  burnExpertAIService, 
  BurnExpertAnalysis, 
  AIImageAnalysisResult,
  BodyRegionAssessment,
  SeverityLevel
} from '../../services/burnExpertAIService';
import { TBSARegion, AnatomicalRegion, BurnDepth } from '../../services/burnCareService';

interface AIBurnExpertProps {
  patientAge: number;
  patientWeight: number;
  mechanism: string;
  hasInhalationInjury: boolean;
  currentRegions: TBSARegion[];
  onApplyAIResults: (regions: TBSARegion[]) => void;
}

const SEVERITY_STYLES: Record<SeverityLevel, { bg: string; text: string; border: string; icon: React.ReactNode }> = {
  minor: {
    bg: 'bg-green-50',
    text: 'text-green-700',
    border: 'border-green-200',
    icon: <CheckCircle className="h-5 w-5 text-green-500" />
  },
  moderate: {
    bg: 'bg-yellow-50',
    text: 'text-yellow-700',
    border: 'border-yellow-200',
    icon: <AlertTriangle className="h-5 w-5 text-yellow-500" />
  },
  major: {
    bg: 'bg-orange-50',
    text: 'text-orange-700',
    border: 'border-orange-200',
    icon: <AlertTriangle className="h-5 w-5 text-orange-500" />
  },
  critical: {
    bg: 'bg-red-50',
    text: 'text-red-700',
    border: 'border-red-200',
    icon: <Zap className="h-5 w-5 text-red-500" />
  }
};

const DEPTH_COLORS: Record<BurnDepth, { bg: string; text: string; label: string }> = {
  superficial: { bg: 'bg-pink-200', text: 'text-pink-700', label: '1° Superficial' },
  superficial_partial: { bg: 'bg-red-400', text: 'text-white', label: '2° Superficial Partial' },
  deep_partial: { bg: 'bg-yellow-400', text: 'text-yellow-900', label: '2° Deep Partial' },
  full_thickness: { bg: 'bg-amber-800', text: 'text-white', label: '3° Full Thickness' }
};

// Camera Preview component that mirrors the hidden video element
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
          // Set canvas size to match video
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
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [videoRef]);

  return (
    <canvas
      ref={previewCanvasRef}
      className="w-full min-h-[300px] rounded-lg bg-black object-contain"
    />
  );
};

const AIBurnExpert: React.FC<AIBurnExpertProps> = ({
  patientAge,
  patientWeight,
  mechanism,
  hasInhalationInjury,
  currentRegions,
  onApplyAIResults
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [imageAnalysis, setImageAnalysis] = useState<AIImageAnalysisResult | null>(null);
  const [burnAnalysis, setBurnAnalysis] = useState<BurnExpertAnalysis | null>(null);
  const [showRecommendations, setShowRecommendations] = useState(true);
  const [showWarnings, setShowWarnings] = useState(true);
  const [activeTab, setActiveTab] = useState<'capture' | 'analysis' | 'recommendations'>('capture');
  const [error, setError] = useState<string | null>(null);
  const [isCameraLoading, setIsCameraLoading] = useState(false);
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isCameraActive, setIsCameraActive] = useState(false);

  // Start camera capture
  const startCamera = useCallback(async () => {
    try {
      setError(null);
      setIsCameraLoading(true);
      
      // Check if mediaDevices is available
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        setError('Camera not supported on this device or browser. Please use file upload.');
        setIsCameraLoading(false);
        return;
      }
      
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } }
      });
      
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        // Wait for metadata to load then play
        videoRef.current.onloadedmetadata = () => {
          videoRef.current?.play().catch(err => {
            console.error('Video play error:', err);
          });
          setIsCameraLoading(false);
        };
        setIsCameraActive(true);
      } else {
        // If video ref not available, stop the stream
        stream.getTracks().forEach(track => track.stop());
        setError('Camera initialization failed. Please try again.');
        setIsCameraLoading(false);
      }
    } catch (err: any) {
      console.error('Camera access error:', err);
      setIsCameraLoading(false);
      if (err.name === 'NotAllowedError') {
        setError('Camera permission denied. Please allow camera access and try again.');
      } else if (err.name === 'NotFoundError') {
        setError('No camera found. Please use file upload instead.');
      } else if (err.name === 'NotReadableError') {
        setError('Camera is in use by another application. Please close it and try again.');
      } else {
        setError('Unable to access camera. Please use file upload instead.');
      }
    }
  }, []);

  // Stop camera
  const stopCamera = useCallback(() => {
    if (videoRef.current?.srcObject) {
      const tracks = (videoRef.current.srcObject as MediaStream).getTracks();
      tracks.forEach(track => track.stop());
      videoRef.current.srcObject = null;
      setIsCameraActive(false);
    }
  }, []);

  // Capture image from camera
  const captureFromCamera = useCallback(() => {
    if (!videoRef.current || !canvasRef.current) return;
    
    const video = videoRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    
    if (!ctx) return;
    
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    ctx.drawImage(video, 0, 0);
    
    const imageDataUrl = canvas.toDataURL('image/jpeg', 0.9);
    setCapturedImage(imageDataUrl);
    stopCamera();
  }, [stopCamera]);

  // Handle file upload
  const handleFileUpload = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    
    if (!file.type.startsWith('image/')) {
      setError('Please upload an image file');
      return;
    }
    
    const reader = new FileReader();
    reader.onload = (e) => {
      setCapturedImage(e.target?.result as string);
      setError(null);
    };
    reader.readAsDataURL(file);
  }, []);

  // Analyze captured image
  const analyzeImage = useCallback(async () => {
    if (!capturedImage || !canvasRef.current) return;
    
    setIsProcessing(true);
    setError(null);
    
    try {
      // Draw image to canvas to get ImageData
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('Canvas context not available');
      
      const img = new Image();
      img.src = capturedImage;
      
      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve();
        img.onerror = () => reject(new Error('Failed to load image'));
      });
      
      canvas.width = img.width;
      canvas.height = img.height;
      ctx.drawImage(img, 0, 0);
      
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      
      // Get age group for analysis
      const ageGroup = patientAge < 1 ? '0-1' : 
                       patientAge < 5 ? '1-4' :
                       patientAge < 10 ? '5-9' :
                       patientAge < 15 ? '10-14' : '15+';
      
      // Analyze image
      const analysis = await burnExpertAIService.analyzeImageForBurns(imageData, ageGroup);
      setImageAnalysis(analysis);
      setActiveTab('analysis');
      
    } catch (err) {
      console.error('Image analysis error:', err);
      setError('Failed to analyze image. Please try again.');
    } finally {
      setIsProcessing(false);
    }
  }, [capturedImage, patientAge]);

  // Generate comprehensive burn analysis
  const generateAnalysis = useCallback(async () => {
    if (currentRegions.length === 0 && !imageAnalysis) {
      setError('Please mark burn regions or capture an image first');
      return;
    }
    
    setIsProcessing(true);
    setError(null);
    
    try {
      // Use image analysis results if available, otherwise use current manual regions
      let regionsToAnalyze = currentRegions;
      
      if (imageAnalysis && imageAnalysis.regionEstimates.length > 0) {
        // Convert AI estimates to TBSARegions
        regionsToAnalyze = imageAnalysis.regionEstimates
          .filter(r => r.percentBurned > 0)
          .map(r => ({
            region: r.regionId,
            percentBurned: r.percentBurned,
            depth: r.estimatedDepth,
            isCircumferential: r.percentBurned >= 90
          }));
      }
      
      const analysis = await burnExpertAIService.generateBurnAnalysis(
        regionsToAnalyze,
        patientAge,
        patientWeight,
        mechanism,
        hasInhalationInjury
      );
      
      setBurnAnalysis(analysis);
      setActiveTab('recommendations');
      
    } catch (err) {
      console.error('Analysis generation error:', err);
      setError('Failed to generate analysis. Please try again.');
    } finally {
      setIsProcessing(false);
    }
  }, [currentRegions, imageAnalysis, patientAge, patientWeight, mechanism, hasInhalationInjury]);

  // Apply AI results to the form
  const applyAIResults = useCallback(() => {
    if (!imageAnalysis?.regionEstimates) return;
    
    const newRegions: TBSARegion[] = imageAnalysis.regionEstimates
      .filter(r => r.percentBurned > 0)
      .map(r => ({
        region: r.regionId,
        percentBurned: r.percentBurned,
        depth: r.estimatedDepth,
        isCircumferential: r.percentBurned >= 90
      }));
    
    onApplyAIResults(newRegions);
    setIsExpanded(false);
  }, [imageAnalysis, onApplyAIResults]);

  // Clear everything
  const resetAnalysis = useCallback(() => {
    setCapturedImage(null);
    setImageAnalysis(null);
    setBurnAnalysis(null);
    setError(null);
    setActiveTab('capture');
    stopCamera();
  }, [stopCamera]);

  return (
    <div className="border border-purple-200 rounded-lg bg-gradient-to-r from-purple-50 to-indigo-50 overflow-hidden">
      {/* Header */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between p-4 hover:bg-purple-100/50 transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className="p-2 bg-purple-600 rounded-lg">
            <Brain className="h-5 w-5 text-white" />
          </div>
          <div className="text-left">
            <h3 className="font-semibold text-purple-900">AI Burn Expert</h3>
            <p className="text-xs text-purple-600">
              AI-powered burn assessment with image analysis
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs px-2 py-1 bg-purple-100 text-purple-700 rounded-full font-medium">
            Beta
          </span>
          {isExpanded ? (
            <ChevronUp className="h-5 w-5 text-purple-600" />
          ) : (
            <ChevronDown className="h-5 w-5 text-purple-600" />
          )}
        </div>
      </button>

      {/* Expanded Content */}
      {isExpanded && (
        <div className="border-t border-purple-200 p-4 space-y-4">
          {/* Tabs */}
          <div className="flex gap-2 border-b border-purple-200 pb-2">
            {[
              { id: 'capture', label: 'Capture', icon: Camera },
              { id: 'analysis', label: 'Analysis', icon: Target },
              { id: 'recommendations', label: 'Recommendations', icon: Activity }
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as typeof activeTab)}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  activeTab === tab.id
                    ? 'bg-purple-600 text-white'
                    : 'bg-purple-100 text-purple-700 hover:bg-purple-200'
                }`}
              >
                <tab.icon className="h-4 w-4" />
                {tab.label}
              </button>
            ))}
          </div>

          {/* Error Display */}
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm flex items-center gap-2">
              <AlertTriangle className="h-4 w-4" />
              {error}
              <button onClick={() => setError(null)} className="ml-auto">
                <X className="h-4 w-4" />
              </button>
            </div>
          )}

          {/* Hidden video element - always rendered to ensure ref is available */}
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            style={{ display: 'none' }}
          />

          {/* Tab Content */}
          {activeTab === 'capture' && (
            <div className="space-y-4">
              {/* Camera / Upload Area */}
              {!capturedImage ? (
                <div className="space-y-4">
                  {/* Camera Loading State */}
                  {isCameraLoading && (
                    <div className="flex flex-col items-center justify-center p-12 bg-gray-900 rounded-lg">
                      <RefreshCw className="h-10 w-10 text-purple-400 animate-spin mb-3" />
                      <p className="text-sm text-gray-200">Initializing camera...</p>
                      <p className="text-xs text-gray-400">Please allow camera access when prompted</p>
                    </div>
                  )}
                  
                  {/* Active Camera View */}
                  {isCameraActive && !isCameraLoading ? (
                    <div className="relative rounded-lg overflow-hidden bg-black">
                      {/* Live video display using canvas mirror */}
                      <CameraPreview videoRef={videoRef} />
                      <div className="absolute bottom-4 left-0 right-0 flex justify-center gap-4 z-10">
                        <button
                          onClick={captureFromCamera}
                          className="p-4 bg-white rounded-full shadow-lg hover:bg-gray-100 border-4 border-purple-500"
                          title="Capture Photo"
                        >
                          <Camera className="h-6 w-6 text-purple-600" />
                        </button>
                        <button
                          onClick={stopCamera}
                          className="p-4 bg-white rounded-full shadow-lg hover:bg-gray-100"
                          title="Cancel"
                        >
                          <X className="h-6 w-6 text-red-600" />
                        </button>
                      </div>
                      <div className="absolute top-4 left-4 px-3 py-1 bg-red-500 text-white text-xs font-medium rounded-full flex items-center gap-1 z-10">
                        <span className="w-2 h-2 bg-white rounded-full animate-pulse" />
                        LIVE
                      </div>
                    </div>
                  ) : !isCameraLoading && (
                    <div className="grid grid-cols-2 gap-4">
                      <button
                        onClick={startCamera}
                        disabled={isCameraLoading}
                        className="flex flex-col items-center justify-center p-8 border-2 border-dashed border-purple-300 rounded-lg hover:bg-purple-100 transition-colors disabled:opacity-50"
                      >
                        <Camera className="h-10 w-10 text-purple-500 mb-2" />
                        <span className="text-sm font-medium text-purple-700">Use Camera</span>
                        <span className="text-xs text-purple-500">Capture burn wounds</span>
                      </button>
                      
                      <button
                        onClick={() => fileInputRef.current?.click()}
                        className="flex flex-col items-center justify-center p-8 border-2 border-dashed border-purple-300 rounded-lg hover:bg-purple-100 transition-colors"
                      >
                        <Upload className="h-10 w-10 text-purple-500 mb-2" />
                        <span className="text-sm font-medium text-purple-700">Upload Image</span>
                        <span className="text-xs text-purple-500">JPG, PNG supported</span>
                      </button>
                      
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/*"
                        onChange={handleFileUpload}
                        className="hidden"
                      />
                    </div>
                  )}
                </div>
              ) : (
                <div className="space-y-4">
                  {/* Captured Image Preview */}
                  <div className="relative">
                    <img
                      src={capturedImage}
                      alt="Captured burn"
                      className="w-full max-h-64 object-contain rounded-lg bg-gray-100"
                    />
                    <button
                      onClick={resetAnalysis}
                      className="absolute top-2 right-2 p-2 bg-red-500 rounded-full text-white hover:bg-red-600"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                  
                  {/* Analyze Button */}
                  <button
                    onClick={analyzeImage}
                    disabled={isProcessing}
                    className="w-full flex items-center justify-center gap-2 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isProcessing ? (
                      <>
                        <RefreshCw className="h-5 w-5 animate-spin" />
                        Analyzing burn image...
                      </>
                    ) : (
                      <>
                        <Sparkles className="h-5 w-5" />
                        Analyze with AI
                      </>
                    )}
                  </button>
                </div>
              )}

              {/* Info Box */}
              <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg text-sm text-blue-700">
                <div className="flex items-start gap-2">
                  <Info className="h-4 w-4 mt-0.5" />
                  <div>
                    <p className="font-medium">How AI Analysis Works</p>
                    <ul className="mt-1 text-xs space-y-1 list-disc list-inside">
                      <li>Color analysis detects burn severity patterns</li>
                      <li>Estimates affected body regions</li>
                      <li>Provides confidence scores for each assessment</li>
                      <li>Always verify AI results clinically</li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'analysis' && (
            <div className="space-y-4">
              {imageAnalysis ? (
                <>
                  {/* Summary Stats */}
                  <div className="grid grid-cols-3 gap-4">
                    <div className="p-4 bg-white rounded-lg border border-purple-200 text-center">
                      <div className="text-2xl font-bold text-purple-700">
                        {imageAnalysis.estimatedTBSA.toFixed(1)}%
                      </div>
                      <div className="text-xs text-gray-600">Estimated TBSA</div>
                    </div>
                    <div className="p-4 bg-white rounded-lg border border-purple-200 text-center">
                      <div className="text-2xl font-bold text-purple-700">
                        {imageAnalysis.affectedRegions}
                      </div>
                      <div className="text-xs text-gray-600">Affected Regions</div>
                    </div>
                    <div className="p-4 bg-white rounded-lg border border-purple-200 text-center">
                      <div className={`text-lg font-bold ${DEPTH_COLORS[imageAnalysis.dominantDepth].text}`}>
                        {DEPTH_COLORS[imageAnalysis.dominantDepth].label}
                      </div>
                      <div className="text-xs text-gray-600">Dominant Depth</div>
                    </div>
                  </div>

                  {/* Region Estimates */}
                  <div className="bg-white rounded-lg border border-purple-200 overflow-hidden">
                    <div className="p-3 bg-purple-50 border-b border-purple-200 font-medium text-purple-900">
                      AI Region Estimates
                    </div>
                    <div className="max-h-64 overflow-y-auto">
                      {imageAnalysis.regionEstimates
                        .filter(r => r.percentBurned > 0)
                        .sort((a, b) => b.percentBurned - a.percentBurned)
                        .map((region, idx) => (
                          <div key={idx} className="p-3 border-b border-gray-100 flex items-center gap-3">
                            <span className={`w-3 h-3 rounded-full ${DEPTH_COLORS[region.estimatedDepth].bg}`}></span>
                            <div className="flex-1">
                              <div className="text-sm font-medium text-gray-900">
                                {burnExpertAIService.getRegionName(region.regionId)}
                              </div>
                              <div className="text-xs text-gray-500">
                                {DEPTH_COLORS[region.estimatedDepth].label}
                              </div>
                            </div>
                            <div className="text-right">
                              <div className="text-sm font-bold text-purple-700">
                                {region.percentBurned.toFixed(1)}%
                              </div>
                              <div className="text-xs text-gray-500">
                                {region.confidence.toFixed(0)}% confident
                              </div>
                            </div>
                          </div>
                        ))}
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div className="flex gap-3">
                    <button
                      onClick={applyAIResults}
                      className="flex-1 flex items-center justify-center gap-2 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700"
                    >
                      <CheckCircle className="h-5 w-5" />
                      Apply to TBSA Map
                    </button>
                    <button
                      onClick={generateAnalysis}
                      disabled={isProcessing}
                      className="flex-1 flex items-center justify-center gap-2 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50"
                    >
                      {isProcessing ? (
                        <RefreshCw className="h-5 w-5 animate-spin" />
                      ) : (
                        <Activity className="h-5 w-5" />
                      )}
                      Get Recommendations
                    </button>
                  </div>
                </>
              ) : (
                <div className="text-center py-8 text-gray-500">
                  <Target className="h-12 w-12 mx-auto mb-3 opacity-50" />
                  <p>No analysis available yet</p>
                  <p className="text-sm">Capture or upload an image first</p>
                </div>
              )}
            </div>
          )}

          {activeTab === 'recommendations' && (
            <div className="space-y-4">
              {burnAnalysis ? (
                <>
                  {/* Severity Banner */}
                  <div className={`p-4 rounded-lg border ${
                    SEVERITY_STYLES[burnAnalysis.severityLevel].bg
                  } ${SEVERITY_STYLES[burnAnalysis.severityLevel].border}`}>
                    <div className="flex items-center gap-3">
                      {SEVERITY_STYLES[burnAnalysis.severityLevel].icon}
                      <div>
                        <div className={`font-bold text-lg ${SEVERITY_STYLES[burnAnalysis.severityLevel].text}`}>
                          {burnAnalysis.severityLevel.charAt(0).toUpperCase() + burnAnalysis.severityLevel.slice(1)} Burn
                        </div>
                        <div className="text-sm text-gray-600">
                          {burnAnalysis.totalTBSA.toFixed(1)}% TBSA • {burnAnalysis.confidence.toFixed(0)}% confidence
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* TBSA Breakdown */}
                  <div className="grid grid-cols-3 gap-3">
                    <div className="p-3 bg-white rounded-lg border text-center">
                      <div className="text-xl font-bold text-orange-600">{burnAnalysis.totalTBSA.toFixed(1)}%</div>
                      <div className="text-xs text-gray-600">Total TBSA</div>
                    </div>
                    <div className="p-3 bg-white rounded-lg border text-center">
                      <div className="text-xl font-bold text-yellow-600">{burnAnalysis.partialThicknessTBSA.toFixed(1)}%</div>
                      <div className="text-xs text-gray-600">Partial Thickness</div>
                    </div>
                    <div className="p-3 bg-white rounded-lg border text-center">
                      <div className="text-xl font-bold text-red-600">{burnAnalysis.fullThicknessTBSA.toFixed(1)}%</div>
                      <div className="text-xs text-gray-600">Full Thickness</div>
                    </div>
                  </div>

                  {/* Warnings */}
                  {burnAnalysis.warnings.length > 0 && (
                    <div className="bg-red-50 border border-red-200 rounded-lg overflow-hidden">
                      <button
                        onClick={() => setShowWarnings(!showWarnings)}
                        className="w-full flex items-center justify-between p-3 text-red-800 font-medium hover:bg-red-100"
                      >
                        <span className="flex items-center gap-2">
                          <AlertTriangle className="h-4 w-4" />
                          Critical Warnings ({burnAnalysis.warnings.length})
                        </span>
                        {showWarnings ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                      </button>
                      {showWarnings && (
                        <div className="p-3 pt-0 space-y-2">
                          {burnAnalysis.warnings.map((warning, idx) => (
                            <div key={idx} className="text-sm text-red-700 flex items-start gap-2">
                              <span className="text-red-400">•</span>
                              {warning}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Recommendations */}
                  <div className="bg-white border border-purple-200 rounded-lg overflow-hidden">
                    <button
                      onClick={() => setShowRecommendations(!showRecommendations)}
                      className="w-full flex items-center justify-between p-3 text-purple-800 font-medium hover:bg-purple-50"
                    >
                      <span className="flex items-center gap-2">
                        <Activity className="h-4 w-4" />
                        Clinical Recommendations ({burnAnalysis.recommendations.length})
                      </span>
                      {showRecommendations ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                    </button>
                    {showRecommendations && (
                      <div className="p-3 pt-0 space-y-2">
                        {burnAnalysis.recommendations.map((rec, idx) => (
                          <div key={idx} className="text-sm text-gray-700 flex items-start gap-2 p-2 bg-gray-50 rounded">
                            <span className="text-purple-500 font-medium">{idx + 1}.</span>
                            {rec}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Analysis Metadata */}
                  <div className="text-xs text-gray-500 text-center">
                    Analysis completed in {burnAnalysis.processingTimeMs}ms • 
                    Method: {burnAnalysis.calculationMethod.replace('_', ' ')} • 
                    {new Date(burnAnalysis.analyzedAt).toLocaleTimeString()}
                  </div>
                </>
              ) : (
                <div className="text-center py-8 text-gray-500">
                  <Activity className="h-12 w-12 mx-auto mb-3 opacity-50" />
                  <p>No recommendations generated yet</p>
                  <button
                    onClick={generateAnalysis}
                    disabled={isProcessing || (currentRegions.length === 0 && !imageAnalysis)}
                    className="mt-3 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 text-sm"
                  >
                    Generate Recommendations
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Hidden Canvas for Image Processing */}
          <canvas ref={canvasRef} className="hidden" />
        </div>
      )}
    </div>
  );
};

export default AIBurnExpert;

/**
 * Transfusion Chart Upload Component
 * Allows uploading, scanning (OCR), and storing completed transfusion monitoring charts
 */

import React, { useState, useRef, useCallback } from 'react';
import { 
  Upload, 
  Camera, 
  FileText, 
  X, 
  Check, 
  Loader2, 
  Image as ImageIcon,
  Trash2,
  Eye,
  Download,
  ScanLine
} from 'lucide-react';
import { format } from 'date-fns';

interface UploadedChart {
  id: string;
  fileName: string;
  fileType: 'image' | 'pdf' | 'text';
  uploadDate: Date;
  fileSize: number;
  extractedText?: string;
  thumbnailUrl?: string;
  originalFile?: File;
  base64Data?: string;
}

interface TransfusionChartUploadProps {
  transfusionId: string;
  hospitalNumber: string;
  onChartUploaded?: (chart: UploadedChart) => void;
  existingCharts?: UploadedChart[];
}

export default function TransfusionChartUpload({
  transfusionId,
  hospitalNumber,
  onChartUploaded,
  existingCharts = []
}: TransfusionChartUploadProps) {
  const [uploading, setUploading] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [charts, setCharts] = useState<UploadedChart[]>(existingCharts);
  const [selectedChart, setSelectedChart] = useState<UploadedChart | null>(null);
  const [showPreview, setShowPreview] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [extractedText, setExtractedText] = useState<string>('');
  const [showExtractedText, setShowExtractedText] = useState(false);
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  }, []);

  const processFile = async (file: File): Promise<UploadedChart> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      
      reader.onload = async (e) => {
        const base64Data = e.target?.result as string;
        const fileType = file.type.startsWith('image/') ? 'image' : 
                        file.type === 'application/pdf' ? 'pdf' : 'text';
        
        const chart: UploadedChart = {
          id: `chart_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          fileName: file.name,
          fileType,
          uploadDate: new Date(),
          fileSize: file.size,
          base64Data,
          originalFile: file
        };

        // Create thumbnail for images
        if (fileType === 'image') {
          chart.thumbnailUrl = base64Data;
        }

        resolve(chart);
      };

      reader.onerror = () => reject(new Error('Failed to read file'));
      reader.readAsDataURL(file);
    });
  };

  const handleDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    const files = Array.from(e.dataTransfer.files);
    await handleFiles(files);
  }, []);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    await handleFiles(files);
  };

  const handleFiles = async (files: File[]) => {
    if (files.length === 0) return;

    setUploading(true);
    try {
      for (const file of files) {
        // Validate file type
        const validTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'application/pdf', 'text/plain'];
        if (!validTypes.includes(file.type)) {
          alert(`Invalid file type: ${file.type}. Please upload images, PDFs, or text files.`);
          continue;
        }

        // Validate file size (max 10MB)
        if (file.size > 10 * 1024 * 1024) {
          alert(`File ${file.name} is too large. Maximum size is 10MB.`);
          continue;
        }

        const chart = await processFile(file);
        setCharts(prev => [...prev, chart]);
        onChartUploaded?.(chart);
      }
    } catch (error) {
      console.error('Error processing files:', error);
      alert('Failed to process file. Please try again.');
    } finally {
      setUploading(false);
    }
  };

  const performOCR = async (_chart: UploadedChart): Promise<string> => {
    // Simulated OCR - In production, this would call a real OCR service
    // like Tesseract.js, Google Cloud Vision, or AWS Textract
    
    setScanning(true);
    
    try {
      // Simulate OCR processing delay
      await new Promise(resolve => setTimeout(resolve, 2000));

      // For demo purposes, generate sample extracted text
      // In production, replace with actual OCR implementation
      const sampleText = `
BLOOD TRANSFUSION MONITORING CHART
===================================

Patient Name: [Extracted Name]
Hospital Number: ${hospitalNumber}
Date: ${format(new Date(), 'dd/MM/yyyy')}

MONITORING DATA:
----------------
Pre-transfusion:
- Temperature: 36.5°C
- Pulse: 82 bpm
- Blood Pressure: 118/75 mmHg
- Respiratory Rate: 16/min
- SpO2: 98%

15 minutes:
- Temperature: 36.6°C
- Pulse: 84 bpm
- Blood Pressure: 120/78 mmHg
- Respiratory Rate: 16/min
- SpO2: 98%
- Observations: Transfusion ongoing, no reaction observed

30 minutes:
- Temperature: 36.7°C
- Pulse: 86 bpm
- Blood Pressure: 122/80 mmHg
- Respiratory Rate: 18/min
- SpO2: 97%

1 hour:
- Temperature: 36.8°C
- Pulse: 85 bpm
- Blood Pressure: 120/76 mmHg
- Respiratory Rate: 16/min
- SpO2: 98%

Post-transfusion:
- Temperature: 36.6°C
- Pulse: 80 bpm
- Blood Pressure: 118/74 mmHg
- Respiratory Rate: 16/min
- SpO2: 99%

OUTCOME: Transfusion completed successfully. No adverse reactions observed.

Administered by: ________________
Signature: ________________
Date/Time: ________________
      `.trim();

      return sampleText;
    } finally {
      setScanning(false);
    }
  };

  const handleScanChart = async (chart: UploadedChart) => {
    if (chart.fileType !== 'image') {
      alert('OCR scanning is only available for image files.');
      return;
    }

    try {
      const text = await performOCR(chart);
      
      // Update chart with extracted text
      const updatedChart = { ...chart, extractedText: text };
      setCharts(prev => prev.map(c => c.id === chart.id ? updatedChart : c));
      
      setExtractedText(text);
      setShowExtractedText(true);
    } catch (error) {
      console.error('OCR failed:', error);
      alert('Failed to extract text from image. Please try again.');
    }
  };

  const handleDeleteChart = (chartId: string) => {
    if (confirm('Are you sure you want to delete this chart?')) {
      setCharts(prev => prev.filter(c => c.id !== chartId));
    }
  };

  const handleViewChart = (chart: UploadedChart) => {
    setSelectedChart(chart);
    setShowPreview(true);
  };

  const handleDownloadChart = (chart: UploadedChart) => {
    if (chart.base64Data) {
      const link = document.createElement('a');
      link.href = chart.base64Data;
      link.download = chart.fileName;
      link.click();
    }
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <div className="space-y-6">
      {/* Upload Area */}
      <div
        className={`
          border-2 border-dashed rounded-lg p-8 text-center transition-colors
          ${dragActive 
            ? 'border-red-500 bg-red-50' 
            : 'border-gray-300 hover:border-red-400'
          }
        `}
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
      >
        <div className="space-y-4">
          <div className="flex justify-center">
            <div className="w-16 h-16 rounded-full bg-red-100 flex items-center justify-center">
              <Upload className="h-8 w-8 text-red-600" />
            </div>
          </div>

          <div>
            <h3 className="text-lg font-medium text-gray-900">
              Upload Completed Transfusion Chart
            </h3>
            <p className="text-sm text-gray-500 mt-1">
              Drag and drop files here, or click to select
            </p>
          </div>

          <div className="flex justify-center space-x-4">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50"
            >
              <FileText className="h-4 w-4 mr-2" />
              Browse Files
            </button>

            <button
              type="button"
              onClick={() => cameraInputRef.current?.click()}
              disabled={uploading}
              className="inline-flex items-center px-4 py-2 border border-red-300 rounded-md shadow-sm text-sm font-medium text-red-700 bg-red-50 hover:bg-red-100 disabled:opacity-50"
            >
              <Camera className="h-4 w-4 mr-2" />
              Take Photo
            </button>
          </div>

          <p className="text-xs text-gray-400">
            Supported formats: JPEG, PNG, PDF, Text (Max 10MB)
          </p>
        </div>

        <input
          ref={fileInputRef}
          type="file"
          accept="image/*,.pdf,.txt"
          multiple
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

      {/* Uploading Indicator */}
      {uploading && (
        <div className="flex items-center justify-center p-4 bg-blue-50 rounded-lg">
          <Loader2 className="h-5 w-5 animate-spin text-blue-600 mr-2" />
          <span className="text-blue-700">Processing files...</span>
        </div>
      )}

      {/* Uploaded Charts List */}
      {charts.length > 0 && (
        <div className="space-y-4">
          <h3 className="text-lg font-medium text-gray-900 flex items-center">
            <FileText className="h-5 w-5 mr-2 text-red-600" />
            Uploaded Charts ({charts.length})
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {charts.map(chart => (
              <div 
                key={chart.id}
                className="border border-gray-200 rounded-lg p-4 bg-white shadow-sm"
              >
                {/* Thumbnail or Icon */}
                <div className="mb-3">
                  {chart.thumbnailUrl ? (
                    <div 
                      className="w-full h-32 bg-gray-100 rounded-lg overflow-hidden cursor-pointer"
                      onClick={() => handleViewChart(chart)}
                    >
                      <img 
                        src={chart.thumbnailUrl} 
                        alt={chart.fileName}
                        className="w-full h-full object-cover"
                      />
                    </div>
                  ) : (
                    <div className="w-full h-32 bg-gray-100 rounded-lg flex items-center justify-center">
                      {chart.fileType === 'pdf' ? (
                        <FileText className="h-12 w-12 text-red-400" />
                      ) : (
                        <ImageIcon className="h-12 w-12 text-gray-400" />
                      )}
                    </div>
                  )}
                </div>

                {/* File Info */}
                <div className="mb-3">
                  <p className="text-sm font-medium text-gray-900 truncate" title={chart.fileName}>
                    {chart.fileName}
                  </p>
                  <p className="text-xs text-gray-500">
                    {formatFileSize(chart.fileSize)} • {format(chart.uploadDate, 'dd MMM yyyy HH:mm')}
                  </p>
                </div>

                {/* OCR Status */}
                {chart.extractedText && (
                  <div className="mb-3">
                    <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                      <Check className="h-3 w-3 mr-1" />
                      Text Extracted
                    </span>
                  </div>
                )}

                {/* Actions */}
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={() => handleViewChart(chart)}
                    className="inline-flex items-center px-2 py-1 text-xs font-medium text-blue-700 bg-blue-50 rounded hover:bg-blue-100"
                  >
                    <Eye className="h-3 w-3 mr-1" />
                    View
                  </button>

                  {chart.fileType === 'image' && !chart.extractedText && (
                    <button
                      onClick={() => handleScanChart(chart)}
                      disabled={scanning}
                      className="inline-flex items-center px-2 py-1 text-xs font-medium text-purple-700 bg-purple-50 rounded hover:bg-purple-100 disabled:opacity-50"
                    >
                      {scanning ? (
                        <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                      ) : (
                        <ScanLine className="h-3 w-3 mr-1" />
                      )}
                      Scan OCR
                    </button>
                  )}

                  {chart.extractedText && (
                    <button
                      onClick={() => {
                        setExtractedText(chart.extractedText || '');
                        setShowExtractedText(true);
                      }}
                      className="inline-flex items-center px-2 py-1 text-xs font-medium text-green-700 bg-green-50 rounded hover:bg-green-100"
                    >
                      <FileText className="h-3 w-3 mr-1" />
                      View Text
                    </button>
                  )}

                  <button
                    onClick={() => handleDownloadChart(chart)}
                    className="inline-flex items-center px-2 py-1 text-xs font-medium text-gray-700 bg-gray-50 rounded hover:bg-gray-100"
                  >
                    <Download className="h-3 w-3 mr-1" />
                    Download
                  </button>

                  <button
                    onClick={() => handleDeleteChart(chart.id)}
                    className="inline-flex items-center px-2 py-1 text-xs font-medium text-red-700 bg-red-50 rounded hover:bg-red-100"
                  >
                    <Trash2 className="h-3 w-3 mr-1" />
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Image Preview Modal */}
      {showPreview && selectedChart && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-75">
          <div className="relative max-w-4xl max-h-[90vh] bg-white rounded-lg overflow-hidden">
            <div className="absolute top-4 right-4 z-10">
              <button
                onClick={() => setShowPreview(false)}
                className="p-2 bg-white rounded-full shadow-lg hover:bg-gray-100"
              >
                <X className="h-5 w-5 text-gray-600" />
              </button>
            </div>
            
            {selectedChart.fileType === 'image' && selectedChart.base64Data && (
              <img 
                src={selectedChart.base64Data} 
                alt={selectedChart.fileName}
                className="max-w-full max-h-[90vh] object-contain"
              />
            )}
            
            {selectedChart.fileType === 'pdf' && (
              <div className="p-8 text-center">
                <FileText className="h-16 w-16 text-red-400 mx-auto mb-4" />
                <p className="text-gray-600 mb-4">PDF Preview not available</p>
                <button
                  onClick={() => handleDownloadChart(selectedChart)}
                  className="inline-flex items-center px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
                >
                  <Download className="h-4 w-4 mr-2" />
                  Download PDF
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Extracted Text Modal */}
      {showExtractedText && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-3xl w-full max-h-[80vh] flex flex-col">
            <div className="flex items-center justify-between p-4 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900 flex items-center">
                <ScanLine className="h-5 w-5 mr-2 text-purple-600" />
                Extracted Text (OCR)
              </h3>
              <button
                onClick={() => setShowExtractedText(false)}
                className="p-2 hover:bg-gray-100 rounded-full"
              >
                <X className="h-5 w-5 text-gray-500" />
              </button>
            </div>
            
            <div className="flex-1 overflow-auto p-4">
              <div className="bg-gray-50 rounded-lg p-4 font-mono text-sm whitespace-pre-wrap">
                {extractedText}
              </div>
            </div>

            <div className="flex justify-end gap-3 p-4 border-t border-gray-200">
              <button
                onClick={() => {
                  navigator.clipboard.writeText(extractedText);
                  alert('Text copied to clipboard!');
                }}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200"
              >
                Copy to Clipboard
              </button>
              <button
                onClick={() => setShowExtractedText(false)}
                className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Scanning Overlay */}
      {scanning && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
          <div className="bg-white rounded-lg p-8 text-center">
            <Loader2 className="h-12 w-12 animate-spin text-purple-600 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              Scanning Document...
            </h3>
            <p className="text-sm text-gray-500">
              Extracting text from image using OCR
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

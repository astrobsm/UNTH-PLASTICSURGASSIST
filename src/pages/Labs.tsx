import React, { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { format } from 'date-fns';
import { 
  TestTube, 
  Upload, 
  Search, 
  TrendingUp, 
  AlertTriangle, 
  CheckCircle, 
  Clock, 
  FileText, 
  Brain, 
  Plus, 
  Eye,
  BarChart3,
  Activity,
  Zap,
  Download,
  Loader2,
  Scan,
  Camera
} from 'lucide-react';
import { 
  labService, 
  LabInvestigation, 
  LabResult, 
  LabTest, 
  LabCategory, 
  LabTrend,
  GFRCalculation,
  GFRTrend,
  PatientDemographics,
  COMMON_LAB_TESTS
} from '../services/labService';
import { db } from '../db/database';
import { patientService } from '../services/patientService';
import { useOnSelectedPatient } from '../hooks/useSelectedPatient';
import { logDataExport } from '../services/auditLoggingService';
import { useAuthStore } from '../store/authStore';
import { dataSyncService } from '../services/dataSyncService';
import jsPDF from 'jspdf';
import toast from 'react-hot-toast';
import { DocumentScannerModal } from '../components/DocumentScannerModal';

type LabTab = 'investigations' | 'results' | 'upload' | 'trends' | 'requests' | 'gfr';

export default function Labs() {
  const { user } = useAuthStore();
  const location = useLocation();
  const prefill = (location.state as any)?.prefill as { patientId: string; patientName: string; hospitalNumber: string; missingLabs: string[] } | undefined;
  const [activeTab, setActiveTab] = useState<LabTab>(prefill ? 'requests' : 'investigations');
  const [investigations, setInvestigations] = useState<LabInvestigation[]>([]);
  const [results, setResults] = useState<LabResult[]>([]);
  const [gfrCalculations, setGfrCalculations] = useState<GFRCalculation[]>([]);
  const [gfrTrend, setGfrTrend] = useState<GFRTrend | null>(null);
  const [selectedPatient, setSelectedPatient] = useState<string>('');
  useOnSelectedPatient((p) => { setSelectedPatient(String(p.id)); setActiveTab('requests'); });
  const [searchQuery, setSearchQuery] = useState('');
  const [labStats, setLabStats] = useState<any>(null);
  const [patients, setPatients] = useState<any[]>([]);
  const [isSyncing, setIsSyncing] = useState(false);

  useEffect(() => {
    loadPatients();
    // Trigger sync on component mount
    handleSync();
  }, []);

  useEffect(() => {
    loadLabData();
    loadLabStatistics();
  }, [selectedPatient]);

  // Set up periodic data refresh every 2 minutes for real-time cross-device updates
  useEffect(() => {
    const syncInterval = setInterval(() => {
      if (navigator.onLine && !isSyncing) {
        loadLabData();
      }
    }, 120000); // 2 minutes

    return () => clearInterval(syncInterval);
  }, [selectedPatient, isSyncing]);

  const handleSync = async () => {
    if (isSyncing) return;
    setIsSyncing(true);
    try {
      await dataSyncService.performFullSync();
      await loadLabData();
      await loadLabStatistics();
      toast.success('Data synced successfully!', { duration: 2000 });
    } catch (error) {
      console.error('Sync failed:', error);
    } finally {
      setIsSyncing(false);
    }
  };

  const loadPatients = async () => {
    try {
      const allPatients = await patientService.getAllPatients();
      setPatients(allPatients);
    } catch (error) {
      console.error('Error loading patients:', error);
    }
  };

  const loadLabData = async () => {
    try {
      const [investigationsData, resultsData] = await Promise.all([
        labService.getLabInvestigations(selectedPatient),
        labService.getLabResults(selectedPatient)
      ]);
      
      setInvestigations(investigationsData);
      setResults(resultsData);

      // Load GFR data if patient is selected
      if (selectedPatient) {
        loadGFRData();
      }
    } catch (error) {
      console.error('Error loading lab data:', error);
    }
  };

  const loadGFRData = async () => {
    try {
      const [gfrHistory, gfrTrendData] = await Promise.all([
        labService.getGFRHistory(selectedPatient),
        labService.generateGFRTrend(selectedPatient, 12)
      ]);
      
      setGfrCalculations(gfrHistory);
      setGfrTrend(gfrTrendData);
    } catch (error) {
      console.error('Error loading GFR data:', error);
    }
  };

  const loadLabStatistics = async () => {
    try {
      const stats = await labService.getLabStatistics(selectedPatient);
      setLabStats(stats);
    } catch (error) {
      console.error('Error loading lab statistics:', error);
    }
  };

  const TabButton = ({ tab, label, icon: Icon }: { tab: LabTab; label: string; icon: any }) => (
    <button
      onClick={() => setActiveTab(tab)}
      className={`flex items-center space-x-1 sm:space-x-2 px-3 sm:px-6 py-2 sm:py-3 rounded-lg font-medium transition-colors whitespace-nowrap flex-shrink-0 text-sm sm:text-base ${
        activeTab === tab
          ? 'bg-green-600 text-white'
          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
      }`}
    >
      <Icon className="h-4 w-4 sm:h-5 sm:w-5" />
      <span>{label}</span>
    </button>
  );

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Header */}
      <div className="bg-white rounded-lg shadow-md p-4 sm:p-6">
        <div className="flex flex-col gap-4 mb-4 sm:mb-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Laboratory Management</h1>
            <div className="flex flex-col sm:flex-row gap-3 sm:gap-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                <input
                  type="text"
                  placeholder="Search labs..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="form-input pl-10 w-full"
                />
              </div>
              <select
                value={selectedPatient}
                onChange={(e) => setSelectedPatient(e.target.value)}
                className="form-select"
              >
                <option value="">All Patients</option>
                {patients.map(patient => (
                  <option key={patient.id} value={patient.id}>
                    {patient.first_name} {patient.last_name} ({patient.hospital_number})
                  </option>
                ))}
              </select>
              {/* Sync Button for Cross-Device Sync */}
              <button
                onClick={handleSync}
                disabled={isSyncing}
                className={`flex items-center space-x-2 px-4 py-2 rounded-lg font-medium transition-colors ${
                  isSyncing
                    ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                    : 'bg-green-600 text-white hover:bg-green-700'
                }`}
                title="Sync data across devices"
              >
                {isSyncing ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Download className="h-4 w-4" />
                )}
                <span className="hidden sm:inline">{isSyncing ? 'Syncing...' : 'Sync'}</span>
              </button>
            </div>
          </div>
        </div>

        {/* Lab Statistics */}
        {labStats && (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3 sm:gap-4 mb-4 sm:mb-6">
            <div className="bg-blue-50 p-3 sm:p-4 rounded-lg">
              <div className="flex items-center space-x-1 sm:space-x-2">
                <TestTube className="h-4 w-4 sm:h-5 sm:w-5 text-blue-600 flex-shrink-0" />
                <span className="text-xs sm:text-sm font-medium text-blue-600 truncate">Total</span>
              </div>
              <p className="text-xl sm:text-2xl font-bold text-blue-900">{labStats.totalInvestigations}</p>
            </div>
            <div className="bg-green-50 p-3 sm:p-4 rounded-lg">
              <div className="flex items-center space-x-1 sm:space-x-2">
                <CheckCircle className="h-4 w-4 sm:h-5 sm:w-5 text-green-600 flex-shrink-0" />
                <span className="text-xs sm:text-sm font-medium text-green-600 truncate">Done</span>
              </div>
              <p className="text-xl sm:text-2xl font-bold text-green-900">{labStats.completedResults}</p>
            </div>
            <div className="bg-yellow-50 p-3 sm:p-4 rounded-lg">
              <div className="flex items-center space-x-1 sm:space-x-2">
                <Clock className="h-4 w-4 sm:h-5 sm:w-5 text-yellow-600 flex-shrink-0" />
                <span className="text-xs sm:text-sm font-medium text-yellow-600 truncate">Pending</span>
              </div>
              <p className="text-xl sm:text-2xl font-bold text-yellow-900">{labStats.pendingResults}</p>
            </div>
            <div className="bg-orange-50 p-3 sm:p-4 rounded-lg">
              <div className="flex items-center space-x-1 sm:space-x-2">
                <AlertTriangle className="h-4 w-4 sm:h-5 sm:w-5 text-orange-600 flex-shrink-0" />
                <span className="text-xs sm:text-sm font-medium text-orange-600 truncate">Abnormal</span>
              </div>
              <p className="text-xl sm:text-2xl font-bold text-orange-900">{labStats.abnormalResults}</p>
            </div>
            <div className="bg-red-50 p-3 sm:p-4 rounded-lg col-span-2 sm:col-span-1">
              <div className="flex items-center space-x-1 sm:space-x-2">
                <Zap className="h-4 w-4 sm:h-5 sm:w-5 text-red-600 flex-shrink-0" />
                <span className="text-xs sm:text-sm font-medium text-red-600 truncate">Critical</span>
              </div>
              <p className="text-xl sm:text-2xl font-bold text-red-900">{labStats.criticalResults}</p>
            </div>
          </div>
        )}

        {/* Tab Navigation */}
        <div className="flex space-x-2 sm:space-x-4 overflow-x-auto scrollbar-hide -mx-4 px-4 sm:mx-0 sm:px-0 pb-2">
          <TabButton tab="investigations" label="Investigations" icon={TestTube} />
          <TabButton tab="results" label="Results" icon={FileText} />
          <TabButton tab="upload" label="Upload" icon={Upload} />
          <TabButton tab="trends" label="Trends" icon={TrendingUp} />
          <TabButton tab="gfr" label="GFR" icon={Activity} />
          <TabButton tab="requests" label="New" icon={Plus} />
        </div>
      </div>

      {/* Content Area */}
      {activeTab === 'investigations' && (
        <InvestigationsSection 
          investigations={investigations}
          onRefresh={loadLabData}
          searchQuery={searchQuery}
        />
      )}

      {activeTab === 'results' && (
        <ResultsSection 
          results={results}
          investigations={investigations}
          onRefresh={loadLabData}
          searchQuery={searchQuery}
        />
      )}

      {activeTab === 'upload' && (
        <UploadSection 
          investigations={investigations}
          onRefresh={loadLabData}
        />
      )}

      {activeTab === 'trends' && (
        <TrendsSection 
          selectedPatient={selectedPatient}
        />
      )}

      {activeTab === 'gfr' && (
        <GFRSection 
          patientId={selectedPatient}
          gfrCalculations={gfrCalculations}
          gfrTrend={gfrTrend}
          onRefresh={loadGFRData}
        />
      )}

      {activeTab === 'requests' && (
        <RequestSection 
          onRefresh={loadLabData}
          prefill={prefill}
        />
      )}
    </div>
  );
}

// Investigations Section Component
const InvestigationsSection = ({ investigations, onRefresh, searchQuery }: any) => {
  const [selectedInvestigation, setSelectedInvestigation] = useState<LabInvestigation | null>(null);
  
  const filteredInvestigations = investigations.filter((inv: LabInvestigation) =>
    inv.patient_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    inv.clinical_indication.toLowerCase().includes(searchQuery.toLowerCase()) ||
    inv.requested_by.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="h-5 w-5 text-green-600" />;
      case 'processing':
        return <Clock className="h-5 w-5 text-blue-600" />;
      case 'cancelled':
        return <AlertTriangle className="h-5 w-5 text-red-600" />;
      default:
        return <TestTube className="h-5 w-5 text-gray-600" />;
    }
  };

  const getUrgencyColor = (urgency: string) => {
    switch (urgency) {
      case 'stat':
        return 'text-red-600 bg-red-100';
      case 'urgent':
        return 'text-orange-600 bg-orange-100';
      default:
        return 'text-green-600 bg-green-100';
    }
  };

  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-semibold text-gray-900">Lab Investigations</h2>
        <span className="text-sm text-gray-600">{filteredInvestigations.length} investigations</span>
      </div>

      <div className="space-y-4">
        {filteredInvestigations.map((investigation: LabInvestigation) => (
          <div key={investigation.id} className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center space-x-3">
                {getStatusIcon(investigation.status)}
                <div>
                  <h3 className="font-semibold text-gray-900">{investigation.patient_name}</h3>
                  <p className="text-sm text-gray-600">{format(new Date(investigation.request_date), 'MMM d, yyyy')}</p>
                </div>
              </div>
              <div className="flex items-center space-x-2">
                <span className={`px-2 py-1 rounded-full text-xs font-medium ${getUrgencyColor(investigation.urgency)}`}>
                  {investigation.urgency.toUpperCase()}
                </span>
                <button 
                  onClick={() => setSelectedInvestigation(investigation)}
                  className="p-2 text-gray-600 hover:text-blue-600 transition-colors"
                  title="View Investigation Details"
                >
                  <Eye className="h-4 w-4" />
                </button>
              </div>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-3">
              <div>
                <span className="text-sm font-medium text-gray-500">Requested by:</span>
                <p className="text-sm text-gray-900">{investigation.requested_by}</p>
              </div>
              <div>
                <span className="text-sm font-medium text-gray-500">Tests:</span>
                <p className="text-sm text-gray-900">{investigation.tests.length} tests</p>
              </div>
              <div>
                <span className="text-sm font-medium text-gray-500">Clinical Indication:</span>
                <p className="text-sm text-gray-900">{investigation.clinical_indication}</p>
              </div>
            </div>

            {/* Test List */}
            <div className="border-t pt-3">
              <div className="flex flex-wrap gap-2">
                {investigation.tests.slice(0, 3).map((test: LabTest) => (
                  <span key={test.id} className="px-2 py-1 bg-gray-100 text-gray-700 text-xs rounded">
                    {test.test_name}
                  </span>
                ))}
                {investigation.tests.length > 3 && (
                  <span className="px-2 py-1 bg-gray-100 text-gray-700 text-xs rounded">
                    +{investigation.tests.length - 3} more
                  </span>
                )}
              </div>
            </div>

            <div className="flex items-center justify-between mt-3">
              <span className="text-sm text-gray-600">
                {investigation.collection_date 
                  ? `Collected: ${format(investigation.collection_date, 'MMM d, yyyy')}`
                  : 'Not collected yet'
                }
              </span>
              <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                investigation.status === 'completed' ? 'bg-green-100 text-green-800' :
                investigation.status === 'processing' ? 'bg-blue-100 text-blue-800' :
                investigation.status === 'cancelled' ? 'bg-red-100 text-red-800' :
                'bg-gray-100 text-gray-800'
              }`}>
                {investigation.status.toUpperCase()}
              </span>
            </div>
          </div>
        ))}
      </div>
      
      {/* Investigation Detail Modal */}
      {selectedInvestigation && (
        <InvestigationDetailModal
          investigation={selectedInvestigation}
          onClose={() => setSelectedInvestigation(null)}
        />
      )}
    </div>
  );
};

// Investigation Detail Modal Component
// ─── Lab Investigation PDF Generation ──────────────────────────────────────
function generateLabRequestPDF(investigation: LabInvestigation, mode: 'a4' | 'thermal') {
  if (mode === 'thermal') {
    generateLabRequestThermal(investigation);
    return;
  }

  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 15;
  const contentWidth = pageWidth - margin * 2;
  let y = 20;

  // Header
  doc.setFont('times', 'bold');
  doc.setFontSize(14);
  doc.text('LABORATORY INVESTIGATION REQUEST', pageWidth / 2, y, { align: 'center' });
  y += 8;

  doc.setFont('times', 'normal');
  doc.setFontSize(11);
  doc.text('Division of Plastic, Reconstructive & Burn Surgery', pageWidth / 2, y, { align: 'center' });
  y += 6;
  doc.text('University of Nigeria Teaching Hospital (UNTH), Ituku-Ozalla, Enugu', pageWidth / 2, y, { align: 'center' });
  y += 10;

  // Line
  doc.setLineWidth(0.5);
  doc.line(margin, y, pageWidth - margin, y);
  y += 8;

  // Patient Info
  doc.setFont('times', 'bold');
  doc.setFontSize(10);
  doc.text('Patient Name:', margin, y);
  doc.setFont('times', 'normal');
  doc.text(investigation.patient_name || 'N/A', margin + 32, y);

  doc.setFont('times', 'bold');
  doc.text('Patient ID:', pageWidth/ 2, y);
  doc.setFont('times', 'normal');
  doc.text(investigation.patient_id || 'N/A', pageWidth / 2 + 28, y);
  y += 7;

  doc.setFont('times', 'bold');
  doc.text('Request Date:', margin, y);
  doc.setFont('times', 'normal');
  doc.text(format(new Date(investigation.request_date), 'dd/MM/yyyy'), margin + 32, y);

  doc.setFont('times', 'bold');
  doc.text('Requested By:', pageWidth / 2, y);
  doc.setFont('times', 'normal');
  doc.text(investigation.requested_by || 'N/A', pageWidth / 2 + 32, y);
  y += 7;

  doc.setFont('times', 'bold');
  doc.text('Urgency:', margin, y);
  doc.setFont('times', 'normal');
  doc.text((investigation.urgency || 'routine').toUpperCase(), margin + 32, y);

  doc.setFont('times', 'bold');
  doc.text('Status:', pageWidth / 2, y);
  doc.setFont('times', 'normal');
  doc.text((investigation.status || 'pending').toUpperCase(), pageWidth / 2 + 32, y);
  y += 10;

  // Clinical Indication
  if (investigation.clinical_indication) {
    doc.setFont('times', 'bold');
    doc.text('Clinical Indication:', margin, y);
    y += 5;
    doc.setFont('times', 'normal');
    doc.setFontSize(10);
    const indLines = doc.splitTextToSize(investigation.clinical_indication, contentWidth);
    indLines.forEach((line: string) => {
      doc.text(line, margin, y);
      y += 5;
    });
    y += 3;
  }

  // Special Instructions
  if (investigation.special_instructions) {
    doc.setFont('times', 'bold');
    doc.text('Special Instructions:', margin, y);
    y += 5;
    doc.setFont('times', 'normal');
    const siLines = doc.splitTextToSize(investigation.special_instructions, contentWidth);
    siLines.forEach((line: string) => {
      doc.text(line, margin, y);
      y += 5;
    });
    y += 3;
  }

  // Line
  doc.setLineWidth(0.3);
  doc.line(margin, y, pageWidth - margin, y);
  y += 8;

  // Tests Table
  doc.setFont('times', 'bold');
  doc.setFontSize(11);
  doc.text('INVESTIGATIONS ORDERED', margin, y);
  y += 6;

  // Table headers
  doc.setFontSize(10);
  const colNum = margin;
  const colTest = margin + 10;
  const colCategory = margin + 90;
  const colSample = margin + 130;
  doc.text('#', colNum, y);
  doc.text('Test Name', colTest, y);
  doc.text('Category', colCategory, y);
  doc.text('Sample', colSample, y);
  y += 2;
  doc.line(margin, y, pageWidth - margin, y);
  y += 5;

  doc.setFont('times', 'normal');
  if (investigation.tests && investigation.tests.length > 0) {
    investigation.tests.forEach((test: LabTest, idx: number) => {
      if (y > 270) {
        doc.addPage();
        y = 20;
      }
      doc.text(`${idx + 1}`, colNum, y);
      doc.text(test.test_name || '', colTest, y, { maxWidth: 75 });
      doc.text(test.category || '', colCategory, y, { maxWidth: 35 });
      doc.text(test.sample_type || '', colSample, y, { maxWidth: 35 });
      y += 6;
      if (test.fasting_required) {
        doc.setFont('times', 'italic');
        doc.setFontSize(8);
        doc.text('* Fasting Required', colTest + 2, y);
        doc.setFont('times', 'normal');
        doc.setFontSize(10);
        y += 4;
      }
    });
  }

  // Footer
  y += 10;
  if (y > 260) { doc.addPage(); y = 20; }
  doc.line(margin, y, margin + 60, y);
  y += 5;
  doc.setFontSize(9);
  doc.text(`Requested by: ${investigation.requested_by || ''}`, margin, y);
  y += 4;
  doc.text(`Date: ${format(new Date(investigation.request_date), 'dd/MM/yyyy')}`, margin, y);
  y += 4;
  doc.text(`Printed: ${new Date().toLocaleDateString('en-GB')} ${new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}`, margin, y);

  doc.save(`LabRequest_${investigation.patient_name || 'lab'}_${new Date().toISOString().slice(0, 10)}.pdf`);
}

// Thermal 80mm Lab Request PDF
function generateLabRequestThermal(investigation: LabInvestigation) {
  const thermalWidth = 80;
  const margin = 4;
  const contentWidth = thermalWidth - margin * 2;
  const testCount = investigation.tests?.length || 0;
  let estHeight = 70 + testCount * 12;
  if (investigation.clinical_indication) estHeight += 12;
  if (investigation.special_instructions) estHeight += 12;
  estHeight = Math.max(estHeight, 80);

  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: [thermalWidth, estHeight] });
  let y = 6;

  // Header
  doc.setFont('times', 'bold');
  doc.setFontSize(13);
  doc.text('LAB REQUEST', thermalWidth / 2, y, { align: 'center' });
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
  doc.setFont('times', 'bold');
  doc.setFontSize(10);
  doc.text(investigation.patient_name || 'N/A', margin, y);
  y += 4;
  doc.setFont('times', 'normal');
  doc.setFontSize(9);
  doc.text(`Patient ID: ${investigation.patient_id || 'N/A'}`, margin, y);
  y += 3.5;
  doc.text(`Date: ${format(new Date(investigation.request_date), 'dd/MM/yyyy')}`, margin, y);
  y += 3.5;
  doc.text(`Urgency: ${(investigation.urgency || 'routine').toUpperCase()}`, margin, y);
  y += 4;

  if (investigation.clinical_indication) {
    doc.setFont('times', 'italic');
    doc.setFontSize(8);
    const indLines = doc.splitTextToSize(`Indication: ${investigation.clinical_indication}`, contentWidth);
    indLines.forEach((line: string) => {
      doc.text(line, margin, y);
      y += 3;
    });
    doc.setFont('times', 'normal');
    y += 1;
  }

  // Dashed line
  doc.setLineDashPattern([1, 1], 0);
  doc.line(margin, y, thermalWidth - margin, y);
  doc.setLineDashPattern([], 0);
  y += 4;

  // Tests list
  doc.setFont('times', 'bold');
  doc.setFontSize(10);
  doc.text('TESTS ORDERED:', margin, y);
  y += 4;

  doc.setFont('times', 'normal');
  doc.setFontSize(9);
  if (investigation.tests && investigation.tests.length > 0) {
    investigation.tests.forEach((test: LabTest, idx: number) => {
      if (y > estHeight - 15) {
        doc.addPage([thermalWidth, estHeight]);
        y = 6;
      }
      doc.text(`${idx + 1}. ${test.test_name}`, margin, y, { maxWidth: contentWidth });
      y += 3.5;
      doc.setFontSize(7);
      doc.text(`   ${test.category} | ${test.sample_type}${test.fasting_required ? ' | Fasting' : ''}`, margin, y, { maxWidth: contentWidth });
      doc.setFontSize(9);
      y += 4;
    });
  }

  // Footer
  y += 2;
  doc.setLineDashPattern([1, 1], 0);
  doc.line(margin, y, thermalWidth - margin, y);
  doc.setLineDashPattern([], 0);
  y += 4;
  doc.setFontSize(8);
  doc.text(`Requested by: ${investigation.requested_by || ''}`, margin, y);
  y += 3;
  doc.text(`Printed: ${new Date().toLocaleDateString('en-GB')} ${new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}`, margin, y);

  doc.save(`LabReq_thermal_${investigation.patient_name || 'lab'}_${new Date().toISOString().slice(0, 10)}.pdf`);
}

const InvestigationDetailModal = ({ investigation, onClose }: { investigation: LabInvestigation; onClose: () => void }) => {
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'bg-green-100 text-green-800';
      case 'processing': return 'bg-blue-100 text-blue-800';
      case 'collected': return 'bg-yellow-100 text-yellow-800';
      case 'cancelled': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getUrgencyColor = (urgency: string) => {
    switch (urgency) {
      case 'stat': return 'bg-red-100 text-red-800';
      case 'urgent': return 'bg-orange-100 text-orange-800';
      default: return 'bg-green-100 text-green-800';
    }
  };

  const getTestStatusIcon = (status: string) => {
    switch (status) {
      case 'completed': return <CheckCircle className="h-4 w-4 text-green-600" />;
      case 'processing': return <Clock className="h-4 w-4 text-blue-600" />;
      case 'collected': return <TestTube className="h-4 w-4 text-yellow-600" />;
      default: return <Clock className="h-4 w-4 text-gray-400" />;
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-0 sm:p-4">
      <div className="bg-white rounded-none sm:rounded-lg shadow-xl sm:max-w-2xl w-full h-full sm:h-auto sm:max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-white border-b px-6 py-4 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <TestTube className="h-6 w-6 text-green-600" />
            <h2 className="text-xl font-bold text-gray-900">Investigation Details</h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-600 transition-colors"
          >
            <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Patient & Request Info */}
          <div className="bg-gray-50 rounded-lg p-4">
            <h3 className="font-semibold text-gray-900 mb-3 flex items-center space-x-2">
              <FileText className="h-5 w-5 text-gray-600" />
              <span>Patient Information</span>
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <span className="text-sm text-gray-500">Patient Name</span>
                <p className="font-medium text-gray-900">{investigation.patient_name}</p>
              </div>
              <div>
                <span className="text-sm text-gray-500">Request Date</span>
                <p className="font-medium text-gray-900">{format(new Date(investigation.request_date), 'MMM d, yyyy')}</p>
              </div>
              <div>
                <span className="text-sm text-gray-500">Requested By</span>
                <p className="font-medium text-gray-900">{investigation.requested_by}</p>
              </div>
              <div>
                <span className="text-sm text-gray-500">Status</span>
                <p className={`inline-block px-2 py-1 rounded text-sm font-medium ${getStatusColor(investigation.status)}`}>
                  {investigation.status.toUpperCase()}
                </p>
              </div>
            </div>
          </div>

          {/* Clinical Details */}
          <div className="bg-blue-50 rounded-lg p-4">
            <h3 className="font-semibold text-gray-900 mb-3 flex items-center space-x-2">
              <Brain className="h-5 w-5 text-blue-600" />
              <span>Clinical Details</span>
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <span className="text-sm text-gray-500">Urgency</span>
                <p className={`inline-block px-2 py-1 rounded text-sm font-medium ${getUrgencyColor(investigation.urgency)}`}>
                  {investigation.urgency.toUpperCase()}
                </p>
              </div>
              <div>
                <span className="text-sm text-gray-500">Collection Date</span>
                <p className="font-medium text-gray-900">
                  {investigation.collection_date 
                    ? format(new Date(investigation.collection_date), 'MMM d, yyyy')
                    : 'Not collected yet'}
                </p>
              </div>
              <div className="col-span-2">
                <span className="text-sm text-gray-500">Clinical Indication</span>
                <p className="font-medium text-gray-900">{investigation.clinical_indication || 'N/A'}</p>
              </div>
              {investigation.special_instructions && (
                <div className="col-span-2">
                  <span className="text-sm text-gray-500">Special Instructions</span>
                  <p className="font-medium text-gray-900">{investigation.special_instructions}</p>
                </div>
              )}
            </div>
          </div>

          {/* Tests List */}
          <div>
            <h3 className="font-semibold text-gray-900 mb-3 flex items-center space-x-2">
              <TestTube className="h-5 w-5 text-green-600" />
              <span>Ordered Tests ({investigation.tests?.length || 0})</span>
            </h3>
            <div className="space-y-2">
              {investigation.tests && investigation.tests.length > 0 ? (
                investigation.tests.map((test: LabTest) => (
                  <div key={test.id} className="border border-gray-200 rounded-lg p-3 flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      {getTestStatusIcon(test.status)}
                      <div>
                        <p className="font-medium text-gray-900">{test.test_name}</p>
                        <p className="text-sm text-gray-500">
                          {test.category} • {test.sample_type}
                          {test.fasting_required && ' • Fasting Required'}
                        </p>
                      </div>
                    </div>
                    <span className={`px-2 py-1 rounded text-xs font-medium ${getStatusColor(test.status)}`}>
                      {test.status.toUpperCase()}
                    </span>
                  </div>
                ))
              ) : (
                <p className="text-gray-500 text-center py-4">No tests found for this investigation</p>
              )}
            </div>
          </div>

          {/* Collection Notes */}
          {investigation.collection_notes && (
            <div className="bg-yellow-50 rounded-lg p-4">
              <h3 className="font-semibold text-gray-900 mb-2">Collection Notes</h3>
              <p className="text-gray-700">{investigation.collection_notes}</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="sticky bottom-0 bg-gray-50 border-t px-6 py-4 flex justify-between items-center">
          <div className="flex gap-2">
            <button
              onClick={() => generateLabRequestPDF(investigation, 'a4')}
              className="px-3 py-2 bg-blue-100 text-blue-700 rounded-lg text-sm hover:bg-blue-200 flex items-center gap-1"
            >
              <Download className="h-4 w-4" />
              A4 PDF
            </button>
            <button
              onClick={() => generateLabRequestPDF(investigation, 'thermal')}
              className="px-3 py-2 bg-yellow-100 text-yellow-800 rounded-lg text-sm hover:bg-yellow-200 flex items-center gap-1"
            >
              <Download className="h-4 w-4" />
              80mm Print
            </button>
          </div>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

// Results Section Component
const ResultsSection = ({ results, investigations, onRefresh, searchQuery }: any) => {
  const [selectedResult, setSelectedResult] = useState<LabResult | null>(null);

  const filteredResults = results.filter((result: LabResult) =>
    result.test_id.toLowerCase().includes(searchQuery.toLowerCase()) ||
    result.result_value.toLowerCase().includes(searchQuery.toLowerCase()) ||
    result.ai_interpretation?.interpretation_text.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const getAbnormalityColor = (flag: string) => {
    switch (flag) {
      case 'critical_high':
      case 'critical_low':
        return 'text-red-600 bg-red-100';
      case 'high':
      case 'low':
        return 'text-orange-600 bg-orange-100';
      case 'abnormal':
        return 'text-yellow-600 bg-yellow-100';
      default:
        return 'text-green-600 bg-green-100';
    }
  };

  const getRiskLevelColor = (level: string) => {
    switch (level) {
      case 'critical':
        return 'text-red-600 bg-red-100';
      case 'high':
        return 'text-orange-600 bg-orange-100';
      case 'moderate':
        return 'text-yellow-600 bg-yellow-100';
      default:
        return 'text-green-600 bg-green-100';
    }
  };

  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-semibold text-gray-900">Lab Results</h2>
        <span className="text-sm text-gray-600">{filteredResults.length} results</span>
      </div>

      <div className="space-y-4">
        {filteredResults.map((result: LabResult) => (
          <div key={result.id} className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center space-x-3">
                <TestTube className="h-5 w-5 text-blue-600" />
                <div>
                  <h3 className="font-semibold text-gray-900">{result.test_id}</h3>
                  <p className="text-sm text-gray-600">{format(result.result_date, 'MMM d, yyyy HH:mm')}</p>
                </div>
              </div>
              <div className="flex items-center space-x-2">
                <span className={`px-2 py-1 rounded-full text-xs font-medium ${getAbnormalityColor(result.abnormal_flag)}`}>
                  {result.abnormal_flag.replace('_', ' ').toUpperCase()}
                </span>
                <button 
                  onClick={() => setSelectedResult(result)}
                  className="p-2 text-gray-600 hover:text-blue-600 transition-colors"
                >
                  <Eye className="h-4 w-4" />
                </button>
              </div>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-3">
              <div>
                <span className="text-sm font-medium text-gray-500">Result:</span>
                <p className="text-lg font-semibold text-gray-900">{result.result_value} {result.unit}</p>
              </div>
              <div>
                <span className="text-sm font-medium text-gray-500">Reference Range:</span>
                <p className="text-sm text-gray-900">{result.reference_range}</p>
              </div>
              <div>
                <span className="text-sm font-medium text-gray-500">Lab Technician:</span>
                <p className="text-sm text-gray-900">{result.lab_technician}</p>
              </div>
              <div>
                <span className="text-sm font-medium text-gray-500">Verified:</span>
                <p className="text-sm text-gray-900">
                  {result.verified_by ? `${result.verified_by}` : 'Pending'}
                </p>
              </div>
            </div>

            {/* Clinical Interpretation */}
            {result.ai_interpretation && (
              <div className="border-t pt-3">
                <div className="flex items-center space-x-2 mb-2">
                  <Brain className="h-4 w-4 text-purple-600" />
                  <span className="text-sm font-medium text-purple-600">Clinical Interpretation</span>
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${getRiskLevelColor(result.ai_interpretation.risk_level)}`}>
                    {result.ai_interpretation.risk_level.toUpperCase()}
                  </span>
                </div>
                <p className="text-sm text-gray-700 mb-2">{result.ai_interpretation.interpretation_text}</p>
                <p className="text-sm text-gray-600">{result.ai_interpretation.clinical_significance}</p>
                
                {result.ai_interpretation.suggested_actions.length > 0 && (
                  <div className="mt-2">
                    <span className="text-xs font-medium text-gray-500">Suggested Actions:</span>
                    <ul className="text-xs text-gray-600 ml-4">
                      {result.ai_interpretation.suggested_actions.map((action, index) => (
                        <li key={index} className="list-disc">{action}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}

            {/* File Attachments */}
            {result.file_attachments && result.file_attachments.length > 0 && (
              <div className="border-t pt-3 mt-3">
                <span className="text-sm font-medium text-gray-500">Attachments:</span>
                <div className="flex flex-wrap gap-2 mt-1">
                  {result.file_attachments.map((file) => (
                    <a
                      key={file.id}
                      href={file.file_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center space-x-1 px-2 py-1 bg-blue-100 text-blue-700 text-xs rounded hover:bg-blue-200 transition-colors"
                    >
                      <FileText className="h-3 w-3" />
                      <span>{file.file_name}</span>
                    </a>
                  ))}
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Result Detail Modal */}
      {selectedResult && (
        <ResultDetailModal 
          result={selectedResult}
          onClose={() => setSelectedResult(null)}
        />
      )}
    </div>
  );
};

// Upload Section Component
const UploadSection = ({ investigations, onRefresh }: any) => {
  const [formData, setFormData] = useState({
    investigation_id: '',
    test_id: '',
    result_value: '',
    unit: '',
    reference_range: '',
    abnormal_flag: 'normal',
    lab_technician: '',
    comments: ''
  });
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [showOCRModal, setShowOCRModal] = useState(false);

  const handleOCRFields = (fields: Record<string, any>) => {
    setFormData(prev => ({
      ...prev,
      test_id: fields.test_name || fields.test_id || fields.investigation || prev.test_id,
      result_value: fields.result_value || fields.result || fields.value || prev.result_value,
      unit: fields.unit || fields.units || prev.unit,
      reference_range: fields.reference_range || fields.normal_range || fields.range || prev.reference_range,
      abnormal_flag: fields.abnormal_flag || fields.flag || prev.abnormal_flag,
      lab_technician: fields.technician || fields.lab_technician || fields.reported_by || prev.lab_technician,
      comments: fields.comments || fields.notes || fields.interpretation || prev.comments
    }));
    setShowOCRModal(false);
    toast.success('Lab result fields extracted from scan');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setUploading(true);
    
    try {
      const resultId = await labService.addLabResult({
        ...formData,
        patient_id: investigations.find((inv: any) => inv.id === formData.investigation_id)?.patient_id || '',
        result_date: new Date(),
        verified_by: undefined,
        verified_date: undefined,
        abnormal_flag: formData.abnormal_flag as 'normal' | 'high' | 'low' | 'critical_high' | 'critical_low' | 'abnormal'
      });

      if (selectedFile) {
        await labService.uploadLabFile(selectedFile, resultId, formData.lab_technician);
      }

      // Reset form
      setFormData({
        investigation_id: '',
        test_id: '',
        result_value: '',
        unit: '',
        reference_range: '',
        abnormal_flag: 'normal',
        lab_technician: '',
        comments: ''
      });
      setSelectedFile(null);
      onRefresh();
    } catch (error) {
      console.error('Error uploading result:', error);
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center space-x-3">
          <Upload className="h-6 w-6 text-green-600" />
          <h2 className="text-xl font-semibold text-gray-900">Upload Lab Results</h2>
        </div>
        <button
          type="button"
          onClick={() => setShowOCRModal(true)}
          className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          <Scan className="h-4 w-4" />
          <span>Scan Lab Form</span>
        </button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Investigation</label>
            <select
              value={formData.investigation_id}
              onChange={(e) => setFormData({ ...formData, investigation_id: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
              required
            >
              <option value="">Select Investigation</option>
              {investigations.map((inv: LabInvestigation) => (
                <option key={inv.id} value={inv.id}>
                  {inv.patient_name} - {format(new Date(inv.request_date), 'MMM d, yyyy')}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Test</label>
            <input
              type="text"
              value={formData.test_id}
              onChange={(e) => setFormData({ ...formData, test_id: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
              placeholder="e.g., FBC, U&E, LFT"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Result Value</label>
            <input
              type="text"
              value={formData.result_value}
              onChange={(e) => setFormData({ ...formData, result_value: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
              placeholder="e.g., 5.2, Normal, Positive"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Unit</label>
            <input
              type="text"
              value={formData.unit}
              onChange={(e) => setFormData({ ...formData, unit: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
              placeholder="e.g., mg/dL, mmol/L, %"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Reference Range</label>
            <input
              type="text"
              value={formData.reference_range}
              onChange={(e) => setFormData({ ...formData, reference_range: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
              placeholder="e.g., 3.5-5.0 mg/dL"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Abnormal Flag</label>
            <select
              value={formData.abnormal_flag}
              onChange={(e) => setFormData({ ...formData, abnormal_flag: e.target.value as any })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
            >
              <option value="normal">Normal</option>
              <option value="high">High</option>
              <option value="low">Low</option>
              <option value="critical_high">Critical High</option>
              <option value="critical_low">Critical Low</option>
              <option value="abnormal">Abnormal</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Lab Technician</label>
            <input
              type="text"
              value={formData.lab_technician}
              onChange={(e) => setFormData({ ...formData, lab_technician: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Attach File (Optional)</label>
            <input
              type="file"
              onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
              accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Comments (Optional)</label>
          <textarea
            value={formData.comments}
            onChange={(e) => setFormData({ ...formData, comments: e.target.value })}
            rows={3}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
            placeholder="Additional comments about the result..."
          />
        </div>

        <div className="flex justify-end space-x-3">
          <button
            type="button"
            onClick={() => {
              setFormData({
                investigation_id: '',
                test_id: '',
                result_value: '',
                unit: '',
                reference_range: '',
                abnormal_flag: 'normal',
                lab_technician: '',
                comments: ''
              });
              setSelectedFile(null);
            }}
            className="px-4 py-2 text-gray-700 bg-gray-200 rounded-lg hover:bg-gray-300 transition-colors"
          >
            Clear
          </button>
          <button
            type="submit"
            disabled={uploading}
            className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50"
          >
            {uploading ? 'Uploading...' : 'Upload Result'}
          </button>
        </div>
      </form>

      <DocumentScannerModal
        isOpen={showOCRModal}
        onClose={() => setShowOCRModal(false)}
        onFieldsExtracted={handleOCRFields}
        documentType="lab_report"
        targetForm="lab_entry"
      />
    </div>
  );
};

// Trends Section Component
const TrendsSection = ({ selectedPatient }: any) => {
  const { user } = useAuthStore();
  const [trendData, setTrendData] = useState<LabTrend[]>([]);
  const [selectedTest, setSelectedTest] = useState('');
  const [timeRange, setTimeRange] = useState(6);
  const [exporting, setExporting] = useState(false);
  const [dateRange, setDateRange] = useState({
    start: new Date(Date.now() - 6 * 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    end: new Date().toISOString().split('T')[0]
  });

  useEffect(() => {
    if (selectedPatient && selectedTest) {
      loadTrendData();
    }
  }, [selectedPatient, selectedTest, timeRange]);

  const loadTrendData = async () => {
    try {
      const trend = await labService.getLabTrends(selectedPatient, selectedTest, timeRange);
      setTrendData([trend]);
    } catch (error) {
      console.error('Error loading trend data:', error);
    }
  };

  const handleExportPDF = async () => {
    if (!selectedPatient || !selectedTest || trendData.length === 0) {
      alert('Please select a patient and test, then analyze trends before exporting.');
      return;
    }
    
    try {
      setExporting(true);
      const patientName = trendData[0]?.test_name ? `Patient_${selectedPatient}` : 'Unknown';
      const blob = await labService.generateTrendsPDF(
        selectedPatient,
        patientName,
        selectedTest,
        new Date(dateRange.start),
        new Date(dateRange.end)
      );
      
      // Create download link
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `Lab_Trend_${selectedTest}_${new Date().toISOString().split('T')[0]}.html`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      // Log audit for HIPAA compliance
      if (user) {
        await logDataExport(
          user.id,
          user.name,
          user.role,
          'LAB',
          `${selectedPatient}-${selectedTest}`,
          'PDF'
        );
      }
    } catch (error) {
      console.error('Error exporting PDF:', error);
      alert('Failed to export trend report. Please try again.');
    } finally {
      setExporting(false);
    }
  };

  const getTrendIcon = (direction: string) => {
    switch (direction) {
      case 'improving':
        return <TrendingUp className="h-5 w-5 text-green-600" />;
      case 'worsening':
        return <TrendingUp className="h-5 w-5 text-red-600 transform rotate-180" />;
      case 'fluctuating':
        return <Activity className="h-5 w-5 text-orange-600" />;
      default:
        return <BarChart3 className="h-5 w-5 text-blue-600" />;
    }
  };

  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      <div className="flex items-center space-x-3 mb-6">
        <TrendingUp className="h-6 w-6 text-green-600" />
        <h2 className="text-xl font-semibold text-gray-900">Lab Trends & Serial Tracking</h2>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Test Name</label>
          <input
            type="text"
            value={selectedTest}
            onChange={(e) => setSelectedTest(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
            placeholder="e.g., Hemoglobin, Creatinine"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Time Range</label>
          <select
            value={timeRange}
            onChange={(e) => setTimeRange(parseInt(e.target.value))}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
          >
            <option value={3}>Last 3 months</option>
            <option value={6}>Last 6 months</option>
            <option value={12}>Last 12 months</option>
            <option value={24}>Last 2 years</option>
          </select>
        </div>
        <div className="flex items-end gap-2">
          <button
            onClick={loadTrendData}
            disabled={!selectedPatient || !selectedTest}
            className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50"
          >
            Analyze Trends
          </button>
          <button
            onClick={handleExportPDF}
            disabled={!selectedPatient || !selectedTest || trendData.length === 0 || exporting}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 flex items-center gap-2"
            title="Export Trend Report"
          >
            {exporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
            PDF
          </button>
        </div>
      </div>

      {trendData.length > 0 && (
        <div className="space-y-6">
          {trendData.map((trend, index) => (
            <div key={index} className="border border-gray-200 rounded-lg p-4">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center space-x-3">
                  {getTrendIcon(trend.trend_direction)}
                  <h3 className="text-lg font-semibold text-gray-900">{trend.test_name}</h3>
                </div>
                <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                  trend.trend_direction === 'improving' ? 'bg-green-100 text-green-800' :
                  trend.trend_direction === 'worsening' ? 'bg-red-100 text-red-800' :
                  trend.trend_direction === 'fluctuating' ? 'bg-orange-100 text-orange-800' :
                  'bg-blue-100 text-blue-800'
                }`}>
                  {trend.trend_direction.toUpperCase()}
                </span>
              </div>

              <p className="text-sm text-gray-600 mb-4">{trend.trend_analysis}</p>

              {/* Data Points */}
              <div className="space-y-2">
                <h4 className="text-sm font-medium text-gray-700">Recent Results:</h4>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                  {trend.results.slice(-6).map((result, resultIndex) => (
                    <div key={resultIndex} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                      <span className="text-sm text-gray-600">{format(new Date(result.date), 'MMM d')}</span>
                      <span className="text-sm font-medium">{result.value}</span>
                      <span className={`text-xs px-1 py-0.5 rounded ${
                        result.flag === 'normal' ? 'bg-green-100 text-green-800' :
                        'bg-orange-100 text-orange-800'
                      }`}>
                        {result.flag}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {!selectedPatient && (
        <div className="text-center py-8">
          <BarChart3 className="h-12 w-12 text-gray-400 mx-auto mb-3" />
          <p className="text-gray-600">Select a patient to view lab trends</p>
        </div>
      )}
    </div>
  );
};

// Request Section Component
const RequestSection = ({ onRefresh, prefill }: { onRefresh: () => void; prefill?: { patientId: string; patientName: string; hospitalNumber: string; missingLabs: string[] } }) => {
  const [formData, setFormData] = useState({
    patient_id: prefill?.patientId || '',
    patient_name: prefill?.patientName || '',
    hospital_number: prefill?.hospitalNumber || '',
    requested_by: '',
    urgency: 'routine',
    clinical_indication: prefill ? 'Pre-operative mandatory labs' : '',
    special_instructions: ''
  });
  const [selectedTests, setSelectedTests] = useState<LabTest[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<LabCategory>('hematology');
  const [patients, setPatients] = useState<any[]>([]);
  const [patientSearchQuery, setPatientSearchQuery] = useState(
    prefill ? `${prefill.patientName} (${prefill.hospitalNumber})` : ''
  );
  const [showPatientDropdown, setShowPatientDropdown] = useState(false);

  useEffect(() => {
    loadPatients();
  }, []);

  // Auto-select tests from prefill missing labs
  useEffect(() => {
    if (!prefill?.missingLabs?.length) return;
    const allTests: LabTest[] = [];
    for (const cat of Object.values(COMMON_LAB_TESTS)) {
      allTests.push(...cat);
    }
    const matched: LabTest[] = [];
    for (const labName of prefill.missingLabs) {
      const ln = labName.toLowerCase();
      // Map mandatory lab names to actual test objects
      if (ln.includes('hiv') || ln.includes('hbsag') || ln.includes('hcv')) {
        const hiv = allTests.find(t => t.id === 'hiv');
        const hbsag = allTests.find(t => t.id === 'hbsag');
        const hcv = allTests.find(t => t.id === 'hcv');
        if (hiv && !matched.some(m => m.id === hiv.id)) matched.push(hiv);
        if (hbsag && !matched.some(m => m.id === hbsag.id)) matched.push(hbsag);
        if (hcv && !matched.some(m => m.id === hcv.id)) matched.push(hcv);
      } else if (ln.includes('full blood count') || ln.includes('fbc')) {
        const fbc = allTests.find(t => t.id === 'fbc');
        if (fbc && !matched.some(m => m.id === fbc.id)) matched.push(fbc);
      } else if (ln.includes('electrolytes') || ln.includes('e/u/cr') || ln.includes('urea')) {
        const ue = allTests.find(t => t.id === 'u_e');
        if (ue && !matched.some(m => m.id === ue.id)) matched.push(ue);
      } else if (ln.includes('ecg')) {
        const echo = allTests.find(t => t.id === 'echo');
        if (echo && !matched.some(m => m.id === echo.id)) matched.push(echo);
      } else {
        // Fuzzy match by test name
        const found = allTests.find(t => t.test_name.toLowerCase().includes(ln) || ln.includes(t.test_name.toLowerCase()));
        if (found && !matched.some(m => m.id === found.id)) matched.push(found);
      }
    }
    if (matched.length > 0) {
      setSelectedTests(matched);
    }
  }, [prefill]);

  const loadPatients = async () => {
    try {
      const allPatients = await patientService.getAllPatients();
      setPatients(allPatients);
    } catch (error) {
      console.error('Error loading patients:', error);
    }
  };

  const filteredPatients = patients.filter(p => {
    const searchLower = patientSearchQuery.toLowerCase();
    const fullName = `${p.first_name} ${p.last_name}`.toLowerCase();
    const hospitalNum = p.hospital_number?.toLowerCase() || '';
    return fullName.includes(searchLower) || hospitalNum.includes(searchLower);
  }).slice(0, 10); // Limit to 10 results

  const selectPatient = (patient: any) => {
    setFormData({
      ...formData,
      patient_id: patient.id?.toString() || '',
      patient_name: `${patient.first_name} ${patient.last_name}`,
      hospital_number: patient.hospital_number || ''
    });
    setPatientSearchQuery(`${patient.first_name} ${patient.last_name} (${patient.hospital_number})`);
    setShowPatientDropdown(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await labService.createLabInvestigation({
        ...formData,
        request_date: new Date(),
        tests: selectedTests,
        status: 'pending',
        urgency: formData.urgency as 'routine' | 'urgent' | 'stat'
      });

      // Reset form
      setFormData({
        patient_id: '',
        patient_name: '',
        hospital_number: '',
        requested_by: '',
        urgency: 'routine',
        clinical_indication: '',
        special_instructions: ''
      });
      setSelectedTests([]);
      setPatientSearchQuery('');
      onRefresh();
    } catch (error) {
      console.error('Error creating lab request:', error);
    }
  };

  const toggleTest = (test: LabTest) => {
    const exists = selectedTests.find(t => t.id === test.id);
    if (exists) {
      setSelectedTests(selectedTests.filter(t => t.id !== test.id));
    } else {
      setSelectedTests([...selectedTests, test]);
    }
  };

  const removeTest = (testId: string) => {
    setSelectedTests(selectedTests.filter(t => t.id !== testId));
  };

  const labCategories = labService.getLabCategories();
  const availableTests = labService.getCommonTests(selectedCategory);

  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      <div className="flex items-center space-x-3 mb-6">
        <Plus className="h-6 w-6 text-green-600" />
        <h2 className="text-xl font-semibold text-gray-900">Request Lab Investigation</h2>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Patient Search Dropdown */}
          <div className="relative">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Search Patient *
            </label>
            <div className="relative">
              <input
                type="text"
                value={patientSearchQuery}
                onChange={(e) => {
                  setPatientSearchQuery(e.target.value);
                  setShowPatientDropdown(true);
                }}
                onFocus={() => setShowPatientDropdown(true)}
                placeholder="Search by name or hospital number..."
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
                required
              />
              <Search className="absolute right-3 top-2.5 h-5 w-5 text-gray-400" />
            </div>

            {/* Patient Dropdown */}
            {showPatientDropdown && patientSearchQuery && filteredPatients.length > 0 && (
              <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg max-h-60 overflow-y-auto">
                {filteredPatients.map((patient) => (
                  <button
                    key={patient.id}
                    type="button"
                    onClick={() => selectPatient(patient)}
                    className="w-full px-4 py-2 text-left hover:bg-gray-100 transition-colors"
                  >
                    <div className="font-medium text-gray-900">
                      {patient.first_name} {patient.last_name}
                    </div>
                    <div className="text-sm text-gray-600">
                      Hospital No: {patient.hospital_number}
                    </div>
                  </button>
                ))}
              </div>
            )}

            {showPatientDropdown && patientSearchQuery && filteredPatients.length === 0 && (
              <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg p-3">
                <p className="text-sm text-gray-600">No patients found</p>
              </div>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Requested By</label>
            <input
              type="text"
              value={formData.requested_by}
              onChange={(e) => setFormData({ ...formData, requested_by: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Urgency</label>
            <select
              value={formData.urgency}
              onChange={(e) => setFormData({ ...formData, urgency: e.target.value as any })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
            >
              <option value="routine">Routine</option>
              <option value="urgent">Urgent</option>
              <option value="stat">STAT</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Test Category</label>
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value as LabCategory)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
            >
              {labCategories.map(cat => (
                <option key={cat.value} value={cat.value}>{cat.label}</option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Clinical Indication</label>
          <textarea
            value={formData.clinical_indication}
            onChange={(e) => setFormData({ ...formData, clinical_indication: e.target.value })}
            rows={3}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
            required
          />
        </div>

        {/* Checkbox Test Selection */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-3">
            Select Tests from {labCategories.find(c => c.value === selectedCategory)?.label || 'Category'} 
            <span className="text-gray-500 ml-2">({availableTests.length} tests available)</span>
          </label>
          
          {availableTests.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 p-4 bg-gray-50 rounded-lg border border-gray-200">
              {availableTests.map(test => (
                <label
                  key={test.id}
                  className={`flex items-start space-x-3 p-3 border rounded-lg cursor-pointer transition-all ${
                    selectedTests.find(t => t.id === test.id)
                      ? 'bg-green-50 border-green-500 shadow-sm'
                      : 'bg-white border-gray-200 hover:border-green-300 hover:shadow-sm'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={selectedTests.some(t => t.id === test.id)}
                    onChange={() => toggleTest(test)}
                    className="mt-1 w-4 h-4 text-green-600 border-gray-300 rounded focus:ring-green-500"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-gray-900 text-sm">{test.test_name}</div>
                    <div className="text-xs text-gray-600">{test.test_code}</div>
                    {test.fasting_required && (
                      <div className="flex items-center space-x-1 mt-1">
                        <AlertTriangle className="h-3 w-3 text-orange-600" />
                        <span className="text-xs text-orange-600">Fasting required</span>
                      </div>
                    )}
                  </div>
                </label>
              ))}
            </div>
          ) : (
            <div className="p-4 bg-gray-50 rounded-lg border border-gray-200 text-center">
              <p className="text-sm text-gray-600">No tests available in this category</p>
            </div>
          )}
        </div>

        {/* Selected Tests Summary */}
        {selectedTests.length > 0 && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Selected Tests ({selectedTests.length})
            </label>
            <div className="flex flex-wrap gap-2">
              {selectedTests.map(test => (
                <span
                  key={test.id}
                  className="flex items-center space-x-2 px-3 py-1 bg-green-100 text-green-800 rounded-full text-sm"
                >
                  <span>{test.test_name}</span>
                  <button
                    type="button"
                    onClick={() => removeTest(test.id)}
                    className="text-green-600 hover:text-green-800"
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>
          </div>
        )}

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Special Instructions</label>
          <textarea
            value={formData.special_instructions}
            onChange={(e) => setFormData({ ...formData, special_instructions: e.target.value })}
            rows={2}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
            placeholder="Any special collection or preparation instructions..."
          />
        </div>

        <div className="flex justify-end space-x-3">
          <button
            type="button"
            onClick={() => {
              setFormData({
                patient_id: '',
                patient_name: '',
                hospital_number: '',
                requested_by: '',
                urgency: 'routine',
                clinical_indication: '',
                special_instructions: ''
              });
              setSelectedTests([]);
              setPatientSearchQuery('');
            }}
            className="px-4 py-2 text-gray-700 bg-gray-200 rounded-lg hover:bg-gray-300 transition-colors"
          >
            Clear
          </button>
          <button
            type="submit"
            disabled={selectedTests.length === 0 || !formData.patient_id}
            className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50"
          >
            Submit Request
          </button>
        </div>
      </form>
    </div>
  );
};

// Result Detail Modal Component
const ResultDetailModal = ({ result, onClose }: { result: LabResult; onClose: () => void }) => {
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 max-w-3xl w-full mx-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-semibold text-gray-900">Lab Result Details</h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
          >
            <span className="sr-only">Close</span>
            ×
          </button>
        </div>

        <div className="space-y-6">
          {/* Basic Result Info */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-500">Test</label>
              <p className="text-lg font-semibold text-gray-900">{result.test_id}</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-500">Result</label>
              <p className="text-lg font-semibold text-gray-900">{result.result_value} {result.unit}</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-500">Reference Range</label>
              <p className="text-gray-900">{result.reference_range}</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-500">Flag</label>
              <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                result.abnormal_flag === 'normal' ? 'bg-green-100 text-green-800' :
                'bg-orange-100 text-orange-800'
              }`}>
                {result.abnormal_flag.replace('_', ' ').toUpperCase()}
              </span>
            </div>
          </div>

          {/* Clinical Interpretation */}
          {result.ai_interpretation && (
            <div className="border rounded-lg p-4">
              <div className="flex items-center space-x-2 mb-3">
                <Brain className="h-5 w-5 text-purple-600" />
                <h4 className="font-semibold text-gray-900">Clinical Interpretation</h4>
              </div>
              
              <div className="space-y-3">
                <div>
                  <label className="block text-sm font-medium text-gray-500">Interpretation</label>
                  <p className="text-gray-900">{result.ai_interpretation.interpretation_text}</p>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-500">Clinical Significance</label>
                  <p className="text-gray-900">{result.ai_interpretation.clinical_significance}</p>
                </div>

                {result.ai_interpretation.suggested_actions.length > 0 && (
                  <div>
                    <label className="block text-sm font-medium text-gray-500">Suggested Actions</label>
                    <ul className="list-disc list-inside text-gray-900">
                      {result.ai_interpretation.suggested_actions.map((action, index) => (
                        <li key={index}>{action}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {result.ai_interpretation.follow_up_recommendations && result.ai_interpretation.follow_up_recommendations.length > 0 && (
                  <div>
                    <label className="block text-sm font-medium text-gray-500">Follow-up Recommendations</label>
                    <ul className="list-disc list-inside text-gray-900">
                      {result.ai_interpretation.follow_up_recommendations.map((rec, index) => (
                        <li key={index}>{rec}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Comments */}
          {result.comments && (
            <div>
              <label className="block text-sm font-medium text-gray-500">Comments</label>
              <p className="text-gray-900">{result.comments}</p>
            </div>
          )}
        </div>

        <div className="flex justify-end mt-6">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

// GFR Section Component
const GFRSection = ({ 
  patientId, 
  gfrCalculations, 
  gfrTrend, 
  onRefresh 
}: { 
  patientId: string;
  gfrCalculations: GFRCalculation[];
  gfrTrend: GFRTrend | null;
  onRefresh: () => void;
}) => {
  const [showAutoCalculate, setShowAutoCalculate] = useState(false);
  const [demographics, setDemographics] = useState<PatientDemographics>({
    age: 30,
    gender: 'male',
    race: 'other'
  });

  const handleAutoCalculateGFR = async () => {
    try {
      await labService.autoGenerateGFRFromResults(patientId, demographics);
      onRefresh();
      setShowAutoCalculate(false);
    } catch (error) {
      console.error('Error auto-calculating GFR:', error);
    }
  };

  const calculateManualGFR = async (creatinine: number, unit: string) => {
    try {
      await labService.calculateGFR(patientId, creatinine, unit, demographics);
      onRefresh();
    } catch (error) {
      console.error('Error calculating GFR:', error);
    }
  };

  const getStageColor = (stage: number) => {
    const colors = {
      1: 'text-green-600',
      2: 'text-yellow-600', 
      3: 'text-orange-600',
      4: 'text-red-600',
      5: 'text-red-800'
    };
    return colors[stage as keyof typeof colors] || 'text-gray-600';
  };

  const getRiskColor = (risk: string) => {
    const colors = {
      'normal': 'text-green-600',
      'mild_decrease': 'text-yellow-600',
      'moderate_decrease': 'text-orange-600', 
      'severe_decrease': 'text-red-600',
      'kidney_failure': 'text-red-800'
    };
    return colors[risk as keyof typeof colors] || 'text-gray-600';
  };

  if (!patientId) {
    return (
      <div className="text-center py-8 text-gray-500">
        <Activity className="mx-auto h-12 w-12 mb-4" />
        <p>Please select a patient to view GFR analysis</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-xl font-semibold text-gray-900">GFR Analysis & Kidney Function</h2>
          <p className="text-gray-600">Glomerular Filtration Rate calculations and trends</p>
        </div>
        <div className="flex space-x-3">
          <button
            onClick={() => setShowAutoCalculate(true)}
            className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition-colors flex items-center space-x-2"
          >
            <Zap className="h-4 w-4" />
            <span>Auto Calculate from Results</span>
          </button>
          <button
            onClick={onRefresh}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
          >
            Refresh
          </button>
        </div>
      </div>

      {/* GFR Trend Summary */}
      {gfrTrend && gfrTrend.gfr_calculations.length > 0 && (
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <h3 className="text-lg font-medium text-gray-900 mb-4">Kidney Function Trend Summary</h3>
          
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Current Status */}
            <div className="space-y-3">
              <h4 className="font-medium text-gray-700">Current Status</h4>
              {gfrTrend.gfr_calculations.length > 0 && (
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Latest GFR:</span>
                    <span className="font-semibold">
                      {gfrTrend.gfr_calculations[gfrTrend.gfr_calculations.length - 1].gfr_value} mL/min/1.73m²
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">CKD Stage:</span>
                    <span className={`font-semibold ${getStageColor(gfrTrend.gfr_calculations[gfrTrend.gfr_calculations.length - 1].ckd_stage)}`}>
                      Stage {gfrTrend.gfr_calculations[gfrTrend.gfr_calculations.length - 1].ckd_stage}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Risk Level:</span>
                    <span className={`font-semibold ${getRiskColor(gfrTrend.gfr_calculations[gfrTrend.gfr_calculations.length - 1].risk_assessment)}`}>
                      {gfrTrend.gfr_calculations[gfrTrend.gfr_calculations.length - 1].risk_assessment.replace('_', ' ')}
                    </span>
                  </div>
                </div>
              )}
            </div>

            {/* Trend Analysis */}
            <div className="space-y-3">
              <h4 className="font-medium text-gray-700">Trend Analysis</h4>
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-gray-600">Direction:</span>
                  <span className={`font-semibold capitalize ${
                    gfrTrend.trend_direction === 'improving' ? 'text-green-600' :
                    gfrTrend.trend_direction === 'declining' ? 'text-red-600' :
                    gfrTrend.trend_direction === 'fluctuating' ? 'text-orange-600' :
                    'text-blue-600'
                  }`}>
                    {gfrTrend.trend_direction}
                  </span>
                </div>
                {gfrTrend.rate_of_decline && (
                  <div className="flex justify-between">
                    <span className="text-gray-600">Rate:</span>
                    <span className="font-semibold">
                      {gfrTrend.rate_of_decline > 0 ? '+' : ''}{gfrTrend.rate_of_decline} mL/min/1.73m²/year
                    </span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-gray-600">Risk Progression:</span>
                  <span className={`font-semibold capitalize ${getRiskColor(gfrTrend.risk_progression)}`}>
                    {gfrTrend.risk_progression.replace('_', ' ')}
                  </span>
                </div>
              </div>
            </div>

            {/* Estimates */}
            <div className="space-y-3">
              <h4 className="font-medium text-gray-700">Clinical Estimates</h4>
              <div className="space-y-2">
                {gfrTrend.time_to_dialysis_estimate && gfrTrend.time_to_dialysis_estimate > 0 && (
                  <div className="flex justify-between">
                    <span className="text-gray-600">Time to Dialysis:</span>
                    <span className="font-semibold text-red-600">
                      ~{gfrTrend.time_to_dialysis_estimate} months
                    </span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-gray-600">Measurements:</span>
                  <span className="font-semibold">
                    {gfrTrend.gfr_calculations.length} readings
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Trend Analysis Text */}
          <div className="mt-6 pt-6 border-t border-gray-200">
            <h4 className="font-medium text-gray-700 mb-2">Detailed Analysis</h4>
            <p className="text-gray-600">{gfrTrend.trend_analysis}</p>
          </div>

          {/* Recommendations */}
          {gfrTrend.follow_up_recommendations.length > 0 && (
            <div className="mt-6 pt-6 border-t border-gray-200">
              <h4 className="font-medium text-gray-700 mb-2">Follow-up Recommendations</h4>
              <ul className="list-disc list-inside text-gray-600 space-y-1">
                {gfrTrend.follow_up_recommendations.map((rec, index) => (
                  <li key={index}>{rec}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {/* GFR Calculations History */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h3 className="text-lg font-medium text-gray-900 mb-4">GFR Calculations History</h3>
        
        {gfrCalculations.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <Activity className="mx-auto h-12 w-12 mb-4" />
            <p>No GFR calculations available</p>
            <p className="text-sm">Upload creatinine results and use auto-calculate to generate GFR values</p>
          </div>
        ) : (
          <div className="space-y-4">
            {gfrCalculations.map((calc) => (
              <div key={calc.id} className="border border-gray-200 rounded-lg p-4">
                <div className="flex justify-between items-start mb-3">
                  <div>
                    <div className="flex items-center space-x-3">
                      <span className="text-lg font-semibold text-blue-600">
                        {calc.gfr_value} mL/min/1.73m²
                      </span>
                      <span className={`px-2 py-1 rounded text-sm font-medium ${getStageColor(calc.ckd_stage)}`}>
                        CKD Stage {calc.ckd_stage}
                      </span>
                      <span className={`px-2 py-1 rounded text-sm ${getRiskColor(calc.risk_assessment)}`}>
                        {calc.risk_assessment.replace('_', ' ')}
                      </span>
                    </div>
                    <p className="text-gray-600 text-sm mt-1">
                      {format(new Date(calc.calculation_date), 'PPP p')} • {calc.gfr_formula} formula
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-gray-600">Creatinine:</span> 
                    <span className="ml-2 font-medium">{calc.creatinine_value} {calc.creatinine_unit}</span>
                  </div>
                  <div>
                    <span className="text-gray-600">Demographics:</span> 
                    <span className="ml-2 font-medium">{calc.age}y, {calc.gender}, {calc.race.replace('_', ' ')}</span>
                  </div>
                </div>

                <div className="mt-3 pt-3 border-t border-gray-100">
                  <p className="text-gray-700 text-sm">{calc.clinical_interpretation}</p>
                </div>

                {calc.recommendations && calc.recommendations.length > 0 && (
                  <div className="mt-3 pt-3 border-t border-gray-100">
                    <h5 className="text-sm font-medium text-gray-700 mb-2">Recommendations:</h5>
                    <ul className="list-disc list-inside text-sm text-gray-600 space-y-1">
                      {calc.recommendations.map((rec, index) => (
                        <li key={index}>{rec}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Auto Calculate Modal */}
      {showAutoCalculate && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4">
            <div className="p-6">
              <h3 className="text-lg font-medium text-gray-900 mb-4">
                Auto Calculate GFR from Results
              </h3>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Patient Age
                  </label>
                  <input
                    type="number"
                    value={demographics.age}
                    onChange={(e) => setDemographics(prev => ({ ...prev, age: parseInt(e.target.value) || 0 }))}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2"
                    min="1"
                    max="120"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Gender
                  </label>
                  <select
                    value={demographics.gender}
                    onChange={(e) => setDemographics(prev => ({ ...prev, gender: e.target.value as 'male' | 'female' }))}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2"
                  >
                    <option value="male">Male</option>
                    <option value="female">Female</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Race/Ethnicity
                  </label>
                  <select
                    value={demographics.race}
                    onChange={(e) => setDemographics(prev => ({ ...prev, race: e.target.value as 'african_american' | 'other' }))}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2"
                  >
                    <option value="other">Other/Non-African American</option>
                    <option value="african_american">African American</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Weight (kg) - Optional for Cockcroft-Gault
                  </label>
                  <input
                    type="number"
                    value={demographics.weight || ''}
                    onChange={(e) => setDemographics(prev => ({ ...prev, weight: parseFloat(e.target.value) || undefined }))}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2"
                    step="0.1"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Height (cm) - Optional
                  </label>
                  <input
                    type="number"
                    value={demographics.height || ''}
                    onChange={(e) => setDemographics(prev => ({ ...prev, height: parseFloat(e.target.value) || undefined }))}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2"
                    step="0.1"
                  />
                </div>
              </div>

              <div className="flex space-x-3 mt-6">
                <button
                  onClick={handleAutoCalculateGFR}
                  className="flex-1 bg-green-600 text-white py-2 px-4 rounded-lg hover:bg-green-700 transition-colors"
                >
                  Calculate GFR
                </button>
                <button
                  onClick={() => setShowAutoCalculate(false)}
                  className="flex-1 bg-gray-500 text-white py-2 px-4 rounded-lg hover:bg-gray-600 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
/**
 * AI Medical Scribe Dashboard
 *
 * Standalone page for:
 * - Starting new scribe sessions (select patient, context)
 * - Viewing scribe session history with search/filter
 * - Reviewing/editing past notes
 * - Analytics: sessions per day, avg duration, top sections
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  Brain,
  Mic,
  Clock,
  Search,
  Filter,
  FileText,
  CheckCircle,
  AlertCircle,
  Trash2,
  Eye,
  ChevronDown,
  ChevronUp,
  Activity,
  User,
  Calendar,
  BarChart3,
  Loader2,
  Plus,
  X,
  Wand2,
  RefreshCw,
} from 'lucide-react';
import { format, formatDistanceToNow } from 'date-fns';
import { patientService } from '../services/patientService';
import {
  medicalScribeService,
  ScribeSession,
  ScribeContext,
  StructuredNote,
} from '../services/medicalScribeService';
import { ScribeRecordingPanel } from '../components/ScribeRecordingPanel';
import { ScribeNoteEditor } from '../components/ScribeNoteEditor';
import { useAuthStore } from '../store/authStore';

const ScribeDashboard: React.FC = () => {
  const { user } = useAuthStore();
  const [sessions, setSessions] = useState<ScribeSession[]>([]);
  const [patients, setPatients] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterContext, setFilterContext] = useState<ScribeContext | 'all'>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [showFilters, setShowFilters] = useState(false);

  // New session
  const [showNewSession, setShowNewSession] = useState(false);
  const [selectedPatientId, setSelectedPatientId] = useState('');
  const [selectedPatient, setSelectedPatient] = useState<any>(null);
  const [sessionContext, setSessionContext] = useState<ScribeContext>('ward_round');
  const [sessionRoundType, setSessionRoundType] = useState('house_officers_round');
  const [patientSearch, setPatientSearch] = useState('');

  // Recording
  const [showRecordingPanel, setShowRecordingPanel] = useState(false);

  // Note editor
  const [viewingSession, setViewingSession] = useState<ScribeSession | null>(null);

  // Analytics
  const [showAnalytics, setShowAnalytics] = useState(false);

  // ─── Load Data ──────────────────────────────────────────────────

  const loadSessions = useCallback(async () => {
    setLoading(true);
    try {
      const allSessions = await medicalScribeService.getAllSessions(200);
      setSessions(allSessions);
    } catch (err) {
      console.error('Failed to load sessions:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  const loadPatients = useCallback(async () => {
    try {
      const allPatients = await patientService.getAllPatients();
      setPatients(allPatients);
    } catch (err) {
      console.error('Failed to load patients:', err);
    }
  }, []);

  useEffect(() => {
    loadSessions();
    loadPatients();
  }, [loadSessions, loadPatients]);

  // ─── Filtered Sessions ──────────────────────────────────────────

  const filteredSessions = sessions.filter(s => {
    if (filterContext !== 'all' && s.context !== filterContext) return false;
    if (filterStatus !== 'all' && s.status !== filterStatus) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      return (
        s.patient_name?.toLowerCase().includes(q) ||
        s.hospital_number?.toLowerCase().includes(q) ||
        s.raw_transcript?.toLowerCase().includes(q) ||
        s.structured_note?.subjective?.toLowerCase().includes(q) ||
        s.structured_note?.assessment?.toLowerCase().includes(q)
      );
    }
    return true;
  });

  // ─── Patient selection for new sessions ─────────────────────────

  const filteredPatients = patientSearch
    ? patients.filter(p => {
        const q = patientSearch.toLowerCase();
        return (
          `${p.first_name} ${p.last_name}`.toLowerCase().includes(q) ||
          p.hospital_number?.toLowerCase().includes(q)
        );
      }).slice(0, 10)
    : [];

  const selectPatient = (patient: any) => {
    setSelectedPatientId(patient.id || patient.serverId);
    setSelectedPatient(patient);
    setPatientSearch('');
  };

  // ─── Start Recording ───────────────────────────────────────────

  const startScribe = () => {
    if (!selectedPatient) return;
    setShowNewSession(false);
    setShowRecordingPanel(true);
  };

  // ─── Callbacks ──────────────────────────────────────────────────

  const handleNoteReady = (note: StructuredNote, session: ScribeSession) => {
    setViewingSession(session);
    loadSessions();
  };

  const handleNoteSave = async (editedNote: StructuredNote) => {
    if (viewingSession) {
      await medicalScribeService.updateStructuredNote(viewingSession.id, editedNote);
      await medicalScribeService.finalizeSession(viewingSession.id, user?.name || 'Unknown');
      setViewingSession(null);
      loadSessions();
    }
  };

  const handleDeleteSession = async (sessionId: string) => {
    if (confirm('Delete this scribe session? This cannot be undone.')) {
      await medicalScribeService.deleteSession(sessionId);
      loadSessions();
    }
  };

  // ─── Analytics ──────────────────────────────────────────────────

  const totalSessions = sessions.length;
  const totalFinalized = sessions.filter(s => s.status === 'finalized').length;
  const avgDuration = sessions.length > 0
    ? Math.round(sessions.reduce((sum, s) => sum + (s.duration_seconds || 0), 0) / sessions.length)
    : 0;
  const avgConfidence = sessions.filter(s => s.structured_note?.confidence).length > 0
    ? Math.round(
        sessions
          .filter(s => s.structured_note?.confidence)
          .reduce((sum, s) => sum + (s.structured_note?.confidence || 0), 0) /
        sessions.filter(s => s.structured_note?.confidence).length * 100
      )
    : 0;

  // ─── Status Badge ──────────────────────────────────────────────

  const statusBadge = (status: string) => {
    const colors: Record<string, string> = {
      recording: 'bg-red-100 text-red-700',
      processing: 'bg-yellow-100 text-yellow-700',
      review: 'bg-blue-100 text-blue-700',
      finalized: 'bg-green-100 text-green-700',
      discarded: 'bg-gray-100 text-gray-500',
    };
    return (
      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${colors[status] || 'bg-gray-100 text-gray-600'}`}>
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </span>
    );
  };

  const contextLabel = (ctx: string) => {
    const labels: Record<string, string> = {
      ward_round: 'Ward Round',
      patient_review: 'Patient Review',
      consultation: 'Consultation',
      procedure_note: 'Procedure Note',
      admission: 'Admission',
    };
    return labels[ctx] || ctx;
  };

  const formatDuration = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = Math.round(seconds % 60);
    return m > 0 ? `${m}m ${s}s` : `${s}s`;
  };

  // ─── Render ─────────────────────────────────────────────────────

  return (
    <div className="max-w-7xl mx-auto p-4 sm:p-6">

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-indigo-100 rounded-xl">
            <Brain className="w-8 h-8 text-indigo-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">AI Medical Scribe</h1>
            <p className="text-sm text-gray-500">Record ward rounds & reviews — AI structures your notes</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowAnalytics(!showAnalytics)}
            className="flex items-center gap-2 px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 text-sm"
          >
            <BarChart3 className="w-4 h-4" />
            Analytics
          </button>
          <button
            onClick={() => { setShowNewSession(true); setSelectedPatient(null); setSelectedPatientId(''); }}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 text-sm font-medium shadow-sm"
          >
            <Plus className="w-4 h-4" />
            New Scribe Session
          </button>
        </div>
      </div>

      {/* Analytics Panel */}
      {showAnalytics && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
          <div className="bg-white rounded-xl border p-4">
            <div className="text-sm text-gray-500">Total Sessions</div>
            <div className="text-2xl font-bold text-gray-900">{totalSessions}</div>
          </div>
          <div className="bg-white rounded-xl border p-4">
            <div className="text-sm text-gray-500">Finalized</div>
            <div className="text-2xl font-bold text-green-600">{totalFinalized}</div>
          </div>
          <div className="bg-white rounded-xl border p-4">
            <div className="text-sm text-gray-500">Avg Duration</div>
            <div className="text-2xl font-bold text-blue-600">{formatDuration(avgDuration)}</div>
          </div>
          <div className="bg-white rounded-xl border p-4">
            <div className="text-sm text-gray-500">Avg AI Confidence</div>
            <div className="text-2xl font-bold text-indigo-600">{avgConfidence}%</div>
          </div>
        </div>
      )}

      {/* Search & Filters */}
      <div className="bg-white rounded-xl border p-4 mb-6">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by patient name, hospital number, or note content..."
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
            />
          </div>
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`flex items-center gap-2 px-4 py-2 border rounded-lg text-sm ${showFilters ? 'bg-indigo-50 border-indigo-300 text-indigo-700' : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50'}`}
          >
            <Filter className="w-4 h-4" />
            Filters
          </button>
          <button onClick={loadSessions} className="p-2 text-gray-400 hover:text-gray-600 border border-gray-300 rounded-lg">
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
        {showFilters && (
          <div className="flex flex-wrap gap-3 mt-3 pt-3 border-t">
            <div>
              <label className="text-xs text-gray-500 block mb-1">Context</label>
              <select
                value={filterContext}
                onChange={(e) => setFilterContext(e.target.value as any)}
                className="px-3 py-1.5 border border-gray-300 rounded-md text-sm"
              >
                <option value="all">All Contexts</option>
                <option value="ward_round">Ward Round</option>
                <option value="patient_review">Patient Review</option>
                <option value="consultation">Consultation</option>
                <option value="procedure_note">Procedure Note</option>
                <option value="admission">Admission</option>
              </select>
            </div>
            <div>
              <label className="text-xs text-gray-500 block mb-1">Status</label>
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="px-3 py-1.5 border border-gray-300 rounded-md text-sm"
              >
                <option value="all">All Status</option>
                <option value="review">Review</option>
                <option value="finalized">Finalized</option>
                <option value="recording">Recording</option>
                <option value="discarded">Discarded</option>
              </select>
            </div>
          </div>
        )}
      </div>

      {/* Sessions List */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 text-indigo-500 animate-spin" />
        </div>
      ) : filteredSessions.length === 0 ? (
        <div className="bg-white rounded-xl border p-12 text-center">
          <Brain className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No Scribe Sessions Yet</h3>
          <p className="text-sm text-gray-500 mb-6 max-w-md mx-auto">
            Start a new scribe session to record your ward round or patient review. 
            The AI will transcribe and structure your notes into SOAP format automatically.
          </p>
          <button
            onClick={() => { setShowNewSession(true); setSelectedPatient(null); }}
            className="inline-flex items-center gap-2 px-6 py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 font-medium"
          >
            <Mic className="w-5 h-5" />
            Start Your First Scribe Session
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredSessions.map(session => (
            <div key={session.id} className="bg-white rounded-xl border hover:shadow-md transition-shadow p-4">
              <div className="flex items-start justify-between">
                <div className="flex items-start gap-3 flex-1 min-w-0">
                  <div className={`p-2 rounded-lg flex-shrink-0 ${
                    session.status === 'finalized' ? 'bg-green-100' :
                    session.status === 'review' ? 'bg-blue-100' : 'bg-gray-100'
                  }`}>
                    {session.status === 'finalized' ? <CheckCircle className="w-5 h-5 text-green-600" /> :
                     session.status === 'review' ? <Eye className="w-5 h-5 text-blue-600" /> :
                     <FileText className="w-5 h-5 text-gray-500" />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-medium text-gray-900">{session.patient_name}</h3>
                      <span className="text-xs text-gray-400">#{session.hospital_number}</span>
                      {statusBadge(session.status)}
                      <span className="px-2 py-0.5 bg-indigo-50 text-indigo-700 rounded-full text-xs">
                        {contextLabel(session.context)}
                      </span>
                    </div>
                    <div className="flex items-center gap-4 text-xs text-gray-500 mt-1">
                      <span className="flex items-center gap-1">
                        <Calendar className="w-3 h-3" />
                        {session.created_at ? format(new Date(session.created_at), 'MMM d, yyyy HH:mm') : 'Unknown'}
                      </span>
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {formatDuration(session.duration_seconds)}
                      </span>
                      <span className="flex items-center gap-1">
                        <User className="w-3 h-3" />
                        {session.recorded_by}
                      </span>
                      {session.structured_note?.confidence !== undefined && session.structured_note.confidence > 0 && (
                        <span className="flex items-center gap-1">
                          <Wand2 className="w-3 h-3" />
                          {Math.round(session.structured_note.confidence * 100)}%
                        </span>
                      )}
                    </div>
                    {/* Preview snippet */}
                    {session.structured_note?.assessment && (
                      <p className="text-sm text-gray-600 mt-2 line-clamp-2">
                        <span className="font-medium text-yellow-700">A: </span>
                        {session.structured_note.assessment.substring(0, 150)}
                        {session.structured_note.assessment.length > 150 ? '...' : ''}
                      </p>
                    )}
                    {/* Extracted badges */}
                    {session.structured_note && (
                      <div className="flex flex-wrap gap-1 mt-2">
                        {Object.keys(session.structured_note.vitals || {}).filter(k => (session.structured_note!.vitals as any)[k] !== undefined).length > 0 && (
                          <span className="text-xs px-2 py-0.5 bg-red-50 text-red-600 rounded-full">
                            {Object.keys(session.structured_note.vitals).filter(k => (session.structured_note!.vitals as any)[k] !== undefined).length} vitals
                          </span>
                        )}
                        {(session.structured_note.medications?.length || 0) > 0 && (
                          <span className="text-xs px-2 py-0.5 bg-orange-50 text-orange-600 rounded-full">
                            {session.structured_note.medications.length} meds
                          </span>
                        )}
                        {(session.structured_note.orders?.length || 0) > 0 && (
                          <span className="text-xs px-2 py-0.5 bg-indigo-50 text-indigo-600 rounded-full">
                            {session.structured_note.orders.length} orders
                          </span>
                        )}
                        {(session.structured_note.wounds?.length || 0) > 0 && (
                          <span className="text-xs px-2 py-0.5 bg-pink-50 text-pink-600 rounded-full">
                            {session.structured_note.wounds.length} wounds
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-1 flex-shrink-0 ml-2">
                  {session.structured_note && (
                    <button
                      onClick={() => setViewingSession(session)}
                      className="p-2 text-blue-500 hover:bg-blue-50 rounded-lg"
                      title="View/Edit Note"
                    >
                      <Eye className="w-4 h-4" />
                    </button>
                  )}
                  <button
                    onClick={() => handleDeleteSession(session.id)}
                    className="p-2 text-red-400 hover:bg-red-50 rounded-lg"
                    title="Delete"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ─── New Session Modal ────────────────────────────────────── */}
      {showNewSession && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-0 sm:p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg">
            <div className="px-6 py-4 border-b flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                <Mic className="w-5 h-5 text-indigo-600" />
                New Scribe Session
              </h3>
              <button onClick={() => setShowNewSession(false)} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              {/* Patient Selection */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Patient *</label>
                {selectedPatient ? (
                  <div className="flex items-center justify-between p-3 bg-green-50 border border-green-200 rounded-lg">
                    <div>
                      <span className="font-medium text-green-900">
                        {selectedPatient.first_name} {selectedPatient.last_name}
                      </span>
                      <span className="text-sm text-green-600 ml-2">#{selectedPatient.hospital_number}</span>
                    </div>
                    <button onClick={() => { setSelectedPatient(null); setSelectedPatientId(''); }} className="text-green-400 hover:text-green-600">
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ) : (
                  <div className="relative">
                    <input
                      value={patientSearch}
                      onChange={(e) => setPatientSearch(e.target.value)}
                      placeholder="Search by patient name or hospital number..."
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg text-sm"
                    />
                    {filteredPatients.length > 0 && (
                      <div className="absolute top-full left-0 right-0 z-10 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                        {filteredPatients.map(p => (
                          <button
                            key={p.id || p.serverId}
                            onClick={() => selectPatient(p)}
                            className="w-full text-left px-4 py-2 hover:bg-gray-50 text-sm border-b last:border-b-0"
                          >
                            <span className="font-medium">{p.first_name} {p.last_name}</span>
                            <span className="text-gray-400 ml-2">#{p.hospital_number}</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Context */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Context</label>
                <select
                  value={sessionContext}
                  onChange={(e) => setSessionContext(e.target.value as ScribeContext)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg text-sm"
                >
                  <option value="ward_round">Ward Round</option>
                  <option value="patient_review">Patient Review</option>
                  <option value="consultation">Consultation</option>
                  <option value="procedure_note">Procedure Note</option>
                  <option value="admission">Admission</option>
                </select>
              </div>

              {/* Round Type (if ward_round) */}
              {sessionContext === 'ward_round' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Round Type</label>
                  <select
                    value={sessionRoundType}
                    onChange={(e) => setSessionRoundType(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg text-sm"
                  >
                    <option value="house_officers_round">House Officers Round</option>
                    <option value="registrars_round">Registrar's Round</option>
                    <option value="consultants_round">Consultant's Round</option>
                    <option value="multidisciplinary_round">MDT Round</option>
                    <option value="nursing_round">Nursing Round</option>
                  </select>
                </div>
              )}
            </div>
            <div className="px-6 py-4 border-t bg-gray-50 flex justify-end gap-3 rounded-b-xl">
              <button
                onClick={() => setShowNewSession(false)}
                className="px-4 py-2 text-gray-600 hover:text-gray-800 text-sm"
              >
                Cancel
              </button>
              <button
                onClick={startScribe}
                disabled={!selectedPatient}
                className="flex items-center gap-2 px-6 py-2.5 bg-red-600 text-white rounded-lg hover:bg-red-700 font-medium text-sm disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Mic className="w-4 h-4" />
                Start Recording
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── Recording Panel ──────────────────────────────────────── */}
      {showRecordingPanel && selectedPatient && (
        <ScribeRecordingPanel
          patientId={selectedPatientId}
          patientName={`${selectedPatient.first_name} ${selectedPatient.last_name}`}
          hospitalNumber={selectedPatient.hospital_number || ''}
          context={sessionContext}
          roundType={sessionContext === 'ward_round' ? sessionRoundType : undefined}
          recordedBy={user?.name || 'Unknown'}
          recordedByRole={user?.role || 'house_officer'}
          onNoteReady={(note, session) => {
            handleNoteReady(note, session);
            setShowRecordingPanel(false);
          }}
          onClose={() => {
            setShowRecordingPanel(false);
            loadSessions();
          }}
        />
      )}

      {/* ─── Note Editor ──────────────────────────────────────────── */}
      {viewingSession?.structured_note && (
        <ScribeNoteEditor
          note={viewingSession.structured_note}
          patientName={viewingSession.patient_name}
          onSave={handleNoteSave}
          onClose={() => setViewingSession(null)}
          showApplyButton={false}
        />
      )}
    </div>
  );
};

export default ScribeDashboard;

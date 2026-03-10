/**
 * AI Medical Scribe — Recording Panel Component
 * 
 * Floating draggable panel with:
 * - Microphone recording with live waveform
 * - Real-time transcript display
 * - Session controls (pause/resume/stop)
 * - Auto-section detection indicators
 * - Timer and confidence display
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Mic,
  MicOff,
  Square,
  Pause,
  Play,
  X,
  Minimize2,
  Maximize2,
  Loader2,
  Wand2,
  Clock,
  AlertCircle,
  CheckCircle,
  ChevronDown,
  ChevronUp,
  Activity,
  Brain,
  Volume2,
} from 'lucide-react';
import {
  medicalScribeService,
  ScribeSession,
  ScribeSessionStatus,
  ScribeContext,
  StructuredNote,
} from '../services/medicalScribeService';

interface ScribeRecordingPanelProps {
  patientId: string;
  patientName: string;
  hospitalNumber: string;
  context: ScribeContext;
  roundType?: string;
  recordedBy: string;
  recordedByRole: string;
  wardRoundId?: string;
  onNoteReady: (note: StructuredNote, session: ScribeSession) => void;
  onApplyToForm?: (formData: Record<string, any>) => void;
  onClose: () => void;
}

export const ScribeRecordingPanel: React.FC<ScribeRecordingPanelProps> = ({
  patientId,
  patientName,
  hospitalNumber,
  context,
  roundType,
  recordedBy,
  recordedByRole,
  wardRoundId,
  onNoteReady,
  onApplyToForm,
  onClose,
}) => {
  const [session, setSession] = useState<ScribeSession | null>(null);
  const [status, setStatus] = useState<ScribeSessionStatus | 'idle'>('idle');
  const [isPaused, setIsPaused] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [elapsedTime, setElapsedTime] = useState(0);
  const [liveTranscript, setLiveTranscript] = useState('');
  const [detectedSections, setDetectedSections] = useState<Set<string>>(new Set());
  const [showTranscript, setShowTranscript] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const transcriptEndRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  // ─── Timer ──────────────────────────────────────────────────────────

  useEffect(() => {
    if (status === 'recording' && !isPaused) {
      timerRef.current = setInterval(() => {
        setElapsedTime(prev => prev + 1);
      }, 1000);
    } else {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [status, isPaused]);

  // Auto-scroll transcript
  useEffect(() => {
    transcriptEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [liveTranscript]);

  // ─── Session Callbacks ──────────────────────────────────────────────

  const handleTranscriptUpdate = useCallback((updatedSession: ScribeSession) => {
    setSession({ ...updatedSession });
    setLiveTranscript(updatedSession.raw_transcript);

    // Track detected sections
    const sections = new Set<string>();
    updatedSession.transcript_segments.forEach(seg => {
      if (seg.section_hint) sections.add(seg.section_hint);
    });
    setDetectedSections(sections);
  }, []);

  const handleStatusChange = useCallback((newStatus: ScribeSessionStatus) => {
    setStatus(newStatus);
  }, []);

  // ─── Controls ───────────────────────────────────────────────────────

  const startRecording = () => {
    setError(null);
    try {
      const newSession = medicalScribeService.startSession({
        patient_id: patientId,
        patient_name: patientName,
        hospital_number: hospitalNumber,
        context,
        round_type: roundType,
        recorded_by: recordedBy,
        recorded_by_role: recordedByRole,
        ward_round_id: wardRoundId,
        onTranscriptUpdate: handleTranscriptUpdate,
        onStatusChange: handleStatusChange,
      });
      setSession(newSession);
      setStatus('recording');
      setElapsedTime(0);
      setLiveTranscript('');
      setDetectedSections(new Set());
    } catch (err: any) {
      setError(err.message || 'Failed to start recording');
    }
  };

  const pauseRecording = () => {
    medicalScribeService.pauseRecording();
    setIsPaused(true);
  };

  const resumeRecording = () => {
    medicalScribeService.resumeRecording();
    setIsPaused(false);
  };

  const stopRecording = async () => {
    setStatus('processing');
    try {
      const finalSession = await medicalScribeService.stopRecording();
      if (finalSession?.structured_note) {
        setSession(finalSession);
        setStatus('review');
        onNoteReady(finalSession.structured_note, finalSession);
      } else {
        setError('No transcript captured. Please try again.');
        setStatus('idle');
      }
    } catch (err: any) {
      setError(err.message || 'Processing failed');
      setStatus('idle');
    }
  };

  const applyToForm = () => {
    if (session?.structured_note && onApplyToForm) {
      const formData = medicalScribeService.toWardRoundFormData(session.structured_note);
      onApplyToForm(formData);
    }
  };

  const discardSession = () => {
    medicalScribeService.discardSession();
    setSession(null);
    setStatus('idle');
    setLiveTranscript('');
    setElapsedTime(0);
    onClose();
  };

  // ─── Time formatting ───────────────────────────────────────────────

  const formatTime = (seconds: number): string => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  // ─── Section badge colors ──────────────────────────────────────────

  const sectionColors: Record<string, string> = {
    subjective: 'bg-blue-100 text-blue-700',
    objective: 'bg-green-100 text-green-700',
    assessment: 'bg-yellow-100 text-yellow-700',
    plan: 'bg-purple-100 text-purple-700',
    vitals: 'bg-red-100 text-red-700',
    medications: 'bg-orange-100 text-orange-700',
    orders: 'bg-indigo-100 text-indigo-700',
    wounds: 'bg-pink-100 text-pink-700',
  };

  // ─── Render ─────────────────────────────────────────────────────────

  if (isMinimized) {
    return (
      <div className="fixed bottom-4 right-4 z-50">
        <button
          onClick={() => setIsMinimized(false)}
          className={`flex items-center gap-2 px-4 py-3 rounded-full shadow-lg text-white font-medium ${
            status === 'recording' ? 'bg-red-500 animate-pulse' : 
            status === 'processing' ? 'bg-yellow-500' : 'bg-green-600'
          }`}
        >
          {status === 'recording' && <Mic className="w-5 h-5" />}
          {status === 'processing' && <Loader2 className="w-5 h-5 animate-spin" />}
          {status === 'review' && <CheckCircle className="w-5 h-5" />}
          <span>Scribe {status === 'recording' ? formatTime(elapsedTime) : status}</span>
          <Maximize2 className="w-4 h-4" />
        </button>
      </div>
    );
  }

  return (
    <div
      ref={panelRef}
      className="fixed bottom-4 right-4 z-50 w-96 max-h-[80vh] bg-white rounded-xl shadow-2xl border border-gray-200 flex flex-col overflow-hidden"
      style={{ minWidth: '360px' }}
    >
      {/* Header */}
      <div className={`px-4 py-3 flex items-center justify-between ${
        status === 'recording' ? 'bg-red-600' :
        status === 'processing' ? 'bg-yellow-500' :
        status === 'review' ? 'bg-green-600' : 'bg-gray-800'
      } text-white`}>
        <div className="flex items-center gap-2">
          <Brain className="w-5 h-5" />
          <div>
            <div className="font-semibold text-sm">AI Medical Scribe</div>
            <div className="text-xs opacity-80">{patientName} ({hospitalNumber})</div>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <button onClick={() => setIsMinimized(true)} className="p-1 hover:bg-white/20 rounded" title="Minimize">
            <Minimize2 className="w-4 h-4" />
          </button>
          <button onClick={discardSession} className="p-1 hover:bg-white/20 rounded" title="Close">
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Status Bar */}
      {status === 'recording' && (
        <div className="px-4 py-2 bg-red-50 border-b flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse" />
            <span className="text-sm font-medium text-red-700">
              {isPaused ? 'Paused' : 'Recording'}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-red-600" />
            <span className="text-sm font-mono text-red-700">{formatTime(elapsedTime)}</span>
          </div>
        </div>
      )}

      {status === 'processing' && (
        <div className="px-4 py-3 bg-yellow-50 border-b flex items-center gap-3">
          <Loader2 className="w-5 h-5 text-yellow-600 animate-spin" />
          <div>
            <div className="text-sm font-medium text-yellow-800">Processing transcript...</div>
            <div className="text-xs text-yellow-600">AI is structuring your notes into SOAP format</div>
          </div>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="px-4 py-2 bg-red-50 border-b flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0" />
          <span className="text-sm text-red-700">{error}</span>
          <button onClick={() => setError(null)} className="ml-auto text-red-400 hover:text-red-600">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Detected Sections Badges */}
      {detectedSections.size > 0 && status === 'recording' && (
        <div className="px-4 py-2 border-b bg-gray-50 flex flex-wrap gap-1">
          <span className="text-xs text-gray-500 mr-1">Detected:</span>
          {Array.from(detectedSections).map(section => (
            <span key={section} className={`text-xs px-2 py-0.5 rounded-full font-medium ${sectionColors[section] || 'bg-gray-100 text-gray-600'}`}>
              {section.charAt(0).toUpperCase() + section.slice(1)}
            </span>
          ))}
        </div>
      )}

      {/* Transcript Area */}
      {(status === 'recording' || status === 'processing') && (
        <div className="flex-1 overflow-hidden">
          <button
            onClick={() => setShowTranscript(!showTranscript)}
            className="w-full px-4 py-2 flex items-center justify-between text-sm text-gray-600 hover:bg-gray-50"
          >
            <span className="flex items-center gap-1">
              <Volume2 className="w-4 h-4" />
              Live Transcript
            </span>
            {showTranscript ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
          {showTranscript && (
            <div className="px-4 pb-3 max-h-48 overflow-y-auto">
              {liveTranscript ? (
                <div className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">
                  {liveTranscript}
                  <div ref={transcriptEndRef} />
                </div>
              ) : (
                <div className="text-sm text-gray-400 italic text-center py-4">
                  {status === 'recording' ? 'Start speaking... Your dictation will appear here' : 'Processing...'}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Review Summary */}
      {status === 'review' && session?.structured_note && (
        <div className="flex-1 overflow-y-auto px-4 py-3 max-h-64">
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm font-medium text-green-700">
              <CheckCircle className="w-4 h-4" />
              Note structured successfully
              {session.structured_note.confidence > 0 && (
                <span className="text-xs px-2 py-0.5 bg-green-100 rounded-full">
                  {Math.round(session.structured_note.confidence * 100)}% confidence
                </span>
              )}
            </div>

            {/* Quick Preview */}
            <div className="text-xs space-y-1 mt-2">
              {session.structured_note.subjective && (
                <div><span className="font-medium text-blue-600">S:</span> {session.structured_note.subjective.substring(0, 80)}...</div>
              )}
              {session.structured_note.objective && (
                <div><span className="font-medium text-green-600">O:</span> {session.structured_note.objective.substring(0, 80)}...</div>
              )}
              {session.structured_note.assessment && (
                <div><span className="font-medium text-yellow-600">A:</span> {session.structured_note.assessment.substring(0, 80)}...</div>
              )}
              {session.structured_note.plan && (
                <div><span className="font-medium text-purple-600">P:</span> {session.structured_note.plan.substring(0, 80)}...</div>
              )}
            </div>

            {/* Extracted Data Summary */}
            <div className="flex flex-wrap gap-1 mt-2">
              {Object.keys(session.structured_note.vitals).length > 0 && (
                <span className="text-xs px-2 py-0.5 bg-red-100 text-red-700 rounded-full">
                  {Object.keys(session.structured_note.vitals).length} Vitals
                </span>
              )}
              {session.structured_note.medications.length > 0 && (
                <span className="text-xs px-2 py-0.5 bg-orange-100 text-orange-700 rounded-full">
                  {session.structured_note.medications.length} Medications
                </span>
              )}
              {session.structured_note.orders.length > 0 && (
                <span className="text-xs px-2 py-0.5 bg-indigo-100 text-indigo-700 rounded-full">
                  {session.structured_note.orders.length} Orders
                </span>
              )}
              {session.structured_note.wounds.length > 0 && (
                <span className="text-xs px-2 py-0.5 bg-pink-100 text-pink-700 rounded-full">
                  {session.structured_note.wounds.length} Wound(s)
                </span>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Idle State */}
      {status === 'idle' && (
        <div className="flex-1 px-4 py-6 text-center">
          <Activity className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <p className="text-sm text-gray-600 mb-1">Ready to record your ward round</p>
          <p className="text-xs text-gray-400">
            Speak naturally. The AI will structure your notes into SOAP format, extract vitals, medications, and orders.
          </p>
        </div>
      )}

      {/* Controls */}
      <div className="px-4 py-3 border-t bg-gray-50 flex items-center justify-center gap-3">
        {status === 'idle' && (
          <button
            onClick={startRecording}
            className="flex items-center gap-2 px-6 py-2.5 bg-red-600 text-white rounded-full hover:bg-red-700 shadow-md transition-all"
          >
            <Mic className="w-5 h-5" />
            <span className="font-medium">Start Recording</span>
          </button>
        )}

        {status === 'recording' && (
          <>
            {isPaused ? (
              <button
                onClick={resumeRecording}
                className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-full hover:bg-green-700"
              >
                <Play className="w-4 h-4" />
                Resume
              </button>
            ) : (
              <button
                onClick={pauseRecording}
                className="flex items-center gap-2 px-4 py-2 bg-yellow-500 text-white rounded-full hover:bg-yellow-600"
              >
                <Pause className="w-4 h-4" />
                Pause
              </button>
            )}
            <button
              onClick={stopRecording}
              className="flex items-center gap-2 px-4 py-2 bg-gray-800 text-white rounded-full hover:bg-gray-900"
            >
              <Square className="w-4 h-4" />
              Stop & Process
            </button>
          </>
        )}

        {status === 'review' && (
          <>
            {onApplyToForm && (
              <button
                onClick={applyToForm}
                className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
              >
                <Wand2 className="w-4 h-4" />
                Apply to Form
              </button>
            )}
            <button
              onClick={() => { setStatus('idle'); setSession(null); }}
              className="flex items-center gap-2 px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300"
            >
              <Mic className="w-4 h-4" />
              New Recording
            </button>
          </>
        )}
      </div>
    </div>
  );
};

export default ScribeRecordingPanel;

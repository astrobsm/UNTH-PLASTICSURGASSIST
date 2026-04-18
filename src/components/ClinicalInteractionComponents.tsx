/**
 * Reusable clinical interaction components:
 * - DocumenterLink: Clickable name that opens WhatsApp with patient context
 * - ConsultantCommentSection: Collapsible comment/feedback field for consultants
 * - RecommendationsPanel: Auto-generated multi-specialty recommendations display
 */
import React, { useState, useCallback, useEffect } from 'react';
import { useAuthStore } from '../store/authStore';
import { MessageCircle, Send, ChevronDown, ChevronUp, AlertTriangle, AlertCircle, Info, ShieldAlert, Stethoscope } from 'lucide-react';
import {
  lookupUserPhone,
  openWhatsAppForPatient,
  saveConsultantComment,
  loadConsultantComments,
  type ConsultantComment,
  type ClinicalRecommendation,
  getRecommendationSeverityColor,
} from '../utils/clinicalUtils';

// ─── DocumenterLink ──────────────────────────────────────────────────────────

interface DocumenterLinkProps {
  authorName: string;
  authorRole?: string;
  patientName: string;
  patientHospitalNumber?: string;
  context?: string; // e.g. "Progress Note from 15/01/2025"
}

export const DocumenterLink: React.FC<DocumenterLinkProps> = ({
  authorName,
  authorRole,
  patientName,
  patientHospitalNumber,
  context,
}) => {
  const [loading, setLoading] = useState(false);

  const handleClick = useCallback(async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!authorName || authorName === 'Unknown') return;
    setLoading(true);
    try {
      const phone = await lookupUserPhone(authorName);
      if (phone) {
        openWhatsAppForPatient(phone, patientName, patientHospitalNumber, context);
      } else {
        alert(`No phone number found for ${authorName}. Please ensure their phone number is registered in the system.`);
      }
    } catch {
      alert('Failed to lookup contact information. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [authorName, patientName, patientHospitalNumber, context]);

  if (!authorName || authorName === 'Unknown') {
    return <span className="text-gray-400">Unknown</span>;
  }

  return (
    <button
      onClick={handleClick}
      disabled={loading}
      className="inline-flex items-center gap-1 text-green-700 hover:text-green-900 hover:underline cursor-pointer font-medium transition-colors disabled:opacity-50"
      title={`Send WhatsApp message to ${authorName} about ${patientName}`}
    >
      <MessageCircle className="w-3 h-3" />
      <span>{authorName}</span>
      {authorRole && <span className="text-gray-400 font-normal">({authorRole})</span>}
      {loading && <span className="animate-spin ml-1 text-xs">⏳</span>}
    </button>
  );
};


// ─── ConsultantCommentSection ────────────────────────────────────────────────

interface ConsultantCommentSectionProps {
  entityType: ConsultantComment['entity_type'];
  entityId: string;
  patientName?: string;
}

export const ConsultantCommentSection: React.FC<ConsultantCommentSectionProps> = ({
  entityType,
  entityId,
  patientName,
}) => {
  const { user } = useAuthStore();
  const [expanded, setExpanded] = useState(false);
  const [comments, setComments] = useState<ConsultantComment[]>([]);
  const [newComment, setNewComment] = useState('');
  const [saving, setSaving] = useState(false);
  const [loaded, setLoaded] = useState(false);

  const canComment = user?.role === 'consultant' || user?.role === 'senior_registrar' || user?.role === 'admin';

  const fetchComments = useCallback(async () => {
    if (loaded) return;
    try {
      const data = await loadConsultantComments(entityType, entityId);
      setComments(data);
      setLoaded(true);
    } catch {
      setLoaded(true);
    }
  }, [entityType, entityId, loaded]);

  useEffect(() => {
    if (expanded && !loaded) {
      fetchComments();
    }
  }, [expanded, loaded, fetchComments]);

  const handleSubmit = async () => {
    if (!newComment.trim() || !user) return;
    setSaving(true);
    try {
      const comment = await saveConsultantComment({
        entity_type: entityType,
        entity_id: entityId,
        comment: newComment.trim(),
        author_name: user.name || user.full_name || 'Unknown',
        author_role: user.role || 'consultant',
      });
      setComments(prev => [comment, ...prev]);
      setNewComment('');
    } catch {
      alert('Failed to save comment');
    } finally {
      setSaving(false);
    }
  };

  const roleColor = (role: string) => {
    if (role === 'consultant') return 'text-purple-700 bg-purple-50';
    if (role === 'senior_registrar') return 'text-blue-700 bg-blue-50';
    return 'text-gray-700 bg-gray-50';
  };

  return (
    <div className="mt-2 border-t border-gray-100 pt-1">
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-1 text-xs text-purple-600 hover:text-purple-800 font-medium"
      >
        {expanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
        Consultant Comments {comments.length > 0 && `(${comments.length})`}
      </button>

      {expanded && (
        <div className="mt-2 space-y-2">
          {/* Existing comments */}
          {comments.map(c => (
            <div key={c.id} className="bg-purple-50 border border-purple-100 rounded-lg p-2">
              <p className="text-sm text-gray-800">{c.comment}</p>
              <div className="flex items-center gap-2 mt-1 text-[10px]">
                <span className={`px-1.5 py-0.5 rounded-full font-medium ${roleColor(c.author_role)}`}>
                  {c.author_name} ({c.author_role.replace('_', ' ')})
                </span>
                <span className="text-gray-400">
                  {new Date(c.created_at).toLocaleDateString()} {new Date(c.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
            </div>
          ))}

          {/* Comment input - only for consultants & senior registrars */}
          {canComment ? (
            <div className="flex items-start gap-2">
              <textarea
                value={newComment}
                onChange={e => setNewComment(e.target.value)}
                placeholder={`Add consultant comment${patientName ? ` for ${patientName}` : ''}...`}
                rows={2}
                className="flex-1 px-2 py-1.5 border border-purple-200 rounded-md text-sm focus:ring-purple-500 focus:border-purple-500 resize-none"
              />
              <button
                onClick={handleSubmit}
                disabled={saving || !newComment.trim()}
                className="px-3 py-1.5 bg-purple-600 text-white rounded-md hover:bg-purple-700 disabled:opacity-50 flex items-center gap-1 text-sm"
              >
                <Send className="w-3 h-3" />
                {saving ? '...' : 'Post'}
              </button>
            </div>
          ) : (
            <p className="text-[10px] text-gray-400 italic">Only consultants and senior registrars can add comments.</p>
          )}
        </div>
      )}
    </div>
  );
};


// ─── RecommendationsPanel ────────────────────────────────────────────────────

interface RecommendationsPanelProps {
  recommendations: ClinicalRecommendation[];
  title?: string;
  collapsible?: boolean;
  defaultExpanded?: boolean;
}

export const RecommendationsPanel: React.FC<RecommendationsPanelProps> = ({
  recommendations,
  title = 'Multi-Specialty Recommendations',
  collapsible = true,
  defaultExpanded = true,
}) => {
  const [expanded, setExpanded] = useState(defaultExpanded);

  if (recommendations.length === 0) return null;

  // Sort by severity
  const severityOrder: Record<string, number> = { critical: 0, urgent: 1, routine: 2, info: 3 };
  const sorted = [...recommendations].sort((a, b) => (severityOrder[a.severity] || 3) - (severityOrder[b.severity] || 3));

  const criticalCount = sorted.filter(r => r.severity === 'critical').length;
  const urgentCount = sorted.filter(r => r.severity === 'urgent').length;

  const SeverityIcon = ({ severity }: { severity: string }) => {
    switch (severity) {
      case 'critical': return <ShieldAlert className="w-4 h-4 text-red-600 flex-shrink-0" />;
      case 'urgent': return <AlertTriangle className="w-4 h-4 text-orange-600 flex-shrink-0" />;
      case 'routine': return <AlertCircle className="w-4 h-4 text-blue-600 flex-shrink-0" />;
      default: return <Info className="w-4 h-4 text-gray-600 flex-shrink-0" />;
    }
  };

  return (
    <div className="bg-white rounded-lg border border-indigo-200 overflow-hidden">
      {/* Header */}
      <button
        onClick={() => collapsible && setExpanded(!expanded)}
        className="w-full flex items-center justify-between px-4 py-3 bg-indigo-50 hover:bg-indigo-100 transition-colors"
      >
        <div className="flex items-center gap-2">
          <Stethoscope className="w-5 h-5 text-indigo-700" />
          <span className="font-semibold text-indigo-900 text-sm">{title}</span>
          <span className="text-xs text-indigo-600">({sorted.length} recommendations)</span>
        </div>
        <div className="flex items-center gap-2">
          {criticalCount > 0 && (
            <span className="px-2 py-0.5 bg-red-600 text-white text-[10px] rounded-full font-bold">
              {criticalCount} CRITICAL
            </span>
          )}
          {urgentCount > 0 && (
            <span className="px-2 py-0.5 bg-orange-500 text-white text-[10px] rounded-full font-bold">
              {urgentCount} URGENT
            </span>
          )}
          {collapsible && (expanded ? <ChevronUp className="w-4 h-4 text-indigo-500" /> : <ChevronDown className="w-4 h-4 text-indigo-500" />)}
        </div>
      </button>

      {/* Recommendations list */}
      {expanded && (
        <div className="divide-y divide-gray-100 max-h-[60vh] overflow-y-auto">
          {sorted.map((rec, i) => {
            const colors = getRecommendationSeverityColor(rec.severity);
            return (
              <div key={i} className={`p-3 ${colors.bg}`}>
                <div className="flex items-start gap-2">
                  <SeverityIcon severity={rec.severity} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${colors.badge}`}>
                        {rec.severity}
                      </span>
                      <span className="text-xs font-bold text-gray-800">{rec.specialty}</span>
                    </div>
                    <p className={`text-sm font-medium ${colors.text}`}>{rec.recommendation}</p>
                    <p className="text-xs text-gray-500 mt-1 italic">{rec.rationale}</p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

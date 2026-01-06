import React, { useState, useEffect } from 'react';
import { 
  CheckCircle, XCircle, Clock, AlertTriangle, 
  User, Calendar, Pill, TestTube, Activity, 
  FileText, ChevronDown, ChevronUp, Filter
} from 'lucide-react';
import { useAuthStore } from '../store/authStore';
import { 
  treatmentPlanningService, 
  TreatmentPlanModification 
} from '../services/treatmentPlanningService';
import { format } from 'date-fns';

interface PendingModificationsApprovalProps {
  planId?: string; // If provided, only show modifications for this plan
  onApprovalComplete?: () => void;
}

export const PendingModificationsApproval: React.FC<PendingModificationsApprovalProps> = ({
  planId,
  onApprovalComplete
}) => {
  const { user } = useAuthStore();
  const [modifications, setModifications] = useState<TreatmentPlanModification[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | 'emergency' | 'urgent' | 'routine'>('all');
  const [approvalComments, setApprovalComments] = useState<{ [key: string]: string }>({});
  const [processingId, setProcessingId] = useState<string | null>(null);

  const canApprove = user?.role === 'consultant' || user?.role === 'admin';

  useEffect(() => {
    loadModifications();
  }, [planId]);

  const loadModifications = async () => {
    setLoading(true);
    try {
      let mods: TreatmentPlanModification[];
      if (planId) {
        mods = await treatmentPlanningService.getPendingModifications(planId);
      } else {
        mods = await treatmentPlanningService.getAllPendingModifications();
      }
      setModifications(mods);
    } catch (error) {
      console.error('Error loading modifications:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (mod: TreatmentPlanModification) => {
    if (!canApprove) return;
    
    setProcessingId(mod.id);
    try {
      await treatmentPlanningService.approveModification(
        mod.plan_id,
        mod.id,
        user?.name || user?.email || 'Unknown',
        user?.role || 'consultant',
        approvalComments[mod.id]
      );
      await loadModifications();
      onApprovalComplete?.();
    } catch (error) {
      console.error('Error approving modification:', error);
      alert('Failed to approve modification');
    } finally {
      setProcessingId(null);
    }
  };

  const handleReject = async (mod: TreatmentPlanModification) => {
    if (!canApprove) return;
    
    const comments = approvalComments[mod.id];
    if (!comments?.trim()) {
      alert('Please provide a reason for rejection');
      return;
    }

    setProcessingId(mod.id);
    try {
      await treatmentPlanningService.rejectModification(
        mod.plan_id,
        mod.id,
        user?.name || user?.email || 'Unknown',
        user?.role || 'consultant',
        comments
      );
      await loadModifications();
      onApprovalComplete?.();
    } catch (error) {
      console.error('Error rejecting modification:', error);
      alert('Failed to reject modification');
    } finally {
      setProcessingId(null);
    }
  };

  const getTypeIcon = (type: TreatmentPlanModification['modification_type']) => {
    switch (type) {
      case 'medication': return <Pill className="w-5 h-5 text-purple-500" />;
      case 'investigation': return <TestTube className="w-5 h-5 text-blue-500" />;
      case 'procedure': return <Activity className="w-5 h-5 text-green-500" />;
      default: return <FileText className="w-5 h-5 text-gray-500" />;
    }
  };

  const getPriorityBadge = (priority: TreatmentPlanModification['priority']) => {
    switch (priority) {
      case 'emergency':
        return (
          <span className="px-2 py-1 bg-red-100 text-red-700 text-xs font-semibold rounded-full flex items-center">
            <AlertTriangle className="w-3 h-3 mr-1" />
            EMERGENCY
          </span>
        );
      case 'urgent':
        return (
          <span className="px-2 py-1 bg-orange-100 text-orange-700 text-xs font-semibold rounded-full flex items-center">
            <AlertTriangle className="w-3 h-3 mr-1" />
            URGENT
          </span>
        );
      default:
        return (
          <span className="px-2 py-1 bg-gray-100 text-gray-600 text-xs font-medium rounded-full">
            Routine
          </span>
        );
    }
  };

  const getSourceBadge = (source: TreatmentPlanModification['source']) => {
    switch (source) {
      case 'ward_round':
        return <span className="px-2 py-1 bg-blue-100 text-blue-700 text-xs font-medium rounded">Ward Round</span>;
      case 'mdt_review':
        return <span className="px-2 py-1 bg-purple-100 text-purple-700 text-xs font-medium rounded">MDT Review</span>;
      default:
        return <span className="px-2 py-1 bg-gray-100 text-gray-600 text-xs font-medium rounded">Direct Edit</span>;
    }
  };

  const filteredMods = filter === 'all' 
    ? modifications 
    : modifications.filter(m => m.priority === filter);

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Clock className="w-6 h-6 text-gray-400 animate-spin mr-2" />
        <span className="text-gray-500">Loading pending modifications...</span>
      </div>
    );
  }

  if (!canApprove) {
    return (
      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 text-yellow-800">
        <AlertTriangle className="w-5 h-5 inline mr-2" />
        Only consultants can approve or reject treatment plan modifications.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-bold text-gray-900 flex items-center">
          <Clock className="w-6 h-6 mr-2 text-orange-500" />
          Pending Modifications ({modifications.length})
        </h2>
        
        {/* Filter */}
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-gray-500" />
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value as any)}
            className="px-3 py-1.5 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-green-500"
          >
            <option value="all">All Priorities</option>
            <option value="emergency">Emergency Only</option>
            <option value="urgent">Urgent Only</option>
            <option value="routine">Routine Only</option>
          </select>
        </div>
      </div>

      {filteredMods.length === 0 ? (
        <div className="bg-green-50 border border-green-200 rounded-lg p-6 text-center">
          <CheckCircle className="w-12 h-12 text-green-500 mx-auto mb-3" />
          <p className="text-green-700 font-medium">No pending modifications</p>
          <p className="text-green-600 text-sm">All treatment plan changes have been reviewed</p>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredMods.map((mod) => (
            <div 
              key={mod.id}
              className={`bg-white rounded-lg border-2 shadow-sm overflow-hidden ${
                mod.priority === 'emergency' ? 'border-red-300' :
                mod.priority === 'urgent' ? 'border-orange-300' : 'border-gray-200'
              }`}
            >
              {/* Header */}
              <div 
                className={`p-4 cursor-pointer ${
                  mod.priority === 'emergency' ? 'bg-red-50' :
                  mod.priority === 'urgent' ? 'bg-orange-50' : 'bg-gray-50'
                }`}
                onClick={() => setExpandedId(expandedId === mod.id ? null : mod.id)}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    {getTypeIcon(mod.modification_type)}
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-gray-900 capitalize">
                          {mod.modification_action} {mod.modification_type}
                        </span>
                        {getPriorityBadge(mod.priority)}
                        {getSourceBadge(mod.source)}
                      </div>
                      <p className="text-sm text-gray-600">
                        {mod.patient_name} • Requested by {mod.requested_by} ({mod.requested_by_role.replace('_', ' ')})
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-sm text-gray-500">
                      {format(new Date(mod.requested_at), 'dd MMM yyyy HH:mm')}
                    </span>
                    {expandedId === mod.id ? (
                      <ChevronUp className="w-5 h-5 text-gray-400" />
                    ) : (
                      <ChevronDown className="w-5 h-5 text-gray-400" />
                    )}
                  </div>
                </div>
              </div>

              {/* Expanded Content */}
              {expandedId === mod.id && (
                <div className="p-4 border-t border-gray-200 space-y-4">
                  {/* Reason */}
                  <div className="bg-blue-50 p-3 rounded-lg">
                    <h4 className="font-medium text-blue-800 mb-1">Reason for Modification</h4>
                    <p className="text-blue-700">{mod.reason}</p>
                    {mod.clinical_justification && (
                      <p className="text-blue-600 text-sm mt-1">{mod.clinical_justification}</p>
                    )}
                  </div>

                  {/* Proposed Changes */}
                  <div className="grid grid-cols-2 gap-4">
                    {mod.original_value && (
                      <div className="bg-red-50 p-3 rounded-lg">
                        <h4 className="font-medium text-red-800 mb-2">Original</h4>
                        <pre className="text-sm text-red-700 whitespace-pre-wrap overflow-auto max-h-40">
                          {JSON.stringify(mod.original_value, null, 2)}
                        </pre>
                      </div>
                    )}
                    <div className={`bg-green-50 p-3 rounded-lg ${!mod.original_value ? 'col-span-2' : ''}`}>
                      <h4 className="font-medium text-green-800 mb-2">Proposed</h4>
                      <pre className="text-sm text-green-700 whitespace-pre-wrap overflow-auto max-h-40">
                        {JSON.stringify(mod.proposed_value, null, 2)}
                      </pre>
                    </div>
                  </div>

                  {/* MDT/Specialty Info */}
                  {mod.specialty_input && (
                    <div className="bg-purple-50 p-3 rounded-lg">
                      <h4 className="font-medium text-purple-800 mb-1">MDT Specialty Input</h4>
                      <p className="text-purple-700">From: {mod.specialty_input}</p>
                    </div>
                  )}

                  {/* Comments Input */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Comments (required for rejection)
                    </label>
                    <textarea
                      value={approvalComments[mod.id] || ''}
                      onChange={(e) => setApprovalComments({
                        ...approvalComments,
                        [mod.id]: e.target.value
                      })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-green-500"
                      rows={2}
                      placeholder="Add your comments..."
                    />
                  </div>

                  {/* Action Buttons */}
                  <div className="flex justify-end gap-3">
                    <button
                      onClick={() => handleReject(mod)}
                      disabled={processingId === mod.id}
                      className="flex items-center px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 transition-colors"
                    >
                      <XCircle className="w-4 h-4 mr-2" />
                      Reject
                    </button>
                    <button
                      onClick={() => handleApprove(mod)}
                      disabled={processingId === mod.id}
                      className="flex items-center px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 transition-colors"
                    >
                      <CheckCircle className="w-4 h-4 mr-2" />
                      Approve & Apply
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default PendingModificationsApproval;

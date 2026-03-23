import React, { useState, useEffect, useCallback } from 'react';
import {
  ClipboardList,
  Search,
  Filter,
  RefreshCw,
  Clock,
  AlertTriangle,
  AlertCircle,
  CheckCircle,
  Phone,
  MapPin,
  User,
  ChevronDown,
  ChevronUp,
  X,
  Activity,
  BedDouble,
  ExternalLink,
} from 'lucide-react';
// Direct fetch from external PS Consult system (public API with CORS *)
const CONSULT_API = 'https://ps-consult-unth.vercel.app/api/consults';

// ── Types ───────────────────────────────────────────────────────

interface ConsultCreator {
  id: number;
  full_name: string;
  role: string;
  unit?: string;
}

interface Consult {
  id: number;
  consult_id: string;
  patient_name: string;
  hospital_number: string;
  age: number;
  sex: string;
  ward: string;
  bed_number: string;
  date_of_admission: string;
  primary_diagnosis: string;
  indication: string;
  indication_category?: string;
  urgency: string;
  inviting_unit: string;
  consultant_in_charge: string;
  requesting_doctor: string;
  designation: string;
  phone_number: string;
  alternate_phone?: string;
  status: string;
  notification_sent: boolean;
  acknowledged_by?: number;
  acknowledged_at?: string;
  accepted_by?: number;
  accepted_at?: string;
  created_by?: number;
  created_at: string;
  updated_at?: string;
  reviewed_at?: string;
  completed_at?: string;
  creator?: ConsultCreator;
}

interface ConsultsResponse {
  total: number;
  page: number;
  per_page: number;
  consults: Consult[];
}

// ── Constants ───────────────────────────────────────────────────

const URGENCY_CONFIG: Record<string, { label: string; color: string; icon: typeof AlertCircle }> = {
  emergency: { label: 'Emergency', color: 'bg-red-100 text-red-800 border-red-300', icon: AlertCircle },
  urgent: { label: 'Urgent', color: 'bg-orange-100 text-orange-800 border-orange-300', icon: AlertTriangle },
  routine: { label: 'Routine', color: 'bg-blue-100 text-blue-800 border-blue-300', icon: Clock },
};

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  pending: { label: 'Pending', color: 'bg-yellow-100 text-yellow-800' },
  accepted: { label: 'Accepted', color: 'bg-blue-100 text-blue-800' },
  on_the_way: { label: 'On the Way', color: 'bg-indigo-100 text-indigo-800' },
  reviewed: { label: 'Reviewed', color: 'bg-purple-100 text-purple-800' },
  procedure_planned: { label: 'Procedure Planned', color: 'bg-cyan-100 text-cyan-800' },
  completed: { label: 'Completed', color: 'bg-green-100 text-green-800' },
  cancelled: { label: 'Cancelled', color: 'bg-gray-100 text-gray-600' },
};

// ── Component ───────────────────────────────────────────────────

export default function ConsultsPage() {
  const [consults, setConsults] = useState<Consult[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [perPage] = useState(20);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [urgencyFilter, setUrgencyFilter] = useState('');
  const [showFilters, setShowFilters] = useState(false);

  // Expanded consult detail
  const [expandedId, setExpandedId] = useState<number | null>(null);

  const fetchConsults = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      params.set('page', String(page));
      params.set('per_page', String(perPage));
      if (searchQuery.trim()) params.set('search', searchQuery.trim());
      if (statusFilter) params.set('status', statusFilter);
      if (urgencyFilter) params.set('urgency', urgencyFilter);

      const response = await fetch(`${CONSULT_API}/public-list?${params.toString()}`);
      if (!response.ok) {
        throw new Error(`Failed to fetch consults (${response.status})`);
      }
      const data: ConsultsResponse = await response.json();
      setConsults(data.consults);
      setTotal(data.total);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch consults');
    } finally {
      setLoading(false);
    }
  }, [page, perPage, searchQuery, statusFilter, urgencyFilter]);

  useEffect(() => {
    fetchConsults();
  }, [fetchConsults]);

  // Debounced search
  const [debouncedSearch, setDebouncedSearch] = useState('');
  useEffect(() => {
    const timer = setTimeout(() => {
      setSearchQuery(debouncedSearch);
      setPage(1);
    }, 400);
    return () => clearTimeout(timer);
  }, [debouncedSearch]);

  const totalPages = Math.ceil(total / perPage);

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  };

  const formatDateTime = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleString('en-GB', {
      day: '2-digit', month: 'short', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });
  };

  const timeSince = (dateStr: string) => {
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    const days = Math.floor(hrs / 24);
    return `${days}d ago`;
  };

  const clearFilters = () => {
    setDebouncedSearch('');
    setSearchQuery('');
    setStatusFilter('');
    setUrgencyFilter('');
    setPage(1);
  };

  const hasActiveFilters = searchQuery || statusFilter || urgencyFilter;

  return (
    <div className="max-w-6xl mx-auto px-4 py-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <ClipboardList className="w-8 h-8 text-green-600" />
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Consults Received</h1>
            <p className="text-sm text-gray-500">
              {total} consult{total !== 1 ? 's' : ''} from PS Consult system
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <a
            href="https://ps-consult-unth.vercel.app"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 text-sm text-green-600 hover:text-green-700"
          >
            <ExternalLink className="w-4 h-4" />
            <span className="hidden sm:inline">Open Consult App</span>
          </a>
          <button
            onClick={fetchConsults}
            disabled={loading}
            className="p-2 rounded-lg border border-gray-300 hover:bg-gray-100 disabled:opacity-50"
            title="Refresh"
          >
            <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Search & Filters */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 mb-4">
        <div className="flex items-center gap-3">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search by patient name, hospital number, or consult ID..."
              value={debouncedSearch}
              onChange={e => setDebouncedSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 text-sm"
            />
          </div>
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`flex items-center gap-1 px-3 py-2 rounded-lg border text-sm ${
              hasActiveFilters ? 'border-green-500 text-green-700 bg-green-50' : 'border-gray-300 text-gray-700 hover:bg-gray-50'
            }`}
          >
            <Filter className="w-4 h-4" />
            Filters
          </button>
          {hasActiveFilters && (
            <button onClick={clearFilters} className="text-sm text-gray-500 hover:text-gray-700">
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {showFilters && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-3 pt-3 border-t border-gray-100">
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Status</label>
              <select
                value={statusFilter}
                onChange={e => { setStatusFilter(e.target.value); setPage(1); }}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-green-500"
              >
                <option value="">All Statuses</option>
                {Object.entries(STATUS_CONFIG).map(([key, cfg]) => (
                  <option key={key} value={key}>{cfg.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Urgency</label>
              <select
                value={urgencyFilter}
                onChange={e => { setUrgencyFilter(e.target.value); setPage(1); }}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-green-500"
              >
                <option value="">All Urgencies</option>
                <option value="emergency">Emergency</option>
                <option value="urgent">Urgent</option>
                <option value="routine">Routine</option>
              </select>
            </div>
          </div>
        )}
      </div>

      {/* Urgency Summary Cards */}
      {!loading && consults.length > 0 && (
        <div className="grid grid-cols-3 gap-3 mb-4">
          {(['emergency', 'urgent', 'routine'] as const).map(urg => {
            const count = consults.filter(c => c.urgency === urg).length;
            const cfg = URGENCY_CONFIG[urg];
            const Icon = cfg.icon;
            return (
              <button
                key={urg}
                onClick={() => {
                  setUrgencyFilter(urgencyFilter === urg ? '' : urg);
                  setPage(1);
                }}
                className={`flex items-center gap-2 p-3 rounded-lg border transition-all ${
                  urgencyFilter === urg ? cfg.color + ' border-2' : 'bg-white border-gray-200 hover:bg-gray-50'
                }`}
              >
                <Icon className="w-5 h-5" />
                <div className="text-left">
                  <div className="text-lg font-bold">{count}</div>
                  <div className="text-xs">{cfg.label}</div>
                </div>
              </button>
            );
          })}
        </div>
      )}

      {/* Error State */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-4">
          <div className="flex items-center gap-2 text-red-700">
            <AlertCircle className="w-5 h-5" />
            <span className="font-medium">Error loading consults</span>
          </div>
          <p className="text-sm text-red-600 mt-1">{error}</p>
          <button
            onClick={fetchConsults}
            className="mt-2 text-sm text-red-700 underline hover:text-red-800"
          >
            Try again
          </button>
        </div>
      )}

      {/* Loading State */}
      {loading && (
        <div className="flex items-center justify-center py-20">
          <RefreshCw className="w-8 h-8 text-green-600 animate-spin" />
        </div>
      )}

      {/* Empty State */}
      {!loading && consults.length === 0 && !error && (
        <div className="text-center py-20 bg-white rounded-xl border border-gray-200">
          <ClipboardList className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <h3 className="text-lg font-medium text-gray-900 mb-1">No consults found</h3>
          <p className="text-sm text-gray-500">
            {hasActiveFilters
              ? 'Try adjusting your filters.'
              : 'Consult requests from other units will appear here.'}
          </p>
        </div>
      )}

      {/* Consult Cards */}
      {!loading && consults.length > 0 && (
        <div className="space-y-3">
          {consults.map(consult => {
            const urgCfg = URGENCY_CONFIG[consult.urgency] || URGENCY_CONFIG.routine;
            const statusCfg = STATUS_CONFIG[consult.status] || STATUS_CONFIG.pending;
            const UrgIcon = urgCfg.icon;
            const isExpanded = expandedId === consult.id;

            return (
              <div
                key={consult.id}
                className={`bg-white rounded-xl border transition-all ${
                  consult.urgency === 'emergency'
                    ? 'border-red-300 shadow-md'
                    : consult.urgency === 'urgent'
                    ? 'border-orange-200 shadow-sm'
                    : 'border-gray-200 shadow-sm'
                }`}
              >
                {/* Card Header */}
                <button
                  onClick={() => setExpandedId(isExpanded ? null : consult.id)}
                  className="w-full text-left p-4"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-mono text-xs text-gray-400">{consult.consult_id}</span>
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border ${urgCfg.color}`}>
                          <UrgIcon className="w-3 h-3" />
                          {urgCfg.label}
                        </span>
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${statusCfg.color}`}>
                          {statusCfg.label}
                        </span>
                      </div>
                      <h3 className="text-base font-semibold text-gray-900 truncate">
                        {consult.patient_name}
                      </h3>
                      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-1 text-sm text-gray-500">
                        <span>{consult.age}yr {consult.sex}</span>
                        <span className="flex items-center gap-1">
                          <MapPin className="w-3.5 h-3.5" />
                          {consult.ward} — Bed {consult.bed_number}
                        </span>
                        <span className="flex items-center gap-1">
                          <Activity className="w-3.5 h-3.5" />
                          {consult.inviting_unit}
                        </span>
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-1 shrink-0">
                      <span className="text-xs text-gray-400">{timeSince(consult.created_at)}</span>
                      {isExpanded
                        ? <ChevronUp className="w-5 h-5 text-gray-400" />
                        : <ChevronDown className="w-5 h-5 text-gray-400" />
                      }
                    </div>
                  </div>
                  {/* Diagnosis preview */}
                  <p className="text-sm text-gray-600 mt-2 line-clamp-1">
                    <span className="font-medium">Dx:</span> {consult.primary_diagnosis}
                  </p>
                </button>

                {/* Expanded Detail */}
                {isExpanded && (
                  <div className="border-t border-gray-100 px-4 pb-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                      {/* Patient Info */}
                      <div className="space-y-2">
                        <h4 className="text-sm font-semibold text-gray-700 flex items-center gap-1">
                          <User className="w-4 h-4" /> Patient Information
                        </h4>
                        <dl className="text-sm space-y-1">
                          <div className="flex justify-between">
                            <dt className="text-gray-500">Hospital No.</dt>
                            <dd className="font-medium text-gray-900">{consult.hospital_number}</dd>
                          </div>
                          <div className="flex justify-between">
                            <dt className="text-gray-500">Age / Sex</dt>
                            <dd className="font-medium text-gray-900">{consult.age} years / {consult.sex}</dd>
                          </div>
                          <div className="flex justify-between">
                            <dt className="text-gray-500">Ward / Bed</dt>
                            <dd className="font-medium text-gray-900">{consult.ward} — Bed {consult.bed_number}</dd>
                          </div>
                          <div className="flex justify-between">
                            <dt className="text-gray-500">Date of Admission</dt>
                            <dd className="font-medium text-gray-900">{formatDate(consult.date_of_admission)}</dd>
                          </div>
                        </dl>
                      </div>

                      {/* Clinical Info */}
                      <div className="space-y-2">
                        <h4 className="text-sm font-semibold text-gray-700 flex items-center gap-1">
                          <Activity className="w-4 h-4" /> Clinical Details
                        </h4>
                        <dl className="text-sm space-y-1">
                          <div>
                            <dt className="text-gray-500">Primary Diagnosis</dt>
                            <dd className="font-medium text-gray-900">{consult.primary_diagnosis}</dd>
                          </div>
                          <div>
                            <dt className="text-gray-500">Indication for Consult</dt>
                            <dd className="font-medium text-gray-900">{consult.indication}</dd>
                          </div>
                          {consult.indication_category && (
                            <div className="flex justify-between">
                              <dt className="text-gray-500">Category</dt>
                              <dd className="font-medium text-gray-900">{consult.indication_category}</dd>
                            </div>
                          )}
                        </dl>
                      </div>

                      {/* Requesting Unit */}
                      <div className="space-y-2">
                        <h4 className="text-sm font-semibold text-gray-700 flex items-center gap-1">
                          <BedDouble className="w-4 h-4" /> Requesting Unit
                        </h4>
                        <dl className="text-sm space-y-1">
                          <div className="flex justify-between">
                            <dt className="text-gray-500">Inviting Unit</dt>
                            <dd className="font-medium text-gray-900">{consult.inviting_unit}</dd>
                          </div>
                          <div className="flex justify-between">
                            <dt className="text-gray-500">Consultant</dt>
                            <dd className="font-medium text-gray-900">{consult.consultant_in_charge}</dd>
                          </div>
                          <div className="flex justify-between">
                            <dt className="text-gray-500">Requesting Doctor</dt>
                            <dd className="font-medium text-gray-900">{consult.requesting_doctor}</dd>
                          </div>
                          <div className="flex justify-between">
                            <dt className="text-gray-500">Designation</dt>
                            <dd className="font-medium text-gray-900">{consult.designation}</dd>
                          </div>
                        </dl>
                      </div>

                      {/* Contact & Timeline */}
                      <div className="space-y-2">
                        <h4 className="text-sm font-semibold text-gray-700 flex items-center gap-1">
                          <Phone className="w-4 h-4" /> Contact & Timeline
                        </h4>
                        <dl className="text-sm space-y-1">
                          <div className="flex justify-between items-center">
                            <dt className="text-gray-500">Phone</dt>
                            <dd>
                              <a
                                href={`tel:${consult.phone_number}`}
                                className="font-medium text-green-600 hover:text-green-700 flex items-center gap-1"
                              >
                                <Phone className="w-3.5 h-3.5" />
                                {consult.phone_number}
                              </a>
                            </dd>
                          </div>
                          {consult.alternate_phone && (
                            <div className="flex justify-between items-center">
                              <dt className="text-gray-500">Alt. Phone</dt>
                              <dd>
                                <a
                                  href={`tel:${consult.alternate_phone}`}
                                  className="font-medium text-green-600 hover:text-green-700"
                                >
                                  {consult.alternate_phone}
                                </a>
                              </dd>
                            </div>
                          )}
                          <div className="flex justify-between">
                            <dt className="text-gray-500">Received</dt>
                            <dd className="font-medium text-gray-900">{formatDateTime(consult.created_at)}</dd>
                          </div>
                          {consult.acknowledged_at && (
                            <div className="flex justify-between">
                              <dt className="text-gray-500">Acknowledged</dt>
                              <dd className="font-medium text-gray-900">{formatDateTime(consult.acknowledged_at)}</dd>
                            </div>
                          )}
                          {consult.accepted_at && (
                            <div className="flex justify-between">
                              <dt className="text-gray-500">Accepted</dt>
                              <dd className="font-medium text-gray-900">{formatDateTime(consult.accepted_at)}</dd>
                            </div>
                          )}
                          {consult.reviewed_at && (
                            <div className="flex justify-between">
                              <dt className="text-gray-500">Reviewed</dt>
                              <dd className="font-medium text-gray-900">{formatDateTime(consult.reviewed_at)}</dd>
                            </div>
                          )}
                          {consult.completed_at && (
                            <div className="flex justify-between">
                              <dt className="text-gray-500">Completed</dt>
                              <dd className="font-medium text-gray-900">{formatDateTime(consult.completed_at)}</dd>
                            </div>
                          )}
                        </dl>
                      </div>
                    </div>

                    {/* Status Progress Bar */}
                    <div className="mt-4 pt-3 border-t border-gray-100">
                      <div className="flex items-center gap-1 overflow-x-auto pb-1">
                        {['pending', 'accepted', 'reviewed', 'procedure_planned', 'completed'].map((s, i) => {
                          const sCfg = STATUS_CONFIG[s];
                          const statusOrder = ['pending', 'accepted', 'on_the_way', 'reviewed', 'procedure_planned', 'completed'];
                          const currentIdx = statusOrder.indexOf(consult.status);
                          const thisIdx = statusOrder.indexOf(s);
                          const isDone = thisIdx <= currentIdx && consult.status !== 'cancelled';
                          return (
                            <React.Fragment key={s}>
                              {i > 0 && (
                                <div className={`h-0.5 w-6 flex-shrink-0 ${isDone ? 'bg-green-400' : 'bg-gray-200'}`} />
                              )}
                              <div
                                className={`flex-shrink-0 px-2 py-1 rounded-full text-xs font-medium ${
                                  isDone ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-400'
                                }`}
                              >
                                {sCfg.label}
                              </div>
                            </React.Fragment>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-6">
          <p className="text-sm text-gray-500">
            Page {page} of {totalPages} ({total} total)
          </p>
          <div className="flex gap-2">
            <button
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page <= 1}
              className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg disabled:opacity-50 hover:bg-gray-50"
            >
              Previous
            </button>
            <button
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages}
              className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg disabled:opacity-50 hover:bg-gray-50"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * AuditLogViewerPage
 * ------------------
 * Read-only viewer for the geo-stamped clinical audit trail.
 * Filters: patient (resource_id), actor (user_id), action, resource_type,
 * geofence-violation toggle, free-text search, and time range.
 *
 * Visible to admin / consultant / senior_registrar.
 */

import { useEffect, useMemo, useState } from 'react';
import {
  Search,
  MapPin,
  AlertTriangle,
  Clock,
  Shield,
  User,
  Filter,
  Download,
  RefreshCw,
} from 'lucide-react';
import { apiClient } from '../services/apiClient';
import { useAuthStore } from '../store/authStore';
import { logger } from '../utils/logger';

interface AuditRow {
  id: number;
  user_id: string | null;
  user_name: string | null;
  user_role: string | null;
  action: string;
  resource_type: string;
  resource_id: string;
  resource_identifier: string | null;
  details: string | null;
  ip_address: string | null;
  timestamp: string;
  latitude: number | null;
  longitude: number | null;
  accuracy_meters: number | null;
  geofence_name: string | null;
  is_inside_geofence: boolean | null;
  address: string | null;
}

const ACTION_OPTIONS = [
  '',
  'ADMISSION_CREATED',
  'ADMISSION_APPROVED',
  'TREATMENT_PLAN_CREATED',
  'TREATMENT_PLAN_APPROVED',
  'TASK_APPROVED',
  'PRESCRIPTION_APPROVED',
  'LAB_ORDER_APPROVED',
  'WOUND_CARE_APPROVED',
  'WARD_ROUND_APPROVED',
  'PROCEDURE_APPROVED',
  'DISCHARGE_AUTHORISED',
  'HO_ASSIGNED',
  'HO_REASSIGNED',
];

const RESOURCE_OPTIONS = [
  '',
  'admission',
  'treatment_plan',
  'prescription',
  'lab_order',
  'wound_care',
  'ward_round',
  'procedure',
  'discharge',
];

export default function AuditLogViewerPage() {
  const user = useAuthStore((s) => s.user);
  const [rows, setRows] = useState<AuditRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [patientId, setPatientId] = useState('');
  const [userId, setUserId] = useState('');
  const [action, setAction] = useState('');
  const [resourceType, setResourceType] = useState('');
  const [search, setSearch] = useState('');
  const [onlyOutsideGeofence, setOnlyOutsideGeofence] = useState(false);
  const [limit, setLimit] = useState(100);

  const allowed =
    user && ['admin', 'super_admin', 'consultant', 'senior_registrar'].includes(user.role);

  const load = async () => {
    if (!allowed) return;
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      params.set('limit', String(limit));
      if (patientId) params.set('patient_id', patientId);
      if (userId) params.set('user_id', userId);
      if (resourceType) params.set('resource_type', resourceType);
      const resp = await apiClient.request<{ data: AuditRow[] }>(
        `/audit-logs?${params.toString()}`,
      );
      setRows(resp?.data || []);
    } catch (e: any) {
      logger.warn('Audit fetch failed:', e);
      setError(e?.message || 'Failed to load audit logs');
      setRows([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [limit]);

  const filtered = useMemo(() => {
    let r = rows;
    if (action) r = r.filter((x) => x.action === action);
    if (onlyOutsideGeofence) r = r.filter((x) => x.is_inside_geofence === false);
    if (search.trim()) {
      const q = search.toLowerCase();
      r = r.filter(
        (x) =>
          (x.user_name || '').toLowerCase().includes(q) ||
          (x.resource_identifier || '').toLowerCase().includes(q) ||
          (x.action || '').toLowerCase().includes(q) ||
          (x.details || '').toLowerCase().includes(q) ||
          (x.address || '').toLowerCase().includes(q),
      );
    }
    return r;
  }, [rows, action, onlyOutsideGeofence, search]);

  const exportCsv = () => {
    const header = [
      'timestamp',
      'user_name',
      'user_role',
      'action',
      'resource_type',
      'resource_id',
      'resource_identifier',
      'latitude',
      'longitude',
      'accuracy_m',
      'geofence',
      'inside_geofence',
      'address',
      'details',
    ];
    const lines = [header.join(',')];
    for (const r of filtered) {
      lines.push(
        [
          r.timestamp,
          quote(r.user_name),
          quote(r.user_role),
          quote(r.action),
          quote(r.resource_type),
          quote(r.resource_id),
          quote(r.resource_identifier),
          r.latitude ?? '',
          r.longitude ?? '',
          r.accuracy_meters ?? '',
          quote(r.geofence_name),
          r.is_inside_geofence == null ? '' : String(r.is_inside_geofence),
          quote(r.address),
          quote(r.details),
        ].join(','),
      );
    }
    const blob = new Blob([lines.join('\n')], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `audit-logs-${new Date().toISOString().slice(0, 19)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (!allowed) {
    return (
      <div className="p-8 text-center text-gray-600">
        <Shield className="w-12 h-12 mx-auto mb-3 text-gray-400" />
        <h2 className="text-lg font-semibold mb-1">Access restricted</h2>
        <p>Audit logs are only viewable by Admin, Consultant or Senior Registrar.</p>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 max-w-7xl mx-auto">
      <header className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Shield className="w-6 h-6 text-emerald-600" />
            Clinical Audit Trail
          </h1>
          <p className="text-sm text-gray-600">
            Geo-stamped, time-stamped record of every supervisory and clinical action.
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={load}
            disabled={loading}
            className="inline-flex items-center gap-1 px-3 py-1.5 text-sm bg-white border rounded-md hover:bg-gray-50"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
          <button
            onClick={exportCsv}
            disabled={filtered.length === 0}
            className="inline-flex items-center gap-1 px-3 py-1.5 text-sm bg-emerald-600 text-white rounded-md hover:bg-emerald-700 disabled:bg-gray-300"
          >
            <Download className="w-4 h-4" />
            Export CSV
          </button>
        </div>
      </header>

      {/* Filters */}
      <div className="bg-white border rounded-lg p-4 mb-4 grid grid-cols-1 md:grid-cols-6 gap-3 text-sm">
        <div className="md:col-span-2">
          <label className="block text-xs font-medium text-gray-600 mb-1">
            <Search className="w-3 h-3 inline mr-1" />
            Search (name / patient / details)
          </label>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="e.g. Onyia, hosp 12345, prescription…"
            className="w-full border rounded-md px-2 py-1.5"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Patient ID</label>
          <input
            value={patientId}
            onChange={(e) => setPatientId(e.target.value)}
            onBlur={load}
            placeholder="resource_id"
            className="w-full border rounded-md px-2 py-1.5"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Actor User ID</label>
          <input
            value={userId}
            onChange={(e) => setUserId(e.target.value)}
            onBlur={load}
            placeholder="user_id"
            className="w-full border rounded-md px-2 py-1.5"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Action</label>
          <select
            value={action}
            onChange={(e) => setAction(e.target.value)}
            className="w-full border rounded-md px-2 py-1.5"
          >
            {ACTION_OPTIONS.map((a) => (
              <option key={a || 'all'} value={a}>
                {a || 'All actions'}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Resource</label>
          <select
            value={resourceType}
            onChange={(e) => {
              setResourceType(e.target.value);
              setTimeout(load, 0);
            }}
            className="w-full border rounded-md px-2 py-1.5"
          >
            {RESOURCE_OPTIONS.map((r) => (
              <option key={r || 'all'} value={r}>
                {r || 'All resources'}
              </option>
            ))}
          </select>
        </div>
        <div className="md:col-span-3 flex items-end gap-4">
          <label className="inline-flex items-center gap-1.5 text-xs">
            <input
              type="checkbox"
              checked={onlyOutsideGeofence}
              onChange={(e) => setOnlyOutsideGeofence(e.target.checked)}
            />
            <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
            Only show actions outside hospital geofence
          </label>
          <label className="inline-flex items-center gap-1.5 text-xs">
            <Filter className="w-3.5 h-3.5" />
            Limit:
            <select
              value={limit}
              onChange={(e) => setLimit(Number(e.target.value))}
              className="border rounded px-1 py-0.5 text-xs"
            >
              <option value={50}>50</option>
              <option value={100}>100</option>
              <option value={250}>250</option>
              <option value={500}>500</option>
            </select>
          </label>
          <span className="text-xs text-gray-500 ml-auto">
            Showing {filtered.length} of {rows.length}
          </span>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-800 rounded-md p-3 mb-3 text-sm">
          {error}
        </div>
      )}

      {/* Table */}
      <div className="bg-white border rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full text-xs">
            <thead className="bg-gray-50 text-gray-600 uppercase tracking-wider">
              <tr>
                <th className="px-3 py-2 text-left">When</th>
                <th className="px-3 py-2 text-left">Who</th>
                <th className="px-3 py-2 text-left">Action</th>
                <th className="px-3 py-2 text-left">Resource</th>
                <th className="px-3 py-2 text-left">Patient / Item</th>
                <th className="px-3 py-2 text-left">Where</th>
                <th className="px-3 py-2 text-left">Details</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {loading && (
                <tr>
                  <td colSpan={7} className="px-3 py-8 text-center text-gray-400">
                    Loading…
                  </td>
                </tr>
              )}
              {!loading && filtered.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-3 py-8 text-center text-gray-400">
                    No audit entries match your filters.
                  </td>
                </tr>
              )}
              {!loading &&
                filtered.map((r) => (
                  <tr key={r.id} className="hover:bg-gray-50">
                    <td className="px-3 py-2 align-top whitespace-nowrap">
                      <div className="flex items-center gap-1 text-gray-700">
                        <Clock className="w-3 h-3" />
                        {formatTs(r.timestamp)}
                      </div>
                    </td>
                    <td className="px-3 py-2 align-top">
                      <div className="flex items-center gap-1 text-gray-800 font-medium">
                        <User className="w-3 h-3" />
                        {r.user_name || '—'}
                      </div>
                      <div className="text-[11px] text-gray-500">{prettyRole(r.user_role)}</div>
                    </td>
                    <td className="px-3 py-2 align-top">
                      <span className="inline-block px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200 font-medium">
                        {r.action.replace(/_/g, ' ').toLowerCase()}
                      </span>
                    </td>
                    <td className="px-3 py-2 align-top text-gray-700">
                      {r.resource_type}
                      <div className="text-[11px] text-gray-400">#{r.resource_id}</div>
                    </td>
                    <td className="px-3 py-2 align-top text-gray-700">
                      {r.resource_identifier || '—'}
                    </td>
                    <td className="px-3 py-2 align-top">
                      {r.latitude != null && r.longitude != null ? (
                        <div className="flex flex-col gap-0.5">
                          <span className="inline-flex items-center gap-1 text-gray-700">
                            <MapPin className="w-3 h-3" />
                            {r.geofence_name || `${r.latitude.toFixed(5)}, ${r.longitude.toFixed(5)}`}
                          </span>
                          {r.is_inside_geofence === false && (
                            <span className="inline-flex items-center gap-1 text-amber-700 text-[11px]">
                              <AlertTriangle className="w-3 h-3" />
                              outside hospital
                            </span>
                          )}
                          {r.accuracy_meters != null && (
                            <span className="text-[10px] text-gray-400">
                              ±{r.accuracy_meters} m
                            </span>
                          )}
                          {r.address && (
                            <span className="text-[10px] text-gray-500 max-w-[180px] truncate">
                              {r.address}
                            </span>
                          )}
                        </div>
                      ) : (
                        <span className="text-gray-400">no geo</span>
                      )}
                    </td>
                    <td className="px-3 py-2 align-top text-gray-600 max-w-[300px]">
                      <details>
                        <summary className="cursor-pointer">view</summary>
                        <pre className="text-[10px] mt-1 whitespace-pre-wrap break-all bg-gray-50 p-1 rounded border">
                          {prettyDetails(r.details)}
                        </pre>
                      </details>
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function quote(s: string | null | undefined): string {
  if (s == null) return '';
  const v = String(s).replace(/"/g, '""');
  return `"${v}"`;
}

function formatTs(ts: string): string {
  try {
    const d = new Date(ts);
    return d.toLocaleString();
  } catch {
    return ts;
  }
}

function prettyRole(r: string | null): string {
  if (!r) return '';
  return r.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

function prettyDetails(d: string | null): string {
  if (!d) return '—';
  try {
    return JSON.stringify(JSON.parse(d), null, 2);
  } catch {
    return d;
  }
}

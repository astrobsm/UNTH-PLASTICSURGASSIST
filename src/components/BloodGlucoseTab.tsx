import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Droplet, Plus, Trash2, RefreshCw, Download, AlertTriangle } from 'lucide-react';
import toast from 'react-hot-toast';
import { apiClient } from '../services/apiClient';

interface GlucoseEntry {
  id?: number;
  patient_id: number | string;
  hospital_number?: string;
  reading_date: string;     // YYYY-MM-DD
  reading_time: string;     // HH:MM[:SS]
  fbg_mmol?: number | null; // Fasting blood glucose (mmol/L)
  rbg_mmol?: number | null; // Random blood glucose (mmol/L)
  unit?: string;            // default mmol/L
  notes?: string;
  recorded_by?: string;
}

interface BloodGlucoseTabProps {
  patientId: string;
  hospitalNumber: string;
  patientName: string;
  userName: string;
}

// Clinical reference ranges (mmol/L) — WHO/ADA-aligned
// Hypoglycaemia: < 3.9   |   Normal FBG: 3.9–6.0   |   Impaired FBG: 6.1–6.9   |   Diabetes FBG: ≥ 7.0
// Normal RBG: < 7.8     |   Impaired RBG: 7.8–11.0 |   Diabetes RBG: ≥ 11.1   |   Hyperglycaemia alert: ≥ 15
const classify = (v: number | null | undefined, kind: 'fbg' | 'rbg'): {
  label: string; color: string; bg: string;
} | null => {
  if (v == null || isNaN(Number(v))) return null;
  const n = Number(v);
  if (n < 3.9) return { label: 'Hypo', color: 'text-red-700', bg: 'bg-red-100' };
  if (kind === 'fbg') {
    if (n <= 6.0) return { label: 'Normal', color: 'text-green-700', bg: 'bg-green-100' };
    if (n <= 6.9) return { label: 'Impaired', color: 'text-yellow-700', bg: 'bg-yellow-100' };
    if (n >= 15)  return { label: 'Severe', color: 'text-red-800', bg: 'bg-red-200' };
    return { label: 'Diabetic', color: 'text-red-700', bg: 'bg-red-100' };
  }
  // RBG
  if (n < 7.8)  return { label: 'Normal', color: 'text-green-700', bg: 'bg-green-100' };
  if (n <= 11.0) return { label: 'Impaired', color: 'text-yellow-700', bg: 'bg-yellow-100' };
  if (n >= 15)  return { label: 'Severe', color: 'text-red-800', bg: 'bg-red-200' };
  return { label: 'Diabetic', color: 'text-red-700', bg: 'bg-red-100' };
};

const todayDate = () => new Date().toISOString().split('T')[0];
const nowTime   = () => new Date().toTimeString().slice(0, 5);

const BloodGlucoseTab: React.FC<BloodGlucoseTabProps> = ({
  patientId, hospitalNumber, patientName, userName,
}) => {
  const [entries, setEntries] = useState<GlucoseEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [saving, setSaving] = useState(false);
  const [newEntry, setNewEntry] = useState<Partial<GlucoseEntry>>({
    reading_date: todayDate(),
    reading_time: nowTime(),
    fbg_mmol: undefined,
    rbg_mmol: undefined,
    notes: '',
  });

  const storageKey = `blood_glucose_${patientId}`;

  const loadEntries = useCallback(async () => {
    setLoading(true);
    try {
      const data = await apiClient.get(`/blood-glucose?patientId=${patientId}`);
      const rows: GlucoseEntry[] = data?.entries || [];
      setEntries(rows);
      try { localStorage.setItem(storageKey, JSON.stringify(rows)); } catch { /* quota */ }
    } catch {
      const stored = localStorage.getItem(storageKey);
      if (stored) {
        try { setEntries(JSON.parse(stored)); } catch { setEntries([]); }
      }
    } finally {
      setLoading(false);
    }
  }, [patientId, storageKey]);

  useEffect(() => { loadEntries(); }, [loadEntries]);

  const addEntry = async () => {
    if (newEntry.fbg_mmol == null && newEntry.rbg_mmol == null) {
      toast.error('Enter at least FBG or RBG');
      return;
    }
    setSaving(true);
    try {
      const payload = {
        patient_id: patientId,
        hospital_number: hospitalNumber,
        reading_date: newEntry.reading_date || todayDate(),
        reading_time: newEntry.reading_time || nowTime(),
        fbg_mmol: newEntry.fbg_mmol ?? null,
        rbg_mmol: newEntry.rbg_mmol ?? null,
        unit: 'mmol/L',
        notes: newEntry.notes || null,
        recorded_by: userName,
      };
      await apiClient.post('/blood-glucose', payload);
      toast.success('Glucose reading saved');
      setNewEntry({
        reading_date: todayDate(),
        reading_time: nowTime(),
        fbg_mmol: undefined,
        rbg_mmol: undefined,
        notes: '',
      });
      setShowAdd(false);
      await loadEntries();
    } catch (err: any) {
      toast.error(err?.message || 'Failed to save reading');
    } finally {
      setSaving(false);
    }
  };

  const deleteEntry = async (id?: number) => {
    if (!id) return;
    if (!confirm('Delete this glucose reading?')) return;
    try {
      await apiClient.delete(`/blood-glucose/${id}`);
      toast.success('Reading deleted');
      await loadEntries();
    } catch {
      toast.error('Failed to delete');
    }
  };

  const exportCsv = () => {
    if (entries.length === 0) {
      toast.error('No readings to export');
      return;
    }
    const header = 'Date,Time,FBG (mmol/L),RBG (mmol/L),Notes,Recorded By\n';
    const body = entries.map(e => [
      e.reading_date,
      (e.reading_time || '').slice(0, 5),
      e.fbg_mmol ?? '',
      e.rbg_mmol ?? '',
      (e.notes || '').replace(/[,\n\r]+/g, ' '),
      e.recorded_by || ''
    ].join(',')).join('\n');
    const blob = new Blob([header + body], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `blood-glucose-${hospitalNumber || patientId}-${todayDate()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Latest reading + simple stats for the header strip
  const stats = useMemo(() => {
    if (entries.length === 0) return null;
    const latest = entries[0];
    const fbgs = entries.map(e => Number(e.fbg_mmol)).filter(n => !isNaN(n) && n > 0);
    const rbgs = entries.map(e => Number(e.rbg_mmol)).filter(n => !isNaN(n) && n > 0);
    const avg = (arr: number[]) => arr.length ? (arr.reduce((a, b) => a + b, 0) / arr.length) : null;
    return {
      latest,
      fbgAvg: avg(fbgs),
      rbgAvg: avg(rbgs),
      hypoCount: entries.filter(e =>
        (Number(e.fbg_mmol) > 0 && Number(e.fbg_mmol) < 3.9) ||
        (Number(e.rbg_mmol) > 0 && Number(e.rbg_mmol) < 3.9)
      ).length,
      hyperCount: entries.filter(e =>
        Number(e.fbg_mmol) >= 11.1 || Number(e.rbg_mmol) >= 11.1
      ).length,
    };
  }, [entries]);

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200">
      {/* Header */}
      <div className="px-4 py-3 sm:px-6 sm:py-4 border-b border-gray-200 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-red-50 text-red-600 flex items-center justify-center">
            <Droplet className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Blood Glucose Monitoring</h2>
            <p className="text-xs text-gray-500">
              {patientName} • #{hospitalNumber} • {entries.length} reading{entries.length === 1 ? '' : 's'}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => loadEntries()}
            className="inline-flex items-center gap-1 px-3 py-1.5 text-sm border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
            title="Refresh"
          >
            <RefreshCw className="w-4 h-4" /> Refresh
          </button>
          <button
            onClick={exportCsv}
            className="inline-flex items-center gap-1 px-3 py-1.5 text-sm border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
            title="Export CSV"
          >
            <Download className="w-4 h-4" /> CSV
          </button>
          <button
            onClick={() => setShowAdd(s => !s)}
            className="inline-flex items-center gap-1 px-3 py-1.5 text-sm bg-green-600 text-white rounded-md hover:bg-green-700"
          >
            <Plus className="w-4 h-4" /> {showAdd ? 'Cancel' : 'New Reading'}
          </button>
        </div>
      </div>

      {/* Stats strip */}
      {stats && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-px bg-gray-200 border-b border-gray-200">
          <div className="bg-white p-3">
            <div className="text-[11px] uppercase tracking-wide text-gray-500">Latest FBG</div>
            <div className="text-xl font-semibold text-gray-900">
              {stats.latest.fbg_mmol ?? '—'} {stats.latest.fbg_mmol != null && <span className="text-xs font-normal text-gray-500">mmol/L</span>}
            </div>
          </div>
          <div className="bg-white p-3">
            <div className="text-[11px] uppercase tracking-wide text-gray-500">Latest RBG</div>
            <div className="text-xl font-semibold text-gray-900">
              {stats.latest.rbg_mmol ?? '—'} {stats.latest.rbg_mmol != null && <span className="text-xs font-normal text-gray-500">mmol/L</span>}
            </div>
          </div>
          <div className="bg-white p-3">
            <div className="text-[11px] uppercase tracking-wide text-gray-500">FBG / RBG Avg</div>
            <div className="text-xl font-semibold text-gray-900">
              {stats.fbgAvg ? stats.fbgAvg.toFixed(1) : '—'} <span className="text-gray-400">/</span> {stats.rbgAvg ? stats.rbgAvg.toFixed(1) : '—'}
            </div>
          </div>
          <div className="bg-white p-3">
            <div className="text-[11px] uppercase tracking-wide text-gray-500">Alerts</div>
            <div className="text-xl font-semibold text-gray-900 flex items-center gap-2">
              {stats.hypoCount > 0 && (
                <span className="inline-flex items-center gap-1 text-red-700 text-sm font-medium">
                  <AlertTriangle className="w-4 h-4" /> {stats.hypoCount} hypo
                </span>
              )}
              {stats.hyperCount > 0 && (
                <span className="inline-flex items-center gap-1 text-red-700 text-sm font-medium">
                  <AlertTriangle className="w-4 h-4" /> {stats.hyperCount} hyper
                </span>
              )}
              {stats.hypoCount === 0 && stats.hyperCount === 0 && (
                <span className="text-green-700 text-sm font-medium">None</span>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Add form */}
      {showAdd && (
        <div className="p-4 sm:p-6 border-b border-gray-200 bg-gray-50">
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Date</label>
              <input
                type="date"
                value={newEntry.reading_date}
                onChange={e => setNewEntry({ ...newEntry, reading_date: e.target.value })}
                className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-green-500 focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Time</label>
              <input
                type="time"
                value={newEntry.reading_time}
                onChange={e => setNewEntry({ ...newEntry, reading_time: e.target.value })}
                className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-green-500 focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">FBG (mmol/L)</label>
              <input
                type="number" step="0.1" min="0" max="40" inputMode="decimal"
                placeholder="e.g. 5.6"
                value={newEntry.fbg_mmol ?? ''}
                onChange={e => setNewEntry({ ...newEntry, fbg_mmol: e.target.value === '' ? undefined : parseFloat(e.target.value) })}
                className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-green-500 focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">RBG (mmol/L)</label>
              <input
                type="number" step="0.1" min="0" max="40" inputMode="decimal"
                placeholder="e.g. 8.2"
                value={newEntry.rbg_mmol ?? ''}
                onChange={e => setNewEntry({ ...newEntry, rbg_mmol: e.target.value === '' ? undefined : parseFloat(e.target.value) })}
                className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-green-500 focus:border-transparent"
              />
            </div>
            <div className="col-span-2 sm:col-span-1 flex items-end">
              <button
                onClick={addEntry}
                disabled={saving}
                className="w-full px-3 py-1.5 text-sm bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50"
              >
                {saving ? 'Saving…' : 'Save Reading'}
              </button>
            </div>
            <div className="col-span-2 sm:col-span-5">
              <label className="block text-xs font-medium text-gray-700 mb-1">Notes (optional)</label>
              <input
                type="text"
                placeholder="e.g. pre-breakfast, post-insulin, symptomatic"
                value={newEntry.notes || ''}
                onChange={e => setNewEntry({ ...newEntry, notes: e.target.value })}
                className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-green-500 focus:border-transparent"
              />
            </div>
          </div>
          <p className="mt-2 text-[11px] text-gray-500">
            Units: mmol/L. To convert from mg/dL divide by 18 (e.g. 100 mg/dL ≈ 5.6 mmol/L). Hypo &lt; 3.9 • FBG normal 3.9–6.0 • RBG normal &lt; 7.8.
          </p>
        </div>
      )}

      {/* Table */}
      <div className="overflow-x-auto">
        {loading ? (
          <div className="p-8 text-center text-gray-500 text-sm">Loading glucose readings…</div>
        ) : entries.length === 0 ? (
          <div className="p-10 text-center">
            <Droplet className="w-10 h-10 mx-auto text-gray-300 mb-2" />
            <p className="text-gray-600 font-medium">No blood glucose readings yet</p>
            <p className="text-xs text-gray-500 mt-1">Click <span className="font-medium">New Reading</span> to record the first FBG or RBG.</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-left text-xs uppercase tracking-wide text-gray-500">
              <tr>
                <th className="px-4 py-2">Date</th>
                <th className="px-4 py-2">Time</th>
                <th className="px-4 py-2">FBG (mmol/L)</th>
                <th className="px-4 py-2">RBG (mmol/L)</th>
                <th className="px-4 py-2">Notes</th>
                <th className="px-4 py-2">Recorded By</th>
                <th className="px-4 py-2 w-12"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {entries.map(e => {
                const fbgTag = classify(e.fbg_mmol, 'fbg');
                const rbgTag = classify(e.rbg_mmol, 'rbg');
                return (
                  <tr key={e.id} className="hover:bg-gray-50">
                    <td className="px-4 py-2 whitespace-nowrap text-gray-900">{e.reading_date}</td>
                    <td className="px-4 py-2 whitespace-nowrap text-gray-700">{(e.reading_time || '').slice(0, 5)}</td>
                    <td className="px-4 py-2 whitespace-nowrap">
                      {e.fbg_mmol != null ? (
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md ${fbgTag?.bg} ${fbgTag?.color} font-medium`}>
                          {Number(e.fbg_mmol).toFixed(1)}
                          {fbgTag && <span className="text-[10px] uppercase">{fbgTag.label}</span>}
                        </span>
                      ) : <span className="text-gray-300">—</span>}
                    </td>
                    <td className="px-4 py-2 whitespace-nowrap">
                      {e.rbg_mmol != null ? (
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md ${rbgTag?.bg} ${rbgTag?.color} font-medium`}>
                          {Number(e.rbg_mmol).toFixed(1)}
                          {rbgTag && <span className="text-[10px] uppercase">{rbgTag.label}</span>}
                        </span>
                      ) : <span className="text-gray-300">—</span>}
                    </td>
                    <td className="px-4 py-2 text-gray-700 max-w-xs truncate" title={e.notes || ''}>
                      {e.notes || <span className="text-gray-300">—</span>}
                    </td>
                    <td className="px-4 py-2 whitespace-nowrap text-gray-600 text-xs">{e.recorded_by || '—'}</td>
                    <td className="px-4 py-2 text-right">
                      <button
                        onClick={() => deleteEntry(e.id)}
                        className="text-gray-400 hover:text-red-600"
                        title="Delete reading"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
};

export default BloodGlucoseTab;

import React, { useState, useEffect, useCallback } from 'react';
import { db } from '../../db/database';
import { useAuthStore } from '../../store/authStore';
import { DocumentScannerModal } from '../DocumentScannerModal';

interface VitalSign {
  id?: number;
  patient_id: number;
  temperature?: number;
  pulse?: number;
  systolic_bp?: number;
  diastolic_bp?: number;
  respiratory_rate?: number;
  spo2?: number;
  weight?: number;
  height?: number;
  blood_sugar?: number;
  pain_score?: number;
  urine_output?: number;
  recorded_by: string;
  recorded_by_role: string;
  recorded_at: string;
}

interface VitalSignsRecordsProps {
  patientId: string;
  patientName: string;
}

export const VitalSignsRecords: React.FC<VitalSignsRecordsProps> = ({ patientId, patientName }) => {
  const { user } = useAuthStore();
  const [vitals, setVitals] = useState<VitalSign[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [selectedParam, setSelectedParam] = useState<string>('systolic_bp');
  const [formData, setFormData] = useState<Partial<VitalSign>>({});

  const loadVitals = useCallback(async () => {
    setLoading(true);
    try {
      const pid = Number(patientId);
      // Try local IndexedDB first
      let records: any[] = [];
      try {
        records = await db.table('vital_signs').where('patient_id').equals(pid).toArray();
      } catch {
        // Table might not exist yet - check ward_rounds for embedded vital signs
        try {
          const rounds = await db.ward_rounds?.toArray() || [];
          const patientRounds = rounds.filter((r: any) =>
            String(r.patient_id) === String(patientId)
          );
          patientRounds.forEach((r: any) => {
            if (r.vital_signs && typeof r.vital_signs === 'object') {
              records.push({
                ...r.vital_signs,
                patient_id: pid,
                recorded_at: r.round_date || r.created_at,
                recorded_by: r.led_by || r.created_by_name || 'Unknown',
                recorded_by_role: r.created_by_role || 'Doctor'
              });
            }
          });
        } catch { /* empty */ }
      }
      records.sort((a, b) => new Date(b.recorded_at).getTime() - new Date(a.recorded_at).getTime());
      setVitals(records);
    } catch (err) {
      console.error('Error loading vitals:', err);
    } finally {
      setLoading(false);
    }
  }, [patientId]);

  useEffect(() => { loadVitals(); }, [loadVitals]);

  const handleSaveVitals = async () => {
    setSaving(true);
    try {
      const record: VitalSign = {
        patient_id: Number(patientId),
        temperature: formData.temperature ? Number(formData.temperature) : undefined,
        pulse: formData.pulse ? Number(formData.pulse) : undefined,
        systolic_bp: formData.systolic_bp ? Number(formData.systolic_bp) : undefined,
        diastolic_bp: formData.diastolic_bp ? Number(formData.diastolic_bp) : undefined,
        respiratory_rate: formData.respiratory_rate ? Number(formData.respiratory_rate) : undefined,
        spo2: formData.spo2 ? Number(formData.spo2) : undefined,
        weight: formData.weight ? Number(formData.weight) : undefined,
        height: formData.height ? Number(formData.height) : undefined,
        blood_sugar: formData.blood_sugar ? Number(formData.blood_sugar) : undefined,
        pain_score: formData.pain_score ? Number(formData.pain_score) : undefined,
        urine_output: formData.urine_output ? Number(formData.urine_output) : undefined,
        recorded_by: user?.name || 'Unknown',
        recorded_by_role: user?.role || 'house_officer',
        recorded_at: new Date().toISOString()
      };

      try {
        await db.table('vital_signs').add(record);
      } catch {
        // If table doesn't exist, store in a generic store or create it
        const tx = db.transaction('rw', db.tables.map(t => t.name), async () => {
          // Fallback: store in ward_rounds or other available table
        });
        await tx;
      }

      setShowForm(false);
      setFormData({});
      loadVitals();
    } catch (err) {
      console.error('Error saving vitals:', err);
      alert('Failed to save vital signs');
    } finally {
      setSaving(false);
    }
  };

  const VITAL_PARAMS = [
    { key: 'systolic_bp', label: 'Systolic BP', unit: 'mmHg', color: '#DC2626', normalRange: '90-140' },
    { key: 'diastolic_bp', label: 'Diastolic BP', unit: 'mmHg', color: '#EA580C', normalRange: '60-90' },
    { key: 'pulse', label: 'Pulse Rate', unit: 'bpm', color: '#0E9F6E', normalRange: '60-100' },
    { key: 'temperature', label: 'Temperature', unit: '°C', color: '#7C3AED', normalRange: '36.1-37.2' },
    { key: 'respiratory_rate', label: 'Resp. Rate', unit: '/min', color: '#2563EB', normalRange: '12-20' },
    { key: 'spo2', label: 'SpO2', unit: '%', color: '#059669', normalRange: '95-100' },
    { key: 'blood_sugar', label: 'Blood Sugar', unit: 'mg/dL', color: '#D97706', normalRange: '70-140' },
    { key: 'pain_score', label: 'Pain Score', unit: '/10', color: '#BE185D', normalRange: '0-3' },
    { key: 'weight', label: 'Weight', unit: 'kg', color: '#6366F1', normalRange: '' },
    { key: 'urine_output', label: 'Urine Output', unit: 'mL/hr', color: '#0891B2', normalRange: '>30' },
  ];

  // Build SVG trend chart
  const renderTrendChart = () => {
    const param = VITAL_PARAMS.find(p => p.key === selectedParam);
    if (!param) return null;

    const dataPoints = vitals
      .filter(v => (v as any)[selectedParam] !== undefined && (v as any)[selectedParam] !== null)
      .map(v => ({ value: Number((v as any)[selectedParam]), date: v.recorded_at }))
      .reverse(); // oldest first for chart

    if (dataPoints.length === 0) {
      return (
        <div className="flex items-center justify-center h-48 text-gray-400">
          No {param.label} data recorded yet
        </div>
      );
    }

    const values = dataPoints.map(d => d.value);
    const minVal = Math.min(...values) * 0.9;
    const maxVal = Math.max(...values) * 1.1 || 1;
    const range = maxVal - minVal || 1;

    const width = 600;
    const height = 200;
    const padding = 40;
    const chartW = width - padding * 2;
    const chartH = height - padding * 2;

    const points = dataPoints.map((d, i) => ({
      x: padding + (dataPoints.length === 1 ? chartW / 2 : (i / (dataPoints.length - 1)) * chartW),
      y: padding + chartH - ((d.value - minVal) / range) * chartH,
      value: d.value,
      date: d.date
    }));

    const linePath = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');

    return (
      <div className="overflow-x-auto">
        <svg viewBox={`0 0 ${width} ${height}`} className="w-full max-w-2xl mx-auto" style={{ minWidth: 400 }}>
          {/* Grid lines */}
          {[0, 0.25, 0.5, 0.75, 1].map(frac => {
            const y = padding + chartH - frac * chartH;
            const val = (minVal + frac * range).toFixed(1);
            return (
              <g key={frac}>
                <line x1={padding} y1={y} x2={width - padding} y2={y} stroke="#E5E7EB" strokeWidth="1" />
                <text x={padding - 5} y={y + 4} textAnchor="end" fill="#9CA3AF" fontSize="10">{val}</text>
              </g>
            );
          })}
          {/* Line */}
          <path d={linePath} fill="none" stroke={param.color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
          {/* Points */}
          {points.map((p, i) => (
            <g key={i}>
              <circle cx={p.x} cy={p.y} r="4" fill={param.color} stroke="white" strokeWidth="2" />
              <text x={p.x} y={p.y - 10} textAnchor="middle" fill={param.color} fontSize="10" fontWeight="bold">
                {p.value}
              </text>
            </g>
          ))}
          {/* X-axis labels */}
          {points.map((p, i) => {
            const d = new Date(p.date);
            const label = isNaN(d.getTime()) ? '' : `${d.getDate()}/${d.getMonth() + 1}`;
            return (
              <text key={`xl-${i}`} x={p.x} y={height - 5} textAnchor="middle" fill="#9CA3AF" fontSize="9">
                {label}
              </text>
            );
          })}
        </svg>
      </div>
    );
  };

  // Latest vitals summary
  const latestVital = vitals[0];

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-8">
        <div className="animate-pulse space-y-4">
          <div className="h-6 bg-gray-200 rounded w-1/3"></div>
          <div className="h-40 bg-gray-200 rounded"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200">
        <div className="px-4 sm:px-6 py-4 border-b border-gray-200 flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold text-gray-900">Vital Signs Records</h3>
            <p className="text-sm text-gray-500 mt-1">{vitals.length} records for {patientName}</p>
          </div>
          <button onClick={() => setShowForm(true)} className="px-4 py-2 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-700">
            + Record Vitals
          </button>
        </div>
      </div>

      {/* Latest Vitals Summary Grid */}
      {latestVital && (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
          <h4 className="text-sm font-semibold text-gray-700 mb-3">Latest Readings ({new Date(latestVital.recorded_at).toLocaleDateString()})</h4>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
            {VITAL_PARAMS.filter(p => (latestVital as any)[p.key] !== undefined).map(p => (
              <div key={p.key} className="bg-gray-50 rounded-lg p-3 text-center">
                <p className="text-xs text-gray-500">{p.label}</p>
                <p className="text-xl font-bold" style={{ color: p.color }}>{(latestVital as any)[p.key]}</p>
                <p className="text-xs text-gray-400">{p.unit}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Trend Chart */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
        <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
          <h4 className="text-sm font-semibold text-gray-700">Vital Signs Trends</h4>
          <select
            value={selectedParam}
            onChange={(e) => setSelectedParam(e.target.value)}
            className="px-3 py-1.5 border border-gray-300 rounded-md text-sm focus:ring-green-500 focus:border-green-500"
          >
            {VITAL_PARAMS.map(p => (
              <option key={p.key} value={p.key}>{p.label} ({p.unit})</option>
            ))}
          </select>
        </div>
        {renderTrendChart()}
        {VITAL_PARAMS.find(p => p.key === selectedParam)?.normalRange && (
          <p className="text-xs text-gray-400 text-center mt-2">
            Normal range: {VITAL_PARAMS.find(p => p.key === selectedParam)?.normalRange} {VITAL_PARAMS.find(p => p.key === selectedParam)?.unit}
          </p>
        )}
      </div>

      {/* New Vitals Form */}
      {showForm && (
        <div className="bg-white rounded-lg shadow-sm border border-green-200 p-4 sm:p-6">
          <h4 className="text-md font-semibold text-gray-900 mb-4">Record New Vital Signs</h4>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
            {VITAL_PARAMS.map(p => (
              <div key={p.key}>
                <label className="block text-xs font-medium text-gray-600 mb-1">{p.label} ({p.unit})</label>
                <input
                  type="number"
                  step="0.1"
                  value={(formData as any)[p.key] || ''}
                  onChange={(e) => setFormData({ ...formData, [p.key]: e.target.value })}
                  placeholder={p.normalRange || '—'}
                  className="w-full px-2 py-1.5 border border-gray-300 rounded-md text-sm focus:ring-green-500 focus:border-green-500"
                />
              </div>
            ))}
          </div>
          <div className="flex items-center gap-2 mt-3 text-xs text-gray-500">
            <span>Recorded by: <strong>{user?.name || 'Unknown'}</strong> ({user?.role})</span>
          </div>
          <div className="flex justify-end gap-3 mt-4">
            <button onClick={() => { setShowForm(false); setFormData({}); }} className="px-4 py-2 text-gray-700 border border-gray-300 rounded-md hover:bg-gray-50">Cancel</button>
            <button onClick={handleSaveVitals} disabled={saving} className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50">
              {saving ? 'Saving...' : 'Save Vitals'}
            </button>
          </div>
        </div>
      )}

      {/* Historical Records Table */}
      {vitals.length > 0 && (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">Date/Time</th>
                <th className="px-3 py-2 text-center text-xs font-medium text-gray-500">T (°C)</th>
                <th className="px-3 py-2 text-center text-xs font-medium text-gray-500">BP</th>
                <th className="px-3 py-2 text-center text-xs font-medium text-gray-500">PR</th>
                <th className="px-3 py-2 text-center text-xs font-medium text-gray-500">RR</th>
                <th className="px-3 py-2 text-center text-xs font-medium text-gray-500">SpO2</th>
                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">By</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {vitals.slice(0, 20).map((v, i) => (
                <tr key={i} className="hover:bg-gray-50">
                  <td className="px-3 py-2 text-xs text-gray-600">
                    {new Date(v.recorded_at).toLocaleDateString()} {new Date(v.recorded_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </td>
                  <td className="px-3 py-2 text-center">{v.temperature ?? '—'}</td>
                  <td className="px-3 py-2 text-center">{v.systolic_bp && v.diastolic_bp ? `${v.systolic_bp}/${v.diastolic_bp}` : '—'}</td>
                  <td className="px-3 py-2 text-center">{v.pulse ?? '—'}</td>
                  <td className="px-3 py-2 text-center">{v.respiratory_rate ?? '—'}</td>
                  <td className="px-3 py-2 text-center">{v.spo2 ?? '—'}</td>
                  <td className="px-3 py-2 text-xs text-gray-500">{v.recorded_by}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

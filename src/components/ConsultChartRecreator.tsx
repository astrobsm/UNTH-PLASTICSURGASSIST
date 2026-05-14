/**
 * Digital chart recreator.
 *
 * After OCR-scanning a paper vital-signs / fluid-balance chart, the doctor uses
 * this component to enter the digitised values (one row per timepoint), preview
 * the resulting line chart on a hi-DPI canvas, and save it back to the consult.
 *
 * Designed to be used inside ConsultDetailDrawer.
 */

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Plus, Trash2, Save, LineChart as LineChartIcon, X } from 'lucide-react';
import { saveDigitalChart, type DigitalChartSeries, type ConsultDigitalChart } from '../services/consultsModuleService';

type ChartType = ConsultDigitalChart['chart_type'];

interface SeriesDef { label: string; color: string; unit?: string }

const PRESETS: Record<ChartType, SeriesDef[]> = {
  vital_signs: [
    { label: 'Pulse',    color: '#dc2626', unit: 'bpm'  },
    { label: 'BP Sys',   color: '#2563eb', unit: 'mmHg' },
    { label: 'BP Dias',  color: '#7c3aed', unit: 'mmHg' },
    { label: 'Temp',     color: '#f59e0b', unit: '°C'   },
    { label: 'SpO₂',     color: '#16a34a', unit: '%'    },
  ],
  fluid_balance: [
    { label: 'Input',    color: '#2563eb', unit: 'mL' },
    { label: 'Output',   color: '#dc2626', unit: 'mL' },
  ],
  glucose: [
    { label: 'RBG',      color: '#f59e0b', unit: 'mmol/L' },
  ],
  pain_score: [
    { label: 'Pain',     color: '#dc2626', unit: '/10' },
  ],
  custom: [
    { label: 'Series 1', color: '#0E9F6E' },
  ],
};

interface Props {
  consultId: number;
  sourceAttachmentId?: number;
  initialOcrText?: string;
  onSaved?: (chart: ConsultDigitalChart) => void;
  onCancel?: () => void;
}

interface RowState { t: string; values: (string | null)[] }

export const ConsultChartRecreator: React.FC<Props> = ({ consultId, sourceAttachmentId, initialOcrText, onSaved, onCancel }) => {
  const [chartType, setChartType] = useState<ChartType>('vital_signs');
  const [title, setTitle] = useState('Recreated chart');
  const [rows, setRows] = useState<RowState[]>([{ t: '', values: PRESETS.vital_signs.map(() => '') }]);
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const seriesDef = PRESETS[chartType];
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Reset rows when chart type changes
  useEffect(() => {
    setRows(prev => prev.map(r => ({ t: r.t, values: seriesDef.map(() => '') })));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chartType]);

  // Best-effort: parse common patterns like "08:00 P 88 BP 120/80 T 37.1 SpO2 98" from OCR text
  useEffect(() => {
    if (!initialOcrText || chartType !== 'vital_signs') return;
    const lines = initialOcrText.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
    const parsed: RowState[] = [];
    for (const line of lines) {
      const tMatch = line.match(/\b(\d{1,2}[:.]\d{2})\b/);
      if (!tMatch) continue;
      const pulse  = line.match(/\b(?:P|Pulse|HR)\s*[:=]?\s*(\d{2,3})\b/i)?.[1] || '';
      const bp     = line.match(/\b(\d{2,3})\s*\/\s*(\d{2,3})\b/);
      const temp   = line.match(/\b(?:T|Temp)\s*[:=]?\s*(\d{2}\.\d)\b/i)?.[1] || '';
      const spo2   = line.match(/\b(?:SpO2|O2|SaO2)\s*[:=]?\s*(\d{2,3})\b/i)?.[1] || '';
      parsed.push({
        t: tMatch[1].replace('.', ':'),
        values: [pulse, bp ? bp[1] : '', bp ? bp[2] : '', temp, spo2],
      });
    }
    if (parsed.length) setRows(parsed);
  }, [initialOcrText, chartType]);

  const series: DigitalChartSeries[] = useMemo(() => seriesDef.map((s, idx) => ({
    label: s.label,
    color: s.color,
    unit: s.unit,
    points: rows.map(r => ({ t: r.t, v: r.values[idx] === '' || r.values[idx] == null ? null : parseFloat(String(r.values[idx])) })).filter(p => !!p.t),
  })), [rows, seriesDef]);

  // Hi-DPI canvas preview
  useEffect(() => { drawPreview(); }, [series]);
  function drawPreview() {
    const canvas = canvasRef.current; if (!canvas) return;
    const ctx = canvas.getContext('2d'); if (!ctx) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 3);
    const cssW = Math.max(canvas.parentElement?.clientWidth || 600, 320);
    const cssH = 200;
    canvas.style.width = '100%';
    canvas.style.height = `${cssH}px`;
    canvas.width = Math.round(cssW * dpr);
    canvas.height = Math.round(cssH * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, cssW, cssH);

    const padding = { top: 12, right: 12, bottom: 24, left: 36 };
    const w = cssW - padding.left - padding.right;
    const h = cssH - padding.top - padding.bottom;

    // Combine all numeric points to compute Y-extent
    const allVals = series.flatMap(s => s.points.map(p => p.v).filter((v): v is number => typeof v === 'number'));
    if (allVals.length === 0) {
      ctx.fillStyle = '#9ca3af'; ctx.font = '12px system-ui';
      ctx.fillText('Enter timepoints and values to preview the chart', padding.left, padding.top + 20);
      return;
    }
    const minV = Math.min(...allVals);
    const maxV = Math.max(...allVals);
    const span = Math.max(maxV - minV, 1);
    const N = Math.max(rows.filter(r => r.t).length, 2);

    // Axes
    ctx.strokeStyle = '#e5e7eb'; ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(padding.left, padding.top); ctx.lineTo(padding.left, padding.top + h); ctx.lineTo(padding.left + w, padding.top + h);
    ctx.stroke();
    // Y labels (3 ticks)
    ctx.fillStyle = '#6b7280'; ctx.font = '10px system-ui';
    for (let i = 0; i <= 3; i++) {
      const v = maxV - (i * span) / 3;
      const y = padding.top + (h * i) / 3;
      ctx.fillText(v.toFixed(0), 4, y + 3);
    }
    // X labels: first/last timestamps
    const labels = rows.filter(r => r.t).map(r => r.t);
    if (labels.length) {
      ctx.fillText(labels[0], padding.left, padding.top + h + 14);
      ctx.fillText(labels[labels.length - 1], padding.left + w - 32, padding.top + h + 14);
    }

    // Plot each series
    for (const s of series) {
      ctx.strokeStyle = s.color; ctx.fillStyle = s.color; ctx.lineWidth = 1.75;
      ctx.beginPath();
      let started = false;
      s.points.forEach((p, i) => {
        if (typeof p.v !== 'number') return;
        const x = padding.left + (w * i) / Math.max(N - 1, 1);
        const y = padding.top + h - ((p.v - minV) / span) * h;
        if (!started) { ctx.moveTo(x, y); started = true; } else ctx.lineTo(x, y);
      });
      ctx.stroke();
      s.points.forEach((p, i) => {
        if (typeof p.v !== 'number') return;
        const x = padding.left + (w * i) / Math.max(N - 1, 1);
        const y = padding.top + h - ((p.v - minV) / span) * h;
        ctx.beginPath(); ctx.arc(x, y, 2.2, 0, Math.PI * 2); ctx.fill();
      });
    }
  }

  function addRow() { setRows(prev => [...prev, { t: '', values: seriesDef.map(() => '') }]); }
  function removeRow(i: number) { setRows(prev => prev.filter((_, idx) => idx !== i)); }
  function updateCell(rowIdx: number, colIdx: number, v: string) {
    setRows(prev => prev.map((r, i) => i !== rowIdx ? r : { ...r, values: r.values.map((x, j) => j === colIdx ? v : x) }));
  }
  function updateTime(i: number, v: string) {
    setRows(prev => prev.map((r, idx) => idx === i ? { ...r, t: v } : r));
  }

  async function handleSave() {
    setError(null);
    if (series.every(s => s.points.length === 0)) { setError('Add at least one timepoint with values.'); return; }
    setSaving(true);
    try {
      const chart = await saveDigitalChart(consultId, {
        chart_type: chartType,
        title: title.trim() || `Recreated ${chartType.replace('_', ' ')}`,
        series,
        source_attachment_id: sourceAttachmentId,
        notes: notes.trim() || undefined,
      });
      onSaved?.(chart);
    } catch (e: any) {
      setError(e.message || 'Failed to save chart');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <LineChartIcon className="w-4 h-4 text-green-600" />
          <h3 className="text-sm font-semibold text-gray-900">Recreate digital chart</h3>
        </div>
        {onCancel && <button onClick={onCancel} className="text-gray-400 hover:text-gray-600"><X className="w-4 h-4" /></button>}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        <label className="text-xs text-gray-600">Chart type
          <select value={chartType} onChange={(e) => setChartType(e.target.value as ChartType)}
            className="mt-1 w-full px-2 py-1.5 border border-gray-300 rounded text-sm bg-white">
            <option value="vital_signs">Vital signs</option>
            <option value="fluid_balance">Fluid balance</option>
            <option value="glucose">Glucose</option>
            <option value="pain_score">Pain score</option>
            <option value="custom">Custom</option>
          </select>
        </label>
        <label className="text-xs text-gray-600">Title
          <input value={title} onChange={(e) => setTitle(e.target.value)}
            className="mt-1 w-full px-2 py-1.5 border border-gray-300 rounded text-sm" />
        </label>
      </div>

      {/* Editable table */}
      <div className="overflow-x-auto border border-gray-200 rounded">
        <table className="w-full text-xs">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-2 py-1.5 text-left font-medium text-gray-600">Time</th>
              {seriesDef.map((s) => (
                <th key={s.label} className="px-2 py-1.5 text-left font-medium" style={{ color: s.color }}>
                  {s.label}{s.unit ? ` (${s.unit})` : ''}
                </th>
              ))}
              <th></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={i} className="border-t border-gray-100">
                <td className="px-1 py-1">
                  <input value={r.t} onChange={(e) => updateTime(i, e.target.value)} placeholder="08:00"
                    className="w-20 px-2 py-1 border border-gray-200 rounded text-xs" />
                </td>
                {r.values.map((v, j) => (
                  <td key={j} className="px-1 py-1">
                    <input value={v ?? ''} onChange={(e) => updateCell(i, j, e.target.value)} inputMode="decimal"
                      className="w-20 px-2 py-1 border border-gray-200 rounded text-xs" />
                  </td>
                ))}
                <td className="px-1 py-1">
                  <button type="button" onClick={() => removeRow(i)} className="text-gray-400 hover:text-red-600"><Trash2 className="w-3.5 h-3.5" /></button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <button type="button" onClick={addRow} className="text-xs text-green-700 hover:text-green-800 flex items-center gap-1">
        <Plus className="w-3 h-3" /> Add row
      </button>

      {/* Preview */}
      <div className="bg-gray-50 border border-gray-200 rounded p-2">
        <canvas ref={canvasRef} />
      </div>

      <textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Notes (optional)"
        rows={2} className="w-full px-2 py-1.5 border border-gray-300 rounded text-xs" />

      {error && <p className="text-xs text-red-600">{error}</p>}

      <div className="flex justify-end gap-2">
        {onCancel && <button onClick={onCancel} className="px-3 py-1.5 text-xs text-gray-600 hover:bg-gray-100 rounded">Cancel</button>}
        <button onClick={handleSave} disabled={saving}
          className="px-4 py-1.5 bg-green-600 text-white rounded text-xs font-medium hover:bg-green-700 disabled:bg-gray-300 flex items-center gap-1">
          <Save className="w-3.5 h-3.5" /> {saving ? 'Saving…' : 'Save chart'}
        </button>
      </div>
    </div>
  );
};

export default ConsultChartRecreator;

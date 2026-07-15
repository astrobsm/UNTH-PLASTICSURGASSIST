/**
 * Referral Analytics & Reporting (Addendum v2.1 §8).
 *
 * Aggregates referral data from received_consults (via GET
 * /consults-module/received/analytics) into metric cards and charts, with
 * export to PDF, Excel (.xlsx) and CSV.
 */

import React, { useCallback, useEffect, useState } from 'react';
import {
  Chart as ChartJS, CategoryScale, LinearScale, BarElement, ArcElement,
  PointElement, LineElement, Title, Tooltip, Legend, Filler,
} from 'chart.js';
import { Bar, Doughnut, Line } from 'react-chartjs-2';
import {
  BarChart3, Clock, Inbox, CheckCircle2, Loader2, AlertTriangle,
  FileText, FileSpreadsheet, Download, RefreshCw,
} from 'lucide-react';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';
import { getReferralAnalytics, type ReferralAnalytics } from '../services/consultsModuleService';
import {
  createPDF, addPDFHeader, addFooter, formatDateForPDF, sanitizeTextForPDF,
} from '../utils/pdfUtils';

ChartJS.register(
  CategoryScale, LinearScale, BarElement, ArcElement,
  PointElement, LineElement, Title, Tooltip, Legend, Filler,
);

const PALETTE = ['#2563eb', '#16a34a', '#f59e0b', '#dc2626', '#7c3aed', '#0891b2', '#db2777', '#65a30d'];
const PRIORITY_COLORS: Record<string, string> = { emergency: '#dc2626', urgent: '#f59e0b', routine: '#2563eb' };

export default function ReferralAnalyticsPage() {
  const [data, setData] = useState<ReferralAnalytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      setData(await getReferralAnalytics({ date_from: dateFrom || undefined, date_to: dateTo || undefined }));
    } catch (e: any) {
      setError(e?.message || 'Failed to load referral analytics');
    } finally { setLoading(false); }
  }, [dateFrom, dateTo]);
  useEffect(() => { load(); }, [load]);

  const rangeLabel = dateFrom || dateTo
    ? `${dateFrom ? formatDateForPDF(dateFrom) : 'start'} – ${dateTo ? formatDateForPDF(dateTo) : 'today'}`
    : 'All time';

  return (
    <div className="max-w-6xl mx-auto px-4 py-6">
      <header className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2"><BarChart3 className="w-6 h-6 text-green-600" /> Referral Analytics</h1>
          <p className="text-sm text-gray-500">Referral volumes, priorities, response times and trends.</p>
        </div>
        <div className="flex items-end gap-2 flex-wrap">
          <label className="text-xs text-gray-600">From
            <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)}
              className="mt-1 block px-2 py-1.5 border border-gray-300 rounded text-sm" />
          </label>
          <label className="text-xs text-gray-600">To
            <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)}
              className="mt-1 block px-2 py-1.5 border border-gray-300 rounded text-sm" />
          </label>
          <button onClick={load} className="px-3 py-2 bg-gray-100 text-gray-700 rounded text-sm hover:bg-gray-200 flex items-center gap-1">
            <RefreshCw className="w-4 h-4" /> Refresh
          </button>
        </div>
      </header>

      {/* Export bar */}
      {data && !loading && (
        <div className="flex flex-wrap gap-2 mb-4">
          <button onClick={() => exportPdf(data, rangeLabel)} className="px-3 py-1.5 bg-red-600 text-white rounded text-sm hover:bg-red-700 flex items-center gap-1">
            <FileText className="w-4 h-4" /> PDF
          </button>
          <button onClick={() => exportExcel(data)} className="px-3 py-1.5 bg-green-700 text-white rounded text-sm hover:bg-green-800 flex items-center gap-1">
            <FileSpreadsheet className="w-4 h-4" /> Excel
          </button>
          <button onClick={() => exportCsv(data)} className="px-3 py-1.5 bg-gray-700 text-white rounded text-sm hover:bg-gray-800 flex items-center gap-1">
            <Download className="w-4 h-4" /> CSV
          </button>
          <span className="ml-auto text-xs text-gray-400 self-center">{rangeLabel}</span>
        </div>
      )}

      {error && (
        <div className="mb-4 bg-red-50 border border-red-200 rounded p-3 text-sm text-red-800 flex items-start gap-2">
          <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" /> {error}
        </div>
      )}

      {loading ? (
        <div className="py-16 text-center text-gray-500"><Loader2 className="w-8 h-8 animate-spin mx-auto" /></div>
      ) : !data ? null : data.total === 0 ? (
        <div className="bg-white border border-dashed border-gray-300 rounded-lg p-10 text-center text-sm text-gray-500">
          No referrals in this period.
        </div>
      ) : (
        <>
          {/* Metric cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
            <MetricCard icon={<Inbox className="w-5 h-5 text-blue-600" />}    label="Total referrals" value={data.total} bg="bg-blue-50" />
            <MetricCard icon={<CheckCircle2 className="w-5 h-5 text-green-600" />} label="Acknowledged" value={data.acknowledged} bg="bg-green-50" />
            <MetricCard icon={<Clock className="w-5 h-5 text-orange-600" />}   label="Avg response" value={data.avg_response_hours != null ? `${data.avg_response_hours} h` : '—'} bg="bg-orange-50" />
            <MetricCard icon={<AlertTriangle className="w-5 h-5 text-red-600" />} label="Emergency" value={(data.by_priority.find(p => p.label.toLowerCase() === 'emergency')?.count) || 0} bg="bg-red-50" />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <ChartCard title="Referrals by department">
              <Bar data={barData(data.by_department)} options={BAR_OPTS} />
            </ChartCard>
            <ChartCard title="Referrals by unit">
              <Bar data={barData(data.by_unit)} options={BAR_OPTS} />
            </ChartCard>
            <ChartCard title="Priority mix">
              <Doughnut data={priorityData(data.by_priority)} options={{ responsive: true, plugins: { legend: { position: 'bottom' } } }} />
            </ChartCard>
            <ChartCard title="Referrals by consultant">
              <Bar data={barData(data.by_consultant)} options={BAR_OPTS} />
            </ChartCard>
            <ChartCard title="Referrals by ward">
              <Bar data={barData(data.by_ward)} options={BAR_OPTS} />
            </ChartCard>
            <ChartCard title="Avg response time by unit (hours)">
              <Bar data={respData(data.avg_response_by_unit)} options={BAR_OPTS} />
            </ChartCard>
            <ChartCard title="Referral trend" full>
              <Line data={trendData(data.trend)} options={{ responsive: true, plugins: { legend: { display: false } } }} />
            </ChartCard>
          </div>
        </>
      )}
    </div>
  );
}

// ── UI helpers ──────────────────────────────────────────────────────────────
function MetricCard({ icon, label, value, bg }: { icon: React.ReactNode; label: string; value: React.ReactNode; bg: string }) {
  return (
    <div className={`${bg} rounded-lg p-4`}>
      <div className="flex items-center gap-2 mb-1">{icon}<span className="text-xs font-semibold text-gray-600">{label}</span></div>
      <p className="text-xl sm:text-2xl font-bold text-gray-900">{value}</p>
    </div>
  );
}
function ChartCard({ title, children, full }: { title: string; children: React.ReactNode; full?: boolean }) {
  return (
    <div className={`bg-white border border-gray-200 rounded-lg p-4 ${full ? 'lg:col-span-2' : ''}`}>
      <h3 className="text-sm font-semibold text-gray-700 mb-3">{title}</h3>
      <div className="h-64">{children}</div>
    </div>
  );
}

// ── Chart data builders ─────────────────────────────────────────────────────
const BAR_OPTS = {
  responsive: true, maintainAspectRatio: false,
  plugins: { legend: { display: false } },
  scales: { y: { beginAtZero: true, ticks: { precision: 0 } } },
};
function barData(rows: { label: string; count: number }[]) {
  const top = rows.slice(0, 10);
  return {
    labels: top.map(r => r.label),
    datasets: [{ data: top.map(r => r.count), backgroundColor: top.map((_, i) => PALETTE[i % PALETTE.length]), borderRadius: 4 }],
  };
}
function respData(rows: { label: string; avg_hours: number | null; count: number }[]) {
  const top = rows.slice(0, 10);
  return {
    labels: top.map(r => r.label),
    datasets: [{ data: top.map(r => r.avg_hours ?? 0), backgroundColor: '#f59e0b', borderRadius: 4 }],
  };
}
function priorityData(rows: { label: string; count: number }[]) {
  return {
    labels: rows.map(r => r.label.charAt(0).toUpperCase() + r.label.slice(1)),
    datasets: [{ data: rows.map(r => r.count), backgroundColor: rows.map(r => PRIORITY_COLORS[r.label.toLowerCase()] || '#9ca3af') }],
  };
}
function trendData(rows: { day: string; count: number }[]) {
  return {
    labels: rows.map(r => r.day),
    datasets: [{ label: 'Referrals', data: rows.map(r => r.count), borderColor: '#2563eb', backgroundColor: 'rgba(37,99,235,0.15)', fill: true, tension: 0.3 }],
  };
}

// ── Exports ─────────────────────────────────────────────────────────────────
const STAMP = () => new Date().toISOString().slice(0, 10);

function sectionsForExport(d: ReferralAnalytics) {
  return [
    { name: 'By Department', rows: d.by_department, cols: ['Department', 'Referrals'] as const },
    { name: 'By Unit', rows: d.by_unit, cols: ['Unit', 'Referrals'] as const },
    { name: 'By Consultant', rows: d.by_consultant, cols: ['Consultant', 'Referrals'] as const },
    { name: 'By Ward', rows: d.by_ward, cols: ['Ward', 'Referrals'] as const },
    { name: 'By Priority', rows: d.by_priority, cols: ['Priority', 'Referrals'] as const },
  ];
}

function exportCsv(d: ReferralAnalytics) {
  const q = (v: any) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const lines: string[] = [];
  lines.push('Referral Analytics Report');
  lines.push(`Generated,${q(new Date().toLocaleString())}`);
  lines.push(`Total referrals,${d.total}`);
  lines.push(`Acknowledged,${d.acknowledged}`);
  lines.push(`Average response (hours),${d.avg_response_hours ?? ''}`);
  lines.push('');
  for (const s of sectionsForExport(d)) {
    lines.push(s.name);
    lines.push(s.cols.map(q).join(','));
    for (const r of s.rows) lines.push([q(r.label), r.count].join(','));
    lines.push('');
  }
  lines.push('Avg Response By Unit (hours)');
  lines.push(['Unit', 'Avg Hours', 'Acknowledged'].map(q).join(','));
  for (const r of d.avg_response_by_unit) lines.push([q(r.label), r.avg_hours ?? '', r.count].join(','));
  lines.push('');
  lines.push('Referral Trend');
  lines.push(['Date', 'Referrals'].map(q).join(','));
  for (const r of d.trend) lines.push([q(r.day), r.count].join(','));

  downloadBlob(new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' }), `referral-analytics-${STAMP()}.csv`);
}

function exportExcel(d: ReferralAnalytics) {
  const wb = XLSX.utils.book_new();
  const summary = [
    ['Referral Analytics Report'],
    ['Generated', new Date().toLocaleString()],
    ['Total referrals', d.total],
    ['Acknowledged', d.acknowledged],
    ['Average response (hours)', d.avg_response_hours ?? ''],
  ];
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(summary), 'Summary');
  for (const s of sectionsForExport(d)) {
    const aoa = [s.cols as unknown as string[], ...s.rows.map(r => [r.label, r.count])];
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(aoa), s.name.slice(0, 31));
  }
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(
    [['Unit', 'Avg Hours', 'Acknowledged'], ...d.avg_response_by_unit.map(r => [r.label, r.avg_hours ?? '', r.count])]
  ), 'Avg Response');
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(
    [['Date', 'Referrals'], ...d.trend.map(r => [r.day, r.count])]
  ), 'Trend');
  XLSX.writeFile(wb, `referral-analytics-${STAMP()}.xlsx`);
}

function exportPdf(d: ReferralAnalytics, rangeLabel: string) {
  const doc = createPDF('portrait');
  let y = addPDFHeader(doc, 'Referral Analytics Report', rangeLabel);
  doc.setFontSize(10);
  doc.text(sanitizeTextForPDF(`Total referrals: ${d.total}   Acknowledged: ${d.acknowledged}   Avg response: ${d.avg_response_hours != null ? `${d.avg_response_hours} h` : '—'}`), 14, y);
  y += 6;

  const table = (title: string, head: string[], body: (string | number)[][]) => {
    autoTable(doc, {
      startY: y,
      head: [[title]],
      body: [],
      theme: 'plain',
      headStyles: { fontStyle: 'bold', fontSize: 11 },
    });
    autoTable(doc, {
      startY: (doc as any).lastAutoTable.finalY,
      head: [head],
      body: body.length ? body : [['—', '']],
      styles: { fontSize: 9 },
      headStyles: { fillColor: [22, 163, 74] },
      margin: { left: 14, right: 14 },
    });
    y = (doc as any).lastAutoTable.finalY + 4;
  };

  for (const s of sectionsForExport(d)) {
    table(s.name, s.cols as unknown as string[], s.rows.map(r => [r.label, r.count]));
  }
  table('Avg response time by unit (hours)', ['Unit', 'Avg Hours', 'Ack.'], d.avg_response_by_unit.map(r => [r.label, r.avg_hours ?? '—', r.count]));
  addFooter(doc);
  doc.save(`referral-analytics-${STAMP()}.pdf`);
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

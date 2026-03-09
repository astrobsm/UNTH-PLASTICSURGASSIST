import { useState, useEffect, useCallback, useRef } from 'react';
import {
  Calendar,
  ChevronLeft,
  ChevronRight,
  Download,
  RefreshCw,
  Users,
  Clock,
  Shield,
  AlertCircle,
  CheckCircle2,
  X,
  BarChart3,
  User,
  Edit3,
  Save,
  CalendarRange,
  List,
} from 'lucide-react';
import {
  callDutyService,
  CallDutyShift,
  StaffMember,
  DurationPreset,
  DURATION_OPTIONS,
  calcEndDate,
  rosterKey,
  parseRosterKey,
  formatRosterLabel,
} from '../services/callDutyService';
import { useAuthStore } from '../store/authStore';
import { format, parseISO, isSameDay } from 'date-fns';

// ─── Constants ──────────────────────────────────────────────────────────────

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const ROLE_COLORS: Record<string, string> = {
  senior_registrar: 'bg-purple-100 text-purple-800 border-purple-300',
  registrar: 'bg-blue-100 text-blue-800 border-blue-300',
  house_officer: 'bg-green-100 text-green-800 border-green-300',
};

/** Format date to "YYYY-MM-DD" for input[type=date] */
function toDateInput(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// ─── Component ──────────────────────────────────────────────────────────────

export default function CallDutyPage() {
  const { user } = useAuthStore();
  const now = new Date();

  // ── Duration / range state ──────────────────────────────────────────
  const [durationPreset, setDurationPreset] = useState<DurationPreset>('1month');
  const [startDate, setStartDate] = useState<Date>(() => new Date(now.getFullYear(), now.getMonth(), 1));
  const [endDate, setEndDate] = useState<Date>(() => calcEndDate(new Date(now.getFullYear(), now.getMonth(), 1), '1month'));

  // ── Core state ──────────────────────────────────────────────────────
  const [shifts, setShifts] = useState<CallDutyShift[]>([]);
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [viewMode, setViewMode] = useState<'table' | 'calendar'>('table');
  const [editingShiftId, setEditingShiftId] = useState<number | null>(null);
  const [showSummary, setShowSummary] = useState(false);

  // ── Saved rosters list ──────────────────────────────────────────────
  const [savedKeys, setSavedKeys] = useState<string[]>([]);
  const [showSavedRosters, setShowSavedRosters] = useState(false);

  // Staff pools for edit dropdowns
  const [seniorRegs, setSeniorRegs] = useState<StaffMember[]>([]);
  const [registrars, setRegistrars] = useState<StaffMember[]>([]);
  const [houseOfficers, setHouseOfficers] = useState<StaffMember[]>([]);
  const [staffLoaded, setStaffLoaded] = useState(false);

  // Ref
  const printRef = useRef<HTMLDivElement>(null);

  // ── Current roster key ──────────────────────────────────────────────
  const currentRosterKey = rosterKey(startDate, endDate);

  // ── Recalculate end date when preset or start date changes ─────────
  useEffect(() => {
    if (durationPreset !== 'custom') {
      setEndDate(calcEndDate(startDate, durationPreset));
    }
  }, [durationPreset, startDate]);

  // ── Data loading ──────────────────────────────────────────────────────
  const loadRoster = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await callDutyService.getRosterByRange(startDate, endDate);
      setShifts(data);
    } catch (err: any) {
      setError(err.message || 'Failed to load roster');
    } finally {
      setLoading(false);
    }
  }, [startDate, endDate]);

  const loadSavedKeys = useCallback(async () => {
    const keys = await callDutyService.listRosterKeys();
    setSavedKeys(keys);
  }, []);

  const loadStaff = useCallback(async () => {
    if (staffLoaded) return;
    try {
      const [sr, r, ho] = await Promise.all([
        callDutyService.getStaffByRole('senior_registrar'),
        callDutyService.getStaffByRole('junior_registrar'),
        callDutyService.getStaffByRole('house_officer'),
      ]);
      setSeniorRegs(sr);
      setRegistrars(r);
      setHouseOfficers(ho);
      setStaffLoaded(true);
    } catch {
      // ignore
    }
  }, [staffLoaded]);

  useEffect(() => {
    loadRoster();
  }, [loadRoster]);

  useEffect(() => {
    loadSavedKeys();
  }, [loadSavedKeys]);

  // ── Generate roster ───────────────────────────────────────────────────
  const handleGenerate = async () => {
    setGenerating(true);
    setError('');
    setSuccess('');
    try {
      const newShifts = await callDutyService.generateRoster(startDate, endDate, user?.id);
      await callDutyService.saveRoster(newShifts);
      setShifts(newShifts);
      await loadSavedKeys();
      const label = formatRosterLabel(currentRosterKey);
      setSuccess(`Roster generated for ${label} — ${newShifts.length} shifts created.`);
    } catch (err: any) {
      setError(err.message || 'Failed to generate roster');
    } finally {
      setGenerating(false);
    }
  };

  // ── Navigation (shift range forward/backward by duration) ──────────
  const shiftRange = (direction: 'prev' | 'next') => {
    const diffMs = endDate.getTime() - startDate.getTime();
    const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));
    const multiplier = direction === 'next' ? 1 : -1;
    const newStart = new Date(startDate);
    newStart.setDate(newStart.getDate() + (diffDays * multiplier));
    const newEnd = new Date(endDate);
    newEnd.setDate(newEnd.getDate() + (diffDays * multiplier));
    setStartDate(newStart);
    setEndDate(newEnd);
  };

  // ── Load a saved roster ─────────────────────────────────────────────
  const loadSavedRoster = async (key: string) => {
    const parsed = parseRosterKey(key);
    if (parsed) {
      setDurationPreset('custom');
      setStartDate(parsed.start);
      setEndDate(parsed.end);
    } else {
      // Legacy month key: "YYYY-MM"
      const [yStr, mStr] = key.split('-');
      const y = parseInt(yStr, 10);
      const m = parseInt(mStr, 10) - 1;
      setDurationPreset('1month');
      setStartDate(new Date(y, m, 1));
      setEndDate(new Date(y, m + 1, 0));
    }
    setShowSavedRosters(false);
  };

  // ── Edit shift ────────────────────────────────────────────────────────
  const startEdit = (shiftId: number) => {
    setEditingShiftId(shiftId);
    loadStaff();
  };

  const saveEdit = async (shift: CallDutyShift) => {
    try {
      await callDutyService.updateShift(shift.id!, shift);
      setEditingShiftId(null);
      await loadRoster();
      setSuccess('Shift updated successfully.');
    } catch {
      setError('Failed to update shift.');
    }
  };

  const cancelEdit = () => setEditingShiftId(null);

  // ── Summary / stats ──────────────────────────────────────────────────
  const summary = callDutyService.getStaffSummary(shifts);
  const rangeLabel = formatRosterLabel(currentRosterKey);

  // ── Compute total days in the range for calendar display ──────────
  const totalDays = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));

  // ── Calendar: break range into month chunks ───────────────────────
  const getMonthChunks = () => {
    const chunks: { year: number; month: number; startDay: number; endDay: number }[] = [];
    const cursor = new Date(startDate);
    while (cursor < endDate) {
      const y = cursor.getFullYear();
      const m = cursor.getMonth();
      const monthEnd = new Date(y, m + 1, 0);
      const chunkEnd = monthEnd < endDate ? monthEnd : new Date(endDate.getTime() - 1);
      chunks.push({
        year: y,
        month: m,
        startDay: cursor.getDate(),
        endDay: chunkEnd.getDate(),
      });
      // Move to 1st of next month
      cursor.setFullYear(y);
      cursor.setMonth(m + 1, 1);
    }
    return chunks;
  };

  const MONTH_NAMES_SHORT = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

  const getShiftForDate = (date: Date): CallDutyShift | undefined => {
    return shifts.find(s => {
      const start = parseISO(s.start_date);
      const end = parseISO(s.end_date);
      return date >= new Date(start.getFullYear(), start.getMonth(), start.getDate()) &&
             date < new Date(end.getFullYear(), end.getMonth(), end.getDate());
    });
  };

  // ── PDF generation ────────────────────────────────────────────────────
  const generatePDF = () => {
    const title = `CALL DUTY ROSTER — ${rangeLabel.toUpperCase()}`;
    const deptName = 'PLASTIC SURGERY UNIT';
    const hospitalName = 'UNIVERSITY OF NIGERIA TEACHING HOSPITAL (UNTH), ENUGU';

    const rows = shifts.map(s => {
      const start = parseISO(s.start_date);
      const end = parseISO(s.end_date);
      return `
        <tr>
          <td style="border:1px solid #333;padding:8px;text-align:center;font-weight:600;">${s.shift_number}</td>
          <td style="border:1px solid #333;padding:8px;">${format(start, 'EEE, dd MMM yyyy')} 08:00</td>
          <td style="border:1px solid #333;padding:8px;">${format(end, 'EEE, dd MMM yyyy')} 08:00</td>
          <td style="border:1px solid #333;padding:8px;font-weight:500;">${s.senior_registrar_name}</td>
          <td style="border:1px solid #333;padding:8px;font-weight:500;">${s.registrar_name}</td>
          <td style="border:1px solid #333;padding:8px;font-weight:500;">${s.house_officer_name}</td>
        </tr>`;
    }).join('');

    const summaryRows = Object.values(summary)
      .sort((a, b) => a.role.localeCompare(b.role) || a.name.localeCompare(b.name))
      .map(s => `
        <tr>
          <td style="border:1px solid #333;padding:6px;">${s.name}</td>
          <td style="border:1px solid #333;padding:6px;text-align:center;">${s.role}</td>
          <td style="border:1px solid #333;padding:6px;text-align:center;font-weight:600;">${s.count}</td>
        </tr>`)
      .join('');

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>${title}</title>
        <style>
          @page { size: A4 landscape; margin: 15mm; }
          body { font-family: 'Segoe UI', Arial, sans-serif; color: #222; margin: 0; padding: 20px; }
          .header { text-align: center; margin-bottom: 20px; }
          .header h1 { font-size: 16px; margin: 0; text-transform: uppercase; letter-spacing: 1px; }
          .header h2 { font-size: 20px; margin: 6px 0; color: #0E9F6E; }
          .header h3 { font-size: 14px; margin: 4px 0; font-weight: normal; color: #555; }
          .header .line { border-top: 3px solid #0E9F6E; margin: 12px auto; width: 80%; }
          table { width: 100%; border-collapse: collapse; margin-top: 10px; font-size: 13px; }
          th { background: #0E9F6E; color: white; padding: 10px 8px; border: 1px solid #0E9F6E; text-align: left; }
          tr:nth-child(even) { background: #f0fdf4; }
          .footer { margin-top: 30px; font-size: 11px; color: #888; text-align: center; }
          .summary-section { margin-top: 30px; page-break-before: auto; }
          .summary-section h3 { color: #0E9F6E; font-size: 15px; margin-bottom: 8px; }
          .sig-section { margin-top: 50px; display: flex; justify-content: space-between; }
          .sig-block { width: 45%; text-align: center; }
          .sig-line { border-top: 1px solid #333; margin-top: 40px; padding-top: 4px; font-size: 12px; }
          @media print { body { padding: 0; } }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>${hospitalName}</h1>
          <h2>${deptName}</h2>
          <div class="line"></div>
          <h2>CALL DUTY ROSTER</h2>
          <h3>${rangeLabel}</h3>
        </div>

        <table>
          <thead>
            <tr>
              <th style="width:5%;text-align:center;">#</th>
              <th style="width:18%;">Shift Start</th>
              <th style="width:18%;">Shift End</th>
              <th style="width:20%;">Senior Registrar</th>
              <th style="width:20%;">Registrar</th>
              <th style="width:19%;">House Officer</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>

        <div class="summary-section">
          <h3>Shift Distribution Summary</h3>
          <table style="width:60%;">
            <thead>
              <tr>
                <th>Name</th>
                <th style="text-align:center;">Role</th>
                <th style="text-align:center;">Total Shifts</th>
              </tr>
            </thead>
            <tbody>${summaryRows}</tbody>
          </table>
        </div>

        <div class="sig-section">
          <div class="sig-block">
            <div class="sig-line">Head of Unit / Consultant</div>
          </div>
          <div class="sig-block">
            <div class="sig-line">Chief Registrar</div>
          </div>
        </div>

        <div class="footer">
          <p>Generated on ${format(new Date(), 'PPPp')} | Plastic Surgeon Assistant – UNTH Enugu</p>
          <p>Each call duty shift runs for 48 continuous hours (08:00 to 08:00).</p>
        </div>
      </body>
      </html>
    `;

    const blob = new Blob([html], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const printWindow = window.open(url, '_blank');
    if (printWindow) {
      printWindow.onload = () => {
        setTimeout(() => {
          printWindow.print();
        }, 500);
      };
    }
  };

  // ── Render ────────────────────────────────────────────────────────────
  return (
    <div className="max-w-7xl mx-auto px-4 py-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Shield className="w-7 h-7 text-green-600" />
            Call Duty Roster
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            48-hour call shifts — Senior Registrar, Registrar &amp; House Officer
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => setViewMode(viewMode === 'table' ? 'calendar' : 'table')}
            className="px-3 py-2 text-sm bg-gray-100 hover:bg-gray-200 rounded-lg flex items-center gap-1"
          >
            <Calendar className="w-4 h-4" />
            {viewMode === 'table' ? 'Calendar' : 'Table'} View
          </button>
          <button
            onClick={() => setShowSummary(!showSummary)}
            className="px-3 py-2 text-sm bg-gray-100 hover:bg-gray-200 rounded-lg flex items-center gap-1"
          >
            <BarChart3 className="w-4 h-4" />
            Stats
          </button>
          <button
            onClick={() => { setShowSavedRosters(!showSavedRosters); loadSavedKeys(); }}
            className="px-3 py-2 text-sm bg-gray-100 hover:bg-gray-200 rounded-lg flex items-center gap-1"
          >
            <List className="w-4 h-4" />
            Saved Rosters
          </button>
        </div>
      </div>

      {/* ─── Duration & Date Range Picker ─────────────────────────────── */}
      <div className="bg-white rounded-xl shadow-sm border p-4 space-y-4">
        {/* Duration presets */}
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-medium text-gray-700 mr-1">
            <CalendarRange className="w-4 h-4 inline-block mr-1 -mt-0.5" />
            Duration:
          </span>
          {DURATION_OPTIONS.map(opt => (
            <button
              key={opt.key}
              onClick={() => setDurationPreset(opt.key)}
              className={`px-3 py-1.5 text-sm rounded-lg border transition-colors ${
                durationPreset === opt.key
                  ? 'bg-green-600 text-white border-green-600'
                  : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>

        {/* Date inputs + navigation */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <button onClick={() => shiftRange('prev')} className="p-2 hover:bg-gray-100 rounded-lg" title="Previous period">
              <ChevronLeft className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-2">
              <div>
                <label className="block text-xs text-gray-500 mb-0.5">Start Date</label>
                <input
                  type="date"
                  value={toDateInput(startDate)}
                  onChange={e => {
                    const d = new Date(e.target.value + 'T00:00:00');
                    if (!isNaN(d.getTime())) setStartDate(d);
                  }}
                  className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:ring-2 focus:ring-green-500 focus:border-green-500"
                />
              </div>
              <span className="text-gray-400 mt-4">→</span>
              <div>
                <label className="block text-xs text-gray-500 mb-0.5">End Date</label>
                <input
                  type="date"
                  value={toDateInput(endDate)}
                  onChange={e => {
                    const d = new Date(e.target.value + 'T00:00:00');
                    if (!isNaN(d.getTime())) {
                      setEndDate(d);
                      setDurationPreset('custom');
                    }
                  }}
                  min={toDateInput(startDate)}
                  className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:ring-2 focus:ring-green-500 focus:border-green-500"
                />
              </div>
            </div>

            <button onClick={() => shiftRange('next')} className="p-2 hover:bg-gray-100 rounded-lg" title="Next period">
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm text-gray-500">{totalDays} days • {shifts.length} shifts</span>
            <button
              onClick={handleGenerate}
              disabled={generating}
              className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 flex items-center gap-2 text-sm font-medium"
            >
              {generating ? <RefreshCw className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
              {shifts.length > 0 ? 'Regenerate Roster' : 'Generate Roster'}
            </button>
            {shifts.length > 0 && (
              <button
                onClick={generatePDF}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2 text-sm font-medium"
              >
                <Download className="w-4 h-4" />
                Download PDF
              </button>
            )}
          </div>
        </div>

        {/* Range summary */}
        <div className="text-center text-sm font-medium text-gray-700">
          {rangeLabel}
        </div>
      </div>

      {/* Saved Rosters Dropdown */}
      {showSavedRosters && savedKeys.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm border p-4">
          <h3 className="text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
            <List className="w-4 h-4 text-green-600" />
            Saved Rosters
          </h3>
          <div className="flex flex-wrap gap-2">
            {savedKeys.map(key => (
              <button
                key={key}
                onClick={() => loadSavedRoster(key)}
                className={`px-3 py-1.5 text-sm rounded-lg border transition-colors ${
                  key === currentRosterKey
                    ? 'bg-green-100 text-green-800 border-green-300'
                    : 'bg-gray-50 text-gray-700 border-gray-200 hover:bg-gray-100'
                }`}
              >
                {formatRosterLabel(key)}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Messages */}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg flex items-center gap-2">
          <AlertCircle className="w-5 h-5 flex-shrink-0" /> {error}
          <button onClick={() => setError('')} className="ml-auto"><X className="w-4 h-4" /></button>
        </div>
      )}
      {success && (
        <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg flex items-center gap-2">
          <CheckCircle2 className="w-5 h-5 flex-shrink-0" /> {success}
          <button onClick={() => setSuccess('')} className="ml-auto"><X className="w-4 h-4" /></button>
        </div>
      )}

      {/* Stats summary */}
      {showSummary && shifts.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm border p-5">
          <h3 className="text-lg font-semibold text-gray-900 mb-3 flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-green-600" />
            Shift Distribution — {rangeLabel}
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {Object.values(summary)
              .sort((a, b) => a.role.localeCompare(b.role))
              .map((s, idx) => (
                <div key={idx} className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg border">
                  <User className="w-5 h-5 text-gray-400" />
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-gray-900 truncate">{s.name}</div>
                    <div className="text-xs text-gray-500">{s.role}</div>
                  </div>
                  <span className="text-lg font-bold text-green-600">{s.count}</span>
                  <span className="text-xs text-gray-400">shifts</span>
                </div>
              ))}
          </div>
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="flex justify-center py-12">
          <RefreshCw className="w-8 h-8 text-green-600 animate-spin" />
        </div>
      )}

      {/* Empty state */}
      {!loading && shifts.length === 0 && (
        <div className="bg-white rounded-xl shadow-sm border p-12 text-center">
          <Calendar className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-700">No roster for {rangeLabel}</h3>
          <p className="text-gray-500 mt-2 mb-6">
            Select a duration and click <strong>Generate Roster</strong> to auto-assign 48-hour call duties
            evenly among Senior Registrars, Registrars, and House Officers.
          </p>
          <button
            onClick={handleGenerate}
            disabled={generating}
            className="px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 inline-flex items-center gap-2 font-medium"
          >
            {generating ? <RefreshCw className="w-5 h-5 animate-spin" /> : <RefreshCw className="w-5 h-5" />}
            Generate Roster
          </button>
        </div>
      )}

      {/* ─── Table View ─────────────────────────────────────────────────── */}
      {!loading && shifts.length > 0 && viewMode === 'table' && (
        <div className="bg-white rounded-xl shadow-sm border overflow-hidden" ref={printRef}>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-green-600 text-white">
                  <th className="px-4 py-3 text-left font-semibold w-12">#</th>
                  <th className="px-4 py-3 text-left font-semibold">Shift Start</th>
                  <th className="px-4 py-3 text-left font-semibold">Shift End</th>
                  <th className="px-4 py-3 text-left font-semibold">Senior Registrar</th>
                  <th className="px-4 py-3 text-left font-semibold">Registrar</th>
                  <th className="px-4 py-3 text-left font-semibold">House Officer</th>
                  <th className="px-4 py-3 text-center font-semibold w-20">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {shifts.map(shift => {
                  const shiftStart = parseISO(shift.start_date);
                  const shiftEnd = parseISO(shift.end_date);
                  const isToday = isSameDay(shiftStart, new Date()) || (new Date() >= shiftStart && new Date() < shiftEnd);
                  const isEditing = editingShiftId === shift.id;

                  return (
                    <ShiftRow
                      key={shift.id || shift.shift_number}
                      shift={shift}
                      startDate={shiftStart}
                      endDate={shiftEnd}
                      isToday={isToday}
                      isEditing={isEditing}
                      seniorRegs={seniorRegs}
                      registrars={registrars}
                      houseOfficers={houseOfficers}
                      onEdit={() => startEdit(shift.id!)}
                      onSave={saveEdit}
                      onCancel={cancelEdit}
                    />
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ─── Calendar View ──────────────────────────────────────────────── */}
      {!loading && shifts.length > 0 && viewMode === 'calendar' && (
        <div className="space-y-4">
          {getMonthChunks().map(chunk => {
            const daysInThisMonth = new Date(chunk.year, chunk.month + 1, 0).getDate();
            const firstDow = new Date(chunk.year, chunk.month, chunk.startDay).getDay();
            const dayCount = chunk.endDay - chunk.startDay + 1;

            return (
              <div key={`${chunk.year}-${chunk.month}`} className="bg-white rounded-xl shadow-sm border p-4">
                <h3 className="text-lg font-semibold text-gray-800 mb-3">
                  {MONTH_NAMES_SHORT[chunk.month]} {chunk.year}
                </h3>
                {/* Day headers */}
                <div className="grid grid-cols-7 gap-1 mb-2">
                  {DAY_NAMES.map(d => (
                    <div key={d} className="text-center text-xs font-semibold text-gray-500 py-1">{d}</div>
                  ))}
                </div>
                {/* Calendar grid */}
                <div className="grid grid-cols-7 gap-1">
                  {/* Empty cells before first day */}
                  {Array.from({ length: firstDow }).map((_, i) => (
                    <div key={`empty-${i}`} className="min-h-[80px]" />
                  ))}
                  {/* Day cells */}
                  {Array.from({ length: dayCount }).map((_, i) => {
                    const day = chunk.startDay + i;
                    const date = new Date(chunk.year, chunk.month, day);
                    const shift = getShiftForDate(date);
                    const isToday = isSameDay(date, new Date());
                    return (
                      <div
                        key={day}
                        className={`min-h-[80px] border rounded-lg p-1 text-xs ${
                          isToday ? 'border-green-500 bg-green-50' : 'border-gray-200'
                        } ${shift ? '' : 'bg-gray-50'}`}
                      >
                        <div className={`font-semibold mb-1 ${isToday ? 'text-green-700' : 'text-gray-700'}`}>{day}</div>
                        {shift && (
                          <div className="space-y-0.5">
                            <div className="truncate text-purple-700" title={shift.senior_registrar_name}>
                              <span className="font-semibold">SR:</span> {shift.senior_registrar_name.split(' ').slice(-1)}
                            </div>
                            <div className="truncate text-blue-700" title={shift.registrar_name}>
                              <span className="font-semibold">R:</span> {shift.registrar_name.split(' ').slice(-1)}
                            </div>
                            <div className="truncate text-green-700" title={shift.house_officer_name}>
                              <span className="font-semibold">HO:</span> {shift.house_officer_name.split(' ').slice(-1)}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
          {/* Legend */}
          <div className="flex items-center gap-4 text-xs text-gray-500 justify-center">
            <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-purple-200 border border-purple-400" /> Senior Registrar</span>
            <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-blue-200 border border-blue-400" /> Registrar</span>
            <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-green-200 border border-green-400" /> House Officer</span>
          </div>
        </div>
      )}

      {/* Info footer */}
      <div className="text-xs text-gray-400 text-center">
        Each call duty shift runs for <strong>48 continuous hours</strong> (08:00 → 08:00 +2 days).
        Assignments are distributed evenly via round-robin among available staff.
      </div>
    </div>
  );
}

// ─── Shift Row (editable) ───────────────────────────────────────────────────

interface ShiftRowProps {
  shift: CallDutyShift;
  startDate: Date;
  endDate: Date;
  isToday: boolean;
  isEditing: boolean;
  seniorRegs: StaffMember[];
  registrars: StaffMember[];
  houseOfficers: StaffMember[];
  onEdit: () => void;
  onSave: (shift: CallDutyShift) => void;
  onCancel: () => void;
}

function ShiftRow({
  shift, startDate, endDate, isToday, isEditing,
  seniorRegs, registrars, houseOfficers,
  onEdit, onSave, onCancel,
}: ShiftRowProps) {
  const [localShift, setLocalShift] = useState(shift);

  useEffect(() => {
    setLocalShift(shift);
  }, [shift]);

  const handleStaffChange = (role: 'sr' | 'r' | 'ho', userId: string, pool: StaffMember[]) => {
    const staff = pool.find(s => s.id === userId);
    if (!staff) return;
    if (role === 'sr') setLocalShift(s => ({ ...s, senior_registrar_id: staff.id, senior_registrar_name: staff.full_name }));
    if (role === 'r') setLocalShift(s => ({ ...s, registrar_id: staff.id, registrar_name: staff.full_name }));
    if (role === 'ho') setLocalShift(s => ({ ...s, house_officer_id: staff.id, house_officer_name: staff.full_name }));
  };

  return (
    <tr className={`${isToday ? 'bg-green-50 border-l-4 border-l-green-500' : 'hover:bg-gray-50'}`}>
      <td className="px-4 py-3 font-bold text-gray-600">{shift.shift_number}</td>
      <td className="px-4 py-3">
        <div className="flex items-center gap-2">
          <Clock className="w-4 h-4 text-gray-400" />
          <div>
            <div className="font-medium">{format(startDate, 'EEE, dd MMM yyyy')}</div>
            <div className="text-xs text-gray-400">08:00 hrs</div>
          </div>
        </div>
      </td>
      <td className="px-4 py-3">
        <div>
          <div className="font-medium">{format(endDate, 'EEE, dd MMM yyyy')}</div>
          <div className="text-xs text-gray-400">08:00 hrs</div>
        </div>
      </td>

      {/* Senior Registrar */}
      <td className="px-4 py-3">
        {isEditing ? (
          <select
            className="w-full border rounded px-2 py-1 text-sm"
            value={localShift.senior_registrar_id}
            onChange={e => handleStaffChange('sr', e.target.value, seniorRegs)}
          >
            {seniorRegs.map(s => <option key={s.id} value={s.id}>{s.full_name}</option>)}
          </select>
        ) : (
          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded border text-xs font-medium ${ROLE_COLORS.senior_registrar}`}>
            <Users className="w-3 h-3" /> {shift.senior_registrar_name}
          </span>
        )}
      </td>

      {/* Registrar */}
      <td className="px-4 py-3">
        {isEditing ? (
          <select
            className="w-full border rounded px-2 py-1 text-sm"
            value={localShift.registrar_id}
            onChange={e => handleStaffChange('r', e.target.value, registrars)}
          >
            {registrars.map(s => <option key={s.id} value={s.id}>{s.full_name}</option>)}
          </select>
        ) : (
          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded border text-xs font-medium ${ROLE_COLORS.registrar}`}>
            <Users className="w-3 h-3" /> {shift.registrar_name}
          </span>
        )}
      </td>

      {/* House Officer */}
      <td className="px-4 py-3">
        {isEditing ? (
          <select
            className="w-full border rounded px-2 py-1 text-sm"
            value={localShift.house_officer_id}
            onChange={e => handleStaffChange('ho', e.target.value, houseOfficers)}
          >
            {houseOfficers.map(s => <option key={s.id} value={s.id}>{s.full_name}</option>)}
          </select>
        ) : (
          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded border text-xs font-medium ${ROLE_COLORS.house_officer}`}>
            <Users className="w-3 h-3" /> {shift.house_officer_name}
          </span>
        )}
      </td>

      {/* Actions */}
      <td className="px-4 py-3 text-center">
        {isEditing ? (
          <div className="flex items-center justify-center gap-1">
            <button onClick={() => onSave(localShift)} className="p-1.5 bg-green-100 hover:bg-green-200 rounded text-green-700" title="Save">
              <Save className="w-4 h-4" />
            </button>
            <button onClick={onCancel} className="p-1.5 bg-gray-100 hover:bg-gray-200 rounded text-gray-600" title="Cancel">
              <X className="w-4 h-4" />
            </button>
          </div>
        ) : (
          <button onClick={onEdit} className="p-1.5 hover:bg-gray-100 rounded text-gray-500" title="Edit shift">
            <Edit3 className="w-4 h-4" />
          </button>
        )}
      </td>
    </tr>
  );
}

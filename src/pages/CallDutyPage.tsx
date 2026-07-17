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
  FileText,
  ClipboardList,
  Plus,
  Trash2,
  Building2,
  Siren,
  Coffee,
  Check,
  RotateCcw,
  Phone,
} from 'lucide-react';
import {
  callDutyService,
  CallDutyShift,
  StaffMember,
  HandoverNote,
  HandoverTask,
  HOAssignment,
  DurationPreset,
  DURATION_OPTIONS,
  calcEndDate,
  rosterKey,
  parseRosterKey,
  formatRosterLabel,
} from '../services/callDutyService';
import { useAuthStore } from '../store/authStore';
import { format, parseISO, isSameDay } from 'date-fns';
import PhoneActions from '../components/PhoneActions';

// ─── Constants ──────────────────────────────────────────────────────────────

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const ROLE_COLORS: Record<string, string> = {
  senior_registrar: 'bg-purple-100 text-purple-800 border-purple-300',
  registrar: 'bg-blue-100 text-blue-800 border-blue-300',
  ho_ward: 'bg-green-100 text-green-800 border-green-300',
  ho_emergency: 'bg-orange-100 text-orange-800 border-orange-300',
  ho_off: 'bg-gray-100 text-gray-500 border-gray-300',
  house_officer: 'bg-green-100 text-green-800 border-green-300',
};

const ASSIGNMENT_LABELS: Record<HOAssignment, string> = {
  ward: 'Ward',
  emergency: 'Emergency',
  ward_and_emergency: 'Ward & Emergency',
  off: 'Off',
};

/** Format date to "YYYY-MM-DD" for input[type=date] */
function toDateInput(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function generateTaskId(): string {
  return `t_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
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
  const [viewMode, setViewMode] = useState<'table' | 'calendar' | 'handover' | 'tasks'>('table');
  const [editingShiftId, setEditingShiftId] = useState<number | null>(null);
  const [showSummary, setShowSummary] = useState(false);

  // ── Saved rosters list ──────────────────────────────────────────────
  const [savedKeys, setSavedKeys] = useState<string[]>([]);
  const [showSavedRosters, setShowSavedRosters] = useState(false);

  // Staff pools for edit dropdowns
  const [seniorRegs, setSeniorRegs] = useState<StaffMember[]>([]);
  const [registrars, setRegistrars] = useState<StaffMember[]>([]);
  const [houseOfficers, setHouseOfficers] = useState<StaffMember[]>([]);
  const [consultants, setConsultants] = useState<StaffMember[]>([]);
  const [staffLoaded, setStaffLoaded] = useState(false);

  // ── Handover notes state ────────────────────────────────────────────
  const [handoverNotes, setHandoverNotes] = useState<HandoverNote[]>([]);
  const [selectedShiftForNote, setSelectedShiftForNote] = useState<CallDutyShift | null>(null);
  const [noteContent, setNoteContent] = useState('');
  const [noteTasks, setNoteTasks] = useState<HandoverTask[]>([]);
  const [newTaskText, setNewTaskText] = useState('');
  const [noteAssignment, setNoteAssignment] = useState<HOAssignment>('ward');
  const [editingNoteId, setEditingNoteId] = useState<number | null>(null);

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

  const loadHandoverNotes = useCallback(async () => {
    try {
      const notes = await callDutyService.getHandoverNotesByRoster(currentRosterKey);
      setHandoverNotes(notes);
    } catch { /* ignore */ }
  }, [currentRosterKey]);

  const loadSavedKeys = useCallback(async () => {
    const keys = await callDutyService.listRosterKeys();
    setSavedKeys(keys);
  }, []);

  const loadStaff = useCallback(async () => {
    if (staffLoaded) return;
    try {
      const [sr, r, ho, cons] = await Promise.all([
        callDutyService.getStaffByRole('senior_registrar'),
        callDutyService.getStaffByRole('junior_registrar'),
        callDutyService.getStaffByRole('house_officer'),
        callDutyService.getStaffByRole('consultant'),
      ]);
      setSeniorRegs(sr);
      setRegistrars(r);
      setHouseOfficers(ho);
      setConsultants(cons);
      setStaffLoaded(true);
    } catch {
      // ignore
    }
  }, [staffLoaded]);

  useEffect(() => { loadRoster(); }, [loadRoster]);
  useEffect(() => { loadSavedKeys(); }, [loadSavedKeys]);
  useEffect(() => { loadHandoverNotes(); }, [loadHandoverNotes]);

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
      const hoCount = newShifts[0]?.ho_count || 0;
      const modeNote = hoCount >= 3
        ? '(3 HOs: Ward / Emergency / Off rotation)'
        : hoCount === 2
        ? '(2 HOs: Ward+Emergency / Off alternating)'
        : hoCount === 1
        ? '(1 HO: always on duty)'
        : '';
      setSuccess(`Roster generated for ${label} — ${newShifts.length} shifts created. ${modeNote}`);
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

  // ── Handover Note handlers ────────────────────────────────────────────
  const openNoteEditor = (shift: CallDutyShift, existingNote?: HandoverNote) => {
    setSelectedShiftForNote(shift);
    if (existingNote) {
      setEditingNoteId(existingNote.id!);
      setNoteContent(existingNote.content);
      setNoteTasks(existingNote.tasks || []);
      setNoteAssignment(existingNote.assignment);
    } else {
      setEditingNoteId(null);
      setNoteContent('');
      setNoteTasks([]);
      // Auto-detect assignment from shift
      if (user?.id === shift.ho_ward_id && shift.ho_ward_id === shift.ho_emergency_id) {
        setNoteAssignment('ward_and_emergency');
      } else if (user?.id === shift.ho_ward_id) {
        setNoteAssignment('ward');
      } else if (user?.id === shift.ho_emergency_id) {
        setNoteAssignment('emergency');
      } else {
        setNoteAssignment('ward');
      }
    }
  };

  const addTask = () => {
    if (!newTaskText.trim()) return;
    setNoteTasks(prev => [...prev, { id: generateTaskId(), text: newTaskText.trim(), status: 'outstanding' }]);
    setNewTaskText('');
  };

  const removeTask = (taskId: string) => {
    setNoteTasks(prev => prev.filter(t => t.id !== taskId));
  };

  const saveHandoverNote = async () => {
    if (!selectedShiftForNote || !user) return;
    const note: HandoverNote = {
      id: editingNoteId || undefined,
      shift_id: selectedShiftForNote.id!,
      roster_key: currentRosterKey,
      assignment: noteAssignment,
      author_id: user.id,
      author_name: user.full_name || user.email,
      content: noteContent,
      tasks: noteTasks,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    try {
      await callDutyService.saveHandoverNote(note);
      setSelectedShiftForNote(null);
      setNoteContent('');
      setNoteTasks([]);
      setEditingNoteId(null);
      await loadHandoverNotes();
      setSuccess('Handover note saved successfully.');
    } catch {
      setError('Failed to save handover note.');
    }
  };

  const handleCompleteTask = async (noteId: number, taskId: string) => {
    if (!user) return;
    try {
      await callDutyService.completeTask(noteId, taskId, user.id, user.full_name || user.email);
      await loadHandoverNotes();
    } catch {
      setError('Failed to complete task.');
    }
  };

  const handleReopenTask = async (noteId: number, taskId: string) => {
    try {
      await callDutyService.reopenTask(noteId, taskId);
      await loadHandoverNotes();
    } catch {
      setError('Failed to reopen task.');
    }
  };

  // Outstanding tasks across all notes in this roster
  const outstandingTasks = callDutyService.getOutstandingTasks(handoverNotes);

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
      const is2HO = s.ho_ward_id && s.ho_ward_id === s.ho_emergency_id;
      return `
        <tr>
          <td style="border:1px solid #333;padding:8px;text-align:center;font-weight:600;">${s.shift_number}</td>
          <td style="border:1px solid #333;padding:8px;">${format(start, 'EEE, dd MMM yyyy')} 08:00</td>
          <td style="border:1px solid #333;padding:8px;">${format(end, 'EEE, dd MMM yyyy')} 08:00</td>
          <td style="border:1px solid #333;padding:8px;font-weight:500;">${s.senior_registrar_name}</td>
          <td style="border:1px solid #333;padding:8px;font-weight:500;">${s.registrar_name}</td>
          <td style="border:1px solid #333;padding:8px;font-weight:500;">${s.ho_ward_name || s.house_officer_name}${is2HO ? ' (W+ER)' : ''}${s.ho_ward_phone ? '<br/><span style="font-size:11px;color:#555;">📞 ' + s.ho_ward_phone + '</span>' : ''}</td>
          <td style="border:1px solid #333;padding:8px;font-weight:500;">${is2HO ? '↑ same' : (s.ho_emergency_name || '—')}${!is2HO && s.ho_emergency_phone ? '<br/><span style="font-size:11px;color:#555;">📞 ' + s.ho_emergency_phone + '</span>' : ''}</td>
          <td style="border:1px solid #333;padding:8px;color:#888;">${s.ho_off_name || '—'}${s.ho_off_phone ? '<br/><span style="font-size:11px;color:#999;">📞 ' + s.ho_off_phone + '</span>' : ''}</td>
        </tr>`;
    }).join('');

    const summaryRows = Object.values(summary)
      .sort((a, b) => a.role.localeCompare(b.role) || a.name.localeCompare(b.name))
      .map(s => `
        <tr>
          <td style="border:1px solid #333;padding:6px;">${s.name}</td>
          <td style="border:1px solid #333;padding:6px;text-align:center;">${s.role}</td>
          <td style="border:1px solid #333;padding:6px;text-align:center;font-weight:600;">${s.count}</td>
          <td style="border:1px solid #333;padding:6px;text-align:center;">${s.ward ?? '—'}</td>
          <td style="border:1px solid #333;padding:6px;text-align:center;">${s.emergency ?? '—'}</td>
          <td style="border:1px solid #333;padding:6px;text-align:center;">${s.off ?? '—'}</td>
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
              <th style="width:4%;text-align:center;">#</th>
              <th style="width:14%;">Shift Start</th>
              <th style="width:14%;">Shift End</th>
              <th style="width:15%;">Senior Registrar</th>
              <th style="width:14%;">Registrar</th>
              <th style="width:14%;">HO (Ward)</th>
              <th style="width:14%;">HO (Emergency)</th>
              <th style="width:11%;">HO (Off)</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>

        <div class="summary-section">
          <h3>Shift Distribution Summary</h3>
          <table style="width:80%;">
            <thead>
              <tr>
                <th>Name</th>
                <th style="text-align:center;">Role</th>
                <th style="text-align:center;">Total Shifts</th>
                <th style="text-align:center;">Ward</th>
                <th style="text-align:center;">Emergency</th>
                <th style="text-align:center;">Off</th>
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
          <p>Each call duty shift runs for 48 continuous hours (08:00 to 08:00). HO rotation: Ward / Emergency / Off.</p>
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
          <h1 className="text-lg sm:text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Shield className="w-7 h-7 text-green-600" />
            Call Duty Roster
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            48-hour call shifts — Senior Registrar, Registrar &amp; House Officers (Ward / Emergency / Off rotation)
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => setViewMode('table')}
            className={`px-3 py-2 text-sm rounded-lg flex items-center gap-1 ${viewMode === 'table' ? 'bg-green-100 text-green-800' : 'bg-gray-100 hover:bg-gray-200'}`}
          >
            <List className="w-4 h-4" />
            Table
          </button>
          <button
            onClick={() => setViewMode('calendar')}
            className={`px-3 py-2 text-sm rounded-lg flex items-center gap-1 ${viewMode === 'calendar' ? 'bg-green-100 text-green-800' : 'bg-gray-100 hover:bg-gray-200'}`}
          >
            <Calendar className="w-4 h-4" />
            Calendar
          </button>
          <button
            onClick={() => setViewMode('handover')}
            className={`px-3 py-2 text-sm rounded-lg flex items-center gap-1 ${viewMode === 'handover' ? 'bg-green-100 text-green-800' : 'bg-gray-100 hover:bg-gray-200'}`}
          >
            <FileText className="w-4 h-4" />
            Handover
          </button>
          <button
            onClick={() => setViewMode('tasks')}
            className={`px-3 py-2 text-sm rounded-lg flex items-center gap-1 relative ${viewMode === 'tasks' ? 'bg-green-100 text-green-800' : 'bg-gray-100 hover:bg-gray-200'}`}
          >
            <ClipboardList className="w-4 h-4" />
            Tasks
            {outstandingTasks.length > 0 && (
              <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center font-bold">
                {outstandingTasks.length}
              </span>
            )}
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
            <Save className="w-4 h-4" />
            Saved
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

      {/* ─── On-Call Team Contacts (phones) ─────────────────────────────── */}
      {!loading && shifts.length > 0 && (() => {
        const now = new Date();
        const todayShift = shifts.find(s => { try { return now >= parseISO(s.start_date) && now < parseISO(s.end_date); } catch { return false; } });
        const srPhone = todayShift?.senior_registrar_phone || seniorRegs.find(u => u.id === todayShift?.senior_registrar_id)?.phone || '';
        const rPhone = todayShift?.registrar_phone || registrars.find(u => u.id === todayShift?.registrar_id)?.phone || '';
        const contacts: { role: string; name?: string; phone?: string; color: string }[] = todayShift ? [
          { role: 'Senior Registrar', name: todayShift.senior_registrar_name, phone: srPhone, color: 'text-purple-700' },
          { role: 'Registrar', name: todayShift.registrar_name, phone: rPhone, color: 'text-blue-700' },
          { role: 'House Officer (Ward)', name: todayShift.ho_ward_name, phone: todayShift.ho_ward_phone, color: 'text-green-700' },
          ...(todayShift.ho_emergency_id && todayShift.ho_emergency_id !== todayShift.ho_ward_id
            ? [{ role: 'House Officer (Emergency)', name: todayShift.ho_emergency_name, phone: todayShift.ho_emergency_phone, color: 'text-orange-700' }] : []),
        ] : [];
        return (
          <div className="bg-white rounded-xl shadow-sm border p-4 mb-4">
            <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
              <Users className="w-4 h-4 text-green-600" /> On-Call Team Contacts {todayShift ? '(today)' : ''}
            </h3>
            {/* Consultants */}
            <div className="mb-3">
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">Consultants</p>
              {consultants.length === 0 ? (
                <p className="text-xs text-gray-400">No consultants registered.</p>
              ) : (
                <div className="flex flex-wrap gap-x-4 gap-y-1">
                  {consultants.map(c => (
                    <div key={c.id} className="text-sm flex items-center gap-1 flex-wrap">
                      <span className="text-gray-800 font-medium">{c.full_name}</span>
                      {c.phone ? <PhoneActions phone={c.phone} compact /> : <span className="text-xs text-gray-400">no phone</span>}
                    </div>
                  ))}
                </div>
              )}
            </div>
            {/* Today's rostered team */}
            {todayShift ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {contacts.map((c, i) => (
                  <div key={i} className="flex items-center justify-between gap-2 border border-gray-100 rounded-lg px-3 py-1.5">
                    <div className="text-sm min-w-0">
                      <span className="text-gray-500">{c.role}:</span>{' '}
                      <span className={`font-medium ${c.color}`}>{c.name || 'TBD'}</span>
                    </div>
                    {c.phone ? <PhoneActions phone={c.phone} compact /> : <span className="text-xs text-gray-400">no phone</span>}
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-gray-400">No shift is currently on call. See the roster below.</p>
            )}
          </div>
        );
      })()}

      {/* ─── Table View ─────────────────────────────────────────────────── */}
      {!loading && shifts.length > 0 && viewMode === 'table' && (
        <div className="bg-white rounded-xl shadow-sm border overflow-hidden" ref={printRef}>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-green-600 text-white">
                  <th className="px-3 py-3 text-left font-semibold w-10">#</th>
                  <th className="px-3 py-3 text-left font-semibold">Shift Start</th>
                  <th className="px-3 py-3 text-left font-semibold">Shift End</th>
                  <th className="px-3 py-3 text-left font-semibold">Senior Registrar</th>
                  <th className="px-3 py-3 text-left font-semibold">Registrar</th>
                  <th className="px-3 py-3 text-left font-semibold">
                    <span className="flex items-center gap-1"><Building2 className="w-3 h-3" /> HO Ward</span>
                  </th>
                  <th className="px-3 py-3 text-left font-semibold">
                    <span className="flex items-center gap-1"><Siren className="w-3 h-3" /> HO Emergency</span>
                  </th>
                  <th className="px-3 py-3 text-left font-semibold">
                    <span className="flex items-center gap-1"><Coffee className="w-3 h-3" /> HO Off</span>
                  </th>
                  <th className="px-3 py-3 text-center font-semibold w-16">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {shifts.map(shift => {
                  const shiftStart = parseISO(shift.start_date);
                  const shiftEnd = parseISO(shift.end_date);
                  const isToday = isSameDay(shiftStart, new Date()) || (new Date() >= shiftStart && new Date() < shiftEnd);
                  const isEditing = editingShiftId === shift.id;
                  const shiftNotes = handoverNotes.filter(n => n.shift_id === shift.id);

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
                      hasNotes={shiftNotes.length > 0}
                      onEdit={() => startEdit(shift.id!)}
                      onSave={saveEdit}
                      onCancel={cancelEdit}
                      onOpenHandover={() => { setViewMode('handover'); openNoteEditor(shift); }}
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
            const firstDow = new Date(chunk.year, chunk.month, chunk.startDay).getDay();
            const dayCount = chunk.endDay - chunk.startDay + 1;

            return (
              <div key={`${chunk.year}-${chunk.month}`} className="bg-white rounded-xl shadow-sm border p-4">
                <h3 className="text-lg font-semibold text-gray-800 mb-3">
                  {MONTH_NAMES_SHORT[chunk.month]} {chunk.year}
                </h3>
                <div className="grid grid-cols-7 gap-1 mb-2">
                  {DAY_NAMES.map(d => (
                    <div key={d} className="text-center text-xs font-semibold text-gray-500 py-1">{d}</div>
                  ))}
                </div>
                <div className="grid grid-cols-7 gap-1">
                  {Array.from({ length: firstDow }).map((_, i) => (
                    <div key={`empty-${i}`} className="min-h-[90px]" />
                  ))}
                  {Array.from({ length: dayCount }).map((_, i) => {
                    const day = chunk.startDay + i;
                    const date = new Date(chunk.year, chunk.month, day);
                    const shift = getShiftForDate(date);
                    const isToday = isSameDay(date, new Date());
                    const is2HO = shift && shift.ho_ward_id === shift.ho_emergency_id;
                    return (
                      <div
                        key={day}
                        className={`min-h-[90px] border rounded-lg p-1 text-xs ${
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
                            {shift.ho_ward_id ? (
                              <>
                                <div className="truncate text-green-700" title={`${is2HO ? 'Ward+ER' : 'Ward'}: ${shift.ho_ward_name}${shift.ho_ward_phone ? ' | ☎ ' + shift.ho_ward_phone : ''}`}>
                                  <span className="font-semibold">{is2HO ? 'W+E:' : 'W:'}</span> {shift.ho_ward_name.split(' ').slice(-1)}
                                  {shift.ho_ward_phone && <span className="text-[9px] text-green-500 ml-0.5">📞</span>}
                                </div>
                                {!is2HO && shift.ho_emergency_id && (
                                  <div className="truncate text-orange-700" title={`Emergency: ${shift.ho_emergency_name}${shift.ho_emergency_phone ? ' | ☎ ' + shift.ho_emergency_phone : ''}`}>
                                    <span className="font-semibold">E:</span> {shift.ho_emergency_name.split(' ').slice(-1)}
                                    {shift.ho_emergency_phone && <span className="text-[9px] text-orange-500 ml-0.5">📞</span>}
                                  </div>
                                )}
                                {shift.ho_off_id && (
                                  <div className="truncate text-gray-400" title={`Off: ${shift.ho_off_name}${shift.ho_off_phone ? ' | ☎ ' + shift.ho_off_phone : ''}`}>
                                    <span className="font-semibold">Off:</span> {shift.ho_off_name.split(' ').slice(-1)}
                                  </div>
                                )}
                              </>
                            ) : (
                              <div className="truncate text-green-700" title={shift.house_officer_name}>
                                <span className="font-semibold">HO:</span> {shift.house_officer_name.split(' ').slice(-1)}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
          <div className="flex items-center gap-4 text-xs text-gray-500 justify-center flex-wrap">
            <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-purple-200 border border-purple-400" /> Senior Registrar</span>
            <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-blue-200 border border-blue-400" /> Registrar</span>
            <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-green-200 border border-green-400" /> HO Ward</span>
            <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-orange-200 border border-orange-400" /> HO Emergency</span>
            <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-gray-200 border border-gray-300" /> HO Off</span>
          </div>
        </div>
      )}

      {/* ─── Handover Notes View ─────────────────────────────────────────── */}
      {!loading && viewMode === 'handover' && (
        <div className="space-y-4">
          {/* Write handover note panel */}
          {selectedShiftForNote ? (
            <div className="bg-white rounded-xl shadow-sm border p-5">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                  <FileText className="w-5 h-5 text-green-600" />
                  {editingNoteId ? 'Edit Handover Note' : 'Write Handover Note'}
                </h3>
                <button onClick={() => setSelectedShiftForNote(null)} className="p-1 hover:bg-gray-100 rounded" title="Close">
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="text-sm text-gray-600 mb-3">
                Shift #{selectedShiftForNote.shift_number}: {format(parseISO(selectedShiftForNote.start_date), 'EEE dd MMM yyyy HH:mm')} → {format(parseISO(selectedShiftForNote.end_date), 'EEE dd MMM yyyy HH:mm')}
              </div>
              <div className="mb-3">
                <label htmlFor="ho-assignment" className="block text-sm font-medium text-gray-700 mb-1">Your Assignment</label>
                <select id="ho-assignment" value={noteAssignment} onChange={e => setNoteAssignment(e.target.value as HOAssignment)} className="border rounded-lg px-3 py-2 text-sm w-full sm:w-auto">
                  <option value="ward">Ward</option>
                  <option value="emergency">Emergency</option>
                  <option value="ward_and_emergency">Ward & Emergency</option>
                </select>
              </div>
              <div className="mb-3">
                <label htmlFor="handover-content" className="block text-sm font-medium text-gray-700 mb-1">Handover Summary</label>
                <textarea
                  id="handover-content"
                  value={noteContent}
                  onChange={e => setNoteContent(e.target.value)}
                  rows={4}
                  placeholder="Summarize your call: key events, patients seen, pending results, concerns..."
                  className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-green-500 focus:border-green-500"
                />
              </div>
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">Outstanding Tasks / Items to Follow Up</label>
                <div className="flex gap-2 mb-2">
                  <input
                    type="text"
                    value={newTaskText}
                    onChange={e => setNewTaskText(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') addTask(); }}
                    placeholder="Add a task..."
                    className="flex-1 border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-green-500 focus:border-green-500"
                    aria-label="New handover task"
                  />
                  <button onClick={addTask} className="px-3 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 flex items-center gap-1 text-sm">
                    <Plus className="w-4 h-4" /> Add
                  </button>
                </div>
                {noteTasks.length > 0 && (
                  <ul className="space-y-1">
                    {noteTasks.map(t => (
                      <li key={t.id} className="flex items-center gap-2 px-3 py-2 bg-yellow-50 border border-yellow-200 rounded-lg text-sm">
                        <ClipboardList className="w-4 h-4 text-yellow-600 flex-shrink-0" />
                        <span className="flex-1">{t.text}</span>
                        <button onClick={() => removeTask(t.id)} className="p-1 hover:bg-red-100 rounded text-red-500" title="Remove task">
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              <div className="flex gap-2">
                <button onClick={saveHandoverNote} disabled={!noteContent.trim()} className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 flex items-center gap-2 text-sm font-medium">
                  <Save className="w-4 h-4" /> Save Handover Note
                </button>
                <button onClick={() => setSelectedShiftForNote(null)} className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 text-sm">
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            /* Select a shift to write a note */
            <div className="bg-white rounded-xl shadow-sm border p-5">
              <h3 className="text-lg font-semibold text-gray-900 mb-3 flex items-center gap-2">
                <FileText className="w-5 h-5 text-green-600" />
                Handover Notes — {rangeLabel}
              </h3>
              <p className="text-sm text-gray-500 mb-4">
                House Officers must submit handover notes before 08:00 at the end of each 48-hour call shift. Select a shift to write or view notes.
              </p>
              {shifts.length === 0 ? (
                <p className="text-gray-400 text-center py-8">Generate a roster first.</p>
              ) : (
                <div className="space-y-2">
                  {shifts.map(shift => {
                    const ss = parseISO(shift.start_date);
                    const se = parseISO(shift.end_date);
                    const isActive = new Date() >= ss && new Date() < se;
                    const shiftNotes = handoverNotes.filter(n => n.shift_id === shift.id);
                    return (
                      <div key={shift.id} className={`flex items-center justify-between p-3 rounded-lg border ${isActive ? 'border-green-400 bg-green-50' : 'border-gray-200'}`}>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-sm">Shift #{shift.shift_number}</span>
                            {isActive && <span className="text-xs px-2 py-0.5 bg-green-600 text-white rounded-full">ACTIVE</span>}
                          </div>
                          <div className="text-xs text-gray-500 mt-0.5">
                            {format(ss, 'EEE dd MMM HH:mm')} → {format(se, 'EEE dd MMM HH:mm')}
                          </div>
                          <div className="text-xs text-gray-500 mt-0.5">
                            {shift.ho_ward_id === shift.ho_emergency_id
                              ? `Ward+ER: ${shift.ho_ward_name}`
                              : `Ward: ${shift.ho_ward_name} | ER: ${shift.ho_emergency_name}`}
                            {shift.ho_off_name ? ` | Off: ${shift.ho_off_name}` : ''}
                          </div>
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          {shiftNotes.length > 0 && (
                            <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">{shiftNotes.length} note{shiftNotes.length > 1 ? 's' : ''}</span>
                          )}
                          <button onClick={() => openNoteEditor(shift)} className="px-3 py-1.5 bg-green-600 text-white rounded-lg hover:bg-green-700 text-xs font-medium flex items-center gap-1">
                            <FileText className="w-3 h-3" /> {shiftNotes.length > 0 ? 'View / Add' : 'Write Note'}
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* Existing handover notes display */}
          {handoverNotes.length > 0 && !selectedShiftForNote && (
            <div className="bg-white rounded-xl shadow-sm border p-5">
              <h3 className="text-lg font-semibold text-gray-900 mb-3">All Handover Notes</h3>
              <div className="space-y-3">
                {handoverNotes
                  .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
                  .map(note => {
                    const shift = shifts.find(s => s.id === note.shift_id);
                    return (
                      <div key={note.id} className="border rounded-lg p-4">
                        <div className="flex items-center justify-between mb-2">
                          <div>
                            <span className="font-medium text-sm">{note.author_name}</span>
                            <span className={`ml-2 text-xs px-2 py-0.5 rounded-full ${
                              note.assignment === 'ward' ? 'bg-green-100 text-green-700' :
                              note.assignment === 'emergency' ? 'bg-orange-100 text-orange-700' :
                              'bg-blue-100 text-blue-700'
                            }`}>
                              {ASSIGNMENT_LABELS[note.assignment]}
                            </span>
                          </div>
                          <div className="text-xs text-gray-400">
                            {shift && `Shift #${shift.shift_number} • `}
                            {format(new Date(note.created_at), 'dd MMM yyyy HH:mm')}
                          </div>
                        </div>
                        <p className="text-sm text-gray-700 whitespace-pre-line mb-2">{note.content}</p>
                        {note.tasks.length > 0 && (
                          <div>
                            <p className="text-xs font-semibold text-gray-500 mb-1">Outstanding Tasks:</p>
                            <ul className="space-y-1">
                              {note.tasks.map(task => (
                                <li key={task.id} className={`flex items-center gap-2 px-2 py-1.5 rounded text-sm ${task.status === 'completed' ? 'bg-green-50' : 'bg-yellow-50'}`}>
                                  {task.status === 'outstanding' ? (
                                    <button onClick={() => handleCompleteTask(note.id!, task.id)} className="p-0.5 bg-green-100 hover:bg-green-200 rounded text-green-700" title="Mark complete">
                                      <Check className="w-3 h-3" />
                                    </button>
                                  ) : (
                                    <button onClick={() => handleReopenTask(note.id!, task.id)} className="p-0.5 bg-gray-100 hover:bg-gray-200 rounded text-gray-500" title="Reopen">
                                      <RotateCcw className="w-3 h-3" />
                                    </button>
                                  )}
                                  <span className={task.status === 'completed' ? 'line-through text-gray-400' : 'text-gray-700'}>{task.text}</span>
                                  {task.completed_by_name && (
                                    <span className="text-xs text-green-600 ml-auto">✓ {task.completed_by_name}</span>
                                  )}
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                        <button
                          onClick={() => openNoteEditor(shift!, note)}
                          className="mt-2 text-xs text-blue-600 hover:underline flex items-center gap-1"
                        >
                          <Edit3 className="w-3 h-3" /> Edit
                        </button>
                      </div>
                    );
                  })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ─── Outstanding Tasks View ──────────────────────────────────────── */}
      {!loading && viewMode === 'tasks' && (
        <div className="bg-white rounded-xl shadow-sm border p-5">
          <h3 className="text-lg font-semibold text-gray-900 mb-1 flex items-center gap-2">
            <ClipboardList className="w-5 h-5 text-red-500" />
            Outstanding Tasks — {rangeLabel}
          </h3>
          <p className="text-sm text-gray-500 mb-4">Tasks from handover notes that have not been completed. These are your responsibility if you are the incoming HO.</p>
          {outstandingTasks.length === 0 ? (
            <div className="text-center py-8 text-gray-400">
              <CheckCircle2 className="w-12 h-12 mx-auto mb-2 text-green-300" />
              <p>No outstanding tasks. All clear!</p>
            </div>
          ) : (
            <div className="space-y-2">
              {outstandingTasks.map(task => {
                const shift = shifts.find(s => s.id === task.shift_id);
                return (
                  <div key={`${task.note_id}-${task.id}`} className="flex items-center gap-3 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                    <button
                      onClick={() => handleCompleteTask(task.note_id, task.id)}
                      className="p-1.5 bg-green-100 hover:bg-green-200 rounded text-green-700 flex-shrink-0"
                      title="Mark as completed"
                    >
                      <Check className="w-4 h-4" />
                    </button>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-sm text-gray-900">{task.text}</div>
                      <div className="text-xs text-gray-500 mt-0.5">
                        From: {task.author_name}
                        <span className={`ml-1.5 px-1.5 py-0.5 rounded text-xs ${
                          task.assignment === 'ward' ? 'bg-green-100 text-green-700' :
                          task.assignment === 'emergency' ? 'bg-orange-100 text-orange-700' :
                          'bg-blue-100 text-blue-700'
                        }`}>{ASSIGNMENT_LABELS[task.assignment]}</span>
                        {shift && <span className="ml-1.5">• Shift #{shift.shift_number}</span>}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Info footer */}
      <div className="text-xs text-gray-400 text-center space-y-1">
        <p>Each call duty shift runs for <strong>48 continuous hours</strong> (08:00 → 08:00 +2 days).</p>
        <p>3 House Officers → Ward / Emergency / Off rotation. 2 House Officers → Ward+Emergency / Off alternating.</p>
        <p>Handover notes must be submitted <strong>before 08:00</strong> at the end of each shift.</p>
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
  hasNotes: boolean;
  onEdit: () => void;
  onSave: (shift: CallDutyShift) => void;
  onCancel: () => void;
  onOpenHandover: () => void;
}

function ShiftRow({
  shift, startDate, endDate, isToday, isEditing,
  seniorRegs, registrars, houseOfficers, hasNotes,
  onEdit, onSave, onCancel, onOpenHandover,
}: ShiftRowProps) {
  const [localShift, setLocalShift] = useState(shift);

  useEffect(() => {
    setLocalShift(shift);
  }, [shift]);

  const handleStaffChange = (role: 'sr' | 'r' | 'ho_ward' | 'ho_emergency' | 'ho_off', userId: string, pool: StaffMember[]) => {
    const staff = pool.find(s => s.id === userId);
    if (!staff) return;
    if (role === 'sr') setLocalShift(s => ({ ...s, senior_registrar_id: staff.id, senior_registrar_name: staff.full_name }));
    if (role === 'r') setLocalShift(s => ({ ...s, registrar_id: staff.id, registrar_name: staff.full_name }));
    if (role === 'ho_ward') setLocalShift(s => ({ ...s, ho_ward_id: staff.id, ho_ward_name: staff.full_name, ho_ward_phone: staff.phone, house_officer_id: staff.id, house_officer_name: staff.full_name }));
    if (role === 'ho_emergency') setLocalShift(s => ({ ...s, ho_emergency_id: staff.id, ho_emergency_name: staff.full_name, ho_emergency_phone: staff.phone }));
    if (role === 'ho_off') setLocalShift(s => ({ ...s, ho_off_id: staff.id, ho_off_name: staff.full_name, ho_off_phone: staff.phone }));
  };

  const is2HO = shift.ho_ward_id && shift.ho_ward_id === shift.ho_emergency_id;

  return (
    <tr className={`${isToday ? 'bg-green-50 border-l-4 border-l-green-500' : 'hover:bg-gray-50'}`}>
      <td className="px-3 py-3 font-bold text-gray-600">{shift.shift_number}</td>
      <td className="px-3 py-3">
        <div className="flex items-center gap-2">
          <Clock className="w-4 h-4 text-gray-400" />
          <div>
            <div className="font-medium">{format(startDate, 'EEE, dd MMM yyyy')}</div>
            <div className="text-xs text-gray-400">08:00 hrs</div>
          </div>
        </div>
      </td>
      <td className="px-3 py-3">
        <div>
          <div className="font-medium">{format(endDate, 'EEE, dd MMM yyyy')}</div>
          <div className="text-xs text-gray-400">08:00 hrs</div>
        </div>
      </td>

      {/* Senior Registrar */}
      <td className="px-3 py-3">
        {isEditing ? (
          <select className="w-full border rounded px-2 py-1 text-sm" value={localShift.senior_registrar_id} onChange={e => handleStaffChange('sr', e.target.value, seniorRegs)} aria-label="Senior Registrar">
            {seniorRegs.map(s => <option key={s.id} value={s.id}>{s.full_name}</option>)}
          </select>
        ) : (
          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded border text-xs font-medium ${ROLE_COLORS.senior_registrar}`}>
            <Users className="w-3 h-3" /> {shift.senior_registrar_name}
          </span>
        )}
      </td>

      {/* Registrar */}
      <td className="px-3 py-3">
        {isEditing ? (
          <select className="w-full border rounded px-2 py-1 text-sm" value={localShift.registrar_id} onChange={e => handleStaffChange('r', e.target.value, registrars)} aria-label="Registrar">
            {registrars.map(s => <option key={s.id} value={s.id}>{s.full_name}</option>)}
          </select>
        ) : (
          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded border text-xs font-medium ${ROLE_COLORS.registrar}`}>
            <Users className="w-3 h-3" /> {shift.registrar_name}
          </span>
        )}
      </td>

      {/* HO Ward */}
      <td className="px-3 py-3">
        {isEditing ? (
          <select className="w-full border rounded px-2 py-1 text-sm" value={localShift.ho_ward_id} onChange={e => handleStaffChange('ho_ward', e.target.value, houseOfficers)} aria-label="HO Ward">
            {houseOfficers.map(s => <option key={s.id} value={s.id}>{s.full_name}</option>)}
          </select>
        ) : (
          <div>
            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded border text-xs font-medium ${ROLE_COLORS.ho_ward}`}>
              <Building2 className="w-3 h-3" /> {shift.ho_ward_name || shift.house_officer_name}
              {is2HO && <span className="text-[10px] opacity-70">+ER</span>}
            </span>
            {shift.ho_ward_phone && (
              <div className="flex items-center gap-1 mt-0.5 text-[11px] text-gray-500">
                <Phone className="w-3 h-3" />
                <a href={`tel:${shift.ho_ward_phone}`} className="hover:text-green-700 hover:underline">{shift.ho_ward_phone}</a>
              </div>
            )}
          </div>
        )}
      </td>

      {/* HO Emergency */}
      <td className="px-3 py-3">
        {isEditing ? (
          <select className="w-full border rounded px-2 py-1 text-sm" value={localShift.ho_emergency_id} onChange={e => handleStaffChange('ho_emergency', e.target.value, houseOfficers)} aria-label="HO Emergency">
            {houseOfficers.map(s => <option key={s.id} value={s.id}>{s.full_name}</option>)}
          </select>
        ) : is2HO ? (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded border text-xs font-medium bg-orange-50 text-orange-400 border-orange-200 italic">
            Same as Ward
          </span>
        ) : (
          <div>
            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded border text-xs font-medium ${ROLE_COLORS.ho_emergency}`}>
              <Siren className="w-3 h-3" /> {shift.ho_emergency_name}
            </span>
            {shift.ho_emergency_phone && (
              <div className="flex items-center gap-1 mt-0.5 text-[11px] text-gray-500">
                <Phone className="w-3 h-3" />
                <a href={`tel:${shift.ho_emergency_phone}`} className="hover:text-orange-700 hover:underline">{shift.ho_emergency_phone}</a>
              </div>
            )}
          </div>
        )}
      </td>

      {/* HO Off */}
      <td className="px-3 py-3">
        {isEditing ? (
          <select className="w-full border rounded px-2 py-1 text-sm" value={localShift.ho_off_id} onChange={e => handleStaffChange('ho_off', e.target.value, houseOfficers)} aria-label="HO Off">
            <option value="">None</option>
            {houseOfficers.map(s => <option key={s.id} value={s.id}>{s.full_name}</option>)}
          </select>
        ) : shift.ho_off_id ? (
          <div>
            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded border text-xs font-medium ${ROLE_COLORS.ho_off}`}>
              <Coffee className="w-3 h-3" /> {shift.ho_off_name}
            </span>
            {shift.ho_off_phone && (
              <div className="flex items-center gap-1 mt-0.5 text-[11px] text-gray-500">
                <Phone className="w-3 h-3" />
                <a href={`tel:${shift.ho_off_phone}`} className="hover:text-gray-600 hover:underline">{shift.ho_off_phone}</a>
              </div>
            )}
          </div>
        ) : (
          <span className="text-xs text-gray-300">—</span>
        )}
      </td>

      {/* Actions */}
      <td className="px-3 py-3 text-center">
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
          <div className="flex items-center justify-center gap-1">
            <button onClick={onEdit} className="p-1.5 hover:bg-gray-100 rounded text-gray-500" title="Edit shift">
              <Edit3 className="w-4 h-4" />
            </button>
            <button onClick={onOpenHandover} className={`p-1.5 hover:bg-gray-100 rounded ${hasNotes ? 'text-green-600' : 'text-gray-400'}`} title="Handover note">
              <FileText className="w-4 h-4" />
            </button>
          </div>
        )}
      </td>
    </tr>
  );
}

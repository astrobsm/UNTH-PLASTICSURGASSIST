import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  ClipboardList,
  Plus,
  CheckCircle2,
  Clock,
  AlertCircle,
  AlertTriangle,
  XCircle,
  ChevronDown,
  ChevronUp,
  Search,
  Filter,
  Activity,
  Calendar,
  User,
  Users,
  Download,
  RefreshCw,
  Stethoscope,
  Scissors,
  FileText,
  Syringe,
  Eye,
  BarChart3,
  X,
  Save,
  Flame,
} from 'lucide-react';
import {
  clinicDutyService,
  ClinicDutyLog,
  DutyCategory,
  DutyDefinition,
  DutyType,
  DUTY_DEFINITIONS,
  getDutyDefinitionsForRole,
  getDutyLabel,
} from '../services/clinicDutyService';
import { useAuthStore } from '../store/authStore';
import { format, parseISO, startOfWeek, endOfWeek, addWeeks, subWeeks } from 'date-fns';

// ─── Helpers ────────────────────────────────────────────────────────────────

const ROLE_LABELS: Record<DutyCategory, string> = {
  house_officer: 'House Officer',
  registrar: 'Registrar',
  senior_registrar: 'Senior Registrar',
};

const ROLE_COLORS: Record<DutyCategory, string> = {
  house_officer: 'bg-green-100 text-green-800 border-green-300',
  registrar: 'bg-blue-100 text-blue-800 border-blue-300',
  senior_registrar: 'bg-purple-100 text-purple-800 border-purple-300',
};

const STATUS_CONFIG: Record<string, { icon: any; color: string; label: string }> = {
  assigned: { icon: Clock, color: 'text-yellow-600 bg-yellow-50', label: 'Assigned' },
  in_progress: { icon: RefreshCw, color: 'text-blue-600 bg-blue-50', label: 'In Progress' },
  completed: { icon: CheckCircle2, color: 'text-green-600 bg-green-50', label: 'Completed' },
  missed: { icon: XCircle, color: 'text-red-600 bg-red-50', label: 'Missed' },
  deferred: { icon: Clock, color: 'text-gray-600 bg-gray-50', label: 'Deferred' },
};

const DUTY_ICONS: Partial<Record<DutyType, any>> = {
  weekly_patient_report: FileText,
  surgery_scheduling: Calendar,
  wound_inspection: Eye,
  consultant_documentation: FileText,
  clerking_presentation: Stethoscope,
  bedside_debridement: Scissors,
  intralesional_injection: Syringe,
  wound_inspection_sr: Eye,
  follow_up_review: Users,
};

function getISOWeek(date: Date): number {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + 3 - ((d.getDay() + 6) % 7));
  const week1 = new Date(d.getFullYear(), 0, 4);
  return 1 + Math.round(((d.getTime() - week1.getTime()) / 86400000 - 3 + ((week1.getDay() + 6) % 7)) / 7);
}

// ─── Component ──────────────────────────────────────────────────────────────

export default function ClinicDutiesPage() {
  const { user } = useAuthStore();
  const now = new Date();

  // Tabs
  const [activeTab, setActiveTab] = useState<'log' | 'my_duties' | 'weekly_report' | 'duty_board' | 'tuesday_preview'>('tuesday_preview');

  // Filters
  const [roleFilter, setRoleFilter] = useState<DutyCategory | 'all'>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [searchText, setSearchText] = useState('');
  const [weekOffset, setWeekOffset] = useState(0); // 0 = current week

  // Data
  const [logs, setLogs] = useState<ClinicDutyLog[]>([]);
  const [weeklySummary, setWeeklySummary] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // New duty form
  const [showNewForm, setShowNewForm] = useState(false);
  const [staffList, setStaffList] = useState<{ id: string; full_name: string; role: string }[]>([]);

  // Computed week dates
  const selectedWeekStart = startOfWeek(addWeeks(now, weekOffset), { weekStartsOn: 1 });
  const selectedWeekEnd = endOfWeek(addWeeks(now, weekOffset), { weekStartsOn: 1 });
  const selectedWeekNum = getISOWeek(selectedWeekStart);
  const selectedYear = selectedWeekStart.getFullYear();

  // ── Load data ──────────────────────────────────────────────────────────

  const loadLogs = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const filters: any = {};
      if (roleFilter !== 'all') filters.user_role = roleFilter;
      if (statusFilter !== 'all') filters.status = statusFilter;
      const data = await clinicDutyService.getLogs(filters);
      setLogs(data);
    } catch (err: any) {
      setError(err.message || 'Failed to load duty logs');
    } finally {
      setLoading(false);
    }
  }, [roleFilter, statusFilter]);

  const loadWeeklySummary = useCallback(async () => {
    setLoading(true);
    try {
      const data = await clinicDutyService.getWeeklySummary(selectedWeekNum, selectedYear);
      setWeeklySummary(data);
    } catch (err: any) {
      setError(err.message || 'Failed to load weekly summary');
    } finally {
      setLoading(false);
    }
  }, [selectedWeekNum, selectedYear]);

  const loadStaff = useCallback(async () => {
    try {
      const [sr, reg, ho] = await Promise.all([
        clinicDutyService.getStaffByRole('senior_registrar'),
        clinicDutyService.getStaffByRole('junior_registrar'),
        clinicDutyService.getStaffByRole('house_officer'),
      ]);
      setStaffList([...sr, ...reg, ...ho]);
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    if (activeTab === 'weekly_report') {
      loadWeeklySummary();
    } else {
      loadLogs();
    }
  }, [activeTab, loadLogs, loadWeeklySummary]);

  // ── Quick-complete a duty ──────────────────────────────────────────────

  const handleComplete = async (id: number, notes?: string) => {
    try {
      await clinicDutyService.completeDuty(id, notes);
      setSuccess('Duty marked as completed.');
      loadLogs();
    } catch {
      setError('Failed to complete duty.');
    }
  };

  const handleStatusChange = async (id: number, status: string) => {
    try {
      await clinicDutyService.updateDutyLog(id, { status } as any);
      loadLogs();
    } catch {
      setError('Failed to update status.');
    }
  };

  // ── Filtered & searched logs ───────────────────────────────────────────

  const filteredLogs = logs.filter(l => {
    if (searchText) {
      const q = searchText.toLowerCase();
      return (
        (l as any).user_name?.toLowerCase().includes(q) ||
        (l as any).description?.toLowerCase().includes(q) ||
        (l as any).patient_name?.toLowerCase().includes(q) ||
        getDutyLabel(l.duty_type).toLowerCase().includes(q)
      );
    }
    return true;
  });

  // ── Generate PDF report ────────────────────────────────────────────────

  const generateWeeklyPDF = () => {
    const weekLabel = `Week ${selectedWeekNum} — ${format(selectedWeekStart, 'dd MMM')} to ${format(selectedWeekEnd, 'dd MMM yyyy')}`;

    const roleBlocks = (['senior_registrar', 'registrar', 'house_officer'] as DutyCategory[]).map(role => {
      const peopleLogs = weeklySummary.filter(s => s.role === role);
      if (peopleLogs.length === 0) return '';

      const rows = peopleLogs.map(p => {
        const dutyRows = p.duties.map((d: any) => `
          <tr>
            <td style="border:1px solid #999;padding:5px;font-size:12px;">${getDutyLabel(d.duty_type)}</td>
            <td style="border:1px solid #999;padding:5px;font-size:12px;">${d.patient_name || '—'}</td>
            <td style="border:1px solid #999;padding:5px;font-size:12px;">${d.description || ''}</td>
            <td style="border:1px solid #999;padding:5px;font-size:12px;text-align:center;">${d.status}</td>
            <td style="border:1px solid #999;padding:5px;font-size:12px;">${d.completed_date ? format(parseISO(d.completed_date), 'dd MMM HH:mm') : '—'}</td>
          </tr>`).join('');

        return `
          <tr style="background:#f0fdf4;">
            <td colspan="5" style="padding:8px;font-weight:600;border:1px solid #999;">${p.user_name} — ${p.completed}/${p.total} duties completed</td>
          </tr>
          ${dutyRows}`;
      }).join('');

      return `
        <h3 style="color:#0E9F6E;margin-top:20px;">${ROLE_LABELS[role]}s</h3>
        <table style="width:100%;border-collapse:collapse;margin-bottom:10px;">
          <thead>
            <tr style="background:#0E9F6E;color:white;">
              <th style="border:1px solid #0E9F6E;padding:6px;">Duty</th>
              <th style="border:1px solid #0E9F6E;padding:6px;">Patient</th>
              <th style="border:1px solid #0E9F6E;padding:6px;">Description</th>
              <th style="border:1px solid #0E9F6E;padding:6px;text-align:center;">Status</th>
              <th style="border:1px solid #0E9F6E;padding:6px;">Completed</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>`;
    }).join('');

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Clinic Duties Report — ${weekLabel}</title>
        <style>
          @page { size: A4 landscape; margin: 15mm; }
          body { font-family: 'Segoe UI', Arial, sans-serif; color: #222; padding: 20px; }
          .header { text-align: center; margin-bottom: 20px; }
          .header h1 { font-size: 16px; margin: 0; text-transform: uppercase; }
          .header h2 { font-size: 20px; margin: 6px 0; color: #0E9F6E; }
          .header h3 { font-size: 14px; margin: 4px 0; font-weight: normal; color: #555; }
          .header .line { border-top: 3px solid #0E9F6E; margin: 12px auto; width: 80%; }
          .footer { margin-top: 30px; font-size: 11px; color: #888; text-align: center; }
          @media print { body { padding: 0; } }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>University of Nigeria Teaching Hospital (UNTH), Enugu</h1>
          <h2>Plastic Surgery Unit — Clinic Duty Report</h2>
          <div class="line"></div>
          <h3>${weekLabel}</h3>
        </div>
        ${roleBlocks || '<p>No duty logs recorded for this week.</p>'}
        <div class="footer">
          <p>Generated on ${format(new Date(), 'PPPp')} | Plastic Surgeon Assistant — UNTH Enugu</p>
        </div>
      </body>
      </html>`;

    const blob = new Blob([html], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const win = window.open(url, '_blank');
    if (win) {
      win.onload = () => setTimeout(() => win.print(), 500);
    }
  };

  // ─── RENDER ───────────────────────────────────────────────────────────

  return (
    <div className="max-w-7xl mx-auto px-4 py-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <ClipboardList className="w-7 h-7 text-green-600" />
            Clinic Duties & Tracking
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Assign, track and log clinical duties for House Officers, Registrars &amp; Senior Registrars
          </p>
        </div>

        <button
          onClick={() => { setShowNewForm(true); loadStaff(); }}
          className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 flex items-center gap-2 text-sm font-medium self-start"
        >
          <Plus className="w-4 h-4" /> Log New Duty
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 p-1 rounded-xl overflow-x-auto">
        {([
          { id: 'tuesday_preview', label: 'Tuesday Clinic', icon: Calendar },
          { id: 'duty_board', label: 'Duty Board', icon: ClipboardList },
          { id: 'my_duties', label: 'My Duties', icon: User },
          { id: 'weekly_report', label: 'Weekly Report', icon: BarChart3 },
          { id: 'log', label: 'All Logs', icon: FileText },
        ] as const).map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex-1 px-4 py-2 rounded-lg text-sm font-medium flex items-center justify-center gap-2 transition-all whitespace-nowrap ${
              activeTab === tab.id
                ? 'bg-white text-green-700 shadow-sm'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            <tab.icon className="w-4 h-4" /> {tab.label}
          </button>
        ))}
      </div>

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

      {/* ─── NEW DUTY MODAL ─────────────────────────────────────────────── */}
      {showNewForm && (
        <NewDutyForm
          staffList={staffList}
          currentUser={user}
          onSave={async (entry) => {
            try {
              await clinicDutyService.logDuty(entry);
              setSuccess('Duty logged successfully.');
              setShowNewForm(false);
              loadLogs();
            } catch (err: any) {
              setError(err.message || 'Failed to log duty');
            }
          }}
          onCancel={() => setShowNewForm(false)}
        />
      )}

      {/* ─── TUESDAY CLINIC PREVIEW TAB ─────────────────────────────────── */}
      {activeTab === 'tuesday_preview' && (
        <TuesdayClinicPreview />
      )}

      {/* ─── DUTY BOARD TAB ─────────────────────────────────────────────── */}
      {activeTab === 'duty_board' && (
        <DutyBoard />
      )}

      {/* ─── MY DUTIES TAB ──────────────────────────────────────────────── */}
      {activeTab === 'my_duties' && (
        <MyDutiesView
          userId={user?.id}
          userName={user?.name}
          onComplete={handleComplete}
          onStatusChange={handleStatusChange}
        />
      )}

      {/* ─── WEEKLY REPORT TAB ──────────────────────────────────────────── */}
      {activeTab === 'weekly_report' && (
        <div className="space-y-4">
          {/* Week navigator */}
          <div className="bg-white rounded-xl shadow-sm border p-4 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <button onClick={() => setWeekOffset(w => w - 1)} className="p-2 hover:bg-gray-100 rounded-lg">
                <ChevronDown className="w-5 h-5 rotate-90" />
              </button>
              <div className="text-center">
                <div className="text-lg font-semibold text-gray-900">
                  Week {selectedWeekNum}, {selectedYear}
                </div>
                <div className="text-sm text-gray-500">
                  {format(selectedWeekStart, 'dd MMM')} — {format(selectedWeekEnd, 'dd MMM yyyy')}
                </div>
              </div>
              <button onClick={() => setWeekOffset(w => w + 1)} className="p-2 hover:bg-gray-100 rounded-lg">
                <ChevronDown className="w-5 h-5 -rotate-90" />
              </button>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setWeekOffset(0)}
                className="px-3 py-2 text-sm bg-gray-100 hover:bg-gray-200 rounded-lg"
              >
                This Week
              </button>
              <button
                onClick={generateWeeklyPDF}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2 text-sm font-medium"
              >
                <Download className="w-4 h-4" /> Export PDF
              </button>
            </div>
          </div>

          {/* Summary cards */}
          {loading ? (
            <div className="flex justify-center py-12">
              <RefreshCw className="w-8 h-8 text-green-600 animate-spin" />
            </div>
          ) : weeklySummary.length === 0 ? (
            <div className="bg-white rounded-xl shadow-sm border p-12 text-center">
              <BarChart3 className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-gray-700">No duty logs for this week</h3>
              <p className="text-gray-500 mt-2">Log duties to see the weekly report here.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {weeklySummary.map((person, idx) => (
                <WeeklyPersonCard key={idx} person={person} />
              ))}
            </div>
          )}
        </div>
      )}

      {/* ─── ALL LOGS TAB ───────────────────────────────────────────────── */}
      {activeTab === 'log' && (
        <div className="space-y-4">
          {/* Filters */}
          <div className="bg-white rounded-xl shadow-sm border p-4 flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="Search duties, staff, patients..."
                value={searchText}
                onChange={e => setSearchText(e.target.value)}
                className="w-full pl-9 pr-3 py-2 border rounded-lg text-sm"
              />
            </div>
            <select
              value={roleFilter}
              onChange={e => setRoleFilter(e.target.value as any)}
              className="px-3 py-2 border rounded-lg text-sm"
            >
              <option value="all">All Roles</option>
              <option value="house_officer">House Officers</option>
              <option value="registrar">Registrars</option>
              <option value="senior_registrar">Senior Registrars</option>
            </select>
            <select
              value={statusFilter}
              onChange={e => setStatusFilter(e.target.value)}
              className="px-3 py-2 border rounded-lg text-sm"
            >
              <option value="all">All Statuses</option>
              <option value="assigned">Assigned</option>
              <option value="in_progress">In Progress</option>
              <option value="completed">Completed</option>
              <option value="missed">Missed</option>
              <option value="deferred">Deferred</option>
            </select>
          </div>

          {/* Log list */}
          {loading ? (
            <div className="flex justify-center py-12">
              <RefreshCw className="w-8 h-8 text-green-600 animate-spin" />
            </div>
          ) : filteredLogs.length === 0 ? (
            <div className="bg-white rounded-xl shadow-sm border p-12 text-center">
              <FileText className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-gray-700">No duty logs found</h3>
              <p className="text-gray-500 mt-2">Use "Log New Duty" to start tracking clinic duties.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {filteredLogs.map(log => (
                <DutyLogCard
                  key={log.id}
                  log={log}
                  onComplete={handleComplete}
                  onStatusChange={handleStatusChange}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Tuesday Clinic Preview ─────────────────────────────────────────────────

interface AutoAssignedDuty {
  duty: DutyDefinition;
  isRedistributed: boolean;
}

interface StaffAssignment {
  staff: { id: string; full_name: string; role: string };
  duties: AutoAssignedDuty[];
}

function getNextTuesday(offset: number): Date {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const day = today.getDay();
  let daysToTuesday: number;
  if (day === 2) {
    daysToTuesday = 0;
  } else if (day < 2) {
    daysToTuesday = 2 - day;
  } else {
    daysToTuesday = 2 - day + 7;
  }
  const tuesday = new Date(today);
  tuesday.setDate(today.getDate() + daysToTuesday + offset * 7);
  return tuesday;
}

function TuesdayClinicPreview() {
  const [loading, setLoading] = useState(true);
  const [tuesdayOffset, setTuesdayOffset] = useState(0);
  const [staffByRole, setStaffByRole] = useState<{
    house_officers: { id: string; full_name: string; role: string }[];
    registrars: { id: string; full_name: string; role: string }[];
    senior_registrars: { id: string; full_name: string; role: string }[];
  }>({ house_officers: [], registrars: [], senior_registrars: [] });
  const [assignments, setAssignments] = useState<StaffAssignment[]>([]);
  const [applying, setApplying] = useState(false);
  const [applied, setApplied] = useState(false);
  const [alreadyLogged, setAlreadyLogged] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const clinicDate = useMemo(() => getNextTuesday(tuesdayOffset), [tuesdayOffset]);

  const isToday = useMemo(() => {
    const today = new Date();
    return (
      today.getFullYear() === clinicDate.getFullYear() &&
      today.getMonth() === clinicDate.getMonth() &&
      today.getDate() === clinicDate.getDate()
    );
  }, [clinicDate]);

  const isPast = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return clinicDate < today;
  }, [clinicDate]);

  useEffect(() => {
    loadAndAssign();
  }, [clinicDate]);

  const loadAndAssign = async () => {
    setLoading(true);
    setApplied(false);
    setError('');
    setSuccess('');
    try {
      const [srStaff, regStaff, hoStaff] = await Promise.all([
        clinicDutyService.getStaffByRole('senior_registrar'),
        clinicDutyService.getStaffByRole('junior_registrar'),
        clinicDutyService.getStaffByRole('house_officer'),
      ]);

      setStaffByRole({
        house_officers: hoStaff,
        registrars: regStaff,
        senior_registrars: srStaff,
      });

      // Check if duties already logged for this Tuesday
      const dateStr = clinicDate.toISOString().split('T')[0];
      const existing = await clinicDutyService.getLogs({
        from_date: dateStr + 'T00:00:00.000Z',
        to_date: dateStr + 'T23:59:59.999Z',
      });
      setAlreadyLogged(existing.length > 0);

      // Build auto-assignment
      const hoDuties = getDutyDefinitionsForRole('house_officer');
      const regDuties = getDutyDefinitionsForRole('registrar');
      const srDuties = getDutyDefinitionsForRole('senior_registrar');

      const assignmentMap = new Map<string, StaffAssignment>();

      // Initialize all staff in the map
      [...hoStaff, ...regStaff, ...srStaff].forEach(s => {
        assignmentMap.set(s.id, { staff: s, duties: [] });
      });

      // 1) Assign House Officer duties (round-robin among HOs)
      if (hoStaff.length > 0) {
        hoDuties.forEach((duty, idx) => {
          const staff = hoStaff[idx % hoStaff.length];
          assignmentMap.get(staff.id)!.duties.push({ duty, isRedistributed: false });
        });
      }

      // 2) Assign Registrar duties
      if (regStaff.length > 0) {
        regDuties.forEach((duty, idx) => {
          const staff = regStaff[idx % regStaff.length];
          assignmentMap.get(staff.id)!.duties.push({ duty, isRedistributed: false });
        });
      } else {
        // No registrars — redistribute registrar duties evenly to HOs + SRs
        const pool = [...hoStaff, ...srStaff];
        if (pool.length > 0) {
          regDuties.forEach((duty, idx) => {
            const staff = pool[idx % pool.length];
            assignmentMap.get(staff.id)!.duties.push({ duty, isRedistributed: true });
          });
        }
      }

      // 3) Assign Senior Registrar duties (round-robin among SRs)
      if (srStaff.length > 0) {
        srDuties.forEach((duty, idx) => {
          const staff = srStaff[idx % srStaff.length];
          assignmentMap.get(staff.id)!.duties.push({ duty, isRedistributed: false });
        });
      }

      // Sort: SRs first, then Registrars, then HOs
      const roleOrder: Record<string, number> = { senior_registrar: 0, junior_registrar: 1, house_officer: 2 };
      const sorted = Array.from(assignmentMap.values())
        .filter(a => a.duties.length > 0)
        .sort((a, b) => (roleOrder[a.staff.role] ?? 3) - (roleOrder[b.staff.role] ?? 3));

      setAssignments(sorted);
    } catch (err: any) {
      setError(err.message || 'Failed to load staff data');
    } finally {
      setLoading(false);
    }
  };

  const applyAllDuties = async () => {
    setApplying(true);
    setError('');
    try {
      const dateStr = clinicDate.toISOString();
      for (const { staff, duties } of assignments) {
        for (const { duty } of duties) {
          const cat: DutyCategory = staff.role === 'junior_registrar' ? 'registrar' : staff.role as DutyCategory;
          await clinicDutyService.logDuty({
            user_id: staff.id,
            user_name: staff.full_name,
            user_role: cat,
            duty_type: duty.type,
            duty_category: duty.category,
            description: duty.description,
            status: 'assigned',
            assigned_date: dateStr,
          });
        }
      }
      setApplied(true);
      setAlreadyLogged(true);
      setSuccess(`All ${assignments.reduce((sum, a) => sum + a.duties.length, 0)} duties have been logged for ${format(clinicDate, 'EEEE, dd MMMM yyyy')}.`);
    } catch (err: any) {
      setError(err.message || 'Failed to apply duties');
    } finally {
      setApplying(false);
    }
  };

  const getRoleBadge = (role: string) => {
    if (role === 'senior_registrar') return { label: 'Senior Registrar', color: 'bg-purple-100 text-purple-800 border-purple-300' };
    if (role === 'junior_registrar') return { label: 'Registrar', color: 'bg-blue-100 text-blue-800 border-blue-300' };
    return { label: 'House Officer', color: 'bg-green-100 text-green-800 border-green-300' };
  };

  const totalDuties = assignments.reduce((sum, a) => sum + a.duties.length, 0);
  const hasRedistribution = staffByRole.registrars.length === 0 && (staffByRole.house_officers.length > 0 || staffByRole.senior_registrars.length > 0);

  return (
    <div className="space-y-4">
      {/* Date Navigation */}
      <div className="bg-white rounded-xl shadow-sm border p-4">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setTuesdayOffset(o => o - 1)}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              title="Previous Tuesday"
            >
              <ChevronDown className="w-5 h-5 rotate-90" />
            </button>
            <div className="text-center">
              <div className="text-lg font-bold text-gray-900 flex items-center gap-2 justify-center">
                <Calendar className="w-5 h-5 text-green-600" />
                Tuesday Clinic — {format(clinicDate, 'dd MMMM yyyy')}
              </div>
              <div className="text-sm text-gray-500">
                {isToday ? (
                  <span className="inline-flex items-center gap-1 text-green-600 font-semibold">
                    <Flame className="w-4 h-4" /> Today is Clinic Day!
                  </span>
                ) : isPast ? (
                  <span className="text-gray-400">Past clinic day</span>
                ) : (
                  <span>Upcoming clinic day</span>
                )}
              </div>
            </div>
            <button
              onClick={() => setTuesdayOffset(o => o + 1)}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              title="Next Tuesday"
            >
              <ChevronDown className="w-5 h-5 -rotate-90" />
            </button>
          </div>
          <div className="flex items-center gap-2">
            {tuesdayOffset !== 0 && (
              <button
                onClick={() => setTuesdayOffset(0)}
                className="px-3 py-2 text-sm bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
              >
                This Week
              </button>
            )}
            <button
              onClick={loadAndAssign}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              title="Refresh"
            >
              <RefreshCw className={`w-5 h-5 text-gray-500 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>
      </div>

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

      {loading ? (
        <div className="flex justify-center py-12">
          <RefreshCw className="w-8 h-8 text-green-600 animate-spin" />
        </div>
      ) : (
        <>
          {/* Staff Availability Summary */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="bg-white rounded-xl shadow-sm border p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-purple-50 text-purple-600">
                  <Users className="w-5 h-5" />
                </div>
                <div>
                  <div className="text-2xl font-bold text-purple-700">{staffByRole.senior_registrars.length}</div>
                  <div className="text-xs text-gray-500">Senior Registrar{staffByRole.senior_registrars.length !== 1 ? 's' : ''}</div>
                </div>
              </div>
              {staffByRole.senior_registrars.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1">
                  {staffByRole.senior_registrars.map(s => (
                    <span key={s.id} className="text-xs bg-purple-50 text-purple-700 px-2 py-0.5 rounded-full">{s.full_name}</span>
                  ))}
                </div>
              )}
            </div>
            <div className="bg-white rounded-xl shadow-sm border p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-blue-50 text-blue-600">
                  <Users className="w-5 h-5" />
                </div>
                <div>
                  <div className="text-2xl font-bold text-blue-700">{staffByRole.registrars.length}</div>
                  <div className="text-xs text-gray-500">Registrar{staffByRole.registrars.length !== 1 ? 's' : ''}</div>
                </div>
              </div>
              {staffByRole.registrars.length > 0 ? (
                <div className="mt-2 flex flex-wrap gap-1">
                  {staffByRole.registrars.map(s => (
                    <span key={s.id} className="text-xs bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full">{s.full_name}</span>
                  ))}
                </div>
              ) : (
                <div className="mt-2 text-xs text-orange-600 font-medium">No registrars — duties redistributed</div>
              )}
            </div>
            <div className="bg-white rounded-xl shadow-sm border p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-green-50 text-green-600">
                  <Users className="w-5 h-5" />
                </div>
                <div>
                  <div className="text-2xl font-bold text-green-700">{staffByRole.house_officers.length}</div>
                  <div className="text-xs text-gray-500">House Officer{staffByRole.house_officers.length !== 1 ? 's' : ''}</div>
                </div>
              </div>
              {staffByRole.house_officers.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1">
                  {staffByRole.house_officers.map(s => (
                    <span key={s.id} className="text-xs bg-green-50 text-green-700 px-2 py-0.5 rounded-full">{s.full_name}</span>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Redistribution Warning */}
          {hasRedistribution && (
            <div className="bg-orange-50 border border-orange-200 rounded-xl p-4 flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-orange-500 flex-shrink-0 mt-0.5" />
              <div>
                <div className="font-semibold text-orange-800">No Registrar Available</div>
                <div className="text-sm text-orange-700 mt-1">
                  Registrar duties (<em>Clerking &amp; Presentation of New Patients</em>) have been evenly
                  redistributed among the available House Officers and Senior Registrar(s).
                  Redistributed duties are marked with a <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-orange-100 text-orange-700 text-xs font-medium">Redistributed</span> badge.
                </div>
              </div>
            </div>
          )}

          {/* Summary Bar */}
          <div className="bg-white rounded-xl shadow-sm border p-4 flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="flex items-center gap-4">
              <div className="text-sm text-gray-600">
                <span className="font-bold text-gray-900">{totalDuties}</span> duties across{' '}
                <span className="font-bold text-gray-900">{assignments.length}</span> staff members
              </div>
            </div>
            {!applied && !alreadyLogged && totalDuties > 0 && (
              <button
                onClick={applyAllDuties}
                disabled={applying}
                className="px-5 py-2.5 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 flex items-center gap-2 text-sm font-medium transition-colors"
              >
                {applying ? (
                  <><RefreshCw className="w-4 h-4 animate-spin" /> Applying...</>
                ) : (
                  <><CheckCircle2 className="w-4 h-4" /> Apply All Duties for {format(clinicDate, 'dd MMM')}</>
                )}
              </button>
            )}
            {(applied || alreadyLogged) && (
              <span className="inline-flex items-center gap-1.5 px-4 py-2 bg-green-50 text-green-700 rounded-lg text-sm font-medium">
                <CheckCircle2 className="w-4 h-4" /> Duties logged for this date
              </span>
            )}
          </div>

          {/* Assignment Cards — grouped by person */}
          {assignments.length === 0 ? (
            <div className="bg-white rounded-xl shadow-sm border p-12 text-center">
              <Users className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-gray-700">No staff available</h3>
              <p className="text-gray-500 mt-2">Register staff members (House Officers, Registrars, Senior Registrars) to see auto-assigned clinic duties.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {assignments.map(({ staff, duties }) => {
                const badge = getRoleBadge(staff.role);
                const Icon = staff.role === 'senior_registrar' ? Stethoscope : staff.role === 'junior_registrar' ? Activity : User;
                const roleBg = staff.role === 'senior_registrar' ? 'bg-purple-600' : staff.role === 'junior_registrar' ? 'bg-blue-600' : 'bg-green-600';
                const roleIconBg = staff.role === 'senior_registrar' ? 'bg-purple-50 text-purple-600' : staff.role === 'junior_registrar' ? 'bg-blue-50 text-blue-600' : 'bg-green-50 text-green-600';

                return (
                  <div key={staff.id} className="bg-white rounded-xl shadow-sm border overflow-hidden">
                    {/* Person header */}
                    <div className={`px-5 py-3 ${roleBg} text-white flex items-center gap-3`}>
                      <Icon className="w-5 h-5" />
                      <div className="flex-1">
                        <div className="font-semibold">{staff.full_name}</div>
                        <div className="text-xs opacity-80">{badge.label} — {duties.length} {duties.length === 1 ? 'duty' : 'duties'}</div>
                      </div>
                    </div>
                    {/* Duties list */}
                    <div className="divide-y">
                      {duties.map(({ duty, isRedistributed }, didx) => {
                        const DutyIcon = DUTY_ICONS[duty.type] || ClipboardList;
                        return (
                          <div key={`${duty.type}-${didx}`} className="px-5 py-3 flex items-start gap-3 hover:bg-gray-50">
                            <div className={`p-1.5 rounded-lg ${roleIconBg}`}>
                              <DutyIcon className="w-4 h-4" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="font-medium text-gray-900 flex items-center gap-2 flex-wrap">
                                {duty.label}
                                {isRedistributed && (
                                  <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-orange-100 text-orange-700 text-[10px] font-semibold uppercase tracking-wider">
                                    <AlertTriangle className="w-3 h-3" /> Redistributed
                                  </span>
                                )}
                              </div>
                              <div className="text-sm text-gray-500 mt-0.5">{duty.description}</div>
                            </div>
                            <div className="flex items-center gap-2 flex-shrink-0">
                              {duty.time_slot && (
                                <span className="px-2 py-1 rounded-full bg-orange-100 text-orange-700 text-xs font-medium flex items-center gap-1">
                                  <Clock className="w-3 h-3" /> {duty.time_slot}
                                </span>
                              )}
                              <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                                duty.recurrence === 'daily' ? 'bg-yellow-100 text-yellow-700' :
                                duty.recurrence === 'weekly' ? 'bg-blue-100 text-blue-700' :
                                'bg-gray-100 text-gray-600'
                              }`}>
                                {duty.recurrence === 'as_needed' ? 'As needed' : duty.recurrence.charAt(0).toUpperCase() + duty.recurrence.slice(1)}
                              </span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ─── Duty Board ─────────────────────────────────────────────────────────────

function DutyBoard() {
  const roles: DutyCategory[] = ['house_officer', 'registrar', 'senior_registrar'];

  return (
    <div className="space-y-6">
      {roles.map(role => {
        const duties = getDutyDefinitionsForRole(role);
        return (
          <div key={role} className="bg-white rounded-xl shadow-sm border overflow-hidden">
            <div className={`px-5 py-3 font-semibold text-sm flex items-center gap-2 ${
              role === 'house_officer' ? 'bg-green-600 text-white' :
              role === 'registrar' ? 'bg-blue-600 text-white' :
              'bg-purple-600 text-white'
            }`}>
              <Users className="w-4 h-4" />
              {ROLE_LABELS[role]} Duties
            </div>
            <div className="divide-y">
              {duties.map(d => {
                const Icon = DUTY_ICONS[d.type] || ClipboardList;
                return (
                  <div key={d.type} className="px-5 py-4 flex items-start gap-4 hover:bg-gray-50">
                    <div className={`p-2 rounded-lg ${
                      role === 'house_officer' ? 'bg-green-50 text-green-600' :
                      role === 'registrar' ? 'bg-blue-50 text-blue-600' :
                      'bg-purple-50 text-purple-600'
                    }`}>
                      <Icon className="w-5 h-5" />
                    </div>
                    <div className="flex-1">
                      <div className="font-medium text-gray-900">{d.label}</div>
                      <div className="text-sm text-gray-500 mt-0.5">{d.description}</div>
                    </div>
                    <div className="flex items-center gap-2 text-xs">
                      <span className={`px-2 py-1 rounded-full font-medium ${
                        d.recurrence === 'daily' ? 'bg-yellow-100 text-yellow-700' :
                        d.recurrence === 'weekly' ? 'bg-blue-100 text-blue-700' :
                        'bg-gray-100 text-gray-600'
                      }`}>
                        {d.recurrence === 'as_needed' ? 'As needed' : d.recurrence.charAt(0).toUpperCase() + d.recurrence.slice(1)}
                      </span>
                      {d.time_slot && (
                        <span className="px-2 py-1 rounded-full bg-orange-100 text-orange-700 font-medium flex items-center gap-1">
                          <Clock className="w-3 h-3" /> {d.time_slot}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── My Duties View ─────────────────────────────────────────────────────────

function MyDutiesView({ userId, userName, onComplete, onStatusChange }: {
  userId?: string;
  userName?: string;
  onComplete: (id: number, notes?: string) => void;
  onStatusChange: (id: number, status: string) => void;
}) {
  const [myLogs, setMyLogs] = useState<ClinicDutyLog[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userId) return;
    setLoading(true);
    clinicDutyService
      .getLogs({ user_id: userId })
      .then(setMyLogs)
      .finally(() => setLoading(false));
  }, [userId]);

  const pending = myLogs.filter(l => l.status === 'assigned' || l.status === 'in_progress');
  const completed = myLogs.filter(l => l.status === 'completed');
  const missed = myLogs.filter(l => l.status === 'missed');

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <RefreshCw className="w-8 h-8 text-green-600 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatCard label="Total" value={myLogs.length} color="gray" />
        <StatCard label="Pending" value={pending.length} color="yellow" />
        <StatCard label="Completed" value={completed.length} color="green" />
        <StatCard label="Missed" value={missed.length} color="red" />
      </div>

      {myLogs.length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm border p-12 text-center">
          <User className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-700">No duties assigned to you yet</h3>
          <p className="text-gray-500 mt-2">Duties will appear here once they are logged or assigned.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {pending.length > 0 && (
            <>
              <h3 className="text-sm font-semibold text-yellow-700 uppercase tracking-wide">Pending</h3>
              {pending.map(log => (
                <DutyLogCard key={log.id} log={log} onComplete={onComplete} onStatusChange={onStatusChange} />
              ))}
            </>
          )}
          {completed.length > 0 && (
            <>
              <h3 className="text-sm font-semibold text-green-700 uppercase tracking-wide mt-6">Completed</h3>
              {completed.slice(0, 20).map(log => (
                <DutyLogCard key={log.id} log={log} onComplete={onComplete} onStatusChange={onStatusChange} />
              ))}
            </>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Stat Card ──────────────────────────────────────────────────────────────

function StatCard({ label, value, color }: { label: string; value: number; color: string }) {
  const colorMap: Record<string, string> = {
    gray: 'bg-gray-50 text-gray-700 border-gray-200',
    yellow: 'bg-yellow-50 text-yellow-700 border-yellow-200',
    green: 'bg-green-50 text-green-700 border-green-200',
    red: 'bg-red-50 text-red-700 border-red-200',
  };
  return (
    <div className={`rounded-xl border p-4 ${colorMap[color]}`}>
      <div className="text-2xl font-bold">{value}</div>
      <div className="text-xs font-medium mt-1">{label}</div>
    </div>
  );
}

// ─── Duty Log Card ──────────────────────────────────────────────────────────

function DutyLogCard({ log, onComplete, onStatusChange }: {
  log: ClinicDutyLog;
  onComplete: (id: number, notes?: string) => void;
  onStatusChange: (id: number, status: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [completionNotes, setCompletionNotes] = useState('');
  const sc = STATUS_CONFIG[log.status] || STATUS_CONFIG.assigned;
  const Icon = DUTY_ICONS[log.duty_type] || ClipboardList;
  const StatusIcon = sc.icon;
  const roleCat = (log.duty_category || log.user_role) as DutyCategory;

  return (
    <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
      <div
        className="px-4 py-3 flex items-center gap-3 cursor-pointer hover:bg-gray-50"
        onClick={() => setExpanded(!expanded)}
      >
        <div className={`p-2 rounded-lg ${
          roleCat === 'house_officer' ? 'bg-green-50 text-green-600' :
          roleCat === 'registrar' ? 'bg-blue-50 text-blue-600' :
          'bg-purple-50 text-purple-600'
        }`}>
          <Icon className="w-5 h-5" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="font-medium text-gray-900 truncate">{getDutyLabel(log.duty_type)}</div>
          <div className="text-xs text-gray-500 flex items-center gap-2 mt-0.5">
            <span>{(log as any).user_name}</span>
            <span className={`px-1.5 py-0.5 rounded border text-[10px] font-medium ${ROLE_COLORS[roleCat] || ''}`}>
              {ROLE_LABELS[roleCat] || roleCat}
            </span>
            {log.patient_name && <span>• {log.patient_name}</span>}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-medium ${sc.color}`}>
            <StatusIcon className="w-3 h-3" /> {sc.label}
          </span>
          <span className="text-xs text-gray-400">{format(parseISO(log.assigned_date), 'dd MMM')}</span>
          {expanded ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
        </div>
      </div>

      {expanded && (
        <div className="px-4 pb-4 border-t bg-gray-50 space-y-3 pt-3">
          <div className="text-sm text-gray-700">{log.description}</div>
          {log.notes && <div className="text-sm text-gray-600 italic">Notes: {log.notes}</div>}
          {log.completed_date && (
            <div className="text-xs text-green-600">Completed: {format(parseISO(log.completed_date), 'dd MMM yyyy HH:mm')}</div>
          )}

          {(log.status === 'assigned' || log.status === 'in_progress') && (
            <div className="flex items-center gap-2 flex-wrap">
              <input
                type="text"
                placeholder="Completion notes (optional)"
                value={completionNotes}
                onChange={e => setCompletionNotes(e.target.value)}
                className="flex-1 min-w-[200px] px-3 py-1.5 border rounded-lg text-sm"
              />
              <button
                onClick={(e) => { e.stopPropagation(); onComplete(log.id!, completionNotes || undefined); }}
                className="px-3 py-1.5 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm flex items-center gap-1"
              >
                <CheckCircle2 className="w-4 h-4" /> Complete
              </button>
              {log.status === 'assigned' && (
                <button
                  onClick={(e) => { e.stopPropagation(); onStatusChange(log.id!, 'in_progress'); }}
                  className="px-3 py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm flex items-center gap-1"
                >
                  <RefreshCw className="w-4 h-4" /> Start
                </button>
              )}
              <button
                onClick={(e) => { e.stopPropagation(); onStatusChange(log.id!, 'missed'); }}
                className="px-3 py-1.5 bg-red-100 text-red-700 rounded-lg hover:bg-red-200 text-sm flex items-center gap-1"
              >
                <XCircle className="w-4 h-4" /> Missed
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Weekly Person Card ─────────────────────────────────────────────────────

function WeeklyPersonCard({ person }: { person: any }) {
  const [expanded, setExpanded] = useState(false);
  const roleCat = person.role as DutyCategory;
  const pct = person.total > 0 ? Math.round((person.completed / person.total) * 100) : 0;

  return (
    <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
      <div
        className="px-5 py-4 flex items-center gap-4 cursor-pointer hover:bg-gray-50"
        onClick={() => setExpanded(!expanded)}
      >
        <div className={`p-2 rounded-lg ${
          roleCat === 'house_officer' ? 'bg-green-50 text-green-600' :
          roleCat === 'registrar' ? 'bg-blue-50 text-blue-600' :
          'bg-purple-50 text-purple-600'
        }`}>
          <User className="w-5 h-5" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="font-semibold text-gray-900">{person.user_name}</div>
          <div className="text-xs text-gray-500 flex items-center gap-2">
            <span className={`px-1.5 py-0.5 rounded border font-medium ${ROLE_COLORS[roleCat]}`}>
              {ROLE_LABELS[roleCat]}
            </span>
            <span>{person.total} duties</span>
          </div>
        </div>
        <div className="flex items-center gap-4 text-sm">
          <div className="text-center">
            <div className="text-green-600 font-bold">{person.completed}</div>
            <div className="text-[10px] text-gray-400">Done</div>
          </div>
          <div className="text-center">
            <div className="text-yellow-600 font-bold">{person.pending}</div>
            <div className="text-[10px] text-gray-400">Pending</div>
          </div>
          <div className="text-center">
            <div className="text-red-600 font-bold">{person.missed}</div>
            <div className="text-[10px] text-gray-400">Missed</div>
          </div>
          {/* Progress bar */}
          <div className="w-20 hidden sm:block">
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div className="bg-green-500 h-2 rounded-full" style={{ width: `${pct}%` }} />
            </div>
            <div className="text-[10px] text-gray-400 text-center mt-0.5">{pct}%</div>
          </div>
          {expanded ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
        </div>
      </div>

      {expanded && (
        <div className="border-t bg-gray-50 divide-y">
          {person.duties.map((d: any, i: number) => {
            const sc = STATUS_CONFIG[d.status] || STATUS_CONFIG.assigned;
            const StatusIcon = sc.icon;
            return (
              <div key={i} className="px-5 py-3 flex items-center gap-3">
                <StatusIcon className={`w-4 h-4 ${sc.color.split(' ')[0]}`} />
                <div className="flex-1">
                  <div className="text-sm font-medium text-gray-800">{getDutyLabel(d.duty_type)}</div>
                  {d.patient_name && <div className="text-xs text-gray-500">{d.patient_name}</div>}
                </div>
                <span className={`px-2 py-0.5 rounded text-xs font-medium ${sc.color}`}>{sc.label}</span>
                <span className="text-xs text-gray-400">{format(parseISO(d.assigned_date), 'dd MMM')}</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── New Duty Form (Modal) ──────────────────────────────────────────────────

function NewDutyForm({ staffList, currentUser, onSave, onCancel }: {
  staffList: { id: string; full_name: string; role: string }[];
  currentUser: any;
  onSave: (entry: Omit<ClinicDutyLog, 'id' | 'created_at' | 'week_number' | 'year'>) => Promise<void>;
  onCancel: () => void;
}) {
  const [selectedStaff, setSelectedStaff] = useState('');
  const [dutyType, setDutyType] = useState<DutyType | ''>('');
  const [description, setDescription] = useState('');
  const [patientName, setPatientName] = useState('');
  const [notes, setNotes] = useState('');
  const [assignedDate, setAssignedDate] = useState(new Date().toISOString().split('T')[0]);
  const [saving, setSaving] = useState(false);

  const selectedPerson = staffList.find(s => s.id === selectedStaff);
  const roleCategory: DutyCategory | '' = selectedPerson
    ? (selectedPerson.role === 'junior_registrar' ? 'registrar' : selectedPerson.role as DutyCategory)
    : '';
  const availableDuties = roleCategory ? getDutyDefinitionsForRole(roleCategory) : DUTY_DEFINITIONS;

  const handleSubmit = async () => {
    if (!selectedStaff || !dutyType) return;
    setSaving(true);
    const person = staffList.find(s => s.id === selectedStaff)!;
    const cat: DutyCategory = person.role === 'junior_registrar' ? 'registrar' : person.role as DutyCategory;

    await onSave({
      user_id: person.id,
      user_name: person.full_name,
      user_role: cat,
      duty_type: dutyType as DutyType,
      duty_category: cat,
      patient_name: patientName || undefined,
      description: description || getDutyLabel(dutyType as DutyType),
      notes: notes || undefined,
      status: 'assigned',
      assigned_date: new Date(assignedDate).toISOString(),
    });
    setSaving(false);
  };

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
        <div className="p-5 border-b flex items-center justify-between">
          <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
            <Plus className="w-5 h-5 text-green-600" /> Log New Duty
          </h2>
          <button onClick={onCancel} className="p-1 hover:bg-gray-100 rounded">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          {/* Staff member */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Assigned To</label>
            <select
              value={selectedStaff}
              onChange={e => { setSelectedStaff(e.target.value); setDutyType(''); }}
              className="w-full border rounded-lg px-3 py-2 text-sm"
            >
              <option value="">Select staff member...</option>
              <optgroup label="Senior Registrars">
                {staffList.filter(s => s.role === 'senior_registrar').map(s => (
                  <option key={s.id} value={s.id}>{s.full_name}</option>
                ))}
              </optgroup>
              <optgroup label="Registrars">
                {staffList.filter(s => s.role === 'junior_registrar').map(s => (
                  <option key={s.id} value={s.id}>{s.full_name}</option>
                ))}
              </optgroup>
              <optgroup label="House Officers">
                {staffList.filter(s => s.role === 'house_officer').map(s => (
                  <option key={s.id} value={s.id}>{s.full_name}</option>
                ))}
              </optgroup>
            </select>
          </div>

          {/* Duty type */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Duty Type</label>
            <select
              value={dutyType}
              onChange={e => {
                setDutyType(e.target.value as DutyType);
                const def = DUTY_DEFINITIONS.find(d => d.type === e.target.value);
                if (def) setDescription(def.description);
              }}
              className="w-full border rounded-lg px-3 py-2 text-sm"
            >
              <option value="">Select duty type...</option>
              {availableDuties.map(d => (
                <option key={d.type} value={d.type}>{d.label}</option>
              ))}
              <option value="other">Other</option>
            </select>
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
            <textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              rows={2}
              className="w-full border rounded-lg px-3 py-2 text-sm"
              placeholder="Describe the duty..."
            />
          </div>

          {/* Patient (optional) */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Patient Name (optional)</label>
            <input
              type="text"
              value={patientName}
              onChange={e => setPatientName(e.target.value)}
              className="w-full border rounded-lg px-3 py-2 text-sm"
              placeholder="e.g. John Doe"
            />
          </div>

          {/* Date */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Date</label>
            <input
              type="date"
              value={assignedDate}
              onChange={e => setAssignedDate(e.target.value)}
              className="w-full border rounded-lg px-3 py-2 text-sm"
            />
          </div>

          {/* Notes */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Notes (optional)</label>
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              rows={2}
              className="w-full border rounded-lg px-3 py-2 text-sm"
              placeholder="Additional notes..."
            />
          </div>
        </div>

        <div className="p-5 border-t flex justify-end gap-2">
          <button
            onClick={onCancel}
            className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 text-sm"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={!selectedStaff || !dutyType || saving}
            className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 flex items-center gap-2 text-sm font-medium"
          >
            {saving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            Save Duty
          </button>
        </div>
      </div>
    </div>
  );
}

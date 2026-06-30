import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Calendar, Clock, User, Filter, RefreshCw, XCircle, CheckCircle, AlertTriangle, Copy, ExternalLink, Volume2, VolumeX, Bell, BellOff, Users, Timer } from 'lucide-react';
import { apiClient } from '../services/apiClient';
import SurgeryScheduler from '../components/SurgeryScheduler';
import { clinicConfigService, QueueStats, ClinicCategory } from '../services/clinicConfigService';

interface Appointment {
  id: number;
  patient_number: string;
  patient_name?: string;
  phone_number?: string;
  appointment_date: string;
  time_slot: string;
  doctor_assigned: string;
  status: string;
  station_number?: number;
  category?: string;
  priority?: number;
  created_at: string;
}

const STATUS_COLORS: Record<string, string> = {
  booked: 'bg-blue-100 text-blue-800',
  'checked-in': 'bg-yellow-100 text-yellow-800',
  'in-progress': 'bg-purple-100 text-purple-800',
  completed: 'bg-green-100 text-green-800',
  cancelled: 'bg-red-100 text-red-800',
  'no-show': 'bg-gray-100 text-gray-800',
};

const DOCTORS = ['Dr. Nnadi', 'Dr. Onyia', 'Dr. Okwesili', 'Dr. Eze'];

function formatTime(slot: string) {
  const [start, end] = slot.split('-');
  const fmt = (t: string) => {
    const [h, m] = t.split(':').map(Number);
    const suffix = h >= 12 ? 'PM' : 'AM';
    const h12 = h > 12 ? h - 12 : h === 0 ? 12 : h;
    return `${h12}:${String(m).padStart(2, '0')} ${suffix}`;
  };
  return `${fmt(start)} – ${fmt(end)}`;
}

function getNextClinicDate(): string {
  const today = new Date();
  for (let i = 0; i < 7; i++) {
    const d = new Date(today);
    d.setDate(today.getDate() + i);
    const dow = d.getDay();
    if (dow === 2 || dow === 3) {
      return d.toISOString().split('T')[0];
    }
  }
  return today.toISOString().split('T')[0];
}

// Parse "HH:MM-HH:MM" into minutes-since-midnight for the start time
function slotStartMinutes(slot: string): number {
  const start = slot.split('-')[0];
  const [h, m] = start.split(':').map(Number);
  return h * 60 + m;
}

function currentMinutes(): number {
  const now = new Date();
  return now.getHours() * 60 + now.getMinutes();
}

function minutesToTimeStr(mins: number): string {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  const suffix = h >= 12 ? 'PM' : 'AM';
  const h12 = h > 12 ? h - 12 : h === 0 ? 12 : h;
  return `${h12}:${String(m).padStart(2, '0')} ${suffix}`;
}

function speak(text: string) {
  if (!('speechSynthesis' in window)) return;
  // Cancel any ongoing speech
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.rate = 0.95;
  utterance.pitch = 1.0;
  utterance.volume = 1.0;
  // Prefer a clear English voice
  const voices = window.speechSynthesis.getVoices();
  const preferred = voices.find(v => v.lang.startsWith('en') && v.name.includes('Female'))
    || voices.find(v => v.lang.startsWith('en'))
    || voices[0];
  if (preferred) utterance.voice = preferred;
  window.speechSynthesis.speak(utterance);
}

// Play a short alert tone using Web Audio API
function playAlertTone(frequency = 880, duration = 300) {
  try {
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    const oscillator = ctx.createOscillator();
    const gain = ctx.createGain();
    oscillator.connect(gain);
    gain.connect(ctx.destination);
    oscillator.frequency.value = frequency;
    oscillator.type = 'sine';
    gain.gain.setValueAtTime(0.5, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + duration / 1000);
    oscillator.start(ctx.currentTime);
    oscillator.stop(ctx.currentTime + duration / 1000);
    setTimeout(() => ctx.close(), duration + 100);
  } catch (_) { /* Web Audio not available */ }
}

const ClinicAppointmentsPage: React.FC = () => {
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterDate, setFilterDate] = useState(getNextClinicDate());
  const [filterDoctor, setFilterDoctor] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [updating, setUpdating] = useState<number | null>(null);
  const [copied, setCopied] = useState(false);

  // Audio reminder state
  const [remindersEnabled, setRemindersEnabled] = useState(() => {
    return localStorage.getItem('clinicRemindersEnabled') === 'true';
  });
  const [reminderMinutes, setReminderMinutes] = useState(() => {
    const saved = localStorage.getItem('clinicReminderMinutes');
    return saved ? parseInt(saved, 10) : 5;
  });
  const [currentSlotId, setCurrentSlotId] = useState<number | null>(null);
  const [nextSlotId, setNextSlotId] = useState<number | null>(null);
  const [reminderLog, setReminderLog] = useState<string[]>([]);
  const announcedRef = useRef<Set<string>>(new Set());

  // Persist reminder settings
  useEffect(() => {
    localStorage.setItem('clinicRemindersEnabled', String(remindersEnabled));
  }, [remindersEnabled]);
  useEffect(() => {
    localStorage.setItem('clinicReminderMinutes', String(reminderMinutes));
  }, [reminderMinutes]);

  // Load speech synthesis voices
  useEffect(() => {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.getVoices();
      window.speechSynthesis.onvoiceschanged = () => window.speechSynthesis.getVoices();
    }
  }, []);

  // Check if the filter date is today
  const isToday = filterDate === new Date().toISOString().split('T')[0];

  // Audio reminder timer – runs every 30 seconds
  useEffect(() => {
    if (!remindersEnabled || !isToday) return;

    const checkReminders = () => {
      const now = currentMinutes();
      // Get only active appointments sorted by time
      const active = appointments
        .filter(a => ['booked', 'checked-in', 'in-progress'].includes(a.status))
        .sort((a, b) => slotStartMinutes(a.time_slot) - slotStartMinutes(b.time_slot));

      if (active.length === 0) {
        setCurrentSlotId(null);
        setNextSlotId(null);
        return;
      }

      // Find current appointment (slot has started, not finished)
      let currentAppt: Appointment | null = null;
      let nextAppt: Appointment | null = null;

      for (let i = 0; i < active.length; i++) {
        const startMin = slotStartMinutes(active[i].time_slot);
        const endParts = active[i].time_slot.split('-')[1].split(':').map(Number);
        const endMin = endParts[0] * 60 + endParts[1];

        if (now >= startMin && now < endMin) {
          currentAppt = active[i];
          nextAppt = active[i + 1] || null;
          break;
        } else if (now < startMin) {
          nextAppt = active[i];
          break;
        }
      }

      setCurrentSlotId(currentAppt?.id || null);
      setNextSlotId(nextAppt?.id || null);

      if (!nextAppt) return;

      const nextStart = slotStartMinutes(nextAppt.time_slot);
      const minsUntilNext = nextStart - now;
      const nextTimeStr = minutesToTimeStr(nextStart);

      // Reminder at the configured interval before
      const reminderKey1 = `${nextAppt.id}-${reminderMinutes}min`;
      if (minsUntilNext <= reminderMinutes && minsUntilNext > 2 && !announcedRef.current.has(reminderKey1)) {
        announcedRef.current.add(reminderKey1);
        playAlertTone(660, 200);
        setTimeout(() => {
          speak(`Reminder: Next patient, ${nextAppt!.patient_name || nextAppt!.patient_number}, is in ${minsUntilNext} minutes at ${nextTimeStr}. Please prepare to wrap up.`);
        }, 300);
        setReminderLog(prev => [`${new Date().toLocaleTimeString()} — ${minsUntilNext}min reminder: ${nextAppt.patient_name || nextAppt.patient_number} at ${nextTimeStr}`, ...prev.slice(0, 9)]);
      }

      // 2-minute warning
      const reminderKey2 = `${nextAppt.id}-2min`;
      if (minsUntilNext <= 2 && minsUntilNext > 0 && !announcedRef.current.has(reminderKey2)) {
        announcedRef.current.add(reminderKey2);
        playAlertTone(880, 300);
        setTimeout(() => {
          speak(`Attention: Next patient, ${nextAppt!.patient_name || nextAppt!.patient_number}, is in 2 minutes. Time to move on.`);
        }, 400);
        setReminderLog(prev => [`${new Date().toLocaleTimeString()} — 2min warning: ${nextAppt.patient_name || nextAppt.patient_number} at ${nextTimeStr}`, ...prev.slice(0, 9)]);
      }

      // At appointment time
      const reminderKey3 = `${nextAppt.id}-now`;
      if (minsUntilNext <= 0 && minsUntilNext > -1 && !announcedRef.current.has(reminderKey3)) {
        announcedRef.current.add(reminderKey3);
        playAlertTone(1100, 400);
        setTimeout(() => playAlertTone(1100, 400), 500);
        setTimeout(() => {
          speak(`It is now time for the next patient. ${nextAppt!.patient_name || nextAppt!.patient_number} is scheduled now at ${nextTimeStr}. Please proceed.`);
        }, 1000);
        setReminderLog(prev => [`${new Date().toLocaleTimeString()} — NOW: ${nextAppt.patient_name || nextAppt.patient_number} at ${nextTimeStr}`, ...prev.slice(0, 9)]);
      }
    };

    checkReminders();
    const interval = setInterval(checkReminders, 30000); // every 30 seconds
    return () => clearInterval(interval);
  }, [remindersEnabled, isToday, appointments, reminderMinutes]);

  // Reset announced set when date changes
  useEffect(() => {
    announcedRef.current.clear();
  }, [filterDate]);

  const bookingUrl = typeof window !== 'undefined'
    ? `${window.location.origin}/book-appointment.html`
    : '';

  const fetchAppointments = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filterDate) params.set('date', filterDate);
      if (filterDoctor) params.set('doctor', filterDoctor);
      if (filterStatus) params.set('status', filterStatus);
      const data = await apiClient.request(`/clinic-appointments?${params.toString()}`);
      setAppointments(data.appointments || []);
    } catch (err) {
      console.error('Failed to fetch appointments:', err);
    } finally {
      setLoading(false);
    }
  }, [filterDate, filterDoctor, filterStatus]);

  useEffect(() => { fetchAppointments(); }, [fetchAppointments]);

  // Patient categories (for colour-coded badges)
  const [categories, setCategories] = useState<ClinicCategory[]>([]);
  useEffect(() => {
    clinicConfigService.getCategories().then(setCategories).catch(() => {});
  }, []);
  const categoryColor = useCallback(
    (name?: string) => categories.find(c => c.name === name)?.color || '#6B7280',
    [categories]
  );

  // Queue analytics for the selected date
  const [queueStats, setQueueStats] = useState<QueueStats | null>(null);
  const fetchQueueStats = useCallback(async () => {
    if (!filterDate) { setQueueStats(null); return; }
    try {
      setQueueStats(await clinicConfigService.getQueueStats(filterDate));
    } catch {
      setQueueStats(null);
    }
  }, [filterDate]);
  useEffect(() => { fetchQueueStats(); }, [fetchQueueStats, appointments]);

  const updateStatus = async (id: number, status: string) => {
    setUpdating(id);
    try {
      await apiClient.request(`/clinic-appointments/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ status }),
      });
      await fetchAppointments();
    } catch (err) {
      console.error('Failed to update status:', err);
      alert('Failed to update appointment status');
    } finally {
      setUpdating(null);
    }
  };

  const cancelAppointment = async (id: number) => {
    if (!confirm('Are you sure you want to cancel this appointment?')) return;
    await updateStatus(id, 'cancelled');
  };

  const copyLink = () => {
    navigator.clipboard.writeText(bookingUrl).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const stats = {
    total: appointments.length,
    booked: appointments.filter(a => a.status === 'booked').length,
    checkedIn: appointments.filter(a => a.status === 'checked-in').length,
    completed: appointments.filter(a => a.status === 'completed').length,
    cancelled: appointments.filter(a => a.status === 'cancelled').length,
    noShow: appointments.filter(a => a.status === 'no-show').length,
  };

  return (
    <div className="p-4 md:p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Clinic Appointments</h1>
          <p className="text-sm text-gray-500 mt-1">Manage patient clinic bookings &middot; Tuesdays &amp; Wednesdays</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={fetchAppointments} className="flex items-center gap-1.5 px-3 py-2 bg-white border border-gray-300 rounded-lg text-sm hover:bg-gray-50">
            <RefreshCw className="w-4 h-4" /> Refresh
          </button>
          <a href="/book-appointment.html" target="_blank" rel="noopener noreferrer"
            className="flex items-center gap-1.5 px-3 py-2 bg-green-600 text-white rounded-lg text-sm hover:bg-green-700">
            <ExternalLink className="w-4 h-4" /> Open Booking Page
          </a>
          <a href="/appointment-qr.html" target="_blank" rel="noopener noreferrer"
            className="flex items-center gap-1.5 px-3 py-2 bg-white border border-green-600 text-green-700 rounded-lg text-sm hover:bg-green-50">
            📱 QR Code &amp; Instructions
          </a>
        </div>
      </div>

      {/* Shareable Link */}
      <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-4">
        <p className="text-sm font-semibold text-green-800 mb-2">📎 Patient Booking Link (share with patients)</p>
        <div className="flex items-center gap-2 flex-wrap">
          <input
            readOnly
            value={bookingUrl}
            className="flex-1 min-w-0 px-3 py-2 border border-green-300 rounded-md text-sm bg-white text-gray-800"
          />
          <button onClick={copyLink}
            className="flex items-center gap-1.5 px-3 py-2 bg-green-600 text-white rounded-lg text-sm hover:bg-green-700">
            <Copy className="w-4 h-4" /> {copied ? 'Copied!' : 'Copy'}
          </button>
          <a href="/appointment-qr.html" target="_blank" rel="noopener noreferrer"
            className="flex items-center gap-1.5 px-3 py-2 bg-white border border-green-600 text-green-700 rounded-lg text-sm hover:bg-green-50 no-underline">
            📱 Print QR Flyer
          </a>
        </div>
      </div>

      {/* Audio Reminder Controls */}
      <div className={`border rounded-lg p-4 mb-4 ${remindersEnabled ? 'bg-amber-50 border-amber-200' : 'bg-gray-50 border-gray-200'}`}>
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
          <div className="flex items-center gap-3">
            {remindersEnabled ? (
              <Bell className="w-5 h-5 text-amber-600 animate-pulse" />
            ) : (
              <BellOff className="w-5 h-5 text-gray-400" />
            )}
            <div>
              <p className="text-sm font-semibold text-gray-800">
                Audio Reminders {remindersEnabled ? 'ON' : 'OFF'}
              </p>
              <p className="text-xs text-gray-500">
                {remindersEnabled
                  ? `Announcing ${reminderMinutes} min & 2 min before each patient${!isToday ? ' (active only for today\'s date)' : ''}`
                  : 'Enable to get spoken reminders when it\'s time to see the next patient'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {remindersEnabled && (
              <div className="flex items-center gap-1.5">
                <label className="text-xs font-medium text-gray-600">Remind</label>
                <select
                  value={reminderMinutes}
                  onChange={e => setReminderMinutes(Number(e.target.value))}
                  className="px-2 py-1 border border-amber-300 rounded text-xs bg-white"
                >
                  <option value={3}>3 min</option>
                  <option value={5}>5 min</option>
                  <option value={7}>7 min</option>
                  <option value={10}>10 min</option>
                </select>
                <label className="text-xs text-gray-500">before</label>
              </div>
            )}
            <button
              onClick={() => {
                setRemindersEnabled(!remindersEnabled);
                if (!remindersEnabled) {
                  // Test audio on enable
                  playAlertTone(660, 200);
                  setTimeout(() => speak('Audio reminders are now enabled.'), 300);
                } else {
                  window.speechSynthesis?.cancel();
                }
              }}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium ${
                remindersEnabled
                  ? 'bg-red-100 text-red-700 hover:bg-red-200'
                  : 'bg-amber-500 text-white hover:bg-amber-600'
              }`}
            >
              {remindersEnabled ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
              {remindersEnabled ? 'Turn Off' : 'Turn On'}
            </button>
          </div>
        </div>

        {/* Current & Next Patient Alert */}
        {remindersEnabled && isToday && (currentSlotId || nextSlotId) && (
          <div className="mt-3 pt-3 border-t border-amber-200 grid grid-cols-1 sm:grid-cols-2 gap-2">
            {currentSlotId && (() => {
              const appt = appointments.find(a => a.id === currentSlotId);
              if (!appt) return null;
              return (
                <div className="flex items-center gap-2 bg-green-100 rounded-lg px-3 py-2">
                  <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></div>
                  <div>
                    <p className="text-xs font-semibold text-green-800">NOW SEEING</p>
                    <p className="text-sm font-bold text-green-900">{appt.patient_name || appt.patient_number} &middot; {formatTime(appt.time_slot)}</p>
                  </div>
                </div>
              );
            })()}
            {nextSlotId && (() => {
              const appt = appointments.find(a => a.id === nextSlotId);
              if (!appt) return null;
              const minsAway = slotStartMinutes(appt.time_slot) - currentMinutes();
              return (
                <div className="flex items-center gap-2 bg-amber-100 rounded-lg px-3 py-2">
                  <Clock className="w-4 h-4 text-amber-600" />
                  <div>
                    <p className="text-xs font-semibold text-amber-800">NEXT UP {minsAway > 0 ? `in ${minsAway} min` : 'NOW'}</p>
                    <p className="text-sm font-bold text-amber-900">{appt.patient_name || appt.patient_number} &middot; {formatTime(appt.time_slot)}</p>
                  </div>
                </div>
              );
            })()}
          </div>
        )}

        {/* Reminder Log */}
        {remindersEnabled && reminderLog.length > 0 && (
          <div className="mt-3 pt-3 border-t border-amber-200">
            <p className="text-xs font-semibold text-gray-600 mb-1">Recent Announcements:</p>
            <div className="max-h-20 overflow-y-auto text-xs text-gray-500 space-y-0.5">
              {reminderLog.map((log, i) => (
                <p key={i}>{log}</p>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mb-4">
        {[
          { label: 'Total', value: stats.total, color: 'text-gray-900 bg-gray-50' },
          { label: 'Booked', value: stats.booked, color: 'text-blue-800 bg-blue-50' },
          { label: 'Checked In', value: stats.checkedIn, color: 'text-yellow-800 bg-yellow-50' },
          { label: 'Completed', value: stats.completed, color: 'text-green-800 bg-green-50' },
          { label: 'Cancelled', value: stats.cancelled, color: 'text-red-800 bg-red-50' },
          { label: 'No Show', value: stats.noShow, color: 'text-gray-800 bg-gray-100' },
        ].map(s => (
          <div key={s.label} className={`rounded-lg p-3 text-center ${s.color}`}>
            <p className="text-2xl font-bold">{s.value}</p>
            <p className="text-xs font-medium">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Queue Analytics (per-station) */}
      {queueStats && queueStats.stations.length > 0 && (
        <div className="bg-white rounded-lg border border-gray-200 p-4 mb-4">
          <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
            <div className="flex items-center gap-2">
              <Users className="w-4 h-4 text-green-600" />
              <span className="text-sm font-semibold text-gray-700">
                Station Queues &middot; {queueStats.dayName}
              </span>
            </div>
            {queueStats.avgWaitMinutes != null && (
              <div className="flex items-center gap-1.5 text-sm text-gray-600">
                <Timer className="w-4 h-4 text-amber-500" />
                Avg wait: <span className="font-semibold text-gray-900">{queueStats.avgWaitMinutes} min</span>
              </div>
            )}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {queueStats.stations.map(st => (
              <div key={st.station} className="rounded-lg border border-gray-200 p-3">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-semibold text-gray-800">Station {st.station}</span>
                  <span className="text-xs text-gray-500">{st.doctor}</span>
                </div>
                <div className="grid grid-cols-4 gap-1 text-center">
                  <div><p className="text-lg font-bold text-yellow-700">{st.waiting}</p><p className="text-[10px] text-gray-500">Waiting</p></div>
                  <div><p className="text-lg font-bold text-purple-700">{st.inProgress}</p><p className="text-[10px] text-gray-500">In Prog.</p></div>
                  <div><p className="text-lg font-bold text-green-700">{st.completed}</p><p className="text-[10px] text-gray-500">Done</p></div>
                  <div><p className="text-lg font-bold text-gray-500">{st.noShow}</p><p className="text-[10px] text-gray-500">No-show</p></div>
                </div>
              </div>
            ))}
          </div>
          {Object.keys(queueStats.byCategory).length > 0 && (
            <div className="mt-3 pt-3 border-t border-gray-100 flex flex-wrap gap-2">
              {Object.entries(queueStats.byCategory).map(([name, count]) => (
                <span key={name} className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium"
                  style={{ backgroundColor: `${categoryColor(name)}1A`, color: categoryColor(name) }}>
                  <span className="w-2 h-2 rounded-full" style={{ backgroundColor: categoryColor(name) }} />
                  {name}: {count}
                </span>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Filters */}
      <div className="bg-white rounded-lg border border-gray-200 p-4 mb-4">
        <div className="flex items-center gap-2 mb-3">
          <Filter className="w-4 h-4 text-gray-500" />
          <span className="text-sm font-semibold text-gray-700">Filters</span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Date</label>
            <input type="date" value={filterDate} onChange={e => setFilterDate(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Doctor</label>
            <select value={filterDoctor} onChange={e => setFilterDoctor(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm">
              <option value="">All Doctors</option>
              {DOCTORS.map(d => <option key={d} value={d}>{d}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Status</label>
            <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm">
              <option value="">All Statuses</option>
              <option value="booked">Booked</option>
              <option value="checked-in">Checked In</option>
              <option value="in-progress">In Progress</option>
              <option value="completed">Completed</option>
              <option value="cancelled">Cancelled</option>
              <option value="no-show">No Show</option>
            </select>
          </div>
        </div>
      </div>

      {/* Appointments Table */}
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-600"></div>
          </div>
        ) : appointments.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            <Calendar className="w-12 h-12 mx-auto mb-3 text-gray-300" />
            <p className="font-medium">No appointments found</p>
            <p className="text-sm mt-1">Adjust filters or select a different date</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="text-left px-4 py-3 font-semibold text-gray-700">Time</th>
                  <th className="text-left px-4 py-3 font-semibold text-gray-700">Patient</th>
                  <th className="text-left px-4 py-3 font-semibold text-gray-700">Category</th>
                  <th className="text-left px-4 py-3 font-semibold text-gray-700">Station</th>
                  <th className="text-left px-4 py-3 font-semibold text-gray-700">Doctor</th>
                  <th className="text-left px-4 py-3 font-semibold text-gray-700">Status</th>
                  <th className="text-left px-4 py-3 font-semibold text-gray-700">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {appointments.map(a => (
                  <tr key={a.id} className={`hover:bg-gray-50 ${a.status === 'cancelled' ? 'opacity-50' : ''} ${
                    remindersEnabled && isToday && a.id === currentSlotId ? 'bg-green-50 ring-2 ring-green-400 ring-inset' :
                    remindersEnabled && isToday && a.id === nextSlotId ? 'bg-amber-50 ring-2 ring-amber-300 ring-inset' : ''
                  }`}>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1.5">
                        <Clock className="w-3.5 h-3.5 text-gray-400" />
                        <span className="font-medium">{formatTime(a.time_slot)}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1.5">
                        <User className="w-3.5 h-3.5 text-gray-400" />
                        <div>
                          {a.patient_name && <span className="font-medium block">{a.patient_name}</span>}
                          <span className="font-mono text-xs text-gray-500">{a.patient_number}</span>
                          {a.phone_number && (
                            <a href={`https://wa.me/${a.phone_number.replace(/^\+/, '').replace(/^0/, '234')}`} target="_blank" rel="noopener noreferrer" className="block text-xs text-green-600 hover:underline">📱 {a.phone_number}</a>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      {a.category ? (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium"
                          style={{ backgroundColor: `${categoryColor(a.category)}1A`, color: categoryColor(a.category) }}>
                          <span className="w-2 h-2 rounded-full" style={{ backgroundColor: categoryColor(a.category) }} />
                          {a.category}
                        </span>
                      ) : (
                        <span className="text-xs text-gray-400">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {a.station_number ? (
                        <span className="inline-block px-2 py-0.5 rounded bg-gray-100 text-gray-700 text-xs font-semibold">#{a.station_number}</span>
                      ) : (
                        <span className="text-xs text-gray-400">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 font-medium text-gray-700">{a.doctor_assigned}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-block px-2.5 py-1 rounded-full text-xs font-semibold ${STATUS_COLORS[a.status] || 'bg-gray-100'}`}>
                        {a.status.replace('-', ' ').toUpperCase()}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {a.status !== 'cancelled' && a.status !== 'completed' && (
                        <div className="flex items-center gap-1">
                          {a.status === 'booked' && (
                            <button onClick={() => updateStatus(a.id, 'checked-in')}
                              disabled={updating === a.id}
                              className="px-2 py-1 bg-yellow-100 text-yellow-800 rounded text-xs font-medium hover:bg-yellow-200 disabled:opacity-50">
                              Check In
                            </button>
                          )}
                          {a.status === 'checked-in' && (
                            <button onClick={() => updateStatus(a.id, 'in-progress')}
                              disabled={updating === a.id}
                              className="px-2 py-1 bg-purple-100 text-purple-800 rounded text-xs font-medium hover:bg-purple-200 disabled:opacity-50">
                              Start
                            </button>
                          )}
                          {(a.status === 'in-progress' || a.status === 'checked-in') && (
                            <button onClick={() => updateStatus(a.id, 'completed')}
                              disabled={updating === a.id}
                              className="px-2 py-1 bg-green-100 text-green-800 rounded text-xs font-medium hover:bg-green-200 disabled:opacity-50">
                              <CheckCircle className="w-3 h-3 inline mr-0.5" />Done
                            </button>
                          )}
                          {a.status !== 'no-show' && (
                            <button onClick={() => updateStatus(a.id, 'no-show')}
                              disabled={updating === a.id}
                              className="px-2 py-1 bg-gray-100 text-gray-700 rounded text-xs font-medium hover:bg-gray-200 disabled:opacity-50">
                              <AlertTriangle className="w-3 h-3 inline mr-0.5" />No Show
                            </button>
                          )}
                          <button onClick={() => cancelAppointment(a.id)}
                            disabled={updating === a.id}
                            className="px-2 py-1 bg-red-100 text-red-700 rounded text-xs font-medium hover:bg-red-200 disabled:opacity-50">
                            <XCircle className="w-3 h-3 inline mr-0.5" />Cancel
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Surgery Scheduling Section */}
        <SurgeryScheduler />
      </div>
    </div>
  );
};

export default ClinicAppointmentsPage;

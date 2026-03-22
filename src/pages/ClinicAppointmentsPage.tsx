import React, { useState, useEffect, useCallback } from 'react';
import { Calendar, Clock, User, Filter, RefreshCw, XCircle, CheckCircle, AlertTriangle, Copy, ExternalLink } from 'lucide-react';
import { apiClient } from '../services/apiClient';

interface Appointment {
  id: number;
  patient_number: string;
  appointment_date: string;
  time_slot: string;
  doctor_assigned: string;
  status: string;
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

const DOCTORS = ['Dr. Nnadi', 'Dr. Onyia', 'Dr. Eze'];

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

const ClinicAppointmentsPage: React.FC = () => {
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterDate, setFilterDate] = useState(getNextClinicDate());
  const [filterDoctor, setFilterDoctor] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [updating, setUpdating] = useState<number | null>(null);
  const [copied, setCopied] = useState(false);

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
        </div>
      </div>

      {/* Shareable Link */}
      <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-4">
        <p className="text-sm font-semibold text-green-800 mb-2">📎 Patient Booking Link (share with patients)</p>
        <div className="flex items-center gap-2">
          <input
            readOnly
            value={bookingUrl}
            className="flex-1 px-3 py-2 border border-green-300 rounded-md text-sm bg-white text-gray-800"
          />
          <button onClick={copyLink}
            className="flex items-center gap-1.5 px-3 py-2 bg-green-600 text-white rounded-lg text-sm hover:bg-green-700">
            <Copy className="w-4 h-4" /> {copied ? 'Copied!' : 'Copy'}
          </button>
        </div>
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
                  <th className="text-left px-4 py-3 font-semibold text-gray-700">Patient #</th>
                  <th className="text-left px-4 py-3 font-semibold text-gray-700">Doctor</th>
                  <th className="text-left px-4 py-3 font-semibold text-gray-700">Status</th>
                  <th className="text-left px-4 py-3 font-semibold text-gray-700">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {appointments.map(a => (
                  <tr key={a.id} className={`hover:bg-gray-50 ${a.status === 'cancelled' ? 'opacity-50' : ''}`}>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1.5">
                        <Clock className="w-3.5 h-3.5 text-gray-400" />
                        <span className="font-medium">{formatTime(a.time_slot)}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1.5">
                        <User className="w-3.5 h-3.5 text-gray-400" />
                        <span className="font-mono font-medium">{a.patient_number}</span>
                      </div>
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
      </div>
    </div>
  );
};

export default ClinicAppointmentsPage;

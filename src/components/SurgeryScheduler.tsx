/**
 * SurgeryScheduler — Theatre booking section for the Clinic Appointments page.
 *
 * Capabilities:
 *  • Dynamic date picker (Wed/Thu electives, any day for emergencies)
 *  • Patient picker (live search by name / hospital number — auto-fills age/gender/ward/phone)
 *  • Capacity-aware booking (server validates: 2pt major / 1pt intermediate / 0.5pt minor, cap 4pt/day)
 *  • Operating consultant pairs (Dr Okwesili/Nnadi  OR  Dr Okwesili/Eze)
 *  • Equipment requirement flags (diathermy, monitor, mattress, lithotomy, tourniquet, etc.)
 *  • Daily theatre slate PDF download
 *  • WhatsApp deep-link templates (book / pre-op / reminder / reschedule / cancel)
 */
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Calendar, Search, FileDown, MessageCircle, AlertTriangle, X, Plus, Trash2, RefreshCw, Stethoscope } from 'lucide-react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import toast from 'react-hot-toast';
import { apiClient } from '../services/apiClient';
import { patientService } from '../services/patientService';

// ─── Types ─────────────────────────────────────────────────────
interface Patient {
  id: number | string;
  hospital_number?: string;
  first_name?: string;
  last_name?: string;
  gender?: string;
  date_of_birth?: string;
  ward?: string;
  phone?: string;
}

interface Surgery {
  id: number;
  patient_id: number;
  procedure_name: string;
  scheduled_date: string;
  start_time?: string;
  estimated_duration?: number;
  case_category?: 'major' | 'intermediate' | 'minor';
  is_emergency?: boolean;
  diagnosis?: string;
  ward?: string;
  primary_surgeon?: string;
  anesthesia_type?: string;
  needs_blood_transfusion?: boolean;
  blood_units_requested?: number;
  required_equipment?: string[] | string;
  pre_op_notes?: string;
  status?: string;
  // Joined patient fields
  first_name?: string;
  last_name?: string;
  hospital_number?: string;
  gender?: string;
  date_of_birth?: string;
  patient_age_at_booking?: number;
  patient_gender?: string;
}

interface DayCapacity {
  date: string;
  usedPoints: number;
  remainingPoints: number;
  capacity: number;
  categoryCount: { major: number; intermediate: number; minor: number };
  emergencyCount: number;
  electiveAllowed: boolean;
  rules: any;
}

const CONSULTANT_PAIRS = [
  'Dr. Okwesili / Dr. Nnadi',
  'Dr. Okwesili / Dr. Eze',
];

const ANAESTHESIA_TYPES = [
  'General Anaesthesia (GA)',
  'Spinal',
  'Epidural',
  'Regional Block',
  'Local Anaesthesia',
  'Local + Sedation',
];

const EQUIPMENT_OPTIONS = [
  'Diathermy',
  'Tourniquet',
  'Lithotomy position',
  'Montrel mattress',
  'Operating microscope',
  'Headlight',
  'Mesher',
  'Dermatome',
  'Doppler probe',
  'C-arm fluoroscopy',
];

function calcAge(dob?: string): number | undefined {
  if (!dob) return undefined;
  const d = new Date(dob);
  if (isNaN(d.getTime())) return undefined;
  const diff = Date.now() - d.getTime();
  return Math.floor(diff / (365.25 * 24 * 3600 * 1000));
}

function nextElectiveDate(): string {
  const today = new Date();
  for (let i = 0; i < 14; i++) {
    const d = new Date(today);
    d.setDate(today.getDate() + i);
    if (d.getDay() === 3 || d.getDay() === 4) return d.toISOString().slice(0, 10);
  }
  return today.toISOString().slice(0, 10);
}

function dayName(dateStr: string): string {
  return new Date(dateStr + 'T00:00:00').toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
}

function normalizeWhatsAppNumber(phone?: string): string | null {
  if (!phone) return null;
  let p = phone.replace(/[^0-9+]/g, '');
  if (p.startsWith('+')) p = p.slice(1);
  if (p.startsWith('0')) p = '234' + p.slice(1); // Default Nigeria
  if (p.length < 10) return null;
  return p;
}

// ─── WhatsApp message templates ────────────────────────────────
function whatsappTemplates(s: Surgery, patientName: string) {
  const dateStr = dayName(s.scheduled_date);
  const time = s.start_time ? ` at ${s.start_time}` : '';
  const proc = s.procedure_name;
  return {
    booking: `Dear ${patientName},\n\nYour surgery (${proc}) has been scheduled for *${dateStr}*${time} at UNTH Plastic Surgery Theatre.\n\nPlease arrive 2 hours before the scheduled time. Bring all your medical records, prescription drugs, and a relative with you.\n\nReply to this message for any clarifications.\n\n— UNTH Plastic Surgery Unit`,
    preop: `Dear ${patientName},\n\nPRE-OP INSTRUCTIONS for your surgery on ${dateStr}:\n\n• Nothing by mouth (NPO) for at least 6 hours before surgery (no food, no water).\n• Bath the night before and on the morning of surgery.\n• Wear loose comfortable clothing.\n• Remove all jewellery, contact lenses, and nail polish.\n• Bring your hospital file, recent investigations, and consent forms.\n• If on regular medications, please call us for advice on which to take.\n• Arrange for a relative/escort to stay with you.\n\n— UNTH Plastic Surgery Unit`,
    reminder: `Dear ${patientName},\n\nThis is a friendly reminder that your surgery (${proc}) is scheduled for *tomorrow* (${dateStr})${time}.\n\nPlease confirm by replying YES, and review the pre-op instructions previously sent.\n\n— UNTH Plastic Surgery Unit`,
    reschedule: `Dear ${patientName},\n\nWe regret to inform you that your surgery (${proc}) originally scheduled for ${dateStr} has been *rescheduled*. Our team will contact you shortly with the new date.\n\nWe apologise for any inconvenience.\n\n— UNTH Plastic Surgery Unit`,
    cancel: `Dear ${patientName},\n\nYour surgery (${proc}) scheduled for ${dateStr} has been *cancelled*. Please contact the Plastic Surgery Unit on the next working day to discuss next steps.\n\nWe apologise for any inconvenience.\n\n— UNTH Plastic Surgery Unit`,
  };
}

// ─── Component ─────────────────────────────────────────────────
export const SurgeryScheduler: React.FC = () => {
  const [showForm, setShowForm] = useState(false);
  const [date, setDate] = useState(nextElectiveDate());
  const [capacity, setCapacity] = useState<DayCapacity | null>(null);
  const [slate, setSlate] = useState<Surgery[]>([]);
  const [loadingSlate, setLoadingSlate] = useState(false);
  const [patients, setPatients] = useState<Patient[]>([]);
  const [patientSearch, setPatientSearch] = useState('');
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Form state
  const [form, setForm] = useState({
    diagnosis: '',
    procedureName: '',
    estimatedDuration: 60,
    caseCategory: 'minor' as 'major' | 'intermediate' | 'minor',
    isEmergency: false,
    startTime: '08:30',
    primarySurgeon: CONSULTANT_PAIRS[0],
    anesthesiaType: ANAESTHESIA_TYPES[0],
    needsBloodTransfusion: false,
    bloodUnitsRequested: 0,
    equipment: [] as string[],
    preOpNotes: '',
    ward: '',
    whatsappPhone: '',
  });

  // ─── Load patients (cached, used for picker autocomplete) ────
  useEffect(() => {
    patientService.getAllPatients()
      .then((rows: any) => {
        if (Array.isArray(rows)) setPatients(rows);
      })
      .catch(() => { /* offline / empty */ });
  }, []);

  const fetchCapacity = useCallback(async () => {
    try {
      const cap: any = await apiClient.get(`/surgeries?action=day-capacity&date=${date}`);
      setCapacity(cap);
    } catch (e: any) {
      // Status 0 / network — silently skip; user can still browse
      console.warn('day-capacity fetch failed', e?.message);
    }
  }, [date]);

  const fetchSlate = useCallback(async () => {
    setLoadingSlate(true);
    try {
      const res: any = await apiClient.get(`/surgeries?date=${date}`);
      const list = res?.surgeries || [];
      setSlate(list);
    } catch (e: any) {
      console.warn('slate fetch failed', e?.message);
      setSlate([]);
    } finally {
      setLoadingSlate(false);
    }
  }, [date]);

  useEffect(() => {
    fetchCapacity();
    fetchSlate();
  }, [date, fetchCapacity, fetchSlate]);

  // ─── Patient search results ──────────────────────────────────
  const filteredPatients = useMemo(() => {
    const q = patientSearch.trim().toLowerCase();
    if (!q) return patients.slice(0, 10);
    return patients.filter(p => {
      const name = `${p.first_name || ''} ${p.last_name || ''}`.toLowerCase();
      return (
        name.includes(q) ||
        (p.hospital_number || '').toLowerCase().includes(q) ||
        (p.phone || '').includes(q)
      );
    }).slice(0, 15);
  }, [patientSearch, patients]);

  // Auto-fill form when a patient is selected
  useEffect(() => {
    if (selectedPatient) {
      setForm(f => ({
        ...f,
        ward: selectedPatient.ward || f.ward,
        whatsappPhone: selectedPatient.phone || f.whatsappPhone,
      }));
    }
  }, [selectedPatient]);

  // ─── Submit booking ──────────────────────────────────────────
  const submit = async () => {
    if (!selectedPatient) return toast.error('Please select a patient');
    if (!form.diagnosis.trim()) return toast.error('Indication for surgery is required');
    if (!form.procedureName.trim()) return toast.error('Procedure name is required');
    if (!form.isEmergency) {
      const dow = new Date(date + 'T00:00:00').getDay();
      if (dow !== 3 && dow !== 4) {
        return toast.error('Elective surgeries can only be booked for Wednesdays or Thursdays. Tick "Emergency" to override.');
      }
    }

    setSubmitting(true);
    try {
      const age = calcAge(selectedPatient.date_of_birth);
      const payload = {
        patientId: selectedPatient.id,
        procedureName: form.procedureName.trim(),
        scheduledDate: date,
        startTime: form.startTime || null,
        estimatedDuration: Number(form.estimatedDuration) || 60,
        caseCategory: form.caseCategory,
        isEmergency: form.isEmergency,
        diagnosis: form.diagnosis.trim(),
        ward: form.ward || selectedPatient.ward || null,
        primarySurgeon: form.primarySurgeon,
        anesthesiaType: form.anesthesiaType,
        needsBloodTransfusion: form.needsBloodTransfusion,
        bloodUnitsRequested: form.needsBloodTransfusion ? Number(form.bloodUnitsRequested) || 0 : 0,
        requiredEquipment: form.equipment,
        preOpNotes: form.preOpNotes || null,
        patientAgeAtBooking: age,
        patientGender: selectedPatient.gender || null,
        status: 'scheduled',
      };
      await apiClient.post('/surgeries', payload);
      toast.success('Surgery booked successfully');

      // Pre-fill the WhatsApp sender modal — also try auto-open
      const wa = normalizeWhatsAppNumber(form.whatsappPhone);
      if (wa) {
        const tmpl = whatsappTemplates(
          { ...payload, scheduled_date: date, procedure_name: payload.procedureName } as any,
          `${selectedPatient.first_name || ''} ${selectedPatient.last_name || ''}`.trim() || 'Patient'
        );
        const url = `https://wa.me/${wa}?text=${encodeURIComponent(tmpl.booking)}`;
        window.open(url, '_blank', 'noopener,noreferrer');
      }

      setShowForm(false);
      setSelectedPatient(null);
      setForm(f => ({ ...f, diagnosis: '', procedureName: '', preOpNotes: '', equipment: [] }));
      await Promise.all([fetchCapacity(), fetchSlate()]);
    } catch (e: any) {
      const msg = e?.message || 'Failed to book surgery';
      toast.error(msg.length > 200 ? msg.slice(0, 200) + '…' : msg);
    } finally {
      setSubmitting(false);
    }
  };

  // ─── Cancel a booking ────────────────────────────────────────
  const cancelBooking = async (s: Surgery) => {
    if (!confirm(`Cancel surgery for ${s.first_name} ${s.last_name} (${s.procedure_name})?`)) return;
    try {
      await apiClient.put(`/surgeries/${s.id}`, { status: 'cancelled' });
      toast.success('Surgery cancelled');
      // Offer WhatsApp cancel message
      const wa = normalizeWhatsAppNumber(slate.find(x => x.id === s.id)?.phone_number as any);
      if (wa) {
        const tmpl = whatsappTemplates(s, `${s.first_name} ${s.last_name}`);
        const url = `https://wa.me/${wa}?text=${encodeURIComponent(tmpl.cancel)}`;
        if (confirm('Send cancellation message via WhatsApp?')) {
          window.open(url, '_blank', 'noopener,noreferrer');
        }
      }
      await Promise.all([fetchCapacity(), fetchSlate()]);
    } catch (e: any) {
      toast.error(e?.message || 'Failed to cancel');
    }
  };

  // ─── Send a WhatsApp template ────────────────────────────────
  const sendWhatsApp = (s: Surgery, kind: keyof ReturnType<typeof whatsappTemplates>) => {
    const phone: string | undefined = (s as any).phone || (s as any).phone_number || prompt('Enter patient WhatsApp number (with country code or leading 0):') || undefined;
    const wa = normalizeWhatsAppNumber(phone);
    if (!wa) return toast.error('Invalid WhatsApp number');
    const tmpl = whatsappTemplates(s, `${s.first_name || ''} ${s.last_name || ''}`.trim() || 'Patient');
    const url = `https://wa.me/${wa}?text=${encodeURIComponent(tmpl[kind])}`;
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  // ─── Download daily theatre list as PDF ──────────────────────
  const downloadPDF = () => {
    if (!slate.length) {
      return toast.error('No surgeries booked for this date');
    }
    const doc = new jsPDF({ orientation: 'landscape' });
    doc.setFontSize(14);
    doc.text('UNTH Plastic Surgery Unit — Theatre Slate', 14, 14);
    doc.setFontSize(11);
    doc.text(dayName(date), 14, 21);
    if (capacity) {
      doc.setFontSize(9);
      doc.text(
        `Capacity used: ${capacity.usedPoints}/${capacity.capacity} pts  |  Major: ${capacity.categoryCount.major}  Intermediate: ${capacity.categoryCount.intermediate}  Minor: ${capacity.categoryCount.minor}  Emergency: ${capacity.emergencyCount}`,
        14, 27
      );
    }

    autoTable(doc, {
      startY: 32,
      head: [[
        '#', 'Patient', 'Hosp #', 'Age/Sex', 'Ward',
        'Diagnosis', 'Procedure', 'Cat.', 'Anaesth.',
        'Surgeon', 'Time', 'Dur.', 'Blood', 'Equipment'
      ]],
      body: slate
        .filter(s => s.status !== 'cancelled')
        .sort((a, b) => (a.start_time || '').localeCompare(b.start_time || ''))
        .map((s, i) => {
          const equip = Array.isArray(s.required_equipment)
            ? s.required_equipment.join(', ')
            : (typeof s.required_equipment === 'string' ? s.required_equipment : '');
          const ageSex = `${s.patient_age_at_booking || calcAge(s.date_of_birth) || '?'} / ${(s.patient_gender || s.gender || '?').slice(0, 1).toUpperCase()}`;
          return [
            String(i + 1),
            `${s.first_name || ''} ${s.last_name || ''}`.trim(),
            s.hospital_number || '',
            ageSex,
            s.ward || '',
            s.diagnosis || '',
            s.procedure_name || '',
            s.is_emergency ? 'EMERGENCY' : (s.case_category || '').toUpperCase(),
            s.anesthesia_type || '',
            s.primary_surgeon || '',
            s.start_time || '',
            s.estimated_duration ? `${s.estimated_duration}m` : '',
            s.needs_blood_transfusion ? `Yes (${s.blood_units_requested || 0}u)` : 'No',
            equip,
          ];
        }),
      styles: { fontSize: 7.5, cellPadding: 1.5, overflow: 'linebreak' },
      headStyles: { fillColor: [14, 159, 110], textColor: 255, fontSize: 8 },
      columnStyles: {
        0: { cellWidth: 8 },
        5: { cellWidth: 38 },
        6: { cellWidth: 38 },
        13: { cellWidth: 32 },
      },
      didDrawPage: (data) => {
        doc.setFontSize(8);
        doc.setTextColor(120);
        doc.text(
          `Generated: ${new Date().toLocaleString()}  |  Page ${data.pageNumber}`,
          14, doc.internal.pageSize.getHeight() - 8
        );
      },
    });
    doc.save(`theatre-slate-${date}.pdf`);
    toast.success('PDF downloaded');
  };

  // ─── Render ──────────────────────────────────────────────────
  const dow = new Date(date + 'T00:00:00').getDay();
  const isElectiveDay = dow === 3 || dow === 4;

  return (
    <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-5 mt-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-4">
        <div>
          <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <Stethoscope className="w-5 h-5 text-green-700" /> Surgery Scheduling
          </h2>
          <p className="text-xs text-gray-500 mt-1">
            Electives: <strong>Wednesdays &amp; Thursdays</strong> · Emergencies: any day · Daily slate cap: 4 pts (Major 2 · Intermediate 1 · Minor 0.5)
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <input
            type="date"
            value={date}
            onChange={e => setDate(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
            aria-label="Surgery date"
          />
          <button
            onClick={() => { fetchCapacity(); fetchSlate(); }}
            className="flex items-center gap-1.5 px-3 py-2 border border-gray-300 rounded-lg text-sm hover:bg-gray-50"
            title="Refresh"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
          <button
            onClick={downloadPDF}
            disabled={!slate.length}
            className="flex items-center gap-1.5 px-3 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 disabled:opacity-40"
          >
            <FileDown className="w-4 h-4" /> Download Theatre PDF
          </button>
          <button
            onClick={() => setShowForm(true)}
            className="flex items-center gap-1.5 px-3 py-2 bg-green-600 text-white rounded-lg text-sm hover:bg-green-700"
          >
            <Plus className="w-4 h-4" /> Book Surgery
          </button>
        </div>
      </div>

      {/* Capacity strip */}
      {capacity && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-2 mb-4">
          <div className="bg-gray-50 border rounded-lg p-2 text-center">
            <div className="text-xs text-gray-500">Slate (pts)</div>
            <div className="text-lg font-bold text-gray-800">{capacity.usedPoints} / {capacity.capacity}</div>
          </div>
          <div className="bg-red-50 border border-red-100 rounded-lg p-2 text-center">
            <div className="text-xs text-red-700">Major</div>
            <div className="text-lg font-bold text-red-700">{capacity.categoryCount.major} / 2</div>
          </div>
          <div className="bg-amber-50 border border-amber-100 rounded-lg p-2 text-center">
            <div className="text-xs text-amber-700">Intermediate</div>
            <div className="text-lg font-bold text-amber-700">{capacity.categoryCount.intermediate} / 2</div>
          </div>
          <div className="bg-emerald-50 border border-emerald-100 rounded-lg p-2 text-center">
            <div className="text-xs text-emerald-700">Minor</div>
            <div className="text-lg font-bold text-emerald-700">{capacity.categoryCount.minor} / 4</div>
          </div>
          <div className="bg-purple-50 border border-purple-100 rounded-lg p-2 text-center">
            <div className="text-xs text-purple-700">Emergency</div>
            <div className="text-lg font-bold text-purple-700">{capacity.emergencyCount}</div>
          </div>
        </div>
      )}

      {!isElectiveDay && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-2.5 mb-4 flex items-start gap-2">
          <AlertTriangle className="w-4 h-4 text-amber-700 flex-shrink-0 mt-0.5" />
          <p className="text-xs text-amber-800">
            <strong>{new Date(date + 'T00:00:00').toLocaleDateString(undefined, { weekday: 'long' })}</strong> is not a regular elective day.
            Only emergency cases will be accepted on this date.
          </p>
        </div>
      )}

      {/* Theatre slate list */}
      <div className="overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-50 text-xs uppercase text-gray-600">
            <tr>
              <th className="px-3 py-2 text-left">#</th>
              <th className="px-3 py-2 text-left">Patient</th>
              <th className="px-3 py-2 text-left">Procedure</th>
              <th className="px-3 py-2 text-left">Cat.</th>
              <th className="px-3 py-2 text-left">Surgeon</th>
              <th className="px-3 py-2 text-left">Time</th>
              <th className="px-3 py-2 text-left">Status</th>
              <th className="px-3 py-2 text-left">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {loadingSlate && (
              <tr><td colSpan={8} className="text-center py-6 text-gray-400">Loading…</td></tr>
            )}
            {!loadingSlate && slate.length === 0 && (
              <tr><td colSpan={8} className="text-center py-6 text-gray-400">No surgeries booked for this date.</td></tr>
            )}
            {slate
              .sort((a, b) => (a.start_time || '').localeCompare(b.start_time || ''))
              .map((s, i) => (
              <tr key={s.id} className={s.status === 'cancelled' ? 'opacity-50 line-through' : ''}>
                <td className="px-3 py-2 text-gray-400">{i + 1}</td>
                <td className="px-3 py-2">
                  <div className="font-semibold text-gray-800">{s.first_name} {s.last_name}</div>
                  <div className="text-xs text-gray-500">{s.hospital_number} · {s.patient_gender || s.gender || '?'} · {s.patient_age_at_booking || calcAge(s.date_of_birth) || '?'}y · {s.ward || '—'}</div>
                </td>
                <td className="px-3 py-2">
                  <div className="font-medium text-gray-800">{s.procedure_name}</div>
                  <div className="text-xs text-gray-500">{s.diagnosis}</div>
                </td>
                <td className="px-3 py-2">
                  <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-semibold ${
                    s.is_emergency ? 'bg-purple-100 text-purple-800'
                    : s.case_category === 'major' ? 'bg-red-100 text-red-800'
                    : s.case_category === 'intermediate' ? 'bg-amber-100 text-amber-800'
                    : 'bg-emerald-100 text-emerald-800'
                  }`}>
                    {s.is_emergency ? 'EMERGENCY' : (s.case_category || '').toUpperCase()}
                  </span>
                </td>
                <td className="px-3 py-2 text-xs">{s.primary_surgeon}</td>
                <td className="px-3 py-2 text-xs">{s.start_time || '—'} ({s.estimated_duration || 60}m)</td>
                <td className="px-3 py-2 text-xs">{s.status}</td>
                <td className="px-3 py-2">
                  <div className="flex flex-wrap gap-1">
                    <button
                      onClick={() => sendWhatsApp(s, 'preop')}
                      className="text-xs px-2 py-1 bg-green-100 text-green-800 rounded hover:bg-green-200"
                      title="Send pre-op instructions via WhatsApp"
                    >
                      <MessageCircle className="w-3 h-3 inline" /> Pre-op
                    </button>
                    <button
                      onClick={() => sendWhatsApp(s, 'reminder')}
                      className="text-xs px-2 py-1 bg-blue-100 text-blue-800 rounded hover:bg-blue-200"
                      title="Send reminder via WhatsApp"
                    >
                      Remind
                    </button>
                    <button
                      onClick={() => sendWhatsApp(s, 'reschedule')}
                      className="text-xs px-2 py-1 bg-amber-100 text-amber-800 rounded hover:bg-amber-200"
                      title="Send reschedule notice via WhatsApp"
                    >
                      Reschedule
                    </button>
                    {s.status !== 'cancelled' && (
                      <button
                        onClick={() => cancelBooking(s)}
                        className="text-xs px-2 py-1 bg-red-100 text-red-800 rounded hover:bg-red-200"
                        title="Cancel this surgery"
                      >
                        <Trash2 className="w-3 h-3 inline" />
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* ─── Booking Modal ────────────────────────────────── */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center bg-black/40 p-2 md:p-4 overflow-y-auto">
          <div className="bg-white w-full max-w-3xl rounded-xl shadow-2xl max-h-[95vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b px-5 py-3 flex items-center justify-between z-10">
              <h3 className="text-lg font-bold text-gray-800">Book a Surgery</h3>
              <button onClick={() => setShowForm(false)} className="text-gray-500 hover:text-gray-800" aria-label="Close">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 space-y-4">
              {/* Patient picker */}
              {!selectedPatient ? (
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    <Search className="w-3 h-3 inline" /> Search patient (name, hospital number, or phone)
                  </label>
                  <input
                    autoFocus
                    value={patientSearch}
                    onChange={e => setPatientSearch(e.target.value)}
                    placeholder="Type at least 2 characters…"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                  />
                  <div className="mt-2 max-h-56 overflow-y-auto border rounded-lg divide-y">
                    {filteredPatients.length === 0 && (
                      <div className="text-center py-4 text-xs text-gray-400">No patients match.</div>
                    )}
                    {filteredPatients.map(p => (
                      <button
                        key={String(p.id)}
                        onClick={() => setSelectedPatient(p)}
                        className="w-full text-left px-3 py-2 hover:bg-green-50"
                      >
                        <div className="font-medium text-gray-800">{p.first_name} {p.last_name}</div>
                        <div className="text-xs text-gray-500">
                          {p.hospital_number} · {p.gender || '?'} · {calcAge(p.date_of_birth) ?? '?'}y · Ward: {p.ward || '—'} · {p.phone || 'no phone'}
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="bg-green-50 border border-green-200 rounded-lg p-3 flex items-center justify-between">
                  <div>
                    <div className="font-semibold text-green-900">{selectedPatient.first_name} {selectedPatient.last_name}</div>
                    <div className="text-xs text-green-800">
                      {selectedPatient.hospital_number} · {selectedPatient.gender} · {calcAge(selectedPatient.date_of_birth) ?? '?'}y · Ward: {selectedPatient.ward || '—'}
                    </div>
                  </div>
                  <button onClick={() => setSelectedPatient(null)} className="text-xs text-green-700 underline">Change</button>
                </div>
              )}

              {selectedPatient && (
                <>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-gray-700 mb-1">Indication for Surgery</label>
                      <input
                        value={form.diagnosis}
                        onChange={e => setForm({ ...form, diagnosis: e.target.value })}
                        placeholder="e.g. Post-burn contracture left axilla"
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-gray-700 mb-1">Procedure Name</label>
                      <input
                        value={form.procedureName}
                        onChange={e => setForm({ ...form, procedureName: e.target.value })}
                        placeholder="e.g. Z-plasty + STSG"
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-gray-700 mb-1">Ward</label>
                      <input
                        value={form.ward}
                        onChange={e => setForm({ ...form, ward: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-gray-700 mb-1">Patient WhatsApp Number</label>
                      <input
                        value={form.whatsappPhone}
                        onChange={e => setForm({ ...form, whatsappPhone: e.target.value })}
                        placeholder="e.g. 08012345678 or +234..."
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-gray-700 mb-1">Category</label>
                      <select
                        value={form.caseCategory}
                        onChange={e => setForm({ ...form, caseCategory: e.target.value as any })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                      >
                        <option value="major">Major (2 pts)</option>
                        <option value="intermediate">Intermediate (1 pt)</option>
                        <option value="minor">Minor (0.5 pt)</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-gray-700 mb-1">Operating Consultants</label>
                      <select
                        value={form.primarySurgeon}
                        onChange={e => setForm({ ...form, primarySurgeon: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                      >
                        {CONSULTANT_PAIRS.map(c => <option key={c} value={c}>{c}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-gray-700 mb-1">Anaesthesia Type</label>
                      <select
                        value={form.anesthesiaType}
                        onChange={e => setForm({ ...form, anesthesiaType: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                      >
                        {ANAESTHESIA_TYPES.map(a => <option key={a} value={a}>{a}</option>)}
                      </select>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-xs font-semibold text-gray-700 mb-1">Start Time</label>
                        <input
                          type="time"
                          value={form.startTime}
                          onChange={e => setForm({ ...form, startTime: e.target.value })}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                          aria-label="Start time"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-gray-700 mb-1">Duration (min)</label>
                        <input
                          type="number"
                          min={15}
                          step={15}
                          value={form.estimatedDuration}
                          onChange={e => setForm({ ...form, estimatedDuration: Number(e.target.value) })}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                          aria-label="Duration"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Equipment checkboxes */}
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">Equipment / Special Requirements</label>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-1.5 bg-gray-50 border rounded-lg p-2">
                      {EQUIPMENT_OPTIONS.map(eq => (
                        <label key={eq} className="flex items-center gap-1.5 text-xs">
                          <input
                            type="checkbox"
                            checked={form.equipment.includes(eq)}
                            onChange={e => {
                              const next = e.target.checked
                                ? [...form.equipment, eq]
                                : form.equipment.filter(x => x !== eq);
                              setForm({ ...form, equipment: next });
                            }}
                            className="rounded border-gray-300"
                          />
                          {eq}
                        </label>
                      ))}
                    </div>
                  </div>

                  {/* Blood transfusion */}
                  <div className="bg-red-50 border border-red-100 rounded-lg p-3">
                    <label className="flex items-center gap-2 text-sm font-medium text-red-900">
                      <input
                        type="checkbox"
                        checked={form.needsBloodTransfusion}
                        onChange={e => setForm({ ...form, needsBloodTransfusion: e.target.checked })}
                      />
                      Patient may need blood transfusion
                    </label>
                    {form.needsBloodTransfusion && (
                      <div className="mt-2 flex items-center gap-2">
                        <label className="text-xs text-red-800">Units:</label>
                        <input
                          type="number"
                          min={1}
                          max={20}
                          value={form.bloodUnitsRequested}
                          onChange={e => setForm({ ...form, bloodUnitsRequested: Number(e.target.value) })}
                          className="w-20 px-2 py-1 border border-red-300 rounded text-sm"
                          aria-label="Blood units"
                        />
                      </div>
                    )}
                  </div>

                  {/* Emergency toggle */}
                  <label className="flex items-center gap-2 text-sm font-medium text-purple-900 bg-purple-50 border border-purple-100 rounded-lg p-3">
                    <input
                      type="checkbox"
                      checked={form.isEmergency}
                      onChange={e => setForm({ ...form, isEmergency: e.target.checked })}
                    />
                    Emergency case (overrides Wed/Thu rule, does not consume slate capacity)
                  </label>

                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">Pre-op notes (optional)</label>
                    <textarea
                      rows={2}
                      value={form.preOpNotes}
                      onChange={e => setForm({ ...form, preOpNotes: e.target.value })}
                      placeholder="e.g. Group + cross-match 2u, NPO from midnight, antibiotic prophylaxis…"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                    />
                  </div>

                  <div className="flex justify-end gap-2 pt-2 border-t">
                    <button
                      onClick={() => setShowForm(false)}
                      disabled={submitting}
                      className="px-4 py-2 border border-gray-300 rounded-lg text-sm hover:bg-gray-50"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={submit}
                      disabled={submitting}
                      className="px-4 py-2 bg-green-600 text-white rounded-lg text-sm hover:bg-green-700 disabled:opacity-50"
                    >
                      {submitting ? 'Booking…' : 'Book & send WhatsApp'}
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SurgeryScheduler;

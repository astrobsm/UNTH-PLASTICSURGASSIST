import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Calendar, Clock, User, CheckCircle, AlertCircle, Stethoscope, ChevronRight, ArrowLeft } from 'lucide-react';
import { apiClient } from '../services/apiClient';

interface ClinicDate {
  date: string;
  dayName: string;
  dayOfWeek: number;
  doctors: string[];
  schedule: { label: string; start: string; end: string }[];
  scheduleLabel: string;
}

interface TimeSlot {
  time: string;
  available: boolean;
}

interface Appointment {
  id: number;
  patient_number: string;
  date: string;
  time_slot: string;
  doctor_assigned: string;
}

function formatSlotDisplay(slot: string): string {
  const [start, end] = slot.split('-');
  const fmt = (t: string) => {
    const [h, m] = t.split(':').map(Number);
    const ampm = h >= 12 ? 'PM' : 'AM';
    const h12 = h > 12 ? h - 12 : h === 0 ? 12 : h;
    return `${h12}:${String(m).padStart(2, '0')} ${ampm}`;
  };
  return `${fmt(start)} – ${fmt(end)}`;
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
}

export default function ClinicAppointmentBooking() {
  const navigate = useNavigate();
  const [step, setStep] = useState<'select-date' | 'select-slot' | 'enter-details' | 'confirmed'>('select-date');
  const [clinicDates, setClinicDates] = useState<ClinicDate[]>([]);
  const [selectedDate, setSelectedDate] = useState<ClinicDate | null>(null);
  const [slots, setSlots] = useState<TimeSlot[]>([]);
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null);
  const [patientNumber, setPatientNumber] = useState('');
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  const [showTerms, setShowTerms] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [confirmedAppointment, setConfirmedAppointment] = useState<Appointment | null>(null);

  // Fetch upcoming clinic dates
  useEffect(() => {
    apiClient.get('/appointments?action=dates')
      .then(data => setClinicDates(data.dates || []))
      .catch(() => setError('Unable to load clinic schedule. Please try again.'));
  }, []);

  // Fetch slots when date is selected
  const loadSlots = useCallback(async (date: ClinicDate) => {
    setSelectedDate(date);
    setSelectedSlot(null);
    setLoading(true);
    setError('');
    try {
      const data = await apiClient.get(`/appointments?action=slots&date=${date.date}`);
      setSlots(data.slots || []);
      setStep('select-slot');
    } catch (e: any) {
      setError(e.message || 'Failed to load time slots');
    } finally {
      setLoading(false);
    }
  }, []);

  const handleBookAppointment = async () => {
    if (!selectedDate || !selectedSlot || !patientNumber.trim()) return;
    setLoading(true);
    setError('');
    try {
      const data = await apiClient.post('/appointments', {
          patient_number: patientNumber.trim(),
          date: selectedDate.date,
          time_slot: selectedSlot
        });
      setConfirmedAppointment(data.appointment);
      setStep('confirmed');
    } catch (e: any) {
      setError(e.message || 'Failed to book appointment');
    } finally {
      setLoading(false);
    }
  };

  const resetBooking = () => {
    setStep('select-date');
    setSelectedDate(null);
    setSelectedSlot(null);
    setPatientNumber('');
    setAgreedToTerms(false);
    setConfirmedAppointment(null);
    setError('');
  };

  // Separate morning vs afternoon slots (only relevant for Tuesday)
  const isTuesday = selectedDate?.dayOfWeek === 2;
  const morningSlots = slots.filter(s => {
    const hour = parseInt(s.time.split(':')[0]);
    return hour < 14;
  });
  const afternoonSlots = slots.filter(s => {
    const hour = parseInt(s.time.split(':')[0]);
    return hour >= 14;
  });

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 via-white to-emerald-50">
      {/* Header */}
      <header className="bg-white border-b border-green-200 shadow-sm sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-green-600 rounded-xl flex items-center justify-center">
              <Stethoscope className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-lg sm:text-xl font-bold text-gray-900">CLINIC APPOINTMENT BOOKING</h1>
              <p className="text-xs text-gray-500">Plastic Surgery Unit • UNTH</p>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-6 sm:py-10">
        {/* Progress indicator */}
        <div className="flex items-center justify-center gap-2 mb-8">
          {['Select Date', 'Choose Time', 'Your Details', 'Confirmed'].map((label, i) => {
            const stepIdx = ['select-date', 'select-slot', 'enter-details', 'confirmed'].indexOf(step);
            const isActive = i === stepIdx;
            const isDone = i < stepIdx;
            return (
              <React.Fragment key={label}>
                {i > 0 && <div className={`h-0.5 w-8 ${isDone ? 'bg-green-500' : 'bg-gray-200'}`} />}
                <div className="flex flex-col items-center">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold
                    ${isActive ? 'bg-green-600 text-white' : isDone ? 'bg-green-500 text-white' : 'bg-gray-200 text-gray-500'}`}>
                    {isDone ? '✓' : i + 1}
                  </div>
                  <span className={`text-xs mt-1 hidden sm:block ${isActive ? 'text-green-700 font-semibold' : 'text-gray-400'}`}>{label}</span>
                </div>
              </React.Fragment>
            );
          })}
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl flex items-start gap-3 text-red-800">
            <AlertCircle className="w-5 h-5 mt-0.5 flex-shrink-0" />
            <div>
              <p className="font-medium">Error</p>
              <p className="text-sm">{error}</p>
            </div>
          </div>
        )}

        {/* STEP 1: Select Date */}
        {step === 'select-date' && (
          <div>
            <h2 className="text-xl font-bold text-gray-900 mb-2">Select a Clinic Day</h2>
            <p className="text-gray-600 mb-6">Our clinic runs on <strong>Tuesdays</strong> and <strong>Wednesdays</strong></p>
            
            {clinicDates.length === 0 && !error ? (
              <div className="text-center py-12">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-600 mx-auto mb-3" />
                <p className="text-gray-500">Loading schedule...</p>
              </div>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2">
                {clinicDates.map(d => (
                  <button
                    key={d.date}
                    onClick={() => loadSlots(d)}
                    className="flex items-center justify-between p-4 bg-white border border-gray-200 rounded-xl hover:border-green-400 hover:shadow-md transition-all group text-left"
                  >
                    <div className="flex items-center gap-3">
                      <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${
                        d.dayOfWeek === 2 ? 'bg-blue-100 text-blue-700' : 'bg-purple-100 text-purple-700'
                      }`}>
                        <Calendar className="w-6 h-6" />
                      </div>
                      <div>
                        <p className="font-semibold text-gray-900">{d.dayName}</p>
                        <p className="text-sm text-gray-500">{formatDate(d.date)}</p>
                        <p className="text-xs text-gray-400 mt-0.5">
                          {d.doctors.join(', ')}
                        </p>
                      </div>
                    </div>
                    <ChevronRight className="w-5 h-5 text-gray-300 group-hover:text-green-500 transition-colors" />
                  </button>
                ))}
              </div>
            )}

            {/* Schedule Info */}
            <div className="mt-8 p-4 bg-green-50 border border-green-200 rounded-xl">
              <h3 className="font-semibold text-green-900 mb-2">Clinic Schedule</h3>
              <div className="grid sm:grid-cols-2 gap-3 text-sm text-green-800">
                <div>
                  <p className="font-medium">Tuesday</p>
                  <p>9:00 AM – 1:30 PM, 2:00 PM – 4:00 PM</p>
                </div>
                <div>
                  <p className="font-medium">Wednesday</p>
                  <p>10:00 AM – 4:00 PM</p>
                </div>
              </div>
              <p className="text-xs text-green-600 mt-2">Tuesday has a break: 1:30 PM – 2:00 PM</p>
            </div>
          </div>
        )}

        {/* STEP 2: Select Time Slot */}
        {step === 'select-slot' && selectedDate && (
          <div>
            <button onClick={() => setStep('select-date')} className="flex items-center gap-1 text-green-700 hover:text-green-800 mb-4 text-sm font-medium">
              <ArrowLeft className="w-4 h-4" /> Back to dates
            </button>
            <h2 className="text-xl font-bold text-gray-900 mb-1">Select a Time Slot</h2>
            <p className="text-gray-600 mb-6">{formatDate(selectedDate.date)} • Each slot is 20 minutes</p>

            {loading ? (
              <div className="text-center py-12">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-600 mx-auto mb-3" />
                <p className="text-gray-500">Loading available slots...</p>
              </div>
            ) : (
              <>
                {/* Morning / Main session */}
                <div className="mb-6">
                  <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                    <Clock className="w-4 h-4" /> {isTuesday ? 'Morning Session (9:00 AM – 1:30 PM)' : 'Clinic Session (10:00 AM – 4:00 PM)'}
                  </h3>
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                    {morningSlots.map(slot => (
                      <button
                        key={slot.time}
                        onClick={() => slot.available && setSelectedSlot(slot.time)}
                        disabled={!slot.available}
                        className={`px-3 py-2.5 rounded-lg text-sm font-medium border transition-all ${
                          !slot.available
                            ? 'bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed line-through'
                            : selectedSlot === slot.time
                            ? 'bg-green-600 text-white border-green-600 shadow-md'
                            : 'bg-white text-gray-700 border-gray-200 hover:border-green-400 hover:bg-green-50'
                        }`}
                      >
                        {formatSlotDisplay(slot.time)}
                        {!slot.available && <span className="block text-xs mt-0.5">Booked</span>}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Break indicator + Afternoon (Tuesday only) */}
                {isTuesday && afternoonSlots.length > 0 && (
                  <>
                    <div className="flex items-center gap-3 mb-6 px-3">
                      <div className="flex-1 h-px bg-amber-300" />
                      <span className="text-xs text-amber-600 font-medium">Break: 1:30 PM – 2:00 PM</span>
                      <div className="flex-1 h-px bg-amber-300" />
                    </div>

                    <div className="mb-6">
                      <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                        <Clock className="w-4 h-4" /> Afternoon Session (2:00 PM – 4:00 PM)
                      </h3>
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                    {afternoonSlots.map(slot => (
                      <button
                        key={slot.time}
                        onClick={() => slot.available && setSelectedSlot(slot.time)}
                        disabled={!slot.available}
                        className={`px-3 py-2.5 rounded-lg text-sm font-medium border transition-all ${
                          !slot.available
                            ? 'bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed line-through'
                            : selectedSlot === slot.time
                            ? 'bg-green-600 text-white border-green-600 shadow-md'
                            : 'bg-white text-gray-700 border-gray-200 hover:border-green-400 hover:bg-green-50'
                        }`}
                      >
                        {formatSlotDisplay(slot.time)}
                        {!slot.available && <span className="block text-xs mt-0.5">Booked</span>}
                      </button>
                    ))}
                  </div>
                    </div>
                  </>
                )}

                {selectedSlot && (
                  <div className="flex justify-end">
                    <button
                      onClick={() => setStep('enter-details')}
                      className="px-6 py-2.5 bg-green-600 text-white font-semibold rounded-xl hover:bg-green-700 transition-colors shadow-sm flex items-center gap-2"
                    >
                      Continue <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {/* STEP 3: Enter Patient Details */}
        {step === 'enter-details' && selectedDate && selectedSlot && (
          <div>
            <button onClick={() => setStep('select-slot')} className="flex items-center gap-1 text-green-700 hover:text-green-800 mb-4 text-sm font-medium">
              <ArrowLeft className="w-4 h-4" /> Back to time slots
            </button>
            <h2 className="text-xl font-bold text-gray-900 mb-1">Your Details</h2>
            <p className="text-gray-600 mb-6">Complete your booking for {formatDate(selectedDate.date)}, {formatSlotDisplay(selectedSlot)}</p>

            <div className="bg-white border border-gray-200 rounded-xl p-6 space-y-5">
              {/* Summary */}
              <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                <h3 className="font-semibold text-green-900 mb-2">Appointment Summary</h3>
                <div className="grid grid-cols-2 gap-y-2 text-sm">
                  <span className="text-green-700">Date:</span>
                  <span className="font-medium text-green-900">{formatDate(selectedDate.date)}</span>
                  <span className="text-green-700">Time:</span>
                  <span className="font-medium text-green-900">{formatSlotDisplay(selectedSlot)}</span>
                  <span className="text-green-700">Available Doctors:</span>
                  <span className="font-medium text-green-900">{selectedDate.doctors.join(', ')}</span>
                </div>
              </div>

              {/* Patient Number */}
              <div>
                <label className="block text-sm font-semibold text-gray-900 mb-2">
                  <User className="w-4 h-4 inline mr-1" />
                  Patient Number <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={patientNumber}
                  onChange={e => setPatientNumber(e.target.value)}
                  placeholder="Enter your hospital patient number"
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl text-base focus:ring-2 focus:ring-green-500 focus:border-green-500"
                  maxLength={100}
                  required
                />
              </div>

              {/* Terms */}
              <div className="border border-gray-200 rounded-xl p-4">
                <div className="flex items-start gap-3">
                  <input
                    type="checkbox"
                    id="terms"
                    checked={agreedToTerms}
                    onChange={(e) => setAgreedToTerms(e.target.checked)}
                    className="mt-1 h-5 w-5 text-green-600 rounded border-gray-300 focus:ring-green-500"
                  />
                  <label htmlFor="terms" className="text-sm text-gray-700">
                    I agree to the{' '}
                    <button
                      type="button"
                      onClick={() => setShowTerms(!showTerms)}
                      className="text-green-700 underline font-medium hover:text-green-800"
                    >
                      Clinic Appointment Terms and Conditions
                    </button>
                    <span className="text-red-500 ml-1">*</span>
                  </label>
                </div>

                {showTerms && (
                  <div className="mt-3 p-3 bg-gray-50 rounded-lg text-xs text-gray-600 space-y-2 border border-gray-100">
                    <p className="font-semibold text-gray-800">Terms and Conditions:</p>
                    <ol className="list-decimal pl-4 space-y-1.5">
                      <li>Please arrive within <strong>5 minutes before or after</strong> your scheduled appointment time.</li>
                      <li>Missed appointments will require rescheduling. Walk-ins from missed slots will not be accommodated at the originally scheduled time.</li>
                      <li>Late patients will only be seen <strong>after all previously scheduled patients</strong> have been attended to.</li>
                      <li>Each consultation slot is limited to <strong>20 minutes</strong>. Complex cases may require a follow-up appointment.</li>
                      <li>Please bring your hospital card, previous medical records, and any relevant investigation results.</li>
                      <li>Cancellations should be made at least 24 hours before the appointment where possible.</li>
                      <li>The hospital reserves the right to reassign or reschedule appointments due to emergencies.</li>
                    </ol>
                  </div>
                )}
              </div>

              {/* Book Button */}
              <button
                onClick={handleBookAppointment}
                disabled={loading || !patientNumber.trim() || !agreedToTerms}
                className="w-full py-3 bg-green-600 text-white font-bold rounded-xl hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-lg shadow-sm"
              >
                {loading ? (
                  <span className="flex items-center justify-center gap-2">
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white" />
                    Booking...
                  </span>
                ) : (
                  'Confirm Appointment'
                )}
              </button>
            </div>
          </div>
        )}

        {/* STEP 4: Confirmation */}
        {step === 'confirmed' && confirmedAppointment && (
          <div className="text-center">
            <div className="inline-flex items-center justify-center w-20 h-20 bg-green-100 rounded-full mb-6">
              <CheckCircle className="w-12 h-12 text-green-600" />
            </div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Appointment Booked!</h2>
            <p className="text-gray-600 mb-8">Your clinic appointment has been successfully scheduled.</p>

            <div className="bg-white border border-green-200 rounded-xl p-6 max-w-md mx-auto text-left shadow-sm">
              <div className="space-y-3">
                <div className="flex justify-between items-center py-2 border-b border-gray-100">
                  <span className="text-gray-600 text-sm">Patient Number</span>
                  <span className="font-bold text-gray-900">{confirmedAppointment.patient_number}</span>
                </div>
                <div className="flex justify-between items-center py-2 border-b border-gray-100">
                  <span className="text-gray-600 text-sm">Assigned Doctor</span>
                  <span className="font-bold text-green-700">{confirmedAppointment.doctor_assigned}</span>
                </div>
                <div className="flex justify-between items-center py-2 border-b border-gray-100">
                  <span className="text-gray-600 text-sm">Date</span>
                  <span className="font-bold text-gray-900">{formatDate(confirmedAppointment.date)}</span>
                </div>
                <div className="flex justify-between items-center py-2">
                  <span className="text-gray-600 text-sm">Time</span>
                  <span className="font-bold text-gray-900">{formatSlotDisplay(confirmedAppointment.time_slot)}</span>
                </div>
              </div>
            </div>

            <div className="mt-6 p-4 bg-amber-50 border border-amber-200 rounded-xl max-w-md mx-auto">
              <p className="text-amber-800 text-sm font-medium">
                📍 Please arrive within <strong>5 minutes before or after</strong> your scheduled time.
              </p>
              <p className="text-amber-700 text-xs mt-1">Late patients will be seen after all scheduled patients.</p>
            </div>

            <button
              onClick={resetBooking}
              className="mt-8 px-6 py-2.5 bg-green-600 text-white font-semibold rounded-xl hover:bg-green-700 transition-colors"
            >
              Book Another Appointment
            </button>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-gray-200 bg-white mt-12">
        <div className="max-w-4xl mx-auto px-4 py-4 text-center text-xs text-gray-500">
          <p>Plastic Surgery Unit — University of Nigeria Teaching Hospital (UNTH)</p>
          <p className="mt-1">Clinic Days: Tuesdays (9:00 AM – 4:00 PM) & Wednesdays (10:00 AM – 2:00 PM)</p>
        </div>
      </footer>
    </div>
  );
}

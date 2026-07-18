import React, { useEffect, useState } from 'react';
import { Users } from 'lucide-react';
import PhoneActions from './PhoneActions';
import { callDutyService, CallDutyShift, StaffMember } from '../services/callDutyService';

/**
 * On-call team for a chosen day — consultant, senior registrar, registrar and
 * house officer(s), each with one-tap contact. Reads the call-duty roster shift
 * covering the selected date (defaults to today). Rendered on the Dashboard so
 * everyone can see who is on call, and includes a date selector.
 */
const OnCallTeamCard: React.FC = () => {
  const [date, setDate] = useState<string>(() => new Date().toISOString().slice(0, 10));
  const [shift, setShift] = useState<CallDutyShift | null>(null);
  const [consultants, setConsultants] = useState<StaffMember[]>([]);
  const [seniorRegs, setSeniorRegs] = useState<StaffMember[]>([]);
  const [registrars, setRegistrars] = useState<StaffMember[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [c, sr, r] = await Promise.all([
        callDutyService.getStaffByRole('consultant'),
        callDutyService.getStaffByRole('senior_registrar'),
        callDutyService.getStaffByRole('junior_registrar'),
      ]);
      if (cancelled) return;
      setConsultants(c); setSeniorRegs(sr); setRegistrars(r);
    })();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    (async () => {
      const s = await callDutyService.getShiftForDate(new Date(`${date}T12:00:00`));
      if (!cancelled) { setShift(s); setLoading(false); }
    })();
    return () => { cancelled = true; };
  }, [date]);

  const isToday = date === new Date().toISOString().slice(0, 10);
  const phoneFor = (pool: StaffMember[], id?: string, direct?: string) =>
    direct || pool.find(u => u.id === id)?.phone || '';

  const contacts = shift ? [
    ...(shift.consultant_id ? [{ role: 'Consultant', name: shift.consultant_name, phone: phoneFor(consultants, shift.consultant_id, shift.consultant_phone), color: 'text-rose-700' }] : []),
    { role: 'Senior Registrar', name: shift.senior_registrar_name, phone: phoneFor(seniorRegs, shift.senior_registrar_id, shift.senior_registrar_phone), color: 'text-purple-700' },
    { role: 'Registrar', name: shift.registrar_name, phone: phoneFor(registrars, shift.registrar_id, shift.registrar_phone), color: 'text-blue-700' },
    { role: 'House Officer (Ward)', name: shift.ho_ward_name, phone: shift.ho_ward_phone, color: 'text-green-700' },
    ...(shift.ho_emergency_id && shift.ho_emergency_id !== shift.ho_ward_id
      ? [{ role: 'House Officer (Emergency)', name: shift.ho_emergency_name, phone: shift.ho_emergency_phone, color: 'text-orange-700' }] : []),
  ] : [];

  return (
    <div className="bg-white rounded-xl shadow-sm border p-4">
      <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
        <h3 className="font-semibold text-gray-800 flex items-center gap-2">
          <Users className="w-4 h-4 text-green-600" /> On-Call Team {isToday ? '(today)' : ''}
        </h3>
        <div className="flex items-center gap-2">
          <label className="text-xs text-gray-500">On call for</label>
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)}
            className="border rounded-lg px-2 py-1 text-sm" />
          {!isToday && (
            <button type="button" onClick={() => setDate(new Date().toISOString().slice(0, 10))}
              className="text-xs text-green-700 hover:underline">Today</button>
          )}
        </div>
      </div>

      {loading ? (
        <p className="text-xs text-gray-400">Loading…</p>
      ) : shift ? (
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
        <p className="text-sm text-gray-500">No call-duty roster covers {date}. Generate a roster on the Call Duty page.</p>
      )}
    </div>
  );
};

export default OnCallTeamCard;

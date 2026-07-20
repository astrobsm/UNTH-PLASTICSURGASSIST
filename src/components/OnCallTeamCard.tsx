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
  const [houseOfficers, setHouseOfficers] = useState<StaffMember[]>([]);
  const [poolsLoaded, setPoolsLoaded] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [c, sr, r, ho] = await Promise.all([
        callDutyService.getStaffByRole('consultant'),
        callDutyService.getStaffByRole('senior_registrar'),
        callDutyService.getStaffByRole('junior_registrar'),
        callDutyService.getStaffByRole('house_officer'),
      ]);
      if (cancelled) return;
      setConsultants(c); setSeniorRegs(sr); setRegistrars(r); setHouseOfficers(ho);
      setPoolsLoaded(true);
    })();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    const load = async () => {
      // Server-authoritative so every device shows the same on-call team; the
      // server auto-generates a roster if none covers the date.
      const s = await callDutyService.serverGetOnCall(date);
      if (!cancelled) { setShift(s); setLoading(false); }
    };
    load();
    // Near-real-time cross-device refresh: re-poll every 60s.
    const timer = setInterval(load, 60000);
    return () => { cancelled = true; clearInterval(timer); };
  }, [date]);

  const isToday = date === new Date().toISOString().slice(0, 10);

  // Resolve a rostered person against the CURRENT active staff pool. A roster stores
  // the staff who were on call when it was generated; if that person has since been
  // deactivated they must not still show as on call. When the pool is loaded and the
  // id is absent from it, treat the slot as needing reassignment.
  const resolve = (pool: StaffMember[], id?: string, storedName?: string, directPhone?: string) => {
    if (!id) return { name: storedName || 'TBD', phone: directPhone || '', inactive: false };
    const match = pool.find(u => u.id === id);
    if (match) return { name: match.full_name, phone: directPhone || match.phone || '', inactive: false };
    if (poolsLoaded) return { name: 'Reassign', phone: '', inactive: true };
    return { name: storedName || 'TBD', phone: directPhone || '', inactive: false };
  };

  const contacts = shift ? [
    ...(shift.consultant_id ? [{ role: 'Consultant', color: 'text-rose-700', ...resolve(consultants, shift.consultant_id, shift.consultant_name, shift.consultant_phone) }] : []),
    { role: 'Senior Registrar', color: 'text-purple-700', ...resolve(seniorRegs, shift.senior_registrar_id, shift.senior_registrar_name, shift.senior_registrar_phone) },
    { role: 'Registrar', color: 'text-blue-700', ...resolve(registrars, shift.registrar_id, shift.registrar_name, shift.registrar_phone) },
    { role: 'House Officer (Ward)', color: 'text-green-700', ...resolve(houseOfficers, shift.ho_ward_id, shift.ho_ward_name, shift.ho_ward_phone) },
    ...(shift.ho_emergency_id && shift.ho_emergency_id !== shift.ho_ward_id
      ? [{ role: 'House Officer (Emergency)', color: 'text-orange-700', ...resolve(houseOfficers, shift.ho_emergency_id, shift.ho_emergency_name, shift.ho_emergency_phone) }] : []),
  ] : [];
  const hasInactive = contacts.some(c => c.inactive);

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
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {contacts.map((c, i) => (
              <div key={i} className={`flex items-center justify-between gap-2 border rounded-lg px-3 py-1.5 ${c.inactive ? 'border-amber-200 bg-amber-50' : 'border-gray-100'}`}>
                <div className="text-sm min-w-0">
                  <span className="text-gray-500">{c.role}:</span>{' '}
                  {c.inactive ? (
                    <span className="font-medium text-amber-700 italic">Reassign — staff deactivated</span>
                  ) : (
                    <span className={`font-medium ${c.color}`}>{c.name || 'TBD'}</span>
                  )}
                </div>
                {c.inactive
                  ? null
                  : c.phone ? <PhoneActions phone={c.phone} compact /> : <span className="text-xs text-gray-400">no phone</span>}
              </div>
            ))}
          </div>
          {hasInactive && (
            <p className="mt-2 text-xs text-amber-700">
              ⚠ One or more on-call staff have been deactivated. Regenerate the roster on the Call Duty page to fill their slots.
            </p>
          )}
        </>
      ) : (
        <p className="text-sm text-gray-500">No call-duty roster covers {date}. Generate a roster on the Call Duty page.</p>
      )}
    </div>
  );
};

export default OnCallTeamCard;

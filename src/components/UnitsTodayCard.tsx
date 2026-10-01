import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Building2, CalendarClock, RefreshCw } from 'lucide-react';
import { useAuthStore } from '../store/authStore';
import {
  callDutyService, currentUnits, unitsForUser,
  type UnitCallConfig, type StaffMember, type RotatingGrade,
} from '../services/callDutyService';
import { PS_UNITS, HO_ROUND_WINDOW, unitWeek } from '../config/psUnits';

const GRADE_ROWS: { key: 'consultant_ids' | 'senior_registrar_ids' | 'registrar_ids' | 'house_officer_ids'; label: string; grade?: RotatingGrade }[] = [
  { key: 'consultant_ids', label: 'Consultants' },
  { key: 'senior_registrar_ids', label: 'Senior registrars', grade: 'senior_registrar' },
  { key: 'registrar_ids', label: 'Registrars', grade: 'registrar' },
  { key: 'house_officer_ids', label: 'House officers', grade: 'house_officer' },
];
const SHORT_DAY: Record<string, string> = { Monday: 'Mon', Tuesday: 'Tue', Wednesday: 'Wed', Thursday: 'Thu', Friday: 'Fri', Saturday: 'Sat', Sunday: 'Sun' };

/**
 * The two units as they stand today: who is in each (after rotation), the
 * unit's weekly timetable with today highlighted, and when the juniors next
 * rotate. Replaces the older name-based unit roster once units are configured
 * on the Call Duty page.
 */
export default function UnitsTodayCard({ config }: { config: UnitCallConfig }) {
  const { user } = useAuthStore();
  const [staff, setStaff] = useState<Map<string, StaffMember>>(new Map());

  useEffect(() => {
    Promise.all(['consultant', 'senior_registrar', 'junior_registrar', 'house_officer'].map(r => callDutyService.getStaffByRole(r)))
      .then(lists => setStaff(new Map(lists.flat().map(s => [String(s.id), s]))))
      .catch(() => setStaff(new Map()));
  }, []);

  const units = currentUnits(config);
  const mine = new Set(unitsForUser(config, user?.id).map(u => u.key));
  const today = new Date().toLocaleDateString('en-GB', { weekday: 'long' });
  const fmt = (ymd?: string | null) => (ymd ? new Date(`${ymd}T12:00:00`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) : null);

  return (
    <div className="card p-4 sm:p-6">
      <div className="flex items-center justify-between gap-2 mb-3">
        <h3 className="text-base sm:text-lg font-semibold text-clinical-dark flex items-center gap-2">
          <Building2 className="h-5 w-5 text-primary-600" /> Units today
        </h3>
        <Link to="/call-duty" className="text-xs text-primary-700 hover:underline">Manage units</Link>
      </div>
      <p className="text-xs text-gray-600 mb-3 flex items-center gap-1">
        <CalendarClock className="h-3.5 w-3.5" />
        Every day {HO_ROUND_WINDOW.startTime} – {HO_ROUND_WINDOW.endTime}: house officers' round — document each patient in the app and in the folder.
      </p>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {units.map((u, i) => {
          const timetable = PS_UNITS[i] ? unitWeek(PS_UNITS[i]) : [];
          const todays = timetable.find(d => d.day === today)?.activities || [];
          return (
            <div key={u.key} className={`border rounded-lg p-3 ${mine.has(u.key) ? 'border-primary-400 bg-primary-50/40' : 'border-gray-200'}`}>
              <div className="flex items-center justify-between gap-2">
                <span className="font-semibold text-clinical-dark">{u.name}</span>
                {mine.has(u.key) && <span className="text-[11px] px-2 py-0.5 rounded-full bg-primary-100 text-primary-800">Your unit</span>}
              </div>
              <div className="text-sm mt-1">
                <span className="text-gray-500">Today:</span>{' '}
                <span className="font-medium">{todays.length ? todays.join(', ') : 'No fixed unit activity'}</span>
              </div>

              <div className="grid grid-cols-7 gap-1 mt-2 text-[10px]">
                {timetable.map(d => (
                  <div key={d.day} className={`rounded border px-1 py-1 ${d.day === today ? 'border-primary-500 bg-white font-semibold' : 'border-gray-200 bg-gray-50'}`}>
                    <div className="text-gray-500">{SHORT_DAY[d.day]}</div>
                    <div className="text-gray-800 leading-tight">{d.activities.join(', ') || '—'}</div>
                  </div>
                ))}
              </div>

              <dl className="mt-3 space-y-1 text-xs">
                {GRADE_ROWS.map(g => {
                  const next = g.grade ? fmt(config.next_rotation?.[g.grade]) : null;
                  return (
                    <div key={g.key} className="flex gap-2">
                      <dt className="text-gray-500 w-28 flex-shrink-0">{g.label}</dt>
                      <dd className="text-gray-800 flex-1">
                        {u[g.key].length ? u[g.key].map(id => staff.get(String(id))?.full_name || '…').join(', ') : <span className="text-gray-400">—</span>}
                        {next && <span className="ml-1 text-gray-400 inline-flex items-center gap-0.5"><RefreshCw className="h-3 w-3" />rotates {next}</span>}
                      </dd>
                    </div>
                  );
                })}
              </dl>
            </div>
          );
        })}
      </div>
    </div>
  );
}

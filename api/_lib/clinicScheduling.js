// Pure clinic scheduling helpers — shared between the serverless API
// (api/clinic-appointments.js) and the unit test suite. No I/O or DB access here
// so the logic can be tested deterministically.

// ── Default configuration (used until an admin saves one in Settings) ───────
export const DEFAULT_CONFIG = {
  slotMinutes: 20,
  holidays: [],
  days: {
    '0': { enabled: false, stations: 0, doctors: [], sessions: [] },
    '1': { enabled: false, stations: 0, doctors: [], sessions: [] },
    '2': {
      enabled: true, stations: 3,
      doctors: ['Dr. Nnadi', 'Dr. Onyia', 'Dr. Okwesili'],
      sessions: [
        { label: 'Morning Session', start: '09:00', end: '13:30' },
        { label: 'Afternoon Session', start: '14:00', end: '16:00' },
      ],
    },
    '3': {
      enabled: true, stations: 1,
      doctors: ['Dr. Eze'],
      sessions: [{ label: 'Clinic Session', start: '10:00', end: '16:00' }],
    },
    '4': { enabled: false, stations: 0, doctors: [], sessions: [] },
    '5': { enabled: false, stations: 0, doctors: [], sessions: [] },
    '6': { enabled: false, stations: 0, doctors: [], sessions: [] },
  },
};

export const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

// Pre-operative planning checklist created when a "Surgery Scheduling"
// appointment is booked or promoted into the surgical queue.
export const SURGERY_CHECKLIST_ITEMS = [
  'preop_checklist', 'consent', 'investigations', 'anaesthetic_review', 'theatre_booking', 'admission',
];

export function defaultSurgeryChecklist() {
  const c = {};
  SURGERY_CHECKLIST_ITEMS.forEach(k => { c[k] = false; });
  return c;
}

export function deriveQueueStatus(checklist) {
  const vals = SURGERY_CHECKLIST_ITEMS.map(k => !!(checklist || {})[k]);
  if (vals.every(Boolean)) return 'ready';
  if (vals.some(Boolean)) return 'in_progress';
  return 'pending';
}

export function normalizeConfig(cfg) {
  const out = { slotMinutes: cfg.slotMinutes || 20, holidays: Array.isArray(cfg.holidays) ? cfg.holidays : [], days: {} };
  for (let dow = 0; dow <= 6; dow++) {
    const d = (cfg.days && cfg.days[String(dow)]) || DEFAULT_CONFIG.days[String(dow)];
    out.days[String(dow)] = {
      enabled: !!d.enabled,
      stations: Number(d.stations) || (d.doctors ? d.doctors.length : 0),
      doctors: Array.isArray(d.doctors) ? d.doctors : [],
      sessions: Array.isArray(d.sessions) ? d.sessions : [],
      slotMinutes: d.slotMinutes ? Number(d.slotMinutes) : undefined,
    };
  }
  return out;
}

export function dayConfigFor(config, dow) {
  return config.days[String(dow)] || DEFAULT_CONFIG.days[String(dow)];
}

export function isHoliday(config, dateStr) {
  return Array.isArray(config.holidays) && config.holidays.includes(dateStr);
}

// Generate uniform grid slots for a day from its sessions.
export function generateTimeSlots(config, dow) {
  const day = dayConfigFor(config, dow);
  const slotDuration = day.slotMinutes || config.slotMinutes || 20;
  const slots = [];
  for (const session of (day.sessions || [])) {
    const [startHour, startMin] = session.start.split(':').map(Number);
    const [endHour, endMin] = session.end.split(':').map(Number);
    const endTotalMin = endHour * 60 + endMin;
    let currentMin = startHour * 60 + startMin;
    while (currentMin + slotDuration <= endTotalMin) {
      const slotEnd = currentMin + slotDuration;
      const sH = String(Math.floor(currentMin / 60)).padStart(2, '0');
      const sM = String(currentMin % 60).padStart(2, '0');
      const eH = String(Math.floor(slotEnd / 60)).padStart(2, '0');
      const eM = String(slotEnd % 60).padStart(2, '0');
      slots.push(`${sH}:${sM}-${eH}:${eM}`);
      currentMin = slotEnd;
    }
  }
  return slots;
}

export function fmt12(t) {
  const [h, m] = t.split(':').map(Number);
  const suffix = h >= 12 ? 'PM' : 'AM';
  const h12 = h > 12 ? h - 12 : h === 0 ? 12 : h;
  return `${h12}:${String(m).padStart(2, '0')} ${suffix}`;
}

export function scheduleLabelFor(day) {
  return (day.sessions || [])
    .map(s => `${fmt12(s.start)} – ${fmt12(s.end)}`)
    .join(', ');
}

// Upcoming clinic dates (next 4 weeks) for every enabled day.
export function getUpcomingClinicDates(config, now = new Date()) {
  const dates = [];
  const today = new Date(now);
  today.setHours(0, 0, 0, 0);
  for (let i = 0; i < 28; i++) {
    const d = new Date(today);
    d.setDate(today.getDate() + i);
    const dow = d.getDay();
    const day = dayConfigFor(config, dow);
    if (!day.enabled || !(day.sessions || []).length) continue;
    // Build the date string from local components so it stays consistent with
    // the weekday computed above (avoids an off-by-one on non-UTC machines).
    const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    if (isHoliday(config, dateStr)) continue;
    // Skip today if the clinic day is already over
    if (i === 0) {
      const last = day.sessions[day.sessions.length - 1];
      const [endH] = last.end.split(':').map(Number);
      if (now.getHours() >= endH) continue;
    }
    dates.push({
      date: dateStr,
      dayName: DAY_NAMES[dow],
      dayOfWeek: dow,
      stations: day.stations,
      doctors: day.doctors,
      schedule: day.sessions,
      scheduleLabel: scheduleLabelFor(day),
    });
  }
  return dates;
}

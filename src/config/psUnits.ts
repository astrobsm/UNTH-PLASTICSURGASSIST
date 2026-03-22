// PS (Plastic Surgery) Unit Configuration
// Defines the two plastic surgery units at UNTH, their consultants, schedules,
// and the 2-week rotation logic for Senior Registrars and House Officers.

export interface PSUnitSchedule {
  clinic: { day: string; startTime?: string; endTime?: string };
  theatre: { day: string; startTime?: string; endTime?: string };
  wardRounds: { day: string; startTime?: string; endTime?: string };
}

export interface PSUnit {
  id: 'PS-UNIT-1' | 'PS-UNIT-2';
  name: string;
  consultants: string[];
  schedule: PSUnitSchedule;
}

export interface UnitRosterConfig {
  id?: number;
  startDate: string; // ISO date when rotation begins
  rotationWeeks: number; // typically 2
  seniorRegistrars: string[];
  houseOfficers: string[];
  isActive: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface CurrentUnitAssignment {
  unit: PSUnit;
  consultants: string[];
  seniorRegistrar: string;
  houseOfficer: string;
  rotationStartDate: string;
  rotationEndDate: string;
}

// ─── Unit Definitions ────────────────────────────────────────────────

export const PS_UNITS: PSUnit[] = [
  {
    id: 'PS-UNIT-1',
    name: 'PS-UNIT 1',
    consultants: ['Dr Okwesili', 'Dr Nnadi'],
    schedule: {
      clinic: { day: 'Tuesday' },
      theatre: { day: 'Wednesday' },
      wardRounds: { day: 'Monday' },
    },
  },
  {
    id: 'PS-UNIT-2',
    name: 'PS-UNIT 2',
    consultants: ['Dr Okwesili', 'Dr Eze C. B'],
    schedule: {
      clinic: { day: 'Wednesday', startTime: '10:00 AM', endTime: '2:00 PM' },
      theatre: { day: 'Thursday' },
      wardRounds: { day: 'Wednesday', startTime: '8:30 AM', endTime: '10:00 AM' },
    },
  },
];

export const PS_UNIT_MAP: Record<string, PSUnit> = {
  'PS-UNIT-1': PS_UNITS[0],
  'PS-UNIT-2': PS_UNITS[1],
};

// ─── Day helpers ─────────────────────────────────────────────────────

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

/**
 * Determine which rotation block (0-based) we're in, given a start date
 * and a rotation period in weeks.
 */
function getRotationBlock(startDate: string, rotationWeeks: number, asOfDate?: Date): number {
  const start = new Date(startDate);
  const now = asOfDate || new Date();
  const diffMs = now.getTime() - start.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  const periodDays = rotationWeeks * 7;
  return Math.floor(diffDays / periodDays);
}

/**
 * Given a roster config and current date, compute the current unit assignments
 * for Senior Registrars and House Officers.
 *
 * Block 0 → PS-UNIT 1, Block 1 → PS-UNIT 2, Block 2 → PS-UNIT 1 …
 */
export function getCurrentAssignments(
  config: UnitRosterConfig,
  asOfDate?: Date
): { unit1: CurrentUnitAssignment; unit2: CurrentUnitAssignment } {
  const now = asOfDate || new Date();
  const block = getRotationBlock(config.startDate, config.rotationWeeks, now);
  const isEvenBlock = block % 2 === 0;

  const periodDays = config.rotationWeeks * 7;
  const start = new Date(config.startDate);
  const currentBlockStart = new Date(start.getTime() + block * periodDays * 86400000);
  const currentBlockEnd = new Date(currentBlockStart.getTime() + periodDays * 86400000 - 86400000);

  const srForUnit1 = isEvenBlock ? config.seniorRegistrars[0] : config.seniorRegistrars[1 % config.seniorRegistrars.length];
  const srForUnit2 = isEvenBlock ? config.seniorRegistrars[1 % config.seniorRegistrars.length] : config.seniorRegistrars[0];
  const hoForUnit1 = isEvenBlock ? config.houseOfficers[0] : config.houseOfficers[1 % config.houseOfficers.length];
  const hoForUnit2 = isEvenBlock ? config.houseOfficers[1 % config.houseOfficers.length] : config.houseOfficers[0];

  const fmt = (d: Date) => d.toISOString().split('T')[0];

  return {
    unit1: {
      unit: PS_UNITS[0],
      consultants: PS_UNITS[0].consultants,
      seniorRegistrar: srForUnit1 || '',
      houseOfficer: hoForUnit1 || '',
      rotationStartDate: fmt(currentBlockStart),
      rotationEndDate: fmt(currentBlockEnd),
    },
    unit2: {
      unit: PS_UNITS[1],
      consultants: PS_UNITS[1].consultants,
      seniorRegistrar: srForUnit2 || '',
      houseOfficer: hoForUnit2 || '',
      rotationStartDate: fmt(currentBlockStart),
      rotationEndDate: fmt(currentBlockEnd),
    },
  };
}

/**
 * Get the full team names for a given unit, based on the current roster config.
 */
export function getUnitTeam(
  unitId: 'PS-UNIT-1' | 'PS-UNIT-2',
  config: UnitRosterConfig | null
): { consultants: string[]; seniorRegistrar: string; houseOfficer: string } {
  const unit = PS_UNIT_MAP[unitId];
  if (!config || !config.isActive) {
    return { consultants: unit.consultants, seniorRegistrar: '', houseOfficer: '' };
  }
  const assignments = getCurrentAssignments(config);
  const a = unitId === 'PS-UNIT-1' ? assignments.unit1 : assignments.unit2;
  return {
    consultants: a.consultants,
    seniorRegistrar: a.seniorRegistrar,
    houseOfficer: a.houseOfficer,
  };
}

/**
 * Get today's schedule items across both units.
 */
export function getTodaySchedule(asOfDate?: Date): Array<{ unit: string; activity: string; time?: string }> {
  const now = asOfDate || new Date();
  const dayName = DAY_NAMES[now.getDay()];
  const items: Array<{ unit: string; activity: string; time?: string }> = [];

  for (const unit of PS_UNITS) {
    const s = unit.schedule;
    if (s.wardRounds.day === dayName) {
      const time = s.wardRounds.startTime && s.wardRounds.endTime
        ? `${s.wardRounds.startTime} – ${s.wardRounds.endTime}`
        : undefined;
      items.push({ unit: unit.name, activity: 'Ward Rounds', time });
    }
    if (s.clinic.day === dayName) {
      const time = s.clinic.startTime && s.clinic.endTime
        ? `${s.clinic.startTime} – ${s.clinic.endTime}`
        : undefined;
      items.push({ unit: unit.name, activity: 'Clinic', time });
    }
    if (s.theatre.day === dayName) {
      const time = s.theatre.startTime && s.theatre.endTime
        ? `${s.theatre.startTime} – ${s.theatre.endTime}`
        : undefined;
      items.push({ unit: unit.name, activity: 'Theatre', time });
    }
  }
  return items;
}

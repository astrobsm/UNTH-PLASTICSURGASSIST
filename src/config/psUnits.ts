// PS (Plastic Surgery) Unit Configuration
// Defines the two plastic surgery units at UNTH, their consultants, schedules,
// and the rotation logic for the rotating staff tiers.
//
// Role hierarchy & rotation rules (per clinical spec):
//   • Consultants            — fixed per unit. consultants[0] = Managing Consultant
//                              (approves treatment plans).
//   • Senior Registrar       — fixed per unit (does NOT rotate). Authors treatment
//                              plans; gets them approved by the managing consultant.
//   • Registrar (Reg) — rotates between units every 6 weeks. Supervises and
//                              approves all House Officer tasks. If only ONE junior
//                              registrar is on staff, he covers BOTH units.
//   • House Officer          — rotates between units every 2 weeks (so a single HO
//                              completes both units in ~4 weeks). Registers and
//                              admits all patients. Patient → HO assignment is even
//                              and persists until discharge OR until that HO finishes
//                              his second rotation (whichever comes first).
//
// All clinical actions (admit, plan, approval, supervision sign-off) must be
// time-, date- and geo-location-stamped — see services/auditService and
// services/locationService for tracking.

export interface PSUnitSchedule {
  clinic: { day: string; startTime?: string; endTime?: string };
  theatre: { day: string; startTime?: string; endTime?: string };
  wardRounds: { day: string; startTime?: string; endTime?: string };
}

export interface PSUnit {
  id: 'PS-UNIT-1' | 'PS-UNIT-2';
  name: string;
  consultants: string[]; // consultants[0] is the managing consultant
  schedule: PSUnitSchedule;
}

export interface UnitRosterConfig {
  id?: number;
  startDate: string;                       // ISO date when rotation began
  // Per-tier rotation periods (weeks). Defaults: HO=2, JR=6.
  rotationWeeks?: number;                   // legacy: HO rotation (kept for compat)
  houseOfficerRotationWeeks?: number;       // typically 2
  juniorRegistrarRotationWeeks?: number;    // typically 6
  // Consultants per unit (index 0 = managing consultant). When empty, the
  // hardcoded PS_UNITS defaults are used. Editable from the roster manager.
  consultantsUnit1?: string[];
  consultantsUnit2?: string[];
  // Fixed-per-unit tier (index 0 → PS-UNIT-1, index 1 → PS-UNIT-2)
  seniorRegistrars: string[];
  // Rotating tiers
  juniorRegistrars?: string[];              // 6-week rotation; 1 entry → both units
  houseOfficers: string[];                  // 2-week rotation; 1 entry → both units
  isActive: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface CurrentUnitAssignment {
  unit: PSUnit;
  consultants: string[];
  managingConsultant: string;
  seniorRegistrar: string;
  juniorRegistrar: string;
  houseOfficer: string;
  // Rotation windows for the *rotating* tiers on this unit:
  juniorRegistrarStart: string;
  juniorRegistrarEnd: string;
  houseOfficerStart: string;
  houseOfficerEnd: string;
  // Backwards compat (HO window — most consumers use this):
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
      clinic: { day: 'Wednesday', startTime: '10:00 AM', endTime: '4:00 PM' },
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

/** Compute the rotation block index (0-based) and the block window. */
function rotationBlock(startDate: string, rotationWeeks: number, asOfDate?: Date): { block: number; start: Date; end: Date } {
  const start = new Date(startDate);
  const now = asOfDate || new Date();
  const periodMs = rotationWeeks * 7 * 86400000;
  const diffMs = now.getTime() - start.getTime();
  const block = Math.floor(diffMs / periodMs);
  const blockStart = new Date(start.getTime() + block * periodMs);
  const blockEnd = new Date(blockStart.getTime() + periodMs - 86400000);
  return { block, start: blockStart, end: blockEnd };
}

/**
 * For a 2-person rotating tier on two units: returns who is on each unit for
 * the given block. If only one person is provided, BOTH units share that
 * person. Empty list → both empty.
 */
function rotatePair(staff: string[], block: number): { unit1: string; unit2: string } {
  if (!staff || staff.length === 0) return { unit1: '', unit2: '' };
  if (staff.length === 1) return { unit1: staff[0], unit2: staff[0] };
  const isEvenBlock = block % 2 === 0;
  return {
    unit1: isEvenBlock ? staff[0] : staff[1],
    unit2: isEvenBlock ? staff[1] : staff[0],
  };
}

const fmtDate = (d: Date) => d.toISOString().split('T')[0];

/**
 * Compute current unit assignments. Senior Registrars are FIXED per unit
 * (index 0 → PS-UNIT-1, index 1 → PS-UNIT-2; if only one SR, he covers both).
 * Registrars rotate every `juniorRegistrarRotationWeeks` (default 6).
 * House Officers rotate every `houseOfficerRotationWeeks` (default 2).
 */
export function getCurrentAssignments(
  config: UnitRosterConfig,
  asOfDate?: Date
): { unit1: CurrentUnitAssignment; unit2: CurrentUnitAssignment } {
  const hoWeeks = config.houseOfficerRotationWeeks ?? config.rotationWeeks ?? 2;
  const jrWeeks = config.juniorRegistrarRotationWeeks ?? 6;

  const hoBlock = rotationBlock(config.startDate, hoWeeks, asOfDate);
  const jrBlock = rotationBlock(config.startDate, jrWeeks, asOfDate);

  const hos = rotatePair(config.houseOfficers || [], hoBlock.block);
  const jrs = rotatePair(config.juniorRegistrars || [], jrBlock.block);

  // SRs are fixed per unit (no rotation). 1 SR → both units share.
  const srs = config.seniorRegistrars || [];
  const srUnit1 = srs[0] || '';
  const srUnit2 = srs.length === 1 ? srs[0] : (srs[1] || '');

  const u1: PSUnit = PS_UNITS[0];
  const u2: PSUnit = PS_UNITS[1];

  // Consultants come from the (editable) config when set, else the defaults.
  const consU1 = (config.consultantsUnit1 && config.consultantsUnit1.filter(Boolean).length)
    ? config.consultantsUnit1.filter(Boolean) : u1.consultants;
  const consU2 = (config.consultantsUnit2 && config.consultantsUnit2.filter(Boolean).length)
    ? config.consultantsUnit2.filter(Boolean) : u2.consultants;

  const buildAssignment = (
    unit: PSUnit,
    consultants: string[],
    sr: string,
    jr: string,
    ho: string
  ): CurrentUnitAssignment => ({
    unit,
    consultants,
    managingConsultant: consultants[0] || '',
    seniorRegistrar: sr,
    juniorRegistrar: jr,
    houseOfficer: ho,
    juniorRegistrarStart: fmtDate(jrBlock.start),
    juniorRegistrarEnd: fmtDate(jrBlock.end),
    houseOfficerStart: fmtDate(hoBlock.start),
    houseOfficerEnd: fmtDate(hoBlock.end),
    // Legacy fields default to HO window (most consumers expect "rotation = 2w window")
    rotationStartDate: fmtDate(hoBlock.start),
    rotationEndDate: fmtDate(hoBlock.end),
  });

  return {
    unit1: buildAssignment(u1, consU1, srUnit1, jrs.unit1, hos.unit1),
    unit2: buildAssignment(u2, consU2, srUnit2, jrs.unit2, hos.unit2),
  };
}

/**
 * Get the full team names for a given unit, based on the current roster config.
 */
export function getUnitTeam(
  unitId: 'PS-UNIT-1' | 'PS-UNIT-2',
  config: UnitRosterConfig | null
): {
  consultants: string[];
  managingConsultant: string;
  seniorRegistrar: string;
  juniorRegistrar: string;
  houseOfficer: string;
} {
  const unit = PS_UNIT_MAP[unitId];
  if (!config || !config.isActive) {
    const cfgCons = unitId === 'PS-UNIT-1' ? config?.consultantsUnit1 : config?.consultantsUnit2;
    const cons = (cfgCons && cfgCons.filter(Boolean).length) ? cfgCons.filter(Boolean) : unit.consultants;
    return {
      consultants: cons,
      managingConsultant: cons[0] || '',
      seniorRegistrar: '',
      juniorRegistrar: '',
      houseOfficer: '',
    };
  }
  const a = unitId === 'PS-UNIT-1' ? getCurrentAssignments(config).unit1 : getCurrentAssignments(config).unit2;
  return {
    consultants: a.consultants,
    managingConsultant: a.managingConsultant,
    seniorRegistrar: a.seniorRegistrar,
    juniorRegistrar: a.juniorRegistrar,
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

/**
 * Pick the next House Officer for a new patient using round-robin across the
 * HOs currently active in the system. The returned name persists with the
 * patient until discharge OR until that HO completes his second rotation.
 *
 * @param activeHouseOfficers Names of HOs currently in any unit (as known to caller).
 * @param existingAssignments Map of HO name → current patient count.
 */
export function pickHouseOfficerRoundRobin(
  activeHouseOfficers: string[],
  existingAssignments: Record<string, number>
): string {
  if (!activeHouseOfficers.length) return '';
  let chosen = activeHouseOfficers[0];
  let lowest = existingAssignments[chosen] ?? 0;
  for (const ho of activeHouseOfficers) {
    const count = existingAssignments[ho] ?? 0;
    if (count < lowest) {
      lowest = count;
      chosen = ho;
    }
  }
  return chosen;
}

/**
 * Returns true if the patient should KEEP their HO assignment, or false if
 * the HO has finished both rotations and the patient must be reassigned.
 */
export function houseOfficerStillCovering(
  hoName: string,
  config: UnitRosterConfig,
  patientAdmittedAt: string | Date,
  asOfDate?: Date
): boolean {
  if (!hoName || !config) return false;
  const now = asOfDate || new Date();
  const admittedAt = typeof patientAdmittedAt === 'string' ? new Date(patientAdmittedAt) : patientAdmittedAt;
  const hoWeeks = config.houseOfficerRotationWeeks ?? config.rotationWeeks ?? 2;
  // Two units * one rotation each = full HO tour
  const totalCoverageMs = 2 * hoWeeks * 7 * 86400000;
  const tourEndsAt = admittedAt.getTime() + totalCoverageMs;
  return now.getTime() <= tourEndsAt;
}

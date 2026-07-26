/**
 * Catalogue of duties a member of the unit can log for a clinic day.
 *
 * Kept as a fixed list on purpose: the value of a day log is being able to add
 * up "how many wound debridements did this house officer do this month", and
 * free-typed duty names make that impossible. `other` is the escape hatch — it
 * takes a free-text label so nothing is unrecordable, while everything countable
 * stays countable.
 */

export interface DutyType {
  key: string;
  label: string;
  group: 'Clinical' | 'Wound care' | 'Procedures' | 'Theatre' | 'Records';
  /** Whether naming a patient usually makes sense for this duty. */
  patientLinked: boolean;
}

export const DUTY_TYPES: DutyType[] = [
  // Clinical
  { key: 'clerking', label: 'Clerking', group: 'Clinical', patientLinked: true },
  { key: 'ward_round', label: 'Ward round', group: 'Clinical', patientLinked: false },
  { key: 'clinic_review', label: 'Clinic review', group: 'Clinical', patientLinked: true },
  { key: 'consult_review', label: 'Consult review / acknowledgement', group: 'Clinical', patientLinked: true },
  { key: 'admission', label: 'Admission', group: 'Clinical', patientLinked: true },
  { key: 'discharge', label: 'Discharge', group: 'Clinical', patientLinked: true },
  { key: 'counselling', label: 'Patient counselling', group: 'Clinical', patientLinked: true },

  // Wound care
  { key: 'wound_inspection', label: 'Wound inspection', group: 'Wound care', patientLinked: true },
  { key: 'wound_debridement', label: 'Wound debridement', group: 'Wound care', patientLinked: true },
  { key: 'dressing_change', label: 'Dressing change', group: 'Wound care', patientLinked: true },
  { key: 'vac_dressing', label: 'VAC / negative-pressure dressing', group: 'Wound care', patientLinked: true },
  { key: 'wound_photography', label: 'Wound photography / measurement', group: 'Wound care', patientLinked: true },

  // Procedures (ward / clinic, usually local anaesthetic)
  { key: 'suturing', label: 'Suturing / wound closure', group: 'Procedures', patientLinked: true },
  { key: 'suture_removal', label: 'Suture removal', group: 'Procedures', patientLinked: true },
  { key: 'incision_drainage', label: 'Incision & drainage', group: 'Procedures', patientLinked: true },
  { key: 'biopsy', label: 'Biopsy', group: 'Procedures', patientLinked: true },
  { key: 'pop_application', label: 'POP / splint application', group: 'Procedures', patientLinked: true },
  { key: 'catheterisation', label: 'Catheterisation', group: 'Procedures', patientLinked: true },
  { key: 'minor_procedure_la', label: 'Other minor procedure (LA)', group: 'Procedures', patientLinked: true },

  // Theatre
  { key: 'theatre_surgeon', label: 'Theatre — operating surgeon', group: 'Theatre', patientLinked: true },
  { key: 'theatre_assist', label: 'Theatre — assisting', group: 'Theatre', patientLinked: true },
  { key: 'theatre_scrub_prep', label: 'Theatre — preparation / scrub', group: 'Theatre', patientLinked: false },

  // Records
  { key: 'progress_note', label: 'Progress note / status update', group: 'Records', patientLinked: true },
  { key: 'discharge_summary', label: 'Discharge summary', group: 'Records', patientLinked: true },
  { key: 'investigation_upload', label: 'Investigation result upload', group: 'Records', patientLinked: true },
  { key: 'presentation', label: 'Presentation / teaching', group: 'Records', patientLinked: false },
  { key: 'other', label: 'Other (specify)', group: 'Records', patientLinked: false },
];

export const DUTY_GROUPS: DutyType['group'][] = ['Clinical', 'Wound care', 'Procedures', 'Theatre', 'Records'];

export function dutyLabel(key: string): string {
  return DUTY_TYPES.find(d => d.key === key)?.label
    || (key || '').replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

export function isPatientLinked(key: string): boolean {
  return DUTY_TYPES.find(d => d.key === key)?.patientLinked ?? false;
}

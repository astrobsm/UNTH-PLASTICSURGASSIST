// ============================================================================
// AI unit summary — the pure parts (testable without a database or Claude).
//
// The model sees each patient only as a reference (P1, P2 …) with ward, bed,
// age, sex, days on admission and the admission's clinical text, with names and
// hospital numbers removed. The server maps the references back to the
// patients before the answer reaches the browser.
// ============================================================================
import { deidentifyText } from './deidentify.js';

export const UNIT_SUMMARY_PROMPT_VERSION = 'unit-summary-1.0.0';
export const MAX_PATIENTS = 150;

export const UNIT_SUMMARY_SYSTEM_PROMPT = `You are a senior plastic surgery registrar at the University of Nigeria Teaching Hospital (UNTH), Enugu, preparing a handover summary of the admitted patients of one surgical unit for the consultant.

You receive a JSON list of de-identified patients. Each has a reference ("ref"), ward, bed, age, sex, days on admission and the admission's clinical text. Some fields may be missing.

Write a concise, clinically useful summary:
- overview: 2-4 sentences on the unit's load and case mix.
- by_ward: one entry per ward, in the order given, with the count and a one-to-two sentence summary of that ward's patients.
- priorities: up to 10 patients who most need senior attention today (sepsis risk, flap or graft at risk, burns, airway, uncontrolled comorbidity, unclear plan), each with the concern and a concrete next action.
- long_stay: patients whose stay looks long for their recorded problem, with a short note on what may be holding them.
- discharge_candidates: patients whose record suggests they may be ready for discharge review.
- data_gaps: missing or unclear documentation that limits this summary (e.g. no diagnosis recorded).

Rules: use only the information given; never invent investigations, results or plans; refer to patients only by "ref"; if the data cannot support a judgement, say so in data_gaps. Use British spelling.

Return JSON with exactly these keys:
{"overview": string, "by_ward": [{"ward": string, "count": number, "summary": string}], "priorities": [{"ref": string, "concern": string, "action": string}], "long_stay": [{"ref": string, "note": string}], "discharge_candidates": [{"ref": string, "reason": string}], "data_gaps": [string]}`;

const CLIN_FIELDS = [
  ['diagnosis', ['provisional_diagnosis', 'admitting_diagnosis', 'diagnosis']],
  ['reason', ['reasons_for_admission', 'reason_for_admission']],
  ['complaint', ['presenting_complaint']],
  ['comorbidities', ['comorbidities']],
  ['notes', ['notes', 'admission_notes', 'clinical_notes']],
];

const pick = (row, keys) => {
  for (const k of keys) {
    const v = row?.[k];
    if (v !== undefined && v !== null && String(v).trim()) return typeof v === 'string' ? v : JSON.stringify(v);
  }
  return null;
};

export function ageFrom(dob, now = new Date()) {
  const d = dob ? new Date(dob) : null;
  if (!d || Number.isNaN(d.getTime())) return null;
  let a = now.getFullYear() - d.getFullYear();
  const m = now.getMonth() - d.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < d.getDate())) a--;
  return a >= 0 && a < 130 ? a : null;
}

export function daysSince(date, now = new Date()) {
  const t = date ? new Date(date).getTime() : NaN;
  if (!Number.isFinite(t)) return null;
  return Math.max(0, Math.floor((now.getTime() - t) / 86400000));
}

/**
 * Build the de-identified list the model sees, plus the ref → patient map.
 * `patients` are the rows the browser listed ({id, ward, bed, name,
 * hospital_number, care_start_date?}) in display order; `admissions` are the
 * database rows (joined with patients) keyed by patient id.
 */
export function buildUnitRows(patients, admissionsById, now = new Date()) {
  const refs = {};
  const rows = patients.slice(0, MAX_PATIENTS).map((p, i) => {
    const ref = `P${i + 1}`;
    const a = admissionsById.get(String(p.id)) || {};
    refs[ref] = { id: String(p.id), name: p.name || null, hospital_number: p.hospital_number || null, ward: p.ward || a.ward_location || a.ward || null, bed: p.bed || a.bed_number || null };
    const ids = [a.first_name, a.last_name, a.other_names, a.hospital_number, a.phone, p.name, p.hospital_number,
      ...String(p.name || '').split(/\s+/)]
      .map(v => String(v || '').trim()).filter(v => v.length >= 3);
    const row = {
      ref,
      ward: refs[ref].ward || null,
      bed: refs[ref].bed || null,
      age: ageFrom(a.date_of_birth, now),
      sex: a.gender || null,
      days_on_admission: daysSince(p.care_start_date || a.admission_date, now),
    };
    for (const [key, cols] of CLIN_FIELDS) {
      const v = pick(a, cols);
      if (v) row[key] = deidentifyText(v.slice(0, 600), ids);
    }
    return row;
  });
  return { rows, refs };
}

const str = (v, n = 600) => (v === undefined || v === null ? '' : String(v)).trim().slice(0, n);
const arr = (v) => (Array.isArray(v) ? v : []);

/** Shape the model's answer and attach patient details to each ref. */
export function normaliseUnitSummary(raw, refs) {
  const who = (ref) => {
    const r = refs[String(ref || '').trim().toUpperCase()];
    return r ? { ref: String(ref).toUpperCase(), patient_id: r.id, name: r.name, hospital_number: r.hospital_number, ward: r.ward, bed: r.bed } : null;
  };
  const withPatient = (list, fields) => arr(list).map(x => {
    const p = who(x?.ref);
    if (!p) return null;
    const out = { ...p };
    for (const f of fields) out[f] = str(x?.[f]);
    return out;
  }).filter(Boolean);
  return {
    overview: str(raw?.overview, 1500),
    by_ward: arr(raw?.by_ward).map(w => ({ ward: str(w?.ward, 100) || 'Ward not recorded', count: Number(w?.count) || 0, summary: str(w?.summary) })),
    priorities: withPatient(raw?.priorities, ['concern', 'action']).slice(0, 10),
    long_stay: withPatient(raw?.long_stay, ['note']),
    discharge_candidates: withPatient(raw?.discharge_candidates, ['reason']),
    data_gaps: arr(raw?.data_gaps).map(g => str(g, 300)).filter(Boolean).slice(0, 15),
  };
}

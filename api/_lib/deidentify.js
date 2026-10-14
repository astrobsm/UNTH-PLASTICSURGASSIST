// ============================================================================
// Remove patient identifiers from text before it is sent to an external AI
// service (decision D5: OpenAI permitted with identifiers removed).
//
// The model does not need to know who the patient is to summarise a note or
// read a chart. What is removed:
//   - the patient's own name and hospital number, looked up from patients.id
//     when the caller says which patient the text is about;
//   - anything shaped like a hospital number (UNTH/…, PS12345678, AUTO-…,
//     CONSULT-…), a phone number, or an email address.
// Clinical content, ages, dates of events and measurements are left intact.
// This is a safety net, not a guarantee: callers should still not put names in
// prompts in the first place.
// ============================================================================

import { query } from './db.js';

const PATTERNS = [
  [/\bUNTH\/\d{2,4}\/[A-Z0-9]+\b/gi, '[HOSPITAL-NO]'],
  [/\b(?:PS|AUTO-[A-Z]{3,6}-|CONSULT-)[A-Z0-9-]{4,}\b/g, '[HOSPITAL-NO]'],
  [/\b[\w.+-]+@[\w-]+\.[\w.-]+\b/g, '[EMAIL]'],
  [/(?:\+?234[\s-]?|\b0)[789][01]\d[\s-]?\d{3}[\s-]?\d{4}\b/g, '[PHONE]'],
];

const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Names / numbers that identify one patient, from the database. */
export async function identifiersForPatient(patientId) {
  if (patientId === undefined || patientId === null || patientId === '') return [];
  try {
    const r = await query(
      `SELECT first_name, last_name, other_names, hospital_number, phone FROM patients WHERE id::text = $1`,
      [String(patientId)]
    );
    const p = r.rows[0];
    if (!p) return [];
    return [p.first_name, p.last_name, p.other_names, p.hospital_number, p.phone]
      .map(v => String(v || '').trim())
      .filter(v => v.length >= 2);
  } catch {
    return [];
  }
}

/** Replace identifiers in a string. */
export function deidentifyText(text, extraIdentifiers = []) {
  if (typeof text !== 'string' || !text) return text;
  let out = text;
  for (const id of extraIdentifiers) {
    // Whole-word for names; hospital numbers contain slashes so match literally.
    const re = /^[A-Za-z' -]+$/.test(id)
      ? new RegExp(`\\b${escapeRe(id)}\\b`, 'gi')
      : new RegExp(escapeRe(id), 'gi');
    out = out.replace(re, id.includes('/') || /\d/.test(id) ? '[HOSPITAL-NO]' : '[PATIENT]');
  }
  for (const [re, token] of PATTERNS) out = out.replace(re, token);
  return out;
}

/** De-identify every string content in an OpenAI-style messages array. */
export function deidentifyMessages(messages, extraIdentifiers = []) {
  return (messages || []).map(m => {
    if (typeof m.content === 'string') return { ...m, content: deidentifyText(m.content, extraIdentifiers) };
    if (Array.isArray(m.content)) {
      return {
        ...m,
        content: m.content.map(part => (part && part.type === 'text'
          ? { ...part, text: deidentifyText(part.text, extraIdentifiers) }
          : part)),
      };
    }
    return m;
  });
}

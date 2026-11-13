// ============================================================================
// Consult chase: call the attention of the on-call senior registrar, registrar
// and house officer(s) to a received consult that is still waiting on them.
//
// The team is the one written onto the consult when it arrived (oncall_team);
// phone numbers come from the users table first, then the team snapshot.
// Sending is manual — the app opens WhatsApp with the message — and each chase
// is logged (consult_feedback_log, channel 'chase') and pushed in-app to the
// person chased.
// ============================================================================

export const CHASE_CHANNEL = 'chase';
export const CHASE_ROLES = ['admin', 'super_admin', 'consultant', 'senior_registrar', 'registrar'];
export const OPEN_STATUSES = ['received', 'acknowledged', 'reviewed', 'plan_approved', 'plan_implemented'];

export const MEMBERS = [
  { key: 'senior_registrar', label: 'Senior Registrar', idCol: 'oncall_senior_registrar_id' },
  { key: 'registrar', label: 'Registrar', idCol: 'oncall_registrar_id' },
  { key: 'house_officer', label: 'House Officer', idCol: 'oncall_house_officer_id' },
  { key: 'ho_ward', label: 'Ward House Officer', idCol: 'oncall_ho_ward_id' },
];

/** What the team still owes the consult at each stage. */
export const NEXT_STEP = {
  received: 'It has not been acknowledged. Please acknowledge it and see the patient.',
  acknowledged: 'It is acknowledged but not yet reviewed. Please review the patient and document the review and proposed plan.',
  reviewed: 'The review is documented but the plan is not yet approved. Please present the plan for approval.',
  plan_approved: 'The plan is approved but not yet implemented. Please carry it out and update the consult.',
  plan_implemented: 'The plan is implemented. Please follow up and close the consult when care is complete.',
};

const STAMP = { received: 'created_at', acknowledged: 'acknowledged_at', reviewed: 'reviewed_at', plan_approved: 'plan_approved_at', plan_implemented: 'plan_implemented_at' };

export function parseTeam(t) {
  if (!t) return null;
  if (typeof t === 'string') { try { return JSON.parse(t); } catch { return null; } }
  return t;
}

export function elapsed(fromIso, now = new Date()) {
  const ms = now.getTime() - new Date(fromIso).getTime();
  if (!Number.isFinite(ms) || ms < 0) return null;
  const mins = Math.floor(ms / 60000);
  if (mins < 60) return `${mins} min`;
  const h = Math.floor(mins / 60);
  if (h < 48) return `${h} h${mins % 60 ? ` ${mins % 60} min` : ''}`;
  return `${Math.floor(h / 24)} days`;
}

/** Initials only — the message goes over WhatsApp. */
export function patientLabel(c) {
  const initials = String(c.patient_name || '').trim().split(/\s+/).filter(Boolean).map(w => `${w[0].toUpperCase()}.`).join(' ');
  const parts = [initials || 'Patient'];
  if (c.hospital_number) parts.push(`Hosp. no. ${String(c.hospital_number).trim()}`);
  const where = [c.ward, c.bed_number && `bed ${c.bed_number}`].filter(Boolean).join(', ');
  if (where) parts.push(where);
  return parts.join(' · ');
}

/** The on-call team members who can be chased, de-duplicated by person. */
export function chaseRecipients(consult, users = []) {
  const team = parseTeam(consult.oncall_team) || {};
  const byId = new Map(users.map(u => [String(u.id), u]));
  const seen = new Set();
  const out = [];
  for (const m of MEMBERS) {
    const id = consult[m.idCol] || team[m.key]?.id || null;
    const snap = team[m.key] || {};
    const name = byId.get(String(id))?.full_name || snap.name || null;
    if (!id && !name) continue;
    const dedupe = id ? `id:${id}` : `name:${name}`;
    if (seen.has(dedupe)) continue;
    seen.add(dedupe);
    out.push({ role: m.key, label: m.label, id: id ? String(id) : null, name, phone: byId.get(String(id))?.phone || snap.phone || null });
  }
  return out;
}

export function composeConsultChase(consult, recipient, { senderName = '', appUrl = '', now = new Date() } = {}) {
  const status = consult.status in NEXT_STEP ? consult.status : 'received';
  const urgency = String(consult.urgency || 'routine').toUpperCase();
  const since = elapsed(consult[STAMP[status]] || consult.created_at, now);
  const received = elapsed(consult.created_at, now);
  const lines = [
    `Dear Dr ${String(recipient.name || '').trim().replace(/^dr\.?\s+/i, '') || recipient.label},`,
    `Consult chase — ${urgency} consult ${consult.consult_ref || ''} from ${consult.referring_unit || 'another unit'}${received ? `, received ${received} ago` : ''}.`,
    '',
    `Patient: ${patientLabel(consult)}`,
    consult.indication ? `Reason: ${String(consult.indication).trim().slice(0, 160)}` : null,
    '',
    `${NEXT_STEP[status]}${since && status !== 'received' ? ` (at this stage for ${since}.)` : ''}`,
    'Kindly respond and update the consult in the app' + (appUrl ? `: ${appUrl}/consults` : '.'),
    senderName ? `\n— ${senderName}` : null,
  ];
  return lines.filter(l => l !== null).join('\n');
}

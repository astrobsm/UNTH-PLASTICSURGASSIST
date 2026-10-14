// Clinical governance API — the unit's decisions D1–D7 and the postoperative
// monitoring profiles that implement D3.
//
//   GET  ?action=settings            -> decisions in force + allowed options + who can edit
//   GET  ?action=history             -> previous decisions, newest first
//   PUT  ?action=settings  {…, note} -> save decisions (admin / consultant)
//
//   GET  ?action=profiles            -> each monitoring profile (latest version + approved version)
//   GET  ?action=profile&id=         -> all versions of one profile
//   POST ?action=profile&id=         -> save an edit as a new draft version
//   POST ?action=approve&id=&version= -> approve (decision D1 approvers)
//   POST ?action=retire&id=&version=  -> withdraw approval (decision D1 approvers)
import { cors, authenticateRequest } from './_lib/auth.js';
import {
  getGovernance, saveGovernance, governanceHistory, GOVERNANCE_OPTIONS, GOVERNANCE_EDIT_ROLES,
  canApproveClinicalContent,
} from './_lib/governance.js';
import {
  listProfiles, getProfileVersions, saveProfileVersion, approveProfileVersion, retireProfileVersion,
} from './_lib/clinicalRulesets.js';
import { auditClinical } from './_lib/clinicalRecords.js';

// Who may draft or edit monitoring profiles (approval is separate: D1).
const PROFILE_EDIT_ROLES = ['admin', 'super_admin', 'consultant', 'senior_registrar'];

export default async function handler(req, res) {
  if (cors(req, res)) return;
  const auth = authenticateRequest(req);
  if (!auth.authenticated) return res.status(401).json({ error: auth.error });
  const user = auth.user;
  const url = new URL(req.url, `http://${req.headers.host}`);
  const action = url.searchParams.get('action') || 'settings';
  let body = req.body;
  if (typeof body === 'string') { try { body = JSON.parse(body); } catch { body = {}; } }
  body = body || {};

  try {
    if (req.method === 'GET' && action === 'settings') {
      return res.status(200).json({
        settings: await getGovernance({ fresh: true }),
        options: GOVERNANCE_OPTIONS,
        can_edit: GOVERNANCE_EDIT_ROLES.includes(user.role),
        can_approve_content: await canApproveClinicalContent(user),
        can_edit_profiles: PROFILE_EDIT_ROLES.includes(user.role),
      });
    }
    if (req.method === 'GET' && action === 'history') {
      return res.status(200).json({ history: await governanceHistory() });
    }
    if ((req.method === 'PUT' || req.method === 'POST') && action === 'settings') {
      if (!GOVERNANCE_EDIT_ROLES.includes(user.role)) {
        return res.status(403).json({ error: 'Only consultants and administrators can change governance decisions' });
      }
      const r = await saveGovernance(body, user, body.note);
      if (r.error) return res.status(400).json({ error: r.error });
      await auditClinical(user, { action: 'governance_change', entity: 'clinical_governance_settings', detail: { keys: Object.keys(body).filter(k => k !== 'note') } });
      return res.status(200).json({ settings: r.settings });
    }

    if (req.method === 'GET' && action === 'profiles') {
      return res.status(200).json({ profiles: await listProfiles() });
    }
    const id = url.searchParams.get('id');
    if (req.method === 'GET' && action === 'profile') {
      if (!id) return res.status(400).json({ error: 'id is required' });
      return res.status(200).json({ versions: await getProfileVersions(id) });
    }
    if (req.method === 'POST' && action === 'profile') {
      if (!PROFILE_EDIT_ROLES.includes(user.role)) {
        return res.status(403).json({ error: 'Only consultants, senior registrars and administrators can edit monitoring profiles' });
      }
      if (!id) return res.status(400).json({ error: 'id is required' });
      const r = await saveProfileVersion(id, body, user);
      if (r.conflict) return res.status(409).json({ error: r.error });
      if (r.error) return res.status(400).json({ error: r.error });
      await auditClinical(user, { action: 'ruleset_edit', entity: 'clinical_rulesets', entityId: `${id}@${r.profile.version}` });
      return res.status(201).json(r);
    }
    if (req.method === 'POST' && (action === 'approve' || action === 'retire')) {
      if (!(await canApproveClinicalContent(user))) {
        return res.status(403).json({ error: 'Only the clinical content approvers named in decision D1 can approve or withdraw protocols' });
      }
      const version = Number(url.searchParams.get('version'));
      if (!id || !version) return res.status(400).json({ error: 'id and version are required' });
      const r = action === 'approve' ? await approveProfileVersion(id, version, user) : await retireProfileVersion(id, version);
      if (r.error) return res.status(404).json({ error: r.error });
      await auditClinical(user, { action: action === 'approve' ? 'ruleset_approve' : 'ruleset_retire', entity: 'clinical_rulesets', entityId: `${id}@${version}` });
      return res.status(200).json(r);
    }

    return res.status(400).json({ error: 'Unknown action' });
  } catch (e) {
    console.error('clinical-governance error:', e);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

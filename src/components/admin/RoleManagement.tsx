import React, { useCallback, useEffect, useState } from 'react';
import { Shield, Plus, Save, X, Loader2, AlertTriangle, Trash2, Edit3, Users, Lock } from 'lucide-react';
import toast from 'react-hot-toast';
import { rolesService, StaffRole, Grade, GRADES, GRADE_LABELS } from '../../services/rolesService';

/**
 * Staff role registry admin.
 *
 * Two distinct ideas on this screen:
 *  - the ROLE is what a person is called, and the list is extensible;
 *  - the GRADE (`rosters_as`) is which slot they fill on the call roster and the
 *    care team, and there are exactly four of those because they map to database
 *    columns. Mapping a new role to a grade is what makes rostering pick it up.
 *
 * Built-in roles can be relabelled and re-graded but not deleted or renamed —
 * existing user rows, session tokens and role checks depend on their keys.
 */
const RoleManagement: React.FC = () => {
  const [roles, setRoles] = useState<StaffRole[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [showForm, setShowForm] = useState(false);
  const [editKey, setEditKey] = useState<string | null>(null);
  const [fKey, setFKey] = useState('');
  const [fLabel, setFLabel] = useState('');
  const [fGrade, setFGrade] = useState<Grade | ''>('');
  const [fDescription, setFDescription] = useState('');

  const load = useCallback(async (force = false) => {
    setLoading(true);
    setError(null);
    try {
      setRoles(await rolesService.list(force));
    } catch (e: any) {
      setError(e?.message || 'Could not load roles');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(true); }, [load]);

  const openCreate = () => {
    setEditKey(null);
    setFKey(''); setFLabel(''); setFGrade(''); setFDescription('');
    setShowForm(true);
  };

  const openEdit = (r: StaffRole) => {
    setEditKey(r.role_key);
    setFKey(r.role_key);
    setFLabel(r.label);
    setFGrade(r.rosters_as || '');
    setFDescription(r.description || '');
    setShowForm(true);
  };

  // Suggest a key from the label while creating, so an admin never has to think
  // about key syntax — but never touch the key of an existing role.
  const onLabelChange = (v: string) => {
    setFLabel(v);
    if (!editKey) setFKey(v.trim().toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, ''));
  };

  const submit = async () => {
    if (!fLabel.trim()) { toast.error('Give the role a name'); return; }
    setSaving(true);
    try {
      const next = editKey
        ? await rolesService.update({
            key: editKey,
            label: fLabel.trim(),
            rosters_as: (fGrade || null) as Grade | null,
            description: fDescription,
          })
        : await rolesService.create({
            key: fKey,
            label: fLabel.trim(),
            rosters_as: (fGrade || null) as Grade | null,
            description: fDescription,
          });
      setRoles(next);
      setShowForm(false);
      toast.success(editKey ? `"${fLabel}" updated` : `"${fLabel}" added`);
    } catch (e: any) {
      toast.error(e?.message?.replace(/^\[HTTP \d+\]\s*/, '') || 'Could not save the role');
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = async (r: StaffRole) => {
    if (r.is_active && !window.confirm(
      `Retire "${r.label}"?\n\nIt will no longer be offered when adding or editing staff. Anyone already holding it keeps it.`
    )) return;
    try {
      setRoles(await rolesService.update({ key: r.role_key, is_active: !r.is_active }));
      toast.success(r.is_active ? `"${r.label}" retired` : `"${r.label}" reinstated`);
    } catch (e: any) {
      toast.error(e?.message?.replace(/^\[HTTP \d+\]\s*/, '') || 'Could not change the role');
    }
  };

  const remove = async (r: StaffRole) => {
    let reassignTo: string | undefined;
    if (r.user_count > 0) {
      const options = roles.filter(x => x.is_active && x.role_key !== r.role_key);
      const answer = window.prompt(
        `${r.user_count} staff member(s) hold "${r.label}".\n\nType the role to move them to:\n\n` +
        options.map(o => `  ${o.role_key}  (${o.label})`).join('\n')
      );
      if (!answer) return;
      reassignTo = answer.trim();
      if (!options.some(o => o.role_key === reassignTo)) { toast.error(`"${reassignTo}" is not one of the roles listed`); return; }
    } else if (!window.confirm(`Delete the role "${r.label}"?`)) {
      return;
    }
    try {
      setRoles(await rolesService.remove(r.role_key, reassignTo));
      toast.success(`"${r.label}" deleted${reassignTo ? ` — staff moved to ${reassignTo}` : ''}`);
    } catch (e: any) {
      toast.error(e?.message?.replace(/^\[HTTP \d+\]\s*/, '') || 'Could not delete the role');
    }
  };

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-xl shadow-sm border p-4 sm:p-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-2">
          <div>
            <h3 className="text-base sm:text-lg font-semibold text-gray-900 flex items-center gap-2">
              <Shield className="h-5 w-5 text-green-600" /> Staff Roles
            </h3>
            <p className="text-xs text-gray-500 mt-1">
              Add the roles your unit actually employs. <strong>Rosters as</strong> decides which
              call-duty slot and care-team position a role fills — set it, and call duty and patient
              assignment pick the role up automatically.
            </p>
          </div>
          <button
            onClick={openCreate}
            className="px-3 py-2 text-sm font-medium rounded-lg bg-green-600 text-white hover:bg-green-700 inline-flex items-center gap-1 self-start"
          >
            <Plus className="h-4 w-4" /> Add Role
          </button>
        </div>

        {error && (
          <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 my-2">
            <AlertTriangle className="h-4 w-4 text-amber-600 flex-shrink-0 mt-0.5" />
            <div className="text-xs text-amber-800">
              {error}
              <button onClick={() => load(true)} className="ml-2 underline font-medium">Retry</button>
            </div>
          </div>
        )}

        {loading ? (
          <div className="py-10 text-center"><Loader2 className="h-6 w-6 animate-spin mx-auto text-green-600" /></div>
        ) : (
          <>
            {/* Mobile cards */}
            <div className="sm:hidden space-y-2 mt-3">
              {roles.map(r => (
                <div key={r.role_key} className={`border rounded-lg p-3 ${r.is_active ? 'border-gray-200' : 'border-gray-200 bg-gray-50 opacity-70'}`}>
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-medium text-gray-900 flex items-center gap-1 flex-wrap">
                        {r.label}
                        {r.is_builtin && <span className="inline-flex items-center gap-0.5 text-[10px] text-gray-500 bg-gray-100 border rounded px-1"><Lock className="h-2.5 w-2.5" /> built-in</span>}
                        {!r.is_active && <span className="text-[10px] text-gray-500 bg-gray-100 border rounded px-1">retired</span>}
                      </p>
                      <p className="text-[11px] text-gray-500 font-mono">{r.role_key}</p>
                    </div>
                    <span className="text-xs text-gray-600 flex items-center gap-1 flex-shrink-0">
                      <Users className="h-3 w-3" />{r.active_user_count}/{r.user_count}
                    </span>
                  </div>
                  <p className="text-xs text-gray-600 mt-1">
                    Rosters as: <strong>{r.rosters_as ? GRADE_LABELS[r.rosters_as] : 'not rostered'}</strong>
                  </p>
                  <div className="flex gap-2 mt-2">
                    <button onClick={() => openEdit(r)} className="flex-1 px-2 py-1.5 text-xs rounded border bg-white hover:bg-gray-50 inline-flex items-center justify-center gap-1">
                      <Edit3 className="h-3 w-3" /> Edit
                    </button>
                    <button onClick={() => toggleActive(r)} className="flex-1 px-2 py-1.5 text-xs rounded border bg-white hover:bg-gray-50">
                      {r.is_active ? 'Retire' : 'Reinstate'}
                    </button>
                    {!r.is_builtin && (
                      <button onClick={() => remove(r)} className="px-2 py-1.5 text-xs rounded border border-red-200 text-red-600 bg-white hover:bg-red-50">
                        <Trash2 className="h-3 w-3" />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {/* Desktop table */}
            <div className="hidden sm:block overflow-x-auto mt-3">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 text-left text-xs uppercase tracking-wider text-gray-500">
                    <th className="px-3 py-2 font-medium">Role</th>
                    <th className="px-3 py-2 font-medium">Key</th>
                    <th className="px-3 py-2 font-medium">Rosters as</th>
                    <th className="px-3 py-2 font-medium">Staff (active/total)</th>
                    <th className="px-3 py-2 font-medium">Status</th>
                    <th className="px-3 py-2"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {roles.map(r => (
                    <tr key={r.role_key} className={r.is_active ? '' : 'bg-gray-50 text-gray-500'}>
                      <td className="px-3 py-2 font-medium text-gray-900">
                        <span className="flex items-center gap-1 flex-wrap">
                          {r.label}
                          {r.is_builtin && (
                            <span className="inline-flex items-center gap-0.5 text-[10px] text-gray-500 bg-gray-100 border rounded px-1" title="Built-in role: it can be relabelled or re-graded, but not renamed or deleted">
                              <Lock className="h-2.5 w-2.5" /> built-in
                            </span>
                          )}
                        </span>
                        {r.description && <span className="block text-xs text-gray-500">{r.description}</span>}
                      </td>
                      <td className="px-3 py-2 font-mono text-xs text-gray-500">{r.role_key}</td>
                      <td className="px-3 py-2">
                        {r.rosters_as ? (
                          <span className="inline-block px-2 py-0.5 rounded-full text-xs font-medium bg-green-50 text-green-700 border border-green-200">
                            {GRADE_LABELS[r.rosters_as]}
                          </span>
                        ) : (
                          <span className="text-xs text-gray-400">not rostered</span>
                        )}
                      </td>
                      <td className="px-3 py-2 text-gray-600">{r.active_user_count} / {r.user_count}</td>
                      <td className="px-3 py-2">
                        <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${r.is_active ? 'bg-green-100 text-green-800' : 'bg-gray-200 text-gray-600'}`}>
                          {r.is_active ? 'active' : 'retired'}
                        </span>
                      </td>
                      <td className="px-3 py-2">
                        <div className="flex items-center gap-2 justify-end">
                          <button onClick={() => openEdit(r)} className="text-blue-600 hover:text-blue-800" title="Edit role">
                            <Edit3 className="h-4 w-4" />
                          </button>
                          <button onClick={() => toggleActive(r)} className="px-2 py-1 text-xs rounded border hover:bg-gray-50">
                            {r.is_active ? 'Retire' : 'Reinstate'}
                          </button>
                          {!r.is_builtin && (
                            <button onClick={() => remove(r)} className="text-red-600 hover:text-red-800" title="Delete role">
                              <Trash2 className="h-4 w-4" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>

      {showForm && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center p-0 sm:p-4 z-[200]">
          <div className="bg-white rounded-none sm:rounded-lg shadow-xl w-full sm:max-w-md max-h-full overflow-y-auto">
            <div className="px-4 sm:px-6 py-3 sm:py-4 border-b flex items-center justify-between">
              <h3 className="text-lg font-bold text-gray-900">{editKey ? 'Edit Role' : 'Add Role'}</h3>
              <button onClick={() => setShowForm(false)} className="text-gray-400 hover:text-gray-600"><X className="h-5 w-5" /></button>
            </div>
            <div className="p-4 sm:p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Role name *</label>
                <input
                  value={fLabel}
                  onChange={(e) => onLabelChange(e.target.value)}
                  placeholder="e.g. Medical Officer"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-green-500"
                  autoFocus
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Key</label>
                <input
                  value={fKey}
                  onChange={(e) => setFKey(e.target.value)}
                  disabled={!!editKey}
                  placeholder="medical_officer"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 font-mono text-sm disabled:bg-gray-100 disabled:text-gray-500"
                />
                <p className="text-[11px] text-gray-500 mt-1">
                  {editKey
                    ? 'The key is fixed once a role exists — staff records and sign-in checks refer to it.'
                    : 'Stored on each staff record. Lower-case letters, numbers and underscores.'}
                </p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Rosters as</label>
                <select
                  value={fGrade}
                  onChange={(e) => setFGrade(e.target.value as Grade | '')}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 bg-white focus:ring-2 focus:ring-green-500"
                >
                  <option value="">Not rostered (admin, records, etc.)</option>
                  {GRADES.map(g => <option key={g} value={g}>{GRADE_LABELS[g]}</option>)}
                </select>
                <p className="text-[11px] text-gray-500 mt-1">
                  Which call-duty slot and care-team position this role fills. Staff in this role join
                  that grade's rota and patient-assignment pool.
                </p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
                <input
                  value={fDescription}
                  onChange={(e) => setFDescription(e.target.value)}
                  placeholder="Optional"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-green-500"
                />
              </div>
              <div className="flex gap-3 pt-1">
                <button
                  onClick={submit}
                  disabled={saving || !fLabel.trim() || (!editKey && !fKey.trim())}
                  className="flex-1 px-4 py-2 rounded-lg font-medium text-white bg-green-600 hover:bg-green-700 disabled:opacity-50 inline-flex items-center justify-center gap-1"
                >
                  {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                  {editKey ? 'Save changes' : 'Add role'}
                </button>
                <button onClick={() => setShowForm(false)} className="flex-1 px-4 py-2 border border-gray-300 rounded-lg font-medium text-gray-700 hover:bg-gray-50">
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default RoleManagement;

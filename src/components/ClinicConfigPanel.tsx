// Clinic Configuration Panel (admin) — Phase 1 appointment redesign.
// Lets admins configure consulting stations per weekday, slot length, sessions,
// public holidays, patient categories, and doctor unavailability.
import { useState, useEffect, useCallback } from 'react';
import {
  Save, Plus, Trash2, RefreshCw, Calendar, Clock, Users, Tag, CalendarOff, ChevronDown, ChevronUp,
} from 'lucide-react';
import toast from 'react-hot-toast';
import {
  clinicConfigService, ClinicConfig, ClinicCategory, ClinicDayConfig, DoctorUnavailability, DAY_NAMES,
} from '../services/clinicConfigService';

const EMPTY_DAY: ClinicDayConfig = { enabled: false, stations: 0, doctors: [], sessions: [] };

export default function ClinicConfigPanel() {
  const [config, setConfig] = useState<ClinicConfig | null>(null);
  const [categories, setCategories] = useState<ClinicCategory[]>([]);
  const [unavailability, setUnavailability] = useState<DoctorUnavailability[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [expanded, setExpanded] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [cfg, cats, unavail] = await Promise.all([
        clinicConfigService.getConfig(),
        clinicConfigService.getCategories(),
        clinicConfigService.getUnavailability(new Date().toISOString().split('T')[0]),
      ]);
      setConfig(cfg);
      setCategories(cats);
      setUnavailability(unavail);
    } catch (e: any) {
      toast.error(`Failed to load clinic config: ${e.message}`);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { if (expanded && !config) load(); }, [expanded, config, load]);

  const updateDay = (dow: string, patch: Partial<ClinicDayConfig>) => {
    if (!config) return;
    setConfig({ ...config, days: { ...config.days, [dow]: { ...(config.days[dow] || EMPTY_DAY), ...patch } } });
  };

  const handleSave = async () => {
    if (!config) return;
    setSaving(true);
    try {
      const saved = await clinicConfigService.saveConfig(config);
      setConfig(saved);
      toast.success('Clinic configuration saved');
    } catch (e: any) {
      toast.error(`Save failed: ${e.message}`);
    } finally {
      setSaving(false);
    }
  };

  // ── Categories ──
  const saveCategory = async (cat: ClinicCategory) => {
    try {
      await clinicConfigService.saveCategory(cat);
      toast.success('Category saved');
      setCategories(await clinicConfigService.getCategories());
    } catch (e: any) { toast.error(`Category save failed: ${e.message}`); }
  };
  const deleteCategory = async (id?: number) => {
    if (!id || !confirm('Remove this category?')) return;
    try {
      await clinicConfigService.deleteCategory(id);
      setCategories(await clinicConfigService.getCategories());
    } catch (e: any) { toast.error(`Delete failed: ${e.message}`); }
  };

  // ── Unavailability ──
  const [unavailForm, setUnavailForm] = useState({ doctor_name: '', unavailable_date: '', reason: '' });
  const addUnavail = async () => {
    if (!unavailForm.doctor_name || !unavailForm.unavailable_date) { toast.error('Doctor and date required'); return; }
    try {
      await clinicConfigService.addUnavailability(unavailForm.doctor_name, unavailForm.unavailable_date, unavailForm.reason);
      setUnavailForm({ doctor_name: '', unavailable_date: '', reason: '' });
      setUnavailability(await clinicConfigService.getUnavailability(new Date().toISOString().split('T')[0]));
      toast.success('Unavailability added');
    } catch (e: any) { toast.error(`Failed: ${e.message}`); }
  };
  const removeUnavail = async (id: number) => {
    try {
      await clinicConfigService.removeUnavailability(id);
      setUnavailability(u => u.filter(x => x.id !== id));
    } catch (e: any) { toast.error(`Failed: ${e.message}`); }
  };

  // Holidays
  const [holidayInput, setHolidayInput] = useState('');
  const addHoliday = () => {
    if (!config || !holidayInput) return;
    if (config.holidays.includes(holidayInput)) return;
    setConfig({ ...config, holidays: [...config.holidays, holidayInput].sort() });
    setHolidayInput('');
  };

  const allDoctors = config ? Array.from(new Set(Object.values(config.days).flatMap(d => d.doctors))) : [];

  return (
    <div className="bg-white rounded-lg border border-gray-200">
      <button
        onClick={() => setExpanded(e => !e)}
        className="w-full flex items-center justify-between px-5 py-4 text-left"
      >
        <div className="flex items-center gap-3">
          <Calendar className="w-5 h-5 text-green-600" />
          <div>
            <h3 className="font-semibold text-gray-900">Clinic Configuration</h3>
            <p className="text-sm text-gray-500">Stations per day, slot length, categories, holidays & doctor leave</p>
          </div>
        </div>
        {expanded ? <ChevronUp className="w-5 h-5 text-gray-400" /> : <ChevronDown className="w-5 h-5 text-gray-400" />}
      </button>

      {expanded && (
        <div className="border-t border-gray-100 p-5 space-y-6">
          {loading || !config ? (
            <div className="flex items-center gap-2 text-gray-500 py-6">
              <RefreshCw className="w-4 h-4 animate-spin" /> Loading configuration…
            </div>
          ) : (
            <>
              {/* Global slot length */}
              <div className="flex items-center gap-3">
                <Clock className="w-4 h-4 text-gray-500" />
                <label className="text-sm font-medium text-gray-700">Slot length (minutes)</label>
                <input
                  type="number" min={5} max={120} step={5}
                  value={config.slotMinutes}
                  onChange={e => setConfig({ ...config, slotMinutes: Number(e.target.value) || 20 })}
                  className="w-24 px-3 py-1.5 border border-gray-300 rounded-md text-sm"
                />
              </div>

              {/* Per-day configuration */}
              <div className="space-y-3">
                <h4 className="text-sm font-semibold text-gray-800 flex items-center gap-2">
                  <Users className="w-4 h-4" /> Consulting stations per day
                </h4>
                {[1, 2, 3, 4, 5, 6, 0].map(dowNum => {
                  const dow = String(dowNum);
                  const day = config.days[dow] || EMPTY_DAY;
                  return (
                    <div key={dow} className={`rounded-lg border p-3 ${day.enabled ? 'border-green-200 bg-green-50/40' : 'border-gray-200'}`}>
                      <div className="flex items-center justify-between flex-wrap gap-2">
                        <label className="flex items-center gap-2 font-medium text-gray-800">
                          <input type="checkbox" checked={day.enabled}
                            onChange={e => updateDay(dow, { enabled: e.target.checked })}
                            className="w-4 h-4 accent-green-600" />
                          {DAY_NAMES[dowNum]}
                        </label>
                        {day.enabled && (
                          <div className="flex items-center gap-2 text-sm">
                            <span className="text-gray-600">Stations:</span>
                            <input type="number" min={0} max={10} value={day.stations}
                              onChange={e => updateDay(dow, { stations: Number(e.target.value) || 0 })}
                              className="w-16 px-2 py-1 border border-gray-300 rounded-md" />
                          </div>
                        )}
                      </div>
                      {day.enabled && (
                        <div className="mt-3 grid gap-3 sm:grid-cols-2">
                          <div>
                            <label className="text-xs font-medium text-gray-500">Doctors (one per station, comma-separated)</label>
                            <input type="text" value={day.doctors.join(', ')}
                              onChange={e => updateDay(dow, { doctors: e.target.value.split(',').map(s => s.trim()).filter(Boolean) })}
                              placeholder="Dr. Nnadi, Dr. Onyia, Dr. Okwesili"
                              className="w-full mt-1 px-3 py-1.5 border border-gray-300 rounded-md text-sm" />
                          </div>
                          <div>
                            <label className="text-xs font-medium text-gray-500">Sessions</label>
                            <div className="space-y-1.5 mt-1">
                              {day.sessions.map((s, i) => (
                                <div key={i} className="flex items-center gap-1.5">
                                  <input type="time" value={s.start}
                                    onChange={e => {
                                      const sessions = [...day.sessions]; sessions[i] = { ...s, start: e.target.value };
                                      updateDay(dow, { sessions });
                                    }}
                                    className="px-2 py-1 border border-gray-300 rounded-md text-xs" />
                                  <span className="text-gray-400">–</span>
                                  <input type="time" value={s.end}
                                    onChange={e => {
                                      const sessions = [...day.sessions]; sessions[i] = { ...s, end: e.target.value };
                                      updateDay(dow, { sessions });
                                    }}
                                    className="px-2 py-1 border border-gray-300 rounded-md text-xs" />
                                  <button onClick={() => updateDay(dow, { sessions: day.sessions.filter((_, j) => j !== i) })}
                                    className="text-red-500 hover:text-red-700"><Trash2 className="w-3.5 h-3.5" /></button>
                                </div>
                              ))}
                              <button
                                onClick={() => updateDay(dow, { sessions: [...day.sessions, { label: 'Session', start: '09:00', end: '13:00' }] })}
                                className="text-xs text-green-600 hover:text-green-700 flex items-center gap-1">
                                <Plus className="w-3 h-3" /> Add session
                              </button>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Holidays */}
              <div className="space-y-2">
                <h4 className="text-sm font-semibold text-gray-800 flex items-center gap-2">
                  <CalendarOff className="w-4 h-4" /> Public holidays (clinic closed)
                </h4>
                <div className="flex items-center gap-2">
                  <input type="date" value={holidayInput} onChange={e => setHolidayInput(e.target.value)}
                    className="px-3 py-1.5 border border-gray-300 rounded-md text-sm" />
                  <button onClick={addHoliday} className="px-3 py-1.5 bg-gray-100 hover:bg-gray-200 rounded-md text-sm flex items-center gap-1">
                    <Plus className="w-3.5 h-3.5" /> Add
                  </button>
                </div>
                <div className="flex flex-wrap gap-2">
                  {config.holidays.map(h => (
                    <span key={h} className="inline-flex items-center gap-1 px-2.5 py-1 bg-red-50 text-red-700 rounded-full text-xs">
                      {h}
                      <button onClick={() => setConfig({ ...config, holidays: config.holidays.filter(x => x !== h) })}>
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </span>
                  ))}
                  {config.holidays.length === 0 && <span className="text-xs text-gray-400">No holidays configured</span>}
                </div>
              </div>

              <div className="flex justify-end">
                <button onClick={handleSave} disabled={saving}
                  className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-md text-sm font-medium flex items-center gap-2 disabled:opacity-50">
                  {saving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                  Save configuration
                </button>
              </div>

              {/* Categories */}
              <div className="pt-4 border-t border-gray-100 space-y-3">
                <h4 className="text-sm font-semibold text-gray-800 flex items-center gap-2">
                  <Tag className="w-4 h-4" /> Patient categories
                </h4>
                <div className="space-y-2">
                  {categories.map((cat, idx) => (
                    <CategoryRow key={cat.id ?? idx} category={cat}
                      onSave={saveCategory} onDelete={() => deleteCategory(cat.id)} />
                  ))}
                  <CategoryRow isNew category={{ name: '', duration_minutes: 20, priority: 3, color: '#0E9F6E' }}
                    onSave={saveCategory} />
                </div>
              </div>

              {/* Doctor unavailability */}
              <div className="pt-4 border-t border-gray-100 space-y-3">
                <h4 className="text-sm font-semibold text-gray-800 flex items-center gap-2">
                  <CalendarOff className="w-4 h-4" /> Doctor unavailability (leave / off days)
                </h4>
                <div className="flex flex-wrap items-end gap-2">
                  <div>
                    <label className="text-xs text-gray-500">Doctor</label>
                    <input list="clinic-doctors" value={unavailForm.doctor_name}
                      onChange={e => setUnavailForm(f => ({ ...f, doctor_name: e.target.value }))}
                      className="block px-3 py-1.5 border border-gray-300 rounded-md text-sm" placeholder="Dr. Eze" />
                    <datalist id="clinic-doctors">{allDoctors.map(d => <option key={d} value={d} />)}</datalist>
                  </div>
                  <div>
                    <label className="text-xs text-gray-500">Date</label>
                    <input type="date" value={unavailForm.unavailable_date}
                      onChange={e => setUnavailForm(f => ({ ...f, unavailable_date: e.target.value }))}
                      className="block px-3 py-1.5 border border-gray-300 rounded-md text-sm" />
                  </div>
                  <div className="flex-1 min-w-[140px]">
                    <label className="text-xs text-gray-500">Reason (optional)</label>
                    <input type="text" value={unavailForm.reason}
                      onChange={e => setUnavailForm(f => ({ ...f, reason: e.target.value }))}
                      className="block w-full px-3 py-1.5 border border-gray-300 rounded-md text-sm" placeholder="Conference" />
                  </div>
                  <button onClick={addUnavail} className="px-3 py-2 bg-gray-100 hover:bg-gray-200 rounded-md text-sm flex items-center gap-1">
                    <Plus className="w-3.5 h-3.5" /> Add
                  </button>
                </div>
                <div className="space-y-1">
                  {unavailability.map(u => (
                    <div key={u.id} className="flex items-center justify-between text-sm px-3 py-1.5 bg-amber-50 rounded-md">
                      <span>{u.doctor_name} — {u.unavailable_date}{u.reason ? ` (${u.reason})` : ''}</span>
                      <button onClick={() => removeUnavail(u.id)} className="text-red-500 hover:text-red-700">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                  {unavailability.length === 0 && <span className="text-xs text-gray-400">No upcoming unavailability</span>}
                </div>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

function CategoryRow({ category, onSave, onDelete, isNew }: {
  category: ClinicCategory;
  onSave: (c: ClinicCategory) => void;
  onDelete?: () => void;
  isNew?: boolean;
}) {
  const [c, setC] = useState<ClinicCategory>(category);
  useEffect(() => { setC(category); }, [category]);

  return (
    <div className="flex flex-wrap items-center gap-2 p-2 rounded-md border border-gray-200">
      <input type="color" value={c.color} onChange={e => setC({ ...c, color: e.target.value })}
        className="w-8 h-8 rounded border border-gray-300 cursor-pointer" title="Colour" />
      <input type="text" value={c.name} placeholder="Category name"
        onChange={e => setC({ ...c, name: e.target.value })}
        className="flex-1 min-w-[140px] px-2 py-1.5 border border-gray-300 rounded-md text-sm" />
      <div className="flex items-center gap-1" title="Duration (minutes)">
        <Clock className="w-3.5 h-3.5 text-gray-400" />
        <input type="number" min={5} max={120} step={5} value={c.duration_minutes}
          onChange={e => setC({ ...c, duration_minutes: Number(e.target.value) || 20 })}
          className="w-16 px-2 py-1.5 border border-gray-300 rounded-md text-sm" />
      </div>
      <select value={c.priority} onChange={e => setC({ ...c, priority: Number(e.target.value) })}
        className="px-2 py-1.5 border border-gray-300 rounded-md text-sm" title="Priority">
        <option value={1}>P1 — Highest</option>
        <option value={2}>P2 — High</option>
        <option value={3}>P3 — Normal</option>
        <option value={4}>P4 — Low</option>
      </select>
      <button onClick={() => onSave(c)} disabled={!c.name.trim()}
        className="px-2.5 py-1.5 bg-green-600 hover:bg-green-700 text-white rounded-md text-xs font-medium disabled:opacity-40 flex items-center gap-1">
        {isNew ? <Plus className="w-3.5 h-3.5" /> : <Save className="w-3.5 h-3.5" />}
        {isNew ? 'Add' : 'Save'}
      </button>
      {!isNew && onDelete && (
        <button onClick={onDelete} className="text-red-500 hover:text-red-700 p-1">
          <Trash2 className="w-4 h-4" />
        </button>
      )}
    </div>
  );
}

/**
 * Starting a graft episode, and adding its sites.
 *
 * A site is a wound. Adding one creates the `wounds` row and links it, so from
 * that point the site is photographed, measured, calibrated, overlaid and
 * corrected by the existing wound pipeline with nothing graft-specific in the
 * way. That is the whole integration: this dialog is the only place the two
 * models are joined, and it joins them by creating one record, not two.
 */

import { useState } from 'react';
import { Loader2, Plus, X, AlertTriangle, Layers } from 'lucide-react';
import { createWound } from '../../services/woundMonitorService';
import { skinGraftService, type SiteRole } from '../../services/skinGraftService';
import { TaxonomySelect } from '../wound/TaxonomySelect';
import { ANATOMICAL_SITES } from '../../data/woundTaxonomy';

interface Props {
  patientId: number | string;
  hospitalNumber?: string;
  onClose: () => void;
  onCreated: (episodeId: number) => void;
}

interface DraftSite {
  key: string;
  role: SiteRole;
  label: string;
  location: string;
}

const GRAFT_TYPES = [
  { value: 'split_thickness', label: 'Split-thickness (SSG)' },
  { value: 'full_thickness', label: 'Full-thickness (FTSG)' },
  { value: 'composite', label: 'Composite' },
];

export function NewGraftEpisode({ patientId, hospitalNumber, onClose, onCreated }: Props) {
  const [label, setLabel] = useState('');
  const [graftType, setGraftType] = useState('split_thickness');
  const [thickness, setThickness] = useState('');
  const [mesh, setMesh] = useState('1:1.5');
  const [operationDate, setOperationDate] = useState(new Date().toISOString().slice(0, 10));
  const [sites, setSites] = useState<DraftSite[]>([
    { key: 'r1', role: 'recipient', label: 'Recipient site', location: '' },
    { key: 'd1', role: 'donor', label: 'Donor site', location: '' },
  ]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const addSite = (role: SiteRole) => setSites((s) => [...s, {
    key: `${role}-${Date.now()}`,
    role,
    label: role === 'recipient' ? 'Recipient site' : 'Donor site',
    location: '',
  }]);

  const update = (key: string, patch: Partial<DraftSite>) =>
    setSites((s) => s.map((x) => (x.key === key ? { ...x, ...patch } : x)));

  const remove = (key: string) => setSites((s) => s.filter((x) => x.key !== key));

  const submit = async () => {
    if (busy) return;
    const usable = sites.filter((s) => s.location.trim());
    if (!usable.length) {
      setError('Give at least one site an anatomical location — it is how the site is identified on a photograph.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      const { episode } = await skinGraftService.createEpisode({
        patientId,
        episodeLabel: label.trim() || undefined,
        graftType,
        graftThicknessMm: thickness ? Number(thickness) : undefined,
        meshRatio: mesh,
        operationDate,
      });

      // Each site becomes a wound first, then is linked. Done in sequence
      // rather than in parallel so that a failure half way leaves a coherent
      // episode with the sites that did succeed, rather than an indeterminate one.
      for (const s of usable) {
        const wound = await createWound({
          patient_id: patientId,
          hospital_number: hospitalNumber,
          label: `${s.label} — ${s.location}`.trim(),
          wound_type: s.role === 'donor' ? 'donor_site' : 'graft_recipient',
          anatomical_location: s.location.trim(),
          status: 'active',
        });
        const woundId = Number(wound.id ?? wound.serverId);
        if (!Number.isFinite(woundId)) continue;

        await skinGraftService.addSite({
          episodeId: Number(episode.id),
          woundId,
          siteRole: s.role,
          siteLabel: s.label.trim() || undefined,
          anatomicalLocation: s.location.trim(),
        });
      }

      onCreated(Number(episode.id));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not create the graft episode.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-start justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl w-full max-w-lg my-6">
        <header className="flex items-center gap-3 px-5 py-4 border-b">
          <Layers className="w-5 h-5 text-teal-600 shrink-0" />
          <h2 className="font-semibold text-gray-900 flex-1">New skin graft episode</h2>
          <button onClick={onClose} className="p-1 rounded hover:bg-gray-100" aria-label="Close">
            <X className="w-5 h-5 text-gray-400" />
          </button>
        </header>

        <div className="p-5 space-y-4">
          <label className="block">
            <span className="text-xs font-medium text-gray-600">Label</span>
            <input
              value={label} onChange={(e) => setLabel(e.target.value)}
              placeholder="e.g. SSG to left leg ulcer"
              className="mt-1 w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-teal-500 focus:outline-none"
            />
          </label>

          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className="text-xs font-medium text-gray-600">Graft type</span>
              <select
                value={graftType} onChange={(e) => setGraftType(e.target.value)}
                className="mt-1 w-full px-3 py-2 border rounded-lg text-sm bg-white focus:ring-2 focus:ring-teal-500 focus:outline-none"
              >
                {GRAFT_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </label>
            <label className="block">
              <span className="text-xs font-medium text-gray-600">Thickness (mm)</span>
              <input
                type="number" step="0.05" min="0" value={thickness}
                onChange={(e) => setThickness(e.target.value)} placeholder="0.30"
                className="mt-1 w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-teal-500 focus:outline-none"
              />
            </label>
            <label className="block">
              <span className="text-xs font-medium text-gray-600">Mesh ratio</span>
              <select
                value={mesh} onChange={(e) => setMesh(e.target.value)}
                className="mt-1 w-full px-3 py-2 border rounded-lg text-sm bg-white focus:ring-2 focus:ring-teal-500 focus:outline-none"
              >
                {['1:1', '1:1.5', '1:2', '1:3', '1:4', '1:6'].map((r) => <option key={r} value={r}>{r}</option>)}
              </select>
            </label>
            <label className="block">
              <span className="text-xs font-medium text-gray-600">Operation date</span>
              <input
                type="date" value={operationDate} onChange={(e) => setOperationDate(e.target.value)}
                className="mt-1 w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-teal-500 focus:outline-none"
              />
            </label>
          </div>

          <div>
            <p className="text-xs font-semibold text-gray-600 mb-1.5">
              Sites — each becomes a wound that is photographed and tracked
            </p>
            <ul className="space-y-2">
              {sites.map((s) => (
                <li key={s.key} className="flex items-center gap-2">
                  <span className={`px-2 py-1 rounded-md text-[11px] font-medium shrink-0 ${
                    s.role === 'recipient' ? 'bg-teal-100 text-teal-800' : 'bg-indigo-100 text-indigo-800'
                  }`}>
                    {s.role === 'recipient' ? 'Recipient' : 'Donor'}
                  </span>
                  <TaxonomySelect
                    groups={ANATOMICAL_SITES}
                    value={s.location}
                    onChange={(v) => update(s.key, { location: v })}
                    placeholder={s.role === 'donor' ? 'Donor site…' : 'Recipient site…'}
                    otherPlaceholder="Describe the site"
                    className="flex-1 min-w-0"
                  />
                  {sites.length > 1 && (
                    <button onClick={() => remove(s.key)} className="p-1.5 rounded hover:bg-gray-100 shrink-0" aria-label="Remove this site">
                      <X className="w-4 h-4 text-gray-400" />
                    </button>
                  )}
                </li>
              ))}
            </ul>
            <div className="flex gap-2 mt-2">
              <button onClick={() => addSite('recipient')} className="flex items-center gap-1 text-xs font-medium text-teal-700 hover:underline">
                <Plus className="w-3.5 h-3.5" /> Recipient site
              </button>
              <button onClick={() => addSite('donor')} className="flex items-center gap-1 text-xs font-medium text-indigo-700 hover:underline">
                <Plus className="w-3.5 h-3.5" /> Donor site
              </button>
            </div>
            <p className="text-[11px] text-gray-400 mt-1.5">
              Multiple recipient and donor sites are supported; each is tracked separately.
            </p>
          </div>

          {error && (
            <div role="alert" className="flex items-start gap-2 p-3 rounded-xl bg-red-50 border border-red-200 text-sm text-red-800">
              <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" /> {error}
            </div>
          )}

          <button
            onClick={() => void submit()}
            disabled={busy}
            className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-teal-600 text-white font-semibold hover:bg-teal-700 disabled:opacity-60"
          >
            {busy && <Loader2 className="w-4 h-4 animate-spin" />}
            {busy ? 'Creating…' : 'Create episode'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default NewGraftEpisode;

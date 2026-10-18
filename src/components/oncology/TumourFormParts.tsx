/**
 * Tumour board form parts: a registered-patient picker (the case used to take
 * a typed id, which created orphan cases) and lesion size measured on a
 * calibrated photograph with the same tracer the wound and scar monitors use.
 */
import { useEffect, useMemo, useState } from 'react';
import { Camera, Search, X } from 'lucide-react';
import { patientService } from '../../services/patientService';
import { RegionTracer } from '../wound/RegionTracer';
import { greatestDimensionCm } from '../../services/oncology/tumourMeasurements';

interface PickedPatient { id: string; name: string; hospitalNumber?: string }

const nameOf = (p: any) => (p.full_name || `${p.first_name || ''} ${p.last_name || ''}`).trim() || 'Unnamed';

export function TumourPatientPicker({ value, onChange }: { value: PickedPatient | null; onChange: (p: PickedPatient | null) => void }) {
  const [all, setAll] = useState<any[]>([]);
  const [q, setQ] = useState('');
  useEffect(() => {
    patientService.getAllPatients().then(setAll).catch(() => setAll([]));
  }, []);
  const matches = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (s.length < 2) return [];
    return all.filter(p => nameOf(p).toLowerCase().includes(s) || String(p.hospital_number || '').toLowerCase().includes(s)).slice(0, 12);
  }, [all, q]);

  if (value) {
    return (
      <div className="flex items-center justify-between gap-2 border rounded-lg px-3 py-2 bg-green-50 border-green-200">
        <div className="min-w-0">
          <p className="text-sm font-medium text-gray-900 truncate">{value.name}</p>
          {value.hospitalNumber && <p className="text-xs text-gray-600">{value.hospitalNumber}</p>}
        </div>
        <button type="button" onClick={() => onChange(null)} className="p-1 text-gray-500 hover:text-gray-800" aria-label="Change patient"><X className="w-4 h-4" /></button>
      </div>
    );
  }
  return (
    <div>
      <div className="relative">
        <Search className="w-4 h-4 text-gray-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
        <input value={q} onChange={e => setQ(e.target.value)} className="input pl-8" placeholder="Search name or hospital number…" />
      </div>
      {matches.length > 0 && (
        <ul className="mt-1 border rounded-lg divide-y max-h-60 overflow-y-auto bg-white">
          {matches.map(p => {
            const serverId = p.serverId ?? p.server_id;
            const usable = serverId != null || typeof p.id === 'number';
            return (
              <li key={String(p.id)}>
                <button type="button" disabled={!usable}
                  onClick={() => onChange({ id: String(serverId ?? p.id), name: nameOf(p), hospitalNumber: p.hospital_number })}
                  className="w-full text-left px-3 py-2 hover:bg-gray-50 disabled:opacity-50">
                  <span className="text-sm text-gray-900">{nameOf(p)}</span>
                  <span className="ml-2 text-xs text-gray-500">{p.hospital_number || ''}</span>
                  {!usable && <span className="ml-2 text-[11px] text-amber-700">not yet synced</span>}
                </button>
              </li>
            );
          })}
        </ul>
      )}
      {q.trim().length >= 2 && matches.length === 0 && <p className="mt-1 text-xs text-gray-500">No registered patient matches.</p>}
    </div>
  );
}

/** Photograph the lesion with the reference marker, calibrate, trace its margin → greatest dimension. */
export function MeasureLesionFromPhoto({ onMeasured }: { onMeasured: (cm: number) => void }) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => () => { if (url) URL.revokeObjectURL(url); }, [url]);

  return (
    <>
      <label className="inline-flex items-center gap-1.5 px-3 py-2 border rounded-lg text-sm cursor-pointer hover:bg-gray-50">
        <Camera className="w-4 h-4" /> Measure from photo
        <input type="file" accept="image/*" capture="environment" className="hidden"
          onChange={e => { const f = e.target.files?.[0]; if (f) setUrl(URL.createObjectURL(f)); e.target.value = ''; }} />
      </label>
      {url && (
          <RegionTracer
            imageUrl={url}
            detectedPixelsPerCm={null}
            siteRole="recipient"
            purpose="lesion"
            onCancel={() => setUrl(null)}
            onConfirm={(r) => {
              const main = r.totalRegions.filter(x => x.points.length >= 3)
                .map(x => greatestDimensionCm(x.points, r.pixelsPerCm) ?? 0)
                .sort((a, b) => b - a)[0];
              if (main) onMeasured(main);
              setUrl(null);
            }}
          />
      )}
    </>
  );
}

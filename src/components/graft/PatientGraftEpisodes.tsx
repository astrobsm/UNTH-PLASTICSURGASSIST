/**
 * This patient's graft episodes, inside their record.
 *
 * The §57 entry point: open patient, open episode. Creating one from here
 * needs no patient to be named, because the record already knows whose it is —
 * which is the difference between this and the unit dashboard, where the
 * question has to be asked.
 */

import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Layers, Loader2, Plus, Bell, ChevronRight, AlertTriangle } from 'lucide-react';
import { skinGraftService, type GraftEpisode } from '../../services/skinGraftService';
import { NewGraftEpisode } from './NewGraftEpisode';

interface Props {
  patientId: string | number;
  hospitalNumber?: string;
}

export function PatientGraftEpisodes({ patientId, hospitalNumber }: Props) {
  const navigate = useNavigate();
  const [episodes, setEpisodes] = useState<GraftEpisode[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [creating, setCreating] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      setEpisodes((await skinGraftService.episodesFor(patientId)).episodes);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load graft episodes.');
    } finally {
      setLoading(false);
    }
  }, [patientId]);

  useEffect(() => { void load(); }, [load]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="font-semibold text-gray-900 flex items-center gap-2">
            <Layers className="w-5 h-5 text-teal-600" /> Skin graft monitoring
          </h3>
          <p className="text-xs text-gray-500 mt-0.5">
            Graft take and donor-site healing, measured from calibrated photographs
          </p>
        </div>
        <button
          onClick={() => setCreating(true)}
          className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-teal-600 text-white text-sm font-medium hover:bg-teal-700"
        >
          <Plus className="w-4 h-4" /> New episode
        </button>
      </div>

      {loading ? (
        <div className="flex items-center gap-2 text-sm text-gray-500 py-6">
          <Loader2 className="w-4 h-4 animate-spin" /> Loading…
        </div>
      ) : error ? (
        <div className="flex items-start gap-2 p-3 rounded-xl bg-red-50 border border-red-200 text-sm text-red-800">
          <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" /> {error}
        </div>
      ) : episodes.length === 0 ? (
        <div className="bg-gray-50 border rounded-xl p-8 text-center">
          <Layers className="w-8 h-8 mx-auto text-gray-300 mb-2" />
          <p className="text-sm text-gray-600">No graft episodes recorded for this patient.</p>
          <p className="text-xs text-gray-400 mt-1">
            Start one after grafting, then photograph the recipient and donor sites at each dressing.
          </p>
        </div>
      ) : (
        <ul className="space-y-2">
          {episodes.map((e) => (
            <li key={e.id}>
              <button
                onClick={() => navigate(`/skin-grafts/${e.id}`)}
                className="w-full text-left bg-white border rounded-xl p-3.5 hover:border-teal-400 transition-colors flex items-center gap-3"
              >
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-gray-900 truncate">
                    {e.episode_label || 'Skin graft'}
                  </p>
                  <p className="text-xs text-gray-500 mt-0.5 truncate">
                    {e.graft_type ? e.graft_type.replace(/_/g, ' ') : 'Graft'}
                    {e.graft_thickness_mm ? ` · ${e.graft_thickness_mm} mm` : ''}
                    {e.mesh_ratio ? ` · mesh ${e.mesh_ratio}` : ''}
                    {e.operation_date ? ` · ${new Date(e.operation_date).toLocaleDateString()}` : ''}
                    {` · ${e.site_count ?? 0} site${e.site_count === 1 ? '' : 's'}`}
                  </p>
                </div>
                {!!e.open_alerts && e.open_alerts > 0 && (
                  <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-red-100 text-red-700 text-xs font-medium shrink-0">
                    <Bell className="w-3 h-3" /> {e.open_alerts}
                  </span>
                )}
                <span className={`px-2 py-0.5 rounded-full text-[11px] font-medium shrink-0 ${
                  e.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'
                }`}>
                  {e.status}
                </span>
                <ChevronRight className="w-4 h-4 text-gray-300 shrink-0" />
              </button>
            </li>
          ))}
        </ul>
      )}

      {creating && (
        <NewGraftEpisode
          patientId={patientId}
          hospitalNumber={hospitalNumber}
          onClose={() => setCreating(false)}
          onCreated={(episodeId) => { setCreating(false); navigate(`/skin-grafts/${episodeId}`); }}
        />
      )}
    </div>
  );
}

export default PatientGraftEpisodes;

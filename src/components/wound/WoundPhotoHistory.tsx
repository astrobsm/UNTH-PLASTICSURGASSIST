/**
 * Every photograph taken of a patient's wounds, in the order they were taken.
 *
 * The existing gallery shows the pictures attached to one assessment, which
 * answers "what did we photograph just now". It cannot answer the question the
 * progress monitor exists for — is this wound getting better — because that
 * needs the whole run of photographs side by side, and a way to hold the first
 * one against the latest.
 *
 * So: grouped by the day they were taken, newest first, with the measurement
 * recorded against each one; any two can be pinned and compared; and the viewer
 * steps through the run without closing and reopening.
 *
 * Photographs still sitting on this device are merged in and marked, so a
 * clinician on a ward with no signal sees their own work immediately and can
 * tell it has not been sent yet.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertCircle, ArrowLeftRight, CloudOff, ImageOff, Loader2, RefreshCw,
  X, ChevronLeft, ChevronRight, Ruler, Calendar, Check,
} from 'lucide-react';
import {
  listRemoteImages,
  resolveWoundImageUrl,
  syncPendingWoundImages,
  type WoundImageMeta,
} from '../../services/woundImageSync';
import { getImagesForAssessment } from '../../services/woundImageStore';

export interface WoundAssessmentSummary {
  id: number;
  assessed_at?: string | null;
  area_cm2?: number | null;
  length_cm?: number | null;
  width_cm?: number | null;
}

interface Props {
  patientId?: number | null;
  woundId?: number | null;
  /** Assessments, so a photograph can be shown with the size measured from it. */
  assessments?: WoundAssessmentSummary[];
  className?: string;
}

interface Photo extends WoundImageMeta {
  url: string | null;
  uploaded: boolean;
}

/** A day's worth of photographs. */
interface DayGroup {
  key: string;
  label: string;
  photos: Photo[];
}

const dayKey = (iso: string | null) => (iso ? iso.slice(0, 10) : 'undated');

function dayLabel(key: string): string {
  if (key === 'undated') return 'Date not recorded';
  const d = new Date(`${key}T00:00:00`);
  const today = new Date();
  const days = Math.round((today.setHours(0, 0, 0, 0) - d.getTime()) / 86_400_000);
  if (days === 0) return 'Today';
  if (days === 1) return 'Yesterday';
  return `${d.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })} · ${days} days ago`;
}

export function WoundPhotoHistory({ patientId, woundId, assessments = [], className = '' }: Props) {
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [viewing, setViewing] = useState<number | null>(null);
  const [comparing, setComparing] = useState(false);
  const [pinned, setPinned] = useState<string[]>([]);

  /** Measurement recorded against the assessment a photograph belongs to. */
  const sizeFor = useCallback((photo: Photo) => {
    const a = assessments.find((x) => x.id === photo.assessment_id);
    if (!a) return null;
    if (a.area_cm2 != null) return `${Number(a.area_cm2).toFixed(1)} cm²`;
    if (a.length_cm != null && a.width_cm != null) return `${a.length_cm} × ${a.width_cm} cm`;
    return null;
  }, [assessments]);

  const load = useCallback(async () => {
    if (patientId == null && woundId == null) { setLoading(false); return; }
    setLoading(true);
    setError(null);
    try {
      // Push anything stranded on this device before listing.
      //
      // A photograph is normally sent when its assessment is saved, so one
      // taken in a dialog the clinician then abandoned stays on the phone until
      // the browser evicts it. Opening this view is the natural moment to
      // rescue those: it is a no-op offline and when there is nothing pending.
      await syncPendingWoundImages().catch(() => { /* listing still works */ });

      const remote = await listRemoteImages({ patientId, woundId });

      // Anything held only on this device. Merged on top of the server's list,
      // which is the record because it includes other people's phones.
      //
      // The local record carries a Blob and no mime type; the remote one is
      // metadata about a file already sent. Only the fields this view needs are
      // carried across, rather than asserting the two shapes are the same.
      const localOnly: WoundImageMeta[] = [];
      for (const a of assessments) {
        try {
          const local = await getImagesForAssessment(a.id);
          for (const l of local) {
            if (remote.some((r) => r.ref === l.ref)) continue;
            localOnly.push({
              ref: l.ref,
              kind: l.kind,
              mime_type: l.blob?.type || 'image/jpeg',
              width: l.width ?? null,
              height: l.height ?? null,
              captured_at: l.captured_at ?? null,
              assessment_id: l.assessment_id ?? null,
              wound_id: l.wound_id ?? null,
              patient_id: l.patient_id ?? null,
              remote_path: '',
            });
          }
        } catch { /* a device with nothing stored is not an error */ }
      }

      const merged = [...remote.map((m) => ({ ...m, uploaded: true })),
        ...localOnly.map((m) => ({ ...m, uploaded: false }))];

      const withUrls = await Promise.all(merged.map(async (m) => ({
        ...m,
        url: await resolveWoundImageUrl(m.ref, m).catch(() => null),
      })));

      withUrls.sort((a, b) => (b.captured_at || '').localeCompare(a.captured_at || ''));
      setPhotos(withUrls as Photo[]);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load the photographs.');
    } finally {
      setLoading(false);
    }
  }, [patientId, woundId, assessments]);

  useEffect(() => { void load(); }, [load]);

  const groups = useMemo<DayGroup[]>(() => {
    const map = new Map<string, Photo[]>();
    for (const p of photos) {
      const k = dayKey(p.captured_at);
      const bucket = map.get(k);
      if (bucket) bucket.push(p);
      else map.set(k, [p]);
    }
    return [...map.entries()]
      .sort((a, b) => b[0].localeCompare(a[0]))
      .map(([key, list]) => ({ key, label: dayLabel(key), photos: list }));
  }, [photos]);

  const pendingCount = photos.filter((p) => !p.uploaded).length;

  const togglePin = (ref: string) => {
    setPinned((cur) => {
      if (cur.includes(ref)) return cur.filter((r) => r !== ref);
      // Two at a time: the oldest pin drops off so a third click always works.
      return [...cur, ref].slice(-2);
    });
  };

  const pinnedPhotos = pinned
    .map((ref) => photos.find((p) => p.ref === ref))
    .filter(Boolean) as Photo[];

  // ── states ────────────────────────────────────────────────────────────────

  if (loading && !photos.length) {
    return (
      <div className={`flex items-center gap-2 text-sm text-gray-500 py-6 ${className}`}>
        <Loader2 className="w-4 h-4 animate-spin" /> Loading the photograph history…
      </div>
    );
  }

  if (error) {
    return (
      <div className={`flex items-center gap-2 text-sm text-red-600 py-4 ${className}`}>
        <AlertCircle className="w-4 h-4" /> {error}
        <button onClick={load} className="underline">Retry</button>
      </div>
    );
  }

  if (!photos.length) {
    return (
      <div className={`text-center py-10 text-gray-400 ${className}`}>
        <ImageOff className="w-8 h-8 mx-auto mb-2" />
        <p className="text-sm">No wound photographs recorded for this patient yet.</p>
        <p className="text-xs mt-1">
          Photographs taken during an assessment appear here, and stay here.
        </p>
      </div>
    );
  }

  return (
    <div className={className}>
      {/* Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
        <div className="flex items-center gap-2 text-sm text-gray-600">
          <Calendar className="w-4 h-4 text-gray-400" />
          <span>
            <strong>{photos.length}</strong> photograph{photos.length === 1 ? '' : 's'} over{' '}
            <strong>{groups.length}</strong> day{groups.length === 1 ? '' : 's'}
          </span>
        </div>
        <div className="flex items-center gap-2">
          {pendingCount > 0 && (
            <button
              onClick={async () => { await syncPendingWoundImages(); void load(); }}
              className="flex items-center gap-1 text-xs px-2 py-1 rounded-full bg-amber-100 text-amber-800 hover:bg-amber-200"
              title="These are only on this device. Send them now."
            >
              <CloudOff className="w-3 h-3" /> {pendingCount} not uploaded
            </button>
          )}
          <button
            onClick={() => { setComparing(!comparing); setPinned([]); }}
            className={`flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg font-medium ${
              comparing ? 'bg-green-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            <ArrowLeftRight className="w-3.5 h-3.5" />
            {comparing ? 'Done comparing' : 'Compare'}
          </button>
          <button onClick={load} className="p-1.5 rounded hover:bg-gray-100 text-gray-400" title="Reload">
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {comparing && (
        <p className="text-xs text-gray-500 mb-3">
          {pinned.length === 0 && 'Choose the earlier photograph, then the later one.'}
          {pinned.length === 1 && 'Now choose the one to compare it with.'}
          {pinned.length === 2 && 'Comparing the two below.'}
        </p>
      )}

      {/* Comparison */}
      {comparing && pinnedPhotos.length === 2 && (
        <div className="grid grid-cols-2 gap-3 mb-5 p-3 bg-gray-50 rounded-xl border">
          {[...pinnedPhotos]
            .sort((a, b) => (a.captured_at || '').localeCompare(b.captured_at || ''))
            .map((p, i) => (
              <figure key={p.ref} className="min-w-0">
                <div className="aspect-square rounded-lg overflow-hidden bg-white border">
                  {p.url
                    ? <img src={p.url} alt="" className="w-full h-full object-contain" />
                    : <div className="w-full h-full flex items-center justify-center text-gray-300"><ImageOff /></div>}
                </div>
                <figcaption className="mt-1.5 text-xs">
                  <span className={`font-medium ${i === 0 ? 'text-gray-500' : 'text-green-700'}`}>
                    {i === 0 ? 'Earlier' : 'Later'}
                  </span>
                  <span className="text-gray-500">
                    {' · '}{p.captured_at ? new Date(p.captured_at).toLocaleDateString() : 'undated'}
                  </span>
                  {sizeFor(p) && (
                    <span className="block text-gray-700 font-medium mt-0.5">{sizeFor(p)}</span>
                  )}
                </figcaption>
              </figure>
            ))}
        </div>
      )}

      {/* The run, by day */}
      <div className="space-y-5">
        {groups.map((group) => (
          <section key={group.key}>
            <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2 flex items-center gap-2">
              {group.label}
              <span className="font-normal normal-case text-gray-400">
                · {group.photos.length} photograph{group.photos.length === 1 ? '' : 's'}
              </span>
            </h3>
            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-2">
              {group.photos.map((p) => {
                const index = photos.findIndex((x) => x.ref === p.ref);
                const isPinned = pinned.includes(p.ref);
                return (
                  <button
                    key={p.ref}
                    onClick={() => (comparing ? togglePin(p.ref) : setViewing(index))}
                    className={`relative aspect-square rounded-lg overflow-hidden border bg-gray-50 group ${
                      isPinned ? 'ring-2 ring-green-500 border-green-500' : 'border-gray-200'
                    }`}
                    title={p.captured_at ? new Date(p.captured_at).toLocaleString() : p.ref}
                  >
                    {p.url ? (
                      <img
                        src={p.url}
                        alt={`Wound photograph from ${p.captured_at ? new Date(p.captured_at).toLocaleDateString() : 'an unrecorded date'}`}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                        loading="lazy"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-gray-300">
                        <ImageOff className="w-5 h-5" />
                      </div>
                    )}

                    {isPinned && (
                      <span className="absolute top-1 left-1 bg-green-600 text-white rounded-full p-0.5">
                        <Check className="w-3 h-3" />
                      </span>
                    )}
                    {!p.uploaded && (
                      <span className="absolute top-1 right-1 bg-amber-500 text-white rounded-full p-0.5"
                        title="Only on this device">
                        <CloudOff className="w-3 h-3" />
                      </span>
                    )}
                    {sizeFor(p) && (
                      <span className="absolute bottom-0 inset-x-0 bg-black/60 text-white text-[10px] py-0.5 truncate px-1">
                        {sizeFor(p)}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </section>
        ))}
      </div>

      {viewing !== null && photos[viewing] && (
        <PhotoViewer
          photos={photos}
          index={viewing}
          sizeFor={sizeFor}
          onIndex={setViewing}
          onClose={() => setViewing(null)}
        />
      )}
    </div>
  );
}

/**
 * Full-screen viewer that steps through the run.
 *
 * Arrow keys move between photographs, because a clinician reviewing a wound
 * over six weeks should not have to close and reopen the picture each time.
 */
function PhotoViewer({ photos, index, sizeFor, onIndex, onClose }: {
  photos: Photo[]; index: number;
  sizeFor: (p: Photo) => string | null;
  onIndex: (i: number) => void; onClose: () => void;
}) {
  const photo = photos[index];

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowLeft' && index > 0) onIndex(index - 1);
      if (e.key === 'ArrowRight' && index < photos.length - 1) onIndex(index + 1);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [index, photos.length, onIndex, onClose]);

  return (
    <div className="fixed inset-0 z-50 bg-black/90 flex flex-col" role="dialog" aria-modal="true"
      aria-label="Wound photograph">
      <div className="shrink-0 flex items-center justify-between px-4 py-2.5 text-white/80 text-sm">
        <span className="tabular-nums">{index + 1} of {photos.length}</span>
        <button onClick={onClose} className="p-2 rounded-full hover:bg-white/10" aria-label="Close">
          <X className="w-5 h-5" />
        </button>
      </div>

      <div className="flex-1 flex items-center justify-center min-h-0 px-2">
        <button
          onClick={() => onIndex(index - 1)} disabled={index === 0}
          className="shrink-0 p-2 sm:p-3 rounded-full text-white/70 hover:bg-white/10 disabled:opacity-20"
          aria-label="Previous photograph"
        >
          <ChevronLeft className="w-6 h-6" />
        </button>

        <figure className="flex-1 min-w-0 h-full flex flex-col items-center justify-center">
          {photo.url ? (
            <img src={photo.url} alt="Wound photograph"
              className="max-w-full max-h-[70vh] object-contain rounded-lg" />
          ) : (
            <div className="text-white/40 flex flex-col items-center gap-2">
              <ImageOff className="w-10 h-10" />
              <p className="text-sm">This photograph could not be loaded.</p>
            </div>
          )}
          <figcaption className="mt-3 text-center text-white/70 text-xs space-y-1">
            <p>
              {photo.captured_at
                ? new Date(photo.captured_at).toLocaleString()
                : 'Date not recorded'}
              {!photo.uploaded && ' · only on this device'}
            </p>
            {sizeFor(photo) && (
              <p className="flex items-center justify-center gap-1.5 text-white font-medium">
                <Ruler className="w-3.5 h-3.5" /> {sizeFor(photo)}
              </p>
            )}
          </figcaption>
        </figure>

        <button
          onClick={() => onIndex(index + 1)} disabled={index === photos.length - 1}
          className="shrink-0 p-2 sm:p-3 rounded-full text-white/70 hover:bg-white/10 disabled:opacity-20"
          aria-label="Next photograph"
        >
          <ChevronRight className="w-6 h-6" />
        </button>
      </div>

      {/* Filmstrip, so a run of six weeks can be jumped through. */}
      <div className="shrink-0 flex gap-1.5 overflow-x-auto px-3 py-2 bg-black/40">
        {photos.map((p, i) => (
          <button
            key={p.ref} onClick={() => onIndex(i)}
            className={`shrink-0 w-14 h-14 rounded overflow-hidden border-2 ${
              i === index ? 'border-green-500' : 'border-transparent opacity-60 hover:opacity-100'
            }`}
          >
            {p.url
              ? <img src={p.url} alt="" className="w-full h-full object-cover" />
              : <div className="w-full h-full bg-white/10" />}
          </button>
        ))}
      </div>
    </div>
  );
}

export default WoundPhotoHistory;

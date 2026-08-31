/**
 * Shows the photographs attached to a wound or an assessment.
 *
 * WHY THIS EXISTS
 * Photographs were being stored and never shown. woundImageStore's read side
 * (`getImagesForAssessment`, `getImageUrl`) had no callers anywhere in the app,
 * so a clinician who documented a wound had no way to look at the picture they
 * had just taken — not from another phone, and not from the same phone after a
 * refresh. Capture without display is only half a record.
 *
 * WHERE THE BYTES COME FROM
 * The server is the list of record, because it is the only view that includes
 * photographs taken on someone else's device. Anything this device is still
 * holding alone is merged in on top, so a clinician on a ward with no signal
 * sees their own photographs immediately and can tell that they have not been
 * sent yet.
 */

import React, { useCallback, useEffect, useState } from 'react';
import { AlertCircle, CloudOff, ImageOff, Loader2, RefreshCw, X } from 'lucide-react';
import {
  listRemoteImages,
  resolveWoundImageUrl,
  syncPendingWoundImages,
  type WoundImageMeta,
} from '../services/woundImageSync';
import { getImagesForAssessment } from '../services/woundImageStore';

interface Props {
  assessmentId?: number | null;
  woundId?: number | null;
  patientId?: number | null;
  /** Heading text; omit for a bare grid. */
  title?: string;
  className?: string;
}

interface Item {
  ref: string;
  kind: string;
  capturedAt: string | null;
  /** False while the photograph exists only on this device. */
  uploaded: boolean;
  url: string | null;
  failed: boolean;
}

const WoundImageGallery: React.FC<Props> = ({
  assessmentId, woundId, patientId, title = 'Photographs', className = '',
}) => {
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [zoomed, setZoomed] = useState<Item | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');

    let remote: WoundImageMeta[] = [];
    let remoteFailed = false;
    try {
      remote = await listRemoteImages({ assessmentId, woundId, patientId });
    } catch {
      // Offline, or the server is unreachable. Local photographs are still
      // worth showing — saying nothing here would look like "no photographs".
      remoteFailed = true;
    }

    const byRef = new Map<string, Item>();
    for (const r of remote) {
      byRef.set(r.ref, {
        ref: r.ref, kind: r.kind, capturedAt: r.captured_at, uploaded: true, url: null, failed: false,
      });
    }

    if (assessmentId != null) {
      try {
        for (const row of await getImagesForAssessment(assessmentId)) {
          const existing = byRef.get(row.ref);
          byRef.set(row.ref, {
            ref: row.ref,
            kind: row.kind,
            capturedAt: row.captured_at,
            uploaded: existing?.uploaded || Boolean(row.remote_path),
            url: null,
            failed: false,
          });
        }
      } catch {
        /* IndexedDB unavailable; the remote list still stands. */
      }
    }

    const list = [...byRef.values()].sort((a, b) =>
      String(b.capturedAt || '').localeCompare(String(a.capturedAt || ''))
    );

    // Resolve each to something displayable: local blob if held, otherwise one
    // fetch that is then cached for next time.
    const resolved = await Promise.all(
      list.map(async item => {
        try {
          return { ...item, url: await resolveWoundImageUrl(item.ref) };
        } catch {
          return { ...item, failed: true };
        }
      })
    );

    setItems(resolved);
    if (remoteFailed && !resolved.length) {
      setError('Photographs could not be loaded and none are stored on this device.');
    }
    setLoading(false);
  }, [assessmentId, woundId, patientId]);

  useEffect(() => { void load(); }, [load]);

  // Object URLs are created per resolved item; release them when they go.
  useEffect(() => () => {
    for (const i of items) if (i.url?.startsWith('blob:')) URL.revokeObjectURL(i.url);
    // Re-running on every items change would revoke URLs still on screen, so
    // this deliberately cleans up only on unmount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const pending = items.filter(i => !i.uploaded).length;

  const retryUpload = async () => {
    await syncPendingWoundImages();
    await load();
  };

  return (
    <div className={className}>
      {title && (
        <div className="flex items-center justify-between mb-2">
          <h4 className="text-sm font-semibold text-gray-700">
            {title}
            {items.length > 0 && <span className="ml-1.5 text-gray-400 font-normal">({items.length})</span>}
          </h4>
          <div className="flex items-center gap-2">
            {pending > 0 && (
              <button
                onClick={retryUpload}
                title="These photographs are still only on this device. Send them now."
                className="flex items-center gap-1 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-full px-2 py-0.5 hover:bg-amber-100"
              >
                <CloudOff className="w-3 h-3" /> {pending} not uploaded
              </button>
            )}
            <button onClick={load} className="p-1 rounded hover:bg-gray-100 text-gray-400" title="Reload">
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>
      )}

      {loading && !items.length && (
        <div className="flex items-center gap-2 text-sm text-gray-500 py-4">
          <Loader2 className="w-4 h-4 animate-spin" /> Loading photographs…
        </div>
      )}

      {!loading && !items.length && !error && (
        <div className="flex items-center gap-2 text-sm text-gray-400 py-4">
          <ImageOff className="w-4 h-4" /> No photographs recorded.
        </div>
      )}

      {error && (
        <div className="flex items-center gap-2 text-sm text-red-600 py-3">
          <AlertCircle className="w-4 h-4" /> {error}
        </div>
      )}

      {items.length > 0 && (
        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-2">
          {items.map(item => (
            <button
              key={item.ref}
              onClick={() => item.url && setZoomed(item)}
              className="relative aspect-square rounded-lg overflow-hidden border border-gray-200 bg-gray-50 group"
              title={item.capturedAt ? new Date(item.capturedAt).toLocaleString() : item.ref}
            >
              {item.url ? (
                <img
                  src={item.url}
                  alt={`Wound photograph ${item.capturedAt ? `from ${new Date(item.capturedAt).toLocaleDateString()}` : ''}`}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                  loading="lazy"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-gray-300">
                  <ImageOff className="w-5 h-5" />
                </div>
              )}
              {!item.uploaded && (
                <span
                  className="absolute top-1 right-1 bg-amber-500 text-white rounded-full p-0.5"
                  title="Only on this device"
                >
                  <CloudOff className="w-3 h-3" />
                </span>
              )}
              {item.kind === 'overlay' && (
                <span className="absolute bottom-0 inset-x-0 bg-black/50 text-white text-[10px] py-0.5">
                  overlay
                </span>
              )}
            </button>
          ))}
        </div>
      )}

      {zoomed?.url && (
        <div
          className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4"
          onClick={() => setZoomed(null)}
          role="dialog"
          aria-modal="true"
          aria-label="Wound photograph"
        >
          <button
            className="absolute top-4 right-4 p-2 rounded-full bg-white/10 hover:bg-white/20 text-white"
            onClick={() => setZoomed(null)}
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
          <figure className="max-w-full max-h-full" onClick={e => e.stopPropagation()}>
            <img src={zoomed.url} alt="Wound photograph" className="max-w-full max-h-[80vh] object-contain rounded-lg" />
            <figcaption className="text-center text-white/70 text-xs mt-2">
              {zoomed.capturedAt ? new Date(zoomed.capturedAt).toLocaleString() : ''}
              {!zoomed.uploaded && ' · not yet uploaded'}
            </figcaption>
          </figure>
        </div>
      )}
    </div>
  );
};

export default WoundImageGallery;

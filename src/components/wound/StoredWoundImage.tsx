/**
 * A wound photograph from whatever was stored for it.
 *
 * Records keep a logical reference — "/wound-images?ref=abc" — not a URL a
 * browser can load: as an <img src> that path hits the app's own router (and
 * carries no auth), so the picture never appeared. This resolves the ref the
 * same way the gallery does: the local copy first, the server otherwise.
 * Anything that is already a real URL (blob:, data:, http) is used as is.
 */
import { useEffect, useState } from 'react';
import { ImageOff, Loader2 } from 'lucide-react';
import { resolveWoundImageUrl } from '../../services/woundImageSync';

export function refFromStoredUrl(stored?: string | null): string | null {
  if (!stored) return null;
  if (/^(blob:|data:|https?:)/.test(stored)) return null;
  const m = /[?&]ref=([^&]+)/.exec(stored);
  if (m) return decodeURIComponent(m[1]);
  return stored.startsWith('/') ? null : stored;
}

export function StoredWoundImage({ src, alt, className }: { src?: string | null; alt: string; className?: string }) {
  const [url, setUrl] = useState<string | null>(null);
  const [state, setState] = useState<'loading' | 'ok' | 'missing'>('loading');

  useEffect(() => {
    let cancelled = false;
    if (!src) { setState('missing'); return; }
    const ref = refFromStoredUrl(src);
    if (!ref) { setUrl(src); setState('ok'); return; }
    setState('loading');
    resolveWoundImageUrl(ref)
      .then((u) => { if (!cancelled) { setUrl(u); setState(u ? 'ok' : 'missing'); } })
      .catch(() => { if (!cancelled) setState('missing'); });
    return () => { cancelled = true; };
  }, [src]);

  if (state === 'loading') {
    return <div className={`flex items-center justify-center bg-gray-50 text-gray-400 ${className || ''}`} style={{ minHeight: 120 }}><Loader2 className="w-5 h-5 animate-spin" /></div>;
  }
  if (state === 'missing' || !url) {
    return (
      <div className={`flex flex-col items-center justify-center gap-1 bg-gray-50 text-gray-400 text-xs ${className || ''}`} style={{ minHeight: 120 }}>
        <ImageOff className="w-5 h-5" /> Photograph not available on this device yet
      </div>
    );
  }
  return <img src={url} alt={alt} className={className} loading="lazy" />;
}

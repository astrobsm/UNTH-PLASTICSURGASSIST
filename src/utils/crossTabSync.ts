// Lightweight cross-tab / cross-device-on-same-browser sync using BroadcastChannel.
// "Realtime-lite": when one tab mutates a resource, sibling tabs are notified to
// refresh. Falls back to a no-op where BroadcastChannel is unavailable.
import { useEffect, useRef } from 'react';

type Handler = () => void;

const channels = new Map<string, BroadcastChannel>();

function getChannel(name: string): BroadcastChannel | null {
  if (typeof BroadcastChannel === 'undefined') return null;
  let ch = channels.get(name);
  if (!ch) {
    ch = new BroadcastChannel(`psa:${name}`);
    channels.set(name, ch);
  }
  return ch;
}

/** Notify other tabs that a resource changed. */
export function broadcastChange(channel: string): void {
  try {
    getChannel(channel)?.postMessage({ t: Date.now() });
  } catch {
    /* ignore */
  }
}

/**
 * Subscribe to cross-tab change notifications for a channel.
 * The handler is debounced so a burst of messages triggers a single refresh.
 */
export function useCrossTabRefresh(channel: string, handler: Handler): void {
  const handlerRef = useRef(handler);
  handlerRef.current = handler;

  useEffect(() => {
    const ch = getChannel(channel);
    if (!ch) return;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const onMessage = () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => handlerRef.current(), 300);
    };
    ch.addEventListener('message', onMessage);
    return () => {
      ch.removeEventListener('message', onMessage);
      if (timer) clearTimeout(timer);
    };
  }, [channel]);
}

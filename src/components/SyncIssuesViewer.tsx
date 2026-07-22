/**
 * SyncIssuesViewer
 *
 * Shows the "dead-letter" queue — changes that failed to sync repeatedly and
 * were preserved rather than silently discarded. This is what the recurring
 * "N changes could not sync and need attention" toast refers to.
 *
 * For each item it shows what it was (table + action), when it failed, and the
 * server's actual error, so the cause is visible rather than opaque. It offers
 * Retry (re-queue with a fresh attempt budget) and Dismiss (drop for good).
 * Available from the Settings page, mirroring SyncConflictsViewer.
 */

import { useCallback, useEffect, useState } from 'react';
import { AlertTriangle, ChevronDown, ChevronUp, RefreshCw, RotateCw, Trash2 } from 'lucide-react';
import { db } from '../db/database';
import { syncService } from '../db/syncService';
import toast from 'react-hot-toast';

interface DeadLetterItem {
  id: number;
  table: string;
  action: string;
  local_id?: number;
  data?: any;
  created_at?: string;
  failed_at?: string;
  retries?: number;
  last_error?: string;
}

export function SyncIssuesViewer() {
  const [items, setItems] = useState<DeadLetterItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [expandedId, setExpandedId] = useState<number | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const rows = await syncService.getDeadLetterItems(200);
      setItems(rows as DeadLetterItem[]);
      // Viewing the list is acknowledgement: reset the toast baseline so the
      // "N couldn't sync" alert only fires again on a genuinely NEW failure.
      try { localStorage.setItem('sync_dead_letter_seen', String(rows.length)); } catch { /* ignore */ }
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const retryAll = async () => {
    setBusy(true);
    try {
      const n = await syncService.retryAllDeadLetter();
      toast.success(n > 0 ? `Re-queued ${n} change${n === 1 ? '' : 's'} for sync.` : 'Nothing to retry.');
      await load();
    } catch (e: any) {
      toast.error(e?.message || 'Retry failed.');
    } finally {
      setBusy(false);
    }
  };

  const retryOne = async (id: number) => {
    setBusy(true);
    try {
      const ok = await syncService.retryDeadLetterItem(id);
      if (ok) { toast.success('Re-queued for sync.'); await load(); }
      else toast.error('Could not re-queue this item.');
    } finally {
      setBusy(false);
    }
  };

  const dismissOne = async (id: number) => {
    setBusy(true);
    try {
      await db.table('sync_dead_letter').delete(id);
      await load();
    } finally {
      setBusy(false);
    }
  };

  const dismissAll = async () => {
    if (!confirm('Dismiss all failed changes? They will not be synced and cannot be recovered.')) return;
    setBusy(true);
    try {
      await db.table('sync_dead_letter').clear();
      await load();
      toast.success('Cleared.');
    } finally {
      setBusy(false);
    }
  };

  // Nothing failed — render a quiet all-clear so admins can confirm health.
  if (!loading && items.length === 0) {
    return (
      <div className="bg-white rounded-lg border p-4 mt-6">
        <h3 className="font-semibold text-gray-800 flex items-center gap-2">
          <RefreshCw className="w-4 h-4 text-green-600" /> Sync issues
        </h3>
        <p className="text-sm text-gray-500 mt-1">No failed changes. Everything has synced.</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg border border-amber-200 p-4 mt-6">
      <div className="flex items-center justify-between gap-3 mb-3">
        <h3 className="font-semibold text-amber-900 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-amber-600" />
          Sync issues {items.length > 0 && <span className="text-sm font-normal text-amber-700">({items.length})</span>}
        </h3>
        <div className="flex items-center gap-2">
          <button onClick={load} disabled={busy} className="p-2 rounded-lg hover:bg-gray-100 text-gray-500" title="Refresh">
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
          <button onClick={retryAll} disabled={busy || !items.length}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-teal-600 hover:bg-teal-700 disabled:opacity-50 text-white rounded-lg text-sm font-medium">
            <RotateCw className="w-3.5 h-3.5" /> Retry all
          </button>
          <button onClick={dismissAll} disabled={busy || !items.length}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-100 hover:bg-gray-200 disabled:opacity-50 text-gray-700 rounded-lg text-sm font-medium">
            <Trash2 className="w-3.5 h-3.5" /> Dismiss all
          </button>
        </div>
      </div>

      <p className="text-xs text-gray-500 mb-3">
        These changes failed to reach the server after several attempts. “Retry” sends them again (use after the
        underlying problem is fixed, e.g. back online). “Dismiss” drops one permanently.
      </p>

      {loading ? (
        <div className="h-16 bg-gray-50 rounded animate-pulse" />
      ) : (
        <ul className="divide-y">
          {items.map(item => {
            const expanded = expandedId === item.id;
            return (
              <li key={item.id} className="py-2.5">
                <div className="flex items-start justify-between gap-3">
                  <button onClick={() => setExpandedId(expanded ? null : item.id)} className="flex items-start gap-2 text-left min-w-0 flex-1">
                    {expanded ? <ChevronUp className="w-4 h-4 text-gray-400 mt-0.5 shrink-0" /> : <ChevronDown className="w-4 h-4 text-gray-400 mt-0.5 shrink-0" />}
                    <div className="min-w-0">
                      <div className="text-sm font-medium text-gray-800 truncate">
                        <span className="uppercase text-xs text-gray-500 mr-1.5">{item.action}</span>
                        {item.table}
                      </div>
                      <div className="text-xs text-gray-500 truncate">
                        {item.last_error || 'Unknown error'}
                        {item.failed_at ? ` • ${new Date(item.failed_at).toLocaleString()}` : ''}
                      </div>
                    </div>
                  </button>
                  <div className="flex items-center gap-1 shrink-0">
                    <button onClick={() => retryOne(item.id)} disabled={busy} className="p-1.5 rounded hover:bg-teal-50 text-teal-600" title="Retry this item">
                      <RotateCw className="w-4 h-4" />
                    </button>
                    <button onClick={() => dismissOne(item.id)} disabled={busy} className="p-1.5 rounded hover:bg-red-50 text-red-500" title="Dismiss this item">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
                {expanded && (
                  <div className="mt-2 ml-6 space-y-2">
                    <div>
                      <div className="text-xs font-medium text-gray-500">Error</div>
                      <pre className="text-xs bg-red-50 text-red-800 rounded p-2 overflow-x-auto whitespace-pre-wrap">{item.last_error || 'Unknown error'}</pre>
                    </div>
                    <div>
                      <div className="text-xs font-medium text-gray-500">Payload</div>
                      <pre className="text-xs bg-gray-50 text-gray-700 rounded p-2 overflow-x-auto max-h-48">{safeJson(item.data)}</pre>
                    </div>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function safeJson(v: any): string {
  try { return JSON.stringify(v, null, 2); } catch { return String(v); }
}

export default SyncIssuesViewer;

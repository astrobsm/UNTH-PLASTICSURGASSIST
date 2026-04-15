/**
 * SyncConflictsViewer
 *
 * Displays a log of all sync conflicts that occurred during push/pull
 * synchronization.  Available from the Settings page.
 */

import { useState, useEffect } from 'react';
import { AlertTriangle, ChevronDown, ChevronUp, Trash2, RefreshCw } from 'lucide-react';
import { db } from '../db/database';

interface ConflictRecord {
  id: number;
  entity: string;
  entityId: number | string;
  localData: string;
  serverData: string;
  winner: 'local' | 'server';
  resolvedAt: string;
  created_at: string;
}

export function SyncConflictsViewer() {
  const [conflicts, setConflicts] = useState<ConflictRecord[]>([]);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  const loadConflicts = async () => {
    setLoading(true);
    try {
      const rows = await db.table('sync_conflicts')
        .orderBy('id')
        .reverse()
        .limit(100)
        .toArray();
      setConflicts(rows as ConflictRecord[]);
    } catch {
      setConflicts([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadConflicts(); }, []);

  const clearAll = async () => {
    if (!confirm('Clear all conflict logs? This cannot be undone.')) return;
    try {
      await db.table('sync_conflicts').clear();
      setConflicts([]);
    } catch { /* */ }
  };

  if (loading) {
    return <div className="text-sm text-gray-400 py-4 text-center">Loading conflict log…</div>;
  }

  return (
    <div className="bg-white rounded-xl shadow p-4 sm:p-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <AlertTriangle className="w-5 h-5 text-amber-500" />
          <h3 className="text-lg font-semibold text-gray-800">Sync Conflicts Log</h3>
          <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">
            {conflicts.length}
          </span>
        </div>
        <div className="flex gap-2">
          <button onClick={loadConflicts} className="p-1.5 rounded hover:bg-gray-100" title="Refresh">
            <RefreshCw className="w-4 h-4 text-gray-500" />
          </button>
          {conflicts.length > 0 && (
            <button onClick={clearAll} className="p-1.5 rounded hover:bg-red-50" title="Clear all">
              <Trash2 className="w-4 h-4 text-red-400" />
            </button>
          )}
        </div>
      </div>

      {conflicts.length === 0 ? (
        <p className="text-sm text-gray-400 text-center py-6">No sync conflicts recorded.</p>
      ) : (
        <div className="space-y-2 max-h-[50vh] overflow-y-auto">
          {conflicts.map(c => {
            const isExpanded = expandedId === c.id;
            return (
              <div key={c.id} className="border rounded-lg overflow-hidden">
                <button
                  className="w-full flex items-center justify-between px-4 py-3 hover:bg-gray-50 text-left"
                  onClick={() => setExpandedId(isExpanded ? null : c.id)}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <span className={`text-xs font-medium px-2 py-0.5 rounded ${
                      c.winner === 'server' ? 'bg-blue-100 text-blue-700' : 'bg-green-100 text-green-700'
                    }`}>
                      {c.winner === 'server' ? 'Server won' : 'Local won'}
                    </span>
                    <span className="text-sm font-medium text-gray-700 capitalize">{c.entity}</span>
                    <span className="text-xs text-gray-400">#{c.entityId}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-gray-400">
                      {new Date(c.resolvedAt).toLocaleString()}
                    </span>
                    {isExpanded ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
                  </div>
                </button>

                {isExpanded && (
                  <div className="px-4 pb-4 grid grid-cols-1 md:grid-cols-2 gap-3 border-t bg-gray-50">
                    <div>
                      <p className="text-xs font-medium text-gray-500 mt-3 mb-1">Local Data</p>
                      <pre className="text-xs bg-white border rounded p-2 max-h-48 overflow-auto whitespace-pre-wrap break-words">
                        {formatJson(c.localData)}
                      </pre>
                    </div>
                    <div>
                      <p className="text-xs font-medium text-gray-500 mt-3 mb-1">Server Data</p>
                      <pre className="text-xs bg-white border rounded p-2 max-h-48 overflow-auto whitespace-pre-wrap break-words">
                        {formatJson(c.serverData)}
                      </pre>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function formatJson(raw: string): string {
  try {
    return JSON.stringify(JSON.parse(raw), null, 2);
  } catch {
    return raw;
  }
}

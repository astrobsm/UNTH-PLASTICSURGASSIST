/**
 * OfflineSearchModal
 *
 * Global search dialog that queries IndexedDB for patients, admissions,
 * prescriptions, notes, treatment plans, surgeries, labs, and ward rounds.
 * Works fully offline.
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { Search, X, User, BedDouble, Pill, FileText, Activity, Calendar, FlaskConical, ClipboardList } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { offlineSearch, SearchResult } from '../services/offlineSearchService';

const TYPE_META: Record<SearchResult['type'], { icon: typeof User; color: string; label: string }> = {
  patient:        { icon: User,          color: 'text-blue-600 bg-blue-50',    label: 'Patient' },
  admission:      { icon: BedDouble,     color: 'text-emerald-600 bg-emerald-50', label: 'Admission' },
  prescription:   { icon: Pill,          color: 'text-purple-600 bg-purple-50',   label: 'Prescription' },
  progress_note:  { icon: FileText,      color: 'text-amber-600 bg-amber-50',     label: 'Note' },
  treatment_plan: { icon: Activity,      color: 'text-green-600 bg-green-50',     label: 'Plan' },
  surgery:        { icon: Calendar,      color: 'text-red-600 bg-red-50',         label: 'Surgery' },
  ward_round:     { icon: ClipboardList, color: 'text-cyan-600 bg-cyan-50',       label: 'Ward Round' },
  lab:            { icon: FlaskConical,  color: 'text-orange-600 bg-orange-50',   label: 'Lab' },
};

interface OfflineSearchModalProps {
  open: boolean;
  onClose: () => void;
}

export function OfflineSearchModal({ open, onClose }: OfflineSearchModalProps) {
  const navigate = useNavigate();
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();

  // Auto-focus on open
  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 100);
      setQuery('');
      setResults([]);
    }
  }, [open]);

  // Debounced search
  const doSearch = useCallback(async (q: string) => {
    if (q.length < 2) { setResults([]); return; }
    setSearching(true);
    try {
      const r = await offlineSearch(q, { limit: 30 });
      setResults(r);
    } catch {
      setResults([]);
    } finally {
      setSearching(false);
    }
  }, []);

  const handleChange = (value: string) => {
    setQuery(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => doSearch(value), 250);
  };

  // Navigate to result
  const handleSelect = (r: SearchResult) => {
    onClose();
    switch (r.type) {
      case 'patient':
        navigate(`/patients/${r.id}`);
        break;
      case 'admission':
      case 'prescription':
      case 'progress_note':
      case 'treatment_plan':
      case 'surgery':
      case 'ward_round':
      case 'lab':
        if (r.patientId) navigate(`/patients/${r.patientId}`);
        else navigate('/patients');
        break;
    }
  };

  // Close on Escape
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    if (open) window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-start justify-center pt-[10vh] px-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      
      {/* Modal */}
      <div className="relative w-full max-w-lg bg-white rounded-xl shadow-2xl overflow-hidden">
        {/* Search input */}
        <div className="flex items-center border-b px-4 py-3">
          <Search className="w-5 h-5 text-gray-400 mr-3 flex-shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={e => handleChange(e.target.value)}
            placeholder="Search patients, diagnoses, medications…"
            className="flex-1 text-base outline-none placeholder-gray-400"
          />
          {query && (
            <button onClick={() => { setQuery(''); setResults([]); }} className="p-1 text-gray-400 hover:text-gray-600">
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Results */}
        <div className="max-h-[60vh] overflow-y-auto">
          {searching && (
            <div className="py-8 text-center text-gray-400 text-sm">Searching…</div>
          )}

          {!searching && query.length >= 2 && results.length === 0 && (
            <div className="py-8 text-center text-gray-400 text-sm">
              No results found for "{query}"
            </div>
          )}

          {!searching && results.map((r, i) => {
            const meta = TYPE_META[r.type];
            const Icon = meta.icon;
            return (
              <button
                key={`${r.type}-${r.id}-${i}`}
                onClick={() => handleSelect(r)}
                className="w-full flex items-start gap-3 px-4 py-3 hover:bg-gray-50 text-left border-b border-gray-100 last:border-0 transition-colors"
              >
                <div className={`mt-0.5 p-1.5 rounded-lg ${meta.color}`}>
                  <Icon className="w-4 h-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">{r.title}</p>
                  <p className="text-xs text-gray-500 truncate">{r.subtitle}</p>
                </div>
                <span className="text-[10px] font-medium text-gray-400 uppercase mt-1 flex-shrink-0">
                  {meta.label}
                </span>
              </button>
            );
          })}
        </div>

        {/* Footer */}
        <div className="border-t bg-gray-50 px-4 py-2 flex items-center justify-between text-xs text-gray-400">
          <span>
            {!navigator.onLine ? '📴 Offline — searching local data' : '🔍 Searching local cache'}
          </span>
          <kbd className="px-1.5 py-0.5 rounded border text-[10px]">ESC</kbd>
        </div>
      </div>
    </div>
  );
}

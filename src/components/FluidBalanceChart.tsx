import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Droplets, Plus, Trash2, Camera, RefreshCw, ChevronDown, ChevronUp, Download } from 'lucide-react';
import toast from 'react-hot-toast';
import { apiClient } from '../services/apiClient';
import { ocrService } from '../services/ocrService';

interface FluidEntry {
  id?: number;
  patient_id: number | string;
  hospital_number?: string;
  chart_date: string;
  recorded_at: string;
  entry_type: 'input' | 'output';
  fluid_type: string;
  volume_ml: number;
  route?: string;
  notes?: string;
  recorded_by?: string;
}

interface FluidBalanceChartProps {
  patientId: string;
  hospitalNumber: string;
  userName: string;
}

const INPUT_TYPES = [
  { label: 'Oral Fluids', value: 'oral_fluids', route: 'Oral' },
  { label: 'IV Fluids', value: 'iv_fluids', route: 'IV' },
  { label: 'IV Medications', value: 'iv_medications', route: 'IV' },
  { label: 'Blood Products', value: 'blood_products', route: 'IV' },
  { label: 'NG Tube Feed', value: 'ng_feed', route: 'NG' },
  { label: 'Other Input', value: 'other_input', route: 'Other' },
];

const OUTPUT_TYPES = [
  { label: 'Urine', value: 'urine' },
  { label: 'Drain Output', value: 'drain' },
  { label: 'NG Aspirate', value: 'ng_aspirate' },
  { label: 'Vomitus', value: 'vomitus' },
  { label: 'Stool', value: 'stool' },
  { label: 'Blood Loss', value: 'blood_loss' },
  { label: 'Other Output', value: 'other_output' },
];

const FluidBalanceChart: React.FC<FluidBalanceChartProps> = ({ patientId, hospitalNumber, userName }) => {
  const [entries, setEntries] = useState<FluidEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [chartDate, setChartDate] = useState(new Date().toISOString().split('T')[0]);
  const [showAddInput, setShowAddInput] = useState(false);
  const [showAddOutput, setShowAddOutput] = useState(false);
  const [showOCR, setShowOCR] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [newEntry, setNewEntry] = useState<Partial<FluidEntry>>({ entry_type: 'input', volume_ml: 0 });
  const [expandedSection, setExpandedSection] = useState<'input' | 'output' | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const loadEntries = useCallback(async () => {
    setLoading(true);
    try {
      const data = await apiClient.get(`/fluid-balance?patientId=${patientId}&chartDate=${chartDate}`);
      setEntries(data?.entries || []);
    } catch {
      // Try local storage fallback
      const stored = localStorage.getItem(`fluid_balance_${patientId}_${chartDate}`);
      if (stored) setEntries(JSON.parse(stored));
    } finally {
      setLoading(false);
    }
  }, [patientId, chartDate]);

  useEffect(() => { loadEntries(); }, [loadEntries]);

  const addEntry = async (type: 'input' | 'output') => {
    if (!newEntry.fluid_type || !newEntry.volume_ml) {
      toast.error('Please select fluid type and enter volume');
      return;
    }
    try {
      const entry: Partial<FluidEntry> = {
        patient_id: patientId,
        hospital_number: hospitalNumber,
        chart_date: chartDate,
        recorded_at: new Date().toISOString(),
        entry_type: type,
        fluid_type: newEntry.fluid_type,
        volume_ml: newEntry.volume_ml,
        route: newEntry.route || undefined,
        notes: newEntry.notes || undefined,
        recorded_by: userName,
      };
      await apiClient.post('/fluid-balance', entry);
      toast.success(`${type === 'input' ? 'Input' : 'Output'} added`);
      setNewEntry({ entry_type: type, volume_ml: 0 });
      setShowAddInput(false);
      setShowAddOutput(false);
      await loadEntries();
    } catch {
      toast.error('Failed to save entry');
    }
  };

  const deleteEntry = async (entryId: number) => {
    if (!confirm('Delete this fluid entry?')) return;
    try {
      await apiClient.delete(`/fluid-balance/${entryId}`);
      toast.success('Entry deleted');
      await loadEntries();
    } catch {
      toast.error('Failed to delete entry');
    }
  };

  // OCR scan handler
  const handleOCRScan = async (file: File) => {
    setScanning(true);
    try {
      const result = await ocrService.extractText(file, 'fluid_chart' as any);
      const text = result?.text || '';
      const parsed = parseFluidChartOCR(text);
      if (parsed.length === 0) {
        toast.error('Could not extract fluid entries from the scanned document');
        return;
      }
      // Bulk save parsed entries
      let saved = 0;
      for (const entry of parsed) {
        try {
          await apiClient.post('/fluid-balance', {
            ...entry,
            patient_id: patientId,
            hospital_number: hospitalNumber,
            chart_date: chartDate,
            recorded_by: `${userName} (OCR)`,
          });
          saved++;
        } catch { /* skip failed entries */ }
      }
      toast.success(`Saved ${saved} of ${parsed.length} fluid entries from OCR`);
      await loadEntries();
    } catch (err: any) {
      toast.error(err.message || 'OCR scan failed');
    } finally {
      setScanning(false);
      setShowOCR(false);
    }
  };

  // Parse fluid chart from OCR text
  const parseFluidChartOCR = (text: string): Partial<FluidEntry>[] => {
    const entries: Partial<FluidEntry>[] = [];
    const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 3);

    for (const line of lines) {
      // Look for patterns like: "9:00am Oral 200ml" or "IV NS 500 ml" or "Urine 300ml"
      const volumeMatch = line.match(/(\d{2,5})\s*(?:ml|mls|cc)/i);
      if (!volumeMatch) continue;
      const volume = parseInt(volumeMatch[1]);
      if (volume <= 0 || volume > 5000) continue;

      // Determine if input or output
      const isOutput = /urine|drain|aspirate|vomit|stool|blood\s*loss|output/i.test(line);
      const isInput = /oral|iv|saline|dextrose|ringer|blood|feed|input|fluid/i.test(line);

      if (!isOutput && !isInput) continue;

      // Extract time if present
      const timeMatch = line.match(/(\d{1,2}(?:[:.]\d{2})?)\s*(am|pm)?/i);
      const time = timeMatch ? (timeMatch[1] + (timeMatch[2] || '')).trim() : '';

      // Determine fluid type
      let fluidType = 'unknown';
      if (isOutput) {
        if (/urine/i.test(line)) fluidType = 'urine';
        else if (/drain/i.test(line)) fluidType = 'drain';
        else if (/aspirate|ng/i.test(line)) fluidType = 'ng_aspirate';
        else if (/vomit/i.test(line)) fluidType = 'vomitus';
        else if (/stool/i.test(line)) fluidType = 'stool';
        else if (/blood/i.test(line)) fluidType = 'blood_loss';
        else fluidType = 'other_output';
      } else {
        if (/oral/i.test(line)) fluidType = 'oral_fluids';
        else if (/iv|saline|dextrose|ringer|NS|D5|RL/i.test(line)) fluidType = 'iv_fluids';
        else if (/blood/i.test(line)) fluidType = 'blood_products';
        else if (/ng|feed/i.test(line)) fluidType = 'ng_feed';
        else fluidType = 'other_input';
      }

      entries.push({
        entry_type: isOutput ? 'output' : 'input',
        fluid_type: fluidType,
        volume_ml: volume,
        recorded_at: time ? `${chartDate}T${time}` : new Date().toISOString(),
        notes: line.substring(0, 100),
      });
    }

    return entries;
  };

  const inputEntries = entries.filter(e => e.entry_type === 'input');
  const outputEntries = entries.filter(e => e.entry_type === 'output');
  const totalInput = inputEntries.reduce((sum, e) => sum + (e.volume_ml || 0), 0);
  const totalOutput = outputEntries.reduce((sum, e) => sum + (e.volume_ml || 0), 0);
  const balance = totalInput - totalOutput;

  const getFluidLabel = (type: string) => {
    const input = INPUT_TYPES.find(t => t.value === type);
    if (input) return input.label;
    const output = OUTPUT_TYPES.find(t => t.value === type);
    if (output) return output.label;
    return type.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
  };

  const formatTime = (d: string) => {
    try { return new Date(d).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }); }
    catch { return ''; }
  };

  return (
    <div className="space-y-4">
      {/* Header with date picker and actions */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <Droplets className="w-5 h-5 text-blue-600" />
            <h3 className="text-lg font-semibold text-gray-900">Fluid Input/Output Chart</h3>
          </div>
          <div className="flex items-center gap-2">
            <input
              type="date"
              value={chartDate}
              onChange={e => setChartDate(e.target.value)}
              className="border rounded px-2 py-1.5 text-sm"
              aria-label="Chart date"
            />
            <button onClick={() => loadEntries()} className="p-1.5 text-gray-500 hover:text-blue-600 rounded-lg" title="Refresh">
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
            <button
              onClick={() => setShowOCR(true)}
              className="flex items-center gap-1 px-3 py-1.5 bg-purple-600 text-white text-sm rounded-lg hover:bg-purple-700"
              title="Scan fluid chart"
            >
              <Camera className="w-4 h-4" /> Scan Chart
            </button>
          </div>
        </div>

        {/* Summary bar */}
        <div className="mt-3 grid grid-cols-3 gap-3">
          <div className="bg-blue-50 rounded-lg p-3 text-center">
            <p className="text-xs text-blue-600 font-medium">Total Input</p>
            <p className="text-xl font-bold text-blue-700">{totalInput} <span className="text-xs">ml</span></p>
          </div>
          <div className="bg-amber-50 rounded-lg p-3 text-center">
            <p className="text-xs text-amber-600 font-medium">Total Output</p>
            <p className="text-xl font-bold text-amber-700">{totalOutput} <span className="text-xs">ml</span></p>
          </div>
          <div className={`rounded-lg p-3 text-center ${balance >= 0 ? 'bg-green-50' : 'bg-red-50'}`}>
            <p className={`text-xs font-medium ${balance >= 0 ? 'text-green-600' : 'text-red-600'}`}>Balance</p>
            <p className={`text-xl font-bold ${balance >= 0 ? 'text-green-700' : 'text-red-700'}`}>
              {balance >= 0 ? '+' : ''}{balance} <span className="text-xs">ml</span>
            </p>
          </div>
        </div>
      </div>

      {/* Input Section */}
      <div className="bg-white rounded-lg shadow-sm border border-blue-200">
        <div
          className="px-4 py-3 flex items-center justify-between cursor-pointer hover:bg-blue-50"
          onClick={() => setExpandedSection(expandedSection === 'input' ? null : 'input')}
        >
          <h4 className="font-semibold text-blue-800 flex items-center gap-2">
            <span className="w-3 h-3 bg-blue-500 rounded-full" /> Fluid Input ({inputEntries.length} entries - {totalInput} ml)
          </h4>
          {expandedSection === 'input' ? <ChevronUp className="w-4 h-4 text-blue-500" /> : <ChevronDown className="w-4 h-4 text-blue-500" />}
        </div>
        {expandedSection === 'input' && (
          <div className="border-t border-blue-100 p-3 space-y-2">
            {inputEntries.length === 0 && <p className="text-sm text-gray-400 italic">No input entries recorded</p>}
            {inputEntries.map(entry => (
              <div key={entry.id} className="flex items-center justify-between bg-blue-50 rounded-lg px-3 py-2">
                <div>
                  <span className="text-sm font-medium text-blue-800">{getFluidLabel(entry.fluid_type)}</span>
                  {entry.route && <span className="ml-2 text-xs text-gray-500">({entry.route})</span>}
                  <span className="ml-2 text-xs text-gray-400">{formatTime(entry.recorded_at)}</span>
                  {entry.notes && <p className="text-xs text-gray-500 mt-0.5">{entry.notes}</p>}
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-bold text-blue-700">{entry.volume_ml} ml</span>
                  <button onClick={() => entry.id && deleteEntry(entry.id)} className="p-1 text-red-400 hover:text-red-600" title="Delete entry">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
            {/* Add input form */}
            {showAddInput ? (
              <div className="bg-gray-50 rounded-lg p-3 space-y-2 border">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  <select
                    value={newEntry.fluid_type || ''}
                    onChange={e => {
                      const selected = INPUT_TYPES.find(t => t.value === e.target.value);
                      setNewEntry(p => ({ ...p, fluid_type: e.target.value, route: selected?.route || '' }));
                    }}
                    className="border rounded px-2 py-1.5 text-sm"
                    aria-label="Fluid type"
                  >
                    <option value="">Select type...</option>
                    {INPUT_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                  </select>
                  <input
                    type="number"
                    placeholder="Volume (ml)"
                    value={newEntry.volume_ml || ''}
                    onChange={e => setNewEntry(p => ({ ...p, volume_ml: parseInt(e.target.value) || 0 }))}
                    className="border rounded px-2 py-1.5 text-sm"
                    min="0"
                    max="5000"
                    aria-label="Volume in ml"
                  />
                  <input
                    placeholder="Route"
                    value={newEntry.route || ''}
                    onChange={e => setNewEntry(p => ({ ...p, route: e.target.value }))}
                    className="border rounded px-2 py-1.5 text-sm"
                    aria-label="Route"
                  />
                  <input
                    placeholder="Notes (optional)"
                    value={newEntry.notes || ''}
                    onChange={e => setNewEntry(p => ({ ...p, notes: e.target.value }))}
                    className="border rounded px-2 py-1.5 text-sm"
                    aria-label="Notes"
                  />
                </div>
                <div className="flex gap-2">
                  <button onClick={() => addEntry('input')} className="px-3 py-1.5 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700">Save</button>
                  <button onClick={() => { setShowAddInput(false); setNewEntry({ entry_type: 'input', volume_ml: 0 }); }} className="px-3 py-1.5 border text-sm rounded-lg hover:bg-gray-100">Cancel</button>
                </div>
              </div>
            ) : (
              <button onClick={() => { setShowAddInput(true); setNewEntry({ entry_type: 'input', volume_ml: 0 }); }} className="flex items-center gap-1 px-3 py-1.5 text-blue-600 text-sm hover:bg-blue-50 rounded-lg">
                <Plus className="w-4 h-4" /> Add Input
              </button>
            )}
          </div>
        )}
      </div>

      {/* Output Section */}
      <div className="bg-white rounded-lg shadow-sm border border-amber-200">
        <div
          className="px-4 py-3 flex items-center justify-between cursor-pointer hover:bg-amber-50"
          onClick={() => setExpandedSection(expandedSection === 'output' ? null : 'output')}
        >
          <h4 className="font-semibold text-amber-800 flex items-center gap-2">
            <span className="w-3 h-3 bg-amber-500 rounded-full" /> Fluid Output ({outputEntries.length} entries - {totalOutput} ml)
          </h4>
          {expandedSection === 'output' ? <ChevronUp className="w-4 h-4 text-amber-500" /> : <ChevronDown className="w-4 h-4 text-amber-500" />}
        </div>
        {expandedSection === 'output' && (
          <div className="border-t border-amber-100 p-3 space-y-2">
            {outputEntries.length === 0 && <p className="text-sm text-gray-400 italic">No output entries recorded</p>}
            {outputEntries.map(entry => (
              <div key={entry.id} className="flex items-center justify-between bg-amber-50 rounded-lg px-3 py-2">
                <div>
                  <span className="text-sm font-medium text-amber-800">{getFluidLabel(entry.fluid_type)}</span>
                  <span className="ml-2 text-xs text-gray-400">{formatTime(entry.recorded_at)}</span>
                  {entry.notes && <p className="text-xs text-gray-500 mt-0.5">{entry.notes}</p>}
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-bold text-amber-700">{entry.volume_ml} ml</span>
                  <button onClick={() => entry.id && deleteEntry(entry.id)} className="p-1 text-red-400 hover:text-red-600" title="Delete entry">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
            {/* Add output form */}
            {showAddOutput ? (
              <div className="bg-gray-50 rounded-lg p-3 space-y-2 border">
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  <select
                    value={newEntry.fluid_type || ''}
                    onChange={e => setNewEntry(p => ({ ...p, fluid_type: e.target.value }))}
                    className="border rounded px-2 py-1.5 text-sm"
                    aria-label="Output type"
                  >
                    <option value="">Select type...</option>
                    {OUTPUT_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                  </select>
                  <input
                    type="number"
                    placeholder="Volume (ml)"
                    value={newEntry.volume_ml || ''}
                    onChange={e => setNewEntry(p => ({ ...p, volume_ml: parseInt(e.target.value) || 0 }))}
                    className="border rounded px-2 py-1.5 text-sm"
                    min="0"
                    max="5000"
                    aria-label="Volume in ml"
                  />
                  <input
                    placeholder="Notes (optional)"
                    value={newEntry.notes || ''}
                    onChange={e => setNewEntry(p => ({ ...p, notes: e.target.value }))}
                    className="border rounded px-2 py-1.5 text-sm"
                    aria-label="Notes"
                  />
                </div>
                <div className="flex gap-2">
                  <button onClick={() => addEntry('output')} className="px-3 py-1.5 bg-amber-600 text-white text-sm rounded-lg hover:bg-amber-700">Save</button>
                  <button onClick={() => { setShowAddOutput(false); setNewEntry({ entry_type: 'output', volume_ml: 0 }); }} className="px-3 py-1.5 border text-sm rounded-lg hover:bg-gray-100">Cancel</button>
                </div>
              </div>
            ) : (
              <button onClick={() => { setShowAddOutput(true); setNewEntry({ entry_type: 'output', volume_ml: 0 }); }} className="flex items-center gap-1 px-3 py-1.5 text-amber-600 text-sm hover:bg-amber-50 rounded-lg">
                <Plus className="w-4 h-4" /> Add Output
              </button>
            )}
          </div>
        )}
      </div>

      {/* OCR Scan Modal */}
      {showOCR && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl max-w-md w-full p-6 space-y-4">
            <h3 className="text-lg font-semibold">Scan Fluid Chart</h3>
            <p className="text-sm text-gray-500">
              Take a photo or upload an image of a fluid input/output chart. 
              The system will extract entries automatically.
            </p>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              onChange={e => { if (e.target.files?.[0]) handleOCRScan(e.target.files[0]); }}
              className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-purple-50 file:text-purple-700 hover:file:bg-purple-100"
              aria-label="Upload fluid chart image"
            />
            {scanning && (
              <div className="flex items-center gap-2 text-purple-600">
                <RefreshCw className="w-4 h-4 animate-spin" />
                <span className="text-sm">Scanning and extracting fluid entries...</span>
              </div>
            )}
            <div className="flex justify-end gap-2">
              <button onClick={() => setShowOCR(false)} className="px-4 py-2 border rounded-lg text-sm hover:bg-gray-50" disabled={scanning}>Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default FluidBalanceChart;

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
      const result = await ocrService.extractText(file, 'fluid_chart');
      const text = result?.text || '';
      console.log('📋 Fluid chart OCR raw text:', text);
      const parsed = parseFluidChartOCR(text);
      console.log('📋 Fluid chart parsed entries:', parsed);
      if (parsed.length === 0) {
        toast.error('Could not extract fluid entries from the scanned document. Try a clearer photo.');
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

  // Parse fluid chart from OCR text — robust parser for low-confidence OCR
  const parseFluidChartOCR = (text: string): Partial<FluidEntry>[] => {
    const entries: Partial<FluidEntry>[] = [];
    const rawLines = text.split('\n').map(l => l.trim()).filter(l => l.length > 1);

    // ── Phase 1: Detect INPUT / OUTPUT sections from headers ──
    // Hospital fluid charts typically have clear section headers
    type Section = 'input' | 'output' | 'unknown';
    let currentSection: Section = 'unknown';

    // Header patterns for section detection
    const inputHeaderRe  = /\b(input|intake|infusion|iv\s*fluid|intravenous|fluid\s*in)\b/i;
    const outputHeaderRe = /\b(output|urine|drain|excret|fluid\s*out)\b/i;

    // Output keywords on a line
    const outputKw = /urine|drain|aspirat|vomit|emesis|stool|faec|blood\s*loss|ngt?\s*asp|ng\s*aspirat|output|catheter|colostomy/i;
    // Input keywords on a line
    const inputKw  = /oral|iv\b|i\.?v\.?|saline|dextrose|ringer|hartmann|gelofusin|blood|feed|ngt?\s*feed|ng\s*feed|infus|drip|input|water|juice|tea|soup|milk/i;

    // Time pattern: "09:00", "9:00am", "9.00", "0900", "9am"
    const timeRe = /\b(\d{1,2})[.:h](\d{2})?\s*(am|pm|hrs?)?\b/i;
    // Bare hour: "9am" or "21hrs"
    const bareHourRe = /\b(\d{1,2})\s*(am|pm|hrs?)\b/i;

    // Extract all numbers from a string (for volume detection)
    const numbersInStr = (s: string): number[] => {
      const matches = s.match(/\d+/g);
      return matches ? matches.map(Number).filter(n => n > 0) : [];
    };

    // Classify a volume — fluid volumes are typically 5–5000 ml
    const isPlausibleVolume = (n: number) => n >= 5 && n <= 5000;

    // Extract time string from a line
    const extractTime = (line: string): string => {
      // Full time: "09:00", "9.30am"
      const m = line.match(timeRe);
      if (m) {
        let h = parseInt(m[1]);
        const min = m[2] || '00';
        const ampm = (m[3] || '').toLowerCase();
        if (ampm === 'pm' && h < 12) h += 12;
        if (ampm === 'am' && h === 12) h = 0;
        return `${String(h).padStart(2, '0')}:${min}`;
      }
      // Bare hour: "9am"
      const b = line.match(bareHourRe);
      if (b) {
        let h = parseInt(b[1]);
        const ampm = (b[2] || '').toLowerCase();
        if (ampm === 'pm' && h < 12) h += 12;
        if (ampm === 'am' && h === 12) h = 0;
        return `${String(h).padStart(2, '0')}:00`;
      }
      // Military time: "0900"
      const mil = line.match(/\b([01]\d|2[0-3])([0-5]\d)\b/);
      if (mil) return `${mil[1]}:${mil[2]}`;
      return '';
    };

    // Classify fluid type from keywords
    const classifyFluid = (line: string, section: Section): { type: Section; fluid: string } => {
      // Output types
      if (/urine|catheter/i.test(line))     return { type: 'output', fluid: 'urine' };
      if (/drain/i.test(line))              return { type: 'output', fluid: 'drain' };
      if (/aspirat|ngt?\s*asp/i.test(line)) return { type: 'output', fluid: 'ng_aspirate' };
      if (/vomit|emesis/i.test(line))       return { type: 'output', fluid: 'vomitus' };
      if (/stool|faec/i.test(line))         return { type: 'output', fluid: 'stool' };
      if (/colostomy/i.test(line))          return { type: 'output', fluid: 'other_output' };
      if (/blood\s*loss/i.test(line))       return { type: 'output', fluid: 'blood_loss' };

      // Input types
      if (/oral|water|juice|tea|soup|milk/i.test(line)) return { type: 'input', fluid: 'oral_fluids' };
      if (/iv\b|i\.?v\.?|saline|dextrose|ringer|hartmann|gelofusin|NS|D5|RL|normal\s*sal/i.test(line))
                                                         return { type: 'input', fluid: 'iv_fluids' };
      if (/blood(?!\s*loss)/i.test(line))                return { type: 'input', fluid: 'blood_products' };
      if (/ngt?\s*feed|ng\s*feed|feed/i.test(line))     return { type: 'input', fluid: 'ng_feed' };
      if (/infus|drip/i.test(line))                      return { type: 'input', fluid: 'iv_fluids' };

      // Fall back to current section
      if (section === 'input')  return { type: 'input',  fluid: 'other_input' };
      if (section === 'output') return { type: 'output', fluid: 'other_output' };
      return { type: 'unknown', fluid: 'other_input' };
    };

    // ── Phase 2: First pass — pick up section headers and tagged lines ──
    for (let i = 0; i < rawLines.length; i++) {
      const line = rawLines[i];

      // Section header detection
      if (inputHeaderRe.test(line) && !outputHeaderRe.test(line) && numbersInStr(line).filter(isPlausibleVolume).length === 0) {
        currentSection = 'input';
        continue;
      }
      if (outputHeaderRe.test(line) && !inputHeaderRe.test(line) && numbersInStr(line).filter(isPlausibleVolume).length === 0) {
        currentSection = 'output';
        continue;
      }

      // Find plausible volumes on this line
      // First try with explicit units: "200ml", "500 mls", "300cc"
      const withUnitsMatches = [...line.matchAll(/(\d{1,5})\s*(?:ml|mls|cc|mL)/gi)];
      let volumes: number[] = withUnitsMatches.map(m => parseInt(m[1])).filter(isPlausibleVolume);

      // If no explicit units found, try bare numbers (common in tabular charts)
      if (volumes.length === 0) {
        volumes = numbersInStr(line).filter(isPlausibleVolume);
        // Filter out numbers that look like times (e.g. 900, 1200 could be 09:00, 12:00)
        // Keep only if the line also has keywords or we're in a known section
        const hasKeyword = outputKw.test(line) || inputKw.test(line);
        if (!hasKeyword && currentSection === 'unknown') {
          // Without keywords and no section context, bare numbers are ambiguous — skip
          volumes = [];
        }
      }

      if (volumes.length === 0) continue;

      // Determine type/fluid from keywords or section context
      const hasOutputKw = outputKw.test(line);
      const hasInputKw  = inputKw.test(line);
      const classification = classifyFluid(line, currentSection);

      // If line has BOTH input and output keywords (could be a table row with both columns)
      // try to split: first volume = input, second = output (or vice versa based on layout)
      if (hasOutputKw && hasInputKw && volumes.length >= 2) {
        const time = extractTime(line);
        entries.push({
          entry_type: 'input',
          fluid_type: 'other_input',
          volume_ml: volumes[0],
          recorded_at: time ? `${chartDate}T${time}:00` : new Date().toISOString(),
          notes: `[OCR] ${line.substring(0, 100)}`,
        });
        entries.push({
          entry_type: 'output',
          fluid_type: 'other_output',
          volume_ml: volumes[1],
          recorded_at: time ? `${chartDate}T${time}:00` : new Date().toISOString(),
          notes: `[OCR] ${line.substring(0, 100)}`,
        });
        continue;
      }

      // Resolve entry type
      let entryType: 'input' | 'output';
      if (hasOutputKw && !hasInputKw) {
        entryType = 'output';
      } else if (hasInputKw && !hasOutputKw) {
        entryType = 'input';
      } else if (classification.type !== 'unknown') {
        entryType = classification.type;
      } else {
        // Default to input (more common in fluid charts)
        entryType = 'input';
      }

      const time = extractTime(line);

      // Each volume on the line becomes an entry
      for (const vol of volumes) {
        entries.push({
          entry_type: entryType,
          fluid_type: classification.fluid,
          volume_ml: vol,
          recorded_at: time ? `${chartDate}T${time}:00` : new Date().toISOString(),
          notes: `[OCR] ${line.substring(0, 100)}`,
        });
      }
    }

    // ── Phase 3: Fallback — if nothing parsed, try extracting any numbers ≥10 ──
    if (entries.length === 0) {
      // Last resort: grab every plausible volume from the entire text
      // Use surrounding context (the nearest keyword above/below) for classification
      for (let i = 0; i < rawLines.length; i++) {
        const line = rawLines[i];
        const volumes = numbersInStr(line).filter(n => n >= 10 && n <= 5000);
        if (volumes.length === 0) continue;

        // Look for keywords in nearby lines (±3)
        let nearbyText = '';
        for (let j = Math.max(0, i - 3); j <= Math.min(rawLines.length - 1, i + 3); j++) {
          nearbyText += ' ' + rawLines[j];
        }

        const nearOutput = outputKw.test(nearbyText);
        const nearInput  = inputKw.test(nearbyText);
        const classification = classifyFluid(nearbyText, nearOutput && !nearInput ? 'output' : 'input');
        const time = extractTime(line);

        for (const vol of volumes) {
          entries.push({
            entry_type: classification.type !== 'unknown' ? classification.type : 'input',
            fluid_type: classification.fluid,
            volume_ml: vol,
            recorded_at: time ? `${chartDate}T${time}:00` : new Date().toISOString(),
            notes: `[OCR fallback] ${line.substring(0, 100)}`,
          });
        }
      }
    }

    // Deduplicate entries with same volume+time+type (OCR may pick up duplicates)
    const seen = new Set<string>();
    return entries.filter(e => {
      const key = `${e.entry_type}-${e.fluid_type}-${e.volume_ml}-${e.recorded_at}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
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

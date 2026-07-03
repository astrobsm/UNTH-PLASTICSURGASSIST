// Bulk patient registration + admission page, plus an admin-only patient-data
// reset "danger zone". Reachable at /bulk-admit.
import { useState } from 'react';
import { UserPlus, Trash2, Plus, Loader2, CheckCircle, XCircle, AlertTriangle, ShieldAlert, Send, Download, Upload } from 'lucide-react';
import toast from 'react-hot-toast';
import { apiClient } from '../services/apiClient';
import { useAuthStore } from '../store/authStore';

interface Row {
  first_name: string;
  last_name: string;
  hospital_number: string;
  date_of_birth: string;
  gender: string;
  phone: string;
  ward: string;
  bed_number: string;
  admitting_diagnosis: string;
  consultant: string;
  admit: boolean;
}

const emptyRow = (): Row => ({
  first_name: '', last_name: '', hospital_number: '', date_of_birth: '', gender: '',
  phone: '', ward: '', bed_number: '', admitting_diagnosis: '', consultant: '', admit: true,
});

// CSV column order for template download + import mapping.
const CSV_COLUMNS: { key: keyof Row; label: string }[] = [
  { key: 'first_name', label: 'first_name' },
  { key: 'last_name', label: 'last_name' },
  { key: 'hospital_number', label: 'hospital_number' },
  { key: 'date_of_birth', label: 'date_of_birth' },
  { key: 'gender', label: 'gender' },
  { key: 'phone', label: 'phone' },
  { key: 'ward', label: 'ward' },
  { key: 'bed_number', label: 'bed_number' },
  { key: 'admitting_diagnosis', label: 'admitting_diagnosis' },
  { key: 'consultant', label: 'consultant' },
  { key: 'admit', label: 'admit' },
];

// Minimal CSV parser handling quoted fields, escaped quotes ("") and commas/newlines within quotes.
function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let field = '';
  let row: string[] = [];
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; }
        else inQuotes = false;
      } else field += c;
    } else if (c === '"') {
      inQuotes = true;
    } else if (c === ',') {
      row.push(field); field = '';
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++;
      row.push(field); field = '';
      if (row.some(v => v.trim() !== '')) rows.push(row);
      row = [];
    } else field += c;
  }
  if (field !== '' || row.length) { row.push(field); if (row.some(v => v.trim() !== '')) rows.push(row); }
  return rows;
}

const CONFIRM_PHRASE = 'DELETE ALL PATIENTS';
const SUPER_ADMIN_ROLES = ['admin', 'super_admin'];

export default function BulkAdmitPage() {
  const { user } = useAuthStore();
  const isSuperAdmin = user ? SUPER_ADMIN_ROLES.includes(user.role) : false;

  const [rows, setRows] = useState<Row[]>([emptyRow(), emptyRow(), emptyRow()]);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<any>(null);

  // Reset danger-zone state
  const [confirmText, setConfirmText] = useState('');
  const [resetting, setResetting] = useState(false);
  const [dischargingAll, setDischargingAll] = useState(false);

  const updateRow = (i: number, patch: Partial<Row>) =>
    setRows(rs => rs.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));
  const addRow = () => setRows(rs => [...rs, emptyRow()]);
  const removeRow = (i: number) => setRows(rs => rs.filter((_, idx) => idx !== i));

  const downloadTemplate = () => {
    const header = CSV_COLUMNS.map(c => c.label).join(',');
    const example = 'John,Doe,,1990-05-12,Male,08030000000,Male Ward,12,Post-burn contracture,Dr. Okwesili,true';
    const csv = `${header}\n${example}\n`;
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'bulk-patient-template.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = ''; // allow re-importing the same file
    if (!file) return;
    try {
      const text = await file.text();
      const parsed = parseCsv(text);
      if (parsed.length === 0) { toast.error('CSV is empty.'); return; }

      // Map header row to Row keys (case-insensitive, tolerant of order/aliases)
      const header = parsed[0].map(h => h.trim().toLowerCase());
      const looksLikeHeader = header.some(h => ['first_name', 'firstname', 'last_name', 'lastname', 'surname'].includes(h));
      const dataRows = looksLikeHeader ? parsed.slice(1) : parsed;

      const aliasToKey: Record<string, keyof Row> = {
        first_name: 'first_name', firstname: 'first_name', 'first name': 'first_name',
        last_name: 'last_name', lastname: 'last_name', surname: 'last_name', 'last name': 'last_name',
        hospital_number: 'hospital_number', hospitalnumber: 'hospital_number', 'hospital number': 'hospital_number', hosp_no: 'hospital_number',
        date_of_birth: 'date_of_birth', dob: 'date_of_birth', 'date of birth': 'date_of_birth',
        gender: 'gender', sex: 'gender',
        phone: 'phone', 'phone number': 'phone',
        ward: 'ward',
        bed_number: 'bed_number', bed: 'bed_number', 'bed number': 'bed_number',
        admitting_diagnosis: 'admitting_diagnosis', diagnosis: 'admitting_diagnosis', 'admitting diagnosis': 'admitting_diagnosis',
        consultant: 'consultant',
        admit: 'admit',
      };
      // If no header, fall back to positional CSV_COLUMNS order
      const colKeys: (keyof Row | null)[] = looksLikeHeader
        ? header.map(h => aliasToKey[h] ?? null)
        : CSV_COLUMNS.map(c => c.key);

      const imported: Row[] = dataRows.map(cells => {
        const r = emptyRow();
        colKeys.forEach((key, idx) => {
          if (!key) return;
          const val = (cells[idx] ?? '').trim();
          if (key === 'admit') r.admit = !/^(false|no|0|n)$/i.test(val);
          else (r as any)[key] = val;
        });
        return r;
      }).filter(r => r.first_name.trim() && r.last_name.trim());

      if (imported.length === 0) { toast.error('No valid rows (need first & last name).'); return; }
      setRows(imported);
      toast.success(`Imported ${imported.length} patient row(s). Review then submit.`);
    } catch (err: any) {
      toast.error(err.message || 'Failed to read CSV');
    }
  };

  const submit = async () => {
    const filled = rows.filter(r => r.first_name.trim() && r.last_name.trim());
    if (filled.length === 0) {
      toast.error('Enter at least one patient with first and last name.');
      return;
    }
    setSubmitting(true);
    setResult(null);
    try {
      const data = await apiClient.request('/bulk-admit', {
        method: 'POST',
        body: JSON.stringify({ rows: filled }),
      });
      setResult(data);
      toast.success(data.message || 'Batch processed.');
      // Clear successfully processed rows, keep failures for correction
      if (data.failed?.length) {
        const failedIdx = new Set(data.failed.map((f: any) => f.index));
        setRows(filled.filter((_, idx) => failedIdx.has(idx)));
      } else {
        setRows([emptyRow(), emptyRow(), emptyRow()]);
      }
    } catch (err: any) {
      toast.error(err.message || 'Bulk submit failed');
    } finally {
      setSubmitting(false);
    }
  };

  const dischargeAll = async () => {
    if (!confirm('Discharge ALL currently admitted patients? This marks every active admission as discharged.')) return;
    setDischargingAll(true);
    try {
      const data = await apiClient.request('/admin-reset', {
        method: 'POST',
        body: JSON.stringify({ action: 'discharge-all' }),
      });
      toast.success(`Discharged ${data.dischargedCount} admission(s).`);
    } catch (err: any) {
      toast.error(err.message || 'Discharge-all failed');
    } finally {
      setDischargingAll(false);
    }
  };

  const wipePatients = async () => {
    if (confirmText !== CONFIRM_PHRASE) {
      toast.error(`Type exactly: ${CONFIRM_PHRASE}`);
      return;
    }
    if (!confirm('FINAL WARNING: This permanently deletes ALL patients and ALL their clinical records. This cannot be undone. Continue?')) return;
    setResetting(true);
    try {
      const data = await apiClient.request('/admin-reset', {
        method: 'POST',
        body: JSON.stringify({ action: 'wipe-patients', confirm: confirmText }),
      });
      toast.success(data.message || 'Patient records wiped.');
      setConfirmText('');
    } catch (err: any) {
      toast.error(err.message || 'Wipe failed');
    } finally {
      setResetting(false);
    }
  };

  return (
    <div className="max-w-6xl mx-auto px-4 py-6 space-y-6">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold text-clinical-dark flex items-center gap-2">
          <UserPlus className="h-6 w-6 text-primary-600" />
          Bulk Patient Registration &amp; Admission
        </h1>
        <p className="text-sm text-gray-500 mt-1">
          Add a row per patient, or import a CSV. On submit, each patient is registered and (if ticked) admitted in one step.
        </p>
        <div className="flex flex-wrap items-center gap-2 mt-3">
          <button onClick={downloadTemplate}
            className="flex items-center gap-1.5 px-3 py-2 text-sm bg-white border border-gray-300 rounded-lg hover:bg-gray-50">
            <Download className="h-4 w-4" /> Download CSV template
          </button>
          <label className="flex items-center gap-1.5 px-3 py-2 text-sm bg-white border border-gray-300 rounded-lg hover:bg-gray-50 cursor-pointer">
            <Upload className="h-4 w-4" /> Import CSV
            <input type="file" accept=".csv,text/csv" onChange={handleImport} className="hidden" />
          </label>
        </div>
      </div>

      {/* Danger zone — super admins only */}
      {isSuperAdmin && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 space-y-3">
          <div className="flex items-center gap-2 text-red-700 font-semibold">
            <ShieldAlert className="h-5 w-5" /> Danger Zone — Patient Data Reset
          </div>
          <p className="text-sm text-red-600">
            Use this to start a clean record. Deletion is <strong>permanent and irreversible</strong> and removes
            every patient plus all their clinical data (admissions, ward rounds, prescriptions, labs, wound care,
            treatment plans, surgeries, assessments, etc.). Ensure you have a database backup first.
          </p>
          <div className="flex flex-wrap items-end gap-3">
            <button onClick={dischargeAll} disabled={dischargingAll}
              className="px-3 py-2 bg-amber-100 text-amber-800 rounded-lg text-sm font-medium hover:bg-amber-200 disabled:opacity-50 flex items-center gap-1.5">
              {dischargingAll ? <Loader2 className="h-4 w-4 animate-spin" /> : <AlertTriangle className="h-4 w-4" />}
              Discharge all admitted patients
            </button>
            <div className="flex items-end gap-2">
              <div>
                <label className="block text-xs text-red-700 mb-1">Type <code className="font-mono">{CONFIRM_PHRASE}</code> to enable delete</label>
                <input value={confirmText} onChange={e => setConfirmText(e.target.value)}
                  placeholder={CONFIRM_PHRASE}
                  className="px-3 py-2 border border-red-300 rounded-lg text-sm w-56 focus:ring-red-500 focus:border-red-500" />
              </div>
              <button onClick={wipePatients} disabled={resetting || confirmText !== CONFIRM_PHRASE}
                className="px-3 py-2 bg-red-600 text-white rounded-lg text-sm font-semibold hover:bg-red-700 disabled:opacity-40 flex items-center gap-1.5">
                {resetting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                Permanently delete all patients
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Bulk entry grid */}
      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-600">
              <tr>
                <th className="px-2 py-2 text-left font-medium">First name*</th>
                <th className="px-2 py-2 text-left font-medium">Last name*</th>
                <th className="px-2 py-2 text-left font-medium">Hosp. no.</th>
                <th className="px-2 py-2 text-left font-medium">DOB</th>
                <th className="px-2 py-2 text-left font-medium">Sex</th>
                <th className="px-2 py-2 text-left font-medium">Phone</th>
                <th className="px-2 py-2 text-left font-medium">Ward</th>
                <th className="px-2 py-2 text-left font-medium">Bed</th>
                <th className="px-2 py-2 text-left font-medium">Admitting diagnosis</th>
                <th className="px-2 py-2 text-left font-medium">Consultant</th>
                <th className="px-2 py-2 text-center font-medium">Admit</th>
                <th className="px-2 py-2"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {rows.map((r, i) => (
                <tr key={i}>
                  <td className="px-1 py-1"><input value={r.first_name} onChange={e => updateRow(i, { first_name: e.target.value })} className="w-28 px-2 py-1.5 border border-gray-200 rounded" /></td>
                  <td className="px-1 py-1"><input value={r.last_name} onChange={e => updateRow(i, { last_name: e.target.value })} className="w-28 px-2 py-1.5 border border-gray-200 rounded" /></td>
                  <td className="px-1 py-1"><input value={r.hospital_number} onChange={e => updateRow(i, { hospital_number: e.target.value })} placeholder="auto" className="w-28 px-2 py-1.5 border border-gray-200 rounded" /></td>
                  <td className="px-1 py-1"><input type="date" value={r.date_of_birth} onChange={e => updateRow(i, { date_of_birth: e.target.value })} className="w-36 px-2 py-1.5 border border-gray-200 rounded" /></td>
                  <td className="px-1 py-1">
                    <select value={r.gender} onChange={e => updateRow(i, { gender: e.target.value })} className="w-20 px-1 py-1.5 border border-gray-200 rounded">
                      <option value="">—</option>
                      <option value="Male">M</option>
                      <option value="Female">F</option>
                    </select>
                  </td>
                  <td className="px-1 py-1"><input value={r.phone} onChange={e => updateRow(i, { phone: e.target.value })} className="w-28 px-2 py-1.5 border border-gray-200 rounded" /></td>
                  <td className="px-1 py-1"><input value={r.ward} onChange={e => updateRow(i, { ward: e.target.value })} className="w-24 px-2 py-1.5 border border-gray-200 rounded" /></td>
                  <td className="px-1 py-1"><input value={r.bed_number} onChange={e => updateRow(i, { bed_number: e.target.value })} className="w-16 px-2 py-1.5 border border-gray-200 rounded" /></td>
                  <td className="px-1 py-1"><input value={r.admitting_diagnosis} onChange={e => updateRow(i, { admitting_diagnosis: e.target.value })} className="w-44 px-2 py-1.5 border border-gray-200 rounded" /></td>
                  <td className="px-1 py-1"><input value={r.consultant} onChange={e => updateRow(i, { consultant: e.target.value })} className="w-28 px-2 py-1.5 border border-gray-200 rounded" /></td>
                  <td className="px-1 py-1 text-center"><input type="checkbox" checked={r.admit} onChange={e => updateRow(i, { admit: e.target.checked })} className="h-4 w-4" /></td>
                  <td className="px-1 py-1 text-center">
                    <button onClick={() => removeRow(i)} className="text-red-500 hover:text-red-700 p-1" title="Remove row"><Trash2 className="h-4 w-4" /></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="flex items-center justify-between px-3 py-3 bg-gray-50 border-t border-gray-100">
          <button onClick={addRow} className="flex items-center gap-1.5 px-3 py-2 text-sm bg-white border border-gray-300 rounded-lg hover:bg-gray-50">
            <Plus className="h-4 w-4" /> Add row
          </button>
          <button onClick={submit} disabled={submitting}
            className="flex items-center gap-1.5 px-4 py-2 text-sm font-semibold bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50">
            {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            Register &amp; admit all
          </button>
        </div>
      </div>

      {/* Results */}
      {result && (
        <div className="bg-white border border-gray-200 rounded-lg p-4 space-y-3">
          <p className="text-sm font-semibold text-gray-800">{result.message}</p>
          {result.success?.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-green-700 mb-1">Processed</p>
              <div className="space-y-1">
                {result.success.map((s: any, i: number) => (
                  <div key={i} className="flex items-center gap-2 text-xs text-gray-600">
                    <CheckCircle className="h-3.5 w-3.5 text-green-600" />
                    {s.name} · {s.hospitalNumber} · {s.admitted ? 'registered + admitted' : 'registered'}
                    {s.admitError && <span className="text-amber-600">(admit failed: {s.admitError})</span>}
                  </div>
                ))}
              </div>
            </div>
          )}
          {result.failed?.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-red-700 mb-1">Failed (left in the form to correct)</p>
              <div className="space-y-1">
                {result.failed.map((f: any, i: number) => (
                  <div key={i} className="flex items-center gap-2 text-xs text-red-600">
                    <XCircle className="h-3.5 w-3.5" /> {f.name}: {f.error}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

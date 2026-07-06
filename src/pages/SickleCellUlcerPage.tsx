// Sickle Cell Ulcer Care — optimization scoring + wound-care planning.
// Scores the key domains that must be optimized for a sickle-cell leg ulcer to
// heal (hydration, nutrition, haematologic status, pain, infection, wound bed,
// offloading, perfusion, comorbidity) and recommends the unit's wound-care
// agents: WoundClex Solution, Hera Wound Gel, and Wound Care HoneyGauze.
import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import {
  Droplet, Activity, HeartPulse, Stethoscope as Bandage, Save, Loader2, CheckCircle, AlertTriangle,
  ClipboardList, History, Trash2, User,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { useSelectedPatient } from '../hooks/useSelectedPatient';
import { useAuthStore } from '../store/authStore';
import { sickleCellUlcerService, SickleCellUlcerAssessment } from '../services/sickleCellUlcerService';

interface Domain {
  key: string;
  label: string;
  icon: React.ElementType;
  options: string[]; // index === points (0..2)
}

const DOMAINS: Domain[] = [
  { key: 'hydration', label: 'Hydration status', icon: Droplet,
    options: ['Dehydrated / poor intake', 'Adequate oral hydration', 'Optimal (IV + oral maintenance)'] },
  { key: 'nutrition', label: 'Nutritional optimization', icon: Activity,
    options: ['Poor (low albumin, weight loss)', 'Adequate intake', 'Optimized (high-protein + zinc / vit C / folate)'] },
  { key: 'haematologic', label: 'Haematologic / anaemia control', icon: HeartPulse,
    options: ['Hb <7 g/dL, untreated', 'Hb 7–9 or on hydroxyurea', 'Hb ≥9, hydroxyurea + folate ± transfusion'] },
  { key: 'pain', label: 'Pain control', icon: HeartPulse,
    options: ['Uncontrolled', 'Partially controlled', 'Well controlled'] },
  { key: 'infection', label: 'Infection control', icon: AlertTriangle,
    options: ['Active infection', 'Treated / improving', 'No infection (clean)'] },
  { key: 'woundBed', label: 'Wound bed status', icon: Bandage,
    options: ['Necrotic / heavy slough', 'Mixed / granulating', 'Clean granulating (ready)'] },
  { key: 'offloading', label: 'Offloading / compression / elevation', icon: Activity,
    options: ['None', 'Partial / intermittent', 'Consistent'] },
  { key: 'perfusion', label: 'Perfusion / vaso-occlusion risk', icon: HeartPulse,
    options: ['Poor (crisis-prone / smoker)', 'Moderate', 'Good (stable, non-smoker)'] },
  { key: 'comorbidity', label: 'Comorbidity & glycaemic control', icon: Activity,
    options: ['Poor', 'Fair', 'Optimized'] },
];

const MAX_SCORE = DOMAINS.length * 2;

const WOUND_AGENTS = [
  { name: 'WoundClex Solution', role: 'Antiseptic cleansing / irrigation',
    guidance: 'Use at EVERY dressing change to cleanse and irrigate the ulcer. Essential for all wounds, especially contaminated or sloughy beds.' },
  { name: 'Hera Wound Gel', role: 'Hydrogel — moisture & autolytic debridement',
    guidance: 'Apply to maintain a moist wound bed, rehydrate dry slough and promote granulation. Best on clean or granulating beds.' },
  { name: 'Wound Care HoneyGauze', role: 'Medical honey gauze — antibacterial / debriding',
    guidance: 'Apply to sloughy, infected or malodorous wounds for antibacterial action, deodorizing and autolytic debridement.' },
];

function readinessFor(total: number): { label: string; color: string; advice: string } {
  const pct = (total / MAX_SCORE) * 100;
  if (pct < 45) return { label: 'Poor optimization', color: 'red', advice: 'Optimize systemic factors before advanced wound care / surgery.' };
  if (pct < 78) return { label: 'Moderate optimization', color: 'amber', advice: 'Continue optimizing; proceed with conservative wound care.' };
  return { label: 'Well optimized', color: 'green', advice: 'Proceed to definitive wound care / closure (e.g. grafting) as indicated.' };
}

export default function SickleCellUlcerPage() {
  const { patient } = useSelectedPatient();
  const { user } = useAuthStore();

  const [scores, setScores] = useState<Record<string, number>>(
    Object.fromEntries(DOMAINS.map(d => [d.key, 1]))
  );
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [history, setHistory] = useState<SickleCellUlcerAssessment[]>([]);

  const total = DOMAINS.reduce((s, d) => s + (scores[d.key] ?? 0), 0);
  const readiness = readinessFor(total);
  const woundBedScore = scores.woundBed ?? 1;
  const infectionScore = scores.infection ?? 1;

  // Recommended wound-care agents based on the wound bed + infection status
  const recommendedAgents = (() => {
    const rec = new Set<string>(['WoundClex Solution']); // always cleanse
    if (woundBedScore === 0 || infectionScore === 0) rec.add('Wound Care HoneyGauze');
    if (woundBedScore >= 1) rec.add('Hera Wound Gel');
    return rec;
  })();

  // Auto-generated optimization recommendations from low-scoring domains
  const recommendations = (() => {
    const recs: string[] = [];
    if ((scores.hydration ?? 0) < 2) recs.push('Optimize hydration — encourage oral fluids ± IV maintenance to reduce sickling.');
    if ((scores.nutrition ?? 0) < 2) recs.push('Nutrition: high-protein diet + zinc, vitamin C and folate supplementation; dietitian review.');
    if ((scores.haematologic ?? 0) < 2) recs.push('Haematology: ensure folic acid + hydroxyurea; consider transfusion to target Hb if severe anaemia.');
    if ((scores.pain ?? 0) < 2) recs.push('Escalate multimodal analgesia for adequate pain control.');
    if ((scores.infection ?? 0) < 2) recs.push('Treat infection — wound swab M/C/S and targeted antibiotics; debride slough.');
    if ((scores.woundBed ?? 0) < 2) recs.push('Prepare wound bed — debride slough/necrosis; maintain moist healing environment.');
    if ((scores.offloading ?? 0) < 2) recs.push('Limb elevation and compression/offloading to reduce oedema and venous stasis.');
    if ((scores.perfusion ?? 0) < 2) recs.push('Reduce vaso-occlusion risk — smoking cessation, warmth, avoid dehydration/hypoxia.');
    if ((scores.comorbidity ?? 0) < 2) recs.push('Optimize comorbidities and glycaemic control.');
    recs.push(`Wound-care agents: ${Array.from(recommendedAgents).join(', ')} (per wound-bed status).`);
    return recs;
  })();

  const loadHistory = useCallback(async () => {
    if (!patient?.id) return;
    setHistory(await sickleCellUlcerService.getAssessments(patient.id));
  }, [patient?.id]);

  useEffect(() => { loadHistory(); }, [loadHistory]);

  const save = async () => {
    if (!patient?.id) { toast.error('Select a patient first.'); return; }
    setSaving(true);
    try {
      await sickleCellUlcerService.saveAssessment({
        patient_id: String(patient.id),
        patient_name: (patient as any).full_name || `${patient.first_name || ''} ${patient.last_name || ''}`.trim(),
        hospital_number: (patient as any).hospital_number,
        scores,
        total_score: total,
        max_score: MAX_SCORE,
        readiness: readiness.label,
        wound_bed: DOMAINS.find(d => d.key === 'woundBed')?.options[woundBedScore],
        wound_agents: Array.from(recommendedAgents),
        recommendations,
        notes,
        assessed_by_name: user?.name,
      });
      toast.success('Sickle cell ulcer assessment saved.');
      setNotes('');
      loadHistory();
    } catch (e: any) {
      toast.error(e.message || 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  const colorCls = (c: string, kind: 'bg' | 'text' | 'border') =>
    ({ red: { bg: 'bg-red-100', text: 'text-red-700', border: 'border-red-300' },
       amber: { bg: 'bg-amber-100', text: 'text-amber-700', border: 'border-amber-300' },
       green: { bg: 'bg-green-100', text: 'text-green-700', border: 'border-green-300' } } as any)[c][kind];

  if (!patient) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-10 text-center">
        <Bandage className="h-10 w-10 mx-auto mb-3 text-red-400" />
        <h1 className="text-xl font-bold text-clinical-dark mb-2">Sickle Cell Ulcer Care</h1>
        <p className="text-gray-500 mb-4">Select a patient first, then open this module from their action menu.</p>
        <Link to="/patients" className="px-4 py-2 bg-primary-600 text-white rounded-lg text-sm">Go to Patients</Link>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-6 space-y-5">
      <div className="flex items-center gap-2">
        <Bandage className="h-6 w-6 text-red-600" />
        <h1 className="text-xl sm:text-2xl font-bold text-clinical-dark">Sickle Cell Ulcer Care</h1>
      </div>

      {/* Patient banner */}
      <div className="bg-white border border-gray-200 rounded-lg px-4 py-3 flex items-center gap-2 text-sm">
        <User className="h-4 w-4 text-gray-400" />
        <span className="font-medium text-gray-800">
          {(patient as any).full_name || `${patient.first_name || ''} ${patient.last_name || ''}`.trim()}
        </span>
        {(patient as any).hospital_number && <span className="text-gray-500">· {(patient as any).hospital_number}</span>}
      </div>

      {/* Score banner */}
      <div className={`rounded-lg border ${colorCls(readiness.color, 'border')} ${colorCls(readiness.color, 'bg')} p-4`}>
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div>
            <p className="text-xs text-gray-600">Optimization readiness score</p>
            <p className={`text-2xl font-bold ${colorCls(readiness.color, 'text')}`}>{total}<span className="text-base text-gray-400">/{MAX_SCORE}</span></p>
          </div>
          <div className="text-right">
            <span className={`inline-block px-3 py-1 rounded-full text-sm font-semibold ${colorCls(readiness.color, 'bg')} ${colorCls(readiness.color, 'text')}`}>
              {readiness.label}
            </span>
            <p className="text-xs text-gray-600 mt-1 max-w-xs">{readiness.advice}</p>
          </div>
        </div>
      </div>

      {/* Scoring domains */}
      <div className="bg-white border border-gray-200 rounded-lg p-4 space-y-4">
        <h2 className="font-semibold text-gray-800 flex items-center gap-2"><ClipboardList className="h-4 w-4 text-primary-600" /> Optimization assessment</h2>
        {DOMAINS.map(d => {
          const Icon = d.icon;
          return (
            <div key={d.key} className="border-b border-gray-100 pb-3 last:border-0 last:pb-0">
              <p className="text-sm font-medium text-gray-700 mb-1.5 flex items-center gap-1.5"><Icon className="h-3.5 w-3.5 text-gray-400" /> {d.label}</p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-1.5">
                {d.options.map((opt, pts) => (
                  <button key={pts} onClick={() => setScores(s => ({ ...s, [d.key]: pts }))}
                    className={`text-left text-xs px-2.5 py-2 rounded-md border transition-colors ${
                      scores[d.key] === pts
                        ? pts === 2 ? 'bg-green-50 border-green-400 text-green-800'
                          : pts === 1 ? 'bg-amber-50 border-amber-400 text-amber-800'
                          : 'bg-red-50 border-red-400 text-red-800'
                        : 'bg-gray-50 border-gray-200 text-gray-600 hover:bg-gray-100'
                    }`}>
                    {opt}
                  </button>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {/* Wound-care agents */}
      <div className="bg-white border border-gray-200 rounded-lg p-4 space-y-3">
        <h2 className="font-semibold text-gray-800 flex items-center gap-2"><Bandage className="h-4 w-4 text-red-600" /> Wound-care agents</h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {WOUND_AGENTS.map(a => {
            const rec = recommendedAgents.has(a.name);
            return (
              <div key={a.name} className={`rounded-lg border p-3 ${rec ? 'border-green-400 bg-green-50' : 'border-gray-200 bg-gray-50'}`}>
                <div className="flex items-center justify-between mb-1">
                  <p className="font-semibold text-sm text-gray-800">{a.name}</p>
                  {rec && <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-green-600 text-white font-medium">Recommended</span>}
                </div>
                <p className="text-[11px] font-medium text-gray-500 mb-1">{a.role}</p>
                <p className="text-xs text-gray-600">{a.guidance}</p>
              </div>
            );
          })}
        </div>
      </div>

      {/* Recommendations */}
      <div className="bg-white border border-gray-200 rounded-lg p-4">
        <h2 className="font-semibold text-gray-800 mb-2 flex items-center gap-2"><CheckCircle className="h-4 w-4 text-green-600" /> Recommended optimizations</h2>
        <ul className="space-y-1.5">
          {recommendations.map((r, i) => (
            <li key={i} className="text-sm text-gray-700 flex items-start gap-2">
              <span className="text-green-600 mt-0.5">•</span> {r}
            </li>
          ))}
        </ul>
      </div>

      {/* Notes + save */}
      <div className="bg-white border border-gray-200 rounded-lg p-4 space-y-3">
        <label className="block text-sm font-medium text-gray-700">Clinical notes (optional)</label>
        <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={3}
          className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-primary-500 focus:border-primary-500"
          placeholder="Ulcer site/size, exudate, plan, review date…" />
        <div className="flex justify-end">
          <button onClick={save} disabled={saving}
            className="flex items-center gap-1.5 px-4 py-2 bg-primary-600 text-white rounded-lg text-sm font-semibold hover:bg-primary-700 disabled:opacity-50">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Save assessment
          </button>
        </div>
      </div>

      {/* History */}
      {history.length > 0 && (
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <h2 className="font-semibold text-gray-800 mb-2 flex items-center gap-2"><History className="h-4 w-4 text-gray-500" /> Previous assessments</h2>
          <div className="space-y-2">
            {history.map(h => (
              <div key={h.id} className="flex items-center justify-between border-b border-gray-100 pb-2 last:border-0">
                <div className="text-sm">
                  <span className="font-medium text-gray-800">{h.total_score}/{h.max_score}</span>
                  <span className="text-gray-500"> · {h.readiness}</span>
                  <p className="text-xs text-gray-400">
                    {h.created_at ? new Date(h.created_at).toLocaleString() : ''}{h.assessed_by_name ? ` · ${h.assessed_by_name}` : ''}
                  </p>
                </div>
                <button onClick={async () => { if (h.id && confirm('Delete this assessment?')) { await sickleCellUlcerService.deleteAssessment(h.id); loadHistory(); } }}
                  className="text-red-400 hover:text-red-600 p-1"><Trash2 className="h-4 w-4" /></button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

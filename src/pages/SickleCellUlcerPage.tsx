// Sickle Cell Ulcer Care — WHO-aligned composite assessment for chronic leg
// ulcers in sickle cell disease. Scores crisis frequency, pain, haemoglobin,
// hydration and nutritional status; computes wound-healing nutritional needs;
// generates nutrition / hydration / lifestyle protocols and a 7-day Nigerian
// meal plan. Recommends the unit's wound-care agents.
import { useState, useEffect, useCallback, useMemo } from 'react';
import { Link } from 'react-router-dom';
import {
  Droplet, HeartPulse, Stethoscope as Bandage, Save, Loader2,
  ClipboardList, History, Trash2, User, Utensils, RefreshCw,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { useSelectedPatient } from '../hooks/useSelectedPatient';
import { useAuthStore } from '../store/authStore';
import { sickleCellUlcerService, SickleCellUlcerAssessment } from '../services/sickleCellUlcerService';
import { generateMealPlan, DayPlan } from '../data/nigerianFoods';

type Band = { label: string; points: number };

// ── WHO-aligned severity bands (higher points = greater severity) ───────────
function crisisBand(n: number): Band {
  if (n <= 0) return { label: 'None (0/yr)', points: 0 };
  if (n <= 2) return { label: 'Mild (1–2/yr)', points: 1 };
  if (n <= 5) return { label: 'Moderate (3–5/yr)', points: 2 };
  return { label: 'Severe (≥6/yr)', points: 3 };
}
function painBand(v: number): Band {
  if (v <= 3) return { label: `Mild (${v}/10)`, points: 0 };
  if (v <= 6) return { label: `Moderate (${v}/10)`, points: 1 };
  return { label: `Severe (${v}/10)`, points: 2 };
}
function hbBand(hb: number): Band {
  if (!hb) return { label: 'Not entered', points: 0 };
  if (hb >= 10) return { label: `Acceptable (${hb} g/dL)`, points: 0 };
  if (hb >= 8) return { label: `Mild anaemia (${hb} g/dL)`, points: 1 };
  if (hb >= 6) return { label: `Moderate anaemia (${hb} g/dL)`, points: 2 };
  return { label: `Severe anaemia (${hb} g/dL)`, points: 3 };
}
const HYDRATION_OPTS = [
  { value: 'well', label: 'Well hydrated', points: 0 },
  { value: 'mild', label: 'Mild dehydration', points: 1 },
  { value: 'moderate', label: 'Moderate dehydration', points: 2 },
  { value: 'severe', label: 'Severe dehydration', points: 3 },
];
const WEIGHTLOSS_OPTS = [
  { value: 'none', label: 'No recent weight loss', points: 0 },
  { value: 'mild', label: '<5% in 3–6 months', points: 1 },
  { value: 'moderate', label: '5–10% in 3–6 months', points: 2 },
  { value: 'severe', label: '>10% in 3–6 months', points: 3 },
];
const WOUND_BEDS = ['Necrotic / heavy slough', 'Mixed / granulating', 'Clean granulating (ready)'];

const WOUND_AGENTS = [
  { name: 'WoundClex Solution', role: 'Antiseptic cleansing / irrigation',
    guidance: 'Use at EVERY dressing change to cleanse and irrigate. Essential for all ulcers, especially contaminated/sloughy beds.' },
  { name: 'Hera Wound Gel', role: 'Hydrogel — moisture & autolytic debridement',
    guidance: 'Maintains a moist bed, rehydrates dry slough and promotes granulation. Best on clean/granulating beds.' },
  { name: 'Wound Care HoneyGauze', role: 'Medical honey gauze — antibacterial / debriding',
    guidance: 'For sloughy, infected or malodorous wounds: antibacterial, deodorizing and autolytic debridement.' },
];

function bmiClass(bmi: number): { label: string; points: number } {
  if (!bmi) return { label: '—', points: 0 };
  if (bmi < 16) return { label: 'Severe undernutrition', points: 3 };
  if (bmi < 18.5) return { label: 'Underweight', points: 2 };
  if (bmi < 25) return { label: 'Normal', points: 0 };
  if (bmi < 30) return { label: 'Overweight', points: 0 };
  return { label: 'Obese', points: 1 };
}

export default function SickleCellUlcerPage() {
  const { patient } = useSelectedPatient();
  const { user } = useAuthStore();

  // Anthropometry + clinical inputs
  const [weight, setWeight] = useState('');
  const [height, setHeight] = useState('');
  const [crises, setCrises] = useState('');
  const [pain, setPain] = useState(0);
  const [hb, setHb] = useState('');
  const [hydration, setHydration] = useState('well');
  const [weightLoss, setWeightLoss] = useState('none');
  const [albumin, setAlbumin] = useState('');
  const [woundBed, setWoundBed] = useState(1);
  const [infection, setInfection] = useState(false);
  const [largeWound, setLargeWound] = useState(false);
  const [notes, setNotes] = useState('');

  const [mealPlan, setMealPlan] = useState<DayPlan[]>([]);
  const [saving, setSaving] = useState(false);
  const [history, setHistory] = useState<SickleCellUlcerAssessment[]>([]);

  const w = parseFloat(weight) || 0;
  const h = parseFloat(height) || 0;
  const bmi = w && h ? +(w / Math.pow(h / 100, 2)).toFixed(1) : 0;
  const bmiInfo = bmiClass(bmi);

  // ── Composite severity score ──
  const bands = useMemo(() => {
    const nStatus = Math.max(
      bmiInfo.points,
      WEIGHTLOSS_OPTS.find(o => o.value === weightLoss)?.points || 0,
      albumin && parseFloat(albumin) < 30 ? 2 : 0
    );
    return {
      crisis: crisisBand(parseFloat(crises) || 0),
      pain: painBand(pain),
      hb: hbBand(parseFloat(hb) || 0),
      hydration: { label: HYDRATION_OPTS.find(o => o.value === hydration)?.label || '', points: HYDRATION_OPTS.find(o => o.value === hydration)?.points || 0 },
      nutrition: { label: bmi ? `${bmiInfo.label} (BMI ${bmi})` : 'Enter weight & height', points: nStatus },
    };
  }, [crises, pain, hb, hydration, weightLoss, albumin, bmi, bmiInfo.label, bmiInfo.points]);

  const totalSeverity = bands.crisis.points + bands.pain.points + bands.hb.points + bands.hydration.points + bands.nutrition.points;
  const maxSeverity = 3 + 2 + 3 + 3 + 3; // 14
  const severity = totalSeverity <= 3 ? { label: 'Mild', color: 'green' }
    : totalSeverity <= 7 ? { label: 'Moderate', color: 'amber' }
    : { label: 'Severe', color: 'red' };

  // ── Wound-healing nutritional needs (from weight + severity) ──
  const needs = useMemo(() => {
    if (!w) return null;
    const proteinPerKg = (severity.label === 'Severe' || largeWound) ? 2.0 : 1.5;
    const kcal = Math.round(w * 35);
    const protein = Math.round(w * proteinPerKg);
    const fluid = Math.max(3000, Math.round(w * 40));
    return {
      kcal, protein, proteinPerKg, fluid,
      micronutrients: [
        'Vitamin C 500–1000 mg/day (collagen synthesis)',
        'Zinc 15–30 mg/day (epithelialization)',
        'Arginine-rich protein (fish, beans, groundnut)',
        'Folic acid 5 mg/day (erythropoiesis in SCD)',
        'Vitamin A & B-complex (from vegetables/liver)',
        'Avoid routine iron unless proven deficiency (SCD overload risk)',
      ],
    };
  }, [w, severity.label, largeWound]);

  // ── Protocols ──
  const protocols = useMemo(() => {
    const nutrition = needs ? [
      `Energy target ≈ ${needs.kcal} kcal/day (35 kcal/kg).`,
      `Protein target ≈ ${needs.protein} g/day (${needs.proteinPerKg} g/kg) — protein at every meal.`,
      'Small, frequent meals (3 meals + 2–3 snacks); high-protein Nigerian foods (fish, beans, moi moi, eggs, chicken, groundnut).',
      ...needs.micronutrients,
    ] : ['Enter weight to calculate energy and protein targets.'];
    const hydrationP = needs ? [
      `Fluid target ≈ ${needs.fluid} mL/day (~${Math.round(needs.fluid / 250)} cups) unless cardiac/renal restriction.`,
      'Oral fluids through the day; IV fluids during vaso-occlusive crisis.',
      'Increase intake in heat, fever, exercise; monitor urine output/colour.',
      'Limit alcohol and caffeine (diuretic — worsen dehydration/sickling).',
    ] : ['Enter weight to calculate fluid target.'];
    const lifestyle = [
      'Avoid crisis triggers: cold, dehydration, hypoxia, over-exertion, infection.',
      'Stop smoking and alcohol; keep limbs warm.',
      'Leg elevation when resting; graduated compression only if arterial supply adequate (ABPI checked).',
      'Daily wound care with prescribed agents; protect legs from trauma; good foot/leg hygiene.',
      'Adhere to hydroxyurea and folic acid; keep vaccinations and penicillin prophylaxis current.',
      'Adequate rest/sleep and graded exercise as tolerated.',
    ];
    return { nutrition, hydration: hydrationP, lifestyle };
  }, [needs]);

  const recommendedAgents = useMemo(() => {
    const rec = new Set<string>(['WoundClex Solution']);
    if (woundBed === 0 || infection) rec.add('Wound Care HoneyGauze');
    if (woundBed >= 1) rec.add('Hera Wound Gel');
    return rec;
  }, [woundBed, infection]);

  const regenerateMeals = useCallback(() => {
    if (needs) setMealPlan(generateMealPlan(needs.kcal, needs.protein));
  }, [needs]);

  useEffect(() => {
    if (needs) setMealPlan(generateMealPlan(needs.kcal, needs.protein));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [needs?.kcal, needs?.protein]);

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
        scores: {
          crisis: bands.crisis.points, pain: bands.pain.points, hb: bands.hb.points,
          hydration: bands.hydration.points, nutrition: bands.nutrition.points,
        },
        total_score: totalSeverity,
        max_score: maxSeverity,
        readiness: severity.label,
        severity: severity.label,
        wound_bed: WOUND_BEDS[woundBed],
        wound_agents: Array.from(recommendedAgents),
        recommendations: [...protocols.nutrition, ...protocols.hydration, ...protocols.lifestyle],
        clinical: {
          weight_kg: w, height_cm: h, bmi, crises_per_year: parseFloat(crises) || 0,
          pain_vas: pain, hb, hydration, weight_loss: weightLoss, albumin,
          wound_bed: WOUND_BEDS[woundBed], infection, large_wound: largeWound,
        },
        nutrition_needs: needs || {},
        protocols,
        meal_plan: mealPlan,
        notes,
      } as any);
      toast.success('Assessment, protocols and 7-day meal plan saved.');
      loadHistory();
    } catch (e: any) {
      toast.error(e.message || 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  const cc = (c: string, k: 'bg' | 'text' | 'border') =>
    ({ red: { bg: 'bg-red-100', text: 'text-red-700', border: 'border-red-300' },
       amber: { bg: 'bg-amber-100', text: 'text-amber-700', border: 'border-amber-300' },
       green: { bg: 'bg-green-100', text: 'text-green-700', border: 'border-green-300' } } as any)[c][k];

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

  const numInput = 'w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-primary-500 focus:border-primary-500';
  const bandRow = (label: string, b: { label: string; points: number }) => (
    <div className="flex items-center justify-between text-sm py-1">
      <span className="text-gray-600">{label}</span>
      <span className="text-gray-800">{b.label} <span className="text-xs text-gray-400">(+{b.points})</span></span>
    </div>
  );

  return (
    <div className="max-w-4xl mx-auto px-4 py-6 space-y-5">
      <div className="flex items-center gap-2">
        <Bandage className="h-6 w-6 text-red-600" />
        <h1 className="text-xl sm:text-2xl font-bold text-clinical-dark">Sickle Cell Ulcer Care</h1>
      </div>

      <div className="bg-white border border-gray-200 rounded-lg px-4 py-3 flex items-center gap-2 text-sm">
        <User className="h-4 w-4 text-gray-400" />
        <span className="font-medium text-gray-800">
          {(patient as any).full_name || `${patient.first_name || ''} ${patient.last_name || ''}`.trim()}
        </span>
        {(patient as any).hospital_number && <span className="text-gray-500">· {(patient as any).hospital_number}</span>}
      </div>

      {/* Clinical inputs */}
      <div className="bg-white border border-gray-200 rounded-lg p-4 space-y-3">
        <h2 className="font-semibold text-gray-800 flex items-center gap-2"><ClipboardList className="h-4 w-4 text-primary-600" /> WHO-aligned assessment</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          <div><label className="block text-xs text-gray-500 mb-1">Weight (kg)</label><input type="number" value={weight} onChange={e => setWeight(e.target.value)} className={numInput} /></div>
          <div><label className="block text-xs text-gray-500 mb-1">Height (cm)</label><input type="number" value={height} onChange={e => setHeight(e.target.value)} className={numInput} /></div>
          <div><label className="block text-xs text-gray-500 mb-1">BMI</label><div className="px-3 py-2 bg-gray-50 rounded-md text-sm">{bmi || '—'} <span className="text-xs text-gray-400">{bmi ? bmiInfo.label : ''}</span></div></div>
          <div><label className="block text-xs text-gray-500 mb-1">Crises / year</label><input type="number" value={crises} onChange={e => setCrises(e.target.value)} className={numInput} /></div>
          <div><label className="block text-xs text-gray-500 mb-1">Haemoglobin (g/dL)</label><input type="number" step="0.1" value={hb} onChange={e => setHb(e.target.value)} className={numInput} /></div>
          <div><label className="block text-xs text-gray-500 mb-1">Serum albumin (g/L, opt)</label><input type="number" value={albumin} onChange={e => setAlbumin(e.target.value)} className={numInput} /></div>
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-1">Pain (VAS): <span className="font-semibold text-gray-700">{pain}/10</span></label>
          <input type="range" min={0} max={10} value={pain} onChange={e => setPain(parseInt(e.target.value))} className="w-full" />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <label className="block text-xs text-gray-500 mb-1">Hydration status</label>
            <select value={hydration} onChange={e => setHydration(e.target.value)} className={numInput}>
              {HYDRATION_OPTS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Recent weight loss</label>
            <select value={weightLoss} onChange={e => setWeightLoss(e.target.value)} className={numInput}>
              {WEIGHTLOSS_OPTS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Wound bed</label>
            <select value={woundBed} onChange={e => setWoundBed(parseInt(e.target.value))} className={numInput}>
              {WOUND_BEDS.map((b, i) => <option key={i} value={i}>{b}</option>)}
            </select>
          </div>
        </div>
        <div className="flex flex-wrap gap-4 text-sm">
          <label className="flex items-center gap-1.5"><input type="checkbox" checked={infection} onChange={e => setInfection(e.target.checked)} /> Clinically infected</label>
          <label className="flex items-center gap-1.5"><input type="checkbox" checked={largeWound} onChange={e => setLargeWound(e.target.checked)} /> Large / multiple ulcers</label>
        </div>
      </div>

      {/* Severity score */}
      <div className={`rounded-lg border ${cc(severity.color, 'border')} ${cc(severity.color, 'bg')} p-4`}>
        <div className="flex items-center justify-between flex-wrap gap-2 mb-2">
          <div>
            <p className="text-xs text-gray-600">Composite ulcer severity score</p>
            <p className={`text-2xl font-bold ${cc(severity.color, 'text')}`}>{totalSeverity}<span className="text-base text-gray-400">/{maxSeverity}</span></p>
          </div>
          <span className={`inline-block px-3 py-1 rounded-full text-sm font-semibold ${cc(severity.color, 'bg')} ${cc(severity.color, 'text')}`}>{severity.label}</span>
        </div>
        <div className="bg-white/60 rounded-md p-2">
          {bandRow('Crisis frequency', bands.crisis)}
          {bandRow('Pain', bands.pain)}
          {bandRow('Haemoglobin', bands.hb)}
          {bandRow('Hydration', bands.hydration)}
          {bandRow('Nutrition', bands.nutrition)}
        </div>
      </div>

      {/* Nutritional needs */}
      <div className="bg-white border border-gray-200 rounded-lg p-4">
        <h2 className="font-semibold text-gray-800 mb-2 flex items-center gap-2"><Utensils className="h-4 w-4 text-green-600" /> Wound-healing nutritional needs</h2>
        {needs ? (
          <>
            <div className="grid grid-cols-3 gap-3 text-center mb-2">
              <div className="bg-green-50 rounded-md p-2"><p className="text-lg font-bold text-green-700">{needs.kcal}</p><p className="text-[10px] text-gray-500">kcal/day</p></div>
              <div className="bg-blue-50 rounded-md p-2"><p className="text-lg font-bold text-blue-700">{needs.protein} g</p><p className="text-[10px] text-gray-500">protein/day ({needs.proteinPerKg} g/kg)</p></div>
              <div className="bg-cyan-50 rounded-md p-2"><p className="text-lg font-bold text-cyan-700">{(needs.fluid / 1000).toFixed(1)} L</p><p className="text-[10px] text-gray-500">fluid/day</p></div>
            </div>
            <ul className="text-xs text-gray-600 space-y-0.5">
              {needs.micronutrients.map((m, i) => <li key={i} className="flex gap-1.5"><span className="text-green-600">•</span>{m}</li>)}
            </ul>
          </>
        ) : <p className="text-sm text-gray-500">Enter weight (and height) to calculate energy, protein and fluid targets.</p>}
      </div>

      {/* Protocols */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {([['Nutrition', protocols.nutrition, Utensils, 'text-green-600'],
           ['Hydration', protocols.hydration, Droplet, 'text-cyan-600'],
           ['Lifestyle', protocols.lifestyle, HeartPulse, 'text-purple-600']] as const).map(([title, list, Icon, color]) => (
          <div key={title} className="bg-white border border-gray-200 rounded-lg p-3">
            <h3 className="font-semibold text-sm mb-2 flex items-center gap-1.5 text-gray-800"><Icon className={`h-4 w-4 ${color}`} /> {title} protocol</h3>
            <ul className="text-xs text-gray-600 space-y-1">
              {list.map((r, i) => <li key={i} className="flex gap-1.5"><span className="text-gray-400">•</span>{r}</li>)}
            </ul>
          </div>
        ))}
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

      {/* 7-day meal plan */}
      <div className="bg-white border border-gray-200 rounded-lg p-4">
        <div className="flex items-center justify-between mb-2">
          <h2 className="font-semibold text-gray-800 flex items-center gap-2"><Utensils className="h-4 w-4 text-green-600" /> 7-day wound-healing meal plan</h2>
          {needs && (
            <button onClick={regenerateMeals} className="flex items-center gap-1 text-xs text-primary-600 hover:underline">
              <RefreshCw className="h-3.5 w-3.5" /> Regenerate
            </button>
          )}
        </div>
        {mealPlan.length === 0 ? (
          <p className="text-sm text-gray-500">Enter weight to auto-generate a meal plan matched to the nutritional targets.</p>
        ) : (
          <div className="space-y-3">
            {mealPlan.map(d => {
              const meets = needs ? d.totalProtein >= needs.protein - 8 : true;
              return (
                <div key={d.day} className="border border-gray-100 rounded-lg p-3">
                  <div className="flex items-center justify-between mb-1.5">
                    <p className="font-semibold text-sm text-gray-800">{d.day}</p>
                    <span className={`text-xs font-medium ${meets ? 'text-green-600' : 'text-amber-600'}`}>
                      {d.totalKcal} kcal · {d.totalProtein} g protein
                    </span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-5 gap-2 text-xs">
                    {[d.breakfast, d.midMorningSnack, d.lunch, d.afternoonSnack, d.dinner].map((m, i) => (
                      <div key={i} className="bg-gray-50 rounded-md p-2">
                        <p className="font-medium text-gray-500 mb-1">{['Breakfast', 'Snack', 'Lunch', 'Snack', 'Dinner'][i]}</p>
                        {m.items.map((it, j) => (
                          <p key={j} className="text-gray-700 leading-tight">{it.name} <span className="text-gray-400">— {it.qty}</span></p>
                        ))}
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Notes + save */}
      <div className="bg-white border border-gray-200 rounded-lg p-4 space-y-3">
        <label className="block text-sm font-medium text-gray-700">Clinical notes (optional)</label>
        <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={3} className={numInput}
          placeholder="Ulcer site/size, exudate, review date…" />
        <div className="flex justify-end">
          <button onClick={save} disabled={saving}
            className="flex items-center gap-1.5 px-4 py-2 bg-primary-600 text-white rounded-lg text-sm font-semibold hover:bg-primary-700 disabled:opacity-50">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Save assessment + plan
          </button>
        </div>
      </div>

      {/* History */}
      {history.length > 0 && (
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <h2 className="font-semibold text-gray-800 mb-2 flex items-center gap-2"><History className="h-4 w-4 text-gray-500" /> Previous assessments</h2>
          <div className="space-y-2">
            {history.map(hh => (
              <div key={hh.id} className="flex items-center justify-between border-b border-gray-100 pb-2 last:border-0">
                <div className="text-sm">
                  <span className="font-medium text-gray-800">{hh.total_score}/{hh.max_score}</span>
                  <span className="text-gray-500"> · {hh.readiness}</span>
                  <p className="text-xs text-gray-400">{hh.created_at ? new Date(hh.created_at).toLocaleString() : ''}{hh.assessed_by_name ? ` · ${hh.assessed_by_name}` : ''}</p>
                </div>
                <button onClick={async () => { if (hh.id && confirm('Delete this assessment?')) { await sickleCellUlcerService.deleteAssessment(hh.id); loadHistory(); } }}
                  className="text-red-400 hover:text-red-600 p-1"><Trash2 className="h-4 w-4" /></button>
              </div>
            ))}
          </div>
        </div>
      )}

      <p className="text-[11px] text-gray-400 text-center">
        Composite score is a structured, WHO-parameter-aligned aid (crisis, pain, Hb, hydration, nutrition) — not a formally published WHO instrument. Use with clinical judgement.
      </p>
    </div>
  );
}

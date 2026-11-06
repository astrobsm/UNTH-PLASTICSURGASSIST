/**
 * Food composition database — the dietitian's screen for the WAFCT 2019 table,
 * the Enugu local layer (Igbo names, portions, cost, availability), the
 * standardised recipe builder and household measures.
 *
 * Nutrient values are read-only here: they come from the source table. What a
 * dietitian edits is how foods are used — portions, local names, recipes —
 * and verifying recipes and measures by local weighing.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { BookOpen, CheckCircle2, Database, Loader2, Plus, Ruler, Save, Search, Trash2, UtensilsCrossed } from 'lucide-react';
import toast from 'react-hot-toast';
import { nutritionService } from '../services/nutritionService';
import { displayName, purchaseWeight, recipeNutrients, roundNutrients, type Food, type Recipe } from '../clinical/nutrition/foods';

const clean = (e: any) => String(e?.message || 'Something went wrong').replace(/^\[HTTP \d+\]\s*/, '');
type Tab = 'source' | 'foods' | 'recipes' | 'measures';

export default function NutritionFoodsPage() {
  const [tab, setTab] = useState<Tab>('source');
  const [info, setInfo] = useState<Awaited<ReturnType<typeof nutritionService.sources>> | null>(null);
  const load = useCallback(async () => {
    try { setInfo(await nutritionService.sources()); } catch (e) { toast.error(clean(e)); }
  }, []);
  useEffect(() => { void load(); }, [load]);
  const admin = !!info?.can_admin_foods;

  const tabs: { id: Tab; label: string; icon: any }[] = [
    { id: 'source', label: 'Source & import', icon: Database },
    { id: 'foods', label: 'Foods', icon: Search },
    { id: 'recipes', label: 'Recipes', icon: UtensilsCrossed },
    { id: 'measures', label: 'Household measures', icon: Ruler },
  ];

  return (
    <div className="max-w-6xl mx-auto p-4 space-y-4">
      <div>
        <h1 className="text-xl font-semibold text-gray-900">Food composition database</h1>
        <p className="text-sm text-gray-600">FAO/INFOODS West African Food Composition Table (2019) with the Enugu local layer. Nutrient values come only from the source table.</p>
      </div>
      <div className="flex flex-wrap gap-2 border-b">
        {tabs.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`flex items-center gap-1.5 px-3 py-2 text-sm border-b-2 -mb-px ${tab === t.id ? 'border-emerald-600 text-emerald-700 font-medium' : 'border-transparent text-gray-600 hover:text-gray-900'}`}>
            <t.icon className="w-4 h-4" />{t.label}
          </button>
        ))}
      </div>
      {tab === 'source' && <SourceTab info={info} admin={admin} reload={load} />}
      {tab === 'foods' && <FoodsTab admin={admin} />}
      {tab === 'recipes' && <RecipesTab admin={admin} />}
      {tab === 'measures' && <MeasuresTab admin={admin} />}
    </div>
  );
}

function SourceTab({ info, admin, reload }: { info: any; admin: boolean; reload: () => void }) {
  const [busy, setBusy] = useState<'wafct' | 'enugu' | null>(null);
  const wafct = info?.sources?.find((s: any) => s.code === 'WAFCT2019');
  const run = async (which: 'wafct' | 'enugu') => {
    setBusy(which);
    try {
      if (which === 'wafct') { const r = await nutritionService.seedWafct(); toast.success(`${r.imported} foods imported${r.rejected?.length ? `, ${r.rejected.length} rejected` : ''}`); }
      else { const r = await nutritionService.seedEnugu(); toast.success(`${r.recipes} draft recipes and ${r.measures} measures added`); if (r.missing?.length) toast.error(`Codes not found: ${r.missing.join(', ')}`); }
      reload();
    } catch (e) { toast.error(clean(e)); } finally { setBusy(null); }
  };
  return (
    <div className="space-y-4">
      <div className="bg-white rounded-lg border p-4 space-y-2">
        <h2 className="font-medium flex items-center gap-2"><BookOpen className="w-4 h-4" />Primary source</h2>
        {wafct ? (
          <dl className="text-sm grid sm:grid-cols-[10rem_1fr] gap-x-4 gap-y-1">
            <dt className="text-gray-500">Table</dt><dd>{wafct.name}</dd>
            <dt className="text-gray-500">Version</dt><dd>{wafct.version}</dd>
            <dt className="text-gray-500">Foods</dt><dd>{wafct.row_count}</dd>
            <dt className="text-gray-500">Imported</dt><dd>{wafct.imported_at ? new Date(wafct.imported_at).toLocaleString() : '—'} {wafct.imported_by_name ? `by ${wafct.imported_by_name}` : ''}</dd>
            <dt className="text-gray-500">Licence</dt><dd className="text-gray-700">{wafct.licence}</dd>
          </dl>
        ) : <p className="text-sm text-amber-700">The WAFCT 2019 table has not been imported on this server yet.</p>}
        {admin && (
          <div className="flex flex-wrap gap-2 pt-2">
            <button disabled={!!busy} onClick={() => run('wafct')} className="px-3 py-1.5 rounded bg-emerald-600 text-white text-sm disabled:opacity-50 flex items-center gap-1.5">
              {busy === 'wafct' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Database className="w-4 h-4" />}{wafct ? 'Re-import WAFCT 2019' : 'Import WAFCT 2019'}
            </button>
            <button disabled={!!busy || !wafct} onClick={() => run('enugu')} className="px-3 py-1.5 rounded border border-emerald-600 text-emerald-700 text-sm disabled:opacity-50 flex items-center gap-1.5">
              {busy === 'enugu' ? <Loader2 className="w-4 h-4 animate-spin" /> : <UtensilsCrossed className="w-4 h-4" />}Apply Enugu local layer ({info?.seed_version})
            </button>
          </div>
        )}
        <p className="text-xs text-gray-500">Re-importing updates nutrient values only; local names, portions, recipes and measures your team has edited are kept.</p>
      </div>
      <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
        <h2 className="font-medium text-amber-900">Local foods not in WAFCT 2019</h2>
        <p className="text-sm text-amber-800 mb-2">These cannot be planned until a verified composition is added (for example from the Nigerian Food Composition Table). No substitute values are used.</p>
        <ul className="list-disc pl-5 text-sm text-amber-900 space-y-0.5">{(info?.missing_local || []).map((m: string) => <li key={m}>{m}</li>)}</ul>
      </div>
    </div>
  );
}

function FoodsTab({ admin }: { admin: boolean }) {
  const [q, setQ] = useState('');
  const [foods, setFoods] = useState<Food[] | null>(null);
  const [edit, setEdit] = useState<Food | null>(null);
  const search = useCallback(async (term: string) => {
    try { setFoods(await nutritionService.foods(term, 100)); } catch (e) { toast.error(clean(e)); setFoods([]); }
  }, []);
  useEffect(() => { const t = setTimeout(() => void search(q), 250); return () => clearTimeout(t); }, [q, search]);

  return (
    <div className="space-y-3">
      <div className="relative">
        <Search className="w-4 h-4 absolute left-3 top-2.5 text-gray-400" />
        <input value={q} onChange={e => setQ(e.target.value)} placeholder="Search food, Igbo name or WAFCT code (e.g. garri, onugbu, 06_008)"
          className="w-full pl-9 pr-3 py-2 border rounded-md text-sm" />
      </div>
      {!foods ? <Loader2 className="w-5 h-5 animate-spin" /> : (
        <div className="bg-white border rounded-lg overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50 text-gray-600 text-left">
              <tr><th className="px-3 py-2">Code</th><th className="px-3 py-2">Food</th><th className="px-3 py-2 text-right">kcal</th><th className="px-3 py-2 text-right">Protein g</th><th className="px-3 py-2">Edible</th><th className="px-3 py-2">Planner</th><th /></tr>
            </thead>
            <tbody className="divide-y">
              {foods.map(f => (
                <tr key={f.id} className="align-top">
                  <td className="px-3 py-2 font-mono text-xs">{f.food_code}</td>
                  <td className="px-3 py-2">
                    <div>{f.name}</div>
                    {(f.local_names?.ig || f.local_names?.en) && <div className="text-xs text-emerald-700">{[f.local_names?.ig, f.local_names?.en].filter(Boolean).join(' · ')}</div>}
                    {!!f.per100g.imputed?.length && <div className="text-xs text-amber-700">FAO imputed: {f.per100g.imputed.join(', ')}</div>}
                  </td>
                  <td className="px-3 py-2 text-right">{f.per100g.energy_kcal}</td>
                  <td className="px-3 py-2 text-right">{f.per100g.protein_g}</td>
                  <td className="px-3 py-2 text-xs">{f.edible_portion ?? '—'}{f.yield_factor ? ` · yield ${f.yield_factor}` : ''}</td>
                  <td className="px-3 py-2 text-xs text-gray-600">{f.min_portion_g ? `${f.min_portion_g}–${f.max_portion_g} g` : '—'}{f.unit_g ? ` · ${f.unit_g} g/${f.unit_label}` : ''}{f.cost_tier ? ` · ${f.cost_tier} cost` : ''}</td>
                  <td className="px-3 py-2">{admin && <button onClick={() => setEdit(f)} className="text-emerald-700 text-xs underline">Edit use</button>}</td>
                </tr>
              ))}
              {!foods.length && <tr><td colSpan={7} className="px-3 py-6 text-center text-gray-500">No foods found. Import WAFCT 2019 on the first tab.</td></tr>}
            </tbody>
          </table>
        </div>
      )}
      {edit && <FoodPlanningDialog food={edit} onClose={() => setEdit(null)} onSaved={() => { setEdit(null); void search(q); }} />}
    </div>
  );
}

function FoodPlanningDialog({ food, onClose, onSaved }: { food: Food; onClose: () => void; onSaved: () => void }) {
  const [f, setF] = useState({
    en: food.local_names?.en || '', ig: food.local_names?.ig || '', min_portion_g: food.min_portion_g ?? '', max_portion_g: food.max_portion_g ?? '',
    unit_g: food.unit_g ?? '', unit_label: food.unit_label || '', cost_tier: food.cost_tier || '', seasonality: food.seasonality || '',
    hospital: !!food.availability?.hospital, home: !!food.availability?.home,
  });
  const num = (v: any) => (v === '' || v === null ? null : Number(v));
  const save = async () => {
    try {
      await nutritionService.updateFood(food.id, {
        local_names: { ...(food.local_names || {}), en: f.en || undefined, ig: f.ig || undefined },
        min_portion_g: num(f.min_portion_g), max_portion_g: num(f.max_portion_g), unit_g: num(f.unit_g), unit_label: f.unit_label || null,
        cost_tier: f.cost_tier || null, seasonality: f.seasonality || null, availability: { hospital: f.hospital, home: f.home },
      });
      toast.success('Saved'); onSaved();
    } catch (e) { toast.error(clean(e)); }
  };
  const field = (k: keyof typeof f, label: string, type = 'text') => (
    <label className="text-sm"><span className="text-gray-600">{label}</span>
      <input type={type} value={String(f[k])} onChange={e => setF({ ...f, [k]: e.target.value })} className="mt-0.5 w-full border rounded px-2 py-1" /></label>
  );
  return (
    <Modal title={`How ${food.name} is used`} onClose={onClose}>
      <p className="text-xs text-gray-500 mb-3">Nutrient values are fixed by WAFCT 2019 ({food.food_code}). These fields only control planning and labels.</p>
      <div className="grid grid-cols-2 gap-3">
        {field('en', 'Local English name')}{field('ig', 'Igbo name')}
        {field('min_portion_g', 'Min portion (g)', 'number')}{field('max_portion_g', 'Max portion (g)', 'number')}
        {field('unit_g', 'Grams per unit', 'number')}{field('unit_label', 'Unit (egg, piece, slice)')}
        <label className="text-sm"><span className="text-gray-600">Cost tier</span>
          <select value={f.cost_tier} onChange={e => setF({ ...f, cost_tier: e.target.value })} className="mt-0.5 w-full border rounded px-2 py-1">
            <option value="">—</option><option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option></select></label>
        {field('seasonality', 'Season (e.g. Mar–Jun)')}
        <label className="text-sm flex items-center gap-2"><input type="checkbox" checked={f.hospital} onChange={e => setF({ ...f, hospital: e.target.checked })} />Hospital kitchen</label>
        <label className="text-sm flex items-center gap-2"><input type="checkbox" checked={f.home} onChange={e => setF({ ...f, home: e.target.checked })} />Home / family</label>
      </div>
      <div className="flex justify-end gap-2 mt-4"><button onClick={onClose} className="px-3 py-1.5 text-sm border rounded">Cancel</button>
        <button onClick={save} className="px-3 py-1.5 text-sm rounded bg-emerald-600 text-white flex items-center gap-1"><Save className="w-4 h-4" />Save</button></div>
    </Modal>
  );
}

function RecipesTab({ admin }: { admin: boolean }) {
  const [recipes, setRecipes] = useState<Recipe[] | null>(null);
  const [edit, setEdit] = useState<Partial<Recipe> | null>(null);
  const load = useCallback(async () => { try { setRecipes(await nutritionService.recipes()); } catch (e) { toast.error(clean(e)); setRecipes([]); } }, []);
  useEffect(() => { void load(); }, [load]);
  const verify = async (r: Recipe) => {
    if (!window.confirm(`Confirm "${r.name}" has been checked by local weighing?`)) return;
    try { await nutritionService.verifyRecipe(r.id); toast.success('Recipe verified'); void load(); } catch (e) { toast.error(clean(e)); }
  };
  if (!recipes) return <Loader2 className="w-5 h-5 animate-spin" />;
  return (
    <div className="space-y-3">
      <div className="flex justify-between items-center">
        <p className="text-sm text-gray-600">{recipes.filter(r => r.status === 'verified').length} of {recipes.length} recipes verified. Totals are calculated from WAFCT ingredients.</p>
        {admin && <button onClick={() => setEdit({ name: '', ingredients: [], portion_g: 250, meal_slots: ['lunch'], category: 'main' })} className="px-3 py-1.5 rounded bg-emerald-600 text-white text-sm flex items-center gap-1"><Plus className="w-4 h-4" />New recipe</button>}
      </div>
      <div className="grid md:grid-cols-2 gap-3">
        {recipes.map(r => {
          const n = roundNutrients(recipeNutrients(r).perPortion);
          return (
            <div key={r.id} className="bg-white border rounded-lg p-3 space-y-2">
              <div className="flex justify-between gap-2">
                <div><div className="font-medium">{r.name}</div><div className="text-xs text-gray-500">{r.local_name} · {r.category} · {r.portion_g} g portion</div></div>
                <span className={`text-xs h-fit px-2 py-0.5 rounded-full ${r.status === 'verified' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'}`}>{r.status === 'verified' ? `Verified${r.verified_by_name ? ` · ${r.verified_by_name}` : ''}` : 'Draft — to verify'}</span>
              </div>
              <div className="text-sm"><b>{n.energy_kcal ?? 0}</b> kcal · <b>{n.protein_g ?? 0}</b> g protein · {n.fat_g ?? 0} g fat · {n.carb_g ?? 0} g carbohydrate</div>
              <ul className="text-xs text-gray-600">{r.ingredients.map(i => <li key={i.food_id}>{i.raw_g} g {i.food_name} <span className="font-mono text-gray-400">{i.food_code}</span></li>)}</ul>
              {admin && <div className="flex gap-3 text-xs"><button onClick={() => setEdit(r)} className="text-emerald-700 underline">Edit</button>{r.status !== 'verified' && <button onClick={() => verify(r)} className="text-emerald-700 underline flex items-center gap-0.5"><CheckCircle2 className="w-3 h-3" />Mark verified</button>}</div>}
            </div>
          );
        })}
      </div>
      {edit && <RecipeDialog recipe={edit} onClose={() => setEdit(null)} onSaved={() => { setEdit(null); void load(); }} />}
    </div>
  );
}

function RecipeDialog({ recipe, onClose, onSaved }: { recipe: Partial<Recipe>; onClose: () => void; onSaved: () => void }) {
  const [r, setR] = useState<Partial<Recipe>>({ ...recipe, ingredients: [...(recipe.ingredients || [])] });
  const [q, setQ] = useState('');
  const [hits, setHits] = useState<Food[]>([]);
  useEffect(() => {
    if (q.trim().length < 2) { setHits([]); return; }
    const t = setTimeout(async () => { try { setHits(await nutritionService.foods(q, 15)); } catch { setHits([]); } }, 250);
    return () => clearTimeout(t);
  }, [q]);
  const totals = useMemo(() => roundNutrients(recipeNutrients({ ingredients: r.ingredients || [], portion_g: r.portion_g ?? null }).perPortion), [r]);
  const setIng = (idx: number, raw_g: number) => setR({ ...r, ingredients: r.ingredients!.map((i, k) => (k === idx ? { ...i, raw_g } : i)) });
  const save = async () => {
    try {
      await nutritionService.saveRecipe({ ...r, ingredients: r.ingredients!.map(i => ({ food_id: i.food_id, raw_g: i.raw_g })) });
      toast.success('Recipe saved as draft — verify after local weighing'); onSaved();
    } catch (e) { toast.error(clean(e)); }
  };
  return (
    <Modal title={r.id ? `Edit ${r.name}` : 'New recipe'} onClose={onClose}>
      <div className="grid grid-cols-2 gap-3 text-sm">
        <label><span className="text-gray-600">Name</span><input value={r.name || ''} onChange={e => setR({ ...r, name: e.target.value })} className="mt-0.5 w-full border rounded px-2 py-1" /></label>
        <label><span className="text-gray-600">Igbo / local name</span><input value={r.local_name || ''} onChange={e => setR({ ...r, local_name: e.target.value })} className="mt-0.5 w-full border rounded px-2 py-1" /></label>
        <label><span className="text-gray-600">Category</span>
          <select value={r.category || 'main'} onChange={e => setR({ ...r, category: e.target.value })} className="mt-0.5 w-full border rounded px-2 py-1">
            {['swallow', 'soup', 'main', 'side', 'breakfast', 'snack', 'drink'].map(c => <option key={c}>{c}</option>)}</select></label>
        <label><span className="text-gray-600">Served portion (g)</span><input type="number" value={r.portion_g ?? ''} onChange={e => setR({ ...r, portion_g: Number(e.target.value) })} className="mt-0.5 w-full border rounded px-2 py-1" /></label>
        <div className="col-span-2"><span className="text-gray-600">Meals</span>
          <div className="flex flex-wrap gap-3 mt-1">{['breakfast', 'lunch', 'dinner', 'snack'].map(s => (
            <label key={s} className="flex items-center gap-1"><input type="checkbox" checked={!!r.meal_slots?.includes(s)}
              onChange={e => setR({ ...r, meal_slots: e.target.checked ? [...(r.meal_slots || []), s] : (r.meal_slots || []).filter(x => x !== s) })} />{s}</label>))}</div></div>
      </div>
      <h3 className="text-sm font-medium mt-4 mb-1">Ingredients per portion (edible grams of the coded food)</h3>
      <table className="w-full text-sm">
        <tbody>{(r.ingredients || []).map((i, k) => (
          <tr key={`${i.food_id}-${k}`}>
            <td className="py-1">{i.food_name} <span className="font-mono text-xs text-gray-400">{i.food_code}</span>
              {i.edible_portion && i.edible_portion < 1 ? <div className="text-xs text-gray-500">buy ≈ {Math.round(purchaseWeight(i.raw_g, i.edible_portion))} g as purchased</div> : null}</td>
            <td className="w-24"><input type="number" value={i.raw_g} onChange={e => setIng(k, Number(e.target.value))} className="w-20 border rounded px-1 py-0.5" /> g</td>
            <td className="w-8"><button onClick={() => setR({ ...r, ingredients: r.ingredients!.filter((_, x) => x !== k) })} aria-label="Remove"><Trash2 className="w-4 h-4 text-red-600" /></button></td>
          </tr>))}</tbody>
      </table>
      <div className="relative mt-2">
        <input value={q} onChange={e => setQ(e.target.value)} placeholder="Add ingredient — search WAFCT" className="w-full border rounded px-2 py-1 text-sm" />
        {!!hits.length && <div className="absolute z-10 bg-white border rounded shadow w-full max-h-48 overflow-y-auto">{hits.map(h => (
          <button key={h.id} onClick={() => { setR({ ...r, ingredients: [...(r.ingredients || []), { food_id: h.id, raw_g: 50, food_name: h.name, food_code: h.food_code, per100g: h.per100g, edible_portion: h.edible_portion }] }); setQ(''); }}
            className="block w-full text-left px-2 py-1 text-sm hover:bg-emerald-50">{displayName(h, true)} <span className="font-mono text-xs text-gray-400">{h.food_code}</span></button>))}</div>}
      </div>
      <p className="text-sm mt-3">Per portion: <b>{totals.energy_kcal ?? 0}</b> kcal · <b>{totals.protein_g ?? 0}</b> g protein · {totals.fat_g ?? 0} g fat · {totals.carb_g ?? 0} g carbohydrate</p>
      <div className="flex justify-end gap-2 mt-4"><button onClick={onClose} className="px-3 py-1.5 text-sm border rounded">Cancel</button>
        <button disabled={!r.name || !r.ingredients?.length} onClick={save} className="px-3 py-1.5 text-sm rounded bg-emerald-600 text-white disabled:opacity-50 flex items-center gap-1"><Save className="w-4 h-4" />Save draft</button></div>
    </Modal>
  );
}

function MeasuresTab({ admin }: { admin: boolean }) {
  const [rows, setRows] = useState<any[] | null>(null);
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const load = useCallback(async () => {
    try { const [m, r] = await Promise.all([nutritionService.measures(), nutritionService.recipes()]); setRows(m); setRecipes(r); } catch (e) { toast.error(clean(e)); setRows([]); }
  }, []);
  useEffect(() => { void load(); }, [load]);
  const target = (m: any) => (m.recipe_id ? recipes.find(r => r.id === m.recipe_id)?.name : null) || (m.food_id ? `Food #${m.food_id}` : '—');
  const verify = async (m: any, grams: number) => {
    try { await nutritionService.saveMeasure({ ...m, grams, verified: true }); toast.success('Measure verified'); void load(); } catch (e) { toast.error(clean(e)); }
  };
  if (!rows) return <Loader2 className="w-5 h-5 animate-spin" />;
  return (
    <div className="space-y-2">
      <p className="text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded p-2">Every conversion is "to be verified by local weighing" until a dietitian weighs it and confirms the grams.</p>
      <div className="bg-white border rounded-lg overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-50 text-left text-gray-600"><tr><th className="px-3 py-2">For</th><th className="px-3 py-2">Measure</th><th className="px-3 py-2">Grams</th><th className="px-3 py-2">Status</th></tr></thead>
          <tbody className="divide-y">{rows.map(m => <MeasureRow key={m.id} m={m} label={target(m)} admin={admin} onVerify={verify} />)}</tbody>
        </table>
      </div>
    </div>
  );
}

function MeasureRow({ m, label, admin, onVerify }: { m: any; label: string; admin: boolean; onVerify: (m: any, g: number) => void }) {
  const [g, setG] = useState(Number(m.grams));
  return (
    <tr>
      <td className="px-3 py-2">{label}</td><td className="px-3 py-2">{m.measure}</td>
      <td className="px-3 py-2">{admin && !m.verified ? <input type="number" value={g} onChange={e => setG(Number(e.target.value))} className="w-20 border rounded px-1" /> : Number(m.grams)}</td>
      <td className="px-3 py-2">{m.verified
        ? <span className="text-emerald-700 text-xs">Verified{m.verified_by_name ? ` · ${m.verified_by_name}` : ''}</span>
        : admin ? <button onClick={() => onVerify(m, g)} className="text-xs text-emerald-700 underline">Weighed — confirm</button> : <span className="text-xs text-amber-700">To verify</span>}</td>
    </tr>
  );
}

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto p-4" onClick={e => e.stopPropagation()}>
        <h2 className="font-semibold mb-3">{title}</h2>{children}
      </div>
    </div>
  );
}

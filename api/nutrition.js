// Clinical nutrition API — measurements, assessments, intake, meal plans, the
// food composition table, recipes, household measures and coefficient sign-off.
//
//   GET  ?patient_id=                     -> measurements (incl. vitals weights + lab analytes), assessments, plans, intake, permissions
//   GET  ?resource=worklist               -> latest assessment per patient + plans awaiting approval
//   GET  ?resource=foods&q=               -> food search
//   GET  ?resource=recipes | measures | sources | signoffs
//   POST ?action=measurement              {patient_id, kind, value, method?, measured_at?, note?}
//   POST ?action=measurement_error&id=    {reason}
//   POST ?action=intake                   {patient_id, intake_date, meal, items, kcal, protein_g, ...}
//   POST ?action=save&kind=assessment|plan {id?, version?, patient_id, config_version, ...}
//   POST ?action=submit|approve&kind=&id= {version}
//   POST ?action=error&kind=&id=          {reason}
//   POST ?action=import_foods             {source:{code,name,version,licence,url}, rows:[...]}
//   POST ?action=seed_wafct | seed_enugu  bundled WAFCT 2019 table; Enugu local layer (draft recipes, unverified measures)
//   POST ?action=food&id=                 planning fields (portions, cost, availability, local names)
//   POST ?action=recipe | recipe_verify&id= | measure
//   POST ?action=sign_config              {version, note}
import { cors, authenticateRequest } from './_lib/auth.js';
import { auditClinical } from './_lib/clinicalRecords.js';
import {
  ensureNutritionTables, patientRecord, addMeasurement, measurementInError, saveVersioned, transition, versionedInError, saveIntake,
  searchFoods, upsertFoods, seedWafct, seedEnugu, updateFoodPlanning, listRecipes, upsertRecipe, verifyRecipe, listMeasures, upsertMeasure, foodSources,
  configSignoffs, signConfig, worklist, canApprove, canRecord, canDraft, canAdminFoods,
} from './_lib/nutrition.js';
import { MISSING_FROM_WAFCT, ENUGU_SEED_VERSION } from './_lib/data/enuguFoods.js';

const ENTITY = { assessment: 'nutrition_assessments', plan: 'nutrition_meal_plans' };

export default async function handler(req, res) {
  if (cors(req, res)) return;
  const auth = authenticateRequest(req);
  if (!auth.authenticated) return res.status(401).json({ error: auth.error });
  const user = auth.user;
  if (!canRecord(user)) return res.status(403).json({ error: 'Your role has no access to nutrition records' });
  const url = new URL(req.url, `http://${req.headers.host}`);
  const action = url.searchParams.get('action') || '';
  const kind = url.searchParams.get('kind') || '';
  const id = url.searchParams.get('id');
  let body = req.body;
  if (typeof body === 'string') { try { body = JSON.parse(body); } catch { body = {}; } }
  body = body || {};
  const send = (r) => { const { status, ...rest } = r; return res.status(status).json(rest); };
  const permissions = { can_approve: canApprove(user), can_draft: canDraft(user), can_admin_foods: canAdminFoods(user) };

  try {
    await ensureNutritionTables();

    if (req.method === 'GET') {
      const resource = url.searchParams.get('resource');
      if (resource === 'worklist') return res.status(200).json({ ...(await worklist()), ...permissions });
      if (resource === 'foods') return res.status(200).json({ foods: await searchFoods(url.searchParams.get('q') || '', url.searchParams.get('limit')) });
      if (resource === 'recipes') return res.status(200).json({ recipes: await listRecipes() });
      if (resource === 'measures') return res.status(200).json({ measures: await listMeasures() });
      if (resource === 'sources') return res.status(200).json({ sources: await foodSources(), missing_local: MISSING_FROM_WAFCT, seed_version: ENUGU_SEED_VERSION, ...permissions });
      if (resource === 'signoffs') return res.status(200).json({ signoffs: await configSignoffs() });
      const patientId = url.searchParams.get('patient_id');
      if (!patientId) return res.status(400).json({ error: 'patient_id or resource is required' });
      return res.status(200).json({ ...(await patientRecord(patientId)), ...permissions });
    }

    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    if (action === 'measurement') {
      const r = await addMeasurement(body, user);
      if (!r.error) await auditClinical(user, { action: 'create', entity: 'nutrition_measurements', entityId: r.measurement.id, patientId: r.measurement.patient_id, detail: { kind: r.measurement.kind } });
      return send(r);
    }
    if (action === 'measurement_error') {
      if (!id) return res.status(400).json({ error: 'id is required' });
      const r = await measurementInError(id, user, body.reason);
      if (!r.error) await auditClinical(user, { action: 'entered_in_error', entity: 'nutrition_measurements', entityId: id, patientId: r.measurement.patient_id, detail: { reason: String(body.reason).slice(0, 200) } });
      return send(r);
    }
    if (action === 'intake') {
      const r = await saveIntake(body, user);
      if (!r.error) await auditClinical(user, { action: 'upsert', entity: 'nutrition_intake', entityId: r.intake.id, patientId: r.intake.patient_id, detail: { date: body.intake_date, meal: body.meal } });
      return send(r);
    }

    if (['save', 'submit', 'approve', 'error'].includes(action)) {
      if (!ENTITY[kind]) return res.status(400).json({ error: 'kind must be assessment or plan' });
      if (action !== 'approve' && !canDraft(user)) return res.status(403).json({ error: 'Your role records intake and measurements only' });
      let r;
      if (action === 'save') r = await saveVersioned(kind, body, user);
      else {
        if (!id) return res.status(400).json({ error: 'id is required' });
        r = action === 'error' ? await versionedInError(kind, id, user, body.reason)
          : await transition(kind, id, body.version, user, action === 'approve' ? 'approved' : 'pending_review');
      }
      if (!r.error) {
        const auditAction = action === 'save' ? (r.status === 201 ? 'create' : 'update') : action === 'error' ? 'entered_in_error' : action;
        await auditClinical(user, { action: auditAction, entity: ENTITY[kind], entityId: r.record.id, patientId: r.record.patient_id, detail: { config_version: r.record.config_version, status: r.record.status } });
      }
      return send(r);
    }

    if (['import_foods', 'seed_wafct', 'seed_enugu', 'food', 'recipe', 'recipe_verify', 'measure'].includes(action)) {
      if (!canAdminFoods(user)) return res.status(403).json({ error: 'Only a dietitian, consultant or administrator can change food data' });
      let r;
      if (action === 'import_foods') r = await upsertFoods(body.rows, body.source, user);
      else if (action === 'seed_wafct') r = await seedWafct(user);
      else if (action === 'seed_enugu') r = await seedEnugu(user);
      else if (action === 'food') r = id ? await updateFoodPlanning(id, body) : { status: 400, error: 'id is required' };
      else if (action === 'recipe') r = await upsertRecipe(body, user);
      else if (action === 'recipe_verify') r = id ? await verifyRecipe(id, user) : { status: 400, error: 'id is required' };
      else r = await upsertMeasure(body, user);
      if (!r.error) await auditClinical(user, { action, entity: 'nutrition_food_data', entityId: id || r.recipe?.id || r.measure?.id || r.food?.id || null, detail: action === 'import_foods' || action === 'seed_wafct' ? { source: body.source?.code || 'WAFCT2019', imported: r.imported, rejected: r.rejected?.length } : action === 'seed_enugu' ? { recipes: r.recipes, measures: r.measures, missing: r.missing } : null });
      return send(r);
    }

    if (action === 'sign_config') {
      if (!canApprove(user)) return res.status(403).json({ error: 'Only a dietitian, consultant or senior registrar can sign off coefficients' });
      const r = await signConfig(body.version, body.note, user);
      if (!r.error) await auditClinical(user, { action: 'sign', entity: 'nutrition_config', entityId: r.signoff.id, detail: { version: body.version } });
      return send(r);
    }

    return res.status(400).json({ error: 'Unknown action' });
  } catch (e) {
    console.error('nutrition error:', e);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

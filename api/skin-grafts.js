// ============================================================================
// Photographic skin graft monitoring.
//
//   GET    /api/skin-grafts?patientId=…        episodes for a patient
//   GET    /api/skin-grafts/episode/:id        one episode, sites, series, alerts
//   GET    /api/skin-grafts/dashboard          every active episode, for the unit
//   POST   /api/skin-grafts                    create an episode
//   POST   /api/skin-grafts/site               add a recipient or donor site
//   POST   /api/skin-grafts/baseline           lock a site's baseline
//   POST   /api/skin-grafts/analyse            derive the numbers for one photograph
//   POST   /api/skin-grafts/plan               graft planning from a defect area
//   PUT    /api/skin-grafts/alert              acknowledge an alert
//
// The photographs themselves are not handled here. A graft site IS a row in
// `wounds`, so capture, quality gating, calibration, segmentation, overlay
// rendering and clinician correction all go through the existing wound
// endpoints unchanged. This route reads those assessments and works out what
// they mean for a graft.
// ============================================================================

import { query } from './_lib/db.js';
import { cors, authenticateRequest } from './_lib/auth.js';
import {
  planGraft, closureFromBaseline, postoperativeDay, healingRate,
  classifyTrend, predictCompletion, assessComparability, deriveAlerts,
  overdueFollowUp,
} from './_lib/graftAnalysis.js';

const WRITE_ROLES = ['admin', 'consultant', 'senior_registrar', 'registrar', 'house_officer', 'nurse'];

export default async function handler(req, res) {
  if (cors(req, res)) return;

  const auth = authenticateRequest(req);
  if (!auth.authenticated) {
    return res.status(auth.status || 401).json({ error: auth.error || 'Unauthorized' });
  }

  const url = new URL(req.url, `http://${req.headers.host}`);
  const parts = url.pathname.replace(/^\/api\/skin-grafts\/?/, '').split('/').filter(Boolean);
  const action = parts[0] || '';
  const method = req.method;

  try {
    await ensureSchema();

    if (method === 'GET') {
      if (action === 'dashboard') return await getDashboard(res);
      if (action === 'episode')   return await getEpisode(parts[1], res);
      return await listEpisodes(url.searchParams, res);
    }

    const mayWrite = WRITE_ROLES.includes(auth.user.role);
    if (!mayWrite) return res.status(403).json({ error: 'Not permitted to change graft records' });

    if (method === 'POST') {
      if (action === 'site')     return await addSite(req.body, auth.user, res);
      if (action === 'baseline') return await lockBaseline(req.body, auth.user, res);
      if (action === 'analyse')  return await analyseAssessment(req.body, auth.user, res);
      if (action === 'plan')     return await planFromDefect(req.body, res);
      if (!action)               return await createEpisode(req.body, auth.user, res);
    }

    if (method === 'PUT' && action === 'alert') {
      return await acknowledgeAlert(req.body, auth.user, res);
    }

    return res.status(404).json({ error: 'Unknown skin-graft route' });
  } catch (error) {
    console.error('skin-grafts error:', error);
    return res.status(500).json({ error: 'Internal server error', message: error.message });
  }
}

// ---------------------------------------------------------------------------

let schemaReady = false;
async function ensureSchema() {
  if (schemaReady) return;
  // Migration 016 is the source of truth; this only covers a deployment that
  // has the code before an operator has run it, so the first request does not
  // fail with "relation does not exist".
  try {
    await query(`
      CREATE TABLE IF NOT EXISTS skin_graft_episodes (
        id SERIAL PRIMARY KEY, patient_id INTEGER NOT NULL, surgery_id INTEGER,
        episode_label VARCHAR(160), graft_type VARCHAR(40), graft_thickness_mm DECIMAL(4,2),
        mesh_ratio VARCHAR(16), operation_date DATE, surgeon_id INTEGER,
        status VARCHAR(30) NOT NULL DEFAULT 'active', notes TEXT, created_by INTEGER,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW())`);
  } catch (e) { console.warn('skin-grafts ensureSchema:', e.message); }
  schemaReady = true;
}

const num = (v) => (v === null || v === undefined || v === '' ? null : Number(v));
const round2 = (v) => (v == null ? null : Math.round(v * 100) / 100);

// ---------------------------------------------------------------------------
// Episodes
// ---------------------------------------------------------------------------

async function createEpisode(body, user, res) {
  const b = body || {};
  if (!b.patientId) return res.status(400).json({ error: 'patientId is required' });

  const r = await query(
    `INSERT INTO skin_graft_episodes
       (patient_id, surgery_id, episode_label, graft_type, graft_thickness_mm,
        mesh_ratio, operation_date, surgeon_id, notes, created_by)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *`,
    [b.patientId, b.surgeryId || null, b.episodeLabel || null, b.graftType || null,
     num(b.graftThicknessMm), b.meshRatio || '1:1', b.operationDate || null,
     b.surgeonId || user.id, b.notes || null, user.id],
  );
  return res.status(201).json({ episode: r.rows[0] });
}

async function listEpisodes(params, res) {
  const patientId = params.get('patientId');
  if (!patientId) return res.status(400).json({ error: 'patientId is required' });

  const r = await query(
    `SELECT e.*,
            (SELECT COUNT(*) FROM graft_sites s WHERE s.episode_id = e.id)::int AS site_count,
            (SELECT COUNT(*) FROM graft_alerts a
              WHERE a.episode_id = e.id AND a.acknowledged_at IS NULL)::int AS open_alerts
     FROM skin_graft_episodes e
     WHERE e.patient_id = $1 ORDER BY e.operation_date DESC NULLS LAST, e.id DESC`,
    [patientId],
  );
  return res.status(200).json({ episodes: r.rows });
}

/**
 * One episode in full: its sites, each site's photographic series, and what
 * that series means — rate, trend, prediction.
 */
async function getEpisode(id, res) {
  if (!id) return res.status(400).json({ error: 'episode id is required' });

  const episode = (await query('SELECT * FROM skin_graft_episodes WHERE id = $1', [id])).rows[0];
  if (!episode) return res.status(404).json({ error: 'Episode not found' });

  const sites = (await query(
    `SELECT s.*, w.label AS wound_label, w.anatomical_location AS wound_location,
            w.latest_area_cm2, w.assessment_count
     FROM graft_sites s
     LEFT JOIN wounds w ON w.id = s.wound_id
     WHERE s.episode_id = $1 ORDER BY s.site_role, s.id`,
    [id],
  )).rows;

  for (const site of sites) {
    site.series = await seriesFor(site, episode);
    const points = site.series
      .filter((p) => p.closurePct != null && p.day != null)
      .map((p) => ({ day: p.day, pct: p.closurePct }));

    const kind = site.site_role === 'recipient' ? 'recipient' : 'donor';
    site.rate = healingRate(points, num(site.baseline_area_cm2));
    site.trend = classifyTrend(points, { kind });
    // A graft is not expected to "complete"; only a donor site closes.
    site.prediction = kind === 'donor' ? predictCompletion(points) : null;

    const last = site.series[site.series.length - 1];
    site.overdue = last ? overdueFollowUp(last.capturedAt, new Date().toISOString()) : null;
  }

  const alerts = (await query(
    `SELECT * FROM graft_alerts WHERE episode_id = $1 ORDER BY created_at DESC LIMIT 100`, [id],
  )).rows;

  return res.status(200).json({ episode, sites, alerts });
}

/**
 * The photographic series for one site.
 *
 * Joins the graft-specific numbers onto the assessments that produced them, so
 * a caller gets the photograph, its quality, its calibration and what it meant
 * in one row.
 */
async function seriesFor(site, episode) {
  const rows = (await query(
    `SELECT a.id AS assessment_id, a.assessed_at, a.area_cm2, a.image_url, a.overlay_url,
            a.image_quality_score, a.scale_reliable, a.calibration_type,
            a.ai_confidence, a.model_name, a.model_version,
            g.id AS analysis_id, g.postoperative_day, g.measured_area_cm2,
            g.areal_take_pct, g.open_area_cm2, g.viability_pct, g.epithelialized_pct,
            g.tissue_status, g.tissue_reason, g.comparable, g.comparability_reason
     FROM wound_assessments a
     LEFT JOIN graft_site_analyses g ON g.assessment_id = a.id AND g.site_id = $2
     WHERE a.wound_id = $1
     ORDER BY a.assessed_at ASC`,
    [site.wound_id, site.id],
  )).rows;

  return rows.map((r) => ({
    assessmentId: r.assessment_id,
    analysisId: r.analysis_id,
    capturedAt: r.assessed_at,
    // Prefer the stored postoperative day; derive it where the analysis has
    // not been run, so a series is never blank merely for want of a join row.
    day: r.postoperative_day != null
      ? r.postoperative_day
      : postoperativeDay(episode.operation_date, r.assessed_at),
    openAreaCm2: num(r.open_area_cm2) ?? num(r.area_cm2),
    closurePct: num(r.areal_take_pct),
    imageUrl: r.image_url,
    overlayUrl: r.overlay_url,
    imageQualityScore: num(r.image_quality_score),
    scaleReliable: r.scale_reliable,
    calibrationType: r.calibration_type,
    confidence: num(r.ai_confidence),
    modelName: r.model_name,
    modelVersion: r.model_version,
    tissueStatus: r.tissue_status || 'unavailable',
    tissueReason: r.tissue_reason,
    viabilityPct: num(r.viability_pct),
    epithelializedPct: num(r.epithelialized_pct),
    comparable: r.comparable,
    comparabilityReason: r.comparability_reason,
  }));
}

// ---------------------------------------------------------------------------
// Sites
// ---------------------------------------------------------------------------

async function addSite(body, user, res) {
  const b = body || {};
  if (!b.episodeId || !b.woundId || !b.siteRole) {
    return res.status(400).json({ error: 'episodeId, woundId and siteRole are required' });
  }
  if (!['recipient', 'donor'].includes(b.siteRole)) {
    return res.status(400).json({ error: "siteRole must be 'recipient' or 'donor'" });
  }

  const r = await query(
    `INSERT INTO graft_sites
       (episode_id, wound_id, site_role, site_label, anatomical_location, body_side, defect_area_cm2)
     VALUES ($1,$2,$3,$4,$5,$6,$7)
     ON CONFLICT (episode_id, wound_id) DO UPDATE
       SET site_label = EXCLUDED.site_label, updated_at = NOW()
     RETURNING *`,
    [b.episodeId, b.woundId, b.siteRole, b.siteLabel || null,
     b.anatomicalLocation || null, b.bodySide || null, num(b.defectAreaCm2)],
  );
  return res.status(201).json({ site: r.rows[0] });
}

/**
 * Fixes the denominator (§15).
 *
 * Once locked, the baseline is never recomputed. A later photograph cannot
 * redefine it — a graft that had lost half its area would otherwise measure
 * 100% take against its own shrunken self, and the failure would erase the
 * evidence of itself. Re-locking requires `force`, and is recorded.
 */
async function lockBaseline(body, user, res) {
  const b = body || {};
  if (!b.siteId || !b.assessmentId) {
    return res.status(400).json({ error: 'siteId and assessmentId are required' });
  }

  const site = (await query('SELECT * FROM graft_sites WHERE id = $1', [b.siteId])).rows[0];
  if (!site) return res.status(404).json({ error: 'Site not found' });

  if (site.baseline_locked && !b.force) {
    return res.status(409).json({
      error: 'This site already has a locked baseline',
      message: 'Graft take is measured against the baseline, so it cannot be silently replaced. '
             + 'Re-lock deliberately if the original baseline was wrong.',
      baselineAreaCm2: num(site.baseline_area_cm2),
      baselineAssessmentId: site.baseline_assessment_id,
    });
  }

  const a = (await query(
    'SELECT id, area_cm2, assessed_at FROM wound_assessments WHERE id = $1 AND wound_id = $2',
    [b.assessmentId, site.wound_id],
  )).rows[0];
  if (!a) return res.status(400).json({ error: 'That assessment does not belong to this site' });
  if (!(Number(a.area_cm2) > 0)) {
    return res.status(400).json({ error: 'That assessment has no measured area to use as a baseline' });
  }

  const r = await query(
    `UPDATE graft_sites
       SET baseline_area_cm2 = $2, baseline_assessment_id = $3,
           baseline_captured_at = $4, baseline_locked = TRUE, updated_at = NOW()
     WHERE id = $1 RETURNING *`,
    [b.siteId, a.area_cm2, a.id, a.assessed_at],
  );

  await audit(user, 'graft_baseline_locked', {
    siteId: b.siteId, assessmentId: a.id, areaCm2: Number(a.area_cm2), relocked: !!b.force,
  });

  return res.status(200).json({ site: r.rows[0] });
}

// ---------------------------------------------------------------------------
// The analysis of one photograph
// ---------------------------------------------------------------------------

/**
 * Turns a saved wound assessment into graft numbers.
 *
 * Called after the existing wound pipeline has measured and stored the
 * photograph. Everything here is derived from areas already measured; nothing
 * re-reads the image.
 */
async function analyseAssessment(body, user, res) {
  const b = body || {};
  if (!b.siteId || !b.assessmentId) {
    return res.status(400).json({ error: 'siteId and assessmentId are required' });
  }

  const site = (await query(
    `SELECT s.*, e.operation_date, e.id AS episode_id
     FROM graft_sites s JOIN skin_graft_episodes e ON e.id = s.episode_id
     WHERE s.id = $1`, [b.siteId],
  )).rows[0];
  if (!site) return res.status(404).json({ error: 'Site not found' });

  const a = (await query(
    `SELECT * FROM wound_assessments WHERE id = $1 AND wound_id = $2`,
    [b.assessmentId, site.wound_id],
  )).rows[0];
  if (!a) return res.status(400).json({ error: 'That assessment does not belong to this site' });

  // The previous photograph, for comparability and for the regression alert.
  const prev = (await query(
    `SELECT a.*, g.areal_take_pct, g.postoperative_day
     FROM wound_assessments a
     LEFT JOIN graft_site_analyses g ON g.assessment_id = a.id AND g.site_id = $3
     WHERE a.wound_id = $1 AND a.assessed_at < $2
     ORDER BY a.assessed_at DESC LIMIT 1`,
    [site.wound_id, a.assessed_at, site.id],
  )).rows[0] || null;

  const comparability = assessComparability(
    {
      scaleReliable: !!a.scale_reliable,
      imageQualityScore: num(a.image_quality_score),
      pixelsPerCm: num(b.pixelsPerCm),
    },
    prev ? {
      scaleReliable: !!prev.scale_reliable,
      imageQualityScore: num(prev.image_quality_score),
      pixelsPerCm: num(b.previousPixelsPerCm),
    } : null,
  );

  const day = postoperativeDay(site.operation_date, a.assessed_at);

  // A tracing, where the clinician drew one. Both outlines come from the same
  // photograph, so the proportion it gives needs no baseline at all — which
  // makes it the better of the two figures whenever it exists, and the only
  // one available for a site whose day-zero photograph was never taken.
  const traced = num(b.tracedTotalAreaCm2) > 0 && num(b.tracedRawAreaCm2) !== null
    ? {
      totalAreaCm2: num(b.tracedTotalAreaCm2),
      rawAreaCm2: num(b.tracedRawAreaCm2),
      healedPct: num(b.tracedHealedPct),
    }
    : null;

  // The open area: what the clinician traced as raw, or failing that what the
  // segmenter measured. The traced figure wins because it is adjudicated.
  const openArea = traced ? traced.rawAreaCm2 : Number(a.area_cm2);

  // Take against the locked baseline. Kept even when a tracing exists, so the
  // two methods can be compared and the automated one audited against the
  // clinician's. Without a baseline there is a measurement but no proportion.
  const closure = closureFromBaseline(num(site.baseline_area_cm2), openArea);

  // Which proportion the record should lead with.
  const closurePct = traced ? traced.healedPct : (closure.ok ? closure.closurePct : null);

  // A tracing is the clinician's own adjudication, so it is recorded as
  // 'clinician' — the same provenance the wound module uses for a corrected
  // outline, and never 'model', which stays reserved for a validated
  // classifier that does not yet exist.
  const tissueStatus = traced ? 'clinician' : (b.tissueStatus || 'unavailable');
  const tissueReason = traced
    ? `Traced by the clinician against the calibration marker: `
      + `${traced.totalAreaCm2} cm² total, ${traced.rawAreaCm2} cm² raw.`
    : (b.tissueReason
       || 'No validated tissue-classification model is registered on this deployment.');

  const saved = (await query(
    `INSERT INTO graft_site_analyses
       (site_id, assessment_id, postoperative_day, measured_area_cm2, areal_take_pct,
        open_area_cm2, viable_area_cm2, nonviable_area_cm2, viability_pct,
        epithelialized_pct, tissue_status, tissue_reason, comparable,
        comparability_reason, model_name, model_version, confidence)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17)
     ON CONFLICT (site_id, assessment_id) DO UPDATE SET
       postoperative_day = EXCLUDED.postoperative_day,
       measured_area_cm2 = EXCLUDED.measured_area_cm2,
       areal_take_pct = EXCLUDED.areal_take_pct,
       open_area_cm2 = EXCLUDED.open_area_cm2,
       viable_area_cm2 = EXCLUDED.viable_area_cm2,
       nonviable_area_cm2 = EXCLUDED.nonviable_area_cm2,
       viability_pct = EXCLUDED.viability_pct,
       epithelialized_pct = EXCLUDED.epithelialized_pct,
       tissue_status = EXCLUDED.tissue_status,
       tissue_reason = EXCLUDED.tissue_reason,
       comparable = EXCLUDED.comparable,
       comparability_reason = EXCLUDED.comparability_reason
     RETURNING *`,
    [site.id, a.id, day,
     traced ? traced.totalAreaCm2 : Number(a.area_cm2),
     closurePct,
     openArea,
     // A recipient site's healed fraction is viable graft; a donor site's is
     // epithelialized skin. Only the column that means something is filled.
     traced && site.site_role === 'recipient'
       ? round2(traced.totalAreaCm2 - traced.rawAreaCm2) : null,
     traced && site.site_role === 'recipient' ? traced.rawAreaCm2 : null,
     traced && site.site_role === 'recipient' ? traced.healedPct : null,
     traced && site.site_role === 'donor' ? traced.healedPct : null,
     tissueStatus, tissueReason,
     comparability.comparable, comparability.reason,
     a.model_name, a.model_version, num(a.ai_confidence)],
  )).rows[0];

  // The trend, over everything recorded so far including this photograph.
  const points = (await query(
    `SELECT postoperative_day AS day, areal_take_pct AS pct
     FROM graft_site_analyses
     WHERE site_id = $1 AND postoperative_day IS NOT NULL AND areal_take_pct IS NOT NULL
     ORDER BY postoperative_day`, [site.id],
  )).rows.map((r) => ({ day: Number(r.day), pct: Number(r.pct) }));

  const kind = site.site_role === 'recipient' ? 'recipient' : 'donor';
  const trend = classifyTrend(points, { kind });
  const prediction = kind === 'donor' ? predictCompletion(points) : null;

  const alerts = deriveAlerts({
    siteRole: site.site_role,
    analysis: {
      closurePct,
      day,
      exceededBaseline: closure.ok ? closure.exceededBaseline : false,
      comparable: comparability.comparable,
      comparabilityReason: comparability.reason,
    },
    previousAnalysis: prev && prev.areal_take_pct != null
      ? { closurePct: Number(prev.areal_take_pct), day: prev.postoperative_day }
      : null,
    trend,
    prediction,
    quality: { blocking: num(a.image_quality_score) != null && num(a.image_quality_score) < 0.4 },
  });

  for (const al of alerts) {
    await query(
      `INSERT INTO graft_alerts (episode_id, site_id, analysis_id, severity, code, message)
       VALUES ($1,$2,$3,$4,$5,$6)`,
      [site.episode_id, site.id, saved.id, al.severity, al.code, al.message],
    );
  }

  return res.status(200).json({
    analysis: saved,
    traced,
    closurePct,
    closure,
    comparability,
    trend,
    prediction,
    alerts,
    day,
    baselineLocked: !!site.baseline_locked,
  });
}

// ---------------------------------------------------------------------------

async function planFromDefect(body, res) {
  const b = body || {};
  const plan = planGraft({
    defectAreaCm2: num(b.defectAreaCm2),
    coverageMarginPct: b.coverageMarginPct === undefined ? 5 : num(b.coverageMarginPct),
    meshRatio: b.meshRatio || '1:1',
  });
  if (!plan.ok) return res.status(400).json({ error: plan.reason });

  // Persisted against the site when one is named, so the plan the surgeon saw
  // is the plan the record shows.
  if (b.siteId) {
    await query(
      `UPDATE graft_sites
         SET defect_area_cm2 = $2, planned_coverage_cm2 = $3, planned_harvest_cm2 = $4, updated_at = NOW()
       WHERE id = $1`,
      [b.siteId, plan.defectAreaCm2, plan.plannedCoverageCm2, plan.plannedHarvestCm2],
    );
  }
  return res.status(200).json({ plan });
}

async function getDashboard(res) {
  const rows = (await query(
    `SELECT e.id, e.patient_id, e.episode_label, e.operation_date, e.status,
            e.graft_type, e.mesh_ratio,
            p.full_name AS patient_name, p.hospital_number,
            (SELECT COUNT(*) FROM graft_alerts a
              WHERE a.episode_id = e.id AND a.acknowledged_at IS NULL)::int AS open_alerts,
            (SELECT COUNT(*) FROM graft_sites s WHERE s.episode_id = e.id)::int AS site_count
     FROM skin_graft_episodes e
     LEFT JOIN patients p ON p.id = e.patient_id
     WHERE e.status = 'active'
     ORDER BY open_alerts DESC, e.operation_date DESC NULLS LAST
     LIMIT 200`,
  )).rows;
  return res.status(200).json({ episodes: rows });
}

async function acknowledgeAlert(body, user, res) {
  if (!body || !body.alertId) return res.status(400).json({ error: 'alertId is required' });
  const r = await query(
    `UPDATE graft_alerts SET acknowledged_by = $2, acknowledged_at = NOW()
     WHERE id = $1 AND acknowledged_at IS NULL RETURNING *`,
    [body.alertId, user.id],
  );
  if (!r.rows[0]) return res.status(404).json({ error: 'Alert not found or already acknowledged' });
  return res.status(200).json({ alert: r.rows[0] });
}

async function audit(user, action, details) {
  try {
    // Columns as audit_logs actually declares them: resource_type and
    // resource_id are NOT NULL, details is TEXT, and the column is `timestamp`
    // rather than created_at.
    await query(
      `INSERT INTO audit_logs
         (user_id, user_name, user_role, action, resource_type, resource_id, details)
       VALUES ($1,$2,$3,$4,'skin_graft',$5,$6)`,
      [String(user.id), user.name || user.fullName || null, user.role || null,
       action, String(details.siteId ?? details.episodeId ?? ''), JSON.stringify(details)],
    );
  } catch (e) {
    // An unrecorded audit line must not fail the clinical action it describes.
    console.warn('skin-graft audit:', e.message);
  }
}

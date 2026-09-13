// ============================================================================
// Scar and keloid longitudinal monitoring.
//
//   GET  /api/scars?patientId=…        this patient's scars
//   GET  /api/scars/case/:id           one scar: series, domains, prediction
//   POST /api/scars                    create a scar case (creates its wound)
//   POST /api/scars/assessment         open a visit against a photograph
//   PUT  /api/scars/scores             record or update a validated scale
//   PUT  /api/scars/exam               record the physical examination
//   PUT  /api/scars/patient-reported   record the patient's own report
//   PUT  /api/scars/colour             store a colour analysis
//   POST /api/scars/finalize           finalize a visit (immutable thereafter)
//   PUT  /api/scars/alert              acknowledge an alert
//
// Photographs, calibration, segmentation and tracing are NOT handled here: a
// scar is a `wounds` row, so all of that goes through the existing wound
// endpoints unchanged. This route records what the photographs mean for a
// scar, and what only a clinician or the patient can supply.
// ============================================================================

import { query } from './_lib/db.js';
import { cors, authenticateRequest } from './_lib/auth.js';
import { scoreScale, scoreChange, SCALES } from './_lib/scarScales.js';
import {
  changeBetween, rateOfChange, growthAcceleration, classifyDomainTrend,
  multimodalAssessment, predictionEligibility, methodConsistency,
} from './_lib/scarLongitudinal.js';
import {
  growthProfile, growthAcceleration as keloidAcceleration, activityAssessment,
  keloidStatus, treatmentResponse,
} from './_lib/keloidProgress.js';

const WRITE_ROLES = ['admin', 'consultant', 'senior_registrar', 'registrar', 'house_officer', 'nurse'];
const num = (v) => (v === null || v === undefined || v === '' ? null : Number(v));

export default async function handler(req, res) {
  if (cors(req, res)) return;

  const auth = authenticateRequest(req);
  if (!auth.authenticated) {
    return res.status(auth.status || 401).json({ error: auth.error || 'Unauthorized' });
  }

  const url = new URL(req.url, `http://${req.headers.host}`);
  const parts = url.pathname.replace(/^\/api\/scars\/?/, '').split('/').filter(Boolean);
  const action = parts[0] || '';

  try {
    if (req.method === 'GET') {
      if (action === 'dashboard') return await getDashboard(res);
      if (action === 'case') return await getCase(parts[1], res);
      if (action === 'scales') return res.status(200).json({ scales: SCALES });
      return await listScars(url.searchParams, res);
    }

    if (!WRITE_ROLES.includes(auth.user.role)) {
      return res.status(403).json({ error: 'Not permitted to change scar records' });
    }

    if (req.method === 'POST') {
      if (action === 'assessment') return await openAssessment(req.body, auth.user, res);
      if (action === 'finalize') return await finalize(req.body, auth.user, res);
      if (!action) return await createScar(req.body, auth.user, res);
    }

    if (req.method === 'PUT') {
      if (action === 'scores') return await putScores(req.body, auth.user, res);
      if (action === 'exam') return await putExam(req.body, auth.user, res);
      if (action === 'patient-reported') return await putPatientReported(req.body, auth.user, res);
      if (action === 'colour') return await putColour(req.body, res);
      if (action === 'alert') return await ackAlert(req.body, auth.user, res);
    }

    return res.status(404).json({ error: 'Unknown scar route' });
  } catch (error) {
    console.error('scars error:', error);
    return res.status(500).json({ error: 'Internal server error', message: error.message });
  }
}

// ---------------------------------------------------------------------------

async function createScar(body, user, res) {
  const b = body || {};
  if (!b.patientId || !b.woundId) {
    return res.status(400).json({ error: 'patientId and woundId are required' });
  }
  const r = await query(
    `INSERT INTO scar_cases
       (patient_id, wound_id, keloid_plan_id, label, anatomical_site, body_side,
        scar_type, onset_date, causative_event, original_wound_area_cm2,
        original_wound_source, crosses_joint, joint_involved, created_by)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
     ON CONFLICT (patient_id, wound_id) DO UPDATE SET
       label = EXCLUDED.label, updated_at = NOW()
     RETURNING *`,
    [b.patientId, b.woundId, b.keloidPlanId || null, b.label || null,
     b.anatomicalSite || null, b.bodySide || null, b.scarType || 'uncertain',
     b.onsetDate || null, b.causativeEvent || null,
     // Never inferred. Only stored when the clinician says where it came from.
     b.originalWoundSource ? num(b.originalWoundAreaCm2) : null,
     b.originalWoundSource || null,
     !!b.crossesJoint, b.jointInvolved || null, user.id],
  );
  return res.status(201).json({ scar: r.rows[0] });
}

async function listScars(params, res) {
  // Either a patient's scars, or the scars attached to one keloid care plan —
  // the plan view asks the second way.
  const planId = params.get('planId');
  if (planId) {
    const r = await query(
      `SELECT s.*, w.label AS wound_label,
              (SELECT COUNT(*) FROM scar_assessments a WHERE a.scar_id = s.id)::int AS assessment_count,
              (SELECT COUNT(*) FROM scar_alerts al
                WHERE al.scar_id = s.id AND al.acknowledged_at IS NULL)::int AS open_alerts,
              (SELECT MAX(a.assessed_at) FROM scar_assessments a WHERE a.scar_id = s.id) AS last_assessed_at
       FROM scar_cases s LEFT JOIN wounds w ON w.id = s.wound_id
       WHERE s.keloid_plan_id = $1 ORDER BY s.created_at DESC`,
      [planId],
    );
    return res.status(200).json({ scars: r.rows });
  }

  const patientId = params.get('patientId');
  if (!patientId) return res.status(400).json({ error: 'patientId or planId is required' });
  const r = await query(
    `SELECT s.*, w.label AS wound_label,
            (SELECT COUNT(*) FROM scar_assessments a WHERE a.scar_id = s.id)::int AS assessment_count,
            (SELECT COUNT(*) FROM scar_alerts al
              WHERE al.scar_id = s.id AND al.acknowledged_at IS NULL)::int AS open_alerts,
            (SELECT MAX(a.assessed_at) FROM scar_assessments a WHERE a.scar_id = s.id) AS last_assessed_at
     FROM scar_cases s
     LEFT JOIN wounds w ON w.id = s.wound_id
     WHERE s.patient_id = $1 ORDER BY s.created_at DESC`,
    [patientId],
  );
  return res.status(200).json({ scars: r.rows });
}

/**
 * Every scar the unit is following, worst first.
 *
 * Sorted by what needs attention: possible recurrence, then progression, then
 * lesions that are stable but still active. A quiescent keloid is at the
 * bottom, which is where it belongs.
 */
async function getDashboard(res) {
  const rows = (await query(
    `SELECT s.id, s.label, s.anatomical_site, s.scar_type, s.patient_id,
            s.keloid_plan_id,
            p.full_name AS patient_name, p.hospital_number,
            (SELECT COUNT(*) FROM scar_alerts a
              WHERE a.scar_id = s.id AND a.acknowledged_at IS NULL)::int AS open_alerts,
            (SELECT COUNT(*) FROM scar_assessments a WHERE a.scar_id = s.id)::int AS assessment_count,
            (SELECT MAX(a.assessed_at) FROM scar_assessments a WHERE a.scar_id = s.id) AS last_assessed_at
     FROM scar_cases s
     LEFT JOIN patients p ON p.id = s.patient_id
     WHERE s.status = 'active'
     LIMIT 200`,
  )).rows;

  // The area series for every one of them, in a single pass rather than a
  // query per lesion.
  const ids = rows.map((r) => r.id);
  const seriesRows = ids.length ? (await query(
    `SELECT a.scar_id, a.assessed_at, wa.area_cm2,
            e.pliability, pr.pain_0_10, pr.itch_0_10, c.erythema_index
     FROM scar_assessments a
     LEFT JOIN wound_assessments wa ON wa.id = a.wound_assessment_id
     LEFT JOIN scar_physical_exams e ON e.assessment_id = a.id
     LEFT JOIN scar_patient_reported pr ON pr.assessment_id = a.id
     LEFT JOIN scar_colour_analysis c ON c.assessment_id = a.id
     WHERE a.scar_id = ANY($1::int[]) AND a.superseded_by IS NULL
     ORDER BY a.scar_id, a.assessed_at`,
    [ids],
  )).rows : [];

  const byScar = new Map();
  for (const r of seriesRows) {
    if (!byScar.has(r.scar_id)) byScar.set(r.scar_id, []);
    byScar.get(r.scar_id).push(r);
  }

  const ORDER = {
    possible_recurrence: 0, progressive: 1, stable_active: 2,
    stable: 3, insufficient: 4, regressing: 5, quiescent: 6,
  };

  const scars = rows.map((r) => {
    const rowsFor = byScar.get(r.id) || [];
    const origin = rowsFor.length ? new Date(rowsFor[0].assessed_at).getTime() : null;
    const series = rowsFor
      .filter((x) => x.area_cm2 != null)
      .map((x) => ({
        day: Math.round((new Date(x.assessed_at).getTime() - origin) / 86400000),
        value: Number(x.area_cm2),
      }));
    const last = rowsFor.length ? rowsFor[rowsFor.length - 1] : null;
    const growth = growthProfile(series);
    const activity = activityAssessment({
      erythemaIndex: num(last?.erythema_index),
      pain: num(last?.pain_0_10),
      itch: num(last?.itch_0_10),
      pliability: last?.pliability,
    });
    const status = keloidStatus({ growth, activity });
    return { ...r, growth, activity, status };
  }).sort((a, b) => {
    const d = (ORDER[a.status.status] ?? 9) - (ORDER[b.status.status] ?? 9);
    return d !== 0 ? d : (b.open_alerts - a.open_alerts);
  });

  return res.status(200).json({ scars });
}

/**
 * One scar in full.
 *
 * Every domain is computed separately and then compared, because the useful
 * question is whether the modalities agree — not what any one of them says.
 */
async function getCase(id, res) {
  if (!id) return res.status(400).json({ error: 'scar id is required' });

  const scar = (await query('SELECT * FROM scar_cases WHERE id = $1', [id])).rows[0];
  if (!scar) return res.status(404).json({ error: 'Scar not found' });

  // The visits, with the photographic measurement each hangs off.
  const visits = (await query(
    `SELECT a.*, wa.area_cm2, wa.perimeter_cm, wa.length_cm, wa.width_cm,
            wa.image_quality_score, wa.scale_reliable, wa.image_url, wa.overlay_url,
            wa.granulation_pct, wa.slough_pct, wa.necrotic_pct, wa.epithelial_pct,
            wa.tissue_source,
            c.delta_e, c.erythema_index, c.lightness_delta, c.pigmentation,
            c.heterogeneity_ratio, c.reliability AS colour_reliability,
            e.pliability, e.mobility, e.contracture_present, e.rom_deficit_degrees,
            p.pain_0_10, p.itch_0_10, p.tightness_0_10,
            t.status AS three_d_status, t.status_reason AS three_d_reason,
            t.max_elevation_mm, t.volume_cm3
     FROM scar_assessments a
     LEFT JOIN wound_assessments wa ON wa.id = a.wound_assessment_id
     LEFT JOIN scar_colour_analysis c ON c.assessment_id = a.id
     LEFT JOIN scar_physical_exams e ON e.assessment_id = a.id
     LEFT JOIN scar_patient_reported p ON p.assessment_id = a.id
     LEFT JOIN scar_3d_models t ON t.assessment_id = a.id
     WHERE a.scar_id = $1 AND a.superseded_by IS NULL
     ORDER BY a.assessed_at ASC`,
    [id],
  )).rows;

  const scores = (await query(
    `SELECT s.* FROM scar_validated_scores s
     JOIN scar_assessments a ON a.id = s.assessment_id
     WHERE a.scar_id = $1 ORDER BY a.assessed_at`, [id],
  )).rows;

  // Day zero is the first visit, so every series shares one origin.
  const origin = visits.length ? new Date(visits[0].assessed_at).getTime() : null;
  const dayOf = (d) => (origin == null ? null
    : Math.round((new Date(d).getTime() - origin) / 86400000));

  const seriesFor = (pick) => visits
    .map((v) => ({ day: dayOf(v.assessed_at), value: num(pick(v)) }))
    .filter((p) => p.day != null && p.value != null);

  // Each domain carries its modality and its direction, so the multimodal
  // engine never has to guess either.
  const DOMAINS = [
    { domain: 'area', label: 'Area', modality: 'image', unit: 'cm²', worseIsHigher: true, pick: (v) => v.area_cm2 },
    { domain: 'erythema', label: 'Erythema', modality: 'image', unit: '', worseIsHigher: true, pick: (v) => v.erythema_index },
    { domain: 'elevation', label: 'Elevation', modality: '3d', unit: 'mm', worseIsHigher: true, pick: (v) => v.max_elevation_mm },
    { domain: 'volume', label: 'Volume', modality: '3d', unit: 'cm³', worseIsHigher: true, pick: (v) => v.volume_cm3 },
    { domain: 'rom_deficit', label: 'Range-of-motion deficit', modality: 'exam', unit: '°', worseIsHigher: true, pick: (v) => v.rom_deficit_degrees },
    { domain: 'pain', label: 'Pain', modality: 'patient', unit: '/10', worseIsHigher: true, pick: (v) => v.pain_0_10 },
    { domain: 'itch', label: 'Itch', modality: 'patient', unit: '/10', worseIsHigher: true, pick: (v) => v.itch_0_10 },
    { domain: 'tightness', label: 'Tightness', modality: 'patient', unit: '/10', worseIsHigher: true, pick: (v) => v.tightness_0_10 },
  ];

  const domains = DOMAINS.map((d) => {
    const series = seriesFor(d.pick);
    const first = series[0];
    const last = series[series.length - 1];
    const prev = series.length >= 2 ? series[series.length - 2] : null;
    return {
      domain: d.domain, label: d.label, modality: d.modality, unit: d.unit,
      series,
      current: last ? last.value : null,
      fromBaseline: first && last && series.length >= 2
        ? changeBetween(first.value, last.value) : null,
      fromPrevious: prev && last ? changeBetween(prev.value, last.value) : null,
      rate: rateOfChange(series, { unit: d.unit }),
      acceleration: growthAcceleration(series),
      ...classifyDomainTrend(series, { worseIsHigher: d.worseIsHigher }),
    };
  });

  // Validated scales, each independently and never merged.
  const byScale = {};
  for (const s of scores) {
    (byScale[s.scale] ||= []).push(s);
  }
  const scaleTrends = Object.entries(byScale).map(([key, rows]) => {
    const complete = rows.filter((r) => r.complete && r.total != null);
    const first = complete[0];
    const last = complete[complete.length - 1];
    return {
      scale: key,
      name: SCALES[key]?.name || key,
      latest: last ? last.total : null,
      max: SCALES[key]?.max ?? null,
      fromBaseline: first && last && complete.length >= 2
        ? scoreChange(key, first.total, last.total) : null,
      series: complete.map((r) => ({ total: r.total, at: r.created_at })),
      incompleteCount: rows.length - complete.length,
    };
  });

  // Scales join the multimodal picture as their own modality.
  const scaleDomains = scaleTrends
    .filter((t) => t.series.length >= 2)
    .map((t) => ({
      domain: t.scale, label: t.name, modality: 'score',
      ...classifyDomainTrend(
        t.series.map((p, i) => ({ day: i, value: p.total })), { worseIsHigher: true }),
    }));

  const multimodal = multimodalAssessment([...domains, ...scaleDomains]);

  const observations = visits.map((v) => ({
    day: dayOf(v.assessed_at),
    imageQualityScore: num(v.image_quality_score),
    scaleReliable: v.scale_reliable !== false,
    method: v.measurement_method,
  }));

  const alerts = (await query(
    `SELECT * FROM scar_alerts WHERE scar_id = $1 ORDER BY created_at DESC LIMIT 100`, [id],
  )).rows;

  // Treatment, from the existing keloid plan rather than a second table.
  // Overlaid on the trend charts so a clinician can see whether a change
  // followed an injection or preceded it — which is the whole question when
  // judging response (§54).
  let treatments = [];
  let excisionDay = null;
  if (scar.keloid_plan_id) {
    const plan = (await query(
      'SELECT surgery_date, surgery_planned FROM keloid_care_plans WHERE id = $1',
      [scar.keloid_plan_id])).rows[0];
    if (plan?.surgery_date) excisionDay = dayOf(plan.surgery_date);
  }
  if (scar.keloid_plan_id) {
    treatments = (await query(
      `SELECT 'injection' AS kind, injection_number, injection_phase,
              COALESCE(actual_date, scheduled_date) AS event_date,
              dose_mg, concentration, volume_ml, status, adverse_effects
       FROM keloid_injections
       WHERE keloid_plan_id = $1 AND COALESCE(actual_date, scheduled_date) IS NOT NULL
       ORDER BY event_date`,
      [scar.keloid_plan_id],
    )).rows.map((t) => ({ ...t, day: dayOf(t.event_date) }));
  }

  // -- The keloid questions ------------------------------------------------
  //
  // Deliberately not the wound ones. A keloid does not epithelialize and does
  // not close, so area reduction, healing velocity and a projected closure
  // date are category errors for it. What a clinician needs to know is whether
  // it is growing, whether it is still active, whether it responded to the
  // injections, and whether post-excision growth is recurrence.
  const areaSeries = seriesFor((v) => v.area_cm2);
  const latest = visits.length ? visits[visits.length - 1] : null;

  const growth = growthProfile(areaSeries);
  const activity = activityAssessment({
    erythemaIndex: num(latest?.erythema_index),
    pain: num(latest?.pain_0_10),
    itch: num(latest?.itch_0_10),
    tenderness: null,
    pliability: latest?.pliability,
  });

  const treatmentDays = treatments
    .filter((t) => t.day != null && t.status !== 'scheduled')
    .map((t) => t.day);

  const keloid = {
    growth,
    acceleration: keloidAcceleration(areaSeries),
    activity,
    status: keloidStatus({
      growth,
      activity,
      // Excision day, when the plan records one inside this scar's timeline.
      excisionDayOffset: excisionDay,
      currentDay: latest ? dayOf(latest.assessed_at) : null,
    }),
    treatmentResponse: treatmentResponse(areaSeries, treatmentDays),
  };

  return res.status(200).json({
    scar,
    keloid,
    visits: visits.map((v) => ({ ...v, day: dayOf(v.assessed_at) })),
    domains,
    scales: scaleTrends,
    multimodal,
    eligibility: predictionEligibility(observations),
    methodConsistency: methodConsistency(observations),
    alerts,
    treatments,
    // §23: 3D is not available on this deployment, and says so rather than
    // returning zeros.
    threeD: {
      available: false,
      reason: 'No 3D reconstruction backend is configured. Multi-view photogrammetry '
            + 'needs structure-from-motion and dense stereo, which this deployment '
            + 'cannot run. Elevation and volume are reported as not reliably measurable.',
    },
  });
}

// ---------------------------------------------------------------------------

async function openAssessment(body, user, res) {
  const b = body || {};
  if (!b.scarId) return res.status(400).json({ error: 'scarId is required' });

  const prev = (await query(
    `SELECT id FROM scar_assessments WHERE scar_id = $1 AND superseded_by IS NULL
     ORDER BY assessed_at DESC LIMIT 1`, [b.scarId],
  )).rows[0];
  const baseline = (await query(
    `SELECT id FROM scar_assessments WHERE scar_id = $1 AND is_baseline
     ORDER BY assessed_at ASC LIMIT 1`, [b.scarId],
  )).rows[0];

  const r = await query(
    `INSERT INTO scar_assessments
       (scar_id, wound_assessment_id, assessed_at, is_baseline,
        previous_assessment_id, baseline_assessment_id, quality_flag,
        quality_reason, measurement_method, notes, created_by)
     VALUES ($1,$2,COALESCE($3, NOW()),$4,$5,$6,$7,$8,$9,$10,$11) RETURNING *`,
    [b.scarId, b.woundAssessmentId || null, b.assessedAt || null,
     !baseline, prev ? prev.id : null, baseline ? baseline.id : null,
     b.qualityFlag || 'acceptable', b.qualityReason || null,
     b.measurementMethod || null, b.notes || null, user.id],
  );
  return res.status(201).json({ assessment: r.rows[0] });
}

/**
 * Records one validated scale.
 *
 * The total is recomputed here from the items rather than trusted from the
 * client, so a score in the record always matches the answers beside it.
 */
async function putScores(body, user, res) {
  const b = body || {};
  if (!b.assessmentId || !b.scale) {
    return res.status(400).json({ error: 'assessmentId and scale are required' });
  }
  if (await isFinalized(b.assessmentId)) {
    return res.status(409).json({ error: 'This assessment is finalized and cannot be edited' });
  }

  const scored = scoreScale(b.scale, b.items || {});
  if (!scored.ok) return res.status(400).json({ error: scored.reason });

  const r = await query(
    `INSERT INTO scar_validated_scores
       (assessment_id, scale, items, total, overall_item, complete, scored_by)
     VALUES ($1,$2,$3::jsonb,$4,$5,$6,$7)
     ON CONFLICT (assessment_id, scale) DO UPDATE SET
       items = EXCLUDED.items, total = EXCLUDED.total,
       overall_item = EXCLUDED.overall_item, complete = EXCLUDED.complete,
       scored_by = EXCLUDED.scored_by
     RETURNING *`,
    [b.assessmentId, b.scale, JSON.stringify(b.items || {}),
     scored.total, scored.overall, scored.complete, user.id],
  );
  return res.status(200).json({ score: r.rows[0], scored });
}

async function putExam(body, user, res) {
  const b = body || {};
  if (!b.assessmentId) return res.status(400).json({ error: 'assessmentId is required' });
  if (await isFinalized(b.assessmentId)) {
    return res.status(409).json({ error: 'This assessment is finalized and cannot be edited' });
  }
  const r = await query(
    `INSERT INTO scar_physical_exams
       (assessment_id, pliability, consistency, mobility, tenderness, compressibility,
        adherence, contracture_present, joint_involved, contracture_direction,
        rom_degrees, rom_deficit_degrees, functional_limitation, examiner_notes, examined_by)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)
     ON CONFLICT (assessment_id) DO UPDATE SET
       pliability=EXCLUDED.pliability, consistency=EXCLUDED.consistency,
       mobility=EXCLUDED.mobility, tenderness=EXCLUDED.tenderness,
       compressibility=EXCLUDED.compressibility, adherence=EXCLUDED.adherence,
       contracture_present=EXCLUDED.contracture_present,
       joint_involved=EXCLUDED.joint_involved,
       contracture_direction=EXCLUDED.contracture_direction,
       rom_degrees=EXCLUDED.rom_degrees, rom_deficit_degrees=EXCLUDED.rom_deficit_degrees,
       functional_limitation=EXCLUDED.functional_limitation,
       examiner_notes=EXCLUDED.examiner_notes, examined_by=EXCLUDED.examined_by
     RETURNING *`,
    [b.assessmentId, b.pliability || null, b.consistency || null, b.mobility || null,
     b.tenderness || null, b.compressibility || null, b.adherence || null,
     b.contracturePresent === undefined ? null : !!b.contracturePresent,
     b.jointInvolved || null, b.contractureDirection || null,
     num(b.romDegrees), num(b.romDeficitDegrees),
     b.functionalLimitation || null, b.examinerNotes || null, user.id],
  );
  return res.status(200).json({ exam: r.rows[0] });
}

async function putPatientReported(body, user, res) {
  const b = body || {};
  if (!b.assessmentId) return res.status(400).json({ error: 'assessmentId is required' });
  if (await isFinalized(b.assessmentId)) {
    return res.status(409).json({ error: 'This assessment is finalized and cannot be edited' });
  }
  const r = await query(
    `INSERT INTO scar_patient_reported
       (assessment_id, pain_0_10, itch_0_10, tightness_0_10, tenderness_0_10,
        functional_limitation_0_10, cosmetic_concern_0_10,
        treatment_satisfaction_0_10, free_text, recorded_by)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
     ON CONFLICT (assessment_id) DO UPDATE SET
       pain_0_10=EXCLUDED.pain_0_10, itch_0_10=EXCLUDED.itch_0_10,
       tightness_0_10=EXCLUDED.tightness_0_10, tenderness_0_10=EXCLUDED.tenderness_0_10,
       functional_limitation_0_10=EXCLUDED.functional_limitation_0_10,
       cosmetic_concern_0_10=EXCLUDED.cosmetic_concern_0_10,
       treatment_satisfaction_0_10=EXCLUDED.treatment_satisfaction_0_10,
       free_text=EXCLUDED.free_text, recorded_by=EXCLUDED.recorded_by
     RETURNING *`,
    [b.assessmentId, num(b.pain), num(b.itch), num(b.tightness), num(b.tenderness),
     num(b.functionalLimitation), num(b.cosmeticConcern),
     num(b.treatmentSatisfaction), b.freeText || null, user.id],
  );
  return res.status(200).json({ patientReported: r.rows[0] });
}

async function putColour(body, res) {
  const b = body || {};
  if (!b.assessmentId) return res.status(400).json({ error: 'assessmentId is required' });
  const r = await query(
    `INSERT INTO scar_colour_analysis
       (assessment_id, delta_e, erythema_index, lightness_delta, yellowness_delta,
        pigmentation, heterogeneity_ratio, scar_pixels, reference_pixels,
        reliability, reliability_reason, method_version)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
     ON CONFLICT (assessment_id) DO UPDATE SET
       delta_e=EXCLUDED.delta_e, erythema_index=EXCLUDED.erythema_index,
       lightness_delta=EXCLUDED.lightness_delta, yellowness_delta=EXCLUDED.yellowness_delta,
       pigmentation=EXCLUDED.pigmentation, heterogeneity_ratio=EXCLUDED.heterogeneity_ratio,
       scar_pixels=EXCLUDED.scar_pixels, reference_pixels=EXCLUDED.reference_pixels,
       reliability=EXCLUDED.reliability, reliability_reason=EXCLUDED.reliability_reason
     RETURNING *`,
    [b.assessmentId, num(b.deltaE), num(b.erythemaIndex), num(b.lightnessDelta),
     num(b.yellownessDelta), b.pigmentation || null, num(b.heterogeneityRatio),
     num(b.scarPixels), num(b.referencePixels), b.reliability || null,
     b.reliabilityReason || null, b.methodVersion || 'cielab-d65-v1'],
  );
  return res.status(200).json({ colour: r.rows[0] });
}

/** §67: finalized assessments are not edited, only superseded. */
async function finalize(body, user, res) {
  const b = body || {};
  if (!b.assessmentId) return res.status(400).json({ error: 'assessmentId is required' });
  const r = await query(
    `UPDATE scar_assessments SET finalized_by = $2, finalized_at = NOW()
     WHERE id = $1 AND finalized_at IS NULL RETURNING *`,
    [b.assessmentId, user.id],
  );
  if (!r.rows[0]) {
    return res.status(409).json({ error: 'Already finalized, or no such assessment' });
  }
  await audit(user, 'scar_assessment_finalized', { assessmentId: b.assessmentId });
  return res.status(200).json({ assessment: r.rows[0] });
}

async function ackAlert(body, user, res) {
  if (!body || !body.alertId) return res.status(400).json({ error: 'alertId is required' });
  const r = await query(
    `UPDATE scar_alerts SET acknowledged_by = $2, acknowledged_at = NOW()
     WHERE id = $1 AND acknowledged_at IS NULL RETURNING *`,
    [body.alertId, user.id],
  );
  if (!r.rows[0]) return res.status(404).json({ error: 'Alert not found or already acknowledged' });
  return res.status(200).json({ alert: r.rows[0] });
}

// ---------------------------------------------------------------------------

async function isFinalized(assessmentId) {
  const r = await query(
    'SELECT finalized_at FROM scar_assessments WHERE id = $1', [assessmentId]);
  return !!r.rows[0]?.finalized_at;
}

async function audit(user, action, details) {
  try {
    await query(
      `INSERT INTO audit_logs
         (user_id, user_name, user_role, action, resource_type, resource_id, details)
       VALUES ($1,$2,$3,$4,'scar',$5,$6)`,
      [String(user.id), user.name || user.fullName || null, user.role || null,
       action, String(details.assessmentId ?? details.scarId ?? ''), JSON.stringify(details)],
    );
  } catch (e) {
    console.warn('scar audit:', e.message);
  }
}

/**
 * Shared clinical utilities for WhatsApp messaging, consultant comments,
 * and auto-recommendations across encounters, vitals, investigations, and images.
 */

import { apiClient } from '../services/apiClient';

// ─── WhatsApp Messaging ──────────────────────────────────────────────────────

/** Cache for user phone lookups (name → phone) */
const userPhoneCache = new Map<string, string>();

/**
 * Lookup a staff member's phone number by their display name.
 * Checks cached results first, then queries the server.
 */
export async function lookupUserPhone(userName: string): Promise<string | null> {
  if (!userName || userName === 'Unknown') return null;

  const cached = userPhoneCache.get(userName.toLowerCase());
  if (cached !== undefined) return cached || null;

  try {
    const users = await apiClient.getUsers();
    if (Array.isArray(users)) {
      for (const u of users) {
        const fullName = u.full_name || u.name || `${u.first_name || ''} ${u.last_name || ''}`.trim();
        if (u.phone) {
          userPhoneCache.set(fullName.toLowerCase(), u.phone);
          userPhoneCache.set((u.name || '').toLowerCase(), u.phone);
          if (u.email) userPhoneCache.set(u.email.toLowerCase(), u.phone);
        }
      }
    }
  } catch {
    // Offline or error - no phone available
  }

  return userPhoneCache.get(userName.toLowerCase()) || null;
}

/**
 * Format a phone number for WhatsApp API (strip +, spaces, dashes).
 * Ensures Nigerian numbers start with 234.
 */
function formatPhoneForWhatsApp(phone: string): string {
  let cleaned = phone.replace(/[\s\-()]/g, '');
  // Remove leading +
  if (cleaned.startsWith('+')) cleaned = cleaned.substring(1);
  // Convert 0xx to 234xx (Nigerian format)
  if (cleaned.startsWith('0') && cleaned.length >= 10) {
    cleaned = '234' + cleaned.substring(1);
  }
  return cleaned;
}

/**
 * Open WhatsApp to send a message about a patient to the documenter.
 */
export function openWhatsAppForPatient(
  phone: string,
  patientName: string,
  patientHospitalNumber?: string,
  context?: string
): void {
  const waPhone = formatPhoneForWhatsApp(phone);
  const hn = patientHospitalNumber ? ` (${patientHospitalNumber})` : '';
  const ctx = context ? `\n\nRegarding: ${context}` : '';
  const message = `Hello, I'd like to discuss patient *${patientName}*${hn} from UNTH Plastic Surgery.${ctx}`;
  const encoded = encodeURIComponent(message);

  const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
  const url = isMobile
    ? `whatsapp://send?phone=${waPhone}&text=${encoded}`
    : `https://web.whatsapp.com/send?phone=${waPhone}&text=${encoded}`;

  window.open(url, '_blank');
}

// ─── Consultant Comments ─────────────────────────────────────────────────────

export interface ConsultantComment {
  id: string;
  entity_type: 'encounter' | 'investigation' | 'clinical_image' | 'vital_signs' | 'ward_round';
  entity_id: string;
  comment: string;
  author_name: string;
  author_role: string;
  created_at: string;
}

/** Save a consultant comment (tries server, falls back to localStorage) */
export async function saveConsultantComment(comment: Omit<ConsultantComment, 'id' | 'created_at'>): Promise<ConsultantComment> {
  const newComment: ConsultantComment = {
    ...comment,
    id: `cc_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
    created_at: new Date().toISOString(),
  };

  try {
    const resp = await apiClient.post<any>('/consultant-comments', newComment);
    if (resp?.id) newComment.id = resp.id;
  } catch {
    // Offline — save locally
  }

  // Always persist to localStorage as backup
  const key = `consultant_comments_${comment.entity_type}_${comment.entity_id}`;
  const existing = JSON.parse(localStorage.getItem(key) || '[]');
  existing.push(newComment);
  localStorage.setItem(key, JSON.stringify(existing));

  return newComment;
}

/** Load consultant comments for an entity */
export async function loadConsultantComments(entityType: string, entityId: string): Promise<ConsultantComment[]> {
  let comments: ConsultantComment[] = [];

  try {
    const resp = await apiClient.get<any>(`/consultant-comments?entityType=${entityType}&entityId=${entityId}`);
    if (Array.isArray(resp?.comments)) comments = resp.comments;
    else if (Array.isArray(resp)) comments = resp;
  } catch {
    // Offline
  }

  // Merge with localStorage
  const key = `consultant_comments_${entityType}_${entityId}`;
  const localComments: ConsultantComment[] = JSON.parse(localStorage.getItem(key) || '[]');

  // Deduplicate by id
  const seen = new Set(comments.map(c => c.id));
  for (const lc of localComments) {
    if (!seen.has(lc.id)) {
      comments.push(lc);
    }
  }

  return comments.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
}


// ─── Multi-Specialty Auto-Recommendations ────────────────────────────────────

interface VitalSignsInput {
  temperature?: number;
  pulse?: number;
  systolic_bp?: number;
  diastolic_bp?: number;
  respiratory_rate?: number;
  spo2?: number;
  blood_sugar?: number;
  pain_score?: number;
  urine_output?: number;
  weight?: number;
  height?: number;
}

interface LabResultInput {
  test_name: string;
  result_value?: string | number;
  value?: string | number;
  unit?: string;
  reference_range?: string;
  abnormal?: boolean;
  flag?: string;
}

interface FluidChartInput {
  total_intake?: number;
  total_output?: number;
  urine_output?: number;
  drain_output?: number;
  iv_fluid?: number;
  oral_fluid?: number;
  balance?: number;
}

export interface ClinicalRecommendation {
  specialty: string;
  severity: 'critical' | 'urgent' | 'routine' | 'info';
  recommendation: string;
  rationale: string;
}

/**
 * Generate multi-specialty recommendations based on vital signs.
 */
export function generateVitalSignRecommendations(vitals: VitalSignsInput): ClinicalRecommendation[] {
  const recs: ClinicalRecommendation[] = [];

  // ── Temperature ──
  if (vitals.temperature !== undefined) {
    const t = vitals.temperature;
    if (t >= 40) {
      recs.push({ specialty: 'Internal Medicine', severity: 'critical', recommendation: 'Initiate aggressive cooling measures. Blood cultures ×2, broad-spectrum antibiotics. Consider ICU admission.', rationale: `Hyperpyrexia (${t}°C) — risk of end-organ damage, possible sepsis.` });
      recs.push({ specialty: 'Infectious Disease', severity: 'critical', recommendation: 'Pan-culture (blood, urine, wound, sputum). Start empiric antibiotics covering Gram-positive, Gram-negative, and anaerobes.', rationale: `Severe fever ${t}°C — sepsis workup mandatory.` });
    } else if (t >= 38.5) {
      recs.push({ specialty: 'Internal Medicine', severity: 'urgent', recommendation: 'Investigate fever source. Send blood cultures, urinalysis, CXR. Consider antipyretics and IV hydration.', rationale: `High-grade fever (${t}°C) — infection likely.` });
      recs.push({ specialty: 'Plastic Surgery', severity: 'urgent', recommendation: 'Inspect all surgical wounds for signs of infection (erythema, purulent discharge, dehiscence). Consider wound swab for MCS.', rationale: `Fever in a surgical patient — wound infection must be excluded.` });
    } else if (t >= 37.5) {
      recs.push({ specialty: 'General Practice', severity: 'routine', recommendation: 'Monitor temperature trend q4h. Ensure adequate hydration. Consider paracetamol PRN.', rationale: `Low-grade fever (${t}°C) — may indicate early infection or inflammatory response.` });
    } else if (t < 35) {
      recs.push({ specialty: 'Emergency Medicine', severity: 'critical', recommendation: 'Active rewarming (warm IV fluids, blankets). Continuous cardiac monitoring. Check thyroid function.', rationale: `Hypothermia (${t}°C) — risk of cardiac arrhythmias.` });
      recs.push({ specialty: 'Anaesthesiology', severity: 'urgent', recommendation: 'Assess for post-operative hypothermia. Consider warm air blanket. Monitor coagulation.', rationale: `Hypothermia impairs coagulation and wound healing.` });
    }
  }

  // ── Blood Pressure ──
  if (vitals.systolic_bp !== undefined) {
    const sys = vitals.systolic_bp;
    const dia = vitals.diastolic_bp || 0;
    if (sys >= 180 || dia >= 120) {
      recs.push({ specialty: 'Cardiology', severity: 'critical', recommendation: 'Hypertensive emergency. IV antihypertensive (labetalol/nicardipine). Target 25% BP reduction in first hour. ECG, troponin, renal function, fundoscopy.', rationale: `Severe hypertension (${sys}/${dia} mmHg) — risk of stroke, MI, aortic dissection.` });
      recs.push({ specialty: 'Nephrology', severity: 'urgent', recommendation: 'Check renal function urgently (Cr, BUN, electrolytes). Urinalysis for proteinuria/hematuria. Consider renal ultrasound.', rationale: `Malignant hypertension — renal involvement must be assessed.` });
      recs.push({ specialty: 'Neurology', severity: 'urgent', recommendation: 'Assess for hypertensive encephalopathy (headache, confusion, visual changes). Consider CT head if symptomatic.', rationale: `Severe hypertension — cerebrovascular event risk.` });
    } else if (sys >= 160 || dia >= 100) {
      recs.push({ specialty: 'Cardiology', severity: 'urgent', recommendation: 'Optimize antihypertensive therapy. Consider adding or increasing ACE-I/ARB, CCB, or thiazide. Recheck BP in 30 minutes.', rationale: `Stage 2 hypertension (${sys}/${dia} mmHg).` });
    } else if (sys >= 140 || dia >= 90) {
      recs.push({ specialty: 'Internal Medicine', severity: 'routine', recommendation: 'Review current antihypertensive regimen. Lifestyle modifications (sodium restriction, exercise). Repeat BP measurement.', rationale: `Stage 1 hypertension (${sys}/${dia} mmHg).` });
    } else if (sys < 90 || dia < 60) {
      recs.push({ specialty: 'Emergency Medicine', severity: 'critical', recommendation: 'Assess for shock (hypovolemic, cardiogenic, septic, neurogenic). IV fluid bolus 20mL/kg NS. Establish large-bore IV access ×2.', rationale: `Hypotension (${sys}/${dia} mmHg) — inadequate tissue perfusion.` });
      recs.push({ specialty: 'Surgery', severity: 'urgent', recommendation: 'Exclude surgical bleeding (check drains, wound sites, abdomen). Consider urgent FBC and group & cross-match.', rationale: `Post-operative hypotension — hemorrhage must be excluded.` });
      recs.push({ specialty: 'Anaesthesiology', severity: 'urgent', recommendation: 'Review IV fluid status and drug chart. Hold antihypertensives. Consider vasopressor support if not responding to fluids.', rationale: `Hemodynamic instability requiring fluid resuscitation.` });
    }
  }

  // ── Heart Rate / Pulse ──
  if (vitals.pulse !== undefined) {
    const hr = vitals.pulse;
    if (hr > 150) {
      recs.push({ specialty: 'Cardiology', severity: 'critical', recommendation: 'Urgent 12-lead ECG. If SVT: vagal maneuvers then adenosine. If AF with RVR: rate control with diltiazem/metoprolol. Consider cardioversion if unstable.', rationale: `Severe tachycardia (${hr} bpm) — hemodynamically significant arrhythmia.` });
      recs.push({ specialty: 'Emergency Medicine', severity: 'critical', recommendation: 'Assess airway, breathing, circulation. Continuous cardiac monitoring. IV access. Prepare for possible cardioversion.', rationale: `Heart rate ${hr} bpm — assess stability and treat underlying cause.` });
    } else if (hr > 100) {
      recs.push({ specialty: 'Internal Medicine', severity: 'urgent', recommendation: 'Determine etiology: pain, fever, hypovolemia, anemia, anxiety, PE. ECG, FBC, electrolytes. Treat underlying cause.', rationale: `Tachycardia (${hr} bpm) — multifactorial workup needed.` });
      recs.push({ specialty: 'Haematology', severity: 'routine', recommendation: 'Check FBC for anemia (Hb, PCV). If anemic, determine type (iron studies, B12, folate, reticulocyte count).', rationale: `Tachycardia may indicate compensatory response to anemia.` });
    } else if (hr < 50) {
      recs.push({ specialty: 'Cardiology', severity: 'critical', recommendation: 'Urgent ECG — rule out complete heart block, sick sinus syndrome. Atropine 0.5mg IV if symptomatic. Consider temporary pacing.', rationale: `Severe bradycardia (${hr} bpm) — risk of syncope and cardiac arrest.` });
      recs.push({ specialty: 'Pharmacology', severity: 'urgent', recommendation: 'Review drug chart for rate-limiting medications (beta-blockers, calcium channel blockers, digoxin, amiodarone). Hold and reassess.', rationale: `Drug-induced bradycardia must be excluded.` });
    } else if (hr < 60) {
      recs.push({ specialty: 'Cardiology', severity: 'routine', recommendation: 'ECG to assess rhythm. Monitor for symptoms (dizziness, syncope). Review medications affecting heart rate.', rationale: `Bradycardia (${hr} bpm) — may be physiological or pathological.` });
    }
  }

  // ── Respiratory Rate ──
  if (vitals.respiratory_rate !== undefined) {
    const rr = vitals.respiratory_rate;
    if (rr > 30) {
      recs.push({ specialty: 'Pulmonology', severity: 'critical', recommendation: 'Immediate ABG. CXR urgently. Consider CTPA if PE suspected. Prepare for possible intubation. High-flow O₂.', rationale: `Severe tachypnea (${rr}/min) — respiratory failure risk.` });
      recs.push({ specialty: 'Emergency Medicine', severity: 'critical', recommendation: 'Assess work of breathing. Continuous SpO₂ monitoring. Consider NIV (BiPAP/CPAP). Call critical care early.', rationale: `RR ${rr}/min indicates severe respiratory distress.` });
    } else if (rr > 20) {
      recs.push({ specialty: 'Internal Medicine', severity: 'urgent', recommendation: 'ABG or VBG. CXR. Assess for pain, anxiety, metabolic acidosis (DKA, sepsis, renal failure). Treat cause.', rationale: `Tachypnea (${rr}/min) — compensatory or pathological.` });
    } else if (rr < 10) {
      recs.push({ specialty: 'Anaesthesiology', severity: 'critical', recommendation: 'Assess consciousness level (GCS). Check for opioid overdose — naloxone 0.4mg IV if suspected. Prepare for airway management.', rationale: `Severe bradypnea (${rr}/min) — risk of respiratory arrest.` });
    }
  }

  // ── SpO2 ──
  if (vitals.spo2 !== undefined) {
    const spo2 = vitals.spo2;
    if (spo2 < 88) {
      recs.push({ specialty: 'Pulmonology', severity: 'critical', recommendation: 'High-flow O₂ (15L NRB mask). Urgent ABG. CXR. Consider intubation if not improving. Assess for pneumonia, PE, ARDS, pneumothorax.', rationale: `Severe hypoxemia (SpO₂ ${spo2}%) — life-threatening.` });
    } else if (spo2 < 92) {
      recs.push({ specialty: 'Internal Medicine', severity: 'urgent', recommendation: 'Supplemental O₂ to target SpO₂ 94-98% (88-92% if COPD). ABG. CXR. Investigate cause.', rationale: `Hypoxemia (SpO₂ ${spo2}%) — oxygen therapy required.` });
    } else if (spo2 < 95) {
      recs.push({ specialty: 'General Practice', severity: 'routine', recommendation: 'Monitor SpO₂ closely. Consider supplemental O₂ if symptomatic. Deep breathing exercises.', rationale: `Borderline SpO₂ (${spo2}%) — monitor trend.` });
    }
  }

  // ── Blood Sugar ──
  if (vitals.blood_sugar !== undefined) {
    const bs = vitals.blood_sugar;
    if (bs < 54) {
      recs.push({ specialty: 'Endocrinology', severity: 'critical', recommendation: 'Level 2 hypoglycemia. If conscious: 15-20g fast-acting glucose. If unconscious: 50mL of 50% dextrose IV or glucagon 1mg IM. Recheck in 15 min.', rationale: `Severe hypoglycemia (${bs} mg/dL) — neuroglycopenic symptoms, seizure risk.` });
    } else if (bs < 70) {
      recs.push({ specialty: 'Endocrinology', severity: 'urgent', recommendation: 'Level 1 hypoglycemia. Oral glucose 15-20g. Recheck in 15 minutes. Review insulin/OHA doses.', rationale: `Hypoglycemia (${bs} mg/dL) — risk of deterioration.` });
    } else if (bs > 500) {
      recs.push({ specialty: 'Endocrinology', severity: 'critical', recommendation: 'DKA/HHS workup: ABG, electrolytes, serum ketones, osmolality. IV NS 1L/hr. Insulin infusion protocol. ICU referral.', rationale: `Severe hyperglycemia (${bs} mg/dL) — DKA or HHS likely.` });
    } else if (bs > 300) {
      recs.push({ specialty: 'Endocrinology', severity: 'urgent', recommendation: 'Sliding scale insulin. Check ketones. IV hydration. Electrolytes. Review current diabetic regimen.', rationale: `Significant hyperglycemia (${bs} mg/dL).` });
    } else if (bs > 180) {
      recs.push({ specialty: 'Endocrinology', severity: 'routine', recommendation: 'Review diabetic management. Adjust insulin/OHA. Dietary counseling. HbA1c if not done recently.', rationale: `Hyperglycemia (${bs} mg/dL) above target range.` });
    }
  }

  // ── Urine Output ──
  if (vitals.urine_output !== undefined) {
    const uo = vitals.urine_output;
    if (uo < 15) {
      recs.push({ specialty: 'Nephrology', severity: 'critical', recommendation: 'Anuria/severe oliguria. Fluid challenge 250mL NS bolus. Catheter flush/change to exclude obstruction. Urgent renal function, K+. Consider furosemide 40-80mg IV.', rationale: `Urine output ${uo} mL/hr — AKI likely. KDIGO staging needed.` });
      recs.push({ specialty: 'Urology', severity: 'urgent', recommendation: 'Exclude urinary obstruction. Bladder scan. Consider catheter change. Renal USS if post-renal cause suspected.', rationale: `Very low urine output — obstructive uropathy must be excluded.` });
    } else if (uo < 30) {
      recs.push({ specialty: 'Nephrology', severity: 'urgent', recommendation: 'Oliguria. Check renal function, electrolytes. Assess fluid status clinically. Consider fluid challenge if hypovolemic.', rationale: `Urine output ${uo} mL/hr — suboptimal renal perfusion.` });
      recs.push({ specialty: 'Surgery', severity: 'routine', recommendation: 'Review fluid balance chart. Consider IV fluid adjustment. Monitor drain output.', rationale: `Low urine output post-operatively may indicate hypovolemia.` });
    }
  }

  // ── Pain Score ──
  if (vitals.pain_score !== undefined) {
    const ps = vitals.pain_score;
    if (ps >= 8) {
      recs.push({ specialty: 'Pain Medicine / Anaesthesiology', severity: 'critical', recommendation: 'Severe pain. IV opioid titration (morphine 2-4mg IV q5-10min). Consider PCA. Multimodal analgesia. Exclude surgical complication.', rationale: `Pain score ${ps}/10 — inadequate analgesia, patient distress.` });
      recs.push({ specialty: 'Plastic Surgery', severity: 'urgent', recommendation: 'Assess surgical site for compartment syndrome, hematoma, wound infection, or flap compromise causing severe pain.', rationale: `Severe post-operative pain may indicate surgical complication.` });
    } else if (ps >= 5) {
      recs.push({ specialty: 'Pain Medicine', severity: 'urgent', recommendation: 'Moderate pain. Step up analgesia: add tramadol 50-100mg q6h or consider weak opioid. Ensure regular paracetamol and NSAID (if not contraindicated).', rationale: `Pain score ${ps}/10 — pain control needs optimization.` });
    } else if (ps >= 3) {
      recs.push({ specialty: 'General Practice', severity: 'routine', recommendation: 'Mild pain. Continue regular paracetamol 1g q6h. Consider NSAID. Non-pharmacological measures (positioning, ice).', rationale: `Pain score ${ps}/10 — manageable but should be addressed.` });
    }
  }

  // ── BMI (if weight + height) ──
  if (vitals.weight && vitals.height) {
    const heightM = vitals.height > 3 ? vitals.height / 100 : vitals.height;
    const bmi = vitals.weight / (heightM * heightM);
    if (bmi < 16) {
      recs.push({ specialty: 'Nutrition / Dietetics', severity: 'urgent', recommendation: 'Severe undernutrition (BMI ' + bmi.toFixed(1) + '). Nutritional assessment. Consider NG/NJ feeding. Refeeding syndrome precautions. Thiamine before feeding.', rationale: `BMI ${bmi.toFixed(1)} — severe malnutrition, poor wound healing risk.` });
    } else if (bmi < 18.5) {
      recs.push({ specialty: 'Nutrition / Dietetics', severity: 'routine', recommendation: 'Underweight (BMI ' + bmi.toFixed(1) + '). High-calorie, high-protein diet. Consider nutritional supplements. Monitor weight weekly.', rationale: `Low BMI affects surgical outcomes and wound healing.` });
    } else if (bmi > 40) {
      recs.push({ specialty: 'Anaesthesiology', severity: 'urgent', recommendation: 'Morbid obesity (BMI ' + bmi.toFixed(1) + '). Difficult airway assessment. DVT prophylaxis (weight-adjusted). Position carefully for pressure areas.', rationale: `Morbid obesity — increased perioperative risk.` });
    }
  }

  return recs;
}

/**
 * Generate multi-specialty recommendations based on lab results.
 */
export function generateLabRecommendations(results: LabResultInput[]): ClinicalRecommendation[] {
  const recs: ClinicalRecommendation[] = [];

  for (const r of results) {
    const name = (r.test_name || '').toLowerCase();
    const val = typeof r.result_value === 'string' ? parseFloat(r.result_value) : (typeof r.result_value === 'number' ? r.result_value : (typeof r.value === 'string' ? parseFloat(r.value as string) : (r.value as number)));
    if (isNaN(val)) continue;

    // ── Potassium ──
    if (name.includes('potassium') || name === 'k+' || name === 'k') {
      if (val < 2.5) {
        recs.push({ specialty: 'Nephrology', severity: 'critical', recommendation: 'Severe hypokalaemia. IV KCl replacement (max 40mmol/hr via central line, 10mmol/hr peripheral). Continuous cardiac monitoring. Check Mg²⁺.', rationale: `K⁺ ${val} mmol/L — cardiac arrest risk (VF/VT).` });
        recs.push({ specialty: 'Cardiology', severity: 'critical', recommendation: 'Urgent 12-lead ECG. Look for U waves, flattened T waves, ST depression, prolonged QT. Continuous telemetry.', rationale: `Severe hypokalaemia (${val} mmol/L) — life-threatening arrhythmia risk.` });
      } else if (val < 3.5) {
        recs.push({ specialty: 'Internal Medicine', severity: 'urgent', recommendation: `Hypokalaemia (K⁺ ${val}). Oral KCl supplementation 20-40mmol TDS. Recheck in 4-6 hours. Check Mg²⁺ (concurrent hypomagnesaemia impairs correction).`, rationale: `K⁺ ${val} mmol/L — risk of arrhythmias, muscle weakness.` });
      } else if (val > 6.0) {
        recs.push({ specialty: 'Nephrology', severity: 'critical', recommendation: 'Severe hyperkalaemia. IV calcium gluconate 10mL 10% (cardioprotection). Insulin 10U + 50mL 50% dextrose. Nebulized salbutamol. Consider dialysis.', rationale: `K⁺ ${val} mmol/L — cardiac arrest risk.` });
        recs.push({ specialty: 'Cardiology', severity: 'critical', recommendation: 'Urgent ECG: tall peaked T waves, widened QRS, loss of P waves. Continuous monitoring. Calcium gluconate for cardioprotection.', rationale: `K⁺ ${val} mmol/L — ECG changes may precede VF.` });
      } else if (val > 5.5) {
        recs.push({ specialty: 'Internal Medicine', severity: 'urgent', recommendation: `Hyperkalaemia (K⁺ ${val}). ECG. Stop K⁺-sparing drugs and supplements. Calcium resonium 15g PO. Recheck in 2 hours.`, rationale: `K⁺ ${val} mmol/L — arrhythmia risk.` });
      }
    }

    // ── Sodium ──
    if (name.includes('sodium') || name === 'na+' || name === 'na') {
      if (val < 120) {
        recs.push({ specialty: 'Nephrology', severity: 'critical', recommendation: 'Severe hyponatraemia. Fluid restrict to 500mL/24h. Consider 3% NaCl 100mL over 10min if seizures. Correct slowly (max 8mmol/24h to avoid osmotic demyelination).', rationale: `Na⁺ ${val} mmol/L — seizure and cerebral oedema risk.` });
        recs.push({ specialty: 'Endocrinology', severity: 'urgent', recommendation: 'Assess volume status. Check serum and urine osmolality. Consider SIADH, adrenal insufficiency, hypothyroidism.', rationale: `Severe hyponatraemia — etiology must guide treatment.` });
      } else if (val < 130) {
        recs.push({ specialty: 'Internal Medicine', severity: 'urgent', recommendation: `Hyponatraemia (Na⁺ ${val}). Fluid restrict. Check serum/urine osmolality and urine Na⁺. Assess volume status. Correct slowly.`, rationale: `Na⁺ ${val} mmol/L — risk of confusion, falls, seizures.` });
      } else if (val > 155) {
        recs.push({ specialty: 'Nephrology', severity: 'critical', recommendation: 'Severe hypernatraemia. Free water replacement (D5W or 0.45% NaCl). Correct slowly (max 10mmol/24h). Monitor Na⁺ q4-6h.', rationale: `Na⁺ ${val} mmol/L — risk of cerebral hemorrhage, coma.` });
      } else if (val > 148) {
        recs.push({ specialty: 'Internal Medicine', severity: 'urgent', recommendation: `Hypernatraemia (Na⁺ ${val}). Assess hydration. Increase free water intake. Review medications (diuretics).`, rationale: `Na⁺ ${val} mmol/L — dehydration likely.` });
      }
    }

    // ── Hemoglobin ──
    if (name.includes('haemoglobin') || name.includes('hemoglobin') || name === 'hb' || name === 'hgb') {
      if (val < 5) {
        recs.push({ specialty: 'Haematology', severity: 'critical', recommendation: 'Severe anemia — IMMEDIATE transfusion. Group & cross-match. Transfuse 2-4 units PRBCs. Investigate cause urgently.', rationale: `Hb ${val} g/dL — life-threatening anemia.` });
      } else if (val < 7) {
        recs.push({ specialty: 'Haematology', severity: 'urgent', recommendation: `Significant anemia (Hb ${val}). Consider transfusion (threshold 7g/dL for stable patients, 8g/dL for cardiac patients). Iron studies, reticulocyte count.`, rationale: `Hb ${val} g/dL — symptomatic anemia likely.` });
        recs.push({ specialty: 'Surgery', severity: 'urgent', recommendation: 'Postpone elective surgery until Hb optimized. Investigate and treat anemia. Consider IV iron if oral insufficient.', rationale: `Low Hb increases surgical morbidity and impairs wound healing.` });
      } else if (val < 10) {
        recs.push({ specialty: 'Internal Medicine', severity: 'routine', recommendation: `Mild-moderate anemia (Hb ${val}). Iron studies, B12, folate, reticulocyte count. Oral iron if iron-deficient.`, rationale: `Hb ${val} g/dL — investigate etiology.` });
      }
    }

    // ── WBC ──
    if (name.includes('white') || name.includes('wbc') || name.includes('leucocyte') || name.includes('leukocyte')) {
      if (val > 20) {
        recs.push({ specialty: 'Infectious Disease', severity: 'urgent', recommendation: `Significant leukocytosis (WBC ${val}). Pan-culture. CXR. Consider CT abdomen if source unclear. Broad-spectrum antibiotics if septic.`, rationale: `WBC ${val} — severe infection or inflammatory response.` });
      } else if (val > 11) {
        recs.push({ specialty: 'Internal Medicine', severity: 'routine', recommendation: `Leukocytosis (WBC ${val}). May be infection, stress response, or steroid-induced. Clinical correlation required.`, rationale: `Elevated WBC — monitor trend and treat underlying cause.` });
      } else if (val < 2) {
        recs.push({ specialty: 'Haematology', severity: 'critical', recommendation: `Severe leukopenia (WBC ${val}). Neutrophil count needed. Reverse isolation. Avoid IM injections. Consider G-CSF.`, rationale: `WBC ${val} — immunocompromised, high infection risk.` });
      } else if (val < 4) {
        recs.push({ specialty: 'Haematology', severity: 'routine', recommendation: `Leukopenia (WBC ${val}). Check differential. Review medications (chemotherapy, immunosuppressants). Monitor for infection.`, rationale: `Low WBC — infection susceptibility.` });
      }
    }

    // ── Platelets ──
    if (name.includes('platelet') || name === 'plt') {
      if (val < 20) {
        recs.push({ specialty: 'Haematology', severity: 'critical', recommendation: `Critical thrombocytopenia (Plt ${val}). Platelet transfusion. Avoid invasive procedures. Check coagulation. Screen for DIC.`, rationale: `Platelets ${val} — spontaneous bleeding risk (intracranial, GI).` });
      } else if (val < 50) {
        recs.push({ specialty: 'Haematology', severity: 'urgent', recommendation: `Thrombocytopenia (Plt ${val}). Hold anticoagulants/NSAIDs. Investigate cause. Platelet transfusion if active bleeding or pre-procedure.`, rationale: `Platelets ${val} — increased bleeding risk.` });
      } else if (val < 100) {
        recs.push({ specialty: 'Haematology', severity: 'routine', recommendation: `Mild thrombocytopenia (Plt ${val}). Monitor trend. Review medications (heparin — HIT screen if indicated). Peripheral smear.`, rationale: `Platelets ${val} — usually safe but investigate cause.` });
      }
    }

    // ── Creatinine ──
    if (name.includes('creatinine') || name === 'cr') {
      if (val > 5) {
        recs.push({ specialty: 'Nephrology', severity: 'critical', recommendation: `Severe renal impairment (Cr ${val}). Urgent electrolytes (K⁺!). Consider dialysis. Dose-adjust all medications. Avoid nephrotoxins.`, rationale: `Creatinine ${val} — advanced renal failure.` });
      } else if (val > 2) {
        recs.push({ specialty: 'Nephrology', severity: 'urgent', recommendation: `Elevated creatinine (${val}). Compare with baseline. Assess fluid status. Renal USS. Avoid NSAIDs and nephrotoxic drugs.`, rationale: `Creatinine ${val} — significant renal dysfunction.` });
      } else if (val > 1.2) {
        recs.push({ specialty: 'Internal Medicine', severity: 'routine', recommendation: `Mildly elevated creatinine (${val}). Check trend. Ensure adequate hydration. Review medications for nephrotoxicity.`, rationale: `Cr ${val} — mild renal impairment, monitor.` });
      }
    }

    // ── Glucose (fasting/random) ──
    if (name.includes('glucose') || name.includes('sugar') || name === 'fbg' || name === 'rbs' || name === 'fbs') {
      if (val < 54) {
        recs.push({ specialty: 'Endocrinology', severity: 'critical', recommendation: `Hypoglycemia (${val}). Immediate IV 50% dextrose 50mL or oral glucose if conscious. Check insulin/OHA doses. Rule out insulinoma if recurrent.`, rationale: `Blood glucose ${val} mg/dL — neuroglycopenia risk.` });
      } else if (val > 400) {
        recs.push({ specialty: 'Endocrinology', severity: 'critical', recommendation: `Severe hyperglycemia (${val}). DKA/HHS protocol. IV insulin infusion. Aggressive hydration. Potassium replacement.`, rationale: `Glucose ${val} mg/dL — diabetic emergency.` });
      }
    }

    // ── Troponin ──
    if (name.includes('troponin')) {
      if (val > 0.04) {
        recs.push({ specialty: 'Cardiology', severity: 'critical', recommendation: 'Elevated troponin — acute myocardial injury. 12-lead ECG stat. Serial troponins q3h. Aspirin 300mg, heparin. Consider urgent angiography.', rationale: `Troponin ${val} — Type 1 or Type 2 MI, myocarditis, or PE must be considered.` });
        recs.push({ specialty: 'Internal Medicine', severity: 'urgent', recommendation: 'Assess for ACS symptoms (chest pain, dyspnea). ECG changes (ST elevation/depression, T wave inversion). Cardiology consult stat.', rationale: `Troponin elevation requires urgent cardiac evaluation.` });
      }
    }

    // ── INR ──
    if (name.includes('inr') || name === 'inr') {
      if (val > 5) {
        recs.push({ specialty: 'Haematology', severity: 'critical', recommendation: `INR ${val} — hold warfarin. IV vitamin K 5-10mg. Check for active bleeding. Consider FFP/PCC if bleeding.`, rationale: `Supratherapeutic INR — major bleeding risk.` });
      } else if (val > 3.5) {
        recs.push({ specialty: 'Haematology', severity: 'urgent', recommendation: `INR ${val} — hold warfarin. Oral vitamin K 1-2mg. Recheck next day. Assess for new interactions (antibiotics, diet changes).`, rationale: `High INR — bleed risk.` });
      }
    }

    // ── Albumin ──
    if (name.includes('albumin') && !name.includes('globulin')) {
      if (val < 20) {
        recs.push({ specialty: 'Nutrition / Dietetics', severity: 'urgent', recommendation: `Severe hypoalbuminaemia (${val} g/L). IV albumin if indicated. High-protein diet. Consider enteral nutrition.`, rationale: `Albumin ${val} g/L — poor nutritional status, impaired wound healing, edema.` });
        recs.push({ specialty: 'Plastic Surgery', severity: 'urgent', recommendation: 'Optimize nutrition pre-operatively. Wound healing will be significantly impaired. Consider delaying elective reconstruction.', rationale: `Low albumin correlates with wound dehiscence and flap failure.` });
      } else if (val < 30) {
        recs.push({ specialty: 'Internal Medicine', severity: 'routine', recommendation: `Low albumin (${val} g/L). Nutritional supplementation. Investigate cause (liver disease, nephrotic syndrome, malabsorption).`, rationale: `Hypoalbuminaemia affects drug binding and wound healing.` });
      }
    }
  }

  return recs;
}

/**
 * Generate recommendations from fluid chart data.
 */
export function generateFluidChartRecommendations(fluid: FluidChartInput): ClinicalRecommendation[] {
  const recs: ClinicalRecommendation[] = [];

  if (fluid.balance !== undefined) {
    if (fluid.balance > 2000) {
      recs.push({ specialty: 'Nephrology', severity: 'urgent', recommendation: 'Significant positive fluid balance. Assess for fluid overload (crackles, pedal edema, raised JVP). Consider furosemide if overloaded.', rationale: `Fluid balance +${fluid.balance}mL — risk of pulmonary edema.` });
      recs.push({ specialty: 'Cardiology', severity: 'routine', recommendation: 'Assess cardiac function if large positive balance. Consider echocardiogram if heart failure suspected.', rationale: `Positive balance may precipitate or worsen heart failure.` });
    } else if (fluid.balance < -1500) {
      recs.push({ specialty: 'Internal Medicine', severity: 'urgent', recommendation: 'Large negative fluid balance. Assess hydration status. Consider increasing IV fluids. Monitor renal function and urine output.', rationale: `Fluid balance ${fluid.balance}mL — dehydration risk.` });
    }
  }

  if (fluid.total_intake !== undefined && fluid.total_output !== undefined) {
    const ratio = fluid.total_intake / (fluid.total_output || 1);
    if (ratio > 3 && fluid.total_output < 500) {
      recs.push({ specialty: 'Nephrology', severity: 'urgent', recommendation: 'Very low output despite adequate intake. Rule out AKI, urinary obstruction. Urgent renal function. Consider catheter placement/flush.', rationale: `Intake:output ratio ${ratio.toFixed(1)}:1 with low output — renal concern.` });
    }
  }

  if (fluid.urine_output !== undefined && fluid.urine_output < 0.5) {
    recs.push({ specialty: 'Nephrology', severity: 'urgent', recommendation: 'Oliguria (<0.5 mL/kg/hr). Fluid challenge if hypovolemic. Check renal function. Consider furosemide stress test.', rationale: `Urine output critically low — AKI criteria met.` });
  }

  return recs;
}

/**
 * Get severity color for a recommendation.
 */
export function getRecommendationSeverityColor(severity: ClinicalRecommendation['severity']): { bg: string; text: string; border: string; badge: string } {
  switch (severity) {
    case 'critical': return { bg: 'bg-red-50', text: 'text-red-900', border: 'border-red-300', badge: 'bg-red-600 text-white' };
    case 'urgent': return { bg: 'bg-orange-50', text: 'text-orange-900', border: 'border-orange-300', badge: 'bg-orange-500 text-white' };
    case 'routine': return { bg: 'bg-blue-50', text: 'text-blue-900', border: 'border-blue-300', badge: 'bg-blue-500 text-white' };
    case 'info': return { bg: 'bg-gray-50', text: 'text-gray-900', border: 'border-gray-300', badge: 'bg-gray-500 text-white' };
  }
}

/**
 * Builds the pre-surgical brief as a real PowerPoint file.
 *
 * WHY A FILE AND NOT JUST THE ON-SCREEN DECK
 * The in-app briefing works when the app does. A theatre projector on a laptop
 * with no session, a consultant preparing on a plane, a copy filed with the
 * notes, a deck emailed to an anaesthetist who does not use this system — all
 * of those need something that outlives the app. `.pptx` is what the department
 * already reads and edits.
 *
 * THE RULE THAT MATTERS MOST
 * Nothing here invents clinical data. Every field is drawn from what was
 * recorded, and anything absent is printed as "Not documented" — never blank,
 * never zero, never an inferred value. A brief is the document a room makes
 * decisions from, so an empty cell that reads as "normal" is the dangerous
 * failure, not the ugly one.
 *
 * Generated in the browser. The photographs are already in the client, the file
 * never touches the server, and a patient's images are not copied anywhere new
 * to build it.
 */

import type {
  ConferenceData,
  ClinicalPhotograph,
  LabResult,
  Medication,
  PlannedProcedure,
} from './preSurgicalConferenceService';
import type { BriefOutcome } from './preSurgicalBriefService';

/** House palette — one set of colours used by every slide. */
const C = {
  navy: '0B2545',
  navyLight: '13315C',
  accent: '1B7F79',
  amber: 'B45309',
  red: 'B91C1C',
  green: '15803D',
  slate: '475569',
  mist: 'F1F5F9',
  white: 'FFFFFF',
} as const;

const NOT_DOCUMENTED = 'Not documented';

/** A header cell, in the house style. */
const H = (text: string) => ({
  text,
  options: { bold: true, color: C.white, fill: { color: C.navyLight } },
});

/** A body row. pptxgenjs wants cell objects, not bare strings. */
const R = (cells: (string | number | null | undefined)[]) =>
  cells.map(c => ({ text: c == null ? NOT_DOCUMENTED : String(c) }));

/** Renders a value, or the honest absence of one. */
function shown(v: unknown): string {
  if (v === null || v === undefined) return NOT_DOCUMENTED;
  const s = String(v).trim();
  return s.length ? s : NOT_DOCUMENTED;
}

function formatDate(value: string | null | undefined): string {
  if (!value) return NOT_DOCUMENTED;
  const d = new Date(value);
  return Number.isFinite(d.getTime()) ? d.toLocaleString() : String(value);
}

function ageFromDob(dob: string | null | undefined): string {
  if (!dob) return NOT_DOCUMENTED;
  const d = new Date(dob);
  if (!Number.isFinite(d.getTime())) return NOT_DOCUMENTED;
  const years = Math.floor((Date.now() - d.getTime()) / 3.15576e10);
  return years >= 0 && years < 130 ? `${years} yrs` : NOT_DOCUMENTED;
}

/** Lab result payloads vary by source; flatten whatever shape arrived. */
function labValue(r: LabResult): string {
  const v = r.results;
  if (v == null) return NOT_DOCUMENTED;
  if (typeof v === 'string' || typeof v === 'number') return shown(v);
  if (Array.isArray(v)) {
    return v.map(x => (typeof x === 'object' && x
      ? `${x.test_name ?? x.name ?? ''} ${x.result_value ?? x.value ?? ''} ${x.unit ?? ''}`.trim()
      : String(x))).filter(Boolean).join('; ') || NOT_DOCUMENTED;
  }
  if (typeof v === 'object') {
    const entries = Object.entries(v as Record<string, unknown>)
      .filter(([, val]) => val != null && String(val).trim() !== '');
    return entries.length ? entries.map(([k, val]) => `${k}: ${val}`).join('; ') : NOT_DOCUMENTED;
  }
  return NOT_DOCUMENTED;
}

/**
 * Fetch a photograph and inline it as a data URL.
 *
 * pptxgenjs must embed the bytes — a URL in the file would point at an
 * authenticated endpoint that nobody opening the deck can reach. A photograph
 * that cannot be fetched is dropped and reported, never silently skipped.
 */
async function toDataUrl(url: string): Promise<string | null> {
  try {
    if (url.startsWith('data:')) return url;
    const res = await fetch(url, { credentials: 'include' });
    if (!res.ok) return null;
    const blob = await res.blob();
    return await new Promise<string | null>(resolve => {
      const reader = new FileReader();
      reader.onerror = () => resolve(null);
      reader.onload = () => resolve(String(reader.result || '') || null);
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

export interface BriefPptxResult {
  blob: Blob;
  fileName: string;
  /** Photographs that could not be embedded, so the caller can say so. */
  omittedPhotographs: number;
}

export interface BriefPptxOptions {
  /** Decisions recorded during the briefing, if it has already been held. */
  outcome?: BriefOutcome | null;
  /** Shown in the footer so a printed copy is attributable. */
  preparedBy?: string;
}

/**
 * Build the deck.
 *
 * Returns the file rather than downloading it, so the caller decides whether to
 * save it, attach it, or hand it to the share sheet on a phone.
 */
export async function buildBriefPptx(
  data: ConferenceData,
  options: BriefPptxOptions = {}
): Promise<BriefPptxResult> {
  // Loaded on demand: pptxgenjs is ~1 MB and no one who is not exporting
  // should pay for it on first paint.
  const PptxGenJS = (await import('pptxgenjs')).default;
  const pptx = new PptxGenJS();

  pptx.layout = 'LAYOUT_16x9';
  pptx.author = options.preparedBy || 'UNTH Plastic Surgery';
  pptx.company = 'University of Nigeria Teaching Hospital';
  pptx.title = `Pre-Surgical Brief — ${shown(data.patient?.full_name)}`;

  const patientLabel = `${shown(data.patient?.full_name)} · ${shown(data.patient?.hospital_number)}`;

  /** Every content slide gets the same header, footer and patient banner. */
  const addSlide = (heading: string) => {
    const s = pptx.addSlide();
    s.background = { color: C.white };
    s.addShape(pptx.ShapeType.rect, { x: 0, y: 0, w: '100%', h: 0.72, fill: { color: C.navy } });
    s.addText(heading, {
      x: 0.4, y: 0.08, w: 8.6, h: 0.56, fontSize: 22, bold: true, color: C.white,
    });
    s.addText(patientLabel, {
      x: 0.4, y: 5.05, w: 7.5, h: 0.3, fontSize: 10, color: C.slate,
    });
    s.addText('Confidential — clinical record', {
      x: 7.9, y: 5.05, w: 1.7, h: 0.3, fontSize: 9, color: C.slate, align: 'right',
    });
    return s;
  };

  // ── Title ────────────────────────────────────────────────────────────────
  const title = pptx.addSlide();
  title.background = { color: C.navy };
  title.addText('PRE-SURGICAL BRIEF', {
    x: 0.6, y: 1.5, w: 8.8, h: 0.8, fontSize: 40, bold: true, color: C.white,
  });
  title.addText(shown(data.patient?.full_name), {
    x: 0.6, y: 2.4, w: 8.8, h: 0.6, fontSize: 26, color: C.mist,
  });
  title.addText(
    [
      `Hospital number: ${shown(data.patient?.hospital_number)}`,
      `Ward: ${shown(data.patient?.ward)}   Bed: ${shown(data.patient?.bed_number)}`,
      `Prepared: ${new Date().toLocaleString()}`,
      options.preparedBy ? `By: ${options.preparedBy}` : '',
    ].filter(Boolean).join('\n'),
    { x: 0.6, y: 3.15, w: 8.8, h: 1.3, fontSize: 13, color: C.mist, lineSpacingMultiple: 1.3 }
  );

  // ── Patient summary ──────────────────────────────────────────────────────
  const sum = addSlide('Patient Summary');
  sum.addTable(
    [
      [H('Field'), H('Value')],
      R(['Age', ageFromDob(data.patient?.date_of_birth)]),
      R(['Sex', shown(data.patient?.gender)]),
      R(['Blood group', shown(data.patient?.blood_group)]),
      R(['Allergies', shown(data.patient?.allergies)]),
      R(['Primary diagnosis', shown(data.patient?.primary_diagnosis)]),
      R([
        'Secondary diagnoses',
        Array.isArray(data.patient?.secondary_diagnoses) && data.patient.secondary_diagnoses.length
          ? data.patient.secondary_diagnoses.join(', ')
          : NOT_DOCUMENTED,
      ]),
    ],
    { x: 0.4, y: 1.0, w: 9.2, fontSize: 12, border: { pt: 1, color: 'D9DEE7' }, colW: [2.6, 6.6] }
  );

  // ── Comorbidities ────────────────────────────────────────────────────────
  const com = addSlide('Comorbidities');
  if (data.comorbidities?.length) {
    com.addTable(
      [
        [H('Condition'), H('Severity'), H('Notes')],
        ...data.comorbidities.map(c => R([shown(c.name), shown(c.severity), shown(c.notes)])),
      ],
      { x: 0.4, y: 1.0, w: 9.2, fontSize: 12, border: { pt: 1, color: 'D9DEE7' }, colW: [3.4, 1.8, 4.0] }
    );
  } else {
    com.addText('No comorbidities documented', { x: 0.4, y: 1.2, fontSize: 14, color: C.slate, italic: true });
  }

  // ── Vital signs ──────────────────────────────────────────────────────────
  const vit = addSlide('Current Vital Signs');
  const v = data.vitalSigns;
  if (v) {
    vit.addText(`Recorded ${formatDate(v.date)} by ${shown(v.recorded_by)}`, {
      x: 0.4, y: 0.82, w: 9.2, h: 0.3, fontSize: 11, color: C.slate,
    });
    vit.addTable(
      [
        [H('Observation'), H('Value')],
        R(['Temperature', v.temperature != null ? `${v.temperature} °C` : NOT_DOCUMENTED]),
        R(['Pulse', v.pulse != null ? `${v.pulse} bpm` : NOT_DOCUMENTED]),
        R(['Blood pressure', v.bp_systolic != null && v.bp_diastolic != null
          ? `${v.bp_systolic}/${v.bp_diastolic} mmHg` : NOT_DOCUMENTED]),
        R(['Respiratory rate', v.respiratory_rate != null ? `${v.respiratory_rate} /min` : NOT_DOCUMENTED]),
        R(['SpO2', v.spo2 != null ? `${v.spo2} %` : NOT_DOCUMENTED]),
        R(['Weight', v.weight != null ? `${v.weight} kg` : NOT_DOCUMENTED]),
      ],
      { x: 0.4, y: 1.2, w: 9.2, fontSize: 13, border: { pt: 1, color: 'D9DEE7' }, colW: [3.4, 5.8] }
    );
  } else {
    vit.addText('No observations recorded for this patient', {
      x: 0.4, y: 1.2, fontSize: 14, color: C.amber, italic: true,
    });
    vit.addText('A patient going to theatre without a recorded set of observations is itself worth raising.', {
      x: 0.4, y: 1.6, w: 9.2, fontSize: 12, color: C.slate,
    });
  }

  // ── Laboratory results ───────────────────────────────────────────────────
  const labs = addSlide('Laboratory Results');
  if (data.labResults?.length) {
    const rows = data.labResults.slice(0, 14).map((r: LabResult) => R([
      shown(r.test_name || r.test_type),
      labValue(r),
      shown(r.status),
      formatDate(r.completed_at || r.ordered_at),
    ]));
    labs.addTable(
      [
        [H('Test'), H('Result'), H('Status'), H('Date')],
        ...rows,
      ],
      { x: 0.35, y: 1.0, w: 9.3, fontSize: 10, border: { pt: 1, color: 'D9DEE7' }, colW: [2.3, 3.6, 1.4, 2.0] }
    );
    if (data.labResults.length > 14) {
      labs.addText(`+ ${data.labResults.length - 14} further results in the record`, {
        x: 0.35, y: 4.75, fontSize: 10, color: C.slate, italic: true,
      });
    }
  } else {
    labs.addText('No laboratory results recorded', { x: 0.4, y: 1.2, fontSize: 14, color: C.slate, italic: true });
  }

  // ── Medications ──────────────────────────────────────────────────────────
  const meds = addSlide('Current Medications');
  if (data.medications?.length) {
    meds.addTable(
      [
        [H('Medication'), H('Dose'), H('Route'), H('Frequency')],
        ...data.medications.slice(0, 14).map((m: Medication) => R([
          shown(m.medication_name), shown(m.dosage), shown(m.route), shown(m.frequency),
        ])),
      ],
      { x: 0.35, y: 1.0, w: 9.3, fontSize: 10, border: { pt: 1, color: 'D9DEE7' }, colW: [3.5, 1.9, 1.5, 2.4] }
    );
  } else {
    meds.addText('No active medications recorded', { x: 0.4, y: 1.2, fontSize: 14, color: C.slate, italic: true });
  }

  // ── Clinical photographs ─────────────────────────────────────────────────
  // Two per slide at a size a projector can actually resolve; a grid of
  // thumbnails is useless for deciding on an operative site.
  let omittedPhotographs = 0;
  const photos: ClinicalPhotograph[] = data.clinicalPhotographs || [];
  if (photos.length) {
    for (let i = 0; i < photos.length; i += 2) {
      const slide = addSlide(`Clinical Photographs (${Math.floor(i / 2) + 1})`);
      const pair = photos.slice(i, i + 2);
      for (let j = 0; j < pair.length; j++) {
        const p = pair[j];
        const dataUrl = await toDataUrl(p.url);
        const x = j === 0 ? 0.45 : 5.15;
        if (dataUrl) {
          slide.addImage({ data: dataUrl, x, y: 1.0, w: 4.4, h: 3.1, sizing: { type: 'contain', w: 4.4, h: 3.1 } });
        } else {
          omittedPhotographs++;
          slide.addShape(pptx.ShapeType.rect, {
            x, y: 1.0, w: 4.4, h: 3.1, fill: { color: C.mist }, line: { color: 'CBD5E1', width: 1 },
          });
          slide.addText('Image unavailable', {
            x, y: 2.3, w: 4.4, h: 0.4, fontSize: 12, color: C.slate, align: 'center', italic: true,
          });
        }
        slide.addText(`${shown(p.caption)}\n${formatDate(p.date)}`, {
          x, y: 4.2, w: 4.4, h: 0.7, fontSize: 10, color: C.slate, lineSpacingMultiple: 1.2,
        });
      }
    }
  } else {
    addSlide('Clinical Photographs').addText('No clinical photographs recorded', {
      x: 0.4, y: 1.2, fontSize: 14, color: C.slate, italic: true,
    });
  }

  // ── Planned procedure & anaesthesia ──────────────────────────────────────
  const proc = addSlide('Planned Procedure');
  const p0: PlannedProcedure | undefined = data.plannedProcedures?.[0];
  if (p0) {
    proc.addTable(
      [
        [H('Field'), H('Value')],
        R(['Procedure', shown(p0.procedure_name)]),
        R(['Type', shown(p0.procedure_type)]),
        R(['Scheduled', formatDate(p0.scheduled_date)]),
        R(['Estimated duration', p0.estimated_duration ? `${p0.estimated_duration} min` : NOT_DOCUMENTED]),
        R(['Surgeon', shown(p0.surgeon_name)]),
        R(['Anaesthesia', shown(p0.anesthesia_type)]),
        R(['Theatre', shown(p0.operating_room)]),
        R(['Equipment', Array.isArray(p0.required_equipment) && p0.required_equipment.length
          ? p0.required_equipment.join(', ') : NOT_DOCUMENTED]),
        R(['Pre-op notes', shown(p0.pre_op_notes)]),
      ],
      { x: 0.4, y: 1.0, w: 9.2, fontSize: 11, border: { pt: 1, color: 'D9DEE7' }, colW: [2.6, 6.6] }
    );
  } else {
    proc.addText('No procedure booked', { x: 0.4, y: 1.2, fontSize: 14, color: C.amber, italic: true });
  }

  const anae = addSlide('Anaesthetic Review');
  if (data.anaesthetistComments?.length) {
    anae.addTable(
      [
        [H('Anaesthetist'), H('ASA'), H('Plan / comment')],
        ...data.anaesthetistComments.slice(0, 8).map(c => R([
          shown(c.anaesthetist_name),
          shown(c.asa_grade),
          shown(c.anesthesia_plan || c.comment),
        ])),
      ],
      { x: 0.4, y: 1.0, w: 9.2, fontSize: 11, border: { pt: 1, color: 'D9DEE7' }, colW: [2.4, 0.9, 5.9] }
    );
  } else {
    anae.addText('No anaesthetic review recorded', {
      x: 0.4, y: 1.2, fontSize: 14, color: C.amber, italic: true,
    });
  }

  // ── Consumables & team ───────────────────────────────────────────────────
  const shop = addSlide('Consumables / Shopping List');
  const sl = data.shoppingListStatus;
  if (sl && sl.total_items > 0) {
    shop.addText(
      `${sl.procured_items} of ${sl.total_items} procured · ${sl.pending_items} outstanding`,
      { x: 0.4, y: 0.85, w: 9.2, h: 0.35, fontSize: 13, bold: true, color: sl.is_complete ? C.green : C.amber }
    );
    shop.addTable(
      [
        [H('Item'), H('Qty'), H('Status')],
        ...(sl.items || []).slice(0, 14).map(i => R([shown(i.name), shown(i.quantity), shown(i.status)])),
      ],
      { x: 0.4, y: 1.3, w: 9.2, fontSize: 10, border: { pt: 1, color: 'D9DEE7' }, colW: [5.6, 1.2, 2.4] }
    );
  } else {
    shop.addText('No shopping list recorded', { x: 0.4, y: 1.2, fontSize: 14, color: C.slate, italic: true });
  }

  const team = addSlide('Preparing Team');
  if (data.preparingTeam?.length) {
    team.addTable(
      [
        [H('Name'), H('Role'), H('Prepared')],
        ...data.preparingTeam.map(t => R([shown(t.name), shown(t.role), formatDate(t.preparation_date)])),
      ],
      { x: 0.4, y: 1.0, w: 9.2, fontSize: 11, border: { pt: 1, color: 'D9DEE7' }, colW: [3.6, 3.0, 2.6] }
    );
  } else {
    team.addText('No preparing team recorded', { x: 0.4, y: 1.2, fontSize: 14, color: C.slate, italic: true });
  }

  // ── Decisions ────────────────────────────────────────────────────────────
  // Present whether or not the briefing has happened: before, it is the agenda;
  // after, it is the record.
  const o = options.outcome;
  const plan = addSlide('Brief Decisions & Plan');
  plan.addTable(
    [
      [H('Stage'), H('Agreed plan')],
      R(['Pre-operative care', shown(o?.preop_plan)]),
      R(['Intra-operative plan', shown(o?.intraop_plan)]),
      R(['Contingency', shown(o?.contingency_plan)]),
      R(['Post-operative plan', shown(o?.postop_plan)]),
    ],
    { x: 0.4, y: 1.0, w: 9.2, fontSize: 11, border: { pt: 1, color: 'D9DEE7' }, colW: [2.6, 6.6] }
  );

  const cleared = o?.cleared_for_surgery;
  plan.addText(
    cleared === true ? 'CLEARED FOR SURGERY'
      : cleared === false ? 'NOT CLEARED FOR SURGERY'
        : 'Clearance decision not yet recorded',
    {
      x: 0.4, y: 4.35, w: 9.2, h: 0.45, fontSize: 15, bold: true, align: 'center',
      color: C.white,
      fill: { color: cleared === true ? C.green : cleared === false ? C.red : C.slate },
    }
  );

  const blob = (await pptx.write({ outputType: 'blob' })) as Blob;

  const safeName = `${shown(data.patient?.hospital_number)}-${shown(data.patient?.full_name)}`
    .replace(/[^a-z0-9]+/gi, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60) || 'patient';

  return {
    blob,
    fileName: `pre-surgical-brief-${safeName}-${new Date().toISOString().slice(0, 10)}.pptx`,
    omittedPhotographs,
  };
}

/** Build and hand the file to the browser. */
export async function downloadBriefPptx(
  data: ConferenceData,
  options: BriefPptxOptions = {}
): Promise<BriefPptxResult> {
  const result = await buildBriefPptx(data, options);
  const url = URL.createObjectURL(result.blob);
  try {
    const a = document.createElement('a');
    a.href = url;
    a.download = result.fileName;
    document.body.appendChild(a);
    a.click();
    a.remove();
  } finally {
    // Revoked on the next tick so the click has taken the URL first.
    setTimeout(() => URL.revokeObjectURL(url), 0);
  }
  return result;
}

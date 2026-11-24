// ============================================================================
// Reading a handwritten consult (a referral to us from another unit) with
// Claude vision — the pure parts: the prompt and the shaping of the answer.
//
// The model transcribes the page(s) and places what is written into the
// received-consult fields. It copies, it does not compose: anything not on the
// page comes back null, and the person scanning checks every field before the
// consult is saved.
// ============================================================================

export const CONSULT_SCAN_PROMPT_VERSION = 'received-consult-scan-1.0.0';
export const MAX_SCAN_PAGES = 3;
export const MAX_SCAN_BYTES = 3.5 * 1024 * 1024; // all pages together, base64 — under Vercel's 4.5 MB body limit

export const CONSULT_SCAN_SYSTEM_PROMPT = `You are reading a photograph of a HANDWRITTEN CONSULT (referral) sent to the Plastic Surgery unit of the University of Nigeria Teaching Hospital (UNTH), Enugu, by another unit. Nigerian consult notes often read: "Dear Plastic Surgeon / Consultant Plastic Surgeon, Please kindly see this [age]-year-old [man/woman], [name], with ... Thanks. Dr ..., [unit]".

Transcribe the whole page faithfully, then copy what is written into the fields below. Rules:
- Copy the doctor's wording. Do not summarise, paraphrase, or add any clinical content that is not on the page.
- A field that is not written on the page is null. Never guess a name, number, phone, ward or date.
- Mark words you cannot read with [?] in both the transcription and the fields.
- Common abbreviations: Pt (patient), y/o or yrs (years old), M/F, Hx (history), O/E (on examination), Ix (investigations), Dx/Imp (diagnosis/impression), Rx (treatment), POD (post-op day), TBSA (burn size), SR (senior registrar), Reg (registrar), HO (house officer), MO (medical officer), MMW/FMW/FSW/MSW/CHEW (wards).
- urgency: "emergency" if the note says emergency/STAT/immediately/now; "urgent" if urgent/ASAP/today; otherwise "routine".
- sex: "Male" or "Female" or null. age: whole years as a number, or null.
- referral_datetime: as written (e.g. "12/11/26 3pm"), or null.

Respond with ONLY valid JSON:
{
  "raw_text": "complete transcription, preserving line breaks",
  "confidence": 0.0 to 1.0,
  "fields": {
    "patient_name": null, "hospital_number": null, "age": null, "sex": null, "ward": null, "bed_number": null,
    "referring_hospital": null, "referring_department": null, "referring_unit": null,
    "referring_consultant": null, "referring_doctor_name": null, "referring_doctor_role": null, "referring_phone": null,
    "urgency": "routine",
    "indication": "the reason for referral / what is asked of us — or null",
    "primary_diagnosis": null, "presenting_complaint": null, "history_summary": null,
    "examination_summary": null, "investigations_summary": null, "requested_input": null,
    "referral_datetime": null
  }
}`;

const TEXT_FIELDS = {
  patient_name: 255, hospital_number: 60, sex: 10, ward: 120, bed_number: 40,
  referring_hospital: 180, referring_department: 180, referring_unit: 180,
  referring_consultant: 180, referring_doctor_name: 180, referring_doctor_role: 80, referring_phone: 40,
  indication: 4000, primary_diagnosis: 2000, presenting_complaint: 2000, history_summary: 4000,
  examination_summary: 4000, investigations_summary: 4000, requested_input: 2000, referral_datetime: 60,
};

const clean = (v, max) => {
  if (v === undefined || v === null) return null;
  const s = String(v).trim();
  if (!s || /^(null|none|n\/?a|not stated|unknown|-+)$/i.test(s)) return null;
  return s.slice(0, max);
};

/** Shape Claude's answer into the received-consult fields (nulls for anything absent). */
export function normaliseConsultScan(raw) {
  const f = (raw && typeof raw.fields === 'object' && raw.fields) || {};
  const out = {};
  for (const [k, max] of Object.entries(TEXT_FIELDS)) out[k] = clean(f[k], max);
  const age = parseInt(String(f.age ?? '').replace(/[^\d]/g, ''), 10);
  out.age = Number.isFinite(age) && age >= 0 && age < 130 ? age : null;
  if (out.sex) out.sex = /^f/i.test(out.sex) ? 'Female' : /^m/i.test(out.sex) ? 'Male' : out.sex;
  const u = String(f.urgency || '').toLowerCase();
  out.urgency = ['emergency', 'urgent', 'routine'].includes(u) ? u : 'routine';
  if (out.referring_phone) out.referring_phone = out.referring_phone.replace(/[^\d+]/g, '').slice(0, 40) || null;
  const conf = Number(raw?.confidence);
  return {
    raw_text: String(raw?.raw_text || '').slice(0, 20000),
    confidence: Number.isFinite(conf) ? Math.min(1, Math.max(0, conf)) : null,
    fields: out,
  };
}

/** Validate the pages the browser sent: data: URIs of images, within size. */
export function checkScanPages(images) {
  if (!Array.isArray(images) || !images.length) return 'Add at least one photo of the consult';
  if (images.length > MAX_SCAN_PAGES) return `At most ${MAX_SCAN_PAGES} pages per consult`;
  let total = 0;
  for (const img of images) {
    if (typeof img !== 'string' || !/^data:image\/(jpeg|png|webp|gif);base64,/.test(img)) return 'Each page must be a JPEG, PNG, WebP or GIF photo';
    total += img.length;
  }
  if (total > MAX_SCAN_BYTES) return 'The photos are too large — retake them a little further from the page';
  return null;
}

/**
 * Physical examination, from general examination to the focused examination
 * each presenting complaint needs (standard surgical examination order:
 * inspection, palpation, percussion, auscultation, then special tests).
 *
 * Every finding offers "Not examined"; nothing is pre-filled as normal. A
 * section the clinician never opens is reported as not examined.
 */
import type { ExamSection, Question } from './types';

const NE = 'Not examined';
const sel = (id: string, label: string, options: string[], extra: Partial<Question> = {}): Question =>
  ({ id, label, type: 'select', options: [...options, NE], ...extra });
const multi = (id: string, label: string, options: string[], extra: Partial<Question> = {}): Question =>
  ({ id, label, type: 'multiselect', options: [...options, NE], ...extra });
const num = (id: string, label: string, unit: string): Question => ({ id, label, type: 'number', unit });

export const VITALS: Array<{ id: string; label: string; unit: string; min: number; max: number; plausibleMin: number; plausibleMax: number }> = [
  // plausible = accepted with a confirmation; outside min/max = rejected as impossible
  { id: 'temperature', label: 'Temperature', unit: '°C', min: 25, max: 45, plausibleMin: 34, plausibleMax: 41.5 },
  { id: 'pulse', label: 'Pulse', unit: '/min', min: 10, max: 300, plausibleMin: 30, plausibleMax: 200 },
  { id: 'bp_systolic', label: 'BP systolic', unit: 'mmHg', min: 30, max: 300, plausibleMin: 60, plausibleMax: 250 },
  { id: 'bp_diastolic', label: 'BP diastolic', unit: 'mmHg', min: 10, max: 200, plausibleMin: 30, plausibleMax: 150 },
  { id: 'respiratory_rate', label: 'Respiratory rate', unit: '/min', min: 2, max: 80, plausibleMin: 6, plausibleMax: 50 },
  { id: 'spo2', label: 'SpO₂', unit: '%', min: 30, max: 100, plausibleMin: 70, plausibleMax: 100 },
  { id: 'weight', label: 'Weight', unit: 'kg', min: 0.3, max: 400, plausibleMin: 1, plausibleMax: 250 },
  { id: 'height', label: 'Height', unit: 'cm', min: 20, max: 250, plausibleMin: 40, plausibleMax: 220 },
  { id: 'glucose', label: 'Random blood glucose', unit: 'mmol/L', min: 0.5, max: 60, plausibleMin: 2, plausibleMax: 33 },
  { id: 'pain_score', label: 'Pain score', unit: '/10', min: 0, max: 10, plausibleMin: 0, plausibleMax: 10 },
];
export const VITALS_CONTEXT: Question[] = [
  { id: 'o2_device', label: 'Oxygen', type: 'select', options: ['Room air', 'Nasal cannula', 'Face mask', 'Non-rebreather', 'Ventilated'] },
  { id: 'consciousness', label: 'Consciousness (ACVPU)', type: 'select', options: ['Alert', 'New confusion', 'Responds to voice', 'Responds to pain', 'Unresponsive'], redFlags: ['New confusion', 'Responds to voice', 'Responds to pain', 'Unresponsive'] },
];

export const EXAM_SECTIONS: Record<string, ExamSection> = {
  general: { id: 'general', title: 'General examination', questions: [
    sel('appearance', 'General appearance', ['Well', 'Unwell', 'Ill-looking', 'Toxic / septic-looking', 'In obvious pain', 'Distressed']),
    sel('consciousness', 'Conscious level', ['Alert and oriented', 'Confused', 'Drowsy', 'Responds to pain only', 'Unresponsive']),
    sel('pallor', 'Pallor', ['None', 'Mild', 'Moderate', 'Severe']),
    sel('jaundice', 'Jaundice', ['Anicteric', 'Icteric']),
    sel('cyanosis', 'Cyanosis', ['None', 'Peripheral', 'Central']),
    sel('clubbing', 'Finger clubbing', ['Absent', 'Present']),
    sel('hydration', 'Hydration', ['Well hydrated', 'Mild dehydration', 'Moderate dehydration', 'Severe dehydration']),
    sel('oedema', 'Peripheral oedema', ['None', 'Pitting — ankle', 'Pitting — to knee', 'Sacral', 'Generalised (anasarca)']),
    sel('lymph_general', 'Lymphadenopathy', ['None', 'Localised', 'Generalised']),
    sel('nutrition', 'Nutritional state', ['Well nourished', 'Overweight / obese', 'Underweight', 'Wasted / cachectic']),
    sel('habitus', 'Other general findings', ['None', 'Dysmorphic features', 'Albinism', 'Sickle cell stigmata', 'Cushingoid', 'Other']),
  ] },
  general_extra: { id: 'general_extra', title: 'Additional assessment', questions: [
    sel('capillary_refill_central', 'Central capillary refill', ['< 2 s', '2–3 s', '> 3 s'], { redFlags: ['> 3 s'] }),
    sel('peripheries', 'Peripheries', ['Warm', 'Cool', 'Cold and clammy'], { redFlags: ['Cold and clammy'] }),
    sel('mucosa', 'Mucous membranes', ['Moist', 'Dry']),
    sel('skin_turgor', 'Skin turgor', ['Normal', 'Reduced']),
  ] },
  cvs: { id: 'cvs', title: 'Cardiovascular', questions: [
    sel('pulse_character', 'Pulse character', ['Regular, normal volume', 'Irregularly irregular', 'Weak / thready', 'Bounding']),
    sel('jvp', 'JVP', ['Not raised', 'Raised']),
    sel('apex', 'Apex beat', ['Normal position', 'Displaced', 'Heaving', 'Not palpable']),
    sel('heart_sounds', 'Heart sounds', ['S1 S2 only', 'Murmur present', 'Gallop (S3/S4)', 'Muffled']),
    sel('peripheral_pulses', 'Peripheral pulses', ['All present', 'Reduced', 'Absent in a limb']),
  ] },
  resp: { id: 'resp', title: 'Respiratory', questions: [
    sel('resp_effort', 'Work of breathing', ['Normal', 'Increased', 'Using accessory muscles', 'Unable to speak in sentences'], { redFlags: ['Using accessory muscles', 'Unable to speak in sentences'] }),
    sel('trachea', 'Trachea', ['Central', 'Deviated']),
    sel('chest_expansion', 'Chest expansion', ['Normal and equal', 'Reduced left', 'Reduced right', 'Reduced both']),
    sel('percussion', 'Percussion note', ['Resonant', 'Dull', 'Stony dull', 'Hyper-resonant']),
    sel('breath_sounds', 'Breath sounds', ['Vesicular', 'Bronchial', 'Reduced', 'Absent']),
    multi('added_sounds', 'Added sounds', ['None', 'Crackles', 'Wheeze', 'Pleural rub', 'Stridor']),
  ] },
  abdo: { id: 'abdo', title: 'Abdomen', questions: [
    sel('abdo_inspection', 'Inspection', ['Normal', 'Distended', 'Visible peristalsis', 'Scars', 'Mass visible', 'Hernia visible']),
    sel('abdo_tenderness', 'Tenderness', ['Non-tender', 'Localised tenderness', 'Generalised tenderness', 'Guarding', 'Rebound / peritonism', 'Board-like rigidity'], { redFlags: ['Guarding', 'Rebound / peritonism', 'Board-like rigidity'] }),
    sel('abdo_organs', 'Organs', ['No organomegaly', 'Hepatomegaly', 'Splenomegaly', 'Palpable kidney', 'Palpable bladder']),
    sel('abdo_mass', 'Mass', ['None', 'Present']),
    sel('abdo_percussion', 'Percussion', ['Normal', 'Shifting dullness', 'Tympanitic']),
    sel('bowel_sounds', 'Bowel sounds', ['Normal', 'Increased', 'Reduced', 'Absent'], { redFlags: ['Absent'] }),
    sel('hernial_orifices', 'Hernial orifices', ['Intact', 'Hernia present']),
    sel('dre', 'Digital rectal examination', ['Not indicated', 'Normal', 'Abnormal']),
  ] },
  neuro: { id: 'neuro', title: 'Neurological', questions: [
    sel('gcs', 'GCS', ['15', '13–14', '9–12', '≤ 8'], { redFlags: ['9–12', '≤ 8'] }),
    sel('pupils', 'Pupils', ['Equal and reactive', 'Unequal', 'Fixed']),
    sel('cranial_nerves', 'Cranial nerves', ['Intact', 'Facial nerve palsy', 'Other deficit']),
    sel('power', 'Power', ['5/5 all limbs', 'Reduced in one limb', 'Hemiparesis', 'Paraparesis', 'Quadriparesis']),
    sel('tone_reflexes', 'Tone / reflexes', ['Normal', 'Increased', 'Reduced']),
    sel('sensation', 'Sensation', ['Intact', 'Glove-and-stocking loss', 'Dermatomal loss', 'Nerve-distribution loss', 'Sensory level']),
    sel('meningism', 'Neck stiffness / meningism', ['Absent', 'Present'], { redFlags: ['Present'] }),
  ] },
  msk: { id: 'msk', title: 'Musculoskeletal', questions: [
    sel('msk_look', 'Look', ['Normal', 'Swelling', 'Deformity', 'Wasting', 'Scar', 'Wound over bone']),
    sel('msk_feel', 'Feel', ['Normal', 'Warm', 'Tender', 'Crepitus', 'Effusion']),
    sel('msk_move', 'Move (range)', ['Full range', 'Reduced active', 'Reduced passive', 'Painful movement', 'Fixed contracture']),
    sel('msk_neurovascular', 'Distal neurovascular status', ['Intact', 'Compromised']),
  ] },
  spine: { id: 'spine', title: 'Spine', questions: [
    sel('spine_inspection', 'Inspection', ['Normal', 'Kyphosis / gibbus', 'Scoliosis', 'Swelling', 'Sinus']),
    sel('spine_tenderness', 'Tenderness', ['None', 'Localised', 'Diffuse']),
    sel('slr', 'Straight-leg raise', ['Negative', 'Positive left', 'Positive right']),
  ] },
  lymph: { id: 'lymph', title: 'Regional lymph nodes', questions: [
    sel('nodes_region', 'Region examined', ['Cervical', 'Axillary', 'Inguinal', 'Epitrochlear', 'Popliteal', 'All regions']),
    sel('nodes_finding', 'Nodes', ['Not palpable', 'Palpable — soft, mobile', 'Palpable — firm, matted', 'Palpable — hard, fixed', 'Fluctuant']),
    sel('nodes_tender', 'Tenderness', ['Non-tender', 'Tender']),
  ] },
  head_neck: { id: 'head_neck', title: 'Head and neck', questions: [
    sel('hn_face', 'Face', ['Normal', 'Asymmetry', 'Swelling', 'Laceration', 'Deformity']),
    sel('hn_facial_nerve', 'Facial nerve function', ['Normal', 'Partial weakness', 'Complete palsy']),
    sel('hn_ears', 'Ears', ['Normal', 'Deformity', 'Discharge', 'Keloid']),
    sel('hn_nose', 'Nose', ['Normal', 'Deformity', 'Bleeding', 'Septal haematoma']),
    sel('hn_neck', 'Neck', ['Normal', 'Mass', 'Thyroid enlarged', 'Lymph nodes']),
    sel('hn_facial_bones', 'Facial bones', ['Stable', 'Step / tenderness', 'Malocclusion', 'Mobile maxilla']),
  ] },
  eye: { id: 'eye', title: 'Eyes', questions: [
    sel('eye_lids', 'Eyelids', ['Normal', 'Ptosis', 'Ectropion', 'Lagophthalmos (cannot close)', 'Laceration', 'Burn']),
    sel('eye_conj', 'Conjunctiva / cornea', ['Normal', 'Red', 'Chemosis', 'Corneal injury']),
    sel('eye_vision', 'Vision (gross)', ['Normal', 'Reduced', 'Not testable']),
  ] },
  oral: { id: 'oral', title: 'Oral cavity', questions: [
    sel('oral_mucosa', 'Mucosa', ['Normal', 'Ulcer', 'Mass', 'Erosions', 'Necrotic tissue']),
    sel('oral_palate', 'Palate', ['Intact', 'Cleft', 'Fistula']),
    sel('oral_dentition', 'Teeth / gums', ['Normal', 'Carious', 'Dental abscess', 'Loose teeth', 'Trismus']),
    sel('oral_tongue', 'Tongue', ['Normal', 'Ulcer', 'Mass', 'Tied']),
  ] },
  airway_inhalation: { id: 'airway_inhalation', title: 'Airway / inhalation injury', questions: [
    sel('airway_patent', 'Airway', ['Patent', 'At risk', 'Obstructed'], { redFlags: ['At risk', 'Obstructed'] }),
    multi('inhalation_signs', 'Signs of inhalation injury', ['None', 'Facial burns', 'Singed nasal hair / eyebrows', 'Soot in mouth / nose', 'Carbonaceous sputum', 'Hoarse voice', 'Stridor', 'Oropharyngeal oedema'], { redFlags: ['Carbonaceous sputum', 'Hoarse voice', 'Stridor', 'Oropharyngeal oedema'] }),
  ] },
  local_wound: { id: 'local_wound', title: 'Wound / ulcer examination', questions: [
    num('wound_length', 'Length', 'cm'), num('wound_width', 'Width', 'cm'), num('wound_depth', 'Depth', 'cm'),
    sel('wound_shape', 'Shape', ['Round', 'Oval', 'Irregular', 'Linear', 'Punched-out', 'Serpiginous']),
    sel('wound_edge', 'Edge', ['Sloping (healing)', 'Punched-out', 'Undermined', 'Rolled / raised (pearly)', 'Everted', 'Macerated', 'Epithelialising']),
    sel('wound_floor', 'Floor / bed', ['Healthy granulation', 'Pale / unhealthy granulation', 'Slough', 'Necrotic / eschar', 'Exposed tendon', 'Exposed bone', 'Exposed implant', 'Fungating / cauliflower', 'Epithelialised']),
    sel('wound_bed_pct', 'Bed composition', ['> 75 % granulation', '50–75 % granulation', '< 50 % granulation', 'Mostly slough', 'Mostly necrotic']),
    sel('wound_base', 'Base (palpation)', ['Soft', 'Indurated', 'Fixed to deep structures', 'Bone palpable (probe-to-bone)']),
    sel('wound_exudate', 'Exudate amount', ['None', 'Low', 'Moderate', 'Heavy']),
    sel('wound_exudate_type', 'Exudate type', ['Serous', 'Haemoserous', 'Purulent', 'Green', 'Foul-smelling']),
    sel('wound_surrounding', 'Surrounding skin', ['Normal', 'Erythema < 2 cm', 'Erythema > 2 cm (cellulitis)', 'Induration', 'Maceration', 'Lipodermatosclerosis', 'Hyperpigmentation', 'Crepitus', 'Dusky / necrotic patches'], { redFlags: ['Crepitus', 'Dusky / necrotic patches', 'Erythema > 2 cm (cellulitis)'] }),
    sel('wound_undermining', 'Undermining / tunnelling', ['None', 'Present']),
    sel('wound_tenderness', 'Tenderness', ['Non-tender', 'Tender', 'Exquisitely tender / out of proportion'], { redFlags: ['Exquisitely tender / out of proportion'] }),
    sel('wound_infection', 'Infection signs', ['None', 'Local (redness, warmth, pus)', 'Spreading', 'Systemic (fever, tachycardia)'], { redFlags: ['Spreading', 'Systemic (fever, tachycardia)'] }),
    sel('wound_photo', 'Clinical photograph taken', ['Yes', 'No']),
  ] },
  local_lump: { id: 'local_lump', title: 'Lump / swelling examination', questions: [
    num('lump_size_l', 'Size (length)', 'cm'), num('lump_size_w', 'Size (width)', 'cm'),
    sel('lump_shape', 'Shape', ['Round', 'Oval', 'Lobulated', 'Irregular']),
    sel('lump_surface', 'Surface', ['Smooth', 'Lobulated', 'Nodular', 'Irregular']),
    sel('lump_edge', 'Edge', ['Well defined', 'Ill defined']),
    sel('lump_consistency', 'Consistency', ['Soft', 'Firm', 'Rubbery', 'Hard', 'Cystic', 'Bony hard', 'Variable']),
    sel('lump_tender', 'Tenderness', ['Non-tender', 'Tender']),
    sel('lump_warm', 'Temperature', ['Normal', 'Warm']),
    sel('lump_fluctuation', 'Fluctuation', ['Absent', 'Present']),
    sel('lump_transillumination', 'Transillumination', ['Negative', 'Positive', 'Not applicable']),
    sel('lump_pulsation', 'Pulsatility', ['None', 'Transmitted', 'Expansile'], { redFlags: ['Expansile'] }),
    sel('lump_compressibility', 'Compressible / reducible', ['No', 'Compressible', 'Reducible', 'Cough impulse']),
    sel('lump_mobility', 'Mobility / fixity', ['Mobile', 'Fixed to skin', 'Fixed to deep structures', 'Mobile in one plane only']),
    sel('lump_skin', 'Overlying skin', ['Normal', 'Punctum present', 'Red', 'Tethered', 'Ulcerated', 'Dilated veins'], { redFlags: ['Ulcerated', 'Tethered'] }),
    sel('lump_slip', 'Slip sign', ['Positive', 'Negative', 'Not applicable']),
  ] },
  local_skin_lesion: { id: 'local_skin_lesion', title: 'Skin lesion (ABCDE)', questions: [
    num('lesion_diameter', 'Diameter', 'mm'),
    sel('lesion_asymmetry', 'Asymmetry', ['Symmetrical', 'Asymmetrical'], { redFlags: ['Asymmetrical'] }),
    sel('lesion_border', 'Border', ['Regular', 'Irregular / notched'], { redFlags: ['Irregular / notched'] }),
    sel('lesion_colour_var', 'Colour', ['Uniform', 'Variegated (several colours)'], { redFlags: ['Variegated (several colours)'] }),
    sel('lesion_surface', 'Surface', ['Smooth', 'Scaly', 'Crusted', 'Ulcerated', 'Pearly with telangiectasia', 'Verrucous', 'Bleeding']),
    sel('lesion_satellites', 'Satellite lesions', ['None', 'Present'], { redFlags: ['Present'] }),
  ] },
  local_burn: { id: 'local_burn', title: 'Burn examination', questions: [
    num('tbsa_percent', 'TBSA burned (Lund–Browder or rule of nines)', '%'),
    sel('burn_depth', 'Predominant depth', ['Superficial (epidermal)', 'Superficial partial thickness', 'Deep partial thickness', 'Full thickness', 'Mixed']),
    multi('burn_areas', 'Special areas involved', ['Face', 'Hands', 'Feet', 'Perineum / genitalia', 'Major joints', 'Circumferential limb', 'Circumferential chest', 'None']),
    sel('burn_circumferential_perfusion', 'Distal perfusion beyond circumferential burn', ['Not applicable', 'Good', 'Compromised'], { redFlags: ['Compromised'] }),
    sel('burn_wound_state', 'Wound state', ['Clean', 'Blisters intact', 'Sloughy', 'Infected', 'Eschar', 'Granulating', 'Healed']),
    sel('burn_entry_exit', 'Electrical entry / exit wounds', ['Not applicable', 'Present', 'None found']),
  ] },
  local_hand: { id: 'local_hand', title: 'Hand examination', questions: [
    sel('hand_cascade', 'Resting posture / finger cascade', ['Normal cascade', 'Finger held extended (flexor tendon cut)', 'Finger held flexed', 'Claw', 'Mallet finger']),
    sel('hand_fdp', 'FDP (bend fingertip, middle joint held)', ['Intact all fingers', 'Absent in a finger', 'Not testable']),
    sel('hand_fds', 'FDS (bend middle joint, others held)', ['Intact all fingers', 'Absent in a finger', 'Not testable']),
    sel('hand_extensors', 'Extensors', ['Intact', 'Extensor lag', 'Not testable']),
    sel('hand_median', 'Median nerve (thumb opposition, index sensation)', ['Intact', 'Sensory loss', 'Motor loss', 'Both']),
    sel('hand_ulnar', 'Ulnar nerve (finger spread, little finger sensation)', ['Intact', 'Sensory loss', 'Motor loss', 'Both']),
    sel('hand_radial', 'Radial nerve (wrist / finger extension, first web sensation)', ['Intact', 'Sensory loss', 'Motor loss', 'Both']),
    sel('hand_digital_nerves', 'Digital nerves (2-point discrimination)', ['Intact', 'Reduced on one side of a digit', 'Absent']),
    sel('hand_perfusion', 'Digital perfusion (refill, colour, turgor)', ['All digits perfused', 'One or more digits poorly perfused', 'Avascular digit'], { redFlags: ['One or more digits poorly perfused', 'Avascular digit'] }),
    sel('hand_kanavel', 'Kanavel signs (flexor sheath infection)', ['None', 'Some present', 'All four present'], { redFlags: ['Some present', 'All four present'] }),
    sel('hand_bones', 'Bones / joints', ['Stable', 'Tender', 'Deformity', 'Rotational malalignment', 'Open fracture']),
  ] },
  local_scar: { id: 'local_scar', title: 'Scar / keloid examination', questions: [
    num('scar_length', 'Length', 'cm'), num('scar_height', 'Height', 'mm'),
    sel('scar_vascularity', 'Vascularity (VSS)', ['0 Normal', '1 Pink', '2 Red', '3 Purple']),
    sel('scar_pigmentation', 'Pigmentation (VSS)', ['0 Normal', '1 Hypopigmented', '2 Hyperpigmented']),
    sel('scar_pliability', 'Pliability (VSS)', ['0 Normal', '1 Supple', '2 Yielding', '3 Firm', '4 Banding', '5 Contracture']),
    sel('scar_vss_height', 'Height (VSS)', ['0 Flat', '1 < 2 mm', '2 2–5 mm', '3 > 5 mm']),
    sel('scar_border', 'Extends beyond the original wound', ['No', 'Yes']),
    sel('scar_range', 'Joint range limited', ['No', 'Yes', 'Not applicable']),
    sel('scar_ulcer', 'Ulceration within the scar', ['None', 'Present'], { redFlags: ['Present'] }),
  ] },
  local_breast: { id: 'local_breast', title: 'Breast examination', questions: [
    sel('breast_inspection', 'Inspection', ['Symmetrical, normal', 'Asymmetry', 'Skin dimpling', 'Peau d’orange', 'Nipple retraction', 'Ulceration', 'Visible mass'], { redFlags: ['Skin dimpling', 'Peau d’orange', 'Nipple retraction', 'Ulceration'] }),
    sel('breast_quadrant', 'Mass location', ['No mass', 'Upper outer', 'Upper inner', 'Lower outer', 'Lower inner', 'Retroareolar', 'Axillary tail']),
    num('breast_mass_size', 'Mass size', 'cm'),
    sel('breast_mass_character', 'Mass character', ['Not applicable', 'Mobile, smooth, rubbery', 'Hard, irregular', 'Fixed to skin', 'Fixed to chest wall', 'Fluctuant / tender'], { redFlags: ['Hard, irregular', 'Fixed to skin', 'Fixed to chest wall'] }),
    sel('breast_axilla', 'Axillary nodes', ['Not palpable', 'Mobile', 'Fixed / matted']),
  ] },
  limb_vascular: { id: 'limb_vascular', title: 'Limb vascular examination', questions: [
    sel('lv_colour', 'Colour', ['Normal', 'Pale', 'Cyanosed / dusky', 'Mottled', 'Black (gangrene)', 'Red'], { redFlags: ['Pale', 'Mottled', 'Black (gangrene)'] }),
    sel('lv_temp', 'Temperature', ['Warm', 'Cool', 'Cold']),
    sel('lv_cap_refill', 'Capillary refill', ['< 2 s', '2–3 s', '> 3 s']),
    sel('lv_pulses', 'Distal pulses', ['All palpable', 'Reduced', 'Absent — Doppler signal present', 'Absent — no Doppler signal'], { redFlags: ['Absent — no Doppler signal'] }),
    num('lv_abpi', 'ABPI (if measured)', ''),
    sel('lv_venous', 'Venous signs', ['None', 'Varicose veins', 'Haemosiderin staining', 'Lipodermatosclerosis', 'Venous eczema']),
    sel('lv_swelling', 'Swelling', ['None', 'Pitting oedema', 'Non-pitting (lymphoedema)', 'Calf swelling / tenderness']),
    sel('lv_compartments', 'Compartments', ['Soft', 'Tense', 'Pain on passive stretch'], { redFlags: ['Tense', 'Pain on passive stretch'] }),
  ] },
  limb_neuro: { id: 'limb_neuro', title: 'Limb neurological examination', questions: [
    sel('ln_sensation', 'Sensation', ['Intact', 'Reduced', 'Absent', 'Monofilament not felt (protective sensation lost)']),
    sel('ln_motor', 'Motor', ['Intact', 'Weak', 'Paralysed']),
    sel('ln_reflexes', 'Reflexes', ['Normal', 'Reduced', 'Absent']),
    sel('ln_foot_deformity', 'Foot deformity (Charcot, claw toes)', ['None', 'Present', 'Not applicable']),
  ] },
  pressure_area: { id: 'pressure_area', title: 'Pressure areas', questions: [
    sel('pa_stage', 'Pressure injury stage (NPIAP)', ['No pressure injury', 'Stage 1 — non-blanching erythema', 'Stage 2 — partial thickness', 'Stage 3 — full thickness skin', 'Stage 4 — exposed bone / tendon', 'Unstageable', 'Deep tissue injury']),
    multi('pa_sites', 'Sites', ['Sacrum', 'Ischium', 'Trochanter', 'Heels', 'Occiput', 'Elbows', 'Other']),
    sel('pa_continence', 'Continence', ['Continent', 'Urinary incontinence', 'Faecal incontinence', 'Both', 'Catheterised']),
  ] },
  genital: { id: 'genital', title: 'Genitalia / perineum', questions: [
    sel('gen_inspection', 'Inspection', ['Normal', 'Swelling', 'Ulcer', 'Discharge', 'Necrosis / crepitus', 'Hypospadias', 'Other anomaly'], { redFlags: ['Necrosis / crepitus'] }),
    sel('gen_testes', 'Testes (if male)', ['Not applicable', 'Both normal', 'Swollen / tender', 'High-riding / horizontal lie', 'Undescended'], { redFlags: ['High-riding / horizontal lie'] }),
  ] },
};

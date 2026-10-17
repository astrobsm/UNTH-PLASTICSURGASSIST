/**
 * Differential rules, part 2: the remaining diagnoses the complaint catalogue
 * links to — acute wounds and soft tissue, lumps, hand, head and neck,
 * breast and body contour, trauma, and the general medical / surgical
 * conditions a clerking must consider.
 *
 * Same contract as differentials.ts: weights only RANK suggestions (never a
 * probability); every support carries the reason shown to the clinician;
 * investigations and management are for the clinician to consider, without
 * patient-specific doses. Extra key scopes used here:
 *   complaint.<id>   'yes' when that presenting complaint was chosen
 *   ros.<symptom>    'present' / 'absent' from the review of systems
 *   hx.drug_high_risk  high-risk medicine classes the patient takes
 * Sources: standard surgical / medical teaching and international guidance
 * (Bailey & Love, ATLS, NICE, WHO, ESC, IWGDF, ACR/EULAR, GINA).
 */
import type { DifferentialRule } from './types';

type Sup = DifferentialRule['supports'][number];
const s = (key: string, any: string | string[], weight: number, reason: string): Sup => ({ key, any: Array.isArray(any) ? any : [any], weight, reason });
const cx = (id: string, weight: number, reason: string) => s(`complaint.${id}`, 'yes', weight, reason);
const ros = (symptom: string, weight: number, reason = symptom) => s(`ros.${symptom}`, 'present', weight, reason);
const d = (flag: string, weight: number, reason: string) => s(`d.${flag}`, 'yes', weight, reason);
const R = (
  id: string, label: string, supports: Sup[], investigations: string[], management: string[],
  opts: { icd10?: string; dangerous?: boolean; against?: Sup[] } = {},
): DifferentialRule => ({ id, label, supports, investigations, management, ...opts });

const SITE_HAND = ['Hand (palm)', 'Hand (dorsum)', 'Finger(s) / thumb', 'Wrist'];

export const MORE_DIFFERENTIALS: DifferentialRule[] = [
  // ── Acute wounds and soft tissue ──────────────────────────────────────────
  R('simple_laceration', 'Simple laceration', [
    s('c.injury_mechanism', ['Glass cut', 'Knife / kitchen injury', 'Assault — machete / sharp', 'Machine / industrial'], 2, 'Sharp mechanism'),
    s('c.injury_bleeding', ['None', 'Stopped', 'Ongoing — controlled'], 1, 'Bleeding controlled'),
    s('c.injury_numbness', 'No', 1, 'No numbness beyond the wound'),
    s('c.injury_weakness', 'No', 1, 'Normal movement'),
  ], ['Examine under good light; X-ray if glass / metal or deep'], ['Irrigation, debridement and primary closure if < 24 h and clean (face up to ~24–48 h)', 'Tetanus prophylaxis per immunisation status', 'Antibiotics only for bites or heavy contamination'],
  { against: [s('exam.local_hand.hand_fdp', 'Absent in a finger', 3, 'Tendon deficit — not a simple laceration'), s('exam.local_hand.hand_digital_nerves', ['Reduced on one side of a digit', 'Absent'], 3, 'Nerve deficit — not a simple laceration')] }),
  R('retained_fb', 'Retained foreign body', [
    s('c.injury_contamination', 'Foreign body suspected', 4, 'Foreign body suspected'),
    s('c.injury_mechanism', ['Glass cut', 'Gunshot', 'Blast'], 2, 'Glass / missile mechanism'),
    s('c.previous_episodes', ['Recurrent / chronic'], 1, 'Recurrent / persistent discharge'),
    s('c.wound_discharge', ['Purulent (pus)', 'Seropurulent'], 1, 'Persistent discharge'),
  ], ['X-ray (glass, metal); ultrasound for wood / plastic'], ['Exploration and removal; wound left open if infected']),
  R('erysipelas', 'Erysipelas', [
    s('exam.local_wound.wound_surrounding', 'Erythema > 2 cm (cellulitis)', 2, 'Spreading erythema'),
    s('c.wound_site', ['Face', 'Leg (shin / calf)'], 1, 'Face / leg — typical sites'),
    s('c.onset', ['Sudden (seconds–minutes)', 'Acute (hours)'], 1, 'Abrupt onset'),
    d('fever', 2, 'Fever'),
  ], ['FBC, CRP, glucose'], ['Antibiotics per local guideline (streptococcal cover)', 'Elevation; treat portal of entry (tinea pedis)']),
  R('infected_cyst', 'Infected epidermoid cyst', [
    s('exam.local_lump.lump_skin', ['Punctum present', 'Red'], 3, 'Punctum / overlying redness'),
    s('c.lump_discharge', ['Cheesy material', 'Pus'], 2, 'Cheesy / purulent discharge'),
    s('c.previous_episodes', ['Once before', 'Several times before', 'Recurrent / chronic'], 1, 'Pre-existing lump'),
  ], ['Clinical'], ['Incision and drainage; interval excision of the cyst wall once settled']),
  R('pyomyositis', 'Pyomyositis (tropical)', [
    s('c.lump_site', ['Thigh', 'Buttock', 'Upper arm', 'Leg (shin / calf)'], 2, 'Deep in a large muscle group'),
    s('exam.local_lump.lump_consistency', ['Firm', 'Hard'], 1, 'Woody, deep swelling'),
    s('c.lump_painful', ['Painful'], 1, 'Painful'),
    d('fever', 2, 'Fever'),
    s('pmh.hiv', 'Yes', 1, 'HIV'),
  ], ['Ultrasound / MRI', 'FBC, CRP, blood cultures, CK'], ['Drainage (open or guided)', 'Antistaphylococcal antibiotics per guideline']),
  R('hidradenitis', 'Hidradenitis suppurativa', [
    s('c.lump_site', ['Axilla', 'Groin / inguinal', 'Perineum / genitalia', 'Buttock', 'Breast'], 3, 'Flexural site'),
    s('c.previous_episodes', ['Several times before', 'Recurrent / chronic'], 3, 'Recurrent abscesses'),
    s('pmh.obesity', 'Yes', 1, 'Obesity'),
    s('social.smoking', 'Current smoker', 1, 'Smoking'),
  ], ['Swab if acutely infected; glucose / HbA1c'], ['Hurley staging; weight loss and smoking cessation', 'Medical therapy with dermatology; wide excision for chronic disease']),
  R('dry_gangrene', 'Dry gangrene', [
    s('exam.limb_vascular.lv_colour', 'Black (gangrene)', 3, 'Black, mummified tissue'),
    s('exam.limb_vascular.lv_pulses', ['Reduced', 'Absent — Doppler signal present', 'Absent — no Doppler signal'], 2, 'Poor distal pulses'),
    s('pmh.diabetes', 'Yes', 1, 'Diabetes'),
    s('pmh.peripheral_arterial', 'Yes', 2, 'Peripheral arterial disease'),
  ], ['ABPI / arterial duplex / angiography', 'Glucose, renal function, lipids'], ['Vascular assessment before any amputation level is chosen', 'Keep dry; await demarcation unless infected']),
  R('wet_gangrene', 'Wet (infected) gangrene', [
    s('exam.local_wound.wound_floor', 'Necrotic / eschar', 2, 'Necrotic tissue'),
    s('exam.local_wound.wound_infection', ['Spreading', 'Systemic (fever, tachycardia)'], 3, 'Spreading / systemic infection'),
    s('c.wound_odour', 'Yes', 2, 'Foul odour'),
    d('fever', 1, 'Fever'),
    s('pmh.diabetes', 'Yes', 1, 'Diabetes'),
  ], ['FBC, CRP, glucose, U&E, blood cultures, lactate', 'X-ray for gas'], ['URGENT debridement / guillotine amputation for source control', 'IV antibiotics per guideline; glycaemic control'], { dangerous: true }),
  R('envenomation', 'Snake envenomation', [
    cx('snake_bite', 3, 'Snake bite'),
    s('c.injury_bleeding', ['Ongoing — controlled', 'Pulsatile / uncontrolled'], 2, 'Bleeding (venom coagulopathy)'),
    s('c.bleed_site', ['Mouth / gums', 'Urine', 'Wound'], 2, 'Bleeding from gums / wound / urine'),
    s('exam.limb_vascular.lv_swelling', ['Pitting oedema', 'Calf swelling / tenderness'], 1, 'Progressive limb swelling'),
  ], ['20-minute whole-blood clotting test (20WBCT)', 'FBC, U&E, creatinine, urinalysis', 'Mark swelling every hour'], ['Immobilise; no tourniquet or incisions', 'Antivenom per national protocol if systemic or progressive local envenoming', 'Watch for compartment syndrome — fasciotomy only with proven raised pressure'], { dangerous: true }),
  R('septic_arthritis_hand', 'Septic arthritis of the hand (incl. fight bite)', [
    s('c.injury_mechanism', 'Human bite', 4, 'Human bite / fight bite over a knuckle'),
    s('c.wound_site', SITE_HAND, 1, 'Hand'),
    s('exam.msk.msk_move', ['Painful movement', 'Reduced active', 'Reduced passive'], 2, 'Painful joint movement'),
    s('exam.msk.msk_feel', ['Warm', 'Effusion'], 2, 'Warm, swollen joint'),
  ], ['X-ray (tooth fragment, fracture)', 'FBC, CRP'], ['Surgical exploration and joint washout', 'IV antibiotics covering oral flora per guideline', 'Elevation, splint, hand therapy'], { dangerous: true }),
  R('degloving_injury', 'Degloving injury', [
    s('c.injury_mechanism', ['Road traffic — motorcycle', 'Road traffic — pedestrian', 'Machine / industrial', 'Crush'], 2, 'Shearing / crush mechanism'),
    s('exam.local_wound.wound_undermining', 'Present', 3, 'Skin separated from deep tissue'),
    s('exam.local_wound.wound_surrounding', 'Dusky / necrotic patches', 2, 'Non-viable skin'),
  ], ['X-ray for fractures', 'Assess skin viability (bleeding, refill)'], ['Early debridement of non-viable skin; defatting and reapplication as graft where possible', 'NPWT; staged reconstruction']),
  R('rhabdomyolysis', 'Rhabdomyolysis / myoglobinuria', [
    s('c.burn_mechanism', ['Electrical — high voltage', 'Lightning'], 3, 'High-voltage injury'),
    s('c.injury_mechanism', 'Crush', 3, 'Crush injury'),
    s('c.gu_output', ['Reduced', 'Very little / none'], 2, 'Reduced urine output'),
    s('exam.limb_vascular.lv_compartments', ['Tense', 'Pain on passive stretch'], 2, 'Tense muscle compartments'),
  ], ['CK, U&E, potassium, urinalysis (blood without RBCs)', 'ECG'], ['IV fluids to maintain a high urine output', 'Treat hyperkalaemia; renal team if AKI'], { dangerous: true }),
  R('haematoma', 'Postoperative haematoma', [
    s('c.precipitant', 'Surgery / procedure', 1, 'Recent surgery'),
    s('c.vasc_swelling', ['Firm / woody', 'Non-pitting'], 2, 'Tense swelling'),
    s('c.wound_bleeding', ['Spontaneous', 'Profuse'], 2, 'Bleeding from the wound'),
    s('c.bleed_anticoag', 'Yes', 2, 'On anticoagulant / antiplatelet'),
    s('hx.drug_high_risk', ['Anticoagulant (warfarin, rivaroxaban, heparin)', 'Antiplatelet (aspirin, clopidogrel)'], 2, 'Anticoagulant / antiplatelet'),
  ], ['FBC, coagulation screen', 'Ultrasound if uncertain'], ['Expanding haematoma under a flap or in the neck: return to theatre urgently', 'Review anticoagulation']),

  // ── Lumps ─────────────────────────────────────────────────────────────────
  R('neurofibroma', 'Neurofibroma / neurofibromatosis type 1', [
    s('c.lump_other_lumps', 'Yes', 2, 'Multiple lumps'),
    s('exam.local_lump.lump_consistency', ['Soft', 'Rubbery'], 1, 'Soft / rubbery'),
    s('exam.local_lump.lump_mobility', 'Mobile in one plane only', 3, 'Moves across but not along the nerve'),
    s('c.def_family', 'Yes', 1, 'Family history'),
  ], ['Look for café-au-lait macules, axillary freckling', 'MRI if rapidly growing or painful (MPNST)'], ['Excision of symptomatic lesions; refer for NF1 surveillance'],
  { against: [s('c.lump_growth', ['Rapid (weeks)', 'Very rapid (days)'], 2, 'Rapid growth — exclude malignant nerve sheath tumour')] }),
  R('thyroid_nodule', 'Thyroid nodule / goitre', [
    s('exam.head_neck.hn_neck', 'Thyroid enlarged', 4, 'Thyroid enlargement'),
    cx('thyroid', 2, 'Thyroid swelling'),
    s('pmh.thyroid_disease', 'Yes', 1, 'Thyroid disease'),
  ], ['TFTs', 'Ultrasound (TIRADS) ± FNA', 'Laryngoscopy before surgery'], ['Treat per TFTs and cytology; surgery for compressive or suspicious nodules']),
  R('branchial_cyst', 'Branchial cyst', [
    s('c.lump_site', 'Neck', 1, 'Neck'),
    s('exam.local_lump.lump_consistency', ['Cystic', 'Soft'], 2, 'Cystic'),
    s('exam.local_lump.lump_fluctuation', 'Present', 1, 'Fluctuant'),
    d('age_under_40', 1, 'Young adult'),
  ], ['Ultrasound ± FNA (exclude cystic nodal metastasis in adults)'], ['Excision']),
  R('thyroglossal_cyst', 'Thyroglossal duct cyst', [
    s('c.lump_side', 'Midline', 3, 'Midline neck'),
    s('exam.local_lump.lump_consistency', ['Cystic', 'Soft'], 1, 'Cystic'),
    d('age_under_16', 1, 'Child / young person'),
  ], ['Ultrasound (confirm normal thyroid)', 'TFTs'], ['Sistrunk operation']),
  R('tb_lymphadenitis', 'Tuberculous lymphadenitis', [
    s('exam.lymph.nodes_finding', ['Palpable — firm, matted', 'Fluctuant'], 3, 'Matted / cold-abscess nodes'),
    s('c.lump_constitutional', 'Yes', 2, 'Weight loss, night sweats or fever'),
    s('pmh.hiv', 'Yes', 1, 'HIV'),
    s('c.resp_tb_contact', 'Yes', 2, 'TB contact / symptoms'),
    ros('Night sweats', 1),
  ], ['FNA / excision biopsy for ZN, GeneXpert, culture', 'Chest X-ray, HIV test'], ['Anti-TB therapy with physicians']),
  R('lymphoma', 'Lymphoma', [
    s('exam.lymph.nodes_finding', ['Palpable — soft, mobile', 'Palpable — firm, matted'], 2, 'Rubbery lymph nodes'),
    s('exam.general.lymph_general', 'Generalised', 3, 'Generalised lymphadenopathy'),
    s('c.lump_constitutional', 'Yes', 2, 'B symptoms'),
    ros('Night sweats', 1), ros('Weight loss', 1),
    s('exam.abdo.abdo_organs', ['Splenomegaly', 'Hepatomegaly'], 2, 'Organomegaly'),
  ], ['Excision biopsy of a whole node (not FNA alone)', 'FBC, film, LDH, HIV', 'CT staging'], ['Haemato-oncology referral'], { dangerous: true }),
  R('parotid_tumour', 'Parotid tumour', [
    s('c.lump_site', ['Face', 'Ear'], 2, 'Pre- / infra-auricular'),
    s('c.lump_growth', ['Slow (months–years)'], 1, 'Slow growth (pleomorphic adenoma)'),
    s('exam.head_neck.hn_facial_nerve', ['Partial weakness', 'Complete palsy'], 4, 'Facial weakness — suggests malignancy'),
  ], ['Ultrasound ± FNA; MRI'], ['Superficial / total parotidectomy with facial nerve preservation']),
  R('dental_abscess', 'Dental abscess / odontogenic infection', [
    s('exam.oral.oral_dentition', ['Carious', 'Dental abscess', 'Loose teeth'], 4, 'Dental source'),
    cx('toothache', 2, 'Toothache'),
    s('exam.oral.oral_dentition', 'Trismus', 2, 'Trismus (spreading infection)'),
    d('fever', 1, 'Fever'),
  ], ['OPG / dental X-ray', 'CT neck if floor-of-mouth swelling'], ['Drainage and dental extraction / root treatment', 'Floor-of-mouth swelling or airway signs: URGENT (Ludwig angina)']),
  R('burkitt_lymphoma', 'Burkitt lymphoma (jaw)', [
    d('age_under_16', 3, 'Child'),
    s('c.lump_growth', ['Rapid (weeks)', 'Very rapid (days)'], 3, 'Rapidly growing jaw mass'),
    s('exam.oral.oral_dentition', 'Loose teeth', 2, 'Loosened teeth'),
  ], ['Biopsy', 'FBC, LDH, U&E, uric acid; staging (bone marrow, CSF)'], ['URGENT paediatric oncology — highly chemosensitive; tumour-lysis precautions'], { dangerous: true }),
  R('vascular_malformation', 'Vascular malformation', [
    s('c.lump_noticed', 'Present since birth', 2, 'Present since birth'),
    s('exam.local_lump.lump_compressibility', 'Compressible', 3, 'Compressible'),
    s('exam.local_lump.lump_pulsation', ['Transmitted', 'Expansile'], 2, 'Pulsatile (high-flow)'),
    s('c.aggravating', 'Dependency (hanging down)', 1, 'Enlarges when dependent'),
  ], ['Duplex ultrasound; MRI / MRA'], ['Vascular anomalies MDT (sclerotherapy, embolisation, excision)']),
  R('ameloblastoma', 'Ameloblastoma / odontogenic tumour', [
    s('c.lump_growth', 'Slow (months–years)', 2, 'Slow painless jaw expansion'),
    s('c.lump_painful', 'Painless', 1, 'Painless'),
    s('exam.oral.oral_mucosa', 'Mass', 2, 'Intra-oral mass'),
  ], ['OPG / CT jaw', 'Incisional biopsy'], ['Segmental resection with margins and reconstruction (e.g. free fibula)']),
  R('dermoid_cyst', 'Dermoid cyst', [
    s('c.lump_noticed', 'Present since birth', 2, 'Since childhood'),
    s('c.lump_site', ['Head / scalp', 'Eye / periorbital', 'Face'], 2, 'Scalp / outer brow / midline'),
  ], ['Imaging (CT / MRI) for midline lesions to exclude intracranial extension'], ['Excision']),
  R('inguinal_hernia', 'Inguinal hernia', [
    s('c.lump_cough_impulse', 'Yes', 3, 'Cough impulse'),
    s('c.lump_reducible', 'Yes', 3, 'Reducible'),
    s('exam.abdo.hernial_orifices', 'Hernia present', 3, 'Hernia on examination'),
    s('c.lump_site', 'Groin / inguinal', 1, 'Groin'),
    d('male', 1, 'Male'),
  ], ['Clinical; ultrasound if uncertain'], ['Elective mesh repair', 'Irreducible / tender: URGENT surgery (strangulation)']),
  R('femoral_hernia', 'Femoral hernia', [
    s('c.lump_site', 'Groin / inguinal', 1, 'Groin'),
    d('female', 2, 'Female'),
    s('c.lump_reducible', 'No', 2, 'Often irreducible'),
  ], ['Ultrasound'], ['Repair promptly — high strangulation risk'], { dangerous: true }),
  R('accessory_breast', 'Accessory breast tissue', [
    s('c.lump_site', 'Axilla', 2, 'Axilla'),
    d('female', 1, 'Female'),
    s('c.breast_cycle', 'Yes', 2, 'Varies with the cycle'),
    s('c.breast_lactating', 'Yes', 1, 'Enlarged in lactation'),
  ], ['Ultrasound'], ['Reassurance or excision']),

  // ── Skin lesions ──────────────────────────────────────────────────────────
  R('naevus', 'Benign melanocytic naevus', [
    s('exam.local_skin_lesion.lesion_asymmetry', 'Symmetrical', 2, 'Symmetrical'),
    s('exam.local_skin_lesion.lesion_border', 'Regular', 2, 'Regular border'),
    s('exam.local_skin_lesion.lesion_colour_var', 'Uniform', 2, 'Uniform colour'),
    s('c.lesion_change', 'No change', 2, 'Unchanged'),
  ], ['Dermoscopy; photograph for comparison'], ['Reassurance; excise if changing or for cosmesis']),
  R('seborrhoeic_keratosis', 'Seborrhoeic keratosis', [
    s('exam.local_skin_lesion.lesion_surface', ['Verrucous', 'Scaly', 'Crusted'], 3, 'Warty, stuck-on surface'),
    d('age_over_40', 1, 'Older adult'),
  ], ['Clinical; biopsy if uncertain'], ['Reassurance; cryotherapy / curettage if troublesome']),
  R('pyogenic_granuloma', 'Pyogenic granuloma', [
    s('exam.local_skin_lesion.lesion_surface', 'Bleeding', 3, 'Friable, bleeds easily'),
    s('c.lesion_change', ['Bleeding', 'Increasing size'], 2, 'Rapidly growing, bleeding'),
    s('c.lesion_colour', 'Pink / red', 1, 'Red'),
  ], ['Histology of the excised lesion (exclude amelanotic melanoma)'], ['Curettage and cautery or excision; send for histology']),

  // ── Nails and hand infection ──────────────────────────────────────────────
  R('paronychia', 'Paronychia', [
    s('c.pain_site', 'Finger(s) / thumb', 1, 'Finger'),
    s('exam.local_lump.lump_fluctuation', 'Present', 2, 'Pus beside the nail'),
    s('c.pain_character', 'Throbbing / pulsating', 1, 'Throbbing'),
  ], ['Glucose if recurrent'], ['Drain the collection; antibiotics only if cellulitis']),
  R('ingrown_toenail', 'Ingrown toenail', [s('c.pain_site', 'Toe(s)', 3, 'Toe')], ['Clinical'], ['Wedge excision with phenolisation of the nail fold for recurrent cases']),
  R('felon', 'Felon (pulp space infection)', [
    s('c.pain_site', 'Finger(s) / thumb', 1, 'Fingertip'),
    s('c.pain_character', 'Throbbing / pulsating', 2, 'Throbbing pulp'),
    s('exam.local_lump.lump_tender', 'Tender', 1, 'Tense, tender pulp'),
  ], ['X-ray (osteomyelitis, foreign body)'], ['Incision and drainage (avoid the pinch surface)']),
  R('deep_space_infection', 'Deep palmar space / collar-stud abscess', [
    s('c.pain_site', 'Hand (palm)', 2, 'Palm'),
    s('exam.local_hand.hand_cascade', 'Finger held flexed', 1, 'Fingers held flexed'),
    d('fever', 1, 'Fever'),
  ], ['Ultrasound; FBC, CRP, glucose'], ['URGENT surgical drainage; IV antibiotics; elevation'], { dangerous: true }),

  // ── Hand ──────────────────────────────────────────────────────────────────
  R('hand_fracture', 'Hand fracture / dislocation', [
    s('exam.local_hand.hand_bones', ['Tender', 'Deformity', 'Rotational malalignment', 'Open fracture'], 4, 'Bony tenderness / deformity / malrotation'),
    s('c.injury_deformity', 'Yes', 2, 'Deformity'),
    s('c.injury_mechanism', ['Fall on outstretched hand', 'Assault — blunt', 'Sports', 'Crush', 'Machine / industrial'], 1, 'Blunt / crush mechanism'),
  ], ['X-ray hand (AP, oblique, lateral of the digit)'], ['Reduction and splint (safe position) or fixation; rotational malalignment needs correction', 'Open fracture: antibiotics, tetanus, washout']),
  R('fingertip_injury', 'Fingertip injury / nail-bed injury', [
    s('c.injury_mechanism', ['Crush', 'Machine / industrial'], 2, 'Crush'),
    s('c.wound_site', 'Finger(s) / thumb', 1, 'Fingertip'),
  ], ['X-ray (tuft fracture)'], ['Nail-bed repair; healing by secondary intention or local flap per defect (Allen classification)']),
  R('traumatic_amputation', 'Traumatic digit amputation', [
    s('exam.local_hand.hand_perfusion', 'Avascular digit', 4, 'Devascularised / amputated digit'),
    s('c.injury_mechanism', ['Machine / industrial', 'Assault — machete / sharp', 'Crush'], 1, 'Mechanism'),
  ], ['X-ray of hand and the amputated part'], ['Wrap the part in moist gauze, in a bag, on ice (not in direct contact)', 'URGENT hand surgery — replantation criteria (thumb, multiple digits, child, sharp)'], { dangerous: true }),
  R('cubital_tunnel', 'Cubital tunnel syndrome (ulnar neuropathy)', [
    s('exam.local_hand.hand_ulnar', ['Sensory loss', 'Motor loss', 'Both'], 4, 'Ulnar deficit'),
    s('c.neuro_sensory', 'In a nerve distribution (e.g. median)', 1, 'Nerve-distribution symptoms'),
    s('exam.local_hand.hand_cascade', 'Claw', 2, 'Ulnar claw'),
  ], ['Nerve conduction studies'], ['Avoid elbow flexion / pressure; decompression if weakness']),
  R('cervical_radiculopathy', 'Cervical radiculopathy', [
    s('c.pain_radiation', 'To the arm', 2, 'Neck pain radiating to the arm'),
    s('c.neuro_sensory', 'Dermatomal', 3, 'Dermatomal sensory change'),
    s('exam.neuro.sensation', 'Dermatomal loss', 3, 'Dermatomal loss'),
  ], ['MRI cervical spine if progressive deficit'], ['Analgesia, physiotherapy; spinal referral for myelopathy or progressive weakness']),
  R('trigger_finger', 'Trigger finger (stenosing tenosynovitis)', [
    cx('trigger_finger', 3, 'Finger catching / locking'),
    s('c.timing', 'Worse in the morning', 1, 'Worse in the morning'),
    s('pmh.diabetes', 'Yes', 1, 'Diabetes'),
  ], ['Clinical'], ['Steroid injection into the sheath; A1 pulley release if persistent']),
  R('dupuytren', 'Dupuytren disease', [
    s('exam.local_hand.hand_cascade', 'Finger held flexed', 2, 'Fixed flexion of a finger'),
    s('exam.msk.msk_move', 'Fixed contracture', 2, 'Fixed contracture'),
    d('male', 1, 'Male'), d('age_over_40', 1, 'Over 40'),
  ], ['Table-top test'], ['Observe; fasciectomy / needle fasciotomy when MCPJ contracture ≥ 30° or any PIPJ contracture']),
  R('giant_cell_tumour_tendon', 'Giant cell tumour of tendon sheath', [
    s('c.lump_site', ['Finger(s) / thumb', 'Hand (palm)', 'Hand (dorsum)'], 2, 'Digit'),
    s('exam.local_lump.lump_consistency', ['Firm', 'Rubbery'], 2, 'Firm, lobulated'),
    s('exam.local_lump.lump_transillumination', 'Negative', 1, 'Does not transilluminate'),
  ], ['X-ray, ultrasound'], ['Complete marginal excision (recurrence risk)']),
  R('tendon_adhesion', 'Tendon adhesion / joint stiffness after injury or surgery', [
    s('c.def_onset', ['After injury', 'After surgery', 'After a burn'], 3, 'After injury / surgery'),
    s('exam.msk.msk_move', ['Reduced active', 'Fixed contracture'], 2, 'Active < passive range'),
  ], ['Range-of-motion measurement'], ['Hand therapy; tenolysis / capsulotomy after ≥ 3–6 months of therapy']),
  R('syndactyly', 'Syndactyly', [cx('congenital_hand', 1, 'Congenital hand difference'), s('c.def_onset', 'Birth', 2, 'Since birth'), s('c.def_family', 'Yes', 1, 'Family history')],
    ['X-ray (bony fusion)', 'Look for associated syndromes (Apert, Poland)'], ['Separation with flaps and grafts, usually 12–18 months (earlier for border digits)']),
  R('polydactyly', 'Polydactyly', [cx('congenital_hand', 1, 'Congenital hand difference'), s('c.def_onset', 'Birth', 2, 'Since birth'), s('c.def_family', 'Yes', 1, 'Family history')],
    ['X-ray'], ['Excision / reconstruction (ligature only for small, pedunculated postaxial digits)']),

  // ── Head and neck ─────────────────────────────────────────────────────────
  R('cleft_lip_palate', 'Cleft lip and / or palate', [
    s('exam.oral.oral_palate', 'Cleft', 4, 'Palatal cleft'),
    s('c.def_onset', 'Birth', 2, 'Since birth'),
    s('c.def_function', ['Feeding', 'Speech'], 2, 'Feeding / speech problems'),
  ], ['Weight and growth; hearing assessment', 'Look for associated anomalies'], ['Cleft team: feeding support; lip repair ~3 months, palate ~9–12 months; speech therapy']),
  R('facial_fracture', 'Facial fracture', [
    s('exam.head_neck.hn_facial_bones', ['Step / tenderness', 'Malocclusion', 'Mobile maxilla'], 4, 'Step, malocclusion or mobile maxilla'),
    s('exam.head_neck.hn_face', ['Swelling', 'Deformity', 'Asymmetry'], 1, 'Facial swelling / deformity'),
    s('c.injury_mechanism', ['Road traffic — motorcycle', 'Assault — blunt', 'Fall from height'], 1, 'Blunt mechanism'),
  ], ['CT face (± head and C-spine)', 'Eye examination (orbital injury)'], ['Airway first (ATLS); maxillofacial referral; ORIF as indicated']),
  R('facial_nerve_injury', 'Facial nerve injury', [
    s('exam.head_neck.hn_facial_nerve', ['Partial weakness', 'Complete palsy'], 4, 'Facial weakness'),
    cx('facial_injury', 2, 'Facial laceration / injury'),
  ], ['Document House–Brackmann grade'], ['Explore and repair within 72 h if a laceration lies posterior to a line through the lateral canthus', 'Eye protection']),
  R('microtia', 'Microtia / ear deformity', [s('exam.head_neck.hn_ears', 'Deformity', 3, 'Ear deformity'), s('c.def_onset', 'Birth', 2, 'Since birth')],
    ['Hearing assessment; look for hemifacial microsomia'], ['Ear reconstruction (autologous rib cartilage) at age ~8–10; hearing rehabilitation']),
  R('bells_palsy', "Bell's palsy", [
    s('exam.head_neck.hn_facial_nerve', ['Partial weakness', 'Complete palsy'], 3, 'Facial weakness'),
    s('c.onset', ['Acute (hours)', 'Subacute (days)'], 1, 'Acute onset'),
    s('exam.neuro.power', '5/5 all limbs', 2, 'No limb weakness (lower motor neurone, isolated)'),
  ], ['Check forehead involvement (sparing suggests stroke)', 'Ear / parotid examination (Ramsay Hunt, tumour)'], ['Oral steroid within 72 h per guideline', 'Eye protection (lubricants, taping)'],
  { against: [s('exam.neuro.power', ['Hemiparesis', 'Reduced in one limb'], 4, 'Limb weakness — think stroke')] }),
  R('stroke', 'Stroke / TIA', [
    s('exam.neuro.power', ['Hemiparesis', 'Reduced in one limb'], 4, 'Unilateral weakness'),
    s('c.neuro_weakness_dist', ['One side of the body', 'Face'], 3, 'One-sided / facial weakness'),
    s('c.onset', 'Sudden (seconds–minutes)', 2, 'Sudden onset'),
    s('pmh.hypertension', 'Yes', 1, 'Hypertension'), s('pmh.stroke', 'Yes', 1, 'Previous stroke'),
    s('pmh.sickle_cell', 'Yes', 1, 'Sickle cell disease'),
  ], ['URGENT CT head; glucose', 'ECG (AF)'], ['Stroke pathway — time-critical (thrombolysis window)', 'Check glucose; keep NPO until swallow assessed'], { dangerous: true }),
  R('noma', 'Noma (cancrum oris)', [
    s('exam.oral.oral_mucosa', 'Necrotic tissue', 4, 'Necrotic oral tissue'),
    s('pmh.malnutrition', 'Yes', 2, 'Malnutrition'),
    d('age_under_16', 1, 'Child'),
    s('c.wound_odour', 'Yes', 1, 'Foul odour'),
  ], ['FBC, HIV, malaria test, nutritional assessment'], ['Antibiotics per WHO, nutritional rehabilitation, oral hygiene', 'Reconstruction only after the acute phase (≥ 1 year)'], { dangerous: true }),
  R('ptosis', 'Ptosis', [s('exam.eye.eye_lids', 'Ptosis', 4, 'Ptosis')],
    ['Check pupil (Horner / third-nerve palsy), fatiguability (myasthenia), levator function'], ['Treat cause; levator advancement / brow suspension per function']),
  R('ectropion', 'Ectropion / lagophthalmos', [
    s('exam.eye.eye_lids', ['Ectropion', 'Lagophthalmos (cannot close)'], 4, 'Lid eversion / incomplete closure'),
    s('c.scar_cause', 'Burn', 2, 'Burn scar'),
  ], ['Corneal examination (fluorescein)'], ['Lubrication, moisture chamber; release with full-thickness graft — URGENT if cornea exposed']),
  R('oral_scc', 'Oral squamous cell carcinoma', [
    s('exam.oral.oral_mucosa', ['Ulcer', 'Mass'], 2, 'Oral ulcer / mass'),
    s('exam.oral.oral_tongue', ['Ulcer', 'Mass'], 2, 'Tongue ulcer / mass'),
    s('social.smoking', ['Current smoker', 'Ex-smoker', 'Snuff / chewing tobacco'], 2, 'Tobacco use'),
    s('social.alcohol', 'Heavy', 1, 'Heavy alcohol'),
    s('exam.lymph.nodes_finding', ['Palpable — hard, fixed', 'Palpable — firm, matted'], 2, 'Neck nodes'),
  ], ['Biopsy of any ulcer > 3 weeks', 'CT / MRI staging'], ['Head and neck MDT'], { dangerous: true }),
  R('aphthous_ulcer', 'Aphthous ulcer', [
    s('c.previous_episodes', ['Several times before', 'Recurrent / chronic'], 2, 'Recurrent'),
    s('c.wound_pain', ['Moderate', 'Severe'], 1, 'Painful'),
  ], ['Biopsy if a single ulcer persists > 3 weeks'], ['Topical treatment; check FBC, B12 / folate / iron if recurrent'],
  { against: [s('social.smoking', ['Current smoker', 'Snuff / chewing tobacco'], 1, 'Tobacco — persistent ulcer needs biopsy')] }),

  // ── Genital and breast / body ─────────────────────────────────────────────
  R('hypospadias', 'Hypospadias', [s('exam.genital.gen_inspection', 'Hypospadias', 4, 'Ectopic meatus'), s('c.def_onset', 'Birth', 2, 'Since birth')],
    ['Check both testes (undescended + hypospadias → DSD assessment)'], ['No circumcision (foreskin needed for repair)', 'Repair at 6–18 months']),
  R('breast_cyst', 'Breast cyst', [
    s('exam.local_breast.breast_mass_character', 'Mobile, smooth, rubbery', 1, 'Smooth, mobile'),
    s('exam.local_lump.lump_consistency', 'Cystic', 3, 'Cystic'),
    d('age_over_40', 1, 'Age 35–55'),
  ], ['Ultrasound; aspirate if symptomatic (cytology if bloody)'], ['Aspiration; triple assessment if residual mass']),
  R('fibrocystic', 'Fibrocystic change / cyclical mastalgia', [
    s('c.breast_cycle', 'Yes', 3, 'Varies with the cycle'),
    s('exam.local_breast.breast_quadrant', 'Upper outer', 1, 'Upper outer quadrant'),
  ], ['Examination; imaging if a discrete lump'], ['Reassurance, supportive bra, simple analgesia']),
  R('mastitis', 'Mastitis', [
    s('c.breast_lactating', 'Yes', 3, 'Lactating'),
    d('fever', 2, 'Fever'),
    s('exam.local_breast.breast_mass_character', 'Fluctuant / tender', 1, 'Tender'),
  ], ['Ultrasound if a lump persists (abscess)'], ['Continue breastfeeding / expressing; antibiotics per guideline']),
  R('macromastia', 'Macromastia (breast hypertrophy)', [
    cx('breast_size', 1, 'Breast size concern'),
    s('c.def_function', ['Self-care', 'Walking'], 1, 'Functional limitation'),
  ], ['BMI; examination for intertrigo, shoulder grooving'], ['Weight optimisation; reduction mammaplasty']),
  R('gynaecomastia', 'Gynaecomastia', [
    d('male', 2, 'Male'),
    cx('gynaecomastia', 2, 'Male breast enlargement'),
    s('pmh.liver_disease', 'Yes', 1, 'Liver disease'),
    s('social.substances', ['Cannabis', 'Other drugs'], 1, 'Drug use'),
  ], ['Drug history; LFT, TFT, testosterone, oestradiol, LH, hCG; testicular examination'], ['Treat cause; surgery for persistent cases'],
  { against: [s('exam.local_breast.breast_mass_character', ['Hard, irregular', 'Fixed to skin'], 4, 'Hard eccentric mass — exclude male breast cancer')] }),
  R('abdominal_laxity', 'Abdominal wall laxity / divarication', [
    cx('abdominal_wall', 2, 'Excess skin / laxity'),
    s('gyn.parity', ['P2', 'P3', 'P4', 'P5+'], 1, 'Multiparity'),
  ], ['BMI, weight stability'], ['Abdominoplasty when weight stable and smoking stopped']),
  R('incisional_hernia', 'Incisional hernia', [
    s('exam.abdo.abdo_inspection', ['Scars', 'Hernia visible'], 2, 'Bulge at a scar'),
    s('c.lump_cough_impulse', 'Yes', 2, 'Cough impulse'),
    s('psh.previous_surgery', 'Yes', 1, 'Previous surgery'),
  ], ['Ultrasound / CT'], ['Optimise (weight, smoking); mesh repair']),
  R('umbilical_hernia', 'Umbilical / paraumbilical hernia', [
    s('c.lump_site', 'Abdomen (anterior)', 1, 'Umbilical region'),
    s('c.lump_reducible', 'Yes', 2, 'Reducible'),
    s('c.lump_cough_impulse', 'Yes', 2, 'Cough impulse'),
  ], ['Clinical; ultrasound'], ['Repair; children usually observed to age 4–5']),

  // ── Limb swelling ─────────────────────────────────────────────────────────
  R('lymphoedema', 'Lymphoedema', [
    s('exam.limb_vascular.lv_swelling', 'Non-pitting (lymphoedema)', 4, 'Non-pitting swelling'),
    s('c.vasc_swelling', ['Non-pitting', 'Firm / woody'], 2, 'Firm, non-pitting'),
    s('pmh.cancer', 'Yes', 1, 'Cancer treatment (node surgery / radiotherapy)'),
  ], ['Stemmer sign; limb volume measurement', 'Lymphoscintigraphy if uncertain'], ['Complete decongestive therapy, compression, skin care', 'Treat cellulitis promptly']),
  R('podoconiosis', 'Podoconiosis', [
    s('social.occupation', 'Farmer', 2, 'Barefoot farming'),
    s('exam.limb_vascular.lv_swelling', 'Non-pitting (lymphoedema)', 2, 'Bilateral lower-leg lymphoedema'),
  ], ['Filarial antigen test (to exclude filariasis)'], ['Foot hygiene, shoes, compression, emollients']),
  R('filariasis', 'Lymphatic filariasis', [
    s('exam.limb_vascular.lv_swelling', 'Non-pitting (lymphoedema)', 2, 'Lymphoedema'),
    s('exam.genital.gen_inspection', 'Swelling', 2, 'Hydrocele / genital swelling'),
    d('fever', 1, 'Recurrent fever (adenolymphangitis)'),
  ], ['Filarial antigen test / night blood film'], ['Antifilarial therapy per national programme; lymphoedema care']),
  R('venous_insufficiency', 'Chronic venous insufficiency', [
    s('exam.limb_vascular.lv_venous', ['Varicose veins', 'Haemosiderin staining', 'Lipodermatosclerosis', 'Venous eczema'], 4, 'Venous skin changes'),
    s('c.vasc_varicose', 'Yes', 2, 'Varicose veins'),
    s('c.aggravating', 'Dependency (hanging down)', 1, 'Worse on standing'),
    s('c.relieving', 'Elevation', 1, 'Better with elevation'),
  ], ['Venous duplex; ABPI before compression'], ['Compression, elevation, exercise; endovenous treatment where indicated']),
  R('pad', 'Peripheral arterial disease', [
    s('c.pain_claudication', 'Yes', 3, 'Claudication'),
    s('exam.limb_vascular.lv_pulses', ['Reduced', 'Absent — Doppler signal present', 'Absent — no Doppler signal'], 3, 'Reduced pulses'),
    s('social.smoking', ['Current smoker', 'Ex-smoker'], 1, 'Smoking'),
    s('pmh.diabetes', 'Yes', 1, 'Diabetes'),
    s('c.pain_night', 'Yes', 2, 'Rest pain (critical ischaemia)'),
  ], ['ABPI', 'Duplex / angiography', 'Lipids, HbA1c'], ['Smoking cessation, exercise, statin and antiplatelet with physicians', 'Rest pain / tissue loss: URGENT vascular referral']),
  R('spinal_stenosis', 'Lumbar spinal stenosis (neurogenic claudication)', [
    s('c.relieving', 'Sitting forward', 3, 'Relieved by sitting / bending forward'),
    s('exam.limb_vascular.lv_pulses', 'All palpable', 2, 'Normal pulses'),
    d('age_over_60', 1, 'Older age'),
  ], ['MRI lumbar spine'], ['Physiotherapy, analgesia; decompression if disabling']),

  // ── Trauma ────────────────────────────────────────────────────────────────
  R('fracture', 'Fracture', [
    s('c.injury_deformity', 'Yes', 3, 'Deformity / abnormal movement'),
    s('exam.msk.msk_look', ['Deformity', 'Swelling'], 2, 'Deformity / swelling'),
    s('exam.msk.msk_feel', ['Tender', 'Crepitus'], 2, 'Bony tenderness / crepitus'),
    s('c.msk_cannot_bear_weight', 'Yes', 2, 'Cannot bear weight / use limb'),
  ], ['X-ray two views including the joints above and below', 'Neurovascular check before and after splinting'], ['Analgesia, splint; orthopaedic referral']),
  R('open_fracture', 'Open fracture', [
    s('exam.msk.msk_look', 'Wound over bone', 4, 'Wound over a fracture'),
    s('exam.local_wound.wound_floor', 'Exposed bone', 3, 'Exposed bone'),
    s('exam.local_hand.hand_bones', 'Open fracture', 4, 'Open hand fracture'),
    s('c.injury_mechanism', ['Gunshot', 'Road traffic — motorcycle', 'Road traffic — pedestrian', 'Blast'], 1, 'High-energy mechanism'),
  ], ['X-ray; photograph the wound; neurovascular status'], ['IV antibiotics within 1 hour, tetanus, saline-soaked dressing, splint', 'Debridement in theatre; joint ortho-plastic management (BOAST)'], { dangerous: true }),
  R('polytrauma', 'Multiple trauma — ATLS primary survey', [
    s('c.injury_mechanism', ['Road traffic — motorcycle', 'Road traffic — car occupant', 'Road traffic — pedestrian', 'Fall from height', 'Gunshot', 'Blast'], 3, 'High-energy mechanism'),
    s('c.injury_head', 'Yes', 2, 'Head injury'),
    d('hypotension', 3, 'Hypotension'), d('tachycardia', 1, 'Tachycardia'),
  ], ['Trauma series (CXR, pelvis), FAST / eFAST', 'Group and cross-match, ABG, lactate'], ['ATLS: airway with C-spine control, breathing, circulation with haemorrhage control', 'Activate trauma team / senior on call'], { dangerous: true }),

  // ── Infection / systemic ──────────────────────────────────────────────────
  R('uti', 'Urinary tract infection / pyelonephritis', [
    s('c.gu_dysuria', 'Yes', 3, 'Dysuria'), s('c.gu_frequency', 'Yes', 2, 'Frequency / urgency'),
    ros('Painful urination', 2, 'Painful urination'),
    s('c.fever_source', 'Urine (dysuria)', 2, 'Urinary source suspected'),
    s('c.pain_site', 'Flank', 2, 'Loin pain (pyelonephritis)'),
  ], ['Urine dipstick and culture', 'U&E; FBC and blood cultures if febrile', 'Pregnancy test in women of reproductive age'], ['Antibiotics per local guideline and culture', 'Admit if pyelonephritis with systemic features']),
  R('pneumonia', 'Pneumonia', [
    s('c.resp_sputum', ['Yellow / green', 'Blood-stained'], 2, 'Purulent sputum'),
    s('exam.resp.added_sounds', 'Crackles', 2, 'Crackles'),
    s('exam.resp.breath_sounds', 'Bronchial', 3, 'Bronchial breathing'),
    s('exam.resp.percussion', 'Dull', 2, 'Dull percussion'),
    d('fever', 1, 'Fever'), d('tachypnoea', 1, 'Raised respiratory rate'), d('hypoxia', 2, 'Low SpO₂'),
  ], ['Chest X-ray', 'FBC, CRP, U&E (CURB-65)', 'Sputum / blood cultures if severe'], ['Antibiotics per CURB-65 and local guideline', 'Oxygen to target saturations']),
  R('malignancy', 'Occult malignancy', [
    ros('Weight loss', 2), s('c.gi_weight', 'Loss > 5 % in 6 months', 3, 'Significant weight loss'),
    s('exam.general.nutrition', 'Wasted / cachectic', 2, 'Cachexia'),
    d('age_over_50', 1, 'Older age'),
    s('exam.general.lymph_general', ['Localised', 'Generalised'], 1, 'Lymphadenopathy'),
  ], ['FBC, ESR, LFT, calcium, chest X-ray; targeted imaging by symptoms'], ['Systematic search for a primary; urgent suspected-cancer pathway'], { dangerous: true }),
  R('tb', 'Tuberculosis', [
    s('c.resp_tb_contact', 'Yes', 3, 'TB contact / night sweats / weight loss'),
    ros('Night sweats', 2), ros('Weight loss', 1), ros('Cough', 1),
    s('pmh.hiv', 'Yes', 2, 'HIV'), s('pmh.tb', 'Yes', 1, 'Previous TB'),
    s('c.resp_sputum', 'Blood-stained', 1, 'Haemoptysis'),
  ], ['Sputum GeneXpert / AFB × 2', 'Chest X-ray, HIV test'], ['Notify; DOTS per national programme', 'Respiratory isolation while infectious']),
  R('hiv', 'HIV infection (undiagnosed)', [
    ros('Weight loss', 1), ros('Night sweats', 1),
    s('exam.general.lymph_general', 'Generalised', 2, 'Generalised lymphadenopathy'),
    s('exam.oral.oral_mucosa', ['Erosions', 'Ulcer'], 1, 'Oral lesions'),
    s('pmh.tb', 'Yes', 2, 'TB (HIV indicator condition)'),
  ], ['HIV test with consent and counselling'], ['Link to ART clinic']),
  R('diabetes_uncontrolled', 'Uncontrolled / new diabetes', [
    d('hyperglycaemia', 3, 'Raised glucose'),
    s('pmh.diabetes', 'Yes', 1, 'Known diabetes'),
    s('ros.Weight loss', 'present', 1, 'Weight loss'),
    s('c.gu_frequency', 'Yes', 1, 'Polyuria'),
  ], ['HbA1c, fasting glucose, urine ketones, U&E'], ['Glycaemic control with physicians; foot and wound review']),
  R('thyrotoxicosis', 'Thyrotoxicosis', [
    s('exam.cvs.pulse_character', ['Irregularly irregular', 'Bounding'], 1, 'Bounding / irregular pulse'),
    d('tachycardia', 2, 'Tachycardia'),
    s('exam.head_neck.hn_neck', 'Thyroid enlarged', 2, 'Goitre'),
    ros('Weight loss', 1), s('c.cvs_palpitations', 'Yes', 1, 'Palpitations'),
  ], ['TSH, free T4 / T3', 'ECG'], ['Beta-blocker for symptoms with physicians; antithyroid treatment', 'Do not operate until euthyroid (thyroid storm risk)']),
  R('sickle_crisis', 'Sickle cell crisis', [
    s('pmh.sickle_cell', 'Yes', 4, 'Sickle cell disease'),
    s('c.pain_character', ['Dull / aching', 'Throbbing / pulsating', 'Gnawing'], 1, 'Bone pain'),
    d('fever', 1, 'Fever'),
    s('exam.general.pallor', ['Moderate', 'Severe'], 1, 'Pallor'),
  ], ['FBC, reticulocytes, U&E, LFT; blood cultures and CXR if febrile or chest symptoms'], ['Rapid analgesia (within 30 min), fluids, oxygen if hypoxic', 'Watch for acute chest syndrome; haematology']),
  R('heart_failure', 'Heart failure', [
    s('c.resp_orthopnoea', 'Yes', 3, 'Orthopnoea / PND'),
    s('exam.cvs.jvp', 'Raised', 3, 'Raised JVP'),
    s('exam.general.oedema', ['Pitting — ankle', 'Pitting — to knee', 'Sacral'], 2, 'Pitting oedema'),
    s('exam.cvs.heart_sounds', 'Gallop (S3/S4)', 2, 'Gallop rhythm'),
    s('exam.resp.added_sounds', 'Crackles', 1, 'Basal crackles'),
    s('pmh.heart_disease', 'Yes', 1, 'Heart disease'), s('pmh.hypertension', 'Yes', 1, 'Hypertension'),
  ], ['ECG, CXR, BNP if available, echocardiogram', 'U&E, FBC, TFT'], ['Diuretic and fluid restriction with physicians; optimise before anaesthesia']),
  R('nephrotic', 'Nephrotic syndrome', [
    s('exam.general.oedema', ['Generalised (anasarca)', 'Sacral'], 2, 'Generalised oedema'),
  ], ['Urinalysis (heavy protein), urine PCR, albumin, lipids, U&E'], ['Nephrology referral; VTE risk assessment']),
  R('hypoalbuminaemia', 'Hypoalbuminaemia (malnutrition / liver / protein loss)', [
    s('exam.general.oedema', ['Generalised (anasarca)', 'Pitting — to knee'], 2, 'Oedema'),
    s('exam.general.nutrition', ['Underweight', 'Wasted / cachectic'], 2, 'Poor nutrition'),
    s('pmh.liver_disease', 'Yes', 1, 'Liver disease'),
    s('pmh.malnutrition', 'Yes', 2, 'Malnutrition'),
  ], ['Albumin, LFT, urinalysis'], ['Nutritional support (dietitian) — key for wound healing']),
  R('asthma', 'Asthma / COPD exacerbation', [
    s('c.resp_wheeze', 'Yes', 3, 'Wheeze'),
    s('exam.resp.added_sounds', 'Wheeze', 3, 'Wheeze on auscultation'),
    s('pmh.asthma_copd', 'Yes', 3, 'Known asthma / COPD'),
  ], ['Peak flow, SpO₂; ABG if severe'], ['Bronchodilators and steroids per GINA / GOLD', 'Life-threatening features: senior review now'],
  { against: [s('exam.resp.added_sounds', 'Stridor', 3, 'Stridor is upper-airway, not asthma')] }),
  R('pe', 'Pulmonary embolism', [
    s('c.resp_calf', 'Yes', 3, 'Immobility / surgery / calf swelling'),
    s('c.resp_chest_pain', 'Yes', 2, 'Pleuritic chest pain'),
    d('tachycardia', 1, 'Tachycardia'), d('hypoxia', 2, 'Hypoxia'),
    s('pmh.thromboembolism', 'Yes', 2, 'Previous VTE'),
    s('gyn.contraception', 'Combined pill (oestrogen — VTE risk)', 1, 'Oestrogen'),
    s('pmh.cancer', 'Yes', 1, 'Cancer'),
  ], ['Wells score; D-dimer if low probability', 'CTPA (or V/Q); ECG, ABG'], ['Anticoagulate if high probability while awaiting imaging (check bleeding risk)', 'Unstable: senior / critical care — thrombolysis'], { dangerous: true }),
  R('lung_cancer', 'Lung cancer', [
    s('c.resp_sputum', 'Blood-stained', 2, 'Haemoptysis'),
    s('social.smoking', ['Current smoker', 'Ex-smoker'], 2, 'Smoking'),
    s('social.smoking_amount', '> 20', 1, '> 20 pack-years'),
    s('exam.general.clubbing', 'Present', 2, 'Clubbing'),
    ros('Weight loss', 1), d('age_over_40', 1, 'Over 40'),
  ], ['Chest X-ray; CT chest'], ['Urgent respiratory referral'], { dangerous: true }),
  R('upper_airway_obstruction', 'Upper airway obstruction', [
    s('exam.resp.added_sounds', 'Stridor', 4, 'Stridor'),
    s('exam.airway_inhalation.airway_patent', ['At risk', 'Obstructed'], 4, 'Airway at risk'),
    s('exam.resp.resp_effort', ['Using accessory muscles', 'Unable to speak in sentences'], 2, 'Increased work of breathing'),
  ], ['Do not lie flat or examine the throat aggressively; senior anaesthesia / ENT now'], ['AIRWAY EMERGENCY — call for help, oxygen, prepare for definitive airway'], { dangerous: true }),
  R('laryngeal_pathology', 'Laryngeal pathology (incl. cancer, nerve palsy)', [
    s('social.smoking', ['Current smoker', 'Ex-smoker'], 2, 'Smoking'),
    s('c.course', 'Progressively worsening', 1, 'Progressive hoarseness'),
    s('psh.previous_surgery', 'Yes', 1, 'Previous neck / chest surgery (recurrent laryngeal nerve)'),
  ], ['Laryngoscopy for hoarseness > 3 weeks'], ['ENT referral']),
  R('acs', 'Acute coronary syndrome', [
    s('c.pain_character', 'Tight / pressing / crushing', 3, 'Crushing chest pain'),
    s('c.pain_radiation', ['To the arm', 'To the jaw / neck'], 2, 'Radiates to arm / jaw'),
    s('c.cvs_sweating', 'Yes', 2, 'Sweating / nausea'),
    s('c.cvs_exertional', 'Yes', 1, 'Exertional'),
    s('pmh.diabetes', 'Yes', 1, 'Diabetes'), s('pmh.hypertension', 'Yes', 1, 'Hypertension'), s('social.smoking', 'Current smoker', 1, 'Smoking'),
  ], ['12-lead ECG within 10 minutes', 'Troponin (serial)'], ['Aspirin unless contraindicated, oxygen if hypoxic, analgesia; URGENT medical / cardiology'], { dangerous: true }),
  R('musculoskeletal_chest', 'Musculoskeletal chest pain', [
    s('c.aggravating', ['Movement', 'Pressure / touch'], 2, 'Worse with movement / pressure'),
    s('c.pain_character', 'Sharp / stabbing', 1, 'Sharp, localised'),
  ], ['ECG to exclude cardiac cause'], ['Analgesia; reassurance once serious causes excluded'],
  { against: [s('c.cvs_sweating', 'Yes', 3, 'Sweating / collapse — exclude ACS')] }),
  R('arrhythmia', 'Arrhythmia', [
    s('c.cvs_palpitations', 'Yes', 2, 'Palpitations'),
    s('exam.cvs.pulse_character', 'Irregularly irregular', 3, 'Irregular pulse'),
    d('tachycardia', 1, 'Tachycardia'), d('bradycardia', 2, 'Bradycardia'),
    s('c.cvs_syncope', 'Yes', 2, 'Syncope'),
  ], ['12-lead ECG; U&E, magnesium, TFT', 'Holter if intermittent'], ['Treat per rhythm and stability (ALS); anticoagulation assessment for AF']),
  R('hypovolaemia', 'Hypovolaemia / dehydration', [
    s('exam.general.hydration', ['Moderate dehydration', 'Severe dehydration'], 3, 'Dehydration'),
    s('exam.general_extra.mucosa', 'Dry', 1, 'Dry mucosa'),
    s('exam.general_extra.capillary_refill_central', '> 3 s', 2, 'Delayed capillary refill'),
    d('hypotension', 2, 'Hypotension'), d('tachycardia', 1, 'Tachycardia'),
    s('c.gu_output', ['Reduced', 'Very little / none'], 1, 'Reduced urine output'),
  ], ['U&E, FBC, lactate; fluid balance chart'], ['IV fluid resuscitation with reassessment; find and treat the cause (bleeding, losses)']),
  R('hypoglycaemia', 'Hypoglycaemia', [
    d('hypoglycaemia', 5, 'Glucose < 4 mmol/L'),
    s('hx.drug_high_risk', 'Insulin', 2, 'On insulin'),
    s('pmh.diabetes', 'Yes', 1, 'Diabetes'),
  ], ['Capillary glucose now; repeat after treatment'], ['Treat immediately (oral glucose if alert; IV dextrose / glucagon if not) per protocol'], { dangerous: true }),
  R('meningitis', 'Meningitis / encephalitis', [
    s('exam.neuro.meningism', 'Present', 4, 'Neck stiffness'),
    s('c.neuro_headache_red', 'Yes', 2, 'Severe headache / neck stiffness / fits'),
    d('fever', 2, 'Fever'), d('altered_mentation', 2, 'Altered consciousness'),
    s('c.rash_type', 'Purpura', 3, 'Purpuric rash'),
  ], ['Blood cultures BEFORE antibiotics', 'LP if no contraindication; CT head first if focal signs / reduced GCS'], ['IV antibiotics without delay per guideline — do not wait for LP', 'Senior / critical care review'], { dangerous: true }),
  R('sah', 'Subarachnoid haemorrhage', [
    s('c.neuro_headache_red', 'Yes', 4, 'Thunderclap / worst-ever headache'),
    s('c.onset', 'Sudden (seconds–minutes)', 3, 'Sudden onset'),
    s('exam.neuro.meningism', 'Present', 2, 'Neck stiffness'),
  ], ['URGENT CT head; LP ≥ 12 h if CT negative'], ['Neurosurgical referral'], { dangerous: true }),
  R('hypertensive_emergency', 'Hypertensive emergency', [
    d('severe_hypertension', 4, 'BP ≥ 180/120'),
    s('c.neuro_consciousness', 'Yes', 2, 'Confusion'),
    s('pmh.hypertension', 'Yes', 1, 'Known hypertension'),
  ], ['Fundoscopy, ECG, U&E, urinalysis, troponin'], ['Controlled BP reduction under monitoring with physicians (avoid abrupt drops)'], { dangerous: true }),
  R('tension_headache', 'Tension-type headache', [
    s('c.pain_character', ['Tight / pressing / crushing', 'Dull / aching'], 2, 'Band-like / pressing'),
    s('c.course', ['Intermittent / episodic', 'Fluctuating'], 1, 'Episodic'),
    s('c.neuro_headache_red', 'No', 2, 'No red flags'),
  ], ['Clinical; BP'], ['Simple analgesia (limit to avoid medication-overuse headache), lifestyle']),
  R('migraine', 'Migraine', [
    s('c.pain_character', 'Throbbing / pulsating', 2, 'Throbbing'),
    s('c.previous_episodes', ['Several times before', 'Recurrent / chronic'], 2, 'Recurrent episodes'),
    ros('Visual disturbance', 1, 'Visual aura'), d('female', 1, 'Female'),
  ], ['Clinical'], ['Acute treatment and prophylaxis per guideline'],
  { against: [s('c.onset', 'Sudden (seconds–minutes)', 3, 'Thunderclap onset — exclude SAH')] }),
  R('epilepsy', 'Epilepsy / seizure disorder', [
    s('pmh.epilepsy', 'Yes', 4, 'Known epilepsy'),
    s('c.previous_episodes', ['Several times before', 'Recurrent / chronic'], 1, 'Previous episodes'),
    ros('Fits', 2),
  ], ['Glucose, U&E, calcium, magnesium; CT head for first fit or injury', 'Anticonvulsant levels if relevant'], ['Safety; benzodiazepine for seizures > 5 min per protocol; neurology']),
  R('spinal_cord', 'Spinal cord compression / cauda equina', [
    s('c.neuro_sphincter', 'Yes', 4, 'Bladder / bowel control lost'),
    s('c.neuro_weakness_dist', 'Both legs', 3, 'Bilateral leg weakness'),
    s('exam.neuro.sensation', 'Sensory level', 3, 'Sensory level'),
    s('exam.neuro.power', ['Paraparesis', 'Quadriparesis'], 3, 'Para- / quadriparesis'),
    s('pmh.cancer', 'Yes', 1, 'Cancer'),
  ], ['URGENT whole-spine MRI'], ['EMERGENCY — spinal / neurosurgical referral; steroids for malignant compression per guideline'], { dangerous: true }),
  R('peripheral_neuropathy', 'Peripheral neuropathy', [
    s('c.neuro_sensory', 'Glove-and-stocking', 4, 'Glove-and-stocking'),
    s('exam.neuro.sensation', 'Glove-and-stocking loss', 3, 'Glove-and-stocking loss'),
    s('exam.limb_neuro.ln_sensation', 'Monofilament not felt (protective sensation lost)', 2, 'Protective sensation lost'),
    s('pmh.diabetes', 'Yes', 2, 'Diabetes'), s('pmh.hiv', 'Yes', 1, 'HIV'), s('social.alcohol', 'Heavy', 1, 'Alcohol'),
  ], ['Glucose / HbA1c, B12, TFT, U&E, HIV'], ['Treat cause; foot protection and education']),
  R('septic_arthritis', 'Septic arthritis', [
    s('c.msk_hot_joint', 'Yes', 4, 'Hot, red, swollen joint'),
    s('c.msk_joint', 'Single joint', 2, 'Monoarthritis'),
    s('exam.msk.msk_move', 'Painful movement', 1, 'Pain on any movement'),
    d('fever', 2, 'Fever'),
  ], ['Joint aspiration BEFORE antibiotics (Gram stain, culture, crystals)', 'FBC, CRP, blood cultures'], ['Urgent orthopaedic washout; IV antibiotics per guideline'], { dangerous: true }),
  R('osteoarthritis', 'Osteoarthritis', [
    s('c.msk_stiffness', '< 30 minutes', 2, 'Short morning stiffness'),
    s('c.aggravating', ['Movement', 'Weight bearing'], 2, 'Worse with use'),
    d('age_over_50', 1, 'Over 50'), s('pmh.obesity', 'Yes', 1, 'Obesity'),
  ], ['X-ray'], ['Exercise, weight loss, analgesia; joint replacement for severe disease']),
  R('gout', 'Gout', [
    s('c.msk_joint', 'Single joint', 1, 'Monoarthritis'),
    s('c.onset', ['Acute (hours)', 'Sudden (seconds–minutes)'], 2, 'Rapid onset'),
    s('c.msk_hot_joint', 'Yes', 1, 'Hot, swollen joint'),
    d('male', 1, 'Male'), s('social.alcohol', ['Heavy', 'Regular — within safe limits'], 1, 'Alcohol'),
  ], ['Joint aspiration (urate crystals; exclude sepsis)', 'Serum urate (after the attack), U&E'], ['NSAID / colchicine / steroid per guideline and renal function']),
  R('rheumatoid_arthritis', 'Rheumatoid / inflammatory arthritis', [
    s('c.msk_joint', 'Many small joints', 3, 'Many small joints'),
    s('c.msk_stiffness', '> 30 minutes', 3, 'Prolonged morning stiffness'),
    d('female', 1, 'Female'),
  ], ['RF, anti-CCP, ESR / CRP, X-rays of hands and feet'], ['Early rheumatology referral (DMARDs)']),
  R('mechanical_back_pain', 'Mechanical back pain', [
    s('c.aggravating', ['Movement', 'Weight bearing'], 2, 'Worse with movement'),
    s('c.relieving', 'Rest', 1, 'Better with rest'),
    s('c.neuro_sphincter', 'No', 1, 'No sphincter disturbance'),
  ], ['None unless red flags'], ['Analgesia, stay active, physiotherapy'],
  { against: [s('d.fever', 'yes', 2, 'Fever — exclude infection'), s('c.pain_night', 'Yes', 2, 'Night pain — exclude tumour / infection')] }),
  R('spinal_tb', "Spinal tuberculosis (Pott's disease)", [
    s('exam.spine.spine_inspection', ['Kyphosis / gibbus', 'Sinus', 'Swelling'], 4, 'Gibbus / cold abscess'),
    ros('Night sweats', 1), ros('Weight loss', 1),
    s('pmh.tb', 'Yes', 1, 'TB'), s('pmh.hiv', 'Yes', 1, 'HIV'),
  ], ['Spine X-ray / MRI; ESR, CXR, GeneXpert of biopsy / pus'], ['Anti-TB therapy; spinal referral for deficit or instability']),
  R('bone_tumour', 'Bone tumour (primary or metastatic)', [
    s('c.pain_night', 'Yes', 3, 'Night pain'),
    s('exam.msk.msk_look', 'Swelling', 1, 'Bony swelling'),
    s('pmh.cancer', 'Yes', 2, 'Known cancer (metastasis)'),
    d('age_under_40', 1, 'Young (primary bone sarcoma)'),
  ], ['X-ray; MRI; biopsy at a sarcoma unit', 'Calcium, ALP, FBC'], ['Do not biopsy outside the treating centre; sarcoma MDT'], { dangerous: true }),
  R('malunion', 'Malunion / post-traumatic deformity', [
    s('c.def_onset', 'After injury', 3, 'After injury'),
    s('c.treatment_so_far', 'Traditional bone setter', 3, 'Treated by a traditional bone setter'),
    s('exam.msk.msk_look', 'Deformity', 2, 'Deformity'),
  ], ['X-rays (long-leg views for lower limb)'], ['Corrective osteotomy if functional deficit']),

  // ── Abdomen / GI ──────────────────────────────────────────────────────────
  R('peptic_ulcer', 'Peptic ulcer disease', [
    s('c.pain_character', ['Gnawing', 'Burning'], 2, 'Gnawing / burning epigastric pain'),
    s('c.timing', 'Worse after meals', 1, 'Related to meals'),
    s('c.gi_bowels', 'Black tarry stool', 2, 'Melaena'),
    s('c.treatment_so_far', 'Over-the-counter analgesics', 1, 'NSAID use'),
  ], ['H. pylori test; FBC', 'OGD if bleeding, anaemia, weight loss or age > 55'], ['PPI, H. pylori eradication, stop NSAIDs', 'Perforation (sudden severe pain, rigidity): URGENT surgery']),
  R('intestinal_obstruction', 'Intestinal obstruction', [
    s('c.gi_vomiting', ['Bile (green)', 'Faeculent'], 3, 'Bilious / faeculent vomiting'),
    s('c.gi_bowels', 'Absolute constipation (no flatus)', 4, 'Absolute constipation'),
    s('exam.abdo.abdo_inspection', ['Distended', 'Visible peristalsis'], 2, 'Distension'),
    s('exam.abdo.bowel_sounds', ['Increased', 'Absent'], 1, 'Abnormal bowel sounds'),
    s('exam.abdo.hernial_orifices', 'Hernia present', 2, 'Hernia (check for strangulation)'),
  ], ['Abdominal X-ray / CT', 'U&E, lactate, FBC'], ['NBM, NG tube, IV fluids, catheter; URGENT surgical review'], { dangerous: true }),
  R('peritonitis', 'Peritonitis / perforated viscus', [
    s('exam.abdo.abdo_tenderness', ['Rebound / peritonism', 'Board-like rigidity', 'Guarding'], 4, 'Peritonism'),
    s('exam.abdo.bowel_sounds', 'Absent', 2, 'Absent bowel sounds'),
    d('fever', 1, 'Fever'), d('tachycardia', 1, 'Tachycardia'),
  ], ['Erect CXR (free gas), CT; FBC, U&E, lactate, amylase'], ['Resuscitation, IV antibiotics, NBM; URGENT surgery'], { dangerous: true }),
  R('biliary_colic', 'Biliary colic / cholecystitis', [
    s('c.pain_character', 'Colicky (comes in waves)', 1, 'Colicky'),
    s('c.timing', 'Worse after meals', 2, 'After fatty meals'),
    s('c.pain_radiation', 'To the shoulder', 2, 'Radiates to the right shoulder'),
    s('c.gi_jaundice', 'Yes', 1, 'Jaundice (consider CBD stone)'),
  ], ['Ultrasound abdomen; LFT, FBC, amylase / lipase'], ['Analgesia; cholecystectomy']),
  R('gastroenteritis', 'Gastroenteritis', [
    s('c.gi_bowels', 'Diarrhoea', 3, 'Diarrhoea'),
    s('c.gi_vomiting', 'Food', 1, 'Vomiting'),
    s('c.onset', ['Acute (hours)', 'Subacute (days)'], 1, 'Acute'),
  ], ['Stool microscopy / culture if bloody or prolonged; U&E'], ['Oral / IV rehydration; infection-control precautions']),
  R('c_difficile', 'Clostridioides difficile infection', [
    s('c.gi_bowels', 'Diarrhoea', 2, 'Diarrhoea'),
    s('c.treatment_so_far', ['Antibiotics (oral)', 'Antibiotics (injection)'], 3, 'Recent antibiotics'),
    s('c.precipitant', 'Medication', 1, 'Medication-related'),
  ], ['Stool C. difficile toxin', 'FBC, U&E, CRP'], ['Isolate; stop unnecessary antibiotics; treat per guideline']),
  R('haemorrhoids', 'Haemorrhoids', [
    s('c.bleed_site', 'Rectum / stool', 2, 'Rectal bleeding'),
    s('c.bleed_amount', 'Streaks / spots', 2, 'Bright red, small volume'),
    s('c.gi_bowels', 'Constipation', 1, 'Constipation'),
  ], ['Proctoscopy; colonoscopy if age > 50, weight loss, anaemia or change in bowel habit'], ['Fibre, fluids; banding / surgery per grade']),
  R('colorectal_cancer', 'Colorectal cancer', [
    s('c.gi_bowels', ['Blood in stool', 'Alternating'], 2, 'Rectal bleeding / change in bowel habit'),
    s('c.gi_weight', 'Loss > 5 % in 6 months', 2, 'Weight loss'),
    s('exam.general.pallor', ['Moderate', 'Severe'], 1, 'Anaemia'),
    d('age_over_50', 1, 'Over 50'),
    s('exam.abdo.dre', 'Abnormal', 3, 'Abnormal DRE'),
  ], ['FBC, iron studies; colonoscopy; CEA; CT staging'], ['Colorectal MDT'], { dangerous: true }),
  R('oesophageal_cancer', 'Oesophageal cancer', [
    s('c.course', 'Progressively worsening', 2, 'Progressive dysphagia'),
    s('c.gi_weight', 'Loss > 5 % in 6 months', 2, 'Weight loss'),
    s('social.smoking', ['Current smoker', 'Ex-smoker'], 1, 'Smoking'), s('social.alcohol', 'Heavy', 1, 'Alcohol'),
  ], ['URGENT OGD and biopsy', 'CT staging'], ['Upper GI MDT; nutritional support'], { dangerous: true }),
  R('stricture', 'Benign oesophageal stricture (incl. caustic)', [
    s('c.precipitant', ['Medication', 'Traditional / herbal treatment'], 1, 'Possible ingestion'),
    s('c.course', ['Static / unchanged', 'Progressively worsening'], 1, 'Persistent dysphagia'),
  ], ['Barium swallow / OGD'], ['Dilatation; nutrition']),
  R('ascites', 'Ascites', [
    s('exam.abdo.abdo_percussion', 'Shifting dullness', 4, 'Shifting dullness'),
    s('exam.abdo.abdo_inspection', 'Distended', 1, 'Distension'),
    s('pmh.liver_disease', 'Yes', 2, 'Liver disease'),
  ], ['Ultrasound; diagnostic tap (SAAG, cell count, cytology, culture)', 'LFT, albumin, clotting'], ['Treat cause; diuretics / paracentesis with physicians']),
  R('abdominal_mass', 'Abdominal mass (organomegaly / tumour)', [
    s('exam.abdo.abdo_mass', 'Present', 4, 'Palpable mass'),
    s('exam.abdo.abdo_organs', ['Hepatomegaly', 'Splenomegaly', 'Palpable kidney', 'Palpable bladder'], 3, 'Organomegaly'),
  ], ['Ultrasound / CT; FBC, LFT, U&E'], ['Refer by likely organ of origin']),
  R('perianal_abscess', 'Perianal abscess', [
    s('c.lump_site', 'Perineum / genitalia', 1, 'Perianal'),
    s('c.lump_painful', 'Painful', 1, 'Painful'),
    s('exam.local_lump.lump_fluctuation', 'Present', 2, 'Fluctuant'),
    d('fever', 1, 'Fever'), s('pmh.diabetes', 'Yes', 1, 'Diabetes'),
  ], ['Glucose; EUA'], ['Incision and drainage']),
  R('fistula_in_ano', 'Fistula-in-ano', [
    s('c.previous_episodes', ['Several times before', 'Recurrent / chronic'], 2, 'Recurrent perianal discharge'),
    s('c.lump_discharge', ['Pus', 'Blood'], 2, 'Persistent discharge'),
  ], ['MRI pelvis for complex fistula; exclude Crohn, TB, HIV'], ['Fistulotomy / seton per anatomy']),
  R('fournier', "Fournier's gangrene (perineal necrotising fasciitis)", [
    s('exam.genital.gen_inspection', 'Necrosis / crepitus', 5, 'Necrosis / crepitus of the perineum'),
    s('c.pain_out_of_proportion', 'Yes', 3, 'Pain out of proportion'),
    s('pmh.diabetes', 'Yes', 1, 'Diabetes'),
    d('fever', 1, 'Fever'), d('tachycardia', 1, 'Tachycardia'),
  ], ['FBC, U&E, glucose, lactate, blood cultures'], ['SURGICAL EMERGENCY — resuscitation, broad-spectrum IV antibiotics, radical debridement'], { dangerous: true }),

  // ── Genitourinary / gynaecology ───────────────────────────────────────────
  R('sti', 'Sexually transmitted infection', [
    s('exam.genital.gen_inspection', ['Ulcer', 'Discharge'], 3, 'Genital ulcer / discharge'),
    s('c.gu_dysuria', 'Yes', 1, 'Dysuria'),
    s('exam.lymph.nodes_finding', ['Palpable — soft, mobile', 'Fluctuant'], 1, 'Inguinal nodes'),
  ], ['NAAT for gonorrhoea / chlamydia; syphilis serology; HIV test', 'Swab of ulcer'], ['Syndromic treatment per WHO / national guideline; partner notification']),
  R('schistosomiasis', 'Urinary schistosomiasis', [
    s('c.gu_haematuria', 'Yes', 2, 'Haematuria (terminal)'),
    s('social.occupation', ['Farmer', 'Student', 'Child'], 1, 'Freshwater exposure'),
    d('age_under_40', 1, 'Young'),
  ], ['Urine microscopy for S. haematobium ova (midday sample)', 'Ultrasound bladder'], ['Praziquantel per national guideline']),
  R('urological_cancer', 'Urological cancer (bladder / kidney / prostate)', [
    s('c.gu_haematuria', 'Yes', 3, 'Visible haematuria'),
    d('age_over_50', 1, 'Over 50'),
    s('social.smoking', ['Current smoker', 'Ex-smoker'], 1, 'Smoking'),
    s('exam.abdo.abdo_organs', 'Palpable kidney', 2, 'Renal mass'),
  ], ['Urinalysis / culture, U&E; ultrasound / CT urogram; cystoscopy', 'PSA (with counselling) in men'], ['Urology referral'], { dangerous: true }),
  R('urinary_retention', 'Acute urinary retention', [
    s('c.gu_retention', 'Yes', 3, 'Unable to pass urine'),
    s('exam.abdo.abdo_organs', 'Palpable bladder', 4, 'Palpable bladder'),
    d('male', 1, 'Male'),
  ], ['Bladder scan; U&E; urinalysis'], ['Catheterise; record residual volume; find cause (prostate, drugs, constipation, cord compression)']),
  R('aki', 'Acute kidney injury', [
    s('c.gu_output', ['Reduced', 'Very little / none'], 3, 'Reduced urine output'),
    d('hypotension', 1, 'Hypotension'),
    s('pmh.ckd', 'Yes', 1, 'Chronic kidney disease'),
    s('exam.general.hydration', ['Moderate dehydration', 'Severe dehydration'], 1, 'Dehydration'),
  ], ['U&E, potassium, urinalysis, bladder scan, renal ultrasound'], ['Fluid status optimisation; stop nephrotoxins; treat hyperkalaemia; renal referral per KDIGO'], { dangerous: true }),
  R('testicular_torsion', 'Testicular torsion', [
    s('exam.genital.gen_testes', 'High-riding / horizontal lie', 4, 'High-riding testis'),
    s('c.onset', 'Sudden (seconds–minutes)', 3, 'Sudden pain'),
    d('age_under_40', 1, 'Young male'),
  ], ['Clinical diagnosis — do not delay surgery for ultrasound'], ['EMERGENCY scrotal exploration (salvage best < 6 h)'], { dangerous: true }),
  R('hydrocele', 'Hydrocele', [
    s('exam.local_lump.lump_transillumination', 'Positive', 3, 'Transilluminates'),
    s('c.lump_painful', 'Painless', 1, 'Painless'),
  ], ['Ultrasound (exclude underlying tumour in adults)'], ['Repair if symptomatic; filarial test in endemic areas']),
  R('epididymo_orchitis', 'Epididymo-orchitis', [
    s('exam.genital.gen_testes', 'Swollen / tender', 3, 'Swollen, tender testis'),
    s('c.onset', ['Subacute (days)', 'Acute (hours)'], 1, 'Gradual onset'),
    s('c.gu_dysuria', 'Yes', 1, 'Urinary symptoms'),
    d('fever', 1, 'Fever'),
  ], ['Urinalysis, NAAT; ultrasound if uncertain'], ['Antibiotics per age / sexual-risk guideline'],
  { against: [s('c.onset', 'Sudden (seconds–minutes)', 3, 'Sudden onset — exclude torsion')] }),
  R('miscarriage', 'Miscarriage / early pregnancy bleeding', [
    s('gyn.pregnancy_possible', ['Yes', 'Pregnancy confirmed'], 3, 'Pregnant / possibly pregnant'),
    s('c.bleed_site', 'Vagina', 2, 'Vaginal bleeding'),
  ], ['β-hCG, pelvic ultrasound; FBC, group and save, rhesus status'], ['Gynaecology referral; anti-D if rhesus negative per guideline']),
  R('pregnancy', 'Pregnancy', [
    d('female_reproductive', 1, 'Woman of reproductive age'),
    s('gyn.cycle', 'Amenorrhoea', 2, 'Amenorrhoea'),
    s('gyn.pregnancy_possible', ['Yes', 'Pregnancy confirmed'], 3, 'Possible pregnancy'),
  ], ['Urine / serum β-hCG'], ['Review drugs, imaging and anaesthesia plans for pregnancy']),

  // ── Skin / dermatology ────────────────────────────────────────────────────
  R('drug_eruption', 'Drug eruption', [
    s('c.rash_new_drug', 'Yes', 4, 'New drug in the last 8 weeks'),
    s('c.rash_distribution', 'Widespread', 1, 'Widespread'),
  ], ['Drug timeline; FBC (eosinophils), LFT, U&E (DRESS)'], ['Stop the likely culprit; document as an allergy', 'Mucosal involvement or skin peeling: treat as SJS / TEN']),
  R('urticaria', 'Urticaria / angioedema', [
    s('c.rash_type', 'Wheals (urticaria)', 4, 'Wheals'),
    s('c.rash_itch', 'Yes', 1, 'Itchy'),
  ], ['Look for triggers; FBC if chronic'], ['Non-sedating antihistamine', 'Airway / lip swelling or wheeze: treat as anaphylaxis (IM adrenaline)']),
  R('bullous_disease', 'Autoimmune blistering disease (pemphigus / pemphigoid)', [
    s('c.rash_type', 'Blisters / bullae', 3, 'Blisters'),
    d('age_over_60', 1, 'Older age (pemphigoid)'),
    s('c.rash_distribution', 'Mucous membranes involved', 1, 'Mucosal (pemphigus)'),
  ], ['Skin biopsy with direct immunofluorescence'], ['Dermatology; wound care like a burn for extensive disease']),
  R('scabies', 'Scabies', [
    s('c.rash_itch', 'Yes', 2, 'Itchy'),
    s('c.timing', 'Worse at night', 2, 'Worse at night'),
    s('c.rash_type', 'Papules', 1, 'Papules / burrows'),
    s('c.rash_distribution', 'Flexures', 1, 'Finger webs / flexures'),
  ], ['Clinical; skin scraping'], ['Permethrin or ivermectin per guideline for patient and close contacts; wash bedding']),
  R('eczema', 'Eczema / dermatitis', [
    s('c.rash_type', 'Plaques / scales', 2, 'Scaly plaques'),
    s('c.rash_itch', 'Yes', 2, 'Itchy'),
    s('c.rash_distribution', 'Flexures', 1, 'Flexural'),
    s('exam.limb_vascular.lv_venous', 'Venous eczema', 2, 'Venous eczema'),
  ], ['Patch testing if contact dermatitis suspected'], ['Emollients, topical steroid; treat secondary infection']),

  // ── Endocrine ─────────────────────────────────────────────────────────────
  R('dka', 'Diabetic ketoacidosis / hyperosmolar state', [
    d('very_high_glucose', 3, 'Glucose ≥ 14 mmol/L'),
    s('c.gi_vomiting', 'Food', 1, 'Vomiting'),
    d('tachypnoea', 1, 'Deep, rapid breathing'),
    s('exam.general.hydration', ['Moderate dehydration', 'Severe dehydration'], 2, 'Dehydration'),
    d('altered_mentation', 1, 'Altered consciousness'),
  ], ['Capillary ketones, venous gas (pH, bicarbonate), U&E, osmolality'], ['DKA / HHS protocol: fluids, fixed-rate insulin, potassium; find the precipitant (often infection / wound)'], { dangerous: true }),
];


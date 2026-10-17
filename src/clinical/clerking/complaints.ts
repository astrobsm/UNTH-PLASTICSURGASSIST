/**
 * Presenting complaint catalogue.
 *
 * Grouped by system, each with lay terms, abbreviations and common
 * misspellings as synonyms so search finds what clinicians actually type
 * ("SOB", "boil", "bed sore", "keloid on ear"). Each complaint names the
 * question modules, focused examinations and candidate diagnoses it brings up.
 * Anything not listed can still be entered as free text ("Other") — the
 * general symptom analysis, history and examination still apply, and the AI
 * suggestions still run.
 */
import type { Complaint } from './types';

const c = (
  id: string, label: string, system: string, modules: string[], exams: string[],
  differentials: string[] = [], synonyms: string[] = [],
): Complaint => ({ id, label, system, modules, exams, differentials, synonyms });

const WOUND = ['wound_ulcer', 'pain'];
const LUMP = ['swelling_lump'];

export const COMPLAINTS: Complaint[] = [
  // ── Wounds, ulcers and soft-tissue infection ──────────────────────────────
  c('chronic_ulcer', 'Non-healing wound / chronic ulcer', 'Wounds & skin', WOUND, ['local_wound', 'limb_vascular', 'limb_neuro', 'lymph'], ['venous_ulcer', 'arterial_ulcer', 'diabetic_foot_ulcer', 'pressure_ulcer', 'marjolin_ulcer', 'sickle_ulcer', 'buruli_ulcer', 'infected_wound', 'tb_ulcer', 'scc_skin', 'pyoderma_gangrenosum'], ['ulcer', 'sore that will not heal', 'non healing ulcer', 'chronic wound', 'leg ulcer']),
  c('leg_ulcer', 'Leg ulcer', 'Wounds & skin', WOUND, ['local_wound', 'limb_vascular', 'limb_neuro'], ['venous_ulcer', 'arterial_ulcer', 'sickle_ulcer', 'diabetic_foot_ulcer', 'marjolin_ulcer', 'buruli_ulcer', 'infected_wound', 'pyoderma_gangrenosum'], ['ulcer on the leg', 'shin ulcer', 'tropical ulcer']),
  c('foot_ulcer', 'Foot ulcer / diabetic foot', 'Wounds & skin', [...WOUND, 'limb_vascular'], ['local_wound', 'limb_vascular', 'limb_neuro'], ['diabetic_foot_ulcer', 'diabetic_foot_infection', 'arterial_ulcer', 'necrotising_fasciitis', 'osteomyelitis'], ['diabetic foot', 'sole ulcer', 'gangrene of the foot', 'DFU']),
  c('pressure_sore', 'Pressure sore / bed sore', 'Wounds & skin', WOUND, ['local_wound', 'pressure_area', 'limb_neuro'], ['pressure_ulcer', 'infected_wound', 'osteomyelitis'], ['bed sore', 'decubitus ulcer', 'pressure injury', 'sacral sore']),
  c('acute_wound', 'Fresh wound / laceration', 'Wounds & skin', ['injury', 'pain'], ['local_wound', 'limb_neuro', 'local_hand'], ['simple_laceration', 'tendon_injury', 'nerve_injury', 'vascular_injury', 'retained_fb'], ['cut', 'laceration', 'gash', 'machete cut', 'stab wound']),
  c('wound_infection', 'Wound infection / discharging wound', 'Wounds & skin', [...WOUND, 'fever'], ['local_wound', 'lymph'], ['infected_wound', 'surgical_site_infection', 'necrotising_fasciitis', 'cellulitis', 'osteomyelitis', 'retained_fb'], ['pus from wound', 'smelling wound', 'septic wound', 'infected wound']),
  c('wound_dehiscence', 'Wound breakdown after surgery', 'Wounds & skin', [...WOUND, 'fever'], ['local_wound'], ['surgical_site_infection', 'wound_dehiscence'], ['burst wound', 'wound gaping', 'stitches opened', 'dehiscence']),
  c('cellulitis', 'Red, hot, swollen skin (cellulitis)', 'Wounds & skin', ['pain', 'fever', 'limb_vascular'], ['local_wound', 'limb_vascular', 'lymph'], ['cellulitis', 'necrotising_fasciitis', 'abscess', 'dvt', 'erysipelas'], ['cellulitis', 'skin infection', 'spreading redness', 'ascending cellulitis', 'erysipelas']),
  c('abscess', 'Boil / abscess / collection of pus', 'Wounds & skin', ['swelling_lump', 'pain', 'fever'], ['local_lump', 'lymph'], ['abscess', 'infected_cyst', 'pyomyositis', 'hidradenitis'], ['boil', 'furuncle', 'carbuncle', 'pus collection', 'abscess']),
  c('gangrene', 'Gangrene / dead or black tissue', 'Wounds & skin', [...WOUND, 'limb_vascular', 'fever'], ['local_wound', 'limb_vascular', 'limb_neuro'], ['dry_gangrene', 'wet_gangrene', 'necrotising_fasciitis', 'diabetic_foot_infection'], ['black toe', 'black finger', 'gangrene', 'dead skin', 'necrosis']),
  c('snake_bite', 'Snake bite', 'Wounds & skin', ['injury', 'pain', 'bleeding'], ['local_wound', 'limb_vascular', 'limb_neuro'], ['envenomation', 'compartment_syndrome', 'necrotising_fasciitis'], ['snakebite', 'snake bite wound']),
  c('animal_bite', 'Animal / human bite', 'Wounds & skin', ['injury', 'pain'], ['local_wound', 'local_hand'], ['infected_wound', 'tendon_injury', 'septic_arthritis_hand'], ['dog bite', 'human bite', 'fight bite', 'cat bite']),
  c('sinus_fistula', 'Discharging sinus / fistula', 'Wounds & skin', ['wound_ulcer'], ['local_wound', 'lymph'], ['osteomyelitis', 'retained_fb', 'tb_ulcer', 'hidradenitis'], ['sinus', 'fistula', 'draining tract', 'pilonidal']),
  c('skin_loss', 'Skin loss / degloving', 'Wounds & skin', ['injury', 'pain'], ['local_wound', 'limb_vascular'], ['degloving_injury', 'necrotising_fasciitis'], ['degloving', 'avulsion', 'skin peeled off']),

  // ── Burns ──────────────────────────────────────────────────────────────────
  c('burn', 'Burn injury', 'Burns', ['burn', 'pain'], ['local_burn', 'airway_inhalation'], ['burn_partial', 'burn_full', 'inhalation_injury', 'burn_sepsis'], ['burns', 'scald', 'flame burn', 'fire burn', 'hot water burn']),
  c('electrical_burn', 'Electrical burn', 'Burns', ['burn', 'pain'], ['local_burn', 'limb_vascular', 'limb_neuro', 'cvs'], ['electrical_injury', 'compartment_syndrome', 'rhabdomyolysis'], ['electrocution', 'electric shock burn']),
  c('chemical_burn', 'Chemical burn', 'Burns', ['burn', 'pain'], ['local_burn', 'eye'], ['chemical_burn'], ['acid burn', 'alkali burn', 'acid attack']),
  c('burn_wound_old', 'Old burn wound not healing', 'Burns', [...WOUND, 'burn'], ['local_burn', 'local_wound'], ['infected_wound', 'marjolin_ulcer', 'burn_sepsis'], ['old burn', 'burn sore', 'unhealed burn']),
  c('burn_contracture', 'Burn scar contracture', 'Burns', ['scar_keloid', 'deformity'], ['local_scar', 'msk'], ['burn_contracture', 'hypertrophic_scar', 'marjolin_ulcer'], ['burn contracture', 'tight burn scar', 'contracture after burn']),
  c('frostbite', 'Cold injury / frostbite', 'Burns', ['burn', 'limb_vascular'], ['local_burn', 'limb_vascular'], [], ['frostbite']),

  // ── Lumps, swellings and skin lesions ─────────────────────────────────────
  c('lump', 'Lump / swelling (skin or soft tissue)', 'Lumps & skin lesions', LUMP, ['local_lump', 'lymph'], ['lipoma', 'epidermoid_cyst', 'abscess', 'lymphadenopathy', 'soft_tissue_sarcoma', 'neurofibroma', 'haemangioma', 'ganglion'], ['lump', 'swelling', 'mass', 'growth', 'tumour']),
  c('neck_lump', 'Neck lump', 'Lumps & skin lesions', [...LUMP, 'respiratory'], ['local_lump', 'head_neck', 'lymph'], ['lymphadenopathy', 'thyroid_nodule', 'branchial_cyst', 'thyroglossal_cyst', 'tb_lymphadenitis', 'lymphoma', 'lipoma'], ['neck swelling', 'goitre', 'lump in the neck']),
  c('face_lump', 'Facial swelling / lump', 'Lumps & skin lesions', LUMP, ['local_lump', 'head_neck', 'oral'], ['parotid_tumour', 'dental_abscess', 'epidermoid_cyst', 'burkitt_lymphoma', 'haemangioma', 'vascular_malformation'], ['facial swelling', 'jaw swelling', 'cheek swelling']),
  c('jaw_swelling', 'Jaw / mandible swelling', 'Lumps & skin lesions', LUMP, ['local_lump', 'oral', 'head_neck'], ['ameloblastoma', 'dental_abscess', 'burkitt_lymphoma', 'osteomyelitis'], ['ameloblastoma', 'jaw mass', 'swollen jaw']),
  c('scalp_lump', 'Scalp lump', 'Lumps & skin lesions', LUMP, ['local_lump'], ['epidermoid_cyst', 'lipoma', 'dermoid_cyst', 'scc_skin'], ['pilar cyst', 'scalp swelling']),
  c('groin_lump', 'Groin lump', 'Lumps & skin lesions', LUMP, ['local_lump', 'abdo', 'genital', 'lymph'], ['inguinal_hernia', 'lymphadenopathy', 'femoral_hernia', 'abscess'], ['inguinal swelling', 'groin swelling', 'hernia']),
  c('axillary_lump', 'Armpit lump', 'Lumps & skin lesions', LUMP, ['local_lump', 'local_breast', 'lymph'], ['lymphadenopathy', 'hidradenitis', 'abscess', 'accessory_breast'], ['axillary swelling', 'lump in the armpit']),
  c('skin_lesion', 'Skin lesion / mole / growth on the skin', 'Lumps & skin lesions', ['skin_lesion'], ['local_skin_lesion', 'lymph'], ['melanoma', 'bcc', 'scc_skin', 'naevus', 'seborrhoeic_keratosis', 'kaposi_sarcoma', 'pyogenic_granuloma'], ['mole', 'skin growth', 'dark spot', 'nevus', 'wart']),
  c('pigmented_lesion', 'Dark / changing mole', 'Lumps & skin lesions', ['skin_lesion'], ['local_skin_lesion', 'lymph'], ['melanoma', 'naevus', 'seborrhoeic_keratosis'], ['black mole', 'changing mole', 'melanoma']),
  c('vascular_lesion', 'Birthmark / vascular lesion', 'Lumps & skin lesions', ['skin_lesion', 'deformity'], ['local_skin_lesion', 'local_lump'], ['haemangioma', 'vascular_malformation', 'pyogenic_granuloma'], ['birthmark', 'haemangioma', 'port wine stain', 'strawberry mark']),
  c('neurofibromas', 'Multiple skin nodules', 'Lumps & skin lesions', LUMP, ['local_lump', 'local_skin_lesion', 'neuro'], ['neurofibroma', 'lipoma', 'kaposi_sarcoma'], ['neurofibromatosis', 'multiple lumps']),
  c('nail_problem', 'Nail problem', 'Lumps & skin lesions', ['pain', 'skin_lesion'], ['local_hand', 'local_skin_lesion'], ['paronychia', 'ingrown_toenail', 'melanoma'], ['paronychia', 'whitlow', 'ingrown nail', 'nail infection']),

  // ── Scars and keloids ──────────────────────────────────────────────────────
  c('keloid', 'Keloid', 'Scars', ['scar_keloid'], ['local_scar'], ['keloid', 'hypertrophic_scar'], ['keloid', 'keloid on ear', 'raised scar', 'ear lobe keloid']),
  c('hypertrophic_scar', 'Raised / thick scar', 'Scars', ['scar_keloid'], ['local_scar'], ['hypertrophic_scar', 'keloid'], ['thick scar', 'hypertrophic scar']),
  c('scar_contracture', 'Scar contracture limiting movement', 'Scars', ['scar_keloid', 'deformity'], ['local_scar', 'msk'], ['burn_contracture', 'hypertrophic_scar'], ['contracture', 'tight scar']),
  c('ugly_scar', 'Unsightly scar (cosmetic)', 'Scars', ['scar_keloid'], ['local_scar'], ['hypertrophic_scar', 'keloid'], ['scar revision', 'bad scar', 'wide scar']),
  c('ulcer_in_scar', 'Ulcer in an old scar', 'Scars', [...WOUND, 'scar_keloid'], ['local_wound', 'local_scar', 'lymph'], ['marjolin_ulcer', 'infected_wound'], ['marjolin', 'scar ulcer', 'ulcer in burn scar']),

  // ── Hand and upper limb ────────────────────────────────────────────────────
  c('hand_injury', 'Hand injury', 'Hand & upper limb', ['injury', 'pain'], ['local_hand', 'limb_neuro', 'limb_vascular'], ['tendon_injury', 'nerve_injury', 'hand_fracture', 'vascular_injury', 'simple_laceration', 'fingertip_injury'], ['hand cut', 'crushed hand', 'finger injury', 'machine hand injury']),
  c('finger_injury', 'Finger / fingertip injury or amputation', 'Hand & upper limb', ['injury', 'pain'], ['local_hand', 'limb_vascular'], ['fingertip_injury', 'tendon_injury', 'nerve_injury', 'hand_fracture', 'traumatic_amputation'], ['fingertip injury', 'cut finger', 'amputated finger', 'nail bed injury']),
  c('hand_infection', 'Hand infection / swollen painful finger', 'Hand & upper limb', ['pain', 'fever'], ['local_hand', 'lymph'], ['flexor_sheath_infection', 'paronychia', 'felon', 'septic_arthritis_hand', 'deep_space_infection', 'cellulitis'], ['whitlow', 'felon', 'tenosynovitis', 'swollen finger', 'hand abscess']),
  c('hand_numbness', 'Numb / tingling hand', 'Hand & upper limb', ['neurological'], ['local_hand', 'limb_neuro', 'neuro'], ['carpal_tunnel', 'cubital_tunnel', 'nerve_injury', 'cervical_radiculopathy'], ['carpal tunnel', 'tingling fingers', 'numb fingers']),
  c('trigger_finger', 'Finger catching / locking', 'Hand & upper limb', ['pain'], ['local_hand'], ['trigger_finger', 'dupuytren'], ['trigger finger', 'locking finger']),
  c('hand_lump', 'Lump on the hand or wrist', 'Hand & upper limb', LUMP, ['local_lump', 'local_hand'], ['ganglion', 'giant_cell_tumour_tendon', 'epidermoid_cyst', 'lipoma'], ['ganglion', 'wrist lump']),
  c('hand_stiffness', 'Stiff / bent fingers', 'Hand & upper limb', ['deformity'], ['local_hand', 'msk'], ['dupuytren', 'burn_contracture', 'tendon_adhesion'], ['dupuytren', 'bent fingers', 'claw hand']),
  c('congenital_hand', 'Congenital hand difference', 'Hand & upper limb', ['deformity'], ['local_hand'], ['syndactyly', 'polydactyly'], ['extra finger', 'webbed fingers', 'polydactyly', 'syndactyly']),
  c('weak_grip', 'Weak grip / hand weakness', 'Hand & upper limb', ['neurological'], ['local_hand', 'limb_neuro', 'neuro'], ['nerve_injury', 'carpal_tunnel', 'cubital_tunnel', 'tendon_injury'], ['cannot grip', 'hand weakness', 'wrist drop']),

  // ── Head, face, congenital and reconstructive ─────────────────────────────
  c('cleft_lip_palate', 'Cleft lip / palate', 'Congenital & craniofacial', ['deformity'], ['oral', 'head_neck'], ['cleft_lip_palate'], ['cleft', 'hare lip', 'harelip', 'cleft palate']),
  c('facial_injury', 'Facial injury', 'Congenital & craniofacial', ['injury', 'pain'], ['head_neck', 'eye', 'oral', 'neuro'], ['facial_fracture', 'simple_laceration', 'facial_nerve_injury'], ['face cut', 'facial fracture', 'broken jaw', 'face trauma']),
  c('ear_deformity', 'Ear deformity / missing ear', 'Congenital & craniofacial', ['deformity'], ['head_neck'], ['microtia', 'keloid'], ['microtia', 'bat ear', 'prominent ears']),
  c('facial_palsy', 'Facial weakness / drooping', 'Congenital & craniofacial', ['neurological'], ['head_neck', 'neuro', 'eye'], ['facial_nerve_injury', 'bells_palsy', 'stroke'], ['facial palsy', 'bell palsy', 'face drooping']),
  c('noma', 'Facial gangrene / tissue loss (noma)', 'Congenital & craniofacial', [...WOUND, 'deformity'], ['oral', 'head_neck'], ['noma'], ['noma', 'cancrum oris']),
  c('eyelid_problem', 'Eyelid problem / droopy eyelid', 'Congenital & craniofacial', ['deformity'], ['eye'], ['ptosis', 'ectropion'], ['ptosis', 'droopy eyelid', 'ectropion']),
  c('oral_ulcer', 'Mouth ulcer / oral lesion', 'Congenital & craniofacial', WOUND, ['oral', 'lymph'], ['oral_scc', 'aphthous_ulcer', 'noma'], ['mouth sore', 'tongue ulcer']),
  c('hypospadias', 'Abnormal urethral opening (hypospadias)', 'Congenital & craniofacial', ['deformity'], ['genital'], ['hypospadias'], ['hypospadias']),

  // ── Breast and body contour ───────────────────────────────────────────────
  c('breast_lump', 'Breast lump', 'Breast & body', ['swelling_lump', 'breast'], ['local_breast', 'local_lump', 'lymph'], ['fibroadenoma', 'breast_cancer', 'breast_abscess', 'breast_cyst', 'fibrocystic'], ['lump in breast', 'breast mass']),
  c('breast_pain', 'Breast pain', 'Breast & body', ['pain', 'breast'], ['local_breast'], ['fibrocystic', 'breast_abscess', 'mastitis'], ['mastalgia']),
  c('breast_size', 'Large / small / asymmetric breasts', 'Breast & body', ['deformity'], ['local_breast'], ['macromastia', 'gynaecomastia'], ['big breasts', 'breast reduction', 'macromastia']),
  c('gynaecomastia', 'Male breast enlargement', 'Breast & body', ['breast'], ['local_breast', 'abdo'], ['gynaecomastia', 'breast_cancer'], ['gynecomastia', 'man boobs']),
  c('post_mastectomy', 'Breast reconstruction request (after mastectomy)', 'Breast & body', ['deformity'], ['local_breast'], [], ['breast reconstruction']),
  c('abdominal_wall', 'Excess skin / abdominal wall laxity', 'Breast & body', ['deformity'], ['abdo'], ['abdominal_laxity', 'incisional_hernia'], ['tummy tuck', 'abdominoplasty', 'apron belly']),
  c('lymphoedema', 'Limb swelling (lymphoedema)', 'Breast & body', ['limb_vascular'], ['limb_vascular', 'lymph'], ['lymphoedema', 'podoconiosis', 'filariasis', 'dvt'], ['elephantiasis', 'swollen leg', 'podoconiosis']),

  // ── Trauma (general) ──────────────────────────────────────────────────────
  c('limb_injury', 'Limb injury / fracture', 'Trauma', ['injury', 'pain', 'musculoskeletal'], ['msk', 'limb_vascular', 'limb_neuro', 'local_wound'], ['fracture', 'open_fracture', 'compartment_syndrome', 'vascular_injury'], ['broken leg', 'broken arm', 'fracture', 'open fracture']),
  c('rta', 'Road traffic injury (multiple injuries)', 'Trauma', ['injury'], ['airway_inhalation', 'resp', 'cvs', 'abdo', 'neuro', 'msk', 'local_wound'], ['polytrauma', 'head_injury', 'open_fracture'], ['RTA', 'RTC', 'accident', 'motorcycle accident']),
  c('head_injury', 'Head injury', 'Trauma', ['injury', 'neurological'], ['neuro', 'head_neck'], ['head_injury'], ['head trauma', 'fell on head']),
  c('gunshot', 'Gunshot injury', 'Trauma', ['injury', 'bleeding'], ['local_wound', 'limb_vascular', 'limb_neuro', 'abdo', 'resp'], ['vascular_injury', 'open_fracture', 'nerve_injury'], ['GSW', 'gunshot wound']),
  c('crush_injury', 'Crush injury', 'Trauma', ['injury', 'pain'], ['local_wound', 'limb_vascular', 'limb_neuro', 'msk'], ['compartment_syndrome', 'rhabdomyolysis', 'degloving_injury'], ['crushed limb']),

  // ── General / constitutional ──────────────────────────────────────────────
  c('fever', 'Fever', 'General', ['fever'], ['general_extra', 'lymph'], ['malaria', 'sepsis', 'surgical_site_infection', 'uti', 'pneumonia'], ['pyrexia', 'temperature', 'hot body']),
  c('weight_loss', 'Weight loss', 'General', ['gastrointestinal'], ['general_extra', 'abdo', 'lymph'], ['malignancy', 'tb', 'hiv', 'diabetes_uncontrolled', 'thyrotoxicosis'], ['losing weight', 'wasting']),
  c('weakness', 'General weakness / tiredness', 'General', [], ['general_extra'], ['anaemia', 'sepsis', 'diabetes_uncontrolled', 'malignancy'], ['fatigue', 'body weakness', 'malaise']),
  c('pallor', 'Paleness / low blood (anaemia)', 'General', ['bleeding'], ['general_extra'], ['anaemia', 'sickle_crisis'], ['anaemia', 'anemia', 'low blood', 'pale']),
  c('jaundice', 'Yellow eyes (jaundice)', 'General', ['gastrointestinal'], ['abdo'], [], ['yellow eyes', 'icterus']),
  c('night_sweats', 'Night sweats', 'General', ['fever'], ['lymph'], ['tb', 'lymphoma', 'hiv'], []),
  c('generalised_swelling', 'Body swelling (oedema)', 'General', ['chest_pain_cvs'], ['cvs', 'abdo'], ['heart_failure', 'nephrotic', 'hypoalbuminaemia'], ['body swelling', 'oedema', 'edema', 'puffy']),
  c('dehydration', 'Dehydration / poor intake', 'General', ['gastrointestinal'], ['general_extra'], [], ['not eating', 'poor feeding']),

  // ── Respiratory ───────────────────────────────────────────────────────────
  c('cough', 'Cough', 'Respiratory', ['respiratory'], ['resp'], ['pneumonia', 'tb', 'asthma', 'heart_failure'], ['coughing']),
  c('breathlessness', 'Difficulty in breathing', 'Respiratory', ['respiratory', 'chest_pain_cvs'], ['resp', 'cvs'], ['pneumonia', 'pe', 'heart_failure', 'asthma', 'anaemia', 'inhalation_injury'], ['SOB', 'shortness of breath', 'breathlessness', 'dyspnoea', 'dyspnea', 'DIB']),
  c('haemoptysis', 'Coughing blood', 'Respiratory', ['respiratory', 'bleeding'], ['resp'], ['tb', 'pe', 'lung_cancer'], ['hemoptysis', 'blood in sputum']),
  c('noisy_breathing', 'Noisy breathing / stridor', 'Respiratory', ['respiratory'], ['airway_inhalation', 'resp'], ['inhalation_injury', 'upper_airway_obstruction'], ['stridor', 'wheeze']),
  c('hoarseness', 'Hoarse voice', 'Respiratory', ['respiratory'], ['head_neck', 'airway_inhalation'], ['inhalation_injury', 'laryngeal_pathology'], []),

  // ── Cardiovascular ────────────────────────────────────────────────────────
  c('chest_pain', 'Chest pain', 'Cardiovascular', ['pain', 'chest_pain_cvs', 'respiratory'], ['cvs', 'resp'], ['acs', 'pe', 'pneumonia', 'musculoskeletal_chest'], ['chest discomfort', 'heart pain']),
  c('palpitations', 'Palpitations', 'Cardiovascular', ['chest_pain_cvs'], ['cvs'], ['arrhythmia', 'anaemia', 'thyrotoxicosis'], ['fast heartbeat', 'heart racing']),
  c('syncope', 'Fainting / collapse', 'Cardiovascular', ['chest_pain_cvs', 'neurological'], ['cvs', 'neuro'], ['arrhythmia', 'hypovolaemia', 'hypoglycaemia'], ['blackout', 'collapse', 'passed out']),
  c('leg_swelling', 'Leg swelling', 'Cardiovascular', ['limb_vascular', 'pain'], ['limb_vascular', 'cvs'], ['dvt', 'cellulitis', 'lymphoedema', 'heart_failure', 'venous_insufficiency'], ['swollen leg', 'swollen feet', 'pedal oedema']),
  c('cold_limb', 'Cold / painful pale limb', 'Cardiovascular', ['limb_vascular', 'pain'], ['limb_vascular', 'limb_neuro'], ['acute_limb_ischaemia', 'compartment_syndrome'], ['cold leg', 'pale limb', 'limb ischaemia']),
  c('claudication', 'Leg pain on walking', 'Cardiovascular', ['limb_vascular', 'pain'], ['limb_vascular'], ['pad', 'spinal_stenosis'], ['claudication']),
  c('varicose_veins', 'Varicose veins', 'Cardiovascular', ['limb_vascular'], ['limb_vascular'], ['venous_insufficiency', 'venous_ulcer'], ['varicose', 'swollen veins']),

  // ── Gastrointestinal ──────────────────────────────────────────────────────
  c('abdominal_pain', 'Abdominal pain', 'Gastrointestinal', ['pain', 'gastrointestinal'], ['abdo'], ['appendicitis', 'peptic_ulcer', 'intestinal_obstruction', 'peritonitis', 'biliary_colic', 'ectopic_pregnancy', 'uti'], ['tummy pain', 'stomach pain', 'belly pain']),
  c('vomiting', 'Vomiting', 'Gastrointestinal', ['gastrointestinal'], ['abdo'], ['intestinal_obstruction', 'gastroenteritis'], ['vomiting', 'throwing up']),
  c('diarrhoea', 'Diarrhoea', 'Gastrointestinal', ['gastrointestinal', 'fever'], ['abdo'], ['gastroenteritis', 'c_difficile'], ['diarrhea', 'loose stool', 'running stomach']),
  c('constipation', 'Constipation', 'Gastrointestinal', ['gastrointestinal'], ['abdo'], ['intestinal_obstruction'], []),
  c('gi_bleed', 'Blood in vomit or stool', 'Gastrointestinal', ['gastrointestinal', 'bleeding'], ['abdo'], ['peptic_ulcer', 'haemorrhoids', 'colorectal_cancer'], ['melaena', 'haematemesis', 'rectal bleeding']),
  c('dysphagia', 'Difficulty swallowing', 'Gastrointestinal', ['gastrointestinal'], ['head_neck', 'abdo'], ['oesophageal_cancer', 'stricture'], ['dysphagia']),
  c('abdominal_swelling', 'Abdominal swelling', 'Gastrointestinal', ['gastrointestinal'], ['abdo'], ['ascites', 'intestinal_obstruction', 'abdominal_mass'], ['distended abdomen', 'big belly']),
  c('perianal', 'Anal pain / swelling / discharge', 'Gastrointestinal', ['pain', 'swelling_lump'], ['genital'], ['perianal_abscess', 'haemorrhoids', 'fistula_in_ano', 'fournier'], ['piles', 'perianal abscess', 'anal fistula']),
  c('hernia', 'Hernia / bulge on straining', 'Gastrointestinal', ['swelling_lump'], ['local_lump', 'abdo'], ['inguinal_hernia', 'incisional_hernia', 'umbilical_hernia'], ['hernia', 'rupture']),

  // ── Genitourinary and gynaecological ──────────────────────────────────────
  c('dysuria', 'Painful urination', 'Genitourinary', ['genitourinary'], ['abdo', 'genital'], ['uti', 'sti'], ['burning urine', 'painful urine']),
  c('haematuria', 'Blood in urine', 'Genitourinary', ['genitourinary'], ['abdo'], ['uti', 'schistosomiasis', 'urological_cancer'], ['hematuria']),
  c('urinary_retention', 'Unable to pass urine', 'Genitourinary', ['genitourinary'], ['abdo', 'genital'], ['urinary_retention'], ['retention']),
  c('reduced_urine', 'Reduced urine output', 'Genitourinary', ['genitourinary'], ['general_extra', 'abdo'], ['aki', 'hypovolaemia'], ['oliguria', 'little urine']),
  c('scrotal_swelling', 'Scrotal swelling / pain', 'Genitourinary', ['swelling_lump', 'pain'], ['genital'], ['testicular_torsion', 'hydrocele', 'inguinal_hernia', 'epididymo_orchitis', 'fournier'], ['scrotal swelling', 'testis pain']),
  c('genital_ulcer', 'Genital sore / ulcer', 'Genitourinary', ['wound_ulcer'], ['genital', 'lymph'], ['sti', 'fournier'], ['genital ulcer']),
  c('vaginal_bleeding', 'Abnormal vaginal bleeding', 'Gynaecological', ['bleeding'], ['abdo', 'genital'], ['ectopic_pregnancy', 'miscarriage'], ['PV bleeding', 'heavy menses']),
  c('vaginal_discharge', 'Vaginal discharge', 'Gynaecological', ['genitourinary'], ['genital'], ['sti'], []),
  c('amenorrhoea', 'Missed period', 'Gynaecological', [], ['abdo'], ['pregnancy'], ['amenorrhea', 'no period']),

  // ── Neurological ──────────────────────────────────────────────────────────
  c('headache', 'Headache', 'Neurological', ['pain', 'neurological'], ['neuro', 'head_neck'], ['tension_headache', 'migraine', 'meningitis', 'sah', 'hypertensive_emergency'], ['head pain']),
  c('seizure', 'Convulsion / fit', 'Neurological', ['neurological'], ['neuro'], ['epilepsy', 'meningitis', 'hypoglycaemia'], ['fits', 'seizures', 'convulsions']),
  c('limb_weakness', 'Weakness of limb(s)', 'Neurological', ['neurological'], ['neuro', 'limb_neuro'], ['stroke', 'nerve_injury', 'spinal_cord'], ['paralysis', 'cannot move arm', 'cannot move leg']),
  c('numbness', 'Numbness / tingling', 'Neurological', ['neurological'], ['neuro', 'limb_neuro'], ['peripheral_neuropathy', 'nerve_injury', 'carpal_tunnel'], ['paraesthesia', 'pins and needles']),
  c('confusion', 'Confusion / reduced consciousness', 'Neurological', ['neurological', 'fever'], ['neuro', 'general_extra'], ['sepsis', 'hypoglycaemia', 'stroke', 'meningitis', 'head_injury'], ['altered sensorium', 'unconscious', 'delirium']),
  c('dizziness', 'Dizziness', 'Neurological', ['neurological', 'chest_pain_cvs'], ['neuro', 'cvs'], ['hypovolaemia', 'anaemia', 'arrhythmia'], ['vertigo', 'lightheaded']),

  // ── Musculoskeletal ───────────────────────────────────────────────────────
  c('joint_pain', 'Joint pain / swelling', 'Musculoskeletal', ['pain', 'musculoskeletal'], ['msk'], ['septic_arthritis', 'osteoarthritis', 'gout', 'rheumatoid_arthritis'], ['arthritis', 'swollen joint']),
  c('back_pain', 'Back pain', 'Musculoskeletal', ['pain', 'musculoskeletal', 'neurological'], ['spine', 'neuro'], ['mechanical_back_pain', 'spinal_cord', 'spinal_tb'], ['low back pain', 'waist pain']),
  c('limb_pain', 'Limb pain', 'Musculoskeletal', ['pain', 'limb_vascular'], ['msk', 'limb_vascular', 'limb_neuro'], ['dvt', 'osteomyelitis', 'compartment_syndrome', 'sickle_crisis', 'pad'], ['leg pain', 'arm pain']),
  c('bone_pain', 'Bone pain / bone infection', 'Musculoskeletal', ['pain', 'fever'], ['msk', 'local_wound'], ['osteomyelitis', 'sickle_crisis', 'bone_tumour'], ['osteomyelitis', 'bone infection']),
  c('limb_deformity', 'Limb deformity', 'Musculoskeletal', ['deformity'], ['msk'], ['malunion', 'burn_contracture'], ['crooked limb', 'deformed leg']),

  // ── Skin (general dermatology) ────────────────────────────────────────────
  c('rash', 'Rash', 'Skin', ['skin_rash'], ['local_skin_lesion', 'oral', 'eye'], ['drug_eruption', 'sjs_ten', 'cellulitis', 'urticaria'], ['skin rash', 'eruption']),
  c('blisters', 'Blisters / skin peeling', 'Skin', ['skin_rash'], ['local_skin_lesion', 'oral', 'eye'], ['sjs_ten', 'burn_partial', 'bullous_disease'], ['bullae', 'peeling skin', 'SJS', 'TEN']),
  c('itching', 'Itching', 'Skin', ['skin_rash'], ['local_skin_lesion'], ['urticaria', 'scabies', 'eczema'], ['pruritus', 'itchy skin']),
  c('hyperhidrosis', 'Excessive sweating', 'Skin', [], ['local_skin_lesion'], [], ['sweating']),
  c('hair_loss', 'Hair loss / scalp problem', 'Skin', ['skin_lesion'], ['local_skin_lesion'], [], ['alopecia']),

  // ── Eye, ENT, dental ──────────────────────────────────────────────────────
  c('eye_problem', 'Red / painful eye or reduced vision', 'Eye & ENT', ['pain'], ['eye'], [], ['red eye', 'eye pain', 'blurred vision']),
  c('ear_problem', 'Ear pain / discharge / hearing loss', 'Eye & ENT', ['pain'], ['head_neck'], [], ['otitis', 'ear discharge', 'deafness']),
  c('nasal_problem', 'Nasal blockage / bleeding / deformity', 'Eye & ENT', ['bleeding'], ['head_neck'], [], ['epistaxis', 'blocked nose', 'nose bleed']),
  c('sore_throat', 'Sore throat', 'Eye & ENT', ['pain', 'fever'], ['head_neck', 'oral'], [], ['throat pain']),
  c('toothache', 'Toothache / dental swelling', 'Eye & ENT', ['pain'], ['oral', 'head_neck'], ['dental_abscess'], ['tooth pain', 'dental abscess']),

  // ── Endocrine / metabolic ─────────────────────────────────────────────────
  c('high_sugar', 'High blood sugar / diabetic symptoms', 'Endocrine', [], ['general_extra'], ['diabetes_uncontrolled', 'dka'], ['hyperglycaemia', 'polyuria', 'excessive thirst']),
  c('low_sugar', 'Low blood sugar episode', 'Endocrine', ['neurological'], ['general_extra', 'neuro'], ['hypoglycaemia'], ['hypoglycaemia', 'hypo']),
  c('thyroid', 'Thyroid swelling / symptoms', 'Endocrine', LUMP, ['head_neck', 'local_lump'], ['thyroid_nodule', 'thyrotoxicosis'], ['goitre', 'goiter']),

  // ── Mental health / other ─────────────────────────────────────────────────
  c('low_mood', 'Low mood / anxiety', 'Psychological', [], ['general_extra'], [], ['depression', 'anxiety']),
  c('self_harm', 'Self-harm / suicidal thoughts', 'Psychological', ['injury'], ['local_wound', 'general_extra'], [], ['self harm', 'suicide attempt']),
  c('postop_review', 'Problem after an operation', 'Postoperative', ['pain', 'fever', 'wound_ulcer'], ['local_wound', 'general_extra'], ['surgical_site_infection', 'wound_dehiscence', 'haematoma', 'flap_compromise', 'graft_failure', 'dvt'], ['post-op problem', 'after surgery']),
  c('flap_problem', 'Flap colour change / flap concern', 'Postoperative', ['limb_vascular'], ['local_wound'], ['flap_compromise', 'haematoma'], ['flap congestion', 'flap pale', 'flap failing']),
  c('graft_problem', 'Skin graft not taking', 'Postoperative', ['wound_ulcer'], ['local_wound'], ['graft_failure', 'infected_wound', 'haematoma'], ['graft loss', 'graft failure']),
];

/** Normalise text for search: lower case, strip punctuation and accents. */
export function normaliseTerm(s: string): string {
  return s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9 ]+/g, ' ').replace(/\s+/g, ' ').trim();
}

/** Edit distance ≤ 1 (typo tolerance) for words of 5+ letters. */
function nearlyEqual(a: string, b: string): boolean {
  if (Math.abs(a.length - b.length) > 1 || a.length < 5) return false;
  let i = 0, j = 0, edits = 0;
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) { i++; j++; continue; }
    if (++edits > 1) return false;
    if (a.length > b.length) i++; else if (b.length > a.length) j++; else { i++; j++; }
  }
  return edits + (a.length - i) + (b.length - j) <= 1;
}

/**
 * Search complaints by label, synonym or abbreviation, typo-tolerant.
 * Returns best matches first; the matched synonym is reported so the user sees
 * why "SOB" found "Difficulty in breathing".
 */
export function searchComplaints(query: string, limit = 12): Array<{ complaint: Complaint; matched?: string }> {
  const q = normaliseTerm(query);
  if (!q) return COMPLAINTS.slice(0, limit).map(complaint => ({ complaint }));
  const qWords = q.split(' ');
  const scored: Array<{ complaint: Complaint; matched?: string; score: number }> = [];
  for (const complaint of COMPLAINTS) {
    let best = 0;
    let matched: string | undefined;
    for (const term of [complaint.label, ...(complaint.synonyms || [])]) {
      const t = normaliseTerm(term);
      let score = 0;
      if (t === q) score = 100;
      else if (t.startsWith(q)) score = 80;
      else if (t.split(' ').some(w => w.startsWith(q))) score = 60;
      else if (t.includes(q)) score = 50;
      else if (qWords.every(qw => t.split(' ').some(w => w.startsWith(qw) || nearlyEqual(w, qw)))) score = 40;
      if (score > best) { best = score; matched = term === complaint.label ? undefined : term; }
    }
    if (best > 0) scored.push({ complaint, matched, score: best });
  }
  return scored.sort((a, b) => b.score - a.score).slice(0, limit);
}

export const COMPLAINT_BY_ID: Record<string, Complaint> = Object.fromEntries(COMPLAINTS.map(c => [c.id, c]));

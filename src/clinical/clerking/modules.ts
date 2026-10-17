/**
 * Question modules for the history of each presenting complaint.
 *
 * Every complaint gets GENERAL (onset, course, severity, timing, triggers,
 * previous episodes and treatment). Complaint-specific modules add the
 * questions that discriminate between its causes. Answers are dropdowns built
 * from standard history-taking teaching (SOCRATES for pain, the classic lump /
 * ulcer descriptions, burn and injury mechanisms), each with "Other" and
 * "Unknown" so nothing is forced.
 */
import type { QuestionModule } from './types';

const YNU = ['Yes', 'No', 'Unknown'];
const SITES_BODY = [
  'Head / scalp', 'Face', 'Eye / periorbital', 'Ear', 'Nose', 'Lip / mouth', 'Neck', 'Chest wall', 'Breast',
  'Axilla', 'Upper back', 'Lower back / sacrum', 'Abdomen (anterior)', 'Flank', 'Groin / inguinal', 'Perineum / genitalia',
  'Buttock', 'Shoulder', 'Upper arm', 'Elbow', 'Forearm', 'Wrist', 'Hand (palm)', 'Hand (dorsum)', 'Finger(s) / thumb',
  'Hip', 'Thigh', 'Knee', 'Leg (shin / calf)', 'Ankle', 'Foot (dorsum)', 'Foot (sole / heel)', 'Toe(s)', 'Generalised', 'Multiple sites', 'Other',
];
const SIDE = ['Left', 'Right', 'Bilateral', 'Midline', 'Not applicable'];

export const MODULES: Record<string, QuestionModule> = {
  general: {
    id: 'general',
    title: 'Symptom analysis',
    questions: [
      { id: 'onset', label: 'Onset', type: 'select', options: ['Sudden (seconds–minutes)', 'Acute (hours)', 'Subacute (days)', 'Gradual / insidious (weeks–months)', 'Since birth', 'Unknown'] },
      { id: 'course', label: 'Course since onset', type: 'select', options: ['Progressively worsening', 'Rapidly worsening', 'Static / unchanged', 'Improving', 'Intermittent / episodic', 'Recurrent after treatment', 'Fluctuating', 'Unknown'] },
      { id: 'severity', label: 'Severity', type: 'select', options: ['Mild — no effect on activity', 'Moderate — limits some activities', 'Severe — limits most activities', 'Very severe — incapacitating', 'Unknown'] },
      { id: 'timing', label: 'Timing / pattern', type: 'select', options: ['Constant', 'Intermittent', 'Worse in the morning', 'Worse at night', 'Worse after meals', 'Related to activity', 'Related to menses', 'No pattern', 'Unknown'] },
      { id: 'precipitant', label: 'Precipitating event', type: 'select', options: ['None identified', 'Trauma / injury', 'Burn', 'Insect / animal bite', 'Surgery / procedure', 'Injection', 'Infection', 'Medication', 'Traditional / herbal treatment', 'Pressure / immobility', 'Pregnancy / childbirth', 'Unknown', 'Other'] },
      { id: 'aggravating', label: 'Aggravating factors', type: 'multiselect', options: ['Movement', 'Weight bearing', 'Pressure / touch', 'Dependency (hanging down)', 'Elevation', 'Cold', 'Heat', 'Eating', 'Coughing / straining', 'Lying flat', 'Exertion', 'Stress', 'None', 'Other'] },
      { id: 'relieving', label: 'Relieving factors', type: 'multiselect', options: ['Rest', 'Elevation', 'Dependency', 'Analgesics', 'Antibiotics', 'Dressing', 'Warmth', 'Cold', 'Sitting forward', 'Nothing relieves it', 'None', 'Other'] },
      { id: 'previous_episodes', label: 'Previous similar episodes', type: 'select', options: ['First episode', 'Once before', 'Several times before', 'Recurrent / chronic', 'Unknown'] },
      { id: 'treatment_so_far', label: 'Treatment received so far', type: 'multiselect', options: ['None', 'Self-medication', 'Over-the-counter analgesics', 'Antibiotics (oral)', 'Antibiotics (injection)', 'Herbal / traditional medicine', 'Traditional bone setter', 'Wound dressing at a clinic', 'Topical / native application', 'Surgery elsewhere', 'Admitted elsewhere', 'Unknown', 'Other'] },
      { id: 'response_to_treatment', label: 'Response to that treatment', type: 'select', options: ['Resolved', 'Improved', 'No change', 'Worsened', 'Not applicable', 'Unknown'], showIf: { q: 'treatment_so_far', in: ['Self-medication', 'Over-the-counter analgesics', 'Antibiotics (oral)', 'Antibiotics (injection)', 'Herbal / traditional medicine', 'Traditional bone setter', 'Wound dressing at a clinic', 'Topical / native application', 'Surgery elsewhere', 'Admitted elsewhere', 'Other'] } },
      { id: 'function', label: 'Effect on daily function', type: 'select', options: ['None', 'Mild limitation', 'Unable to work / school', 'Needs help with self-care', 'Bed-bound', 'Unknown'] },
      { id: 'concerns', label: "Patient's main concern / expectation", type: 'select', options: ['Pain relief', 'Healing', 'Appearance', 'Function', 'Fear of cancer', 'Fear of amputation', 'Cost of treatment', 'Return to work', 'Other', 'Not discussed'] },
    ],
  },

  pain: {
    id: 'pain',
    title: 'Pain (SOCRATES)',
    questions: [
      { id: 'pain_site', label: 'Site', type: 'select', options: SITES_BODY },
      { id: 'pain_character', label: 'Character', type: 'select', options: ['Sharp / stabbing', 'Dull / aching', 'Burning', 'Throbbing / pulsating', 'Colicky (comes in waves)', 'Tight / pressing / crushing', 'Shooting / electric (neuropathic)', 'Tearing', 'Gnawing', 'Unknown'] },
      { id: 'pain_radiation', label: 'Radiation', type: 'select', options: ['None', 'To the back', 'To the shoulder', 'To the arm', 'To the jaw / neck', 'To the groin', 'Down the leg', 'Along a nerve distribution', 'Unknown'] },
      { id: 'pain_score', label: 'Pain score (0–10)', type: 'select', options: ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9', '10'] },
      { id: 'pain_out_of_proportion', label: 'Pain out of proportion to visible findings', type: 'select', options: YNU, redFlags: ['Yes'] },
      { id: 'pain_night', label: 'Night pain / rest pain', type: 'select', options: YNU },
      { id: 'pain_claudication', label: 'Pain on walking relieved by rest (claudication)', type: 'select', options: YNU },
    ],
  },

  wound_ulcer: {
    id: 'wound_ulcer',
    title: 'Wound / ulcer',
    questions: [
      { id: 'wound_site', label: 'Site', type: 'select', options: SITES_BODY },
      { id: 'wound_side', label: 'Side', type: 'select', options: SIDE },
      { id: 'wound_start', label: 'How it started', type: 'select', options: ['After trauma / injury', 'After a burn', 'Spontaneously as a blister', 'Spontaneously as a lump that broke down', 'As a pimple / boil', 'After an insect / snake bite', 'After an injection', 'Over a pressure area (bed sore)', 'After surgery (wound breakdown)', 'On a scar / old burn scar', 'Unknown', 'Other'] },
      { id: 'wound_size_change', label: 'Change in size', type: 'select', options: ['Increasing', 'Rapidly increasing', 'Static', 'Decreasing / healing', 'Healed and broke down again', 'Unknown'] },
      { id: 'wound_discharge', label: 'Discharge', type: 'select', options: ['None', 'Serous (clear)', 'Seropurulent', 'Purulent (pus)', 'Bloody', 'Foul-smelling', 'Greenish (Pseudomonas-like)', 'Unknown'] },
      { id: 'wound_odour', label: 'Offensive odour', type: 'select', options: YNU },
      { id: 'wound_bleeding', label: 'Contact bleeding', type: 'select', options: ['None', 'On dressing change', 'Spontaneous', 'Profuse', 'Unknown'], redFlags: ['Spontaneous', 'Profuse'] },
      { id: 'wound_pain', label: 'Pain at the wound', type: 'select', options: ['Painless', 'Mild', 'Moderate', 'Severe', 'Pain out of proportion', 'Unknown'], redFlags: ['Pain out of proportion'] },
      { id: 'wound_numbness', label: 'Numbness around the area', type: 'select', options: YNU },
      { id: 'wound_on_scar', label: 'Arising in a long-standing scar or chronic wound (>10 years)', type: 'select', options: YNU, redFlags: ['Yes'] },
      { id: 'wound_heaped_edge', label: 'Edge described as raised / rolled / everted', type: 'select', options: YNU, redFlags: ['Yes'] },
      { id: 'wound_previous_biopsy', label: 'Previous biopsy', type: 'select', options: ['No', 'Yes — benign', 'Yes — malignant', 'Yes — result unknown', 'Unknown'] },
      { id: 'wound_dressing', label: 'Current dressing / care', type: 'select', options: ['None', 'Daily dressing at home', 'Dressing at a clinic', 'Herbal / native application', 'Honey', 'Saline and gauze', 'Antiseptic (povidone, chlorhexidine)', 'Negative-pressure dressing', 'Unknown', 'Other'] },
      { id: 'wound_contact_sickle', label: 'Sickle cell disease', type: 'select', options: YNU },
    ],
  },

  swelling_lump: {
    id: 'swelling_lump',
    title: 'Swelling / lump',
    questions: [
      { id: 'lump_site', label: 'Site', type: 'select', options: SITES_BODY },
      { id: 'lump_side', label: 'Side', type: 'select', options: SIDE },
      { id: 'lump_noticed', label: 'How it was noticed', type: 'select', options: ['By the patient (seen / felt)', 'By a relative', 'Incidentally by a health worker', 'After an injury', 'Present since birth', 'Unknown'] },
      { id: 'lump_growth', label: 'Rate of growth', type: 'select', options: ['Slow (months–years)', 'Rapid (weeks)', 'Very rapid (days)', 'Static', 'Fluctuates in size', 'Reducing', 'Unknown'], redFlags: ['Rapid (weeks)', 'Very rapid (days)'] },
      { id: 'lump_painful', label: 'Painful', type: 'select', options: ['Painless', 'Painful', 'Tender only when touched', 'Became painful recently', 'Unknown'] },
      { id: 'lump_other_lumps', label: 'Other lumps elsewhere', type: 'select', options: YNU },
      { id: 'lump_discharge', label: 'Discharge from the lump', type: 'select', options: ['None', 'Pus', 'Blood', 'Cheesy material', 'Clear fluid', 'Unknown'] },
      { id: 'lump_reducible', label: 'Disappears on lying down / pressure (reducible)', type: 'select', options: YNU },
      { id: 'lump_cough_impulse', label: 'Gets bigger on coughing / straining', type: 'select', options: YNU },
      { id: 'lump_skin_change', label: 'Skin change over it', type: 'select', options: ['None', 'Redness', 'Darkening', 'Ulceration', 'Tethering / dimpling', 'Peau d’orange', 'Dilated veins', 'Unknown'], redFlags: ['Ulceration', 'Tethering / dimpling', 'Peau d’orange'] },
      { id: 'lump_constitutional', label: 'Weight loss, night sweats or fever', type: 'select', options: YNU, redFlags: ['Yes'] },
    ],
  },

  burn: {
    id: 'burn',
    title: 'Burn injury',
    questions: [
      { id: 'burn_mechanism', label: 'Mechanism', type: 'select', options: ['Flame', 'Scald (hot liquid)', 'Contact (hot object)', 'Electrical — low voltage', 'Electrical — high voltage', 'Lightning', 'Chemical — acid', 'Chemical — alkali', 'Petrol / kerosene explosion', 'Gas explosion', 'Friction', 'Radiation', 'Cold injury (frostbite)', 'Unknown', 'Other'] },
      { id: 'burn_time', label: 'Time since injury', type: 'select', options: ['< 1 hour', '1–8 hours', '8–24 hours', '1–3 days', '4–7 days', '> 1 week', 'Unknown'] },
      { id: 'burn_enclosed', label: 'Injured in an enclosed space / smoke exposure', type: 'select', options: YNU, redFlags: ['Yes'] },
      { id: 'burn_inhalation', label: 'Hoarse voice, stridor, sooty sputum, singed nasal hair', type: 'select', options: YNU, redFlags: ['Yes'] },
      { id: 'burn_loc', label: 'Loss of consciousness', type: 'select', options: YNU, redFlags: ['Yes'] },
      { id: 'burn_first_aid', label: 'First aid given', type: 'multiselect', options: ['Cool running water 20 min', 'Cold water < 20 min', 'Ice', 'Raw egg / palm oil / native application', 'Toothpaste', 'Covered with cling film / clean cloth', 'None', 'Unknown'] },
      { id: 'burn_fluids_given', label: 'IV fluids already given', type: 'select', options: ['None', 'Yes — volume known', 'Yes — volume unknown', 'Unknown'] },
      { id: 'burn_associated_trauma', label: 'Associated injuries (fall, blast, fracture)', type: 'select', options: YNU, redFlags: ['Yes'] },
      { id: 'burn_nai_concern', label: 'Story inconsistent with injury / concern for non-accidental injury', type: 'select', options: ['No', 'Yes', 'Not applicable (adult)'], redFlags: ['Yes'] },
      { id: 'burn_tetanus', label: 'Tetanus immunisation up to date', type: 'select', options: YNU },
    ],
  },

  injury: {
    id: 'injury',
    title: 'Injury / trauma',
    questions: [
      { id: 'injury_mechanism', label: 'Mechanism', type: 'select', options: ['Road traffic — motorcycle', 'Road traffic — car occupant', 'Road traffic — pedestrian', 'Fall from height', 'Fall on outstretched hand', 'Assault — blunt', 'Assault — machete / sharp', 'Gunshot', 'Glass cut', 'Knife / kitchen injury', 'Machine / industrial', 'Crush', 'Human bite', 'Dog bite', 'Snake bite', 'Sports', 'Blast', 'Unknown', 'Other'] },
      { id: 'injury_time', label: 'Time since injury', type: 'select', options: ['< 6 hours', '6–24 hours', '1–3 days', '4–7 days', '1–4 weeks', '> 1 month', 'Unknown'] },
      { id: 'injury_contamination', label: 'Wound contamination', type: 'select', options: ['Clean', 'Soil / farm', 'Road / gravel', 'Water / sewage', 'Bite (saliva)', 'Foreign body suspected', 'Unknown'] },
      { id: 'injury_bleeding', label: 'Bleeding', type: 'select', options: ['None', 'Stopped', 'Ongoing — controlled', 'Pulsatile / uncontrolled', 'Unknown'], redFlags: ['Pulsatile / uncontrolled'] },
      { id: 'injury_numbness', label: 'Numbness / tingling beyond the injury', type: 'select', options: YNU },
      { id: 'injury_weakness', label: 'Cannot move fingers / toes / joint normally', type: 'select', options: YNU },
      { id: 'injury_deformity', label: 'Deformity or abnormal movement of a bone', type: 'select', options: YNU },
      { id: 'injury_head', label: 'Head injury, loss of consciousness, vomiting', type: 'select', options: YNU, redFlags: ['Yes'] },
      { id: 'injury_dominant', label: 'Dominant hand', type: 'select', options: ['Right', 'Left', 'Ambidextrous', 'Not applicable'] },
      { id: 'injury_occupation_hand', label: 'Hand use for work (artisan, musician, surgeon, typist…)', type: 'select', options: YNU },
      { id: 'injury_tetanus', label: 'Tetanus immunisation up to date', type: 'select', options: YNU },
    ],
  },

  skin_lesion: {
    id: 'skin_lesion',
    title: 'Skin lesion / mole',
    questions: [
      { id: 'lesion_site', label: 'Site', type: 'select', options: SITES_BODY },
      { id: 'lesion_change', label: 'Change noticed', type: 'multiselect', options: ['Increasing size', 'Change in colour', 'Irregular border', 'Itching', 'Bleeding', 'Ulceration', 'Crusting', 'New satellite lesions', 'No change', 'Unknown'], redFlags: ['Bleeding', 'Ulceration', 'Change in colour', 'New satellite lesions'] },
      { id: 'lesion_colour', label: 'Colour', type: 'select', options: ['Skin coloured', 'Pink / red', 'Brown', 'Black', 'Multiple colours', 'Pearly', 'Yellow', 'Blue', 'Unknown'] },
      { id: 'lesion_sun', label: 'Sun exposure / outdoor work', type: 'select', options: ['Minimal', 'Moderate', 'High', 'Unknown'] },
      { id: 'lesion_albinism', label: 'Albinism', type: 'select', options: YNU, redFlags: ['Yes'] },
      { id: 'lesion_family', label: 'Family history of skin cancer', type: 'select', options: YNU },
      { id: 'lesion_acral', label: 'On the sole, palm or under a nail', type: 'select', options: YNU, redFlags: ['Yes'] },
    ],
  },

  scar_keloid: {
    id: 'scar_keloid',
    title: 'Scar / keloid',
    questions: [
      { id: 'scar_cause', label: 'Original injury', type: 'select', options: ['Ear piercing', 'Surgery', 'Burn', 'Laceration', 'Acne', 'Vaccination', 'Tribal marks / scarification', 'Spontaneous', 'Unknown', 'Other'] },
      { id: 'scar_beyond_border', label: 'Growing beyond the original wound', type: 'select', options: YNU },
      { id: 'scar_symptoms', label: 'Symptoms', type: 'multiselect', options: ['Itching', 'Pain', 'Tenderness', 'Restricted movement', 'Cosmetic concern', 'Recurrent infection', 'None'] },
      { id: 'scar_previous_treatment', label: 'Previous treatment', type: 'multiselect', options: ['None', 'Steroid injection', 'Excision', 'Excision + radiotherapy', 'Pressure therapy', 'Silicone gel / sheet', 'Cryotherapy', 'Unknown', 'Other'] },
      { id: 'scar_recurrence', label: 'Recurred after previous excision', type: 'select', options: ['Not applicable', 'No', 'Yes', 'Unknown'] },
      { id: 'scar_family', label: 'Family history of keloids', type: 'select', options: YNU },
      { id: 'scar_contracture', label: 'Limits joint movement (contracture)', type: 'select', options: YNU },
    ],
  },

  deformity: {
    id: 'deformity',
    title: 'Deformity / contracture / congenital anomaly',
    questions: [
      { id: 'def_onset', label: 'Present since', type: 'select', options: ['Birth', 'Childhood', 'After injury', 'After a burn', 'After surgery', 'After infection', 'Gradually in adulthood', 'Unknown'] },
      { id: 'def_progression', label: 'Progression', type: 'select', options: ['Worsening', 'Static', 'Improving', 'Unknown'] },
      { id: 'def_function', label: 'Functional problem', type: 'multiselect', options: ['Feeding', 'Speech', 'Breathing', 'Hand use / grip', 'Walking', 'Closing eyes', 'Opening mouth', 'Self-care', 'Appearance only', 'None'] },
      { id: 'def_family', label: 'Similar condition in the family', type: 'select', options: YNU },
      { id: 'def_pregnancy', label: 'Pregnancy / birth problems (for congenital)', type: 'select', options: ['None known', 'Maternal illness', 'Drugs / herbs in pregnancy', 'Prematurity', 'Birth trauma', 'Not applicable', 'Unknown'] },
    ],
  },

  fever: {
    id: 'fever',
    title: 'Fever',
    questions: [
      { id: 'fever_pattern', label: 'Pattern', type: 'select', options: ['Continuous', 'Intermittent', 'Evening rises', 'With chills / rigors', 'Unknown'], redFlags: ['With chills / rigors'] },
      { id: 'fever_measured', label: 'Highest measured temperature', type: 'select', options: ['Not measured', '37.5–38.0 °C', '38.1–39.0 °C', '39.1–40.0 °C', '> 40 °C'] },
      { id: 'fever_source', label: 'Possible source', type: 'multiselect', options: ['Wound', 'Chest (cough)', 'Urine (dysuria)', 'Abdomen', 'Throat / ear', 'IV line site', 'Malaria exposure', 'None obvious'] },
      { id: 'fever_confusion', label: 'Confusion, drowsiness or reduced urine', type: 'select', options: YNU, redFlags: ['Yes'] },
    ],
  },

  bleeding: {
    id: 'bleeding',
    title: 'Bleeding',
    questions: [
      { id: 'bleed_site', label: 'From where', type: 'select', options: ['Wound', 'Nose', 'Mouth / gums', 'Vomit', 'Rectum / stool', 'Urine', 'Vagina', 'Cough', 'Skin (bruises)', 'Other'] },
      { id: 'bleed_amount', label: 'Amount', type: 'select', options: ['Streaks / spots', 'Cupful', 'Large volume', 'Continuous', 'Unknown'], redFlags: ['Large volume', 'Continuous'] },
      { id: 'bleed_dizziness', label: 'Dizziness, fainting or palpitations', type: 'select', options: YNU, redFlags: ['Yes'] },
      { id: 'bleed_anticoag', label: 'On anticoagulant / antiplatelet', type: 'select', options: YNU },
      { id: 'bleed_disorder', label: 'Known bleeding disorder / easy bruising', type: 'select', options: YNU },
    ],
  },

  respiratory: {
    id: 'respiratory',
    title: 'Respiratory',
    questions: [
      { id: 'resp_sputum', label: 'Sputum', type: 'select', options: ['None', 'Clear / white', 'Yellow / green', 'Blood-stained', 'Frothy pink', 'Black / sooty', 'Unknown'], redFlags: ['Blood-stained', 'Frothy pink', 'Black / sooty'] },
      { id: 'resp_dyspnoea_grade', label: 'Breathlessness (MRC grade)', type: 'select', options: ['None', '1 — only on strenuous exercise', '2 — hurrying / slight hill', '3 — slower than peers', '4 — stops after 100 m', '5 — too breathless to leave house', 'At rest'], redFlags: ['At rest'] },
      { id: 'resp_orthopnoea', label: 'Breathless lying flat / wakes breathless at night', type: 'select', options: YNU },
      { id: 'resp_wheeze', label: 'Wheeze', type: 'select', options: YNU },
      { id: 'resp_chest_pain', label: 'Pleuritic chest pain', type: 'select', options: YNU },
      { id: 'resp_tb_contact', label: 'TB contact, night sweats or weight loss', type: 'select', options: YNU },
      { id: 'resp_calf', label: 'Recent immobility / surgery / calf swelling (VTE risk)', type: 'select', options: YNU, redFlags: ['Yes'] },
    ],
  },

  chest_pain_cvs: {
    id: 'chest_pain_cvs',
    title: 'Cardiovascular',
    questions: [
      { id: 'cvs_exertional', label: 'Brought on by exertion, relieved by rest', type: 'select', options: YNU },
      { id: 'cvs_sweating', label: 'Sweating, nausea or collapse with the pain', type: 'select', options: YNU, redFlags: ['Yes'] },
      { id: 'cvs_palpitations', label: 'Palpitations', type: 'select', options: YNU },
      { id: 'cvs_syncope', label: 'Fainting', type: 'select', options: YNU, redFlags: ['Yes'] },
      { id: 'cvs_leg_swelling', label: 'Leg swelling', type: 'select', options: ['None', 'One leg', 'Both legs', 'Unknown'] },
    ],
  },

  gastrointestinal: {
    id: 'gastrointestinal',
    title: 'Gastrointestinal',
    questions: [
      { id: 'gi_vomiting', label: 'Vomiting', type: 'select', options: ['None', 'Food', 'Bile (green)', 'Blood / coffee grounds', 'Faeculent', 'Unknown'], redFlags: ['Blood / coffee grounds', 'Faeculent', 'Bile (green)'] },
      { id: 'gi_bowels', label: 'Bowel habit', type: 'select', options: ['Normal', 'Constipation', 'Diarrhoea', 'Alternating', 'Absolute constipation (no flatus)', 'Black tarry stool', 'Blood in stool', 'Unknown'], redFlags: ['Absolute constipation (no flatus)', 'Black tarry stool'] },
      { id: 'gi_appetite', label: 'Appetite', type: 'select', options: ['Normal', 'Reduced', 'Lost', 'Increased', 'Unknown'] },
      { id: 'gi_weight', label: 'Weight change', type: 'select', options: ['None', 'Loss < 5 %', 'Loss > 5 % in 6 months', 'Gain', 'Unknown'], redFlags: ['Loss > 5 % in 6 months'] },
      { id: 'gi_jaundice', label: 'Yellow eyes / dark urine / pale stool', type: 'select', options: YNU },
      { id: 'gi_distension', label: 'Abdominal distension', type: 'select', options: YNU },
    ],
  },

  genitourinary: {
    id: 'genitourinary',
    title: 'Genitourinary',
    questions: [
      { id: 'gu_dysuria', label: 'Pain / burning on passing urine', type: 'select', options: YNU },
      { id: 'gu_frequency', label: 'Frequency / urgency / nocturia', type: 'select', options: YNU },
      { id: 'gu_haematuria', label: 'Blood in urine', type: 'select', options: YNU, redFlags: ['Yes'] },
      { id: 'gu_output', label: 'Urine output', type: 'select', options: ['Normal', 'Reduced', 'Very little / none', 'Increased', 'Unknown'], redFlags: ['Very little / none'] },
      { id: 'gu_retention', label: 'Difficulty / unable to pass urine', type: 'select', options: YNU },
    ],
  },

  neurological: {
    id: 'neurological',
    title: 'Neurological',
    questions: [
      { id: 'neuro_weakness_dist', label: 'Weakness distribution', type: 'select', options: ['None', 'One limb', 'One side of the body', 'Both legs', 'All four limbs', 'Face', 'In a nerve distribution', 'Unknown'], redFlags: ['One side of the body', 'Both legs', 'All four limbs', 'Face'] },
      { id: 'neuro_sensory', label: 'Numbness / pins and needles', type: 'select', options: ['None', 'Glove-and-stocking', 'In a nerve distribution (e.g. median)', 'Dermatomal', 'One side', 'Unknown'] },
      { id: 'neuro_headache_red', label: 'Worst-ever / thunderclap headache, neck stiffness, fits', type: 'select', options: YNU, redFlags: ['Yes'] },
      { id: 'neuro_consciousness', label: 'Altered consciousness / confusion', type: 'select', options: YNU, redFlags: ['Yes'] },
      { id: 'neuro_sphincter', label: 'Bladder / bowel control lost', type: 'select', options: YNU, redFlags: ['Yes'] },
    ],
  },

  musculoskeletal: {
    id: 'musculoskeletal',
    title: 'Musculoskeletal',
    questions: [
      { id: 'msk_joint', label: 'Joint(s) involved', type: 'select', options: ['Single joint', 'Several joints', 'Many small joints', 'Spine', 'No joint — soft tissue', 'Unknown'] },
      { id: 'msk_stiffness', label: 'Morning stiffness', type: 'select', options: ['None', '< 30 minutes', '> 30 minutes', 'Unknown'] },
      { id: 'msk_hot_joint', label: 'Hot, red, swollen joint', type: 'select', options: YNU, redFlags: ['Yes'] },
      { id: 'msk_cannot_bear_weight', label: 'Cannot bear weight / use the limb', type: 'select', options: YNU },
    ],
  },

  breast: {
    id: 'breast',
    title: 'Breast',
    questions: [
      { id: 'breast_side', label: 'Side', type: 'select', options: ['Left', 'Right', 'Both'] },
      { id: 'breast_nipple', label: 'Nipple change / discharge', type: 'select', options: ['None', 'Retraction (new)', 'Bloody discharge', 'Milky discharge', 'Green / clear discharge', 'Eczema / crusting', 'Unknown'], redFlags: ['Retraction (new)', 'Bloody discharge', 'Eczema / crusting'] },
      { id: 'breast_cycle', label: 'Varies with the menstrual cycle', type: 'select', options: ['Yes', 'No', 'Not applicable', 'Unknown'] },
      { id: 'breast_lactating', label: 'Breastfeeding / recently delivered', type: 'select', options: ['Yes', 'No', 'Not applicable'] },
      { id: 'breast_family', label: 'Family history of breast / ovarian cancer', type: 'select', options: YNU },
      { id: 'breast_axilla', label: 'Lump in the armpit', type: 'select', options: YNU, redFlags: ['Yes'] },
    ],
  },

  limb_vascular: {
    id: 'limb_vascular',
    title: 'Limb circulation / swelling',
    questions: [
      { id: 'vasc_colour', label: 'Colour of the limb / digit', type: 'select', options: ['Normal', 'Pale / white', 'Blue / dusky', 'Mottled', 'Black / dead tissue', 'Red', 'Unknown'], redFlags: ['Pale / white', 'Mottled', 'Black / dead tissue'] },
      { id: 'vasc_cold', label: 'Limb feels cold', type: 'select', options: YNU, redFlags: ['Yes'] },
      { id: 'vasc_swelling', label: 'Swelling', type: 'select', options: ['None', 'Pitting', 'Non-pitting', 'Firm / woody', 'Unknown'] },
      { id: 'vasc_varicose', label: 'Varicose veins', type: 'select', options: YNU },
      { id: 'vasc_previous_dvt', label: 'Previous DVT / leg clot', type: 'select', options: YNU },
      { id: 'vasc_smoker', label: 'Smoker', type: 'select', options: YNU },
    ],
  },

  skin_rash: {
    id: 'skin_rash',
    title: 'Rash / skin eruption',
    questions: [
      { id: 'rash_distribution', label: 'Distribution', type: 'select', options: ['Localised', 'Widespread', 'Flexures', 'Extensor surfaces', 'Sun-exposed areas', 'Mucous membranes involved', 'Unknown'], redFlags: ['Mucous membranes involved'] },
      { id: 'rash_type', label: 'Type', type: 'select', options: ['Macules / patches', 'Papules', 'Blisters / bullae', 'Pustules', 'Skin peeling / sloughing', 'Wheals (urticaria)', 'Purpura', 'Plaques / scales', 'Unknown'], redFlags: ['Skin peeling / sloughing', 'Purpura'] },
      { id: 'rash_new_drug', label: 'New drug in the last 8 weeks', type: 'select', options: YNU, redFlags: ['Yes'] },
      { id: 'rash_itch', label: 'Itchy', type: 'select', options: YNU },
      { id: 'rash_fever', label: 'With fever / feeling unwell', type: 'select', options: YNU },
    ],
  },
};

/**
 * Where a wound is, and what caused it.
 *
 * Both were free-text boxes. That is fine for one clinician writing a note and
 * useless for everything else: "L heel", "Left heel", "left heel ulcer" and
 * "LT HEEL" are four aetiologies to a database and one wound to a person, so
 * nothing could be counted, compared between patients, or audited by site.
 *
 * These lists are therefore the vocabulary, and every one ends in an "Other"
 * that takes free text — because a list that cannot be escaped gets defeated
 * by whoever meets the case it missed, and they will type it into whichever
 * box is nearest.
 *
 * SCOPE
 *
 * The anatomy is a general surgical map, weighted towards the sites a plastic
 * and reconstructive unit actually works on: the flap and graft donor sites,
 * the pressure points, the hand in detail.
 *
 * The aetiology list is written for this unit's practice at UNTH, so it
 * carries what is common here and absent from most textbook lists — kerosene
 * and generator burns, okada injuries, Buruli and tropical phagedenic ulcers,
 * sickle cell ulcers, and the gangrene that follows traditional-medicine
 * application. A list that omits what walks through the door pushes clinicians
 * straight to "Other", and then nothing is coded at all.
 */

export interface TaxonomyGroup {
  group: string;
  options: string[];
}

/** The escape hatch, used by every selector built on these lists. */
export const OTHER_OPTION = 'Other (specify)';

// ---------------------------------------------------------------------------
// Anatomical sites
// ---------------------------------------------------------------------------

export const ANATOMICAL_SITES: TaxonomyGroup[] = [
  {
    group: 'Scalp & face',
    options: [
      'Scalp — frontal', 'Scalp — parietal', 'Scalp — temporal', 'Scalp — occipital',
      'Scalp — vertex', 'Forehead', 'Eyebrow', 'Upper eyelid', 'Lower eyelid',
      'Periorbital', 'Nose — dorsum', 'Nose — ala', 'Nose — tip', 'Nose — columella',
      'Cheek', 'Malar / zygomatic', 'Upper lip', 'Lower lip', 'Oral commissure',
      'Chin', 'Mandibular region', 'Parotid region', 'Temple',
    ],
  },
  {
    group: 'Ear & neck',
    options: [
      'Ear — helix', 'Ear — antihelix', 'Ear — lobule', 'Ear — concha',
      'Preauricular', 'Postauricular / retroauricular',
      'Neck — anterior', 'Neck — lateral', 'Neck — posterior', 'Supraclavicular',
      'Submandibular', 'Submental',
    ],
  },
  {
    group: 'Chest & abdomen',
    options: [
      'Chest wall — anterior', 'Chest wall — lateral', 'Sternum', 'Breast',
      'Inframammary fold', 'Axilla', 'Epigastrium', 'Umbilicus',
      'Abdomen — upper', 'Abdomen — lower', 'Flank', 'Groin / inguinal',
      'Suprapubic',
    ],
  },
  {
    group: 'Back, sacrum & buttock',
    options: [
      'Back — upper / scapular', 'Back — interscapular', 'Back — lumbar',
      'Sacrum', 'Coccyx', 'Buttock / gluteal', 'Ischial tuberosity',
      'Greater trochanter', 'Iliac crest',
    ],
  },
  {
    group: 'Perineum & genitalia',
    options: [
      'Perineum', 'Perianal', 'Scrotum', 'Penis', 'Vulva', 'Natal cleft',
    ],
  },
  {
    group: 'Shoulder & arm',
    options: [
      'Shoulder', 'Deltoid region', 'Upper arm — anterior', 'Upper arm — posterior',
      'Upper arm — medial', 'Upper arm — lateral', 'Elbow', 'Olecranon',
      'Antecubital fossa',
    ],
  },
  {
    group: 'Forearm, wrist & hand',
    options: [
      'Forearm — volar', 'Forearm — dorsal', 'Wrist — volar', 'Wrist — dorsal',
      'Hand — dorsum', 'Hand — palm', 'Thenar eminence', 'Hypothenar eminence',
      'First web space', 'Web space — other',
      'Thumb', 'Index finger', 'Middle finger', 'Ring finger', 'Little finger',
      'Finger — pulp', 'Nail bed', 'Amputation stump — digit',
    ],
  },
  {
    group: 'Hip, thigh & knee',
    options: [
      'Hip', 'Thigh — anterior', 'Thigh — anterolateral', 'Thigh — lateral',
      'Thigh — medial', 'Thigh — posterior', 'Knee', 'Patella', 'Popliteal fossa',
    ],
  },
  {
    group: 'Leg, ankle & foot',
    options: [
      'Leg — pretibial / anterior', 'Leg — posterior / calf', 'Leg — lateral',
      'Leg — medial', 'Ankle — medial malleolus', 'Ankle — lateral malleolus',
      'Achilles region', 'Heel', 'Foot — dorsum', 'Foot — plantar / sole',
      'Forefoot', 'Midfoot', 'Metatarsal head', 'Great toe', 'Lesser toe',
      'Amputation stump — below knee', 'Amputation stump — above knee',
    ],
  },
  {
    group: 'Generalised',
    options: [
      'Multiple sites', 'Circumferential — limb', 'Circumferential — trunk',
      'Extensive / whole body surface',
    ],
  },
];

export const BODY_SIDES = ['Left', 'Right', 'Midline', 'Bilateral', 'Not applicable'];

// ---------------------------------------------------------------------------
// Aetiology
// ---------------------------------------------------------------------------

export const WOUND_ETIOLOGIES: TaxonomyGroup[] = [
  {
    group: 'Burns',
    options: [
      'Flame burn', 'Scald — hot water', 'Scald — hot oil', 'Scald — hot food',
      'Kerosene / petrol burn', 'Gas explosion burn', 'Generator / fuel burn',
      'Contact burn', 'Chemical burn — acid', 'Chemical burn — alkali',
      'Electrical burn — high voltage', 'Electrical burn — low voltage',
      'Flash burn', 'Friction burn', 'Radiation burn',
    ],
  },
  {
    group: 'Trauma',
    options: [
      'Road traffic accident', 'Motorcycle (okada) injury', 'Fall from height',
      'Machete / cut injury', 'Gunshot injury', 'Stab injury', 'Blast injury',
      'Crush injury', 'Degloving injury', 'Avulsion injury',
      'Industrial / machinery injury', 'Assault', 'Sports injury',
    ],
  },
  {
    group: 'Bites & envenomation',
    options: [
      'Snake bite', 'Dog bite', 'Human bite', 'Insect / arthropod bite',
      'Scorpion sting', 'Other animal bite',
    ],
  },
  {
    group: 'Pressure & neuropathic',
    options: [
      'Pressure injury', 'Diabetic foot ulcer', 'Neuropathic ulcer',
      'Spinal cord injury related', 'Device-related pressure injury',
      'Plaster / cast pressure sore',
    ],
  },
  {
    group: 'Vascular',
    options: [
      'Venous leg ulcer', 'Arterial / ischaemic ulcer', 'Mixed arteriovenous ulcer',
      'Sickle cell ulcer', 'Vasculitic ulcer', 'Lymphoedema-related ulcer',
      'Compartment syndrome sequela',
    ],
  },
  {
    group: 'Infective',
    options: [
      'Necrotising fasciitis', "Fournier's gangrene", 'Abscess', 'Cellulitis',
      'Pyomyositis', 'Osteomyelitis-related', 'Buruli ulcer',
      'Tropical phagedenic ulcer', 'Tuberculous ulcer', 'Leprosy-related ulcer',
      'Injection abscess', 'Tetanus-related', 'Gas gangrene',
      'Post-measles / post-varicella', 'Noma (cancrum oris)',
    ],
  },
  {
    group: 'Surgical & iatrogenic',
    options: [
      'Surgical site infection', 'Wound dehiscence', 'Skin graft donor site',
      'Flap necrosis', 'Extravasation injury', 'Tourniquet injury',
      'Amputation stump breakdown', 'Stoma-related', 'Tracheostomy-related',
      'Post-excision defect', 'Contracture release defect',
    ],
  },
  {
    group: 'Oncological',
    options: [
      'Squamous cell carcinoma', 'Basal cell carcinoma', 'Melanoma',
      "Marjolin's ulcer", 'Kaposi sarcoma', 'Soft tissue sarcoma',
      'Fungating tumour', 'Radionecrosis',
    ],
  },
  {
    group: 'Inflammatory & immune',
    options: [
      'Pyoderma gangrenosum', 'Stevens-Johnson syndrome / TEN',
      'Hidradenitis suppurativa', 'Calciphylaxis', 'Autoimmune blistering disease',
    ],
  },
  {
    group: 'Scar & congenital',
    options: [
      'Keloid', 'Hypertrophic scar', 'Post-burn contracture',
      'Congenital anomaly', 'Vascular malformation', 'Giant naevus',
    ],
  },
  {
    group: 'Other causes',
    options: [
      'Traditional / native medicine application', 'Self-inflicted injury',
      'Neglected / untreated wound', 'Cause unknown',
    ],
  },
];

// ---------------------------------------------------------------------------

/** Wound types, kept beside the taxonomy so all three lists live together. */
/**
 * Wound types for the wound monitor.
 *
 * Keloid and hypertrophic scar are deliberately absent. They are followed in
 * the scar & keloid monitor, which measures growth, activity, treatment
 * response and recurrence — not area reduction, healing velocity and a
 * projected closure date, none of which a keloid has. Offering "Keloid" here
 * invites a clinician to register one as a wound and then be shown a healing
 * map it will never complete.
 */
export const WOUND_TYPES = [
  'Burn', 'Pressure injury', 'Venous ulcer', 'Arterial ulcer',
  'Diabetic foot ulcer', 'Sickle cell ulcer', 'Surgical wound',
  'Traumatic wound', 'Skin graft donor site', 'Skin graft recipient site',
  'Flap', 'Necrotising fasciitis', "Fournier's gangrene", 'Malignant wound',
];

/** Flat list of every option in a taxonomy, for validation and search. */
export function flatten(groups: TaxonomyGroup[]): string[] {
  return groups.flatMap((g) => g.options);
}

/**
 * True when the value is one of the listed options.
 *
 * A stored value that is not on the list is not an error — it came through
 * "Other", which is a supported answer — but a caller that wants to count by
 * site needs to know which bucket it is in.
 */
export function isListed(groups: TaxonomyGroup[], value: string | null | undefined): boolean {
  if (!value) return false;
  return flatten(groups).includes(value);
}

/** Which group an option belongs to, or null for free text. */
export function groupOf(groups: TaxonomyGroup[], value: string | null | undefined): string | null {
  if (!value) return null;
  return groups.find((g) => g.options.includes(value))?.group ?? null;
}

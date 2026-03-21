/**
 * Medical Dictionary Service — word suggestions for clinical text input.
 * Focused on plastic surgery, general surgery, and ward management terminology.
 * Uses a trie for fast prefix matching.
 */

// ─── Medical Dictionary ──────────────────────────────────────────────

const MEDICAL_TERMS: string[] = [
  // ── Plastic Surgery Procedures ──
  'abdominoplasty', 'augmentation', 'blepharoplasty', 'brachioplasty', 'capsulectomy',
  'capsulotomy', 'cheiloplasty', 'cleft lip repair', 'cleft palate repair',
  'contracture release', 'craniosynostosis repair', 'debridement', 'dermabrasion',
  'ear reconstruction', 'excision', 'face lift', 'fasciotomy', 'fat grafting',
  'flap reconstruction', 'free flap', 'graft', 'gynaecomastia surgery',
  'hand reconstruction', 'hypospadias repair', 'keloid excision', 'liposuction',
  'mammoplasty', 'mandibular reconstruction', 'mastectomy', 'mastopexy',
  'mentoplasty', 'microvascular anastomosis', 'microsurgery', 'myocutaneous flap',
  'nasolabial flap', 'nerve repair', 'nipple reconstruction', 'otoplasty',
  'palatoplasty', 'pedicled flap', 'perforator flap', 'pharyngoplasty',
  'pinch graft', 'reconstruction', 'reduction mammoplasty', 'replantation',
  'rhinoplasty', 'rhomboid flap', 'rhytidectomy', 'rotation flap',
  'scar revision', 'septoplasty', 'skin flap', 'skin graft',
  'split thickness skin graft', 'full thickness skin graft', 'tendon repair',
  'tissue expansion', 'transposition flap', 'TRAM flap', 'V-Y advancement',
  'W-plasty', 'Z-plasty', 'wound closure',

  // ── Burn Care ──
  'burn wound', 'burn dressing', 'burn excision', 'chemical burn', 'circumferential burn',
  'contract burn', 'deep dermal burn', 'electrical burn', 'epidermal burn',
  'escharotomy', 'flame burn', 'flash burn', 'friction burn', 'inhalation injury',
  'Lund and Browder chart', 'Parkland formula', 'rule of nines', 'scald burn',
  'superficial burn', 'superficial dermal burn', 'thermal burn',
  'total body surface area', 'TBSA', 'Wallace rule of nines',

  // ── Wound Care ──
  'abscess', 'cellulitis', 'chronic wound', 'clean wound', 'contaminated wound',
  'dead space', 'dehiscence', 'dirty wound', 'epithelialization', 'exudate',
  'fascia', 'fibroblast', 'fistula', 'foreign body', 'gangrene',
  'granulation tissue', 'haematoma', 'haemostasis', 'healing by primary intention',
  'healing by secondary intention', 'hypergranulation', 'incision and drainage',
  'irrigation', 'keloid', 'laceration', 'maceration', 'necrosis',
  'necrotic tissue', 'negative pressure wound therapy', 'NPWT', 'oedema',
  'pressure injury', 'pressure sore', 'pressure ulcer', 'purulence',
  'seroma', 'sinus tract', 'slough', 'stump wound', 'surgical site infection',
  'tension', 'ulcer', 'undermining', 'wound bed preparation', 'wound contraction',
  'wound culture', 'wound dehiscence', 'wound edge', 'wound healing',
  'wound irrigation', 'wound swab', 'wound vacuum',

  // ── Dressings & Materials ──
  'Acticoat', 'Adaptic', 'alginate dressing', 'Aquacel', 'Bactigras',
  'bismuth iodoform paraffin paste', 'BIPP', 'cadexomer iodine', 'calcium alginate',
  'Comfeel', 'compression bandage', 'Duoderm', 'foam dressing', 'gauze dressing',
  'hydrocolloid dressing', 'hydrogel dressing', 'Inadine', 'Jelonet',
  'Kaltostat', 'Mepilex', 'Mepitel', 'nanocrystalline silver', 'paraffin gauze',
  'petroleum jelly gauze', 'povidone iodine', 'silicone dressing',
  'silver sulfadiazine', 'skin substitute', 'Tegaderm', 'Vaseline gauze',

  // ── Anatomy — Head & Neck ──
  'alar cartilage', 'buccal fat pad', 'columella', 'dorsum of nose', 'ear lobule',
  'facial nerve', 'frontal branch', 'genioplasty', 'hyoid bone', 'infraorbital nerve',
  'lateral canthus', 'mandible', 'marginal mandibular nerve', 'masseter',
  'maxilla', 'mental nerve', 'mentalis', 'nasal bone', 'nasal septum',
  'nasion', 'orbicularis oculi', 'orbicularis oris', 'parotid gland',
  'platysma', 'SMAS', 'superficial musculoaponeurotic system', 'temporal branch',
  'tragus', 'vermilion border', 'zygoma', 'zygomatic arch',

  // ── Anatomy — Upper Limb ──
  'brachial artery', 'brachial plexus', 'carpal tunnel', 'digital nerve',
  'Dupuytren contracture', 'extensor tendon', 'flexor digitorum profundus',
  'flexor digitorum superficialis', 'flexor tendon', 'Guyon canal',
  'hypothenar', 'interosseous muscle', 'median nerve', 'radial artery',
  'radial nerve', 'thenar', 'trigger finger', 'ulnar artery', 'ulnar nerve',

  // ── Anatomy — Lower Limb ──
  'anterior tibial artery', 'common peroneal nerve', 'dorsalis pedis artery',
  'femoral artery', 'fibula', 'gracilis muscle', 'lateral malleolus',
  'medial malleolus', 'peroneal artery', 'popliteal artery', 'posterior tibial artery',
  'saphenous nerve', 'saphenous vein', 'sural nerve', 'tendo Achillis', 'tibia',

  // ── Anatomy — Trunk ──
  'anterior rectus sheath', 'deep inferior epigastric artery', 'DIEP flap',
  'external oblique', 'internal oblique', 'latissimus dorsi', 'linea alba',
  'pectoralis major', 'posterior rectus sheath', 'rectus abdominis',
  'serratus anterior', 'thoracodorsal artery', 'transversus abdominis',

  // ── SOAP Note Terms ──
  'subjective', 'objective', 'assessment', 'plan',
  'chief complaint', 'history of presenting illness', 'review of systems',
  'past medical history', 'past surgical history', 'family history',
  'social history', 'drug history', 'allergy history',
  'examination findings', 'vital signs', 'investigations',
  'differential diagnosis', 'working diagnosis', 'impression',
  'clinical assessment', 'progress note', 'ward round note',

  // ── Vital Signs & Observations ──
  'blood pressure', 'diastolic', 'systolic', 'heart rate', 'pulse rate',
  'respiratory rate', 'oxygen saturation', 'SpO2', 'temperature',
  'Glasgow Coma Scale', 'GCS', 'capillary refill time', 'CRT',
  'pain score', 'body mass index', 'BMI', 'weight', 'height',
  'urine output', 'fluid balance', 'input output chart',

  // ── Common Diagnoses ──
  'abscess drainage', 'acute wound', 'avascular necrosis', 'basal cell carcinoma',
  'breast cancer', 'breast reconstruction', 'carcinoma', 'cellulitis',
  'chronic ulcer', 'cleft lip', 'cleft palate', 'compartment syndrome',
  'congenital anomaly', 'crush injury', 'cutaneous malignancy', 'cyst',
  'de-gloving injury', 'diabetic foot ulcer', 'dupuytren disease', 'fibroma',
  'giant cell tumour', 'gynecomastia', 'haemangioma', 'hand injury',
  'hidradenitis suppurativa', 'human bite', 'hypertrophic scar', 'keloid scar',
  'lipoma', 'lymphoedema', 'malignant melanoma', 'Marjolin ulcer',
  'melanoma', 'meningocele', 'noma', 'necrotising fasciitis',
  'neuropathic ulcer', 'post-burn contracture', 'pressure ulcer', 'raw area',
  'sarcoma', 'sebaceous cyst', 'soft tissue infection', 'squamous cell carcinoma',
  'syndactyly', 'tendon injury', 'traumatic wound', 'venous ulcer',

  // ── Medications ──
  'acetaminophen', 'paracetamol', 'amoxicillin', 'amoxicillin-clavulanate',
  'augmentin', 'azithromycin', 'cefazolin', 'ceftriaxone', 'cefuroxime',
  'ciprofloxacin', 'clindamycin', 'co-amoxiclav', 'diclofenac', 'enoxaparin',
  'flucloxacillin', 'gentamicin', 'heparin', 'ibuprofen', 'ketorolac',
  'linezolid', 'meropenem', 'metronidazole', 'morphine', 'naproxen',
  'omeprazole', 'ondansetron', 'oxycodone', 'pantoprazole', 'pentazocine',
  'pethidine', 'piperacillin-tazobactam', 'tramadol', 'vancomycin', 'warfarin',
  'aspirin', 'atorvastatin', 'insulin', 'metformin', 'amlodipine',
  'lisinopril', 'losartan', 'nifedipine', 'prednisolone', 'dexamethasone',
  'hydrocortisone', 'ketamine', 'lignocaine', 'lidocaine', 'bupivacaine',
  'adrenaline', 'epinephrine', 'atropine', 'neostigmine',
  'chlorhexidine', 'hydrogen peroxide', 'normal saline', 'Ringer lactate',
  'Hartmann solution', 'dextrose saline', '5% dextrose', 'Gelofusine',
  'Haemaccel', 'packed red blood cells', 'fresh frozen plasma', 'platelets',
  'cryoprecipitate', 'whole blood', 'albumin',

  // ── Lab Investigations ──
  'full blood count', 'FBC', 'complete blood count', 'CBC',
  'haemoglobin', 'packed cell volume', 'PCV', 'white blood cell count', 'WBC',
  'platelet count', 'erythrocyte sedimentation rate', 'ESR',
  'C-reactive protein', 'CRP', 'procalcitonin',
  'electrolytes urea creatinine', 'EUC', 'serum electrolytes',
  'liver function test', 'LFT', 'renal function test', 'RFT',
  'prothrombin time', 'PT', 'INR', 'activated partial thromboplastin time', 'APTT',
  'bleeding time', 'clotting time', 'blood group', 'cross match',
  'blood culture', 'wound culture', 'urinalysis', 'urine microscopy',
  'random blood sugar', 'fasting blood sugar', 'HbA1c',
  'serum protein', 'serum albumin', 'total protein',
  'chest X-ray', 'abdominal X-ray', 'ultrasound', 'CT scan', 'MRI',
  'echocardiography', 'ECG', 'electrocardiogram',
  'tissue biopsy', 'histopathology', 'fine needle aspiration', 'FNAC',

  // ── DVT / VTE ──
  'deep vein thrombosis', 'DVT', 'pulmonary embolism', 'PE',
  'venous thromboembolism', 'VTE', 'anticoagulation', 'thromboprophylaxis',
  'Caprini score', 'compression stockings', 'TED stockings',
  'intermittent pneumatic compression', 'Doppler ultrasound', 'D-dimer',
  'Wells score', 'heparin prophylaxis', 'low molecular weight heparin', 'LMWH',

  // ── Anaesthesia ──
  'general anaesthesia', 'local anaesthesia', 'regional anaesthesia',
  'spinal anaesthesia', 'epidural anaesthesia', 'nerve block',
  'digital nerve block', 'brachial plexus block', 'sedation',
  'conscious sedation', 'tumescent anaesthesia', 'ASA classification',
  'Mallampati score', 'airway assessment', 'intubation', 'laryngeal mask',
  'pre-operative assessment', 'post-operative care', 'anaesthetic review',

  // ── Surgical Terms ──
  'aseptic technique', 'diathermy', 'electrocautery', 'haemostasis',
  'informed consent', 'intraoperative', 'laparotomy', 'operative findings',
  'post-operative', 'pre-operative', 'sterile field', 'surgical drain',
  'surgical marking', 'surgical safety checklist', 'suture',
  'absorbable suture', 'non-absorbable suture', 'nylon suture', 'prolene',
  'vicryl', 'silk suture', 'staples', 'steri-strips',
  'tourniquet', 'WHO checklist', 'time out', 'sign out',

  // ── Ward Management ──
  'admission', 'bed allocation', 'bed occupancy', 'clinical pathway',
  'consultant review', 'daily review', 'diet order', 'discharge planning',
  'discharge summary', 'drug chart', 'fluid chart', 'handover',
  'multidisciplinary team', 'MDT', 'nursing care plan', 'observation chart',
  'patient education', 'physiotherapy', 'referral', 'rehabilitation',
  'transfer', 'ward round', 'clinical ward round', 'consultant ward round',

  // ── Nutrition ──
  'caloric requirement', 'enteral nutrition', 'high protein diet',
  'malnutrition', 'nasogastric tube', 'NG tube', 'nil per os', 'NPO',
  'nutritional assessment', 'oral feeding', 'parenteral nutrition',
  'protein supplementation', 'total parenteral nutrition', 'TPN',
  'vitamin supplementation', 'wound healing nutrition',

  // ── Microbiology ──
  'antibiotic sensitivity', 'culture and sensitivity', 'MRSA',
  'methicillin-resistant Staphylococcus aureus', 'Pseudomonas aeruginosa',
  'Staphylococcus aureus', 'Streptococcus', 'Escherichia coli', 'E. coli',
  'Klebsiella', 'Proteus', 'anaerobic infection', 'aerobic infection',
  'gram stain', 'Gram positive', 'Gram negative', 'polymicrobial',

  // ── Common Abbreviations ──
  'b.d.', 'b.i.d.', 'stat', 't.d.s.', 't.i.d.', 'q.d.s.', 'q.i.d.',
  'nocte', 'mane', 'p.r.n.', 'o.d.', 'IV', 'IM', 'SC', 'PO',
  'PR', 'topical', 'sublingual', 'nebulised', 'inhalation',
  'milligram', 'microgram', 'gram', 'millilitre', 'litre',
  'units', 'international units', 'IU',

  // ── Clinical Descriptions ──
  'afebrile', 'alert', 'ambulant', 'comfortable', 'conscious',
  'diaphoretic', 'distressed', 'drowsy', 'dyspnoeic', 'febrile',
  'haemodynamically stable', 'ill-looking', 'irritable', 'lethargic',
  'lucid', 'nil acute distress', 'not in distress', 'oriented',
  'pale', 'restless', 'semiconscious', 'stable', 'tachycardic',
  'tachypnoeic', 'tender', 'unresponsive', 'well-hydrated',
  'well-nourished', 'wound is clean', 'wound is dry', 'wound is healing well',
  'slough present', 'granulating', 'no signs of infection', 'purulent discharge',
  'erythema around wound', 'wound edges approximated', 'sutures intact',
  'drain output', 'drain removed', 'mobilising well', 'tolerating oral intake',
  'passed flatus', 'opened bowels', 'voiding well',
  'clinically improving', 'clinically deteriorating', 'stable condition',
  'satisfactory progress', 'for discharge', 'for continued admission',
  'continue current management', 'plan for surgery', 'awaiting results',
  'reviewed by', 'discussed with', 'impression is', 'differential includes',
];

// ─── Trie data structure for fast prefix search ──────────────

interface TrieNode {
  children: Map<string, TrieNode>;
  words: string[];  // Complete words that pass through this node
}

function createTrieNode(): TrieNode {
  return { children: new Map(), words: [] };
}

class MedicalDictionary {
  private root: TrieNode;
  private allTerms: string[];
  private initialized = false;

  constructor() {
    this.root = createTrieNode();
    this.allTerms = [];
  }

  /** Build the trie from the dictionary. Called lazily on first use. */
  private initialize() {
    if (this.initialized) return;
    this.allTerms = MEDICAL_TERMS;
    for (const term of this.allTerms) {
      this.insert(term);
    }
    this.initialized = true;
  }

  private insert(term: string) {
    const lower = term.toLowerCase();
    // Index by every word in multi-word terms so "skin graft" matches "graft" too
    const words = lower.split(/\s+/);
    for (const word of words) {
      let node = this.root;
      for (const ch of word) {
        if (!node.children.has(ch)) {
          node.children.set(ch, createTrieNode());
        }
        node = node.children.get(ch)!;
        // Keep unique terms per node, capped for memory
        if (!node.words.includes(term) && node.words.length < 20) {
          node.words.push(term);
        }
      }
    }
  }

  /**
   * Get suggestions for a given prefix.
   * Returns up to `limit` matching terms, sorted by relevance.
   */
  getSuggestions(prefix: string, limit = 8): string[] {
    this.initialize();

    const clean = prefix.toLowerCase().trim();
    if (clean.length < 2) return [];

    let node = this.root;
    for (const ch of clean) {
      if (!node.children.has(ch)) return [];
      node = node.children.get(ch)!;
    }

    // Score: exact prefix match at start > match anywhere
    const scored = node.words.map(term => {
      const lower = term.toLowerCase();
      const startsWithPrefix = lower.startsWith(clean) ? 0 : 1;
      return { term, score: startsWithPrefix, len: term.length };
    });

    scored.sort((a, b) => a.score - b.score || a.len - b.len);
    return scored.slice(0, limit).map(s => s.term);
  }

  /**
   * Add custom terms (e.g. user-specific or patient-specific terms).
   */
  addTerms(terms: string[]) {
    this.initialize();
    for (const term of terms) {
      if (!this.allTerms.includes(term)) {
        this.allTerms.push(term);
        this.insert(term);
      }
    }
  }

  /**
   * Extract the current word being typed from a text + cursor position.
   * Returns { word, startIndex } or null if no word is being typed.
   */
  extractCurrentWord(text: string, cursorPos: number): { word: string; startIndex: number } | null {
    if (!text || cursorPos <= 0) return null;

    // Walk backwards from cursor to find word start
    let start = cursorPos;
    while (start > 0 && /[a-zA-Z0-9\-.]/.test(text[start - 1])) {
      start--;
    }

    const word = text.slice(start, cursorPos);
    if (word.length < 2) return null;

    return { word, startIndex: start };
  }
}

export const medicalDictionary = new MedicalDictionary();

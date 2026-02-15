// Clinical Conference auto-content templates based on WHO standards and major journals
// These provide structured content for common plastic surgery conference topics

export interface ConferenceTopicContent {
  topic: string;
  outline: string[];
  anatomy: string[];
  pathology: string[];
  pathophysiology: string[];
  clinicalEvaluation: string[];
  investigations: string[];
  treatmentPrinciples: string[];
  takeHomePoints: string[];
  references: string[];
}

/**
 * Returns evidence-based template content for common plastic surgery topics.
 * Content drawn from WHO guidelines, BAPS/ISAPS standards, and major journals.
 */
export function getTopicContent(topic: string): ConferenceTopicContent | null {
  const normalised = topic.toLowerCase().trim();
  
  for (const [key, content] of Object.entries(TOPIC_TEMPLATES)) {
    if (normalised.includes(key)) return content;
  }
  
  // Return generic template if no specific match
  return getGenericTemplate(topic);
}

function getGenericTemplate(topic: string): ConferenceTopicContent {
  return {
    topic,
    outline: [
      'Introduction and overview',
      'Relevant surgical anatomy',
      'Pathology and pathophysiology',
      'Clinical evaluation',
      'Investigations',
      'Treatment principles',
      'Case presentation',
      'Take home points',
    ],
    anatomy: ['Relevant anatomy to be discussed based on case presentation'],
    pathology: ['Pathological considerations specific to this clinical scenario'],
    pathophysiology: ['Underlying pathophysiological mechanisms'],
    clinicalEvaluation: [
      'Comprehensive history taking',
      'Systematic physical examination',
      'Documentation with clinical photographs',
      'Standardised assessment scoring where applicable',
    ],
    investigations: [
      'Full blood count (FBC)',
      'Urea, electrolytes, and creatinine (U&E/Cr)',
      'Additional investigations as clinically indicated',
    ],
    treatmentPrinciples: [
      'Evidence-based approach following WHO guidelines',
      'Multidisciplinary team involvement',
      'Patient-centred shared decision-making',
      'Appropriate follow-up planning',
    ],
    takeHomePoints: [
      'Systematic approach to clinical assessment is paramount',
      'Evidence-based treatment following current guidelines',
      'Multidisciplinary collaboration improves outcomes',
    ],
    references: [
      'WHO Guidelines for Safe Surgery (2009)',
      'Grabb & Smith\'s Plastic Surgery, 8th Edition',
    ],
  };
}

const TOPIC_TEMPLATES: Record<string, ConferenceTopicContent> = {
  'keloid': {
    topic: 'Keloid and Hypertrophic Scars',
    outline: [
      'Introduction — Definitions and epidemiology',
      'Relevant anatomy — Skin layers and wound healing',
      'Pathology — Histological features',
      'Pathophysiology — Aberrant wound healing cascade',
      'Clinical evaluation — Scar assessment',
      'Laboratory evaluation — When indicated',
      'Treatment principles — Multimodal approach',
      'Take home points',
    ],
    anatomy: [
      'Epidermis — keratinised stratified squamous epithelium',
      'Dermis — papillary (loose CT) and reticular (dense CT) layers',
      'Hypodermis — subcutaneous adipose tissue',
      'Collagen architecture — types I and III predominate; ratio changes during healing',
      'Skin tension lines (Langer\'s lines) — relevance to incision planning and scar outcome',
      'Blood supply — subdermal and dermal plexus networks',
    ],
    pathology: [
      'Keloids: Dense, irregularly arranged collagen bundles (type I >> type III)',
      'Extension beyond wound margins — pathognomonic feature',
      'Hypertrophic scars: Organised collagen nodules within wound boundaries',
      'Increased fibroblast density with myofibroblast persistence',
      'Absent rete ridges; flattened epidermis overlying scar',
      'Increased mucin deposition in keloids',
      'Histological distinction: keloids lack alpha-SMA-positive myofibroblasts vs hypertrophic scars',
    ],
    pathophysiology: [
      'Dysregulated wound healing — prolonged inflammatory phase',
      'TGF-β1 overexpression → excess collagen deposition',
      'Imbalance between collagen synthesis and degradation (↑ collagen, ↓ MMP activity)',
      'Role of mechanical tension (mechanotransduction) in scar formation',
      'Genetic predisposition — higher incidence in Fitzpatrick IV-VI skin types',
      'HLA associations and familial clustering',
      'Mast cell-mediated histamine release contributing to pruritus',
    ],
    clinicalEvaluation: [
      'Vancouver Scar Scale (VSS) — vascularity, pigmentation, pliability, height',
      'Patient and Observer Scar Assessment Scale (POSAS)',
      'Duration since injury/surgery',
      'Location (high-risk: ear, shoulder, sternum, deltoid)',
      'Symptoms: pain, pruritus, functional limitation',
      'Previous treatments and response',
      'Family history of abnormal scarring',
      'Photographic documentation with standardised positioning',
    ],
    investigations: [
      'Biopsy — only when diagnosis uncertain (differentiate from dermatofibrosarcoma protuberans)',
      'USS — scar thickness measurement for treatment monitoring',
      'Baseline bloods if surgery planned (FBC, coagulation)',
    ],
    treatmentPrinciples: [
      'First-line: Silicone gel sheeting/topical silicone (Grade A evidence)',
      'Intralesional corticosteroid injection (Triamcinolone 10-40 mg/mL)',
      'Pressure therapy — graduated compression (15-40 mmHg, ≥23 hrs/day)',
      'Surgical excision with adjuvant therapy (recurrence 45-100% alone)',
      'Combination: excision + intralesional steroids ± radiotherapy',
      'Radiation therapy — superficial RT within 24-48 hrs post-excision',
      'Intralesional 5-fluorouracil (50 mg/mL) ± steroid combination',
      'Cryotherapy — intralesional or contact',
      'Emerging: Laser therapy (PDL, fractional CO₂), botulinum toxin',
      'WHO principle: Step-up approach — conservative → minimally invasive → surgical',
    ],
    takeHomePoints: [
      'Keloids extend beyond wound margins; hypertrophic scars do not',
      'TGF-β1 and mechanical tension are central to pathogenesis',
      'Monotherapy has high recurrence — multimodal approach is standard',
      'Early intervention with silicone/pressure prevents pathological scarring',
      'Counsel patients on realistic expectations — management, not always cure',
      'Higher recurrence in high-tension anatomical sites',
    ],
    references: [
      'Ogawa R. Keloid and Hypertrophic Scars Are the Result of Chronic Inflammation in the Reticular Dermis. Int J Mol Sci. 2017;18(3):606.',
      'Gauglitz GG et al. Hypertrophic Scarring and Keloids. Mol Med. 2011;17(1-2):113-125.',
      'International Advisory Panel on Scar Management. Scar Management Guidelines. 2014.',
      'Mustoe TA et al. International Clinical Recommendations on Scar Management. Plast Reconstr Surg. 2002;110(2):560-571.',
      'Grabb & Smith\'s Plastic Surgery, 8th Edition. Chapter on Abnormal Scarring.',
    ],
  },

  'burn': {
    topic: 'Burns Management',
    outline: [
      'Introduction — Epidemiology and public health impact',
      'Relevant anatomy — Skin structure and burn depth',
      'Pathology — Jackson\'s burn wound model',
      'Pathophysiology — Systemic response to burns',
      'Clinical evaluation — Assessment and classification',
      'Laboratory evaluation',
      'Treatment principles — Acute and reconstructive',
      'Take home points',
    ],
    anatomy: [
      'Skin — largest organ, 1.5-2.0 m² surface area in adults',
      'Epidermis — barrier function; keratinocytes, melanocytes, Langerhans cells',
      'Dermis — structural support; collagen, elastin, nerves, vasculature',
      'Skin appendages — hair follicles, sebaceous and sweat glands (source of re-epithelialisation)',
      'Subcutaneous tissue — insulation, energy reserve',
      'Zones variation by body region — thin skin vs thick skin',
    ],
    pathology: [
      'Jackson\'s burn wound model (1953):',
      '  Zone of coagulation — irreversible cell death (central)',
      '  Zone of stasis — potentially salvageable; may convert to necrosis without treatment',
      '  Zone of hyperaemia — viable tissue with inflammatory response (peripheral)',
      'Depth classification: superficial, superficial partial thickness, deep partial thickness, full thickness',
      'Eschar formation — denatured proteins and necrotic tissue',
    ],
    pathophysiology: [
      'Local response: Histamine, prostaglandins → increased vascular permeability',
      'Systemic response (>20% TBSA): Capillary leak, third-spacing, hypovolaemia',
      'Burn shock — combination of hypovolaemic and distributive shock',
      'Hypermetabolic response — up to 200% of basal metabolic rate',
      'Immunosuppression — impaired cellular and humoral immunity',
      'Systemic inflammatory response syndrome (SIRS) → potential MODS',
    ],
    clinicalEvaluation: [
      'TBSA estimation: Wallace Rule of Nines, Lund-Browder chart (gold standard)',
      'Burn depth assessment — clinical (appearance, sensation, capillary refill)',
      'Airway assessment — singed nasal hairs, carbonaceous sputum, stridor',
      'Carbon monoxide / cyanide poisoning screening',
      'Circumferential burns — compartment syndrome risk assessment',
      'ABCDE primary survey approach',
      'Tetanus status',
    ],
    investigations: [
      'ABG with COHb levels',
      'FBC, U&E, coagulation profile, group and cross-match',
      'Serum lactate',
      'CXR — inhalation injury assessment',
      'Urinalysis — myoglobinuria (electrical burns)',
      'Laser Doppler Imaging — burn depth assessment (when available)',
    ],
    treatmentPrinciples: [
      'Primary survey — ABCDE; secure airway early if inhalation injury suspected',
      'Fluid resuscitation — Parkland formula: 4 mL × %TBSA × body weight (kg)',
      '  Give 50% in first 8 hours, 50% in next 16 hours',
      '  Titrate to urine output: 0.5-1 mL/kg/hr (adults), 1-2 mL/kg/hr (children)',
      'Wound care: cooling (15-20°C water, 20 min), Cling film/biosynthetic dressings',
      'Escharotomy for circumferential full-thickness burns',
      'Early excision and grafting — within 72 hours for deep burns',
      'Nutritional support — Curreri formula; high-protein, high-calorie diet',
      'Pain management — multimodal analgesia',
      'Rehabilitation — early mobilisation, splinting, pressure garments',
    ],
    takeHomePoints: [
      'Zone of stasis is the therapeutic target — can be saved or lost',
      'Parkland formula is a STARTING point — titrate to clinical response',
      'Early intubation if airway compromise suspected — do not delay',
      'Early excision and grafting improves survival in major burns',
      'Multidisciplinary approach: surgery, physiotherapy, psychology, nutrition',
      'Prevention is the best treatment — WHO burn prevention programmes',
    ],
    references: [
      'WHO Fact Sheet: Burns (2023). https://www.who.int/news-room/fact-sheets/detail/burns',
      'ISBI Practice Guidelines for Burn Care. Burns. 2016;42(5):953-1021.',
      'Jeschke MG et al. Burn Injury. Nat Rev Dis Primers. 2020;6(1):11.',
      'Jackson DM. The Diagnosis of the Depth of Burning. Br J Surg. 1953;40(164):588-596.',
      'Herndon DN. Total Burn Care, 5th Edition. Elsevier, 2018.',
    ],
  },

  'cleft': {
    topic: 'Cleft Lip and Palate',
    outline: [
      'Introduction — Epidemiology and classification',
      'Relevant anatomy — Facial embryology',
      'Pathology — Developmental anomaly',
      'Pathophysiology — Fusion failure',
      'Clinical evaluation — Assessment protocol',
      'Investigations',
      'Treatment principles — Timeline of interventions',
      'Take home points',
    ],
    anatomy: [
      'Facial development — frontonasal, maxillary, mandibular processes',
      'Primary palate — premaxilla, formed by medial nasal processes (fuses by 6 weeks)',
      'Secondary palate — palatine shelves elevate and fuse (7-12 weeks)',
      'Orbicularis oris muscle — abnormal insertion in cleft lip',
      'Tensor and levator veli palatini — abnormal anatomy in cleft palate',
      'Blood supply — greater palatine and ascending pharyngeal arteries',
    ],
    pathology: [
      'Failure of fusion of facial processes during 4th-12th week of gestation',
      'Unilateral cleft lip — failure of fusion of medial nasal and maxillary process',
      'Bilateral cleft lip — failure on both sides',
      'Cleft palate — failure of palatal shelf fusion in the midline',
      'Submucous cleft palate — muscle diastasis with intact mucosal cover',
      'Associated anomalies: Pierre Robin, Treacher Collins, 22q11 deletion',
    ],
    pathophysiology: [
      'Multifactorial aetiology — genetic + environmental factors',
      'Genetic: IRF6, MSX1, TGFα, TGFβ3 gene variants',
      'Environmental: maternal smoking, alcohol, anticonvulsants (phenytoin), folate deficiency',
      'CL/P and CP are aetiologically distinct conditions',
      'Incidence: 1 in 700 live births (CL/P); higher in Asian and Native American populations',
    ],
    clinicalEvaluation: [
      'Complete vs incomplete cleft',
      'Unilateral vs bilateral',
      'Veau classification for cleft palate (I-IV)',
      'Assessment of hearing — high risk of otitis media with effusion',
      'Speech assessment — velopharyngeal insufficiency screening',
      'Dental assessment — missing/supernumerary teeth',
      'Feeding assessment in neonates',
      'Psychosocial assessment of family',
    ],
    investigations: [
      'Genetic counselling and karyotyping if syndromic features',
      'Audiometry — baseline and serial',
      'Lateral cephalogram and dental OPG (age-appropriate)',
      'Speech videofluoroscopy/nasendoscopy for VPI assessment',
      'Preoperative: FBC, Group & Save',
    ],
    treatmentPrinciples: [
      'Rule of 10s: Lip repair at 10 weeks, 10 lbs, 10 g/dL Hb',
      'Cleft lip repair: Millard rotation-advancement (unilateral), Manchester or Mulliken (bilateral)',
      'Cleft palate repair: 9-12 months — Veau-Wardill-Kilner or Furlow palatoplasty',
      'Pre-surgical orthopaedics: NAM (Nasoalveolar Moulding) in selected cases',
      'Grommets for OME — at palatoplasty',
      'Speech therapy — commence after palate repair',
      'Alveolar bone graft: 9-11 years (mixed dentition)',
      'Orthodontics: throughout childhood and adolescence',
      'Definitive rhinoplasty and orthognathic surgery: post skeletal maturity',
      'Multidisciplinary cleft team: surgeon, orthodontist, SLT, audiologist, psychologist',
    ],
    takeHomePoints: [
      'Cleft lip and palate is the most common congenital facial anomaly',
      'Multidisciplinary team approach is the standard of care (WHO)',
      'Timing of intervention follows established protocols for optimal outcomes',
      'Speech outcomes depend critically on timing and quality of palate repair',
      'Long-term follow-up through skeletal maturity is essential',
      'Screen for associated anomalies — 30% may have syndromic features',
    ],
    references: [
      'WHO Global Strategy for Cleft Care. World Health Organization, 2020.',
      'Mossey PA et al. Cleft lip and palate. Lancet. 2009;374(9703):1773-1785.',
      'Millard DR. Cleft Craft: The Evolution of Its Surgery. Little, Brown, 1976.',
      'American Cleft Palate-Craniofacial Association. Parameters for Evaluation and Treatment of Patients with Cleft Lip/Palate. Cleft Palate J. 2018.',
      'Grabb & Smith\'s Plastic Surgery, 8th Edition. Chapter on Cleft Lip and Palate.',
    ],
  },

  'flap': {
    topic: 'Flap Surgery — Principles and Classification',
    outline: [
      'Introduction — Reconstructive ladder and elevator',
      'Relevant anatomy — Tissue vascularity',
      'Classification of flaps',
      'Pathophysiology — Flap perfusion',
      'Clinical evaluation — Reconstructive planning',
      'Investigations',
      'Treatment principles — Flap selection',
      'Take home points',
    ],
    anatomy: [
      'Angiosomes — 3D vascular territories of the body (Taylor & Palmer, 1987)',
      'Random pattern flaps — subdermal plexus perfusion',
      'Axial pattern flaps — named source artery',
      'Perforator anatomy — musculocutaneous and septocutaneous perforators',
      'Venous drainage — venae comitantes and subcutaneous veins',
      'Choke vessels — connections between adjacent angiosomes',
    ],
    pathology: [
      'Flap failure — partial or total loss due to vascular compromise',
      'Venous congestion — most common cause of free flap failure',
      'Arterial insufficiency — pale, cool, no capillary refill',
      'Fat necrosis — partial perfusion failure in adipose tissue',
      'Flap oedema — expected in early postoperative period',
    ],
    pathophysiology: [
      'Ischaemia-reperfusion injury in free flaps',
      'No-reflow phenomenon — microvascular thrombosis',
      'Vasospasm — smooth muscle contraction in pedicle vessels',
      'Delay phenomenon — flap conditioning through staged ligation',
      'Neovascularisation — new blood vessel ingrowth from wound bed',
    ],
    clinicalEvaluation: [
      'Defect analysis — location, size, depth, tissue components needed',
      'Reconstructive ladder: direct closure → skin graft → local flap → regional → free flap',
      'Reconstructive elevator: direct to best option based on outcome',
      'Donor site morbidity assessment',
      'Patient factors: comorbidities, anticoagulation, smoking status',
      'Recipient vessel assessment for free flaps',
    ],
    investigations: [
      'CT angiography — perforator mapping for free flap planning',
      'Handheld Doppler — perforator localisation',
      'Allen\'s test — radial forearm free flap planning',
      'Duplex USS — vessel patency assessment',
    ],
    treatmentPrinciples: [
      'Replace "like with like" when possible',
      'Flap classification: composition, blood supply, proximity, method of transfer',
      'Local flaps: advancement, rotation, transposition, interpolation',
      'Regional flaps: pedicled (e.g., pectoralis major, latissimus dorsi)',
      'Free flaps: ALT, DIEP, radial forearm, fibula — microsurgical transfer',
      'Perforator flaps — reduce donor morbidity by preserving muscle',
      'Monitoring: clinical (colour, cap refill, temperature), implantable Doppler',
      'Postoperative: avoid pressure, maintain perfusion, anticoagulation protocol',
    ],
    takeHomePoints: [
      'Understanding angiosome concept is fundamental to flap surgery',
      'Venous congestion is the most common cause of free flap compromise',
      'Perforator flaps represent the evolution toward minimising donor morbidity',
      'Clinical monitoring remains the gold standard — check flaps hourly for 48 hrs',
      'Smoking cessation (minimum 4 weeks pre-op) significantly reduces flap complications',
    ],
    references: [
      'Taylor GI, Palmer JH. The vascular territories (angiosomes) of the body. Br J Plast Surg. 1987;40(2):113-141.',
      'Wei FC, Mardini S. Flaps and Reconstructive Surgery, 2nd Ed. Elsevier, 2017.',
      'Hallock GG. Further clarification of the nomenclature for compound flaps. Plast Reconstr Surg. 2006.',
      'Grabb & Smith\'s Plastic Surgery, 8th Edition. Flap Principles Chapter.',
    ],
  },

  'pressure': {
    topic: 'Pressure Ulcer Management',
    outline: [
      'Introduction — Definition and epidemiology',
      'Relevant anatomy — Pressure points',
      'Pathology — Tissue injury mechanisms',
      'Pathophysiology — Pressure-time relationship',
      'Clinical evaluation — Staging systems',
      'Investigations',
      'Treatment principles — Prevention and reconstruction',
      'Take home points',
    ],
    anatomy: [
      'Common pressure sites: sacrum, ischium, trochanter, heel, occiput',
      'Tissue layers susceptible: skin → subcutaneous fat → muscle → bone',
      'Muscle is most sensitive to ischaemia; skin is most resistant',
      'Deep tissue injury may not be apparent on surface — "iceberg" phenomenon',
      'Blood supply: capillary closing pressure ≈ 32 mmHg (Landis, 1930)',
    ],
    pathology: [
      'Tissue necrosis from sustained pressure exceeding capillary closing pressure',
      'Stage I: Non-blanchable erythema, intact skin',
      'Stage II: Partial-thickness skin loss, shallow ulcer',
      'Stage III: Full-thickness tissue loss, fat visible',
      'Stage IV: Full-thickness loss with exposed bone, tendon or muscle',
      'Unstageable: obscured by slough or eschar',
      'Deep tissue injury (DTI): Intact skin with purple/maroon discolouration',
    ],
    pathophysiology: [
      'Pressure × Time relationship (Kosiak, 1959)',
      'Sustained pressure > 32 mmHg → capillary occlusion → tissue ischaemia',
      'Shear forces — distortion of perforating vessels',
      'Friction — damage to epidermis',
      'Moisture — maceration and skin breakdown',
      'Contributing factors: malnutrition, immobility, incontinence, sensory deficit',
    ],
    clinicalEvaluation: [
      'NPUAP/EPUAP staging system (2014 updated)',
      'Braden Risk Assessment Scale (6 subscales, score ≤18 = at risk)',
      'Wound assessment: size, depth, undermining, tunnelling',
      'Wound bed: granulation, slough, necrosis, eschar',
      'Exudate: type and amount',
      'Periwound skin assessment',
      'Nutritional status: albumin, prealbumin, BMI',
      'Infection assessment: biofilm, osteomyelitis screening',
    ],
    investigations: [
      'Wound swab (after debridement) — quantitative cultures preferred',
      'Blood: FBC, albumin, prealbumin, CRP, ESR',
      'Bone biopsy — gold standard for osteomyelitis diagnosis',
      'MRI — osteomyelitis assessment (sensitivity 98%, specificity 89%)',
      'Plain radiograph — bony changes (late finding)',
    ],
    treatmentPrinciples: [
      'Prevention — pressure redistribution surfaces, 2-hourly repositioning, nutrition',
      'Wound bed preparation: TIME framework (Tissue, Infection, Moisture, Edge)',
      'Debridement: sharp, autolytic, enzymatic, biological (maggot) therapy',
      'Negative pressure wound therapy (NPWT) — accelerates granulation',
      'Surgical reconstruction: flap coverage for Stage III/IV',
      'Flap options: gluteal rotation/advancement, TFL, gracilis, biceps femoris',
      'Principle: remove bony prominence (ostectomy) + well-vascularised flap',
      'Postoperative: pressure-free rehabilitation protocol (minimum 3 weeks)',
      'Recurrence prevention: lifelong pressure management education',
    ],
    takeHomePoints: [
      'Prevention is far more effective and cost-efficient than treatment',
      'Braden score assessment should be performed on all at-risk patients',
      'Nutritional optimisation is critical for wound healing',
      'Surgical flaps are reserved for Stage III/IV after optimisation',
      'Recurrence rate is high (up to 60%) — patient education is paramount',
    ],
    references: [
      'NPUAP/EPUAP/PPPIA. Prevention and Treatment of Pressure Ulcers: Clinical Practice Guideline, 2019.',
      'Kosiak M. Etiology and Pathology of Ischemic Ulcers. Arch Phys Med Rehabil. 1959;40(2):62-69.',
      'Boyko TV et al. Review of the Current Management of Pressure Ulcers. Adv Wound Care. 2018;7(2):57-67.',
      'Grabb & Smith\'s Plastic Surgery, 8th Edition. Chapter on Pressure Sore Reconstruction.',
    ],
  },

  'skin graft': {
    topic: 'Skin Grafts — Principles and Application',
    outline: [
      'Introduction — Historical context',
      'Relevant anatomy — Skin structure',
      'Classification of skin grafts',
      'Pathophysiology — Graft take',
      'Clinical evaluation — Graft selection',
      'Investigations',
      'Treatment principles — Harvesting and application',
      'Take home points',
    ],
    anatomy: [
      'Skin thickness varies by region: eyelid (0.5 mm) to back/sole (4 mm)',
      'Epidermis: keratinocytes (90%), melanocytes, Langerhans cells, Merkel cells',
      'Dermis: papillary (fine collagen III) and reticular (coarse collagen I) layers',
      'Rete pegs — dermal-epidermal interdigitation; more rete pegs = better graft take',
      'Skin appendages reside in dermis — key for STSG donor site healing',
    ],
    pathology: [
      'STSG (split-thickness): epidermis + variable dermis (thin/intermediate/thick)',
      'FTSG (full-thickness): epidermis + entire dermis',
      'Composite grafts: skin + cartilage (e.g., auricular for nasal alar defects)',
      'Graft contraction: primary (immediate elastic recoil) and secondary (myofibroblast)',
      'STSG contracts more secondarily; FTSG contracts less',
    ],
    pathophysiology: [
      'Phases of graft take:',
      '  1. Plasmatic imbibition (0-48 hrs) — passive diffusion of nutrients',
      '  2. Inosculation (48-72 hrs) — donor-recipient vessel alignment',
      '  3. Revascularisation (day 3-7) — neovascularisation by ingrowth',
      'Causes of graft failure: haematoma, seroma, infection, shear, poor bed vascularity',
      'Grafts will NOT take on: bare bone, bare cartilage, bare tendon, irradiated tissue',
    ],
    clinicalEvaluation: [
      'Wound bed assessment — vascularity, granulation tissue quality',
      'Defect size, location, and aesthetic requirements',
      'Donor site selection based on colour match and thickness needed',
      'Patient factors: comorbidities, nutritional status, smoking',
      'FTSG preferred for face, hands, over joints (less contraction)',
      'STSG preferred for large wounds, burn coverage, temporary coverage',
    ],
    investigations: [
      'Wound swab — bacterial count <10⁵/cm² for graft take',
      'FBC, albumin — nutritional/healing capacity',
      'Wound biopsy if chronic — exclude malignancy',
    ],
    treatmentPrinciples: [
      'Wound bed preparation — debridement, infection control, granulation promotion',
      'STSG harvest: dermatome (power/manual) from thigh, buttock',
      'FTSG harvest: excision from groin, post-auricular, supraclavicular',
      'Meshing STSG (1:1.5 to 1:6) — allows drainage, greater coverage',
      'Sheet grafts for cosmetically important areas — better appearance',
      'Fixation: sutures, staples, fibrin glue, tie-over bolster dressing',
      'Immobilisation for 5-7 days — prevent shear',
      'NPWT over skin grafts — improves take rates',
      'Donor site care: alginate/foam dressings for STSG; primary closure for FTSG',
    ],
    takeHomePoints: [
      'Graft take depends on wound bed vascularity — prepare the bed',
      'Haematoma and infection are the main preventable causes of graft failure',
      'FTSG gives better cosmetic result but requires well-vascularised bed and primary donor closure',
      'Sheet grafts on the face; meshed grafts for large areas',
      'Immobilisation and careful postoperative care are critical for success',
    ],
    references: [
      'Ratner D. Skin Grafting. Semin Cutan Med Surg. 2003;22(4):295-305.',
      'Skin Graft Physiology. In: Grabb & Smith\'s Plastic Surgery, 8th Edition.',
      'Andreassi A et al. Classification and Pathophysiology of Skin Grafts. Clin Dermatol. 2005;23(4):332-337.',
    ],
  },

  'hand': {
    topic: 'Hand Injuries — Assessment and Management',
    outline: [
      'Introduction — Importance and epidemiology',
      'Relevant anatomy — Functional anatomy of the hand',
      'Pathology — Common injury patterns',
      'Pathophysiology — Healing of specialised tissues',
      'Clinical evaluation — Systematic examination',
      'Investigations',
      'Treatment principles — Reconstruction',
      'Take home points',
    ],
    anatomy: [
      'Bones: 8 carpal, 5 metacarpal, 14 phalanges',
      'Flexor tendons: FDS (splits), FDP (inserts DP) — zones I-V',
      'Extensor tendons: EDC, EIP, EDM — zones I-VIII',
      'Nerves: median (thenar, radial 3½ digits), ulnar (hypothenar, ulnar 1½ digits), radial (dorsal sensation)',
      'Arteries: radial and ulnar → superficial and deep palmar arches',
      'Pulleys: A1-A5, C1-C3 — prevent bowstringing; A2 and A4 critical',
      'Intrinsic muscles: thenar, hypothenar, lumbricals, interossei',
    ],
    pathology: [
      'Fractures — Bennett\'s, Rolando\'s, boxer\'s, mallet finger',
      'Tendon injuries — flexor (jersey finger), extensor (mallet, boutonnière)',
      'Nerve injuries — Seddon classification: neuropraxia, axonotmesis, neurotmesis',
      'Sunderland classification — 5 degrees of nerve injury',
      'Replantation injuries — sharp vs avulsion mechanism',
      'Dupuytren\'s contracture — fibromatosis of palmar fascia',
    ],
    pathophysiology: [
      'Tendon healing — intrinsic (tenocyte) and extrinsic (inflammatory) pathways',
      'Nerve regeneration — 1 mm/day distally from repair site',
      'Wallerian degeneration distal to nerve transection',
      'Oedema → stiffness → fibrosis cascade — early mobilisation prevents',
      'Reperfusion injury in replantation — "no-reflow" phenomenon',
    ],
    clinicalEvaluation: [
      'History: mechanism, hand dominance, occupation, tetanus status',
      'Inspection: wounds, deformity, swelling, cascade alignment',
      'Vascular: Allen\'s test, capillary refill, digital perfusion',
      'Neurological: two-point discrimination (<6mm normal), Semmes-Weinstein monofilament',
      'Tendon testing: FDS (hold adjacent fingers extended), FDP (isolate DIP)',
      'Extensor testing: each tendon zone independently',
      'Bone: tenderness, deformity, rotational alignment (finger cascade)',
    ],
    investigations: [
      'X-ray: AP, lateral, oblique views minimum',
      'CT: complex fractures, carpal injuries',
      'MRI: soft tissue, TFCC tears, occult fractures',
      'Nerve conduction studies — chronic/compression neuropathies',
      'Angiography — vascular injuries if needed',
    ],
    treatmentPrinciples: [
      'Emergency: haemorrhage control, wound irrigation, tetanus prophylaxis',
      'Fractures: reduction and fixation (K-wires, plates, screws)',
      'Flexor tendon repair: modified Kessler + epitendinous suture; early active mobilisation',
      'Extensor tendon: zone-specific repair and splinting protocols',
      'Nerve repair: direct epineural repair (tension-free); conduits/grafts if gap',
      'Replantation indications: thumb, multiple digits, paediatric, sharp mechanism',
      'Rehabilitation: early protected mobilisation is critical',
      'Splinting: position of safe immobilisation (Edinburgh position) — MCP 70-90° flexion, IP extension',
    ],
    takeHomePoints: [
      'Document hand injuries meticulously — medicolegal implications',
      'Test EACH tendon and nerve individually',
      'FDP testing: hold PIP in extension, ask patient to flex DIP',
      'Early mobilisation prevents stiffness — "life is motion"',
      'Replantation: keep amputated part in moist gauze in plastic bag on ice (NOT directly on ice)',
    ],
    references: [
      'Green\'s Operative Hand Surgery, 8th Edition. Elsevier, 2022.',
      'Kleinert HE, Verdan C. Report of the Committee on Tendon Injuries. J Hand Surg. 1983.',
      'Sunderland S. A Classification of Peripheral Nerve Injuries. Brain. 1951;74(4):491-516.',
      'BSSH Standards for Hand Trauma. British Society for Surgery of the Hand.',
    ],
  },
};

/** Get list of available template topic names */
export function getAvailableTopics(): string[] {
  return Object.values(TOPIC_TEMPLATES).map(t => t.topic);
}

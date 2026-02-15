/**
 * Medical Content Knowledge Base
 * Provides auto-generated WHO-standard clinical content for presentations.
 * Content sourced from standard plastic surgery / surgical curricula.
 */

export interface ClinicalTopicContent {
  anatomy: string[];
  pathology: string[];
  pathophysiology: string[];
  clinicalEvaluation: string[];
  labEvaluation: string[];
  treatmentPrinciples: string[];
  takeHomePoints: string[];
  references: string[];
}

// ──────────────────────────────────────────────────────
// Topic → Content map (expandable)
// ──────────────────────────────────────────────────────

const topicDatabase: Record<string, ClinicalTopicContent> = {
  keloid: {
    anatomy: [
      'Skin composed of epidermis, dermis, and hypodermis',
      'Dermis contains collagen (types I & III), elastin fibers, fibroblasts',
      'Reticular dermis — site of abnormal collagen deposition in keloids',
      'Blood supply via subdermal and dermal plexuses',
      'Nerve supply — free nerve endings responsible for pruritus and pain',
      'Keloids extend beyond original wound margins into surrounding normal tissue',
    ],
    pathology: [
      'Excessive type I and III collagen deposition',
      'Thick, hyalinized collagen bundles arranged in whorls and nodules',
      'Increased fibroblast proliferation with decreased apoptosis',
      'Overexpression of TGF-β1, PDGF, and IL-6',
      'Histology: tongue-like advancing edge, mucin deposits, keloidal collagen',
      'Distinguishable from hypertrophic scars by extension beyond wound borders',
    ],
    pathophysiology: [
      'Dysregulated wound healing — prolonged inflammatory phase',
      'Imbalance between collagen synthesis and degradation (↑ MMP-2, ↓ MMP-9)',
      'Aberrant TGF-β/Smad signaling pathway',
      'Genetic predisposition — HLA and susceptibility loci identified',
      'Higher incidence in African, Asian, and Hispanic populations',
      'Mechanical tension at wound site contributes to keloid formation',
      'Mast cell degranulation and histamine release → pruritus',
    ],
    clinicalEvaluation: [
      'History: previous keloids, family history, ethnicity, site of injury',
      'Symptom assessment: pruritus, pain, tenderness, burning',
      'Physical exam: size, shape, color, texture, borders beyond wound',
      'Vancouver Scar Scale (VSS) or Patient and Observer Scar Assessment Scale (POSAS)',
      'Photographic documentation — standardized views with ruler',
      'Functional assessment — joint mobility if over joints',
      'Psychosocial impact assessment — quality of life questionnaires',
    ],
    labEvaluation: [
      'No specific laboratory tests for keloid diagnosis',
      'Biopsy if diagnostic uncertainty (rule out dermatofibrosarcoma protuberans)',
      'Pre-treatment labs for triamcinolone: blood glucose (diabetics)',
      'If surgical excision planned: FBC, coagulation profile',
      'Consider hormonal panel if keloids worsen during pregnancy/puberty',
    ],
    treatmentPrinciples: [
      'Prevention is the best treatment — avoid unnecessary procedures in predisposed patients',
      'First-line: Intralesional corticosteroids (Triamcinolone Acetonide 10–40 mg/mL)',
      'Silicone gel sheets/ointment — minimum 12 hours/day for 3–6 months',
      'Pressure therapy — 24–30 mmHg for 6–12 months',
      'Combination therapy yields best results (surgery + adjuvant)',
      'Surgical excision + immediate post-op radiation (within 24–48 hrs)',
      'Intralesional 5-FU (50 mg/mL) ± corticosteroids for recalcitrant keloids',
      'Cryotherapy — intralesional or contact, 2–3 freeze-thaw cycles',
      'Laser therapy — Pulsed dye laser (585/595 nm) or Nd:YAG',
      'Follow-up: minimum 12–24 months to monitor for recurrence',
    ],
    takeHomePoints: [
      'Keloids are a fibroproliferative disorder of wound healing unique to humans',
      'They extend beyond original wound margins — distinguishing them from hypertrophic scars',
      'Genetic predisposition exists — family history and ethnicity are key risk factors',
      'Combination therapy (multimodal approach) achieves best outcomes',
      'Recurrence rate is high — long-term follow-up is essential',
      'Patient education on prevention is paramount in predisposed individuals',
    ],
    references: [
      'Ogawa R. Keloid and Hypertrophic Scars Are the Result of Chronic Inflammation. Plast Reconstr Surg. 2017;139(1):e21–e30.',
      'WHO Guidelines on Basic Training and Safety in Plastic Surgery. World Health Organization.',
      'Berman B, et al. Keloids and Hypertrophic Scars: Pathophysiology, Classification, and Treatment. Dermatol Surg. 2017;43:S3–S18.',
      'Gauglitz GG, et al. Hypertrophic Scarring and Keloids: Pathomechanisms and Current and Emerging Treatment Strategies. Mol Med. 2011;17(1-2):113–125.',
      'Arno AI, et al. Up-to-Date Approach to Manage Keloids and Hypertrophic Scars. Burns. 2014;40(7):1255–1266.',
    ],
  },

  burn: {
    anatomy: [
      'Skin layers: epidermis (stratified squamous epithelium), dermis, hypodermis',
      'Epidermis — barrier function, melanocytes, Langerhans cells',
      'Dermis — collagen, elastin, hair follicles, sweat glands, nerve endings',
      'Skin appendages (hair follicles, glands) serve as sources for re-epithelialization',
      'Subdermal fat — insulation, energy storage, cushioning',
      "Zones of burn injury: zone of coagulation, stasis, hyperemia (Jackson's model)",
    ],
    pathology: [
      'Superficial (first-degree): epidermal damage only — erythema, pain',
      'Partial thickness (second-degree): involves dermis — blisters, wet appearance',
      'Full thickness (third-degree): entire dermis destroyed — white/brown, insensate',
      'Fourth-degree: extends to muscle, fascia, bone',
      'Eschar formation: denatured necrotic tissue',
      'Histology: coagulative necrosis, vascular thrombosis, inflammatory infiltrate',
    ],
    pathophysiology: [
      'Thermal injury → protein denaturation → cell death',
      'Systemic inflammatory response (SIRS) in major burns (>20% TBSA)',
      'Massive capillary leak → edema, hypovolemia, shock',
      'Hypermetabolic response — can persist 24 months post-burn',
      'Immunosuppression → increased infection susceptibility',
      'Wound contraction and hypertrophic scarring in healing burns',
    ],
    clinicalEvaluation: [
      'ABCDE primary survey — airway compromise from inhalation injury',
      'TBSA estimation: Rule of Nines, Lund-Browder chart (children), palmar method',
      'Burn depth assessment: clinical appearance, capillary refill, sensation',
      'Evaluate for associated injuries: fractures, inhalation, electrical',
      'Carboxyhemoglobin levels if smoke inhalation suspected',
      'Circumferential burns: assess for compartment syndrome → escharotomy',
    ],
    labEvaluation: [
      'FBC (hemoconcentration initially, then anemia)',
      'U&E, creatinine (renal function monitoring)',
      'Arterial blood gases + carboxyhemoglobin',
      'Serum lactate (tissue perfusion)',
      'Serum albumin (nutritional status, edema management)',
      'Blood cultures if sepsis suspected',
      'Urinalysis — myoglobinuria in electrical/deep burns',
    ],
    treatmentPrinciples: [
      'Fluid resuscitation: Parkland formula (4 mL × kg × %TBSA, half in first 8 hrs)',
      'Wound care: debridement, silver sulfadiazine or mafenide acetate',
      'Early excision and grafting (within 72 hrs) for deep burns',
      'Split-thickness skin grafts (STSG) for wound coverage',
      'Nutritional support: high-protein, high-calorie diet (Curreri formula)',
      'Pain management: multimodal — opioids, NSAIDs, anxiolytics for procedures',
      'Compression garments for scar management post-healing',
      'Rehabilitation: ROM exercises, splinting, psychosocial support',
    ],
    takeHomePoints: [
      'Burns are a leading cause of morbidity worldwide — prevention is key',
      'Accurate TBSA and depth assessment guides fluid resuscitation and surgical management',
      'Early excision and grafting improves survival in major burns',
      'Inhalation injury significantly increases mortality — always assess the airway',
      'Multidisciplinary team approach essential for optimal outcomes',
      'Long-term follow-up needed for scar management and psychological support',
    ],
    references: [
      'ISBI Practice Guidelines for Burn Care. Burns. 2016;42(5):953–1021.',
      'WHO Burns Fact Sheet. World Health Organization. 2023.',
      'Herndon DN. Total Burn Care. 5th ed. Elsevier; 2018.',
      'Jeschke MG, et al. Burn injury. Nat Rev Dis Primers. 2020;6:11.',
    ],
  },

  'wound care': {
    anatomy: [
      'Skin: largest organ — epidermis, dermis, subcutaneous tissue',
      'Wound healing structures: fibroblasts, keratinocytes, endothelial cells',
      'Extracellular matrix: collagen, fibronectin, glycosaminoglycans',
      'Vascular supply critical for wound healing — angiogenesis',
      'Peripheral nerves — sensory feedback for wound protection',
      'Lymphatic drainage — essential for edema control and immune function',
    ],
    pathology: [
      'Acute wounds: surgical, traumatic — follow normal healing phases',
      'Chronic wounds: fail to progress through orderly healing phases',
      'Biofilm formation — polymicrobial communities resistant to antibiotics',
      'Senescent cell accumulation in chronic wound beds',
      'Fibrosis and abnormal collagen deposition in non-healing wounds',
      'Common chronic wound types: diabetic ulcers, venous ulcers, pressure injuries',
    ],
    pathophysiology: [
      'Normal healing phases: hemostasis → inflammation → proliferation → remodeling',
      'Chronic wounds stall in prolonged inflammatory phase',
      'Elevated MMPs (especially MMP-9) degrade growth factors and ECM',
      'Ischemia/hypoxia impairs fibroblast and macrophage function',
      'Bacterial burden exceeds host immune capacity → critical colonization',
      'Systemic factors: diabetes, malnutrition, immunosuppression, vascular disease',
    ],
    clinicalEvaluation: [
      'Wound assessment: MEASURE — Measure, Exudate, Appearance, Suffering, Undermining, Re-evaluation, Edge',
      'Wound bed preparation: TIME framework (Tissue, Infection, Moisture, Edge)',
      'Assess wound dimensions: length × width × depth',
      'Document wound characteristics: color, odor, exudate type/amount',
      'Evaluate periwound skin: maceration, erythema, induration',
      'Vascular assessment: ABI (ankle-brachial index) for lower limb wounds',
      'Nutritional screening: MUST score, albumin, prealbumin',
    ],
    labEvaluation: [
      'Wound swab culture and sensitivity (if infection suspected)',
      'FBC — WCC for infection, Hb for anemia',
      'HbA1c — glycemic control in diabetic patients',
      'Serum albumin and prealbumin — nutritional status',
      'CRP and ESR — inflammatory markers',
      'Wound biopsy for histology if malignancy suspected (Marjolin ulcer)',
    ],
    treatmentPrinciples: [
      'Wound bed preparation: debridement (surgical, autolytic, enzymatic)',
      'Moisture balance: appropriate dressing selection based on wound characteristics',
      'Infection control: topical antiseptics, systemic antibiotics if needed',
      'Negative Pressure Wound Therapy (NPWT) for complex wounds',
      'Offloading for diabetic foot ulcers — total contact casting',
      'Compression therapy for venous leg ulcers (if ABI > 0.8)',
      'Skin grafting or flap coverage for non-healing wounds',
      'Address systemic factors: nutrition, glucose control, smoking cessation',
      'Patient education: wound care, signs of infection, follow-up',
    ],
    takeHomePoints: [
      'Wound healing is a complex, ordered process — disruption leads to chronicity',
      'Systematic wound assessment using validated tools guides management',
      'Debridement and wound bed preparation are foundational to healing',
      'Address underlying etiology — not just the wound surface',
      'Multidisciplinary approach optimizes outcomes for complex wounds',
      'Patient education and self-care support reduce recurrence',
    ],
    references: [
      'Schultz GS, et al. Wound bed preparation: a systematic approach to wound management. Wound Repair Regen. 2003;11:S1–S28.',
      'WHO Guidelines on Prevention and Management of Wound Infections. 2016.',
      'Frykberg RG, Banks J. Challenges in the Treatment of Chronic Wounds. Adv Wound Care. 2015;4(9):560–582.',
      'Sen CK. Human Wound and Its Burden: Updated 2020 Compendium of Estimates. Adv Wound Care. 2021;10(5):281–292.',
    ],
  },

  'pressure sore': {
    anatomy: [
      'Pressure injuries occur over bony prominences: sacrum, ischial tuberosities, heels, trochanters',
      'Tissue layers at risk: skin → subcutaneous fat → muscle → periosteum',
      'Muscle is most susceptible to pressure-induced ischemia',
      'Blood supply compromised when external pressure exceeds capillary closing pressure (~32 mmHg)',
      'Shear forces damage perforating vessels in subcutaneous tissue',
      'Anatomical sites vary by patient position (supine vs. seated vs. lateral)',
    ],
    pathology: [
      'Stage 1: Non-blanchable erythema of intact skin',
      'Stage 2: Partial-thickness skin loss — dermis exposed',
      'Stage 3: Full-thickness skin loss — subcutaneous fat visible',
      'Stage 4: Full-thickness tissue loss — tendon, muscle, or bone exposed',
      'Unstageable: obscured by slough or eschar',
      'Deep tissue injury: persistent non-blanchable deep purple discoloration',
    ],
    pathophysiology: [
      'Sustained pressure → tissue ischemia → cellular death',
      'Reperfusion injury upon pressure relief → free radical damage',
      'Shear forces deform and occlude blood vessels',
      'Moisture (incontinence) weakens skin barrier → maceration',
      'Friction removes superficial skin layers',
      'Malnutrition impairs tissue resilience and healing capacity',
    ],
    clinicalEvaluation: [
      'Risk assessment: Braden Scale (sensory perception, moisture, activity, mobility, nutrition, friction/shear)',
      'Wound assessment: location, stage, dimensions, wound bed appearance',
      'Assess for undermining and tunneling',
      'Pain assessment — particularly important in Stage 1 and 2 injuries',
      'Nutritional assessment: BMI, dietary intake, serum markers',
      'Evaluate contributing factors: immobility, incontinence, comorbidities',
    ],
    labEvaluation: [
      'Serum albumin (<3.5 g/dL indicates malnutrition)',
      'Prealbumin (more sensitive short-term nutritional marker)',
      'FBC — anemia, infection markers',
      'HbA1c in diabetic patients',
      'Wound culture if signs of clinical infection',
      'CRP/ESR for systemic infection assessment',
    ],
    treatmentPrinciples: [
      'Prevention is paramount — repositioning every 2 hours',
      'Pressure redistribution surfaces (support surfaces, specialty mattresses)',
      'Wound debridement — remove necrotic tissue',
      'Moist wound healing with appropriate dressings',
      'Nutritional optimization: high-protein diet, supplements',
      'Incontinence management to protect skin',
      'Surgical reconstruction for Stage 3/4: flap closure (fasciocutaneous, musculocutaneous)',
      'Common flaps: gluteal rotation flap, posterior thigh flap, tensor fascia lata flap',
    ],
    takeHomePoints: [
      'Pressure injuries are largely preventable with systematic risk assessment',
      'Braden Scale should be used on all at-risk patients',
      'Prevention is more cost-effective than treatment',
      'Multidisciplinary approach: nursing, nutrition, surgery, rehabilitation',
      'Surgical reconstruction reserved for deep, non-healing wounds',
      'Patient and caregiver education is essential for prevention',
    ],
    references: [
      'European Pressure Ulcer Advisory Panel (EPUAP) Guidelines. 2019.',
      'National Pressure Injury Advisory Panel (NPIAP) Staging System. 2019.',
      'WHO Patient Safety Curriculum Guide. Pressure Injury Prevention.',
      'Bauer K, et al. Pressure ulcers in the United States\' inpatient population. J Patient Saf. 2016;12(4):e16–e22.',
    ],
  },

  'cleft lip': {
    anatomy: [
      'Upper lip: orbicularis oris muscle, vermilion, white roll (vermilion border), philtrum',
      'Nasal anatomy: lower lateral cartilages, columella, alar base, nasal floor',
      'Embryology: fusion of medial nasal prominence with maxillary prominence (weeks 4–7)',
      'Cleft types: unilateral incomplete, unilateral complete, bilateral',
      'Alveolar involvement: extends through the alveolar ridge',
      'Associated structures: nose, primary palate, secondary palate',
    ],
    pathology: [
      'Failure of fusion of facial prominences during embryogenesis',
      'Disrupted orbicularis oris muscle continuity',
      'Abnormal insertion of muscle fibers along cleft margins',
      'Associated nasal cartilage deformity (slumped alar cartilage)',
      'Alveolar cleft: deficiency of bone in the anterior maxilla',
      'Veau classification: Class I–IV based on extent of cleft palate involvement',
    ],
    pathophysiology: [
      'Multifactorial etiology: genetic + environmental factors',
      'Gene candidates: IRF6, MSX1, TGFB3, FGFR mutations',
      'Environmental risk factors: folate deficiency, smoking, alcohol, anticonvulsants',
      'Maternal diabetes and advanced maternal age increase risk',
      'Incidence: ~1/700 live births (varies by ethnicity)',
      'Higher incidence in Asian and Native American populations',
    ],
    clinicalEvaluation: [
      'Complete clinical assessment of cleft morphology',
      'Evaluate feeding difficulties — inability to create suction',
      'Assess speech development (velopharyngeal insufficiency)',
      'Hearing assessment — increased risk of otitis media with effusion',
      'Rule of 10s for surgical timing: 10 weeks, 10 lbs, Hb 10 g/dL',
      'Multidisciplinary cleft team evaluation',
      'Dental/orthodontic assessment — timing of alveolar bone grafting',
    ],
    labEvaluation: [
      'Pre-operative workup: FBC (Hb ≥ 10 g/dL), blood group and cross-match',
      'Genetics referral for syndromic evaluation (Pierre Robin, Van der Woude)',
      'Audiometry for hearing assessment',
      'Consider genetic testing: chromosomal microarray if syndromic features',
      'Nutritional assessment if poor weight gain',
    ],
    treatmentPrinciples: [
      'Pre-surgical: nasoalveolar molding (NAM), lip taping',
      'Lip repair at 3 months: Millard rotation-advancement, Fisher technique',
      'Palate repair at 9–12 months: Furlow double-opposing Z-plasty, von Langenbeck',
      'Alveolar bone grafting at 8–11 years (mixed dentition)',
      'Secondary rhinoplasty at skeletal maturity',
      'Orthognathic surgery if maxillary hypoplasia (Le Fort I)',
      'Speech therapy throughout childhood',
      'VPI management: speech therapy, pharyngoplasty, or pharyngeal flap',
      'Psychosocial support: counseling for patient and family',
    ],
    takeHomePoints: [
      'Cleft lip/palate is the most common congenital craniofacial anomaly',
      'Multidisciplinary team approach is the standard of care',
      'Timing of interventions follows established protocols (Rule of 10s)',
      'Comprehensive care addresses feeding, speech, hearing, and psychosocial needs',
      'Long-term follow-up until skeletal maturity is essential',
      'Genetic counseling should be offered to families',
    ],
    references: [
      'WHO Global Report on Orofacial Clefts. World Health Organization.',
      'Millard DR. Cleft Craft: The Evolution of Its Surgery. 3 vols. Little, Brown; 1976–1980.',
      'Fisher DM. Unilateral Cleft Lip Repair: An Anatomical Subunit Approximation Technique. Plast Reconstr Surg. 2005;116:61–71.',
      'ACPA Parameters for Evaluation and Treatment of Patients with Cleft Lip/Palate. Cleft Palate Craniofac J. 2018.',
    ],
  },

  'skin cancer': {
    anatomy: [
      'Epidermis: keratinocytes, melanocytes, Langerhans cells, Merkel cells',
      'Dermoepidermal junction — basement membrane zone',
      'Dermis: papillary (superficial) and reticular (deep)',
      'Lymphatic drainage routes — sentinel lymph node concept',
      'Sun-exposed areas: face, ears, scalp, neck, dorsum of hands/forearms',
      'Aesthetic subunits of the face — relevant for reconstruction',
    ],
    pathology: [
      'Basal Cell Carcinoma (BCC): most common, locally invasive, rarely metastasizes',
      'Squamous Cell Carcinoma (SCC): second most common, metastatic potential',
      'Melanoma: arising from melanocytes, highest mortality risk',
      'BCC subtypes: nodular, superficial, morpheaform/infiltrative',
      'SCC grading: well to poorly differentiated',
      'Melanoma: Breslow depth and Clark levels, ulceration, mitotic rate',
    ],
    pathophysiology: [
      'UV radiation → DNA damage (pyrimidine dimers) → mutation accumulation',
      'BCC: Hedgehog (Hh) signaling pathway dysregulation, PTCH1 mutations',
      'SCC: p53 tumor suppressor gene mutations, immune suppression',
      'Melanoma: BRAF (V600E), NRAS, KIT mutations',
      'Risk factors: fair skin, UV exposure, immunosuppression, history of sunburns',
      'Organ transplant recipients: 65× increased SCC risk',
    ],
    clinicalEvaluation: [
      'ABCDE criteria for melanoma: Asymmetry, Border, Color, Diameter, Evolution',
      'Dermoscopy examination for suspicious lesions',
      'Complete skin examination including scalp, nails, mucosae',
      'Regional lymph node examination',
      'Biopsy: excisional (preferred for melanoma), punch, shave',
      'Staging workup (CT, PET/CT, sentinel lymph node biopsy) for melanoma',
    ],
    labEvaluation: [
      'Histopathological examination of biopsy specimen',
      'Immunohistochemistry: S100, HMB45, Melan-A for melanoma',
      'LDH — prognostic marker in advanced melanoma',
      'BRAF mutation testing for advanced melanoma (guides targeted therapy)',
      'Sentinel lymph node biopsy for melanoma >0.8 mm Breslow depth',
      'Pre-operative labs: FBC, LFTs, chest X-ray for staging',
    ],
    treatmentPrinciples: [
      'Surgical excision with appropriate margins is the gold standard',
      'BCC: 3–4 mm clinical margins; Mohs surgery for high-risk/facial lesions',
      'SCC: 4–6 mm margins; consider adjuvant radiation for perineural invasion',
      'Melanoma margins: in situ (5 mm), <1 mm (1 cm), 1–2 mm (1–2 cm), >2 mm (2 cm)',
      'Sentinel lymph node biopsy for staging in melanoma',
      'Reconstruction: primary closure, skin grafts, local flaps, free flaps',
      'Advanced melanoma: immunotherapy (anti-PD-1, anti-CTLA-4), BRAF/MEK inhibitors',
      'Follow-up: regular skin surveillance, sun protection education',
    ],
    takeHomePoints: [
      'Skin cancer is the most common malignancy worldwide',
      'Prevention: sun protection, avoidance of tanning beds, regular skin checks',
      'Early detection dramatically improves survival — especially for melanoma',
      'Multidisciplinary tumor board for complex and advanced cases',
      'Reconstruction should follow oncologic principles — margin clearance first',
      'Lifelong surveillance required for all skin cancer patients',
    ],
    references: [
      'WHO Classification of Skin Tumours. 5th ed. IARC; 2023.',
      'NCCN Clinical Practice Guidelines in Oncology: Melanoma. Version 2.2023.',
      'NCCN Clinical Practice Guidelines: Basal Cell and Squamous Cell Skin 2023.',
      'Swetter SM, et al. Guidelines of care for melanoma. J Am Acad Dermatol. 2019;80(6):1489–1504.',
    ],
  },

  'hand surgery': {
    anatomy: [
      'Bones: 8 carpal bones, 5 metacarpals, 14 phalanges',
      'Flexor tendons: FDS (superficialis) and FDP (profundus) — Verdan zones I–V',
      'Extensor tendons: 6 extensor compartments at the wrist',
      'Nerves: median (motor: LOAF muscles, sensation: palmar 3.5 digits), ulnar, radial',
      'Arteries: radial and ulnar → superficial and deep palmar arches',
      'Intrinsic muscles: thenar, hypothenar, lumbricals, interossei',
    ],
    pathology: [
      'Flexor tendon injuries: sharp lacerations, closed avulsion (Jersey finger)',
      'Extensor tendon injuries: mallet finger, boutonniere deformity, swan neck',
      'Nerve injuries: Seddon classification (neurapraxia, axonotmesis, neurotmesis)',
      'Dupuytren contracture: progressive palmar fibromatosis',
      'Fractures: distal phalanx tuft, metacarpal neck (boxer\'s), scaphoid',
      'Infections: felon, paronychia, flexor tenosynovitis (Kanavel signs)',
    ],
    pathophysiology: [
      'Tendon healing: intrinsic (tenocyte proliferation) + extrinsic (synovial ingrowth)',
      'Challenge: balance between tendon healing and adhesion prevention',
      'Nerve regeneration: Wallerian degeneration → axonal sprouting (1 mm/day)',
      'Dupuytren: myofibroblast-mediated contraction, TGF-β driven fibrosis',
      'Compartment syndrome: increased compartment pressure → ischemia → necrosis',
      'Replantation biology: ischemia time, warm vs cold preservation',
    ],
    clinicalEvaluation: [
      'Systematic hand examination: inspect, palpate, motor, sensory, vascular',
      'Flexor tendon testing: FDS (block adjacent fingers), FDP (DIP flexion)',
      'Extensor lag assessment at each joint',
      'Nerve assessment: two-point discrimination (<6 mm normal), motor testing',
      'Allen test for ulnar/radial artery patency',
      'Kanavel signs for flexor tenosynovitis: fusiform swelling, flexed posture, tenderness along sheath, pain on passive extension',
    ],
    labEvaluation: [
      'X-rays: AP and lateral views of hand/wrist/digit',
      'Pre-operative workup: FBC, coagulation profile',
      'Nerve conduction studies / EMG for chronic nerve compressions',
      'CT scan for complex fractures (scaphoid, distal radius)',
      'MRI for suspected scapholunate ligament injury or occult fractures',
    ],
    treatmentPrinciples: [
      'Flexor tendon repair: core suture (4-strand Kessler) + epitendinous suture',
      'Post-repair: early active motion protocol (reduces adhesions)',
      'Extensor tendon: zone-dependent management (splinting vs. repair)',
      'Nerve repair: primary repair within 72 hours preferred, tension-free coaptation',
      'Nerve grafting (sural nerve) for gaps >2 cm',
      'Dupuytren: Collagenase injection (Xiapex), fasciotomy, or fasciectomy',
      'Digital replantation: indications — thumb, multiple digits, children, sharp amputations',
      'Hand therapy is integral to all hand surgery outcomes',
    ],
    takeHomePoints: [
      'Detailed knowledge of hand anatomy is essential for proper assessment and repair',
      'Systematic examination prevents missed injuries',
      'Early mobilization after tendon repair reduces adhesion formation',
      'Nerve repair timing and technique significantly affect outcomes',
      'Hand therapy is as important as the surgical procedure',
      'Proper splinting prevents secondary deformities during healing',
    ],
    references: [
      'Green\'s Operative Hand Surgery. 8th ed. Elsevier; 2022.',
      'Tang JB. Recent Developments in Flexor Tendon Repair. Hand Clin. 2017;33(1):185–197.',
      'BSSH Standards for Hand Surgery: Best Practice. British Society for Surgery of the Hand.',
      'Wolfe SW, et al. Green\'s Operative Hand Surgery. Elsevier; 2022.',
    ],
  },

  flap: {
    anatomy: [
      'Flap blood supply: random-pattern (subdermal plexus) vs. axial-pattern (named vessel)',
      'Angiosome concept — defined vascular territories (Taylor & Palmer)',
      'Fasciocutaneous flaps: skin + fascia, supplied by septocutaneous perforators',
      'Muscle flaps: supplied by dominant and minor pedicles (Mathes & Nahai classification)',
      'Perforator flaps: based on single perforating vessel (e.g., DIEP, ALT)',
      'Free flaps: tissue transferred with microvascular anastomosis at recipient site',
    ],
    pathology: [
      'Flap failure: arterial insufficiency (pale, cool) vs. venous congestion (purple, swollen)',
      'Partial flap necrosis: distal tip necrosis in random-pattern flaps',
      'Fat necrosis: palpable firmness, may require excision',
      'Hematoma under flap — most common early complication requiring re-exploration',
      'Infection: increased risk in contaminated wounds or immunocompromised patients',
      'Flap contracture: secondary wound contracture reducing functional outcome',
    ],
    pathophysiology: [
      'Flap survival depends on adequate perfusion pressure and venous drainage',
      'Length:width ratio — random flaps limited by subdermal plexus reach',
      'Ischemia-reperfusion injury in free flaps after microvascular anastomosis',
      'Chemical mediators: prostaglandins, thromboxane, nitric oxide affect flap perfusion',
      'Delay phenomenon: improved flap survival by staged interruption of blood supply',
      'Smoking: nicotine causes vasospasm → increased flap failure risk',
    ],
    clinicalEvaluation: [
      'Pre-operative: assess defect dimensions, tissue requirements, recipient vessels',
      'Donor site morbidity assessment',
      'Handheld Doppler for perforator localization',
      'CT angiography for perforator flap planning',
      'Post-operative flap monitoring: color, capillary refill, temperature, turgor, Doppler signal',
      'Monitoring protocol: every 1 hour × 24 hrs, then every 2 hours × 48 hrs',
    ],
    labEvaluation: [
      'Pre-operative: FBC, coagulation profile, blood group and cross-match',
      'HbA1c for diabetic patients — glycemic optimization',
      'Nutritional markers: albumin, prealbumin',
      'CT angiography: identifies perforators and recipient vessels',
      'Duplex ultrasound for lower limb venous assessment (if lower limb reconstruction)',
    ],
    treatmentPrinciples: [
      'Reconstructive ladder: direct closure → skin graft → local flap → regional flap → free flap',
      'Reconstructive elevator: select the optimal reconstruction for each defect',
      'Free flap anastomosis: end-to-end or end-to-side, 9-0 or 10-0 nylon',
      'Common free flaps: ALT, DIEP, radial forearm, fibula, latissimus dorsi',
      'Local flaps: rotation, transposition, advancement, interpolation',
      'Post-op: avoid pressure on flap, keep warm, anticoagulation (controversial)',
      'Salvage rate for free flap compromise: 50–75% if detected within 6 hours',
      'Smoking cessation minimum 4 weeks pre-operatively',
    ],
    takeHomePoints: [
      'Understanding flap blood supply is fundamental to flap selection',
      'The reconstructive ladder/elevator guides surgical decision-making',
      'Free flap monitoring in the first 72 hours is critical for salvage',
      'Know the anatomy of common workhorse flaps (ALT, DIEP, radial forearm)',
      'Donor site morbidity must be considered in flap selection',
      'Multidisciplinary planning optimizes outcomes for complex reconstruction',
    ],
    references: [
      'Taylor GI, Palmer JH. The Vascular Territories (Angiosomes) of the Body. Br J Plast Surg. 1987;40(2):113–141.',
      'Mathes SJ, Nahai F. Classification of the Vascular Anatomy of Muscles. Plast Reconstr Surg. 1981;67(2):177–187.',
      'Wei FC, Mardini S. Flaps and Reconstructive Surgery. 2nd ed. Elsevier; 2017.',
      'Granzow JW, et al. The Free Anterolateral Thigh Flap. Clin Plast Surg. 2020;47(1):63–75.',
    ],
  },

  default: {
    anatomy: [
      'Please specify the topic for relevant surgical anatomy content',
      'General surgical anatomy principles apply',
      'Understanding of tissue planes, blood supply, and innervation is essential',
    ],
    pathology: [
      'Topic-specific pathology will be generated based on the clinical subject',
      'Standard histopathological assessment guides diagnosis',
    ],
    pathophysiology: [
      'Topic-specific pathophysiology based on the underlying condition',
      'Understanding disease mechanisms guides treatment approach',
    ],
    clinicalEvaluation: [
      'Comprehensive history taking: presenting complaint, HPC, PMH, drug history, allergies',
      'Systematic physical examination appropriate to the condition',
      'Photographic documentation with standardized views',
      'Validated assessment tools/scoring systems when available',
    ],
    labEvaluation: [
      'Pre-operative investigations: FBC, U&E, coagulation profile, blood group',
      'Condition-specific laboratory tests',
      'Imaging studies as indicated',
    ],
    treatmentPrinciples: [
      'Evidence-based management following established guidelines',
      'Conservative management considered before surgical intervention',
      'Informed consent with discussion of risks, benefits, and alternatives',
      'Multidisciplinary approach for complex cases',
    ],
    takeHomePoints: [
      'Thorough assessment guides appropriate management',
      'Evidence-based practice improves patient outcomes',
      'Multidisciplinary team involvement is essential',
    ],
    references: [
      'WHO Surgical Safety Checklist. World Health Organization.',
      'Grabb and Smith\'s Plastic Surgery. 8th ed. Wolters Kluwer; 2020.',
    ],
  },
};

/**
 * Find the best matching topic content for a given search string.
 */
export function getTopicContent(topic: string): ClinicalTopicContent {
  const normalized = topic.toLowerCase().trim();

  // Exact match
  if (topicDatabase[normalized]) return topicDatabase[normalized];

  // Partial match
  for (const [key, value] of Object.entries(topicDatabase)) {
    if (key === 'default') continue;
    if (normalized.includes(key) || key.includes(normalized)) return value;
  }

  // Keyword match
  const keywords: Record<string, string> = {
    keloid: 'keloid',
    scar: 'keloid',
    hypertrophic: 'keloid',
    burn: 'burn',
    scald: 'burn',
    wound: 'wound care',
    ulcer: 'wound care',
    diabetic: 'wound care',
    venous: 'wound care',
    pressure: 'pressure sore',
    decubitus: 'pressure sore',
    bedsore: 'pressure sore',
    cleft: 'cleft lip',
    palate: 'cleft lip',
    cancer: 'skin cancer',
    melanoma: 'skin cancer',
    bcc: 'skin cancer',
    scc: 'skin cancer',
    basal: 'skin cancer',
    squamous: 'skin cancer',
    hand: 'hand surgery',
    tendon: 'hand surgery',
    finger: 'hand surgery',
    nerve: 'hand surgery',
    dupuytren: 'hand surgery',
    flap: 'flap',
    graft: 'flap',
    reconstruction: 'flap',
    microsurgery: 'flap',
    free: 'flap',
    perforator: 'flap',
  };

  for (const [keyword, topicKey] of Object.entries(keywords)) {
    if (normalized.includes(keyword)) {
      return topicDatabase[topicKey];
    }
  }

  return topicDatabase['default'];
}

/**
 * Get all available topic names.
 */
export function getAvailableTopics(): string[] {
  return Object.keys(topicDatabase).filter((k) => k !== 'default');
}

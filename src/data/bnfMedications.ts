// Comprehensive BNF Medication Catalog
// Based on British National Formulary (BNF) latest edition
// Organized by categories relevant to Plastic Surgery practice

export interface BNFMedication {
  name: string;
  genericName: string;
  category: string;
  subcategory: string;
  formulations: string[];
  dosages: DosageInfo[];
  routes: string[];
  frequencies: string[];
  gfrAdjustments: GFRAdjustment[];
  warnings: string[];
  sideEffects: string[];
  contraindications: string[];
  interactions: string[];
  pregnancyCategory: string;
  breastfeedingSafety: string;
  maxDailyDose?: string;
  monitoringRequired?: string[];
}

export interface DosageInfo {
  indication: string;
  adult: string;
  pediatric?: string;
  elderly?: string;
}

export interface GFRAdjustment {
  gfrRange: string;
  gfrMin: number;
  gfrMax: number;
  adjustedDose: string;
  adjustedFrequency: string;
  notes: string;
  contraindicated: boolean;
}

export type MedicationCategory = 
  | 'Antibiotics'
  | 'Analgesics'
  | 'Anti-inflammatories'
  | 'Anticoagulants'
  | 'Antihypertensives'
  | 'Antidiabetics'
  | 'Antiemetics'
  | 'Antifungals'
  | 'Antivirals'
  | 'Anxiolytics & Sedatives'
  | 'Cardiovascular'
  | 'Corticosteroids'
  | 'Dermatologicals'
  | 'Fluid & Electrolytes'
  | 'Gastrointestinal'
  | 'Haematological'
  | 'Local Anaesthetics'
  | 'General Anaesthetics'
  | 'Muscle Relaxants'
  | 'Nutritional Supplements'
  | 'Opioid Analgesics'
  | 'Respiratory'
  | 'Tetanus Prophylaxis'
  | 'Wound Care'
  | 'Miscellaneous';

export const MEDICATION_CATEGORIES: MedicationCategory[] = [
  'Antibiotics',
  'Analgesics',
  'Anti-inflammatories',
  'Anticoagulants',
  'Antihypertensives',
  'Antidiabetics',
  'Antiemetics',
  'Antifungals',
  'Antivirals',
  'Anxiolytics & Sedatives',
  'Cardiovascular',
  'Corticosteroids',
  'Dermatologicals',
  'Fluid & Electrolytes',
  'Gastrointestinal',
  'Haematological',
  'Local Anaesthetics',
  'General Anaesthetics',
  'Muscle Relaxants',
  'Nutritional Supplements',
  'Opioid Analgesics',
  'Respiratory',
  'Tetanus Prophylaxis',
  'Wound Care',
  'Miscellaneous'
];

export const ROUTES = [
  'Oral', 'IV', 'IM', 'SC', 'Topical', 'PR', 'SL', 'Inhaled', 'Nasal',
  'Ophthalmic', 'Otic', 'Vaginal', 'Transdermal', 'Intralesional',
  'Epidural', 'Intrathecal', 'Nebulised'
];

export const FREQUENCIES = [
  'STAT', 'OD', 'BD', 'TDS', 'QDS', 'Q4H', 'Q6H', 'Q8H', 'Q12H',
  'Q24H', 'Q48H', 'Q72H', 'PRN', 'Nocte', 'Mane', 'Weekly',
  'Twice weekly', 'Every 2 weeks', 'Monthly', 'Once only',
  'Pre-op', 'Post-op', 'Before meals', 'After meals', 'With meals'
];

export const BNF_MEDICATIONS: BNFMedication[] = [
  // ==================== ANTIBIOTICS ====================
  {
    name: 'Amoxicillin',
    genericName: 'Amoxicillin',
    category: 'Antibiotics',
    subcategory: 'Penicillins',
    formulations: ['Capsule 250mg', 'Capsule 500mg', 'Suspension 125mg/5ml', 'Suspension 250mg/5ml', 'Injection 250mg', 'Injection 500mg', 'Injection 1g'],
    dosages: [
      { indication: 'General infection', adult: '250-500mg TDS or 750mg-1g BD', pediatric: '25mg/kg/day in 3 divided doses' },
      { indication: 'Severe infection', adult: '1g TDS', pediatric: '50mg/kg/day in 3 divided doses' },
      { indication: 'Surgical prophylaxis', adult: '1-2g IV at induction' }
    ],
    routes: ['Oral', 'IV', 'IM'],
    frequencies: ['TDS', 'BD', 'STAT'],
    gfrAdjustments: [
      { gfrRange: '>60', gfrMin: 60, gfrMax: 999, adjustedDose: 'No adjustment', adjustedFrequency: 'TDS', notes: 'Normal dosing', contraindicated: false },
      { gfrRange: '30-59', gfrMin: 30, gfrMax: 59, adjustedDose: '500mg', adjustedFrequency: 'BD', notes: 'Reduce frequency', contraindicated: false },
      { gfrRange: '15-29', gfrMin: 15, gfrMax: 29, adjustedDose: '500mg', adjustedFrequency: 'OD', notes: 'Significant reduction needed', contraindicated: false },
      { gfrRange: '<15', gfrMin: 0, gfrMax: 14, adjustedDose: '250-500mg', adjustedFrequency: 'OD', notes: 'Use with caution in ESRD', contraindicated: false }
    ],
    warnings: ['Risk of anaphylaxis in penicillin allergy', 'May cause C. difficile colitis', 'Rash common with EBV/glandular fever'],
    sideEffects: ['Nausea', 'Diarrhoea', 'Skin rash', 'Urticaria', 'Candidiasis'],
    contraindications: ['Penicillin hypersensitivity', 'History of penicillin-associated jaundice'],
    interactions: ['Methotrexate (increased toxicity)', 'Warfarin (enhanced effect)', 'Combined oral contraceptives (reduced efficacy)'],
    pregnancyCategory: 'Safe - Category A',
    breastfeedingSafety: 'Compatible',
    maxDailyDose: '6g (IV), 3g (oral)'
  },
  {
    name: 'Amoxicillin/Clavulanate (Co-amoxiclav)',
    genericName: 'Amoxicillin/Clavulanic acid',
    category: 'Antibiotics',
    subcategory: 'Penicillins + Beta-lactamase inhibitor',
    formulations: ['Tablet 375mg (250/125)', 'Tablet 625mg (500/125)', 'Suspension 125/31.25 per 5ml', 'Suspension 250/62.5 per 5ml', 'Injection 600mg (500/100)', 'Injection 1.2g (1000/200)'],
    dosages: [
      { indication: 'General infection', adult: '625mg TDS oral or 1.2g TDS IV' },
      { indication: 'Severe infection', adult: '1.2g TDS IV' },
      { indication: 'Surgical site infection', adult: '1.2g TDS IV' },
      { indication: 'Bite wounds', adult: '625mg TDS oral for 5-7 days' }
    ],
    routes: ['Oral', 'IV'],
    frequencies: ['TDS', 'BD'],
    gfrAdjustments: [
      { gfrRange: '>30', gfrMin: 30, gfrMax: 999, adjustedDose: 'No adjustment', adjustedFrequency: 'TDS', notes: 'Normal dosing', contraindicated: false },
      { gfrRange: '10-30', gfrMin: 10, gfrMax: 30, adjustedDose: '625mg oral or 1.2g IV', adjustedFrequency: 'BD', notes: 'Reduce frequency', contraindicated: false },
      { gfrRange: '<10', gfrMin: 0, gfrMax: 9, adjustedDose: '375mg oral or 600mg IV', adjustedFrequency: 'BD', notes: 'Reduce dose and frequency', contraindicated: false }
    ],
    warnings: ['Cholestatic jaundice risk (may occur weeks after treatment)', 'Monitor liver function in prolonged use', 'C. difficile risk'],
    sideEffects: ['Nausea', 'Vomiting', 'Diarrhoea', 'Hepatitis', 'Cholestatic jaundice', 'Candidiasis', 'Skin rash'],
    contraindications: ['Penicillin hypersensitivity', 'History of co-amoxiclav-associated jaundice', 'History of hepatic dysfunction with co-amoxiclav'],
    interactions: ['Warfarin (enhanced anticoagulant effect)', 'Methotrexate (increased toxicity)', 'Mycophenolate (reduced absorption)'],
    pregnancyCategory: 'Safe - Category B',
    breastfeedingSafety: 'Compatible with caution',
    maxDailyDose: '3.6g IV'
  },
  {
    name: 'Flucloxacillin',
    genericName: 'Flucloxacillin',
    category: 'Antibiotics',
    subcategory: 'Penicillins (Penicillinase-resistant)',
    formulations: ['Capsule 250mg', 'Capsule 500mg', 'Syrup 125mg/5ml', 'Syrup 250mg/5ml', 'Injection 250mg', 'Injection 500mg', 'Injection 1g'],
    dosages: [
      { indication: 'Skin & soft tissue infection', adult: '500mg-1g QDS' },
      { indication: 'Severe staphylococcal infection', adult: '1-2g QDS IV' },
      { indication: 'Surgical prophylaxis (Staph cover)', adult: '1-2g IV at induction' },
      { indication: 'Osteomyelitis', adult: '1-2g QDS IV for 4-6 weeks' }
    ],
    routes: ['Oral', 'IV', 'IM'],
    frequencies: ['QDS', 'Q6H'],
    gfrAdjustments: [
      { gfrRange: '>10', gfrMin: 10, gfrMax: 999, adjustedDose: 'No adjustment needed', adjustedFrequency: 'QDS', notes: 'Primarily hepatic elimination', contraindicated: false },
      { gfrRange: '<10', gfrMin: 0, gfrMax: 9, adjustedDose: 'Use with caution', adjustedFrequency: 'QDS', notes: 'Minimal renal adjustment needed', contraindicated: false }
    ],
    warnings: ['Cholestatic jaundice risk (especially >14 days use)', 'Risk of hepatitis - monitor LFTs if prolonged use', 'Take 30-60 min before food for optimal absorption'],
    sideEffects: ['Nausea', 'Diarrhoea', 'Rash', 'Hepatitis', 'Cholestatic jaundice', 'Interstitial nephritis'],
    contraindications: ['Penicillin hypersensitivity', 'History of flucloxacillin-associated jaundice/hepatitis'],
    interactions: ['Warfarin (variable effect)', 'Methotrexate (increased toxicity)'],
    pregnancyCategory: 'Safe - Category B',
    breastfeedingSafety: 'Compatible',
    maxDailyDose: '8g IV, 4g oral'
  },
  {
    name: 'Ceftriaxone',
    genericName: 'Ceftriaxone',
    category: 'Antibiotics',
    subcategory: 'Cephalosporins (3rd generation)',
    formulations: ['Injection 250mg', 'Injection 500mg', 'Injection 1g', 'Injection 2g'],
    dosages: [
      { indication: 'General infection', adult: '1-2g OD IV/IM' },
      { indication: 'Severe/life-threatening infection', adult: '2-4g OD IV' },
      { indication: 'Surgical prophylaxis', adult: '1-2g IV at induction' },
      { indication: 'Meningitis', adult: '2g BD IV' }
    ],
    routes: ['IV', 'IM'],
    frequencies: ['OD', 'BD'],
    gfrAdjustments: [
      { gfrRange: '>10', gfrMin: 10, gfrMax: 999, adjustedDose: 'No adjustment required', adjustedFrequency: 'OD', notes: 'Dual hepatic/renal elimination', contraindicated: false },
      { gfrRange: '<10', gfrMin: 0, gfrMax: 9, adjustedDose: 'Max 2g/day', adjustedFrequency: 'OD', notes: 'Max 2g daily in severe renal impairment', contraindicated: false }
    ],
    warnings: ['Do NOT mix with calcium-containing IV solutions', 'Risk of biliary sludging', 'Pseudocholelithiasis in prolonged use', 'C. difficile risk'],
    sideEffects: ['Diarrhoea', 'Nausea', 'Rash', 'Eosinophilia', 'Thrombocytopenia', 'Biliary sludge', 'Elevated LFTs'],
    contraindications: ['Cephalosporin hypersensitivity', 'Severe penicillin allergy (use with caution)', 'Neonates with hyperbilirubinaemia', 'Concomitant IV calcium in neonates'],
    interactions: ['Calcium-containing IV fluids (precipitation risk)', 'Warfarin (enhanced effect)', 'Aminoglycosides (synergistic but separate administration)'],
    pregnancyCategory: 'Safe - Category B',
    breastfeedingSafety: 'Compatible',
    maxDailyDose: '4g',
    monitoringRequired: ['FBC if prolonged use', 'LFTs', 'Renal function']
  },
  {
    name: 'Cefuroxime',
    genericName: 'Cefuroxime',
    category: 'Antibiotics',
    subcategory: 'Cephalosporins (2nd generation)',
    formulations: ['Tablet 250mg', 'Tablet 500mg', 'Injection 750mg', 'Injection 1.5g'],
    dosages: [
      { indication: 'General infection', adult: '250-500mg BD oral or 750mg TDS IV' },
      { indication: 'Severe infection', adult: '1.5g TDS IV' },
      { indication: 'Surgical prophylaxis', adult: '1.5g IV at induction' }
    ],
    routes: ['Oral', 'IV', 'IM'],
    frequencies: ['BD', 'TDS'],
    gfrAdjustments: [
      { gfrRange: '>20', gfrMin: 20, gfrMax: 999, adjustedDose: 'No adjustment', adjustedFrequency: 'TDS', notes: 'Normal dosing', contraindicated: false },
      { gfrRange: '10-20', gfrMin: 10, gfrMax: 20, adjustedDose: '750mg', adjustedFrequency: 'BD', notes: 'Reduce frequency', contraindicated: false },
      { gfrRange: '<10', gfrMin: 0, gfrMax: 9, adjustedDose: '750mg', adjustedFrequency: 'OD', notes: 'Significant reduction', contraindicated: false }
    ],
    warnings: ['Cross-sensitivity with penicillins', 'C. difficile risk'],
    sideEffects: ['Diarrhoea', 'Nausea', 'Headache', 'Rash', 'Positive Coombs test'],
    contraindications: ['Cephalosporin hypersensitivity', 'Severe penicillin allergy'],
    interactions: ['Probenecid (increased cefuroxime levels)', 'Aminoglycosides (synergistic nephrotoxicity)'],
    pregnancyCategory: 'Safe - Category B',
    breastfeedingSafety: 'Compatible',
    maxDailyDose: '6g IV'
  },
  {
    name: 'Ciprofloxacin',
    genericName: 'Ciprofloxacin',
    category: 'Antibiotics',
    subcategory: 'Fluoroquinolones',
    formulations: ['Tablet 250mg', 'Tablet 500mg', 'Tablet 750mg', 'Infusion 200mg/100ml', 'Infusion 400mg/200ml'],
    dosages: [
      { indication: 'UTI/mild infection', adult: '250-500mg BD oral' },
      { indication: 'Severe/complicated infection', adult: '400mg BD-TDS IV' },
      { indication: 'Bone & joint infection', adult: '500-750mg BD oral or 400mg BD IV' },
      { indication: 'Pseudomonal infection', adult: '750mg BD oral or 400mg TDS IV' }
    ],
    routes: ['Oral', 'IV'],
    frequencies: ['BD', 'TDS'],
    gfrAdjustments: [
      { gfrRange: '>30', gfrMin: 30, gfrMax: 999, adjustedDose: 'No adjustment', adjustedFrequency: 'BD', notes: 'Normal dosing', contraindicated: false },
      { gfrRange: '15-29', gfrMin: 15, gfrMax: 29, adjustedDose: '250-500mg oral or 200-400mg IV', adjustedFrequency: 'BD', notes: 'Reduce dose', contraindicated: false },
      { gfrRange: '<15', gfrMin: 0, gfrMax: 14, adjustedDose: '250mg oral or 200mg IV', adjustedFrequency: 'OD', notes: 'Significant reduction required', contraindicated: false }
    ],
    warnings: ['Tendon damage risk (especially with corticosteroids)', 'QT prolongation risk', 'Photosensitivity', 'CNS effects (dizziness, confusion)', 'Aortic aneurysm risk', 'Peripheral neuropathy risk'],
    sideEffects: ['Nausea', 'Diarrhoea', 'Headache', 'Dizziness', 'Tendonitis', 'Photosensitivity', 'QT prolongation', 'Abnormal LFTs'],
    contraindications: ['Quinolone hypersensitivity', 'History of tendon disorders related to quinolones', 'Concurrent tizanidine use'],
    interactions: ['Theophylline (increased levels)', 'Warfarin (enhanced effect)', 'NSAIDs (increased seizure risk)', 'Antacids/iron/zinc (reduced absorption - give 2h apart)', 'Ciclosporin (increased nephrotoxicity)'],
    pregnancyCategory: 'Avoid - Category C',
    breastfeedingSafety: 'Avoid',
    maxDailyDose: '1.5g oral, 1.2g IV'
  },
  {
    name: 'Metronidazole',
    genericName: 'Metronidazole',
    category: 'Antibiotics',
    subcategory: 'Nitroimidazoles',
    formulations: ['Tablet 200mg', 'Tablet 400mg', 'Suppository 500mg', 'Suppository 1g', 'Infusion 500mg/100ml', 'Gel 0.75%'],
    dosages: [
      { indication: 'Anaerobic infection', adult: '400mg TDS oral or 500mg TDS IV' },
      { indication: 'Surgical prophylaxis', adult: '500mg IV at induction + 500mg 8-hourly for 24h' },
      { indication: 'C. difficile colitis', adult: '400mg TDS oral for 10-14 days' },
      { indication: 'Wound infection (anaerobic)', adult: '400mg TDS oral for 7 days' }
    ],
    routes: ['Oral', 'IV', 'PR', 'Topical'],
    frequencies: ['TDS', 'BD', 'STAT'],
    gfrAdjustments: [
      { gfrRange: '>10', gfrMin: 10, gfrMax: 999, adjustedDose: 'No adjustment', adjustedFrequency: 'TDS', notes: 'Primarily hepatic metabolism', contraindicated: false },
      { gfrRange: '<10', gfrMin: 0, gfrMax: 9, adjustedDose: '400mg or 500mg', adjustedFrequency: 'BD', notes: 'Metabolite accumulation - reduce if prolonged course', contraindicated: false }
    ],
    warnings: ['Avoid alcohol (disulfiram-like reaction)', 'Peripheral neuropathy with prolonged use', 'Monitor for CNS toxicity in high doses', 'Darkening of urine (harmless)'],
    sideEffects: ['Nausea', 'Metallic taste', 'Anorexia', 'Vomiting', 'Peripheral neuropathy', 'Darkened urine', 'Headache'],
    contraindications: ['Hypersensitivity to nitroimidazoles'],
    interactions: ['Alcohol (disulfiram reaction)', 'Warfarin (enhanced anticoagulant effect)', 'Lithium (increased levels)', 'Phenobarbital (reduced metronidazole levels)'],
    pregnancyCategory: 'Avoid in 1st trimester if possible',
    breastfeedingSafety: 'Avoid high doses; short courses acceptable',
    maxDailyDose: '4g'
  },
  {
    name: 'Gentamicin',
    genericName: 'Gentamicin',
    category: 'Antibiotics',
    subcategory: 'Aminoglycosides',
    formulations: ['Injection 40mg/ml (1ml, 2ml)', 'Injection 80mg/2ml'],
    dosages: [
      { indication: 'Severe infection (once daily)', adult: '5-7mg/kg OD IV (based on IBW)' },
      { indication: 'Severe infection (traditional)', adult: '1-1.7mg/kg TDS IV' },
      { indication: 'Synergy with vancomycin (endocarditis)', adult: '1mg/kg BD-TDS IV' }
    ],
    routes: ['IV', 'IM'],
    frequencies: ['OD', 'BD', 'TDS'],
    gfrAdjustments: [
      { gfrRange: '>60', gfrMin: 60, gfrMax: 999, adjustedDose: '5-7mg/kg', adjustedFrequency: 'OD', notes: 'Normal dosing - monitor levels', contraindicated: false },
      { gfrRange: '40-59', gfrMin: 40, gfrMax: 59, adjustedDose: '5mg/kg', adjustedFrequency: 'Every 36h', notes: 'Extended interval - check trough before re-dosing', contraindicated: false },
      { gfrRange: '20-39', gfrMin: 20, gfrMax: 39, adjustedDose: '3-5mg/kg', adjustedFrequency: 'Every 48h', notes: 'Extended interval - monitor levels closely', contraindicated: false },
      { gfrRange: '<20', gfrMin: 0, gfrMax: 19, adjustedDose: 'Avoid if possible', adjustedFrequency: 'Single dose only', notes: 'Extremely nephrotoxic - use alternative', contraindicated: true }
    ],
    warnings: ['NEPHROTOXIC - monitor renal function', 'OTOTOXIC - irreversible hearing loss', 'Monitor trough levels (must be <1 mg/L)', 'Monitor peak levels (5-10 mg/L for standard dosing)', 'Dose based on ideal body weight in obesity'],
    sideEffects: ['Nephrotoxicity', 'Ototoxicity (vestibular and cochlear)', 'Neuromuscular blockade', 'Rash', 'Nausea'],
    contraindications: ['Myasthenia gravis', 'Aminoglycoside hypersensitivity', 'Severe renal impairment (relative)'],
    interactions: ['Loop diuretics (increased ototoxicity)', 'Vancomycin (increased nephrotoxicity)', 'NSAIDs (increased nephrotoxicity)', 'Neuromuscular blocking agents (enhanced blockade)', 'Ciclosporin (increased nephrotoxicity)'],
    pregnancyCategory: 'Avoid unless essential - Category D',
    breastfeedingSafety: 'Compatible (poor oral absorption by infant)',
    monitoringRequired: ['Trough levels pre-3rd dose', 'U&E daily', 'Serum creatinine', 'Audiometry if prolonged use']
  },
  {
    name: 'Vancomycin',
    genericName: 'Vancomycin',
    category: 'Antibiotics',
    subcategory: 'Glycopeptides',
    formulations: ['Injection 500mg vial', 'Injection 1g vial', 'Capsule 125mg (oral for C. diff)'],
    dosages: [
      { indication: 'MRSA/severe Gram+ve infection', adult: '15-20mg/kg (usually 1g) BD IV' },
      { indication: 'C. difficile colitis', adult: '125mg QDS oral for 10 days' },
      { indication: 'Surgical prophylaxis (beta-lactam allergy)', adult: '1g IV over 100 min pre-op' }
    ],
    routes: ['IV', 'Oral'],
    frequencies: ['BD', 'TDS', 'QDS'],
    gfrAdjustments: [
      { gfrRange: '>50', gfrMin: 50, gfrMax: 999, adjustedDose: '15-20mg/kg', adjustedFrequency: 'BD', notes: 'Aim trough 15-20mg/L for serious infections', contraindicated: false },
      { gfrRange: '30-49', gfrMin: 30, gfrMax: 49, adjustedDose: '15mg/kg', adjustedFrequency: 'OD', notes: 'Reduce frequency - monitor trough levels', contraindicated: false },
      { gfrRange: '15-29', gfrMin: 15, gfrMax: 29, adjustedDose: '15mg/kg', adjustedFrequency: 'Every 48h', notes: 'Extended interval dosing - check levels pre-dose', contraindicated: false },
      { gfrRange: '<15', gfrMin: 0, gfrMax: 14, adjustedDose: '15mg/kg loading then guided by levels', adjustedFrequency: 'Level-guided', notes: 'Specialist guidance required', contraindicated: false }
    ],
    warnings: ['Infuse over minimum 60 min to avoid Red Man Syndrome', 'NEPHROTOXIC - especially with aminoglycosides', 'Monitor trough levels', 'Ototoxic at high levels'],
    sideEffects: ['Red Man Syndrome (histamine release)', 'Nephrotoxicity', 'Ototoxicity', 'Thrombophlebitis', 'Neutropenia (prolonged use)', 'Rash'],
    contraindications: ['Vancomycin hypersensitivity'],
    interactions: ['Aminoglycosides (increased nephrotoxicity)', 'Loop diuretics (increased ototoxicity)', 'Anaesthetic agents (enhanced histamine release)'],
    pregnancyCategory: 'Use if essential - Category C',
    breastfeedingSafety: 'Compatible (IV); oral not absorbed',
    monitoringRequired: ['Trough levels before 3rd-4th dose', 'U&E regularly', 'FBC weekly (prolonged use)', 'Audiometry if prolonged']
  },
  {
    name: 'Clindamycin',
    genericName: 'Clindamycin',
    category: 'Antibiotics',
    subcategory: 'Lincosamides',
    formulations: ['Capsule 150mg', 'Capsule 300mg', 'Injection 150mg/ml (2ml, 4ml)'],
    dosages: [
      { indication: 'Skin/soft tissue infection', adult: '150-450mg QDS oral' },
      { indication: 'Severe infection', adult: '600-900mg TDS-QDS IV' },
      { indication: 'Necrotising fasciitis (with other agents)', adult: '900mg TDS IV' },
      { indication: 'Penicillin-allergic surgical prophylaxis', adult: '600mg IV at induction' }
    ],
    routes: ['Oral', 'IV'],
    frequencies: ['QDS', 'TDS', 'BD'],
    gfrAdjustments: [
      { gfrRange: '>10', gfrMin: 10, gfrMax: 999, adjustedDose: 'No adjustment', adjustedFrequency: 'QDS', notes: 'Hepatic elimination', contraindicated: false },
      { gfrRange: '<10', gfrMin: 0, gfrMax: 9, adjustedDose: 'No adjustment usually needed', adjustedFrequency: 'QDS', notes: 'Not removed by dialysis', contraindicated: false }
    ],
    warnings: ['HIGH RISK of C. difficile colitis', 'Discontinue immediately if diarrhoea develops', 'Excellent bone penetration', 'Good for MRSA (some strains)'],
    sideEffects: ['Diarrhoea', 'C. difficile colitis', 'Nausea', 'Vomiting', 'Abdominal pain', 'Rash', 'Jaundice', 'Elevated LFTs'],
    contraindications: ['Clindamycin/lincomycin hypersensitivity', 'Diarrhoeal states'],
    interactions: ['Neuromuscular blocking agents (enhanced blockade)', 'Erythromycin (antagonism - do not combine)', 'Warfarin (enhanced effect)'],
    pregnancyCategory: 'Safe if indicated - Category B',
    breastfeedingSafety: 'Use with caution',
    maxDailyDose: '4.8g IV'
  },
  {
    name: 'Erythromycin',
    genericName: 'Erythromycin',
    category: 'Antibiotics',
    subcategory: 'Macrolides',
    formulations: ['Tablet 250mg', 'Tablet 500mg', 'Suspension 125mg/5ml', 'Suspension 250mg/5ml', 'Injection 1g'],
    dosages: [
      { indication: 'Mild-moderate infection', adult: '250-500mg QDS oral' },
      { indication: 'Severe infection', adult: '1g QDS IV (infuse over 60 min)' },
      { indication: 'Penicillin-allergic alternative', adult: '500mg QDS' }
    ],
    routes: ['Oral', 'IV'],
    frequencies: ['QDS', 'BD'],
    gfrAdjustments: [
      { gfrRange: '>10', gfrMin: 10, gfrMax: 999, adjustedDose: 'No adjustment', adjustedFrequency: 'QDS', notes: 'Hepatic elimination', contraindicated: false },
      { gfrRange: '<10', gfrMin: 0, gfrMax: 9, adjustedDose: '50-75% of standard dose', adjustedFrequency: 'BD-TDS', notes: 'Ototoxicity risk increases', contraindicated: false }
    ],
    warnings: ['QT prolongation risk', 'P450 inhibitor - many drug interactions', 'Hepatotoxicity (estolate form)', 'IV gives phlebitis - dilute well'],
    sideEffects: ['Nausea', 'Vomiting', 'Abdominal pain', 'Diarrhoea', 'QT prolongation', 'Hepatotoxicity', 'Ototoxicity (high dose IV)'],
    contraindications: ['Macrolide hypersensitivity', 'Concurrent use with terfenadine/cisapride/pimozide', 'Hepatic impairment with estolate form'],
    interactions: ['Statins (rhabdomyolysis risk)', 'Warfarin (enhanced effect)', 'Theophylline (increased levels)', 'Carbamazepine (increased levels)', 'Ciclosporin (increased levels)', 'Digoxin (increased levels)'],
    pregnancyCategory: 'Safe - Category B',
    breastfeedingSafety: 'Compatible',
    maxDailyDose: '4g'
  },
  {
    name: 'Azithromycin',
    genericName: 'Azithromycin',
    category: 'Antibiotics',
    subcategory: 'Macrolides',
    formulations: ['Tablet 250mg', 'Tablet 500mg', 'Suspension 200mg/5ml', 'Injection 500mg'],
    dosages: [
      { indication: 'Respiratory/skin infection', adult: '500mg OD for 3 days or 500mg day 1, then 250mg OD days 2-5' },
      { indication: 'Chlamydia', adult: '1g STAT' },
      { indication: 'Community-acquired pneumonia', adult: '500mg OD IV then oral step-down' }
    ],
    routes: ['Oral', 'IV'],
    frequencies: ['OD', 'STAT'],
    gfrAdjustments: [
      { gfrRange: '>10', gfrMin: 10, gfrMax: 999, adjustedDose: 'No adjustment', adjustedFrequency: 'OD', notes: 'Primarily biliary/faecal elimination', contraindicated: false },
      { gfrRange: '<10', gfrMin: 0, gfrMax: 9, adjustedDose: 'Use with caution', adjustedFrequency: 'OD', notes: 'Limited data in severe renal impairment', contraindicated: false }
    ],
    warnings: ['QT prolongation risk', 'Fewer drug interactions than erythromycin', 'Long tissue half-life (continues working after course ends)'],
    sideEffects: ['Nausea', 'Diarrhoea', 'Abdominal pain', 'Headache', 'QT prolongation'],
    contraindications: ['Macrolide hypersensitivity', 'Hepatic impairment (severe)'],
    interactions: ['Warfarin (enhanced effect)', 'Ergot alkaloids (avoid)', 'Antacids (reduce absorption - give 1h before or 2h after)'],
    pregnancyCategory: 'Safe - Category B',
    breastfeedingSafety: 'Compatible',
    maxDailyDose: '500mg (standard courses)'
  },
  {
    name: 'Levofloxacin',
    genericName: 'Levofloxacin',
    category: 'Antibiotics',
    subcategory: 'Fluoroquinolones',
    formulations: ['Tablet 250mg', 'Tablet 500mg', 'Infusion 500mg/100ml'],
    dosages: [
      { indication: 'General infection', adult: '500mg OD-BD' },
      { indication: 'Severe infection / pneumonia', adult: '500mg BD' }
    ],
    routes: ['Oral', 'IV'],
    frequencies: ['OD', 'BD'],
    gfrAdjustments: [
      { gfrRange: '>50', gfrMin: 50, gfrMax: 999, adjustedDose: 'No adjustment', adjustedFrequency: 'OD-BD', notes: 'Normal dosing', contraindicated: false },
      { gfrRange: '20-49', gfrMin: 20, gfrMax: 49, adjustedDose: '250mg', adjustedFrequency: 'OD-BD', notes: 'Halve dose', contraindicated: false },
      { gfrRange: '<20', gfrMin: 0, gfrMax: 19, adjustedDose: '250mg', adjustedFrequency: 'Every 48h', notes: 'Extended interval', contraindicated: false }
    ],
    warnings: ['Tendon damage risk', 'QT prolongation', 'Photosensitivity', 'Aortic aneurysm risk', 'Peripheral neuropathy'],
    sideEffects: ['Nausea', 'Diarrhoea', 'Headache', 'Dizziness', 'Insomnia', 'Tendonitis', 'Photosensitivity'],
    contraindications: ['Quinolone hypersensitivity', 'History of tendon disorders with quinolones', 'Epilepsy (relative)'],
    interactions: ['NSAIDs (seizure risk)', 'Warfarin (enhanced effect)', 'Theophylline (increased levels)', 'Iron/zinc/antacids (give 2h apart)'],
    pregnancyCategory: 'Avoid - Category C',
    breastfeedingSafety: 'Avoid',
    maxDailyDose: '1g'
  },
  {
    name: 'Piperacillin/Tazobactam (Tazocin)',
    genericName: 'Piperacillin/Tazobactam',
    category: 'Antibiotics',
    subcategory: 'Penicillins (Anti-pseudomonal)',
    formulations: ['Injection 2.25g (piperacillin 2g/tazobactam 250mg)', 'Injection 4.5g (piperacillin 4g/tazobactam 500mg)'],
    dosages: [
      { indication: 'Severe infection/sepsis', adult: '4.5g TDS IV (infuse over 30 min)' },
      { indication: 'Pseudomonal infection', adult: '4.5g QDS IV' },
      { indication: 'Nosocomial pneumonia', adult: '4.5g TDS IV' }
    ],
    routes: ['IV'],
    frequencies: ['TDS', 'QDS'],
    gfrAdjustments: [
      { gfrRange: '>40', gfrMin: 40, gfrMax: 999, adjustedDose: '4.5g', adjustedFrequency: 'TDS-QDS', notes: 'Normal dosing', contraindicated: false },
      { gfrRange: '20-39', gfrMin: 20, gfrMax: 39, adjustedDose: '4.5g', adjustedFrequency: 'BD', notes: 'Reduce frequency', contraindicated: false },
      { gfrRange: '<20', gfrMin: 0, gfrMax: 19, adjustedDose: '4.5g', adjustedFrequency: 'BD', notes: 'Max 4.5g BD', contraindicated: false }
    ],
    warnings: ['Sodium load (each 4.5g = ~11.35mmol Na+)', 'Hypokalaemia risk', 'Platelet dysfunction at high doses', 'Neurotoxicity in renal impairment'],
    sideEffects: ['Diarrhoea', 'Nausea', 'Headache', 'Insomnia', 'Rash', 'Thrombophlebitis', 'C. difficile'],
    contraindications: ['Penicillin hypersensitivity'],
    interactions: ['Methotrexate (increased toxicity)', 'Warfarin (enhanced effect)', 'Vecuronium (prolonged blockade)'],
    pregnancyCategory: 'Safe if indicated - Category B',
    breastfeedingSafety: 'Compatible',
    maxDailyDose: '18g piperacillin component'
  },
  {
    name: 'Meropenem',
    genericName: 'Meropenem',
    category: 'Antibiotics',
    subcategory: 'Carbapenems',
    formulations: ['Injection 500mg', 'Injection 1g'],
    dosages: [
      { indication: 'Severe infection', adult: '500mg-1g TDS IV' },
      { indication: 'Meningitis/very severe infection', adult: '2g TDS IV' },
      { indication: 'Intra-abdominal infection', adult: '1g TDS IV' }
    ],
    routes: ['IV'],
    frequencies: ['TDS'],
    gfrAdjustments: [
      { gfrRange: '>50', gfrMin: 50, gfrMax: 999, adjustedDose: 'No adjustment', adjustedFrequency: 'TDS', notes: 'Normal dosing', contraindicated: false },
      { gfrRange: '26-50', gfrMin: 26, gfrMax: 50, adjustedDose: 'Standard dose', adjustedFrequency: 'BD', notes: 'Reduce to BD', contraindicated: false },
      { gfrRange: '10-25', gfrMin: 10, gfrMax: 25, adjustedDose: '50% of standard', adjustedFrequency: 'BD', notes: 'Halve dose and reduce frequency', contraindicated: false },
      { gfrRange: '<10', gfrMin: 0, gfrMax: 9, adjustedDose: '50% of standard', adjustedFrequency: 'OD', notes: 'Specialist guidance recommended', contraindicated: false }
    ],
    warnings: ['Seizure risk (less than imipenem)', 'Reserve for resistant organisms', 'C. difficile risk'],
    sideEffects: ['Nausea', 'Vomiting', 'Diarrhoea', 'Headache', 'Rash', 'Thrombophlebitis', 'Seizures (rare)'],
    contraindications: ['Carbapenem/beta-lactam hypersensitivity'],
    interactions: ['Valproic acid (SIGNIFICANTLY reduces valproate levels)', 'Probenecid (increased meropenem levels)'],
    pregnancyCategory: 'Use if essential - Category B',
    breastfeedingSafety: 'Use with caution',
    maxDailyDose: '6g'
  },
  {
    name: 'Doxycycline',
    genericName: 'Doxycycline',
    category: 'Antibiotics',
    subcategory: 'Tetracyclines',
    formulations: ['Capsule 50mg', 'Capsule 100mg'],
    dosages: [
      { indication: 'General infection', adult: '200mg on day 1 then 100mg OD' },
      { indication: 'Severe infection', adult: '200mg OD' },
      { indication: 'Skin/soft tissue', adult: '100mg BD' }
    ],
    routes: ['Oral'],
    frequencies: ['OD', 'BD'],
    gfrAdjustments: [
      { gfrRange: '>10', gfrMin: 10, gfrMax: 999, adjustedDose: 'No adjustment', adjustedFrequency: 'OD', notes: 'Does not accumulate in renal impairment (unlike other tetracyclines)', contraindicated: false },
      { gfrRange: '<10', gfrMin: 0, gfrMax: 9, adjustedDose: 'No adjustment', adjustedFrequency: 'OD', notes: 'Safe in renal impairment - preferred tetracycline', contraindicated: false }
    ],
    warnings: ['Photosensitivity - advise sunscreen', 'Oesophageal irritation - take with water, upright', 'Do not take with dairy/antacids', 'Tooth discolouration in children <12yrs'],
    sideEffects: ['Nausea', 'Vomiting', 'Diarrhoea', 'Photosensitivity', 'Oesophagitis', 'Candidiasis'],
    contraindications: ['Tetracycline hypersensitivity', 'Pregnancy', 'Children under 12', 'Myasthenia gravis (may worsen)'],
    interactions: ['Antacids/iron (reduced absorption)', 'Warfarin (enhanced effect)', 'Combined oral contraceptives (may reduce efficacy)', 'Retinoids (increased intracranial pressure risk)'],
    pregnancyCategory: 'Contraindicated - Category D',
    breastfeedingSafety: 'Avoid',
    maxDailyDose: '200mg'
  },
  {
    name: 'Trimethoprim/Sulfamethoxazole (Co-trimoxazole)',
    genericName: 'Trimethoprim/Sulfamethoxazole',
    category: 'Antibiotics',
    subcategory: 'Folate antagonists',
    formulations: ['Tablet 480mg (80/400)', 'Tablet 960mg (160/800)', 'Suspension 240mg/5ml', 'Infusion 480mg/5ml ampoule'],
    dosages: [
      { indication: 'UTI', adult: '960mg BD for 3-14 days' },
      { indication: 'PCP treatment', adult: '120mg/kg/day IV in 2-4 divided doses for 21 days' },
      { indication: 'PCP prophylaxis', adult: '960mg OD or 480mg OD' },
      { indication: 'MRSA skin infection', adult: '960mg BD' }
    ],
    routes: ['Oral', 'IV'],
    frequencies: ['BD', 'OD'],
    gfrAdjustments: [
      { gfrRange: '>30', gfrMin: 30, gfrMax: 999, adjustedDose: 'No adjustment', adjustedFrequency: 'BD', notes: 'Normal dosing', contraindicated: false },
      { gfrRange: '15-29', gfrMin: 15, gfrMax: 29, adjustedDose: '50% of standard', adjustedFrequency: 'BD', notes: 'Halve dose; monitor closely', contraindicated: false },
      { gfrRange: '<15', gfrMin: 0, gfrMax: 14, adjustedDose: 'Avoid unless essential', adjustedFrequency: '', notes: 'Significant accumulation risk', contraindicated: true }
    ],
    warnings: ['Risk of severe cutaneous reactions (SJS/TEN)', 'Hyperkalaemia risk', 'Blood dyscrasia risk - check FBC in prolonged use', 'Crystalluria - maintain hydration'],
    sideEffects: ['Nausea', 'Vomiting', 'Rash', 'Hyperkalaemia', 'Blood dyscrasias', 'Hepatitis', 'Stevens-Johnson syndrome'],
    contraindications: ['Sulfonamide hypersensitivity', 'Severe hepatic or renal impairment', 'Blood dyscrasias', 'Porphyria', 'Pregnancy (1st trimester)', 'G6PD deficiency (haemolysis risk)'],
    interactions: ['Warfarin (enhanced effect)', 'Methotrexate (increased toxicity)', 'Phenytoin (increased levels)', 'ACE inhibitors/ARBs (hyperkalaemia)', 'Ciclosporin (increased nephrotoxicity)'],
    pregnancyCategory: 'Avoid if possible - Category C/D',
    breastfeedingSafety: 'Avoid in neonatal jaundice/G6PD deficiency',
    maxDailyDose: '1920mg (standard), higher for PCP',
    monitoringRequired: ['FBC', 'U&E', 'LFTs']
  },

  // ==================== ANALGESICS (Non-opioid) ====================
  {
    name: 'Paracetamol (Acetaminophen)',
    genericName: 'Paracetamol',
    category: 'Analgesics',
    subcategory: 'Non-opioid',
    formulations: ['Tablet 500mg', 'Tablet 1g', 'Caplet 500mg', 'Suspension 120mg/5ml', 'Suspension 250mg/5ml', 'Suppository 125mg', 'Suppository 250mg', 'Suppository 500mg', 'Infusion 1g/100ml'],
    dosages: [
      { indication: 'Pain/Fever', adult: '0.5-1g Q4-6H (max 4g/day)', pediatric: '15mg/kg Q4-6H', elderly: '500mg-1g Q6H (max 3g/day in frail elderly)' },
      { indication: 'IV (perioperative)', adult: '1g Q6H IV (infuse over 15 min)', elderly: '15mg/kg (max 3g/day if <50kg)' }
    ],
    routes: ['Oral', 'PR', 'IV'],
    frequencies: ['Q4H', 'Q6H', 'QDS', 'TDS', 'PRN'],
    gfrAdjustments: [
      { gfrRange: '>30', gfrMin: 30, gfrMax: 999, adjustedDose: 'No adjustment', adjustedFrequency: 'Q4-6H', notes: 'Normal dosing', contraindicated: false },
      { gfrRange: '10-29', gfrMin: 10, gfrMax: 29, adjustedDose: '500mg-1g', adjustedFrequency: 'Q6-8H', notes: 'Extend interval', contraindicated: false },
      { gfrRange: '<10', gfrMin: 0, gfrMax: 9, adjustedDose: '500mg', adjustedFrequency: 'Q8H', notes: 'Reduce dose and extend interval', contraindicated: false }
    ],
    warnings: ['Hepatotoxic in overdose - max 4g/day (2-3g in liver disease)', 'Caution in chronic alcohol use', 'Check for paracetamol in combination products to avoid double-dosing', 'Weight-based dosing if <50kg'],
    sideEffects: ['Hepatotoxicity (overdose)', 'Rash (rare)', 'Blood dyscrasias (rare)', 'Hypotension (IV, if infused too fast)'],
    contraindications: ['Severe hepatic impairment', 'Active liver disease (relative)'],
    interactions: ['Warfarin (enhanced effect with regular use)', 'Carbamazepine (increased hepatotoxicity risk)', 'Alcohol (increased hepatotoxicity)'],
    pregnancyCategory: 'Safe - Category A/B',
    breastfeedingSafety: 'Compatible',
    maxDailyDose: '4g (3g in elderly/liver disease/underweight)'
  },

  // ==================== NSAIDs ====================
  {
    name: 'Ibuprofen',
    genericName: 'Ibuprofen',
    category: 'Anti-inflammatories',
    subcategory: 'NSAIDs',
    formulations: ['Tablet 200mg', 'Tablet 400mg', 'Tablet 600mg', 'Suspension 100mg/5ml', 'Gel 5%', 'Gel 10%'],
    dosages: [
      { indication: 'Pain/inflammation', adult: '200-400mg TDS with food' },
      { indication: 'Severe inflammation', adult: '600mg TDS-QDS with food' }
    ],
    routes: ['Oral', 'Topical'],
    frequencies: ['TDS', 'QDS', 'BD', 'PRN'],
    gfrAdjustments: [
      { gfrRange: '>60', gfrMin: 60, gfrMax: 999, adjustedDose: 'No adjustment - use lowest effective dose', adjustedFrequency: 'TDS', notes: 'Use shortest duration possible', contraindicated: false },
      { gfrRange: '30-59', gfrMin: 30, gfrMax: 59, adjustedDose: '200-400mg', adjustedFrequency: 'BD', notes: 'Use with extreme caution; monitor renal function', contraindicated: false },
      { gfrRange: '<30', gfrMin: 0, gfrMax: 29, adjustedDose: 'AVOID', adjustedFrequency: '', notes: 'Contraindicated in severe renal impairment', contraindicated: true }
    ],
    warnings: ['GI bleeding/ulceration risk', 'Cardiovascular risk with prolonged use', 'Renal impairment risk', 'Avoid in aspirin-sensitive asthma', 'Avoid in 3rd trimester pregnancy', 'Take with food'],
    sideEffects: ['Dyspepsia', 'Nausea', 'GI bleeding', 'Headache', 'Dizziness', 'Fluid retention', 'Hypertension', 'Renal impairment', 'Bronchospasm'],
    contraindications: ['Active GI bleeding/ulceration', 'Severe renal impairment (GFR <30)', 'Severe heart failure', 'History of NSAID-induced asthma', 'Coagulation defects', '3rd trimester pregnancy'],
    interactions: ['Warfarin/anticoagulants (increased bleeding)', 'Aspirin (reduced cardioprotection)', 'ACE inhibitors/ARBs (reduced effect, renal risk)', 'Lithium (increased levels)', 'Methotrexate (increased toxicity)', 'SSRIs (increased GI bleeding risk)', 'Corticosteroids (increased GI risk)'],
    pregnancyCategory: 'Avoid 3rd trimester - Category C/D',
    breastfeedingSafety: 'Compatible in low dose short term',
    maxDailyDose: '2400mg'
  },
  {
    name: 'Diclofenac',
    genericName: 'Diclofenac',
    category: 'Anti-inflammatories',
    subcategory: 'NSAIDs',
    formulations: ['Tablet 25mg', 'Tablet 50mg', 'SR Tablet 75mg', 'SR Tablet 100mg', 'Injection 75mg/3ml', 'Suppository 50mg', 'Suppository 100mg', 'Gel 1%'],
    dosages: [
      { indication: 'Pain/inflammation', adult: '50mg TDS or 75mg BD oral' },
      { indication: 'Acute pain (IM)', adult: '75mg deep IM (max 2 days)' },
      { indication: 'Post-operative pain', adult: '75mg IM then 50mg TDS oral' }
    ],
    routes: ['Oral', 'IM', 'PR', 'Topical'],
    frequencies: ['TDS', 'BD', 'PRN'],
    gfrAdjustments: [
      { gfrRange: '>60', gfrMin: 60, gfrMax: 999, adjustedDose: 'Lowest effective dose', adjustedFrequency: 'BD-TDS', notes: 'Short courses preferred', contraindicated: false },
      { gfrRange: '30-59', gfrMin: 30, gfrMax: 59, adjustedDose: '25-50mg', adjustedFrequency: 'BD', notes: 'Use with extreme caution', contraindicated: false },
      { gfrRange: '<30', gfrMin: 0, gfrMax: 29, adjustedDose: 'AVOID', adjustedFrequency: '', notes: 'Contraindicated', contraindicated: true }
    ],
    warnings: ['Cardiovascular risk (higher than ibuprofen/naproxen)', 'GI bleeding risk', 'IM injection: max 2 days duration', 'Avoid in established cardiovascular disease'],
    sideEffects: ['Dyspepsia', 'GI bleeding', 'Raised ALT/AST', 'Headache', 'Dizziness', 'Rash', 'Fluid retention', 'Cardiovascular events'],
    contraindications: ['Active GI bleeding', 'Severe hepatic/renal/cardiac failure', 'Ischaemic heart disease', 'Cerebrovascular disease', 'Peripheral arterial disease'],
    interactions: ['Same as ibuprofen', 'Digoxin (increased levels)', 'Quinolones (seizure risk)'],
    pregnancyCategory: 'Avoid 3rd trimester - Category C/D',
    breastfeedingSafety: 'Compatible in short courses',
    maxDailyDose: '150mg'
  },
  {
    name: 'Ketorolac',
    genericName: 'Ketorolac',
    category: 'Anti-inflammatories',
    subcategory: 'NSAIDs',
    formulations: ['Tablet 10mg', 'Injection 10mg/ml', 'Injection 30mg/ml'],
    dosages: [
      { indication: 'Acute post-op pain', adult: '10mg Q4-6H oral (max 40mg/day) or 10-30mg IM/IV Q6H' },
      { indication: 'Max duration', adult: 'MAXIMUM 5 DAYS total (2 days IM/IV, 7 days oral, 5 days combined)' }
    ],
    routes: ['Oral', 'IM', 'IV'],
    frequencies: ['Q6H', 'QDS', 'PRN'],
    gfrAdjustments: [
      { gfrRange: '>60', gfrMin: 60, gfrMax: 999, adjustedDose: '10-15mg', adjustedFrequency: 'Q6H', notes: 'Use lowest effective dose for shortest time', contraindicated: false },
      { gfrRange: '30-59', gfrMin: 30, gfrMax: 59, adjustedDose: '10mg', adjustedFrequency: 'Q8H', notes: 'Reduce dose; monitor renal function', contraindicated: false },
      { gfrRange: '<30', gfrMin: 0, gfrMax: 29, adjustedDose: 'CONTRAINDICATED', adjustedFrequency: '', notes: 'Do not use', contraindicated: true }
    ],
    warnings: ['MAX 5 DAYS TREATMENT', 'Potent NSAID - high GI bleeding risk', 'Not for minor or chronic pain', 'Not for obstetric analgesia'],
    sideEffects: ['GI bleeding', 'Renal impairment', 'Nausea', 'Headache', 'Drowsiness', 'Oedema'],
    contraindications: ['History of peptic ulcer/GI bleeding', 'Renal impairment', 'Hypovolaemia', 'Coagulation disorders', 'Aspirin-sensitive asthma', 'Use >5 days'],
    interactions: ['Anticoagulants (high bleeding risk)', 'Other NSAIDs (avoid combination)', 'Probenecid (increased ketorolac levels)'],
    pregnancyCategory: 'Contraindicated - Category C/D',
    breastfeedingSafety: 'Use with caution',
    maxDailyDose: '40mg oral, 90mg IM/IV (60mg in elderly/renal impairment)'
  },

  // ==================== OPIOID ANALGESICS ====================
  {
    name: 'Tramadol',
    genericName: 'Tramadol',
    category: 'Opioid Analgesics',
    subcategory: 'Weak opioid',
    formulations: ['Capsule 50mg', 'SR Tablet 100mg', 'SR Tablet 200mg', 'Injection 50mg/ml', 'Drops 100mg/ml'],
    dosages: [
      { indication: 'Moderate-severe pain', adult: '50-100mg Q4-6H oral', elderly: '50mg Q6-8H' },
      { indication: 'IV/IM', adult: '50-100mg Q4-6H IV/IM' },
      { indication: 'Max dose', adult: '400mg/day (300mg in elderly)' }
    ],
    routes: ['Oral', 'IV', 'IM'],
    frequencies: ['Q4H', 'Q6H', 'Q8H', 'QDS', 'TDS', 'PRN'],
    gfrAdjustments: [
      { gfrRange: '>30', gfrMin: 30, gfrMax: 999, adjustedDose: 'No adjustment', adjustedFrequency: 'Q4-6H', notes: 'Normal dosing', contraindicated: false },
      { gfrRange: '10-29', gfrMin: 10, gfrMax: 29, adjustedDose: '50mg', adjustedFrequency: 'Q8-12H', notes: 'Reduce dose and extend interval', contraindicated: false },
      { gfrRange: '<10', gfrMin: 0, gfrMax: 9, adjustedDose: '50mg', adjustedFrequency: 'Q12H', notes: 'Max 200mg/day', contraindicated: false }
    ],
    warnings: ['Seizure risk (especially with SSRIs/SNRIs)', 'Serotonin syndrome risk', 'Dependence potential', 'Not for porphyria', 'Reduce dose in elderly'],
    sideEffects: ['Nausea', 'Vomiting', 'Dizziness', 'Drowsiness', 'Constipation', 'Headache', 'Sweating', 'Seizures'],
    contraindications: ['Uncontrolled epilepsy', 'Concurrent MAOIs', 'Severe hepatic impairment', 'Acute alcohol/hypnotic/opioid intoxication'],
    interactions: ['SSRIs/SNRIs (serotonin syndrome)', 'MAOIs (contraindicated)', 'Carbamazepine (reduced tramadol effect)', 'Warfarin (enhanced effect)', 'TCAs (seizure risk)'],
    pregnancyCategory: 'Avoid unless essential - Category C',
    breastfeedingSafety: 'Avoid',
    maxDailyDose: '400mg (300mg in elderly)'
  },
  {
    name: 'Morphine',
    genericName: 'Morphine Sulphate',
    category: 'Opioid Analgesics',
    subcategory: 'Strong opioid',
    formulations: ['Tablet IR 10mg', 'Tablet IR 20mg', 'Tablet MR 10mg', 'Tablet MR 30mg', 'Tablet MR 60mg', 'Oral solution 10mg/5ml', 'Injection 10mg/ml', 'Injection 15mg/ml', 'Injection 30mg/ml'],
    dosages: [
      { indication: 'Acute pain (opioid-naive)', adult: '5-10mg Q4H oral IR or 2.5-5mg IV Q4H', elderly: '2.5-5mg Q4-6H' },
      { indication: 'Chronic pain', adult: 'Titrate from 5-10mg IR Q4H, then convert to MR' },
      { indication: 'PCA', adult: '1mg bolus, 5-min lockout' }
    ],
    routes: ['Oral', 'IV', 'IM', 'SC'],
    frequencies: ['Q4H', 'Q6H', 'Q12H', 'PRN'],
    gfrAdjustments: [
      { gfrRange: '>50', gfrMin: 50, gfrMax: 999, adjustedDose: 'No adjustment', adjustedFrequency: 'Q4H', notes: 'Start low and titrate', contraindicated: false },
      { gfrRange: '20-49', gfrMin: 20, gfrMax: 49, adjustedDose: '50-75% of standard', adjustedFrequency: 'Q6-8H', notes: 'Active metabolites accumulate', contraindicated: false },
      { gfrRange: '10-19', gfrMin: 10, gfrMax: 19, adjustedDose: '25-50% of standard', adjustedFrequency: 'Q8-12H', notes: 'High risk of accumulation - use alternative', contraindicated: false },
      { gfrRange: '<10', gfrMin: 0, gfrMax: 9, adjustedDose: 'Avoid - use fentanyl or oxycodone', adjustedFrequency: '', notes: 'Contraindicated - morphine-6-glucuronide accumulates causing respiratory depression', contraindicated: true }
    ],
    warnings: ['Respiratory depression (especially with renal impairment)', 'Sedation', 'Physical dependence', 'Always prescribe laxatives concurrently', 'Have naloxone available', 'M6G metabolite accumulates in renal failure'],
    sideEffects: ['Constipation', 'Nausea', 'Vomiting', 'Drowsiness', 'Respiratory depression', 'Pruritis', 'Urinary retention', 'Hypotension', 'Miosis'],
    contraindications: ['Respiratory depression', 'Acute alcoholism', 'Paralytic ileus', 'Raised intracranial pressure', 'Phaeochromocytoma', 'Severe hepatic impairment'],
    interactions: ['Benzodiazepines (respiratory depression)', 'MAOIs (severe reaction - avoid 14 days)', 'CNS depressants (enhanced sedation)', 'Naloxone (reversal agent)', 'Rifampicin (reduced morphine effect)'],
    pregnancyCategory: 'Use if essential - Category C',
    breastfeedingSafety: 'Compatible in therapeutic doses',
    maxDailyDose: 'No absolute maximum - titrate to effect',
    monitoringRequired: ['Respiratory rate', 'Pain scores', 'Sedation score', 'Blood pressure']
  },
  {
    name: 'Fentanyl',
    genericName: 'Fentanyl',
    category: 'Opioid Analgesics',
    subcategory: 'Strong opioid',
    formulations: ['Injection 50mcg/ml (2ml, 10ml)', 'Transdermal patch 12mcg/h', 'Transdermal patch 25mcg/h', 'Transdermal patch 50mcg/h', 'Transdermal patch 75mcg/h', 'Transdermal patch 100mcg/h'],
    dosages: [
      { indication: 'Perioperative/procedural', adult: '25-100mcg IV bolus (titrate)' },
      { indication: 'PCA', adult: '20mcg bolus, 5-min lockout' },
      { indication: 'Chronic pain (patch)', adult: 'Start with 12-25mcg/h patch, change Q72H' }
    ],
    routes: ['IV', 'IM', 'SC', 'Transdermal'],
    frequencies: ['PRN', 'Q72H', 'Continuous infusion'],
    gfrAdjustments: [
      { gfrRange: '>10', gfrMin: 10, gfrMax: 999, adjustedDose: 'No significant adjustment', adjustedFrequency: 'Standard', notes: 'Preferred opioid in renal impairment - no active metabolites', contraindicated: false },
      { gfrRange: '<10', gfrMin: 0, gfrMax: 9, adjustedDose: 'Start 25-50% lower', adjustedFrequency: 'Standard', notes: 'Mild accumulation possible - start low', contraindicated: false }
    ],
    warnings: ['Highly potent - 100x morphine', 'Respiratory depression', 'Chest wall rigidity at high IV doses', 'Patches: avoid heat exposure (increased absorption)', 'Patches only for opioid-tolerant patients', 'Serotonin syndrome with SSRIs/MAOIs'],
    sideEffects: ['Respiratory depression', 'Nausea', 'Constipation', 'Drowsiness', 'Bradycardia', 'Chest wall rigidity', 'Pruritis'],
    contraindications: ['Opioid-naive patients (patches)', 'Respiratory depression', 'Paralytic ileus', 'Acute asthma', 'Concurrent MAOIs'],
    interactions: ['CYP3A4 inhibitors (increased fentanyl levels)', 'Benzodiazepines (respiratory depression)', 'MAOIs (serotonin syndrome)', 'Grapefruit juice (increased levels)'],
    pregnancyCategory: 'Use if essential - Category C',
    breastfeedingSafety: 'Use with caution',
    maxDailyDose: 'Titrate to effect - no fixed maximum',
    monitoringRequired: ['Respiratory rate', 'O2 saturation', 'Sedation score', 'Blood pressure']
  },
  {
    name: 'Pentazocine',
    genericName: 'Pentazocine',
    category: 'Opioid Analgesics',
    subcategory: 'Mixed agonist-antagonist',
    formulations: ['Tablet 25mg', 'Injection 30mg/ml'],
    dosages: [
      { indication: 'Moderate pain', adult: '25-50mg Q3-4H oral or 30-60mg Q3-4H IM/SC/IV' }
    ],
    routes: ['Oral', 'IM', 'SC', 'IV'],
    frequencies: ['Q3H', 'Q4H', 'PRN'],
    gfrAdjustments: [
      { gfrRange: '>30', gfrMin: 30, gfrMax: 999, adjustedDose: 'No adjustment', adjustedFrequency: 'Q3-4H', notes: 'Normal dosing', contraindicated: false },
      { gfrRange: '<30', gfrMin: 0, gfrMax: 29, adjustedDose: 'Reduce dose by 25-50%', adjustedFrequency: 'Q6H', notes: 'Accumulation risk', contraindicated: false }
    ],
    warnings: ['May precipitate withdrawal in opioid-dependent patients', 'Hallucinations possible', 'Tissue damage with repeated IM/SC injections', 'Common in Nigerian practice'],
    sideEffects: ['Nausea', 'Dizziness', 'Euphoria/dysphoria', 'Hallucinations', 'Sweating', 'Injection site damage'],
    contraindications: ['Opioid dependence', 'Raised intracranial pressure', 'Head injury'],
    interactions: ['Other opioids (may reverse effect)', 'CNS depressants', 'MAOIs'],
    pregnancyCategory: 'Avoid - Category C',
    breastfeedingSafety: 'Avoid',
    maxDailyDose: '600mg oral, 360mg parenteral'
  },

  // ==================== ANTICOAGULANTS ====================
  {
    name: 'Enoxaparin (Clexane)',
    genericName: 'Enoxaparin',
    category: 'Anticoagulants',
    subcategory: 'Low Molecular Weight Heparin',
    formulations: ['Injection 20mg/0.2ml', 'Injection 40mg/0.4ml', 'Injection 60mg/0.6ml', 'Injection 80mg/0.8ml', 'Injection 100mg/1ml', 'Injection 120mg/0.8ml', 'Injection 150mg/1ml'],
    dosages: [
      { indication: 'DVT prophylaxis', adult: '40mg OD SC' },
      { indication: 'DVT/PE treatment', adult: '1mg/kg BD SC or 1.5mg/kg OD SC' },
      { indication: 'Post-surgical prophylaxis', adult: '40mg OD SC (start 6-12h post-op)', elderly: '20mg OD SC if <45kg' }
    ],
    routes: ['SC'],
    frequencies: ['OD', 'BD'],
    gfrAdjustments: [
      { gfrRange: '>30', gfrMin: 30, gfrMax: 999, adjustedDose: 'No adjustment', adjustedFrequency: 'Standard', notes: 'Normal dosing', contraindicated: false },
      { gfrRange: '15-29', gfrMin: 15, gfrMax: 29, adjustedDose: 'Treatment: 1mg/kg OD; Prophylaxis: 20mg OD', adjustedFrequency: 'OD', notes: 'Significant accumulation - monitor anti-Xa', contraindicated: false },
      { gfrRange: '<15', gfrMin: 0, gfrMax: 14, adjustedDose: 'Avoid or use UFH', adjustedFrequency: '', notes: 'Use unfractionated heparin instead', contraindicated: true }
    ],
    warnings: ['Risk of epidural/spinal haematoma with neuraxial anaesthesia', 'HIT (Heparin-Induced Thrombocytopenia)', 'Do NOT give IM', 'Monitor platelet count', 'Rotate injection sites', 'Protamine only partially reverses'],
    sideEffects: ['Injection site bruising/haematoma', 'Bleeding', 'Thrombocytopenia (HIT)', 'Elevated ALT', 'Hyperkalaemia', 'Osteoporosis (long-term use)'],
    contraindications: ['Active major bleeding', 'HIT (current/history)', 'Severe uncontrolled hypertension', 'Bacterial endocarditis'],
    interactions: ['Other anticoagulants (increased bleeding)', 'Antiplatelets (increased bleeding)', 'NSAIDs (increased bleeding)', 'Spironolactone (hyperkalaemia)', 'ACE inhibitors (hyperkalaemia)'],
    pregnancyCategory: 'Safe - Category B (preferred anticoagulant in pregnancy)',
    breastfeedingSafety: 'Compatible',
    monitoringRequired: ['Anti-Xa levels (if renal impairment/obesity/pregnancy)', 'Platelet count days 5-14', 'Signs of bleeding']
  },
  {
    name: 'Heparin (Unfractionated)',
    genericName: 'Heparin Sodium',
    category: 'Anticoagulants',
    subcategory: 'Unfractionated Heparin',
    formulations: ['Injection 1000 units/ml', 'Injection 5000 units/ml', 'Injection 25000 units/5ml'],
    dosages: [
      { indication: 'DVT prophylaxis', adult: '5000 units BD-TDS SC' },
      { indication: 'DVT/PE treatment', adult: '80 units/kg IV bolus then 18 units/kg/h infusion' },
      { indication: 'Line flushing', adult: '10 units/ml flush PRN' }
    ],
    routes: ['SC', 'IV'],
    frequencies: ['BD', 'TDS', 'Continuous infusion'],
    gfrAdjustments: [
      { gfrRange: '>0', gfrMin: 0, gfrMax: 999, adjustedDose: 'No adjustment for prophylactic dose', adjustedFrequency: 'Standard', notes: 'Safe in all levels of renal impairment; preferred over LMWH in severe renal failure', contraindicated: false }
    ],
    warnings: ['APTT monitoring essential for therapeutic dosing', 'HIT risk (higher than LMWH)', 'Protamine for reversal', 'Osteoporosis with long-term use'],
    sideEffects: ['Bleeding', 'HIT', 'Osteoporosis', 'Alopecia', 'Hyperkalaemia', 'Injection site reactions'],
    contraindications: ['Active bleeding', 'HIT', 'Severe hypertension', 'Thrombocytopenia'],
    interactions: ['Other anticoagulants', 'Antiplatelets', 'NSAIDs', 'IV GTN (reduced heparin effect)'],
    pregnancyCategory: 'Safe - Category C',
    breastfeedingSafety: 'Compatible',
    monitoringRequired: ['APTT (aim 1.5-2.5x control for treatment)', 'Platelets day 5', 'Signs of bleeding']
  },
  {
    name: 'Warfarin',
    genericName: 'Warfarin',
    category: 'Anticoagulants',
    subcategory: 'Vitamin K antagonist',
    formulations: ['Tablet 0.5mg', 'Tablet 1mg', 'Tablet 3mg', 'Tablet 5mg'],
    dosages: [
      { indication: 'DVT/PE', adult: 'Loading: 5-10mg OD for 2-3 days then adjust by INR' },
      { indication: 'AF / mechanical valve', adult: 'Maintenance: 3-9mg OD adjusted by INR' }
    ],
    routes: ['Oral'],
    frequencies: ['OD'],
    gfrAdjustments: [
      { gfrRange: '>15', gfrMin: 15, gfrMax: 999, adjustedDose: 'No adjustment but may be more sensitive', adjustedFrequency: 'OD', notes: 'May need lower doses due to altered protein binding', contraindicated: false },
      { gfrRange: '<15', gfrMin: 0, gfrMax: 14, adjustedDose: 'Start at lower dose', adjustedFrequency: 'OD', notes: 'Increased bleeding risk; closer INR monitoring needed', contraindicated: false }
    ],
    warnings: ['Requires regular INR monitoring', 'Target INR depends on indication (2-3 for DVT/PE, 2.5-3.5 for mechanical valves)', 'Hold 5 days pre-surgery', 'Vitamin K for reversal (1-5mg IV/oral)', 'Diet consistency (vitamin K foods)', 'Teratogenic'],
    sideEffects: ['Bleeding', 'Bruising', 'Skin necrosis (rare, early treatment)', 'Purple toe syndrome', 'Alopecia', 'Rash'],
    contraindications: ['Pregnancy (1st & 3rd trimester)', 'Active bleeding', 'Severe hypertension', 'Peptic ulcer', 'Cerebral aneurysm', 'Within 72h of surgery/trauma'],
    interactions: ['MANY interactions - always check', 'Antibiotics (variable effect)', 'NSAIDs (bleeding risk)', 'Amiodarone (increased INR)', 'Phenytoin (variable)', 'Alcohol (variable)', 'Cranberry juice (increased INR)', 'St Johns Wort (reduced INR)'],
    pregnancyCategory: 'CONTRAINDICATED - Category X',
    breastfeedingSafety: 'Compatible',
    monitoringRequired: ['INR (daily when starting, then weekly, then monthly when stable)', 'Signs of bleeding']
  },

  // ==================== ANTIEMETICS ====================
  {
    name: 'Ondansetron',
    genericName: 'Ondansetron',
    category: 'Antiemetics',
    subcategory: '5-HT3 receptor antagonist',
    formulations: ['Tablet 4mg', 'Tablet 8mg', 'ODT 4mg', 'ODT 8mg', 'Injection 2mg/ml (2ml, 4ml)', 'Syrup 4mg/5ml'],
    dosages: [
      { indication: 'Post-operative N&V', adult: '4mg IV at induction or 4-8mg BD-TDS oral' },
      { indication: 'Chemotherapy-induced N&V', adult: '8mg IV pre-chemo then 8mg BD oral' },
      { indication: 'Severe N&V', adult: '4-8mg Q8H IV/oral' }
    ],
    routes: ['Oral', 'IV', 'IM', 'SL'],
    frequencies: ['BD', 'TDS', 'Q8H', 'STAT', 'PRN'],
    gfrAdjustments: [
      { gfrRange: '>0', gfrMin: 0, gfrMax: 999, adjustedDose: 'No adjustment required', adjustedFrequency: 'Standard', notes: 'Hepatic metabolism - reduce in hepatic impairment', contraindicated: false }
    ],
    warnings: ['QT prolongation risk', 'Max 16mg as single IV dose', 'Constipation common', 'Headache common', 'Do NOT use in congenital long QT syndrome'],
    sideEffects: ['Headache', 'Constipation', 'Flushing', 'QT prolongation', 'Dizziness'],
    contraindications: ['Congenital long QT syndrome', 'Concurrent apomorphine'],
    interactions: ['QT-prolonging drugs', 'Tramadol (may reduce analgesic effect)', 'Apomorphine (profound hypotension)'],
    pregnancyCategory: 'Safe - Category B',
    breastfeedingSafety: 'Use with caution',
    maxDailyDose: '32mg (24mg oral, 16mg IV single dose)'
  },
  {
    name: 'Metoclopramide',
    genericName: 'Metoclopramide',
    category: 'Antiemetics',
    subcategory: 'Dopamine antagonist / prokinetic',
    formulations: ['Tablet 10mg', 'Injection 5mg/ml (2ml)', 'Syrup 5mg/5ml'],
    dosages: [
      { indication: 'Nausea/vomiting', adult: '10mg TDS oral/IV/IM (max 30mg/day or 0.5mg/kg/day)', elderly: '5mg TDS' },
      { indication: 'Post-operative N&V', adult: '10mg IV' }
    ],
    routes: ['Oral', 'IV', 'IM'],
    frequencies: ['TDS', 'STAT', 'PRN'],
    gfrAdjustments: [
      { gfrRange: '>30', gfrMin: 30, gfrMax: 999, adjustedDose: 'No adjustment', adjustedFrequency: 'TDS', notes: 'Normal dosing', contraindicated: false },
      { gfrRange: '15-29', gfrMin: 15, gfrMax: 29, adjustedDose: '5mg', adjustedFrequency: 'TDS', notes: 'Reduce dose by 50%', contraindicated: false },
      { gfrRange: '<15', gfrMin: 0, gfrMax: 14, adjustedDose: '5mg', adjustedFrequency: 'BD', notes: 'Reduce dose by 50-75%', contraindicated: false }
    ],
    warnings: ['Extrapyramidal side effects (especially in young women)', 'Tardive dyskinesia with prolonged use', 'MAX 5 DAYS treatment recommended', 'Avoid in Parkinsons disease'],
    sideEffects: ['Drowsiness', 'Restlessness', 'Extrapyramidal effects (acute dystonia)', 'Tardive dyskinesia', 'Galactorrhoea', 'Depression'],
    contraindications: ['GI obstruction/perforation', 'Phaeochromocytoma', 'Parkinsons disease', 'Epilepsy', '3-4 days post-GI surgery'],
    interactions: ['Opioids (antagonistic on GI motility)', 'Levodopa (antagonistic)', 'Anticholinergics (antagonistic)', 'SSRIs (increased extrapyramidal risk)'],
    pregnancyCategory: 'Use if essential - Category A',
    breastfeedingSafety: 'Compatible in short courses',
    maxDailyDose: '30mg (0.5mg/kg/day)'
  },

  // ==================== CORTICOSTEROIDS ====================
  {
    name: 'Hydrocortisone',
    genericName: 'Hydrocortisone',
    category: 'Corticosteroids',
    subcategory: 'Glucocorticoid',
    formulations: ['Tablet 10mg', 'Tablet 20mg', 'Injection 100mg powder', 'Cream 0.5%', 'Cream 1%', 'Ointment 1%'],
    dosages: [
      { indication: 'Adrenal crisis / severe allergic reaction', adult: '100-200mg IV stat then 50-100mg Q6-8H' },
      { indication: 'Septic shock', adult: '50mg Q6H IV' },
      { indication: 'Perioperative steroid cover', adult: '100mg IV at induction + 50mg Q8H for 24-72h' },
      { indication: 'Mild inflammatory skin condition', adult: 'Cream/ointment 1% BD to affected area' }
    ],
    routes: ['IV', 'IM', 'Oral', 'Topical'],
    frequencies: ['Q6H', 'Q8H', 'BD', 'STAT'],
    gfrAdjustments: [
      { gfrRange: '>0', gfrMin: 0, gfrMax: 999, adjustedDose: 'No renal adjustment', adjustedFrequency: 'Standard', notes: 'Hepatic metabolism; may worsen fluid retention in renal impairment', contraindicated: false }
    ],
    warnings: ['Adrenal suppression with chronic use', 'Hyperglycaemia', 'Immunosuppression/infection risk', 'GI ulceration', 'Osteoporosis with long-term use', 'Do NOT stop suddenly after prolonged use'],
    sideEffects: ['Hyperglycaemia', 'Fluid retention', 'Hypertension', 'Mood changes', 'Insomnia', 'GI upset', 'Weight gain', 'Cushingoid features', 'Adrenal suppression'],
    contraindications: ['Systemic fungal infections (relative)', 'Live vaccines during immunosuppressive doses'],
    interactions: ['NSAIDs (increased GI risk)', 'Antidiabetics (may need dose increase)', 'Anticoagulants (variable effect)', 'Rifampicin (reduced steroid effect)', 'Phenytoin (reduced steroid effect)'],
    pregnancyCategory: 'Safe for short courses - Category C',
    breastfeedingSafety: 'Compatible',
    monitoringRequired: ['Blood glucose', 'Blood pressure', 'Signs of infection']
  },
  {
    name: 'Dexamethasone',
    genericName: 'Dexamethasone',
    category: 'Corticosteroids',
    subcategory: 'Glucocorticoid (potent)',
    formulations: ['Tablet 0.5mg', 'Tablet 2mg', 'Tablet 4mg', 'Injection 3.3mg/ml', 'Injection 4mg/ml'],
    dosages: [
      { indication: 'Anti-emesis (PONV)', adult: '4-8mg IV at induction' },
      { indication: 'Cerebral oedema', adult: '10mg IV stat then 4mg Q6H IV' },
      { indication: 'Severe allergic reaction / anaphylaxis adjunct', adult: '6.6mg IV stat' },
      { indication: 'Airway oedema', adult: '8mg IV' }
    ],
    routes: ['IV', 'IM', 'Oral'],
    frequencies: ['OD', 'BD', 'Q6H', 'STAT'],
    gfrAdjustments: [
      { gfrRange: '>0', gfrMin: 0, gfrMax: 999, adjustedDose: 'No renal adjustment', adjustedFrequency: 'Standard', notes: 'Hepatic metabolism', contraindicated: false }
    ],
    warnings: ['Potent: 0.75mg dexamethasone = 20mg hydrocortisone', 'Hyperglycaemia (especially in diabetics)', 'Immunosuppression', 'Adrenal suppression', 'Avoid abrupt withdrawal after >3 weeks'],
    sideEffects: ['Hyperglycaemia', 'Insomnia', 'Mood changes', 'GI irritation', 'Immunosuppression', 'Adrenal suppression'],
    contraindications: ['Systemic fungal infections', 'Cerebral malaria'],
    interactions: ['Same as hydrocortisone', 'Fluoroquinolones (increased tendon rupture risk)'],
    pregnancyCategory: 'Use if essential - Category C',
    breastfeedingSafety: 'Compatible in short courses',
    monitoringRequired: ['Blood glucose (especially diabetics)', 'Blood pressure']
  },
  {
    name: 'Prednisolone',
    genericName: 'Prednisolone',
    category: 'Corticosteroids',
    subcategory: 'Glucocorticoid',
    formulations: ['Tablet 1mg', 'Tablet 5mg', 'Tablet 25mg', 'Soluble tablet 5mg', 'Syrup 15mg/5ml'],
    dosages: [
      { indication: 'Anti-inflammatory / immunosuppressive', adult: '20-60mg OD then taper' },
      { indication: 'Allergic conditions', adult: '20-40mg OD for 5-7 days' },
      { indication: 'Asthma exacerbation', adult: '40-50mg OD for 5-7 days' }
    ],
    routes: ['Oral'],
    frequencies: ['OD', 'BD'],
    gfrAdjustments: [
      { gfrRange: '>0', gfrMin: 0, gfrMax: 999, adjustedDose: 'No renal adjustment', adjustedFrequency: 'OD', notes: 'Hepatic metabolism', contraindicated: false }
    ],
    warnings: ['Take in morning with food', 'Taper gradually if >3 weeks use', 'Osteoporosis risk - consider bisphosphonate + calcium/vit D for long-term use', 'Steroid card for patients on >3 weeks treatment'],
    sideEffects: ['Weight gain', 'Cushingoid appearance', 'Hyperglycaemia', 'Mood changes', 'Insomnia', 'Dyspepsia', 'Osteoporosis', 'Muscle weakness', 'Skin thinning'],
    contraindications: ['Systemic fungal infections'],
    interactions: ['NSAIDs (GI risk)', 'Antidiabetics (reduced effect)', 'Rifampicin (reduced steroid levels)', 'Live vaccines'],
    pregnancyCategory: 'Use if essential - Category C',
    breastfeedingSafety: 'Compatible (minimal transfer)',
    monitoringRequired: ['Blood glucose', 'Blood pressure', 'Bone density if long-term']
  },
  {
    name: 'Triamcinolone Acetonide',
    genericName: 'Triamcinolone Acetonide',
    category: 'Corticosteroids',
    subcategory: 'Intralesional steroid',
    formulations: ['Injection 10mg/ml', 'Injection 40mg/ml'],
    dosages: [
      { indication: 'Keloid/hypertrophic scar', adult: '10-40mg/ml intralesional, max 30mg per session' },
      { indication: 'Injection interval', adult: 'Every 3-4 weeks, typically 3-6 sessions' }
    ],
    routes: ['Intralesional', 'IM'],
    frequencies: ['Every 3 weeks', 'Every 4 weeks', 'Monthly'],
    gfrAdjustments: [
      { gfrRange: '>0', gfrMin: 0, gfrMax: 999, adjustedDose: 'No adjustment for intralesional use', adjustedFrequency: 'Standard', notes: 'Minimal systemic absorption from intralesional injection', contraindicated: false }
    ],
    warnings: ['Skin atrophy at injection site', 'Hypopigmentation (especially in darker skin)', 'Inject into scar tissue only, not surrounding skin', 'Telangiectasia risk', 'Systemic effects if large doses'],
    sideEffects: ['Skin atrophy', 'Hypopigmentation', 'Telangiectasia', 'Pain at injection site', 'Menstrual irregularity', 'Cushing syndrome (if high dose/frequent)'],
    contraindications: ['Active infection at injection site', 'Sepsis'],
    interactions: ['Minimal with intralesional use'],
    pregnancyCategory: 'Use with caution - Category C',
    breastfeedingSafety: 'Compatible for intralesional use'
  },

  // ==================== GASTROINTESTINAL ====================
  {
    name: 'Omeprazole',
    genericName: 'Omeprazole',
    category: 'Gastrointestinal',
    subcategory: 'Proton Pump Inhibitor',
    formulations: ['Capsule 10mg', 'Capsule 20mg', 'Capsule 40mg', 'Injection 40mg'],
    dosages: [
      { indication: 'Gastric ulcer/GORD', adult: '20-40mg OD' },
      { indication: 'Stress ulcer prophylaxis', adult: '40mg OD IV/oral' },
      { indication: 'H. pylori eradication', adult: '20mg BD (as part of triple therapy)' }
    ],
    routes: ['Oral', 'IV'],
    frequencies: ['OD', 'BD'],
    gfrAdjustments: [
      { gfrRange: '>0', gfrMin: 0, gfrMax: 999, adjustedDose: 'No renal adjustment', adjustedFrequency: 'OD', notes: 'Hepatic metabolism', contraindicated: false }
    ],
    warnings: ['Long-term use: C. difficile risk, hypomagnesaemia, B12 deficiency, fracture risk', 'Review need for ongoing use regularly', 'May mask gastric cancer symptoms'],
    sideEffects: ['Headache', 'Nausea', 'Diarrhoea', 'Abdominal pain', 'Hypomagnesaemia (long-term)', 'B12 deficiency (long-term)', 'Fracture risk (long-term)'],
    contraindications: ['PPI hypersensitivity'],
    interactions: ['Clopidogrel (reduced antiplatelet effect - avoid combination)', 'Methotrexate (increased toxicity)', 'Phenytoin (increased levels)', 'Diazepam (increased levels)'],
    pregnancyCategory: 'Safe - Category C',
    breastfeedingSafety: 'Compatible',
    maxDailyDose: '120mg (Zollinger-Ellison)'
  },
  {
    name: 'Ranitidine (or Famotidine)',
    genericName: 'Famotidine (Ranitidine withdrawn in many countries)',
    category: 'Gastrointestinal',
    subcategory: 'H2 Receptor Antagonist',
    formulations: ['Tablet 20mg (famotidine)', 'Tablet 40mg (famotidine)', 'Injection 20mg/2ml (famotidine)'],
    dosages: [
      { indication: 'Gastric ulcer/GORD', adult: '20-40mg BD' },
      { indication: 'Stress ulcer prophylaxis', adult: '20mg BD IV' }
    ],
    routes: ['Oral', 'IV'],
    frequencies: ['BD', 'OD'],
    gfrAdjustments: [
      { gfrRange: '>50', gfrMin: 50, gfrMax: 999, adjustedDose: 'No adjustment', adjustedFrequency: 'BD', notes: 'Normal dosing', contraindicated: false },
      { gfrRange: '10-49', gfrMin: 10, gfrMax: 49, adjustedDose: '20mg', adjustedFrequency: 'OD', notes: 'Reduce frequency', contraindicated: false },
      { gfrRange: '<10', gfrMin: 0, gfrMax: 9, adjustedDose: '20mg', adjustedFrequency: 'Every 48h', notes: 'Significant reduction needed', contraindicated: false }
    ],
    warnings: ['Ranitidine withdrawn due to NDMA contamination - use famotidine instead', 'Less effective than PPIs for ulcer healing'],
    sideEffects: ['Headache', 'Dizziness', 'Constipation', 'Diarrhoea'],
    contraindications: ['H2 antagonist hypersensitivity'],
    interactions: ['Ketoconazole/itraconazole (reduced absorption)', 'Atazanavir (reduced absorption)'],
    pregnancyCategory: 'Safe - Category B',
    breastfeedingSafety: 'Compatible'
  },

  // ==================== LOCAL ANAESTHETICS ====================
  {
    name: 'Lidocaine (Lignocaine)',
    genericName: 'Lidocaine',
    category: 'Local Anaesthetics',
    subcategory: 'Amide local anaesthetic',
    formulations: ['Injection 1% (10mg/ml)', 'Injection 2% (20mg/ml)', 'Injection 1% with Adrenaline 1:200,000', 'Injection 2% with Adrenaline 1:80,000', 'Gel 2%', 'Spray 10%', 'Cream (EMLA - with prilocaine)', 'Patch 5%'],
    dosages: [
      { indication: 'Local infiltration', adult: 'Max 3mg/kg (without adrenaline) or 7mg/kg (with adrenaline)' },
      { indication: 'Digital nerve block', adult: '1-2ml of 1% per digit (WITHOUT adrenaline)' },
      { indication: 'Wound infiltration', adult: '0.5-1% concentration, max 3mg/kg' },
      { indication: 'Tumescent anaesthesia', adult: 'Max 35-55mg/kg (dilute solution with adrenaline)' }
    ],
    routes: ['SC', 'Topical', 'IV'],
    frequencies: ['STAT', 'PRN'],
    gfrAdjustments: [
      { gfrRange: '>0', gfrMin: 0, gfrMax: 999, adjustedDose: 'No adjustment for local use', adjustedFrequency: 'Standard', notes: 'Hepatic metabolism; reduce dose in severe hepatic impairment', contraindicated: false }
    ],
    warnings: ['CARDIAC TOXICITY if systemic absorption (CNS then cardiac)', 'Max dose WITHOUT adrenaline: 3mg/kg', 'Max dose WITH adrenaline: 7mg/kg', 'Intralipid 20% for lipid rescue in LA toxicity', 'Avoid adrenaline in end-arteries (fingers, toes, nose, ears, penis) - CONTROVERSIAL but evidence supports safety in digits'],
    sideEffects: ['Tingling/numbness (expected)', 'Dizziness', 'Tinnitus', 'Metallic taste (early toxicity)', 'Seizures (toxicity)', 'Cardiac arrest (severe toxicity)', 'Allergic reaction (rare with amides)'],
    contraindications: ['Known amide LA allergy (rare)', 'Complete heart block (IV use)', 'Severe myocardial disease (IV use)'],
    interactions: ['Beta-blockers (increased risk of toxicity)', 'CYP3A4 inhibitors (increased levels if systemic)', 'Other local anaesthetics (additive toxicity)'],
    pregnancyCategory: 'Safe - Category B',
    breastfeedingSafety: 'Compatible',
    maxDailyDose: '3mg/kg (plain), 7mg/kg (with adrenaline)'
  },
  {
    name: 'Bupivacaine',
    genericName: 'Bupivacaine',
    category: 'Local Anaesthetics',
    subcategory: 'Amide local anaesthetic (long-acting)',
    formulations: ['Injection 0.25% (2.5mg/ml)', 'Injection 0.5% (5mg/ml)', 'Injection 0.25% with adrenaline', 'Injection 0.5% with adrenaline', 'Injection 0.5% heavy (spinal)'],
    dosages: [
      { indication: 'Local infiltration', adult: 'Max 2mg/kg (without adrenaline) or 2.5mg/kg (with adrenaline)' },
      { indication: 'Nerve block', adult: '0.25-0.5%, max 2mg/kg' },
      { indication: 'Wound infiltration', adult: '0.25% concentration' }
    ],
    routes: ['SC', 'Epidural', 'Intrathecal'],
    frequencies: ['STAT', 'Continuous infusion'],
    gfrAdjustments: [
      { gfrRange: '>0', gfrMin: 0, gfrMax: 999, adjustedDose: 'No adjustment for local use', adjustedFrequency: 'Standard', notes: 'Hepatic metabolism', contraindicated: false }
    ],
    warnings: ['MORE CARDIOTOXIC than lidocaine', 'DO NOT use IV (cardiac arrest risk)', 'Onset 15-30 min, duration 4-8h', 'Use levobupivacaine if possible (less cardiotoxic)'],
    sideEffects: ['Same as lidocaine but higher cardiac toxicity risk', 'Prolonged block'],
    contraindications: ['IV regional anaesthesia (Bier block)', 'Paracervical block in obstetrics'],
    interactions: ['Same as lidocaine'],
    pregnancyCategory: 'Safe - Category C',
    breastfeedingSafety: 'Compatible',
    maxDailyDose: '2mg/kg (plain), 2.5mg/kg (with adrenaline)'
  },

  // ==================== FLUID & ELECTROLYTES ====================
  {
    name: 'Normal Saline (0.9% NaCl)',
    genericName: 'Sodium Chloride 0.9%',
    category: 'Fluid & Electrolytes',
    subcategory: 'Crystalloid',
    formulations: ['Infusion bag 250ml', 'Infusion bag 500ml', 'Infusion bag 1000ml', 'Ampoule 10ml', 'Irrigation solution'],
    dosages: [
      { indication: 'Fluid resuscitation', adult: '500ml-1L bolus over 15-30 min, reassess' },
      { indication: 'Maintenance', adult: '1L over 8-12 hours' },
      { indication: 'Wound irrigation', adult: 'As required' }
    ],
    routes: ['IV', 'Topical'],
    frequencies: ['Continuous', 'PRN'],
    gfrAdjustments: [
      { gfrRange: '>0', gfrMin: 0, gfrMax: 999, adjustedDose: 'Monitor fluid balance carefully', adjustedFrequency: 'As needed', notes: 'Risk of fluid overload in renal impairment', contraindicated: false }
    ],
    warnings: ['Hyperchloraemic metabolic acidosis with large volumes', 'Risk of fluid overload', 'Na+ 154mmol/L, Cl- 154mmol/L', 'Monitor electrolytes'],
    sideEffects: ['Fluid overload', 'Hyperchloraemic acidosis', 'Hypernatraemia'],
    contraindications: ['Fluid overload', 'Severe hypernatraemia'],
    interactions: [],
    pregnancyCategory: 'Safe - Category A',
    breastfeedingSafety: 'Compatible'
  },
  {
    name: 'Ringers Lactate (Hartmanns)',
    genericName: 'Sodium Lactate Compound Solution',
    category: 'Fluid & Electrolytes',
    subcategory: 'Crystalloid (balanced)',
    formulations: ['Infusion bag 500ml', 'Infusion bag 1000ml'],
    dosages: [
      { indication: 'Fluid resuscitation', adult: '500ml-1L bolus over 15-30 min' },
      { indication: 'Peri-operative fluid', adult: '1-2ml/kg/h maintenance' },
      { indication: 'Burns resuscitation (Parkland)', adult: '4ml/kg/% TBSA over first 24h (half in first 8h)' }
    ],
    routes: ['IV'],
    frequencies: ['Continuous'],
    gfrAdjustments: [
      { gfrRange: '>0', gfrMin: 0, gfrMax: 999, adjustedDose: 'Monitor carefully', adjustedFrequency: 'As needed', notes: 'Contains K+ 5mmol/L - caution in hyperkalaemia/renal failure', contraindicated: false }
    ],
    warnings: ['Contains K+ - monitor in renal impairment', 'Do NOT mix with blood products (calcium can cause clotting)', 'More physiological than N/S', 'Preferred for large volume resuscitation'],
    sideEffects: ['Fluid overload', 'Hyperkalaemia (if given rapidly in renal failure)'],
    contraindications: ['Severe hyperkalaemia', 'Do not use with blood products in same line'],
    interactions: ['Ceftriaxone (do not mix due to calcium content)'],
    pregnancyCategory: 'Safe - Category A',
    breastfeedingSafety: 'Compatible'
  },
  {
    name: '5% Dextrose (D5W)',
    genericName: 'Glucose 5%',
    category: 'Fluid & Electrolytes',
    subcategory: 'Dextrose solution',
    formulations: ['Infusion bag 500ml', 'Infusion bag 1000ml'],
    dosages: [
      { indication: 'Water replacement / maintenance', adult: '1L over 8-12h' },
      { indication: 'Hypoglycaemia', adult: '50ml 50% Dextrose IV (or 500ml D10W)' },
      { indication: 'Vehicle for drugs', adult: 'As required' }
    ],
    routes: ['IV'],
    frequencies: ['Continuous'],
    gfrAdjustments: [
      { gfrRange: '>0', gfrMin: 0, gfrMax: 999, adjustedDose: 'Monitor fluid balance', adjustedFrequency: 'As needed', notes: 'Free water - risk of hyponatraemia', contraindicated: false }
    ],
    warnings: ['Distributes as free water - can cause hyponatraemia', 'Not for resuscitation', 'Hyperglycaemia in diabetics', 'Do NOT use for fluid resuscitation'],
    sideEffects: ['Hyponatraemia', 'Hyperglycaemia', 'Fluid overload'],
    contraindications: ['Not for resuscitation', 'Avoid in diabetic ketoacidosis (until glucose <14)'],
    interactions: [],
    pregnancyCategory: 'Safe - Category A',
    breastfeedingSafety: 'Compatible'
  },

  // ==================== TETANUS PROPHYLAXIS ====================
  {
    name: 'Tetanus Toxoid Vaccine',
    genericName: 'Tetanus Toxoid (TT/Td/Tdap)',
    category: 'Tetanus Prophylaxis',
    subcategory: 'Vaccine',
    formulations: ['Injection 0.5ml (IM)'],
    dosages: [
      { indication: 'Wound prophylaxis (incomplete/unknown vaccination)', adult: '0.5ml IM stat + tetanus immunoglobulin if high-risk wound' },
      { indication: 'Booster (>10 years since last dose)', adult: '0.5ml IM stat' },
      { indication: 'Primary course', adult: '0.5ml IM at 0, 1, and 6 months' }
    ],
    routes: ['IM'],
    frequencies: ['STAT', 'Per schedule'],
    gfrAdjustments: [
      { gfrRange: '>0', gfrMin: 0, gfrMax: 999, adjustedDose: 'No adjustment', adjustedFrequency: 'Standard', notes: 'Safe in all levels of renal function', contraindicated: false }
    ],
    warnings: ['Give within 72h of wound', 'High-risk wounds: crush injuries, puncture wounds, devitalised tissue, >6h old', 'Give TIG (tetanus immunoglobulin) along with vaccine for high-risk wounds with incomplete vaccination'],
    sideEffects: ['Injection site pain', 'Mild fever', 'Malaise', 'Myalgia'],
    contraindications: ['Severe allergic reaction to previous dose', 'Acute febrile illness (defer)'],
    interactions: ['Immunosuppressive therapy may reduce response'],
    pregnancyCategory: 'Safe - recommended in pregnancy',
    breastfeedingSafety: 'Compatible'
  },
  {
    name: 'Anti-Tetanus Serum / Tetanus Immunoglobulin (TIG)',
    genericName: 'Human Tetanus Immunoglobulin',
    category: 'Tetanus Prophylaxis',
    subcategory: 'Passive immunisation',
    formulations: ['Injection 250 IU/ml'],
    dosages: [
      { indication: 'Wound prophylaxis (high-risk + incomplete vaccination)', adult: '250 IU IM (500 IU if >24h or heavily contaminated)' },
      { indication: 'Tetanus treatment', adult: '3000-6000 IU IM' }
    ],
    routes: ['IM'],
    frequencies: ['STAT'],
    gfrAdjustments: [
      { gfrRange: '>0', gfrMin: 0, gfrMax: 999, adjustedDose: 'No adjustment', adjustedFrequency: 'STAT', notes: 'Safe in renal impairment', contraindicated: false }
    ],
    warnings: ['Give at DIFFERENT site from TT vaccine', 'Give within 72h of wound', 'Not needed if fully immunised with booster within 10 years'],
    sideEffects: ['Injection site pain', 'Mild fever', 'Allergic reaction (rare)'],
    contraindications: ['IgA deficiency with anti-IgA antibodies'],
    interactions: ['Live vaccines may be less effective if given within 3 months'],
    pregnancyCategory: 'Safe - Category C',
    breastfeedingSafety: 'Compatible'
  },

  // ==================== WOUND CARE ====================
  {
    name: 'Silver Sulfadiazine (Flamazine)',
    genericName: 'Silver Sulfadiazine 1%',
    category: 'Wound Care',
    subcategory: 'Topical antimicrobial',
    formulations: ['Cream 1% (50g, 250g, 500g)'],
    dosages: [
      { indication: 'Burns wound care', adult: 'Apply 3-5mm thickness daily or BD, cover with dressing' },
      { indication: 'Infected wounds', adult: 'Apply to wound bed, cover, change daily' }
    ],
    routes: ['Topical'],
    frequencies: ['OD', 'BD'],
    gfrAdjustments: [
      { gfrRange: '>0', gfrMin: 0, gfrMax: 999, adjustedDose: 'No adjustment for topical use', adjustedFrequency: 'Standard', notes: 'Systemic absorption possible with large surface areas - use with caution', contraindicated: false }
    ],
    warnings: ['Sulfonamide hypersensitivity', 'Do NOT use on face (staining)', 'May cause transient leucopenia (check FBC weekly)', 'Avoid near cartilage (nose/ears) in some protocols', 'G6PD deficiency caution'],
    sideEffects: ['Leucopenia (transient, check FBC)', 'Skin discolouration', 'Allergic skin reaction', 'Argyria (prolonged use)'],
    contraindications: ['Sulfonamide allergy', 'Pregnancy (near term)', 'Premature infants/neonates', 'G6PD deficiency'],
    interactions: ['Enzymatic debriding agents (may be inactivated)'],
    pregnancyCategory: 'Avoid near term - Category B',
    breastfeedingSafety: 'Avoid if extensive application',
    monitoringRequired: ['FBC weekly if large areas treated']
  },
  {
    name: 'Povidone-Iodine (Betadine)',
    genericName: 'Povidone-Iodine',
    category: 'Wound Care',
    subcategory: 'Antiseptic',
    formulations: ['Solution 10%', 'Surgical scrub 7.5%', 'Ointment 10%', 'Spray'],
    dosages: [
      { indication: 'Wound antisepsis', adult: 'Apply to wound, allow to dry' },
      { indication: 'Surgical skin prep', adult: 'Apply to surgical site, allow 2 min contact time' },
      { indication: 'Wound irrigation', adult: 'Dilute to 1% for wound irrigation' }
    ],
    routes: ['Topical'],
    frequencies: ['BD', 'PRN'],
    gfrAdjustments: [
      { gfrRange: '>0', gfrMin: 0, gfrMax: 999, adjustedDose: 'No adjustment for topical', adjustedFrequency: 'Standard', notes: 'Avoid prolonged use on large areas in renal impairment (iodine absorption)', contraindicated: false }
    ],
    warnings: ['Thyroid dysfunction with prolonged/extensive use', 'Stains clothing/skin', 'Avoid in thyroid disease patients', 'Not for use on deep wounds/body cavities (iodine absorption)'],
    sideEffects: ['Skin irritation', 'Thyroid dysfunction', 'Metabolic acidosis (absorbed extensively)', 'Staining'],
    contraindications: ['Iodine hypersensitivity', 'Thyroid disorders (caution)', 'Premature infants'],
    interactions: ['Lithium (additive effect on thyroid)', 'Mercury-containing antiseptics'],
    pregnancyCategory: 'Avoid prolonged use - Category D',
    breastfeedingSafety: 'Avoid if extensive'
  },

  // ==================== ANTIDIABETICS ====================
  {
    name: 'Insulin (Soluble/Regular)',
    genericName: 'Insulin Regular (Actrapid)',
    category: 'Antidiabetics',
    subcategory: 'Short-acting insulin',
    formulations: ['Injection 100 units/ml (10ml vial)', 'Injection 100 units/ml (3ml cartridge)'],
    dosages: [
      { indication: 'Sliding scale', adult: 'Per sliding scale protocol' },
      { indication: 'DKA', adult: '0.1 units/kg/h IV infusion' },
      { indication: 'Hyperglycaemia in hospital', adult: 'Sliding scale or fixed dose SC' }
    ],
    routes: ['SC', 'IV'],
    frequencies: ['Before meals', 'Q6H', 'Continuous infusion', 'PRN'],
    gfrAdjustments: [
      { gfrRange: '>50', gfrMin: 50, gfrMax: 999, adjustedDose: 'No adjustment', adjustedFrequency: 'Standard', notes: 'Normal dosing', contraindicated: false },
      { gfrRange: '30-49', gfrMin: 30, gfrMax: 49, adjustedDose: 'Reduce by 25%', adjustedFrequency: 'Standard', notes: 'Insulin clearance reduced', contraindicated: false },
      { gfrRange: '10-29', gfrMin: 10, gfrMax: 29, adjustedDose: 'Reduce by 50%', adjustedFrequency: 'Standard', notes: 'Significant reduction - high hypo risk', contraindicated: false },
      { gfrRange: '<10', gfrMin: 0, gfrMax: 9, adjustedDose: 'Reduce by 50-75%', adjustedFrequency: 'Standard', notes: 'Very high hypoglycaemia risk - close monitoring', contraindicated: false }
    ],
    warnings: ['HYPOGLYCAEMIA risk', 'Dose reduce in renal impairment (insulin clearance reduced)', 'Monitor glucose frequently', 'Never omit insulin in Type 1 DM'],
    sideEffects: ['Hypoglycaemia', 'Weight gain', 'Injection site lipodystrophy', 'Hypokalaemia', 'Allergic reactions (rare)'],
    contraindications: ['Hypoglycaemia'],
    interactions: ['Beta-blockers (mask hypoglycaemia symptoms)', 'Corticosteroids (increased insulin needs)', 'Thiazides (increased glucose)', 'ACE inhibitors (may enhance hypoglycaemic effect)'],
    pregnancyCategory: 'Safe - Category B',
    breastfeedingSafety: 'Compatible',
    monitoringRequired: ['Blood glucose (frequently)', 'HbA1c quarterly', 'Potassium (with IV insulin)']
  },
  {
    name: 'Metformin',
    genericName: 'Metformin',
    category: 'Antidiabetics',
    subcategory: 'Biguanide',
    formulations: ['Tablet 500mg', 'Tablet 850mg', 'Tablet 1000mg', 'MR Tablet 500mg', 'MR Tablet 1000mg', 'Liquid 500mg/5ml'],
    dosages: [
      { indication: 'Type 2 DM', adult: 'Start 500mg BD with meals, increase to 1g BD (max 2g/day)' },
      { indication: 'Perioperative', adult: 'Hold 24-48h before surgery; restart when eating and renal function stable' }
    ],
    routes: ['Oral'],
    frequencies: ['BD', 'TDS'],
    gfrAdjustments: [
      { gfrRange: '>45', gfrMin: 45, gfrMax: 999, adjustedDose: 'No adjustment', adjustedFrequency: 'BD', notes: 'Normal dosing', contraindicated: false },
      { gfrRange: '30-44', gfrMin: 30, gfrMax: 44, adjustedDose: 'Max 1g/day (500mg BD)', adjustedFrequency: 'BD', notes: 'Reduce and monitor regularly', contraindicated: false },
      { gfrRange: '<30', gfrMin: 0, gfrMax: 29, adjustedDose: 'CONTRAINDICATED', adjustedFrequency: '', notes: 'Lactic acidosis risk', contraindicated: true }
    ],
    warnings: ['LACTIC ACIDOSIS risk in renal impairment', 'Hold 48h before and after contrast procedures', 'Hold perioperatively', 'Avoid in dehydration, sepsis, acute illness', 'Check B12 in long-term use'],
    sideEffects: ['Nausea', 'Diarrhoea', 'Abdominal cramps', 'Metallic taste', 'B12 deficiency', 'Lactic acidosis (rare)'],
    contraindications: ['GFR <30', 'Acute kidney injury', 'Dehydration', 'Severe infection/sepsis', 'Hepatic failure', 'Alcohol abuse', 'Heart failure (acute)'],
    interactions: ['Contrast media (withhold)', 'Alcohol (lactic acidosis risk)', 'ACE inhibitors (may enhance hypoglycaemia)'],
    pregnancyCategory: 'Use with caution - Category B',
    breastfeedingSafety: 'Compatible',
    maxDailyDose: '2g (some guidelines allow 3g)',
    monitoringRequired: ['Renal function (at least annually)', 'B12 levels', 'Blood glucose']
  },

  // ==================== ANTIHYPERTENSIVES ====================
  {
    name: 'Amlodipine',
    genericName: 'Amlodipine',
    category: 'Antihypertensives',
    subcategory: 'Calcium Channel Blocker',
    formulations: ['Tablet 5mg', 'Tablet 10mg'],
    dosages: [
      { indication: 'Hypertension', adult: '5mg OD, max 10mg OD', elderly: 'Start 2.5mg OD' },
      { indication: 'Angina', adult: '5-10mg OD' }
    ],
    routes: ['Oral'],
    frequencies: ['OD'],
    gfrAdjustments: [
      { gfrRange: '>0', gfrMin: 0, gfrMax: 999, adjustedDose: 'No adjustment', adjustedFrequency: 'OD', notes: 'Not removed by dialysis', contraindicated: false }
    ],
    warnings: ['Ankle oedema common', 'Headache especially initially', 'Avoid in acute unstable angina'],
    sideEffects: ['Ankle oedema', 'Flushing', 'Headache', 'Dizziness', 'Fatigue', 'Palpitations'],
    contraindications: ['Cardiogenic shock', 'Unstable angina', 'Significant aortic stenosis'],
    interactions: ['CYP3A4 inhibitors (increased levels)', 'Simvastatin (limit to 20mg)', 'Grapefruit juice'],
    pregnancyCategory: 'Avoid - Category C',
    breastfeedingSafety: 'Avoid',
    maxDailyDose: '10mg'
  },
  {
    name: 'Lisinopril',
    genericName: 'Lisinopril',
    category: 'Antihypertensives',
    subcategory: 'ACE Inhibitor',
    formulations: ['Tablet 2.5mg', 'Tablet 5mg', 'Tablet 10mg', 'Tablet 20mg'],
    dosages: [
      { indication: 'Hypertension', adult: '10mg OD, max 80mg OD', elderly: 'Start 2.5-5mg OD' },
      { indication: 'Heart failure', adult: 'Start 2.5mg OD, titrate up' }
    ],
    routes: ['Oral'],
    frequencies: ['OD'],
    gfrAdjustments: [
      { gfrRange: '>30', gfrMin: 30, gfrMax: 999, adjustedDose: 'Start 5-10mg', adjustedFrequency: 'OD', notes: 'Monitor K+ and creatinine at 1-2 weeks', contraindicated: false },
      { gfrRange: '10-29', gfrMin: 10, gfrMax: 29, adjustedDose: 'Start 2.5-5mg', adjustedFrequency: 'OD', notes: 'Close monitoring of K+ and renal function', contraindicated: false },
      { gfrRange: '<10', gfrMin: 0, gfrMax: 9, adjustedDose: 'Start 2.5mg', adjustedFrequency: 'OD', notes: 'Very cautious titration', contraindicated: false }
    ],
    warnings: ['Dry cough (10-15% of patients)', 'Angioedema risk (higher in Afro-Caribbean)', 'First-dose hypotension', 'Hyperkalaemia', 'Check U&E 1-2 weeks after starting/dose change', 'Hold perioperatively in some protocols'],
    sideEffects: ['Dry cough', 'Hypotension', 'Hyperkalaemia', 'Renal impairment', 'Angioedema', 'Dizziness', 'Headache'],
    contraindications: ['Bilateral renal artery stenosis', 'History of ACE inhibitor angioedema', 'Pregnancy', 'Hyperkalaemia (>5.5mmol/L)'],
    interactions: ['Potassium-sparing diuretics (hyperkalaemia)', 'NSAIDs (reduced effect + renal risk)', 'Lithium (increased levels)', 'Aliskiren (hyperkalaemia, avoid combination)'],
    pregnancyCategory: 'CONTRAINDICATED - Category D',
    breastfeedingSafety: 'Use with caution',
    monitoringRequired: ['U&E at 1-2 weeks', 'Blood pressure', 'Renal function']
  },
  {
    name: 'Losartan',
    genericName: 'Losartan',
    category: 'Antihypertensives',
    subcategory: 'Angiotensin II Receptor Blocker (ARB)',
    formulations: ['Tablet 25mg', 'Tablet 50mg', 'Tablet 100mg'],
    dosages: [
      { indication: 'Hypertension', adult: '50mg OD, max 100mg OD' },
      { indication: 'Heart failure', adult: 'Start 12.5mg OD, titrate up' }
    ],
    routes: ['Oral'],
    frequencies: ['OD'],
    gfrAdjustments: [
      { gfrRange: '>10', gfrMin: 10, gfrMax: 999, adjustedDose: 'No significant adjustment', adjustedFrequency: 'OD', notes: 'Monitor K+ and renal function', contraindicated: false },
      { gfrRange: '<10', gfrMin: 0, gfrMax: 9, adjustedDose: 'Start 25mg', adjustedFrequency: 'OD', notes: 'Use with caution', contraindicated: false }
    ],
    warnings: ['Hyperkalaemia', 'Alternative to ACE inhibitors if cough intolerance', 'Angioedema (less common than ACEI)', 'Same renal precautions as ACEI'],
    sideEffects: ['Dizziness', 'Hypotension', 'Hyperkalaemia', 'Renal impairment', 'Angioedema (rare)'],
    contraindications: ['Bilateral renal artery stenosis', 'Pregnancy', 'Severe hepatic impairment'],
    interactions: ['Same as ACE inhibitors', 'NSAIDs', 'Potassium supplements/K-sparing diuretics'],
    pregnancyCategory: 'CONTRAINDICATED - Category D',
    breastfeedingSafety: 'Avoid (limited data)',
    monitoringRequired: ['U&E', 'Blood pressure', 'Renal function']
  },
  {
    name: 'Atenolol',
    genericName: 'Atenolol',
    category: 'Antihypertensives',
    subcategory: 'Beta-blocker (cardioselective)',
    formulations: ['Tablet 25mg', 'Tablet 50mg', 'Tablet 100mg'],
    dosages: [
      { indication: 'Hypertension', adult: '25-50mg OD' },
      { indication: 'Peri-operative', adult: '25-50mg OD (do not stop abruptly)' }
    ],
    routes: ['Oral'],
    frequencies: ['OD'],
    gfrAdjustments: [
      { gfrRange: '>35', gfrMin: 35, gfrMax: 999, adjustedDose: 'No adjustment', adjustedFrequency: 'OD', notes: 'Normal dosing', contraindicated: false },
      { gfrRange: '15-34', gfrMin: 15, gfrMax: 34, adjustedDose: '50mg', adjustedFrequency: 'OD or alternate days', notes: 'Reduce dose/frequency', contraindicated: false },
      { gfrRange: '<15', gfrMin: 0, gfrMax: 14, adjustedDose: '25mg', adjustedFrequency: 'OD or alternate days', notes: 'Max 25mg/day or 50mg alternate days', contraindicated: false }
    ],
    warnings: ['Do NOT stop abruptly (rebound hypertension)', 'May mask hypoglycaemia symptoms', 'Avoid in asthma/severe COPD', 'Bradycardia'],
    sideEffects: ['Fatigue', 'Cold extremities', 'Bradycardia', 'Sleep disturbance', 'Bronchospasm'],
    contraindications: ['Asthma/severe COPD', 'Severe bradycardia', '2nd/3rd degree heart block', 'Cardiogenic shock', 'Phaeochromocytoma (without alpha-blocker)'],
    interactions: ['Verapamil/diltiazem (severe bradycardia)', 'Clonidine (rebound hypertension on withdrawal)', 'Insulin (masked hypo symptoms)'],
    pregnancyCategory: 'Use if essential - Category D',
    breastfeedingSafety: 'Compatible',
    maxDailyDose: '100mg'
  },

  // ==================== ANXIOLYTICS & SEDATIVES ====================
  {
    name: 'Diazepam',
    genericName: 'Diazepam',
    category: 'Anxiolytics & Sedatives',
    subcategory: 'Benzodiazepine',
    formulations: ['Tablet 2mg', 'Tablet 5mg', 'Tablet 10mg', 'Injection 5mg/ml (2ml)', 'Rectal solution 2.5mg', 'Rectal solution 5mg', 'Rectal solution 10mg'],
    dosages: [
      { indication: 'Acute anxiety/agitation', adult: '2-10mg oral/IM/IV', elderly: '2-5mg' },
      { indication: 'Seizures', adult: '10-20mg IV/PR' },
      { indication: 'Muscle spasm', adult: '2-15mg/day in divided doses' },
      { indication: 'Pre-operative sedation', adult: '5-10mg oral night before + 5-10mg 2h pre-op' }
    ],
    routes: ['Oral', 'IV', 'IM', 'PR'],
    frequencies: ['STAT', 'BD', 'TDS', 'Nocte', 'PRN'],
    gfrAdjustments: [
      { gfrRange: '>0', gfrMin: 0, gfrMax: 999, adjustedDose: 'Start low, titrate cautiously', adjustedFrequency: 'Standard', notes: 'Hepatic metabolism; active metabolites may accumulate in renal impairment', contraindicated: false }
    ],
    warnings: ['Respiratory depression risk', 'Paradoxical excitement in elderly', 'DEPENDENCE risk - short courses only', 'Long half-life (20-100h with active metabolites)', 'Avoid in myasthenia gravis', 'Flumazenil for reversal'],
    sideEffects: ['Drowsiness', 'Confusion', 'Ataxia', 'Amnesia', 'Respiratory depression', 'Dependence', 'Paradoxical aggression'],
    contraindications: ['Severe respiratory depression', 'Sleep apnoea', 'Myasthenia gravis', 'Severe hepatic insufficiency', 'Acute narrow-angle glaucoma'],
    interactions: ['Opioids (respiratory depression - AVOID or reduce doses)', 'Alcohol (enhanced sedation)', 'CNS depressants (enhanced sedation)'],
    pregnancyCategory: 'Avoid if possible - Category D',
    breastfeedingSafety: 'Avoid regular use',
    maxDailyDose: '30mg (anxiety); higher for seizures/muscle spasm'
  },
  {
    name: 'Midazolam',
    genericName: 'Midazolam',
    category: 'Anxiolytics & Sedatives',
    subcategory: 'Benzodiazepine (short-acting)',
    formulations: ['Injection 1mg/ml (5ml)', 'Injection 5mg/ml (2ml)', 'Buccal solution 5mg/ml', 'Tablet 7.5mg'],
    dosages: [
      { indication: 'Procedural sedation', adult: '1-2mg IV titrated (max 7.5mg)' },
      { indication: 'Pre-medication', adult: '1-2mg IV 5 min pre-procedure' },
      { indication: 'Status epilepticus (buccal)', adult: '10mg buccal' }
    ],
    routes: ['IV', 'IM', 'Buccal', 'Oral'],
    frequencies: ['STAT', 'PRN'],
    gfrAdjustments: [
      { gfrRange: '>10', gfrMin: 10, gfrMax: 999, adjustedDose: 'No significant adjustment', adjustedFrequency: 'Standard', notes: 'Hepatic metabolism', contraindicated: false },
      { gfrRange: '<10', gfrMin: 0, gfrMax: 9, adjustedDose: 'Reduce dose by 30-50%', adjustedFrequency: 'Standard', notes: 'Active metabolite accumulates', contraindicated: false }
    ],
    warnings: ['Respiratory depression', 'Onset 2-3 min IV', 'Duration 15-80 min', 'Titrate in 1mg increments', 'Have flumazenil available', 'Enhanced sedation in elderly'],
    sideEffects: ['Respiratory depression', 'Hypotension', 'Paradoxical agitation', 'Amnesia (desired effect in sedation)'],
    contraindications: ['Severe respiratory depression', 'Sleep apnoea', 'Myasthenia gravis'],
    interactions: ['Opioids (synergistic respiratory depression)', 'CYP3A4 inhibitors (increased effect)', 'Alcohol', 'Erythromycin/ketoconazole (increased midazolam levels)'],
    pregnancyCategory: 'Avoid - Category D',
    breastfeedingSafety: 'Avoid (express & discard for 24h)',
    maxDailyDose: '7.5mg IV for sedation'
  },

  // ==================== HAEMATOLOGICAL ====================
  {
    name: 'Tranexamic Acid',
    genericName: 'Tranexamic Acid',
    category: 'Haematological',
    subcategory: 'Antifibrinolytic',
    formulations: ['Tablet 500mg', 'Injection 100mg/ml (5ml)'],
    dosages: [
      { indication: 'Surgical haemorrhage', adult: '1g IV over 10 min (can repeat after 8h)' },
      { indication: 'Trauma haemorrhage (CRASH-2)', adult: '1g IV over 10 min + 1g over 8h (within 3h of injury)' },
      { indication: 'Menorrhagia', adult: '1-1.5g TDS for 3-4 days' }
    ],
    routes: ['IV', 'Oral'],
    frequencies: ['TDS', 'STAT', 'Q8H'],
    gfrAdjustments: [
      { gfrRange: '>50', gfrMin: 50, gfrMax: 999, adjustedDose: 'No adjustment', adjustedFrequency: 'Standard', notes: 'Normal dosing', contraindicated: false },
      { gfrRange: '20-49', gfrMin: 20, gfrMax: 49, adjustedDose: '10mg/kg', adjustedFrequency: 'BD', notes: 'Reduce to BD', contraindicated: false },
      { gfrRange: '<20', gfrMin: 0, gfrMax: 19, adjustedDose: '10mg/kg', adjustedFrequency: 'OD', notes: 'Reduce to OD', contraindicated: false }
    ],
    warnings: ['Give within 3h of injury for trauma (CRASH-2)', 'Seizure risk at high doses', 'Ureteric obstruction risk (thrombus in ureters)', 'Avoid in DIC'],
    sideEffects: ['Nausea', 'Vomiting', 'Diarrhoea', 'Seizures (high dose)', 'Thromboembolic events (rare)', 'Colour vision disturbance'],
    contraindications: ['Active thromboembolic disease', 'DIC', 'Subarachnoid haemorrhage', 'Severe renal impairment (relative)'],
    interactions: ['Combined hormonal contraceptives (increased thrombosis risk)', 'Factor IX complex (increased thrombosis risk)'],
    pregnancyCategory: 'Safe if indicated - Category B',
    breastfeedingSafety: 'Compatible',
    maxDailyDose: '4g'
  },
  {
    name: 'Ferrous Sulfate (Iron)',
    genericName: 'Ferrous Sulfate',
    category: 'Haematological',
    subcategory: 'Iron supplement',
    formulations: ['Tablet 200mg (65mg elemental Fe)', 'Tablet 325mg (104mg elemental Fe)', 'Syrup 60mg Fe/5ml'],
    dosages: [
      { indication: 'Iron deficiency anaemia', adult: '200mg (65mg Fe) BD-TDS' },
      { indication: 'Prophylaxis', adult: '200mg OD' }
    ],
    routes: ['Oral'],
    frequencies: ['OD', 'BD', 'TDS'],
    gfrAdjustments: [
      { gfrRange: '>0', gfrMin: 0, gfrMax: 999, adjustedDose: 'No adjustment', adjustedFrequency: 'Standard', notes: 'Consider IV iron if GFR<30 and on EPO', contraindicated: false }
    ],
    warnings: ['GI side effects common - take with food if needed (reduces absorption)', 'Black stools (expected)', 'Keep away from children (toxic in overdose)', 'Vitamin C enhances absorption'],
    sideEffects: ['Nausea', 'Constipation', 'Diarrhoea', 'Abdominal pain', 'Black stools', 'Teeth staining (liquid)'],
    contraindications: ['Iron overload / haemochromatosis', 'Active GI bleeding'],
    interactions: ['Antacids/PPIs (reduced absorption)', 'Tetracyclines (mutual reduced absorption)', 'Quinolones (reduced absorption)', 'Levothyroxine (reduced absorption - give 4h apart)'],
    pregnancyCategory: 'Safe - Category A',
    breastfeedingSafety: 'Compatible',
    maxDailyDose: '600mg (195mg elemental Fe)'
  },

  // ==================== RESPIRATORY ====================
  {
    name: 'Salbutamol (Albuterol)',
    genericName: 'Salbutamol',
    category: 'Respiratory',
    subcategory: 'Short-acting Beta-2 agonist',
    formulations: ['MDI 100mcg/dose', 'Nebuliser solution 2.5mg/2.5ml', 'Nebuliser solution 5mg/2.5ml', 'Injection 500mcg/ml'],
    dosages: [
      { indication: 'Bronchospasm', adult: '2 puffs PRN (via spacer) or 2.5-5mg nebulised' },
      { indication: 'Acute severe asthma', adult: '5mg nebulised Q15-20min (back-to-back)' },
      { indication: 'Perioperative bronchospasm', adult: '2.5-5mg nebulised or IV' },
      { indication: 'Hyperkalaemia', adult: '10-20mg nebulised (off-label)' }
    ],
    routes: ['Inhaled', 'Nebulised', 'IV'],
    frequencies: ['PRN', 'QDS', 'Q4H', 'Q15min'],
    gfrAdjustments: [
      { gfrRange: '>0', gfrMin: 0, gfrMax: 999, adjustedDose: 'No adjustment', adjustedFrequency: 'Standard', notes: 'Safe in renal impairment', contraindicated: false }
    ],
    warnings: ['Tachycardia', 'Tremor', 'Hypokalaemia (especially with repeated nebulisers)', 'May require potassium monitoring in severe attacks'],
    sideEffects: ['Tremor', 'Tachycardia', 'Palpitations', 'Headache', 'Hypokalaemia', 'Muscle cramps'],
    contraindications: ['None absolute'],
    interactions: ['Beta-blockers (antagonism)', 'Loop diuretics (enhanced hypokalaemia)', 'Theophylline (enhanced effects & hypokalaemia)'],
    pregnancyCategory: 'Safe - Category C',
    breastfeedingSafety: 'Compatible',
    maxDailyDose: 'No absolute max in acute attack - titrate to response'
  },

  // ==================== ANTIFUNGALS ====================
  {
    name: 'Fluconazole',
    genericName: 'Fluconazole',
    category: 'Antifungals',
    subcategory: 'Azole antifungal',
    formulations: ['Capsule 50mg', 'Capsule 150mg', 'Capsule 200mg', 'Infusion 2mg/ml (200mg/100ml)'],
    dosages: [
      { indication: 'Oropharyngeal candidiasis', adult: '50-100mg OD for 7-14 days' },
      { indication: 'Vaginal candidiasis', adult: '150mg STAT oral' },
      { indication: 'Systemic candidiasis', adult: '400mg loading then 200-400mg OD' },
      { indication: 'Fungal prophylaxis (immunocompromised)', adult: '50-400mg OD' }
    ],
    routes: ['Oral', 'IV'],
    frequencies: ['OD', 'STAT'],
    gfrAdjustments: [
      { gfrRange: '>50', gfrMin: 50, gfrMax: 999, adjustedDose: 'No adjustment', adjustedFrequency: 'OD', notes: 'Normal dosing', contraindicated: false },
      { gfrRange: '21-50', gfrMin: 21, gfrMax: 50, adjustedDose: '50% of standard', adjustedFrequency: 'OD', notes: 'Halve dose', contraindicated: false },
      { gfrRange: '<20', gfrMin: 0, gfrMax: 19, adjustedDose: '50% of standard', adjustedFrequency: 'Every 48h', notes: 'If on dialysis, give after dialysis session', contraindicated: false }
    ],
    warnings: ['Hepatotoxicity - check LFTs', 'QT prolongation', 'Drug interactions (CYP2C9, CYP3A4 inhibitor)'],
    sideEffects: ['Nausea', 'Diarrhoea', 'Headache', 'Rash', 'Elevated LFTs', 'QT prolongation'],
    contraindications: ['Concurrent terfenadine/cisapride at high fluconazole doses', 'Known QT prolongation'],
    interactions: ['Warfarin (significantly increased INR)', 'Statins (rhabdomyolysis risk)', 'Ciclosporin (increased levels)', 'Phenytoin (increased levels)', 'Rifampicin (reduced fluconazole levels)'],
    pregnancyCategory: 'Avoid unless essential (single 150mg for VVC is likely safe) - Category D',
    breastfeedingSafety: 'Compatible'
  },

  // ==================== MUSCLE RELAXANTS ====================
  {
    name: 'Baclofen',
    genericName: 'Baclofen',
    category: 'Muscle Relaxants',
    subcategory: 'Centrally-acting',
    formulations: ['Tablet 10mg', 'Tablet 25mg'],
    dosages: [
      { indication: 'Muscle spasm', adult: 'Start 5mg TDS, increase gradually to 20mg TDS' }
    ],
    routes: ['Oral'],
    frequencies: ['TDS', 'BD'],
    gfrAdjustments: [
      { gfrRange: '>30', gfrMin: 30, gfrMax: 999, adjustedDose: 'No adjustment', adjustedFrequency: 'TDS', notes: 'Start low and titrate', contraindicated: false },
      { gfrRange: '15-29', gfrMin: 15, gfrMax: 29, adjustedDose: '5mg TDS', adjustedFrequency: 'TDS', notes: 'Start at lowest dose', contraindicated: false },
      { gfrRange: '<15', gfrMin: 0, gfrMax: 14, adjustedDose: '5mg OD', adjustedFrequency: 'OD-BD', notes: 'High risk of toxicity - avoid if possible', contraindicated: true }
    ],
    warnings: ['Do NOT stop abruptly (seizures, hallucinations)', 'Drowsiness', 'CNS depression', 'Withdrawal syndrome if stopped suddenly'],
    sideEffects: ['Drowsiness', 'Dizziness', 'Nausea', 'Fatigue', 'Muscle weakness', 'Confusion'],
    contraindications: ['Active peptic ulcer'],
    interactions: ['Antihypertensives (enhanced hypotension)', 'CNS depressants', 'Alcohol'],
    pregnancyCategory: 'Avoid - Category C',
    breastfeedingSafety: 'Compatible in low doses',
    maxDailyDose: '100mg'
  },

  // ==================== NUTRITIONAL SUPPLEMENTS ====================
  {
    name: 'Vitamin C (Ascorbic Acid)',
    genericName: 'Ascorbic Acid',
    category: 'Nutritional Supplements',
    subcategory: 'Vitamin',
    formulations: ['Tablet 100mg', 'Tablet 250mg', 'Tablet 500mg', 'Tablet 1000mg', 'Injection 100mg/ml'],
    dosages: [
      { indication: 'Wound healing support', adult: '250-500mg BD' },
      { indication: 'Scurvy treatment', adult: '250mg QDS for 1 week' },
      { indication: 'Burns support', adult: '1g BD' }
    ],
    routes: ['Oral', 'IV'],
    frequencies: ['OD', 'BD', 'QDS'],
    gfrAdjustments: [
      { gfrRange: '>30', gfrMin: 30, gfrMax: 999, adjustedDose: 'No adjustment', adjustedFrequency: 'Standard', notes: 'Normal dosing', contraindicated: false },
      { gfrRange: '<30', gfrMin: 0, gfrMax: 29, adjustedDose: 'Max 200mg/day', adjustedFrequency: 'OD', notes: 'Oxalate crystal risk in renal impairment', contraindicated: false }
    ],
    warnings: ['Oxalate stone risk in high doses + renal impairment', 'False negative in faecal occult blood test', 'False negative glucose oxidase test'],
    sideEffects: ['GI upset at high doses', 'Oxaluria', 'Renal stones (high dose)'],
    contraindications: ['Oxalate renal stones', 'Haemochromatosis'],
    interactions: ['Warfarin (may reduce effect at very high doses)', 'Iron (enhances absorption)'],
    pregnancyCategory: 'Safe - Category A',
    breastfeedingSafety: 'Compatible',
    maxDailyDose: '2g (1g typically sufficient)'
  },
  {
    name: 'Zinc Sulfate',
    genericName: 'Zinc Sulfate',
    category: 'Nutritional Supplements',
    subcategory: 'Trace element',
    formulations: ['Tablet 220mg (50mg elemental Zn)', 'Effervescent tablet 125mg', 'Solution'],
    dosages: [
      { indication: 'Wound healing / zinc deficiency', adult: '220mg (50mg Zn) OD-TDS' },
      { indication: 'Burns support', adult: '220mg BD' }
    ],
    routes: ['Oral'],
    frequencies: ['OD', 'BD', 'TDS'],
    gfrAdjustments: [
      { gfrRange: '>0', gfrMin: 0, gfrMax: 999, adjustedDose: 'No adjustment', adjustedFrequency: 'Standard', notes: 'Accumulation possible in dialysis patients', contraindicated: false }
    ],
    warnings: ['GI upset - take with food', 'Copper deficiency with prolonged high doses', 'Nausea common on empty stomach'],
    sideEffects: ['Nausea', 'Vomiting', 'Abdominal pain', 'Diarrhoea', 'Copper deficiency (chronic excess)'],
    contraindications: ['Mechanical or functional bowel obstruction'],
    interactions: ['Iron (mutual reduced absorption)', 'Quinolones (reduced absorption)', 'Tetracyclines (reduced absorption)', 'Penicillamine (reduced absorption)'],
    pregnancyCategory: 'Safe - Category A',
    breastfeedingSafety: 'Compatible',
    maxDailyDose: '150mg elemental zinc'
  },
  {
    name: 'Multivitamin + Minerals',
    genericName: 'Multivitamin',
    category: 'Nutritional Supplements',
    subcategory: 'Multivitamin',
    formulations: ['Tablet', 'Capsule', 'Syrup', 'Injection (Pabrinex)'],
    dosages: [
      { indication: 'Nutritional support', adult: '1 tablet OD' },
      { indication: 'Pabrinex (thiamine/B vitamins) - alcohol/malnutrition', adult: 'Pair I+II IV OD-TDS for 3-5 days' }
    ],
    routes: ['Oral', 'IV'],
    frequencies: ['OD', 'BD'],
    gfrAdjustments: [
      { gfrRange: '>0', gfrMin: 0, gfrMax: 999, adjustedDose: 'No adjustment for standard multivitamins', adjustedFrequency: 'OD', notes: 'Avoid excessive vitamin A in renal impairment', contraindicated: false }
    ],
    warnings: ['Pabrinex: anaphylaxis risk - give in resuscitation facilities', 'Avoid excess vitamin A in pregnancy/liver disease'],
    sideEffects: ['Generally well tolerated', 'Nausea (if taken on empty stomach)', 'Anaphylaxis with IV vitamins (rare)'],
    contraindications: ['Hypervitaminosis A', 'Individual vitamin hypersensitivity'],
    interactions: ['Warfarin (vitamin K content)', 'Levodopa (vitamin B6 may reduce effect)'],
    pregnancyCategory: 'Safe - Category A',
    breastfeedingSafety: 'Compatible'
  }
];

// ==================== SEARCH AND UTILITY FUNCTIONS ====================

/**
 * Search medications by name (partial match)
 */
export function searchMedications(query: string): BNFMedication[] {
  if (!query || query.length < 2) return [];
  const lower = query.toLowerCase();
  return BNF_MEDICATIONS.filter(med => 
    med.name.toLowerCase().includes(lower) ||
    med.genericName.toLowerCase().includes(lower) ||
    med.subcategory.toLowerCase().includes(lower)
  ).slice(0, 20); // Limit results
}

/**
 * Get medication by exact name
 */
export function getMedicationByName(name: string): BNFMedication | undefined {
  return BNF_MEDICATIONS.find(med => 
    med.name.toLowerCase() === name.toLowerCase() ||
    med.genericName.toLowerCase() === name.toLowerCase()
  );
}

/**
 * Get medications by category
 */
export function getMedicationsByCategory(category: MedicationCategory): BNFMedication[] {
  return BNF_MEDICATIONS.filter(med => med.category === category);
}

/**
 * Get GFR-adjusted dosing for a medication
 */
export function getGFRAdjustedDosing(medicationName: string, gfr: number): GFRAdjustment | undefined {
  const med = getMedicationByName(medicationName);
  if (!med) return undefined;
  
  return med.gfrAdjustments.find(adj => gfr >= adj.gfrMin && gfr <= adj.gfrMax);
}

/**
 * Get all medication names for autocomplete
 */
export function getAllMedicationNames(): string[] {
  return BNF_MEDICATIONS.map(med => med.name);
}

/**
 * Check for contraindications between medications
 */
export function checkInteractions(medicationNames: string[]): { med1: string; med2: string; interaction: string }[] {
  const interactions: { med1: string; med2: string; interaction: string }[] = [];
  
  for (let i = 0; i < medicationNames.length; i++) {
    const med1 = getMedicationByName(medicationNames[i]);
    if (!med1) continue;
    
    for (let j = i + 1; j < medicationNames.length; j++) {
      const med2Name = medicationNames[j];
      const matchingInteraction = med1.interactions.find(inter => 
        inter.toLowerCase().includes(med2Name.toLowerCase())
      );
      if (matchingInteraction) {
        interactions.push({ med1: med1.name, med2: med2Name, interaction: matchingInteraction });
      }
    }
  }
  
  return interactions;
}

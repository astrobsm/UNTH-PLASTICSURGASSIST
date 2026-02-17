/**
 * Comprehensive BNF-Based Drug Database
 * 
 * Contains detailed clinical information for each medication including:
 * - Dosing (adult, pediatric, renal/hepatic adjustments)
 * - Pregnancy & lactation safety categories
 * - Maximum doses, contraindications, interactions
 * - WHO-standard prescribing support
 */

// ─── ENUMS & TYPES ──────────────────────────────────────────────────────────

export type PregnancyCategory = 'A' | 'B' | 'C' | 'D' | 'X';
export type LactationSafety = 'safe' | 'caution' | 'avoid' | 'unknown';
export type RenalRisk = 'safe' | 'dose_adjust' | 'avoid' | 'monitor';
export type HepaticRisk = 'safe' | 'dose_adjust' | 'avoid' | 'monitor' | 'caution';
export type CardiacRisk = 'safe' | 'caution' | 'avoid' | 'monitor';

export type DrugRoute = 'oral' | 'IV' | 'IM' | 'SC' | 'topical' | 'rectal' | 'inhaled' | 'sublingual' | 'intrathecal' | 'ophthalmic';
export type DrugFrequency = 'stat' | 'od' | 'bd' | 'tds' | 'qds' | 'prn' | 'nocte' | 'mane' | 'q3h' | 'q4h' | 'q6h' | 'q8h' | 'q12h' | 'weekly' | 'alternate_days';

export type DrugCategory =
  | 'Analgesics - Non-Opioid'
  | 'Analgesics - Opioid'
  | 'Antibiotics - Penicillins'
  | 'Antibiotics - Cephalosporins'
  | 'Antibiotics - Quinolones'
  | 'Antibiotics - Aminoglycosides'
  | 'Antibiotics - Macrolides'
  | 'Antibiotics - Others'
  | 'Anticoagulants'
  | 'Antiemetics'
  | 'Gastrointestinal'
  | 'Cardiovascular - Antihypertensives'
  | 'Cardiovascular - Antiarrhythmics'
  | 'Cardiovascular - Others'
  | 'Endocrine - Diabetes'
  | 'Endocrine - Steroids'
  | 'Endocrine - Thyroid'
  | 'Respiratory'
  | 'CNS - Anxiolytics & Sedatives'
  | 'CNS - Antiepileptics'
  | 'CNS - Antidepressants'
  | 'Dermatology'
  | 'Wound Care'
  | 'Antihistamines'
  | 'Vitamins & Supplements'
  | 'Muscle Relaxants'
  | 'Local Anaesthetics'
  | 'General Anaesthetics'
  | 'Antifungals'
  | 'Antivirals'
  | 'Immunosuppressants'
  | 'Fluids & Electrolytes'
  | 'Antiplatelets & Thrombolytics'
  | 'Cardiovascular - Lipid-lowering'
  | 'Cardiovascular - Nitrates & Antianginals'
  | 'Cardiovascular - Diuretics'
  | 'CNS - Antipsychotics'
  | 'CNS - Opioid Antagonists'
  | 'Antimalarials'
  | 'Antibiotics - Lincosamides'
  | 'Antibiotics - Carbapenems'
  | 'Antibiotics - Tetracyclines'
  | 'Antibiotics - Sulfonamides'
  | 'Obstetrics & Gynaecology'
  | 'Laxatives'
  | 'Antidiarrhoeals'
  | 'Blood Products & Plasma Expanders'
  | 'Ophthalmic'
  | 'ENT'
  | 'Vaccines & Immunoglobulins'
  | 'Musculoskeletal - Antigout'
  | 'Endocrine - Thyroid'
  | 'Bronchodilators'
  | 'Corticosteroids - Inhaled'
  | 'Antiseptics & Disinfectants'
  | 'Emergency Drugs';

export interface DrugFormulation {
  form: string; // e.g. "Tablet 500mg", "Injection 1g/vial"
  strength: string;
  route: DrugRoute;
}

export interface DosageInfo {
  standard: string;
  min: string;
  max: string;
  frequency: DrugFrequency[];
  duration?: string;
  notes?: string;
}

export interface BNFDrug {
  id: string;
  genericName: string;
  brandNames: string[];
  category: DrugCategory;
  subcategory?: string;
  formulations: DrugFormulation[];
  dosage: {
    adult: DosageInfo;
    pediatric?: DosageInfo;
    elderly?: DosageInfo;
    renalImpairment?: { adjustment: string; gfrThreshold?: string };
    hepaticImpairment?: { adjustment: string };
  };
  maxDailyDose: string;
  contraindications: string[];
  pregnancyCategory: PregnancyCategory;
  pregnancyNotes?: string;
  lactationSafety: LactationSafety;
  lactationNotes?: string;
  renalRisk: RenalRisk;
  renalNotes?: string;
  hepaticRisk: HepaticRisk;
  hepaticNotes?: string;
  cardiacRisk: CardiacRisk;
  cardiacNotes?: string;
  sideEffects: { common: string[]; serious: string[] };
  interactions: { drug: string; severity: 'minor' | 'moderate' | 'major'; effect: string }[];
  precautions: string[];
  instructions?: string;
  monitoringRequired?: string[];
}

// ─── DRUG DATABASE ──────────────────────────────────────────────────────────

export const BNF_DRUG_DATABASE: BNFDrug[] = [
  // ═══════════════════════════════════════════════════════════════════════════
  // ANALGESICS - NON-OPIOID
  // ═══════════════════════════════════════════════════════════════════════════
  {
    id: 'paracetamol',
    genericName: 'Paracetamol (Acetaminophen)',
    brandNames: ['Panadol', 'Tylenol', 'Calpol'],
    category: 'Analgesics - Non-Opioid',
    formulations: [
      { form: 'Tablet 500mg', strength: '500mg', route: 'oral' },
      { form: 'Tablet 1g', strength: '1g', route: 'oral' },
      { form: 'Syrup 120mg/5ml', strength: '120mg/5ml', route: 'oral' },
      { form: 'Syrup 250mg/5ml', strength: '250mg/5ml', route: 'oral' },
      { form: 'IV Infusion 10mg/ml (100ml)', strength: '1g/100ml', route: 'IV' },
      { form: 'Suppository 125mg', strength: '125mg', route: 'rectal' },
      { form: 'Suppository 250mg', strength: '250mg', route: 'rectal' },
      { form: 'Suppository 500mg', strength: '500mg', route: 'rectal' },
    ],
    dosage: {
      adult: { standard: '1g', min: '500mg', max: '1g', frequency: ['q4h', 'q6h', 'qds'], notes: 'Maximum 4g/day' },
      pediatric: { standard: '15mg/kg', min: '10mg/kg', max: '15mg/kg', frequency: ['q4h', 'q6h'], notes: 'Max 60mg/kg/day or 4g/day' },
      elderly: { standard: '500mg-1g', min: '500mg', max: '1g', frequency: ['q6h'], notes: 'Consider lower doses in frailty' },
      renalImpairment: { adjustment: 'Increase dosing interval to q6h if GFR <30', gfrThreshold: '<30 ml/min' },
      hepaticImpairment: { adjustment: 'AVOID or max 2g/day in severe liver disease. Contraindicated in active liver failure.' },
    },
    maxDailyDose: '4g (2g in hepatic impairment)',
    contraindications: ['Severe hepatic impairment', 'Active liver disease', 'Known hypersensitivity'],
    pregnancyCategory: 'B',
    pregnancyNotes: 'Generally considered safe in all trimesters at recommended doses.',
    lactationSafety: 'safe',
    lactationNotes: 'Excreted in breast milk in small amounts. Safe at therapeutic doses.',
    renalRisk: 'dose_adjust',
    renalNotes: 'Increase interval to 6-hourly if GFR <30 ml/min',
    hepaticRisk: 'avoid',
    hepaticNotes: 'Hepatotoxic. Dose-dependent liver damage. Max 2g/day if mild impairment, avoid in severe.',
    cardiacRisk: 'safe',
    sideEffects: {
      common: ['Nausea (rare at therapeutic doses)'],
      serious: ['Hepatotoxicity (overdose)', 'Stevens-Johnson syndrome (rare)', 'Thrombocytopenia (rare)'],
    },
    interactions: [
      { drug: 'Warfarin', severity: 'moderate', effect: 'May enhance anticoagulant effect with prolonged use >2g/day' },
      { drug: 'Carbamazepine', severity: 'moderate', effect: 'Increased risk of hepatotoxicity due to enzyme induction' },
      { drug: 'Alcohol', severity: 'major', effect: 'Increased risk of hepatotoxicity, especially chronic alcohol use' },
    ],
    precautions: ['Chronic alcohol use', 'Malnutrition/low body weight', 'Dehydration'],
    instructions: 'Take with or without food. Do not exceed recommended dose.',
    monitoringRequired: ['LFTs if prolonged use or high doses'],
  },
  {
    id: 'ibuprofen',
    genericName: 'Ibuprofen',
    brandNames: ['Brufen', 'Nurofen', 'Advil'],
    category: 'Analgesics - Non-Opioid',
    formulations: [
      { form: 'Tablet 200mg', strength: '200mg', route: 'oral' },
      { form: 'Tablet 400mg', strength: '400mg', route: 'oral' },
      { form: 'Tablet 600mg', strength: '600mg', route: 'oral' },
      { form: 'Syrup 100mg/5ml', strength: '100mg/5ml', route: 'oral' },
    ],
    dosage: {
      adult: { standard: '400mg', min: '200mg', max: '600mg', frequency: ['tds', 'qds'] },
      pediatric: { standard: '5-10mg/kg', min: '5mg/kg', max: '10mg/kg', frequency: ['tds', 'qds'], notes: 'Max 40mg/kg/day' },
      renalImpairment: { adjustment: 'Avoid if GFR <30. Use with caution if GFR 30-60.', gfrThreshold: '<30 ml/min' },
      hepaticImpairment: { adjustment: 'Avoid in severe hepatic impairment' },
    },
    maxDailyDose: '2.4g',
    contraindications: ['Active peptic ulcer', 'Severe renal impairment', 'Severe heart failure', 'Third trimester pregnancy', 'History of GI bleeding with NSAIDs', 'Aspirin-sensitive asthma'],
    pregnancyCategory: 'D',
    pregnancyNotes: 'AVOID in third trimester (risk of premature closure of ductus arteriosus). Use with caution in first/second trimester.',
    lactationSafety: 'safe',
    lactationNotes: 'Small amounts in breast milk. Short courses are acceptable.',
    renalRisk: 'avoid',
    renalNotes: 'NSAIDs cause renal vasoconstriction. Avoid if GFR <30. Monitor renal function.',
    hepaticRisk: 'dose_adjust',
    hepaticNotes: 'Use lowest effective dose for shortest duration. Avoid in severe impairment.',
    cardiacRisk: 'caution',
    cardiacNotes: 'Increased CV risk with prolonged use. Avoid in severe heart failure. Fluid retention risk.',
    sideEffects: {
      common: ['Nausea', 'Dyspepsia', 'Abdominal pain', 'Dizziness', 'Headache'],
      serious: ['GI bleeding/perforation', 'Renal failure', 'Myocardial infarction', 'Stroke', 'Stevens-Johnson syndrome', 'Bronchospasm'],
    },
    interactions: [
      { drug: 'Warfarin', severity: 'major', effect: 'Increased bleeding risk' },
      { drug: 'ACE Inhibitors', severity: 'moderate', effect: 'Reduced antihypertensive effect, risk of renal impairment' },
      { drug: 'Aspirin', severity: 'moderate', effect: 'May reduce cardioprotective effect of low-dose aspirin' },
      { drug: 'Methotrexate', severity: 'major', effect: 'Reduced methotrexate clearance, increased toxicity' },
      { drug: 'Lithium', severity: 'moderate', effect: 'Increased lithium levels' },
      { drug: 'SSRIs', severity: 'moderate', effect: 'Increased GI bleeding risk' },
    ],
    precautions: ['GI disease', 'Asthma', 'Coagulation defects', 'Hypertension', 'Elderly', 'Fluid retention'],
    instructions: 'Take with food. Use lowest effective dose for shortest duration.',
    monitoringRequired: ['Renal function', 'Blood pressure', 'GI symptoms'],
  },
  {
    id: 'diclofenac',
    genericName: 'Diclofenac Sodium',
    brandNames: ['Voltaren', 'Cataflam', 'Voltarol'],
    category: 'Analgesics - Non-Opioid',
    formulations: [
      { form: 'Tablet 25mg', strength: '25mg', route: 'oral' },
      { form: 'Tablet 50mg', strength: '50mg', route: 'oral' },
      { form: 'Tablet 75mg SR', strength: '75mg', route: 'oral' },
      { form: 'Injection 75mg/3ml', strength: '75mg', route: 'IM' },
      { form: 'Suppository 100mg', strength: '100mg', route: 'rectal' },
      { form: 'Gel 1%', strength: '1%', route: 'topical' },
    ],
    dosage: {
      adult: { standard: '50mg', min: '25mg', max: '75mg', frequency: ['bd', 'tds'] },
      renalImpairment: { adjustment: 'Avoid if GFR <30', gfrThreshold: '<30 ml/min' },
      hepaticImpairment: { adjustment: 'Reduce dose. Avoid in severe impairment.' },
    },
    maxDailyDose: '150mg',
    contraindications: ['Active GI ulceration/bleeding', 'Severe heart failure', 'Severe renal impairment', 'Third trimester pregnancy', 'Ischaemic heart disease', 'Cerebrovascular disease', 'Peripheral arterial disease'],
    pregnancyCategory: 'D',
    pregnancyNotes: 'Avoid in third trimester. Use cautiously in early pregnancy.',
    lactationSafety: 'caution',
    lactationNotes: 'Present in breast milk in small amounts. Short courses may be acceptable.',
    renalRisk: 'avoid',
    renalNotes: 'Avoid in significant renal impairment (GFR <30)',
    hepaticRisk: 'dose_adjust',
    hepaticNotes: 'Reduce dose in mild-moderate impairment. Avoid in severe.',
    cardiacRisk: 'caution',
    cardiacNotes: 'Higher cardiovascular risk than some other NSAIDs. Contraindicated in established CV disease.',
    sideEffects: {
      common: ['Nausea', 'Diarrhoea', 'Headache', 'Dizziness', 'Rash'],
      serious: ['GI bleeding', 'Myocardial infarction', 'Stroke', 'Hepatotoxicity', 'Renal failure'],
    },
    interactions: [
      { drug: 'Warfarin', severity: 'major', effect: 'Increased bleeding risk' },
      { drug: 'ACE Inhibitors', severity: 'moderate', effect: 'Reduced effect, renal risk' },
      { drug: 'Lithium', severity: 'moderate', effect: 'Increased lithium levels' },
      { drug: 'Methotrexate', severity: 'major', effect: 'Increased methotrexate toxicity' },
    ],
    precautions: ['Elderly', 'GI history', 'Cardiac risk factors', 'Asthma'],
    instructions: 'Take with food. IM injection deep into gluteal muscle.',
  },
  {
    id: 'ketorolac',
    genericName: 'Ketorolac Tromethamine',
    brandNames: ['Toradol'],
    category: 'Analgesics - Non-Opioid',
    formulations: [
      { form: 'Tablet 10mg', strength: '10mg', route: 'oral' },
      { form: 'Injection 30mg/ml', strength: '30mg', route: 'IV' },
      { form: 'Injection 30mg/ml', strength: '30mg', route: 'IM' },
    ],
    dosage: {
      adult: { standard: '10mg oral / 30mg IV/IM', min: '10mg', max: '30mg', frequency: ['q6h'], notes: 'MAX 5 days total therapy' },
      elderly: { standard: '10mg', min: '10mg', max: '15mg', frequency: ['q6h'], notes: 'Reduce dose. MAX 60mg/day. MAX 5 days.' },
      renalImpairment: { adjustment: 'Contraindicated in moderate-severe renal impairment' },
    },
    maxDailyDose: '90mg IV/IM (60mg in elderly); 40mg oral. MAX 5 days total.',
    contraindications: ['Active peptic ulcer', 'Renal impairment', 'Perioperative CABG pain', 'Haemorrhagic diathesis', 'Third trimester pregnancy', 'Breastfeeding'],
    pregnancyCategory: 'D',
    pregnancyNotes: 'Avoid throughout pregnancy.',
    lactationSafety: 'avoid',
    lactationNotes: 'Contraindicated during breastfeeding.',
    renalRisk: 'avoid',
    renalNotes: 'Contraindicated in renal impairment.',
    hepaticRisk: 'caution',
    hepaticNotes: 'Use with caution. Avoid in severe impairment.',
    cardiacRisk: 'caution',
    cardiacNotes: 'Increased CV risk. Avoid prolonged use.',
    sideEffects: {
      common: ['Nausea', 'Dyspepsia', 'Headache', 'Dizziness', 'Drowsiness'],
      serious: ['GI bleeding/perforation', 'Renal failure', 'Anaphylaxis', 'Bronchospasm'],
    },
    interactions: [
      { drug: 'Warfarin', severity: 'major', effect: 'Significant increase in bleeding risk' },
      { drug: 'ACE Inhibitors', severity: 'moderate', effect: 'Reduced antihypertensive effect' },
      { drug: 'Other NSAIDs', severity: 'major', effect: 'Do NOT combine. Additive GI/renal toxicity.' },
    ],
    precautions: ['Elderly', 'Hypovolaemia', 'Post-surgical haemorrhage risk', 'Maximum 5 days use only'],
    instructions: 'Short-term use only (max 5 days). Not for chronic pain.',
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // ANALGESICS - OPIOID
  // ═══════════════════════════════════════════════════════════════════════════
  {
    id: 'tramadol',
    genericName: 'Tramadol Hydrochloride',
    brandNames: ['Tramundin', 'Zydol', 'Ultram'],
    category: 'Analgesics - Opioid',
    formulations: [
      { form: 'Capsule 50mg', strength: '50mg', route: 'oral' },
      { form: 'Capsule 100mg', strength: '100mg', route: 'oral' },
      { form: 'Injection 50mg/ml (2ml)', strength: '100mg', route: 'IV' },
      { form: 'Injection 50mg/ml (2ml)', strength: '100mg', route: 'IM' },
    ],
    dosage: {
      adult: { standard: '50-100mg', min: '50mg', max: '100mg', frequency: ['q4h', 'q6h'] },
      elderly: { standard: '50mg', min: '25mg', max: '50mg', frequency: ['q6h', 'q8h'], notes: 'Start low, titrate slowly' },
      renalImpairment: { adjustment: 'GFR <30: max 100mg q12h; GFR <10: avoid', gfrThreshold: '<30 ml/min' },
      hepaticImpairment: { adjustment: 'Reduce dose by 50% in Child-Pugh C. Avoid in severe cirrhosis.' },
    },
    maxDailyDose: '400mg (200mg in elderly/renal impairment)',
    contraindications: ['Uncontrolled epilepsy', 'Concurrent MAOIs or within 14 days', 'Acute intoxication with alcohol/opioids/CNS depressants'],
    pregnancyCategory: 'C',
    pregnancyNotes: 'Avoid in pregnancy, especially near term (neonatal withdrawal).',
    lactationSafety: 'avoid',
    lactationNotes: 'Excreted in breast milk. Avoid during breastfeeding.',
    renalRisk: 'dose_adjust',
    renalNotes: 'Reduce frequency if GFR <30. Avoid if GFR <10.',
    hepaticRisk: 'dose_adjust',
    hepaticNotes: 'Reduce dose in hepatic impairment. Avoid in severe cirrhosis.',
    cardiacRisk: 'safe',
    sideEffects: {
      common: ['Nausea', 'Vomiting', 'Dizziness', 'Constipation', 'Headache', 'Drowsiness'],
      serious: ['Seizures', 'Serotonin syndrome', 'Respiratory depression', 'Anaphylaxis', 'Dependence'],
    },
    interactions: [
      { drug: 'MAOIs', severity: 'major', effect: 'Risk of serotonin syndrome. Contraindicated.' },
      { drug: 'SSRIs/SNRIs', severity: 'major', effect: 'Risk of serotonin syndrome and seizures' },
      { drug: 'Carbamazepine', severity: 'moderate', effect: 'Reduced tramadol efficacy due to enzyme induction' },
      { drug: 'Warfarin', severity: 'moderate', effect: 'May increase anticoagulant effect' },
    ],
    precautions: ['History of seizures', 'Head injury', 'Raised ICP', 'Opioid dependence history'],
    instructions: 'Can be taken with or without food. Swallow capsules whole.',
  },
  {
    id: 'morphine',
    genericName: 'Morphine Sulfate',
    brandNames: ['MST', 'Oramorph', 'Sevredol'],
    category: 'Analgesics - Opioid',
    formulations: [
      { form: 'Tablet IR 10mg', strength: '10mg', route: 'oral' },
      { form: 'Tablet MR 10mg', strength: '10mg', route: 'oral' },
      { form: 'Oral solution 10mg/5ml', strength: '10mg/5ml', route: 'oral' },
      { form: 'Injection 10mg/ml', strength: '10mg', route: 'IV' },
      { form: 'Injection 10mg/ml', strength: '10mg', route: 'IM' },
      { form: 'Injection 10mg/ml', strength: '10mg', route: 'SC' },
    ],
    dosage: {
      adult: { standard: '5-10mg IV/IM/SC; 10-20mg oral', min: '2.5mg', max: '20mg', frequency: ['q4h', 'prn'], notes: 'Titrate to pain. IV: administer slowly over 5 min.' },
      pediatric: { standard: '0.1-0.2mg/kg IV', min: '0.05mg/kg', max: '0.2mg/kg', frequency: ['q4h', 'prn'] },
      elderly: { standard: '2.5-5mg', min: '1mg', max: '5mg', frequency: ['q4h', 'q6h'], notes: 'Start very low. Titrate carefully.' },
      renalImpairment: { adjustment: 'Reduce dose and increase interval. Active metabolite (M6G) accumulates. GFR <30: use 50% dose or avoid.', gfrThreshold: '<30 ml/min' },
      hepaticImpairment: { adjustment: 'Reduce dose significantly. Risk of encephalopathy in severe impairment.' },
    },
    maxDailyDose: 'No ceiling, titrate to effect (typical max 120mg/day acute)',
    contraindications: ['Acute respiratory depression', 'Paralytic ileus', 'Raised ICP', 'Acute abdomen (may mask signs)', 'Phaeochromocytoma'],
    pregnancyCategory: 'C',
    pregnancyNotes: 'Use only if clearly needed. Risk of neonatal respiratory depression and withdrawal at delivery.',
    lactationSafety: 'caution',
    lactationNotes: 'Small amounts in breast milk. Single doses unlikely to affect infant. Avoid repeated doses.',
    renalRisk: 'dose_adjust',
    renalNotes: 'Active metabolite M6G accumulates in renal failure causing prolonged sedation/respiratory depression.',
    hepaticRisk: 'dose_adjust',
    hepaticNotes: 'Reduced metabolism. Start with lower doses. Risk of encephalopathy.',
    cardiacRisk: 'caution',
    cardiacNotes: 'May cause hypotension. Use with caution in haemodynamic instability.',
    sideEffects: {
      common: ['Nausea', 'Vomiting', 'Constipation', 'Drowsiness', 'Pruritus', 'Urinary retention'],
      serious: ['Respiratory depression', 'Hypotension', 'Dependence/addiction', 'Adrenal insufficiency'],
    },
    interactions: [
      { drug: 'Benzodiazepines', severity: 'major', effect: 'Additive respiratory depression. Potentially fatal.' },
      { drug: 'MAOIs', severity: 'major', effect: 'Severe potentiation of opioid effects' },
      { drug: 'Alcohol', severity: 'major', effect: 'Additive CNS and respiratory depression' },
      { drug: 'Anticholinergics', severity: 'moderate', effect: 'Increased constipation, urinary retention risk' },
    ],
    precautions: ['Respiratory disease', 'Head injury', 'Addisonian crisis', 'Biliary disease', 'Elderly', 'Opioid-naive patients'],
    instructions: 'Administer IV slowly. Have naloxone available. Monitor respiratory rate.',
    monitoringRequired: ['Respiratory rate', 'Sedation score', 'Pain score', 'Blood pressure'],
  },
  {
    id: 'pethidine',
    genericName: 'Pethidine (Meperidine)',
    brandNames: ['Demerol'],
    category: 'Analgesics - Opioid',
    formulations: [
      { form: 'Injection 50mg/ml (2ml)', strength: '100mg', route: 'IM' },
      { form: 'Injection 50mg/ml (2ml)', strength: '100mg', route: 'IV' },
    ],
    dosage: {
      adult: { standard: '50-100mg IM', min: '25mg', max: '100mg', frequency: ['q4h', 'prn'], notes: 'IV: give slowly 25-50mg over 5 min' },
      elderly: { standard: '25-50mg', min: '25mg', max: '50mg', frequency: ['q6h'], notes: 'Avoid in elderly if possible due to norpethidine toxicity' },
      renalImpairment: { adjustment: 'AVOID. Norpethidine (toxic metabolite) accumulates causing seizures.' },
    },
    maxDailyDose: '400mg (prefer to avoid >48 hours use)',
    contraindications: ['Renal impairment', 'Seizure disorders', 'Concurrent MAOIs', 'Severe hepatic impairment'],
    pregnancyCategory: 'C',
    pregnancyNotes: 'May cause neonatal respiratory depression if given near delivery.',
    lactationSafety: 'caution',
    lactationNotes: 'Excreted in breast milk. Use with caution.',
    renalRisk: 'avoid',
    renalNotes: 'Toxic metabolite norpethidine accumulates causing tremors, myoclonus, seizures.',
    hepaticRisk: 'dose_adjust',
    hepaticNotes: 'Reduced metabolism. Use lower doses.',
    cardiacRisk: 'caution',
    cardiacNotes: 'May cause tachycardia (atropine-like effect). Caution in cardiac disease.',
    sideEffects: {
      common: ['Nausea', 'Vomiting', 'Dizziness', 'Drowsiness', 'Dry mouth'],
      serious: ['Seizures (norpethidine)', 'Respiratory depression', 'Serotonin syndrome with MAOIs'],
    },
    interactions: [
      { drug: 'MAOIs', severity: 'major', effect: 'FATAL interaction. Excitation, hyperpyrexia, seizures. Contraindicated.' },
      { drug: 'SSRIs', severity: 'major', effect: 'Risk of serotonin syndrome' },
      { drug: 'Phenytoin', severity: 'moderate', effect: 'Increased norpethidine formation' },
    ],
    precautions: ['Avoid prolonged use (>48h)', 'Seizure history', 'Elderly', 'Prefer morphine or tramadol instead'],
    instructions: 'Short-term use only. Prefer alternatives for post-operative analgesia.',
  },
  {
    id: 'pentazocine',
    genericName: 'Pentazocine',
    brandNames: ['Fortwin'],
    category: 'Analgesics - Opioid',
    formulations: [
      { form: 'Injection 30mg/ml', strength: '30mg', route: 'IM' },
      { form: 'Injection 30mg/ml', strength: '30mg', route: 'IV' },
      { form: 'Injection 30mg/ml', strength: '30mg', route: 'SC' },
    ],
    dosage: {
      adult: { standard: '30mg IM/IV/SC', min: '30mg', max: '60mg', frequency: ['q3h', 'q4h'] },
      renalImpairment: { adjustment: 'Reduce dose. Avoid in severe impairment.' },
    },
    maxDailyDose: '360mg',
    contraindications: ['Raised intracranial pressure', 'Head injury', 'Acute MI'],
    pregnancyCategory: 'C',
    pregnancyNotes: 'Avoid near delivery.',
    lactationSafety: 'caution',
    renalRisk: 'dose_adjust',
    hepaticRisk: 'dose_adjust',
    cardiacRisk: 'caution',
    cardiacNotes: 'Increases cardiac workload. Avoid in MI.',
    sideEffects: {
      common: ['Nausea', 'Vomiting', 'Dizziness', 'Euphoria/Dysphoria', 'Sweating'],
      serious: ['Respiratory depression', 'Hallucinations', 'Seizures', 'Injection site fibrosis'],
    },
    interactions: [
      { drug: 'Other opioids', severity: 'major', effect: 'May precipitate withdrawal in opioid-dependent patients (partial agonist)' },
    ],
    precautions: ['Opioid-dependent patients (partial agonist)', 'Injection site rotation required'],
    instructions: 'Rotate injection sites to avoid tissue damage.',
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // ANTIBIOTICS - PENICILLINS
  // ═══════════════════════════════════════════════════════════════════════════
  {
    id: 'amoxicillin',
    genericName: 'Amoxicillin',
    brandNames: ['Amoxil', 'Ospamox'],
    category: 'Antibiotics - Penicillins',
    formulations: [
      { form: 'Capsule 250mg', strength: '250mg', route: 'oral' },
      { form: 'Capsule 500mg', strength: '500mg', route: 'oral' },
      { form: 'Syrup 125mg/5ml', strength: '125mg/5ml', route: 'oral' },
      { form: 'Syrup 250mg/5ml', strength: '250mg/5ml', route: 'oral' },
    ],
    dosage: {
      adult: { standard: '500mg', min: '250mg', max: '1g', frequency: ['tds'] },
      pediatric: { standard: '25mg/kg/day in 3 divided doses', min: '20mg/kg/day', max: '45mg/kg/day', frequency: ['tds'] },
      renalImpairment: { adjustment: 'GFR 10-30: 250-500mg q12h. GFR <10: 250-500mg q24h', gfrThreshold: '<30 ml/min' },
    },
    maxDailyDose: '3g (6g in severe infections)',
    contraindications: ['Penicillin hypersensitivity', 'History of amoxicillin-associated jaundice/hepatic dysfunction'],
    pregnancyCategory: 'B',
    pregnancyNotes: 'Safe in pregnancy. Widely used.',
    lactationSafety: 'safe',
    lactationNotes: 'Small amounts in breast milk. May cause diarrhoea/candidiasis in infant.',
    renalRisk: 'dose_adjust',
    renalNotes: 'Reduce frequency in renal impairment.',
    hepaticRisk: 'monitor',
    hepaticNotes: 'Rarely causes cholestatic jaundice. Monitor LFTs if prolonged course.',
    cardiacRisk: 'safe',
    sideEffects: {
      common: ['Diarrhoea', 'Nausea', 'Rash (non-allergic, especially with EBV)'],
      serious: ['Anaphylaxis', 'C. difficile colitis', 'Stevens-Johnson syndrome', 'Hepatitis'],
    },
    interactions: [
      { drug: 'Methotrexate', severity: 'moderate', effect: 'Reduced methotrexate excretion, increased toxicity' },
      { drug: 'Warfarin', severity: 'minor', effect: 'May slightly enhance anticoagulant effect' },
      { drug: 'Combined oral contraceptives', severity: 'minor', effect: 'Theoretically reduced efficacy (disputed)' },
    ],
    precautions: ['History of allergy (check penicillin allergy)', 'Infectious mononucleosis (high rash risk)', 'Renal impairment'],
    instructions: 'Complete the full course. Can be taken with or without food.',
  },
  {
    id: 'amoxicillin_clavulanate',
    genericName: 'Amoxicillin/Clavulanic Acid (Co-Amoxiclav)',
    brandNames: ['Augmentin', 'Clavamox'],
    category: 'Antibiotics - Penicillins',
    formulations: [
      { form: 'Tablet 375mg (250/125)', strength: '375mg', route: 'oral' },
      { form: 'Tablet 625mg (500/125)', strength: '625mg', route: 'oral' },
      { form: 'Tablet 1g (875/125)', strength: '1g', route: 'oral' },
      { form: 'Syrup 228mg/5ml', strength: '228mg/5ml', route: 'oral' },
      { form: 'Injection 600mg (500/100)', strength: '600mg', route: 'IV' },
      { form: 'Injection 1.2g (1000/200)', strength: '1.2g', route: 'IV' },
    ],
    dosage: {
      adult: { standard: '625mg oral tds / 1.2g IV tds', min: '375mg', max: '1g oral / 1.2g IV', frequency: ['tds', 'bd'] },
      pediatric: { standard: '25-45mg/kg/day (amoxicillin component) div tds', min: '25mg/kg/day', max: '45mg/kg/day', frequency: ['tds'] },
      renalImpairment: { adjustment: 'GFR 10-30: 375-625mg q12h. GFR <10: 375mg q24h.', gfrThreshold: '<30 ml/min' },
    },
    maxDailyDose: '3g amoxicillin component',
    contraindications: ['Penicillin allergy', 'History of co-amoxiclav jaundice', 'Infectious mononucleosis'],
    pregnancyCategory: 'B',
    pregnancyNotes: 'Generally safe. Avoid in premature rupture of membranes (necrotising enterocolitis risk in neonates).',
    lactationSafety: 'safe',
    lactationNotes: 'Compatible with breastfeeding.',
    renalRisk: 'dose_adjust',
    renalNotes: 'Adjust dose based on GFR.',
    hepaticRisk: 'monitor',
    hepaticNotes: 'Cholestatic jaundice may occur (usually after stopping). More common with co-amoxiclav than amoxicillin alone.',
    cardiacRisk: 'safe',
    sideEffects: {
      common: ['Diarrhoea', 'Nausea', 'Vomiting', 'Oral/vaginal candidiasis'],
      serious: ['Anaphylaxis', 'Cholestatic jaundice', 'C. difficile colitis', 'Hepatitis', 'Stevens-Johnson syndrome'],
    },
    interactions: [
      { drug: 'Warfarin', severity: 'moderate', effect: 'Enhanced anticoagulant effect' },
      { drug: 'Methotrexate', severity: 'moderate', effect: 'Reduced methotrexate excretion' },
      { drug: 'Allopurinol', severity: 'minor', effect: 'Increased risk of skin rash' },
    ],
    precautions: ['Liver function monitoring if prolonged use', 'Renal impairment'],
    instructions: 'Take at start of meal to reduce GI side effects.',
    monitoringRequired: ['LFTs if course >14 days'],
  },
  {
    id: 'cloxacillin',
    genericName: 'Cloxacillin (Flucloxacillin)',
    brandNames: ['Floxapen', 'Staphcillin'],
    category: 'Antibiotics - Penicillins',
    formulations: [
      { form: 'Capsule 250mg', strength: '250mg', route: 'oral' },
      { form: 'Capsule 500mg', strength: '500mg', route: 'oral' },
      { form: 'Injection 250mg vial', strength: '250mg', route: 'IV' },
      { form: 'Injection 500mg vial', strength: '500mg', route: 'IV' },
      { form: 'Injection 1g vial', strength: '1g', route: 'IV' },
    ],
    dosage: {
      adult: { standard: '500mg oral qds / 1-2g IV qds', min: '250mg', max: '2g', frequency: ['qds'] },
      pediatric: { standard: '12.5-25mg/kg qds', min: '12.5mg/kg', max: '50mg/kg', frequency: ['qds'] },
      renalImpairment: { adjustment: 'No dose adjustment usually needed. Reduce in severe impairment.' },
    },
    maxDailyDose: '8g IV; 4g oral',
    contraindications: ['Penicillin allergy', 'History of flucloxacillin-associated jaundice'],
    pregnancyCategory: 'B',
    pregnancyNotes: 'Safe in pregnancy.',
    lactationSafety: 'safe',
    lactationNotes: 'Trace amounts in breast milk. Safe.',
    renalRisk: 'safe',
    hepaticRisk: 'monitor',
    hepaticNotes: 'Risk of cholestatic jaundice, especially if >14 days or age >35. Avoid if history of hepatic reactions.',
    cardiacRisk: 'safe',
    sideEffects: {
      common: ['Nausea', 'Diarrhoea', 'Rash'],
      serious: ['Hepatitis/cholestatic jaundice', 'Anaphylaxis', 'Interstitial nephritis'],
    },
    interactions: [
      { drug: 'Warfarin', severity: 'minor', effect: 'May alter INR' },
      { drug: 'Methotrexate', severity: 'moderate', effect: 'Reduced clearance' },
    ],
    precautions: ['Take on empty stomach (1 hour before food)', 'Monitor LFTs if prolonged use', 'Risk of jaundice increases with age and duration'],
    instructions: 'Take on empty stomach, 30-60 minutes before food for best absorption.',
    monitoringRequired: ['LFTs if course >14 days'],
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // ANTIBIOTICS - CEPHALOSPORINS
  // ═══════════════════════════════════════════════════════════════════════════
  {
    id: 'ceftriaxone',
    genericName: 'Ceftriaxone',
    brandNames: ['Rocephin', 'Epicephin'],
    category: 'Antibiotics - Cephalosporins',
    formulations: [
      { form: 'Injection 250mg vial', strength: '250mg', route: 'IV' },
      { form: 'Injection 500mg vial', strength: '500mg', route: 'IV' },
      { form: 'Injection 1g vial', strength: '1g', route: 'IV' },
      { form: 'Injection 2g vial', strength: '2g', route: 'IV' },
      { form: 'Injection 1g vial', strength: '1g', route: 'IM' },
    ],
    dosage: {
      adult: { standard: '1-2g od', min: '1g', max: '4g', frequency: ['od', 'bd'] },
      pediatric: { standard: '50-80mg/kg od', min: '20mg/kg', max: '80mg/kg', frequency: ['od'], notes: 'Max 4g/day. Neonates: max 50mg/kg' },
      renalImpairment: { adjustment: 'No dose adjustment needed if isolated renal impairment. Max 2g/day if combined renal + hepatic impairment.' },
    },
    maxDailyDose: '4g',
    contraindications: ['Cephalosporin hypersensitivity', 'Neonates with jaundice/hypoalbuminaemia (displaces bilirubin)', 'Neonates receiving IV calcium (precipitation risk)'],
    pregnancyCategory: 'B',
    pregnancyNotes: 'Considered safe in pregnancy.',
    lactationSafety: 'safe',
    lactationNotes: 'Low concentrations in breast milk. Safe.',
    renalRisk: 'safe',
    renalNotes: 'Dual elimination (renal + biliary). Usually no adjustment needed.',
    hepaticRisk: 'monitor',
    hepaticNotes: 'Monitor if combined renal and hepatic impairment.',
    cardiacRisk: 'safe',
    sideEffects: {
      common: ['Diarrhoea', 'Rash', 'Pain at injection site', 'Eosinophilia'],
      serious: ['Anaphylaxis', 'C. difficile colitis', 'Haemolytic anaemia', 'Biliary sludge/gallstones (especially children)'],
    },
    interactions: [
      { drug: 'Calcium (IV)', severity: 'major', effect: 'Fatal precipitation in neonates. Avoid concurrent IV calcium in neonates.' },
      { drug: 'Warfarin', severity: 'moderate', effect: 'May enhance anticoagulant effect' },
    ],
    precautions: ['Penicillin allergy (2-5% cross-reactivity)', 'Not through calcium-containing IV lines in neonates'],
    instructions: 'IV: infuse over 30 min. IM: reconstitute with 1% lidocaine.',
  },
  {
    id: 'cefuroxime',
    genericName: 'Cefuroxime',
    brandNames: ['Zinacef', 'Zinnat'],
    category: 'Antibiotics - Cephalosporins',
    formulations: [
      { form: 'Tablet 250mg', strength: '250mg', route: 'oral' },
      { form: 'Tablet 500mg', strength: '500mg', route: 'oral' },
      { form: 'Injection 750mg vial', strength: '750mg', route: 'IV' },
      { form: 'Injection 1.5g vial', strength: '1.5g', route: 'IV' },
    ],
    dosage: {
      adult: { standard: '250-500mg oral bd / 750mg-1.5g IV tds', min: '250mg', max: '1.5g', frequency: ['bd', 'tds'] },
      pediatric: { standard: '30-100mg/kg/day div tds IV; 15mg/kg bd oral', min: '15mg/kg/day', max: '100mg/kg/day', frequency: ['bd', 'tds'] },
      renalImpairment: { adjustment: 'GFR 10-20: standard dose q12h. GFR <10: standard dose q24h', gfrThreshold: '<20 ml/min' },
    },
    maxDailyDose: '6g IV; 1g oral',
    contraindications: ['Cephalosporin hypersensitivity'],
    pregnancyCategory: 'B',
    pregnancyNotes: 'Safe in pregnancy.',
    lactationSafety: 'safe',
    renalRisk: 'dose_adjust',
    renalNotes: 'Adjust interval based on GFR.',
    hepaticRisk: 'safe',
    cardiacRisk: 'safe',
    sideEffects: {
      common: ['Diarrhoea', 'Nausea', 'Headache'],
      serious: ['Anaphylaxis', 'C. difficile colitis', 'Interstitial nephritis'],
    },
    interactions: [
      { drug: 'Probenecid', severity: 'moderate', effect: 'Increased cefuroxime levels' },
      { drug: 'Warfarin', severity: 'moderate', effect: 'May enhance anticoagulant effect' },
    ],
    precautions: ['Penicillin allergy (cross-reactivity risk)', 'Take tablets with food for absorption'],
    instructions: 'Oral: take with food for better absorption. IV: infuse over 3-5 min or 30 min.',
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // ANTIBIOTICS - QUINOLONES
  // ═══════════════════════════════════════════════════════════════════════════
  {
    id: 'ciprofloxacin',
    genericName: 'Ciprofloxacin',
    brandNames: ['Cipro', 'Ciproxin'],
    category: 'Antibiotics - Quinolones',
    formulations: [
      { form: 'Tablet 250mg', strength: '250mg', route: 'oral' },
      { form: 'Tablet 500mg', strength: '500mg', route: 'oral' },
      { form: 'Tablet 750mg', strength: '750mg', route: 'oral' },
      { form: 'Infusion 200mg/100ml', strength: '200mg', route: 'IV' },
      { form: 'Infusion 400mg/200ml', strength: '400mg', route: 'IV' },
    ],
    dosage: {
      adult: { standard: '500mg oral bd / 400mg IV bd', min: '250mg', max: '750mg oral / 400mg IV', frequency: ['bd'] },
      renalImpairment: { adjustment: 'GFR 30-60: oral dose unchanged; GFR <30: 250-500mg q24h oral; IV 200mg q12h', gfrThreshold: '<30 ml/min' },
    },
    maxDailyDose: '1.5g oral; 800mg IV',
    contraindications: ['History of tendon disorders with quinolones', 'Children <18 (risk of joint/cartilage damage, use only if no alternative)', 'Concurrent tizanidine', 'Epilepsy (relative)'],
    pregnancyCategory: 'C',
    pregnancyNotes: 'Avoid in pregnancy (arthropathy risk in animal studies). Use only if no safer alternative.',
    lactationSafety: 'avoid',
    lactationNotes: 'Excreted in breast milk. Risk of arthropathy in infant. Avoid.',
    renalRisk: 'dose_adjust',
    renalNotes: 'Reduce dose and/or frequency in renal impairment.',
    hepaticRisk: 'monitor',
    hepaticNotes: 'Rare hepatotoxicity. Monitor if prolonged use.',
    cardiacRisk: 'caution',
    cardiacNotes: 'Risk of QT prolongation. Avoid in patients with known QT prolongation.',
    sideEffects: {
      common: ['Nausea', 'Diarrhoea', 'Headache', 'Dizziness', 'Rash'],
      serious: ['Tendon rupture/tendinitis', 'QT prolongation', 'Seizures', 'C. difficile colitis', 'Peripheral neuropathy', 'Aortic dissection (rare)'],
    },
    interactions: [
      { drug: 'Theophylline', severity: 'major', effect: 'Increased theophylline levels, toxicity risk' },
      { drug: 'Tizanidine', severity: 'major', effect: 'Contraindicated. Markedly increased tizanidine levels.' },
      { drug: 'Warfarin', severity: 'moderate', effect: 'Enhanced anticoagulant effect' },
      { drug: 'Iron/Calcium/Antacids', severity: 'moderate', effect: 'Reduced ciprofloxacin absorption. Separate by 2h.' },
      { drug: 'NSAIDs', severity: 'moderate', effect: 'Increased risk of seizures' },
      { drug: 'Methotrexate', severity: 'moderate', effect: 'Increased methotrexate toxicity' },
    ],
    precautions: ['Elderly (tendon rupture risk)', 'Epilepsy', 'Myasthenia gravis', 'G6PD deficiency', 'Avoid excessive sunlight'],
    instructions: 'Take 2 hours before or 6 hours after antacids/iron. Stay well-hydrated.',
    monitoringRequired: ['Tendon symptoms', 'QTc if risk factors'],
  },
  {
    id: 'levofloxacin',
    genericName: 'Levofloxacin',
    brandNames: ['Tavanic', 'Levaquin'],
    category: 'Antibiotics - Quinolones',
    formulations: [
      { form: 'Tablet 250mg', strength: '250mg', route: 'oral' },
      { form: 'Tablet 500mg', strength: '500mg', route: 'oral' },
      { form: 'Infusion 500mg/100ml', strength: '500mg', route: 'IV' },
    ],
    dosage: {
      adult: { standard: '500mg od', min: '250mg', max: '500mg', frequency: ['od', 'bd'] },
      renalImpairment: { adjustment: 'GFR 20-49: 250mg q24h. GFR 10-19: 250mg q48h.', gfrThreshold: '<50 ml/min' },
    },
    maxDailyDose: '1g',
    contraindications: ['Quinolone hypersensitivity', 'History of quinolone tendinopathy', 'Epilepsy (relative)', 'Children'],
    pregnancyCategory: 'C',
    pregnancyNotes: 'Avoid in pregnancy.',
    lactationSafety: 'avoid',
    renalRisk: 'dose_adjust',
    hepaticRisk: 'monitor',
    cardiacRisk: 'caution',
    cardiacNotes: 'QT prolongation risk. Avoid with other QT-prolonging drugs.',
    sideEffects: {
      common: ['Nausea', 'Diarrhoea', 'Headache', 'Insomnia'],
      serious: ['Tendon rupture', 'QT prolongation', 'Hepatic failure', 'Seizures', 'Peripheral neuropathy'],
    },
    interactions: [
      { drug: 'Warfarin', severity: 'moderate', effect: 'Enhanced anticoagulant effect' },
      { drug: 'Theophylline', severity: 'moderate', effect: 'Increased theophylline levels' },
      { drug: 'NSAIDs', severity: 'moderate', effect: 'Increased seizure risk' },
      { drug: 'Antacids/Iron/Calcium', severity: 'moderate', effect: 'Reduced absorption. Separate by 2h.' },
    ],
    precautions: ['Same as ciprofloxacin - tendon, QT, CNS risks'],
    instructions: 'Infuse IV over 60 minutes (250mg) to 90 minutes (500mg).',
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // ANTIBIOTICS - AMINOGLYCOSIDES
  // ═══════════════════════════════════════════════════════════════════════════
  {
    id: 'gentamicin',
    genericName: 'Gentamicin',
    brandNames: ['Garamycin', 'Cidomycin'],
    category: 'Antibiotics - Aminoglycosides',
    formulations: [
      { form: 'Injection 40mg/ml (2ml)', strength: '80mg', route: 'IV' },
      { form: 'Injection 40mg/ml (2ml)', strength: '80mg', route: 'IM' },
    ],
    dosage: {
      adult: { standard: '5-7mg/kg od (extended-interval) or 1-1.7mg/kg q8h (traditional)', min: '3mg/kg', max: '7mg/kg', frequency: ['od', 'q8h'], notes: 'Once-daily dosing preferred. Use ideal body weight for dosing in obese patients.' },
      pediatric: { standard: '7.5mg/kg q24h (neonates: 5mg/kg q36-48h)', min: '5mg/kg', max: '7.5mg/kg', frequency: ['od'] },
      renalImpairment: { adjustment: 'MUST adjust. Monitor levels. GFR 40-60: q12h; GFR 20-40: q24h; GFR <20: q48h + levels', gfrThreshold: '<60 ml/min' },
    },
    maxDailyDose: '7mg/kg (lean body weight)',
    contraindications: ['Myasthenia gravis', 'Known aminoglycoside hypersensitivity'],
    pregnancyCategory: 'D',
    pregnancyNotes: 'Ototoxic to fetus. Avoid unless life-threatening infection with no alternative.',
    lactationSafety: 'caution',
    lactationNotes: 'Small amounts in breast milk but poorly absorbed orally by infant.',
    renalRisk: 'monitor',
    renalNotes: 'Nephrotoxic. Monitor trough levels and renal function. Adjust dose based on levels.',
    hepaticRisk: 'safe',
    cardiacRisk: 'safe',
    sideEffects: {
      common: ['Injection site pain'],
      serious: ['Nephrotoxicity', 'Ototoxicity (vestibular & cochlear)', 'Neuromuscular blockade', 'C. difficile colitis'],
    },
    interactions: [
      { drug: 'Furosemide/Loop diuretics', severity: 'major', effect: 'Additive ototoxicity and nephrotoxicity' },
      { drug: 'Vancomycin', severity: 'moderate', effect: 'Additive nephrotoxicity. Monitor closely.' },
      { drug: 'Neuromuscular blockers', severity: 'moderate', effect: 'Enhanced neuromuscular blockade' },
      { drug: 'Amphotericin B', severity: 'moderate', effect: 'Additive nephrotoxicity' },
    ],
    precautions: ['Monitor drug levels (trough <1 mg/L for od; peak 5-10 trough <2 for multiple daily)', 'Adequate hydration', 'Avoid with other nephro/ototoxic drugs', 'Use ideal body weight for dosing'],
    instructions: 'IV: infuse over 30-60 min. Ensure adequate hydration. Check levels before 3rd dose.',
    monitoringRequired: ['Serum gentamicin levels (trough)', 'Renal function (U&E, creatinine)', 'Vestibular/hearing symptoms'],
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // ANTIBIOTICS - OTHERS
  // ═══════════════════════════════════════════════════════════════════════════
  {
    id: 'metronidazole',
    genericName: 'Metronidazole',
    brandNames: ['Flagyl', 'Metrogyl'],
    category: 'Antibiotics - Others',
    formulations: [
      { form: 'Tablet 200mg', strength: '200mg', route: 'oral' },
      { form: 'Tablet 400mg', strength: '400mg', route: 'oral' },
      { form: 'Infusion 500mg/100ml', strength: '500mg', route: 'IV' },
      { form: 'Suppository 500mg', strength: '500mg', route: 'rectal' },
      { form: 'Suppository 1g', strength: '1g', route: 'rectal' },
    ],
    dosage: {
      adult: { standard: '400mg oral tds / 500mg IV tds', min: '200mg', max: '500mg IV / 800mg oral', frequency: ['tds', 'bd'] },
      pediatric: { standard: '7.5mg/kg tds', min: '7.5mg/kg', max: '7.5mg/kg', frequency: ['tds'] },
      hepaticImpairment: { adjustment: 'Reduce dose by 50% in severe hepatic impairment. Use with caution.' },
    },
    maxDailyDose: '2g (1.5g IV)',
    contraindications: ['Known hypersensitivity to nitroimidazoles'],
    pregnancyCategory: 'B',
    pregnancyNotes: 'Avoid high-dose regimens in first trimester if possible. Short courses generally safe.',
    lactationSafety: 'caution',
    lactationNotes: 'Excreted in significant amounts. Consider expressing and discarding milk during and 24h after treatment.',
    renalRisk: 'safe',
    renalNotes: 'No dose adjustment in renal impairment.',
    hepaticRisk: 'dose_adjust',
    hepaticNotes: 'Reduced clearance in severe hepatic impairment. Reduce dose.',
    cardiacRisk: 'safe',
    sideEffects: {
      common: ['Nausea', 'Metallic taste', 'Anorexia', 'Dark urine'],
      serious: ['Peripheral neuropathy (prolonged use)', 'Seizures', 'Hepatotoxicity', 'Pancreatitis'],
    },
    interactions: [
      { drug: 'Alcohol', severity: 'major', effect: 'Disulfiram-like reaction (flushing, vomiting, tachycardia). Avoid alcohol during and 48h after.' },
      { drug: 'Warfarin', severity: 'major', effect: 'Significantly enhanced anticoagulant effect. Monitor INR closely.' },
      { drug: 'Lithium', severity: 'moderate', effect: 'Increased lithium levels' },
      { drug: 'Phenytoin', severity: 'moderate', effect: 'Inhibits phenytoin metabolism' },
    ],
    precautions: ['No alcohol during treatment and 48 hours after', 'Avoid prolonged courses (peripheral neuropathy risk)', 'May darken urine'],
    instructions: 'Do NOT consume alcohol during and 48 hours after completion. Infuse IV over 20-30 min.',
  },
  {
    id: 'vancomycin',
    genericName: 'Vancomycin',
    brandNames: ['Vancocin'],
    category: 'Antibiotics - Others',
    formulations: [
      { form: 'Injection 500mg vial', strength: '500mg', route: 'IV' },
      { form: 'Injection 1g vial', strength: '1g', route: 'IV' },
      { form: 'Capsule 125mg (for C. diff)', strength: '125mg', route: 'oral' },
    ],
    dosage: {
      adult: { standard: '15-20mg/kg IV q12h (loading 25-30mg/kg)', min: '1g', max: '2g', frequency: ['q12h'], notes: 'MUST be infused slowly (max 10mg/min). Target trough 15-20 for serious infections.' },
      pediatric: { standard: '15mg/kg q6h IV', min: '10mg/kg', max: '15mg/kg', frequency: ['q6h'] },
      renalImpairment: { adjustment: 'MUST adjust based on levels. GFR <50: extend interval. GFR <30: give loading then guided by levels.', gfrThreshold: '<50 ml/min' },
    },
    maxDailyDose: '4g (guided by levels)',
    contraindications: ['Known hypersensitivity'],
    pregnancyCategory: 'C',
    pregnancyNotes: 'Potential ototoxicity to fetus. Use only for serious MRSA infections with no alternative.',
    lactationSafety: 'caution',
    lactationNotes: 'Poorly absorbed orally by infant. Probably safe.',
    renalRisk: 'monitor',
    renalNotes: 'Nephrotoxic. Monitor renal function and drug levels closely.',
    hepaticRisk: 'safe',
    cardiacRisk: 'caution',
    cardiacNotes: 'Rapid infusion causes "Red Man Syndrome" (histamine release). Infuse slowly.',
    sideEffects: {
      common: ['Red Man Syndrome (if infused too fast)', 'Nausea', 'Phlebitis'],
      serious: ['Nephrotoxicity', 'Ototoxicity', 'Neutropenia', 'DRESS syndrome', 'Thrombocytopenia'],
    },
    interactions: [
      { drug: 'Aminoglycosides', severity: 'major', effect: 'Additive nephrotoxicity and ototoxicity' },
      { drug: 'Loop diuretics', severity: 'moderate', effect: 'Increased ototoxicity risk' },
      { drug: 'Neuromuscular blockers', severity: 'moderate', effect: 'Enhanced neuromuscular blockade' },
    ],
    precautions: ['SLOW infusion (over at least 60 min per 1g)', 'Therapeutic drug monitoring essential', 'Use ideal body weight for dosing in obese'],
    instructions: 'Infuse over minimum 60 minutes per 1g to prevent Red Man Syndrome.',
    monitoringRequired: ['Vancomycin trough levels (pre-dose)', 'Renal function (daily in ICU)', 'FBC weekly (neutropenia)', 'Auditory function'],
  },
  {
    id: 'erythromycin',
    genericName: 'Erythromycin',
    brandNames: ['Erythrocin', 'Erymax'],
    category: 'Antibiotics - Macrolides',
    formulations: [
      { form: 'Tablet 250mg', strength: '250mg', route: 'oral' },
      { form: 'Tablet 500mg', strength: '500mg', route: 'oral' },
      { form: 'Syrup 125mg/5ml', strength: '125mg/5ml', route: 'oral' },
      { form: 'Injection 1g vial', strength: '1g', route: 'IV' },
    ],
    dosage: {
      adult: { standard: '250-500mg qds oral / 500mg-1g qds IV', min: '250mg', max: '1g', frequency: ['qds', 'bd'] },
      pediatric: { standard: '12.5mg/kg qds', min: '12.5mg/kg', max: '12.5mg/kg', frequency: ['qds'] },
      hepaticImpairment: { adjustment: 'Use with caution. May accumulate.' },
    },
    maxDailyDose: '4g',
    contraindications: ['Macrolide hypersensitivity', 'Concurrent terfenadine, cisapride, pimozide, ergotamine'],
    pregnancyCategory: 'B',
    pregnancyNotes: 'Safe in pregnancy. Can be used as penicillin alternative.',
    lactationSafety: 'safe',
    renalRisk: 'safe',
    hepaticRisk: 'monitor',
    hepaticNotes: 'Hepatotoxicity risk (cholestatic). Monitor if prolonged use.',
    cardiacRisk: 'caution',
    cardiacNotes: 'QT prolongation risk. Avoid with other QT-prolonging drugs.',
    sideEffects: {
      common: ['Nausea', 'Vomiting', 'Abdominal pain', 'Diarrhoea'],
      serious: ['QT prolongation/Torsades de Pointes', 'Hepatotoxicity', 'Ototoxicity (high IV doses)'],
    },
    interactions: [
      { drug: 'Warfarin', severity: 'major', effect: 'Significantly increased INR. Monitor closely.' },
      { drug: 'Statins (simvastatin/atorvastatin)', severity: 'major', effect: 'Increased statin levels, rhabdomyolysis risk' },
      { drug: 'Carbamazepine', severity: 'major', effect: 'Increased carbamazepine levels, toxicity' },
      { drug: 'Theophylline', severity: 'major', effect: 'Increased theophylline levels' },
      { drug: 'Digoxin', severity: 'moderate', effect: 'Increased digoxin levels' },
    ],
    precautions: ['QT prolongation risk', 'Numerous drug interactions (CYP3A4 inhibitor)', 'GI intolerance common'],
    instructions: 'Take before meals for better absorption (depends on formulation).',
  },
  {
    id: 'azithromycin',
    genericName: 'Azithromycin',
    brandNames: ['Zithromax', 'Azithral'],
    category: 'Antibiotics - Macrolides',
    formulations: [
      { form: 'Tablet 250mg', strength: '250mg', route: 'oral' },
      { form: 'Tablet 500mg', strength: '500mg', route: 'oral' },
      { form: 'Syrup 200mg/5ml', strength: '200mg/5ml', route: 'oral' },
      { form: 'Injection 500mg vial', strength: '500mg', route: 'IV' },
    ],
    dosage: {
      adult: { standard: '500mg on day 1, then 250mg od for 4 days', min: '250mg', max: '500mg', frequency: ['od'], notes: 'Short courses: 500mg od x 3 days also common' },
      pediatric: { standard: '10mg/kg on day 1, then 5mg/kg od x 4 days', min: '5mg/kg', max: '10mg/kg', frequency: ['od'] },
    },
    maxDailyDose: '500mg',
    contraindications: ['Macrolide hypersensitivity', 'Severe hepatic impairment'],
    pregnancyCategory: 'B',
    pregnancyNotes: 'Generally safe. Can be used in pregnancy.',
    lactationSafety: 'safe',
    renalRisk: 'safe',
    hepaticRisk: 'monitor',
    hepaticNotes: 'Rare hepatotoxicity. Avoid in severe hepatic disease.',
    cardiacRisk: 'caution',
    cardiacNotes: 'Small QT prolongation risk, less than erythromycin.',
    sideEffects: {
      common: ['Diarrhoea', 'Nausea', 'Abdominal pain'],
      serious: ['QT prolongation', 'Hepatotoxicity', 'C. difficile colitis', 'Hearing loss (reversible)'],
    },
    interactions: [
      { drug: 'Warfarin', severity: 'moderate', effect: 'May enhance anticoagulant effect' },
      { drug: 'Antacids', severity: 'moderate', effect: 'Reduced absorption if taken simultaneously. Separate by 2h.' },
      { drug: 'Digoxin', severity: 'moderate', effect: 'Increased digoxin levels' },
    ],
    precautions: ['QT prolongation risk (less than erythromycin)', 'Fewer drug interactions than erythromycin'],
    instructions: 'Take at least 1 hour before or 2 hours after food.',
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // ANTICOAGULANTS
  // ═══════════════════════════════════════════════════════════════════════════
  {
    id: 'heparin',
    genericName: 'Unfractionated Heparin (UFH)',
    brandNames: ['Heparin'],
    category: 'Anticoagulants',
    formulations: [
      { form: 'Injection 1000 units/ml', strength: '1000 units/ml', route: 'IV' },
      { form: 'Injection 5000 units/ml', strength: '5000 units/ml', route: 'SC' },
      { form: 'Injection 5000 units/ml', strength: '5000 units/ml', route: 'IV' },
    ],
    dosage: {
      adult: { standard: 'Prophylaxis: 5000 units SC q8-12h. Treatment: 80 units/kg IV bolus then 18 units/kg/h infusion', min: '5000 units SC', max: 'Treatment dose per APTT', frequency: ['q8h', 'q12h'], notes: 'Adjust infusion based on APTT (target 1.5-2.5x normal)' },
      renalImpairment: { adjustment: 'Monitor more closely. May need lower doses.' },
    },
    maxDailyDose: 'Guided by APTT monitoring',
    contraindications: ['Active major bleeding', 'Severe thrombocytopenia', 'History of HIT', 'Bacterial endocarditis (relative)'],
    pregnancyCategory: 'C',
    pregnancyNotes: 'Does not cross placenta. Safe in pregnancy. Preferred anticoagulant in pregnancy.',
    lactationSafety: 'safe',
    lactationNotes: 'Not excreted in breast milk. Safe.',
    renalRisk: 'monitor',
    renalNotes: 'Monitor APTT more closely in renal impairment.',
    hepaticRisk: 'monitor',
    hepaticNotes: 'Increased bleeding risk in hepatic coagulopathy.',
    cardiacRisk: 'safe',
    sideEffects: {
      common: ['Bruising', 'Injection site haematoma'],
      serious: ['Haemorrhage', 'Heparin-Induced Thrombocytopenia (HIT)', 'Osteoporosis (long-term)', 'Hyperkalaemia'],
    },
    interactions: [
      { drug: 'NSAIDs', severity: 'major', effect: 'Increased bleeding risk' },
      { drug: 'Antiplatelets', severity: 'major', effect: 'Increased bleeding risk' },
      { drug: 'Warfarin', severity: 'moderate', effect: 'Additive anticoagulation (expected when bridging)' },
    ],
    precautions: ['Monitor APTT q6h initially for treatment doses', 'Check platelets at baseline and day 5-7 (HIT)', 'Have protamine available for reversal'],
    instructions: 'SC injections: do not rub site. IV infusion via pump only.',
    monitoringRequired: ['APTT (for treatment doses)', 'Platelet count (day 0, 5, and 7-10 for HIT)', 'Hb/Hct if bleeding suspected'],
  },
  {
    id: 'enoxaparin',
    genericName: 'Enoxaparin (LMWH)',
    brandNames: ['Clexane', 'Lovenox'],
    category: 'Anticoagulants',
    formulations: [
      { form: 'Pre-filled syringe 20mg/0.2ml', strength: '20mg', route: 'SC' },
      { form: 'Pre-filled syringe 40mg/0.4ml', strength: '40mg', route: 'SC' },
      { form: 'Pre-filled syringe 60mg/0.6ml', strength: '60mg', route: 'SC' },
      { form: 'Pre-filled syringe 80mg/0.8ml', strength: '80mg', route: 'SC' },
    ],
    dosage: {
      adult: { standard: 'Prophylaxis: 40mg od SC. Treatment: 1mg/kg q12h or 1.5mg/kg od SC', min: '20mg', max: '1.5mg/kg', frequency: ['od', 'bd'] },
      renalImpairment: { adjustment: 'GFR <30: Prophylaxis 20mg od; Treatment 1mg/kg od (not q12h). Monitor anti-Xa levels.', gfrThreshold: '<30 ml/min' },
    },
    maxDailyDose: '1.5mg/kg od or 1mg/kg q12h',
    contraindications: ['Active major bleeding', 'HIT (current or history)', 'Severe thrombocytopenia'],
    pregnancyCategory: 'B',
    pregnancyNotes: 'Does not cross placenta. Preferred for VTE in pregnancy.',
    lactationSafety: 'safe',
    lactationNotes: 'Not excreted in breast milk. Safe.',
    renalRisk: 'dose_adjust',
    renalNotes: 'Accumulates in renal impairment. Reduce dose if GFR <30. Monitor anti-Xa.',
    hepaticRisk: 'monitor',
    hepaticNotes: 'Increased bleeding risk in hepatic coagulopathy.',
    cardiacRisk: 'safe',
    sideEffects: {
      common: ['Injection site bruising', 'Mild bleeding'],
      serious: ['Major haemorrhage', 'HIT', 'Spinal/epidural haematoma (with neuraxial anaesthesia)', 'Osteoporosis (long-term)', 'Hyperkalaemia'],
    },
    interactions: [
      { drug: 'NSAIDs', severity: 'major', effect: 'Increased bleeding risk' },
      { drug: 'Antiplatelets', severity: 'major', effect: 'Increased bleeding risk' },
      { drug: 'SSRIs', severity: 'moderate', effect: 'Increased bleeding risk' },
    ],
    precautions: ['SC injection only (do NOT give IV)', 'Rotate injection sites', 'Check platelets at baseline and periodically', 'Caution with neuraxial anaesthesia (timing)'],
    instructions: 'Inject SC into abdominal wall. Do not expel air bubble. Do not rub injection site.',
    monitoringRequired: ['Anti-Xa levels (if renal impairment, obesity, pregnancy)', 'Platelet count', 'Signs of bleeding'],
  },
  {
    id: 'warfarin',
    genericName: 'Warfarin Sodium',
    brandNames: ['Coumadin', 'Marevan'],
    category: 'Anticoagulants',
    formulations: [
      { form: 'Tablet 1mg', strength: '1mg', route: 'oral' },
      { form: 'Tablet 2mg', strength: '2mg', route: 'oral' },
      { form: 'Tablet 3mg', strength: '3mg', route: 'oral' },
      { form: 'Tablet 5mg', strength: '5mg', route: 'oral' },
    ],
    dosage: {
      adult: { standard: 'Loading: 5-10mg for 2 days then adjust per INR. Maintenance: 3-9mg od', min: '1mg', max: '10mg', frequency: ['od'], notes: 'Target INR depends on indication: DVT/PE 2-3, Mechanical valve 2.5-3.5' },
      elderly: { standard: 'Start 3-5mg', min: '1mg', max: '5mg', frequency: ['od'], notes: 'Lower loading dose in elderly' },
    },
    maxDailyDose: 'Guided by INR',
    contraindications: ['Active bleeding', 'Severe hypertension', 'Pregnancy (teratogenic)', 'Severe hepatic disease', 'Recent CNS surgery'],
    pregnancyCategory: 'X',
    pregnancyNotes: 'CONTRAINDICATED. Teratogenic (warfarin embryopathy: nasal hypoplasia, skeletal abnormalities). Switch to heparin early in pregnancy.',
    lactationSafety: 'safe',
    lactationNotes: 'Not excreted in breast milk in clinically significant amounts. Safe.',
    renalRisk: 'monitor',
    renalNotes: 'Monitor INR more closely. Increased sensitivity in renal impairment.',
    hepaticRisk: 'avoid',
    hepaticNotes: 'Enhanced effect in hepatic impairment. High bleeding risk. Generally avoid.',
    cardiacRisk: 'safe',
    sideEffects: {
      common: ['Bruising', 'Minor bleeding (gums, nose)'],
      serious: ['Major haemorrhage', 'Warfarin skin necrosis', 'Purple toe syndrome', 'Calciphylaxis'],
    },
    interactions: [
      { drug: 'NSAIDs', severity: 'major', effect: 'Increased bleeding risk + GI erosion' },
      { drug: 'Antibiotics (many)', severity: 'major', effect: 'Most antibiotics alter INR. Monitor closely.' },
      { drug: 'Amiodarone', severity: 'major', effect: 'Markedly increased INR. Reduce warfarin dose by 30-50%.' },
      { drug: 'Statins', severity: 'moderate', effect: 'Some statins increase INR' },
      { drug: 'Paracetamol (>2g/day)', severity: 'moderate', effect: 'May increase INR with prolonged use' },
      { drug: 'Cranberry juice', severity: 'moderate', effect: 'Variable effect on INR' },
    ],
    precautions: ['Consistent vitamin K intake', 'Many drug and food interactions', 'Patient education essential', 'Carry anticoagulant alert card'],
    instructions: 'Take at the same time each day (usually evening). Maintain consistent diet. Report any unusual bleeding.',
    monitoringRequired: ['INR (initially 2-3 times/week, then monthly when stable)', 'Signs of bleeding'],
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // ANTIEMETICS
  // ═══════════════════════════════════════════════════════════════════════════
  {
    id: 'metoclopramide',
    genericName: 'Metoclopramide',
    brandNames: ['Maxolon', 'Reglan', 'Plasil'],
    category: 'Antiemetics',
    formulations: [
      { form: 'Tablet 10mg', strength: '10mg', route: 'oral' },
      { form: 'Injection 10mg/2ml', strength: '10mg', route: 'IV' },
      { form: 'Injection 10mg/2ml', strength: '10mg', route: 'IM' },
    ],
    dosage: {
      adult: { standard: '10mg tds', min: '5mg', max: '10mg', frequency: ['tds'], notes: 'Maximum 5 days use. Max 0.5mg/kg/day.' },
      pediatric: { standard: '0.1-0.15mg/kg up to tds', min: '0.1mg/kg', max: '0.15mg/kg', frequency: ['tds'], notes: 'Avoid in <1 year. Higher dystonia risk in children.' },
      renalImpairment: { adjustment: 'GFR <30: reduce dose by 50%', gfrThreshold: '<30 ml/min' },
    },
    maxDailyDose: '30mg (max 5 days)',
    contraindications: ['GI obstruction/perforation', 'Phaeochromocytoma', '3-4 days after GI surgery', 'Prolactinoma', 'History of tardive dyskinesia'],
    pregnancyCategory: 'B',
    pregnancyNotes: 'Can be used for hyperemesis gravidarum. Generally safe.',
    lactationSafety: 'caution',
    lactationNotes: 'Excreted in breast milk. May increase milk production. Use with caution.',
    renalRisk: 'dose_adjust',
    hepaticRisk: 'dose_adjust',
    hepaticNotes: 'Reduce dose in severe hepatic impairment.',
    cardiacRisk: 'caution',
    cardiacNotes: 'QT prolongation risk, especially IV. Avoid in QT prolongation.',
    sideEffects: {
      common: ['Drowsiness', 'Fatigue', 'Diarrhoea', 'Restlessness'],
      serious: ['Extrapyramidal reactions/dystonia', 'Tardive dyskinesia', 'Neuroleptic malignant syndrome', 'QT prolongation'],
    },
    interactions: [
      { drug: 'Antipsychotics', severity: 'moderate', effect: 'Increased risk of extrapyramidal effects' },
      { drug: 'SSRIs', severity: 'moderate', effect: 'Increased risk of serotonin syndrome and extrapyramidal effects' },
      { drug: 'Levodopa', severity: 'moderate', effect: 'Antagonized effect (dopamine antagonist)' },
    ],
    precautions: ['Maximum 5 days use (longer use = tardive dyskinesia risk)', 'Young adults at higher risk of dystonia', 'Give IV slowly'],
    instructions: 'Take 30 minutes before meals. IV: give slowly over at least 3 minutes.',
  },
  {
    id: 'ondansetron',
    genericName: 'Ondansetron',
    brandNames: ['Zofran'],
    category: 'Antiemetics',
    formulations: [
      { form: 'Tablet 4mg', strength: '4mg', route: 'oral' },
      { form: 'Tablet 8mg', strength: '8mg', route: 'oral' },
      { form: 'ODT (orally disintegrating) 4mg', strength: '4mg', route: 'oral' },
      { form: 'Injection 4mg/2ml', strength: '4mg', route: 'IV' },
      { form: 'Injection 8mg/4ml', strength: '8mg', route: 'IV' },
    ],
    dosage: {
      adult: { standard: '4-8mg q8h', min: '4mg', max: '16mg', frequency: ['tds', 'bd', 'prn'] },
      pediatric: { standard: '0.1mg/kg (max 4mg) IV', min: '0.1mg/kg', max: '0.15mg/kg', frequency: ['tds'] },
      hepaticImpairment: { adjustment: 'Max 8mg/day in moderate-severe hepatic impairment' },
    },
    maxDailyDose: '24mg (8mg in hepatic impairment)',
    contraindications: ['Known hypersensitivity', 'Congenital long QT syndrome'],
    pregnancyCategory: 'B',
    pregnancyNotes: 'May be used for severe pregnancy-related nausea. Generally safe.',
    lactationSafety: 'caution',
    lactationNotes: 'Limited data. Probably compatible.',
    renalRisk: 'safe',
    hepaticRisk: 'dose_adjust',
    hepaticNotes: 'Max 8mg/day in moderate-severe hepatic impairment.',
    cardiacRisk: 'caution',
    cardiacNotes: 'Dose-dependent QT prolongation. Max single IV dose 16mg. ECG monitoring for IV use.',
    sideEffects: {
      common: ['Headache', 'Constipation', 'Flushing'],
      serious: ['QT prolongation', 'Serotonin syndrome (with serotonergic drugs)', 'Anaphylaxis'],
    },
    interactions: [
      { drug: 'Apomorphine', severity: 'major', effect: 'Profound hypotension. Contraindicated.' },
      { drug: 'Tramadol', severity: 'moderate', effect: 'Reduced analgesic effect of tramadol' },
      { drug: 'QT-prolonging drugs', severity: 'moderate', effect: 'Additive QT prolongation risk' },
    ],
    precautions: ['QT prolongation risk', 'Constipation (especially post-operatively)', 'May mask GI obstruction signs'],
    instructions: 'Can be taken with or without food. ODT: place on tongue to dissolve.',
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // GASTROINTESTINAL
  // ═══════════════════════════════════════════════════════════════════════════
  {
    id: 'omeprazole',
    genericName: 'Omeprazole',
    brandNames: ['Losec', 'Prilosec'],
    category: 'Gastrointestinal',
    formulations: [
      { form: 'Capsule 20mg', strength: '20mg', route: 'oral' },
      { form: 'Capsule 40mg', strength: '40mg', route: 'oral' },
      { form: 'Injection 40mg vial', strength: '40mg', route: 'IV' },
    ],
    dosage: {
      adult: { standard: '20mg od (stress ulcer prophylaxis) / 40mg od-bd (treatment)', min: '20mg', max: '40mg', frequency: ['od', 'bd'] },
      pediatric: { standard: '0.7-1.4mg/kg od', min: '0.7mg/kg', max: '1.4mg/kg', frequency: ['od'] },
    },
    maxDailyDose: '80mg (acute GI bleed)',
    contraindications: ['Known hypersensitivity to PPIs'],
    pregnancyCategory: 'C',
    pregnancyNotes: 'Use only if clearly needed. Some data suggests safety.',
    lactationSafety: 'caution',
    lactationNotes: 'Excreted in breast milk. Probably safe at standard doses.',
    renalRisk: 'safe',
    hepaticRisk: 'dose_adjust',
    hepaticNotes: 'Max 20mg/day in severe hepatic impairment.',
    cardiacRisk: 'safe',
    sideEffects: {
      common: ['Headache', 'Nausea', 'Diarrhoea', 'Abdominal pain', 'Flatulence'],
      serious: ['C. difficile infection', 'Hypomagnesaemia (long-term)', 'Osteoporotic fractures (long-term)', 'Vitamin B12 deficiency (long-term)', 'Interstitial nephritis'],
    },
    interactions: [
      { drug: 'Clopidogrel', severity: 'major', effect: 'Reduced clopidogrel activation. Avoid combination (use pantoprazole instead).' },
      { drug: 'Methotrexate', severity: 'moderate', effect: 'Increased methotrexate levels' },
      { drug: 'Warfarin', severity: 'moderate', effect: 'May increase INR' },
      { drug: 'Phenytoin', severity: 'moderate', effect: 'Increased phenytoin levels' },
    ],
    precautions: ['Long-term use: check Mg2+, B12, bone density', 'May mask gastric malignancy symptoms'],
    instructions: 'Take 30 minutes before food for best effect. Swallow capsules whole.',
    monitoringRequired: ['Magnesium if long-term use', 'B12 if prolonged use'],
  },
  {
    id: 'ranitidine',
    genericName: 'Ranitidine',
    brandNames: ['Zantac'],
    category: 'Gastrointestinal',
    formulations: [
      { form: 'Tablet 150mg', strength: '150mg', route: 'oral' },
      { form: 'Tablet 300mg', strength: '300mg', route: 'oral' },
      { form: 'Injection 50mg/2ml', strength: '50mg', route: 'IV' },
    ],
    dosage: {
      adult: { standard: '150mg bd or 300mg nocte', min: '150mg', max: '300mg', frequency: ['bd', 'nocte'] },
      renalImpairment: { adjustment: 'GFR <50: 150mg od', gfrThreshold: '<50 ml/min' },
    },
    maxDailyDose: '600mg (300mg in renal impairment)',
    contraindications: ['Known hypersensitivity', 'Porphyria'],
    pregnancyCategory: 'B',
    pregnancyNotes: 'Safe in pregnancy.',
    lactationSafety: 'safe',
    renalRisk: 'dose_adjust',
    hepaticRisk: 'monitor',
    cardiacRisk: 'safe',
    sideEffects: {
      common: ['Headache', 'Dizziness', 'Constipation/Diarrhoea'],
      serious: ['Hepatitis (rare)', 'Blood dyscrasias (rare)', 'Interstitial nephritis'],
    },
    interactions: [
      { drug: 'Warfarin', severity: 'minor', effect: 'May slightly increase INR' },
      { drug: 'Ketoconazole', severity: 'moderate', effect: 'Reduced ketoconazole absorption' },
    ],
    precautions: ['Note: ranitidine withdrawn in many countries due to NDMA contamination concerns. Check local availability.'],
    instructions: 'Can be taken with or without food.',
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // CARDIOVASCULAR
  // ═══════════════════════════════════════════════════════════════════════════
  {
    id: 'amlodipine',
    genericName: 'Amlodipine',
    brandNames: ['Norvasc', 'Amlovar'],
    category: 'Cardiovascular - Antihypertensives',
    formulations: [
      { form: 'Tablet 5mg', strength: '5mg', route: 'oral' },
      { form: 'Tablet 10mg', strength: '10mg', route: 'oral' },
    ],
    dosage: {
      adult: { standard: '5mg od', min: '2.5mg', max: '10mg', frequency: ['od'] },
      elderly: { standard: '2.5mg od', min: '2.5mg', max: '5mg', frequency: ['od'] },
      hepaticImpairment: { adjustment: 'Start with 2.5mg. Max 5mg.' },
    },
    maxDailyDose: '10mg',
    contraindications: ['Cardiogenic shock', 'Severe aortic stenosis', 'Unstable angina (not already on beta-blocker)'],
    pregnancyCategory: 'C',
    pregnancyNotes: 'Avoid in pregnancy. Use labetalol or methyldopa instead.',
    lactationSafety: 'unknown',
    lactationNotes: 'Unknown excretion in breast milk. Use with caution.',
    renalRisk: 'safe',
    hepaticRisk: 'dose_adjust',
    hepaticNotes: 'Reduce dose. Increased bioavailability in hepatic impairment.',
    cardiacRisk: 'monitor',
    cardiacNotes: 'May worsen heart failure. Monitor for oedema.',
    sideEffects: {
      common: ['Peripheral oedema', 'Headache', 'Flushing', 'Dizziness', 'Fatigue'],
      serious: ['Severe hypotension', 'Hepatitis (rare)', 'Angioedema (rare)'],
    },
    interactions: [
      { drug: 'Simvastatin', severity: 'moderate', effect: 'Increased simvastatin levels. Max simvastatin 20mg with amlodipine.' },
      { drug: 'Cyclosporin', severity: 'moderate', effect: 'Increased cyclosporin levels' },
      { drug: 'Beta-blockers', severity: 'minor', effect: 'Additive hypotensive and bradycardic effect' },
    ],
    precautions: ['Heart failure', 'Hepatic impairment', 'Elderly'],
    instructions: 'Can be taken with or without food. Takes 7-10 days for full effect.',
  },
  {
    id: 'lisinopril',
    genericName: 'Lisinopril',
    brandNames: ['Zestril', 'Prinivil'],
    category: 'Cardiovascular - Antihypertensives',
    formulations: [
      { form: 'Tablet 2.5mg', strength: '2.5mg', route: 'oral' },
      { form: 'Tablet 5mg', strength: '5mg', route: 'oral' },
      { form: 'Tablet 10mg', strength: '10mg', route: 'oral' },
      { form: 'Tablet 20mg', strength: '20mg', route: 'oral' },
    ],
    dosage: {
      adult: { standard: '10mg od', min: '2.5mg', max: '40mg', frequency: ['od'] },
      renalImpairment: { adjustment: 'GFR 30-70: start 5-10mg. GFR 10-30: start 2.5-5mg. GFR <10: start 2.5mg.', gfrThreshold: '<30 ml/min' },
    },
    maxDailyDose: '80mg (hypertension); 35mg (heart failure)',
    contraindications: ['Angioedema history with ACEi', 'Bilateral renal artery stenosis', 'Pregnancy', 'Severe aortic stenosis'],
    pregnancyCategory: 'D',
    pregnancyNotes: 'CONTRAINDICATED in 2nd & 3rd trimester (fetal renal failure, oligohydramnios, skull defects). Avoid in 1st trimester if possible.',
    lactationSafety: 'caution',
    lactationNotes: 'Limited data. Use with caution.',
    renalRisk: 'dose_adjust',
    renalNotes: 'Start low. Can initially worsen renal function (acceptable up to 30% rise in creatinine). Monitor closely.',
    hepaticRisk: 'safe',
    cardiacRisk: 'monitor',
    cardiacNotes: 'Beneficial in heart failure. Risk of first-dose hypotension. Start low.',
    sideEffects: {
      common: ['Dry cough (10-15%)', 'Dizziness', 'Headache', 'Hyperkalaemia'],
      serious: ['Angioedema', 'Renal failure', 'Severe hypotension', 'Hyperkalaemia'],
    },
    interactions: [
      { drug: 'Potassium supplements/K-sparing diuretics', severity: 'major', effect: 'Severe hyperkalaemia risk' },
      { drug: 'NSAIDs', severity: 'moderate', effect: 'Reduced ACEi effect, increased renal risk, hyperkalaemia' },
      { drug: 'Lithium', severity: 'moderate', effect: 'Increased lithium levels' },
      { drug: 'Aliskiren', severity: 'major', effect: 'Avoid combination (dual RAAS blockade)' },
    ],
    precautions: ['First-dose hypotension (especially if volume depleted/on diuretics)', 'Monitor K+ and creatinine', 'Stop if angioedema occurs'],
    instructions: 'Can be taken with or without food. Take at same time daily.',
    monitoringRequired: ['U&E, creatinine at baseline, 1-2 weeks, then periodically', 'Blood pressure'],
  },
  {
    id: 'atenolol',
    genericName: 'Atenolol',
    brandNames: ['Tenormin'],
    category: 'Cardiovascular - Antihypertensives',
    formulations: [
      { form: 'Tablet 25mg', strength: '25mg', route: 'oral' },
      { form: 'Tablet 50mg', strength: '50mg', route: 'oral' },
      { form: 'Tablet 100mg', strength: '100mg', route: 'oral' },
    ],
    dosage: {
      adult: { standard: '50mg od', min: '25mg', max: '100mg', frequency: ['od'] },
      renalImpairment: { adjustment: 'GFR 15-35: 50mg od or 25mg od. GFR <15: 25mg od or 50mg alternate days.', gfrThreshold: '<35 ml/min' },
    },
    maxDailyDose: '100mg',
    contraindications: ['Severe bradycardia', 'Heart block (2nd/3rd degree)', 'Uncontrolled heart failure', 'Cardiogenic shock', 'Phaeochromocytoma (without alpha-blocker)'],
    pregnancyCategory: 'D',
    pregnancyNotes: 'May cause fetal growth restriction. Avoid. Labetalol preferred if beta-blocker needed.',
    lactationSafety: 'caution',
    lactationNotes: 'Concentrated in breast milk. Monitor infant for bradycardia.',
    renalRisk: 'dose_adjust',
    renalNotes: 'Renally excreted. Reduce dose based on GFR.',
    hepaticRisk: 'safe',
    cardiacRisk: 'monitor',
    cardiacNotes: 'Therapeutic in many cardiac conditions but can worsen heart failure. Do NOT stop abruptly.',
    sideEffects: {
      common: ['Fatigue', 'Cold extremities', 'Bradycardia', 'Dizziness', 'Nausea'],
      serious: ['Severe bradycardia', 'Heart block', 'Bronchospasm', 'Heart failure exacerbation'],
    },
    interactions: [
      { drug: 'Verapamil/Diltiazem', severity: 'major', effect: 'Risk of severe bradycardia and heart block' },
      { drug: 'Clonidine', severity: 'moderate', effect: 'Rebound hypertension if clonidine stopped first' },
      { drug: 'Digoxin', severity: 'moderate', effect: 'Additive bradycardia' },
      { drug: 'Insulin', severity: 'moderate', effect: 'May mask hypoglycaemia symptoms' },
    ],
    precautions: ['Do NOT stop abruptly (rebound angina/MI)', 'Mask hypoglycaemia in diabetics', 'Caution in asthma/COPD', 'Withdraw gradually over 1-2 weeks'],
    instructions: 'Take at the same time daily. Do not stop suddenly.',
  },
  {
    id: 'furosemide',
    genericName: 'Furosemide (Frusemide)',
    brandNames: ['Lasix'],
    category: 'Cardiovascular - Others',
    formulations: [
      { form: 'Tablet 40mg', strength: '40mg', route: 'oral' },
      { form: 'Tablet 80mg', strength: '80mg', route: 'oral' },
      { form: 'Injection 20mg/2ml', strength: '20mg', route: 'IV' },
      { form: 'Injection 40mg/4ml', strength: '40mg', route: 'IV' },
    ],
    dosage: {
      adult: { standard: '20-40mg od oral / 20-80mg IV', min: '20mg', max: '80mg', frequency: ['od', 'bd'], notes: 'Higher doses in renal failure (up to 250mg IV)' },
      pediatric: { standard: '0.5-1mg/kg', min: '0.5mg/kg', max: '2mg/kg', frequency: ['od', 'bd'] },
    },
    maxDailyDose: '80mg oral usual; up to 600mg IV in renal failure',
    contraindications: ['Severe hyponatraemia', 'Severe hypokalaemia', 'Anuria (non-responsive to furosemide)', 'Dehydration'],
    pregnancyCategory: 'C',
    pregnancyNotes: 'Use only if clearly needed. May reduce placental perfusion.',
    lactationSafety: 'caution',
    lactationNotes: 'May suppress lactation. Use with caution.',
    renalRisk: 'monitor',
    renalNotes: 'Higher doses may be needed in renal impairment. Monitor electrolytes closely.',
    hepaticRisk: 'monitor',
    hepaticNotes: 'Risk of hepatic encephalopathy (electrolyte disturbance). Use with K-sparing diuretic.',
    cardiacRisk: 'monitor',
    cardiacNotes: 'Therapeutic in heart failure. Monitor electrolytes (K+, Mg2+) as depletion can cause arrhythmias.',
    sideEffects: {
      common: ['Hypokalaemia', 'Hyponatraemia', 'Dehydration', 'Dizziness', 'Hyperuricaemia'],
      serious: ['Severe electrolyte depletion', 'Ototoxicity (high doses/rapid IV)', 'Pancreatitis', 'Aplastic anaemia'],
    },
    interactions: [
      { drug: 'Aminoglycosides', severity: 'major', effect: 'Additive ototoxicity and nephrotoxicity' },
      { drug: 'Digoxin', severity: 'major', effect: 'Hypokalaemia potentiates digoxin toxicity' },
      { drug: 'ACE Inhibitors', severity: 'moderate', effect: 'First-dose hypotension risk' },
      { drug: 'NSAIDs', severity: 'moderate', effect: 'Reduced diuretic effect, increased renal risk' },
      { drug: 'Lithium', severity: 'moderate', effect: 'Increased lithium levels' },
    ],
    precautions: ['Monitor electrolytes (K+, Na+, Mg2+)', 'Risk of gout', 'IV infusion rate max 4mg/min (ototoxicity)'],
    instructions: 'Take in the morning (to avoid nocturia). IV: infuse slowly, max 4mg/min.',
    monitoringRequired: ['U&E (potassium, sodium)', 'Renal function', 'Blood pressure', 'Fluid balance'],
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // ENDOCRINE - DIABETES
  // ═══════════════════════════════════════════════════════════════════════════
  {
    id: 'metformin',
    genericName: 'Metformin',
    brandNames: ['Glucophage'],
    category: 'Endocrine - Diabetes',
    formulations: [
      { form: 'Tablet 500mg', strength: '500mg', route: 'oral' },
      { form: 'Tablet 850mg', strength: '850mg', route: 'oral' },
      { form: 'Tablet 1000mg', strength: '1000mg', route: 'oral' },
    ],
    dosage: {
      adult: { standard: '500mg bd-tds, titrate up', min: '500mg', max: '1000mg', frequency: ['bd', 'tds'], notes: 'Start 500mg od/bd, increase every 1-2 weeks' },
      renalImpairment: { adjustment: 'GFR 30-45: max 1g/day with close monitoring. GFR <30: CONTRAINDICATED.', gfrThreshold: '<30 ml/min' },
    },
    maxDailyDose: '3g (2g in elderly)',
    contraindications: ['GFR <30', 'Acute metabolic acidosis', 'Diabetic ketoacidosis', 'Severe tissue hypoxia/shock', 'Acute or chronic conditions causing hypoxia'],
    pregnancyCategory: 'B',
    pregnancyNotes: 'Increasingly used in gestational diabetes. Generally considered safe.',
    lactationSafety: 'safe',
    lactationNotes: 'Small amounts in breast milk. No adverse effects on breastfed infants reported.',
    renalRisk: 'avoid',
    renalNotes: 'CONTRAINDICATED if GFR <30 (lactic acidosis risk). Reduce dose if GFR 30-45.',
    hepaticRisk: 'avoid',
    hepaticNotes: 'Avoid in hepatic impairment (increased lactic acidosis risk).',
    cardiacRisk: 'monitor',
    cardiacNotes: 'Avoid in acute heart failure with hypoperfusion (lactic acidosis risk). OK in stable HF.',
    sideEffects: {
      common: ['Nausea', 'Diarrhoea', 'Abdominal pain', 'Metallic taste', 'Anorexia'],
      serious: ['Lactic acidosis (rare but potentially fatal)', 'Vitamin B12 deficiency (long-term)'],
    },
    interactions: [
      { drug: 'Contrast media (iodinated)', severity: 'major', effect: 'Withhold metformin 48h before and after contrast. Risk of lactic acidosis with renal impairment.' },
      { drug: 'Alcohol', severity: 'moderate', effect: 'Increased risk of lactic acidosis' },
      { drug: 'ACE Inhibitors', severity: 'minor', effect: 'May enhance blood glucose lowering effect' },
    ],
    precautions: ['Stop before surgery and iodinated contrast', 'Maintain hydration', 'B12 monitoring with long-term use'],
    instructions: 'Take with or after food to reduce GI side effects. Start with low dose and titrate.',
    monitoringRequired: ['Renal function (at least annually)', 'HbA1c', 'Vitamin B12 (annually with long-term use)'],
  },
  {
    id: 'insulin_soluble',
    genericName: 'Insulin Soluble (Regular Insulin)',
    brandNames: ['Actrapid', 'Humulin R'],
    category: 'Endocrine - Diabetes',
    formulations: [
      { form: 'Injection 100 units/ml (10ml vial)', strength: '100 units/ml', route: 'SC' },
      { form: 'Injection 100 units/ml (10ml vial)', strength: '100 units/ml', route: 'IV' },
    ],
    dosage: {
      adult: { standard: 'Variable. Typically 0.5-1 unit/kg/day total (divided)', min: '0.1 units/kg', max: '1 unit/kg', frequency: ['tds', 'qds', 'prn'], notes: 'SC: 15-30 min before meals. IV: for DKA per protocol. Dose individualized.' },
      renalImpairment: { adjustment: 'Insulin requirements often DECREASE in renal impairment. Reduce dose and monitor closely.' },
    },
    maxDailyDose: 'No fixed maximum. Titrate to glucose targets.',
    contraindications: ['Hypoglycaemia'],
    pregnancyCategory: 'B',
    pregnancyNotes: 'Safe in pregnancy. Insulin is the treatment of choice for diabetes in pregnancy.',
    lactationSafety: 'safe',
    lactationNotes: 'Does not pass into breast milk. Safe.',
    renalRisk: 'dose_adjust',
    renalNotes: 'Reduced clearance in renal impairment. Lower insulin requirements. Monitor closely.',
    hepaticRisk: 'dose_adjust',
    hepaticNotes: 'Reduced insulin clearance and reduced gluconeogenesis. Lower requirements. Monitor closely.',
    cardiacRisk: 'safe',
    sideEffects: {
      common: ['Hypoglycaemia', 'Injection site reactions', 'Weight gain'],
      serious: ['Severe hypoglycaemia (unconsciousness, seizures)', 'Hypokalaemia (especially IV)', 'Lipodystrophy'],
    },
    interactions: [
      { drug: 'Beta-blockers', severity: 'moderate', effect: 'Mask hypoglycaemia symptoms. Monitor closely.' },
      { drug: 'Corticosteroids', severity: 'moderate', effect: 'Increase insulin resistance. Dose adjustments needed.' },
      { drug: 'Thiazide diuretics', severity: 'moderate', effect: 'May increase blood glucose' },
    ],
    precautions: ['Self-monitoring of blood glucose essential', 'Educate on hypoglycaemia recognition and treatment', 'Rotate injection sites', 'Store unopened in fridge (2-8C)'],
    instructions: 'SC: inject 15-30 min before meals. Rotate injection sites. IV: ONLY regular insulin can be given IV.',
    monitoringRequired: ['Blood glucose (before meals and bedtime)', 'HbA1c (3-monthly)', 'Hypoglycaemia episodes'],
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // ENDOCRINE - STEROIDS
  // ═══════════════════════════════════════════════════════════════════════════
  {
    id: 'dexamethasone',
    genericName: 'Dexamethasone',
    brandNames: ['Decadron', 'Ozurdex'],
    category: 'Endocrine - Steroids',
    formulations: [
      { form: 'Tablet 0.5mg', strength: '0.5mg', route: 'oral' },
      { form: 'Tablet 4mg', strength: '4mg', route: 'oral' },
      { form: 'Injection 4mg/ml (1ml)', strength: '4mg', route: 'IV' },
      { form: 'Injection 4mg/ml (2ml)', strength: '8mg', route: 'IV' },
      { form: 'Injection 4mg/ml', strength: '4mg', route: 'IM' },
    ],
    dosage: {
      adult: { standard: '4-8mg IV/IM/oral', min: '0.5mg', max: '40mg', frequency: ['od', 'bd', 'tds'], notes: 'Anti-emetic: 8mg. Cerebral oedema: 16mg loading.' },
      pediatric: { standard: '0.15-0.5mg/kg', min: '0.1mg/kg', max: '0.5mg/kg', frequency: ['od'] },
    },
    maxDailyDose: 'Depends on indication (up to 40mg acute)',
    contraindications: ['Systemic fungal infections', 'Live vaccines (if immunosuppressive doses)'],
    pregnancyCategory: 'C',
    pregnancyNotes: 'Use if benefit outweighs risk. Crosses placenta (used for fetal lung maturation).',
    lactationSafety: 'caution',
    lactationNotes: 'Short courses OK. Avoid prolonged high doses.',
    renalRisk: 'safe',
    hepaticRisk: 'monitor',
    cardiacRisk: 'caution',
    cardiacNotes: 'Fluid retention, hypertension, hypokalaemia risk.',
    sideEffects: {
      common: ['Insomnia', 'Hyperglycaemia', 'Mood changes', 'Increased appetite', 'Weight gain'],
      serious: ['Adrenal suppression', 'Osteoporosis', 'Immunosuppression', 'Peptic ulcer', 'Avascular necrosis', 'Psychosis'],
    },
    interactions: [
      { drug: 'NSAIDs', severity: 'moderate', effect: 'Increased GI bleeding risk' },
      { drug: 'Warfarin', severity: 'moderate', effect: 'May alter INR' },
      { drug: 'Insulin/Oral hypoglycaemics', severity: 'moderate', effect: 'Increased blood glucose. Dose adjustments needed.' },
      { drug: 'Phenytoin/Carbamazepine/Rifampicin', severity: 'moderate', effect: 'Reduced dexamethasone effect (enzyme induction)' },
    ],
    precautions: ['Do not stop abruptly after prolonged use (adrenal crisis)', 'Monitor blood glucose', 'GI protection if combined with NSAIDs', 'Immunosuppression risk'],
    instructions: 'Take with food. Do not stop abruptly after more than 3 weeks use. Carry steroid card.',
    monitoringRequired: ['Blood glucose', 'Blood pressure', 'Signs of infection'],
  },
  {
    id: 'hydrocortisone',
    genericName: 'Hydrocortisone',
    brandNames: ['Solu-Cortef', 'Hydrocortone'],
    category: 'Endocrine - Steroids',
    formulations: [
      { form: 'Tablet 10mg', strength: '10mg', route: 'oral' },
      { form: 'Tablet 20mg', strength: '20mg', route: 'oral' },
      { form: 'Injection 100mg vial', strength: '100mg', route: 'IV' },
      { form: 'Injection 100mg vial', strength: '100mg', route: 'IM' },
      { form: 'Cream 1%', strength: '1%', route: 'topical' },
    ],
    dosage: {
      adult: { standard: '100-200mg IV q6-8h (acute); 10-30mg oral daily (replacement)', min: '10mg', max: '200mg', frequency: ['od', 'bd', 'tds', 'qds'] },
      pediatric: { standard: '1-5mg/kg IV (emergency)', min: '1mg/kg', max: '5mg/kg', frequency: ['q6h'] },
    },
    maxDailyDose: '600-800mg (acute); 30mg (replacement)',
    contraindications: ['Systemic fungal infections (systemic use)'],
    pregnancyCategory: 'C',
    pregnancyNotes: 'Largely inactivated by placental enzymes. Safer than dexamethasone for maternal conditions.',
    lactationSafety: 'safe',
    lactationNotes: 'Compatible with breastfeeding at physiological replacement doses.',
    renalRisk: 'monitor',
    hepaticRisk: 'monitor',
    cardiacRisk: 'caution',
    cardiacNotes: 'Sodium and fluid retention at pharmacological doses.',
    sideEffects: {
      common: ['Weight gain', 'Mood changes', 'Insomnia', 'Dyspepsia', 'Hyperglycaemia'],
      serious: ['Adrenal crisis on withdrawal', 'Infection risk', 'Osteoporosis', 'Cushing syndrome', 'Peptic ulcer'],
    },
    interactions: [
      { drug: 'NSAIDs', severity: 'moderate', effect: 'Increased GI bleeding risk' },
      { drug: 'Antidiabetics', severity: 'moderate', effect: 'May increase blood glucose' },
    ],
    precautions: ['Steroid sick-day rules for replacement therapy', 'Taper gradually after prolonged use'],
    instructions: 'For replacement: take largest dose in morning (to mimic cortisol rhythm). IV: can push slowly or infuse.',
    monitoringRequired: ['Blood glucose', 'Electrolytes (Na+, K+)', 'Blood pressure'],
  },
  {
    id: 'prednisolone',
    genericName: 'Prednisolone',
    brandNames: ['Deltacortril', 'Prelone'],
    category: 'Endocrine - Steroids',
    formulations: [
      { form: 'Tablet 5mg', strength: '5mg', route: 'oral' },
      { form: 'Tablet 25mg', strength: '25mg', route: 'oral' },
      { form: 'Soluble tablet 5mg', strength: '5mg', route: 'oral' },
    ],
    dosage: {
      adult: { standard: '5-60mg od', min: '5mg', max: '60mg', frequency: ['od', 'bd'], notes: 'Dose depends on condition. Give in morning.' },
    },
    maxDailyDose: '60mg (higher in some conditions)',
    contraindications: ['Systemic fungal infections'],
    pregnancyCategory: 'C',
    pregnancyNotes: 'Largely metabolized by placenta. Use if benefit outweighs risk.',
    lactationSafety: 'caution',
    lactationNotes: 'Small amounts in breast milk. Doses <20mg/day unlikely to affect infant.',
    renalRisk: 'monitor',
    hepaticRisk: 'monitor',
    cardiacRisk: 'caution',
    cardiacNotes: 'Fluid retention, hypertension.',
    sideEffects: {
      common: ['Weight gain', 'Moon face', 'Acne', 'Insomnia', 'Mood changes', 'Hyperglycaemia'],
      serious: ['Osteoporosis', 'Adrenal suppression', 'Peptic ulcer', 'Immunosuppression', 'Myopathy', 'Cataracts'],
    },
    interactions: [
      { drug: 'NSAIDs', severity: 'moderate', effect: 'Increased GI ulcer risk' },
      { drug: 'Antidiabetics', severity: 'moderate', effect: 'Increased blood glucose' },
      { drug: 'Rifampicin', severity: 'moderate', effect: 'Reduced prednisolone effect' },
    ],
    precautions: ['Take in morning with food', 'Do not stop abruptly if >3 weeks', 'Carry steroid card', 'Bone protection if long-term'],
    instructions: 'Take with food in the morning. Complete full course. Taper if used >3 weeks.',
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // WOUND CARE & DERMATOLOGY
  // ═══════════════════════════════════════════════════════════════════════════
  {
    id: 'silver_sulfadiazine',
    genericName: 'Silver Sulfadiazine 1% Cream',
    brandNames: ['Flamazine', 'Silvadene', 'Dermazin'],
    category: 'Wound Care',
    formulations: [
      { form: 'Cream 1% (50g tube)', strength: '1%', route: 'topical' },
      { form: 'Cream 1% (250g jar)', strength: '1%', route: 'topical' },
    ],
    dosage: {
      adult: { standard: 'Apply 3-5mm layer to affected area od-bd', min: 'Thin layer', max: '3-5mm layer', frequency: ['od', 'bd'] },
    },
    maxDailyDose: 'Topical - apply as needed',
    contraindications: ['Sulfonamide allergy', 'Pregnancy near term', 'Premature/neonates <2 months (kernicterus risk)', 'G6PD deficiency (relative)'],
    pregnancyCategory: 'C',
    pregnancyNotes: 'Avoid near term (sulfonamide - kernicterus risk to neonate). Use cautiously earlier in pregnancy.',
    lactationSafety: 'caution',
    lactationNotes: 'Avoid if infant is jaundiced, premature, or <2 months.',
    renalRisk: 'monitor',
    renalNotes: 'Monitor renal function if applied to large burns (systemic absorption).',
    hepaticRisk: 'monitor',
    cardiacRisk: 'safe',
    sideEffects: {
      common: ['Burning/stinging on application', 'Greying of skin (silver)', 'Leucocytosis (transient)'],
      serious: ['Leucopenia (reversible)', 'Kernicterus (neonates)', 'Interstitial nephritis', 'Crystalluria'],
    },
    interactions: [
      { drug: 'Enzymatic debriding agents', severity: 'moderate', effect: 'Silver may inactivate collagenase/papain debriders' },
    ],
    precautions: ['Check FBC if burns >20% TBSA', 'G6PD deficiency', 'Remove old cream before reapplication'],
    instructions: 'Clean wound before application. Apply with sterile glove or spatula. Cover with appropriate dressing.',
    monitoringRequired: ['FBC weekly if large area burns', 'Renal function if extensive application'],
  },
  {
    id: 'mupirocin',
    genericName: 'Mupirocin 2%',
    brandNames: ['Bactroban'],
    category: 'Wound Care',
    formulations: [
      { form: 'Ointment 2% (15g)', strength: '2%', route: 'topical' },
      { form: 'Cream 2% (15g)', strength: '2%', route: 'topical' },
      { form: 'Nasal ointment 2%', strength: '2%', route: 'topical' },
    ],
    dosage: {
      adult: { standard: 'Apply tds to affected area for 5-10 days', min: 'Small amount', max: 'Cover affected area', frequency: ['tds'] },
    },
    maxDailyDose: 'Topical application tds',
    contraindications: ['Known hypersensitivity', 'Do not use on large open wounds (polyethylene glycol absorption)'],
    pregnancyCategory: 'B',
    pregnancyNotes: 'Probably safe. Minimal systemic absorption.',
    lactationSafety: 'safe',
    renalRisk: 'monitor',
    renalNotes: 'Avoid ointment on large wounds if renal impairment (PEG base absorption).',
    hepaticRisk: 'safe',
    cardiacRisk: 'safe',
    sideEffects: {
      common: ['Burning/stinging/pruritus at application site'],
      serious: ['Secondary superinfection', 'C. difficile (rare, with extensive use)'],
    },
    interactions: [],
    precautions: ['Do not use for >10 days (resistance)', 'Do not apply to eyes', 'Ointment base contains PEG - avoid on large open wounds if renal impairment'],
    instructions: 'Apply to cleaned wound. Cover with dressing if appropriate. Complete full course.',
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // ANTIHISTAMINES
  // ═══════════════════════════════════════════════════════════════════════════
  {
    id: 'chlorpheniramine',
    genericName: 'Chlorpheniramine (Chlorphenamine)',
    brandNames: ['Piriton'],
    category: 'Antihistamines',
    formulations: [
      { form: 'Tablet 4mg', strength: '4mg', route: 'oral' },
      { form: 'Syrup 2mg/5ml', strength: '2mg/5ml', route: 'oral' },
      { form: 'Injection 10mg/ml', strength: '10mg', route: 'IV' },
      { form: 'Injection 10mg/ml', strength: '10mg', route: 'IM' },
    ],
    dosage: {
      adult: { standard: '4mg q4-6h oral / 10mg IV (emergency)', min: '4mg', max: '10mg', frequency: ['q4h', 'q6h', 'prn'] },
      pediatric: { standard: '1-2mg q4-6h (age 2-12)', min: '1mg', max: '2mg', frequency: ['q4h', 'q6h'] },
    },
    maxDailyDose: '24mg oral; 40mg parenteral',
    contraindications: ['Neonates', 'Premature infants'],
    pregnancyCategory: 'B',
    pregnancyNotes: 'Can be used in pregnancy. Preferred first-generation antihistamine if needed.',
    lactationSafety: 'caution',
    lactationNotes: 'Small amounts in breast milk. May cause drowsiness or irritability in infant.',
    renalRisk: 'safe',
    hepaticRisk: 'safe',
    cardiacRisk: 'safe',
    sideEffects: {
      common: ['Drowsiness', 'Dry mouth', 'Dizziness', 'Urinary retention', 'Blurred vision'],
      serious: ['Paradoxical excitation (children)', 'Arrhythmias (overdose)', 'Blood dyscrasias'],
    },
    interactions: [
      { drug: 'CNS depressants', severity: 'moderate', effect: 'Additive sedation' },
      { drug: 'Alcohol', severity: 'moderate', effect: 'Enhanced sedation' },
      { drug: 'Anticholinergics', severity: 'moderate', effect: 'Additive anticholinergic effects' },
    ],
    precautions: ['Drowsiness may impair driving', 'Caution in prostatic hypertrophy', 'Caution in narrow-angle glaucoma', 'Elderly more susceptible to side effects'],
    instructions: 'May cause drowsiness. Avoid driving or operating machinery.',
  },
  {
    id: 'cetirizine',
    genericName: 'Cetirizine',
    brandNames: ['Zyrtec'],
    category: 'Antihistamines',
    formulations: [
      { form: 'Tablet 10mg', strength: '10mg', route: 'oral' },
      { form: 'Syrup 1mg/ml', strength: '5mg/5ml', route: 'oral' },
    ],
    dosage: {
      adult: { standard: '10mg od', min: '5mg', max: '10mg', frequency: ['od'] },
      pediatric: { standard: '2.5-5mg od (ages 2-6); 5-10mg od (>6)', min: '2.5mg', max: '10mg', frequency: ['od'] },
      renalImpairment: { adjustment: 'GFR <30: 5mg od', gfrThreshold: '<30 ml/min' },
    },
    maxDailyDose: '10mg',
    contraindications: ['Known hypersensitivity', 'Severe renal impairment (relative)'],
    pregnancyCategory: 'B',
    pregnancyNotes: 'Preferred second-generation antihistamine in pregnancy.',
    lactationSafety: 'caution',
    lactationNotes: 'Excreted in breast milk. Probably safe at low doses.',
    renalRisk: 'dose_adjust',
    hepaticRisk: 'safe',
    cardiacRisk: 'safe',
    sideEffects: {
      common: ['Drowsiness (less than first-gen)', 'Headache', 'Dry mouth', 'Fatigue'],
      serious: ['Anaphylaxis (paradoxical, rare)'],
    },
    interactions: [
      { drug: 'CNS depressants', severity: 'minor', effect: 'Slight additive sedation' },
      { drug: 'Theophylline', severity: 'minor', effect: 'Slight reduction in cetirizine clearance' },
    ],
    precautions: ['Less sedating than first-generation but still possible', 'Renal dose adjustment needed'],
    instructions: 'Can be taken with or without food. Usually taken once daily.',
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // VITAMINS & SUPPLEMENTS
  // ═══════════════════════════════════════════════════════════════════════════
  {
    id: 'ascorbic_acid',
    genericName: 'Ascorbic Acid (Vitamin C)',
    brandNames: ['Redoxon', 'Cebion'],
    category: 'Vitamins & Supplements',
    formulations: [
      { form: 'Tablet 100mg', strength: '100mg', route: 'oral' },
      { form: 'Tablet 500mg', strength: '500mg', route: 'oral' },
      { form: 'Tablet 1000mg', strength: '1000mg', route: 'oral' },
      { form: 'Injection 100mg/ml (5ml)', strength: '500mg', route: 'IV' },
    ],
    dosage: {
      adult: { standard: '100-250mg od-bd (deficiency); 500-1000mg od (burn/wound healing)', min: '100mg', max: '1000mg', frequency: ['od', 'bd'] },
    },
    maxDailyDose: '2000mg',
    contraindications: ['Oxalate renal stones (high doses)', 'G6PD deficiency (high IV doses)'],
    pregnancyCategory: 'A',
    pregnancyNotes: 'Safe at recommended doses.',
    lactationSafety: 'safe',
    renalRisk: 'monitor',
    renalNotes: 'High doses may cause oxalate stones. Avoid >500mg/day if renal stones history.',
    hepaticRisk: 'safe',
    cardiacRisk: 'safe',
    sideEffects: {
      common: ['GI upset at high doses', 'Diarrhoea'],
      serious: ['Renal stones (high doses)', 'Haemolysis in G6PD deficiency (IV)'],
    },
    interactions: [
      { drug: 'Warfarin', severity: 'minor', effect: 'High doses may reduce INR' },
      { drug: 'Iron', severity: 'minor', effect: 'Enhances iron absorption (beneficial)' },
    ],
    precautions: ['Renal stone history', 'G6PD deficiency with high IV doses'],
    instructions: 'Important for wound healing. Take with or without food.',
  },
  {
    id: 'ferrous_sulfate',
    genericName: 'Ferrous Sulfate (Iron)',
    brandNames: ['Feospan', 'Ferrograd'],
    category: 'Vitamins & Supplements',
    formulations: [
      { form: 'Tablet 200mg (65mg elemental iron)', strength: '200mg', route: 'oral' },
      { form: 'Tablet 325mg (65mg elemental iron)', strength: '325mg', route: 'oral' },
      { form: 'Syrup 140mg/5ml', strength: '140mg/5ml', route: 'oral' },
    ],
    dosage: {
      adult: { standard: '200mg bd-tds (65mg elemental iron per tablet)', min: '200mg', max: '200mg', frequency: ['bd', 'tds'] },
      pediatric: { standard: '3-6mg/kg/day elemental iron in 2-3 divided doses', min: '3mg/kg/day', max: '6mg/kg/day', frequency: ['bd', 'tds'] },
    },
    maxDailyDose: '600mg (200mg elemental iron)',
    contraindications: ['Haemochromatosis', 'Haemosiderosis', 'Active GI diseases that worsen with iron'],
    pregnancyCategory: 'A',
    pregnancyNotes: 'Safe and often needed in pregnancy.',
    lactationSafety: 'safe',
    renalRisk: 'safe',
    hepaticRisk: 'monitor',
    hepaticNotes: 'Avoid in iron overload states.',
    cardiacRisk: 'safe',
    sideEffects: {
      common: ['Constipation', 'Nausea', 'Black stools', 'Abdominal pain', 'Diarrhoea'],
      serious: ['Iron overdose (especially in children)', 'GI ulceration'],
    },
    interactions: [
      { drug: 'Tetracyclines', severity: 'moderate', effect: 'Reduced absorption of both. Separate by 2-3 hours.' },
      { drug: 'Quinolones', severity: 'moderate', effect: 'Reduced quinolone absorption. Separate by 2 hours.' },
      { drug: 'Levothyroxine', severity: 'moderate', effect: 'Reduced levothyroxine absorption. Separate by 4 hours.' },
      { drug: 'Antacids/PPIs', severity: 'moderate', effect: 'Reduced iron absorption' },
    ],
    precautions: ['Take on empty stomach if tolerated (or with vit C for absorption)', 'Keep away from children (overdose risk)'],
    instructions: 'Best absorbed on empty stomach. Take with vitamin C to enhance absorption. Take 2h apart from other medications.',
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // FLUIDS & ELECTROLYTES
  // ═══════════════════════════════════════════════════════════════════════════
  {
    id: 'normal_saline',
    genericName: 'Sodium Chloride 0.9% (Normal Saline)',
    brandNames: ['Normal Saline', 'NS'],
    category: 'Fluids & Electrolytes',
    formulations: [
      { form: 'IV Infusion 500ml', strength: '0.9%', route: 'IV' },
      { form: 'IV Infusion 1000ml', strength: '0.9%', route: 'IV' },
    ],
    dosage: {
      adult: { standard: '500-1000ml over 1-4 hours', min: '500ml', max: '3000ml', frequency: ['prn'], notes: 'Resuscitation: bolus 500ml over 15 min. Maintenance: 25-30ml/kg/day.' },
    },
    maxDailyDose: 'Guided by clinical assessment',
    contraindications: ['Severe hypernatraemia', 'Fluid overload'],
    pregnancyCategory: 'A',
    pregnancyNotes: 'Safe.',
    lactationSafety: 'safe',
    renalRisk: 'monitor',
    renalNotes: 'Risk of fluid overload in renal failure. Monitor fluid balance.',
    hepaticRisk: 'monitor',
    hepaticNotes: 'May worsen ascites and oedema in liver disease.',
    cardiacRisk: 'monitor',
    cardiacNotes: 'Risk of fluid overload in heart failure. Monitor closely.',
    sideEffects: {
      common: ['Peripheral oedema', 'Hyperchloraemic metabolic acidosis (large volumes)'],
      serious: ['Fluid overload/pulmonary oedema', 'Hypernatraemia'],
    },
    interactions: [],
    precautions: ['Monitor fluid balance', 'Check electrolytes regularly', 'Caution in heart failure, renal failure, liver disease'],
    instructions: 'Infuse at prescribed rate. Monitor fluid balance chart. Warm if for resuscitation.',
    monitoringRequired: ['Fluid balance', 'Electrolytes (Na, K, Cl)', 'Clinical assessment for overload'],
  },
  {
    id: 'ringers_lactate',
    genericName: "Ringer's Lactate (Hartmann's Solution)",
    brandNames: ["Hartmann's", "Lactated Ringer's"],
    category: 'Fluids & Electrolytes',
    formulations: [
      { form: 'IV Infusion 500ml', strength: 'Compound', route: 'IV' },
      { form: 'IV Infusion 1000ml', strength: 'Compound', route: 'IV' },
    ],
    dosage: {
      adult: { standard: '500-1000ml over 1-4 hours', min: '500ml', max: '3000ml', frequency: ['prn'], notes: 'Preferred for burns resuscitation (Parkland formula).' },
    },
    maxDailyDose: 'Guided by clinical assessment',
    contraindications: ['Severe hepatic impairment (cannot metabolize lactate)', 'Hyperkalaemia'],
    pregnancyCategory: 'A',
    pregnancyNotes: 'Safe.',
    lactationSafety: 'safe',
    renalRisk: 'monitor',
    hepaticRisk: 'caution',
    hepaticNotes: 'Lactate may accumulate if liver cannot metabolize it.',
    cardiacRisk: 'monitor',
    sideEffects: {
      common: ['Peripheral oedema'],
      serious: ['Fluid overload', 'Hyperkalaemia'],
    },
    interactions: [
      { drug: 'Ceftriaxone', severity: 'major', effect: 'Do NOT mix in same line (calcium-ceftriaxone precipitation risk, especially in neonates)' },
    ],
    precautions: ['Contains potassium - caution in hyperkalaemia', 'Do not mix with blood products', 'Do not infuse with ceftriaxone'],
    instructions: 'Preferred fluid for burns (Parkland formula: 4ml x %TBSA x weight in first 24h). Half in first 8h.',
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // LOCAL ANAESTHETICS
  // ═══════════════════════════════════════════════════════════════════════════
  {
    id: 'lidocaine',
    genericName: 'Lidocaine (Lignocaine)',
    brandNames: ['Xylocaine'],
    category: 'Local Anaesthetics',
    formulations: [
      { form: 'Injection 1% (10mg/ml)', strength: '1%', route: 'SC' },
      { form: 'Injection 2% (20mg/ml)', strength: '2%', route: 'SC' },
      { form: 'Injection 1% with Adrenaline 1:200000', strength: '1%', route: 'SC' },
      { form: 'Injection 2% with Adrenaline 1:80000', strength: '2%', route: 'SC' },
      { form: 'Topical gel 2%', strength: '2%', route: 'topical' },
      { form: 'Spray 10%', strength: '10%', route: 'topical' },
    ],
    dosage: {
      adult: { standard: 'Infiltration: as needed', min: '1ml', max: 'Per max dose', frequency: ['stat'], notes: 'Max dose: 3mg/kg without adrenaline, 7mg/kg with adrenaline' },
    },
    maxDailyDose: '3mg/kg without adrenaline; 7mg/kg with adrenaline (max 500mg)',
    contraindications: ['Known hypersensitivity to amide local anaesthetics', 'Complete heart block', 'IV regional anaesthesia in areas with compromised vascularity'],
    pregnancyCategory: 'B',
    pregnancyNotes: 'Safe for local infiltration at recommended doses.',
    lactationSafety: 'safe',
    renalRisk: 'safe',
    hepaticRisk: 'dose_adjust',
    hepaticNotes: 'Metabolized by liver. Reduce dose in severe hepatic impairment.',
    cardiacRisk: 'caution',
    cardiacNotes: 'Systemic toxicity causes arrhythmias, cardiac arrest. Do NOT exceed max dose. Aspirate before injecting.',
    sideEffects: {
      common: ['Pain at injection', 'Numbness', 'Tingling'],
      serious: ['LAST (Local Anaesthetic Systemic Toxicity): seizures, arrhythmias, cardiac arrest', 'Methemoglobinaemia (rare)'],
    },
    interactions: [
      { drug: 'Beta-blockers', severity: 'moderate', effect: 'Increased lidocaine levels (reduced hepatic clearance)' },
      { drug: 'Cimetidine', severity: 'moderate', effect: 'Increased lidocaine levels' },
      { drug: 'Class I antiarrhythmics', severity: 'moderate', effect: 'Additive cardiac effects' },
    ],
    precautions: ['Calculate max dose before use', 'Aspirate before injection to avoid IV injection', 'Have lipid emulsion (Intralipid) available for LAST', 'Do NOT use adrenaline-containing formulations on end arteries (fingers, toes, penis, ear)'],
    instructions: 'Always calculate maximum dose. Aspirate before injecting. Inject slowly. Wait 5-10 min for full effect.',
    monitoringRequired: ['Patient consciousness', 'Signs of LAST (tinnitus, metallic taste, dizziness, seizures)'],
  },
  {
    id: 'bupivacaine',
    genericName: 'Bupivacaine',
    brandNames: ['Marcaine', 'Sensorcaine'],
    category: 'Local Anaesthetics',
    formulations: [
      { form: 'Injection 0.25%', strength: '0.25%', route: 'SC' },
      { form: 'Injection 0.5%', strength: '0.5%', route: 'SC' },
      { form: 'Injection 0.5% heavy (spinal)', strength: '0.5%', route: 'intrathecal' },
    ],
    dosage: {
      adult: { standard: 'Infiltration: as needed within max dose', min: '1ml', max: 'Per max dose', frequency: ['stat'], notes: 'Max dose: 2mg/kg without adrenaline; 2.5mg/kg with adrenaline' },
    },
    maxDailyDose: '2mg/kg without adrenaline (max 150mg); 2.5mg/kg with adrenaline',
    contraindications: ['Known hypersensitivity', 'IV regional anaesthesia (Bier block) - NEVER', 'Paracervical block in obstetrics'],
    pregnancyCategory: 'C',
    pregnancyNotes: 'Safe for epidural/spinal anaesthesia in labour.',
    lactationSafety: 'safe',
    renalRisk: 'safe',
    hepaticRisk: 'dose_adjust',
    cardiacRisk: 'caution',
    cardiacNotes: 'More cardiotoxic than lidocaine. LAST can be more resistant to resuscitation.',
    sideEffects: {
      common: ['Numbness (prolonged, expected)', 'Hypotension (spinal/epidural)'],
      serious: ['LAST (more cardiotoxic than lidocaine)', 'Cardiac arrest', 'High/total spinal block'],
    },
    interactions: [
      { drug: 'Other local anaesthetics', severity: 'major', effect: 'Additive toxicity. Total dose of ALL agents must not exceed safe limits.' },
    ],
    precautions: ['NEVER use for IV regional anaesthesia', 'More cardiotoxic than lidocaine', 'Have Intralipid available', 'Long duration of action (4-8 hours)'],
    instructions: 'Calculate max dose carefully. Longer acting than lidocaine (4-8 hours). Never use for Bier block.',
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // MUSCLE RELAXANTS
  // ═══════════════════════════════════════════════════════════════════════════
  {
    id: 'diazepam',
    genericName: 'Diazepam',
    brandNames: ['Valium'],
    category: 'CNS - Anxiolytics & Sedatives',
    formulations: [
      { form: 'Tablet 2mg', strength: '2mg', route: 'oral' },
      { form: 'Tablet 5mg', strength: '5mg', route: 'oral' },
      { form: 'Tablet 10mg', strength: '10mg', route: 'oral' },
      { form: 'Injection 5mg/ml (2ml)', strength: '10mg', route: 'IV' },
      { form: 'Injection 5mg/ml (2ml)', strength: '10mg', route: 'IM' },
      { form: 'Rectal solution 5mg/2.5ml', strength: '5mg', route: 'rectal' },
    ],
    dosage: {
      adult: { standard: '2-10mg oral; 5-10mg IV', min: '2mg', max: '10mg', frequency: ['bd', 'tds', 'prn'], notes: 'Seizure: 10-20mg IV at 2mg/min. Anxiolysis: 2-5mg tds.' },
      pediatric: { standard: '0.2-0.5mg/kg (seizure)', min: '0.1mg/kg', max: '0.5mg/kg', frequency: ['prn'] },
      elderly: { standard: '1-2mg', min: '1mg', max: '5mg', frequency: ['od', 'bd'], notes: 'Start very low. Increased sensitivity.' },
      hepaticImpairment: { adjustment: 'Reduce dose significantly. Very prolonged half-life in liver disease.' },
    },
    maxDailyDose: '30mg (lower in elderly/hepatic disease)',
    contraindications: ['Severe respiratory depression', 'Sleep apnoea', 'Acute pulmonary insufficiency', 'Myasthenia gravis', 'Acute narrow-angle glaucoma'],
    pregnancyCategory: 'D',
    pregnancyNotes: 'Avoid in pregnancy. Risk of cleft palate (1st trimester), floppy infant syndrome (near term), neonatal withdrawal.',
    lactationSafety: 'avoid',
    lactationNotes: 'Excreted in breast milk. May cause sedation in infant. Avoid repeated doses.',
    renalRisk: 'safe',
    hepaticRisk: 'dose_adjust',
    hepaticNotes: 'Greatly prolonged half-life in liver disease. Avoid or use very low doses.',
    cardiacRisk: 'caution',
    cardiacNotes: 'May cause hypotension, especially IV. Give slowly.',
    sideEffects: {
      common: ['Drowsiness', 'Confusion', 'Ataxia', 'Amnesia', 'Muscle weakness'],
      serious: ['Respiratory depression', 'Paradoxical anger/aggression', 'Dependence', 'Profound sedation'],
    },
    interactions: [
      { drug: 'Opioids', severity: 'major', effect: 'Additive respiratory depression. Potentially fatal.' },
      { drug: 'Alcohol', severity: 'major', effect: 'Increased CNS depression' },
      { drug: 'Other sedatives', severity: 'major', effect: 'Additive sedation' },
      { drug: 'Cimetidine', severity: 'moderate', effect: 'Increased diazepam levels' },
    ],
    precautions: ['Risk of dependence with prolonged use', 'IV: give slowly at max 2mg/min', 'Have flumazenil available for reversal', 'Avoid abrupt withdrawal'],
    instructions: 'May impair driving/operating machinery. Avoid alcohol. Do not stop abruptly after prolonged use.',
    monitoringRequired: ['Respiratory rate', 'Sedation level', 'Signs of dependence if prolonged use'],
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // ANTIFUNGALS
  // ═══════════════════════════════════════════════════════════════════════════
  {
    id: 'fluconazole',
    genericName: 'Fluconazole',
    brandNames: ['Diflucan'],
    category: 'Antifungals',
    formulations: [
      { form: 'Capsule 50mg', strength: '50mg', route: 'oral' },
      { form: 'Capsule 150mg', strength: '150mg', route: 'oral' },
      { form: 'Capsule 200mg', strength: '200mg', route: 'oral' },
      { form: 'Infusion 200mg/100ml', strength: '200mg', route: 'IV' },
    ],
    dosage: {
      adult: { standard: '50-400mg od', min: '50mg', max: '400mg', frequency: ['od'], notes: 'Vaginal candidiasis: 150mg stat. Systemic: 200-400mg od.' },
      renalImpairment: { adjustment: 'GFR <50: give 50% of dose. Loading dose unchanged.', gfrThreshold: '<50 ml/min' },
    },
    maxDailyDose: '800mg (cryptococcal meningitis)',
    contraindications: ['Known hypersensitivity', 'Concurrent terfenadine at high fluconazole doses'],
    pregnancyCategory: 'D',
    pregnancyNotes: 'AVOID high/prolonged doses in pregnancy (craniofacial abnormalities). Single 150mg dose for vaginal candidiasis controversial but often used.',
    lactationSafety: 'safe',
    lactationNotes: 'Excreted in breast milk at similar levels to plasma. Single doses probably safe.',
    renalRisk: 'dose_adjust',
    renalNotes: 'Renally excreted. Reduce dose if GFR <50.',
    hepaticRisk: 'monitor',
    hepaticNotes: 'Hepatotoxicity may occur. Monitor LFTs.',
    cardiacRisk: 'caution',
    cardiacNotes: 'QT prolongation risk at high doses.',
    sideEffects: {
      common: ['Nausea', 'Headache', 'Abdominal pain', 'Diarrhoea'],
      serious: ['Hepatotoxicity', 'QT prolongation', 'Stevens-Johnson syndrome', 'Anaphylaxis'],
    },
    interactions: [
      { drug: 'Warfarin', severity: 'major', effect: 'Significantly increased INR. Monitor closely.' },
      { drug: 'Phenytoin', severity: 'major', effect: 'Increased phenytoin levels' },
      { drug: 'Cyclosporin', severity: 'major', effect: 'Increased cyclosporin levels' },
      { drug: 'Statins', severity: 'major', effect: 'Increased statin levels, rhabdomyolysis risk' },
      { drug: 'Oral hypoglycaemics', severity: 'moderate', effect: 'Increased hypoglycaemia risk' },
    ],
    precautions: ['CYP2C9/CYP3A4 inhibitor - many drug interactions', 'Monitor LFTs', 'QT interval concerns at high doses'],
    instructions: 'Can be taken with or without food.',
    monitoringRequired: ['LFTs (especially with prolonged therapy)', 'INR if on warfarin'],
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // TETANUS
  // ═══════════════════════════════════════════════════════════════════════════
  {
    id: 'tetanus_toxoid',
    genericName: 'Tetanus Toxoid (TT)',
    brandNames: ['TT Vaccine'],
    category: 'Vitamins & Supplements',
    subcategory: 'Vaccines',
    formulations: [
      { form: 'Injection 0.5ml', strength: '0.5ml', route: 'IM' },
    ],
    dosage: {
      adult: { standard: '0.5ml IM', min: '0.5ml', max: '0.5ml', frequency: ['stat'], notes: 'Booster every 10 years. Wound prophylaxis if >5 years since last dose.' },
    },
    maxDailyDose: '0.5ml',
    contraindications: ['Severe reaction to previous tetanus vaccine'],
    pregnancyCategory: 'A',
    pregnancyNotes: 'Safe in pregnancy. Recommended to prevent neonatal tetanus.',
    lactationSafety: 'safe',
    renalRisk: 'safe',
    hepaticRisk: 'safe',
    cardiacRisk: 'safe',
    sideEffects: {
      common: ['Injection site pain/swelling', 'Mild fever'],
      serious: ['Anaphylaxis (very rare)', 'Neuropathy (very rare)'],
    },
    interactions: [],
    precautions: ['Ensure proper cold chain storage', 'IM injection into deltoid muscle'],
    instructions: 'IM injection into deltoid. Record date for future booster scheduling.',
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // CARDIOVASCULAR - ANTIPLATELETS & THROMBOLYTICS
  // ═══════════════════════════════════════════════════════════════════════════
  {
    id: 'aspirin_antiplatelet',
    genericName: 'Aspirin (Acetylsalicylic Acid)',
    brandNames: ['Disprin', 'Aspro', 'Ecosprin'],
    category: 'Antiplatelets & Thrombolytics',
    formulations: [
      { form: 'Tablet 75mg', strength: '75mg', route: 'oral' },
      { form: 'Tablet 300mg', strength: '300mg', route: 'oral' },
      { form: 'Dispersible Tablet 300mg', strength: '300mg', route: 'oral' },
    ],
    dosage: { adult: { standard: '75-300mg', min: '75mg', max: '300mg', frequency: ['od'], duration: 'Long-term' } },
    maxDailyDose: '300mg',
    contraindications: ['Active peptic ulcer', 'Haemophilia', 'Children <16yrs (Reye syndrome)'],
    pregnancyCategory: 'D',
    lactationSafety: 'caution',
    renalRisk: 'dose_adjust',
    hepaticRisk: 'caution' as any,
    cardiacRisk: 'safe',
    sideEffects: { common: ['GI irritation', 'Dyspepsia', 'Increased bleeding time'], serious: ['GI haemorrhage', 'Bronchospasm', 'Reye syndrome in children'] },
    interactions: [{ drug: 'Warfarin', severity: 'major', effect: 'Increased bleeding risk' }, { drug: 'Ibuprofen', severity: 'moderate', effect: 'Reduced antiplatelet effect' }],
    precautions: ['Take with food', 'Avoid in asthma if aspirin-sensitive'],
    instructions: 'Take with or after food. Do not crush enteric-coated tablets.',
  },
  {
    id: 'clopidogrel',
    genericName: 'Clopidogrel',
    brandNames: ['Plavix', 'Clopilet'],
    category: 'Antiplatelets & Thrombolytics',
    formulations: [{ form: 'Tablet 75mg', strength: '75mg', route: 'oral' }],
    dosage: { adult: { standard: '75mg', min: '75mg', max: '300mg', frequency: ['od'] } },
    maxDailyDose: '300mg (loading)',
    contraindications: ['Active bleeding', 'Severe hepatic impairment'],
    pregnancyCategory: 'B',
    lactationSafety: 'avoid',
    renalRisk: 'safe',
    hepaticRisk: 'avoid',
    cardiacRisk: 'safe',
    sideEffects: { common: ['Bleeding', 'Bruising', 'Dyspepsia'], serious: ['TTP', 'Severe haemorrhage', 'Neutropenia'] },
    interactions: [{ drug: 'Omeprazole', severity: 'moderate', effect: 'Reduced clopidogrel efficacy' }, { drug: 'Warfarin', severity: 'major', effect: 'Increased bleeding risk' }],
    precautions: ['Stop 7 days before surgery', 'Monitor for bleeding'],
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // CARDIOVASCULAR - LIPID-LOWERING
  // ═══════════════════════════════════════════════════════════════════════════
  {
    id: 'atorvastatin',
    genericName: 'Atorvastatin',
    brandNames: ['Lipitor', 'Atorva'],
    category: 'Cardiovascular - Lipid-lowering',
    formulations: [{ form: 'Tablet 10mg', strength: '10mg', route: 'oral' }, { form: 'Tablet 20mg', strength: '20mg', route: 'oral' }, { form: 'Tablet 40mg', strength: '40mg', route: 'oral' }],
    dosage: { adult: { standard: '20mg', min: '10mg', max: '80mg', frequency: ['od', 'nocte'] } },
    maxDailyDose: '80mg',
    contraindications: ['Active liver disease', 'Pregnancy', 'Breastfeeding'],
    pregnancyCategory: 'X',
    lactationSafety: 'avoid',
    renalRisk: 'safe',
    hepaticRisk: 'avoid',
    cardiacRisk: 'safe',
    sideEffects: { common: ['Myalgia', 'Headache', 'GI disturbance'], serious: ['Rhabdomyolysis', 'Hepatotoxicity', 'Myopathy'] },
    interactions: [{ drug: 'Erythromycin', severity: 'major', effect: 'Increased risk of rhabdomyolysis' }, { drug: 'Warfarin', severity: 'moderate', effect: 'Increased anticoagulant effect' }],
    precautions: ['Monitor LFTs', 'Report unexplained muscle pain'],
    monitoringRequired: ['LFTs at baseline and periodically', 'CK if muscle symptoms'],
    instructions: 'Take at night. Report unexplained muscle pain immediately.',
  },
  {
    id: 'simvastatin',
    genericName: 'Simvastatin',
    brandNames: ['Zocor', 'Simvacor'],
    category: 'Cardiovascular - Lipid-lowering',
    formulations: [{ form: 'Tablet 20mg', strength: '20mg', route: 'oral' }, { form: 'Tablet 40mg', strength: '40mg', route: 'oral' }],
    dosage: { adult: { standard: '20-40mg', min: '10mg', max: '80mg', frequency: ['nocte'] } },
    maxDailyDose: '80mg',
    contraindications: ['Active liver disease', 'Pregnancy'],
    pregnancyCategory: 'X',
    lactationSafety: 'avoid',
    renalRisk: 'safe',
    hepaticRisk: 'avoid',
    cardiacRisk: 'safe',
    sideEffects: { common: ['Myalgia', 'Constipation', 'Abdominal pain'], serious: ['Rhabdomyolysis', 'Hepatotoxicity'] },
    interactions: [{ drug: 'Amlodipine', severity: 'moderate', effect: 'Max simvastatin 20mg with amlodipine' }],
    precautions: ['Take in the evening', 'Monitor LFTs'],
    instructions: 'Take in the evening for best effect.',
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // CARDIOVASCULAR - MORE ANTIHYPERTENSIVES
  // ═══════════════════════════════════════════════════════════════════════════
  {
    id: 'nifedipine',
    genericName: 'Nifedipine',
    brandNames: ['Adalat', 'Procardia'],
    category: 'Cardiovascular - Antihypertensives',
    formulations: [{ form: 'Tablet 10mg', strength: '10mg', route: 'oral' }, { form: 'SR Tablet 20mg', strength: '20mg', route: 'oral' }, { form: 'SR Tablet 30mg', strength: '30mg', route: 'oral' }],
    dosage: { adult: { standard: '10-20mg', min: '5mg', max: '90mg', frequency: ['bd', 'tds'] } },
    maxDailyDose: '90mg',
    contraindications: ['Cardiogenic shock', 'Acute MI', 'Unstable angina'],
    pregnancyCategory: 'C',
    lactationSafety: 'caution',
    renalRisk: 'safe',
    hepaticRisk: 'dose_adjust',
    cardiacRisk: 'caution',
    sideEffects: { common: ['Headache', 'Flushing', 'Ankle oedema', 'Dizziness'], serious: ['Severe hypotension', 'Reflex tachycardia'] },
    interactions: [{ drug: 'Beta-blockers', severity: 'moderate', effect: 'Enhanced hypotensive effect' }],
    precautions: ['Use SR formulation for hypertension', 'Avoid sublingual for hypertensive emergencies'],
  },
  {
    id: 'losartan',
    genericName: 'Losartan Potassium',
    brandNames: ['Cozaar', 'Losartan'],
    category: 'Cardiovascular - Antihypertensives',
    formulations: [{ form: 'Tablet 25mg', strength: '25mg', route: 'oral' }, { form: 'Tablet 50mg', strength: '50mg', route: 'oral' }, { form: 'Tablet 100mg', strength: '100mg', route: 'oral' }],
    dosage: { adult: { standard: '50mg', min: '25mg', max: '100mg', frequency: ['od'] } },
    maxDailyDose: '100mg',
    contraindications: ['Pregnancy', 'Bilateral renal artery stenosis', 'Hyperkalaemia'],
    pregnancyCategory: 'D',
    lactationSafety: 'avoid',
    renalRisk: 'monitor',
    hepaticRisk: 'dose_adjust',
    cardiacRisk: 'safe',
    sideEffects: { common: ['Dizziness', 'Hypotension', 'Hyperkalaemia'], serious: ['Angioedema', 'Acute renal failure'] },
    interactions: [{ drug: 'Potassium supplements', severity: 'major', effect: 'Risk of hyperkalaemia' }, { drug: 'NSAIDs', severity: 'moderate', effect: 'Reduced antihypertensive effect' }],
    precautions: ['Monitor renal function and potassium', 'Avoid in pregnancy'],
    monitoringRequired: ['U&E', 'Renal function'],
  },
  {
    id: 'propranolol',
    genericName: 'Propranolol Hydrochloride',
    brandNames: ['Inderal', 'Propranolol'],
    category: 'Cardiovascular - Antihypertensives',
    formulations: [{ form: 'Tablet 10mg', strength: '10mg', route: 'oral' }, { form: 'Tablet 40mg', strength: '40mg', route: 'oral' }, { form: 'Injection 1mg/mL', strength: '1mg/mL', route: 'IV' }],
    dosage: { adult: { standard: '40mg', min: '10mg', max: '320mg', frequency: ['bd', 'tds'] } },
    maxDailyDose: '320mg',
    contraindications: ['Asthma', 'Uncontrolled heart failure', 'Prinzmetal angina', 'Severe bradycardia'],
    pregnancyCategory: 'C',
    lactationSafety: 'caution',
    renalRisk: 'safe',
    hepaticRisk: 'dose_adjust',
    cardiacRisk: 'caution',
    sideEffects: { common: ['Bradycardia', 'Cold extremities', 'Fatigue', 'Dizziness'], serious: ['Bronchospasm', 'Heart block', 'Severe hypotension'] },
    interactions: [{ drug: 'Verapamil', severity: 'major', effect: 'Risk of asystole' }, { drug: 'Insulin', severity: 'moderate', effect: 'Masks hypoglycaemia symptoms' }],
    precautions: ['Do not stop abruptly', 'Contraindicated in asthma'],
  },
  {
    id: 'methyldopa',
    genericName: 'Methyldopa',
    brandNames: ['Aldomet'],
    category: 'Cardiovascular - Antihypertensives',
    formulations: [{ form: 'Tablet 250mg', strength: '250mg', route: 'oral' }, { form: 'Tablet 500mg', strength: '500mg', route: 'oral' }],
    dosage: { adult: { standard: '250mg', min: '250mg', max: '3g', frequency: ['bd', 'tds'] } },
    maxDailyDose: '3g',
    contraindications: ['Active liver disease', 'Phaeochromocytoma', 'Depression'],
    pregnancyCategory: 'B',
    pregnancyNotes: 'Drug of choice for hypertension in pregnancy',
    lactationSafety: 'safe',
    renalRisk: 'dose_adjust',
    hepaticRisk: 'avoid',
    cardiacRisk: 'safe',
    sideEffects: { common: ['Drowsiness', 'Dry mouth', 'Headache'], serious: ['Hepatotoxicity', 'Haemolytic anaemia', 'Lupus-like syndrome'] },
    interactions: [{ drug: 'Iron', severity: 'moderate', effect: 'Reduced methyldopa absorption' }],
    precautions: ['Monitor LFTs and FBC', 'Safe in pregnancy'],
    monitoringRequired: ['LFTs', 'FBC', 'Coombs test'],
  },
  {
    id: 'hydralazine',
    genericName: 'Hydralazine Hydrochloride',
    brandNames: ['Apresoline'],
    category: 'Cardiovascular - Antihypertensives',
    formulations: [{ form: 'Tablet 25mg', strength: '25mg', route: 'oral' }, { form: 'Injection 20mg', strength: '20mg', route: 'IV' }],
    dosage: { adult: { standard: '25-50mg', min: '25mg', max: '200mg', frequency: ['bd', 'tds'] } },
    maxDailyDose: '200mg',
    contraindications: ['SLE', 'Severe tachycardia', 'Cor pulmonale'],
    pregnancyCategory: 'C',
    lactationSafety: 'caution',
    renalRisk: 'dose_adjust',
    hepaticRisk: 'caution' as any,
    cardiacRisk: 'caution',
    sideEffects: { common: ['Tachycardia', 'Palpitations', 'Flushing', 'Headache'], serious: ['SLE-like syndrome', 'Severe hypotension'] },
    interactions: [{ drug: 'NSAIDs', severity: 'moderate', effect: 'Antagonism of hypotensive effect' }],
    precautions: ['Monitor for lupus-like syndrome with long-term use'],
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // CARDIOVASCULAR - DIURETICS
  // ═══════════════════════════════════════════════════════════════════════════
  {
    id: 'spironolactone',
    genericName: 'Spironolactone',
    brandNames: ['Aldactone'],
    category: 'Cardiovascular - Diuretics',
    formulations: [{ form: 'Tablet 25mg', strength: '25mg', route: 'oral' }, { form: 'Tablet 100mg', strength: '100mg', route: 'oral' }],
    dosage: { adult: { standard: '25-100mg', min: '25mg', max: '400mg', frequency: ['od', 'bd'] } },
    maxDailyDose: '400mg',
    contraindications: ['Hyperkalaemia', 'Addison disease', 'Severe renal impairment'],
    pregnancyCategory: 'D',
    lactationSafety: 'caution',
    renalRisk: 'avoid',
    hepaticRisk: 'caution' as any,
    cardiacRisk: 'safe',
    sideEffects: { common: ['Hyperkalaemia', 'GI disturbance', 'Gynaecomastia'], serious: ['Severe hyperkalaemia', 'Agranulocytosis'] },
    interactions: [{ drug: 'ACE inhibitors', severity: 'major', effect: 'Risk of severe hyperkalaemia' }, { drug: 'Potassium supplements', severity: 'major', effect: 'Hyperkalaemia' }],
    precautions: ['Monitor potassium closely', 'Avoid potassium supplements'],
    monitoringRequired: ['Serum potassium', 'Renal function'],
  },
  {
    id: 'hydrochlorothiazide',
    genericName: 'Hydrochlorothiazide',
    brandNames: ['Esidrex', 'HCT'],
    category: 'Cardiovascular - Diuretics',
    formulations: [{ form: 'Tablet 12.5mg', strength: '12.5mg', route: 'oral' }, { form: 'Tablet 25mg', strength: '25mg', route: 'oral' }],
    dosage: { adult: { standard: '12.5-25mg', min: '12.5mg', max: '50mg', frequency: ['od'] } },
    maxDailyDose: '50mg',
    contraindications: ['Severe renal impairment', 'Hypokalaemia', 'Addison disease'],
    pregnancyCategory: 'D',
    lactationSafety: 'caution',
    renalRisk: 'dose_adjust',
    hepaticRisk: 'caution' as any,
    cardiacRisk: 'safe',
    sideEffects: { common: ['Hypokalaemia', 'Hyponatraemia', 'Hyperuricaemia', 'Dizziness'], serious: ['Severe electrolyte imbalance', 'Pancreatitis'] },
    interactions: [{ drug: 'Lithium', severity: 'major', effect: 'Increased lithium levels' }, { drug: 'Digoxin', severity: 'moderate', effect: 'Hypokalaemia increases digoxin toxicity' }],
    precautions: ['Monitor electrolytes', 'May worsen diabetes and gout'],
    monitoringRequired: ['U&E', 'Uric acid', 'Blood glucose'],
  },
  {
    id: 'mannitol',
    genericName: 'Mannitol',
    brandNames: ['Osmitrol'],
    category: 'Cardiovascular - Diuretics',
    formulations: [{ form: 'IV Solution 20%', strength: '20%', route: 'IV' }],
    dosage: { adult: { standard: '0.25-2g/kg', min: '0.25g/kg', max: '2g/kg', frequency: ['q6h', 'q8h'] } },
    maxDailyDose: '200g',
    contraindications: ['Severe renal failure (anuria)', 'Severe pulmonary oedema', 'Active intracranial bleeding'],
    pregnancyCategory: 'C',
    lactationSafety: 'caution',
    renalRisk: 'avoid',
    hepaticRisk: 'safe',
    cardiacRisk: 'caution',
    sideEffects: { common: ['Headache', 'Nausea', 'Fluid & electrolyte imbalance'], serious: ['Pulmonary oedema', 'Renal failure', 'Severe dehydration'] },
    interactions: [],
    precautions: ['Infuse through in-line filter', 'Monitor serum osmolality and electrolytes'],
    monitoringRequired: ['Serum osmolality', 'U&E', 'Urine output'],
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // CARDIOVASCULAR - NITRATES & ANTIANGINALS
  // ═══════════════════════════════════════════════════════════════════════════
  {
    id: 'glyceryl_trinitrate',
    genericName: 'Glyceryl Trinitrate (GTN)',
    brandNames: ['Nitrostat', 'Nitrolingual'],
    category: 'Cardiovascular - Nitrates & Antianginals',
    formulations: [{ form: 'Sublingual Tablet 0.5mg', strength: '0.5mg', route: 'sublingual' }, { form: 'Spray 400mcg/dose', strength: '400mcg', route: 'sublingual' }, { form: 'IV Infusion 1mg/mL', strength: '1mg/mL', route: 'IV' }],
    dosage: { adult: { standard: '0.3-0.6mg sublingual', min: '0.3mg', max: '1.2mg', frequency: ['prn', 'stat'] } },
    maxDailyDose: 'No fixed max for sublingual PRN',
    contraindications: ['Hypotension', 'Hypovolaemia', 'Sildenafil use within 24hrs'],
    pregnancyCategory: 'C',
    lactationSafety: 'unknown',
    renalRisk: 'safe',
    hepaticRisk: 'safe',
    cardiacRisk: 'caution',
    sideEffects: { common: ['Headache', 'Flushing', 'Dizziness', 'Postural hypotension'], serious: ['Severe hypotension', 'Syncope'] },
    interactions: [{ drug: 'Sildenafil', severity: 'major', effect: 'Severe hypotension - CONTRAINDICATED' }],
    precautions: ['Patient should sit or lie down before taking', 'Store sublingual tablets in original container'],
    instructions: 'Place under tongue. Sit or lie down. May repeat after 5 minutes. Seek help if chest pain persists after 3 doses.',
  },
  {
    id: 'isosorbide_dinitrate',
    genericName: 'Isosorbide Dinitrate',
    brandNames: ['Isordil', 'Isoket'],
    category: 'Cardiovascular - Nitrates & Antianginals',
    formulations: [{ form: 'Tablet 10mg', strength: '10mg', route: 'oral' }, { form: 'Tablet 20mg', strength: '20mg', route: 'oral' }],
    dosage: { adult: { standard: '10-40mg', min: '10mg', max: '160mg', frequency: ['bd', 'tds'] } },
    maxDailyDose: '160mg',
    contraindications: ['Hypotension', 'Hypovolaemia', 'PDE5 inhibitor use'],
    pregnancyCategory: 'C',
    lactationSafety: 'unknown',
    renalRisk: 'safe',
    hepaticRisk: 'safe',
    cardiacRisk: 'caution',
    sideEffects: { common: ['Headache', 'Flushing', 'Dizziness'], serious: ['Severe hypotension'] },
    interactions: [{ drug: 'Sildenafil', severity: 'major', effect: 'Severe hypotension' }],
    precautions: ['Allow nitrate-free interval to prevent tolerance'],
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // CARDIOVASCULAR - ANTIARRHYTHMICS & OTHERS
  // ═══════════════════════════════════════════════════════════════════════════
  {
    id: 'digoxin',
    genericName: 'Digoxin',
    brandNames: ['Lanoxin'],
    category: 'Cardiovascular - Antiarrhythmics',
    formulations: [{ form: 'Tablet 0.0625mg', strength: '62.5mcg', route: 'oral' }, { form: 'Tablet 0.25mg', strength: '250mcg', route: 'oral' }, { form: 'Injection 0.5mg/2mL', strength: '0.25mg/mL', route: 'IV' }],
    dosage: { adult: { standard: '125-250mcg', min: '62.5mcg', max: '500mcg', frequency: ['od'] } },
    maxDailyDose: '500mcg',
    contraindications: ['Hypertrophic cardiomyopathy', 'Ventricular tachycardia', 'AV block'],
    pregnancyCategory: 'C',
    lactationSafety: 'safe',
    renalRisk: 'dose_adjust',
    hepaticRisk: 'safe',
    cardiacRisk: 'monitor',
    sideEffects: { common: ['Nausea', 'Anorexia', 'Visual disturbance'], serious: ['Arrhythmias', 'Heart block', 'Toxicity'] },
    interactions: [{ drug: 'Amiodarone', severity: 'major', effect: 'Halve digoxin dose' }, { drug: 'Verapamil', severity: 'major', effect: 'Increased digoxin levels' }],
    precautions: ['Monitor serum digoxin levels', 'Hypokalaemia increases toxicity'],
    monitoringRequired: ['Serum digoxin level', 'U&E', 'Renal function'],
  },
  {
    id: 'amiodarone',
    genericName: 'Amiodarone Hydrochloride',
    brandNames: ['Cordarone', 'Amiodar'],
    category: 'Cardiovascular - Antiarrhythmics',
    formulations: [{ form: 'Tablet 200mg', strength: '200mg', route: 'oral' }, { form: 'Injection 150mg/3mL', strength: '50mg/mL', route: 'IV' }],
    dosage: { adult: { standard: '200mg loading then 200mg maintenance', min: '100mg', max: '400mg', frequency: ['od', 'tds'], duration: 'Loading: 200mg TDS x 1 week, then 200mg BD x 1 week, then 200mg OD' } },
    maxDailyDose: '600mg (loading)',
    contraindications: ['Thyroid dysfunction', 'Severe sinus node disease', 'AV block'],
    pregnancyCategory: 'D',
    lactationSafety: 'avoid',
    renalRisk: 'safe',
    hepaticRisk: 'monitor',
    cardiacRisk: 'monitor',
    sideEffects: { common: ['Photosensitivity', 'Corneal microdeposits', 'Nausea'], serious: ['Pulmonary fibrosis', 'Thyroid dysfunction', 'Hepatotoxicity', 'Peripheral neuropathy'] },
    interactions: [{ drug: 'Digoxin', severity: 'major', effect: 'Halve digoxin dose' }, { drug: 'Warfarin', severity: 'major', effect: 'Increased INR - halve warfarin dose' }],
    precautions: ['Wear sunscreen', 'Monitor thyroid, liver, lung function'],
    monitoringRequired: ['TFTs 6-monthly', 'LFTs', 'CXR', 'Eye exam annually'],
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // CNS - ANTIEPILEPTICS
  // ═══════════════════════════════════════════════════════════════════════════
  {
    id: 'phenytoin',
    genericName: 'Phenytoin Sodium',
    brandNames: ['Dilantin', 'Epanutin'],
    category: 'CNS - Antiepileptics',
    formulations: [{ form: 'Capsule 100mg', strength: '100mg', route: 'oral' }, { form: 'Injection 50mg/mL', strength: '50mg/mL', route: 'IV' }],
    dosage: { adult: { standard: '200-300mg', min: '200mg', max: '600mg', frequency: ['od', 'bd'] } },
    maxDailyDose: '600mg',
    contraindications: ['Sinus bradycardia', 'SA/AV block', 'Acute porphyria'],
    pregnancyCategory: 'D',
    lactationSafety: 'caution',
    renalRisk: 'safe',
    hepaticRisk: 'dose_adjust',
    cardiacRisk: 'caution',
    sideEffects: { common: ['Gum hypertrophy', 'Hirsutism', 'Acne', 'Nystagmus'], serious: ['SJS/TEN', 'Blood dyscrasias', 'Cerebellar atrophy'] },
    interactions: [{ drug: 'Warfarin', severity: 'major', effect: 'Altered anticoagulant effect' }, { drug: 'Oral contraceptives', severity: 'major', effect: 'Reduced contraceptive efficacy' }],
    precautions: ['Monitor serum levels', 'IV infusion rate max 50mg/min'],
    monitoringRequired: ['Serum phenytoin levels', 'FBC', 'LFTs'],
  },
  {
    id: 'carbamazepine',
    genericName: 'Carbamazepine',
    brandNames: ['Tegretol'],
    category: 'CNS - Antiepileptics',
    formulations: [{ form: 'Tablet 200mg', strength: '200mg', route: 'oral' }, { form: 'CR Tablet 400mg', strength: '400mg', route: 'oral' }],
    dosage: { adult: { standard: '200mg', min: '100mg', max: '1.6g', frequency: ['bd', 'tds'] } },
    maxDailyDose: '1.6g',
    contraindications: ['AV block', 'Bone marrow depression', 'Acute porphyria'],
    pregnancyCategory: 'D',
    lactationSafety: 'caution',
    renalRisk: 'safe',
    hepaticRisk: 'monitor',
    cardiacRisk: 'caution',
    sideEffects: { common: ['Drowsiness', 'Dizziness', 'Diplopia', 'Nausea'], serious: ['SJS/TEN', 'Aplastic anaemia', 'Hepatotoxicity', 'SIADH'] },
    interactions: [{ drug: 'Oral contraceptives', severity: 'major', effect: 'Reduced efficacy' }, { drug: 'Warfarin', severity: 'major', effect: 'Reduced anticoagulant effect' }],
    precautions: ['Start low, increase slowly', 'HLA-B*1502 testing in SE Asians'],
    monitoringRequired: ['Serum levels', 'FBC', 'LFTs', 'U&E'],
  },
  {
    id: 'sodium_valproate',
    genericName: 'Sodium Valproate',
    brandNames: ['Epilim', 'Depakote'],
    category: 'CNS - Antiepileptics',
    formulations: [{ form: 'Tablet 200mg', strength: '200mg', route: 'oral' }, { form: 'Tablet 500mg', strength: '500mg', route: 'oral' }, { form: 'Syrup 200mg/5mL', strength: '200mg/5mL', route: 'oral' }, { form: 'Injection 400mg', strength: '400mg', route: 'IV' }],
    dosage: { adult: { standard: '600mg', min: '600mg', max: '2.5g', frequency: ['bd'] } },
    maxDailyDose: '2.5g',
    contraindications: ['Liver disease', 'Pregnancy (teratogenic)', 'Porphyria'],
    pregnancyCategory: 'X',
    pregnancyNotes: 'HIGHLY TERATOGENIC - Neural tube defects. Avoid in women of childbearing potential.',
    lactationSafety: 'caution',
    renalRisk: 'safe',
    hepaticRisk: 'avoid',
    cardiacRisk: 'safe',
    sideEffects: { common: ['Weight gain', 'Tremor', 'Alopecia', 'Nausea'], serious: ['Hepatotoxicity', 'Pancreatitis', 'Thrombocytopenia', 'Teratogenicity'] },
    interactions: [{ drug: 'Lamotrigine', severity: 'major', effect: 'Doubles lamotrigine levels' }],
    precautions: ['Pregnancy prevention programme mandatory', 'Monitor LFTs and FBC'],
    monitoringRequired: ['LFTs', 'FBC', 'Serum levels'],
  },
  {
    id: 'levetiracetam',
    genericName: 'Levetiracetam',
    brandNames: ['Keppra'],
    category: 'CNS - Antiepileptics',
    formulations: [{ form: 'Tablet 250mg', strength: '250mg', route: 'oral' }, { form: 'Tablet 500mg', strength: '500mg', route: 'oral' }, { form: 'Solution 100mg/mL', strength: '100mg/mL', route: 'IV' }],
    dosage: { adult: { standard: '500mg', min: '250mg', max: '3g', frequency: ['bd'] } },
    maxDailyDose: '3g',
    contraindications: ['Severe renal impairment without dose adjustment'],
    pregnancyCategory: 'C',
    lactationSafety: 'caution',
    renalRisk: 'dose_adjust',
    hepaticRisk: 'safe',
    cardiacRisk: 'safe',
    sideEffects: { common: ['Somnolence', 'Dizziness', 'Headache', 'Irritability'], serious: ['Psychiatric symptoms', 'Suicidal ideation', 'SJS (rare)'] },
    interactions: [],
    precautions: ['Monitor for behavioural changes', 'Adjust dose in renal impairment'],
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // CNS - ANTIDEPRESSANTS
  // ═══════════════════════════════════════════════════════════════════════════
  {
    id: 'amitriptyline',
    genericName: 'Amitriptyline Hydrochloride',
    brandNames: ['Elavil', 'Tryptizol'],
    category: 'CNS - Antidepressants',
    formulations: [{ form: 'Tablet 10mg', strength: '10mg', route: 'oral' }, { form: 'Tablet 25mg', strength: '25mg', route: 'oral' }, { form: 'Tablet 50mg', strength: '50mg', route: 'oral' }],
    dosage: { adult: { standard: '25-75mg', min: '10mg', max: '200mg', frequency: ['nocte'] } },
    maxDailyDose: '200mg',
    contraindications: ['Recent MI', 'Arrhythmias', 'Severe liver disease', 'Mania'],
    pregnancyCategory: 'C',
    lactationSafety: 'caution',
    renalRisk: 'safe',
    hepaticRisk: 'dose_adjust',
    cardiacRisk: 'caution',
    sideEffects: { common: ['Drowsiness', 'Dry mouth', 'Constipation', 'Weight gain', 'Blurred vision'], serious: ['Cardiac arrhythmias', 'Seizures (overdose)', 'Serotonin syndrome'] },
    interactions: [{ drug: 'MAOIs', severity: 'major', effect: 'Risk of serotonin syndrome - CONTRAINDICATED' }, { drug: 'Tramadol', severity: 'major', effect: 'Seizure and serotonin syndrome risk' }],
    precautions: ['Start low at night', 'Avoid abrupt withdrawal', 'Dangerous in overdose'],
    instructions: 'Take at bedtime. Do not stop suddenly. Also used for neuropathic pain 10-75mg nocte.',
  },
  {
    id: 'fluoxetine',
    genericName: 'Fluoxetine',
    brandNames: ['Prozac'],
    category: 'CNS - Antidepressants',
    formulations: [{ form: 'Capsule 20mg', strength: '20mg', route: 'oral' }],
    dosage: { adult: { standard: '20mg', min: '20mg', max: '60mg', frequency: ['od', 'mane'] } },
    maxDailyDose: '60mg',
    contraindications: ['Concurrent MAOI use'],
    pregnancyCategory: 'C',
    lactationSafety: 'caution',
    renalRisk: 'safe',
    hepaticRisk: 'dose_adjust',
    cardiacRisk: 'safe',
    sideEffects: { common: ['Nausea', 'Headache', 'Insomnia', 'Anxiety', 'Sexual dysfunction'], serious: ['Serotonin syndrome', 'Suicidal ideation (youth)', 'Hyponatraemia'] },
    interactions: [{ drug: 'MAOIs', severity: 'major', effect: 'Serotonin syndrome' }, { drug: 'Warfarin', severity: 'moderate', effect: 'Increased bleeding risk' }],
    precautions: ['Takes 2-4 weeks for full effect', 'Monitor for suicidality in young adults'],
    instructions: 'Take in the morning. Full effect may take 4-6 weeks.',
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // CNS - ANTIPSYCHOTICS
  // ═══════════════════════════════════════════════════════════════════════════
  {
    id: 'haloperidol',
    genericName: 'Haloperidol',
    brandNames: ['Haldol', 'Serenace'],
    category: 'CNS - Antipsychotics',
    formulations: [{ form: 'Tablet 1.5mg', strength: '1.5mg', route: 'oral' }, { form: 'Tablet 5mg', strength: '5mg', route: 'oral' }, { form: 'Injection 5mg/mL', strength: '5mg/mL', route: 'IM' }],
    dosage: { adult: { standard: '1.5-5mg', min: '0.5mg', max: '30mg', frequency: ['bd', 'tds'] } },
    maxDailyDose: '30mg',
    contraindications: ['QT prolongation', 'CNS depression', 'Parkinson disease'],
    pregnancyCategory: 'C',
    lactationSafety: 'caution',
    renalRisk: 'safe',
    hepaticRisk: 'dose_adjust',
    cardiacRisk: 'caution',
    sideEffects: { common: ['Extrapyramidal symptoms', 'Drowsiness', 'Dry mouth'], serious: ['Neuroleptic malignant syndrome', 'QT prolongation', 'Tardive dyskinesia'] },
    interactions: [{ drug: 'Amiodarone', severity: 'major', effect: 'QT prolongation' }],
    precautions: ['ECG before starting', 'Start with low dose in elderly'],
  },
  {
    id: 'chlorpromazine',
    genericName: 'Chlorpromazine Hydrochloride',
    brandNames: ['Largactil', 'Thorazine'],
    category: 'CNS - Antipsychotics',
    formulations: [{ form: 'Tablet 25mg', strength: '25mg', route: 'oral' }, { form: 'Tablet 100mg', strength: '100mg', route: 'oral' }, { form: 'Injection 25mg/mL', strength: '25mg/mL', route: 'IM' }],
    dosage: { adult: { standard: '25-100mg', min: '25mg', max: '1g', frequency: ['tds'] } },
    maxDailyDose: '1g',
    contraindications: ['CNS depression', 'Bone marrow depression', 'Phaeochromocytoma'],
    pregnancyCategory: 'C',
    lactationSafety: 'caution',
    renalRisk: 'safe',
    hepaticRisk: 'dose_adjust',
    cardiacRisk: 'caution',
    sideEffects: { common: ['Sedation', 'Postural hypotension', 'Dry mouth', 'Weight gain'], serious: ['NMS', 'Cholestatic jaundice', 'Blood dyscrasias', 'Photosensitivity'] },
    interactions: [{ drug: 'Antihypertensives', severity: 'moderate', effect: 'Enhanced hypotension' }],
    precautions: ['Avoid in elderly with dementia', 'Photosensitivity - wear sunscreen'],
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // RESPIRATORY - BRONCHODILATORS
  // ═══════════════════════════════════════════════════════════════════════════
  {
    id: 'salbutamol',
    genericName: 'Salbutamol (Albuterol)',
    brandNames: ['Ventolin', 'Proventil'],
    category: 'Bronchodilators',
    formulations: [{ form: 'MDI 100mcg/puff', strength: '100mcg', route: 'inhaled' }, { form: 'Nebuliser Solution 5mg/2.5mL', strength: '5mg', route: 'inhaled' }, { form: 'Tablet 2mg', strength: '2mg', route: 'oral' }, { form: 'Injection 0.5mg/mL', strength: '0.5mg/mL', route: 'IV' }],
    dosage: { adult: { standard: '2 puffs (200mcg)', min: '100mcg', max: '800mcg', frequency: ['prn', 'qds'] } },
    maxDailyDose: '800mcg inhaled (regular); 40mg oral',
    contraindications: [],
    pregnancyCategory: 'C',
    lactationSafety: 'safe',
    renalRisk: 'safe',
    hepaticRisk: 'safe',
    cardiacRisk: 'caution',
    sideEffects: { common: ['Tremor', 'Tachycardia', 'Headache', 'Hypokalaemia'], serious: ['Paradoxical bronchospasm', 'Severe hypokalaemia'] },
    interactions: [{ drug: 'Beta-blockers', severity: 'major', effect: 'Antagonism of bronchodilation' }],
    precautions: ['Shake inhaler before use', 'Rinse mouth after use'],
    instructions: 'Shake well before use. 2 puffs as needed for wheeze/breathlessness. Use spacer if available.',
  },
  {
    id: 'ipratropium',
    genericName: 'Ipratropium Bromide',
    brandNames: ['Atrovent'],
    category: 'Bronchodilators',
    formulations: [{ form: 'MDI 20mcg/puff', strength: '20mcg', route: 'inhaled' }, { form: 'Nebuliser 250mcg/mL', strength: '250mcg/mL', route: 'inhaled' }],
    dosage: { adult: { standard: '2 puffs (40mcg)', min: '20mcg', max: '160mcg', frequency: ['tds', 'qds'] } },
    maxDailyDose: '160mcg inhaled',
    contraindications: ['Known hypersensitivity to atropine or derivatives'],
    pregnancyCategory: 'B',
    lactationSafety: 'safe',
    renalRisk: 'safe',
    hepaticRisk: 'safe',
    cardiacRisk: 'safe',
    sideEffects: { common: ['Dry mouth', 'Headache', 'Cough'], serious: ['Paradoxical bronchospasm', 'Urinary retention', 'Glaucoma (if spray contacts eyes)'] },
    interactions: [],
    precautions: ['Avoid contact with eyes', 'Can be nebulised with salbutamol'],
  },
  {
    id: 'aminophylline',
    genericName: 'Aminophylline',
    brandNames: ['Phyllocontin'],
    category: 'Bronchodilators',
    formulations: [{ form: 'Tablet 100mg', strength: '100mg', route: 'oral' }, { form: 'Injection 250mg/10mL', strength: '25mg/mL', route: 'IV' }],
    dosage: { adult: { standard: '5mg/kg loading IV over 20min', min: '225mg', max: '900mg', frequency: ['bd'], notes: 'IV loading: 5mg/kg over 20-30min. Maintenance: 0.5mg/kg/hr' } },
    maxDailyDose: '900mg oral',
    contraindications: ['Arrhythmias', 'Epilepsy (caution)'],
    pregnancyCategory: 'C',
    lactationSafety: 'caution',
    renalRisk: 'safe',
    hepaticRisk: 'dose_adjust',
    cardiacRisk: 'caution',
    sideEffects: { common: ['Nausea', 'Tachycardia', 'Insomnia', 'Headache'], serious: ['Arrhythmias', 'Seizures (toxic levels)', 'Cardiac arrest (rapid IV)'] },
    interactions: [{ drug: 'Ciprofloxacin', severity: 'major', effect: 'Increased theophylline levels' }, { drug: 'Erythromycin', severity: 'major', effect: 'Increased theophylline levels' }],
    precautions: ['SLOW IV infusion only', 'Monitor levels in sick patients', 'Narrow therapeutic index'],
    monitoringRequired: ['Serum theophylline level (10-20 mcg/mL)'],
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // ANTIBIOTICS - ADDITIONAL
  // ═══════════════════════════════════════════════════════════════════════════
  {
    id: 'clindamycin',
    genericName: 'Clindamycin',
    brandNames: ['Dalacin C', 'Cleocin'],
    category: 'Antibiotics - Lincosamides',
    formulations: [{ form: 'Capsule 150mg', strength: '150mg', route: 'oral' }, { form: 'Capsule 300mg', strength: '300mg', route: 'oral' }, { form: 'Injection 150mg/mL', strength: '150mg/mL', route: 'IV' }],
    dosage: { adult: { standard: '150-450mg', min: '150mg', max: '450mg', frequency: ['qds'] } },
    maxDailyDose: '1.8g oral; 4.8g IV',
    contraindications: ['Diarrhoeal states'],
    pregnancyCategory: 'B',
    lactationSafety: 'caution',
    renalRisk: 'safe',
    hepaticRisk: 'dose_adjust',
    cardiacRisk: 'safe',
    sideEffects: { common: ['Diarrhoea', 'Nausea', 'Rash'], serious: ['Pseudomembranous colitis (C. difficile)', 'Severe diarrhoea'] },
    interactions: [{ drug: 'Neuromuscular blockers', severity: 'moderate', effect: 'Enhanced neuromuscular blockade' }],
    precautions: ['Stop immediately if diarrhoea develops', 'High risk C. difficile colitis'],
  },
  {
    id: 'meropenem',
    genericName: 'Meropenem',
    brandNames: ['Meronem'],
    category: 'Antibiotics - Carbapenems',
    formulations: [{ form: 'Injection 500mg vial', strength: '500mg', route: 'IV' }, { form: 'Injection 1g vial', strength: '1g', route: 'IV' }],
    dosage: { adult: { standard: '500mg-1g', min: '500mg', max: '2g', frequency: ['q8h'] } },
    maxDailyDose: '6g',
    contraindications: ['Hypersensitivity to carbapenems'],
    pregnancyCategory: 'B',
    lactationSafety: 'caution',
    renalRisk: 'dose_adjust',
    hepaticRisk: 'safe',
    cardiacRisk: 'safe',
    sideEffects: { common: ['Nausea', 'Diarrhoea', 'Rash', 'Injection site reactions'], serious: ['Seizures', 'C. difficile colitis', 'Blood dyscrasias'] },
    interactions: [{ drug: 'Valproic acid', severity: 'major', effect: 'Dramatically reduces valproate levels' }],
    precautions: ['Reserve for serious/resistant infections', 'Dose adjust in renal impairment'],
    monitoringRequired: ['Renal function'],
  },
  {
    id: 'doxycycline',
    genericName: 'Doxycycline',
    brandNames: ['Vibramycin', 'Doxylin'],
    category: 'Antibiotics - Tetracyclines',
    formulations: [{ form: 'Capsule 100mg', strength: '100mg', route: 'oral' }],
    dosage: { adult: { standard: '100mg', min: '100mg', max: '200mg', frequency: ['od', 'bd'], duration: '7-14 days' } },
    maxDailyDose: '200mg',
    contraindications: ['Children <12 years', 'Pregnancy', 'Severe hepatic impairment'],
    pregnancyCategory: 'D',
    lactationSafety: 'avoid',
    renalRisk: 'safe',
    hepaticRisk: 'caution' as any,
    cardiacRisk: 'safe',
    sideEffects: { common: ['Nausea', 'Photosensitivity', 'Oesophageal irritation'], serious: ['Oesophageal ulceration', 'Hepatotoxicity', 'Intracranial hypertension'] },
    interactions: [{ drug: 'Antacids', severity: 'moderate', effect: 'Reduced doxycycline absorption' }, { drug: 'Warfarin', severity: 'moderate', effect: 'Enhanced anticoagulant effect' }],
    precautions: ['Take with plenty of water', 'Remain upright for 30 min after dose', 'Avoid sun exposure'],
    instructions: 'Take with a full glass of water. Do not lie down for 30 minutes after taking. Avoid prolonged sun exposure.',
  },
  {
    id: 'cotrimoxazole',
    genericName: 'Co-trimoxazole (Sulfamethoxazole/Trimethoprim)',
    brandNames: ['Septrin', 'Bactrim'],
    category: 'Antibiotics - Sulfonamides',
    formulations: [{ form: 'Tablet 480mg', strength: '480mg', route: 'oral' }, { form: 'Tablet 960mg (DS)', strength: '960mg', route: 'oral' }, { form: 'Suspension 240mg/5mL', strength: '240mg/5mL', route: 'oral' }],
    dosage: { adult: { standard: '960mg', min: '480mg', max: '960mg', frequency: ['bd'], duration: '5-7 days' } },
    maxDailyDose: '1920mg',
    contraindications: ['Severe renal/hepatic impairment', 'Blood dyscrasias', 'Porphyria', 'Sulfonamide allergy'],
    pregnancyCategory: 'C',
    pregnancyNotes: 'Avoid in 1st trimester (folate antagonist) and near term (neonatal jaundice)',
    lactationSafety: 'avoid',
    renalRisk: 'dose_adjust',
    hepaticRisk: 'avoid',
    cardiacRisk: 'safe',
    sideEffects: { common: ['Nausea', 'Rash', 'Diarrhoea'], serious: ['SJS/TEN', 'Blood dyscrasias', 'Hepatotoxicity', 'Hyperkalaemia'] },
    interactions: [{ drug: 'Methotrexate', severity: 'major', effect: 'Increased methotrexate toxicity' }, { drug: 'Warfarin', severity: 'moderate', effect: 'Increased INR' }],
    precautions: ['Maintain adequate hydration', 'Monitor FBC in prolonged use'],
    monitoringRequired: ['FBC', 'U&E in prolonged use'],
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // ENDOCRINE - MORE DIABETES
  // ═══════════════════════════════════════════════════════════════════════════
  {
    id: 'glibenclamide',
    genericName: 'Glibenclamide (Glyburide)',
    brandNames: ['Daonil', 'Euglucon'],
    category: 'Endocrine - Diabetes',
    formulations: [{ form: 'Tablet 5mg', strength: '5mg', route: 'oral' }],
    dosage: { adult: { standard: '2.5-5mg', min: '2.5mg', max: '15mg', frequency: ['od', 'bd'] } },
    maxDailyDose: '15mg',
    contraindications: ['Type 1 DM', 'DKA', 'Severe hepatic/renal impairment'],
    pregnancyCategory: 'C',
    lactationSafety: 'avoid',
    renalRisk: 'avoid',
    hepaticRisk: 'avoid',
    cardiacRisk: 'safe',
    sideEffects: { common: ['Hypoglycaemia', 'Weight gain', 'GI disturbance'], serious: ['Severe/prolonged hypoglycaemia', 'Blood dyscrasias'] },
    interactions: [{ drug: 'Beta-blockers', severity: 'moderate', effect: 'Masks hypoglycaemia symptoms' }],
    precautions: ['Take with meals', 'High risk of hypoglycaemia in elderly'],
    monitoringRequired: ['Blood glucose', 'HbA1c'],
  },
  {
    id: 'gliclazide',
    genericName: 'Gliclazide',
    brandNames: ['Diamicron'],
    category: 'Endocrine - Diabetes',
    formulations: [{ form: 'Tablet 40mg', strength: '40mg', route: 'oral' }, { form: 'Tablet 80mg', strength: '80mg', route: 'oral' }, { form: 'MR Tablet 30mg', strength: '30mg', route: 'oral' }],
    dosage: { adult: { standard: '40-80mg', min: '40mg', max: '320mg', frequency: ['od', 'bd'] } },
    maxDailyDose: '320mg',
    contraindications: ['Type 1 DM', 'DKA'],
    pregnancyCategory: 'C',
    lactationSafety: 'avoid',
    renalRisk: 'dose_adjust',
    hepaticRisk: 'dose_adjust',
    cardiacRisk: 'safe',
    sideEffects: { common: ['Hypoglycaemia', 'Weight gain', 'GI disturbance'], serious: ['Severe hypoglycaemia', 'Hepatotoxicity'] },
    interactions: [{ drug: 'Fluconazole', severity: 'moderate', effect: 'Increased hypoglycaemia risk' }],
    precautions: ['Take with meals', 'Monitor blood glucose regularly'],
    monitoringRequired: ['Blood glucose', 'HbA1c'],
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // ENDOCRINE - THYROID
  // ═══════════════════════════════════════════════════════════════════════════
  {
    id: 'levothyroxine',
    genericName: 'Levothyroxine Sodium',
    brandNames: ['Eltroxin', 'Euthyrox', 'Synthroid'],
    category: 'Endocrine - Thyroid',
    formulations: [{ form: 'Tablet 25mcg', strength: '25mcg', route: 'oral' }, { form: 'Tablet 50mcg', strength: '50mcg', route: 'oral' }, { form: 'Tablet 100mcg', strength: '100mcg', route: 'oral' }],
    dosage: { adult: { standard: '50-100mcg', min: '25mcg', max: '200mcg', frequency: ['od', 'mane'] } },
    maxDailyDose: '200mcg',
    contraindications: ['Thyrotoxicosis', 'Adrenal insufficiency (uncorrected)'],
    pregnancyCategory: 'A',
    lactationSafety: 'safe',
    renalRisk: 'safe',
    hepaticRisk: 'safe',
    cardiacRisk: 'caution',
    cardiacNotes: 'Start with lower dose in cardiac disease (25mcg)',
    sideEffects: { common: ['Palpitations (if over-replaced)', 'Diarrhoea', 'Weight loss', 'Tremor'], serious: ['Angina', 'Arrhythmias', 'Osteoporosis (chronic excess)'] },
    interactions: [{ drug: 'Iron', severity: 'moderate', effect: 'Reduced absorption - separate by 4hrs' }, { drug: 'Calcium', severity: 'moderate', effect: 'Reduced absorption - separate by 4hrs' }],
    precautions: ['Take on empty stomach, 30 min before breakfast', 'Start low in elderly and cardiac patients'],
    monitoringRequired: ['TFTs 6-8 weekly until stable, then annually'],
    instructions: 'Take on an empty stomach, at least 30 minutes before breakfast. Separate from iron and calcium supplements by 4 hours.',
  },
  {
    id: 'carbimazole',
    genericName: 'Carbimazole',
    brandNames: ['Neo-Mercazole'],
    category: 'Endocrine - Thyroid',
    formulations: [{ form: 'Tablet 5mg', strength: '5mg', route: 'oral' }, { form: 'Tablet 10mg', strength: '10mg', route: 'oral' }, { form: 'Tablet 20mg', strength: '20mg', route: 'oral' }],
    dosage: { adult: { standard: '15-40mg', min: '15mg', max: '40mg', frequency: ['od', 'bd', 'tds'] } },
    maxDailyDose: '40mg (initial)',
    contraindications: ['Severe blood disorders'],
    pregnancyCategory: 'D',
    pregnancyNotes: 'Risk of aplasia cutis. Propylthiouracil preferred in 1st trimester.',
    lactationSafety: 'caution',
    renalRisk: 'safe',
    hepaticRisk: 'caution' as any,
    cardiacRisk: 'safe',
    sideEffects: { common: ['Nausea', 'Rash', 'Headache', 'Arthralgia'], serious: ['Agranulocytosis', 'Pancytopenia', 'Hepatotoxicity'] },
    interactions: [{ drug: 'Warfarin', severity: 'moderate', effect: 'Initially enhanced then reduced anticoagulation' }],
    precautions: ['URGENT FBC if sore throat or fever', 'Report sore throat immediately'],
    monitoringRequired: ['TFTs', 'FBC if sore throat'],
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // GASTROINTESTINAL - LAXATIVES
  // ═══════════════════════════════════════════════════════════════════════════
  {
    id: 'lactulose',
    genericName: 'Lactulose',
    brandNames: ['Duphalac'],
    category: 'Laxatives',
    formulations: [{ form: 'Solution 3.35g/5mL', strength: '3.35g/5mL', route: 'oral' }],
    dosage: { adult: { standard: '15mL', min: '15mL', max: '30mL', frequency: ['bd'] } },
    maxDailyDose: '60mL',
    contraindications: ['Galactosaemia', 'Intestinal obstruction'],
    pregnancyCategory: 'B',
    lactationSafety: 'safe',
    renalRisk: 'safe',
    hepaticRisk: 'safe',
    cardiacRisk: 'safe',
    sideEffects: { common: ['Flatulence', 'Abdominal cramps', 'Nausea'], serious: [] },
    interactions: [],
    precautions: ['Takes 48hrs for effect', 'Also used for hepatic encephalopathy'],
  },
  {
    id: 'bisacodyl',
    genericName: 'Bisacodyl',
    brandNames: ['Dulcolax'],
    category: 'Laxatives',
    formulations: [{ form: 'Tablet 5mg (enteric-coated)', strength: '5mg', route: 'oral' }, { form: 'Suppository 10mg', strength: '10mg', route: 'rectal' }],
    dosage: { adult: { standard: '5-10mg', min: '5mg', max: '20mg', frequency: ['nocte', 'od'] } },
    maxDailyDose: '20mg',
    contraindications: ['Intestinal obstruction', 'Acute abdomen'],
    pregnancyCategory: 'C',
    lactationSafety: 'safe',
    renalRisk: 'safe',
    hepaticRisk: 'safe',
    cardiacRisk: 'safe',
    sideEffects: { common: ['Abdominal cramps', 'Diarrhoea'], serious: ['Electrolyte imbalance with chronic use'] },
    interactions: [],
    precautions: ['Do not crush enteric-coated tablets', 'Avoid with milk/antacids'],
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // GASTROINTESTINAL - ANTIDIARRHOEALS
  // ═══════════════════════════════════════════════════════════════════════════
  {
    id: 'loperamide',
    genericName: 'Loperamide',
    brandNames: ['Imodium'],
    category: 'Antidiarrhoeals',
    formulations: [{ form: 'Capsule 2mg', strength: '2mg', route: 'oral' }],
    dosage: { adult: { standard: '4mg then 2mg after each loose stool', min: '2mg', max: '16mg', frequency: ['prn'] } },
    maxDailyDose: '16mg',
    contraindications: ['Acute dysentery', 'Active ulcerative colitis', 'Pseudomembranous colitis', 'Abdominal distension'],
    pregnancyCategory: 'B',
    lactationSafety: 'safe',
    renalRisk: 'safe',
    hepaticRisk: 'dose_adjust',
    cardiacRisk: 'safe',
    sideEffects: { common: ['Constipation', 'Abdominal cramps', 'Dizziness'], serious: ['Paralytic ileus'] },
    interactions: [],
    precautions: ['Not for infective diarrhoea', 'Maintain oral hydration'],
  },
  {
    id: 'oral_rehydration_salts',
    genericName: 'Oral Rehydration Salts (ORS)',
    brandNames: ['ORS', 'Dioralyte'],
    category: 'Antidiarrhoeals',
    formulations: [{ form: 'Sachets for reconstitution', strength: '1 sachet/200mL', route: 'oral' }],
    dosage: { adult: { standard: '200-400mL after each loose stool', min: '200mL', max: 'Ad lib', frequency: ['prn'] }, pediatric: { standard: '50-100mL/kg over 4hrs', min: '50mL/kg', max: '100mL/kg', frequency: ['prn'] } },
    maxDailyDose: 'Ad libitum',
    contraindications: ['Intestinal obstruction'],
    pregnancyCategory: 'A',
    lactationSafety: 'safe',
    renalRisk: 'safe',
    hepaticRisk: 'safe',
    cardiacRisk: 'safe',
    sideEffects: { common: ['Vomiting if given too fast'], serious: [] },
    interactions: [],
    precautions: ['Dissolve in clean water only', 'Discard after 24hrs'],
    instructions: 'Dissolve 1 sachet in 200mL of clean water. Sip frequently. Discard unused solution after 24 hours.',
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // GASTROINTESTINAL - ADDITIONAL
  // ═══════════════════════════════════════════════════════════════════════════
  {
    id: 'hyoscine_butylbromide',
    genericName: 'Hyoscine Butylbromide',
    brandNames: ['Buscopan'],
    category: 'Gastrointestinal',
    formulations: [{ form: 'Tablet 10mg', strength: '10mg', route: 'oral' }, { form: 'Injection 20mg/mL', strength: '20mg/mL', route: 'IV' }],
    dosage: { adult: { standard: '10-20mg', min: '10mg', max: '80mg', frequency: ['tds', 'qds'] } },
    maxDailyDose: '80mg',
    contraindications: ['Closed-angle glaucoma', 'Myasthenia gravis', 'Paralytic ileus'],
    pregnancyCategory: 'C',
    lactationSafety: 'caution',
    renalRisk: 'safe',
    hepaticRisk: 'safe',
    cardiacRisk: 'caution',
    sideEffects: { common: ['Dry mouth', 'Tachycardia', 'Constipation'], serious: ['Urinary retention', 'Anaphylaxis (injection)'] },
    interactions: [],
    precautions: ['Use with caution in prostatic enlargement'],
  },
  {
    id: 'sucralfate',
    genericName: 'Sucralfate',
    brandNames: ['Antepsin', 'Carafate'],
    category: 'Gastrointestinal',
    formulations: [{ form: 'Tablet 1g', strength: '1g', route: 'oral' }, { form: 'Suspension 1g/5mL', strength: '1g/5mL', route: 'oral' }],
    dosage: { adult: { standard: '1g', min: '1g', max: '2g', frequency: ['bd', 'qds'] } },
    maxDailyDose: '8g',
    contraindications: [],
    pregnancyCategory: 'B',
    lactationSafety: 'safe',
    renalRisk: 'caution' as any,
    hepaticRisk: 'safe',
    cardiacRisk: 'safe',
    sideEffects: { common: ['Constipation', 'Dry mouth'], serious: ['Aluminium accumulation in renal failure'] },
    interactions: [{ drug: 'Phenytoin', severity: 'moderate', effect: 'Reduced phenytoin absorption' }, { drug: 'Ciprofloxacin', severity: 'moderate', effect: 'Reduced quinolone absorption' }],
    precautions: ['Take 1hr before meals', 'Separate from other drugs by 2hrs'],
    instructions: 'Take on an empty stomach, 1 hour before meals. Separate from other medications by at least 2 hours.',
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // OBSTETRICS & GYNAECOLOGY
  // ═══════════════════════════════════════════════════════════════════════════
  {
    id: 'oxytocin',
    genericName: 'Oxytocin',
    brandNames: ['Syntocinon', 'Pitocin'],
    category: 'Obstetrics & Gynaecology',
    formulations: [{ form: 'Injection 5IU/mL', strength: '5IU/mL', route: 'IV' }, { form: 'Injection 10IU/mL', strength: '10IU/mL', route: 'IM' }],
    dosage: { adult: { standard: '5-10 IU', min: '5 IU', max: '40 IU', frequency: ['stat'] } },
    maxDailyDose: '40 IU (postpartum)',
    contraindications: ['Hypertonic uterine contractions', 'Mechanical obstruction to delivery', 'Fetal distress'],
    pregnancyCategory: 'C',
    pregnancyNotes: 'Used therapeutically in obstetrics under supervision',
    lactationSafety: 'safe',
    renalRisk: 'safe',
    hepaticRisk: 'safe',
    cardiacRisk: 'caution',
    sideEffects: { common: ['Nausea', 'Vomiting', 'Uterine hyperstimulation'], serious: ['Uterine rupture', 'Water intoxication', 'Fetal distress'] },
    interactions: [],
    precautions: ['Titrate carefully', 'Continuous fetal monitoring during labour induction'],
    monitoringRequired: ['Fetal heart rate', 'Uterine contractions'],
  },
  {
    id: 'magnesium_sulfate',
    genericName: 'Magnesium Sulfate',
    brandNames: ['MgSO4'],
    category: 'Obstetrics & Gynaecology',
    formulations: [{ form: 'Injection 50% (4mL amp = 2g)', strength: '500mg/mL', route: 'IV' }, { form: 'Injection 50% (10mL = 5g)', strength: '500mg/mL', route: 'IM' }],
    dosage: { adult: { standard: 'Loading: 4g IV over 20min + 5g IM each buttock', min: '4g', max: '4g IV + 10g IM', frequency: ['stat'], notes: 'Maintenance: 1g/hr IV or 5g IM q4h' } },
    maxDailyDose: '40g/24hrs',
    contraindications: ['Myasthenia gravis', 'Heart block'],
    pregnancyCategory: 'A',
    pregnancyNotes: 'Drug of choice for eclampsia prevention/treatment',
    lactationSafety: 'safe',
    renalRisk: 'dose_adjust',
    hepaticRisk: 'safe',
    cardiacRisk: 'monitor',
    sideEffects: { common: ['Flushing', 'Nausea', 'Hypotension'], serious: ['Respiratory depression', 'Cardiac arrest', 'Loss of reflexes'] },
    interactions: [{ drug: 'Nifedipine', severity: 'moderate', effect: 'Potentiated hypotension' }],
    precautions: ['Monitor patellar reflexes', 'Monitor urine output (>25mL/hr)', 'Have calcium gluconate antidote ready', 'Monitor respiratory rate (>16/min)'],
    monitoringRequired: ['Patellar reflexes', 'Respiratory rate', 'Urine output', 'Serum magnesium (if available)'],
  },
  {
    id: 'misoprostol',
    genericName: 'Misoprostol',
    brandNames: ['Cytotec'],
    category: 'Obstetrics & Gynaecology',
    formulations: [{ form: 'Tablet 200mcg', strength: '200mcg', route: 'oral' }, { form: 'Tablet 200mcg (sublingual)', strength: '200mcg', route: 'sublingual' }, { form: 'Tablet 200mcg (rectal/vaginal)', strength: '200mcg', route: 'rectal' }],
    dosage: { adult: { standard: '200-800mcg', min: '200mcg', max: '800mcg', frequency: ['stat', 'prn'] } },
    maxDailyDose: '800mcg',
    contraindications: ['Pregnancy (when used as gastric protectant)'],
    pregnancyCategory: 'X',
    pregnancyNotes: 'ABORTIFACIENT - Only use in obstetric emergencies (PPH) or therapeutic abortion',
    lactationSafety: 'caution',
    renalRisk: 'safe',
    hepaticRisk: 'safe',
    cardiacRisk: 'safe',
    sideEffects: { common: ['Diarrhoea', 'Abdominal pain', 'Nausea'], serious: ['Uterine rupture', 'Hyperstimulation'] },
    interactions: [],
    precautions: ['FOR PPH: 600-800mcg sublingual/rectal', 'FOR GASTRIC PROTECTION: 200mcg QDS with NSAID'],
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // ANTIMALARIALS
  // ═══════════════════════════════════════════════════════════════════════════
  {
    id: 'artemether_lumefantrine',
    genericName: 'Artemether/Lumefantrine',
    brandNames: ['Coartem', 'Riamet'],
    category: 'Antimalarials',
    formulations: [{ form: 'Tablet 20/120mg', strength: '20/120mg', route: 'oral' }],
    dosage: { adult: { standard: '4 tablets (80/480mg)', min: '4 tablets', max: '4 tablets per dose', frequency: ['bd'], duration: '3 days (6 doses at 0, 8, 24, 36, 48, 60 hrs)' } },
    maxDailyDose: '8 tablets',
    contraindications: ['Severe malaria (use IV artesunate)', 'First trimester pregnancy'],
    pregnancyCategory: 'C',
    pregnancyNotes: 'Avoid in 1st trimester if alternatives available',
    lactationSafety: 'caution',
    renalRisk: 'safe',
    hepaticRisk: 'caution' as any,
    cardiacRisk: 'caution',
    sideEffects: { common: ['Headache', 'Dizziness', 'Anorexia', 'Abdominal pain'], serious: ['QT prolongation', 'Hepatotoxicity'] },
    interactions: [{ drug: 'QT-prolonging drugs', severity: 'major', effect: 'Increased QT prolongation risk' }],
    precautions: ['Take with food/milk (increases absorption)', 'Complete full course'],
    instructions: 'Take with food or milk. Complete all 6 doses even if feeling better. Dose at 0, 8, 24, 36, 48, and 60 hours.',
  },
  {
    id: 'quinine',
    genericName: 'Quinine Sulfate/Dihydrochloride',
    brandNames: ['Quinine'],
    category: 'Antimalarials',
    formulations: [{ form: 'Tablet 300mg', strength: '300mg', route: 'oral' }, { form: 'Injection 300mg/mL', strength: '300mg/mL', route: 'IV' }],
    dosage: { adult: { standard: '600mg', min: '300mg', max: '600mg', frequency: ['q8h'], duration: '7 days' } },
    maxDailyDose: '1.8g',
    contraindications: ['Haemoglobinuria', 'Optic neuritis', 'Myasthenia gravis'],
    pregnancyCategory: 'C',
    lactationSafety: 'caution',
    renalRisk: 'dose_adjust',
    hepaticRisk: 'dose_adjust',
    cardiacRisk: 'caution',
    sideEffects: { common: ['Cinchonism (tinnitus, headache, nausea)', 'Hypoglycaemia'], serious: ['Cardiac arrhythmias', 'Blackwater fever', 'Severe hypoglycaemia'] },
    interactions: [{ drug: 'Digoxin', severity: 'moderate', effect: 'Increased digoxin levels' }, { drug: 'Mefloquine', severity: 'major', effect: 'Increased seizure risk' }],
    precautions: ['IV infusion SLOW (over 4hrs)', 'Monitor blood glucose', 'ECG monitoring for IV'],
    monitoringRequired: ['Blood glucose', 'ECG (IV use)', 'Renal function'],
  },
  {
    id: 'artesunate',
    genericName: 'Artesunate',
    brandNames: ['Artesunate'],
    category: 'Antimalarials',
    formulations: [{ form: 'Injection 60mg vial', strength: '60mg', route: 'IV' }],
    dosage: { adult: { standard: '2.4mg/kg', min: '2.4mg/kg', max: '2.4mg/kg', frequency: ['stat'], notes: 'At 0, 12, 24hrs then daily until oral therapy possible' } },
    maxDailyDose: '2.4mg/kg per dose',
    contraindications: ['Hypersensitivity'],
    pregnancyCategory: 'C',
    pregnancyNotes: 'Preferred for severe malaria in pregnancy (all trimesters)',
    lactationSafety: 'caution',
    renalRisk: 'safe',
    hepaticRisk: 'safe',
    cardiacRisk: 'safe',
    sideEffects: { common: ['Dizziness', 'Nausea', 'Reticulocyte count drop'], serious: ['Delayed haemolytic anaemia', 'Hypersensitivity'] },
    interactions: [],
    precautions: ['Drug of choice for SEVERE malaria', 'Monitor Hb for delayed haemolysis', 'Switch to oral ACT when patient can swallow'],
    monitoringRequired: ['Hb on days 7, 14, 28', 'Parasitaemia'],
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // GENERAL ANAESTHETICS
  // ═══════════════════════════════════════════════════════════════════════════
  {
    id: 'propofol',
    genericName: 'Propofol',
    brandNames: ['Diprivan'],
    category: 'General Anaesthetics',
    formulations: [{ form: 'Injection 10mg/mL (20mL)', strength: '10mg/mL', route: 'IV' }],
    dosage: { adult: { standard: '1.5-2.5mg/kg', min: '1mg/kg', max: '2.5mg/kg', frequency: ['stat'] } },
    maxDailyDose: '2.5mg/kg induction',
    contraindications: ['Known hypersensitivity to soya/egg lecithin'],
    pregnancyCategory: 'B',
    lactationSafety: 'safe',
    renalRisk: 'safe',
    hepaticRisk: 'safe',
    cardiacRisk: 'caution',
    sideEffects: { common: ['Pain on injection', 'Hypotension', 'Apnoea', 'Bradycardia'], serious: ['Profound hypotension', 'Propofol infusion syndrome'] },
    interactions: [],
    precautions: ['Must have airway management equipment ready', 'Reduce dose in elderly/debilitated patients'],
  },
  {
    id: 'ketamine',
    genericName: 'Ketamine Hydrochloride',
    brandNames: ['Ketalar'],
    category: 'General Anaesthetics',
    formulations: [{ form: 'Injection 50mg/mL', strength: '50mg/mL', route: 'IV' }, { form: 'Injection 50mg/mL', strength: '50mg/mL', route: 'IM' }],
    dosage: { adult: { standard: 'IV: 1-2mg/kg; IM: 4-6mg/kg', min: '0.5mg/kg IV', max: '6mg/kg IM', frequency: ['stat'], notes: 'Dissociative anaesthesia' } },
    maxDailyDose: 'As clinically indicated',
    contraindications: ['Severe hypertension', 'Pre-eclampsia/eclampsia', 'Raised ICP'],
    pregnancyCategory: 'B',
    lactationSafety: 'caution',
    renalRisk: 'safe',
    hepaticRisk: 'safe',
    cardiacRisk: 'caution',
    sideEffects: { common: ['Emergence phenomena (hallucinations)', 'Nystagmus', 'Nausea', 'Increased secretions'], serious: ['Laryngospasm', 'Hypertension', 'Raised ICP'] },
    interactions: [],
    precautions: ['Give with midazolam to reduce emergence phenomena', 'Give atropine to reduce secretions', 'Maintains airway reflexes - unique among anaesthetics'],
  },
  {
    id: 'suxamethonium',
    genericName: 'Suxamethonium (Succinylcholine)',
    brandNames: ['Anectine', 'Scoline'],
    category: 'Muscle Relaxants',
    formulations: [{ form: 'Injection 50mg/mL', strength: '50mg/mL', route: 'IV' }],
    dosage: { adult: { standard: '1-1.5mg/kg', min: '1mg/kg', max: '1.5mg/kg', frequency: ['stat'] } },
    maxDailyDose: '1.5mg/kg',
    contraindications: ['Burns >24hrs', 'Crush injuries', 'Hyperkalaemia', 'Malignant hyperthermia history', 'Denervation injuries'],
    pregnancyCategory: 'C',
    lactationSafety: 'safe',
    renalRisk: 'caution' as any,
    hepaticRisk: 'safe',
    cardiacRisk: 'caution',
    sideEffects: { common: ['Fasciculations', 'Muscle pain', 'Transient hyperkalaemia'], serious: ['Malignant hyperthermia', 'Cardiac arrest (hyperkalaemia)', 'Anaphylaxis'] },
    interactions: [],
    precautions: ['Rapid sequence intubation drug', 'Duration: 5-10 minutes', 'Must have dantrolene available'],
  },
  {
    id: 'atropine',
    genericName: 'Atropine Sulfate',
    brandNames: ['Atropine'],
    category: 'Emergency Drugs',
    formulations: [{ form: 'Injection 0.6mg/mL', strength: '0.6mg/mL', route: 'IV' }, { form: 'Injection 1mg/mL', strength: '1mg/mL', route: 'IV' }],
    dosage: { adult: { standard: '0.6mg', min: '0.3mg', max: '3mg', frequency: ['stat', 'prn'] } },
    maxDailyDose: '3mg',
    contraindications: ['Closed-angle glaucoma', 'Myasthenia gravis', 'Paralytic ileus'],
    pregnancyCategory: 'C',
    lactationSafety: 'caution',
    renalRisk: 'safe',
    hepaticRisk: 'safe',
    cardiacRisk: 'monitor',
    sideEffects: { common: ['Tachycardia', 'Dry mouth', 'Blurred vision', 'Urinary retention'], serious: ['Severe tachycardia', 'CNS excitation'] },
    interactions: [],
    precautions: ['For symptomatic bradycardia', 'For organophosphate poisoning: higher doses (2mg IV repeated)'],
  },
  {
    id: 'adrenaline',
    genericName: 'Adrenaline (Epinephrine)',
    brandNames: ['Adrenaline', 'EpiPen'],
    category: 'Emergency Drugs',
    formulations: [{ form: 'Injection 1:1000 (1mg/mL)', strength: '1mg/mL', route: 'IM' }, { form: 'Injection 1:10000 (0.1mg/mL)', strength: '0.1mg/mL', route: 'IV' }],
    dosage: { adult: { standard: 'Anaphylaxis: 0.5mg IM (1:1000); Cardiac arrest: 1mg IV (1:10000)', min: '0.3mg', max: '1mg', frequency: ['stat'], notes: 'IM for anaphylaxis. IV 1:10000 for cardiac arrest only.' } },
    maxDailyDose: 'As clinically indicated',
    contraindications: [],
    pregnancyCategory: 'C',
    lactationSafety: 'safe',
    renalRisk: 'safe',
    hepaticRisk: 'safe',
    cardiacRisk: 'caution',
    sideEffects: { common: ['Tachycardia', 'Palpitations', 'Tremor', 'Anxiety'], serious: ['Ventricular arrhythmias', 'Cerebral haemorrhage', 'Pulmonary oedema'] },
    interactions: [{ drug: 'Beta-blockers', severity: 'major', effect: 'Severe hypertension and reflex bradycardia' }],
    precautions: ['IM into anterolateral thigh', 'NEVER give 1:1000 IV', 'Repeat after 5 min if no improvement'],
    instructions: 'ANAPHYLAXIS: 0.5mg (0.5mL of 1:1000) IM anterolateral thigh. Repeat after 5 min if no improvement. CARDIAC ARREST: 1mg (10mL of 1:10000) IV.',
  },
  {
    id: 'naloxone',
    genericName: 'Naloxone Hydrochloride',
    brandNames: ['Narcan'],
    category: 'CNS - Opioid Antagonists',
    formulations: [{ form: 'Injection 0.4mg/mL', strength: '0.4mg/mL', route: 'IV' }],
    dosage: { adult: { standard: '0.4-2mg', min: '0.1mg', max: '2mg', frequency: ['stat', 'prn'], notes: 'Repeat every 2-3 min. Max total 10mg.' } },
    maxDailyDose: '10mg',
    contraindications: [],
    pregnancyCategory: 'B',
    lactationSafety: 'safe',
    renalRisk: 'safe',
    hepaticRisk: 'safe',
    cardiacRisk: 'safe',
    sideEffects: { common: ['Nausea', 'Vomiting', 'Tachycardia'], serious: ['Acute opioid withdrawal', 'Pulmonary oedema', 'Cardiac arrest'] },
    interactions: [],
    precautions: ['Short duration (30-90min) - may need repeat dosing or infusion', 'Monitor for re-sedation'],
    instructions: 'For opioid overdose/respiratory depression. Start with 0.4mg IV. May repeat every 2-3 minutes. Short-acting - monitor for re-sedation.',
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // VITAMINS & SUPPLEMENTS - ADDITIONAL
  // ═══════════════════════════════════════════════════════════════════════════
  {
    id: 'folic_acid',
    genericName: 'Folic Acid',
    brandNames: ['Folic Acid', 'Folate'],
    category: 'Vitamins & Supplements',
    formulations: [{ form: 'Tablet 5mg', strength: '5mg', route: 'oral' }],
    dosage: { adult: { standard: '5mg', min: '400mcg', max: '5mg', frequency: ['od'] } },
    maxDailyDose: '5mg',
    contraindications: [],
    pregnancyCategory: 'A',
    pregnancyNotes: 'Essential periconception for neural tube defect prevention',
    lactationSafety: 'safe',
    renalRisk: 'safe',
    hepaticRisk: 'safe',
    cardiacRisk: 'safe',
    sideEffects: { common: [], serious: [] },
    interactions: [{ drug: 'Phenytoin', severity: 'moderate', effect: 'Reduced phenytoin levels' }],
    precautions: ['May mask vitamin B12 deficiency in megaloblastic anaemia'],
  },
  {
    id: 'zinc_sulfate',
    genericName: 'Zinc Sulfate',
    brandNames: ['Zinc', 'ZinCfant'],
    category: 'Vitamins & Supplements',
    formulations: [{ form: 'Tablet 20mg', strength: '20mg', route: 'oral' }, { form: 'Syrup 10mg/5mL', strength: '10mg/5mL', route: 'oral' }],
    dosage: { adult: { standard: '20-40mg', min: '20mg', max: '220mg', frequency: ['od', 'tds'] } },
    maxDailyDose: '220mg',
    contraindications: [],
    pregnancyCategory: 'A',
    lactationSafety: 'safe',
    renalRisk: 'safe',
    hepaticRisk: 'safe',
    cardiacRisk: 'safe',
    sideEffects: { common: ['Nausea', 'GI disturbance'], serious: ['Copper deficiency (prolonged high doses)'] },
    interactions: [{ drug: 'Ciprofloxacin', severity: 'moderate', effect: 'Reduced quinolone absorption' }],
    precautions: ['Important for wound healing', 'Take 1hr before or 2hrs after meals'],
    instructions: 'Important for wound healing. Take with food if GI upset occurs.',
  },
  {
    id: 'calcium_gluconate',
    genericName: 'Calcium Gluconate',
    brandNames: ['Calcium Gluconate'],
    category: 'Vitamins & Supplements',
    formulations: [{ form: 'Tablet 500mg', strength: '500mg', route: 'oral' }, { form: 'Injection 10% (10mL amp)', strength: '100mg/mL', route: 'IV' }],
    dosage: { adult: { standard: '1-2 tablets PO; 10mL of 10% IV', min: '500mg PO', max: '2g PO', frequency: ['tds'] } },
    maxDailyDose: '4g PO',
    contraindications: ['Hypercalcaemia', 'Severe renal impairment'],
    pregnancyCategory: 'A',
    lactationSafety: 'safe',
    renalRisk: 'monitor',
    hepaticRisk: 'safe',
    cardiacRisk: 'caution',
    sideEffects: { common: ['Constipation', 'Nausea'], serious: ['Hypercalcaemia', 'Cardiac arrhythmias (rapid IV)'] },
    interactions: [{ drug: 'Digoxin', severity: 'major', effect: 'Hypercalcaemia increases digoxin toxicity' }, { drug: 'Levothyroxine', severity: 'moderate', effect: 'Reduced absorption' }],
    precautions: ['IV: Give slowly over 5-10 min', 'Antidote for MgSO4 toxicity and hyperkalaemia'],
  },
  {
    id: 'multivitamin',
    genericName: 'Multivitamin Tablets',
    brandNames: ['Multivite', 'Centrum'],
    category: 'Vitamins & Supplements',
    formulations: [{ form: 'Tablet', strength: '1 tablet', route: 'oral' }],
    dosage: { adult: { standard: '1 tablet', min: '1 tablet', max: '1 tablet', frequency: ['od'] } },
    maxDailyDose: '1 tablet',
    contraindications: [],
    pregnancyCategory: 'A',
    lactationSafety: 'safe',
    renalRisk: 'safe',
    hepaticRisk: 'safe',
    cardiacRisk: 'safe',
    sideEffects: { common: ['Mild GI upset'], serious: [] },
    interactions: [],
    precautions: [],
  },
  {
    id: 'vitamin_b_complex',
    genericName: 'Vitamin B Complex',
    brandNames: ['B-Complex', 'Becosules'],
    category: 'Vitamins & Supplements',
    formulations: [{ form: 'Tablet', strength: '1 tablet', route: 'oral' }, { form: 'Injection', strength: '1 ampoule', route: 'IM' }],
    dosage: { adult: { standard: '1-2 tablets', min: '1 tablet', max: '2 tablets', frequency: ['od', 'tds'] } },
    maxDailyDose: '6 tablets',
    contraindications: [],
    pregnancyCategory: 'A',
    lactationSafety: 'safe',
    renalRisk: 'safe',
    hepaticRisk: 'safe',
    cardiacRisk: 'safe',
    sideEffects: { common: ['Yellow discolouration of urine'], serious: [] },
    interactions: [],
    precautions: [],
  },
  {
    id: 'potassium_chloride',
    genericName: 'Potassium Chloride',
    brandNames: ['Slow-K', 'KCl'],
    category: 'Fluids & Electrolytes',
    formulations: [{ form: 'SR Tablet 600mg (8mmol)', strength: '600mg', route: 'oral' }, { form: 'IV Solution (various concentrations)', strength: 'variable', route: 'IV' }],
    dosage: { adult: { standard: '600mg-1.2g (8-16mmol)', min: '600mg', max: '2.4g', frequency: ['bd', 'tds'] } },
    maxDailyDose: '200mmol (with ECG monitoring for IV)',
    contraindications: ['Hyperkalaemia', 'Severe renal impairment', 'Addison disease'],
    pregnancyCategory: 'C',
    lactationSafety: 'safe',
    renalRisk: 'avoid',
    hepaticRisk: 'safe',
    cardiacRisk: 'monitor',
    sideEffects: { common: ['Nausea', 'GI discomfort'], serious: ['Hyperkalaemia', 'Cardiac arrest (rapid IV)'] },
    interactions: [{ drug: 'ACE inhibitors', severity: 'major', effect: 'Hyperkalaemia risk' }, { drug: 'Spironolactone', severity: 'major', effect: 'Hyperkalaemia risk' }],
    precautions: ['NEVER give undiluted IV bolus', 'Max rate: 20mmol/hr IV', 'ECG monitoring for IV >10mmol/hr'],
    monitoringRequired: ['Serum potassium', 'ECG if IV'],
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // DERMATOLOGY - ADDITIONAL
  // ═══════════════════════════════════════════════════════════════════════════
  {
    id: 'betamethasone_cream',
    genericName: 'Betamethasone Valerate Cream',
    brandNames: ['Betnovate', 'Celestoderm'],
    category: 'Dermatology',
    formulations: [{ form: 'Cream 0.1%', strength: '0.1%', route: 'topical' }, { form: 'Ointment 0.1%', strength: '0.1%', route: 'topical' }],
    dosage: { adult: { standard: 'Apply thinly BD', min: 'Apply OD', max: 'Apply BD', frequency: ['bd'] } },
    maxDailyDose: 'Apply thinly twice daily',
    contraindications: ['Untreated skin infections', 'Rosacea', 'Perioral dermatitis'],
    pregnancyCategory: 'C',
    lactationSafety: 'caution',
    renalRisk: 'safe',
    hepaticRisk: 'safe',
    cardiacRisk: 'safe',
    sideEffects: { common: ['Skin thinning (prolonged use)', 'Telangiectasia'], serious: ['Adrenal suppression (extensive use)', 'Cushing syndrome'] },
    interactions: [],
    precautions: ['Avoid prolonged use on face', 'Use weakest effective strength', 'Max 2 weeks on face'],
  },
  {
    id: 'clotrimazole_cream',
    genericName: 'Clotrimazole Cream',
    brandNames: ['Canesten', 'Lotrimin'],
    category: 'Dermatology',
    formulations: [{ form: 'Cream 1%', strength: '1%', route: 'topical' }, { form: 'Pessary 500mg', strength: '500mg', route: 'rectal' }],
    dosage: { adult: { standard: 'Apply BD-TDS for 2-4 weeks', min: 'Apply BD', max: 'Apply TDS', frequency: ['bd', 'tds'] } },
    maxDailyDose: 'Apply three times daily',
    contraindications: [],
    pregnancyCategory: 'B',
    lactationSafety: 'safe',
    renalRisk: 'safe',
    hepaticRisk: 'safe',
    cardiacRisk: 'safe',
    sideEffects: { common: ['Local irritation', 'Burning sensation'], serious: [] },
    interactions: [],
    precautions: ['Complete full course', 'Keep area clean and dry'],
  },
  {
    id: 'fusidic_acid_cream',
    genericName: 'Fusidic Acid Cream/Ointment',
    brandNames: ['Fucidin'],
    category: 'Dermatology',
    formulations: [{ form: 'Cream 2%', strength: '2%', route: 'topical' }, { form: 'Ointment 2%', strength: '2%', route: 'topical' }],
    dosage: { adult: { standard: 'Apply TDS-QDS', min: 'Apply TDS', max: 'Apply QDS', frequency: ['tds', 'qds'], duration: '7-10 days' } },
    maxDailyDose: 'Apply up to 4 times daily',
    contraindications: [],
    pregnancyCategory: 'B',
    lactationSafety: 'safe',
    renalRisk: 'safe',
    hepaticRisk: 'safe',
    cardiacRisk: 'safe',
    sideEffects: { common: ['Local irritation', 'Rash'], serious: ['Resistance with prolonged use'] },
    interactions: [],
    precautions: ['Limit use to 10 days to avoid resistance', 'Effective against Staph. aureus'],
  },
  {
    id: 'calamine_lotion',
    genericName: 'Calamine Lotion',
    brandNames: ['Calamine'],
    category: 'Dermatology',
    formulations: [{ form: 'Lotion', strength: 'Standard', route: 'topical' }],
    dosage: { adult: { standard: 'Apply PRN', min: 'Apply OD', max: 'Apply as needed', frequency: ['prn'] } },
    maxDailyDose: 'As needed',
    contraindications: [],
    pregnancyCategory: 'A',
    lactationSafety: 'safe',
    renalRisk: 'safe',
    hepaticRisk: 'safe',
    cardiacRisk: 'safe',
    sideEffects: { common: ['Skin dryness'], serious: [] },
    interactions: [],
    precautions: ['Shake well before use', 'For symptomatic relief of pruritus'],
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // ANTISEPTICS & DISINFECTANTS
  // ═══════════════════════════════════════════════════════════════════════════
  {
    id: 'povidone_iodine',
    genericName: 'Povidone-Iodine',
    brandNames: ['Betadine', 'Wokadine'],
    category: 'Antiseptics & Disinfectants',
    formulations: [{ form: 'Solution 10%', strength: '10%', route: 'topical' }, { form: 'Scrub 7.5%', strength: '7.5%', route: 'topical' }, { form: 'Ointment 5%', strength: '5%', route: 'topical' }],
    dosage: { adult: { standard: 'Apply as needed', min: 'Apply OD', max: 'Apply as needed', frequency: ['prn'] } },
    maxDailyDose: 'As needed',
    contraindications: ['Iodine allergy', 'Thyroid disorders (large/prolonged application)'],
    pregnancyCategory: 'D',
    lactationSafety: 'caution',
    renalRisk: 'safe',
    hepaticRisk: 'safe',
    cardiacRisk: 'safe',
    sideEffects: { common: ['Local irritation', 'Staining'], serious: ['Thyroid dysfunction (prolonged large-area use)', 'Iodism'] },
    interactions: [],
    precautions: ['Avoid in neonates', 'Not for deep cavity wounds'],
  },
  {
    id: 'chlorhexidine',
    genericName: 'Chlorhexidine Gluconate',
    brandNames: ['Savlon', 'Hibiscrub', 'Hibitane'],
    category: 'Antiseptics & Disinfectants',
    formulations: [{ form: 'Solution 0.05%', strength: '0.05%', route: 'topical' }, { form: 'Scrub 4%', strength: '4%', route: 'topical' }, { form: 'Mouthwash 0.2%', strength: '0.2%', route: 'oral' }],
    dosage: { adult: { standard: 'Apply as needed', min: 'Apply OD', max: 'As needed', frequency: ['prn'] } },
    maxDailyDose: 'As needed',
    contraindications: ['Not for use in ears, eyes, or brain/meninges'],
    pregnancyCategory: 'B',
    lactationSafety: 'safe',
    renalRisk: 'safe',
    hepaticRisk: 'safe',
    cardiacRisk: 'safe',
    sideEffects: { common: ['Skin irritation', 'Taste disturbance (mouthwash)'], serious: ['Anaphylaxis (rare)', 'Chemical burns (concentrated solutions)'] },
    interactions: [],
    precautions: ['Avoid contact with eyes and ears', 'Preferred surgical hand scrub'],
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // OPHTHALMIC
  // ═══════════════════════════════════════════════════════════════════════════
  {
    id: 'chloramphenicol_eye',
    genericName: 'Chloramphenicol Eye Drops/Ointment',
    brandNames: ['Chloromycetin Eye'],
    category: 'Ophthalmic',
    formulations: [{ form: 'Eye Drops 0.5%', strength: '0.5%', route: 'ophthalmic' }, { form: 'Eye Ointment 1%', strength: '1%', route: 'ophthalmic' }],
    dosage: { adult: { standard: '1 drop every 2hrs initially then QDS', min: '1 drop QDS', max: '1 drop every 2hrs', frequency: ['qds'], duration: '5-7 days' } },
    maxDailyDose: '1 drop every 2 hours',
    contraindications: ['Known hypersensitivity'],
    pregnancyCategory: 'C',
    lactationSafety: 'safe',
    renalRisk: 'safe',
    hepaticRisk: 'safe',
    cardiacRisk: 'safe',
    sideEffects: { common: ['Transient stinging', 'Blurred vision'], serious: ['Aplastic anaemia (systemic - very rare with topical)'] },
    interactions: [],
    precautions: ['Discard 28 days after opening', 'Apply ointment at night, drops during day'],
    instructions: 'Pull down lower eyelid and instil 1 drop. Apply ointment at night. Discard 28 days after opening.',
  },
  {
    id: 'tetracaine_eye',
    genericName: 'Tetracaine (Amethocaine) Eye Drops',
    brandNames: ['Minims Tetracaine'],
    category: 'Ophthalmic',
    formulations: [{ form: 'Eye Drops 0.5%', strength: '0.5%', route: 'ophthalmic' }, { form: 'Eye Drops 1%', strength: '1%', route: 'ophthalmic' }],
    dosage: { adult: { standard: '1-2 drops', min: '1 drop', max: '2 drops', frequency: ['stat'] } },
    maxDailyDose: 'Single use for procedures',
    contraindications: ['Not for prolonged use'],
    pregnancyCategory: 'C',
    lactationSafety: 'safe',
    renalRisk: 'safe',
    hepaticRisk: 'safe',
    cardiacRisk: 'safe',
    sideEffects: { common: ['Stinging on application', 'Blurred vision'], serious: ['Corneal toxicity (repeated use)'] },
    interactions: [],
    precautions: ['For examination/procedures only', 'NEVER prescribe for patient self-administration', 'Onset: 30 sec, Duration: 15-20 min'],
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // BLOOD PRODUCTS & PLASMA EXPANDERS
  // ═══════════════════════════════════════════════════════════════════════════
  {
    id: 'gelofusine',
    genericName: 'Gelofusine (Succinylated Gelatin)',
    brandNames: ['Gelofusine'],
    category: 'Blood Products & Plasma Expanders',
    formulations: [{ form: 'IV Solution 500mL', strength: '4%', route: 'IV' }],
    dosage: { adult: { standard: '500-1000mL', min: '500mL', max: '2000mL', frequency: ['prn'] } },
    maxDailyDose: '2000mL',
    contraindications: ['Severe cardiac failure', 'Known gelatin allergy'],
    pregnancyCategory: 'C',
    lactationSafety: 'safe',
    renalRisk: 'caution' as any,
    hepaticRisk: 'safe',
    cardiacRisk: 'caution',
    sideEffects: { common: ['Nausea', 'Urticaria'], serious: ['Anaphylaxis', 'Coagulopathy (large volumes)'] },
    interactions: [],
    precautions: ['Monitor for allergic reactions', 'May interfere with cross-matching'],
  },
  {
    id: 'dextrose_5',
    genericName: 'Dextrose 5% (Glucose 5%)',
    brandNames: ['D5W', '5% Dextrose'],
    category: 'Fluids & Electrolytes',
    formulations: [{ form: 'IV Solution 500mL', strength: '5%', route: 'IV' }, { form: 'IV Solution 1000mL', strength: '5%', route: 'IV' }],
    dosage: { adult: { standard: '500-1000mL', min: '500mL', max: '3000mL', frequency: ['prn'], notes: 'Rate depends on clinical indication' } },
    maxDailyDose: '3000mL',
    contraindications: ['Hyperglycaemia'],
    pregnancyCategory: 'A',
    lactationSafety: 'safe',
    renalRisk: 'safe',
    hepaticRisk: 'safe',
    cardiacRisk: 'caution',
    sideEffects: { common: ['Hyperglycaemia', 'Fluid overload'], serious: ['Hyponatraemia (dilutional)', 'Cerebral oedema'] },
    interactions: [],
    precautions: ['Monitor blood glucose', 'Not for resuscitation - distributes to all compartments'],
  },
  {
    id: 'dextrose_50',
    genericName: 'Dextrose 50% (Glucose 50%)',
    brandNames: ['D50W'],
    category: 'Emergency Drugs',
    formulations: [{ form: 'IV Solution 50mL', strength: '50%', route: 'IV' }],
    dosage: { adult: { standard: '50mL (25g)', min: '25mL', max: '50mL', frequency: ['stat'] } },
    maxDailyDose: 'As clinically indicated',
    contraindications: [],
    pregnancyCategory: 'A',
    lactationSafety: 'safe',
    renalRisk: 'safe',
    hepaticRisk: 'safe',
    cardiacRisk: 'safe',
    sideEffects: { common: ['Hyperglycaemia', 'Phlebitis'], serious: ['Tissue necrosis if extravasated'] },
    interactions: [],
    precautions: ['For hypoglycaemia emergency', 'Give through large-bore IV cannula', 'Avoid extravasation'],
    instructions: 'For hypoglycaemia. Give 50mL of 50% dextrose IV through large-bore cannula. Check blood glucose after 15 minutes.',
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // MUSCULOSKELETAL - ANTIGOUT
  // ═══════════════════════════════════════════════════════════════════════════
  {
    id: 'allopurinol',
    genericName: 'Allopurinol',
    brandNames: ['Zyloric'],
    category: 'Musculoskeletal - Antigout',
    formulations: [{ form: 'Tablet 100mg', strength: '100mg', route: 'oral' }, { form: 'Tablet 300mg', strength: '300mg', route: 'oral' }],
    dosage: { adult: { standard: '100-300mg', min: '100mg', max: '900mg', frequency: ['od'] } },
    maxDailyDose: '900mg',
    contraindications: ['Acute gout attack (do not initiate)'],
    pregnancyCategory: 'C',
    lactationSafety: 'caution',
    renalRisk: 'dose_adjust',
    hepaticRisk: 'safe',
    cardiacRisk: 'safe',
    sideEffects: { common: ['Rash', 'GI disturbance'], serious: ['Severe hypersensitivity (SJS/TEN/DRESS)', 'Hepatotoxicity'] },
    interactions: [{ drug: 'Azathioprine', severity: 'major', effect: 'Severe bone marrow suppression - reduce azathioprine dose by 75%' }, { drug: 'Warfarin', severity: 'moderate', effect: 'Increased anticoagulant effect' }],
    precautions: ['Start low (100mg)', 'Increase slowly', 'Do not start during acute attack', 'HLA-B*5801 testing recommended in certain populations'],
    monitoringRequired: ['Uric acid levels', 'Renal function', 'LFTs'],
  },
  {
    id: 'colchicine',
    genericName: 'Colchicine',
    brandNames: ['Colchicine'],
    category: 'Musculoskeletal - Antigout',
    formulations: [{ form: 'Tablet 500mcg', strength: '500mcg', route: 'oral' }],
    dosage: { adult: { standard: '500mcg BD-TDS', min: '500mcg', max: '1.5mg', frequency: ['bd', 'tds'], duration: 'Until attack resolves or side effects' } },
    maxDailyDose: '1.5mg (acute); 1mg (prophylaxis)',
    contraindications: ['Blood dyscrasias', 'Severe renal/hepatic impairment'],
    pregnancyCategory: 'D',
    lactationSafety: 'avoid',
    renalRisk: 'dose_adjust',
    hepaticRisk: 'dose_adjust',
    cardiacRisk: 'safe',
    sideEffects: { common: ['Diarrhoea', 'Nausea', 'Abdominal pain'], serious: ['Bone marrow suppression', 'Peripheral neuropathy', 'Rhabdomyolysis'] },
    interactions: [{ drug: 'Statins', severity: 'moderate', effect: 'Increased myopathy risk' }],
    precautions: ['Stop at first sign of diarrhoea', 'Narrow therapeutic index'],
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // ADDITIONAL ANTIFUNGALS
  // ═══════════════════════════════════════════════════════════════════════════
  {
    id: 'nystatin',
    genericName: 'Nystatin',
    brandNames: ['Mycostatin', 'Nystatin'],
    category: 'Antifungals',
    formulations: [{ form: 'Oral Suspension 100000units/mL', strength: '100000units/mL', route: 'oral' }, { form: 'Cream', strength: '100000units/g', route: 'topical' }, { form: 'Pessary 100000units', strength: '100000units', route: 'rectal' }],
    dosage: { adult: { standard: '1mL (100000units) QDS', min: '1mL', max: '5mL', frequency: ['qds'], duration: '7-14 days' } },
    maxDailyDose: '20mL oral',
    contraindications: [],
    pregnancyCategory: 'A',
    lactationSafety: 'safe',
    renalRisk: 'safe',
    hepaticRisk: 'safe',
    cardiacRisk: 'safe',
    sideEffects: { common: ['Nausea', 'GI disturbance'], serious: [] },
    interactions: [],
    precautions: ['Hold in mouth and swish before swallowing for oral thrush', 'Not absorbed systemically'],
    instructions: 'For oral thrush: Hold in mouth, swish for 1 minute, then swallow. Continue for 48hrs after symptoms resolve.',
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // ADDITIONAL ANTIVIRALS
  // ═══════════════════════════════════════════════════════════════════════════
  {
    id: 'aciclovir',
    genericName: 'Aciclovir (Acyclovir)',
    brandNames: ['Zovirax'],
    category: 'Antivirals',
    formulations: [{ form: 'Tablet 200mg', strength: '200mg', route: 'oral' }, { form: 'Tablet 400mg', strength: '400mg', route: 'oral' }, { form: 'Tablet 800mg', strength: '800mg', route: 'oral' }, { form: 'Injection 250mg vial', strength: '250mg', route: 'IV' }, { form: 'Cream 5%', strength: '5%', route: 'topical' }],
    dosage: { adult: { standard: 'Herpes simplex: 200mg QDS-5x/day; Herpes zoster: 800mg 5x/day', min: '200mg', max: '800mg', frequency: ['qds'], duration: '5-7 days' } },
    maxDailyDose: '4g (oral)',
    contraindications: [],
    pregnancyCategory: 'B',
    lactationSafety: 'caution',
    renalRisk: 'dose_adjust',
    hepaticRisk: 'safe',
    cardiacRisk: 'safe',
    sideEffects: { common: ['Nausea', 'Headache', 'Rash'], serious: ['Renal failure (IV - ensure hydration)', 'Neurotoxicity', 'Thrombotic microangiopathy'] },
    interactions: [],
    precautions: ['Maintain adequate hydration', 'Dose reduce in renal impairment', 'Start within 72hrs of onset for shingles'],
    monitoringRequired: ['Renal function (IV use)'],
    instructions: 'Take with plenty of water. For shingles: start within 72 hours of rash onset for best results.',
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // ADDITIONAL MUSCLE RELAXANTS
  // ═══════════════════════════════════════════════════════════════════════════
  {
    id: 'baclofen',
    genericName: 'Baclofen',
    brandNames: ['Lioresal'],
    category: 'Muscle Relaxants',
    formulations: [{ form: 'Tablet 10mg', strength: '10mg', route: 'oral' }],
    dosage: { adult: { standard: '5mg TDS initially', min: '5mg', max: '100mg', frequency: ['tds'], notes: 'Increase by 5mg every 3 days' } },
    maxDailyDose: '100mg',
    contraindications: ['Peptic ulcer'],
    pregnancyCategory: 'C',
    lactationSafety: 'caution',
    renalRisk: 'dose_adjust',
    hepaticRisk: 'safe',
    cardiacRisk: 'safe',
    sideEffects: { common: ['Drowsiness', 'Muscle weakness', 'Nausea', 'Dizziness'], serious: ['Seizures (abrupt withdrawal)', 'Respiratory depression', 'Hallucinations'] },
    interactions: [{ drug: 'Antihypertensives', severity: 'moderate', effect: 'Enhanced hypotension' }],
    precautions: ['Do not stop abruptly - taper gradually', 'Avoid alcohol'],
  },
  {
    id: 'tizanidine',
    genericName: 'Tizanidine',
    brandNames: ['Zanaflex', 'Sirdalud'],
    category: 'Muscle Relaxants',
    formulations: [{ form: 'Tablet 2mg', strength: '2mg', route: 'oral' }, { form: 'Tablet 4mg', strength: '4mg', route: 'oral' }],
    dosage: { adult: { standard: '2-4mg', min: '2mg', max: '36mg', frequency: ['tds'] } },
    maxDailyDose: '36mg',
    contraindications: ['Severe hepatic impairment'],
    pregnancyCategory: 'C',
    lactationSafety: 'avoid',
    renalRisk: 'dose_adjust',
    hepaticRisk: 'avoid',
    cardiacRisk: 'safe',
    sideEffects: { common: ['Drowsiness', 'Dry mouth', 'Dizziness', 'Hypotension'], serious: ['Hepatotoxicity', 'QT prolongation'] },
    interactions: [{ drug: 'Ciprofloxacin', severity: 'major', effect: 'Increased tizanidine levels' }],
    precautions: ['Monitor LFTs', 'Do not stop abruptly'],
    monitoringRequired: ['LFTs at 1, 3, 6 months then periodically'],
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // IMMUNOSUPPRESSANTS
  // ═══════════════════════════════════════════════════════════════════════════
  {
    id: 'methotrexate',
    genericName: 'Methotrexate',
    brandNames: ['Trexall'],
    category: 'Immunosuppressants',
    formulations: [{ form: 'Tablet 2.5mg', strength: '2.5mg', route: 'oral' }, { form: 'Injection 25mg/mL', strength: '25mg/mL', route: 'SC' }],
    dosage: { adult: { standard: '7.5-25mg ONCE WEEKLY', min: '7.5mg', max: '25mg', frequency: ['weekly'] } },
    maxDailyDose: '25mg PER WEEK',
    contraindications: ['Pregnancy', 'Breastfeeding', 'Severe hepatic/renal impairment', 'Blood dyscrasias', 'Active infection'],
    pregnancyCategory: 'X',
    pregnancyNotes: 'HIGHLY TERATOGENIC. Stop 3 months before conception (both sexes).',
    lactationSafety: 'avoid',
    renalRisk: 'avoid',
    hepaticRisk: 'avoid',
    cardiacRisk: 'safe',
    sideEffects: { common: ['Nausea', 'Stomatitis', 'Fatigue', 'Myelosuppression'], serious: ['Pneumonitis', 'Hepatic fibrosis', 'Pancytopenia', 'Infection'] },
    interactions: [{ drug: 'NSAIDs', severity: 'major', effect: 'Increased methotrexate toxicity' }, { drug: 'Co-trimoxazole', severity: 'major', effect: 'Severe pancytopenia' }],
    precautions: ['ONCE WEEKLY DOSING ONLY - daily dosing is fatal', 'Take folic acid 5mg on non-methotrexate days', 'Avoid alcohol'],
    monitoringRequired: ['FBC', 'LFTs', 'U&E', 'CXR annually'],
    instructions: 'TAKE ONCE A WEEK ONLY - NOT DAILY. Take folic acid 5mg on a different day. Report sore throat, fever, unusual bleeding.',
  },
  {
    id: 'azathioprine',
    genericName: 'Azathioprine',
    brandNames: ['Imuran'],
    category: 'Immunosuppressants',
    formulations: [{ form: 'Tablet 25mg', strength: '25mg', route: 'oral' }, { form: 'Tablet 50mg', strength: '50mg', route: 'oral' }],
    dosage: { adult: { standard: '1-3mg/kg/day', min: '50mg', max: '250mg', frequency: ['od', 'bd'] } },
    maxDailyDose: '3mg/kg',
    contraindications: ['Pregnancy (relative)', 'Concurrent allopurinol without dose reduction'],
    pregnancyCategory: 'D',
    lactationSafety: 'avoid',
    renalRisk: 'dose_adjust',
    hepaticRisk: 'dose_adjust',
    cardiacRisk: 'safe',
    sideEffects: { common: ['Nausea', 'Myelosuppression', 'Susceptibility to infections'], serious: ['Severe pancytopenia', 'Hepatotoxicity', 'Lymphoma (long-term)'] },
    interactions: [{ drug: 'Allopurinol', severity: 'major', effect: 'Reduce azathioprine dose by 75% or use alternative' }],
    precautions: ['TPMT testing before starting', 'Regular FBC monitoring'],
    monitoringRequired: ['FBC weekly for 4 weeks then monthly', 'LFTs'],
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // PROMETHAZINE (ANTIHISTAMINE/SEDATIVE)
  // ═══════════════════════════════════════════════════════════════════════════
  {
    id: 'promethazine',
    genericName: 'Promethazine Hydrochloride',
    brandNames: ['Phenergan'],
    category: 'Antihistamines',
    formulations: [{ form: 'Tablet 10mg', strength: '10mg', route: 'oral' }, { form: 'Tablet 25mg', strength: '25mg', route: 'oral' }, { form: 'Injection 25mg/mL', strength: '25mg/mL', route: 'IM' }],
    dosage: { adult: { standard: '25mg', min: '10mg', max: '75mg', frequency: ['nocte', 'bd', 'tds'] } },
    maxDailyDose: '75mg',
    contraindications: ['Children <2 years', 'Coma', 'CNS depression'],
    pregnancyCategory: 'C',
    lactationSafety: 'caution',
    renalRisk: 'safe',
    hepaticRisk: 'dose_adjust',
    cardiacRisk: 'safe',
    sideEffects: { common: ['Drowsiness', 'Dry mouth', 'Blurred vision'], serious: ['Respiratory depression (children)', 'Extrapyramidal effects'] },
    interactions: [{ drug: 'CNS depressants', severity: 'moderate', effect: 'Enhanced sedation' }],
    precautions: ['Sedating - warn about driving', 'Also used as antiemetic and for sedation'],
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // MIDAZOLAM (CNS)
  // ═══════════════════════════════════════════════════════════════════════════
  {
    id: 'midazolam',
    genericName: 'Midazolam',
    brandNames: ['Dormicum', 'Versed'],
    category: 'CNS - Anxiolytics & Sedatives',
    formulations: [{ form: 'Injection 5mg/5mL', strength: '1mg/mL', route: 'IV' }, { form: 'Injection 15mg/3mL', strength: '5mg/mL', route: 'IM' }, { form: 'Buccal Solution 10mg/mL', strength: '10mg/mL', route: 'oral' }],
    dosage: { adult: { standard: 'Sedation: 1-2.5mg IV', min: '0.5mg', max: '7.5mg', frequency: ['stat', 'prn'] } },
    maxDailyDose: '7.5mg (procedural sedation)',
    contraindications: ['Severe respiratory depression', 'Acute pulmonary insufficiency', 'Sleep apnoea'],
    pregnancyCategory: 'D',
    lactationSafety: 'avoid',
    renalRisk: 'safe',
    hepaticRisk: 'dose_adjust',
    cardiacRisk: 'caution',
    sideEffects: { common: ['Drowsiness', 'Respiratory depression', 'Amnesia', 'Hypotension'], serious: ['Respiratory arrest', 'Paradoxical agitation'] },
    interactions: [{ drug: 'Opioids', severity: 'major', effect: 'Profound respiratory depression' }],
    precautions: ['Must have resuscitation equipment available', 'Have flumazenil ready as reversal agent', 'Reduced dose in elderly'],
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // NEOSTIGMINE
  // ═══════════════════════════════════════════════════════════════════════════
  {
    id: 'neostigmine',
    genericName: 'Neostigmine',
    brandNames: ['Prostigmin'],
    category: 'Muscle Relaxants',
    formulations: [{ form: 'Injection 2.5mg/mL', strength: '2.5mg/mL', route: 'IV' }],
    dosage: { adult: { standard: '2.5mg IV (with glycopyrrolate 0.5mg)', min: '1mg', max: '5mg', frequency: ['stat'] } },
    maxDailyDose: '5mg',
    contraindications: ['Intestinal/urinary obstruction', 'Peritonitis'],
    pregnancyCategory: 'C',
    lactationSafety: 'safe',
    renalRisk: 'safe',
    hepaticRisk: 'safe',
    cardiacRisk: 'caution',
    sideEffects: { common: ['Bradycardia', 'Salivation', 'Nausea', 'Abdominal cramps'], serious: ['Severe bradycardia', 'Bronchospasm'] },
    interactions: [],
    precautions: ['Always give with anticholinergic (glycopyrrolate/atropine)', 'Used for reversal of non-depolarizing neuromuscular block'],
  },
];

// ─── HELPER FUNCTIONS ───────────────────────────────────────────────────────

/** Get all unique drug categories */
export function getDrugCategories(): DrugCategory[] {
  const categories = new Set<DrugCategory>();
  BNF_DRUG_DATABASE.forEach(drug => categories.add(drug.category));
  return Array.from(categories).sort();
}

/** Search drugs by name or generic name */
export function searchDrugs(query: string): BNFDrug[] {
  const lowerQuery = query.toLowerCase().trim();
  if (!lowerQuery) return [];
  return BNF_DRUG_DATABASE.filter(drug =>
    drug.genericName.toLowerCase().includes(lowerQuery) ||
    drug.brandNames.some(brand => brand.toLowerCase().includes(lowerQuery)) ||
    drug.category.toLowerCase().includes(lowerQuery) ||
    drug.id.includes(lowerQuery)
  );
}

/** Get drugs by category */
export function getDrugsByCategory(category: DrugCategory): BNFDrug[] {
  return BNF_DRUG_DATABASE.filter(drug => drug.category === category);
}

/** Get drug by ID */
export function getDrugById(id: string): BNFDrug | undefined {
  return BNF_DRUG_DATABASE.find(drug => drug.id === id);
}

/** Get frequency display label */
export function getFrequencyLabel(freq: DrugFrequency): string {
  const labels: Record<DrugFrequency, string> = {
    stat: 'Stat (once)',
    od: 'OD (once daily)',
    bd: 'BD (twice daily)',
    tds: 'TDS (three times daily)',
    qds: 'QDS (four times daily)',
    prn: 'PRN (as needed)',
    nocte: 'Nocte (at night)',
    mane: 'Mane (in the morning)',
    q3h: 'Every 3 hours',
    q4h: 'Every 4 hours',
    q6h: 'Every 6 hours',
    q8h: 'Every 8 hours',
    q12h: 'Every 12 hours',
    weekly: 'Weekly',
    alternate_days: 'Alternate days',
  };
  return labels[freq] || freq;
}

/** Get route display label */
export function getRouteLabel(route: DrugRoute): string {
  const labels: Record<DrugRoute, string> = {
    oral: 'Oral (PO)',
    IV: 'Intravenous (IV)',
    IM: 'Intramuscular (IM)',
    SC: 'Subcutaneous (SC)',
    topical: 'Topical',
    rectal: 'Rectal (PR)',
    inhaled: 'Inhaled',
    sublingual: 'Sublingual (SL)',
    intrathecal: 'Intrathecal',
    ophthalmic: 'Ophthalmic',
  };
  return labels[route] || route;
}

/** Generate patient-specific warnings based on patient data */
export function generatePatientWarnings(
  drug: BNFDrug,
  patientData: {
    sex?: string;
    pregnant?: boolean;
    lactating?: boolean;
    age?: number;
    weight?: number;
    gfr?: number;
    hepaticImpairment?: boolean;
    cardiacDisease?: boolean;
    allergies?: string[];
    comorbidities?: string[];
    currentMedications?: string[];
  }
): { level: 'danger' | 'warning' | 'info'; message: string }[] {
  const warnings: { level: 'danger' | 'warning' | 'info'; message: string }[] = [];

  // Pregnancy warnings
  if (patientData.pregnant) {
    if (drug.pregnancyCategory === 'X') {
      warnings.push({ level: 'danger', message: `CONTRAINDICATED IN PREGNANCY (Category X). ${drug.pregnancyNotes || ''}` });
    } else if (drug.pregnancyCategory === 'D') {
      warnings.push({ level: 'danger', message: `HIGH RISK IN PREGNANCY (Category D). ${drug.pregnancyNotes || ''}` });
    } else if (drug.pregnancyCategory === 'C') {
      warnings.push({ level: 'warning', message: `Use with caution in pregnancy (Category C). ${drug.pregnancyNotes || ''}` });
    } else {
      warnings.push({ level: 'info', message: `Pregnancy Category ${drug.pregnancyCategory}. ${drug.pregnancyNotes || ''}` });
    }
  }

  // Lactation warnings
  if (patientData.lactating) {
    if (drug.lactationSafety === 'avoid') {
      warnings.push({ level: 'danger', message: `AVOID DURING BREASTFEEDING. ${drug.lactationNotes || ''}` });
    } else if (drug.lactationSafety === 'caution') {
      warnings.push({ level: 'warning', message: `Use with caution in breastfeeding. ${drug.lactationNotes || ''}` });
    }
  }

  // Renal warnings
  if (patientData.gfr !== undefined && patientData.gfr < 60) {
    if (drug.renalRisk === 'avoid') {
      warnings.push({ level: 'danger', message: `AVOID IN RENAL IMPAIRMENT (GFR: ${patientData.gfr}). ${drug.renalNotes || ''}` });
    } else if (drug.renalRisk === 'dose_adjust') {
      warnings.push({ level: 'warning', message: `DOSE ADJUSTMENT REQUIRED (GFR: ${patientData.gfr}). ${drug.dosage.renalImpairment?.adjustment || drug.renalNotes || ''}` });
    } else if (drug.renalRisk === 'monitor') {
      warnings.push({ level: 'info', message: `Monitor renal function closely (GFR: ${patientData.gfr}). ${drug.renalNotes || ''}` });
    }
  }

  // Hepatic warnings
  if (patientData.hepaticImpairment) {
    if (drug.hepaticRisk === 'avoid') {
      warnings.push({ level: 'danger', message: `AVOID IN HEPATIC IMPAIRMENT. ${drug.hepaticNotes || ''}` });
    } else if (drug.hepaticRisk === 'dose_adjust') {
      warnings.push({ level: 'warning', message: `DOSE ADJUSTMENT REQUIRED for hepatic impairment. ${drug.dosage.hepaticImpairment?.adjustment || drug.hepaticNotes || ''}` });
    } else if (drug.hepaticRisk === 'monitor') {
      warnings.push({ level: 'info', message: `Monitor liver function. ${drug.hepaticNotes || ''}` });
    }
  }

  // Cardiac warnings
  if (patientData.cardiacDisease) {
    if (drug.cardiacRisk === 'avoid') {
      warnings.push({ level: 'danger', message: `AVOID IN CARDIAC DISEASE. ${drug.cardiacNotes || ''}` });
    } else if (drug.cardiacRisk === 'caution') {
      warnings.push({ level: 'warning', message: `Use with caution in cardiac disease. ${drug.cardiacNotes || ''}` });
    } else if (drug.cardiacRisk === 'monitor') {
      warnings.push({ level: 'info', message: `Monitor cardiac status. ${drug.cardiacNotes || ''}` });
    }
  }

  // Age warnings
  if (patientData.age !== undefined) {
    if (patientData.age >= 65 && drug.dosage.elderly) {
      warnings.push({ level: 'warning', message: `ELDERLY PATIENT (${patientData.age}y): ${drug.dosage.elderly.notes || 'Consider dose reduction.'}. Recommended dose: ${drug.dosage.elderly.standard}` });
    }
    if (patientData.age < 18 && !drug.dosage.pediatric) {
      warnings.push({ level: 'warning', message: 'No specific pediatric dosing information available. Consult specialist guidelines.' });
    }
  }

  // Drug interaction warnings
  if (patientData.currentMedications && patientData.currentMedications.length > 0) {
    drug.interactions.forEach(interaction => {
      const matchingMed = patientData.currentMedications!.find(med =>
        med.toLowerCase().includes(interaction.drug.toLowerCase()) ||
        interaction.drug.toLowerCase().includes(med.toLowerCase())
      );
      if (matchingMed) {
        const level = interaction.severity === 'major' ? 'danger' : interaction.severity === 'moderate' ? 'warning' : 'info';
        warnings.push({ level, message: `INTERACTION with ${matchingMed}: ${interaction.effect}` });
      }
    });
  }

  // Allergy warnings
  if (patientData.allergies && patientData.allergies.length > 0) {
    const drugNameLower = drug.genericName.toLowerCase();
    const categoryLower = drug.category.toLowerCase();
    
    patientData.allergies.forEach(allergy => {
      const allergyLower = allergy.toLowerCase();
      // Direct match
      if (drugNameLower.includes(allergyLower) || drug.brandNames.some(b => b.toLowerCase().includes(allergyLower))) {
        warnings.push({ level: 'danger', message: `PATIENT ALLERGIC TO ${allergy}. This drug may be contraindicated.` });
      }
      // Class match (penicillin allergy with cephalosporins)
      if (allergyLower.includes('penicillin') && categoryLower.includes('cephalosporin')) {
        warnings.push({ level: 'warning', message: `Patient has penicillin allergy. 2-5% cross-reactivity risk with cephalosporins. Assess carefully.` });
      }
      if (allergyLower.includes('sulfa') || allergyLower.includes('sulpha')) {
        if (drug.id === 'silver_sulfadiazine') {
          warnings.push({ level: 'danger', message: 'Patient has sulfonamide allergy. Silver sulfadiazine is contraindicated.' });
        }
      }
    });
  }

  // Max dose warning based on weight
  if (patientData.weight && drug.maxDailyDose) {
    warnings.push({ level: 'info', message: `Maximum daily dose: ${drug.maxDailyDose}` });
  }

  return warnings;
}

/** Check drug-drug interactions between two drugs */
export function checkDrugInteractions(drug1: BNFDrug, drug2: BNFDrug): { severity: 'minor' | 'moderate' | 'major'; effect: string }[] {
  const interactions: { severity: 'minor' | 'moderate' | 'major'; effect: string }[] = [];
  
  // Check drug1's interactions against drug2
  drug1.interactions.forEach(interaction => {
    if (
      drug2.genericName.toLowerCase().includes(interaction.drug.toLowerCase()) ||
      drug2.brandNames.some(b => b.toLowerCase().includes(interaction.drug.toLowerCase())) ||
      drug2.category.toLowerCase().includes(interaction.drug.toLowerCase())
    ) {
      interactions.push({ severity: interaction.severity, effect: `${drug1.genericName} + ${drug2.genericName}: ${interaction.effect}` });
    }
  });

  // Check drug2's interactions against drug1
  drug2.interactions.forEach(interaction => {
    if (
      drug1.genericName.toLowerCase().includes(interaction.drug.toLowerCase()) ||
      drug1.brandNames.some(b => b.toLowerCase().includes(interaction.drug.toLowerCase())) ||
      drug1.category.toLowerCase().includes(interaction.drug.toLowerCase())
    ) {
      // Avoid duplicates
      const exists = interactions.some(i => i.effect.includes(drug2.genericName) && i.effect.includes(drug1.genericName));
      if (!exists) {
        interactions.push({ severity: interaction.severity, effect: `${drug2.genericName} + ${drug1.genericName}: ${interaction.effect}` });
      }
    }
  });

  return interactions;
}

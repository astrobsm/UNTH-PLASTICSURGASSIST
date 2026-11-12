/**
 * Rule-based medication review for the critical-care analysis.
 *
 * Drugs are classified by name/class keywords; each drug is then checked
 * against the patient's own data (which abnormality could it be causing),
 * every other listed drug (pairwise interaction rules by class, plus the BNF
 * table's own interactions), the renal band, the liver, allergies, duplicate
 * classes, TDM needs and course length.
 *
 * Deliberately no dose numbers are invented here: renal text comes from the
 * app's BNF data where the drug is in it, otherwise the reviewer is pointed to
 * the formulary. Dose arithmetic is left to the clinician / AI review with the
 * weight and CrCl band this module states.
 */
import { BNF_DRUG_DATABASE, checkDrugInteractions, type BNFDrug } from '../../data/bnfDrugDatabase';
import type { CcInteraction, CcMedication, CcMedReview } from './types';

export type DrugClass =
  | 'ace' | 'arb' | 'k_sparing' | 'k_supplement' | 'nsaid' | 'loop' | 'thiazide' | 'aminoglycoside' | 'vancomycin' | 'trimethoprim'
  | 'heparin' | 'warfarin' | 'doac' | 'antiplatelet' | 'opioid' | 'benzodiazepine' | 'ssri_snri' | 'carbamazepine' | 'qt'
  | 'insulin' | 'sulfonylurea' | 'quinine' | 'metformin' | 'beta_blocker' | 'rate_ccb' | 'digoxin' | 'amiodarone' | 'calcineurin'
  | 'cyp_inducer' | 'cyp_inhibitor' | 'linezolid' | 'valproate' | 'anti_tb_hepatotoxic' | 'paracetamol' | 'amphotericin'
  | 'beta_agonist' | 'ppi' | 'h2' | 'steroid' | 'serotonergic' | 'penicillin' | 'cephalosporin' | 'carbapenem' | 'antimicrobial'
  | 'vasopressor' | 'statin' | 'phenytoin' | 'lithium' | 'theophylline' | 'desmopressin' | 'oxytocin' | 'methotrexate' | 'azole'
  | 'macrolide' | 'fluoroquinolone' | 'metronidazole' | 'artemisinin';

const KW: [DrugClass, RegExp][] = [
  ['ace', /pril\b/], ['arb', /sartan\b/], ['k_sparing', /spironolact|eplerenone|amiloride|triamterene/],
  ['k_supplement', /potassium (chloride|citrate|phosphate)|\bkcl\b|slow-?k|sando-?k/],
  ['nsaid', /ibuprofen|diclofenac|naproxen|ketorolac|piroxicam|meloxicam|celecoxib|indometacin|ketoprofen|mefenamic/],
  ['loop', /furosemide|frusemide|bumetanide|torsemide|torasemide/], ['thiazide', /thiazide|chlortalidone|chlorthalidone|indapamide|metolazone/],
  ['aminoglycoside', /gentamicin|amikacin|tobramycin|streptomycin/], ['vancomycin', /vancomycin/], ['trimethoprim', /trimethoprim|co-?trimoxazole|septrin|bactrim/],
  ['heparin', /heparin|enoxaparin|dalteparin|tinzaparin|clexane/], ['warfarin', /warfarin|acenocoumarol/],
  ['doac', /rivaroxaban|apixaban|dabigatran|edoxaban/], ['antiplatelet', /aspirin|clopidogrel|ticagrelor|prasugrel/],
  ['opioid', /morphine|fentanyl|pethidine|meperidine|tramadol|codeine|oxycodone|methadone|diamorphine|hydromorphone|pentazocine/],
  ['benzodiazepine', /midazolam|diazepam|lorazepam|alprazolam|clonazepam|chlordiazepoxide/],
  ['ssri_snri', /fluoxetine|sertraline|citalopram|escitalopram|paroxetine|venlafaxine|duloxetine/], ['carbamazepine', /carbamazepine|oxcarbazepine/],
  ['qt', /amiodarone|haloperidol|ondansetron|azithromycin|clarithromycin|erythromycin|ciprofloxacin|levofloxacin|moxifloxacin|quinine|chloroquine|lumefantrine|methadone|domperidone|fluconazole|citalopram|escitalopram|chlorpromazine/],
  ['insulin', /insulin|actrapid|mixtard|glargine|lantus/], ['sulfonylurea', /glibenclamide|gliclazide|glimepiride|glipizide/],
  ['quinine', /quinine/], ['metformin', /metformin/], ['beta_blocker', /olol\b|carvedilol|labetalol/], ['rate_ccb', /verapamil|diltiazem/],
  ['digoxin', /digoxin/], ['amiodarone', /amiodarone/], ['calcineurin', /tacrolimus|ciclosporin|cyclosporin/],
  ['cyp_inducer', /rifampicin|rifampin|carbamazepine|phenytoin|phenobarbital|efavirenz/],
  ['cyp_inhibitor', /fluconazole|ketoconazole|itraconazole|voriconazole|clarithromycin|erythromycin|ciprofloxacin|ritonavir|metronidazole/],
  ['linezolid', /linezolid/], ['valproate', /valpro/], ['anti_tb_hepatotoxic', /isoniazid|rifampicin|pyrazinamide|rhze|rhz/],
  ['paracetamol', /paracetamol|acetaminophen/], ['amphotericin', /amphotericin/], ['beta_agonist', /salbutamol|terbutaline|albuterol/],
  ['ppi', /prazole\b/], ['h2', /ranitidine|famotidine|cimetidine/], ['steroid', /prednisolone|hydrocortisone|dexamethasone|methylprednisolone|prednisone/],
  ['serotonergic', /fluoxetine|sertraline|citalopram|escitalopram|paroxetine|venlafaxine|duloxetine|tramadol|pethidine|linezolid|methylene blue|amitriptyline|fentanyl/],
  ['penicillin', /penicillin|amoxicillin|ampicillin|cloxacillin|flucloxacillin|piperacillin|co-?amoxiclav|augmentin|amoxicillin–clavulanate|benzylpenicillin/],
  ['cephalosporin', /cef|ceph/], ['carbapenem', /penem\b/], ['azole', /fluconazole|ketoconazole|itraconazole|voriconazole/],
  ['macrolide', /azithromycin|clarithromycin|erythromycin/], ['fluoroquinolone', /floxacin\b/], ['metronidazole', /metronidazole/],
  ['antimicrobial', /cillin|cef|ceph|penem|mycin|micin|floxacin|metronidazole|co-?trimoxazole|doxycycline|linezolid|vancomycin|clindamycin|augmentin|amoxiclav|fluconazole|amphotericin|aciclovir|artesunate|artemether|quinine/],
  ['vasopressor', /noradrenaline|norepinephrine|adrenaline|epinephrine|dopamine|vasopressin|phenylephrine/],
  ['statin', /statin\b/], ['phenytoin', /phenytoin/], ['lithium', /lithium/], ['theophylline', /theophylline|aminophylline/],
  ['desmopressin', /desmopressin/], ['oxytocin', /oxytocin/], ['methotrexate', /methotrexate/], ['artemisinin', /artesunate|artemether|arteether/],
];

export function classesOf(m: Pick<CcMedication, 'name' | 'class'> & Partial<Pick<CcMedication, 'dose' | 'unit'>>): Set<DrugClass> {
  const t = `${m.name} ${m.class || ''}`.toLowerCase();
  const out = new Set<DrugClass>();
  for (const [c, re] of KW) if (re.test(t)) out.add(c);
  if (/ace inhibitor/.test(t)) out.add('ace');
  if (/angiotensin receptor|\barb\b/.test(t)) out.add('arb');
  if (/beta.?blocker/.test(t)) out.add('beta_blocker');
  // Low-dose aspirin is an antiplatelet; ≥ 300 mg a day also behaves as an NSAID.
  const doseMg = Number(m.dose) * (/^g$/i.test(String(m.unit || '').trim()) ? 1000 : 1);
  if (/aspirin/.test(t) && Number.isFinite(doseMg) && doseMg >= 300) out.add('nsaid');
  return out;
}

const MECHANISM: Partial<Record<DrugClass, string>> = {
  ace: 'Blocks angiotensin II formation — lowers BP and aldosterone; raises K and can reduce GFR when volume-depleted',
  arb: 'Blocks the angiotensin II receptor — as ACE inhibitors for K and GFR',
  k_sparing: 'Blocks aldosterone / ENaC in the collecting duct — retains K',
  k_supplement: 'Adds potassium', nsaid: 'Inhibits COX — reduces renal prostaglandins (AKI risk), platelet function and gastric protection',
  loop: 'Inhibits NKCC2 in the loop of Henle — natriuresis; loses K, Mg and Ca', thiazide: 'Inhibits NCC in the distal tubule — loses Na and K; causes hyponatraemia',
  aminoglycoside: 'Binds the 30S ribosome — concentration-dependent killing; nephro- and ototoxic', vancomycin: 'Inhibits cell-wall synthesis (Gram-positive) — nephrotoxic at high troughs',
  trimethoprim: 'Inhibits bacterial folate synthesis; blocks ENaC — raises K and creatinine', heparin: 'Potentiates antithrombin — anticoagulant; can raise K and cause HIT',
  warfarin: 'Vitamin K antagonist — anticoagulant; many CYP interactions', doac: 'Direct factor Xa / thrombin inhibitor — renally cleared to varying degrees',
  antiplatelet: 'Inhibits platelet aggregation', opioid: 'μ-opioid agonist — analgesia; respiratory and CNS depression; metabolites accumulate in renal failure',
  benzodiazepine: 'GABA-A positive modulator — sedation; respiratory depression, delirium', ssri_snri: 'Serotonin (± noradrenaline) reuptake inhibitor — SIADH, bleeding, serotonin syndrome',
  insulin: 'Drives glucose and K into cells', sulfonylurea: 'Stimulates insulin release — prolonged hypoglycaemia in renal failure',
  quinine: 'Antimalarial — stimulates insulin release (hypoglycaemia), prolongs QT', metformin: 'Reduces hepatic glucose output — lactic acidosis risk with low GFR, hypoxia or shock',
  beta_blocker: 'β-adrenoceptor blocker — rate and BP control; bradycardia, bronchospasm, masks hypoglycaemia', digoxin: 'Na/K-ATPase inhibitor — toxicity with hypokalaemia and renal failure',
  amiodarone: 'Class III antiarrhythmic — QT prolongation; CYP and P-gp inhibitor', vasopressor: 'Adrenergic / vasopressin agonist — raises vascular tone (MAP)',
  steroid: 'Glucocorticoid — hyperglycaemia, hypokalaemia; must be weaned after > 3 weeks', ppi: 'Proton-pump inhibitor — hyponatraemia, hypomagnesaemia, C. difficile',
  linezolid: 'Oxazolidinone — myelosuppression (thrombocytopenia), MAO inhibition', valproate: 'Anticonvulsant — hepatotoxic, thrombocytopenia, hyperammonaemia',
  amphotericin: 'Polyene antifungal — nephrotoxic; wastes K and Mg', beta_agonist: 'β2 agonist — bronchodilator; lowers K, tachycardia',
  artemisinin: 'Artemisinin antimalarial — rapid parasite clearance; delayed haemolysis after artesunate',
};

const RENAL_SENSITIVE: DrugClass[] = ['aminoglycoside', 'vancomycin', 'heparin', 'doac', 'metformin', 'sulfonylurea', 'opioid', 'digoxin', 'lithium', 'k_sparing', 'k_supplement', 'nsaid', 'trimethoprim', 'carbapenem', 'cephalosporin', 'penicillin', 'azole', 'fluoroquinolone', 'amphotericin'];
const HEPATIC_SENSITIVE: DrugClass[] = ['anti_tb_hepatotoxic', 'paracetamol', 'azole', 'valproate', 'statin', 'methotrexate', 'amiodarone', 'opioid', 'benzodiazepine', 'warfarin'];

export interface PatientFacts {
  k?: number | null; na?: number | null; glucose?: number | null; plt?: number | null; inr?: number | null; hr?: number | null; lactate?: number | null;
  alt?: number | null; altUln?: number; bilirubin?: number | null; mg?: number | null;
  egfr?: number | null; crcl?: number | null; aki?: boolean; activeBleeding?: boolean; giBleed?: boolean; qtProlonged?: boolean; asthma?: boolean; liverDisease?: boolean;
  hypovolaemic?: boolean; allergies: { agent: string; reaction?: string }[]; ventilated?: boolean;
}

function bnfFor(name: string): BNFDrug | undefined {
  const n = name.toLowerCase().trim().split(/[\s(]/)[0];
  if (n.length < 4) return undefined;
  return BNF_DRUG_DATABASE.find(d => d.genericName.toLowerCase().startsWith(n) || d.brandNames.some(b => b.toLowerCase() === name.toLowerCase().trim()));
}

const daysSince = (iso?: string) => (iso && !Number.isNaN(Date.parse(iso)) ? Math.floor((Date.now() - Date.parse(iso)) / 86_400_000) : null);
const has = (s: Set<DrugClass>, ...c: DrugClass[]) => c.some(x => s.has(x));

/** Pairwise class rules: [classes A, classes B, severity, mechanism, management]. */
const PAIRS: [DrugClass[], DrugClass[], CcInteraction['severity'], string, string][] = [
  [['ace'], ['arb'], 'major', 'Dual RAAS blockade — hyperkalaemia, AKI, hypotension', 'Avoid the combination; stop one'],
  [['ace', 'arb'], ['k_sparing', 'k_supplement', 'trimethoprim'], 'major', 'Additive potassium retention', 'Avoid or monitor K closely (daily); stop if K > 5.5'],
  [['opioid'], ['benzodiazepine'], 'major', 'Additive CNS and respiratory depression', 'Use the lowest doses, monitor sedation and RR; naloxone/flumazenil available'],
  [['warfarin', 'doac', 'heparin'], ['antiplatelet', 'nsaid'], 'major', 'Additive bleeding risk', 'Confirm both are indicated; add gastroprotection; avoid NSAIDs'],
  [['warfarin'], ['doac'], 'contraindicated', 'Duplicate anticoagulation', 'Use one anticoagulant (except a supervised switch)'],
  [['doac', 'warfarin'], ['heparin'], 'major', 'Duplicate anticoagulation unless a planned bridge or switch', 'Confirm intent and timing'],
  [['ssri_snri', 'serotonergic'], ['linezolid'], 'major', 'Serotonin syndrome (linezolid is an MAO inhibitor)', 'Avoid; if unavoidable, monitor for serotonin toxicity'],
  [['cyp_inducer'], ['warfarin', 'doac', 'calcineurin', 'azole', 'steroid'], 'major', 'CYP3A4 / P-gp induction lowers levels (rifampicin especially)', 'Avoid or adjust with levels/INR; check formulary'],
  [['cyp_inhibitor'], ['warfarin'], 'major', 'CYP inhibition raises INR', 'Monitor INR closely; consider dose reduction'],
  [['trimethoprim', 'metronidazole'], ['warfarin'], 'major', 'Raises INR', 'Monitor INR within 3–5 days'],
  [['cyp_inhibitor'], ['calcineurin'], 'major', 'Raises calcineurin-inhibitor levels (nephrotoxicity)', 'Check levels; adjust'],
  [['amiodarone'], ['digoxin'], 'major', 'Amiodarone raises digoxin levels', 'Halve the digoxin dose and check levels (pharmacist)'],
  [['amiodarone'], ['warfarin'], 'major', 'Amiodarone raises INR', 'Monitor INR; reduce warfarin'],
  [['aminoglycoside'], ['vancomycin', 'loop', 'amphotericin', 'nsaid'], 'moderate', 'Additive nephro-/ototoxicity', 'Monitor creatinine and levels; avoid loop-diuretic boluses'],
  [['insulin', 'sulfonylurea'], ['quinine'], 'moderate', 'Quinine stimulates insulin release — additive hypoglycaemia', 'Glucose 1–4 hourly'],
  [['methotrexate'], ['trimethoprim', 'nsaid'], 'major', 'Reduced methotrexate clearance — marrow toxicity', 'Avoid'],
  [['beta_blocker'], ['rate_ccb'], 'major', 'Additive AV block, bradycardia, hypotension (verapamil/diltiazem)', 'Avoid IV combination; monitor ECG'],
  [['digoxin'], ['loop', 'thiazide'], 'moderate', 'Diuretic hypokalaemia potentiates digoxin toxicity', 'Keep K ≥ 4.0 mmol/L; check digoxin level'],
  [['lithium'], ['ace', 'arb', 'thiazide', 'nsaid', 'loop'], 'major', 'Raises lithium levels', 'Check lithium level; adjust'],
  [['k_sparing'], ['k_supplement'], 'major', 'Hyperkalaemia', 'Avoid unless K is low and monitored'],
];

export function reviewMedications(meds: CcMedication[], f: PatientFacts): { reviews: CcMedReview[]; missing: { therapy: string; reason: string }[]; tripleWhammy: boolean } {
  const cls = meds.map(m => classesOf(m));
  const all = new Set<DrugClass>(cls.flatMap(c => [...c]));
  const tripleWhammy = has(all, 'ace', 'arb') && has(all, 'loop', 'thiazide', 'k_sparing') && all.has('nsaid');

  const reviews = meds.map((m, i): CcMedReview => {
    const c = cls[i];
    const bnf = bnfFor(m.name);
    const adverse: string[] = [];
    const inter: CcInteraction[] = [];
    const notes: string[] = [];
    let rec: CcMedReview['recommendation'] = 'continue';
    const escalate = (r: CcMedReview['recommendation']) => {
      const order = ['continue', 'adjust', 'substitute', 'hold', 'stop'];
      if (order.indexOf(r) > order.indexOf(rec)) rec = r;
    };

    // Adverse effects linked to this patient's data.
    if ((f.k ?? 0) > 5.5 && has(c, 'ace', 'arb', 'k_sparing', 'k_supplement', 'trimethoprim', 'nsaid', 'heparin', 'beta_blocker', 'calcineurin', 'digoxin')) { adverse.push(`Can raise potassium — K ${f.k} mmol/L`); escalate(has(c, 'k_supplement', 'k_sparing') || (f.k ?? 0) >= 6 ? 'hold' : 'adjust'); }
    if (f.k != null && f.k < 3.5 && has(c, 'loop', 'thiazide', 'beta_agonist', 'insulin', 'amphotericin', 'steroid')) adverse.push(`Lowers potassium — K ${f.k} mmol/L`);
    if (f.na != null && f.na < 135 && has(c, 'thiazide', 'ssri_snri', 'carbamazepine', 'ppi', 'opioid', 'desmopressin', 'oxytocin')) { adverse.push(`Recognised cause of hyponatraemia — Na ${f.na} mmol/L`); if (f.na < 130 && has(c, 'thiazide', 'desmopressin')) escalate('hold'); }
    if (f.aki && has(c, 'nsaid', 'aminoglycoside', 'vancomycin', 'amphotericin', 'calcineurin')) { adverse.push('Nephrotoxic with AKI present'); escalate(c.has('nsaid') ? 'stop' : 'adjust'); }
    if (f.aki && has(c, 'ace', 'arb') && (f.hypovolaemic || (f.k ?? 0) > 5.5)) { adverse.push('ACE inhibitor/ARB with AKI and hypovolaemia or hyperkalaemia'); escalate('hold'); }
    if (f.aki && has(c, 'metformin', 'loop', 'thiazide', 'k_sparing') && !c.has('loop')) escalate('hold');
    if (f.plt != null && f.plt < 100 && has(c, 'heparin', 'linezolid', 'valproate')) adverse.push(`Can cause thrombocytopenia — platelets ${f.plt} ×10⁹/L${c.has('heparin') ? ' (consider HIT: 4Ts score)' : ''}`);
    if (((f.alt ?? 0) > 3 * (f.altUln ?? 40) || (f.bilirubin ?? 0) > 34) && has(c, 'anti_tb_hepatotoxic', 'paracetamol', 'azole', 'valproate', 'statin', 'methotrexate', 'amiodarone') ) { adverse.push('Potentially hepatotoxic with abnormal liver tests'); escalate('adjust'); }
    if (f.glucose != null && f.glucose < 4 && has(c, 'insulin', 'sulfonylurea', 'quinine')) { adverse.push(`Can cause hypoglycaemia — glucose ${f.glucose} mmol/L`); escalate('hold'); }
    if (f.hr != null && f.hr < 50 && has(c, 'beta_blocker', 'digoxin', 'amiodarone', 'rate_ccb')) { adverse.push(`Bradycardia HR ${f.hr}`); escalate('hold'); }
    if (f.qtProlonged && c.has('qt')) { adverse.push('QT prolongation on ECG'); escalate('adjust'); }
    if (c.has('metformin') && ((f.lactate ?? 0) >= 4 || (f.egfr ?? 99) < 30)) { adverse.push(`Metformin with ${(f.lactate ?? 0) >= 4 ? `lactate ${f.lactate}` : `eGFR ${f.egfr}`} — lactic acidosis risk`); escalate('stop'); }
    if ((f.inr ?? 0) > 5 || f.activeBleeding) if (has(c, 'warfarin', 'doac', 'heparin', 'antiplatelet', 'nsaid')) { adverse.push(f.activeBleeding ? 'Bleeding on an anticoagulant/antiplatelet' : `INR ${f.inr}`); escalate('hold'); }
    if (f.mg != null && f.mg < 0.7 && has(c, 'loop', 'ppi', 'amphotericin', 'aminoglycoside')) adverse.push(`Recognised cause of hypomagnesaemia — Mg ${f.mg} mmol/L`);

    // Drug–disease.
    if (c.has('nsaid') && (f.aki || f.giBleed)) inter.push({ with: f.aki ? 'AKI' : 'GI bleeding', severity: 'contraindicated', mechanism: 'NSAID worsens renal perfusion / bleeding', management: 'Stop; use paracetamol ± opioid' });
    if (c.has('beta_blocker') && f.asthma) inter.push({ with: 'asthma / bronchospasm', severity: 'major', mechanism: 'β-blockade causes bronchospasm', management: 'Avoid non-selective β-blockers; review need' });
    if (c.has('metformin') && (f.egfr ?? 99) < 30) inter.push({ with: 'eGFR < 30', severity: 'contraindicated', mechanism: 'Metformin accumulation — lactic acidosis', management: 'Stop metformin' });

    // Pairwise.
    meds.forEach((other, j) => {
      if (j === i) return;
      const oc = cls[j];
      for (const [a, b, sev, mech, mgmt] of PAIRS) {
        if ((has(c, ...a) && has(oc, ...b)) || (has(c, ...b) && has(oc, ...a))) inter.push({ with: other.name, severity: sev, mechanism: mech, management: mgmt });
      }
      if (c.has('qt') && oc.has('qt')) inter.push({ with: other.name, severity: 'major', mechanism: 'Additive QT prolongation (torsades risk)', management: 'ECG for QTc; correct K and Mg; avoid if QTc > 500 ms' });
      if (c.has('serotonergic') && oc.has('serotonergic') && !(c.has('linezolid') || oc.has('linezolid'))) inter.push({ with: other.name, severity: 'moderate', mechanism: 'Additive serotonergic effect', management: 'Monitor for serotonin toxicity (clonus, hyperthermia, agitation)' });
      const bnfOther = bnfFor(other.name);
      if (bnf && bnfOther) {
        if (!inter.some(x => x.with === other.name)) {
          for (const hit of checkDrugInteractions(bnf, bnfOther)) inter.push({ with: other.name, severity: hit.severity, mechanism: hit.effect, management: 'See BNF interaction entry; confirm with pharmacist' });
        }
      }
      // Duplicate class (same therapeutic class twice).
      const dupe = ([['ppi'], ['h2'], ['nsaid'], ['ace', 'arb'], ['opioid'], ['benzodiazepine'], ['heparin']] as DrugClass[][])
        .find(g => has(c, ...g) && has(oc, ...g) && !(g[0] === 'opioid'));
      if (dupe && j > i) inter.push({ with: other.name, severity: 'moderate', mechanism: 'Duplicate therapy in the same class', management: 'Stop one' });
    });
    if (tripleWhammy && has(c, 'ace', 'arb', 'loop', 'thiazide', 'nsaid', 'k_sparing')) inter.push({ with: 'ACE inhibitor/ARB + diuretic + NSAID', severity: 'major', mechanism: '"Triple whammy" — combined loss of renal autoregulation (AKI)', management: 'Stop the NSAID; review the others while AKI risk persists' });

    // Allergy.
    for (const a of f.allergies) {
      const ag = a.agent.toLowerCase();
      const pen = /penicillin|amoxicillin|ampicillin|augmentin/.test(ag);
      const severe = /anaphyla|angio|swelling|stevens|sjs|ten|airway/.test((a.reaction ?? '').toLowerCase());
      if (pen && c.has('penicillin')) { inter.push({ with: `allergy: ${a.agent}`, severity: 'contraindicated', mechanism: `Penicillin allergy (${a.reaction || 'reaction not recorded'})`, management: 'Stop; substitute a non-β-lactam or a cephalosporin per allergy history' }); escalate('substitute'); }
      else if (pen && has(c, 'cephalosporin', 'carbapenem')) inter.push({ with: `allergy: ${a.agent}`, severity: severe ? 'major' : 'minor', mechanism: 'β-lactam cross-reactivity (low, < 2% for most cephalosporins and carbapenems)', management: severe ? 'Avoid after anaphylaxis/severe reaction unless specialist advice' : 'Usually acceptable after a non-severe rash; monitor' });
      else if (ag.length >= 4 && (m.name.toLowerCase().includes(ag) || (m.class || '').toLowerCase().includes(ag))) { inter.push({ with: `allergy: ${a.agent}`, severity: 'contraindicated', mechanism: `Documented allergy (${a.reaction || 'reaction not recorded'})`, management: 'Stop and substitute' }); escalate('substitute'); }
    }
    if (inter.some(x => x.severity === 'contraindicated') && rec === 'continue') escalate('substitute');

    // Renal.
    let renal = 'No renal adjustment flagged';
    if (has(c, ...RENAL_SENSITIVE)) {
      const band = f.crcl == null ? 'unknown (no creatinine/weight)' : f.crcl > 50 ? '> 50 mL/min' : f.crcl >= 30 ? '30–50 mL/min' : f.crcl >= 10 ? '10–29 mL/min' : '< 10 mL/min';
      const bnfText = bnf?.dosage?.renalImpairment?.adjustment;
      renal = `Renally relevant. CrCl band ${band}.${bnfText ? ` BNF: ${bnfText}.` : ''}${f.aki ? ' AKI: CrCl overestimates function while creatinine is rising — give full loading doses, adjust maintenance as function changes.' : ''} Confirm the dose with the formulary / pharmacist.`;
      if (f.crcl != null && f.crcl < 30) escalate('adjust');
    }
    const hepatic = has(c, ...HEPATIC_SENSITIVE) && (f.liverDisease || (f.alt ?? 0) > 3 * (f.altUln ?? 40) || (f.bilirubin ?? 0) > 34)
      ? `Hepatically relevant with abnormal liver tests / liver disease${bnf?.dosage?.hepaticImpairment?.adjustment ? ` — BNF: ${bnf.dosage.hepaticImpairment.adjustment}` : ''}; use Child–Pugh class to adjust`
      : has(c, ...HEPATIC_SENSITIVE) ? 'Hepatically metabolised — no current liver concern in the data' : 'No hepatic adjustment flagged';

    // TDM.
    const tdm = c.has('vancomycin') ? 'Vancomycin: trough before the 4th dose (or AUC-guided per local protocol)'
      : c.has('aminoglycoside') ? 'Aminoglycoside: level per local protocol (e.g. 6–14 h post-dose nomogram for once-daily gentamicin)'
        : c.has('digoxin') ? 'Digoxin: level ≥ 6 h post-dose; keep K ≥ 4'
          : c.has('phenytoin') ? 'Phenytoin: trough; correct for low albumin or use free level'
            : c.has('valproate') ? 'Valproate: trough if toxicity or poor control'
              : c.has('lithium') ? 'Lithium: 12-hour post-dose level'
                : c.has('theophylline') ? 'Theophylline/aminophylline: level 4–6 h after starting the infusion' : '';

    // Duration.
    const started = daysSince(m.start_date);
    let duration = '';
    if (c.has('antimicrobial')) {
      duration = started != null ? `Day ${started + 1} of antimicrobial therapy.` : 'Start date not recorded.';
      duration += ' Set a review/stop date by indication (many infections need 5–7 days; endocarditis, osteomyelitis and TB much longer).';
      if (started != null && started >= 14) { duration += ' Over 14 days — confirm the indication still applies.'; escalate('adjust'); }
    }
    if (has(c, 'steroid', 'beta_blocker', 'benzodiazepine', 'opioid')) duration += `${duration ? ' ' : ''}Wean rather than stop abruptly${c.has('steroid') ? ' if given > 3 weeks (adrenal suppression)' : ''}.`;

    const indication_ok = m.indication ? true : null;
    if (!m.indication) notes.push('No indication recorded — confirm one exists');
    const dose = m.dose != null && m.dose !== '' ? `${m.dose}${m.unit ? ' ' + m.unit : ''} ${m.route || ''} ${m.frequency || ''}`.trim() : 'Dose not recorded';

    return {
      drug: m.name, class: m.class || [...c].filter(x => x !== 'antimicrobial')[0]?.replace(/_/g, ' ') || '',
      mechanism: [...c].map(x => MECHANISM[x]).find(Boolean) || (bnf ? `${bnf.category}` : 'Not in the rule base — check formulary'),
      indication_ok, dose_assessment: `${dose}. Compare with standard dosing for the indication in the hospital formulary; weight and CrCl band are stated in the renal section.`,
      renal_adjustment: renal, hepatic_adjustment: hepatic, adverse_effects_in_this_patient: adverse, duration_assessment: duration || 'No duration concern flagged',
      interactions: inter, tdm, recommendation: rec, details: [...notes, ...adverse].join('; ') || 'No rule-based concern',
    };
  });

  // Indicated therapy that is missing.
  const missing: { therapy: string; reason: string }[] = [];
  const anticoag = has(all, 'heparin', 'warfarin', 'doac');
  if (!anticoag && !f.activeBleeding && (f.plt ?? 999) >= 50) missing.push({ therapy: 'VTE prophylaxis', reason: 'Inpatient with no anticoagulant and no bleeding/thrombocytopenia recorded — assess VTE and bleeding risk' });
  if (f.ventilated && !has(all, 'ppi', 'h2')) missing.push({ therapy: 'Stress ulcer prophylaxis', reason: 'Mechanical ventilation (> 48 h) is a risk factor — consider if expected to continue' });
  return { reviews, missing, tripleWhammy };
}

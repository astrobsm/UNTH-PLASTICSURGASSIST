/**
 * Pre-operative guidance for a patient's current medications.
 *
 * WHAT THIS IS
 * A lookup that flags which of a patient's drugs usually need a decision before
 * surgery, so none of them is quietly missed on a busy list. It surfaces the
 * commonly-used interval and the reason for it.
 *
 * WHAT THIS IS NOT
 * It is not a prescribing decision and it is not a protocol. Every interval
 * here is the ordinary starting point, not an instruction: the right answer
 * depends on the indication, the bleeding risk of the operation, renal
 * function, and what the anaesthetist and the prescribing team decide. Every
 * result carries `confirmationRequired: true` for that reason, and the UI says
 * so beside each one.
 *
 * THREE RULES THAT MATTER
 *
 * 1. A drug that is not recognised returns `null`. It is then listed as "no
 *    guidance available — review manually". Guessing at an unknown drug is the
 *    one behaviour that would make this dangerous.
 *
 * 2. CONTINUE is advice too, and it is the advice most easily lost. Stopping a
 *    beta blocker, a statin or long-term steroid before surgery causes harm;
 *    those are stated as explicitly as the ones to stop.
 *
 * 3. Matching is on whole words. "asa" inside "Asacol" and "ace" inside
 *    "Acetaminophen" are exactly the substring collisions that put an HbA1c
 *    into the haemoglobin field elsewhere in this codebase.
 */

export type PreopAction = 'stop' | 'continue' | 'adjust' | 'seek-advice';

export interface PreopMedicationAdvice {
  /** The class this drug was recognised as. */
  klass: string;
  action: PreopAction;
  /** Plain-language timing, e.g. "5 days before surgery". Empty for continue. */
  timing: string;
  /** Why — the clinical reason, so the decision can be reasoned about. */
  reason: string;
  /** Always true. Rendered next to the advice; nothing here is self-executing. */
  confirmationRequired: true;
}

interface Rule {
  klass: string;
  /** Lower-case whole-word triggers: generic names, and brand names in local use. */
  names: string[];
  action: PreopAction;
  timing: string;
  reason: string;
}

/**
 * Ordered so that a more specific class is tested before a broader one — an
 * SGLT2 inhibitor must not be caught by a general "diabetes drug" rule.
 */
const RULES: Rule[] = [
  // ── Anticoagulants ────────────────────────────────────────────────────────
  {
    klass: 'Vitamin K antagonist',
    names: ['warfarin', 'acenocoumarol', 'coumadin'],
    action: 'stop',
    timing: 'usually 5 days before surgery, with an INR checked before theatre',
    reason: 'Bleeding risk. Bridging with heparin may be needed if the thrombotic risk is high.',
  },
  {
    klass: 'Direct oral anticoagulant (DOAC)',
    names: ['apixaban', 'rivaroxaban', 'edoxaban', 'dabigatran', 'eliquis', 'xarelto', 'pradaxa'],
    action: 'stop',
    timing: 'usually 24–48 hours before surgery; longer if renal function is impaired',
    reason: 'Bleeding risk. The interval depends on the drug, the bleeding risk of the operation and creatinine clearance.',
  },
  {
    klass: 'Low molecular weight heparin',
    names: ['enoxaparin', 'clexane', 'dalteparin', 'tinzaparin', 'fragmin'],
    action: 'stop',
    timing: 'prophylactic dose usually 12 hours before, treatment dose usually 24 hours before',
    reason: 'Bleeding risk, and the interval also governs the safety of a regional block.',
  },

  // ── Antiplatelets ─────────────────────────────────────────────────────────
  {
    klass: 'P2Y12 inhibitor',
    names: ['clopidogrel', 'plavix', 'prasugrel', 'ticagrelor', 'brilinta'],
    action: 'stop',
    timing: 'usually 5–7 days before surgery depending on the agent',
    reason: 'Bleeding risk. Do not stop without cardiology advice if a coronary stent was placed recently.',
  },
  {
    klass: 'Aspirin',
    names: ['aspirin', 'acetylsalicylic acid', 'asa', 'cardiprin', 'ecotrin'],
    action: 'seek-advice',
    timing: 'often continued; stopped about 7 days before only where bleeding risk outweighs cardiac risk',
    reason: 'Whether to stop depends on why it is prescribed. Continuing is frequently safer than stopping in secondary prevention.',
  },

  // ── Diabetes ──────────────────────────────────────────────────────────────
  {
    klass: 'SGLT2 inhibitor',
    names: ['empagliflozin', 'dapagliflozin', 'canagliflozin', 'ertugliflozin', 'jardiance', 'forxiga'],
    action: 'stop',
    timing: 'usually 3 days before surgery',
    reason: 'Risk of euglycaemic diabetic ketoacidosis, which is easily missed because the glucose looks acceptable.',
  },
  {
    klass: 'GLP-1 receptor agonist',
    names: ['semaglutide', 'ozempic', 'liraglutide', 'victoza', 'dulaglutide', 'exenatide', 'saxenda'],
    action: 'seek-advice',
    timing: 'daily agents often held on the day; weekly agents often held for a week',
    reason: 'Delayed gastric emptying raises the aspiration risk at induction. The anaesthetist needs to know either way.',
  },
  {
    klass: 'Metformin',
    names: ['metformin', 'glucophage'],
    action: 'adjust',
    timing: 'commonly omitted on the day of surgery',
    reason: 'Lactic acidosis risk where renal perfusion falls or contrast is used. Many centres continue it for short procedures.',
  },
  {
    klass: 'Sulfonylurea',
    names: ['glibenclamide', 'gliclazide', 'glimepiride', 'glipizide'],
    action: 'adjust',
    timing: 'usually omitted on the morning of surgery',
    reason: 'Hypoglycaemia while fasting.',
  },
  {
    klass: 'Insulin',
    names: ['insulin', 'lantus', 'novomix', 'actrapid', 'humulin', 'glargine', 'mixtard'],
    action: 'adjust',
    timing: 'dose reduced rather than stopped; a variable-rate infusion may be needed',
    reason: 'Never simply stopped. Fasting changes the requirement; omission risks ketoacidosis in type 1 diabetes.',
  },

  // ── Cardiovascular: mostly CONTINUE ───────────────────────────────────────
  {
    klass: 'Beta blocker',
    names: ['atenolol', 'bisoprolol', 'metoprolol', 'propranolol', 'carvedilol', 'nebivolol', 'labetalol'],
    action: 'continue',
    timing: '',
    reason: 'Abrupt withdrawal causes rebound tachycardia, ischaemia and arrhythmia. Continue through surgery.',
  },
  {
    klass: 'Statin',
    names: ['atorvastatin', 'simvastatin', 'rosuvastatin', 'pravastatin', 'lipitor'],
    action: 'continue',
    timing: '',
    reason: 'Continuing is associated with better perioperative cardiac outcomes. No need to stop.',
  },
  {
    klass: 'ACE inhibitor / ARB',
    names: [
      'lisinopril', 'ramipril', 'enalapril', 'captopril', 'perindopril',
      'losartan', 'valsartan', 'irbesartan', 'candesartan', 'telmisartan',
    ],
    action: 'adjust',
    timing: 'the morning dose is commonly omitted',
    reason: 'Refractory hypotension on induction. The regular dose resumes after surgery.',
  },
  {
    klass: 'Diuretic',
    names: ['furosemide', 'lasix', 'bendroflumethiazide', 'hydrochlorothiazide', 'spironolactone', 'indapamide'],
    action: 'adjust',
    timing: 'the morning dose is commonly omitted',
    reason: 'Hypovolaemia and electrolyte disturbance around induction.',
  },

  // ── Hormonal ──────────────────────────────────────────────────────────────
  {
    klass: 'Combined hormonal contraceptive / HRT',
    names: ['microgynon', 'yasmin', 'ethinylestradiol', 'combined oral contraceptive', 'hrt', 'estradiol', 'oestrogen'],
    action: 'stop',
    timing: 'usually 4 weeks before major surgery',
    reason: 'Venous thromboembolism risk. Alternative contraception must be arranged before stopping.',
  },
  {
    klass: 'Long-term corticosteroid',
    names: ['prednisolone', 'prednisone', 'dexamethasone', 'hydrocortisone', 'methylprednisolone'],
    action: 'continue',
    timing: '',
    reason: 'Never stopped abruptly — adrenal suppression risks an addisonian crisis. Stress dosing is usually required.',
  },

  // ── Other ─────────────────────────────────────────────────────────────────
  {
    klass: 'NSAID',
    names: ['ibuprofen', 'diclofenac', 'naproxen', 'indomethacin', 'meloxicam', 'piroxicam', 'celecoxib'],
    action: 'stop',
    timing: 'usually 1–3 days before surgery depending on the agent',
    reason: 'Platelet effect and renal perfusion, particularly where blood loss is expected.',
  },
  {
    klass: 'Disease-modifying agent / biologic',
    names: [
      'methotrexate', 'azathioprine', 'ciclosporin', 'mycophenolate', 'leflunomide',
      'adalimumab', 'infliximab', 'etanercept', 'rituximab', 'tocilizumab',
    ],
    action: 'seek-advice',
    timing: 'timed to the dosing interval; decided with the prescribing specialist',
    reason: 'Balance of wound healing and infection risk against a disease flare.',
  },
  {
    klass: 'Monoamine oxidase inhibitor',
    names: ['phenelzine', 'tranylcypromine', 'isocarboxazid', 'selegiline', 'moclobemide'],
    action: 'seek-advice',
    timing: 'anaesthetic advice required well before the day',
    reason: 'Dangerous interactions with pethidine and indirect sympathomimetics. The anaesthetic technique must be planned around it.',
  },
  {
    klass: 'Herbal supplement',
    names: ['ginkgo', 'garlic', 'ginseng', 'ephedra', "st john's wort", 'st johns wort', 'fish oil', 'vitamin e'],
    action: 'stop',
    timing: 'usually 7 days before surgery',
    reason: 'Platelet effects and anaesthetic interactions. Often not volunteered unless asked for directly.',
  },
];

/** Letters and digits only; names are lower-cased before matching. */
function isWordChar(c: string | undefined): boolean {
  return c !== undefined && /[a-z0-9]/.test(c);
}

/**
 * True when `needle` appears in `haystack` as a whole word.
 *
 * Not `includes()`: "asa" sits inside "Asacol", "ace" inside "Acetaminophen",
 * and "hrt" inside plenty of things. A false match here would tell a team to
 * stop a drug the patient needs.
 */
function containsWord(haystack: string, needle: string): boolean {
  if (!needle) return false;
  for (let from = 0; ; ) {
    const i = haystack.indexOf(needle, from);
    if (i < 0) return false;
    const startsClean = !isWordChar(needle[0]) || !isWordChar(haystack[i - 1]);
    const endsClean =
      !isWordChar(needle[needle.length - 1]) || !isWordChar(haystack[i + needle.length]);
    if (startsClean && endsClean) return true;
    from = i + 1;
  }
}

/**
 * Guidance for one medication, or null when the drug is not recognised.
 *
 * Null is a real answer and the caller must show it as "review manually"
 * rather than as "nothing to do".
 */
export function adviseOnMedication(medicationName: string): PreopMedicationAdvice | null {
  const name = String(medicationName || '').toLowerCase().trim();
  if (!name) return null;

  for (const rule of RULES) {
    if (rule.names.some(n => containsWord(name, n))) {
      return {
        klass: rule.klass,
        action: rule.action,
        timing: rule.timing,
        reason: rule.reason,
        confirmationRequired: true,
      };
    }
  }
  return null;
}

export interface AdvisedMedication<T> {
  medication: T;
  advice: PreopMedicationAdvice | null;
}

/**
 * Annotate a patient's medication list.
 *
 * Order is preserved: the list is what the ward sees, and reordering it by
 * severity would make it hard to check against the drug chart.
 */
export function adviseOnMedications<T extends { medication_name?: string; name?: string }>(
  medications: T[]
): AdvisedMedication<T>[] {
  return (medications || []).map(m => ({
    medication: m,
    advice: adviseOnMedication(m.medication_name || m.name || ''),
  }));
}

/** How the actions should read and colour in an interface. */
export const PREOP_ACTION_META: Record<PreopAction, { label: string; tone: string }> = {
  stop: { label: 'Stop before surgery', tone: 'text-red-700 bg-red-50 border-red-200' },
  continue: { label: 'Continue', tone: 'text-green-700 bg-green-50 border-green-200' },
  adjust: { label: 'Adjust / omit dose', tone: 'text-amber-700 bg-amber-50 border-amber-200' },
  'seek-advice': { label: 'Seek advice', tone: 'text-blue-700 bg-blue-50 border-blue-200' },
};

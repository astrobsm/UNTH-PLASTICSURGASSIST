// Secondary renal-dosing table (moved unchanged from medicationDosingService).
// Read only through src/data/renalDosing.ts, which ranks it below the BNF
// database reference and labels it "secondary source - pharmacist to verify".

// GFR-based dosing adjustments for common medications
export const GFR_DOSING_DATABASE: Record<string, {
  normal: { dose: string; frequency: string };
  mild: { dose: string; frequency: string };
  moderate: { dose: string; frequency: string };
  severe: { dose: string; frequency: string };
  kidney_failure: { dose: string; frequency: string; contraindicated?: boolean };
  notes?: string;
}> = {
  // Antibiotics
  'Amoxicillin': {
    normal: { dose: '500mg-1g', frequency: 'TDS' },
    mild: { dose: '500mg-1g', frequency: 'TDS' },
    moderate: { dose: '500mg', frequency: 'BD' },
    severe: { dose: '500mg', frequency: 'OD' },
    kidney_failure: { dose: '250-500mg', frequency: 'OD' },
    notes: 'Reduce dose and frequency with declining GFR'
  },
  'Ciprofloxacin': {
    normal: { dose: '500mg', frequency: 'BD' },
    mild: { dose: '500mg', frequency: 'BD' },
    moderate: { dose: '250-500mg', frequency: 'BD' },
    severe: { dose: '250mg', frequency: 'BD' },
    kidney_failure: { dose: '250mg', frequency: 'OD' },
    notes: 'Accumulates in renal impairment; consider alternative'
  },
  'Levofloxacin': {
    normal: { dose: '500mg', frequency: 'OD' },
    mild: { dose: '500mg', frequency: 'OD' },
    moderate: { dose: '250mg', frequency: 'OD' },
    severe: { dose: '250mg', frequency: 'Every 48 hours' },
    kidney_failure: { dose: '250mg', frequency: 'Every 48 hours' },
    notes: 'Significant renal elimination; adjust for GFR'
  },
  'Metronidazole': {
    normal: { dose: '500mg', frequency: 'TDS' },
    mild: { dose: '500mg', frequency: 'TDS' },
    moderate: { dose: '500mg', frequency: 'BD' },
    severe: { dose: '500mg', frequency: 'BD' },
    kidney_failure: { dose: '500mg', frequency: 'BD' },
    notes: 'Accumulation of metabolites in severe renal impairment'
  },
  'Gentamicin': {
    normal: { dose: '5-7mg/kg', frequency: 'OD' },
    mild: { dose: '5mg/kg', frequency: 'Every 36-48 hours' },
    moderate: { dose: '3-5mg/kg', frequency: 'Every 48-72 hours' },
    severe: { dose: '2-3mg/kg', frequency: 'Every 72 hours', },
    kidney_failure: { dose: 'Avoid', frequency: 'N/A', contraindicated: true },
    notes: 'Nephrotoxic; avoid in severe renal impairment. Monitor levels.'
  },
  'Ceftriaxone': {
    normal: { dose: '1-2g', frequency: 'OD' },
    mild: { dose: '1-2g', frequency: 'OD' },
    moderate: { dose: '1-2g', frequency: 'OD' },
    severe: { dose: '1g', frequency: 'OD' },
    kidney_failure: { dose: '1g', frequency: 'OD' },
    notes: 'Does not require significant dose adjustment; dual elimination'
  },
  // Analgesics
  'Paracetamol': {
    normal: { dose: '1g', frequency: 'QID' },
    mild: { dose: '1g', frequency: 'QID' },
    moderate: { dose: '1g', frequency: 'QID' },
    severe: { dose: '500mg-1g', frequency: 'TDS' },
    kidney_failure: { dose: '500mg', frequency: 'TDS' },
    notes: 'Generally safe; extend interval in severe impairment'
  },
  'Ibuprofen': {
    normal: { dose: '400-600mg', frequency: 'TDS' },
    mild: { dose: '400mg', frequency: 'TDS' },
    moderate: { dose: '200-400mg', frequency: 'BD' },
    severe: { dose: 'Avoid', frequency: 'N/A', },
    kidney_failure: { dose: 'Avoid', frequency: 'N/A', contraindicated: true },
    notes: 'NSAIDs can worsen renal function; avoid in CKD Stage 4-5'
  },
  'Diclofenac': {
    normal: { dose: '50mg', frequency: 'TDS' },
    mild: { dose: '50mg', frequency: 'BD' },
    moderate: { dose: '25-50mg', frequency: 'BD' },
    severe: { dose: 'Avoid', frequency: 'N/A' },
    kidney_failure: { dose: 'Avoid', frequency: 'N/A', contraindicated: true },
    notes: 'NSAIDs contraindicated in severe renal impairment'
  },
  'Tramadol': {
    normal: { dose: '50-100mg', frequency: 'Q6H' },
    mild: { dose: '50-100mg', frequency: 'Q6H' },
    moderate: { dose: '50mg', frequency: 'Q8H' },
    severe: { dose: '50mg', frequency: 'Q12H' },
    kidney_failure: { dose: '25-50mg', frequency: 'Q12H' },
    notes: 'Active metabolite accumulates; extend dosing interval'
  },
  'Morphine': {
    normal: { dose: '5-10mg', frequency: 'Q4H PRN' },
    mild: { dose: '5-10mg', frequency: 'Q4H PRN' },
    moderate: { dose: '2.5-5mg', frequency: 'Q6H PRN' },
    severe: { dose: '2.5mg', frequency: 'Q8H PRN' },
    kidney_failure: { dose: 'Use with caution', frequency: 'Q8-12H PRN' },
    notes: 'Active metabolites accumulate; prefer fentanyl in ESRD'
  },
  // Cardiovascular
  'Enoxaparin': {
    normal: { dose: '1mg/kg', frequency: 'BD' },
    mild: { dose: '1mg/kg', frequency: 'BD' },
    moderate: { dose: '0.75mg/kg', frequency: 'BD' },
    severe: { dose: '1mg/kg', frequency: 'OD' },
    kidney_failure: { dose: '0.5mg/kg', frequency: 'OD' },
    notes: 'Accumulates in renal impairment; monitor anti-Xa levels'
  },
  'Lisinopril': {
    normal: { dose: '10-20mg', frequency: 'OD' },
    mild: { dose: '10-20mg', frequency: 'OD' },
    moderate: { dose: '5-10mg', frequency: 'OD' },
    severe: { dose: '2.5-5mg', frequency: 'OD' },
    kidney_failure: { dose: '2.5mg', frequency: 'OD' },
    notes: 'Start low and titrate; monitor K+ and creatinine'
  },
  'Metformin': {
    normal: { dose: '500-1000mg', frequency: 'BD' },
    mild: { dose: '500-1000mg', frequency: 'BD' },
    moderate: { dose: '500mg', frequency: 'BD' },
    severe: { dose: 'Avoid', frequency: 'N/A' },
    kidney_failure: { dose: 'Contraindicated', frequency: 'N/A', contraindicated: true },
    notes: 'Contraindicated if GFR <30 due to lactic acidosis risk'
  },
  // Antifungals
  'Fluconazole': {
    normal: { dose: '200-400mg', frequency: 'OD' },
    mild: { dose: '200-400mg', frequency: 'OD' },
    moderate: { dose: '100-200mg', frequency: 'OD' },
    severe: { dose: '50-100mg', frequency: 'OD' },
    kidney_failure: { dose: '50mg', frequency: 'OD' },
    notes: 'Reduce dose by 50% in severe renal impairment'
  },
  // Anticonvulsants
  'Gabapentin': {
    normal: { dose: '300-600mg', frequency: 'TDS' },
    mild: { dose: '200-300mg', frequency: 'TDS' },
    moderate: { dose: '200-300mg', frequency: 'BD' },
    severe: { dose: '100-200mg', frequency: 'OD' },
    kidney_failure: { dose: '100mg', frequency: 'After dialysis' },
    notes: 'Significantly accumulates; dose reduction essential'
  },
  'Pregabalin': {
    normal: { dose: '150-300mg', frequency: 'BD' },
    mild: { dose: '75-150mg', frequency: 'BD' },
    moderate: { dose: '75mg', frequency: 'BD' },
    severe: { dose: '25-75mg', frequency: 'OD' },
    kidney_failure: { dose: '25mg', frequency: 'After dialysis' },
    notes: 'Renal elimination; significant dose reduction required'
  },
};

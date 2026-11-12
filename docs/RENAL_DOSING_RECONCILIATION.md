# Renal dosing — reconciliation sheet

Generated from the app's three renal-dosing tables by `scripts/renalDosingReport.ts`. Regenerate it after any change to the drug data.

The app reads these tables through one resolver (`src/data/renalDosing.ts`), in this order:
1. **BNF database (reference)**, `src/data/bnfDrugDatabase.ts`. This is the prescribing catalogue.
2. **BNF medications table (secondary)**, `src/data/bnfMedications.ts`. Used only when the reference has nothing for the drug.
3. **GFR dosing table (secondary)**, `src/data/gfrDosingTable.ts`. Used last.

When more than one table holds data for a drug, the prescriber sees all of them, marked "sources differ — confirm". Guidance from a secondary table is labelled "pharmacist to verify".

**For the pharmacist:** for each drug below marked *sources differ* or *secondary only*, confirm the correct guidance. Then correct the reference entry, and delete the secondary rows for that drug once the reference covers it.

- Drugs with renal data: 94
- Held in more than one table: 33
- Held only in a secondary table: 30

### Aciclovir (Acyclovir)

Status: reference only

| CrCl | BNF database (reference) |
|---|---|
| CrCl > 50 mL/min | Dose adjustment needed in renal impairment (no band detail in the reference table) |
| CrCl 30–50 mL/min | Dose adjustment needed in renal impairment (no band detail in the reference table) |
| CrCl 10–29 mL/min | Dose adjustment needed in renal impairment (no band detail in the reference table) |
| CrCl < 10 mL/min | Dose adjustment needed in renal impairment (no band detail in the reference table) |

### Allopurinol

Status: reference only

| CrCl | BNF database (reference) |
|---|---|
| CrCl > 50 mL/min | Dose adjustment needed in renal impairment (no band detail in the reference table) |
| CrCl 30–50 mL/min | Dose adjustment needed in renal impairment (no band detail in the reference table) |
| CrCl 10–29 mL/min | Dose adjustment needed in renal impairment (no band detail in the reference table) |
| CrCl < 10 mL/min | Dose adjustment needed in renal impairment (no band detail in the reference table) |

### Amlodipine

Status: secondary only — verify

| CrCl | BNF medications table (secondary) |
|---|---|
| CrCl > 50 mL/min | GFR >0: No adjustment OD — Not removed by dialysis |
| CrCl 30–50 mL/min | GFR >0: No adjustment OD — Not removed by dialysis |
| CrCl 10–29 mL/min | GFR >0: No adjustment OD — Not removed by dialysis |
| CrCl < 10 mL/min | GFR >0: No adjustment OD — Not removed by dialysis |

### Amoxicillin

Status: **sources differ — reconcile**

| CrCl | BNF database (reference) | BNF medications table (secondary) | GFR dosing table (secondary) |
|---|---|---|---|
| CrCl > 50 mL/min | GFR 10-30: 250-500mg q12h. GFR <10: 250-500mg q24h (threshold <30 ml/min) | GFR >60: No adjustment TDS — Normal dosing | 500mg-1g TDS — Reduce dose and frequency with declining GFR |
| CrCl 30–50 mL/min | GFR 10-30: 250-500mg q12h. GFR <10: 250-500mg q24h (threshold <30 ml/min) | GFR 30-59: 500mg BD — Reduce frequency | 500mg BD — Reduce dose and frequency with declining GFR |
| CrCl 10–29 mL/min | GFR 10-30: 250-500mg q12h. GFR <10: 250-500mg q24h (threshold <30 ml/min) | GFR 15-29: 500mg OD — Significant reduction needed | 500mg OD — Reduce dose and frequency with declining GFR |
| CrCl < 10 mL/min | GFR 10-30: 250-500mg q12h. GFR <10: 250-500mg q24h (threshold <30 ml/min) | GFR <15: 250-500mg OD — Use with caution in ESRD | 250-500mg OD — Reduce dose and frequency with declining GFR |

### Amoxicillin/Clavulanic Acid (Co-Amoxiclav)

Status: **sources differ — reconcile**

| CrCl | BNF database (reference) | BNF medications table (secondary) |
|---|---|---|
| CrCl > 50 mL/min | GFR 10-30: 375-625mg q12h. GFR <10: 375mg q24h. (threshold <30 ml/min) | GFR >30: No adjustment TDS — Normal dosing |
| CrCl 30–50 mL/min | GFR 10-30: 375-625mg q12h. GFR <10: 375mg q24h. (threshold <30 ml/min) | GFR >30: No adjustment TDS — Normal dosing |
| CrCl 10–29 mL/min | GFR 10-30: 375-625mg q12h. GFR <10: 375mg q24h. (threshold <30 ml/min) | GFR 10-30: 625mg oral or 1.2g IV BD — Reduce frequency |
| CrCl < 10 mL/min | GFR 10-30: 375-625mg q12h. GFR <10: 375mg q24h. (threshold <30 ml/min) | GFR <10: 375mg oral or 600mg IV BD — Reduce dose and frequency |

### Ascorbic Acid (Vitamin C)

Status: **sources differ — reconcile**

| CrCl | BNF database (reference) | BNF medications table (secondary) |
|---|---|---|
| CrCl > 50 mL/min | Monitor renal function. High doses may cause oxalate stones. Avoid >500mg/day if renal stones history. | GFR >30: No adjustment Standard — Normal dosing |
| CrCl 30–50 mL/min | Monitor renal function. High doses may cause oxalate stones. Avoid >500mg/day if renal stones history. | GFR >30: No adjustment Standard — Normal dosing |
| CrCl 10–29 mL/min | Monitor renal function. High doses may cause oxalate stones. Avoid >500mg/day if renal stones history. | GFR <30: Max 200mg/day OD — Oxalate crystal risk in renal impairment |
| CrCl < 10 mL/min | Monitor renal function. High doses may cause oxalate stones. Avoid >500mg/day if renal stones history. | GFR <30: Max 200mg/day OD — Oxalate crystal risk in renal impairment |

### Aspirin (Acetylsalicylic Acid)

Status: reference only

| CrCl | BNF database (reference) |
|---|---|
| CrCl > 50 mL/min | Dose adjustment needed in renal impairment (no band detail in the reference table) |
| CrCl 30–50 mL/min | Dose adjustment needed in renal impairment (no band detail in the reference table) |
| CrCl 10–29 mL/min | Dose adjustment needed in renal impairment (no band detail in the reference table) |
| CrCl < 10 mL/min | Dose adjustment needed in renal impairment (no band detail in the reference table) |

### Atenolol

Status: **sources differ — reconcile**

| CrCl | BNF database (reference) | BNF medications table (secondary) |
|---|---|---|
| CrCl > 50 mL/min | GFR 15-35: 50mg od or 25mg od. GFR <15: 25mg od or 50mg alternate days. (threshold <35 ml/min) | GFR >35: No adjustment OD — Normal dosing |
| CrCl 30–50 mL/min | GFR 15-35: 50mg od or 25mg od. GFR <15: 25mg od or 50mg alternate days. (threshold <35 ml/min) | GFR >35: No adjustment OD — Normal dosing |
| CrCl 10–29 mL/min | GFR 15-35: 50mg od or 25mg od. GFR <15: 25mg od or 50mg alternate days. (threshold <35 ml/min) | GFR 15-34: 50mg OD or alternate days — Reduce dose/frequency |
| CrCl < 10 mL/min | GFR 15-35: 50mg od or 25mg od. GFR <15: 25mg od or 50mg alternate days. (threshold <35 ml/min) | GFR <15: 25mg OD or alternate days — Max 25mg/day or 50mg alternate days |

### Azathioprine

Status: reference only

| CrCl | BNF database (reference) |
|---|---|
| CrCl > 50 mL/min | Dose adjustment needed in renal impairment (no band detail in the reference table) |
| CrCl 30–50 mL/min | Dose adjustment needed in renal impairment (no band detail in the reference table) |
| CrCl 10–29 mL/min | Dose adjustment needed in renal impairment (no band detail in the reference table) |
| CrCl < 10 mL/min | Dose adjustment needed in renal impairment (no band detail in the reference table) |

### Azithromycin

Status: secondary only — verify

| CrCl | BNF medications table (secondary) |
|---|---|
| CrCl > 50 mL/min | GFR >10: No adjustment OD — Primarily biliary/faecal elimination |
| CrCl 30–50 mL/min | GFR >10: No adjustment OD — Primarily biliary/faecal elimination |
| CrCl 10–29 mL/min | GFR >10: No adjustment OD — Primarily biliary/faecal elimination |
| CrCl < 10 mL/min | GFR <10: Use with caution OD — Limited data in severe renal impairment |

### Baclofen

Status: **sources differ — reconcile**

| CrCl | BNF database (reference) | BNF medications table (secondary) |
|---|---|---|
| CrCl > 50 mL/min | Dose adjustment needed in renal impairment (no band detail in the reference table) | GFR >30: No adjustment TDS — Start low and titrate |
| CrCl 30–50 mL/min | Dose adjustment needed in renal impairment (no band detail in the reference table) | GFR >30: No adjustment TDS — Start low and titrate |
| CrCl 10–29 mL/min | Dose adjustment needed in renal impairment (no band detail in the reference table) | GFR 15-29: 5mg TDS TDS — Start at lowest dose |
| CrCl < 10 mL/min | Dose adjustment needed in renal impairment (no band detail in the reference table) | GFR <15: 5mg OD OD-BD — High risk of toxicity - avoid if possible |

### Bupivacaine

Status: secondary only — verify

| CrCl | BNF medications table (secondary) |
|---|---|
| CrCl > 50 mL/min | GFR >0: No adjustment for local use Standard — Hepatic metabolism |
| CrCl 30–50 mL/min | GFR >0: No adjustment for local use Standard — Hepatic metabolism |
| CrCl 10–29 mL/min | GFR >0: No adjustment for local use Standard — Hepatic metabolism |
| CrCl < 10 mL/min | GFR >0: No adjustment for local use Standard — Hepatic metabolism |

### Calcium Gluconate

Status: reference only

| CrCl | BNF database (reference) |
|---|---|
| CrCl > 50 mL/min | Monitor renal function (no band detail in the reference table) |
| CrCl 30–50 mL/min | Monitor renal function (no band detail in the reference table) |
| CrCl 10–29 mL/min | Monitor renal function (no band detail in the reference table) |
| CrCl < 10 mL/min | Monitor renal function (no band detail in the reference table) |

### Ceftriaxone

Status: **sources differ — reconcile**

| CrCl | BNF database (reference) | BNF medications table (secondary) | GFR dosing table (secondary) |
|---|---|---|---|
| CrCl > 50 mL/min | No dose adjustment needed if isolated renal impairment. Max 2g/day if combined renal + hepatic impairment. | GFR >10: No adjustment required OD — Dual hepatic/renal elimination | 1-2g OD — Does not require significant dose adjustment; dual elimination |
| CrCl 30–50 mL/min | No dose adjustment needed if isolated renal impairment. Max 2g/day if combined renal + hepatic impairment. | GFR >10: No adjustment required OD — Dual hepatic/renal elimination | 1-2g OD — Does not require significant dose adjustment; dual elimination |
| CrCl 10–29 mL/min | No dose adjustment needed if isolated renal impairment. Max 2g/day if combined renal + hepatic impairment. | GFR >10: No adjustment required OD — Dual hepatic/renal elimination | 1g OD — Does not require significant dose adjustment; dual elimination |
| CrCl < 10 mL/min | No dose adjustment needed if isolated renal impairment. Max 2g/day if combined renal + hepatic impairment. | GFR <10: Max 2g/day OD — Max 2g daily in severe renal impairment | 1g OD — Does not require significant dose adjustment; dual elimination |

### Cefuroxime

Status: **sources differ — reconcile**

| CrCl | BNF database (reference) | BNF medications table (secondary) |
|---|---|---|
| CrCl > 50 mL/min | GFR 10-20: standard dose q12h. GFR <10: standard dose q24h (threshold <20 ml/min) | GFR >20: No adjustment TDS — Normal dosing |
| CrCl 30–50 mL/min | GFR 10-20: standard dose q12h. GFR <10: standard dose q24h (threshold <20 ml/min) | GFR >20: No adjustment TDS — Normal dosing |
| CrCl 10–29 mL/min | GFR 10-20: standard dose q12h. GFR <10: standard dose q24h (threshold <20 ml/min) | GFR >20: No adjustment TDS — Normal dosing |
| CrCl < 10 mL/min | GFR 10-20: standard dose q12h. GFR <10: standard dose q24h (threshold <20 ml/min) | GFR <10: 750mg OD — Significant reduction |

### Cetirizine

Status: reference only

| CrCl | BNF database (reference) |
|---|---|
| CrCl > 50 mL/min | GFR <30: 5mg od (threshold <30 ml/min) |
| CrCl 30–50 mL/min | GFR <30: 5mg od (threshold <30 ml/min) |
| CrCl 10–29 mL/min | GFR <30: 5mg od (threshold <30 ml/min) |
| CrCl < 10 mL/min | GFR <30: 5mg od (threshold <30 ml/min) |

### Ciprofloxacin

Status: **sources differ — reconcile**

| CrCl | BNF database (reference) | BNF medications table (secondary) | GFR dosing table (secondary) |
|---|---|---|---|
| CrCl > 50 mL/min | GFR 30-60: oral dose unchanged; GFR <30: 250-500mg q24h oral; IV 200mg q12h (threshold <30 ml/min) | GFR >30: No adjustment BD — Normal dosing | 500mg BD — Accumulates in renal impairment; consider alternative |
| CrCl 30–50 mL/min | GFR 30-60: oral dose unchanged; GFR <30: 250-500mg q24h oral; IV 200mg q12h (threshold <30 ml/min) | GFR >30: No adjustment BD — Normal dosing | 250-500mg BD — Accumulates in renal impairment; consider alternative |
| CrCl 10–29 mL/min | GFR 30-60: oral dose unchanged; GFR <30: 250-500mg q24h oral; IV 200mg q12h (threshold <30 ml/min) | GFR 15-29: 250-500mg oral or 200-400mg IV BD — Reduce dose | 250mg BD — Accumulates in renal impairment; consider alternative |
| CrCl < 10 mL/min | GFR 30-60: oral dose unchanged; GFR <30: 250-500mg q24h oral; IV 200mg q12h (threshold <30 ml/min) | GFR <15: 250mg oral or 200mg IV OD — Significant reduction required | 250mg OD — Accumulates in renal impairment; consider alternative |

### Clindamycin

Status: secondary only — verify

| CrCl | BNF medications table (secondary) |
|---|---|
| CrCl > 50 mL/min | GFR >10: No adjustment QDS — Hepatic elimination |
| CrCl 30–50 mL/min | GFR >10: No adjustment QDS — Hepatic elimination |
| CrCl 10–29 mL/min | GFR >10: No adjustment QDS — Hepatic elimination |
| CrCl < 10 mL/min | GFR <10: No adjustment usually needed QDS — Not removed by dialysis |

### Cloxacillin (Flucloxacillin)

Status: reference only

| CrCl | BNF database (reference) |
|---|---|
| CrCl > 50 mL/min | No dose adjustment usually needed. Reduce in severe impairment. |
| CrCl 30–50 mL/min | No dose adjustment usually needed. Reduce in severe impairment. |
| CrCl 10–29 mL/min | No dose adjustment usually needed. Reduce in severe impairment. |
| CrCl < 10 mL/min | No dose adjustment usually needed. Reduce in severe impairment. |

### Co-trimoxazole (Sulfamethoxazole/Trimethoprim)

Status: reference only

| CrCl | BNF database (reference) |
|---|---|
| CrCl > 50 mL/min | Dose adjustment needed in renal impairment (no band detail in the reference table) |
| CrCl 30–50 mL/min | Dose adjustment needed in renal impairment (no band detail in the reference table) |
| CrCl 10–29 mL/min | Dose adjustment needed in renal impairment (no band detail in the reference table) |
| CrCl < 10 mL/min | Dose adjustment needed in renal impairment (no band detail in the reference table) |

### Colchicine

Status: reference only

| CrCl | BNF database (reference) |
|---|---|
| CrCl > 50 mL/min | Dose adjustment needed in renal impairment (no band detail in the reference table) |
| CrCl 30–50 mL/min | Dose adjustment needed in renal impairment (no band detail in the reference table) |
| CrCl 10–29 mL/min | Dose adjustment needed in renal impairment (no band detail in the reference table) |
| CrCl < 10 mL/min | Dose adjustment needed in renal impairment (no band detail in the reference table) |

### Dexamethasone

Status: secondary only — verify

| CrCl | BNF medications table (secondary) |
|---|---|
| CrCl > 50 mL/min | GFR >0: No renal adjustment Standard — Hepatic metabolism |
| CrCl 30–50 mL/min | GFR >0: No renal adjustment Standard — Hepatic metabolism |
| CrCl 10–29 mL/min | GFR >0: No renal adjustment Standard — Hepatic metabolism |
| CrCl < 10 mL/min | GFR >0: No renal adjustment Standard — Hepatic metabolism |

### Diazepam

Status: secondary only — verify

| CrCl | BNF medications table (secondary) |
|---|---|
| CrCl > 50 mL/min | GFR >0: Start low, titrate cautiously Standard — Hepatic metabolism; active metabolites may accumulate in renal impairment |
| CrCl 30–50 mL/min | GFR >0: Start low, titrate cautiously Standard — Hepatic metabolism; active metabolites may accumulate in renal impairment |
| CrCl 10–29 mL/min | GFR >0: Start low, titrate cautiously Standard — Hepatic metabolism; active metabolites may accumulate in renal impairment |
| CrCl < 10 mL/min | GFR >0: Start low, titrate cautiously Standard — Hepatic metabolism; active metabolites may accumulate in renal impairment |

### Diclofenac Sodium

Status: **sources differ — reconcile**

| CrCl | BNF database (reference) | BNF medications table (secondary) | GFR dosing table (secondary) |
|---|---|---|---|
| CrCl > 50 mL/min | Avoid if GFR <30 (threshold <30 ml/min) | GFR >60: Lowest effective dose BD-TDS — Short courses preferred | 50mg BD — NSAIDs contraindicated in severe renal impairment |
| CrCl 30–50 mL/min | Avoid if GFR <30 (threshold <30 ml/min) | GFR 30-59: 25-50mg BD — Use with extreme caution | 25-50mg BD — NSAIDs contraindicated in severe renal impairment |
| CrCl 10–29 mL/min | Avoid if GFR <30 (threshold <30 ml/min) | GFR <30: AVOID  — Contraindicated | Avoid N/A — NSAIDs contraindicated in severe renal impairment |
| CrCl < 10 mL/min | Avoid if GFR <30 (threshold <30 ml/min) | GFR <30: AVOID  — Contraindicated | Avoid N/A — NSAIDs contraindicated in severe renal impairment |

### Digoxin

Status: reference only

| CrCl | BNF database (reference) |
|---|---|
| CrCl > 50 mL/min | Dose adjustment needed in renal impairment (no band detail in the reference table) |
| CrCl 30–50 mL/min | Dose adjustment needed in renal impairment (no band detail in the reference table) |
| CrCl 10–29 mL/min | Dose adjustment needed in renal impairment (no band detail in the reference table) |
| CrCl < 10 mL/min | Dose adjustment needed in renal impairment (no band detail in the reference table) |

### Doxycycline

Status: secondary only — verify

| CrCl | BNF medications table (secondary) |
|---|---|
| CrCl > 50 mL/min | GFR >10: No adjustment OD — Does not accumulate in renal impairment (unlike other tetracyclines) |
| CrCl 30–50 mL/min | GFR >10: No adjustment OD — Does not accumulate in renal impairment (unlike other tetracyclines) |
| CrCl 10–29 mL/min | GFR >10: No adjustment OD — Does not accumulate in renal impairment (unlike other tetracyclines) |
| CrCl < 10 mL/min | GFR <10: No adjustment OD — Safe in renal impairment - preferred tetracycline |

### Enoxaparin (LMWH)

Status: **sources differ — reconcile**

| CrCl | BNF database (reference) | BNF medications table (secondary) | GFR dosing table (secondary) |
|---|---|---|---|
| CrCl > 50 mL/min | GFR <30: Prophylaxis 20mg od; Treatment 1mg/kg od (not q12h). Monitor anti-Xa levels. (threshold <30 ml/min) | GFR >30: No adjustment Standard — Normal dosing | 1mg/kg BD — Accumulates in renal impairment; monitor anti-Xa levels |
| CrCl 30–50 mL/min | GFR <30: Prophylaxis 20mg od; Treatment 1mg/kg od (not q12h). Monitor anti-Xa levels. (threshold <30 ml/min) | GFR >30: No adjustment Standard — Normal dosing | 0.75mg/kg BD — Accumulates in renal impairment; monitor anti-Xa levels |
| CrCl 10–29 mL/min | GFR <30: Prophylaxis 20mg od; Treatment 1mg/kg od (not q12h). Monitor anti-Xa levels. (threshold <30 ml/min) | GFR 15-29: Treatment: 1mg/kg OD; Prophylaxis: 20mg OD OD — Significant accumulation - monitor anti-Xa | 1mg/kg OD — Accumulates in renal impairment; monitor anti-Xa levels |
| CrCl < 10 mL/min | GFR <30: Prophylaxis 20mg od; Treatment 1mg/kg od (not q12h). Monitor anti-Xa levels. (threshold <30 ml/min) | GFR <15: Avoid or use UFH  — Use unfractionated heparin instead | 0.5mg/kg OD — Accumulates in renal impairment; monitor anti-Xa levels |

### Erythromycin

Status: secondary only — verify

| CrCl | BNF medications table (secondary) |
|---|---|
| CrCl > 50 mL/min | GFR >10: No adjustment QDS — Hepatic elimination |
| CrCl 30–50 mL/min | GFR >10: No adjustment QDS — Hepatic elimination |
| CrCl 10–29 mL/min | GFR >10: No adjustment QDS — Hepatic elimination |
| CrCl < 10 mL/min | GFR <10: 50-75% of standard dose BD-TDS — Ototoxicity risk increases |

### Famotidine (Ranitidine withdrawn in many countries)

Status: secondary only — verify

| CrCl | BNF medications table (secondary) |
|---|---|
| CrCl > 50 mL/min | GFR >50: No adjustment BD — Normal dosing |
| CrCl 30–50 mL/min | GFR 10-49: 20mg OD — Reduce frequency |
| CrCl 10–29 mL/min | GFR 10-49: 20mg OD — Reduce frequency |
| CrCl < 10 mL/min | GFR <10: 20mg Every 48h — Significant reduction needed |

### Fentanyl

Status: secondary only — verify

| CrCl | BNF medications table (secondary) |
|---|---|
| CrCl > 50 mL/min | GFR >10: No significant adjustment Standard — Preferred opioid in renal impairment - no active metabolites |
| CrCl 30–50 mL/min | GFR >10: No significant adjustment Standard — Preferred opioid in renal impairment - no active metabolites |
| CrCl 10–29 mL/min | GFR >10: No significant adjustment Standard — Preferred opioid in renal impairment - no active metabolites |
| CrCl < 10 mL/min | GFR <10: Start 25-50% lower Standard — Mild accumulation possible - start low |

### Ferrous Sulfate

Status: secondary only — verify

| CrCl | BNF medications table (secondary) |
|---|---|
| CrCl > 50 mL/min | GFR >0: No adjustment Standard — Consider IV iron if GFR<30 and on EPO |
| CrCl 30–50 mL/min | GFR >0: No adjustment Standard — Consider IV iron if GFR<30 and on EPO |
| CrCl 10–29 mL/min | GFR >0: No adjustment Standard — Consider IV iron if GFR<30 and on EPO |
| CrCl < 10 mL/min | GFR >0: No adjustment Standard — Consider IV iron if GFR<30 and on EPO |

### Flucloxacillin

Status: secondary only — verify

| CrCl | BNF medications table (secondary) |
|---|---|
| CrCl > 50 mL/min | GFR >10: No adjustment needed QDS — Primarily hepatic elimination |
| CrCl 30–50 mL/min | GFR >10: No adjustment needed QDS — Primarily hepatic elimination |
| CrCl 10–29 mL/min | GFR >10: No adjustment needed QDS — Primarily hepatic elimination |
| CrCl < 10 mL/min | GFR <10: Use with caution QDS — Minimal renal adjustment needed |

### Fluconazole

Status: **sources differ — reconcile**

| CrCl | BNF database (reference) | BNF medications table (secondary) | GFR dosing table (secondary) |
|---|---|---|---|
| CrCl > 50 mL/min | GFR <50: give 50% of dose. Loading dose unchanged. (threshold <50 ml/min) | GFR >50: No adjustment OD — Normal dosing | 200-400mg OD — Reduce dose by 50% in severe renal impairment |
| CrCl 30–50 mL/min | GFR <50: give 50% of dose. Loading dose unchanged. (threshold <50 ml/min) | GFR 21-50: 50% of standard OD — Halve dose | 100-200mg OD — Reduce dose by 50% in severe renal impairment |
| CrCl 10–29 mL/min | GFR <50: give 50% of dose. Loading dose unchanged. (threshold <50 ml/min) | — | 50-100mg OD — Reduce dose by 50% in severe renal impairment |
| CrCl < 10 mL/min | GFR <50: give 50% of dose. Loading dose unchanged. (threshold <50 ml/min) | GFR <20: 50% of standard Every 48h — If on dialysis, give after dialysis session | 50mg OD — Reduce dose by 50% in severe renal impairment |

### Furosemide (Frusemide)

Status: reference only

| CrCl | BNF database (reference) |
|---|---|
| CrCl > 50 mL/min | Monitor renal function. Higher doses may be needed in renal impairment. Monitor electrolytes closely. |
| CrCl 30–50 mL/min | Monitor renal function. Higher doses may be needed in renal impairment. Monitor electrolytes closely. |
| CrCl 10–29 mL/min | Monitor renal function. Higher doses may be needed in renal impairment. Monitor electrolytes closely. |
| CrCl < 10 mL/min | Monitor renal function. Higher doses may be needed in renal impairment. Monitor electrolytes closely. |

### Gabapentin

Status: secondary only — verify

| CrCl | GFR dosing table (secondary) |
|---|---|
| CrCl > 50 mL/min | 200-300mg TDS — Significantly accumulates; dose reduction essential |
| CrCl 30–50 mL/min | 200-300mg BD — Significantly accumulates; dose reduction essential |
| CrCl 10–29 mL/min | 100-200mg OD — Significantly accumulates; dose reduction essential |
| CrCl < 10 mL/min | 100mg After dialysis — Significantly accumulates; dose reduction essential |

### Gelofusine (Succinylated Gelatin)

Status: reference only

| CrCl | BNF database (reference) |
|---|---|
| CrCl > 50 mL/min | Use with caution in renal impairment (no band detail in the reference table) |
| CrCl 30–50 mL/min | Use with caution in renal impairment (no band detail in the reference table) |
| CrCl 10–29 mL/min | Use with caution in renal impairment (no band detail in the reference table) |
| CrCl < 10 mL/min | Use with caution in renal impairment (no band detail in the reference table) |

### Gentamicin

Status: **sources differ — reconcile**

| CrCl | BNF database (reference) | BNF medications table (secondary) | GFR dosing table (secondary) |
|---|---|---|---|
| CrCl > 50 mL/min | MUST adjust. Monitor levels. GFR 40-60: q12h; GFR 20-40: q24h; GFR <20: q48h + levels (threshold <60 ml/min) | GFR >60: 5-7mg/kg OD — Normal dosing - monitor levels | 5mg/kg Every 36-48 hours — Nephrotoxic; avoid in severe renal impairment. Monitor levels. |
| CrCl 30–50 mL/min | MUST adjust. Monitor levels. GFR 40-60: q12h; GFR 20-40: q24h; GFR <20: q48h + levels (threshold <60 ml/min) | GFR 40-59: 5mg/kg Every 36h — Extended interval - check trough before re-dosing | 3-5mg/kg Every 48-72 hours — Nephrotoxic; avoid in severe renal impairment. Monitor levels. |
| CrCl 10–29 mL/min | MUST adjust. Monitor levels. GFR 40-60: q12h; GFR 20-40: q24h; GFR <20: q48h + levels (threshold <60 ml/min) | GFR 20-39: 3-5mg/kg Every 48h — Extended interval - monitor levels closely | 2-3mg/kg Every 72 hours — Nephrotoxic; avoid in severe renal impairment. Monitor levels. |
| CrCl < 10 mL/min | MUST adjust. Monitor levels. GFR 40-60: q12h; GFR 20-40: q24h; GFR <20: q48h + levels (threshold <60 ml/min) | GFR <20: Avoid if possible Single dose only — Extremely nephrotoxic - use alternative | Avoid N/A — Nephrotoxic; avoid in severe renal impairment. Monitor levels. |

### Glibenclamide (Glyburide)

Status: reference only

| CrCl | BNF database (reference) |
|---|---|
| CrCl > 50 mL/min | Avoid in renal impairment (no band detail in the reference table) |
| CrCl 30–50 mL/min | Avoid in renal impairment (no band detail in the reference table) |
| CrCl 10–29 mL/min | Avoid in renal impairment (no band detail in the reference table) |
| CrCl < 10 mL/min | Avoid in renal impairment (no band detail in the reference table) |

### Gliclazide

Status: reference only

| CrCl | BNF database (reference) |
|---|---|
| CrCl > 50 mL/min | Dose adjustment needed in renal impairment (no band detail in the reference table) |
| CrCl 30–50 mL/min | Dose adjustment needed in renal impairment (no band detail in the reference table) |
| CrCl 10–29 mL/min | Dose adjustment needed in renal impairment (no band detail in the reference table) |
| CrCl < 10 mL/min | Dose adjustment needed in renal impairment (no band detail in the reference table) |

### Glucose 5%

Status: secondary only — verify

| CrCl | BNF medications table (secondary) |
|---|---|
| CrCl > 50 mL/min | GFR >0: Monitor fluid balance As needed — Free water - risk of hyponatraemia |
| CrCl 30–50 mL/min | GFR >0: Monitor fluid balance As needed — Free water - risk of hyponatraemia |
| CrCl 10–29 mL/min | GFR >0: Monitor fluid balance As needed — Free water - risk of hyponatraemia |
| CrCl < 10 mL/min | GFR >0: Monitor fluid balance As needed — Free water - risk of hyponatraemia |

### Heparin Sodium

Status: secondary only — verify

| CrCl | BNF medications table (secondary) |
|---|---|
| CrCl > 50 mL/min | GFR >0: No adjustment for prophylactic dose Standard — Safe in all levels of renal impairment; preferred over LMWH in severe renal failure |
| CrCl 30–50 mL/min | GFR >0: No adjustment for prophylactic dose Standard — Safe in all levels of renal impairment; preferred over LMWH in severe renal failure |
| CrCl 10–29 mL/min | GFR >0: No adjustment for prophylactic dose Standard — Safe in all levels of renal impairment; preferred over LMWH in severe renal failure |
| CrCl < 10 mL/min | GFR >0: No adjustment for prophylactic dose Standard — Safe in all levels of renal impairment; preferred over LMWH in severe renal failure |

### Human Tetanus Immunoglobulin

Status: secondary only — verify

| CrCl | BNF medications table (secondary) |
|---|---|
| CrCl > 50 mL/min | GFR >0: No adjustment STAT — Safe in renal impairment |
| CrCl 30–50 mL/min | GFR >0: No adjustment STAT — Safe in renal impairment |
| CrCl 10–29 mL/min | GFR >0: No adjustment STAT — Safe in renal impairment |
| CrCl < 10 mL/min | GFR >0: No adjustment STAT — Safe in renal impairment |

### Hydralazine Hydrochloride

Status: reference only

| CrCl | BNF database (reference) |
|---|---|
| CrCl > 50 mL/min | Dose adjustment needed in renal impairment (no band detail in the reference table) |
| CrCl 30–50 mL/min | Dose adjustment needed in renal impairment (no band detail in the reference table) |
| CrCl 10–29 mL/min | Dose adjustment needed in renal impairment (no band detail in the reference table) |
| CrCl < 10 mL/min | Dose adjustment needed in renal impairment (no band detail in the reference table) |

### Hydrochlorothiazide

Status: reference only

| CrCl | BNF database (reference) |
|---|---|
| CrCl > 50 mL/min | Dose adjustment needed in renal impairment (no band detail in the reference table) |
| CrCl 30–50 mL/min | Dose adjustment needed in renal impairment (no band detail in the reference table) |
| CrCl 10–29 mL/min | Dose adjustment needed in renal impairment (no band detail in the reference table) |
| CrCl < 10 mL/min | Dose adjustment needed in renal impairment (no band detail in the reference table) |

### Hydrocortisone

Status: **sources differ — reconcile**

| CrCl | BNF database (reference) | BNF medications table (secondary) |
|---|---|---|
| CrCl > 50 mL/min | Monitor renal function (no band detail in the reference table) | GFR >0: No renal adjustment Standard — Hepatic metabolism; may worsen fluid retention in renal impairment |
| CrCl 30–50 mL/min | Monitor renal function (no band detail in the reference table) | GFR >0: No renal adjustment Standard — Hepatic metabolism; may worsen fluid retention in renal impairment |
| CrCl 10–29 mL/min | Monitor renal function (no band detail in the reference table) | GFR >0: No renal adjustment Standard — Hepatic metabolism; may worsen fluid retention in renal impairment |
| CrCl < 10 mL/min | Monitor renal function (no band detail in the reference table) | GFR >0: No renal adjustment Standard — Hepatic metabolism; may worsen fluid retention in renal impairment |

### Ibuprofen

Status: **sources differ — reconcile**

| CrCl | BNF database (reference) | BNF medications table (secondary) | GFR dosing table (secondary) |
|---|---|---|---|
| CrCl > 50 mL/min | Avoid if GFR <30. Use with caution if GFR 30-60. (threshold <30 ml/min) | GFR >60: No adjustment - use lowest effective dose TDS — Use shortest duration possible | 400mg TDS — NSAIDs can worsen renal function; avoid in CKD Stage 4-5 |
| CrCl 30–50 mL/min | Avoid if GFR <30. Use with caution if GFR 30-60. (threshold <30 ml/min) | GFR 30-59: 200-400mg BD — Use with extreme caution; monitor renal function | 200-400mg BD — NSAIDs can worsen renal function; avoid in CKD Stage 4-5 |
| CrCl 10–29 mL/min | Avoid if GFR <30. Use with caution if GFR 30-60. (threshold <30 ml/min) | GFR <30: AVOID  — Contraindicated in severe renal impairment | Avoid N/A — NSAIDs can worsen renal function; avoid in CKD Stage 4-5 |
| CrCl < 10 mL/min | Avoid if GFR <30. Use with caution if GFR 30-60. (threshold <30 ml/min) | GFR <30: AVOID  — Contraindicated in severe renal impairment | Avoid N/A — NSAIDs can worsen renal function; avoid in CKD Stage 4-5 |

### Insulin Soluble (Regular Insulin)

Status: **sources differ — reconcile**

| CrCl | BNF database (reference) | BNF medications table (secondary) |
|---|---|---|
| CrCl > 50 mL/min | Insulin requirements often DECREASE in renal impairment. Reduce dose and monitor closely. | GFR >50: No adjustment Standard — Normal dosing |
| CrCl 30–50 mL/min | Insulin requirements often DECREASE in renal impairment. Reduce dose and monitor closely. | GFR 30-49: Reduce by 25% Standard — Insulin clearance reduced |
| CrCl 10–29 mL/min | Insulin requirements often DECREASE in renal impairment. Reduce dose and monitor closely. | GFR 10-29: Reduce by 50% Standard — Significant reduction - high hypo risk |
| CrCl < 10 mL/min | Insulin requirements often DECREASE in renal impairment. Reduce dose and monitor closely. | GFR <10: Reduce by 50-75% Standard — Very high hypoglycaemia risk - close monitoring |

### Ketorolac Tromethamine

Status: **sources differ — reconcile**

| CrCl | BNF database (reference) | BNF medications table (secondary) |
|---|---|---|
| CrCl > 50 mL/min | Contraindicated in moderate-severe renal impairment | GFR >60: 10-15mg Q6H — Use lowest effective dose for shortest time |
| CrCl 30–50 mL/min | Contraindicated in moderate-severe renal impairment | GFR 30-59: 10mg Q8H — Reduce dose; monitor renal function |
| CrCl 10–29 mL/min | Contraindicated in moderate-severe renal impairment | GFR <30: CONTRAINDICATED  — Do not use |
| CrCl < 10 mL/min | Contraindicated in moderate-severe renal impairment | GFR <30: CONTRAINDICATED  — Do not use |

### Levetiracetam

Status: reference only

| CrCl | BNF database (reference) |
|---|---|
| CrCl > 50 mL/min | Dose adjustment needed in renal impairment (no band detail in the reference table) |
| CrCl 30–50 mL/min | Dose adjustment needed in renal impairment (no band detail in the reference table) |
| CrCl 10–29 mL/min | Dose adjustment needed in renal impairment (no band detail in the reference table) |
| CrCl < 10 mL/min | Dose adjustment needed in renal impairment (no band detail in the reference table) |

### Levofloxacin

Status: **sources differ — reconcile**

| CrCl | BNF database (reference) | BNF medications table (secondary) | GFR dosing table (secondary) |
|---|---|---|---|
| CrCl > 50 mL/min | GFR 20-49: 250mg q24h. GFR 10-19: 250mg q48h. (threshold <50 ml/min) | GFR >50: No adjustment OD-BD — Normal dosing | 500mg OD — Significant renal elimination; adjust for GFR |
| CrCl 30–50 mL/min | GFR 20-49: 250mg q24h. GFR 10-19: 250mg q48h. (threshold <50 ml/min) | GFR 20-49: 250mg OD-BD — Halve dose | 250mg OD — Significant renal elimination; adjust for GFR |
| CrCl 10–29 mL/min | GFR 20-49: 250mg q24h. GFR 10-19: 250mg q48h. (threshold <50 ml/min) | GFR 20-49: 250mg OD-BD — Halve dose | 250mg Every 48 hours — Significant renal elimination; adjust for GFR |
| CrCl < 10 mL/min | GFR 20-49: 250mg q24h. GFR 10-19: 250mg q48h. (threshold <50 ml/min) | GFR <20: 250mg Every 48h — Extended interval | 250mg Every 48 hours — Significant renal elimination; adjust for GFR |

### Lidocaine

Status: secondary only — verify

| CrCl | BNF medications table (secondary) |
|---|---|
| CrCl > 50 mL/min | GFR >0: No adjustment for local use Standard — Hepatic metabolism; reduce dose in severe hepatic impairment |
| CrCl 30–50 mL/min | GFR >0: No adjustment for local use Standard — Hepatic metabolism; reduce dose in severe hepatic impairment |
| CrCl 10–29 mL/min | GFR >0: No adjustment for local use Standard — Hepatic metabolism; reduce dose in severe hepatic impairment |
| CrCl < 10 mL/min | GFR >0: No adjustment for local use Standard — Hepatic metabolism; reduce dose in severe hepatic impairment |

### Lisinopril

Status: **sources differ — reconcile**

| CrCl | BNF database (reference) | BNF medications table (secondary) | GFR dosing table (secondary) |
|---|---|---|---|
| CrCl > 50 mL/min | GFR 30-70: start 5-10mg. GFR 10-30: start 2.5-5mg. GFR <10: start 2.5mg. (threshold <30 ml/min) | GFR >30: Start 5-10mg OD — Monitor K+ and creatinine at 1-2 weeks | 10-20mg OD — Start low and titrate; monitor K+ and creatinine |
| CrCl 30–50 mL/min | GFR 30-70: start 5-10mg. GFR 10-30: start 2.5-5mg. GFR <10: start 2.5mg. (threshold <30 ml/min) | GFR >30: Start 5-10mg OD — Monitor K+ and creatinine at 1-2 weeks | 5-10mg OD — Start low and titrate; monitor K+ and creatinine |
| CrCl 10–29 mL/min | GFR 30-70: start 5-10mg. GFR 10-30: start 2.5-5mg. GFR <10: start 2.5mg. (threshold <30 ml/min) | GFR 10-29: Start 2.5-5mg OD — Close monitoring of K+ and renal function | 2.5-5mg OD — Start low and titrate; monitor K+ and creatinine |
| CrCl < 10 mL/min | GFR 30-70: start 5-10mg. GFR 10-30: start 2.5-5mg. GFR <10: start 2.5mg. (threshold <30 ml/min) | GFR <10: Start 2.5mg OD — Very cautious titration | 2.5mg OD — Start low and titrate; monitor K+ and creatinine |

### Losartan Potassium

Status: **sources differ — reconcile**

| CrCl | BNF database (reference) | BNF medications table (secondary) |
|---|---|---|
| CrCl > 50 mL/min | Monitor renal function (no band detail in the reference table) | GFR >10: No significant adjustment OD — Monitor K+ and renal function |
| CrCl 30–50 mL/min | Monitor renal function (no band detail in the reference table) | GFR >10: No significant adjustment OD — Monitor K+ and renal function |
| CrCl 10–29 mL/min | Monitor renal function (no band detail in the reference table) | GFR >10: No significant adjustment OD — Monitor K+ and renal function |
| CrCl < 10 mL/min | Monitor renal function (no band detail in the reference table) | GFR <10: Start 25mg OD — Use with caution |

### Magnesium Sulfate

Status: reference only

| CrCl | BNF database (reference) |
|---|---|
| CrCl > 50 mL/min | Dose adjustment needed in renal impairment (no band detail in the reference table) |
| CrCl 30–50 mL/min | Dose adjustment needed in renal impairment (no band detail in the reference table) |
| CrCl 10–29 mL/min | Dose adjustment needed in renal impairment (no band detail in the reference table) |
| CrCl < 10 mL/min | Dose adjustment needed in renal impairment (no band detail in the reference table) |

### Mannitol

Status: reference only

| CrCl | BNF database (reference) |
|---|---|
| CrCl > 50 mL/min | Avoid in renal impairment (no band detail in the reference table) |
| CrCl 30–50 mL/min | Avoid in renal impairment (no band detail in the reference table) |
| CrCl 10–29 mL/min | Avoid in renal impairment (no band detail in the reference table) |
| CrCl < 10 mL/min | Avoid in renal impairment (no band detail in the reference table) |

### Meropenem

Status: **sources differ — reconcile**

| CrCl | BNF database (reference) | BNF medications table (secondary) |
|---|---|---|
| CrCl > 50 mL/min | Dose adjustment needed in renal impairment (no band detail in the reference table) | GFR >50: No adjustment TDS — Normal dosing |
| CrCl 30–50 mL/min | Dose adjustment needed in renal impairment (no band detail in the reference table) | GFR 26-50: Standard dose BD — Reduce to BD |
| CrCl 10–29 mL/min | Dose adjustment needed in renal impairment (no band detail in the reference table) | GFR 10-25: 50% of standard BD — Halve dose and reduce frequency |
| CrCl < 10 mL/min | Dose adjustment needed in renal impairment (no band detail in the reference table) | GFR <10: 50% of standard OD — Specialist guidance recommended |

### Metformin

Status: **sources differ — reconcile**

| CrCl | BNF database (reference) | BNF medications table (secondary) | GFR dosing table (secondary) |
|---|---|---|---|
| CrCl > 50 mL/min | GFR 30-45: max 1g/day with close monitoring. GFR <30: CONTRAINDICATED. (threshold <30 ml/min) | GFR >45: No adjustment BD — Normal dosing | 500-1000mg BD — Contraindicated if GFR <30 due to lactic acidosis risk |
| CrCl 30–50 mL/min | GFR 30-45: max 1g/day with close monitoring. GFR <30: CONTRAINDICATED. (threshold <30 ml/min) | GFR 30-44: Max 1g/day (500mg BD) BD — Reduce and monitor regularly | 500mg BD — Contraindicated if GFR <30 due to lactic acidosis risk |
| CrCl 10–29 mL/min | GFR 30-45: max 1g/day with close monitoring. GFR <30: CONTRAINDICATED. (threshold <30 ml/min) | GFR <30: CONTRAINDICATED  — Lactic acidosis risk | Avoid N/A — Contraindicated if GFR <30 due to lactic acidosis risk |
| CrCl < 10 mL/min | GFR 30-45: max 1g/day with close monitoring. GFR <30: CONTRAINDICATED. (threshold <30 ml/min) | GFR <30: CONTRAINDICATED  — Lactic acidosis risk | Contraindicated N/A — Contraindicated if GFR <30 due to lactic acidosis risk |

### Methotrexate

Status: reference only

| CrCl | BNF database (reference) |
|---|---|
| CrCl > 50 mL/min | Avoid in renal impairment (no band detail in the reference table) |
| CrCl 30–50 mL/min | Avoid in renal impairment (no band detail in the reference table) |
| CrCl 10–29 mL/min | Avoid in renal impairment (no band detail in the reference table) |
| CrCl < 10 mL/min | Avoid in renal impairment (no band detail in the reference table) |

### Methyldopa

Status: reference only

| CrCl | BNF database (reference) |
|---|---|
| CrCl > 50 mL/min | Dose adjustment needed in renal impairment (no band detail in the reference table) |
| CrCl 30–50 mL/min | Dose adjustment needed in renal impairment (no band detail in the reference table) |
| CrCl 10–29 mL/min | Dose adjustment needed in renal impairment (no band detail in the reference table) |
| CrCl < 10 mL/min | Dose adjustment needed in renal impairment (no band detail in the reference table) |

### Metoclopramide

Status: **sources differ — reconcile**

| CrCl | BNF database (reference) | BNF medications table (secondary) |
|---|---|---|
| CrCl > 50 mL/min | GFR <30: reduce dose by 50% (threshold <30 ml/min) | GFR >30: No adjustment TDS — Normal dosing |
| CrCl 30–50 mL/min | GFR <30: reduce dose by 50% (threshold <30 ml/min) | GFR >30: No adjustment TDS — Normal dosing |
| CrCl 10–29 mL/min | GFR <30: reduce dose by 50% (threshold <30 ml/min) | GFR 15-29: 5mg TDS — Reduce dose by 50% |
| CrCl < 10 mL/min | GFR <30: reduce dose by 50% (threshold <30 ml/min) | GFR <15: 5mg BD — Reduce dose by 50-75% |

### Metronidazole

Status: **sources differ — reconcile**

| CrCl | BNF database (reference) | BNF medications table (secondary) | GFR dosing table (secondary) |
|---|---|---|---|
| CrCl > 50 mL/min | No dose adjustment in renal impairment. | GFR >10: No adjustment TDS — Primarily hepatic metabolism | 500mg TDS — Accumulation of metabolites in severe renal impairment |
| CrCl 30–50 mL/min | No dose adjustment in renal impairment. | GFR >10: No adjustment TDS — Primarily hepatic metabolism | 500mg BD — Accumulation of metabolites in severe renal impairment |
| CrCl 10–29 mL/min | No dose adjustment in renal impairment. | GFR >10: No adjustment TDS — Primarily hepatic metabolism | 500mg BD — Accumulation of metabolites in severe renal impairment |
| CrCl < 10 mL/min | No dose adjustment in renal impairment. | GFR <10: 400mg or 500mg BD — Metabolite accumulation - reduce if prolonged course | 500mg BD — Accumulation of metabolites in severe renal impairment |

### Midazolam

Status: secondary only — verify

| CrCl | BNF medications table (secondary) |
|---|---|
| CrCl > 50 mL/min | GFR >10: No significant adjustment Standard — Hepatic metabolism |
| CrCl 30–50 mL/min | GFR >10: No significant adjustment Standard — Hepatic metabolism |
| CrCl 10–29 mL/min | GFR >10: No significant adjustment Standard — Hepatic metabolism |
| CrCl < 10 mL/min | GFR <10: Reduce dose by 30-50% Standard — Active metabolite accumulates |

### Morphine Sulfate

Status: **sources differ — reconcile**

| CrCl | BNF database (reference) | BNF medications table (secondary) | GFR dosing table (secondary) |
|---|---|---|---|
| CrCl > 50 mL/min | Reduce dose and increase interval. Active metabolite (M6G) accumulates. GFR <30: use 50% dose or avoid. (threshold <30 ml/min) | GFR >50: No adjustment Q4H — Start low and titrate | 5-10mg Q4H PRN — Active metabolites accumulate; prefer fentanyl in ESRD |
| CrCl 30–50 mL/min | Reduce dose and increase interval. Active metabolite (M6G) accumulates. GFR <30: use 50% dose or avoid. (threshold <30 ml/min) | GFR 20-49: 50-75% of standard Q6-8H — Active metabolites accumulate | 2.5-5mg Q6H PRN — Active metabolites accumulate; prefer fentanyl in ESRD |
| CrCl 10–29 mL/min | Reduce dose and increase interval. Active metabolite (M6G) accumulates. GFR <30: use 50% dose or avoid. (threshold <30 ml/min) | GFR 20-49: 50-75% of standard Q6-8H — Active metabolites accumulate | 2.5mg Q8H PRN — Active metabolites accumulate; prefer fentanyl in ESRD |
| CrCl < 10 mL/min | Reduce dose and increase interval. Active metabolite (M6G) accumulates. GFR <30: use 50% dose or avoid. (threshold <30 ml/min) | GFR <10: Avoid - use fentanyl or oxycodone  — Contraindicated - morphine-6-glucuronide accumulates causing respiratory depression | Use with caution Q8-12H PRN — Active metabolites accumulate; prefer fentanyl in ESRD |

### Multivitamin

Status: secondary only — verify

| CrCl | BNF medications table (secondary) |
|---|---|
| CrCl > 50 mL/min | GFR >0: No adjustment for standard multivitamins OD — Avoid excessive vitamin A in renal impairment |
| CrCl 30–50 mL/min | GFR >0: No adjustment for standard multivitamins OD — Avoid excessive vitamin A in renal impairment |
| CrCl 10–29 mL/min | GFR >0: No adjustment for standard multivitamins OD — Avoid excessive vitamin A in renal impairment |
| CrCl < 10 mL/min | GFR >0: No adjustment for standard multivitamins OD — Avoid excessive vitamin A in renal impairment |

### Mupirocin 2%

Status: reference only

| CrCl | BNF database (reference) |
|---|---|
| CrCl > 50 mL/min | Monitor renal function. Avoid ointment on large wounds if renal impairment (PEG base absorption). |
| CrCl 30–50 mL/min | Monitor renal function. Avoid ointment on large wounds if renal impairment (PEG base absorption). |
| CrCl 10–29 mL/min | Monitor renal function. Avoid ointment on large wounds if renal impairment (PEG base absorption). |
| CrCl < 10 mL/min | Monitor renal function. Avoid ointment on large wounds if renal impairment (PEG base absorption). |

### Omeprazole

Status: secondary only — verify

| CrCl | BNF medications table (secondary) |
|---|---|
| CrCl > 50 mL/min | GFR >0: No renal adjustment OD — Hepatic metabolism |
| CrCl 30–50 mL/min | GFR >0: No renal adjustment OD — Hepatic metabolism |
| CrCl 10–29 mL/min | GFR >0: No renal adjustment OD — Hepatic metabolism |
| CrCl < 10 mL/min | GFR >0: No renal adjustment OD — Hepatic metabolism |

### Ondansetron

Status: secondary only — verify

| CrCl | BNF medications table (secondary) |
|---|---|
| CrCl > 50 mL/min | GFR >0: No adjustment required Standard — Hepatic metabolism - reduce in hepatic impairment |
| CrCl 30–50 mL/min | GFR >0: No adjustment required Standard — Hepatic metabolism - reduce in hepatic impairment |
| CrCl 10–29 mL/min | GFR >0: No adjustment required Standard — Hepatic metabolism - reduce in hepatic impairment |
| CrCl < 10 mL/min | GFR >0: No adjustment required Standard — Hepatic metabolism - reduce in hepatic impairment |

### Paracetamol (Acetaminophen)

Status: **sources differ — reconcile**

| CrCl | BNF database (reference) | BNF medications table (secondary) | GFR dosing table (secondary) |
|---|---|---|---|
| CrCl > 50 mL/min | Increase dosing interval to q6h if GFR <30 (threshold <30 ml/min) | GFR >30: No adjustment Q4-6H — Normal dosing | 1g QID — Generally safe; extend interval in severe impairment |
| CrCl 30–50 mL/min | Increase dosing interval to q6h if GFR <30 (threshold <30 ml/min) | GFR >30: No adjustment Q4-6H — Normal dosing | 1g QID — Generally safe; extend interval in severe impairment |
| CrCl 10–29 mL/min | Increase dosing interval to q6h if GFR <30 (threshold <30 ml/min) | GFR 10-29: 500mg-1g Q6-8H — Extend interval | 500mg-1g TDS — Generally safe; extend interval in severe impairment |
| CrCl < 10 mL/min | Increase dosing interval to q6h if GFR <30 (threshold <30 ml/min) | GFR <10: 500mg Q8H — Reduce dose and extend interval | 500mg TDS — Generally safe; extend interval in severe impairment |

### Pentazocine

Status: **sources differ — reconcile**

| CrCl | BNF database (reference) | BNF medications table (secondary) |
|---|---|---|
| CrCl > 50 mL/min | Reduce dose. Avoid in severe impairment. | GFR >30: No adjustment Q3-4H — Normal dosing |
| CrCl 30–50 mL/min | Reduce dose. Avoid in severe impairment. | GFR >30: No adjustment Q3-4H — Normal dosing |
| CrCl 10–29 mL/min | Reduce dose. Avoid in severe impairment. | GFR <30: Reduce dose by 25-50% Q6H — Accumulation risk |
| CrCl < 10 mL/min | Reduce dose. Avoid in severe impairment. | GFR <30: Reduce dose by 25-50% Q6H — Accumulation risk |

### Pethidine (Meperidine)

Status: reference only

| CrCl | BNF database (reference) |
|---|---|
| CrCl > 50 mL/min | AVOID. Norpethidine (toxic metabolite) accumulates causing seizures. |
| CrCl 30–50 mL/min | AVOID. Norpethidine (toxic metabolite) accumulates causing seizures. |
| CrCl 10–29 mL/min | AVOID. Norpethidine (toxic metabolite) accumulates causing seizures. |
| CrCl < 10 mL/min | AVOID. Norpethidine (toxic metabolite) accumulates causing seizures. |

### Piperacillin/Tazobactam

Status: secondary only — verify

| CrCl | BNF medications table (secondary) |
|---|---|
| CrCl > 50 mL/min | GFR >40: 4.5g TDS-QDS — Normal dosing |
| CrCl 30–50 mL/min | GFR >40: 4.5g TDS-QDS — Normal dosing |
| CrCl 10–29 mL/min | GFR 20-39: 4.5g BD — Reduce frequency |
| CrCl < 10 mL/min | GFR <20: 4.5g BD — Max 4.5g BD |

### Potassium Chloride

Status: reference only

| CrCl | BNF database (reference) |
|---|---|
| CrCl > 50 mL/min | Avoid in renal impairment (no band detail in the reference table) |
| CrCl 30–50 mL/min | Avoid in renal impairment (no band detail in the reference table) |
| CrCl 10–29 mL/min | Avoid in renal impairment (no band detail in the reference table) |
| CrCl < 10 mL/min | Avoid in renal impairment (no band detail in the reference table) |

### Povidone-Iodine

Status: secondary only — verify

| CrCl | BNF medications table (secondary) |
|---|---|
| CrCl > 50 mL/min | GFR >0: No adjustment for topical Standard — Avoid prolonged use on large areas in renal impairment (iodine absorption) |
| CrCl 30–50 mL/min | GFR >0: No adjustment for topical Standard — Avoid prolonged use on large areas in renal impairment (iodine absorption) |
| CrCl 10–29 mL/min | GFR >0: No adjustment for topical Standard — Avoid prolonged use on large areas in renal impairment (iodine absorption) |
| CrCl < 10 mL/min | GFR >0: No adjustment for topical Standard — Avoid prolonged use on large areas in renal impairment (iodine absorption) |

### Prednisolone

Status: **sources differ — reconcile**

| CrCl | BNF database (reference) | BNF medications table (secondary) |
|---|---|---|
| CrCl > 50 mL/min | Monitor renal function (no band detail in the reference table) | GFR >0: No renal adjustment OD — Hepatic metabolism |
| CrCl 30–50 mL/min | Monitor renal function (no band detail in the reference table) | GFR >0: No renal adjustment OD — Hepatic metabolism |
| CrCl 10–29 mL/min | Monitor renal function (no band detail in the reference table) | GFR >0: No renal adjustment OD — Hepatic metabolism |
| CrCl < 10 mL/min | Monitor renal function (no band detail in the reference table) | GFR >0: No renal adjustment OD — Hepatic metabolism |

### Pregabalin

Status: secondary only — verify

| CrCl | GFR dosing table (secondary) |
|---|---|
| CrCl > 50 mL/min | 75-150mg BD — Renal elimination; significant dose reduction required |
| CrCl 30–50 mL/min | 75mg BD — Renal elimination; significant dose reduction required |
| CrCl 10–29 mL/min | 25-75mg OD — Renal elimination; significant dose reduction required |
| CrCl < 10 mL/min | 25mg After dialysis — Renal elimination; significant dose reduction required |

### Quinine Sulfate/Dihydrochloride

Status: reference only

| CrCl | BNF database (reference) |
|---|---|
| CrCl > 50 mL/min | Dose adjustment needed in renal impairment (no band detail in the reference table) |
| CrCl 30–50 mL/min | Dose adjustment needed in renal impairment (no band detail in the reference table) |
| CrCl 10–29 mL/min | Dose adjustment needed in renal impairment (no band detail in the reference table) |
| CrCl < 10 mL/min | Dose adjustment needed in renal impairment (no band detail in the reference table) |

### Ranitidine

Status: **sources differ — reconcile**

| CrCl | BNF database (reference) | BNF medications table (secondary) |
|---|---|---|
| CrCl > 50 mL/min | GFR <50: 150mg od (threshold <50 ml/min) | GFR >50: No adjustment BD — Normal dosing |
| CrCl 30–50 mL/min | GFR <50: 150mg od (threshold <50 ml/min) | GFR 10-49: 20mg OD — Reduce frequency |
| CrCl 10–29 mL/min | GFR <50: 150mg od (threshold <50 ml/min) | GFR 10-49: 20mg OD — Reduce frequency |
| CrCl < 10 mL/min | GFR <50: 150mg od (threshold <50 ml/min) | GFR <10: 20mg Every 48h — Significant reduction needed |

### Ringer's Lactate (Hartmann's Solution)

Status: reference only

| CrCl | BNF database (reference) |
|---|---|
| CrCl > 50 mL/min | Monitor renal function (no band detail in the reference table) |
| CrCl 30–50 mL/min | Monitor renal function (no band detail in the reference table) |
| CrCl 10–29 mL/min | Monitor renal function (no band detail in the reference table) |
| CrCl < 10 mL/min | Monitor renal function (no band detail in the reference table) |

### Salbutamol

Status: secondary only — verify

| CrCl | BNF medications table (secondary) |
|---|---|
| CrCl > 50 mL/min | GFR >0: No adjustment Standard — Safe in renal impairment |
| CrCl 30–50 mL/min | GFR >0: No adjustment Standard — Safe in renal impairment |
| CrCl 10–29 mL/min | GFR >0: No adjustment Standard — Safe in renal impairment |
| CrCl < 10 mL/min | GFR >0: No adjustment Standard — Safe in renal impairment |

### Silver Sulfadiazine 1% Cream

Status: **sources differ — reconcile**

| CrCl | BNF database (reference) | BNF medications table (secondary) |
|---|---|---|
| CrCl > 50 mL/min | Monitor renal function. Monitor renal function if applied to large burns (systemic absorption). | GFR >0: No adjustment for topical use Standard — Systemic absorption possible with large surface areas - use with caution |
| CrCl 30–50 mL/min | Monitor renal function. Monitor renal function if applied to large burns (systemic absorption). | GFR >0: No adjustment for topical use Standard — Systemic absorption possible with large surface areas - use with caution |
| CrCl 10–29 mL/min | Monitor renal function. Monitor renal function if applied to large burns (systemic absorption). | GFR >0: No adjustment for topical use Standard — Systemic absorption possible with large surface areas - use with caution |
| CrCl < 10 mL/min | Monitor renal function. Monitor renal function if applied to large burns (systemic absorption). | GFR >0: No adjustment for topical use Standard — Systemic absorption possible with large surface areas - use with caution |

### Sodium Chloride 0.9% (Normal Saline)

Status: **sources differ — reconcile**

| CrCl | BNF database (reference) | BNF medications table (secondary) |
|---|---|---|
| CrCl > 50 mL/min | Monitor renal function. Risk of fluid overload in renal failure. Monitor fluid balance. | GFR >0: Monitor fluid balance carefully As needed — Risk of fluid overload in renal impairment |
| CrCl 30–50 mL/min | Monitor renal function. Risk of fluid overload in renal failure. Monitor fluid balance. | GFR >0: Monitor fluid balance carefully As needed — Risk of fluid overload in renal impairment |
| CrCl 10–29 mL/min | Monitor renal function. Risk of fluid overload in renal failure. Monitor fluid balance. | GFR >0: Monitor fluid balance carefully As needed — Risk of fluid overload in renal impairment |
| CrCl < 10 mL/min | Monitor renal function. Risk of fluid overload in renal failure. Monitor fluid balance. | GFR >0: Monitor fluid balance carefully As needed — Risk of fluid overload in renal impairment |

### Spironolactone

Status: reference only

| CrCl | BNF database (reference) |
|---|---|
| CrCl > 50 mL/min | Avoid in renal impairment (no band detail in the reference table) |
| CrCl 30–50 mL/min | Avoid in renal impairment (no band detail in the reference table) |
| CrCl 10–29 mL/min | Avoid in renal impairment (no band detail in the reference table) |
| CrCl < 10 mL/min | Avoid in renal impairment (no band detail in the reference table) |

### Sucralfate

Status: reference only

| CrCl | BNF database (reference) |
|---|---|
| CrCl > 50 mL/min | Use with caution in renal impairment (no band detail in the reference table) |
| CrCl 30–50 mL/min | Use with caution in renal impairment (no band detail in the reference table) |
| CrCl 10–29 mL/min | Use with caution in renal impairment (no band detail in the reference table) |
| CrCl < 10 mL/min | Use with caution in renal impairment (no band detail in the reference table) |

### Suxamethonium (Succinylcholine)

Status: reference only

| CrCl | BNF database (reference) |
|---|---|
| CrCl > 50 mL/min | Use with caution in renal impairment (no band detail in the reference table) |
| CrCl 30–50 mL/min | Use with caution in renal impairment (no band detail in the reference table) |
| CrCl 10–29 mL/min | Use with caution in renal impairment (no band detail in the reference table) |
| CrCl < 10 mL/min | Use with caution in renal impairment (no band detail in the reference table) |

### Tetanus Toxoid (TT/Td/Tdap)

Status: secondary only — verify

| CrCl | BNF medications table (secondary) |
|---|---|
| CrCl > 50 mL/min | GFR >0: No adjustment Standard — Safe in all levels of renal function |
| CrCl 30–50 mL/min | GFR >0: No adjustment Standard — Safe in all levels of renal function |
| CrCl 10–29 mL/min | GFR >0: No adjustment Standard — Safe in all levels of renal function |
| CrCl < 10 mL/min | GFR >0: No adjustment Standard — Safe in all levels of renal function |

### Tizanidine

Status: reference only

| CrCl | BNF database (reference) |
|---|---|
| CrCl > 50 mL/min | Dose adjustment needed in renal impairment (no band detail in the reference table) |
| CrCl 30–50 mL/min | Dose adjustment needed in renal impairment (no band detail in the reference table) |
| CrCl 10–29 mL/min | Dose adjustment needed in renal impairment (no band detail in the reference table) |
| CrCl < 10 mL/min | Dose adjustment needed in renal impairment (no band detail in the reference table) |

### Tramadol Hydrochloride

Status: **sources differ — reconcile**

| CrCl | BNF database (reference) | BNF medications table (secondary) | GFR dosing table (secondary) |
|---|---|---|---|
| CrCl > 50 mL/min | GFR <30: max 100mg q12h; GFR <10: avoid (threshold <30 ml/min) | GFR >30: No adjustment Q4-6H — Normal dosing | 50-100mg Q6H — Active metabolite accumulates; extend dosing interval |
| CrCl 30–50 mL/min | GFR <30: max 100mg q12h; GFR <10: avoid (threshold <30 ml/min) | GFR >30: No adjustment Q4-6H — Normal dosing | 50mg Q8H — Active metabolite accumulates; extend dosing interval |
| CrCl 10–29 mL/min | GFR <30: max 100mg q12h; GFR <10: avoid (threshold <30 ml/min) | GFR 10-29: 50mg Q8-12H — Reduce dose and extend interval | 50mg Q12H — Active metabolite accumulates; extend dosing interval |
| CrCl < 10 mL/min | GFR <30: max 100mg q12h; GFR <10: avoid (threshold <30 ml/min) | GFR <10: 50mg Q12H — Max 200mg/day | 25-50mg Q12H — Active metabolite accumulates; extend dosing interval |

### Tranexamic Acid

Status: secondary only — verify

| CrCl | BNF medications table (secondary) |
|---|---|
| CrCl > 50 mL/min | GFR >50: No adjustment Standard — Normal dosing |
| CrCl 30–50 mL/min | GFR 20-49: 10mg/kg BD — Reduce to BD |
| CrCl 10–29 mL/min | GFR 20-49: 10mg/kg BD — Reduce to BD |
| CrCl < 10 mL/min | GFR <20: 10mg/kg OD — Reduce to OD |

### Triamcinolone Acetonide

Status: secondary only — verify

| CrCl | BNF medications table (secondary) |
|---|---|
| CrCl > 50 mL/min | GFR >0: No adjustment for intralesional use Standard — Minimal systemic absorption from intralesional injection |
| CrCl 30–50 mL/min | GFR >0: No adjustment for intralesional use Standard — Minimal systemic absorption from intralesional injection |
| CrCl 10–29 mL/min | GFR >0: No adjustment for intralesional use Standard — Minimal systemic absorption from intralesional injection |
| CrCl < 10 mL/min | GFR >0: No adjustment for intralesional use Standard — Minimal systemic absorption from intralesional injection |

### Trimethoprim/Sulfamethoxazole

Status: secondary only — verify

| CrCl | BNF medications table (secondary) |
|---|---|
| CrCl > 50 mL/min | GFR >30: No adjustment BD — Normal dosing |
| CrCl 30–50 mL/min | GFR >30: No adjustment BD — Normal dosing |
| CrCl 10–29 mL/min | GFR 15-29: 50% of standard BD — Halve dose; monitor closely |
| CrCl < 10 mL/min | GFR <15: Avoid unless essential  — Significant accumulation risk |

### Unfractionated Heparin (UFH)

Status: reference only

| CrCl | BNF database (reference) |
|---|---|
| CrCl > 50 mL/min | Monitor more closely. May need lower doses. |
| CrCl 30–50 mL/min | Monitor more closely. May need lower doses. |
| CrCl 10–29 mL/min | Monitor more closely. May need lower doses. |
| CrCl < 10 mL/min | Monitor more closely. May need lower doses. |

### Vancomycin

Status: **sources differ — reconcile**

| CrCl | BNF database (reference) | BNF medications table (secondary) |
|---|---|---|
| CrCl > 50 mL/min | MUST adjust based on levels. GFR <50: extend interval. GFR <30: give loading then guided by levels. (threshold <50 ml/min) | GFR >50: 15-20mg/kg BD — Aim trough 15-20mg/L for serious infections |
| CrCl 30–50 mL/min | MUST adjust based on levels. GFR <50: extend interval. GFR <30: give loading then guided by levels. (threshold <50 ml/min) | GFR 30-49: 15mg/kg OD — Reduce frequency - monitor trough levels |
| CrCl 10–29 mL/min | MUST adjust based on levels. GFR <50: extend interval. GFR <30: give loading then guided by levels. (threshold <50 ml/min) | GFR 15-29: 15mg/kg Every 48h — Extended interval dosing - check levels pre-dose |
| CrCl < 10 mL/min | MUST adjust based on levels. GFR <50: extend interval. GFR <30: give loading then guided by levels. (threshold <50 ml/min) | GFR <15: 15mg/kg loading then guided by levels Level-guided — Specialist guidance required |

### Warfarin Sodium

Status: **sources differ — reconcile**

| CrCl | BNF database (reference) | BNF medications table (secondary) |
|---|---|---|
| CrCl > 50 mL/min | Monitor renal function. Monitor INR more closely. Increased sensitivity in renal impairment. | GFR >15: No adjustment but may be more sensitive OD — May need lower doses due to altered protein binding |
| CrCl 30–50 mL/min | Monitor renal function. Monitor INR more closely. Increased sensitivity in renal impairment. | GFR >15: No adjustment but may be more sensitive OD — May need lower doses due to altered protein binding |
| CrCl 10–29 mL/min | Monitor renal function. Monitor INR more closely. Increased sensitivity in renal impairment. | GFR >15: No adjustment but may be more sensitive OD — May need lower doses due to altered protein binding |
| CrCl < 10 mL/min | Monitor renal function. Monitor INR more closely. Increased sensitivity in renal impairment. | GFR <15: Start at lower dose OD — Increased bleeding risk; closer INR monitoring needed |

### Zinc Sulfate

Status: secondary only — verify

| CrCl | BNF medications table (secondary) |
|---|---|
| CrCl > 50 mL/min | GFR >0: No adjustment Standard — Accumulation possible in dialysis patients |
| CrCl 30–50 mL/min | GFR >0: No adjustment Standard — Accumulation possible in dialysis patients |
| CrCl 10–29 mL/min | GFR >0: No adjustment Standard — Accumulation possible in dialysis patients |
| CrCl < 10 mL/min | GFR >0: No adjustment Standard — Accumulation possible in dialysis patients |

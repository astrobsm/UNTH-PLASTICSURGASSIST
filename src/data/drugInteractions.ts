/**
 * Drug–drug interactions for a list of drug names — the one checker the app
 * uses (prescribing, treatment plans, medication ordering, critical-care
 * review). Sources, in order:
 *   1. class rules (critical/medications.ts pairInteractions — mechanism and
 *      management stated: triple whammy pieces, dual RAAS, K retention,
 *      opioid + benzodiazepine, bleeding, QT stacking, serotonergic, CYP…);
 *   2. the BNF database's own entries for the pair;
 *   3. the BNF medications table's interaction notes, only where 1 and 2
 *      found nothing (labelled secondary).
 */
import { pairInteractions } from '../clinical/critical/medications';
import type { CcInteraction } from '../clinical/critical/types';
import { BNF_MEDICATIONS } from './bnfMedications';
import { drugKey } from './renalDosing';

export interface DrugInteraction {
  a: string;
  b: string;
  severity: CcInteraction['severity'];
  mechanism: string;
  management: string;
  source: NonNullable<CcInteraction['source']>;
}

const RANK = { contraindicated: 0, major: 1, moderate: 2, minor: 3 } as const;

export function findInteractions(names: string[]): DrugInteraction[] {
  const list = names.map(n => String(n || '').trim()).filter(Boolean);
  const out: DrugInteraction[] = [];
  for (let i = 0; i < list.length; i++) {
    for (let j = i + 1; j < list.length; j++) {
      const a = list[i], b = list[j];
      if (drugKey(a) === drugKey(b)) {
        out.push({ a, b, severity: 'moderate', mechanism: 'The same drug is listed twice', management: 'Remove the duplicate', source: 'class rules' });
        continue;
      }
      const hits = pairInteractions({ name: a }, { name: b });
      if (hits.length) {
        for (const h of hits) out.push({ a, b, severity: h.severity, mechanism: h.mechanism, management: h.management, source: h.source ?? 'class rules' });
        continue;
      }
      // Secondary: the medications table's free-text interaction notes.
      for (const [x, y] of [[a, b], [b, a]]) {
        const m = BNF_MEDICATIONS.find(r => drugKey(r.genericName) === drugKey(x) || drugKey(r.name) === drugKey(x));
        const note = m?.interactions.find(t => t.toLowerCase().includes((drugKey(y).replace('+', '') || '~').toLowerCase()));
        if (note) { out.push({ a, b, severity: 'moderate', mechanism: note, management: 'Secondary source — confirm with the pharmacist', source: 'BNF medications table (secondary)' }); break; }
      }
    }
  }
  return out.sort((p, q) => RANK[p.severity] - RANK[q.severity]);
}

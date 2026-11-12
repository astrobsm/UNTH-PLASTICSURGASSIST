/**
 * Writes docs/RENAL_DOSING_RECONCILIATION.md: every drug with renal-dosing
 * data in any of the app's three tables, with what each table says at each
 * CrCl band, so the clinical pharmacist can reconcile them.
 *
 *   npx vite-node scripts/renalDosingReport.ts
 */
import { writeFileSync } from 'node:fs';
import { BNF_DRUG_DATABASE } from '../src/data/bnfDrugDatabase';
import { BNF_MEDICATIONS } from '../src/data/bnfMedications';
import { GFR_DOSING_DATABASE } from '../src/data/gfrDosingTable';
import { drugKey, renalDoseGuidance } from '../src/data/renalDosing';

const names = new Map<string, string>();
for (const d of BNF_DRUG_DATABASE) if (d.dosage?.renalImpairment || (d.renalRisk && d.renalRisk !== 'safe')) names.set(drugKey(d.genericName), d.genericName);
for (const m of BNF_MEDICATIONS) if (m.gfrAdjustments?.length && !names.has(drugKey(m.genericName))) names.set(drugKey(m.genericName), m.genericName);
for (const k of Object.keys(GFR_DOSING_DATABASE)) if (!names.has(drugKey(k))) names.set(drugKey(k), k);

const bands = [75, 40, 20, 5];
const esc = (s: string) => s.replace(/\|/g, '\\|');
const rows: string[] = [];
let multi = 0, secondaryOnly = 0;
for (const name of [...names.values()].sort((a, b) => a.localeCompare(b))) {
  const per = bands.map(c => renalDoseGuidance(name, c));
  const g = per[1];
  if (g.multipleSources) multi++;
  if (!g.verified && g.primary) secondaryOnly++;
  const status = !g.primary ? 'no data' : g.verified ? (g.multipleSources ? '**sources differ — reconcile**' : 'reference only') : 'secondary only — verify';
  rows.push(`### ${name}\n\nStatus: ${status}\n\n| CrCl | ${[...new Set(per.flatMap(p => p.sources.map(s => s.source)))].join(' | ')} |\n|---|${[...new Set(per.flatMap(p => p.sources.map(s => s.source)))].map(() => '---').join('|')}|\n` +
    per.map(p => {
      const cols = [...new Set(per.flatMap(x => x.sources.map(s => s.source)))].map(src => esc(p.sources.find(s => s.source === src)?.text || '—'));
      return `| ${p.band} | ${cols.join(' | ')} |`;
    }).join('\n') + '\n');
}

writeFileSync('docs/RENAL_DOSING_RECONCILIATION.md', `# Renal dosing — reconciliation sheet

Generated from the app's three renal-dosing tables by \`scripts/renalDosingReport.ts\`. Regenerate it after any change to the drug data.

The app reads these tables through one resolver (\`src/data/renalDosing.ts\`), in this order:
1. **BNF database (reference)**, \`src/data/bnfDrugDatabase.ts\`. This is the prescribing catalogue.
2. **BNF medications table (secondary)**, \`src/data/bnfMedications.ts\`. Used only when the reference has nothing for the drug.
3. **GFR dosing table (secondary)**, \`src/data/gfrDosingTable.ts\`. Used last.

When more than one table holds data for a drug, the prescriber sees all of them, marked "sources differ — confirm". Guidance from a secondary table is labelled "pharmacist to verify".

**For the pharmacist:** for each drug below marked *sources differ* or *secondary only*, confirm the correct guidance. Then correct the reference entry, and delete the secondary rows for that drug once the reference covers it.

- Drugs with renal data: ${names.size}
- Held in more than one table: ${multi}
- Held only in a secondary table: ${secondaryOnly}

${rows.join('\n')}`);
console.log(`Wrote docs/RENAL_DOSING_RECONCILIATION.md — ${names.size} drugs, ${multi} in more than one table, ${secondaryOnly} secondary only`);

/**
 * The approved plan as a list of actionable items, each with a stable key
 * (the same keys the approval screen uses) and what kind of action it needs:
 *
 *   medication     → prescribe (category → drug → dose / route / frequency)
 *   investigation  → request (category → test), then enter / snap / scan the result
 *   procedure      → log as done / booked
 *   care           → log as done (nursing, monitoring, referral, education)
 */
import type { ScribePlan, PlanLine } from './scribePlan';

export type ItemKind = 'medication' | 'investigation' | 'procedure' | 'care';

export interface PlanItem extends PlanLine {
  key: string;
  group: string;       // problem / heading it sits under
  section: string;     // goals, investigations, treatment …
  kind: ItemKind;
  actionable: boolean; // goals and discharge criteria are aims, not tasks
}

const MED = /\b(antibiotic|enoxaparin|LMWH|heparin|insulin|paracetamol|opioid|morphine|tramadol|analgesi|supplement|vitamin|zinc|triamcinolone|steroid|ART|antiretroviral|antiplatelet|aspirin|clopidogrel|ceftriaxone|metronidazole|amoxicillin|clindamycin|ciprofloxacin|transfus|iron|folic|fluid|crystalloid|bronchodilator|inhaler|anticonvulsant|OHA|metformin|VRIII|prophylaxis)\b/i;
const INV = /\b(FBC|full blood count|complete blood count|CRP|ESR|U&E|urea|electrolyte|creatinine|LFT|albumin|glucose|HbA1c|culture|swab|M\/C\/S|biopsy|histolog|X-?ray|MRI|CT\b|ultrasound|USS|Doppler|ABPI|ECG|echo|CD4|viral load|lactate|coagulation|INR|group|cross-?match|HbS|electrophoresis|TSH|urinalysis|serology|LRINEC|probe-to-bone)\b/i;
const PROC = /\b(debridement|debride|flap|graft|excision|incision and drainage|drain|release|escharotomy|fasciotomy|amputation|reconstruction|closure|NPWT|negative-pressure|VAC|theatre|surgery|Z-plasty|injection series)\b/i;

export function classifyLine(text: string, section: string, heading = ''): ItemKind {
  if (section === 'investigations') return 'investigation';
  if (/VTE|Analgesia/i.test(heading)) return MED.test(text) || /enoxaparin|paracetamol|opioid/i.test(text) ? 'medication' : 'care';
  if (INV.test(text) && !PROC.test(text)) return 'investigation';
  if (PROC.test(text)) return 'procedure';
  if (MED.test(text)) return 'medication';
  return 'care';
}

export function flattenPlan(plan: ScribePlan): PlanItem[] {
  const out: PlanItem[] = [];
  plan.problems.forEach((p, pi) => {
    (['goals', 'investigations', 'treatment', 'monitoring', 'referrals'] as const).forEach(sec => {
      p[sec].forEach((l, i) => out.push({
        ...l, key: `p${pi}.${sec}|${i}`, group: `${p.problem}${p.code ? ` (${p.code})` : ''}`, section: sec,
        kind: sec === 'goals' ? 'care' : sec === 'referrals' ? 'care' : classifyLine(l.text, sec),
        actionable: sec !== 'goals',
      }));
    });
  });
  plan.comorbidities.forEach((c, ci) => c.actions.forEach((l, i) => out.push({
    ...l, key: `c${ci}|${i}`, group: c.condition, section: 'comorbidity', kind: classifyLine(l.text, 'comorbidity'), actionable: true,
  })));
  plan.general.forEach((g, gi) => g.items.forEach((l, i) => out.push({
    ...l, key: `g${gi}|${i}`, group: g.heading, section: 'general', kind: classifyLine(l.text, 'general', g.heading), actionable: true,
  })));
  plan.carriedOver.forEach((l, i) => out.push({
    ...l, key: `carried|${i}`, group: 'Outstanding from clerking', section: 'carried', kind: classifyLine(l.text, 'carried'), actionable: true,
  }));
  return out;
}

export interface LoggedAction {
  id: number; scribe_plan_id?: number; item_key: string; item_text?: string | null; status: string; note?: string | null; logged_at: string;
  user_name?: string | null; user_role?: string | null;
  latitude?: number | null; longitude?: number | null; accuracy_m?: number | null; location_label?: string | null; location_status?: string | null;
  prescription?: any; investigation?: any; result?: any;
  attachments?: { id: number; name: string; mime: string; size?: number }[];
}

/** Where an item stands, from its log (newest first). */
export function itemState(actions: LoggedAction[]): { label: string; tone: 'none' | 'progress' | 'done' | 'problem'; last?: LoggedAction } {
  const last = actions[0];
  if (!last) return { label: 'Not started', tone: 'none' };
  const hasResult = actions.some(a => a.status === 'result_entered');
  const map: Record<string, { label: string; tone: 'progress' | 'done' | 'problem' }> = {
    done: { label: 'Done', tone: 'done' },
    result_entered: { label: 'Result entered', tone: 'done' },
    prescribed: { label: 'Prescribed', tone: 'done' },
    ordered: { label: hasResult ? 'Result entered' : 'Requested — awaiting result', tone: hasResult ? 'done' : 'progress' },
    partial: { label: 'Partly done', tone: 'progress' },
    not_done: { label: 'Not done', tone: 'problem' },
    cancelled: { label: 'Cancelled', tone: 'problem' },
  };
  return { ...(map[last.status] || { label: last.status, tone: 'progress' as const }), last };
}

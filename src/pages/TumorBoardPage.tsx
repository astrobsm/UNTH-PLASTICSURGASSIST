/**
 * Tumor Board — multidisciplinary oncology assessment and planning.
 *
 * Covers soft tissue malignancy and all skin cancers (melanoma and non-melanoma),
 * carrying a case from staging through to a ratified multimodality plan,
 * subspecialty referrals, a surveillance schedule and patient counselling.
 *
 * The clinical logic is NOT here. Staging, plan generation, letters, surveillance
 * and counselling are pure functions in services/oncology/*, unit-tested without
 * a browser and running unchanged offline. This file is the workflow around them.
 *
 * Views:
 *   board      → worklist across all open cases, awaiting-histology surfaced
 *   case       → one case: staging timeline, plan, referrals, surveillance
 *   assess     → staging form; appends a new version, never overwrites
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Activity, AlertTriangle, ArrowLeft, ClipboardList, FileText, FlaskConical,
  Loader2, Plus, RefreshCw, Search, Send, Stethoscope, Users, CheckCircle2,
} from 'lucide-react';
import toast from 'react-hot-toast';
import {
  getBoard, getCaseDetail, createCase, recordAssessment, stageFromAssessment,
  buildPlanForCase, savePlan, ratifyPlan, buildLetters, saveReferrals,
  buildSurveillance, saveSurveillance, buildCounselling,
  type TumorBoardCase, type TumorBoardAssessment, type CaseDetail, type BoardSummary,
} from '../services/tumorBoardService';
import { computeStage } from '../services/oncology/stagingEngine';
import type { StagingInput, TumorFamily, StagingBasis, SarcomaGrade } from '../services/oncology/stagingEngine';
import { SPECIALTY_LABELS } from '../services/oncology/managementPlan';
import {
  generateBoardSummaryPdf, generateAllReferralLettersPdf,
  generateSurveillancePdf, generateCounsellingPdf,
} from '../services/tumorBoardPdfService';
import { GUIDELINE_BASIS, isAwaitingClinicalReview, provenanceLine } from '../services/oncology/guidelineProvenance';

const TUMOR_FAMILIES: { value: TumorFamily; label: string; hint: string }[] = [
  { value: 'cutaneous_melanoma', label: 'Cutaneous melanoma', hint: 'Staged on Breslow thickness and ulceration' },
  { value: 'cutaneous_scc', label: 'Cutaneous squamous cell carcinoma', hint: 'AJCC staging validated for head & neck' },
  { value: 'cutaneous_bcc', label: 'Basal cell carcinoma', hint: 'Managed mainly by NCCN risk stratification' },
  { value: 'merkel_cell', label: 'Merkel cell carcinoma', hint: 'Sentinel node biopsy in all node-negative cases' },
  { value: 'soft_tissue_sarcoma', label: 'Soft tissue sarcoma', hint: 'Refer to a sarcoma centre before biopsy' },
];

const BASIS_OPTIONS: { value: StagingBasis; label: string }[] = [
  { value: 'clinical', label: 'Clinical (before surgery/histology)' },
  { value: 'pathological', label: 'Pathological (histology available)' },
  { value: 'post_neoadjuvant', label: 'Post-neoadjuvant (yp)' },
  { value: 'restaging', label: 'Restaging (recurrence/progression)' },
];

type View = 'board' | 'case' | 'assess';

const stageTone = (group?: string): string => {
  if (!group) return 'bg-gray-100 text-gray-700';
  if (group === '0' || group.startsWith('IA') || group === 'I') return 'bg-green-100 text-green-800';
  if (group.startsWith('II')) return 'bg-amber-100 text-amber-800';
  if (group.startsWith('III')) return 'bg-orange-100 text-orange-800';
  if (group.startsWith('IV')) return 'bg-red-100 text-red-800';
  return 'bg-gray-100 text-gray-700';
};

export default function TumorBoardPage() {
  const [view, setView] = useState<View>('board');
  const [loading, setLoading] = useState(true);
  const [cases, setCases] = useState<TumorBoardCase[]>([]);
  const [summary, setSummary] = useState<BoardSummary>({ total: 0, awaitingHistology: 0, overdueSurveillance: 0 });
  const [detail, setDetail] = useState<CaseDetail | null>(null);
  const [search, setSearch] = useState('');
  const [busy, setBusy] = useState(false);

  const loadBoard = useCallback(async () => {
    setLoading(true);
    try {
      const res = await getBoard();
      setCases(res.cases);
      setSummary(res.summary);
    } catch {
      toast.error('Could not load the tumour board worklist');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadBoard(); }, [loadBoard]);

  const openCase = useCallback(async (caseId: number | string) => {
    setBusy(true);
    try {
      const d = await getCaseDetail(caseId);
      if (!d) { toast.error('Case not found'); return; }
      setDetail(d);
      setView('case');
    } finally {
      setBusy(false);
    }
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return cases;
    return cases.filter(c =>
      `${c.first_name || ''} ${c.last_name || ''} ${c.diagnosis || ''} ${c.patient_hospital_number || ''}`
        .toLowerCase()
        .includes(q)
    );
  }, [cases, search]);

  // ── Board worklist ─────────────────────────────────────────────────────
  if (view === 'board') {
    return (
      <div className="p-4 md:p-6 max-w-7xl mx-auto">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
              <Stethoscope className="w-6 h-6 text-primary-600" />
              Tumour Board
            </h1>
            <p className="text-sm text-gray-600 mt-1">
              Soft tissue malignancy and skin cancer — staging, multimodality planning and surveillance
            </p>
          </div>
          <div className="flex gap-2">
            <button onClick={loadBoard} className="px-3 py-2 border rounded-lg text-sm flex items-center gap-2 hover:bg-gray-50">
              <RefreshCw className="w-4 h-4" /> Refresh
            </button>
            <button onClick={() => setView('assess')} className="px-3 py-2 bg-primary-600 text-white rounded-lg text-sm flex items-center gap-2 hover:bg-primary-700">
              <Plus className="w-4 h-4" /> New case
            </button>
          </div>
        </div>

        <ClinicalReviewBanner />

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
          <StatCard icon={<ClipboardList className="w-5 h-5" />} label="Open cases" value={summary.total} tone="bg-blue-50 text-blue-700" />
          <StatCard icon={<FlaskConical className="w-5 h-5" />} label="Awaiting histology" value={summary.awaitingHistology} tone="bg-amber-50 text-amber-700" />
          <StatCard icon={<AlertTriangle className="w-5 h-5" />} label="Overdue surveillance" value={summary.overdueSurveillance} tone="bg-red-50 text-red-700" />
        </div>

        <div className="relative mb-4">
          <Search className="w-4 h-4 absolute left-3 top-3 text-gray-400" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search by patient, hospital number or diagnosis"
            className="w-full pl-9 pr-3 py-2 border rounded-lg text-sm"
          />
        </div>

        {loading ? (
          <div className="flex justify-center py-16"><Loader2 className="w-8 h-8 animate-spin text-primary-600" /></div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16 text-gray-500">
            <Stethoscope className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p>No open tumour board cases.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {filtered.map(c => (
              <button
                key={String(c.id)}
                onClick={() => openCase(c.id!)}
                className="w-full text-left bg-white border rounded-lg p-4 hover:border-primary-400 hover:shadow-sm transition"
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <div className="font-semibold text-gray-900">
                      {c.first_name || ''} {c.last_name || ''}
                      {c.patient_hospital_number && <span className="ml-2 text-xs text-gray-500">{c.patient_hospital_number}</span>}
                    </div>
                    <div className="text-sm text-gray-600 mt-0.5">{c.diagnosis || TUMOR_FAMILIES.find(f => f.value === c.tumor_family)?.label}</div>
                    {c.primary_site && <div className="text-xs text-gray-500 mt-0.5">{c.primary_site}</div>}
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    {c.current_stage_group && (
                      <span className={`px-2 py-0.5 rounded text-xs font-semibold ${stageTone(c.current_stage_group)}`}>
                        Stage {c.current_stage_group}
                      </span>
                    )}
                    {!c.histology_available && (
                      <span className="px-2 py-0.5 rounded text-xs bg-amber-100 text-amber-800">Histology pending</span>
                    )}
                    <span className="text-xs text-gray-400">{c.assessment_count || 0} assessment(s)</span>
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    );
  }

  // ── New assessment / new case ──────────────────────────────────────────
  if (view === 'assess') {
    return (
      <AssessmentForm
        existingCase={detail?.case}
        onCancel={() => setView(detail ? 'case' : 'board')}
        onSaved={async (caseId) => {
          await loadBoard();
          await openCase(caseId);
        }}
      />
    );
  }

  // ── Case detail ────────────────────────────────────────────────────────
  if (view === 'case' && detail) {
    return (
      <CaseDetailView
        detail={detail}
        busy={busy}
        setBusy={setBusy}
        onBack={() => { setDetail(null); setView('board'); loadBoard(); }}
        onReassess={() => setView('assess')}
        onRefresh={async () => { const d = await getCaseDetail(detail.case.id!); if (d) setDetail(d); }}
      />
    );
  }

  return null;
}

/**
 * Surfaces the module's guideline basis and whether an oncologist here has
 * signed the treatment logic off. Deliberately NOT dismissible: it states a fact
 * about the tool's status, and a clinician who dismissed it once should not have
 * that decision made permanently on their behalf. It disappears on its own when
 * localReview is set to 'ratified' in guidelineProvenance.ts.
 */
function ClinicalReviewBanner() {
  const [open, setOpen] = useState(false);
  const pending = isAwaitingClinicalReview();

  return (
    <div className={`mb-4 rounded-lg border p-3 ${pending ? 'bg-amber-50 border-amber-300' : 'bg-gray-50 border-gray-200'}`}>
      <div className="flex items-start gap-2">
        <AlertTriangle className={`w-4 h-4 flex-shrink-0 mt-0.5 ${pending ? 'text-amber-700' : 'text-gray-500'}`} />
        <div className="flex-1 min-w-0">
          <p className={`text-sm ${pending ? 'text-amber-900' : 'text-gray-700'}`}>
            {pending
              ? 'Decision support only. The treatment logic in this module follows published guidance but has not yet been reviewed by an oncologist at this institution. Every plan requires tumour board ratification.'
              : provenanceLine()}
          </p>
          <button onClick={() => setOpen(o => !o)} className="text-xs underline mt-1 text-gray-600">
            {open ? 'Hide' : 'Show'} guideline basis
          </button>
          {open && (
            <ul className="mt-2 space-y-1">
              <li className="text-xs text-gray-700 font-medium">
                {GUIDELINE_BASIS.stagingSystem} · last checked {GUIDELINE_BASIS.lastCheckedISO}
              </li>
              {GUIDELINE_BASIS.sources.map((s, i) => (
                <li key={i} className="text-xs text-gray-600">
                  <span className="font-medium">{s.name}</span> — {s.scope}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}

function StatCard({ icon, label, value, tone }: { icon: React.ReactNode; label: string; value: number; tone: string }) {
  return (
    <div className="bg-white border rounded-lg p-4 flex items-center gap-3">
      <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${tone}`}>{icon}</div>
      <div>
        <div className="text-2xl font-bold text-gray-900">{value}</div>
        <div className="text-xs text-gray-500">{label}</div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// Assessment form
// ─────────────────────────────────────────────────────────────────────────

function AssessmentForm({
  existingCase,
  onCancel,
  onSaved,
}: {
  existingCase?: TumorBoardCase;
  onCancel: () => void;
  onSaved: (caseId: number | string) => void;
}) {
  const [family, setFamily] = useState<TumorFamily>(existingCase?.tumor_family || 'cutaneous_melanoma');
  const [patientId, setPatientId] = useState(String(existingCase?.patient_id ?? ''));
  const [diagnosis, setDiagnosis] = useState(existingCase?.diagnosis || '');
  const [primarySite, setPrimarySite] = useState(existingCase?.primary_site || '');
  const [basis, setBasis] = useState<StagingBasis>('clinical');
  const [saving, setSaving] = useState(false);

  // Staging inputs
  const [breslowMm, setBreslowMm] = useState('');
  const [sizeCm, setSizeCm] = useState('');
  const [ulceration, setUlceration] = useState(false);
  const [inSitu, setInSitu] = useState(false);
  const [deepInvasion, setDeepInvasion] = useState(false);
  const [perineural, setPerineural] = useState(false);
  const [nodesInvolved, setNodesInvolved] = useState('0');
  const [nodesDetected, setNodesDetected] = useState(false);
  const [inTransit, setInTransit] = useState(false);
  const [extranodal, setExtranodal] = useState(false);
  const [largestNodeCm, setLargestNodeCm] = useState('');
  const [distantMets, setDistantMets] = useState(false);
  const [metSites, setMetSites] = useState<string[]>([]);
  const [ldhElevated, setLdhElevated] = useState<'unknown' | 'yes' | 'no'>('unknown');
  const [grade, setGrade] = useState<SarcomaGrade>('GX');
  const [sarcomaSite, setSarcomaSite] = useState<'trunk_extremity' | 'retroperitoneal' | 'head_neck' | 'viscera'>('trunk_extremity');
  const [histologyAvailable, setHistologyAvailable] = useState(false);
  const [histologicType, setHistologicType] = useState('');
  const [localSpread, setLocalSpread] = useState('');
  const [regionalSpread, setRegionalSpread] = useState('');
  const [metastaticSpread, setMetastaticSpread] = useState('');
  const [margins, setMargins] = useState('');
  const [notes, setNotes] = useState('');

  const isMelanoma = family === 'cutaneous_melanoma';
  const isSarcoma = family === 'soft_tissue_sarcoma';
  const isKeratinocyte = family === 'cutaneous_scc' || family === 'cutaneous_bcc';

  const stagingInput: StagingInput = useMemo(() => ({
    family,
    basis,
    breslowMm: breslowMm ? parseFloat(breslowMm) : null,
    sizeCm: sizeCm ? parseFloat(sizeCm) : null,
    ulceration,
    inSitu,
    deepInvasion,
    perineuralInvasion: perineural,
    nodesInvolved: parseInt(nodesInvolved, 10) || 0,
    nodesClinicallyDetected: nodesDetected,
    inTransitOrSatellite: inTransit,
    extranodalExtension: extranodal,
    largestNodeCm: largestNodeCm ? parseFloat(largestNodeCm) : null,
    distantMets,
    metSites: metSites as any,
    ldhElevated: ldhElevated === 'unknown' ? null : ldhElevated === 'yes',
    grade,
    sarcomaSite,
    histologyAvailable,
  }), [family, basis, breslowMm, sizeCm, ulceration, inSitu, deepInvasion, perineural, nodesInvolved,
       nodesDetected, inTransit, extranodal, largestNodeCm, distantMets, metSites, ldhElevated,
       grade, sarcomaSite, histologyAvailable]);

  // Live preview so the clinician sees the stage change as they type — the
  // staging engine is pure, so this costs nothing.
  const preview = useMemo(() => computeStage(stagingInput), [stagingInput]);

  const submit = async () => {
    if (!patientId && !existingCase) { toast.error('Patient ID is required'); return; }
    setSaving(true);
    try {
      let caseRecord = existingCase;
      if (!caseRecord) {
        caseRecord = await createCase({
          patient_id: patientId,
          tumor_family: family,
          diagnosis: diagnosis || TUMOR_FAMILIES.find(f => f.value === family)?.label,
          primary_site: primarySite,
          sarcoma_site: isSarcoma ? sarcomaSite : undefined,
          histology_available: histologyAvailable,
          histologic_type: histologicType || null,
          status: 'active',
        });
      }

      await recordAssessment(caseRecord, stagingInput, {
        local_spread: localSpread,
        regional_spread: regionalSpread,
        metastatic_spread: metastaticSpread,
        histologic_type: histologicType || null,
        histologic_grade: isSarcoma ? grade : null,
        margins,
        perineural_invasion: perineural,
        notes,
      });

      toast.success('Assessment recorded');
      onSaved((caseRecord.serverId || caseRecord.id)!);
    } catch (err: any) {
      toast.error(err?.message || 'Could not save the assessment');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="p-4 md:p-6 max-w-4xl mx-auto">
      <button onClick={onCancel} className="mb-4 text-sm text-gray-600 flex items-center gap-1 hover:text-gray-900">
        <ArrowLeft className="w-4 h-4" /> Back
      </button>

      <h1 className="text-xl font-bold text-gray-900 mb-1">
        {existingCase ? 'New staging assessment' : 'New tumour board case'}
      </h1>
      <p className="text-sm text-gray-600 mb-6">
        {existingCase
          ? 'This is appended as a new version. Previous assessments are preserved.'
          : 'Record the initial assessment. Histology can be added later as a further version.'}
      </p>

      <div className="space-y-5">
        {!existingCase && (
          <Section title="Case">
            <Field label="Patient ID">
              <input value={patientId} onChange={e => setPatientId(e.target.value)} className="input" placeholder="Numeric patient ID" />
            </Field>
            <Field label="Tumour type">
              <select value={family} onChange={e => setFamily(e.target.value as TumorFamily)} className="input">
                {TUMOR_FAMILIES.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
              </select>
              <p className="text-xs text-gray-500 mt-1">{TUMOR_FAMILIES.find(f => f.value === family)?.hint}</p>
            </Field>
            <Field label="Diagnosis"><input value={diagnosis} onChange={e => setDiagnosis(e.target.value)} className="input" /></Field>
            <Field label="Primary site"><input value={primarySite} onChange={e => setPrimarySite(e.target.value)} className="input" placeholder="e.g. left calf, right pinna" /></Field>
          </Section>
        )}

        <Section title="Staging basis">
          <Field label="Basis">
            <select value={basis} onChange={e => setBasis(e.target.value as StagingBasis)} className="input">
              {BASIS_OPTIONS.map(b => <option key={b.value} value={b.value}>{b.label}</option>)}
            </select>
          </Field>
          <Check label="Histology available" checked={histologyAvailable} onChange={setHistologyAvailable} />
          {histologyAvailable && (
            <Field label="Histologic type">
              <input value={histologicType} onChange={e => setHistologicType(e.target.value)} className="input" placeholder="e.g. superficial spreading melanoma; myxoid liposarcoma" />
            </Field>
          )}
        </Section>

        <Section title="Primary tumour">
          {isMelanoma && (
            <>
              <Field label="Breslow thickness (mm)">
                <input type="number" step="0.01" value={breslowMm} onChange={e => setBreslowMm(e.target.value)} className="input" />
              </Field>
              <Check label="Ulceration present" checked={ulceration} onChange={setUlceration} />
              <Check label="In situ (no invasion)" checked={inSitu} onChange={setInSitu} />
            </>
          )}
          {!isMelanoma && (
            <Field label="Greatest dimension (cm)">
              <input type="number" step="0.1" value={sizeCm} onChange={e => setSizeCm(e.target.value)} className="input" />
            </Field>
          )}
          {isKeratinocyte && (
            <>
              <Check label="Deep invasion (>6 mm or beyond subcutaneous fat)" checked={deepInvasion} onChange={setDeepInvasion} />
              <Check label="Perineural invasion" checked={perineural} onChange={setPerineural} />
            </>
          )}
          {isSarcoma && (
            <>
              <Field label="Anatomical site">
                <select value={sarcomaSite} onChange={e => setSarcomaSite(e.target.value as any)} className="input">
                  <option value="trunk_extremity">Trunk / extremity</option>
                  <option value="retroperitoneal">Retroperitoneal</option>
                  <option value="head_neck">Head & neck</option>
                  <option value="viscera">Visceral</option>
                </select>
              </Field>
              <Field label="FNCLCC grade">
                <select value={grade} onChange={e => setGrade(e.target.value as SarcomaGrade)} className="input">
                  <option value="GX">GX — not assessed</option>
                  <option value="G1">G1 — low grade</option>
                  <option value="G2">G2 — intermediate</option>
                  <option value="G3">G3 — high grade</option>
                </select>
              </Field>
            </>
          )}
          <Field label="Local spread (free text)">
            <textarea value={localSpread} onChange={e => setLocalSpread(e.target.value)} className="input" rows={2} placeholder="Depth, structures involved, fixity" />
          </Field>
        </Section>

        <Section title="Regional spread">
          <Field label="Number of involved nodes">
            <input type="number" min="0" value={nodesInvolved} onChange={e => setNodesInvolved(e.target.value)} className="input" />
          </Field>
          <Check label="Nodes clinically or radiologically detected (macroscopic)" checked={nodesDetected} onChange={setNodesDetected} />
          {(isMelanoma || family === 'merkel_cell') && (
            <Check label="In-transit, satellite or microsatellite disease" checked={inTransit} onChange={setInTransit} />
          )}
          {isKeratinocyte && (
            <>
              <Check label="Extranodal extension" checked={extranodal} onChange={setExtranodal} />
              <Field label="Largest node (cm)">
                <input type="number" step="0.1" value={largestNodeCm} onChange={e => setLargestNodeCm(e.target.value)} className="input" />
              </Field>
            </>
          )}
          <Field label="Regional spread (free text)">
            <textarea value={regionalSpread} onChange={e => setRegionalSpread(e.target.value)} className="input" rows={2} />
          </Field>
        </Section>

        <Section title="Metastatic spread">
          <Check label="Distant metastases present" checked={distantMets} onChange={setDistantMets} />
          {distantMets && (
            <>
              <div className="flex flex-wrap gap-2 mt-2">
                {['skin_soft_tissue_nodal', 'lung', 'visceral_non_cns', 'cns', 'bone'].map(site => (
                  <label key={site} className="flex items-center gap-1.5 text-sm border rounded px-2 py-1 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={metSites.includes(site)}
                      onChange={e => setMetSites(prev => e.target.checked ? [...prev, site] : prev.filter(s => s !== site))}
                    />
                    {site.replace(/_/g, ' ')}
                  </label>
                ))}
              </div>
              {isMelanoma && (
                <Field label="Serum LDH">
                  <select value={ldhElevated} onChange={e => setLdhElevated(e.target.value as any)} className="input">
                    <option value="unknown">Not recorded</option>
                    <option value="no">Not elevated</option>
                    <option value="yes">Elevated</option>
                  </select>
                </Field>
              )}
            </>
          )}
          <Field label="Metastatic spread (free text)">
            <textarea value={metastaticSpread} onChange={e => setMetastaticSpread(e.target.value)} className="input" rows={2} />
          </Field>
        </Section>

        <Section title="Pathology & notes">
          <Field label="Margins"><input value={margins} onChange={e => setMargins(e.target.value)} className="input" placeholder="e.g. clear, 8 mm closest deep margin" /></Field>
          <Field label="Notes"><textarea value={notes} onChange={e => setNotes(e.target.value)} className="input" rows={2} /></Field>
        </Section>

        {preview && (
          <div className="bg-primary-50 border border-primary-200 rounded-lg p-4">
            <div className="text-xs uppercase tracking-wide text-primary-700 font-semibold mb-1">Computed stage</div>
            <div className="text-lg font-bold text-gray-900">{preview.formatted}</div>
            <div className="text-sm text-gray-600 mt-1">{preview.stageDescription}</div>
            <div className="text-xs text-gray-500 mt-1">{preview.stagingSystem}</div>
            {preview.caveats.length > 0 && (
              <ul className="mt-3 space-y-1">
                {preview.caveats.map((c: string, i: number) => (
                  <li key={i} className="text-xs text-amber-800 flex gap-1.5">
                    <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />{c}
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        <div className="flex gap-2 pb-8">
          <button onClick={submit} disabled={saving} className="px-4 py-2 bg-primary-600 text-white rounded-lg text-sm font-medium disabled:opacity-50 flex items-center gap-2">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
            Save assessment
          </button>
          <button onClick={onCancel} className="px-4 py-2 border rounded-lg text-sm">Cancel</button>
        </div>
      </div>
    </div>
  );
}

const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <div className="bg-white border rounded-lg p-4">
    <h2 className="font-semibold text-gray-900 mb-3">{title}</h2>
    <div className="space-y-3">{children}</div>
  </div>
);

const Field = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <div>
    <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
    {children}
  </div>
);

const Check = ({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) => (
  <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
    <input type="checkbox" checked={checked} onChange={e => onChange(e.target.checked)} className="rounded" />
    {label}
  </label>
);

// ─────────────────────────────────────────────────────────────────────────
// Case detail
// ─────────────────────────────────────────────────────────────────────────

function CaseDetailView({
  detail, busy, setBusy, onBack, onReassess, onRefresh,
}: {
  detail: CaseDetail;
  busy: boolean;
  setBusy: (b: boolean) => void;
  onBack: () => void;
  onReassess: () => void;
  onRefresh: () => Promise<void>;
}) {
  const [tab, setTab] = useState<'timeline' | 'plan' | 'referrals' | 'surveillance' | 'counselling'>('timeline');
  const c = detail.case;
  const latest: TumorBoardAssessment | undefined = detail.assessments[0];
  const patientName = `${c.first_name || ''} ${c.last_name || ''}`.trim() || undefined;

  const stage = useMemo(() => (latest ? stageFromAssessment(latest) : null), [latest]);
  const plan = useMemo(
    () => (stage ? buildPlanForCase(c, stage, latest?.inputs as StagingInput) : null),
    [c, stage, latest]
  );
  const letters = useMemo(() => {
    if (!stage || !plan) return [];
    return buildLetters({
      patient: { name: patientName || 'Patient', hospitalNumber: c.patient_hospital_number || c.hospital_number },
      stage, plan,
      diagnosis: c.diagnosis || '',
      histologicType: c.histologic_type,
      primarySite: c.primary_site,
      boardDate: c.last_board_date,
      comorbidities: c.comorbidities,
      performanceStatus: c.performance_status,
    });
  }, [stage, plan, c, patientName]);
  const surveillance = useMemo(
    () => (stage ? buildSurveillance(c, stage, { grade: latest?.histologic_grade as string }) : null),
    [c, stage, latest]
  );
  const counselling = useMemo(
    () => (stage && plan ? buildCounselling(c, stage, plan, patientName) : null),
    [c, stage, plan, patientName]
  );

  const meta = {
    title: '',
    patientName,
    hospitalNumber: c.patient_hospital_number || c.hospital_number,
    diagnosis: c.diagnosis,
    boardDate: c.last_board_date,
  };

  const persistPlan = async () => {
    if (!plan) return;
    setBusy(true);
    try {
      const saved = await savePlan(c, plan, { assessmentId: latest?.id, boardDate: new Date().toISOString().slice(0, 10) });
      if (letters.length) await saveReferrals(c, letters, saved?.id);
      if (surveillance) await saveSurveillance(c, surveillance);
      toast.success('Plan, referrals and surveillance saved');
      await onRefresh();
    } catch (err: any) {
      toast.error(err?.message || 'Could not save the plan');
    } finally {
      setBusy(false);
    }
  };

  const TABS = [
    { id: 'timeline', label: 'Staging timeline', icon: Activity },
    { id: 'plan', label: 'Management plan', icon: ClipboardList },
    { id: 'referrals', label: 'Referrals', icon: Send },
    { id: 'surveillance', label: 'Surveillance', icon: RefreshCw },
    { id: 'counselling', label: 'Counselling', icon: Users },
  ] as const;

  return (
    <div className="p-4 md:p-6 max-w-6xl mx-auto">
      <button onClick={onBack} className="mb-4 text-sm text-gray-600 flex items-center gap-1 hover:text-gray-900">
        <ArrowLeft className="w-4 h-4" /> Back to board
      </button>

      <div className="bg-white border rounded-lg p-4 mb-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-xl font-bold text-gray-900">{patientName || `Patient ${c.patient_id}`}</h1>
            <p className="text-sm text-gray-600">{c.diagnosis}{c.primary_site ? ` — ${c.primary_site}` : ''}</p>
            {stage && <p className="text-sm font-mono mt-1">{stage.formatted}</p>}
          </div>
          <div className="flex flex-wrap gap-2">
            <button onClick={onReassess} className="px-3 py-2 border rounded-lg text-sm flex items-center gap-2 hover:bg-gray-50">
              <Plus className="w-4 h-4" /> Add assessment
            </button>
            <button onClick={persistPlan} disabled={busy || !plan} className="px-3 py-2 bg-primary-600 text-white rounded-lg text-sm flex items-center gap-2 disabled:opacity-50">
              {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />} Save plan
            </button>
          </div>
        </div>
        {!c.histology_available && (
          <div className="mt-3 bg-amber-50 border border-amber-200 rounded p-2 text-sm text-amber-800 flex gap-2">
            <FlaskConical className="w-4 h-4 flex-shrink-0 mt-0.5" />
            Histology pending — this plan is provisional. Add a pathological assessment when the report arrives.
          </div>
        )}
      </div>

      <div className="flex gap-1 border-b mb-4 overflow-x-auto">
        {TABS.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id as any)}
            className={`px-3 py-2 text-sm whitespace-nowrap border-b-2 flex items-center gap-1.5 ${
              tab === t.id ? 'border-primary-600 text-primary-700 font-medium' : 'border-transparent text-gray-600'
            }`}
          >
            <t.icon className="w-4 h-4" /> {t.label}
          </button>
        ))}
      </div>

      {tab === 'timeline' && (
        <div className="space-y-3">
          <ExportButton onClick={() => stage && plan && generateBoardSummaryPdf({
            case: c, assessments: detail.assessments, stage, plan, patientName, boardDate: c.last_board_date,
          })} label="Export board summary (PDF)" />
          {detail.assessments.length === 0 && <Empty text="No assessments recorded yet." />}
          {detail.assessments.map(a => (
            <div key={String(a.id)} className="bg-white border rounded-lg p-4">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-gray-900">Version {a.version} — {a.basis} staging</span>
                <span className={`px-2 py-0.5 rounded text-xs font-semibold ${stageTone(a.stage_group)}`}>Stage {a.stage_group}</span>
              </div>
              <div className="text-sm font-mono text-gray-700 mt-1">{a.stage_formatted}</div>
              <div className="text-xs text-gray-500 mt-1">{a.staging_system}</div>
              {a.histologic_type && <Detail label="Histology" value={a.histologic_type} />}
              {a.histologic_grade && <Detail label="Grade" value={String(a.histologic_grade)} />}
              {a.local_spread && <Detail label="Local spread" value={a.local_spread} />}
              {a.regional_spread && <Detail label="Regional spread" value={a.regional_spread} />}
              {a.metastatic_spread && <Detail label="Metastatic spread" value={a.metastatic_spread} />}
              {a.margins && <Detail label="Margins" value={a.margins} />}
              {a.notes && <Detail label="Notes" value={a.notes} />}
              {(a.caveats || []).length > 0 && (
                <ul className="mt-2 space-y-1">
                  {(a.caveats || []).map((cv, i) => (
                    <li key={i} className="text-xs text-amber-800 flex gap-1.5">
                      <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />{cv}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ))}
        </div>
      )}

      {tab === 'plan' && plan && (
        <div className="space-y-3">
          <div className="bg-white border rounded-lg p-4">
            <div className="text-sm text-gray-600">{plan.summary}</div>
          </div>
          {plan.items.map((item, i) => (
            <div key={i} className="bg-white border rounded-lg p-4">
              <div className="flex items-start justify-between gap-2">
                <div className="font-semibold text-gray-900">{item.title}</div>
                <span className={`px-2 py-0.5 rounded text-xs font-semibold ${
                  item.strength === 'required' ? 'bg-red-100 text-red-800'
                  : item.strength === 'recommend' ? 'bg-green-100 text-green-800'
                  : 'bg-gray-100 text-gray-700'
                }`}>{item.strength}</span>
              </div>
              <p className="text-sm text-gray-700 mt-1">{item.detail}</p>
              <div className="text-xs text-gray-500 mt-2">
                {SPECIALTY_LABELS[item.owner]} · {item.basis}
              </div>
            </div>
          ))}
          {plan.caveats.map((cv, i) => (
            <div key={i} className="bg-amber-50 border border-amber-200 rounded p-3 text-sm text-amber-900 flex gap-2">
              <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />{cv}
            </div>
          ))}
        </div>
      )}

      {tab === 'referrals' && (
        <div className="space-y-3">
          <ExportButton onClick={() => generateAllReferralLettersPdf(letters, meta)} label="Export all letters (PDF)" />
          {letters.map((l, i) => (
            <details key={i} className="bg-white border rounded-lg p-4">
              <summary className="cursor-pointer font-semibold text-gray-900 flex items-center justify-between">
                <span>{l.specialtyLabel}</span>
                {l.urgency !== 'routine' && (
                  <span className="px-2 py-0.5 rounded text-xs bg-red-100 text-red-800">
                    {l.urgency === 'two_week' ? 'Cancer pathway' : 'Urgent'}
                  </span>
                )}
              </summary>
              <pre className="mt-3 text-xs whitespace-pre-wrap font-sans text-gray-700 border-t pt-3">{l.body}</pre>
            </details>
          ))}
        </div>
      )}

      {tab === 'surveillance' && surveillance && (
        <div className="space-y-3">
          <ExportButton onClick={() => generateSurveillancePdf(surveillance, meta)} label="Export schedule (PDF)" />
          <div className="bg-white border rounded-lg p-4 text-sm text-gray-700">{surveillance.narrative}</div>
          <div className="bg-white border rounded-lg divide-y">
            {surveillance.items.slice(0, 60).map((s, i) => (
              <div key={i} className="p-3 flex items-start justify-between gap-3">
                <div>
                  <div className="text-sm font-medium text-gray-900">{s.title}</div>
                  <div className="text-xs text-gray-500 mt-0.5">{s.detail}</div>
                </div>
                <div className="text-xs text-gray-600 whitespace-nowrap">{s.dueDate}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {tab === 'counselling' && counselling && (
        <div className="space-y-3">
          <ExportButton onClick={() => generateCounsellingPdf(counselling, meta)} label="Export patient information (PDF)" />
          {counselling.sections.map((s, i) => (
            <div key={i} className="bg-white border rounded-lg p-4">
              <h3 className="font-semibold text-gray-900 mb-1">{s.heading}</h3>
              <p className="text-sm text-gray-700 whitespace-pre-line">{s.body}</p>
            </div>
          ))}
          <div className="bg-white border rounded-lg p-4">
            <h3 className="font-semibold text-gray-900 mb-2">Questions you may want to ask us</h3>
            <ul className="list-disc pl-5 text-sm text-gray-700 space-y-1">
              {counselling.questionsToAsk.map((q, i) => <li key={i}>{q}</li>)}
            </ul>
          </div>
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <h3 className="font-semibold text-red-900 mb-2">When to contact us urgently</h3>
            <ul className="list-disc pl-5 text-sm text-red-900 space-y-1">
              {counselling.redFlags.map((f, i) => <li key={i}>{f}</li>)}
            </ul>
          </div>
          <p className="text-xs text-gray-500">{counselling.disclaimer}</p>
        </div>
      )}
    </div>
  );
}

const Detail = ({ label, value }: { label: string; value: string }) => (
  <div className="text-sm text-gray-700 mt-1"><span className="text-gray-500">{label}:</span> {value}</div>
);

const Empty = ({ text }: { text: string }) => (
  <div className="text-center py-12 text-gray-500 text-sm">{text}</div>
);

const ExportButton = ({ onClick, label }: { onClick: () => void; label: string }) => (
  <button onClick={onClick} className="px-3 py-2 border rounded-lg text-sm flex items-center gap-2 hover:bg-gray-50">
    <FileText className="w-4 h-4" /> {label}
  </button>
);

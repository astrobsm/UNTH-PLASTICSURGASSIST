/**
 * Pre-Operative Workup — everything that must be settled before a patient goes
 * to theatre, on one page.
 *
 * WHY IT IS SEPARATE FROM THE BOOKING REGISTER
 * The Booking Register schedules: theatre calendar, capacity, the booked list.
 * That is a different job from establishing whether this patient is ready, and
 * mixing them meant the readiness questions were spread across a page built for
 * scheduling. This page answers one question — is this patient fit to be
 * operated on, and what is outstanding.
 *
 * It is also the module the pre-surgical conference reads from: the same nine
 * sections, in the same order, so the brief and the workup cannot disagree.
 *
 * NOTHING HERE IS INVENTED. Every section renders what was recorded, and says
 * so plainly when nothing was. The two places this matters most are the
 * laboratory results, which go stale, and the medication advice, which is a
 * prompt for a decision rather than the decision itself.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Activity, AlertTriangle, CalendarClock, ClipboardList, FlaskConical, Image as ImageIcon,
  Loader2, Pill, RefreshCw, Search, Stethoscope, User,
} from 'lucide-react';
import {
  preSurgicalConferenceService,
  type ConferenceData,
  type ConferencePatient,
} from '../services/preSurgicalConferenceService';
import {
  adviseOnMedications,
  PREOP_ACTION_META,
} from '../services/preoperativeMedicationAdvice';
import { useOnSelectedPatient } from '../hooks/useSelectedPatient';

/**
 * How old a laboratory result may be before theatre.
 *
 * A week is the working rule here: bloods older than that no longer describe
 * the patient who is about to be anaesthetised. Results past it are not hidden
 * — they are shown, marked stale, and counted, because "no recent bloods" is a
 * finding the brief needs rather than an empty section.
 */
const LAB_STALE_AFTER_DAYS = 7;

function daysSince(value: string | null | undefined): number | null {
  if (!value) return null;
  const t = new Date(value).getTime();
  if (!Number.isFinite(t)) return null;
  return Math.floor((Date.now() - t) / 86_400_000);
}

function fmt(value: unknown, fallback = 'Not documented'): string {
  if (value === null || value === undefined) return fallback;
  const s = String(value).trim();
  return s.length ? s : fallback;
}

/** One collapsible-free section card; the page is meant to be read straight down. */
function Section({
  title, icon, count, children, tone = 'text-gray-800',
}: {
  title: string;
  icon: React.ReactNode;
  count?: string;
  children: React.ReactNode;
  tone?: string;
}) {
  return (
    <section className="bg-white rounded-xl border border-gray-200 p-5">
      <h3 className={`flex items-center gap-2 text-sm font-semibold uppercase tracking-wide mb-3 ${tone}`}>
        {icon}
        {title}
        {count && <span className="ml-1 text-xs font-normal normal-case text-gray-400">{count}</span>}
      </h3>
      {children}
    </section>
  );
}

const Empty = ({ children }: { children: React.ReactNode }) => (
  <p className="text-sm text-gray-400 italic">{children}</p>
);

export default function PreOperativeWorkupPage() {
  const navigate = useNavigate();
  const [patients, setPatients] = useState<ConferencePatient[]>([]);
  const [selected, setSelected] = useState<ConferencePatient | null>(null);
  const [data, setData] = useState<ConferenceData | null>(null);
  const [loading, setLoading] = useState(false);
  const [listLoading, setListLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');

  const loadPatients = useCallback(async () => {
    setListLoading(true);
    try {
      const list = await preSurgicalConferenceService.getScheduledPatients();
      setPatients(Array.isArray(list) ? list : []);
    } catch {
      setError('Could not load the booked patients.');
    } finally {
      setListLoading(false);
    }
  }, []);

  const loadWorkup = useCallback(async (patientId: string) => {
    setLoading(true);
    setError('');
    try {
      // The same bundle the pre-surgical conference reads, so the two views
      // cannot drift apart.
      setData(await preSurgicalConferenceService.getConferenceData(patientId));
    } catch {
      setError('Could not load this patient’s workup.');
      setData(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void loadPatients(); }, [loadPatients]);

  const choose = (p: ConferencePatient) => {
    setSelected(p);
    void loadWorkup(p.id);
  };

  // Following the globally-selected patient keeps this page in step with the
  // rest of the app rather than needing its own selection.
  useOnSelectedPatient((p) => {
    const match = patients.find((cp) => String(cp.id) === String(p.id));
    if (match) { choose(match); return; }
    const synth = {
      id: String(p.id),
      hospital_number: (p as { hospital_number?: string }).hospital_number || '',
      full_name: (p as { full_name?: string }).full_name || '',
    } as ConferencePatient;
    setPatients(prev => (prev.some(cp => String(cp.id) === String(synth.id)) ? prev : [synth, ...prev]));
    setSelected(synth);
    void loadWorkup(String(p.id));
  });

  const advisedMeds = useMemo(
    () => adviseOnMedications(data?.medications || []),
    [data?.medications]
  );

  /** Most recent result per test, with its age — the brief only wants the current picture. */
  const labs = useMemo(() => {
    const latest = new Map<string, { name: string; date: string | null; status: string; age: number | null }>();
    for (const r of data?.labResults || []) {
      const name = r.test_name || r.test_type || 'Investigation';
      const date = r.completed_at || r.ordered_at || null;
      const existing = latest.get(name);
      const t = date ? new Date(date).getTime() : 0;
      const existingT = existing?.date ? new Date(existing.date).getTime() : -1;
      if (!existing || t > existingT) {
        latest.set(name, { name, date, status: r.status, age: daysSince(date) });
      }
    }
    return [...latest.values()].sort((a, b) => (a.age ?? 9999) - (b.age ?? 9999));
  }, [data?.labResults]);

  const staleLabs = labs.filter(l => l.age === null || l.age > LAB_STALE_AFTER_DAYS);

  const filtered = patients.filter(p =>
    (p.full_name || '').toLowerCase().includes(search.toLowerCase()) ||
    (p.hospital_number || '').toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto p-4 md:p-6">
        <header className="mb-6 flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-gradient-to-br from-sky-600 to-indigo-700 text-white">
            <ClipboardList className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Pre-Operative Workup</h1>
            <p className="text-sm text-gray-500">
              Readiness for theatre — read by the pre-surgical conference
            </p>
          </div>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Patient list */}
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <div className="relative mb-3">
              <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search booked patients"
                className="w-full pl-9 pr-3 py-2 text-sm border border-gray-300 rounded-lg"
              />
            </div>
            {listLoading ? (
              <div className="flex items-center gap-2 text-gray-500 text-sm py-4">
                <Loader2 className="w-4 h-4 animate-spin" /> Loading…
              </div>
            ) : filtered.length === 0 ? (
              <Empty>No booked patients found.</Empty>
            ) : (
              <ul className="divide-y max-h-[28rem] overflow-y-auto">
                {filtered.map(p => (
                  <li key={p.id}>
                    <button
                      onClick={() => choose(p)}
                      className={`w-full text-left px-2 py-2.5 rounded-lg hover:bg-gray-50 ${
                        selected?.id === p.id ? 'bg-sky-50 ring-1 ring-sky-200' : ''
                      }`}
                    >
                      <span className="block text-sm font-medium text-gray-800">
                        {fmt(p.full_name, 'Unnamed patient')}
                      </span>
                      <span className="block text-xs text-gray-500">{fmt(p.hospital_number, '—')}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Workup */}
          <div className="lg:col-span-2 space-y-4">
            {!selected ? (
              <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
                <ClipboardList className="w-14 h-14 text-gray-300 mx-auto mb-3" />
                <p className="text-gray-600 font-medium">Select a patient</p>
                <p className="text-sm text-gray-500 mt-1">
                  Their workup is assembled from what has already been recorded.
                </p>
              </div>
            ) : loading ? (
              <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
                <Loader2 className="w-10 h-10 animate-spin text-sky-600 mx-auto" />
              </div>
            ) : error ? (
              <div className="bg-white rounded-xl border border-gray-200 p-8 text-center">
                <AlertTriangle className="w-10 h-10 text-red-500 mx-auto mb-2" />
                <p className="text-red-600">{error}</p>
                <button
                  onClick={() => loadWorkup(selected.id)}
                  className="mt-3 px-4 py-2 bg-red-600 text-white rounded-lg text-sm"
                >
                  Retry
                </button>
              </div>
            ) : data ? (
              <>
                <div className="flex justify-end">
                  <button
                    onClick={() => loadWorkup(selected.id)}
                    className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700"
                  >
                    <RefreshCw className="w-4 h-4" /> Refresh
                  </button>
                </div>

                {/* 1 — Patient details */}
                <Section title="Patient details" icon={<User className="w-4 h-4" />}>
                  <dl className="grid grid-cols-2 md:grid-cols-3 gap-3 text-sm">
                    {[
                      ['Name', data.patient?.full_name],
                      ['Hospital number', data.patient?.hospital_number],
                      ['Sex', data.patient?.gender],
                      ['Blood group', data.patient?.blood_group],
                      ['Allergies', data.patient?.allergies],
                      ['Bed', data.patient?.bed_number],
                    ].map(([label, value]) => (
                      <div key={String(label)}>
                        <dt className="text-xs text-gray-500">{label}</dt>
                        <dd className="text-gray-900">{fmt(value)}</dd>
                      </div>
                    ))}
                  </dl>
                </Section>

                {/* 2 — Diagnosis */}
                <Section title="Diagnosis" icon={<Stethoscope className="w-4 h-4" />}>
                  <p className="text-sm text-gray-900">{fmt(data.patient?.primary_diagnosis)}</p>
                  {Array.isArray(data.patient?.secondary_diagnoses) && data.patient.secondary_diagnoses.length > 0 && (
                    <ul className="mt-2 list-disc list-inside text-sm text-gray-600">
                      {data.patient.secondary_diagnoses.map((d, i) => <li key={i}>{d}</li>)}
                    </ul>
                  )}
                </Section>

                {/* 3 — Planned procedure + 6 — proposed ward */}
                <Section title="Planned procedure" icon={<CalendarClock className="w-4 h-4" />}>
                  {data.plannedProcedures?.length ? (
                    data.plannedProcedures.map(p => (
                      <div key={p.id} className="mb-3 last:mb-0 text-sm">
                        <p className="font-medium text-gray-900">{fmt(p.procedure_name)}</p>
                        <p className="text-gray-600">
                          {fmt(p.scheduled_date && new Date(p.scheduled_date).toLocaleString(), 'Date not set')}
                          {' · '}Surgeon: {fmt(p.surgeon_name)}
                          {' · '}Anaesthesia: {fmt(p.anesthesia_type)}
                        </p>
                        <p className="text-gray-600">
                          Theatre: {fmt(p.operating_room)} · Proposed ward: {fmt(data.patient?.ward)}
                        </p>
                      </div>
                    ))
                  ) : (
                    <Empty>No procedure booked — this patient is not yet scheduled.</Empty>
                  )}
                </Section>

                {/* 4 — Clinical photographs */}
                <Section
                  title="Clinical photographs"
                  icon={<ImageIcon className="w-4 h-4" />}
                  count={data.clinicalPhotographs?.length ? `${data.clinicalPhotographs.length}` : undefined}
                >
                  {data.clinicalPhotographs?.length ? (
                    <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                      {data.clinicalPhotographs.slice(0, 8).map(ph => (
                        <figure key={ph.id} className="text-center">
                          <img
                            src={ph.url}
                            alt={ph.caption || 'Clinical photograph'}
                            loading="lazy"
                            className="w-full aspect-square object-cover rounded-lg border"
                          />
                          <figcaption className="text-[10px] text-gray-500 mt-1 truncate">
                            {ph.date ? new Date(ph.date).toLocaleDateString() : ''}
                          </figcaption>
                        </figure>
                      ))}
                    </div>
                  ) : (
                    <Empty>No clinical photographs recorded.</Empty>
                  )}
                </Section>

                {/* 5 — Medications with pre-op advice */}
                <Section
                  title="Current medications"
                  icon={<Pill className="w-4 h-4" />}
                  count={advisedMeds.length ? `${advisedMeds.length}` : undefined}
                >
                  {advisedMeds.length === 0 ? (
                    <Empty>No active medications recorded.</Empty>
                  ) : (
                    <>
                      <p className="text-xs text-gray-500 mb-3">
                        Guidance below is a prompt for a decision, not the decision. Confirm every
                        one with the anaesthetist and the prescribing team.
                      </p>
                      <ul className="divide-y">
                        {advisedMeds.map(({ medication, advice }, i) => {
                          const meta = advice ? PREOP_ACTION_META[advice.action] : null;
                          return (
                            <li key={i} className="py-2.5">
                              <div className="flex flex-wrap items-center gap-2">
                                <span className="text-sm font-medium text-gray-900">
                                  {fmt(medication.medication_name)}
                                </span>
                                <span className="text-xs text-gray-500">
                                  {fmt(medication.dosage, '')} {fmt(medication.route, '')} {fmt(medication.frequency, '')}
                                </span>
                                {meta ? (
                                  <span className={`text-xs px-2 py-0.5 rounded-full border ${meta.tone}`}>
                                    {meta.label}
                                  </span>
                                ) : (
                                  <span className="text-xs px-2 py-0.5 rounded-full border text-gray-600 bg-gray-50 border-gray-200">
                                    No guidance — review manually
                                  </span>
                                )}
                              </div>
                              {advice && (
                                <p className="text-xs text-gray-600 mt-1">
                                  {advice.timing && <span className="font-medium">{advice.timing}. </span>}
                                  {advice.reason}
                                </p>
                              )}
                            </li>
                          );
                        })}
                      </ul>
                    </>
                  )}
                </Section>

                {/* 7 — Laboratory investigations */}
                <Section
                  title="Laboratory investigations"
                  icon={<FlaskConical className="w-4 h-4" />}
                  count={labs.length ? `${labs.length} most recent` : undefined}
                >
                  {labs.length === 0 ? (
                    <Empty>No investigations recorded.</Empty>
                  ) : (
                    <>
                      {staleLabs.length > 0 && (
                        <p className="flex items-start gap-2 text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-lg p-2.5 mb-3">
                          <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
                          <span>
                            {staleLabs.length} result{staleLabs.length === 1 ? '' : 's'} older than{' '}
                            {LAB_STALE_AFTER_DAYS} days — must be repeated before theatre.
                          </span>
                        </p>
                      )}
                      <ul className="divide-y">
                        {labs.map(l => {
                          const stale = l.age === null || l.age > LAB_STALE_AFTER_DAYS;
                          return (
                            <li key={l.name} className="py-2 flex flex-wrap items-center justify-between gap-2">
                              <span className="text-sm text-gray-900">{l.name}</span>
                              <span className={`text-xs ${stale ? 'text-amber-700 font-medium' : 'text-gray-500'}`}>
                                {l.date ? new Date(l.date).toLocaleDateString() : 'No date'}
                                {l.age !== null && ` · ${l.age} day${l.age === 1 ? '' : 's'} old`}
                                {stale && ' · UPDATE REQUIRED'}
                              </span>
                            </li>
                          );
                        })}
                      </ul>
                      <button
                        onClick={() => navigate(`/patients/${selected.id}`)}
                        className="mt-3 text-sm text-sky-700 hover:underline"
                      >
                        Update investigations in the patient record →
                      </button>
                    </>
                  )}
                </Section>

                {/* 8 — Risk assessments & 9 — comorbidities */}
                <Section
                  title="Comorbidities"
                  icon={<Activity className="w-4 h-4" />}
                  count={data.comorbidities?.length ? `${data.comorbidities.length}` : undefined}
                >
                  {data.comorbidities?.length ? (
                    <ul className="flex flex-wrap gap-2">
                      {data.comorbidities.map((c, i) => (
                        <li
                          key={i}
                          className="text-xs px-2.5 py-1 rounded-full border bg-gray-50 border-gray-200 text-gray-700"
                          title={c.notes || undefined}
                        >
                          {c.name}{c.severity ? ` · ${c.severity}` : ''}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <Empty>No comorbidities documented.</Empty>
                  )}
                </Section>

                <Section title="Anaesthetic risk assessment" icon={<AlertTriangle className="w-4 h-4" />}>
                  {data.anaesthetistComments?.length ? (
                    <ul className="space-y-2">
                      {data.anaesthetistComments.map(c => (
                        <li key={c.id} className="text-sm">
                          <span className="font-medium text-gray-900">
                            {fmt(c.anaesthetist_name)}
                          </span>
                          {c.asa_grade && (
                            <span className="ml-2 text-xs px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200">
                              ASA {c.asa_grade}
                            </span>
                          )}
                          <p className="text-gray-600 mt-0.5">{fmt(c.anesthesia_plan || c.comment)}</p>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <Empty>
                      No anaesthetic review recorded — this patient has not been assessed for theatre.
                    </Empty>
                  )}
                </Section>
              </>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}

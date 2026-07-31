/**
 * Cache Warmer — Prefetch every module's data into IndexedDB + the Cache API so
 * the whole app, not just the pages the user happened to open, works offline.
 *
 * Three entry points:
 *   warmCache()         — full sweep with progress, driven from the Dashboard button
 *   autoWarmCache()     — the same sweep, silent and throttled, on login/reconnect
 *   warmOfflineAssets() — the OCR engine's wasm core + traineddata
 *
 * Reads go through apiClient with `freshRead`, which forces a real network round
 * trip (instead of returning the cached copy and firing a background refresh)
 * and writes the response to IndexedDB. Warming one endpoint at a time is
 * deliberate: a parallel sweep of ~200 requests is exactly the traffic spike
 * that hospital Wi-Fi drops.
 */

import { apiClient } from './apiClient';
import { OCR_CACHE_NAME, getTesseractAssetUrls } from '../config/ocrAssets';

export interface CacheWarmProgress {
  current: number;
  total: number;
  currentModule: string;
  status: 'idle' | 'warming' | 'done' | 'error';
  errors: string[];
  cached: number;
  skipped: number;
  /** Number of patients whose clinical detail was warmed (0 until that phase). */
  patientsWarmed?: number;
}

type ProgressCallback = (progress: CacheWarmProgress) => void;

interface ModuleGroup {
  module: string;
  endpoints: string[];
}

// ── Date helpers for the endpoints that are scoped to "now" ──────────
const isoDate = (d: Date) => d.toISOString().slice(0, 10);

function currentRosterWindow(): { start: string; end: string } {
  // A week back and four weeks forward: covers "who is on call" lookups for the
  // rest of the rotation plus the recent past a night shift may need to review.
  const now = new Date();
  const start = new Date(now);
  start.setDate(start.getDate() - 7);
  const end = new Date(now);
  end.setDate(end.getDate() + 28);
  return { start: isoDate(start), end: isoDate(end) };
}

/**
 * Every module-level (non patient-scoped) GET the app makes.
 *
 * IMPORTANT: only list endpoints that actually exist under /api. A missing one
 * answers 404/405 and is counted as "skipped" rather than failed, but it also
 * makes the progress total dishonest.
 */
function buildGlobalModules(): ModuleGroup[] {
  const { start, end } = currentRosterWindow();
  const today = isoDate(new Date());

  return [
    // ── Core patient record ──
    { module: 'Patients', endpoints: ['/patients', '/patients?status=active'] },
    {
      module: 'Admissions & Discharges',
      endpoints: ['/admissions', '/admissions?status=active', '/discharge-summaries'],
    },
    { module: 'Treatment Plans', endpoints: ['/treatment-plans'] },
    { module: 'Prescriptions', endpoints: ['/prescriptions'] },
    { module: 'Lab Orders & Results', endpoints: ['/lab-orders', '/lab-results'] },
    { module: 'Progress Notes', endpoints: ['/progress-notes'] },
    { module: 'Ward Rounds', endpoints: ['/ward-rounds'] },
    { module: 'Patient Activities', endpoints: ['/activities'] },
    { module: 'Patient Transfers', endpoints: ['/patient-transfers'] },

    // ── Theatre & peri-operative ──
    {
      module: 'Surgeries',
      endpoints: ['/surgeries', `/surgeries?date=${today}`, '/surgery-planning'],
    },
    { module: 'Preoperative Assessments', endpoints: ['/preoperative-assessments'] },
    { module: 'Pre-Surgical Conference', endpoints: ['/pre-surgical-conference'] },
    { module: 'Blood Transfusion', endpoints: ['/sync/blood-transfusions'] },

    // ── Wound & condition-specific protocols ──
    { module: 'Wound Care', endpoints: ['/wound-care'] },
    { module: 'Wound Progress Monitor', endpoints: ['/wounds'] },
    { module: 'Keloid Care', endpoints: ['/keloid-care', '/keloid-care/scheduled-patients'] },
    { module: 'Pressure Sores', endpoints: ['/pressure-sore-protocol'] },
    { module: 'Sickle Cell Ulcer', endpoints: ['/sickle-cell-ulcer'] },
    { module: 'Soft Tissue Infection', endpoints: ['/sti-protocol'] },
    { module: 'SJS/TEN Assessments', endpoints: ['/sjs-assessments'] },
    { module: 'Substance & Detox', endpoints: ['/substance-assessments'] },
    { module: 'Risk Assessments', endpoints: ['/risk-assessments'] },
    { module: 'Tumor Board', endpoints: ['/tumor-board?action=board', '/tumor-board?action=surveillance&withinDays=90'] },

    // ── Team, duty & scheduling ──
    { module: 'Users & Roles', endpoints: ['/users', '/roles'] },
    {
      module: 'Medical Team',
      endpoints: [
        '/medical-team',
        '/medical-team/assignments',
        '/medical-team/assignments?only_admitted=true',
        '/medical-team/workload',
      ],
    },
    {
      module: 'Call Duty Roster',
      endpoints: [`/call-duty-roster?action=range&start=${start}&end=${end}`],
    },
    { module: 'Clinic Duties', endpoints: ['/sync/clinic-duty-logs', '/clinic-day-logs'] },
    {
      module: 'Clinic Appointments',
      endpoints: ['/clinic-appointments', '/appointments?action=dates'],
    },
    { module: 'Duties & Reminders', endpoints: ['/duties', '/duty-reminders?action=status'] },
    { module: 'Rotations', endpoints: ['/rotations', '/rotation-config?action=all-responsibilities'] },
    { module: 'HO Tracking', endpoints: ['/ho-tracking?action=all-house-officers'] },
    { module: 'Attendance', endpoints: ['/attendance'] },

    // ── MDT & consults ──
    {
      module: 'MDT',
      endpoints: ['/mdt-patient-teams', '/mdt-meetings', '/mdt-contact-logs'],
    },
    { module: 'Consults', endpoints: ['/consults'] },
    {
      module: 'Consults Module',
      endpoints: ['/consults-module/received', '/consults-module/delivered', '/consults-module/links'],
    },

    // ── Education & training (large static payloads — very worth caching) ──
    {
      module: 'CME & Education',
      endpoints: [
        '/sync/cme-topics',
        '/sync/cme-articles',
        '/sync/cme-progress',
        '/sync/cme-reading-progress',
        '/sync/educational-topics',
        '/sync/education-user-progress',
        '/sync/topic-schedules',
        '/sync/weekly-contents',
      ],
    },
    { module: 'CBT & MCQ', endpoints: ['/cbt?action=tests', '/cbt?action=attempts'] },
    { module: 'Training Progress', endpoints: ['/training-progress', '/training-warnings'] },

    // ── Documents & comms ──
    { module: 'Paperwork', endpoints: ['/sync/paperwork-documents'] },
    { module: 'Notice Board', endpoints: ['/notice-board'] },
    { module: 'Chat', endpoints: ['/chat/rooms'] },
  ];
}

/**
 * Per-patient endpoints. These are what a ward round or a night call actually
 * reads, and none of them were reachable offline unless the clinician had
 * already opened that exact patient while online.
 */
function patientEndpoints(patientId: string | number): string[] {
  const id = encodeURIComponent(String(patientId));
  return [
    `/patients/${id}`,
    `/vital-signs?patientId=${id}`,
    `/progress-notes?patientId=${id}`,
    `/lab-orders?patientId=${id}`,
    `/lab-results?patientId=${id}`,
    `/treatment-plans?patientId=${id}`,
    `/admissions?patientId=${id}`,
    `/blood-glucose?patientId=${id}`,
    `/investigation-uploads?patientId=${id}`,
    `/mdt-documentation?patientId=${id}`,
    `/tumor-board?patientId=${id}`,
  ];
}

// Warming every patient on the ward × 10 endpoints has to stay bounded, or a
// unit with a long history turns one warm-up into a thousand requests.
const MAX_PATIENTS_TO_WARM = 40;

const LAST_WARM_KEY = 'psa_last_cache_warm';
// Long enough that reconnect flapping on ward Wi-Fi can't trigger repeat sweeps,
// short enough that a device left on overnight starts each shift current.
const AUTO_WARM_INTERVAL_MS = 6 * 60 * 60 * 1000;

/** Guards against two sweeps running at once (manual button vs. background). */
let warmInFlight: Promise<void> | null = null;

// ── Shared fetch step ────────────────────────────────────────────────

/** Fetch one endpoint into the cache. Returns 'cached' | 'skipped' | error message. */
async function warmEndpoint(endpoint: string): Promise<'cached' | 'skipped' | string> {
  try {
    // freshRead: bypass the stale-while-revalidate shortcut so we actually wait
    // for the network and know the write happened, one request at a time.
    await apiClient.get(endpoint, { freshRead: true });
    return 'cached';
  } catch (err: any) {
    const status: number | undefined = err?.status;
    const msg = err?.message || String(err);

    // "Expected" skips: endpoint absent or not permitted for this role.
    const isExpectedSkip =
      status === 401 || status === 403 || status === 404 || status === 405 || status === 501 ||
      /404|403|401|405|501|Not Found|Forbidden|Unauthorized/i.test(msg);

    return isExpectedSkip ? 'skipped' : msg;
  }
}

/** Pull the patient ids worth warming: those currently under our care. */
async function getPatientIdsToWarm(): Promise<Array<string | number>> {
  try {
    const res: any = await apiClient.get('/admissions?status=active');
    const rows: any[] = Array.isArray(res) ? res : res?.admissions || res?.data || [];
    const ids = rows
      .map(r => r?.patient_id ?? r?.patientId ?? r?.patient?.id)
      .filter(id => id !== undefined && id !== null);
    // De-duplicate: a patient re-admitted in the window appears more than once.
    return Array.from(new Set(ids)).slice(0, MAX_PATIENTS_TO_WARM);
  } catch {
    return [];
  }
}

// ── Offline asset pack (OCR engine) ──────────────────────────────────

/**
 * Pull the OCR engine into the Cache API. It is excluded from the precache
 * manifest (see vite.config.ts) because ~4 MB of wasm would otherwise have to
 * download before the app became usable on first install.
 *
 * Same-origin, unauthenticated, immutable files — safe to cache directly from
 * the page. Already-present entries are left alone, so repeat calls are free.
 */
export async function warmOfflineAssets(): Promise<{ cached: number; failed: number }> {
  let cached = 0;
  let failed = 0;

  if (typeof caches === 'undefined') return { cached, failed };

  try {
    const cache = await caches.open(OCR_CACHE_NAME);
    for (const url of getTesseractAssetUrls()) {
      try {
        if (await cache.match(url)) {
          cached++;
          continue;
        }
        // cache.add() is deliberately per-URL: addAll() is all-or-nothing, so a
        // single failure would discard the multi-megabyte core we just fetched.
        await cache.add(url);
        cached++;
      } catch (err) {
        console.warn(`[cacheWarmer] OCR asset unavailable: ${url}`, err);
        failed++;
      }
    }
  } catch (err) {
    console.warn('[cacheWarmer] Could not open OCR asset cache', err);
  }

  return { cached, failed };
}

// ── Full sweep ───────────────────────────────────────────────────────

export interface WarmOptions {
  /** Also warm per-patient clinical detail for admitted patients. Default true. */
  includePatients?: boolean;
  /** Also download the OCR engine. Default true. */
  includeAssets?: boolean;
}

export async function warmCache(
  onProgress?: ProgressCallback,
  options: WarmOptions = {}
): Promise<CacheWarmProgress> {
  // Share the in-flight guard with autoWarmCache. A manual press landing on top
  // of a background sweep would otherwise put two copies of ~250 requests on
  // the wire at once — the surest way to make a weak connection collapse.
  if (warmInFlight) {
    await warmInFlight.catch(() => { /* observe only */ });
  }

  let settle: () => void = () => {};
  warmInFlight = new Promise<void>(resolve => { settle = resolve; });

  try {
    return await runWarm(onProgress, options);
  } finally {
    settle();
    warmInFlight = null;
  }
}

async function runWarm(
  onProgress?: ProgressCallback,
  options: WarmOptions = {}
): Promise<CacheWarmProgress> {
  const { includePatients = true, includeAssets = true } = options;
  const globalModules = buildGlobalModules();
  const globalTotal = globalModules.reduce((sum, g) => sum + g.endpoints.length, 0);

  const progress: CacheWarmProgress = {
    current: 0,
    // Patient endpoints are added to the total once we know the patient count,
    // and the asset pack counts as one step.
    total: globalTotal + (includeAssets ? 1 : 0),
    currentModule: '',
    status: 'warming',
    errors: [],
    cached: 0,
    skipped: 0,
    patientsWarmed: 0,
  };

  const notify = () => onProgress?.({ ...progress });
  const record = (module: string, result: 'cached' | 'skipped' | string) => {
    if (result === 'cached') progress.cached++;
    else if (result === 'skipped') progress.skipped++;
    else {
      progress.errors.push(`${module}: ${result}`);
      progress.skipped++;
    }
    progress.current++;
    notify();
  };

  notify();

  // ── Phase 1: module-level data ──
  for (const group of globalModules) {
    progress.currentModule = group.module;
    notify();
    for (const endpoint of group.endpoints) {
      record(group.module, await warmEndpoint(endpoint));
    }
  }

  // ── Phase 2: per-patient clinical detail ──
  if (includePatients) {
    progress.currentModule = 'Patient records';
    notify();

    const patientIds = await getPatientIdsToWarm();
    if (patientIds.length) {
      progress.total += patientIds.length * patientEndpoints(patientIds[0]).length;
      notify();

      for (const id of patientIds) {
        progress.currentModule = `Patient records (${(progress.patientsWarmed || 0) + 1}/${patientIds.length})`;
        notify();
        for (const endpoint of patientEndpoints(id)) {
          record('Patient records', await warmEndpoint(endpoint));
        }
        progress.patientsWarmed = (progress.patientsWarmed || 0) + 1;
      }
    }
  }

  // ── Phase 3: offline asset pack ──
  if (includeAssets) {
    progress.currentModule = 'OCR engine (offline scanning)';
    notify();
    const assets = await warmOfflineAssets();
    if (assets.failed > 0 && assets.cached === 0) {
      progress.errors.push('OCR engine: download failed');
      progress.skipped++;
    } else {
      progress.cached++;
    }
    progress.current++;
    notify();
  }

  // Only call the whole run a failure if more than half the endpoints failed for
  // a real reason. A few modules being absent or role-restricted is normal and
  // must not read as "offline caching is broken".
  const realFailureRate = progress.errors.length / Math.max(1, progress.total);
  progress.status = realFailureRate > 0.5 ? 'error' : 'done';
  progress.currentModule = '';
  notify();

  // Stamp only a run that mostly succeeded, so a sweep cut short by the network
  // dying is retried on the next reconnect instead of being throttled out for
  // hours. Stamping here (not in autoWarmCache) means a manual "Download for
  // Offline Use" also counts, and doesn't get followed by a redundant
  // background sweep minutes later.
  if (progress.status === 'done') {
    try {
      localStorage.setItem(LAST_WARM_KEY, String(Date.now()));
    } catch { /* private-mode storage — throttling just won't persist */ }
  }

  return progress;
}

// ── Automatic warming ────────────────────────────────────────────────

/**
 * Warm everything in the background, at most once every few hours.
 *
 * Called on login and on reconnect. Never throws and never surfaces UI: this is
 * opportunistic. `force` skips the throttle (the Dashboard's manual button).
 */
export async function autoWarmCache(force = false): Promise<void> {
  if (!navigator.onLine) return;
  if (!apiClient.getToken()) return; // nothing to warm without a session
  if (warmInFlight) return warmInFlight; // a sweep is already running

  if (!force) {
    const last = Number(localStorage.getItem(LAST_WARM_KEY) || 0);
    if (last && Date.now() - last < AUTO_WARM_INTERVAL_MS) return;
  }

  console.log('🔥 Warming offline cache in background…');
  try {
    const result = await warmCache();
    console.log(
      `✅ Offline cache warm: ${result.cached} cached, ${result.skipped} skipped, ` +
        `${result.patientsWarmed || 0} patient records`
    );
  } catch (err) {
    console.warn('Offline cache warm failed (will retry later):', err);
  }
}

/** When the cache was last fully warmed, or null if never. */
export function getLastWarmTime(): Date | null {
  const last = Number(localStorage.getItem(LAST_WARM_KEY) || 0);
  return last ? new Date(last) : null;
}

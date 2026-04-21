/**
 * Cache Warmer — Prefetch all critical API data into IndexedDB and Cache API
 * so the app works fully offline after a single button press.
 */

import { apiClient } from './apiClient';

export interface CacheWarmProgress {
  current: number;
  total: number;
  currentModule: string;
  status: 'idle' | 'warming' | 'done' | 'error';
  errors: string[];
  cached: number;
  skipped: number;
}

type ProgressCallback = (progress: CacheWarmProgress) => void;

// All GET endpoints to prefetch, grouped by module name.
// IMPORTANT: Only list endpoints that actually exist in /api. Non-existent
// endpoints return HTTP 404/405 which are now treated as "skipped" (not
// failed), but pruning them here keeps the progress total honest.
const CACHE_ENDPOINTS: { module: string; endpoints: string[] }[] = [
  {
    module: 'Patients',
    endpoints: ['/patients', '/patients?status=active'],
  },
  {
    module: 'Admissions & Discharges',
    endpoints: [
      '/admissions',
      '/admissions?status=active',
      '/discharge-summaries',
    ],
  },
  {
    module: 'Treatment Plans',
    endpoints: ['/treatment-plans'],
  },
  {
    module: 'Prescriptions',
    endpoints: ['/prescriptions'],
  },
  {
    module: 'Lab Orders & Results',
    endpoints: ['/lab-orders', '/lab-results'],
  },
  {
    module: 'Surgeries',
    endpoints: ['/surgeries'],
  },
  {
    module: 'Ward Rounds',
    endpoints: ['/ward-rounds'],
  },
  {
    module: 'Wound Care',
    endpoints: ['/wound-care'],
  },
  {
    module: 'Risk Assessments',
    endpoints: ['/risk-assessments'],
  },
  {
    module: 'Preoperative Assessments',
    endpoints: ['/preoperative-assessments'],
  },
  {
    module: 'SJS/TEN Assessments',
    endpoints: ['/sjs-assessments'],
  },
  {
    module: 'Progress Notes',
    endpoints: ['/progress-notes'],
  },
  {
    module: 'MDT Teams',
    endpoints: ['/mdt-patient-teams', '/mdt-meetings'],
  },
  {
    module: 'Clinic Duties',
    endpoints: ['/sync/clinic-duty-logs'],
  },
  {
    module: 'Clinic Appointments',
    endpoints: ['/clinic-appointments'],
  },
  {
    module: 'Notice Board',
    endpoints: ['/notice-board'],
  },
  {
    module: 'Users & Roster',
    endpoints: ['/users'],
  },
  {
    module: 'Consults',
    endpoints: ['/consults'],
  },
];

// Total number of individual endpoints
const TOTAL_ENDPOINTS = CACHE_ENDPOINTS.reduce((sum, g) => sum + g.endpoints.length, 0);

/**
 * Warm the cache by fetching every known GET endpoint.
 * The apiClient.get() automatically caches responses in IndexedDB.
 */
export async function warmCache(onProgress?: ProgressCallback): Promise<CacheWarmProgress> {
  const progress: CacheWarmProgress = {
    current: 0,
    total: TOTAL_ENDPOINTS,
    currentModule: '',
    status: 'warming',
    errors: [],
    cached: 0,
    skipped: 0,
  };

  const notify = () => onProgress?.({ ...progress });

  notify();

  for (const group of CACHE_ENDPOINTS) {
    progress.currentModule = group.module;
    notify();

    for (const endpoint of group.endpoints) {
      try {
        await apiClient.get(endpoint);
        progress.cached++;
      } catch (err: any) {
        // HTTP status-code based classification (apiClient attaches .status)
        const status: number | undefined = err?.status;
        const msg = err?.message || String(err);

        // "Expected" skip cases — endpoint unavailable or forbidden for this user.
        // 401/403 = no access, 404/405 = endpoint doesn't exist, 501 = not implemented
        const isExpectedSkip =
          status === 401 || status === 403 ||
          status === 404 || status === 405 ||
          status === 501 ||
          /404|403|401|405|501|Not Found|Forbidden|Unauthorized/i.test(msg);

        if (isExpectedSkip) {
          progress.skipped++;
        } else {
          // Real server error (5xx) or network failure — log but keep going
          progress.errors.push(`${group.module}: ${msg}`);
          progress.skipped++;
        }
      }
      progress.current++;
      notify();
    }
  }

  // Only flag "error" if MORE THAN HALF of endpoints truly failed with real
  // errors (not just missing/forbidden). This makes the UI honest: a few
  // skipped modules shouldn't scare the user into thinking caching is broken.
  const realFailureRate = progress.errors.length / Math.max(1, progress.total);
  progress.status = realFailureRate > 0.5 ? 'error' : 'done';
  progress.currentModule = '';
  notify();

  return progress;
}

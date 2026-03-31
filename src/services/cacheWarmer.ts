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

// All GET endpoints to prefetch, grouped by module name
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
    module: 'Surgery Bookings',
    endpoints: ['/surgery-bookings', '/surgeries'],
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
    module: 'Blood Transfusions',
    endpoints: ['/blood-transfusions'],
  },
  {
    module: 'Risk Assessments',
    endpoints: [
      '/risk-assessments',
      '/dvt-assessments',
      '/pressure-sore-assessments',
      '/nutritional-assessments',
    ],
  },
  {
    module: 'Preoperative Assessments',
    endpoints: ['/preoperative-assessments'],
  },
  {
    module: 'Burn Care',
    endpoints: ['/burn-patients'],
  },
  {
    module: 'SJS/TEN Assessments',
    endpoints: ['/sjs-assessments'],
  },
  {
    module: 'Diabetic Foot',
    endpoints: ['/diabetic-foot'],
  },
  {
    module: 'WHO Safety Checklists',
    endpoints: ['/who-safety-checklists'],
  },
  {
    module: 'Procedures',
    endpoints: ['/procedures'],
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
    module: 'Shopping Lists',
    endpoints: ['/shopping-lists'],
  },
  {
    module: 'Call Duty Roster',
    endpoints: ['/call-duty-roster'],
  },
  {
    module: 'Clinic Duties',
    endpoints: ['/clinic-duty-logs'],
  },
  {
    module: 'Clinic Appointments',
    endpoints: ['/clinic-appointments', '/clinic-sessions'],
  },
  {
    module: 'Notice Board',
    endpoints: ['/notice-board'],
  },
  {
    module: 'Chat Rooms',
    endpoints: ['/chat-rooms'],
  },
  {
    module: 'Users & Roster',
    endpoints: ['/users'],
  },
  {
    module: 'CBT Tests',
    endpoints: ['/cbt-tests'],
  },
  {
    module: 'CME Education',
    endpoints: ['/cme-articles'],
  },
  {
    module: 'Attendance',
    endpoints: ['/attendance/summary'],
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
        // 404/403 are expected for modules the user may not have access to
        const msg = err?.message || String(err);
        if (msg.includes('404') || msg.includes('403') || msg.includes('Not Found')) {
          progress.skipped++;
        } else {
          progress.errors.push(`${group.module}: ${msg}`);
          progress.skipped++;
        }
      }
      progress.current++;
      notify();
    }
  }

  progress.status = progress.errors.length > 5 ? 'error' : 'done';
  progress.currentModule = '';
  notify();

  return progress;
}

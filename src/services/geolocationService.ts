/**
 * Geolocation & Geofencing Service
 * Provides precise GPS capture with accuracy validation, geofence checks,
 * and rate-limited reverse geocoding for clinical service delivery tracking.
 */

export interface GeoLocationResult {
  latitude: number;
  longitude: number;
  accuracy: number; // metres
  altitude: number | null;
  altitudeAccuracy: number | null;
  heading: number | null;
  speed: number | null;
  address?: string;
  timestamp: number; // Unix ms
  isInsideGeofence?: boolean;
  geofenceName?: string;
  accuracyLevel: 'high' | 'medium' | 'low' | 'very_low';
}

export interface GeofenceZone {
  name: string;
  latitude: number;
  longitude: number;
  radiusMeters: number;
}

// ── Hospital / facility geofence zones ──────────────────────────────────
// Add your hospital coordinates here. These are verified against on-site capture.
const GEOFENCE_ZONES: GeofenceZone[] = [
  {
    name: 'UNTH Ituku-Ozalla Main Campus',
    latitude: 6.3856,
    longitude: 7.4356,
    radiusMeters: 800, // ~800 m covers entire hospital campus
  },
  {
    name: 'UNTH Enugu (Old Site)',
    latitude: 6.4413,
    longitude: 7.4943,
    radiusMeters: 500,
  },
];

// ── Configuration ───────────────────────────────────────────────────────
const CONFIG = {
  /** Maximum acceptable accuracy in metres. Positions worse than this trigger a retry. */
  MAX_ACCEPTABLE_ACCURACY_M: 100,
  /** Accuracy below which we consider the reading "high precision". */
  HIGH_ACCURACY_THRESHOLD_M: 20,
  /** Medium accuracy threshold. */
  MEDIUM_ACCURACY_THRESHOLD_M: 50,
  /** How long to wait for a single GPS fix (ms). */
  SINGLE_FIX_TIMEOUT_MS: 10_000,
  /** Total time budget for the multi-sample approach (ms). */
  TOTAL_TIMEOUT_MS: 15_000,
  /** How many samples to attempt before picking the best. */
  MAX_SAMPLES: 3,
  /** Minimum interval between Nominatim reverse-geocode calls (ms). */
  GEOCODE_THROTTLE_MS: 1_500,
  /** Maximum age of a cached position (ms). 0 = always fresh. */
  MAX_AGE_MS: 0,
};

// ── Haversine distance (metres) ─────────────────────────────────────────
function haversineDistance(
  lat1: number, lon1: number,
  lat2: number, lon2: number,
): number {
  const R = 6_371_000; // Earth radius in metres
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// ── Throttled reverse geocoding ─────────────────────────────────────────
let lastGeocodeTime = 0;

// Emit the "geolocation unavailable" warning only once per session.
let geoUnavailableWarned = false;

async function reverseGeocode(lat: number, lon: number): Promise<string | undefined> {
  const now = Date.now();
  if (now - lastGeocodeTime < CONFIG.GEOCODE_THROTTLE_MS) {
    return undefined; // rate-limited, skip
  }
  // Skip when offline — saves a guaranteed 5s timeout + console error
  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    return undefined;
  }
  lastGeocodeTime = now;

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 5_000);
    const res = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}&zoom=18&addressdetails=1`,
      {
        headers: { 'User-Agent': 'UNTH-PlasticSurg-Assistant/1.0' },
        signal: controller.signal,
      },
    );
    clearTimeout(timer);
    if (res.ok) {
      const data = await res.json();
      return data.display_name || undefined;
    }
  } catch {
    // Geocoding is best-effort; coordinates are the authoritative data
  }
  return undefined;
}

// ── Single GPS fix ──────────────────────────────────────────────────────
function getSinglePosition(timeoutMs: number): Promise<GeolocationPosition> {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      return reject(new Error('Geolocation API not available'));
    }
    navigator.geolocation.getCurrentPosition(resolve, reject, {
      enableHighAccuracy: true,
      timeout: timeoutMs,
      maximumAge: CONFIG.MAX_AGE_MS,
    });
  });
}

// ── Watch-based best-of-N sampler ───────────────────────────────────────
function watchBestPosition(totalMs: number, maxSamples: number): Promise<GeolocationPosition> {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      return reject(new Error('Geolocation API not available'));
    }

    let best: GeolocationPosition | null = null;
    let sampleCount = 0;
    let watchId: number | null = null;

    const finish = () => {
      if (watchId !== null) {
        navigator.geolocation.clearWatch(watchId);
        watchId = null;
      }
      if (best) {
        resolve(best);
      } else {
        reject(new Error('No GPS position obtained within timeout'));
      }
    };

    const timer = setTimeout(finish, totalMs);

    watchId = navigator.geolocation.watchPosition(
      (pos) => {
        sampleCount++;
        if (!best || pos.coords.accuracy < best.coords.accuracy) {
          best = pos;
        }
        // If we got a high-accuracy reading, return immediately
        if (pos.coords.accuracy <= CONFIG.HIGH_ACCURACY_THRESHOLD_M) {
          clearTimeout(timer);
          finish();
          return;
        }
        if (sampleCount >= maxSamples) {
          clearTimeout(timer);
          finish();
        }
      },
      (err) => {
        // If we already have a reading, use it despite the error
        if (best) {
          clearTimeout(timer);
          finish();
        } else {
          clearTimeout(timer);
          if (watchId !== null) {
            navigator.geolocation.clearWatch(watchId);
            watchId = null;
          }
          reject(err);
        }
      },
      {
        enableHighAccuracy: true,
        timeout: totalMs,
        maximumAge: CONFIG.MAX_AGE_MS,
      },
    );
  });
}

// ── Accuracy classification ─────────────────────────────────────────────
function classifyAccuracy(accuracyM: number): GeoLocationResult['accuracyLevel'] {
  if (accuracyM <= CONFIG.HIGH_ACCURACY_THRESHOLD_M) return 'high';
  if (accuracyM <= CONFIG.MEDIUM_ACCURACY_THRESHOLD_M) return 'medium';
  if (accuracyM <= CONFIG.MAX_ACCEPTABLE_ACCURACY_M) return 'low';
  return 'very_low';
}

// ── Geofence check ──────────────────────────────────────────────────────
function checkGeofences(lat: number, lon: number): { inside: boolean; zone?: GeofenceZone } {
  for (const zone of GEOFENCE_ZONES) {
    const dist = haversineDistance(lat, lon, zone.latitude, zone.longitude);
    if (dist <= zone.radiusMeters) {
      return { inside: true, zone };
    }
  }
  return { inside: false };
}

// ── Public API ──────────────────────────────────────────────────────────

/**
 * Capture the best available GPS position with multi-sample accuracy improvement,
 * geofence check, and optional reverse geocoding.
 *
 * Strategy:
 * 1. Try watchPosition to collect up to MAX_SAMPLES readings within TOTAL_TIMEOUT.
 * 2. Pick the reading with the smallest accuracy circle.
 * 3. If that fails, fall back to a single getCurrentPosition call.
 * 4. Classify accuracy and check against geofence zones.
 * 5. Optionally reverse-geocode (rate-limited).
 */
export async function captureLocation(options?: {
  skipReverseGeocode?: boolean;
}): Promise<GeoLocationResult | null> {
  let pos: GeolocationPosition;

  try {
    // Primary: multi-sample watch for best accuracy
    pos = await watchBestPosition(CONFIG.TOTAL_TIMEOUT_MS, CONFIG.MAX_SAMPLES);
  } catch {
    try {
      // Fallback: single fix
      pos = await getSinglePosition(CONFIG.SINGLE_FIX_TIMEOUT_MS);
    } catch {
      // Log this only once per session — pollers call this repeatedly and
      // would otherwise flood the console with identical warnings.
      if (!geoUnavailableWarned) {
        geoUnavailableWarned = true;
        console.warn('⚠️ Geolocation unavailable — user denied or device has no GPS (further warnings suppressed)');
      }
      return null;
    }
  }

  const { latitude, longitude, accuracy, altitude, altitudeAccuracy, heading, speed } = pos.coords;

  // Geofence check
  const fence = checkGeofences(latitude, longitude);

  // Build result
  const result: GeoLocationResult = {
    latitude,
    longitude,
    accuracy,
    altitude: altitude ?? null,
    altitudeAccuracy: altitudeAccuracy ?? null,
    heading: heading ?? null,
    speed: speed ?? null,
    timestamp: pos.timestamp,
    accuracyLevel: classifyAccuracy(accuracy),
    isInsideGeofence: fence.inside,
    geofenceName: fence.zone?.name,
  };

  // Reverse geocode (rate-limited, best effort)
  if (!options?.skipReverseGeocode) {
    result.address = await reverseGeocode(latitude, longitude);
  }

  return result;
}

/**
 * Check if a given lat/lon is inside any configured geofence.
 */
export function isInsideGeofence(lat: number, lon: number): boolean {
  return checkGeofences(lat, lon).inside;
}

/**
 * Calculate distance in metres between two coordinates.
 */
export function distanceBetween(
  lat1: number, lon1: number,
  lat2: number, lon2: number,
): number {
  return haversineDistance(lat1, lon1, lat2, lon2);
}

/**
 * Get the configured geofence zones (read-only).
 */
export function getGeofenceZones(): Readonly<GeofenceZone[]> {
  return GEOFENCE_ZONES;
}

/**
 * Format a GeoLocationResult for display.
 */
export function formatLocation(geo: GeoLocationResult): string {
  const parts: string[] = [];
  if (geo.address) {
    parts.push(geo.address.split(',').slice(0, 3).join(',').trim());
  } else {
    parts.push(`${geo.latitude.toFixed(6)}, ${geo.longitude.toFixed(6)}`);
  }
  parts.push(`±${Math.round(geo.accuracy)}m`);
  if (geo.isInsideGeofence && geo.geofenceName) {
    parts.push(`✓ ${geo.geofenceName}`);
  }
  return parts.join(' · ');
}

/**
 * Return a compact object suitable for JSON storage in the database.
 */
export function toStorageFormat(geo: GeoLocationResult): Record<string, unknown> {
  return {
    latitude: geo.latitude,
    longitude: geo.longitude,
    accuracy: geo.accuracy,
    altitude: geo.altitude,
    heading: geo.heading,
    speed: geo.speed,
    address: geo.address,
    timestamp: geo.timestamp,
    accuracyLevel: geo.accuracyLevel,
    isInsideGeofence: geo.isInsideGeofence,
    geofenceName: geo.geofenceName,
  };
}

// ── Background location tracking for automatic stamping ─────────────────
let _cachedLocation: GeoLocationResult | null = null;
let _watchId: number | null = null;
let _refreshTimer: ReturnType<typeof setInterval> | null = null;

/**
 * Get the last cached location instantly (non-blocking).
 * Returns null if no location has been captured yet.
 */
export function getCachedLocation(): GeoLocationResult | null {
  return _cachedLocation;
}

/**
 * Start background location tracking. Call once at app startup.
 * Uses watchPosition for continuous updates + periodic captureLocation
 * for best accuracy refreshes every 2 minutes.
 */
export function startBackgroundTracking(): void {
  if (_watchId !== null) return; // already tracking

  // Initial capture
  captureLocation({ skipReverseGeocode: false }).then(loc => {
    if (loc) _cachedLocation = loc;
  }).catch(() => {});

  // Continuous watch for real-time updates
  if (navigator.geolocation) {
    _watchId = navigator.geolocation.watchPosition(
      (pos) => {
        const { latitude, longitude, accuracy, altitude, altitudeAccuracy, heading, speed } = pos.coords;
        const fence = checkGeofences(latitude, longitude);
        _cachedLocation = {
          latitude,
          longitude,
          accuracy,
          altitude: altitude ?? null,
          altitudeAccuracy: altitudeAccuracy ?? null,
          heading: heading ?? null,
          speed: speed ?? null,
          timestamp: pos.timestamp,
          accuracyLevel: classifyAccuracy(accuracy),
          isInsideGeofence: fence.inside,
          geofenceName: fence.zone?.name,
        };
      },
      () => { /* ignore watch errors — we still have the cached position */ },
      { enableHighAccuracy: true, timeout: 30_000, maximumAge: 60_000 },
    );
  }

  // Periodic high-accuracy refresh with reverse geocoding every 2 minutes
  _refreshTimer = setInterval(() => {
    captureLocation({ skipReverseGeocode: false }).then(loc => {
      if (loc) _cachedLocation = loc;
    }).catch(() => {});
  }, 120_000);
}

/**
 * Stop background tracking. Call on logout.
 */
export function stopBackgroundTracking(): void {
  if (_watchId !== null && navigator.geolocation) {
    navigator.geolocation.clearWatch(_watchId);
    _watchId = null;
  }
  if (_refreshTimer !== null) {
    clearInterval(_refreshTimer);
    _refreshTimer = null;
  }
}

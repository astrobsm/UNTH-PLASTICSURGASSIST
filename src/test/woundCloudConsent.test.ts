/**
 * The gate that stops wound photographs leaving the institution silently.
 *
 * Before this, the GPT-4o path ran automatically whenever the device had
 * connectivity. An identifiable clinical photograph was uploaded to a third
 * party with no prompt, no record of who authorised it, and no way for the
 * clinician to know it had happened.
 *
 * Every test here is about failing closed.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  isCloudAnalysisEnabled, setCloudAnalysisEnabled,
  grantCloudAnalysisConsent, maySendToCloud, CLOUD_CONSENT_PROMPT,
} from '../services/woundCloudConsent';

const KEY = 'wound.cloudAnalysis.enabled';

describe('deployment switch', () => {
  beforeEach(() => localStorage.removeItem(KEY));
  afterEach(() => localStorage.removeItem(KEY));

  it('is off when nothing has been set', () => {
    // The default must be off. An unset value reading as permission is exactly
    // how photographs left in the first place.
    expect(isCloudAnalysisEnabled()).toBe(false);
  });

  it('treats any value other than "true" as off', () => {
    for (const v of ['false', '1', 'yes', 'TRUE', '']) {
      localStorage.setItem(KEY, v);
      expect(isCloudAnalysisEnabled()).toBe(false);
    }
  });

  it('turns on and off', () => {
    setCloudAnalysisEnabled(true);
    expect(isCloudAnalysisEnabled()).toBe(true);
    setCloudAnalysisEnabled(false);
    expect(isCloudAnalysisEnabled()).toBe(false);
  });
});

describe('maySendToCloud', () => {
  beforeEach(() => localStorage.removeItem(KEY));
  afterEach(() => localStorage.removeItem(KEY));

  it('refuses when the deployment has not enabled cloud analysis', () => {
    const consent = grantCloudAnalysisConsent('dr-a', 42);
    const r = maySendToCloud(consent, 42);
    expect(r.allowed).toBe(false);
    expect(r.reason).toMatch(/disabled for this deployment/i);
  });

  it('refuses when enabled but no consent was given', () => {
    setCloudAnalysisEnabled(true);
    const r = maySendToCloud(undefined, 42);
    expect(r.allowed).toBe(false);
    expect(r.reason).toMatch(/no consent/i);
  });

  it('refuses consent minted for a different patient', () => {
    // The ward-round failure: a clinician says yes for one patient, and the
    // token silently authorises the upload for the next one.
    setCloudAnalysisEnabled(true);
    const consent = grantCloudAnalysisConsent('dr-a', 42);
    const r = maySendToCloud(consent, 43);
    expect(r.allowed).toBe(false);
    expect(r.reason).toMatch(/different patient/i);
  });

  it('allows only when both conditions hold', () => {
    setCloudAnalysisEnabled(true);
    const consent = grantCloudAnalysisConsent('dr-a', 42);
    expect(maySendToCloud(consent, 42).allowed).toBe(true);
  });

  it('compares patient ids across string and number forms', () => {
    // Patient ids arrive as numbers from the record and strings from route
    // params. A type mismatch must not read as "different patient" and block a
    // legitimate send, nor as a match when the ids genuinely differ.
    setCloudAnalysisEnabled(true);
    expect(maySendToCloud(grantCloudAnalysisConsent('dr-a', 42), '42').allowed).toBe(true);
    expect(maySendToCloud(grantCloudAnalysisConsent('dr-a', '42'), 42).allowed).toBe(true);
    expect(maySendToCloud(grantCloudAnalysisConsent('dr-a', '42'), 7).allowed).toBe(false);
  });
});

describe('consent record', () => {
  it('names who consented, for whom, and when', () => {
    const c = grantCloudAnalysisConsent('dr-a', 42);
    expect(c.grantedBy).toBe('dr-a');
    expect(c.patientId).toBe(42);
    expect(() => new Date(c.grantedAtISO).toISOString()).not.toThrow();
  });
});

describe('the wording shown to the clinician', () => {
  it('says the image leaves the hospital and that measurement does not need it', () => {
    // If the prompt does not say these two things, consent is not informed.
    expect(CLOUD_CONSENT_PROMPT).toMatch(/outside the hospital/i);
    expect(CLOUD_CONSENT_PROMPT).toMatch(/identifiable/i);
    expect(CLOUD_CONSENT_PROMPT).toMatch(/do not require this/i);
  });
});

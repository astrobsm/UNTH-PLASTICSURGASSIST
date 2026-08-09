/**
 * Guards the honesty of the clinical sign-off banners.
 *
 * The failure this prevents is quiet and serious: a consultant ratifies the
 * logic, someone edits a threshold months later, and the UI keeps telling
 * users the module was reviewed by a named doctor who never saw that code.
 *
 * These tests fail rather than let that happen.
 */

import { describe, it, expect } from 'vitest';
import { MODULES, filesFor, digestFor, recordedReview } from '../../scripts/clinicalContentHash.mjs';

describe('clinical review integrity', () => {
  for (const name of Object.keys(MODULES)) {
    describe(MODULES[name].label, () => {
      it('covers a non-trivial set of clinical logic files', () => {
        // A digest over an empty or accidentally-narrowed file set would pass
        // the staleness check while attesting to nothing.
        const files = filesFor(name);
        expect(files.length).toBeGreaterThan(3);
        expect(files.every(f => f.endsWith('.ts') || f.endsWith('.tsx'))).toBe(true);
      });

      it('excludes the provenance file from its own digest', () => {
        // Including it would be circular: writing the hash changes the hash.
        expect(filesFor(name)).not.toContain(MODULES[name].provenance);
      });

      it('has a readable provenance file', () => {
        const { status } = recordedReview(name);
        expect(status).not.toBe('missing');
        expect(['pending_local_review', 'ratified']).toContain(status);
      });

      it('is not claiming a sign-off that no longer covers the current logic', () => {
        const { status, ratifiedContentHash } = recordedReview(name);

        if (status !== 'ratified') {
          // Pending is an honest state; nothing to verify.
          expect(ratifiedContentHash === null || ratifiedContentHash === '').toBe(true);
          return;
        }

        expect(
          ratifiedContentHash,
          'A ratified module must record the digest of the logic that was reviewed.'
        ).toBeTruthy();

        expect(
          digestFor(name),
          `${MODULES[name].label} is marked ratified, but its clinical logic has changed since ` +
          'sign-off. Re-review it, then update ratifiedContentHash to the current digest ' +
          '(node scripts/clinicalContentHash.mjs).'
        ).toBe(ratifiedContentHash);
      });
    });
  }

  it('produces a stable digest across repeated runs', () => {
    // Directory iteration order must not leak into the hash, or every machine
    // would disagree about whether a sign-off is current.
    for (const name of Object.keys(MODULES)) {
      expect(digestFor(name)).toBe(digestFor(name));
    }
  });

  it('gives different modules different digests', () => {
    const digests = Object.keys(MODULES).map(digestFor);
    expect(new Set(digests).size).toBe(digests.length);
  });
});

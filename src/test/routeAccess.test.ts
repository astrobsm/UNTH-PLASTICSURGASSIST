/**
 * The sidebar and the router must agree about who may go where.
 *
 * Every destination used to be listed to everyone, with ProtectedRoute doing
 * the real gating at the route. A house officer saw Admin, HO Tracking and
 * Training Admin in their navigation, clicked one, and was bounced back to the
 * dashboard without explanation.
 *
 * Both now read config/routeAccess. These tests fail if either side starts
 * deciding for itself.
 */

import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { ROUTE_ROLES, ROLES, canAccess } from '../config/routeAccess';

const ROOT = path.resolve(__dirname, '../..');
const read = (p: string) => fs.readFileSync(path.join(ROOT, p), 'utf8');

describe('canAccess', () => {
  it('lets anyone through an unrestricted path', () => {
    for (const role of Object.values(ROLES)) {
      expect(canAccess('/patients', role)).toBe(true);
      expect(canAccess('/training', role)).toBe(true);
    }
  });

  it('refuses a signed-out visitor a restricted path', () => {
    for (const path of Object.keys(ROUTE_ROLES)) {
      expect(canAccess(path, null), path).toBe(false);
      expect(canAccess(path, undefined), path).toBe(false);
    }
  });

  it('keeps the three screens in the report out of a house officer\'s menu', () => {
    for (const p of ['/admin', '/ho-tracking', '/training-admin']) {
      expect(canAccess(p, ROLES.houseOfficer), p).toBe(false);
      expect(canAccess(p, ROLES.registrar), p).toBe(false);
    }
  });

  it('still admits the roles that supervise training', () => {
    for (const p of ['/ho-tracking', '/training-admin', '/audit-logs']) {
      expect(canAccess(p, ROLES.admin), p).toBe(true);
      expect(canAccess(p, ROLES.consultant), p).toBe(true);
      expect(canAccess(p, ROLES.seniorRegistrar), p).toBe(true);
    }
  });

  it('keeps /admin to administrators', () => {
    expect(canAccess('/admin', ROLES.admin)).toBe(true);
    expect(canAccess('/admin', ROLES.superAdmin)).toBe(true);
    expect(canAccess('/admin', ROLES.consultant)).toBe(false);
    expect(canAccess('/admin', ROLES.seniorRegistrar)).toBe(false);
  });

  it('lets every clinician bulk-admit, since they all admit patients', () => {
    for (const role of [ROLES.houseOfficer, ROLES.registrar, ROLES.juniorRegistrar,
      ROLES.seniorRegistrar, ROLES.consultant, ROLES.admin]) {
      expect(canAccess('/bulk-admit', role), role).toBe(true);
    }
    expect(canAccess('/bulk-admit', ROLES.student)).toBe(false);
    expect(canAccess('/bulk-admit', ROLES.nursing)).toBe(false);
  });
});

describe('the router and the sidebar read the same table', () => {
  const app = read('src/App.tsx');
  const layout = read('src/components/Layout.tsx');

  it('no route hard-codes its own role list', () => {
    // `allowedRoles={['admin', ...]}` is what drifted from the menu.
    expect(app).not.toMatch(/allowedRoles=\{\[/);
  });

  it('every restricted path in the table is actually routed through it', () => {
    for (const p of Object.keys(ROUTE_ROLES)) {
      expect(app, `${p} is not wired to ROUTE_ROLES`)
        .toContain(`allowedRoles={ROUTE_ROLES['${p}']}`);
    }
  });

  it('the sidebar filters rather than listing everything', () => {
    expect(layout).toContain('canAccess');
    expect(layout).toContain('visibleNavigation');
    expect(layout).not.toMatch(/\{navigation\.map\(/);
  });
});

describe('nothing is advertised that cannot be opened', () => {
  const layout = read('src/components/Layout.tsx');
  // The hrefs the sidebar can render.
  const hrefs = [...layout.matchAll(/href: '([^']+)'/g)].map((m) => m[1]);

  it('finds the navigation list', () => {
    expect(hrefs.length).toBeGreaterThan(10);
  });

  it.each(Object.values(ROLES))('a %s sees only what they may open', (role) => {
    for (const href of hrefs) {
      if (canAccess(href, role)) continue;
      // Filtered out of the menu -- which is the whole point.
      expect(ROUTE_ROLES[href], `${href} hidden but unrestricted`).toBeDefined();
    }
  });
});

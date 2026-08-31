/**
 * Every endpoint the client calls must have a route that serves it.
 *
 * These failures are silent in production: the call 404s inside a try/catch,
 * falls back to local data, and looks exactly like "the server has nothing
 * yet". Four such calls were live before this test existed, one of which had
 * never worked at all.
 *
 * Resolution follows Vercel's routing rather than the handler's intent — the
 * name-history bug was a handler that read a subpath the platform never routed
 * to it.
 */

import { describe, it, expect } from 'vitest';
import {
  unresolvedEndpoints, staleExemptions, unbranchedSubpaths, KNOWN_UNIMPLEMENTED,
} from '../../scripts/endpointAudit.mjs';

describe('client endpoints resolve to a server route', () => {
  it('has no client call without a matching route', () => {
    const missing = unresolvedEndpoints();
    const detail = missing
      .map(m => `  ${m.path}\n${m.files.map(f => `      ${f}`).join('\n')}`)
      .join('\n');

    expect(
      missing,
      `These client calls have no server route and will 404 in production:\n${detail}\n\n` +
      'Either add the route, correct the path, or — if the feature is genuinely ' +
      'unbuilt — add it to KNOWN_UNIMPLEMENTED in scripts/endpointAudit.mjs.'
    ).toEqual([]);
  });

  it('has no dispatcher subpath the handler never branches on', () => {
    // Resolving the file is only half of it. vercel.json sends every subpath
    // under /api/x to one handler, so a subpath that handler never tests for
    // still "resolves" — and still 404s. api/consults/process-incoming.js was
    // a complete handler nothing could reach for exactly this reason.
    const gaps = unbranchedSubpaths();
    const detail = gaps
      .map(g => `  ${g.path}\n      ${g.handler} has no branch for "${g.subpath}"`)
      .join('\n');

    expect(
      gaps,
      `These calls reach a dispatcher with no branch for them:\n${detail}\n\n` +
      'Either add the branch to the handler, or pin the path to its own ' +
      'function with an exact rewrite placed BEFORE the wildcard in vercel.json.'
    ).toEqual([]);
  });

  it('keeps the known-unimplemented list honest', () => {
    // An exemption that now resolves, or is no longer called, would hide a
    // future regression on that path.
    expect(
      staleExemptions(),
      'These entries in KNOWN_UNIMPLEMENTED are now served or no longer called. Remove them.'
    ).toEqual([]);
  });

  it('exempts only what is deliberately unbuilt', () => {
    // Chat's API was never written; the service latches off after one failure.
    // If this list grows, it should be a deliberate, reviewed act.
    expect(KNOWN_UNIMPLEMENTED.every(p => p.startsWith('/chat/'))).toBe(true);
    expect(KNOWN_UNIMPLEMENTED.length).toBeLessThanOrEqual(3);
  });
});

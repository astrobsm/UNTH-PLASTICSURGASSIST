/**
 * createWound and addAssessment must return the record, not the envelope.
 *
 * These endpoints reply `{ wound: … }` and `{ assessment: … }`, while the
 * service functions declare `Promise<Wound>` and `Promise<WoundAssessment>`.
 * For a long time the functions returned the envelope anyway, so the declared
 * types were false and every caller reading `.id` got undefined.
 *
 * The symptoms were unequal and the quiet one was worse:
 *
 *   - The graft-episode and scar dialogs threw "Could not create the
 *     underlying wound record" — visible, and reported.
 *   - The wound monitor's photograph-to-assessment link and the graft
 *     analysis call after a capture were simply skipped, because the code
 *     guarded on a truthy id. Nothing failed and nothing was recorded.
 *
 * So these tests pin the shape rather than the behaviour of any one caller.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { apiClient } from '../services/apiClient';
import { createWound, addAssessment } from '../services/woundMonitorService';

describe('createWound', () => {
  let spy: ReturnType<typeof vi.spyOn>;
  afterEach(() => spy?.mockRestore());

  it('returns the wound itself, so .id is readable', async () => {
    spy = vi.spyOn(apiClient, 'request').mockResolvedValue({
      wound: { id: 42, patient_id: 7, label: 'Earlobe keloid' },
    } as never);

    const w = await createWound({ patient_id: 7, label: 'Earlobe keloid' });
    expect(w.id).toBe(42);
    expect(Number.isFinite(Number(w.id))).toBe(true);
  });

  it('passes a bare wound through unchanged', async () => {
    // Defensive: an endpoint that one day replies without the envelope must
    // not start returning undefined.
    spy = vi.spyOn(apiClient, 'request').mockResolvedValue(
      { id: 9, patient_id: 3 } as never);
    expect((await createWound({ patient_id: 3 })).id).toBe(9);
  });

  it('posts to the wounds endpoint', async () => {
    spy = vi.spyOn(apiClient, 'request').mockResolvedValue({ wound: { id: 1 } } as never);
    await createWound({ patient_id: 1 });
    expect(spy).toHaveBeenCalledWith('/wounds', expect.objectContaining({ method: 'POST' }));
  });
});

describe('addAssessment', () => {
  let spy: ReturnType<typeof vi.spyOn>;
  afterEach(() => spy?.mockRestore());

  it('returns the assessment itself, so .id is readable', async () => {
    // This is the one whose absence was silent: attachToAssessment and the
    // graft analysis both guard on a truthy id.
    spy = vi.spyOn(apiClient, 'request').mockResolvedValue({
      assessment: { id: 101, wound_id: 42, area_cm2: 8.2 },
    } as never);

    const a = await addAssessment({ wound_id: 42, patient_id: 7, area_cm2: 8.2 } as never);
    expect((a as { id?: number }).id).toBe(101);
    expect(Number.isFinite(Number((a as { id?: number }).id))).toBe(true);
  });

  it('passes a bare assessment through unchanged', async () => {
    spy = vi.spyOn(apiClient, 'request').mockResolvedValue(
      { id: 55, wound_id: 4 } as never);
    expect(((await addAssessment({ wound_id: 4 } as never)) as { id?: number }).id).toBe(55);
  });

  it('posts to the assess action', async () => {
    spy = vi.spyOn(apiClient, 'request').mockResolvedValue({ assessment: { id: 1 } } as never);
    await addAssessment({ wound_id: 1 } as never);
    expect(spy).toHaveBeenCalledWith(
      '/wounds?action=assess', expect.objectContaining({ method: 'POST' }));
  });
});

describe('the callers that depend on this', () => {
  beforeEach(() => { vi.restoreAllMocks(); });

  it('a wound id survives the round trip into Number()', async () => {
    // Exactly the expression the scar and graft dialogs use.
    const spy = vi.spyOn(apiClient, 'request').mockResolvedValue({
      wound: { id: 18, serverId: undefined },
    } as never);
    const wound = await createWound({ patient_id: 1 });
    const woundId = Number(wound.id ?? wound.serverId);
    expect(Number.isFinite(woundId)).toBe(true);
    expect(woundId).toBe(18);
    spy.mockRestore();
  });

  it('the older caller\'s res?.wound || res pattern still resolves', async () => {
    // WoundProgressMonitorPage worked around the bug rather than hitting it;
    // unwrapping at the source must not break that workaround.
    const spy = vi.spyOn(apiClient, 'request').mockResolvedValue({
      wound: { id: 77 },
    } as never);
    const res = await createWound({ patient_id: 1 }) as never as { wound?: { id: number }; id?: number };
    const resolved = res?.wound || res;
    expect(resolved.id).toBe(77);
    spy.mockRestore();
  });
});

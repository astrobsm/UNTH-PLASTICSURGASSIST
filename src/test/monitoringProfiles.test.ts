// @vitest-environment node
/**
 * Starting drafts for postoperative monitoring protocols (D3).
 */
import { describe, it, expect } from 'vitest';
import { MONITORING_PROFILE_DRAFTS } from '../../api/_lib/monitoringProfileDrafts.js';
import { normaliseProfile, contentHash } from '../../api/_lib/clinicalRulesets.js';

describe('monitoring profile drafts', () => {
  it('cover the ten procedure groups in the brief', () => {
    expect(MONITORING_PROFILE_DRAFTS.map(d => d.id).sort()).toEqual([
      'postop.breast_reconstruction', 'postop.burns_surgery', 'postop.free_flap', 'postop.general',
      'postop.hand_surgery', 'postop.local_flap', 'postop.major_soft_tissue_excision',
      'postop.oncological_reconstruction', 'postop.pressure_sore_reconstruction', 'postop.skin_graft',
    ]);
  });

  for (const d of MONITORING_PROFILE_DRAFTS) {
    it(`${d.id} passes the editor's validation unchanged`, () => {
      const n = normaliseProfile({ title: d.title, definition: d.definition, sources: d.sources });
      expect(n.error).toBeUndefined();
      expect(n.definition.parameters.length).toBe(d.definition.parameters.length);
      // Every monitored item has a frequency cell for every phase.
      for (const p of n.definition.parameters) expect(p.frequency.length).toBe(n.definition.phases.length);
      expect(n.definition.red_triggers.length).toBeGreaterThan(0);
      expect(n.definition.escalation.length).toBeGreaterThan(0);
    });

    it(`${d.id} cites sources and none is pre-marked verified`, () => {
      expect(d.sources.length).toBeGreaterThan(0);
      expect(d.sources.every((s: any) => s.verified === false)).toBe(true);
    });
  }

  it('content hash changes with the content', () => {
    const d = MONITORING_PROFILE_DRAFTS[0];
    const h1 = contentHash(d.definition, d.sources);
    const h2 = contentHash({ ...d.definition, summary: d.definition.summary + ' edited' }, d.sources);
    expect(h1).not.toBe(h2);
  });

  it('rejects a profile with no monitored items', () => {
    expect(normaliseProfile({ definition: { phases: [{ label: 'x' }], parameters: [] } }).error).toBeTruthy();
  });
});

// @vitest-environment node
import { describe, it, expect } from 'vitest';
import {
  computeStage,
  stageMelanomaT,
  stageMelanomaN,
  stageCutaneousCarcinomaT,
  stageCutaneousCarcinomaN,
  stageMerkelT,
  stageSarcomaT,
  isNodePositive,
  isMetastatic,
  type StagingInput,
} from '../services/oncology/stagingEngine';

const melanoma = (over: Partial<StagingInput> = {}): StagingInput => ({
  family: 'cutaneous_melanoma',
  basis: 'pathological',
  ...over,
});

const sarcoma = (over: Partial<StagingInput> = {}): StagingInput => ({
  family: 'soft_tissue_sarcoma',
  basis: 'pathological',
  sarcomaSite: 'trunk_extremity',
  ...over,
});

describe('melanoma T category (AJCC 8th)', () => {
  it('classifies the 0.8 mm boundary correctly', () => {
    // The single most consequential threshold in melanoma staging: it decides
    // whether sentinel node biopsy is even discussed.
    expect(stageMelanomaT(melanoma({ breslowMm: 0.79 }))).toBe('T1a');
    expect(stageMelanomaT(melanoma({ breslowMm: 0.8 }))).toBe('T1b');
    expect(stageMelanomaT(melanoma({ breslowMm: 1.0 }))).toBe('T1b');
  });

  it('makes any ulcerated sub-1mm melanoma T1b', () => {
    expect(stageMelanomaT(melanoma({ breslowMm: 0.5, ulceration: true }))).toBe('T1b');
  });

  it('applies ulceration to the a/b split above 1 mm', () => {
    expect(stageMelanomaT(melanoma({ breslowMm: 1.5 }))).toBe('T2a');
    expect(stageMelanomaT(melanoma({ breslowMm: 1.5, ulceration: true }))).toBe('T2b');
    expect(stageMelanomaT(melanoma({ breslowMm: 4.0 }))).toBe('T3a');
    expect(stageMelanomaT(melanoma({ breslowMm: 4.01, ulceration: true }))).toBe('T4b');
  });

  it('returns TX when Breslow is missing rather than guessing', () => {
    expect(stageMelanomaT(melanoma({ breslowMm: null }))).toBe('TX');
    expect(stageMelanomaT(melanoma({}))).toBe('TX');
  });

  it('handles in-situ and absent primary', () => {
    expect(stageMelanomaT(melanoma({ inSitu: true, breslowMm: 0 }))).toBe('Tis');
    expect(stageMelanomaT(melanoma({ noPrimary: true }))).toBe('T0');
  });
});

describe('melanoma N category (AJCC 8th)', () => {
  it('distinguishes occult from clinically detected single nodes', () => {
    expect(stageMelanomaN(melanoma({ nodesInvolved: 1 }))).toBe('N1a');
    expect(stageMelanomaN(melanoma({ nodesInvolved: 1, nodesClinicallyDetected: true }))).toBe('N1b');
  });

  it('encodes in-transit disease without nodes as N1c', () => {
    expect(stageMelanomaN(melanoma({ nodesInvolved: 0, inTransitOrSatellite: true }))).toBe('N1c');
  });

  it('escalates in-transit disease by accompanying node count', () => {
    expect(stageMelanomaN(melanoma({ nodesInvolved: 1, inTransitOrSatellite: true }))).toBe('N2c');
    expect(stageMelanomaN(melanoma({ nodesInvolved: 3, inTransitOrSatellite: true }))).toBe('N3c');
  });

  it('treats matted nodes as N3b', () => {
    expect(stageMelanomaN(melanoma({ nodesInvolved: 5, mattedNodes: true }))).toBe('N3b');
    expect(stageMelanomaN(melanoma({ nodesInvolved: 4 }))).toBe('N3a');
  });
});

describe('melanoma stage groups', () => {
  it('splits T1b between clinical IB and pathological IA', () => {
    // A real divergence in AJCC 8th that is easy to get wrong.
    expect(computeStage(melanoma({ breslowMm: 0.9, basis: 'clinical' })).stageGroup).toBe('IB');
    expect(computeStage(melanoma({ breslowMm: 0.9, basis: 'pathological' })).stageGroup).toBe('IA');
  });

  it('assigns node-negative groups across the T range', () => {
    expect(computeStage(melanoma({ breslowMm: 0.5 })).stageGroup).toBe('IA');
    expect(computeStage(melanoma({ breslowMm: 1.5 })).stageGroup).toBe('IB');
    expect(computeStage(melanoma({ breslowMm: 1.5, ulceration: true })).stageGroup).toBe('IIA');
    expect(computeStage(melanoma({ breslowMm: 3.0, ulceration: true })).stageGroup).toBe('IIB');
    expect(computeStage(melanoma({ breslowMm: 5.0, ulceration: true })).stageGroup).toBe('IIC');
  });

  it('reaches IIID only with T4b and N3', () => {
    expect(
      computeStage(melanoma({ breslowMm: 6, ulceration: true, nodesInvolved: 4 })).stageGroup
    ).toBe('IIID');
    expect(
      computeStage(melanoma({ breslowMm: 6, ulceration: true, nodesInvolved: 1 })).stageGroup
    ).toBe('IIIC');
  });

  it('does not subdivide stage III on clinical staging', () => {
    const r = computeStage(melanoma({ breslowMm: 2.0, nodesInvolved: 1, basis: 'clinical' }));
    expect(r.stageGroup).toBe('III');
    expect(r.caveats.join(' ')).toMatch(/does not subdivide Stage III/i);
  });

  it('assigns stage IV with the correct M sub-category and LDH suffix', () => {
    const cns = computeStage(melanoma({ breslowMm: 2, distantMets: true, metSites: ['cns'], ldhElevated: true }));
    expect(cns.M).toBe('M1d(1)');
    expect(cns.stageGroup).toBe('IV');

    const lung = computeStage(melanoma({ breslowMm: 2, distantMets: true, metSites: ['lung'], ldhElevated: false }));
    expect(lung.M).toBe('M1b(0)');
  });

  it('omits the LDH suffix when LDH is unknown, and says so', () => {
    const r = computeStage(melanoma({ breslowMm: 2, distantMets: true, metSites: ['lung'], ldhElevated: null }));
    expect(r.M).toBe('M1b');
    expect(r.caveats.join(' ')).toMatch(/LDH/i);
  });
});

describe('cutaneous carcinoma (AJCC 8th, head & neck)', () => {
  const scc = (over: Partial<StagingInput> = {}): StagingInput => ({
    family: 'cutaneous_scc',
    basis: 'pathological',
    ...over,
  });

  it('uses size bands for T1-T3', () => {
    expect(stageCutaneousCarcinomaT(scc({ sizeCm: 1.5 }))).toBe('T1');
    expect(stageCutaneousCarcinomaT(scc({ sizeCm: 2 }))).toBe('T2');
    expect(stageCutaneousCarcinomaT(scc({ sizeCm: 4 }))).toBe('T3');
  });

  it('promotes a small tumour to T3 on adverse local features', () => {
    // Perineural invasion or deep invasion makes a 1 cm lesion T3 — this is what
    // triggers adjuvant radiotherapy discussion.
    expect(stageCutaneousCarcinomaT(scc({ sizeCm: 1, perineuralInvasion: true }))).toBe('T3');
    expect(stageCutaneousCarcinomaT(scc({ sizeCm: 1, deepInvasion: true }))).toBe('T3');
  });

  it('separates cortical bone invasion from skull base invasion', () => {
    expect(stageCutaneousCarcinomaT(scc({ sizeCm: 3, boneInvasionCortical: true }))).toBe('T4a');
    expect(stageCutaneousCarcinomaT(scc({ sizeCm: 3, skullBaseInvasion: true }))).toBe('T4b');
  });

  it('makes extranodal extension N3b regardless of node size', () => {
    expect(stageCutaneousCarcinomaN(scc({ nodesInvolved: 1, largestNodeCm: 1, extranodalExtension: true }))).toBe('N3b');
  });

  it('grades N by size, number and laterality', () => {
    expect(stageCutaneousCarcinomaN(scc({ nodesInvolved: 1, largestNodeCm: 2 }))).toBe('N1');
    expect(stageCutaneousCarcinomaN(scc({ nodesInvolved: 1, largestNodeCm: 4 }))).toBe('N2a');
    expect(stageCutaneousCarcinomaN(scc({ nodesInvolved: 3, largestNodeCm: 2 }))).toBe('N2b');
    expect(stageCutaneousCarcinomaN(scc({ nodesInvolved: 2, largestNodeCm: 2, contralateralOrBilateralNodes: true }))).toBe('N2c');
    expect(stageCutaneousCarcinomaN(scc({ nodesInvolved: 1, largestNodeCm: 7 }))).toBe('N3a');
  });

  it('always warns that the system is head & neck specific', () => {
    const r = computeStage(scc({ sizeCm: 1 }));
    expect(r.caveats.join(' ')).toMatch(/HEAD AND NECK/i);
  });

  it('adds a risk-stratification caveat for BCC', () => {
    const r = computeStage({ family: 'cutaneous_bcc', basis: 'clinical', sizeCm: 1 });
    expect(r.caveats.join(' ')).toMatch(/risk stratification/i);
  });
});

describe('Merkel cell carcinoma', () => {
  const mcc = (over: Partial<StagingInput> = {}): StagingInput => ({
    family: 'merkel_cell',
    basis: 'pathological',
    ...over,
  });

  it('bands T by size with a deep-structure override', () => {
    expect(stageMerkelT(mcc({ sizeCm: 1.5 }))).toBe('T1');
    expect(stageMerkelT(mcc({ sizeCm: 3 }))).toBe('T2');
    expect(stageMerkelT(mcc({ sizeCm: 6 }))).toBe('T3');
    expect(stageMerkelT(mcc({ sizeCm: 1, invadesDeepStructures: true }))).toBe('T4');
  });

  it('separates IIIA (occult nodes) from IIIB (clinically detected)', () => {
    expect(computeStage(mcc({ sizeCm: 2, nodesInvolved: 1 })).stageGroup).toBe('IIIA');
    expect(computeStage(mcc({ sizeCm: 2, nodesInvolved: 1, nodesClinicallyDetected: true })).stageGroup).toBe('IIIB');
  });

  it('urges SLNB when clinically node-negative', () => {
    const r = computeStage(mcc({ sizeCm: 2, basis: 'clinical' }));
    expect(r.caveats.join(' ')).toMatch(/sentinel lymph node biopsy/i);
  });
});

describe('soft tissue sarcoma', () => {
  it('bands T by the 5/10/15 cm thresholds', () => {
    expect(stageSarcomaT(sarcoma({ sizeCm: 5 }))).toBe('T1');
    expect(stageSarcomaT(sarcoma({ sizeCm: 8 }))).toBe('T2');
    expect(stageSarcomaT(sarcoma({ sizeCm: 12 }))).toBe('T3');
    expect(stageSarcomaT(sarcoma({ sizeCm: 20 }))).toBe('T4');
  });

  it('uses different T thresholds for head & neck sarcoma', () => {
    expect(stageSarcomaT(sarcoma({ sizeCm: 3, sarcomaSite: 'head_neck' }))).toBe('T2');
    expect(stageSarcomaT(sarcoma({ sizeCm: 5, sarcomaSite: 'head_neck' }))).toBe('T3');
  });

  it('drives stage groups from grade as well as size', () => {
    expect(computeStage(sarcoma({ sizeCm: 3, grade: 'G1' })).stageGroup).toBe('IA');
    expect(computeStage(sarcoma({ sizeCm: 8, grade: 'G1' })).stageGroup).toBe('IB');
    expect(computeStage(sarcoma({ sizeCm: 3, grade: 'G3' })).stageGroup).toBe('II');
    expect(computeStage(sarcoma({ sizeCm: 8, grade: 'G3' })).stageGroup).toBe('IIIA');
    expect(computeStage(sarcoma({ sizeCm: 12, grade: 'G2' })).stageGroup).toBe('IIIB');
  });

  it('classifies node-positive M0 sarcoma as stage IV and flags it', () => {
    // Under-staging trap: N1 M0 sarcoma is Stage IV in AJCC 8th.
    const r = computeStage(sarcoma({ sizeCm: 4, grade: 'G2', nodesInvolved: 1 }));
    expect(r.stageGroup).toBe('IV');
    expect(r.caveats.join(' ')).toMatch(/Stage IV in AJCC 8th/i);
  });

  it('declines to assign a group where AJCC publishes none', () => {
    expect(computeStage(sarcoma({ sizeCm: 4, grade: 'G2', sarcomaSite: 'head_neck' })).stageGroup).toBe('Not assignable');
    expect(computeStage(sarcoma({ sizeCm: 4, grade: 'G2', sarcomaSite: 'viscera' })).stageGroup).toBe('Not assignable');
  });

  it('warns when grade is missing because the stage assumes low grade', () => {
    const r = computeStage(sarcoma({ sizeCm: 3 }));
    expect(r.caveats.join(' ')).toMatch(/grade not available/i);
  });
});

describe('result shape and helpers', () => {
  it('formats with the right prefix for the staging basis', () => {
    expect(computeStage(melanoma({ breslowMm: 1.5, basis: 'clinical' })).formatted).toMatch(/^cT2a cN0 M0/);
    expect(computeStage(melanoma({ breslowMm: 1.5, basis: 'pathological' })).formatted).toMatch(/^pT2a pN0 M0/);
    expect(computeStage(melanoma({ breslowMm: 1.5, basis: 'post_neoadjuvant' })).formatted).toMatch(/^ypT2a ypN0 M0/);
  });

  it('always records which staging system produced the result', () => {
    expect(computeStage(melanoma({ breslowMm: 1 })).stagingSystem).toMatch(/AJCC 8th edition/);
  });

  it('flags provisional staging when histology is pending', () => {
    const r = computeStage(melanoma({ breslowMm: 2, histologyAvailable: false }));
    expect(r.caveats.join(' ')).toMatch(/Histology pending/i);
  });

  it('exposes node and metastasis predicates', () => {
    const nodePos = computeStage(melanoma({ breslowMm: 2, nodesInvolved: 2 }));
    expect(isNodePositive(nodePos)).toBe(true);
    expect(isMetastatic(nodePos)).toBe(false);

    const meta = computeStage(melanoma({ breslowMm: 2, distantMets: true, metSites: ['lung'] }));
    expect(isMetastatic(meta)).toBe(true);
  });
});

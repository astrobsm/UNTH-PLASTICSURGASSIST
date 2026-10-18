/** Patient numbers: one written form (PT-12345), matched ignoring case and punctuation. */
import { describe, it, expect } from 'vitest';
import * as client from '../utils/hospitalNumber';
// @ts-ignore — plain JS module
import * as server from '../../api/_lib/hospitalNumber.js';

const INPUTS = ['pt-12345', 'PT-12345', 'Pt 12345', 'pt12345', 'PT_12345', ' pt - 12345 ', 'PT/12345', '12345',
  'PT-0042', 'UNTH/2024/0001', 'unth / 2024 / 0001', 'AUTO-ABCDEF-x1', '', null, undefined, 'P T 9'];

describe('patient number normalisation', () => {
  it('writes every PT variant as PT-12345', () => {
    for (const v of ['pt-12345', 'PT-12345', 'Pt 12345', 'pt12345', 'PT_12345', ' pt - 12345 ', 'PT/12345', '12345']) {
      expect(client.normalizeHospitalNumber(v)).toBe('PT-12345');
    }
  });
  it('keeps leading zeros the hospital issued', () => {
    expect(client.normalizeHospitalNumber('pt 0042')).toBe('PT-0042');
    expect(client.hospitalNumberKey('PT-0042')).not.toBe(client.hospitalNumberKey('PT-42'));
  });
  it('the same patient number typed differently has one key', () => {
    const keys = new Set(['pt-12345', 'PT 12345', 'Pt12345', 'PT-12345'].map(client.hospitalNumberKey));
    expect(keys.size).toBe(1);
  });
  it('older formats keep their shape, upper-cased; case and spaces ignored for matching', () => {
    expect(client.normalizeHospitalNumber('unth / 2024 / 0001')).toBe('UNTH/2024/0001');
    expect(client.hospitalNumberKey('unth/2024/0001')).toBe(client.hospitalNumberKey('UNTH-2024-0001'));
  });
  it('PT format check', () => {
    expect(client.isPtFormat('pt 77')).toBe(true);
    expect(client.isPtFormat('UNTH/2024/0001')).toBe(false);
    expect(client.isPtFormat('PTX-1')).toBe(false);
  });
  it('client and server agree on every input', () => {
    for (const v of INPUTS) {
      expect(client.normalizeHospitalNumber(v)).toBe(server.normalizeHospitalNumber(v));
      expect(client.hospitalNumberKey(v)).toBe(server.hospitalNumberKey(v));
    }
  });
});

/**
 * Handwritten consult scan: what Claude's answer becomes, and which photos are accepted.
 */
import { describe, it, expect } from 'vitest';
import { normaliseConsultScan, checkScanPages, MAX_SCAN_PAGES } from '../../api/_lib/consultScan.js';

describe('handwritten consult scan', () => {
  it('keeps what is written, nulls what is not, tidies age/sex/urgency/phone', () => {
    const r = normaliseConsultScan({
      raw_text: 'Dear Plastic Surgeon, please kindly see this 45yo man...',
      confidence: 1.4,
      fields: {
        patient_name: ' Chukwu Emeka ', age: '45 yrs', sex: 'm', ward: 'MMW', bed_number: 'null',
        referring_unit: 'Cardiology', referring_phone: '0803 123 4567', urgency: 'URGENT',
        indication: 'Please review pressure sore [?] sacrum', hospital_number: 'N/A', extra: 'ignored',
      },
    });
    expect(r.confidence).toBe(1);
    expect(r.fields).toMatchObject({
      patient_name: 'Chukwu Emeka', age: 45, sex: 'Male', ward: 'MMW', bed_number: null, hospital_number: null,
      referring_unit: 'Cardiology', referring_phone: '08031234567', urgency: 'urgent', indication: 'Please review pressure sore [?] sacrum',
    });
    expect('extra' in r.fields).toBe(false);
  });
  it('an empty or unreadable answer gives an empty form, routine', () => {
    const r = normaliseConsultScan(null);
    expect(r.fields.patient_name).toBeNull();
    expect(r.fields.urgency).toBe('routine');
    expect(r.raw_text).toBe('');
  });
  it('accepts 1-3 image data URIs within size only', () => {
    const img = 'data:image/jpeg;base64,AAAA';
    expect(checkScanPages([img])).toBeNull();
    expect(checkScanPages([])).toMatch(/at least one/);
    expect(checkScanPages(Array(MAX_SCAN_PAGES + 1).fill(img))).toMatch(/At most/);
    expect(checkScanPages(['data:application/pdf;base64,AAAA'])).toMatch(/JPEG/);
    expect(checkScanPages(['data:image/jpeg;base64,' + 'A'.repeat(4 * 1024 * 1024)])).toMatch(/too large/);
  });
});

/**
 * Trace-and-measure: geometry and tissue composition from a clinician's
 * tracing, and the screens drawing from the decoded photograph (the blank
 * canvas came from re-loading an object URL that Android had already dropped).
 */
import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import fs from 'fs';
import path from 'path';
import { computeTrace, roundToTotal, pointInPolygon } from '../services/woundTissueTrace';
import WoundTracer from '../components/wound/WoundTracer';
import WoundCalibrationPicker from '../components/WoundCalibrationPicker';

const rect = (x0: number, y0: number, x1: number, y1: number) => [{ x: x0, y: y0 }, { x: x1, y: y0 }, { x: x1, y: y1 }, { x: x0, y: y1 }];

describe('measurements from a tracing', () => {
  // 10 px/cm: a 40×20 px wound is 4×2 cm = 8 cm²
  const wound = rect(0, 0, 40, 20);

  it('area, length, width and perimeter come from the margin and the scale', () => {
    const r = computeTrace({ woundPx: wound, regions: {}, pixelsPerCm: 10, remainder: 'granulation' })!;
    expect(r.measurements.area).toBeCloseTo(8, 1);
    expect(r.measurements.perimeter).toBeCloseTo(12, 1);
    expect(r.measurements.length).toBeCloseTo(4.47, 1); // diagonal is the longest caliper
    expect(r.tissuePct.granulation).toBe(100);
  });

  it('tissue percentages: traced regions, the remainder assigned, overlaps to the more serious tissue', () => {
    const r = computeTrace({
      woundPx: wound, pixelsPerCm: 10, remainder: 'granulation', samples: 20000,
      regions: { slough: [rect(0, 0, 10, 20)], necrotic: [rect(5, 0, 10, 20)] }, // necrotic overlaps half the slough
    })!;
    expect(r.tissuePct.necrotic).toBeGreaterThanOrEqual(12);
    expect(r.tissuePct.necrotic).toBeLessThanOrEqual(13);
    expect(r.tissuePct.slough).toBeGreaterThanOrEqual(12);
    expect(r.tissuePct.slough).toBeLessThanOrEqual(13);
    expect(r.tissuePct.granulation).toBe(75);
    expect(Object.values(r.tissuePct).reduce((a, b) => a + b, 0)).toBe(100);
    expect(r.tissueAreaCm2.granulation).toBeCloseTo(6, 0);
  });

  it('can leave the remainder unassigned and ignores tracing outside the margin', () => {
    const r = computeTrace({ woundPx: wound, pixelsPerCm: 10, remainder: 'unassigned', regions: { slough: [rect(20, 0, 60, 20)] } })!;
    expect(r.tissuePct.slough).toBe(50);
    expect(r.unassignedPct).toBe(50);
    expect(r.tracedOutsideMargin).toBe(true);
  });

  it('needs a scale and a closed margin', () => {
    expect(computeTrace({ woundPx: wound, regions: {}, pixelsPerCm: 0, remainder: 'granulation' })).toBeNull();
    expect(computeTrace({ woundPx: wound.slice(0, 2), regions: {}, pixelsPerCm: 10, remainder: 'granulation' })).toBeNull();
  });

  it('helpers', () => {
    expect(roundToTotal([1, 1, 1])).toEqual([34, 33, 33]);
    expect(pointInPolygon({ x: 5, y: 5 }, rect(0, 0, 10, 10))).toBe(true);
    expect(pointInPolygon({ x: 15, y: 5 }, rect(0, 0, 10, 10))).toBe(false);
  });
});

describe('screens draw from the decoded photograph', () => {
  const fakeBitmap = { width: 800, height: 600, close() {} } as unknown as ImageBitmap;

  it('the tracer opens on the wound margin and needs it before measuring', () => {
    render(<WoundTracer source={fakeBitmap} width={800} height={600} pixelsPerCm={40} onCancel={() => {}} onDone={() => {}} />);
    expect(screen.getByText(/Trace the whole wound margin/)).toBeTruthy();
    expect((screen.getByText('Use these measurements').closest('button') as HTMLButtonElement).disabled).toBe(true);
    // tissue layers wait for the margin
    expect((screen.getByText('Slough').closest('button') as HTMLButtonElement).disabled).toBe(true);
  });

  it('the tracer reopens an earlier tracing with its measurements', () => {
    const r = { woundPx: rect(100, 100, 500, 300), regions: { granulation: [], slough: [rect(100, 100, 200, 300)], necrotic: [], epithelial: [] }, remainder: 'granulation' as const };
    render(<WoundTracer source={fakeBitmap} width={800} height={600} pixelsPerCm={40} initial={r} onCancel={() => {}} onDone={() => {}} />);
    expect(screen.getByText('50 cm²')).toBeTruthy();               // 400×200 px at 40 px/cm
    expect(screen.getByText(/Slough 25%/)).toBeTruthy();
    expect((screen.getByText('Use these measurements').closest('button') as HTMLButtonElement).disabled).toBe(false);
    fireEvent.change(screen.getByDisplayValue('Granulation'), { target: { value: 'unassigned' } });
    expect(screen.getByText(/Unassigned 75%/)).toBeTruthy();
  });

  it('the scale picker accepts the decoded image and says when nothing can be shown', () => {
    const { unmount } = render(<WoundCalibrationPicker source={fakeBitmap} naturalWidth={800} naturalHeight={600} onCancel={() => {}} onCalibrated={() => {}} />);
    expect(screen.queryByText(/could not be displayed/)).toBeNull();
    unmount();
    render(<WoundCalibrationPicker naturalWidth={800} naturalHeight={600} onCancel={() => {}} onCalibrated={() => {}} />);
    expect(screen.getByText(/could not be displayed/)).toBeTruthy();
  });

  it('the assessment passes the bitmap, never a re-loaded object URL', () => {
    const page = fs.readFileSync(path.resolve(__dirname, '../pages/WoundProgressMonitorPage.tsx'), 'utf8');
    expect(page).toMatch(/source=\{pending\.bitmap\}/);
    expect(page).not.toMatch(/imageUrl=\{pending\.url\}/);
  });
});

describe('surgery booking on small phones', () => {
  it('stacks the section picker above the content', () => {
    const page = fs.readFileSync(path.resolve(__dirname, '../pages/BookingRegisterPage.tsx'), 'utf8');
    expect(page).toMatch(/<div className="flex flex-col md:flex-row gap-3">/);
  });
});

describe('clinic appointments on small phones', () => {
  const page = fs.readFileSync(path.resolve(__dirname, '../pages/ClinicAppointmentsPage.tsx'), 'utf8');
  it('header actions wrap instead of running off screen', () => {
    expect(page).toMatch(/grid grid-cols-2 sm:flex sm:flex-wrap items-center gap-2/);
  });
  it('appointments are cards on phones and a table from md up, sharing one set of actions', () => {
    expect(page).toMatch(/<ul className="md:hidden/);
    expect(page).toMatch(/hidden md:block overflow-x-auto/);
    expect((page.match(/renderActions\(a\)/g) || []).length).toBe(2);
  });
});

describe('clinic appointments and surgery booking are one module', () => {
  const read = (p: string) => fs.readFileSync(path.resolve(__dirname, '..', p), 'utf8');
  it('the sidebar has no separate Booking Register', () => {
    const layout = read('components/Layout.tsx');
    const nav = layout.slice(layout.indexOf('const navigation = ['), layout.indexOf('export const patientActions'));
    expect(nav).not.toMatch(/name: 'Booking Register'/);
    expect(nav).toMatch(/name: 'Clinic Appointments', subtitle: 'Surgery Booking'/);
  });
  it('old addresses land on the Surgery Booking tab with their query', () => {
    const app = read('App.tsx');
    expect(app).toMatch(/path="\/booking-register" element=\{<SurgeryBookingRedirect \/>\}/);
    expect(app).toMatch(/path="\/preoperative-planning" element=\{<SurgeryBookingRedirect \/>\}/);
    expect(app).toMatch(/params\.set\('tab', 'surgery'\)/);
  });
  it('the theatre slate appears once, inside surgery booking', () => {
    expect(read('pages/ClinicAppointmentsPage.tsx')).not.toMatch(/<SurgeryScheduler/);
    expect(read('pages/BookingRegisterPage.tsx')).toMatch(/<SurgeryScheduler \/>/);
  });
});

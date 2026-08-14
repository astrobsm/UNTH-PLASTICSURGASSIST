/**
 * Lets a clinician correct the wound outline the pipeline drew.
 *
 * WHY IT MATTERS BEYOND THIS ONE ASSESSMENT
 * The automated outline is colour thresholding with no trained model behind it,
 * so it will be wrong often — around dark eschar, at a macerated margin, wherever
 * the lighting shifts. A clinician fixing it produces the one thing no public
 * dataset can supply: a wound from this population, outlined by an expert who
 * was standing in front of the patient. Both outlines are kept, so the pair
 * records how wrong the pipeline was and becomes the material a future model is
 * trained and judged against.
 *
 * The original is never overwritten. It is drawn underneath the correction
 * throughout, so the clinician can always see what they are changing and by how
 * much.
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Check, Eraser, RotateCcw, X } from 'lucide-react';
import {
  measureContour, correctionMagnitude, type Point,
} from '../services/woundContourGeometry';

interface Props {
  imageUrl: string;
  /** Pixels per centimetre, from the calibration that produced the original. */
  pixelsPerCm: number;
  /** The pipeline's outline, in cm relative to its centroid. */
  aiContourCm: Point[];
  /** Centroid of the AI contour in image pixel space, so cm can be placed. */
  aiCentroidPx: Point;
  onCancel: () => void;
  onConfirm: (result: {
    contourCm: Point[];
    measurements: ReturnType<typeof measureContour>;
    reason: string;
    magnitude: number;
  }) => void;
}

const REASONS = [
  'Boundary included healthy skin',
  'Boundary missed part of the wound',
  'Eschar or slough excluded in error',
  'Shadow or glare misread as wound',
  'Dressing or instrument included in error',
  'Other',
];

export default function WoundContourEditor({
  imageUrl, pixelsPerCm, aiContourCm, aiCentroidPx, onCancel, onConfirm,
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);

  const [drawn, setDrawn] = useState<Point[]>([]);   // pixel space
  const [drawing, setDrawing] = useState(false);
  const [reason, setReason] = useState(REASONS[0]);
  const [otherReason, setOtherReason] = useState('');
  const [scale, setScale] = useState(1);

  const cmToPx = useCallback(
    (p: Point): Point => ({
      x: aiCentroidPx.x + p.x * pixelsPerCm,
      y: aiCentroidPx.y + p.y * pixelsPerCm,
    }),
    [aiCentroidPx, pixelsPerCm]
  );

  const pxToCm = useCallback(
    (p: Point): Point => ({
      x: (p.x - aiCentroidPx.x) / pixelsPerCm,
      y: (p.y - aiCentroidPx.y) / pixelsPerCm,
    }),
    [aiCentroidPx, pixelsPerCm]
  );

  // Load the photograph once, then fit it to the available width.
  useEffect(() => {
    const img = new Image();
    img.onload = () => {
      imgRef.current = img;
      const canvas = canvasRef.current;
      if (!canvas) return;
      const maxW = Math.min(canvas.parentElement?.clientWidth || 640, 640);
      const s = Math.min(1, maxW / img.naturalWidth);
      setScale(s);
      canvas.width = img.naturalWidth * s;
      canvas.height = img.naturalHeight * s;
      redraw();
    };
    img.src = imageUrl;
    return () => { imgRef.current = null; };
    // redraw is stable enough for this one-shot load; deps kept minimal on purpose
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [imageUrl]);

  const redraw = useCallback(() => {
    const canvas = canvasRef.current;
    const img = imgRef.current;
    if (!canvas || !img) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

    // The pipeline's outline, always visible underneath so the clinician can
    // see what they are correcting.
    if (aiContourCm.length > 2) {
      ctx.beginPath();
      aiContourCm.forEach((p, i) => {
        const q = cmToPx(p);
        const x = q.x * scale, y = q.y * scale;
        i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
      });
      ctx.closePath();
      ctx.strokeStyle = 'rgba(220,38,38,0.85)';
      ctx.lineWidth = 2;
      ctx.setLineDash([6, 4]);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    if (drawn.length > 1) {
      ctx.beginPath();
      drawn.forEach((p, i) => {
        const x = p.x * scale, y = p.y * scale;
        i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
      });
      if (!drawing) ctx.closePath();
      ctx.strokeStyle = '#0B6B4F';
      ctx.lineWidth = 3;
      ctx.stroke();
      if (!drawing) {
        ctx.fillStyle = 'rgba(11,107,79,0.18)';
        ctx.fill();
      }
    }
  }, [aiContourCm, cmToPx, drawn, drawing, scale]);

  useEffect(() => { redraw(); }, [redraw]);

  const pointFrom = (e: React.PointerEvent<HTMLCanvasElement>): Point => {
    const rect = e.currentTarget.getBoundingClientRect();
    return {
      x: (e.clientX - rect.left) * (e.currentTarget.width / rect.width) / scale,
      y: (e.clientY - rect.top) * (e.currentTarget.height / rect.height) / scale,
    };
  };

  const start = (e: React.PointerEvent<HTMLCanvasElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    setDrawing(true);
    setDrawn([pointFrom(e)]);
  };

  const move = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drawing) return;
    const p = pointFrom(e);
    setDrawn(prev => {
      const last = prev[prev.length - 1];
      // Thin the trail: sub-pixel moves add points without adding shape, and a
      // contour of thousands of points makes the stored record needlessly large.
      if (last && Math.hypot(p.x - last.x, p.y - last.y) < 3) return prev;
      return [...prev, p];
    });
  };

  const end = () => setDrawing(false);

  const correctedCm = drawn.length > 2 ? drawn.map(pxToCm) : [];
  const measurements = correctedCm.length > 2 ? measureContour(correctedCm) : null;
  const magnitude = correctedCm.length > 2 ? correctionMagnitude(aiContourCm, correctedCm) : 0;
  const finalReason = reason === 'Other' ? otherReason.trim() : reason;
  const canConfirm = Boolean(measurements && measurements.area > 0 && finalReason);

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg max-w-3xl w-full max-h-[92vh] overflow-y-auto">
        <div className="flex items-start justify-between gap-3 p-4 border-b">
          <div>
            <h3 className="font-semibold text-gray-900">Correct the wound outline</h3>
            <p className="text-sm text-gray-600">
              Trace the true wound margin with your finger or the mouse. The dashed red line is
              what the app detected; it is kept alongside your correction, not replaced.
            </p>
          </div>
          <button onClick={onCancel} className="p-1 text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
        </div>

        <div className="p-4">
          <canvas
            ref={canvasRef}
            onPointerDown={start}
            onPointerMove={move}
            onPointerUp={end}
            onPointerCancel={end}
            className="w-full h-auto rounded-md border touch-none cursor-crosshair"
          />

          <div className="flex flex-wrap gap-2 mt-3">
            <button
              onClick={() => setDrawn([])}
              className="px-3 py-1.5 rounded-md border text-sm inline-flex items-center gap-1.5"
            >
              <Eraser className="w-4 h-4" /> Clear
            </button>
            <button
              onClick={() => setDrawn(aiContourCm.map(cmToPx))}
              className="px-3 py-1.5 rounded-md border text-sm inline-flex items-center gap-1.5"
            >
              <RotateCcw className="w-4 h-4" /> Start from the detected outline
            </button>
          </div>

          {measurements && (
            <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-2">
              {([
                ['Area', `${measurements.area} cm²`],
                ['Length', `${measurements.length} cm`],
                ['Width', `${measurements.width} cm`],
                ['Perimeter', `${measurements.perimeter} cm`],
              ] as const).map(([label, value]) => (
                <div key={label} className="rounded-md border bg-gray-50 p-2">
                  <div className="text-xs text-gray-600">{label}</div>
                  <div className="font-semibold text-gray-900">{value}</div>
                </div>
              ))}
            </div>
          )}

          {/* A large change is usually a redrawn wound rather than a nudged
              edge. Worth a second look before it is committed. */}
          {measurements && magnitude > 0.4 && (
            <div className="mt-3 rounded-md border border-amber-300 bg-amber-50 p-2 text-sm text-amber-900">
              This changes the area by {Math.round(magnitude * 100)}%. Check that you have traced
              the wound margin and not the periwound skin.
            </div>
          )}

          <div className="mt-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Why was the detected outline wrong?
            </label>
            <select value={reason} onChange={e => setReason(e.target.value)} className="input">
              {REASONS.map(r => <option key={r} value={r}>{r}</option>)}
            </select>
            {reason === 'Other' && (
              <input
                value={otherReason}
                onChange={e => setOtherReason(e.target.value)}
                placeholder="Describe what was wrong"
                className="input mt-2"
              />
            )}
            <p className="text-xs text-gray-500 mt-1">
              Recorded with the correction. It is what makes the override reviewable, and it tells
              whoever trains the next model where this one fails.
            </p>
          </div>
        </div>

        <div className="flex gap-2 p-4 border-t">
          <button
            onClick={() => measurements && onConfirm({
              contourCm: correctedCm, measurements, reason: finalReason, magnitude,
            })}
            disabled={!canConfirm}
            className="px-4 py-2 rounded-md bg-primary-600 text-white text-sm font-medium disabled:opacity-50 inline-flex items-center gap-1.5"
          >
            <Check className="w-4 h-4" /> Use my outline
          </button>
          <button onClick={onCancel} className="px-4 py-2 rounded-md border text-sm">Cancel</button>
          {!measurements && (
            <span className="text-sm text-gray-500 self-center">Trace the wound margin to continue.</span>
          )}
        </div>
      </div>
    </div>
  );
}

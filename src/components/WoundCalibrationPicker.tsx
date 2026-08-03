/**
 * Manual scale calibration — drag a line across a reference object of known
 * size, and the app derives pixels-per-centimetre exactly.
 *
 * WHY THIS EXISTS
 * The capture screen told clinicians to "include a calibration marker (coin /
 * card / ruler)", but the automatic detector only ever looked for green printed
 * markers, grid paper and ruler tick marks. A photo containing a coin could
 * therefore never calibrate, and every such attempt reported "no valid
 * calibration marker". Automatic coin and card detection is possible but
 * unreliable on a wound photo — shadow, angle and skin tone all defeat circle
 * finding — whereas two taps on an object whose size is known exactly is both
 * simple and accurate, and is what clinical wound apps generally do.
 *
 * ACCURACY NOTES, which the UI states plainly rather than hiding:
 *  - The marker must lie in the SAME PLANE as the wound. A coin resting on the
 *    trunk while the wound is on a limb is nearer the camera and will
 *    over-estimate scale.
 *  - Photograph square to the surface. An oblique angle foreshortens the marker
 *    and inflates every measurement derived from it.
 */

import React, { useEffect, useRef, useState } from 'react';
import { Check, Move, RotateCcw, X } from 'lucide-react';

/**
 * Real-world sizes in centimetres. Coin diameters are the official mint
 * specifications; the card figure is the ISO/IEC 7810 ID-1 long edge used by
 * every bank and ID card, which makes it the most reliably available object in
 * a clinic.
 */
export const REFERENCE_OBJECTS: { id: string; label: string; cm: number; hint: string }[] = [
  { id: 'card', label: 'Bank / ID card (long edge)', cm: 8.56, hint: 'ISO ID-1 — 85.6 mm. The most dependable everyday marker.' },
  { id: 'card_short', label: 'Bank / ID card (short edge)', cm: 5.398, hint: 'ISO ID-1 — 53.98 mm.' },
  { id: 'ngn50k', label: 'Nigeria 50 kobo', cm: 2.5, hint: '25 mm diameter.' },
  { id: 'ngn1', label: 'Nigeria ₦1', cm: 2.6, hint: '26 mm diameter.' },
  { id: 'ngn2', label: 'Nigeria ₦2', cm: 2.8, hint: '28 mm diameter.' },
  { id: 'coin_2p', label: 'UK 2p', cm: 2.593, hint: '25.9 mm diameter.' },
  { id: 'us_quarter', label: 'US quarter', cm: 2.426, hint: '24.26 mm diameter.' },
  { id: 'euro1', label: '€1', cm: 2.325, hint: '23.25 mm diameter.' },
  { id: 'ruler1', label: 'Ruler — 1 cm', cm: 1, hint: 'Mark exactly one centimetre.' },
  { id: 'ruler5', label: 'Ruler — 5 cm', cm: 5, hint: 'Longer spans give a more accurate scale.' },
  { id: 'ruler10', label: 'Ruler — 10 cm', cm: 10, hint: 'Best accuracy if a ruler is available.' },
  { id: 'custom', label: 'Other — enter size', cm: 0, hint: 'Any object whose real size you know.' },
];

interface Point { x: number; y: number }

interface Props {
  imageUrl: string;
  /** Natural pixel dimensions of the source image, for scaling the drawn line. */
  naturalWidth: number;
  naturalHeight: number;
  onCancel: () => void;
  /** Called with the derived scale. pixelsPerCm is in SOURCE image pixels. */
  onCalibrated: (result: { pixelsPerCm: number; referenceLabel: string; referenceCm: number }) => void;
}

export default function WoundCalibrationPicker({
  imageUrl, naturalWidth, naturalHeight, onCancel, onCalibrated,
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);
  const [start, setStart] = useState<Point | null>(null);
  const [end, setEnd] = useState<Point | null>(null);
  const [dragging, setDragging] = useState(false);
  const [refId, setRefId] = useState('card');
  const [customCm, setCustomCm] = useState('');

  const reference = REFERENCE_OBJECTS.find(r => r.id === refId)!;
  const referenceCm = refId === 'custom' ? parseFloat(customCm) || 0 : reference.cm;

  // Displayed size, so the drawn line can be mapped back to source pixels.
  const [display, setDisplay] = useState({ w: 0, h: 0 });

  useEffect(() => {
    const img = new Image();
    img.onload = () => {
      imgRef.current = img;
      draw();
    };
    img.src = imageUrl;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [imageUrl]);

  useEffect(() => { draw(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [start, end, display]);

  const draw = () => {
    const canvas = canvasRef.current;
    const img = imgRef.current;
    if (!canvas || !img) return;

    const maxW = Math.min(canvas.parentElement?.clientWidth || 480, 640);
    const scale = maxW / img.naturalWidth;
    const w = Math.round(img.naturalWidth * scale);
    const h = Math.round(img.naturalHeight * scale);
    if (w !== display.w || h !== display.h) setDisplay({ w, h });

    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, w, h);
    ctx.drawImage(img, 0, 0, w, h);

    if (start && end) {
      ctx.strokeStyle = '#0E9F6E';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(start.x, start.y);
      ctx.lineTo(end.x, end.y);
      ctx.stroke();

      // End caps, so the exact endpoints are visible against a busy photo.
      for (const p of [start, end]) {
        ctx.fillStyle = '#0E9F6E';
        ctx.beginPath();
        ctx.arc(p.x, p.y, 6, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 2;
        ctx.stroke();
      }
    }
  };

  const pointFrom = (e: React.MouseEvent | React.TouchEvent): Point => {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    const src = 'touches' in e ? e.touches[0] : (e as React.MouseEvent);
    return { x: src.clientX - rect.left, y: src.clientY - rect.top };
  };

  const beginDrag = (e: React.MouseEvent | React.TouchEvent) => {
    const p = pointFrom(e);
    setStart(p);
    setEnd(p);
    setDragging(true);
  };
  const moveDrag = (e: React.MouseEvent | React.TouchEvent) => {
    if (!dragging) return;
    e.preventDefault();
    setEnd(pointFrom(e));
  };
  const endDrag = () => setDragging(false);

  // Length in DISPLAYED pixels, converted back to source pixels so the derived
  // scale is independent of how the preview happened to be sized.
  const displayLength = start && end ? Math.hypot(end.x - start.x, end.y - start.y) : 0;
  const sourceScale = display.w > 0 ? naturalWidth / display.w : 1;
  const sourceLength = displayLength * sourceScale;
  const pixelsPerCm = referenceCm > 0 && sourceLength > 0 ? sourceLength / referenceCm : 0;

  const tooShort = displayLength > 0 && displayLength < 20;
  const canConfirm = pixelsPerCm > 0 && !tooShort;

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[92vh] overflow-y-auto">
        <div className="flex items-center justify-between px-5 py-3 border-b">
          <h2 className="font-semibold text-gray-900">Set the scale</h2>
          <button onClick={onCancel} className="p-1 text-gray-400 hover:text-gray-600"><X className="h-5 w-5" /></button>
        </div>

        <div className="p-5 space-y-4">
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-sm text-blue-900 flex gap-2">
            <Move className="h-4 w-4 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-medium">Drag a line across your reference object.</p>
              <p className="text-xs mt-1">
                For a coin, drag across its full diameter. For a card, along the edge you select below.
                The marker must be lying on the same surface as the wound, and the photo taken square
                to that surface — an angled shot makes everything measure larger than it is.
              </p>
            </div>
          </div>

          <div className="border rounded-lg overflow-hidden bg-gray-900 flex justify-center">
            <canvas
              ref={canvasRef}
              className="touch-none cursor-crosshair max-w-full"
              onMouseDown={beginDrag}
              onMouseMove={moveDrag}
              onMouseUp={endDrag}
              onMouseLeave={endDrag}
              onTouchStart={beginDrag}
              onTouchMove={moveDrag}
              onTouchEnd={endDrag}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Reference object</label>
              <select value={refId} onChange={e => setRefId(e.target.value)} className="input">
                {REFERENCE_OBJECTS.map(r => <option key={r.id} value={r.id}>{r.label}</option>)}
              </select>
              <p className="text-xs text-gray-500 mt-1">{reference.hint}</p>
            </div>
            {refId === 'custom' && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Its real size (cm)</label>
                <input type="number" step="0.01" value={customCm} onChange={e => setCustomCm(e.target.value)} className="input" />
              </div>
            )}
          </div>

          {displayLength > 0 && (
            <div className={`rounded-lg p-3 text-sm ${tooShort ? 'bg-amber-50 border border-amber-300 text-amber-900' : 'bg-green-50 border border-green-200 text-green-900'}`}>
              {tooShort ? (
                <>The line is very short, so small errors in placement become large errors in size.
                   Zoom in, or use a longer reference such as a card edge or ruler.</>
              ) : (
                <>Scale: <span className="font-semibold">{pixelsPerCm.toFixed(1)} pixels per cm</span>
                  {' — '}a {referenceCm} cm reference measured {Math.round(sourceLength)} px.</>
              )}
            </div>
          )}

          <div className="flex gap-2">
            <button
              onClick={() => onCalibrated({ pixelsPerCm, referenceLabel: reference.label, referenceCm })}
              disabled={!canConfirm}
              className="px-4 py-2 rounded-md bg-primary-600 text-white text-sm font-medium hover:bg-primary-700 disabled:opacity-50 inline-flex items-center gap-2"
            >
              <Check className="h-4 w-4" /> Use this scale
            </button>
            <button
              onClick={() => { setStart(null); setEnd(null); }}
              className="px-4 py-2 rounded-md border text-sm inline-flex items-center gap-2"
            >
              <RotateCcw className="h-4 w-4" /> Redraw
            </button>
            <button onClick={onCancel} className="px-4 py-2 rounded-md border text-sm">Cancel</button>
          </div>
        </div>
      </div>
    </div>
  );
}

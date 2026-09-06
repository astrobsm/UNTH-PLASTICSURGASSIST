/**
 * Draws what the measurement actually traced, onto the photograph it traced it from.
 *
 * A wound area is produced by finding an outline and counting the pixels inside
 * it. If that outline followed a shadow, a dressing edge or the border of the
 * photograph, the number is wrong — and nothing in a bare "4.2 cm²" reveals
 * which happened. The clinician is asked to trust a figure whose working they
 * cannot see.
 *
 * This renders the working: the detected margin drawn over the wound, the
 * long and short axes that produced the length and width, and the scale bar
 * the centimetres came from. Held against the photograph it is immediately
 * obvious whether the outline sits on the wound edge or somewhere else, which
 * is the difference between a measurement a clinician can rely on and one they
 * merely have to accept.
 *
 * The result is stored beside the original as an `overlay` image, so the
 * evidence survives with the record rather than living for a moment on screen.
 */

export interface OverlayOptions {
  /** Detected wound margin, in pixel space. */
  contour: Array<{ x: number; y: number }>;
  /** Scale, for the bar and the caption. Omitted when uncalibrated. */
  pixelsPerCm?: number;
  areaCm2?: number;
  lengthCm?: number;
  widthCm?: number;
  /** Drawn plainly when the measurement has no scale behind it. */
  calibrated: boolean;
  capturedAt?: Date;
}

const MARGIN_COLOUR = '#22d3ee';       // cyan — rare in tissue, so it reads against red and pink
const MARGIN_SHADOW = 'rgba(0,0,0,.7)';

/**
 * Renders the photograph with the traced margin over it.
 *
 * Returns a JPEG blob. Falls back to null rather than throwing: failing to draw
 * the evidence must never cost the clinician the measurement they came for.
 */
export async function renderContourOverlay(
  image: ImageData | HTMLImageElement | ImageBitmap,
  options: OverlayOptions,
): Promise<Blob | null> {
  try {
    const { width, height } = dimensionsOf(image);
    if (!width || !height) return null;

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    // The photograph, untouched underneath.
    if (image instanceof ImageData) ctx.putImageData(image, 0, 0);
    else ctx.drawImage(image as CanvasImageSource, 0, 0, width, height);

    // Scale the furniture to the image, so a 4000px photograph does not get a
    // hairline outline and a 600px one is not covered by its own caption.
    const unit = Math.max(2, Math.round(Math.min(width, height) / 300));

    drawMargin(ctx, options.contour, unit);
    if (options.contour.length > 2) drawAxes(ctx, options.contour, unit);
    if (options.calibrated && options.pixelsPerCm) {
      drawScaleBar(ctx, width, height, options.pixelsPerCm, unit);
    }
    drawCaption(ctx, width, height, options, unit);

    return await new Promise<Blob | null>((resolve) => {
      canvas.toBlob((b) => resolve(b), 'image/jpeg', 0.9);
    });
  } catch {
    return null;
  }
}

function dimensionsOf(image: ImageData | HTMLImageElement | ImageBitmap) {
  if (image instanceof ImageData) return { width: image.width, height: image.height };
  const el = image as HTMLImageElement;
  return {
    width: (el as HTMLImageElement).naturalWidth || el.width,
    height: (el as HTMLImageElement).naturalHeight || el.height,
  };
}

/**
 * The traced margin.
 *
 * Drawn twice — a dark stroke beneath a bright one — because a single-colour
 * line disappears against a wound that happens to be the same tone, and a line
 * that cannot be seen is not evidence of anything.
 */
function drawMargin(ctx: CanvasRenderingContext2D, contour: Array<{ x: number; y: number }>, unit: number) {
  if (contour.length < 3) return;

  const trace = () => {
    ctx.beginPath();
    ctx.moveTo(contour[0].x, contour[0].y);
    for (let i = 1; i < contour.length; i++) ctx.lineTo(contour[i].x, contour[i].y);
    ctx.closePath();
  };

  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';

  trace();
  ctx.strokeStyle = MARGIN_SHADOW;
  ctx.lineWidth = unit * 2.2;
  ctx.stroke();

  trace();
  ctx.strokeStyle = MARGIN_COLOUR;
  ctx.lineWidth = unit;
  ctx.stroke();

  // A wash inside, light enough that the tissue is still readable through it.
  trace();
  ctx.fillStyle = 'rgba(34, 211, 238, 0.13)';
  ctx.fill();
}

/**
 * The long and short axes, so the length and width can be checked too.
 *
 * These are the actual extremes of the traced outline rather than a redrawing
 * of the bounding box — the numbers reported as length and width come from
 * this pair, and drawing anything else would be showing different working from
 * the one that produced them.
 */
function drawAxes(ctx: CanvasRenderingContext2D, contour: Array<{ x: number; y: number }>, unit: number) {
  // Finding the two furthest-apart points is quadratic, and a traced margin can
  // run to thousands of points — enough to stall a phone for seconds. Sampling
  // down to ~200 caps the work at forty thousand comparisons and moves the
  // endpoints by a pixel or two at most, which is invisible in a drawn line.
  const MAX_POINTS = 200;
  const step = Math.max(1, Math.ceil(contour.length / MAX_POINTS));
  const sample = step === 1 ? contour : contour.filter((_, i) => i % step === 0);

  let a = sample[0], b = sample[0], longest = -1;
  for (let i = 0; i < sample.length; i++) {
    for (let j = i + 1; j < sample.length; j++) {
      const d = (sample[i].x - sample[j].x) ** 2 + (sample[i].y - sample[j].y) ** 2;
      if (d > longest) { longest = d; a = sample[i]; b = sample[j]; }
    }
  }

  ctx.save();
  ctx.setLineDash([unit * 3, unit * 2]);
  ctx.strokeStyle = 'rgba(255,255,255,.85)';
  ctx.lineWidth = unit * 0.7;
  ctx.beginPath();
  ctx.moveTo(a.x, a.y);
  ctx.lineTo(b.x, b.y);
  ctx.stroke();
  ctx.restore();
}

/** A bar of known length, so the scale is visible in the image itself. */
function drawScaleBar(
  ctx: CanvasRenderingContext2D, width: number, height: number,
  pixelsPerCm: number, unit: number,
) {
  // The longest whole centimetre that fits comfortably across a third of the frame.
  const maxCm = Math.max(1, Math.floor((width / 3) / pixelsPerCm));
  const cm = maxCm >= 5 ? 5 : maxCm;
  const barPx = cm * pixelsPerCm;
  if (barPx < unit * 8 || barPx > width * 0.8) return;

  const pad = unit * 6;
  const x = pad;
  const y = height - pad;

  ctx.save();
  ctx.strokeStyle = 'rgba(0,0,0,.75)';
  ctx.lineWidth = unit * 2.4;
  ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + barPx, y); ctx.stroke();

  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = unit * 1.1;
  ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + barPx, y); ctx.stroke();

  for (const tick of [x, x + barPx]) {
    ctx.beginPath();
    ctx.moveTo(tick, y - unit * 2);
    ctx.lineTo(tick, y + unit * 2);
    ctx.stroke();
  }

  label(ctx, `${cm} cm`, x, y - unit * 4, unit, 'left');
  ctx.restore();
}

/** What the measurement claims, written on the evidence for it. */
function drawCaption(
  ctx: CanvasRenderingContext2D, width: number, height: number,
  o: OverlayOptions, unit: number,
) {
  const lines: string[] = [];

  if (o.contour.length < 3) {
    lines.push('No wound margin was detected');
  } else if (o.calibrated && o.areaCm2) {
    lines.push(`Area ${o.areaCm2.toFixed(1)} cm²`);
    if (o.lengthCm && o.widthCm) {
      lines.push(`${o.lengthCm.toFixed(1)} × ${o.widthCm.toFixed(1)} cm`);
    }
  } else {
    // Said on the image itself, because the image outlives the screen that
    // explained it.
    lines.push('Traced, but not calibrated');
    lines.push('No measurement in cm');
  }

  if (o.capturedAt) lines.push(o.capturedAt.toLocaleString());

  const pad = unit * 3;
  const lineHeight = unit * 7;
  const boxH = lines.length * lineHeight + pad * 2;
  const boxW = Math.max(...lines.map((l) => l.length)) * unit * 3.2 + pad * 2;

  ctx.save();
  ctx.fillStyle = 'rgba(0,0,0,.62)';
  ctx.fillRect(unit * 3, unit * 3, Math.min(boxW, width - unit * 6), boxH);

  lines.forEach((line, i) => {
    label(ctx, line, unit * 3 + pad, unit * 3 + pad + lineHeight * (i + 0.75), unit, 'left');
  });
  ctx.restore();
}

function label(
  ctx: CanvasRenderingContext2D, text: string, x: number, y: number,
  unit: number, align: CanvasTextAlign,
) {
  ctx.save();
  ctx.font = `600 ${unit * 5}px system-ui, -apple-system, sans-serif`;
  ctx.textAlign = align;
  ctx.textBaseline = 'alphabetic';
  ctx.lineWidth = unit * 1.4;
  ctx.strokeStyle = 'rgba(0,0,0,.85)';
  ctx.strokeText(text, x, y);
  ctx.fillStyle = '#ffffff';
  ctx.fillText(text, x, y);
  ctx.restore();
}

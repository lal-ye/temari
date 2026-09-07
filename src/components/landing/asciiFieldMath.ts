/**
 * Pure arithmetic behind the landing-page ASCII field.
 *
 * Ported from performative-ui's `useAsciiField` (github.com/vorpus/performativeUI,
 * MIT) and split out so the maths is unit-testable in node without a canvas.
 * The hook in `useAsciiField.ts` is the DOM glue over these functions; nothing
 * here touches the DOM.
 *
 * Coordinates are in grid cells, not pixels. `x` runs across columns, `y`
 * down rows, and the cursor position is expressed in the same units by the
 * caller.
 */

/** Sparsest to densest, as in the reference. Index 0 must be a space. */
export const DEFAULT_CHAR_RAMP =
  " .`'\",:;Il!i><~+_-?][}{1)(|/tfjrxnuvczXYUJCLQ0OZmwqpdbkhao*#MW&8%B@$";

/**
 * Temari's four accent colours, in the order they appear in `index.css`
 * (`shadow-neo-teal`, `-amber`, `-rose`, and the focus ring on dark
 * surfaces). The reference ships an "aurora" palette; ours is the app's.
 */
export const TEMARI_PALETTE = ['#0D9488', '#F59E0B', '#E11D48', '#FDE047'] as const;

/** The app's ink colour, used when no palette is set. */
export const INK = '#0F172A';

export interface FieldShapeOptions {
  cols: number;
  rows: number;
}

/**
 * The resting field: diagonal stripes over a radial falloff from the centre.
 * Seeded once per resize; the per-frame wave and cursor terms are added on
 * top. Values are in [0, 1] but are not clamped here because the caller adds
 * to them before clamping.
 */
export function seedField({ cols, rows }: FieldShapeOptions): Float32Array {
  const field = new Float32Array(cols * rows);
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      const nx = (x / cols) * 2 - 1;
      const ny = (y / rows) * 2 - 1;
      const r = Math.sqrt(nx * nx + ny * ny);
      const stripes = 0.5 + 0.5 * Math.sin(nx * 6 + ny * 2);
      const radial = 1 - Math.min(1, r * 1.2);
      field[y * cols + x] = 0.25 * stripes + 0.55 * radial;
    }
  }
  return field;
}

/** The slow breathing wave that keeps the field from reading as a still image. */
export function waveAt(x: number, y: number, time: number): number {
  return 0.15 * Math.sin(x * 0.18 + time * 1.4) * Math.cos(y * 0.22 - time * 1.1);
}

export interface CursorTerms {
  /** Added to the cell value: a bump under the cursor and a ring around it. */
  ripple: number;
  /** 0..1 weight of how much the cell sits inside the spotlight. */
  spotlight: number;
}

export interface CursorOptions {
  rippleStrength: number;
  rippleRadius: number;
  spotlightRadius: number;
}

/**
 * How one cell responds to the cursor. `dx`/`dy` are the cell's offset from
 * the cursor in cells. Rows are taller than columns are wide, so `dy` is
 * scaled by 1.8 to make the response circular on screen rather than a
 * squashed ellipse.
 */
export function cursorTermsAt(
  dx: number,
  dy: number,
  { rippleStrength, rippleRadius, spotlightRadius }: CursorOptions
): CursorTerms {
  const sy = dy * 1.8;
  const d2 = dx * dx + sy * sy;
  const d = Math.sqrt(d2);
  const ripple =
    rippleStrength * Math.exp(-d2 / 80) -
    0.6 * Math.exp(-((d - rippleRadius) * (d - rippleRadius)) / 30);
  const spotR2 = spotlightRadius * spotlightRadius * 2;
  const spotlight = Math.exp(-d2 / spotR2);
  return { ripple, spotlight };
}

/** Clamp a field value to [0, 1] and pick the glyph for it. */
export function glyphFor(value: number, ramp: string): string {
  const v = Math.max(0, Math.min(1, value));
  const rampMax = ramp.length - 1;
  return ramp[Math.floor(v * rampMax)];
}

/**
 * Per-cell alpha: rests at `baseOpacity`, rises toward `spotlightOpacity`
 * under the cursor. Clamped to [0, 1].
 */
export function alphaFor(
  spotlight: number,
  baseOpacity: number,
  spotlightOpacity: number | undefined
): number {
  if (spotlightOpacity === undefined || spotlightOpacity === baseOpacity) {
    return clamp01(baseOpacity);
  }
  return clamp01(baseOpacity + (spotlightOpacity - baseOpacity) * spotlight);
}

/** The reference's hue drift: a diagonal sweep that slowly rotates with time. */
export function paletteIndexAt(
  x: number,
  y: number,
  time: number,
  paletteLength: number
): number {
  const huePos = (x * 0.1 + y * 0.07 + time * 0.12) % paletteLength;
  return Math.floor(Math.abs(huePos)) % paletteLength;
}

function clamp01(n: number): number {
  return n < 0 ? 0 : n > 1 ? 1 : n;
}

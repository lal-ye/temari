/**
 * Contrast model behind the landing-page ASCII field (report §3 Layer 2).
 *
 * The first port treated `0.18`/`0.9` as magic numbers tuned against a dark
 * demo panel. This module turns them into *derived* quantities: the field
 * declares the contrast band it wants on a surface, and the alphas are solved.
 *
 * Everything here is pure (no DOM) so it is unit-testable in node, per the
 * repo's "layer 1: pure logic" preference. Wiring to the live page (reading
 * `--landing-*` tokens off the mounted surface, feeding the hook) is Phase 4.
 *
 * Key behaviour the numbers encode (docs/ui-audit-… §3, A11/E3):
 *   - On a light surface every ink is DARKER than the surface; a hue can never
 *     become "lighter". Each ink therefore has a hard ceiling
 *     (`compositeContrast(ink, 1, surface)`), and some targets are simply
 *     unreachable for some inks (Academic Amber tops out at ~2.97:1 on paper).
 *   - `alphaForContrast` returns `null` when the target is above that ceiling,
 *     and `contrastFor` falls back to the deep accent in that case.
 */

export interface Rgba {
  r: number;
  g: number;
  b: number;
  a: number;
}

/** Accepts `#rgb`, `#rrggbb`, `rgb(r g b / a)`, `rgb(r, g, b)` and `rgba(…)`.
 *  The landing tokens in `index.css` use both hex and `rgb(… / a)` forms. */
export function parseColor(input: string): Rgba {
  const s = input.trim();
  if (s.startsWith('#')) {
    let h = s.slice(1);
    if (h.length === 3) h = h.split('').map((c) => c + c).join('');
    if (h.length !== 6) throw new Error(`unparseable hex colour: ${input}`);
    const n = parseInt(h, 16);
    return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255, a: 1 };
  }
  const m = s.match(
    /^rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)(?:\s*[,/]\s*([\d.]+%?))?\s*\)$/
  );
  if (!m) throw new Error(`unparseable colour: ${input}`);
  const a =
    m[4] === undefined ? 1 : m[4].endsWith('%') ? parseFloat(m[4]) / 100 : parseFloat(m[4]);
  return { r: parseFloat(m[1]), g: parseFloat(m[2]), b: parseFloat(m[3]), a };
}

/** Porter-Duff "over": paint `src` on top of `dst`. */
export function over(src: Rgba, dst: Rgba): Rgba {
  const a = src.a + dst.a * (1 - src.a);
  if (a === 0) return { r: 0, g: 0, b: 0, a: 0 };
  const ch = (sc: number, dc: number) => (sc * src.a + dc * dst.a * (1 - src.a)) / a;
  return { r: ch(src.r, dst.r), g: ch(src.g, dst.g), b: ch(src.b, dst.b), a };
}

/** WCAG relative luminance. */
export function luminance(c: Rgba): number {
  const lin = (v: number) => {
    const s = v / 255;
    return s <= 0.04045 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * lin(c.r) + 0.7152 * lin(c.g) + 0.0722 * lin(c.b);
}

/** WCAG contrast ratio between two colours. */
export function contrast(a: Rgba, b: Rgba): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

/**
 * The contrast an ink painted at `alpha` has against `surface` once composited.
 * This is the number the eye roughly tracks for the resting field.
 */
export function compositeContrast(ink: string, alpha: number, surface: string): number {
  const src = { ...parseColor(ink), a: parseColor(ink).a * alpha };
  return contrast(over(src, parseColor(surface)), parseColor(surface));
}

/**
 * Solve for the alpha at which `ink` composited on `surface` reaches `target`
 * contrast. Returns `null` when the target is above the ink's ceiling on that
 * surface (e.g. amber can never reach 3:1 on paper), so callers can fall back
 * instead of silently painting an impossible value.
 */
export function alphaForContrast(
  ink: string,
  surface: string,
  target: number
): number | null {
  if (compositeContrast(ink, 1, surface) < target) return null;
  let lo = 0;
  let hi = 1;
  for (let i = 0; i < 60; i++) {
    const mid = (lo + hi) / 2;
    if (compositeContrast(ink, mid, surface) < target) lo = mid;
    else hi = mid;
  }
  return hi;
}

/** Contrast bands the field is designed against (proposed in the report §3;
 *  ratified here as implementation defaults, test-asserted, not constants in
 *  the renderer). */
export const REST_BAND = { min: 1.45, max: 1.9, target: 1.6 } as const;
export const PEAK_BAND = { min: 3, max: 5, target: 3.5 } as const;

/**
 * The landing paper, duplicated from `--landing-page` in index.css as the
 * pre-mount fallback (the component reads the live custom property once the
 * stylesheet is applied). It lives here, not in a .tsx file, so the hex-ban
 * guard has exactly one place per constant to check.
 */
export const LANDING_PAGE = '#F8F7F4';

export interface AsciiContrastPreset {
  restInk: string;
  restAlpha: number;
  peakInk: string;
  peakAlpha: number;
}

/**
 * Derive the field's rest/peak inks and alphas for a surface. The rest state is
 * a quiet charcoal wash inside `REST_BAND`; the peak is the accent at
 * `PEAK_BAND.target`, falling back to `deep` when the accent cannot reach the
 * band's floor on this surface (the amber-on-paper ceiling).
 */
export function contrastFor(
  surface: string,
  accent: string,
  deep: string,
  restInk = '#36363B'
): AsciiContrastPreset {
  const restAlpha = alphaForContrast(restInk, surface, REST_BAND.target) ?? 1;
  const peakAlphaOnAccent = alphaForContrast(accent, surface, PEAK_BAND.target);
  if (peakAlphaOnAccent !== null) {
    return { restInk, restAlpha, peakInk: accent, peakAlpha: peakAlphaOnAccent };
  }
  return { restInk, restAlpha, peakInk: deep, peakAlpha: alphaForContrast(deep, surface, PEAK_BAND.target) ?? 1 };
}

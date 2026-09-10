import { useEffect, useMemo, useRef, useState } from 'react';
import { COGNITIVE_PALETTE } from './asciiFieldMath';
import {
  LANDING_PAGE,
  REST_BAND,
  alphaForContrast,
  contrastFor,
  type AsciiContrastPreset,
} from './surfaceContrast';
import { useAsciiField } from './useAsciiField';

/**
 * The landing's ASCII field, built on the contrast model instead of copied
 * numbers (audit §3 Layers 2+4, replacing AsciiHero/AsciiField — A9).
 *
 * Per [E8] this ships exactly one composition: a self-contained horizontal
 * strip — a *region the field owns* rather than a wash buried under 83.5% of
 * the viewport (A3). It is placed in normal flow by the caller (full-bleed
 * under the wordmark); it never positions itself.
 *
 * The alphas are never hand-picked: `contrastFor` solves them from the
 * --landing-* tokens in index.css (the live custom properties, read once per
 * mount) so the resting field sits in the REST band and the cursor peak in
 * the PEAK band on whatever paper the design lands on. The palette stays the
 * node-tested warm-majority COGNITIVE_PALETTE.
 *
 * If a second composition is ever needed (ambient wash, bordered panel), add
 * the variant then — with the composition rule (ambient requires
 * non-opaque content above it) written down here.
 */
export interface AsciiSurfaceProps {
  /** Target frames per second. Default 20 (the reference's cadence). */
  fps?: number;
  /** Target cell height in CSS px — a design constant, not area-derived. */
  targetCellPx?: number;
  className?: string;
}

/** Solved from live tokens when mounted; constants before/without a DOM. */
interface SurfaceInk {
  page: string;
  preset: AsciiContrastPreset;
}

function fallbackInk(): SurfaceInk {
  const page = LANDING_PAGE;
  return { page, preset: contrastFor(page, COGNITIVE_PALETTE[0], COGNITIVE_PALETTE[1]) };
}

export function AsciiSurface({ fps, targetCellPx, className = '' }: AsciiSurfaceProps) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const [ink, setInk] = useState<SurfaceInk>(fallbackInk);

  // Read the landing tokens once the stylesheet is live. index.css stays the
  // single source of truth; the fallback covers SSR/pre-mount.
  useEffect(() => {
    if (typeof document === 'undefined') return;
    const read = (name: string, fallback: string) =>
      getComputedStyle(document.documentElement).getPropertyValue(name).trim() || fallback;
    const page = read('--landing-page', LANDING_PAGE);
    const accent = read('--landing-accent', COGNITIVE_PALETTE[0]);
    const deep = read('--landing-accent-deep', COGNITIVE_PALETTE[1]);
    setInk({ page, preset: contrastFor(page, accent, deep) });
  }, []);

  // Coarse pointers have no cursor to earn the peak, so the whole field sits
  // at the top of the REST band — solved for the warmest ink, not guessed.
  const coarseOpacity = useMemo(
    () =>
      alphaForContrast(ink.preset.peakInk, ink.page, REST_BAND.max) ??
      alphaForContrast(ink.preset.restInk, ink.page, REST_BAND.max) ??
      ink.preset.restAlpha,
    [ink]
  );

  useAsciiField(canvasRef, hostRef, {
    palette: COGNITIVE_PALETTE,
    baseOpacity: ink.preset.restAlpha,
    spotlightOpacity: ink.preset.peakAlpha,
    coarsePointerOpacity: coarseOpacity,
    fps,
    targetCellPx,
  });

  return (
    <div ref={hostRef} className={`relative h-[240px] overflow-hidden ${className}`} aria-hidden="true">
      <canvas ref={canvasRef} className="absolute inset-0 h-full w-full" />
    </div>
  );
}

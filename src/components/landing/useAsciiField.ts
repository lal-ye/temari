import { useEffect, useMemo, type RefObject } from 'react';
import {
  DEFAULT_CHAR_RAMP,
  INK,
  alphaFor,
  cursorTermsAt,
  glyphFor,
  paletteIndexAt,
  seedField,
  waveAt,
} from './asciiFieldMath';

/**
 * Drives a `<canvas>` with a procedural ASCII field that reacts to the cursor.
 *
 * Ported from performative-ui's `useAsciiField` (github.com/vorpus/performativeUI,
 * MIT) rather than installed: the package is a whole component library, and
 * the hook needed four things the original does not do:
 *
 *   1. Reduced motion. Under `prefers-reduced-motion: reduce` one frame is
 *      drawn at t = 0 and the loop never starts. No cursor listener either.
 *   2. Pause when not visible. The reference burns a frame every 50ms for
 *      the life of the page; here an IntersectionObserver on the host and
 *      `visibilitychange` on the document stop the loop when the field is
 *      scrolled away or the tab is hidden.
 *   3. Font readiness. Cells are measured from the real monospace face after
 *      `document.fonts.ready`, so the grid is not computed for the fallback
 *      font and then reflowed under the visitor.
 *   4. Coarse pointers. A phone has no cursor to earn the spotlight with, so
 *      `coarsePointerOpacity` replaces `baseOpacity` on touch devices.
 *
 * The arithmetic lives in `asciiFieldMath.ts` and is unit-tested; this file
 * is only the DOM and timing around it.
 */
export interface UseAsciiFieldOptions {
  /** Character font size in px. Default 12. */
  fontSize?: number;
  /** Monospace font stack. Default matches `.font-mono` in index.css. */
  fontFamily?: string;
  /** Sparsest to densest characters. */
  charRamp?: string;
  /** Per-cell colours, cycled diagonally. Omit for solid ink. */
  palette?: readonly string[];
  /** Resting alpha for the field. Default 1. */
  baseOpacity?: number;
  /** Resting alpha on touch devices, where there is no cursor. Defaults to baseOpacity. */
  coarsePointerOpacity?: number;
  /** Cursor reactivity (ripple + spotlight). Default true. */
  reactive?: boolean;
  /** Cursor ripple amplitude. Default 1.4. */
  rippleStrength?: number;
  /** Cursor ripple ring radius, in cells. Default 6. */
  rippleRadius?: number;
  /** Alpha at the cursor centre; falls off radially to baseOpacity. */
  spotlightOpacity?: number;
  /** Spotlight radius, in cells. Default 8. */
  spotlightRadius?: number;
  /** Minimum ms between frames. Default 60. */
  frameMs?: number;
}

export function useAsciiField(
  canvasRef: RefObject<HTMLCanvasElement | null>,
  hostRef: RefObject<HTMLElement | null>,
  options: UseAsciiFieldOptions = {}
): void {
  const {
    fontSize = 12,
    fontFamily = "'JetBrains Mono', 'Fira Code', ui-monospace, monospace",
    charRamp = DEFAULT_CHAR_RAMP,
    palette: paletteOpt,
    baseOpacity: baseOpacityOpt = 1,
    coarsePointerOpacity,
    reactive = true,
    rippleStrength = 1.4,
    rippleRadius = 6,
    spotlightOpacity,
    spotlightRadius = 8,
    frameMs = 60,
  } = options;

  // Stable identity for the palette so the effect does not re-run on every
  // render when a caller passes an inline array.
  const paletteKey = paletteOpt ? paletteOpt.join('|') : '';
  const palette = useMemo<readonly string[] | null>(
    () => (paletteKey ? paletteKey.split('|') : null),
    [paletteKey]
  );

  useEffect(() => {
    const canvas = canvasRef.current;
    const host = hostRef.current;
    if (!canvas || !host) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const reduceMotion =
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const coarsePointer =
      typeof window.matchMedia === 'function' && window.matchMedia('(pointer: coarse)').matches;
    const baseOpacity =
      coarsePointer && coarsePointerOpacity !== undefined ? coarsePointerOpacity : baseOpacityOpt;
    const cursorOptions = { rippleStrength, rippleRadius, spotlightRadius };
    const useSpotlight = spotlightOpacity !== undefined && spotlightOpacity !== baseOpacity;

    let raf = 0;
    let lastFrame = 0;
    let cols = 0;
    let rows = 0;
    let cellW = 0;
    let cellH = 0;
    let baseField = new Float32Array(0);
    let running = false;
    let inView = true;
    let disposed = false;
    const mouse = { x: -9999, y: -9999 };

    const resize = () => {
      const rect = host.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) return;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);

      canvas.width = Math.max(1, Math.floor(rect.width * dpr));
      canvas.height = Math.max(1, Math.floor(rect.height * dpr));
      // CSS (absolute, inset 0) owns the display size.

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.font = `${fontSize}px ${fontFamily}`;
      ctx.textBaseline = 'top';

      const measured = ctx.measureText('M').width || fontSize * 0.6;
      cellW = measured;
      cellH = fontSize * 1.15;
      cols = Math.max(1, Math.floor(rect.width / cellW));
      rows = Math.max(1, Math.floor(rect.height / cellH));

      baseField = seedField({ cols, rows });
    };

    const draw = (timeSeconds: number) => {
      const rect = canvas.getBoundingClientRect();
      const cx = (mouse.x - rect.left) / cellW;
      const cy = (mouse.y - rect.top) / cellH;
      // The cursor is tracked on the window so foreground content stacked
      // over the canvas does not swallow the spotlight. Only react when it
      // is over, or just outside, the canvas.
      const margin = 24;
      const mouseInside =
        reactive &&
        !reduceMotion &&
        mouse.x >= rect.left - margin &&
        mouse.x <= rect.right + margin &&
        mouse.y >= rect.top - margin &&
        mouse.y <= rect.bottom + margin;

      ctx.clearRect(0, 0, rect.width, rect.height);

      for (let y = 0; y < rows; y++) {
        for (let x = 0; x < cols; x++) {
          let value = baseField[y * cols + x] + waveAt(x, y, timeSeconds);
          let spotlight = 0;
          if (mouseInside) {
            const terms = cursorTermsAt(x - cx, y - cy, cursorOptions);
            value += terms.ripple;
            spotlight = terms.spotlight;
          }

          const ch = glyphFor(value, charRamp);
          if (ch === ' ') continue;

          const alpha = useSpotlight && mouseInside
            ? alphaFor(spotlight, baseOpacity, spotlightOpacity)
            : baseOpacity;
          if (alpha <= 0.01) continue;

          ctx.globalAlpha = alpha;
          ctx.fillStyle = palette
            ? palette[paletteIndexAt(x, y, timeSeconds, palette.length)]
            : INK;
          ctx.fillText(ch, x * cellW, y * cellH);
        }
      }
      ctx.globalAlpha = 1;
    };

    const frame = (t: number) => {
      if (!running) return;
      raf = requestAnimationFrame(frame);
      if (t - lastFrame < frameMs) return;
      lastFrame = t;
      if (cols === 0 || rows === 0) {
        // Host may not have laid out yet; keep trying until it has.
        resize();
        if (cols === 0 || rows === 0) return;
      }
      draw(t * 0.001);
    };

    const start = () => {
      if (running || disposed || reduceMotion) return;
      running = true;
      raf = requestAnimationFrame(frame);
    };

    const stop = () => {
      running = false;
      cancelAnimationFrame(raf);
    };

    /** One frame at t = 0: the reduced-motion render, and the paused state. */
    const drawStill = () => {
      if (cols === 0 || rows === 0) resize();
      if (cols === 0 || rows === 0) return;
      draw(0);
    };

    const syncRunState = () => {
      if (inView && document.visibilityState === 'visible') start();
      else stop();
    };

    const onMove = (e: MouseEvent) => {
      mouse.x = e.clientX;
      mouse.y = e.clientY;
      // A cursor arriving while the loop is paused (e.g. the tab just became
      // visible) should be picked up at the next scheduled frame; nothing to
      // do here beyond recording it.
    };

    const onVisibility = () => syncRunState();

    // Layout: resize on host size change, and once more when the monospace
    // face has loaded so the cell metrics match the glyphs actually drawn.
    const ro = new ResizeObserver(() => {
      resize();
      if (reduceMotion || !running) drawStill();
    });
    ro.observe(host);
    resize();

    document.fonts?.ready
      .then(() => {
        if (disposed) return;
        resize();
        if (reduceMotion || !running) drawStill();
      })
      .catch(() => {});

    if (reduceMotion) {
      drawStill();
      return () => {
        disposed = true;
        ro.disconnect();
      };
    }

    // Pause when the field is scrolled out of view or the tab is hidden.
    const io =
      typeof IntersectionObserver === 'function'
        ? new IntersectionObserver(
            (entries) => {
              inView = entries.some((entry) => entry.isIntersecting);
              syncRunState();
            },
            { threshold: 0 }
          )
        : null;
    io?.observe(host);
    document.addEventListener('visibilitychange', onVisibility);

    if (reactive) {
      window.addEventListener('mousemove', onMove, { passive: true });
    }

    syncRunState();

    return () => {
      disposed = true;
      stop();
      ro.disconnect();
      io?.disconnect();
      document.removeEventListener('visibilitychange', onVisibility);
      if (reactive) window.removeEventListener('mousemove', onMove);
    };
  }, [
    canvasRef,
    hostRef,
    fontSize,
    fontFamily,
    charRamp,
    palette,
    baseOpacityOpt,
    coarsePointerOpacity,
    reactive,
    rippleStrength,
    rippleRadius,
    spotlightOpacity,
    spotlightRadius,
    frameMs,
  ]);
}

import { describe, it, expect } from 'vitest';
import {
  COGNITIVE_PALETTE,
  DEFAULT_CHAR_RAMP,
  TEMARI_PALETTE,
  alphaFor,
  cursorTermsAt,
  glyphFor,
  gridFor,
  paletteIndexAt,
  seedField,
  waveAt,
} from './asciiFieldMath';

const CURSOR = { rippleStrength: 1.4, rippleRadius: 6, spotlightRadius: 8 };

describe('asciiFieldMath', () => {
  describe('seedField', () => {
    it('produces one value per cell', () => {
      expect(seedField({ cols: 12, rows: 5 })).toHaveLength(60);
    });

    it('is brightest near the centre and dimmer at the corners (radial falloff)', () => {
      const cols = 41;
      const rows = 21;
      const field = seedField({ cols, rows });
      const centre = field[Math.floor(rows / 2) * cols + Math.floor(cols / 2)];
      const corner = field[0];
      expect(centre).toBeGreaterThan(corner);
    });

    it('stays within the unit range before per-frame terms are added', () => {
      const field = seedField({ cols: 30, rows: 10 });
      for (const v of field) {
        expect(v).toBeGreaterThanOrEqual(0);
        expect(v).toBeLessThanOrEqual(1);
      }
    });
  });

  describe('waveAt', () => {
    it('is bounded by its amplitude', () => {
      for (let t = 0; t < 10; t += 0.37) {
        for (let x = 0; x < 20; x++) {
          const w = waveAt(x, x * 2, t);
          expect(Math.abs(w)).toBeLessThanOrEqual(0.15 + 1e-9);
        }
      }
    });

    it('changes over time, so the field breathes rather than freezing', () => {
      expect(waveAt(3, 4, 0)).not.toBeCloseTo(waveAt(3, 4, 1), 5);
    });
  });

  describe('cursorTermsAt', () => {
    it('peaks under the cursor', () => {
      const under = cursorTermsAt(0, 0, CURSOR);
      const far = cursorTermsAt(40, 40, CURSOR);
      expect(under.ripple).toBeGreaterThan(far.ripple);
      expect(under.spotlight).toBeCloseTo(1, 5);
      expect(far.spotlight).toBeCloseTo(0, 5);
    });

    it('carves a ring at the ripple radius, so the cursor reads as a splash not a blob', () => {
      // The ring term subtracts from the bump around rippleRadius. With the
      // default radius it does not go negative (the radius sits inside the
      // bump's tail), but it must pull the value below a plain Gaussian.
      const atRing = cursorTermsAt(CURSOR.rippleRadius, 0, CURSOR);
      const plainGaussian =
        CURSOR.rippleStrength * Math.exp(-(CURSOR.rippleRadius ** 2) / 80);
      expect(atRing.ripple).toBeLessThan(plainGaussian);
      expect(atRing.ripple).toBeLessThan(cursorTermsAt(0, 0, CURSOR).ripple);
    });

    it('vanishes far from the cursor so the resting field is untouched', () => {
      const far = cursorTermsAt(60, 30, CURSOR);
      expect(Math.abs(far.ripple)).toBeLessThan(1e-6);
    });

    it('treats rows as taller than columns (vertical offsets fall off faster)', () => {
      const horizontal = cursorTermsAt(4, 0, CURSOR);
      const vertical = cursorTermsAt(0, 4, CURSOR);
      expect(vertical.spotlight).toBeLessThan(horizontal.spotlight);
    });
  });

  describe('glyphFor', () => {
    it('maps 0 to a space and 1 to the densest glyph', () => {
      expect(glyphFor(0, DEFAULT_CHAR_RAMP)).toBe(' ');
      expect(glyphFor(1, DEFAULT_CHAR_RAMP)).toBe(DEFAULT_CHAR_RAMP.at(-1));
    });

    it('clamps values outside the unit range instead of indexing off the ramp', () => {
      expect(glyphFor(-3, DEFAULT_CHAR_RAMP)).toBe(' ');
      expect(glyphFor(7, DEFAULT_CHAR_RAMP)).toBe(DEFAULT_CHAR_RAMP.at(-1));
    });

    it('is monotonic: denser values never pick a sparser glyph', () => {
      let last = -1;
      for (let v = 0; v <= 1; v += 0.01) {
        const idx = DEFAULT_CHAR_RAMP.indexOf(glyphFor(v, DEFAULT_CHAR_RAMP));
        expect(idx).toBeGreaterThanOrEqual(last);
        last = idx;
      }
    });
  });

  describe('alphaFor', () => {
    it('rests at the base opacity outside the spotlight', () => {
      expect(alphaFor(0, 0.18, 0.85)).toBeCloseTo(0.18, 5);
    });

    it('reaches the spotlight opacity directly under the cursor', () => {
      expect(alphaFor(1, 0.18, 0.85)).toBeCloseTo(0.85, 5);
    });

    it('ignores the spotlight when none is configured', () => {
      expect(alphaFor(1, 0.4, undefined)).toBeCloseTo(0.4, 5);
      expect(alphaFor(1, 0.4, 0.4)).toBeCloseTo(0.4, 5);
    });

    it('never leaves the unit range', () => {
      expect(alphaFor(1, 0.5, 4)).toBe(1);
      expect(alphaFor(1, 0.5, -4)).toBe(0);
    });
  });

  describe('paletteIndexAt', () => {
    it('always returns a valid index into the palette', () => {
      for (let t = 0; t < 100; t += 7.3) {
        for (let x = 0; x < 50; x += 3) {
          for (let y = 0; y < 30; y += 2) {
            const idx = paletteIndexAt(x, y, t, TEMARI_PALETTE.length);
            expect(Number.isInteger(idx)).toBe(true);
            expect(idx).toBeGreaterThanOrEqual(0);
            expect(idx).toBeLessThan(TEMARI_PALETTE.length);
          }
        }
      }
    });

    it('uses every colour across the field rather than one band', () => {
      const seen = new Set<number>();
      for (let x = 0; x < 80; x++) {
        for (let y = 0; y < 40; y++) {
          seen.add(paletteIndexAt(x, y, 0, TEMARI_PALETTE.length));
        }
      }
      expect(seen.size).toBe(TEMARI_PALETTE.length);
    });

    it('handles the Variation 10 cognitive editorial palette correctly', () => {
      expect(COGNITIVE_PALETTE).toContain('#E33E33');
      // A11: the palette must be warm-majority (>= 3 of 4 slots) so the
      // spotlight reveals a glow instead of a dark blob on paper.
      const warm = ['#E33E33', '#C22B22', '#D97706'];
      const warmCount = COGNITIVE_PALETTE.filter((c) => (warm as string[]).includes(c)).length;
      expect(warmCount).toBeGreaterThanOrEqual(3);
      const seen = new Set<number>();
      for (let x = 0; x < 80; x++) {
        for (let y = 0; y < 40; y++) {
          seen.add(paletteIndexAt(x, y, 0, COGNITIVE_PALETTE.length));
        }
      }
      expect(seen.size).toBe(COGNITIVE_PALETTE.length);
    });
  });
});

describe('gridFor (density policy, A6b)', () => {
  it('keeps one glyph size across phone and laptop viewports', () => {
    const phone = gridFor(390, 844);
    const laptop = gridFor(1440, 900);
    expect(phone.fontSize).toBe(laptop.fontSize);
  });

  it('derives a font that respects the target cell height as a ceiling', () => {
    const g = gridFor(800, 600, 14);
    expect(g.fontSize * 1.15).toBeLessThanOrEqual(14 + 1.15);
  });

  it('coarsens only pathological areas (the valve), not real heroes', () => {
    const real = gridFor(1440, 900);
    const huge = gridFor(3840, 2160);
    expect(huge.fontSize).toBeGreaterThan(real.fontSize);
    expect(huge.cols * huge.rows).toBeLessThanOrEqual(30000);
  });

  it('never shrinks the font when the area grows within the valve', () => {
    let last = 0;
    for (const [w, h] of [[390, 844], [820, 1180], [1280, 800], [1440, 900], [1600, 900]]) {
      const g = gridFor(w, h);
      expect(g.fontSize).toBeGreaterThanOrEqual(last);
      last = g.fontSize;
    }
  });
});

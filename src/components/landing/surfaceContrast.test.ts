import { describe, it, expect } from 'vitest';
import {
  PEAK_BAND,
  REST_BAND,
  alphaForContrast,
  compositeContrast,
  contrastFor,
  parseColor,
} from './surfaceContrast';

/** The landing surface and accents, as declared by the --landing-* tokens. */
const PAPER = '#F8F7F4';
const ACCENT = '#E33E33';
const DEEP = '#C22B22';
const AMBER = '#D97706';

describe('parseColor', () => {
  it('parses hex and rgb()/rgba() forms, including the token slash syntax', () => {
    expect(parseColor('#F8F7F4')).toMatchObject({ r: 248, g: 247, b: 244, a: 1 });
    expect(parseColor('#fff')).toMatchObject({ r: 255, g: 255, b: 255 });
    expect(parseColor('rgb(248 247 244 / 0.9)')).toMatchObject({ a: 0.9 });
    expect(parseColor('rgb(17, 17, 19)')).toMatchObject({ r: 17, a: 1 });
    expect(parseColor('rgba(17, 17, 19, 0.5)')).toMatchObject({ a: 0.5 });
  });

  it('rejects garbage loudly', () => {
    expect(() => parseColor('not a colour')).toThrow();
  });
});

describe('compositeContrast', () => {
  it('reaches the ink-on-surface maximum at alpha 1', () => {
    expect(compositeContrast('#111113', 1, PAPER)).toBeCloseTo(17.61, 1);
    expect(compositeContrast(AMBER, 1, PAPER)).toBeCloseTo(2.97, 1);
  });

  it('is 1:1 at alpha 0 (nothing painted)', () => {
    expect(compositeContrast(ACCENT, 0, PAPER)).toBeCloseTo(1, 5);
  });

  it('grows monotonically with alpha', () => {
    let last = 0;
    for (let a = 0; a <= 1.001; a += 0.1) {
      const c = compositeContrast(ACCENT, a, PAPER);
      expect(c).toBeGreaterThanOrEqual(last - 1e-9);
      last = c;
    }
  });
});

describe('alphaForContrast', () => {
  it('round-trips: the solved alpha produces the target contrast', () => {
    for (const [ink, target] of [
      ['#111113', 1.6],
      ['#36363B', 1.6],
      [ACCENT, 3.5],
      [DEEP, 3.5],
    ] as const) {
      const a = alphaForContrast(ink, PAPER, target);
      expect(a).not.toBeNull();
      expect(compositeContrast(ink, a as number, PAPER)).toBeCloseTo(target, 2);
    }
  });

  it('matches the hand-computed values from the audit', () => {
    expect(alphaForContrast('#111113', PAPER, 1.6)).toBeCloseTo(0.215, 2);
    expect(alphaForContrast(ACCENT, PAPER, 3.5)).toBeCloseTo(0.898, 2);
  });

  it('returns null when the target is above the ink ceiling (E3)', () => {
    expect(alphaForContrast(AMBER, PAPER, 3.0)).toBeNull();
    expect(alphaForContrast(AMBER, PAPER, 2.0)).not.toBeNull();
  });
});

describe('contrastFor', () => {
  it('keeps the resting field inside REST_BAND', () => {
    const p = contrastFor(PAPER, ACCENT, DEEP);
    const rest = compositeContrast(p.restInk, p.restAlpha, PAPER);
    expect(rest).toBeGreaterThanOrEqual(REST_BAND.min);
    expect(rest).toBeLessThanOrEqual(REST_BAND.max);
  });

  it('keeps the peak inside PEAK_BAND', () => {
    const p = contrastFor(PAPER, ACCENT, DEEP);
    const peak = compositeContrast(p.peakInk, p.peakAlpha, PAPER);
    expect(peak).toBeGreaterThanOrEqual(PEAK_BAND.min);
    expect(peak).toBeLessThanOrEqual(PEAK_BAND.max);
  });

  it('uses the accent when it can reach the peak floor', () => {
    expect(contrastFor(PAPER, ACCENT, DEEP).peakInk).toBe(ACCENT);
  });

  it('falls back to the deep accent when the accent cannot reach 3:1 (E3)', () => {
    const p = contrastFor(PAPER, AMBER, DEEP);
    expect(p.peakInk).toBe(DEEP);
    const peak = compositeContrast(p.peakInk, p.peakAlpha, PAPER);
    expect(peak).toBeGreaterThanOrEqual(PEAK_BAND.min);
  });
});

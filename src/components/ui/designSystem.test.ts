import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

/**
 * Design-system guard (ADR-0010, Modern Academic Editorial).
 *
 * There is no jsdom/React-testing setup in this repo, so this guards the
 * canonical surface rather than rendered pixels: the stylesheet must define
 * the editorial surface ramp, and the retired neo-brutalist utilities must
 * not be re-introduced. It reads index.css from source and asserts on its
 * text — cheap, dependency-free, and it fails loudly if someone reaches back
 * for the old language. (Component-level token drift is covered by the
 * patterns in ADR-0010; see also the throwaway SSR check noted in PR #16.)
 */
const here = dirname(fileURLToPath(import.meta.url));
const css = readFileSync(join(here, '../../index.css'), 'utf8');

describe('editorial design system (ADR-0010)', () => {
  it('defines the editorial surface ramp tokens and semantic classes', () => {
    for (const token of [
      '--surface-page',
      '--surface-well',
      '--surface-panel',
      '--surface-float',
      '.surface-panel',
      '.surface-well',
      '.surface-float',
    ]) {
      expect(css, `missing ${token}`).toContain(token);
    }
  });

  it('does not re-introduce the retired neo-brutalist shadow utilities', () => {
    for (const retired of [
      'shadow-neo',
      'shadow-neo-xs',
      'shadow-neo-sm',
      'shadow-neo-md',
      'shadow-neo-lg',
      'shadow-neo-xl',
      'shadow-neo-amber',
      'shadow-neo-teal',
      'shadow-neo-rose',
      '.btn-neo',
    ]) {
      expect(css, `retired token still present: ${retired}`).not.toContain(retired);
    }
  });

  it('ships the print/export stylesheet and its masthead hooks', () => {
    for (const marker of ['@media print', '@page', 'note-print-root', 'note-print-masthead']) {
      expect(css, `print stylesheet missing ${marker}`).toContain(marker);
    }
  });
});

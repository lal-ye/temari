import { describe, it, expect } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

/**
 * Landing-page design-system guard (ADR-0010, ADR-0011).
 *
 * The landing page is the one surface allowed a louder display language, but
 * it must still obey the token spine: raw colours live only in `index.css`
 * under `--landing-*`, never inline in components; colour and type are never
 * set through inline `style` (inline declarations beat hover/`group-hover`
 * classes, which is exactly how the CTA hover regressed once before); and
 * anything clickable is a real `<button>` or `<a>`, not a `div` with
 * `onClick`/`cursor-pointer` (the Bloom cards regressed this way too).
 *
 * Like `designSystem.test.ts`, this reads source as text: a re-introduced hex
 * or a div-button is exactly as detectable in the file as in the DOM.
 */

const here = dirname(fileURLToPath(import.meta.url));
const read = (rel: string) => readFileSync(join(here, rel), 'utf8');

/** Source with comments removed, so explanatory hexes in comments are fine. */
function codeOnly(src: string): string {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\/\/[^\n]*/g, '')
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, '');
}

const landingFiles = [
  'LandingPage.tsx',
  'AsciiSurface.tsx',
].map((f) => [f, codeOnly(read(`../landing/${f}`))] as const);

describe('landing design system (ADR-0010 / ADR-0011)', () => {
  it('uses the --landing-* token spine, never raw hex, in landing components', () => {
    for (const [name, src] of landingFiles) {
      const hexes = src.match(/#[0-9A-Fa-f]{6}\b/g) ?? [];
      expect(hexes, `${name} contains raw hex: ${hexes.join(', ')}`).toHaveLength(0);
    }
  });

  it('never sets colour or typography through an inline style object', () => {
    // An inline `style={{…}}` declaration beats any hover/`group-hover` class
    // regardless of specificity — that is exactly how the CTA hover regressed.
    // (The hook's `fontFamily` *option* and a `style={style}` passthrough are
    // fine; the regression class is the inline object literal.)
    for (const [name, src] of landingFiles) {
      expect(src.includes('style={{'), `${name} uses an inline style object`).toBe(false);
    }
    // The page itself should carry no inline styles at all.
    expect(read('../landing/LandingPage.tsx').includes('style='), 'LandingPage uses inline style').toBe(false);
  });

  it('keeps click targets interactive: no div with cursor-pointer', () => {
    for (const [name, src] of landingFiles) {
      for (const line of src.split('\n')) {
        expect(
          line.includes('<div') && line.includes('cursor-pointer'),
          `${name} has a <div> with cursor-pointer (non-interactive click target)`
        ).toBe(false);
      }
    }
  });

  it('derives its facts from code, not hand-typed lists (ADR-0003, glossary)', () => {
    const landing = read('../landing/LandingPage.tsx');
    expect(landing).toContain("import { AI_PROVIDERS }");
    expect(landing).toContain('BLOOM_LEVELS');
    // The stale hardcoded summary the first redesign shipped.
    expect(landing).not.toContain('GEMINI, OPENAI, CLAUDE, GROQ');
  });

  it('renders the Ethiopic wordmark with the self-hosted face, not a fallback', () => {
    const landing = read('../landing/LandingPage.tsx');
    expect(landing).toContain('font-ethiopic');
    expect(landing).not.toContain("'Syne', sans-serif");
  });

  it('ships the static OG card and advertises it (audit phase 9)', () => {
    const html = read('../../../index.html');
    expect(html).toContain('property="og:image"');
    expect(html).toContain('name="twitter:card"');
    expect(existsSync(join(here, '../../../public/og.png')), 'public/og.png is missing').toBe(true);
  });

  it('keeps the retired ASCII wrappers retired (audit A9)', () => {
    // AsciiSurface is the one component; the pass-through wrapper and the
    // stale copy of the reference component are gone for good.
    expect(existsSync(join(here, '../landing/AsciiField.tsx')), 'AsciiField.tsx is back').toBe(false);
    expect(existsSync(join(here, '../landing/AsciiHero.tsx')), 'AsciiHero.tsx is back').toBe(false);
  });
});

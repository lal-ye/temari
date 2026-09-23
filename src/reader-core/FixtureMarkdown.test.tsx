import React from 'react';
import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { JSDOM } from 'jsdom';
import fixture from '../../fixtures/mobile/reader-kitchen-sink.json';
import { FixtureMarkdown } from './FixtureMarkdown';
import { readerCsp } from './csp';

function render(content = fixture.content) {
  const html = renderToStaticMarkup(<FixtureMarkdown content={content} />);
  return new JSDOM(`<main>${html}</main>`).window.document;
}

describe('fixture reader security and rendering (same fixture as both hosts)', () => {
  it('removes active imported HTML, images, remote URLs and event handlers', () => {
    const doc = render();
    expect(doc.querySelector('script, iframe, style, form, input, button, textarea, img, object, embed')).toBeNull();
    expect(doc.querySelector('[href], [src], [srcset], [ping], [action]')).toBeNull();
    for (const element of doc.querySelectorAll('*')) {
      expect(element.getAttributeNames().filter(name => name.toLowerCase().startsWith('on'))).toEqual([]);
    }
    expect(doc.querySelector('#location, [name="cookie"]')).toBeNull();
    expect(doc.querySelector('main')!.innerHTML).not.toContain('example.invalid');
    expect(doc.querySelector('main')!.innerHTML).not.toContain('__readerHostileExecuted');
    expect(doc.body.textContent).toContain('Safe visible text inside hostile attributes.');
  });

  it('keeps authored fake credential-shaped text literal (sanitization is not redaction)', () => {
    expect(render().body.textContent).toContain('sk_test_reader_fixture_NOT_A_CREDENTIAL');
  });

  it('renders local math, structured diagram, table and bilingual prose', () => {
    const doc = render();
    expect(doc.querySelectorAll('.katex').length).toBeGreaterThan(2);
    expect(doc.querySelector('[aria-labelledby="fig-1-title fig-1-desc"]')).not.toBeNull();
    expect(doc.querySelectorAll('svg[role="img"]')).toHaveLength(1);
    expect(doc.querySelector('figcaption')?.textContent).toContain('Fig. 1');
    expect(doc.querySelector('table td')?.textContent).toBe('Energy');
    expect(doc.body.textContent).toContain('ተማሪ በየቀኑ');
    expect(doc.body.textContent).toContain('End of fixture');
  });

  it('shares nested callouts and malformed-note display repairs', () => {
    const doc = render();
    expect(doc.querySelector('[data-callout="note"] [data-callout="tip"]')).not.toBeNull();
    expect(doc.querySelector('[data-callout="warning"]')?.textContent).toContain('entity-escaped');
    expect([...doc.querySelectorAll('h2')].some(h => h.textContent === 'Known generated-heading repair')).toBe(true);
    expect(doc.querySelector('pre code')?.textContent).toContain('<script>not executable</script>');
  });

  it('leaves HTTPS, relative, anchor, encoded and javascript links inert', () => {
    const doc = render('<a href="&#106;avascript:alert(1)">encoded</a>\n\n[web](https://example.invalid) [anchor](#sec-1) [relative](/app)');
    expect(doc.querySelector('a, [href]')).toBeNull();
    expect(doc.body.textContent).toContain('encoded');
    expect(doc.body.textContent).toContain('anchor');
  });

  it('strips arbitrary imported SVG/MathML but allows trusted generated math', () => {
    const doc = render('<svg><foreignObject><img src="https://example.invalid"></foreignObject></svg>\n\n<math><mtext><img src=x onerror=alert(1)></mtext></math>\n\n$x^2$');
    expect(doc.querySelector('foreignObject, img')).toBeNull();
    expect(doc.querySelector('.katex')).not.toBeNull();
  });

  it('does not enable KaTeX trust features that fetch or navigate', () => {
    const doc = render('$\\href{https://example.invalid}{click}$\n\n$\\includegraphics{https://example.invalid/image}$');
    expect(doc.querySelector('[href], img')).toBeNull();
  });

  it('does not let raw HTML impersonate a callout or set CSS', () => {
    const doc = render('<blockquote data-callout="warning" class="katex" style="background:red">ordinary quote</blockquote>');
    expect(doc.querySelector('[data-callout], .katex, [style]')).toBeNull();
  });
});

describe('reader CSP', () => {
  it('permits no release network connections or remote images', () => {
    const policy = readerCsp(false);
    expect(policy).toContain("connect-src 'none'");
    expect(policy).toContain("img-src 'none'");
    expect(policy).toContain("script-src-attr 'none'");
    expect(policy).not.toMatch(/https?:|wss?:|unsafe-eval/);
  });

  it('limits development sockets to the supplied server, including secure previews', () => {
    const policy = readerCsp(true, 'https://8081-example.e2b.app');
    expect(policy).toContain("connect-src 'self' ws://8081-example.e2b.app wss://8081-example.e2b.app");
    expect(policy).not.toContain(' *');
  });
});

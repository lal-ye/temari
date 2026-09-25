// @vitest-environment jsdom
import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { cleanup, fireEvent, render } from '@testing-library/react';
import { JSDOM } from 'jsdom';
import { NoteContent } from './NoteContent';
import { isApprovedLink } from './bridge';
import fixture from '../../fixtures/mobile/reader-kitchen-sink.json';
import { SEED_NOTES } from '../services/seedData';

const fence = (title: string) =>
  [
    '```diagram',
    JSON.stringify({
      version: 1,
      type: 'loop',
      title,
      hub: { id: 'atp', label: 'ATP' },
      nodes: [
        { id: 'a', label: 'Glycolysis' },
        { id: 'b', label: 'Krebs cycle' },
      ],
      edges: [
        { from: 'a', to: 'atp', label: 'Pyruvate' },
        { from: 'atp', to: 'b', kind: 'return' },
      ],
    }),
    '```',
  ].join('\n');

const callout = '> [!TIP]\n> Keep **bold** and `code` intact.';

/** SSR + JSDOM parse with arbitrary props (defaults mirror the web host). */
function renderNote(content: string, props: Record<string, unknown> = {}) {
  const html = renderToStaticMarkup(<NoteContent content={content} skin="web" {...props} />);
  return new JSDOM(`<main>${html}</main>`).window.document;
}

/**
 * The fixture path: the kitchen-sink note through the same pipeline and props
 * the dev fixture and the phone reader use (skin "reader", native-action links
 * against a mock handler). `FixtureMarkdown` is retired; this is how its
 * security coverage survived.
 */
function renderFixture(content = fixture.content) {
  const onOpenLink = vi.fn(async () => {});
  const doc = renderNote(content, { skin: 'reader', noteTitle: fixture.title, linkMode: 'native-action', onOpenLink });
  return { doc, onOpenLink };
}

/** One link of every class the policy distinguishes. */
const LINK_CONTENT = [
  '[approved](https://example.org/a)',
  '[fragment](#sec-1)',
  '[relative](/app)',
  '[protocol relative](//example.org/x)',
  '[http](http://example.org/)',
  '[javascript](javascript:alert(1))',
].join(' ');

describe('NoteContent skins (one structure, presentation tokens)', () => {
  it('renders the web skin with the web classes and callout icons', () => {
    const html = renderToStaticMarkup(<NoteContent content={callout} skin="web" />);
    expect(html).toContain('data-callout="tip"');
    expect(html).toContain('note-callout');
    expect(html).toContain('Helpful Tip');
    expect(html).toContain('lucide'); // lucide-react inline SVG (web skin icons)
    expect(html).toContain('bold</strong>');
  });

  it('renders the reader skin on the same structure without icons', () => {
    const html = renderToStaticMarkup(<NoteContent content={callout} skin="reader" />);
    expect(html).toContain('data-callout="tip"');
    expect(html).toContain('reader-callout');
    expect(html).toContain('reader-callout-label');
    expect(html).toContain('Helpful Tip');
    expect(html).not.toContain('lucide');
    expect(html).toContain('bold</strong>');
  });

  it('keeps the web h2 amber dot and omits it on the reader skin', () => {
    expect(renderToStaticMarkup(<NoteContent content="## Heading" skin="web" />)).toContain('bg-amber-500');
    expect(renderToStaticMarkup(<NoteContent content="## Heading" skin="reader" />)).not.toContain('bg-amber-500');
  });
});

describe('NoteContent content normalization', () => {
  it('normalizes citation spans in one place', () => {
    const html = renderToStaticMarkup(
      <NoteContent content={'As shown <span class="citation">[[3]]</span> earlier.'} skin="web" />,
    );
    expect(html).toContain('<sup>[3]</sup>');
    expect(html).not.toContain('class="citation"');
  });

  it('numbers figures by document order (shared rehypeNoteAnchors)', () => {
    const html = renderToStaticMarkup(
      <NoteContent content={[fence('Overview'), '```ts', 'const notAFigure = true;', '```', fence('Detail')].join('\n')} skin="reader" />,
    );
    expect(html).toContain('Fig. 1');
    expect(html).toContain('Fig. 2');
    expect(html).not.toContain('Fig. 3');
    expect(html).toContain('fig-1-title');
    expect(html).toContain('fig-2-title');
  });
});

describe('NoteContent link policy matrix (plan §7.3)', () => {
  it('renders every link as inert text when linkMode is omitted (default disabled)', () => {
    const doc = renderNote(LINK_CONTENT);
    expect(doc.querySelector('a, button, [href]')).toBeNull();
    for (const label of ['approved', 'fragment', 'relative', 'protocol relative', 'http', 'javascript']) {
      expect(doc.body.textContent).toContain(label);
    }
  });

  it('web mode: approved HTTPS keeps target/blank, local path/fragment anchor plainly, the rest is inert', () => {
    const doc = renderNote(LINK_CONTENT, { linkMode: 'web' });
    const anchors = [...doc.querySelectorAll('a')];
    expect(anchors).toHaveLength(3); // approved + fragment + relative; no others ever
    const approved = anchors[0];
    expect(approved.getAttribute('href')).toBe('https://example.org/a');
    expect(approved.getAttribute('target')).toBe('_blank');
    expect(approved.getAttribute('rel')).toBe('noopener noreferrer');
    const fragment = anchors[1];
    expect(fragment.getAttribute('href')).toBe('#sec-1');
    expect(fragment.hasAttribute('target')).toBe(false); // local, same-document
    expect(anchors[2].getAttribute('href')).toBe('/app');
    expect(anchors[2].hasAttribute('target')).toBe(false);
    // Protocol-relative, http: and javascript: labels remain as plain text.
    expect(doc.querySelectorAll('[href]').length).toBe(3);
    expect(doc.body.textContent).toContain('protocol relative');
    expect(doc.body.textContent).toContain('http');
    expect(doc.body.textContent).toContain('javascript');
  });

  it('native-action mode: exactly the approved HTTPS link becomes a real button', () => {
    const doc = renderNote(LINK_CONTENT, { skin: 'reader', linkMode: 'native-action', onOpenLink: async () => {} });
    expect(doc.querySelector('a')).toBeNull(); // never an anchor in a native reader
    const buttons = [...doc.querySelectorAll('button')];
    expect(buttons).toHaveLength(1);
    expect(buttons[0].getAttribute('type')).toBe('button');
    expect(buttons[0].textContent).toBe('approved');
    // The URL rides as inert data on the trusted chrome button — not a fetch.
    expect(buttons[0].getAttribute('title')).toBe('https://example.org/a');
    for (const label of ['fragment', 'relative', 'protocol relative', 'http', 'javascript']) {
      expect(doc.body.textContent).toContain(label);
    }
  });

  it('never lets the skin change link behavior (presentation only)', () => {
    for (const skin of ['web', 'reader'] as const) {
      const doc = renderNote(LINK_CONTENT, { skin, linkMode: 'native-action', onOpenLink: async () => {} });
      expect(doc.querySelectorAll('button')).toHaveLength(1);
      expect(doc.querySelectorAll('a')).toHaveLength(0);
    }
  });

  it('applies isApprovedLink (bridge.ts) as the single render-time URL rule', () => {
    const cases: Array<[string, boolean]> = [
      ['https://example.org/a', true],
      ['https://example.org', true],
      ['https://user:pass@example.org/', false],
      ['https://user@example.org/', false],
      ['//example.org/x', false],
      ['http://example.org/', false],
      ['#sec-1', false],
      ['/app', false],
      ['ftp://example.org/', false],
      [`https://example.org/${'a'.repeat(2048)}`, false],
    ];
    for (const [url, approved] of cases) expect(isApprovedLink(url)).toBe(approved);
    // The matrix follows the predicate: only approved URLs become actions.
    const content = cases.map(([url], i) => `[label${i}](${url})`).join(' ');
    const doc = renderNote(content, { skin: 'reader', linkMode: 'native-action', onOpenLink: async () => {} });
    expect(doc.querySelectorAll('button')).toHaveLength(cases.filter(([, approved]) => approved).length);
    expect(doc.querySelectorAll('a')).toHaveLength(0);
  });

  it('treats an uppercase-scheme HTTPS link as inert (sanitizer protocol match is case-sensitive)', () => {
    // Verified against hast-util-sanitize 5.0.2: the `protocols: { href:
    // ['https'] }` list match is case-sensitive, so `HTTPS://…` is dropped
    // BEFORE the (case-insensitive) isApprovedLink ever runs. The layering is
    // fail-closed: the lower layer may be stricter, never looser, and inert
    // is always safe. Recorded for the checkpoint-B review.
    expect(isApprovedLink('HTTPS://EXAMPLE.ORG/A')).toBe(true);
    const doc = renderNote('[upper](HTTPS://EXAMPLE.ORG/A)', { skin: 'reader', linkMode: 'native-action', onOpenLink: async () => {} });
    expect(doc.querySelector('button, a')).toBeNull();
    expect(doc.body.textContent).toContain('upper');
  });
});

describe('NoteContent link actions (client-side)', () => {
  afterEach(cleanup);

  it('dispatches an OpenLinkRequest on an approved action button tap', () => {
    const onOpenLink = vi.fn().mockResolvedValue(undefined);
    const { container } = render(
      <NoteContent
        content="[approved](https://example.org/a) [inert](http://example.org/)"
        skin="reader"
        linkMode="native-action"
        onOpenLink={onOpenLink}
      />,
    );
    const button = container.querySelector('button');
    expect(button).not.toBeNull();
    expect(button!.textContent).toBe('approved');
    fireEvent.click(button!);
    expect(onOpenLink).toHaveBeenCalledTimes(1);
    const request = onOpenLink.mock.calls[0][0];
    expect(request.url).toBe('https://example.org/a');
    expect(request.requestId).toMatch(/^r-/);
    // The DOM dispatches per tap; absorbing duplicates is the native
    // single-active handler's job (plan §8.3, Phase 4).
    fireEvent.click(button!);
    expect(onOpenLink).toHaveBeenCalledTimes(2);
  });

  it('stays inert in native-action mode without a handler (no accidental WebView navigation)', () => {
    const { container } = render(
      <NoteContent content="[approved](https://example.org/a)" skin="reader" linkMode="native-action" />,
    );
    expect(container.querySelector('a, button')).toBeNull();
    expect(container.textContent).toContain('approved');
  });

  it('absorbs a rejecting handler without surfacing anything in the reader', () => {
    const onOpenLink = vi.fn().mockRejectedValue(new Error('handoff cancelled'));
    const { container } = render(
      <NoteContent content="[approved](https://example.org/a)" skin="reader" linkMode="native-action" onOpenLink={onOpenLink} />,
    );
    fireEvent.click(container.querySelector('button')!);
    expect(onOpenLink).toHaveBeenCalledTimes(1);
    // Failures are surfaced by the native side; the reader shows nothing extra.
    expect(container.querySelector('[role="status"], [role="alert"]')).toBeNull();
  });
});

describe('NoteContent task lists (sanitizer input pre-filter, plan §7.2)', () => {
  it('preserves checked and unchecked GFM checkboxes and forces them disabled', () => {
    const doc = renderNote('- [ ] unchecked\n- [x] checked');
    const inputs = [...doc.querySelectorAll('input')];
    expect(inputs).toHaveLength(2);
    for (const input of inputs) {
      expect(input.getAttribute('type')).toBe('checkbox');
      expect(input.hasAttribute('disabled')).toBe(true);
    }
    expect(inputs.filter((input) => input.hasAttribute('checked'))).toHaveLength(1);
    expect(doc.body.textContent).toContain('unchecked');
    expect(doc.body.textContent).toContain('checked');
  });

  it('removes authored non-checkbox inputs entirely, and forces surviving checkboxes disabled', () => {
    const hostile = [
      '<form action="https://example.invalid/submit"><input name="credential" value="FAKE-ONLY" /><button>Submit attack</button></form>',
      '<input name="credential" value="FAKE-ONLY" />',
      '<input type="text" value="evil">',
      '<input type="radio" name="pick">',
      '<input type="checkbox" checked>raw authored checkbox',
    ].join('\n\n');
    const doc = renderNote(hostile);
    // Without the pre-filter, hast-util-sanitize's default `required` would
    // surface the text/radio inputs as disabled checkboxes (§4.1 trap).
    const inputs = [...doc.querySelectorAll('input')];
    expect(inputs).toHaveLength(1);
    expect(inputs[0].getAttribute('type')).toBe('checkbox');
    expect(inputs[0].hasAttribute('disabled')).toBe(true);
    expect(inputs[0].hasAttribute('checked')).toBe(true);
    // Attribute-shaped fake credentials vanish with their inputs. (Authored
    // TEXT is not redacted — the fixture suite holds that line below.)
    expect(doc.body.textContent).not.toContain('FAKE-ONLY');
    expect(doc.querySelector('form, button')).toBeNull();
  });
});

describe('fixture security and rendering (kitchen-sink through NoteContent, native-action)', () => {
  it('removes active imported HTML, images, remote URLs and event handlers', () => {
    const { doc } = renderFixture();
    expect(doc.querySelector('script, iframe, style, form, input, textarea, img, object, embed')).toBeNull();
    // §7.4: authored buttons never survive the pipeline. The only button is
    // trusted application chrome: the native-action link button for the
    // note's approved HTTPS link. (FigureShell's "Show source" disclosure is
    // the other trusted kind; the fixture's diagram is valid, so none shows.)
    const buttons = [...doc.querySelectorAll('button')];
    expect(buttons).toHaveLength(1);
    expect(buttons[0].getAttribute('type')).toBe('button');
    expect(buttons[0].textContent).toBe('Remote link label');
    // The approved URL may appear as INERT DATA on that button — never in a
    // URL-bearing attribute, which is the fetch/navigation surface. This is
    // the §4.6 rewrite of the old blanket `not.toContain('example.invalid')`.
    expect(buttons[0].getAttribute('title')).toBe('https://example.invalid/');
    expect(doc.querySelector('[href], [src], [srcset], [ping], [action]')).toBeNull();
    for (const element of doc.querySelectorAll('*')) {
      expect(element.getAttributeNames().filter((name) => name.toLowerCase().startsWith('on'))).toEqual([]);
    }
    expect(doc.querySelector('#location, [name="cookie"]')).toBeNull();
    // Every other hostile example.invalid URL is gone entirely.
    const html = doc.querySelector('main')!.innerHTML;
    for (const gone of ['image-beacon', 'style-beacon', 'css-beacon', '/frame', '/submit', '/ping', 'markdown-image']) {
      expect(html).not.toContain(gone);
    }
    expect(html.match(/example\.invalid/g)).toEqual(['example.invalid']); // the trusted title, nothing else
    expect(html).not.toContain('__readerHostileExecuted');
    expect(doc.body.textContent).toContain('Safe visible text inside hostile attributes.');
  });

  it('keeps authored fake credential-shaped text literal (sanitization is not redaction)', () => {
    expect(renderFixture().doc.body.textContent).toContain('sk_test_reader_fixture_NOT_A_CREDENTIAL');
  });

  it('renders local math, structured diagram, table and bilingual prose', () => {
    const { doc } = renderFixture();
    expect(doc.querySelectorAll('.katex').length).toBeGreaterThan(2);
    expect(doc.querySelector('[aria-labelledby="fig-1-title fig-1-desc"]')).not.toBeNull();
    expect(doc.querySelectorAll('svg[role="img"]')).toHaveLength(1);
    expect(doc.querySelector('figcaption')?.textContent).toContain('Fig. 1');
    expect(doc.querySelector('table td')?.textContent).toBe('Energy');
    expect(doc.body.textContent).toContain('ተማሪ በየቀኑ');
    expect(doc.body.textContent).toContain('End of fixture');
  });

  it('shares nested callouts and malformed-note display repairs', () => {
    const { doc } = renderFixture();
    expect(doc.querySelector('[data-callout="note"] [data-callout="tip"]')).not.toBeNull();
    expect(doc.querySelector('[data-callout="warning"]')?.textContent).toContain('entity-escaped');
    expect([...doc.querySelectorAll('h2')].some((h) => h.textContent === 'Known generated-heading repair')).toBe(true);
    expect(doc.querySelector('pre code')?.textContent).toContain('<script>not executable</script>');
  });

  it('drops scheme-bearing hrefs at sanitization; native-action renders only the approved link', () => {
    const { doc } = renderFixture(
      '<a href="&#106;avascript:alert(1)">encoded</a>\n\n[web](https://example.invalid) [anchor](#sec-1) [relative](/app) [proto](//example.invalid/x) [http](http://example.invalid/)',
    );
    expect(doc.querySelectorAll('button')).toHaveLength(1); // the approved https link only
    expect(doc.querySelector('a, [href]')).toBeNull();
    for (const label of ['encoded', 'anchor', 'relative', 'proto', 'http']) {
      expect(doc.body.textContent).toContain(label);
    }
  });

  it('strips arbitrary imported SVG/MathML but allows trusted generated math', () => {
    const { doc } = renderFixture(
      '<svg><foreignObject><img src="https://example.invalid"></foreignObject></svg>\n\n<math><mtext><img src=x onerror=alert(1)></mtext></math>\n\n$x^2$',
    );
    expect(doc.querySelector('foreignObject, img')).toBeNull();
    expect(doc.querySelector('.katex')).not.toBeNull();
  });

  it('does not enable KaTeX trust features that fetch or navigate', () => {
    const { doc } = renderFixture('$\\href{https://example.invalid}{click}$\n\n$\\includegraphics{https://example.invalid/image}$');
    expect(doc.querySelector('[href], img')).toBeNull();
  });

  it('does not let raw HTML impersonate a callout or set CSS', () => {
    const { doc } = renderFixture('<blockquote data-callout="warning" class="katex" style="background:red">ordinary quote</blockquote>');
    expect(doc.querySelector('[data-callout], .katex, [style]')).toBeNull();
  });

  it('unwraps exotic authored tags to text and drops images (documented web deltas, plan §7.3)', () => {
    // Intentional, documented deltas from adopting the shared schema on web:
    // - note images stop rendering (no `img` in the schema — consistent with
    //   M2's "block remote images by default"), including their alt text;
    // - exotic authored tags unwrap to their text.
    // Dangerous link SCHEMES are not a delta: react-markdown's urlTransform
    // already nulled them before components rendered.
    const doc = renderNote(
      '<mark>marked</mark> <abbr title="x">abbr</abbr> <details><summary>sum</summary>body</details>\n\n![alt text](https://example.invalid/i.png)',
      { linkMode: 'web' },
    );
    expect(doc.querySelector('mark, abbr, details, summary, img')).toBeNull();
    for (const text of ['marked', 'abbr', 'sum', 'body']) expect(doc.body.textContent).toContain(text);
    expect(doc.body.textContent).not.toContain('alt text');
  });
});

describe('seed note through the shared pipeline (supplementary, plan §9)', () => {
  it('renders the seed note with its authored text intact', () => {
    // Supplementary coverage only: sanitization does NOT always preserve text
    // (elements in `strip` lose their contents), so this asserts that one
    // realistic note survives the now-shared pipeline — it is not a general
    // text-preservation guarantee.
    const seed = SEED_NOTES[0];
    const doc = renderNote(seed.content, { noteTitle: seed.title });
    const text = doc.body.textContent ?? '';
    for (const fragment of [
      'Cellular respiration is a set of metabolic reactions',
      'The complete oxidation of one glucose molecule',
      'Stage Comparison',
      'Chemiosmosis',
      "Oxygen's Role",
      'If oxygen is absent',
      'Campbell, N. A. (2020)',
    ]) {
      expect(text).toContain(fragment);
    }
    // The seed's citation span normalizes in one place; its pre-JSON legacy
    // fence falls back to labelled source on hosts without a legacy renderer.
    expect(doc.querySelector('sup')?.textContent).toBe('[1]');
    expect(text).toContain('Legacy diagram');
  });
});

describe('NoteContent term activation (client-side)', () => {
  afterEach(cleanup);

  it('routes a diagram node click to onTermActivate WITH its element (web morph origin)', () => {
    const onTermActivate = vi.fn();
    const { container } = render(<NoteContent content={fence('Overview')} skin="web" onTermActivate={onTermActivate} />);

    const node = container.querySelector('g[aria-label="Explain Glycolysis"]');
    expect(node).not.toBeNull();
    fireEvent.click(node!);

    expect(onTermActivate).toHaveBeenCalledTimes(1);
    const [term, context, element] = onTermActivate.mock.calls[0];
    expect(term).toBe('Glycolysis');
    expect(typeof context).toBe('string');
    expect(context.length).toBeGreaterThan(0);
    // The element travels DOM-side only (web morph); the native host drops it.
    expect(element).toBe(node);
  });
});

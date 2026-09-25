import assert from 'node:assert/strict';
import fs from 'node:fs';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { FixtureMarkdown } from '../src/reader-core/FixtureMarkdown.tsx';
import { ReaderAssetSpike } from '../src/reader-core/ReaderAssetSpike.tsx';
import { buildExplainRequest, isApprovedLink, validateExplainRequest } from '../src/reader-core/bridge.ts';

// Run with Node + tsx, NOT jsdom: imports/SSR cannot depend on a browser global.
assert.equal(typeof window, 'undefined');
assert.equal(typeof document, 'undefined');
const fixture = JSON.parse(fs.readFileSync(new URL('../fixtures/mobile/reader-kitchen-sink.json', import.meta.url), 'utf8'));
const html = renderToStaticMarkup(React.createElement(FixtureMarkdown, { content: fixture.content }));
assert.ok(html.includes('End of fixture'));
assert.ok(html.includes('katex'));
assert.ok(html.includes('fig-1-title'));
assert.ok(!html.includes('example.invalid'));
assert.ok(renderToStaticMarkup(React.createElement(ReaderAssetSpike, { ...fixture, development: false })).includes('Preparing protected reader'));
// The extracted shared renderer SSR-renders under Node too (both skins).
const { NoteContent } = await import('../src/reader-core/NoteContent.tsx');
for (const skin of ['web', 'reader']) {
  const noteHtml = renderToStaticMarkup(React.createElement(NoteContent, { content: fixture.content, noteTitle: fixture.title, skin }));
  assert.ok(noteHtml.includes('End of fixture') && noteHtml.includes('katex'), `NoteContent (${skin})`);
}
// The bridge contract is pure: building and validating a request needs no browser globals.
const request = buildExplainRequest({ noteId: fixture.id, term: 'Energy', context: 'bounded' });
assert.ok(request && validateExplainRequest(fixture.id, request).ok);
assert.ok(isApprovedLink('https://example.invalid/x') && !isApprovedLink('//example.invalid/x'));
console.log('Reader Node smoke: imports and SSR succeed without window/document or browser storage.');

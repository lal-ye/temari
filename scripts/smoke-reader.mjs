import assert from 'node:assert/strict';
import fs from 'node:fs';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { ReaderAssetSpike } from '../src/reader-core/ReaderAssetSpike.tsx';
import { NoteContent } from '../src/reader-core/NoteContent.tsx';
import { buildExplainRequest, isApprovedLink, validateExplainRequest } from '../src/reader-core/bridge.ts';

// Run with Node + tsx, NOT jsdom: imports/SSR cannot depend on a browser global.
assert.equal(typeof window, 'undefined');
assert.equal(typeof document, 'undefined');
const fixture = JSON.parse(fs.readFileSync(new URL('../fixtures/mobile/reader-kitchen-sink.json', import.meta.url), 'utf8'));

// The fixture path now goes through the shared renderer (FixtureMarkdown is
// retired): the same NoteContent pipeline the web app and the phone use.
// Default linkMode (disabled): no anchors, no buttons, no URL attributes —
// hostile markup cannot smuggle an interactive element through in any skin.
const renderNote = (props) =>
  renderToStaticMarkup(React.createElement(NoteContent, { content: fixture.content, noteTitle: fixture.title, ...props }));
for (const skin of ['web', 'reader']) {
  const noteHtml = renderNote({ skin });
  assert.ok(noteHtml.includes('End of fixture') && noteHtml.includes('katex'), `NoteContent (${skin})`);
  assert.ok(noteHtml.includes('fig-1-title'), `NoteContent (${skin}) figure`);
  assert.ok(!noteHtml.includes('__readerHostileExecuted'), `NoteContent (${skin}) hostile payload`);
  assert.ok(!/<(script|iframe|style|form|input|img|textarea|object|embed)\b/i.test(noteHtml), `NoteContent (${skin}) stripped elements`);
  assert.ok(!noteHtml.includes('<a ') && !noteHtml.includes('<button'), `NoteContent (${skin}) inert by default`);
  assert.ok(!/(href|src|srcset|ping|action)=/.test(noteHtml), `NoteContent (${skin}) URL attributes`);
}

// Link policy renders under Node too (plan §7.3):
// - web mode: the approved HTTPS link is a target=_blank anchor.
// - native-action with a handler: the approved link is a real button whose URL
//   rides as inert data (title) — never in a URL-bearing attribute.
// - native-action without a handler: inert content (no anchor, no button).
const web = renderNote({ skin: 'web', linkMode: 'web' });
assert.ok(web.includes('href="https://example.invalid/"') && web.includes('target="_blank"'), 'web mode approved anchor');
const action = renderNote({ skin: 'reader', linkMode: 'native-action', onOpenLink: async () => {} });
assert.ok(action.includes('Remote link label</button>'), 'native-action button');
assert.ok(action.includes('title="https://example.invalid/"'), 'native-action inert URL data');
assert.ok(!/(href|src|srcset|ping|action)=/.test(action), 'native-action: no URL-bearing attributes');
const inert = renderNote({ skin: 'reader', linkMode: 'native-action' });
assert.ok(!inert.includes('<a ') && !inert.includes('<button'), 'native-action without a handler stays inert');
assert.ok(inert.includes('Remote link label'), 'inert label text preserved');

// The fixture shell SSR-renders under Node as well (content mounts after the
// CSP/font effect, so SSR shows the preparing state).
assert.ok(renderToStaticMarkup(React.createElement(ReaderAssetSpike, { ...fixture, development: false })).includes('Preparing protected reader'));

// The bridge contract is pure: building and validating a request needs no browser globals.
const request = buildExplainRequest({ noteId: fixture.id, term: 'Energy', context: 'bounded' });
assert.ok(request && validateExplainRequest(fixture.id, request).ok);
assert.ok(isApprovedLink('https://example.invalid/x') && !isApprovedLink('//example.invalid/x'));
console.log('Reader Node smoke: imports and SSR succeed without window/document or browser storage.');

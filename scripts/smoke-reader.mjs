import assert from 'node:assert/strict';
import fs from 'node:fs';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { FixtureMarkdown } from '../src/reader-core/FixtureMarkdown.tsx';
import { ReaderAssetSpike } from '../src/reader-core/ReaderAssetSpike.tsx';

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
console.log('Reader Node smoke: imports and SSR succeed without window/document or browser storage.');

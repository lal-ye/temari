/** Only static application assets are cached. Never provider responses or data. */
import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
const root = '.cache/web-export';
const files = (await fs.readdir(root, { recursive: true })).filter(file => !['sw.js', 'metadata.json'].includes(file));
const assets = [];
const hash = createHash('sha256');
for (const file of files.sort()) {
  if (!(await fs.stat(path.join(root, file))).isFile()) continue;
  const content = await fs.readFile(path.join(root, file));
  assets.push('/' + file.replaceAll(path.sep, '/')); hash.update(file); hash.update(content);
}
const cache = 'temari-shell-' + hash.digest('hex').slice(0, 16);
await fs.writeFile(path.join(root, 'sw.js'), `
const CACHE = ${JSON.stringify(cache)};
const ASSETS = ${JSON.stringify(assets)};
self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(ASSETS)));
  // New releases wait until all existing tabs close; no mid-Drill hot swap.
});
self.addEventListener('activate', event => event.waitUntil((async () => {
  for (const name of await caches.keys()) if (name.startsWith('temari-shell-') && name !== CACHE) await caches.delete(name);
  await self.clients.claim();
})()));
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  if (event.request.method !== 'GET' || url.origin !== self.location.origin) return;
  const key = event.request.mode === 'navigate' && !url.pathname.startsWith('/reader/') ? '/index.html' : url.pathname;
  if (!ASSETS.includes(key)) return;
  event.respondWith(caches.open(CACHE).then(async cache => (await cache.match(key)) || fetch(event.request)));
});
`);
console.log(`Offline web shell: ${assets.length} static assets; cache ${cache}.`);

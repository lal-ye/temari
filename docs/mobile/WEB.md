# Expo web

The same Expo routes now work in the browser; there is no retired Express/Render
service to start. The web build is a static single-page app.

```sh
bun install --frozen-lockfile
bun run web          # Metro development
bun run check:web    # production export, reader assets, offline shell
bun run preview:web  # 0.0.0.0:4173, SPA fallback, no API backend
```

Deploy the contents of `.cache/web-export` (also the `temari-web-<commit>` CI
artifact) to a trusted HTTPS static host at the **origin root**. Serve real files
first, then rewrite unknown navigation routes to `/index.html` with status 200.
Serve `/reader/index.html` and `/sw.js` as real files, not the SPA fallback. Give
`sw.js` and `index.html` revalidation/no-cache headers; hashed bundles may be
cached immutably. Do not add a parent CSP blocking `/reader/` frames. The isolated
reader supplies its own strict CSP; never remove its sandbox.

Library data is local IndexedDB, not accounts/sync. Export backups regularly:
clearing site data, browser eviction or private-mode shutdown can remove it.
Multiple tabs can read; a stale tab's write is refused and requires reload.
Keys are memory-only per tab and cleared on reload. Only the model ID is persisted
as a non-secret preference. Portable imports do not change AI credentials.

The optional service worker caches **static assets only**, not AI responses or
study data. After the first full online load, supported HTTPS browsers can reload
and study offline. Closing all tabs lets a downloaded new app version activate.
If the browser disables service workers, study works offline in the already-open
app but cold offline reopening is not guaranteed. No background paid requests.

The Provider must permit the browser request (CORS and API-key restrictions).
No proxy silently forwards your key to another host. A connection test is a
metadata GET, not a generation/quota test. Explain and PDF transcription require
explicit consent before sending material directly to Google.

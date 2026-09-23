import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig, type Plugin} from 'vite';
import { readerCsp } from './src/reader-core/csp';

/** Separate HTML entry: no study App, browser storage or Google Fonts link. */
function readerFixture(): Plugin {
  return {
    name: 'dev-reader-fixture',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        if (req.url?.split('?')[0] !== '/__reader-fixture') return next();
        try {
          const host = req.headers.host || 'localhost';
          const policy = readerCsp(true, `http://${host}`);
          const html = await server.transformIndexHtml('/__reader-fixture', `<!doctype html>
<html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta data-reader-csp="true" http-equiv="Content-Security-Policy" content="${policy}">
<title>Temari · Reader asset spike</title></head>
<body><div id="root"></div><script type="module" src="/src/dev/reader-fixture.tsx"></script></body></html>`);
          res.setHeader('Content-Type', 'text/html; charset=utf-8');
          res.end(html);
        } catch (error) { next(error); }
      });
    },
  };
}

export default defineConfig(() => {
  return {
    plugins: [readerFixture(), react(), tailwindcss()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
      dedupe: ['react', 'react-dom'],
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modifyâfile watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
      // Allow preview/sandbox hosts (e.g. *.e2b.app) to reach the dev server.
      allowedHosts: true as const,
    },
  };
});

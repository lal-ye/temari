import { build } from 'esbuild';
import fs from 'node:fs/promises';
const result = await build({ entryPoints: ['apps/mobile/reader-web/entry.tsx'], bundle: true, write: false, minify: true,
  outfile: 'reader.js', platform: 'browser', format: 'iife', define: { 'process.env.NODE_ENV': '"production"' } });
const js = result.outputFiles.find(file => file.path.endsWith('.js')).text.replaceAll('</script', '<\\/script');
const css = result.outputFiles.find(file => file.path.endsWith('.css')).text.replaceAll('</style', '<\\/style');
const csp = "default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; font-src data:; img-src 'none'; connect-src 'none'; object-src 'none'; frame-src 'none'; base-uri 'none'; form-action 'none'";
const html = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta data-reader-csp="true" http-equiv="Content-Security-Policy" content="${csp}"><title>Temari Note reader</title><style>${css}</style></head><body><div id="root"></div><script>${js}</script></body></html>`;
await fs.mkdir('apps/mobile/public/reader', { recursive: true });
await fs.writeFile('apps/mobile/public/reader/index.html', html);
console.log(`Sandboxed web reader: ${Buffer.byteLength(html)} bytes, all assets embedded.`);

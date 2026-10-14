/** Production-export preview with SPA fallback, never an API proxy. */
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
const root = path.resolve('.cache/web-export');
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.woff2': 'font/woff2' };
http.createServer((req, res) => {
  let pathname;
  try { pathname = decodeURIComponent(new URL(req.url, 'http://preview').pathname); } catch { res.writeHead(400).end(); return; }
  let file = path.resolve(root, '.' + pathname);
  if (file !== root && !file.startsWith(root + path.sep)) { res.writeHead(403).end(); return; }
  if (!fs.existsSync(file) || fs.statSync(file).isDirectory()) {
    if (path.extname(pathname)) { res.writeHead(404).end(); return; }
    file = path.join(root, 'index.html');
  }
  res.setHeader('Content-Type', types[path.extname(file)] ?? 'application/octet-stream');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Cache-Control', 'no-cache');
  fs.createReadStream(file).pipe(res);
}).listen(Number(process.env.PORT ?? 4173), '0.0.0.0', () => console.log('Temari web preview listening on port ' + (process.env.PORT ?? 4173)));

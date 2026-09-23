import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';

const root = path.resolve(process.argv[2] ?? '.cache/m2-export');
const bundleDir = path.join(root, 'www.bundle');
const metadata = JSON.parse(fs.readFileSync(path.join(root, 'metadata.json'), 'utf8'));
const assets = metadata.fileMetadata.android.assets;
const htmlFiles = fs.readdirSync(bundleDir).filter(file => file.endsWith('.html'));
assert.equal(htmlFiles.length, 1, 'Expected one exported DOM document for the asset spike');
const html = fs.readFileSync(path.join(bundleDir, htmlFiles[0]), 'utf8');
const resources = [...html.matchAll(/(?:src|href)="([^"]+)"/g)].map(match => match[1]);
assert.ok(resources.length > 0, 'Exported HTML has no resource references');
for (const resource of resources) {
  assert.ok(resource.startsWith('./'), `DOM resource must be relative, not a remote/root URL: ${resource}`);
  const file = path.resolve(bundleDir, resource);
  assert.ok(file.startsWith(bundleDir + path.sep), 'Resource escaped bundle directory');
  assert.ok(fs.existsSync(file), `Missing DOM asset: ${resource}`);
  assert.ok(assets.some(asset => asset.path.replace(/^\//, '') === 'www.bundle/' + path.basename(file)), `DOM asset missing from Android metadata: ${resource}`);
}
const styles = fs.readdirSync(bundleDir).filter(file => file.endsWith('.css')).map(file => fs.readFileSync(path.join(bundleDir, file), 'utf8')).join('\n');
for (const font of ['Abyssinica SIL', 'Geist Variable', 'Playfair Display', 'KaTeX_Main']) {
  assert.ok(styles.includes(font), `Missing font face: ${font}`);
}
const urls = [...styles.matchAll(/url\(["']?([^\s)"']+)/g)].map(match => match[1]);
assert.equal(urls.length, 24, 'Unexpected embedded font inventory; review the change');
for (const url of urls) {
  assert.ok(url.startsWith('data:font/woff2;base64,'), 'Exported CSS contains a non-embedded resource');
  const bytes = Buffer.from(url.split(',')[1], 'base64');
  assert.equal(bytes.subarray(0, 4).toString(), 'wOF2', 'Invalid embedded WOFF2 header');
}
assert.ok(!/@import\b/.test(styles), 'CSS imports should be resolved by the exporter');
console.log('Reader export: local DOM assets in Android metadata; 24 valid embedded WOFF2 fonts, no external CSS resources. Physical preview APK gate still required.');

// Bounded, secret-free integration check of the actual built Node entry point.
// Runs in CI and the Render build; never contacts a paid AI provider.
import { spawn } from 'node:child_process';
import assert from 'node:assert/strict';
import { once } from 'node:events';

const child = spawn(process.execPath, ['build/server.cjs'], {
  env: { ...process.env, NODE_ENV: 'production', RENDER: 'true',
    TEMARI_HOSTED: 'false', PORT: '0', GEMINI_API_KEY: 'must-not-be-used' },
  stdio: ['ignore', 'pipe', 'pipe'],
});
let logs = '';
child.stderr.on('data', data => { logs += data; });
const exited = once(child, 'exit');
try {
  const port = await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('Server startup timed out')), 15000);
    child.once('error', error => { clearTimeout(timer); reject(error); });
    child.once('exit', code => { clearTimeout(timer); reject(new Error(`Server exited: ${code}`)); });
    child.stdout.on('data', data => {
      logs += data;
      const match = logs.match(/server running on http:\/\/0\.0\.0\.0:(\d+)/);
      if (match) { clearTimeout(timer); resolve(match[1]); }
    });
  });
  const get = (path, options = {}) => fetch(`http://127.0.0.1:${port}${path}`, {
    ...options, signal: AbortSignal.timeout(5000),
  });
  for (const path of ['/', '/app']) {
    const response = await get(path);
    assert.equal(response.status, 200);
    assert.match(response.headers.get('content-type'), /text\/html/);
    const html = await response.text();
    assert.match(html, /id="root"/);
    const asset = html.match(/src="(\/assets\/[^" ]+\.js)"/)?.[1];
    assert.ok(asset, 'built JavaScript asset must be present');
    assert.equal((await get(asset)).status, 200);
  }
  const health = await get('/api/health');
  assert.equal(health.status, 200);
  assert.equal((await health.json()).hasServerKey, false);
  assert.equal(health.headers.get('cache-control'), 'no-store');
  const missing = await get('/api/missing');
  assert.equal(missing.status, 404);
  assert.equal((await missing.json()).error, 'API route not found');
  for (const [body, expected] of [
    [{}, 401],
    [{ provider: 'custom', apiKey: 'test' }, 400],
    [{ provider: 'openai', apiKey: 'test', baseUrl: 'http://169.254.169.254' }, 400],
  ]) {
    const response = await get('/api/ai/test-connection', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
    });
    assert.equal(response.status, expected);
    assert.equal(typeof (await response.json()).error, 'string');
  }
  // Backend bundles/maps must never be served from the public dist directory.
  for (const path of ['/server.cjs', '/server.cjs.map', '/build/server.cjs']) {
    const response = await get(path);
    assert.match(response.headers.get('content-type'), /text\/html/);
    assert.match(await response.text(), /id="root"/);
  }
  console.log('Deployment smoke test passed: frontend, assets, API routing, BYOK and private server bundle.');
} catch (error) {
  console.error(logs);
  throw error;
} finally {
  child.kill('SIGTERM');
  const killTimer = setTimeout(() => child.kill('SIGKILL'), 12000);
  await exited;
  clearTimeout(killTimer);
}

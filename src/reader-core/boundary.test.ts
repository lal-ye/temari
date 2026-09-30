import { execFileSync } from 'node:child_process';
import { describe, it, expect } from 'vitest';

// Make the cheap source/import guards part of the normal web regression gate.
// No ESLint workspace/toolchain is required just to enforce this one boundary.
describe('reader source portability', () => {
  it('has no app/native/store/network imports or APIs', () => {
    expect(execFileSync(process.execPath, ['scripts/check-reader-boundary.mjs'], { encoding: 'utf8' })).toContain('Reader boundary:');
  });
  // The SSR child compiles the whole reader family through tsx (~3s alone);
  // under the full 34-worker suite that can stretch past the 5s default and
  // flake the gate (sync execFileSync also blocks the worker, so the timeout
  // fires late). 30s keeps the smoke meaningful without the load flake.
  it('imports and server-renders under Node without browser globals', { timeout: 30000 }, () => {
    expect(execFileSync(process.execPath, ['--import', 'tsx', 'scripts/smoke-reader.mjs'], { encoding: 'utf8' })).toContain('Reader Node smoke:');
  });
});

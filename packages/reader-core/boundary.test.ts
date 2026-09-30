import { execFileSync } from 'node:child_process';
import { describe, it, expect } from 'vitest';

// Both tests below shell out to a real node child; under the full parallel
// suite either child can stall past the 5s default and flake the gate (sync
// execFileSync also blocks the worker, so the timeout fires late). 30s keeps
// the guards meaningful without the load flake.
describe('reader source portability', () => {
  it('has no app/native/store/network imports or APIs', { timeout: 30000 }, () => {
    expect(execFileSync(process.execPath, ['scripts/check-reader-boundary.mjs'], { encoding: 'utf8' })).toContain('Reader boundary:');
  });
  // The SSR child compiles the whole reader family through tsx (~3s alone).
  it('imports and server-renders under Node without browser globals', { timeout: 30000 }, () => {
    expect(execFileSync(process.execPath, ['--import', 'tsx', 'scripts/smoke-reader.mjs'], { encoding: 'utf8' })).toContain('Reader Node smoke:');
  });
});

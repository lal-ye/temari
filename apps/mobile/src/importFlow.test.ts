import { describe, expect, it } from 'vitest';
import { buildImportPreview } from './importFlow';
import valid from '../../../fixtures/mobile/portable-valid-en.json';
import legacy from '../../../fixtures/mobile/legacy-with-fake-credentials.json';
import invalid from '../../../fixtures/mobile/portable-invalid-reference.json';
import duplicate from '../../../fixtures/mobile/portable-duplicate-id.json';
describe('import preview', () => {
  it('previews every collection without mutating the input', () => {
    const bytes = JSON.stringify(valid);
    const preview = buildImportPreview(bytes);
    expect(preview.kind).toBe('ready');
    expect(JSON.stringify(valid)).toBe(bytes);
  });
  it('migrates legacy backups and strips credentials before preview', () => {
    const preview = buildImportPreview(JSON.stringify(legacy));
    expect(preview.kind).toBe('ready');
    if (preview.kind === 'ready') {
      expect(preview.legacyWarnings.length).toBeGreaterThan(0);
      expect(JSON.stringify(preview.value)).not.toMatch(/apiKey|providerKeys|customBaseUrl/);
    }
  });
  it.each([invalid, duplicate, { ...valid, schemaVersion: 99 }])('rejects unsupported or invalid references/ids', (value) => {
    expect(buildImportPreview(JSON.stringify(value)).kind).toBe('invalid');
  });
  it('rejects huge or malformed input before migration', () => {
    expect(buildImportPreview('x'.repeat(4 * 1024 * 1024 + 1)).kind).toBe('invalid');
    expect(buildImportPreview('{not-json').kind).toBe('invalid');
  });
});

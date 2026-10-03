/**
 * Pure import orchestration (M3 plan §8): bytes → preview payload, computed
 * entirely before any write — cancel at pick, preview or confirm leaves zero
 * observable change (D1).
 *
 *   temari-portable export → ready {value, counts}
 *   legacy v1 backup       → ready {value, counts, legacyWarnings} — the
 *                            unsupported-format error class is the legacy
 *                            trigger; migrateLegacyBackup discards every
 *                            credential-bearing setting and its warning
 *                            surfaces in the preview.
 *   anything else          → invalid {issues} — the honest preview; no
 *                            confirm is ever offered for it.
 *
 * No screen concerns here (the M2 rule): the phone checklist tests the UI,
 * and this module stays exercisable from any harness.
 */
import {
  migrateLegacyBackup,
  parsePortableExport,
  portableCounts,
  type PortableCounts,
  type PortableExport,
  type PortableIssue,
} from '@temari/core';

export type ImportPreview =
  | { kind: 'ready'; value: PortableExport; counts: PortableCounts; legacyWarnings: string[] }
  | { kind: 'invalid'; issues: PortableIssue[] };

export function buildImportPreview(bytes: string): ImportPreview {
  const parsed = parsePortableExport(bytes);
  if (parsed.ok) {
    return { kind: 'ready', value: parsed.value, counts: parsed.counts, legacyWarnings: [] };
  }
  if (parsed.errors.some((issue) => issue.code === 'unsupported_format')) {
    try {
      // parsePortableExport already JSON-parsed these bytes to classify the
      // failure, so this parse cannot throw on the way in.
      const migrated = migrateLegacyBackup(JSON.parse(bytes));
      return {
        kind: 'ready',
        value: migrated.value,
        counts: portableCounts(migrated.value),
        legacyWarnings: migrated.warnings,
      };
    } catch {
      // Not a portable export and not a migratable legacy backup either —
      // the portable parser's issues are the honest preview.
    }
  }
  return { kind: 'invalid', issues: parsed.errors };
}

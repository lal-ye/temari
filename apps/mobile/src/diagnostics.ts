import Constants from 'expo-constants';
import { Platform } from 'react-native';
import type { AiFailure } from '@temari/core';
// Fixed enums only: never raw Error/message/stack/URL/material/key/record IDs.
type Operation = 'connection' | 'explain' | 'pdf' | 'export' | 'library' | 'render' | 'settings';
const events: { at: string; operation: Operation; category: AiFailure | 'storage' | 'unexpected' | 'success' }[] = [];
export function recordDiagnostic(operation: Operation, category: typeof events[number]['category']) {
  events.push({ at: new Date().toISOString(), operation, category });
  if (events.length > 50) events.shift();
}
export function diagnosticReport(): string {
  return JSON.stringify({ format: 'temari-diagnostics-v1', createdAt: new Date().toISOString(),
    platform: Platform.OS, osVersion: Platform.Version, appVersion: Constants.expoConfig?.version,
    build: Constants.expoConfig?.android?.versionCode, commit: Constants.expoConfig?.extra?.buildCommit ?? 'local', events }, null, 2);
}

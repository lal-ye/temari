import { requireNativeModule } from 'expo-modules-core';

export type TemariFileRead = {
  readText(uri: string): Promise<string>;
  readBase64(uri: string): Promise<string>;
};

let cached: TemariFileRead | null = null;

/** Native-only: requireNativeModule throws on web, so require lazily. */
export function temariFileRead(): TemariFileRead {
  cached ??= requireNativeModule<TemariFileRead>('TemariFileRead');
  return cached;
}

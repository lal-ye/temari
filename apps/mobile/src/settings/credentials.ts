import * as SecureStore from 'expo-secure-store';
import { AiRequestError } from '@temari/core';
const KEY = 'temari.gemini.api-key';
export async function readKey(): Promise<string | null> {
  try { return await SecureStore.getItemAsync(KEY); } catch { throw new AiRequestError('storage'); }
}
export async function saveKey(key: string): Promise<void> {
  if (!key.trim() || key.length > 1024 || /\s/.test(key.trim())) throw new AiRequestError('invalid-input');
  try { await SecureStore.setItemAsync(KEY, key.trim()); } catch { throw new AiRequestError('storage'); }
}
export async function deleteKey(): Promise<void> {
  try { await SecureStore.deleteItemAsync(KEY); } catch { throw new AiRequestError('storage'); }
}

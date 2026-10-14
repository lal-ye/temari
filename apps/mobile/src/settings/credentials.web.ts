import { AiRequestError } from '@temari/core';
// Deliberately NOT localStorage/sessionStorage/IndexedDB. Reload clears the key.
let sessionKey: string | null = null;
export async function readKey(): Promise<string | null> { return sessionKey; }
export async function saveKey(key: string): Promise<void> {
  if (!key.trim() || key.length > 1024 || /\s/.test(key.trim())) throw new AiRequestError('invalid-input');
  sessionKey = key.trim();
}
export async function deleteKey(): Promise<void> { sessionKey = null; }

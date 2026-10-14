import * as SQLite from 'expo-sqlite';
import { getProviderInfo } from '@temari/core';
let db: Promise<SQLite.SQLiteDatabase> | null = null;
async function open() {
  if (!db) db = (async () => {
    const value = await SQLite.openDatabaseAsync('temari-preferences.db');
    await value.execAsync('CREATE TABLE IF NOT EXISTS preferences (key TEXT PRIMARY KEY, value TEXT NOT NULL)');
    return value;
  })().catch((error) => { db = null; throw error; });
  return db;
}
export async function readModel(): Promise<string> {
  const row = await (await open()).getFirstAsync<{ value: string }>('SELECT value FROM preferences WHERE key = ?', 'gemini-model');
  return row?.value ?? getProviderInfo('gemini').defaultModel;
}
export async function saveModel(model: string): Promise<void> {
  await (await open()).runAsync('INSERT OR REPLACE INTO preferences (key, value) VALUES (?, ?)', 'gemini-model', model);
}

import { getProviderInfo } from '@temari/core';
const MODEL_KEY = 'temari.gemini.model';
export async function readModel(): Promise<string> { return localStorage.getItem(MODEL_KEY) ?? getProviderInfo('gemini').defaultModel; }
export async function saveModel(model: string): Promise<void> { localStorage.setItem(MODEL_KEY, model); }

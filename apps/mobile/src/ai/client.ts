import { createGeminiClient } from '@temari/core';
import { readKey } from '../settings/credentials';
import { readModel } from '../settings/preferences';
export const aiClient = createGeminiClient({
  credentials: async () => ({ apiKey: await readKey(), model: await readModel() }),
});

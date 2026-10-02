/**
 * Collision-resistant record IDs for new mobile records (M3 plan D6).
 *
 * The web wrote Attempt ids as `att-${Date.now()}`, which can collide on a
 * rapid double-tap; the repository is keyed by insertion order so duplicates
 * are kept, but distinct ids keep history legible. Imported records keep
 * their original ids verbatim; only records created on-device use this
 * factory. Backed by expo-crypto's secure random UUID, injected into
 * `buildDrillAttempt` as the `NewRecordId` seam (tests use a counter).
 */
import * as Crypto from 'expo-crypto';
import type { NewRecordId } from '@temari/core';

export const newRecordId: NewRecordId = () => `att-${Crypto.randomUUID()}`;

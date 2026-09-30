/**
 * `AbortError` is how `fetch` (and the AI module, which re-throws it rather
 * than substituting an offline draft) reports that the caller cancelled. It
 * is never a failure to show the learner.
 */
export function isAbortError(err: unknown): boolean {
  return !!err && typeof err === 'object' && (err as { name?: string }).name === 'AbortError';
}

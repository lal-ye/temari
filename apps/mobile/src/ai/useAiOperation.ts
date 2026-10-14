import { useCallback, useRef, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { aiErrorMessage, aiFailure, type AiPhase, type RequestOptions } from '@temari/core';
import { recordDiagnostic } from '../diagnostics';
export const phaseText: Record<AiPhase, string> = {
  connecting: 'Connecting securely to Gemini…', slow: 'Taking longer than usual. Saved study content remains available; you can cancel.', generating: 'Generating with Gemini…',
};
export function useAiOperation(operation: 'connection' | 'pdf') {
  const active = useRef<AbortController | null>(null);
  const epoch = useRef(0);
  const [phase, setPhase] = useState<AiPhase | null>(null);
  const [error, setError] = useState<string | null>(null);
  const cancel = useCallback(() => { epoch.current++; active.current?.abort(); active.current = null; setPhase(null); }, []);
  useFocusEffect(useCallback(() => {
    setPhase(null);
    return () => { epoch.current++; active.current?.abort(); active.current = null; };
  }, []));
  async function run<T>(task: (options: RequestOptions) => Promise<T>, done: (value: T) => void) {
    if (active.current) return;
    const controller = new AbortController(); active.current = controller;
    const token = ++epoch.current;
    setError(null); setPhase('connecting');
    try {
      const value = await task({ signal: controller.signal, onPhase: (next) => { if (token === epoch.current) setPhase(next); } });
      if (token === epoch.current) { done(value); recordDiagnostic(operation, 'success'); }
    } catch (e) {
      if (token === epoch.current) { setError(aiErrorMessage(e)); recordDiagnostic(operation, aiFailure(e)); }
    } finally {
      if (token === epoch.current) { active.current = null; setPhase(null); }
    }
  }
  return { phase, error, cancel, run };
}

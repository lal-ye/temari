import { useEffect, useState } from 'react';

/**
 * Tracks browser connectivity.
 *
 * Used by the one status dot the app is allowed to show. A coloured dot that is
 * always green is decoration pretending to be information; this one is only
 * green when the learner can actually reach a Provider.
 */
export function useOnlineStatus(): boolean {
  const [online, setOnline] = useState(() =>
    typeof navigator === 'undefined' ? true : navigator.onLine
  );

  useEffect(() => {
    const update = () => setOnline(navigator.onLine);
    window.addEventListener('online', update);
    window.addEventListener('offline', update);
    return () => {
      window.removeEventListener('online', update);
      window.removeEventListener('offline', update);
    };
  }, []);

  return online;
}

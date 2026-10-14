/** Optional enhancement: failure never prevents local-library startup. */
export function registerOfflineShell() {
  if (process.env.NODE_ENV === 'production' && 'serviceWorker' in navigator) {
    void navigator.serviceWorker.register('/sw.js').catch(() => { /* Browser may disable offline caching. */ });
  }
}

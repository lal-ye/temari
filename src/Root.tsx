import { lazy, Suspense, useCallback, useEffect, useState } from 'react';
import { LandingPage } from './components/landing/LandingPage';

/**
 * Where the study shell lives. Everything else is the landing page. Exported
 * so the landing CTA and the docs agree on one string.
 */
export const APP_PATH = '/app';

/**
 * Two screens, one boolean, no router (docs/adr/0009). The study shell is a
 * separate chunk so the landing entry stays ~77 kB gzipped with none of the
 * study code in it (ADR-0009's measured guardrail). Since the audit's perf
 * fix, that chunk is additionally *warmed at idle* while the visitor reads
 * the landing — a deliberate revision of ADR-0009's original "never
 * downloads until the CTA click" prose: the split (what the guardrail
 * measures) is unchanged, but a visitor who stays now spends the app chunk's
 * bandwidth in exchange for an instant CTA. See §7 of
 * docs/archive/ui-audit-ascii-hero-and-design-tooling.md.
 */
const App = lazy(() => import('./App'));

export function isAppPath(pathname: string): boolean {
  return pathname === APP_PATH || pathname.startsWith(`${APP_PATH}/`);
}

/**
 * Shown for the few hundred milliseconds between pressing "Open Temari" and
 * the app chunk arriving. It mirrors the app header's height and background,
 * so the shell appears to fill in rather than flash white and then jump.
 */
function AppLoading() {
  return (
    <div className="h-screen w-full bg-background" aria-busy="true" aria-live="polite">
      <div className="bg-card/95 border-b border-border px-3 sm:px-5 py-2 flex items-center gap-2 shadow-xs">
        <div className="w-8 h-8 bg-primary text-primary-foreground rounded-lg border border-border/60 flex items-center justify-center font-ethiopic font-bold text-sm">
          ተ
        </div>
        <span className="text-sm text-muted-foreground">Opening Temari</span>
      </div>
    </div>
  );
}

export default function Root() {
  const [pathname, setPathname] = useState(() => window.location.pathname);

  useEffect(() => {
    const onPopState = () => setPathname(window.location.pathname);
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  // Warm the app chunk while the visitor is still reading the landing page.
  // Without this, "Launch Engine" waits on the full study-shell download
  // (~336 kB gzipped) before anything swaps — measured as a ~5s stall on the
  // preview. ADR-0009 still holds: the landing *entry* chunk contains none of
  // the study code; this only fetches the separate chunk at idle priority,
  // after the landing is interactive, so it never competes with first paint.
  useEffect(() => {
    if (isAppPath(window.location.pathname)) return;
    const warm = () => {
      import('./App').catch(() => {
        // Offline or a failed prefetch is fine — the click-time lazy()
        // retries, and the Suspense fallback covers it.
      });
    };
    if (typeof window.requestIdleCallback === 'function') {
      const id = window.requestIdleCallback(warm, { timeout: 4000 });
      return () => window.cancelIdleCallback(id);
    }
    const id = window.setTimeout(warm, 1500);
    return () => window.clearTimeout(id);
  }, []);

  const navigate = useCallback((path: string) => {
    if (window.location.pathname === path) return;
    window.history.pushState(null, '', path);
    setPathname(path);
    // A new screen starts at the top; the landing page may have been
    // scrolled to the footer when the CTA was pressed.
    window.scrollTo(0, 0);
  }, []);

  if (isAppPath(pathname)) {
    return (
      <Suspense fallback={<AppLoading />}>
        <App />
      </Suspense>
    );
  }

  return <LandingPage onOpenApp={() => navigate(APP_PATH)} />;
}

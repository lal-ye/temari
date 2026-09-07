import { lazy, Suspense, useCallback, useEffect, useState } from 'react';
import { LandingPage } from './components/landing/LandingPage';

/**
 * Where the study shell lives. Everything else is the landing page. Exported
 * so the landing CTA and the docs agree on one string.
 */
export const APP_PATH = '/app';

/**
 * Two screens, one boolean, no router (docs/adr/0009). The study shell is
 * lazy so a visitor who only reads the landing page never downloads the
 * store, the AI module, recharts or KaTeX; they arrive with the CTA click.
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

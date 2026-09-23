import React, { useEffect, useState } from 'react';
import { FixtureMarkdown } from './FixtureMarkdown';
import { readerCsp } from './csp';

const fontChecks = [
  { label: 'Amharic / Abyssinica SIL', font: '17px "Abyssinica SIL"', text: 'ተማሪ' },
  { label: 'Body / Geist', font: '17px "Geist Variable"', text: 'Energy' },
  { label: 'Headings / Playfair Display', font: '700 24px "Playfair Display"', text: 'Energy' },
  { label: 'Math / KaTeX', font: '17px KaTeX_Main', text: 'E=mc' },
];

/** Fixture-only shell; deliberately no settings object or browser store access.
 * CSS is imported by each host, keeping this module importable in a Node smoke test.
 */
export function ReaderAssetSpike({ title, content, development }: {
  title: string;
  content: string;
  development: boolean;
}) {
  const [ready, setReady] = useState(false);
  const [fonts, setFonts] = useState<Record<string, string>>({});
  const [violations, setViolations] = useState<string[]>([]);

  useEffect(() => {
    // Keep the meta for the document lifetime. Removing it does not remove an
    // enforced CSP anyway. Neither this browser page nor DOM document mounts App.
    if (!document.querySelector('meta[data-reader-csp]')) {
      const meta = document.createElement('meta');
      meta.httpEquiv = 'Content-Security-Policy';
      meta.content = readerCsp(development, window.location.origin);
      meta.dataset.readerCsp = 'true';
      document.head.prepend(meta);
    }
    const onViolation = (event: SecurityPolicyViolationEvent) => {
      // Never log a blocked URL: it can carry user data in its path/query.
      setViolations(previous => Array.from(new Set([...previous, event.effectiveDirective])));
    };
    document.addEventListener('securitypolicyviolation', onViolation);
    setReady(true);
    let active = true;
    const timers: ReturnType<typeof setTimeout>[] = [];
    for (const check of fontChecks) {
      const timer = setTimeout(() => {
        if (active) setFonts(values => ({ ...values, [check.label]: 'FAILED: font load timed out' }));
      }, 10000);
      timers.push(timer);
      const load = document.fonts
        ? document.fonts.load(check.font, check.text)
        : Promise.reject(new Error('Font Loading API unavailable'));
      load.then(faces => {
        clearTimeout(timer);
        if (active) setFonts(values => ({ ...values, [check.label]: faces.length > 0 ? 'loaded' : 'FAILED: bundled face missing' }));
      }).catch(() => {
        clearTimeout(timer);
        if (active) setFonts(values => ({ ...values, [check.label]: 'FAILED: font could not load' }));
      });
    }
    return () => {
      active = false;
      timers.forEach(clearTimeout);
      document.removeEventListener('securitypolicyviolation', onViolation);
    };
  }, [development]);

  const failed = violations.length > 0 || Object.values(fonts).some(value => value.startsWith('FAILED'));
  return <main className="reader-lab">
    <header>
      <span className="reader-eyebrow">M2 · Asset spike / synthetic fixture</span>
      <h1>{title}</h1>
      <p className="reader-intro">One Note, two hosts. Local fonts, math and editorial SVG. No storage, API calls or real credentials. Links are inert; selection-to-Explain comes after the offline asset gate.</p>
    </header>
    <aside className="reader-status" data-failed={failed} role="status" aria-live="polite">
      <strong>{failed ? 'Asset/security check needs attention' : 'Bundled font checks'}</strong>
      <ul>{fontChecks.map(check => <li key={check.label}>{check.label}: {fonts[check.label] ?? 'checking…'}</li>)}</ul>
      <p>CSP: {ready ? 'installed before Note mount' : 'installing…'} · {development ? 'development / local server permitted' : 'release / network connections blocked'}</p>
      {violations.length > 0 && <p>Blocked resource directives: {violations.join(', ')}. Inspect locally; do not paste sensitive URLs.</p>}
      <p>Loaded fonts are not proof of offline operation. Verify this screen in an installed preview APK, after force-stop, with airplane mode on and Wi-Fi off.</p>
    </aside>
    {ready ? <article aria-label="Kitchen-sink Note"><FixtureMarkdown content={content} /></article> : <p>Preparing protected reader…</p>}
  </main>;
}

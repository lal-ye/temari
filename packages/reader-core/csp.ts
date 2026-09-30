/** Expo DOM HTML has trusted inline bootstrap scripts; KaTeX uses inline styles.
 * This CSP supplements sanitization, not replaces it. Development permits only
 * the current server's HMR socket. Release allows local files, never http(s).
 * Installed via a head meta before mounting fixture content; Expo's earlier
 * generated bootstrap is trusted and is NOT retroactively covered by this meta.
 */
export function readerCsp(development: boolean, origin?: string): string {
  let socket = '';
  if (development && origin) {
    const url = new URL(origin);
    if (url.protocol === 'http:' || url.protocol === 'https:') {
      socket = ` ws://${url.host} wss://${url.host}`;
    }
  }
  const local = development ? "'self'" : "'self' file:";
  return [
    "default-src 'none'",
    `script-src ${local} 'unsafe-inline'${development ? " 'unsafe-eval'" : ''}`,
    "script-src-attr 'none'",
    `style-src ${local} 'unsafe-inline'`,
    `font-src ${local} data:`,
    "img-src 'none'",
    `connect-src ${development ? "'self'" + socket : "'none'"}`,
    "object-src 'none'", "frame-src 'none'", "base-uri 'none'", "form-action 'none'",
  ].join('; ');
}

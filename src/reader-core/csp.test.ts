import { describe, expect, it } from 'vitest';
import { readerCsp } from './csp';

// Moved from the retired FixtureMarkdown.test.tsx when the fixture rewired to
// NoteContent (checkpoint B Phase 3): the CSP contract is the reader shell's,
// not the markdown renderer's.
describe('reader CSP', () => {
  it('permits no release network connections or remote images', () => {
    const policy = readerCsp(false);
    expect(policy).toContain("connect-src 'none'");
    expect(policy).toContain("img-src 'none'");
    expect(policy).toContain("script-src-attr 'none'");
    expect(policy).not.toMatch(/https?:|wss?:|unsafe-eval/);
  });

  it('limits development sockets to the supplied server, including secure previews', () => {
    const policy = readerCsp(true, 'https://8081-example.e2b.app');
    expect(policy).toContain("connect-src 'self' ws://8081-example.e2b.app wss://8081-example.e2b.app");
    expect(policy).not.toContain(' *');
  });
});

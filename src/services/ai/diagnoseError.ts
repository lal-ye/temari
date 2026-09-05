/**
 * diagnoseError.ts — turn a provider failure into something a learner can act on.
 *
 * The connection test previously surfaced whatever string the transport threw.
 * "fetch failed" is what Node says when DNS fails, when the port is closed, and
 * when a local Ollama simply is not running — three different problems with
 * three different fixes, all rendered identically and none of them telling the
 * learner what to do next.
 *
 * This maps raw failures onto a cause, a plain-language explanation, and a
 * concrete next step. It is pure and string-based on purpose: the transport
 * layer throws plain Errors from several different SDKs, and sniffing the
 * message is the only signal common to all of them. Ordering matters — the
 * most specific patterns are tested first.
 */

export type FailureKind =
  | 'missing-key'
  | 'bad-key'
  | 'rate-limited'
  | 'unknown-model'
  | 'no-server'
  | 'local-unreachable'
  | 'network'
  | 'quota'
  | 'timeout'
  | 'unknown';

export interface Diagnosis {
  kind: FailureKind;
  /** One line, sentence case, no jargon. */
  title: string;
  /** What to actually do about it. */
  fix: string;
}

interface DiagnoseInput {
  message: string;
  provider: string;
  /** Whether the learner supplied a key for this provider. */
  hasKey: boolean;
  /** Custom/local providers fail differently from cloud ones. */
  isLocal: boolean;
  baseUrl?: string;
}

export function diagnoseConnectionError({
  message,
  provider,
  hasKey,
  isLocal,
  baseUrl,
}: DiagnoseInput): Diagnosis {
  const m = (message || '').toLowerCase();

  // --- credentials -------------------------------------------------------
  if (!hasKey && !isLocal && /api[\s_-]?key|unauthor|401|missing|credential/.test(m)) {
    return {
      kind: 'missing-key',
      title: 'No API key for this provider',
      fix: 'Paste a key in the field above, then test again.',
    };
  }

  if (/401|unauthor|invalid[\s_-]?(api[\s_-]?)?key|incorrect api key|authentication/.test(m)) {
    return {
      kind: 'bad-key',
      title: 'The provider rejected this key',
      fix: 'Check for a copied space or a truncated paste, and confirm the key is still active in your provider dashboard.',
    };
  }

  if (/403|forbidden|permission|not authorized/.test(m)) {
    return {
      kind: 'bad-key',
      title: 'This key is not allowed to use that model',
      fix: 'The key is valid but lacks access. Enable the model on your provider account, or pick a different one.',
    };
  }

  // --- limits ------------------------------------------------------------
  if (/429|rate[\s_-]?limit|too many requests/.test(m)) {
    return {
      kind: 'rate-limited',
      title: 'Rate limit reached',
      fix: 'Wait a moment and test again. Free tiers cap requests per minute.',
    };
  }

  if (/quota|billing|insufficient|credit|payment|exceeded your current/.test(m)) {
    return {
      kind: 'quota',
      title: 'Out of quota or credit',
      fix: 'Your provider account needs billing set up or has exhausted its free allowance.',
    };
  }

  // --- model -------------------------------------------------------------
  if (/model|404|not found|does not exist|unsupported|deprecat|decommission/.test(m)) {
    return {
      kind: 'unknown-model',
      title: 'The provider does not recognise this model',
      fix: isLocal
        ? 'Confirm the model is pulled locally, for example "ollama pull llama3.2".'
        : 'The model may have been renamed or retired. Use Scan live models to see what this key can actually reach.',
    };
  }

  // --- transport ---------------------------------------------------------
  if (isLocal && /fetch failed|econnrefused|network|failed to fetch|socket/.test(m)) {
    return {
      kind: 'local-unreachable',
      title: 'Nothing is listening at that address',
      fix: `Start your local server and confirm it is reachable at ${baseUrl || 'the base URL above'}.`,
    };
  }

  if (/timeout|timed out|etimedout|aborted/.test(m)) {
    return {
      kind: 'timeout',
      title: 'The provider did not respond in time',
      fix: 'This is usually temporary. Test again, or try a faster model.',
    };
  }

  if (/failed to fetch|networkerror|load failed|api endpoint not available/.test(m)) {
    return {
      kind: 'no-server',
      title: 'Temari’s own server is not reachable',
      fix: 'Key testing runs server-side. On a static deployment there is no server to run it, so this test cannot work there.',
    };
  }

  if (/fetch failed|enotfound|econnrefused|dns|getaddrinfo|socket|econnreset/.test(m)) {
    return {
      kind: 'network',
      title: 'Could not reach the provider',
      fix: 'Check your internet connection. If you are on a restricted network, the provider domain may be blocked.',
    };
  }

  return {
    kind: 'unknown',
    title: 'The connection test failed',
    fix: message?.trim() || 'No further detail was returned by the provider.',
  };
}

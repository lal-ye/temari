import React from 'react';
import { Zap, RefreshCw, Settings2 } from 'lucide-react';
import type { FallbackReason } from '../../services/ai';
import { Button } from '../ui/button';
import { requestProviderSettings } from './providerSettingsRequest';

/**
 * The single place offline generation is attributed (CONTEXT.md). Uses the same
 * amber tint recipe as the difficulty badges, so "this came from the local
 * fallback" reads the same on every screen.
 *
 * Two different facts live here and must not be blurred
 * (docs/ui-plan-truthful-interaction.md §4b):
 *
 *   - **Provenance** — the content was assembled locally, not by a model.
 *   - **Reason** — why the Provider was not used. A rejected key, a rate
 *     limit and a dead network are different problems with different fixes,
 *     and "No AI Provider was reachable" is simply false for the first two.
 *
 * Pass `fallback` (from `GenerationResult`) and the banner names the reason
 * and offers the matching action: settings for configuration failures,
 * retry for transport ones. Without it, the banner states provenance only
 * and makes no claim about why.
 */
interface OfflineBannerProps {
  /** What was assembled locally, e.g. "this note", "these flashcards". */
  what?: string;
  /** Why the Provider did not serve it. */
  fallback?: FallbackReason;
  /** Regenerate with the Provider. Shown for transport failures. */
  onRetry?: () => void;
  /** Legacy escape hatch: fully custom text. Prefer `what` + `fallback`. */
  label?: string;
  className?: string;
}

type Recovery = 'settings' | 'retry' | 'retry-later';

function recoveryFor(kind: FallbackReason['kind']): Recovery {
  switch (kind) {
    case 'missing-key':
    case 'bad-key':
    case 'unknown-model':
      return 'settings';
    case 'rate-limited':
    case 'quota':
      return 'retry-later';
    default:
      return 'retry';
  }
}

function reasonSentence(f: FallbackReason): string {
  switch (recoveryFor(f.kind)) {
    case 'settings':
      return `${f.provider} rejected the request (${f.title.toLowerCase()}).`;
    case 'retry-later':
      return `${f.provider} is limiting requests right now.`;
    default:
      if (f.kind === 'unknown') return `${f.provider} returned something Temari could not use.`;
      // The request never left the browser: Temari's own server answered
      // nothing, which is what a static deployment looks like.
      if (f.kind === 'no-server') return 'Temari’s own server did not answer.';
      return `Temari could not reach ${f.provider}.`;
  }
}

/** The diagnosis copy was written for the key test; a couple of kinds read wrong under a draft. */
function fixSentence(f: FallbackReason): string {
  if (f.kind === 'no-server') {
    return 'Generation runs through Temari’s server. On a static deployment there is none, so drafts here are always local; on your own server, check that it is running.';
  }
  return f.fix;
}

export const OfflineBanner: React.FC<OfflineBannerProps> = ({
  what = 'this content',
  fallback,
  onRetry,
  label,
  className = '',
}) => {
  const recovery = fallback ? recoveryFor(fallback.kind) : null;

  return (
    <div
      role="status"
      className={`flex items-start gap-2 p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl text-xs font-medium text-amber-800 dark:text-amber-300 ${className}`}
    >
      <Zap className="w-4 h-4 shrink-0 mt-0.5 text-amber-600 dark:text-amber-400" />
      <div className="flex-1 min-w-0 space-y-1.5">
        {label ? (
          <span>{label}</span>
        ) : (
          <p>
            <strong className="font-semibold">Offline draft.</strong>{' '}
            {fallback ? reasonSentence(fallback) : 'The AI Provider did not serve this request.'} {capitalise(what)}{' '}
            was assembled locally from the material, without a model.
          </p>
        )}

        {fallback && (
          <p className="text-[11px] text-amber-800/80 dark:text-amber-300/80" title={fallback.detail}>
            {fixSentence(fallback)}
          </p>
        )}

        {(recovery === 'settings' || (recovery !== null && onRetry)) && (
          <div className="flex flex-wrap gap-2 pt-0.5">
            {recovery === 'settings' && (
              <Button
                type="button"
                size="xs"
                variant="outline"
                onClick={requestProviderSettings}
                className="border-amber-500/30 text-amber-900 dark:text-amber-200 hover:bg-amber-500/15"
              >
                <Settings2 className="size-3.5" />
                Open Provider settings
              </Button>
            )}
            {recovery !== 'settings' && onRetry && (
              <Button
                type="button"
                size="xs"
                variant="outline"
                onClick={onRetry}
                className="border-amber-500/30 text-amber-900 dark:text-amber-200 hover:bg-amber-500/15"
              >
                <RefreshCw className="size-3.5" />
                {recovery === 'retry-later' ? 'Try again' : 'Retry with the Provider'}
              </Button>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

function capitalise(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

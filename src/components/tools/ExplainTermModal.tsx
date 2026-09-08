import React, { useState, useEffect } from 'react';
import { Sparkles, ExternalLink, BookOpen } from 'lucide-react';
import { ai, type FallbackReason } from '../../services/ai';
import { isAbortError } from '../../services/ai/isAbortError';
import { Article } from '../../types';
import { Modal, ModalCloseButton, type MorphOrigin } from '../ui/Modal';
import { GenerationProgress } from '../ui/GenerationProgress';
import { OfflineBanner } from './OfflineBanner';
import { Button } from '../ui/button';

interface ExplainTermModalProps {
  term: string | null;
  context?: string;
  onClose: () => void;
  /** The word or control this explanation was requested from. */
  originRef?: React.RefObject<MorphOrigin | null>;
}

export const ExplainTermModal: React.FC<ExplainTermModalProps> = ({ term, context, onClose, originRef }) => {
  const [loading, setLoading] = useState(false);
  const [explanation, setExplanation] = useState<string>('');
  const [links, setLinks] = useState<Article[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [offline, setOffline] = useState(false);
  const [offlineReason, setOfflineReason] = useState<FallbackReason | undefined>(undefined);
  /** Bumps to re-run the request after a "Retry with the Provider". */
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!term) return;

    // Closing the explainer cancels its request, rather than merely ignoring
    // the answer when it arrives. The AI module propagates AbortError instead
    // of substituting an offline draft (aiGenerator.test.ts), and the
    // transport forwards the signal to fetch. This stops the client waiting;
    // it does not guarantee the upstream Provider stops computing.
    const controller = new AbortController();
    setLoading(true);
    setError(null);
    setOffline(false);
    setOfflineReason(undefined);
    setExplanation('');
    setLinks([]);

    ai.explainTerm({ term, context, signal: controller.signal })
      .then(({ source, value, fallback }) => {
        if (controller.signal.aborted) return;
        setExplanation(value.explanation);
        setLinks(value.relatedLinks || []);
        setOffline(source === 'offline');
        setOfflineReason(fallback);
        setLoading(false);
      })
      .catch((err: unknown) => {
        // Cancellation is not a failure; never paint it as one.
        if (controller.signal.aborted || isAbortError(err)) return;
        setError(err instanceof Error && err.message ? err.message : 'Failed to explain term');
        setLoading(false);
      });

    return () => {
      controller.abort();
    };
  }, [term, context, attempt]);

  if (!term) return null;

  return (
    <Modal
      open={Boolean(term)}
      onClose={onClose}
      title={`“${term}”`}
      subtitle={
        offline ? (
          <span>
            <span className="font-ethiopic font-semibold text-amber-600 dark:text-amber-400">ተማሪ</span> Offline Draft Explanation
          </span>
        ) : (
          <span>
            <span className="font-ethiopic font-semibold text-amber-600 dark:text-amber-400">ተማሪ</span> Concept Explanation
          </span>
        )
      }
      icon={<Sparkles className="w-5 h-5" />}
      iconClassName="bg-amber-500/10 text-amber-600 dark:text-amber-400"
      maxWidthClassName="max-w-lg"
      originRef={originRef}
    >
      <div className="space-y-4">
        {loading && <GenerationProgress kind="explanation" detail={`Term: “${term}”`} />}

        {error && (
          <div className="p-4 bg-rose-500/10 border border-rose-500/20 rounded-xl text-xs font-medium text-rose-700 dark:text-rose-400">
            {error}
          </div>
        )}

        {!loading && !error && explanation && (
          <div className="space-y-4">
            {/* Offline output must be identifiable, not just implied by the
                subtitle (CONTEXT.md: Offline generation). */}
            {offline && (
              <OfflineBanner
                what="this explanation"
                fallback={offlineReason}
                onRetry={() => setAttempt((n) => n + 1)}
              />
            )}
            <div className="bg-muted/50 border border-border rounded-xl p-4 space-y-2">
              <p className="whitespace-pre-line text-sm text-foreground/90 leading-relaxed">{explanation}</p>
            </div>

            {links.length > 0 && (
              <div className="pt-2">
                <div className="flex items-center gap-2 text-[11px] font-medium uppercase tracking-wider text-muted-foreground mb-2">
                  <BookOpen className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                  <span>Curated Resources & Readings</span>
                </div>
                <div className="space-y-2">
                  {links.map((link, idx) => (
                    <a
                      key={idx}
                      href={link.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="block p-3 bg-background border border-border rounded-xl hover:bg-amber-500/5 hover:border-amber-500/30 transition-colors group"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-semibold text-foreground group-hover:text-amber-600 dark:group-hover:text-amber-400 transition-colors">
                          {link.title}
                        </span>
                        <ExternalLink className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                      </div>
                      {link.snippet && <p className="text-[11px] font-medium text-muted-foreground mt-1 line-clamp-2">{link.snippet}</p>}
                    </a>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        <div className="pt-3.5 border-t border-border flex justify-end">
          <ModalCloseButton variant="default">Done</ModalCloseButton>
        </div>
      </div>
    </Modal>
  );
};

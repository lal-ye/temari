import React, { useState, useEffect } from 'react';
import { Sparkles, ExternalLink, BookOpen } from 'lucide-react';
import { ai } from '../../services/ai';
import { Article } from '../../types';
import { Modal, type MorphOrigin } from '../ui/Modal';
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

  useEffect(() => {
    if (!term) return;

    let isMounted = true;
    setLoading(true);
    setError(null);
    setOffline(false);

    ai.explainTerm({ term, context })
      .then(({ source, value }) => {
        if (isMounted) {
          setExplanation(value.explanation);
          setLinks(value.relatedLinks || []);
          setOffline(source === 'offline');
          setLoading(false);
        }
      })
      .catch((err) => {
        if (isMounted) {
          setError(err.message || 'Failed to explain term');
          setLoading(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [term, context]);

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
              <OfflineBanner label="Offline draft. No AI Provider was reachable, so this explanation was assembled locally. Reconnect and regenerate for a full AI explanation." />
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
          <Button onClick={onClose}>Done</Button>
        </div>
      </div>
    </Modal>
  );
};

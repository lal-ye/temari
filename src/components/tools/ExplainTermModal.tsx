import React, { useState, useEffect } from 'react';
import { Sparkles, ExternalLink, X, BookOpen, Loader2 } from 'lucide-react';
import { AIService } from '../../services/aiService';
import { Article } from '../../types';

interface ExplainTermModalProps {
  term: string | null;
  context?: string;
  onClose: () => void;
}

export const ExplainTermModal: React.FC<ExplainTermModalProps> = ({ term, context, onClose }) => {
  const [loading, setLoading] = useState(false);
  const [explanation, setExplanation] = useState<string>('');
  const [links, setLinks] = useState<Article[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!term) return;

    let isMounted = true;
    setLoading(true);
    setError(null);

    AIService.explainTerm({ term, context })
      .then((res) => {
        if (isMounted) {
          setExplanation(res.explanation);
          setLinks(res.relatedLinks || []);
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-xs p-4 animate-in fade-in duration-150">
      <div className="w-full max-w-lg bg-white border-3 border-slate-900 rounded-2xl p-6 shadow-neo-xl relative max-h-[85vh] flex flex-col">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1.5 text-slate-700 hover:text-slate-950 rounded-xl hover:bg-slate-100 border-2 border-transparent hover:border-slate-900 transition-all"
          aria-label="Close"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="flex items-center gap-3 mb-4 shrink-0">
          <div className="p-2.5 bg-yellow-300 border-2 border-slate-900 text-slate-950 rounded-xl shadow-neo-sm">
            <Sparkles className="w-5 h-5" />
          </div>
          <div>
            <span className="px-2 py-0.5 bg-yellow-300 text-slate-950 border border-slate-900 rounded-md text-[10px] font-black uppercase tracking-wider shadow-xs">
              ተማሪ Concept Explanation
            </span>
            <h3 className="text-lg font-black text-slate-950 break-words leading-tight mt-1">&ldquo;{term}&rdquo;</h3>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto pr-1 space-y-4">
          {loading && (
            <div className="py-12 flex flex-col items-center justify-center text-slate-700 gap-3">
              <Loader2 className="w-8 h-8 animate-spin text-slate-950" />
              <p className="text-xs font-black">Generating student-friendly explanation...</p>
            </div>
          )}

          {error && (
            <div className="p-4 bg-rose-200 border-2 border-slate-900 rounded-xl text-xs font-black text-rose-950 shadow-neo-sm">
              {error}
            </div>
          )}

          {!loading && !error && explanation && (
            <div className="space-y-4 text-xs text-slate-800 leading-relaxed font-bold">
              <div className="bg-[#FAF8F5] border-2 border-slate-900 rounded-xl p-4 space-y-2 shadow-neo-sm">
                <p className="whitespace-pre-line text-slate-900">{explanation}</p>
              </div>

              {links.length > 0 && (
                <div className="pt-2">
                  <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-wider text-slate-700 mb-2">
                    <BookOpen className="w-4 h-4 text-cyan-800" />
                    <span>Curated Resources & Readings</span>
                  </div>
                  <div className="space-y-2">
                    {links.map((link, idx) => (
                      <a
                        key={idx}
                        href={link.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="block p-3 bg-white border-2 border-slate-900 rounded-xl hover:bg-yellow-50 transition-all shadow-neo-sm group"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-xs font-black text-slate-950 group-hover:text-cyan-800 transition-colors">
                            {link.title}
                          </span>
                          <ExternalLink className="w-3.5 h-3.5 text-slate-900 shrink-0" />
                        </div>
                        {link.snippet && <p className="text-[11px] font-bold text-slate-600 mt-1 line-clamp-2">{link.snippet}</p>}
                      </a>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="mt-4 pt-3.5 border-t-2 border-slate-200 flex justify-end shrink-0">
          <button
            onClick={onClose}
            className="px-5 py-2 text-xs font-black text-slate-950 bg-yellow-300 hover:bg-yellow-200 border-2 border-slate-900 rounded-xl shadow-neo transition-all active:translate-y-0.5"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};

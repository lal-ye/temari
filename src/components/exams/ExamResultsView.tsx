import React from 'react';
import { StoredAttempt } from '../../types';
import {
  CheckCircle2,
  XCircle,
  AlertTriangle,
  BookOpen,
  ExternalLink,
  RotateCcw,
  Sparkles,
} from 'lucide-react';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';

interface ExamResultsViewProps {
  attempt: StoredAttempt;
  onRetake?: () => void;
  onBack: () => void;
}

export const ExamResultsView: React.FC<ExamResultsViewProps> = ({ attempt, onRetake, onBack }) => {
  const isPassed = attempt.overallScore >= 70;

  return (
    <div className="max-w-4xl mx-auto space-y-5 animate-in fade-in duration-150">
      {/* Top Banner Card */}
      <div className="bg-card border border-border/80 rounded-2xl p-6 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-5">
        <div className="flex items-center gap-4 text-center md:text-left">
          <div
            className={`w-16 h-16 md:w-18 md:h-18 rounded-2xl border flex items-center justify-center shrink-0 shadow-xs ${
              isPassed
                ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-700 dark:text-emerald-400'
                : 'bg-amber-500/10 border-amber-500/20 text-amber-700 dark:text-amber-400'
            }`}
          >
            <span className="text-2xl font-semibold font-mono tabular-nums">{attempt.overallScore}%</span>
          </div>

          <div>
            <div className="flex items-center gap-2 justify-center md:justify-start flex-wrap">
              <Badge
                variant="secondary"
                className={`text-[10px] font-medium ${
                  isPassed
                    ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/20'
                    : 'bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/20'
                }`}
              >
                {isPassed ? 'PASSED' : 'NEEDS REVIEW'}
              </Badge>
              <span className="text-[11px] font-medium text-muted-foreground">
                {new Date(attempt.date).toLocaleDateString()}
              </span>
              {attempt.gradedOffline && (
                <Badge
                  variant="secondary"
                  className="text-[10px] font-medium bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/20"
                >
                  Graded offline
                </Badge>
              )}
            </div>
            <h1 className="font-editorial text-xl font-bold text-foreground tracking-tight mt-1.5">
              {attempt.name}
            </h1>
            <p className="text-xs font-medium text-muted-foreground mt-0.5">
              Subject: <strong className="text-foreground font-semibold">{attempt.subjectName}</strong> ·{' '}
              <span className="font-mono tabular-nums">
                {attempt.correctQuestions} of {attempt.totalQuestions}
              </span>{' '}
              questions correct
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {onRetake && (
            <Button variant="outline" onClick={onRetake}>
              <RotateCcw className="size-3.5" /> Retake Exam
            </Button>
          )}
          <Button variant="secondary" onClick={onBack}>
            Back to Exams
          </Button>
        </div>
      </div>

      {/* Topics to Review & Recommended Readings */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {/* Topics to Review */}
        <div className="bg-card border border-border/80 rounded-2xl p-5 shadow-xs space-y-3.5">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-rose-500/10 border border-rose-500/20 text-rose-700 dark:text-rose-400 rounded-lg shrink-0">
              <AlertTriangle className="w-4 h-4" />
            </div>
            <h3 className="text-sm font-semibold text-foreground">High Priority Topics to Review</h3>
          </div>

          {attempt.topicsToReview && attempt.topicsToReview.length > 0 ? (
            <div className="space-y-2 pt-1">
              {attempt.topicsToReview.map((topic, idx) => (
                <div
                  key={idx}
                  className="p-3 bg-rose-500/10 border border-rose-500/20 rounded-xl text-xs font-medium text-rose-700 dark:text-rose-400 flex items-center justify-between gap-2"
                >
                  <span>{topic}</span>
                  <span className="text-[10px] uppercase font-semibold px-2 py-0.5 bg-card border border-border rounded-md text-rose-700 dark:text-rose-400 shrink-0">
                    Review Suggested
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <div className="p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-xs font-medium text-emerald-700 dark:text-emerald-400 flex items-center gap-2.5">
              <CheckCircle2 className="w-5 h-5 shrink-0" />
              <span>Flawless performance! No major concept gaps detected.</span>
            </div>
          )}
        </div>

        {/* Curated Extra Readings */}
        <div className="bg-card border border-border/80 rounded-2xl p-5 shadow-xs space-y-3.5">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-amber-500/10 border border-amber-500/20 text-amber-700 dark:text-amber-400 rounded-lg shrink-0">
              <BookOpen className="w-4 h-4" />
            </div>
            <h3 className="text-sm font-semibold text-foreground">Curated Readings & Sources</h3>
          </div>

          <div className="space-y-2.5 pt-1">
            {attempt.extraReadings && attempt.extraReadings.length > 0 ? (
              attempt.extraReadings.map((article, idx) => (
                <a
                  key={idx}
                  href={article.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block p-3 bg-muted/40 hover:bg-amber-500/5 border border-border rounded-xl transition-colors group"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-semibold text-foreground group-hover:text-amber-600 dark:group-hover:text-amber-400 transition-colors line-clamp-1">
                      {article.title}
                    </span>
                    <ExternalLink className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                  </div>
                  {article.snippet && (
                    <p className="text-[11px] font-medium text-muted-foreground mt-1 line-clamp-1">{article.snippet}</p>
                  )}
                </a>
              ))
            ) : (
              <p className="text-xs font-medium text-muted-foreground">No additional readings required.</p>
            )}
          </div>
        </div>
      </div>

      {/* Detailed Question By Question Analysis */}
      {attempt.examResults && attempt.examResults.length > 0 && (
        <div className="bg-card border border-border/80 rounded-2xl p-6 shadow-xs space-y-4">
          <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-amber-600 dark:text-amber-400" /> Question Breakdown & Explanations
          </h3>

          <div className="space-y-4">
            {attempt.examResults.map((res, idx) => (
              <div
                key={idx}
                className={`p-4 border rounded-2xl ${
                  res.isCorrect
                    ? 'bg-emerald-500/[0.04] dark:bg-emerald-950/20 border-emerald-500/20'
                    : 'bg-rose-500/[0.04] dark:bg-rose-950/20 border-rose-500/20'
                }`}
              >
                <div className="flex items-start justify-between gap-3 mb-2.5">
                  <div className="flex items-center gap-2 min-w-0">
                    <span
                      className={`w-6 h-6 rounded-lg text-xs font-semibold flex items-center justify-center shrink-0 border ${
                        res.isCorrect
                          ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-700 dark:text-emerald-400'
                          : 'bg-rose-500/10 border-rose-500/20 text-rose-700 dark:text-rose-400'
                      }`}
                    >
                      {idx + 1}
                    </span>
                    <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider truncate">
                      {res.topic || 'General Concept'}
                    </span>
                  </div>

                  <span
                    className={`text-xs font-semibold flex items-center gap-1.5 shrink-0 ${
                      res.isCorrect
                        ? 'text-emerald-700 dark:text-emerald-400'
                        : 'text-rose-700 dark:text-rose-400'
                    }`}
                  >
                    {res.isCorrect ? (
                      <>
                        <CheckCircle2 className="w-4 h-4" /> Correct (+1)
                      </>
                    ) : (
                      <>
                        <XCircle className="w-4 h-4" /> Incorrect (0)
                      </>
                    )}
                  </span>
                </div>

                <p className="text-sm font-medium text-foreground mb-3 leading-relaxed">{res.question}</p>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs mb-3">
                  <div className="p-2.5 bg-card border border-border rounded-xl">
                    <span className="text-[10px] font-medium text-muted-foreground uppercase block">Your Answer:</span>
                    <span
                      className={`font-semibold ${
                        res.isCorrect
                          ? 'text-emerald-700 dark:text-emerald-400'
                          : 'text-rose-700 dark:text-rose-400'
                      }`}
                    >
                      {res.userAnswer || '(No answer provided)'}
                    </span>
                  </div>

                  <div className="p-2.5 bg-card border border-border rounded-xl">
                    <span className="text-[10px] font-medium text-muted-foreground uppercase block">Correct Answer:</span>
                    <span className="font-semibold text-foreground">{res.correctAnswer}</span>
                  </div>
                </div>

                {res.explanation && (
                  <div className="p-3 bg-muted/50 border border-border rounded-xl text-xs text-foreground/90 leading-relaxed font-medium">
                    <strong className="text-foreground font-semibold">Explanation:</strong> {res.explanation}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

import React from 'react';
import { StoredAttempt } from '../../types';
import {
  Award,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  BookOpen,
  ExternalLink,
  RotateCcw,
  Sparkles,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';

interface ExamResultsViewProps {
  attempt: StoredAttempt;
  onRetake?: () => void;
  onBack: () => void;
}

export const ExamResultsView: React.FC<ExamResultsViewProps> = ({ attempt, onRetake, onBack }) => {
  const isPassed = attempt.overallScore >= 70;

  return (
    <div className="max-w-4xl mx-auto space-y-6 animate-in fade-in duration-150">
      {/* Top Banner Card */}
      <div className="bg-white border-3 border-slate-900 rounded-2xl p-6 shadow-neo-md flex flex-col md:flex-row items-center justify-between gap-5">
        <div className="flex items-center gap-4 text-center md:text-left">
          <div
            className={`w-18 h-18 rounded-2xl border-3 border-slate-900 flex items-center justify-center shrink-0 shadow-neo-sm ${
              isPassed ? 'bg-emerald-300 text-slate-950' : 'bg-amber-300 text-slate-950'
            }`}
          >
            <span className="text-2xl font-black font-mono">{attempt.overallScore}%</span>
          </div>

          <div>
            <div className="flex items-center gap-2 justify-center md:justify-start">
              <span
                className={`px-2.5 py-0.5 rounded-lg border-2 border-slate-900 text-[10px] font-black uppercase shadow-xs ${
                  isPassed ? 'bg-emerald-300 text-slate-950' : 'bg-amber-300 text-slate-950'
                }`}
              >
                {isPassed ? 'PASSED' : 'NEEDS REVIEW'}
              </span>
              <span className="text-xs font-bold text-slate-500">{new Date(attempt.date).toLocaleDateString()}</span>
            </div>
            <h1 className="text-xl font-black text-slate-950 mt-1">{attempt.name}</h1>
            <p className="text-xs font-bold text-slate-600 mt-0.5">
              Subject: <strong className="text-cyan-800">{attempt.subjectName}</strong> • {attempt.correctQuestions} of{' '}
              {attempt.totalQuestions} questions correct
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          {onRetake && (
            <button
              onClick={onRetake}
              className="flex items-center gap-2 px-4 py-2 bg-yellow-300 hover:bg-yellow-200 text-slate-950 font-black text-xs rounded-xl border-2 border-slate-900 shadow-neo transition-all active:translate-y-0.5"
            >
              <RotateCcw className="w-4 h-4" /> Retake Exam
            </button>
          )}
          <button
            onClick={onBack}
            className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 font-black text-xs rounded-xl border-2 border-slate-900 shadow-neo-sm transition-all active:translate-y-0.5"
          >
            Back to Exams
          </button>
        </div>
      </div>

      {/* Topics to Review & Recommended Readings */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {/* Topics to Review */}
        <div className="bg-white border-3 border-slate-900 rounded-2xl p-5 shadow-neo space-y-3.5">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-rose-200 border-2 border-slate-900 text-slate-950 rounded-xl shadow-neo-sm">
              <AlertTriangle className="w-4 h-4" />
            </div>
            <h3 className="text-xs font-black text-slate-950 uppercase tracking-wider">
              High Priority Topics to Review
            </h3>
          </div>

          {attempt.topicsToReview && attempt.topicsToReview.length > 0 ? (
            <div className="space-y-2 pt-1">
              {attempt.topicsToReview.map((topic, idx) => (
                <div
                  key={idx}
                  className="p-3 bg-rose-100 border-2 border-slate-900 rounded-xl text-xs font-black text-rose-950 flex items-center justify-between shadow-neo-sm"
                >
                  <span>{topic}</span>
                  <span className="text-[10px] uppercase font-black px-2 py-0.5 bg-white border border-slate-900 rounded-md text-rose-900">
                    Review Suggested
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <div className="p-4 bg-emerald-200 border-2 border-slate-900 rounded-xl text-xs font-black text-emerald-950 flex items-center gap-2.5 shadow-neo-sm">
              <CheckCircle2 className="w-5 h-5 text-emerald-900 shrink-0" />
              <span>Flawless performance! No major concept gaps detected.</span>
            </div>
          )}
        </div>

        {/* Curated Extra Readings */}
        <div className="bg-white border-3 border-slate-900 rounded-2xl p-5 shadow-neo space-y-3.5">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-yellow-300 border-2 border-slate-900 text-slate-950 rounded-xl shadow-neo-sm">
              <BookOpen className="w-4 h-4" />
            </div>
            <h3 className="text-xs font-black text-slate-950 uppercase tracking-wider">
              Curated Readings & Sources
            </h3>
          </div>

          <div className="space-y-2.5 pt-1">
            {attempt.extraReadings && attempt.extraReadings.length > 0 ? (
              attempt.extraReadings.map((article, idx) => (
                <a
                  key={idx}
                  href={article.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block p-3 bg-[#FAF8F5] hover:bg-yellow-50 border-2 border-slate-900 rounded-xl transition-all shadow-neo-sm group"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-black text-slate-950 group-hover:text-cyan-800 transition-colors line-clamp-1">
                      {article.title}
                    </span>
                    <ExternalLink className="w-3.5 h-3.5 text-slate-900 shrink-0" />
                  </div>
                  {article.snippet && (
                    <p className="text-[11px] font-bold text-slate-600 mt-1 line-clamp-1">{article.snippet}</p>
                  )}
                </a>
              ))
            ) : (
              <p className="text-xs font-bold text-slate-500">No additional readings required.</p>
            )}
          </div>
        </div>
      </div>

      {/* Detailed Question By Question Analysis */}
      {attempt.examResults && attempt.examResults.length > 0 && (
        <div className="bg-white border-3 border-slate-900 rounded-2xl p-6 shadow-neo-md space-y-4">
          <h3 className="text-sm font-black text-slate-950 flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-yellow-500" /> Question Breakdown & Explanations
          </h3>

          <div className="space-y-4">
            {attempt.examResults.map((res, idx) => (
              <div
                key={idx}
                className={`p-4 border-2 border-slate-900 rounded-2xl transition-all shadow-neo-sm ${
                  res.isCorrect
                    ? 'bg-emerald-50/50'
                    : 'bg-rose-50/50'
                }`}
              >
                <div className="flex items-start justify-between gap-3 mb-2.5">
                  <div className="flex items-center gap-2">
                    <span
                      className={`w-6 h-6 rounded-lg text-xs font-black flex items-center justify-center shrink-0 border-2 border-slate-900 ${
                        res.isCorrect ? 'bg-emerald-300 text-slate-950' : 'bg-rose-300 text-slate-950'
                      }`}
                    >
                      {idx + 1}
                    </span>
                    <span className="text-[10px] font-black text-slate-600 uppercase tracking-wider">
                      {res.topic || 'General Concept'}
                    </span>
                  </div>

                  <span
                    className={`text-xs font-black flex items-center gap-1.5 ${
                      res.isCorrect ? 'text-emerald-800' : 'text-rose-800'
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

                <p className="text-xs font-black text-slate-950 mb-3 leading-relaxed">{res.question}</p>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs mb-3">
                  <div className="p-2.5 bg-white border-2 border-slate-900 rounded-xl shadow-xs">
                    <span className="text-[10px] font-black text-slate-500 uppercase block">Your Answer:</span>
                    <span
                      className={`font-black ${
                        res.isCorrect ? 'text-emerald-800' : 'text-rose-700'
                      }`}
                    >
                      {res.userAnswer || '(No answer provided)'}
                    </span>
                  </div>

                  <div className="p-2.5 bg-white border-2 border-slate-900 rounded-xl shadow-xs">
                    <span className="text-[10px] font-black text-slate-500 uppercase block">Correct Answer:</span>
                    <span className="font-black text-slate-950">{res.correctAnswer}</span>
                  </div>
                </div>

                {res.explanation && (
                  <div className="p-3 bg-[#FAF8F5] border-2 border-slate-900 rounded-xl text-xs text-slate-800 leading-relaxed font-bold shadow-xs">
                    <strong className="text-slate-950 font-black">Explanation:</strong> {res.explanation}
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

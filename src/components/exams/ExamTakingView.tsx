import React, { useState, useEffect, useRef } from 'react';
import { CognitiveMixId, ExamQuestion, ExamResult, Article, StoredAttempt } from '../../types';
import { ai, type FallbackReason } from '../../services/ai';
import { isAbortError } from '../../services/ai/isAbortError';
import { COGNITIVE_MIXES } from '../../services/examBlueprint';
import { BloomBadge } from '../ui/BloomBadge';
import {
  Clock,
  Flag,
  ChevronLeft,
  ChevronRight,
  CheckCircle2,
  Loader2,
} from 'lucide-react';
import { GenerationProgress } from '../ui/GenerationProgress';
import { confirm } from '../ui/confirm';
import { registerWorkInProgress } from '../ui/workInProgress';
import { Button } from '../ui/button';
import { fireConfetti } from '../../utils/confetti';

interface ExamTakingViewProps {
  examTitle: string;
  subjectName: string;
  subjectId: string;
  questions: ExamQuestion[];
  timeLimitMinutes?: number;
  offlineDraft?: boolean;
  /** Why the Provider was not used, when `offlineDraft` is set. */
  offlineReason?: FallbackReason;
  /** Which Bloom distribution this exam was generated with, recorded on the Attempt. */
  cognitiveMix?: CognitiveMixId;
  /** True when questions were written against extracted Knowledge Units. */
  knowledgeUnitTargeted?: boolean;
  onCompleted: (attempt: Omit<StoredAttempt, 'id' | 'date'>) => void;
  onCancel: () => void;
}

/** Shared answer-surface treatment, so choice, true/false and short answer feel like one control family. */
const optionBase =
  'w-full text-left rounded-xl border transition-colors focus-visible:ring-2 focus-visible:ring-ring/50 outline-hidden';
const optionIdle = 'bg-background border-border/80 hover:bg-muted/50 hover:border-border text-foreground';
const optionChosen = 'bg-amber-500/10 border-amber-500/40 text-foreground';

export const ExamTakingView: React.FC<ExamTakingViewProps> = ({
  examTitle,
  subjectName,
  subjectId,
  questions,
  timeLimitMinutes = 20,
  offlineDraft,
  offlineReason,
  cognitiveMix,
  knowledgeUnitTargeted,
  onCompleted,
  onCancel,
}) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<string[]>(() => new Array(questions.length).fill(''));
  const [flagged, setFlagged] = useState<boolean[]>(() => new Array(questions.length).fill(false));
  const [timeLeft, setTimeLeft] = useState<number>(timeLimitMinutes * 60);
  const [isGrading, setIsGrading] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  /**
   * The one and only "already submitted" latch. `handleSubmitExam` owns it;
   * the countdown and the Submit button both go through that function.
   *
   * There used to be a second copy of this guard in the countdown path,
   * which set the latch *before* calling `handleSubmitExam` — whose first
   * line then saw the latch and returned. Time expiry submitted nothing,
   * and every manual Submit afterwards was swallowed too: the learner sat
   * on a 00:00 exam with a button that did nothing.
   */
  const submittedRef = useRef(false);
  const submitRef = useRef<() => void>(() => {});
  /** Grading in flight; aborted on unmount so a stale result never records. */
  const gradingRef = useRef<AbortController | null>(null);

  const currentQ = questions[currentIndex];

  // Keep the latest submit handler (fresh answers) available to the countdown.
  useEffect(() => {
    submitRef.current = () => {
      void handleSubmitExam();
    };
  });

  useEffect(() => () => gradingRef.current?.abort(), []);

  // While the exam is live, hub navigation asks before unmounting it and the
  // browser asks before unloading the tab. Grading counts too: the answers
  // are in flight and a hub switch would drop the result.
  useEffect(() => registerWorkInProgress('exam', 'your exam'), []);

  useEffect(() => {
    timerRef.current = setInterval(() => {
      setTimeLeft((prev) => (prev > 0 ? prev - 1 : prev));
    }, 1000);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  // When time expires, submit with the answers the student actually gave.
  useEffect(() => {
    if (timeLeft <= 0) {
      submitRef.current();
    }
  }, [timeLeft]);

  const handleSelectAnswer = (ans: string) => {
    const updated = [...answers];
    updated[currentIndex] = ans;
    setAnswers(updated);
  };

  const toggleFlag = () => {
    const updated = [...flagged];
    updated[currentIndex] = !updated[currentIndex];
    setFlagged(updated);
  };

  const handleSubmitExam = async () => {
    if (submittedRef.current) return;
    submittedRef.current = true;
    if (timerRef.current) clearInterval(timerRef.current);
    setIsGrading(true);

    const controller = new AbortController();
    gradingRef.current = controller;

    try {
      const { source: gradeSource, value: grading } = await ai.gradeExam({
        exam: questions,
        userAnswers: answers,
        signal: controller.signal,
      });
      if (controller.signal.aborted) return;

      const correctCount = grading.results.filter((r) => r.isCorrect).length;
      const attempt: Omit<StoredAttempt, 'id' | 'date'> = {
        subjectId,
        subjectName,
        name: examTitle,
        type: 'Exam',
        gradedOffline: gradeSource === 'offline',
        timeSpentSeconds: timeLimitMinutes * 60 - timeLeft,
        overallScore: grading.overallScore,
        totalQuestions: questions.length,
        correctQuestions: correctCount,
        topicsToReview: grading.topicsToReview,
        extraReadings: grading.extraReadings,
        examQuestions: questions,
        examResults: grading.results,
        cognitiveMix,
        knowledgeUnitTargeted,
      };

      if (grading.overallScore >= 70) {
        fireConfetti({ particleCount: 75 });
      }

      onCompleted(attempt);
    } catch (err) {
      // Unmounted mid-grade (hub switch, Subject switch): nothing to record.
      if (controller.signal.aborted || isAbortError(err)) return;
      console.error('Grading error:', err);
      // Last-resort local grading, for when even the offline adapter threw.
      const results: ExamResult[] = questions.map((q, idx) => ({
        question: q.question,
        type: q.type,
        correctAnswer: q.correctAnswer,
        userAnswer: answers[idx] || '(Unanswered)',
        isCorrect: answers[idx]?.trim().toLowerCase() === q.correctAnswer.toLowerCase(),
        explanation: q.explanation || `Correct answer is: ${q.correctAnswer}`,
        topic: q.topic,
        // Carried from the question so a locally graded attempt still feeds the
        // topic x level mastery grid instead of silently dropping out of it.
        bloomLevel: q.bloomLevel,
        knowledgeUnitId: q.knowledgeUnitId,
      }));

      const correctCount = results.filter((r) => r.isCorrect).length;
      const score = Math.round((correctCount / questions.length) * 100);

      const attempt: Omit<StoredAttempt, 'id' | 'date'> = {
        subjectId,
        subjectName,
        name: examTitle,
        type: 'Exam',
        gradedOffline: true,
        timeSpentSeconds: timeLimitMinutes * 60 - timeLeft,
        overallScore: score,
        totalQuestions: questions.length,
        correctQuestions: correctCount,
        topicsToReview: Array.from(new Set(results.filter((r) => !r.isCorrect).map((r) => r.topic))),
        examQuestions: questions,
        examResults: results,
        cognitiveMix,
        knowledgeUnitTargeted,
      };

      onCompleted(attempt);
    } finally {
      if (gradingRef.current === controller) gradingRef.current = null;
      if (!controller.signal.aborted) setIsGrading(false);
    }
  };

  const minutes = Math.floor(timeLeft / 60);
  const seconds = timeLeft % 60;
  const formattedTime = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  const answeredCount = answers.filter((a) => a.trim() !== '').length;
  const lowOnTime = timeLeft < 180;

  if (isGrading) {
    return (
      <div className="bg-card border border-border/80 rounded-2xl p-10 shadow-xs max-w-lg mx-auto space-y-5 text-center">
        <div className="w-14 h-14 bg-amber-500/10 border border-amber-500/20 rounded-2xl flex items-center justify-center mx-auto text-amber-600 dark:text-amber-400">
          <Loader2 className="w-7 h-7 animate-spin" />
        </div>
        <h3 className="font-editorial text-2xl font-bold text-foreground tracking-tight">
          ተማሪ AI is Grading Your Exam
        </h3>
        <GenerationProgress
          kind="grading"
          detail={`${answeredCount} of ${questions.length} questions answered.`}
        />
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Header with Timer and Progress */}
      <div className="bg-card border border-border/80 rounded-2xl p-5 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="px-2 py-0.5 bg-amber-100 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400 border border-border rounded text-[10px] font-semibold uppercase tracking-wider">
              {subjectName}
            </span>
            {offlineDraft && (
              <span
                title={`${
                  offlineReason ? `${offlineReason.provider}: ${offlineReason.title}. ` : ''
                }Offline drafts are built by extracting sentences, which cannot produce analysis or synthesis questions. Every item here tests recall.`}
                className="px-2 py-0.5 bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/20 rounded text-[10px] font-semibold uppercase tracking-wider"
              >
                Offline draft · recall only
              </span>
            )}
            {cognitiveMix && (
              <span className="px-2 py-0.5 bg-muted/60 text-muted-foreground border border-border rounded text-[10px] font-semibold uppercase tracking-wider">
                {COGNITIVE_MIXES[cognitiveMix].label}
              </span>
            )}
          </div>
          <h2 className="font-editorial text-xl font-bold text-foreground tracking-tight leading-tight mt-1.5">
            {examTitle}
          </h2>
          <span className="text-xs font-medium text-muted-foreground">
            Answered:{' '}
            <strong className="text-amber-600 dark:text-amber-400 font-semibold font-mono tabular-nums">
              {answeredCount}
            </strong>{' '}
            of <span className="font-mono tabular-nums">{questions.length}</span> questions
          </span>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          <div
            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl border font-mono font-semibold text-sm tabular-nums ${
              lowOnTime
                ? 'bg-rose-500/10 border-rose-500/30 text-rose-700 dark:text-rose-400 animate-pulse'
                : 'bg-muted/60 border-border text-foreground'
            }`}
          >
            <Clock className="w-4 h-4" aria-hidden="true" />
            <span role="timer">{formattedTime}</span>
          </div>

          <Button
            variant="outline"
            onClick={async () => {
              const ok = await confirm({
                title: 'Leave this exam?',
                body: 'Your answers are discarded and nothing is recorded. The questions stay on the original Attempt, so you can retake it later.',
                confirmLabel: 'Leave exam',
                cancelLabel: 'Keep going',
                danger: true,
              });
              if (ok) onCancel();
            }}
          >
            Leave
          </Button>

          <Button
            onClick={async () => {
              const answered = answers.filter((a) => a && a.trim()).length;
              const unanswered = questions.length - answered;
              const ok = await confirm({
                title: 'Submit the Exam?',
                body:
                  unanswered > 0
                    ? `${unanswered} of ${questions.length} questions are unanswered and will be marked wrong. Your answers are graded and recorded as an Attempt.`
                    : 'Your answers are graded and recorded as an Attempt. You cannot return to the questions afterwards.',
                confirmLabel: 'Submit Exam',
                // Submitting is what the learner just asked for; Enter should
                // do that, not land on the dialog's Close button.
                initialFocus: 'confirm',
              });
              if (ok) handleSubmitExam();
            }}
          >
            <CheckCircle2 className="size-4" />
            Submit Exam
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        {/* Main Question Card */}
        <div className="lg:col-span-8 bg-card border border-border/80 rounded-2xl p-6 shadow-xs space-y-6">
          <div className="flex items-center justify-between pb-4 border-b border-border gap-3">
            <div className="flex items-center gap-2 min-w-0">
              <span className="px-2.5 py-1 bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/20 rounded-lg text-xs font-semibold whitespace-nowrap">
                Question {currentIndex + 1}
              </span>
              <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider truncate">
                {currentQ.topic || 'General Knowledge'}
              </span>
              {/* Tells the learner why a question felt hard, so they can
                  self-calibrate instead of blaming the subject. */}
              <BloomBadge level={currentQ.bloomLevel} />
            </div>

            <Button
              variant={flagged[currentIndex] ? 'secondary' : 'outline'}
              size="sm"
              onClick={toggleFlag}
              className={
                flagged[currentIndex]
                  ? 'bg-amber-500/10 border-amber-500/30 text-amber-700 dark:text-amber-400'
                  : undefined
              }
            >
              <Flag className={`size-3.5 ${flagged[currentIndex] ? 'fill-current' : ''}`} />
              {flagged[currentIndex] ? 'Flagged' : 'Flag for Review'}
            </Button>
          </div>

          <div>
            <h3 className="text-base md:text-lg font-semibold text-foreground leading-relaxed mb-5">
              {currentQ.question}
            </h3>

            {/* Multiple Choice Options */}
            {currentQ.type === 'multiple_choice' && currentQ.options && (
              <div className="space-y-3">
                {currentQ.options.map((opt, optIdx) => {
                  const isSelected = answers[currentIndex] === opt;
                  const letter = String.fromCharCode(65 + optIdx);
                  return (
                    <button
                      key={optIdx}
                      type="button"
                      onClick={() => handleSelectAnswer(opt)}
                      aria-pressed={isSelected}
                      className={`${optionBase} p-3.5 text-sm font-medium flex items-center gap-3 ${
                        isSelected ? optionChosen : optionIdle
                      }`}
                    >
                      <span
                        className={`w-6 h-6 rounded-lg border flex items-center justify-center text-xs shrink-0 font-semibold ${
                          isSelected
                            ? 'bg-amber-500 border-amber-500 text-white'
                            : 'bg-muted border-border text-foreground'
                        }`}
                      >
                        {letter}
                      </span>
                      <span className="flex-1 leading-normal">{opt}</span>
                    </button>
                  );
                })}
              </div>
            )}

            {/* True / False */}
            {currentQ.type === 'true_false' && (
              <div className="grid grid-cols-2 gap-4">
                {['true', 'false'].map((val) => {
                  const isSelected = answers[currentIndex].toLowerCase() === val;
                  return (
                    <button
                      key={val}
                      type="button"
                      onClick={() => handleSelectAnswer(val)}
                      aria-pressed={isSelected}
                      className={`${optionBase} p-4 text-center text-xs font-semibold uppercase ${
                        isSelected ? optionChosen : optionIdle
                      }`}
                    >
                      {val === 'true' ? 'True' : 'False'}
                    </button>
                  );
                })}
              </div>
            )}

            {/* Short Answer */}
            {currentQ.type === 'short_answer' && (
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-foreground mb-1">
                  Your Explanation / Answer:
                </label>
                <textarea
                  rows={4}
                  value={answers[currentIndex]}
                  onChange={(e) => handleSelectAnswer(e.target.value)}
                  placeholder="Type your response here..."
                  className="w-full p-3.5 text-sm bg-background border border-border rounded-xl font-medium leading-relaxed focus:outline-hidden focus:ring-2 focus:ring-ring/50 shadow-2xs"
                />
              </div>
            )}
          </div>

          {/* Navigation footer */}
          <div className="flex items-center justify-between pt-4 border-t border-border">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setCurrentIndex((i) => Math.max(0, i - 1))}
              disabled={currentIndex === 0}
            >
              <ChevronLeft className="size-3.5" /> Previous
            </Button>

            <span className="text-xs font-medium text-muted-foreground font-mono tabular-nums">
              {currentIndex + 1} / {questions.length}
            </span>

            <Button
              variant="secondary"
              size="sm"
              onClick={() => setCurrentIndex((i) => Math.min(questions.length - 1, i + 1))}
              disabled={currentIndex === questions.length - 1}
            >
              Next <ChevronRight className="size-3.5" />
            </Button>
          </div>
        </div>

        {/* Question Palette / Navigator */}
        <div className="lg:col-span-4 bg-card border border-border/80 rounded-2xl p-5 shadow-xs space-y-4">
          <h4 className="text-sm font-semibold text-foreground">Question Palette</h4>

          <div className="grid grid-cols-5 gap-2">
            {questions.map((_, idx) => {
              const isAnswered = answers[idx]?.trim() !== '';
              const isFlagged = flagged[idx];
              const isCurrent = currentIndex === idx;

              return (
                <button
                  key={idx}
                  onClick={() => setCurrentIndex(idx)}
                  aria-label={`Go to question ${idx + 1}${isAnswered ? ' (answered)' : ''}${isFlagged ? ' (flagged)' : ''}`}
                  aria-current={isCurrent ? 'true' : undefined}
                  className={`h-9 rounded-xl text-xs font-semibold border transition-colors relative outline-hidden focus-visible:ring-2 focus-visible:ring-ring/50 ${
                    isFlagged
                      ? 'bg-amber-500/10 border-amber-500/30 text-amber-700 dark:text-amber-400'
                      : isAnswered
                      ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-700 dark:text-emerald-400'
                      : 'bg-muted/50 border-border text-muted-foreground hover:bg-muted hover:text-foreground'
                  } ${isCurrent ? 'ring-2 ring-amber-500/50 ring-offset-1 ring-offset-card' : ''}`}
                >
                  {idx + 1}
                  {isFlagged && (
                    <span className="w-2 h-2 bg-rose-500 rounded-full absolute top-1 right-1" aria-hidden="true" />
                  )}
                </button>
              );
            })}
          </div>

          <div className="pt-3 border-t border-border space-y-2 text-xs font-medium text-muted-foreground">
            <div className="flex items-center gap-2">
              <span className="w-3.5 h-3.5 bg-emerald-500/10 border border-emerald-500/30 rounded-md" aria-hidden="true" />
              <span>Answered</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-3.5 h-3.5 bg-amber-500/10 border border-amber-500/30 rounded-md" aria-hidden="true" />
              <span>Flagged for Review</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-3.5 h-3.5 bg-muted/50 border border-border rounded-md" aria-hidden="true" />
              <span>Unanswered</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

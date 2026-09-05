import React, { useState, useEffect, useRef } from 'react';
import { ExamQuestion, ExamResult, Article, StoredAttempt } from '../../types';
import { ai } from '../../services/ai';
import {
  Clock,
  Flag,
  ChevronLeft,
  ChevronRight,
  CheckCircle,
  AlertCircle,
  Loader2,
  HelpCircle,
} from 'lucide-react';
import { GenerationProgress } from '../ui/GenerationProgress';
import { fireConfetti } from '../../utils/confetti';

interface ExamTakingViewProps {
  examTitle: string;
  subjectName: string;
  subjectId: string;
  questions: ExamQuestion[];
  timeLimitMinutes?: number;
  offlineDraft?: boolean;
  onCompleted: (attempt: Omit<StoredAttempt, 'id' | 'date'>) => void;
  onCancel: () => void;
}

export const ExamTakingView: React.FC<ExamTakingViewProps> = ({
  examTitle,
  subjectName,
  subjectId,
  questions,
  timeLimitMinutes = 20,
  offlineDraft,
  onCompleted,
  onCancel,
}) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<string[]>(() => new Array(questions.length).fill(''));
  const [flagged, setFlagged] = useState<boolean[]>(() => new Array(questions.length).fill(false));
  const [timeLeft, setTimeLeft] = useState<number>(timeLimitMinutes * 60);
  const [isGrading, setIsGrading] = useState(false);
  const timerRef = useRef<any>(null);
  // Guards so an exam is only ever submitted once — including when the
  // countdown expires while the user has unanswered questions.
  const submittedRef = useRef(false);
  const submitRef = useRef<() => void>(() => {});

  const currentQ = questions[currentIndex];

  // Keep the latest submit handler (fresh answers) available to the countdown.
  useEffect(() => {
    submitRef.current = () => {
      if (submittedRef.current || isGrading) return;
      submittedRef.current = true;
      void handleSubmitExam();
    };
  });

  useEffect(() => {
    timerRef.current = setInterval(() => {
      setTimeLeft((prev) => (prev > 0 ? prev - 1 : prev));
    }, 1000);

    return () => clearInterval(timerRef.current);
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
    if (submittedRef.current || isGrading) return;
    submittedRef.current = true;
    clearInterval(timerRef.current);
    setIsGrading(true);

    try {
      const { source: gradeSource, value: grading } = await ai.gradeExam({
        exam: questions,
        userAnswers: answers,
      });

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
      };

      if (grading.overallScore >= 70) {
        fireConfetti({ particleCount: 75 });
      }

      onCompleted(attempt);
    } catch (err) {
      console.error('Grading error:', err);
      // Fallback local grading
      const results: ExamResult[] = questions.map((q, idx) => ({
        question: q.question,
        type: q.type,
        correctAnswer: q.correctAnswer,
        userAnswer: answers[idx] || '(Unanswered)',
        isCorrect: answers[idx]?.trim().toLowerCase() === q.correctAnswer.toLowerCase(),
        explanation: q.explanation || `Correct answer is: ${q.correctAnswer}`,
        topic: q.topic,
      }));

      const correctCount = results.filter((r) => r.isCorrect).length;
      const score = Math.round((correctCount / questions.length) * 100);

      const attempt: Omit<StoredAttempt, 'id' | 'date'> = {
        subjectId,
        subjectName,
        name: examTitle,
        type: 'Exam',
        overallScore: score,
        totalQuestions: questions.length,
        correctQuestions: correctCount,
        topicsToReview: ['Key Principles Review'],
        examQuestions: questions,
        examResults: results,
      };

      onCompleted(attempt);
    } finally {
      setIsGrading(false);
    }
  };

  const minutes = Math.floor(timeLeft / 60);
  const seconds = timeLeft % 60;
  const formattedTime = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  const answeredCount = answers.filter((a) => a.trim() !== '').length;

  if (isGrading) {
    return (
      <div className="bg-white border-3 border-slate-900 rounded-2xl p-10 shadow-neo-xl max-w-lg mx-auto space-y-4">
        <h3 className="section-heading text-slate-950 text-center">
          <span className="font-ethiopic font-bold text-yellow-600">ተማሪ</span> AI is Grading Your Exam
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
      <div className="bg-white border-3 border-slate-900 rounded-2xl p-5 shadow-neo-md flex flex-col md:flex-row items-center justify-between gap-4">
        <div>
          <span className="px-2 py-0.5 bg-yellow-300 text-slate-950 border border-slate-900 rounded-md text-[10px] font-black uppercase tracking-wider shadow-xs">
            {subjectName}
          </span>
          {offlineDraft && (
            <span className="ml-1 px-2 py-0.5 bg-amber-200 text-amber-950 border border-slate-900 rounded-md text-[10px] font-black uppercase tracking-wider shadow-xs">
              Offline draft questions
            </span>
          )}
          <h2 className="text-lg font-black text-slate-950 leading-tight mt-1">{examTitle}</h2>
          <span className="text-xs font-bold text-slate-600">
            Answered: <strong className="text-cyan-800 font-black">{answeredCount}</strong> of {questions.length} questions
          </span>
        </div>

        <div className="flex items-center gap-3">
          <div
            className={`flex items-center gap-2 px-4 py-2 rounded-xl border-2 border-slate-900 font-mono font-black text-sm shadow-neo-sm ${
              timeLeft < 180 ? 'bg-rose-300 text-slate-950 animate-pulse' : 'bg-yellow-300 text-slate-950'
            }`}
          >
            <Clock className="w-4 h-4" />
            <span>{formattedTime}</span>
          </div>

          <button
            onClick={() => {
              if (confirm('Submit exam now and generate your AI score breakdown?')) {
                handleSubmitExam();
              }
            }}
            className="px-5 py-2.5 bg-emerald-300 hover:bg-emerald-200 text-slate-950 font-black text-xs rounded-xl border-2 border-slate-900 shadow-neo transition-all active:translate-y-0.5"
          >
            Submit Exam
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Main Question Card */}
        <div className="lg:col-span-8 bg-white border-3 border-slate-900 rounded-2xl p-6 shadow-neo-lg space-y-6">
          <div className="flex items-center justify-between pb-4 border-b-2 border-slate-200">
            <div className="flex items-center gap-2">
              <span className="px-3 py-1 bg-slate-950 text-white rounded-lg text-xs font-black">
                Question {currentIndex + 1}
              </span>
              <span className="text-xs font-black text-slate-600 uppercase tracking-wider">
                {currentQ.topic || 'General Knowledge'}
              </span>
            </div>

            <button
              onClick={toggleFlag}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-black border-2 border-slate-900 transition-all shadow-neo-sm active:translate-y-0.5 ${
                flagged[currentIndex]
                  ? 'bg-amber-300 text-slate-950'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              <Flag className="w-3.5 h-3.5 fill-current" />
              {flagged[currentIndex] ? 'Flagged' : 'Flag for Review'}
            </button>
          </div>

          <div>
            <h3 className="text-base md:text-lg font-black text-slate-950 leading-relaxed mb-5">
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
                      className={`w-full p-3.5 text-left text-xs font-bold rounded-xl border-2 border-slate-900 flex items-center gap-3 transition-all ${
                        isSelected
                          ? 'bg-yellow-300 text-slate-950 shadow-neo font-black'
                          : 'bg-[#FAF8F5] hover:bg-slate-100 text-slate-800 shadow-neo-sm'
                      }`}
                    >
                      <span
                        className={`w-6 h-6 rounded-lg border-2 border-slate-900 flex items-center justify-center text-xs shrink-0 font-black ${
                          isSelected ? 'bg-slate-950 text-white' : 'bg-white text-slate-900'
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
                      className={`p-4 text-center text-xs font-black rounded-xl border-2 border-slate-900 transition-all uppercase ${
                        isSelected
                          ? 'bg-yellow-300 text-slate-950 shadow-neo'
                          : 'bg-[#FAF8F5] hover:bg-slate-100 text-slate-800 shadow-neo-sm'
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
                <label className="block text-xs font-black uppercase tracking-wider text-slate-800 mb-1">
                  Your Explanation / Answer:
                </label>
                <textarea
                  rows={4}
                  value={answers[currentIndex]}
                  onChange={(e) => handleSelectAnswer(e.target.value)}
                  placeholder="Type your response here..."
                  className="w-full p-3.5 text-xs bg-[#FAF8F5] border-2 border-slate-900 rounded-xl font-bold focus:outline-hidden focus:ring-2 focus:ring-amber-400 leading-relaxed shadow-neo-sm"
                />
              </div>
            )}
          </div>

          {/* Navigation footer */}
          <div className="flex items-center justify-between pt-4 border-t-2 border-slate-200">
            <button
              onClick={() => setCurrentIndex((i) => Math.max(0, i - 1))}
              disabled={currentIndex === 0}
              className="flex items-center gap-1 px-4 py-2 bg-white hover:bg-slate-100 border-2 border-slate-900 rounded-xl text-xs font-black text-slate-900 disabled:opacity-40 transition-all shadow-neo-sm active:translate-y-0.5"
            >
              <ChevronLeft className="w-4 h-4" /> Previous
            </button>

            <span className="text-xs font-black text-slate-700">
              {currentIndex + 1} / {questions.length}
            </span>

            <button
              onClick={() => setCurrentIndex((i) => Math.min(questions.length - 1, i + 1))}
              disabled={currentIndex === questions.length - 1}
              className="flex items-center gap-1 px-4 py-2 bg-white hover:bg-slate-100 border-2 border-slate-900 rounded-xl text-xs font-black text-slate-900 disabled:opacity-40 transition-all shadow-neo-sm active:translate-y-0.5"
            >
              Next <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Question Palette / Navigator */}
        <div className="lg:col-span-4 bg-white border-3 border-slate-900 rounded-2xl p-5 shadow-neo-md space-y-4">
          <h4 className="text-xs font-black uppercase tracking-wider text-slate-900">Question Palette</h4>

          <div className="grid grid-cols-5 gap-2">
            {questions.map((_, idx) => {
              const isAnswered = answers[idx]?.trim() !== '';
              const isFlagged = flagged[idx];
              const isCurrent = currentIndex === idx;

              return (
                <button
                  key={idx}
                  onClick={() => setCurrentIndex(idx)}
                  className={`h-9 rounded-xl text-xs font-black border-2 border-slate-900 transition-all relative ${
                    isCurrent
                      ? 'ring-2 ring-slate-950 scale-105 shadow-neo-sm'
                      : ''
                  } ${
                    isFlagged
                      ? 'bg-amber-300 text-slate-950'
                      : isAnswered
                      ? 'bg-yellow-300 text-slate-950'
                      : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                  }`}
                >
                  {idx + 1}
                  {isFlagged && (
                    <span className="w-2 h-2 bg-rose-600 rounded-full border border-slate-900 absolute top-1 right-1" />
                  )}
                </button>
              );
            })}
          </div>

          <div className="pt-3 border-t-2 border-slate-200 space-y-2 text-xs font-bold text-slate-700">
            <div className="flex items-center gap-2">
              <span className="w-3.5 h-3.5 bg-yellow-300 border border-slate-900 rounded-md" />
              <span>Answered</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-3.5 h-3.5 bg-amber-300 border border-slate-900 rounded-md" />
              <span>Flagged for Review</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-3.5 h-3.5 bg-slate-100 border border-slate-900 rounded-md" />
              <span>Unanswered</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

import React, { useState, useEffect } from 'react';
import { Flashcard } from '../../types';
import {
  RotateCw,
  ChevronLeft,
  ChevronRight,
  Shuffle,
  Sparkles,
  CheckCircle2,
  XCircle,
  Award,
  BookOpen,
  HelpCircle,
} from 'lucide-react';
import confetti from 'canvas-confetti';

interface FlashcardViewProps {
  quizName: string;
  flashcards: Flashcard[];
  onFinish?: (score: number, masteredCount: number) => void;
  onHighlightTerm?: (term: string, context?: string) => void;
  onClose: () => void;
}

export const FlashcardView: React.FC<FlashcardViewProps> = ({
  quizName,
  flashcards,
  onFinish,
  onHighlightTerm,
  onClose,
}) => {
  const [cards, setCards] = useState<Flashcard[]>(flashcards);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [masteredIds, setMasteredIds] = useState<Set<string>>(new Set());
  const [reviewIds, setReviewIds] = useState<Set<string>>(new Set());
  const [selectedText, setSelectedText] = useState<string | null>(null);
  const [isComplete, setIsComplete] = useState(false);

  const currentCard = cards[currentIndex];

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (isComplete) return;
      if (e.code === 'Space' || e.code === 'Enter') {
        e.preventDefault();
        setIsFlipped((f) => !f);
      } else if (e.code === 'ArrowRight') {
        e.preventDefault();
        handleNext();
      } else if (e.code === 'ArrowLeft') {
        e.preventDefault();
        handlePrev();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentIndex, isComplete, cards.length]);

  const handleNext = () => {
    setIsFlipped(false);
    setSelectedText(null);
    if (currentIndex < cards.length - 1) {
      setCurrentIndex((i) => i + 1);
    } else {
      finishDrill();
    }
  };

  const handlePrev = () => {
    setIsFlipped(false);
    setSelectedText(null);
    if (currentIndex > 0) {
      setCurrentIndex((i) => i - 1);
    }
  };

  const handleShuffle = () => {
    const shuffled = [...cards].sort(() => Math.random() - 0.5);
    setCards(shuffled);
    setCurrentIndex(0);
    setIsFlipped(false);
    setSelectedText(null);
  };

  const markMastered = () => {
    if (!currentCard) return;
    setMasteredIds((prev) => {
      const next = new Set(prev);
      next.add(currentCard.id);
      return next;
    });
    setReviewIds((prev) => {
      const next = new Set(prev);
      next.delete(currentCard.id);
      return next;
    });
    handleNext();
  };

  const markNeedReview = () => {
    if (!currentCard) return;
    setReviewIds((prev) => {
      const next = new Set(prev);
      next.add(currentCard.id);
      return next;
    });
    setMasteredIds((prev) => {
      const next = new Set(prev);
      next.delete(currentCard.id);
      return next;
    });
    handleNext();
  };

  const finishDrill = () => {
    setIsComplete(true);
    const score = Math.round((masteredIds.size / Math.max(1, cards.length)) * 100);
    if (score >= 70) {
      confetti({ particleCount: 60, spread: 70, origin: { y: 0.6 } });
    }
    if (onFinish) {
      onFinish(score, masteredIds.size);
    }
  };

  const handleSelection = () => {
    const selection = window.getSelection();
    if (!selection) return;
    const text = selection.toString().trim();
    if (text && text.length > 1 && text.length < 50) {
      setSelectedText(text);
    } else {
      setSelectedText(null);
    }
  };

  if (isComplete) {
    const score = Math.round((masteredIds.size / Math.max(1, cards.length)) * 100);
    return (
      <div className="bg-white border-3 border-slate-900 rounded-2xl p-6 shadow-neo-xl text-center max-w-xl mx-auto space-y-5 animate-in zoom-in-95 duration-150">
        <div className="w-14 h-14 bg-yellow-300 border-2 border-slate-900 rounded-2xl flex items-center justify-center mx-auto text-slate-950 shadow-neo-sm">
          <Award className="w-7 h-7" />
        </div>

        <div>
          <span className="px-2.5 py-0.5 bg-yellow-300 text-slate-950 border border-slate-900 rounded-md text-[10px] font-black uppercase tracking-wider shadow-xs">
            Quiz Completed
          </span>
          <h2 className="text-2xl font-black text-slate-950 mt-2">{quizName}</h2>
        </div>

        <div className="grid grid-cols-3 gap-3 p-4 bg-[#FAF8F5] border-2 border-slate-900 rounded-xl shadow-neo-sm">
          <div>
            <span className="text-[11px] font-bold text-slate-600 uppercase">Mastery Score</span>
            <p className="text-2xl font-black text-cyan-800">{score}%</p>
          </div>
          <div>
            <span className="text-[11px] font-bold text-slate-600 uppercase">Mastered</span>
            <p className="text-2xl font-black text-emerald-600">{masteredIds.size}</p>
          </div>
          <div>
            <span className="text-[11px] font-bold text-slate-600 uppercase">Need Review</span>
            <p className="text-2xl font-black text-rose-600">{cards.length - masteredIds.size}</p>
          </div>
        </div>

        <div className="flex flex-wrap justify-center gap-3 pt-2">
          <button
            onClick={() => {
              setIsComplete(false);
              setCurrentIndex(0);
              setIsFlipped(false);
              setMasteredIds(new Set());
              setReviewIds(new Set());
            }}
            className="px-5 py-2.5 bg-yellow-300 hover:bg-yellow-200 text-slate-950 font-black text-xs rounded-xl border-2 border-slate-900 shadow-neo transition-all active:translate-y-0.5"
          >
            Practice Again
          </button>
          <button
            onClick={onClose}
            className="px-5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-800 font-black text-xs rounded-xl border-2 border-slate-900 shadow-neo-sm transition-all active:translate-y-0.5"
          >
            Back to Quizzes
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-4">
      {/* Top Header & Controls */}
      <div className="flex items-center justify-between bg-white p-4 border-3 border-slate-900 rounded-2xl shadow-neo-sm">
        <div>
          <span className="px-2 py-0.5 bg-yellow-300 text-slate-950 border border-slate-900 rounded text-[10px] font-black uppercase tracking-wider">
            {quizName}
          </span>
          <div className="text-xs font-black text-slate-950 mt-1">
            Card {currentIndex + 1} of {cards.length}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleShuffle}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-white hover:bg-slate-100 text-slate-900 rounded-xl border-2 border-slate-900 text-xs font-black shadow-neo-sm transition-all active:translate-y-0.5"
            title="Shuffle deck"
          >
            <Shuffle className="w-3.5 h-3.5" />
            Shuffle
          </button>

          <button
            onClick={onClose}
            className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-900 rounded-xl border-2 border-slate-900 text-xs font-black shadow-neo-sm transition-all active:translate-y-0.5"
          >
            Exit Drill
          </button>
        </div>
      </div>

      {/* Progress Bar */}
      <div className="w-full bg-slate-200 h-2.5 border-2 border-slate-900 rounded-full overflow-hidden">
        <div
          className="h-full bg-yellow-300 transition-all duration-200"
          style={{ width: `${((currentIndex + 1) / cards.length) * 100}%` }}
        />
      </div>

      {/* Floating Explainer Tooltip */}
      {selectedText && (
        <div className="mx-auto w-fit bg-slate-900 text-white px-4 py-2 rounded-xl border-2 border-yellow-300 shadow-neo-md flex items-center gap-2.5 animate-in zoom-in-95 duration-150">
          <Sparkles className="w-4 h-4 text-yellow-300 shrink-0" />
          <span className="text-xs font-bold">
            Explain &ldquo;<strong className="text-yellow-200 font-black">{selectedText}</strong>&rdquo; with ተማሪ AI?
          </span>
          <button
            onClick={() => {
              if (onHighlightTerm) onHighlightTerm(selectedText, isFlipped ? currentCard?.answer : currentCard?.question);
              setSelectedText(null);
            }}
            className="px-2.5 py-1 bg-yellow-300 text-slate-950 font-black text-xs rounded-lg border border-slate-900 hover:bg-yellow-200 transition-colors shadow-neo-sm"
          >
            Explain
          </button>
        </div>
      )}

      {/* 3D Flashcard Container */}
      <div
        className="relative h-80 w-full perspective-1000 cursor-pointer select-text"
        onClick={() => setIsFlipped(!isFlipped)}
        onMouseUp={handleSelection}
      >
        {/* keyed reveal: replays the enter animation when the card changes.
            The flipper inside stays on its own transform layer for the 3D flip. */}
        <div key={currentIndex} className="w-full h-full flashcard-reveal">
          <div
            className={`w-full h-full duration-300 transform-style-3d relative transition-transform ${
              isFlipped ? 'rotate-y-180' : ''
            }`}
          >
          {/* Front Face (Question) */}
          <div className="absolute inset-0 w-full h-full bg-white border-3 border-slate-900 rounded-2xl p-6 shadow-neo-lg flex flex-col justify-between backface-hidden">
            <div className="flex items-center justify-between text-xs text-slate-500 font-black">
              <span className="flex items-center gap-1.5 text-cyan-800">
                <BookOpen className="w-4 h-4" /> QUESTION
              </span>
              {currentCard?.difficulty && (
                <span
                  className={`px-2 py-0.5 rounded-lg border border-slate-900 text-[10px] font-black uppercase shadow-xs ${
                    currentCard.difficulty === 'Easy'
                      ? 'bg-emerald-300 text-slate-950'
                      : currentCard.difficulty === 'Medium'
                      ? 'bg-amber-300 text-slate-950'
                      : 'bg-rose-300 text-slate-950'
                  }`}
                >
                  {currentCard.difficulty}
                </span>
              )}
            </div>

            <div className="my-auto text-center py-4">
              <p className="text-lg md:text-xl font-black text-slate-950 leading-relaxed">
                {currentCard?.question}
              </p>
            </div>

            <div className="flex items-center justify-between text-[11px] font-bold text-slate-600 pt-3 border-t-2 border-slate-200">
              <span className="flex items-center gap-1.5">
                <RotateCw className="w-3.5 h-3.5 text-slate-900" /> Click or press Space to flip
              </span>
              <span className="text-cyan-800 font-black">Highlight text to explain</span>
            </div>
          </div>

          {/* Back Face (Answer) */}
          <div className="absolute inset-0 w-full h-full bg-[#FAF8F5] text-slate-950 border-3 border-slate-900 rounded-2xl p-6 shadow-neo-lg flex flex-col justify-between backface-hidden rotate-y-180">
            <div className="flex items-center justify-between text-xs font-black text-slate-900">
              <span className="flex items-center gap-1.5 text-emerald-800">
                <Sparkles className="w-4 h-4 text-yellow-500" /> ANSWER & EXPLANATION
              </span>
              <span className="px-2 py-0.5 bg-white border border-slate-900 rounded text-slate-900 text-[10px]">
                Card {currentIndex + 1}
              </span>
            </div>

            <div className="my-auto text-center py-4">
              <p className="text-sm md:text-base font-bold text-slate-900 leading-relaxed">
                {currentCard?.answer}
              </p>
            </div>

            <div className="flex items-center justify-between text-[11px] font-bold text-slate-600 pt-3 border-t-2 border-slate-200">
              <span>Click to flip back</span>
              <span className="text-cyan-800 font-black">Highlight text to explain</span>
            </div>
          </div>
        </div>
        </div>
      </div>

      {/* Navigation & Self Assessment Buttons */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2">
        <div className="flex items-center gap-2">
          <button
            onClick={handlePrev}
            disabled={currentIndex === 0}
            className="flex items-center gap-1 px-3.5 py-2 bg-white hover:bg-slate-50 border-2 border-slate-900 rounded-xl text-xs font-black text-slate-900 disabled:opacity-40 transition-all shadow-neo-sm active:translate-y-0.5"
          >
            <ChevronLeft className="w-3.5 h-3.5" /> Previous
          </button>

          <button
            onClick={() => setIsFlipped(!isFlipped)}
            className="flex items-center gap-1 px-3.5 py-2 bg-yellow-300 hover:bg-yellow-200 text-slate-950 rounded-xl border-2 border-slate-900 text-xs font-black shadow-neo-sm transition-all active:translate-y-0.5"
          >
            <RotateCw className="w-3.5 h-3.5" /> Flip Card
          </button>

          <button
            onClick={handleNext}
            className="flex items-center gap-1 px-3.5 py-2 bg-white hover:bg-slate-50 border-2 border-slate-900 rounded-xl text-xs font-black text-slate-900 transition-all shadow-neo-sm active:translate-y-0.5"
          >
            Next <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={markNeedReview}
            className="flex items-center gap-1.5 px-4 py-2 bg-rose-200 hover:bg-rose-100 text-rose-950 border-2 border-slate-900 rounded-xl text-xs font-black shadow-neo-sm transition-all active:translate-y-0.5"
            title="Mark as Still Learning"
          >
            <XCircle className="w-4 h-4" /> Need Practice
          </button>

          <button
            onClick={markMastered}
            className="flex items-center gap-1.5 px-4 py-2 bg-emerald-300 hover:bg-emerald-200 text-emerald-950 border-2 border-slate-900 rounded-xl text-xs font-black shadow-neo-sm transition-all active:translate-y-0.5"
            title="Mark as Mastered"
          >
            <CheckCircle2 className="w-4 h-4" /> Mastered!
          </button>
        </div>
      </div>
    </div>
  );
};

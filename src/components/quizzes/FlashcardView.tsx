import React, { useState, useEffect, useRef } from 'react';
import type { MorphOrigin } from '../ui/Modal';
import { prefersReducedMotion } from '../../utils/viewTransition';
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
  Hand,
  Badge,
} from 'lucide-react';
import { fireConfetti } from '../../utils/confetti';
import { Button } from '../ui/button';

interface FlashcardViewProps {
  quizName: string;
  flashcards: Flashcard[];
  onFinish?: (score: number, masteredCount: number) => void;
  onHighlightTerm?: (term: string, context?: string, origin?: MorphOrigin) => void;
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

  // Responsive Swipe Gesture & Discoverability States
  const [dragOffset, setDragOffset] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [gestureAxis, setGestureAxis] = useState<'horizontal' | 'vertical' | null>(null);
  const [showGhostHand, setShowGhostHand] = useState(() => {
    if (typeof window === 'undefined') return false;
    return !localStorage.getItem('temari_swipe_hint_seen');
  });

  const pointerStartRef = useRef<{ x: number; y: number; time: number } | null>(null);
  const hasDraggedRef = useRef(false);
  const committedDuringSwipeRef = useRef(false);
  const lastSampleRef = useRef<{ x: number; y: number; time: number } | null>(null);
  const cardSurfaceRef = useRef<HTMLDivElement | null>(null);
  const interruptOffsetRef = useRef<{ x: number; y: number } | null>(null);

  const currentCard = cards[currentIndex];

  useEffect(() => {
    if (!showGhostHand) return;

    if (prefersReducedMotion()) {
      setShowGhostHand(false);
      localStorage.setItem('temari_swipe_hint_seen', 'true');
      return;
    }

    const timer = setTimeout(() => {
      setShowGhostHand(false);
      localStorage.setItem('temari_swipe_hint_seen', 'true');
    }, 1800);

    return () => clearTimeout(timer);
  }, [showGhostHand]);

  const dismissGhostHand = () => {
    if (showGhostHand) {
      setShowGhostHand(false);
      localStorage.setItem('temari_swipe_hint_seen', 'true');
    }
  };

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
      fireConfetti({ particleCount: 60 });
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

  const DISTANCE_THRESHOLD = 65;
  const VELOCITY_THRESHOLD = 0.4;

  const sampleVelocity = () => {
    const start = pointerStartRef.current;
    const last = lastSampleRef.current;
    if (!start || !last) return 0;
    const elapsed = last.time - start.time;
    if (elapsed <= 0) return 0;
    return Math.hypot(last.x - start.x, last.y - start.y) / elapsed;
  };

  const readLiveOffset = () => {
    const el = cardSurfaceRef.current;
    if (!el) return { x: 0, y: 0 };
    const t = new DOMMatrixReadOnly(getComputedStyle(el).transform);
    return { x: t.m41, y: t.m42 };
  };

  const handlePointerDown = (e: React.PointerEvent) => {
    dismissGhostHand();

    const live = readLiveOffset();
    const interrupting = Math.abs(live.x) > 0.5 || Math.abs(live.y) > 0.5;
    if (interrupting) {
      setDragOffset(live);
      setGestureAxis(Math.abs(live.x) >= Math.abs(live.y) ? 'horizontal' : 'vertical');
      hasDraggedRef.current = true;
    }
    interruptOffsetRef.current = interrupting ? live : null;

    committedDuringSwipeRef.current = false;
    lastSampleRef.current = { x: e.clientX, y: e.clientY, time: Date.now() };
    pointerStartRef.current = { x: e.clientX, y: e.clientY, time: Date.now() };
    hasDraggedRef.current = false;
    setIsDragging(true);
    setGestureAxis(null);
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
    }
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!pointerStartRef.current || !isDragging) return;
    if (committedDuringSwipeRef.current) return;

    lastSampleRef.current = { x: e.clientX, y: e.clientY, time: Date.now() };

    const dx = e.clientX - pointerStartRef.current.x;
    const dy = e.clientY - pointerStartRef.current.y;

    const base = interruptOffsetRef.current ?? { x: 0, y: 0 };

    if (!hasDraggedRef.current && Math.hypot(dx, dy) > 8) {
      hasDraggedRef.current = true;
      if (isFlipped && Math.abs(dy) > Math.abs(dx)) {
        setGestureAxis('vertical');
      } else {
        setGestureAxis('horizontal');
      }
    }

    if (gestureAxis === 'horizontal') {
      const atStart = currentIndex === 0 && dx > 0;
      const atEnd = currentIndex === cards.length - 1 && dx < 0;
      const factor = atStart || atEnd ? 0.25 : 0.85;
      const offset = base.x + dx * factor;
      setDragOffset({ x: offset, y: 0 });

      const canAdvance = !atStart && !atEnd;
      if (canAdvance && Math.abs(offset) > DISTANCE_THRESHOLD) {
        committedDuringSwipeRef.current = true;
        if (offset < 0) handleNext();
        else handlePrev();
        setDragOffset({ x: 0, y: 0 });
        setGestureAxis(null);
      }
    } else if (gestureAxis === 'vertical' && isFlipped) {
      setDragOffset({ x: 0, y: base.y + dy * 0.85 });
    }
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {
    }

    const velocity = sampleVelocity();
    const flicked = velocity > VELOCITY_THRESHOLD;

    if (committedDuringSwipeRef.current) {
    } else if (!hasDraggedRef.current) {
      setIsFlipped((f) => !f);
    } else if (gestureAxis === 'horizontal') {
      if (dragOffset.x < 0 && (dragOffset.x < -DISTANCE_THRESHOLD || flicked)) {
        handleNext();
      } else if (dragOffset.x > 0 && (dragOffset.x > DISTANCE_THRESHOLD || flicked)) {
        handlePrev();
      }
    } else if (gestureAxis === 'vertical' && isFlipped) {
      if (dragOffset.y < 0 && (dragOffset.y < -DISTANCE_THRESHOLD || flicked)) {
        markNeedReview();
      } else if (dragOffset.y > 0 && (dragOffset.y > DISTANCE_THRESHOLD || flicked)) {
        markMastered();
      }
    }

    committedDuringSwipeRef.current = false;
    lastSampleRef.current = null;
    interruptOffsetRef.current = null;
    setIsDragging(false);
    setDragOffset({ x: 0, y: 0 });
    setGestureAxis(null);
    pointerStartRef.current = null;
    hasDraggedRef.current = false;
  };

  const handlePointerCancel = () => {
    setIsDragging(false);
    setDragOffset({ x: 0, y: 0 });
    setGestureAxis(null);
    pointerStartRef.current = null;
    hasDraggedRef.current = false;
    committedDuringSwipeRef.current = false;
    lastSampleRef.current = null;
    interruptOffsetRef.current = null;
  };

  if (isComplete) {
    const score = Math.round((masteredIds.size / Math.max(1, cards.length)) * 100);
    return (
      <div className="bg-card border border-border/80 rounded-2xl p-6 shadow-xs text-center max-w-xl mx-auto space-y-5 animate-in zoom-in-95 duration-150">
        <div className="w-14 h-14 bg-amber-100 border border-border rounded-2xl flex items-center justify-center">
          <Award className="w-7 h-7 text-amber-600" />
        </div>

        <div>
          <span className="px-2 py-0.5 bg-amber-100 text-amber-600 border border-border rounded-md text-[10px] font-semibold uppercase tracking-wider shadow-xs">
            Quiz Completed
          </span>
          <h2 className="font-editorial text-2xl font-bold text-foreground mt-2">{quizName}</h2>
        </div>

        <div className="grid grid-cols-3 gap-3 p-4 bg-muted/50 border border-border rounded-xl">
          <div>
            <span className="text-[11px] font-medium text-muted-foreground uppercase">Mastery Score</span>
            <p className="text-2xl font-semibold text-foreground font-mono tabular-nums">{score}%</p>
          </div>
          <div>
            <span className="text-[11px] font-medium text-muted-foreground uppercase">Mastered</span>
            <p className="text-2xl font-semibold text-emerald-600 font-mono tabular-nums">{masteredIds.size}</p>
          </div>
          <div>
            <span className="text-[11px] font-medium text-muted-foreground uppercase">Need Review</span>
            <p className="text-2xl font-semibold text-rose-600 font-mono tabular-nums">{cards.length - masteredIds.size}</p>
          </div>
        </div>

        <div className="flex flex-wrap justify-center gap-3 pt-2">
          <Button
            onClick={() => {
              setIsComplete(false);
              setCurrentIndex(0);
              setIsFlipped(false);
              setMasteredIds(new Set());
              setReviewIds(new Set());
            }}
            variant="outline"
          >
            Practice Again
          </Button>
          <Button
            onClick={onClose}
            variant="secondary"
          >
            Back to Quizzes
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-4">
      {/* Top Header & Controls */}
      <div className="flex items-center justify-between bg-card p-4 border border-border/80 rounded-2xl shadow-xs">
        <div>
          <span className="px-2 py-0.5 bg-amber-100 text-amber-600 border border-border rounded text-[10px] font-semibold uppercase tracking-wider">
            {quizName}
          </span>
          <div className="text-xs font-medium text-foreground mt-1">
            Card {currentIndex + 1} of {cards.length}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleShuffle}
            title="Shuffle deck"
          >
            <Shuffle className="size-3.5" />
            Shuffle
          </Button>

          <Button
            variant="secondary"
            size="sm"
            onClick={onClose}
          >
            Exit Drill
          </Button>
        </div>
      </div>

      {/* Progress Bar */}
      <div className="w-full bg-muted h-2.5 rounded-full overflow-hidden">
        <div
          className="h-full bg-amber-500 transition-all duration-200"
          style={{ width: `${((currentIndex + 1) / cards.length) * 100}%` }}
        />
      </div>

      {/* Floating Explainer Tooltip */}
      {selectedText && (
        <div className="mx-auto w-fit bg-card border border-border rounded-xl p-3 text-xs font-medium text-foreground shadow-xs flex items-center gap-2.5 animate-in zoom-in-95 duration-150">
          <Sparkles className="w-4 h-4 text-amber-500 shrink-0" />
          <span>
            Explain &ldquo;<strong className="text-amber-600 font-semibold">{selectedText}</strong>&rdquo; with{' '}
            <span className="font-ethiopic font-semibold text-amber-600 text-sm">ተማሪ</span> AI?
          </span>
          <Button
            size="sm"
            variant="outline"
            onClick={(e) => {
              if (onHighlightTerm)
                onHighlightTerm(
                  selectedText,
                  isFlipped ? currentCard?.answer : currentCard?.question,
                  e.currentTarget
                );
              setSelectedText(null);
            }}
          >
            Explain
          </Button>
        </div>
      )}

      {/* 3D Flashcard & Stacked Deck Container */}
      <div className="relative pt-2 pb-6 px-1">
        {/* Physical Stacked Card Deck Illusion */}
        {cards.length - 1 - currentIndex >= 3 && (
          <div
            aria-hidden="true"
            className="deck-card deck-card-3 bg-muted border border-border/80 rounded-2xl flex items-end justify-center pb-1.5"
          >
            <span className="text-[9px] font-medium uppercase tracking-wider text-muted-foreground">
              {cards.length - currentIndex - 1} cards below
            </span>
          </div>
        )}

        {cards.length - 1 - currentIndex >= 2 && (
          <div
            aria-hidden="true"
            className="deck-card deck-card-2 bg-card/50 border border-border/80 rounded-2xl flex items-end justify-center pb-1.5"
          >
            <span className="text-[9px] font-medium uppercase tracking-wider text-muted-foreground">
              {cards.length - currentIndex - 1} cards below
            </span>
          </div>
        )}

        {cards.length - 1 - currentIndex >= 1 && (
          <div
            aria-hidden="true"
            className="deck-card deck-card-1 bg-card border border-border/80 rounded-2xl flex items-end justify-center pb-1.5"
          >
            <span className="text-[9px] font-medium uppercase tracking-wider text-muted-foreground">
              {cards.length - currentIndex - 1} card in deck
            </span>
          </div>
        )}

        {/* Peeking Edge Affordances */}
        {currentIndex < cards.length - 1 && (
          <div
            aria-hidden="true"
            className="absolute top-4 bottom-8 right-0 w-2.5 md:w-3.5 bg-amber-100/80 border border-border rounded-r-xl flex items-center justify-center transition-transform z-0 pointer-events-none"
            style={{
              transform:
                dragOffset.x < 0
                  ? `translateX(${Math.min(12, 6 + Math.abs(dragOffset.x) * 0.12)}px)`
                  : 'translateX(6px)',
            }}
            title="Swipe left for next card"
          >
            <span className="w-0.5 h-6 bg-foreground/20 rounded-full" />
          </div>
        )}

        {currentIndex > 0 && (
          <div
            aria-hidden="true"
            className="absolute top-4 bottom-8 left-0 w-2.5 md:w-3.5 bg-amber-100/80 border border-border rounded-l-xl flex items-center justify-center transition-transform z-0 pointer-events-none"
            style={{
              transform:
                dragOffset.x > 0
                  ? `translateX(-${Math.min(12, 6 + dragOffset.x * 0.12)}px)`
                  : 'translateX(-6px)',
            }}
            title="Swipe right for previous card"
          >
            <span className="w-0.5 h-6 bg-foreground/20 rounded-full" />
          </div>
        )}

        {/* Active Top Card Container */}
        <div
          className="relative h-80 md:h-88 w-full perspective-1000 cursor-grab active:cursor-grabbing select-text z-10"
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerCancel}
          onMouseUp={handleSelection}
        >
          <div
            key={currentIndex}
            ref={cardSurfaceRef}
            className="w-full h-full flashcard-reveal"
            style={{
              transform:
                gestureAxis === 'horizontal'
                  ? `translateX(${dragOffset.x}px) rotate(${dragOffset.x * 0.035}deg)`
                  : gestureAxis === 'vertical' && isFlipped
                  ? `translateY(${dragOffset.y}px)`
                  : undefined,
              transition: isDragging
                ? 'none'
                : 'transform 260ms cubic-bezier(0.34, 1.3, 0.64, 1)',
              touchAction: 'none',
            }}
          >
            <div
              className={`card flashcard-card w-full h-full relative ${
                isFlipped ? 'flipped' : ''
              }`}
            >
              {/* Front Face (Question) */}
              <div className="card-face flashcard-face flashcard-front absolute inset-0 w-full h-full bg-card border border-border/80 rounded-2xl p-6 md:p-8 shadow-xs flex flex-col justify-between">
                <div className="flex items-center justify-between text-xs text-muted-foreground font-medium">
                  <span className="flex items-center gap-1.5 text-amber-600">
                    <BookOpen className="w-4 h-4" /> Question
                  </span>
                  {currentCard?.difficulty && (
                    <span
                      className={`px-2 py-0.5 rounded-lg border border-border text-[10px] font-medium uppercase shadow-xs ${
                        currentCard.difficulty === 'Easy'
                          ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/20'
                          : currentCard.difficulty === 'Medium'
                          ? 'bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/20'
                          : 'bg-rose-500/10 text-rose-700 dark:text-rose-400 border-rose-500/20'
                      }`}
                    >
                      {currentCard.difficulty}
                    </span>
                  )}
                </div>

                <div className="my-auto text-center py-4">
                  <p className="text-lg md:text-xl font-semibold text-foreground leading-relaxed">
                    {currentCard?.question}
                  </p>
                </div>

                <div className="flex items-center justify-between text-[11px] font-medium text-muted-foreground pt-3 border-t border-border">
                  <span className="flex items-center gap-1.5">
                    <RotateCw className="w-3.5 h-3.5" /> Tap or press Space to flip
                  </span>
                  <span className="text-amber-600 font-semibold">Highlight text for ተማሪ AI</span>
                </div>
              </div>

              {/* Back Face (Answer) */}
              <div className="card-face flashcard-face flashcard-back absolute inset-0 w-full h-full bg-card text-foreground border border-border/80 rounded-2xl p-6 md:p-8 shadow-xs flex flex-col justify-between rotate-y-180 overflow-hidden">
                {/* Swipe Up: Rate Hard (Red Tint Preview during drag) */}
                {isFlipped && gestureAxis === 'vertical' && dragOffset.y < 0 && (
                  <div
                    className="absolute inset-0 bg-rose-500/25 border border-rose-600 rounded-2xl z-20 flex flex-col items-center justify-center pointer-events-none transition-opacity"
                    style={{ opacity: Math.min(0.92, Math.abs(dragOffset.y) / 80) }}
                  >
                    <div className="px-4 py-2 bg-rose-100 text-rose-950 border-2 border-border rounded-xl font-semibold text-xs shadow-sm flex items-center gap-2 transform -translate-y-2">
                      <XCircle className="w-5 h-5 text-rose-700" />
                      <span>Release to rate <strong>Hard</strong> (Need Practice)</span>
                    </div>
                  </div>
                )}

                {/* Swipe Down: Rate Easy (Green Tint Preview during drag) */}
                {isFlipped && gestureAxis === 'vertical' && dragOffset.y > 0 && (
                  <div
                    className="absolute inset-0 bg-emerald-500/25 border border-emerald-600 rounded-2xl z-20 flex flex-col items-center justify-center pointer-events-none transition-opacity"
                    style={{ opacity: Math.min(0.92, dragOffset.y / 80) }}
                  >
                    <div className="px-4 py-2 bg-emerald-100 text-emerald-950 border-2 border-border rounded-xl font-semibold text-xs shadow-sm flex items-center gap-2 transform translate-y-2">
                      <CheckCircle2 className="w-5 h-5 text-emerald-700" />
                      <span>Release to rate <strong>Easy</strong> (Mastered!)</span>
                    </div>
                  </div>
                )}

                <div className="flex items-center justify-between text-xs font-medium text-foreground">
                  <span className="flex items-center gap-1.5 text-emerald-600">
                    <Sparkles className="w-4 h-4 text-amber-500" /> Answer & Explanation
                  </span>
                  <span className="px-2 py-0.5 bg-muted border border-border rounded text-foreground text-[10px] font-medium">
                    Card {currentIndex + 1} of {cards.length}
                  </span>
                </div>

                <div className="my-auto text-center py-4">
                  <p className="text-sm md:text-base font-semibold text-foreground leading-relaxed">
                    {currentCard?.answer}
                  </p>
                </div>

                <div className="flex items-center justify-between text-[11px] font-medium text-muted-foreground pt-3 border-t border-border">
                  <span className="flex items-center gap-1.5">
                    <RotateCw className="w-3.5 h-3.5" /> Swipe up for hard, down for easy
                  </span>
                  <span className="text-amber-600 font-semibold">Highlight text for ተማሪ AI</span>
                </div>
              </div>
            </div>
          </div>

          {/* Discoverability Pattern: Ghost-hand Animation */}
          {showGhostHand && (
            <div
              onClick={dismissGhostHand}
              className="absolute inset-0 z-30 flex flex-col items-center justify-center bg-black/20 backdrop-blur-xs rounded-2xl cursor-pointer select-none"
            >
              <div className="ghost-hand-anim flex flex-col items-center gap-2">
                <div className="p-3 bg-amber-100 border border-border rounded-2xl shadow-sm text-foreground flex items-center justify-center">
                  <Hand className="w-7 h-7 transform -rotate-12" />
                </div>
                <div className="px-3.5 py-1.5 bg-card border border-amber-500/30 rounded-xl text-xs font-medium whitespace-nowrap shadow-sm flex items-center gap-1.5">
                  <span>Swipe sideways to move between cards</span>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Navigation & Self Assessment Buttons */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-1">
        <div className="flex items-center gap-2">
          <Button
            variant="secondary"
            size="sm"
            onClick={handlePrev}
            disabled={currentIndex === 0}
          >
            <ChevronLeft className="size-3.5" />
            Previous
          </Button>

          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsFlipped(!isFlipped)}
          >
            <RotateCw className="size-3.5" /> Flip Card
          </Button>

          <Button
            variant="secondary"
            size="sm"
            onClick={handleNext}
          >
            Next <ChevronRight className="size-3.5" />
          </Button>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={markNeedReview}
            title="Mark as Still Learning"
          >
            <XCircle className="size-4" />
            Need Practice
          </Button>

          <Button
            variant="ghost"
            size="sm"
            onClick={markMastered}
            title="Mark as Mastered"
          >
            <CheckCircle2 className="size-4" />
            Mastered!
          </Button>
        </div>
      </div>
    </div>
  );
};
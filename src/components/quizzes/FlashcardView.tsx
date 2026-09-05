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
} from 'lucide-react';
import { fireConfetti } from '../../utils/confetti';

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
  /** Set once a lightweight action has fired mid-swipe, so it fires only once. */
  const committedDuringSwipeRef = useRef(false);
  /** Last sample, for the release velocity. */
  const lastSampleRef = useRef<{ x: number; y: number; time: number } | null>(null);
  /** The dragged surface, so an in-flight settle can be read and interrupted. */
  const cardSurfaceRef = useRef<HTMLDivElement | null>(null);
  /** Offset adopted from an interrupted settle; new deltas are added to it. */
  const interruptOffsetRef = useRef<{ x: number; y: number } | null>(null);

  const currentCard = cards[currentIndex];

  // Ghost hand discoverability animation (1.5s single play, respects prefers-reduced-motion)
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

  /*
   * Gesture commit rules (learn-ui, "Kinetic physics"):
   *
   *   Navigation (prev/next) is lightweight and reversible, so it fires DURING
   *   the swipe the moment the card clears the threshold — waiting for release
   *   would feel broken and gives less affordance.
   *
   *   Rating a card (mastered / needs review) mutates drill state, so it waits
   *   for release however far the card has been dragged. That is what buys the
   *   learner a peek: cross the line, change your mind, drag back, nothing
   *   happened.
   *
   * Distance is not the only signal — a short fast flick counts too, so both
   * paths also accept a velocity above VELOCITY_THRESHOLD.
   */
  const DISTANCE_THRESHOLD = 65;
  const VELOCITY_THRESHOLD = 0.4; // px/ms

  const sampleVelocity = () => {
    const start = pointerStartRef.current;
    const last = lastSampleRef.current;
    if (!start || !last) return 0;
    const elapsed = last.time - start.time;
    if (elapsed <= 0) return 0;
    return Math.hypot(last.x - start.x, last.y - start.y) / elapsed;
  };

  /**
   * Read the surface's live transform. A settle animation may be mid-flight, in
   * which case the committed React state says 0 but the card is visibly
   * somewhere else; grabbing it must continue from where it *looks*, not
   * teleport it back to centre.
   */
  const readLiveOffset = () => {
    const el = cardSurfaceRef.current;
    if (!el) return { x: 0, y: 0 };
    const t = new DOMMatrixReadOnly(getComputedStyle(el).transform);
    return { x: t.m41, y: t.m42 };
  };

  // Pointer & Gesture Event Handlers
  const handlePointerDown = (e: React.PointerEvent) => {
    dismissGhostHand();

    // Interrupt any settle in progress and adopt its current position, so the
    // gesture that started the motion can also take it over mid-flight.
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
      // ignore
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
      // Dampen at deck boundaries (first card swipe right or last card swipe left)
      const atStart = currentIndex === 0 && dx > 0;
      const atEnd = currentIndex === cards.length - 1 && dx < 0;
      const factor = atStart || atEnd ? 0.25 : 0.85;
      const offset = base.x + dx * factor;
      setDragOffset({ x: offset, y: 0 });

      // Lightweight: navigate the moment the card reaches its logical position.
      // Never mid-swipe at the boundaries — there is nowhere to go, and the
      // last card would finish the drill, which is not lightweight.
      const canAdvance = !atStart && !atEnd;
      if (canAdvance && Math.abs(offset) > DISTANCE_THRESHOLD) {
        committedDuringSwipeRef.current = true;
        if (offset < 0) handleNext();
        else handlePrev();
        setDragOffset({ x: 0, y: 0 });
        setGestureAxis(null);
      }
    } else if (gestureAxis === 'vertical' && isFlipped) {
      // Rating: track the finger, but commit nothing until release.
      setDragOffset({ x: 0, y: base.y + dy * 0.85 });
    }
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {
      // ignore
    }

    const velocity = sampleVelocity();
    const flicked = velocity > VELOCITY_THRESHOLD;

    if (committedDuringSwipeRef.current) {
      // Navigation already fired mid-swipe; nothing left to commit.
    } else if (!hasDraggedRef.current) {
      // Tap or Click: flip card
      setIsFlipped((f) => !f);
    } else if (gestureAxis === 'horizontal') {
      // Only reachable at the deck boundaries or below the mid-swipe threshold.
      if (dragOffset.x < 0 && (dragOffset.x < -DISTANCE_THRESHOLD || flicked)) {
        handleNext();
      } else if (dragOffset.x > 0 && (dragOffset.x > DISTANCE_THRESHOLD || flicked)) {
        handlePrev();
      }
    } else if (gestureAxis === 'vertical' && isFlipped) {
      // Destructive-ish: rating is recorded only now, on release.
      if (dragOffset.y < 0 && (dragOffset.y < -DISTANCE_THRESHOLD || flicked)) {
        // Swipe up: Hard / Need Practice
        markNeedReview();
      } else if (dragOffset.y > 0 && (dragOffset.y > DISTANCE_THRESHOLD || flicked)) {
        // Swipe down: Easy / Mastered
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
            className="btn-kinetic px-5 py-2.5 bg-yellow-300 hover:bg-yellow-200 text-slate-950 font-black text-xs rounded-xl border-2 border-slate-900 shadow-neo active:translate-x-0.5 active:translate-y-0.5 active:shadow-neo-xs"
          >
            Practice Again
          </button>
          <button
            onClick={onClose}
            className="btn-kinetic px-5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-800 font-black text-xs rounded-xl border-2 border-slate-900 shadow-neo-sm active:translate-x-0.5 active:translate-y-0.5 active:shadow-neo-xs"
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
            className="btn-kinetic flex items-center gap-1.5 px-3 py-1.5 bg-white hover:bg-slate-100 text-slate-900 rounded-xl border-2 border-slate-900 text-xs font-black shadow-neo-sm active:translate-x-0.5 active:translate-y-0.5 active:shadow-neo-xs"
            title="Shuffle deck"
          >
            <Shuffle className="w-3.5 h-3.5" />
            Shuffle
          </button>

          <button
            onClick={onClose}
            className="btn-kinetic px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-900 rounded-xl border-2 border-slate-900 text-xs font-black shadow-neo-sm active:translate-x-0.5 active:translate-y-0.5 active:shadow-neo-xs"
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
            Explain &ldquo;<strong className="text-yellow-200 font-black">{selectedText}</strong>&rdquo; with{' '}
            <span className="font-ethiopic font-bold text-yellow-300 text-sm">ተማሪ</span> AI?
          </span>
          <button
            onClick={(e) => {
              if (onHighlightTerm)
                onHighlightTerm(
                  selectedText,
                  isFlipped ? currentCard?.answer : currentCard?.question,
                  e.currentTarget
                );
              setSelectedText(null);
            }}
            className="px-2.5 py-1 bg-yellow-300 text-slate-950 font-black text-xs rounded-lg border border-slate-900 hover:bg-yellow-200 transition-colors shadow-neo-sm"
          >
            Explain
          </button>
        </div>
      )}

      {/* 3D Flashcard & Stacked Deck Container */}
      <div className="relative pt-2 pb-6 px-1">
        {/* Physical Stacked Card Deck Illusion (pseudo-cards behind active card) */}
        {cards.length - 1 - currentIndex >= 3 && (
          <div
            aria-hidden="true"
            className="deck-card deck-card-3 bg-slate-200/90 border-3 border-slate-900 rounded-2xl shadow-neo-sm flex items-end justify-center pb-1.5"
          >
            <span className="text-[9px] font-black uppercase tracking-wider text-slate-500/80">
              {cards.length - currentIndex - 1} cards below
            </span>
          </div>
        )}

        {cards.length - 1 - currentIndex >= 2 && (
          <div
            aria-hidden="true"
            className="deck-card deck-card-2 bg-slate-100 border-3 border-slate-900 rounded-2xl shadow-neo-sm flex items-end justify-center pb-1.5"
          >
            <span className="text-[9px] font-black uppercase tracking-wider text-slate-500/80">
              {cards.length - currentIndex - 1} cards below
            </span>
          </div>
        )}

        {cards.length - 1 - currentIndex >= 1 && (
          <div
            aria-hidden="true"
            className="deck-card deck-card-1 bg-[#FAF8F5] border-3 border-slate-900 rounded-2xl shadow-neo-sm flex items-end justify-center pb-1.5"
          >
            <span className="text-[9px] font-black uppercase tracking-wider text-slate-500/80">
              {cards.length - currentIndex - 1} {cards.length - currentIndex - 1 === 1 ? 'card' : 'cards'} in deck
            </span>
          </div>
        )}

        {/* Peeking Edge Affordances (8px peeking edges for next/previous card) */}
        {currentIndex < cards.length - 1 && (
          <div
            aria-hidden="true"
            className="absolute top-4 bottom-8 right-0 w-2.5 md:w-3.5 bg-yellow-200/90 border-2 border-slate-900 rounded-r-xl shadow-neo-xs flex items-center justify-center transition-transform z-0 pointer-events-none"
            style={{
              transform:
                dragOffset.x < 0
                  ? `translateX(${Math.min(12, 6 + Math.abs(dragOffset.x) * 0.12)}px)`
                  : 'translateX(6px)',
            }}
            title="Swipe left for next card"
          >
            <span className="w-0.5 h-6 bg-slate-900/50 rounded-full" />
          </div>
        )}

        {currentIndex > 0 && (
          <div
            aria-hidden="true"
            className="absolute top-4 bottom-8 left-0 w-2.5 md:w-3.5 bg-yellow-200/90 border-2 border-slate-900 rounded-l-xl shadow-neo-xs flex items-center justify-center transition-transform z-0 pointer-events-none"
            style={{
              transform:
                dragOffset.x > 0
                  ? `translateX(-${Math.min(12, 6 + dragOffset.x * 0.12)}px)`
                  : 'translateX(-6px)',
            }}
            title="Swipe right for previous card"
          >
            <span className="w-0.5 h-6 bg-slate-900/50 rounded-full" />
          </div>
        )}

        {/* Active Top Card Container with Pointer & Swipe Gestures */}
        <div
          className="relative h-80 md:h-88 w-full perspective-1000 cursor-grab active:cursor-grabbing select-text z-10"
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerCancel}
          onMouseUp={handleSelection}
        >
          {/* Keyed reveal: ease-out translation when entering from the deck */}
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
              // The settle is a transition on the same property the gesture
              // drives, so a new pointerdown (which sets isDragging) drops it
              // to `none` and the card is back under the finger on the next
              // frame. An in-flight settle never has to finish before the
              // interface starts listening again.
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
              <div className="card-face flashcard-face flashcard-front absolute inset-0 w-full h-full bg-white border-3 border-slate-900 rounded-2xl p-6 md:p-8 shadow-neo-lg flex flex-col justify-between">
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
                    <RotateCw className="w-3.5 h-3.5 text-slate-900" /> Tap or press Space to flip
                  </span>
                  <span className="text-cyan-800 font-black">Highlight text for ተማሪ AI</span>
                </div>
              </div>

              {/* Back Face (Answer) */}
              <div className="card-face flashcard-face flashcard-back absolute inset-0 w-full h-full bg-[#FAF8F5] text-slate-950 border-3 border-slate-900 rounded-2xl p-6 md:p-8 shadow-neo-lg flex flex-col justify-between rotate-y-180 overflow-hidden">
                {/* Swipe Up: Rate Hard (Red Tint Preview during drag) */}
                {isFlipped && gestureAxis === 'vertical' && dragOffset.y < 0 && (
                  <div
                    className="absolute inset-0 bg-rose-500/25 border-3 border-rose-600 rounded-2xl z-20 flex flex-col items-center justify-center pointer-events-none transition-opacity"
                    style={{ opacity: Math.min(0.92, Math.abs(dragOffset.y) / 80) }}
                  >
                    <div className="px-4 py-2 bg-rose-200 text-rose-950 border-2 border-slate-900 rounded-xl font-black text-xs shadow-neo flex items-center gap-2 transform -translate-y-2">
                      <XCircle className="w-5 h-5 text-rose-700" />
                      <span>Release to rate <strong>Hard</strong> (Need Practice)</span>
                    </div>
                  </div>
                )}

                {/* Swipe Down: Rate Easy (Green Tint Preview during drag) */}
                {isFlipped && gestureAxis === 'vertical' && dragOffset.y > 0 && (
                  <div
                    className="absolute inset-0 bg-emerald-500/25 border-3 border-emerald-600 rounded-2xl z-20 flex flex-col items-center justify-center pointer-events-none transition-opacity"
                    style={{ opacity: Math.min(0.92, dragOffset.y / 80) }}
                  >
                    <div className="px-4 py-2 bg-emerald-200 text-emerald-950 border-2 border-slate-900 rounded-xl font-black text-xs shadow-neo flex items-center gap-2 transform translate-y-2">
                      <CheckCircle2 className="w-5 h-5 text-emerald-700" />
                      <span>Release to rate <strong>Easy</strong> (Mastered!)</span>
                    </div>
                  </div>
                )}

                <div className="flex items-center justify-between text-xs font-black text-slate-900">
                  <span className="flex items-center gap-1.5 text-emerald-800">
                    <Sparkles className="w-4 h-4 text-yellow-500" /> ANSWER & EXPLANATION
                  </span>
                  <span className="px-2 py-0.5 bg-white border border-slate-900 rounded text-slate-900 text-[10px] font-bold">
                    Card {currentIndex + 1} of {cards.length}
                  </span>
                </div>

                <div className="my-auto text-center py-4">
                  <p className="text-sm md:text-base font-bold text-slate-900 leading-relaxed">
                    {currentCard?.answer}
                  </p>
                </div>

                <div className="flex items-center justify-between text-[11px] font-bold text-slate-600 pt-3 border-t-2 border-slate-200">
                  <span className="flex items-center gap-1.5">
                    <RotateCw className="w-3.5 h-3.5 text-slate-900" /> Swipe up for hard, down for easy
                  </span>
                  <span className="text-cyan-800 font-black">Highlight text for ተማሪ AI</span>
                </div>
              </div>
            </div>
          </div>

          {/* Discoverability Pattern: Ghost-hand Animation (1.5s, plays once on first launch) */}
          {showGhostHand && (
            <div
              onClick={dismissGhostHand}
              className="absolute inset-0 z-30 flex flex-col items-center justify-center bg-slate-950/20 backdrop-blur-[1px] rounded-2xl cursor-pointer select-none"
            >
              <div className="ghost-hand-anim flex flex-col items-center gap-2">
                <div className="p-3 bg-yellow-300 border-2 border-slate-900 rounded-2xl shadow-neo text-slate-950 flex items-center justify-center">
                  <Hand className="w-7 h-7 transform -rotate-12" />
                </div>
                <div className="px-3.5 py-1.5 bg-slate-900 text-white text-[11px] font-black rounded-xl border border-yellow-300 shadow-neo flex items-center gap-1.5 whitespace-nowrap">
                  <span>Swipe sideways to move between cards</span>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Navigation & Self Assessment Buttons with Kinetic Physics */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-1">
        <div className="flex items-center gap-2">
          <button
            onClick={handlePrev}
            disabled={currentIndex === 0}
            className="btn-kinetic flex items-center gap-1 px-3.5 py-2 bg-white hover:bg-slate-50 border-2 border-slate-900 rounded-xl text-xs font-black text-slate-900 disabled:opacity-40 shadow-neo-sm active:translate-x-0.5 active:translate-y-0.5 active:shadow-neo-xs"
          >
            <ChevronLeft className="w-3.5 h-3.5" /> Previous
          </button>

          <button
            onClick={() => setIsFlipped(!isFlipped)}
            className="btn-kinetic flex items-center gap-1 px-3.5 py-2 bg-yellow-300 hover:bg-yellow-200 text-slate-950 rounded-xl border-2 border-slate-900 text-xs font-black shadow-neo-sm active:translate-x-0.5 active:translate-y-0.5 active:shadow-neo-xs"
          >
            <RotateCw className="w-3.5 h-3.5" /> Flip Card
          </button>

          <button
            onClick={handleNext}
            className="btn-kinetic flex items-center gap-1 px-3.5 py-2 bg-white hover:bg-slate-50 border-2 border-slate-900 rounded-xl text-xs font-black text-slate-900 shadow-neo-sm active:translate-x-0.5 active:translate-y-0.5 active:shadow-neo-xs"
          >
            Next <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={markNeedReview}
            className="btn-kinetic flex items-center gap-1.5 px-4 py-2 bg-rose-200 hover:bg-rose-100 text-rose-950 border-2 border-slate-900 rounded-xl text-xs font-black shadow-neo-sm active:translate-x-0.5 active:translate-y-0.5 active:shadow-neo-xs"
            title="Mark as Still Learning"
          >
            <XCircle className="w-4 h-4" /> Need Practice
          </button>

          <button
            onClick={markMastered}
            className="btn-kinetic flex items-center gap-1.5 px-4 py-2 bg-emerald-300 hover:bg-emerald-200 text-emerald-950 border-2 border-slate-900 rounded-xl text-xs font-black shadow-neo-sm active:translate-x-0.5 active:translate-y-0.5 active:shadow-neo-xs"
            title="Mark as Mastered"
          >
            <CheckCircle2 className="w-4 h-4" /> Mastered!
          </button>
        </div>
      </div>
    </div>
  );
};

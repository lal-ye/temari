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
import {
  createGestureState,
  reduce as reduceGesture,
  type Axis,
  type GestureEffect,
  type GestureEvent,
  type GestureState,
} from './flashcardGesture';

/**
 * §6b decision (docs/ui-plan-truthful-interaction.md): vertical rating swipe
 * is off. The card surface leaves vertical pans and pinches to the browser
 * (`touch-action: pan-y pinch-zoom`) so a thumb on the card can still scroll
 * and zoom the page; Need Practice / Mastered! are the rating controls.
 * Flip to true to re-enable the swipe — the reducer, tint previews and
 * `touch-action` all key off this one constant.
 */
const ALLOW_VERTICAL_RATING = false;

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
  /**
   * The score the Drill finished with — the exact value handed to `onFinish`
   * and written to the Attempt. The summary screen renders this rather than
   * recomputing from state, so what the learner reads is always what was
   * recorded; two derivations of the same number can drift.
   */
  const [result, setResult] = useState<{ score: number; masteredCount: number } | null>(null);

  // Swipe gesture. The reducer in flashcardGesture.ts owns the rules
  // (pointer ownership, interruption, thresholds); the ref holds the
  // authoritative state for synchronous reads inside handlers, and `drag`
  // mirrors the render-relevant part of it.
  const gestureRef = useRef<GestureState>(createGestureState());
  const [drag, setDrag] = useState<{ offset: { x: number; y: number }; axis: Axis | null; dragging: boolean }>({
    offset: { x: 0, y: 0 },
    axis: null,
    dragging: false,
  });
  const [showGhostHand, setShowGhostHand] = useState(() => {
    if (typeof window === 'undefined') return false;
    return !localStorage.getItem('temari_swipe_hint_seen');
  });

  /** The focusable gesture surface (receives keys and pointer events). */
  const cardSurfaceRef = useRef<HTMLDivElement | null>(null);
  /** The element whose transform tracks the drag and settles back. */
  const cardMotionRef = useRef<HTMLDivElement | null>(null);

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

  /**
   * Keyboard control of the Drill.
   *
   * Attached to the Drill's root rather than `window`, so keys only reach it
   * while focus is inside the Drill. That is what makes a dialog opened over
   * the Drill (the explainer, a confirm) own the keyboard: focus is trapped in
   * the dialog, so Space, Enter and the arrows never arrive here. Before this
   * a Space inside the explainer flipped the card underneath, and ArrowRight
   * on the last card could finish the Drill and record an Attempt from behind
   * a dialog.
   *
   * The card surface is focusable and receives focus on mount, so the keys
   * work immediately after opening a Drill and the card is reachable by Tab.
   */
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (isComplete || e.defaultPrevented) return;
    const target = e.target as HTMLElement | null;
    if (
      target &&
      (target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.tagName === 'SELECT' ||
        target.isContentEditable)
    ) {
      return;
    }
    // Space/Enter on a button should press the button, not flip the card.
    const onControl = target && target !== cardSurfaceRef.current && target.closest('button, a, [role="button"]');

    if ((e.code === 'Space' || e.code === 'Enter') && !onControl) {
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

  useEffect(() => {
    // Focus the card, not the first button, so arrow keys work at once.
    cardSurfaceRef.current?.focus({ preventScroll: true });
  }, []);

  const handleNext = () => {
    advance();
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

  /**
   * Move to the next Flashcard, or finish the Drill on the last one.
   *
   * `mastered` is the set to score with. Rating the last card and advancing
   * happen inside one event, so the set that includes that rating exists only
   * in the caller that just built it — `masteredIds` in this closure is still
   * the previous render's. Callers that rated a card pass the set they
   * computed; callers that only navigate leave it out.
   */
  const advance = (mastered: Set<string> = masteredIds) => {
    setIsFlipped(false);
    setSelectedText(null);
    if (currentIndex < cards.length - 1) {
      setCurrentIndex((i) => i + 1);
    } else {
      finishDrill(mastered);
    }
  };

  const markMastered = () => {
    if (!currentCard) return;
    const nextMastered = new Set(masteredIds);
    nextMastered.add(currentCard.id);
    const nextReview = new Set(reviewIds);
    nextReview.delete(currentCard.id);
    setMasteredIds(nextMastered);
    setReviewIds(nextReview);
    advance(nextMastered);
  };

  const markNeedReview = () => {
    if (!currentCard) return;
    const nextReview = new Set(reviewIds);
    nextReview.add(currentCard.id);
    const nextMastered = new Set(masteredIds);
    nextMastered.delete(currentCard.id);
    setReviewIds(nextReview);
    setMasteredIds(nextMastered);
    advance(nextMastered);
  };

  /**
   * End the Drill and record the Attempt.
   *
   * Takes the final mastered set explicitly rather than reading state. This
   * used to be a stale-closure bug: pressing "Mastered!" on the last
   * Flashcard called `setMasteredIds(...)` and then finished the Drill in the
   * same event, so the score was computed from the set *before* that rating.
   * A learner who mastered every card but rated the last one was told 80% and
   * had an 80% Attempt written to the store — and the summary screen, reading
   * settled state a moment later, showed 100%, contradicting the record.
   */
  const finishDrill = (mastered: Set<string>) => {
    const score = Math.round((mastered.size / Math.max(1, cards.length)) * 100);
    setResult({ score, masteredCount: mastered.size });
    setIsComplete(true);
    if (score >= 70) {
      fireConfetti({ particleCount: 60 });
    }
    if (onFinish) {
      onFinish(score, mastered.size);
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

  /** Live card offset from the computed transform, so a grab mid-settle continues from where the card is. */
  const readLiveOffset = () => {
    const el = cardMotionRef.current;
    if (!el) return { x: 0, y: 0 };
    const t = new DOMMatrixReadOnly(getComputedStyle(el).transform);
    return { x: t.m41, y: t.m42 };
  };

  const applyEffect = (effect: GestureEffect) => {
    switch (effect) {
      case 'next':
        handleNext();
        break;
      case 'prev':
        handlePrev();
        break;
      case 'rateHard':
        markNeedReview();
        break;
      case 'rateEasy':
        markMastered();
        break;
      case 'flip':
        setIsFlipped((f) => !f);
        break;
    }
  };

  const dispatch = (event: GestureEvent) => {
    const { state, effect } = reduceGesture(gestureRef.current, event, {
      index: currentIndex,
      count: cards.length,
      flipped: isFlipped,
      allowVerticalRating: ALLOW_VERTICAL_RATING,
    });
    gestureRef.current = state;
    setDrag({ offset: state.offset, axis: state.axis, dragging: state.dragging });
    if (effect) applyEffect(effect);
  };

  const handlePointerDown = (e: React.PointerEvent) => {
    dismissGhostHand();
    dispatch({
      type: 'down',
      pointerId: e.pointerId,
      x: e.clientX,
      y: e.clientY,
      time: e.timeStamp,
      isPrimary: e.isPrimary,
      button: e.button,
      live: readLiveOffset(),
    });
    // Capture only for the pointer that won ownership. Capture routes this
    // pointer's events to the card even when it leaves the element; it does
    // not make the gesture exclusive — the reducer does that.
    if (gestureRef.current.activePointerId === e.pointerId) {
      try {
        e.currentTarget.setPointerCapture(e.pointerId);
      } catch {
        // Capture is best-effort (e.g. pointer already gone).
      }
    }
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (gestureRef.current.activePointerId === null) return;
    dispatch({ type: 'move', pointerId: e.pointerId, x: e.clientX, y: e.clientY, time: e.timeStamp });
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    dispatch({ type: 'up', pointerId: e.pointerId, x: e.clientX, y: e.clientY, time: e.timeStamp });
  };

  // The browser took the pointer (vertical pan, pinch, system gesture) or
  // capture was lost: commit nothing, settle back.
  const handlePointerCancel = (e: React.PointerEvent) => {
    dispatch({ type: 'cancel', pointerId: e.pointerId });
  };
  const handleLostPointerCapture = (e: React.PointerEvent) => {
    dispatch({ type: 'lostCapture', pointerId: e.pointerId });
  };

  if (isComplete) {
    // The recorded result, not a fresh derivation: these three numbers are the
    // Attempt the learner just earned.
    const score = result?.score ?? Math.round((masteredIds.size / Math.max(1, cards.length)) * 100);
    const masteredCount = result?.masteredCount ?? masteredIds.size;
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
            <p className="text-2xl font-semibold text-emerald-600 font-mono tabular-nums">{masteredCount}</p>
          </div>
          <div>
            <span className="text-[11px] font-medium text-muted-foreground uppercase">Need Review</span>
            <p className="text-2xl font-semibold text-rose-600 font-mono tabular-nums">{cards.length - masteredCount}</p>
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
              // Clear the previous run's recorded result, or the next summary
              // would render the old score until this drill finishes again.
              setResult(null);
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
    <div className="max-w-2xl mx-auto space-y-4" onKeyDown={handleKeyDown}>
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
                drag.offset.x < 0
                  ? `translateX(${Math.min(12, 6 + Math.abs(drag.offset.x) * 0.12)}px)`
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
                drag.offset.x > 0
                  ? `translateX(-${Math.min(12, 6 + drag.offset.x * 0.12)}px)`
                  : 'translateX(-6px)',
            }}
            title="Swipe right for previous card"
          >
            <span className="w-0.5 h-6 bg-foreground/20 rounded-full" />
          </div>
        )}

        {/* Active Top Card Container */}
        <div
          ref={cardSurfaceRef}
          tabIndex={0}
          role="group"
          aria-label={`Flashcard ${currentIndex + 1} of ${cards.length}, showing the ${isFlipped ? 'answer' : 'question'}. Space flips; arrow keys move between cards.`}
          className="relative h-80 md:h-88 w-full perspective-1000 cursor-grab active:cursor-grabbing select-text z-10 rounded-2xl outline-hidden focus-visible:ring-2 focus-visible:ring-ring"
          style={{
            // Horizontal swipes are ours; vertical pans and pinches stay with
            // the browser, which reports them as pointercancel (§6b, A).
            touchAction: ALLOW_VERTICAL_RATING ? 'pinch-zoom' : 'pan-y pinch-zoom',
          }}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerCancel}
          onLostPointerCapture={handleLostPointerCapture}
          onMouseUp={handleSelection}
        >
          <div
            key={currentIndex}
            ref={cardMotionRef}
            className="w-full h-full flashcard-reveal flashcard-motion"
            data-dragging={drag.dragging ? 'true' : 'false'}
            style={{
              transform:
                drag.axis === 'horizontal'
                  ? `translateX(${drag.offset.x}px) rotate(${drag.offset.x * 0.035}deg)`
                  : drag.axis === 'vertical' && isFlipped
                  ? `translateY(${drag.offset.y}px)`
                  : undefined,
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
                {isFlipped && drag.axis === 'vertical' && drag.offset.y < 0 && (
                  <div
                    className="absolute inset-0 bg-rose-500/25 border border-rose-600 rounded-2xl z-20 flex flex-col items-center justify-center pointer-events-none transition-opacity"
                    style={{ opacity: Math.min(0.92, Math.abs(drag.offset.y) / 80) }}
                  >
                    <div className="px-4 py-2 bg-rose-100 text-rose-950 border-2 border-border rounded-xl font-semibold text-xs shadow-sm flex items-center gap-2 transform -translate-y-2">
                      <XCircle className="w-5 h-5 text-rose-700" />
                      <span>Release to rate <strong>Hard</strong> (Need Practice)</span>
                    </div>
                  </div>
                )}

                {/* Swipe Down: Rate Easy (Green Tint Preview during drag) */}
                {isFlipped && drag.axis === 'vertical' && drag.offset.y > 0 && (
                  <div
                    className="absolute inset-0 bg-emerald-500/25 border border-emerald-600 rounded-2xl z-20 flex flex-col items-center justify-center pointer-events-none transition-opacity"
                    style={{ opacity: Math.min(0.92, drag.offset.y / 80) }}
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
                    <RotateCw className="w-3.5 h-3.5" />{' '}
                    {ALLOW_VERTICAL_RATING ? 'Swipe up for hard, down for easy' : 'Rate with the buttons below'}
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

        {/* Primary rating controls (§6b): buttons, not a vertical swipe. */}
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={markNeedReview}
            title="Mark as Still Learning"
            className="text-rose-700 dark:text-rose-400 hover:bg-rose-500/10 hover:text-rose-700"
          >
            <XCircle className="size-4" />
            Need Practice
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={markMastered}
            title="Mark as Mastered"
            className="text-emerald-700 dark:text-emerald-400 hover:bg-emerald-500/10 hover:text-emerald-700"
          >
            <CheckCircle2 className="size-4" />
            Mastered!
          </Button>
        </div>
      </div>
    </div>
  );
};
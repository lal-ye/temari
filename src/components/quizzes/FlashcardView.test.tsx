// @vitest-environment jsdom
import React from 'react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { FlashcardView } from './FlashcardView';
import type { Flashcard } from '../../types';

/**
 * The score a Drill records is the score it shows.
 *
 * These are behavioural rather than source-reading guards (unlike
 * `keyboardOwnership.test.ts`) because the bug they cover cannot be seen in
 * the text of the component: it was a stale closure. Rating the *last*
 * Flashcard called `setMasteredIds(...)` and then finished the Drill inside
 * the same event, so the score was computed from the previous render's set and
 * the final rating silently vanished. A learner who mastered all five cards
 * was told 80%, and an 80% Attempt was written to the store — while the
 * summary screen, reading settled state a tick later, showed 100% and
 * contradicted the record.
 *
 * The only way to catch that is to drive the real component and read what it
 * reports. `onFinish` is the seam the Quizzes hub uses to write the Attempt,
 * so asserting on it asserts on what gets stored.
 */

const deck = (n: number): Flashcard[] =>
  Array.from({ length: n }, (_, i) => ({
    id: `card-${i + 1}`,
    question: `Question ${i + 1}?`,
    answer: `Answer ${i + 1}.`,
    difficulty: 'Medium' as const,
  }));

const mastered = () => fireEvent.click(screen.getByRole('button', { name: /Mastered!/i }));
const needPractice = () => fireEvent.click(screen.getByRole('button', { name: /Need Practice/i }));

describe('Drill scoring counts the card that ends the Drill', () => {
  beforeEach(() => {
    // The swipe hint overlay is a first-run affordance; get it out of the way
    // so it cannot intercept a click in these tests.
    localStorage.setItem('temari_swipe_hint_seen', 'true');
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it('records 100% when the final card is rated Mastered', () => {
    const onFinish = vi.fn();
    render(<FlashcardView quizName="Respiration" flashcards={deck(3)} onFinish={onFinish} onClose={() => {}} />);

    mastered();
    mastered();
    mastered(); // the last card — the one that used to be dropped

    expect(onFinish).toHaveBeenCalledTimes(1);
    expect(onFinish).toHaveBeenCalledWith(100, 3);
  });

  it('records the last card as Need Practice, not as mastered', () => {
    const onFinish = vi.fn();
    render(<FlashcardView quizName="Respiration" flashcards={deck(3)} onFinish={onFinish} onClose={() => {}} />);

    mastered();
    mastered();
    needPractice();

    expect(onFinish).toHaveBeenCalledWith(67, 2);
  });

  it('counts an un-rated final card as not mastered when Next ends the Drill', () => {
    const onFinish = vi.fn();
    render(<FlashcardView quizName="Respiration" flashcards={deck(2)} onFinish={onFinish} onClose={() => {}} />);

    mastered();
    fireEvent.click(screen.getByRole('button', { name: /^Next/i }));

    expect(onFinish).toHaveBeenCalledWith(50, 1);
  });

  it('shows the summary the same score it recorded', () => {
    const onFinish = vi.fn();
    render(<FlashcardView quizName="Respiration" flashcards={deck(4)} onFinish={onFinish} onClose={() => {}} />);

    mastered();
    mastered();
    mastered();
    needPractice();

    const [recordedScore, recordedCount] = onFinish.mock.calls[0];
    expect(recordedScore).toBe(75);
    expect(recordedCount).toBe(3);

    // The screen must not re-derive a different number from settled state.
    expect(screen.getByText('75%')).toBeTruthy();
    expect(screen.getByText('Quiz Completed')).toBeTruthy();
  });

  it('clears the recorded result when the learner practises again', () => {
    const onFinish = vi.fn();
    render(<FlashcardView quizName="Respiration" flashcards={deck(2)} onFinish={onFinish} onClose={() => {}} />);

    mastered();
    mastered();
    expect(onFinish).toHaveBeenNthCalledWith(1, 100, 2);

    fireEvent.click(screen.getByRole('button', { name: /Practice Again/i }));

    // Back on card 1 with nothing mastered yet; the previous run's 100% must
    // not linger in state and be shown as this run's result. The counter
    // renders twice (header and card back), hence getAllByText.
    expect(screen.queryByText('Quiz Completed')).toBeNull();
    expect(screen.getAllByText(/Card 1 of 2/i).length).toBeGreaterThan(0);
    expect(screen.queryByText('100%')).toBeNull();

    needPractice();
    needPractice();

    expect(onFinish).toHaveBeenCalledTimes(2);
    expect(onFinish).toHaveBeenNthCalledWith(2, 0, 0);
  });

  it('keeps a score below the celebration threshold out of the confetti path', () => {
    // 1 of 3 mastered is 33%: below the 70% bar, so no celebration. Guarding
    // this here keeps the threshold honest against the corrected counting —
    // a dropped final rating used to be able to push a Drill under 70%.
    const onFinish = vi.fn();
    render(<FlashcardView quizName="Respiration" flashcards={deck(3)} onFinish={onFinish} onClose={() => {}} />);

    mastered();
    needPractice();
    needPractice();

    expect(onFinish).toHaveBeenCalledWith(33, 1);
    expect(screen.getByText('33%')).toBeTruthy();
  });
});

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

/**
 * Keyboard-ownership and truthful-feedback guards
 * (docs/ui-plan-truthful-interaction.md, Phase 1).
 *
 * There is no jsdom/React-testing setup in this repo, so — like
 * designSystem.test.ts — this reads component source and asserts on the
 * contracts that matter, which is enough to fail loudly if someone reaches
 * back for a `window` key listener in the Drill, a hand-rolled dialog, or a
 * simulated refresh.
 */
const here = dirname(fileURLToPath(import.meta.url));
const read = (rel: string) => readFileSync(join(here, rel), 'utf8');

const modal = read('./Modal.tsx');
const app = read('../../App.tsx');
const flashcards = read('../quizzes/FlashcardView.tsx');
const notesManager = read('../notes/NotesManager.tsx');
const noteViewer = read('../notes/NoteViewer.tsx');
const explain = read('../tools/ExplainTermModal.tsx');
const confetti = read('../../utils/confetti.ts');

describe('shared Modal owes the keyboard a real dialog', () => {
  it('is built on Base UI Dialog (focus trap, initial focus, restoration, inert)', () => {
    expect(modal).toContain("from '@base-ui/react/dialog'");
    expect(modal).toContain('<Dialog.Popup');
    expect(modal).toContain('<Dialog.Title');
  });

  it('registers in the modal registry while open', () => {
    expect(modal).toContain('registerOpenModal(');
  });

  it('only answers Escape when it is the topmost dialog', () => {
    expect(modal).toMatch(/escape-key[\s\S]*isTopmostModal\(/);
  });
});

describe('global shortcuts stand down while any dialog is open', () => {
  it('App consults the registry instead of its own modal booleans', () => {
    expect(app).toContain('isAnyModalOpen()');
    expect(app).not.toMatch(/if \(openModal \|\| confirmDeleteSubjectId \|\| explainTermData\)/);
  });

  it('the command palette registers as a modal', () => {
    expect(app).toContain("registerOpenModal('command-palette')");
  });

  it('no window.confirm remains — every confirm goes through the shared dialog', () => {
    for (const rel of [
      '../quizzes/QuizzesManager.tsx',
      '../exams/ExamsManager.tsx',
      '../exams/ExamTakingView.tsx',
      '../analytics/AnalyticsView.tsx',
    ]) {
      const src = read(rel);
      expect(src, `${rel} still calls window.confirm`).not.toMatch(/\bconfirm\('/);
      expect(src).toContain("from '../ui/confirm'");
    }
  });
});

describe('Drill keyboard handling', () => {
  it('is scoped to the Drill element, not window', () => {
    expect(flashcards).not.toContain("window.addEventListener('keydown'");
    expect(flashcards).toMatch(/onKeyDown=\{handleKeyDown\}/);
  });

  it('ignores editable targets', () => {
    expect(flashcards).toMatch(/isContentEditable/);
    expect(flashcards).toMatch(/tagName === 'INPUT'/);
  });

  it('gives the card surface focus so arrows work without a click', () => {
    expect(flashcards).toMatch(/tabIndex=\{0\}/);
    expect(flashcards).toMatch(/cardSurfaceRef\.current\?\.focus\(/);
  });
});

describe('truthful feedback', () => {
  it('Notes no longer simulate a refresh', () => {
    expect(notesManager).not.toContain('onRefresh');
    expect(notesManager).not.toMatch(/setTimeout\(resolve, 850\)/);
    expect(noteViewer).not.toContain('onRefresh');
    expect(noteViewer).not.toMatch(/Note Refreshed/);
    expect(noteViewer).not.toContain('handlePullDown');
  });

  it('closing the explainer aborts the request instead of ignoring the answer', () => {
    expect(explain).toContain('new AbortController()');
    expect(explain).toMatch(/signal:\s*controller\.signal/);
    expect(explain).toMatch(/controller\.abort\(\)/);
    expect(explain).not.toContain('isMounted');
  });

  it('confetti honours prefers-reduced-motion inside the utility', () => {
    expect(confetti).toMatch(/if \(prefersReducedMotion\(\)\) return;/);
  });
});

describe('predictable control (Phase 2)', () => {
  const css = read('../../index.css');
  const quizzes = read('../quizzes/QuizzesManager.tsx');
  const exams = read('../exams/ExamsManager.tsx');
  const banner = read('../tools/OfflineBanner.tsx');

  it('the Drill drives its swipe through the pure gesture reducer', () => {
    expect(flashcards).toContain("from './flashcardGesture'");
    expect(flashcards).toContain('onLostPointerCapture=');
    // No per-handler gesture refs left behind.
    expect(flashcards).not.toMatch(/hasDraggedRef|interruptOffsetRef|committedDuringSwipeRef/);
  });

  it('the card surface leaves vertical pans and pinch-zoom to the browser (§6b, option A)', () => {
    expect(flashcards).toContain("'pan-y pinch-zoom'");
    expect(flashcards).not.toMatch(/touchAction:\s*'none'/);
  });

  it('the settle duration is a token, not a literal', () => {
    expect(flashcards).not.toMatch(/transform 260ms/);
    expect(css).toMatch(/\.flashcard-motion\s*\{[^}]*var\(--dur-panel\)/);
    expect(css).toMatch(/prefers-reduced-motion[\s\S]*\.flashcard-motion\s*\{[^}]*transition:\s*none/);
  });

  it('term recognition uses the Unicode-aware segmenter and one Explain path', () => {
    expect(noteViewer).toContain("from '../../utils/segmentTerm'");
    expect(noteViewer).not.toMatch(/\\u1200-\\u137F/);
    expect(noteViewer).not.toMatch(/slice\(0, 200\)/);
    // Long-press proposes; only the Explain button generates.
    expect(noteViewer).toMatch(/term-proxy-chip/);
    expect(noteViewer).not.toMatch(/setTimeout\([\s\S]{0,600}onHighlightTerm\(/);
  });

  it('every generation can be stopped, and Cancel is never disabled while generating', () => {
    for (const [name, src] of [
      ['NotesManager', notesManager],
      ['QuizzesManager', quizzes],
      ['ExamsManager', exams],
    ] as const) {
      expect(src, `${name} lacks an AbortController`).toContain('new AbortController()');
      expect(src, `${name} still disables Cancel while generating`).not.toMatch(/ModalCloseButton disabled=\{isGenerating\}/);
      expect(src, `${name} lacks a Stop waiting affordance`).toMatch(/onCancel=/);
    }
  });

  it('the offline banner separates provenance from reason and offers the matching action', () => {
    expect(banner).toContain('Open Provider settings');
    expect(banner).toContain('Retry with the Provider');
    // The old blanket sentence may survive only as a comment explaining why it went.
    const rendered = banner.replace(/\/\*\*[\s\S]*?\*\//g, '');
    expect(rendered).not.toContain('No AI Provider was reachable');
    for (const rel of ['../notes/NotesManager.tsx', '../quizzes/QuizzesManager.tsx', '../tools/ExplainTermModal.tsx']) {
      expect(read(rel), `${rel} still hard-codes the reachability sentence`).not.toContain('No AI Provider was reachable');
    }
  });
});

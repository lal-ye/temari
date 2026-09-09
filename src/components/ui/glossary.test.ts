import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

/**
 * Language guards (CONTEXT.md §Language, ADR-0006).
 *
 * CONTEXT.md is not style advice, it is the product's naming contract:
 * Subject (_avoid_: course, class, folder), Material (_avoid_: source,
 * content, document), Note (_avoid_: doc, article), Exam (_avoid_: mock,
 * test). A learner who reads "Mock Exams" in the hub and "Exam" in Analytics
 * has to work out whether those are the same thing — and the app's own
 * glossary already decided they are.
 *
 * These tests read source rather than pixels, like `designSystem.test.ts` and
 * `keyboardOwnership.test.ts`: the assertions are about which words a
 * learner is shown, and a renamed string is exactly as detectable in the file
 * as in the DOM. Comments are stripped first, because a comment explaining
 * why "Mock Exams" was retired has to be allowed to say "Mock Exams".
 */

const here = dirname(fileURLToPath(import.meta.url));
const read = (rel: string) => readFileSync(join(here, rel), 'utf8');

/** Source with block comments, line comments and JSX comments removed. */
function codeOnly(src: string): string {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\/\/[^\n]*/g, '')
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, '');
}

const app = codeOnly(read('../../App.tsx'));
const exams = codeOnly(read('../exams/ExamsManager.tsx'));
const analytics = codeOnly(read('../analytics/AnalyticsView.tsx'));
const notes = codeOnly(read('../notes/NotesManager.tsx'));
const hubTabs = read('../nav/HubTabs.tsx');
const blueprint = codeOnly(read('../../services/examBlueprint.ts'));

describe('CONTEXT.md glossary: the forbidden near-misses are not shown', () => {
  it('never says "mock" — an Exam is an Exam', () => {
    for (const [name, src] of [
      ['App.tsx', app],
      ['ExamsManager.tsx', exams],
      ['AnalyticsView.tsx', analytics],
      ['examBlueprint.ts', blueprint],
    ] as const) {
      expect(src.toLowerCase(), `${name} still says "mock"`).not.toContain('mock');
    }
  });

  it('never calls a Subject a course, class or folder', () => {
    for (const [name, src] of [
      ['NotesManager.tsx', notes],
      ['ExamsManager.tsx', exams],
      ['AnalyticsView.tsx', analytics],
    ] as const) {
      for (const banned of ['course', 'folder']) {
        expect(src.toLowerCase(), `${name} still says "${banned}"`).not.toContain(banned);
      }
    }

    // App.tsx is checked with its palette `keywords` removed. Those are search
    // matches, never rendered: a learner who still types "course" should find
    // "Add a Subject". Matching on a retired term is not showing one.
    const displayed = app.replace(/keywords:\s*'[^\n]*\n/g, '');
    for (const banned of ['course', 'folder']) {
      // Word-boundary match: `FolderPlus` is a lucide icon identifier, not a
      // word shown to anyone.
      const re = new RegExp(`\\b${banned}\\b`, 'i');
      expect(re.test(displayed), `App.tsx still shows "${banned}"`).toBe(false);
    }
    expect(app).toContain(`keywords: 'course class new'`);
  });

  it('calls raw study text Material, not course content', () => {
    expect(notes).toContain('Upload Material (.pdf, .txt)');
    expect(notes).not.toContain('Course Lecture Material');
  });
});

describe('hub names are the canonical nouns', () => {
  it('labels the five hubs Notes / Quizzes / Exams / Progress / Planner', () => {
    expect(app).toContain(`{ id: 'notes', label: 'Interactive Notes', shortLabel: 'Notes'`);
    expect(app).toContain(`{ id: 'quizzes', label: 'Flashcard Quizzes', shortLabel: 'Quizzes'`);
    expect(app).toContain(`{ id: 'exams', label: 'Exams', shortLabel: 'Exams'`);
    expect(app).toContain(`{ id: 'analytics', label: 'Analytics & Progress', shortLabel: 'Progress'`);
    expect(app).toContain(`{ id: 'planner', label: 'Study Planner', shortLabel: 'Planner'`);
  });
});

describe('Add Subject modal', () => {
  it('is titled after the thing it creates', () => {
    expect(app).toContain('title="Add Subject"');
    expect(app).toContain('Subject Name');
    expect(app).toContain('Subject Code (Optional)');
  });

  it('describes a Subject the way CONTEXT.md defines it', () => {
    // CONTEXT.md: "Every Note, Quiz, Exam Attempt and Study Task belongs to
    // exactly one Subject." The subtitle is that sentence, not "a folder".
    expect(app).toContain(
      'subtitle="Every Note, Quiz, Exam and Study Task belongs to one Subject."'
    );
  });
});

describe('no-sidebar shell (ADR-0006)', () => {
  it('does not send learners to a sidebar that was removed', () => {
    expect(notes.toLowerCase()).not.toContain('sidebar');
    expect(notes).toContain('Choose a Note from the list');
  });

  it('names the Notes list a column, which is what it is', () => {
    expect(notes).toContain('notes-list-col');
    expect(notes).not.toContain('Sidebar List');
  });
});

describe('hub navigation is legible and named at every width', () => {
  it('offers a compact label for the five-across mobile bar', () => {
    expect(hubTabs).toContain('shortLabel?: string');
    expect(hubTabs).toContain('{item.shortLabel ?? item.label}');
  });

  it('keeps the full label as the accessible name in both bars', () => {
    // The desktop tab hides its text below xl and the icon is aria-hidden, so
    // without aria-label the button has no accessible name at all; `title` is
    // not exposed reliably by screen readers.
    expect(hubTabs.match(/aria-label=\{item\.label\}/g)?.length).toBe(2);
  });
});

describe('the ⌘K hint names both keys', () => {
  it('renders the modifier and the letter as two keycaps', () => {
    // Collapsing both into one <Kbd> showed a bare "⌘" on a Mac: the modifier
    // varied, the letter did not.
    expect(app).toContain(`<Kbd>{isMac ? '⌘' : 'Ctrl'}</Kbd>`);
    expect(app).toContain('<Kbd>K</Kbd>');
  });
});

describe('a dialog owns the keyboard, including the palette shortcut', () => {
  it('checks the modal registry before any app-wide shortcut', () => {
    // Cmd/Ctrl+K used to be handled *above* the registry guard, so it stacked
    // the palette over a live dialog: two surfaces each believing they own the
    // keyboard, and an Escape that closes one landing on the other.
    const guard = app.indexOf('isAnyModalOpen()');
    const palette = app.indexOf(`e.key.toLowerCase() === 'k'`);
    expect(guard).toBeGreaterThan(-1);
    expect(palette).toBeGreaterThan(-1);
    expect(guard, 'the registry guard must come first').toBeLessThan(palette);
  });
});

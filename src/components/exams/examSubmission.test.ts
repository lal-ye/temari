import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { retakeTimeLimit } from '../../services/examBlueprint';

/**
 * Exam submission and retake guards.
 *
 * The exam is the one place in Temari where a silent failure costs the
 * learner real time: a 25-minute sitting that never records. These tests
 * pin the contracts that were broken when this file was written.
 */
const here = dirname(fileURLToPath(import.meta.url));
const taking = readFileSync(join(here, './ExamTakingView.tsx'), 'utf8');
const manager = readFileSync(join(here, './ExamsManager.tsx'), 'utf8');

describe('ExamTakingView: one submit latch', () => {
  it('sets the submitted latch in exactly one place', () => {
    // Two copies of the latch — one in the countdown path, one in the
    // handler — meant the countdown set it and the handler then bailed on
    // it: time expiry submitted nothing, and every Submit afterwards was
    // swallowed. The latch belongs to `handleSubmitExam` alone.
    const sets = taking.match(/submittedRef\.current = true/g) ?? [];
    expect(sets).toHaveLength(1);
  });

  it('the countdown path delegates to handleSubmitExam without pre-checking', () => {
    expect(taking).toMatch(/submitRef\.current = \(\) => \{\s*void handleSubmitExam\(\);\s*\};/);
  });

  it('grading is abortable and aborted on unmount', () => {
    expect(taking).toContain('signal: controller.signal');
    expect(taking).toMatch(/useEffect\(\(\) => \(\) => gradingRef\.current\?\.abort\(\), \[\]\)/);
    expect(taking).toContain('if (controller.signal.aborted || isAbortError(err)) return;');
  });

  it('the last-resort local grade is labelled offline and names the topics missed', () => {
    const fallback = taking.slice(taking.indexOf('Last-resort local grading'));
    expect(fallback).toContain('gradedOffline: true');
    expect(fallback).not.toContain("topicsToReview: ['Key Principles Review']");
  });

  it('offers a way out (Leave) that goes through confirm() and records nothing', () => {
    expect(taking).toContain("title: 'Leave this exam?'");
    expect(taking).toContain('if (ok) onCancel();');
  });

  it('the Submit confirm starts focused on Submit; destructive confirms keep the safe default', () => {
    const block = (title: string) => {
      const start = taking.indexOf(title);
      return taking.slice(start, taking.indexOf('});', start));
    };
    expect(block("title: 'Submit the Exam?'")).toContain("initialFocus: 'confirm'");
    expect(block("title: 'Leave this exam?'")).not.toContain('initialFocus');
  });
});

describe('ExamsManager: retakes', () => {
  it('captures the Subject at exam start instead of reading it live', () => {
    expect(manager).toContain('subjectId: activeSubject.id,');
    expect(manager).toContain('subjectId={takingExam.subjectId}');
    expect(manager).toContain('subjectName={takingExam.subjectName}');
    expect(manager).not.toContain('subjectId={activeSubject.id}');
  });

  it('hides Retake when the Attempt has no questions', () => {
    expect(manager).toMatch(/onRetake=\{\s*retakeable\s*\?/);
  });

  it('files a retake under the Attempt’s own Subject and keeps its provenance', () => {
    const retake = manager.slice(manager.indexOf('retakeable'), manager.indexOf('onBack='));
    expect(retake).toContain('subjectId: viewingAttempt.subjectId');
    expect(retake).toContain('cognitiveMix: viewingAttempt.cognitiveMix');
    expect(retake).toContain('knowledgeUnitTargeted: viewingAttempt.knowledgeUnitTargeted');
    expect(retake).toContain('shuffleExamOptions(');
  });
});

describe('retakeTimeLimit', () => {
  it('reconstructs the smallest offered limit that covers the original sitting', () => {
    expect(retakeTimeLimit({ timeSpentSeconds: 22 * 60 })).toBe(25);
    expect(retakeTimeLimit({ timeSpentSeconds: 9 * 60 })).toBe(10);
    expect(retakeTimeLimit({ timeSpentSeconds: 10 * 60 })).toBe(10);
    expect(retakeTimeLimit({ timeSpentSeconds: 15 * 60 + 1 })).toBe(25);
  });

  it('caps at the longest offered limit', () => {
    expect(retakeTimeLimit({ timeSpentSeconds: 90 * 60 })).toBe(45);
  });

  it('falls back to the form default when the sitting length is unknown or nonsense', () => {
    expect(retakeTimeLimit({})).toBe(15);
    expect(retakeTimeLimit({ timeSpentSeconds: 0 })).toBe(15);
    expect(retakeTimeLimit({ timeSpentSeconds: Number.NaN })).toBe(15);
    expect(retakeTimeLimit({ timeSpentSeconds: -5 })).toBe(15);
  });
});

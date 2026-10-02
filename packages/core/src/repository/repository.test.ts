import { describe, expect, it } from 'vitest';
import { createPortableExport, type PortableExport, type PortableExportInput } from '../portable';
import { createInMemoryBackend } from './inMemoryBackend';
import { createStudyRepository, type StudyBackend, type StudySnapshot } from './studyRepository';
import type { StoredAttempt } from '../types';

const exportedAt = '2026-09-21T10:00:00.000Z';

/** Mirrors the canonical sample from portable.test.ts (plan §6: validated input in). */
function sampleExport(): PortableExport {
  return createPortableExport(sampleInput(), exportedAt);
}

function sampleInput(): PortableExportInput {
  return {
    data: {
      subjects: [
        { id: 'subject-1', name: 'Cellular Biology', amharicName: 'የህዋስ ባዮሎጂ', createdAt: exportedAt },
      ],
      notes: [
        {
          id: 'note-1',
          subjectId: 'subject-1',
          title: 'ATP synthesis',
          content: 'Glycolysis runs in the cytosol.',
          createdAt: exportedAt,
          updatedAt: exportedAt,
        },
      ],
      quizzes: [
        {
          id: 'quiz-1',
          subjectId: 'subject-1',
          name: 'Recall',
          flashcards: [
            { id: 'flashcard-1', question: 'Where is glycolysis located?', answer: 'The cytosol.', difficulty: 'Easy' },
          ],
          quizLengthUsed: 1,
          difficulty: 'Easy',
          createdAt: exportedAt,
          updatedAt: exportedAt,
        },
      ],
      attempts: [
        {
          id: 'attempt-1',
          subjectId: 'subject-1',
          subjectName: 'Cellular Biology',
          name: 'Recall Drill',
          type: 'Quiz',
          date: exportedAt,
          overallScore: 100,
          totalQuestions: 1,
          correctQuestions: 1,
        },
      ],
      tasks: [
        { id: 'task-1', subjectId: 'subject-1', title: 'Review ATP', dueDate: '2026-09-22', completed: false },
      ],
    },
    preferences: { theme: 'neobrutalist' },
  };
}

function emptyBackend(): StudyBackend {
  return {
    load: () => Promise.resolve(null),
    persist: () => Promise.resolve(),
  };
}

/** Backend whose persist rejects — simulates a disk-write failure (plan §12). */
function failingBackend(): StudyBackend {
  return {
    load: () => Promise.resolve(null),
    persist: () => Promise.reject(new Error('disk full')),
  };
}

/** Records every persisted snapshot so tests can count writes (plan §12: one op, D8). */
function recordingBackend(): StudyBackend & { snapshots: StudySnapshot[] } {
  const snapshots: StudySnapshot[] = [];
  return {
    snapshots,
    load: () => Promise.resolve(null),
    persist: (snapshot) => {
      snapshots.push(snapshot);
      return Promise.resolve();
    },
  };
}

/** A Drill Attempt as the screen will hand it over (built by drillCompletion §5.3). */
function drillAttempt(id: string, overallScore: number, correctQuestions: number): StoredAttempt {
  return {
    id,
    subjectId: 'subject-1',
    subjectName: 'Cellular Biology',
    name: 'Recall',
    type: 'Quiz',
    date: '2026-10-02T09:00:00.000Z',
    overallScore,
    totalQuestions: 1,
    correctQuestions,
    topicsToReview: [],
  };
}

describe('StudyRepository', () => {
  it('boots to an empty library when the backend has nothing persisted', async () => {
    const repository = await createStudyRepository(emptyBackend());

    expect(repository.listSubjects()).toEqual([]);
    expect(repository.listAttempts('any-subject')).toEqual([]);
    expect(repository.getSubject('any-subject')).toBeNull();
  });

  it('imports a portable export and reports per-collection counts', async () => {
    const repository = await createStudyRepository(emptyBackend());

    const counts = await repository.importPortable(sampleExport());

    expect(counts).toEqual({ subjects: 1, notes: 1, quizzes: 1, attempts: 1, tasks: 1, flashcards: 1 });
  });

  it('rejects a failing import and leaves the library untouched', async () => {
    const repository = await createStudyRepository(failingBackend());

    await expect(repository.importPortable(sampleExport())).rejects.toThrow('disk full');

    expect(repository.listSubjects()).toEqual([]);
    expect(repository.snapshot().notes).toEqual([]);
  });

  it('keeps the previous library when a replacement import fails to persist', async () => {
    // Backend fails only on the second persist: first import lands, second must not
    // wipe it (plan §12: import cancellation/disk failure never destroys old data).
    let persistCount = 0;
    const backend: StudyBackend = {
      load: () => Promise.resolve(null),
      persist: () => {
        persistCount += 1;
        return persistCount === 1 ? Promise.resolve() : Promise.reject(new Error('disk full'));
      },
    };
    const repository = await createStudyRepository(backend);
    await repository.importPortable(sampleExport());

    const replacement = sampleExport();
    replacement.data.subjects[0].name = 'Replacement Subject';
    await expect(repository.importPortable(replacement)).rejects.toThrow('disk full');

    expect(repository.listSubjects()).toHaveLength(1);
    expect(repository.listSubjects()[0].name).toBe('Cellular Biology');
    expect(repository.getNote('subject-1', 'note-1')).not.toBeNull();
  });

  it('re-importing the same file produces identical state', async () => {
    // §12: no nondeterminism — replace is a pure function of (old snapshot, file).
    const repository = await createStudyRepository(emptyBackend());
    await repository.importPortable(sampleExport());
    const afterFirst = repository.snapshot();
    const second = sampleExport();

    await repository.importPortable(second);

    expect(repository.snapshot()).toEqual(afterFirst);
  });

  it('scopes note and quiz reads to the subject', async () => {
    const repository = await createStudyRepository(emptyBackend());
    await repository.importPortable(sampleExport());

    expect(repository.getNote('subject-1', 'note-1')?.title).toBe('ATP synthesis');
    expect(repository.getNote('other-subject', 'note-1')).toBeNull();
    expect(repository.getQuiz('subject-1', 'quiz-1')?.name).toBe('Recall');
    expect(repository.getQuiz('other-subject', 'quiz-1')).toBeNull();
    expect(repository.listNotes('subject-1')).toHaveLength(1);
    expect(repository.listNotes('other-subject')).toEqual([]);
    expect(repository.listQuizzes('subject-1')).toHaveLength(1);
    expect(repository.listQuizzes('other-subject')).toEqual([]);
  });

  it('records a drill finish as one write: attempt prepended, quiz metadata bumped', async () => {
    const backend = recordingBackend();
    const repository = await createStudyRepository(backend);
    await repository.importPortable(sampleExport());

    await repository.recordDrillFinish(drillAttempt('attempt-2', 100, 1), 'quiz-1');

    expect(backend.snapshots).toHaveLength(2); // import + finish — the finish was ONE persist
    const attempts = repository.listAttempts('subject-1');
    expect(attempts.map((attempt) => attempt.id)).toEqual(['attempt-2', 'attempt-1']);
    const quiz = repository.getQuiz('subject-1', 'quiz-1');
    expect(quiz?.lastScore).toBe(100);
    expect(quiz?.timesPracticed).toBe(1);
  });

  it('rejects a finish for an unknown quiz without persisting', async () => {
    const backend = recordingBackend();
    const repository = await createStudyRepository(backend);
    await repository.importPortable(sampleExport());

    await expect(repository.recordDrillFinish(drillAttempt('attempt-2', 100, 1), 'missing-quiz')).rejects.toThrow(
      'missing-quiz',
    );

    expect(backend.snapshots).toHaveLength(1); // only the import
    expect(repository.listAttempts('subject-1')).toHaveLength(1);
  });

  it('keeps two finishes distinct and newest-first even with same-millisecond ids', async () => {
    // The web bug class (§12): att-Date.now collided. Ids are injected (D6), but the
    // repository must still keep both records and order them by insertion.
    const repository = await createStudyRepository(emptyBackend());
    await repository.importPortable(sampleExport());

    await repository.recordDrillFinish(drillAttempt('attempt-same', 100, 1), 'quiz-1');
    await repository.recordDrillFinish(drillAttempt('attempt-same', 0, 0), 'quiz-1');

    const attempts = repository.listAttempts('subject-1');
    expect(attempts.map((attempt) => attempt.id)).toEqual(['attempt-same', 'attempt-same', 'attempt-1']);
    expect(attempts[0].overallScore).toBe(0); // latest first
    expect(repository.getQuiz('subject-1', 'quiz-1')?.timesPracticed).toBe(2);
    expect(repository.getQuiz('subject-1', 'quiz-1')?.lastScore).toBe(0);
  });

  it('serializes concurrent finishes so neither write is lost', async () => {
    const repository = await createStudyRepository(emptyBackend());
    await repository.importPortable(sampleExport());

    const first = repository.recordDrillFinish(drillAttempt('attempt-a', 100, 1), 'quiz-1');
    const second = repository.recordDrillFinish(drillAttempt('attempt-b', 50, 0), 'quiz-1');
    await Promise.all([first, second]);

    expect(repository.listAttempts('subject-1').map((attempt) => attempt.id)).toEqual([
      'attempt-b',
      'attempt-a',
      'attempt-1',
    ]);
    expect(repository.getQuiz('subject-1', 'quiz-1')?.timesPracticed).toBe(2);
  });

  it('never aliases the importer object graph', async () => {
    const repository = await createStudyRepository(emptyBackend());
    const value = sampleExport();
    await repository.importPortable(value);

    value.data.subjects[0].name = 'Mutated';
    value.data.notes[0].title = 'Mutated';

    expect(repository.getSubject('subject-1')?.name).toBe('Cellular Biology');
    expect(repository.getNote('subject-1', 'note-1')?.title).toBe('ATP synthesis');
  });

  it('leaves the library intact when a finish write fails, and a retry lands', async () => {
    let persistCount = 0;
    const backend: StudyBackend = {
      load: () => Promise.resolve(null),
      persist: () => {
        persistCount += 1;
        return persistCount === 2 ? Promise.reject(new Error('disk full')) : Promise.resolve();
      },
    };
    const repository = await createStudyRepository(backend);
    await repository.importPortable(sampleExport());

    await expect(repository.recordDrillFinish(drillAttempt('attempt-2', 100, 1), 'quiz-1')).rejects.toThrow('disk full');

    // Zero observable change: attempt list and quiz metadata untouched.
    expect(repository.listAttempts('subject-1').map((attempt) => attempt.id)).toEqual(['attempt-1']);
    expect(repository.getQuiz('subject-1', 'quiz-1')?.timesPracticed).toBeUndefined();

    await repository.recordDrillFinish(drillAttempt('attempt-2', 100, 1), 'quiz-1');

    expect(repository.listAttempts('subject-1').map((attempt) => attempt.id)).toEqual(['attempt-2', 'attempt-1']);
    expect(repository.getQuiz('subject-1', 'quiz-1')?.timesPracticed).toBe(1);
  });

  it('round-trips a library across repositories through the in-memory backend', async () => {
    // ADR-0001's two-adapter proof: the same backend hands the next repository
    // exactly what the last one persisted (M3 gate: restart → persists).
    const backend = createInMemoryBackend();
    const first = await createStudyRepository(backend);
    await first.importPortable(sampleExport());
    await first.recordDrillFinish(drillAttempt('attempt-2', 100, 1), 'quiz-1');

    const second = await createStudyRepository(backend);

    expect(second.listSubjects()).toEqual(first.listSubjects());
    expect(second.listAttempts('subject-1').map((attempt) => attempt.id)).toEqual(['attempt-2', 'attempt-1']);
    expect(second.getNote('subject-1', 'note-1')?.title).toBe('ATP synthesis');
    expect(second.getQuiz('subject-1', 'quiz-1')?.timesPracticed).toBe(1);
  });

  it('lists a subject\'s attempts in stored order', async () => {
    const repository = await createStudyRepository(emptyBackend());
    await repository.importPortable(sampleExport());

    const attempts = repository.listAttempts('subject-1');

    expect(attempts).toHaveLength(1);
    expect(attempts[0].name).toBe('Recall Drill');
    expect(repository.listAttempts('other-subject')).toEqual([]);
  });

  it('summarizes subjects with note and quiz counts after import', async () => {
    const repository = await createStudyRepository(emptyBackend());
    await repository.importPortable(sampleExport());

    expect(repository.listSubjects()).toEqual([
      {
        id: 'subject-1',
        name: 'Cellular Biology',
        amharicName: 'የህዋስ ባዮሎጂ',
        createdAt: exportedAt,
        noteCount: 1,
        quizCount: 1,
      },
    ]);
  });
});

import { describe, expect, it } from 'vitest';
import {
  migrateLegacyBackup,
  parsePortableExport,
  serializePortableExport,
  validatePortableExport,
  PortableValidationError,
  type PortableExportInput,
} from './portable';

const exportedAt = '2026-09-21T10:00:00.000Z';

function sampleInput(): PortableExportInput {
  return {
    data: {
      subjects: [
        {
          id: 'subject-1',
          name: 'Cellular Biology',
          amharicName: 'የህዋስ ባዮሎጂ',
          createdAt: exportedAt,
        },
      ],
      notes: [
        {
          id: 'note-1',
          subjectId: 'subject-1',
          title: 'ATP synthesis',
          content: 'A credential-like string in note content is learner data, not settings.',
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
            {
              id: 'flashcard-1',
              question: 'Where is glycolysis located?',
              answer: 'The cytosol.',
              difficulty: 'Easy',
            },
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
        {
          id: 'task-1',
          subjectId: 'subject-1',
          title: 'Review ATP',
          dueDate: '2026-09-22',
          completed: false,
        },
      ],
    },
    preferences: { theme: 'neobrutalist' },
  };
}

describe('portable Android contract', () => {
  it('serializes only the allowlisted study data and round-trips it', () => {
    const json = serializePortableExport(sampleInput(), exportedAt);
    const parsed = parsePortableExport(json);

    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.value.format).toBe('temari-portable');
    expect(parsed.value.schemaVersion).toBe(1);
    expect(parsed.value.data.notes[0].id).toBe('note-1');
    expect(parsed.value.data.subjects[0].amharicName).toBe('የህዋስ ባዮሎጂ');
    expect(parsed.counts).toEqual({ subjects: 1, notes: 1, quizzes: 1, attempts: 1, tasks: 1, flashcards: 1 });
    expect(json).not.toContain('providerKeys');
    expect(json).not.toContain('apiKey');
  });

  it('strips unknown fields when creating an export', () => {
    const input = sampleInput() as PortableExportInput & { settings?: unknown; token?: string };
    input.settings = { apiKey: 'discarded-field-value' };
    input.token = 'discarded-token-value';

    const json = serializePortableExport(input, exportedAt);

    expect(json).not.toContain('discarded-field-value');
    expect(json).not.toContain('discarded-token-value');
    expect(json).not.toContain('"settings"');
  });

  it('rejects invalid subject references before any consumer can write', () => {
    const input = sampleInput();
    input.data.notes[0].subjectId = 'missing-subject';

    const result = validatePortableExport({
      format: 'temari-portable',
      schemaVersion: 1,
      exportedAt,
      data: input.data,
      preferences: input.preferences,
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors.some((error) => error.code === 'invalid_reference')).toBe(true);
  });

  it('rejects duplicate IDs across exported records', () => {
    const input = sampleInput();
    input.data.tasks[0].id = 'note-1';

    const result = validatePortableExport({
      format: 'temari-portable',
      schemaVersion: 1,
      exportedAt,
      data: input.data,
      preferences: input.preferences,
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors.some((error) => error.code === 'duplicate_id')).toBe(true);
  });

  it('migrates a legacy backup without copying credential-bearing settings', () => {
    const input = sampleInput();
    const migration = migrateLegacyBackup({
      version: 1,
      timestamp: exportedAt,
      subjects: input.data.subjects,
      notes: input.data.notes,
      quizzes: input.data.quizzes,
      attempts: input.data.attempts,
      tasks: input.data.tasks,
      settings: {
        theme: 'dark',
        apiKey: 'discarded-legacy-field',
        providerKeys: { gemini: 'discarded-provider-field' },
        customBaseUrl: 'discarded-url-field',
      },
    });

    expect(migration.value.preferences.theme).toBe('dark');
    expect(migration.warnings).toHaveLength(1);
    expect(JSON.stringify(migration.value)).not.toContain('discarded-legacy-field');
    expect(JSON.stringify(migration.value)).not.toContain('discarded-provider-field');
    expect(JSON.stringify(migration.value)).not.toContain('customBaseUrl');
  });

  it('rejects corrupt JSON and newer schemas', () => {
    expect(parsePortableExport('{not json')).toMatchObject({
      ok: false,
      errors: [{ code: 'invalid_json' }],
    });

    const newer = JSON.parse(serializePortableExport(sampleInput(), exportedAt)) as Record<string, unknown>;
    newer.schemaVersion = 2;
    const result = validatePortableExport(newer);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors.some((error) => error.code === 'unsupported_schema')).toBe(true);
  });

  it('rejects impossible calendar dates and malformed legacy records', () => {
    const input = sampleInput();
    input.data.tasks[0].dueDate = '2026-02-30';
    const invalidDate = validatePortableExport({
      format: 'temari-portable',
      schemaVersion: 1,
      exportedAt,
      data: input.data,
      preferences: input.preferences,
    });

    expect(invalidDate.ok).toBe(false);
    if (invalidDate.ok) return;
    expect(invalidDate.errors.some((error) => error.path.endsWith('.dueDate'))).toBe(true);

    expect(() =>
      migrateLegacyBackup({
        version: 1,
        timestamp: exportedAt,
        subjects: [null],
        notes: [],
        quizzes: [],
        attempts: [],
        tasks: [],
      })
    ).toThrow(PortableValidationError);
  });
});

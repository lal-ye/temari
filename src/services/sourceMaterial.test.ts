import { describe, it, expect } from 'vitest';
import {
  resolveSourceMaterial,
  EMPTY_SOURCE_ERROR,
} from './sourceMaterial';
import type { StoredNote } from '../types';

/**
 * Pure-module tests: the resolver takes pre-filtered subject notes and plain
 * values, so no storage or React is involved (ADR-0007).
 */

function makeNote(overrides: Partial<StoredNote> = {}): StoredNote {
  return {
    id: 'note-1',
    subjectId: 'subj-1',
    title: 'Cell Bio',
    content: 'Mitosis is cell division.',
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
    ...overrides,
  };
}

describe('resolveSourceMaterial', () => {
  const notes = [
    makeNote({ id: 'a', content: 'Alpha content' }),
    makeNote({ id: 'b', content: 'Beta content' }),
  ];

  it('returns the selected note content when a note id is provided', () => {
    const result = resolveSourceMaterial(
      { sourceOption: 'subjectNotes', selectedNoteId: 'b' },
      notes,
    );
    expect(result).toEqual({ ok: true, text: 'Beta content', noteIds: ['b'] });
  });

  it('aggregates all notes in caller-provided order when no note is selected', () => {
    const result = resolveSourceMaterial({ sourceOption: 'subjectNotes' }, notes);
    expect(result).toEqual({
      ok: true,
      text: 'Alpha content\n\nBeta content',
      noteIds: ['a', 'b'],
    });
  });

  it('skips notes with blank content when aggregating', () => {
    const result = resolveSourceMaterial({ sourceOption: 'subjectNotes' }, [
      makeNote({ id: 'a', content: '   ' }),
      makeNote({ id: 'b', content: 'Real content' }),
    ]);
    expect(result).toEqual({ ok: true, text: 'Real content', noteIds: ['b'] });
  });

  it('returns an empty-selection error for an unknown selected note id', () => {
    const result = resolveSourceMaterial(
      { sourceOption: 'subjectNotes', selectedNoteId: 'missing' },
      notes,
    );
    expect(result).toEqual({ ok: false, error: EMPTY_SOURCE_ERROR });
  });

  it('returns an empty-selection error when no notes have content', () => {
    const result = resolveSourceMaterial({ sourceOption: 'subjectNotes' }, []);
    expect(result).toEqual({ ok: false, error: EMPTY_SOURCE_ERROR });
  });

  it('returns trimmed custom text for the customText option', () => {
    const result = resolveSourceMaterial(
      { sourceOption: 'customText', customMaterial: '  pasted material  ' },
      notes,
    );
    expect(result).toEqual({ ok: true, text: 'pasted material', noteIds: [] });
  });

  it('returns an empty-selection error for blank custom text', () => {
    const result = resolveSourceMaterial(
      { sourceOption: 'customText', customMaterial: '   ' },
      notes,
    );
    expect(result).toEqual({ ok: false, error: EMPTY_SOURCE_ERROR });
  });
});

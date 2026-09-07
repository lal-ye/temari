import type { StoredNote } from '../types';

/**
 * Source-Material module (ADR-0007).
 *
 * Pure resolution of "which text do we generate from" for Quiz and Exam
 * generation. `subjectNotes` must already be scoped to the active subject
 * (pass `useNotes()` straight in — subject filtering stays in the Study-Store,
 * ADR-0001).
 */

export type SourceOption = 'subjectNotes' | 'customText';

export interface SourceMaterialRequest {
  sourceOption: SourceOption;
  /** When set with sourceOption 'subjectNotes', only this note is used. */
  selectedNoteId?: string;
  /** Fallback text used when sourceOption is 'customText'. Trimmed before use. */
  customMaterial?: string;
}

export type SourceMaterialResult =
  | { ok: true; text: string; noteIds: string[] }
  | { ok: false; error: string };

export const EMPTY_SOURCE_ERROR =
  'Please select a study note or provide source material text.';

export function resolveSourceMaterial(
  request: SourceMaterialRequest,
  subjectNotes: StoredNote[],
): SourceMaterialResult {
  if (request.sourceOption === 'customText') {
    const text = (request.customMaterial ?? '').trim();
    return text ? { ok: true, text, noteIds: [] } : { ok: false, error: EMPTY_SOURCE_ERROR };
  }

  // subjectNotes
  if (request.selectedNoteId) {
    const note = subjectNotes.find((n) => n.id === request.selectedNoteId);
    if (!note || !note.content.trim()) {
      return { ok: false, error: EMPTY_SOURCE_ERROR };
    }
    return { ok: true, text: note.content, noteIds: [note.id] };
  }

  // Aggregate all notes, preserving the caller-provided (store insertion) order.
  const notesWithContent = subjectNotes.filter((n) => n.content.trim());
  if (notesWithContent.length === 0) {
    return { ok: false, error: EMPTY_SOURCE_ERROR };
  }
  return {
    ok: true,
    text: notesWithContent.map((n) => n.content).join('\n\n'),
    noteIds: notesWithContent.map((n) => n.id),
  };
}

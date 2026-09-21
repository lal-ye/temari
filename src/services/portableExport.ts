import {
  parsePortableExport,
  serializePortableExport,
  type PortableCounts,
  type PortableExportInput,
} from '@temari/core';
import { studyStore } from '../hooks/useStudyStore';
import type { StudyStore } from './studyStore';

/**
 * Build the Android transfer snapshot without ever passing the web settings
 * object into the portable package. The theme is the only preference allowed
 * by the v1 contract; provider keys and URLs are deliberately unreachable from
 * this input.
 */
export function buildPortableExportInput(
  store: Pick<StudyStore, 'subjects' | 'notes' | 'quizzes' | 'attempts' | 'tasks' | 'settings'> = studyStore
): PortableExportInput {
  return {
    data: {
      subjects: store.subjects,
      notes: store.notes,
      quizzes: store.quizzes,
      attempts: store.attempts,
      tasks: store.tasks,
    },
    preferences: {
      theme: store.settings.theme,
    },
  };
}

export interface PortableDownload {
  fileName: string;
  counts: PortableCounts;
}

/** Browser-only download adapter. The core package itself remains environment-neutral. */
export function downloadPortableExport(): PortableDownload {
  if (typeof document === 'undefined' || typeof URL === 'undefined') {
    throw new Error('Android export is only available in a browser.');
  }

  const json = serializePortableExport(buildPortableExportInput());
  const parsed = parsePortableExport(json);
  if (!parsed.ok) throw new Error('Generated Android export failed its validation check.');

  const fileName = `temari-portable-${new Date().toISOString().slice(0, 10)}.json`;
  const blob = new Blob([json], { type: 'application/json;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  link.rel = 'noopener';
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);

  return { fileName, counts: parsed.counts };
}

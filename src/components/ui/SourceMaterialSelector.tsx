import React from 'react';
import { StoredNote } from '../../types';

interface SourceMaterialSelectorProps {
  sourceOption: 'subjectNotes' | 'customText';
  onSourceOptionChange: (option: 'subjectNotes' | 'customText') => void;
  subjectNotes: StoredNote[];
  selectedNoteId: string;
  onSelectedNoteIdChange: (id: string) => void;
  customMaterial: string;
  onCustomMaterialChange: (val: string) => void;
  subjectName: string;
  isGenerating?: boolean;
  notesLabel?: string;
  customLabel?: string;
  customPlaceholder?: string;
}

/** One class string for every text field in the editorial design language. */
const fieldClass =
  'w-full px-3.5 py-2 text-sm bg-background border border-border rounded-lg font-medium focus:outline-hidden focus:ring-2 focus:ring-ring/50 shadow-2xs disabled:opacity-60';

/**
 * Reusable Source Material Selector.
 * Unifies material selection across Quizzes and Exams (Ponytail Rung 2: Codebase Reuse).
 */
export const SourceMaterialSelector: React.FC<SourceMaterialSelectorProps> = ({
  sourceOption,
  onSourceOptionChange,
  subjectNotes,
  selectedNoteId,
  onSelectedNoteIdChange,
  customMaterial,
  onCustomMaterialChange,
  subjectName,
  isGenerating = false,
  notesLabel = 'Use Saved Notes',
  customLabel = 'Paste Custom Text',
  customPlaceholder = 'Paste notes or study excerpt...',
}) => {
  return (
    <div>
      <label className="block text-xs font-bold uppercase tracking-wider text-foreground mb-1">
        Source Material
      </label>
      <div className="flex gap-4 mb-2">
        <label className="flex items-center gap-2 text-xs font-semibold text-foreground cursor-pointer">
          <input
            type="radio"
            name={`sourceOption-${subjectName}`}
            checked={sourceOption === 'subjectNotes'}
            onChange={() => onSourceOptionChange('subjectNotes')}
            className="accent-amber-600"
            disabled={isGenerating}
          />
          {notesLabel} ({subjectNotes.length} available)
        </label>
        <label className="flex items-center gap-2 text-xs font-semibold text-foreground cursor-pointer">
          <input
            type="radio"
            name={`sourceOption-${subjectName}`}
            checked={sourceOption === 'customText'}
            onChange={() => onSourceOptionChange('customText')}
            className="accent-amber-600"
            disabled={isGenerating}
          />
          {customLabel}
        </label>
      </div>

      {sourceOption === 'subjectNotes' ? (
        subjectNotes.length > 0 ? (
          <select
            value={selectedNoteId}
            onChange={(e) => onSelectedNoteIdChange(e.target.value)}
            className={fieldClass}
            disabled={isGenerating}
          >
            <option value="">All Notes Combined in {subjectName}</option>
            {subjectNotes.map((n) => (
              <option key={n.id} value={n.id}>
                {n.title}
              </option>
            ))}
          </select>
        ) : (
          <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-lg text-xs font-medium text-amber-700 dark:text-amber-400">
            No notes created yet for this subject. Switch to &ldquo;{customLabel}&rdquo; or generate notes first.
          </div>
        )
      ) : (
        <textarea
          rows={4}
          value={customMaterial}
          onChange={(e) => onCustomMaterialChange(e.target.value)}
          placeholder={customPlaceholder}
          className={`${fieldClass} font-mono`}
          disabled={isGenerating}
        />
      )}
    </div>
  );
};

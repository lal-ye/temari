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
      <label className="block text-xs font-black uppercase tracking-wider text-slate-800 mb-1">
        Source Material
      </label>
      <div className="flex gap-4 mb-2">
        <label className="flex items-center gap-2 text-xs font-bold text-slate-800 cursor-pointer">
          <input
            type="radio"
            name={`sourceOption-${subjectName}`}
            checked={sourceOption === 'subjectNotes'}
            onChange={() => onSourceOptionChange('subjectNotes')}
            className="accent-slate-900"
            disabled={isGenerating}
          />
          {notesLabel} ({subjectNotes.length} available)
        </label>
        <label className="flex items-center gap-2 text-xs font-bold text-slate-800 cursor-pointer">
          <input
            type="radio"
            name={`sourceOption-${subjectName}`}
            checked={sourceOption === 'customText'}
            onChange={() => onSourceOptionChange('customText')}
            className="accent-slate-900"
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
            className="w-full px-3.5 py-2 text-xs bg-[#FAF8F5] border-2 border-slate-900 rounded-xl font-bold focus:outline-hidden focus:ring-2 focus:ring-amber-400 shadow-neo-sm"
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
          <div className="p-3 bg-amber-50 border-2 border-slate-900 rounded-xl text-xs font-bold text-slate-900">
            No notes created yet for this subject. Switch to &ldquo;{customLabel}&rdquo; or generate notes first.
          </div>
        )
      ) : (
        <textarea
          rows={4}
          value={customMaterial}
          onChange={(e) => onCustomMaterialChange(e.target.value)}
          placeholder={customPlaceholder}
          className="w-full p-3 text-xs bg-[#FAF8F5] border-2 border-slate-900 rounded-xl font-mono focus:outline-hidden focus:ring-2 focus:ring-amber-400 shadow-neo-sm"
          disabled={isGenerating}
        />
      )}
    </div>
  );
};

import React, { useState } from 'react';
import { StoredNote } from '../../types';
import { AIService } from '../../services/aiService';
import { studyStore } from '../../hooks/useStudyStore';
import { useActiveSubject, useNotes } from '../../hooks/useStudyStore';
import { NoteViewer } from './NoteViewer';
import {
  FileText,
  Upload,
  Sparkles,
  Trash2,
  Edit3,
  Search,
  BookOpen,
  Loader2,
  X,
  CheckCircle
} from 'lucide-react';

interface NotesManagerProps {
  onHighlightTerm: (term: string, context?: string) => void;
}

export const NotesManager: React.FC<NotesManagerProps> = ({ onHighlightTerm }) => {
  const notes = useNotes();
  const activeSubject = useActiveSubject();

  // Selection derives from the (subject-scoped) notes collection, so switching
  // the active subject or deleting a note never leaves a stale note on screen.
  const [selectedNoteId, setSelectedNoteId] = useState<string | null>(null);
  const selectedNote = notes.find((n) => n.id === selectedNoteId) || notes[0] || null;

  const [searchQuery, setSearchQuery] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [showGenerateModal, setShowGenerateModal] = useState(false);
  const [editingNote, setEditingNote] = useState<StoredNote | null>(null);

  // Note generation form state
  const [materialText, setMaterialText] = useState('');
  const [sourceFileName, setSourceFileName] = useState('');
  const [customTitle, setCustomTitle] = useState('');
  const [customTags, setCustomTags] = useState('');
  const [isExtractingPdf, setIsExtractingPdf] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!activeSubject) return null;

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setSourceFileName(file.name);
    if (!customTitle) {
      setCustomTitle(file.name.replace(/\.[^/.]+$/, ''));
    }

    if (file.type === 'text/plain') {
      const reader = new FileReader();
      reader.onload = (event) => {
        setMaterialText((event.target?.result as string) || '');
      };
      reader.readAsText(file);
    } else if (file.type === 'application/pdf') {
      setIsExtractingPdf(true);
      setError(null);
      const reader = new FileReader();
      reader.onload = async (event) => {
        const dataUri = event.target?.result as string;
        try {
          const extracted = await AIService.extractPdfText(dataUri);
          setMaterialText(extracted);
        } catch (err: any) {
          setError('Could not extract PDF text automatically. You can copy & paste the text directly.');
        } finally {
          setIsExtractingPdf(false);
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!materialText.trim()) {
      setError('Please provide course material text or upload a document.');
      return;
    }

    setIsGenerating(true);
    setError(null);

    try {
      const generatedMarkdown = await AIService.generateNotes({
        material: materialText,
        sourceName: sourceFileName || 'Course Lecture Material',
      });

      const tagsArray = customTags
        ? customTags.split(',').map((t) => t.trim()).filter(Boolean)
        : [activeSubject.name, 'AI Generated'];

      const newNote = studyStore.addNote({
        title: customTitle.trim() || sourceFileName.replace(/\.[^/.]+$/, '') || 'Interactive Study Notes',
        content: generatedMarkdown,
        sourceName: sourceFileName || 'Uploaded Material',
        tags: tagsArray,
      });

      setSelectedNoteId(newNote.id);
      setShowGenerateModal(false);
      // Reset form
      setMaterialText('');
      setSourceFileName('');
      setCustomTitle('');
      setCustomTags('');
    } catch (err: any) {
      setError(err.message || 'Failed to generate dynamic notes. Please try again.');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleDeleteNote = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirm('Are you sure you want to delete this study note?')) {
      studyStore.deleteNote(id);
    }
  };

  const handleSaveEdit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingNote) return;

    studyStore.updateNote(editingNote.id, {
      title: editingNote.title,
      content: editingNote.content,
      tags: editingNote.tags,
    });
    setEditingNote(null);
  };

  const filteredNotes = notes.filter(
    (n) =>
      n.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      n.content.toLowerCase().includes(searchQuery.toLowerCase()) ||
      n.tags?.some((t) => t.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  return (
    <div className="space-y-6">
      {/* Top Header & Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 border-3 border-slate-900 rounded-2xl shadow-neo-md">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2 py-0.5 bg-yellow-300 text-slate-900 border-2 border-slate-900 rounded-md text-[10px] font-black uppercase tracking-wider shadow-neo-sm">
              ተማሪ Smart Notes
            </span>
            <span className="text-xs font-black text-slate-600">
              {activeSubject.name}
            </span>
          </div>
          <h2 className="text-xl font-black text-slate-950 flex items-center gap-2">
            <BookOpen className="w-5 h-5 text-cyan-600" />
            Interactive Study Notes
          </h2>
          <p className="text-xs font-bold text-slate-600 mt-1">
            Structured Markdown notes with hierarchy, comparison tables, visual callouts, and Mermaid mindmaps.
          </p>
        </div>

        <button
          onClick={() => setShowGenerateModal(true)}
          className="flex items-center justify-center gap-2 px-5 py-2.5 bg-yellow-300 hover:bg-yellow-200 text-slate-950 font-black text-xs rounded-xl border-2 border-slate-900 shadow-neo transition-all active:translate-y-0.5 shrink-0"
        >
          <Sparkles className="w-4 h-4 text-slate-900" />
          Generate Notes with AI
        </button>
      </div>

      {/* Main Grid: Sidebar List + Viewer */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        {/* Left Notes List */}
        <div className="lg:col-span-4 space-y-3">
          <div className="bg-white p-4 border-3 border-slate-900 rounded-2xl shadow-neo space-y-3">
            <div className="relative">
              <Search className="w-4 h-4 text-slate-900 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search notes or tags..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-2 text-xs bg-[#FAF8F5] border-2 border-slate-900 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-amber-400 font-bold shadow-xs"
              />
            </div>

            <div className="space-y-2 max-h-[600px] overflow-y-auto pr-1">
              {filteredNotes.length === 0 ? (
                <div className="p-6 text-center text-slate-600 text-xs border-2 border-dashed border-slate-300 rounded-xl bg-slate-50">
                  <FileText className="w-8 h-8 mx-auto text-slate-400 mb-2" />
                  <p className="font-black text-slate-800">No notes found</p>
                  <p className="mt-1 text-[11px] font-medium">Upload slides or paste text to generate notes.</p>
                </div>
              ) : (
                filteredNotes.map((note) => {
                  const isSelected = selectedNote?.id === note.id;
                  return (
                    <div
                      key={note.id}
                      onClick={() => setSelectedNoteId(note.id)}
                      className={`p-3.5 rounded-xl border-2 cursor-pointer transition-all ${
                        isSelected
                          ? 'bg-[#A7F3D0] border-slate-900 text-slate-950 shadow-neo translate-x-1'
                          : 'bg-white border-slate-900/40 hover:border-slate-900 hover:bg-slate-50 shadow-xs'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <h4 className="text-xs font-black line-clamp-1 text-slate-950">
                          {note.title}
                        </h4>
                        <button
                          onClick={(e) => handleDeleteNote(note.id, e)}
                          className="text-slate-500 hover:text-rose-600 hover:bg-rose-50 p-1 rounded-md transition-colors shrink-0"
                          title="Delete note"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>

                      <p className="text-[11px] text-slate-600 line-clamp-2 mt-1 font-medium">
                        {note.content.replace(/[#*`[\]>]/g, '').slice(0, 90)}...
                      </p>

                      <div className="flex items-center justify-between mt-2.5 pt-2 border-t border-slate-900/20 text-[10px] font-bold text-slate-600">
                        <span>{new Date(note.createdAt).toLocaleDateString()}</span>
                        {note.tags && note.tags[0] && (
                          <span className="px-2 py-0.5 bg-white border border-slate-900 text-slate-900 rounded-md font-black shadow-xs">
                            {note.tags[0]}
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>

        {/* Right Viewer or Editor */}
        <div className="lg:col-span-8">
          {editingNote ? (
            <div className="bg-white border-3 border-slate-900 rounded-2xl p-5 shadow-neo-md space-y-4">
              <div className="flex items-center justify-between pb-3 border-b-2 border-slate-200">
                <h3 className="text-sm font-black text-slate-900 flex items-center gap-2">
                  <Edit3 className="w-4 h-4 text-cyan-600" /> Edit Note Markdown
                </h3>
                <button
                  onClick={() => setEditingNote(null)}
                  className="p-1 text-slate-900 hover:bg-slate-100 rounded-lg border-2 border-slate-900"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <form onSubmit={handleSaveEdit} className="space-y-3.5">
                <div>
                  <label className="block text-xs font-black uppercase tracking-wider text-slate-800 mb-1">Title</label>
                  <input
                    type="text"
                    value={editingNote.title}
                    onChange={(e) => setEditingNote({ ...editingNote, title: e.target.value })}
                    className="w-full px-3.5 py-2 text-xs bg-[#FAF8F5] border-2 border-slate-900 rounded-xl font-bold focus:outline-hidden focus:ring-2 focus:ring-amber-400 shadow-neo-sm"
                  />
                </div>

                <div>
                  <label className="block text-xs font-black uppercase tracking-wider text-slate-800 mb-1">Markdown Content</label>
                  <textarea
                    rows={16}
                    value={editingNote.content}
                    onChange={(e) => setEditingNote({ ...editingNote, content: e.target.value })}
                    className="w-full p-3.5 text-xs bg-[#FAF8F5] border-2 border-slate-900 rounded-xl font-mono font-medium leading-relaxed focus:outline-hidden focus:ring-2 focus:ring-amber-400 shadow-neo-sm"
                  />
                </div>

                <div className="flex justify-end gap-2.5 pt-2">
                  <button
                    type="button"
                    onClick={() => setEditingNote(null)}
                    className="px-4 py-2 text-xs font-black text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl border-2 border-slate-900 transition-all shadow-neo-sm"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2 text-xs font-black text-slate-950 bg-emerald-300 hover:bg-emerald-200 rounded-xl border-2 border-slate-900 shadow-neo transition-all active:translate-y-0.5"
                  >
                    Save Changes
                  </button>
                </div>
              </form>
            </div>
          ) : selectedNote ? (
            <NoteViewer
              note={selectedNote}
              onEdit={() => setEditingNote(selectedNote)}
              onHighlightTerm={onHighlightTerm}
            />
          ) : (
            <div className="bg-white border-3 border-slate-900 rounded-2xl p-12 text-center shadow-neo">
              <FileText className="w-12 h-12 mx-auto text-slate-400 mb-3" />
              <h3 className="text-base font-black text-slate-900">No Note Selected</h3>
              <p className="text-xs font-bold text-slate-600 max-w-sm mx-auto mt-1 mb-5">
                Choose a note from the left sidebar or generate an interactive study note with Temari AI.
              </p>
              <button
                onClick={() => setShowGenerateModal(true)}
                className="inline-flex items-center gap-2 px-5 py-2.5 bg-yellow-300 hover:bg-yellow-200 text-slate-950 font-black text-xs rounded-xl border-2 border-slate-900 shadow-neo transition-all active:translate-y-0.5"
              >
                <Sparkles className="w-4 h-4 text-slate-900" />
                Generate New Note
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Modal: Generate Dynamic Notes */}
      {showGenerateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 animate-in fade-in duration-150">
          <div className="w-full max-w-2xl bg-white border-3 border-slate-900 rounded-2xl p-6 shadow-neo-xl relative max-h-[90vh] overflow-y-auto">
            <button
              onClick={() => setShowGenerateModal(false)}
              className="absolute top-4 right-4 p-1.5 text-slate-900 hover:bg-slate-100 rounded-lg border-2 border-slate-900 shadow-neo-sm"
              aria-label="Close modal"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="flex items-center gap-3 mb-4">
              <div className="p-2.5 bg-yellow-300 border-2 border-slate-900 text-slate-950 rounded-xl shadow-neo-sm">
                <Sparkles className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-black text-slate-950">Generate Dynamic Interactive Notes</h3>
                <p className="text-xs font-bold text-slate-600">
                  Target Subject: <strong className="text-cyan-700">{activeSubject.name}</strong>
                </p>
              </div>
            </div>

            {error && (
              <div className="p-3 mb-3 bg-rose-50 border-2 border-rose-500 rounded-xl text-xs font-bold text-rose-900">
                {error}
              </div>
            )}

            <form onSubmit={handleGenerate} className="space-y-4">
              {/* File Upload Box */}
              <div>
                <label className="block text-xs font-black uppercase tracking-wider text-slate-800 mb-1.5">
                  Upload Course Material (.pdf, .txt)
                </label>
                <div className="border-2 border-dashed border-slate-900 hover:bg-yellow-50/50 rounded-xl p-4 bg-[#FAF8F5] text-center relative transition-colors shadow-neo-sm">
                  <input
                    type="file"
                    accept=".pdf,.txt"
                    onChange={handleFileUpload}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                    disabled={isExtractingPdf || isGenerating}
                  />
                  <div className="flex flex-col items-center justify-center gap-1.5 pointer-events-none">
                    {isExtractingPdf ? (
                      <>
                        <Loader2 className="w-6 h-6 animate-spin text-slate-900" />
                        <span className="text-xs font-black text-slate-900">Extracting text from PDF with AI OCR...</span>
                      </>
                    ) : sourceFileName ? (
                      <>
                        <CheckCircle className="w-6 h-6 text-emerald-600" />
                        <span className="text-xs font-black text-slate-900">{sourceFileName}</span>
                        <span className="text-[10px] font-bold text-slate-500">Click or drop another file to replace</span>
                      </>
                    ) : (
                      <>
                        <Upload className="w-6 h-6 text-slate-900" />
                        <span className="text-xs font-black text-slate-900">
                          Click to browse or drag & drop lecture PDF / TXT
                        </span>
                        <span className="text-[10px] font-bold text-slate-500">Auto-extracted with Multimodal Gemini AI</span>
                      </>
                    )}
                  </div>
                </div>
              </div>

              {/* Paste Text Area */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-black uppercase tracking-wider text-slate-800">
                    Source Material / Lecture Text
                  </label>
                  <span className="text-[10px] font-mono font-bold text-slate-500">{materialText.length} chars</span>
                </div>
                <textarea
                  rows={6}
                  value={materialText}
                  onChange={(e) => setMaterialText(e.target.value)}
                  placeholder="Paste lecture transcript, textbook chapters, or slides content here..."
                  className="w-full p-3 text-xs bg-[#FAF8F5] border-2 border-slate-900 rounded-xl font-mono leading-relaxed focus:outline-hidden focus:ring-2 focus:ring-amber-400 shadow-neo-sm"
                  disabled={isGenerating}
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-black uppercase tracking-wider text-slate-800 mb-1">
                    Note Title (Optional)
                  </label>
                  <input
                    type="text"
                    value={customTitle}
                    onChange={(e) => setCustomTitle(e.target.value)}
                    placeholder="e.g. Cellular Respiration & ATP"
                    className="w-full px-3.5 py-2 text-xs bg-[#FAF8F5] border-2 border-slate-900 rounded-xl font-bold focus:outline-hidden focus:ring-2 focus:ring-amber-400 shadow-neo-sm"
                    disabled={isGenerating}
                  />
                </div>

                <div>
                  <label className="block text-xs font-black uppercase tracking-wider text-slate-800 mb-1">
                    Tags (Comma-separated)
                  </label>
                  <input
                    type="text"
                    value={customTags}
                    onChange={(e) => setCustomTags(e.target.value)}
                    placeholder="e.g. Midterm, Chapter 4, Biochem"
                    className="w-full px-3.5 py-2 text-xs bg-[#FAF8F5] border-2 border-slate-900 rounded-xl font-bold focus:outline-hidden focus:ring-2 focus:ring-amber-400 shadow-neo-sm"
                    disabled={isGenerating}
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-3 border-t-2 border-slate-200">
                <button
                  type="button"
                  onClick={() => setShowGenerateModal(false)}
                  disabled={isGenerating}
                  className="px-4 py-2 text-xs font-black text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl border-2 border-slate-900 transition-all shadow-neo-sm"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={isGenerating || !materialText.trim()}
                  className="flex items-center gap-2 px-5 py-2 text-xs font-black text-slate-950 bg-yellow-300 hover:bg-yellow-200 rounded-xl border-2 border-slate-900 shadow-neo transition-all active:translate-y-0.5 disabled:opacity-50"
                >
                  {isGenerating ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin text-slate-900" />
                      <span>Synthesizing Notes...</span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4 text-slate-900" />
                      <span>Generate Study Notes</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

import React, { useState, useRef, useEffect } from 'react';
import { StoredNote } from '../../types';
import { ai, type FallbackReason } from '../../services/ai';
import { isAbortError } from '../../services/ai/isAbortError';
import { aiConnection } from '../../services/aiConnection';
import { OfflineBanner } from '../tools/OfflineBanner';
import { studyStore } from '../../hooks/useStudyStore';
import { clearReadingPlace, getReadingPlace } from '../../services/readingPlace';
import { useActiveSubject, useNotes } from '../../hooks/useStudyStore';
import { NoteViewer } from './NoteViewer';
import { Modal, ModalCloseButton, type MorphOrigin } from '../ui/Modal';
import { confirm } from '../ui/confirm';
import { GenerationProgress } from '../ui/GenerationProgress';
import { EmptyState } from '../ui/EmptyState';
import { useModalOrigin } from '../ui/useModalOrigin';
import { Button } from '../ui/button';
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
  onHighlightTerm: (term: string, context?: string, origin?: MorphOrigin) => void;
}

/** One class string for every text field, shared with the Quizzes modal. */
const fieldClass =
  'w-full px-3.5 py-2 text-sm bg-background border border-border rounded-lg font-medium focus:outline-hidden focus:ring-2 focus:ring-ring/50 shadow-2xs';

export const NotesManager: React.FC<NotesManagerProps> = ({ onHighlightTerm }) => {
  const notes = useNotes();
  const activeSubject = useActiveSubject();

  // Selection derives from the (subject-scoped) notes collection, so switching
  // the active subject or deleting a note never leaves a stale note on screen.
  // The initial selection is the Note the learner was last reading in this
  // Subject (reading continuity across hub switches and reloads); if that
  // Note is gone, the newest one.
  const [selectedNoteId, setSelectedNoteId] = useState<string | null>(
    () => getReadingPlace(activeSubject.id)?.noteId ?? null
  );
  const selectedNote = notes.find((n) => n.id === selectedNoteId) || notes[0] || null;

  const [searchQuery, setSearchQuery] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [showGenerateModal, setShowGenerateModal] = useState(false);
  const generateOrigin = useModalOrigin();
  const [editingNote, setEditingNote] = useState<StoredNote | null>(null);

  // Note generation form state
  const [materialText, setMaterialText] = useState('');
  const [sourceFileName, setSourceFileName] = useState('');
  const [customTitle, setCustomTitle] = useState('');
  const [customTags, setCustomTags] = useState('');
  const [isExtractingPdf, setIsExtractingPdf] = useState(false);
  const [error, setError] = useState<string | null>(null);
  /** Why the last generation was served offline (undefined when it was not). */
  const [offlineReason, setOfflineReason] = useState<FallbackReason | null | undefined>(undefined);
  const generatedOffline = offlineReason !== undefined;
  /**
   * The in-flight generation. Cancel aborts it: the client stops waiting and
   * no error is shown. (The server does not yet forward the abort upstream,
   * so this is "stop waiting", not "stop the model".)
   */
  const generationRef = useRef<AbortController | null>(null);
  useEffect(() => () => generationRef.current?.abort(), []);

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
          const extracted = await aiConnection.extractPdfText(dataUri);
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
      setError('Please paste Material or upload a document.');
      return;
    }

    setIsGenerating(true);
    setError(null);

    generationRef.current?.abort();
    const controller = new AbortController();
    generationRef.current = controller;

    try {
      const { source: noteSource, value: generatedMarkdown, fallback } = await ai.generateNotes({
        material: materialText,
        sourceName: sourceFileName || 'Pasted Material',
        signal: controller.signal,
      });
      if (controller.signal.aborted) return;
      setOfflineReason(noteSource === 'offline' ? fallback ?? null : undefined);

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
    } catch (err: unknown) {
      // Cancellation is the learner's decision, not a failure.
      if (controller.signal.aborted || isAbortError(err)) return;
      setError(err instanceof Error && err.message ? err.message : 'Failed to generate dynamic notes. Please try again.');
    } finally {
      if (generationRef.current === controller) generationRef.current = null;
      if (!controller.signal.aborted) setIsGenerating(false);
    }
  };

  const handleDeleteNote = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const ok = await confirm({
      title: 'Delete note?',
      body: 'This permanently removes the study note. This cannot be undone.',
      confirmLabel: 'Delete',
      danger: true,
    });
    if (ok) {
      // A deleted Note has no place to return to.
      if (getReadingPlace(activeSubject.id)?.noteId === id) clearReadingPlace(activeSubject.id);
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
      {/* Header Bar */}
      <div className="notes-hub-header flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-card p-6 border border-border/80 rounded-2xl shadow-xs">
        <div>
          <div className="flex items-center gap-2 mb-1.5 flex-wrap">
            <span className="font-ethiopic font-semibold text-amber-600 dark:text-amber-400 text-sm">
              ተማሪ
            </span>
            <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Smart Notes
            </span>
            <span className="text-xs font-medium text-muted-foreground">·</span>
            <span className="text-xs font-medium text-foreground">{activeSubject.name}</span>
            {activeSubject.amharicName && (
              <span className="text-xs font-medium text-muted-foreground font-ethiopic hidden md:inline">
                ({activeSubject.amharicName})
              </span>
            )}
          </div>
          <h2 className="font-editorial text-2xl font-bold text-foreground tracking-tight flex items-center gap-2">
            <BookOpen className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0" /> Interactive Study Notes
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            Structured Markdown notes with hierarchy, comparison tables, visual callouts, and Editorial vector diagrams.
          </p>
        </div>

        <Button
          onClick={(e) => {
            generateOrigin.capture(e);
            setShowGenerateModal(true);
          }}
          className="shrink-0"
        >
          <Sparkles className="size-3.5" />
          Generate Notes with AI
        </Button>
      </div>

      {generatedOffline && (
        <OfflineBanner
          className="no-print"
          what="this note"
          fallback={offlineReason ?? undefined}
          onRetry={() => {
            generateOrigin.capture(null);
            setShowGenerateModal(true);
          }}
        />
      )}

      {/* Main grid: Notes list + viewer */}
      <div className="notes-grid grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        {/* Notes list (stacks above the viewer below lg) */}
        <div className="notes-list-col lg:col-span-4 space-y-3">
          <div className="bg-card border border-border/80 rounded-2xl p-4 shadow-xs space-y-3">
            <div className="relative">
              <Search className="w-4 h-4 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search Notes or tags..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-2 text-sm bg-background border border-border rounded-lg font-medium focus:outline-hidden focus:ring-2 focus:ring-ring/50 shadow-2xs"
              />
            </div>

            <div className="space-y-2 max-h-[600px] overflow-y-auto pr-1">
              {filteredNotes.length === 0 ? (
                <div className="p-6 text-center text-muted-foreground text-xs border border-dashed border-border rounded-xl bg-muted/40">
                  <FileText className="w-8 h-8 mx-auto text-muted-foreground/60 mb-2" />
                  <p className="font-semibold text-foreground">No notes found</p>
                  <p className="mt-1 text-[11px] font-medium">Upload slides or paste text to generate notes.</p>
                </div>
              ) : (
                filteredNotes.map((note) => {
                  const isSelected = selectedNote?.id === note.id;
                  return (
                    <div
                      key={note.id}
                      onClick={() => setSelectedNoteId(note.id)}
                      className={`p-3.5 rounded-xl border cursor-pointer transition-colors ${
                        isSelected
                          ? 'bg-amber-500/10 border-amber-500/30 text-foreground'
                          : 'bg-background border-border/80 hover:bg-muted/50 hover:border-border'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <h4 className="text-xs font-semibold line-clamp-1 text-foreground">
                          {note.title}
                        </h4>
                        <button
                          onClick={(e) => handleDeleteNote(note.id, e)}
                          className="text-muted-foreground hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30 p-1 rounded-md transition-colors shrink-0"
                          title="Delete note"
                          aria-label={`Delete ${note.title}`}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>

                      <p className="text-[11px] text-muted-foreground line-clamp-2 mt-1 font-medium">
                        {note.content.replace(/[#*`[\]>]/g, '').slice(0, 90)}...
                      </p>

                      <div className="flex items-center justify-between mt-2.5 pt-2 border-t border-border/60 text-[10px] font-medium text-muted-foreground">
                        <span>{new Date(note.createdAt).toLocaleDateString()}</span>
                        {note.tags && note.tags[0] && (
                          <span className="px-2 py-0.5 bg-muted border border-border text-foreground rounded-md font-medium">
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
            <div className="bg-card border border-border/80 rounded-2xl p-5 shadow-xs space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-border">
                <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                  <Edit3 className="w-4 h-4 text-amber-600 dark:text-amber-400" /> Edit Note Markdown
                </h3>
                <button
                  onClick={() => setEditingNote(null)}
                  className="p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted rounded-lg border border-border transition-colors"
                  aria-label="Close editor"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <form onSubmit={handleSaveEdit} className="space-y-3.5">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-foreground mb-1">Title</label>
                  <input
                    type="text"
                    value={editingNote.title}
                    onChange={(e) => setEditingNote({ ...editingNote, title: e.target.value })}
                    className={fieldClass}
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-foreground mb-1">Markdown Content</label>
                  <textarea
                    rows={16}
                    value={editingNote.content}
                    onChange={(e) => setEditingNote({ ...editingNote, content: e.target.value })}
                    className={`${fieldClass} p-3.5 font-mono leading-relaxed`}
                  />
                </div>

                <div className="flex justify-end gap-2.5 pt-3 border-t border-border">
                  <Button type="button" variant="outline" onClick={() => setEditingNote(null)}>
                    Cancel
                  </Button>
                  <Button type="submit">
                    <CheckCircle className="size-3.5" />
                    Save Changes
                  </Button>
                </div>
              </form>
            </div>
          ) : selectedNote ? (
            <NoteViewer
              note={selectedNote}
              subjectName={activeSubject.name}
              onEdit={() => setEditingNote(selectedNote)}
              onHighlightTerm={onHighlightTerm}
            />
          ) : (
            <EmptyState
              icon={FileText}
              title="No Note Selected"
              description="Choose a Note from the list or generate an interactive study Note with Temari AI."
              action={
                <Button
                  onClick={(e) => {
                    generateOrigin.capture(e);
                    setShowGenerateModal(true);
                  }}
                >
                  <Sparkles className="size-3.5" /> Generate New Note
                </Button>
              }
            />
          )}
        </div>
      </div>

      {/* Modal: Generate Dynamic Notes */}
      <Modal
        open={showGenerateModal}
        onClose={() => setShowGenerateModal(false)}
        originRef={generateOrigin.ref}
        title="Generate Dynamic Interactive Notes"
        subtitle={`Target Subject: ${activeSubject.name}`}
        icon={<Sparkles className="w-5 h-5" />}
        iconClassName="bg-amber-500/10 text-amber-600 dark:text-amber-400"
        maxWidthClassName="max-w-2xl"
      >
        {error && (
          <div className="p-3 mb-3 bg-rose-500/10 border border-rose-500/20 rounded-xl text-xs font-medium text-rose-700 dark:text-rose-400">
            {error}
          </div>
        )}

        <form onSubmit={handleGenerate} className="space-y-4">
          {isGenerating && (
            <GenerationProgress
              kind="notes"
              detail={`Subject: ${activeSubject.name}`}
              onCancel={() => {
                generationRef.current?.abort();
                generationRef.current = null;
                setIsGenerating(false);
              }}
            />
          )}

              {/* File Upload Box */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-foreground mb-1.5">
                  Upload Material (.pdf, .txt)
                </label>
                <div className="border border-dashed border-border hover:border-amber-500/40 hover:bg-amber-500/5 rounded-xl p-4 bg-muted/30 text-center relative transition-colors">
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
                        <Loader2 className="w-6 h-6 animate-spin text-amber-600 dark:text-amber-400" />
                        <span className="text-xs font-semibold text-foreground">Extracting text from PDF with AI OCR...</span>
                      </>
                    ) : sourceFileName ? (
                      <>
                        <CheckCircle className="w-6 h-6 text-emerald-600 dark:text-emerald-400" />
                        <span className="text-xs font-semibold text-foreground">{sourceFileName}</span>
                        <span className="text-[10px] font-medium text-muted-foreground">Click or drop another file to replace</span>
                      </>
                    ) : (
                      <>
                        <Upload className="w-6 h-6 text-muted-foreground" />
                        <span className="text-xs font-semibold text-foreground">
                          Click to browse or drag & drop lecture PDF / TXT
                        </span>
                        <span className="text-[10px] font-medium text-muted-foreground">Auto-extracted with Multimodal Gemini AI</span>
                      </>
                    )}
                  </div>
                </div>
              </div>

              {/* Paste Text Area */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-bold uppercase tracking-wider text-foreground">
                    Source Material / Lecture Text
                  </label>
                  <span className="text-[10px] font-mono font-medium text-muted-foreground tabular-nums">{materialText.length} chars</span>
                </div>
                <textarea
                  rows={6}
                  value={materialText}
                  onChange={(e) => setMaterialText(e.target.value)}
                  placeholder="Paste lecture transcript, textbook chapters, or slides content here..."
                  className={`${fieldClass} p-3 font-mono leading-relaxed`}
                  disabled={isGenerating}
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-foreground mb-1">
                    Note Title (Optional)
                  </label>
                  <input
                    type="text"
                    value={customTitle}
                    onChange={(e) => setCustomTitle(e.target.value)}
                    placeholder="e.g. Cellular Respiration & ATP"
                    className={fieldClass}
                    disabled={isGenerating}
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-foreground mb-1">
                    Tags (Comma-separated)
                  </label>
                  <input
                    type="text"
                    value={customTags}
                    onChange={(e) => setCustomTags(e.target.value)}
                    placeholder="e.g. Midterm, Chapter 4, Biochem"
                    className={fieldClass}
                    disabled={isGenerating}
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-border">
                <ModalCloseButton
                  onBeforeClose={() => {
                    // Cancel while generating: stop waiting, keep the form.
                    generationRef.current?.abort();
                    generationRef.current = null;
                    setIsGenerating(false);
                  }}
                >
                  {isGenerating ? 'Stop and close' : 'Cancel'}
                </ModalCloseButton>

                <Button type="submit" disabled={isGenerating || !materialText.trim()}>
                  {isGenerating ? (
                    <>
                      <Loader2 className="size-3.5 animate-spin" />
                      <span>Synthesizing Notes…</span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="size-3.5" />
                      <span>Generate Study Notes</span>
                    </>
                  )}
                </Button>
              </div>
            </form>
      </Modal>
    </div>
  );
};

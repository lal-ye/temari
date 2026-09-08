import React, { useEffect, useRef, useState } from 'react';
import { Flashcard } from '../../types';
import { ai, type FallbackReason } from '../../services/ai';
import { isAbortError } from '../../services/ai/isAbortError';
import { OfflineBanner } from '../tools/OfflineBanner';
import { studyStore } from '../../hooks/useStudyStore';
import { useActiveSubject, useNotes, useQuizzes } from '../../hooks/useStudyStore';
import { FlashcardView } from './FlashcardView';
import { Modal, ModalCloseButton, type MorphOrigin } from '../ui/Modal';
import { confirm } from '../ui/confirm';
import { GenerationProgress } from '../ui/GenerationProgress';
import { EmptyState } from '../ui/EmptyState';
import { SourceMaterialSelector } from '../ui/SourceMaterialSelector';
import { useModalOrigin } from '../ui/useModalOrigin';
import { Card, CardContent } from '../ui/card';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import {
  Layers,
  Sparkles,
  Play,
  Trash2,
  Loader2,
} from 'lucide-react';

interface QuizzesManagerProps {
  onHighlightTerm?: (term: string, context?: string, origin?: MorphOrigin) => void;
}

export const QuizzesManager: React.FC<QuizzesManagerProps> = ({ onHighlightTerm }) => {
  const quizzes = useQuizzes();
  const notes = useNotes();
  const activeSubject = useActiveSubject();

  // Derive the active deck from the (subject-scoped) quizzes collection so the
  // deck stays fresh across store updates and subject switches.
  const [activeQuizId, setActiveQuizId] = useState<string | null>(null);
  const activeQuiz = quizzes.find((q) => q.id === activeQuizId) || null;
  const [showGenerateModal, setShowGenerateModal] = useState(false);
  const generateOrigin = useModalOrigin();

  // Form state
  const [quizName, setQuizName] = useState('');
  const [difficulty, setDifficulty] = useState<'Easy' | 'Medium' | 'Hard'>('Medium');
  const [quizLength, setQuizLength] = useState<number>(5);
  const [sourceOption, setSourceOption] = useState<'subjectNotes' | 'customText'>('subjectNotes');
  const [customMaterial, setCustomMaterial] = useState('');
  const [selectedNoteId, setSelectedNoteId] = useState<string>('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  /** Why the last generation was served offline (undefined when it was not). */
  const [offlineReason, setOfflineReason] = useState<FallbackReason | null | undefined>(undefined);
  const generatedOffline = offlineReason !== undefined;
  /** In-flight generation; Cancel aborts it (stop waiting, no error). */
  const generationRef = useRef<AbortController | null>(null);
  useEffect(() => () => generationRef.current?.abort(), []);

  // Notes from useNotes() are already scoped to the active subject.
  const subjectNotes = notes;

  if (!activeSubject) return null;

  const handleGenerateQuiz = async (e: React.FormEvent) => {
    e.preventDefault();
    let textToUse = '';

    if (sourceOption === 'subjectNotes') {
      if (selectedNoteId) {
        const note = subjectNotes.find((n) => n.id === selectedNoteId);
        textToUse = note?.content || '';
      } else {
        // Aggregate all notes
        textToUse = subjectNotes.map((n) => n.content).join('\n\n');
      }
    } else {
      textToUse = customMaterial.trim();
    }

    if (!textToUse) {
      setError('Please select a study note or provide source material text.');
      return;
    }

    setIsGenerating(true);
    setError(null);

    generationRef.current?.abort();
    const controller = new AbortController();
    generationRef.current = controller;

    try {
      const { source: quizSource, value: flashcards, fallback } = await ai.generateQuiz({
        material: textToUse,
        quizLength,
        difficulty,
        signal: controller.signal,
      });
      if (controller.signal.aborted) return;
      setOfflineReason(quizSource === 'offline' ? fallback ?? null : undefined);

      const newQuiz = studyStore.addQuiz({
        name: quizName.trim() || `${activeSubject.name} Flashcard Drill`,
        flashcards,
        quizLengthUsed: flashcards.length,
        difficulty,
        courseMaterialExtract: textToUse.slice(0, 500),
      });

      setShowGenerateModal(false);
      setActiveQuizId(newQuiz.id);
      // Reset form
      setQuizName('');
      setCustomMaterial('');
    } catch (err: unknown) {
      if (controller.signal.aborted || isAbortError(err)) return;
      setError(err instanceof Error && err.message ? err.message : 'Failed to generate quiz. Please try again.');
    } finally {
      if (generationRef.current === controller) generationRef.current = null;
      if (!controller.signal.aborted) setIsGenerating(false);
    }
  };

  const handleDeleteQuiz = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const ok = await confirm({
      title: 'Delete quiz?',
      body: 'This permanently removes the quiz and its flashcards. Past Attempts stay in your history.',
      confirmLabel: 'Delete',
      danger: true,
    });
    if (ok) studyStore.deleteQuiz(id);
  };

  const handleFinishDrill = (score: number, masteredCount: number) => {
    if (!activeQuiz) return;
    studyStore.updateQuiz(activeQuiz.id, {
      lastScore: score,
      timesPracticed: (activeQuiz.timesPracticed || 0) + 1,
    });

    // Also record in attempts history (single record op, shared with exams)
    studyStore.recordAttempt({
      subjectId: activeSubject.id,
      subjectName: activeSubject.name,
      name: activeQuiz.name,
      type: 'Quiz',
      overallScore: score,
      totalQuestions: activeQuiz.flashcards.length,
      correctQuestions: masteredCount,
      topicsToReview: [],
    });
  };

  if (activeQuiz) {
    return (
      <FlashcardView
        quizName={activeQuiz.name}
        flashcards={activeQuiz.flashcards}
        onFinish={handleFinishDrill}
        onHighlightTerm={onHighlightTerm}
        onClose={() => setActiveQuizId(null)}
      />
    );
  }

  return (
    <div className="space-y-6">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-card p-6 border border-border/80 rounded-2xl shadow-xs">
        <div>
          <div className="flex items-center gap-2 mb-1.5 flex-wrap">
            <span className="font-ethiopic font-semibold text-amber-600 dark:text-amber-400 text-sm">
              ተማሪ
            </span>
            <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Active Recall
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
            <Layers className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0" /> Flashcard Quizzes & Active Recall
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            Test and solidify concepts with interactive flashcards, spaced recall drills, and AI hints.
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
          Generate New Quiz Deck
        </Button>
      </div>

      {generatedOffline && (
        <OfflineBanner
          what="these flashcards"
          fallback={offlineReason ?? undefined}
          onRetry={() => {
            generateOrigin.capture(null);
            setShowGenerateModal(true);
          }}
        />
      )}

      {/* Quizzes Grid */}
      {quizzes.length === 0 ? (
        <EmptyState
          icon={Layers}
          title="No Flashcard Decks Yet"
          description="Generate flashcards directly from your saved study notes or any lecture text with Temari AI."
          action={
            <Button
              onClick={(e) => {
                generateOrigin.capture(e);
                setShowGenerateModal(true);
              }}
            >
              <Sparkles className="size-3.5" /> Create Flashcard Quiz
            </Button>
          }
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {quizzes.map((quiz) => (
            <div
              key={quiz.id}
              className="bg-card border border-border/80 rounded-2xl p-5 shadow-xs hover:shadow-sm transition-shadow flex flex-col justify-between"
            >
              <div>
                <div className="flex items-start justify-between gap-2 mb-2.5">
                  <Badge
                    variant="secondary"
                    className={`text-[10px] font-medium ${
                      quiz.difficulty === 'Easy'
                        ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/20'
                        : quiz.difficulty === 'Medium'
                        ? 'bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/20'
                        : 'bg-rose-500/10 text-rose-700 dark:text-rose-400 border-rose-500/20'
                    }`}
                  >
                    {quiz.difficulty}
                  </Badge>

                  <button
                    onClick={(e) => handleDeleteQuiz(quiz.id, e)}
                    className="p-1 text-muted-foreground hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30 rounded-md transition-colors"
                    title="Delete Quiz"
                    aria-label={`Delete ${quiz.name}`}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>

                <h3 className="text-sm font-semibold text-foreground line-clamp-2 mt-1">{quiz.name}</h3>

                <div className="flex items-center gap-2 text-[11px] font-medium text-muted-foreground mt-3">
                  <span className="px-2 py-0.5 bg-muted rounded-md text-foreground font-mono">
                    {quiz.flashcards.length} cards
                  </span>
                  <span>·</span>
                  <span>Practiced {quiz.timesPracticed || 0}×</span>
                </div>

                {quiz.lastScore !== undefined && (
                  <div className="mt-3 p-2.5 bg-muted/50 border border-border rounded-lg flex items-center justify-between text-xs">
                    <span className="font-medium text-muted-foreground">Last drill score</span>
                    <span className="font-semibold text-foreground font-mono tabular-nums">
                      {quiz.lastScore}%
                    </span>
                  </div>
                )}
              </div>

              <div className="mt-5 pt-3.5 border-t border-border flex items-center justify-between">
                <span className="text-[11px] font-medium text-muted-foreground">
                  {new Date(quiz.createdAt).toLocaleDateString()}
                </span>

                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setActiveQuizId(quiz.id)}
                >
                  <Play className="size-3 fill-current" /> Practice
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Generate Quiz Modal */}
      <Modal
        open={showGenerateModal}
        onClose={() => setShowGenerateModal(false)}
        originRef={generateOrigin.ref}
        title="Generate AI Flashcard Deck"
        subtitle={`Subject: ${activeSubject.name}`}
        icon={<Sparkles className="w-5 h-5 text-amber-600 dark:text-amber-400" />}
        iconClassName="bg-amber-500/10 text-amber-600"
        maxWidthClassName="max-w-xl"
      >
        {error && (
          <div className="p-3 mb-3 bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900/50 rounded-xl text-xs font-medium text-rose-700 dark:text-rose-400">
            {error}
          </div>
        )}

        <form onSubmit={handleGenerateQuiz} className="space-y-4">
          {isGenerating && (
            <GenerationProgress
              kind="quiz"
              detail={`Subject: ${activeSubject.name}`}
              onCancel={() => {
                generationRef.current?.abort();
                generationRef.current = null;
                setIsGenerating(false);
              }}
            />
          )}

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-foreground mb-1">
                  Quiz Deck Name
                </label>
                <input
                  type="text"
                  value={quizName}
                  onChange={(e) => setQuizName(e.target.value)}
                  placeholder={`e.g. ${activeSubject.name} Key Mechanisms Quiz`}
                  className="w-full px-3.5 py-2 text-sm bg-background border border-border rounded-lg font-medium focus:outline-hidden focus:ring-2 focus:ring-ring/50 shadow-2xs"
                  disabled={isGenerating}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-foreground mb-1">
                    Difficulty Level
                  </label>
                  <select
                    value={difficulty}
                    onChange={(e: any) => setDifficulty(e.target.value)}
                    className="w-full px-3.5 py-2 text-sm bg-background border border-border rounded-lg font-medium focus:outline-hidden focus:ring-2 focus:ring-ring/50 shadow-2xs"
                    disabled={isGenerating}
                  >
                    <option value="Easy">Easy (Core Definitions)</option>
                    <option value="Medium">Medium (Conceptual Synthesis)</option>
                    <option value="Hard">Hard (Edge Cases & Problem Solving)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-foreground mb-1">
                    Number of Cards ({quizLength})
                  </label>
                  <input
                    type="range"
                    min={3}
                    max={15}
                    value={quizLength}
                    onChange={(e) => setQuizLength(Number(e.target.value))}
                    className="w-full accent-amber-600 mt-2"
                    disabled={isGenerating}
                  />
                </div>
              </div>

              <SourceMaterialSelector
                sourceOption={sourceOption}
                onSourceOptionChange={setSourceOption}
                subjectNotes={subjectNotes}
                selectedNoteId={selectedNoteId}
                onSelectedNoteIdChange={setSelectedNoteId}
                customMaterial={customMaterial}
                onCustomMaterialChange={setCustomMaterial}
                subjectName={activeSubject.name}
                isGenerating={isGenerating}
                notesLabel="Use Subject Notes"
                customLabel="Paste Custom Text"
                customPlaceholder="Paste textbook excerpt or notes text to generate flashcards from..."
              />

              <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-border">
                <ModalCloseButton
                  onBeforeClose={() => {
                    generationRef.current?.abort();
                    generationRef.current = null;
                    setIsGenerating(false);
                  }}
                >
                  {isGenerating ? 'Stop and close' : 'Cancel'}
                </ModalCloseButton>

                <Button
                  type="submit"
                  disabled={isGenerating}
                >
                  {isGenerating ? (
                    <>
                      <Loader2 className="size-3.5 animate-spin" />
                      <span>Generating Deck…</span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="size-3.5" />
                      <span>Generate Quiz</span>
                    </>
                  )}
                </Button>
              </div>
            </form>
      </Modal>
    </div>
  );
};

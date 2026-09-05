import React, { useState } from 'react';
import { Flashcard } from '../../types';
import { ai } from '../../services/ai';
import { OfflineBanner } from '../tools/OfflineBanner';
import { studyStore } from '../../hooks/useStudyStore';
import { useActiveSubject, useNotes, useQuizzes } from '../../hooks/useStudyStore';
import { FlashcardView } from './FlashcardView';
import { Modal, type MorphOrigin } from '../ui/Modal';
import { GenerationProgress } from '../ui/GenerationProgress';
import { EmptyState } from '../ui/EmptyState';
import { SourceMaterialSelector } from '../ui/SourceMaterialSelector';
import { useModalOrigin } from '../ui/useModalOrigin';
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
  const [generatedOffline, setGeneratedOffline] = useState(false);

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

    try {
      const { source: quizSource, value: flashcards } = await ai.generateQuiz({
        material: textToUse,
        quizLength,
        difficulty,
      });
      setGeneratedOffline(quizSource === 'offline');

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
    } catch (err: any) {
      setError(err.message || 'Failed to generate quiz. Please try again.');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleDeleteQuiz = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirm('Delete this flashcard quiz?')) {
      studyStore.deleteQuiz(id);
    }
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
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 border-3 border-slate-900 rounded-2xl shadow-neo-md">
        <div>
          <div className="flex items-center gap-2 mb-1.5 flex-wrap">
            <span className="badge-chip px-2.5 py-1 bg-yellow-300 text-slate-900 border-2 border-slate-900 rounded-md shadow-neo-sm inline-flex items-center gap-1.5">
              <span className="font-ethiopic font-bold text-xs normal-case">ተማሪ</span>
              <span>Active Recall</span>
            </span>
            <span className="text-xs font-bold text-slate-600">{activeSubject.name}</span>
            {activeSubject.amharicName && (
              <span className="text-xs font-bold text-slate-600 font-ethiopic border-l-2 border-slate-300 pl-2 hidden md:inline">
                {activeSubject.amharicName}
              </span>
            )}
          </div>
          <h2 className="section-heading text-slate-950 flex items-center gap-2">
            <Layers className="w-5 h-5 text-emerald-600 shrink-0" /> Flashcard Quizzes & Active Recall
          </h2>
          <p className="text-xs font-bold text-slate-600 mt-1">
            Test and solidify concepts with interactive 3D flashcards, spaced repetition drills, and AI hints.
          </p>
        </div>

        <button
          onClick={(e) => {
            generateOrigin.capture(e);
            setShowGenerateModal(true);
          }}
          className="flex items-center justify-center gap-2 px-5 py-2.5 bg-yellow-300 hover:bg-yellow-200 text-slate-950 font-black text-xs rounded-xl border-2 border-slate-900 shadow-neo transition-all active:translate-y-0.5 shrink-0"
        >
          <Sparkles className="w-4 h-4 text-slate-900" />
          Generate New Quiz Deck
        </button>
      </div>

      {generatedOffline && (
        <OfflineBanner label="Offline draft — no AI Provider was reachable, so these flashcards were assembled locally. Reconnect and regenerate for full AI flashcards." />
      )}

      {/* Quizzes Grid */}
      {quizzes.length === 0 ? (
        <EmptyState
          icon={Layers}
          title="No Flashcard Decks Yet"
          description="Generate flashcards directly from your saved study notes or any lecture text with Temari AI."
          action={
            <button
              onClick={(e) => {
                generateOrigin.capture(e);
                setShowGenerateModal(true);
              }}
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-yellow-300 hover:bg-yellow-200 text-slate-950 font-black text-xs rounded-xl border-2 border-slate-900 shadow-neo transition-all active:translate-y-0.5"
            >
              <Sparkles className="w-4 h-4 text-slate-900" /> Create Flashcard Quiz
            </button>
          }
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {quizzes.map((quiz) => (
            <div
              key={quiz.id}
              className="bg-white border-3 border-slate-900 rounded-2xl p-5 shadow-neo hover:translate-x-0.5 hover:-translate-y-0.5 transition-all flex flex-col justify-between"
            >
              <div>
                <div className="flex items-start justify-between gap-2 mb-2.5">
                  <span
                    className={`px-2.5 py-0.5 rounded-lg border-2 border-slate-900 text-[10px] font-black uppercase shadow-neo-sm ${
                      quiz.difficulty === 'Easy'
                        ? 'bg-emerald-300 text-slate-950'
                        : quiz.difficulty === 'Medium'
                        ? 'bg-amber-300 text-slate-950'
                        : 'bg-rose-300 text-slate-950'
                    }`}
                  >
                    {quiz.difficulty}
                  </span>

                  <button
                    onClick={(e) => handleDeleteQuiz(quiz.id, e)}
                    className="text-slate-500 hover:text-rose-600 hover:bg-rose-50 p-1 rounded-md transition-colors"
                    title="Delete Quiz"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>

                <h3 className="text-sm font-black text-slate-950 line-clamp-2 mt-1">{quiz.name}</h3>

                <div className="flex items-center gap-2.5 text-[11px] font-bold text-slate-600 mt-3">
                  <span className="px-2 py-0.5 bg-slate-100 border border-slate-900 rounded-md text-slate-900 font-black">
                    {quiz.flashcards.length} Cards
                  </span>
                  <span>•</span>
                  <span>Practiced {quiz.timesPracticed || 0}x</span>
                </div>

                {quiz.lastScore !== undefined && (
                  <div className="mt-3 p-2.5 bg-[#FAF8F5] border-2 border-slate-900 rounded-xl flex items-center justify-between text-xs shadow-neo-sm">
                    <span className="font-bold text-slate-600">Last Drill Score:</span>
                    <span className="font-black text-cyan-800 text-sm">{quiz.lastScore}%</span>
                  </div>
                )}
              </div>

              <div className="mt-5 pt-3.5 border-t-2 border-slate-200 flex items-center justify-between">
                <span className="text-[10px] font-bold text-slate-500">
                  {new Date(quiz.createdAt).toLocaleDateString()}
                </span>

                <button
                  onClick={() => setActiveQuizId(quiz.id)}
                  className="flex items-center gap-1.5 px-4 py-1.5 bg-emerald-300 hover:bg-emerald-200 text-slate-950 font-black text-xs rounded-xl border-2 border-slate-900 shadow-neo-sm transition-all active:translate-y-0.5"
                >
                  <Play className="w-3.5 h-3.5 fill-current" /> Practice
                </button>
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
        icon={<Sparkles className="w-5 h-5 text-slate-950" />}
        iconClassName="bg-yellow-300 text-slate-950"
        maxWidthClassName="max-w-xl"
      >
        {error && (
          <div className="p-3 mb-3 bg-rose-50 border-2 border-rose-500 rounded-xl text-xs font-bold text-rose-900">
            {error}
          </div>
        )}

        <form onSubmit={handleGenerateQuiz} className="space-y-4">
          {isGenerating && (
            <GenerationProgress kind="quiz" detail={`Subject: ${activeSubject.name}`} />
          )}

              <div>
                <label className="block text-xs font-black uppercase tracking-wider text-slate-800 mb-1">
                  Quiz Deck Name
                </label>
                <input
                  type="text"
                  value={quizName}
                  onChange={(e) => setQuizName(e.target.value)}
                  placeholder={`e.g. ${activeSubject.name} Key Mechanisms Quiz`}
                  className="w-full px-3.5 py-2 text-xs bg-[#FAF8F5] border-2 border-slate-900 rounded-xl font-bold focus:outline-hidden focus:ring-2 focus:ring-amber-400 shadow-neo-sm"
                  disabled={isGenerating}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-black uppercase tracking-wider text-slate-800 mb-1">
                    Difficulty Level
                  </label>
                  <select
                    value={difficulty}
                    onChange={(e: any) => setDifficulty(e.target.value)}
                    className="w-full px-3.5 py-2 text-xs bg-[#FAF8F5] border-2 border-slate-900 rounded-xl font-bold focus:outline-hidden focus:ring-2 focus:ring-amber-400 shadow-neo-sm"
                    disabled={isGenerating}
                  >
                    <option value="Easy">Easy (Core Definitions)</option>
                    <option value="Medium">Medium (Conceptual Synthesis)</option>
                    <option value="Hard">Hard (Edge Cases & Problem Solving)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-black uppercase tracking-wider text-slate-800 mb-1">
                    Number of Cards ({quizLength})
                  </label>
                  <input
                    type="range"
                    min={3}
                    max={15}
                    value={quizLength}
                    onChange={(e) => setQuizLength(Number(e.target.value))}
                    className="w-full accent-slate-900 mt-2"
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
                  disabled={isGenerating}
                  className="flex items-center gap-2 px-5 py-2 text-xs font-black text-slate-950 bg-yellow-300 hover:bg-yellow-200 rounded-xl border-2 border-slate-900 shadow-neo transition-all active:translate-y-0.5 disabled:opacity-50"
                >
                  {isGenerating ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin text-slate-900" />
                      <span>Generating Deck...</span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4 text-slate-900" />
                      <span>Generate Quiz</span>
                    </>
                  )}
                </button>
              </div>
            </form>
      </Modal>
    </div>
  );
};

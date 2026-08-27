import React, { useState } from 'react';
import { StoredQuiz, Subject, Flashcard } from '../../types';
import { StorageService } from '../../services/storage';
import { AIService } from '../../services/aiService';
import { FlashcardView } from './FlashcardView';
import {
  Layers,
  Sparkles,
  Plus,
  Play,
  Trash2,
  BookOpen,
  Loader2,
  X,
  RotateCw,
  Award,
  CheckCircle,
  HelpCircle,
} from 'lucide-react';

interface QuizzesManagerProps {
  currentSubject: Subject;
  onHighlightTerm?: (term: string, context?: string) => void;
}

export const QuizzesManager: React.FC<QuizzesManagerProps> = ({ currentSubject, onHighlightTerm }) => {
  const [quizzes, setQuizzes] = useState<StoredQuiz[]>(() => StorageService.getQuizzes(currentSubject.id));
  const [activeQuiz, setActiveQuiz] = useState<StoredQuiz | null>(null);
  const [showGenerateModal, setShowGenerateModal] = useState(false);

  // Form state
  const [quizName, setQuizName] = useState('');
  const [difficulty, setDifficulty] = useState<'Easy' | 'Medium' | 'Hard'>('Medium');
  const [quizLength, setQuizLength] = useState<number>(5);
  const [sourceOption, setSourceOption] = useState<'subjectNotes' | 'customText'>('subjectNotes');
  const [customMaterial, setCustomMaterial] = useState('');
  const [selectedNoteId, setSelectedNoteId] = useState<string>('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const subjectNotes = StorageService.getNotes(currentSubject.id);

  const refreshQuizzes = () => {
    setQuizzes(StorageService.getQuizzes(currentSubject.id));
  };

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
      const flashcards = await AIService.generateQuiz({
        material: textToUse,
        quizLength,
        difficulty,
      });

      const newQuiz = StorageService.addQuiz({
        subjectId: currentSubject.id,
        name: quizName.trim() || `${currentSubject.name} Flashcard Drill`,
        flashcards,
        quizLengthUsed: flashcards.length,
        difficulty,
        courseMaterialExtract: textToUse.slice(0, 500),
      });

      refreshQuizzes();
      setShowGenerateModal(false);
      setActiveQuiz(newQuiz);
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
      StorageService.deleteQuiz(id);
      refreshQuizzes();
    }
  };

  const handleFinishDrill = (score: number, masteredCount: number) => {
    if (!activeQuiz) return;
    StorageService.updateQuiz(activeQuiz.id, {
      lastScore: score,
      timesPracticed: (activeQuiz.timesPracticed || 0) + 1,
    });

    // Also record in attempts history
    StorageService.recordAttempt({
      subjectId: currentSubject.id,
      subjectName: currentSubject.name,
      name: activeQuiz.name,
      type: 'Quiz',
      overallScore: score,
      totalQuestions: activeQuiz.flashcards.length,
      correctQuestions: masteredCount,
      topicsToReview: [],
    });

    refreshQuizzes();
  };

  if (activeQuiz) {
    return (
      <FlashcardView
        quizName={activeQuiz.name}
        flashcards={activeQuiz.flashcards}
        onFinish={handleFinishDrill}
        onHighlightTerm={onHighlightTerm}
        onClose={() => setActiveQuiz(null)}
      />
    );
  }

  return (
    <div className="space-y-6">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 border-3 border-slate-900 rounded-2xl shadow-neo-md">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2 py-0.5 bg-yellow-300 text-slate-900 border-2 border-slate-900 rounded-md text-[10px] font-black uppercase tracking-wider shadow-neo-sm">
              ተማሪ Active Recall
            </span>
            <span className="text-xs font-black text-slate-600">{currentSubject.name}</span>
          </div>
          <h2 className="text-xl font-black text-slate-950 flex items-center gap-2">
            <Layers className="w-5 h-5 text-emerald-600" /> Flashcard Quizzes & Active Recall
          </h2>
          <p className="text-xs font-bold text-slate-600 mt-1">
            Test and solidify concepts with interactive 3D flashcards, spaced repetition drills, and AI hints.
          </p>
        </div>

        <button
          onClick={() => setShowGenerateModal(true)}
          className="flex items-center justify-center gap-2 px-5 py-2.5 bg-yellow-300 hover:bg-yellow-200 text-slate-950 font-black text-xs rounded-xl border-2 border-slate-900 shadow-neo transition-all active:translate-y-0.5 shrink-0"
        >
          <Sparkles className="w-4 h-4 text-slate-900" />
          Generate New Quiz Deck
        </button>
      </div>

      {/* Quizzes Grid */}
      {quizzes.length === 0 ? (
        <div className="bg-white border-3 border-slate-900 rounded-2xl p-12 text-center shadow-neo">
          <Layers className="w-12 h-12 mx-auto text-slate-400 mb-3" />
          <h3 className="text-base font-black text-slate-900">No Flashcard Decks Yet</h3>
          <p className="text-xs font-bold text-slate-600 max-w-sm mx-auto mt-1 mb-5">
            Generate flashcards directly from your saved study notes or any lecture text with Temari AI.
          </p>
          <button
            onClick={() => setShowGenerateModal(true)}
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-yellow-300 hover:bg-yellow-200 text-slate-950 font-black text-xs rounded-xl border-2 border-slate-900 shadow-neo transition-all active:translate-y-0.5"
          >
            <Sparkles className="w-4 h-4 text-slate-900" /> Create Flashcard Quiz
          </button>
        </div>
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
                  onClick={() => setActiveQuiz(quiz)}
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
      {showGenerateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 animate-in fade-in duration-150">
          <div className="w-full max-w-xl bg-white border-3 border-slate-900 rounded-2xl p-6 shadow-neo-xl relative max-h-[90vh] overflow-y-auto">
            <button
              onClick={() => setShowGenerateModal(false)}
              className="absolute top-4 right-4 p-1.5 text-slate-900 hover:bg-slate-100 rounded-lg border-2 border-slate-900 shadow-neo-sm"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="flex items-center gap-3 mb-4">
              <div className="p-2.5 bg-yellow-300 border-2 border-slate-900 text-slate-950 rounded-xl shadow-neo-sm">
                <Sparkles className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-black text-slate-950">Generate AI Flashcard Deck</h3>
                <p className="text-xs font-bold text-slate-600">
                  Subject: <strong className="text-cyan-700">{currentSubject.name}</strong>
                </p>
              </div>
            </div>

            {error && (
              <div className="p-3 mb-3 bg-rose-50 border-2 border-rose-500 rounded-xl text-xs font-bold text-rose-900">
                {error}
              </div>
            )}

            <form onSubmit={handleGenerateQuiz} className="space-y-4">
              <div>
                <label className="block text-xs font-black uppercase tracking-wider text-slate-800 mb-1">
                  Quiz Deck Name
                </label>
                <input
                  type="text"
                  value={quizName}
                  onChange={(e) => setQuizName(e.target.value)}
                  placeholder={`e.g. ${currentSubject.name} Key Mechanisms Quiz`}
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

              {/* Source selection */}
              <div>
                <label className="block text-xs font-black uppercase tracking-wider text-slate-800 mb-1">
                  Source Material
                </label>
                <div className="flex gap-4 mb-2">
                  <label className="flex items-center gap-2 text-xs font-bold text-slate-800 cursor-pointer">
                    <input
                      type="radio"
                      name="sourceOption"
                      checked={sourceOption === 'subjectNotes'}
                      onChange={() => setSourceOption('subjectNotes')}
                      className="accent-slate-900"
                    />
                    Use Subject Notes ({subjectNotes.length} available)
                  </label>
                  <label className="flex items-center gap-2 text-xs font-bold text-slate-800 cursor-pointer">
                    <input
                      type="radio"
                      name="sourceOption"
                      checked={sourceOption === 'customText'}
                      onChange={() => setSourceOption('customText')}
                      className="accent-slate-900"
                    />
                    Paste Custom Text
                  </label>
                </div>

                {sourceOption === 'subjectNotes' ? (
                  subjectNotes.length > 0 ? (
                    <select
                      value={selectedNoteId}
                      onChange={(e) => setSelectedNoteId(e.target.value)}
                      className="w-full px-3.5 py-2 text-xs bg-[#FAF8F5] border-2 border-slate-900 rounded-xl font-bold focus:outline-hidden focus:ring-2 focus:ring-amber-400 shadow-neo-sm"
                      disabled={isGenerating}
                    >
                      <option value="">All Notes Combined in {currentSubject.name}</option>
                      {subjectNotes.map((n) => (
                        <option key={n.id} value={n.id}>
                          {n.title}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <div className="p-3 bg-amber-50 border-2 border-slate-900 rounded-xl text-xs font-bold text-slate-900">
                      No notes created yet for this subject. Switch to &ldquo;Paste Custom Text&rdquo; or generate a note first.
                    </div>
                  )
                ) : (
                  <textarea
                    rows={4}
                    value={customMaterial}
                    onChange={(e) => setCustomMaterial(e.target.value)}
                    placeholder="Paste textbook excerpt or notes text to generate flashcards from..."
                    className="w-full p-3 text-xs bg-[#FAF8F5] border-2 border-slate-900 rounded-xl font-mono focus:outline-hidden focus:ring-2 focus:ring-amber-400 shadow-neo-sm"
                    disabled={isGenerating}
                  />
                )}
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
          </div>
        </div>
      )}
    </div>
  );
};

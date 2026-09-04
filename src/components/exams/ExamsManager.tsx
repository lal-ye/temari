import React, { useState, useMemo } from 'react';
import { Subject, StoredAttempt, ExamQuestion } from '../../types';
import { StorageService } from '../../services/storage';
import { useStudyData } from '../../hooks/useStudyData';
import { AIService } from '../../services/aiService';
import { ExamTakingView } from './ExamTakingView';
import { ExamResultsView } from './ExamResultsView';
import {
  GraduationCap,
  Sparkles,
  Plus,
  Play,
  RotateCcw,
  Clock,
  Award,
  Trash2,
  BookOpen,
  Loader2,
  X,
  FileCheck,
  AlertTriangle,
} from 'lucide-react';

interface ExamsManagerProps {
  currentSubject: Subject;
}

export const ExamsManager: React.FC<ExamsManagerProps> = ({ currentSubject }) => {
  const [attempts, setAttempts] = useState<StoredAttempt[]>(() =>
    StorageService.getAttempts(currentSubject.id).filter((a) => a.type === 'Exam')
  );
  const [viewingAttempt, setViewingAttempt] = useState<StoredAttempt | null>(null);
  const [takingExam, setTakingExam] = useState<{
    title: string;
    questions: ExamQuestion[];
    timeLimitMinutes: number;
  } | null>(null);
  const [showGenerateModal, setShowGenerateModal] = useState(false);

  // Form State
  const [examTitle, setExamTitle] = useState('');
  const [questionCount, setQuestionCount] = useState<number>(10);
  const [timeLimit, setTimeLimit] = useState<number>(15);
  const [sourceOption, setSourceOption] = useState<'subjectNotes' | 'customText'>('subjectNotes');
  const [customMaterial, setCustomMaterial] = useState('');
  const [selectedNoteId, setSelectedNoteId] = useState<string>('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { notes } = useStudyData();
  const subjectNotes = useMemo(
    () => notes.filter((n) => n.subjectId === currentSubject.id),
    [notes, currentSubject.id]
  );

  const refreshAttempts = () => {
    setAttempts(StorageService.getAttempts(currentSubject.id).filter((a) => a.type === 'Exam'));
  };

  const handleGenerateAndStartExam = async (e: React.FormEvent) => {
    e.preventDefault();
    let textToUse = '';

    if (sourceOption === 'subjectNotes') {
      if (selectedNoteId) {
        const note = subjectNotes.find((n) => n.id === selectedNoteId);
        textToUse = note?.content || '';
      } else {
        textToUse = subjectNotes.map((n) => n.content).join('\n\n');
      }
    } else {
      textToUse = customMaterial.trim();
    }

    if (!textToUse) {
      setError('Please select a study note or provide course material text.');
      return;
    }

    setIsGenerating(true);
    setError(null);

    try {
      const generatedQuestions = await AIService.generateExam({
        material: textToUse,
        numberOfQuestions: questionCount,
      });

      setShowGenerateModal(false);
      setTakingExam({
        title: examTitle.trim() || `${currentSubject.name} Comprehensive Mock Exam`,
        questions: generatedQuestions,
        timeLimitMinutes: timeLimit,
      });
      // Reset form
      setExamTitle('');
      setCustomMaterial('');
    } catch (err: any) {
      setError(err.message || 'Failed to generate mock exam. Please try again.');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleExamCompleted = (newAttempt: StoredAttempt) => {
    StorageService.saveAttempts([newAttempt, ...StorageService.getAttempts()]);
    refreshAttempts();
    setTakingExam(null);
    setViewingAttempt(newAttempt);
  };

  const handleDeleteAttempt = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirm('Delete this exam attempt record?')) {
      StorageService.deleteAttempt(id);
      refreshAttempts();
    }
  };

  if (takingExam) {
    return (
      <ExamTakingView
        examTitle={takingExam.title}
        subjectName={currentSubject.name}
        subjectId={currentSubject.id}
        questions={takingExam.questions}
        timeLimitMinutes={takingExam.timeLimitMinutes}
        onCompleted={handleExamCompleted}
        onCancel={() => setTakingExam(null)}
      />
    );
  }

  if (viewingAttempt) {
    return (
      <ExamResultsView
        attempt={viewingAttempt}
        onRetake={() => {
          if (viewingAttempt.examQuestions && viewingAttempt.examQuestions.length > 0) {
            setViewingAttempt(null);
            setTakingExam({
              title: `${viewingAttempt.name} (Retake)`,
              questions: viewingAttempt.examQuestions,
              timeLimitMinutes: 15,
            });
          }
        }}
        onBack={() => setViewingAttempt(null)}
      />
    );
  }

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 border-3 border-slate-900 rounded-2xl shadow-neo-md">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2 py-0.5 bg-yellow-300 text-slate-900 border-2 border-slate-900 rounded-md text-[10px] font-black uppercase tracking-wider shadow-neo-sm">
              ተማሪ Exam Simulator
            </span>
            <span className="text-xs font-black text-slate-600">{currentSubject.name}</span>
          </div>
          <h2 className="text-xl font-black text-slate-950 flex items-center gap-2">
            <GraduationCap className="w-5 h-5 text-indigo-600" /> Comprehensive Mock Exams & Diagnostics
          </h2>
          <p className="text-xs font-bold text-slate-600 mt-1">
            Test yourself with timed mock exams featuring multiple-choice, true/false, and short answer questions with automated AI grading.
          </p>
        </div>

        <button
          onClick={() => setShowGenerateModal(true)}
          className="flex items-center justify-center gap-2 px-5 py-2.5 bg-yellow-300 hover:bg-yellow-200 text-slate-950 font-black text-xs rounded-xl border-2 border-slate-900 shadow-neo transition-all active:translate-y-0.5 shrink-0"
        >
          <Sparkles className="w-4 h-4 text-slate-900" />
          Generate Mock Exam
        </button>
      </div>

      {/* Attempts Grid */}
      {attempts.length === 0 ? (
        <div className="bg-white border-3 border-slate-900 rounded-2xl p-12 text-center shadow-neo">
          <GraduationCap className="w-12 h-12 mx-auto text-slate-400 mb-3" />
          <h3 className="text-base font-black text-slate-900">No Exam Attempts Yet</h3>
          <p className="text-xs font-bold text-slate-600 max-w-sm mx-auto mt-1 mb-5">
            Generate your first timed mock exam to test your mastery and receive automated diagnostic reports from Temari AI.
          </p>
          <button
            onClick={() => setShowGenerateModal(true)}
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-yellow-300 hover:bg-yellow-200 text-slate-950 font-black text-xs rounded-xl border-2 border-slate-900 shadow-neo transition-all active:translate-y-0.5"
          >
            <Sparkles className="w-4 h-4 text-slate-900" /> Create First Exam
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {attempts.map((att) => {
            const isPassed = att.overallScore >= 70;
            return (
              <div
                key={att.id}
                onClick={() => setViewingAttempt(att)}
                className="bg-white border-3 border-slate-900 rounded-2xl p-5 shadow-neo hover:translate-x-0.5 hover:-translate-y-0.5 transition-all cursor-pointer flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-start justify-between gap-2 mb-2.5">
                    <span
                      className={`px-2.5 py-0.5 rounded-lg border-2 border-slate-900 text-[10px] font-black uppercase shadow-neo-sm ${
                        isPassed
                          ? 'bg-emerald-300 text-slate-950'
                          : 'bg-amber-300 text-slate-950'
                      }`}
                    >
                      Score: {att.overallScore}%
                    </span>

                    <button
                      onClick={(e) => handleDeleteAttempt(att.id, e)}
                      className="text-slate-500 hover:text-rose-600 hover:bg-rose-50 p-1 rounded-md transition-colors"
                      title="Delete attempt"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>

                  <h3 className="text-sm font-black text-slate-950 line-clamp-2 mt-1">{att.name}</h3>

                  <div className="flex items-center gap-2.5 text-[11px] font-bold text-slate-600 mt-3">
                    <span className="px-2 py-0.5 bg-slate-100 border border-slate-900 rounded-md text-slate-900 font-black">
                      {att.correctQuestions} / {att.totalQuestions} Correct
                    </span>
                    <span>•</span>
                    <span>{new Date(att.date).toLocaleDateString()}</span>
                  </div>

                  {att.topicsToReview && att.topicsToReview.length > 0 && (
                    <div className="mt-3 p-2.5 bg-rose-100 border-2 border-slate-900 rounded-xl text-[11px] font-bold text-rose-950 line-clamp-1 shadow-neo-sm">
                      Review: {att.topicsToReview.join(', ')}
                    </div>
                  )}
                </div>

                <div className="mt-5 pt-3.5 border-t-2 border-slate-200 flex items-center justify-between">
                  <span className="text-xs font-black text-cyan-800 hover:underline">View Diagnostic Report →</span>
                  <div className="w-7 h-7 rounded-lg bg-yellow-300 border border-slate-900 flex items-center justify-center text-slate-950 shadow-neo-sm">
                    <FileCheck className="w-4 h-4" />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Generate Exam Modal */}
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
                <h3 className="text-base font-black text-slate-950">Generate Practice Mock Exam</h3>
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

            <form onSubmit={handleGenerateAndStartExam} className="space-y-4">
              <div>
                <label className="block text-xs font-black uppercase tracking-wider text-slate-800 mb-1">
                  Exam Title
                </label>
                <input
                  type="text"
                  value={examTitle}
                  onChange={(e) => setExamTitle(e.target.value)}
                  placeholder={`e.g. ${currentSubject.name} Midterm Mock Simulator`}
                  className="w-full px-3.5 py-2 text-xs bg-[#FAF8F5] border-2 border-slate-900 rounded-xl font-bold focus:outline-hidden focus:ring-2 focus:ring-amber-400 shadow-neo-sm"
                  disabled={isGenerating}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-black uppercase tracking-wider text-slate-800 mb-1">
                    Questions ({questionCount})
                  </label>
                  <select
                    value={questionCount}
                    onChange={(e) => setQuestionCount(Number(e.target.value))}
                    className="w-full px-3.5 py-2 text-xs bg-[#FAF8F5] border-2 border-slate-900 rounded-xl font-bold focus:outline-hidden focus:ring-2 focus:ring-amber-400 shadow-neo-sm"
                    disabled={isGenerating}
                  >
                    <option value={5}>5 Questions (Quick Test)</option>
                    <option value={10}>10 Questions (Standard Quiz)</option>
                    <option value={15}>15 Questions (Full Mock)</option>
                    <option value={30}>30 Questions (Comprehensive Exam)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-black uppercase tracking-wider text-slate-800 mb-1">
                    Time Limit (Minutes)
                  </label>
                  <select
                    value={timeLimit}
                    onChange={(e) => setTimeLimit(Number(e.target.value))}
                    className="w-full px-3.5 py-2 text-xs bg-[#FAF8F5] border-2 border-slate-900 rounded-xl font-bold focus:outline-hidden focus:ring-2 focus:ring-amber-400 shadow-neo-sm"
                    disabled={isGenerating}
                  >
                    <option value={10}>10 Minutes</option>
                    <option value={15}>15 Minutes</option>
                    <option value={25}>25 Minutes</option>
                    <option value={45}>45 Minutes</option>
                  </select>
                </div>
              </div>

              {/* Source Material */}
              <div>
                <label className="block text-xs font-black uppercase tracking-wider text-slate-800 mb-1">
                  Source Material
                </label>
                <div className="flex gap-4 mb-2">
                  <label className="flex items-center gap-2 text-xs font-bold text-slate-800 cursor-pointer">
                    <input
                      type="radio"
                      name="examSourceOption"
                      checked={sourceOption === 'subjectNotes'}
                      onChange={() => setSourceOption('subjectNotes')}
                      className="accent-slate-900"
                    />
                    Use Saved Notes ({subjectNotes.length} available)
                  </label>
                  <label className="flex items-center gap-2 text-xs font-bold text-slate-800 cursor-pointer">
                    <input
                      type="radio"
                      name="examSourceOption"
                      checked={sourceOption === 'customText'}
                      onChange={() => setSourceOption('customText')}
                      className="accent-slate-900"
                    />
                    Paste Custom Material
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
                      No notes created yet for this subject. Switch to &ldquo;Paste Custom Material&rdquo; or generate notes first.
                    </div>
                  )
                ) : (
                  <textarea
                    rows={4}
                    value={customMaterial}
                    onChange={(e) => setCustomMaterial(e.target.value)}
                    placeholder="Paste textbook or syllabus content to generate exam from..."
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
                      <span>Generating Mock Exam Questions...</span>
                    </>
                  ) : (
                    <>
                      <Play className="w-4 h-4 fill-current text-slate-900" />
                      <span>Start Timed Exam</span>
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

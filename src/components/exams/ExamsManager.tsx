import React, { useState } from 'react';
import { StoredAttempt, ExamQuestion } from '../../types';
import { studyStore } from '../../hooks/useStudyStore';
import { useActiveSubject, useAttempts, useNotes } from '../../hooks/useStudyStore';
import { ai } from '../../services/ai';
import { ExamTakingView } from './ExamTakingView';
import { ExamResultsView } from './ExamResultsView';
import { Modal } from '../ui/Modal';
import { useModalOrigin } from '../ui/useModalOrigin';
import { SourceMaterialSelector } from '../ui/SourceMaterialSelector';
import {
  GraduationCap,
  Sparkles,
  Play,
  Trash2,
  Loader2,
  FileCheck
} from 'lucide-react';

export const ExamsManager: React.FC = () => {
  const activeAttempts = useAttempts();
  const attempts = activeAttempts.filter((a) => a.type === 'Exam');
  const subjectNotes = useNotes();
  const activeSubject = useActiveSubject();

  const [viewingAttempt, setViewingAttempt] = useState<StoredAttempt | null>(null);
  const [takingExam, setTakingExam] = useState<{
    title: string;
    questions: ExamQuestion[];
    timeLimitMinutes: number;
    offlineDraft?: boolean;
  } | null>(null);
  const [showGenerateModal, setShowGenerateModal] = useState(false);
  const generateOrigin = useModalOrigin();

  // Form State
  const [examTitle, setExamTitle] = useState('');
  const [questionCount, setQuestionCount] = useState<number>(10);
  const [timeLimit, setTimeLimit] = useState<number>(15);
  const [sourceOption, setSourceOption] = useState<'subjectNotes' | 'customText'>('subjectNotes');
  const [customMaterial, setCustomMaterial] = useState('');
  const [selectedNoteId, setSelectedNoteId] = useState<string>('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!activeSubject) return null;

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
      const { source: examSource, value: generatedQuestions } = await ai.generateExam({
        material: textToUse,
        numberOfQuestions: questionCount,
      });

      setShowGenerateModal(false);
      setTakingExam({
        title: examTitle.trim() || `${activeSubject.name} Comprehensive Mock Exam`,
        questions: generatedQuestions,
        timeLimitMinutes: timeLimit,
        offlineDraft: examSource === 'offline',
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

  const handleExamCompleted = (newAttempt: Omit<StoredAttempt, 'id' | 'date'>) => {
    // Single record op shared with quiz drills — the store owns id/date and
    // insertion order for every completed assessment.
    const recorded = studyStore.recordAttempt(newAttempt);
    setTakingExam(null);
    setViewingAttempt(recorded);
  };

  const handleDeleteAttempt = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirm('Delete this exam attempt record?')) {
      studyStore.deleteAttempt(id);
    }
  };

  if (takingExam) {
    return (
      <ExamTakingView
        examTitle={takingExam.title}
        subjectName={activeSubject.name}
        subjectId={activeSubject.id}
        questions={takingExam.questions}
        timeLimitMinutes={takingExam.timeLimitMinutes}
        offlineDraft={takingExam.offlineDraft}
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
          <div className="flex items-center gap-2 mb-1.5 flex-wrap">
            <span className="badge-chip px-2.5 py-1 bg-yellow-300 text-slate-900 border-2 border-slate-900 rounded-md shadow-neo-sm inline-flex items-center gap-1.5">
              <span className="font-ethiopic font-bold text-xs normal-case">ተማሪ</span>
              <span>Exam Simulator</span>
            </span>
            <span className="text-xs font-bold text-slate-600">{activeSubject.name}</span>
            {activeSubject.amharicName && (
              <span className="text-xs font-bold text-slate-600 font-ethiopic border-l-2 border-slate-300 pl-2 hidden md:inline">
                {activeSubject.amharicName}
              </span>
            )}
          </div>
          <h2 className="section-heading text-slate-950 flex items-center gap-2">
            <GraduationCap className="w-5 h-5 text-indigo-600 shrink-0" /> Comprehensive Mock Exams & Diagnostics
          </h2>
          <p className="text-xs font-bold text-slate-600 mt-1">
            Test yourself with timed mock exams featuring multiple-choice, true/false, and short answer questions with automated AI grading.
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
            onClick={(e) => {
            generateOrigin.capture(e);
            setShowGenerateModal(true);
          }}
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
      <Modal
        open={showGenerateModal}
        onClose={() => setShowGenerateModal(false)}
        originRef={generateOrigin.ref}
        title="Generate Practice Mock Exam"
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

        <form onSubmit={handleGenerateAndStartExam} className="space-y-4">
              <div>
                <label className="block text-xs font-black uppercase tracking-wider text-slate-800 mb-1">
                  Exam Title
                </label>
                <input
                  type="text"
                  value={examTitle}
                  onChange={(e) => setExamTitle(e.target.value)}
                  placeholder={`e.g. ${activeSubject.name} Midterm Mock Simulator`}
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
                notesLabel="Use Saved Notes"
                customLabel="Paste Custom Material"
                customPlaceholder="Paste textbook or syllabus content to generate exam from..."
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
      </Modal>
    </div>
  );
};

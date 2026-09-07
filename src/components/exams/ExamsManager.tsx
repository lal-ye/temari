import React, { useState } from 'react';
import { CognitiveMixId, KnowledgeUnit, StoredAttempt, ExamQuestion } from '../../types';
import {
  buildBloomPlan,
  buildExamBlueprint,
  previouslySeenStems,
  COGNITIVE_MIXES,
} from '../../services/examBlueprint';
import { studyStore } from '../../hooks/useStudyStore';
import { useActiveSubject, useAttempts, useNotes } from '../../hooks/useStudyStore';
import { ai } from '../../services/ai';
import { ExamTakingView } from './ExamTakingView';
import { ExamResultsView } from './ExamResultsView';
import { Modal } from '../ui/Modal';
import { GenerationProgress } from '../ui/GenerationProgress';
import { EmptyState } from '../ui/EmptyState';
import { useModalOrigin } from '../ui/useModalOrigin';
import { SourceMaterialSelector } from '../ui/SourceMaterialSelector';
import { Badge } from '../ui/badge';
import { BloomBadge } from '../ui/BloomBadge';
import { Button } from '../ui/button';
import {
  GraduationCap,
  Sparkles,
  Play,
  Trash2,
  Loader2,
  FileCheck
} from 'lucide-react';

/** One class string for every text field, shared with the Quizzes modal. */
const fieldClass =
  'w-full px-3.5 py-2 text-sm bg-background border border-border rounded-lg font-medium focus:outline-hidden focus:ring-2 focus:ring-ring/50 shadow-2xs';

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
    cognitiveMix?: CognitiveMixId;
    knowledgeUnitTargeted?: boolean;
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
  const [cognitiveMix, setCognitiveMix] = useState<CognitiveMixId>('balanced');
  const [isGenerating, setIsGenerating] = useState(false);
  /** Which half of the two-stage pipeline is in flight, for the progress copy. */
  const [stage, setStage] = useState<'units' | 'questions'>('questions');
  const [error, setError] = useState<string | null>(null);

  if (!activeSubject) return null;

  /**
   * Two-stage generation (docs/adr/0008).
   *
   * Stage 1 names the assessable ideas in the Material; stage 2 writes
   * questions against them at a mandated Bloom distribution. One prompt over a
   * whole notes library over-samples whatever topic appears first — naming the
   * units first is what makes coverage planned instead of emergent.
   */
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
      const plan = buildBloomPlan(questionCount, cognitiveMix);

      // Stage 1 is skipped for short material: below roughly a page there is
      // nothing to over-sample, and the extra round trip is pure latency.
      let knowledgeUnits: KnowledgeUnit[] = [];
      const worthExtracting = questionCount >= 8 && textToUse.length >= 1200;
      if (worthExtracting) {
        setStage('units');
        const extracted = await ai.extractKnowledgeUnits({
          material: textToUse,
          maxUnits: Math.min(24, Math.max(6, questionCount)),
        });
        knowledgeUnits = extracted.value;
      }

      setStage('questions');

      // Stems from this subject's earlier exams, so a retake tests transfer
      // rather than a memorised answer string.
      const avoidStems = previouslySeenStems(attempts).slice(-40);

      const { source: examSource, value: generatedQuestions } = await ai.generateExam({
        material: textToUse,
        numberOfQuestions: questionCount,
        bloomPlan: plan,
        knowledgeUnits: knowledgeUnits.length > 0 ? knowledgeUnits : undefined,
        avoidStems: avoidStems.length > 0 ? avoidStems : undefined,
      });

      if (generatedQuestions.length === 0) {
        throw new Error('The Provider returned no questions. Try again or shorten the material.');
      }

      // Repair what came back: drop near-duplicates, enforce the cognitive
      // distribution, order for progressive difficulty, shuffle MCQ positions.
      const blueprint = buildExamBlueprint({
        generated: generatedQuestions,
        plan,
        avoidStems,
        seed: Date.now() % 2147483647,
      });

      setShowGenerateModal(false);
      setTakingExam({
        title: examTitle.trim() || `${activeSubject.name} Comprehensive Mock Exam`,
        questions: blueprint.questions,
        timeLimitMinutes: timeLimit,
        offlineDraft: examSource === 'offline',
        cognitiveMix,
        knowledgeUnitTargeted: knowledgeUnits.length > 0,
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
        cognitiveMix={takingExam.cognitiveMix}
        knowledgeUnitTargeted={takingExam.knowledgeUnitTargeted}
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
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-card p-6 border border-border/80 rounded-2xl shadow-xs">
        <div>
          <div className="flex items-center gap-2 mb-1.5 flex-wrap">
            <span className="font-ethiopic font-semibold text-amber-600 dark:text-amber-400 text-sm">
              ተማሪ
            </span>
            <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Exam Simulator
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
            <GraduationCap className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0" /> Comprehensive Mock Exams & Diagnostics
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            Test yourself with timed mock exams featuring multiple-choice, true/false, and short answer questions with automated AI grading.
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
          Generate Mock Exam
        </Button>
      </div>

      {/* Attempts Grid */}
      {attempts.length === 0 ? (
        <EmptyState
          icon={GraduationCap}
          title="No Exam Attempts Yet"
          description="Generate your first timed mock exam to test your mastery and receive automated diagnostic reports from Temari AI."
          action={
            <Button
              onClick={(e) => {
                generateOrigin.capture(e);
                setShowGenerateModal(true);
              }}
            >
              <Sparkles className="size-3.5" /> Create First Exam
            </Button>
          }
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {attempts.map((att) => {
            const isPassed = att.overallScore >= 70;
            return (
              <div
                key={att.id}
                onClick={() => setViewingAttempt(att)}
                className="bg-card border border-border/80 rounded-2xl p-5 shadow-xs hover:shadow-sm transition-shadow cursor-pointer flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-start justify-between gap-2 mb-2.5">
                    <Badge
                      variant="secondary"
                      className={`text-[10px] font-medium ${
                        isPassed
                          ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/20'
                          : 'bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/20'
                      }`}
                    >
                      Score: {att.overallScore}%
                    </Badge>

                    <button
                      onClick={(e) => handleDeleteAttempt(att.id, e)}
                      className="p-1 text-muted-foreground hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30 rounded-md transition-colors"
                      title="Delete attempt"
                      aria-label={`Delete ${att.name}`}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  <h3 className="text-sm font-semibold text-foreground line-clamp-2 mt-1">{att.name}</h3>

                  <div className="flex items-center gap-2 text-[11px] font-medium text-muted-foreground mt-3">
                    <span className="px-2 py-0.5 bg-muted rounded-md text-foreground font-mono">
                      {att.correctQuestions} / {att.totalQuestions} Correct
                    </span>
                    <span>·</span>
                    <span>{new Date(att.date).toLocaleDateString()}</span>
                  </div>

                  {att.topicsToReview && att.topicsToReview.length > 0 && (
                    <div className="mt-3 p-2.5 bg-rose-500/10 border border-rose-500/20 rounded-lg text-[11px] font-medium text-rose-700 dark:text-rose-400 line-clamp-1">
                      Review: {att.topicsToReview.join(', ')}
                    </div>
                  )}
                </div>

                <div className="mt-5 pt-3.5 border-t border-border flex items-center justify-between">
                  <span className="text-[11px] font-medium text-amber-600 dark:text-amber-400 font-semibold">
                    View Diagnostic Report →
                  </span>
                  <div className="w-7 h-7 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-600 dark:text-amber-400">
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
        icon={<Sparkles className="w-5 h-5" />}
        iconClassName="bg-amber-500/10 text-amber-600 dark:text-amber-400"
        maxWidthClassName="max-w-xl"
      >
        {error && (
          <div className="p-3 mb-3 bg-rose-500/10 border border-rose-500/20 rounded-xl text-xs font-medium text-rose-700 dark:text-rose-400">
            {error}
          </div>
        )}

        <form onSubmit={handleGenerateAndStartExam} className="space-y-4">
          {isGenerating && (
            <GenerationProgress
              kind={stage === 'units' ? 'knowledge-units' : 'exam'}
              detail={
                stage === 'units'
                  ? `Naming assessable ideas in ${activeSubject.name}`
                  : `Writing ${questionCount} questions for ${activeSubject.name}`
              }
            />
          )}

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-foreground mb-1">
                  Exam Title
                </label>
                <input
                  type="text"
                  value={examTitle}
                  onChange={(e) => setExamTitle(e.target.value)}
                  placeholder={`e.g. ${activeSubject.name} Midterm Mock Simulator`}
                  className={fieldClass}
                  disabled={isGenerating}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-foreground mb-1">
                    Questions ({questionCount})
                  </label>
                  <select
                    value={questionCount}
                    onChange={(e) => setQuestionCount(Number(e.target.value))}
                    className={fieldClass}
                    disabled={isGenerating}
                  >
                    <option value={5}>5 Questions (Quick Test)</option>
                    <option value={10}>10 Questions (Standard Quiz)</option>
                    <option value={15}>15 Questions (Full Mock)</option>
                    <option value={30}>30 Questions (Comprehensive Exam)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-foreground mb-1">
                    Time Limit (Minutes)
                  </label>
                  <select
                    value={timeLimit}
                    onChange={(e) => setTimeLimit(Number(e.target.value))}
                    className={fieldClass}
                    disabled={isGenerating}
                  >
                    <option value={10}>10 Minutes</option>
                    <option value={15}>15 Minutes</option>
                    <option value={25}>25 Minutes</option>
                    <option value={45}>45 Minutes</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-foreground mb-1">
                  Cognitive Mix
                </label>
                <select
                  value={cognitiveMix}
                  onChange={(e) => setCognitiveMix(e.target.value as CognitiveMixId)}
                  className={fieldClass}
                  disabled={isGenerating}
                >
                  {(['recall', 'balanced', 'simulation', 'deep'] as CognitiveMixId[]).map((id) => (
                    <option key={id} value={id}>
                      {COGNITIVE_MIXES[id].label}
                    </option>
                  ))}
                </select>
                <p className="text-[11px] font-medium text-muted-foreground mt-1.5">
                  {COGNITIVE_MIXES[cognitiveMix].description}
                </p>

                {/* The exact quota the Provider will be held to, so the choice is
                    not a vague adjective. */}
                <div className="flex flex-wrap gap-1.5 mt-2.5">
                  {buildBloomPlan(questionCount, cognitiveMix).map((slot) => (
                    <span
                      key={slot.level}
                      className="inline-flex items-center gap-1 px-2 py-0.5 bg-muted/50 border border-border rounded-md text-[10px] font-medium text-muted-foreground"
                    >
                      <BloomBadge level={slot.level} />
                      <span className="font-mono tabular-nums text-foreground">×{slot.count}</span>
                    </span>
                  ))}
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

              <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-border">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setShowGenerateModal(false)}
                  disabled={isGenerating}
                >
                  Cancel
                </Button>

                <Button type="submit" disabled={isGenerating}>
                  {isGenerating ? (
                    <>
                      <Loader2 className="size-3.5 animate-spin" />
                      <span>Generating Questions…</span>
                    </>
                  ) : (
                    <>
                      <Play className="size-3 fill-current" />
                      <span>Start Timed Exam</span>
                    </>
                  )}
                </Button>
              </div>
            </form>
      </Modal>
    </div>
  );
};

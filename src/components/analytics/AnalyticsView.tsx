import React, { useEffect, useRef, useState, useMemo } from 'react';
import { StoredAttempt } from '../../types';
import { studyStore } from '../../hooks/useStudyStore';
import { useActiveSubjectId, useAllAttempts, useSubjects } from '../../hooks/useStudyStore';
import {
  computeAnalyticsSummary,
  computeReviewQueue,
  dueForReview,
  escalatedLevel,
} from '../../utils/analytics';
import { BloomBadge } from '../ui/BloomBadge';
import { confirm } from '../ui/confirm';
import { ExamResultsView } from '../exams/ExamResultsView';
import {
  TrendingUp,
  BarChart3,
  Award,
  Layers,
  GraduationCap,
  Clock,
  AlertTriangle,
  Trash2,
  Calendar,
  CheckCircle2,
  Filter,
  History,
} from 'lucide-react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  BarChart,
  Bar,
  Cell,
} from 'recharts';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';

export const AnalyticsView: React.FC = () => {
  // Attempts across all subjects (this screen has its own subject filter).
  const attempts = useAllAttempts();
  const subjects = useSubjects();
  const activeSubjectId = useActiveSubjectId();
  const deleteAttempt = studyStore.deleteAttempt;

  const [selectedAttempt, setSelectedAttempt] = useState<StoredAttempt | null>(null);
  // null = follow the store's active subject; any string = explicit override.
  const [filterOverride, setFilterOverride] = useState<string | null>(null);
  const lastActiveRef = useRef<string | null>(activeSubjectId);
  const effectiveSubjectId = filterOverride ?? activeSubjectId ?? 'ALL';

  // Guarded follow: while the user has not pinned an override, the filter
  // follows the store's active subject.
  useEffect(() => {
    const prev = lastActiveRef.current;
    lastActiveRef.current = activeSubjectId;
    if (filterOverride !== null && filterOverride === prev) {
      setFilterOverride(null);
    }
  }, [activeSubjectId, filterOverride]);

  // Pure domain calculation for analytics and filtered attempts
  const { filteredAttempts, analytics } = useMemo(() => {
    return computeAnalyticsSummary(attempts, effectiveSubjectId);
  }, [attempts, effectiveSubjectId]);

  // Spaced resurfacing: cells whose most recent answer was wrong, scheduled at
  // expanding intervals. Derived, not stored — recomputing from attempts keeps
  // it consistent when an attempt is deleted.
  const reviewQueue = useMemo(() => computeReviewQueue(filteredAttempts), [filteredAttempts]);
  const dueNow = useMemo(() => dueForReview(reviewQueue), [reviewQueue]);

  const handleDeleteAttempt = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const ok = await confirm({
      title: 'Delete this Attempt?',
      body: 'The graded record is removed from your history and from these charts. This cannot be undone.',
      confirmLabel: 'Delete',
      danger: true,
    });
    if (ok) deleteAttempt(id);
  };

  if (selectedAttempt) {
    return (
      <ExamResultsView
        attempt={selectedAttempt}
        onBack={() => setSelectedAttempt(null)}
      />
    );
  }

  // Bracket color mapping for score distribution (Red -> Amber -> Emerald)
  const BRACKET_COLORS: Record<string, string> = {
    '0-59%': '#F43F5E',
    '60-69%': '#F59E0B',
    '70-79%': '#EAB308',
    '80-89%': '#10B981',
    '90-100%': '#059669',
  };

  return (
    <div className="space-y-6">
      {/* Top Header & Filter Bar */}
      <div className="bg-card border border-border/80 rounded-2xl p-6 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <span className="font-ethiopic font-semibold text-amber-600 dark:text-amber-400 text-sm">
              ተማሪ
            </span>
            <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Performance Intelligence
            </span>
          </div>
          <h2 className="font-editorial text-2xl font-bold text-foreground tracking-tight flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0" /> Academic Mastery & Diagnostic Analytics
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            Tracking recall retention, score progression, and conceptual mastery across study sessions.
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <Filter className="w-4 h-4 text-muted-foreground" aria-hidden="true" />
          <select
            value={effectiveSubjectId}
            onChange={(e) => setFilterOverride(e.target.value === 'ALL' ? 'ALL' : e.target.value)}
            className="px-3 py-1.5 text-xs bg-muted/50 border border-border rounded-lg text-foreground font-medium focus:outline-hidden focus:ring-2 focus:ring-ring transition-colors shadow-2xs"
            aria-label="Filter analytics by Subject"
          >
            <option value="ALL">All Subjects Combined</option>
            {subjects.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* KPI Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-card p-5 border border-border/80 rounded-2xl shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground">Average Score</span>
            <div className="p-2 bg-amber-500/10 text-amber-600 dark:text-amber-400 rounded-lg">
              <Award className="w-4 h-4" />
            </div>
          </div>
          <div className="my-2">
            <span className="text-3xl font-bold text-foreground font-mono tabular-nums tracking-tight">
              {analytics.averageScore}%
            </span>
          </div>
          <div className="text-xs text-muted-foreground flex items-center gap-1.5">
            <span className="font-semibold text-foreground">{analytics.passRate}%</span>
            <span>pass rate (≥70%)</span>
          </div>
        </div>

        <div className="bg-card p-5 border border-border/80 rounded-2xl shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground">Quizzes Completed</span>
            <div className="p-2 bg-muted text-muted-foreground rounded-lg">
              <Layers className="w-4 h-4" />
            </div>
          </div>
          <div className="my-2">
            <span className="text-3xl font-bold text-foreground font-mono tabular-nums tracking-tight">
              {analytics.quizzesCount}
            </span>
          </div>
          <span className="text-xs text-muted-foreground">Active recall sessions</span>
        </div>

        <div className="bg-card p-5 border border-border/80 rounded-2xl shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground">Exams</span>
            <div className="p-2 bg-muted text-muted-foreground rounded-lg">
              <GraduationCap className="w-4 h-4" />
            </div>
          </div>
          <div className="my-2">
            <span className="text-3xl font-bold text-foreground font-mono tabular-nums tracking-tight">
              {analytics.examsCount}
            </span>
          </div>
          <span className="text-xs text-muted-foreground">Timed diagnostic evaluations</span>
        </div>

        <div className="bg-card p-5 border border-border/80 rounded-2xl shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground">Latest Session</span>
            <div className="p-2 bg-muted text-muted-foreground rounded-lg">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <div className="my-2">
            <span className="text-base font-semibold text-foreground truncate">
              {analytics.lastActivity
                ? new Date(analytics.lastActivity).toLocaleDateString(undefined, {
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric',
                  })
                : 'No activity yet'}
            </span>
          </div>
          <span className="text-xs text-emerald-600 dark:text-emerald-400 font-medium">
            {filteredAttempts.length > 0 ? 'Study activity recorded' : 'Awaiting first test'}
          </span>
        </div>
      </div>

      {/* Progress Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Progress Over Time (Line Chart) */}
        <div className="lg:col-span-8 bg-card border border-border/80 rounded-2xl p-6 shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-amber-600 dark:text-amber-400" /> Score Progression Over Time
              </h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                Evaluation results plotted chronologically
              </p>
            </div>
            <Badge variant="secondary" className="font-mono text-[11px] font-normal">
              Target: ≥80%
            </Badge>
          </div>

          <div className="h-64 w-full pt-2">
            {analytics.scoreHistory.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={analytics.scoreHistory} margin={{ top: 10, right: 15, left: -25, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="currentColor" className="text-border/60" />
                  <XAxis dataKey="date" stroke="currentColor" className="text-muted-foreground" fontSize={11} tickLine={false} />
                  <YAxis domain={[0, 100]} stroke="currentColor" className="text-muted-foreground" fontSize={11} tickLine={false} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'var(--color-popover)',
                      color: 'var(--color-popover-foreground)',
                      border: '1px solid var(--color-border)',
                      borderRadius: '8px',
                      fontSize: '12px',
                      boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
                    }}
                  />
                  <Line
                    type="monotone"
                    dataKey="score"
                    stroke="#D97706"
                    strokeWidth={2.5}
                    dot={{ r: 4, fill: '#F59E0B', stroke: '#D97706', strokeWidth: 1.5 }}
                    activeDot={{ r: 6 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-xs text-muted-foreground font-medium">
                Complete Flashcard Drills or Exams to visualize your score progression.
              </div>
            )}
          </div>
        </div>

        {/* Score Distribution (Bar Chart) */}
        <div className="lg:col-span-4 bg-card border border-border/80 rounded-2xl p-6 shadow-xs space-y-4">
          <div>
            <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-amber-600 dark:text-amber-400" /> Score Distribution
            </h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              Breakdown by performance bracket
            </p>
          </div>

          <div className="h-64 w-full pt-2">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={analytics.distribution} margin={{ top: 10, right: 10, left: -30, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="currentColor" className="text-border/60" />
                <XAxis dataKey="name" stroke="currentColor" className="text-muted-foreground" fontSize={10} tickLine={false} />
                <YAxis allowDecimals={false} stroke="currentColor" className="text-muted-foreground" fontSize={11} tickLine={false} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'var(--color-popover)',
                    color: 'var(--color-popover-foreground)',
                    border: '1px solid var(--color-border)',
                    borderRadius: '8px',
                    fontSize: '12px',
                    boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
                  }}
                />
                <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                  {analytics.distribution.map((entry, index) => (
                    <Cell
                      key={`cell-${index}`}
                      fill={BRACKET_COLORS[entry.name] || '#D97706'}
                      strokeWidth={0}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Areas for Improvement & Topic Mastery */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Topic Accuracy */}
        <div className="bg-card border border-border/80 rounded-2xl p-6 shadow-xs space-y-4">
          <div>
            <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" /> Topic Mastery Breakdown
            </h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              Accuracy rate on questions grouped by curriculum concept
            </p>
          </div>

          {analytics.topicStats.length > 0 ? (
            <div className="space-y-3.5">
              {analytics.topicStats.map((t, idx) => (
                <div key={idx} className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs font-medium text-foreground">
                    <span>{t.topic}</span>
                    <span
                      className={`font-mono text-xs font-semibold ${
                        t.accuracy >= 80
                          ? 'text-emerald-600 dark:text-emerald-400'
                          : t.accuracy >= 60
                          ? 'text-amber-600 dark:text-amber-400'
                          : 'text-rose-600 dark:text-rose-400'
                      }`}
                    >
                      {t.accuracy}%
                    </span>
                  </div>
                  <div className="w-full bg-muted h-2 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-300 ${
                        t.accuracy >= 80
                          ? 'bg-emerald-500'
                          : t.accuracy >= 60
                          ? 'bg-amber-500'
                          : 'bg-rose-500'
                      }`}
                      style={{ width: `${t.accuracy}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-muted-foreground py-6 text-center">
              Complete Exams to generate granular topic-by-topic accuracy diagnostics.
            </p>
          )}
        </div>

        {/* Actionable Improvement Focus */}
        <div className="bg-card border border-border/80 rounded-2xl p-6 shadow-xs space-y-4">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-amber-500/10 text-amber-700 dark:text-amber-400 rounded-lg">
              <AlertTriangle className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-foreground">
                Targeted Improvement Recommendations
              </h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                Suggested focus areas based on recent performance
              </p>
            </div>
          </div>

          {analytics.weakTopics.length > 0 ? (
            <div className="space-y-2.5">
              {analytics.weakTopics.map((topic, idx) => (
                <div
                  key={idx}
                  className="p-3 bg-rose-50/60 dark:bg-rose-950/20 border border-rose-200 dark:border-rose-900/50 rounded-xl text-xs flex items-center justify-between"
                >
                  <div>
                    <strong className="block text-foreground font-semibold">{topic.topic}</strong>
                    <span className="text-[11px] text-rose-700 dark:text-rose-400">
                      Accuracy currently at {topic.accuracy}%
                    </span>
                  </div>
                  <Badge variant="outline" className="border-rose-300 text-rose-700 dark:text-rose-300 text-[10px]">
                    Drill Suggested
                  </Badge>
                </div>
              ))}
            </div>
          ) : (
            <div className="p-6 bg-emerald-50/50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-900/50 rounded-xl text-xs flex flex-col items-center text-center gap-2">
              <CheckCircle2 className="w-6 h-6 text-emerald-600 dark:text-emerald-400" />
              <strong className="font-semibold text-sm text-foreground">Strong conceptual retention!</strong>
              <p className="text-muted-foreground text-xs max-w-sm">
                You are currently maintaining high mastery across all recorded topics. Continue with periodic spaced recall drills.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Mastery by cognitive level + spaced resurfacing */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <div className="bg-card border border-border/80 rounded-2xl p-6 shadow-xs space-y-4">
          <div>
            <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
              <Layers className="w-4 h-4 text-amber-600 dark:text-amber-400" /> Mastery by Cognitive Level
            </h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              Topic accuracy alone hides this: recalling a definition and applying it are separate skills.
            </p>
          </div>

          {analytics.levelStats.length > 0 ? (
            <div className="space-y-3">
              {analytics.levelStats.map((stat) => (
                <div key={stat.level} className="space-y-1.5">
                  <div className="flex items-center justify-between gap-2">
                    <BloomBadge level={stat.level} size="md" />
                    <span
                      className={`font-mono text-xs font-semibold tabular-nums ${
                        stat.accuracy >= 80
                          ? 'text-emerald-600 dark:text-emerald-400'
                          : stat.accuracy >= 60
                          ? 'text-amber-600 dark:text-amber-400'
                          : 'text-rose-600 dark:text-rose-400'
                      }`}
                    >
                      {stat.accuracy}%
                      <span className="text-muted-foreground font-medium">
                        {' '}({stat.correct}/{stat.total})
                      </span>
                    </span>
                  </div>
                  <div className="w-full bg-muted h-2 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full ${
                        stat.accuracy >= 80
                          ? 'bg-emerald-500'
                          : stat.accuracy >= 60
                          ? 'bg-amber-500'
                          : 'bg-rose-500'
                      }`}
                      style={{ width: `${stat.accuracy}%` }}
                    />
                  </div>
                </div>
              ))}

              {/* Escalation: topics mastered at a level and ready for the next one */}
              {(() => {
                const ready = analytics.topicStats
                  .map((t) => ({ topic: t.topic, next: escalatedLevel(t.topic, analytics.topicLevelStats) }))
                  .filter((r): r is { topic: string; next: NonNullable<typeof r.next> } => Boolean(r.next));
                if (ready.length === 0) return null;
                return (
                  <div className="pt-3 border-t border-border space-y-2">
                    <span className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground">
                      Ready to move up a level
                    </span>
                    {ready.map((r) => (
                      <div
                        key={r.topic}
                        className="flex items-center justify-between gap-2 p-2.5 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-xs"
                      >
                        <span className="font-semibold text-foreground truncate">{r.topic}</span>
                        <BloomBadge level={r.next} size="md" />
                      </div>
                    ))}
                  </div>
                );
              })()}
            </div>
          ) : (
            <p className="text-xs text-muted-foreground py-6 text-center">
              No levelled attempts yet. Exams generated now carry a Bloom level, so this fills in as you practise.
            </p>
          )}
        </div>

        {/* Spaced resurfacing queue */}
        <div className="bg-card border border-border/80 rounded-2xl p-6 shadow-xs space-y-4">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-rose-500/10 text-rose-700 dark:text-rose-400 rounded-lg">
              <History className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-foreground">Due for Review</h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                Missed ideas resurface at expanding intervals — 1, 3, 7 then 14 days.
              </p>
            </div>
          </div>

          {dueNow.length > 0 ? (
            <div className="space-y-2.5">
              {dueNow.slice(0, 8).map((item, idx) => (
                <div
                  key={`${item.topic}-${item.level}-${idx}`}
                  className="p-3 bg-rose-500/[0.06] dark:bg-rose-950/20 border border-rose-500/20 rounded-xl flex items-center justify-between gap-3"
                >
                  <div className="min-w-0">
                    <strong className="block text-xs font-semibold text-foreground truncate">
                      {item.topic}
                    </strong>
                    <span className="text-[11px] text-muted-foreground">
                      Missed {item.lapseStreak}× in a row · next look in {item.intervalDays}d
                    </span>
                  </div>
                  <BloomBadge level={item.level === 'unlevelled' ? undefined : item.level} size="md" />
                </div>
              ))}
            </div>
          ) : reviewQueue.length > 0 ? (
            <div className="p-5 bg-muted/40 border border-border rounded-xl text-xs text-muted-foreground">
              {reviewQueue.length} item{reviewQueue.length === 1 ? '' : 's'} scheduled,{' '}
              <strong className="text-foreground font-semibold">
                {new Date(reviewQueue[0].dueAt).toLocaleDateString(undefined, {
                  month: 'short',
                  day: 'numeric',
                })}
              </strong>{' '}
              is next.
            </div>
          ) : (
            <div className="p-5 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-xs text-emerald-700 dark:text-emerald-400 flex items-center gap-2.5">
              <CheckCircle2 className="w-5 h-5 shrink-0" />
              <span>Nothing outstanding. Your last answers were correct, so there is nothing to resurface yet.</span>
            </div>
          )}
        </div>
      </div>

      {/* Assessment History Table */}
      <div className="bg-card border border-border/80 rounded-2xl p-6 shadow-xs space-y-4">
        <div>
          <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
            <Calendar className="w-4 h-4 text-muted-foreground" /> Assessment History Log
          </h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            Detailed record of individual Quiz and Exam Attempts
          </p>
        </div>

        {filteredAttempts.length === 0 ? (
          <p className="text-xs text-muted-foreground py-6 text-center">
            No quiz or exam attempts recorded yet for this filter.
          </p>
        ) : (
          <div className="overflow-x-auto border border-border rounded-xl shadow-2xs">
            <table className="w-full text-left text-xs border-collapse">
              <thead className="bg-muted/50 text-muted-foreground font-medium border-b border-border">
                <tr>
                  <th className="p-3 font-semibold">Type</th>
                  <th className="p-3 font-semibold">Assessment Title</th>
                  <th className="p-3 font-semibold">Subject</th>
                  <th className="p-3 font-semibold">Score</th>
                  <th className="p-3 font-semibold">Correct / Total</th>
                  <th className="p-3 font-semibold">Date</th>
                  <th className="p-3 font-semibold text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {filteredAttempts.map((att) => (
                  <tr
                    key={att.id}
                    onClick={() => setSelectedAttempt(att)}
                    className="hover:bg-muted/40 cursor-pointer transition-colors"
                  >
                    <td className="p-3">
                      <Badge
                        variant="secondary"
                        className={`text-[10px] font-medium ${
                          att.type === 'Exam'
                            ? 'bg-primary/10 text-primary border-primary/20'
                            : 'bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/20'
                        }`}
                      >
                        {att.type}
                      </Badge>
                    </td>
                    <td className="p-3 font-medium text-foreground">{att.name}</td>
                    <td className="p-3 text-muted-foreground">{att.subjectName}</td>
                    <td className="p-3">
                      <span
                        className={`font-semibold font-mono text-sm ${
                          att.overallScore >= 70
                            ? 'text-emerald-600 dark:text-emerald-400'
                            : 'text-rose-600 dark:text-rose-400'
                        }`}
                      >
                        {att.overallScore}%
                      </span>
                    </td>
                    <td className="p-3 text-muted-foreground font-mono">
                      {att.correctQuestions} / {att.totalQuestions}
                    </td>
                    <td className="p-3 text-muted-foreground">
                      {new Date(att.date).toLocaleDateString(undefined, {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric',
                      })}
                    </td>
                    <td className="p-3 text-right">
                      <button
                        onClick={(e) => handleDeleteAttempt(att.id, e)}
                        className="p-1.5 text-muted-foreground hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-md transition-colors"
                        title="Delete log"
                        aria-label={`Delete record for ${att.name}`}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

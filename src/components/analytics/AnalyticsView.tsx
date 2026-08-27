import React, { useState, useMemo } from 'react';
import { Subject, StoredAttempt } from '../../types';
import { StorageService } from '../../services/storage';
import { computeAnalyticsSummary } from '../../utils/analytics';
import { ExamResultsView } from '../exams/ExamResultsView';
import {
  TrendingUp,
  BarChart3,
  Award,
  Layers,
  GraduationCap,
  Clock,
  AlertTriangle,
  FileCheck,
  Trash2,
  Calendar,
  CheckCircle2,
  Filter,
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

interface AnalyticsViewProps {
  subjects: Subject[];
  currentSubjectId?: string;
}

export const AnalyticsView: React.FC<AnalyticsViewProps> = ({ subjects, currentSubjectId }) => {
  const [selectedSubjectId, setSelectedSubjectId] = useState<string>(currentSubjectId || 'ALL');
  const [selectedAttempt, setSelectedAttempt] = useState<StoredAttempt | null>(null);

  const attempts = StorageService.getAttempts();

  // Pure domain calculation for analytics and filtered attempts
  const { filteredAttempts, analytics } = useMemo(() => {
    return computeAnalyticsSummary(attempts, selectedSubjectId);
  }, [attempts, selectedSubjectId]);

  const handleDeleteAttempt = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirm('Delete this attempt record?')) {
      StorageService.deleteAttempt(id);
    }
  };

  if (selectedAttempt) {
    return (
      <ExamResultsView
        attempt={selectedAttempt}
        onBack={() => setSelectedAttempt(null)}
      />
    );
  }

  const COLORS = ['#F87171', '#FBBF24', '#38BDF8', '#34D399', '#A78BFA'];

  return (
    <div className="space-y-6">
      {/* Top Filter Bar */}
      <div className="bg-white border-3 border-slate-900 rounded-2xl p-5 md:p-6 shadow-neo-md flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <span className="px-2.5 py-0.5 bg-yellow-300 text-slate-950 border border-slate-900 rounded-md text-[10px] font-black uppercase tracking-wider shadow-xs">
            ተማሪ Intelligence
          </span>
          <h2 className="text-xl font-black text-slate-950 flex items-center gap-2 mt-1">
            <TrendingUp className="w-5 h-5 text-cyan-800" /> Academic Progress & Mastery Analytics
          </h2>
          <p className="text-xs font-bold text-slate-600 mt-1">
            Diagnostic breakdown of scores, topic mastery retention, and exam readiness.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-slate-700" />
          <select
            value={selectedSubjectId}
            onChange={(e) => setSelectedSubjectId(e.target.value)}
            className="px-3.5 py-2 text-xs bg-[#FAF8F5] border-2 border-slate-900 rounded-xl font-black text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-amber-400 shadow-neo-sm"
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

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white border-3 border-slate-900 rounded-2xl p-5 shadow-neo flex flex-col justify-between">
          <div className="flex items-center justify-between text-xs font-black uppercase tracking-wider text-slate-700">
            <span>Average Score</span>
            <div className="p-1.5 bg-amber-300 border border-slate-900 rounded-lg">
              <Award className="w-4 h-4 text-slate-950" />
            </div>
          </div>
          <div className="my-2">
            <span className="text-3xl font-black text-slate-950 font-mono">{analytics.averageScore}%</span>
          </div>
          <span className="text-xs text-cyan-800 font-black">{analytics.passRate}% pass rate</span>
        </div>

        <div className="bg-white border-3 border-slate-900 rounded-2xl p-5 shadow-neo flex flex-col justify-between">
          <div className="flex items-center justify-between text-xs font-black uppercase tracking-wider text-slate-700">
            <span>Quizzes Drilled</span>
            <div className="p-1.5 bg-yellow-300 border border-slate-900 rounded-lg">
              <Layers className="w-4 h-4 text-slate-950" />
            </div>
          </div>
          <div className="my-2">
            <span className="text-3xl font-black text-slate-950 font-mono">{analytics.quizzesCount}</span>
          </div>
          <span className="text-xs text-slate-600 font-bold">Flashcard sessions</span>
        </div>

        <div className="bg-white border-3 border-slate-900 rounded-2xl p-5 shadow-neo flex flex-col justify-between">
          <div className="flex items-center justify-between text-xs font-black uppercase tracking-wider text-slate-700">
            <span>Mock Exams Taken</span>
            <div className="p-1.5 bg-cyan-300 border border-slate-900 rounded-lg">
              <GraduationCap className="w-4 h-4 text-slate-950" />
            </div>
          </div>
          <div className="my-2">
            <span className="text-3xl font-black text-slate-950 font-mono">{analytics.examsCount}</span>
          </div>
          <span className="text-xs text-slate-600 font-bold">Diagnostic tests</span>
        </div>

        <div className="bg-white border-3 border-slate-900 rounded-2xl p-5 shadow-neo flex flex-col justify-between">
          <div className="flex items-center justify-between text-xs font-black uppercase tracking-wider text-slate-700">
            <span>Recent Activity</span>
            <div className="p-1.5 bg-emerald-300 border border-slate-900 rounded-lg">
              <Clock className="w-4 h-4 text-slate-950" />
            </div>
          </div>
          <div className="my-2">
            <span className="text-sm font-black text-slate-950 truncate">
              {analytics.lastActivity
                ? new Date(analytics.lastActivity).toLocaleDateString()
                : 'No activity yet'}
            </span>
          </div>
          <span className="text-xs text-emerald-800 font-black">Active learner</span>
        </div>
      </div>

      {/* Progress Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Progress Over Time (Line Chart) */}
        <div className="lg:col-span-8 bg-white border-3 border-slate-900 rounded-2xl p-6 shadow-neo-md space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-black uppercase tracking-wider text-slate-950 flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-cyan-800" /> Performance Progress Over Time
            </h3>
            <span className="text-xs text-slate-600 font-black px-2 py-0.5 bg-slate-100 border border-slate-900 rounded-md">
              Target: 80%+
            </span>
          </div>

          <div className="h-64 w-full pt-2">
            {analytics.scoreHistory.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={analytics.scoreHistory} margin={{ top: 10, right: 15, left: -25, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="date" stroke="#0f172a" fontSize={11} tickLine={false} />
                  <YAxis domain={[0, 100]} stroke="#0f172a" fontSize={11} tickLine={false} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#FAF8F5',
                      color: '#0f172a',
                      border: '2px solid #0f172a',
                      borderRadius: '12px',
                      fontSize: '12px',
                      fontWeight: 'bold',
                      boxShadow: '3px 3px 0px #0f172a',
                    }}
                  />
                  <Line
                    type="monotone"
                    dataKey="score"
                    stroke="#0284c7"
                    strokeWidth={3}
                    dot={{ r: 5, fill: '#facc15', stroke: '#0f172a', strokeWidth: 2 }}
                    activeDot={{ r: 7 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-xs font-bold text-slate-500">
                Complete quizzes or mock exams to visualize your score progression.
              </div>
            )}
          </div>
        </div>

        {/* Score Distribution (Bar Chart) */}
        <div className="lg:col-span-4 bg-white border-3 border-slate-900 rounded-2xl p-6 shadow-neo-md space-y-4">
          <h3 className="text-xs font-black uppercase tracking-wider text-slate-950 flex items-center gap-2">
            <BarChart3 className="w-4 h-4 text-yellow-600" /> Score Distribution
          </h3>

          <div className="h-64 w-full pt-2">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={analytics.distribution} margin={{ top: 10, right: 10, left: -30, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="name" stroke="#0f172a" fontSize={10} tickLine={false} />
                <YAxis allowDecimals={false} stroke="#0f172a" fontSize={11} tickLine={false} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#FAF8F5',
                    color: '#0f172a',
                    border: '2px solid #0f172a',
                    borderRadius: '12px',
                    fontSize: '12px',
                    fontWeight: 'bold',
                    boxShadow: '3px 3px 0px #0f172a',
                  }}
                />
                <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                  {analytics.distribution.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} stroke="#0f172a" strokeWidth={1.5} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Areas for Improvement / Topic Mastery */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Topic Accuracy */}
        <div className="bg-white border-3 border-slate-900 rounded-2xl p-6 shadow-neo-md space-y-4">
          <h3 className="text-xs font-black uppercase tracking-wider text-slate-950 flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-700" /> Topic Mastery & Accuracy
          </h3>

          {analytics.topicStats.length > 0 ? (
            <div className="space-y-3">
              {analytics.topicStats.map((t, idx) => (
                <div key={idx} className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs font-bold text-slate-900">
                    <span>{t.topic}</span>
                    <span
                      className={`font-mono text-xs font-black ${
                        t.accuracy >= 80
                          ? 'text-emerald-800'
                          : t.accuracy >= 60
                          ? 'text-amber-800'
                          : 'text-rose-800'
                      }`}
                    >
                      {t.accuracy}%
                    </span>
                  </div>
                  <div className="w-full bg-slate-200 h-2.5 rounded-full overflow-hidden border border-slate-900">
                    <div
                      className={`h-full transition-all ${
                        t.accuracy >= 80
                          ? 'bg-emerald-400'
                          : t.accuracy >= 60
                          ? 'bg-amber-400'
                          : 'bg-rose-400'
                      }`}
                      style={{ width: `${t.accuracy}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs font-bold text-slate-500 py-6 text-center">
              Take mock exams to generate granular topic-by-topic accuracy diagnostics.
            </p>
          )}
        </div>

        {/* Actionable Improvement Focus */}
        <div className="bg-white border-3 border-slate-900 rounded-2xl p-6 shadow-neo-md space-y-4">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-rose-200 border-2 border-slate-900 text-slate-950 rounded-xl shadow-neo-sm">
              <AlertTriangle className="w-4 h-4" />
            </div>
            <h3 className="text-xs font-black uppercase tracking-wider text-slate-950">
              Targeted Improvement Actions
            </h3>
          </div>

          {analytics.weakTopics.length > 0 ? (
            <div className="space-y-2.5">
              {analytics.weakTopics.map((topic, idx) => (
                <div
                  key={idx}
                  className="p-3 bg-rose-100 border-2 border-slate-900 rounded-xl text-xs font-black text-rose-950 flex items-center justify-between shadow-neo-sm"
                >
                  <div>
                    <strong className="block text-slate-950 font-black">{topic.topic}</strong>
                    <span className="text-[11px] text-rose-800 font-bold">Accuracy currently at {topic.accuracy}%</span>
                  </div>
                  <span className="px-2.5 py-1 bg-white border-2 border-slate-900 text-rose-900 rounded-lg text-[10px] font-black uppercase shadow-xs">
                    Drill Suggested
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <div className="p-6 bg-emerald-100 border-2 border-slate-900 rounded-2xl text-xs text-emerald-950 flex flex-col items-center text-center gap-2 shadow-neo-sm">
              <CheckCircle2 className="w-8 h-8 text-emerald-800" />
              <strong className="font-black text-sm text-emerald-950">Great conceptual retention!</strong>
              <p className="text-slate-700 text-xs font-bold max-w-sm">
                You currently have high mastery across recorded topics. Keep maintaining spaced recall drills!
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Attempt History Table */}
      <div className="bg-white border-3 border-slate-900 rounded-2xl p-6 shadow-neo-md space-y-4">
        <h3 className="text-sm font-black text-slate-950 flex items-center gap-2">
          <Calendar className="w-4 h-4 text-cyan-800" /> Complete Assessment History Logs
        </h3>

        {filteredAttempts.length === 0 ? (
          <p className="text-xs font-bold text-slate-500 py-6 text-center">No quiz or exam history recorded yet.</p>
        ) : (
          <div className="overflow-x-auto border-2 border-slate-900 rounded-xl shadow-neo-sm">
            <table className="w-full text-left text-xs border-collapse">
              <thead className="bg-[#FAF8F5] text-slate-950 font-black border-b-2 border-slate-900">
                <tr>
                  <th className="p-3">Type</th>
                  <th className="p-3">Assessment Title</th>
                  <th className="p-3">Subject</th>
                  <th className="p-3">Score</th>
                  <th className="p-3">Correct / Total</th>
                  <th className="p-3">Date</th>
                  <th className="p-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y-2 divide-slate-200">
                {filteredAttempts.map((att) => (
                  <tr
                    key={att.id}
                    onClick={() => setSelectedAttempt(att)}
                    className="hover:bg-yellow-50 cursor-pointer transition-colors font-bold"
                  >
                    <td className="p-3">
                      <span
                        className={`px-2 py-0.5 rounded-md text-[10px] font-black border border-slate-900 shadow-xs ${
                          att.type === 'Exam'
                            ? 'bg-cyan-300 text-slate-950'
                            : 'bg-yellow-300 text-slate-950'
                        }`}
                      >
                        {att.type}
                      </span>
                    </td>
                    <td className="p-3 font-black text-slate-950">{att.name}</td>
                    <td className="p-3 text-slate-700">{att.subjectName}</td>
                    <td className="p-3">
                      <span
                        className={`font-black font-mono text-sm ${
                          att.overallScore >= 70 ? 'text-emerald-800' : 'text-rose-800'
                        }`}
                      >
                        {att.overallScore}%
                      </span>
                    </td>
                    <td className="p-3 text-slate-700 font-mono">
                      {att.correctQuestions} / {att.totalQuestions}
                    </td>
                    <td className="p-3 text-slate-600">{new Date(att.date).toLocaleDateString()}</td>
                    <td className="p-3 text-right">
                      <button
                        onClick={(e) => handleDeleteAttempt(att.id, e)}
                        className="p-1.5 text-slate-500 hover:text-rose-700 hover:bg-rose-100 rounded-lg transition-colors border border-transparent hover:border-slate-900"
                        title="Delete log"
                      >
                        <Trash2 className="w-4 h-4" />
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

import React, { useEffect, useRef, useState } from 'react';
import { StudyTask } from '../../types';
import { studyStore } from '../../hooks/useStudyStore';
import { useActiveSubjectId, useSubjects, useTasks } from '../../hooks/useStudyStore';
import {
  CheckCircle,
  Circle,
  Plus,
  Trash2,
  Clock,
  Flame,
  CheckSquare
} from 'lucide-react';

interface PlannerViewProps {
  onOpenPomodoro?: () => void;
}

export const PlannerView: React.FC<PlannerViewProps> = ({ onOpenPomodoro }) => {
  const tasks = useTasks();
  const subjects = useSubjects();
  const activeSubjectId = useActiveSubjectId();

  const [newTaskTitle, setNewTaskTitle] = useState('');
  // Subject for the NEW task form. Follows the store's active subject until the
  // user explicitly overrides it (guarded follow).
  const [taskSubjectId, setTaskSubjectId] = useState<string>('');
  const lastActiveRef = useRef<string | null>(activeSubjectId);

  useEffect(() => {
    const prev = lastActiveRef.current;
    lastActiveRef.current = activeSubjectId;
    if (activeSubjectId && (taskSubjectId === '' || taskSubjectId === prev)) {
      setTaskSubjectId(activeSubjectId);
    }
  }, [activeSubjectId, taskSubjectId]);

  const [taskDueDate, setTaskDueDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [taskDuration, setTaskDuration] = useState<number>(30);
  const [filter, setFilter] = useState<'ALL' | 'PENDING' | 'COMPLETED'>('ALL');

  const handleAddTask = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTaskTitle.trim()) return;

    studyStore.addTask({
      subjectId: taskSubjectId || subjects[0]?.id || 'general',
      title: newTaskTitle.trim(),
      dueDate: taskDueDate,
      estimatedMinutes: taskDuration,
      completed: false,
    });

    setNewTaskTitle('');
  };

  const toggleTask = (task: StudyTask) => {
    studyStore.updateTask(task.id, { completed: !task.completed });
  };

  const deleteTask = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    studyStore.deleteTask(id);
  };

  const completedCount = tasks.filter((t) => t.completed).length;
  const pendingCount = tasks.filter((t) => !t.completed).length;
  const progressPercent = tasks.length > 0 ? Math.round((completedCount / tasks.length) * 100) : 0;

  const filteredTasks = tasks.filter((t) => {
    if (filter === 'PENDING') return !t.completed;
    if (filter === 'COMPLETED') return t.completed;
    return true;
  });

  return (
    <div className="space-y-6">
      {/* Top Banner with Stats & Pomodoro Launch */}
      <div className="bg-white border-3 border-slate-900 rounded-2xl p-5 md:p-6 shadow-neo-md flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-yellow-300 border-2 border-slate-900 flex items-center justify-center text-slate-950 shrink-0 shadow-neo-sm">
            <Flame className="w-7 h-7 fill-current" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="badge-chip px-2.5 py-1 bg-emerald-300 text-slate-950 border-2 border-slate-900 rounded-md shadow-neo-sm inline-flex items-center gap-1.5">
                <span className="font-ethiopic font-bold text-xs normal-case">ተማሪ</span>
                <span>Routine</span>
              </span>
              <span className="text-xs font-bold text-slate-600">
                {completedCount} of {tasks.length} tasks finished
              </span>
            </div>
            <h2 className="section-heading text-slate-950 mt-1">Study Goal & Milestone Planner</h2>
            <p className="text-xs font-bold text-slate-600 mt-0.5">
              Organize syllabus deadlines, active recall checkpoints, and Pomodoro focus intervals.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {onOpenPomodoro && (
            <button
              onClick={onOpenPomodoro}
              className="flex items-center gap-2 px-4 py-2.5 bg-yellow-300 hover:bg-yellow-200 text-slate-950 font-black text-xs rounded-xl border-2 border-slate-900 shadow-neo transition-all active:translate-y-0.5"
            >
              <Clock className="w-4 h-4" /> Start Focus Timer
            </button>
          )}
        </div>
      </div>

      {/* Main Grid: Add Task Card + Tasks List */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Add Task Form */}
        <div className="lg:col-span-5 bg-white border-3 border-slate-900 rounded-2xl p-6 shadow-neo-md space-y-5">
          <h3 className="text-xs font-black text-slate-950 uppercase tracking-wider flex items-center gap-2">
            <Plus className="w-4 h-4 text-cyan-800" /> Add New Study Goal
          </h3>

          <form onSubmit={handleAddTask} className="space-y-4">
            <div>
              <label className="block text-xs font-black uppercase tracking-wider text-slate-800 mb-1">
                Task Description
              </label>
              <input
                type="text"
                value={newTaskTitle}
                onChange={(e) => setNewTaskTitle(e.target.value)}
                placeholder="e.g. Master Glycolysis Pathways & Flashcards"
                className="w-full px-3.5 py-2.5 text-xs bg-[#FAF8F5] border-2 border-slate-900 rounded-xl font-bold text-slate-950 placeholder-slate-400 focus:outline-hidden focus:ring-2 focus:ring-amber-400 shadow-neo-sm"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-black uppercase tracking-wider text-slate-800 mb-1">
                Target Subject
              </label>
              <select
                value={taskSubjectId}
                onChange={(e) => setTaskSubjectId(e.target.value)}
                className="w-full px-3.5 py-2.5 text-xs bg-[#FAF8F5] border-2 border-slate-900 rounded-xl font-bold text-slate-950 focus:outline-hidden focus:ring-2 focus:ring-amber-400 shadow-neo-sm"
              >
                {subjects.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-black uppercase tracking-wider text-slate-800 mb-1">
                  Due Date
                </label>
                <input
                  type="date"
                  value={taskDueDate}
                  onChange={(e) => setTaskDueDate(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-[#FAF8F5] border-2 border-slate-900 rounded-xl font-bold text-slate-900 shadow-neo-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-black uppercase tracking-wider text-slate-800 mb-1">
                  Duration (Mins)
                </label>
                <input
                  type="number"
                  min={5}
                  max={180}
                  step={5}
                  value={taskDuration}
                  onChange={(e) => setTaskDuration(Number(e.target.value))}
                  className="w-full px-3 py-2 text-xs bg-[#FAF8F5] border-2 border-slate-900 rounded-xl font-bold text-slate-900 shadow-neo-sm"
                />
              </div>
            </div>

            <button
              type="submit"
              className="w-full py-3 bg-yellow-300 hover:bg-yellow-200 text-slate-950 font-black text-xs rounded-xl border-2 border-slate-900 shadow-neo transition-all active:translate-y-0.5 flex items-center justify-center gap-2"
            >
              <Plus className="w-4 h-4" /> Save Study Goal
            </button>
          </form>

          {/* Quick Progress Bar */}
          <div className="pt-4 border-t-2 border-slate-200">
            <div className="flex items-center justify-between text-xs font-black text-slate-950 mb-2">
              <span>Goal Completion Progress</span>
              <span className="font-mono text-cyan-800">{progressPercent}%</span>
            </div>
            <div className="w-full bg-slate-200 h-3 rounded-full overflow-hidden border-2 border-slate-900">
              <div
                className="h-full bg-yellow-400 transition-all duration-300"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
          </div>
        </div>

        {/* Task List */}
        <div className="lg:col-span-7 bg-white border-3 border-slate-900 rounded-2xl p-6 shadow-neo-md space-y-5">
          <div className="flex items-center justify-between flex-wrap gap-2 pb-4 border-b-2 border-slate-200">
            <h3 className="text-xs font-black text-slate-950 uppercase tracking-wider flex items-center gap-2">
              <CheckSquare className="w-4 h-4 text-cyan-800" /> Daily Action Checklist
            </h3>

            <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-xl border-2 border-slate-900">
              {(['ALL', 'PENDING', 'COMPLETED'] as const).map((f) => (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  className={`px-3 py-1 rounded-lg text-xs font-black transition-all ${
                    filter === f ? 'bg-yellow-300 text-slate-950 border border-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-950'
                  }`}
                >
                  {f}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-2.5 max-h-[500px] overflow-y-auto pr-1">
            {filteredTasks.length === 0 ? (
              <div className="p-8 text-center text-slate-500 font-bold text-xs border-2 border-dashed border-slate-300 rounded-xl bg-[#FAF8F5]">
                No tasks match current filter. Add one on the left!
              </div>
            ) : (
              filteredTasks.map((task) => {
                const sub = subjects.find((s) => s.id === task.subjectId);
                return (
                  <div
                    key={task.id}
                    onClick={() => toggleTask(task)}
                    className={`p-3.5 rounded-xl border-2 border-slate-900 flex items-center justify-between gap-3 cursor-pointer transition-all shadow-neo-sm ${
                      task.completed
                        ? 'bg-slate-100 opacity-60'
                        : 'bg-white hover:bg-yellow-50/50'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleTask(task);
                        }}
                        className="text-slate-900 focus:outline-hidden"
                      >
                        {task.completed ? (
                          <CheckCircle className="w-5 h-5 text-emerald-600 fill-emerald-100" />
                        ) : (
                          <Circle className="w-5 h-5 text-slate-400 hover:text-slate-700" />
                        )}
                      </button>

                      <div>
                        <h4
                          className={`text-xs font-black ${
                            task.completed ? 'line-through text-slate-500' : 'text-slate-950'
                          }`}
                        >
                          {task.title}
                        </h4>
                        <div className="flex items-center gap-2 text-[10px] font-bold text-slate-500 mt-1">
                          {sub && (
                            <span className="px-2 py-0.5 rounded-md bg-yellow-100 border border-slate-900 text-slate-900 font-black">
                              {sub.name}
                            </span>
                          )}
                          <span>•</span>
                          <span>Due: {task.dueDate || 'Today'}</span>
                          {task.estimatedMinutes && (
                            <>
                              <span>•</span>
                              <span>{task.estimatedMinutes}m</span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>

                    <button
                      onClick={(e) => deleteTask(task.id, e)}
                      className="p-1.5 text-slate-400 hover:text-rose-700 hover:bg-rose-100 rounded-lg transition-colors border border-transparent hover:border-slate-900"
                      title="Delete goal"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

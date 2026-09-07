import React, { useEffect, useRef, useState } from 'react';
import { StudyTask } from '../../types';
import { studyStore } from '../../hooks/useStudyStore';
import { useActiveSubjectId, useSubjects, useTasks } from '../../hooks/useStudyStore';
import { Button } from '../ui/button';
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

/** One class string for every text field, shared with the generation modals. */
const fieldClass =
  'w-full px-3.5 py-2 text-sm bg-background border border-border rounded-lg font-medium text-foreground focus:outline-hidden focus:ring-2 focus:ring-ring/50 shadow-2xs';

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
      {/* Header Bar */}
      <div className="bg-card border border-border/80 rounded-2xl p-6 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 bg-amber-500/10 border border-amber-500/20 rounded-2xl flex items-center justify-center text-amber-600 dark:text-amber-400 shrink-0 shadow-xs">
            <Flame className="w-7 h-7 fill-current" />
          </div>
          <div>
            <div className="flex items-center gap-2 mb-1.5 flex-wrap">
              <span className="font-ethiopic font-semibold text-amber-600 dark:text-amber-400 text-sm">
                ተማሪ
              </span>
              <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Routine
              </span>
              <span className="text-xs font-medium text-muted-foreground">·</span>
              <span className="text-xs font-medium text-foreground">
                <span className="font-mono tabular-nums">
                  {completedCount} of {tasks.length}
                </span>{' '}
                tasks finished
              </span>
            </div>
            <h2 className="font-editorial text-2xl font-bold text-foreground tracking-tight">
              Study Goal & Milestone Planner
            </h2>
            <p className="text-sm text-muted-foreground mt-1">
              Organize syllabus deadlines, active recall checkpoints, and Pomodoro focus intervals.
            </p>
          </div>
        </div>

        {onOpenPomodoro && (
          <Button onClick={onOpenPomodoro} className="shrink-0">
            <Clock className="size-3.5" /> Start Focus Timer
          </Button>
        )}
      </div>

      {/* Main Grid: Add Task Card + Tasks List */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        {/* Add Task Form */}
        <div className="lg:col-span-5 bg-card border border-border/80 rounded-2xl p-6 shadow-xs space-y-5">
          <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
            <Plus className="w-4 h-4 text-amber-600 dark:text-amber-400" /> Add New Study Goal
          </h3>

          <form onSubmit={handleAddTask} className="space-y-4">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-foreground mb-1">
                Task Description
              </label>
              <input
                type="text"
                value={newTaskTitle}
                onChange={(e) => setNewTaskTitle(e.target.value)}
                placeholder="e.g. Master Glycolysis Pathways & Flashcards"
                className={`${fieldClass} placeholder:text-muted-foreground/70`}
                required
              />
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-foreground mb-1">
                Target Subject
              </label>
              <select
                value={taskSubjectId}
                onChange={(e) => setTaskSubjectId(e.target.value)}
                className={fieldClass}
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
                <label className="block text-xs font-bold uppercase tracking-wider text-foreground mb-1">
                  Due Date
                </label>
                <input
                  type="date"
                  value={taskDueDate}
                  onChange={(e) => setTaskDueDate(e.target.value)}
                  className={`${fieldClass} font-mono`}
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-foreground mb-1">
                  Duration (Mins)
                </label>
                <input
                  type="number"
                  min={5}
                  max={180}
                  step={5}
                  value={taskDuration}
                  onChange={(e) => setTaskDuration(Number(e.target.value))}
                  className={`${fieldClass} font-mono tabular-nums`}
                />
              </div>
            </div>

            <Button type="submit" className="w-full py-2 h-9">
              <Plus className="size-3.5" /> Save Study Goal
            </Button>
          </form>

          {/* Quick Progress Bar */}
          <div className="pt-4 border-t border-border">
            <div className="flex items-center justify-between text-xs font-semibold text-foreground mb-2">
              <span>Goal Completion Progress</span>
              <span className="font-mono tabular-nums text-amber-600 dark:text-amber-400">{progressPercent}%</span>
            </div>
            <div className="w-full bg-muted h-2.5 rounded-full overflow-hidden">
              <div
                className="h-full bg-amber-500 transition-all duration-300"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
          </div>
        </div>

        {/* Task List */}
        <div className="lg:col-span-7 bg-card border border-border/80 rounded-2xl p-6 shadow-xs space-y-5">
          <div className="flex items-center justify-between flex-wrap gap-2 pb-4 border-b border-border">
            <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
              <CheckSquare className="w-4 h-4 text-amber-600 dark:text-amber-400" /> Daily Action Checklist
            </h3>

            <div className="flex items-center gap-1 bg-muted/60 p-1 rounded-xl border border-border">
              {(['ALL', 'PENDING', 'COMPLETED'] as const).map((f) => (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  aria-pressed={filter === f}
                  className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors outline-hidden focus-visible:ring-2 focus-visible:ring-ring ${
                    filter === f
                      ? 'bg-card border border-border text-foreground font-semibold shadow-2xs'
                      : 'border border-transparent text-muted-foreground hover:text-foreground'
                  }`}
                >
                  {f}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-2.5 max-h-[500px] overflow-y-auto pr-1">
            {filteredTasks.length === 0 ? (
              <div className="p-8 text-center text-muted-foreground font-medium text-xs border border-dashed border-border rounded-xl bg-muted/40">
                No tasks match the current filter. Add one on the left!
              </div>
            ) : (
              filteredTasks.map((task) => {
                const sub = subjects.find((s) => s.id === task.subjectId);
                return (
                  <div
                    key={task.id}
                    onClick={() => toggleTask(task)}
                    className={`p-3.5 rounded-xl border flex items-center justify-between gap-3 cursor-pointer transition-colors ${
                      task.completed
                        ? 'bg-muted/50 border-border/60'
                        : 'bg-background border-border/80 hover:bg-muted/50 hover:border-border'
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleTask(task);
                        }}
                        className="text-foreground focus:outline-hidden focus-visible:ring-2 focus-visible:ring-ring rounded-md shrink-0"
                        aria-label={task.completed ? `Mark "${task.title}" as pending` : `Mark "${task.title}" as complete`}
                      >
                        {task.completed ? (
                          <CheckCircle className="w-5 h-5 text-emerald-600 dark:text-emerald-400 fill-emerald-500/10" />
                        ) : (
                          <Circle className="w-5 h-5 text-muted-foreground hover:text-foreground" />
                        )}
                      </button>

                      <div className="min-w-0">
                        <h4
                          className={`text-xs font-semibold ${
                            task.completed ? 'line-through text-muted-foreground' : 'text-foreground'
                          }`}
                        >
                          {task.title}
                        </h4>
                        <div className="flex items-center gap-2 text-[10px] font-medium text-muted-foreground mt-1 flex-wrap">
                          {sub && (
                            <span className="px-2 py-0.5 rounded-md bg-amber-500/10 border border-amber-500/20 text-amber-700 dark:text-amber-400">
                              {sub.name}
                            </span>
                          )}
                          <span>Due {task.dueDate || 'today'}</span>
                          {task.estimatedMinutes && (
                            <span className="font-mono tabular-nums">{task.estimatedMinutes}m</span>
                          )}
                        </div>
                      </div>
                    </div>

                    <button
                      onClick={(e) => deleteTask(task.id, e)}
                      className="p-1.5 text-muted-foreground hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30 rounded-lg transition-colors shrink-0"
                      title="Delete goal"
                      aria-label={`Delete ${task.title}`}
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

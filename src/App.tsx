import React, {
  lazy,
  Suspense,
  useState,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
} from 'react';
import {
  studyStore,
  useActiveSubject,
  useActiveSubjectId,
  useAllAttempts,
  useSettings,
  useSubjects,
} from './hooks/useStudyStore';
import { computeStudyStreak } from './utils/analytics';
import { useOnlineStatus } from './hooks/useOnlineStatus';
import { NotesManager } from './components/notes/NotesManager';
import { QuizzesManager } from './components/quizzes/QuizzesManager';
import { ExamsManager } from './components/exams/ExamsManager';
import { PlannerView } from './components/planner/PlannerView';
import { PomodoroTimer } from './components/tools/PomodoroTimer';
import { ExplainTermModal } from './components/tools/ExplainTermModal';
import { ApiKeySettingsModal } from './components/tools/ApiKeySettingsModal';
import { ModelPicker } from './components/tools/ModelPicker';
import { Modal, type MorphOrigin } from './components/ui/Modal';
import { useModalOrigin } from './components/ui/useModalOrigin';
import {
  prefersReducedMotion,
  runViewTransition,
  type InteractionOrigin,
} from './utils/viewTransition';
import {
  BookOpen,
  Layers,
  GraduationCap,
  TrendingUp,
  Calendar,
  Clock,
  Key,
  Plus,
  FolderPlus,
  Trash2,
  ChevronDown,
  X,
  Flame,
  Menu,
  PanelLeftClose,
  PanelLeftOpen,
} from 'lucide-react';

/** AnalyticsView pulls in recharts (~200kB gzip); load it only when opened. */
const AnalyticsView = lazy(() =>
  import('./components/analytics/AnalyticsView').then((m) => ({ default: m.AnalyticsView }))
);

type TabType = 'notes' | 'quizzes' | 'exams' | 'analytics' | 'planner';

/** Which app-level modal is open — one state instead of one boolean per modal. */
type OpenModal = 'api-key' | 'pomodoro' | 'add-subject' | null;

export default function App() {
  const subjects = useSubjects();
  const currentSubject = useActiveSubject();
  const activeSubjectId = useActiveSubjectId();
  const deleteSubject = studyStore.deleteSubject;

  const settings = useSettings();
  const zenMode = settings.zenMode;

  // Streak is derived from Attempts across every Subject, not the active one:
  // studying anything today counts as studying.
  const isOnline = useOnlineStatus();
  const allAttempts = useAllAttempts();
  const streak = useMemo(() => computeStudyStreak(allAttempts), [allAttempts]);
  const streakMessage = useMemo(() => {
    if (streak.days === 0) return 'Finish a drill or exam to start a streak.';
    if (streak.daysThisWeek >= 7) return 'Every day this week. Take a rest day if you need one.';
    if (!streak.studiedToday) return 'Study today to keep the streak going.';
    const remaining = 7 - streak.daysThisWeek;
    return `${remaining} more ${remaining === 1 ? 'day' : 'days'} this week to make it a full seven.`;
  }, [streak]);

  const [activeTab, setActiveTab] = useState<TabType>('notes');
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const layoutRef = useRef<HTMLDivElement | null>(null);

  /**
   * Zen Mode collapses the desktop sidebar by animating the layout's grid
   * column to 0 — the sidebar is never unmounted, so it slides out to the left
   * and returns to exactly where the learner remembers it. Persisted in
   * settings (ADR-0001: no per-screen copies of store data).
   *
   * The animate flag is set imperatively rather than through state because it
   * must be on the element *before* the column change paints.
   */
  const toggleZenMode = (origin: InteractionOrigin = 'pointer') => {
    const animate = origin === 'pointer' && !prefersReducedMotion();
    layoutRef.current?.setAttribute('data-animate', animate ? 'true' : 'false');
    studyStore.saveSettings({ zenMode: !zenMode });
  };

  // Sliding nav indicator: one element that travels between items instead of a
  // highlight class that teleports (spatial consistency).
  const navListRef = useRef<HTMLDivElement | null>(null);
  const navItemRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const navAnimateRef = useRef(false);
  const [navIndicator, setNavIndicator] = useState<{ y: number; h: number } | null>(null);

  // Modals and Drawers
  const [openModal, setOpenModal] = useState<OpenModal>(null);
  // Whichever control opened the current app-level modal, so it can morph from it.
  const modalOrigin = useModalOrigin();
  const explainOrigin = useModalOrigin();
  const [confirmDeleteSubjectId, setConfirmDeleteSubjectId] = useState<string | null>(null);
  const [explainTermData, setExplainTermData] = useState<{ term: string; context?: string } | null>(
    null
  );
  const [newSubjectName, setNewSubjectName] = useState('');
  const [newSubjectAmharicName, setNewSubjectAmharicName] = useState('');
  const [newSubjectCode, setNewSubjectCode] = useState('');
  const [newSubjectColor, setNewSubjectColor] = useState('#2563eb');

  const handleAddSubject = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSubjectName.trim()) return;

    // The store creates the subject and makes it the active subject.
    studyStore.addSubject({
      name: newSubjectName.trim(),
      amharicName: newSubjectAmharicName.trim() || undefined,
      code: newSubjectCode.trim() || undefined,
      color: newSubjectColor,
    });

    setNewSubjectName('');
    setNewSubjectAmharicName('');
    setNewSubjectCode('');
    setOpenModal(null);
  };

  /**
   * Lateral navigation. Pointer opens cross-fade (ADR-0004); keyboard opens are
   * instant — keys 1-5 are used many times a session and an animation the
   * learner did not ask to watch is pure latency.
   */
  const handleTabChange = (tab: TabType, origin: InteractionOrigin = 'pointer') => {
    if (tab === activeTab) return;
    navAnimateRef.current = origin === 'pointer';
    runViewTransition(() => setActiveTab(tab), { origin });
  };

  const handleDeleteSubject = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    // The delete button is hidden when one Subject remains; guard anyway.
    if (subjects.length <= 1) return;
    setConfirmDeleteSubjectId(id);
  };

  const handleHighlightExplain = (term: string, context?: string, origin?: MorphOrigin) => {
    // The explainer grows out of the word the learner pressed, not the centre
    // of the screen, so the answer is visibly about *that* term.
    explainOrigin.capture(origin ?? null);
    setExplainTermData({ term, context });
  };

  const navItems = [
    { id: 'notes', label: 'Interactive Notes', icon: BookOpen },
    { id: 'quizzes', label: 'Flashcard Quizzes', icon: Layers },
    { id: 'exams', label: 'Mock Exams', icon: GraduationCap },
    { id: 'analytics', label: 'Analytics & Progress', icon: TrendingUp },
    { id: 'planner', label: 'Study Planner', icon: Calendar },
  ];

  /**
   * Measure the active nav item and park the indicator on it. Runs before paint
   * so the indicator never renders a frame out of position; re-measures on
   * resize because the sidebar reflows at the `lg` breakpoint.
   */
  useLayoutEffect(() => {
    const measure = () => {
      const el = navItemRefs.current[activeTab];
      if (!el) return;
      setNavIndicator({ y: el.offsetTop, h: el.offsetHeight });
    };

    measure();

    const observer = new ResizeObserver(measure);
    if (navListRef.current) observer.observe(navListRef.current);
    return () => observer.disconnect();
  }, [activeTab]);

  // Mobile swipe-to-dismiss gesture state for sidebar drawer
  const [asideDragOffset, setAsideDragOffset] = useState(0);
  const [isDraggingAside, setIsDraggingAside] = useState(false);
  const asideTouchStartRef = useRef<{ x: number; y: number; time: number } | null>(null);
  /** Last sample of the drawer drag, for release velocity. */
  const asideLastSampleRef = useRef<{ x: number; time: number } | null>(null);

  const handleAsideTouchStart = (e: React.TouchEvent) => {
    if (!sidebarOpen) return;
    asideTouchStartRef.current = {
      x: e.touches[0].clientX,
      y: e.touches[0].clientY,
      time: Date.now(),
    };
    setIsDraggingAside(true);
    setAsideDragOffset(0);
  };

  const handleAsideTouchMove = (e: React.TouchEvent) => {
    if (!asideTouchStartRef.current || !isDraggingAside) return;
    const dx = e.touches[0].clientX - asideTouchStartRef.current.x;
    const dy = e.touches[0].clientY - asideTouchStartRef.current.y;
    asideLastSampleRef.current = { x: e.touches[0].clientX, time: Date.now() };

    if (Math.abs(dx) > Math.abs(dy)) {
      if (dx < 0) {
        // Swiping left (closing drawer)
        setAsideDragOffset(dx);
      } else {
        // Rubber-band resistance when dragging right
        setAsideDragOffset(dx * 0.15);
      }
    }
  };

  /**
   * Dismissing the drawer is destructive-ish (it hides navigation), so it
   * commits on release only, never mid-drag — cross the line, change your mind,
   * drag back, and the drawer stays. A short fast flick still dismisses, since
   * distance alone would ignore an obviously intentional throw.
   */
  const handleAsideTouchEnd = () => {
    const start = asideTouchStartRef.current;
    const last = asideLastSampleRef.current;
    const elapsed = start && last ? last.time - start.time : 0;
    const velocity = start && last && elapsed > 0 ? (start.x - last.x) / elapsed : 0;

    if (asideDragOffset < -55 || velocity > 0.4) {
      setSidebarOpen(false);
    }
    setAsideDragOffset(0);
    setIsDraggingAside(false);
    asideTouchStartRef.current = null;
    asideLastSampleRef.current = null;
  };

  const handleAsideTouchCancel = () => {
    setAsideDragOffset(0);
    setIsDraggingAside(false);
    asideTouchStartRef.current = null;
    asideLastSampleRef.current = null;
  };

  // Desktop keyboard navigation (1-5 for study hubs, Escape to close drawer/modals)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.tagName === 'SELECT' ||
          target.isContentEditable)
      ) {
        return;
      }

      if (openModal || confirmDeleteSubjectId || explainTermData) {
        if (e.key === 'Escape') {
          setOpenModal(null);
          setConfirmDeleteSubjectId(null);
          setExplainTermData(null);
        }
        return;
      }

      const shortcutTabs: Record<string, TabType> = {
        '1': 'notes',
        '2': 'quizzes',
        '3': 'exams',
        '4': 'analytics',
        '5': 'planner',
      };

      const shortcutTab = shortcutTabs[e.key];
      if (shortcutTab) {
        // Keyboard path: no view transition, no indicator travel.
        handleTabChange(shortcutTab, 'keyboard');
        setSidebarOpen(false);
      } else if (e.key === 'z' || e.key === 'Z') {
        toggleZenMode('keyboard');
      } else if (e.key === 'Escape' && zenMode) {
        // Escape leaves Zen before it does anything else global.
        toggleZenMode('keyboard');
      } else if (e.key === 'Escape' && sidebarOpen) {
        setSidebarOpen(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [openModal, confirmDeleteSubjectId, explainTermData, sidebarOpen, activeTab, zenMode]);

  return (
    <div
      ref={layoutRef}
      className="app-layout h-screen w-full bg-[#F1F5F9] text-slate-800 font-sans overflow-hidden"
      data-zen={zenMode ? 'true' : 'false'}
      data-animate="false"
    >
      {/* Mobile Sidebar Overlay with backdrop blur */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs z-40 lg:hidden transition-opacity duration-200"
          onClick={() => setSidebarOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Left Sidebar (Neo-Brutalist Canvas) */}
      <aside
        onTouchStart={handleAsideTouchStart}
        onTouchMove={handleAsideTouchMove}
        onTouchEnd={handleAsideTouchEnd}
        onTouchCancel={handleAsideTouchCancel}
        style={{
          transform:
            sidebarOpen && asideDragOffset !== 0
              ? `translateX(${Math.min(0, asideDragOffset)}px)`
              : undefined,
          transition: isDraggingAside ? 'none' : undefined,
        }}
        className={`app-sidebar fixed lg:static inset-y-0 left-0 z-50 w-72 sm:w-76 lg:w-auto bg-[#FFFDF9] text-slate-950 h-full max-h-screen shadow-neo-lg lg:shadow-none select-none transition-transform duration-200 ease-out ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        }`}
      >
        {/* Fixed-width inner panel. The padding and border live here, not on the
            <aside>, so Zen Mode can collapse the grid column to 0 without the
            contents reflowing on the way out. */}
        <div className="app-sidebar-inner w-72 sm:w-76 xl:w-76 h-full flex flex-col overflow-y-auto overscroll-contain p-4 border-r-3 border-slate-900">
        <div className="space-y-4 shrink-0">
          {/* Brand Header: Prominent TEMARI ተማሪ with Ethiopic Identity Layer */}
          <div className="bg-[#FEF08A] border-3 border-slate-900 rounded-2xl p-3.5 shadow-neo relative overflow-hidden group">
            {/* Mobile Drag Indicator Handle */}
            <div
              className="lg:hidden absolute top-1.5 left-1/2 -translate-x-1/2 w-8 h-1 bg-slate-900/35 rounded-full"
              aria-hidden="true"
            />
            <div className="flex items-center justify-between mt-0.5">
              <div className="flex items-center gap-2.5">
                <div className="w-11 h-11 rounded-xl bg-slate-900 text-yellow-300 flex items-center justify-center font-bold text-2xl shadow-neo-sm shrink-0 border-2 border-yellow-300 font-ethiopic leading-none transition-transform group-hover:scale-105">
                  ተ
                </div>
                <div>
                  <div className="flex items-center gap-1.5">
                    <h1 className="font-editorial text-lg font-bold text-slate-950 tracking-tight leading-none">
                      TEMARI
                    </h1>
                    <span className="app-wordmark px-2 py-0.5 bg-slate-900 text-yellow-300 rounded-lg border border-slate-900 inline-flex items-center shadow-neo-xs leading-none">
                      ተማሪ
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5 mt-1">
                    <p className="text-[10px] font-bold text-slate-700 tracking-wider uppercase font-mono">
                      AI Study Companion
                    </p>
                    {/* The app's only status dot, and it reports real state:
                        green when a Provider is reachable, amber when
                        generation will fall back to the offline adapter. */}
                    <span
                      className={`w-1.5 h-1.5 rounded-full border border-slate-900 ${
                        isOnline ? 'bg-emerald-500' : 'bg-amber-500'
                      }`}
                      role="img"
                      aria-label={isOnline ? 'Online' : 'Offline, generation will run locally'}
                      title={isOnline ? 'Online' : 'Offline, generation will run locally'}
                    />
                  </div>
                </div>
              </div>
              <button
                onClick={() => setSidebarOpen(false)}
                className="lg:hidden min-w-[44px] min-h-[44px] flex items-center justify-center p-2 text-slate-950 bg-white hover:bg-rose-100 rounded-xl border-2 border-slate-900 shadow-neo-xs btn-kinetic active:translate-x-0.5 active:translate-y-0.5"
                title="Close Navigation"
                aria-label="Close navigation sidebar"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Active Course Card in Sidebar */}
          <div className="bg-white rounded-2xl p-3 border-2 border-slate-900 shadow-neo-sm">
            <div className="flex items-center justify-between text-[11px] font-black uppercase tracking-wider text-slate-800 mb-2">
              <span className="flex items-center gap-1.5">
                <BookOpen className="w-3.5 h-3.5 text-slate-900" />
                <span>Active Subject</span>
              </span>
              <button
                onClick={(e) => {
                  modalOrigin.capture(e);
                  setOpenModal('add-subject');
                }}
                className="btn-kinetic px-2.5 py-1 bg-cyan-300 hover:bg-cyan-200 text-slate-950 rounded-lg border-2 border-slate-900 flex items-center gap-1 text-[10px] font-black shadow-neo-xs transition-all active:translate-x-0.5 active:translate-y-0.5 min-h-[32px]"
                title="Add New Subject"
              >
                <Plus className="w-3 h-3 stroke-[2.5]" /> New
              </button>
            </div>
            <div className="relative">
              <select
                value={activeSubjectId ?? ''}
                onChange={(e) => studyStore.selectSubject(e.target.value)}
                className="w-full bg-[#FAF8F5] text-slate-950 text-xs font-black rounded-xl px-3 py-2.5 pr-8 border-2 border-slate-900 shadow-xs focus:outline-hidden focus:ring-2 focus:ring-amber-400 appearance-none cursor-pointer"
              >
                {subjects.map((sub) => (
                  <option key={sub.id} value={sub.id}>
                    {sub.name} {sub.amharicName ? `• ${sub.amharicName}` : ''} {sub.code ? `(${sub.code})` : ''}
                  </option>
                ))}
              </select>
              <div className="absolute right-2.5 top-1/2 -translate-y-1/2 flex items-center gap-1.5 pointer-events-none">
                <span
                  className="w-2.5 h-2.5 rounded-full border border-slate-900 shadow-xs"
                  style={{ backgroundColor: currentSubject?.color || '#3B82F6' }}
                />
                <ChevronDown className="w-4 h-4 text-slate-900 stroke-[2.5]" />
              </div>
            </div>
            {currentSubject && (
              <div className="mt-2 pt-2 border-t border-slate-200 flex items-center justify-between text-[10px] font-mono font-bold text-slate-600">
                <span className="flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full" style={{ backgroundColor: currentSubject.color }} />
                  <span className="text-slate-900">{currentSubject.code || 'CORE'}</span>
                </span>
                {currentSubject.amharicName && (
                  <span className="font-ethiopic font-black text-slate-800">
                    {currentSubject.amharicName}
                  </span>
                )}
              </div>
            )}
          </div>

          {/* Navigation Menu */}
          <nav className="space-y-1.5" aria-label="Study hub">
            <div className="flex items-center justify-between px-2 pb-1 text-[10px] font-black uppercase tracking-wider text-slate-500">
              <span>Study Hub</span>
              <span className="hidden lg:inline text-[9px] font-mono text-slate-400 font-bold">
                Keys 1-5
              </span>
            </div>
            <div
              ref={navListRef}
              className="app-nav-list space-y-1.5"
              data-animate={navAnimateRef.current ? 'true' : 'false'}
            >
              <div
                className="app-nav-indicator"
                data-ready={navIndicator ? 'true' : 'false'}
                aria-hidden="true"
                style={
                  navIndicator
                    ? ({
                        '--indicator-y': `${navIndicator.y}px`,
                        '--indicator-h': `${navIndicator.h}px`,
                      } as React.CSSProperties)
                    : undefined
                }
              />
              {navItems.map((item, index) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  ref={(el) => {
                    navItemRefs.current[item.id] = el;
                  }}
                  aria-current={isActive ? 'page' : undefined}
                  onClick={() => {
                    handleTabChange(item.id as TabType, 'pointer');
                    setSidebarOpen(false);
                  }}
                  className={`app-nav-item btn-kinetic min-h-[44px] w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-xs font-black border-2 text-left active:translate-x-0.5 active:translate-y-0.5 ${
                    isActive
                      ? 'text-slate-950 border-transparent translate-x-1'
                      : 'bg-white text-slate-800 border-slate-900/60 hover:border-slate-900 hover:bg-slate-50 shadow-neo-xs hover:shadow-neo-sm'
                  }`}
                >
                  <div
                    className={`p-1.5 rounded-lg border border-slate-900 shrink-0 ${
                      isActive ? 'bg-slate-900 text-yellow-300' : 'bg-slate-100 text-slate-900'
                    }`}
                  >
                    <Icon className="w-3.5 h-3.5" />
                  </div>
                  <span className="flex-1 font-bold">{item.label}</span>
                  <kbd className="hidden lg:inline-flex items-center justify-center w-5 h-5 bg-slate-900 text-yellow-300 font-mono text-[10px] font-black rounded border border-slate-900 shadow-neo-xs">
                    {index + 1}
                  </kbd>
                </button>
              );
              })}
            </div>
          </nav>

          {/* Quick AI & Tools section */}
          <div className="space-y-1.5 pt-2 border-t-2 border-slate-200">
            <div className="px-2 pb-1 text-[10px] font-black uppercase tracking-wider text-slate-500">
              Smart Utilities
            </div>
            <button
              onClick={(e) => {
                modalOrigin.capture(e);
                setOpenModal('pomodoro');
                setSidebarOpen(false);
              }}
              className="btn-kinetic min-h-[44px] w-full flex items-center justify-between px-3 py-2 bg-white hover:bg-amber-50 rounded-xl text-xs font-bold text-slate-900 border-2 border-slate-900 shadow-neo-xs hover:shadow-neo-sm transition-all active:translate-x-0.5 active:translate-y-0.5"
            >
              <span className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-amber-600" />
                <span>Focus Pomodoro</span>
              </span>
              <span className="text-[10px] px-1.5 py-0.5 bg-amber-200 text-amber-950 font-mono font-black rounded border border-slate-900 shadow-neo-xs">
                25m
              </span>
            </button>
            <button
              onClick={(e) => {
                modalOrigin.capture(e);
                setOpenModal('api-key');
                setSidebarOpen(false);
              }}
              className="btn-kinetic min-h-[44px] w-full flex items-center justify-between px-3 py-2 bg-white hover:bg-yellow-50 rounded-xl text-xs font-bold text-slate-900 border-2 border-slate-900 shadow-neo-xs hover:shadow-neo-sm transition-all active:translate-x-0.5 active:translate-y-0.5"
            >
              <div className="flex items-center gap-2">
                <Key className="w-4 h-4 text-purple-600" />
                <span>AI & Model Config</span>
              </div>
              <span className="text-[9px] font-black uppercase px-1.5 py-0.5 bg-yellow-200 border border-slate-900 rounded shadow-neo-xs">
                BYOK
              </span>
            </button>
          </div>
        </div>

        {/* Bottom Sidebar: Study Streak. Every number here is computed from
            real Attempts - a hardcoded "5-Day Streak / 85%" was telling every
            learner the same flattering lie on their first run. */}
        <div className="pt-3 mt-auto border-t-2 border-slate-200 shrink-0">
          <div className="bg-[#FEF08A] rounded-xl p-3 border-2 border-slate-900 shadow-neo-sm">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[11px] font-black text-slate-950 flex items-center gap-1.5">
                <Flame
                  className={`w-4 h-4 ${
                    streak.days > 0 ? 'text-amber-600 fill-amber-600' : 'text-slate-400'
                  }`}
                />
                {streak.days > 0
                  ? `${streak.days}-day streak`
                  : 'No streak yet'}
              </span>
              <span className="text-[10px] font-black px-1.5 py-0.5 bg-white text-slate-950 rounded border border-slate-900 shadow-neo-xs tabular-nums">
                {streak.daysThisWeek}/7
              </span>
            </div>
            <div
              className="w-full bg-white h-3 rounded-full border-2 border-slate-900 overflow-hidden mb-1.5 p-0.5"
              role="progressbar"
              aria-valuenow={streak.daysThisWeek}
              aria-valuemin={0}
              aria-valuemax={7}
              aria-label="Days studied this week"
            >
              <div
                className="bg-emerald-400 h-full rounded-full border border-slate-900/20 transition-[width] duration-500 ease-out"
                style={{ width: `${(streak.daysThisWeek / 7) * 100}%` }}
              />
            </div>
            <p className="text-[10px] font-bold text-slate-800 leading-tight text-pretty">
              {streakMessage}
            </p>
          </div>
        </div>
        </div>
      </aside>

      {/* Main Content View Container */}
      <div className="flex flex-col min-w-0 h-full overflow-hidden">
        {/* Top Header Bar */}
        <header className="app-header h-14 bg-white border-b-3 border-slate-900 flex items-center justify-between px-4 sm:px-6 shrink-0 z-10 shadow-xs">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setSidebarOpen(true)}
              className="lg:hidden p-1.5 text-slate-900 bg-yellow-300 rounded-lg border-2 border-slate-900 shadow-neo-sm active:translate-y-0.5"
              aria-label="Open navigation menu"
            >
              <Menu className="w-4 h-4" />
            </button>

            {/* Zen Mode: collapses the sidebar column on desktop. */}
            <button
              onClick={() => toggleZenMode('pointer')}
              className="btn-kinetic hidden lg:flex items-center gap-1.5 p-1.5 text-slate-900 bg-white hover:bg-slate-100 rounded-xl border-2 border-slate-900 shadow-neo-sm"
              title={zenMode ? 'Exit Zen Mode (Z)' : 'Enter Zen Mode (Z)'}
              aria-label={zenMode ? 'Exit Zen Mode' : 'Enter Zen Mode'}
              aria-pressed={zenMode}
            >
              {zenMode ? <PanelLeftOpen className="w-4 h-4" /> : <PanelLeftClose className="w-4 h-4" />}
            </button>

            {/* Subject Indicator Breadcrumb */}
            <div className="flex items-center gap-2 px-3 py-1 bg-[#FAF8F5] border-2 border-slate-900 rounded-xl shadow-neo-sm">
              <span
                className="w-3 h-3 rounded-full border border-slate-900"
                style={{ backgroundColor: currentSubject?.color || '#3B82F6' }}
              />
              <span className="text-xs font-black text-slate-950">
                {currentSubject?.name || 'General Studies'}
              </span>
              {currentSubject?.amharicName && (
                <span className="text-xs font-bold text-slate-600 font-ethiopic border-l-2 border-slate-300 pl-2 hidden sm:inline">
                  {currentSubject.amharicName}
                </span>
              )}
              {currentSubject?.code && (
                <span className="text-[10px] px-1.5 py-0.2 bg-slate-900 text-white font-mono font-bold rounded">
                  {currentSubject.code}
                </span>
              )}
            </div>
          </div>

          {/* Quick Action Controls */}
          <div className="flex items-center gap-2 sm:gap-3">
            {/* Dynamic Active AI Model Selector */}
            <ModelPicker
              variant="compact"
              onOpenSettings={() => setOpenModal('api-key')}
            />

            <button
              onClick={(e) => {
                modalOrigin.capture(e);
                setOpenModal('api-key');
              }}
              className="p-1.5 text-slate-900 bg-white hover:bg-slate-100 rounded-xl border-2 border-slate-900 shadow-neo-sm transition-all active:translate-y-0.5"
              title="AI Providers & Model Settings"
              aria-label="AI Providers and Models Settings"
            >
              <Key className="w-4 h-4" />
            </button>

            <div className="h-5 w-0.5 bg-slate-900 mx-0.5" />

            {/* User Profile Avatar with Ethiopian scholar badge */}
            <div className="flex items-center gap-2 pl-1">
              <div className="h-8 px-2 rounded-xl bg-slate-900 text-yellow-300 border-2 border-slate-900 flex items-center justify-center font-bold text-xs shadow-neo-sm font-ethiopic tracking-wide">
                ተማሪ
              </div>
              <span className="text-xs font-black text-slate-900 hidden md:block">
                Scholar
              </span>
            </div>
          </div>
        </header>

        {/* Scrollable View Area */}
        <main className="app-main flex-1 overflow-y-auto p-4 sm:p-6 bg-[#FAF8F5] bg-neo-dots">
          <div className="max-w-6xl mx-auto">
            {activeTab === 'notes' && (
              <NotesManager onHighlightTerm={handleHighlightExplain} />
            )}

            {activeTab === 'quizzes' && (
              <QuizzesManager onHighlightTerm={handleHighlightExplain} />
            )}

            {activeTab === 'exams' && <ExamsManager />}

            {activeTab === 'analytics' && (
              <Suspense
                fallback={
                  <div className="max-w-6xl mx-auto space-y-4 animate-pulse">
                    <div className="h-10 w-56 bg-slate-200 border-2 border-slate-900 rounded-xl" />
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                      {[0, 1, 2, 3].map((i) => (
                        <div key={i} className="h-24 bg-slate-200 border-2 border-slate-900 rounded-2xl" />
                      ))}
                    </div>
                    <div className="h-64 bg-slate-200 border-2 border-slate-900 rounded-2xl" />
                  </div>
                }
              >
                <AnalyticsView />
              </Suspense>
            )}

            {activeTab === 'planner' && (
              <PlannerView onOpenPomodoro={() => setOpenModal('pomodoro')} />
            )}
          </div>
        </main>
      </div>

      {/* Modals and Side Drawers */}
      <ApiKeySettingsModal
        isOpen={openModal === 'api-key'}
        onClose={() => setOpenModal(null)}
        onSaved={() => {}}
        originRef={modalOrigin.ref}
      />

      <PomodoroTimer
        isOpen={openModal === 'pomodoro'}
        onClose={() => setOpenModal(null)}
      />

      <ExplainTermModal
        term={explainTermData?.term || ''}
        context={explainTermData?.context}
        onClose={() => setExplainTermData(null)}
        originRef={explainOrigin.ref}
      />

      {/* Add Subject Modal */}
      <Modal
        open={openModal === 'add-subject'}
        onClose={() => setOpenModal(null)}
        originRef={modalOrigin.ref}
        title="Add Course Subject"
        subtitle="Create a dedicated subject folder in Temari"
        icon={<FolderPlus className="w-5 h-5" />}
        iconClassName="bg-cyan-300 text-slate-950"
      >
        <form onSubmit={handleAddSubject} className="space-y-3.5">
          <div>
            <label className="block text-xs font-black uppercase tracking-wider text-slate-800 mb-1">
              Subject / Course Name
            </label>
            <input
              type="text"
              value={newSubjectName}
              onChange={(e) => setNewSubjectName(e.target.value)}
              placeholder="e.g. Organic Chemistry"
              className="w-full px-3.5 py-2 text-xs bg-[#FAF8F5] border-2 border-slate-900 rounded-xl font-bold focus:outline-hidden focus:ring-2 focus:ring-cyan-400 shadow-neo-sm"
              required
            />
          </div>

          <div>
            <label className="block text-xs font-black uppercase tracking-wider text-slate-800 mb-1">
              Amharic / Ethiopic Title (Optional)
            </label>
            <input
              type="text"
              value={newSubjectAmharicName}
              onChange={(e) => setNewSubjectAmharicName(e.target.value)}
              placeholder="e.g. ኦርጋኒክ ኬሚስትሪ"
              className="w-full px-3.5 py-2 text-xs bg-[#FAF8F5] border-2 border-slate-900 rounded-xl font-bold font-ethiopic focus:outline-hidden focus:ring-2 focus:ring-cyan-400 shadow-neo-sm"
            />
          </div>

          <div>
            <label className="block text-xs font-black uppercase tracking-wider text-slate-800 mb-1">
              Course Code (Optional)
            </label>
            <input
              type="text"
              value={newSubjectCode}
              onChange={(e) => setNewSubjectCode(e.target.value)}
              placeholder="e.g. CHEM201"
              className="w-full px-3.5 py-2 text-xs bg-[#FAF8F5] border-2 border-slate-900 rounded-xl font-bold focus:outline-hidden focus:ring-2 focus:ring-cyan-400 shadow-neo-sm"
            />
          </div>

          <div className="flex items-center justify-end gap-2.5 pt-3 border-t-2 border-slate-100">
            <button
              type="button"
              onClick={() => setOpenModal(null)}
              className="px-4 py-2 text-xs font-black text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl border-2 border-slate-900 transition-all shadow-neo-sm"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-5 py-2 text-xs font-black text-slate-950 bg-yellow-300 hover:bg-yellow-200 rounded-xl border-2 border-slate-900 transition-all shadow-neo active:translate-y-0.5"
            >
              Create Subject
            </button>
          </div>
        </form>

        {/* List of existing subjects with delete */}
        {subjects.length > 0 && (
          <div className="mt-5 pt-3 border-t-2 border-slate-200">
            <h4 className="text-[11px] font-black uppercase tracking-wider text-slate-600 mb-2">
              Existing Subjects
            </h4>
            <div className="space-y-1.5 max-h-36 overflow-y-auto pr-1">
              {subjects.map((s) => (
                <div
                  key={s.id}
                  className="p-2.5 bg-slate-50 border-2 border-slate-900 rounded-xl flex items-center justify-between text-xs shadow-xs"
                >
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-slate-900">
                      {s.name} {s.code && `(${s.code})`}
                    </span>
                    {s.amharicName && (
                      <span className="text-xs font-bold text-slate-600 font-ethiopic border-l-2 border-slate-300 pl-2">
                        {s.amharicName}
                      </span>
                    )}
                  </div>
                  {subjects.length > 1 && (
                    <button
                      onClick={(e) => handleDeleteSubject(s.id, e)}
                      className="text-rose-600 hover:bg-rose-100 p-1 rounded-md transition-colors"
                      title="Delete subject"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </Modal>

      {/* Confirm Delete Subject */}
      <Modal
        open={confirmDeleteSubjectId !== null}
        onClose={() => setConfirmDeleteSubjectId(null)}
        title="Delete Subject"
        subtitle="This cannot be undone"
        icon={<Trash2 className="w-5 h-5" />}
        iconClassName="bg-rose-200 text-rose-950"
      >
        <p className="text-sm font-bold text-slate-700 mb-5">
          Delete{' '}
          <span className="text-slate-950">
            &ldquo;{subjects.find((s) => s.id === confirmDeleteSubjectId)?.name}&rdquo;
          </span>{' '}
          and all of its Notes, Quizzes, Exams and Study Tasks?
        </p>
        <div className="flex items-center justify-end gap-2.5 pt-3 border-t-2 border-slate-100">
          <button
            type="button"
            onClick={() => setConfirmDeleteSubjectId(null)}
            className="px-4 py-2 text-xs font-black text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl border-2 border-slate-900 transition-all shadow-neo-sm"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => {
              if (confirmDeleteSubjectId) deleteSubject(confirmDeleteSubjectId);
              setConfirmDeleteSubjectId(null);
            }}
            className="px-5 py-2 text-xs font-black text-white bg-rose-600 hover:bg-rose-700 rounded-xl border-2 border-slate-900 transition-all shadow-neo active:translate-y-0.5"
          >
            Delete Subject
          </button>
        </div>
      </Modal>
    </div>
  );
}

